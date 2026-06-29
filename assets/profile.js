/* ARFACE — profile page: name + avatar (editable), last scan, scan history,
   privacy menu. All data is on-device (localStorage via store.js). */
import { store } from './store.js';

const $ = (id) => document.getElementById(id);
const toastEl = $('toast');
let toastT;
function toast(msg) { toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 2200); }

const thMonth = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
function fmtDate(ts) { const d = new Date(ts); return `${d.getDate()} ${thMonth[d.getMonth()]} ${(d.getFullYear() + 543) % 100}`; }

/* ---------- profile (name + avatar) ---------- */
function renderProfile() {
  const p = store.getProfile();
  if (p.name) {
    $('pf-name').childNodes[0].nodeValue = p.name + ' ';
    $('pf-sub').textContent = 'ข้อมูลและรูปเก็บบนเครื่องนี้';
  }
  if (p.avatar) { const im = $('av-img'); im.src = p.avatar; im.style.display = 'block'; $('av-ic').style.display = 'none'; }
}
function editName() {
  const cur = store.getProfile().name || '';
  const v = (prompt('ตั้งชื่อของคุณ', cur) || '').trim().slice(0, 30);
  if (v) { store.setProfile({ name: v }); renderProfile(); toast('บันทึกชื่อแล้ว'); }
}
function pickAvatar() { $('av-file').click(); }
$('av-file').onchange = (e) => {
  const f = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!f) return;
  const img = new Image();
  img.onload = () => {
    try {
      const S = 200, c = document.createElement('canvas'); c.width = S; c.height = S;
      const x = c.getContext('2d');
      const s = Math.max(S / img.naturalWidth, S / img.naturalHeight);
      const w = img.naturalWidth * s, h = img.naturalHeight * s;
      x.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
      store.setProfile({ avatar: c.toDataURL('image/jpeg', 0.85) });
      renderProfile(); toast('อัปเดตรูปโปรไฟล์แล้ว');
    } catch { toast('อัปโหลดรูปไม่สำเร็จ'); }
  };
  img.onerror = () => toast('เปิดรูปไม่ได้');
  img.src = URL.createObjectURL(f);
};
$('av').onclick = pickAvatar;
$('av').onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickAvatar(); } };
$('pf-name').onclick = editName;

/* ---------- last scan ---------- */
function renderLast() {
  const s = store.getLastScan();
  const el = $('last');
  if (s && s.metrics && s.metrics.overall != null) {
    const g = s.metrics.grade || ['A', 'ดีเยี่ยม'];
    el.innerHTML = `
      <div class="card-p">
        <div class="sc"><div class="n">${s.metrics.overall}</div><div class="l">คะแนน</div></div>
        <div class="mid">
          <div class="g"><b>เกรด ${g[0]}</b><span>${g[1]}</span></div>
          <div class="d">สแกนเมื่อ ${fmtDate(s.ts || Date.now())} • ความสมมาตร ${s.metrics.symmetry}%</div>
        </div>
        <a class="go" href="result.html" aria-label="ดูผลลัพธ์">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#1E9FE9" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
        </a>
      </div>`;
  } else {
    el.innerHTML = `
      <div class="empty">
        <span class="ic"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#28BFEF" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="11" r="2.6"/></svg></span>
        <div class="t">ยังไม่เคยสแกน</div>
        <div class="s">เริ่มสแกนใบหน้าเพื่อดูคะแนนและแผนฟิลเลอร์ของคุณ</div>
        <a class="cta" href="scan.html" style="max-width:220px; margin:12px auto 0;">สแกนใบหน้า</a>
      </div>`;
  }
}

/* ---------- scan history strip ---------- */
function renderHistory() {
  const list = store.getScans();
  if (!list.length) return;
  $('hist-title').style.display = '';
  $('hist').innerHTML = list.map((s) => `
    <div class="hcell">
      <div class="ph">${s.thumb ? `<img src="${s.thumb}" alt="">` : ''}<span class="b">${s.overall ?? '—'}</span></div>
      <div class="dt">${fmtDate(s.ts)}</div>
    </div>`).join('');
}

/* ---------- menu ---------- */
$('m-scan').onclick = () => { location.href = 'scan.html'; };
$('m-privacy').onclick = () => toast('ภาพและผลวิเคราะห์ทั้งหมดประมวลผลและเก็บบนเครื่องคุณ ไม่มีการอัปโหลด');
$('m-clear').onclick = () => {
  if (confirm('ล้างข้อมูลทั้งหมด (โปรไฟล์ ผลสแกน ประวัติ) ออกจากเครื่องนี้?')) {
    store.clearAll();
    toast('ล้างข้อมูลแล้ว');
    setTimeout(() => location.reload(), 700);
  }
};

renderProfile(); renderLast(); renderHistory();
window.__profileReady = true; /* test hook */
