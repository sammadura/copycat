/* Flatwater — script loader (keeps game.js small so GitHub can host it). */
(function () {
  var files = ["js/fw-core.js?v=7", "js/fw-draw.js?v=7", "js/fw-boot.js?v=7"];
  function next(i) {
    if (i >= files.length) return;
    var s = document.createElement("script");
    s.src = files[i];
    s.onload = function () { next(i + 1); };
    document.head.appendChild(s);
  }
  next(0);
})();
