// TAP THE MAPLE — a Knife Hit–style sugaring game for Btown Games.
// Tap to throw sap spiles into the spinning maple log. Don't hit steel. Or knots.

import { sound } from './audio.js';
import { makeBackground, makeLogFace, makeSpileSprite, drawSapDrop } from './art.js';
import { levelConfig, SpinPattern } from './level.js';
import {
  lbEnabled, getName, submitScore, renamePlayer, fetchTop, monthLabel, playerId,
} from './leaderboard.js';

const $ = (id) => document.getElementById(id);
const TAU = Math.PI * 2;
const ENTRY = Math.PI / 2; // spiles fly in from the bottom of the log
const norm = (a) => ((a % TAU) + TAU) % TAU;
const angDist = (a, b) => {
  const d = Math.abs(norm(a) - norm(b));
  return Math.min(d, TAU - d);
};

const SPILE_TOL = 0.17;  // rad between spile centers = steel on steel
const KNOT_TOL = 0.26;
const SAP_TOL = 0.22;
const THROW_SPEED = 2600; // px/s

/* ------------------------------------------------------------ canvas */

const canvas = $('game');
const ctx = canvas.getContext('2d');
let W = 0, H = 0, DPR = 1;
let bg = null;          // { canvas, chimney }
let R = 120;            // log radius
let CX = 0, CY = 0;     // log center
let LEN = 70;           // spile length
let spileSprite = null, rustySprite = null;

function layout() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  bg = makeBackground(W, H);
  R = Math.max(88, Math.min(W * 0.32, H * 0.20, 150));
  CX = W / 2;
  CY = Math.max(R + 90, H * 0.30);
  LEN = Math.max(46, Math.min(R * 0.62, 82));
  spileSprite = makeSpileSprite(LEN);
  rustySprite = makeSpileSprite(LEN, true);
  if (cfg) rebuildFace();
}

/* ------------------------------------------------------------ state */

let state = 'menu'; // menu | playing | clearing | failing | over
let runId = 0;      // guards stale timeouts across fast restarts

let level = 1, score = 0, sap = 0;
let cfg = null, faceData = null, faceSeed = 1;
let spin = null, rot = 0;
let remaining = 0;
let stuck = [];     // { a (local rad), rusty }
let sapsLeft = [];  // local angles
let flying = null;  // { tipY }
let logPulse = 0, logIntro = 0, shake = 0, timeScale = 1;
let failSpile = null; // { x, y, vx, vy, rot, vr }
let pieces = [];     // level-clear debris
let clearT = 0, failT = 0;
let particles = []; // { x, y, vx, vy, life, max, r, color, text? }
let flakes = [], puffs = [], steamT = 0, dripT = 0;
let tapHintT = 0, thrownOnce = false;
let overAt = 0;

let best = Number(localStorage.getItem('ttm-best') || 0);
let bestLevel = Number(localStorage.getItem('ttm-best-level') || 0);

function initFlakes() {
  flakes = [];
  for (let i = 0; i < 46; i++) {
    flakes.push({
      x: Math.random() * W, y: Math.random() * H,
      r: 1 + Math.random() * 2.2, v: 18 + Math.random() * 30,
      drift: Math.random() * TAU,
    });
  }
}

function rebuildFace() {
  faceData = makeLogFace(R, cfg.style, cfg.knotAngles, faceSeed);
}

function setupLevel(n) {
  cfg = levelConfig(n);
  faceSeed = (n * 2654435761) >>> 8;
  rebuildFace();
  spin = new SpinPattern(cfg);
  rot = Math.random() * TAU;
  remaining = cfg.spiles;
  stuck = cfg.preAngles.map((a) => ({ a, rusty: true }));
  sapsLeft = [...cfg.sapAngles];
  flying = null;
  failSpile = null;
  pieces = [];
  logPulse = 0;
  logIntro = 0;
  levelChip.textContent = cfg.boss ? `🌳 ${cfg.boss.name}` : `LEVEL ${n}`;
  levelChip.classList.toggle('boss', !!cfg.boss);
  if (cfg.boss) {
    showBanner(cfg.boss.name);
    sound.boss();
  } else if (n > 1) {
    showBanner(`LEVEL ${n}`);
  }
}

let bannerTimer = 0;
function showBanner(text) {
  banner.textContent = text;
  banner.classList.remove('hidden');
  bannerTimer = 1.3;
}

/* ------------------------------------------------------------ DOM */

const hud = $('hud'), scoreEl = $('score'), levelChip = $('level-chip');
const sapCountEl = $('sap-count'), banner = $('banner');
const menuEl = $('menu'), gameoverEl = $('gameover');
const bestLine = $('best-line');
const goVerdict = $('go-verdict'), goReason = $('go-reason'), goScore = $('go-score');
const goDetail = $('go-detail'), goBest = $('go-best');
const muteBtn = $('mute');

function paintBestLine() {
  bestLine.textContent = best > 0 ? `Best: ${best} spiles · Level ${bestLevel}` : '';
}
paintBestLine();

function paintHud() {
  scoreEl.textContent = score;
  sapCountEl.textContent = sap;
}

/* ------------------------------------------------------------ game flow */

function startGame() {
  runId++;
  state = 'playing';
  level = 1;
  score = 0;
  sap = 0;
  timeScale = 1;
  shake = 0;
  thrownOnce = false;
  tapHintT = 0;
  particles = [];
  setupLevel(level);
  paintHud();
  menuEl.classList.add('hidden');
  gameoverEl.classList.add('hidden');
  hud.classList.remove('hidden');
}

function throwSpile() {
  if (state !== 'playing' || flying) return;
  flying = { tipY: H - 170 };
  thrownOnce = true;
  sound.whoosh();
}

function resolveThrow() {
  const entryLocal = norm(ENTRY - rot);

  // sap drops sit on the rim — slice one on the way in for bonus points
  for (let i = sapsLeft.length - 1; i >= 0; i--) {
    if (angDist(entryLocal, sapsLeft[i]) < SAP_TOL) {
      sapsLeft.splice(i, 1);
      sap++;
      score += 2;
      sound.ding();
      splashSap();
      popText('+2', CX, CY + R + 16, '#ffd97a');
    }
  }

  // steel or knot = season over
  for (const s of stuck) {
    if (angDist(entryLocal, s.a) < SPILE_TOL) return fail('spile');
  }
  for (const k of cfg.knotAngles) {
    if (angDist(entryLocal, k) < KNOT_TOL) return fail('knot');
  }

  // THUNK. It's in.
  stuck.push({ a: entryLocal, rusty: false });
  score++;
  remaining--;
  logPulse = 1;
  sound.thunk();
  woodChips();
  popText('+1', CX + 30, CY + R + 10, '#fff3e0');
  paintHud();
  flying = null;
  if (remaining <= 0) clearLevel();
}

function clearLevel() {
  state = 'clearing';
  clearT = 0;
  sound.crack();
  if (cfg.boss) {
    sound.fanfare();
    popText('BOSS CLEARED!', CX, CY - R - 30, '#ffc95e');
  }
  // the log face bursts into quadrants
  const fc = faceData.canvas, hf = faceData.half;
  pieces = [];
  for (let qy = 0; qy < 2; qy++) {
    for (let qx = 0; qx < 2; qx++) {
      pieces.push({
        sx: qx * hf, sy: qy * hf,
        x: CX + (qx - 0.5) * hf, y: CY + (qy - 0.5) * hf,
        vx: (qx - 0.5) * 2 * (160 + Math.random() * 120),
        vy: (qy - 0.5) * 2 * (140 + Math.random() * 100) - 60,
        rot: 0, vr: (Math.random() - 0.5) * 5,
        img: fc, hf,
      });
    }
  }
  // stuck spiles fly off with it
  for (const s of stuck) {
    const wa = rot + s.a;
    pieces.push({
      spile: true, rusty: s.rusty,
      x: CX + Math.cos(wa) * R, y: CY + Math.sin(wa) * R,
      vx: Math.cos(wa) * (240 + Math.random() * 140),
      vy: Math.sin(wa) * 240 - 80,
      rot: wa - Math.PI / 2, vr: (Math.random() - 0.5) * 8,
    });
  }
  stuck = [];
  sapsLeft = [];
}

function fail(reason) {
  state = 'failing';
  failT = 0;
  timeScale = 0.25;
  shake = 13;
  sound.clink();
  const tipY = CY + R - R * 0.16;
  failSpile = {
    x: CX, y: tipY,
    vx: (Math.random() - 0.5) * 320, vy: 380,
    rot: 0, vr: 9 + Math.random() * 6,
  };
  flying = null;
  const id = runId;
  setTimeout(() => { if (id === runId) gameOver(reason); }, 950);
}

function gameOver(reason) {
  if (state === 'over') return;
  state = 'over';
  sound.gameover();
  const isBest = score > best;
  if (isBest) {
    best = score;
    bestLevel = Math.max(bestLevel, level);
    localStorage.setItem('ttm-best', String(best));
    localStorage.setItem('ttm-best-level', String(bestLevel));
  } else if (level > bestLevel) {
    bestLevel = level;
    localStorage.setItem('ttm-best-level', String(bestLevel));
  }
  goVerdict.textContent = cfg.boss && reason ? 'THE LOG WINS' : "SEASON'S OVER";
  goReason.textContent = reason === 'knot'
    ? 'THWACK — right into a knot.'
    : 'CLANG — steel on steel.';
  goScore.textContent = score;
  goDetail.textContent = `Level ${level}${cfg.boss ? ` · ${cfg.boss.name}` : ''} · 🪣 ${sap} sap drop${sap === 1 ? '' : 's'}`;
  goBest.textContent = isBest ? '🍁 NEW SUGARBUSH RECORD!' : `Best: ${best} · Level ${bestLevel}`;
  goBest.className = isBest ? 'new-best' : '';
  paintBestLine();
  overAt = performance.now();
  setTimeout(() => {
    if (state === 'over') gameoverEl.classList.remove('hidden');
  }, 350);
  updateLeaderboard(score); // submits exactly once per run (only called here)
}

function nextLevel() {
  level++;
  setupLevel(level);
}

/* ------------------------------------------------------------ particles */

function woodChips() {
  const y = CY + R;
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
    const sp = 120 + Math.random() * 220;
    particles.push({
      x: CX + (Math.random() - 0.5) * 10, y,
      vx: Math.cos(a) * sp * 0.6, vy: Math.sin(a) * sp - 60,
      life: 0, max: 0.5 + Math.random() * 0.3,
      r: 1.5 + Math.random() * 2.5,
      color: Math.random() < 0.5 ? '#d8b57e' : '#8a6238',
    });
  }
}

function splashSap() {
  const y = CY + R + 8;
  for (let i = 0; i < 8; i++) {
    particles.push({
      x: CX + (Math.random() - 0.5) * 14, y,
      vx: (Math.random() - 0.5) * 190, vy: -60 - Math.random() * 130,
      life: 0, max: 0.55, r: 2 + Math.random() * 2, color: '#e8a33a',
    });
  }
}

function popText(text, x, y, color) {
  particles.push({ x, y, vx: 0, vy: -46, life: 0, max: 0.85, r: 0, color, text });
}

/* ------------------------------------------------------------ update */

let last = performance.now();
function frame(now) {
  const realDt = Math.min(0.033, (now - last) / 1000);
  last = now;
  const dt = realDt * timeScale;
  update(dt, realDt);
  draw(now / 1000);
  requestAnimationFrame(frame);
}

function update(dt, realDt) {
  // ambient
  steamT -= realDt;
  if (steamT <= 0 && bg) {
    steamT = 0.28;
    puffs.push({ x: bg.chimney.x, y: bg.chimney.y, r: 4, life: 0, max: 3.2 + Math.random() });
  }
  for (let i = puffs.length - 1; i >= 0; i--) {
    const p = puffs[i];
    p.life += realDt;
    p.y -= realDt * 26;
    p.x += Math.sin(p.life * 1.7) * 8 * realDt + realDt * 6;
    p.r += realDt * 9;
    if (p.life > p.max) puffs.splice(i, 1);
  }
  for (const f of flakes) {
    f.y += f.v * realDt;
    f.x += Math.sin(f.drift + f.y * 0.01) * 14 * realDt;
    if (f.y > H + 4) { f.y = -4; f.x = Math.random() * W; }
  }

  if (bannerTimer > 0) {
    bannerTimer -= realDt;
    if (bannerTimer <= 0) banner.classList.add('hidden');
  }

  shake = Math.max(0, shake - realDt * 26);
  logPulse = Math.max(0, logPulse - realDt * 5);
  logIntro = Math.min(1, logIntro + realDt * 4.5);

  if (state === 'playing' || state === 'failing') {
    rot += spin.step(dt) * dt;

    if (state === 'playing' && !thrownOnce) tapHintT += realDt;

    // sap drips from spiles hanging on the lower half of the log
    dripT -= dt;
    if (dripT <= 0 && stuck.length) {
      dripT = 0.5 + Math.random() * 0.9;
      const s = stuck[Math.floor(Math.random() * stuck.length)];
      const wa = norm(rot + s.a);
      if (wa > 0.4 && wa < Math.PI - 0.4) {
        const px = CX + Math.cos(wa) * (R + LEN * 0.9);
        const py = CY + Math.sin(wa) * (R + LEN * 0.9);
        particles.push({ x: px, y: py, vx: 0, vy: 30, life: 0, max: 0.9, r: 2, color: '#e8a33a' });
      }
    }

    if (flying) {
      flying.tipY -= THROW_SPEED * dt;
      if (flying.tipY <= CY + R - R * 0.16) resolveThrow();
    }
  }

  if (state === 'failing') {
    failT += realDt;
    const f = failSpile;
    if (f) {
      f.vy += 1300 * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.rot += f.vr * dt;
    }
    // ease back to real time as the moment sinks in
    timeScale = Math.min(1, 0.25 + failT * 0.9);
  }

  if (state === 'clearing') {
    clearT += realDt;
    for (const p of pieces) {
      p.vy += 900 * realDt;
      p.x += p.vx * realDt;
      p.y += p.vy * realDt;
      p.rot += p.vr * realDt;
    }
    if (clearT > 0.85) nextLevel();
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life += realDt;
    if (!p.text) p.vy += 640 * realDt;
    p.x += p.vx * realDt;
    p.y += p.vy * realDt;
    if (p.life > p.max) particles.splice(i, 1);
  }
}

/* ------------------------------------------------------------ draw */

function drawSpileAt(x, y, angle, rusty) {
  // sprite tip is at its (ox, oy); rotate so the tip points along `angle`
  const sp = rusty ? rustySprite : spileSprite;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.drawImage(sp.canvas, -sp.ox, -sp.oy);
  ctx.restore();
}

function draw(t) {
  ctx.clearRect(0, 0, W, H);
  if (bg) ctx.drawImage(bg.canvas, 0, 0);

  // sugarhouse steam
  for (const p of puffs) {
    const a = Math.max(0, 1 - p.life / p.max) * 0.4;
    ctx.fillStyle = `rgba(240,240,248,${a})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, TAU);
    ctx.fill();
  }
  // snow
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (const f of flakes) {
    ctx.globalAlpha = 0.35 + (f.r - 1) * 0.25;
    ctx.fillRect(f.x, f.y, f.r, f.r);
  }
  ctx.globalAlpha = 1;

  if (state === 'menu') return;

  ctx.save();
  if (shake > 0) {
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  }

  if (state === 'clearing') {
    // exploded log quadrants + freed spiles
    for (const p of pieces) {
      const a = Math.max(0, 1 - clearT / 0.85);
      ctx.globalAlpha = a;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (p.spile) {
        const sp = p.rusty ? rustySprite : spileSprite;
        ctx.drawImage(sp.canvas, -sp.ox, -sp.oy);
      } else {
        ctx.drawImage(p.img, p.sx, p.sy, p.hf, p.hf, -p.hf / 2, -p.hf / 2, p.hf, p.hf);
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  } else {
    const scale = (0.8 + 0.2 * logIntro) * (1 + logPulse * 0.045);

    // boss glow
    if (faceData.glow) {
      const g = ctx.createRadialGradient(CX, CY, R * 0.6, CX, CY, R * 1.7);
      g.addColorStop(0, faceData.glow);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(CX - R * 2, CY - R * 2, R * 4, R * 4);
    }

    // stuck spiles (behind the log rim, pointing out)
    for (const s of stuck) {
      const wa = rot + s.a;
      const tx = CX + Math.cos(wa) * (R - R * 0.16) * scale;
      const ty = CY + Math.sin(wa) * (R - R * 0.16) * scale;
      drawSpileAt(tx, ty, wa - Math.PI / 2, s.rusty);
    }

    // the log itself
    ctx.save();
    ctx.translate(CX, CY);
    ctx.rotate(rot);
    ctx.scale(scale, scale);
    ctx.drawImage(faceData.canvas, -faceData.half, -faceData.half);
    ctx.restore();

    // sap drops riding the rim
    for (const a of sapsLeft) {
      const wa = rot + a;
      ctx.save();
      ctx.translate(CX + Math.cos(wa) * (R + 9) * scale, CY + Math.sin(wa) * (R + 9) * scale);
      ctx.rotate(wa - Math.PI / 2);
      drawSapDrop(ctx, 8, t * 3 + a * 5);
      ctx.restore();
    }

    // in-flight spile
    if (flying) drawSpileAt(CX, flying.tipY, 0, false);

    // the doomed spile clattering away
    if (failSpile) drawSpileAt(failSpile.x, failSpile.y, failSpile.rot, false);

    // ready spile at your thumb
    if (state === 'playing' && !flying) {
      drawSpileAt(CX, H - 170, 0, false);
      if (!thrownOnce && level === 1) {
        const pulse = 0.55 + Math.sin(tapHintT * 5) * 0.35;
        ctx.fillStyle = `rgba(255,243,224,${pulse})`;
        ctx.font = '800 15px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('TAP TO THROW', CX, H - 170 + LEN + 30);
      }
    }

    // remaining-spile pips, stacked bottom-left
    ctx.fillStyle = 'rgba(255,243,224,0.9)';
    for (let i = 0; i < remaining; i++) {
      const py = H - 40 - i * 16;
      ctx.save();
      ctx.translate(20, py);
      ctx.rotate(-Math.PI / 2);
      ctx.scale(0.32, 0.32);
      ctx.drawImage(spileSprite.canvas, -spileSprite.ox, -spileSprite.oy);
      ctx.restore();
    }
  }

  // particles + score pops
  for (const p of particles) {
    const a = Math.max(0, 1 - p.life / p.max);
    if (p.text) {
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.font = '900 20px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.text, p.x, p.y);
      ctx.globalAlpha = 1;
    } else {
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.r * 2, p.r * 2);
      ctx.globalAlpha = 1;
    }
  }

  ctx.restore();
}

/* ------------------------------------------------------------ leaderboard */

const lbBox = $('lb'), lbList = $('lbList'), lbStatus = $('lbStatus');
const lbForm = $('lbForm'), lbNameInput = $('lbNameInput');
const lbThisBtn = $('lbThisBtn'), lbLastBtn = $('lbLastBtn'), lbRenameBtn = $('lbRenameBtn');
let lbMonthOffset = 0;

if (lbEnabled()) {
  lbBox.classList.remove('hidden');
  lbThisBtn.textContent = `🏆 ${monthLabel(0).toUpperCase()}`;
  lbLastBtn.textContent = monthLabel(-1).toUpperCase();
}

async function updateLeaderboard(s) {
  if (!lbEnabled()) return;
  if (!getName()) {
    // first run: ask for a name; hold the score pending until it's saved
    lbForm.classList.remove('hidden');
    lbRenameBtn.classList.add('hidden');
    lbStatus.textContent = 'Pick a name to join the monthly leaderboard!';
    lbList.innerHTML = '';
    lbForm.dataset.pendingScore = String(s);
    return;
  }
  try {
    await submitScore(s);
  } catch { /* offline — still try to show the board */ }
  renderBoard();
}

async function renderBoard() {
  lbForm.classList.add('hidden');
  lbRenameBtn.classList.remove('hidden');
  lbStatus.textContent = 'Loading…';
  try {
    const rows = await fetchTop(lbMonthOffset);
    const me = playerId();
    lbList.innerHTML = '';
    rows.slice(0, 10).forEach((r, i) => {
      const li = document.createElement('li');
      if (r.player_id === me) li.className = 'me';
      const medal = ['🥇', '🥈', '🥉'][i];
      li.innerHTML = `<span class="rank">${medal || i + 1}</span><span class="nm"></span><span class="sc"></span>`;
      li.querySelector('.nm').textContent = r.name;
      li.querySelector('.sc').textContent = r.score;
      lbList.appendChild(li);
    });
    const myRank = rows.findIndex((r) => r.player_id === me);
    lbStatus.textContent = rows.length === 0
      ? 'No scores yet this month — be the first!'
      : myRank >= 0 ? `You're #${myRank + 1} of ${rows.length} this month` : '';
  } catch {
    lbStatus.textContent = 'Leaderboard unavailable (offline?)';
  }
}

$('lbSaveBtn').addEventListener('click', async () => {
  const name = lbNameInput.value.trim();
  if (!name) { lbNameInput.focus(); return; }
  sound.click();
  const pending = Number(lbForm.dataset.pendingScore || 0);
  lbForm.dataset.pendingScore = '';
  try {
    await renamePlayer(name); // saves locally + updates any existing rows
    if (pending > 0) await submitScore(pending);
  } catch { /* offline */ }
  renderBoard();
});
lbNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('lbSaveBtn').click();
  e.stopPropagation(); // typing a name must never throw/restart
});
lbRenameBtn.addEventListener('click', () => {
  sound.click();
  lbNameInput.value = getName();
  lbForm.classList.remove('hidden');
  lbRenameBtn.classList.add('hidden');
  lbNameInput.focus();
});
lbThisBtn.addEventListener('click', () => {
  lbMonthOffset = 0;
  lbThisBtn.classList.add('sel');
  lbLastBtn.classList.remove('sel');
  renderBoard();
});
lbLastBtn.addEventListener('click', () => {
  lbMonthOffset = -1;
  lbLastBtn.classList.add('sel');
  lbThisBtn.classList.remove('sel');
  renderBoard();
});

/* ------------------------------------------------------------ input */

function unlockAudio() { sound.unlock(); }

$('startBtn').addEventListener('click', () => {
  unlockAudio();
  sound.click();
  startGame();
});
$('retry').addEventListener('click', (e) => e.stopPropagation());

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  unlockAudio();
  if (state === 'playing') throwSpile();
});

// tap anywhere on the game-over screen to go again — but leaderboard taps
// and links must not restart
gameoverEl.addEventListener('pointerdown', (e) => {
  unlockAudio();
  if (e.target.closest('#lb')) return;
  if (e.target.closest('a')) return;
  if (performance.now() - overAt < 450) return; // ignore leftover rage taps
  startGame();
});

window.addEventListener('keydown', (e) => {
  if (document.activeElement === lbNameInput) return; // typing, not playing
  if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'Enter') {
    e.preventDefault();
    unlockAudio();
    if (state === 'playing') throwSpile();
    else if (state === 'menu') startGame();
    else if (state === 'over' && performance.now() - overAt > 450) startGame();
  } else if (state === 'over' && performance.now() - overAt > 450) {
    unlockAudio();
    startGame();
  }
});

// block scrolling / double-tap zoom during play (menus keep native taps
// so buttons and the name input still get their click events)
['touchmove', 'touchstart'].forEach((ev) =>
  document.addEventListener(ev, (e) => {
    if (state === 'playing' || state === 'failing' || state === 'clearing') e.preventDefault();
  }, { passive: false }));
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

muteBtn.addEventListener('click', () => {
  unlockAudio();
  sound.setMuted(!sound.muted);
  muteBtn.textContent = sound.muted ? '🔇' : '🔊';
});
muteBtn.textContent = sound.muted ? '🔇' : '🔊';

window.addEventListener('resize', () => {
  layout();
  initFlakes();
});

/* ------------------------------------------------------------ go */

layout();
initFlakes();
requestAnimationFrame(frame);
