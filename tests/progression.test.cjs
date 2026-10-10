const test = require("node:test");
const assert = require("node:assert/strict");

function loadStore(seed = null) {
  const mem = new Map();
  if (seed) mem.set("yokai-delivery-v1", JSON.stringify(seed));
  global.window = global;
  global.localStorage = {
    getItem: key => mem.has(key) ? mem.get(key) : null,
    setItem: (key, value) => mem.set(key, value)
  };
  delete require.cache[require.resolve("../js/store.js")];
  require("../js/store.js");
  return { STORE: global.STORE, mem };
}

test('failed storage writes expose an error and successful retries clear it',()=>{
  const {STORE}=loadStore();const write=global.localStorage.setItem;
  global.localStorage.setItem=()=>{throw new Error('QuotaExceededError');};
  STORE.rec('ねこ',true);assert.equal(STORE.canSave(),false);
  global.localStorage.setItem=write;STORE.rec('ねこ',true);assert.equal(STORE.canSave(),true);
});

test("legacy save data is upgraded without losing vocabulary progress", () => {
  const legacy = {
    m: { "ねこ": { ok: 3, ng: 1, box: 2, lastSeen: 123, missBoost: 1 } },
    best: 999,
    bestDel: 4
  };
  const { STORE } = loadStore(legacy);
  assert.equal(STORE.get("ねこ").ok, 3);
  assert.equal(STORE.data.best, 999);
  assert.equal(STORE.isStageUnlocked("night-town"), true);
  assert.equal(STORE.isStageUnlocked("rain-port"), false);
});

test("clearing night-town unlocks rain-port and stores per-stage records", () => {
  const { STORE } = loadStore();
  STORE.startRun("night-town");
  STORE.finish("night-town", 4321, 8, true);

  assert.equal(STORE.isStageCompleted("night-town"), true);
  assert.equal(STORE.isStageUnlocked("rain-port"), true);
  const stats = STORE.getStageStats("night-town");
  assert.equal(stats.bestScore, 4321);
  assert.equal(stats.bestDeliveries, 8);
  assert.equal(stats.clears, 1);
  assert.equal(stats.attempts, 1);
});

test("a failed run records stage bests but does not unlock the next stage", () => {
  const { STORE } = loadStore();
  STORE.startRun("night-town");
  STORE.finish("night-town", 1200, 3, false);

  assert.equal(STORE.isStageCompleted("night-town"), false);
  assert.equal(STORE.isStageUnlocked("rain-port"), false);
  assert.equal(STORE.getStageStats("night-town").bestScore, 1200);
});

test('unresolved mistakes survive reload, replay and stage switching until answered', () => {
  let { STORE, mem } = loadStore();
  STORE.rec('ねこ', false);
  STORE.rec('ねこ', false);
  ({ STORE, mem } = loadStore(JSON.parse(mem.get('yokai-delivery-v1'))));
  for (const stage of ['night-town', 'night-town', 'rain-port']) {
    STORE.startRun(stage);
    assert.equal(STORE.get('ねこ').ng, 2);
    assert.equal(STORE.get('ねこ').missBoost, 2.5);
  }
  STORE.recAssisted('ねこ');
  assert.equal(STORE.get('ねこ').box, 0);
  assert.equal(STORE.get('ねこ').missBoost, 2.5);
  STORE.rec('ねこ', false);
  STORE.rec('ねこ', true);
  assert.equal(STORE.get('ねこ').box, 1);
  assert.equal(STORE.get('ねこ').missBoost, 1);
});

test('review sampling applies mistake weights within the supplied stage pool', () => {
  const { STORE } = loadStore();
  const words = [{jp:'ねこ'}, {jp:'いぬ'}];
  STORE.rec('ねこ', false);
  const random = Math.random;
  try {
    Math.random = () => 0.6;
    assert.equal(STORE.pick(words).jp, 'ねこ');
    STORE.recAssisted('ねこ');
    assert.equal(STORE.pick(words).jp, 'いぬ');
    assert.equal(STORE.pick([{jp:'あめ'}]).jp, 'あめ');
    assert.equal(STORE.pick([]), null);
  } finally { Math.random = random; }
});

test('malformed save containers recover without losing valid vocabulary and best scores', () => {
  for (const progress of [1, [], 'bad', null, {unlocked:[],completed:1,stages:'bad'}]) {
    const {STORE,mem}=loadStore({m:{'ねこ':{ok:3,ng:1,box:2}},best:123,progress});
    assert.equal(STORE.get('ねこ').box,2);
    assert.equal(STORE.data.best,123);
    STORE.completeStage('night-town');
    const saved=JSON.parse(mem.get('yokai-delivery-v1'));
    assert.equal(saved.progress.unlocked['rain-port'],true);
    assert.equal(saved.progress.completed['night-town'],true);
  }
  for (const seed of [[], 'bad', {m:[]}, {m:42}]) {
    const {STORE}=loadStore(seed);
    assert.doesNotThrow(() => STORE.startRun());
    assert.equal(STORE.get('ねこ').box,0);
  }
});

test('invalid mastery, flags and stage counters normalize to finite valid values', () => {
  const {STORE}=loadStore({m:{'ねこ':{ok:-2,ng:'3',box:99,lastSeen:1e30,missBoost:99},'いぬ':null},best:'bad',bestDel:-4,
    progress:{unlocked:{'rain-port':'yes'},completed:{'night-town':false},stages:{'night-town':{attempts:'99',clears:-3,bestScore:7.9},'rain-port':[]}}});
  const m=STORE.get('ねこ');
  assert.equal(m.ok,0); assert.equal(m.ng,0); assert.equal(m.box,4);
  assert.ok(m.lastSeen<=Date.now()); assert.equal(m.missBoost,2.5);
  assert.equal(STORE.get('いぬ').box,0);
  assert.equal(STORE.data.best,0); assert.equal(STORE.data.bestDel,0);
  assert.equal(STORE.isStageUnlocked('rain-port'),false);
  assert.equal(STORE.getStageStats('night-town').bestScore,7);
  STORE.startRun(); assert.equal(STORE.getStageStats('night-town').attempts,1);
  assert.equal(STORE.getStageStats('rain-port').clears,0);
  assert.ok(['ねこ','いぬ'].includes(STORE.pick([{jp:'ねこ'},{jp:'いぬ'}]).jp));
});
