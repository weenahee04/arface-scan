/* ARFACE — PWA install button.
   Shows the in-app "ติดตั้งแอป" button only when the browser offers installation
   (Chrome/Edge/Android via beforeinstallprompt). Hidden once installed or when
   already running as an installed app (standalone). */
(function () {
  var btn = document.getElementById('install-btn');
  if (!btn) return;
  var deferred = null;

  var standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
  if (standalone) return; // already installed — nothing to offer

  function show() { btn.style.display = 'inline-flex'; }
  function hide() { btn.style.display = 'none'; }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();       // keep the event so we can trigger it from our own button
    deferred = e;
    show();
  });

  btn.addEventListener('click', function () {
    if (!deferred) return;
    deferred.prompt();
    deferred.userChoice.then(function () { deferred = null; hide(); });
  });

  window.addEventListener('appinstalled', function () { deferred = null; hide(); });

  /* QA hook: ?installtest=1 force-shows the button to verify placement/styling */
  if (new URLSearchParams(location.search).get('installtest') === '1') show();
})();
