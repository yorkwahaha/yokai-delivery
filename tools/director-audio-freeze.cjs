'use strict';
// Process-local QA preload. It never opens a frozen path, including the audio module.
const fs = require('node:fs');
const { fileURLToPath } = require('node:url');
const { syncBuiltinESMExports } = require('node:module');
function isFrozen(input) {
  if (typeof input === 'number') return false;
  const raw = input instanceof URL ? fileURLToPath(input) : String(input);
  const name = raw.replace(/\\/g, '/');
  return /(?:^|\/)assets\/audio(?:\/|$)/i.test(name)
    || /(?:^|\/)js\/audio\.js$/i.test(name)
    || /(?:^|\/)tools\/tts[^/]*(?:\/|$)/i.test(name)
    || /\.(mp3|wav|ogg|m4a)$/i.test(name);
}
function guard(original, receiver) {
  return function(input, ...args) {
    if (isFrozen(input)) {
      const error = new Error('AUDIO_FREEZE: forbidden QA file read');
      error.code = 'AUDIO_FREEZE';
      throw error;
    }
    return original.call(receiver, input, ...args);
  };
}
for (const name of ['readFileSync', 'readFile', 'createReadStream', 'openSync', 'open', 'readdirSync', 'readdir', 'opendirSync', 'opendir']) {
  fs[name] = guard(fs[name], fs);
}
for (const name of ['readFile', 'open', 'readdir', 'opendir']) fs.promises[name] = guard(fs.promises[name], fs.promises);
syncBuiltinESMExports();
module.exports = { isFrozen };
