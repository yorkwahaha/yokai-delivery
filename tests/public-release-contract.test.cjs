'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const { loadGame } = require('./helpers/game-runtime.cjs');

const publicLocation = { hostname: 'yorkwahaha.github.io', pathname: '/yokai-delivery/',
  search: '?dev=1&stageLab=1&fusionlab=1&skillLab=expansion&draft=guided&stage=yomi&u1scroll=1',
  hash: '#u1scroll' };
const paths = require('../docs/STAGE_PATHS.json');
const stages = paths.stages.map(row => row.id);
const expansion = require('../js/game-skill-expansion.js');
const catalog = require('../js/stage58-audio.js');
const source = file => fs.readFileSync(file, 'utf8');

test('public hostname keeps private query and hash switches disabled on the official save', () => {
  const game = loadGame({ location: publicLocation });
  const { DEV_MODE, CONTENT } = game.env;
  assert.equal(DEV_MODE.sessionKey(publicLocation), 'yokai-delivery-v1');
  assert.equal(DEV_MODE.isStageLab(publicLocation), false);
  assert.equal(DEV_MODE.isFusionLab(publicLocation), false);
  assert.equal(DEV_MODE.requestedStage(publicLocation, game.env.OVERWORLD.nodes, CONTENT.getStage), null);
  assert.equal(expansion.guidedDraft({ DEV_MODE, location: publicLocation }), false);
  assert.equal(!!game.env.U1_EMAKI_PREVIEW, false);
  assert.equal(game.store().isActiveSkillUnlocked('shikigami'), true);
  assert.deepEqual(stages.filter(id => game.store().isStageUnlocked(id)), ['night-town']);
  const local = loadGame({ location: { hostname: '127.0.0.1', search: '?dev=1', hash: '#u1scroll' } });
  assert.equal(local.env.U1_EMAKI_PREVIEW, true);
});

test('all seven additional skills are available in a fresh public save, without stage unlocks or forced introductions', () => {
  const game = loadGame({ location: publicLocation, seed: 1521 });
  const store = game.store();
  const extra = ['ink_trail','seal_nail','shikigami',...expansion.ids];
  for (const id of extra) {
    assert.equal(store.isActiveSkillUnlocked(id), true, id);
    assert.equal(store.activeSkillClearStage(id), null);
  }
  assert.equal(store.pendingSkillIntroduction(), null);
  assert.deepEqual(stages.filter(id => store.isStageUnlocked(id)), ['night-town']);
  assert.equal(store.isStageCompleted('night-town'), false);
  game.startRun('night-town');
  game.stopSpawns();
  assert.equal(game.weaponLevels().katana, 1);
  const rules = game.env.GAME_UPGRADE_CHOICES;
  let pool, forced = 0;
  game.env.GAME_UPGRADE_CHOICES = {...rules, orderWeapons(keys, levels, slots, random, weight) {
    pool = Array.from(keys);
    for (const id of pool.filter(id => id !== 'katana')) assert.equal(rules.weaponOfferWeight(id, levels, slots), 2.4);
    return rules.orderWeapons(keys, levels, slots, random, weight);
  }, withGuarantees(...args) { forced++; return rules.withGuarantees(...args); },
     withNewSkillVisibility(...args) { forced++; return rules.withNewSkillVisibility(...args); }};
  game.offerUp();
  assert.equal(pool.length, 13);
  assert.ok(extra.every(id => pool.includes(id)));
  assert.equal(forced, 0);
  game.env.GAME_UPGRADE_CHOICES = rules;
  game.startRun('night-town');
  for (const id of ['fire','needle','wind_hole']) game.setWeaponRank(id,1);
  game.offerUp();
  assert.ok(!game.currentChoices().some(card => card.type === 'weapon' && card.lv === 1));
});

test('actual first-stage draft can offer and acquire every unowned active skill without forced cards', () => {
  const seen = new Set(), acquired = new Set();
  const location = {hostname:'yorkwahaha.github.io',pathname:'/yokai-delivery/',search:''};
  for (let seed = 1; seed <= 128; seed++) {
    const game = loadGame({location, seed});
    game.startRun('night-town');
    game.stopSpawns();
    game.offerUp();
    const cards = game.currentChoices();
    assert.ok(cards.length > 0 && cards.length <= 3);
    assert.equal(new Set(cards.map(c => c.choiceId)).size, cards.length);
    for (const card of cards) {
      assert.notEqual(card.type, 'fusion');
      if (card.type === 'weapon' && card.lv === 1) seen.add(card.id);
    }
    const index = cards.findIndex(card => card.type === 'weapon' && card.lv === 1 && !acquired.has(card.id));
    if (index !== -1) {
      game.finishDraftImmediately();
      assert.equal(game.takeLevelUpChoice(index).ok, true);
      assert.equal(game.weaponLevels()[cards[index].id], 1);
      game.update(.05);
      acquired.add(cards[index].id);
    }
    assert.equal(game.store().isStageCompleted('night-town'),false);
  }
  const expected = ['barrier','fire','boom','thunder','needle','ink_trail','seal_nail','shikigami',...expansion.ids].sort();
  assert.deepEqual([...seen].sort(), expected);
  assert.deepEqual([...acquired].sort(), expected);
});

test('a public skill is never forced into the offer after five or more misses', () => {
  const game = loadGame({ location: publicLocation, seed: 5299 });
  game.startRun('night-town');
  game.stopSpawns();
  game.setWeaponRank('fire', 1);
  game.setWeaponRank('needle', 1);
  const rules = game.env.GAME_UPGRADE_CHOICES;
  game.env.GAME_UPGRADE_CHOICES = { ...rules, assemble(awaken, fusion, weapons, charms, duos, passives, mutations, shuffle) {
    return rules.assemble(awaken, fusion, weapons.filter(card => card.id !== 'hamaya'), charms, duos, passives, mutations, shuffle);
  } };
  for (let round = 1; round <= 8; round++) {
    game.offerUp();
    const cards = game.currentChoices();
    assert.ok(!cards.some(card => card.id === 'hamaya'));
    const safe = cards.findIndex(card => card.type !== 'weapon' || game.weaponLevels()[card.id] > 0);
    assert.ok(safe >= 0);
    game.finishDraftImmediately();
    assert.equal(game.takeLevelUpChoice(safe).ok, true);
  }
});

test('public Lv5 white and black wolves have raster idle, movement, bites and both transition effects', () => {
  const requested = [];
  class Image {
    naturalWidth = 512;
    naturalHeight = 352;
    set src(path) { this.path = path; requested.push(path); }
  }
  const host = { window: { Image, location: publicLocation, DEV_MODE: require('../js/dev-mode.js') } };
  vm.runInNewContext(source('js/game-shikigami.js'), host);
  const shiki = host.window.GAME_SHIKIGAMI;
  assert.equal(shiki.CARD.artPath, 'assets/img/skills/shikigami/cards/shikigami__card.webp');
  const art = shiki.loadArt('hound');
  shiki.loadBlackArt(art);
  shiki.loadBlackArt(art);
  assert.equal(requested.length, 25);
  const skill = shiki.create({ species: 'hound' });
  const player = { x: 0, y: 0 };
  const env = { level: 5, player, enemies: [], effectiveDamage: 1 };
  skill.tick({ dt:.01, ...env });
  assert.equal(skill.bodies().length, 2);
  const painted = [];
  const ctx = { globalAlpha: 1, save() {}, restore() {}, translate() {}, scale() {},
    drawImage(sprite) { painted.push(sprite.path); } };
  for (const pose of [...skill.bodies(), ...skill.effects()]) skill.paint(ctx, art, 1, pose);
  assert.match(painted[0], /hound-idle/);
  assert.match(painted[1], /black-idle/);
  assert.deepEqual(painted.slice(2), [art.summon.path, art.summon.path]);
  for (const pose of skill.bodies()) skill.paint(ctx, art, 1, { ...pose, walkTime: .2 });
  assert.match(painted.at(-2), /hound-run/);
  assert.match(painted.at(-1), /black-run/);
  for (const pose of skill.bodies()) skill.paint(ctx, art, 1, { ...pose, biteRemaining: .6 });
  assert.match(painted.at(-2), /white-bite/);
  assert.match(painted.at(-1), /black-bite/);
  const victim = skill.bodies()[1];
  skill.receiveEnemyAttack({ type: 'ghost' }, 999, null, { projectile: true, target: victim });
  skill.paint(ctx, art, 1, skill.effects().find(pose => pose.kind === 'vanish'));
  assert.equal(painted.at(-1), art.vanish.path);
  for (const file of [...requested, shiki.CARD.artPath]) assert.ok(fs.statSync(file).size > 0, file);
});

test('eight stages have public canonical scene and vocabulary media and only public fonts are cached', () => {
  const game = loadGame({ location: publicLocation });
  const worker = source('service-worker.js');
  const revisions = vm.runInNewContext(worker.slice(0, worker.indexOf('const CACHE_NAME')) + '\nMEDIA_REVISIONS');
  for (const row of paths.stages) {
    assert.equal(game.env.CONTENT.getStage(row.id).mapReleased, true);
    assert.ok(fs.existsSync(row.runtime), row.runtime);
    if (row.public_manifest) {
      const manifest = JSON.parse(source(row.public_manifest));
      assert.ok(manifest.assets.length > 0, row.id);
      for (const asset of manifest.assets) {
        assert.equal(revisions[asset.path], asset.sha256.slice(0, 24), asset.path);
      }
    }
    const words = game.env.CONTENT.getStageWords(row.id);
    assert.equal(words.length, row.id === 'yomi' ? 140 : 20);
    for (const word of words) for (const kind of ['image', 'audio']) {
      const file = game.env.DELIVERY_MEDIA.pathForWord(kind, word.jp);
      assert.ok(file?.startsWith('assets/'), word.jp);
      assert.ok(revisions[file], file);
    }
  }
  assert.equal(Object.keys(revisions).filter(path => path.endsWith('.woff2')).length, 5);
  assert.ok(revisions['assets/fonts/YokaiTrialMoonStarsKaiT-Regular.woff2']);
  assert.ok(!Object.keys(revisions).some(path => /HanWang|Bakudai|^art\//.test(path)));
});

function audioFixture({ mediaSourceUnavailable = false } = {}) {
  const tracks = [], nodes = new Map(), decoded = [];
  let contexts = 0, sourceAttempts = 0, allowResume = false;
  class Track {
    constructor(src) { this.src = src; this.paused = true; this.volume = 1; this.readyState = 4; this.plays = 0; tracks.push(this); }
    play() { this.plays++; this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
    addEventListener() {}
    removeAttribute() { delete this.src; }
    load() {}
  }
  const node = () => ({ gain: { value: 1 }, connect(target) { this.target = target; }, disconnect() { this.target = null; } });
  class Context {
    constructor() { contexts++; }
    state = 'suspended';
    destination = {};
    createGain = node;
    createMediaElementSource(track) {
      sourceAttempts++;
      if (mediaSourceUnavailable) throw new Error('media graph unavailable');
      assert.ok(!nodes.has(track), 'only one source per media element');
      const source = node();
      nodes.set(track, source);
      return source;
    }
    resume() {
      if (!allowResume) return Promise.reject(new Error('needs a user gesture'));
      this.state = 'running';
      return Promise.resolve();
    }
    suspend() { this.state = 'suspended'; return Promise.resolve(); }
    decodeAudioData(path) { decoded.push(path); return Promise.resolve({ path }); }
    createBufferSource() { return { ...node(), start() {}, stop() { this.onended?.(); } }; }
  }
  const window = { location: publicLocation, CONTENT: { getStage: () => ({ mapReleased: true }) },
    STAGE58_AUDIO: catalog, AudioContext: Context, BGM: new Track('fallback-battle'),
    BOSS_BGM: new Track('fallback-boss'), MAP_BGM: new Track('map'),
    DELIVERY_FISH_AUDIO: { pathFor: key => `assets/audio/delivery/${key}.mp3` } };
  const env = { window, Audio: Track, setTimeout, clearTimeout, AbortController,
    fetch: async key => ({ ok: true, arrayBuffer: async () => key }) };
  vm.runInNewContext(source('js/audio.js'), env);
  const audio = window.AUDIO;
  return { audio, window, tracks, nodes, decoded, contexts: () => contexts, sourceAttempts: () => sourceAttempts,
    allow: () => { allowResume = true; },
    flush: () => new Promise(resolve => setImmediate(resolve)) };
}

test('mute, late AudioContext attachment, ducking, resume, replay and stage release share one BGM graph', async () => {
  const h = audioFixture();
  const { audio, tracks, nodes, window } = h;
  audio.toggleMute();
  audio.prepareMusic('play', 'night-town');
  audio.restartMusic();
  audio.updateBgm(.05, 'play', 0, 600);
  const first = window.BGM;
  assert.equal(first.paused, true);
  assert.equal(nodes.size, 0);
  audio.toggleMute();
  audio.updateBgm(.05, 'play', 0, 600);
  assert.equal(first.paused, false);
  assert.ok(!nodes.has(first));
  h.allow();
  audio.unlockFromInput();
  await h.flush();
  const gain = nodes.get(first).target.gain;
  assert.equal(gain.value, .27);
  assert.equal(first.volume, 1);
  assert.equal(first.plays, 1);
  audio.speak('test');
  assert.equal(gain.value, .10);
  audio.stopSpeech();
  assert.equal(gain.value, .27);
  audio.updateBgm(.05, 'pause', 1, 600);
  assert.equal(gain.value, .055);
  audio.setSuspended(true);
  assert.equal(first.paused, true);
  audio.unlockFromInput();
  audio.updateBgm(.05, 'play', 1, 600);
  assert.equal(gain.value, .27);
  assert.equal(first.paused, false);
  audio.prepareMusic('play', 'night-town');
  audio.restartMusic();
  assert.equal(window.BGM, first);
  audio.prepareMusic('play', 'hyakki-kyoto');
  audio.restartMusic();
  audio.updateBgm(.2, 'play', 2, 600);
  const kyoto = tracks.find(track => track.src?.endsWith('hyakki-kyoto__battle.mp3'));
  assert.ok(nodes.get(kyoto).target.gain.value > 0);
  assert.equal(first.src, undefined);
  assert.equal(nodes.get(first).target, null);
  audio.leaveStageAudio();
  audio.prepareMusic('overworld');
  audio.restartMusic();
  assert.equal(kyoto.src, undefined);
  assert.equal(window.MAP_BGM.paused, false);
  assert.ok(nodes.has(window.MAP_BGM));
  assert.equal(h.contexts(), 1);
});

test('a rejected media source keeps native audio playable without retrying the graph every frame', () => {
  const h = audioFixture({ mediaSourceUnavailable: true });
  h.allow();
  h.audio.unlockFromInput();
  h.audio.prepareMusic('play', 'rain-port');
  h.audio.restartMusic();
  for (let frame = 0; frame < 10; frame++) h.audio.updateBgm(.016, 'play', 1, 600);
  assert.equal(h.window.BGM.paused, false);
  assert.equal(h.window.BGM.volume, .27);
  assert.equal(h.window.BGM.plays, 1);
  assert.equal(h.sourceAttempts(), 1);
});

test('delivery voice cache retains 32 recent clips and never evicts the current source', async () => {
  const h = audioFixture();
  h.allow();
  h.audio.unlockFromInput();
  for (let i = 0; i < 40; i++) {
    h.audio.speak(String(i));
    await h.flush();
    h.audio.stopSpeech();
  }
  h.audio.speak('8');
  await h.flush();
  assert.equal(h.decoded.length, 40);
  h.audio.speak('7');
  await h.flush();
  assert.equal(h.decoded.length, 41);
  assert.match(h.decoded.at(-1), /\/7\.mp3$/);
});

test('FFmpeg EBU R128: eight stage pairs stay within 1 LU at play gain with at least 1 dBTP headroom', () => {
  function measure(file) {
    const run = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=true',
      '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, windowsHide: true });
    assert.ifError(run.error);
    assert.equal(run.status, 0, file);
    const summary = run.stderr.slice(run.stderr.lastIndexOf('Summary:'));
    return { lufs: Number(/I:\s+(-?[\d.]+) LUFS/.exec(summary)?.[1]),
      peak: Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(summary)?.[1]) };
  }
  const h = audioFixture();
  for (const [i, stage] of stages.entries()) {
    h.audio.prepareMusic('play', stage);
    h.audio.restartMusic();
    h.audio.updateBgm(.05, 'play', 0, 600);
    const battle = h.tracks.find(track => !track.paused && track.src?.includes(`/${stage}/`));
    const battleGain = battle.volume;
    if (i < 4) h.audio.startBossMusic();
    else h.audio.stageBossState(true);
    h.audio.updateBgm(1.2, 'play', 240, 600);
    const boss = h.tracks.find(track => !track.paused && track.src?.endsWith(`/${stage}__boss.mp3`));
    const battleMeasure = measure(battle.src);
    const bossMeasure = measure(boss.src);
    const battleDB = 20 * Math.log10(battleGain);
    const bossDB = 20 * Math.log10(boss.volume);
    const difference = bossMeasure.lufs + bossDB - battleMeasure.lufs - battleDB;
    assert.ok(Math.abs(difference) <= 1, `${stage}: ${difference} LU`);
    assert.ok(Math.max(battleMeasure.peak + battleDB, bossMeasure.peak + bossDB) <= -1, stage);
  }
});
