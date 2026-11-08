'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');

const source=fs.readFileSync('js/ui.js','utf8');

function scene({approved=true}={}){
  const images=[],labels=[],gradient={addColorStop(){}};
  const ctx=new Proxy({
    font:'400 18px serif',
    fillText(text,x,y,maxWidth){labels.push({text:String(text),font:this.font,x,y,maxWidth});},
    drawImage(img,...args){images.push({src:img.src,args});},
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
      if(!approved && /assets\/img\/ui\/(menu|buttons)\//.test(value))return;
      this.onload?.();
    }
    get src(){return this._src;}
  };
  const sandbox={window:win,document:{getElementById:()=>({
    getBoundingClientRect:()=>({width:1280})})}};
  vm.runInNewContext(source,sandbox,{timeout:1500});
  return {UI:win.UI,ctx,images,labels,win};
}

test('approved pause main displays the six-button painting whole and highlights only focused text',()=>{
 const s=scene();
 s.UI.drawPauseMenu(s.ctx,false,0);
 const boards=s.images.filter(v=>v.src?.includes('assets/img/ui/menu/pause__board.webp'));
 assert.equal(boards.length,1,'pause must paint a complete precomposed frame once, not crop it into nine slices');
 assert.equal(boards[0].args.length,4,'render full sprite with no source cropping rectangle');
 assert.ok(s.labels.some(v=>v.text==='繼續夜行'&&v.font.includes('MoonStars Kai T')));
 assert.equal(s.labels.some(v=>v.text==='夜櫻暫歇'),false,'do not duplicate painted heading');
 assert.ok(s.images.some(v=>v.src?.includes('menu__button__hover.webp')));
 const rows=s.UI.pauseButtons('main');
 assert.equal(rows.length,6);
 for(let i=1;i<rows.length;i++)assert.ok(rows[i].y>=rows[i-1].y+rows[i-1].h);
});

test('missing new art falls back to the original dynamic board and text',()=>{
 const s=scene({approved:false});
 s.UI.drawPauseMenu(s.ctx,false,0);
 assert.equal(s.images.filter(v=>v.src?.includes('phase42/pause_board.webp')).length,1);
 assert.ok(s.labels.some(v=>v.text==='夜櫻暫歇'));
 assert.ok(s.images.some(v=>v.src?.includes('phase42/button_normal.webp')));
});

test('two-column mobile pause uses the complete wide frame without stretching portrait trim',()=>{
 const s=scene();
 s.win.VIEWPORT={
   get:()=>({scale:.65}),
   bounds:()=>({left:0,top:0,right:900,bottom:600,width:900,height:600})
 };
 s.UI.drawPauseMenu(s.ctx,false,0);
 const frames=s.images.filter(v=>v.src?.includes('phase42/exit_board.webp'));
 assert.equal(frames.length,1);
 assert.equal(frames[0].args.length,4);
 assert.ok(frames[0].args[2]>frames[0].args[3],'compact board has landscape geometry');
 assert.equal(s.images.some(v=>v.src?.includes('phase42/pause_board.webp')),false);
});

test('exit confirmation shares the same raster components and brush lettering',()=>{
 const s=scene();
 s.UI.drawExitConfirm(s.ctx,0,'world');
 const boards=s.images.filter(v=>v.src?.includes('phase42/exit_board.webp'));
 assert.equal(boards.length,1,'exit must use a separate full wide frame');
 assert.equal(boards[0].args.length,4,'wide panel must not draw a cropped source');
 assert.ok(s.images.some(v=>v.src?.includes('phase42/button_danger.webp')));
 for(const part of ['是否放棄本局？','已儲存的單字學習紀錄會保留。','繼續本局','放棄並回地圖']){
   assert.ok(s.labels.some(v=>v.text===part&&v.font.includes('MoonStars Kai T')),
     part+' must retain calligraphic typography');
 }
});

test('approved home confirmation uses its own full illustration without duplicating baked copy',()=>{
 const s=scene();
 s.UI.drawExitConfirm(s.ctx,1,'home');
 const boards=s.images.filter(v=>v.src?.includes('assets/img/ui/menu/exit__board.webp'));
 assert.equal(boards.length,1);
 assert.equal(boards[0].args.length,4);
 assert.ok(s.images.some(v=>v.src?.includes('menu__button__danger-hover.webp')));
 assert.equal(s.labels.some(v=>v.text==='是否放棄本局？'),false);
 assert.ok(s.labels.some(v=>v.text==='放棄並回首頁'));
});

test('upgraded card detail panel uses its own high-resolution decorated raster plaque',()=>{
 const code=fs.readFileSync('js/ui-upgrade-trial.js','utf8');
 assert.ok(code.includes('assets/img/ui/phase42/detail_board.webp'));
 assert.ok(code.includes('術式效果'));
 assert.doesNotMatch(code,/fontPicker|readPreviewZip|upgrade-art-picker-trigger/);
});
