"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const plan = require("../js/sakura-terrain-plan.js");

function sample(origin, size, catalog) {
  const counts = { dirt: 0, steps: 0, transition: 0 };
  let agree = 0;
  let pairs = 0;
  let isolated = 0;
  let unsupported = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tx = origin.tx + x;
      const ty = origin.ty + y;
      const tile = plan.planTile(tx, ty, catalog);
      counts[tile.material] += 1;
      if (tile.status === "UNSUPPORTED_NEIGHBORHOOD") unsupported += 1;
      const base = plan.baseMaterial(tx, ty);
      if (x + 1 < size && base === plan.baseMaterial(tx + 1, ty)) agree += 1;
      if (x + 1 < size) pairs += 1;
      const around = [
        plan.baseMaterial(tx, ty - 1), plan.baseMaterial(tx + 1, ty),
        plan.baseMaterial(tx, ty + 1), plan.baseMaterial(tx - 1, ty)
      ];
      if (around.every(value => value !== base)) isolated += 1;
    }
  }
  const total = size * size;
  return {
    counts,
    dirt: counts.dirt / total,
    steps: counts.steps / total,
    transition: counts.transition / total,
    agree: agree / pairs,
    isolated,
    unsupported
  };
}

function walk(ty, from, to) {
  const step = from < to ? 1 : -1;
  let prev = "";
  let changes = 0;
  let sawSteps = false;
  let dirtAfterSteps = false;
  for (let tx = from; step > 0 ? tx <= to : tx >= to; tx += step) {
    const material = plan.baseMaterial(tx, ty);
    if (prev && material !== prev) changes += 1;
    if (material === "steps") sawSteps = true;
    if (sawSteps && material === "dirt") dirtAfterSteps = true;
    prev = material;
  }
  return { changes, dirtAfterSteps };
}

function fullCatalog() {
  const masks = {};
  for (const item of plan.REQUIRED_ART) masks[item.id] = "art:" + item.id;
  return {
    fills: { dirt: ["ground_mountain_dirt", "ground_mountain_dirt_b"], steps: ["ground_sakura_steps", "ground_sakura_steps_b"] },
    masks
  };
}

test("the same world tile repeats across calls, negative coordinates and chunk edges", () => {
  const a = plan.planTile(-7, -3);
  const b = plan.planTile(-7, -3);
  assert.deepEqual(a, b);
  assert.equal(plan.worldTile(-513, -1).tx, -2);
  assert.equal(plan.worldTile(-512, 10).tx, -1);
  assert.equal(plan.worldTile(899, 100).tx, plan.worldTile(901, 100).tx);
  assert.equal(plan.worldTile(1800, 400).tx, 3);
  assert.deepEqual(plan.planTile(4, 8), plan.planTile(plan.worldTile(4 * 512 + 20, 8 * 512 + 20).tx, plan.worldTile(4 * 512 + 20, 8 * 512 + 20).ty));
  const renderer = fs.readFileSync(path.join(__dirname, "../js/renderer.js"), "utf8");
  assert.match(renderer, /if \(col < SAKURA_SEAM_TX\) return "dirt"/);
  assert.equal(plan.LIVE_RULE, "tx<3 dirt, tx=3 transH, tx>=4 steps");
});

test("a 128 by 128 sample stays near the mix and in large patches", () => {
  const started = Date.now();
  const view = sample({ tx: -40, ty: -40 }, 128);
  const elapsed = Date.now() - started;
  assert.ok(view.dirt >= 0.5 && view.dirt <= 0.68, "dirt " + view.dirt);
  assert.ok(view.steps >= 0.2 && view.steps <= 0.36, "steps " + view.steps);
  assert.ok(view.transition >= 0.1 && view.transition <= 0.2, "transition " + view.transition);
  assert.ok(view.agree >= 0.85, "agree " + view.agree);
  assert.equal(view.isolated, 0);
  assert.equal(view.unsupported, 0);
  assert.ok(elapsed < 1000, "elapsed " + elapsed);
  const east = walk(0, 0, 200);
  const west = walk(0, 0, -200);
  assert.ok(east.changes >= 2 && east.dirtAfterSteps);
  assert.ok(west.changes >= 2 && west.dirtAfterSteps);
  const shrine = plan.SHRINES[0];
  let steps = 0;
  let total = 0;
  for (let y = shrine.ty - 8; y <= shrine.ty + 8; y++) {
    for (let x = shrine.tx - 8; x <= shrine.tx + 8; x++) {
      total += 1;
      if (plan.baseMaterial(x, y) === "steps") steps += 1;
    }
  }
  assert.ok(steps / total > view.steps, "shrine steps " + (steps / total));
});

test("missing transition art is not a pass and a full catalog can pass", () => {
  let missing = null;
  let have = null;
  for (let y = -30; y <= 30 && (!missing || !have); y++) {
    for (let x = -30; x <= 30 && (!missing || !have); x++) {
      const tile = plan.planTile(x, y);
      if (!missing && tile.status === "MISSING_REQUIRED_ART") missing = tile;
      if (!have && tile.mask === "h-dirt-west" && tile.status === "PASS") have = tile;
    }
  }
  assert.ok(missing, "current art is missing a required mask");
  assert.equal(missing.assetId, null);
  assert.notEqual(missing.status, "PASS");
  assert.ok(have);
  assert.equal(have.assetId, "ground_trans_dirt_to_steps_h");
  const ready = plan.planTile(missing.tx, missing.ty, fullCatalog());
  assert.equal(ready.status, "PASS");
  assert.equal(ready.mask, missing.mask);
  const ids = new Set();
  for (let y = 0; y < 24; y++) {
    for (let x = 0; x < 24; x++) {
      const tile = plan.planTile(x, y, fullCatalog());
      if (tile.material === "dirt") ids.add(tile.assetId);
    }
  }
  assert.ok(ids.has("ground_mountain_dirt") && ids.has("ground_mountain_dirt_b"));
  assert.equal([...ids].every(id => id.startsWith("ground_mountain_dirt")), true);
});
