import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getDatabase, ref, set, onValue, update, get, child, onDisconnect } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";

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

// Reference to the game state in Firebase
const gameRef = ref(db, 'games/gameId');

// Wait for the DOM to be fully loaded before adding event listeners
window.addEventListener('DOMContentLoaded', (event) => {
  // Set up the event listener for the "Join Game" button
  document.getElementById('join-button').addEventListener('click', authenticate);
  
  // Set up the event listener for the "Start Game" button
  document.getElementById('start-game-button').addEventListener('click', startGame);
  
  // Set up the event listener for the "Reset Game" button (optional)
  document.getElementById('reset-game-button').addEventListener('click', resetGame);
  
  // Listen for changes in the game state to update positions and scores
  onValue(gameRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) return;
    
    // Update positions
    if (data.player1 && data.player1.x !== undefined && data.player1.y !== undefined) {
      const player1 = document.getElementById('player1');
      player1.style.left = `${data.player1.x}px`;
      player1.style.top = `${data.player1.y}px`;
    }
    
    if (data.player2 && data.player2.x !== undefined && data.player2.y !== undefined) {
      const player2 = document.getElementById('player2');
      player2.style.left = `${data.player2.x}px`;
      player2.style.top = `${data.player2.y}px`;
    }
    
    // Update scores
    if (data.score) {
      document.getElementById('score').textContent = `Score: Player 1 - ${data.score.player1}, Player 2 - ${data.score.player2}`;
    }

    // If the game has started and timer is running
    if (data.started && !gameStarted) {
      gameStarted = true;
      document.getElementById('start-button-container').style.display = 'none';
      document.getElementById('score').style.display = 'block';
      document.getElementById('timer').style.display = 'block';
      startTimer(data.timer);
    }

    // Check if any player has disconnected
    if (gameStarted) {
      if (!data.player1 && playerId === 'player1') {
        alert('Player 1 has disconnected.');
        resetGame();
      }
      if (!data.player2 && playerId === 'player2') {
        alert('Player 2 has disconnected.');
        resetGame();
      }
    }
  });
});

// Authenticate function
function authenticate() {
  const password = document.getElementById('password').value.trim();
  
  if (password === "password123") { // Example password
    assignPlayer();
  } else {
    alert("Incorrect password. Try again.");
  }
}

// Assign player as Player 1 or Player 2
function assignPlayer() {
  get(child(gameRef, 'player1')).then((snapshot) => {
    if (!snapshot.exists()) {
      playerId = 'player1';
      const player1Ref = ref(db, 'games/gameId/player1');
      set(player1Ref, {
        x: 0,
        y: 0,
        ready: false
      });

      // Set up onDisconnect to remove player1 data when disconnected
      onDisconnect(player1Ref).remove();

      initializePlayerPosition('player1');
    } else {
      get(child(gameRef, 'player2')).then((snapshot2) => {
        if (!snapshot2.exists()) {
          playerId = 'player2';
          const player2Ref = ref(db, 'games/gameId/player2');
          set(player2Ref, {
            x: 0,
            y: 0,
            ready: false
          });

          // Set up onDisconnect to remove player2 data when disconnected
          onDisconnect(player2Ref).remove();

          initializePlayerPosition('player2');
        } else {
          alert("Game is full. Please try again later.");
        }
      });
    }
  }).catch((error) => {
    console.error(error);
  });
}

// Initialize player positions on the island
function initializePlayerPosition(player) {
  const island = document.getElementById('island');
  const islandRect = island.getBoundingClientRect();
  const gameRect = document.getElementById('game').getBoundingClientRect();
  
  const islandCenterX = islandRect.left + islandRect.width / 2 - gameRect.left;
  const islandCenterY = islandRect.top + islandRect.height / 2 - gameRect.top;
  
  const offset = player === 'player1' ? -60 : 60; // Adjust position for Player 1 and Player 2
  
  const playerElement = document.getElementById(player);
  playerElement.style.left = `${islandCenterX + offset}px`;
  playerElement.style.top = `${islandCenterY}px`;
  
  // Update Firebase with initial position
  update(ref(db, `games/gameId/${player}`), {
    x: islandCenterX + offset,
    y: islandCenterY
  });
  
  // Hide password container and show waiting message
  document.getElementById('password-container').style.display = 'none';
  document.getElementById('waiting-message').style.display = 'block';
  
  checkPlayersReady();
}

// Check if both players have joined
function checkPlayersReady() {
  onValue(gameRef, (snapshot) => {
    const data = snapshot.val();
    if (data && data.player1 && data.player2) {
      document.getElementById('waiting-message').style.display = 'none';
      document.getElementById('start-button-container').style.display = 'flex';
    }
  });
}

// Start the game
function startGame() {
  if (!gameStarted) {
    gameStarted = true;
    
    // Initialize game state in Firebase
    set(gameRef, {
      player1: {
        x: document.getElementById('player1').offsetLeft,
        y: document.getElementById('player1').offsetTop,
        ready: true
      },
      player2: {
        x: document.getElementById('player2').offsetLeft,
        y: document.getElementById('player2').offsetTop,
        ready: true
      },
      score: {
        player1: player1Falls,
        player2: player2Falls
      },
      timer: 120,
      started: true
    });

    // Hide start button and show score and timer
    document.getElementById('start-button-container').style.display = 'none';
    document.getElementById('score').style.display = 'block';
    document.getElementById('timer').style.display = 'block';
    
    // Start the timer
    startTimer();
  }
}

// Timer countdown
function startTimer(initialTime = 120) {
  let timeLeft = initialTime;
  const timerElement = document.getElementById('timer');
  
  const interval = setInterval(() => {
    timeLeft--;
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timerElement.textContent = `Time Left: ${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    
    // Update Firebase timer
    update(ref(db, 'games/gameId'), { timer: timeLeft });
    
    if (timeLeft <= 0) {
      clearInterval(interval);
      endGame();
    }
  }, 1000);
}

// End the game and determine the winner
function endGame() {
  get(child(gameRef, 'score')).then((snapshot) => {
    if (snapshot.exists()) {
      const scores = snapshot.val();
      if (scores.player1 < scores.player2) {
        alert('Player 1 wins!');
      } else if (scores.player2 < scores.player1) {
        alert('Player 2 wins!');
      } else {
        alert('It\'s a tie!');
      }
    }
    // Show the Reset button (optional)
    document.getElementById('reset-button-container').style.display = 'flex';
    // Reset game state
    resetGame();
  }).catch((error) => {
    console.error(error);
  });
}

// Reset game state in Firebase
function resetGame() {
  set(gameRef, {
    player1: {
      x: 0,
      y: 0,
      ready: false
    },
    player2: {
      x: 0,
      y: 0,
      ready: false
    },
    score: {
      player1: 0,
      player2: 0
    },
    timer: 120,
    started: false
  });

  // Reset local variables
  gameStarted = false;
  player1Falls = 0;
  player2Falls = 0;

  // Reset positions on the island
  initializePlayerPosition('player1');
  initializePlayerPosition('player2');

  // Hide Reset button (optional)
  document.getElementById('reset-button-container').style.display = 'none';
}

// Gyroscope controls for turtle movement
window.addEventListener('deviceorientation', function(event) {
  if (!gameStarted || !playerId) return;

  const beta = event.beta;  // Forward/back tilt (X-axis)
  const gamma = event.gamma; // Left/right tilt (Y-axis)

  let playerElement = document.getElementById(playerId);
  let currentPosition = {
    x: playerElement.offsetLeft,
    y: playerElement.offsetTop
  };

  const speed = 2; // Adjust speed as needed
  const maxTilt = 30; // Max tilt angle to move player

  // Calculate new position
  let newX = currentPosition.x + (gamma / maxTilt) * speed;
  let newY = currentPosition.y + (beta / maxTilt) * speed;

  // Boundary checks to prevent moving off-screen
  newX = Math.max(0, Math.min(newX, window.innerWidth - playerElement.offsetWidth));
  newY = Math.max(0, Math.min(newY, window.innerHeight - playerElement.offsetHeight));

  // Update player position
  playerElement.style.left = `${newX}px`;
  playerElement.style.top = `${newY}px`;

  // Update Firebase with new position
  update(ref(db, `games/gameId/${playerId}`), {
    x: newX,
    y: newY
  });

  // Check if player is knocked off the island
  if (isKnockedOff(newX, newY)) {
    knockOff(playerId);
  }
});

// Function to check if the player is knocked off the island
function isKnockedOff(x, y) {
  const island = document.getElementById('island');
  const islandRect = island.getBoundingClientRect();
  const gameRect = document.getElementById('game').getBoundingClientRect();

  // Calculate distance from island center
  const islandCenterX = islandRect.left + islandRect.width / 2 - gameRect.left;
  const islandCenterY = islandRect.top + islandRect.height / 2 - gameRect.top;
  const distance = Math.sqrt(Math.pow(x - islandCenterX, 2) + Math.pow(y - islandCenterY, 2));

  // Radius of the island minus half the turtle size to ensure full shell is on the island
  const islandRadius = islandRect.width / 2 - 16; // 32px turtle shell, half is 16px

  // If distance is greater than radius, player is off the island
  return distance > islandRadius;
}

// Function to handle player being knocked off
function knockOff(player) {
  // Increment fall count
  if (player === 'player1') {
    player1Falls++;
  } else {
    player2Falls++;
  }

  // Update score in Firebase
  update(ref(db, 'games/gameId/score'), {
    player1: player1Falls,
    player2: player2Falls
  });

  // Shrink the turtle shell
  const playerElement = document.getElementById(player);
  playerElement.style.transition = 'transform 0.5s ease-in-out';
  playerElement.style.transform = 'scale(0.5)';

  // Remove from game for 2 seconds
  setTimeout(() => {
    // Respawn the turtle shell
    playerElement.style.transform = 'scale(1)';
    
    // Reset position to island center
    const island = document.getElementById('island');
    const islandRect = island.getBoundingClientRect();
    const gameRect = document.getElementById('game').getBoundingClientRect();
    const islandCenterX = islandRect.left + islandRect.width / 2 - gameRect.left;
    const islandCenterY = islandRect.top + islandRect.height / 2 - gameRect.top;

    const offset = player === 'player1' ? -60 : 60; // Adjust position for Player 1 and Player 2

    const newX = islandCenterX + offset;
    const newY = islandCenterY;

    const playerElementNew = document.getElementById(player);
    playerElementNew.style.left = `${newX}px`;
    playerElementNew.style.top = `${newY}px`;

    // Update Firebase with respawned position
    update(ref(db, `games/gameId/${player}`), {
      x: newX,
      y: newY
    });
  }, 2000); // 2 seconds delay
}
