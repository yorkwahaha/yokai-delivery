'use strict';
// SYS-C / S2-DELIVERY-DISTANCE-R1 — rain-port delivery pickup distance contract.
// Scope: js/game.js rain-port order selection + delivery lifecycle ONLY.
// No audio paths are opened (run with --require ./tools/director-audio-freeze.cjs).
// The harness drives the REAL consumers (update -> makeOrder -> interact -> resolve).
// Instrumentation is injected in memory only; js/game.js keeps no test hook.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

const ROOT = path.resolve(__dirname, '..');
const LOADER = path.join(ROOT, 'tests', 'kilo-m2-port-normal.test.cjs');
const MARKER = '// ── 1. Stage 1';

const PROBES = `
      route: () => ({ stage: STAGE.id, delivered, failed, orders: orders.map(o => ({ id: o.from.id + '|' + o.to.id, cardEventId: o.cardEventId, fromId: o.from.id, toId: o.to.id, fromX: o.from.x, fromY: o.from.y, toX: o.to.x, fromChunk: o.from.chunkKey, toChunk: o.to.chunkKey })), job: job ? { cardEventId: job.cardEventId, toId: job.to?.id } : null, inter: inter ? { cardEventId: inter.cardEventId, fromId: inter.from?.id } : null, chunks: activeChunks.slice(), bounds: runBounds, state, lastDeliveryX, playerX: P.x, playerY: P.y }),
      warp: (x,y) => { P.x=x; P.y=y; syncWorld(true); },
      choosePending: () => { if(state==='levelup'){ levelupCooldown=0; return applyChoice(0,buildRevision); } },
      take: () => interact(), answer: i => resolve(i),
      getLastDeliveryX: () => lastDeliveryX,
      jobAnswerPoints: () => (job ? ansPos(job.to) : null),
      jobAnswerIndex: () => (job ? job.ans.indexOf(job.word) : -1),
      // APPROVED house-column metric (roadmap 2026-10-19): house X-columns deduped at 50px over
      // ALL real chunks along the route, both endpoints excluded.
      colsBetween: (a,b) => {
        const xs=new Set(); const lo=Math.min(a,b),hi=Math.max(a,b);
        for(let cx=Math.floor(lo/WORLD_STATE.chunkWidth);cx<=Math.floor(hi/WORLD_STATE.chunkWidth);cx++)
          for(let cy=Math.floor(runBounds.minY/WORLD_STATE.chunkHeight);cy<=Math.floor(runBounds.maxY/WORLD_STATE.chunkHeight);cy++){
            const ch=WORLD_STATE.getChunk(cx,cy); if(!ch||!ch.houses) continue;
            for(const h of ch.houses) if(h.x>lo&&h.x<hi) xs.add(Math.round(h.x/50)*50);
          }
        return xs.size;
      },
      getMOB_DIFFICULTY_PROFILES: () => MOB_DIFFICULTY_PROFILES,`;

function loadGame() {
  const raw = fs.readFileSync(LOADER, 'utf8');
  assert.ok(raw.includes(MARKER), 'sandbox loader marker missing');
  let src = raw.split(MARKER)[0];
  const anchor = 'getMOB_DIFFICULTY_PROFILES: () => MOB_DIFFICULTY_PROFILES,';
  assert.ok(src.includes(anchor), 'probe anchor missing');
  src = src.replace(anchor, PROBES + '\n      ' + anchor);
  const m = new Module(LOADER);
  m.filename = LOADER;
  m.paths = Module._nodeModulePaths(path.dirname(LOADER));
  m._compile(src + '\nmodule.exports={loadGameSandbox};', LOADER);
  const loaded = m.exports.loadGameSandbox();
  return loaded;
}

function withSeed(sandbox, seed) {
  let s = seed;
  sandbox.Math.random = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

// Drive the real delivery chain: update -> makeOrder -> interact() pickup -> resolve() answer.
function runChain(sandbox, probe, count, seed) {
  withSeed(sandbox, seed);
  probe.start('rain-port');
  probe.skipTutorial();
  probe.setState('play');
  const rows = [];
  const seen = new Set();
  let previousToX = null;
  let refForNewOrders = null;
  const step = () => {
    refForNewOrders = probe.route().lastDeliveryX;
    probe.update(0.016);
    for (let i = 0; i < 20 && probe.route().state === 'levelup'; i++) { probe.choosePending(); probe.update(0.016); }
  };
  for (let n = 0; n < count; n++) {
    step();
    let r = probe.route();
    assert.ok(r.orders.length, 'no order was produced');
    const order = r.orders[0];
    assert.ok(!seen.has(order.cardEventId), 'duplicate cardEventId ' + order.cardEventId);
    seen.add(order.cardEventId);
    const b = r.bounds;
    // real pickup at the order's own house
    probe.warp(order.fromX, Math.max(b.minY + 18, Math.min(b.maxY - 18, order.fromY + 60)));
    step();
    const inter = probe.route().inter;
    assert.ok(inter && inter.cardEventId === order.cardEventId, 'real proximity must select this pickup');
    probe.take();
    r = probe.route();
    assert.ok(r.job && r.job.cardEventId === order.cardEventId, 'real interact must create the job');
    // streaming: walk far away, the destination chunk must stay pinned
    probe.warp(order.toX + 6000, 480);
    r = probe.route();
    const pinned = r.chunks.some(c => c.key === order.toChunk);
    assert.ok(pinned, 'destination chunk must stay pinned while streaming elsewhere');
    // real answer at the true answer point
    const idx = probe.jobAnswerIndex();
    const a = probe.jobAnswerPoints();
    assert.ok(a && idx >= 0, 'answer point / index unavailable');
    assert.ok(a.every(p => p.y >= b.minY + 18 && p.y <= b.maxY - 18), 'answer points must stay in the legal band');
    probe.warp(a[idx].x, a[idx].y);
    step();
    probe.answer(idx);
    r = probe.route();
    assert.equal(r.delivered, n + 1, 'real delivered must increment');
    assert.equal(r.job, null, 'real job must clear');
    const deliveredX = r.lastDeliveryX;
    rows.push({
      n: n + 1, cardEventId: order.cardEventId, fromId: order.fromId, toId: order.toId,
      fromX: order.fromX, toX: order.toX, dx: Math.abs(order.toX - order.fromX),
      deliveryCols: probe.colsBetween(order.fromX, order.toX),
      deliveredX,
      nextPickupDX: previousToX === null ? null : Math.abs(order.fromX - previousToX),
      nextPickupCols: previousToX === null ? null : probe.colsBetween(previousToX, order.fromX),
      crossChunk: order.fromChunk !== order.toChunk,
      pinned,
      pendingAfterDelivery: r.orders.map(o => ({
        fromId: o.fromId, fromX: o.fromX,
        cols: probe.colsBetween(deliveredX, o.fromX),
        sameHouse: Math.abs(o.fromX - deliveredX) < 1
      }))
    });
    previousToX = order.toX;
  }
  return rows;
}

test('DELIVERY-DISTANCE-R1: 20 real rain-port deliveries keep every next pickup on a different, non-adjacent house', () => {
  const { sandbox, probe } = loadGame();
  const rows = runChain(sandbox, probe, 20, 777);

  assert.equal(rows.length, 20, 'must complete 20 deliveries');
  assert.equal(new Set(rows.map(r => r.cardEventId)).size, 20, '20 unique cardEventIds');
  assert.ok(rows.every(r => r.crossChunk), 'every pickup->delivery must cross chunks');
  assert.ok(rows.every(r => r.pinned), 'every destination chunk must stay pinned while streaming');
  assert.ok(rows.every(r => r.deliveryCols >= 1), 'pickup->delivery must never collapse onto the same house column');

  // the historical RED: after a delivery the next pickup was the same house / 1-2 columns away.
  const nexts = rows.slice(1);
  const zero = nexts.filter(r => r.nextPickupDX === 0);
  const oneOrTwo = nexts.filter(r => r.nextPickupCols !== null && r.nextPickupCols <= 2);
  assert.equal(zero.length, 0, 'no next pickup may be the house just delivered to');
  assert.equal(oneOrTwo.length, 0, 'no next pickup may be within 2 house columns of the last delivery');

  // stronger, state-level truth: right after each delivery no pending pickup may sit within
  // 3 house columns of the delivered house, and never on the same house.
  for (const r of rows) {
    for (const p of r.pendingAfterDelivery) {
      assert.ok(p.cols >= 3, `delivery ${r.n}: pending pickup ${p.fromId} is only ${p.cols} columns away`);
      assert.equal(p.sameHouse, false, `delivery ${r.n}: pending pickup ${p.fromId} is the delivered house`);
    }
  }
});

test('DELIVERY-DISTANCE-R1: a restart or a stage switch must not carry the last delivery position over', () => {
  const { sandbox, probe } = loadGame();
  const rows = runChain(sandbox, probe, 2, 777);
  assert.ok(rows[1].deliveredX !== null, 'a real delivery must have set the reference');

  probe.start('rain-port');
  assert.equal(probe.getLastDeliveryX(), null, 'restart must clear the last delivery reference');
  probe.start('night-town');
  assert.equal(probe.getLastDeliveryX(), null, 'stage switch must clear the last delivery reference');
});

test('DELIVERY-DISTANCE-R1: the rain-port fallback pool may never emit a sub-3-column pickup', () => {
  // The rule must hold on every branch, not only on the preferred one: check the production
  // source keeps the fallback floor at the same hard minimum (3 house columns) as the primary filter.
  const src = fs.readFileSync(path.join(ROOT, 'js', 'game.js'), 'utf8');
  assert.match(src, /const minBetweenHouses = 3;/, 'hard minimum must stay at 3 house columns');
  const fallback = /const fallback = houses\.filter\(h => \{[\s\S]{0,400}?\}\);/.exec(src);
  assert.ok(fallback, 'fallback pool must exist');
  assert.match(fallback[0], /colsBetween\(h\.x, referenceX\) >= minBetweenHouses/,
    'the fallback pool must use the same >= 3 column floor as the primary filter');
  assert.doesNotMatch(fallback[0], /countHousesBetween/,
    'the fallback pool must not use the loaded-chunk-only counter');
});

test('DELIVERY-DISTANCE-R1: js/game.js carries no debug-only production hook', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'game.js'), 'utf8');
  assert.doesNotMatch(src, /__debugMakeOrder/, 'the temporary debug hook must be removed from production');
  assert.doesNotMatch(src, /__testProbe/, 'production must not reference window.__testProbe');
});
