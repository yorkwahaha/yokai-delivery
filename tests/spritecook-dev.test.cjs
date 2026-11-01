const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("js/spritecook-dev.js", "utf8");
function boot(search, missing = null) {
  const requested = [];
  const counts = {idle:8,walk:8,run:10,attack:8};
  const win = {location:{search}};
  class Image {
    set src(value) {
      requested.push(value);
      const kind = Object.keys(counts).find(k=>value.endsWith({
        idle:"player_idle_v2_idle.png",
        walk:"player_walk_right_v2_upload_front_walk_walk.png",
        run:"player_walk_right_v2_upload_front_run_run.png",
        attack:"untitled_1792944881051_attack.png"
      }[k]));
      if (kind === missing) { this.onerror?.(); return; }
      this.naturalWidth = kind ? 640*counts[kind] : 640;
      this.naturalHeight = 640;
      this.onload?.();
    }
  }
  vm.runInNewContext(source,{window:win,Image,URLSearchParams});
  return {dev:win.SPRITECOOK_DEV,requested};
}

test("spritecook preview is disabled without both explicit dev flags",()=>{
  for(const query of ["","?spritecook=1","?dev=1","?dev=0&spritecook=1"]){
    const {dev,requested}=boot(query);
    assert.equal(dev.enabled,false);
    assert.equal(dev.frame("run",1),null);
    assert.equal(requested.length,0,"normal game must not request dev images");
  }
});

test("spritecook correct 8/10 frame atlases and attack restart timing",()=>{
  const {dev,requested}=boot("?dev=1&spritecook=1");
  assert.equal(dev.enabled,true);
  assert.equal(dev.status.walk,"ready");
  assert.equal(dev.frames.run.fps,14,"default run begins slower than the former fixed 16 FPS");
  assert.equal(dev.runFps(230),14);
  assert.ok(dev.runFps(265)>dev.runFps(230));
  assert.ok(dev.runFps(300)>dev.runFps(265));
  assert.equal(dev.frame("run",0,true,230).index,0);
  assert.equal(dev.frame("run",0.1,true,230).index,1);
  assert.equal(dev.frame("run",0.2,true,265).index,3,
    "speed upgrade changes stride cadence without phase discontinuity");
  assert.equal(dev.frame("run",0.3,true,335).index,5);
  assert.equal(dev.frame("run",0.4,true,230).footPad,22,
    "all run frames use one fixed image anchor, even when feet lift");
  assert.equal(dev.frame("idle",0.125).index,1);
  assert.equal(dev.frame("walk",0.5).index,4);
  assert.equal(dev.frame("idle",0.125).footPad,0);
  assert.equal(dev.frame("walk",0.5).footPad,16);
  assert.equal(dev.frame("run",1,true,230).index,0,"resuming movement begins at frame zero");
  assert.equal(dev.frame("attack",2).index,0);
  assert.ok(dev.frame("attack",2.1).index>=4);
  assert.equal(dev.frame("attack",2.3).index,7);
  dev.frame("run",3);
  assert.equal(dev.frame("attack",3.5).index,0,"new attack restarts at frame zero");
  assert.equal(requested.length,5,"four sheet files plus painted katana VFX");
});

test("run cadence stays continuous at upgrade levels and is capped",()=>{
  const {dev}=boot("?dev=1&spritecook=1");
  assert.ok(Math.abs(dev.runFps(265)-16.130434782608695)<1e-9);
  assert.ok(Math.abs(dev.runFps(300)-18.26086956521739)<1e-9);
  assert.ok(Math.abs(dev.runFps(335)-20.391304347826086)<1e-9);
  assert.equal(dev.runFps(999),25);
  assert.equal(dev.frame("run",0,false,230).index,0);
  assert.equal(dev.frame("run",0.1,true,230).index,0);
  assert.equal(dev.frame("run",0.2,true,230).index,1);
  assert.equal(dev.frame("run",0.3,true,300).index,3);
});

test("run maintains a constant feet anchor on frames with airborne limbs",()=>{
  const {dev}=boot("?dev=1&spritecook=1");
  dev.frame("run",0,true,230);
  const observed=[];
  for(let i=1;i<=12;i++){
    const f=dev.frame("run",i/14,true,230);
    observed.push({index:f.index,pad:f.footPad});
  }
  assert.ok(observed.some(f=>f.index===4), "cover high-foot frame five");
  assert.ok(observed.some(f=>f.index===9), "cover high-foot frame ten");
  assert.ok(observed.every(f=>f.pad===22),
    "the bitmap must not jump on either airborne frame");
});

test("missing SpriteCook art falls back without blanking regular player",()=>{
  const {dev}=boot("?dev=1&spritecook=1","attack");
  assert.equal(dev.status.attack,"missing; original art preserved");
  assert.equal(dev.frame("attack",1),null);
  assert.ok(dev.frame("run",1));
});

test("secondary attack image is a short close sword trail, not another projectile",()=>{
  const {dev}=boot("?dev=1&spritecook=1");
  const draws=[];
  const ctx={globalAlpha:1,save(){},restore(){},drawImage(...args){draws.push({args,alpha:this.globalAlpha});}};
  for (const index of [0,3,4,5,6,7]) dev.drawSlash(ctx,index);
  assert.equal(draws.length,3,"only critical attack frames show a secondary brush stroke");
  for(const {args,alpha} of draws){
    const [image,x,y,width,height]=args;
    assert.ok(image.naturalWidth>0);
    assert.ok(x>=0 && x+width<=68,"secondary effect stays close to the blade, not the enemy");
    assert.ok(y<0 && y+height<0,"trail stays above the character's feet");
    assert.ok(width<=60 && height<=34,"trail is smaller than the original extra slash");
    assert.ok(alpha<=0.55,"trail should not compete with the primary skill VFX");
  }
});
