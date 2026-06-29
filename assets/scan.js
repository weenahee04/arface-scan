import { getVideoLandmarker, getImageLandmarker, firstFace, coverMap, drawMesh, framing, computeMetrics, captureFrame, analyzeSkin, assessFiller, captureQuality, classifyFaceShape, drawFillerPreview, smileScore, measurementConfidence } from './face-engine.js';
import { store } from './store.js';

const $ = (id) => document.getElementById(id);
const viewport = $('viewport'), video = $('cam'), canvas = $('overlay'), ctx = canvas.getContext('2d');
const pill = $('pill'), pilltext = $('pilltext'), guide = $('guide');
const holdring = $('holdring'), ringfill = $('ringfill'), ringpct = $('ringpct');
const ovlIdle = $('ovl-idle'), ovlBusy = $('ovl-busy'), ovlErr = $('ovl-err'), sheet = $('sheet');

const state = { mode: 'idle', stream: null, raf: 0, heldMs: 0, lastT: 0, lastNose: null, metrics: null, q: null, qLast: 0, ar: false };
let lmVideo = null; // cached VIDEO-mode landmarker for the render loop
const qcv = document.createElement('canvas'), qctx = qcv.getContext('2d', { willReadFrequently: true });

/* ---------- in-app browser handling (LINE/FB/IG/TikTok WebViews block the camera) ---------- */
const detectInApp = (ua) => /\bLine\/\d/i.test(ua) ? 'line'
  : /FBAN|FBAV|FB_IAB/i.test(ua) ? 'facebook'
  : /Instagram/i.test(ua) ? 'instagram'
  : /TikTok|Bytedance/i.test(ua) ? 'tiktok' : null;
const IN_APP = new URLSearchParams(location.search).get('inapp') || detectInApp(navigator.userAgent);
const camSupported = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
function cleanShareURL() {
  const u = new URL(location.href);
  ['inapp', 'openExternalBrowser', 'demo', 'go', 'qtest', 'v'].forEach((k) => u.searchParams.delete(k));
  return u.toString();
}
function lineEscapeURL() {
  const u = new URL(location.href);
  u.searchParams.delete('inapp');
  u.searchParams.set('openExternalBrowser', '1');
  return u.toString();
}
window.__inapp = { IN_APP, camSupported, detectInApp, lineEscapeURL, cleanShareURL }; /* test hook */
if (IN_APP) {
  const note = $('inapp-note');
  note.hidden = false;
  $('inapp-name').textContent = ({ line: 'LINE', facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok' })[IN_APP] || 'แอป';
  if (IN_APP === 'line') $('inapp-open').href = lineEscapeURL();
  else $('inapp-open').style.display = 'none';
  $('inapp-copy').onclick = async () => {
    try { await navigator.clipboard.writeText(cleanShareURL()); $('inapp-copy').textContent = 'คัดลอกลิงก์แล้ว ✓'; }
    catch { $('inapp-copy').textContent = cleanShareURL(); }
  };
}

function show(el, on = true) { el.classList.toggle('show', on); }
function setPill(text, ok = false) { show(pill, !!text); pilltext.textContent = text || ''; pill.classList.toggle('ok', ok); }
const hintchip = $('hintchip'), hinttext = $('hinttext');
function hint(text) { show(hintchip, !!text); hinttext.textContent = text || ''; }
const suggestionFor = (q) => !q ? null
  : q.flags.glasses ? 'ถอดแว่นตาเพื่อความแม่นยำ'
  : q.flags.backlit ? 'หลีกเลี่ยงการย้อนแสง — หันหน้าเข้าหาแสง'
  : q.flags.uneven ? 'ปรับแสงให้สม่ำเสมอทั้งสองข้าง'
  : null;
function setBusy(t, s) { $('busytext').textContent = t; if (s) $('busysub').textContent = s; show(ovlBusy, true); }
function fail(title, text, opts) {
  stopCam();
  show(ovlBusy, false); show(ovlIdle, false); show(guide, false); setPill('');
  $('errtitle').textContent = title; $('errtext').textContent = text;
  /* universal fallback: the device camera uses the OS camera permission, so it
     works even when getUserMedia is blocked (in-app browser / permission denied) */
  $('btn-cam-err').hidden = !(opts && opts.photo);
  show(ovlErr, true);
}

/* canvas sizing (DOM-specific). Detection, mesh, scoring, capture live in face-engine.js */
function fitCanvas() {
  const r = viewport.getBoundingClientRect();
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { W: r.width, H: r.height };
}

const resultURL = (m) => `result.html?score=${m.overall}&sym=${m.symmetry}&g=${encodeURIComponent(m.grade[0])}&gl=${encodeURIComponent(m.grade[1])}`;

/* persist the scan on-device (face crop + anchors + metrics + skin) for the result/history pages */
function persist(srcEl, pts, mirror, iw, ih, m) {
  try {
    const cap = captureFrame(srcEl, pts, mirror, iw, ih);
    let skin = null, filler = null, shape = null, confidence = null;
    try {
      const tc = document.createElement('canvas'); tc.width = iw; tc.height = ih;
      tc.getContext('2d').drawImage(srcEl, 0, 0, iw, ih);
      // NOTE: the source frame is unmirrored pixels; patches use raw landmark coords
      skin = analyzeSkin(tc, pts, iw, ih, false);
      filler = assessFiller(tc, pts, iw, ih, false, iw / ih);
      shape = classifyFaceShape(pts, iw / ih);
      confidence = measurementConfidence(tc, pts, iw, ih, m);
    } catch {}
    store.saveScan({ ...cap, metrics: { overall: m.overall, symmetry: m.symmetry, golden: m.golden, grade: m.grade, parts: m.parts }, skin, filler, shape, confidence, ts: Date.now() });
  } catch { /* quota/private mode — result page falls back to the stock photo */ }
}

/* ---------- live camera scan ---------- */
async function startCamera() {
  /* in-app WebViews (LINE/FB/IG) block getUserMedia — use the device's native
     camera via the capture input instead; same analysis pipeline afterwards */
  if (IN_APP || !camSupported) {
    window.__lastStartPath = 'native-capture'; /* test hook */
    $('file-cam').click();
    return;
  }
  window.__lastStartPath = 'live';
  show(ovlIdle, false); show(ovlErr, false); show(sheet, false); hint(null);
  viewport.classList.add('mirror');
  setBusy('กำลังโหลดโมเดล AI…', 'face_landmarker (478 landmarks) ทำงานบนเครื่องของคุณ');
  try { lmVideo = await getVideoLandmarker(); } catch { return fail('โหลดโมเดลไม่สำเร็จ', 'ไม่สามารถโหลด face_landmarker.task ได้ — รีเฟรชหน้าแล้วลองใหม่'); }
  setBusy('กำลังเปิดกล้อง…', 'กรุณาอนุญาตการใช้กล้องเมื่อเบราว์เซอร์ถาม');
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 1280 } }, audio: false,
    });
  } catch (e) {
    if (IN_APP) {
      return fail('เบราว์เซอร์ในแอปไม่รองรับกล้องสด',
        'แตะ "ถ่ายรูปด้วยกล้อง" เพื่อใช้กล้องของเครื่อง' + (IN_APP === 'line' ? ' หรือเปิดในเบราว์เซอร์หลัก' : ''),
        { photo: true });
    }
    const denied = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
    const busy = e && (e.name === 'NotReadableError' || e.name === 'TrackStartError' || e.name === 'AbortError');
    return fail(
      denied ? 'กล้องถูกปิดสิทธิ์ไว้' : busy ? 'กล้องกำลังถูกใช้งานอยู่' : 'เปิดกล้องสดไม่ได้',
      denied ? 'แตะ "ถ่ายรูปด้วยกล้อง" เพื่อใช้กล้องของเครื่อง (ข้ามการบล็อก) หรือเปิดสิทธิ์กล้องในเบราว์เซอร์แล้วลองใหม่'
        : busy ? 'ปิดแอปอื่นที่กำลังใช้กล้องอยู่ (วิดีโอคอล/กล้อง) แล้วลองใหม่ หรือแตะ "ถ่ายรูปด้วยกล้อง"'
        : 'แตะ "ถ่ายรูปด้วยกล้อง" เพื่อใช้กล้องของเครื่องแทน',
      { photo: true });
  }
  video.srcObject = state.stream;
  try { await video.play(); } catch {}
  show(ovlBusy, false); show(guide, true);
  $('ar-toggle').style.display = 'inline-flex';
  state.mode = 'live'; state.heldMs = 0; state.lastNose = null; state.lastT = performance.now();
  loop();
}
function stopCam() {
  cancelAnimationFrame(state.raf);
  if (state.stream) { for (const t of state.stream.getTracks()) t.stop(); state.stream = null; }
  video.srcObject = null;
}
function loop() {
  if (state.mode !== 'live') return;
  state.raf = requestAnimationFrame(loop);
  if (video.readyState < 2 || !video.videoWidth) return;
  const t = performance.now();
  const dt = t - state.lastT; state.lastT = t;
  let res;
  try { res = lmVideo.detectForVideo(video, t); } catch { return; }
  const { W, H } = fitCanvas();
  ctx.clearRect(0, 0, W, H);
  const pts = firstFace(res);
  const map = coverMap(video.videoWidth, video.videoHeight, W, H);
  if (pts) drawMesh(ctx, pts, map);
  if (state.ar && pts) drawFillerPreview(ctx, pts, map);
  /* capture-quality coach (lighting / glasses) — sampled a few times a second */
  if (t - state.qLast > 450) {
    state.qLast = t;
    try {
      qcv.width = 160; qcv.height = Math.round(160 * video.videoHeight / video.videoWidth);
      qctx.drawImage(video, 0, 0, qcv.width, qcv.height);
      state.q = captureQuality(qcv, pts);
      window.__quality = state.q; /* test hook */
    } catch {}
  }
  let fr = framing(pts);
  if (state.q && state.q.flags.dark) fr = { ok: false, hint: 'แสงน้อยเกินไป — เพิ่มแสงสว่าง' };
  else if (state.q && state.q.flags.bright) fr = { ok: false, hint: 'แสงจ้าเกินไป — ลดแสงสะท้อนบนใบหน้า' };
  setPill(fr.hint, fr.ok);
  hint(suggestionFor(state.q));
  /* hold-still gate, or smile to capture instantly */
  if (pts && fr.ok) {
    setPill('ยิ้มเพื่อถ่าย • หรือถือนิ่ง ๆ', true);
    if (smileScore(res) > 0.45) return captureLive(pts);
    const nose = map(pts[1].x, pts[1].y);
    const moved = state.lastNose ? Math.hypot(nose.x - state.lastNose.x, nose.y - state.lastNose.y) : 0;
    state.lastNose = nose;
    state.heldMs = moved < 7 ? state.heldMs + dt : 0;
    const pc = Math.min(state.heldMs / 1600, 1);
    show(holdring, true);
    ringfill.style.strokeDashoffset = (150.8 * (1 - pc)).toFixed(1);
    ringpct.textContent = Math.round(pc * 100) + '%';
    if (pc >= 1) return captureLive(pts);
  } else {
    state.heldMs = 0; state.lastNose = null; show(holdring, false);
  }
}
function captureLive(pts) {
  state.mode = 'done';
  cancelAnimationFrame(state.raf);
  const m = computeMetrics(pts, video.videoWidth / video.videoHeight);
  persist(video, pts, true, video.videoWidth, video.videoHeight, m);
  $('flash').classList.add('go');
  setPill('สแกนสำเร็จ — กำลังวิเคราะห์…', true);
  show(holdring, false); $('ar-toggle').style.display = 'none';
  stopCam();
  setTimeout(() => { location.href = resultURL(m); }, 650);
}

/* ---------- photo path (upload / sample) ---------- */
async function analyzePhoto(src, mirror = false) {
  show(ovlIdle, false); show(ovlErr, false); show(sheet, false); show(guide, false); setPill(''); hint(null);
  stopCam(); state.mode = 'photo';
  viewport.classList.toggle('mirror', mirror);
  setBusy('กำลังโหลดโมเดล AI…', 'face_landmarker (478 landmarks) ทำงานบนเครื่องของคุณ');
  let lm;
  try { lm = await getImageLandmarker(); } catch { return fail('โหลดโมเดลไม่สำเร็จ', 'ไม่สามารถโหลด face_landmarker.task ได้ — รีเฟรชหน้าแล้วลองใหม่'); }
  setBusy('กำลังวิเคราะห์ใบหน้า…', 'ตรวจจับ 478 จุด landmark แบบ 3 มิติ');
  const img = new Image();
  img.src = src;
  try { await img.decode(); } catch { return fail('เปิดรูปไม่ได้', 'ไฟล์รูปไม่ถูกต้อง ลองเลือกรูปอื่น'); }
  let res;
  try { res = lm.detect(img); } catch { return fail('วิเคราะห์ไม่สำเร็จ', 'ลองใหม่อีกครั้ง หรือเลือกรูปอื่น'); }
  show(ovlBusy, false);
  const { W, H } = fitCanvas();
  const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(img, (W - img.naturalWidth * s) / 2, (H - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
  const pts = firstFace(res);
  if (!pts) { setPill('ไม่พบใบหน้าในรูป', false); show(ovlIdle, true); return; }
  drawMesh(ctx, pts, coverMap(img.naturalWidth, img.naturalHeight, W, H));
  /* photo-quality coaching: warn (don't block) when the photo will hurt accuracy */
  try {
    qcv.width = 160; qcv.height = Math.round(160 * img.naturalHeight / img.naturalWidth);
    qctx.drawImage(img, 0, 0, qcv.width, qcv.height);
    const q = captureQuality(qcv, pts);
    window.__quality = q; /* test hook */
    const sug = q.flags.dark ? 'แนะนำ: เพิ่มแสงสว่างแล้วสแกนใหม่ เพื่อความแม่นยำ'
      : q.flags.glasses ? 'แนะนำ: ถอดแว่นตาแล้วสแกนใหม่ เพื่อความแม่นยำ'
      : q.flags.backlit ? 'แนะนำ: เลี่ยงการย้อนแสง แล้วสแกนใหม่'
      : q.flags.uneven ? 'แนะนำ: ปรับแสงให้สม่ำเสมอ แล้วสแกนใหม่' : null;
    hint(sug);
  } catch {}
  const m = computeMetrics(pts, img.naturalWidth / img.naturalHeight);
  persist(img, pts, mirror, img.naturalWidth, img.naturalHeight, m);
  if (new URLSearchParams(location.search).get('go') === '1') { location.href = resultURL(m); return; }
  state.metrics = m;
  $('sheet-score').textContent = m.overall;
  $('sheet-grade').textContent = `เกรด ${m.grade[0]} ${m.grade[1]}`;
  $('sheet-sym').textContent = `ความสมมาตรใบหน้า ${m.symmetry}% • 478 จุด`;
  setPill('วิเคราะห์สำเร็จ', true);
  show(sheet, true);
  window.__scanDone = m; /* test hook */
}

/* ---------- wiring ---------- */
$('btn-start').onclick = startCamera;
$('btn-retry').onclick = startCamera;
const pickFile = () => $('file').click();
$('btn-upload').onclick = pickFile; $('btn-upload2').onclick = pickFile;
$('file').onchange = (e) => {
  const f = e.target.files && e.target.files[0];
  if (f) analyzePhoto(URL.createObjectURL(f), false);
  e.target.value = '';
};
$('file-cam').onchange = (e) => {
  const f = e.target.files && e.target.files[0];
  if (f) analyzePhoto(URL.createObjectURL(f), false);
  e.target.value = '';
};
const demo = () => analyzePhoto('assets/model.png', false);
$('btn-demo').onclick = demo; $('btn-demo2').onclick = demo;
$('btn-cam-err').onclick = () => $('file-cam').click(); /* device camera — works even when getUserMedia is blocked */
$('btn-result').onclick = () => { if (state.metrics) location.href = resultURL(state.metrics); };
$('ar-toggle').onclick = () => { state.ar = !state.ar; const b = $('ar-toggle'); b.classList.toggle('on', state.ar); b.setAttribute('aria-pressed', state.ar ? 'true' : 'false'); };
addEventListener('pagehide', stopCam);

/* quality-coach self-test: ?demo=1&qtest=glasses|dark draws a synthetic condition
   onto the sample photo (placed via real landmarks) and runs it through the coach */
async function demoWith(mod) {
  setBusy('เตรียมภาพทดสอบ…', 'qtest: ' + mod);
  let lm;
  try { lm = await getImageLandmarker(); } catch { return fail('โหลดโมเดลไม่สำเร็จ', 'ลองใหม่อีกครั้ง'); }
  const img = new Image(); img.src = 'assets/model.png';
  try { await img.decode(); } catch { return; }
  const pts = firstFace(lm.detect(img));
  if (!pts) return;
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext('2d');
  if (mod === 'dark') { x.filter = 'brightness(0.3)'; x.drawImage(img, 0, 0); x.filter = 'none'; }
  else x.drawImage(img, 0, 0);
  if (mod === 'glasses') {
    const P = (i) => ({ x: pts[i].x * c.width, y: pts[i].y * c.height });
    const g = Math.abs(P(263).x - P(33).x);
    const eL = P(159), eR = P(386);
    x.strokeStyle = '#20242B'; x.lineWidth = Math.max(4, g * 0.07); x.lineJoin = 'round'; x.lineCap = 'round';
    const lens = (cx2, cy2) => { x.beginPath(); x.rect(cx2 - g * 0.32, cy2 - g * 0.20, g * 0.64, g * 0.44); x.stroke(); };
    lens(eL.x, eL.y + g * 0.06); lens(eR.x, eR.y + g * 0.06);
    x.beginPath(); x.moveTo(eL.x + g * 0.32, eL.y + g * 0.02); x.lineTo(eR.x - g * 0.32, eR.y + g * 0.02); x.stroke();
    x.beginPath(); x.moveTo(eL.x - g * 0.32, eL.y + g * 0.02); x.lineTo(eL.x - g * 0.6, eL.y - g * 0.04); x.stroke();
    x.beginPath(); x.moveTo(eR.x + g * 0.32, eR.y + g * 0.02); x.lineTo(eR.x + g * 0.6, eR.y - g * 0.04); x.stroke();
  }
  analyzePhoto(c.toDataURL('image/jpeg', 0.92), false);
}
const qsBoot = new URLSearchParams(location.search);
if (qsBoot.get('demo') === '1') { const qt = qsBoot.get('qtest'); qt ? demoWith(qt) : demo(); }
if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
