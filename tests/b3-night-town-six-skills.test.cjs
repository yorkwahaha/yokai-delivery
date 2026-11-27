'use strict';
// B3: focused normal night-town skill-pool gate (not a full playthrough).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/game-runtime.cjs');

const SIX = ['katana', 'barrier', 'fire', 'boom', 'thunder', 'needle'];

test('B3 first-stage active pool includes all thirteen skills without any clears', () => {
  const g = loadGame({ seed: 51, location:{hostname:'yorkwahaha.github.io',search:''} });
  g.start();
  const levels = g.weaponLevels();
  const extra = ['ink_trail','seal_nail','shikigami',...g.env.GAME_SKILL_EXPANSION.ids];
  const all = [...SIX, ...extra];
  assert.deepEqual(Object.keys(levels).filter(id => !id.startsWith('fusion_')).sort(), all.sort());
  for (const id of extra) {
    assert.equal(levels[id], 0);
    assert.equal(g.store().isActiveSkillUnlocked(id), true);
  }
  assert.equal(g.store().isStageCompleted('night-town'), false);
  const rules = g.env.GAME_UPGRADE_CHOICES;
  let pool;
  g.env.GAME_UPGRADE_CHOICES = {...rules, orderWeapons(keys, ...args) {
    pool = Array.from(keys);
    return rules.orderWeapons(keys, ...args);
  }};
  assert.equal(levels.katana, 1);
  for (const id of SIX.slice(1)) assert.equal(levels[id], 0);
  for (const [id, level] of Object.entries(levels)) if (id.startsWith('fusion_')) assert.equal(level, 0);
  g.offerUp();
  assert.deepEqual(pool.sort(), all.sort());
  for (const card of g.currentChoices()) {
    assert.notEqual(card.type, 'fusion');
    assert.notEqual(card.type, 'duo');
    if (card.type === 'weapon') assert.ok(all.includes(card.id), `Unexpected weapon: ${card.id}`);
  }
});

test('B3 four equipped active slots prevent unlocking a fifth; restart clears all extra levels', () => {
  const g = loadGame({ seed: 52 });
  g.start();
  for (const id of ['barrier', 'fire', 'boom']) g.setWeaponRank(id, 1);
  g.offerUp();
  for (const c of g.currentChoices().filter(c => c.type === 'weapon')) {
    assert.ok(['katana', 'barrier', 'fire', 'boom'].includes(c.id), `Fifth active slot leaked: ${c.id}`);
  }
  g.setWeaponRank('needle', 5);
  g.setWeaponRank('thunder', 4);
  g.start();
  const levels = g.weaponLevels();
  assert.equal(levels.katana, 1);
  for (const id of SIX.slice(1)) assert.equal(levels[id], 0);
  for (const [id, level] of Object.entries(levels)) if (id.startsWith('fusion_')) assert.equal(level, 0);
});
