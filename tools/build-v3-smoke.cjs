// Browser validation only: copy the real runtime and expose controlled scenes.
// The generated page uses memory-only storage and is never loaded by index.html.
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const source=fs.readFileSync('js/game.js','utf8');
const anchor='  requestAnimationFrame(frame);',at=source.lastIndexOf(anchor);
if(at<0)throw new Error('Real game RAF entry missing');
const hook=String.raw`
  window.V3_SMOKE={
    delivery(){
      start();tutorial=null;spawnT=surgeT=bossT=Infinity;
      enemies=[];enemyBullets=[];orders=[];job=null;makeOrder();
      inter=orders[0];interact();job.lock=0;
      P.x=job.to.x;P.y=job.to.y+110;oil=80;
    },
    boss(){
      start();tutorial=null;spawnT=surgeT=Infinity;
      bossStage=3;elapsed=540;bossT=0;enemies=[];orders=[];job=null;oil=100;
    },
    correct(){if(bossQ){bossQ.lock=0;answerBoss(bossQ.ans.indexOf(bossQ.word));}
      else if(job){job.lock=0;resolve(job.ans.indexOf(job.word));}},
    wrong(){if(bossQ){bossQ.lock=0;answerBoss(bossQ.ans.findIndex(w=>w!==bossQ.word));}
      else if(job){job.lock=0;resolve(job.ans.findIndex(w=>w!==job.word));}},
    hint(){triggerHint();},
    nearBoss(){const e=enemies.find(e=>e.final&&e.hp>0);if(e){P.x=e.x-180;P.y=e.y;}},
    halfBoss(){const e=enemies.find(e=>e.final&&e.hp>0);if(e){e.hp=e.max*.49;}},
    maxBuild(){Object.keys(WL).forEach(k=>WL[k]=['katana','barrier','needle','fire'].includes(k)?5:0);},
    status(){return {state,elapsed:Number(elapsed.toFixed(2)),oil:Number(oil.toFixed(2)),delivered,failed,
      job:job?{reading:job.reading,assisted:job.assisted,hold:job.hold}:null,
      bossQ:!!bossQ,boss:enemies.find(e=>e.final&&e.hp>0),
      awakening:typeof awakeningState==='function'?awakeningState():null};}
  };
`;
const runtime=source.slice(0,at)+hook+source.slice(at);
new vm.Script(runtime);
const digest=crypto.createHash('sha256').update(source).digest('hex');
fs.writeFileSync('artifacts/validation/v3-game-runtime.js',runtime);
let html=fs.readFileSync('index.html','utf8');
html=html.replace('<head>','<head><base href="../../">').replace(/<script src="js\/game\.js[^\"]*"><\/script>/,
  `<script src="artifacts/validation/v3-game-runtime.js?v=${digest.slice(0,12)}"></script>`);
const storage=`<script>{const data=new Map();Object.defineProperty(window,'localStorage',{value:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)}});}</script>`;
html=html.replace('<body>',`<body>${storage}`);
html=html.replace('</body>',`<aside style="position:fixed;left:8px;bottom:8px;z-index:30;background:#fff3d4;color:#211719;padding:4px;font:12px sans-serif">
<button onclick="V3_SMOKE.delivery()">配送讀題</button><button onclick="V3_SMOKE.boss()">九分鐘終王</button>
<button onclick="V3_SMOKE.wrong()">錯答</button><button onclick="V3_SMOKE.correct()">補送／破盾</button>
<button onclick="V3_SMOKE.hint()">免費提示</button><button onclick="V3_SMOKE.nearBoss()">接近終王</button>
<button onclick="V3_SMOKE.halfBoss()">終王半血</button><button onclick="V3_SMOKE.maxBuild()">四技MAX</button>
<output id="v3-smoke-status" style="display:block"></output></aside>
<script>setInterval(()=>{const s=V3_SMOKE.status();const {boss,...brief}=s;document.getElementById('v3-smoke-status').textContent=JSON.stringify({...brief,boss:boss?{hp:boss.hp,shield:boss.shield,hazard:boss.hazard?{kind:boss.hazard.kind,phase:boss.hazard.phase}:null,slamT:boss.slamT}:null});},200);</script></body>`);
fs.writeFileSync('artifacts/validation/v3-game-smoke.html',html);
fs.writeFileSync('artifacts/validation/v3-game-source.json',JSON.stringify({path:'js/game.js',sha256:digest,controlled:true,storage:'memory-only'},null,2)+'\n');
console.log(`V3 browser runtime copied from ${digest.slice(0,12)}; not a natural-play simulation`);
