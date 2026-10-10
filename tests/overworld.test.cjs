const test = require("node:test");
const assert = require("node:assert/strict");

const CONTENT = require("../js/words.js");
const OVERWORLD = require("../js/overworld.js");

test('multi-hop cruising completes all steps and empties its queue', () => {
  global.STORE = { isStageUnlocked: () => true, isStageCompleted: () => true };
  try {
    const state = OVERWORLD.createState('gate');
    assert.equal(OVERWORLD.moveTo(state, 'rain-port'), true);
    for (let i = 0; i < 10; i++) OVERWORLD.update(state, 1);
    assert.equal(state.currentId, 'rain-port');
    assert.equal(state.targetId, null);
    assert.equal(state.pathQueue.length, 0);
  } finally { delete global.STORE; }
});

test('wide viewport camera keeps raster map covering every visible edge',()=>{
  global.VIEWPORT={bounds:()=>({left:-200,top:0,right:1100,bottom:600})};
  try {
    for(const id of ['gate','yomi']){
      const state=OVERWORLD.createState(id);OVERWORLD.update(state,1);
      assert.ok(state.camX-200>=0);assert.ok(state.camX+1100<=OVERWORLD.MAP_W);
      assert.ok(state.camY>=0);assert.ok(state.camY+600<=OVERWORLD.MAP_H);
    }
  } finally {delete global.VIEWPORT;}
});

test('map background is baked once while distant landmarks are not submitted',()=>{
  const vm=require('node:vm'),fs=require('node:fs');let canvases=0,fills=0,blits=0;const labels=[];
  const gradient={addColorStop(){}};
  const ctx=new Proxy({fillText:t=>labels.push(t),measureText:t=>({width:String(t).length*12}),createLinearGradient:()=>gradient,createRadialGradient:()=>gradient,drawImage:()=>blits++},{get:(o,k)=>o[k]||(()=>{})});
  const offscreen=new Proxy({fillRect:()=>fills++},{get:(o,k)=>o[k]||(()=>{})});
  const env={document:{createElement:()=>{canvases++;return {getContext:()=>offscreen};}}};env.window=env;
  vm.runInNewContext(fs.readFileSync('js/overworld.js','utf8'),env);
  const state=env.OVERWORLD.createState('gate');state.camX=state.camY=0;
  env.OVERWORLD.draw(ctx,state,0);const baked=fills;env.OVERWORLD.draw(ctx,state,1);
  assert.equal(canvases,1);assert.equal(fills,baked);assert.equal(blits,2);
  assert.ok(!labels.includes(env.OVERWORLD.NODES.find(n=>n.id==='yomi').label));
});

test('map courier is twice as tall and mist freezes under reduced motion',()=>{
  const vm=require('node:vm'),fs=require('node:fs');
  for(const reduce of [false,true]) {
    const positions=[],images=[],gradient={addColorStop(){}};
    const ctx=new Proxy({translate:(...p)=>positions.push(p),drawImage:(...p)=>images.push(p),createLinearGradient:()=>gradient,createRadialGradient:()=>gradient},{get:(o,k)=>o[k]||(()=>{})});
    const player={complete:true,naturalWidth:216,naturalHeight:352};
    const env={ART:{player,overworld_night_v2:{naturalWidth:1641}},matchMedia:()=>({matches:reduce})};env.window=env;
    vm.runInNewContext(fs.readFileSync('js/overworld.js','utf8'),env);
    const state=env.OVERWORLD.createState('gate');
    env.OVERWORLD.draw(ctx,state,0);const first=JSON.stringify(positions);positions.length=0;
    env.OVERWORLD.draw(ctx,state,10);
    assert.equal(images.find(p=>p[0]===player).at(-1),108);
    assert.equal(first===JSON.stringify(positions),reduce);
  }
});

function finishMove(state) {
  for (let i = 0; i < 20 && OVERWORLD.isMoving(state); i++) {
    OVERWORLD.update(state, 0.05);
  }
}

test('playable landmarks change drawing only after completion and the selected stage shows its actual best score',()=>{
  let completed=false;const calls=[],texts=[];const gradient={addColorStop(){}};
  const ctx=new Proxy({fillText:t=>texts.push(t),createLinearGradient:()=>gradient,createRadialGradient:()=>gradient},{get:(o,k)=>o[k]||(()=>{})});
  global.ART={map_night_town_v1:{complete:true,naturalWidth:1774,naturalHeight:887}};
  global.RENDERER={drawFrame:(ctx,img,key,index)=>calls.push({key,index})};
  global.STORE={isStageCompleted:id=>id==='night-town'&&completed,isStageUnlocked:id=>id==='night-town',getStageStats:()=>({bestScore:1234})};
  try {
    const state=OVERWORLD.createState('night-town');OVERWORLD.draw(ctx,state,0,0);
    assert.equal(calls.find(c=>c.key==='map_night_town_v1').index,0);
    completed=true;calls.length=0;texts.length=0;OVERWORLD.draw(ctx,state,0,0);
    assert.equal(calls.find(c=>c.key==='map_night_town_v1').index,1);
    assert.ok(texts.some(t=>String(t).includes('1,234')));assert.ok(texts.some(t=>String(t).includes('配達済')));
    assert.equal(OVERWORLD.confirm(OVERWORLD.createState('sakura-pass')).ok,false);
  } finally {delete global.ART;delete global.RENDERER;delete global.STORE;}
});

test('compact map title and subtitle retain a full readable line gap inside their header',()=>{
  const labels=[],gradient={addColorStop(){}};
  const ctx=new Proxy({fillText:(text,x,y)=>labels.push({text,y}),createLinearGradient:()=>gradient,createRadialGradient:()=>gradient},{get:(o,k)=>o[k]||(()=>{})});
  global.UI={readableFont:()=> '700 27px sans-serif'};
  try {
    OVERWORLD.draw(ctx,OVERWORLD.createState('gate'),0,0);
    const title=labels.find(l=>l.text==='妖怪快遞社・旅路圖'),subtitle=labels.find(l=>l.text==='道をたどって、次の配達先へ');
    assert.ok(subtitle.y-title.y>=27);assert.ok(subtitle.y+27*.2<=72);
  } finally {delete global.UI;}
});

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
  assert.equal(rain.currentId, "rain-port");
  assert.equal(rain.targetId, null);

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
