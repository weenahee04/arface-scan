/* ARFACE — login.html logic: toggle login/register, submit to the API, redirect to account. */
(function () {
  var API = window.ARFACE_API;
  if (API.isAuthed()) { location.replace('account.html'); return; }

  var mode = 'login';
  var segLogin = document.getElementById('seg-login');
  var segReg = document.getElementById('seg-reg');
  var fOrg = document.getElementById('f-org');
  var btn = document.getElementById('submit');
  var err = document.getElementById('err');
  var alt = document.getElementById('alt');
  var email = document.getElementById('email');
  var pass = document.getElementById('password');
  var org = document.getElementById('org');

  document.getElementById('api-note').textContent = 'เซิร์ฟเวอร์: ' + API.base;

  function setMode(m) {
    mode = m;
    var login = m === 'login';
    segLogin.classList.toggle('on', login);
    segReg.classList.toggle('on', !login);
    fOrg.style.display = login ? 'none' : '';
    btn.textContent = login ? 'เข้าสู่ระบบ' : 'สมัครคลินิก (เริ่มทดลองฟรี 14 วัน)';
    alt.innerHTML = login
      ? 'ยังไม่มีบัญชี? <a id="to-reg" href="#">สมัครคลินิกใหม่</a>'
      : 'มีบัญชีแล้ว? <a id="to-login" href="#">เข้าสู่ระบบ</a>';
    var tr = document.getElementById('to-reg'); if (tr) tr.addEventListener('click', function (e) { e.preventDefault(); setMode('register'); });
    var tl = document.getElementById('to-login'); if (tl) tl.addEventListener('click', function (e) { e.preventDefault(); setMode('login'); });
    err.classList.remove('show');
  }
  segLogin.addEventListener('click', function () { setMode('login'); });
  segReg.addEventListener('click', function () { setMode('register'); });

  function fail(msg) { err.textContent = msg; err.classList.add('show'); btn.removeAttribute('disabled'); }

  btn.addEventListener('click', function () {
    err.classList.remove('show');
    var e = (email.value || '').trim(), p = pass.value || '';
    if (!e || !p) return fail('กรอกอีเมลและรหัสผ่าน');
    if (mode === 'register' && p.length < 6) return fail('รหัสผ่านอย่างน้อย 6 ตัวอักษร');
    btn.setAttribute('disabled', 'true');
    btn.textContent = 'กำลังดำเนินการ…';
    var done = function () { location.replace('account.html'); };
    var onErr = function (ex) {
      btn.textContent = mode === 'login' ? 'เข้าสู่ระบบ' : 'สมัครคลินิก (เริ่มทดลองฟรี 14 วัน)';
      if (ex.offline) return fail('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — ตรวจว่ารัน API (node server/server.js) อยู่');
      if (ex.status === 401) return fail('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      if (ex.status === 409) return fail('อีเมลนี้ถูกใช้แล้ว');
      fail(ex.message || 'เกิดข้อผิดพลาด');
    };
    if (mode === 'login') API.login({ email: e, password: p }).then(done).catch(onErr);
    else {
      var o = (org.value || '').trim();
      if (!o) { fail('กรอกชื่อคลินิก'); return; }
      API.register({ orgName: o, email: e, password: p }).then(done).catch(onErr);
    }
  });

  setMode('login');
})();
