import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js"; 
import { getDatabase, ref, push, onChildAdded, onValue, off, set, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

/* FIREBASE */
const firebaseConfig = {
  apiKey: "AIzaSyACPz5aLolmlooYyp4ZYz3qH4hQnJxODY0",
  authDomain: "mini-whatsapp-fe8bd.firebaseapp.com",
  databaseURL: "https://mini-whatsapp-fe8bd-default-rtdb.firebaseio.com",
  projectId: "mini-whatsapp-fe8bd",
  storageBucket: "mini-whatsapp-fe8bd.firebasestorage.app",
  messagingSenderId: "177968152040",
  appId: "1:177968152040:web:fc483829f765fb7950f85d"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

/* STATE */
let username = null;
let currentPath = null;
let messagesRef = null;
let typingRef = null;
let myUid = "anon_" + Math.floor(Math.random()*10000);

/* DOM */
const messagesDiv = document.getElementById("messages");
const typingDiv = document.getElementById("typing");
const header = document.getElementById("chatHeader");
const recordingIndicator = document.getElementById("recordingIndicator");

/* LOGIN */
window.login = () => {
  const input = document.getElementById("usernameInput").value.trim();
  if (!input) return alert("Enter display name");
  username = input;
  document.getElementById("loginDiv").style.display = "none";
};

/* JOIN PUBLIC */
window.joinPublic = async () => {
  if (!username) return alert("Set display name first");
  currentPath = "publicChat";
  header.innerText = "🌍 Public Chat";
  messagesDiv.innerHTML = "";
  remove(ref(db, `${currentPath}/messages`));
  attachListeners();
};

/* JOIN PRIVATE */
window.joinPrivate = () => {
  if (!username) return alert("Set display name first");
  const room = document.getElementById("privateRoomInput").value.trim();
  if (!room) return alert("Enter private room number");
  currentPath = `rooms/${room}`;
  header.innerText = `🔒 Private Room ${room}`;
  messagesDiv.innerHTML = "";
  attachListeners();
};

/* LISTENERS */
function cleanupListeners() {
  if (messagesRef) off(messagesRef);
  if (typingRef) off(typingRef);
}

function attachListeners() {
  cleanupListeners();
  messagesRef = ref(db, `${currentPath}/messages`);
  typingRef = ref(db, `${currentPath}/typing`);

  onChildAdded(messagesRef, snap => displayMessage(snap.val(), snap.key));

  onValue(typingRef, snap => {
    const t = snap.val() || {};
    typingDiv.innerText =
      Object.keys(t).some(u => u !== myUid && t[u]) ? "Someone is typing..." : "";
  });
}

/* DISPLAY MESSAGE */
function displayMessage(m, key) {
  const div = document.createElement("div");
  div.className = "msg " + (m.user === username ? "me" : "other");
  const ts = new Date(m.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});

  div.innerHTML = `<b>${m.user}</b><br>${m.text||""}`;
  if (m.imageBase64) div.innerHTML += `<br><img src="${m.imageBase64}">`;
  if (m.videoBase64) div.innerHTML += `<br><video controls src="${m.videoBase64}"></video>`;
  if (m.audioBase64) div.innerHTML += `<br><audio controls src="${m.audioBase64}"></audio>`;
  div.innerHTML += `<small>${ts}</small>`;

  div.innerHTML += `
    <div class="reactions">
      ${(Object.values(m.reactions||{})).join("")}
      <button class="reaction-btn" onclick="react('${key}','❤️')">❤️</button>
      <button class="reaction-btn" onclick="react('${key}','👍')">👍</button>
      <button class="reaction-btn" onclick="react('${key}','😂')">😂</button>
    </div>
  `;

  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

/* SEND MESSAGE */
window.sendMessage = () => {
  const text = document.getElementById("message").value.trim();
  if (!text || !currentPath) return;
  push(ref(db, `${currentPath}/messages`), { user: username, text, reactions:{}, timestamp: Date.now() });
  document.getElementById("message").value = "";
};

/* VOICE NOTES + EMOJI EFFECTS */
let recorder, audioChunks = [];
let emojiInterval;

const emojis = [
  "🎤","🎧","🎶","🎵","💚","💎","🔥","✨","💬","🔊",
  "📢","🌈","⭐","🟢","🟩","💥","⚡","🎙️","📣","🎼",
  "💫","🫶","😍","😎","🤩","😜","😄"
];

const emojiLayer = document.createElement("div");
emojiLayer.style.cssText = `
  position: fixed;
  bottom: 140px;
  left: 50%;
  transform: translateX(-50%);
  pointer-events: none;
  z-index: 9999;
`;
document.body.appendChild(emojiLayer);

function startEmojiPopup() {
  emojiInterval = setInterval(() => {
    const e = document.createElement("span");
    e.textContent = emojis[Math.floor(Math.random()*emojis.length)];
    e.style.cssText = `
      position:absolute;
      font-size:${22 + Math.random()*18}px;
      left:${Math.random()*140 - 70}px;
      opacity:1;
      transition:all 2.2s ease-out;
    `;
    emojiLayer.appendChild(e);

    setTimeout(() => {
      e.style.transform = "translateY(-160px)";
      e.style.opacity = "0";
    }, 50);

    setTimeout(() => e.remove(), 2200);
  }, 300);
}

function stopEmojiPopup() {
  clearInterval(emojiInterval);
}

/* START RECORDING */
window.startRecording = async () => {
  if (!currentPath) return alert("Join room first");
  const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
  recorder = new MediaRecorder(stream);
  audioChunks = [];

  recorder.ondataavailable = e => audioChunks.push(e.data);
  recorder.start();

  recordingIndicator.style.display = "block"; // GREEN POPUP
  document.getElementById("sendVoiceBtn").style.display = "inline-flex";

  startEmojiPopup();
};

/* SEND VOICE */
window.sendVoice = () => {
  if (!recorder) return;

  recorder.stop();
  recordingIndicator.style.display = "none";
  document.getElementById("sendVoiceBtn").style.display = "none";
  stopEmojiPopup();

  recorder.onstop = () => {
    const blob = new Blob(audioChunks, { type:"audio/webm" });
    const reader = new FileReader();
    reader.onloadend = () =>
      push(ref(db, `${currentPath}/messages`), {
        user: username,
        audioBase64: reader.result,
        reactions:{},
        timestamp: Date.now()
      });
    reader.readAsDataURL(blob);
  };
};

/* REACTIONS */
window.react = (msgKey, emoji) => {
  set(ref(db, `${currentPath}/messages/${msgKey}/reactions/${myUid}`), emoji);
};

/* THEME */
window.toggleTheme = () => document.body.classList.toggle("dark");
