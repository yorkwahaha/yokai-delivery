"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const api = require("../js/game-skill-expansion.js");
const {loadGame} = require("./helpers/game-runtime.cjs");

function fight(levels, enemies, mutations = []) {
  const runtime = api.create();
  const hits = [];
  const env = {
    player: {x: 0, y: 0}, enemies, levels, running: () => true, blocked: () => false,
    resolve: id => api.spec(id, levels[id], {mutations}),
    hit(enemy, amount, critical, feedback) {
      hits.push({enemy, amount, critical, feedback});
      enemy.hp -= amount;
    }
  };
  return {hits, step(seconds) {
    for (let i = 0; i < Math.round(seconds * 100); i++) runtime.tick(.01, env);
  }};
}
const foe = (x, y = 0, type = "ghost") => ({x, y, type, hp: 500});

test("wind applies no periodic damage and preserves both burst caps with 16 and 32 enemies", () => {
  for (const count of [16, 32]) {
    const enemies = Array.from({length: count}, (_, i) => foe(180 + i));
    const run = fight({wind_hole: 5}, enemies, ["mut_wind_hole_twin"]);
    run.step(2.59);
    assert.equal(run.hits.length, 0);
    run.step(.03);
    assert.equal(run.hits.length, Math.min(18, count));
    run.step(.86);
    assert.equal(run.hits.length, Math.min(18, count) + 9);
    assert.deepEqual(run.hits.map(h => h.feedback), Array(run.hits.length).fill("burst"));
    const total = run.hits.reduce((sum, h) => sum + h.amount, 0);
    assert.ok(Math.abs(total - (Math.min(18, count) + 4.5) * 8.6) < 1e-8);
  }
});

test("silk crossing and direct arrow hits use different feedback categories", () => {
  const crossing = foe(115, 45);
  const silk = fight({spider_silk: 1}, [foe(100), foe(120), crossing]);
  silk.step(.2);
  crossing.y = -28;
  silk.step(.12);
  assert.deepEqual(silk.hits.map(h => [h.enemy, h.feedback]), [[crossing, "periodic"]]);
  const arrow = fight({hamaya: 1}, [foe(180)]);
  arrow.step(1.2);
  assert.deepEqual(arrow.hits.map(h => h.feedback), ["direct"]);
});

test("a mixed 32-target batch shares one contact budget and reserves a kill label", () => {
  const game=loadGame();
  game.startRun();
  const labels=[], particles=[], deaths=[];
  game.env.RENDERER.spawnDamageNumber=amount=>labels.push(amount);
  game.env.FX.burst=(x,y,color,count)=>particles.push(count);
  game.env.FX.death=(...args)=>deaths.push(args);
  game.setElapsed(.1);
  const crowd=Array.from({length:32},(_,i)=>foe(200+i));
  for (const [i,enemy] of crowd.entries()) {
    game.hurt(enemy,2,false,false,i%2 ? "expansion_periodic" : "expansion_burst");
    assert.equal(enemy.hp,498);
  }
  assert.deepEqual(labels,[2,2,2]);
  assert.deepEqual(particles,[4]);
  const doomed={...foe(235),hp:1};
  game.hurt(doomed,2,false,false,"expansion_periodic");
  assert.equal(doomed.hp,-1);
  assert.equal(deaths.length,1);
  assert.deepEqual(labels,[2,2,2,2]);
  assert.deepEqual(particles,[4]);
  game.startRun();
  game.setElapsed(.1);
  const afterRestart=foe(230);
  game.hurt(afterRestart,2,false,false,"expansion_periodic");
  assert.equal(labels.length,5);
  assert.deepEqual(particles,[4,4]);
});

test("silk collapse hits near and far live endpoints once, with Boss resistance", () => {
  for (const [level, distance, variants, scale] of [
    [5, 90, [], 1.75],
    [5, 240, [], 1.75],
    [5, 300, ["mut_spider_silk_range"], 1.75],
    [4, 105, ["mut_spider_silk_return"], .55],
    [4, 280, ["mut_spider_silk_range", "mut_spider_silk_return"], .55],
    [5, 300, ["mut_spider_silk_range", "mut_spider_silk_return"], 2.30]
  ]) {
    const left = foe(140, -distance / 2, "boss"), right = foe(140, distance / 2);
    const collapse = fight({spider_silk: level}, [left, right], variants);
    collapse.step(.01);
    collapse.step(api.spec("spider_silk",level).life);
    assert.equal(collapse.hits.length, 2);
    assert.equal(new Set(collapse.hits.map(h => h.enemy)).size, 2);
    assert.ok(Math.abs(500-right.hp-api.spec("spider_silk",level).damage*scale) < 1e-8);
    assert.ok(Math.abs(left.hp - 500 - (right.hp - 500) * .85) < 1e-8);
    assert.ok(collapse.hits.every(h => h.feedback === "burst"));
  }
  const overlap = [foe(120), foe(120), foe(120), foe(120)];
  const run = fight({spider_silk: 5}, overlap);
  run.step(.02);
  overlap[0].hp = 0;
  run.step(3.2);
  const collapseHits = run.hits.filter(h => h.feedback === "burst").map(h => h.enemy);
  assert.equal(collapseHits.length, 3);
  assert.equal(new Set(collapseHits).size, 3);
  assert.ok(!collapseHits.includes(overlap[0]));
});

test("silk reserves the existing 12-hit budget for valid endpoints and excludes detached targets", () => {
  const nodes=[foe(145,-150),foe(145,150),foe(146,0)];
  const enemies=[...nodes];
  const run=fight({spider_silk:5},enemies,["mut_spider_silk_range"]);
  run.step(.01);
  nodes[2].x=900;
  const crowd=Array.from({length:15},()=>foe(145,30));
  const justOutside=foe(250,0);
  enemies.push(...crowd,justOutside);
  run.step(3.2);
  const hits=run.hits.filter(h=>h.feedback==="burst").map(h=>h.enemy);
  assert.equal(hits.length,12);
  assert.equal(new Set(hits).size,12);
  assert.ok(hits.includes(nodes[0]) && hits.includes(nodes[1]));
  assert.ok(!hits.includes(nodes[2]) && !hits.includes(justOutside));
});

test("expansion culling uses raster size and thread endpoints, with stable zero spin on ice", async () => {
  const assets = Object.fromEntries([
    ["wind_hole:field","field"], ["spider_silk:thread","thread"], ["ice_ball:ball","ball"]
  ].map(([key,name]) => [key,{path:`art/skill-expansion-10-13/${name}.webp`,labUse:true}]));
  const window = {};
  vm.runInNewContext(fs.readFileSync(require.resolve("../js/game-skill-expansion.js"),"utf8"),
    {window,fetch: async()=>({ok:true,json:()=>({assets})}),Image:class {
      complete=true; naturalWidth=200; naturalHeight=200;
    }});
  const renderer=window.GAME_SKILL_EXPANSION;
  await renderer.loadArt();
  const draws=[], turns=[];
  const ctx = {globalAlpha:1, save(){}, restore(){}, translate(){},
    rotate(angle){turns.push(angle);},
    drawImage(art){draws.push(art.src.split("/").at(-1));}};
  const view = {left:0,right:100,top:0,bottom:100};
  const field = {id:"wind_hole",event:"field",ground:true,x:-160,y:50,radius:182};
  renderer.paint(ctx,field,false,view);
  renderer.paint(ctx,{...field,x:-210},false,view);
  const thread = {id:"spider_silk",event:"thread",ground:true,x:250,y:45,length:175,angle:Math.PI};
  renderer.paint(ctx,thread,false,view);
  renderer.paint(ctx,{...thread,length:135},false,view);
  renderer.paint(ctx,{id:"ice_ball",event:"ball",x:45,y:65,angle:2.3,spin:0},false,view);
  assert.deepEqual(draws,["field.webp","thread.webp","ball.webp"]);
  assert.deepEqual(turns,[0,Math.PI,0]);
});
