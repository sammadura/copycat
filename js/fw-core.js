/* Flatwater */
"use strict";
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d", { alpha: false });
const elScore = document.getElementById("score");
const elBest = document.getElementById("best");
const elHint = document.getElementById("hint");
const elResult = document.getElementById("result");
const elMeter = document.getElementById("meter");
const elFill = document.getElementById("fill");
const elWind = document.getElementById("wind");
const elPebbles = document.getElementById("pebbles");
const elShopPebbles = document.getElementById("shop-pebbles");
const elShopRoot = document.getElementById("shop-root");
const elShopBtn = document.getElementById("shop-btn");
const elShopClose = document.getElementById("shop-close");
const elShopBackdrop = document.getElementById("shop-backdrop");
const elStatPebbles = document.getElementById("stat-pebbles");
const elSweet = document.querySelector(".sweet");
const BEST_KEY = "flatwater.best";
const PEBBLES_KEY = "flatwater.pebbles";
const UPGRADES_KEY = "flatwater.upgrades";
const CLEARED_KEY = "flatwater.cleared";
const BASE_SWEET_LO = 0.72;
const BASE_SWEET_HI = 0.88;
const BASE_CHARGE = 0.92;
const MAX_LV = 5;
const COSTS = [20, 48, 110, 240, 520];
const FAR_SHORE = 2200;
const UPGRADE_IDS = ["face", "spin", "arm", "eye", "hold"];
const GRAVITY = 380;
const WATER_Y = 0;
let W = 0, H = 0, dpr = 1;
let waterScreen = 0;
let scale = 1;
const cam = { x: 0, y: 0, tx: 0, ty: 0, kick: 0, roll: 0 };
const stone = {
  x: 0, y: -16, vx: 0, vy: 0,
  rot: -0.349, spin: 0, sx: 1, sy: 1, tsx: 1, tsy: 1,
  sinking: 0, visible: true, alpha: 0.349, alphaDot: 0, omega: 0, phi: 0,
  R: 0.85, e: 1.35
};
let state = "ready";
let charge = 0;
let chargeDir = 1;
const AIM_LO = -0.90;
const AIM_HI = 0.48;
const AIM_DEFAULT = 0.22;
let aimAngle = AIM_DEFAULT;
let wind = 0, skips = 0, maxX = 0, score = 0, best = 0;
let thrownOnce = false, resultTimer = 0, lastT = 0;
let holding = false, holdPointer = false, holdSpace = false;
let throwQ = 0.6, pebbles = 0;
let upgrades = { face: 0, spin: 0, arm: 0, eye: 0, hold: 0 };
let shopOpen = false, cleared = false;
const ripples = [];
const spray = [];
const scratches = [];
const stars = [];
const ambient = [];
const trail = [];
const spinRings = [];
const ridges = {
  far: makeRidge(0.22, 1.15, 0.62),
  mid: makeRidge(0.34, 0.92, 0.48),
  near: makeRidge(0.18, 0.7, 0.38)
};
function persist() {
  try {
    localStorage.setItem(BEST_KEY, String(best));
    localStorage.setItem(PEBBLES_KEY, String(pebbles));
    localStorage.setItem(UPGRADES_KEY, JSON.stringify({
      v: 2, face: upgrades.face, spin: upgrades.spin, arm: upgrades.arm, eye: upgrades.eye, hold: upgrades.hold
    }));
    if (cleared) localStorage.setItem(CLEARED_KEY, "1");
  } catch (e) {}
}
try { best = parseInt(localStorage.getItem(BEST_KEY) || "0", 10) || 0; } catch (e) { best = 0; }
try { pebbles = parseInt(localStorage.getItem(PEBBLES_KEY) || "0", 10) || 0; } catch (e) { pebbles = 0; }
try { cleared = localStorage.getItem(CLEARED_KEY) === "1"; } catch (e) { cleared = false; }
try {
  const raw = JSON.parse(localStorage.getItem(UPGRADES_KEY) || "{}");
  if (raw.v !== 2) { upgrades = { face: 0, spin: 0, arm: 0, eye: 0, hold: 0 }; persist(); }
  else {
    UPGRADE_IDS.forEach(function (id) {
      const n = parseInt(raw && raw[id], 10);
      upgrades[id] = isFinite(n) ? Math.max(0, Math.min(MAX_LV, n)) : 0;
    });
  }
} catch (e) {}
elBest.textContent = String(best);
if (elPebbles) elPebbles.textContent = String(pebbles);
function sweetLo() { return Math.max(0.28, BASE_SWEET_LO - 0.02 * upgrades.eye); }
function sweetHi() { return Math.min(0.94, BASE_SWEET_HI + 0.02 * upgrades.eye); }
function chargeTime() { return BASE_CHARGE + 0.18 * upgrades.hold; }
function totalLevels() { return upgrades.face + upgrades.spin + upgrades.arm + upgrades.eye + upgrades.hold; }
function allMaxed() { return totalLevels() >= MAX_LV * 5; }
function applyScale() { scale = Math.max(0.85, Math.min(1.15, (W || 900) / 900)) / (1 + 0.07 * totalLevels()); }
function markClearedHud() {
  const wm = document.getElementById("wordmark");
  if (wm) wm.classList.toggle("cleared", !!cleared);
}
function refreshHint() {
  if (!elHint || cleared || thrownOnce) return;
  elHint.textContent = allMaxed() ? "The far shore is out there" : "Hold — the bar swings. Release on gold.";
  elHint.classList.remove("gone"); elHint.classList.add("show");
}
function refreshPebbles() {
  if (elPebbles) elPebbles.textContent = String(pebbles);
  if (elShopPebbles) elShopPebbles.textContent = String(pebbles);
}
function applySweetBand() {
  if (!elSweet) return;
  const lo = sweetLo(), hi = sweetHi();
  elSweet.style.left = (lo * 100).toFixed(2) + "%";
  elSweet.style.width = ((hi - lo) * 100).toFixed(2) + "%";
  const e = upgrades.eye;
  elSweet.className = "sweet" + (e ? " eye-" + e : "");
  if (e) {
    elSweet.style.boxShadow = "0 0 " + (6 + e * 3.2) + "px " + (e * 0.75).toFixed(1) + "px rgba(232, 149, 74, " + (0.34 + e * 0.11).toFixed(2) + ")";
    elSweet.style.background = "rgba(232, 149, 74, " + (0.55 + e * 0.07).toFixed(2) + ")";
  } else { elSweet.style.boxShadow = ""; elSweet.style.background = ""; }
}
function applyLook() {
  applySweetBand();
  const track = document.querySelector("#meter .track");
  if (track) {
    track.setAttribute("data-hold", String(upgrades.hold));
    if (upgrades.hold > 0) track.classList.add("ticks"); else track.classList.remove("ticks");
    track.style.setProperty("--tick-gap", (16 - upgrades.hold * 2) + "px");
  }
  if (document.body) {
    document.body.setAttribute("data-eye", String(upgrades.eye));
    document.body.setAttribute("data-hold", String(upgrades.hold));
    document.body.setAttribute("data-face", String(upgrades.face));
    document.body.setAttribute("data-spin", String(upgrades.spin));
    document.body.setAttribute("data-arm", String(upgrades.arm));
  }
  applyScale(); markClearedHud();
}
function chargeDrawOffset() {
  if (state !== "charging" || !upgrades.hold) return { x: 0, y: 0 };
  return { x: -charge * (3.5 + upgrades.hold * 2.4), y: -charge * upgrades.hold * 0.7 };
}
function nextCost(lv) { return lv >= MAX_LV ? null : COSTS[lv]; }
function renderShop() {
  refreshPebbles();
  const rows = document.querySelectorAll(".shop-row");
  for (let i = 0; i < rows.length; i++) {
    const id = rows[i].getAttribute("data-upgrade");
    const lv = upgrades[id] || 0, cost = nextCost(lv);
    const levelEl = rows[i].querySelector(".shop-level");
    const buyEl = rows[i].querySelector(".shop-buy");
    if (levelEl) levelEl.textContent = lv + " / " + MAX_LV;
    if (!buyEl) continue;
    if (cost == null) { buyEl.textContent = "MAX"; buyEl.disabled = true; }
    else { buyEl.textContent = String(cost); buyEl.disabled = pebbles < cost; }
  }
}
function openShop() {
  shopOpen = true; renderShop();
  elShopRoot.classList.add("open"); elShopRoot.setAttribute("aria-hidden", "false");
}
function closeShop() {
  shopOpen = false; elShopRoot.classList.remove("open"); elShopRoot.setAttribute("aria-hidden", "true");
}
function buyUpgrade(id) {
  if (UPGRADE_IDS.indexOf(id) < 0) return;
  const lv = upgrades[id] || 0, cost = nextCost(lv);
  if (cost == null || pebbles < cost) return;
  pebbles -= cost; upgrades[id] = lv + 1; persist(); applyLook(); renderShop();
  if (allMaxed() && !cleared && !thrownOnce) refreshHint();
  else if (allMaxed() && !cleared) {
    elHint.textContent = "The far shore is out there";
    elHint.classList.remove("gone"); elHint.classList.add("show");
  }
}
function makeRidge(amp, freq, seed) {
  const pts = [];
  for (let i = 0; i <= 48; i++) {
    const t = i / 48;
    const n = Math.sin(t * Math.PI * freq * 2 + seed * 9) * amp +
      Math.sin(t * Math.PI * freq * 5.3 + seed * 3) * amp * 0.35 +
      Math.sin(t * Math.PI * 17 + seed) * amp * 0.08;
    pts.push({ t: t, n: n });
  }
  if (seed > 0.4 && seed < 0.55) { pts[18].n += 0.16; pts[19].n += 0.28; pts[20].n += 0.14; }
  return pts;
}
function rollWind() {
  wind = (Math.random() * 2 - 1) * 22;
  if (Math.abs(wind) < 4) wind = 0;
  elWind.textContent = !wind ? "still air" : (wind > 0 ? "tailwind  ››" : "‹‹  headwind");
}
