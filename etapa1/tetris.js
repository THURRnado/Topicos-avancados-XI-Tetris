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

// Each piece defined as a 2-D matrix of its first rotation state
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

// Points awarded per number of lines cleared at once
const LINE_POINTS = [0, 100, 300, 500, 800];

// Drop interval (ms) per level
const LEVEL_SPEEDS = [800, 720, 630, 550, 470, 380, 300, 220, 130, 100];

// ─────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────

function randomPieceName() {
  return PIECE_NAMES[Math.floor(Math.random() * PIECE_NAMES.length)];
}

function cloneMatrix(matrix) {
  return matrix.map(row => [...row]);
}

/**
 * Rotates a 2-D matrix 90° clockwise.
 * Adding more rotation logic here won't affect game state.
 */
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
// Board
// ─────────────────────────────────────────────

/**
 * The board is a 2-D array: board[row][col].
 * Empty cells hold null; filled cells hold a color string.
 */
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

/**
 * Locks the current piece into the board and returns
 * { newBoard, linesCleared }.
 */
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

  // Clear full rows
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
// Rendering
// ─────────────────────────────────────────────

const boardCanvas = document.getElementById('board');
const boardCtx = boardCanvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const nextCtx = nextCanvas.getContext('2d');

function drawCell(ctx, x, y, color, size = CELL, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(x + 1, y + 1, size - 2, size - 2);

  // Highlight edge
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(x + 1, y + 1, size - 2, 4);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x + 1, y + size - 5, size - 2, 4);

  ctx.globalAlpha = 1;
}

function drawGrid(ctx, board) {
  ctx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);

  // Subtle grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      ctx.strokeRect(c * CELL, r * CELL, CELL, CELL);
    }
  }

  // Locked cells
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c]) {
        drawCell(ctx, c * CELL, r * CELL, board[r][c]);
      }
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

function render(state) {
  drawGrid(boardCtx, state.board);

  // Ghost
  const gRow = ghostRow(state.board, state.current);
  if (gRow !== state.current.row) {
    drawPiece(boardCtx, state.current, gRow, 0.2);
  }

  // Active piece
  drawPiece(boardCtx, state.current, state.current.row);

  drawNextPiece(state.next);

  document.getElementById('score').textContent = state.score;
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
    level: 1,
    totalLines: 0,
    paused: false,
    over: false,
  };
}

let state = initialState();
let lastTime = 0;
let dropAccumulator = 0;
let animationId = null;

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
  // Wall-kick offsets to try
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
  s.score += dropped * 2; // bonus for hard drop
  lockCurrent(s);
}

function lockCurrent(s) {
  const { newBoard, linesCleared } = lockPiece(
    s.board, s.current.matrix, s.current.row, s.current.col, s.current.color
  );
  s.board = newBoard;
  s.score += LINE_POINTS[linesCleared] * s.level;
  s.totalLines += linesCleared;
  s.level = Math.floor(s.totalLines / 10) + 1;

  s.current = s.next;
  s.next = createPiece(randomPieceName());

  // Spawn collision → game over
  if (!isValidPosition(s.board, s.current.matrix, s.current.row, s.current.col)) {
    s.over = true;
  }
}

// ─────────────────────────────────────────────
// Game loop
// ─────────────────────────────────────────────

function gameLoop(timestamp) {
  const delta = timestamp - lastTime;
  lastTime = timestamp;

  if (!state.paused && !state.over) {
    dropAccumulator += delta;
    if (dropAccumulator >= dropInterval(state.level)) {
      dropAccumulator = 0;
      if (!tryMove(state, 1, 0)) {
        lockCurrent(state);
      }
    }
    render(state);
  }

  if (state.over) {
    showOverlay('GAME OVER', 'Pressione Enter para reiniciar');
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

function showOverlay(title, sub) {
  overlayTitle.textContent = title;
  overlaySub.textContent = sub;
  overlay.classList.remove('hidden');
}

function hideOverlay() {
  overlay.classList.add('hidden');
}

// ─────────────────────────────────────────────
// Input handling
// ─────────────────────────────────────────────

document.addEventListener('keydown', (e) => {
  if (state.over) {
    if (e.code === 'Enter') restartGame();
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

// ─────────────────────────────────────────────
// Pause / restart
// ─────────────────────────────────────────────

function togglePause() {
  if (state.over) return;
  state.paused = !state.paused;
  if (state.paused) {
    showOverlay('PAUSADO', 'Pressione P para continuar');
  } else {
    hideOverlay();
    lastTime = performance.now();
    animationId = requestAnimationFrame(gameLoop);
  }
}

function restartGame() {
  if (animationId) cancelAnimationFrame(animationId);
  state = initialState();
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
