'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { loadGame } = require('./helpers/game-runtime.cjs');

const seal = ['wide','deep','near','swift'].map(id => 'mut_seal_nail_' + id);
const wolf = ['guard','life','quick','fang'].map(id => 'mut_shikigami_' + id);
const boot = () => loadGame({ stage: 'bamboo-maze', location: { hostname: 'public.example', search: '' } });
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} ~= ${expected}`);

test('兩組各四張正式變異卡，持有才可抽、每招各限兩種', () => {
  const game = boot();
  const { GAME_CATALOG, GAME_BUILD_RULES } = game.env;
  const config = GAME_CATALOG.MUTATION_CONFIG;
  for (const [skill, ids] of [['seal_nail',seal], ['shikigami',wolf]]) {
    assert.deepEqual(Object.keys(config).filter(id => config[id].skillId === skill), ids);
    for (const id of ids) {
      assert.equal(GAME_BUILD_RULES.canAddMutation(id, [], config, {}, 2), false);
      assert.equal(GAME_BUILD_RULES.canAddMutation(id, [], config, { [skill]: 1 }, 2), true);
      assert.equal(GAME_BUILD_RULES.canAddMutation(id, [id], config, { [skill]: 1 }, 2), false);
    }
    assert.equal(GAME_BUILD_RULES.canAddMutation(ids[2], ids.slice(0,2), config, { [skill]: 1 }, 2), false);
  }
  assert.equal(GAME_BUILD_RULES.canAddMutation(wolf[0], seal.slice(0,2), config, { shikigami: 1 }, 2), true);
  game.start('bamboo-maze');
  game.setWeaponRank('seal_nail', 1);
  game.env.Math.random = () => 0;
  const card = game.eligibleChoices().find(c => c.type === 'mutation');
  assert.equal(card?.id, seal[0]);
  assert.equal(card.f(), true);
  assert.equal(card.f(), false);
});

test('封印釘同一規格提供爆域、雙段傷害、離位距離與冷卻', () => {
  const { GAME_SEAL_NAIL } = boot().env;
  const base = GAME_SEAL_NAIL.spec(5, 2);
  const changed = GAME_SEAL_NAIL.spec(5, 2, seal);
  near(changed.radius, base.radius * 1.25);
  near(changed.damage, base.damage * 1.25);
  near(changed.secondDamage, base.secondDamage * 1.25);
  near(changed.distance, base.distance - 25);
  near(changed.cooldown, base.cooldown * .82);
});

test('封印釘在實際爆破使用變異距離與傷害，Lv5 第二段仍排程一次', () => {
  const { GAME_SEAL_NAIL } = boot().env;
  const trap = GAME_SEAL_NAIL.create();
  const start = { x: 0, y: 0 }, enemy = { ...start, hp: 999 };
  const hits = [];
  const tick = (dt, end) => trap.tick({ dt, level: 5, start, end, mutations: seal.slice(1,3),
    enemies: [enemy], hit: (_enemy, damage) => hits.push(damage) });
  tick(.1, { x: 1, y: 0 });
  tick(.1, { x: 119, y: 0 });
  assert.equal(hits.length, 0);
  tick(.1, { x: 120, y: 0 });
  assert.deepEqual(hits, [12.5]);
  assert.equal(trap.snapshot(5).pendingSecond, true);
  tick(.25, { x: 120, y: 0 });
  assert.deepEqual(hits, [12.5, 5.625]);
});

test('白狼變異改變生命、存續、攻擊間隔與傷害', () => {
  const { GAME_SHIKIGAMI } = boot().env;
  const base = GAME_SHIKIGAMI.spec(5, 2);
  const changed = GAME_SHIKIGAMI.spec(5, 2, wolf);
  assert.equal(changed.maxHp, Math.round(base.maxHp * 1.30));
  near(changed.life, base.life + 3);
  near(changed.attackInterval, base.attackInterval * .82);
  near(changed.damage, base.damage * 1.25);
  assert.equal(changed.cooldown, base.cooldown);
});

test('白狼存活中拿到強軀與長契時保留已受傷量並只延長一次', () => {
  const { GAME_SHIKIGAMI } = boot().env;
  const ally = GAME_SHIKIGAMI.create({ species: 'hound' });
  const player = { x: 0, y: 0 };
  ally.tick({ dt: .1, level: 1, player });
  ally.body().hp -= 12;
  const before = ally.snapshot();
  ally.tick({ dt: .1, level: 1, player, mutations: wolf.slice(0,2) });
  assert.equal(ally.snapshot().maxHp, 55);
  assert.equal(ally.snapshot().hp, 43);
  near(ally.snapshot().remaining, before.remaining + 2.9);
  ally.tick({ dt: .1, level: 1, player, mutations: wolf.slice(0,2) });
  near(ally.snapshot().remaining, before.remaining + 2.8);
});
