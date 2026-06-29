/* ============================================================
   ARFACE — on-device data layer (localStorage)
   Everything stays in the browser. No uploads, no backend.
   Every read/write is wrapped: quota / private-mode failures
   degrade gracefully (callers fall back to design mock values).
   ============================================================ */

const KEY = {
  lastScan: 'arface.lastScan',
  scans:    'arface.scans',
  draft:    'arface.draft',
  profile:  'arface.profile',
  read:     'arface.read',
  booking:  'arface.booking',
  consent:  'arface.consent',
};

function read(k, fallback) {
  try { const v = localStorage.getItem(k); return v == null ? fallback : JSON.parse(v); }
  catch { return fallback; }
}
function write(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); return true; }
  catch { return false; }
}
function remove(k) { try { localStorage.removeItem(k); } catch {} }

export const store = {
  KEY,

  /* ---------- scans ---------- */
  // scan = { img(PNG dataURL), thumb(small JPEG dataURL), anchors, metrics:{overall,symmetry,golden,grade}, skin?, ts }
  getLastScan() { return read(KEY.lastScan, null); },
  saveScan(scan) {
    write(KEY.lastScan, scan);
    // history: lightweight records (small thumb only, no full PNG), newest first, cap 12 to stay under quota
    const m = scan.metrics || {};
    const rec = {
      id: 's' + (scan.ts || 0), ts: scan.ts || 0,
      overall: m.overall ?? null, symmetry: m.symmetry ?? null,
      golden: m.golden ?? null, grade: m.grade || null,
      anchors: scan.anchors || null, thumb: scan.thumb || null, skin: scan.skin || null,
    };
    const list = read(KEY.scans, []);
    list.unshift(rec);
    write(KEY.scans, list.slice(0, 12));
    return rec;
  },
  getScans() { return read(KEY.scans, []); },
  getScan(id) { return this.getScans().find((s) => s.id === id) || null; },

  /* ---------- filler plan draft ---------- */
  getDraft() { return read(KEY.draft, { areas: [] }); },
  setDraftArea(areaId, intensity) {
    const d = this.getDraft();
    const i = d.areas.findIndex((a) => a.areaId === areaId);
    if (i >= 0) d.areas[i].intensity = intensity; else d.areas.push({ areaId, intensity });
    write(KEY.draft, d); return d;
  },
  removeDraftArea(areaId) {
    const d = this.getDraft();
    d.areas = d.areas.filter((a) => a.areaId !== areaId);
    write(KEY.draft, d); return d;
  },
  clearDraft() { write(KEY.draft, { areas: [] }); },

  /* ---------- profile ---------- */
  getProfile() { return read(KEY.profile, { name: '', avatar: null, goals: [], skinType: '' }); },
  setProfile(p) { write(KEY.profile, { ...this.getProfile(), ...p }); },

  /* ---------- read state (articles + notifications) ---------- */
  getRead() { return read(KEY.read, { articleIds: [], notifIds: [] }); },
  isRead(kind, id) { const r = this.getRead(); return (r[kind] || []).includes(id); },
  markRead(kind, id) {
    const r = this.getRead();
    const arr = r[kind] || (r[kind] = []);
    if (!arr.includes(id)) arr.push(id);
    write(KEY.read, r);
  },

  /* ---------- bookings (demo — no real backend) ---------- */
  getBookings() { return read(KEY.booking, []); },
  addBooking(b) {
    const list = read(KEY.booking, []);
    const rec = { id: 'b' + (b.ts || 0), status: 'pending', ...b };
    list.unshift(rec); write(KEY.booking, list); return rec;
  },

  /* ---------- camera consent ---------- */
  hasConsent() { return read(KEY.consent, false) === true; },
  setConsent() { write(KEY.consent, true); },

  /* ---------- danger zone ---------- */
  clearAll() { for (const k of Object.values(KEY)) remove(k); },
};
