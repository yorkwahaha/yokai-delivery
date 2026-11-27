'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { projectBuild, wordPage, spatialTarget } = require('../js/ui-compendium-model.js');
const { loadGame } = require('./helpers/game-runtime.cjs');

test('the compendium overlays the homepage without releasing its cover', () => {
  const game = loadGame();
  const key = code => game.events.keydown({code, preventDefault() {}});
  let homePaints = 0, releases = 0;
  game.env.UI.drawMainMenu = () => { homePaints++; };
  game.env.releaseRunCover = () => { releases++; };
  game.frame(0);
  key('KeyC');
  assert.equal(game.snapshot().state, 'codex');
  game.frame(16);
  key('Escape');
  assert.equal(game.snapshot().state, 'menu');
  game.frame(32);
  assert.equal(homePaints, 3);
  assert.equal(releases, 0);
  game.start();
  game.frame(48);
  assert.equal(releases, 1, 'the real run still releases the cover');
});

test('mutation entries follow active-skill and mutation definition order through unlocks', () => {
  const { env } = loadGame({location:{hostname:'public.example',search:''}});
  const {UI, GAME_CATALOG, GAME_SHIKIGAMI} = env;
  const entries = Array.from(UI.CARD_LIST).filter(card => card.type.split('・')[0] === '變異');
  const definitions = Object.values(GAME_CATALOG.MUTATION_CONFIG);
  const expansion=env.GAME_SKILL_EXPANSION.ids;
  const order = [...Object.keys(GAME_CATALOG.WI).filter(id=>!expansion.includes(id)), GAME_SHIKIGAMI.CARD.id,...expansion];
  const expected = order.flatMap(skill => definitions.filter(card => card.skillId === skill).map(card => card.id));
  assert.deepEqual(entries.map(card => card.emblem), expected);

  const visible = () => Array.from(UI.CARD_LIST).filter(card => {
    const skill = GAME_CATALOG.MUTATION_CONFIG[card.emblem]?.skillId;
    return skill && (!env.STORE.activeSkillClearStage(skill) || env.STORE.isActiveSkillUnlocked(skill));
  }).map(card => card.emblem);
  assert.deepEqual(visible(), expected.filter(id => !env.STORE.activeSkillClearStage(GAME_CATALOG.MUTATION_CONFIG[id].skillId)));
  for (const stage of ['sakura-pass','night-town','rain-port','bamboo-maze','hyakki-kyoto','snow-temple','spirit-ferry']) env.STORE.completeStage(stage);
  assert.deepEqual(visible(), expected);
});

test('build preserves actual slot order, variant order, eligibility and differing capacity', () => {
  const data = {
    activeSkills: ['a', 'b'], WL: {a: 5, b: 2},
    mutations: ['a3', 'a1'], charms: ['guard'], charmLevels: {guard: 2}
  };
  const mutations = {
    a1: {id:'a1', skillId:'a', inPool:true}, a2: {id:'a2', skillId:'a', inPool:true},
    a3: {id:'a3', skillId:'a', inPool:true}, b1: {id:'b1', skillId:'b', inPool:false},
    c1: {id:'c1', skillId:'c', inPool:true}
  };
  const result = projectBuild(data, {
    weapons: {a:{}, b:{}, c:{}}, mutations, maxActive: 4, maxRank: 5, mutationSlots: 2,
    canAdd: id => id === 'c1', canLearn: () => true, passives: [{id:'spd', count:2}]
  });
  assert.deepEqual(result.slots.map(slot => slot?.id ?? null), ['a','b',null,null]);
  assert.deepEqual(result.slots[0].owned, ['a3','a1']);
  assert.deepEqual(result.slots[0].candidates, []);
  assert.equal(result.slots[1].capacity, 0);
  assert.deepEqual(result.summary, {active:2, full:1, activeMax:4, mutations:2, mutationMax:3});
  assert.deepEqual(result.charms, [{id:'guard', count:2}]);
  assert.deepEqual(result.passives, [{id:'spd', count:2}]);
});

test('word filters intersect, preserve shared words and count only explicitly open cards', () => {
  const cards = [
    {key:'a', stages:['s1','s2'], packId:'p1', reveal:'open'},
    {key:'b', stages:['s1'], packId:'p1', reveal:'locked'},
    {key:'c', stages:['s2'], packId:'p2', reveal:'open'}
  ];
  assert.deepEqual(wordPage(cards, {stage:'s1', pack:'p1'}, 5, 1), {
    page:1, pageCount:2, count:2, opened:1, cards:[cards[1]]
  });
  assert.deepEqual(wordPage(cards, {stage:'s1', pack:'p2'}, 5, 8), {
    page:0, pageCount:1, count:0, opened:0, cards:[]
  });
});

test('direction follows the visible row and leaves the viewport boundary alone', () => {
  const position = (left, top) => ({left, top, width:60, height:40});
  const focus = position(100,100);
  assert.equal(spatialTarget(focus, [position(0,100),position(105,150),position(210,100)], 'right'), 2);
  assert.equal(spatialTarget(focus, [position(0,100),position(210,100)], 'up'), -1);
});

test('isolated review projects the actual skill and mutation catalogue across all five states', () => {
  const load = (allow) => {
    const sandbox = {
      location: {search: '?dev=1&stageLab=1&compendiumReview=1&fixture=D'},
      URLSearchParams, window: {
        DEV_MODE: {isStageLab: () => allow},
        DELIVERY_LEXICON: {stages: []}
      }
    };
    for (const script of ['game-catalog', 'game-build-rules', 'ui-compendium-review']) {
      vm.runInNewContext(fs.readFileSync(`js/${script}.js`, 'utf8'), sandbox);
    }
    return sandbox.window;
  };
  assert.equal(load(false).COMPENDIUM_REVIEW, undefined);
  const {GAME_CATALOG, GAME_BUILD_RULES, COMPENDIUM_REVIEW} = load(true);
  const {MUTATION_CONFIG, CHARM_CONFIG, WI, WEAPON_UPGRADES} = GAME_CATALOG;
  const weapons = {...WI, shikigami:{id:'shikigami'}};
  const expected = { A:[1,0,0], B:[4,0,3], C:[4,4,6], D:[4,2,5], E:[4,1,5] };
  assert.equal(COMPENDIUM_REVIEW.initial, 'D');
  for (const [id, counts] of Object.entries(expected)) {
    const row = COMPENDIUM_REVIEW.fixture(id);
    const charms = Object.keys(row.charms || {});
    assert.ok(charms.every(key => CHARM_CONFIG[key]));
    for (let i = 0; i < row.mutations.length; i++) {
      assert.ok(GAME_BUILD_RULES.canAddMutation(row.mutations[i], row.mutations.slice(0,i),
        MUTATION_CONFIG, row.levels, 2), id + ' · ' + row.mutations[i]);
    }
    const snapshot = GAME_BUILD_RULES.createBuildState(weapons,row.levels,charms,row.mutations,[],key=>row.charms[key]);
    const view = projectBuild(snapshot,{
      weapons, mutations:MUTATION_CONFIG, maxRank:WEAPON_UPGRADES.katana.length, maxActive:4,
      mutationSlots:2, canAdd:key=>GAME_BUILD_RULES.canAddMutation(key,row.mutations,MUTATION_CONFIG,row.levels,2),
      canLearn:key=>!key.startsWith('fusion_'), passives:[]
    });
    const {active, full, mutations} = view.summary;
    assert.deepEqual([active,full,mutations],counts,id);
  }
});
