'use strict';
// Local review only: production source unchanged; frozen audio is never opened.
require('./director-audio-freeze.cjs');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '..');
const port = Number(process.argv.find(a => a.startsWith('--port='))?.slice(7) || 9400);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Invalid local preview port');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const silent = 'window.AUDIO=new Proxy({}, {get:(_,k)=>k==="isMuted"?()=>true:()=>Promise.resolve()}); if(window.speechSynthesis) window.speechSynthesis.speak=()=>{};';
http.createServer((req, res) => {
  let url;
  try { url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400).end(); return; }
  res.setHeader('Cache-Control', 'no-store');
  if (url === '/js/audio.js') { res.writeHead(200, { 'Content-Type': types['.js'] }).end(silent); return; }
  if (/^\/assets\/audio(?:\/|$)/i.test(url) || /\.(mp3|wav|ogg|m4a)$/i.test(url)) { res.writeHead(204).end(); return; }
  // Do not install the production media cache in this temporary, silent review origin.
  if (url === '/service-worker.js') { res.writeHead(200, { 'Content-Type': types['.js'] }).end('self.addEventListener("install",()=>self.skipWaiting());'); return; }
  if (url === '/') url = '/index.html';
  const allowed = ['/index.html', '/style.css', '/styles.css', '/manifest.json'].includes(url)
    || /^\/(?:js\/[^/]+\.js|assets\/(?:img|fonts)\/)/.test(url)
    || /^\/art\/fusion\/candidates\/fusion_[a-z0-9_]+\/[^/]+\.(?:png|webp)$/.test(url)
    || /^\/art\/stage2-rain-port\/(?:production-s2|production-s2-nano-20261020|scene)\//.test(url);
  const file = path.resolve(root, '.' + url), ext = path.extname(file).toLowerCase();
  if (!allowed || !types[ext] || !file.startsWith(root + path.sep)) { res.writeHead(404).end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(err.code === 'ENOENT' ? 404 : 500).end(); return; }
    res.writeHead(200, { 'Content-Type': types[ext] }).end(data);
  });
}).listen(port, '127.0.0.1', () => console.log(`SILENT_REVIEW http://127.0.0.1:${port}/index.html — no deploy, no audio reads`));
