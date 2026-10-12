const test = require('node:test');
const assert = require('node:assert/strict');
const OVERWORLD = require('../js/overworld.js');

const fakeSprite = Object.freeze({complete:true,naturalWidth:832,naturalHeight:1024});
function setup() {
  const before = {ART:global.ART,STORE:global.STORE,CONTENT:global.CONTENT,UI:global.UI};
  global.ART = {
    overworld_approved_v2:{naturalWidth:3840,naturalHeight:2166},
    player_walk_left_v2:fakeSprite, player_walk_right_v2:fakeSprite,player_idle_v2:fakeSprite
  };
  global.STORE = {isStageCompleted:()=>true,isStageUnlocked:()=>true,getStageStats:()=>({bestScore:0})};
  global.CONTENT = {getStage:id=>({id,implemented:id==='night-town'||id==='rain-port'})};
  global.UI = {drawWoodTag(){},drawButton(){},drawWashiBoard(){}};
  return () => {for(const [key,v] of Object.entries(before))if(v===undefined)delete global[key];else global[key]=v;};
}
function spriteDraw(state, elapsed=0) {
  const transformations=[], drawn=[];
  const gradient={addColorStop(){}};
  const ctx = new Proxy({
    scale:(x,y)=>transformations.push([x,y]),
    drawImage:(image,...args)=>drawn.push({image,args}),
    createRadialGradient:()=>gradient,createLinearGradient:()=>gradient
  },{get:(target,key)=>key in target ? target[key] : (()=>{})});
  OVERWORLD.draw(ctx,state,elapsed);
  return {transformations,drawn:drawn.filter(d=>d.image===fakeSprite),
    mirrored:transformations.some(([x,y])=>x===-1&&y===1)};
}
test('returning from rain port faces left for each road segment and while idle',()=>{
  const restore=setup();
  try {
    const state=OVERWORLD.createState('rain-port');
    assert.equal(state.facing,1,'default sprite looks right');
    assert.equal(OVERWORLD.moveTo(state,'night-town'),true);
    assert.equal(state.facing,-1,'first leftward segment is mirrored');
    assert.equal(spriteDraw(state,0).mirrored,true);
    assert.ok(spriteDraw(state,0).drawn.length,'walking character is drawn');
    OVERWORLD.update(state,1);
    assert.equal(state.targetId,'night-town','second segment starts automatically');
    assert.equal(state.facing,-1,'auto-path next hop still faces left');
    assert.equal(spriteDraw(state,.1).mirrored,true);
    OVERWORLD.update(state,1);
    assert.equal(state.currentId,'night-town');
    assert.equal(state.targetId,null);
    assert.equal(state.facing,-1,'do not snap back to facing right on arrival');
    assert.equal(spriteDraw(state).mirrored,true,'idle pose retains last travel direction');
  } finally {restore();}
});
test('traveling right uses original sprite and changes direction after turning around',()=>{
  const restore=setup();
  try {
    const state=OVERWORLD.createState('night-town');
    assert.equal(OVERWORLD.moveTo(state,'rain-port'),true);
    assert.equal(state.facing,1);
    assert.equal(spriteDraw(state).mirrored,false,'right walk is not mirrored');
    for(let i=0;i<4&&OVERWORLD.isMoving(state);i++)OVERWORLD.update(state,1);
    assert.equal(state.currentId,'rain-port');
    assert.equal(OVERWORLD.moveTo(state,'night-town'),true);
    assert.equal(state.facing,-1);
    assert.equal(spriteDraw(state).mirrored,true,'turns as soon as reversing');
  } finally {restore();}
});
test('viewing an earlier locked map stage never rotates or teleports stationary player',()=>{
  const restore=setup();
  try {
    const state=OVERWORLD.createState('rain-port');
    assert.equal(OVERWORLD.inspect(state,'night-town'),true);
    assert.equal(state.facing,1,'camera-only browse is not a walking action');
    assert.equal(state.currentId,'rain-port');
    assert.equal(spriteDraw(state).mirrored,false);
  } finally {restore();}
});
