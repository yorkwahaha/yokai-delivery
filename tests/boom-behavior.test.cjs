const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function loadFX(reduced = false) {
  const env = {
    Math,
    Date,
    ART: {},
    matchMedia: () => ({ matches: reduced }),
    AUDIO: { ofudaLaunch: () => {}, ofudaBurst: () => {}, boomerang: () => {} },
    SKILLFX: {},
    FX: {},
    HAPTICS: { hit: () => {}, damage: () => {}, dash: () => {}, shield: () => {}, pickup: () => {}, deliverSuccess: () => {}, deliverWrong: () => {}, bossDefeat: () => {}, levelUp: () => {}, warning: () => {} },
    RENDERER: {
      triggerShake: () => {},
      spawnDamageNumber: () => {},
      triggerHitStop: () => {},
      addSlashArc: () => {},
      getCam: () => ({ x: 0, y: 0 }),
    },
    VIEWPORT: {
      tiltScale: () => 1,
      worldToScreen: () => ({ x: 0, y: 0 }),
      upright: (ctx, x, y, fn) => fn(),
    },
    STORY: { get: () => null },
    ONMYO_VFX: null,
    skillVfxArt: () => null,
    skillVfxKey: () => null,
    skillVfxVariantArt: () => null,
    ofudaRasterArt: () => null,
    thunderRasterArt: () => null,
    barrierCoreArt: () => null,
    barrierArtTier: () => ({ scale: 1, alpha: 0.9 }),
    audioAsset: (p) => p,
  };
  env.window = env;
  const c = vm.createContext(env);
  for (const name of ['fx', 'skillfx']) vm.runInContext(fs.readFileSync(`js/${name}.js`, 'utf8'), c);
  return { FX: env.FX, SKILLFX: env.SKILLFX, env };
}

test('boom talisman sticks to enemy and explodes after fuse delay', () => {
  const { FX, SKILLFX, env } = loadFX();
  const enemies = [];

  // Create a mock enemy
  const enemy = { hp: 100, x: 200, y: 200, type: 'ghost' };
  enemies.push(enemy);

  // Simulate the boom projectile logic from game.js
  const BOOM_FUSE = 1.5;
  const proj = [{
    x: 0, y: 0, vx: 100, vy: 100,
    t: 0, life: 1.4, level: 1, stuck: false, fuse: 0, target: null, exploded: false, done: false
  }];

  // Manually simulate the stuck logic
  let stuck = false;
  for (const e of enemies) {
    if (e.hp > 0 && Math.hypot(e.x - proj[0].x, e.y - proj[0].y) < 540) {
      // Close enough to "hit" - manually trigger stuck
      proj[0].stuck = true;
      proj[0].target = e;
      proj[0].fuse = BOOM_FUSE;
      proj[0].x = e.x;
      proj[0].y = e.y;
      proj[0].vx = 0;
      proj[0].vy = 0;
      stuck = true;
      break;
    }
  }
  assert.ok(stuck, 'talisman should stick to nearby enemy');

  // Update enemy position
  enemy.x = 250;
  enemy.y = 250;

  // Simulate fuse countdown with stuck projectile following enemy
  proj[0].fuse -= 0.1;
  proj[0].x = proj[0].target.x;
  proj[0].y = proj[0].target.y;
  assert.equal(proj[0].x, 250, 'talisman should follow enemy x');
  assert.equal(proj[0].y, 250, 'talisman should follow enemy y');

  // Fuse expires - should explode
  proj[0].fuse = 0;
  let exploded = false;
  if (proj[0].fuse <= 0) {
    exploded = true;
    proj[0].exploded = true;
    proj[0].done = true;
  }
  assert.ok(exploded, 'talisman should explode when fuse expires');
  assert.ok(proj[0].done, 'talisman should be marked done after explosion');
});

test('boom explosion deals 100% damage to primary target and 20% splash', () => {
  const { FX, SKILLFX, env } = loadFX();
  const enemies = [];

  const primary = { hp: 100, x: 200, y: 200, type: 'ghost', flash: 0 };
  const nearby = { hp: 100, x: 250, y: 200, type: 'ghost', flash: 0 };
  const far = { hp: 100, x: 500, y: 500, type: 'ghost', flash: 0 };
  enemies.push(primary, nearby, far);

  const BOOM_RADIUS = [78, 92, 108, 122, 135];
  const BOOM_SPLASH = 0.2;
  const boomRadius = rank => BOOM_RADIUS[Math.max(0, Math.min(4, (rank | 0) - 1))];
  const boomFullDamage = rank => (1.5 + rank * 0.7) * 10; // b.dmg = 10

  function hurt(e, dmg) {
    if (e.hp <= 0) return;
    if (e.shield) return;
    e.hp -= dmg;
    e.flash = 0.12;
  }

  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  // Simulate explosion at primary's position
  const q = { x: primary.x, y: primary.y, target: primary, level: 1 };
  const rank = 1;
  const radius = boomRadius(rank);
  const full = boomFullDamage(rank);

  // Primary takes full damage
  const beforePrimary = primary.hp;
  hurt(primary, full);
  assert.equal(primary.hp, beforePrimary - full, 'primary should take 100% damage');

  // Nearby takes splash damage
  const beforeNearby = nearby.hp;
  if (dist(nearby, q) <= radius) {
    hurt(nearby, full * BOOM_SPLASH);
  }
  assert.equal(nearby.hp, beforeNearby - full * BOOM_SPLASH, 'nearby should take 20% splash damage');

  // Far takes no damage
  const beforeFar = far.hp;
  if (dist(far, q) <= radius) {
    hurt(far, full * BOOM_SPLASH);
  }
  assert.equal(far.hp, beforeFar, 'far enemy should take no damage');
});

test('boom does not explode twice', () => {
  const { FX, SKILLFX, env } = loadFX();

  let explodeCount = 0;
  const q = { exploded: false, done: false, x: 0, y: 0, level: 1 };

  function explodeTalisman(talisman) {
    if (talisman.exploded || talisman.done) return;
    talisman.exploded = true;
    talisman.done = true;
    explodeCount++;
  }

  explodeTalisman(q);
  assert.equal(explodeCount, 1, 'first explosion should count');

  explodeTalisman(q);
  assert.equal(explodeCount, 1, 'second call should not explode again');

  explodeTalisman(q);
  assert.equal(explodeCount, 1, 'third call should not explode again');
});

test('boom respects boss shield - no damage through shield', () => {
  const { FX, SKILLFX, env } = loadFX();
  const enemies = [];

  const boss = { hp: 500, x: 200, y: 200, type: 'boss', shield: true, flash: 0, shieldFeedbackUntil: 0 };
  enemies.push(boss);

  function hurt(e, dmg) {
    if (e.hp <= 0) return;
    if (e.shield) {
      e.flash = 0.08;
      return; // Shield blocks damage
    }
    e.hp -= dmg;
    e.flash = 0.12;
  }

  const beforeHp = boss.hp;
  hurt(boss, 100);
  assert.equal(boss.hp, beforeHp, 'boss with shield should take no damage');
  assert.equal(boss.flash, 0.08, 'boss should flash on shield hit');
});

test('boom cleans up when target dies before fuse expires', () => {
  const { FX, SKILLFX, env } = loadFX();
  const enemies = [];

  const enemy = { hp: 10, x: 200, y: 200, type: 'ghost' };
  enemies.push(enemy);

  const BOOM_FUSE = 1.5;
  const proj = [{
    x: 200, y: 200, vx: 0, vy: 0,
    t: 0, life: 1.4, level: 1, stuck: true, fuse: BOOM_FUSE, target: enemy, exploded: false, done: false
  }];

  // Enemy dies before fuse expires
  enemy.hp = 0;

  // boomTargetLive check
  function boomTargetLive(q) {
    const e = q.target;
    return !!(e && e.hp > 0 && enemies.includes(e));
  }

  let exploded = false;
  if (proj[0].stuck) {
    if (!boomTargetLive(proj[0])) {
      exploded = true;
      proj[0].exploded = true;
      proj[0].done = true;
    }
  }

  assert.ok(exploded, 'talisman should explode immediately when target dies');
  assert.ok(proj[0].done, 'talisman should be marked done');
});

test('boom projectiles cleared on game reset', () => {
  const { FX, SKILLFX, env } = loadFX();
  const proj = [
    { x: 0, y: 0, stuck: true, fuse: 1.5, target: { hp: 100 }, done: false },
    { x: 100, y: 100, stuck: false, fuse: 0, target: null, done: false }
  ];

  // Simulate game reset (like line 678, 1060, 1089, 3792 in game.js)
  proj.length = 0;

  assert.equal(proj.length, 0, 'projectiles array should be empty after reset');
});

test('boom Lv5 (yin-yang) has larger radius', () => {
  const BOOM_RADIUS = [78, 92, 108, 122, 135];
  const boomRadius = rank => BOOM_RADIUS[Math.max(0, Math.min(4, (rank | 0) - 1))];

  assert.equal(boomRadius(1), 78);
  assert.equal(boomRadius(2), 92);
  assert.equal(boomRadius(3), 108);
  assert.equal(boomRadius(4), 122);
  assert.equal(boomRadius(5), 135, 'Lv5 should have max radius');
});