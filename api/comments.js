// Izohlar API — Vercel serverless funksiyasi.
// Ma'lumotlar Upstash Redis (Vercel Marketplace) da saqlanadi, REST orqali — qo'shimcha paket kerak emas.
// Kerakli muhit o'zgaruvchilari (Upstash ulanganda Vercel o'zi qo'shadi):
//   KV_REST_API_URL va KV_REST_API_TOKEN   (yoki UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN)

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
// REST bo'lmasa — oddiy Redis ulanishi (Vercel'dagi "Redis" integratsiyasi REDIS_URL beradi)
const TCP_URL = process.env.REDIS_URL || process.env.KV_URL;
let tcp = null;
async function tcpClient() {
  if (tcp) return tcp;
  const { createClient } = require('redis');
  const c = createClient({ url: TCP_URL });
  c.on('error', () => {});
  await c.connect();
  tcp = c; return c;
}
const KEY = process.env.COMMENTS_KEY || 'rs:comments';
const MAX_TEXT = 2000;

async function redis(cmd) {
  if (!(URL_ && TOKEN)) { const c = await tcpClient(); return c.sendCommand(cmd.map(String)); }
  const r = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

function clean(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, max);
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  if (typeof req.body === 'string') { try { return Promise.resolve(JSON.parse(req.body)); } catch (e) { return Promise.resolve({}); } }
  return new Promise((resolve) => {
    let d = '';
    req.on('data', (c) => { d += c; if (d.length > 1e5) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(d || '{}')); } catch (e) { resolve({}); } });
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!(URL_ && TOKEN) && !TCP_URL) {
    const seen = Object.keys(process.env).filter((k) => /REDIS|KV_|UPSTASH|DATABASE|POSTGRES/i.test(k));
    res.status(503).json({ error: 'not_configured', message: "Izohlar uchun ma'lumotlar bazasi ulanmagan", envNames: seen });
    return;
  }
  try {
    if (req.method === 'GET') {
      const flat = (await redis(['HGETALL', KEY])) || [];
      const out = [];
      for (let i = 0; i < flat.length; i += 2) { try { out.push(JSON.parse(flat[i + 1])); } catch (e) {} }
      out.sort((a, b) => a.at - b.at);
      res.status(200).json({ comments: out });
      return;
    }
    const b = await readBody(req);
    if (req.method === 'POST') {
      const text = clean(b.text, MAX_TEXT).trim();
      if (!text) { res.status(400).json({ error: 'empty' }); return; }
      const c = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        parent: clean(b.parent, 40) || null,
        author: clean(b.author, 60).trim() || 'Mehmon',
        text,
        screen: clean(b.screen, 300),
        screenLabel: clean(b.screenLabel, 200),
        where: clean(b.where, 160),
        nav: b.nav && typeof b.nav === 'object' ? JSON.parse(clean(JSON.stringify(b.nav), 1500)) : null,
        sel: clean(b.sel, 1500),
        rx: Number(b.rx) || 0, ry: Number(b.ry) || 0,
        px: Number(b.px) || 0, py: Number(b.py) || 0,
        resolved: false,
        at: Date.now(),
      };
      await redis(['HSET', KEY, c.id, JSON.stringify(c)]);
      res.status(201).json({ comment: c });
      return;
    }
    if (req.method === 'PATCH') {
      const id = clean(b.id, 40);
      const raw = await redis(['HGET', KEY, id]);
      if (!raw) { res.status(404).json({ error: 'not_found' }); return; }
      const c = JSON.parse(raw);
      if (typeof b.resolved === 'boolean') c.resolved = b.resolved;
      if (typeof b.text === 'string' && b.text.trim()) { c.text = clean(b.text, MAX_TEXT).trim(); c.edited = Date.now(); }
      await redis(['HSET', KEY, id, JSON.stringify(c)]);
      res.status(200).json({ comment: c });
      return;
    }
    if (req.method === 'DELETE') {
      const id = clean(b.id || (req.query && req.query.id), 40);
      const flat = (await redis(['HGETALL', KEY])) || [];
      const ids = [id];
      for (let i = 0; i < flat.length; i += 2) { try { const c = JSON.parse(flat[i + 1]); if (c.parent === id) ids.push(c.id); } catch (e) {} }
      await redis(['HDEL', KEY].concat(ids));
      res.status(200).json({ deleted: ids.length });
      return;
    }
    res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
    res.status(405).json({ error: 'method_not_allowed' });
  } catch (e) {
    res.status(500).json({ error: 'server_error', message: String(e && e.message || e) });
  }
};
