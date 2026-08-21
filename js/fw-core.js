/* Flatwater — stone skipping on a dusk lake. Vanilla, one screen. */
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
  const SKIP_THETA_CRIT = 0.38;
  const SKIP_V_MIN = 74;
  const SKIP_VX_MIN = 28;
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
    rot: -0.22, spin: 0,
    sx: 1, sy: 1,
    tsx: 1, tsy: 1,
    sinking: 0, visible: true
  };

  let state = "ready";
  let charge = 0;
  const AIM_LO = 0.10;
  const AIM_HI = 0.48;
  const AIM_DEFAULT = 0.22;
  let aimAngle = AIM_DEFAULT;
  let aimStartY = 0;
  let aimStartA = AIM_DEFAULT;
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
  let cleared = false;

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
        v: 2,
        face: upgrades.face,
        spin: upgrades.spin,
        arm: upgrades.arm,
        eye: upgrades.eye,
        hold: upgrades.hold
      }));
      if (cleared) localStorage.setItem(CLEARED_KEY, "1");
    } catch (e) {}
  }

  try { best = parseInt(localStorage.getItem(BEST_KEY) || "0", 10) || 0; } catch (e) { best = 0; }
  try { pebbles = parseInt(localStorage.getItem(PEBBLES_KEY) || "0", 10) || 0; } catch (e) { pebbles = 0; }
  try { cleared = localStorage.getItem(CLEARED_KEY) === "1"; } catch (e) { cleared = false; }
  try {
    const raw = JSON.parse(localStorage.getItem(UPGRADES_KEY) || "{}");
    if (raw.v !== 2) {
      upgrades = { face: 0, spin: 0, arm: 0, eye: 0, hold: 0 };
      persist();
    } else {
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

  function totalLevels() {
    return upgrades.face + upgrades.spin + upgrades.arm + upgrades.eye + upgrades.hold;
  }
  function allMaxed() {
    return upgrades.face >= MAX_LV && upgrades.spin >= MAX_LV && upgrades.arm >= MAX_LV && upgrades.eye >= MAX_LV && upgrades.hold >= MAX_LV;
  }
  function applyScale() {
    const base = Math.max(0.85, Math.min(1.15, (W || 900) / 900));
    scale = base / (1 + 0.07 * totalLevels());
  }
  function markClearedHud() {
    const wm = document.getElementById("wordmark");
    if (!wm) return;
    if (cleared) wm.classList.add("cleared");
    else wm.classList.remove("cleared");
  }
  function refreshHint() {
    if (!elHint || cleared || thrownOnce) return;
    elHint.textContent = allMaxed() ? "The far shore is out there" : "Hold to charge · drag up or down to aim";
    elHint.classList.remove("gone");
    elHint.classList.add("show");
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
    applyScale();
    markClearedHud();
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
      rx: 11.5 + face * 1.2,
      ry: Math.max(2.05, 4.4 - face * 0.46),
      shR: 11 + face * 0.9,
      shH: Math.max(1.35, 3.2 - face * 0.28)
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
    if (allMaxed() && !cleared && !thrownOnce) refreshHint();
    else if (allMaxed() && !cleared) {
      elHint.textContent = "The far shore is out there";
      elHint.classList.remove("gone");
      elHint.classList.add("show");
    }
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
    else if (wind > 0) elWind.textContent = "tailwind  ››";
    else elWind.textContent = "‹‹  headwind";
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
    applyScale();
    seedStars();
  }

  function wx(x) { return (x - cam.x) * scale + W * 0.22; }
  function wy(y) { return (y - cam.y) * scale + waterScreen + cam.kick; }

  function resetStone() {
    stone.x = 0;
    stone.y = -16;
    stone.vx = 0;
    stone.vy = 0;
    stone.rot = -aimAngle;
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
      elResult.classList.remove("far-shore");
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

  function clampAim(a) {
    return Math.max(AIM_LO, Math.min(AIM_HI, a));
  }
  function beginAim(clientY) {
    aimStartY = clientY;
    aimStartA = aimAngle;
  }
  function setAimFromPointer(clientY) {
    const h = 0.42 * window.innerHeight;
    aimAngle = clampAim(aimStartA + (aimStartY - clientY) / h * (AIM_HI - AIM_LO));
  }
  function nudgeAim(dir) {
    aimAngle = clampAim(aimAngle + dir * 0.012);
  }

  function releaseThrow() {
    if (state !== "charging") return;
    holding = false;
    Sfx.stopCharge();
    elMeter.hidden = true;

    const p = Math.max(0.06, charge);
    const q = qualityOf(p);
    const speed = 130 + p * 440 + q * 30 + 55 * upgrades.arm;
    const angle = aimAngle;
    const hi = sweetHi();
    let omega0 = 8 + p * 8 + q * 5 + upgrades.spin * 5.5;
    if (p > hi) {
      const over = (p - hi) / Math.max(0.001, 1 - hi);
      omega0 = (3.4 + upgrades.spin * 2.2) * (1 - over * 0.45);
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
    const thetaCrit = SKIP_THETA_CRIT + 0.055 * face;
    const spinFloor = 3.2 - face * 0.35;
    const canSkip = theta < thetaCrit && v > SKIP_V_MIN && vx > SKIP_VX_MIN && omega > spinFloor;
    if (canSkip) {
      const shallow = 1 - Math.min(1, theta / Math.max(0.001, thetaCrit));
      const spinTerm = Math.min(1, omega / 14);
      let e = 0.45 + 0.18 * shallow + 0.09 * spinTerm + 0.05 * spinLv + 0.022 * face;
      e -= skips * (0.038 - spinLv * 0.0035);
      e = Math.max(0.28, Math.min(0.90, e));
      const lift = 6 + spinTerm * 10 + spinLv * 2.4;
      stone.vy = -e * Math.abs(vy) - lift;
      const mu = Math.max(0.008, 0.038 + 0.03 * theta + skips * 0.007 - spinLv * 0.008);
      stone.vx = vx * (1 - mu);
      stone.spin *= 0.90 + 0.018 * spinLv;
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
      cam.kick = -Math.min(22 + upgrades.arm * 6, 8 + skips * 0.5 + upgrades.arm * 3.8);
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
    const justCleared = !cleared && allMaxed() && maxX >= FAR_SHORE;
    if (justCleared) {
      cleared = true;
      persist();
      markClearedHud();
    }
    elResult.hidden = false;
    if (justCleared) {
      elResult.classList.add("far-shore");
      elResult.innerHTML = "Far shore<span class=\"sub\">Level complete</span>";
    } else {
      elResult.classList.remove("far-shore");
      const label = skips === 1 ? "1 skip" : skips + " skips";
      elResult.textContent = label + (isNewBest ? " · new best" : "") + " · +" + gained + " pebbles";
    }
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
      stone.rot = -aimAngle;
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
      stone.rot = -aimAngle - charge * 0.04;
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
      stone.spin *= 1 - Math.max(0.012, 0.08 - upgrades.face * 0.008 - upgrades.spin * 0.012) * dt;
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
      if (stone.x >= FAR_SHORE && totalLevels() >= 20) sink();
      else if (stone.x > 2600 || stone.y > 80) sink();
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

  function mix(a, b, u) { return a + (b - a) * u; }
  function rgb3(r, g, b) { return "rgb(" + Math.round(r) + "," + Math.round(g) + "," + Math.round(b) + ")"; }
  function sunPos() {
    const eye = upgrades.eye;
    const lifts = [0.11, 0.16, 0.21, 0.28, 0.34, 0.42];
    return {
      x: W * 0.71,
      y: waterScreen - H * lifts[Math.max(0, Math.min(5, eye | 0))]
    };
  }
