// TAP THE MAPLE — level configs and spin-pattern generation.
// Every 5th level is a boss log with its own look and spin personality.

const TAU = Math.PI * 2;
const BOSSES = [
  { name: 'OLD GROWTH',               style: 'oldgrowth' },
  { name: 'FROZEN LOG',               style: 'frozen' },
  { name: 'THE LEGENDARY SUGAR MAPLE', style: 'legendary' },
];

// Random angles with a minimum angular separation from everything placed so far.
function placeAngles(count, taken, minSep) {
  const out = [];
  for (let i = 0; i < count; i++) {
    let a = 0, ok = false;
    for (let tries = 0; tries < 60 && !ok; tries++) {
      a = Math.random() * TAU;
      ok = [...taken, ...out].every((b) => {
        const d = Math.abs(a - b) % TAU;
        return Math.min(d, TAU - d) > minSep;
      });
    }
    if (ok) out.push(a);
  }
  return out;
}

export function levelConfig(n) {
  const boss = n % 5 === 0 ? BOSSES[Math.floor((n / 5 - 1) % BOSSES.length)] : null;
  const bossLap = Math.floor((n - 1) / (BOSSES.length * 5)); // bosses get meaner each cycle

  let spiles = Math.min(6 + Math.floor(n * 0.55), 13);
  let knots = n < 3 ? 0 : Math.min(3, 1 + Math.floor((n - 3) / 5) + (Math.random() < 0.35 ? 1 : 0));
  let preSpiles = n < 4 ? 0 : Math.min(3, Math.floor(Math.random() * (n >= 9 ? 4 : 3)));
  let saps = Math.random() < 0.72 ? 1 + (Math.random() < 0.3 ? 1 : 0) : 0;

  // spin personality
  let speed = Math.min(1.25 + n * 0.11, 3.4);
  let pat = {
    reverseP: Math.min(0.2 + n * 0.045, 0.6),  // chance a new segment flips direction
    pauseP: n >= 6 ? 0.1 : 0,                   // chance of a dead stop
    burstP: n >= 4 ? 0.16 : 0,                  // chance of a speed burst
    segMin: Math.max(0.55, 1.5 - n * 0.06),
    segMax: Math.max(1.0, 2.2 - n * 0.07),
  };

  if (boss) {
    spiles = Math.min(spiles + 2, 15);
    preSpiles = 0;
    saps = 1;
    speed *= 1 + bossLap * 0.18;
    if (boss.style === 'oldgrowth') {        // gnarled: slow, heavy, knot-riddled
      knots = 4;
      speed *= 0.85;
      pat = { ...pat, reverseP: 0.65, pauseP: 0.05, burstP: 0.1 };
    } else if (boss.style === 'frozen') {    // icy: fast spins, sudden freezes
      knots = 2;
      speed *= 1.3;
      pat = { ...pat, reverseP: 0.35, pauseP: 0.38, burstP: 0.15, segMin: 0.4, segMax: 1.1 };
    } else {                                  // legendary: chaos incarnate
      knots = 3;
      speed *= 1.2;
      pat = { ...pat, reverseP: 0.7, pauseP: 0.15, burstP: 0.35, segMin: 0.35, segMax: 0.9 };
    }
  }

  // lay out the log: knots, pre-stuck spiles, sap drops — none overlapping
  const knotAngles = placeAngles(knots, [], 0.55);
  const preAngles = placeAngles(preSpiles, knotAngles, 0.5);
  const sapAngles = placeAngles(saps, [...knotAngles, ...preAngles], 0.5);

  return {
    n,
    boss: boss ? { ...boss, lap: bossLap } : null,
    style: boss ? boss.style : 'normal',
    spiles,
    knotAngles,
    preAngles,
    sapAngles,
    speed,
    pat,
  };
}

// Rolling spin-pattern state machine. Call step(dt); read .vel.
export class SpinPattern {
  constructor(cfg) {
    this.cfg = cfg;
    this.dir = Math.random() < 0.5 ? 1 : -1;
    this.vel = cfg.speed * this.dir;
    this.target = this.vel;
    this.timer = 0.8;
  }
  step(dt) {
    this.timer -= dt;
    if (this.timer <= 0) this.nextSegment();
    // ease toward the target speed so changes feel mechanical, not teleport-y
    this.vel += (this.target - this.vel) * Math.min(1, dt * 9);
    return this.vel;
  }
  nextSegment() {
    const { speed, pat } = this.cfg;
    const r = Math.random();
    if (r < pat.pauseP) {
      this.target = 0;
      this.timer = 0.25 + Math.random() * 0.35;
      return;
    }
    if (Math.random() < pat.reverseP) this.dir *= -1;
    let s = speed * (0.75 + Math.random() * 0.5);
    if (Math.random() < pat.burstP) s *= 1.8;
    this.target = s * this.dir;
    this.timer = pat.segMin + Math.random() * (pat.segMax - pat.segMin);
  }
}
