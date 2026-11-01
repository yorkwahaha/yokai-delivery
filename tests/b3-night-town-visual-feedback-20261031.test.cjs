'use strict';
// B3 first-stage user-screen feedback. These are bounded engineering checks,
// not a browser playthrough or artistic approval.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./helpers/game-runtime.cjs');
const root = path.join(__dirname, '..');
const game = fs.readFileSync(path.join(root, 'js/game.js'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'js/ui.js'), 'utf8');
const renderer = fs.readFileSync(path.join(root, 'js/renderer.js'), 'utf8');

test('B3 night-town charge warning and hit share the rendered Boss foot, other stages unchanged', () => {
  const ai = require('../js/boss-ai.js');
  const makeBoss = () => ({x:0,y:0,hp:300,max:300,shield:false,bossIndex:1,bossTheme:'town',_attackStep:1,attackCd:0});
  const player = {x:185,y:44};
  const options = {stageId:'night-town',bossVisualFootOffsetY:44,blocked:()=>false};
  const e = makeBoss();
  ai.step(e,player,.01,options);
  assert.equal(e.hazard.kind,'charge');
  assert.equal(e.hazard.x,0);
  assert.equal(e.hazard.y,44, 'telegraph must start at feet, not sprite centre');
  assert.equal(e.hazard.footOffsetY,44);
  assert.ok(Math.abs(e.hazard.angle) < .001, 'charge must face horizontally from the foot');
  ai.step(e,player,1.01,options);
  let hits = 0;
  for(let n=0;n<20;n++) if (ai.step(e,player,.05,options).hit) hits++;
  assert.equal(hits,1,'one hit along the same visible foot-aligned corridor');
  const another = makeBoss();
  ai.step(another,player,.01,{stageId:'rain-port',bossVisualFootOffsetY:44});
  assert.equal(another.hazard.kind,'charge');
  assert.equal(another.hazard.y,0, 'do not shift other-stage collision geometry');
});


test('B3 unwanted reading text is gone, combat warning no longer says red circle', () => {
  assert.doesNotMatch(ui, /安心讀題・離開恢復/);
  assert.doesNotMatch(game, /砸地！離開紅圈/);
  assert.match(game, /地裂！快閃開！/);
});

test('B3 charge draw reads AI-shared length, not a hard-coded endpoint', () => {
 const body=renderer.slice(renderer.indexOf('function drawNightBossImage'),renderer.indexOf('function drawBossOwnHazard'));
 assert.match(body,/Number.isFinite\(h.length\)\?Math.max\(0,h.length\):620\*\.65/);
 assert.match(body,/c.translate\(h.x,h.y\);\s*c.rotate\(h.angle\|\|0\)/);
 assert.doesNotMatch(body,/h.angle\|\|0\)\+Math.PI\/4/);
});
test('B3 slam is ComfyUI WebP trial, not procedural earth canvas', () => {
 assert.match(renderer,/slam_earth_warning/);assert.match(renderer,/slam_earth_impact/);
 assert.doesNotMatch(renderer,/function drawNightSlamEarth/);
 for(const n of ['slam_earth_warning','slam_earth_impact']) {
  const b=fs.readFileSync(path.join(root,'assets/img/vfx/boss-night-town',n+'.webp'));
  assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WEBP');
 }
});
test('B3 real ComfyUI shield is non-mirrored, and full/crack rasters load', () => {
 for(const n of ['ward_bagua_full','ward_bagua_break']) {
  const b=fs.readFileSync(path.join(root,'assets/img/vfx/shield',n+'.webp'));
  assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WEBP');
  assert.ok(renderer.includes(n));
 }
 assert.match(renderer,/ctx.scale\(flipX, 1\)/);
 assert.match(renderer,/shieldClock\(\) % 2000/);assert.match(renderer,/shieldCrackUntil = shieldClock\(\) \+ 620/);
});
test('B3 delivery reading matches the visible ellipse from all four directions', () => {
  for (const [name, dx, dy, inside] of [
    ['east-inside', .96, 0, true], ['east-outside', 1.06, 0, false],
    ['west-inside', -.96, 0, true], ['west-outside', -1.06, 0, false],
    ['south-inside', 0, .96, true], ['south-outside', 0, 1.06, false],
    ['north-inside', 0, -.96, true], ['north-outside', 0, -1.06, false]
  ]) {
    const g = loadGame({ seed: 77 });
    g.start(); g.stopSpawns(); g.clearEnemies();
    assert.equal(g.prepareOrder(), true);
    const h = g.snapshot().job.to;
    const tilt = g.env.VIEWPORT?.tiltScale?.() || 1;
    g.placeAt(h.x + dx * 245, h.y + 70 + dy * 165 / tilt);
    g.update(.016);
    assert.equal(!!g.snapshot().job.reading, inside, name);
  }
});
