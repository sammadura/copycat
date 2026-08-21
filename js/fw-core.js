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
