import express from 'express';
import { Innertube } from 'youtubei.js';
import { Readable } from 'node:stream';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KEY = process.env.ACCESS_KEY || '';          // optional: protects your server
const PORT = process.env.PORT || 3000;
const UA = 'com.google.ios.youtube/19.45.4 (iPhone16,2; U; CPU iOS 18_1 like Mac OS X)';
const web = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.static(web));
app.use('/icons', express.static(web));

let ytp; const yt = () => (ytp ??= Innertube.create({ retrieve_player: true }));
const txt = (x) => (typeof x === 'string' ? x : x?.text ?? '');

function item(n) {
  const id = n.id ?? n.video_id ?? n.content_id;
  if (!/^[\w-]{11}$/.test(id || '')) return null;           // skips channels/playlists
  return {
    id,
    title: txt(n.title) || txt(n.metadata?.title),
    author: n.author?.name ?? '',
    views: txt(n.short_view_count) || txt(n.view_count),
    duration: n.duration?.text ?? '',
  };
}
const items = (list = []) => list.map(item).filter((v) => v && v.title);

const cache = new Map();                                   // Safari sends many range requests
async function getInfo(id) {
  const hit = cache.get(id);
  if (hit && Date.now() - hit.t < 20 * 60e3) return hit.info;
  const y = await yt(); let err;
  for (const c of ['IOS', 'ANDROID', 'TV', 'WEB'])
    for (const arg of [{ client: c }, c]) {
      try {
        const info = await y.getInfo(id, arg);
        if (info.streaming_data?.formats?.length) { cache.set(id, { info, t: Date.now() }); return info; }
      } catch (e) { err = e; }
    }
  throw err || new Error('No playable formats (YouTube may be blocking this server)');
}

app.use('/api', (req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use('/api', (req, res, next) =>
  KEY && req.query.k !== KEY ? res.status(401).json({ error: 'bad key' }) : next());

const wrap = (fn) => async (req, res) => {
  try { res.json(await fn(req.query)); } catch (e) { res.status(502).json({ error: String(e.message || e) }); }
};
app.get('/api/health', wrap(async () => ({ ok: true })));
app.get('/api/search', wrap(async ({ q }) => items((await (await yt()).search(q)).results)));
app.get('/api/suggest', wrap(async ({ q }) => (await yt()).getSearchSuggestions(q)));
app.get('/api/home', wrap(async () => {
  const y = await yt();
  try { const f = await y.getHomeFeed(); const l = items(f.videos); if (l.length) return l; } catch {}
  return items((await y.search('trending today')).results);
}));
app.get('/api/video', wrap(async ({ id }) => {
  const info = await getInfo(id);
  const formats = info.streaming_data.formats
    .filter((f) => (f.mime_type || '').startsWith('video/mp4'))
    .map((f) => ({ itag: f.itag, label: f.quality_label || `${f.height}p`, h: f.height || 0 }))
    .sort((a, b) => a.h - b.h);
  return { id, title: info.basic_info?.title, author: info.basic_info?.author,
           formats, related: items(info.watch_next_feed) };
}));

app.get('/api/stream', async (req, res) => {
  try {
    const { id, itag } = req.query;
    const info = await getInfo(id);
    const list = info.streaming_data.formats;
    const f = list.find((x) => String(x.itag) === String(itag)) ?? list[0];
    const url = (await f.decipher?.((await yt()).session.player)) ?? f.url;
    const up = await fetch(url, { headers: { Range: req.headers.range || 'bytes=0-', 'User-Agent': UA } });
    res.status(up.status);
    for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
      const v = up.headers.get(h); if (v) res.set(h, v);
    }
    Readable.fromWeb(up.body).pipe(res);
    req.on('close', () => up.body.cancel().catch(() => {}));
  } catch (e) { if (!res.headersSent) res.status(502).json({ error: String(e.message || e) }); }
});

app.listen(PORT, () => console.log(`MyTube on http://localhost:${PORT}`));
