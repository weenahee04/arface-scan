/* ARFACE Clinic — desktop workstation (Phase 1 shell).
   Cosmetic interactions for now; camera + engine + customer DB wired next. */
(function () {
  // tabs
  var tabs = document.querySelectorAll('.tab');
  tabs.forEach(function (t) {
    t.addEventListener('click', function () {
      tabs.forEach(function (x) { x.classList.remove('on'); });
      t.classList.add('on');
    });
  });
  // customer selection
  var custs = document.querySelectorAll('.cust');
  custs.forEach(function (c) {
    c.addEventListener('click', function () {
      custs.forEach(function (x) { x.classList.remove('on'); });
      c.classList.add('on');
    });
  });
})();
