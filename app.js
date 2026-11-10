const $ = (s) => document.querySelector(s), app = $('#app');
const LS = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
             set: (k, v) => localStorage.setItem(k, JSON.stringify(v)) };
const esc = (s = '') => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let key = LS.get('key', '');
const qs = (p, o = {}) => '/api/' + p + '?' + new URLSearchParams({ ...o, k: key });

async function api(p, o) {
  const r = await fetch(qs(p, o));
  if (r.status === 401) {
    const k = prompt('Access key'); if (k === null) throw new Error('Access key needed');
    key = k; LS.set('key', k); return api(p, o);
  }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Server error ' + r.status);
  return d;
}
const card = (v) => `<a class="card" href="#/watch/${v.id}"><img loading="lazy" alt="" src="https://i.ytimg.com/vi/${v.id}/mqdefault.jpg"><div><b>${esc(v.title)}</b><span>${esc([v.author, v.views, v.duration].filter(Boolean).join(' · '))}</span></div></a>`;
const list = (a) => (a.length ? a.map(card).join('') : '<p class="note">Nothing found.</p>');
const fail = (e) => (app.innerHTML = `<p class="err">${esc(e.message)}</p>`);
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

async function home() {
  const rs = Object.entries(LS.get('resume', {})).sort((a, b) => b[1].at - a[1].at).slice(0, 6);
  app.innerHTML = (rs.length ? '<h3>Continue watching</h3>' + rs.map(([id, r]) =>
    card({ id, title: r.title, author: r.author, duration: 'at ' + fmt(r.t) })).join('') : '') +
    '<h3>Popular</h3><p class="note">Loading…</p>';
  try { const v = await api('home'); app.lastElementChild.outerHTML = list(v); } catch (e) { app.lastElementChild.outerHTML = `<p class="err">${esc(e.message)}</p>`; }
}
async function search(q) {
  app.innerHTML = '<p class="note">Searching…</p>';
  try { app.innerHTML = list(await api('search', { q })); } catch (e) { fail(e); }
}
async function watch(id) {
  app.innerHTML = '<p class="note">Loading…</p>';
  let d; try { d = await api('video', { id }); } catch (e) { return fail(e); }
  const pref = LS.get('q', 'low');
  const def = pref === 'low' ? d.formats[0] : d.formats[d.formats.length - 1];
  app.innerHTML = `<div class="pw"><video id="v" controls playsinline preload="auto"></video></div>
    <div class="bar"><select id="ql">${d.formats.map((f) => `<option value="${f.itag}"${f === def ? ' selected' : ''}>${f.label}</option>`).join('')}</select>
    <button id="pip">Window</button><button id="fs">Full screen</button></div>
    <h2>${esc(d.title)}</h2><h3>${esc(d.author)}</h3><h3>Recommended</h3>${list(d.related || [])}`;
  const v = $('#v'), src = (itag) => qs('stream', { id, itag });
  const resume = LS.get('resume', {})[id]; let last = 0;
  v.src = src(def.itag);
  v.addEventListener('loadedmetadata', () => { if (resume && resume.t > 5 && resume.t < v.duration - 10) v.currentTime = resume.t; }, { once: true });
  v.play().catch(() => {});
  v.ontimeupdate = () => {
    if (Date.now() - last < 5000) return; last = Date.now();
    const r = LS.get('resume', {}); r[id] = { t: v.currentTime, at: last, title: d.title, author: d.author }; LS.set('resume', r);
  };
  v.onended = () => { const r = LS.get('resume', {}); delete r[id]; LS.set('resume', r); };
  $('#ql').onchange = (e) => {
    const t = v.currentTime; const f = d.formats.find((x) => String(x.itag) === e.target.value);
    LS.set('q', f === d.formats[0] ? 'low' : 'high'); v.src = src(f.itag);
    v.addEventListener('loadedmetadata', () => { v.currentTime = t; v.play().catch(() => {}); }, { once: true });
  };
  $('#pip').onclick = () => (v.webkitSetPresentationMode ? v.webkitSetPresentationMode('picture-in-picture') : v.requestPictureInPicture?.());
  $('#fs').onclick = () => v.webkitEnterFullscreen?.();
  let y0 = 0;                                              // swipe up = full screen, swipe down = exit
  v.addEventListener('touchstart', (e) => (y0 = e.touches[0].clientY), { passive: true });
  v.addEventListener('touchend', (e) => {
    const dy = e.changedTouches[0].clientY - y0;
    if (dy < -70) v.webkitEnterFullscreen?.(); else if (dy > 70) v.webkitExitFullscreen?.();
  }, { passive: true });
}

function route() {
  $('#sug').innerHTML = '';
  const [, p, a] = location.hash.split('/');
  if (p === 'watch') watch(a); else if (p === 'search') search(decodeURIComponent(a || '')); else home();
}
addEventListener('hashchange', route);
$('#sf').onsubmit = (e) => { e.preventDefault(); const q = $('#q').value.trim(); if (q) { $('#q').blur(); location.hash = '#/search/' + encodeURIComponent(q); } };
let tm; $('#q').oninput = () => {
  clearTimeout(tm); const q = $('#q').value.trim(); if (!q) return ($('#sug').innerHTML = '');
  tm = setTimeout(async () => {
    try { const s = (await api('suggest', { q })).slice(0, 6);
      $('#sug').innerHTML = s.map((x) => `<button type="button">${esc(x)}</button>`).join('');
      $('#sug').onclick = (e) => { if (e.target.tagName === 'BUTTON') { $('#q').value = e.target.textContent; $('#sf').requestSubmit(); } };
    } catch {}
  }, 200);
};
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
route();
