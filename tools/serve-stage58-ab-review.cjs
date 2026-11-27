'use strict';
// Independent local A/B review server for Stage 5-8 SFX remake (does not modify tools/serve-tilt.cjs).
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = fs.realpathSync(path.resolve(__dirname, '..'));
const PORT = Number(process.env.YOKAI_AB_PORT || 8010);
const HOST = process.env.YOKAI_AB_HOST || '127.0.0.1';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.flac': 'audio/flac',
};

function sendFile(req, res, file, size) {
  const ct = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const headers = { 'content-type': ct, 'cache-control': 'no-store', 'content-length': size, 'x-content-type-options': 'nosniff' };
  const isAudio = ct.startsWith('audio/');
  if (isAudio) headers['accept-ranges'] = 'bytes';
  const range = isAudio && req.method === 'GET' && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  let status = 200, opts;
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(size - 1, Number(range[2])) : size - 1;
    if (start > end) return res.writeHead(416, { ...headers, 'content-range': `bytes */${size}`, 'content-length': 0 }).end();
    headers['content-range'] = `bytes ${start}-${end}/${size}`;
    headers['content-length'] = end - start + 1;
    status = 206;
    opts = { start, end };
  }
  res.writeHead(status, headers);
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file, opts).on('error', () => res.destroy()).pipe(res);
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return res.writeHead(405).end('Method not allowed');
  const url = new URL(req.url, 'http://localhost');
  let name = decodeURIComponent(url.pathname);
  if (name === '/' || name === '/stage58-sfx-ab-review' || name === '/stage58-sfx-ab-review/') {
    name = '/docs/stage58-sfx-ab-review/index.html';
  }
  if (name === '/ab-data.json') {
    const codexA = JSON.parse(fs.readFileSync(path.join(ROOT, 'art/audio/stage58/gemini-remake/codex-a-backup.json'), 'utf8'));
    const geminiB = JSON.parse(fs.readFileSync(path.join(ROOT, 'art/audio/stage58/gemini-remake/gemini-b-manifest.json'), 'utf8'));
    const gdcCPath = path.join(ROOT, 'art/audio/stage58/gemini-remake/gdc-c-manifest.json');
    const gdcC = fs.existsSync(gdcCPath) ? JSON.parse(fs.readFileSync(gdcCPath, 'utf8')) : {};
    const body = JSON.stringify({ codexA, geminiB, gdcC });
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'content-length': Buffer.byteLength(body) });
    return res.end(req.method === 'HEAD' ? undefined : body);
  }
  const allowed = (
    name === '/docs/stage58-sfx-ab-review/index.html' ||
    name === '/js/stage58-audio.js' ||
    /^\/art\/audio\/stage58\/gemini-remake\/(?:codex-a|gemini-b|gdc-c)\/[a-z0-9/_-]+\.mp3$/.test(name)
  );
  if (!allowed || name.includes('..')) return res.writeHead(403).end('Forbidden');
  const file = path.resolve(ROOT, '.' + name);
  if (!file.startsWith(ROOT + path.sep)) return res.writeHead(403).end('Forbidden');
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) return res.writeHead(404).end('Not found');
    sendFile(req, res, file, stat.size);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`STAGE58_AB_REVIEW_READY http://${HOST}:${PORT}/stage58-sfx-ab-review/`);
});
