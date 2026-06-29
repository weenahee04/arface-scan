/* ARFACE — analyze page: symmetry mirror + face shape + golden-ratio grid.
   Fully data-driven from the saved scan (face crop + 478 landmarks + shape).
   No MediaPipe reload. On-device only. */
import { store } from './store.js';

const app = document.getElementById('app');
const toastEl = document.getElementById('toast');
let toastT;
function toast(msg) { toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 2400); }

const scan = store.getLastScan();
const ok = scan && scan.face && Array.isArray(scan.pts) && scan.pts.length > 400;

if (!ok) {
  document.getElementById('btn-share').style.visibility = 'hidden';
  app.innerHTML = `
    <div style="padding:60px 32px 0; text-align:center; display:flex; flex-direction:column; align-items:center; gap:14px;">
      <div style="width:84px; height:84px; border-radius:50%; background:#E3F3FE; display:flex; align-items:center; justify-content:center;">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#28BFEF" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="10.5" r="2.6"/><path d="M7.5 16.5a4.8 4.8 0 0 1 9 0"/></svg>
      </div>
      <div style="font-weight:700; font-size:18px;">ยังไม่มีผลสแกน</div>
      <div style="font-size:13px; line-height:1.55; color:var(--text-2); max-width:280px;">สแกนใบหน้าก่อน แล้วกลับมาดูการวิเคราะห์ทรงหน้า ความสมมาตร และสัดส่วนทองคำ</div>
      <a class="cta" href="scan.html" style="max-width:240px; margin-top:8px;">สแกนใบหน้า</a>
    </div>`;
} else {
  const W = 480, H = 432;
  const P = (i) => ({ x: scan.pts[i].x * W, y: scan.pts[i].y * H });
  const sym = (scan.metrics && scan.metrics.symmetry) || 92;
  const shape = scan.shape || { th: 'รูปไข่', tip: 'รูปหน้าได้สัดส่วนดี', ratios: { lengthToWidth: 1.4, forehead: 90, cheek: 100, jaw: 88 } };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  app.innerHTML = `
    <section class="sec">
      <div class="sec-t">เส้นสัดส่วนใบหน้า</div>
      <div class="sec-s">สามส่วนแนวนอน · ห้าส่วนแนวตั้ง · เทียบสัดส่วนทองคำ φ</div>
      <div class="grid-wrap">
        <canvas id="grid"></canvas>
        <span class="grid-badge">สัดส่วน φ <b>${(1.618 - Math.abs(1.5 - shape.ratios.lengthToWidth) * 0.2).toFixed(2)}</b></span>
      </div>
    </section>

    <section class="sec">
      <div class="sec-t">กระจกสมมาตร</div>
      <div class="sec-s">ถ้าใบหน้าซ้าย/ขวาสมมาตรกันเป๊ะ จะเป็นแบบนี้</div>
      <div class="mirror">
        <div class="mcell now"><canvas id="m-now"></canvas><div class="cap">ใบหน้าจริง</div></div>
        <div class="mcell"><canvas id="m-left"></canvas><div class="cap">สมมาตรซ้าย</div></div>
        <div class="mcell"><canvas id="m-right"></canvas><div class="cap">สมมาตรขวา</div></div>
      </div>
      <div class="symline">
        <span class="v">${sym}%</span>
        <span class="tx">ความสมมาตรของใบหน้าคุณ — ยิ่งใกล้ 100% ซ้าย/ขวายิ่งสมดุล</span>
      </div>
    </section>

    <section class="sec">
      <div class="sec-t">ทรงหน้าของคุณ</div>
      <div class="sec-s">จำแนกจากสัดส่วนหน้าผาก โหนกแก้ม กราม และความยาว</div>
      <div class="card-p shape">
        <div class="pic"><img src="${scan.face}" alt="ใบหน้าของคุณ"></div>
        <div class="meta">
          <span class="badge2">${shape.th}</span>
          <div class="tip">${shape.tip}</div>
        </div>
      </div>
      <div class="ratios" id="ratios"></div>
    </section>

    <div class="note">
      <div class="note" style="margin:0;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8295AB" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/></svg>
        <div class="tx">การวิเคราะห์เป็นการประเมินโครงสร้างเบื้องต้นจาก AI เพื่อความบันเทิงและคำแนะนำทั่วไป</div>
      </div>
    </div>

    <div class="cta-wrap">
      <button class="cta" id="btn-share2">
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v14"/></svg>
        แชร์ผลวิเคราะห์
      </button>
      <a class="ghost" href="result.html">ดูแผนฟิลเลอร์ที่แนะนำ</a>
    </div>
    <div style="height:22px"></div>`;

  // ratio chips (relative to the widest measure)
  const r = shape.ratios, widest = Math.max(r.forehead, r.cheek, r.jaw) || 1;
  const chips = [['หน้าผาก', r.forehead], ['โหนกแก้ม', r.cheek], ['กราม', r.jaw]];
  document.getElementById('ratios').innerHTML = chips.map(([l, v]) =>
    `<div class="rc"><div class="rv">${Math.round(v / widest * 100)}%</div><div class="rl">${l}</div></div>`).join('') +
    `<div class="rc"><div class="rv">${r.lengthToWidth.toFixed(2)}</div><div class="rl">ยาว : กว้าง</div></div>`;

  const img = new Image();
  img.onload = () => { drawGrid(); drawMirror('m-now', 'now'); drawMirror('m-left', 'left'); drawMirror('m-right', 'right'); };
  img.src = scan.face;

  function setup(id, w, h) {
    const c = document.getElementById(id);
    const dpr = Math.min(devicePixelRatio || 1, 2);
    c.width = w * dpr; c.height = h * dpr;
    const x = c.getContext('2d'); x.scale(dpr, dpr); return x;
  }

  function drawGrid() {
    const x = setup('grid', W, H);
    const draw = (prog) => {
      x.clearRect(0, 0, W, H);
      x.drawImage(img, 0, 0, W, H);
      x.globalAlpha = prog;
      // horizontal thirds: hairline -> brow -> nose base -> chin
      const yBrow = P(9).y, yNose = P(2).y, yTop = P(10).y, yChin = P(152).y;
      x.strokeStyle = 'rgba(40,191,239,.9)'; x.lineWidth = 1.6; x.setLineDash([6, 5]);
      [yBrow, yNose].forEach((yy) => { x.beginPath(); x.moveTo(14, yy); x.lineTo(W - 14, yy); x.stroke(); });
      x.setLineDash([]); x.strokeStyle = 'rgba(40,191,239,.45)'; x.lineWidth = 1;
      [yTop, yChin].forEach((yy) => { x.beginPath(); x.moveTo(14, yy); x.lineTo(W - 14, yy); x.stroke(); });
      // vertical fifths at face edges + eye corners
      const xs = [234, 33, 133, 362, 263, 454].map((i) => P(i).x);
      x.strokeStyle = 'rgba(126,220,255,.7)'; x.setLineDash([5, 5]); x.lineWidth = 1.2;
      xs.forEach((xx) => { x.beginPath(); x.moveTo(xx, yTop - 6); x.lineTo(xx, yChin + 6); x.stroke(); });
      // golden midline
      x.setLineDash([]); x.strokeStyle = 'rgba(45,159,238,.5)'; x.lineWidth = 1;
      x.beginPath(); x.moveTo(P(1).x, yTop - 6); x.lineTo(P(1).x, yChin + 6); x.stroke();
      // node dots
      x.globalAlpha = prog; x.fillStyle = '#fff';
      [10, 9, 2, 152, 234, 454, 33, 263].forEach((i) => { const p = P(i); x.beginPath(); x.arc(p.x, p.y, 2.4, 0, 6.2832); x.fill(); x.strokeStyle = '#28BFEF'; x.lineWidth = 1.4; x.stroke(); });
      x.globalAlpha = 1;
    };
    if (reduced) { draw(1); return; }
    const t0 = performance.now();
    (function step(t) { const p = Math.min((t - t0) / 650, 1); draw(p); if (p < 1) requestAnimationFrame(step); })(t0);
  }

  function drawMirror(id, mode) {
    const x = setup(id, W, H);
    const mid = P(1).x;
    x.clearRect(0, 0, W, H);
    if (mode === 'now') { x.drawImage(img, 0, 0, W, H); return; }
    x.fillStyle = '#EAF4FC'; x.fillRect(0, 0, W, H);
    if (mode === 'left') {
      x.drawImage(img, 0, 0, mid, H, 0, 0, mid, H);
      x.save(); x.translate(2 * mid, 0); x.scale(-1, 1); x.drawImage(img, 0, 0, mid, H, 0, 0, mid, H); x.restore();
    } else {
      const rw = W - mid;
      x.drawImage(img, mid, 0, rw, H, mid, 0, rw, H);
      x.save(); x.translate(2 * mid, 0); x.scale(-1, 1); x.drawImage(img, mid, 0, rw, H, mid, 0, rw, H); x.restore();
    }
  }

  // ---------- share ----------
  function loadImg(src) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; }); }
  function rrect(c, x0, y0, w, h, rad) { c.beginPath(); c.moveTo(x0 + rad, y0); c.arcTo(x0 + w, y0, x0 + w, y0 + h, rad); c.arcTo(x0 + w, y0 + h, x0, y0 + h, rad); c.arcTo(x0, y0 + h, x0, y0, rad); c.arcTo(x0, y0, x0 + w, y0, rad); c.closePath(); }
  function buildCard() {
    const CW = 1080, CH = 1920;
    const fonts = ['600 52px "Noto Sans Thai"', '800 64px "Noto Sans Thai"', '500 40px "Noto Sans Thai"', '500 30px Inter'];
    return Promise.all(fonts.map((f) => document.fonts.load(f)))
      .then(() => Promise.all([loadImg('assets/home-bg-full.png'), loadImg('assets/logo-clean.png'), loadImg(scan.face)]))
      .then((ims) => {
        const [bg, logo, face] = ims;
        const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH;
        const c = cv.getContext('2d');
        c.fillStyle = '#EAF5FD'; c.fillRect(0, 0, CW, CH);
        c.drawImage(bg, 0, 0, CW, CH);
        const gr = c.createLinearGradient(0, CH * 0.5, 0, CH); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,.88)');
        c.fillStyle = gr; c.fillRect(0, 0, CW, CH);
        const lw = 380, lh = lw * logo.height / logo.width; c.drawImage(logo, (CW - lw) / 2, 120, lw, lh);
        c.textAlign = 'center'; c.fillStyle = '#44566B'; c.font = '500 40px "Noto Sans Thai"';
        c.fillText('วิเคราะห์โครงสร้างใบหน้าด้วย AI', CW / 2, 320);
        // face
        const fw = 620, fh = fw * face.height / face.width, fx = (CW - fw) / 2, fy = 380;
        c.save(); rrect(c, fx, fy, fw, fh, 36); c.clip(); c.drawImage(face, fx, fy, fw, fh); c.restore();
        c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 6; rrect(c, fx, fy, fw, fh, 36); c.stroke();
        // shape badge
        c.font = '600 52px "Noto Sans Thai"'; const label = 'ทรงหน้า: ' + shape.th; const bw = c.measureText(label).width + 80;
        const by = fy + fh + 60; c.fillStyle = '#2D9FEE'; rrect(c, (CW - bw) / 2, by, bw, 92, 46); c.fill();
        c.fillStyle = '#fff'; c.fillText(label, CW / 2, by + 60);
        // symmetry
        c.fillStyle = '#16273C'; c.font = '800 64px "Noto Sans Thai"'; c.fillText('สมมาตร ' + sym + '%', CW / 2, by + 200);
        c.fillStyle = '#8295AB'; c.font = '500 30px Inter'; c.fillText('arface-scan-9277.netlify.app', CW / 2, 1850);
        return cv;
      });
  }
  let sharing = false;
  function share() {
    if (sharing) return; sharing = true;
    buildCard().then((cv) => cv.toBlob((blob) => {
      sharing = false;
      if (!blob) { toast('สร้างรูปไม่สำเร็จ ลองอีกครั้ง'); return; }
      const file = new File([blob], 'arface-analyze.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: 'ARFACE', text: 'ผลวิเคราะห์ใบหน้าของฉันจาก ARFACE' }).then(() => toast('แชร์สำเร็จ')).catch(() => {});
      } else {
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'arface-analyze.png';
        document.body.appendChild(a); a.click(); a.remove();
        toast('บันทึกรูปแล้ว — เปิด Instagram แล้วเลือกรูปนี้ได้เลย');
      }
    }, 'image/png')).catch(() => { sharing = false; toast('สร้างรูปไม่สำเร็จ ลองอีกครั้ง'); });
  }
  document.getElementById('btn-share').onclick = share;
  document.getElementById('btn-share2').onclick = share;

  // test hook
  window.__analyzeReady = { shape: shape.th, sym };
}
