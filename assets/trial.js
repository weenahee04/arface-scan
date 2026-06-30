/* ARFACE — trial.html: consumer LINE-trial funnel.
   Add LINE (mock now; real LIFF later) → 5 free scans/user → progress bar → paywall (ซื้อแพ็กเกจ).
   Identified by line_user_id stored locally (real LIFF: liff.getProfile().userId). */
(function () {
  var API = window.ARFACE_API;
  var app = document.getElementById('app');
  document.getElementById('api-note').textContent = 'เซิร์ฟเวอร์: ' + API.base;
  var LK = 'arface.lineId';
  var lineId = function () { return localStorage.getItem(LK) || ''; };

  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function progress(used, quota) {
    var bar = el('div', 'prog');
    for (var i = 0; i < quota; i++) bar.appendChild(el('div', 'seg' + (i < used ? ' used' : ' on')));
    return bar;
  }

  function load() {
    app.innerHTML = '<div class="loading">กำลังโหลด…</div>';
    var lid = lineId();
    if (!lid) return renderClaim();
    API.trialStatus(lid)
      .then(function (s) { if (!s.claimed) renderClaim(); else if (s.remaining <= 0) renderPaywall(s); else renderActive(s); })
      .catch(renderError);
  }

  function renderClaim() {
    app.innerHTML = '';
    var hero = el('div', 'hero');
    hero.appendChild(el('span', 'badge', 'ทดลองฟรี'));
    hero.appendChild(el('h1', null, 'สแกนวิเคราะห์ใบหน้าด้วย AI'));
    hero.appendChild(el('p', null, 'เพิ่มเพื่อน LINE เพื่อรับสิทธิ์ทดลองฟรี 5 ครั้ง — วิเคราะห์ฟิลเลอร์ + แผนเฉพาะคุณ'));
    app.appendChild(hero);
    var card = el('div', 'card');
    var btn = el('button', 'line-btn'); btn.type = 'button';
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="#fff"><path d="M12 2C6.5 2 2 5.7 2 10.2c0 4 3.6 7.4 8.5 8 .35.08.8.23.9.5.1.27.06.66.03.92l-.13.86c-.04.27-.2 1.04.9.57 1.1-.47 5.9-3.5 8.05-6C22.4 13.4 22 11.9 22 10.2 22 5.7 17.5 2 12 2Z"/></svg> เพิ่มเพื่อน LINE รับ 5 สิทธิ์';
    card.appendChild(btn);
    card.appendChild(el('div', 'consent', 'การเพิ่มเพื่อนถือว่ายอมรับให้เราติดต่อผ่าน LINE และใช้ข้อมูลโปรไฟล์เพื่อให้บริการ — ภาพใบหน้าประมวลผลบนเครื่อง ไม่อัปโหลด'));
    app.appendChild(card);
    btn.addEventListener('click', function () {
      btn.disabled = true; btn.textContent = 'กำลังเชื่อม LINE…';
      // MOCK LINE. Real: liff.init → liff.getProfile() (userId+displayName) + add-friend prompt.
      var id = lineId() || ('Umock_' + Math.random().toString(36).slice(2, 12));
      localStorage.setItem(LK, id);
      API.trialClaim({ line_user_id: id, display_name: 'ผู้ใช้ทดลอง', picture: '' }).then(load).catch(renderError);
    });
  }

  function renderActive(s) {
    app.innerHTML = '';
    var card = el('div', 'card');
    var h = el('div', 'prog-h'); h.appendChild(el('div', 't', 'สิทธิ์ทดลองของคุณ')); h.appendChild(el('div', 'n', s.remaining + ' / ' + s.quota));
    card.appendChild(h);
    card.appendChild(progress(s.scans_used, s.quota));
    card.appendChild(el('div', 'sub', 'เหลืออีก ' + s.remaining + ' ครั้ง'));
    var scanBtn = document.createElement('a'); scanBtn.className = 'cta'; scanBtn.href = 'scan.html'; scanBtn.style.marginTop = '16px';
    scanBtn.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3"/></svg> เริ่มสแกนใบหน้า';
    card.appendChild(scanBtn);
    var demo = el('button', 'demo', '▸ ใช้ 1 สิทธิ์ (เดโมทดสอบการนับ)'); demo.type = 'button';
    demo.addEventListener('click', function () {
      demo.disabled = true;
      API.trialScan(lineId()).then(load).catch(function (ex) { if (ex.status === 402) load(); else renderError(ex); });
    });
    card.appendChild(demo);
    app.appendChild(card);
  }

  function renderPaywall(s) {
    app.innerHTML = '';
    var hero = el('div', 'hero'); hero.appendChild(el('h1', null, 'หมดสิทธิ์ทดลอง')); app.appendChild(hero);
    var card = el('div', 'card');
    var pw = el('div', 'paywall');
    var ic = el('div', 'ic'); ic.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1E9FE9" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10V7a5 5 0 0 1 10 0v3"/><rect x="4" y="10" width="16" height="11" rx="2.5"/></svg>';
    pw.appendChild(ic);
    pw.appendChild(el('h2', null, 'ใช้สิทธิ์ทดลองครบแล้ว'));
    pw.appendChild(el('p', null, 'คุณใช้สิทธิ์ทดลองฟรีครบ ' + s.quota + ' ครั้งแล้ว ซื้อแพ็กเกจเพื่อสแกนและดูแผนฟิลเลอร์ต่อ'));
    card.appendChild(pw);
    card.appendChild(progress(s.quota, s.quota));
    var buy = document.createElement('a'); buy.className = 'cta'; buy.href = 'pricing.html'; buy.style.marginTop = '16px'; buy.textContent = 'ซื้อแพ็กเกจ';
    card.appendChild(buy);
    var line = el('button', 'ghost2', 'ทักไลน์ปรึกษา'); line.type = 'button';
    line.addEventListener('click', function () { alert('เปิด LINE OA เพื่อปรึกษา/ซื้อ (เชื่อมจริงตอนต่อ LINE)'); });
    card.appendChild(line);
    app.appendChild(card);
  }

  function renderError(ex) {
    app.innerHTML = '';
    var card = el('div', 'card');
    card.appendChild(el('p', null, ex && ex.offline ? ('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — รัน node server/server.js ที่ ' + API.base) : ('เกิดข้อผิดพลาด: ' + ((ex && ex.message) || ex))));
    app.appendChild(card);
  }

  load();
})();
