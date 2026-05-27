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

const GAME_OVER_REDIRECT_DELAY = 3000;

const ATTRACT_DELAY = 10000;

const AI_MOVE_INTERVAL = 100;

const LINE_CLEAR_FLASH_DURATION = 350;
const GAME_OVER_ANIM_DURATION = 1200;

// ─────────────────────────────────────────────
// Audio Engine (Web Audio API — Game Boy style)
// ─────────────────────────────────────────────

// Frequency table for all notes used by melody, bass and SFX
const NOTE_FREQ = {
  A2: 110.00, E3: 164.81,
  A3: 220.00, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00,
  A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99,
  A5: 880.00,
};

// Tetris Theme A (Korobeiniki) transcribed in eighth-note units at ~160 BPM
const MELODY = [
  // ── Part A ──
  ['E5',2],['B4',1],['C5',1], ['D5',2],['C5',1],['B4',1],
  ['A4',2],['A4',1],['C5',1], ['E5',2],['D5',1],['C5',1],
  ['B4',3],['C5',1],
  ['D5',2],['E5',2],
  ['C5',2],['A4',2],
  ['A4',4],
  // ── Part B ──
  ['D5',3],['F5',1],['A5',2],['G5',1],['F5',1],
  ['E5',3],['C5',1],
  ['E5',2],['D5',1],['C5',1],
  ['B4',2],['B4',1],['C5',1],
  ['D5',2],['E5',2],
  ['C5',2],['A4',2],
  ['A4',4],
];

// Simple alternating A/E bass that repeats throughout (one 4/4 measure)
const BASS = [['A2',2],['E3',2],['A2',2],['E3',2]];

const EIGHTH = 0.1875; // seconds per eighth note (≈ 160 BPM)

// All audio objects are created lazily on the first user interaction to satisfy
// browser autoplay policy (AudioContext must be created in a user gesture).
let _audio = null;

function getAudio() {
  if (_audio) return _audio;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();

    // Music sub-graph: melody + bass feed into musicGain (muted by M key)
    const musicGain = ctx.createGain();
    musicGain.gain.value = 1.0;
    musicGain.connect(ctx.destination);

    const melGain = ctx.createGain();
    melGain.gain.value = 0.14;
    melGain.connect(musicGain);

    const bassGain = ctx.createGain();
    bassGain.gain.value = 0.09;
    bassGain.connect(musicGain);

    // SFX feeds directly to destination so M key does not silence effects
    const sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.28;
    sfxGain.connect(ctx.destination);

    _audio = { ctx, musicGain, melGain, bassGain, sfxGain };
  } catch (e) {
    _audio = null;
  }
  return _audio;
}

// ── Music scheduler state ─────────────────────

let musicMuted   = false;
let musicRunning = false;
let melodyIdx    = 0;
let bassIdx      = 0;
let melodyNextTime = 0;
let bassNextTime   = 0;
let musicTimer   = null;

// Schedules a single square-wave note into the given gain node.
function scheduleNote(freq, startTime, duration, gainNode, vol, type) {
  if (vol  === undefined) vol  = 1;
  if (type === undefined) type = 'square';
  const a = getAudio();
  if (!a || freq <= 0) return;
  const osc = a.ctx.createOscillator();
  const env = a.ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  env.gain.setValueAtTime(vol, startTime);
  env.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  osc.connect(env);
  env.connect(gainNode);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.01);
}

// Lookahead scheduler: called every 25 ms, schedules notes 150 ms ahead.
function scheduleMusicTick() {
  if (!musicRunning) return;
  const a = getAudio();
  if (!a) return;
  const { ctx, melGain, bassGain } = a;
  const lookahead = 0.15;
  const now = ctx.currentTime;

  while (melodyNextTime < now + lookahead) {
    const [note, dur] = MELODY[melodyIdx];
    const secs = dur * EIGHTH;
    if (NOTE_FREQ[note]) {
      scheduleNote(NOTE_FREQ[note], melodyNextTime, secs * 0.88, melGain);
    }
    melodyNextTime += secs;
    melodyIdx = (melodyIdx + 1) % MELODY.length;
  }

  while (bassNextTime < now + lookahead) {
    const [note, dur] = BASS[bassIdx % BASS.length];
    const secs = dur * EIGHTH;
    if (NOTE_FREQ[note]) {
      scheduleNote(NOTE_FREQ[note], bassNextTime, secs * 0.60, bassGain);
    }
    bassNextTime += secs;
    bassIdx = (bassIdx + 1) % BASS.length;
  }

  musicTimer = setTimeout(scheduleMusicTick, 25);
}

function startMusic(fromStart) {
  if (fromStart === undefined) fromStart = false;
  const a = getAudio();
  if (!a) return;
  if (a.ctx.state === 'suspended') a.ctx.resume();
  if (fromStart) {
    melodyIdx = 0;
    bassIdx   = 0;
    melodyNextTime = a.ctx.currentTime + 0.05;
    bassNextTime   = a.ctx.currentTime + 0.05;
  } else if (!musicRunning) {
    melodyNextTime = a.ctx.currentTime + 0.05;
    bassNextTime   = a.ctx.currentTime + 0.05;
  }
  musicRunning = true;
  if (musicTimer) clearTimeout(musicTimer);
  a.musicGain.gain.value = musicMuted ? 0 : 1;
  scheduleMusicTick();
}

function stopMusic() {
  musicRunning = false;
  if (musicTimer) { clearTimeout(musicTimer); musicTimer = null; }
}

function pauseMusic() { stopMusic(); }

function resumeMusic() { startMusic(false); }

function toggleMute() {
  musicMuted = !musicMuted;
  const a = getAudio();
  if (a) a.musicGain.gain.value = musicMuted ? 0 : 1;
  const el = document.getElementById('music-status');
  if (el) {
    el.textContent = musicMuted ? 'OFF' : 'ON';
    el.className   = musicMuted ? 'muted' : '';
  }
  return musicMuted;
}

// ── Sound effects ─────────────────────────────

// Quick soft blip on lateral move
function sfxMove() {
  if (state.phase !== 'playing') return;
  const a = getAudio();
  if (!a || a.ctx.state !== 'running') return;
  const now = a.ctx.currentTime;
  scheduleNote(220, now, 0.040, a.sfxGain, 0.38);
}

// Two-note click on rotation
function sfxRotate() {
  if (state.phase !== 'playing') return;
  const a = getAudio();
  if (!a || a.ctx.state !== 'running') return;
  const now = a.ctx.currentTime;
  scheduleNote(440, now,        0.045, a.sfxGain, 0.32);
  scheduleNote(554, now + 0.03, 0.040, a.sfxGain, 0.22);
}

// Descending frequency sweep — satisfying hard-drop thud
function sfxHardDrop() {
  if (state.phase !== 'playing') return;
  const a = getAudio();
  if (!a || a.ctx.state !== 'running') return;
  const { ctx, sfxGain } = a;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(280, now);
  osc.frequency.exponentialRampToValueAtTime(55, now + 0.12);
  env.gain.setValueAtTime(0.45, now);
  env.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
  osc.connect(env);
  env.connect(sfxGain);
  osc.start(now);
  osc.stop(now + 0.13);
}

// Short low thud when a piece locks without clearing lines
function sfxLock() {
  if (state.phase !== 'playing') return;
  const a = getAudio();
  if (!a || a.ctx.state !== 'running') return;
  const now = a.ctx.currentTime;
  scheduleNote(140, now, 0.09, a.sfxGain, 0.50);
}

// Ascending arpeggio; Tetris (4 lines) gets a longer fanfare
function sfxLineClear(lines) {
  if (state.phase !== 'playing') return;
  const a = getAudio();
  if (!a || a.ctx.state !== 'running') return;
  const now = a.ctx.currentTime;
  if (lines === 4) {
    [523, 659, 784, 1047].forEach(function(f, i) {
      scheduleNote(f, now + i * 0.08, 0.10, a.sfxGain, 0.65);
    });
    scheduleNote(1047, now + 0.36, 0.32, a.sfxGain, 0.75);
  } else {
    var freqs = [523, 659, 784, 1047];
    for (var i = 0; i <= lines; i++) {
      scheduleNote(freqs[i], now + i * 0.07, 0.09, a.sfxGain, 0.55);
    }
  }
}

// Five-note ascending scale, played instead of sfxLineClear on level-up
function sfxLevelUp() {
  if (state.phase !== 'playing') return;
  const a = getAudio();
  if (!a || a.ctx.state !== 'running') return;
  const now = a.ctx.currentTime;
  [523, 659, 784, 1047, 1319].forEach(function(f, i) {
    scheduleNote(f, now + i * 0.09, 0.14, a.sfxGain, 0.55);
  });
}

// Descending chromatic melody — plays when the game ends
function sfxGameOver() {
  const a = getAudio();
  if (!a) return;
  if (a.ctx.state === 'suspended') a.ctx.resume();
  const now = a.ctx.currentTime;
  [440, 415, 392, 370, 349, 311, 277, 247].forEach(function(f, i) {
    scheduleNote(f, now + i * 0.115, 0.16, a.sfxGain, 0.45);
  });
}

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

  // Snapshot board with piece placed but before removing full rows (used for flash animation)
  const lockedBoard = newBoard.map(row => [...row]);

  const clearedRows = [];
  for (let r = 0; r < ROWS; r++) {
    if (newBoard[r].every(cell => cell !== null)) clearedRows.push(r);
  }

  const clearedBoard = newBoard.filter(row => row.some(cell => !cell));
  const linesCleared = ROWS - clearedBoard.length;
  while (clearedBoard.length < ROWS) {
    clearedBoard.unshift(Array(COLS).fill(null));
  }

  return { newBoard: clearedBoard, linesCleared, lockedBoard, clearedRows };
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

function drawCell(ctx, x, y, color, size, alpha) {
  if (size  === undefined) size  = CELL;
  if (alpha === undefined) alpha = 1;
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

function drawPiece(ctx, piece, originRow, alpha) {
  if (alpha === undefined) alpha = 1;
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
  const t = timer / LEVEL_UP_DURATION;
  const fadeAlpha = Math.min(1, t * 3);

  // Pulsing gold border around the board
  const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 70);
  boardCtx.save();
  boardCtx.globalAlpha = fadeAlpha * (0.35 + 0.65 * pulse);
  boardCtx.strokeStyle = '#f0c040';
  boardCtx.lineWidth = 8;
  boardCtx.strokeRect(4, 4, boardCanvas.width - 8, boardCanvas.height - 8);
  boardCtx.restore();

  const textAlpha = Math.min(1, timer / 400);
  boardCtx.save();
  boardCtx.globalAlpha = textAlpha;
  boardCtx.font = 'bold 34px "Courier New"';
  boardCtx.textAlign = 'center';
  boardCtx.textBaseline = 'middle';
  boardCtx.fillStyle = '#000';
  boardCtx.fillText('NÍVEL UP!', boardCanvas.width / 2 + 2, boardCanvas.height / 2 + 2);
  boardCtx.fillStyle = '#f0c040';
  boardCtx.fillText('NÍVEL UP!', boardCanvas.width / 2, boardCanvas.height / 2);
  boardCtx.restore();
}

// White (or cyan for Tetris) flash over the rows that were just cleared.
// Uses the "before" board (lockedBoard) so the completed rows are visible during the flash.
function drawLineClearEffect(anim) {
  if (!anim || anim.timer <= 0) return;
  const t = anim.timer / LINE_CLEAR_FLASH_DURATION;
  // Bell-curve: 0 at start → peaks in the middle → 0 at end
  const intensity = Math.sin(t * Math.PI);
  const flashColor = anim.rows.length === 4 ? '#80ffff' : '#ffffff';

  boardCtx.save();
  const clearedSet = new Set(anim.rows);
  for (let r = 0; r < ROWS; r++) {
    if (!clearedSet.has(r)) continue;
    boardCtx.globalAlpha = intensity * 0.9;
    boardCtx.fillStyle = flashColor;
    boardCtx.fillRect(0, r * CELL, boardCanvas.width, CELL);
  }
  boardCtx.restore();
}

// Gray wave that fills the board from bottom to top during game over.
function drawGameOverWave(s) {
  const progress = 1 - s.gameOverAnimTimer / GAME_OVER_ANIM_DURATION;
  const rowsFilled = Math.floor(progress * ROWS);
  const firstFilledRow = ROWS - rowsFilled;

  boardCtx.save();
  for (let r = firstFilledRow; r < ROWS; r++) {
    boardCtx.globalAlpha = 0.80;
    boardCtx.fillStyle = '#2a2a2a';
    boardCtx.fillRect(0, r * CELL, boardCanvas.width, CELL);
  }
  if (firstFilledRow > 0) {
    boardCtx.globalAlpha = 0.9;
    boardCtx.fillStyle = '#cccccc';
    boardCtx.fillRect(0, firstFilledRow * CELL, boardCanvas.width, 2);
  }
  boardCtx.restore();
}

function drawTitleScreen(state) {
  const ctx = boardCtx;
  const w = boardCanvas.width;
  const h = boardCanvas.height;

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

  ctx.font = 'bold 54px "Courier New"';
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillText('TETRIS', w / 2 + 3, h * 0.20 + 3);
  ctx.fillStyle = '#e94560';
  ctx.fillText('TETRIS', w / 2, h * 0.20);

  if (state.highScore > 0) {
    ctx.font = '13px "Courier New"';
    ctx.fillStyle = '#f0c040';
    ctx.fillText('RECORDE: ' + state.highScore, w / 2, h * 0.34);
  }

  ctx.font = '12px "Courier New"';
  ctx.fillStyle = '#888';
  const lines = ['← →  Mover', ' ↑   Rotacionar', ' ↓   Descer', 'Espaço  Queda', ' P   Pausar', ' M   Música ON/OFF'];
  lines.forEach((line, i) => ctx.fillText(line, w / 2, h * 0.44 + i * 21));

  if (Math.floor(Date.now() / 500) % 2 === 0) {
    ctx.font = 'bold 13px "Courier New"';
    ctx.fillStyle = '#eee';
    ctx.fillText('PRESSIONE QUALQUER TECLA', w / 2, h * 0.79);
    ctx.fillText('PARA INICIAR', w / 2, h * 0.84);
  }

  const pct = state.attractTimer / ATTRACT_DELAY;
  ctx.fillStyle = '#0f3460';
  ctx.fillRect(20, h - 16, w - 40, 5);
  ctx.fillStyle = '#e94560';
  ctx.fillRect(20, h - 16, (w - 40) * pct, 5);

  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
}

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
    phase: 'title',       // 'title' | 'playing' | 'attract'
    attractTimer: 0,
    aiTarget: null,
    aiMoveAccumulator: 0,
    lineClearAnim: null,  // { displayBoard, rows, timer } — flash effect on line clear
    gameOverStarted: false,
    gameOverAnimTimer: 0,
    gameOverShown: false,
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
// Actions
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
      return true;
    }
  }
  return false;
}

function hardDrop(s) {
  sfxHardDrop();
  const gr = ghostRow(s.board, s.current);
  const dropped = gr - s.current.row;
  s.current.row = gr;
  s.score += dropped * 2;
  lockCurrent(s);
}

function lockCurrent(s) {
  const { newBoard, linesCleared, lockedBoard, clearedRows } = lockPiece(
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
    sfxLevelUp();
  } else if (linesCleared > 0) {
    sfxLineClear(linesCleared);
  } else {
    sfxLock();
  }

  if (s.score > s.highScore) {
    s.highScore = s.score;
    saveHighScore(s.highScore);
  }

  if (linesCleared > 0) {
    if (newBoard[0].some(cell => cell !== null)) {
      s.over = true;
      return;
    }
    // Delay piece spawn until the flash animation finishes
    s.lineClearAnim = { displayBoard: lockedBoard, rows: clearedRows, timer: LINE_CLEAR_FLASH_DURATION };
    return;
  }

  spawnNext(s);
}

function spawnNext(s) {
  if (s.board[0].some(cell => cell !== null)) {
    s.over = true;
    return;
  }
  s.current = s.next;
  s.next = createPiece(randomPieceName());
  s.aiTarget = null;
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

    if (state.lineClearAnim) {
      state.lineClearAnim.timer -= delta;
      if (state.lineClearAnim.timer <= 0) {
        state.lineClearAnim = null;
        dropAccumulator = 0;
        spawnNext(state);
      }
    }

    if (!state.lineClearAnim && !state.over) {
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
    }

    if (state.levelUpTimer > 0) {
      state.levelUpTimer = Math.max(0, state.levelUpTimer - delta);
    }

    if (state.lineClearAnim) {
      drawGrid(boardCtx, state.lineClearAnim.displayBoard);
      drawNextPiece(state.next);
      drawLevelUpBanner(state.levelUpTimer);
      drawLineClearEffect(state.lineClearAnim);
      document.getElementById('score').textContent = state.score;
      document.getElementById('high-score').textContent = state.highScore;
      document.getElementById('level').textContent = state.level;
      document.getElementById('lines').textContent = state.totalLines;
    } else {
      render(state);
    }
    drawAttractOverlay();
    animationId = requestAnimationFrame(gameLoop);
    return;
  }

  // ── Playing ──
  if (!state.paused && !state.over) {
    if (state.lineClearAnim) {
      state.lineClearAnim.timer -= delta;
      if (state.lineClearAnim.timer <= 0) {
        state.lineClearAnim = null;
        dropAccumulator = 0;
        spawnNext(state);
      }
    }

    if (!state.lineClearAnim && !state.over) {
      dropAccumulator += delta;
      if (dropAccumulator >= dropInterval(state.level)) {
        dropAccumulator = 0;
        if (!tryMove(state, 1, 0)) lockCurrent(state);
      }
    }

    if (state.levelUpTimer > 0) {
      state.levelUpTimer = Math.max(0, state.levelUpTimer - delta);
    }

    if (state.lineClearAnim) {
      drawGrid(boardCtx, state.lineClearAnim.displayBoard);
      drawNextPiece(state.next);
      drawLevelUpBanner(state.levelUpTimer);
      drawLineClearEffect(state.lineClearAnim);
      document.getElementById('score').textContent = state.score;
      document.getElementById('high-score').textContent = state.highScore;
      document.getElementById('level').textContent = state.level;
      document.getElementById('lines').textContent = state.totalLines;
    } else {
      render(state);
    }
  }

  if (state.over) {
    if (!state.gameOverStarted) {
      state.gameOverStarted = true;
      stopMusic();
      sfxGameOver();
      state.gameOverAnimTimer = GAME_OVER_ANIM_DURATION;
    }
    if (state.gameOverAnimTimer > 0) {
      state.gameOverAnimTimer = Math.max(0, state.gameOverAnimTimer - delta);
      render(state);
      drawGameOverWave(state);
      animationId = requestAnimationFrame(gameLoop);
      return;
    }
    if (!state.gameOverShown) {
      state.gameOverShown = true;
      showGameOverOverlay();
    }
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

function showOverlay(title, sub, record) {
  if (record === undefined) record = '';
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

function showGameOverOverlay() {
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
  // Ensure AudioContext is unlocked on any key press
  const a = getAudio();
  if (a && a.ctx.state === 'suspended') a.ctx.resume();

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
      if (tryMove(state, 0, -1)) sfxMove();
      break;
    case 'ArrowRight':
      e.preventDefault();
      if (tryMove(state, 0, 1)) sfxMove();
      break;
    case 'ArrowDown':
      e.preventDefault();
      if (tryMove(state, 1, 0)) { state.score += 1; sfxMove(); }
      break;
    case 'ArrowUp':
      e.preventDefault();
      if (tryRotate(state)) sfxRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop(state);
      break;
    case 'KeyP':
      togglePause();
      break;
    case 'KeyM':
      toggleMute();
      break;
    default:
      return;
  }

  if (!state.paused && !state.over) render(state);
});

document.addEventListener('click', () => {
  const a = getAudio();
  if (a && a.ctx.state === 'suspended') a.ctx.resume();
  if (state.phase === 'title') startGame();
  else if (state.phase === 'attract') backToTitle();
});

document.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const a = getAudio();
  if (a && a.ctx.state === 'suspended') a.ctx.resume();
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
    pauseMusic();
    showOverlay('PAUSADO', 'Pressione P para continuar');
  } else {
    hideOverlay();
    resumeMusic();
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
  startMusic(true);
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
  startMusic(true);
  animationId = requestAnimationFrame(gameLoop);
}

function backToTitle() {
  clearGameOverTimeout();
  stopMusic();
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
  startMusic(true);
  animationId = requestAnimationFrame(gameLoop);
}

// ─────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────

lastTime = performance.now();
animationId = requestAnimationFrame(gameLoop);
