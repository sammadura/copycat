/* Flatwater — stone skipping on a dusk lake. Vanilla, one screen. */
(function () {
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
  const BASE_SWEET_LO = 0.72;
  const BASE_SWEET_HI = 0.88;
  const BASE_CHARGE = 0.92;
  const SKIP_THETA_CRIT = 0.38;
  const SKIP_V_MIN = 74;
  const SKIP_VX_MIN = 28;
  const MAX_LV = 5;
  const COSTS = [8, 16, 28, 48, 80];
  const UPGRADE_IDS = ["face", "spin", "arm", "eye", "hold"];
  const GRAVITY = 380;
  const WATER_Y = 0;

  let W = 0, H = 0, dpr = 1;
  let waterScreen = 0;
  let scale = 1;

  const cam = { x: 0, y: 0, tx: 0, ty: 0, kick: 0, roll: 0 };
  const stone = {
    x: 0, y: -16, vx: 0, vy: 0,
    rot: -0.22, spin: 0,
    sx: 1, sy: 1,
    tsx: 1, tsy: 1,
    sinking: 0, visible: true
  };

  let state = "ready";
  let charge = 0;
  let wind = 0;
  let skips = 0;
  let maxX = 0;
  let score = 0;
  let best = 0;
  let thrownOnce = false;
  let resultTimer = 0;
  let lastT = 0;
  let holding = false;
  let holdPointer = false;
  let holdSpace = false;
  let throwQ = 0.6;
  let pebbles = 0;
  let upgrades = { face: 0, spin: 0, arm: 0, eye: 0, hold: 0 };
  let shopOpen = false;

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

  try { best = parseInt(localStorage.getItem(BEST_KEY) || "0", 10) || 0; } catch (e) { best = 0; }
  try { pebbles = parseInt(localStorage.getItem(PEBBLES_KEY) || "0", 10) || 0; } catch (e) { pebbles = 0; }
  try {
    const raw = JSON.parse(localStorage.getItem(UPGRADES_KEY) || "{}");
    UPGRADE_IDS.forEach(function (id) {
      const n = parseInt(raw && raw[id], 10);
      upgrades[id] = isFinite(n) ? Math.max(0, Math.min(MAX_LV, n)) : 0;
    });
  } catch (e) {}
  elBest.textContent = String(best);
  if (elPebbles) elPebbles.textContent = String(pebbles);

  function sweetLo() { return Math.max(0.28, BASE_SWEET_LO - 0.02 * upgrades.eye); }
  function sweetHi() { return Math.min(0.94, BASE_SWEET_HI + 0.02 * upgrades.eye); }
  function chargeTime() { return BASE_CHARGE + 0.18 * upgrades.hold; }

  function persist() {
    try {
      localStorage.setItem(BEST_KEY, String(best));
      localStorage.setItem(PEBBLES_KEY, String(pebbles));
      localStorage.setItem(UPGRADES_KEY, JSON.stringify(upgrades));
    } catch (e) {}
  }

  function refreshPebbles() {
    if (elPebbles) elPebbles.textContent = String(pebbles);
    if (elShopPebbles) elShopPebbles.textContent = String(pebbles);
  }

  function applySweetBand() {
    if (!elSweet) return;
    const lo = sweetLo();
    const hi = sweetHi();
    elSweet.style.left = (lo * 100).toFixed(2) + "%";
    elSweet.style.width = ((hi - lo) * 100).toFixed(2) + "%";
    const e = upgrades.eye;
    elSweet.className = "sweet" + (e ? " eye-" + e : "");
    if (e) {
      const blur = 6 + e * 3.2;
      const spread = (e * 0.75).toFixed(1);
      const alpha = (0.34 + e * 0.11).toFixed(2);
      elSweet.style.boxShadow = "0 0 " + blur + "px " + spread + "px rgba(232, 149, 74, " + alpha + ")";
      elSweet.style.background = "rgba(232, 149, 74, " + (0.55 + e * 0.07).toFixed(2) + ")";
    } else {
      elSweet.style.boxShadow = "";
      elSweet.style.background = "";
    }
  }

  function applyLook() {
    applySweetBand();
    const track = document.querySelector("#meter .track");
    if (track) {
      track.setAttribute("data-hold", String(upgrades.hold));
      if (upgrades.hold > 0) track.classList.add("ticks");
      else track.classList.remove("ticks");
      track.style.setProperty("--tick-gap", (16 - upgrades.hold * 2) + "px");
    }
    if (document.body) {
      document.body.setAttribute("data-eye", String(upgrades.eye));
      document.body.setAttribute("data-hold", String(upgrades.hold));
      document.body.setAttribute("data-face", String(upgrades.face));
      document.body.setAttribute("data-spin", String(upgrades.spin));
      document.body.setAttribute("data-arm", String(upgrades.arm));
    }
  }

  function chargeDrawOffset() {
    if (state !== "charging" || !upgrades.hold) return { x: 0, y: 0 };
    return {
      x: -charge * (3.5 + upgrades.hold * 2.4),
      y: -charge * upgrades.hold * 0.7
    };
  }

  function stoneShape() {
    const face = upgrades.face;
    return {
      rx: 11.5 + face * 0.72,
      ry: 4.4 - face * 0.32,
      shR: 11 + face * 0.55,
      shH: 3.2 - face * 0.18
    };
  }

  function nextCost(lv) {
    if (lv >= MAX_LV) return null;
    return COSTS[lv];
  }

  function renderShop() {
    refreshPebbles();
    const rows = document.querySelectorAll(".shop-row");
    for (let i = 0; i < rows.length; i++) {
      const id = rows[i].getAttribute("data-upgrade");
      const lv = upgrades[id] || 0;
      const cost = nextCost(lv);
      const levelEl = rows[i].querySelector(".shop-level");
      const buyEl = rows[i].querySelector(".shop-buy");
      if (levelEl) levelEl.textContent = lv + " / " + MAX_LV;
      if (!buyEl) continue;
      if (cost == null) {
        buyEl.textContent = "MAX";
        buyEl.disabled = true;
      } else {
        buyEl.textContent = String(cost);
        buyEl.disabled = pebbles < cost;
      }
    }
  }

  function openShop() {
    shopOpen = true;
    renderShop();
    elShopRoot.classList.add("open");
    elShopRoot.setAttribute("aria-hidden", "false");
  }

  function closeShop() {
    shopOpen = false;
    elShopRoot.classList.remove("open");
    elShopRoot.setAttribute("aria-hidden", "true");
  }

  function buyUpgrade(id) {
    if (UPGRADE_IDS.indexOf(id) < 0) return;
    const lv = upgrades[id] || 0;
    const cost = nextCost(lv);
    if (cost == null || pebbles < cost) return;
    pebbles -= cost;
    upgrades[id] = lv + 1;
    persist();
    applyLook();
    renderShop();
  }

  function makeRidge(amp, freq, seed) {
    const pts = [];
    for (let i = 0; i <= 48; i++) {
      const t = i / 48;
      const n =
        Math.sin(t * Math.PI * freq * 2 + seed * 9) * amp +
        Math.sin(t * Math.PI * freq * 5.3 + seed * 3) * amp * 0.35 +
        Math.sin(t * Math.PI * 17 + seed) * amp * 0.08;
      pts.push({ t, n });
    }
    // Distinctive mid-ridge horn
    if (seed > 0.4 && seed < 0.55) {
      pts[18].n += 0.16;
      pts[19].n += 0.28;
      pts[20].n += 0.14;
    }
    return pts;
  }

  function seedStars() {
    stars.length = 0;
    for (let i = 0; i < 90; i++) {
      stars.push({
        x: Math.random(),
        y: Math.random() * 0.52,
        r: Math.random() * 1.1 + 0.2,
        a: Math.random() * 0.45 + 0.08,
        tw: Math.random() * Math.PI * 2
      });
    }
  }

  function rollWind() {
    wind = (Math.random() * 2 - 1) * 22;
    if (Math.abs(wind) < 4) wind = 0;
    if (!wind) elWind.textContent = "still air";
    else if (wind > 0) elWind.textContent = "tailwind  \u203a\u203a";
    else elWind.textContent = "\u2039\u2039  headwind";
  }

  const Sfx = {
    ctx: null,
    osc: null,
    gain: null,
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
      src.connect(f);
      f.connect(g);
      g.connect(c.destination);
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
      const c = this.ctx;
      const o = this.osc, g = this.gain;
      this.osc = null;
      this.gain = null;
      try {
        g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.05);
        o.stop(c.currentTime + 0.06);
      } catch (e) {}
    },
    throw: function () {
      this.tone(240, 0.16, "triangle", 0.06, 90);
      this.noise(0.14, 0.05, 900);
    },
    skip: function (n) {
      this.tone(700 * Math.pow(0.86, n), 0.11, "triangle", 0.085, 280);
      this.noise(0.09, 0.055, 1600);
    },
    sink: function () {
      this.tone(130, 0.32, "sine", 0.09, 48);
      this.noise(0.24, 0.09, 420);
    }
  };

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    waterScreen = H * 0.58;
    scale = Math.max(0.85, Math.min(1.15, W / 900));
    seedStars();
  }

  function wx(x) { return (x - cam.x) * scale + W * 0.22; }
  function wy(y) { return (y - cam.y) * scale + waterScreen + cam.kick; }

  function resetStone() {
    stone.x = 0;
    stone.y = -16;
    stone.vx = 0;
    stone.vy = 0;
    stone.rot = -0.22;
    stone.spin = 0;
    stone.sx = 1;
    stone.sy = 1;
    stone.tsx = 1;
    stone.tsy = 1;
    stone.sinking = 0;
    stone.visible = true;
    trail.length = 0;
    spinRings.length = 0;
    skips = 0;
    maxX = 0;
    score = 0;
    elScore.textContent = "0";
  }

  function beginCharge() {
    if (shopOpen) return;
    if (state === "flight") return;
    if (state === "sunk" && resultTimer < 0.28) return;
    Sfx.ensure();
    if (state !== "charging") {
      resetStone();
      rollWind();
      charge = 0;
      if (elFill) {
        elFill.style.left = "0%";
        elFill.classList.remove("in-sweet");
      }
      cam.tx = 0;
      state = "charging";
      elMeter.hidden = false;
      elResult.classList.remove("show");
      Sfx.startCharge();
    }
    holding = true;
  }

  function qualityOf(p) {
    const lo = sweetLo();
    const hi = sweetHi();
    if (p >= lo && p <= hi) {
      const mid = (lo + hi) / 2;
      const half = Math.max(0.001, (hi - lo) / 2);
      return 0.92 + 0.08 * (1 - Math.abs(p - mid) / half);
    }
    if (p < lo) {
      const t = Math.max(0, Math.min(1, p / lo));
      return 0.12 + 0.76 * Math.pow(t, 0.65);
    }
    const over = (p - hi) / Math.max(0.02, 1 - hi);
    return Math.max(0.20, 0.35 - over * 0.15);
  }

  function throwAngle(p) {
    const lo = sweetLo();
    const hi = sweetHi();
    if (p >= lo && p <= hi) {
      const t = (p - lo) / Math.max(0.001, hi - lo);
      return 0.26 - t * 0.08;
    }
    if (p < lo) return 0.52 - (p / lo) * 0.26;
    const over = (p - hi) / Math.max(0.001, 1 - hi);
    return 0.16 - over * 0.28;
  }

  function releaseThrow() {
    if (state !== "charging") return;
    holding = false;
    Sfx.stopCharge();
    elMeter.hidden = true;

    const p = Math.max(0.06, charge);
    const q = qualityOf(p);
    const speed = 130 + p * 440 + q * 30 + 28 * upgrades.arm;
    const angle = throwAngle(p);
    const hi = sweetHi();
    let omega0 = 8 + p * 8 + q * 5 + upgrades.spin * 2.6;
    if (p > hi) {
      const over = (p - hi) / Math.max(0.001, 1 - hi);
      omega0 = (3.4 + upgrades.spin * 0.9) * (1 - over * 0.45);
    }

    throwQ = q;
    stone.vx = Math.cos(angle) * speed;
    stone.vy = -Math.sin(angle) * speed;
    stone.spin = omega0;
    stone.tsx = 1.28;
    stone.tsy = 0.72;
    stone.rot = -angle;
    skips = 0;
    maxX = stone.x;
    state = "flight";
    thrownOnce = true;
    elHint.classList.remove("show");
    elHint.classList.add("gone");
    Sfx.throw();
    cam.kick = 4;
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
    const vx = stone.vx;
    const vy = stone.vy;
    const v = Math.hypot(vx, vy);
    const theta = Math.atan2(vy, Math.max(vx, 1));
    const omega = Math.abs(stone.spin);
    const face = upgrades.face;
    const spinLv = upgrades.spin;
    const thetaCrit = SKIP_THETA_CRIT + 0.024 * face;
    const spinFloor = 3.2 - face * 0.35;
    const canSkip = theta < thetaCrit && v > SKIP_V_MIN && vx > SKIP_VX_MIN && omega > spinFloor;
    if (canSkip) {
      const shallow = 1 - Math.min(1, theta / Math.max(0.001, thetaCrit));
      const spinTerm = Math.min(1, omega / 14);
      let e = 0.45 + 0.18 * shallow + 0.09 * spinTerm + 0.028 * spinLv + 0.012 * face;
      e -= skips * 0.038;
      e = Math.max(0.28, Math.min(0.72, e));
      const lift = 6 + spinTerm * 10 + spinLv * 1.4;
      stone.vy = -e * Math.abs(vy) - lift;
      const mu = Math.max(0.02, 0.04 + 0.03 * theta + skips * 0.008 - spinLv * 0.006);
      stone.vx = vx * (1 - mu);
      stone.spin *= 0.90 + 0.012 * spinLv;
      stone.y = -1.2;
      if (omega > 6) {
        stone.tsx = 1.12;
        stone.tsy = 0.88;
      } else {
        stone.tsx = 1.38;
        stone.tsy = 0.52;
      }
      skips += 1;
      maxX = Math.max(maxX, stone.x);
      score = skips * 10 + Math.round(maxX * 0.12);
      elScore.textContent = String(score);
      cam.kick = -Math.min(16 + upgrades.arm * 3.5, 7 + skips * 0.45 + upgrades.arm * 2.4);
      cam.roll = (Math.random() < 0.5 ? -1 : 1) * (0.012 + upgrades.arm * 0.004);
      addRipple(stone.x, v > 160);
      addRipple(stone.x + 10, false);
      addSpray(stone.x, 0, stone.vx, Math.max(3, Math.round(4 + v * 0.014)));
      scratches.push({ x: stone.x, life: 0.5 });
      if (upgrades.spin > 0) {
        spinRings.push({
          x: stone.x,
          r: 10,
          a: 0.22 + upgrades.spin * 0.07,
          life: 0.32 + upgrades.spin * 0.05
        });
      }
      Sfx.skip(skips);
      if (Math.abs(stone.vy) < 14 || stone.vx < 32) sink();
    } else {
      sink();
    }
  }

  function sink() {
    if (state !== "flight") return;
    state = "sunk";
    resultTimer = 0;
    stone.sinking = 0.0001;
    stone.vx *= 0.25;
    stone.vy = 22;
    addRipple(stone.x, true);
    addSpray(stone.x, 0, 10, 14);
    Sfx.sink();
    maxX = Math.max(maxX, stone.x);
    score = skips * 10 + Math.round(maxX * 0.12);
    elScore.textContent = String(score);
    const isNewBest = score > best;
    if (isNewBest) {
      best = score;
      elBest.textContent = String(best);
    }
    const gained = Math.max(1, skips * 2 + Math.floor(score / 40)) + (isNewBest ? 5 : 0);
    pebbles += gained;
    persist();
    refreshPebbles();
    if (shopOpen) renderShop();
    const label = skips === 1 ? "1 skip" : skips + " skips";
    elResult.hidden = false;
    elResult.textContent = label + (isNewBest ? " \u00b7 new best" : "") + " \u00b7 +" + gained + " pebbles";
    requestAnimationFrame(function () { elResult.classList.add("show"); });
  }

  function update(dt) {
    const k = 1 - Math.exp(-dt * 10);
    cam.x += (cam.tx - cam.x) * k;
    cam.y += (cam.ty - cam.y) * k;
    cam.kick *= Math.pow(0.08, dt);
    cam.roll *= Math.pow(0.04, dt);

    stone.sx += (stone.tsx - stone.sx) * (1 - Math.exp(-dt * 14));
    stone.sy += (stone.tsy - stone.sy) * (1 - Math.exp(-dt * 14));
    stone.tsx += (1 - stone.tsx) * (1 - Math.exp(-dt * 5));
    stone.tsy += (1 - stone.tsy) * (1 - Math.exp(-dt * 5));

    if (state === "ready") {
      stone.y = -16 + Math.sin(performance.now() * 0.0018) * 0.6;
      stone.rot = -0.22;
      cam.tx = -20;
      cam.ty = 0;
    }

    if (state === "charging") {
      if (holding) charge = Math.min(1, charge + dt / chargeTime());
      Sfx.setCharge(charge);
      elFill.style.left = (charge * 100).toFixed(1) + "%";
      const inSweet = charge >= sweetLo() && charge <= sweetHi();
      if (inSweet) elFill.classList.add("in-sweet");
      else elFill.classList.remove("in-sweet");
      const pull = charge * 18;
      stone.x = -pull;
      stone.y = -16 - charge * 3;
      stone.rot = -0.22 - charge * (0.35 + 0.055 * upgrades.hold);
      stone.tsx = 1 + charge * 0.08;
      stone.tsy = 1 - charge * 0.1;
      cam.tx = -20 - charge * (12 + upgrades.hold * 2.2);
    }

    if (state === "flight") {
      stone.vy += GRAVITY * dt;
      stone.vx += wind * dt;
      stone.vx *= 1 - 0.05 * dt;
      stone.x += stone.vx * dt;
      stone.y += stone.vy * dt;
      stone.spin *= 1 - (0.08 - upgrades.face * 0.01) * dt;
      const omegaAir = Math.abs(stone.spin);
      if (omegaAir > 6) {
        stone.rot += stone.spin * dt * 0.08;
        stone.tsx += (1.04 - stone.tsx) * (1 - Math.exp(-dt * 4));
        stone.tsy += (0.92 - stone.tsy) * (1 - Math.exp(-dt * 4));
      } else {
        stone.rot += stone.spin * dt * (0.32 + (6 - omegaAir) * 0.06);
        stone.tsy += (0.68 - stone.tsy) * (1 - Math.exp(-dt * 3));
      }
      if (upgrades.spin > 0) {
        trail.push({
          x: stone.x,
          y: stone.y,
          rot: stone.rot,
          sx: stone.sx,
          sy: stone.sy,
          life: 0.10 + upgrades.spin * 0.045
        });
        const maxT = 3 + upgrades.spin * 3;
        if (trail.length > maxT) trail.shift();
      }
      maxX = Math.max(maxX, stone.x);
      cam.tx = stone.x - 80;
      cam.ty = Math.max(-30, Math.min(20, stone.y * 0.15));
      if (stone.y >= WATER_Y && stone.vy > 0) trySkip();
      if (stone.x > 2400 || stone.y > 80) sink();
    }

    if (state === "sunk") {
      resultTimer += dt;
      stone.sinking += dt;
      stone.y += 28 * dt;
      stone.x += stone.vx * dt;
      stone.rot += dt * (1.5 + (1 - Math.min(1, Math.abs(stone.spin) / 8)));
      stone.tsy += (0.55 - stone.tsy) * (1 - Math.exp(-dt * 4));
      cam.tx = stone.x - 80;
      if (stone.sinking > 0.7) stone.visible = false;
      if (resultTimer > 1.35) {
        state = "ready";
        resetStone();
        elResult.classList.remove("show");
        rollWind();
      }
    }

    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      r.r += dt * (r.max * 1.15);
      r.a *= Math.pow(0.12, dt);
      if (r.a < 0.02 || r.r > r.max) ripples.splice(i, 1);
    }
    for (let i = spray.length - 1; i >= 0; i--) {
      const p = spray[i];
      p.vy += 520 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0 || p.y > 8) spray.splice(i, 1);
    }
    for (let i = scratches.length - 1; i >= 0; i--) {
      scratches[i].life -= dt;
      if (scratches[i].life <= 0) scratches.splice(i, 1);
    }
    for (let i = trail.length - 1; i >= 0; i--) {
      trail[i].life -= dt;
      if (trail[i].life <= 0) trail.splice(i, 1);
    }
    for (let i = spinRings.length - 1; i >= 0; i--) {
      const g = spinRings[i];
      g.r += dt * 48;
      g.life -= dt;
      g.a *= Math.pow(0.08, dt);
      if (g.life <= 0 || g.a < 0.02) spinRings.splice(i, 1);
    }

    if (Math.random() < dt * 0.35) {
      ambient.push({ x: cam.x + 80 + Math.random() * 520, r: 2, max: 22 + Math.random() * 18, a: 0.16 });
    }
    for (let i = ambient.length - 1; i >= 0; i--) {
      const a = ambient[i];
      a.r += dt * 16;
      a.a *= Math.pow(0.25, dt);
      if (a.a < 0.02) ambient.splice(i, 1);
    }
  }

  function drawSky() {
    const eye = upgrades.eye;
    const g = ctx.createLinearGradient(0, 0, 0, waterScreen + 8);
    g.addColorStop(0, "#0a0d1a");
    g.addColorStop(0.42, "#1a1630");
    g.addColorStop(0.72, eye ? "rgb(" + (74 + eye * 2) + "," + (42 + eye) + "," + (56 + eye) + ")" : "#4a2a38");
    g.addColorStop(0.88, eye ? "rgb(" + (196 + eye * 8) + "," + (101 + eye * 6) + "," + (58 + eye * 2) + ")" : "#c4653a");
    g.addColorStop(1, eye ? "rgb(" + (232 + eye * 4) + "," + (160 + eye * 8) + "," + (90 + eye * 6) + ")" : "#e8a05a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const t = performance.now() * 0.001;
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      const tw = 0.55 + 0.45 * Math.sin(t * 1.4 + s.tw);
      ctx.fillStyle = "rgba(243,224,194," + (s.a * tw) + ")";
      ctx.beginPath();
      ctx.arc(s.x * W, s.y * waterScreen, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    const sunX = W * 0.71;
    const sunY = waterScreen - H * 0.11;
    const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, H * (0.34 + eye * 0.028));
    glow.addColorStop(0, "rgba(255, " + (196 + eye * 6) + ", " + (110 - eye * 4) + ", " + (0.85 + eye * 0.028).toFixed(3) + ")");
    glow.addColorStop(0.18, "rgba(232, 140, 70, " + (0.28 + eye * 0.05).toFixed(3) + ")");
    glow.addColorStop(0.5, "rgba(180, 70, 50, " + (0.08 + eye * 0.018).toFixed(3) + ")");
    glow.addColorStop(1, "rgba(180, 70, 50, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, waterScreen + 2);

    const sunR = Math.max(18, H * 0.038) * (1 + eye * 0.04);
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.fillStyle = eye ? "#ffd078" : "#ffc56a";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sunX - 3, sunY + 2, sunR * 0.78, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 150, 70, " + (0.35 + eye * 0.04).toFixed(3) + ")";
    ctx.fill();
  }

  function drawRidge(pts, baseY, height, color, parallax) {
    const shift = -cam.x * parallax * 0.18;
    ctx.beginPath();
    ctx.moveTo(-40, H);
    ctx.lineTo(-40, baseY);
    for (let i = 0; i < pts.length; i++) {
      const x = pts[i].t * (W + 160) - 80 + shift;
      const y = baseY - height * (0.35 + pts[i].n);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W + 40, baseY);
    ctx.lineTo(W + 40, H);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function drawReflectedRidge(pts, baseY, height, color, parallax) {
    const shift = -cam.x * parallax * 0.18;
    const t = performance.now() * 0.001;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, waterScreen, W, H - waterScreen);
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(-40, waterScreen);
    for (let i = 0; i < pts.length; i++) {
      const x = pts[i].t * (W + 160) - 80 + shift + Math.sin(t * 1.2 + i * 0.4) * 2.2;
      const y = waterScreen + (baseY - waterScreen) * 0.15 + height * (0.35 + pts[i].n) * 0.72;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineTo(W + 40, H);
    ctx.lineTo(-40, H);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  function drawWater() {
    const g = ctx.createLinearGradient(0, waterScreen, 0, H);
    g.addColorStop(0, "#1b3a4a");
    g.addColorStop(0.18, "#123040");
    g.addColorStop(0.55, "#0c1e2e");
    g.addColorStop(1, "#071018");
    ctx.fillStyle = g;
    ctx.fillRect(0, waterScreen, W, H - waterScreen);

    const eye = upgrades.eye;
    const sunX = W * 0.71;
    const t = performance.now() * 0.001;
    const path = ctx.createLinearGradient(sunX, waterScreen, sunX, H);
    path.addColorStop(0, "rgba(255, 190, 110, " + (0.28 + eye * 0.055).toFixed(3) + ")");
    path.addColorStop(0.35, "rgba(232, 140, 70, " + (0.08 + eye * 0.03).toFixed(3) + ")");
    path.addColorStop(1, "rgba(232, 140, 70, 0)");
    ctx.fillStyle = path;
    ctx.save();
    ctx.beginPath();
    const hw = 36 + Math.sin(t * 0.7) * 6;
    ctx.moveTo(sunX - hw, waterScreen);
    for (let y = waterScreen; y < H; y += 6) {
      const wob = Math.sin(y * 0.08 + t * 2.2) * (8 + (y - waterScreen) * 0.04);
      ctx.lineTo(sunX + hw + wob + (y - waterScreen) * 0.12, y);
    }
    for (let y = H; y >= waterScreen; y -= 6) {
      const wob = Math.sin(y * 0.08 + t * 2.2 + 1) * (8 + (y - waterScreen) * 0.04);
      ctx.lineTo(sunX - hw + wob - (y - waterScreen) * 0.12, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    if (eye > 0) {
      ctx.save();
      ctx.globalAlpha = 0.16 + eye * 0.07;
      ctx.strokeStyle = "rgba(255, 210, 130, 0.9)";
      ctx.lineWidth = 1 + eye * 0.22;
      ctx.beginPath();
      for (let y = waterScreen; y < H; y += 5) {
        const wob = Math.sin(y * 0.09 + t * 2.4) * (5 + (y - waterScreen) * 0.03);
        const xx = sunX + wob;
        if (y === waterScreen) ctx.moveTo(xx, y);
        else ctx.lineTo(xx, y);
      }
      ctx.stroke();
      ctx.restore();
    }

    ctx.globalAlpha = 0.07;
    for (let i = 0; i < 7; i++) {
      const y = waterScreen + 10 + i * ((H - waterScreen) / 8);
      const phase = t * (0.4 + i * 0.07) + i;
      ctx.strokeStyle = "#d8ecf4";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 10) {
        const yy = y + Math.sin(x * 0.02 + phase) * 1.4;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ctx.strokeStyle = "rgba(243, 224, 194, 0.14)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, waterScreen + 0.5);
    ctx.lineTo(W, waterScreen + 0.5);
    ctx.stroke();
  }

  function drawShore() {
    const dockX = wx(-36);
    const dockY = wy(0);
    ctx.fillStyle = "#0c0a10";
    ctx.beginPath();
    ctx.moveTo(-20, H);
    ctx.lineTo(-20, dockY - 18);
    ctx.lineTo(wx(-90), dockY - 8);
    ctx.lineTo(wx(-10), dockY + 2);
    ctx.lineTo(wx(28), dockY + 6);
    ctx.lineTo(wx(40), H);
    ctx.closePath();
    ctx.fill();

    // jetty slab
    ctx.fillStyle = "#1a1614";
    ctx.beginPath();
    ctx.moveTo(wx(-48), wy(-3));
    ctx.lineTo(wx(22), wy(-2));
    ctx.lineTo(wx(18), wy(3));
    ctx.lineTo(wx(-52), wy(4));
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(80, 70, 60, 0.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(wx(-46), wy(-1));
    ctx.lineTo(wx(18), wy(0));
    ctx.stroke();

    if (upgrades.hold > 0) {
      ctx.strokeStyle = "rgba(120, 100, 80, " + (0.22 + upgrades.hold * 0.06) + ")";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(wx(-44), wy(1.2));
      ctx.lineTo(wx(16), wy(2));
      ctx.stroke();
    }

    // reeds — hold levels stand a little straighter, a couple more
    ctx.strokeStyle = "#121018";
    ctx.lineWidth = 1.4;
    ctx.lineCap = "round";
    const reedN = 7 + (upgrades.hold >= 2 ? 2 : 0);
    const tidy = upgrades.hold * 0.18;
    for (let i = 0; i < reedN; i++) {
      const rx = wx(-70 + i * 8);
      const lean = 4 - tidy;
      ctx.beginPath();
      ctx.moveTo(rx, wy(2));
      ctx.quadraticCurveTo(rx + lean, wy(-18 - (i % 3) * 6), rx + 2 - tidy, wy(-28 - (i % 4) * 5));
      ctx.stroke();
    }

    if (upgrades.hold >= 3) {
      const lx = wx(-8);
      const ly = wy(-14);
      ctx.strokeStyle = "#1c1814";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(wx(-8), wy(2));
      ctx.lineTo(lx, ly + 2);
      ctx.stroke();
      const lg = ctx.createRadialGradient(lx, ly, 1, lx, ly, 16 + upgrades.hold * 2);
      lg.addColorStop(0, "rgba(255, 190, 110, 0.55)");
      lg.addColorStop(0.4, "rgba(232, 149, 74, 0.16)");
      lg.addColorStop(1, "rgba(232, 149, 74, 0)");
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.arc(lx, ly, 18 + upgrades.hold * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f0c878";
      ctx.beginPath();
      ctx.arc(lx, ly, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#c97838";
      ctx.beginPath();
      ctx.arc(lx - 0.6, ly + 0.4, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawChargeLine() {
    if (state !== "charging" || upgrades.hold < 1) return;
    const off = chargeDrawOffset();
    const x0 = wx(-22);
    const y0 = wy(-2);
    const x1 = wx(stone.x + off.x);
    const y1 = wy(stone.y + off.y);
    ctx.strokeStyle = "rgba(243, 224, 194, " + (0.12 + charge * 0.2 + upgrades.hold * 0.03) + ")";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.setLineDash([]);
    if (charge > 0.08) {
      ctx.strokeStyle = "rgba(210, 230, 236, " + (0.08 + charge * 0.14) + ")";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(wx(-6), wy(1), (8 + charge * 14) * scale, (2 + charge * 3) * scale, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawRipples() {
    function ring(x, r, a, w) {
      const sx = wx(x);
      const sy = wy(0);
      ctx.beginPath();
      ctx.ellipse(sx, sy, r * scale, r * scale * 0.28, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(210, 230, 236," + a + ")";
      ctx.lineWidth = w;
      ctx.stroke();
    }
    for (let i = 0; i < ambient.length; i++) ring(ambient[i].x, ambient[i].r, ambient[i].a, 1);
    for (let i = 0; i < ripples.length; i++) {
      const r = ripples[i];
      ring(r.x, r.r, r.a, r.w);
      ring(r.x, r.r * 0.62, r.a * 0.6, 1);
    }
    for (let i = 0; i < scratches.length; i++) {
      const s = scratches[i];
      ctx.globalAlpha = Math.max(0, s.life * 1.4);
      ctx.strokeStyle = "rgba(230, 244, 248, 0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(wx(s.x - 16), wy(-1));
      ctx.lineTo(wx(s.x + 22), wy(0));
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    for (let i = 0; i < spray.length; i++) {
      const p = spray[i];
      const sz = 2 * (p.s || 1);
      ctx.fillStyle = "rgba(220, 236, 240," + Math.max(0, p.life * 1.6) + ")";
      ctx.fillRect(wx(p.x), wy(p.y), sz, sz);
    }
    for (let i = 0; i < spinRings.length; i++) {
      const g = spinRings[i];
      ctx.strokeStyle = "rgba(230, 236, 240, " + g.a + ")";
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.ellipse(wx(g.x), wy(0), g.r * scale, g.r * scale * 0.22, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function paintStoneBody(fade) {
    const face = upgrades.face;
    const arm = upgrades.arm;
    const sh = stoneShape();
    ctx.globalAlpha = fade;
    ctx.fillStyle = "rgba(10, 16, 24, 0.28)";
    ctx.beginPath();
    ctx.ellipse(2, 5, sh.shR, sh.shH, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgb(" + (42 - arm * 3) + "," + (39 - arm * 3) + "," + (36 - arm * 2) + ")";
    ctx.beginPath();
    ctx.ellipse(0, 0, sh.rx, sh.ry, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgb(" + (61 - arm * 2 + face * 6) + "," + (57 - arm * 2 + face * 5) + "," + (52 - arm + face * 4) + ")";
    ctx.beginPath();
    ctx.ellipse(-1.5, -1.1, 8.2 + face * 0.55, 2.6 - face * 0.18, -0.1, 0, Math.PI * 2);
    ctx.fill();

    const hiA = 0.35 + face * 0.1 - arm * 0.02;
    ctx.fillStyle = "rgba(198, 186, 168, " + hiA + ")";
    ctx.beginPath();
    ctx.ellipse(-3.2, -1.6, 3.6 + face * 0.7, Math.max(0.55, 1.05 - face * 0.08), -0.15, 0, Math.PI * 2);
    ctx.fill();

    if (face >= 3) {
      ctx.strokeStyle = "rgba(210, 200, 185, " + (0.12 + face * 0.04) + ")";
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.ellipse(0, 0, sh.rx, sh.ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawStone() {
    if (!stone.visible) return;
    const fade = stone.sinking ? Math.max(0, 1 - stone.sinking * 1.4) : 1;
    const sh = stoneShape();

    if (upgrades.spin > 0 && trail.length) {
      for (let i = 0; i < trail.length; i++) {
        const t = trail[i];
        const a = Math.max(0, t.life * (1.8 + upgrades.spin * 0.35)) * fade;
        ctx.save();
        ctx.translate(wx(t.x), wy(t.y));
        ctx.rotate(t.rot + cam.roll);
        ctx.scale(t.sx * scale, t.sy * scale);
        ctx.globalAlpha = Math.min(0.55, a);
        ctx.fillStyle = "rgba(198, 186, 168, 0.5)";
        ctx.beginPath();
        ctx.ellipse(0, 0, sh.rx, sh.ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    const off = chargeDrawOffset();
    const x = wx(stone.x + off.x);
    const y = wy(stone.y + off.y);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(stone.rot + cam.roll);
    ctx.scale(stone.sx * scale, stone.sy * scale);
    paintStoneBody(fade);
    ctx.restore();
  }

  function drawVignette() {
    const v = ctx.createRadialGradient(W * 0.5, H * 0.45, H * 0.2, W * 0.5, H * 0.5, H * 0.78);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(4, 6, 12, 0.42)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }

  function render() {
    drawSky();
    drawRidge(ridges.far, waterScreen + 6, H * 0.22, "#14101c", 0.12);
    drawRidge(ridges.mid, waterScreen + 4, H * 0.28, "#0e0b14", 0.22);
    drawWater();
    drawReflectedRidge(ridges.far, waterScreen + 6, H * 0.22, "rgba(12, 18, 26, 0.55)", 0.12);
    drawReflectedRidge(ridges.mid, waterScreen + 4, H * 0.28, "rgba(8, 12, 18, 0.7)", 0.22);
    drawRipples();
    drawShore();
    drawChargeLine();
    drawRidge(ridges.near, H * 0.92, H * 0.1, "#08070c", 0.55);
    drawStone();
    drawVignette();
  }

  function frame(ts) {
    if (!lastT) lastT = ts;
    let dt = (ts - lastT) / 1000;
    lastT = ts;
    if (dt > 0.05) dt = 0.05;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  function isUi(t) {
    return !!(t && t.closest && t.closest("[data-ui]"));
  }

  function down(e) {
    if (isUi(e.target) || shopOpen) return;
    if (e.cancelable) e.preventDefault();
    holdPointer = true;
    beginCharge();
  }
  function up(e) {
    if (isUi(e.target) && state !== "charging") return;
    if (e && e.cancelable && !isUi(e.target)) e.preventDefault();
    holdPointer = false;
    holding = holdSpace;
    if (state === "charging" && !holding) releaseThrow();
  }

  window.addEventListener("resize", resize);
  window.addEventListener("pointerdown", down, { passive: false });
  window.addEventListener("pointerup", up, { passive: false });
  window.addEventListener("pointercancel", up, { passive: false });
  window.addEventListener("contextmenu", function (e) { e.preventDefault(); });

  window.addEventListener("keydown", function (e) {
    if (e.code !== "Space" && e.key !== " ") return;
    if (shopOpen) return;
    e.preventDefault();
    if (e.repeat) return;
    holdSpace = true;
    beginCharge();
  });
  window.addEventListener("keyup", function (e) {
    if (e.code !== "Space" && e.key !== " ") return;
    e.preventDefault();
    holdSpace = false;
    holding = holdPointer;
    if (state === "charging" && !holding) releaseThrow();
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden && state === "charging") {
      holdPointer = false;
      holdSpace = false;
      holding = false;
      releaseThrow();
    }
  });

  if (elShopBtn) elShopBtn.addEventListener("click", function (e) {
    e.preventDefault();
    if (shopOpen) closeShop();
    else openShop();
  });
  if (elStatPebbles) elStatPebbles.addEventListener("click", function (e) {
    e.preventDefault();
    if (shopOpen) closeShop();
    else openShop();
  });
  if (elShopClose) elShopClose.addEventListener("click", function (e) {
    e.preventDefault();
    closeShop();
  });
  if (elShopBackdrop) elShopBackdrop.addEventListener("pointerdown", function (e) {
    e.preventDefault();
    closeShop();
  });
  document.querySelectorAll(".shop-buy").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      const row = btn.closest(".shop-row");
      if (row) buyUpgrade(row.getAttribute("data-upgrade"));
    });
  });
  window.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && shopOpen) closeShop();
  });

  applyLook();
  renderShop();
  resize();
  resetStone();
  rollWind();
  elHint.classList.add("show");
  requestAnimationFrame(frame);
})();
