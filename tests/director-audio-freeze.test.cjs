'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
require('../tools/director-audio-freeze.cjs');
test('frozen audio, audio module and TTS paths are rejected BEFORE filesystem access', () => {
  const paths = ['assets/audio/never-open.mp3', 'js/audio.js', 'tools/tts-private-never-open.cjs', 'ASSETS\\AUDIO\\not-real.bin'];
  for (const file of paths) {
    const p = path.resolve(file);
    for (const method of ['readFileSync', 'readFile', 'createReadStream', 'openSync', 'open', 'readdirSync', 'opendirSync']) {
      assert.throws(() => fs[method](p), { code: 'AUDIO_FREEZE' }, method);
    }
    for (const method of ['readFile', 'open', 'readdir', 'opendir']) {
      assert.throws(() => fs.promises[method](p), { code: 'AUDIO_FREEZE' }, method);
    }
    assert.throws(() => fs.readFileSync(pathToFileURL(p)), { code: 'AUDIO_FREEZE' });
    assert.throws(() => fs.readFileSync(Buffer.from(p)), { code: 'AUDIO_FREEZE' });
  }
});
test('normal source inspection remains available without audio reads', async () => {
  const p = path.resolve('js/p42-camera-model.js');
  const content = fs.readFileSync(p, 'utf8');
  assert.match(content, /function worldMatrix/);
  assert.equal(await fs.promises.readFile(p, 'utf8'), content);
});
