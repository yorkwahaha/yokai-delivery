'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('js/store.js', 'utf8');

function createStoreTabs(seed = {}, options = {}) {
  const disk = new Map(Object.entries(seed));
  let tabNumber = 0;
  const open = () => {
    const tab = ++tabNumber;
    const localStorage = {
      get length() { return disk.size; },
      key(index) { return [...disk.keys()][index] ?? null; },
      getItem(key) {
        if (options.rejectRead?.(key)) throw new Error('Storage unavailable');
        return disk.get(key) ?? null;
      },
      setItem(key, value) {
        if (options.reject?.(key) || (options.maxValueLength && String(value).length > options.maxValueLength)) {
          throw new Error('QuotaExceededError');
        }
        disk.set(key, String(value));
      }
    };
    const window = { crypto: { randomUUID: () => 'tab-' + tab }, localStorage };
    const ctx = { window, localStorage, Date, Math, console };
    if (options.lifecycle) Object.assign(ctx, options.lifecycle(window));
    vm.runInNewContext(source, ctx, { filename: 'store.js' });
    return window.STORE;
  };
  return { open, disk };
}

test('storage access denied still exposes an in-memory game store', () => {
  const window = {};
  const ctx = vm.createContext({ window, DOMException });
  vm.runInContext(`let localStorage = new Proxy({}, {
    get() { throw new DOMException('Storage denied', 'SecurityError'); }
  });`, ctx);
  vm.runInContext(source, ctx);
  const store = window.STORE;
  assert.equal(store.canSave(), false);
  store.rec('猫', true);
  assert.equal(store.get('猫').ok, 1);
  assert.equal(store.isStageUnlocked('night-town'), true);
});

test('quota recovery seals bounded segments and retries only the unsaved suffix', () => {
  const key = 'yokai-delivery-v1';
  let blockAll = true, blockSecond = false;
  const { open, disk } = createStoreTabs({}, {
    reject: name => name.startsWith(key + ':journal:') &&
      (blockAll || (blockSecond && name.endsWith(':1')))
  });
  const a = open();
  for (let i = 0; i < 520; i++) a.rec('猫', true);
  assert.equal(a.canSave(), false);
  blockAll = false;
  blockSecond = true;
  a.flush();
  assert.equal(a.canSave(), false);
  assert.equal(open().get('猫').ok, 256);
  assert.equal(a.get('猫').ok, 520);
  blockSecond = false;
  a.flush();
  assert.equal(a.canSave(), true);
  assert.equal(open().get('猫').ok, 520);
  const chunks = [...disk].filter(([name]) => name.startsWith(key + ':journal:'));
  assert.deepEqual(chunks.map(([, value]) => JSON.parse(value).length), [256, 256, 8]);
});

test('a checkpoint published during enumeration does not expose a half-read state', () => {
  const key = 'yokai-delivery-v1';
  const baseKey = key + ':journal-base';
  let advance = false;
  const { open, disk } = createStoreTabs({ [key]: JSON.stringify({ m: { '猫': { ok: 2 } } }) }, {
    rejectRead(name) {
      if (advance && name.startsWith(key + ':journal:')) {
        advance = false;
        disk.set(baseKey, disk.get(key));
        disk.delete(name);
      }
      return false;
    }
  });
  const a = open();
  a.rec('猫', true);
  const b = open();
  assert.equal(b.get('猫').ok, 3);
  advance = true;
  assert.equal(b.get('猫').ok, 3);
  assert.equal(b.get('猫').ok, 3);
  b.rec('猫', true);
  assert.equal(open().get('猫').ok, 4);
});

test('a failed migration base write cannot make the legacy projection a replay base', () => {
  const key = 'yokai-delivery-v1';
  let blocked = true;
  const { open, disk } = createStoreTabs({ [key]: JSON.stringify({ m: { '猫': { ok: 3 } } }) }, {
    reject: key => blocked && key.endsWith(':journal-base')
  });
  const first = open();
  first.rec('猫', true);
  assert.equal(first.canSave(), false);
  assert.equal(JSON.parse(disk.get(key)).m['猫'].ok, 3);
  blocked = false;
  first.flush();
  assert.equal(first.canSave(), true);
  assert.equal(open().get('猫').ok, 4);
});

test('render status preserves debounce and pagehide retries a failed save', () => {
  let blocked = false, timer, pagehide;
  const { open, disk } = createStoreTabs({}, {
    reject: () => blocked,
    lifecycle(window) {
      window.addEventListener = (name, listener) => { if (name === 'pagehide') pagehide = listener; };
      return {
        document: { addEventListener() {} },
        setTimeout(listener) { timer = listener; return 1; },
        clearTimeout() { timer = null; }
      };
    }
  });
  const first = open();
  first.rec('猫', true);
  assert.equal(first.canSave(), true);
  assert.equal(disk.has('yokai-delivery-v1'), false);
  blocked = true;
  timer();
  assert.equal(first.canSave(), false);
  blocked = false;
  pagehide();
  assert.equal(first.canSave(), true);
  assert.equal(open().get('猫').ok, 1);
});

test('a transient startup read failure preserves the existing legacy snapshot', () => {
  const key = 'yokai-delivery-v1';
  let blocked = true;
  const { open } = createStoreTabs({ [key]: JSON.stringify({ m: { '猫': { ok: 3 } } }) }, {
    rejectRead: () => blocked
  });
  const first = open();
  blocked = false;
  first.rec('猫', true);
  assert.equal(first.get('猫').ok, 4);
  assert.equal(open().get('猫').ok, 4);
});

test('cross-tab rec cannot roll back completed stages or lose either answer', () => {
  const { open } = createStoreTabs();
  const a = open(), b = open();
  a.completeStage('night-town');
  b.rec('猫', true);
  a.rec('犬', false);
  b.finish('rain-port', 250, 3, true);
  const reloaded = open();
  assert.equal(reloaded.isStageCompleted('night-town'), true);
  assert.equal(reloaded.isStageCompleted('rain-port'), true);
  assert.equal(reloaded.isStageUnlocked('sakura-pass'), true);
  assert.equal(reloaded.get('猫').ok, 1);
  assert.equal(reloaded.get('犬').ng, 1);
  assert.equal(reloaded.getStageStats('rain-port').clears, 1);
});

test('late-game coin awards persist and merge across tabs without duplicate replay', () => {
  const key='yokai-delivery-v1';
  const {open,disk}=createStoreTabs({
    [key]: JSON.stringify({m:{},best:120,bestDel:4,coins:50})
  });
  const a=open(),b=open();
  assert.equal(a.coinBalance(),50);
  assert.equal(a.awardCoins(100),100);
  assert.equal(b.awardCoins(200),200);
  assert.equal(a.coinBalance(),350);
  b.rec('猫',true);
  assert.equal(open().coinBalance(),350);
  assert.equal(JSON.parse(disk.get(key)).coins,350);
  assert.equal(open().get('猫').ok,1);
});

test('cross-tab interleaved attempts, assists and clear counts are not doubled', () => {
  const { open } = createStoreTabs();
  const a = open(), b = open();
  a.startRun('night-town');
  b.startRun('night-town');
  a.recAssisted('猫');
  b.rec('猫', true);
  a.finish('night-town', 99, 2, true);
  b.finish('night-town', 120, 3, true);
  const c = open();
  assert.equal(c.getStageStats('night-town').attempts, 2);
  assert.equal(c.getStageStats('night-town').clears, 2);
  assert.equal(c.get('猫').ok, 2);
  assert.equal(c.data.best, 120);
  assert.equal(c.data.bestDel, 3);
});

test('legacy v1 data remains as an immutable migration base', () => {
  const prior = JSON.stringify({ best: 42, m: { '狐': { ok: 3, ng: 1, box: 2 } },
    progress: { unlocked: { 'night-town': true }, completed: { 'night-town': true } } });
  const { open } = createStoreTabs({ 'yokai-delivery-v1': prior });
  const a = open(), b = open();
  a.rec('狐', true);
  b.rec('狐', false);
  const c = open();
  assert.equal(c.get('狐').ok, 4);
  assert.equal(c.get('狐').ng, 2);
  assert.equal(c.data.best, 42);
  assert.equal(c.isStageCompleted('night-town'), true);
});

test('journals rotate into compact segments without losing cross-tab answer counts', () => {
  const { open, disk } = createStoreTabs();
  const a = open(), b = open();
  for (let i = 0; i < 600; i++) a.rec('猫', true);
  for (let i = 0; i < 80; i++) b.rec('犬', false);
  const segments = [...disk.keys()].filter(key => key.startsWith('yokai-delivery-v1:journal:'));
  assert.ok(segments.length >= 4, 'one tab should rotate into at least three segments');
  for (const key of segments) {
    const rows = JSON.parse(disk.get(key));
    assert.ok(rows.length <= 256);
    assert.ok(rows.every(Array.isArray), 'new journals use the compact tuple format');
  }
  const c = open();
  assert.equal(c.get('猫').ok, 600);
  assert.equal(c.get('犬').ng, 80);
});

test('storage quota rejection reports failure and never overwrites the last valid snapshot', () => {
  const { open, disk } = createStoreTabs({}, { maxValueLength: 1100 });
  const a = open();
  a.completeStage('night-town');
  assert.ok(disk.get('yokai-delivery-v1'), 'first clear must persist');
  for (let i = 0; i < 100; i++) a.rec('あ', true);
  assert.equal(a.canSave(), false, 'quota failure must be visible to the caller');
  const lastValid = disk.get('yokai-delivery-v1');
  const persisted = JSON.parse(lastValid).m['あ']?.ok || 0;
  assert.ok(persisted > 0 && persisted < 100, 'some earlier events persisted before quota');
  a.rec('あ', true);
  assert.equal(disk.get('yokai-delivery-v1'), lastValid,
    'failed journal write must never overwrite the last successful projection');
  assert.equal(open().isStageCompleted('night-town'), true);
  assert.equal(open().get('あ').ok, persisted, 'reload only returns truly persisted answers');
});

test('malformed segment is preserved but cannot block valid progress from other tabs', () => {
  const bad = 'yokai-delivery-v1:journal:broken-tab:0';
  const { open, disk } = createStoreTabs({ [bad]: '{not-json' });
  const a = open();
  a.completeStage('night-town');
  a.rec('狐', true);
  const b = open();
  assert.equal(b.isStageCompleted('night-town'), true);
  assert.equal(b.get('狐').ok, 1);
  assert.equal(disk.get(bad), '{not-json', 'retain bad bytes for manual recovery');
});

test('unchanged journal reads skip repeated JSON parsing', () => {
  const disk = new Map();
  let parses = 0;
  const localStorage = {
    get length() { return disk.size; },
    key(i) { return [...disk.keys()][i] ?? null; },
    getItem(k) { return disk.get(k) ?? null; },
    setItem(k,v) { disk.set(k, String(v)); }
  };
  const window = { crypto: { randomUUID: () => 'tracked-tab' }, localStorage };
  const trackedJSON = {
    parse(v) { parses++; return JSON.parse(v); },
    stringify: JSON.stringify
  };
  vm.runInNewContext(source, { window, localStorage, JSON: trackedJSON, Date, Math, console }, { filename: 'store.js' });
  const s = window.STORE;
  s.rec('猫', true);
  s.isStageUnlocked('night-town');
  const baseline = parses;
  for (let i = 0; i < 80; i++) {
    assert.equal(s.isStageUnlocked('night-town'), true);
    assert.equal(s.isStageCompleted('night-town'), false);
  }
  assert.equal(parses, baseline, 'unchanged storage must avoid JSON.parse');
});
test('adding one answer does not reparse other unchanged journal segments',()=>{
  const disk=new Map();
  let parses=0;
  const storage={
    get length(){return disk.size;},
    key:i=>[...disk.keys()][i]??null,
    getItem:k=>disk.get(k)??null,
    setItem:(k,v)=>disk.set(k,String(v))
  };
  const window={crypto:{randomUUID:()=>"cache-tab"},localStorage:storage};
  const json={parse(value){parses++;return JSON.parse(value);},stringify:JSON.stringify};
  vm.runInNewContext(source,{window,localStorage:storage,JSON:json,Date,Math,console});
  const store=window.STORE;
  for(let i=0;i<560;i++)store.rec('鳥',true);
  store.isStageUnlocked('night-town');
  const before=parses;
  store.rec('猫',true);
  const extra=parses-before;
  assert.ok(extra<=5,`new write should parse only active journal, got ${extra}`);
  assert.equal(store.get('鳥').ok,560);
  assert.equal(store.get('猫').ok,1);
});
test('an open tab reloads a newer migration base before replaying removed segments',()=>{
  const key='yokai-delivery-v1';
  const baseKey=key+':journal-base';
  const oldKey=key+':journal:old:0';
  const start={m:{鳥:{ok:2,ng:0,box:2,lastSeen:0,missBoost:1}},
    best:0,bestDel:0,coins:0,progress:{unlocked:{"night-town":true},completed:{},stages:{}}};
  const {open,disk}=createStoreTabs({
    [baseKey]:JSON.stringify(start),
    [oldKey]:JSON.stringify([['rec',Date.now(),1,'鳥',1,0,0,0]])
  });
  const tab=open();
  assert.equal(tab.get('鳥').ok,3);
  const next=structuredClone(start);
  next.m['鳥'].ok=3;
  next.m['鳥'].box=3;
  disk.set(baseKey,JSON.stringify(next));
  disk.delete(oldKey);
  assert.equal(tab.get('鳥').ok,3,'must not forget folded journal after external checkpoint');
  tab.rec('猫',true);
  assert.equal(open().get('鳥').ok,3);
  assert.equal(open().get('猫').ok,1);
});
