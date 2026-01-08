import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, set, off, onValue, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

/* Firebase */
const firebaseConfig = {
  apiKey: "AIzaSyACPz5aLolmlooYyp4ZYz3qH4hQnJxODY0",
  databaseURL: "https://mini-whatsapp-fe8bd-default-rtdb.firebaseio.com"
};
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let username="", roomPath="", messagesRef=null, myUid="anon_"+Math.floor(Math.random()*10000);
let isInPublic=false, connectedUsersRef=null;

const messagesDiv = document.getElementById("messages");
const header = document.getElementById("chatHeader");

/* LOGIN */
window.login = () => {
  username = document.getElementById("usernameInput").value.trim();
  if(!username) return alert("Enter username");
};

/* JOIN PUBLIC */
window.joinPublic = () => {
  if(!username) return alert("Set username");
  roomPath="publicChat";
  header.innerText="🌍 Public Chat";
  messagesDiv.innerHTML="";
  isInPublic=true;

  messagesRef = ref(db, `${roomPath}/messages`);
  connectedUsersRef = ref(db, `${roomPath}/connectedUsers/${myUid}`);

  // Mark user as connected
  set(connectedUsersRef, username);
  connectedUsersRef.onDisconnect().remove();

  // Remove messages if last user leaves
  const allUsersRef = ref(db, `${roomPath}/connectedUsers`);
  onValue(allUsersRef, snap => {
    const users = snap.val() || {};
    if(Object.keys(users).length===0){
      remove(ref(db, `${roomPath}/messages`));
    }
  });

  attachListeners();
};

/* JOIN PRIVATE */
window.joinPrivate = () => {
  if(!username) return alert("Set username");
  const room=document.getElementById("privateRoomInput").value.trim();
  if(!room) return alert("Room required");
  roomPath=`private/${room}`;
  header.innerText=`🔒 Private Room ${room}`;
  messagesDiv.innerHTML="";
  attachListeners();
};

/* ATTACH LISTENERS */
function attachListeners(){
  if(!roomPath) return;
  if(messagesRef) off(messagesRef);

  messagesRef = ref(db, `${roomPath}/messages`);

  onChildAdded(messagesRef, snap=>{
    const m = snap.val();
    const div=document.createElement("div");
    if(m.system){ div.className="system"; div.textContent=m.text; }
    else{
      div.className="msg "+(m.user===username?"me":"other");
      div.innerHTML=`<b>${m.user}</b><br>${m.text||''}`;
      if(m.imageBase64) div.innerHTML+=`<br><img src="${m.imageBase64}" onclick="openMedia('${m.imageBase64}','image')">`;
      if(m.videoBase64) div.innerHTML+=`<br><video src="${m.videoBase64}" onclick="openMedia('${m.videoBase64}','video')" controls></video>`;
      if(m.audioBase64) div.innerHTML+=`<br><audio controls src="${m.audioBase64}"></audio>`;
    }
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop=messagesDiv.scrollHeight;
  });
}

/* SEND MESSAGE */
window.sendMessage=()=>{
  const text=document.getElementById("message").value.trim();
  if(!text||!roomPath) return;
  push(messagesRef,{user:username,text});
  document.getElementById("message").value="";
};

/* TYPING */
window.setTyping=()=>{
  if(!roomPath) return;
  set(ref(db,`${roomPath}/typing/${myUid}`),true);
  setTimeout(()=>set(ref(db,`${roomPath}/typing/${myUid}`),false),1000);
};

/* IMAGE / VIDEO */
document.getElementById("imageBtn").onclick=()=>document.getElementById("imageInput").click();
window.sendImage=(input)=>{
  if(!roomPath||!input.files[0]) return;
  const reader=new FileReader();
  reader.onloadend=()=>push(ref(db,`${roomPath}/messages`),{user:username,imageBase64:reader.result,timestamp:Date.now()});
  reader.readAsDataURL(input.files[0]);
};
document.getElementById("videoBtn").onclick=()=>document.getElementById("videoInput").click();
window.sendVideo=(input)=>{
  if(!roomPath||!input.files[0]) return;
  const reader=new FileReader();
  reader.onloadend=()=>push(ref(db,`${roomPath}/messages`),{user:username,videoBase64:reader.result,timestamp:Date.now()});
  reader.readAsDataURL(input.files[0]);
};

/* VOICE */
let recorder, audioChunks=[];
window.startRecording=async ()=>{
  if(!roomPath) return;
  const stream=await navigator.mediaDevices.getUserMedia({audio:true});
  recorder=new MediaRecorder(stream);
  audioChunks=[];
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

/* MEDIA MODAL */
function openMedia(src,type){
  const modal=document.getElementById("mediaModal");
  const img=document.getElementById("mediaModalImg");
  const vid=document.getElementById("mediaModalVideo");
  if(type==="image"){ img.src=src; img.style.display="block"; vid.style.display="none"; }
  else if(type==="video"){ vid.src=src; vid.style.display="block"; img.style.display="none"; }
  modal.style.display="flex";
}
function closeMedia(){
  const modal=document.getElementById("mediaModal");
  modal.style.display="none";
  const vid=document.getElementById("mediaModalVideo");
  vid.pause();
  vid.currentTime=0;
}

/* VIDEO CALL */
let localStream=null, screenSharing=false;
window.startCall=async ()=>{
  document.getElementById("videoUI").style.display="flex";
  if(!localStream){
    localStream = await navigator.mediaDevices.getUserMedia({video:true,audio:true});
    addVideo(localStream,true);
  }
};
function addVideo(stream,isLocal){
  const grid=document.getElementById("videoGrid");
  const div=document.createElement("div");
  div.className="videoBox";
  const v=document.createElement("video");
  v.srcObject=stream; v.autoplay=true;
  if(isLocal)v.muted=true;
  div.appendChild(v);
  grid.appendChild(div);
}
window.shareScreen=async ()=>{
  if(screenSharing) return stopScreenShare();
  try{
    const screen=await navigator.mediaDevices.getDisplayMedia({video:true});
    screenSharing=true;
    document.querySelector(".videoBox video").srcObject=screen;
    screen.getTracks()[0].onended=stopScreenShare;
  }catch(e){alert("Screen share failed: "+e.message);}
};
function stopScreenShare(){ screenSharing=false; if(localStream) document.querySelector(".videoBox video").srcObject=localStream; }
window.endCall=()=>document.getElementById("videoUI").style.display="none";
window.exitFullscreen=()=>document.getElementById("videoUI").style.display="none";
window.minimizeCall=()=>document.getElementById("videoUI").style.display="none";

/* THEME */
window.toggleTheme=()=>document.body.classList.toggle("light");
