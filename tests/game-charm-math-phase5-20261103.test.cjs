'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const game = fs.readFileSync('js/game.js', 'utf8');
const moduleSource = fs.readFileSync('js/game-charm-math.js', 'utf8');

function previousCharmLevelOf(id, buildState, buildCharms, charmLevels, maxLevel) {
  const charms = (buildState && Array.isArray(buildState.charms)) ? buildState.charms : buildCharms;
  if (!charms.includes(id)) return 0;
  const table = (buildState && buildState.charmLevels && typeof buildState.charmLevels === 'object')
    ? buildState.charmLevels
    : (buildState ? null : charmLevels);
  if (!table) return 1;
  const raw = table[id];
  const lv = Number.isFinite(raw) ? Math.floor(raw) : 1;
  return Math.max(1, Math.min(maxLevel, lv));
}

function load(currentCharms, currentLevels, maxLevel = 3) {
  const sandbox = {
    window: {},
    buildCharms: currentCharms,
    charmLevels: currentLevels,
    CHARM_MAX_LEVEL: maxLevel
  };
  vm.runInNewContext(moduleSource, sandbox, {filename: 'game-charm-math.js'});
  const actualWrapper = game.match(
    /  function charmLevelOf\(id, buildState = null\) \{[\s\S]*?\n  \}/
  );
  assert.ok(actualWrapper, 'main game keeps the same wrapper signature');
  vm.runInNewContext(actualWrapper[0] + '\nthis.callCharmLevel=charmLevelOf;', sandbox);
  return sandbox;
}

test('phase 5: current-run ownership and all numeric level variants match old implementation', () => {
  const levelCases = [undefined, null, 0, 1, 2.9, 3, 4, -9, NaN, Infinity, -Infinity, '2', false];
  for (const level of levelCases) {
    const charms = ['charm_power', 'charm_step'];
    const levels = {charm_power: level, charm_step: 2};
    for (const cap of [1, 3, 5]) {
      const env = load(charms, levels, cap);
      for (const id of ['charm_power', 'charm_step', 'charm_guard']) {
        const expected = previousCharmLevelOf(id, null, charms, levels, cap);
        const actual = env.callCharmLevel(id);
        assert.ok(Object.is(actual, expected),
          id + ', rawLevel=' + String(level) + ', max=' + cap + ': ' + actual + ' !== ' + expected);
      }
    }
  }
});

test('phase 5: explicit builds, missing-level builds and malformed tables match old code', () => {
  const currentCharms = ['charm_power', 'charm_reach'];
  const currentLevels = {charm_power: 3, charm_reach: 2};
  const env = load(currentCharms, currentLevels, 3);
  const cases = [
    undefined, null, {},
    {charms: ['charm_step']},
    {charms: ['charm_step'], charmLevels: null},
    {charms: ['charm_step'], charmLevels: 11},
    {charms: ['charm_step'], charmLevels: {charm_step: 2.7}},
    {charms: ['charm_step'], charmLevels: {charm_step: NaN}},
    {charms: ['charm_power'], charmLevels: {charm_power: 500}},
    {charms: [], charmLevels: {charm_power: 3}},
    {charms: 'charm_step', charmLevels: {charm_step: 2}},
    {charmLevels: {charm_power: 2}},
    {charmLevels: []}
  ];
  for (const state of cases) {
    for (const id of ['charm_power', 'charm_reach', 'charm_step', 'absent']) {
      const before = JSON.stringify(state);
      const expected = previousCharmLevelOf(id, state, currentCharms, currentLevels, 3);
      const actual = env.callCharmLevel(id, state);
      assert.ok(Object.is(actual, expected),
        id + ' build=' + JSON.stringify(state) + ': ' + actual + ' !== ' + expected);
      assert.equal(JSON.stringify(state), before, 'pure helper must not mutate buildState');
    }
  }
});

test('phase 5: shared module stays frozen and retains prior stat helpers', () => {
  const env = load(['charm_power'], {charm_power: 2});
  const api = env.window.GAME_CHARM_MATH;
  assert.ok(Object.isFrozen(api));
  for (const key of [
    'charmLevelOf', 'guardOilLoss', 'effectiveDamage', 'effectiveMoveSpeed',
    'effectiveMagnetRadius', 'effectiveRate', 'effectiveReachMultiplier'
  ]) assert.equal(typeof api[key], 'function', key);
  assert.equal(api.charmLevelOf('charm_power', null,
    ['charm_power'], {charm_power: 2}, 3), 2);
  assert.doesNotMatch(moduleSource, /Math\.random|document\.|localStorage/);
});

test('phase 5: browser loads shared module before game with matching cache revisions', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const mathPath = 'js/game-charm-math.js?v=20261103-charm-phase5';
  const gamePath = 'js/game.js?v=20261103-catalog-phase13';
  assert.ok(html.includes(mathPath) && html.includes(gamePath));
  assert.ok(html.indexOf(mathPath) < html.indexOf(gamePath));
  assert.ok(game.includes('window.GAME_CHARM_MATH.charmLevelOf('));
});
