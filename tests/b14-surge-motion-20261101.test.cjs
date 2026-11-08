'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..');
const ui=fs.readFileSync(path.join(root,'js/ui.js'),'utf8');
const begin=ui.indexOf('  function drawSurgeWarning(');
const end=ui.indexOf('  // 9. 關卡標題卡',begin);
assert.ok(begin>0&&end>begin,'live surge warning function available');
const source=ui.slice(begin,end).trim();
const fakeArt={naturalWidth:1462,naturalHeight:450};
const make=(b={left:0,top:0,right:900,bottom:600,width:900,height:600})=>{
 const fn=vm.runInNewContext('('+source+')',{
   screenBounds:()=>b,clamp:(v,min,max)=>Math.max(min,Math.min(max,v)),
   b14SurgeBrush:fakeArt
 });
 return (remain)=>{
   const calls=[];
   const ctx={globalAlpha:1,save(){},restore(){},drawImage(img,x,y,w,h){
     calls.push({img,x,y,w,h,alpha:this.globalAlpha,shadowColor:this.shadowColor});
   }};
   fn(ctx,remain);
   return calls;
 };
};
test('B14 has a real isolated transparent photo-sized WebP and one immutable text raster',()=>{
 const src=fs.readFileSync(path.join(root,'assets/img/ui/b14/surge_brush.webp'));
 assert.equal(src.toString('ascii',0,4),'RIFF');
 assert.equal(src.toString('ascii',8,12),'WEBP');
 assert.ok(src.length>20000,'nontrivial painted texture not placeholder');
 assert.match(ui,/assets\/img\/ui\/b14\/surge_brush\.webp\?v=20261103-surge-brush-r2/);
 const hash=createHash('sha256').update(src).digest('hex');
 assert.equal(hash,'a4d9cb5df8e3e3df0f70c4b41513d02da0b9b53bafef792bbe17bb6f3a2e366e',
  'the verified user-edited WebP must be published unmodified');
 const worker=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
 assert.ok(worker.includes('"assets/img/ui/b14/surge_brush.webp": "'+hash.slice(0,24)+'"'),
  'the media service-worker revision must be refreshed with the new image bytes');
 assert.match(fs.readFileSync(path.join(root,'index.html'),'utf8'),/js\/ui\.js\?v=20261107-approved-system-ui-r1/,
  'the UI loader must refresh so cached clients request the updated artwork');
 assert.doesNotMatch(source,/fillText|strokeText|glassBox|b13Art|b12Art/);
 assert.match(source,/const art=b14SurgeBrush;/);
});
test('B14 starts offscreen to the RIGHT, eases rapidly in, holds, slides LEFT and fades',()=>{
 const render=make();
 assert.equal(render(0).length,0);
 const first=render(2.39)[0],arriving=render(2.24)[0],hold=render(1.25)[0];
 const departing=render(.50)[0],gone=render(.01)[0];
 assert.ok(first.x>900*.80,'starts on right');
 assert.ok(arriving.x<first.x && arriving.x>hold.x,'moves right-to-center');
 assert.ok(Math.abs(hold.x+hold.w/2-450)<.1,'centers during readable hold');
 assert.ok(departing.x<hold.x && gone.x<departing.x,'leaves towards left');
 assert.ok(first.alpha<arriving.alpha && arriving.alpha<hold.alpha,'smooth fade-in');
 assert.ok(hold.alpha>.99 && departing.alpha<hold.alpha && gone.alpha<departing.alpha,'smooth fade-out');
 for(const snap of [first,arriving,hold,departing,gone])assert.equal(snap.img,fakeArt);
});
test('B14 UI responsive viewport dimensions and does not mutate gameplay clock',()=>{
 const render=make({left:0,top:0,right:600,bottom:360,width:600,height:360});
 const shown=render(1.25)[0];
 assert.ok(shown.w<=600*.72+.1);
 assert.ok(shown.h<=360*.27+.1);
 assert.ok(shown.y>=50&&shown.y<100);
 assert.equal(render(1.25).length,1,'only one real sprite draw');
 assert.doesNotMatch(source,/setTimeout|requestAnimationFrame|Date\.now|performance\.now/);
});
