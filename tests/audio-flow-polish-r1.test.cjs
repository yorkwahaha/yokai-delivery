"use strict";

// C票 audio-flow-polish-r1。只載入 js/audio.js 與遊戲沙箱，不讀音檔、KEY、TTS。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { loadGame } = require("./helpers/game-runtime.cjs");

const MODAL_VOLUME = 0.16;
const NORMAL_VOLUME = 0.27;

function loadAudio(windowExtras = {}, extra = {}) {
  const env = {
    window: windowExtras,
    Audio: class Audio {
      addEventListener() {}
      play() { return Promise.resolve(); }
      pause() {}
    },
    console,
    setTimeout,
    clearTimeout,
    ...extra
  };
  env.window = Object.assign(env.window, windowExtras);
  vm.runInNewContext(fs.readFileSync("js/audio.js", "utf8"), env);
  return env.window.AUDIO;
}

function tracks() {
  const make = () => ({
    paused: true,
    volume: NORMAL_VOLUME,
    currentTime: 0,
    playCount: 0,
    play() { this.paused = false; this.playCount++; return Promise.resolve(); },
    pause() { this.paused = true; }
  });
  const bgm = make();
  const map = make();
  const boss = make();
  const audio = loadAudio({ BGM: bgm, MAP_BGM: map, BOSS_BGM: boss });
  return { audio, bgm, map, boss };
}

function playingCount(set) {
  return [set.bgm, set.map, set.boss].filter(track => track && !track.paused).length;
}

test("融合與御守面板只輕度 duck，不暫停、不重播、不重疊", () => {
  const set = tracks();
  const { audio, bgm, map, boss } = set;
  audio.updateBgm(0.016, "play", 40, 600);
  bgm.currentTime = 18;
  const plays = bgm.playCount;
  assert.equal(bgm.paused, false);
  assert.equal(bgm.volume, NORMAL_VOLUME);
  assert.equal(playingCount(set), 1);

  for (const state of ["fusion", "play", "charmswap", "play", "fusion", "charmswap", "play"]) {
    audio.updateBgm(0.016, state, 40, 600);
    assert.equal(bgm.paused, false, state);
    assert.equal(bgm.playCount, plays, state);
    assert.equal(bgm.currentTime, 18, state);
    assert.equal(map.paused, true, state);
    assert.equal(boss.paused, true, state);
    assert.equal(map.playCount, 0, state);
    assert.equal(boss.playCount, 0, state);
    assert.equal(playingCount(set), 1, state);
  }
  assert.equal(bgm.volume, NORMAL_VOLUME);
  audio.updateBgm(0.016, "fusion", 40, 600);
  assert.equal(bgm.volume, MODAL_VOLUME);
  audio.updateBgm(0.016, "charmswap", 40, 600);
  assert.equal(bgm.volume, MODAL_VOLUME);
  audio.updateBgm(0.016, "levelup", 40, 600);
  assert.equal(bgm.paused, false);
  assert.equal(bgm.volume, NORMAL_VOLUME);
  audio.updateBgm(0.016, "pause", 40, 600);
  assert.equal(bgm.paused, false);
  assert.equal(bgm.volume, 0.055);
  audio.updateBgm(0.016, "play", 40, 600);
  assert.equal(bgm.volume, NORMAL_VOLUME);
  assert.equal(bgm.playCount, plays);
});

test("Boss 交叉淡出中開關融合面板不把音量打回 0，也不重播兩軌", () => {
  const { audio, bgm, map, boss } = tracks();
  audio.updateBgm(0.01, "play", 0, 600);
  audio.startBossMusic();
  audio.updateBgm(0.22, "play", 100, 600);
  assert.equal(bgm.paused, false);
  assert.equal(boss.paused, false);
  assert.equal(map.paused, true);
  bgm.currentTime = 9;
  boss.currentTime = 5;
  const bgmPlays = bgm.playCount;
  const bossPlays = boss.playCount;
  const bossVolume = boss.volume;
  assert.ok(bossVolume > 0);
  audio.updateBgm(0.016, "fusion", 100, 600);
  audio.updateBgm(0.016, "charmswap", 100, 600);
  audio.updateBgm(0.016, "play", 100, 600);
  assert.equal(bgm.paused, false);
  assert.equal(boss.paused, false);
  assert.equal(map.paused, true);
  assert.equal(bgm.playCount, bgmPlays);
  assert.equal(boss.playCount, bossPlays);
  assert.equal(bgm.currentTime, 9);
  assert.equal(boss.currentTime, 5);
  assert.ok(boss.volume > 0);
  assert.ok(boss.volume < NORMAL_VOLUME);
});

test("沒有音檔時，融合與換守面板仍推進程序 BGM，不會把循環停死", () => {
  let starts = 0;
  const param = () => ({
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
    value: 0
  });
  class AudioContext {
    constructor() {
      this.currentTime = 0;
      this.sampleRate = 8000;
      this.state = "running";
      this.destination = {};
    }
    createOscillator() {
      return { type: "", frequency: param(), connect() {}, start() { starts++; }, stop() {} };
    }
    createGain() { return { gain: param(), connect() {} }; }
    createBiquadFilter() { return { type: "", frequency: param(), connect() {} }; }
    createBufferSource() { return { connect() {}, start() { starts++; } }; }
    createBuffer() { return { getChannelData: () => new Float32Array(320) }; }
    resume() { return Promise.resolve(); }
  }
  const audio = loadAudio({ AudioContext });
  const pump = state => {
    const before = starts;
    for (let i = 0; i < 4; i++) audio.updateBgm(0.4, state, 10, 600);
    return starts - before;
  };
  assert.ok(pump("play") > 0, "play 應開始程序循環");
  assert.ok(pump("fusion") > 0, "融合面板期間循環要繼續");
  assert.ok(pump("charmswap") > 0, "換守面板期間循環要繼續");
  assert.ok(pump("play") > 0, "關閉面板後循環要恢復");
});

test("死亡淡出後取消或重開能恢復，過期的淡出計時不會再停音", async () => {
  const { audio, bgm, map, boss } = tracks();
  audio.updateBgm(0.016, "play", 20, 600);
  audio.updateBgm(0.016, "fusion", 20, 600);
  assert.equal(bgm.volume, MODAL_VOLUME);
  const plays = bgm.playCount;
  audio.fadeOutMusic(0);
  audio.updateBgm(0.016, "lampout", 20, 600);
  assert.equal(bgm.playCount, plays, "燈油耗盡不另起一軌");
  audio.prepareMusic("play");
  audio.restartMusic();
  audio.updateBgm(0.016, "play", 0, 600);
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(bgm.paused, false);
  assert.equal(bgm.volume, NORMAL_VOLUME);
  assert.equal(map.paused, true);
  assert.equal(boss.paused, true);
  assert.equal([bgm, map, boss].filter(track => !track.paused).length, 1);

  audio.fadeOutMusic(0);
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(bgm.paused, true, "淡出結束後結果畫面保持安靜");
  audio.prepareMusic("play");
  audio.restartMusic();
  audio.updateBgm(0.016, "play", 0, 600);
  assert.equal(bgm.paused, false);
  assert.equal(bgm.volume, NORMAL_VOLUME);
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(bgm.paused, false, "舊淡出計時不得再次停掉新的一局");
});

function watchAudio(probe) {
  const log = [];
  probe.env.AUDIO = new Proxy({}, {
    get: (_target, name) => (...args) => {
      log.push(name === "updateBgm" ? args[1] : String(name));
    }
  });
  return log;
}

function press(probe, event) {
  probe.events.keydown(Object.assign({
    repeat: false,
    preventDefault() {},
    target: null
  }, event));
}

function queueRandom(probe, values) {
  let i = 0;
  probe.env.Math.random = () => (i < values.length ? values[i++] : 0.99);
}

function kill(probe, type, roll) {
  const here = probe.snapshot();
  queueRandom(probe, roll);
  probe.hurt({
    x: here.x,
    y: here.y,
    hp: 1,
    max: 1,
    type,
    shield: false
  }, 5);
}

function pickupLatest(probe) {
  const drops = probe.env.OMAMORI_CORE.drops();
  assert.ok(drops.length >= 1);
  const drop = drops[drops.length - 1];
  probe.placeAt(drop.x, drop.y);
  queueRandom(probe, []);
  probe.update(0.05);
}

test("融合與御守面板可取消、選擇、死亡後回到可跑的局，且不重啟 BGM", () => {
  const probe = loadGame({ seed: 1 });
  probe.startRun("night-town");
  const log = watchAudio(probe);

  probe.setState("charmswap");
  probe.stepFrame(16);
  assert.equal(probe.snapshot().state, "play", "沒有待換御守時不得卡在換守");

  probe.setState("fusion");
  probe.stepFrame(16);
  assert.equal(probe.snapshot().state, "play", "融合模組不在確認中時不得卡在面板");

  let phase = "disabled";
  probe.env.FUSION = {
    getState: () => ({ state: phase }),
    getViewModel: () => ({}),
    cancelFusion() { phase = "held"; return true; }
  };
  phase = "confirming";
  log.length = 0;
  probe.setState("fusion");
  probe.stepFrame(16);
  assert.equal(probe.snapshot().state, "fusion");
  assert.ok(log.includes("fusion"));
  assert.equal(log.includes("restartMusic"), false);
  assert.equal(log.includes("fadeOutMusic"), false);
  assert.equal(log.includes("stopBossMusic"), false);
  phase = "held";
  probe.stepFrame(16);
  assert.equal(probe.snapshot().state, "play", "確認結束後主循環要回到 play");
  phase = "disabled";

  for (const roll of [0, 0.2, 0.4]) {
    kill(probe, "ghost", [0, roll]);
    pickupLatest(probe);
  }
  kill(probe, "ghost", [0, 0.5]);
  pickupLatest(probe);
  assert.equal(probe.snapshot().state, "charmswap");
  log.length = 0;
  probe.stepFrame(16);
  assert.equal(probe.snapshot().state, "charmswap");
  assert.ok(log.includes("charmswap"));
  assert.equal(log.includes("restartMusic"), false);
  assert.equal(log.includes("fadeOutMusic"), false);
  press(probe, { code: "Escape", key: "Escape" });
  assert.equal(probe.snapshot().state, "play");

  kill(probe, "ghost", [0, 0.5]);
  pickupLatest(probe);
  assert.equal(probe.snapshot().state, "charmswap");
  press(probe, { code: "Enter", key: "Enter" });
  assert.equal(probe.snapshot().state, "play", "選定替換後要離開面板");

  log.length = 0;
  probe.setOil(0);
  probe.update(0.05);
  assert.equal(probe.snapshot().state, "lampout");
  assert.ok(log.includes("fadeOutMusic"));
  probe.startRun("night-town");
  assert.equal(probe.snapshot().state, "play");
  assert.ok(log.includes("restartMusic"));
  assert.equal(probe.snapshot().state === "charmswap" || probe.snapshot().state === "fusion", false);
});
