'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');

const source=fs.readFileSync('js/ui.js','utf8');

function scene({approved=true,blank=false}={}){
  const images=[],labels=[],strokes=[],gradient={addColorStop(){}};
  const ctx=new Proxy({
    font:'400 18px serif',
    fillText(text,x,y,maxWidth){labels.push({text:String(text),font:this.font,x,y,maxWidth,shadowBlur:this.shadowBlur||0,align:this.textAlign});},
    drawImage(img,...args){images.push({src:img.src,args,shadowBlur:this.shadowBlur||0});},
    stroke(){strokes.push({width:this.lineWidth,color:this.strokeStyle});},
    measureText(text){return {width:Array.from(String(text)).length*14,
      actualBoundingBoxAscent:14,actualBoundingBoxDescent:4};},
    createLinearGradient(){return gradient;},
    createRadialGradient(){return gradient;}
  },{get:(obj,key)=>key in obj?obj[key]:()=>{}});
  const win={innerWidth:1280,innerHeight:720};
  win.Image=class {
    naturalWidth=587;naturalHeight=323;
    set src(value){
      this._src=value;
      if(!blank && value.includes('exit__blank.png'))return;
      if(!approved && /assets\/img\/ui\/(menu|buttons)\//.test(value))return;
      this.onload?.();
    }
    get src(){return this._src;}
  };
  const sandbox={window:win,document:{getElementById:()=>({
    getBoundingClientRect:()=>({width:1280})})}};
  vm.runInNewContext(source,sandbox,{timeout:1500});
  return {UI:win.UI,ctx,images,labels,strokes,win};
}

test('pause uses one approved five-slot board without duplicate painted buttons',()=>{
 const s=scene();
 s.UI.drawPauseMenu(s.ctx,false,0);
 const boards=s.images.filter(v=>v.src?.includes('menu/pause__approved.webp'));
 assert.equal(boards.length,1,'one complete uncut portrait board');
 assert.equal(boards[0].args.length,4,'render full sprite with no source cropping rectangle');
 assert.equal(s.images.some(v=>v.src?.includes('menu/pause__board.webp')),false,'never render the obsolete lettered pause frame');
 assert.ok(s.labels.some(v=>v.text==='繼續夜行'),'no-canvas fallback still labels the built-in slot');
 assert.ok(s.labels.some(v=>v.text==='夜櫻暫歇'),'fallback retains the reduced title');
 assert.equal(s.images.some(v=>v.src?.includes('menu__button__hover.webp')),false,'no extra stretched hover card');
 assert.ok(s.images.some(v=>v.src?.includes('menu/result__button.webp')),'sixth option is an independent approved danger button');
 assert.equal(s.images.filter(v=>v.src?.includes('menu/approved__button_normal.webp')).length,0,
  'five normal slots are already painted into the board, never render smaller buttons over them');
 const rows=s.UI.pauseButtons('main');
 assert.equal(rows.length,6);
 for(let i=1;i<rows.length;i++)assert.ok(rows[i].y>=rows[i-1].y+rows[i-1].h);
});

test('missing new art never resurrects old pause or beige button paintings',()=>{
 const s=scene({approved:false});
 s.UI.drawPauseMenu(s.ctx,false,0);
 assert.equal(s.images.filter(v=>v.src?.includes('phase42/pause_board.webp')).length,0);
 assert.equal(s.images.filter(v=>v.src?.includes('menu/pause__board.webp')).length,0);
 assert.ok(s.labels.some(v=>v.text==='夜櫻暫歇'));
 assert.equal(s.images.some(v=>v.src?.includes('phase42/button_normal.webp')),false);
});

test('two-column mobile pause uses the complete wide frame without stretching portrait trim',()=>{
 const s=scene();
 s.win.VIEWPORT={
   get:()=>({scale:.65}),
   bounds:()=>({left:0,top:0,right:900,bottom:600,width:900,height:600})
 };
 s.UI.drawPauseMenu(s.ctx,false,0);
 const frames=s.images.filter(v=>v.src?.includes('menu/result__board.webp'));
 assert.equal(frames.length,1);
 assert.equal(frames[0].args.length,4);
 assert.ok(frames[0].args[2]>frames[0].args[3],'compact board has landscape geometry');
 assert.equal(s.images.some(v=>v.src?.includes('phase42/pause_board.webp')),false);
});

test('exit confirmation shares the same raster components and brush lettering',()=>{
 const s=scene();
 s.UI.drawExitConfirm(s.ctx,0,'world');
 const boards=s.images.filter(v=>v.src?.includes('menu/result__board.webp'));
 assert.equal(boards.length,1,'exit must use a separate full wide frame');
 assert.equal(boards[0].args.length,4,'wide panel must not draw a cropped source');
 assert.ok(s.images.some(v=>v.src?.includes('menu/result__button.webp')));
 for(const part of ['是否放棄本局？','尚未結算的戰果將隨夜色散去。','繼續本局','放棄並回地圖']){
   assert.ok(s.labels.some(v=>v.text===part&&v.font.includes('MoonStars Kai T')),
     part+' must retain calligraphic typography');
 }
});

test('approved home confirmation paints a complete illustration and halo without double lettering',()=>{
 const s=scene();
 s.UI.drawExitConfirm(s.ctx,1,'home');
 const boards=s.images.filter(v=>v.src?.includes('assets/img/ui/menu/exit__board.webp'));
 assert.equal(boards.length,1);
 assert.equal(boards[0].args.length,4);
 assert.equal(s.images.some(v=>v.src?.includes('menu__button__danger-hover.webp')),false);
 assert.ok(s.images.some(v=>v.src?.includes('menu/result__button.webp')&&v.shadowBlur>=20),
  'focus glows from the real button sprite, without a rectangular outline');
 assert.equal(s.labels.some(v=>v.text==='是否放棄本局？'),false);
 assert.equal(s.labels.some(v=>v.text==='放棄並回首頁'),false);
});

test('new blank landscape art supports live text for either exit target and both focus states',()=>{
 for(const target of ['home','world']){
  const s=scene({blank:true});
  s.UI.drawExitConfirm(s.ctx,1,target);
  const frames=s.images.filter(v=>v.src?.includes('exit__blank.png'));
  assert.equal(frames.length,1);
  assert.equal(frames[0].args.length,4);
  assert.ok(s.labels.some(v=>v.text==='是否放棄本局？'));
  assert.ok(s.labels.some(v=>v.text=== (target==='home'?'放棄並回首頁':'放棄並回地圖')));
  assert.equal(s.images.filter(v=>v.src?.includes('menu/result__button.webp')).length,0,
   'exit__blank already has both button frames; never stack another button over them');
  assert.ok(s.labels.some(v=>v.text===(target==='home'?'放棄並回首頁':'放棄並回地圖')&&v.shadowBlur>=8),
   'selected action glows around its ink only; preserve the single approved painted button frame');
  const labels=s.labels.filter(v=>v.text==='繼續本局'||v.text.startsWith('放棄並回'));
  assert.equal(labels.length,2);
  assert.ok(Math.abs(labels[0].y-labels[1].y)<.1,'both button labels share one visual baseline');
  assert.equal(labels[0].y,381,
    'button ink baseline moved three world pixels upward inside the baked button frames');
  assert.equal(labels[0].x,s.UI.EXIT_BTNS[0].x+s.UI.EXIT_BTNS[0].w/2);
  assert.equal(labels[1].x,s.UI.EXIT_BTNS[1].x+s.UI.EXIT_BTNS[1].w/2);
  assert.ok(labels.every(v=>v.align==='center'),'both labels center on their already painted button slots');
  assert.equal(s.labels.some(v=>/一旦|這趟/.test(v.text)),false,'unsupported Hanzi removed');
 }
});
test('map two-line header and stage ledger use separate, properly padded painted assets',()=>{
 const s=scene();
 const header={x:242,y:4,w:416,h:96};
 s.UI.drawMapHeader(s.ctx,header,'妖怪快遞社・旅路圖','道をたどって、次の配達先へ');
 assert.equal(s.images.filter(v=>v.src?.includes('result__button.webp')).length,1,
  'the header has one red-gold painted plaque');
 const headings=s.labels.filter(v=>v.text.includes('旅路圖')||v.text.includes('道をたどって'));
 assert.equal(headings.length,2);
 for(const line of headings){
   assert.equal(line.x,450);
   assert.ok(line.y>header.y+20 && line.y<header.y+header.h-16,
     'header ink remains inside the painted red inset: '+line.text);
 }
 const n=s.images.length;
 s.UI.drawMapInfoPanel(s.ctx,{x:231,y:454,w:438,h:128});
 const infoArt=s.images.slice(n);
 assert.equal(infoArt.length,9,'image-backed nine-slice stage ledger preserves artwork corners');
 assert.ok(infoArt.every(v=>v.src?.includes('illustrated/result_panel.webp')),
  'stage information uses the dedicated painted parchment, never a red action button');
});
test('upgraded card detail panel uses its own high-resolution decorated raster plaque',()=>{
 const code=fs.readFileSync('js/ui-upgrade-trial.js','utf8');
 assert.ok(code.includes('assets/img/ui/upgrade/approved_details_blank.webp'));
 assert.ok(code.includes('術式效果'));
 assert.doesNotMatch(code,/fontPicker|readPreviewZip|upgrade-art-picker-trigger/);
});
