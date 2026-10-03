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
  assert.equal(images.length, 18);
  env.loadGameArt();
  assert.equal(images.length, 18);
  for (const image of images.slice(1)) image.onload();
  assert.equal(env.ART_READY, true);
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
    assert.ok(image.src.endsWith('.png'));
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
