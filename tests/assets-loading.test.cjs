const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function loadAssets() {
  const images = [], tracks = [];
  class Image { constructor() { images.push(this); } }
  class Audio {
    constructor(src) { this.src = src; tracks.push(this); }
    addEventListener() {}
  }
  const env = { Image, Audio, console };
  env.window = env;
  vm.runInNewContext(fs.readFileSync('js/assets.js', 'utf8'), env);
  return { env, images, tracks };
}

test('core readiness excludes optional animation and result portraits, and keeps later downloads in background',()=>{
  const {env,images}=loadAssets();env.loadGameArt();
  assert.ok(!images.some(i=>/motion_v1|player_win_v1|player_kneel_v1/.test(i.src)));
  for(const image of [...images]) image.onload();
  assert.equal(env.ART_READY,true,'all actual scene art and HUD are ready');
  const optional=images.find(i=>/player_walk1/.test(i.src));assert.ok(optional);
  assert.equal(optional.fetchPriority,'low');
  assert.equal(env.ART_PROGRESS.settled,env.ART_PROGRESS.total,'optional download does not keep loading overlay');
  assert.ok(env.ART.ghost&&env.ART.boss&&env.ART.ground&&env.ART.hud_skill_fan);
  const count=images.length;env.loadGameArt();assert.equal(images.length,count,'pending background download is not duplicated');
  optional.onerror();assert.equal(images.length,count,'fallback finishes before next background image');
  optional.onerror();assert.equal(env.ART_READY,true);assert.equal(images.length,count+1);
  assert.equal(env.ART_PROGRESS.failed,0,'background failure does not affect scene readiness');
});

test('map readiness warms the upcoming core game without changing the visible map progress',()=>{
  const {env,images}=loadAssets();env.loadMapArt();const map=[...images];
  assert.equal(map.length,7);map.forEach(i=>i.onload());
  assert.equal(env.MAP_ART_READY,true);
  assert.ok(images.some(i=>i.src.includes('/ui/hud_skill_fan')),'core is warmed while choosing a route');
  assert.equal(env.ART_PROGRESS.total,7);assert.equal(env.ART_PROGRESS.settled,7);
  assert.ok(!images.some(i=>/motion_v1|player_win_v1/.test(i.src)));
  for(const image of images.filter(i=>!map.includes(i))) image.onload();
  const count=images.length;env.loadGameArt();assert.equal(env.ART_READY,true);
  assert.ok(images.length<=count+1,'only one optional image may start after already-warm game entry');
});

test('cover completion begins route preparation before the user clicks start',()=>{
  const {env,images}=loadAssets();assert.equal(images.length,1);images[0].onload();
  assert.ok(images.some(i=>i.src.includes('overworld_night_v2')));
  assert.equal(env.MAP_ART_READY,false);
});

test('blocking scene images have high fetch priority instead of competing below music',()=>{
  const {env,images}=loadAssets();env.loadMapArt();env.loadGameArt();
  for(const image of images.filter(i=>!i.src.includes('/vfx/'))) assert.equal(image.fetchPriority,'high',image.src);
});

test('map loads only its own art, then game reuses those requests and includes HUD readiness',()=>{
  const {env,images}=loadAssets();env.loadMapArt();
  assert.equal(images.length,7);
  assert.ok(!images.some(i=>/hud_|boss_motion|tank_motion|ground_dirt/.test(i.src)));
  images.forEach(i=>i.onload());assert.equal(env.MAP_ART_READY,true);
  assert.equal(env.ART_READY,false);
  env.loadGameArt();
  assert.equal(images.filter(i=>i.src.includes('overworld_night_v2.webp')).length,1);
  const hud=images.find(i=>i.src.includes('hud_skill_fan.webp'));
  images.filter(i=>i!==hud).forEach(i=>i.onload());
  assert.equal(env.ART_READY,false,'pending HUD must keep game in loading');
  hud.onload();assert.equal(env.ART_READY,true);
});

test('HUD uses small WebP distribution files and preserves PNG error fallbacks',()=>{
  const {env,images}=loadAssets();env.loadGameArt();
  const hud=images.filter(i=>i.src.includes('/ui/hud_'));
  assert.equal(hud.length,4);
  for(const image of hud){
    const file=image.src.split('?')[0];assert.ok(file.endsWith('.webp'));
    assert.ok(fs.statSync(file).size<150000,file);
    image.onerror();assert.ok(image.src.endsWith('.png'));
  }
});

test('title prioritizes only the cover and leaves music downloads until playback', () => {
  const { env, images, tracks } = loadAssets();
  assert.equal(images.length, 1);
  assert.equal(images[0].src, 'assets/img/cover.webp?v=20261010-character-set1');
  assert.equal(images[0].fetchPriority, 'high');
  assert.ok(tracks.every(track => track.preload === 'none'));
  images[0].onload();
  assert.equal(env.ART.cover, images[0]);
  env.loadGameArt();
  assert.equal(images.filter(image => !image.src.includes('/vfx/')).length, 23);
  assert.ok(!images.some(image => image.src.includes('/vfx/raster/katana.webp')));
  env.loadGameArt();
  assert.equal(images.filter(image => !image.src.includes('/vfx/')).length, 23);
  for (const image of images) image.onload();
  assert.equal(images.filter(image => !image.src.includes('/vfx/')).length, 34);
  assert.equal(images.filter(image => image.src.includes('/vfx/raster/katana.webp')).length, 1);
  assert.equal(env.ART_READY, true);
  assert.ok(env.ART.hud_lantern_oil);
  assert.ok(env.ART.hud_radar_frame);
  assert.ok(env.ART.hud_omamori_hint_listen);
  assert.ok(env.ART.hud_skill_fan);
  assert.ok(env.ART.katana_wave_ukiyoe);
  assert.ok(env.ART.ground_dirt);
  assert.ok(env.ART.ground);
});

test('entering a game preloads Lv1 katana art before the first attack',()=>{
  const {env,images}=loadAssets();
  assert.equal(images.filter(i=>i.src?.includes('/katana_l1.webp')).length,0);
  env.loadGameArt();
  const requests=images.filter(i=>i.src?.includes('/katana_l1.webp'));
  assert.equal(requests.length,1);
  assert.equal(requests[0].fetchPriority,'high');
  assert.equal(env.skillVfxArt('katana',1),null);
  assert.equal(images.filter(i=>i.src?.includes('/katana_l1.webp')).length,1);
  requests[0].naturalWidth=512;requests[0].naturalHeight=512;requests[0].onload();
  assert.equal(env.skillVfxArt('katana',1),requests[0]);
  env.loadGameArt();
  assert.equal(images.filter(i=>i.src?.includes('/katana_l1.webp')).length,1);
});

test('resting courier art is fetched only after pause is opened', () => {
  const { env, images } = loadAssets();
  assert.equal(images.length, 1,'resting art does not block cover download');
  env.loadPauseRestArt();
  assert.equal(images.length, 2);
  assert.match(images[1].src,/player_rest_v1\.webp\?v=20261010-character-set1$/);
  env.loadPauseRestArt();
  assert.equal(images.length, 2,'repeat pause reuses asset');
  images[1].onload();
  assert.equal(env.ART.player_rest_v1,images[1]);
});

test('WebP failures retry preserved originals once and settle even when both are absent', () => {
  const { env, images } = loadAssets();
  images[0].onerror();
  assert.equal(images[0].src, 'assets/img/cover.jpg');
  images[0].onload();
  env.loadGameArt();
  for (const image of images) {
    if (image === images[0]) continue;
    image.onerror();
    if (image.src.includes('/vfx/')) {
      assert.ok(image.src.split('?')[0].endsWith(/\/vfx\/raster\/(?:dragon_|katana_l1)/.test(image.src) ? '.webp' : '.svg'));
    } else {
      assert.ok(image.src.split('?')[0].endsWith('.png'));
      image.onload();
    }
  }
  assert.equal(env.ART_READY, true);
  const failed = loadAssets();
  failed.env.console = { warn() {} };
  failed.env.loadGameArt();
  for (const image of failed.images) { image.onerror(); image.onerror(); }
  assert.equal(failed.env.ART_READY, true);
  assert.deepEqual(Object.keys(failed.env.ART), []);
});

test('asset progress counts settled images including failures, without counting retry as completion',()=>{
  const {env,images}=loadAssets();env.console={warn(){}};
  assert.deepEqual({...env.ART_PROGRESS},{settled:0,total:1,failed:0});
  images[0].onerror();assert.equal(env.ART_PROGRESS.settled,0);
  images[0].onerror();assert.deepEqual({...env.ART_PROGRESS},{settled:1,total:1,failed:1});
  env.loadGameArt();assert.equal(env.ART_PROGRESS.total,20);
  images.slice(1).forEach(image=>image.onload());
  assert.deepEqual({...env.ART_PROGRESS},{settled:20,total:20,failed:1});assert.equal(env.ART_READY,true);
});

test('five-rank skill art exposes all 30 fixed filenames and loads each slot lazily',()=>{
  const {env,images}=loadAssets();
  const ids=['katana','barrier','needle','boom','fire','thunder'];
  assert.equal(ids.flatMap(id=>env.SKILL_LEVEL_FILES[id]).length,30);
  assert.deepEqual(ids.map(id=>env.SKILL_LEVEL_FILES[id][4]),ids.map(id=>id+'_l5'));
  const before=images.length;
  assert.equal(env.skillVfxArt('katana',4),null);
  assert.equal(images.length,before+1);
  const img=images.at(-1);
  assert.ok(img.src.includes('/vfx/raster/katana_l4.webp'));
  assert.equal(env.skillVfxArt('katana',4),null);
  assert.equal(images.length,before+1);
  img.naturalWidth=256;img.naturalHeight=256;img.onload();
  assert.equal(env.skillVfxArt('katana',4),img);
});

test('foxfire exposes separate orbit, attack and Lv5 dragon asset slots',()=>{
  const {env,images}=loadAssets(),before=images.length;
  assert.deepEqual(Array.from(env.SKILL_VARIANT_FILES.fire.orbit),['fire_orbit_l1','fire_orbit_l2','fire_orbit_l3','fire_orbit_l4','fire_orbit_l5']);
  assert.deepEqual(Array.from(env.SKILL_VARIANT_FILES.fire.attack),['fire_attack_l1','fire_attack_l2','fire_attack_l3','fire_attack_l4','fire_attack_l5']);
  assert.equal(env.SKILL_VARIANT_FILES.fire.dragon[4],'fire_dragon_l5');
  assert.equal(env.skillVfxVariantArt('fire','orbit',4),null);
  assert.equal(images.length,before+1);assert.ok(images.at(-1).src.includes('/vfx/raster/fire_orbit_l4.webp'));
});

test('new movement, posture and landmark images ship both WebP and PNG fallback files',()=>{
  const {env,images}=loadAssets();env.loadGameArt();
  for(const image of images) image.onload();
  const extra=images.filter(i=>/_v[12]/.test(i.src));assert.equal(extra.length,12);
  for(const i of extra){assert.ok(fs.existsSync(i.src.split('?')[0]),i.src);i.onerror();assert.ok(fs.existsSync(i.src.split('?')[0]),i.src);i.onload();}
  assert.ok(env.ART.player_kneel_v1);assert.ok(env.ART.boss_motion_v1);assert.ok(env.ART.map_rain_port_v1);
});

test('all six woodblock yokai and their motion atlases load with original fallback',()=>{
  const {env,images}=loadAssets();env.loadGameArt();
  for(const image of images) image.onload();
  for(const kind of ['ghost','runner','tank','shooter','mis','boss']){
    for(const name of [kind,kind+'_motion_v1']){
      const path='assets/img/yokai/'+name+'.webp';
      const image=images.find(img=>img.src.split('?')[0]===path);
      assert.ok(image,name+' must load from the ink collection');
      const bytes=fs.readFileSync(path);
      assert.equal(bytes.toString('ascii',0,4),'RIFF');
      assert.equal(bytes.toString('ascii',8,12),'WEBP');
      image.onerror();
      assert.equal(image.src,'assets/img/'+name+'.png');
    }
  }
});

test('new dragon fireball and scorched-ground sprites load from optimized WebP assets',()=>{
  const {env,images}=loadAssets();
  env.loadGameArt();
  for(const image of images) image.onload();
  for(const name of ['dragon_fireball_l5','dragon_burning_ground_l5']){
    const path='assets/img/vfx/raster/'+name+'.webp';
    assert.equal(images.filter(img=>img.src===path+'?v=20261009-dragon1').length,1,name);
    const file=fs.readFileSync(path);
    assert.equal(file.toString('ascii',0,4),'RIFF');
    assert.equal(file.toString('ascii',8,12),'WEBP');
    assert.ok(file.length<400000,name);
  }
});
