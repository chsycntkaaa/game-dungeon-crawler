/**
 * 2D Dungeon Crawler RPG Engine
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const TILE_SIZE = 32; // Ukuran setiap tile grid (pixel)
const MAP_SIZE = 15;  // Ukuran grid peta (15x15)

// --- WEB AUDIO API (SYNTH SOUND GENERATOR) ---
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function initAudio() {
  if (!audioCtx) audioCtx = new AudioCtx();
}

function playSound(type) {
  try {
    initAudio();
    if (!audioCtx) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;

    if (type === 'hit') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.linearRampToValueAtTime(40, now + 0.1);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'potion') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.15);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === 'coin') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(987.77, now);
      osc.frequency.setValueAtTime(1318.51, now + 0.08);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === 'stairs') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.linearRampToValueAtTime(600, now + 0.25);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    }
  } catch (e) {
    console.error("Audio Error:", e);
  }
}

// --- GAME STATE ---
const player = {
  x: 1,
  y: 1,
  hp: 100,
  maxHp: 100,
  atk: 15,
  gold: 0,
  floor: 1
};

let map = [];
let enemies = [];
let items = [];
let stairs = { x: 0, y: 0 };

// Tile Types: 0 = Wall, 1 = Floor
function generateMap() {
  map = Array(MAP_SIZE).fill(0).map(() => Array(MAP_SIZE).fill(0));
  
  // Simple Room/Corridor Generator (Primitif Random Walk / Cellular)
  for (let y = 1; y < MAP_SIZE - 1; y++) {
    for (let x = 1; x < MAP_SIZE - 1; x++) {
      if (Math.random() > 0.35) {
        map[y][x] = 1; // Floor
      }
    }
  }

  // Ensure Player Start is Floor
  player.x = 1;
  player.y = 1;
  map[player.y][player.x] = 1;

  // Generate Stairs Down
  do {
    stairs.x = Math.floor(Math.random() * (MAP_SIZE - 2)) + 1;
    stairs.y = Math.floor(Math.random() * (MAP_SIZE - 2)) + 1;
  } while (map[stairs.y][stairs.x] === 0 || (stairs.x === 1 && stairs.y === 1));

  // Generate Enemies & Items
  enemies = [];
  items = [];

  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      if (map[y][x] === 1 && !(x === 1 && y === 1) && !(x === stairs.x && y === stairs.y)) {
        const rand = Math.random();
        if (rand < 0.12) {
          // Enemy
          enemies.push({
            x, y,
            hp: 20 + player.floor * 8,
            maxHp: 20 + player.floor * 8,
            atk: 5 + player.floor * 3,
            name: player.floor > 2 ? 'Orc' : 'Goblin'
          });
        } else if (rand < 0.20) {
          // Potion
          items.push({ x, y, type: 'potion', value: 30 });
        } else if (rand < 0.28) {
          // Gold
          items.push({ x, y, type: 'gold', value: 10 * player.floor });
        }
      }
    }
  }
}

// --- LOGGING ---
function logMessage(msg) {
  const logContainer = document.getElementById('game-log');
  const p = document.createElement('div');
  p.textContent = `> ${msg}`;
  logContainer.prepend(p);
}

// --- UPDATE UI ---
function updateUI() {
  document.getElementById('ui-hp').textContent = player.hp;
  document.getElementById('ui-max-hp').textContent = player.maxHp;
  document.getElementById('ui-atk').textContent = player.atk;
  document.getElementById('ui-gold').textContent = player.gold;
  document.getElementById('ui-floor').textContent = player.floor;
}

// --- PLAYER MOVEMENT & ACTIONS ---
function movePlayer(dx, dy) {
  if (player.hp <= 0) return;

  const newX = player.x + dx;
  const newY = player.y + dy;

  // Check Boundaries & Walls
  if (newX < 0 || newX >= MAP_SIZE || newY < 0 || newY >= MAP_SIZE || map[newY][newX] === 0) {
    return; // Menabrak dinding / luar peta
  }

  // Check Enemy Collision (Combat)
  const enemyIndex = enemies.findIndex(e => e.x === newX && e.y === newY);
  if (enemyIndex !== -1) {
    const enemy = enemies[enemyIndex];
    // Player attacks enemy
    enemy.hp -= player.atk;
    playSound('hit');
    logMessage(`Anda menyerang ${enemy.name} sebesar ${player.atk} damage!`);

    if (enemy.hp <= 0) {
      logMessage(`⚔️ ${enemy.name} berhasil dikalahkan!`);
      enemies.splice(enemyIndex, 1);
      player.gold += 5;
    } else {
      // Enemy counter-attacks
      player.hp -= enemy.atk;
      logMessage(`💥 ${enemy.name} menyerang balik sebesar ${enemy.atk} damage!`);
      playSound('hit');
    }

    checkGameOver();
    updateUI();
    render();
    return;
  }

  // Move Player
  player.x = newX;
  player.y = newY;

  // Check Item Pickup
  const itemIndex = items.findIndex(i => i.x === player.x && i.y === player.y);
  if (itemIndex !== -1) {
    const item = items[itemIndex];
    if (item.type === 'potion') {
      player.hp = Math.min(player.maxHp, player.hp + item.value);
      logMessage(`🧪 Menemukan Potion! HP pulih +${item.value}`);
      playSound('potion');
    } else if (item.type === 'gold') {
      player.gold += item.value;
      logMessage(`💰 Menemukan ${item.value} Gold!`);
      playSound('coin');
    }
    items.splice(itemIndex, 1);
  }

  // Check Stairs (Next Floor)
  if (player.x === stairs.x && player.y === stairs.y) {
    player.floor++;
    player.maxHp += 10;
    player.hp = player.maxHp;
    player.atk += 3;
    logMessage(`🪜 Menuruni tangga ke lantai ${player.floor}! Karakter semakin kuat.`);
    playSound('stairs');
    generateMap();
  }

  updateUI();
  render();
}

function checkGameOver() {
  if (player.hp <= 0) {
    player.hp = 0;
    document.getElementById('overlay-title').textContent = "GAME OVER";
    document.getElementById('overlay-msg').textContent = `Anda bertahan hingga Lantai ${player.floor} dengan ${player.gold} Gold.`;
    document.getElementById('game-overlay').classList.remove('hidden');
    document.getElementById('game-overlay').classList.add('flex');
  }
}

// --- RENDER ENGINE (CANVAS) ---
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw Map
  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      ctx.fillStyle = map[y][x] === 1 ? '#1e293b' : '#090d16';
      ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE - 1, TILE_SIZE - 1);
    }
  }

  // Draw Stairs
  ctx.fillStyle = '#06b6d4';
  ctx.fillRect(stairs.x * TILE_SIZE + 6, stairs.y * TILE_SIZE + 6, TILE_SIZE - 12, TILE_SIZE - 12);

  // Draw Items
  items.forEach(item => {
    ctx.fillStyle = item.type === 'potion' ? '#ef4444' : '#fbbf24';
    ctx.beginPath();
    ctx.arc(item.x * TILE_SIZE + TILE_SIZE / 2, item.y * TILE_SIZE + TILE_SIZE / 2, 8, 0, Math.PI * 2);
    ctx.fill();
  });

  // Draw Enemies
  enemies.forEach(enemy => {
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(enemy.x * TILE_SIZE + TILE_SIZE / 2, enemy.y * TILE_SIZE + TILE_SIZE / 2, 11, 0, Math.PI * 2);
    ctx.fill();
    // Enemy HP bar mini
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(enemy.x * TILE_SIZE + 4, enemy.y * TILE_SIZE + 2, 24, 3);
    ctx.fillStyle = '#10b981';
    ctx.fillRect(enemy.x * TILE_SIZE + 4, enemy.y * TILE_SIZE + 2, (enemy.hp / enemy.maxHp) * 24, 3);
  });

  // Draw Player
  ctx.fillStyle = '#3b82f6';
  ctx.beginPath();
  ctx.arc(player.x * TILE_SIZE + TILE_SIZE / 2, player.y * TILE_SIZE + TILE_SIZE / 2, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
}

// --- EVENT LISTENERS ---
window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') movePlayer(0, -1);
  if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') movePlayer(0, 1);
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') movePlayer(-1, 0);
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') movePlayer(1, 0);
});

document.getElementById('btn-up').onclick = () => movePlayer(0, -1);
document.getElementById('btn-down').onclick = () => movePlayer(0, 1);
document.getElementById('btn-left').onclick = () => movePlayer(-1, 0);
document.getElementById('btn-right').onclick = () => movePlayer(1, 0);

document.getElementById('btn-restart').onclick = () => {
  player.hp = 100;
  player.maxHp = 100;
  player.atk = 15;
  player.gold = 0;
  player.floor = 1;
  document.getElementById('game-overlay').classList.add('hidden');
  document.getElementById('game-overlay').classList.remove('flex');
  generateMap();
  updateUI();
  render();
};

// --- INITIALIZE GAME ---
generateMap();
updateUI();
render();
