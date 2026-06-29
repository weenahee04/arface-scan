/* ============================================================
   ARFACE — on-device face engine (Google MediaPipe FaceLandmarker)
   478 3D landmarks, runs entirely in the browser (WASM, self-hosted).
   The selfie never leaves the device. Reused by scan / planning /
   before-after. NOT a medical diagnosis — heuristics for UX only.
   ============================================================ */
import { FaceLandmarker, FilesetResolver } from './mediapipe/vision_bundle.mjs';

const WASM  = 'assets/mediapipe/wasm';
const MODEL = 'assets/models/face_landmarker.task';

let visionP = null, lmVideo = null, lmImage = null;
const vision = () => visionP || (visionP = FilesetResolver.forVisionTasks(WASM));

async function make(runningMode) {
  const v = await vision();
  const opts = (delegate) => ({
    baseOptions: { modelAssetPath: MODEL, delegate },
    runningMode, numFaces: 1, outputFaceBlendshapes: runningMode === 'VIDEO', outputFacialTransformationMatrixes: false,
  });
  try { return await FaceLandmarker.createFromOptions(v, opts('GPU')); }
  catch { return await FaceLandmarker.createFromOptions(v, opts('CPU')); }
}
export const getVideoLandmarker = async () => lmVideo || (lmVideo = await make('VIDEO'));
export const getImageLandmarker = async () => lmImage || (lmImage = await make('IMAGE'));

/* first normalized face (array of {x,y,z}) or null */
export const firstFace = (res) => (res && res.faceLandmarks && res.faceLandmarks[0]) || null;

/* normalized [0,1] -> canvas px, accounting for object-fit: cover crop */
export function coverMap(srcW, srcH, W, H) {
  const s = Math.max(W / srcW, H / srcH);
  const dx = (W - srcW * s) / 2, dy = (H - srcH * s) / 2;
  return (nx, ny) => ({ x: nx * srcW * s + dx, y: ny * srcH * s + dy });
}

/* brand-style mesh: faint tessellation + cyan contours + dots */
export function drawMesh(ctx, pts, map) {
  const line = (conns, color, lw) => {
    if (!Array.isArray(conns)) return;
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.beginPath();
    for (const c of conns) {
      const a = pts[c.start], b = pts[c.end]; if (!a || !b) continue;
      const pa = map(a.x, a.y), pb = map(b.x, b.y);
      ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y);
    }
    ctx.stroke();
  };
  line(FaceLandmarker.FACE_LANDMARKS_TESSELATION, 'rgba(208,236,252,0.28)', 0.5);
  const cy = 'rgba(40,191,239,0.95)';
  line(FaceLandmarker.FACE_LANDMARKS_FACE_OVAL, cy, 1.7);
  line(FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW, cy, 1.4);
  line(FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW, cy, 1.4);
  line(FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, cy, 1.4);
  line(FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, cy, 1.4);
  line(FaceLandmarker.FACE_LANDMARKS_LIPS, cy, 1.6);
  ctx.fillStyle = 'rgba(126,220,255,0.85)';
  for (const p of pts) { const q = map(p.x, p.y); ctx.beginPath(); ctx.arc(q.x, q.y, 0.8, 0, 6.2832); ctx.fill(); }
}

/* framing gate (size/center per the ARFACE app + head-pose hints) -> { ok, hint } */
export function framing(pts) {
  if (!pts) return { ok: false, hint: 'ไม่พบใบหน้า — จัดใบหน้าให้อยู่ในกรอบ' };
  let x0 = 1, x1 = 0, y0 = 1, y1 = 0;
  for (const p of pts) { if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y; }
  const h = y1 - y0, cx = (x0 + x1) / 2, cyc = (y0 + y1) / 2;
  if (h < 0.45) return { ok: false, hint: 'เข้าใกล้อีกนิด' };
  if (h > 0.85) return { ok: false, hint: 'ถอยออกเล็กน้อย' };
  if (Math.abs(cx - 0.5) > 0.18 || Math.abs(cyc - 0.5) > 0.2) return { ok: false, hint: 'จัดใบหน้าให้อยู่กลางกรอบ' };
  const roll = Math.atan2(pts[263].y - pts[33].y, pts[263].x - pts[33].x) * 57.296;
  if (Math.abs(roll) > 10) return { ok: false, hint: 'ตั้งศีรษะให้ตรง' };
  const yaw = Math.atan2((pts[454].z || 0) - (pts[234].z || 0), pts[454].x - pts[234].x) * 57.296;
  if (Math.abs(yaw) > 14) return { ok: false, hint: 'หันหน้าตรงเข้ากล้อง' };
  return { ok: true, hint: 'พร้อมสแกน — ถือนิ่ง ๆ' };
}

/* ---------- live capture-quality coach (UX guidance, measured from pixels) ----------
   Works on a SMALL downscaled frame (~160px wide) so it can run a few times a second.
   Detects: too dark/bright, backlit, uneven side lighting, and likely glasses
   (vertical-edge energy across the nose bridge + under-eye bands vs smooth cheeks,
   plus very dark eye regions for sunglasses). Heuristics — used as suggestions. */
export function captureQuality(canvas, pts) {
  const w = canvas.width, h = canvas.height;
  const d = canvas.getContext('2d').getImageData(0, 0, w, h).data;
  const L = (x, y) => { const i = ((y | 0) * w + (x | 0)) * 4; return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; };
  function stat(cx, cy, rw, rh) {
    const x0 = Math.max(0, (cx - rw) | 0), x1 = Math.min(w - 1, (cx + rw) | 0);
    const y0 = Math.max(0, (cy - rh) | 0), y1 = Math.min(h - 2, (cy + rh) | 0);
    let s = 0, n = 0, e = 0;
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      const a = L(x, y); s += a; n++;
      e += Math.abs(L(x, y + 1) - a);
    }
    return n ? { lum: s / n, edge: e / n } : { lum: 0, edge: 0 };
  }
  const bg = [[0.08, 0.08], [0.92, 0.08], [0.08, 0.5], [0.92, 0.5]]
    .reduce((a, c) => a + stat(c[0] * w, c[1] * h, w * 0.05, h * 0.05).lum, 0) / 4;
  if (!pts) {
    const c = stat(w / 2, h / 2, w * 0.18, h * 0.18).lum;
    return { faceLum: +c.toFixed(1), bgLum: +bg.toFixed(1), glassScore: 0, cheekDiff: 0,
      flags: { dark: c < 60, bright: c > 238, backlit: false, uneven: false, glasses: false } };
  }
  const P = (i) => ({ x: pts[i].x * w, y: pts[i].y * h });
  const g = Math.abs(P(263).x - P(33).x) || 1;
  const cheekL = stat(P(50).x, P(50).y, g * 0.13, g * 0.13);
  const cheekR = stat(P(280).x, P(280).y, g * 0.13, g * 0.13);
  const fore = stat(P(151).x, P(151).y, g * 0.2, g * 0.1);
  const faceLum = (cheekL.lum + cheekR.lum + fore.lum) / 3;
  const bridge = stat(P(168).x, P(168).y, g * 0.16, g * 0.07);
  const ueL = stat(P(145).x, P(145).y + g * 0.13, g * 0.22, g * 0.07);
  const ueR = stat(P(374).x, P(374).y + g * 0.13, g * 0.22, g * 0.07);
  const baseEdge = (cheekL.edge + cheekR.edge) / 2 + 0.35;
  const glassScore = ((bridge.edge + (ueL.edge + ueR.edge) / 2) / 2) / baseEdge;
  const eyeLum = (stat(P(159).x, P(159).y, g * 0.12, g * 0.08).lum + stat(P(386).x, P(386).y, g * 0.12, g * 0.08).lum) / 2;
  const cheekDiff = Math.abs(cheekL.lum - cheekR.lum);
  /* side-light comparison is only meaningful on a near-frontal face */
  const yawDeg = Math.atan2((pts[454].z || 0) - (pts[234].z || 0), pts[454].x - pts[234].x) * 57.296;
  return {
    faceLum: +faceLum.toFixed(1), bgLum: +bg.toFixed(1),
    glassScore: +glassScore.toFixed(2), cheekDiff: +cheekDiff.toFixed(1), eyeLum: +eyeLum.toFixed(1),
    flags: {
      dark: faceLum < 72,
      bright: faceLum > 235,
      backlit: bg - faceLum > 55,
      uneven: cheekDiff > 48 && Math.abs(yawDeg) < 12,
      /* calibrated on the sample face: clean ≈2.3, synthetic frames ≈4.0 — threshold
         sits in between, biased against false alarms; dark eye band = sunglasses */
      glasses: faceLum >= 72 && (glassScore > 3.1 || eyeLum < faceLum * 0.5),
    },
  };
}

/* ---------- measurement confidence (how reliable THIS capture is) ----------
   Real factors only — face frontality (roll/yaw), face size in frame, lighting evenness,
   and glasses occlusion. Returns 0-100 + per-factor pass/fail so the UI can be transparent
   about reliability. This reflects capture QUALITY, not any medical claim. */
export function measurementConfidence(srcCanvas, pts, iw, ih, m) {
  if (!pts || !pts.length) return null;
  let q = { flags: {} };
  try { q = captureQuality(srcCanvas, pts) || q; } catch {}
  const f = q.flags || {};
  const yaw = Math.abs((m && m.yawDeg) || 0), roll = Math.abs((m && m.rollDeg) || 0);
  let y0 = 1, y1 = 0;
  for (let i = 0; i < pts.length; i++) { const y = pts[i].y; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const fh = y1 - y0;                                  // face height as fraction of frame
  const cl = (v) => Math.max(0, Math.min(100, v));
  const frontality = cl(100 - yaw * 4 - roll * 4.5);
  const size = cl(100 - Math.abs(fh - 0.62) * 230);
  let lighting = 100;
  if (f.dark || f.bright) lighting -= 38;
  if (f.backlit) lighting -= 24;
  if (f.uneven) lighting -= 16;
  lighting = cl(lighting);
  const occluded = !!f.glasses;
  let score = Math.round(frontality * 0.42 + size * 0.22 + lighting * 0.36);
  if (occluded) score = Math.round(score * 0.82);
  score = Math.max(35, Math.min(99, score));
  const level = score >= 80 ? 'high' : (score >= 62 ? 'mid' : 'low');
  const factors = [
    { key: 'angle', label: 'มุมใบหน้าตรง',  ok: yaw <= 9 && roll <= 6 },
    { key: 'size',  label: 'ระยะ/ขนาดพอดี', ok: fh >= 0.5 && fh <= 0.8 },
    { key: 'light', label: 'แสงสม่ำเสมอ',   ok: !(f.dark || f.bright || f.backlit || f.uneven) },
    { key: 'clear', label: 'ไม่มีสิ่งบดบัง', ok: !occluded },
  ];
  return { score: score, level: level, factors: factors };
}

/* ---------- geometry score from 478 landmarks (per ARFACE faceGeometry) ----------
   Corrects head roll (x-y) then yaw (x-z, using landmark z) so a turned/tilted
   face is measured as if frontal before judging symmetry. */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v)));
const PAIRS = [[33,263],[133,362],[61,291],[234,454],[93,323],[58,288],[132,361],[70,300],[105,334],[145,374]];
/* roll+yaw corrected copy of the landmarks (shared by metrics + filler assessment) */
function poseCorrected(pts, aspect) {
  const A = aspect || 1;
  const P = pts.map((p) => ({ x: p.x * A, y: p.y, z: (p.z || 0) * A }));
  const cx = (P[234].x + P[454].x) / 2, cy0 = (P[234].y + P[454].y) / 2, cz = (P[234].z + P[454].z) / 2;
  const roll = Math.atan2(P[263].y - P[33].y, P[263].x - P[33].x);
  let c = Math.cos(-roll), s = Math.sin(-roll);
  for (const p of P) { const dx = p.x - cx, dy = p.y - cy0; p.x = cx + dx * c - dy * s; p.y = cy0 + dx * s + dy * c; }
  const yaw = Math.atan2(P[454].z - P[234].z, P[454].x - P[234].x);
  c = Math.cos(-yaw); s = Math.sin(-yaw);
  for (const p of P) { const dx = p.x - cx, dz = p.z - cz; p.x = cx + dx * c - dz * s; p.z = cz + dx * s + dz * c; }
  return { P, roll, yaw };
}
export function computeMetrics(pts, aspect) {
  const { P, roll, yaw } = poseCorrected(pts, aspect);
  const X = (i) => P[i].x, Y = (i) => P[i].y;
  const faceW = Math.abs(X(454) - X(234)) || 1e-6;
  const midX = (X(168) + X(1) + X(152)) / 3;
  let dev = 0;
  for (const [l, r] of PAIRS) dev += Math.abs(Math.abs(midX - X(l)) - Math.abs(X(r) - midX));
  const avgDev = (dev / PAIRS.length / faceW) * 100;
  const symmetry = clamp(100 - avgDev * 2.1, 50, 99);
  const faceH = Math.abs(Y(152) - Y(10));
  const phi = faceH / faceW;
  const goldenRaw = clamp(100 - Math.abs(phi - 1.618) * 70, 55, 99);
  const yawDeg = yaw * 57.2958;
  const w = Math.max(0, Math.min(1, 1 - (Math.abs(yawDeg) - 10) / 25));
  const golden = Math.round(goldenRaw * w + 82 * (1 - w));
  const overall = clamp(symmetry * 0.55 + golden * 0.45, 55, 99);
  const grade = overall >= 85 ? ['A', 'ดีเยี่ยม'] : overall >= 75 ? ['B+', 'ดีมาก'] : overall >= 65 ? ['B', 'ดี'] : ['C+', 'พอใช้'];
  // per-feature sub-scores (real ratios vs ideal bands) for the radar + breakdown
  const near = (v, lo, hi) => { if (v >= lo && v <= hi) return 94; const sp = (hi - lo) || 1; const dd = v < lo ? lo - v : v - hi; return Math.max(60, Math.round(94 - (dd / sp) * 55)); };
  const interEye = Math.abs(X(133) - X(362)) / faceW;   // inner-eye gap / face width
  const noseW = Math.abs(X(48) - X(278)) / faceW;        // alar width / face width
  const lipW = Math.abs(X(61) - X(291)) / faceW;         // mouth width / face width
  const parts = {
    faceShape: near(phi, 1.30, 1.52),
    eyes: near(interEye, 0.28, 0.40),
    nose: near(noseW, 0.20, 0.30),
    lips: near(lipW, 0.38, 0.52),
  };
  return { symmetry, golden, overall, grade, parts, yawDeg: Math.round(yawDeg), rollDeg: Math.round(roll * 57.3) };
}

/* ---------- skin heuristics (UX only, NOT diagnosis) ----------
   Samples real pixels at forehead/cheeks/chin patches from a source canvas.
   Maps brightness -> clarity, hue variance -> spots, neighbour delta -> wrinkles,
   tonal range -> hydration. Returns 4 metrics 0-100 (clamped to a believable band). */
const SKIN_PATCHES = { forehead: [10, 9, 151, 107, 336], leftCheek: [50, 205, 117, 123], rightCheek: [280, 425, 346, 352], chin: [152, 175, 199] };
export function analyzeSkin(srcCanvas, pts, iw, ih, mirror = false) {
  try {
    const ctx = srcCanvas.getContext('2d');
    const ax = (p) => (mirror ? 1 - p.x : p.x);
    const samples = [];
    for (const key in SKIN_PATCHES) {
      let x = 0, y = 0; const idx = SKIN_PATCHES[key];
      for (const i of idx) { x += ax(pts[i]); y += pts[i].y; }
      x = (x / idx.length) * iw; y = (y / idx.length) * ih;
      const R = Math.round(Math.min(iw, ih) * 0.04);
      const x0 = Math.max(0, Math.round(x - R)), y0 = Math.max(0, Math.round(y - R));
      const w = Math.min(R * 2, iw - x0), h = Math.min(R * 2, ih - y0);
      if (w < 4 || h < 4) continue;
      const d = ctx.getImageData(x0, y0, w, h).data;
      let sum = 0, n = 0, sat = 0, edge = 0, prev = -1, min = 255, max = 0;
      for (let p = 0; p < d.length; p += 16) { // stride for speed
        const r = d[p], g = d[p + 1], b = d[p + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        sum += lum; n++;
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        sat += mx === 0 ? 0 : (mx - mn) / mx;
        if (prev >= 0) edge += Math.abs(lum - prev);
        prev = lum;
        if (lum < min) min = lum; if (lum > max) max = lum;
      }
      if (n) samples.push({ lum: sum / n, sat: sat / n, edge: edge / n, range: max - min });
    }
    if (!samples.length) return null;
    const avg = (f) => samples.reduce((a, x) => a + f(x), 0) / samples.length;
    const cl = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v)));
    const clarity   = cl(55 + (avg((x) => x.lum) - 110) * 0.34, 60, 95);
    const spots      = cl(95 - avg((x) => x.sat) * 120, 58, 95);            // higher = fewer spots
    const wrinkles   = cl(96 - avg((x) => x.edge) * 2.6, 60, 95);           // higher = fewer wrinkles
    const hydration  = cl(92 - avg((x) => x.range) * 0.22, 60, 94);
    return { clarity, spots, wrinkles, hydration };
  } catch { return null; }
}

/* ---------- filler assessment from the REAL face (UX estimate, NOT diagnosis) ----------
   Per-area need is measured, not mocked:
   - ใต้ตา  : under-eye darkness — luminance drop vs the upper cheek (pixels)
   - ร่องแก้ม : nasolabial fold depth — edge density on the fold vs smooth cheek (pixels)
   - คาง    : lower-face proportion — chin third vs facial thirds (pose-corrected geometry)
   - ปาก    : lip fullness — vermillion height vs mouth width (pose-corrected geometry)
   - ขมับ   : temple hollowing — temple shadow vs forehead+cheek reference (pixels, lighting estimate)
   Need (5-95) -> level (high/mid/low) -> typical cc range -> budget at PRICE_PER_CC. */
export const PRICE_PER_CC = 5000;
const FILLER_PATCHES = {
  underEyeL: [230, 231, 119], underEyeR: [450, 451, 348],
  cheekL: [117, 123], cheekR: [346, 352],
  nasoL: [205, 50], nasoR: [425, 280],
  templeL: [124, 35], templeR: [353, 265],
  forehead: [151, 9, 8],
};
const CC_BANDS = {
  eye:    { low: [0.3, 0.5], mid: [0.5, 0.8], high: [0.8, 1.0] },
  naso:   { low: [0.3, 0.5], mid: [0.5, 0.8], high: [0.8, 1.0] },
  chin:   { low: [0.5, 1.0], mid: [1.0, 1.5], high: [1.5, 2.0] },
  lips:   { low: [0.3, 0.5], mid: [0.5, 0.8], high: [0.8, 1.1] },
  temple: { low: [0.5, 1.0], mid: [1.0, 2.0], high: [2.0, 3.0] },
};
const lvlOf = (need) => (need >= 65 ? 'high' : need >= 35 ? 'mid' : 'low');

/* G′ (G-prime / "จีไพรม์") = elastic modulus = how FIRM/dense a filler is. High G′ resists
   deformation (lift/structure: chin, temple); low G′ is soft and spreads (delicate/mobile
   areas: under-eye, lips). This is a per-AREA recommendation — standard aesthetic guidance for
   which filler firmness suits each region — NOT a value measured from the face. score 1(soft)..5(firm). */
export const GPRIME = {
  eye:    { score: 1, label: 'ต่ำ',       sub: 'นุ่มพิเศษ',   why: 'ผิวใต้ตาบางมาก ต้องนุ่มและกระจายเนียน เพื่อไม่เป็นก้อนหรือกักน้ำจนบวม' },
  lips:   { score: 2, label: 'ต่ำ–กลาง',  sub: 'นุ่ม ยืดหยุ่น', why: 'ริมฝีปากขยับตลอดเวลา ต้องยืดหยุ่นตามธรรมชาติและสัมผัสนุ่ม' },
  naso:   { score: 3, label: 'กลาง',      sub: 'สมดุล',      why: 'ลดร่องลึกแต่ยังกลมกลืนเนียน ไม่แข็งเป็นสัน' },
  temple: { score: 4, label: 'กลาง–สูง',  sub: 'พยุงโครง',   why: 'เติมวอลุ่มขมับที่ตอบ และพยุงโครงสร้างด้านข้างใบหน้า' },
  chin:   { score: 5, label: 'สูง',       sub: 'แข็งอยู่ตัว', why: 'ต้องการแรงยกและคงรูป เพื่อโปรเจกชันคางที่ชัดและทนทาน' },
};

export function assessFiller(srcCanvas, pts, iw, ih, mirror, aspect) {
  const ctx = srcCanvas.getContext('2d');
  const ax = (p) => (mirror ? 1 - p.x : p.x);
  const c01 = (v) => Math.max(0, Math.min(1, v));
  function patch(idx) {
    let x = 0, y = 0;
    for (const i of idx) { x += ax(pts[i]); y += pts[i].y; }
    x = (x / idx.length) * iw; y = (y / idx.length) * ih;
    const R = Math.max(4, Math.round(Math.min(iw, ih) * 0.035));
    const x0 = Math.max(0, Math.round(x - R)), y0 = Math.max(0, Math.round(y - R));
    const w = Math.min(R * 2, iw - x0), h = Math.min(R * 2, ih - y0);
    if (w < 4 || h < 4) return null;
    const d = ctx.getImageData(x0, y0, w, h).data;
    let sum = 0, n = 0, edge = 0, prev = -1;
    for (let p = 0; p < d.length; p += 16) {
      const lum = 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2];
      sum += lum; n++;
      if (prev >= 0) edge += Math.abs(lum - prev);
      prev = lum;
    }
    return n ? { lum: sum / n, edge: edge / n } : null;
  }
  const avg2 = (a, b) => (a && b) ? { lum: (a.lum + b.lum) / 2, edge: (a.edge + b.edge) / 2 } : (a || b);
  const ue = avg2(patch(FILLER_PATCHES.underEyeL), patch(FILLER_PATCHES.underEyeR));
  const ck = avg2(patch(FILLER_PATCHES.cheekL), patch(FILLER_PATCHES.cheekR));
  const ns = avg2(patch(FILLER_PATCHES.nasoL), patch(FILLER_PATCHES.nasoR));

  // ใต้ตา: relative darkness under the eyes vs the cheek (0.02 barely → 0.16 strong)
  const dark = (ue && ck && ck.lum > 1) ? c01(((ck.lum - ue.lum) / ck.lum - 0.02) / 0.14) : 0.4;
  const needEye = clamp(5 + dark * 90, 5, 95);

  // ร่องแก้ม: fold texture vs smooth cheek (ratio 1.0 smooth → 2.2 deep)
  const foldRatio = (ns && ck && ck.edge > 0.2) ? ns.edge / ck.edge : 1.3;
  const needNaso = clamp(5 + c01((foldRatio - 1.0) / 1.2) * 90, 5, 95);

  // คาง: lower-third share of face height (≥0.41 balanced → 0.31 short/receding)
  const { P } = poseCorrected(pts, aspect || iw / ih);
  const faceH = Math.abs(P[152].y - P[10].y) || 1e-6;
  const lowerRatio = Math.abs(P[152].y - P[2].y) / faceH;
  const needChin = clamp(5 + c01((0.41 - lowerRatio) / 0.10) * 90, 5, 95);

  // ปาก: vermillion height vs mouth width (0.42 full → 0.26 thin). thinner lips → more volume
  const mouthW = Math.abs(P[61].x - P[291].x) || 1e-6;
  const lipRatio = Math.abs(P[17].y - P[0].y) / mouthW;
  const needLips = clamp(5 + c01((0.42 - lipRatio) / 0.16) * 90, 5, 95);

  // ขมับ: temple darkness/recession vs a forehead+cheek reference (lighting-based estimate)
  const tm = avg2(patch(FILLER_PATCHES.templeL), patch(FILLER_PATCHES.templeR));
  const fh = patch(FILLER_PATCHES.forehead);
  const refLum = (fh && ck) ? (fh.lum + ck.lum) / 2 : ((fh || ck) || { lum: 0 }).lum;
  const tdark = (tm && refLum > 1) ? c01(((refLum - tm.lum) / refLum - 0.05) / 0.16) : 0.3;
  const needTemple = clamp(5 + tdark * 90, 5, 95);

  const mk = (id, th, need, perSide) => {
    const level = lvlOf(need);
    const cc = CC_BANDS[id][level];
    return { id, th, need, level, perSide, cc, gprime: GPRIME[id] };
  };
  const areas = [
    mk('eye', 'ใต้ตา', needEye, true),
    mk('naso', 'ร่องแก้ม', needNaso, true),
    mk('chin', 'คาง', needChin, false),
    mk('lips', 'ปาก', needLips, false),
    mk('temple', 'ขมับ', needTemple, true),
  ];
  const r1 = (v) => Math.round(v * 10) / 10;
  const totalCc = [
    r1(areas.reduce((s, a) => s + a.cc[0] * (a.perSide ? 2 : 1), 0)),
    r1(areas.reduce((s, a) => s + a.cc[1] * (a.perSide ? 2 : 1), 0)),
  ];
  return {
    areas,
    points: areas.filter((a) => a.level !== 'low').length,
    totalCc,
    pricePerCc: PRICE_PER_CC,
    budget: [totalCc[0] * PRICE_PER_CC, totalCc[1] * PRICE_PER_CC],
    measured: { darkPct: Math.round(dark * 100), foldRatio: +foldRatio.toFixed(2), lowerRatio: +lowerRatio.toFixed(3), lipRatio: +lipRatio.toFixed(3), templeDarkPct: Math.round(tdark * 100) },
  };
}

/* ---------- capture the customer's face for the result/plan pages ----------
   Returns { img(feathered alpha PNG over original card art), thumb(small JPEG),
   anchors{eye,naso,lips,chin} } in display space. Saved on-device only. */
export const HERO_AR = 240 / 216;
const ANCHOR_SIDES = {
  eye:  [[230, 231, 119], [450, 451, 348]],
  naso: [[205, 50], [425, 280]],
  lips: [[0, 13, 17], [0, 13, 17]],
  chin: [[152, 175], [152, 175]],
  temple: [[124, 35], [353, 265]],
};
export function captureFrame(src, pts, mirror, iw, ih) {
  const ax = (i) => (mirror ? 1 - pts[i].x : pts[i].x);
  const cen = (idx) => { let x = 0, y = 0; for (const i of idx) { x += ax(i); y += pts[i].y; } return { x: x / idx.length, y: y / idx.length }; };
  const anchors = {};
  for (const k in ANCHOR_SIDES) { const [a, b] = ANCHOR_SIDES[k].map(cen); anchors[k] = a.x >= b.x ? a : b; }
  let x0 = 1, x1 = 0, y0 = 1, y1 = 0;
  for (let i = 0; i < pts.length; i++) { const x = ax(i), y = pts[i].y; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const bx0 = x0 * iw, bx1 = x1 * iw, by0 = y0 * ih, by1 = y1 * ih, bh = by1 - by0;
  let cropH = bh * 1.72, cropW = cropH * HERO_AR;
  if (cropW > iw) { cropW = iw; cropH = cropW / HERO_AR; }
  if (cropH > ih) { cropH = ih; cropW = cropH * HERO_AR; }
  const cropX = Math.min(Math.max((bx0 + bx1) / 2 - cropW / 2, 0), iw - cropW);
  const cropY = Math.min(Math.max(by0 - (cropH - bh) * 0.42, 0), ih - cropH);
  const outW = 480, outH = Math.round(outW / HERO_AR);
  const cv = document.createElement('canvas'); cv.width = outW; cv.height = outH;
  const c2 = cv.getContext('2d');
  if (mirror) { c2.translate(outW, 0); c2.scale(-1, 1); }
  const srcX = mirror ? iw - cropX - cropW : cropX;
  c2.drawImage(src, srcX, cropY, cropW, cropH, 0, 0, outW, outH);
  c2.setTransform(1, 0, 0, 1, 0, 0);
  // clean rectangular thumbnail (opaque) for history / score cards — taken BEFORE the feather mask
  let thumb = null, face = null;
  try {
    const tw = 132, th = Math.round(tw / HERO_AR);
    const tc = document.createElement('canvas'); tc.width = tw; tc.height = th;
    const tx = tc.getContext('2d'); tx.fillStyle = '#EAF4FC'; tx.fillRect(0, 0, tw, th);
    tx.drawImage(cv, 0, 0, tw, th);
    thumb = tc.toDataURL('image/jpeg', 0.82);
    // full rectangular face crop (opaque, light bg) for the analysis page
    const fc = document.createElement('canvas'); fc.width = outW; fc.height = outH;
    const fx = fc.getContext('2d'); fx.fillStyle = '#EAF4FC'; fx.fillRect(0, 0, outW, outH); fx.drawImage(cv, 0, 0);
    face = fc.toDataURL('image/jpeg', 0.86);
  } catch {}
  // feathered face cutout (alpha PNG) so the result card keeps its ORIGINAL background art
  const fx0 = (bx0 - cropX) / cropW * outW, fx1 = (bx1 - cropX) / cropW * outW;
  const fy0b = (by0 - cropY) / cropH * outH, fy1 = (by1 - cropY) / cropH * outH;
  const fw = fx1 - fx0, fh = fy1 - fy0b;
  const ecx = (fx0 + fx1) / 2;
  const ecy = (fy0b + fy1) / 2 - fh * 0.10;
  c2.globalCompositeOperation = 'destination-in';
  c2.save(); c2.translate(ecx, ecy); c2.scale(fw * 0.86, fh * 0.92);
  const g = c2.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.70, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  c2.fillStyle = g; c2.fillRect(-30, -30, 60, 60);
  c2.restore(); c2.globalCompositeOperation = 'source-over';
  const an = {};
  for (const k in anchors) an[k] = {
    x: +(((anchors[k].x * iw - cropX) / cropW)).toFixed(4),
    y: +(((anchors[k].y * ih - cropY) / cropH)).toFixed(4),
  };
  /* simulation regions (both sides) in crop-normalized coords — lets the
     before/after page run instantly without re-detecting landmarks */
  const cn = (i) => ({ x: +(((ax(i) * iw - cropX) / cropW)).toFixed(4), y: +(((pts[i].y * ih - cropY) / cropH)).toFixed(4) });
  const cenN = (idx) => { let x = 0, y = 0; for (const i of idx) { const p = cn(i); x += p.x; y += p.y; } return { x: +(x / idx.length).toFixed(4), y: +(y / idx.length).toFixed(4) }; };
  const dN = (a, b) => +Math.hypot(a.x - b.x, a.y - b.y).toFixed(4);
  const ewA = dN(cn(33), cn(133)), ewB = dN(cn(263), cn(362));
  const eyeCa = cenN([230, 231, 119]), eyeCb = cenN([450, 451, 348]);
  const sim = {
    eyes: [
      { c: { x: eyeCa.x, y: +(eyeCa.y + ewA * 0.18).toFixed(4) }, rx: +(ewA * 0.85).toFixed(4), ry: +(ewA * 0.50).toFixed(4) },
      { c: { x: eyeCb.x, y: +(eyeCb.y + ewB * 0.18).toFixed(4) }, rx: +(ewB * 0.85).toFixed(4), ry: +(ewB * 0.50).toFixed(4) },
    ],
    naso: [ { a: cn(48), b: cn(61) }, { a: cn(278), b: cn(291) } ],
    chin: { c: cenN([152, 175]), r: +(dN(cn(234), cn(454)) * 0.14).toFixed(4) },
    faceW: dN(cn(234), cn(454)),
  };
  // all 478 landmarks in crop-normalized coords -> analyze page draws mirror/grid/shape with no re-detect
  const allPts = []; for (let i = 0; i < pts.length; i++) allPts.push(cn(i));
  return { img: cv.toDataURL('image/png'), thumb, face, anchors: an, sim, pts: allPts };
}

/* ---------- face-shape classification (pose-corrected geometry, on-device) ---------- */
const FACE_SHAPE_TIPS = {
  oval:    { th: 'รูปไข่',  tip: 'รูปหน้าได้สัดส่วนดี เข้าได้กับทรงผมเกือบทุกแบบ เติมฟิลเลอร์เน้นคงสมดุลเดิม' },
  round:   { th: 'หน้ากลม', tip: 'เพิ่มมิติด้วยการเสริมคาง/ขมับให้ดูเรียวขึ้น ทรงผมยาวหรือตั้งวอลุ่มด้านบนช่วยได้' },
  square:  { th: 'หน้าเหลี่ยม', tip: 'ลดความคมของกราม เน้นความนุ่มที่แก้ม/ขมับ ทรงผมดัดปลายช่วยให้ดูละมุน' },
  heart:   { th: 'หน้าหัวใจ', tip: 'คางเรียวเด่นอยู่แล้ว เสริมคางเล็กน้อยให้บาลานซ์ ทรงผมยาวระดับคางช่วยเติมส่วนล่าง' },
  diamond: { th: 'หน้าเพชร', tip: 'โหนกแก้มเด่น เน้นเติมขมับ/หน้าผากให้ลื่น ทรงผมเปิดหน้าผากช่วยให้ดูสมดุล' },
  long:    { th: 'หน้ายาว',  tip: 'ลดความยาวด้วยวอลุ่มด้านข้าง เสริมแก้มให้อิ่ม ทรงผมหน้าม้าช่วยย่นสัดส่วน' },
};
export function classifyFaceShape(pts, aspect) {
  const { P } = poseCorrected(pts, aspect);
  const X = (i) => P[i].x, Y = (i) => P[i].y;
  const w = (a, b) => Math.abs(X(a) - X(b));
  const forehead = w(54, 284);          // upper forehead width
  const cheek = w(234, 454);            // cheekbone (widest face)
  const jaw = w(58, 288);               // jaw / gonial width
  const length = Math.abs(Y(10) - Y(152)); // hairline-ish to chin
  const lwr = length / (cheek || 1e-6);    // length : width
  const jawSharp = (Y(152) - Y(172)) / (length || 1e-6); // chin protrusion vs jaw
  let shape;
  if (lwr >= 1.5) shape = 'long';
  else if (forehead > cheek * 0.97 && jaw < cheek * 0.86) shape = 'heart';
  else if (cheek > forehead * 1.03 && cheek > jaw * 1.05 && jaw < forehead) shape = 'diamond';
  else if (jaw > cheek * 0.92 && forehead > cheek * 0.9 && lwr < 1.32) shape = 'square';
  else if (lwr < 1.18) shape = 'round';
  else shape = 'oval';
  const meta = FACE_SHAPE_TIPS[shape];
  return { shape, th: meta.th, tip: meta.tip, ratios: { lengthToWidth: +lwr.toFixed(2), forehead: +forehead.toFixed(4), cheek: +cheek.toFixed(4), jaw: +jaw.toFixed(4) } };
}

/* smile score 0-1 from blendshapes (VIDEO mode) — used for "smile to capture" */
export function smileScore(res) {
  const bs = res && res.faceBlendshapes && res.faceBlendshapes[0];
  if (!bs || !bs.categories) return 0;
  let l = 0, r = 0;
  for (const c of bs.categories) { if (c.categoryName === 'mouthSmileLeft') l = c.score; else if (c.categoryName === 'mouthSmileRight') r = c.score; }
  return (l + r) / 2;
}

/* live AR filler preview — cheap per-frame "after" look tracked to landmarks:
   lift under-eye hollows, soften nasolabial shadow, lift chin. soft-light
   composite freshens midtones instead of painting white blobs. */
export function drawFillerPreview(ctx, pts, map, s = 0.85) {
  const P = (i) => map(pts[i].x, pts[i].y);
  const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const cen = (idx) => { let x = 0, y = 0; for (const i of idx) { const p = P(i); x += p.x; y += p.y; } return { x: x / idx.length, y: y / idx.length }; };
  const blob = (cx, cy, rx, ry, a) => {
    ctx.save(); ctx.translate(cx, cy); ctx.scale(rx || 1, ry || 1);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, `rgba(255,247,236,${a})`); g.addColorStop(0.6, `rgba(255,247,236,${a * 0.6})`); g.addColorStop(1, 'rgba(255,247,236,0)');
    ctx.fillStyle = g; ctx.fillRect(-1, -1, 2, 2); ctx.restore();
  };
  const ewL = d(P(33), P(133)) || 1, ewR = d(P(263), P(362)) || 1;
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  const ueL = cen([230, 231, 119]), ueR = cen([450, 451, 348]);
  blob(ueL.x, ueL.y + ewL * 0.18, ewL * 0.95, ewL * 0.6, 0.85 * s);
  blob(ueR.x, ueR.y + ewR * 0.18, ewR * 0.95, ewR * 0.6, 0.85 * s);
  const seg = (a, b) => { const L = d(a, b); for (let k = 0.2; k <= 0.85; k += 0.22) blob(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, L * 0.26, L * 0.26, 0.5 * s); };
  seg(P(48), P(61)); seg(P(278), P(291));
  const ch = cen([152, 175, 199]);
  blob(ch.x, ch.y, ewL * 0.95, ewL * 0.72, 0.5 * s);
  ctx.restore();
}

export { FaceLandmarker, FilesetResolver };
