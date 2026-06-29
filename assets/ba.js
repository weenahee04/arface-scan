(function () {
  var scan = null;
  try { scan = JSON.parse(localStorage.getItem('arface.lastScan') || 'null'); } catch (e) {}
  if (!scan || !scan.img) { location.replace('scan.html'); return; }

  var toastEl = document.getElementById('toast'), toastT;
  function toast(msg) {
    toastEl.textContent = msg; toastEl.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('show'); }, 2600);
  }

  var sim = scan.sim || null;
  var hasSim = !!(sim && sim.eyes && sim.naso && sim.chin);
  if (!hasSim) {
    document.getElementById('rescan').classList.add('show');
    document.getElementById('btn-share').style.visibility = 'hidden';
  }

  /* per-area strength baseline from the real assessment */
  /* preview is meant to clearly SHOW the potential — keep a strong floor even for low-need areas */
  var base = { eye: 0.95, naso: 0.95, chin: 0.95 };
  if (scan.filler && scan.filler.areas) scan.filler.areas.forEach(function (a) {
    base[a.id] = a.level === 'high' ? 1 : a.level === 'mid' ? 1 : 0.9;
  });

  var before = document.getElementById('cv-before'), after = document.getElementById('cv-after');
  var bctx = before.getContext('2d'), actx = after.getContext('2d');
  var photo = new Image();
  var W = 480, H = 432;
  var on = { eye: true, naso: true, chin: true };
  var intensity = 0.8;

  var PXX = function (n) { return n * W; }, PXY = function (n) { return n * H; }, PR = function (n) { return n * W; };

  function rrectP(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function featherInto(o, w, h, cx, cy, rx, ry, alpha) {
    o.globalCompositeOperation = 'destination-in';
    o.save(); o.translate(cx, cy); o.scale(rx, ry);
    var g = o.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, 'rgba(0,0,0,' + alpha + ')');
    g.addColorStop(0.55, 'rgba(0,0,0,' + alpha + ')');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    o.fillStyle = g; o.fillRect(-30, -30, 60, 60);
    o.restore(); o.globalCompositeOperation = 'source-over';
  }
  /* soften + brighten an elliptical region of the AFTER canvas (samples current state) */
  function softEllipse(cx, cy, rx, ry, blurPx, bright, alpha) {
    var pad = 1.5;
    var bx = Math.max(0, cx - rx * pad), by = Math.max(0, cy - ry * pad);
    var bw = Math.min(W - bx, rx * pad * 2), bh = Math.min(H - by, ry * pad * 2);
    if (bw < 4 || bh < 4) return;
    var off = document.createElement('canvas'); off.width = bw; off.height = bh;
    var o = off.getContext('2d');
    o.filter = 'blur(' + blurPx + 'px) brightness(' + bright + ')';
    o.drawImage(after, bx, by, bw, bh, 0, 0, bw, bh);
    o.filter = 'none';
    featherInto(o, bw, bh, cx - bx, cy - by, rx, ry, alpha);
    actx.drawImage(off, bx, by);
  }
  /* subtle reshape of the chin region (slightly slimmer + longer) */
  function chinReshape(cx, cy, r, s) {
    var w = r * 3, h = r * 3;
    var bx = Math.max(0, cx - w / 2), by = Math.max(0, cy - h / 2);
    w = Math.min(W - bx, w); h = Math.min(H - by, h);
    if (w < 4 || h < 4) return;
    var off = document.createElement('canvas'); off.width = w; off.height = h;
    var o = off.getContext('2d');
    o.translate(w / 2, 0);
    o.scale(1 - 0.08 * s, 1 + 0.085 * s);
    o.translate(-w / 2, 0);
    o.drawImage(after, bx, by, w, h, 0, 0, w, h);
    o.setTransform(1, 0, 0, 1, 0, 0);
    featherInto(o, w, h, cx - bx, cy - by, r * 1.15, r * 1.15, Math.min(1, 1.15 * s));
    actx.drawImage(off, bx, by);
  }

  function render() {
    bctx.clearRect(0, 0, W, H); bctx.drawImage(photo, 0, 0, W, H);
    actx.clearRect(0, 0, W, H); actx.drawImage(photo, 0, 0, W, H);
    if (!hasSim) return;
    if (on.eye) {
      var se = intensity * base.eye;
      sim.eyes.forEach(function (e) {
        softEllipse(PXX(e.c.x), PXY(e.c.y), PR(e.rx) * 1.06, PR(e.ry) * 1.06, 3.8, 1 + 0.34 * se, 1.0 * se);
      });
    }
    if (on.naso) {
      var sn = intensity * base.naso;
      sim.naso.forEach(function (seg) {
        var ax2 = PXX(seg.a.x), ay = PXY(seg.a.y), bx2 = PXX(seg.b.x), byy = PXY(seg.b.y);
        var len = Math.hypot(bx2 - ax2, byy - ay);
        [0.18, 0.42, 0.66, 0.88].forEach(function (t, i) {
          var r = len * 0.30 * (1 - t * 0.25);
          softEllipse(ax2 + (bx2 - ax2) * t, ay + (byy - ay) * t, r, r, 3.0, 1 + 0.18 * sn, 0.95 * sn);
        });
      });
    }
    if (on.chin) chinReshape(PXX(sim.chin.c.x), PXY(sim.chin.c.y), PR(sim.chin.r), intensity * base.chin);
    window.__baReady = true;
  }

  /* ---------- slider ---------- */
  var stage = document.getElementById('stage'), divider = document.getElementById('divider'), grip = document.getElementById('grip');
  var frac = 0.5;
  function setFrac(f) {
    frac = Math.max(0.06, Math.min(0.94, f));
    after.style.clipPath = 'inset(0 0 0 ' + (frac * 100) + '%)';
    divider.style.left = 'calc(' + (frac * 100) + '% - 1.25px)';
    grip.style.left = (frac * 100) + '%';
  }
  var dragging = false;
  function fromEvent(ev) {
    var r = stage.getBoundingClientRect();
    setFrac((ev.clientX - r.left) / r.width);
  }
  stage.addEventListener('pointerdown', function (ev) { dragging = true; stage.setPointerCapture(ev.pointerId); fromEvent(ev); });
  stage.addEventListener('pointermove', function (ev) { if (dragging) fromEvent(ev); });
  stage.addEventListener('pointerup', function () { dragging = false; });
  stage.addEventListener('pointercancel', function () { dragging = false; });

  /* ---------- controls ---------- */
  document.querySelectorAll('.tgl').forEach(function (b) {
    b.addEventListener('click', function () {
      var k = b.getAttribute('data-area');
      on[k] = !on[k];
      b.classList.toggle('on', on[k]);
      render();
    });
  });
  document.querySelectorAll('#intensity button').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('#intensity button').forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      intensity = parseFloat(b.getAttribute('data-v')) || 0.7;
      render();
    });
  });

  /* ---------- share before/after card ---------- */
  function loadImg(src) {
    return new Promise(function (res, rej) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = rej; im.src = src; });
  }
  function buildCard() {
    var CW = 1080, CH = 1920;
    var fonts = ['600 52px "Noto Sans Thai"', '500 44px "Noto Sans Thai"', '600 46px "Noto Sans Thai"', '400 32px "Noto Sans Thai"', '500 30px Inter'];
    return Promise.all(fonts.map(function (f) { return document.fonts.load(f); }))
      .then(function () { return Promise.all([loadImg('assets/home-bg-full.png'), loadImg('assets/logo-clean.png')]); })
      .then(function (ims) {
        var bg = ims[0], logo = ims[1];
        var cv = document.createElement('canvas'); cv.width = CW; cv.height = CH;
        var c = cv.getContext('2d');
        c.fillStyle = '#EAF5FD'; c.fillRect(0, 0, CW, CH);
        c.drawImage(bg, 0, 0, CW, CH);
        var gr = c.createLinearGradient(0, CH * 0.55, 0, CH);
        gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,.85)');
        c.fillStyle = gr; c.fillRect(0, 0, CW, CH);
        var lw = 380, lh = lw * logo.height / logo.width;
        c.drawImage(logo, (CW - lw) / 2, 120, lw, lh);
        c.fillStyle = '#44566B'; c.font = '500 44px "Noto Sans Thai"'; c.textAlign = 'center';
        c.fillText('จำลองผลลัพธ์ฟิลเลอร์ • ภาพจำลองเบื้องต้น', CW / 2, 330);
        /* before / after panels */
        var pw = 484, ph = pw * H / W, gap = 40;
        var x1 = (CW - pw * 2 - gap) / 2, x2 = x1 + pw + gap, py = 520;
        [[before, x1, 'ก่อน', '#44566B'], [after, x2, 'หลัง', '#1E9FE9']].forEach(function (k) {
          var src = k[0], x = k[1], label = k[2], col = k[3];
          c.fillStyle = col; c.font = '600 52px "Noto Sans Thai"'; c.textAlign = 'center';
          c.fillText(label, x + pw / 2, py - 36);
          c.save(); rrectP(c, x, py, pw, ph, 30); c.clip();
          c.fillStyle = '#EAF4FC'; c.fillRect(x, py, pw, ph);
          c.drawImage(src, x, py, pw, ph);
          c.restore();
          c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = 6;
          rrectP(c, x, py, pw, ph, 30); c.stroke();
        });
        /* enabled areas */
        var names = { eye: 'ใต้ตา', naso: 'ร่องแก้ม', chin: 'คาง' };
        var enabled = Object.keys(on).filter(function (k) { return on[k]; }).map(function (k) { return names[k]; });
        c.fillStyle = '#2A3F57'; c.font = '600 46px "Noto Sans Thai"'; c.textAlign = 'center';
        c.fillText('จุดที่จำลอง: ' + (enabled.length ? enabled.join(' • ') : '—'), CW / 2, py + ph + 130);
        c.fillStyle = '#8295AB'; c.font = '400 32px "Noto Sans Thai"';
        c.fillText('ภาพจำลองเบื้องต้นจาก AI ไม่ใช่ผลลัพธ์ที่รับประกัน', CW / 2, 1810);
        c.fillStyle = '#94A5B8'; c.font = '500 30px Inter';
        c.fillText('arface-scan-9277.netlify.app', CW / 2, 1862);
        return cv;
      });
  }
  var sharing = false;
  function share() {
    if (sharing || !hasSim) return;
    sharing = true;
    buildCard().then(function (cv) {
      cv.toBlob(function (blob) {
        sharing = false;
        if (!blob) { toast('สร้างรูปไม่สำเร็จ ลองอีกครั้ง'); return; }
        var file = new File([blob], 'arface-before-after.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file], title: 'ARFACE', text: 'จำลองผลลัพธ์ฟิลเลอร์ของฉันจาก ARFACE' })
            .then(function () { toast('แชร์สำเร็จ'); })
            .catch(function () {});
        } else {
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'arface-before-after.png';
          document.body.appendChild(a); a.click(); a.remove();
          toast('บันทึกรูปแล้ว — เปิด Instagram แล้วเลือกรูปนี้จากเครื่องได้เลย');
        }
      }, 'image/png');
    }).catch(function () { sharing = false; toast('สร้างรูปไม่สำเร็จ ลองอีกครั้ง'); });
  }
  document.getElementById('btn-share').addEventListener('click', share);
  document.getElementById('btn-share2').addEventListener('click', share);

  /* ---------- boot ---------- */
  photo.onload = function () {
    W = photo.naturalWidth || 480; H = photo.naturalHeight || 432;
    before.width = W; before.height = H;
    after.width = W; after.height = H;
    render();
    setFrac(0.5);
    /* test hooks */
    window.__lum = function (which, nx, ny, r) {
      var ctx2 = which === 'after' ? actx : bctx;
      var px = Math.round(nx * W), pyy = Math.round(ny * H), rr = Math.round(r * W);
      var d = ctx2.getImageData(Math.max(0, px - rr), Math.max(0, pyy - rr), rr * 2, rr * 2).data;
      var s = 0, n = 0;
      for (var i = 0; i < d.length; i += 16) { if (d[i + 3] > 40) { s += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; n++; } }
      return n ? +(s / n).toFixed(2) : 0;
    };
    var q = new URLSearchParams(location.search);
    if (q.get('sharecard') === '1' && hasSim) {
      buildCard().then(function (cv) {
        document.body.innerHTML = '';
        document.body.style.cssText = 'margin:0; background:#1B2735; display:flex; justify-content:center; padding:20px 0;';
        var im = new Image(); im.src = cv.toDataURL('image/png');
        im.style.cssText = 'width:540px; height:auto; border-radius:18px;';
        document.body.appendChild(im);
        window.__shareCardReady = true;
      });
    }
  };
  photo.src = scan.img;
})();
if ('serviceWorker' in navigator) addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
