'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const gameSource = fs.readFileSync('js/game.js', 'utf8');
const mathSource = fs.readFileSync('js/game-charm-math.js', 'utf8');

function extractFunction(source, name) {
  const marker = '  function ' + name + '(';
  const start = source.indexOf(marker);
  assert.ok(start >= 0, 'missing ' + name);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
    if (source[i] !== '}') continue;
  }
  throw Error('unterminated function ' + name);
}

const names = [
  'getEffectiveDmg',
  'getEffectiveMoveSpeed',
  'getEffectiveMagnetRadius',
  'getEffectiveRate',
  'getEffectiveReachMultiplier'
];

function boot(build, current, portNormal) {
  const env = {
    window: {},
    b: build,
    current,
    portNormal,
    magnetRadius: rank => 110 + Math.max(0, Math.min(3, rank)) * 80,
    isRainPortNormalMode: () => portNormal,
    charmLevelOf: (id, state) => (state?.levels || current)[id] || 0
  };
  vm.runInNewContext(mathSource, env, {filename: 'game-charm-math.js'});
  vm.runInNewContext(names.map(n => extractFunction(gameSource, n)).join('\n') +
    '\nthis.mathWrappers = {' + names.join(',') + '};', env);
  return env;
}

test('Phase 4: five numeric functions are pure, frozen and explicit about their inputs', () => {
  const env = boot({}, {}, false);
  const api = env.window.GAME_CHARM_MATH;
  assert.ok(Object.isFrozen(api));
  for (const name of [
    'effectiveDamage', 'effectiveMoveSpeed', 'effectiveMagnetRadius',
    'effectiveRate', 'effectiveReachMultiplier'
  ]) {
    assert.equal(typeof api[name], 'function', name);
    assert.match(gameSource, new RegExp('GAME_CHARM_MATH\\.' + name + '\\('));
  }
  assert.equal(typeof api.guardOilLoss, 'function', 'prior Phase 3 function retained');
  assert.doesNotMatch(mathSource, /Math\.random|document\.|localStorage/);
});

test('Phase 4: current-run values match exact old formulas across two stages and charm levels', () => {
  const cases = [
    {dmg:0, spd:0, mag:0, rate:0},
    {dmg:1, spd:1, mag:1, rate:1},
    {dmg:3.5, spd:4, mag:3, rate:.5},
    {dmg:undefined, spd:undefined, mag:undefined, rate:undefined},
    {dmg:-2, spd:-1, mag:-3, rate:-1},
    {dmg:NaN, spd:NaN, mag:NaN, rate:NaN}
  ];
  for (const b of cases) for (const port of [false, true]) {
    for (let level = 0; level <= 3; level++) {
      const levels = Object.fromEntries([
        'charm_power', 'charm_step', 'charm_gather', 'charm_cadence', 'charm_reach'
      ].map(k => [k, level]));
      const g = boot(b, levels, port).mathWrappers;
      const magnet = 110 + Math.max(0, Math.min(3, b.mag)) * 80;
      const expected = [
        (b.dmg || 1) + level * .20,
        230 + (b.spd || 0) * 35 + level * 28,
        magnet + (port ? 70 : 0) + level * 75,
        (b.rate || 0) + level * .25,
        level > 0 ? 1 + .10 * level : 1
      ];
      const actual = names.map(n => g[n]());
      for (let i = 0; i < names.length; i++) {
        assert.ok(Object.is(actual[i], expected[i]),
          JSON.stringify({function: names[i], b, port, level, actual: actual[i], expected: expected[i]}));
      }
    }
  }
});

test('Phase 4: explicit buildState retains its own charm levels and original base attributes', () => {
  const base = {dmg:2, spd:5, mag:2, rate:1};
  const current = Object.fromEntries([
    'charm_power', 'charm_step', 'charm_gather', 'charm_cadence', 'charm_reach'
  ].map(k => [k, 3]));
  const levels = Object.fromEntries(Object.keys(current).map(k => [k, 1]));
  const g = boot(base, current, true).mathWrappers;
  const state = {levels};
  assert.equal(g.getEffectiveDmg(state), 2.2);
  assert.equal(g.getEffectiveMoveSpeed(state), 230 + 5 * 35 + 28);
  assert.equal(g.getEffectiveMagnetRadius(state), 110 + 2 * 80 + 70 + 75);
  assert.equal(g.getEffectiveRate(state), 1.25);
  assert.equal(g.getEffectiveReachMultiplier(state), 1.1);
  assert.equal(g.getEffectiveReachMultiplier(), 1.3);
});

test('Phase 4: HTML loads updated charm math before game, without touching other script versions', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const math = 'js/game-charm-math.js?v=20261103-charm-phase5';
  const game = 'js/game.js?v=20261103-input-phase15';
  assert.ok(html.includes(math));
  assert.ok(html.includes(game));
  assert.ok(html.indexOf(math) < html.indexOf(game));
  assert.ok(html.includes('js/game-geometry.js?v=20261103-input-phase15'));
  assert.ok(html.includes('js/audio.js?v=20261102-audio-pad-hotfix'));
});
