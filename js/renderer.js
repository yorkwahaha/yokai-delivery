// 渲染引擎：商業級和風手繪管線、石疊地坪紋理、町屋店鋪建築、動態 2D 多光源與 Game Juice
// 舊版 Canvas 備援：本專案僅使用數字半徑，不覆寫原生 roundRect。
if (typeof CanvasRenderingContext2D !== "undefined" && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, radii = 0) {
    const r = Array.isArray(radii) ? radii : [radii];
    if (!r.length || r.length > 4 || r.some(n => n < 0)) throw new RangeError("Invalid corner radii");
    if (![x,y,w,h,...r].every(Number.isFinite)) return;
    let [tl,tr,br,bl] = [r[0],r[1] ?? r[0],r[2] ?? r[0],r[3] ?? r[1] ?? r[0]];
    if (w < 0) { x += w; w = -w; [tl,tr,br,bl] = [tr,tl,bl,br]; }
    if (h < 0) { y += h; h = -h; [tl,tr,br,bl] = [bl,br,tr,tl]; }
    const scale = Math.min(1,w/(tl+tr || 1),w/(bl+br || 1),h/(tl+bl || 1),h/(tr+br || 1));
    tl *= scale; tr *= scale; br *= scale; bl *= scale;
    this.moveTo(x+tl,y);
    this.arcTo(x+w,y,x+w,y+h,tr);
    this.arcTo(x+w,y+h,x,y+h,br);
    this.arcTo(x,y+h,x,y,bl);
    this.arcTo(x,y,x+w,y,tl);
    this.closePath();
  };
}
window.RENDERER = (() => {
  const W = 900, H = 600;
  // Avoid upscaling a 720p internal canvas on modern desktop displays.
  const SCENE_PIXELS_DESKTOP = 2073600, SCENE_PIXELS_MOBILE = 1280000, LIGHT_PIXELS = 280000;
  const HOUSE_NAMES = { house_shop: "夜行商店", house_tavern: "宵待酒屋", house_shrine: "稻荷社" };

  // 取得當前關卡的怪物/Boss sprite key（從 STAGE_ASSET_SLOTS 解析，缺圖回落通用）
  function getStageSpriteKey(e, spriteType) {
    // 雨港專用敵人由 PORT_ENEMIES 處理
    if (window.STAGE?.id === "rain-port" && (e.type === "shiome" || e.umibozu)) {
      return null;
    }
    const slots = window.STAGE_ASSET_SLOTS?.[window.STAGE?.id];
    if (!slots?.enemy) return null;
    const enemyType = e.type === "boss" ? "boss" : e.type;
    const arts = slots.enemy[enemyType];
    if (!arts) return null;
    const key = arts[spriteType]; // "idle" 或 "attack"
    if (!key) return null;
    // 檢查 ART 中是否有該圖，否則回落通用
    const img = window.ART[key];
    if (img?.naturalWidth) return key;
    // 回落通用 key
    const fallbackMap = {
      ghost: "ghost", runner: "runner", tank: "tank", shooter: "shooter",
      mis: "mis", boss: "boss", shiome: "ghost"
    };
    return fallbackMap[enemyType] || "ghost";
  }
  // Alpha 邊界只在素材製作時讀取；[sx,sy,w,h,腳底水平錨點]，不在每幀掃描像素。
  const FRAME_BOUNDS = {
    player:[[6,4,197,340,103.5]],player_walk1:[[3,4,197,340,103.5]],player_walk2:[[2,4,199,340,103.5]],
    ghost:[[8,11,133,189,74.5]],runner:[[10,11,207,136,113.5]],boss:[[10,10,232,310,126.5]],
    mis:[[10,9,171,311,95.5]],tank:[[11,11,259,307,140]],shooter:[[9,11,182,178,99.5]],
    player_dash_v1:[[101,22,1412,963,768]],player_win_v1:[[111,32,910,1462,512]],player_kneel_v1:[[159,87,953,1161,612]],
    ghost_motion_v1:[[247,50,550,742,443.5],[1032,148,690,660,1330.5]],
    runner_motion_v1:[[26,198,820,492,443.5],[904,239,848,442,1330.5]],
    boss_motion_v1:[[16,42,871,778,443.5],[887,36,882,781,1330.5]],
    mis_motion_v1:[[240,13,526,850,443.5],[1045,35,604,828,1330.5]],
    tank_motion_v1:[[28,30,859,809,443.5],[887,103,863,735,1330.5]],
    shooter_motion_v1:[[161,140,515,627,443.5],[1042,152,625,623,1330.5]],
    map_night_town_v1:[[49,46,823,784,443.5],[924,47,820,787,1330.5]],
    map_rain_port_v1:[[30,17,817,834,443.5],[917,16,815,835,1330.5]]
  };
  // 裁切座標以原稿為基準，發佈版 atlas 可縮圖，PNG 備援仍使用原尺寸。
  const FRAME_SOURCE_SIZE = {
    player_dash_v1:[1536,1024],
    ...Object.fromEntries(['ghost','runner','boss','mis','tank','shooter'].map(k=>[k+'_motion_v1',[1774,887]])),
    map_night_town_v1:[1774,887],map_rain_port_v1:[1774,887]
  };
  function drawFrame(c, image, key, index, x, y, height) {
    const frames = FRAME_BOUNDS[key] || [[0,0,image.naturalWidth,image.naturalHeight,image.naturalWidth/2]];
    const r = frames[index] || frames[0], scale = height / frames[0][3];
    const source = FRAME_SOURCE_SIZE[key], rx = source ? image.naturalWidth/source[0] : 1, ry = source ? image.naturalHeight/source[1] : 1;
    const box = {sx:r[0]*rx,sy:r[1]*ry,sw:r[2]*rx,sh:r[3]*ry,dx:x+(r[0]-r[4])*scale,dy:y-r[3]*scale,dw:r[2]*scale,dh:r[3]*scale};
    c.drawImage(image,box.sx,box.sy,box.sw,box.sh,box.dx,box.dy,box.dw,box.dh);
    return box;
  }
  let cv, ctx, dpr;
  let lightCv, lightCtx;
  const groundAtlases = new WeakMap();
  const SCENE_TILE = 512;
  // 手繪石徑不是 seamless：四個裁切共用相同的週期邊緣，避免直線、十字接縫。
  // 一張 1024 WebP 在首次出現時才建構一次 2x2 atlas，之後只做快取 canvas drawImage。
  function groundAtlasFor(image) {
    if (!image || image.naturalWidth !== 1024 || image.naturalHeight !== 1024) return null;
    if (groundAtlases.has(image)) return groundAtlases.get(image);
    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = sourceCanvas.height = 1024;
    const sourceCtx = sourceCanvas.getContext("2d", {willReadFrequently:true});
    if (!sourceCtx?.getImageData || !sourceCtx?.drawImage) return null;
    sourceCtx.drawImage(image,0,0,1024,1024);
    const src = sourceCtx.getImageData(0,0,1024,1024).data;
    const base = new Uint8ClampedArray(SCENE_TILE*SCENE_TILE*4);
    for (let y=0;y<SCENE_TILE;y++) for (let x=0;x<SCENE_TILE;x++) {
      const from=((y+256)*1024+x+256)*4,to=(y*SCENE_TILE+x)*4;
      for(let c=0;c<4;c++)base[to+c]=src[from+c];
    }
    // 加寬共同週期邊緣的漸變；降低突然中斷的墨線與矩形接縫感。
    const GROUND_FEATHER = 120;
    const blendEnds=(a,b,t)=>{
      for(let c=0;c<3;c++){
        const va=base[a+c],vb=base[b+c],mean=(va+vb)/2;
        base[a+c]=va*(1-t)+mean*t;base[b+c]=vb*(1-t)+mean*t;
      }
    };
    for(let y=0;y<SCENE_TILE;y++)for(let x=0;x<GROUND_FEATHER;x++)
      blendEnds((y*SCENE_TILE+x)*4,(y*SCENE_TILE+511-x)*4,1-x/GROUND_FEATHER);
    for(let x=0;x<SCENE_TILE;x++)for(let y=0;y<GROUND_FEATHER;y++)
      blendEnds((y*SCENE_TILE+x)*4,((511-y)*SCENE_TILE+x)*4,1-y/GROUND_FEATHER);
    const atlas=document.createElement("canvas");
    atlas.width=atlas.height=1024;
    const atlasCtx=atlas.getContext("2d");
    if (!atlasCtx?.createImageData || !atlasCtx?.putImageData) return null;
    const result=atlasCtx.createImageData(1024,1024), out=result.data;
    for(let tile=0;tile<4;tile++) {
      const sx=(tile&1)*512,sy=(tile>>1)*512;
      for(let y=0;y<512;y++)for(let x=0;x<512;x++) {
        const si=((sy+y)*1024+sx+x)*4,bi=(y*512+x)*4;
        const oi=(((tile>>1)*512+y)*1024+(tile&1)*512+x)*4;
        let mix=Math.min(1,Math.min(x,511-x,y,511-y)/128);
        mix=mix*mix*(3-2*mix);
        for(let c=0;c<3;c++)out[oi+c]=base[bi+c]*(1-mix)+src[si+c]*mix;
        out[oi+3]=255;
      }
    }
    atlasCtx.putImageData(result,0,0);
    groundAtlases.set(image,atlas);
    return atlas;
  }
  function groundTileIndex(x,y) {
    let h=Math.imul(x,374761393)^Math.imul(y,668265263);
    h=Math.imul(h^(h>>>13),1274126177);
    return ((h^(h>>>16))>>>0)%4;
  }
  let terrainCv = null, terrainState = null;
  const hitSilhouettes = new WeakMap();

  // 鏡頭與打擊震動
  let camX = 0, camY = 0;
  let prevCamX = 0, prevCamY = 0;
  let shake = 0;
  let hitStop = 0;

  // 環境粒子：櫻花瓣、夜行幽火、落葉
  const SAKURA = [];
  const FIREFLIES = [];
  let dmgNumbers = [];
  let slashArcs = [];
  let ghostTrails = [];

  function bounds() { return window.VIEWPORT?.bounds() || { left:0, top:0, right:W, bottom:H, width:W, height:H }; }
  function tiltK() { return window.VIEWPORT?.tiltScale?.() || 1; }
  let depthStageId = "";
  let groundCacheBuilds = 0;
  function depthMode() { return window.VIEWPORT?.depthMode?.() || "default"; }
  function sakuraDepthOn() {
    if (depthStageId !== "sakura-pass") return false;
    if ((tiltK() || 1) > 0.97) return false;
    return depthMode() !== "off";
  }
  function smooth01(t) {
    const x = clamp(t, 0, 1);
    return x * x * (3 - 2 * x);
  }
  // 2D 與非山道維持舊景深。山道 2.5D 預設就分近／中／遠；?depth= 只在 loopback 覆蓋。
  function sceneryDepth(worldY, viewerY) {
    const tilt = tiltK() || 1;
    if (viewerY == null || tilt > 0.97) return { scale: 1, blur: 0, grade: 0 };
    const distance = Math.max(0, viewerY - worldY);
    const legacy = () => {
      const focus = clamp((distance - 290) / 650, 0, 1) * clamp((1 - tilt) / 0.4, 0, 1);
      return { scale: 1, blur: focus * 2.25, grade: focus };
    };
    if (!sakuraDepthOn()) return legacy();
    const mode = depthMode();
    const reach = mode === "enhanced" ? 440 : 520;
    const t = smooth01(distance / reach) * clamp((1 - tilt) / 0.4, 0, 1);
    const blurMax = mode === "enhanced" ? 3.2 : 2.6;
    return { scale: 1, blur: t * t * blurMax, grade: t };
  }
  function worldBounds() { return window.VIEWPORT?.worldBounds?.() || bounds(); }
  function allowsMotion() {
    return motionAllowed;
  }
  const motionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  let motionAllowed = !motionQuery?.matches;
  const motionChanged = e => { motionAllowed = !e.matches; };
  if(motionQuery?.addEventListener)motionQuery.addEventListener('change',motionChanged);
  else motionQuery?.addListener?.(motionChanged);
  function resize() {
    const v = window.VIEWPORT?.get() || {width:W,height:H,offsetX:0,offsetY:0};
    const scale = v.scale || 1;
    const cssPixels = v.width * v.height * scale * scale;
    const budget = Math.min(window.innerWidth, window.innerHeight) < 600 ? SCENE_PIXELS_MOBILE : SCENE_PIXELS_DESKTOP;
    // Higher quality on desktops; bounded mobile backing store protects FPS.
    dpr = Math.min(window.devicePixelRatio || 1, 2, Math.max(0.45, Math.sqrt(budget / Math.max(1, cssPixels))));
    cv.width = Math.round(v.width * scale * dpr); cv.height = Math.round(v.height * scale * dpr);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "medium";
    // 柔和遮罩以較低解析度繪製；合成時仍覆蓋相同的完整視口。
    const lightScale = scale * Math.min(1, Math.sqrt(LIGHT_PIXELS / cssPixels));
    lightCv.width = Math.round(v.width * lightScale); lightCv.height = Math.round(v.height * lightScale);
    lightCtx.setTransform(lightScale, 0, 0, lightScale, v.offsetX * lightScale, v.offsetY * lightScale);
  }

  function init(canvas) {
    cv = canvas;
    ctx = cv.getContext("2d", { alpha: false });
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = W * dpr;
    cv.height = H * dpr;

    lightCv = document.createElement("canvas");
    lightCv.width = W;
    lightCv.height = H;
    lightCtx = lightCv.getContext("2d");
    resize();
    const area = bounds();

    // 初始化飄落櫻花雨 (50 片)；分層次景深 (遠景 0.65x、中景 1.0x、前景 1.45x)
    for (let i = 0; i < 50; i++) {
      const depth = i < 14 ? 0.65 : i < 38 ? 1.0 : 1.45;
      const baseSize = 5 + Math.random() * 6;
      SAKURA.push({
        x: area.left + Math.random() * area.width,
        y: area.top + Math.random() * area.height,
        vx: (35 + Math.random() * 45) * (depth === 1.45 ? 1.25 : depth === 0.65 ? 0.8 : 1.0),
        vy: (25 + Math.random() * 35) * (depth === 1.45 ? 1.25 : depth === 0.65 ? 0.8 : 1.0),
        size: baseSize * (depth === 1.45 ? 1.75 : depth === 0.65 ? 0.75 : 1.0),
        rot: Math.random() * 6.28,
        vRot: (Math.random() - 0.5) * 3,
        alpha: (0.55 + Math.random() * 0.4) * (depth === 1.45 ? 0.85 : depth === 0.65 ? 0.45 : 1.0),
        depth
      });
    }

    // 初始化夜行螢火蟲 / 靈氣游光 (30 隻)
    for (let i = 0; i < 30; i++) {
      FIREFLIES.push({
        x: area.left + Math.random() * area.width,
        y: area.top + Math.random() * area.height,
        phase: Math.random() * 6.28,
        speed: 10 + Math.random() * 15
      });
    }
  }


  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  function triggerHitStop(duration = 0.04) {
    if (allowsMotion()) hitStop = duration;
  }

  function triggerShake(intensity = 8) {
    if (allowsMotion()) shake = Math.max(shake, intensity);
  }

  function clearShake() {
    shake = 0;
    hitStop = 0;
  }

  function spawnDamageNumber(val, x, y, isCrit = false, color = null) {
    dmgNumbers.push({
      val: typeof val === 'number' ? Math.round(val * 10) / 10 : String(val),
      x: x + (Math.random() - 0.5) * 22,
      y: y - 12,
      vy: -120 - Math.random() * 50,
      vx: (Math.random() - 0.5) * 45,
      life: 0.75,
      maxLife: 0.75,
      scale: isCrit ? 1.5 : 1.0,
      isCrit,
      color: color || (isCrit ? "#ffd152" : "#ffffff")
    });
  }

  function addGhostTrail(img, x, y, flipX, scale, alpha = 0.4, key = "player", height = 114) {
    ghostTrails.push({ img, x, y, flipX, scale, key, height, life: 0.22, maxLife: 0.22, alpha });
  }

  // tier 1–3 對應妖刀斬 Lv1–2／Lv3–4／Lv5：刀芒厚度、亮度與火星數量逐級加強。
  function addSlashArc(x, y, radius, angle, spread = 2.2, tier = 3) {
    slashArcs.push({ x, y, radius, angle, spread, tier, life: 0.2, maxLife: 0.2 });
  }

  function updateEffects(dt) {
    const stopped = allowsMotion() && hitStop > 0;
    hitStop = Math.max(0, hitStop - dt);

    shake = Math.max(0, shake - 32 * dt);

    const area = bounds();
    const camDx = camX - prevCamX, camDy = camY - prevCamY;
    prevCamX = camX; prevCamY = camY;

    for (const p of SAKURA) {
      if (allowsMotion()) {
        const depthGain = sakuraDepthOn() ? (depthMode() === "enhanced" ? 2.2 : 1.75) : 1;
        p.x += p.vx * dt - camDx * ((p.depth || 1) - 1) * depthGain;
        p.y += p.vy * dt - camDy * ((p.depth || 1) - 1) * depthGain;
        p.rot += p.vRot * dt;
      }
      if (p.x > area.right + 40) p.x = area.left - 40;
      else if (p.x < area.left - 40) p.x = area.right + 40;
      if (p.y > area.bottom + 40) p.y = area.top - 40;
      else if (p.y < area.top - 40) p.y = area.bottom + 40;
    }

    for (const d of dmgNumbers) {
      const k = tiltK() || 1;
      d.x += d.vx * dt;
      d.y += d.vy / k * dt;
      d.vy += 220 * dt;
      d.life -= dt;
    }
    dmgNumbers = dmgNumbers.filter(d => d.life > 0);

    for (const g of ghostTrails) g.life -= dt;
    ghostTrails = ghostTrails.filter(g => g.life > 0);

    for (const s of slashArcs) s.life -= dt;
    slashArcs = slashArcs.filter(s => s.life > 0);

    return stopped;
  }

  function drawStyledSceneryImage(c,image,x,y,w,h,alpha=1,kind="scenery",depthBlur=0) {
    if(!image || !image.naturalWidth)return false;
    c.save();
    c.globalAlpha *= alpha;
    c.filter = kind === "sakura" ? "saturate(78%) contrast(101%) brightness(92%)" :
      kind === "house_tavern" || kind === "house_shrine" ? "saturate(86%) contrast(101%) sepia(2%) brightness(91%)" :
      "saturate(88%) contrast(102%) sepia(2%) brightness(94%)";
    // Only distant architectural sprites receive gentle atmospheric DOF.
    // Ground silhouettes, house nameplates, quiz labels and HUD stay crisp.
    if (depthBlur > 0.05) {
      // Soft woodblock atmosphere: depth = blur + cool color + lower contrast.
      // This filter is applied ONLY to the sprite, not its readable signboard.
      const depth = Math.min(1, depthBlur / 2.25);
      c.filter += ` saturate(${Math.round(100-depth*27)}%) contrast(${Math.round(100-depth*17)}%) brightness(${Math.round(100+depth*7)}%) blur(${depthBlur.toFixed(2)}px)`;
    }
    c.shadowColor = "rgba(18, 15, 18, 0.28)";
    c.shadowBlur = 0;
    c.shadowOffsetX = 1;
    c.shadowOffsetY = 1;
    c.drawImage(image,x,y,w,h);
    c.restore();
    return true;
  }

  function drawScenerySprite(image,x,y,w,h,alpha=1) {
    return drawStyledSceneryImage(ctx,image,x,y,w,h,alpha);
  }

  // Scenery uses one continuous actor path at EVERY angle (including 2D).
  // Contact shadows are painted on the floor before the upright sprites.
  function drawDecorActor(actor, viewerY = null) {
    const chunk = actor.torii, tree = actor.tree;
    const atmosphericDepth = y => viewerY == null ? 0 :
      clamp((viewerY-y-290)/650,0,1)*clamp((1-tiltK())/0.4,0,1)*1.65;
    if (chunk) {
      const img=window.ART?.prop_torii;
      if (!img?.naturalWidth) return;
      const cx=chunk.x+chunk.w/2,cy=chunk.y+chunk.h/2,tw=150;
      const th=tw*img.naturalHeight/img.naturalWidth;
      // Gate feet touch at cx±50, cy+36: use restrained contact shadows,
      // not the old huge 90×24 oval (which looked detached in overhead view).
      ctx.save();
      ctx.fillStyle="rgba(16,14,17,0.28)";
      for(const dx of [-50,50]){
        ctx.beginPath();ctx.ellipse(cx+dx,cy+38,23,8,0,0,6.28);ctx.fill();
      }
      ctx.restore();
      window.VIEWPORT.upright(ctx,cx,cy+36,()=>{
        drawStyledSceneryImage(ctx,img,cx-tw/2,cy-th+36,tw,th,1,"torii",
          atmosphericDepth(cy));
      });
    } else if (tree) {
      const img=window.ART?.prop_sakura;
      if (!img?.naturalWidth) return;
      const factor=[.92,1,1.08][groundTileIndex(Math.floor(tree.x),Math.floor(tree.y))%3];
      const sw=114*factor,sh=sw*img.naturalHeight/img.naturalWidth;
      ctx.save();ctx.fillStyle="rgba(0,0,0,0.28)";
      ctx.beginPath();ctx.ellipse(tree.x,tree.y-4,28,10,0,0,6.28);ctx.fill();
      ctx.restore();
      window.VIEWPORT.upright(ctx,tree.x,tree.y,()=>{
        drawStyledSceneryImage(ctx,img,tree.x-sw/2,tree.y-sh,sw,sh,.89,"sakura",
          atmosphericDepth(tree.y));
      });
    } else if (actor.ancient) {
      const img = window.SAKURA_ART?.ancientSakura;
      const tree = actor.ancient;
      if (!img?.naturalWidth) return;
      const bw = 156;
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.beginPath();
      ctx.ellipse(tree.x, tree.y, 34, 12, 0, 0, 6.28);
      ctx.fill();
      ctx.restore();
      const depth = sceneryDepth(tree.y, viewerY);
      const dw = bw * depth.scale;
      const dh = dw * (img.naturalHeight / img.naturalWidth);
      const scaledTop = tree.y - dh * (445 / 460);
      window.VIEWPORT.upright(ctx, tree.x, tree.y, () => {
        drawStyledSceneryImage(ctx, img, tree.x - dw / 2, scaledTop, dw, dh, 1, "ancient-sakura",
          depth.blur);
      });
    }
  }
  function drawDistrictLabels(chunks) {
    for (const chunk of chunks) {
      const cx=chunk.x+chunk.w/2,y=chunk.y+105;
      window.VIEWPORT.upright(ctx,cx,y,()=>{
        ctx.save();ctx.textAlign="center";
        ctx.font="900 38px 'Kaisei Decol', 'Noto Sans JP', serif";
        ctx.fillStyle="rgba(255,230,180,0.18)";ctx.fillText(chunk.name,cx,y);
        ctx.font="bold 15px 'Zen Maru Gothic', sans-serif";
        ctx.fillStyle="rgba(255,230,180,0.14)";ctx.fillText(`— ${chunk.sub || ""} —`,cx,y+24);
        ctx.restore();
      });
    }
  }

  // 地名、鳥居與櫻樹跟底圖一起快取。
  // Paint only this world-space region: leave cached overlapping pixels unchanged.
  // 相鄰磚共用整數像素邊，不重疊、不留縫，也不把邊緣像素拉寬來假裝無縫。
  function tileImage(c, imgOrPick, left, top, right, bottom) {
    const pick = typeof imgOrPick === "function" ? imgOrPick : () => imgOrPick;
    const sample = pick(0, 0);
    if (!sample?.naturalWidth || !sample?.naturalHeight || right - left < 1 || bottom - top < 1) return;
    const tw = sample.naturalWidth, th = sample.naturalHeight;
    const xform = c.getTransform?.() || { a: 1, d: 1, e: 0, f: 0 };
    const s = xform.a || 1;
    const e = xform.e || 0, f = xform.f || 0;
    const x0 = Math.floor(left / tw), x1 = Math.ceil(right / tw);
    const y0 = Math.floor(top / th), y1 = Math.ceil(bottom / th);
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.imageSmoothingEnabled = false;
    for (let ty = y0; ty < y1; ty++) for (let tx = x0; tx < x1; tx++) {
      const img = pick(tx, ty);
      if (!img?.naturalWidth) continue;
      const dx0 = Math.round(tx * tw * s + e);
      const dy0 = Math.round(ty * th * s + f);
      const dx1 = Math.round((tx + 1) * tw * s + e);
      const dy1 = Math.round((ty + 1) * th * s + f);
      if (dx1 > dx0 && dy1 > dy0) c.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, dx0, dy0, dx1 - dx0, dy1 - dy0);
    }
    c.restore();
  }
  // 同一材質只鋪一張能自接的 var1。compat 母圖/變體/交界圖未接入。
  // 世界 X 的一條 512 磚。tx 3 是 1536–2048，跨在 chunk 1800 中間，不是 chunk 邊界。
  const SAKURA_SEAM_TX = 3;
  function sakuraTileRole(tx) {
    const col = Math.floor(Number(tx) || 0);
    if (col < SAKURA_SEAM_TX) return "dirt";
    if (col === SAKURA_SEAM_TX) return "transH";
    return "steps";
  }
  function sakuraArtReady() {
    const art = window.SAKURA_ART || {};
    return !!(art.dirt?.naturalWidth && art.transH?.naturalWidth && art.steps?.naturalWidth);
  }
  window.sakuraTileRole = sakuraTileRole;
  function portGroundPick(kind) {
    return () => {
      const art = window.PORT_ART || {};
      if (kind === "wood") {
        if (art.woodVar1?.naturalWidth) return art.woodVar1;
        return art.dock?.naturalWidth ? art.dock : null;
      }
      if (art.stoneVar1?.naturalWidth) return art.stoneVar1;
      return art.stone?.naturalWidth ? art.stone : null;
    };
  }
  function paintPortShore(c, chunk, region) {
    const bandTop = chunk.y + chunk.h - 256;
    const left = Math.max(region.left, chunk.x);
    const right = Math.min(region.left + region.width, chunk.x + chunk.w);
    const top = Math.max(region.top, bandTop);
    const bottom = Math.min(region.top + region.height, chunk.y + chunk.h);
    if (right - left < 1 || bottom - top < 1) return;
    const wood = portGroundPick("wood")();
    if (!wood?.naturalWidth) return;
    c.save();
    c.beginPath(); c.rect(left, top, right - left, bottom - top); c.clip();
    tileImage(c, wood, left, top, right, bottom);
    c.restore();
  }
  // 核准 v2 列 0–252 對得上 stoneVar1。混合帶 253–324，冷暖色在列 271 交叉。
  // 只貼這 72 列，列 271 放在縫上。縫 B 繞縫垂直翻轉。缺圖就留硬界。
  const PORT_V2_ROLE = "stoneWoodV2";
  const PORT_SEAM_SY = 253;
  const PORT_SEAM_SH = 72;
  const PORT_SEAM_CENTER = 271;
  function paintPortTransitionSeam(c, img, chunk, region, seamY, flipped) {
    const north = PORT_SEAM_CENTER - PORT_SEAM_SY;
    const south = PORT_SEAM_SY + PORT_SEAM_SH - PORT_SEAM_CENTER;
    const bandTop = flipped ? seamY - south : seamY - north;
    const bandBottom = flipped ? seamY + north : seamY + south;
    const left = Math.max(region.left, chunk.x);
    const right = Math.min(region.left + region.width, chunk.x + chunk.w);
    const top = Math.max(region.top, bandTop);
    const bottom = Math.min(region.top + region.height, bandBottom);
    if (right - left < 1 || bottom - top < 1 || img.naturalHeight < PORT_SEAM_SY + PORT_SEAM_SH) return;
    c.save();
    c.beginPath();
    c.rect(left, top, right - left, bottom - top);
    c.clip();
    const xform = c.getTransform?.() || { a: 1, d: 1, e: 0, f: 0 };
    const s = xform.a || 1;
    const e = xform.e || 0, f = xform.f || 0;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.imageSmoothingEnabled = false;
    if (flipped) {
      const seamDev = seamY * s + f;
      c.translate(0, seamDev);
      c.scale(1, -1);
      c.translate(0, -seamDev);
    }
    const destTop = seamY - north;
    const destBottom = seamY + south;
    const tw = img.naturalWidth;
    const x0 = Math.floor(left / tw), x1 = Math.ceil(right / tw);
    for (let tx = x0; tx < x1; tx++) {
      const dx0 = Math.round(tx * tw * s + e);
      const dx1 = Math.round((tx + 1) * tw * s + e);
      const dy0 = Math.round(destTop * s + f);
      const dy1 = Math.round(destBottom * s + f);
      if (dx1 > dx0 && dy1 > dy0) c.drawImage(img, 0, PORT_SEAM_SY, tw, PORT_SEAM_SH, dx0, dy0, dx1 - dx0, dy1 - dy0);
    }
    c.restore();
  }
  function paintPortTransitionSeams(c, chunks, region) {
    const img = window.PORT_ART?.[PORT_V2_ROLE];
    if (!img?.naturalWidth || !img?.naturalHeight) return;
    const pad = PORT_SEAM_SH;
    for (const chunk of chunks) {
      if (!chunk.decor?.port?.shore) continue;
      if (chunk.x >= region.left + region.width || chunk.x + chunk.w <= region.left) continue;
      if (chunk.y - pad >= region.top + region.height || chunk.y + chunk.h + pad <= region.top) continue;
      paintPortTransitionSeam(c, img, chunk, region, chunk.y + chunk.h - 256, false);
      paintPortTransitionSeam(c, img, chunk, region, chunk.y + chunk.h, true);
    }
  }
  function paintTerrainRegion(c,region,chunks,groundKey,groundImg,toriiImg,toriiReady,sakuraImg,sakuraReady,stageId){
    const {left,top,width,height}=region;
    c.save();c.beginPath();c.rect(left,top,width,height);c.clip();
    // 1024 原稿仍建對齊用 atlas（驗收讀 putImageData）。畫面上只貼原圖，不抽 512 變體。
    if (groundImg && groundImg.naturalWidth === 1024 && groundImg.naturalHeight === 1024) groundAtlasFor(groundImg);
    tileImage(c, groundImg, left, top, left + width, top + height);
    if (stageId === "rain-port") {
      const stoneTile = portGroundPick("stone")();
      for (const chunk of chunks) {
        if (chunk.x > left+width || chunk.x+chunk.w < left || chunk.y > top+height || chunk.y+chunk.h < top) continue;
        if (stoneTile?.naturalWidth) {
          const roadBottom = chunk.decor?.port?.shore ? chunk.y + chunk.h - 256 : chunk.y + chunk.h;
          const rl = Math.max(left, chunk.x), rr = Math.min(left + width, chunk.x + chunk.w);
          const rt = Math.max(top, chunk.y), rb = Math.min(top + height, roadBottom);
          if (rr - rl > 1 && rb - rt > 1) {
            c.save(); c.beginPath(); c.rect(rl, rt, rr - rl, rb - rt); c.clip();
            tileImage(c, stoneTile, rl, rt, rr, rb);
            c.restore();
          }
        }
        if (chunk.decor?.port?.shore) paintPortShore(c, chunk, region);
      }
      paintPortTransitionSeams(c, chunks, region);
    }
    if (stageId === "sakura-pass" && sakuraArtReady()) {
      tileImage(c, tx => window.SAKURA_ART[sakuraTileRole(tx)], left, top, left + width, top + height);
    }
    c.restore();
  }

  function drawGroundBase(chunks, groundKey, stageId = "") {
    const v = window.VIEWPORT?.get() || {scale:1};
    const area = window.VIEWPORT?.worldBoundsAtZoom?.(1) || worldBounds();
    const pixelScale = Math.fround((v.scale || 1) * (dpr || 1)), x = camX + area.left, y = camY + area.top;
    const groundImg = window.ART && window.ART[groundKey];
    const courtImg = window.ART?.ground;
    const toriiImg = window.ART && window.ART.prop_torii;
    const sakuraImg = window.ART && window.ART.prop_sakura;
    const toriiReady = !!(toriiImg && toriiImg.complete && toriiImg.naturalWidth);
    const sakuraReady = !!(sakuraImg && sakuraImg.complete && sakuraImg.naturalWidth);
    const cached = terrainState;
    // Streaming adds/removes entire 900x600 chunks far outside the painted cache.
    // Do not invalidate visible ground for those offscreen bookkeeping changes.
    const chunksInRegion = (list,left,top,width,height) =>
      list.filter(chunk => chunk.x < left + width && chunk.x + chunk.w > left &&
        chunk.y < top + height && chunk.y + chunk.h > top);
    const currentLocalChunks = cached
      ? chunksInRegion(chunks,cached.left,cached.top,cached.width,cached.height) : [];
    const portStamp = stageId === "rain-port"
      ? ["stone", "dock", "stoneVar1", "woodVar1", "stoneWoodV2"].map(role => {
          const img = window.PORT_ART?.[role];
          return `${img?.currentSrc || ""}:${img?.naturalWidth || 0}`;
        }).join("|")
      : "";
    const sakuraStamp = stageId === "sakura-pass"
      ? ["dirt", "transH", "steps"].map(role => {
          const img = window.SAKURA_ART?.[role];
          return `${img?.currentSrc || img?.src || ""}:${img?.naturalWidth || 0}`;
        }).join("|")
      : "";
    const assetsChanged = !cached || cached.key !== groundKey || cached.stageId !== stageId || cached.portStamp !== portStamp || cached.sakuraStamp !== sakuraStamp || cached.image !== groundImg || cached.imageWidth !== (groundImg?.naturalWidth || 0) || cached.courtImage !== courtImg ||
      cached.pixelScale !== pixelScale ||
      // Camera transition varies visible world height on every frame.
      // Cache coverage below, not viewport height equality, governs rebuilds.
      cached.chunks.length !== currentLocalChunks.length ||
      currentLocalChunks.some((chunk,i)=>chunk!==cached.chunks[i]);
    const movedBeyondCache = !assetsChanged && (x < cached.left || y < cached.top ||
      x + area.width > cached.left + cached.width || y + area.height > cached.top + cached.height);
    if (assetsChanged || movedBeyondCache) {
      groundCacheBuilds += 1;
      // Snap origins to physical pixels so the blit and newly painted strips share texel boundaries.
      const left = Math.floor((x - 120) * pixelScale) / pixelScale;
      const top = Math.floor((y - 120) * pixelScale) / pixelScale;
      const pw = Math.ceil((area.width + 240) * pixelScale);
      const ph = Math.ceil((area.height + 240) * pixelScale);
      terrainCv ||= document.createElement("canvas");
      const resized = terrainCv.width !== pw || terrainCv.height !== ph;
      if (terrainCv.width !== pw) terrainCv.width = pw;
      if (terrainCv.height !== ph) terrainCv.height = ph;
      const c = terrainCv.getContext("2d");
      c.setTransform(1,0,0,1,0,0);
      const dx = cached ? Math.round((cached.left - left) * pixelScale) : 0;
      const dy = cached ? Math.round((cached.top - top) * pixelScale) : 0;
      const scrollReuse = movedBeyondCache && !assetsChanged && !resized && Math.abs(dx) < pw && Math.abs(dy) < ph;
      if (scrollReuse) {
        // Same-canvas drawImage uses the pre-operation bitmap; retain painted overlap on a scroll.
        c.drawImage(terrainCv, dx, dy);
      } else {
        c.clearRect(0,0,pw,ph);
      }
      c.setTransform(pixelScale,0,0,pixelScale,-left*pixelScale,-top*pixelScale);
      c.imageSmoothingEnabled = false;
      const right=left+pw/pixelScale, bottom=top+ph/pixelScale;
      const paint=(rl,rt,rr,rb)=>{
        if(rr-rl<=0.00001 || rb-rt<=0.00001)return;
        c.fillRect(rl, rt, rr - rl, rb - rt);
        paintTerrainRegion(c,{left:rl,top:rt,width:rr-rl,height:rb-rt},
          chunks,groundKey,groundImg,toriiImg,toriiReady,sakuraImg,sakuraReady,stageId);
      };
      if (scrollReuse) {
        const oldRight=cached.left+cached.width, oldBottom=cached.top+cached.height;
        if(left<cached.left)paint(left,top,cached.left,bottom);
        if(right>oldRight)paint(oldRight,top,right,bottom);
        const overlapLeft=Math.max(left,cached.left), overlapRight=Math.min(right,oldRight);
        if(top<cached.top)paint(overlapLeft,top,overlapRight,cached.top);
        if(bottom>oldBottom)paint(overlapLeft,oldBottom,overlapRight,bottom);
      } else {
        paint(left,top,right,bottom);
      }
      terrainState = {left,top,width:pw/pixelScale,height:ph/pixelScale,key:groundKey,stageId,portStamp,sakuraStamp,image:groundImg,
        imageWidth:groundImg?.naturalWidth || 0, courtImage:courtImg,pixelScale,viewW:area.width,viewH:area.height,
        chunks:chunksInRegion(chunks,left,top,pw/pixelScale,ph/pixelScale)};
    }
    const t = terrainState;
    ctx.drawImage(terrainCv,t.left,t.top,t.width,t.height);
  }

  // 海邊與池塘不再鋪會上下游動的水帶。那幾條會蓋在鳥居上，看起來像燈光在呼吸。
  function drawGround(elapsed, dawnTime, chunks = [], groundKey = "ground", stageId = "") {
    drawGroundBase(chunks, groundKey, stageId);
  }
  function drawPortProp(p, viewerY = null) {
    const img = window.PORT_ART?.[p.kind];
    const wide = p.kind === "warehouse" || p.kind === "fishmonger" || p.kind === "boat";
    ctx.save();
    ctx.fillStyle = "rgba(10,14,18,0.38)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, wide ? 40 : 16, wide ? 11 : 6, 0, 0, 6.28);
    ctx.fill();
    if (p.kind === "beacon") {
      ctx.fillStyle = "rgba(255,176,84,0.22)";
      ctx.beginPath(); ctx.ellipse(p.x, p.y, 34, 12, 0, 0, 6.28); ctx.fill();
    }
    ctx.restore();
    const paint = () => {
      if (!img?.naturalWidth) return;
      const w = p.kind === "warehouse" || p.kind === "fishmonger" ? 210 : p.kind === "boat" ? 118 : 70;
      const h = w * img.naturalHeight / img.naturalWidth;
      ctx.drawImage(img, p.x - w / 2, p.y - h, w, h);
    };
    if (window.VIEWPORT?.upright) window.VIEWPORT.upright(ctx, p.x, p.y, paint);
    else paint();
  }

  // All ground-contact shadows are rendered BEFORE the upright projection.
  // Their height is flattened by the world camera's current tilt, continuously.
  function drawLampShadow(l) {
    ctx.save();ctx.fillStyle="rgba(17,14,17,0.42)";
    ctx.beginPath();ctx.ellipse(l.x,l.y+8,16,6,0,0,6.28);ctx.fill();
    ctx.restore();
  }
  function drawHouseShadow(h) {
    ctx.save();ctx.fillStyle="rgba(17,14,17,0.48)";
    ctx.beginPath();ctx.ellipse(h.x,h.y+46,58,14,0,0,6.28);ctx.fill();
    ctx.restore();
  }
  function drawPlayerShadow(P, elapsed, moveDir = {x:0,y:0}) {
    const moving=Math.hypot(moveDir.x||0,moveDir.y||0)>0.1 && allowsMotion();
    const bob=moving?Math.abs(Math.sin(elapsed*12))*1.5:0;
    const size=1-bob/18;
    ctx.save();ctx.fillStyle="rgba(0,0,0,0.39)";
    ctx.beginPath();ctx.ellipse(P.x,P.y+22,28*size,11*size,0,0,6.28);ctx.fill();
    ctx.restore();
  }
  function drawMonsterShadow(e) {
    const radius=e.type==="boss"?52:e.type==="mis"?32:22;
    ctx.save();ctx.fillStyle="rgba(32,26,31,0.33)";
    ctx.beginPath();ctx.ellipse(e.x,e.y+radius*0.85,radius,radius*0.4,0,0,6.28);ctx.fill();
    ctx.restore();
  }

  // 繪製高精緻度日式町屋店鋪（真實店鋪 Sprite + 障子金光 + 和風招牌）
  function drawHouse(h, viewerY = null) {
    ctx.save();
    if (h.bType === "shrine_pavilion") {
      const img = window.SAKURA_ART?.pavilion;
      const signY = h.y + 36;
      ctx.textAlign = "center";
      ctx.font = UI.readableFont(21, "400").replace(
        "'Noto Sans JP', 'Microsoft JhengHei', sans-serif",
        "'Yuji Syuku', 'Kaisei Decol', 'Noto Sans JP', serif"
      );
      if (img?.naturalWidth) {
        const depth = sceneryDepth(h.y, viewerY);
        const bw0 = 210;
        const bh0 = bw0 * (img.naturalHeight / img.naturalWidth);
        const bw = bw0 * depth.scale;
        const bh = bh0 * depth.scale;
        const top = (h.y + 48) - bh * (430 / 440);
        drawStyledSceneryImage(ctx, img, h.x - bw / 2, top, bw, bh, 1, h.bType, depth.blur);
        ctx.fillStyle = "#e3d0a8";
        ctx.strokeStyle = "#e3d0a8";
        ctx.lineWidth = 0.7;
        ctx.strokeText("神社", h.x, signY + 23, 124);
        ctx.fillText("神社", h.x, signY + 23, 124);
      } else {
        ctx.fillStyle = "#e3d0a8";
        ctx.fillText(window.SAKURA_ART_STATUS?.pavilion === "error" ? "神社圖載入失敗" : "神社圖載入中", h.x, signY + 23, 124);
      }
      ctx.restore();
      return;
    }

    // 2. 新圖依實際透明裁切後的比例單獨定寬；腳底仍以 h.y+48 作為排序點。
    const portRole = h.bType === "port_fishmonger" ? "fishmonger" : h.bType === "port_warehouse" ? "warehouse" : "";
    let houseSprite = null;
    if (portRole) {
      const img = window.PORT_ART?.[portRole];
      if (img?.naturalWidth) houseSprite = img;
    } else if (h.bType === "house_tavern" && window.ART.house_tavern) {
      houseSprite = window.ART.house_tavern;
    } else if (h.bType === "house_shrine" && window.ART.house_shrine) {
      houseSprite = window.ART.house_shrine;
    } else if (window.ART.house_shop) {
      houseSprite = window.ART.house_shop;
    }

    // 第一關店寬 166、玩家立繪高 114。港倉 220／魚舖 236 約比町屋寬三成，候選再收 15%。
    const bw = h.bType === "port_fishmonger" ? 201 : h.bType === "port_warehouse" ? 187 : h.bType === "house_tavern" ? 175 : h.bType === "house_shrine" ? 158 : 166;
    const aspect = (houseSprite && houseSprite.naturalWidth && houseSprite.naturalHeight)
      ? (houseSprite.naturalHeight / houseSprite.naturalWidth)
      : 1.05;
    const bh = bw * aspect;

    if (houseSprite && houseSprite.naturalWidth) {
      // Camera looks north: only buildings far above the courier are distant.
      const distance = viewerY == null ? 0 : Math.max(0,viewerY-h.y);
      const focus = clamp((distance-290)/650,0,1)*clamp((1-tiltK())/0.4,0,1);
      drawStyledSceneryImage(ctx,houseSprite,h.x-bw/2,h.y-bh+48,bw,bh,1,h.bType,
        focus*2.25);
    } else {
      // 缺料不畫幾何房子。
    }

    ctx.save();
    const signW = 132;
    const signY = h.y + 36;
    ctx.textAlign = "center";
    // 町屋招牌用和風筆文字體；保留厚實暗底與暖色字，避免 20px 時過細。
    ctx.font = UI.readableFont(21, "400").replace(
      "'Noto Sans JP', 'Microsoft JhengHei', sans-serif",
      "'Yuji Syuku', 'Kaisei Decol', 'Noto Sans JP', serif"
    );
    ctx.strokeStyle = "#e3d0a8";
    ctx.lineWidth = 0.7;
    const signLabel = h.bType === "port_fishmonger" ? "魚舖"
      : h.bType === "port_warehouse" ? "港町倉庫"
      : (HOUSE_NAMES[h.bType] || HOUSE_NAMES.house_shop);
    ctx.fillStyle = "#e3d0a8";
    if (portRole && !houseSprite) {
      ctx.fillText(window.PORT_ART_STATUS?.[portRole] === "error" ? "港圖載入失敗" : "港圖載入中", h.x, signY + 23, signW - 8);
    } else {
      ctx.strokeText(signLabel, h.x, signY + 23, signW - 8);
      ctx.fillText(signLabel, h.x, signY + 23, signW - 8);
    }
    ctx.restore();

    ctx.restore();
  }

  // 繪製主角（高解析度 Chibi + 步伐彈跳 + 衝刺殘影）
  function drawPlayer(P, isDashing, inv, elapsed, moveDir, shield = 0, isSlashing = false, isHurt = false) {
    ctx.save();
    const isMoving = Math.hypot(moveDir.x, moveDir.y) > 0.1;
    const motion = allowsMotion();
    if (!motion) ghostTrails = [];
    // 1. 步伐彈跳物理 (Procedural Spring Step Bob)
    const walkBob = isMoving && motion && !isHurt ? Math.abs(Math.sin(elapsed * 12)) * 1.5 : 0;

    // 2. 彈性骨骼與次級動態 (Squash & Stretch, Lean Tilt, Secondary Inertial Shear)
    let squash = 1, stretch = 1, leanAng = 0, shearX = 0;
    if (motion && !isHurt) {
      if (isDashing) {
        // 衝刺時：前衝拉伸與前傾俯衝
        squash = 1.15;
        stretch = 0.88;
        leanAng = 0.16;
        shearX = -0.10;
      } else if (isMoving) {
        // 跑步步伐有機彈性：著地與起跳交替起伏
        const stridePhase = Math.sin(elapsed * 12);
        squash = 1.0 + stridePhase * 0.018;
        stretch = 1.0 - stridePhase * 0.015;
        // 跑步身體微前傾
        leanAng = clamp(moveDir.x * (P.faceX || 1) * 0.035, -0.05, 0.05);
        // 背負木箱與手持提燈的次級慣性滯後剪切 (Secondary Pendulum Shear)
        shearX = clamp(-moveDir.x * (P.faceX || 1) * 0.025, -0.04, 0.04);
      }
    }

    // 素材朝右。左右移動才改面向，停下或只上下走時維持最後朝向。
    if (moveDir.x < -0.05) P.faceX = -1;
    else if (moveDir.x > 0.05) P.faceX = 1;
    const flipX = P.faceX < 0 ? -1 : 1;

    // 兩幀步伐切換：移動時左右腳邁步 (walk1 <-> walk2)，靜止時站立 (player)
    let pKey = window.ART.player_idle_v2 ? "player_idle_v2" : window.ART.player_walk_left_v2 ? "player_walk_left_v2" : "player";
    let pImg = window.ART[pKey];
    if (isMoving && motion) {
      const stepIdx = Math.floor(elapsed * 6) % 2;
      const newKey = stepIdx === 0 ? "player_walk_left_v2" : "player_walk_right_v2";
      if (window.ART[newKey]) {
        pImg = window.ART[newKey];
        pKey = newKey;
      } else if (stepIdx === 0 && window.ART.player_walk1) {
        pImg = window.ART.player_walk1;
        pKey = "player_walk1";
      } else if (stepIdx === 1 && window.ART.player_walk2) {
        pImg = window.ART.player_walk2;
        pKey = "player_walk2";
      }
    }
    if (isSlashing && window.ART.player_attack_v2) { pKey = "player_attack_v2"; pImg = window.ART[pKey]; }
    if (isDashing && (window.ART.player_dash_v2 || window.ART.player_dash_v1)) {
      pKey = window.ART.player_dash_v2 ? "player_dash_v2" : "player_dash_v1";
      pImg = window.ART[pKey];
    }
    if (isHurt && window.ART.player_hurt_v2) { pKey = "player_hurt_v2"; pImg = window.ART[pKey]; }
    const poseHeight = pKey === "player_dash_v1" ? 80 : 114;

    // Foot contact shadow belongs to drawPlayerShadow(), in ground space.
    // 衝刺時加入殘影
    if (isDashing && motion && Math.random() < 0.45 && pImg) {
      addGhostTrail(pImg, P.x, P.y - walkBob, flipX, 1.0, 0.45, pKey, poseHeight);
    }

    // 繪製殘影
    for (const g of ghostTrails) {
      const a = (g.life / g.maxLife) * g.alpha;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(g.x, g.y);
      ctx.scale(g.flipX, 1);
      drawFrame(ctx,g.img,g.key,0,0,20,g.height);
      ctx.restore();
    }

    // 主體變換 (結合 步伐起伏 + 前傾角 + 次級剪切 + 擠壓拉伸)
    ctx.translate(P.x, P.y - walkBob);
    ctx.scale(flipX * squash, stretch);
    if (leanAng !== 0) ctx.rotate(leanAng);
    if (shearX !== 0) ctx.transform(1, 0, shearX, 1, 0, 0);

    // 金剛結界護盾環繞（若 shield > 0）
    if (shield > 0) {
      ctx.save();
      const rot = motion ? elapsed * 1.6 : 0.4;
      const sr = 42;
      ctx.strokeStyle = "rgba(255, 220, 80, 0.85)";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([9, 6]);
      ctx.beginPath();
      ctx.arc(0, -22, sr, rot, rot + 6.283);
      ctx.stroke();

      // 金黃金剛勾玉護盾珠
      for (let s = 0; s < shield; s++) {
        const sa = rot + s * (6.283 / shield);
        const sx = Math.cos(sa) * sr;
        const sy = -22 + Math.sin(sa) * (sr * 0.7);
        ctx.fillStyle = "#ffe28b";
        ctx.beginPath();
        ctx.arc(sx, sy, 6, 0, 6.28);
        ctx.fill();
      }
      ctx.restore();
    }

    // 受擊閃爍
    if (inv > 0 && Math.floor(elapsed * 24) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }

    if (pImg) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      drawFrame(ctx,pImg,pKey,0,0,20,poseHeight);
    } else {
      ctx.fillStyle = "#e07a3c";
      ctx.beginPath();
      ctx.arc(0, -18, 20, 0, 6.28);
      ctx.fill();
    }

    ctx.restore();
  }

  // 繪製妖怪怪物（修正面向問題！根據各 Sprite 原生朝向計算正確鏡像）
  function drawStage2Actor(e, P) {
    const spec = e.type === "shiome"
      ? { idle: "shiomeIdle", attack: "shiomeAttack", w: 250, h: 220, ax: 125, ay: 205, scale: 0.48 }
      : { idle: "bossIdle", attack: "bossAttack", w: 350, h: 330, ax: 175, ay: 320, scale: 0.55 };
    const key = (!e.shield && e.pose === "attack") ? spec.attack : spec.idle;
    const img = window.PORT_ENEMIES?.[key];
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.scale(P.x < e.x ? -1 : 1, 1);
    if (img?.naturalWidth) {
      const sx = img.naturalWidth / spec.w, sy = img.naturalHeight / spec.h, s = spec.scale;
      ctx.drawImage(img, -spec.ax * sx * s, -spec.ay * sy * s, img.naturalWidth * s, img.naturalHeight * s);
    }
    ctx.restore();
  }

  function drawBossSeal(e, elapsed) {
    ctx.save();
    ctx.translate(e.x, e.y);
    if (e.shield) {
      const ringRot = elapsed * 1.8;
      ctx.strokeStyle = "#cfac6b";
      ctx.lineWidth = 3.5;
      ctx.setLineDash([12, 9]);
      ctx.beginPath();
      ctx.arc(0, -35, 68, ringRot, ringRot + 6.28);
      ctx.stroke();
      ctx.setLineDash([]);

      // 盾牌 Emoji 改為和紙家紋，保留護盾辨識度。
      ctx.fillStyle = "#ead6a9";
      ctx.strokeStyle = "#392a32";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0,-121);ctx.lineTo(11,-112);ctx.lineTo(9,-95);
      ctx.lineTo(0,-88);ctx.lineTo(-9,-95);ctx.lineTo(-11,-112);
      ctx.closePath();ctx.fill();ctx.stroke();
      ctx.strokeStyle = "#a95743";ctx.lineWidth = 2.3;
      ctx.beginPath();ctx.moveTo(-5,-108);ctx.lineTo(0,-98);ctx.lineTo(5,-108);ctx.stroke();
    }
    ctx.restore();
  }

  function drawMonster(e, P, elapsed) {
    if (e.type === "shiome" || e.umibozu) {
      drawStage2Actor(e, P);
      if (e.umibozu && !e.dying) drawBossSeal(e, elapsed);
      return;
    }
    ctx.save();
    const isBoss = e.type === "boss";
    const isMis = e.type === "mis";
    const motion = allowsMotion();
    const bob = motion ? Math.sin(elapsed * 5 + (e.wob || 0)) * 2 : 0;

    // 目標朝向：玩家在怪物左邊時為 -1，在右邊時為 1
    const dirTowardsPlayer = (P.x < e.x) ? -1 : 1;

    // 新素材一律朝畫面右側，玩家在左側時才水平翻轉。
    const scaleX = dirTowardsPlayer === 1 ? 1 : -1;

    // 程序化次級彈性骨骼與果凍軟體物理 (Procedural Spring & Soft-body Secondary Motion)
    let sX = 1, sY = 1, tilt = 0;
    if (motion) {
      if (isBoss) {
        // 大妖 Boss：威嚴慢速深呼吸與沉重受傷後座力
        const breath = Math.sin(elapsed * 2.6 + (e.wob || 0)) * 0.04;
        sX = 1 + breath;
        sY = 1 - breath * 0.6;
        if (e.flash > 0) { sX *= 1.12; sY *= 0.90; }
      } else if (e.type === "runner") {
        // 疾走怪：奔馳起伏拉伸與前傾俯衝
        const stride = Math.sin(elapsed * 12 + (e.wob || 0));
        sX = 1 + stride * 0.12;
        sY = 1 - stride * 0.10;
        tilt = 0.12;
        if (e.flash > 0) { sX *= 1.20; sY *= 0.80; }
      } else if (e.type === "tank") {
        // 巨盾怪：笨重重踏頓挫
        const stomp = Math.abs(Math.sin(elapsed * 4 + (e.wob || 0)));
        sX = 1 + (1 - stomp) * 0.08;
        sY = 1 - (1 - stomp) * 0.07;
        if (e.flash > 0) { sX *= 1.15; sY *= 0.88; }
      } else {
        // 幽靈怪 (ghost / shooter / mis)：果凍軟體呼吸與受傷劇烈彈動震顫
        const jelly = Math.sin(elapsed * 4.5 + (e.wob || 0)) * 0.08;
        sX = 1 + jelly;
        sY = 1 - jelly;
        tilt = Math.sin(elapsed * 3 + (e.wob || 0)) * 0.07;
        if (e.flash > 0) { sX *= 1.28; sY *= 0.74; }
      }
    }

    // Enemy contact shadow is rendered separately in world floor space.
    ctx.translate(e.x, e.y + bob);
    ctx.scale(scaleX * sX, sY);
    if (tilt !== 0) ctx.rotate(tilt);

    // 取得當前關卡對應的 sprite（優先 STAGE_ASSET_SLOTS，缺圖回落通用）
    const idleKey = getStageSpriteKey(e, "idle");
    const attackKey = getStageSpriteKey(e, "attack");
    const useAttack = !e.shield && e.pose === "attack";
    const spriteKey = useAttack && attackKey ? attackKey : idleKey;

    let sprite = spriteKey ? window.ART[spriteKey] : null;
    let sw = 50;

    // 依類型決定基礎寬度
    if (isBoss) sw = 125;
    else if (isMis) sw = 76;
    else if (e.type === "runner") sw = 66;
    else if (e.type === "tank") sw = 74;
    else if (e.type === "shooter") sw = 62;
    else sw = 54;

    // 如果 stage-specific sprite 不存在，回落通用 sprite
    if (!sprite || !sprite.naturalWidth) {
      const fallbackKey = isBoss ? "boss" : isMis ? "mis" : e.type;
      sprite = window.ART[fallbackKey] || window.ART.ghost;
      if (fallbackKey !== "ghost" && (!sprite || !sprite.naturalWidth)) {
        sprite = window.ART.ghost;
      }
    }

    if (sprite) {
      const aspect = (sprite.naturalWidth && sprite.naturalHeight) ? (sprite.naturalHeight / sprite.naturalWidth) : 1;
      const actualH = sw * aspect;
      const kind = isBoss ? "boss" : isMis ? "mis" : ["runner","tank","shooter"].includes(e.type) ? e.type : "ghost";
      let artKey = kind, artIndex = 0;
      if (!window.ART[kind] && sprite === window.ART.ghost) artKey = 'ghost';
      const atlas = window.ART[`${kind}_motion_v1`];
      if (atlas && !e.dying && !e.burning && !e.revealT) {
        if (e.attackT > 0) { sprite = atlas; artKey = `${kind}_motion_v1`; artIndex = 1; }
        else if (e.walking && allowsMotion() && Math.floor(elapsed*6+(e.wob||0))%2) { sprite = atlas; artKey = `${kind}_motion_v1`; }
      }
      const box = drawFrame(ctx,sprite,artKey,artIndex,0,actualH*0.15,actualH);
      if (e.flash > 0) {
        let masks = hitSilhouettes.get(sprite);
        if (!masks) { masks = new Map(); hitSilhouettes.set(sprite,masks); }
        let mask = masks.get(artIndex);
        if (!mask) {
          mask = document.createElement("canvas");
          mask.width = 128; mask.height = Math.max(1, Math.round(128 * box.sh/box.sw));
          const mc = mask.getContext("2d");
          mc.drawImage(sprite,box.sx,box.sy,box.sw,box.sh,0,0,mask.width,mask.height);
          mc.globalCompositeOperation = "source-in";
          mc.fillStyle = "#ffffff"; mc.fillRect(0, 0, mask.width, mask.height);
          masks.set(artIndex,mask);
        }
        ctx.globalAlpha *= 0.7;
        ctx.drawImage(mask,box.dx,box.dy,box.dw,box.dh);
      }
    } else {
      ctx.fillStyle = e.flash > 0 ? "#ffffff" : isBoss ? "#8a2434" : isMis ? "#68399e" : "#80c4ff";
      ctx.beginPath();
      ctx.arc(0, -sw * 0.4, sw * 0.4, 0, 6.28);
      ctx.fill();
    }

    ctx.restore();

    // Boss 身上的結界保留，但血量統一由 UI 中下方王戰血條呈現。
    if (isBoss && !e.dying) drawBossSeal(e, elapsed);

    // 誤配妖怪頭頂名牌（持久顯示假名與中文：例如 🐱 ねこ＝貓）
    if (isMis && e.w) {
      ctx.save();
      ctx.textAlign = "center";
      const badgeText = `${e.w.jp}＝${e.w.zh}`;
      ctx.font = UI.readableFont(20, "700");
      const bw = ctx.measureText(badgeText).width + 46;
      const badgeY = e.y - 108;
      ctx.fillStyle = "rgba(35, 14, 52, 0.88)";
      ctx.beginPath();
      ctx.roundRect(e.x - bw / 2, badgeY, bw, 32, 6);
      ctx.fill();
      ctx.strokeStyle = "#e1bee7";
      ctx.lineWidth = 1.4;
      ctx.stroke();

      if (typeof UI.drawWordCue === "function") UI.drawWordCue(ctx, e.w, e.x - bw / 2 + 22, badgeY + 16, 22);
      ctx.fillStyle = "#f5d4ff";
      ctx.textAlign = "center";
      ctx.fillText(badgeText, e.x + 12, badgeY + 23);
      ctx.restore();
    }
  }

  // 提亮琉璃核心與金邊：小量固定輪廓光代替昂貴的逐珠模糊濾鏡。
  function drawGemShadow(g) {
    const radius = g.v > 2 ? 11 : 9;
    ctx.save();ctx.fillStyle="rgba(31,26,32,.34)";
    ctx.beginPath();ctx.ellipse(g.x,g.y+radius*.75,radius*.86,3,0,0,Math.PI*2);ctx.fill();
    ctx.restore();
  }
  function drawSpiritGem(g, elapsed) {
    const large = g.v > 2, radius = large ? 11 : 9;
    const rise = allowsMotion() ? Math.sin(elapsed * 4 + g.x * .07) * 1.7 : 0;
    const gleam = allowsMotion() ? 0.78 + 0.22 * Math.sin(elapsed * 3.5 + g.x * .035) : 0.9;
    ctx.save();
    ctx.translate(g.x, g.y - rise);
    ctx.strokeStyle = `rgba(145,239,234,${(0.24 * gleam).toFixed(3)})`;
    ctx.lineWidth = 4;
    ctx.beginPath();ctx.ellipse(0,0,radius+4,(radius+4)*.86,0,0,Math.PI*2);ctx.stroke();
    ctx.strokeStyle = `rgba(244,210,139,${(0.72 + 0.2 * gleam).toFixed(3)})`;
    ctx.lineWidth = 1.9;
    ctx.beginPath();ctx.ellipse(0,0,radius+2,(radius+2)*.86,0,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle = "#81dce2";
    ctx.strokeStyle = "#33424a";
    ctx.lineWidth = 1.6;
    ctx.lineJoin = "round";
    ctx.beginPath();ctx.moveTo(0,-radius);ctx.lineTo(radius*.72,-radius*.35);
    ctx.lineTo(radius*.72,radius*.42);ctx.lineTo(0,radius);
    ctx.lineTo(-radius*.72,radius*.42);ctx.lineTo(-radius*.72,-radius*.35);
    ctx.closePath();ctx.fill();ctx.stroke();
    ctx.fillStyle = "#e9ffff";
    ctx.beginPath();ctx.moveTo(0,-radius*.7);ctx.lineTo(radius*.35,-radius*.18);
    ctx.lineTo(0,radius*.36);ctx.lineTo(-radius*.35,-radius*.18);
    ctx.closePath();ctx.fill();
    ctx.fillStyle = "rgba(255,255,242,.88)";
    ctx.beginPath();ctx.ellipse(-radius*.3,-radius*.35,1.6,2.7,-.35,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle = "#497987";ctx.lineWidth = 1.1;
    ctx.beginPath();ctx.moveTo(0,radius*.36);ctx.lineTo(0,radius*.79);ctx.stroke();
    ctx.restore();
  }

  // 繪製立體多光源動態光影（柔和三次樣條光暈 + 街燈光暈池）
  const LAMP_LIGHT_LIFT = 22; // 與 game.js 的新石燈火袋光心相同
  function renderLighting(P, LAMPS, oil, elapsed, dawnTime, maxOil = 100, lampOut = 0, offset = {x:0,y:0}) {
    const progress = clamp(elapsed / dawnTime, 0, 1);
    lightCtx.globalCompositeOperation = "source-over";
    const area = bounds();
    lightCtx.clearRect(area.left, area.top, area.width, area.height);

    // 夜色中間調：罩上一層靛色，町屋與路面仍讀得出來，再隨黎明退掉。
    const nightR = Math.round(28 + 62 * progress);
    const nightG = Math.round(32 + 40 * progress);
    const nightB = Math.round(58 + 18 * progress);
    const nightAlpha = 0.72 * Math.pow(1 - progress, 1.05) * (1 - lampOut) + 0.97 * lampOut; // 燈滅時整個夜色壓到近乎全黑

    lightCtx.fillStyle = `rgba(${nightR}, ${nightG}, ${nightB}, ${nightAlpha})`;
    lightCtx.fillRect(area.left, area.top, area.width, area.height);

    // 挖出光源 (destination-out)
    lightCtx.globalCompositeOperation = "destination-out";

    // 1. 主角提燈核心光照
    const k = tiltK();
    const z = window.VIEWPORT?.worldZoom?.() || 1;
    const playerScreen = window.VIEWPORT?.worldToScreen
      ? window.VIEWPORT.worldToScreen(P.x, P.y, { x: camX, y: camY }, offset)
      : { x: P.x - camX + offset.x, y: (P.y - camY + offset.y) * k };
    const screenPx = playerScreen.x;
    const screenPy = playerScreen.y;
    const flicker = allowsMotion() ? Math.sin(elapsed * 16) * 3 : 0;
    const baseRadius = Math.max(16, (150 + clamp(oil / Math.max(1, maxOil), 0, 1) * 170 + flicker) * (1 - lampOut)) * z;

    const playerGlow = lightCtx.createRadialGradient(screenPx, screenPy, 15, screenPx, screenPy, baseRadius);
    playerGlow.addColorStop(0, "rgba(0,0,0,1)");
    playerGlow.addColorStop(0.4, "rgba(0,0,0,0.85)");
    playerGlow.addColorStop(0.8, "rgba(0,0,0,0.35)");
    playerGlow.addColorStop(1, "rgba(0,0,0,0)");

    lightCtx.save();
    if(k!==1){lightCtx.translate(screenPx,screenPy);lightCtx.scale(1,k);lightCtx.translate(-screenPx,-screenPy);}
    lightCtx.fillStyle = playerGlow;
    lightCtx.beginPath();
    lightCtx.arc(screenPx, screenPy, baseRadius, 0, 6.28);
    lightCtx.fill();
    lightCtx.restore();

    // 2. 街角提燈 (LAMPS) 暖光池（燈滅時一併退去）
    lightCtx.globalAlpha = 1 - lampOut;
    LAMPS.forEach(l => {
      const lampScreen = window.VIEWPORT?.worldToScreen
        ? window.VIEWPORT.worldToScreen(l.x, l.y + 8, { x: camX, y: camY }, offset)
        : { x: l.x - camX + offset.x, y: (l.y + 8 - camY + offset.y) * k };
      const lx = lampScreen.x;
      const ly = lampScreen.y - 30 * z;
      const lampRadius = 125 * z;
      if (lx < area.left - lampRadius || lx > area.right + lampRadius || ly < area.top - lampRadius || ly > area.bottom + lampRadius) return;
      const g = lightCtx.createRadialGradient(lx, ly, 10, lx, ly, lampRadius);
      g.addColorStop(0, "rgba(0,0,0,0.95)");
      g.addColorStop(0.5, "rgba(0,0,0,0.5)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      lightCtx.save();
      if(k!==1){lightCtx.translate(lx,ly);lightCtx.scale(1,k);lightCtx.translate(-lx,-ly);}
      lightCtx.fillStyle = g;
      lightCtx.beginPath();
      lightCtx.arc(lx, ly, lampRadius, 0, 6.28);
      lightCtx.fill();
      lightCtx.restore();
    });

    lightCtx.globalAlpha = 1;

    // 夜色遮罩只合成一次。暖光是燈暈上的少數徑向漸層，不再鋪第二張全螢幕。
    ctx.drawImage(lightCv, area.left, area.top, area.width, area.height);
    if (lampOut < 1) paintWarmPool(screenPx, screenPy, baseRadius * 0.62);
    if (lampOut < 1) LAMPS.forEach(l => {
      const lampScreen = window.VIEWPORT?.worldToScreen
        ? window.VIEWPORT.worldToScreen(l.x, l.y + 8, { x: camX, y: camY }, offset)
        : { x: l.x - camX + offset.x, y: (l.y + 8 - camY + offset.y) * k };
      const lx = lampScreen.x;
      const ly = lampScreen.y - 30 * z;
      const warmRadius = 76 * z;
      if (lx < area.left - warmRadius || lx > area.right + warmRadius || ly < area.top - warmRadius || ly > area.bottom + warmRadius) return;
      paintWarmPool(lx, ly, warmRadius);
    });

    function paintWarmPool(x, y, radius) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 1 - lampOut;
      if(k!==1){ctx.translate(x,y);ctx.scale(1,k);ctx.translate(-x,-y);}
      const warm = ctx.createRadialGradient(x, y, radius * 0.05, x, y, radius);
      warm.addColorStop(0, "rgba(255, 186, 96, 0.20)");
      warm.addColorStop(0.55, "rgba(255, 140, 64, 0.07)");
      warm.addColorStop(1, "rgba(255, 120, 40, 0)");
      ctx.fillStyle = warm;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 6.28);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawDamageNumbers() {
    ctx.save();
    for (const d of dmgNumbers) {
      ctx.save();
      const k=tiltK();
      if(k!==1){ctx.translate(d.x,d.y);ctx.scale(1,1/k);ctx.translate(-d.x,-d.y);}
      const alpha = clamp(d.life / 0.3, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.textAlign = "center";
      const message=String(d.val);
      if (message.includes("燈油")) {
        // 貼在畫面上的短御札／朱印警示：仍跟隨原世界座標及生命週期。
        // 不改數值傷害、Boss label 的繪法與更新頻率。
        ctx.save();
        const fontSize=Math.max(15,Math.round(17*d.scale));
        ctx.font=`900 ${fontSize}px 'Noto Sans JP','Zen Maru Gothic',sans-serif`;
        const halfW=clamp(ctx.measureText(message).width/2+17,60,215);
        const cy=d.y-8,h=32,tip=8,px=d.x;
        ctx.fillStyle="rgba(33,24,25,.90)";
        ctx.beginPath();ctx.moveTo(px-halfW+tip,cy-h/2);
        ctx.lineTo(px+halfW-tip,cy-h/2);ctx.lineTo(px+halfW,cy);
        ctx.lineTo(px+halfW-tip,cy+h/2);
        ctx.lineTo(px-halfW+tip,cy+h/2);ctx.lineTo(px-halfW,cy);ctx.closePath();
        ctx.fill();
        ctx.lineWidth=1.7;ctx.strokeStyle="#c79373";ctx.stroke();
        // 封緘朱印與不完全對稱的墨痕。
        ctx.fillStyle="#a94d43";ctx.beginPath();
        ctx.arc(px-halfW+13,cy,6,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle="rgba(230,182,125,.45)";
        ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(px-halfW+26,cy+10);
        ctx.lineTo(px+halfW-10,cy+9);ctx.stroke();
        ctx.fillStyle="#f1d5b6";ctx.fillText(message,px+5,cy+fontSize*.33,halfW*2-33);
        ctx.restore();
      } else {
        ctx.font=`900 ${Math.round(20*d.scale)}px 'Zen Maru Gothic', sans-serif`;
        ctx.strokeStyle="#211b20";ctx.lineWidth=3.5;
        ctx.strokeText(message,d.x,d.y);
        ctx.fillStyle=d.color;ctx.fillText(message,d.x,d.y);
      }
      ctx.restore();
    }
    ctx.restore();
  }

  function katanaVfxArt(rank = 3) {
    const ranked = window.skillVfxArt?.("katana", rank);
    if (ranked && ranked.naturalWidth > 0 && ranked.naturalHeight > 0) return { img: ranked, mirror: false };
    // 禁止等級圖尚未載入時顯示舊 katana.webp；寧用 Canvas 刀弧作短暫備援。
    return null;
  }

  function drawKatanaSlashArt(s, alpha, tierIdx, progress) {
    const rank = tierIdx + 1;
    const resolved = katanaVfxArt(rank);
    if (!resolved) return false;
    const { img, mirror } = resolved;
    const scale = [0.78, 0.86, 0.94, 1.02, 1.0][tierIdx];
    const h = s.radius * 2.02 * scale;
    const w = h * img.naturalWidth / img.naturalHeight;
    const forward = rank <= 4
      ? s.radius * (0.08 + progress * 0.04)
      : s.radius * 0.82;
    const sweep = (progress - 0.48) * [0.08, 0.1, 0.12, 0.14, 0.18][tierIdx];

    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle + sweep);
    if (rank >= 3) {
      ctx.save();
      ctx.globalAlpha = alpha * (rank === 5 ? 0.22 : 0.13);
      ctx.translate(-s.radius * 0.1, rank === 4 ? 5 : -7);
      ctx.rotate(rank === 5 ? -0.075 : -0.045);
      ctx.translate(forward + w * (rank <= 4 ? 0.04 : 0.14), 0);
      if (mirror) ctx.scale(-1, 1);
      ctx.drawImage(img, -w * 0.52, -h * 0.5, w * 1.04, h * 1.04);
      ctx.restore();
    }
    ctx.globalAlpha = alpha * [0.82, 0.88, 0.92, 0.96, 1][tierIdx];
    ctx.save();
    ctx.translate(forward + w * (rank <= 4 ? 0.02 : 0.12), 0);
    if (mirror) ctx.scale(-1, 1);
    ctx.drawImage(img, -w * 0.5, -h * 0.5, w, h);
    ctx.restore();
    ctx.restore();
    return true;
  }

  function drawSlashArcs() {
    ctx.save();
    for (const s of slashArcs) {
      const paintSlash = () => {
      const progress = 1 - (s.life / s.maxLife);
      const tierIdx = Math.min(5, Math.max(1, s.tier || 3)) - 1;
      const alpha = s.life / s.maxLife * [0.8, 0.85, 0.95, 1, 1][tierIdx];
      if (drawKatanaSlashArt(s, alpha, tierIdx, progress)) return;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);

      // 1. 三日月流光刀芒多邊形 (Crescent Blade Polygon - 刀背厚、刀尖刀尾銳利如針)
      const steps = 28;
      const startAng = -s.spread / 2;
      const endAng = s.spread / 2;
      const maxThick = [7, 8, 12, 17, 28][tierIdx] * (0.55 + 0.45 * alpha);

      ctx.beginPath();
      // 外弧線 (Outer cutting edge)
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const ang = startAng + t * (endAng - startAng);
        const th = Math.sin(t * Math.PI) * maxThick;
        const r = s.radius + th * 0.55;
        const px = Math.cos(ang) * r;
        const py = Math.sin(ang) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      // 內弧線 (Inner cutting edge 回推)
      for (let i = steps; i >= 0; i--) {
        const t = i / steps;
        const ang = startAng + t * (endAng - startAng);
        const th = Math.sin(t * Math.PI) * maxThick;
        const r = s.radius - th * 0.45;
        const px = Math.cos(ang) * r;
        const py = Math.sin(ang) * r;
        ctx.lineTo(px, py);
      }
      ctx.closePath();

      // 單刃 → 雙刃 → 三刃；Lv5 加強實色金光與厚度。
      ctx.fillStyle = tierIdx === 4 ? `rgba(255, 208, 102, ${alpha * 0.9})` : `rgba(226, 192, 128, ${alpha * 0.75})`;
      ctx.fill();

      // 2. 刀尖極限鋒刃白熱光芒 (Razor Sharp Core Line)
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
      ctx.lineWidth = [1.6, 1.7, 2.2, 2.8, 3.8][tierIdx];
      ctx.beginPath();
      ctx.arc(0, 0, s.radius, startAng + 0.08, endAng - 0.04);
      ctx.stroke();

      // 高階增加獨立刀刃，而不是疊大面積光暈。
      for (let layer = 0; layer < tierIdx; layer++) {
        ctx.strokeStyle = `rgba(217, 177, 102, ${alpha * (0.75 - layer * 0.15)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, s.radius * (0.89 - layer * 0.08), startAng + 0.15 + layer * 0.1, endAng - 0.12);
        ctx.stroke();
      }

      // Lv5 特有：次元裂隙與交錯居合劍芒 (Dimensional Cross-Cutting Blades)
      if (tierIdx === 4) {
        ctx.strokeStyle = `rgba(16, 12, 24, ${alpha * 0.85})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        for (let i = 0; i <= 6; i++) {
          const a = startAng + (i / 6) * (endAng - startAng);
          const r = s.radius + (i % 2 === 0 ? 14 : -12);
          const px = Math.cos(a) * r, py = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();

        ctx.strokeStyle = `rgba(142, 232, 255, ${alpha * 0.9})`;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        const midA = (startAng + endAng) / 2;
        ctx.moveTo(Math.cos(midA - 0.45) * (s.radius - 32), Math.sin(midA - 0.45) * (s.radius - 32));
        ctx.lineTo(Math.cos(midA + 0.45) * (s.radius + 36), Math.sin(midA + 0.45) * (s.radius + 36));
        ctx.stroke();
      }

      // 4. 刀刃破裂火星 (Flying Sparks along the cutting arc)
      const sparkCount = [3, 6, 9, 12, 24][tierIdx];
      for (let k = 0; k < sparkCount; k++) {
        const st = (k + (s.life * 13) % 1) / sparkCount;
        const sang = startAng + st * (endAng - startAng);
        const sr = s.radius + (Math.sin(k * 7.3) * 16) + progress * 24;
        const sx = Math.cos(sang) * sr;
        const sy = Math.sin(sang) * sr;
        ctx.fillStyle = k % 3 === 0 ? "#ffffff" : k % 3 === 1 ? "#ffe082" : "#98f5ff";
        ctx.fillRect(sx - 1.5, sy - 1.5, 3, 3);
      }

      ctx.restore();
      };
      if (window.VIEWPORT?.upright) window.VIEWPORT.upright(ctx, s.x, s.y, paintSlash);
      else paintSlash();
    }
    ctx.restore();
  }

    // 水墨雲影：低透明平塗墨團，不使用現代柔光徑向漸層。
  function drawGroundParallax(elapsed, dawnTime, cam = { x: camX, y: camY }) {
    if (!allowsMotion()) return;
    const area = worldBounds();
    ctx.save();
    const cloudSpeed = elapsed * 15;
    const cloudParallax = sakuraDepthOn() ? (depthMode() === "enhanced" ? 0.55 : 0.42) : 0.20;
    const cx0 = cam.x * (1 - cloudParallax) + cloudSpeed;
    const cy0 = cam.y * (1 - cloudParallax) + cloudSpeed * 0.4;
    const worldLeft = cam.x + area.left - 100;
    const worldTop = cam.y + area.top - 100;
    const worldW = area.width + 200;
    const worldH = area.height + 200;

    for (let c = 0; c < 3; c++) {
      const seed = c * 520;
      const px = worldLeft + ((cx0 + seed) % (worldW + 500)) - 250;
      const py = worldTop + ((cy0 + seed * 0.7) % (worldH + 400)) - 200;
      ctx.fillStyle = c%2 ? "rgba(22, 23, 31, 0.055)" : "rgba(18, 20, 28, 0.075)";
      ctx.beginPath();ctx.ellipse(px,py,270,150,0.2,0,6.28);ctx.fill();
      ctx.fillStyle = "rgba(13, 15, 22, 0.04)";
      ctx.beginPath();ctx.ellipse(px+70,py-18,185,82,-0.08,0,6.28);ctx.fill();
    }
    ctx.restore();
  }

  // 中景夜霧改為薄墨刷痕：以兩層低透明橢圓代替高斯體積霧。
  function drawMistParallax(elapsed, dawnTime, cam = { x: camX, y: camY }) {
    if (!allowsMotion()) return;
    const area = bounds();
    ctx.save();
    const layered = sakuraDepthOn();
    const enhanced = depthMode() === "enhanced";
    const mistYBase = [area.top + area.height * 0.26, area.top + area.height * 0.68];
    for (let m = 0; m < 2; m++) {
      const mSpeed = (m === 0 ? 12 : -9) * elapsed;
      const basePhase = m * 3.1 + elapsed * 0.4;
      const puffs = 4;
      const step = (area.width + 500) / puffs;
      const follow = layered && m === 0 ? (enhanced ? 0.12 : 0.18) : 0.45;
      for (let i = 0; i < puffs; i++) {
        const seed = i * 197 + m * 431;
        const driftX = ((cam.x * follow + mSpeed + i * step) % (area.width + 500)) - 250;
        const px = area.left + driftX;
        const py = mistYBase[m] + Math.sin(basePhase + i * 1.4) * 20 + ((cam.y * 0.15) % 40);
        const rx = 180 + (seed % 60);
        const ry = 46 + (seed % 20);

        const farAlpha = layered ? (enhanced ? 0.06 : 0.048) : 0.018;
        const nearAlpha = layered ? 0.02 : 0.016;
        ctx.fillStyle = m===0 ? `rgba(132, 145, 166, ${farAlpha})` : `rgba(154, 148, 151, ${nearAlpha})`;
        ctx.beginPath();ctx.ellipse(px,py,rx,ry,Math.sin(basePhase+i)*0.04,0,6.28);ctx.fill();
        ctx.fillStyle = "rgba(210, 202, 183, 0.010)";
        ctx.beginPath();ctx.ellipse(px-35,py+7,rx*.72,ry*.48,-0.05,0,6.28);ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawAtmosphere(elapsed, petalCount = 50, fireflyCount = FIREFLIES.length) {
    if (!allowsMotion()) return;
    const area = bounds();
    ctx.save();
    // 飄動櫻花雨 (按景深層次繪製，近景帶有柔邊大氣光芒)
    for (let i = 0; i < Math.min(SAKURA.length, petalCount); i++) {
      const p = SAKURA[i];
      const sx = p.x, sy = p.y;
      if (sx < area.left - 30 || sx > area.right + 30 || sy < area.top - 30 || sy > area.bottom + 30) continue;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(p.rot);
      if (p.depth > 1.2) {
        ctx.fillStyle = `rgba(192, 151, 166, ${p.alpha * 0.72})`;
      } else if (p.depth < 0.8) {
        ctx.fillStyle = `rgba(154, 119, 136, ${p.alpha * 0.50})`;
      } else {
        ctx.fillStyle = `rgba(181, 137, 155, ${p.alpha * 0.70})`;
      }
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, 6.28);
      ctx.fill();
      ctx.restore();
    }

    // 螢火蟲 (夜行幽火)
    for (let i=0;i<Math.min(FIREFLIES.length,fireflyCount);i++) {
      const f=FIREFLIES[i];
      const fx = f.x + Math.sin(elapsed * 2 + f.phase) * 30;
      const fy = f.y + Math.cos(elapsed * 1.5 + f.phase) * 20;
      if (fx < area.left - 20 || fx > area.right + 20 || fy < area.top - 20 || fy > area.bottom + 20) continue;
      const pulse = 0.4 + 0.6 * Math.sin(elapsed * 4 + f.phase);
      ctx.fillStyle = `rgba(171, 211, 184, ${pulse * 0.58})`;
      ctx.beginPath();
      ctx.arc(fx, fy, 3.5, 0, 6.28);
      ctx.fill();
    }
    ctx.restore();
  }

  return {
    init, resize,
    W, H,
    WORLD_UNBOUNDED: true,
    getCam: () => ({ x: camX, y: camY }),
    setCam(x, y) { camX = x; camY = y; },
    getDpr: () => dpr,
    getCtx: () => ctx,
    getCanvas: () => cv,
    triggerHitStop,
    triggerShake,
    clearShake,
    spawnDamageNumber,
    addSlashArc,
    updateEffects,
    drawGround,
    drawGroundParallax,
    drawMistParallax,
    setDepthStage(id) { depthStageId = id || ""; },
    groundCacheStats: () => ({ builds: groundCacheBuilds, pixelScale: terrainState?.pixelScale || 0, width: terrainCv?.width || 0, height: terrainCv?.height || 0 }),
    sceneryDepth,
    drawHouse,
    drawHouseShadow,
    drawLampShadow,
    drawPlayerShadow,
    drawMonsterShadow,
    drawDecorActor,
    drawPortProp,
    drawDistrictLabels,
    drawScenerySprite,
    drawPlayer,
    drawFrame,
    drawMonster,
    drawGemShadow,
    drawSpiritGem,
    renderLighting,
    drawDamageNumbers,
    drawSlashArcs,
    drawAtmosphere,
    getShakeOffset() {
      if (!allowsMotion() || shake === 0) return { x: 0, y: 0 };
      return {
        x: (Math.random() - 0.5) * shake,
        y: (Math.random() - 0.5) * shake
      };
    }
  };
})();
