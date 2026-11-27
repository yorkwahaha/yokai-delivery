'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { loadGame } = require('./helpers/game-runtime.cjs');

const seal = ['wide','deep','near','swift'].map(id => 'mut_seal_nail_' + id);
const wolf = ['guard','life','quick','fang'].map(id => 'mut_shikigami_' + id);
const boot = () => loadGame({ stage: 'bamboo-maze', location: { hostname: 'public.example', search: '' } });
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} ~= ${expected}`);

test('V2 秘術圖鑑沿用三招及十二變異的最新說明，頁尾可以選取', () => {
  const { GAME_CATALOG, GAME_SHIKIGAMI, UI }=boot().env;
  const skills=[GAME_CATALOG.WI.ink_trail,GAME_CATALOG.WI.seal_nail,GAME_SHIKIGAMI.CARD];
  for(const skill of skills){
    const entry=UI.CARD_LIST.filter(c=>c.emblem===skill.id);
    assert.equal(entry.length,1);
    assert.equal(entry[0].desc,skill.desc);
    const variants=Object.values(GAME_CATALOG.MUTATION_CONFIG).filter(c=>c.skillId===skill.id);
    assert.equal(variants.length,4);
    for(const variant of variants) assert.equal(UI.CARD_LIST.find(c=>c.emblem===variant.id)?.desc,variant.d);
  }
  const last=Math.ceil(UI.CARD_LIST.length/UI.codexRows())-1;
  assert.ok(UI.codexButtons('cards',last,0).some(button=>button.id===`secret:${UI.CARD_LIST.length-1}`));
});

test('V2 封印釘三枚各自計時，待爆第二段不阻塞下一枚', () => {
  const { GAME_SEAL_NAIL } = boot().env;
  const trap = GAME_SEAL_NAIL.create({staged:true}), events = [], hits = [];
  const foe = { x: 500, y: 0, hp: 500, type: 'boss' };
  const tick = (dt, x, dx = 0) => trap.tick({dt, level:5, start:{x,y:0}, end:{x:x+dx,y:0},
    enemies:[foe,foe], hit:(_,damage)=>hits.push(damage), onEvent:e=>events.push(e)});
  tick(.05,0,1); tick(1.6,100,1); tick(1.6,200,1);
  assert.equal(trap.snapshot(5).activeCount,3);
  tick(1.6,200); assert.equal(trap.snapshot(5).activeCount,3);
  foe.x=10; tick(.05,300); // only the first center is stepped on
  assert.equal(trap.snapshot(5).activeCount,2);
  assert.equal(trap.snapshot(5).secondCount,1);
  tick(.05,300,1); // plant while the first pin's second wave is still pending
  assert.equal(trap.snapshot(5).activeCount,3);
  assert.equal(trap.snapshot(5).secondCount,1);
  tick(.45,300);
  assert.deepEqual(events,['drop','drop','drop','burst','drop','second']);
  assert.equal(hits.length,2);
  near(hits[0],14*.8); near(hits[1],14*.6*.8);
  assert.equal(trap.snapshot(5).activeCount,3);
});

test('V2 毒傷每四分之一秒分攤 DPS，重疊煙霧只計一次，Boss 保持減傷', () => {
  const { GAME_VIOLET_SCENT } = boot().env;
  const scent=GAME_VIOLET_SCENT.create(), normal={x:56,y:0,hp:500}, boss={...normal,type:'boss'};
  const player={x:80,y:0}, hits=[];
  for(let i=0;i<2;i++)scent.tick({dt:.21,level:5,start:{x:0,y:0},end:player});
  const tick=dt=>scent.tick({dt,level:5,start:player,end:player,enemies:[normal,boss],
    hit:(foe,damage)=>hits.push([foe,damage])});
  tick(.125);
  assert.equal(hits.length,0);
  tick(.125);
  assert.equal(scent.snapshot().clouds,2);
  assert.equal(hits.length,2);
  for(let i=0;i<15;i++)tick(.05);
  assert.equal(hits.filter(([foe])=>foe===normal).length,4);
  near(hits.filter(([foe])=>foe===normal).reduce((sum,[,d])=>sum+d,0),5.2);
  near(hits.filter(([foe])=>foe===boss).reduce((sum,[,d])=>sum+d,0),5.2*.6);
});

test('V2 每波最多命中 15 隻、幀內重複實體只結算一次，讀題清掉所有待爆', () => {
  const { GAME_SEAL_NAIL } = boot().env;
  const trap=GAME_SEAL_NAIL.create(),hits=[];
  const crowd=Array.from({length:25},(_,id)=>({x:10,y:0,hp:200,id}));
  const opts={level:5,enemies:[crowd[0],...crowd],hit:e=>hits.push(e.id)};
  trap.tick({...opts,dt:.05,start:{x:0,y:0},end:{x:1,y:0}});
  trap.tick({...opts,dt:.05,start:{x:110,y:0},end:{x:110,y:0}});
  assert.equal(hits.length,15);
  assert.equal(new Set(hits).size,15);
  assert.equal(trap.snapshot(5).secondCount,1);
  trap.suspend();
  trap.tick({...opts,dt:.50,start:{x:110,y:0},end:{x:110,y:0}});
  assert.equal(hits.length,15);
});

test('V2 地面兩段首幀爆炸貼圖覆蓋各自的實際命中半徑', () => {
  const {GAME_SEAL_NAIL}=boot().env;
  const trap=GAME_SEAL_NAIL.create({staged:true}), cfg=GAME_SEAL_NAIL.spec(5);
  const point=x=>({x,y:0}), player=point(115), edge=point(cfg.radius);
  edge.hp=100;
  const hits=[], draws=[], trigger={x:20,y:0,hp:100};
  const tick=(dt,start,end)=>trap.tick({dt,level:5,start,end,enemies:[edge,trigger],hit:e=>{if(e===edge)hits.push('hit');}});
  const art={painted:true,burst:{naturalWidth:448,naturalHeight:448},awaken:{naturalWidth:448,naturalHeight:448}};
  const ctx={globalAlpha:1,save(){},restore(){},translate(){},rotate(){},drawImage(...args){draws.push(args);}};
  tick(.05,point(0),point(1)); tick(.05,player,player);
  assert.equal(hits.length,1);
  trap.paint(ctx,art);
  assert.equal(draws.find(args=>args[0]===art.burst).at(-1),cfg.radius*2);
  tick(.43,player,player); trap.paint(ctx,art);
  assert.equal(hits.length,2);
  assert.equal(draws.find(args=>args[0]===art.awaken).at(-1),cfg.radius*.78*2);
});

test('兩組各四張正式變異卡，持有才可抽、每招各限兩種', () => {
  const game = boot();
  const { GAME_CATALOG, GAME_BUILD_RULES } = game.env;
  const config = GAME_CATALOG.MUTATION_CONFIG;
  for (const [skill, ids] of [['seal_nail',seal], ['shikigami',wolf]]) {
    assert.deepEqual(Object.keys(config).filter(id => config[id].skillId === skill), ids);
    for (const id of ids) {
      assert.equal(GAME_BUILD_RULES.canAddMutation(id, [], config, {}, 2), false);
      assert.equal(GAME_BUILD_RULES.canAddMutation(id, [], config, { [skill]: 1 }, 2), true);
      assert.equal(GAME_BUILD_RULES.canAddMutation(id, [id], config, { [skill]: 1 }, 2), false);
    }
    assert.equal(GAME_BUILD_RULES.canAddMutation(ids[2], ids.slice(0,2), config, { [skill]: 1 }, 2), false);
  }
  assert.equal(GAME_BUILD_RULES.canAddMutation(wolf[0], seal.slice(0,2), config, { shikigami: 1 }, 2), true);
  game.start('bamboo-maze');
  game.setWeaponRank('seal_nail', 1);
  game.env.Math.random = () => 0;
  const card = game.eligibleChoices().find(c => c.type === 'mutation');
  assert.equal(card?.id, seal[0]);
  assert.equal(card.f(), true);
  assert.equal(card.f(), false);
});

test('封印釘同一規格提供爆域、雙段傷害、踩踏半徑與冷卻', () => {
  const { GAME_SEAL_NAIL } = boot().env;
  const base = GAME_SEAL_NAIL.spec(5, 2);
  const changed = GAME_SEAL_NAIL.spec(5, 2, seal);
  near(changed.radius, base.radius * 1.25);
  near(changed.damage, base.damage * 1.25);
  near(changed.secondDamage, base.secondDamage * 1.25);
  near(changed.triggerRadius, base.triggerRadius + 20);
  near(changed.cooldown, base.cooldown * .82);
});

test('封印釘在實際爆破使用變異踩踏半徑與傷害，Lv5 第二段仍排程一次', () => {
  const { GAME_SEAL_NAIL } = boot().env;
  const trap = GAME_SEAL_NAIL.create();
  const start = { x: 0, y: 0 }, enemy = { x:57,y:0,hp:999 };
  const hits = [];
  const tick = (dt, end) => trap.tick({ dt, level: 5, start, end, mutations: seal.slice(1,3),
    enemies: [enemy], hit: (_enemy, damage) => hits.push(damage) });
  tick(.1, { x: 1, y: 0 });
  tick(.1, { x: 84, y: 0 });
  assert.equal(hits.length, 0);
  enemy.x=56;
  tick(.1, { x: 85, y: 0 });
  assert.deepEqual(hits, [17.5]);
  assert.equal(trap.snapshot(5).pendingSecond, true);
  tick(.25, { x: 85, y: 0 });
  assert.deepEqual(hits, [17.5, 10.5]);
});

test('白狼變異改變生命、存續、攻擊間隔與傷害', () => {
  const { GAME_SHIKIGAMI } = boot().env;
  const base = GAME_SHIKIGAMI.spec(5, 2);
  const changed = GAME_SHIKIGAMI.spec(5, 2, wolf);
  assert.equal(changed.maxHp, Math.round(base.maxHp * 1.30));
  near(changed.life, base.life + 3);
  near(changed.attackInterval, base.attackInterval * .82);
  near(changed.damage, base.damage * 1.25);
  assert.equal(changed.cooldown, base.cooldown);
});

test('白狼存活中拿到強軀與長契時保留已受傷量並只延長一次', () => {
  const { GAME_SHIKIGAMI } = boot().env;
  const ally = GAME_SHIKIGAMI.create({ species: 'hound' });
  const player = { x: 0, y: 0 };
  ally.tick({ dt: .1, level: 1, player });
  ally.body().hp -= 12;
  const before = ally.snapshot();
  ally.tick({ dt: .1, level: 1, player, mutations: wolf.slice(0,2) });
  assert.equal(ally.snapshot().maxHp, 78);
  assert.equal(ally.snapshot().hp, 66);
  near(ally.snapshot().remaining, before.remaining + 2.9);
  ally.tick({ dt: .1, level: 1, player, mutations: wolf.slice(0,2) });
  near(ally.snapshot().remaining, before.remaining + 2.8);
});
