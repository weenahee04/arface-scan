/* ============================================================
   ARFACE — chrome injector (statusbar / topbar / home header / tabbar)
   New pages drop placeholders and call ARFACE.mountChrome():
     <div data-ar="statusbar"></div>
     <header data-ar="topbar" data-title="..." data-back="index.html" data-info></header>
     <header data-ar="header"></header>                      (home logo + bell)
     <nav data-ar="tabbar" data-active="result"></nav>
   Heights are reserved in arface.css so injection causes no layout shift.
   ============================================================ */
(function () {
  const STATUSBAR = `
    <span class="time">9:41</span>
    <span style="display:flex; align-items:center; gap:6px;">
      <svg width="18" height="11" viewBox="0 0 19 12" fill="#0B1B2B"><rect x="0" y="7.5" width="3.4" height="4.5" rx="1"/><rect x="5" y="5" width="3.4" height="7" rx="1"/><rect x="10" y="2.5" width="3.4" height="9.5" rx="1"/><rect x="15" y="0" width="3.4" height="12" rx="1"/></svg>
      <svg width="16" height="11" viewBox="0 0 17 12" fill="none" stroke="#0B1B2B" stroke-width="1.9" stroke-linecap="round"><path d="M1.5 4.2a10.4 10.4 0 0 1 14 0"/><path d="M4.1 7a6.7 6.7 0 0 1 8.8 0"/><path d="M6.8 9.7a3 3 0 0 1 3.4 0"/><circle cx="8.5" cy="10.8" r="1" fill="#0B1B2B" stroke="none"/></svg>
      <svg width="25" height="12" viewBox="0 0 26 12" fill="none"><rect x="0.7" y="0.7" width="21" height="10.6" rx="3" stroke="#0B1B2B" stroke-opacity=".4" stroke-width="1"/><rect x="2.4" y="2.4" width="17.6" height="7.2" rx="1.8" fill="#0B1B2B"/><path d="M23.6 4v4a2.2 2.2 0 0 0 0-4Z" fill="#0B1B2B" fill-opacity=".4"/></svg>
    </span>`;

  const ICONS = {
    back: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
    info: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/></svg>',
    bell: '<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#16273C" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
  };

  // tab id -> { label, href, icon(stroke), iconActive(optional fill) }
  const TABS = [
    { id: 'home',   label: 'หน้าหลัก', href: 'index.html',
      icon: '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5"/></svg>',
      iconActive: '<svg width="21" height="21" viewBox="0 0 24 24" fill="#1E9FE9"><path d="M11.4 3.5a1 1 0 0 1 1.2 0l7.9 6.1a1 1 0 0 1 .4.8V20a1 1 0 0 1-1 1h-5v-5.5a2.9 2.9 0 1 0-5.8 0V21h-5a1 1 0 0 1-1-1v-9.6a1 1 0 0 1 .4-.8l7.9-6.1Z"/></svg>' },
    { id: 'result', label: 'ผลลัพธ์', href: 'result.html',
      icon: '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><path d="M7.5 14.5l2.7-2.7 2.3 1.9 4-4.2"/><path d="M13.8 9.5h2.7v2.7"/></svg>' },
    { id: 'scan',   label: 'สแกน', href: 'scan.html',
      icon: '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M12 9v6M9 12h6"/></svg>' },
    { id: 'tips',   label: 'แนะนำ', href: 'tips.html',
      icon: '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1.1 2H14.5c.1-.8.5-1.5 1.1-2A6 6 0 0 0 12 3Z"/></svg>' },
    { id: 'clinics',label: 'ราคา', href: 'clinics.html',
      icon: '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 11.5V5a1.5 1.5 0 0 1 1.5-1.5h6.5a1.5 1.5 0 0 1 1.06.44l7 7a1.5 1.5 0 0 1 0 2.12l-6.5 6.5a1.5 1.5 0 0 1-2.12 0l-7-7A1.5 1.5 0 0 1 3.5 11.5Z"/><circle cx="7.7" cy="7.7" r="1.3"/></svg>' },
    { id: 'profile',label: 'โปรไฟล์', href: 'profile.html',
      icon: '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.6"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>' },
  ];

  function topBar(el) {
    const title = el.getAttribute('data-title') || '';
    const back = el.getAttribute('data-back');
    const hasInfo = el.hasAttribute('data-info');
    const backHTML = back === 'history'
      ? `<button class="circbtn" type="button" aria-label="ย้อนกลับ" data-ar-back>${ICONS.back}</button>`
      : `<a class="circbtn" href="${back || 'index.html'}" aria-label="ย้อนกลับ">${ICONS.back}</a>`;
    const infoHTML = hasInfo
      ? `<button class="circbtn" type="button" aria-label="ข้อมูลเพิ่มเติม">${ICONS.info}</button>`
      : `<span style="width:33px;flex:none"></span>`;
    el.classList.add('topbar');
    el.innerHTML = `${backHTML}<h1 class="ttl">${title}</h1>${infoHTML}`;
    const bb = el.querySelector('[data-ar-back]'); if (bb) bb.addEventListener('click', () => history.back());
  }

  function homeHeader(el) {
    el.classList.add('header');
    el.innerHTML =
      `<img class="logo" src="assets/logo-clean.png" alt="ARFACE">
       <button class="bellbtn" type="button" aria-label="การแจ้งเตือน">${ICONS.bell}<span class="dot"></span></button>`;
  }

  function tabBar(el) {
    const active = el.getAttribute('data-active') || '';
    el.classList.add('tabbar');
    el.setAttribute('aria-label', 'เมนูหลัก');
    el.innerHTML = TABS.map((t) => {
      const on = t.id === active;
      const icon = on && t.iconActive ? t.iconActive : t.icon;
      const cls = 'tab' + (on ? ' active' : '');
      const inner = `${icon}${t.label}<span class="tdot"></span>`;
      return on
        ? `<a class="${cls}" href="${t.href}" aria-current="page">${inner}</a>`
        : `<a class="${cls}" href="${t.href}">${inner}</a>`;
    }).join('');
  }

  function mountChrome(root = document) {
    root.querySelectorAll('[data-ar="statusbar"]').forEach((el) => { el.classList.add('statusbar'); el.setAttribute('aria-hidden', 'true'); el.innerHTML = STATUSBAR; });
    root.querySelectorAll('[data-ar="topbar"]').forEach(topBar);
    root.querySelectorAll('[data-ar="header"]').forEach(homeHeader);
    root.querySelectorAll('[data-ar="tabbar"]').forEach(tabBar);
    // wrap a [data-ar="tabbar"] in .tabwrap + home indicator if not already wrapped
    root.querySelectorAll('[data-ar="tabbar"]').forEach((nav) => {
      if (nav.parentElement && nav.parentElement.classList.contains('tabwrap')) return;
      const wrap = document.createElement('div'); wrap.className = 'tabwrap';
      nav.replaceWith(wrap); wrap.appendChild(nav);
      const ind = document.createElement('div'); ind.className = 'home-indicator'; ind.setAttribute('aria-hidden', 'true');
      wrap.appendChild(ind);
    });
  }

  window.ARFACE = { mountChrome, TABS };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => mountChrome());
  else mountChrome();
})();
