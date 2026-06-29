/* ARFACE — renders the article feed on tips.html from window.ARFACE_ARTICLES.
   External (CSP-safe). Each card links to article.html?id=<id>. Covers are self-hosted images. */
(function () {
  var A = window.ARFACE_ARTICLES || [];
  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }
  var href = function (a) { return 'article.html?id=' + encodeURIComponent(a.id); };

  var feat = document.getElementById('feat');
  if (feat && A[0]) {
    var a0 = A[0];
    var bg = "linear-gradient(120deg, rgba(20,108,180,.84), rgba(45,159,238,.5)), url('" + a0.cover + "')";
    feat.innerHTML =
      '<a class="feat-card" style="background-image:' + bg + '" href="' + href(a0) + '">'
      + '<span class="k"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round"><path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3Z"/></svg> บทความแนะนำ</span>'
      + '<h2>' + esc(a0.title) + '</h2>'
      + '<p>' + esc(a0.excerpt) + '</p>'
      + '<span class="more">อ่านบทความ ›</span></a>';
  }

  var feed = document.getElementById('feed');
  if (feed) {
    feed.innerHTML = A.slice(1).map(function (a) {
      return '<a class="tip" href="' + href(a) + '">'
        + '<div class="thumb" style="background-image:url(\'' + a.cover + '\')"></div>'
        + '<div class="b"><span class="tag">' + esc(a.cat) + '</span><h3>' + esc(a.title) + '</h3>'
        + '<p>' + esc(a.excerpt) + '</p>'
        + '<span class="rd">อ่าน ' + (a.read || 3) + ' นาที</span></div></a>';
    }).join('');
  }
})();
