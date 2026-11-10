'use strict';
// Live-game VM regression: never substitute a hand-written projectile model.
const test=require('node:test'), assert=require('node:assert/strict');
const {loadGame}=require('./helpers/game-runtime.cjs');
function launch(foes,rank=1){
  const g=loadGame({seed:11}); g.start();g.stopSpawns();
  g.combatScene('boom',foes,[],rank);g.weapons(.05);
  assert.ok(g.snapshot().proj.length,'weapons() must create a projectile');
  return g;
}
function stick(g){
  for(let i=0;i<12&&!g.snapshot().proj.some(q=>q.stuck);i++)g.weapons(.05);
  const q=g.snapshot().proj.find(q=>q.stuck);
  assert.ok(q?.target,'real projectile must attach');
  g.setWeaponRank('boom',0); // Disable later autocast, not the active projectile.
  return q;
}
function close(actual,expected){
  assert.ok(Math.abs(actual-expected)<1e-8,actual+' expected '+expected);
}
test('real boom follows the first overlapping enemy and detonates on fuse',()=>{
  const g=launch([{dx:100,hp:100,max:100},{dx:110,hp:100,max:100}]);
  const q=stick(g),enemy=g.snapshot().enemies[0];
  assert.equal(q.target,enemy);
  const fuse=q.fuse;enemy.x+=18;enemy.y+=12;g.weapons(.05);
  assert.equal(q.x,enemy.x);assert.equal(q.y,enemy.y);assert.ok(q.fuse<fuse);
  g.weapons(1.6);
  assert.equal(q.exploded,true);assert.equal(q.done,true);
  assert.equal(g.snapshot().proj.includes(q),false);
});
test('real boom full/splash/far damage uses production explosion',()=>{
  const g=launch([{dx:100,hp:100,max:100},{dx:150,hp:100,max:100},{dx:400,hp:100,max:100}]);
  const q=stick(g),[primary,nearby,far]=g.snapshot().enemies;
  assert.equal(q.target,primary);
  const {damage,splashDamage}=q;g.weapons(1.6);
  close(primary.hp,100-damage);close(nearby.hp,100-splashDamage);
  assert.equal(far.hp,100);
});
test('real boom explosion cannot fire twice on later ticks',()=>{
  const g=launch([{dx:100,hp:100,max:100}]),q=stick(g);
  g.weapons(1.6);const hp=q.target.hp;g.weapons(.1);g.weapons(.1);
  assert.equal(q.exploded,true);
  assert.equal(q.done,true);
  assert.equal(g.snapshot().proj.includes(q),false);
  assert.equal(q.target.hp,hp,'further weapon ticks must not damage twice');
});
test('real boom does not launch toward a shield-only Boss or damage its seal',()=>{
  const g=loadGame({seed:11});g.start();g.stopSpawns();
  g.combatScene('boom',[{dx:100,type:'boss',shield:true,hp:500,max:500,speed:0}],[],1);
  g.weapons(.05);
  assert.equal(g.snapshot().proj.length,0,'shielded Boss must not be the launch target');
  assert.equal(g.snapshot().enemies[0].hp,500);
});
test('real boom explodes early and clears when attached target dies',()=>{
  const g=launch([{dx:100,hp:100,max:100}]),q=stick(g);
  q.target.hp=0;g.weapons(.05);
  assert.equal(q.exploded,true);assert.equal(g.snapshot().proj.includes(q),false);
});
test('actual game restart clears launched boom projectiles',()=>{
  const g=launch([{dx:100,hp:100,max:100}]);
  assert.ok(g.snapshot().proj.length);g.start();
  assert.equal(g.snapshot().proj.length,0);
});
test('real boom cast retains Lv1-4 radii and halves Lv5 blast diameter',()=>{
  for(const [i,r] of [78,92,108,122,153].entries()){
    const g=launch([{dx:100,hp:100,max:100}],i+1);
    assert.equal(g.snapshot().proj[0].radius,r);
  }
});

test('Lv1-4 talisman blast damages at most two nearest neighbors',()=>{
  const g=launch([100,130,160,190,290,410].map(dx=>({dx,hp:100,max:100,speed:0})),4);
  const projectiles=g.snapshot().proj, enemies=g.snapshot().enemies;
  const q=projectiles[0];q.stuck=true;q.target=enemies[0];
  q.x=enemies[0].x;q.y=enemies[0].y;q.fuse=.01;
  projectiles.splice(1);g.setWeaponRank('boom',0);g.weapons(.04);
  close(enemies[0].hp,100-q.damage);
  close(enemies[1].hp,100-q.splashDamage);
  close(enemies[2].hp,100-q.splashDamage);
  for(const e of enemies.slice(3))close(e.hp,100);
});

test('Lv5 explosion damages every enemy in the 153px AoE for full direct damage',()=>{
  const g=launch([100,130,160,190,290,410].map(dx=>({dx,hp:100,max:100,speed:0})),5);
  const projectiles=g.snapshot().proj, enemies=g.snapshot().enemies;
  const q=projectiles[0];q.stuck=true;q.target=enemies[0];
  q.x=enemies[0].x;q.y=enemies[0].y;q.fuse=.01;
  projectiles.splice(1);g.setWeaponRank('boom',0);g.weapons(.04);
  assert.equal(q.radius,153);
  assert.equal(q.splashDamage,q.damage);
  for(const e of enemies.slice(0,4))close(e.hp,100-q.damage);
  for(const e of enemies.slice(4))close(e.hp,100);
});
