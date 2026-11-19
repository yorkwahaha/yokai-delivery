"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = name => fs.readFileSync(path.join(root, "js", name), "utf8");
function between(text, from, to) {
  const start = text.indexOf(from);
  const end = text.indexOf(to, start + from.length);
  assert.ok(start >= 0 && end > start, `missing source block: ${from}`);
  return text.slice(start, end);
}

test("final-boss deadline applies even when the first or gate Boss remains alive", () => {
  const window = {};
  vm.runInNewContext(source("game-combat-math.js"), { window });
  const force = window.GAME_COMBAT_MATH.shouldForceFinalBoss;
  const times = [180, 360, 480, 540];
  for (const blocked of [0, 1, 2]) {
    assert.equal(force(blocked, times, 584.99, 45), false);
    assert.equal(force(blocked, times, 585, 45), true);
  }
  assert.equal(force(3, times, 1000, 45), false, "already scheduled finale is not rescheduled");

  const code = source("game.js");
  const gate = between(code,
    "    // An earlier Boss can block the gate indefinitely.",
    "    if (bossT <= 0 && bossStage < BOSS_TIMES.length) {");
  for (const blocked of [0, 1, 2]) {
    const result = vm.runInNewContext(`(() => {
      let bossStage=${blocked}, bossT=0, finalBossWaitT=0;
      const BOSS_TIMES=[180,360,480,540], elapsed=585, FINAL_BOSS_WAIT_MAX=45;
      const P={x:0,y:0}; const notices=[];
      const say=(message)=>notices.push(message);
      ${gate}
      return {bossStage,bossT,finalBossWaitT,notices};
    })()`, { window });
    assert.equal(result.bossStage, 3);
    assert.equal(result.bossT, 0);
    assert.equal(result.finalBossWaitT, 45);
    assert.equal(result.notices.length, 1);
  }
});

test("word gallery reuses one projection through many draws, then invalidates on delivery or storage change", () => {
  const code = source("ui.js");
  const block = between(code,
    "  let galleryProjectionCache = null;",
    "  // 圖鑑分頁籤：");
  let revision = 0, opens = 0, snapshots = 0, projections = 0;
  const storage = {};
  const window = {
    location: { hostname: "localhost" },
    localStorage: storage,
    CONTENT: {
      DELIVERY_PACK_IDS: ["a"],
      WORD_PACKS: { a: {id:"a",name:"A",words:[]} },
      STAGES: { "night-town": {id:"night-town",name:"Night"} },
      getAllWords: () => [{jp:"桜"}]
    },
    CARD_DELIVERY: {
      revision: () => revision,
      openCards: () => {
        opens++;
        return {key:"cards",snapshot:() => {snapshots++;return {marks:{"桜":1}};}};
      }
    },
    CARD_GALLERY: {project: () => {projections++;return {cards:[{jp:"桜"}]};}},
    CARD_COLLECTION: {completeSets: () => []}
  };
  const wordGallery = vm.runInNewContext(`(() => {${block} return wordGallery;})()`, {window});
  const first = wordGallery();
  for (let i = 0; i < 100; i++) assert.equal(wordGallery(), first);
  assert.equal(opens, 1);
  assert.equal(snapshots, 1);
  assert.equal(projections, 1);
  revision++;
  assert.notEqual(wordGallery(), first);
  assert.equal(opens, 2);
  assert.equal(snapshots, 2);
  assert.equal(projections, 2);
});

test("exiting a delivery barrier never freezes its 10-second failure deadline", () => {
  const code = source("game.js");
  const segment = between(code,
    "    if (job && !job.readClosed && deliveryBarrierContains(P, job.to)) {",
    "    let quizNear = null;");
  const result = vm.runInNewContext(`(() => {
    let job={reading:true,readClosed:false,barrierTimer:.2,to:{x:40,y:40},word:{jp:"猫"}};
    let inter={id:1}, nameT=2, failed=0, oil=100;
    const maxOil=100, misses=[], elapsed=60, P={x:0,y:0};
    const stats={wrong:0,audio:0,haptic:0,notices:[]};
    const STORE={rec:(_word,ok)=>{if(!ok)stats.wrong++;}};
    const AUDIO={deliverWrong:()=>stats.audio++};
    const HAPTICS={deliverWrong:()=>stats.haptic++};
    const study={mistake(){}};
    const say=(text)=>stats.notices.push(text);
    const deliveryBarrierContains=()=>false, loseRun=()=>{throw Error("unexpected loseRun");};
    let dt=.1;
    { ${segment} }
    const afterExit={reading:job.reading,readClosed:job.readClosed,timer:job.barrierTimer};
    dt=.15;
    { ${segment} }
    return {afterExit,job,failed,oil,misses,stats,inter};
  })()`);
  assert.equal(result.afterExit.reading, false);
  assert.equal(result.afterExit.readClosed, true);
  assert.ok(result.afterExit.timer > 0 && result.afterExit.timer < .2);
  assert.equal(result.job, null);
  assert.equal(result.failed, 1);
  assert.equal(result.oil, 95);
  assert.equal(result.misses.length, 1);
  assert.equal(result.stats.wrong, 1);
  assert.equal(result.stats.audio, 1);
  assert.equal(result.stats.haptic, 1);
  assert.equal(result.inter, null);
});

test("rain-port reroute without legal spare pickup preserves the accepted order", () => {
  const code = source("game.js");
  const segment = between(code,
    "  function rerollPickupsTooCloseTo(",
    "  // ---------- Stage / Word Pack / Chunk");
  const result = vm.runInNewContext(`(() => {
    const STAGE={id:"rain-port"}, WORLD_STATE={chunkWidth:900};
    let job=null, inter=null;
    const old={from:{id:"original",x:100},to:{id:"dest",x:700},word:{jp:"魚"}};
    let orders=[old];
    const houseColumnsBetween=()=>0, portHousesNear=()=>[];
    ${segment}
    rerollPickupsTooCloseTo(100);
    return {count:orders.length,same:orders[0]===old,from:orders[0]?.from?.id};
  })()`);
  assert.equal(result.count, 1);
  assert.equal(result.same, true);
  assert.equal(result.from, "original");
});
