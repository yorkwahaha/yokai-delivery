'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
require('../tools/director-audio-freeze.cjs');
test('image-only cache revisions match shipped images without opening frozen audio', () => {
  const source = fs.readFileSync('service-worker.js', 'utf8');
  const cutoff = source.indexOf('const CACHE_NAME');
  assert.ok(cutoff > 0);
  const revisions = vm.runInNewContext(source.slice(0, cutoff) + '\nMEDIA_REVISIONS');
  const images = Object.entries(revisions).filter(([file]) => file.startsWith('assets/img/'));
  assert.ok(images.length > 100, 'image registry must not silently disappear');
  for (const [file, revision] of images) {
    const actual = createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 24);
    assert.equal(actual, revision, file + ' has stale image cache revision');
  }
});
