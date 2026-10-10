// Codex independent weapon-only measurement; not a route or live boss fight.
const fs = require('node:fs');
const crypto = require('node:crypto');
const {loadGame} = require('../tests/helpers/game-runtime.cjs');
const ids = ['katana','barrier','needle','boom','fire','thunder'];
const builds = [];
for(let a=0;a<3;a++) for(let b=a+1;b<4;b++) for(let c=b+1;c<5;c++) for(let d=c+1;d<6;d++) builds.push([ids[a],ids[b],ids[c],ids[d]]);
const rows=[];
for(const seed of [11,23,47]) for(const build of builds) {
  const g=loadGame({seed}); g.start(); g.stopSpawns(); g.clearEnemies();
  for(const id of ids) g.setWeaponRank(id,build.includes(id)?5:0);
  g.setDamageCoefficient(2.4); g.armWeapons(); g.placeBoss(1400);
  const boss=g.snapshot().enemies.find(e=>e.type==='boss');
  let frame=0;
  while(boss.hp>0 && frame<18000) {
    g.setElapsed(frame/100); g.weapons(.01); frame++;
  }
  rows.push({seed,build,seconds:frame/100,killed:boss.hp<=0,remainingHp:Math.max(0,boss.hp)});
}
if(rows.length!==45 || rows.some(r=>!r.killed)) throw new Error('Incomplete build matrix');
const sources=Object.fromEntries(['game','evolutions','config'].map(n=>[n,crypto.createHash('sha256').update(fs.readFileSync(`js/${n}.js`)).digest('hex')]));
const result={kind:'weapon-only stationary boss',sources,hp:1400,damageCoefficient:2.4,secondsStep:.01,
  limits:'Four MAX supplied, no passive rate/crit, no incoming damage, no AI movement, no quiz, no delivery or natural growth; target at dx140.',
  min:Math.min(...rows.map(r=>r.seconds)),max:Math.max(...rows.map(r=>r.seconds)),rows};
fs.writeFileSync('artifacts/validation/v3-final-build-matrix.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({samples:rows.length,min:result.min,max:result.max,allKilled:true}));
