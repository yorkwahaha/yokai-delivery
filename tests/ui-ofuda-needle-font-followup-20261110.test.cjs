'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {loadGame} = require('./helpers/game-runtime.cjs');

test('Lv2 ofuda always contains a straight projectile and alternates the second flank', () => {
  const g=loadGame({seed:20261110,stage:'night-town'});
  g.start();g.stopSpawns();g.clearSolids();
  g.combatScene('boom',[{dx:250,dy:0,hp:10000,max:10000,speed:0}],[],2);
  g.setFacingAngle(0);
  g.weapons(.05);
  const first=g.snapshot().proj.map(q=>q.ang);
  assert.equal(first.length,2);
  assert.ok(first.some(a=>Math.abs(a)<1e-9),'one paper flies straight toward the enemy');
  assert.ok(first.some(a=>a>0.1),'first side is angled');
  for(let i=0;i<40;i++)g.weapons(.05);
  const second=g.snapshot().proj.filter(q=>q.ang<-.1);
  assert.ok(second.length>0,'second cast uses the opposite side');
});

test('ofuda luminous impacts render before the single floating damage-number pass',()=>{
  const src=fs.readFileSync('js/game.js','utf8');
  const draw=src.indexOf('RENDERER.drawDamageNumbers();');
  assert.ok(draw>src.indexOf('SKILLFX.drawArtFx?.(ctx, false)'));
  assert.ok(draw>src.indexOf('FX.draw(ctx, cam, view)'));
  assert.equal(src.match(/RENDERER\.drawDamageNumbers\(\);/g)?.length,1);
  assert.ok(src.slice(draw-100,draw).includes('tiltWorld(cam,shakeOffset)'));
});

test('approved needle raster is rendered silver unless frost is enabled, at Lv3 and Lv5',()=>{
  const raster={naturalWidth:120,naturalHeight:90};
  const env={
    window:{skillVfxArt:(id)=>id==='needle'?raster:null},
    FX:{glow(){},allowsMotion:()=>false,count:n=>n,rnd:(a,b)=>(a+b)/2,emit(){}}
  };
  vm.runInNewContext(fs.readFileSync('js/skillfx.js','utf8'),env);
  const filters=[];const stack=[];
  const ctx=new Proxy({
    filter:'none',globalAlpha:1,
    save(){stack.push([this.filter,this.globalAlpha]);},
    restore(){[this.filter,this.globalAlpha]=stack.pop();},
    drawImage(){filters.push(this.filter);},
    translate(){},rotate(){},scale(){},
  },{get:(obj,key)=>key in obj?obj[key]:()=>{}});
  for(const lv of [3,5]){
    env.window.SKILLFX.paint(ctx,'needle',lv,{x:0,y:0,ang:0,frost:false});
    env.window.SKILLFX.paint(ctx,'needle',lv,{x:0,y:0,ang:0,frost:true});
  }
  assert.equal(filters.length,4);
  assert.ok(filters[0].includes('grayscale')&&filters[2].includes('grayscale'));
  assert.equal(filters[1],'none');
  assert.equal(filters[3],'none');
});

test('pause fixed labels align above the formerly low ink position',()=>{
  const traces=[];
  const image = class{
    set src(value){
      this._src=value;
      this.naturalWidth=1024;this.naturalHeight=200;
      if(value.includes('pause__approved')){this.naturalWidth=1024;this.naturalHeight=1536;}
      this.onload?.();
    }
    get src(){return this._src;}
  };
  const window={
    Image:image,location:{hostname:'127.0.0.1',search:''},
    VIEWPORT:{get:()=>({scale:1}),bounds:()=>({left:0,top:0,right:900,bottom:600,width:900,height:600})},
    matchMedia:()=>({matches:false}),ART:{},FX:{glow(){}}
  };
  const ctx=new Proxy({
    font:'400 20px serif',globalAlpha:1,
    measureText(){return {width:100,actualBoundingBoxAscent:20,actualBoundingBoxDescent:5};},
    fillText(text,x,y){traces.push({text,x,y});},
    save(){},restore(){},drawImage(){},fillRect(){},strokeText(){}
  },{get:(obj,key)=>key in obj?obj[key]:()=>{}});
  const env={window,location:window.location,document:{fonts:{load:()=>Promise.resolve()}},URLSearchParams,Date,Math};
  vm.runInNewContext(fs.readFileSync('js/ui.js','utf8'),env);
  window.UI.drawPauseMenu(ctx,false,0,'main');
  const title=traces.find(t=>t.text==='夜櫻暫歇');
  assert.ok(title,'main heading rendered');
  assert.equal(title.y,105+(20-5)/2,'heading placed six logical pixels higher');
  for(const [i,label]of ['繼續夜行','秘術卡片','單字圖鑑','夜行設定','回旅路地圖'].entries()){
    const record=traces.find(t=>t.text===label);
    assert.ok(record,label+' rendered');
    const rowY=[181,225,268,312,356][i];
    assert.equal(record.y,rowY+20-1+(20-5)/2,label+' moved five logical pixels up');
  }
  const footer=traces.find(t=>t.text==='返回主選單');
  assert.ok(footer,'separate red action rendered');
  const red=window.UI.pauseButtons('main').find(b=>b.id==='menu');
  assert.equal(footer.y,red.y+red.h/2+1+(20-5)/2,
    'red footer label moved five logical pixels up');
});
