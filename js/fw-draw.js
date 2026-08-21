/* Flatwater */
"use strict";
  function drawSky() {
    const eye = upgrades.eye;
    const u = eye / 5;
    const g = ctx.createLinearGradient(0, 0, 0, waterScreen + 8);
    if (eye >= 5) {
      g.addColorStop(0, "#c5d8ea");
      g.addColorStop(0.28, "#dce6ee");
      g.addColorStop(0.52, "#f0d8b0");
      g.addColorStop(0.78, "#ffc878");
      g.addColorStop(1, "#ffe6b4");
    } else if (eye >= 3) {
      const d = (eye - 2) / 3;
      g.addColorStop(0, rgb3(mix(18, 88, d), mix(20, 118, d), mix(40, 152, d)));
      g.addColorStop(0.4, rgb3(mix(42, 150, d), mix(36, 150, d), mix(70, 170, d)));
      g.addColorStop(0.68, rgb3(mix(120, 230, d), mix(70, 170, d), mix(60, 140, d)));
      g.addColorStop(0.86, rgb3(mix(210, 255, d), mix(130, 196, d), mix(70, 140, d)));
      g.addColorStop(1, rgb3(mix(236, 255, d), mix(176, 220, d), mix(100, 168, d)));
    } else {
      g.addColorStop(0, rgb3(mix(10, 36, u * 2.5), mix(13, 40, u * 2.5), mix(26, 70, u * 2.5)));
      g.addColorStop(0.42, rgb3(mix(26, 50, u * 2.5), mix(22, 48, u * 2.5), mix(48, 86, u * 2.5)));
      g.addColorStop(0.72, rgb3(mix(74, 96, u), mix(42, 64, u), mix(56, 72, u)));
      g.addColorStop(0.88, rgb3(mix(196, 220, u), mix(101, 130, u), mix(58, 80, u)));
      g.addColorStop(1, rgb3(mix(232, 244, u), mix(160, 190, u), mix(90, 120, u)));
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const t = performance.now() * 0.001;
    const starFade = eye >= 5 ? 0 : Math.max(0, 1 - eye * 0.22);
    if (starFade > 0.02) {
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        const tw = 0.55 + 0.45 * Math.sin(t * 1.4 + s.tw);
        ctx.fillStyle = "rgba(243,224,194," + (s.a * tw * starFade) + ")";
        ctx.beginPath();
        ctx.arc(s.x * W, s.y * waterScreen, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const sun = sunPos();
    const sunX = sun.x;
    const sunY = sun.y;
    const glowR = H * (0.34 + eye * 0.04 + (eye >= 5 ? 0.08 : 0));
    const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, glowR);
    glow.addColorStop(0, "rgba(255, " + (196 + eye * 8) + ", " + (110 + eye * 4) + ", " + (0.85 + eye * 0.03).toFixed(3) + ")");
    glow.addColorStop(0.18, "rgba(232, 140, 70, " + (0.28 + eye * 0.06).toFixed(3) + ")");
    glow.addColorStop(0.5, "rgba(180, 70, 50, " + (0.08 + eye * 0.02).toFixed(3) + ")");
    glow.addColorStop(1, "rgba(180, 70, 50, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, waterScreen + 2);

    const sunR = Math.max(18, H * 0.038) * (1 + eye * 0.055);
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.fillStyle = eye >= 5 ? "#ffe9a8" : (eye ? "#ffd078" : "#ffc56a");
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
    const eye = upgrades.eye;
    const g = ctx.createLinearGradient(0, waterScreen, 0, H);
    const wu = eye / 5;
    g.addColorStop(0, rgb3(mix(27, 62, wu), mix(58, 110, wu), mix(74, 130, wu)));
    g.addColorStop(0.18, rgb3(mix(18, 42, wu), mix(48, 88, wu), mix(64, 108, wu)));
    g.addColorStop(0.55, rgb3(mix(12, 24, wu), mix(30, 52, wu), mix(46, 70, wu)));
    g.addColorStop(1, rgb3(mix(7, 14, wu), mix(16, 28, wu), mix(24, 36, wu)));
    ctx.fillStyle = g;
    ctx.fillRect(0, waterScreen, W, H - waterScreen);

    const sun = sunPos();
    const sunX = sun.x;
    const t = performance.now() * 0.001;
    const path = ctx.createLinearGradient(sunX, waterScreen, sunX, H);
    path.addColorStop(0, "rgba(255, 190, 110, " + (0.28 + eye * 0.09).toFixed(3) + ")");
    path.addColorStop(0.35, "rgba(232, 140, 70, " + (0.08 + eye * 0.05).toFixed(3) + ")");
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

    if (eye >= 3) {
      const n = 10 + eye * 7;
      for (let i = 0; i < n; i++) {
        const gy = waterScreen + 8 + ((i * 41 + ((t * 36) | 0)) % Math.max(12, H - waterScreen - 12));
        const wob = Math.sin(gy * 0.09 + t * 2.4 + i) * (6 + (gy - waterScreen) * 0.03);
        const gx = sunX + wob + (i % 5 - 2) * (7 + eye);
        const ga = (0.1 + eye * 0.07) * (0.35 + 0.65 * Math.abs(Math.sin(t * 3.2 + i * 0.7)));
        ctx.fillStyle = "rgba(255, 230, 170, " + ga + ")";
        ctx.fillRect(gx, gy, 1.5 + eye * 0.2, 1.5);
      }
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
      ctx.strokeStyle = "rgba(90, 78, 62, " + (0.16 + upgrades.hold * 0.05) + ")";
      ctx.beginPath();
      ctx.moveTo(wx(-42), wy(2.4));
      ctx.lineTo(wx(20), wy(3.1));
      ctx.stroke();
      if (upgrades.hold >= 1) {
        ctx.fillStyle = "rgba(28, 24, 20, " + (0.35 + upgrades.hold * 0.08) + ")";
        ctx.beginPath();
        ctx.moveTo(wx(-36), wy(-2.2));
        ctx.lineTo(wx(8), wy(-1.6));
        ctx.lineTo(wx(6), wy(-0.2));
        ctx.lineTo(wx(-38), wy(-0.6));
        ctx.closePath();
        ctx.fill();
      }
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

  function drawAimLine() {
    if (state !== "ready" && state !== "charging") return;
    const off = chargeDrawOffset();
    const x0 = wx(stone.x + off.x);
    const y0 = wy(stone.y + off.y);
    const len = 56;
    const x1 = x0 + Math.cos(aimAngle) * len;
    const y1 = y0 - Math.sin(aimAngle) * len;
    ctx.save();
    ctx.strokeStyle = "rgba(243, 224, 194, 0.32)";
    ctx.lineWidth = 1.15;
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.2;
    ctx.beginPath();
    ctx.arc(x0, y0, 12, -aimAngle - 0.22, -aimAngle + 0.08);
    ctx.stroke();
    ctx.restore();
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

  function lmX(x, par) {
    if (par == null) par = 0.94;
    return (x - cam.x * par) * scale + W * 0.22;
  }

  function drawCabinLight() {
    if (upgrades.eye < 2) return;
    const x = W * 0.84 - cam.x * 0.09;
    const y = waterScreen - H * 0.155;
    const glow = ctx.createRadialGradient(x, y, 1, x, y, 22 + upgrades.eye * 3);
    glow.addColorStop(0, "rgba(255, 200, 120, 0.7)");
    glow.addColorStop(0.35, "rgba(232, 149, 74, 0.22)");
    glow.addColorStop(1, "rgba(232, 149, 74, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, 24 + upgrades.eye * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(22, 16, 14, 0.85)";
    ctx.fillRect(x - 7, y - 5, 14, 10);
    ctx.fillStyle = "#f0c878";
    ctx.fillRect(x - 3.5, y - 2, 7, 5);
  }

  function drawLandmarks() {
    const tot = totalLevels();
    const t = performance.now() * 0.001;
    const hold = upgrades.hold;
    const face = upgrades.face;
    const spin = upgrades.spin;
    const arm = upgrades.arm;
    const eye = upgrades.eye;

    if (spin >= 1) {
      ctx.save();
      ctx.globalAlpha = 0.07 + spin * 0.025;
      ctx.strokeStyle = "rgba(210, 230, 236, 0.9)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 5 + spin; i++) {
        const y0 = 2 + i * 1.1;
        const x0 = 380 + i * 90;
        ctx.beginPath();
        for (let s = 0; s < 7; s++) {
          const xx = lmX(x0 + s * 28, 0.9);
          const yy = wy(y0 + Math.sin(t * 0.8 + i + s * 0.6) * 0.8);
          if (s === 0) ctx.moveTo(xx, yy);
          else ctx.lineTo(xx, yy);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    if (hold >= 5) {
      const jx = 280;
      ctx.fillStyle = "#1a1614";
      ctx.beginPath();
      ctx.moveTo(lmX(jx - 22), wy(-2));
      ctx.lineTo(lmX(jx + 26), wy(-1.5));
      ctx.lineTo(lmX(jx + 22), wy(3));
      ctx.lineTo(lmX(jx - 24), wy(3.4));
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(90, 78, 62, 0.55)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(lmX(jx - 20), wy(0.4));
      ctx.lineTo(lmX(jx + 20), wy(0.8));
      ctx.stroke();
      ctx.fillStyle = "#0c0a10";
      ctx.fillRect(lmX(jx - 18), wy(2), 3 * scale, 7 * scale);
      ctx.fillRect(lmX(jx + 12), wy(2), 3 * scale, 6 * scale);
    }

    if (face >= 1) {
      ctx.fillStyle = "rgba(16, 20, 26, 0.72)";
      ctx.beginPath();
      ctx.ellipse(lmX(420), wy(1.6), 34 * scale, 6.2 * scale, -0.04, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(28, 32, 38, 0.45)";
      ctx.beginPath();
      ctx.ellipse(lmX(428), wy(0.4), 16 * scale, 3.2 * scale, 0.08, 0, Math.PI * 2);
      ctx.fill();
    }

    if (face >= 3) {
      ctx.fillStyle = "rgba(186, 156, 112, 0.32)";
      ctx.beginPath();
      ctx.ellipse(lmX(900), wy(1.2), 70 * scale, 7.5 * scale, 0.02, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(210, 180, 130, 0.18)";
      ctx.beginPath();
      ctx.ellipse(lmX(888), wy(0.2), 28 * scale, 3.4 * scale, -0.05, 0, Math.PI * 2);
      ctx.fill();
    }

    if (arm >= 1) {
      ctx.fillStyle = "#141018";
      ctx.beginPath();
      ctx.ellipse(lmX(560), wy(-2), 16 * scale, 9 * scale, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1c1816";
      ctx.beginPath();
      ctx.ellipse(lmX(554), wy(-5), 9 * scale, 6 * scale, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(10, 10, 12, 0.35)";
      ctx.beginPath();
      ctx.ellipse(lmX(560), wy(2), 20 * scale, 4 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (spin >= 3) {
      ctx.save();
      ctx.strokeStyle = "rgba(200, 220, 228, " + (0.16 + 0.03 * Math.sin(t * 1.4)) + ")";
      ctx.lineWidth = 1.1;
      for (let r = 16; r <= 42; r += 13) {
        ctx.beginPath();
        ctx.ellipse(lmX(1100), wy(0.6), r * scale, r * scale * 0.22, t * 0.15, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (arm >= 3) {
      const hx = 1400;
      ctx.fillStyle = "#161014";
      ctx.beginPath();
      ctx.moveTo(lmX(hx - 36), wy(-1));
      ctx.lineTo(lmX(hx + 40), wy(-8));
      ctx.lineTo(lmX(hx + 46), wy(-2));
      ctx.lineTo(lmX(hx + 18), wy(4));
      ctx.lineTo(lmX(hx - 30), wy(5));
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(70, 58, 50, 0.55)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(lmX(hx - 10), wy(-2));
      ctx.lineTo(lmX(hx + 8), wy(-18));
      ctx.stroke();
      ctx.fillStyle = "rgba(12, 10, 12, 0.4)";
      ctx.beginPath();
      ctx.ellipse(lmX(hx), wy(3), 40 * scale, 5 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (eye >= 4 || tot >= 16) {
      const ix = 1800;
      ctx.fillStyle = "#12141a";
      ctx.beginPath();
      ctx.moveTo(lmX(ix - 48, 0.88), wy(4));
      ctx.lineTo(lmX(ix - 20, 0.88), wy(-10));
      ctx.lineTo(lmX(ix + 6, 0.88), wy(-16));
      ctx.lineTo(lmX(ix + 28, 0.88), wy(-7));
      ctx.lineTo(lmX(ix + 52, 0.88), wy(4));
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#0c0e12";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(lmX(ix + 4, 0.88), wy(-15));
      ctx.quadraticCurveTo(lmX(ix - 2, 0.88), wy(-28), lmX(ix + 10, 0.88), wy(-34));
      ctx.stroke();
      ctx.fillStyle = "rgba(14, 16, 22, 0.45)";
      ctx.beginPath();
      ctx.ellipse(lmX(ix, 0.9), wy(3), 50 * scale, 5 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const shoreX = FAR_SHORE;
    if (tot < 12) {
      ctx.save();
      ctx.globalAlpha = 0.06;
      const fog = ctx.createLinearGradient(lmX(shoreX - 80, 0.82), 0, lmX(shoreX + 40, 0.82), 0);
      fog.addColorStop(0, "rgba(180, 190, 200, 0)");
      fog.addColorStop(0.6, "rgba(200, 208, 216, 0.5)");
      fog.addColorStop(1, "rgba(200, 208, 216, 0)");
      ctx.fillStyle = fog;
      ctx.fillRect(lmX(shoreX - 90, 0.82), waterScreen - 20, 160 * scale, H - waterScreen + 20);
      ctx.restore();
    } else {
      const solid = tot >= 20;
      const a = solid ? 1 : 0.38;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = solid ? "#141018" : "rgba(28, 30, 36, 0.7)";
      ctx.beginPath();
      ctx.moveTo(lmX(shoreX - 10, 0.92), H);
      ctx.lineTo(lmX(shoreX - 4, 0.92), wy(-6));
      ctx.lineTo(lmX(shoreX + 40, 0.88), wy(-22));
      ctx.lineTo(lmX(shoreX + 90, 0.86), wy(-18));
      ctx.lineTo(lmX(shoreX + 160, 0.84), wy(-36));
      ctx.lineTo(lmX(shoreX + 240, 0.82), H);
      ctx.closePath();
      ctx.fill();
      if (!solid) {
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = "rgba(200, 210, 220, 0.5)";
        ctx.fillRect(lmX(shoreX - 30, 0.85), waterScreen - 8, 200 * scale, 28);
      } else {
        ctx.fillStyle = "#0e0c10";
        ctx.beginPath();
        ctx.moveTo(lmX(shoreX - 8, 0.93), wy(2));
        ctx.lineTo(lmX(shoreX + 70, 0.9), wy(1));
        ctx.lineTo(lmX(shoreX + 66, 0.9), wy(6));
        ctx.lineTo(lmX(shoreX - 12, 0.93), wy(7));
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawVignette() {
    const v = ctx.createRadialGradient(W * 0.5, H * 0.45, H * 0.2, W * 0.5, H * 0.5, H * 0.78);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(4, 6, 12, 0.42)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }
