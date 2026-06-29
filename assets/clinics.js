/* ARFACE — filler price estimator + brand price guide + clinic comparison.
   HONESTY: filler brand names are real (factual product names); prices are APPROXIMATE
   market ranges (THB/cc) labelled "โดยประมาณ", NOT quotes; clinic rows are clearly-labelled
   SAMPLE data (sample:true) with placeholder logos — replace with real, licensed data later.
   CSP-safe (external script). */
(function () {
  var AREAS = [
    { id: 'temple', label: 'ขมับ', cc: 2.0 },
    { id: 'eye', label: 'ใต้ตา', cc: 1.0 },
    { id: 'naso', label: 'ร่องแก้ม', cc: 1.0 },
    { id: 'lips', label: 'ปาก', cc: 0.8 },
    { id: 'chin', label: 'คาง', cc: 1.0 },
  ];
  var TIERS = [
    { id: 'std',  label: 'มาตรฐาน (เอเชีย)', brands: 'Neuramis · Princess · e.p.t.q.', perCc: [8000, 12000] },
    { id: 'mid',  label: 'กลาง (ยุโรป)',     brands: 'Belotero · Teosyal · Stylage',   perCc: [12000, 18000] },
    { id: 'prem', label: 'พรีเมียม',         brands: 'Juvéderm · Restylane',           perCc: [18000, 28000] },
  ];
  var tierById = {}; TIERS.forEach(function (t) { tierById[t.id] = t; });
  /* sample clinics — DEMO ONLY, not real data */
  var CLINICS = [
    { name: 'ตัวอย่าง คลินิก A', province: 'กรุงเทพฯ', tier: 'prem' },
    { name: 'ตัวอย่าง คลินิก B', province: 'กรุงเทพฯ', tier: 'mid' },
    { name: 'ตัวอย่าง คลินิก C', province: 'เชียงใหม่', tier: 'std' },
    { name: 'ตัวอย่าง คลินิก D', province: 'ชลบุรี', tier: 'mid' },
    { name: 'ตัวอย่าง คลินิก E', province: 'ภูเก็ต', tier: 'prem' },
    { name: 'ตัวอย่าง คลินิก F', province: 'กรุงเทพฯ', tier: 'std' },
    { name: 'ตัวอย่าง คลินิก G', province: 'ขอนแก่น', tier: 'std' },
    { name: 'ตัวอย่าง คลินิก H', province: 'กรุงเทพฯ', tier: 'mid' },
  ];

  var fmt = function (n) { return Math.round(n).toLocaleString('en-US'); };
  var el = function (t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };

  /* ---------- estimator state ---------- */
  var sel = {};                       // areaId -> cc (only present when selected)
  var tierId = 'mid';

  function totalCc() { var s = 0; for (var k in sel) s += sel[k]; return Math.round(s * 10) / 10; }
  function renderTotal() {
    var cc = totalCc(), t = tierById[tierId];
    var box = document.getElementById('total');
    if (!cc) { box.innerHTML = '<div class="t-empty">เลือกจุดที่อยากฉีดด้านบนเพื่อดูงบประมาณ</div>'; return; }
    var lo = cc * t.perCc[0], hi = cc * t.perCc[1];
    box.innerHTML = '<div class="t-row"><span>รวมที่เลือก</span><b>' + cc + ' cc</b></div>'
      + '<div class="t-row"><span>ระดับ ' + esc(t.label) + ' (' + fmt(t.perCc[0]) + '–' + fmt(t.perCc[1]) + '/cc)</span></div>'
      + '<div class="t-budget"><span>งบประมาณโดยประมาณ</span><b>฿' + fmt(lo) + ' – ' + fmt(hi) + '</b></div>';
  }
  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }

  /* ---------- area rows ---------- */
  var areasBox = document.getElementById('areas');
  AREAS.forEach(function (a) {
    var row = el('div', 'arow'); row.setAttribute('data-id', a.id);
    var tog = el('button', 'tog'); tog.type = 'button'; tog.setAttribute('aria-pressed', 'false');
    tog.innerHTML = '<i></i>';
    var name = el('span', 'aname', a.label);
    var step = el('div', 'step');
    var minus = el('button', 'sb', '−'); minus.type = 'button';
    var val = el('span', 'sv', a.cc.toFixed(1) + ' cc');
    var plus = el('button', 'sb', '+'); plus.type = 'button';
    step.appendChild(minus); step.appendChild(val); step.appendChild(plus);
    row.appendChild(tog); row.appendChild(name); row.appendChild(step);
    areasBox.appendChild(row);

    var cur = a.cc;
    function paint() { val.textContent = cur.toFixed(1) + ' cc'; }
    tog.addEventListener('click', function () {
      if (sel[a.id] != null) { delete sel[a.id]; row.classList.remove('on'); tog.setAttribute('aria-pressed', 'false'); }
      else { sel[a.id] = cur; row.classList.add('on'); tog.setAttribute('aria-pressed', 'true'); }
      renderTotal();
    });
    minus.addEventListener('click', function () { cur = Math.max(0.5, Math.round((cur - 0.5) * 10) / 10); paint(); if (sel[a.id] != null) { sel[a.id] = cur; renderTotal(); } });
    plus.addEventListener('click', function () { cur = Math.min(6, Math.round((cur + 0.5) * 10) / 10); paint(); if (sel[a.id] != null) { sel[a.id] = cur; renderTotal(); } });
  });

  /* ---------- tier select ---------- */
  var tierSel = document.getElementById('tier');
  TIERS.forEach(function (t) { var o = document.createElement('option'); o.value = t.id; o.textContent = t.label + ' · ' + fmt(t.perCc[0]) + '–' + fmt(t.perCc[1]) + '/cc'; tierSel.appendChild(o); });
  tierSel.value = tierId;
  tierSel.addEventListener('change', function () { tierId = tierSel.value; renderTotal(); });
  renderTotal();

  /* ---------- brand guide ---------- */
  var bg = document.getElementById('brandguide');
  if (bg) {
    bg.innerHTML = TIERS.map(function (t) {
      return '<div class="brow"><div class="bk"><div class="btier">' + esc(t.label) + '</div><div class="bbr">' + esc(t.brands) + '</div></div>'
        + '<div class="bp">฿' + fmt(t.perCc[0]) + ' – ' + fmt(t.perCc[1]) + '<small>/cc</small></div></div>';
    }).join('');
  }

  /* ---------- clinic comparison + filters ---------- */
  var fTier = 'all', fQ = '';
  var chipsBox = document.getElementById('tierchips');
  var chipDefs = [{ id: 'all', label: 'ทั้งหมด' }].concat(TIERS.map(function (t) { return { id: t.id, label: t.label.split(' ')[0] }; }));
  chipDefs.forEach(function (c) {
    var b = el('button', 'chip' + (c.id === 'all' ? ' on' : ''), c.label); b.type = 'button'; b.setAttribute('data-tier', c.id);
    b.addEventListener('click', function () {
      fTier = c.id;
      chipsBox.querySelectorAll('.chip').forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on'); renderClinics();
    });
    chipsBox.appendChild(b);
  });
  var q = document.getElementById('q');
  if (q) q.addEventListener('input', function () { fQ = q.value.trim(); renderClinics(); });

  function logoMark(name) {
    var m = el('div', 'logo'); m.textContent = (name.replace('ตัวอย่าง คลินิก ', '') || '?').slice(0, 1); return m;
  }
  function renderClinics() {
    var list = document.getElementById('cliniclist');
    var rows = CLINICS.filter(function (c) {
      if (fTier !== 'all' && c.tier !== fTier) return false;
      if (fQ && (c.name + ' ' + c.province).indexOf(fQ) < 0) return false;
      return true;
    });
    list.innerHTML = '';
    if (!rows.length) { list.appendChild(el('div', 'empty', 'ไม่พบคลินิกตามเงื่อนไข')); return; }
    rows.forEach(function (c) {
      var t = tierById[c.tier];
      var card = el('div', 'clinic');
      card.appendChild(logoMark(c.name));
      var mid = el('div', 'cm');
      var r1 = el('div', 'cn'); r1.appendChild(el('span', null, c.name)); r1.appendChild(el('span', 'demo', 'ตัวอย่าง'));
      mid.appendChild(r1);
      mid.appendChild(el('div', 'cmeta', c.province + ' · ' + t.label));
      card.appendChild(mid);
      var pr = el('div', 'cp'); pr.innerHTML = '฿' + fmt(t.perCc[0] / 1000) + 'k–' + fmt(t.perCc[1] / 1000) + 'k<small>/cc</small>';
      card.appendChild(pr);
      list.appendChild(card);
    });
  }
  renderClinics();
})();
