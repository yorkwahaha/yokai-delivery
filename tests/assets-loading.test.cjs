const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function loadAssets() {
  const images = [], tracks = [];
  class Image { constructor() { images.push(this); } }
  class Audio {
    constructor(src) { this.src = src; tracks.push(this); }
    addEventListener() {}
  }
  const env = { Image, Audio, console };
  env.window = env;
  vm.runInNewContext(fs.readFileSync('js/assets.js', 'utf8'), env);
  return { env, images, tracks };
}

test('title prioritizes only the cover and leaves music downloads until playback', () => {
  const { env, images, tracks } = loadAssets();
  assert.equal(images.length, 1);
  assert.equal(images[0].src, 'assets/img/cover.webp');
  assert.equal(images[0].fetchPriority, 'high');
  assert.ok(tracks.every(track => track.preload === 'none'));
  images[0].onload();
  assert.equal(env.ART.cover, images[0]);
  env.loadGameArt();
  assert.equal(images.length, 32);
  env.loadGameArt();
  assert.equal(images.length, 32);
  for (const image of images.slice(1)) image.onload();
  assert.equal(env.ART_READY, true);
  assert.ok(env.ART.hud_lantern_oil);
  assert.ok(env.ART.hud_radar_frame);
  assert.ok(env.ART.ground_dirt);
  assert.ok(env.ART.ground);
});

test('WebP failures retry preserved originals once and settle even when both are absent', () => {
  const { env, images } = loadAssets();
  images[0].onerror();
  assert.equal(images[0].src, 'assets/img/cover.jpg');
  images[0].onload();
  env.loadGameArt();
  for (const image of images.slice(1)) {
    image.onerror();
    assert.ok(image.src.split('?')[0].endsWith('.png'));
    image.onload();
  }
  assert.equal(env.ART_READY, true);
  const failed = loadAssets();
  failed.env.console = { warn() {} };
  failed.env.loadGameArt();
  for (const image of failed.images) { image.onerror(); image.onerror(); }
  assert.equal(failed.env.ART_READY, true);
  assert.deepEqual(Object.keys(failed.env.ART), []);
});

test('asset progress counts settled images including failures, without counting retry as completion',()=>{
  const {env,images}=loadAssets();env.console={warn(){}};
  assert.deepEqual({...env.ART_PROGRESS},{settled:0,total:1,failed:0});
  images[0].onerror();assert.equal(env.ART_PROGRESS.settled,0);
  images[0].onerror();assert.deepEqual({...env.ART_PROGRESS},{settled:1,total:1,failed:1});
  env.loadGameArt();assert.equal(env.ART_PROGRESS.total,30);
  images.slice(1).forEach(image=>image.onload());
  assert.deepEqual({...env.ART_PROGRESS},{settled:30,total:30,failed:1});assert.equal(env.ART_READY,true);
});

test('new movement, posture and landmark images ship both WebP and PNG fallback files',()=>{
  const {env,images}=loadAssets();env.loadGameArt();
  const extra=images.filter(i=>/_v[12]/.test(i.src));assert.equal(extra.length,12);
  for(const i of extra){assert.ok(fs.existsSync(i.src),i.src);i.onerror();assert.ok(fs.existsSync(i.src),i.src);i.onload();}
  assert.ok(env.ART.player_kneel_v1);assert.ok(env.ART.boss_motion_v1);assert.ok(env.ART.map_rain_port_v1);
});
