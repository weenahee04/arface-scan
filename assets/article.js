/* ARFACE — article reader. Reads ?id, renders the matching article from
   window.ARFACE_ARTICLES into #art, plus a few "related" links. CSP-safe (external). */
(function () {
  var A = window.ARFACE_ARTICLES || [];
  var id = new URLSearchParams(location.search).get('id');
  var art = A.filter(function (a) { return a.id === id; })[0];
  if (!art) { location.replace('tips.html'); return; }

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function coverDiv(cls, url) { var d = el('div', cls); if (url) d.style.backgroundImage = "url('" + url + "')"; return d; }

  var root = document.getElementById('art');

  if (art.cover) root.appendChild(coverDiv('cover', art.cover));
  root.appendChild(el('span', 'cat', art.cat));
  root.appendChild(el('h1', null, art.title));

  var meta = el('div', 'meta');
  meta.appendChild(el('span', null, 'อ่าน ' + (art.read || 3) + ' นาที'));
  root.appendChild(meta);

  var body = el('div', 'body');
  (art.body || []).forEach(function (b) {
    if (b.t === 'h') body.appendChild(el('h2', null, b.x));
    else if (b.t === 'ul') {
      var ul = el('ul');
      (b.items || []).forEach(function (it) { ul.appendChild(el('li', null, it)); });
      body.appendChild(ul);
    } else body.appendChild(el('p', null, b.x));
  });
  root.appendChild(body);

  /* related — up to 3 other articles */
  var others = A.filter(function (a) { return a.id !== art.id; }).slice(0, 3);
  var rel = document.getElementById('rel');
  if (rel && others.length) {
    others.forEach(function (a) {
      var link = document.createElement('a');
      link.href = 'article.html?id=' + encodeURIComponent(a.id);
      link.appendChild(coverDiv('ic', a.cover));
      var b = el('div', 'b'); b.appendChild(el('h3', null, a.title)); b.appendChild(el('div', 'rc', a.cat + ' · อ่าน ' + (a.read || 3) + ' นาที'));
      link.appendChild(b);
      rel.appendChild(link);
    });
    document.getElementById('relwrap').style.display = '';
  }

  document.title = 'ARFACE — ' + art.title;
})();
