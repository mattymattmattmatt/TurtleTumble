// Firebase and game logic
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-database.js";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDosCzACTepSkaY1dPYSgcsbmvT5hIB-Cw",
  authDomain: "turtle-tumble.firebaseapp.com",
  databaseURL: "https://turtle-tumble-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "turtle-tumble",
  storageBucket: "turtle-tumble.firebasestorage.app",
  messagingSenderId: "1075675901561",
  appId: "1:1075675901561:web:5187df14444549117faea8",
  measurementId: "G-PJ1B80451T"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let gameStarted = false;
let playerId = null;

// Password Authentication and Start Game
function authenticate() {
  const password = document.getElementById('password').value;

  // Simple password validation (you can improve this later with Firebase Authentication)
  if (password === "password123") {
    playerId = 'player1'; // or 'player2' depending on who logs in first
    document.getElementById('password-container').style.display = 'none';
    document.getElementById('startButton').style.display = 'block';
  } else {
    alert("Incorrect password. Try again.");
  }
}

function startGame() {
  document.getElementById('startButton').style.display = 'none';
  document.getElementById('score').style.display = 'block';
  document.getElementById('timer').style.display = 'block';
  gameStarted = true;

  // Start the timer countdown
  startTimer();

  // Save initial game state to Firebase
  const gameRef = ref(db, 'games/gameId');
  set(gameRef, {
    player1: { x: 100, y: 100 },
    player2: { x: 200, y: 200 },
    score: { player1: 0, player2: 0 },
    timer: 120
  });

  // Sync game state with Firebase in real-time
  onValue(gameRef, (snapshot) => {
    const data = snapshot.val();
    document.getElementById('player1').style.left = `${data.player1.x}px`;
    document.getElementById('player1').style.top = `${data.player1.y}px`;
    document.getElementById('player2').style.left = `${data.player2.x}px`;
    document.getElementById('player2').style.top = `${data.player2.y}px`;

    document.getElementById('score').textContent = `Player 1: ${data.score.player1} | Player 2: ${data.score.player2}`;
  });
}

function startTimer() {
  let timeLeft = 120;
  const timerElement = document.getElementById('timer');
  const interval = setInterval(() => {
    timeLeft--;
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timerElement.textContent = `Time Left: ${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

    if (timeLeft <= 0) {
      clearInterval(interval);
      endGame();
    }
  }, 1000);
}

function endGame() {
  // Logic to determine the winner based on who fell off the platform less
  alert('Game Over!');
}

// Gyroscope controls for turtle movement
window.addEventListener('deviceorientation', function(event) {
  if (!gameStarted) return;

  const beta = event.beta;  // Forward/back tilt (X-axis)
  const gamma = event.gamma; // Left/right tilt (Y-axis)

  let playerElement = document.getElementById(playerId);
  let currentPosition = playerElement.getBoundingClientRect();

  const speed = 5;
  const maxTilt = 30; // Max tilt angle to move player

  if (Math.abs(beta) < maxTilt) {
    playerElement.style.top = (currentPosition.top + speed * (beta / maxTilt)) + 'px';
  }

  if (Math.abs(gamma) < maxTilt) {
    playerElement.style.left = (currentPosition.left + speed * (gamma / maxTilt)) + 'px';
  }

  // Update player position in Firebase
  const playerRef = ref(db, `games/gameId/${playerId}`);
  set(playerRef, {
    x: currentPosition.left + gamma * 5,
    y: currentPosition.top + beta * 5
  });
});
