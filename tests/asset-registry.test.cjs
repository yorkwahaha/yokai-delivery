const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const cp=require('node:child_process');
const ROOT=path.resolve(__dirname,'..');
function scanRegistry(spawn=cp.spawnSync, platform=process.platform) {
 const args=['tools/asset_registry.py','--check'];
 const options={cwd:ROOT,encoding:'utf8',timeout:45000};
 const scan=spawn('python',args,options);
 const storeAlias=scan.status===9009 && /Microsoft Store|App execution aliases/i.test(scan.stderr||'');
 if(platform!=='win32' || (!storeAlias && !['ENOENT','EACCES','EPERM'].includes(scan.error?.code))) return scan;
 const fallback=spawn('py',['-3',...args],options);
 if(fallback.error) {
  throw new Error(`Unable to start Python: python (${scan.error?.message || scan.stderr || scan.status}); py -3 (${fallback.error.message})`);
 }
 return fallback;
}
const registry=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/ASSET_REGISTRY.json'),'utf8'));
const inventory=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/ASSET_INVENTORY.json'),'utf8'));
const window={};
vm.runInNewContext(fs.readFileSync(path.join(ROOT,'js/asset-paths.js'),'utf8'),{window});
const routes=window.ASSET_PATHS;
test('ASSET-REGISTRY 全遊戲正式類別與關卡 ID 已鎖定，禁止候選字眼成正式路徑',()=>{
 assert.equal(registry.schema,1);
 assert.ok(registry.templates.enemy);
 assert.ok(registry.templates.skill_cards);
 assert.ok(registry.templates.skill_icons);
 assert.ok(registry.templates.skill_vfx);
 assert.ok(registry.templates.enemy_vfx);
 assert.ok(registry.templates.ui);
 assert.ok(registry.templates.bgm);
 assert.ok(registry.templates.skill_sfx);
 assert.ok(registry.templates.enemy_sfx);
 assert.ok(registry.templates.voice);
 assert.equal(registry.stage_ids.length,8);
 assert.equal(registry.aliases.length,151);
 assert.equal(inventory.totals.files,inventory.files.length);
 const paths=new Set();
 for(const item of registry.aliases){
  assert.equal(paths.has(item.canonical),false,'duplicate canonical target '+item.canonical);
  paths.add(item.canonical);
  assert.ok(!/(?:final2?|candidate|seed\d+|qwen|comfyui)/i.test(item.canonical));
  assert.match(item.sha256,/^[0-9a-f]{64}$/);
 }
});
test('ASSET-REGISTRY 151 份來源與正式檔雜湊相同，99 筆經審核路由作 live alias',()=>{
 const refs=Object.entries(routes.aliases);
 assert.equal(refs.length,99);
 for(const entry of registry.aliases){
  const original=path.join(ROOT,entry.source);
  const result=fs.readFileSync(path.join(ROOT,entry.canonical));
  if (new Set(['assets/img/vfx/raster/barrier_ground_45.webp', 'assets/audio/BGM.mp3',
    'assets/audio/BOSS.mp3', 'assets/audio/MAP.mp3']).has(entry.source) && !fs.existsSync(original)) {
    assert.equal(entry.route,true);
    assert.equal(inventory.retired.find(row=>row.path===entry.source)?.sha256,entry.sha256);
  } else assert.ok(fs.readFileSync(original).equals(result),entry.source+' -> '+entry.canonical);
  assert.equal(crypto.createHash('sha256').update(result).digest('hex'),entry.sha256);
  const input=entry.source+'?v=before';
  const actual=routes.resolve(input);
  assert.equal(actual,(entry.route?entry.canonical:entry.source)+'?v=before');
 }
 assert.equal(routes.resolve('assets/img/unknown.webp'), 'assets/img/unknown.webp');
});
test('ASSET-REGISTRY 新規範已與 runtime 載入器接線，未許可的素材原路徑不受影響',()=>{
 const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
 assert.ok(html.indexOf('js/asset-paths.js')<html.indexOf('js/assets.js'));
 const source=fs.readFileSync(path.join(ROOT,'js/assets.js'),'utf8');
 assert.ok(source.includes('window.ASSET_PATHS?.resolve(path)'));
 assert.ok(source.includes('window.ASSET_PATHS?.resolve(originalArtPath)'));
 assert.ok(source.includes('window.ASSET_PATHS?.resolve(hudPath)'));
 assert.ok(source.includes('window.ASSET_PATHS?.resolve(skillPath)'));
 assert.equal(routes.resolve('assets/img/yokai/ghost.webp'),'assets/img/enemies/ghost/ghost__sprite__idle.webp');
 assert.equal(routes.resolve('assets/img/vfx/raster/fire_attack_l5.webp'),'assets/img/vfx/skills/fire/fire__attack__lv05.webp');
 assert.equal(routes.resolve('assets/audio/BGM.mp3'),'assets/audio/bgm/stages/night-town/night-town__battle.mp3');
 assert.equal(routes.resolve('assets/img/scenery/ground.webp'),'assets/img/stages/night-town/tiles/night-town__ground.webp');
 assert.equal(routes.resolve('assets/audio/sfx/fire-lv5.mp3'),'assets/audio/sfx/skills/fire/fire__cast__lv05.mp3');
 assert.equal(routes.resolve('assets/img/ui/hud_skill_fan.webp'),'assets/img/ui/hud/ui__skill-fan.webp');
 assert.equal(routes.resolve('assets/img/rain-port/s2-production/g_stone_01.webp'),
   'assets/img/stages/rain-port/tiles/rain-port__g-stone-01.webp','approved Stage2 stones must use canonical paths');
 assert.equal(routes.resolve('assets/img/rain-port/s2-production/ground_mud_slab.webp'),
   'assets/img/rain-port/s2-production/ground_mud_slab.webp','non-selected legacy floor must not be promoted');
});
test('ASSET-REGISTRY 只允許已盤點影音，不可誤刪舊音檔或新增匿名候選到正式根目錄',()=>{
 const scan=scanRegistry();
 assert.ifError(scan.error);
 assert.equal(scan.status,0,(scan.stdout||'')+'\n'+(scan.stderr||''));
});
test('ASSET-REGISTRY Windows 啟動被拒會回退，但保留清冊驗證失敗',()=>{
 const calls=[];
 const invalid={status:1,stderr:'missing registered file'};
 const result=scanRegistry((command,args)=>{
  calls.push([command,...args]);
  return command==='python' ? {error:{code:'EACCES'}} : invalid;
 },'win32');
 assert.deepEqual(calls,[
  ['python','tools/asset_registry.py','--check'],
  ['py','-3','tools/asset_registry.py','--check']
 ]);
 assert.equal(result,invalid);
 const aliasCalls=[];
 const aliasResult=scanRegistry(command=>{
  aliasCalls.push(command);
  return command==='python' ? {status:9009,stderr:'Python was not found; run without arguments to install from the Microsoft Store'} : invalid;
 },'win32');
 assert.deepEqual(aliasCalls,['python','py']);
 assert.equal(aliasResult,invalid);
 assert.equal(scanRegistry(command=>{
  assert.equal(command,'python');
  return invalid;
 },'win32'),invalid);
});
