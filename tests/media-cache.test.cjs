const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const worker = fs.readFileSync('tools/media-cache-worker.js','utf8');

function cacheFixture() {
  const entries=new Map(),requests=[];let downloads=0;
  const cache={match:async key=>entries.get(key)?.clone(),put:async(key,value)=>entries.set(key,new Response(await value.arrayBuffer(),{headers:value.headers})),
    keys:async()=>[...entries.keys()].map(url=>({url})),delete:async req=>entries.delete(req.url)};
  const boot=(revision='abc')=>{
    const events={};
    const self={registration:{scope:'https://example.org/game/'},clients:{claim:async()=>{}},skipWaiting:async()=>{},addEventListener:(name,cb)=>events[name]=cb};
    vm.runInNewContext('const MEDIA_REVISIONS={"assets/img/test.webp":"'+revision+'","assets/audio/test.mp3":"music"};\n'+worker,
      {self,caches:{open:async()=>cache},URL,Headers,Response,Set,fetch:async(request)=>{downloads++;requests.push(request);return new Response('0123456789',{status:request.headers?.get('Range')?206:200,headers:{'Content-Type':'audio/mpeg'}});}});
    return {request:async(path,range)=>{
      const waits=[];let pending;
      events.fetch({request:new Request('https://example.org/game/'+path,{headers:range?{Range:range}:{}}),waitUntil:p=>waits.push(p),respondWith:p=>pending=p});
      const response=await pending;await Promise.all(waits);return response;
    },activate:async()=>{let pending;events.activate({waitUntil:p=>pending=p});await pending;}};
  };
  return {boot,downloads:()=>downloads,entries,requests};
}

test('media cache survives a deployment and changed query parameters but refreshes changed content',async()=>{
  const f=cacheFixture();await f.boot().request('assets/img/test.webp?v=first');
  await f.boot().request('assets/img/test.webp?v=second');assert.equal(f.downloads(),1);
  const next=f.boot('changed');await next.activate();
  await next.request('assets/img/test.webp');assert.equal(f.downloads(),2);
  assert.equal(f.entries.size,1);
});

test('cached MP3 supports start, suffix and invalid Range requests without downloading again',async()=>{
  const f=cacheFixture(),app=f.boot();const first=await app.request('assets/audio/test.mp3');
  assert.equal(first.status,200);
  const range=await app.request('assets/audio/test.mp3','bytes=2-5');
  assert.equal(range.status,206);assert.equal(await range.text(),'2345');assert.equal(range.headers.get('Content-Range'),'bytes 2-5/10');
  assert.equal(await (await app.request('assets/audio/test.mp3','bytes=-3')).text(),'789');
  assert.equal((await app.request('assets/audio/test.mp3','bytes=10-')).status,416);
  assert.equal(f.downloads(),1);
});

test('cold music preserves the browser Range request instead of starting a full download',async()=>{
  const f=cacheFixture(),app=f.boot(),response=await app.request('assets/audio/test.mp3','bytes=0-1');
  assert.equal(response.status,206);assert.equal(f.requests[0].headers.get('Range'),'bytes=0-1');
  assert.equal(f.entries.size,0,'partial music must not be cached as a complete file');
});

test('worker leaves HTML, scripts and unknown URLs under normal browser caching',async()=>{
  const f=cacheFixture(),app=f.boot();
  assert.equal(await app.request('index.html'),undefined);
  assert.equal(await app.request('js/game.js'),undefined);
  assert.equal(f.downloads(),0);
});

test('published worker content revisions match every local media file',()=>{
  const source=fs.readFileSync('service-worker.js','utf8');
  const revisions=vm.runInNewContext(source.slice(0,source.indexOf('const CACHE_NAME'))+'\nMEDIA_REVISIONS');
  assert.ok(Object.keys(revisions).length>100);
  for(const [path,revision] of Object.entries(revisions)) {
    assert.equal(createHash('sha256').update(fs.readFileSync(path)).digest('hex').slice(0,24),revision,path+' requires node tools/build-media-cache.cjs');
  }
  assert.ok(revisions['assets/img/ui/hud_skill_fan.webp']);
});
