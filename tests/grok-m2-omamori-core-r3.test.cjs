"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadGame } = require("./helpers/game-runtime.cjs");

function boot() {
  const probe = loadGame({ seed: 1 });
  probe.startRun("night-town");
  return probe;
}

function core(probe) {
  const api = probe.env.OMAMORI_CORE;
  assert.ok(api && typeof api.build === "function");
  return api;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function queueRandom(probe, values) {
  let i = 0;
  probe.env.Math.random = () => (i < values.length ? values[i++] : 0.99);
}

function press(probe, event) {
  probe.events.keydown(Object.assign({
    repeat: false,
    preventDefault() {},
    target: null
  }, event));
}

function kill(probe, type, roll, extra = {}) {
  const here = probe.snapshot();
  queueRandom(probe, roll);
  const enemy = {
    x: here.x,
    y: here.y,
    hp: 1,
    max: 1,
    type,
    shield: false,
    ...extra
  };
  probe.hurt(enemy, 5);
  return enemy;
}

function pickupLatest(probe) {
  const drops = core(probe).drops();
  assert.ok(drops.length >= 1, "地面應有御守掉落");
  const drop = drops[drops.length - 1];
  probe.placeAt(drop.x, drop.y);
  queueRandom(probe, []);
  probe.update(0.05);
  return drop;
}

function assertNoCharmCards(choices, label) {
  const hit = choices.filter(card => card.type === "charm" || String(card.id || "").startsWith("charm_"));
  assert.deepEqual(plain(hit.map(card => card.id)), [], label);
}

test("升級卡池不含六種 charm_*，武器與被動仍在", () => {
  const probe = boot();
  probe.offerUp();
  let choices = probe.currentChoices();
  assert.ok(choices.length > 0, "升級仍有非御守選項");
  assert.ok(choices.some(card => card.type === "weapon" || card.type === "passive"));
  assertNoCharmCards(choices, "Lv1 卡池");
  const picked = probe.takeLevelUpChoice(0);
  assert.equal(picked.ok, true);
  assert.notEqual(picked.type, "charm");
  probe.offerUp();
  choices = probe.currentChoices();
  assertNoCharmCards(choices, "升級後卡池");
  const build = core(probe).build();
  assert.deepEqual(plain(build.charms), []);
  assert.deepEqual(plain(build.charmLevels), {});
  assert.equal(build.WL.katana, 1);
  assert.ok(Array.isArray(build.mutations) && Array.isArray(build.duos));
});

test("擊殺機率邊界、同敵只擲一次、掉落數量有上限", () => {
  const probe = boot();
  const api = core(probe);
  assert.equal(api.NORMAL_CHANCE, 0.015);
  assert.equal(api.ELITE_CHANCE, 0.02);

  const added = (type, roll, extra) => {
    const before = api.drops().length;
    kill(probe, type, roll, extra);
    return api.drops().length - before;
  };

  assert.equal(added("ghost", [0.014, 0]), 1);
  assert.equal(added("runner", [0.015]), 0);
  assert.equal(added("tank", [0.019, 0]), 1);
  assert.equal(added("tank", [0.02]), 0);
  assert.equal(added("ghost", [0.016, 0], { elite: true }), 1);
  assert.equal(added("boss", [0, 0]), 0);
  assert.equal(added("mis", [0, 0], { w: { jp: "あ", zh: "亞" } }), 0);

  const once = { x: 10, y: 10, hp: 1, type: "ghost", shield: false };
  queueRandom(probe, [0, 0]);
  probe.hurt(once, 5);
  const afterFirst = api.drops().length;
  queueRandom(probe, [0, 0]);
  probe.hurt(once, 5);
  assert.equal(api.drops().length, afterFirst);
  assert.equal(once.charmRolled, true);

  for (let n = 0; n < 30; n++) {
    queueRandom(probe, [0, 0]);
    probe.hurt({ x: n, y: 20, hp: 1, type: "ghost", shield: false }, 5);
  }
  assert.equal(api.drops().length, api.DROP_CAP);
});

test("地面只畫核准御守圖，碰到才拾取，同種升到 Lv3", () => {
  const probe = boot();
  const api = core(probe);
  const art = { complete: true, naturalWidth: 40, naturalHeight: 80 };
  probe.env.ART = { [api.ART_KEY]: art };
  const drawn = [];
  const geometry = [];
  probe.ctx.drawImage = image => { drawn.push(image); };
  probe.ctx.fillRect = () => geometry.push("fill");
  probe.ctx.arc = () => geometry.push("arc");
  probe.ctx.strokeRect = () => geometry.push("stroke");

  const here = probe.snapshot();
  queueRandom(probe, [0, 0.2]);
  probe.hurt({ x: here.x + 100, y: here.y, hp: 1, type: "ghost", shield: false }, 5);
  const far = api.drops().at(-1);
  assert.ok(far);
  assert.equal(api.paintDrops() >= 1, true);
  assert.equal(drawn.includes(art), true);
  assert.deepEqual(geometry, []);
  queueRandom(probe, []);
  probe.update(0.05);
  const stayed = api.drops().find(drop => drop.id === far.id);
  assert.ok(stayed, "100px 外的御守不會被吸過來");
  assert.equal(stayed.x, far.x);
  assert.equal(stayed.y, far.y);
  assert.deepEqual(plain(api.build().charms), []);

  probe.env.ART[api.ART_KEY] = { complete: false, naturalWidth: 40, naturalHeight: 80 };
  drawn.length = 0;
  assert.equal(api.paintDrops(), 0);
  assert.deepEqual(drawn, []);
  probe.env.ART[api.ART_KEY] = art;

  for (let n = 0; n < 3; n++) {
    kill(probe, "ghost", [0, 0.2]);
    pickupLatest(probe);
  }
  let build = api.build();
  assert.deepEqual(plain(build.charms), ["charm_step"]);
  assert.equal(build.charmLevels.charm_step, 3);
  assert.equal(api.effects().step, 84);
  assert.equal(api.effects().speed, 230 + api.effects().waraji + api.effects().step);

  kill(probe, "ghost", [0, 0.2]);
  pickupLatest(probe);
  build = api.build();
  assert.equal(build.charmLevels.charm_step, 3);
  assert.equal(probe.snapshot().state, "play");
  assert.equal(api.hudModel().pendingDrop, null);
});

test("HUD 三槽、第四種替換或放棄，重開局清空", () => {
  const probe = boot();
  const api = core(probe);
  const hudCalls = [];
  probe.env.UI.drawCharmHud = (_ctx, model) => {
    hudCalls.push(model);
    return [{ id: "charm_slot_0", x: 0, y: 0, w: 10, h: 10 }];
  };
  probe.env.UI.drawCharmSwap = (_ctx, model) => {
    hudCalls.push({ swap: model });
    return [
      { id: "swap_0", x: 0, y: 0, w: 10, h: 10 },
      { id: "swap_1", x: 20, y: 0, w: 10, h: 10 },
      { id: "swap_2", x: 40, y: 0, w: 10, h: 10 },
      { id: "swap_discard", x: 0, y: 40, w: 20, h: 10 }
    ];
  };

  for (const roll of [0, 0.2, 0.4]) {
    kill(probe, "ghost", [0, roll]);
    pickupLatest(probe);
  }
  const before = api.build().charms.slice();
  assert.deepEqual(plain(before), ["charm_power", "charm_step", "charm_gather"]);
  assert.equal(api.effects().dmg, 1.2 + 0.2);
  assert.equal(api.effects().magnet, 110 + 75);
  assert.equal(api.effects().speed, 230 + 28);

  probe.stepFrame(16.7);
  const hud = hudCalls.find(call => call && call.maxSlots === 3);
  assert.ok(hud, "玩法幀要呼叫 drawCharmHud");
  assert.equal(hud.charms.length, 3);
  assert.equal(hud.charms[1].name, "風步守");
  assert.equal(hud.charms[1].level, 1);
  assert.equal(hud.charms[1].maxLevel, 3);
  assert.equal(hud.pendingDrop, null);

  kill(probe, "ghost", [0, 0.5]);
  pickupLatest(probe);
  assert.equal(probe.snapshot().state, "charmswap");
  assert.deepEqual(plain(api.build().charms), plain(before));
  assert.equal(api.hudModel().pendingDrop.id, "charm_cadence");
  assert.equal(api.swapModel().pending.name, "疾奏守");

  press(probe, { code: "ArrowRight", key: "ArrowRight" });
  assert.equal(api.swapModel().selectedIndex, 1);
  press(probe, { code: "Enter", key: "Enter" });
  let build = api.build();
  assert.equal(probe.snapshot().state, "play");
  assert.deepEqual(plain(build.charms), ["charm_power", "charm_cadence", "charm_gather"]);
  assert.equal(build.charmLevels.charm_cadence, 1);
  assert.equal(build.charmLevels.charm_step, undefined);
  assert.equal(api.effects().rate, 0.25);
  assert.equal(api.effects().speed, 230);

  kill(probe, "ghost", [0, 0.7]);
  pickupLatest(probe);
  assert.equal(probe.snapshot().state, "charmswap");
  const held = api.build().charms.slice();
  press(probe, { code: "Escape", key: "Escape" });
  assert.equal(probe.snapshot().state, "play");
  assert.deepEqual(plain(api.build().charms), plain(held));
  assert.equal(api.hudModel().pendingDrop, null);

  kill(probe, "tank", [0, 0.9]);
  pickupLatest(probe);
  assert.equal(probe.snapshot().state, "charmswap");
  assert.equal(api.resolveSwap(2), true);
  build = api.build();
  assert.equal(build.charms[2], "charm_guard");
  assert.equal(build.charmLevels.charm_guard, 1);
  const expectedGuard = Math.min(10, Math.max(Number.MIN_VALUE, parseFloat((10 * 0.9).toPrecision(12))));
  assert.equal(api.guardOilLoss(10), expectedGuard);
  assert.equal(api.effects().reach, 1);

  kill(probe, "ghost", [0, 0.7]);
  pickupLatest(probe);
  assert.equal(api.build().charmLevels.charm_reach, undefined);
  for (let n = 0; n < 3; n++) {
    if (probe.snapshot().state === "charmswap") api.resolveSwap("discard");
    kill(probe, "ghost", [0, 0.7]);
    pickupLatest(probe);
    if (probe.snapshot().state === "charmswap") {
      api.resolveSwap(0);
      break;
    }
  }
  if (!api.build().charms.includes("charm_reach")) {
    kill(probe, "ghost", [0, 0.7]);
    pickupLatest(probe);
    if (probe.snapshot().state === "charmswap") api.resolveSwap(0);
  }
  assert.equal(api.build().charms.includes("charm_reach"), true);
  assert.equal(api.effects().reach, 1.1);
  const legacy = api.effectsOf({ charms: ["charm_step"] });
  assert.equal(legacy.speed, 230 + api.effects().waraji + 28);
  const leveled = api.effectsOf({ charms: ["charm_step"], charmLevels: { charm_step: 1 } });
  assert.equal(leveled.speed, legacy.speed);
  const lv3 = api.effectsOf({ charms: ["charm_reach"], charmLevels: { charm_reach: 3 } });
  assert.equal(lv3.reach, 1.3);

  const farId = api.drops()[0];
  if (farId) {
    probe.placeAt(farId.x + 2000, farId.y);
    queueRandom(probe, []);
    probe.update(50);
    assert.equal(api.drops().some(drop => drop.id === farId.id), false);
  }

  probe.startRun("night-town");
  const reset = api.build();
  assert.deepEqual(plain(reset.charms), []);
  assert.deepEqual(plain(reset.charmLevels), {});
  assert.deepEqual(plain(api.drops()), []);
  assert.equal(probe.snapshot().state, "play");
  assert.equal(reset.WL.katana, 1);
  assert.equal(api.effects().speed, 230);
});

test("風步守與神足草履的速度只相加", () => {
  const probe = boot();
  const api = core(probe);
  let found = false;
  for (let n = 0; n < 36 && !found; n++) {
    if (probe.snapshot().state !== "levelup") probe.offerUp();
    if (probe.snapshot().state !== "levelup") break;
    const choices = probe.currentChoices();
    const idx = choices.findIndex(card => card.type === "passive" && card.id === "spd");
    if (idx >= 0) {
      const picked = probe.takeLevelUpChoice(idx);
      found = picked.ok === true;
      break;
    }
    const picked = probe.takeLevelUpChoice(0);
    if (!picked.ok) break;
  }
  assert.equal(found, true, "升級選項應能選到神足草履");
  assert.equal(api.effects().waraji, 35);
  kill(probe, "ghost", [0, 0.2]);
  pickupLatest(probe);
  const parts = api.effects();
  assert.equal(parts.step, 28);
  assert.equal(parts.waraji, 35);
  assert.equal(parts.speed, 230 + 35 + 28);
  assert.equal(api.build().WL.katana >= 1, true);
});
