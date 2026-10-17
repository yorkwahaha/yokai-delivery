// QA preload：阻止回歸測試讀取凍結音檔；不修改 production／音訊或全域設定。
const fs = require('node:fs');
const path = require('node:path');
function frozen(input) {
  if (typeof input === 'number') return false;
  const name = String(input).replace(/\\/g, '/');
  return /(?:^|\/)assets\/audio(?:\/|$)/i.test(name) || /\.(mp3|wav|ogg|m4a)$/i.test(name);
}
for (const method of ['readFileSync', 'readFile', 'createReadStream']) {
  const original = fs[method];
  fs[method] = function(input, ...args) {
    if (frozen(input)) throw new Error('AUDIO_FREEZE: test attempted to read ' + path.basename(String(input)));
    return original.call(this, input, ...args);
  };
}
