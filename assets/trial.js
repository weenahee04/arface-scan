/* ARFACE — trial.html: consumer onboarding + LINE-trial gate.
   Flow: explainer → add LINE (gets 5 free + we capture the lead) → scan (each consumes 1) → after 5 → pricing.
   Works LIVE without the backend: counts are kept client-side (localStorage); when the API is reachable it
   ALSO records claim/scan best-effort (lead capture). Swap to backend-authoritative once it's on DigitalOcean.
   LINE is MOCKED for now — real LIFF (liff.getProfile + add-friend) wires in later. */
(function () {
  var API = window.ARFACE_API;
  var app = document.getElementById('app');
  var note = document.getElementById('api-note');
  if (note) note.textContent = '';
  var QUOTA = 5, LK = 'arface.lineId', LOCAL = 'arface.trialLocal';

  function lineId() { return localStorage.getItem(LK) || ''; }
  function genId() { var id = 'Umock_' + Math.random().toString(36).slice(2, 12); localStorage.setItem(LK, id); return id; }
  function localT() { try { return JSON.parse(localStorage.getItem(LOCAL) || 'null'); } catch (e) { return null; } }
  function saveT(t) { localStorage.setItem(LOCAL, JSON.stringify(t)); }
  function status() { var t = localT(); if (!t) return { claimed: false, quota: QUOTA }; return { claimed: true, quota: QUOTA, used: t.used, remaining: Math.max(0, QUOTA - t.used) }; }
  function claim() { var id = lineId() || genId(); if (!localT()) saveT({ used: 0 }); if (API) API.trialClaim({ line_user_id: id, display_name: 'ผู้ใช้ทดลอง' }).catch(function () {}); }
  function use() { var t = localT() || { used: 0 }; if (t.used >= QUOTA) return false; t.used++; saveT(t); if (API) API.trialScan(lineId()).catch(function () {}); return true; }

  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function progress(used, quota) { var b = el('div', 'prog'); for (var i = 0; i < quota; i++) b.appendChild(el('div', 'seg' + (i < used ? ' used' : ' on'))); return b; }

  function render() {
    var s = status();
    if (!s.claimed) return renderExplain();
    if (s.remaining <= 0) return renderPaywall(s);
    renderActive(s);
  }

  function renderExplain() {
    app.innerHTML = '';
    var hero = el('div', 'hero');
    hero.appendChild(el('span', 'badge', 'ทดลองฟรี 5 ครั้ง'));
    hero.appendChild(el('h1', null, 'สแกนวิเคราะห์ใบหน้าด้วย AI'));
    hero.appendChild(el('p', null, 'รู้แนวทางฟิลเลอร์ที่เหมาะกับคุณใน 1 นาที — เริ่มฟรีเพียงเพิ่มเพื่อน LINE'));
    app.appendChild(hero);

    var steps = el('div', 'steps');
    [['1', 'เพิ่มเพื่อน LINE', 'รับสิทธิ์ทดลองฟรี 5 ครั้งทันที'],
     ['2', 'สแกนใบหน้า', 'AI ตรวจ 478 จุด ประมวลผลบนเครื่อง ไม่อัปโหลดรูป'],
     ['3', 'รับผลลัพธ์', 'จุดฟิลเลอร์ที่เหมาะ + ความแข็ง G′ + งบประมาณ']
    ].forEach(function (st) {
      var row = el('div', 'step');
      row.appendChild(el('div', 'sn', st[0]));
      var b = el('div', 'sb'); b.appendChild(el('div', 'st', st[1])); b.appendChild(el('div', 'sd', st[2]));
      row.appendChild(b); steps.appendChild(row);
    });
    app.appendChild(steps);

    var card = el('div', 'card');
    var btn = el('button', 'line-btn'); btn.type = 'button';
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="#fff"><path d="M12 2C6.5 2 2 5.7 2 10.2c0 4 3.6 7.4 8.5 8 .35.08.8.23.9.5.1.27.06.66.03.92l-.13.86c-.04.27-.2 1.04.9.57 1.1-.47 5.9-3.5 8.05-6C22.4 13.4 22 11.9 22 10.2 22 5.7 17.5 2 12 2Z"/></svg> เพิ่มเพื่อน LINE รับ 5 สิทธิ์ฟรี';
    card.appendChild(btn);
    card.appendChild(el('div', 'consent', 'การเพิ่มเพื่อนถือว่ายอมรับให้เราติดต่อผ่าน LINE และใช้ข้อมูลโปรไฟล์เพื่อให้บริการ — ภาพใบหน้าประมวลผลบนเครื่อง ไม่อัปโหลด'));
    app.appendChild(card);

    btn.addEventListener('click', function () {
      btn.disabled = true; btn.textContent = 'กำลังเชื่อม LINE…';
      // MOCK. Real: liff.init → (if !friend) prompt add-friend → liff.getProfile() → claim with real userId/name.
      claim(); render();
    });
  }

  function renderActive(s) {
    app.innerHTML = '';
    var hero = el('div', 'hero'); hero.appendChild(el('span', 'badge', 'พร้อมสแกน')); hero.appendChild(el('h1', null, 'สิทธิ์ทดลองของคุณ')); app.appendChild(hero);
    var card = el('div', 'card');
    var h = el('div', 'prog-h'); h.appendChild(el('div', 't', 'สแกนได้อีก')); h.appendChild(el('div', 'n', s.remaining + ' / ' + s.quota)); card.appendChild(h);
    card.appendChild(progress(s.used, s.quota));
    card.appendChild(el('div', 'sub', 'แต่ละครั้งที่สแกนจะใช้ 1 สิทธิ์'));
    var go = el('button', 'cta'); go.type = 'button'; go.style.marginTop = '16px';
    go.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3"/></svg> เริ่มสแกนใบหน้า';
    go.addEventListener('click', function () { if (use()) location.href = 'scan.html'; else render(); });
    card.appendChild(go);
    app.appendChild(card);
  }

  function renderPaywall(s) {
    app.innerHTML = '';
    var hero = el('div', 'hero'); hero.appendChild(el('h1', null, 'หมดสิทธิ์ทดลอง')); app.appendChild(hero);
    var card = el('div', 'card');
    var pw = el('div', 'paywall');
    var ic = el('div', 'ic'); ic.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1E9FE9" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10V7a5 5 0 0 1 10 0v3"/><rect x="4" y="10" width="16" height="11" rx="2.5"/></svg>'; pw.appendChild(ic);
    pw.appendChild(el('h2', null, 'ใช้สิทธิ์ทดลองครบแล้ว'));
    pw.appendChild(el('p', null, 'คุณใช้สิทธิ์ทดลองฟรีครบ ' + (s.quota || QUOTA) + ' ครั้งแล้ว ซื้อแพ็กเกจเพื่อสแกนและดูแผนฟิลเลอร์ต่อ'));
    card.appendChild(pw);
    card.appendChild(progress(QUOTA, QUOTA));
    var buy = document.createElement('a'); buy.className = 'cta'; buy.href = 'pricing.html'; buy.style.marginTop = '16px'; buy.textContent = 'ดูแพ็กเกจ & ซื้อ';
    card.appendChild(buy);
    var line = el('button', 'ghost2', 'ทักไลน์ปรึกษา'); line.type = 'button';
    line.addEventListener('click', function () { alert('เปิด LINE OA เพื่อปรึกษา/ซื้อ (เชื่อมจริงตอนต่อ LINE)'); });
    card.appendChild(line);
    app.appendChild(card);
  }

  render();
})();
