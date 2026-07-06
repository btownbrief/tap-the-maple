// TAP THE MAPLE — all canvas art, drawn in code. No image assets.

const TAU = Math.PI * 2;

// tiny seeded PRNG so each log face is stable while it exists
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* Snowy sugarbush background: dusk sky, hills, maples with buckets,   */
/* pines, and a sugarhouse (steam animates in main).                   */
/* ------------------------------------------------------------------ */
export function makeBackground(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  const rnd = mulberry(w * 7919 + h);

  // dusk sky
  const sky = x.createLinearGradient(0, 0, 0, h * 0.78);
  sky.addColorStop(0, '#241832');
  sky.addColorStop(0.45, '#4b2a44');
  sky.addColorStop(0.8, '#93504a');
  sky.addColorStop(1, '#d98d5f');
  x.fillStyle = sky;
  x.fillRect(0, 0, w, h * 0.78);

  // stars
  x.fillStyle = 'rgba(255,243,224,0.7)';
  for (let i = 0; i < 40; i++) {
    const sy = rnd() * h * 0.4;
    x.globalAlpha = 0.2 + rnd() * 0.6;
    x.fillRect(rnd() * w, sy, 1.5, 1.5);
  }
  x.globalAlpha = 1;

  // far hills
  const horizon = h * 0.74;
  x.fillStyle = '#3a2238';
  hill(x, w, horizon, h * 0.1, 0.7, rnd);
  x.fillStyle = '#2f1c30';
  hill(x, w, horizon + h * 0.015, h * 0.065, 1.3, rnd);

  // snow ground
  const snow = x.createLinearGradient(0, horizon, 0, h);
  snow.addColorStop(0, '#e8d9e2');
  snow.addColorStop(0.25, '#dfe4ee');
  snow.addColorStop(1, '#c3ccdc');
  x.fillStyle = snow;
  x.fillRect(0, horizon, w, h - horizon);
  // drifts
  x.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i = 0; i < 5; i++) {
    const dy = horizon + (h - horizon) * (0.2 + rnd() * 0.7);
    x.beginPath();
    x.ellipse(rnd() * w, dy, 40 + rnd() * 90, 5 + rnd() * 7, 0, 0, TAU);
    x.fill();
  }

  // pines along the horizon
  for (let i = 0; i < 9; i++) {
    const px = (i + 0.2 + rnd() * 0.6) * (w / 9);
    pine(x, px, horizon + 4 + rnd() * 8, 14 + rnd() * 16, '#22301f');
  }

  // tapped maples, left and right (keep the center clear for the log)
  const maplesAt = [0.07, 0.16, 0.86, 0.95];
  for (const fx of maplesAt) {
    maple(x, fx * w, horizon + (h - horizon) * (0.35 + rnd() * 0.3), h, rnd);
  }

  // sugarhouse, bottom-left
  const shX = w * 0.13, shY = h * 0.9;
  const chimney = sugarhouse(x, shX, shY, Math.min(w, h) * 0.16);

  return { canvas: c, chimney };
}

function hill(x, w, baseY, amp, freq, rnd) {
  const off = rnd() * 10;
  x.beginPath();
  x.moveTo(0, baseY + amp);
  for (let px = 0; px <= w; px += 8) {
    x.lineTo(px, baseY - Math.sin(px / w * Math.PI * freq + off) * amp);
  }
  x.lineTo(w, baseY + amp * 3);
  x.lineTo(0, baseY + amp * 3);
  x.fill();
}

function pine(x, px, baseY, size, color) {
  x.fillStyle = color;
  for (let t = 0; t < 3; t++) {
    const wD = size * (1 - t * 0.26), yT = baseY - size * 0.5 - t * size * 0.42;
    x.beginPath();
    x.moveTo(px, yT - size * 0.55);
    x.lineTo(px - wD / 2, yT);
    x.lineTo(px + wD / 2, yT);
    x.fill();
  }
  x.fillRect(px - size * 0.06, baseY - size * 0.2, size * 0.12, size * 0.25);
  // snow cap
  x.fillStyle = 'rgba(255,255,255,0.55)';
  x.beginPath();
  x.moveTo(px, baseY - size * 1.85);
  x.lineTo(px - size * 0.16, baseY - size * 1.5);
  x.lineTo(px + size * 0.16, baseY - size * 1.5);
  x.fill();
}

function maple(x, px, baseY, h, rnd) {
  const trunkH = h * (0.16 + rnd() * 0.05), tw = 7 + rnd() * 4;
  x.strokeStyle = '#2e1d16';
  x.fillStyle = '#2e1d16';
  x.fillRect(px - tw / 2, baseY - trunkH, tw, trunkH);
  // bare winter branches
  x.lineWidth = 2.5;
  for (let b = 0; b < 4; b++) {
    const by = baseY - trunkH + b * 6 - 8, dir = b % 2 ? 1 : -1;
    x.beginPath();
    x.moveTo(px, by);
    x.quadraticCurveTo(px + dir * 12, by - 14, px + dir * (18 + rnd() * 12), by - 24 - rnd() * 10);
    x.stroke();
  }
  // spile + hanging sap bucket
  const bY = baseY - trunkH * 0.45;
  x.fillStyle = '#8b8f94';
  x.fillRect(px + tw / 2 - 1, bY, 6, 2.5);
  x.fillStyle = '#4d6a80';
  x.fillRect(px + tw / 2 + 1, bY + 2.5, 9, 11);
  x.fillStyle = 'rgba(255,255,255,0.4)';
  x.fillRect(px + tw / 2 + 1, bY + 2.5, 9, 2);
}

function sugarhouse(x, sx, sy, s) {
  // s = width of the house
  const hH = s * 0.55;
  // body
  x.fillStyle = '#4a2c1c';
  x.fillRect(sx - s / 2, sy - hH, s, hH);
  // roof
  x.fillStyle = '#33201a';
  x.beginPath();
  x.moveTo(sx - s * 0.6, sy - hH);
  x.lineTo(sx, sy - hH - s * 0.34);
  x.lineTo(sx + s * 0.6, sy - hH);
  x.fill();
  // snow on roof
  x.strokeStyle = 'rgba(255,255,255,0.75)';
  x.lineWidth = 3.5;
  x.beginPath();
  x.moveTo(sx - s * 0.55, sy - hH - 2);
  x.lineTo(sx, sy - hH - s * 0.34 - 2);
  x.lineTo(sx + s * 0.55, sy - hH - 2);
  x.stroke();
  // glowing window
  x.fillStyle = '#ffc95e';
  x.fillRect(sx - s * 0.16, sy - hH * 0.62, s * 0.3, hH * 0.34);
  x.fillStyle = '#4a2c1c';
  x.fillRect(sx - s * 0.02, sy - hH * 0.62, s * 0.035, hH * 0.34);
  x.fillRect(sx - s * 0.16, sy - hH * 0.47, s * 0.3, hH * 0.05);
  // window glow
  const glow = x.createRadialGradient(sx, sy - hH * 0.45, 2, sx, sy - hH * 0.45, s * 0.5);
  glow.addColorStop(0, 'rgba(255,201,94,0.28)');
  glow.addColorStop(1, 'rgba(255,201,94,0)');
  x.fillStyle = glow;
  x.fillRect(sx - s, sy - hH - s, s * 2, hH + s);
  // cupola chimney (steam vents from here)
  const cx = sx + s * 0.18, cy = sy - hH - s * 0.3;
  x.fillStyle = '#33201a';
  x.fillRect(cx - s * 0.07, cy, s * 0.14, s * 0.18);
  return { x: cx, y: cy };
}

/* ------------------------------------------------------------------ */
/* End-grain maple log face, pre-rendered per level.                   */
/* style: { face, ring, bark, glow } colors; knots baked in.           */
/* ------------------------------------------------------------------ */
export const LOG_STYLES = {
  normal:    { face: '#d8b57e', face2: '#c9a266', ring: '#a97e4c', bark: '#5b3a24', bark2: '#3f2717', glow: null },
  oldgrowth: { face: '#b98d5a', face2: '#a67a48', ring: '#7e5730', bark: '#3c2415', bark2: '#241207', glow: null },
  frozen:    { face: '#cfd8e0', face2: '#b9c6d4', ring: '#8fa5b8', bark: '#46586b', bark2: '#2c3a4a', glow: 'rgba(160,210,255,0.5)' },
  legendary: { face: '#ecc57e', face2: '#dfae5c', ring: '#b07f35', bark: '#6b3c14', bark2: '#472507', glow: 'rgba(255,201,94,0.65)' },
};

export function makeLogFace(R, styleName, knots, seed) {
  const st = LOG_STYLES[styleName] || LOG_STYLES.normal;
  const barkW = Math.max(9, R * 0.13);
  const size = Math.ceil((R + barkW) * 2) + 8;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  const rnd = mulberry(seed);
  const cx = size / 2, cy = size / 2;
  x.translate(cx, cy);

  // bark: irregular dark ring
  x.beginPath();
  for (let i = 0; i <= 72; i++) {
    const a = i / 72 * TAU;
    const rr = R + barkW * (0.75 + 0.25 * Math.sin(a * 9 + seed) + rnd() * 0.12);
    i ? x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : x.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  x.closePath();
  const barkG = x.createRadialGradient(0, 0, R * 0.9, 0, 0, R + barkW);
  barkG.addColorStop(0, st.bark);
  barkG.addColorStop(1, st.bark2);
  x.fillStyle = barkG;
  x.fill();
  // bark nicks
  x.strokeStyle = 'rgba(0,0,0,0.35)';
  x.lineWidth = 2;
  for (let i = 0; i < 26; i++) {
    const a = rnd() * TAU, r1 = R + barkW * 0.15, r2 = R + barkW * (0.5 + rnd() * 0.45);
    x.beginPath();
    x.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
    x.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
    x.stroke();
  }

  // face
  const faceG = x.createRadialGradient(-R * 0.25, -R * 0.25, R * 0.1, 0, 0, R);
  faceG.addColorStop(0, st.face);
  faceG.addColorStop(1, st.face2);
  x.beginPath();
  x.arc(0, 0, R, 0, TAU);
  x.fillStyle = faceG;
  x.fill();

  // growth rings with organic wobble
  const rings = 8 + Math.floor(rnd() * 3);
  const wobF = 3 + Math.floor(rnd() * 3);
  x.strokeStyle = st.ring;
  for (let ri = 1; ri <= rings; ri++) {
    const base = R * (ri / (rings + 0.6)) * (0.96 + rnd() * 0.07);
    x.globalAlpha = 0.28 + rnd() * 0.3;
    x.lineWidth = 1 + rnd() * 1.6;
    x.beginPath();
    for (let i = 0; i <= 64; i++) {
      const a = i / 64 * TAU;
      const rr = base + Math.sin(a * wobF + ri * 1.7 + seed) * R * 0.02;
      i ? x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : x.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    x.closePath();
    x.stroke();
  }
  x.globalAlpha = 1;
  // pith
  x.fillStyle = st.ring;
  x.globalAlpha = 0.7;
  x.beginPath();
  x.arc(R * 0.03, -R * 0.02, R * 0.035, 0, TAU);
  x.fill();
  x.globalAlpha = 1;

  // hairline cracks
  x.strokeStyle = 'rgba(0,0,0,0.18)';
  x.lineWidth = 1.4;
  for (let i = 0; i < 3; i++) {
    const a = rnd() * TAU;
    x.beginPath();
    x.moveTo(Math.cos(a) * R * 0.15, Math.sin(a) * R * 0.15);
    x.quadraticCurveTo(
      Math.cos(a + 0.15) * R * 0.55, Math.sin(a + 0.15) * R * 0.55,
      Math.cos(a) * R * 0.92, Math.sin(a) * R * 0.92);
    x.stroke();
  }

  // knots (obstacles) — baked into the face so they spin with it
  for (const ka of knots) {
    const kr = R * 0.8;
    const kx = Math.cos(ka) * kr, ky = Math.sin(ka) * kr;
    x.save();
    x.translate(kx, ky);
    x.rotate(ka + Math.PI / 2);
    const kw = R * 0.16, kh = R * 0.12;
    const kg = x.createRadialGradient(0, 0, 1, 0, 0, kw);
    kg.addColorStop(0, '#241207');
    kg.addColorStop(0.55, '#3c2415');
    kg.addColorStop(1, '#241207');
    x.fillStyle = kg;
    x.beginPath();
    x.ellipse(0, 0, kw, kh, 0, 0, TAU);
    x.fill();
    x.strokeStyle = 'rgba(216,181,126,0.5)';
    x.lineWidth = 1.5;
    for (const f of [0.65, 0.85]) {
      x.beginPath();
      x.ellipse(0, 0, kw * f, kh * f, 0, 0, TAU);
      x.stroke();
    }
    x.restore();
  }

  // frost sparkle for the Frozen Log
  if (styleName === 'frozen') {
    x.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 34; i++) {
      const a = rnd() * TAU, rr = rnd() * R;
      x.globalAlpha = 0.25 + rnd() * 0.5;
      x.fillRect(Math.cos(a) * rr, Math.sin(a) * rr, 2, 2);
    }
    x.globalAlpha = 1;
  }

  return { canvas: c, half: size / 2, barkW, glow: st.glow };
}

/* ------------------------------------------------------------------ */
/* Sap spile sprite: tip at top (0,0), shaft extends down to (0,len).  */
/* ------------------------------------------------------------------ */
export function makeSpileSprite(len, rusty = false) {
  const w = 26;
  const c = document.createElement('canvas');
  c.width = w; c.height = len + 6;
  const x = c.getContext('2d');
  x.translate(w / 2, 2);

  const body = rusty ? ['#9c7a5a', '#6e523c'] : ['#dfe4ea', '#8b929b'];
  const line = rusty ? '#4a3423' : '#4c545e';

  // tapered shaft: tip -> body
  const g = x.createLinearGradient(-6, 0, 6, 0);
  g.addColorStop(0, body[0]);
  g.addColorStop(0.45, body[0]);
  g.addColorStop(1, body[1]);
  x.fillStyle = g;
  x.strokeStyle = line;
  x.lineWidth = 1.6;
  x.beginPath();
  x.moveTo(0, 0);                    // tip
  x.lineTo(3.2, len * 0.16);
  x.lineTo(4.4, len * 0.72);
  x.lineTo(6.4, len * 0.78);         // flange where the bucket hooks on
  x.lineTo(6.4, len * 0.84);
  x.lineTo(3.6, len * 0.86);
  x.lineTo(3.6, len);
  x.lineTo(-3.6, len);
  x.lineTo(-3.6, len * 0.86);
  x.lineTo(-6.4, len * 0.84);
  x.lineTo(-6.4, len * 0.78);
  x.lineTo(-4.4, len * 0.72);
  x.lineTo(-3.2, len * 0.16);
  x.closePath();
  x.fill();
  x.stroke();
  // spout hole at the base
  x.fillStyle = line;
  x.beginPath();
  x.ellipse(0, len - 3.5, 2.6, 1.8, 0, 0, TAU);
  x.fill();
  // highlight
  x.strokeStyle = 'rgba(255,255,255,0.55)';
  x.lineWidth = 1.4;
  x.beginPath();
  x.moveTo(-1.6, len * 0.1);
  x.lineTo(-2.4, len * 0.75);
  x.stroke();

  return { canvas: c, w, len, ox: w / 2, oy: 2 };
}

/* Amber sap drop, drawn at (0,0) pointing outward (+y). r ~ size. */
export function drawSapDrop(x, r, wob = 0) {
  x.save();
  x.rotate(Math.sin(wob) * 0.12);
  const g = x.createRadialGradient(-r * 0.3, r * 0.2, r * 0.15, 0, r * 0.3, r * 1.6);
  g.addColorStop(0, '#ffd97a');
  g.addColorStop(0.6, '#e8a33a');
  g.addColorStop(1, '#b06e14');
  x.fillStyle = g;
  x.beginPath();
  x.moveTo(0, -r * 0.9);
  x.bezierCurveTo(r, 0, r * 0.9, r, 0, r * 1.15);
  x.bezierCurveTo(-r * 0.9, r, -r, 0, 0, -r * 0.9);
  x.fill();
  x.fillStyle = 'rgba(255,255,255,0.75)';
  x.beginPath();
  x.ellipse(-r * 0.3, 0, r * 0.18, r * 0.3, -0.4, 0, TAU);
  x.fill();
  x.restore();
}
