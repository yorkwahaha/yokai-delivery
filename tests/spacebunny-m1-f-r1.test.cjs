"use strict";

// M1-F-R1：js/store.js finish() 的有限數值 guard。
// 讀實際磁碟上的 js/dev-mode.js + js/store.js 到 VM，localStorage 用記憶體 Map，
// 斷言「記憶體 / JSON / 重載」三層一致。全程不碰真玩家 localStorage。

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const OFFICIAL = "yokai-delivery-v1";
const DEV_KEY = "yokai-delivery-dev-v1";
const MAX_SAFE = Number.MAX_SAFE_INTEGER;
const devSrc = fs.readFileSync(path.join(__dirname, "../js/dev-mode.js"), "utf8");
const storeSrc = fs.readFileSync(path.join(__dirname, "../js/store.js"), "utf8");

const SEED = {
  best: 40,
  bestDel: 3,
  m: { "ねこ": { ok: 2, ng: 0, box: 1, lastSeen: 1, missBoost: 1 } },
  progress: {
    unlocked: { "night-town": true },
    completed: {},
    stages: { "night-town": { bestScore: 40, bestDeliveries: 3, clears: 1, attempts: 2 } }
  }
};
const SEEDSTR = JSON.stringify(SEED);

function load(box, search) {
  const env = {
    console,
    URLSearchParams,
    location: { hostname: "127.0.0.1", search: search || "" },
    localStorage: {
      getItem: key => (box.has(key) ? box.get(key) : null),
      setItem: (key, value) => {
        if (env.failWrite) throw new Error("QuotaExceededError");
        box.set(key, String(value));
      }
    }
  };
  env.window = env;
  const ctx = vm.createContext(env);
  vm.runInContext(devSrc, ctx);
  vm.runInContext(storeSrc, ctx);
  return env;
}

// 三層讀值：記憶體（finish 後）、JSON（實際落盤字串解析）、重載（由落盤字串重新載入）
function readLayers(box) {
  const raw = JSON.parse(box.get(OFFICIAL));
  const rawStage = raw.progress.stages["night-town"];
  const S = load(new Map([[OFFICIAL, box.get(OFFICIAL)]])).STORE;
  const memStage = S.data.progress.stages["night-town"];
  return {
    json: {
      best: raw.best,
      bestScore: rawStage.bestScore,
      bestDel: raw.bestDel,
      bestDeliveries: rawStage.bestDeliveries
    },
    reload: {
      best: S.data.best,
      bestScore: memStage.bestScore,
      bestDel: S.data.bestDel,
      bestDeliveries: memStage.bestDeliveries
    }
  };
}

function finishRun(score, deliveries, won, seedStr) {
  const box = new Map([[OFFICIAL, seedStr || SEEDSTR]]);
  const env = load(box);
  env.STORE.finish("night-town", score, deliveries, won);
  const st = env.STORE.data.progress.stages["night-town"];
  const mem = {
    best: env.STORE.data.best,
    bestScore: st.bestScore,
    bestDel: env.STORE.data.bestDel,
    bestDeliveries: st.bestDeliveries
  };
  return Object.assign({ box, env, mem }, readLayers(box));
}

function assertThreeLayers(result, want, label) {
  for (const layer of ["mem", "json", "reload"]) {
    for (const field of ["best", "bestScore", "bestDel", "bestDeliveries"]) {
      assert.equal(result[layer][field], want[field], label + " " + layer + "." + field);
    }
    assert.equal(typeof result[layer].best, "number", label + " " + layer + ".best 必須是數值");
    assert.equal(typeof result[layer].bestScore, "number", label + " " + layer + ".bestScore 必須是數值");
  }
}

const HELD = { best: 40, bestScore: 40, bestDel: 3, bestDeliveries: 3 };

test("非有限值、負數與非數值輸入不會污染既有最佳紀錄", () => {
  const rows = [
    ["Infinity", Infinity, NaN],
    ["Infinity x2", Infinity, Infinity],
    ["字串 Infinity", "Infinity", "Infinity"],
    ["NaN", NaN, NaN],
    ["-Infinity", -Infinity, -Infinity],
    ["負數", -1, -1],
    ["空字串與 abc", "", "abc"],
    ["abc 與空字串", "abc", ""],
    ["null 與 undefined", null, undefined]
  ];
  for (const [label, score, deliveries] of rows) {
    assertThreeLayers(finishRun(score, deliveries, false), HELD, label);
  }
});

test("合法數值與數值字串仍正常更新最佳紀錄", () => {
  const want = { best: 50, bestScore: 50, bestDel: 3, bestDeliveries: 3 };
  assertThreeLayers(finishRun(50, 3, false), want, "number 50");
  assertThreeLayers(finishRun("50", "3", false), want, "string 50");
});

test("小數在記憶體、JSON 與重載三層同為取整後的整數", () => {
  const want = { best: 70, bestScore: 70, bestDel: 70, bestDeliveries: 70 };
  assertThreeLayers(finishRun(70.9, 70.9, false), want, "70.9");
});

test("超過 MAX_SAFE_INTEGER 的值依讀取端策略夾到 MAX_SAFE_INTEGER", () => {
  const want = { best: MAX_SAFE, bestScore: MAX_SAFE, bestDel: MAX_SAFE, bestDeliveries: MAX_SAFE };
  assertThreeLayers(finishRun(MAX_SAFE + 1, MAX_SAFE + 1, false), want, "MAX_SAFE+1");
});

test("首通解鎖下一關，重複標記旗標冪等且不多發", () => {
  const result = finishRun(500, 5, true);
  const S = result.env.STORE;
  assert.equal(S.isStageCompleted("night-town"), true);
  assert.equal(S.isStageUnlocked("rain-port"), true);
  assert.equal(result.mem.best, 500);

  S.completeStage("night-town");
  S.completeStage("night-town");
  const saved = JSON.parse(result.box.get(OFFICIAL));
  assert.deepEqual(Object.keys(saved.progress.unlocked).sort(), ["night-town", "rain-port"]);
  assert.equal(saved.progress.completed["night-town"], true);
  assert.equal(saved.progress.completed["rain-port"], undefined);
});

test("敗局記錄最佳值但不解鎖下一關", () => {
  const result = finishRun(1200, 3, false);
  const S = result.env.STORE;
  assert.equal(S.isStageCompleted("night-town"), false);
  assert.equal(S.isStageUnlocked("rain-port"), false);
  assert.equal(result.reload.best, 1200);
  assert.equal(result.reload.bestScore, 1200);
});

test("舊三參數簽章仍可用且視為敗局", () => {
  const result = finishRun(1234, 8);
  const S = result.env.STORE;
  assert.equal(S.isStageCompleted("night-town"), false);
  assert.equal(S.isStageUnlocked("rain-port"), false);
  assertThreeLayers(result, { best: 1234, bestScore: 1234, bestDel: 8, bestDeliveries: 8 }, "legacy 3-arg");
});

test("寫入被拒時自我回報、正式存檔字串不變、重載維持舊檔並可恢復", () => {
  const box = new Map([[OFFICIAL, SEEDSTR]]);
  const env = load(box);
  env.failWrite = true;
  env.STORE.finish("night-town", 500, 5, true);

  // 記憶體已變但未落盤：這是現行事實，不是回滾保證。
  assert.equal(env.STORE.isStageUnlocked("rain-port"), true);
  assert.equal(env.STORE.canSave(), false);
  assert.equal(box.get(OFFICIAL), SEEDSTR);

  const reloaded = load(new Map([[OFFICIAL, box.get(OFFICIAL)]])).STORE;
  assert.equal(reloaded.isStageUnlocked("rain-port"), false);
  assert.equal(reloaded.data.best, 40);
  assert.equal(reloaded.getStageStats("night-town").clears, 1);
  assert.equal(reloaded.canSave(), true);

  env.failWrite = false;
  env.STORE.finish("night-town", 500, 5, true);
  assert.equal(env.STORE.canSave(), true);
  const saved = JSON.parse(box.get(OFFICIAL));
  assert.equal(saved.progress.unlocked["rain-port"], true);
  assert.equal(saved.best, 500);
  assert.equal(saved.progress.stages["night-town"].clears, 3);
});

test("dev 沙箱與正式存檔隔離，dev 內的非有限值同樣不污染", () => {
  const box = new Map([[OFFICIAL, SEEDSTR]]);
  const env = load(box, "?dev=1");
  env.STORE.finish("night-town", Infinity, Infinity, true);

  assert.equal(box.get(OFFICIAL), SEEDSTR);
  const devRaw = JSON.parse(box.get(DEV_KEY));
  assert.equal(devRaw.progress.unlocked["rain-port"], true);
  assert.equal(devRaw.best, 0);
  assert.equal(devRaw.progress.stages["night-town"].bestScore, 0);

  const official = load(box, "").STORE;
  assert.equal(official.isStageUnlocked("rain-port"), false);
  assert.equal(official.data.best, 40);
});
