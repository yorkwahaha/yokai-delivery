'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=(name)=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const game=read('js/game.js'),renderer=read('js/renderer.js'),assets=read('js/assets.js');

test('delivery reading draws only countdown arc, not an additional static outer ring',()=>{
  const a=game.indexOf('// 5. 送達判定圈');
  const b=game.indexOf('// 答題圓墊',a);
  assert.ok(a>=0&&b>a);
  const section=game.slice(a,b);
  assert.doesNotMatch(section,/ctx\.ellipse\(job\.to\.x,cy/);
  assert.doesNotMatch(section,/ctx\.ellipse\(job\.to\.x,cy,228/);
  assert.match(section,/const startA = -Math\.PI \/ 2 \+ Math\.PI \* 2 \* \(1 - timerFraction\)/);
  assert.equal((section.match(/ctx\.ellipse\(job\.to\.x, barrierY/g)||[]).length,3);
});
test('shield artwork is over player, alpha at most .8 and appears for 280ms each 2 seconds',()=>{
  const s=renderer.indexOf('function drawPlayer(');
  const e=renderer.indexOf('function drawUmibozuWaterBase(',s);
  assert.ok(s>=0&&e>s);
  const body=renderer.slice(s,e);
  const sprite=body.indexOf('const devSprites');
  const overlay=body.indexOf('const cracking = shieldClock()');
  assert.ok(sprite>=0&&overlay>sprite,'shield is drawn after the character sprite');
  assert.match(body,/shieldClock\(\) % 2000/);
  assert.match(body,/blinkT < 280/);
  assert.match(body,/0\.8 \* Math\.max/);
  assert.match(body,/const alpha = cracking \? 0\.9 : blinkAlpha/);
  assert.match(body,/shieldSprite\(cracking \? "crack" : "full"\)/);
  assert.doesNotMatch(body.slice(0,sprite),/shieldSprite\(cracking/);
});
test('harbor bosses only use dedicated water raster even on failure fallback',()=>{
  const defs=assets.slice(assets.indexOf('const BOSS_HAZARD_ART_DEFS'),assets.indexOf('window.BOSS_HAZARD_ART ='));
  for (const file of ['boss-water-r8/tide_v03.webp','boss-water-r8/tidalFan_v01.webp']) {
    assert.ok(defs.includes(file),file);
    assert.ok(fs.existsSync(path.join(__dirname,'../assets/img/vfx',file.replace('boss-water-r8/','boss-water-r8/'))));
  }
  const slam=defs.slice(defs.indexOf('slam: Object.freeze'),defs.indexOf('ring: Object.freeze'));
  assert.doesNotMatch(slam,/dragon_fireball|dragon_burning_ground/);
  const gameFallback=game.slice(game.indexOf('function drawBossHazard(h, owner)'),game.indexOf('let frameShakeOffset',game.indexOf('function drawBossHazard(h, owner)')));
  assert.match(gameFallback,/harborWaterBoss/);
  assert.match(gameFallback,/rgba\(30,119,179,0\.22\)/);
  assert.match(gameFallback,/rgba\(45,158,214,0\.55\)/);
});
test('after complete boss disappearance, victory sequence leaves six seconds of free movement',()=>{
  const match=game.match(/const VICTORY = \{ explode: ([\d.]+), ignite: ([\d.]+), burn: ([\d.]+), dawn: ([\d.]+), dawnFade: ([\d.]+), settle: ([\d.]+) \}/);
  assert.ok(match);
  const [,explode,ignite,burn,dawn,fade,settle]=match.map(Number);
  assert.ok(explode>=5);
  assert.equal(Math.round((settle-ignite-burn)*10)/10,6);
  assert.ok(settle>dawn+fade);
  assert.match(game,/const m = move\(\);/);
});
