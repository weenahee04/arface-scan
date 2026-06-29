/* ============================================================
   ARFACE — canvas fit
   The design is canvas-exact at 430px. On narrower viewports we
   scale the WHOLE canvas down proportionally (same approach as
   the original ARFACE app), so every screen from ~320px up shows
   the exact mockup layout. >=430px keeps normal behaviour
   (430 canvas, centered on desktop). No-JS fallback = fluid CSS.
   ============================================================ */
/* LINE in-app browser escape: LINE's WebView blocks the camera (getUserMedia).
   LINE officially opens any navigation carrying openExternalBrowser=1 in the
   system browser instead — so we bounce once, on every page. */
(function () {
  try {
    if (!/\bLine\/\d/i.test(navigator.userAgent)) return;
    var u = new URL(location.href);
    if (u.searchParams.get('openExternalBrowser') === '1') return;
    u.searchParams.set('openExternalBrowser', '1');
    location.replace(u.toString());
  } catch (e) {}
})();

(function () {
  var BASE = 430;     // canvas-exact design width
  var MAXUP = 1.6;    // cap up-scaling so the UI isn't oversized on very wide screens
  function fit() {
    var s = document.querySelector('.screen');
    if (!s) return;
    var vw = document.documentElement.clientWidth;
    var sc = vw / BASE;            // fill the width...
    if (sc > MAXUP) sc = MAXUP;    // ...but don't over-enlarge on iPad / desktop
    var target = BASE * sc;        // on-screen width after scaling
    s.style.width = BASE + 'px';
    s.style.transformOrigin = 'top left';
    s.style.transform = 'scale(' + sc + ')';
    s.style.left = Math.round((vw - target) / 2) + 'px';  // center horizontally
    document.body.style.display = 'block';
    document.body.style.padding = '0';
    document.documentElement.style.overflowX = 'hidden';
    document.body.style.overflowX = 'hidden';
    document.body.style.height = Math.ceil(s.offsetHeight * sc) + 'px';
  }
  addEventListener('resize', fit);
  addEventListener('orientationchange', fit);
  addEventListener('load', fit);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fit);
  else fit();
  if (window.ResizeObserver) {
    var el = document.querySelector('.screen');
    if (el) new ResizeObserver(fit).observe(el);
  }
})();
