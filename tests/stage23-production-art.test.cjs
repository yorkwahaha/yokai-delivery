'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const vm = require('node:vm');
const { loadGame } = require('./helpers/game-runtime.cjs');

const gameFiles = ['asset-paths', 'sakura-art-data', 'assets', 'viewport', 'renderer'];
const read = name => fs.readFileSync('js/' + name + '.js', 'utf8');
const portMobs = {
  ghost: 'wet-net-imp', runner: 'flying-fish-kid',
  tank: 'anchor-shell-turtle', shooter: 'tidal-jar-kid'
};

test('本機第一、二、四關各四波三種 Boss，第三波回鍋，終王與封印流程保留', () => {
  function spawn(game,stage,index) {
    game.start(stage);
    game.stopSpawns();
    game.env.RENDERER.getCam=()=>{
      const {x,y}=game.snapshot();
      return {x:x-450,y:y-300/game.env.VIEWPORT.tiltScale()};
    };
    if (stage === 'bamboo-maze') {
      const times = game.env.CONTENT.getStage(stage).pacing.bossTimes;
      if (index === 3) {
        game.setElapsed(times[0]);
        game.update(.05);
        const first = game.snapshot().enemies.find(e => e.bossIndex === 0);
        assert.ok(first);
        first.shield = false;
        game.hurt(first, first.hp);
      }
      game.setElapsed(times[index]);
    } else game.forceBossSchedule(index);
    for(let n=0;n<12;n++){
      game.update(.05);
      const boss=game.snapshot().enemies.find(e=>e.type==='boss' && e.bossIndex===index);
      if(boss)return boss;
    }
  }
  const plans = [
    ['night-town', ['狛犬石將','燈籠法師','狛犬石將','大妖鬼'], ['slam','charge','slam','slam']],
    ['rain-port', ['潮甲蟹將','沉舟幽姬','潮甲蟹將','港霧大妖'], ['tidalFan','rainVortex','tidalFan','rainVortex']],
    ['bamboo-maze', ['竹甲山豬','墨竹鬼姬','竹甲山豬','竹影魅妖'], ['bambooShoots','bambooCut','bambooShoots','bambooCut']]
  ];
  for (const [stage,titles,attacks] of plans) {
    const game=loadGame({stage,location:{hostname:'localhost',search:'?dev=1&stageLab=1'}});
    const ids=[];
    for (const [i,title] of titles.entries()) {
      const boss=spawn(game,stage,i);
      assert.equal(boss?.title,title,stage+' wave '+i);
      ids.push(boss.trialBoss.id);
      assert.equal(boss.final,i===3);
      assert.equal(boss.shield,true);
      assert.ok(boss.word.jp);
      boss.shield=false;
      assert.ok(game.env.BOSS_AI.start(boss,{x:boss.x+170,y:boss.y},{stageId:stage}));
      assert.equal(boss.hazard.kind,attacks[i]);
    }
    assert.equal(new Set(ids).size,3);
    assert.equal(ids[0],ids[2]);
  }
  const online=loadGame({location:{hostname:'example.com',search:''}});
  const boss=spawn(online,'rain-port',0);
  assert.equal(boss.title,'潮甲蟹將');
  assert.equal(boss.trialBoss.id,'tide-crab');
});

function boot() {
  const requests = [], drawn = [];
  class Image {
    constructor() { requests.push(this); this.dataset = {}; }
    set src(url) {
      this.url = url;
      const rel = url.split('?')[0];
      if (rel.startsWith('assets/img/stages/rain-port/')) {
        queueMicrotask(() => fs.existsSync(rel) ? this.ready() : this.onerror?.());
      }
    }
    get src() { return this.url; }
    ready() { this.naturalWidth = this.naturalHeight = 512; this.onload?.(); }
  }
  class Audio { addEventListener() {} }
  const ctx = new Proxy({ drawImage: (...args) => drawn.push(args) }, {
    get: (target, key) => target[key] ?? (() => {})
  });
  const canvas = () => ({ getContext: () => ctx });
  const env = {
    console, Image, Audio, URLSearchParams, innerWidth: 900, innerHeight: 600,
    location: { hostname: 'game.example.com', search: '' },
    document: { createElement: canvas },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    fetch: async url => {
      const rel = url.split('?')[0];
      return { ok: fs.existsSync(rel), json: async () => JSON.parse(fs.readFileSync(rel, 'utf8')) };
    }
  };
  env.window = env;
  vm.createContext(env);
  for (const name of gameFiles) vm.runInContext(read(name), env);
  env.RENDERER.init(canvas());
  return { env, requests, drawn };
}

test('本機首領繪出各自的待機、攻擊圖，腳底與共用結界對齊', () => {
  const { env, requests, drawn } = boot();
  env.location.hostname = 'localhost';
  for (const name of ['dev-mode','boss-roster-trial']) vm.runInContext(read(name),env);
  const roster=env.BOSS_ROSTER_TRIAL;
  const tested=new Set();
  for(const stage of ['night-town','rain-port','bamboo-maze']){
    env.RENDERER.setDepthStage(stage);
    roster.load(stage);
    for(const index of [0,1,3]){
      const trialBoss=roster.wave(stage,index);
      if(!trialBoss.height)continue;
      tested.add(trialBoss.id);
      for(const pose of ['idle','attack']){
        const url=`assets/img/enemies/${trialBoss.id}/${trialBoss.id}__sprite__${pose}.webp`;
        const image=requests.find(i=>i.src===url);
        assert.ok(image,url);
        assert.equal(fs.readFileSync(url).subarray(8,12).toString(),'WEBP');
        image.naturalWidth=640; image.naturalHeight=512;
      }
      const enemy={type:'boss',x:0,y:0,umibozu:stage==='rain-port',shield:true,trialBoss};
      env.RENDERER.drawMonster(enemy,{x:1},0);
      assert.match(drawn.at(-1)[0].src,/__sprite__idle\.webp$/);
      assert.deepEqual(drawn.at(-1).slice(1,5),[0,0,640,480]);
      assert.equal(drawn.at(-1)[6]+drawn.at(-1)[8],44);
      env.RENDERER.drawMonster({...enemy,shield:false,hazard:{phase:'telegraph'}},{x:1},0);
      assert.match(drawn.at(-1)[0].src,/__sprite__attack\.webp$/);
    }
  }
  assert.equal(tested.size,8);
});

test('正式雨港進關讀四種專屬敵圖，跑者與攻擊畫格實際繪出', () => {
  const { env, requests, drawn } = boot();
  env.loadStageAssets('night-town');
  assert.ok(requests.every(i => !Object.values(portMobs).some(id => i.src?.includes(id))));
  env.RENDERER.setDepthStage('rain-port');
  env.loadStageAssets('rain-port');
  const manifest = JSON.parse(fs.readFileSync('assets/img/stages/rain-port/enemies-manifest.json'));
  for (const [type, id] of Object.entries(portMobs)) {
    const frames = ['idle', 'attack', ...(type === 'runner' ? ['run__f01', 'run__f02'] : [])];
    for (const pose of frames) {
      const rel = `assets/img/enemies/${id}/${id}__sprite__${pose}.webp`;
      const img = requests.find(i => i.src?.split('?')[0] === rel);
      assert.ok(img, rel);
      const art = manifest.slots[type].sprites.find(item => item.pose === pose);
      assert.equal(art.path, rel);
      assert.equal(createHash('sha256').update(fs.readFileSync(rel)).digest('hex'), art.sha256);
      if (pose === 'attack') continue;
      img.ready();
    }
    const e = { type, x: 0, y: 0, hp: 20, wob: 0 };
    const draw = (time = 0) => { env.RENDERER.drawMonster(e, { x: 10 }, time); return drawn.at(-1); };
    assert.match(draw()[0].src, /__idle\.webp/);
    e.walking = true;
    if (type === 'runner') {
      assert.match(draw()[0].src, /__run__f01\.webp/);
      assert.match(draw(.15)[0].src, /__run__f02\.webp/);
    }
    e.attackT = .2;
    assert.match(draw()[0].src, /__idle\.webp/, 'while loading, use the matching idle image');
    requests.find(i => i.src?.includes(`${id}__sprite__attack`)).ready();
    const strike = draw();
    assert.match(strike[0].src, /__attack\.webp/);
    assert.ok(Math.abs(strike[6] + strike[8] - 19) < 1e-8, 'feet land at the existing shadow offset');
  }
  env.RENDERER.setDepthStage('night-town');
  const ghost = { naturalWidth: 149, naturalHeight: 208 };
  env.ART.ghost = ghost;
  env.RENDERER.drawMonster({ type: 'ghost', x: 0, y: 0 }, { x: 1 }, 0);
  assert.equal(drawn.at(-1)[0], ghost);
});

test('正式雨港進關也會載入清單中的 20 張地面、建築、道具與地景圖', async () => {
  const { env, requests } = boot();
  env.loadStageAssets('rain-port');
  await env.loadS2ArtProdAssets();
  const cache = env.S2_ART_PROD_CACHE;
  const scene = [...cache.tiles.stoneVariants, ...cache.tiles.woodVariants,
    ...cache.tiles.transitions.h, ...cache.tiles.transitions.v,
    ...cache.buildings, ...cache.props, ...cache.environment];
  assert.equal(cache.loadError, null);
  assert.equal(scene.length, 20);
  for (const art of scene) {
    assert.equal(art._loaded, true, art.id);
    assert.ok(requests.includes(art._img), art.id);
    assert.ok(art._img.src.startsWith('assets/img/stages/rain-port/'), art.id);
  }
});

test('正式第三關載入全部 39 張選定圖，既有四戰用三種王圖與對應名稱', () => {
  const { env, requests, drawn } = boot();
  const game = loadGame({ stage: 'sakura-pass' });
  game.env.loadStageMapArt = env.loadStageMapArt;
  game.start('sakura-pass');
  assert.equal(env.STAGE_ART_RESOLVER.getStageStatus('sakura-pass').artStatus, 'USER_SELECTED_RUNTIME');
  assert.equal(env.STAGE_ART_RESOLVER.resolveStageArt('sakura-pass', 'ground', 'dirt').status, 'USER_SELECTED_RUNTIME');
  const { assets, trial_assets } = JSON.parse(fs.readFileSync('assets/img/stages/sakura-pass/manifest.json'));
  assert.equal(assets.length, 39);
  assert.ok(trial_assets.some(art => art.role === 'rootWarning'));
  assert.ok(trial_assets.every(art => requests.some(i => i.src?.split('?')[0] === art.path)));
  for (const art of assets) {
    const img = requests.find(i => i.src?.split('?')[0] === art.path);
    assert.ok(img, art.path);
    img.ready();
  }
  game.env.SAKURA_ART_DATA = env.SAKURA_ART_DATA;
  const expected = [
    ['ancient-sakura-guardian', '千年櫻守'], ['night-sakura-princess', '夜櫻鬼姬'],
    ['ancient-sakura-guardian', '千年櫻守'], ['sakura-tengu', '櫻鬼·花天狗']
  ];
  env.RENDERER.setDepthStage('sakura-pass');
  expected.forEach(([id, title], index) => {
    game.start('sakura-pass');
    game.stopSpawns();
    game.forceBossSchedule(index, 0);
    game.update(.05);
    const boss = game.snapshot().enemies.find(e => e.type === 'boss');
    assert.equal(boss?.title, title);
    env.RENDERER.drawMonster({ ...boss, shield: false, attackT: .2 }, { x: 0 }, 0);
    assert.match(drawn.at(-1)[0].src, new RegExp(id + '__sprite__attack'));
  });
});
