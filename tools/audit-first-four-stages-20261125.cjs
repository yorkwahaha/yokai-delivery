'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert/strict');
const vm = require('node:vm');

// Extend only the existing VM fixture, in memory. Production files are read verbatim.
const fixturePath = require.resolve('../tests/helpers/game-runtime.cjs');
const helper = new Module(fixturePath, module);
helper.filename = fixturePath;
helper.paths = module.paths;
const source = fs.readFileSync(fixturePath, 'utf8');
const marker = '  currentChoices: () => choices,';
assert.ok(source.includes(marker));
helper._compile(source.replace(marker, marker + `
  auditOffer: () => { xp = xpNeed(); offerUp(); levelupCooldown = 0; },
  auditReroll: () => { reroll(); levelupCooldown = 0; },
  auditTake: index => pickUp(index),
  auditRerolls: () => rerolls,
  auditBuild: () => ({ ...WL }),
  auditSpec: (id, rank, options) => resolveAttackSpec(id, rank, undefined, options),
  auditPacing: (t, power = 0) => mobPacing(t, power),
  auditProfile: () => ({ xpScale: XP_NEED_SCALE, cap: MOB_DIFFICULTY.cap, surgeFirst: SURGE_FIRST, surgeInterval: SURGE_INTERVAL }),
  auditXpGain: enemy => { enemy.hp = 1; hurt(enemy, 1); },
  auditOilRate: () => { const before=oil; update(1/60); return (before-oil)*60; },
  auditTimers: (nextSpawn, nextSurge) => { spawnT=nextSpawn; surgeT=nextSurge; },
  auditResetFxLog: () => { texts.length = 0; },
  auditVictory: () => checkVictoryCondition(),
  auditHitPlayer: hurtPlayer,
  auditDrop: dropGem,
  auditLimits: () => ({ gemLimit:GEM_LIMIT, gemDistance:GEM_DISTANCE, magnet:getEffectiveMagnetRadius(), speed:getEffectiveMoveSpeed() }),
  auditCombatTick: (dt, x, y) => {
    const start={x:P.x,y:P.y};
    P.x=x;P.y=y;elapsed+=dt;
    weapons(dt,{start,end:{x,y}});
  },
`), fixturePath);
const { loadGame } = helper.exports;

const stages = ['night-town', 'rain-port', 'sakura-pass', 'bamboo-maze'];
const skills = ['katana', 'barrier', 'fire', 'boom', 'thunder', 'needle', 'ink_trail', 'seal_nail', 'shikigami'];
const rewardSkills = skills.slice(-3);
const official = { hostname: 'example.com', search: '' };
const lan = { hostname: '192.168.50.107', search: '?dev=1&s3play=1' };

function createGame(stageIndex, location = official) {
  const game = loadGame({ location });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/sakura-art-data.js'), 'utf8'), game.env);
  const store = game.store();
  for (let index = 0; index < stageIndex; index++) {
    store.finish(stages[index], 100, 6, true);
    store.markSkillExperienced(rewardSkills[index]);
  }
  return game;
}

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function summarize(values, total) {
  values.sort((a, b) => a - b);
  const percentile = fraction => values[Math.ceil(values.length * fraction) - 1] ?? null;
  return {
    observed: values.length,
    mean: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
    p50: percentile(.5),
    p90: percentile(.9),
    p95: percentile(.95),
    max: values.at(-1) ?? null,
    absent: Object.fromEntries([10, 15, 20, 25].map(level => [
      level, (total - values.filter(value => value <= level).length) / total,
    ])),
  };
}

const scenarios = [
  { name: 'S1-fill', stage: 0, policy: 'fill' },
  { name: 'S2-hold-ink', stage: 1, policy: 'hold', target: 'ink_trail' },
  { name: 'S2-hold-ink-reroll', stage: 1, policy: 'hold', target: 'ink_trail', reroll: true },
  { name: 'S2-hold-ink-decline', stage: 1, policy: 'hold', target: 'ink_trail', decline: true },
  { name: 'S2-LAN-fresh-hold', stage: 1, unlocks: 0, location: lan, policy: 'hold', target: 'ink_trail' },
  { name: 'S3-fill', stage: 2, policy: 'fill' },
  { name: 'S4-fill', stage: 3, policy: 'fill' },
  { name: 'S4-focus-katana', stage: 3, policy: 'katana' },
  { name: 'S4-hold-wolf', stage: 3, policy: 'hold', target: 'shikigami' },
  { name: 'S4-hold-rewards-decline', stage: 3, policy: 'hold', target: 'shikigami', decline: true },
];

function pickCard(cards, levels, scenario) {
  const wanted = cards.find(c => c.type === 'weapon' && c.id === scenario.target);
  const katana = cards.find(c => c.type === 'weapon' && c.id === 'katana');
  const unowned = cards.find(c => c.type === 'weapon' && !levels[c.id]);
  const owned = cards.find(c => c.type === 'weapon' && levels[c.id]);
  const other = cards.find(c => c.type !== 'weapon');
  const safe = other || owned;
  if (scenario.policy === 'hold') {
    if (scenario.decline) return safe;
    if (!levels[scenario.target]) return wanted || safe;
  }
  if (scenario.policy === 'katana') return katana || unowned || owned || other;
  return unowned || owned || other;
}

function simulate(scenario, samples) {
  const { stage, unlocks = stage, location = official } = scenario;
  const game = createGame(unlocks, location);
  const eligible = skills.slice(0, 6 + (location === lan ? 1 : unlocks));
  const initialOffer = Object.fromEntries(eligible.map(id => [id, 0]));
  const seen = Object.fromEntries(eligible.map(id => [id, []]));
  const acquired = Object.fromEntries(eligible.map(id => [id, []]));
  const misses = Object.fromEntries(eligible.map(id => [id, 0]));
  const lv5 = [];
  const filled = [];
  const builds = new Map();
  let pickedRepeat = 0, offeredRepeat = 0, pickedPairs = 0, offerPairs = 0;
  let rerollsUsed = 0, rerollsNewTarget = 0, rerollsSameSet = 0, holdBreak = 0;
  let cappedOffered = 0, invalidLateNew = 0, fusionOffered = 0;

  for (let seed = 1; seed <= samples; seed++) {
    game.env.Math.random = rng(seed);
    game.startRun(stages[stage]);
    if (scenario.policy === 'hold') {
      game.setWeaponRank('fire', 1);
      game.setWeaponRank('needle', 1);
    }
    const prefilled = scenario.policy === 'hold' ? ['katana', 'fire', 'needle'] : ['katana'];
    const firstSeen = {};
    const firstTaken = Object.fromEntries(prefilled.map(id => [id, 1]));
    const streaks = {};
    let priorPick, priorOffered, firstMax, firstFill;
    for (let level = 2; level <= 25; level++) {
      const levels = game.auditBuild();
      const count = eligible.filter(id => levels[id]).length;
      game.auditOffer();
      let cards = game.currentChoices();
      const normal = new Set(cards.filter(c => c.type === 'weapon').map(c => c.id));
      for (const id of eligible) {
        if (normal.has(id) && level === 2) initialOffer[id]++;
        if (count < 4 && !levels[id]) {
          streaks[id] = normal.has(id) ? 0 : (streaks[id] || 0) + 1;
          misses[id] = Math.max(misses[id], streaks[id]);
        }
      }
      for (const id of normal) firstSeen[id] ??= level;
      if (priorOffered) {
        offerPairs++;
        if ([...normal].some(id => priorOffered.has(id))) offeredRepeat++;
      }
      priorOffered = normal;
      if (scenario.reroll && !levels[scenario.target] && !normal.has(scenario.target) && game.auditRerolls() > 0) {
        const original = new Set(cards.map(c => c.choiceId));
        game.auditReroll();
        cards = game.currentChoices();
        rerollsUsed++;
        if (cards.some(c => c.type === 'weapon' && c.id === scenario.target)) rerollsNewTarget++;
        if (cards.length === original.size && cards.every(c => original.has(c.choiceId))) rerollsSameSet++;
      }
      for (const c of cards) {
        if (c.type === 'weapon') {
          firstSeen[c.id] ??= level;
          if (levels[c.id] === 5) cappedOffered++;
          if (count === 4 && !levels[c.id]) invalidLateNew++;
        }
        if (c.type === 'fusion' || c.id.startsWith('fusion_')) fusionOffered++;
      }
      const picked = pickCard(cards, levels, scenario);
      if (!picked && scenario.decline) { holdBreak++; break; }
      assert.ok(picked, scenario.name);
      const result = game.auditTake(cards.indexOf(picked));
      assert.ok(result?.ok, JSON.stringify({ seed, level, result, scenario: scenario.name }));
      game.auditResetFxLog();
      if (picked.type === 'weapon') {
        firstTaken[picked.id] ??= level;
        if (picked.lv === 5) firstMax ??= level;
        if (count === 3 && !levels[picked.id]) firstFill ??= level;
      }
      const currentPick = picked.type === 'weapon' ? picked.id : null;
      if (priorPick && currentPick) {
        pickedPairs++;
        if (priorPick === currentPick) pickedRepeat++;
      }
      priorPick = currentPick;
    }
    for (const id of eligible) {
      if (firstSeen[id]) seen[id].push(firstSeen[id]);
      if (firstTaken[id]) acquired[id].push(firstTaken[id]);
    }
    if (firstMax) lv5.push(firstMax);
    if (firstFill) filled.push(firstFill);
    const build = skills.filter(id => game.auditBuild()[id]).join('+');
    builds.set(build, (builds.get(build) || 0) + 1);
    game.clearSkillFxLog();
  }
  const stats = values => Object.fromEntries(Object.entries(values).map(([id, list]) => [id, summarize(list, samples)]));
  return {
    scenario: scenario.name, samples,
    normalLv2: Object.fromEntries(Object.entries(initialOffer).map(([id, n]) => [id, n / samples])),
    seen: stats(seen), acquired: stats(acquired), longestEligibleMisses: misses,
    firstLv5: summarize(lv5, samples), filled: summarize(filled, samples),
    sharesAnyWeaponAcrossAdjacentNormalOffers: offeredRepeat / offerPairs,
    sameWeaponAcrossAdjacentWeaponPicks: pickedRepeat / pickedPairs,
    rerollsUsed, rerollsNewTarget, rerollsSameSet, holdBreak, cappedOffered, invalidLateNew, fusionOffered,
    builds: Object.fromEntries([...builds.entries()].sort((a, b) => b[1] - a[1])),
  };
}

const samples = Number(process.argv[2] || 10000);
const requested = process.argv.slice(3);
const selected = scenarios.filter(s => !requested.length || requested.includes(s.name));

function curriculum(game, stage) {
  const words = game.env.CONTENT.getStageWords(stage);
  const rules = game.env.GAME_QUIZ_LOGIC;
  let majority = 0, uniqueLength = 0, exactlyThree = 0;
  const slots = [0, 0, 0];
  for (let trial = 1; trial <= 64; trial++) {
    game.env.Math.random = rng(trial);
    for (const word of words) {
      const answers = Array.from(game.answerChoices(word));
      const correct = answers.indexOf(word);
      if (answers.length === 3) exactlyThree++;
      slots[correct]++;
      const group = answers.map(answer => rules.kanaScript(answer.jp));
      const lengths = answers.map(answer => rules.writtenLength(answer.jp));
      if (group.filter(script => script === group[correct]).length === 2 && new Set(group).size === 2) majority++;
      if (lengths.filter(length => length === lengths[correct]).length === 1) uniqueLength++;
    }
  }
  return { words: words.length, trials: words.length * 64, exactlyThree, majority, uniqueLength, slots,
    kana: Object.fromEntries(['hiragana', 'katakana', 'mixed'].map(script => [
      script, words.filter(word => rules.kanaScript(word.jp) === script).length,
    ])) };
}

function stageProbes(index) {
  const stage = stages[index];
  const game = createGame(index);
  game.startRun(stage);
  const initial = game.snapshot();
  const oilDrain = game.auditOilRate();
  game.stopSpawns();
  const schedule = game.env.CONTENT.getStage(stage).pacing.bossTimes;
  const wave = schedule.map((second, i) => {
    game.startRun(stage);
    game.stopSpawns();
    game.setElapsed(second);
    game.forceBossSchedule(i);
    let boss;
    for (let attempt = 0; attempt < 120 && !boss; attempt++) {
      game.update(1 / 60);
      boss = game.snapshot().enemies.find(e => e.type === 'boss');
    }
    assert.ok(boss, stage + ' ' + i);
    return { hp: boss.hp, speed: boss.speed, reward: boss.oilReward, shield: boss.shield, title: boss.title };
  });
  game.startRun(stage);
  game.stopSpawns();
  const ordinary = game.addMob({ hp: 1 });
  game.auditXpGain(ordinary);
  const ordinaryXp = game.snapshot().gems[0].v;
  const profile = game.auditProfile();
  const limits = game.auditLimits();
  const pacing = Array.from({ length: 11 }, (_, minute) => {
    const t = minute * 60;
    const pressure = game.auditPacing(t, 1 + 2 * minute);
    const state = game.env.CONTENT.getStage(stage);
    const difficulty = game.env.GAME_CONFIG.resolveMobDifficultyProfile(state);
    const enemy = choice => {
      const data = game.env.GAME_SPAWN_MATH.enemySpec(pressure.tier, choice, {
        elapsed: t, dawn: 600, difficulty, stageEnemy: state.enemy, stageId: stage, ring: false,
        rainPortNormal: stage === 'rain-port',
      });
      return { type: data.type, hp: Math.ceil(data.hp * difficulty.hpScale), speed: data.speed };
    };
    return { minute, ...pressure, ghost: enemy(.9), fast: enemy(.1), tank: enemy(.32),
      ranged: enemy(stage === 'rain-port' ? .44 : .40) };
  });
  // Explicit sensitivity assumptions. XP and oil are envelopes derived from real
  // cadence/rewards, with collection and delivery schedules supplied by the audit.
  const profiles = [
    { id: 'novice', harvest: .11, deliveries: [95, 185, 300, 425, 540, 660], boss: [275, 480], harm: 10, assist: .5 },
    { id: 'general', harvest: .24, deliveries: [65, 135, 210, 295, 380, 475], boss: [235, 412, 520], harm: 8, assist: 0 },
    { id: 'skilled', harvest: .37, deliveries: [45, 95, 150, 210, 280, 350], boss: [209, 388, 508], harm: 4, assist: 0 },
    { id: 'max', harvest: .58, deliveries: [30, 65, 101, 142, 181, 229], boss: [199, 377, 498], harm: 1, assist: 0 },
    { id: 'defensive', harvest: .17, deliveries: [55, 118, 179, 244, 313, 380], boss: [265, 449, 556], harm: 3, regen: .12, maxOil: 160 },
    { id: 'off-meta', harvest: .15, deliveries: [72, 145, 220, 292, 363, 441], boss: [300, 515], harm: 9, assist: 0 },
  ];
  const envelopes = profiles.map(player => {
    let received = 0, oil = initial.oil, firstDry = null;
    const maxOil = player.maxOil || initial.maxOil;
    const snapshots = [];
    for (let second = 1; second <= 600; second++) {
      const row = game.auditPacing(second, 1 + second / 30);
      if (second >= 8) received += row.count / row.interval * player.harvest * ordinaryXp;
      oil -= oilDrain - (player.regen || 0) + player.harm / 60;
      if (player.deliveries.includes(second)) {
        received += 26;
        oil = Math.min(maxOil, oil + 28 - 16 * (player.assist || 0));
      }
      const defeated = player.boss.indexOf(second);
      if (defeated !== -1) {
        received += (48 + 2) * Math.min(1, player.harvest * 2.6);
        oil = Math.min(maxOil, oil + [35, 35, 20][defeated]);
      }
      if (oil <= 0 && firstDry === null) firstDry = second;
      if (second % 60 === 0) {
        let rank = 1;
        while (game.xpSpentTotal(rank + 1) <= received) rank++;
        snapshots.push({ minute: second / 60, rank, xp: Math.round(received), oil: +oil.toFixed(1),
          deliveries: player.deliveries.filter(t => t <= second).length });
      }
    }
    return { assumptions: player, firstDry, snapshots };
  });
  game.auditTimers(Infinity, 0);
  game.setElapsed(480);
  const { x, y } = game.snapshot();
  const normalBefore = game.snapshot().enemies.filter(enemy => enemy.type !== 'boss' && enemy.hp > 0).length;
  for (let n = 0; n < profile.cap; n++) game.addMob({ x: x + 100 + (n % 10), y: y - 60, hp: 200 });
  game.setWeaponRank('katana', 0);
  game.setInvulnerability(600);
  for (let i = 0; i < 52; i++) game.update(.05);
  const overCap = game.snapshot().enemies.filter(enemy => enemy.type !== 'boss' && enemy.hp > 0).length;
  return { stage, initialXp: initial.xpNeed, oilDrain, ordinaryXp, profile, limits, wave, pacing, envelopes,
    xpTo25: game.xpSpentTotal(25), xpTo30: game.xpSpentTotal(30), curriculum: curriculum(game, stage),
    ordinaryBeforeCapFixture: normalBefore, overCap };
}

function combatProbe(game, id, rank, layout) {
  game.startRun('bamboo-maze');
  game.stopSpawns();
  const initial = game.snapshot();
  let cameraX = initial.x;
  game.env.RENDERER.getCam = () => ({ x: cameraX - 450, y: initial.y - 300 });
  const dxs = layout === 'near' ? [100] : layout === 'far' ? [390] : Array.from({ length: 12 }, (_, index) => 50 + index * 16);
  const maximum = 10000;
  const foes = dxs.map((dx, index) => ({
    dx, dy: layout === 'moving-crowd' ? (index % 4 - 1) * 37 : 0,
    hp: maximum, max: maximum, type: layout === 'moving-crowd' ? 'ghost' : 'boss', speed: 0,
  }));
  game.combatScene(id, foes, [], rank);
  game.setFacingAngle(0);
  game.armWeapons();
  game.env.Math.random = rng(117);
  const actors = game.snapshot().enemies;
  for (let frame = 1; frame <= 240; frame++) {
    const step = layout === 'moving-crowd' ? frame * 225 / 20 : 0;
    cameraX = initial.x + step;
    game.auditCombatTick(.05, cameraX, initial.y);
  }
  const damage = actors.map(enemy => maximum - enemy.hp);
  return { damage: +damage.reduce((sum, value) => sum + value, 0).toFixed(2), touched: damage.filter(value => value > 0).length };
}

function edgeProbes() {
  const game = createGame(0);
  game.startRun('night-town');
  game.stopSpawns();
  game.setXp(500);
  game.update(.05);
  const levels = [];
  for (let i = 0; i < 3; i++) {
    game.unlockUpgradeInput();
    levels.push(game.auditTake(0).level);
    assert.equal(game.auditTake(0), undefined);
    game.update(.05);
  }
  assert.deepEqual(levels, [2, 3, 4]);
  const residualXp = game.currentXp();
  game.startRun('night-town');
  game.stopSpawns();
  game.setInvulnerability(500);
  game.meetDeliveryGoal();
  game.placeBoss(1, { dx: 90 });
  game.placeBoss(1, { dx: 100 });
  const [first, final] = game.snapshot().enemies;
  final.final = true;
  game.hurt(final, 20);
  game.hurt(first, 20);
  const sameTick = { state: game.snapshot().state, earlierHp: first.hp, finalHp: final.hp };
  assert.equal(sameTick.state, 'victory');
  assert.equal(sameTick.earlierHp, 1);
  game.startRun('night-town');
  game.stopSpawns();
  assert.equal(game.auditVictory(), false);
  game.placeBoss(1);
  game.snapshot().enemies[0].final = true;
  game.hurt(game.snapshot().enemies[0], 20);
  const noDelivery = game.snapshot().state;
  assert.equal(noDelivery, 'play');
  const simultaneousTerminal = [];
  for (const startingOil of [.001, .05]) {
    game.startRun('night-town');
    game.stopSpawns();
    game.combatScene('thunder', [], [], 5);
    game.meetDeliveryGoal();
    game.placeBoss(1, { dx: 120 });
    const finalBoss = game.snapshot().enemies[0];
    finalBoss.final = true;
    game.setOil(startingOil);
    game.update(.05);
    simultaneousTerminal.push({ startingOil, state: game.snapshot().state, bossHp: finalBoss.hp });
  }
  assert.deepEqual(simultaneousTerminal.map(row => row.state), ['lampout', 'victory']);
  game.startRun('night-town');
  game.stopSpawns();
  assert.ok(game.prepareOrder());
  game.atDestination();
  game.update(.05);
  const expiringJob = game.snapshot().job;
  assert.ok(expiringJob?.reading);
  expiringJob.barrierTimer = .01;
  expiringJob.idx = expiringJob.ans.indexOf(expiringJob.word);
  expiringJob.hold = .64;
  const pad = game.answerPad(expiringJob.idx);
  game.placeAt(pad.x, pad.y);
  game.setOil(4);
  game.update(.05);
  const deliveryTimeout = { state: game.snapshot().state, delivered: game.snapshot().delivered,
    failed: game.snapshot().failed, oil: game.snapshot().oil };
  assert.deepEqual(deliveryTimeout, { state: 'lampout', delivered: 0, failed: 1, oil: 0 });
  game.startRun('night-town');
  for (const id of ['fire', 'boom', 'thunder']) game.setWeaponRank(id, 1);
  const cooldowns = () => Object.fromEntries(['katana', 'fire', 'boom', 'thunder']
    .map(id => [id, game.auditSpec(id, 1).cooldown]));
  const crit = () => ['katana', 'thunder'].map(id => game.auditSpec(id, 1).critChance);
  const rate = game.tune('rate');
  const critPassive = game.tune('crit');
  const startingCooldowns = cooldowns();
  rate.f();
  const cooldownsAtOne = cooldowns();
  const secondRateLegal = rate.ok();
  rate.f();
  assert.deepEqual(cooldowns(), cooldownsAtOne);
  critPassive.f();
  critPassive.f();
  const critAtTwo = crit();
  const thirdCritLegal = critPassive.ok();
  critPassive.f();
  assert.deepEqual(crit(), critAtTwo);
  const cappedPassives = { startingCooldowns, cooldownsAtOne, cooldownsAtTwo: cooldowns(), secondRateLegal,
    critAtTwo, critAtThree: crit(), thirdCritLegal };
  game.startRun('night-town');
  game.stopSpawns();
  const { x, y } = game.snapshot();
  for (let i = 0; i < 512; i++) game.auditDrop(x + 90 + i, y, 2);
  game.auditDrop(x + 93, y, 3);
  const gemTotal = game.snapshot().gems.reduce((sum, gem) => sum + gem.v, 0);
  assert.equal(gemTotal, 1027);
  const gemCount = game.snapshot().gems.length;
  game.startRun('night-town');
  assert.equal(game.snapshot().gems.length, 0);
  game.stopSpawns();
  const from = game.snapshot();
  game.stepFrame(5000);
  const maxStep = game.snapshot().elapsed - from.elapsed;
  assert.ok(maxStep <= .200001);
  game.setState('pause');
  const pausedTime = game.snapshot().elapsed;
  game.stepFrames(5, 50);
  const actualPausedTime = game.snapshot().elapsed;
  assert.equal(actualPausedTime, pausedTime);

  // Deterministic house-sized collision box: isolate the S1 wall/range interaction.
  game.startRun('night-town');
  game.stopSpawns();
  game.clearSolids();
  const player = game.snapshot();
  game.combatScene('thunder', [], [{x0:59,x1:189,y0:-85,y1:85}], 5);
  game.placeBoss(150, { dx: 400, bossIndex: 0 });
  const boss = game.snapshot().enemies[0];
  boss.speed = 58;
  boss.attackCd = 0;
  boss.bossTheme = 'town';
  const trace = [];
  for (let i = 0; i < 600 && boss.hp > 0; i++) {
    game.update(.05);
    if ((i + 1) % 20 === 0 || boss.hp <= 0) {
      trace.push({ second: (i + 1) / 20, hp: boss.hp, x: +(boss.x - player.x).toFixed(2),
        y: +(boss.y - player.y).toFixed(2), attack: boss.hazard?.kind || null, oil: game.snapshot().oil });
    }
  }
  return { levels, residualXp, sameTick, noDelivery, simultaneousTerminal, deliveryTimeout,
    cappedPassives, gemTotal, gemCount, maxStep,
    pausedElapsedDelta: actualPausedTime - pausedTime, wall: trace };
}

if (process.argv[2] === 'probes') {
  const game = createGame(3);
  game.startRun('bamboo-maze');
  const specs = Object.fromEntries(skills.map(id => [id, [1, 2, 3, 4, 5].map(rank => game.auditSpec(id, rank))]));
  const mutations = Object.values(game.env.GAME_CATALOG.MUTATION_CONFIG)
    .filter(meta => meta.inPool).map(({ id, skillId, n, d }) => ({ id, skillId, name: n, description: d }));
  const combat = Object.fromEntries(skills.map(id => [id, Object.fromEntries([1, 4, 5].map(rank =>
    [rank, Object.fromEntries(['near', 'far', 'moving-crowd'].map(layout => [layout, combatProbe(game, id, rank, layout)]))],
  ))]));
  console.log(JSON.stringify({ stages: stages.map((id, index) => stageProbes(index)), specs, mutations, combat,
    edge: edgeProbes() }, null, 2));
} else {
  assert.ok(Number.isSafeInteger(samples) && samples > 0 && selected.length);
  for (const scenario of selected) console.log(JSON.stringify(simulate(scenario, samples)));
}
