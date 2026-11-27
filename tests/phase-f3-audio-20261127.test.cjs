const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const expansion = require("../js/game-skill-expansion.js");

const audioSource = fs.readFileSync("js/audio.js", "utf8");
const kyotoArtSource = fs.readFileSync("js/kyoto-scene-art.js", "utf8");
const snowArtSource = fs.readFileSync("js/snow-temple-art.js", "utf8");

function makeAudioHarness(extraWindow = {}, fetchFiles = []) {
  const players = [], clips = [];
  let clock = 0;
  const param = { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} };
  class Audio {
    constructor(src) {
      this.src = src;
      this.paused = true;
      this.readyState = 2;
      this.volume = 0;
      this.currentTime = 0;
      this.plays = 0;
      this.events = {};
      players.push(this);
    }
    addEventListener(name, fn) { this.events[name] = fn; }
    play() { this.paused = false; this.plays++; return Promise.resolve(); }
    pause() { this.paused = true; }
    load() {}
    removeAttribute() { delete this.src; }
  }
  class AudioContext {
    state = "running";
    get currentTime() { return clock / 1000; }
    decodeAudioData(path) { return Promise.resolve({ path }); }
    createGain() { return { gain: { ...param }, connect() {} }; }
    createOscillator() { return { frequency: { ...param }, start() {}, stop() {}, connect() {} }; }
    createBufferSource() {
      return {
        connect() {},
        start() { clips.push(this); },
        stop() { this.stopped = true; this.onended?.(); }
      };
    }
  }
  const BGM = new Audio("assets/audio/bgm/stages/night-town/night-town__battle.mp3");
  const MAP_BGM = new Audio("assets/audio/bgm/overworld/overworld__map.mp3");
  const BOSS_BGM = new Audio("assets/audio/bgm/boss/boss__encounter.mp3");
  const win = { BGM, MAP_BGM, BOSS_BGM, AudioContext, ...extraWindow };
  vm.runInNewContext(audioSource, {
    window: win, Audio, console, setTimeout, clearTimeout,
    performance: { now: () => clock },
    fetch: async path => {
      if (String(path).includes("files.json")) return { ok: true, json: async () => ({ files: fetchFiles }) };
      return { ok: true, arrayBuffer: async () => path };
    }
  });
  const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
  return { AUDIO: win.AUDIO, BGM, MAP_BGM, BOSS_BGM, players, clips, win, flush, advance: ms => { clock += ms; } };
}

test("F3-B: Stage 1-4 independent Boss BGM slots fall back cleanly without missing requests and route when provided", async () => {
  const expected = {
    "night-town": "assets/audio/bgm/stages/night-town/night-town__boss.mp3",
    "rain-port": "assets/audio/bgm/stages/rain-port/rain-port__boss.mp3",
    "sakura-pass": "assets/audio/bgm/stages/sakura-pass/sakura-pass__boss.mp3",
    "bamboo-maze": "assets/audio/bgm/stages/bamboo-maze/bamboo-maze__boss.mp3"
  };

  // 1. Missing independent Boss BGM: stays on shared BOSS_BGM with zero missing Audio instances
  const h1 = makeAudioHarness();
  assert.deepEqual({ ...h1.AUDIO.STAGE_BOSS_BGM_FILES }, expected);
  h1.AUDIO.prepareMusic("play", "rain-port");
  h1.AUDIO.restartMusic();
  h1.AUDIO.prepareBossMusic();
  h1.AUDIO.startBossMusic();
  h1.AUDIO.updateBgm(0.6, "play", 180, 540);
  h1.AUDIO.updateBgm(0.6, "play", 181, 540);
  assert.equal(h1.BOSS_BGM.paused, false);
  assert.equal(h1.players.some(p => p.src === expected["rain-port"]), false);

  // 2. Multi-boss does not restart Boss BGM; pause ducks; stopBossMusic halts cleanly
  const playsBefore = h1.BOSS_BGM.plays;
  h1.AUDIO.startBossMusic();
  h1.AUDIO.updateBgm(0.2, "play", 182, 540);
  assert.equal(h1.BOSS_BGM.plays, playsBefore);
  h1.AUDIO.updateBgm(0.2, "pause", 182, 540);
  assert.equal(h1.BOSS_BGM.paused, false);
  h1.AUDIO.stopBossMusic();
  assert.equal(h1.BOSS_BGM.paused, true);

  // 3. When independent file is provided, routes to stage-specific Boss BGM and falls back on error
  const h2 = makeAudioHarness({ STAGE_BOSS_BGM_AVAILABLE: ["sakura-pass"] });
  h2.AUDIO.prepareMusic("play", "sakura-pass");
  h2.AUDIO.restartMusic();
  h2.AUDIO.prepareBossMusic();
  h2.AUDIO.startBossMusic();
  h2.AUDIO.updateBgm(0.6, "play", 180, 540);
  const custom = h2.players.find(p => p.src === expected["sakura-pass"]);
  assert.ok(custom && !custom.paused);
  assert.equal(h2.BOSS_BGM.paused, true);
  // Error on custom Boss BGM seamlessly recovers to shared BOSS_BGM without silence
  custom.events.error();
  h2.AUDIO.updateBgm(0.6, "play", 181, 540);
  assert.equal(custom.paused, true);
  assert.equal(h2.BOSS_BGM.paused, false);
});

test("F3-D & F3-E: all 14 expansion skill SFX exist, route via playExpansionCue, throttle repeats, and cap voices", async () => {
  const entries = Object.values(expansion.sfxCatalog);
  assert.equal(entries.length, 14);
  for (const spec of entries) {
    assert.ok(fs.existsSync(spec.path) && fs.statSync(spec.path).size > 1000, spec.path);
  }

  // Real Web Audio harness: suction replaces single voice, silk cut throttles, total voices capped
  const h = makeAudioHarness();
  assert.equal(expansion.playCue(h.AUDIO, "wind_hole", "suction", 1.0), true);
  assert.equal(expansion.playCue(h.AUDIO, "wind_hole", "suction", 1.1), false); // throttled (<700ms)
  assert.equal(expansion.playCue(h.AUDIO, "wind_hole", "suction", 2.0), true);
  await h.flush();
  // First suction voice was replaced/stopped; never accumulates per-enemy instances
  const activeSuction = h.clips.filter(c => c.buffer.path.endsWith("wind-hole__suction.mp3") && !c.stopped);
  assert.equal(activeSuction.length, 1);

  // Silk cut spam over 16 ticks inside 150ms plays at most once
  let cutAllowed = 0;
  for (let i = 0; i < 16; i++) {
    if (expansion.playCue(h.AUDIO, "spider_silk", "cut", 5.0 + i * 0.01)) cutAllowed++;
  }
  assert.equal(cutAllowed, 1);

  // Fallback boomerang throttle when playExpansionCue is absent
  let boomCalls = 0;
  const mockFallbackAudio = { boomerang() { boomCalls++; }, impact() {} };
  expansion.playCue(mockFallbackAudio, "hamaya", "release", 10.00);
  expansion.playCue(mockFallbackAudio, "hamaya", "release", 10.05); // within 110ms throttle
  expansion.playCue(mockFallbackAudio, "hamaya", "release", 10.15); // after 110ms
  assert.equal(boomCalls, 2);
});

test("F3-C: Stage 5/6 third bosses preserve separated IDs with explicit audioId routing", () => {
  assert.match(kyotoArtSource, /id:\s*"kyoto-crossroads-boss"[\s\S]{0,120}audioId:\s*"kyoto-taiko-warden"/);
  assert.match(snowArtSource, /id:\s*"snow-ice-pillar-boss"[\s\S]{0,160}audioId:\s*"snow-frost-bell-guardian"/);
});
