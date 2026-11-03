'use strict';
const {scriptUrl} = require('./helpers/script-url.cjs');
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const game=fs.readFileSync('js/game.js','utf8');
const ui=fs.readFileSync('js/ui.js','utf8');
function camera(stage,tilt,href,py=700) {
 const a=game.indexOf('    const devS2Camera =');
 const b=game.indexOf('    const curCam = RENDERER.getCam();',a);
 assert.ok(a>=0&&b>a);
 const env={STAGE:{id:stage},P:{x:100,y:py},H:600,
  tiltK:()=>tilt,window:{location:new URL(href),DEV_MODE:{
   isDevMode(loc){return (loc.hostname==='localhost'||loc.hostname==='127.0.0.1') &&
    new URL(loc.href).searchParams.get('dev')==='1';}
  }}};
 vm.runInNewContext(game.slice(a,b)+'\nthis.camera={devS2Camera,s2Gain,camFocusY,targetCamY};',env);
 return env.camera;
}
function bossUI() {
 const a=ui.indexOf('  function drawBossQuiz(');
 const b=ui.indexOf('  // ---- 奧義融合',a);
 assert.ok(a>=0&&b>a);
 const img={naturalWidth:100,naturalHeight:50}, env={
  window:{VIEWPORT:{get:()=>({scale:1})}},
  paintedBossSealBreak:img,
  calm:()=>false,
  formalUpgradeArt:{card_dark:null,card:null},
  drawBossBar(){},drawRitualCard(){},drawWashiSlices(){},
  readableFont:()=>'',answerFont:()=>'',answerFontReady:()=>false,
  fitText(){},
  bossQuizLayout:(n,count)=>({
   x:100,y:100,w:500,h:150,
   bar:{x:100,y:80,w:500,rowH:25},
   options:Array.from({length:n},(_,i)=>({x:110+i*150,y:165,w:125,h:50}))
  })
 };
 vm.runInNewContext(ui.slice(a,b)+'\nthis.draw=drawBossQuiz;',env);
 return {draw:env.draw,img};
}
function canvas() {
 const events={images:[],texts:[],colors:[]};
 const ctx={
  save(){},restore(){},beginPath(){},roundRect(){},fill(){},stroke(){},
  fillRect(){events.colors.push(this.fillStyle);},
  drawImage(...args){events.images.push(args);},
  fillText(text){events.texts.push(String(text));events.colors.push(this.fillStyle);},
  textAlign:'',font:'',strokeStyle:'',lineWidth:0
 };
 let fillColor='';
 Object.defineProperty(ctx,'fillStyle',{
  get(){return fillColor;},
  set(value){fillColor=value;events.colors.push(value);}
 });
 return {ctx,events};
}
test('Audit P1-3 rain-port official 2D and 2.5D camera follow player, not art flag',()=>{
 for(const tilt of [0.6,1]){
  const cam=camera('rain-port',tilt,'https://yorkwahaha.github.io/yokai-delivery/?dev=1&s2artprod=1');
  assert.equal(cam.devS2Camera,false);
  assert.equal(cam.s2Gain,0);
  assert.equal(cam.camFocusY,700);
  assert.equal(cam.targetCamY,700-600/(2*tilt));
 }
 assert.equal(camera('rain-port',1,'http://localhost:3000/?dev=1&s2artprod=1').camFocusY,550);
 assert.equal(camera('night-town',1,'http://localhost:3000/?dev=1&s2artprod=1').camFocusY,700);
});
test('Audit P1-3 port spawn remains in playable belt even when art preview is absent',()=>{
 const a=game.indexOf('    const sourceStart = STAGE.start ||');
 const b=game.indexOf('    DAWN = STAGE_PACING.runSeconds',a);
 assert.ok(a>=0&&b>a);
 for(const stageId of ['rain-port','night-town']){
  const env={STAGE:{id:stageId,start:{x:1350,y:900}},START:null,worldSpacingScaleY:()=>1.2};
  vm.runInNewContext(game.slice(a,b),env);
  assert.equal(env.START.y,stageId==='rain-port'?480:1080);
 }
});
test('Audit P1-6 break-seal art survives second Boss taking over quiz board',()=>{
 const {draw,img}=bossUI();
 const boss=[{hp:50},{hp:75}];
 const quiz={ans:[{jp:'はな'},{jp:'ねこ'},{jp:'やま'}],word:{jp:'はな'},wrong:[],lock:0};
 let {ctx,events}=canvas();
 draw(ctx,quiz,'keyboard',boss,.7,0);
 assert.equal(events.images.filter(x=>x[0]===img).length,1);
 ({ctx,events}=canvas());
 draw(ctx,null,'keyboard',boss,.7,0);
 assert.equal(events.images.filter(x=>x[0]===img).length,1);
 ({ctx,events}=canvas());
 draw(ctx,quiz,'keyboard',boss,0,0);
 assert.equal(events.images.length,0);
});
test('Audit P1-7 curse disables quiz option styling throughout the full penalty',()=>{
 const {draw}=bossUI();
 const quiz={ans:[{jp:'はな'},{jp:'ねこ'},{jp:'やま'}],word:{jp:'はな'},wrong:[1],lock:0};
 let {ctx,events}=canvas();
 draw(ctx,quiz,'gamepad',[{hp:40}],0,9.8);
 assert.ok(events.texts.some(x=>x.includes('反噬禁攻 10s')));
 assert.ok(events.colors.includes('#a99c8e'));
 assert.ok(!events.colors.includes('#f5e7c6'));
 ({ctx,events}=canvas());
 draw(ctx,quiz,'gamepad',[{hp:40}],0,0);
 assert.ok(events.colors.includes('#f5e7c6'));
});
test('Audit P1-6/7 game passes live curse counter and separate seal fade to UI',()=>{
 assert.match(game,/UI\.drawBossQuiz\(\s*ctx, job\?\.reading \? null : bossQ, inputMode, liveBosses, sealFade, bossCurseRemaining/);
 const html=fs.readFileSync('index.html','utf8');
 assert.ok(html.includes(scriptUrl('game')));
 assert.ok(html.includes('js/ui.js?v=20261103-hud-boss-layout-r1'));
});
