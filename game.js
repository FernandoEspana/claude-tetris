'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

// Paleta base (índice 0 = null, alineada 1:1 con PIECES).
const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#64b5f6', // J - pale blue
  '#ffb74d', // L - orange
  '#9e9e9e', // H - hueca (gris)
  '#f06292', // U - rosa
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // H - hueca (3x3 hueco central)
  [[9,0,9],[9,9,9],[0,0,0]],                  // U
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const themeToggle = document.getElementById('theme-toggle');
const skinSelect = document.getElementById('skin-select');

// Overlay
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const recordsEl = document.getElementById('records');
const nameEntry = document.getElementById('name-entry');
const nameInput = document.getElementById('name-input');
const saveScoreBtn = document.getElementById('save-score-btn');
const startLevelWrap = document.getElementById('startlevel-wrap');
const startLevelSelect = document.getElementById('startlevel-select');
const menuControls = document.getElementById('menu-controls');
const startBtn = document.getElementById('start-btn');
const resumeBtn = document.getElementById('resume-btn');
const restartBtn = document.getElementById('restart-btn');
const controlsBtn = document.getElementById('controls-btn');
const resetScoresBtn = document.getElementById('reset-scores-btn');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let combo, maxCombo;      // combo = clears consecutivos; maxCombo = mejor de la partida
let started = false;      // hay partida en curso (loop activo o en pausa)
let pendingScore = null;  // score a la espera de nombre en game over

// ---- Persistencia ----
const THEME_KEY = 'tetris-theme';
const SKIN_KEY = 'tetris-skin';
const STARTLEVEL_KEY = 'tetris-startlevel';
const SCORES_KEY = 'tetris-scores';

let gridColor = '#22222e';
let blockHighlight = 'rgba(255,255,255,0.12)';
let startLevel = 1;

// ===================== TEMA =====================
function updateThemeColors() {
  const style = getComputedStyle(document.body);
  gridColor = style.getPropertyValue('--grid-color').trim();
  blockHighlight = style.getPropertyValue('--block-highlight').trim();
}

function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  themeToggle.checked = theme === 'light';
  localStorage.setItem(THEME_KEY, theme);
  updateThemeColors();
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  applyTheme(saved === 'light' ? 'light' : 'dark');
}

themeToggle.addEventListener('change', () => {
  applyTheme(themeToggle.checked ? 'light' : 'dark');
  if (current) draw();
});

// ===================== SKINS =====================
// Cada skin aporta una paleta (índice de pieza -> color) y una estrategia de
// dibujo de bloque. drawBlock() delega en la skin activa.
const PASTEL = [
  null, '#a5e8ef', '#ffe9a8', '#e3c2ee', '#bfe3c2',
  '#f4bcbc', '#bcd6f4', '#ffdcb0', '#d0d0d8', '#f8c6da',
];

function roundRectPath(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

function drawRetro(context, x, y, color, size, alpha) {
  context.globalAlpha = alpha;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  context.fillStyle = blockHighlight;
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawNeon(context, x, y, color, size, alpha) {
  context.globalAlpha = alpha;
  context.save();
  context.shadowColor = color;
  context.shadowBlur = 14;
  context.fillStyle = color;
  context.fillRect(x * size + 3, y * size + 3, size - 6, size - 6);
  context.restore();
  // núcleo brillante
  context.globalAlpha = alpha * 0.9;
  context.fillStyle = 'rgba(255,255,255,0.85)';
  context.fillRect(x * size + size / 2 - 2, y * size + size / 2 - 2, 4, 4);
  context.globalAlpha = 1;
}

function drawPastel(context, x, y, color, size, alpha) {
  context.globalAlpha = alpha;
  context.fillStyle = color;
  roundRectPath(context, x * size + 2, y * size + 2, size - 4, size - 4, 7);
  context.fill();
  context.fillStyle = 'rgba(255,255,255,0.35)';
  roundRectPath(context, x * size + 4, y * size + 4, size - 8, (size - 8) / 2, 5);
  context.fill();
  context.globalAlpha = 1;
}

function drawPixel(context, x, y, color, size, alpha) {
  context.globalAlpha = alpha;
  const px = x * size, py = y * size;
  context.fillStyle = color;
  context.fillRect(px + 1, py + 1, size - 2, size - 2);
  // textura: retícula de píxeles claros/oscuros
  const cell = (size - 2) / 5;
  context.fillStyle = 'rgba(255,255,255,0.22)';
  for (let i = 0; i < 5; i++) context.fillRect(px + 1 + i * cell, py + 1, cell, cell);
  context.fillStyle = 'rgba(0,0,0,0.28)';
  for (let i = 0; i < 5; i++) context.fillRect(px + 1 + i * cell, py + 1 + 4 * cell, cell, cell);
  context.fillStyle = 'rgba(0,0,0,0.18)';
  context.fillRect(px + 1 + 4 * cell, py + 1, cell, size - 2);
  context.globalAlpha = 1;
}

const SKINS = {
  retro:  { palette: COLORS, draw: drawRetro },
  neon:   { palette: COLORS, draw: drawNeon },
  pastel: { palette: PASTEL, draw: drawPastel },
  pixel:  { palette: COLORS, draw: drawPixel },
};
let currentSkin = 'retro';

function applySkin(skin) {
  if (!SKINS[skin]) skin = 'retro';
  currentSkin = skin;
  document.body.setAttribute('data-skin', skin);
  skinSelect.value = skin;
  localStorage.setItem(SKIN_KEY, skin);
  updateThemeColors();
  if (board) draw();
  if (next) drawNext();
}

function initSkin() {
  applySkin(localStorage.getItem(SKIN_KEY) || 'retro');
}

skinSelect.addEventListener('change', () => applySkin(skinSelect.value));

// ===================== RECORDS =====================
function loadScores() {
  try {
    const data = JSON.parse(localStorage.getItem(SCORES_KEY));
    if (data && Array.isArray(data.top)) {
      return { top: data.top, bestCombo: data.bestCombo || 0, bestLines: data.bestLines || 0 };
    }
  } catch (_) { /* datos corruptos -> default */ }
  return { top: [], bestCombo: 0, bestLines: 0 };
}

function saveScores(data) {
  localStorage.setItem(SCORES_KEY, JSON.stringify(data));
}

function qualifiesForTop(sc) {
  const { top } = loadScores();
  return sc > 0 && (top.length < 5 || sc > top[top.length - 1].score);
}

// Inserta y devuelve el índice de la nueva fila (o -1).
function insertScore(name, sc) {
  const data = loadScores();
  const entry = { name: (name || '---').toUpperCase().slice(0, 8), score: sc };
  data.top.push(entry);
  data.top.sort((a, b) => b.score - a.score);
  data.top = data.top.slice(0, 5);
  saveScores(data);
  return data.top.indexOf(entry);
}

function updateBests(finalCombo, finalLines) {
  const data = loadScores();
  data.bestCombo = Math.max(data.bestCombo, finalCombo);
  data.bestLines = Math.max(data.bestLines, finalLines);
  saveScores(data);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

function renderRecords(highlightIdx = -1) {
  const data = loadScores();
  let rows = '';
  for (let i = 0; i < 5; i++) {
    const e = data.top[i];
    const cls = i === highlightIdx ? ' class="hl"' : '';
    const name = e ? escapeHtml(e.name) : '—';
    const sc = e ? e.score.toLocaleString() : '—';
    rows += `<tr${cls}><td>${i + 1}</td><td>${name}</td><td>${sc}</td></tr>`;
  }
  recordsEl.innerHTML =
    `<table class="records-table"><thead><tr><th>#</th><th>NOMBRE</th><th>SCORE</th></tr></thead>` +
    `<tbody>${rows}</tbody></table>` +
    `<p class="records-extra">Mejor combo: <b>${data.bestCombo}</b> · Líneas máx: <b>${data.bestLines}</b></p>`;
}

resetScoresBtn.addEventListener('click', () => {
  localStorage.removeItem(SCORES_KEY);
  renderRecords();
});

saveScoreBtn.addEventListener('click', () => {
  if (pendingScore == null) return;
  const idx = insertScore(nameInput.value, pendingScore);
  pendingScore = null;
  nameEntry.classList.add('hidden');
  renderRecords(idx);
});

// ===================== NIVEL INICIAL =====================
function populateStartLevel() {
  for (let i = 1; i <= 10; i++) {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = String(i);
    startLevelSelect.appendChild(opt);
  }
}

function initStartLevel() {
  const saved = parseInt(localStorage.getItem(STARTLEVEL_KEY), 10);
  startLevel = (saved >= 1 && saved <= 10) ? saved : 1;
  startLevelSelect.value = String(startLevel);
}

startLevelSelect.addEventListener('change', () => {
  startLevel = parseInt(startLevelSelect.value, 10) || 1;
  localStorage.setItem(STARTLEVEL_KEY, String(startLevel));
});

// ===================== OVERLAY (modos) =====================
// Modos: 'start' | 'pause' | 'gameover' | null (oculto).
function showOverlay(mode) {
  overlay.setAttribute('data-mode', mode);
  overlay.classList.remove('hidden');
  document.querySelectorAll('.mode-el').forEach(el => {
    // visible si su lista de clases m-<mode> incluye el modo actual
    const show = el.classList.contains('m-' + mode);
    // name-entry y menu-controls se gestionan aparte
    if (el === nameEntry || el === menuControls) return;
    el.classList.toggle('hidden', !show);
  });
  menuControls.classList.add('hidden');
  if (mode !== 'gameover') nameEntry.classList.add('hidden');
}

function hideOverlay() {
  overlay.classList.add('hidden');
}

// ===================== JUEGO =====================
function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 9) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

// Devuelve nº de líneas eliminadas.
function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + startLevel;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
  return cleared;
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  const cleared = clearLines();
  if (cleared > 0) {
    combo++;
    maxCombo = Math.max(maxCombo, combo);
  } else {
    combo = 0;
  }
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
    return;
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const skin = SKINS[currentSkin];
  skin.draw(context, x, y, skin.palette[colorIndex], size, alpha ?? 1);
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  if (!current) return;

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  started = false;
  cancelAnimationFrame(animId);

  updateBests(maxCombo, lines);

  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()} · Combo máx: ${maxCombo}`;

  if (qualifiesForTop(score)) {
    pendingScore = score;
    nameInput.value = '';
    nameEntry.classList.remove('hidden');
  } else {
    pendingScore = null;
    nameEntry.classList.add('hidden');
  }
  showOverlay('gameover');
  renderRecords();
  if (pendingScore != null) nameInput.focus();
}

function togglePause() {
  if (gameOver || !started) return;
  paused = !paused;
  if (!paused) {
    hideOverlay();
    lastTime = performance.now();
    animId = requestAnimationFrame(loop);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    startLevelSelect.value = String(startLevel);
    showOverlay('pause');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  if (started && !paused && !gameOver) animId = requestAnimationFrame(loop);
}

function startGame() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = startLevel;
  combo = 0;
  maxCombo = 0;
  paused = false;
  gameOver = false;
  started = true;
  pendingScore = null;
  nameEntry.classList.add('hidden');
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  hideOverlay();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

function showStartScreen() {
  overlayTitle.textContent = 'TETRIS';
  startLevelSelect.value = String(startLevel);
  showOverlay('start');
  renderRecords();
  draw(); // pinta tablero/grid vacío de fondo
}

// ===================== EVENTOS =====================
document.addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (started) { e.preventDefault(); togglePause(); }
    return;
  }
  if (!started || paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

startBtn.addEventListener('click', startGame);
resumeBtn.addEventListener('click', () => togglePause());
restartBtn.addEventListener('click', startGame);
controlsBtn.addEventListener('click', () => menuControls.classList.toggle('hidden'));

// ===================== ARRANQUE =====================
initTheme();
initSkin();
populateStartLevel();
initStartLevel();
board = createBoard();
showStartScreen();
