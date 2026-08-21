/* Flatwater - Bocquet skip + stone geometry */
"use strict";

const ALPHA_STAR = 0.349;
const BETA_MAX = Math.PI * 0.25;
const ALPHA_MAX = 0.70;

function faceGeom() {
  const f = upgrades.face;
  return { R: 0.85 + f * 0.1, e: 1.35 - f * 0.16 };
}
function geomScale() {
  return { sx: 0.72 + stone.R * 0.28, sy: 0.42 + stone.e * 0.42 };
}
function stoneShape() {
  const R = stone.R, e = stone.e;
  return { rx: 10.2 + R * 2.4, ry: Math.max(1.7, 1.15 + e * 2.4), shR: 9.6 + R * 2.1, shH: Math.max(1.15, 0.7 + e * 1.7) };
}
function uMin(a, e, R) {
  const da = a - ALPHA_STAR;
  return 148 * (1 + 5.2 * da * da) * Math.sqrt(Math.max(0.35, e) * 1.05 / Math.max(0.55, R));
}
function skipDv2(a, e, R) {
  const s = Math.sin(a), c = Math.cos(a);
  const mu = (s + 0.85 * c) / Math.max(0.2, c - 0.85 * s);
  return 2 * GRAVITY * mu * 42 * Math.sqrt(Math.max(0.1, e * R * Math.max(0.1, Math.sin(Math.abs(a)))));
}
function throwAttitude(p) {
  const q = qualityOf(p), lo = sweetLo(), hi = sweetHi(), g = faceGeom();
  let alpha = 0.50 - upgrades.face * 0.028;
  alpha += (ALPHA_STAR - alpha) * Math.min(1, (0.52 + upgrades.face * 0.096) * q);
  if (p < lo) alpha = alpha * (0.45 + 0.55 * p / lo) + 0.05;
  if (p > hi) alpha += ((p - hi) / Math.max(0.001, 1 - hi)) * (0.16 + (1 - q) * 0.14);
  let omega = 42 + p * 26 + q * 34 + upgrades.spin * 26;
  if (p < lo) omega *= 0.28 + 0.72 * (p / lo);
  if (p > hi) omega = (10 + upgrades.spin * 10) * (1 - ((p - hi) / Math.max(0.001, 1 - hi)) * 0.48);
  return { q: q, R: g.R, e: g.e, alpha: alpha, omega: omega };
}
const Sfx = {
  ctx: null, osc: null, gain: null,
  ensure: function () {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  },
  tone: function (freq, dur, type, vol, slide) {
    const c = this.ensure();
    if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  },
  noise: function (dur, vol, cutoff) {
    const c = this.ensure();
    if (!c) return;
    const n = Math.max(1, (c.sampleRate * dur) | 0);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = cutoff;
    const g = c.createGain();
    const t = c.currentTime;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(c.destination);
    src.start();
  },
  startCharge: function () {
    const c = this.ensure();
    if (!c || this.osc) return;
    this.osc = c.createOscillator();
    this.gain = c.createGain();
    this.osc.type = "sine";
    this.osc.frequency.value = 150;
    this.gain.gain.value = 0.0;
    this.osc.connect(this.gain);
    this.gain.connect(c.destination);
    this.osc.start();
    this.gain.gain.linearRampToValueAtTime(0.035, c.currentTime + 0.06);
  },
  setCharge: function (p) {
    if (!this.osc) return;
    this.osc.frequency.setValueAtTime(150 + p * 260, this.ctx.currentTime);
    this.gain.gain.setTargetAtTime(0.028 + p * 0.02, this.ctx.currentTime, 0.05);
  },
  stopCharge: function () {
    if (!this.osc) return;
    const c = this.ctx, o = this.osc, g = this.gain;
    this.osc = null; this.gain = null;
    try { g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.05); o.stop(c.currentTime + 0.06); } catch (e) {}
  },
  throw: function () { this.tone(240, 0.16, "triangle", 0.06, 90); this.noise(0.14, 0.05, 900); },
  skip: function (n) { this.tone(700 * Math.pow(0.86, n), 0.11, "triangle", 0.085, 280); this.noise(0.09, 0.055, 1600); },
  sink: function () { this.tone(130, 0.32, "sine", 0.09, 48); this.noise(0.24, 0.09, 420); }
};
function qualityOf(p) {
  const lo = sweetLo(), hi = sweetHi();
  if (p >= lo && p <= hi) {
    const mid = (lo + hi) / 2, half = Math.max(0.001, (hi - lo) / 2);
    return 0.92 + 0.08 * (1 - Math.abs(p - mid) / half);
  }
  if (p < lo) return 0.12 + 0.76 * Math.pow(Math.max(0, Math.min(1, p / lo)), 0.65);
  const over = (p - hi) / Math.max(0.02, 1 - hi);
  return Math.max(0.20, 0.35 - over * 0.15);
}
function addRipple(x, strong) {
  ripples.push({ x: x, r: 4, max: strong ? 78 : 48, a: strong ? 0.55 : 0.38, w: strong ? 1.6 : 1.1 });
  if (ripples.length > 18) ripples.shift();
}
function addSpray(x, y, vx, n) {
  const arm = upgrades.arm;
  const count = n + Math.round(n * 0.35 * arm);
  const sizeBoost = 1 + arm * 0.2;
  for (let i = 0; i < count; i++) {
    spray.push({
      x: x + (Math.random() - 0.5) * (8 + arm * 2),
      y: y - Math.random() * (4 + arm),
      vx: vx * (0.15 + arm * 0.02) + (Math.random() - 0.5) * (70 + arm * 12),
      vy: -30 - Math.random() * (90 + arm * 18),
      life: 0.35 + Math.random() * 0.35 + arm * 0.04,
      s: sizeBoost
    });
  }
  const cap = 60 + arm * 16;
  if (spray.length > cap) spray.splice(0, spray.length - cap);
}
function trySkip() {
  const vx = stone.vx, vy = stone.vy;
  const U = Math.hypot(vx, vy);
  const beta = Math.atan2(vy, Math.max(vx, 1));
  const a = stone.alpha, om = Math.abs(stone.omega), e = stone.e, R = stone.R;
  if (beta > BETA_MAX || U < uMin(a, e, R) || a < 0.06 || a > ALPHA_MAX) { sink(); return; }
  const dv2 = skipDv2(a, e, R);
  if (vx * vx <= dv2) { sink(); return; }
  stone.vx = Math.sqrt(vx * vx - dv2);
  stone.vy = -Math.abs(vy) * 0.96;
  stone.y = -1.15;
  const dTh = GRAVITY / (Math.max(0.4, R) * Math.max(90, om * om));
  stone.alpha += dTh + (0.012 + 0.03 * Math.max(0, a - ALPHA_STAR)) * (28 / Math.max(16, om));
  stone.omega *= 0.97;
  stone.spin = stone.omega;
  const sc = geomScale();
  stone.tsx = sc.sx * 1.06;
  stone.tsy = sc.sy * 0.9;
  skips += 1;
  maxX = Math.max(maxX, stone.x);
  score = skips * 10 + Math.round(maxX * 0.12);
  elScore.textContent = String(score);
  cam.kick = -Math.min(22 + upgrades.arm * 6, 8 + skips * 0.5 + upgrades.arm * 3.8);
  cam.roll = (Math.random() < 0.5 ? -1 : 1) * (0.012 + upgrades.arm * 0.004);
  const wet = U * U * e * R;
  addRipple(stone.x, wet > 160000);
  addRipple(stone.x + 8, false);
  addSpray(stone.x, 0, stone.vx, Math.max(3, Math.round(3 + U * 0.016)));
  scratches.push({ x: stone.x, life: 0.5 });
  if (upgrades.spin > 0) {
    spinRings.push({ x: stone.x, r: 10, a: 0.22 + upgrades.spin * 0.07, life: 0.32 + upgrades.spin * 0.05 });
  }
  Sfx.skip(skips);
  if (Math.abs(stone.vy) < 11 && stone.vx < 48) sink();
}
function applyThrowAttitude(att) {
  stone.R = att.R; stone.e = att.e; stone.alpha = att.alpha; stone.alphaDot = 0;
  stone.omega = att.omega; stone.phi = 0; stone.spin = att.omega; stone.rot = -stone.alpha;
}
function resetStoneGeom() {
  const g = faceGeom();
  const sc = { sx: 0.72 + g.R * 0.28, sy: 0.42 + g.e * 0.42 };
  stone.R = g.R; stone.e = g.e; stone.alpha = ALPHA_STAR; stone.alphaDot = 0;
  stone.omega = 0; stone.phi = 0; stone.rot = -stone.alpha; stone.spin = 0;
  stone.sx = sc.sx; stone.sy = sc.sy; stone.tsx = sc.sx; stone.tsy = sc.sy;
}
function stepStoneFlight(dt) {
  stone.vy += GRAVITY * dt;
  stone.vx += wind * dt;
  stone.vx *= 1 - 0.05 * dt;
  stone.x += stone.vx * dt;
  stone.y += stone.vy * dt;
  stone.omega *= 1 - 0.018 * dt;
  stone.spin = stone.omega;
  stone.phi += stone.omega * dt;
  const omA = Math.abs(stone.omega);
  if (omA > 48) stone.alphaDot = Math.sin(stone.phi * 0.65) * (10 / omA);
  else stone.alphaDot += (1.15 + (48 - omA) * 0.05) * dt;
  stone.alpha += stone.alphaDot * dt;
  stone.rot = -stone.alpha + Math.sin(stone.phi * 2.1) * (omA > 48 ? 0.018 : 0.07);
  if (upgrades.spin > 0) {
    trail.push({ x: stone.x, y: stone.y, rot: stone.rot, sx: stone.sx, sy: stone.sy, life: 0.10 + upgrades.spin * 0.045 });
    const maxT = 3 + upgrades.spin * 3;
    if (trail.length > maxT) trail.shift();
  }
  maxX = Math.max(maxX, stone.x);
  cam.tx = stone.x - 80;
  cam.ty = Math.max(-30, Math.min(20, stone.y * 0.15));
  if (stone.y >= WATER_Y && stone.vy > 0) trySkip();
  if (stone.x > 9600 || stone.y > 80) sink();
}
function stepStoneReady() {
  const g = faceGeom();
  stone.R = g.R; stone.e = g.e; stone.alpha = ALPHA_STAR;
  stone.y = -16 + Math.sin(performance.now() * 0.0018) * 0.6;
  stone.rot = -stone.alpha;
}
function stepStoneCharge() {
  const att = throwAttitude(Math.max(0.06, charge));
  stone.R = att.R; stone.e = att.e; stone.alpha = att.alpha; stone.omega = att.omega;
  stone.rot = -stone.alpha;
}
function stepStoneSunk(dt) {
  stone.alpha += dt * (1.2 + (1 - Math.min(1, Math.abs(stone.omega) / 40)));
  stone.phi += stone.omega * dt;
  stone.rot = -stone.alpha;
}
function seedStars() {
  stars.length = 0;
  for (let i = 0; i < 90; i++) stars.push({ x: Math.random(), y: Math.random() * 0.52, r: Math.random() * 1.1 + 0.2, a: Math.random() * 0.45 + 0.08, tw: Math.random() * Math.PI * 2 });
}
