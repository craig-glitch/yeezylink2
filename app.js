import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, set, onChildAdded, onValue, remove, off } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

/* Firebase */
const firebaseConfig = {
  apiKey:"AIzaSyACPz5aLolmlooYyp4ZYz3qH4hQnJxODY0",
  databaseURL:"https://mini-whatsapp-fe8bd-default-rtdb.firebaseio.com"
};
const app=initializeApp(firebaseConfig);
const db=getDatabase(app);

/* STATE */
let username="", roomPath="", messagesRef=null, myUid="anon_"+Math.floor(Math.random()*10000);
let localStream=null, peers={}, callRef=null;

/* DOM */
const messagesDiv=document.getElementById("messages");
const header=document.getElementById("chatHeader");

/* LOGIN */
window.login=()=>{ username=document.getElementById("usernameInput").value.trim(); if(!username) return alert("Enter username"); };

/* JOIN PUBLIC */
window.joinPublic=()=>{
  if(!username) return alert("Set username");
  roomPath="publicChat"; header.innerText="🌍 Public Chat"; messagesDiv.innerHTML="";
  messagesRef=ref(db,`${roomPath}/messages`);
  remove(messagesRef); // clear public messages
  attachListeners();
};

/* JOIN PRIVATE */
window.joinPrivate=()=>{
  if(!username) return alert("Set username");
  const room=document.getElementById("privateRoomInput").value.trim();
  if(!room) return alert("Room required");
  roomPath=`private/${room}`; header.innerText=`🔒 Private Room ${room}`; messagesDiv.innerHTML="";
  attachListeners();
};

/* LISTENERS */
function attachListeners(){
  if(!roomPath) return;
  if(messagesRef) off(messagesRef);
  messagesRef=ref(db,`${roomPath}/messages`);
  onChildAdded(messagesRef,snap=>{
    const m=snap.val();
    const div=document.createElement("div");
    div.className="msg "+(m.user===username?"me":"other");
    div.innerHTML=`<b>${m.user}</b><br>${m.text||''}`;
    if(m.imageBase64) div.innerHTML+=`<br><img src="${m.imageBase64}">`;
    if(m.videoBase64) div.innerHTML+=`<br><video src="${m.videoBase64}" controls></video>`;
    if(m.audioBase64) div.innerHTML+=`<br><audio controls src="${m.audioBase64}"></audio>`;
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop=messagesDiv.scrollHeight;
  });
}

/* SEND MESSAGE */
window.sendMessage=()=>{
  const text=document.getElementById("message").value.trim();
  if(!text||!roomPath) return;
  push(messagesRef,{user:username,text,timestamp:Date.now()});
  document.getElementById("message").value="";
};

/* TYPING */
window.setTyping=()=>{ if(!roomPath) return; set(ref(db,`${roomPath}/typing/${myUid}`),true); setTimeout(()=>set(ref(db,`${roomPath}/typing/${myUid}`),false),1000); };

/* IMAGE/VIDEO */
document.getElementById("imageBtn").onclick=()=>document.getElementById("imageInput").click();
window.sendImage=(input)=>{ if(!roomPath||!input.files[0]) return; const reader=new FileReader(); reader.onloadend=()=>push(ref(db,`${roomPath}/messages`),{user:username,imageBase64:reader.result,timestamp:Date.now()}); reader.readAsDataURL(input.files[0]); }
document.getElementById("videoBtn").onclick=()=>document.getElementById("videoInput").click();
window.sendVideo=(input)=>{ if(!roomPath||!input.files[0]) return; const reader=new FileReader(); reader.onloadend=()=>push(ref(db,`${roomPath}/messages`),{user:username,videoBase64:reader.result,timestamp:Date.now()}); reader.readAsDataURL(input.files[0]); }

/* VOICE RECORDING */
let recorder,audioChunks=[];
window.startRecording=async()=>{
  if(!roomPath) return;
  const stream=await navigator.mediaDevices.getUserMedia({audio:true});
  recorder=new MediaRecorder(stream); audioChunks=[];
  recorder.ondataavailable=e=>audioChunks.push(e.data);
  recorder.onstop=()=>{
    const blob=new Blob(audioChunks,{type:"audio/webm"});
    const reader=new FileReader();
    reader.onloadend=()=>push(ref(db,`${roomPath}/messages`),{user:username,audioBase64:reader.result,timestamp:Date.now()});
    reader.readAsDataURL(blob);
  };
  recorder.start();
  setTimeout(()=>recorder.stop(),5000);
};

/* SIMPLE VIDEO CALL */
const videoGrid=document.getElementById("videoGrid");
const videoUI=document.getElementById("videoUI");
window.startCall=async()=>{
  if(!roomPath) return alert("Join a room first");
  callRef=ref(db,`${roomPath}/call`);
  document.getElementById("startCallBtn").style.display="none";
  document.getElementById("joinCallBtn").style.display="inline-block";
  // signal presence
  set(ref(db,`${roomPath}/call/${myUid}`),{username});
  ref(db,`${roomPath}/call/${myUid}`).onDisconnect().remove();
  videoUI.style.display="flex";
  if(!localStream){
    localStream=await navigator.mediaDevices.getUserMedia({video:true,audio:true});
    addVideo(localStream,true);
  }
};
window.joinCall=async()=>{
  if(!localStream) localStream=await navigator.mediaDevices.getUserMedia({video:true,audio:true});
  addVideo(localStream,true);
  videoUI.style.display="flex";
};
function addVideo(stream,isLocal){
  const div=document.createElement("div");
  const v=document.createElement("video");
  v.srcObject=stream; v.autoplay=true; if(isLocal)v.muted=true;
  div.appendChild(v);
  videoGrid.appendChild(div);
}
window.endCall=()=>{ videoUI.style.display="none"; localStream.getTracks().forEach(t=>t.stop()); videoGrid.innerHTML=""; localStream=null; }

/* THEME */
window.toggleTheme=()=>document.body.classList.toggle("light");
