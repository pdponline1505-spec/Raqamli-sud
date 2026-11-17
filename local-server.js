// Raqamli sud — lokal server (qo'shimcha paket kerak emas, Node.js 18+).
// Ishga tushirish:  node local-server.js     (yoki: npm start)
// Port o'zgartirish: PORT=4000 node local-server.js
// Izohlar (comments) lokal rejimda xotirada saqlanadi — server to'xtasa o'chadi.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 3000;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.webp': 'image/webp' };

// --- Izohlar API uchun xotiradagi Redis REST o'rnini bosuvchi ---
const store = {};
const kv = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    let result = null;
    try {
      const [op, key, ...a] = JSON.parse(body || '[]');
      store[key] = store[key] || {};
      if (op === 'HGETALL') { result = []; for (const k in store[key]) result.push(k, store[key][k]); }
      else if (op === 'HSET') { for (let i = 0; i + 1 < a.length; i += 2) store[key][a[i]] = a[i + 1]; result = 1; }
      else if (op === 'HGET') result = store[key][a[0]] || null;
      else if (op === 'HDEL') { a.forEach((k) => delete store[key][k]); result = a.length; }
    } catch (e) { /* noto'g'ri so'rov */ }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ result }));
  });
});

kv.listen(0, '127.0.0.1', () => {
  if (!process.env.KV_REST_API_URL && !process.env.UPSTASH_REDIS_REST_URL && !process.env.REDIS_URL) {
    process.env.KV_REST_API_URL = 'http://127.0.0.1:' + kv.address().port;
    process.env.KV_REST_API_TOKEN = 'local';
  }
  let comments = null;
  try { comments = require(path.join(ROOT, 'api', 'comments.js')); } catch (e) { console.warn('Izohlar API yuklanmadi:', e.message); }

  const app = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://localhost');
    if (u.pathname === '/api/comments' && comments) {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try { req.body = body ? JSON.parse(body) : undefined; } catch (e) { req.body = body; }
        req.query = Object.fromEntries(u.searchParams);
        res.status = (c) => { res.statusCode = c; return res; };
        res.json = (o) => { if (!res.headersSent) res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
        res.send = (o) => res.end(typeof o === 'string' ? o : JSON.stringify(o));
        Promise.resolve(comments(req, res)).catch((e) => { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); });
      });
      return;
    }
    let p = decodeURIComponent(u.pathname);
    if (p === '/') p = '/index.html';
    let f = path.normalize(path.join(ROOT, p));
    if (!f.startsWith(ROOT)) { res.statusCode = 403; return res.end('Forbidden'); }
    if (!path.extname(f) && fs.existsSync(f + '.html')) f += '.html'; // /izohlar -> izohlar.html
    fs.readFile(f, (err, buf) => {
      if (err) { res.statusCode = 404; res.setHeader('Content-Type', 'text/plain; charset=utf-8'); return res.end('Topilmadi: ' + p); }
      res.setHeader('Content-Type', MIME[path.extname(f).toLowerCase()] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.end(buf);
    });
  });

  app.on('error', (e) => {
    if (e.code === 'EADDRINUSE') console.error(`\n${PORT}-port band. Boshqa port bilan ishga tushiring:  PORT=4000 node local-server.js\n`);
    else console.error(e);
    process.exit(1);
  });

  app.listen(PORT, () => {
    const url = `http://localhost:${PORT}`;
    console.log(`\n  Raqamli sud lokal serveri ishga tushdi:  ${url}`);
    console.log(`  Izohlar jadvali:                          ${url}/izohlar`);
    console.log(`  To'xtatish: Ctrl+C\n`);
    if (!process.env.NO_OPEN) {
      const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
      exec(cmd, () => {});
    }
  });
});
