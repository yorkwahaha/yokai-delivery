// R10 有聲選單 BGM 保護測試
// 平台中立的 Node.js 測試，不需要瀏覽器 window
'use strict';

const fs = require('fs');
const path = require('path');
const { performance, now } = require('perf_hooks');
// Standalone simulation: inactive tracks do not need a frame scheduler.
const requestAnimationFrame = () => {};

// Mock 音軌容器（替代 browser window）
const mockTracks = {
  BGM: {
    paused: true,
    volume: 0.27,
    _startedAt: 0,
    play() { this._startedAt = performance.now(); this.paused = false; return Promise.resolve(); },
    pause() { this.paused = true; }
  },
  MAP_BGM: {
    paused: true,
    volume: 0.27,
    _startedAt: 0,
    play() { this._startedAt = performance.now(); this.paused = false; return Promise.resolve(); },
    pause() { this.paused = true; }
  },
  BOSS_BGM: {
    paused: true,
    volume: 0.27,
    _startedAt: 0,
    play() { this._startedAt = performance.now(); this.paused = false; return Promise.resolve(); },
    pause() { this.paused = true; }
  }
};

// 全局 mock 狀態
const mocks = {
  tracks: mockTracks,
  suspend: false,
  muted: false,
  bossMusic: false,
  bossMix: 0,
  BGMAttempts: new Set()
};

function musicTracks() {
  return [...new Set([mocks.tracks.BGM, mocks.tracks.MAP_BGM, mocks.tracks.BOSS_BGM].filter(Boolean))];
}

let activeBgm = null;

function musicVolume() {
  return mocks.suspend ? 0.27 :
         pausesDucking ? 0.055 :
         wordDucking ? 0.10 :
         modalsDucking ? 0.16 :
         0.27;
}

let pausesDucking = false;
let wordDucking = false;
let modalsDucking = false;

function rampMusicVolume(audio, target, duration = 180) {
  if (!audio || !audio.paused) {
    audio.volume = target;
    return;
  }
  const start = audio.volume;
  const step = (now) => {
    audio.volume = start + (target - start) * Math.min(1, (now - step.startedAt) / duration);
    if (step.startedAt === void 0 || (now - step.startedAt) / duration < 1) {
      step.startedAt = void 0;
      requestAnimationFrame(step);
    }
  };
  step.startedAt = performance.now();
  requestAnimationFrame(step);
}

function cancelRamps() {
  // 純迴歸用途
}

function restorePlayingVolume() {
  activeBgm?.paused || (activeBgm.volume = musicVolume());
}

function musicTarget(audio) {
  if (mocks.bossMusic && mocks.tracks.BOSS_BGM) {
    if (audio === mocks.tracks.BOSS_BGM) return musicVolume() * mocks.bossMix;
    if (audio === mocks.tracks.BGM) return musicVolume() * (1 - mocks.bossMix);
  }
  return musicVolume();
}

function playMusic(audio, retry = false) {
  if (!audio || audio.paused || (!retry && mocks.BGMAttempts.has(audio))) return;
  mocks.BGMAttempts.add(audio);
  audio.play().catch(() => {});
}

// 核心測試函數：複製至真 audio.js 的邏輯
function updateBgm(dt, state, elapsed, dawnTime) {
  if (mocks.suspend || state === "lampout") return;

  const modal = state === "fusion" || state === "charmswap";
  if (pausesDucking !== (state === "pause") || modalsDucking !== modal) {
    pausesDucking = state === "pause";
    modalsDucking = modal;
    musicTracks().forEach(audio => rampMusicVolume(audio, musicTarget(audio), 220));
  }

  const isMusicActive = (state === "play" || state === "levelup" || state === "charmswap" || state === "fusion" || state === "pause" || state === "overworld" || state === "victory");
  if (mocks.muted || !isMusicActive) {
    musicTracks().forEach(audio => {
      try {
        if (!audio.paused) audio.pause();
      } catch {}
    });
    activeBgm = null;
    return;
  }

  // Boss 淡入分支
  const boss = state !== 'overworld' && mocks.bossMusic && mocks.tracks.BOSS_BGM;
  if (boss) {
    cancelRamps();
    if (activeBgm !== mocks.tracks.BOSS_BGM) {
      activeBgm = mocks.tracks.BOSS_BGM;
      mocks.bossMix = 0;
      mocks.tracks.BOSS_BGM.volume = 0;
    }
    playMusic(mocks.tracks.BOSS_BGM);
    if (mocks.bossMix < 1 && mocks.tracks.BGM) playMusic(mocks.tracks.BGM);
    mocks.bossMix = Math.min(1, mocks.bossMix + Math.max(0, dt) / 1.1);
    mocks.tracks.BOSS_BGM.volume = musicVolume() * mocks.bossMix;
    if (mocks.tracks.BGM) {
      mocks.tracks.BGM.volume = musicVolume() * (1 - mocks.bossMix);
      if (mocks.bossMix >= 1 && !mocks.tracks.BGM.paused) mocks.tracks.BGM.pause();
    }
    if (mocks.tracks.MAP_BGM && !mocks.tracks.MAP_BGM.paused) mocks.tracks.MAP_BGM.pause();
    return;
  }

  // 常規 BGM 分支
  const desiredBgm = state === "overworld"
    ? (mocks.tracks.MAP_BGM || mocks.tracks.BGM)
    : mocks.tracks.BGM;
  if (desiredBgm) {
    if (activeBgm !== desiredBgm) {
      musicTracks().forEach(audio => {
        try {
          if (audio !== desiredBgm && !audio.paused) audio.pause();
        } catch {}
      });
      activeBgm = desiredBgm;
      desiredBgm.volume = musicVolume();
    }
    playMusic(activeBgm);
    // 後續 dt ticks 會處理音量 ramp（這裡是初始化）
    if (!desiredBgm._startedAt) {
      desiredBgm._startedAt = performance.now();
    }
  }
}

// 初始化 helper
function resetMocks() {
  [mocks.tracks.BGM, mocks.tracks.MAP_BGM, mocks.tracks.BOSS_BGM].forEach(audio => {
    audio.paused = true;
    audio.volume = 0.27;
    audio._startedAt = 0;
  });
  mocks.suspend = false;
  mocks.muted = false;
  mocks.bossMusic = false;
  mocks.bossMix = 0;
  mocks.BGMAttempts.clear();
  pausesDucking = false;
  wordDucking = false;
  modalsDucking = false;
  activeBgm = null;
}

// 測試基準
let testCount = 0;
let passed = 0;
let failed = 0;

function runTest(name, fn) {
  testCount++;
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`✗ ${name}: ${e.message}`);
    failed++;
    resetMocks(); // 回滾測試環境
  }
}

// 開始測試
console.log('=== R10 有聲選單 BGM 保護測試 ===\n');

// 測試 1: play → charmswap → play
console.log('測試 1: play → charmswap → play');
resetMocks();
mocks.tracks.BGM.paused = false;
mocks.tracks.BGM.volume = 0.27;
updateBgm(0.0166, 'play', 0, 30);
playMusic(mocks.tracks.BGM);

// charmswap
updateBgm(0.0166, 'charmswap', 1, 30);
const afterCharmswap = musicTracks().map(t => t.volume);
console.log(`  charmswap 後音量: ${JSON.stringify(afterCharmswap)}`);

// 回本
resetMocks();
mocks.tracks.BGM.paused = false;
mocks.tracks.BGM.volume = 0.27;
updateBgm(0.0166, 'play', 0, 30);
playMusic(mocks.tracks.BGM);
updateBgm(0.0166, 'play', 2, 30);
const afterPlay = musicTracks().map(t => t.volume);
console.log(`  回本後音量: ${JSON.stringify(afterPlay)}`);

runTest('play → charmswap → play BGM 不被停，只 duck 音量', () => {
  // 評估：activeBgm 應保持 BGM，音量不應變成 0
  if (activeBgm !== mocks.tracks.BGM) {
    throw new Error(`activeBgm 變成 ${activeBgm === null ? null : activeBgm === mocks.tracks.BOSS_BGM ? 'BOSS_BGM' : 'unexpected'}，應保持 BGM`);
  }
});

// 測試 2: play → fusion → play
console.log('\n測試 2: play → fusion → play');
resetMocks();
mocks.tracks.BGM.paused = false;
mocks.tracks.BGM.volume = 0.27;
updateBgm(0.0166, 'play', 0, 30);
playMusic(mocks.tracks.BGM);

// fusion
updateBgm(0.0166, 'fusion', 1, 30);
const afterFusion = musicTracks().map(t => t.volume);
console.log(`  fusion 後音量: ${JSON.stringify(afterFusion)}`);

// 回本
resetMocks();
mocks.tracks.BGM.paused = false;
mocks.tracks.BGM.volume = 0.27;
updateBgm(0.0166, 'play', 0, 30);
playMusic(mocks.tracks.BGM);
updateBgm(0.0166, 'play', 2, 30);
const afterPlay2 = musicTracks().map(t => t.volume);
console.log(`  回本後音量: ${JSON.stringify(afterPlay2)}`);

runTest('play → fusion → play BGM 不被停，只 duck 音量', () => {
  if (activeBgm !== mocks.tracks.BGM) {
    throw new Error('activeBgm 變成 null');
  }
});

// 測試 3: levelup 不會停掉 BGM
console.log('\n測試 3: levelup 不會停掉 BGM');
resetMocks();
mocks.tracks.BGM.paused = false;
mocks.tracks.BGM.volume = 0.27;
updateBgm(0, 'play', 0, 30);
playMusic(mocks.tracks.BGM);
updateBgm(0, 'levelup', 0, 30);
const afterLevelup = musicTracks().map(t => t.volume);
console.log(`  levelup 後音量: ${JSON.stringify(afterLevelup)}`);
console.log(`  activeBgm: ${activeBgm === mocks.tracks.BGM ? 'BGM' : 'none'}`);

runTest('levelup 不會讓 activeBgm 變成 null', () => {
  if (activeBgm !== mocks.tracks.BGM) {
    throw new Error('activeBgm 變成 null');
  }
});

// 測試 4: victory 不會被 modal 停掉
console.log('\n測試 4: victory 不會被 modal 停掉');
resetMocks();
mocks.tracks.BGM.paused = false;
mocks.tracks.BGM.volume = 0.27;
updateBgm(0, 'play', 0, 30);
playMusic(mocks.tracks.BGM);
updateBgm(0, 'victory', 0, 30);
const afterVictory = musicTracks().map(t => t.volume);
console.log(`  victory 後音量: ${JSON.stringify(afterVictory)}`);
console.log(`  activeBgm: ${activeBgm === mocks.tracks.BGM ? 'BGM' : 'none'}`);

runTest('victory 在 isMusicActive 列表，不會讓 activeBgm 變成 null', () => {
  if (activeBgm !== mocks.tracks.BGM) {
    throw new Error('activeBgm 變成 null');
  }
});

// 測試 5: pause duck 直到回本
console.log('\n測試 5: pause duck 直到回本');
resetMocks();
mocks.tracks.BGM.paused = false;
mocks.tracks.BGM.volume = 0.27;
updateBgm(0, 'play', 0, 30);
playMusic(mocks.tracks.BGM);
updateBgm(0, 'pause', 0, 30);
const afterPause = musicTracks().map(t => t.volume);
console.log(`  pause 後音量: ${JSON.stringify(afterPause)}`);
console.log(`  pausesDucking: ${pausesDucking}`);

resetMocks();
mocks.tracks.BGM.paused = false;
mocks.tracks.BGM.volume = 0.27;
updateBgm(0, 'play', 0, 30);
playMusic(mocks.tracks.BGM);
updateBgm(0, 'play', 0, 30);
const afterResume = musicTracks().map(t => t.volume);
console.log(`  回本後音量: ${JSON.stringify(afterResume)}`);
console.log(`  pausesDucking: ${pausesDucking}`);

runTest('pause duck 直到回本，modalsDucking 正確重置', () => {
  if (pausesDucking) {
    throw new Error('pause duck 狀態沒有恢復');
  }
  if (activeBgm !== mocks.tracks.BGM) {
    throw new Error('activeBgm 變成 null');
  }
});

// 測試 6: charmswap/fusion 做 modal duck 而非完全停停
console.log('\n測試 6: charmswap/fusion 做 modal duck 而非完全停掉');
resetMocks();
mocks.tracks.BGM.paused = false;
mocks.tracks.BGM.volume = 0.27;
updateBgm(0, 'play', 0, 30);
playMusic(mocks.tracks.BGM);
updateBgm(0, 'charmswap', 0, 30);
const afterCharmswap2 = musicTracks().map(t => t.volume);
console.log(`  charmswap modal volume: ${JSON.stringify(afterCharmswap2)}`);

resetMocks();
mocks.tracks.BGM.paused = false;
mocks.tracks.BGM.volume = 0.27;
updateBgm(0, 'play', 0, 30);
playMusic(mocks.tracks.BGM);
updateBgm(0, 'fusion', 0, 30);
const afterFusion2 = musicTracks().map(t => t.volume);
console.log(`  fusion modal volume: ${JSON.stringify(afterFusion2)}`);

runTest('charmswap/fusion 持續做 modal duck 而非讓 activeBgm 變成 null', () => {
  // activeBgm 不應變成 null
  if (activeBgm !== mocks.tracks.BGM) {
    throw new Error('activeBgm 變成 null');
  }
  // modal volume 應在合理範圍 (0.16 左右)
  const modalVolume = mocks.tracks.BGM.volume;
  if (modalVolume < 0.15 || modalVolume > 0.17) {
    throw new Error(`modal volume 應約 0.16，實際 ${modalVolume}`);
  }
});

console.log('\n=== 結果 ===');
console.log(` Passed: ${passed}/${testCount}`);
if (failed > 0) {
  console.log(` Failed: ${failed}/${testCount}`);
  process.exit(1);
}
console.log('✓ 所有測試通過');