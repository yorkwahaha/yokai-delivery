'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const script=fs.readFileSync(path.join(__dirname,'../js/ui-upgrade-trial.js'),'utf8');

function trial(search='?upgradeUI=1',hostname='localhost',touchDevice=false){
  const traces=[];
  const ctx=new Proxy({
    font:'700 18px sans-serif',fillStyle:'#fff',
    createLinearGradient(){return {addColorStop(){}};},
    measureText(v){
      const n=Number(this.font.match(/([\d.]+)px/)?.[1] || 16);
      return {width:Array.from(String(v)).reduce((sum,ch)=>sum+n*(ch.codePointAt(0)>255?1:.56),0)};
    },
    fillText(str,x,y,w){traces.push({text:String(str),x,y,w,font:this.font});},
    drawImage(img,...args){traces.push({image:img.url,args});}
  },{get:(obj,key)=>key in obj?obj[key]:()=>{}});
  const prevLayout=()=>({legacy:true});
  const prevDraw=()=>{traces.push({text:'legacy'});};
  const UI={
    levelUpLayout:prevLayout,drawLevelUp:prevDraw,
    readableFont:(n,weight='700')=>weight+' '+n+'px sans-serif',
    cardShort:()=>null
  };
  const location={search,hostname};
  const env={window:{UI,location,VIEWPORT:{get:()=>({scale:.65})},
      navigator:{maxTouchPoints:touchDevice?5:0},
      matchMedia:()=>({matches:touchDevice})},
    location,DEV_MODE:require('../js/dev-mode.js'),URLSearchParams,console};
  vm.runInNewContext(script,env,{timeout:1000});
  return {UI,ctx,traces,prevLayout,prevDraw,env};
}

test('iPad upgrade cards use one bundled Traditional Kai face and retain only ten card centers',()=>{
  const view=trial('?mode=normal','192.168.50.101',true);
  const sources=[];
  view.env.window.Image=class {
    set src(url){this.url=url;sources.push(url);this.naturalWidth=820;this.naturalHeight=1230;this.onload?.();}
  };
  const cfg=view.env.window.__YOKAI_UPGRADE_PHASE42;
  assert.equal(cfg.cardCacheStats().limit,10);
  const first=cfg.sharedCardIds[0];
  const picks=cfg.sharedCardIds.slice(0,24);
  for(const id of picks){
    view.UI.drawLevelUp(view.ctx,12,[{id,type:'mutation',n:'紫藤・長夜留香',
      d:'粉紫毒霧繼續停留',levelText:'Lv5'}],{},{},2,0,0,'touch');
    assert.ok(cfg.cardCacheStats().retained<=10,'card artwork must not grow with level count');
  }
  assert.equal(cfg.cardCacheStats().retained,10);
  assert.ok(view.traces.some(t=>t.text?.includes('紫藤')&&t.font?.includes('Yokai Trial MoonStars Kai T')),
    'LAN/iPad card labels must not fall through to OS-dependent fonts');
  const firstPath=cfg.centerPath(first);
  const before=sources.filter(x=>x===firstPath).length;
  view.UI.drawLevelUp(view.ctx,12,[{id:first,type:'mutation',n:'紫藤毒香',d:'毒霧'}],{},{},2,0,0,'touch');
  assert.equal(sources.filter(x=>x===firstPath).length,before+1,
    'evicted illustrations can reload safely when offered again');
});
const cards=[
  {id:'katana',type:'weapon',n:'妖刀',d:'藍黃刀光向前斬擊',levelText:'Lv.2'},
  {id:'fire',type:'weapon',n:'狐火',d:'狐火環繞，灼燒附近妖怪，提升傷害和持續時間',levelText:'Lv.3 → Lv.4'},
  {id:'boom',type:'weapon',n:'陰陽符',d:'符紙貼附並爆炸',levelText:'新解鎖'}
];

test('mutation card paints the variant and its parent on separate centered plaques', () => {
  const {env} = require('./helpers/game-runtime.cjs').loadGame();
  const {GAME_CATALOG} = env;
  const mutation = GAME_CATALOG.MUTATION_CONFIG.mut_boom_seek;
  const choice = {...mutation, type:'mutation'};
  for (const hasArt of [false,true]) {
    const view = trial();
    view.env.window.GAME_CATALOG = GAME_CATALOG;
    if (hasArt) view.env.window.Image = class {
      set src(url){this.url=url;this.naturalWidth=1024;this.naturalHeight=1536;this.onload?.();}
    };
    const cfg = view.env.window.__YOKAI_UPGRADE_PHASE42;
    const [rect] = view.UI.levelUpLayout(1).cards;
    view.UI.drawLevelUp(view.ctx,2,[choice],{},{},0,0,0,'touch');
    for (const [text, point] of [['引魂追蹤',cfg.titlePoint],['陰陽符',cfg.classPoint]]) {
      const x = rect.x + rect.w * point.x / 1024;
      const y = rect.y + rect.h * point.y / 1536;
      assert.ok(view.traces.some(entry => entry.text === text && entry.x === x && Math.abs(entry.y - y) < 1e-8), text);
    }
    assert.ok(!view.traces.some(entry => entry.text === '變異' && entry.y < rect.y + rect.h));
  }
  const view = trial();
  view.env.window.GAME_CATALOG = GAME_CATALOG;
  const seal = GAME_CATALOG.MUTATION_CONFIG.mut_seal_nail_wide;
  view.UI.drawMutationCard(view.ctx,{emblem:seal.id,name:seal.n},{x:690,y:225,w:140,h:210});
  const sealName = view.traces.find(entry => entry.text === GAME_CATALOG.WI.seal_nail.zh);
  assert.ok(sealName);
  view.ctx.font = sealName.font;
  assert.ok(view.ctx.measureText(sealName.text).width <= sealName.w);
});

test('式神中心圖缺檔時仍畫共用框、名稱與描述', () => {
  const view = trial('?dev=1&shikigami=1');
  const artPath = 'assets/img/skills/shikigami/cards/shikigami__art.webp';
  const requests = [];
  view.env.window.Image = class {
    set src(value) {
      requests.push(value);
      this.url = value;
      if (value === artPath) { this.onerror(); return; }
      this.naturalWidth = 1024;
      this.naturalHeight = 1536;
      this.onload?.();
    }
  };
  view.UI.drawLevelUp(view.ctx, 2, [{
    id: 'shikigami', type: 'weapon', n: '式神・召喚',
    d: '召喚夥伴追擊附近妖怪', artPath
  }], {}, {}, 0, 0, 0, 'keyboard');
  assert.ok(requests.includes(artPath));
  assert.ok(view.traces.some(t => t.image === 'assets/img/ui/menu/ui__upgrade-card-frame.webp'));
  assert.ok(view.traces.some(t => t.text === '式神・召喚'));
  assert.ok(view.traces.some(t => t.text === '召喚夥伴追擊附近妖怪'));
  assert.ok(!view.traces.some(t => t.image === artPath || t.text === '卡片素材載入中'));
});

test('approved Phase42 cards now replace the regular renderer without opt-in',()=>{
 const x=trial('?mode=normal');
 assert.notEqual(x.UI.levelUpLayout,x.prevLayout);
 assert.notEqual(x.UI.drawLevelUp,x.prevDraw);
 assert.equal(x.UI.levelUpLayout(3).cards.length,3);
});
test('approved shared-frame cards work across preview and regular hosts',()=>{
 const a=trial('?upgradeUI=1','example.com');
 assert.notEqual(a.UI.drawLevelUp,a.prevDraw);
 const x=trial('?upgradeUI=0');
 assert.notEqual(x.UI.drawLevelUp,x.prevDraw);
});
test('only Lv5 weapon cards receive the brief mirror sweep',()=>{
 const paint=(level,time)=>{
  const a=trial();let gradients=0;
  a.ctx.createLinearGradient=()=>{gradients++;return {addColorStop(){}};};
  a.UI.drawLevelUp(a.ctx,5,[{
   id:'katana',type:'weapon',n:'妖刀',lv:level,
   levelText:level===5?'Lv5 覺醒':'等級 3 ➔ 4',d:'刀光前進'
  }],{},{},1,time,0,'keyboard');
  return gradients;
 };
 assert.ok(paint(5,.41)>paint(4,.41),'Lv5 gets an additional mirror gradient');
 assert.equal(paint(5,1.4),paint(4,1.4),'sweep is brief, not permanently bright');
});
test('regular game draws new cards, not a ZIP-only preview',()=>{
 const normal=trial('', '127.0.0.1');
 assert.notEqual(normal.UI.drawLevelUp,normal.prevDraw);
 assert.equal(trial('?upgradeUI=1', 'localhost').UI.upgradeTrialEnabled(),true);
 const fallback=trial('?upgradeUI=0','localhost');
 assert.notEqual(fallback.UI.drawLevelUp,fallback.prevDraw);
});
test('three cards, details and centered reroll have independent, nonoverlapping hitboxes',()=>{
 const {UI}=trial();
 assert.equal(UI.upgradeTrialEnabled(),true);
 const L=UI.levelUpLayout(3);
 assert.equal(L.cards.length,3);
 assert.equal(L.count,3);
 assert.equal(L.reroll.x+L.reroll.w/2,450);
 assert.ok(L.reroll.h*.65>=44,'touch height at mobile landscape scale');
 assert.ok(L.cards[0].x+L.cards[0].w<L.cards[1].x);
 assert.ok(L.cards[1].x+L.cards[1].w<L.cards[2].x);
 assert.ok(L.cards[0].y+L.cards[0].h<L.details.y);
 assert.ok(L.details.y+L.details.h<L.reroll.y);
 assert.ok(L.reroll.y+L.reroll.h<=600);
 assert.deepEqual(Array.from(UI.levelUpLayout(1).cards,c=>c.index),[0]);
 assert.equal(UI.levelUpLayout(0).cards.length,0);
});
test('reroll stays below the detail panel at narrow landscape scales',()=>{
 const {UI,env}=trial();
 for(const scale of [0.45,0.5,0.53,0.65,1]){
  env.window.VIEWPORT.get=()=>({scale});
  for(const count of [1,2,3]){
   const L=UI.levelUpLayout(count);
   assert.ok(L.details.y+L.details.h<L.reroll.y,`details overlap reroll at scale ${scale}`);
   assert.ok(L.reroll.y+L.reroll.h<=600,`reroll clips at scale ${scale}`);
   if(scale>=0.5)assert.ok(L.reroll.h*scale>=44,`reroll tap target at scale ${scale}`);
  }
 }
});
test('bottom explanation follows focus, without mixing other options',()=>{
 const a=trial();
 a.UI.drawLevelUp(a.ctx,4,cards,{}, {},1,0,1,'keyboard');
 const texts=a.traces.map(v=>v.text);
 assert.ok(texts.includes('能力提升'));
 assert.ok(texts.includes('重抽（1）'));
 assert.ok(texts.some(t=>t.includes('狐火環繞')));
 assert.ok(!texts.some(t=>t.includes('符紙貼附')));
 const b=trial();
 b.UI.drawLevelUp(b.ctx,4,cards,{}, {},2,0,2,'touch');
 const other=b.traces.map(v=>v.text);
 assert.ok(other.some(t=>t.includes('符紙貼附')));
 assert.ok(!other.some(t=>t.includes('狐火環繞')));
 assert.ok(other.some(t=>t.includes('輕觸預覽')));
 b.UI.drawLevelUp(b.ctx,5,cards,{}, {},2,0,2,'touch',{seals:2});
 assert.ok(!b.traces.some(t=>t.text.includes('覺醒印')),'retired seal HUD must stay hidden');
});
test('the upgrade header explains active slots and avoids clipped shortcuts on touch',()=>{
 const a=trial();
 a.UI.drawLevelUp(a.ctx,4,cards,{katana:1,fire:2,boom:1,needle:0},{katana:{},fire:{},boom:{},needle:{}},2,0,1,'touch');
 assert.ok(a.traces.some(t=>t.text.includes('主動技能 3／4')&&t.text.includes('新招')));
 assert.ok(!a.traces.some(t=>/^[123]$/.test(t.text)));
 const b=trial();
 b.UI.drawLevelUp(b.ctx,5,cards,{katana:1,fire:2,boom:1,needle:1},{katana:{},fire:{},boom:{},needle:{}},0,0,1,'keyboard');
 assert.ok(b.traces.some(t=>t.text.includes('主動技能 4／4')&&t.text.includes('已滿')));
 const numbers=b.traces.filter(t=>/^[123]$/.test(t.text));
 assert.equal(numbers.length,3);
 assert.ok(numbers.every(t=>t.y+8<=b.UI.levelUpLayout(3).details.y));
});
test('long skill effects wrap completely inside the approved detail parchment',()=>{
 const a=trial();
 const full='妖刀／天雷暴擊率 +15%，結界 +10%（機率上限 50%，倍率 1.8）（目前 0 / 3 層）';
 const picked={id:'crit',type:'passive',n:'心眼一閃',d:full,
   levelText:'第 1 / 3 層',requirementText:'持有退魔妖刀',
   limitText:'每種限選一次；每技能最多 2 種變異'};
 a.UI.drawLevelUp(a.ctx,3,[picked],{},{},2,0,0,'keyboard');
 const d=a.UI.levelUpLayout(1).details;
 const lines=a.traces.filter(t=>t.x===d.x+280 &&
   t.y>=d.y+50&&t.y<d.y+112).map(t=>t.text);
 assert.equal(lines.join('').replace(/\s+/g,''),full.replace(/\s+/g,''),
  'full selected skill effect must remain visible, without truncation');
 assert.ok(lines.length<=3,'effect does not overrun the bottom border');
 assert.ok(!lines.some(t=>t.includes('…')||t.endsWith('...')));
 assert.ok(a.traces.some(t=>t.text==='心眼一閃'&&t.x===d.x+57),
  'skill name avoids the painted lower-left cherry blossoms');
});
test('empty choices render a stable message without a phantom card',()=>{
 const a=trial();
 a.UI.drawLevelUp(a.ctx,4,[],{},{},0,0,0,'keyboard');
 assert.ok(a.traces.some(t=>t.text==='目前沒有可選技能'));
});

test('all 53 shared-frame skill centers exist',()=>{
 const x=trial('');
 const cfg=x.env.window.__YOKAI_UPGRADE_PHASE42;
 assert.equal(cfg.sharedCardIds.length,53);
 for(const pathName of [cfg.framePath,...cfg.sharedCardIds.map(cfg.centerPath)])
   assert.ok(fs.statSync(path.join(__dirname,'..',pathName)).size>20000,
     'raster card image missing: '+pathName);
});
test('normal game has no manual ZIP importer, font picker or debug calibration badge',()=>{
 assert.doesNotMatch(script,/DecompressionStream|readPreviewZip|upgrade-art-picker-trigger/);
 const elements=[];
 const ui={drawLevelUp(){},levelUpLayout(){},readableFont:()=>''};
 const context={
   window:{UI:ui,VIEWPORT:{get:()=>({scale:1})}},
   document:{body:{appendChild:(element)=>elements.push(element)},
     createElement:tag=>({tag}),fonts:{load:async()=>[]}},
   location:{search:'',hostname:'localhost'},URLSearchParams,console
 };
 vm.runInNewContext(script,context,{timeout:1500});
 assert.equal(elements.length,0,'no test-only controls should be added to gameplay');
 assert.equal(ui.upgradeTrialEnabled(),true);
});

test('Phase42 defaults to bundled OFL MoonStars Kai on LAN/public while preserving optional local comparisons',()=>{
 const samples=[
   ['?upgradeUI=1','Yokai Trial MoonStars Kai T'],
   ['?upgradeUI=1&upgradeFont=kai','Yokai Trial MoonStars Kai T'],
   ['?upgradeUI=1&upgradeFont=yuji','Yokai Brush JP'],
   ['?upgradeUI=1&upgradeFont=readable','sans-serif'],
   ['?upgradeUI=1&upgradeFont=bakudai','Yokai Trial Bakudai TC'],
   ['?upgradeUI=1&upgradeFont=masa','Yokai Trial Masa TC'],
   ['?upgradeUI=1&upgradeFont=wenkai','Yokai Trial WenKai TC'],
   ['?upgradeUI=1&upgradeFont=moonstars','Yokai Trial MoonStars Kai T'],
   ['?upgradeUI=1&upgradeFont=moonstarsbold','Yokai Trial MoonStars Kai T Bold'],
   ['?upgradeUI=1&upgradeFont=xuandong','Yokai Trial Xuandong'],
   ['?upgradeUI=1&upgradeFont=hanyan','Yokai Trial HanWang YanKai'],
   ['?upgradeUI=1&upgradeFont=cwtexkai','Yokai Trial cwTeX QKaiZH'],
   ['?upgradeUI=1&upgradeFont=chillkai','Yokai Trial ChillKai Big5']
 ];
 for (const [search,font] of samples){
   const x=trial(search);
   x.UI.drawLevelUp(x.ctx,4,cards,{}, {},0,0,0,'keyboard');
   const title=x.traces.find(t=>t.text==='能力提升');
   assert.ok(title?.font.includes(font),search+' should draw the header in '+font);
   const details=x.traces.find(t=>t.text==='妖刀');
   assert.ok(details?.font.includes(font),'detail title should use the same family');
 }
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 for(const face of ['YokaiTrialBakudaiTC.woff2','YokaiTrialMasaTC.woff2','YokaiTrialWenKaiTC.woff2',
   'YokaiTrialMoonStarsKaiT-Regular.woff2','YokaiTrialMoonStarsKaiT-Bold.woff2',
   'YokaiTrialXuandong.woff2','YokaiTrialHanWangYanKai.woff2',
   'YokaiTrialCwTeXQKaiZH.woff2','YokaiTrialChillKaiBig5.woff2']){
   assert.ok(html.includes(face),face+' must be declared as a local Web font');
   const directory = /(?:Bakudai|Masa|WenKai|Xuandong)/.test(face) ? '../art/ui-font-trials' : '../assets/fonts';
   assert.ok(fs.existsSync(path.join(__dirname,directory,face)),face+' file must exist in its declared local path');
 }
 for(const localName of ['Yokai Local Arphic Sun','Yokai Local Arphic Mao'])
   assert.ok(html.includes(localName),'commercial font can only reference the local installation');
 const production=trial('?upgradeUI=1','example.com');
 production.UI.drawLevelUp(production.ctx,4,cards,{}, {},0,0,0,'keyboard');
 assert.ok(production.traces.some(t=>t.text==='能力提升'&&t.font.includes('Yokai Trial MoonStars Kai T')));
 for(const name of ['arphicsun','arphicmao']){
   const x=trial('?upgradeUI=1&upgradeFont='+name);
   x.UI.drawLevelUp(x.ctx,4,cards,{}, {},0,0,0,'keyboard');
   const title=x.traces.find(t=>t.text==='能力提升');
   assert.ok(title?.font.includes('Yokai Trial MoonStars Kai T'),
     'unavailable proprietary font must never masquerade as loaded');
 }
});

test('the import file dialog resumes only the automatic pause that it caused',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../js/game.js'),'utf8');
  const start=source.indexOf('  let pausedByUpgradePicker = false;');
  const end=source.indexOf('  document.addEventListener("visibilitychange",',start);
  assert.ok(start>0 && end>start,'picker pause handlers should be registered');
  const handlers={};
  const sandbox={
    state:'play',window:{__YOKAI_UPGRADE_PICKER_OPEN:true},
    document:{hidden:false,hasFocus:()=>true},
    keys:new Set(),heldCodes:new Set(),joy:null,gpMove:{x:0,y:0},
    AUDIO:{setSuspended(){}},frameError:false,isPortrait:()=>false,
    addEventListener:(name,handler)=>{handlers[name]=handler;},
    togglePause(){sandbox.state=sandbox.state==='play'?'pause':'play';}
  };
  vm.runInNewContext(source.slice(start,end),sandbox,{timeout:1000});
  handlers.blur();
  assert.equal(sandbox.state,'pause','picker opening pauses gameplay');
  sandbox.window.__YOKAI_UPGRADE_PICKER_OPEN=false;
  handlers['yokai-upgrade-picker-close']();
  assert.equal(sandbox.state,'play','picker closing resumes that automatic pause');
  sandbox.state='pause';
  handlers['yokai-upgrade-picker-close']();
  assert.equal(sandbox.state,'pause','manual pause is not canceled by importer');
});

test('all approved active cards draw the same frame, separate centers and fixed dynamic plaques',()=>{
 const a=trial();
 class TestImage {
   naturalWidth=1024;
   naturalHeight=1536;
   set src(v){this.url=v;this.onload?.();}
 }
 a.env.window.Image=TestImage;
 a.UI.drawLevelUp(a.ctx,5,[
    {id:'thunder',type:'weapon',n:'天狐雷',d:'呼喚天狐落雷'},
    {id:'fire',type:'weapon',n:'狐火',d:'兩顆狐火'},
    {id:'katana',type:'weapon',n:'妖刀',d:'斬擊'}],
   {},{},1,0,0,'keyboard');
 const title=a.traces.find(t=>t.text==='天狐雷');
 const kind=a.traces.find(t=>t.text==='雷擊');
 assert.ok(title,'new card must draw readable skill name');
 assert.ok(kind,'new card must draw actual skill class');
 const card=a.UI.levelUpLayout(3).cards[0];
 assert.ok(Math.abs(title.y-(card.y+card.h*1158/1536))<.1);
 assert.ok(Math.abs(kind.y-(card.y+card.h*1341/1536))<.1);
 const cfg=a.env.window.__YOKAI_UPGRADE_PHASE42;
 assert.equal(a.traces.filter(t=>t.image===cfg.framePath).length,3);
 for(const id of ['thunder','fire','katana']){
   assert.equal(a.traces.filter(t=>t.image===cfg.centerPath(id)).length,1);
 }
 assert.ok(!a.traces.some(t=>t.text==='請載入核准卡圖'));
});

test('Phase42 maps all 53 skills to distinct shared-frame center paths',()=>{
 const a=trial();
 const cfg=a.env.window.__YOKAI_UPGRADE_PHASE42;
 assert.ok(cfg,'local opt-in must expose the approved art mapping');
 assert.equal(cfg.sharedCardIds.length,53);
 assert.equal(new Set(cfg.sharedCardIds).size,53);
 const paths=cfg.sharedCardIds.map(cfg.centerPath);
 assert.equal(new Set(paths).size,53,'no two skills may share an illustration');
 assert.equal(cfg.centerPath('mut_armorbreak'),
   'assets/img/skills/mut-armorbreak/cards/mut-armorbreak__art.webp');
 assert.equal(cfg.centerPath('oil_max'),
   'assets/img/skills/oil-max/cards/oil-max__art.webp');
  assert.equal(cfg.centerPath('katana'),
    'assets/img/skills/katana/cards/katana__art.webp');
});

test('第八／九招八張變異在公開模式使用各自的 WebP 與共用卡框',()=>{
 const a=trial('', 'example.com');
 class Img{
   naturalWidth=820;naturalHeight=1230;
   set src(url){this.url=url;this.onload?.();}
 }
 a.env.window.Image=Img;
 const cfg=a.env.window.__YOKAI_UPGRADE_PHASE42;
 const ids=cfg.sharedCardIds.filter(id=>/^mut_(seal_nail|shikigami)_/.test(id));
 assert.equal(ids.length,8);
 for(const id of ids){
   a.traces.length=0;
   a.UI.drawLevelUp(a.ctx,2,[{id,type:'mutation',n:'變異卡',d:'技能增益'}],{}, {},0,0,0,'keyboard');
   assert.ok(a.traces.some(t=>t.image===cfg.centerPath(id)));
   assert.ok(a.traces.some(t=>t.image===cfg.framePath));
 }
});

test('violet fragrance and seal nail share the new main art on public and local hosts',()=>{
  const local=trial('', 'localhost');
  class Img{
    naturalWidth=1024;naturalHeight=1536;
    set src(url){this.url=url;this.onload?.();}
  }
  local.env.window.Image=Img;
  local.UI.drawLevelUp(local.ctx,2,[{id:'ink_trail',type:'weapon',
    n:'紫藤毒香',lv:1,d:'移動留下粉紫色毒霧'},
    {id:'seal_nail',type:'weapon',n:'距爆・封印釘',lv:1,d:'走遠後蓄爆'}],{}, {},0,0,0,'keyboard');
  const cfg=local.env.window.__YOKAI_UPGRADE_PHASE42;
  const candidate=cfg.centerPath('ink_trail');
  assert.equal(candidate,'assets/img/skills/ink-trail/cards/ink-trail__art__incense.webp');
  assert.equal(cfg.sharedCardIds.length,53);
  assert.equal(local.traces.filter(t=>t.image===cfg.framePath).length,2);
  assert.equal(local.traces.filter(t=>t.image===candidate).length,1);
  assert.equal(local.traces.filter(t=>t.image==='assets/img/skills/seal-nail/cards/seal-nail__art__ritual.webp').length,1);
  assert.equal(cfg.centerPath('needle'),'assets/img/skills/needle/cards/needle__art.webp');
  assert.ok(local.traces.some(t=>t.text==='粉紫毒霧'));
  const publicHost=trial('','example.com');
  assert.equal(publicHost.env.window.__YOKAI_UPGRADE_PHASE42.sharedCardIds.length,53);
  assert.equal(publicHost.env.window.__YOKAI_UPGRADE_PHASE42.centerPath('ink_trail'),candidate);
  assert.equal(publicHost.env.window.__YOKAI_UPGRADE_PHASE42.centerPath('seal_nail'),
    'assets/img/skills/seal-nail/cards/seal-nail__art__ritual.webp');
  assert.equal(publicHost.env.window.__YOKAI_UPGRADE_PHASE42.centerPath('mut_ink_bloom'),
    'assets/img/skills/mut-ink-bloom/cards/mut-ink-bloom__art.webp');
});

test('passive, mutation and active cards use the identical raster frame with live labels',()=>{
 const a=trial();
 class TestImage{
   naturalWidth=1024;naturalHeight=1536;
   set src(url){this.url=url;this.onload?.();}
 }
 a.env.window.Image=TestImage;
 const choices=[
   {id:'oil_max',n:'長明燈油',type:'passive',d:'最大燈油提高'},
   {id:'mut_crosscut',n:'妖刀・十字交斬',type:'mutation',d:'增加交叉斬'},
   {id:'fire',n:'狐火',type:'weapon',d:'狐火攻擊'}
 ];
 a.UI.drawLevelUp(a.ctx,5,choices,{}, {},0,0,1,'keyboard');
 const cfg=a.env.window.__YOKAI_UPGRADE_PHASE42;
 assert.equal(a.traces.filter(t=>t.image===cfg.framePath).length,3);
 const cardsLayout=a.UI.levelUpLayout(choices.length).cards;
 for(const [i,choice] of choices.entries()){
   assert.equal(a.traces.filter(t=>t.image===cfg.centerPath(choice.id)).length,1,
     choice.id+' must render its own approved-style center art');
   const card=cardsLayout[i];
   const plaqueY=card.y+card.h*1158/1536;
   const plaqueText=a.traces.filter(t=>
     t.text&&Math.abs(t.x-(card.x+card.w/2))<1&&
     Math.abs(t.y-plaqueY)<=9).map(t=>t.text).join('');
   assert.equal(plaqueText,choice.n,
     choice.n+' must remain complete even if wrapped over two title rows');
 }
 assert.ok(a.traces.some(t=>t.text==='被動'));
 assert.ok(a.traces.some(t=>t.text==='變異'));
 assert.ok(!a.traces.some(t=>String(t.image||'').includes('/upgrade/illustrations/')));
});

test('HanWang local typography wraps long card names without squeezing 7 Chinese glyphs into one row',()=>{
 const a=trial('?upgradeUI=1&upgradeFont=hanyan');
 const name='妖刀・十字交斬';
 a.UI.drawLevelUp(a.ctx,5,[{id:'mut_crosscut',n:name,type:'mutation',d:'十字斬擊'}],
   {},{},1,0,0,'touch');
 const r=a.UI.levelUpLayout(1).cards[0];
 const y=r.y+r.h*1158/1536;
 const title=a.traces.filter(t=>t.text&&Math.abs(t.x-r.x-r.w/2)<1&&
    Math.abs(t.y-y)<=9);
 assert.equal(title.length,2);
 assert.equal(title.map(t=>t.text).join(''),name);
 assert.equal(title[1].y-title[0].y,16,'title rows use predictable spacing');
 assert.ok(title.every(t=>Number(t.font.match(/([\d.]+)px/)?.[1])>=15),
   'two rows remain big enough for mobile landscape');
 const desc=a.traces.find(t=>t.text.includes('十字斬擊'));
 assert.ok(desc,'description remains visible after title wraps');
 assert.ok(Number(desc.font.match(/([\d.]+)px/)?.[1])>=18,
   'body font increases at mobile landscape scale');
});
