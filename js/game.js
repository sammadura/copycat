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

  const BEST_KEY = "flatwater.best";
  const SWEET_LO = 0.58;
  const SWEET_HI = 0.78;
  const CHARGE_TIME = 0.92;
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

  const ripples = [];
  const spray = [];
  const scratches = [];
  const stars = [];
  const ambient = [];

  const ridges = {
    far: makeRidge(0.22, 1.15, 0.62),
    mid: makeRidge(0.34, 0.92, 0.48),
    near: makeRidge(0.18, 0.7, 0.38)
  };

  try { best = parseInt(localStorage.getItem(BEST_KEY) || "0", 10) || 0; } catch (e) { best = 0; }
  elBest.textContent = String(best);

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
    skips = 0;
    maxX = 0;
    score = 0;
    elScore.textContent = "0";
  }

  function beginCharge() {
    if (state === "flight") return;
    if (state === "sunk" && resultTimer < 0.28) return;
    Sfx.ensure();
    if (state !== "charging") {
      resetStone();
      rollWind();
      charge = 0;
      cam.tx = 0;
      state = "charging";
      elMeter.hidden = false;
      elResult.classList.remove("show");
      Sfx.startCharge();
    }
    holding = true;
  }

  function qualityOf(p) {
    if (p >= SWEET_LO && p <= SWEET_HI) {
      const mid = (SWEET_LO + SWEET_HI) / 2;
      const half = (SWEET_HI - SWEET_LO) / 2;
      return 0.9 + 0.1 * (1 - Math.abs(p - mid) / half);
    }
    if (p < SWEET_LO) return Math.max(0.06, Math.pow(p / SWEET_LO, 1.6) * 0.62);
    const over = (p - SWEET_HI) / (1 - SWEET_HI);
    return Math.max(0.18, 0.7 - over * 0.52);
  }

  function throwAngle(p) {
    if (p >= SWEET_LO && p <= SWEET_HI) return 0.232 - (p - SWEET_LO) * 0.12;
    if (p < SWEET_LO) return 0.52 - p * 0.48;
    return 0.155 - (p - SWEET_HI) * 0.36;
  }

  function releaseThrow() {
    if (state !== "charging") return;
    holding = false;
    Sfx.stopCharge();
    elMeter.hidden = true;

    const p = Math.max(0.06, charge);
    const q = qualityOf(p);
    const speed = 170 + p * 360 + q * 80;
    const angle = throwAngle(p);

    throwQ = q;
    stone.vx = Math.cos(angle) * speed;
    stone.vy = -Math.sin(angle) * speed;
    stone.spin = 9 + p * 10 + q * 4;
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
    for (let i = 0; i < n; i++) {
      spray.push({
        x: x + (Math.random() - 0.5) * 8,
        y: y - Math.random() * 4,
        vx: vx * 0.15 + (Math.random() - 0.5) * 70,
        vy: -30 - Math.random() * 90,
        life: 0.35 + Math.random() * 0.35
      });
    }
    if (spray.length > 60) spray.splice(0, spray.length - 60);
  }

  function trySkip() {
    const spd = Math.hypot(stone.vx, stone.vy);
    const inc = Math.atan2(stone.vy, Math.max(40, stone.vx));
    const maxAng = 0.48;
    let canSkip = inc < maxAng && spd > 72 && stone.vx > 32;
    if (canSkip && throwQ < 0.55 && inc > 0.30 && skips === 0) canSkip = false;
    if (canSkip) {
      const keep = (0.80 - skips * 0.046) * (0.56 + 0.44 * (1 - inc / maxAng)) * (0.34 + 0.72 * throwQ);
      stone.vy = -Math.abs(stone.vy) * keep;
      if (throwQ > 0.88) stone.vy -= 14;
      stone.vx *= (0.92 - skips * 0.012) * (0.88 + 0.12 * throwQ);
      stone.y = -1.2;
      stone.tsx = 1.42;
      stone.tsy = 0.48;
      stone.spin *= 0.94;
      skips += 1;
      maxX = Math.max(maxX, stone.x);
      score = skips * 10 + Math.round(maxX * 0.12);
      elScore.textContent = String(score);
      cam.kick = -Math.min(16, 7 + skips * 0.45);
      cam.roll = (Math.random() < 0.5 ? -1 : 1) * 0.012;
      addRipple(stone.x, true);
      addRipple(stone.x + 10, false);
      addSpray(stone.x, 0, stone.vx, 9);
      scratches.push({ x: stone.x, life: 0.5 });
      Sfx.skip(skips);
      if (Math.abs(stone.vy) < 24 || stone.vx < 34) sink();
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
    if (score > best) {
      best = score;
      elBest.textContent = String(best);
      try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) {}
    }
    const label = skips === 1 ? "1 skip" : skips + " skips";
    elResult.hidden = false;
    elResult.textContent = label;
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
      if (holding) charge = Math.min(1, charge + dt / CHARGE_TIME);
      Sfx.setCharge(charge);
      elFill.style.width = (charge * 100).toFixed(1) + "%";
      const inSweet = charge >= SWEET_LO && charge <= SWEET_HI;
      elFill.style.background = inSweet
        ? "linear-gradient(90deg, #e8954a, #f3e0c2)"
        : "linear-gradient(90deg, #c9a27a, #f3e0c2)";
      const pull = charge * 18;
      stone.x = -pull;
      stone.y = -16 - charge * 3;
      stone.rot = -0.22 - charge * 0.35;
      stone.tsx = 1 + charge * 0.08;
      stone.tsy = 1 - charge * 0.1;
      cam.tx = -20 - charge * 12;
    }

    if (state === "flight") {
      stone.vy += GRAVITY * dt;
      stone.vx += wind * dt;
      stone.vx *= 1 - 0.05 * dt;
      stone.x += stone.vx * dt;
      stone.y += stone.vy * dt;
      stone.rot += stone.spin * dt * 0.2;
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
      stone.rot += dt * 0.8;
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
    const g = ctx.createLinearGradient(0, 0, 0, waterScreen + 8);
    g.addColorStop(0, "#0a0d1a");
    g.addColorStop(0.42, "#1a1630");
    g.addColorStop(0.72, "#4a2a38");
    g.addColorStop(0.88, "#c4653a");
    g.addColorStop(1, "#e8a05a");
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
    const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, H * 0.34);
    glow.addColorStop(0, "rgba(255, 196, 110, 0.85)");
    glow.addColorStop(0.18, "rgba(232, 140, 70, 0.28)");
    glow.addColorStop(0.5, "rgba(180, 70, 50, 0.08)");
    glow.addColorStop(1, "rgba(180, 70, 50, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, waterScreen + 2);

    ctx.beginPath();
    ctx.arc(sunX, sunY, Math.max(18, H * 0.038), 0, Math.PI * 2);
    ctx.fillStyle = "#ffc56a";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sunX - 3, sunY + 2, Math.max(18, H * 0.038) * 0.78, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 150, 70, 0.35)";
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

    const sunX = W * 0.71;
    const t = performance.now() * 0.001;
    const path = ctx.createLinearGradient(sunX, waterScreen, sunX, H);
    path.addColorStop(0, "rgba(255, 190, 110, 0.28)");
    path.addColorStop(0.35, "rgba(232, 140, 70, 0.08)");
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

    // reeds
    ctx.strokeStyle = "#121018";
    ctx.lineWidth = 1.4;
    ctx.lineCap = "round";
    for (let i = 0; i < 7; i++) {
      const rx = wx(-70 + i * 8);
      ctx.beginPath();
      ctx.moveTo(rx, wy(2));
      ctx.quadraticCurveTo(rx + 4, wy(-18 - (i % 3) * 6), rx + 2, wy(-28 - (i % 4) * 5));
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
      ctx.fillStyle = "rgba(220, 236, 240," + Math.max(0, p.life * 1.6) + ")";
      ctx.fillRect(wx(p.x), wy(p.y), 2, 2);
    }
  }

  function drawStone() {
    if (!stone.visible) return;
    const x = wx(stone.x);
    const y = wy(stone.y);
    const fade = stone.sinking ? Math.max(0, 1 - stone.sinking * 1.4) : 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(stone.rot + cam.roll);
    ctx.scale(stone.sx * scale, stone.sy * scale);
    ctx.globalAlpha = fade;

    ctx.fillStyle = "rgba(10, 16, 24, 0.28)";
    ctx.beginPath();
    ctx.ellipse(2, 5, 11, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#2a2724";
    ctx.beginPath();
    ctx.ellipse(0, 0, 11.5, 4.4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#3d3934";
    ctx.beginPath();
    ctx.ellipse(-1.5, -1.1, 8.2, 2.6, -0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(198, 186, 168, 0.35)";
    ctx.beginPath();
    ctx.ellipse(-3.2, -1.6, 3.6, 1.05, -0.15, 0, Math.PI * 2);
    ctx.fill();

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

  function isCreditLink(t) {
    return t && t.closest && t.closest("#credit a");
  }

  function down(e) {
    if (isCreditLink(e.target)) return;
    if (e.cancelable) e.preventDefault();
    holdPointer = true;
    beginCharge();
  }
  function up(e) {
    if (isCreditLink(e.target)) return;
    if (e && e.cancelable) e.preventDefault();
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

  resize();
  resetStone();
  rollWind();
  elHint.classList.add("show");
  requestAnimationFrame(frame);
})();
