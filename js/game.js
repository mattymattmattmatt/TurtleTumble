import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getDatabase, ref, set, onValue, update, get, child, onDisconnect, remove } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";

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

// Game Variables
let gameStarted = false;
let playerId = null;
let gamePassword = null;
let player1Falls = 0;
let player2Falls = 0;
let timerInterval = null;
let velocity = { player1: { x: 0, y: 0 }, player2: { x: 0, y: 0 } };
const friction = 0.95; // Friction coefficient for smoother movement

// References
let gameRef = null;
let playerRef = null;

// DOM Elements
document.addEventListener('DOMContentLoaded', () => {
  const passwordContainer = document.getElementById('password-container');
  const joinContainer = document.getElementById('join-container');
  const createButton = document.getElementById('create-button');
  const joinButton = document.getElementById('join-button');
  const startButton = document.getElementById('start-game-button');
  const disconnectButton = document.getElementById('disconnect-button');
  const waitingMessage = document.getElementById('waiting-message');
  const scoreDisplay = document.getElementById('score');
  const timerDisplay = document.getElementById('timer');
  const disconnectButtonContainer = document.getElementById('disconnect-button-container');
  const gameTitle = document.getElementById('game-title');

  // Event Listeners
  createButton.addEventListener('click', createGame);
  joinButton.addEventListener('click', joinGame);
  startButton.addEventListener('click', startGame);
  disconnectButton.addEventListener('click', disconnectGame);

  // Function to Create a New Game
  function createGame() {
    const passwordInput = document.getElementById('password').value.trim();
    if (passwordInput === "") {
      alert("Please enter a unique password to create a game.");
      return;
    }
    gamePassword = passwordInput;
    gameRef = ref(db, `games/${gamePassword}`);

    // Check if game password already exists
    get(gameRef).then((snapshot) => {
      if (snapshot.exists()) {
        alert("A game with this password already exists. Please choose another password.");
      } else {
        // Initialize game state
        set(gameRef, {
          player1: {
            x: 0,
            y: 0,
            ready: false
          },
          player2: null,
          score: {
            player1: 0,
            player2: 0
          },
          timer: 120,
          started: false
        }).then(() => {
          playerId = 'player1';
          playerRef = ref(db, `games/${gamePassword}/player1`);
          set(playerRef, {
            x: 0,
            y: 0,
            ready: false
          });
          // Set onDisconnect to remove player1 data
          onDisconnect(playerRef).remove();
          initializePlayerPosition('player1');
          // Switch UI to waiting for player2
          passwordContainer.style.display = 'none';
          joinContainer.style.display = 'none';
          waitingMessage.style.display = 'block';
          waitingMessage.textContent = "Waiting for the other player to join...";
          gameTitle.textContent = "Turtle Tumble - Host";
        });
      }
    }).catch((error) => {
      console.error(error);
    });
  }

  // Function to Join an Existing Game
  function joinGame() {
    const passwordInput = document.getElementById('join-password').value.trim();
    if (passwordInput === "") {
      alert("Please enter the host's password to join the game.");
      return;
    }
    gamePassword = passwordInput;
    gameRef = ref(db, `games/${gamePassword}`);

    // Check if game exists and has an available slot
    get(gameRef).then((snapshot) => {
      if (!snapshot.exists()) {
        alert("No game found with this password. Please check and try again.");
      } else {
        const data = snapshot.val();
        if (data.player2) {
          alert("Game is full. Please try another game.");
        } else {
          playerId = 'player2';
          playerRef = ref(db, `games/${gamePassword}/player2`);
          set(playerRef, {
            x: 0,
            y: 0,
            ready: false
          });
          // Set onDisconnect to remove player2 data
          onDisconnect(playerRef).remove();
          initializePlayerPosition('player2');
          // Switch UI to waiting for host to start the game
          passwordContainer.style.display = 'none';
          joinContainer.style.display = 'none';
          waitingMessage.style.display = 'block';
          waitingMessage.textContent = "Waiting for the host to start the game...";
          gameTitle.textContent = "Turtle Tumble - Player 2";
        }
      }
    }).catch((error) => {
      console.error(error);
    });
  }

  // Function to Initialize Player Position on the Island
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
    update(ref(db, `games/${gamePassword}/${player}`), {
      x: islandCenterX + offset,
      y: islandCenterY
    }).then(() => {
      // Show waiting message
      if (playerId === 'player1') {
        // Host waits for player2 to join
        waitingMessage.textContent = "Waiting for the other player to join...";
      } else {
        // Player2 waits for game to start
        waitingMessage.textContent = "Waiting for the host to start the game...";
      }
    });

    // Hide join/create containers and show waiting message
    if (playerId === 'player1') {
      passwordContainer.style.display = 'none';
      joinContainer.style.display = 'none';
    } else {
      passwordContainer.style.display = 'none';
      joinContainer.style.display = 'none';
    }
    waitingMessage.style.display = 'block';
  }

  // Function to Start the Game
  function startGame() {
    if (playerId !== 'player1') {
      alert("Only the host can start the game.");
      return;
    }

    // Update game state to started
    set(gameRef, {
      player1: {
        x: parseFloat(document.getElementById('player1').style.left),
        y: parseFloat(document.getElementById('player1').style.top),
        ready: true
      },
      player2: {
        x: parseFloat(document.getElementById('player2').style.left),
        y: parseFloat(document.getElementById('player2').style.top),
        ready: true
      },
      score: {
        player1: player1Falls,
        player2: player2Falls
      },
      timer: 120,
      started: true
    }).then(() => {
      // Hide start button and show score, timer, and disconnect button
      startButton.style.display = 'none';
      waitingMessage.style.display = 'none';
      scoreDisplay.style.display = 'block';
      timerDisplay.style.display = 'block';
      disconnectButtonContainer.style.display = 'block';
      // Start the timer
      startTimer();
    }).catch((error) => {
      console.error(error);
    });
  }

  // Function to Start the Timer
  function startTimer(initialTime = 120) {
    let timeLeft = initialTime;
    timerDisplay.textContent = `Time Left: ${formatTime(timeLeft)}`;

    timerInterval = setInterval(() => {
      timeLeft--;
      timerDisplay.textContent = `Time Left: ${formatTime(timeLeft)}`;

      // Update Firebase timer
      update(ref(db, `games/${gamePassword}/timer`), {
        timer: timeLeft
      });

      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        endGame();
      }
    }, 1000);
  }

  // Function to Format Time as MM:SS
  function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  }

  // Function to End the Game
  function endGame() {
    clearInterval(timerInterval);

    // Determine the winner
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
      // Reset the game
      resetGame();
    }).catch((error) => {
      console.error(error);
    });
  }

  // Function to Reset the Game
  function resetGame() {
    // Reset game state in Firebase
    set(gameRef, {
      player1: {
        x: 0,
        y: 0,
        ready: false
      },
      player2: null,
      score: {
        player1: 0,
        player2: 0
      },
      timer: 120,
      started: false
    }).then(() => {
      // Reset local variables
      gameStarted = false;
      player1Falls = 0;
      player2Falls = 0;
      velocity = { player1: { x: 0, y: 0 }, player2: { x: 0, y: 0 } };

      // Hide score, timer, disconnect button
      scoreDisplay.style.display = 'none';
      timerDisplay.style.display = 'none';
      disconnectButtonContainer.style.display = 'none';

      // Reset turtle positions on the island
      if (playerId === 'player1' || playerId === 'player2') {
        initializePlayerPosition(playerId);
      }

      // Optionally, show create/join containers again
      if (playerId === 'player1') {
        passwordContainer.style.display = 'block';
        gameTitle.textContent = "Turtle Tumble - Create a Game";
      } else if (playerId === 'player2') {
        joinContainer.style.display = 'block';
        gameTitle.textContent = "Turtle Tumble - Join a Game";
      }
    }).catch((error) => {
      console.error(error);
    });
  }

  // Function to Disconnect from the Game
  function disconnectGame() {
    if (playerRef) {
      remove(playerRef).then(() => {
        alert("You have disconnected from the game.");
        resetGame();
      }).catch((error) => {
        console.error(error);
      });
    }
  }

  // Function to Handle Gyroscope Controls with Enhanced Physics
  window.addEventListener('deviceorientation', function(event) {
    if (!gameStarted || !playerId) return;

    const beta = event.beta;  // Forward/back tilt (X-axis)
    const gamma = event.gamma; // Left/right tilt (Y-axis)

    // Define acceleration based on tilt
    const accelerationFactor = 0.05; // Adjust for sensitivity
    const maxTilt = 30; // Maximum tilt angle

    // Calculate acceleration
    let accelX = 0;
    let accelY = 0;

    if (Math.abs(beta) > 5) { // Deadzone
      accelY = (beta / maxTilt) * accelerationFactor;
    }
    if (Math.abs(gamma) > 5) { // Deadzone
      accelX = (gamma / maxTilt) * accelerationFactor;
    }

    // Update velocity
    velocity[playerId].x += accelX;
    velocity[playerId].y += accelY;

    // Apply friction
    velocity[playerId].x *= friction;
    velocity[playerId].y *= friction;

    // Update position
    let playerElement = document.getElementById(playerId);
    let currentX = parseFloat(playerElement.style.left);
    let currentY = parseFloat(playerElement.style.top);

    let newX = currentX + velocity[playerId].x * 50; // Multiply for noticeable movement
    let newY = currentY + velocity[playerId].y * 50;

    // Boundary checks
    newX = Math.max(0, Math.min(newX, window.innerWidth - playerElement.offsetWidth));
    newY = Math.max(0, Math.min(newY, window.innerHeight - playerElement.offsetHeight));

    // Update position
    playerElement.style.left = `${newX}px`;
    playerElement.style.top = `${newY}px`;

    // Update Firebase with new position
    update(ref(db, `games/${gamePassword}/${playerId}`), {
      x: newX,
      y: newY
    });

    // Collision Detection
    detectCollision();

    // Check if player is knocked off the island
    if (isKnockedOff(newX, newY)) {
      knockOff(playerId);
    }
  });

  // Function to Detect Collision Between Players
  function detectCollision() {
    const player1 = document.getElementById('player1');
    const player2 = document.getElementById('player2');

    const rect1 = player1.getBoundingClientRect();
    const rect2 = player2.getBoundingClientRect();

    if (rect1.left < rect2.left + rect2.width &&
        rect1.left + rect1.width > rect2.left &&
        rect1.top < rect2.top + rect2.height &&
        rect1.top + rect1.height > rect2.top) {
      // Simple elastic collision response
      const overlapX = (rect1.left + rect1.width / 2) - (rect2.left + rect2.width / 2);
      const overlapY = (rect1.top + rect1.height / 2) - (rect2.top + rect2.height / 2);
      const distance = Math.sqrt(overlapX * overlapX + overlapY * overlapY) || 1;

      const minimumDistance = (rect1.width / 2) + (rect2.width / 2);

      if (distance < minimumDistance) {
        const angle = Math.atan2(overlapY, overlapX);
        const moveDistance = (minimumDistance - distance) / 2;

        // Move player1
        let newX1 = parseFloat(player1.style.left) + Math.cos(angle) * moveDistance;
        let newY1 = parseFloat(player1.style.top) + Math.sin(angle) * moveDistance;

        // Move player2
        let newX2 = parseFloat(player2.style.left) - Math.cos(angle) * moveDistance;
        let newY2 = parseFloat(player2.style.top) - Math.sin(angle) * moveDistance;

        // Update positions with boundary checks
        newX1 = Math.max(0, Math.min(newX1, window.innerWidth - player1.offsetWidth));
        newY1 = Math.max(0, Math.min(newY1, window.innerHeight - player1.offsetHeight));
        newX2 = Math.max(0, Math.min(newX2, window.innerWidth - player2.offsetWidth));
        newY2 = Math.max(0, Math.min(newY2, window.innerHeight - player2.offsetHeight));

        player1.style.left = `${newX1}px`;
        player1.style.top = `${newY1}px`;
        player2.style.left = `${newX2}px`;
        player2.style.top = `${newY2}px`;

        // Update Firebase with new positions
        update(ref(db, `games/${gamePassword}/player1`), {
          x: newX1,
          y: newY1
        });
        update(ref(db, `games/${gamePassword}/player2`), {
          x: newX2,
          y: newY2
        });
      }
    }
  }

  // Function to Check if Player is Knocked Off the Island
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

  // Function to Handle Player Being Knocked Off
  function knockOff(player) {
    // Increment fall count
    if (player === 'player1') {
      player1Falls++;
    } else {
      player2Falls++;
    }

    // Update score in Firebase
    update(ref(db, `games/${gamePassword}/score`), {
      player1: player1Falls,
      player2: player2Falls
    });

    // Shrink the turtle shell to simulate falling
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
      update(ref(db, `games/${gamePassword}/${player}`), {
        x: newX,
        y: newY
      });
    }, 2000); // 2 seconds delay
  }

});
