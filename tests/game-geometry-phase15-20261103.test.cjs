'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('js/game-geometry.js','utf8');
const game=fs.readFileSync('js/game.js','utf8');
function moduleApi() {
 const ctx={window:{}};vm.runInNewContext(source,ctx);
 return ctx.window.GAME_GEOMETRY;
}
const originalPointer=(e,r,v)=>({
 x:(e.clientX-r.left)*v.width/r.width-v.offsetX,
 y:(e.clientY-r.top)*v.height/r.height-v.offsetY
});
const originalHit=(p,bt)=>Math.hypot(p.x-bt.x,p.y-bt.y)<bt.r+10;
function originalButton(p,bt,scale){
 const minimum=44/(scale||1);
 const px=Math.max(0,(minimum-bt.w)/2),py=Math.max(0,(minimum-bt.h)/2);
 return p.x>=bt.x-px&&p.x<=bt.x+bt.w+px&&p.y>=bt.y-py&&p.y<=bt.y+bt.h+py;
}
function originalCard(p,cards,card,count) {
 for(let i=0;i<count;i++){
  const rect=cards?.[i]||{x:card.x,y:card.y+i*(card.h+card.gap),w:card.w,h:card.h};
  if(p.x>=rect.x&&p.x<=rect.x+rect.w&&p.y>=rect.y&&p.y<=rect.y+rect.h)return i;
 }
 return -1;
}
test('Phase15 cursor-to-world transform parity at portrait, desktop and offset viewport sizes',()=>{
 const api=moduleApi();
 for(const r of [{left:0,top:0,width:900,height:600},{left:120,top:50,width:450,height:900},
   {left:-20,top:70,width:2100,height:800}]){
  for(const v of [{width:900,height:600,offsetX:0,offsetY:0},
   {width:900,height:600,offsetX:100,offsetY:-80},
   {width:1134,height:756,offsetX:0,offsetY:120}]){
   for(const [clientX,clientY] of [[r.left,r.top],[r.left+r.width/2,r.top+r.height/2],
     [r.left+r.width,r.top+r.height],[r.left-1,r.top+1]]){
    const e={clientX,clientY};
    const expected=originalPointer(e,r,v),got=api.pointerWorld(e,r,v);
    assert.equal(got.x,expected.x);
    assert.equal(got.y,expected.y);
   }
  }
 }
});
test('Phase15 circle and rectangular hit boundaries match former operators for all scales',()=>{
 const api=moduleApi();
 const circles=[{x:100,y:110,r:30},{x:-2,y:-3,r:0},{x:3,y:0,r:22}];
 const rects=[{x:120,y:150,w:100,h:55},{x:0,y:0,w:10,h:12},{x:-80,y:-30,w:160,h:80}];
 for(const p of [-95,-20,-1,0,1,20,30,40,80,100,120,135,145,150,210,245]){
  for(const y of [-80,-1,0,15,100,110,149,170,215,245]){
   const point={x:p,y};
   for(const bt of circles)assert.equal(api.hitCircle(point,bt),originalHit(point,bt));
   for(const bt of rects)for(const scale of [undefined,0,.6,1,1.5,2,4]){
    assert.equal(api.hitButton(point,bt,scale),originalButton(point,bt,scale),
     JSON.stringify({p,y,scale,bt}));
   }
  }
 }
});
test('Phase15 level-up card hitboxes preserve precedence, bounds and custom per-card rects',()=>{
 const api=moduleApi();
 const card={x:90,y:176,w:720,h:108,gap:14};
 const cards=[{x:50,y:90,w:300,h:70},null,{x:300,y:210,w:150,h:40}];
 for(const custom of [null,[],cards]){
  for(const count of [0,1,2,3,4]){
   for(const x of [49,50,90,149,300,450,800,810]){
    for(const y of [89,90,176,210,250,310,420,590]){
     const point={x,y};
     assert.equal(api.levelUpCardIndex(point,custom,card,count),
      originalCard(point,custom,card,count),JSON.stringify({custom,count,x,y}));
    }
   }
  }
 }
});
test('Phase15 game keeps viewport/UI layout calls; helper loaded before main game',()=>{
 const api=moduleApi();
 assert.ok(Object.isFrozen(api));
 for(const n of ['pointerWorld','hitCircle','hitButton','levelUpCardIndex'])assert.equal(typeof api[n],'function');
 assert.match(game,/const r = cv\.getBoundingClientRect\(\)/);
 assert.match(game,/window\.VIEWPORT\?\.get\(\) \|\| \{width:W,height:H,offsetX:0,offsetY:0\}/);
 assert.match(game,/GAME_GEOMETRY\.levelUpCardIndex\(p, cards, card, choices\.length\)/);
 const html=fs.readFileSync('index.html','utf8');
 assert.ok(html.includes('js/game-geometry.js?v=20261103-input-phase15'));
 assert.ok(html.includes('js/game.js?v=20261103-thunder-phase26'));
 assert.ok(html.indexOf('js/game-geometry.js')<html.indexOf('js/game.js'));
});
