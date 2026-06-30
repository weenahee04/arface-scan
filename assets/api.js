/* ARFACE — API client for the subscription backend.
   Talks to the ARFACE API (local dev: http://localhost:4000; set window override or
   localStorage 'arface.apiBase' to the DigitalOcean URL later). Token in localStorage.
   CSP: pages using this must allow the API origin in connect-src. */
window.ARFACE_API = (function () {
  var BASE = (localStorage.getItem('arface.apiBase') || 'http://localhost:4000').replace(/\/+$/, '');
  var TK = 'arface.token';
  function token() { return localStorage.getItem(TK) || ''; }
  function setToken(t) { if (t) localStorage.setItem(TK, t); }
  function clear() { localStorage.removeItem(TK); }

  async function req(method, path, body) {
    var headers = { 'Content-Type': 'application/json' };
    var t = token(); if (t) headers.Authorization = 'Bearer ' + t;
    var res;
    try {
      res = await fetch(BASE + path, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined });
    } catch (e) {
      throw Object.assign(new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ (' + BASE + ')'), { offline: true });
    }
    var data = null; try { data = await res.json(); } catch (e) {}
    if (!res.ok) throw Object.assign(new Error((data && (data.error || data.reason)) || ('HTTP ' + res.status)), { status: res.status, data: data });
    return data;
  }

  return {
    base: BASE,
    setBase: function (b) { BASE = b.replace(/\/+$/, ''); localStorage.setItem('arface.apiBase', BASE); },
    token: token, setToken: setToken, clear: clear,
    isAuthed: function () { return !!token(); },
    register: function (b) { return req('POST', '/auth/register-org', b).then(function (d) { setToken(d.token); return d; }); },
    login: function (b) { return req('POST', '/auth/login', b).then(function (d) { setToken(d.token); return d; }); },
    logout: function () { clear(); },
    me: function () { return req('GET', '/me'); },
    usage: function () { return req('GET', '/org/usage'); },
    plans: function () { return req('GET', '/plans'); },
    subscribe: function (code) { return req('POST', '/subscribe', { plan_code: code }); },
    addUser: function (b) { return req('POST', '/org/users', b); },
    recordScan: function () { return req('POST', '/usage/scan'); },
    // consumer LINE trial (no auth token; identified by line_user_id)
    trialStatus: function (lid) { return req('GET', '/trial/status?line_user_id=' + encodeURIComponent(lid)); },
    trialClaim: function (b) { return req('POST', '/trial/claim', b); },
    trialScan: function (lid) { return req('POST', '/trial/scan', { line_user_id: lid }); },
  };
})();
