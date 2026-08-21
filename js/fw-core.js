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
  const ALPHA_STAR = 0.349;
  const BETA_MAX = Math.PI * 0.25;
  const ALPHA_MAX = 0.70;
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
    rot: -0.349, spin: 0,
    sx: 1, sy: 1,
    tsx: 1, tsy: 1,
    sinking: 0, visible: true,
    alpha: 0.349, alphaDot: 0, omega: 0, phi: 0,
    R: 0.85, e: 1.35
  };

  let state = "ready";
  let charge = 0;
  let chargeDir = 1;
  const AIM_LO = -0.90;
  const AIM_HI = 0.48;
  const AIM_DEFAULT = 0.22;
  let aimAngle = AIM_DEFAULT;
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
