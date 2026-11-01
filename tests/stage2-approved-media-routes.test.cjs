const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const read = rel => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const registry = read('docs/ASSET_REGISTRY.json');
const runtime = read('assets/img/runtime-art-manifest.json');
const enemy = read('assets/img/rain-port/enemies/runtime-manifest-20261014.json');
const canonicalStage = read('assets/img/stages/rain-port/manifest.json');
const js = fs.readFileSync(path.join(ROOT, 'js/assets.js'), 'utf8');
const sandbox = {window:{}};
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js/asset-paths.js'), 'utf8'), sandbox);
const routes = sandbox.window.ASSET_PATHS;
const hash = rel => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex');

test('STAGE2 以實際 runtime 核准清單為準：20 個場景檔、20 個使用位置，且原檔與正式 SHA256 一致',()=>{
  const stage = runtime.stages['rain-port'];
  assert.equal(stage.status, 'APPROVED');
  assert.equal(stage.default_runtime, 'assets/img/stages/rain-port/');
  assert.equal(canonicalStage.status, 'APPROVED_RUNTIME');
  assert.equal(canonicalStage.count, 20);
  const selected=[];
  function walk(v) {
    if(Array.isArray(v)){ for(const x of v)walk(x);return; }
    if(!v || typeof v!=='object')return;
    if((v.runtime_status==='APPROVED_RUNTIME'||v.runtime_status==='USER_SELECTED_RUNTIME') && v.path){
      assert.ok(v.path.startsWith('assets/img/stages/rain-port/'));
      assert.ok(v.legacy_source_path.startsWith('assets/img/rain-port/s2-production/'));
      assert.equal(hash(v.path),hash(v.legacy_source_path));
      assert.equal(hash(v.path),v.sha256);
      assert.equal(routes.resolve(v.legacy_source_path),v.path);
      selected.push(v);
    }
    for(const x of Object.values(v))walk(x);
  }
  walk(stage);
  assert.equal(selected.length,20);
  assert.equal(new Set(selected.map(x=>x.path)).size,20);
  assert.equal(canonicalStage.assets.length,20);
  assert.equal(new Set(canonicalStage.assets.map(x=>x.path)).size,20);
  assert.ok(stage.tiles.stoneVariants.every(x=>/rain-port__g-stone-0[1-4]\.webp$/.test(x.path)));
});

test('STAGE2 四張敵人動作圖有明確使用者核准紀錄，錨點、檔案和 fallback 仍完整',()=>{
  assert.equal(enemy.status, 'USER_APPROVED_FOR_RUNTIME');
  assert.equal(Object.keys(enemy.runtime_sprites).length,4);
  for(const [name,record] of Object.entries(enemy.runtime_sprites)){
    assert.ok(record.runtime_path.startsWith('assets/img/enemies/'));
    assert.ok(record.legacy_runtime_path.startsWith('assets/img/rain-port/enemies/'));
    assert.equal(routes.resolve(record.legacy_runtime_path),record.runtime_path);
    assert.equal(hash(record.runtime_path),record.sha256);
    assert.equal(hash(record.legacy_runtime_path),record.sha256);
    assert.ok(record.runtime_anchor);
  }
  assert.ok(js.includes('window.ASSET_PATHS?.resolve(url) || url'));
  assert.ok(js.includes('img.__stage2LegacyAttempted'));
});

test('STAGE2 新核准的四張石地主變體正式接入，未核准的水王特效仍不得進正式遊戲',()=>{
  for(let i=1;i<=4;i++){
    const stem='g_stone_0'+i;
    const source='assets/img/rain-port/s2-production/'+stem+'.webp';
    const rejected='assets/img/stages/rain-port/tiles/rain-port__g-stone-0'+i+'.webp';
    const archived='art/stage2-rain-port/archive/replaced-stone-copies-20261031/rain-port__g-stone-0'+i+'.webp';
    assert.ok(fs.existsSync(path.join(ROOT,source)));
    assert.equal(fs.existsSync(path.join(ROOT,rejected)),true);
    assert.equal(hash(source),hash(rejected));
    if(fs.existsSync(path.join(ROOT,archived))) assert.equal(hash(source),hash(archived));
    assert.equal(routes.resolve(source),rejected);
  }
  const hazards=runtime.boss_water_hazards;
  assert.equal(Object.keys(hazards).length,3);
  for(const record of Object.values(hazards)){
    assert.equal(record.status,'BLOCKED');
    assert.ok(record.path.startsWith('assets/img/vfx/boss-water-r8/'));
    assert.equal(routes.resolve(record.path),record.path);
  }
  const active=registry.aliases.filter(x=>x.route&&
    (x.source.includes('/rain-port/s2-production/')||x.source.includes('/rain-port/enemies/')));
  // The three deleted legacy floor slots are not approved runtime aliases.
  // Twenty approved scenes plus four enemy motion assets; archived mud is not in the active set.
  assert.equal(active.length,24);
  for(const entry of active){
    assert.equal(routes.resolve(entry.source),entry.canonical);
  }
});
