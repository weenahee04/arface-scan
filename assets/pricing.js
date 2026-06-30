/* ARFACE — pricing.html: subscription packages (static; no backend needed).
   Mirrors SAAS-PLAN.md. CTAs route to trial (free) / login (subscribe) / contact (enterprise). */
(function () {
  var PLANS = [
    { code: 'trial', name: 'ทดลองฟรี', priceLabel: 'ฟรี', sub: '14 วัน', scans: '50 สแกน',
      features: ['สแกน AI 478 จุด', 'ผลฟิลเลอร์ + G′', 'ใช้ได้ทุกฟีเจอร์'], cta: 'เริ่มทดลองฟรี', href: 'trial.html', ghost: true },
    { code: 'starter', name: 'Starter', price: 1500, scans: '300 สแกน/เดือน', overage: 'เกินโควต้า ฿15/รูป',
      features: ['สแกน + ผลฟิลเลอร์', 'G′ + เทียบราคาฟิลเลอร์', '1 ผู้ใช้'], cta: 'เลือกแพ็กเกจ', href: 'login.html' },
    { code: 'pro', name: 'Pro', price: 3900, scans: '1,000 สแกน/เดือน', overage: 'เกินโควต้า ฿10/รูป', badge: 'แนะนำ',
      features: ['ทุกอย่างใน Starter', 'รายงาน PDF', 'ใส่โลโก้คลินิก', 'หลายพนักงาน'], cta: 'เลือกแพ็กเกจ', href: 'login.html' },
    { code: 'clinic', name: 'Clinic', price: 9900, scans: '4,000 สแกน/เดือน', overage: 'เกินโควต้า ฿7/รูป',
      features: ['ทุกอย่างใน Pro', 'หลายสาขา', 'ฐานข้อมูลลูกค้า', 'เชื่อมต่อ API'], cta: 'เลือกแพ็กเกจ', href: 'login.html' },
    { code: 'enterprise', name: 'Enterprise', priceLabel: 'คุยราคา', scans: 'สแกนไม่จำกัด',
      features: ['ทุกอย่างใน Clinic', 'SLA + ดูแลเฉพาะ', 'ช่วยตั้งระบบ (onboarding)'], cta: 'ติดต่อทีมงาน', href: '#contact', ghost: true },
  ];
  var fmt = function (n) { return Math.round(n).toLocaleString('en-US'); };
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  var check = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2FA152" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';

  var wrap = document.getElementById('plans');
  PLANS.forEach(function (p) {
    var card = el('div', 'plan-card' + (p.badge ? ' rec' : ''));
    if (p.badge) card.appendChild(el('span', 'pc-badge', p.badge));
    card.appendChild(el('div', 'pc-name', p.name));
    var price = el('div', 'pc-price');
    if (p.price) { price.innerHTML = '฿' + fmt(p.price) + '<span>/เดือน</span>'; }
    else { price.innerHTML = p.priceLabel + (p.sub ? '<span>· ' + p.sub + '</span>' : ''); }
    card.appendChild(price);
    card.appendChild(el('div', 'pc-scans', p.scans + (p.overage ? ' · ' + p.overage : '')));
    var ul = el('ul', 'pc-feat');
    p.features.forEach(function (f) { var li = el('li'); li.innerHTML = check + '<span>' + f + '</span>'; ul.appendChild(li); });
    card.appendChild(ul);
    var btn = document.createElement('a');
    btn.className = p.ghost ? 'pc-btn ghost' : 'pc-btn';
    btn.href = p.href; btn.textContent = p.cta;
    if (p.href === '#contact') btn.addEventListener('click', function (e) { e.preventDefault(); alert('ติดต่อทีมงาน ARFACE สำหรับแพ็กเกจ Enterprise (เชื่อมช่องทางจริงภายหลัง)'); });
    card.appendChild(btn);
    wrap.appendChild(card);
  });
})();
