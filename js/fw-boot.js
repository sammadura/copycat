/* Flatwater */
"use strict";
  function render() {
    drawSky();
    drawRidge(ridges.far, waterScreen + 6, H * 0.22, "#14101c", 0.12);
    drawRidge(ridges.mid, waterScreen + 4, H * 0.28, "#0e0b14", 0.22);
    drawCabinLight();
    drawWater();
    drawReflectedRidge(ridges.far, waterScreen + 6, H * 0.22, "rgba(12, 18, 26, 0.55)", 0.12);
    drawReflectedRidge(ridges.mid, waterScreen + 4, H * 0.28, "rgba(8, 12, 18, 0.7)", 0.22);
    drawLandmarks();
    drawRipples();
    drawShore();
    drawChargeLine();
    drawAimLine();
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
    beginAim(e.clientY);
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
  window.addEventListener("pointermove", function (e) {
    if (shopOpen || isUi(e.target)) return;
    if (state !== "charging" && !holdPointer) return;
    if (e.cancelable) e.preventDefault();
    setAimFromPointer(e.clientY);
  }, { passive: false });
  window.addEventListener("pointerup", up, { passive: false });
  window.addEventListener("pointercancel", up, { passive: false });
  window.addEventListener("contextmenu", function (e) { e.preventDefault(); });

  window.addEventListener("keydown", function (e) {
    if (shopOpen) return;
    if (e.code === "ArrowUp" || e.code === "KeyW") {
      e.preventDefault();
      nudgeAim(1);
      return;
    }
    if (e.code === "ArrowDown" || e.code === "KeyS") {
      e.preventDefault();
      nudgeAim(-1);
      return;
    }
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
  markClearedHud();
  renderShop();
  resize();
  resetStone();
  rollWind();
  refreshHint();
  elHint.classList.add("show");
  requestAnimationFrame(frame);
