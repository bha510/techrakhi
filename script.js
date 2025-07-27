import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, query, where, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Firebase setup
const firebaseConfig = {
  apiKey: "AIzaSyC40ARjwUYMA2WPKxkX9DC81Mmn1AmNwhs",
  authDomain: "zyra-3a549.firebaseapp.com",
  databaseURL: "https://zyra-3a549-default-rtdb.firebaseio.com",
  projectId: "zyra-3a549",
  storageBucket: "zyra-3a549.appspot.com",
  messagingSenderId: "748573100132",
  appId: "1:748573100132:web:ae8eeeb02c7c5a2dc27771",
  measurementId: "G-K9Y9TN7Y24"
};
initializeApp(firebaseConfig);
const db = getFirestore();

// Ensure unique deviceId persists
let deviceId = localStorage.getItem('rakhi-device-id');
if (!deviceId) {
  deviceId = crypto.randomUUID();
  localStorage.setItem('rakhi-device-id', deviceId);
}

// Helper: counts actions by deviceId
async function countActions(collName) {
  const q = query(collection(db, collName), where('deviceId', '==', deviceId));
  const snap = await getDocs(q);
  return snap.size;
}

// ----- SPIN WHEEL -----
const canvas = document.getElementById("wheelCanvas");
const ctx = canvas.getContext("2d");
const segments = ["5%", "10%", "Secret Msg", "100%", "4 Rakhis", "play Ring Game"];
const spinBtn = document.getElementById("spinBtn");
const spinOutput = document.getElementById("spin-result");

drawWheel();
spinBtn.addEventListener("click", checkSpin);

async function checkSpin() {
  const name = document.getElementById("spinName").value.trim();
  if (!name) return alert("Enter your name!");
  const cnt = await countActions('spins');
  if (cnt > 0) return alert("🚫 You've already spun once!");
  launchSpin(name);
}

function drawWheel() {
  const angle = 2 * Math.PI / segments.length;
  segments.forEach((text, i) => {
    ctx.beginPath();
    ctx.fillStyle = i % 2 ? "#FFF8DC" : "#FFD700";
    ctx.moveTo(150,150);
    ctx.arc(150,150,150, i*angle, (i+1)*angle);
    ctx.lineTo(150,150);
    ctx.fill();
    ctx.save();
    ctx.translate(150,150);
    ctx.rotate(i*angle + angle/2);
    ctx.textAlign = "right";
    ctx.fillStyle = "#000";
    ctx.font = "16px sans-serif";
    ctx.fillText(text, 140, 10);
    ctx.restore();
  });
}

function launchSpin(name) {
  spinOutput.textContent = "";
  const extra = Math.floor(Math.random() * 360);
  const total = 360 * 5 + extra;
  const duration = 3000;
  let start;

  function animate(ts) {
    if (!start) start = ts;
    const progress = Math.min((ts - start) / duration, 1);
    const angle = total * progress;
    ctx.clearRect(0,0,300,300);
    ctx.save();
    ctx.translate(150,150);
    ctx.rotate(angle * Math.PI / 180);
    ctx.translate(-150,-150);
    drawWheel();
    ctx.restore();
    if (progress < 1) requestAnimationFrame(animate);
    else finalizeSpin(name, total);
  }
  requestAnimationFrame(animate);
}

async function finalizeSpin(name, totalRot) {
  const deg = totalRot % 360;
  const idx = Math.floor((segments.length - (deg/360)*segments.length)) % segments.length;
  let result = segments[idx];
  if (result === "Secret Msg") {
    const bonus = Math.floor(Math.random() * 10) + 1;
    result = `Secret Msg: you got ${bonus} bonus Rakhis!`;
  }
  spinOutput.textContent = `🎉 You won: ${result}`;
  const rQty = document.getElementById("feedbackRakhis").value || "0";
  const rRs = document.getElementById("feedbackRs").value || "0";
  await addDoc(collection(db, 'spins'), {
    name, result, rakhiQty: rQty, rakhiRs: rRs,
    deviceId, time: new Date().toISOString()
  });
}

// ----- FEEDBACK -----
document.getElementById("submitFeedback").addEventListener("click", async () => {
  const name = document.getElementById("feedbackName").value.trim();
  const txt = document.getElementById("feedbackText").value.trim();
  const buys = document.getElementById("feedbackRakhis").value;
  const amount = document.getElementById("feedbackRs").value;
  if (!name || !txt || !buys || !amount) return alert("Complete all fields!");
  const cnt = await countActions('feedback');
  if (cnt > 0) return alert("🚫 Feedback can be given only once per device!");
  const selfie = document.getElementById("canvas").toDataURL('image/png');
  await addDoc(collection(db, 'feedback'), {
    name, feedback: txt, selfie, rakhis: buys, amount, deviceId, time: new Date().toISOString()
  });
  alert("✅ Thank you for the feedback!");
});

// ----- SELFIE -----
navigator.mediaDevices.getUserMedia({ video: true })
  .then(s => document.getElementById("video").srcObject = s);
document.getElementById("captureBtn").addEventListener("click", () => {
  const video = document.getElementById("video"), canvas = document.getElementById("canvas");
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
});

// ----- GUESS THE NUMBER -----
const target = Math.floor(Math.random() * 100) + 1;
const maxGuess = 10;
document.getElementById("guessBtn").addEventListener("click", async () => {
  const name = document.getElementById("guessName").value.trim();
  const g = Number(document.getElementById("guessInput").value);
  const msg = document.getElementById("gameMessage");
  if (!name) return msg.textContent = "Enter your name.";
  const used = await countActions('guessGame');
  if (used >= maxGuess) return msg.textContent = "🚫 You’ve used all your 10 chances!";
  if (!Number.isInteger(g) || g < 1 || g > 100) {
    return msg.textContent = "Enter number between 1–100.";
  }
  const success = g === target;
  msg.textContent = success ? `🎉 Correct in ${used+1} tries!` : g < target ? "🔼 Too low!" : "🔽 Too high!";
  await addDoc(collection(db,'guessGame'), {
    name, guess: g, success, attempt: used + 1,
    deviceId, time: new Date().toISOString()
  });
});

// ----- TAP GAME -----
document.getElementById("startTapGame").addEventListener("click", async () => {
  const name = document.getElementById("tapName").value.trim();
  if (!name) return alert("Enter your name!");
  const used = await countActions('tapGame');
  if (used > 0) return alert("🚫 You already played Tap Game!");
  let score = 0;
  document.getElementById("tapScore").textContent = '0';
  document.getElementById("tapGameArea").classList.remove("hidden");
  const endGame = async () => {
    document.getElementById("tapGameArea").classList.add("hidden");
    alert(`⏱️ Time’s up! Your score: ${score}`);
    await addDoc(collection(db,'tapGame'), {
      name, score, deviceId, time: new Date().toISOString()
    });
  };
  setTimeout(endGame, 5000);

  document.getElementById("circleTap").onclick = () => {
    score++;
    document.getElementById("tapScore").textContent = score;
  };
});
