const CACHE_NAME = 'yokai-media-v1';
const scope = self.registration.scope;
const cacheKey = (path, revision) => new URL(path + '?revision=' + revision, scope).href;
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE_NAME);
  const current = new Set(Object.entries(MEDIA_REVISIONS).map(([path, revision]) => cacheKey(path, revision)));
  for (const request of await cache.keys()) if (!current.has(request.url)) await cache.delete(request);
  await self.clients.claim();
})()));

async function serveMedia(event, path, revision) {
  const key = cacheKey(path, revision);
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(key);
  if (!cached) {
    // Safari probes audio with tiny ranges; preserve them instead of downloading the entire song.
    if (event.request.headers.has('Range')) return fetch(event.request);
    const response = await fetch(key, { cache: 'no-store' });
    if (response.status === 200) event.waitUntil(cache.put(key, response.clone()).catch(() => {}));
    return response;
  }
  const range = event.request.headers.get('Range');
  if (!range) return cached;
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match || (!match[1] && !match[2])) return fetch(event.request);
  const bytes = await cached.arrayBuffer(), size = bytes.byteLength;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] ? (match[2] ? Math.min(Number(match[2]), size - 1) : size - 1) : size - 1;
  if (start >= size || start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  const headers = new Headers(cached.headers);
  headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  headers.set('Content-Length', String(end - start + 1));
  headers.set('Accept-Ranges', 'bytes');
  return new Response(bytes.slice(start, end + 1), { status: 206, headers });
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url), base = new URL(scope);
  if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) return;
  const path = url.pathname.slice(base.pathname.length), revision = MEDIA_REVISIONS[path];
  if (revision) event.respondWith(serveMedia(event, path, revision).catch(() => fetch(event.request)));
});
