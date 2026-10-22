'use strict';
// SYS-B short-window pacing probe. Deterministic, local-only, never opens frozen audio.
require('./director-audio-freeze.cjs');
const fs = require('node:fs');
const path = require('node:path');
const CFG = require('../js/config.js');
const CONTENT = require('../js/words.js');

// boss-ai.js reads window.STAGE / window.STAGE_ENEMY at call time; give it a
// replaceable host without touching any production file.
const hadWindow = typeof global.window !== 'undefined';
const savedWindow = global.window;
if (!hadWindow) global.window = {};
const BOSS_AI = require('../js/boss-ai.js');
if (hadWindow) global.window = savedWindow; else delete global.window;

const WINDOWS = Object.freeze({
  opening: [0, 60],
  mid: [150, 210],
  late: [480, 540]
});
const POWER_SAMPLE = 2.2;

function round(n) {
  return Number(Number(n).toFixed(6));
}

function createRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashId(id) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

function withStageWindow(stage, fn) {
  const previous = global.window;
  global.window = { STAGE: stage, STAGE_ENEMY: stage.enemy || {} };
  try {
    return fn();
  } finally {
    if (previous === undefined) delete global.window;
    else global.window = previous;
  }
}

function profileName(profile) {
  for (const [name, value] of Object.entries(CFG.MOB_DIFFICULTY_PROFILES)) {
    if (value === profile) return name;
  }
  return 'unknown';
}

function stageVariant(stageId, mode) {
  const base = CONTENT.getStage(stageId);
  if (!base) throw new Error('unknown stage: ' + stageId);
  const stage = mode ? { ...base, pacing: { ...base.pacing, mobDifficulty: mode } } : base;
  return { stage, profile: CFG.resolveMobDifficultyProfile(stage) };
}

function windowStats(stage, profile, start, end) {
  const stageIntervalScale = stage.pacing.spawnIntervalScale || 1;
  const spawnCountBonus = stage.pacing.spawnCountBonus || 0;
  let t = start;
  let events = 0;
  let units = 0;
  let guard = 0;
  while (t < end && guard++ < 10000) {
    const interval = CFG.spawnInterval(t * profile.timeScale) * stageIntervalScale * profile.intervalScale;
    if (!Number.isFinite(interval) || interval <= 0) break;
    events += 1;
    units += Math.max(1, CFG.spawnCount(t) + spawnCountBonus);
    t += interval;
  }
  return {
    start,
    end,
    events,
    units,
    cap: profile.cap,
    zeroKillCeiling: Math.min(profile.cap, units)
  };
}

function enemyStats(stage, profile, t) {
  const dawn = stage.pacing.runSeconds || CFG.RUN_SECONDS;
  const capped = Math.min(t, dawn);
  const tier = CFG.enemyTier(Math.min(t, CFG.RUN_SECONDS) * profile.timeScale, POWER_SAMPLE * profile.powerScale);
  const speedRamp = (capped / dawn) * 75 * profile.timeScale;
  const stageSpeed = (stage.enemy.speedScale || 1) * profile.speedScale;
  return {
    t,
    tier: round(tier),
    ghostHp: Math.ceil(2.0 * tier * profile.hpScale),
    ghostSpeed: round((52 + speedRamp * 0.9) * stageSpeed)
  };
}

function surgeStats(stage, profile) {
  return {
    first: round((stage.pacing.surgeFirst || CFG.SURGE_FIRST) * profile.surgePacingScale),
    interval: round((stage.pacing.surgeInterval || CFG.SURGE_INTERVAL) * profile.surgePacingScale),
    countScale: profile.surgeCountScale,
    capSurges: profile.capSurges
  };
}

function runBossCadence(stage, seed) {
  return withStageWindow(stage, () => {
    const rows = [];
    const originalRandom = Math.random;
    try {
      for (let bossIndex = 0; bossIndex < 4; bossIndex++) {
        const measure = (hp, max) => {
          const rng = createRng((seed ^ hashId(stage.id)) + bossIndex * 7919 + hp);
          Math.random = rng;
          const e = {
            type: 'boss', x: 0, y: 0, hp, max,
            bossIndex, stageId: stage.id,
            bossTheme: stage.enemy && stage.enemy.bossTheme,
            _attackStep: 0, attackCd: 0
          };
          const player = { x: 200, y: 0 };
          const kinds = [];
          let starts = 0;
          let hits = 0;
          const dt = 1 / 30;
          const frames = Math.round(60 / dt);
          for (let frame = 0; frame < frames; frame++) {
            // Pin the boss in range: this measures attack opportunities, not charge travel.
            e.x = 0;
            e.y = 0;
            const result = BOSS_AI.step(e, player, dt, { blocked: () => false, paused: false });
            if (result.started) {
              starts += 1;
              kinds.push(e.hazard ? e.hazard.kind : null);
            }
            if (result.hit) hits += 1;
          }
          return { starts, hits, kinds };
        };
        const max = 1400;
        const row = { bossIndex, fullHp: measure(max, max) };
        if (bossIndex === 3) row.halfHp = measure(Math.floor(max * 0.4), max);
        rows.push(row);
      }
    } finally {
      Math.random = originalRandom;
    }
    return rows;
  });
}

function runProbe(options = {}) {
  const seed = Number.isInteger(options.seed) ? options.seed : 777;
  const variants = [
    ['night-town', null],
    ['night-town', 'hard'],
    ['rain-port', null],
    ['rain-port', 'hard'],
    ['yomi', null]
  ];
  const bossCadence = {};
  const rows = variants.map(([stageId, mode]) => {
    const { stage, profile } = stageVariant(stageId, mode);
    const windowRows = {};
    for (const [name, [start, end]] of Object.entries(WINDOWS)) {
      windowRows[name] = windowStats(stage, profile, start, end);
    }
    if (!bossCadence[stageId]) bossCadence[stageId] = runBossCadence(stage, seed);
    return {
      stageId,
      mode: mode || 'default',
      profile: profileName(profile),
      xpScale: round((stage.pacing.xpNeedScale || 1) * profile.xpNeedScale),
      bossTimes: Array.isArray(stage.pacing.bossTimes) ? [...stage.pacing.bossTimes] : [...CFG.BOSS_TIMES],
      surge: surgeStats(stage, profile),
      windows: windowRows,
      enemySamples: {
        opening: enemyStats(stage, profile, 0),
        mid: enemyStats(stage, profile, 180),
        late: enemyStats(stage, profile, 540)
      }
    };
  });
  return { seed, powerSample: POWER_SAMPLE, runSeconds: CFG.RUN_SECONDS, variants: rows, bossCadence };
}

if (require.main === module) {
  const arg = process.argv.find(value => value.startsWith('--seed='));
  const seed = arg ? Number(arg.slice('--seed='.length)) : 777;
  if (!Number.isInteger(seed)) throw new Error('seed must be an integer');
  const result = runProbe({ seed });
  const out = path.join(__dirname, '..', 'scratch', 'system-parallel-20261021', 'B', 'pacing-probe-seed-' + seed + '.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
  console.log('WROTE ' + out);
}

module.exports = { runProbe, createRng };
