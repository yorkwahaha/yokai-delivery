const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const {createHash} = require("node:crypto");
const vm = require("node:vm");
const catalog = require("../js/stage58-audio.js");

const game = fs.readFileSync("js/game.js", "utf8");
const audio = fs.readFileSync("js/audio.js", "utf8");

async function harness(available) {
  const players = [];
  const clips = [], requests = [];
  let clock = 0;
  const param = { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} };
  class Audio {
    constructor(src) {
      this.src = src;
      this.paused = true;
      this.readyState = 2;
      this.events = {};
      this.plays = 0;
      players.push(this);
    }
    addEventListener(name, listener) { this.events[name] = listener; }
    play() { this.paused = false; this.plays++; return Promise.resolve(); }
    pause() { this.paused = true; }
    removeAttribute() { delete this.src; }
    load() {}
  }
  const BGM = new Audio("shared-battle"), BOSS_BGM = new Audio("shared-boss");
  class AudioContext {
    state = "running";
    get currentTime() { return clock / 1000; }
    decodeAudioData(path) { return Promise.resolve({ path }); }
    createGain() { return { gain: { ...param }, connect() {} }; }
    createOscillator() { return { frequency: { ...param }, start() {}, stop() {}, connect() {} }; }
    createBufferSource() {
      return { connect() {}, start() { clips.push(this); }, stop() { this.stopped = true; this.onended?.(); } };
    }
  }
  const window = { BGM, BOSS_BGM, AudioContext, STAGE58_AUDIO: catalog, DEV_MODE: { isStageLab: () => true } };
  vm.runInNewContext(audio, { window, Audio, console, setTimeout,
    performance: { now: () => clock },
    AbortController,
    fetch: async (path, options) => {
      requests.push([path, options?.signal]);
      return { ok: true, json: async () => ({ files: available }), arrayBuffer: async () => path };
    } });
  const flush = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
  await flush();
  const tick = state => { clock += 600; window.AUDIO.updateBgm(.6, state, 120, 540); };
  return { AUDIO: window.AUDIO, BGM, BOSS_BGM, tick, players, clips, requests, flush };
}

test("catalog maps each phase to a unique safe MP3 and has four complete stage playlists", () => {
  assert.equal(new Set(catalog.entries.map(row => row.path)).size, catalog.entries.length);
  for (const row of catalog.entries) {
    assert.match(row.path, /^art\/audio\/stage58\/[a-z0-9/_-]+\.mp3$/);
    assert.ok(row.when && row.prompt && row.seconds);
  }
  for (const stage of Object.values(catalog.byStage)) {
    assert.ok(stage.battle && stage.boss && stage.ambience && stage.spawn && stage.shot && stage.death);
  }
  for (const row of catalog.entries.filter(row => row.event.endsWith(".impact") && row.actor !== "kyoto-crow-bell-courier")) {
    assert.ok(catalog.byStage[row.stage][row.event.replace("impact", "warning")]);
  }
});

test("multi-boss cues keep the same song and restore exploration after the last boss", async () => {
  const path = event => catalog.byStage.yomi[event].path;
  const { AUDIO, players, tick } = await harness([path("battle"), path("boss"), path("ambience")]);
  AUDIO.prepareMusic("play", "yomi");
  AUDIO.restartMusic();
  tick("play");
  const battle = players.find(item => item.src === path("battle"));
  assert.ok(battle && !battle.paused);
  AUDIO.stageBossState(true);
  tick("play"); tick("levelup"); tick("charmswap");
  const boss = players.find(item => item.src === path("boss"));
  assert.ok(boss && !boss.paused && battle.paused);
  AUDIO.stageBossState(true);
  tick("pause"); tick("play");
  assert.equal(boss.plays, 1);
  AUDIO.stageBossState(false);
  tick("play"); tick("play");
  assert.ok(boss.paused && !battle.paused);
  const ambience = players.find(item => item.src === path("ambience"));
  assert.ok(ambience && !ambience.paused);
  AUDIO.leaveStageAudio();
  assert.ok([battle, boss, ambience].every(item => item.paused && !item.src));
});

test("missing tracks use shared audio without constructing missing media; failed tracks fall back", async () => {
  const path = catalog.byStage["snow-temple"].boss.path;
  const { AUDIO, BGM, BOSS_BGM, tick, players } = await harness([path]);
  AUDIO.prepareMusic("play", "snow-temple");
  AUDIO.restartMusic();
  tick("play");
  assert.equal(BGM.paused, false);
  AUDIO.stageBossState(true);
  tick("play");
  players.find(item => item.src === path).events.error();
  tick("play"); tick("play");
  assert.equal(BOSS_BGM.paused, false);
  assert.equal(players.length, 3);
});

test("Yomi score starts with the red moon fade and lasts into results", async () => {
  const ending = catalog.byStage.yomi.ending.path;
  const { AUDIO, tick, players } = await harness([ending]);
  AUDIO.prepareMusic("play", "yomi");
  AUDIO.restartMusic();
  assert.equal(AUDIO.startStageEnding(), true);
  tick("victory"); tick("won");
  const track = players.find(player => player.src === ending);
  assert.ok(track && !track.paused && !track.loop);
  assert.match(game, /t >= VICTORY\.dawn[\s\S]{0,120}startStageEnding/);
});

test("warning and impact play independently, repeated shots throttle, and leaving aborts work", async () => {
  const rows = catalog.byStage["snow-temple"];
  const paths = ["frost-bell.warning", "frost-bell.impact", "shot"].map(key => rows[key].path);
  const { AUDIO, tick, clips, requests, flush } = await harness(paths);
  AUDIO.prepareMusic("play", "snow-temple");
  AUDIO.restartMusic();
  tick("play");
  await flush();
  AUDIO.stageLabCue("frost-bell", false);
  AUDIO.stageEncounterCue("snow-temple", "shot");
  AUDIO.stageEncounterCue("snow-temple", "shot");
  await flush();
  assert.deepEqual(clips.map(clip => clip.buffer.path), [paths[0], paths[2]]);
  tick("play");
  AUDIO.stageLabCue("frost-bell", true);
  await flush();
  assert.equal(clips.at(-1).buffer.path, paths[1]);
  AUDIO.leaveStageAudio();
  assert.ok(clips.every(clip => clip.stopped));
  assert.equal(requests.filter(([path]) => paths.includes(path)).length, paths.length);
  assert.ok(requests.filter(([path]) => paths.includes(path)).every(([, signal]) => signal.aborted));
});

test("F9 dedicated grave slash uses both phases, retains serpent sound and falls back to the old cue", async () => {
  const rows=catalog.byStage.yomi;
  const paths=["heavy-slash.warning","heavy-slash.impact","cinder-burst.warning","cinder-burst.impact"].map(key=>rows[key].path);
  const {AUDIO,tick,clips,flush}=await harness(paths);
  AUDIO.prepareMusic("play","yomi"); AUDIO.restartMusic(); tick("play"); await flush();
  AUDIO.stageLabCue("heavy-slash",false); await flush();
  tick("play"); AUDIO.stageLabCue("heavy-slash",true); await flush();
  tick("play"); AUDIO.stageLabCue("cinder-burst",true); await flush();
  assert.deepEqual(clips.map(clip=>clip.buffer.path),[paths[0],paths[1],paths[3]]);
  const fallback=await harness([paths[2]]);
  fallback.AUDIO.prepareMusic("play","yomi"); fallback.AUDIO.restartMusic(); fallback.tick("play"); await fallback.flush();
  fallback.AUDIO.stageLabCue("heavy-slash",false); await fallback.flush();
  assert.equal(fallback.clips.at(-1).buffer.path,paths[2]);
  assert.match(game,/e\.trialBoss\?\.id==="yomi-grave-samurai" && e\.hazard\.art==="cinder-burst"/);
});
test("F9 mud pool cue is optional and repeated emission is throttled", async()=>{
  const file=catalog.byStage["spirit-ferry"]["mud-pool"].path;
  const {AUDIO,tick,clips,flush}=await harness([file]);
  AUDIO.prepareMusic("play","spirit-ferry"); AUDIO.restartMusic(); tick("play"); await flush();
  AUDIO.stageLabCue("mud-pool",true); AUDIO.stageLabCue("mud-pool",true); await flush();
  assert.deepEqual(clips.map(c=>c.buffer.path),[file]);
});
test("review and production file inventory use the same catalog", () => {
  const preview = fs.readFileSync("docs/stage-audio-review/index.html", "utf8");
  assert.match(preview, /stage58-audio\.js/);
  assert.match(preview, /<audio id="audio" controls preload="none">/);
  assert.doesNotMatch(preview, /autoplay/);
  if (!fs.existsSync(catalog.base + "production.json")) return;
  const saved = JSON.parse(fs.readFileSync(catalog.base + "production.json", "utf8"));
  const byPath = new Map(catalog.entries.map(row => [row.path, row]));
  const overPeak = [];
  for (const [file, info] of Object.entries(saved)) {
    assert.ok(byPath.has(file));
    assert.equal(fs.statSync(file).size, info.bytes, file);
    if (info.sha256) assert.equal(createHash("sha256").update(fs.readFileSync(file)).digest("hex"), info.sha256, file);
    assert.ok(info.duration > 0, file);
    if (!(info.peakDbfs < -.5)) overPeak.push(`${file}: ${info.peakDbfs} dBFS`);
  }
  assert.deepEqual(overPeak, [], "Production audio must be below -0.5 dBFS.");
});
