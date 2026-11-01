// BOSS-RING-VALIDATION-R3 Node-only assertions
// Verifies the ring bridge capture logic structure in game.js.
// Runtime behavior verification requires Chrome (see scratch/boss-ring-sweep-bridge-r3/).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const gameSrc = fs.readFileSync('js/game.js', 'utf8');

test('ring bridge capture logic exists in game.js', () => {
  // Capture before AI step
  assert.ok(gameSrc.includes('let ringActiveR = null;'), 'ringActiveR declaration missing');
  assert.ok(gameSrc.includes('h.kind === "ring" && h.phase === "active" && dt > 0 && !(surgeWarningT > 0) && !e.shield'), 'capture condition missing');
  assert.ok(gameSrc.includes('ringActiveR = h.r;'), 'capture assignment missing');
  assert.ok(gameSrc.includes('h.prevR = ringActiveR;'), 'capture write before AI missing');

  // Post-rewrite after AI step
  assert.ok(gameSrc.includes('ringActiveR !== null && e.hazard === h && h.kind === "ring" && (h.phase === "active" || h.phase === "recovery")'), 'post-rewrite condition missing');
  assert.ok(gameSrc.includes('h.prevR = ringActiveR;'), 'post-rewrite assignment missing');
});

test('bridge guard includes surgeWarningT and shield', () => {
  const captureGuard = /!\(surgeWarningT > 0\) && !e\.shield/;
  assert.ok(captureGuard.test(gameSrc), 'surgeWarningT/shield guard not found in capture condition');
});

test('bridge condition for active/recovery phase', () => {
  const phaseCheck = /h\.phase === "active" \|\| h\.phase === "recovery"/;
  assert.ok(phaseCheck.test(gameSrc), 'active/recovery phase check missing');
});

test('bridge code location in boss hazard handler', () => {
  // Find the boss handler block and verify ring bridge is inside it
  const bossHandler = gameSrc.match(/if \(e\.type === "boss" && window\.BOSS_AI\?\.step\)[\s\S]{0,1200}/);
  assert.ok(bossHandler, 'boss handler block not found');
  assert.ok(bossHandler[0].includes('ringActiveR'), 'ringActiveR not in boss handler');
  assert.ok(bossHandler[0].includes('h.prevR = ringActiveR'), 'prevR write not in boss handler');
});

test('bridge post-rewrite uses ringActiveR variable', () => {
  // Verify the post-rewrite uses the same ringActiveR captured before AI
  const ringActiveRPattern = /let ringActiveR = null;[\s\S]{0,500}if \(ringActiveR !== null[\s\S]{0,500}h\.prevR = ringActiveR/;
  assert.ok(ringActiveRPattern.test(gameSrc), 'ringActiveR not used in post-rewrite');
});

test('bridge includes phase check for active or recovery', () => {
  const phasePattern = /h\.phase === "active" \|\| h\.phase === "recovery"/;
  assert.ok(phasePattern.test(gameSrc), 'active/recovery phase check missing');
});

test('bridge includes dt > 0 guard', () => {
  assert.ok(gameSrc.includes('dt > 0'), 'dt > 0 guard missing');
});

test('bridge includes hazard kind check', () => {
  assert.ok(gameSrc.includes('h.kind === "ring"'), 'hazard kind check missing');
});

test('bridge includes phase === "active" check', () => {
  assert.ok(gameSrc.includes('h.phase === "active"'), 'active phase check missing');
});
