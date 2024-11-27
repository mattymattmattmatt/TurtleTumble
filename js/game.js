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
let player1Falls = 0;
let player2Falls = 0;

// Password Authentication and Start Game
function authenticate() {
  const password = document.getElementById('password').value;

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
    score: { player1: player1Falls, player2: player2Falls },
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
  if (player1Falls < player2Falls) {
    alert('Player 1 wins!');
  } else if (player2Falls < player1Falls) {
    alert('Player 2 wins!');
  } else {
    alert('It\'s a tie!');
  }
}

// Shrink and Respawn Effect
function knockOff(player) {
  const playerElement = document.getElementById(player);
  playerElement.style.transform = "scale(0.5)";  // Shrink effect
  setTimeout(() => {
    playerElement.style.transform = "scale(1)";  // Reset to normal size
    respawnPlayer(player);
  }, 2000);  // Respawn after 2 seconds
}

// Respawn Player back on the island
function respawnPlayer(player) {
  const playerElement = document.getElementById(player);
  playerElement.style.left = "50%"; // Reset to island position
  playerElement.style.top = "50%";
  if (player === 'player1') {
    player1Falls++;
  } else {
    player2Falls++;
  }
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

  // Check if player is knocked off the island
  if (currentPosition.left < 0 || currentPosition.left > window.innerWidth || currentPosition.top < 0 || currentPosition.top > window.innerHeight) {
    knockOff(playerId);
  }
});
