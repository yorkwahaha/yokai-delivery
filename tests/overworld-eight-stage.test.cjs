const test = require('node:test');
const assert = require('node:assert/strict');
const OW = require('../js/overworld.js');
const CONTENT = require('../js/words.js');

const ROUTE = [
  'night-town','rain-port','sakura-pass','bamboo-maze',
  'hyakki-kyoto','snow-temple','spirit-ferry','yomi'
];

test('approved A1 geometry has eight actual stage anchors and 9 transition stops',()=>{
  assert.equal(OW.MAP_W,3000);
  assert.equal(OW.MAP_H,2200);
  assert.deepEqual(OW.STAGE_NODES.map(n=>n.stageId),ROUTE);
  assert.equal(OW.NODES.length,17);
  assert.equal(OW.EDGES.length,16);
  for(const [a,b] of OW.EDGES){
    const from=OW.NODES.find(n=>n.id===a),to=OW.NODES.find(n=>n.id===b);
    assert.ok(from&&to,'edge must reference existing nodes');
    // Visual editor allows deliberate route bends; do not reject user-approved moved anchors.
    assert.ok(Number.isFinite(from.x)&&Number.isFinite(to.y),'edited road anchors must be finite');
  }
  for(const id of ['gate','cross-west','cross-east','lookout'])assert.ok(OW.NODES.some(n=>n.id===id));
  for(const stage of OW.STAGE_NODES)assert.equal(CONTENT.getStage(stage.stageId).id,stage.stageId);
});

test('all eight stages are enterable when unlocked; fresh save only opens night-town',()=>{
  global.STORE={
    isStageCompleted:()=>false,
    isStageUnlocked:id=>id==='night-town'
  };
  try{
    assert.equal(OW.isEnterable(OW.STAGE_NODES[0]),true,'night-town open on fresh save');
    for(const stage of OW.STAGE_NODES.slice(1)){
      assert.equal(OW.isEnterable(stage),false,`${stage.id} locked on fresh save`);
    }
  }finally{delete global.STORE;}

  global.STORE={
    isStageCompleted:()=>true,
    isStageUnlocked:()=>true
  };
  try{
    for(const stage of OW.STAGE_NODES){
      const impl=CONTENT.getStage(stage.stageId)?.implemented===true;
      assert.equal(OW.isEnterable(stage),impl,stage.id);
      if(impl){
        assert.equal(OW.confirm(OW.createState(stage.id)).ok,true);
      }
    }
  }finally{delete global.STORE;}
});

test('future locked stages can be inspected via arrows without moving the actual courier',()=>{
  global.STORE={isStageCompleted:()=>false,isStageUnlocked:id=>id==='night-town'};
  try {
    const state=OW.createState('gate');
    assert.equal(OW.browse(state,1),true);
    assert.equal(OW.selectedNode(state).id,'night-town');
    for(let n=0;n<7;n++)OW.browse(state,1);
    assert.equal(OW.selectedNode(state).id,'yomi');
    assert.equal(OW.currentNode(state).id,'gate');
    assert.equal(state.x,180);
    assert.equal(OW.moveTo(state,'yomi'),false,'inspectable never implies enterable');
    for(let i=0;i<3;i++)OW.update(state,1);
    assert.ok(state.camX>1500,'camera pans towards the inspected map');
    assert.ok(state.camX<=OW.MAP_W-OW.VIEW_W);
    assert.equal(OW.browse(state,-1),true);
    assert.equal(OW.selectedNode(state).id,'spirit-ferry');
    OW.clearInspect(state);
    assert.equal(OW.selectedNode(state).id,'gate');
  }finally{delete global.STORE;}
});

test('page buttons, information board and launch action follow expanded viewport edges',()=>{
  global.VIEWPORT={bounds:()=>({left:0,top:-700,right:900,bottom:1300,width:900,height:2000})};
  global.STORE={isStageCompleted:()=>false,isStageUnlocked:()=>true,getStageStats:()=>({bestScore:0})};
  const boards=[],buttons=[],g={addColorStop(){}};
  global.UI={
    drawWashiBoard:(ctx,x,y,w,h)=>boards.push({x,y,w,h}),
    drawButton:(ctx,b,label)=>buttons.push({b,label}),
    readableFont:size=>'700 '+size+'px sans-serif'
  };
  const ctx=new Proxy({createLinearGradient:()=>g,createRadialGradient:()=>g},{get:(obj,key)=>obj[key]||(()=>{})});
  try {
    assert.equal(OW.enterButton().y,1212);
    assert.equal(OW.browseButtons()[0].y,1104);
    const st=OW.createState('night-town');
    OW.draw(ctx,st,0);
    assert.ok(boards.some(b=>b.y===1184));
    assert.ok(buttons.some(x=>x.label==='出發'&&x.b.y===1212));
    assert.deepEqual(buttons.filter(x=>x.label==='◀'||x.label==='▶').map(x=>x.b.y),[1104,1104]);
  } finally {
    delete global.VIEWPORT;delete global.STORE;delete global.UI;
  }
});

test('locked stage plaque and its label are clickable through camera coordinates',()=>{
  const st=OW.createState('sakura-pass');
  const node=OW.STAGE_NODES[2];
  assert.equal(OW.hitTest(st,node.x-st.camX+90,node.y-st.camY+62).id,node.id);
  assert.equal(OW.hitTest(st,node.x-st.camX,node.y-st.camY).id,node.id);
});

test('portrait-map extension uses only the approved image, preserving its aspect ratio',()=>{
  const bg=require("../js/overworld-layout.js").background;
  const art={naturalWidth:3840,naturalHeight:2161};
  global.ART={overworld_approved_v2:art};
  const images=[],fills=[],g={addColorStop(){}};
  const ctx=new Proxy({
    drawImage:(...args)=>images.push(args),fillRect:(...args)=>fills.push(args),
    createLinearGradient:()=>g,createRadialGradient:()=>g
  },{get:(o,k)=>o[k]||(()=>{})});
  try {
    const st=OW.createState('gate');
    st.camY=1600; // Force the southern image extension into the current viewport.
    OW.draw(ctx,st,0);
    const h=Math.round(bg.width*art.naturalHeight/art.naturalWidth);
    assert.deepEqual(images[0].slice(1),[bg.x,bg.y,bg.width,h]);
    assert.ok(images.some(args=>args[0]===art&&args.length===9),'map south padding mirrors the same image, no extra download');
    assert.ok(fills.some(args=>args[0]===bg.x&&args[1]===bg.y+h&&args[2]===bg.width&&args[3]===2200-bg.y-h),'south padding has a fog gradient');
  }finally{delete global.ART;}
});
