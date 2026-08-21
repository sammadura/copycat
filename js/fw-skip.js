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
