'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {loadGame} = require('./helpers/game-runtime.cjs');
const env = {window: {}};
vm.runInNewContext(fs.readFileSync('js/game-upgrade-choices.js', 'utf8'), env);
const api = env.window.GAME_UPGRADE_CHOICES;
const SKILLS = ['katana', 'fire', 'boom', 'barrier', 'thunder', 'needle'];
const plain = a => Array.from(a);

test('cooldown skips recent choices and always preserves a usable fallback', () => {
  const skills = ['katana', 'fire', 'boom'];
  assert.deepEqual(plain(api.weaponsAfterRecentPicks(skills, [])), skills);
  assert.deepEqual(plain(api.weaponsAfterRecentPicks(skills, ['katana'])), ['fire','boom']);
  assert.deepEqual(plain(api.weaponsAfterRecentPicks(skills, ['katana',null])), ['fire','boom']);
  assert.deepEqual(plain(api.weaponsAfterRecentPicks(skills, ['fire','katana'])), ['fire','boom']);
  assert.deepEqual(plain(api.weaponsAfterRecentPicks(['katana','fire'], ['katana','fire'])), ['katana','fire']);
  assert.deepEqual(plain(api.weaponsAfterRecentPicks(['katana'], ['katana'])), ['katana']);
  assert.deepEqual(skills, ['katana','fire','boom']);
});

test('four-slot guarantee cannot restore a cooling Katana', () => {
  const levels = {katana:4,fire:1,boom:1,barrier:1};
  const keys = api.weaponsAfterRecentPicks(Object.keys(levels), ['katana']);
  const wc = api.orderWeapons(keys, levels, 4, () => .3)
    .map(id => ({id,choiceId:'weapon:'+id,type:'weapon',lv:levels[id]+1}));
  const offered = api.assemble(null, [], wc, [], [], [], [], arr => [...arr]);
  const forced = wc.find(c => levels[c.id] > 0);
  const cards = api.withGuarantees(offered,[forced],wc);
  assert.ok(cards.every(c => c.id !== 'katana'));
  assert.ok(cards.some(c => c.type === 'weapon'));
  assert.ok(cards.length <= 3);
});

test('real game selection then reroll does not bypass weapon cooldown', () => {
  let checked = false;
  for (let seed = 1; seed <= 45 && !checked; seed++) {
    const g = loadGame({seed,stage:'night-town'});
    g.start('night-town');
    if (g.forceLevelUp() !== 'levelup') continue;
    const idx = g.currentChoices().findIndex(c => c.type === 'weapon' && c.id === 'katana');
    if (idx < 0) continue;
    assert.equal(g.takeLevelUpChoice(idx).ok,true);
    assert.equal(g.forceLevelUp(),'levelup');
    assert.ok(!g.currentChoices().some(c => c.type === 'weapon' && c.id === 'katana'));
    g.waitLevelUpCooldown();
    g.rerollUpgradeForTest();
    assert.ok(!g.currentChoices().some(c => c.type === 'weapon' && c.id === 'katana'));
    checked = true;
  }
  assert.ok(checked,'must find a deterministic initial Katana offer');
});

// Non-browser A/B simulation: identical seeded scenario and real pure
// orderWeapons -> assemble -> withGuarantees logic; not a player-rate forecast.
function simulate(seed, improved, initial) {
  let s = seed >>> 0;
  const random = () => ((s = (Math.imul(s,1664525) + 1013904223) >>> 0) / 4294967296);
  const shuffle = input => {
    const a = [...input];
    for (let i = a.length-1;i>0;i--) {
      const j = Math.floor(random()*(i+1));
      [a[i],a[j]] = [a[j],a[i]];
    }
    return a;
  };
  const levels = initial === 'full'
    ? {katana:4,fire:1,boom:1,barrier:1,thunder:0,needle:0}
    : {katana:1,fire:0,boom:0,barrier:0,thunder:0,needle:0};
  const passives = {shield:0,oil:0,rate:0,mag:0,spd:0};
  // A full-slot Katana Lv4 state follows an actual Katana upgrade.
  const history = initial === 'full' ? ['katana'] : [];
  let last = null, streak = 0, maxStreak = 0, firstMax = 0, shortCards = 0, avoidableShortCards = 0;
  for (let offer = 1;offer <= 24;offer++) {
    const owned = SKILLS.filter(id => levels[id] > 0).length;
    const eligible = SKILLS.filter(id => levels[id] < 5 && (levels[id] > 0 || owned < 4));
    const candidates = improved ? api.weaponsAfterRecentPicks(eligible,history) : eligible;
    const wc = api.orderWeapons(candidates,levels,4,random)
      .map(id => ({id,choiceId:'w:'+id,type:'weapon',lv:levels[id]+1}));
    const pc = shuffle(Object.keys(passives).filter(id => passives[id] < 4))
      .map(id => ({id,choiceId:'p:'+id,type:'passive'}));
    if (!wc.length && !pc.length) break; // post-cap coin reward, not a bad offer
    const offered = api.assemble(null,[],wc,[],[],pc,[],shuffle);
    const forced = initial === 'full' ? wc.find(c => levels[c.id] > 0) : null;
    const cards = api.withGuarantees(offered,forced ? [forced] : [],[...wc,...pc]);
    if (cards.length < 3) {
      shortCards++;
      if (wc.length + pc.length >= 3) avoidableShortCards++;
    }
    // Deliberately adversarial: always select Katana when present.
    const pick = cards.find(c => c.type === 'weapon' && c.id === 'katana')
      || cards.find(c => c.type === 'weapon' && levels[c.id] === 0)
      || cards.find(c => c.type === 'passive')
      || cards.find(c => c.type === 'weapon');
    if (!pick) break;
    const id = pick.type === 'weapon' ? pick.id : null;
    streak = id && id === last ? streak+1 : 1;
    if (id && id === last) maxStreak = Math.max(maxStreak,streak);
    last = id;
    history.push(id);
    if (history.length > 2) history.shift();
    if (pick.type === 'weapon') {
      levels[id]++;
      if (id === 'katana' && levels[id] === 5 && !firstMax) firstMax = offer;
    } else passives[pick.id]++;
  }
  return {maxStreak,firstMax,shortCards,avoidableShortCards,finalKatana:levels.katana};
}

test('10,000 seeded runs per arm show early-max and streak differences', () => {
  const report = {};
  for (const initial of ['early','full']) {
    const arms = {};
    for (const improved of [false,true]) {
      const stats = {maxWithin4:0,maxWithin24:0,streak3:0,shortCards:0,avoidableShortCards:0,katanaLevels:0,firstMaxOfferSum:0};
      for(let seed=1;seed<=10000;seed++){
        const r=simulate(seed,improved,initial);
        if(r.firstMax && r.firstMax<=4) stats.maxWithin4++;
        if(r.firstMax){ stats.maxWithin24++;stats.firstMaxOfferSum+=r.firstMax; }
        if(r.maxStreak>=3) stats.streak3++;
        stats.shortCards+=r.shortCards;
        stats.avoidableShortCards+=r.avoidableShortCards;
        stats.katanaLevels+=r.finalKatana;
      }
      arms[improved?'cooldown':'baseline']=stats;
    }
    assert.ok(arms.cooldown.maxWithin4<=arms.baseline.maxWithin4);
    assert.ok(arms.cooldown.streak3<=arms.baseline.streak3);
    assert.equal(arms.cooldown.avoidableShortCards,0,'no avoidable undersized offer');
    report[initial]=arms;
  }
  console.log('Seeded upgrade A/B:',JSON.stringify(report));
});
