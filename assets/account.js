/* ARFACE — account.html: clinic subscription dashboard. Renders org + usage + plans from the API. */
(function () {
  var API = window.ARFACE_API;
  if (!API.isAuthed()) { location.replace('login.html'); return; }
  var content = document.getElementById('content');
  var fmt = function (n) { return Math.round(n).toLocaleString('en-US'); };
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function date(ts) { try { return new Date(ts).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }); } catch (e) { return ''; } }

  function load() {
    content.innerHTML = '<div class="loading">กำลังโหลด…</div>';
    Promise.all([API.me(), API.plans()])
      .then(function (r) { render(r[0], r[1].plans); })
      .catch(function (ex) {
        if (ex.status === 401) { API.clear(); location.replace('login.html'); return; }
        content.innerHTML = '';
        var box = el('div', 'card');
        box.appendChild(el('div', null, ex.offline ? 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — ตรวจว่ารัน API (node server/server.js) อยู่ที่ ' + API.base : ('โหลดข้อมูลไม่สำเร็จ: ' + ex.message)));
        content.appendChild(box);
        content.appendChild(logoutBtn());
      });
  }

  function logoutBtn() {
    var b = el('button', 'logout', 'ออกจากระบบ'); b.type = 'button';
    b.addEventListener('click', function () { API.logout(); location.replace('login.html'); });
    return b;
  }

  function render(me, plans) {
    content.innerHTML = '';
    var planByCode = {}; plans.forEach(function (p) { planByCode[p.code] = p; });
    var cur = planByCode[me.subscription.plan_code] || { name: me.subscription.plan_code, scan_quota: me.usage.quota };
    var used = me.usage.used, quota = me.usage.quota, pct = quota ? Math.min(100, Math.round(used / quota * 100)) : 0;
    var statusTh = { trialing: 'ทดลองใช้', active: 'ใช้งาน', expired: 'หมดอายุ', canceled: 'ยกเลิกแล้ว', past_due: 'ค้างชำระ' };

    /* org header */
    var head = el('div', 'card');
    var org = el('div', 'org');
    org.appendChild(el('div', 'av', (me.org.name || '?').trim().slice(0, 1)));
    var oi = el('div', 'oi');
    oi.appendChild(el('b', null, me.org.name));
    var pl = el('div', 'pl');
    pl.appendChild(el('span', 'badge', cur.name));
    pl.appendChild(el('span', null, '· ' + (statusTh[me.subscription.status] || me.subscription.status)));
    oi.appendChild(pl);
    org.appendChild(oi); head.appendChild(org);
    content.appendChild(head);

    /* usage */
    var uc = el('div', 'card');
    var urow = el('div', 'urow');
    var big = el('div', 'big'); big.innerHTML = fmt(used) + ' <small>/ ' + fmt(quota) + ' สแกน</small>';
    urow.appendChild(big);
    urow.appendChild(el('div', 'rem', 'เหลือ ' + fmt(me.usage.remaining)));
    uc.appendChild(urow);
    var bar = el('div', 'ubar'); var fill = el('i'); fill.style.width = pct + '%';
    if (pct >= 100) fill.className = 'full'; else if (pct >= 80) fill.className = 'warn';
    bar.appendChild(fill); uc.appendChild(bar);
    uc.appendChild(el('div', 'uperiod', 'รอบ: ' + date(me.subscription.period_start) + ' – ' + date(me.subscription.period_end)));
    content.appendChild(uc);

    /* plans */
    content.appendChild(el('div', 'sect', 'แพ็กเกจ'));
    plans.forEach(function (p) {
      if (p.code === 'trial' && me.subscription.plan_code !== 'trial') return; // hide trial once upgraded
      var isCur = p.code === me.subscription.plan_code;
      var card = el('div', 'plan' + (isCur ? ' cur' : ''));
      var pm = el('div', 'pm');
      pm.appendChild(el('div', 'pn', p.name));
      var desc = p.code === 'enterprise' ? 'สแกนไม่จำกัด · คุยราคา'
        : (fmt(p.scan_quota) + ' สแกน/เดือน' + (p.overage_per_scan ? ' · เกิน ฿' + p.overage_per_scan + '/รูป' : ''));
      pm.appendChild(el('div', 'pd', desc));
      card.appendChild(pm);
      var pp = el('div', 'pp');
      if (p.price_month) { var amt = el('div', 'amt', '฿' + fmt(p.price_month)); pp.appendChild(amt); pp.appendChild(el('div', 'per', '/เดือน')); }
      else pp.appendChild(el('div', 'amt', p.code === 'trial' ? 'ฟรี' : 'ติดต่อ'));
      if (isCur) pp.appendChild(el('div', 'pcur', '✓ ปัจจุบัน'));
      else if (p.code !== 'trial' && me.user.role === 'owner') {
        var btn = el('button', 'pbtn', p.code === 'enterprise' ? 'ติดต่อทีมงาน' : 'เลือกแพ็กเกจนี้'); btn.type = 'button';
        if (p.code === 'enterprise') btn.addEventListener('click', function () { alert('ติดต่อทีมงานสำหรับแพ็กเกจ Enterprise'); });
        else btn.addEventListener('click', function () { changePlan(p); });
        pp.appendChild(btn);
      }
      card.appendChild(pp);
      content.appendChild(card);
    });
    if (me.user.role !== 'owner') content.appendChild(el('p', 'note', '')).textContent = 'เฉพาะเจ้าของบัญชี (owner) เปลี่ยนแพ็กเกจได้';

    /* staff (owner) */
    if (me.user.role === 'owner') {
      content.appendChild(el('div', 'sect', 'เพิ่มพนักงาน'));
      var sc = el('div', 'card');
      var row = el('div', 'stafrow');
      var se = el('input'); se.type = 'email'; se.placeholder = 'อีเมลพนักงาน';
      var sp = el('input'); sp.type = 'password'; sp.placeholder = 'รหัสผ่าน'; sp.style.maxWidth = '110px';
      var sb = el('button', null, 'เพิ่ม'); sb.type = 'button';
      row.appendChild(se); row.appendChild(sp); row.appendChild(sb); sc.appendChild(row);
      var msg = el('div', 'smsg'); msg.style.display = 'none'; sc.appendChild(msg);
      sb.addEventListener('click', function () {
        if (!se.value || !sp.value) return;
        sb.disabled = true; sb.textContent = '...';
        API.addUser({ email: se.value.trim(), password: sp.value, role: 'staff' })
          .then(function () { msg.textContent = 'เพิ่มพนักงานแล้ว: ' + se.value.trim(); msg.style.display = ''; msg.style.color = 'var(--success)'; se.value = ''; sp.value = ''; })
          .catch(function (ex) { msg.textContent = ex.status === 409 ? 'อีเมลนี้ถูกใช้แล้ว' : ('ผิดพลาด: ' + ex.message); msg.style.display = ''; msg.style.color = '#D8503C'; })
          .then(function () { sb.disabled = false; sb.textContent = 'เพิ่ม'; });
      });
      content.appendChild(sc);
    }

    content.appendChild(logoutBtn());
  }

  function changePlan(p) {
    if (!confirm('เปลี่ยนเป็นแพ็กเกจ ' + p.name + ' (฿' + fmt(p.price_month) + '/เดือน)?\n\n(ตอนนี้เป็นโหมดทดสอบ ยังไม่ตัดเงินจริง — ระบบจ่ายเงิน Omise จะต่อภายหลัง)')) return;
    API.subscribe(p.code).then(function () { load(); }).catch(function (ex) { alert('เปลี่ยนแพ็กเกจไม่สำเร็จ: ' + ex.message); });
  }

  load();
})();
