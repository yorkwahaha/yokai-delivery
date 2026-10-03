const test = require("node:test");
const assert = require("node:assert/strict");

const CONTENT = require("../js/words.js");
const OVERWORLD = require("../js/overworld.js");

function finishMove(state) {
  for (let i = 0; i < 20 && OVERWORLD.isMoving(state); i++) {
    OVERWORLD.update(state, 0.05);
  }
}

test("overworld exposes one large connected route map", () => {
  assert.ok(OVERWORLD.MAP_W > OVERWORLD.VIEW_W);
  assert.ok(OVERWORLD.MAP_H > OVERWORLD.VIEW_H);
  assert.equal(OVERWORLD.NODES.filter(n => n.type === "stage").length, 5);

  const seen = new Set(["gate"]);
  const queue = ["gate"];
  while (queue.length) {
    const id = queue.shift();
    for (const [a, b] of OVERWORLD.EDGES) {
      const next = a === id ? b : b === id ? a : null;
      if (next && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  assert.equal(seen.size, OVERWORLD.NODES.length);
});

test("mini courier moves node-to-node along directional roads", () => {
  global.STORE = {
    isStageCompleted: id => id === "night-town",
    isStageUnlocked: id => id === "night-town" || id === "rain-port"
  };
  const state = OVERWORLD.createState("gate");
  assert.equal(state.currentId, "gate");

  assert.equal(OVERWORLD.move(state, 1, 0), true);
  finishMove(state);
  assert.equal(state.currentId, "night-town");

  assert.equal(OVERWORLD.move(state, 1, 0), true);
  finishMove(state);
  assert.equal(state.currentId, "cross-west");

  assert.equal(OVERWORLD.move(state, 0, 1), true);
  finishMove(state);
  assert.equal(state.currentId, "rain-port");
  delete global.STORE;
});

test("rain-port is implemented but stays sealed until night-town is cleared", () => {
  delete global.STORE;
  const night = OVERWORLD.createState("night-town");
  const ready = OVERWORLD.confirm(night);
  assert.equal(ready.ok, true);
  assert.equal(ready.stageId, "night-town");
  assert.equal(CONTENT.getStage(ready.stageId).implemented, true);

  const rain = OVERWORLD.createState("rain-port");
  const sealed = OVERWORLD.confirm(rain);
  assert.equal(sealed.ok, false);
  assert.equal(sealed.locked, true);
  assert.equal(CONTENT.getStage(sealed.stageId).implemented, true);
  assert.ok(rain.lockedPulse > 0);

  global.STORE = {
    isStageCompleted: id => id === "night-town",
    isStageUnlocked: id => id === "night-town" || id === "rain-port"
  };
  const unlocked = OVERWORLD.confirm(OVERWORLD.createState("rain-port"));
  assert.equal(unlocked.ok, true);
  assert.equal(unlocked.stageId, "rain-port");
  delete global.STORE;
});

test("overworld camera follows the miniature player but stays inside map bounds", () => {
  const state = OVERWORLD.createState("gate");
  assert.ok(state.camX >= 0);
  assert.ok(state.camY >= 0);

  const far = OVERWORLD.createState("yomi");
  OVERWORLD.update(far, 1);
  assert.ok(far.camX >= 0 && far.camX <= OVERWORLD.MAP_W - OVERWORLD.VIEW_W);
  assert.ok(far.camY >= 0 && far.camY <= OVERWORLD.MAP_H - OVERWORLD.VIEW_H);
});

test("touch hit testing uses scrolled world coordinates", () => {
  const state = OVERWORLD.createState("yomi");
  const node = OVERWORLD.currentNode(state);
  const sx = node.x - state.camX;
  const sy = node.y - state.camY;
  const hit = OVERWORLD.hitTest(state, sx, sy);
  assert.equal(hit.id, "yomi");
});

test("overworld renderer can draw the map without image assets", () => {
  const gradient = { addColorStop() {} };
  const ctx = new Proxy({
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient
  }, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return () => {};
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    }
  });

  const state = OVERWORLD.createState("gate");
  assert.doesNotThrow(() => OVERWORLD.draw(ctx, state, 1.25, 0));
});

test('expanded viewport draws a full-width title and anchors the clickable back button at its corner',()=>{
 const rects=[];const gradient={addColorStop(){}};const ctx=new Proxy({fillRect:(...a)=>rects.push(a),createLinearGradient:()=>gradient,createRadialGradient:()=>gradient},{get:(o,k)=>o[k]||(()=>{})});
 global.VIEWPORT={bounds:()=>({left:-450,top:-40,width:1800,height:680})};
 try {const back=OVERWORLD.backButton();assert.equal(back.x,-432);assert.equal(back.y,-22);OVERWORLD.draw(ctx,OVERWORLD.createState('gate'),0,0);assert.ok(rects.some(r=>r[0]===-450&&r[1]===-40&&r[2]===1800&&r[3]===72));}finally{delete global.VIEWPORT;}
});
