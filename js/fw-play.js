/* Flatwater play loop */
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
  stone.x = 0; stone.y = -16; stone.vx = 0; stone.vy = 0;
  resetStoneGeom();
  stone.sinking = 0; stone.visible = true;
  trail.length = 0; spinRings.length = 0;
  skips = 0; maxX = 0; score = 0;
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
    charge = 0; chargeDir = 1;
    if (elFill) { elFill.style.left = "0%"; elFill.classList.remove("in-sweet"); }
    cam.tx = 0;
    state = "charging";
    elMeter.hidden = false;
    elResult.classList.remove("show");
    elResult.classList.remove("far-shore");
    Sfx.startCharge();
  }
  holding = true;
}
function clampAim(a) { return Math.max(AIM_LO, Math.min(AIM_HI, a)); }
function setAimFromPointer(clientX, clientY) {
  if (state !== "ready" && state !== "charging") return;
  const off = chargeDrawOffset();
  const x0 = wx(stone.x + off.x), y0 = wy(stone.y + off.y);
  aimAngle = clampAim(Math.atan2(y0 - clientY, Math.max(12, clientX - x0)));
}
function nudgeAim(dir) { aimAngle = clampAim(aimAngle + dir * 0.05); }
function releaseThrow() {
  if (state !== "charging") return;
  holding = false;
  Sfx.stopCharge();
  elMeter.hidden = true;
  const p = Math.max(0.06, charge);
  const att = throwAttitude(p);
  const speed = 130 + p * 440 + att.q * 30 + 55 * upgrades.arm;
  throwQ = att.q;
  applyThrowAttitude(att);
  stone.vx = Math.cos(aimAngle) * speed;
  stone.vy = -Math.sin(aimAngle) * speed;
  const sc = geomScale();
  stone.tsx = sc.sx * 1.18; stone.tsy = sc.sy * 0.82;
  skips = 0; maxX = stone.x; state = "flight"; thrownOnce = true;
  elHint.classList.remove("show"); elHint.classList.add("gone");
  Sfx.throw(); cam.kick = 4;
}
function sink() {
  if (state !== "flight") return;
  state = "sunk"; resultTimer = 0;
  stone.sinking = 0.0001; stone.vx *= 0.25; stone.vy = 22;
  addRipple(stone.x, true); addSpray(stone.x, 0, 10, 14); Sfx.sink();
  maxX = Math.max(maxX, stone.x);
  score = skips * 10 + Math.round(maxX * 0.12);
  elScore.textContent = String(score);
  const isNewBest = score > best;
  if (isNewBest) { best = score; elBest.textContent = String(best); }
  const gained = (skips < 1 ? 0 : Math.max(1, skips + Math.floor(score / 100))) + (isNewBest ? 2 : 0);
  pebbles += gained; persist(); refreshPebbles();
  if (shopOpen) renderShop();
  const justCleared = !cleared && allMaxed() && maxX >= FAR_SHORE;
  if (justCleared) { cleared = true; persist(); markClearedHud(); }
  elResult.hidden = false;
  if (justCleared) {
    elResult.classList.add("far-shore");
    elResult.innerHTML = "Far shore<span class=\"sub\">Level complete</span>";
  } else {
    elResult.classList.remove("far-shore");
    elResult.textContent = (skips === 1 ? "1 skip" : skips + " skips") + (isNewBest ? " · new best" : "") + " · +" + gained + " pebbles";
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
  const gs = geomScale();
  stone.tsx += (gs.sx - stone.tsx) * (1 - Math.exp(-dt * 5));
  stone.tsy += (gs.sy - stone.tsy) * (1 - Math.exp(-dt * 5));
  if (state === "ready") { stepStoneReady(); cam.tx = -20; cam.ty = 0; }
  if (state === "charging") {
    if (holding) {
      charge += chargeDir * dt / chargeTime();
      if (charge >= 1) { charge = 1; chargeDir = -1; }
      if (charge <= 0) { charge = 0; chargeDir = 1; }
    }
    Sfx.setCharge(charge);
    elFill.style.left = (charge * 100).toFixed(1) + "%";
    if (charge >= sweetLo() && charge <= sweetHi()) elFill.classList.add("in-sweet");
    else elFill.classList.remove("in-sweet");
    stone.x = -(charge * 18);
    stone.y = -16 - charge * 3;
    stepStoneCharge();
    cam.tx = -20 - charge * (12 + upgrades.hold * 2.2);
  }
  if (state === "flight") stepStoneFlight(dt);
  if (state === "sunk") {
    resultTimer += dt; stone.sinking += dt; stone.y += 28 * dt; stone.x += stone.vx * dt;
    stepStoneSunk(dt); cam.tx = stone.x - 80;
    if (stone.sinking > 0.7) stone.visible = false;
    if (resultTimer > 1.35) { state = "ready"; resetStone(); elResult.classList.remove("show"); rollWind(); }
  }
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i]; r.r += dt * (r.max * 1.15); r.a *= Math.pow(0.12, dt);
    if (r.a < 0.02 || r.r > r.max) ripples.splice(i, 1);
  }
  for (let i = spray.length - 1; i >= 0; i--) {
    const p = spray[i]; p.vy += 520 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    if (p.life <= 0 || p.y > 8) spray.splice(i, 1);
  }
  for (let i = scratches.length - 1; i >= 0; i--) {
    scratches[i].life -= dt; if (scratches[i].life <= 0) scratches.splice(i, 1);
  }
  for (let i = trail.length - 1; i >= 0; i--) {
    trail[i].life -= dt; if (trail[i].life <= 0) trail.splice(i, 1);
  }
  for (let i = spinRings.length - 1; i >= 0; i--) {
    const g = spinRings[i]; g.r += dt * 48; g.life -= dt; g.a *= Math.pow(0.08, dt);
    if (g.life <= 0 || g.a < 0.02) spinRings.splice(i, 1);
  }
  if (Math.random() < dt * 0.35) ambient.push({ x: cam.x + 80 + Math.random() * 520, r: 2, max: 22 + Math.random() * 18, a: 0.16 });
  for (let i = ambient.length - 1; i >= 0; i--) {
    const a = ambient[i]; a.r += dt * 16; a.a *= Math.pow(0.25, dt);
    if (a.a < 0.02) ambient.splice(i, 1);
  }
}
