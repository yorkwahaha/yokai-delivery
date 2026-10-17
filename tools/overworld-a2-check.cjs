#!/usr/bin/env node
// A2 geometry audit only. Reads the APPROVED V1 arrangement and runtime viewport formula.
// Never changes game code. Usage: node tools/overworld-a2-check.cjs
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const input=fs.readFileSync(path.join(root,'docs/overworld-eight-stage-layout-v1.html'),'utf8');
function extract(re,name){const m=input.match(re);if(!m)throw Error('Cannot parse '+name+' from approved A1');return vm.runInNewContext('('+m[1]+')');}
const stages=extract(/var stages=(\[[\s\S]*?\]);\s*var pass=/,'stages');
const waypoint=extract(/var pass=(\[[\s\S]*?\]);\s*var sequence=/,'waypoint');
const sequence=extract(/var sequence=(\[[^\]]+\]);/,'sequence');
const viewport=require(path.join(root,'js/viewport.js'));
const sizes=[
  ['baseline desktop',900,600],
  ['desktop 16:10',1440,900],
  ['ultrawide desktop',2560,1080],
  ['phone landscape',844,390],
  ['phone portrait',390,844],
  ['small phone portrait',360,800],
  ['tablet landscape',1194,834],
  ['tablet portrait',834,1194]
];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)); // Matches js/overworld.js exactly.
const rect=(x,y,w,h)=>({x,y,w,h});
const intersects=(a,b)=>Math.max(a.x,b.x)<Math.min(a.x+a.w,b.x+b.w)&&Math.max(a.y,b.y)<Math.min(a.y+a.h,b.y+b.h);
function analyse(width,height,worldH,responsiveHud){
  const v=viewport.calculate(width,height);
  const area={left:-v.offsetX,top:-v.offsetY,right:900+v.offsetX,bottom:600+v.offsetY,width:v.width,height:v.height};
  const covered=v.width<=3000+1e-6&&v.height<=worldH+1e-6;
  const results=stages.map(stage=>{
    const camX=clamp(stage.x-450,-area.left,3000-area.right);
    const camY=clamp(stage.y-300,-area.top,worldH-area.bottom);
    const view=rect(camX+area.left,camY+area.top,area.width,area.height);
    const label=rect(stage.x-104-camX,stage.y+43-camY,208,46);
    const player=rect(stage.x-75-44-camX,stage.y+23-96-camY,88,108);
    const landmark=rect(stage.x-52-camX,stage.y-70-camY,104,122);
    const panelY=responsiveHud?area.bottom-116:484;
    const buttonY=responsiveHud?area.bottom-88:512;
    const panel=rect(260,panelY,380,100);
    const button=rect(responsiveHud?area.right-132:768,buttonY,112,62);
    const title=rect(259,area.top-1,382,80);
    const back=rect(area.left+18,area.top+18,104,40);
    const hud={panel,button,title,back};
    const overlaps=[];
    for(const [element,shape] of Object.entries({label,player,landmark})){
      for(const [name,control] of Object.entries(hud))if(intersects(shape,control))overlaps.push(element+':'+name);
    }
    const withinStage=label.x+camX>=view.x-1&&label.x+label.w+camX<=view.x+view.w+1&&label.y+camY>=view.y-1&&label.y+label.h+camY<=view.y+view.h+1;
    return {stage:stage.name,camX:+camX.toFixed(1),camY:+camY.toFixed(1),
      stageScreen:[+(stage.x-camX-area.left).toFixed(1),+(stage.y-camY-area.top).toFixed(1)],
      overlaps,withinStage};
  });
  return {screen:width+'x'+height,logical:[+v.width.toFixed(1),+v.height.toFixed(1)],
    map:'3000x'+worldH,responsiveHud,mapCovered:covered,
    collisions:results.reduce((a,r)=>a+r.overlaps.length,0),
    offscreenLabels:results.filter(r=>!r.withinStage).map(r=>r.stage),stages:results};
}
if(stages.length!==8||waypoint.length!==9||sequence.length!==17)throw Error('A1 nodes mismatch');
const all=stages.concat(waypoint),byId=Object.fromEntries(all.map(n=>[n.id,n]));
const hops=sequence.slice(1).map((id,i)=>Math.hypot(byId[id].x-byId[sequence[i]].x,byId[id].y-byId[sequence[i]].y));
const current=sizes.map(([name,w,h])=>({device:name,...analyse(w,h,1600,false)}));
const adapted=sizes.map(([name,w,h])=>({device:name,...analyse(w,h,2200,true)}));
const output={source:'approved A1; viewport formulas from js/viewport.js; HUD coordinates from js/overworld.js',
 generatedAt:'2026-10-12',route:{stages:stages.length,waypoints:waypoint.length,edges:hops.length,maxHop:+Math.max(...hops).toFixed(1)},
 current:{world:'3000x1600, HUD fixed 900x600',devices:current},
 proposed:{world:'3000x2200, HUD anchored to viewport.bottom/right',devices:adapted}};
const out=path.join(root,'docs/overworld-a2-geometry-results.json');
fs.writeFileSync(out,JSON.stringify(output,null,2)+'\n');
for(const [label,items] of [['CURRENT',current],['PROPOSED',adapted]]){
 console.log('\n'+label);
 for(const d of items)console.log([d.device,d.screen,'logical='+d.logical.join('x'),'covered='+d.mapCovered,'collisions='+d.collisions,'hidden labels='+d.offscreenLabels.length].join(' | '));
}
console.log('\nWrote '+path.relative(root,out));
if(adapted.some(d=>!d.mapCovered||d.collisions||d.offscreenLabels.length)){console.error('PROPOSED A2 has failing cases; inspect JSON');process.exitCode=1;}
