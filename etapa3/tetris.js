// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const COLS = 10;
const ROWS = 20;
const CELL = 30; // px per cell

const COLORS = {
  I: '#00cfcf',
  O: '#f0c040',
  T: '#a040a0',
  S: '#40c040',
  Z: '#e04040',
  J: '#4040e0',
  L: '#e08020',
};

const PIECES = {
  I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
  O: [[1,1],[1,1]],
  T: [[0,1,0],[1,1,1],[0,0,0]],
  S: [[0,1,1],[1,1,0],[0,0,0]],
  Z: [[1,1,0],[0,1,1],[0,0,0]],
  J: [[1,0,0],[1,1,1],[0,0,0]],
  L: [[0,0,1],[1,1,1],[0,0,0]],
};

const PIECE_NAMES = Object.keys(PIECES);

const LINE_POINTS = [0, 100, 300, 500, 800];

const LEVEL_SPEEDS = [800, 680, 560, 450, 350, 260, 190, 130, 90, 65, 50, 40, 30];

const LEVEL_UP_DURATION = 1400;

// ms to display the game-over screen before returning to the title screen
const GAME_OVER_REDIRECT_DELAY = 3000;

// ms idle on title screen before attract mode starts
const ATTRACT_DELAY = 10000;

// ms between AI input steps in attract mode
const AI_MOVE_INTERVAL = 100;

// ─────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────

function randomPieceName() {
  return PIECE_NAMES[Math.floor(Math.random() * PIECE_NAMES.length)];
}

function cloneMatrix(matrix) {
  return matrix.map(row => [...row]);
}

function rotateMatrix(matrix) {
  const size = matrix.length;
  const result = Array.from({ length: size }, () => Array(size).fill(0));
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      result[c][size - 1 - r] = matrix[r][c];
    }
  }
  return result;
}

// ─────────────────────────────────────────────
// High score persistence
// ─────────────────────────────────────────────

function loadHighScore() {
  return parseInt(localStorage.getItem('tetrisHighScore') || '0', 10);
}

function saveHighScore(score) {
  localStorage.setItem('tetrisHighScore', String(score));
}

// ─────────────────────────────────────────────
// Board
// ─────────────────────────────────────────────

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function isValidPosition(board, matrix, originRow, originCol) {
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (!matrix[r][c]) continue;
      const boardRow = originRow + r;
      const boardCol = originCol + c;
      if (boardRow >= ROWS) return false;
      if (boardCol < 0 || boardCol >= COLS) return false;
      if (boardRow >= 0 && board[boardRow][boardCol]) return false;
    }
  }
  return true;
}

function lockPiece(board, matrix, originRow, originCol, color) {
  const newBoard = board.map(row => [...row]);
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (!matrix[r][c]) continue;
      const br = originRow + r;
      const bc = originCol + c;
      if (br >= 0) newBoard[br][bc] = color;
    }
  }

  let linesCleared = 0;
  const clearedBoard = newBoard.filter(row => row.some(cell => !cell));
  linesCleared = ROWS - clearedBoard.length;
  while (clearedBoard.length < ROWS) {
    clearedBoard.unshift(Array(COLS).fill(null));
  }

  return { newBoard: clearedBoard, linesCleared };
}

// ─────────────────────────────────────────────
// Piece factory
// ─────────────────────────────────────────────

function createPiece(name) {
  return {
    name,
    color: COLORS[name],
    matrix: cloneMatrix(PIECES[name]),
    row: -2,
    col: Math.floor((COLS - PIECES[name][0].length) / 2),
  };
}

// ─────────────────────────────────────────────
// Ghost piece
// ─────────────────────────────────────────────

function ghostRow(board, piece) {
  let r = piece.row;
  while (isValidPosition(board, piece.matrix, r + 1, piece.col)) r++;
  return r;
}

// ─────────────────────────────────────────────
// Attract mode AI
// ─────────────────────────────────────────────

// Returns all unique rotation states of a piece starting from its current rotation.
function aiGetRotations(piece) {
  const rotations = [];
  let matrix = cloneMatrix(piece.matrix);
  for (let i = 0; i < 4; i++) {
    const key = JSON.stringify(matrix);
    if (rotations.some(r => JSON.stringify(r) === key)) break;
    rotations.push(cloneMatrix(matrix));
    matrix = rotateMatrix(matrix);
  }
  return rotations;
}

// Scores a board state using the classic Dellacherie heuristic.
function aiEvaluateBoard(board) {
  const heights = Array(COLS).fill(0);
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      if (board[r][c]) { heights[c] = ROWS - r; break; }
    }
  }

  const aggregateHeight = heights.reduce((a, b) => a + b, 0);

  let linesCleared = 0;
  for (let r = 0; r < ROWS; r++) {
    if (board[r].every(cell => cell !== null)) linesCleared++;
  }

  let holes = 0;
  for (let c = 0; c < COLS; c++) {
    let blocked = false;
    for (let r = 0; r < ROWS; r++) {
      if (board[r][c]) blocked = true;
      else if (blocked) holes++;
    }
  }

  let bumpiness = 0;
  for (let c = 0; c < COLS - 1; c++) {
    bumpiness += Math.abs(heights[c] - heights[c + 1]);
  }

  return -0.510066 * aggregateHeight
       + 0.760666 * linesCleared
       - 0.356630 * holes
       - 0.184483 * bumpiness;
}

// Finds the best (col, rotation) for the current piece using brute-force evaluation.
function aiFindBestMove(board, piece) {
  let bestScore = -Infinity;
  let bestCol = piece.col;
  let bestMatrix = cloneMatrix(piece.matrix);

  for (const matrix of aiGetRotations(piece)) {
    for (let col = -1; col < COLS + 1; col++) {
      if (!isValidPosition(board, matrix, piece.row, col)) continue;
      let row = piece.row;
      while (isValidPosition(board, matrix, row + 1, col)) row++;
      const { newBoard } = lockPiece(board, matrix, row, col, piece.color);
      const score = aiEvaluateBoard(newBoard);
      if (score > bestScore) {
        bestScore = score;
        bestCol = col;
        bestMatrix = cloneMatrix(matrix);
      }
    }
  }

  return { col: bestCol, matrix: bestMatrix };
}

// Applies one AI input step: rotate if needed, then move horizontally.
function aiStep(s) {
  if (!s.aiTarget) {
    s.aiTarget = aiFindBestMove(s.board, s.current);
  }
  const { col: targetCol, matrix: targetMatrix } = s.aiTarget;

  if (JSON.stringify(s.current.matrix) !== JSON.stringify(targetMatrix)) {
    tryRotate(s);
  } else if (s.current.col < targetCol) {
    tryMove(s, 0, 1);
  } else if (s.current.col > targetCol) {
    tryMove(s, 0, -1);
  }
}

// ─────────────────────────────────────────────
// Rendering
// ─────────────────────────────────────────────

const boardCanvas = document.getElementById('board');
const boardCtx = boardCanvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const nextCtx = nextCanvas.getContext('2d');
const levelEl = document.getElementById('level');

function drawCell(ctx, x, y, color, size = CELL, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(x + 1, y + 1, size - 2, 4);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x + 1, y + size - 5, size - 2, 4);
  ctx.globalAlpha = 1;
}

function drawGrid(ctx, board) {
  ctx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      ctx.strokeRect(c * CELL, r * CELL, CELL, CELL);
    }
  }
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c]) drawCell(ctx, c * CELL, r * CELL, board[r][c]);
    }
  }
}

function drawPiece(ctx, piece, originRow, alpha = 1) {
  piece.matrix.forEach((row, r) => {
    row.forEach((val, c) => {
      if (!val) return;
      const x = (piece.col + c) * CELL;
      const y = (originRow + r) * CELL;
      if (y >= 0) drawCell(ctx, x, y, piece.color, CELL, alpha);
    });
  });
}

function drawNextPiece(piece) {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const size = 24;
  const offsetX = (nextCanvas.width - piece.matrix[0].length * size) / 2;
  const offsetY = (nextCanvas.height - piece.matrix.length * size) / 2;
  piece.matrix.forEach((row, r) => {
    row.forEach((val, c) => {
      if (!val) return;
      const x = offsetX + c * size;
      const y = offsetY + r * size;
      nextCtx.fillStyle = piece.color;
      nextCtx.fillRect(x + 1, y + 1, size - 2, size - 2);
      nextCtx.fillStyle = 'rgba(255,255,255,0.15)';
      nextCtx.fillRect(x + 1, y + 1, size - 2, 3);
    });
  });
}

function drawLevelUpBanner(timer) {
  if (timer <= 0) return;
  const alpha = Math.min(1, timer / 400);
  boardCtx.save();
  boardCtx.globalAlpha = alpha;
  boardCtx.font = 'bold 34px "Courier New"';
  boardCtx.textAlign = 'center';
  boardCtx.textBaseline = 'middle';
  boardCtx.fillStyle = '#000';
  boardCtx.fillText('NÍVEL UP!', boardCanvas.width / 2 + 2, boardCanvas.height / 2 + 2);
  boardCtx.fillStyle = '#f0c040';
  boardCtx.fillText('NÍVEL UP!', boardCanvas.width / 2, boardCanvas.height / 2);
  boardCtx.restore();
}

// Draws the title / waiting screen directly on the board canvas.
function drawTitleScreen(state) {
  const ctx = boardCtx;
  const w = boardCanvas.width;
  const h = boardCanvas.height;

  // Background + grid
  ctx.fillStyle = '#0d0d1a';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      ctx.strokeRect(c * CELL, r * CELL, CELL, CELL);
    }
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Large title with drop shadow
  ctx.font = 'bold 54px "Courier New"';
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillText('TETRIS', w / 2 + 3, h * 0.20 + 3);
  ctx.fillStyle = '#e94560';
  ctx.fillText('TETRIS', w / 2, h * 0.20);

  // Best score (gold, only when non-zero)
  if (state.highScore > 0) {
    ctx.font = '13px "Courier New"';
    ctx.fillStyle = '#f0c040';
    ctx.fillText('RECORDE: ' + state.highScore, w / 2, h * 0.34);
  }

  // Controls reference
  ctx.font = '12px "Courier New"';
  ctx.fillStyle = '#888';
  const lines = ['← →  Mover', ' ↑   Rotacionar', ' ↓   Descer', 'Espaço  Queda', ' P   Pausar'];
  lines.forEach((line, i) => ctx.fillText(line, w / 2, h * 0.46 + i * 22));

  // Blinking "press any key" prompt
  if (Math.floor(Date.now() / 500) % 2 === 0) {
    ctx.font = 'bold 13px "Courier New"';
    ctx.fillStyle = '#eee';
    ctx.fillText('PRESSIONE QUALQUER TECLA', w / 2, h * 0.79);
    ctx.fillText('PARA INICIAR', w / 2, h * 0.84);
  }

  // Attract-mode countdown bar at the bottom edge
  const pct = state.attractTimer / ATTRACT_DELAY;
  ctx.fillStyle = '#0f3460';
  ctx.fillRect(20, h - 16, w - 40, 5);
  ctx.fillStyle = '#e94560';
  ctx.fillRect(20, h - 16, (w - 40) * pct, 5);

  // Clear next-piece canvas so it doesn't show stale data
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
}

// Draws the attract-mode banner over the active game canvas.
function drawAttractOverlay() {
  const ctx = boardCtx;
  const w = boardCanvas.width;

  ctx.fillStyle = 'rgba(10,10,20,0.82)';
  ctx.fillRect(0, 0, w, 46);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 15px "Courier New"';
  ctx.fillStyle = '#f0c040';
  ctx.fillText('MODO DEMONSTRAÇÃO', w / 2, 15);

  ctx.font = '11px "Courier New"';
  ctx.fillStyle = '#aaa';
  ctx.fillText('Pressione qualquer tecla para jogar', w / 2, 33);
}

function render(state) {
  drawGrid(boardCtx, state.board);

  const gRow = ghostRow(state.board, state.current);
  if (gRow !== state.current.row) {
    drawPiece(boardCtx, state.current, gRow, 0.2);
  }
  drawPiece(boardCtx, state.current, state.current.row);

  drawNextPiece(state.next);
  drawLevelUpBanner(state.levelUpTimer);

  document.getElementById('score').textContent = state.score;
  document.getElementById('high-score').textContent = state.highScore;
  document.getElementById('level').textContent = state.level;
  document.getElementById('lines').textContent = state.totalLines;
}

// ─────────────────────────────────────────────
// Game state
// ─────────────────────────────────────────────

function initialState() {
  return {
    board: createBoard(),
    current: createPiece(randomPieceName()),
    next: createPiece(randomPieceName()),
    score: 0,
    highScore: loadHighScore(),
    level: 1,
    totalLines: 0,
    paused: false,
    over: false,
    levelUpTimer: 0,
    phase: 'title',        // 'title' | 'playing' | 'attract'
    attractTimer: 0,       // ms elapsed on the title screen
    aiTarget: null,        // { col, matrix } set once per piece in attract mode
    aiMoveAccumulator: 0,  // ms since last AI step
  };
}

let state = initialState();
let lastTime = 0;
let dropAccumulator = 0;
let animationId = null;
let gameOverTimeoutId = null;

function dropInterval(level) {
  return LEVEL_SPEEDS[Math.min(level - 1, LEVEL_SPEEDS.length - 1)];
}

// ─────────────────────────────────────────────
// Actions — pure state transformers
// ─────────────────────────────────────────────

function tryMove(s, dRow, dCol) {
  if (isValidPosition(s.board, s.current.matrix, s.current.row + dRow, s.current.col + dCol)) {
    s.current.row += dRow;
    s.current.col += dCol;
    return true;
  }
  return false;
}

function tryRotate(s) {
  const rotated = rotateMatrix(s.current.matrix);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (isValidPosition(s.board, rotated, s.current.row, s.current.col + kick)) {
      s.current.matrix = rotated;
      s.current.col += kick;
      return;
    }
  }
}

function hardDrop(s) {
  const gr = ghostRow(s.board, s.current);
  const dropped = gr - s.current.row;
  s.current.row = gr;
  s.score += dropped * 2;
  lockCurrent(s);
}

function lockCurrent(s) {
  const { newBoard, linesCleared } = lockPiece(
    s.board, s.current.matrix, s.current.row, s.current.col, s.current.color
  );
  s.board = newBoard;
  s.score += LINE_POINTS[linesCleared] * s.level;
  s.totalLines += linesCleared;

  const oldLevel = s.level;
  s.level = Math.floor(s.totalLines / 10) + 1;

  if (s.level > oldLevel) {
    s.levelUpTimer = LEVEL_UP_DURATION;
    triggerLevelFlash();
  }

  if (s.score > s.highScore) {
    s.highScore = s.score;
    saveHighScore(s.highScore);
  }

  if (newBoard[0].some(cell => cell !== null)) {
    s.over = true;
    return;
  }

  s.current = s.next;
  s.next = createPiece(randomPieceName());
  s.aiTarget = null; // reset so AI recalculates for the new piece

  if (!isValidPosition(s.board, s.current.matrix, s.current.row, s.current.col)) {
    s.over = true;
  }
}

function triggerLevelFlash() {
  levelEl.classList.remove('flash');
  void levelEl.offsetWidth;
  levelEl.classList.add('flash');
}

// ─────────────────────────────────────────────
// Game loop
// ─────────────────────────────────────────────

function gameLoop(timestamp) {
  // Cap delta to avoid spiral-of-death after tab suspension
  const delta = Math.min(timestamp - lastTime, 100);
  lastTime = timestamp;

  // ── Title screen ──
  if (state.phase === 'title') {
    state.attractTimer += delta;
    if (state.attractTimer >= ATTRACT_DELAY) {
      startAttract();
    } else {
      drawTitleScreen(state);
      animationId = requestAnimationFrame(gameLoop);
    }
    return;
  }

  // ── Attract mode ──
  if (state.phase === 'attract') {
    if (state.over) {
      startAttract();
      return;
    }

    state.aiMoveAccumulator += delta;
    if (state.aiMoveAccumulator >= AI_MOVE_INTERVAL) {
      state.aiMoveAccumulator = 0;
      aiStep(state);
    }

    dropAccumulator += delta;
    if (dropAccumulator >= dropInterval(state.level)) {
      dropAccumulator = 0;
      if (!tryMove(state, 1, 0)) lockCurrent(state);
    }

    if (state.levelUpTimer > 0) {
      state.levelUpTimer = Math.max(0, state.levelUpTimer - delta);
    }

    render(state);
    drawAttractOverlay();
    animationId = requestAnimationFrame(gameLoop);
    return;
  }

  // ── Playing ──
  if (!state.paused && !state.over) {
    dropAccumulator += delta;
    if (dropAccumulator >= dropInterval(state.level)) {
      dropAccumulator = 0;
      if (!tryMove(state, 1, 0)) lockCurrent(state);
    }

    if (state.levelUpTimer > 0) {
      state.levelUpTimer = Math.max(0, state.levelUpTimer - delta);
    }

    render(state);
  }

  if (state.over) {
    showGameOver();
    return;
  }

  animationId = requestAnimationFrame(gameLoop);
}

// ─────────────────────────────────────────────
// Overlay helpers
// ─────────────────────────────────────────────

const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlaySub = document.getElementById('overlay-sub');
const overlayRecord = document.getElementById('overlay-record');

function showOverlay(title, sub, record = '') {
  overlayTitle.textContent = title;
  overlaySub.textContent = sub;
  if (record) {
    overlayRecord.textContent = record;
    overlayRecord.classList.remove('hidden');
  } else {
    overlayRecord.classList.add('hidden');
  }
  overlay.classList.remove('hidden');
}

function hideOverlay() {
  overlay.classList.add('hidden');
  overlayRecord.classList.add('hidden');
}

function clearGameOverTimeout() {
  if (gameOverTimeoutId !== null) {
    clearTimeout(gameOverTimeoutId);
    gameOverTimeoutId = null;
  }
}

function showGameOver() {
  const isNewRecord = state.score >= state.highScore && state.score > 0;
  const recordText = isNewRecord
    ? `★ NOVO RECORDE: ${state.highScore} ★`
    : `Recorde: ${state.highScore}`;
  showOverlay('GAME OVER', 'Voltando à tela inicial...', recordText);
  clearGameOverTimeout();
  gameOverTimeoutId = setTimeout(() => {
    gameOverTimeoutId = null;
    backToTitle();
  }, GAME_OVER_REDIRECT_DELAY);
}

// ─────────────────────────────────────────────
// Input handling
// ─────────────────────────────────────────────

document.addEventListener('keydown', (e) => {
  if (state.phase === 'title') {
    startGame();
    return;
  }

  if (state.phase === 'attract') {
    backToTitle();
    return;
  }

  // phase === 'playing'
  if (state.over) {
    clearGameOverTimeout();
    backToTitle();
    return;
  }

  switch (e.code) {
    case 'ArrowLeft':
      e.preventDefault();
      tryMove(state, 0, -1);
      break;
    case 'ArrowRight':
      e.preventDefault();
      tryMove(state, 0, 1);
      break;
    case 'ArrowDown':
      e.preventDefault();
      if (tryMove(state, 1, 0)) state.score += 1;
      break;
    case 'ArrowUp':
      e.preventDefault();
      tryRotate(state);
      break;
    case 'Space':
      e.preventDefault();
      hardDrop(state);
      break;
    case 'KeyP':
      togglePause();
      break;
    default:
      return;
  }

  if (!state.paused && !state.over) render(state);
});

// Mouse click or touch also exits title / attract mode
document.addEventListener('click', () => {
  if (state.phase === 'title') startGame();
  else if (state.phase === 'attract') backToTitle();
});

document.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (state.phase === 'title') startGame();
  else if (state.phase === 'attract') backToTitle();
}, { passive: false });

// ─────────────────────────────────────────────
// Phase transitions
// ─────────────────────────────────────────────

function togglePause() {
  if (state.phase !== 'playing' || state.over) return;
  state.paused = !state.paused;
  if (state.paused) {
    showOverlay('PAUSADO', 'Pressione P para continuar');
  } else {
    hideOverlay();
    lastTime = performance.now();
    animationId = requestAnimationFrame(gameLoop);
  }
}

function startGame() {
  const prevHighScore = Math.max(state.highScore, loadHighScore());
  if (animationId) cancelAnimationFrame(animationId);
  state = initialState();
  state.highScore = prevHighScore;
  state.phase = 'playing';
  dropAccumulator = 0;
  lastTime = performance.now();
  hideOverlay();
  animationId = requestAnimationFrame(gameLoop);
}

function startAttract() {
  const prevHighScore = Math.max(state.highScore, loadHighScore());
  if (animationId) cancelAnimationFrame(animationId);
  state = initialState();
  state.highScore = prevHighScore;
  state.phase = 'attract';
  dropAccumulator = 0;
  lastTime = performance.now();
  hideOverlay();
  animationId = requestAnimationFrame(gameLoop);
}

function backToTitle() {
  clearGameOverTimeout();
  const prevHighScore = Math.max(state.highScore, loadHighScore());
  if (animationId) cancelAnimationFrame(animationId);
  state = initialState();
  state.highScore = prevHighScore;
  state.phase = 'title';
  state.attractTimer = 0;
  dropAccumulator = 0;
  lastTime = performance.now();
  hideOverlay();
  animationId = requestAnimationFrame(gameLoop);
}

function restartGame() {
  const prevHighScore = Math.max(state.highScore, loadHighScore());
  if (animationId) cancelAnimationFrame(animationId);
  state = initialState();
  state.highScore = prevHighScore;
  state.phase = 'playing';
  dropAccumulator = 0;
  lastTime = performance.now();
  hideOverlay();
  animationId = requestAnimationFrame(gameLoop);
}

// ─────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────

lastTime = performance.now();
animationId = requestAnimationFrame(gameLoop);
