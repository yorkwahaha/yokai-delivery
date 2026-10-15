const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('R3: game.js has gamepause dispatchEvent at togglePause', () => {
  const src = fs.readFileSync('js/game.js', 'utf8');
  assert.match(src, /togglePause[\s\S]*?gamepause/);
  assert.match(src, /window\.dispatchEvent[\s\S]*?gamepause/);
});

test('R3: game.js has gamepause dispatchEvent at loseRun', () => {
  const src = fs.readFileSync('js/game.js', 'utf8');
  assert.match(src, /loseRun[\s\S]*?gamepause/);
  assert.match(src, /window\.dispatchEvent[\s\S]*?gamepause/);
});

test('R3: game.js has gamepause dispatchEvent at startVictorySequence', () => {
  const src = fs.readFileSync('js/game.js', 'utf8');
  assert.match(src, /startVictorySequence[\s\S]*?gamepause/);
  assert.match(src, /window\.dispatchEvent[\s\S]*?gamepause/);
});

test('R3: game.js has gamepause dispatchEvent at returnHome', () => {
  const src = fs.readFileSync('js/game.js', 'utf8');
  assert.match(src, /returnHome[\s\S]*?gamepause/);
  assert.match(src, /window\.dispatchEvent[\s\S]*?gamepause/);
});

test('R3: haptics.js has gamepause listener', () => {
  const src = fs.readFileSync('js/haptics.js', 'utf8');
  assert.ok(src.includes('gamepause'), 'haptics.js should listen for gamepause event');
  assert.ok(src.includes('listen(typeof window'), 'haptics.js should attach listener to window');
});