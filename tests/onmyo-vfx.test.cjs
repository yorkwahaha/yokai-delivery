const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function setup(){
 const events=[],viewport={upright(ctx,x,y,paint){events.push(['upright',x,y]);paint();}};
 const ctx=new Proxy({globalAlpha:1,save(){events.push(['save']);},restore(){events.push(['restore']);},
  beginPath(){},arc(){events.push(['arc']);},ellipse(){events.push(['ellipse']);},drawImage(){events.push(['image']);},
  fillRect(){events.push(['fillRect']);},fill(){},stroke(){},strokeRect(){},
  translate(){},rotate(){},scale(){},moveTo(){},lineTo(){},bezierCurveTo(){},quadraticCurveTo(){}},
  {get:(o,k)=>k in o?o[k]:(()=>{})});
 const env={Math,Date,ART:{},VIEWPORT:viewport,matchMedia:()=>({matches:false})};
 env.window=env;
 const context=vm.createContext(env);
 for(const f of ['fx','onyo-vfx','skillfx']){
   vm.runInContext(fs.readFileSync('js/'+f+'.js','utf8'),context,{filename:f+'.js'});
 }
 return {env,ctx,events};
}
test('three Onmyodo shapes use balanced Canvas save/restore; do not require raster downloads',()=>{
 const {env,ctx,events}=setup(),v=env.ONMYO_VFX;
 v.seal(ctx,200,200,100,1,5);v.lightningMark(ctx,200,200,35,.4);
 v.cloud(ctx,200,50,.5,4);v.strike(ctx,200,200,.3,5);
 v.ofuda(ctx,200,150,.5,3);
 const saves=events.filter(x=>x[0]==='save').length;
 const restores=events.filter(x=>x[0]==='restore').length;
 assert.equal(saves,restores);
 assert.ok(events.filter(x=>x[0]==='arc').length>=15);
 assert.ok(events.some(x=>x[0]==='fillRect'));
});
test('barrier casts ground yin-yang; thunder marks ground and cloud/strike stay upright',()=>{
 const {env,ctx,events}=setup(),calls=[];
 const art=env.ONMYO_VFX;
 env.ONMYO_VFX={...art,
  seal:(...args)=>calls.push(['seal',args[1],args[2]]),
  lightningMark:(...args)=>calls.push(['mark',args[1],args[2]]),
  cloud:(...args)=>calls.push(['cloud',args[1],args[2]]),
  strike:(...args)=>calls.push(['strike',args[1],args[2]])};
 env.SKILLFX.play('barrier','cast',1,{x:155,y:225,r:125});
 env.SKILLFX.play('thunder','strike',3,{x:350,y:390,delay:0});
 env.SKILLFX.play('thunder','storm',5,{x:350,y:390,r:340,delay:0});
 env.SKILLFX.drawArtFx(ctx,true);
 assert.ok(calls.some(x=>x[0]==='seal'));
 assert.ok(calls.some(x=>x[0]==='mark'));
 assert.ok(!calls.some(x=>x[0]==='strike'||x[0]==='cloud'));
 events.length=0;
 env.SKILLFX.drawArtFx(ctx,false);
 assert.ok(calls.some(x=>x[0]==='strike'));
 assert.ok(calls.some(x=>x[0]==='cloud'));
 assert.ok(events.filter(x=>x[0]==='upright').length>=2);
 assert.ok(env.FX.stats().particles<=460);
});
test('ofuda visual route never requires legacy gold raster; combat damage is untouched',()=>{
 const {env,ctx}=setup();let painted=0;
 env.ONMYO_VFX={...env.ONMYO_VFX,ofuda:()=>{painted++;}};
 for(let rank=1;rank<=5;rank++)env.SKILLFX.paint(ctx,'boom',rank,{x:7,y:11,spin:16});
 assert.equal(painted,5);
 assert.equal(env.SKILLFX.tier(99),5);
});
