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

// DOM Elements (to be initialized after DOM is loaded)
let passwordContainer;
let joinContainer;
let createButton;
let joinButton;
let startButton;
let disconnectButton;
let waitingMessage;
let scoreDisplay;
let timerDisplay;
let disconnectButtonContainer;
let gameTitle;
let mainMenu;
let createMenuButton;
let joinMenuButton;
let backFromCreate;
let backFromJoin;

// Define keys state
const keysPressed = {
  w: false,
  a: false,
  s: false,
  d: false
};

// Define movement speed
const keyboardSpeed = 0.03; // Further reduced for less sensitivity
const accelerationFactor = 0.015; // Further reduced for gyroscope sensitivity

// Wait for the DOM to load
document.addEventListener('DOMContentLoaded', () => {
  // Initialize DOM Elements
  passwordContainer = document.getElementById('password-container');
  joinContainer = document.getElementById('join-container');
  createButton = document.getElementById('create-button');
  joinButton = document.getElementById('join-button');
  startButton = document.getElementById('start-game-button');
  disconnectButton = document.getElementById('disconnect-button');
  waitingMessage = document.getElementById('waiting-message');
  scoreDisplay = document.getElementById('score');
  timerDisplay = document.getElementById('timer');
  disconnectButtonContainer = document.getElementById('disconnect-button-container');
  gameTitle = document.getElementById('game-title');
  mainMenu = document.getElementById('main-menu');
  createMenuButton = document.getElementById('create-menu-button');
  joinMenuButton = document.getElementById('join-menu-button');
  backFromCreate = document.getElementById('back-from-create');
  backFromJoin = document.getElementById('back-from-join');

  // Display control instructions based on device
  displayControlInstructions();

  // Event Listeners for Main Menu
  createMenuButton.addEventListener('click', () => {
    mainMenu.style.display = 'none';
    passwordContainer.style.display = 'block';
  });

  joinMenuButton.addEventListener('click', () => {
    mainMenu.style.display = 'none';
    joinContainer.style.display = 'block';
  });

  // Event Listeners for Back Buttons
  backFromCreate.addEventListener('click', () => {
    passwordContainer.style.display = 'none';
    mainMenu.style.display = 'block';
  });

  backFromJoin.addEventListener('click', () => {
    joinContainer.style.display = 'none';
    mainMenu.style.display = 'block';
  });

  // Event Listeners for Create and Join Buttons
  createButton.addEventListener('click', createGame);
  joinButton.addEventListener('click', joinGame);
  startButton.addEventListener('click', startGame);
  disconnectButton.addEventListener('click', disconnectGame);

  // Add keyboard event listeners
  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (keysPressed.hasOwnProperty(key)) {
      keysPressed[key] = true;
      event.preventDefault(); // Prevent default behavior (like scrolling)
    }
  });

  window.addEventListener('keyup', (event) => {
    const key = event.key.toLowerCase();
    if (keysPressed.hasOwnProperty(key)) {
      keysPressed[key] = false;
      event.preventDefault(); // Prevent default behavior
    }
  });

  // Initialize the game loop
  requestAnimationFrame(gameLoop);
});

// Function to Display Control Instructions
function displayControlInstructions() {
  const instructions = document.getElementById('control-instructions');

  if (hasKeyboard()) {
    instructions.textContent = "Use WASD keys to move your turtle.";
    instructions.style.display = 'block';
  } else {
    instructions.textContent = "Tilt your device to move your turtle.";
    instructions.style.display = 'block';
  }
}

// Function to Detect if the Device Has a Keyboard (Desktop)
function hasKeyboard() {
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

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

        // Listen for Player 2 joining
        listenForPlayer2();

        // Listen for score and timer updates
        listenForScoreAndTimer();
      });
    }
  }).catch((error) => {
    console.error(error);
  });
}

// Function to Listen for Player 2 Joining
function listenForPlayer2() {
  const player2Ref = ref(db, `games/${gamePassword}/player2`);
  onValue(player2Ref, (snapshot) => {
    const data = snapshot.val();
    if (data && playerId === 'player1' && !gameStarted) {
      // Player 2 has joined
      waitingMessage.textContent = "Player 2 has joined! Click 'Start Game' to begin.";
      // Show the Start Game button
      startButton.parentElement.style.display = 'block';

      // Initialize Player 2's Position
      initializePlayerPosition('player2');
    }
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

        // Listen for game start
        listenForGameStart();

        // Listen for score and timer updates
        listenForScoreAndTimer();
      }
    }
  }).catch((error) => {
    console.error(error);
  });
}

// Function to Listen for Game Start (Player 2 Side)
function listenForGameStart() {
  const startedRef = ref(db, `games/${gamePassword}/started`);
  onValue(startedRef, (snapshot) => {
    const started = snapshot.val();
    if (started && playerId === 'player2') {
      // Game has started
      waitingMessage.style.display = 'none';
      scoreDisplay.style.display = 'block';
      timerDisplay.style.display = 'block';
      disconnectButtonContainer.style.display = 'block';
      gameStarted = true;

      // Start listening for player movements
      listenForPlayerMovements();
    }
  });
}

// Function to Listen for Score and Timer Updates
function listenForScoreAndTimer() {
  const scoreRef = ref(db, `games/${gamePassword}/score`);
  const timerRef = ref(db, `games/${gamePassword}/timer`);

  // Listen for score updates
  onValue(scoreRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      player1Falls = data.player1;
      player2Falls = data.player2;
      updateScoreUI();
    }
  });

  // Listen for timer updates
  onValue(timerRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      const timeLeft = data.timer;
      updateTimerUI(timeLeft);
    }
  });
}

// Function to Update Score UI
function updateScoreUI() {
  scoreDisplay.textContent = `Score - Player 1: ${player1Falls} | Player 2: ${player2Falls}`;
}

// Function to Update Timer UI
function updateTimerUI(timeLeft) {
  timerDisplay.textContent = `Time Left: ${formatTime(timeLeft)}`;
}

// Function to Listen for Player Movements
function listenForPlayerMovements() {
  const player1Ref = ref(db, `games/${gamePassword}/player1`);
  const player2Ref = ref(db, `games/${gamePassword}/player2`);

  // Listen for Player 1's movements
  onValue(player1Ref, (snapshot) => {
    const data = snapshot.val();
    if (data && playerId !== 'player1') { // Ensure not to update own position
      const player1Element = document.getElementById('player1');
      player1Element.style.left = `${data.x}px`;
      player1Element.style.top = `${data.y}px`;
    }
  });

  // Listen for Player 2's movements
  onValue(player2Ref, (snapshot) => {
    const data = snapshot.val();
    if (data && playerId !== 'player2') { // Ensure not to update own position
      const player2Element = document.getElementById('player2');
      player2Element.style.left = `${data.x}px`;
      player2Element.style.top = `${data.y}px`;
    }
  });
}

// Function to Initialize Player Position on the Island
function initializePlayerPosition(player) {
  const island = document.getElementById('island');
  const game = document.getElementById('game');

  // Calculate the island's center relative to the game container
  const gameRect = game.getBoundingClientRect();
  const islandRect = island.getBoundingClientRect();

  const islandCenterX = (gameRect.width / 2) - (islandRect.width / 2);
  const islandCenterY = (gameRect.height / 2) - (islandRect.height / 2);

  // Define predefined positions relative to the island's center
  const offsetDistance = 80; // Increased distance for better spacing
  let initialX, initialY;

  if (player === 'player1') {
    initialX = islandCenterX - offsetDistance; // Position Player 1 to the left
    initialY = islandCenterY;
  } else if (player === 'player2') {
    initialX = islandCenterX + offsetDistance; // Position Player 2 to the right
    initialY = islandCenterY;
  }

  // Ensure positions are numerical and not NaN
  initialX = isNaN(initialX) ? (gameRect.width / 2 - offsetDistance) : initialX;
  initialY = isNaN(initialY) ? (gameRect.height / 2) : initialY;

  const playerElement = document.getElementById(player);
  playerElement.style.left = `${initialX}px`;
  playerElement.style.top = `${initialY}px`;

  // Update Firebase with initial position
  update(ref(db, `games/${gamePassword}/${player}`), {
    x: initialX,
    y: initialY
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
  passwordContainer.style.display = 'none';
  joinContainer.style.display = 'none';
  waitingMessage.style.display = 'block';
}

// Function to Start the Game
function startGame() {
  if (playerId !== 'player1') {
    alert("Only the host can start the game.");
    return;
  }

  // Retrieve player positions
  const player1Element = document.getElementById('player1');
  const player2Element = document.getElementById('player2');

  const p1x = parseFloat(player1Element.style.left);
  const p1y = parseFloat(player1Element.style.top);
  const p2x = parseFloat(player2Element.style.left);
  const p2y = parseFloat(player2Element.style.top);

  // Validate positions
  if (isNaN(p1x) || isNaN(p1y) || isNaN(p2x) || isNaN(p2y)) {
    alert("Invalid player positions. Please ensure both players are positioned correctly.");
    return;
  }

  // Update game state to started
  set(gameRef, {
    player1: {
      x: p1x,
      y: p1y,
      ready: true
    },
    player2: {
      x: p2x,
      y: p2y,
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
    startButton.parentElement.style.display = 'none';
    waitingMessage.style.display = 'none';
    scoreDisplay.style.display = 'block';
    timerDisplay.style.display = 'block';
    disconnectButtonContainer.style.display = 'block';
    // Start the timer
    startTimer();
    gameStarted = true;

    // Start listening for player movements
    listenForPlayerMovements();
  }).catch((error) => {
    console.error(error);
  });
}

// Function to Start the Timer
function startTimer(initialTime = 120) {
  let timeLeft = initialTime;
  timerDisplay.textContent = `Time Left: ${formatTime(timeLeft)}`;

  // Update Firebase timer initially
  update(ref(db, `games/${gamePassword}/timer`), {
    timer: timeLeft
  });

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

    // Show main menu again
    mainMenu.style.display = 'block';
    waitingMessage.style.display = 'none';
    gameTitle.textContent = "Turtle Tumble";
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
  // Further reduced accelerationFactor for even less sensitivity
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

  // Update velocity from gyroscope
  velocity[playerId].x += accelX;
  velocity[playerId].y += accelY;

  // Apply friction
  velocity[playerId].x *= friction;
  velocity[playerId].y *= friction;

  // Update position with reduced multiplier for slower movement
  let playerElement = document.getElementById(playerId);
  let currentX = parseFloat(playerElement.style.left);
  let currentY = parseFloat(playerElement.style.top);

  let newX = currentX + velocity[playerId].x * 25; // Reduced from 30
  let newY = currentY + velocity[playerId].y * 25; // Reduced from 30

  // Boundary checks relative to the game container
  const gameRect = document.getElementById('game').getBoundingClientRect();
  newX = Math.max(0, Math.min(newX, gameRect.width - playerElement.offsetWidth));
  newY = Math.max(0, Math.min(newY, gameRect.height - playerElement.offsetHeight));

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

// Function to Handle Keyboard Input and Update Velocity
function handleKeyboardControls() {
  if (!gameStarted || !playerId) return;

  // Update velocity based on keys pressed
  if (keysPressed.w) {
    velocity[playerId].y -= keyboardSpeed;
  }
  if (keysPressed.s) {
    velocity[playerId].y += keyboardSpeed;
  }
  if (keysPressed.a) {
    velocity[playerId].x -= keyboardSpeed;
  }
  if (keysPressed.d) {
    velocity[playerId].x += keyboardSpeed;
  }

  // Apply friction
  velocity[playerId].x *= friction;
  velocity[playerId].y *= friction;

  // Update position with reduced multiplier for slower movement
  let playerElement = document.getElementById(playerId);
  let currentX = parseFloat(playerElement.style.left);
  let currentY = parseFloat(playerElement.style.top);

  let newX = currentX + velocity[playerId].x * 25; // Reduced from 30
  let newY = currentY + velocity[playerId].y * 25; // Reduced from 30

  // Boundary checks relative to the game container
  const gameRect = document.getElementById('game').getBoundingClientRect();
  newX = Math.max(0, Math.min(newX, gameRect.width - playerElement.offsetWidth));
  newY = Math.max(0, Math.min(newY, gameRect.height - playerElement.offsetHeight));

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
}

// Function to Handle the Game Loop
function gameLoop() {
  if (gameStarted && playerId) {
    handleKeyboardControls();
    // Gyroscope controls are handled via event listeners
  }
  requestAnimationFrame(gameLoop);
}

// Function to Detect Collision Between Players
function detectCollision() {
  const player1 = document.getElementById('player1');
  const player2 = document.getElementById('player2');

  const rect1 = player1.getBoundingClientRect();
  const rect2 = player2.getBoundingClientRect();

  // Calculate the centers of both turtles
  const center1 = {
    x: rect1.left + rect1.width / 2,
    y: rect1.top + rect1.height / 2
  };
  const center2 = {
    x: rect2.left + rect2.width / 2,
    y: rect2.top + rect2.height / 2
  };

  // Calculate the distance between the centers
  const dx = center1.x - center2.x;
  const dy = center1.y - center2.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Calculate the minimum distance to avoid overlap
  const minDistance = (rect1.width + rect2.width) / 2;

  if (distance < minDistance) {
    // Calculate the angle of collision
    const angle = Math.atan2(dy, dx);

    // Calculate overlap
    const overlap = minDistance - distance;

    // Calculate displacement for each turtle
    const displacementX = Math.cos(angle) * (overlap / 2);
    const displacementY = Math.sin(angle) * (overlap / 2);

    // Update positions to resolve overlap
    let newX1 = parseFloat(player1.style.left) + displacementX;
    let newY1 = parseFloat(player1.style.top) + displacementY;
    let newX2 = parseFloat(player2.style.left) - displacementX;
    let newY2 = parseFloat(player2.style.top) - displacementY;

    // Boundary checks relative to the game container
    const gameRect = document.getElementById('game').getBoundingClientRect();
    newX1 = Math.max(0, Math.min(newX1, gameRect.width - player1.offsetWidth));
    newY1 = Math.max(0, Math.min(newY1, gameRect.height - player1.offsetHeight));
    newX2 = Math.max(0, Math.min(newX2, gameRect.width - player2.offsetWidth));
    newY2 = Math.max(0, Math.min(newY2, gameRect.height - player2.offsetHeight));

    // Update positions
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

    // Adjust velocities for a bouncing effect
    const tempVx = velocity.player1.x;
    const tempVy = velocity.player1.y;
    velocity.player1.x = velocity.player2.x * 0.8; // Apply damping factor
    velocity.player1.y = velocity.player2.y * 0.8;
    velocity.player2.x = tempVx * 0.8;
    velocity.player2.y = tempVy * 0.8;
  }
}

// Function to Check if Player is Knocked Off the Island
function isKnockedOff(x, y) {
  const island = document.getElementById('island');
  const game = document.getElementById('game');
  const gameRect = game.getBoundingClientRect();
  const islandRect = island.getBoundingClientRect();

  // Calculate distance from island center
  const islandCenterX = gameRect.width / 2;
  const islandCenterY = gameRect.height / 2;
  const distance = Math.sqrt(Math.pow(x - islandCenterX, 2) + Math.pow(y - islandCenterY, 2));

  // Radius of the island minus half the turtle size to ensure full shell is on the island
  const islandRadius = islandRect.width / 2 - 19; // 38px turtle shell, half is 19px

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
  playerElement.style.transform = 'scale(0.8)'; // Slightly less shrink for better visibility

  // Remove from game for 2 seconds
  setTimeout(() => {
    // Respawn the turtle shell
    playerElement.style.transform = 'scale(1)';

    // Reset position to island center with offset
    const game = document.getElementById('game');
    const gameRect = game.getBoundingClientRect();
    const islandCenterX = gameRect.width / 2;
    const islandCenterY = gameRect.height / 2;

    let newX, newY;
    if (player === 'player1') {
      newX = islandCenterX - 80; // Position Player 1 to the left
      newY = islandCenterY;
    } else {
      newX = islandCenterX + 80; // Position Player 2 to the right
      newY = islandCenterY;
    }

    // Ensure positions are numerical and not NaN
    newX = isNaN(newX) ? (gameRect.width / 2 - 80) : newX;
    newY = isNaN(newY) ? (gameRect.height / 2) : newY;

    playerElement.style.left = `${newX}px`;
    playerElement.style.top = `${newY}px`;

    // Update Firebase with respawned position
    update(ref(db, `games/${gamePassword}/${player}`), {
      x: newX,
      y: newY
    });
  }, 2000); // 2 seconds delay
}
