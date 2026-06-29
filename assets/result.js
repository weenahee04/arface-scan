/* Live values from scan.html (?score=&sym=&g=&gl=) — falls back to the mockup's 88/A/96 */
(function () {
  var q = new URLSearchParams(location.search);
  var num = function (k, lo, hi) { var v = parseInt(q.get(k), 10); return isNaN(v) ? null : Math.max(lo, Math.min(hi, v)); };
  var score = num('score', 0, 100), sym = num('sym', 0, 100);
  var g = (q.get('g') || '').slice(0, 3), gl = (q.get('gl') || '').slice(0, 20);

  var scan = null;
  try { scan = JSON.parse(localStorage.getItem('arface.lastScan') || 'null'); } catch (e) {}

  /* gate: results exist only after a scan — no saved scan and no scan params -> go scan first */
  var hasScan = !!(scan && scan.metrics && scan.metrics.overall != null);
  if (score == null && !hasScan) { location.replace('scan.html'); return; }

  /* opened without params (e.g. from the ผลลัพธ์ tab) -> fall back to the saved last scan */
  if (score == null && scan && scan.metrics && scan.metrics.overall != null) {
    score = Math.max(0, Math.min(100, scan.metrics.overall));
    if (sym == null && scan.metrics.symmetry != null) sym = Math.max(0, Math.min(100, scan.metrics.symmetry));
    var gr = scan.metrics.grade || [];
    if (!g && gr[0]) g = String(gr[0]).slice(0, 3);
    if (!gl && gr[1]) gl = String(gr[1]).slice(0, 20);
  }

  if (score != null) {
    document.querySelector('.scorenum .n').textContent = score;
    if (g) document.querySelector('.grade .a').textContent = g;
    if (gl) document.querySelector('.grade .t').textContent = gl;
    document.querySelector('.subtitle').textContent = 'ผลวิเคราะห์จากการสแกนของคุณ พร้อมคำแนะนำเบื้องต้นโดยประมาณ';
  }
  if (sym != null) {
    document.querySelector('.symbar .fill').style.width = sym + '%';
    document.querySelector('.symrow .pct').textContent = sym + '%';
  }

  /* ---- REAL filler assessment from the scan -> cards + summary + budget (5,000฿/cc) ---- */
  if (scan && scan.filler && scan.filler.areas && scan.filler.areas.length >= 1) {
    var F = scan.filler;
    var LV = { high: ['g', 'เหมาะระดับสูง'], mid: ['o', 'เหมาะปานกลาง'], low: ['b', 'ความจำเป็นต่ำ'] };
    var cc1 = function (v) { return v.toFixed(1); };
    var fmt = function (n) { return Math.round(n).toLocaleString('en-US'); };
    var recs = document.querySelectorAll('.rec');
    F.areas.forEach(function (a, i) {
      var card = recs[i];
      if (!card || !LV[a.level]) return;
      var pill = card.querySelector('.pill');
      pill.className = 'pill ' + LV[a.level][0];
      pill.textContent = LV[a.level][1];
      card.querySelector('.qty .v').textContent = cc1(a.cc[0]) + ' – ' + cc1(a.cc[1]);
      card.querySelector('.qty .u').textContent = a.perSide ? 'cc / ข้าง' : 'cc';
      // G′ (filler firmness) meter — per-area recommendation, soft→firm colored blue→amber→coral
      var gp = a.gprime, gpEl = card.querySelector('.gp');
      if (gp && gpEl) {
        var col = gp.score <= 2 ? '#1E9FE9' : (gp.score === 3 ? '#DF9117' : '#E8624A');
        var dots = '';
        for (var d = 1; d <= 5; d++) dots += '<i' + (d <= gp.score ? ' class="on"' : '') + '></i>';
        gpEl.style.setProperty('--gpc', col);
        gpEl.innerHTML = '<span class="gpl">G′</span><span class="gpm">' + dots + '</span><span class="gpt">' + gp.label + '</span>';
        gpEl.title = gp.why;
      }
    });
    var sumV = document.querySelectorAll('.sumcol .vl');
    if (sumV[0]) sumV[0].querySelector('.v').textContent = F.points;
    if (sumV[1]) sumV[1].querySelector('.v').textContent = cc1(F.totalCc[0]) + ' – ' + cc1(F.totalCc[1]);
    var rows = document.getElementById('budget-rows');
    if (rows && F.pricePerCc) {
      rows.innerHTML = F.areas.map(function (a) {
        var n = a.perSide ? 2 : 1, c0 = a.cc[0] * n, c1 = a.cc[1] * n;
        return '<div class="brow"><span class="bk">' + a.th + (a.perSide ? ' <i class="side">(2 ข้าง)</i>' : '') + '</span>'
          + '<span class="bc">' + cc1(c0) + ' – ' + cc1(c1) + ' cc</span>'
          + '<span class="bp">' + fmt(c0 * F.pricePerCc) + ' – ' + fmt(c1 * F.pricePerCc) + ' ฿</span></div>';
      }).join('');
      document.getElementById('budget-total').textContent = fmt(F.budget[0]) + ' – ' + fmt(F.budget[1]) + ' บาท';
      document.getElementById('budget').style.display = '';
    }
  }

  /* ---- measurement confidence (computed from real capture quality at scan time) ---- */
  if (scan && scan.confidence && scan.confidence.score != null) {
    var cf = scan.confidence;
    var cEl = document.getElementById('conf');
    if (cEl) {
      var ccol = cf.level === 'high' ? '#2FA152' : (cf.level === 'mid' ? '#1E9FE9' : '#DF9117');
      var pctEl = document.getElementById('conf-pct');
      pctEl.textContent = cf.score + '%'; pctEl.style.color = ccol;
      var cfill = document.getElementById('conf-fill');
      cfill.style.width = cf.score + '%'; cfill.style.background = ccol;
      document.getElementById('conf-fac').innerHTML = (cf.factors || []).map(function (f) {
        return '<span class="cf ' + (f.ok ? 'ok' : 'no') + '">' + (f.ok ? '✓' : '!') + ' ' + f.label + '</span>';
      }).join('');
      cEl.style.display = '';
    }
  }

  /* ---- share the result as an IMAGE (1080x1920 story card, drawn on-device) ----
     Mobile: native share sheet (pick Instagram). Desktop / unsupported: download PNG. */
  var toastEl = document.getElementById('toast'), toastT;
  function toast(msg) {
    toastEl.textContent = msg; toastEl.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('show'); }, 2600);
  }
  function loadImg(src) {
    return new Promise(function (res, rej) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = rej; im.src = src; });
  }
  function rrect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function buildShareCard() {
    var W = 1080, H = 1920;
    var vScore = document.querySelector('.scorenum .n').textContent;
    var vG = document.querySelector('.grade .a').textContent;
    var vGl = document.querySelector('.grade .t').textContent;
    var vSym = parseInt(document.querySelector('.symrow .pct').textContent, 10) || 0;
    var fonts = ['800 250px Inter', '500 70px Inter', '700 64px Inter', '600 46px "Noto Sans Thai"', '500 44px "Noto Sans Thai"', '600 40px "Noto Sans Thai"', '400 32px "Noto Sans Thai"'];
    return Promise.all(fonts.map(function (f) { return document.fonts.load(f); }))
      .then(function () { return Promise.all([loadImg('assets/home-bg-full.png'), loadImg('assets/logo-clean.png'), (scan && scan.img) ? loadImg(scan.img) : Promise.resolve(null)]); })
      .then(function (ims) {
        var bg = ims[0], logo = ims[1], face = ims[2];
        var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
        var c = cv.getContext('2d');
        c.fillStyle = '#EAF5FD'; c.fillRect(0, 0, W, H);
        c.drawImage(bg, 0, 0, W, H);                                     /* brand art (941x1672 ≈ story ratio) */
        var gr = c.createLinearGradient(0, H * 0.55, 0, H);
        gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,.85)');
        c.fillStyle = gr; c.fillRect(0, 0, W, H);
        var lw = 400, lh = lw * logo.height / logo.width;
        c.drawImage(logo, (W - lw) / 2, 110, lw, lh);
        c.fillStyle = '#44566B'; c.font = '500 44px "Noto Sans Thai"'; c.textAlign = 'center';
        c.fillText('ผลวิเคราะห์ใบหน้าด้วย AI 478 จุด', W / 2, 330);
        /* face cutout + halo + brackets */
        var fcx = W / 2, fcy = 700;
        c.strokeStyle = 'rgba(126,220,255,.55)'; c.lineWidth = 3;
        c.beginPath(); c.arc(fcx, fcy, 300, 0, 6.2832); c.stroke();
        c.strokeStyle = 'rgba(126,220,255,.32)';
        c.beginPath(); c.arc(fcx, fcy, 385, 0, 6.2832); c.stroke();
        if (face) { var fw = 740, fh = fw * face.height / face.width; c.drawImage(face, fcx - fw / 2, fcy - fh / 2 - 10, fw, fh); }
        c.strokeStyle = '#A3DCF9'; c.lineWidth = 14; c.lineCap = 'round';
        var bx0 = fcx - 330, bx1 = fcx + 330, by0 = fcy - 330, by1 = fcy + 330, L = 86, R = 30;
        [[bx0, by0, 1, 1], [bx1, by0, -1, 1], [bx0, by1, 1, -1], [bx1, by1, -1, -1]].forEach(function (k) {
          var x = k[0], y = k[1], sx = k[2], sy = k[3];
          c.beginPath(); c.moveTo(x, y + sy * L); c.lineTo(x, y + sy * R); c.quadraticCurveTo(x, y, x + sx * R, y); c.lineTo(x + sx * L, y); c.stroke();
        });
        /* score */
        c.fillStyle = '#44566B'; c.font = '600 46px "Noto Sans Thai"';
        c.fillText('คะแนนความเหมาะสม', W / 2, 1180);
        c.font = '800 250px Inter'; c.textAlign = 'center';
        var sw2 = c.measureText(vScore).width;
        c.font = '500 70px Inter'; var ow = c.measureText('/100').width;
        var startX = W / 2 - (sw2 + 26 + ow) / 2;
        c.fillStyle = '#1E9FE9'; c.font = '800 250px Inter'; c.textAlign = 'left';
        c.fillText(vScore, startX, 1430);
        c.fillStyle = '#8295AB'; c.font = '500 70px Inter';
        c.fillText('/100', startX + sw2 + 26, 1430);
        /* grade pill */
        c.textAlign = 'center';
        c.font = '700 64px Inter'; var gw = c.measureText(vG).width;
        c.font = '600 56px "Noto Sans Thai"'; var glw = c.measureText(vGl).width;
        var pw = gw + glw + 110, px = (W - pw) / 2, py = 1490;
        c.fillStyle = 'rgba(236,248,255,.92)'; rrect(c, px, py, pw, 110, 34); c.fill();
        c.strokeStyle = 'rgba(45,159,238,.6)'; c.lineWidth = 5; rrect(c, px, py, pw, 110, 34); c.stroke();
        c.textAlign = 'left'; c.fillStyle = '#1E9FE9';
        c.font = '700 64px Inter'; c.fillText(vG, px + 40, py + 78);
        c.font = '600 56px "Noto Sans Thai"'; c.fillText(vGl, px + 40 + gw + 30, py + 78);
        /* symmetry */
        c.textAlign = 'center'; c.fillStyle = '#2A3F57'; c.font = '600 40px "Noto Sans Thai"';
        c.fillText('ความสมมาตรใบหน้า ' + vSym + '%', W / 2, 1700);
        var bw = 520, bx = (W - bw) / 2, byy = 1730;
        c.fillStyle = '#DCEEFA'; rrect(c, bx, byy, bw, 16, 8); c.fill();
        var fillW = Math.max(24, bw * vSym / 100);
        var bg2 = c.createLinearGradient(bx, 0, bx + fillW, 0);
        bg2.addColorStop(0, '#7ED0FA'); bg2.addColorStop(1, '#2D9FEE');
        c.fillStyle = bg2; rrect(c, bx, byy, fillW, 16, 8); c.fill();
        /* footer */
        c.fillStyle = '#8295AB'; c.font = '400 32px "Noto Sans Thai"';
        c.fillText('ผลประเมินเบื้องต้นจาก AI • ประมวลผลบนเครื่องของคุณ', W / 2, 1830);
        c.fillStyle = '#94A5B8'; c.font = '500 30px Inter';
        c.fillText('arface-scan-9277.netlify.app', W / 2, 1878);
        return cv;
      });
  }
  var sharing = false;
  var shareBtn = document.getElementById('btn-share');
  if (shareBtn) shareBtn.addEventListener('click', function () {
    if (sharing) return;
    sharing = true;
    buildShareCard().then(function (cv) {
      cv.toBlob(function (blob) {
        sharing = false;
        if (!blob) { toast('สร้างรูปไม่สำเร็จ ลองอีกครั้ง'); return; }
        var file = new File([blob], 'arface-result.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file], title: 'ARFACE', text: 'ผลวิเคราะห์ใบหน้าของฉันจาก ARFACE' })
            .then(function () { toast('แชร์สำเร็จ'); })
            .catch(function () { /* user closed the sheet */ });
        } else {
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'arface-result.png';
          document.body.appendChild(a); a.click(); a.remove();
          toast('บันทึกรูปแล้ว — เปิด Instagram แล้วเลือกรูปนี้จากเครื่องได้เลย');
        }
      }, 'image/png');
    }).catch(function () { sharing = false; toast('สร้างรูปไม่สำเร็จ ลองอีกครั้ง'); });
  });
  /* test hook: ?sharecard=1 renders the generated card full-page for verification */
  if (q.get('sharecard') === '1') {
    buildShareCard().then(function (cv) {
      document.body.innerHTML = '';
      document.body.style.cssText = 'margin:0; background:#1B2735; display:flex; justify-content:center; padding:20px 0;';
      var im = new Image(); im.src = cv.toDataURL('image/png');
      im.style.cssText = 'width:540px; height:auto; border-radius:18px;';
      document.body.appendChild(im);
      window.__shareCardReady = true;
    });
  }

  /* ---- show the customer's actual scanned photo (saved on-device by scan.html) ---- */
  if (score == null || !scan || !scan.img || !scan.anchors) return;

  var RW = 240, RH = 216, PILL_X = 174, PILL_Y = [40.5, 74.5, 108.5, 142.5, 176.5];
  var model = document.querySelector('.hero .model');
  model.src = scan.img;
  model.alt = 'ใบหน้าของคุณพร้อมจุดแนะนำฟิลเลอร์';
  model.classList.add('real');

  var order = ['temple', 'eye', 'naso', 'lips', 'chin'];
  var pins = document.querySelectorAll('.hero .pin');
  var paths = '';
  order.forEach(function (k, i) {
    var a = scan.anchors[k], pin = pins[i];
    if (!a || !pin) return;
    var px = Math.min(Math.max(a.x * RW, 14), RW - 8);
    var py = Math.min(Math.max(a.y * RH, 14), RH - 12);
    pin.style.left = (px - 5.5) + 'px';
    pin.style.top = (py - 5.5) + 'px';
    paths += 'M' + px.toFixed(1) + ' ' + py.toFixed(1) + ' L' + (PILL_X - 20) + ' ' + PILL_Y[i] + ' H' + PILL_X + ' ';
  });
  var dash = document.querySelector('.hero svg.dash');
  if (dash) dash.innerHTML = '<path d="' + paths.trim() + '"/>';

  /* rec-card thumbnails -> crops of the customer's photo centred on each anchor */
  var thumbs = document.querySelectorAll('.rec .thumb img');
  var zoomFor = { eye: 250, naso: 205, chin: 205, lips: 250, temple: 230 };
  ['eye', 'naso', 'chin', 'lips', 'temple'].forEach(function (k, i) {
    var a = scan.anchors[k], img = thumbs[i];
    if (!a || !img) return;
    var w = zoomFor[k], h = w * RH / RW;
    var left = Math.min(Math.max(33 - a.x * w, 66 - w), 0);
    var top = Math.min(Math.max(29 - a.y * h, 58 - h), 0);
    img.src = scan.img;
    img.style.width = w + 'px';
    img.style.left = left + 'px';
    img.style.top = top + 'px';
  });
})();
if ('serviceWorker' in navigator) addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
