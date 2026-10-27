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
  let depthStageId = "";
  function currentStageId() { return depthStageId || (typeof window !== "undefined" && window.STAGE?.id) || ""; }

  // 取得當前關卡的怪物/Boss sprite key（從 STAGE_ASSET_SLOTS 解析，缺圖回落通用）
  function getStageSpriteKey(e, spriteType) {
    // 雨港專用敵人由 PORT_ENEMIES 處理
    if (currentStageId() === "rain-port" && (e.type === "shiome" || e.umibozu)) {
      return null;
    }
    const slots = window.STAGE_ASSET_SLOTS?.[currentStageId()];
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
    boss_motion_v1:[[16,42,871,778,443.5],[800,36,969,781,1330.5]],
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
    if (allowsMotion()) hitStop = Math.max(hitStop, Math.min(0.06, Math.max(0, duration)));
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

  function drawStyledSceneryImage(c,image,x,y,w,h,alpha=1,kind="scenery",depthBlur=0,sourceRect=null) {
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
    if (sourceRect) {
      c.drawImage(image, sourceRect.sx, sourceRect.sy, sourceRect.sw, sourceRect.sh, x, y, w, h);
    } else {
      c.drawImage(image, x, y, w, h);
    }
    c.restore();
    return true;
  }

  function drawScenerySprite(image,x,y,w,h,alpha=1) {
    if (currentStageId() === "rain-port" && (
      image === window.ART?.prop_lantern ||
      image === window.ART?.prop_port_lighthouse ||
      image === window.PORT_ART?.beacon ||
      image === window.ART?.stone_lantern ||
      image === window.PORT_ART?.stone_lantern
    )) return false;
    return drawStyledSceneryImage(ctx,image,x,y,w,h,alpha);
  }

  // Scenery uses one continuous actor path at EVERY angle (including 2D).
  // Contact shadows are painted on the floor before the upright sprites.
  function drawDecorActor(actor, viewerY = null) {
    const chunk = actor.torii, tree = actor.tree;
    const tilt = tiltK() || 1;
    const tiltFactor = clamp((1 - tilt) / 0.4, 0, 1);
    const atmosphericDepth = y => viewerY == null ? 0 :
      clamp((viewerY-y-290)/650,0,1)*tiltFactor*1.65;
    if (chunk) {
      const img=window.ART?.prop_torii;
      if (!img?.naturalWidth) return;
      const cx=chunk.x+chunk.w/2,cy=chunk.y+chunk.h/2,tw=150;
      const depthFactor = viewerY == null ? 1 : (1 + tiltFactor * (0.08 - clamp((viewerY - (cy + 36)) / 700, -0.3, 0.6) * 0.18));
      const th=Math.round(tw*(img.naturalHeight/img.naturalWidth)*depthFactor);
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
      const sw=114*factor;
      const depthFactor = viewerY == null ? 1 : (1 + tiltFactor * (0.08 - clamp((viewerY - tree.y) / 700, -0.3, 0.6) * 0.18));
      const sh=Math.round(sw*(img.naturalHeight/img.naturalWidth)*depthFactor);
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
  function tileImage(c, imgOrPick, left, top, right, bottom, scale = 1) {
    const pick = typeof imgOrPick === "function" ? imgOrPick : () => imgOrPick;
    const sample = pick(0, 0);
    if (!sample?.naturalWidth || !sample?.naturalHeight || right - left < 1 || bottom - top < 1) return;
    const tw = sample.naturalWidth * scale, th = sample.naturalHeight * scale;
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
      if (dx1 > dx0 && dy1 > dy0) {
        c.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, dx0, dy0, dx1 - dx0, dy1 - dy0);
        if (img && img.__s2KitId) kitNoteDraw(img.__s2KitId);   // counted only on a REAL paint
      }
    }
    c.restore();
  }
  // A single illustrated dirt texture fills Stage3; all stone steps are independent
  // transparent image decals, laid out in world coordinates (no geometric VFX art).
  const SAKURA_PATH_ROLES = Object.freeze([
    "stoneStraight", "stoneLeft", "stoneRight", "stoneBroken", "stoneSparse", "stoneMixed"
  ]);
  function sakuraPathHash(x, y) {
    let v = Math.imul((x | 0) ^ 0x9e3779b9, 0x85ebca6b);
    v ^= Math.imul((y | 0) ^ 0x7f4a7c15, 0xc2b2ae35);
    v = Math.imul(v ^ (v >>> 16), 0x7feb352d);
    return (v ^ (v >>> 15)) >>> 0;
  }
  function paintSakuraPathDecals(c, left, top, right, bottom) {
    const arts = window.SAKURA_ART || {};
    if (!SAKURA_PATH_ROLES.some(role => arts[role]?.naturalWidth)) return;
    const spanX = 900, spanY = 174;
    const c0 = Math.floor((left - 240) / spanX), c1 = Math.ceil((right + 240) / spanX);
    const y0 = Math.floor((top - 250) / spanY), y1 = Math.ceil((bottom + 250) / spanY);
    for (let lane = c0; lane <= c1; lane++) {
      for (let row = y0; row <= y1; row++) {
        const noise = sakuraPathHash(lane, row);
        const bend = Math.sin(row * 0.73 + lane * 0.46) * 56
          + Math.sin(row * 0.27 + lane * 1.31) * 31;
        const x = lane * spanX + 450 + bend;
        const y = row * spanY + 86 + ((noise >>> 16) % 35) - 17;
        // Natural broken/overgrown patches interrupt every long stone run.
        const preferred = ((noise >>> 5) % 11 < 3) ? 3 + (noise % 3) : noise % 3;
        const role = SAKURA_PATH_ROLES[preferred];
        const img = arts[role]?.naturalWidth ? arts[role]
          : SAKURA_PATH_ROLES.map(k => arts[k]).find(a => a?.naturalWidth);
        if (!img) continue;
        const width = 170 + ((noise >>> 11) % 25);
        const height = width * img.naturalHeight / img.naturalWidth;
        c.drawImage(img, x - width / 2, y - height / 2, width, height);
      }
    }
  }
  // S2 Nano Production Art: Direct loading of new Nano Banana 2.1 images from scene directory
  // The retained Stage2 1254px PNG originals are referenced only by local DEV comparison.
  const S2_NANO_PATHS = {
    stone: "art/stage2-rain-port/scene/g_stone_01.png",
    stoneVar1: "art/stage2-rain-port/scene/g_stone_02.png",
    wood: "art/stage2-rain-port/scene/g_wood_01.png",
    woodVar1: "art/stage2-rain-port/scene/g_wood_02.png",
    transH: "art/stage2-rain-port/scene/t_stone_wood_v01.png",
    transV: "art/stage2-rain-port/scene/t_stone_wood_v01.png",
    warehouse: "art/stage2-rain-port/scene/H_warehouse_01.png",
    fishmonger: "art/stage2-rain-port/scene/H_fishworkshop_01.png"
  };
  const S2_NANO_CACHE = {
    stone: null, stoneVar1: null, wood: null, woodVar1: null,
    transH: null, transV: null, warehouse: null, fishmonger: null,
    loaded: false, loadError: null
  };
  async function loadS2NanoAssets() {
    if (!window.isS2ArtProdEnabled?.() || S2_NANO_CACHE.loaded) return;
    const loadImg = (url) => new Promise(resolve => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => resolve({ img, ok: true, url });
      img.onerror = () => resolve({ img: null, ok: false, url });
      img.src = url + "?v=" + Date.now();
    });
    const results = await Promise.all(Object.entries(S2_NANO_PATHS).map(([k, url]) => loadImg(url).then(r => ({ key: k, ...r }))));
    let anyOk = false;
    for (const { key, img, ok, url } of results) {
      if (ok && img?.naturalWidth) {
        S2_NANO_CACHE[key] = img;
        anyOk = true;
        console.log(`[S2-NANO] Loaded ${key}: ${img.naturalWidth}x${img.naturalHeight} from ${url}`);
      } else {
        console.warn(`[S2-NANO] Failed to load ${key} from ${url}`);
      }
    }
    S2_NANO_CACHE.loaded = true;
    S2_NANO_CACHE.loadError = anyOk ? null : "NO_NANO_IMAGES_LOADED";
    if (!anyOk) console.error("[S2-NANO] No Nano images loaded successfully");
  }
  function getS2NanoStone() {
    if (!window.isS2ArtProdEnabled?.() || !S2_NANO_CACHE.loaded) return null;
    return S2_NANO_CACHE.stone?.naturalWidth ? S2_NANO_CACHE.stone : null;
  }
  function getS2NanoWood() {
    if (!window.isS2ArtProdEnabled?.() || !S2_NANO_CACHE.loaded) return null;
    return S2_NANO_CACHE.wood?.naturalWidth ? S2_NANO_CACHE.wood : null;
  }
  function getS2NanoTransH() {
    if (!window.isS2ArtProdEnabled?.() || !S2_NANO_CACHE.loaded) return null;
    return S2_NANO_CACHE.transH?.naturalWidth ? S2_NANO_CACHE.transH : null;
  }
  function getS2NanoTransV() {
    if (!window.isS2ArtProdEnabled?.() || !S2_NANO_CACHE.loaded) return null;
    return S2_NANO_CACHE.transV?.naturalWidth ? S2_NANO_CACHE.transV : null;
  }
  function getS2NanoWarehouse() {
    if (!window.isS2ArtProdEnabled?.() || !S2_NANO_CACHE.loaded) return null;
    return S2_NANO_CACHE.warehouse?.naturalWidth ? S2_NANO_CACHE.warehouse : null;
  }
  function getS2NanoFishmonger() {
    if (!window.isS2ArtProdEnabled?.() || !S2_NANO_CACHE.loaded) return null;
    return S2_NANO_CACHE.fishmonger?.naturalWidth ? S2_NANO_CACHE.fishmonger : null;
  }
  // S2 Production Art tile pickers (for rain-port when s2artprod=1)
  // Priority: new Nano images > manifest usable_runtime_tiles > legacy PORT_ART
  function s2StoneTilePick() {
    // Priority 1: New Nano stone (2048x2048, will be tiled at 512)
    // Use only AGY's 512px edge-locked candidate, not raw 2048px concept-sized output.
    // Priority 2: Manifest usable_runtime_tiles
    const tiles = window.getS2StoneTiles?.();
    if (!tiles?.length) return null;
    const baseTile = tiles.find(t => (t.id === "tile_stone_canonical" || t.id === "tile_stone_base") && t._loaded && t._img?.naturalWidth);
    if (baseTile) return () => baseTile._img;
    return null;
  }
  function s2WoodTilePick() {
    // Raw Nano wood is retained as evidence, never tiled directly.
    const tiles = window.getS2WoodTiles?.();
    if (!tiles?.length) return null;
    const baseTile = tiles.find(t => (t.id === "tile_wood_dock_canonical" || t.id === "tile_wood_dock_base") && t._loaded && t._img?.naturalWidth);
    if (baseTile) return () => baseTile._img;
    return null;
  }
  function s2TransitionHPick() {
    // Use true postprocessed shoreline transition only.
    const tiles = window.getS2TransitionsH?.();
    if (!tiles?.length) return null;
    const approved = tiles.find(t => t.id === "tile_trans_stone_wood_h_canonical" && t.provenance_type === "NANO_SOURCE" && t._loaded && t._img?.naturalWidth);
    if (approved) return () => approved._img;
    const refined = tiles.find(t => t.id === "tile_trans_stone_wood_h_refined" && t._loaded && t._img?.naturalWidth);
    if (refined) return () => refined._img;
    return null;
  }
  function s2TransitionVPick() {
    // Use true postprocessed canal transition only.
    const tiles = window.getS2TransitionsV?.();
    if (!tiles?.length) return null;
    const refined = tiles.find(t => t.id === "tile_trans_stone_wood_v_canonical" && t.provenance_type === "NANO_SOURCE" && t._loaded && t._img?.naturalWidth);
    if (refined) return () => refined._img;
    return null;
  }
  // ---------------------------------------------------------------------
  // S2 ground kit (DEV gate only: dev=1 & stage=rain-port & s2ground=kit)
  // The 4 stone / 3 wood candidates are mixed deterministically per WORLD TILE CELL,
  // so the same world point always shows the same candidate (no per-frame change, no
  // flicker across the terrain cache or left/right movement).
  // ---------------------------------------------------------------------
  const S2_GROUND_KIT_TILE_WORLD = 512;   // one kit candidate covers 512 world px
  function s2GroundKitEnabled() {
    return typeof window.isS2GroundKitEnabled === "function"
      ? !!window.isS2GroundKitEnabled()
      : !!window.S2_GROUND_KIT_ENABLED;
  }
  function kitHash2(x, y, salt) {
    let h = (Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x9e3779b1)) >>> 0;
    h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13;
    return h >>> 0;
  }
  // Real paint-call counter for the kit candidates. It is incremented ONLY right after a
  // successful c.drawImage of a kit image (the image carries __s2KitId). A pick or the
  // size sample inside tileImage() is NOT a paint and must never be counted.
  const S2_GROUND_KIT_DRAW_COUNTS = new Map();
  function kitNoteDraw(id) {
    if (!id) return;
    S2_GROUND_KIT_DRAW_COUNTS.set(id, (S2_GROUND_KIT_DRAW_COUNTS.get(id) || 0) + 1);
  }
  // Returns a tileImage-compatible picker(tx, ty) -> Image, or null when the kit is not usable.
  // The picker only SELECTS; the draw counter lives at the draw site.
  function s2KitVariantPick(list, salt) {
    const usable = (list || []).filter(t => t && t._loaded && t._img && t._img.naturalWidth);
    if (!usable.length) return null;
    return (tx, ty) => usable[kitHash2(tx, ty, salt) % usable.length]._img;
  }
  function s2KitScale() {
    const kit = window.getS2GroundKit?.();
    const img = kit?.stone?.[0]?._img || kit?.wood?.[0]?._img;
    const nat = img?.naturalWidth || 1254;
    return S2_GROUND_KIT_TILE_WORLD / nat;
  }
  // Dev-only readable evidence. NOTE the two lists are different things:
  //   loadedSources = decoded/available candidates (+ their placement decision)
  //   drawnSources  = candidates that were really painted (paint-call counter)
  // A loaded candidate with no legal placement stays in loadedSources only.
  function s2GroundKitDrawEvidence() {
    const kit = window.getS2GroundKit?.();
    const loaded = [];
    const drawn = [];
    const push = (t, group, role) => {
      if (!t || !t._loaded) return;
      const placement = window.S2_GROUND_KIT_PLACEMENT?.[t.id]?.state || null;
      loaded.push({
        id: t.id, group, role: role || null, placement,
        src: t._img?.currentSrc || t._img?.src || t.url,
        w: t.naturalWidth, h: t.naturalHeight
      });
      const count = S2_GROUND_KIT_DRAW_COUNTS.get(t.id) || 0;
      if (count > 0) drawn.push({ id: t.id, group, role: role || null, placement, drawCallCount: count, src: t._img?.currentSrc || t._img?.src || t.url });
    };
    if (kit) {
      for (const t of kit.stone || []) push(t, 'stone');
      for (const t of kit.wood || []) push(t, 'wood');
      for (const role of ['horizontal', 'diagonal', 'vertical']) push(kit.transitions?.[role], 'transition', role);
    }
    return {
      enabled: s2GroundKitEnabled(),
      loaded: !!kit,
      scale: s2KitScale(),
      loadedSources: loaded,
      drawnSources: drawn,
      notDrawn: loaded.filter(l => !drawn.some(d => d.id === l.id)).map(l => ({ id: l.id, placement: l.placement }))
    };
  }
  function invalidateGroundCache() {
    if (terrainState) { terrainState = null; groundCacheBuilds += 1; }
  }
  function resetS2GroundKitDrawCounts() { S2_GROUND_KIT_DRAW_COUNTS.clear(); }

  function portGroundPick(kind) {
    return () => {
      const art = window.PORT_ART || {};
      const surfaceCand = typeof window.isPortSurfaceCandidateEnabled === "function"
        ? window.isPortSurfaceCandidateEnabled()
        : !!window.PORT_SURFACE_CANDIDATE_ENABLED;
      const s2Enabled = typeof window.isS2ArtProdEnabled === "function" ? window.isS2ArtProdEnabled() : !!window.S2_ART_PROD_ENABLED;
      if (kind === "wood") {
        if (s2Enabled) {
          const woodPick = s2WoodTilePick();
          if (woodPick) return woodPick();
        }
        if (art.woodVar1?.naturalWidth) return art.woodVar1;
        return art.dock?.naturalWidth ? art.dock : null;
      }
      if (s2Enabled) {
        const stonePick = s2StoneTilePick();
        if (stonePick) return stonePick();
      }
      if (surfaceCand && art.stoneV3?.naturalWidth) {
        return art.stoneV3;
      }
      if (art.stoneVar1?.naturalWidth) return art.stoneVar1;
      return art.stone?.naturalWidth ? art.stone : null;
    };
  }
  window.portGroundPick = portGroundPick;
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
    const isCandidate = (img === window.PORT_ART?.stoneWoodTransition);
    const seamSy = isCandidate ? 80 : PORT_SEAM_SY;
    const seamSh = isCandidate ? 340 : PORT_SEAM_SH;
    const seamCenter = isCandidate ? 256 : PORT_SEAM_CENTER;

    const north = seamCenter - seamSy;
    const south = seamSy + seamSh - seamCenter;
    const bandTop = flipped ? seamY - south : seamY - north;
    const bandBottom = flipped ? seamY + north : seamY + south;
    const left = Math.max(region.left, chunk.x);
    const right = Math.min(region.left + region.width, chunk.x + chunk.w);
    const top = Math.max(region.top, bandTop);
    const bottom = Math.min(region.top + region.height, bandBottom);
    if (right - left < 1 || bottom - top < 1 || img.naturalHeight < seamSy + seamSh) return;
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
      if (dx1 > dx0 && dy1 > dy0) c.drawImage(img, 0, seamSy, tw, seamSh, dx0, dy0, dx1 - dx0, dy1 - dy0);
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

  function getPortBounds(chunks) {
    if (Array.isArray(chunks)) {
      const boundedChunk = chunks.find(c => c?.decor?.port?.bounds && typeof c.decor.port.bounds.minY === "number" && typeof c.decor.port.bounds.maxY === "number");
      if (boundedChunk) return boundedChunk.decor.port.bounds;
    }
    if (typeof window !== "undefined" && window.WORLD_STATE?.bounds && typeof window.WORLD_STATE.bounds.minY === "number" && typeof window.WORLD_STATE.bounds.maxY === "number") {
      return window.WORLD_STATE.bounds;
    }
    return null;
  }

  // ---------------------------------------------------------------------
  // Coast backdrop (impassable north / south bands of the rain port).
  // One real sea texture tiles the whole band on BOTH axes, world-anchored, so a band
  // taller than the texture and negative world coordinates stay fully covered
  // (no black strip, no stretching, no fake geometric sea).
  // ---------------------------------------------------------------------
  const S2_COAST_DRAWS = new Map();
  function coastNoteDraw(img) {
    if (!img) return;
    const key = img.currentSrc || img.src || "coast";
    S2_COAST_DRAWS.set(key, (S2_COAST_DRAWS.get(key) || 0) + 1);
  }
  function paintCoastSeaBand(c, img, left, top, right, bottom) {
    if (!img?.naturalWidth || right - left < 1 || bottom - top < 1) return false;
    const w = img.naturalWidth, h = img.naturalHeight;
    const x0 = Math.floor(left / w), x1 = Math.ceil(right / w);
    const y0 = Math.floor(top / h), y1 = Math.ceil(bottom / h);
    for (let ty = y0; ty < y1; ty++) {
      for (let tx = x0; tx < x1; tx++) {
        c.drawImage(img, tx * w, ty * h, w, h);
        coastNoteDraw(img);
      }
    }
    return true;
  }
  function s2CoastArt() {
    const kitOn = s2GroundKitEnabled();
    const art = window.PORT_ART || {};
    return {
      kitOn,
      // Kit gate prefers its own real sea tile; the legacy candidate sea stays the fallback.
      sea: (kitOn && art.coastSea?.naturalWidth) ? art.coastSea : (art.harborSea || null),
      // Bright RGBA rock with wave foam (kit only). The legacy north cliff is a near-black
      // silhouette and is never used as a kit backdrop.
      rock: (kitOn && art.coastCliff?.naturalWidth) ? art.coastCliff : null,
      legacyCliff: art.northCliff || null
    };
  }
  function s2CoastDrawEvidence() {
    const art = s2CoastArt();
    return {
      enabled: !!art.kitOn,
      sea: art.sea ? { src: art.sea.currentSrc || art.sea.src, w: art.sea.naturalWidth, h: art.sea.naturalHeight } : null,
      rock: art.rock ? { src: art.rock.currentSrc || art.rock.src, w: art.rock.naturalWidth, h: art.rock.naturalHeight } : null,
      draws: [...S2_COAST_DRAWS.entries()].map(([src, count]) => ({ src, count }))
    };
  }

  function paintPortBoundedTerrain(c, region, chunks, stoneTile, portBounds) {
    const { minY, maxY } = portBounds;
    const { left, top, width, height } = region;
    const woodTile = portGroundPick("wood")();
    const surfaceCand = typeof window.isPortSurfaceCandidateEnabled === "function"
      ? window.isPortSurfaceCandidateEnabled()
      : !!window.PORT_SURFACE_CANDIDATE_ENABLED;
    const s2Enabled = typeof window.isS2ArtProdEnabled === "function" ? window.isS2ArtProdEnabled() : !!window.S2_ART_PROD_ENABLED;
    // S2 ground kit (dev gate) takes over the ground bands when it is enabled and loaded.
    const kitEnabled = s2GroundKitEnabled();
    const kit = kitEnabled ? (window.getS2GroundKit?.() || null) : null;
    const kitStonePick = kit ? s2KitVariantPick(kit.stone, 0x5354) : null;
    const kitWoodPick = kit ? s2KitVariantPick(kit.wood, 0x5744) : null;
    const kitHorizontal = kit?.transitions?.horizontal && kit.transitions.horizontal._loaded
      ? kit.transitions.horizontal : null;
    // S2 Nano 512px 原稿鋪成 256 世界像素：單塊石板約角色半身，不是等身巨石。
    const tScale = kitEnabled ? s2KitScale() : (s2Enabled ? 0.5 : 1);
    // 512px approved mud/slab tile already matches first-stage world scale;
    // only the 1254px harbor docks should be scaled down to half size.
    const stoneScale = (s2Enabled && stoneTile?.naturalWidth <= 600 && !kitEnabled) ? 1 : tScale;
    const seamImg = (surfaceCand && window.PORT_ART?.stoneWoodTransition?.naturalWidth)
      ? window.PORT_ART.stoneWoodTransition
      : window.PORT_ART?.[PORT_V2_ROLE];
    // S2 transitions (horizontal for stone-wood seam, vertical for chunk boundaries)
    // For the ground kit the horizontal seam uses t_stone_wood_v01.png (OBSERVED horizontal:
    // stone top / wood bottom). t_stone_wood_h01 (diagonal) and t_stone_wood_c01 (vertical
    // straight) have no legal place in this world layout and are never drawn.
    const s2TransHPick = kitEnabled
      ? (kitHorizontal ? () => kitHorizontal._img : null)
      : (s2Enabled ? s2TransitionHPick() : null);
    const s2TransVPick = s2Enabled ? s2TransitionVPick() : null;
    const beltHeight = maxY - minY;
    const dockW = Math.min(220, Math.max(120, Math.round(beltHeight * 0.30)));
    const dockSeamY = maxY - dockW;

    // 預先以港口深暗夜色底填滿全區，確保北界 (y < minY) 與南界 (y > maxY) 絕不露舊石板
    c.fillStyle = "#080c1a";
    c.fillRect(left, top, width, height);

    const coast = s2CoastArt();
    // True once a REAL image already covers the north band. The per-chunk dark gradient is
    // only a last-resort fallback and must never repaint over artwork that is already there
    // (that overlay used to turn the north band back into flat #080c1a).
    let northBackdropCovered = false;

    // 0. 北側背景層 (y < minY)：真海面／山壁圖覆蓋整條可見北帶，消除大純黑帶與邊界硬切
    if (minY > top) {
      const nBottom = Math.min(top + height, minY);
      c.save();
      c.beginPath(); c.rect(left, top, width, nBottom - top); c.clip();
      const nGrad = c.createLinearGradient(0, nBottom, 0, top);
      nGrad.addColorStop(0, "#111827");
      nGrad.addColorStop(0.35, "#0b101e");
      nGrad.addColorStop(1, "#050711");
      c.fillStyle = nGrad;
      c.fillRect(left, top, width, nBottom - top);

      if (coast.kitOn) {
        // Kit gate: one real sea texture covers the whole north band (no black, no stretch).
        if (coast.sea?.naturalWidth) {
          northBackdropCovered = paintCoastSeaBand(c, coast.sea, left, top, left + width, nBottom);
        }
      } else if (surfaceCand) {
        // Legacy portsurfacecandidate path keeps its own cliff-first promise.
        const cliffImg = coast.legacyCliff;
        if (cliffImg?.naturalWidth) {
          const cliffW = cliffImg.naturalWidth;
          const cliffH = cliffImg.naturalHeight;
          const cliffY = minY - cliffH;
          const x0 = Math.floor(left / cliffW) * cliffW;
          const x1 = Math.ceil((left + width) / cliffW) * cliffW;
          for (let sx = x0; sx < x1; sx += cliffW) {
            c.drawImage(cliffImg, sx, cliffY, cliffW, cliffH);
          }
          northBackdropCovered = true;
        } else if (coast.sea?.naturalWidth) {
          northBackdropCovered = paintCoastSeaBand(c, coast.sea, left, top, left + width, nBottom);
        }
      }
      c.restore();
    }

    for (const chunk of chunks) {
      if (chunk.x > left + width || chunk.x + chunk.w < left || chunk.y > top + height || chunk.y + chunk.h < top) continue;

      const rl = Math.max(left, chunk.x);
      const rr = Math.min(left + width, chunk.x + chunk.w);
      if (rr <= rl) continue;

      // 1. 北側阻擋地面背景層 (y < minY)：只有真的沒有任何有效背景圖時才畫保底漸層，
      //    絕不可覆蓋已經畫好的海面／山壁圖（否則北帶又變回純黑）
      const nTop = Math.max(top, chunk.y);
      const nBottom = Math.min(top + height, chunk.y + chunk.h, minY);
      if (nBottom > nTop && !northBackdropCovered) {
        c.save();
        c.beginPath(); c.rect(rl, nTop, rr - rl, nBottom - nTop); c.clip();
        const nGrad = c.createLinearGradient(0, nBottom, 0, nTop);
        nGrad.addColorStop(0, "#111827");
        nGrad.addColorStop(0.35, "#0b101e");
        nGrad.addColorStop(1, "#050711");
        c.fillStyle = nGrad;
        c.fillRect(rl, nTop, rr - rl, nBottom - nTop);
        c.restore();
      }

      // 2. 中部石板 / 木棧道戰鬥帶 (minY <= y <= maxY)
      const mTop = Math.max(top, chunk.y, minY);
      const mBottom = Math.min(top + height, chunk.y + chunk.h, maxY);
      if (mBottom > mTop) {
        // 石板鋪面 (minY <= y < dockSeamY)
        const stoneTop = mTop;
        const stoneBottom = Math.min(mBottom, dockSeamY);
        const stoneSrc = kitStonePick || stoneTile;
        if (stoneBottom > stoneTop && stoneSrc) {
          c.save();
          c.beginPath(); c.rect(rl, stoneTop, rr - rl, stoneBottom - stoneTop); c.clip();
          // Painted once globally after the chunk loop to avoid vertical clip seams.

          // 消除地板直線切邊：於石板頂端 (minY) 鋪設柔和暗霧過渡，平滑融入北側山崖基座
// North edge gradient is applied globally below.
          c.restore();

          if (surfaceCand && window.PORT_ART?.stoneReflection?.naturalWidth) {
            // 稀疏局部點綴 (不全區密鋪，以 chunk.x 為基準在特定間隔提供一處微光反射水窪)
            const rx = chunk.x + 480;
            const ry = Math.round((stoneTop + stoneBottom) / 2);
            if (rx >= rl - 60 && rx <= rr + 60) {
              c.save();
              c.beginPath(); c.rect(rl, stoneTop, rr - rl, stoneBottom - stoneTop); c.clip();
              c.globalAlpha = 0.22;
              c.drawImage(window.PORT_ART.stoneReflection, 300, 300, 200, 100, rx - 60, ry - 30, 120, 60);
              c.restore();
            }
          }
        }

        // 木棧道鋪面 (dockSeamY <= y <= maxY)
        const woodTop = Math.max(mTop, dockSeamY);
        const woodBottom = mBottom;
        const woodSrc = kitWoodPick || woodTile;
        if (woodBottom > woodTop && woodSrc) {
          c.save();
          c.beginPath(); c.rect(rl, woodTop, rr - rl, woodBottom - woodTop); c.clip();
          // Painted once globally after the chunk loop to avoid vertical clip seams.
          c.restore();
        }
      }

      // 3. 南側海灣水面 (y > maxY) 且不當走路地板
      // 沿用既有夜色底，缺連續海圖列 WAITING_ART，不造假漸層/幾何波紋/程序木樁
      const sTop = Math.max(top, chunk.y, maxY);
      const sBottom = Math.min(top + height, chunk.y + chunk.h);
      if (sBottom > sTop) {
        c.save();
        c.beginPath(); c.rect(rl, sTop, rr - rl, sBottom - sTop); c.clip();
        c.fillStyle = "#080c1a";
        c.fillRect(rl, sTop, rr - rl, sBottom - sTop);

        const surfaceCand = typeof window.isPortSurfaceCandidateEnabled === "function"
          ? window.isPortSurfaceCandidateEnabled()
          : !!window.PORT_SURFACE_CANDIDATE_ENABLED;
        const seaImg = window.PORT_ART?.harborSea;
        if (surfaceCand && seaImg?.naturalWidth) {
          // 新海圖：只作為南側不可通行海背景，不作中央走地
          // 頂端對齊 maxY（木棧道岸沿），橫向自接延展，底端柔和融入夜色
          const seaW = seaImg.naturalWidth;
          const seaH = seaImg.naturalHeight;
          const x0 = Math.floor(rl / seaW) * seaW;
          const x1 = Math.ceil(rr / seaW) * seaW;
          for (let sx = x0; sx < x1; sx += seaW) {
            c.drawImage(seaImg, sx, maxY, seaW, seaH);
          }
        }
        c.restore();
      }
    }

    // Once, in a single WORLD-ALIGNED pass, paint the two continuous walkable
    // bands. Repeated per-chunk clipping exposed a 1px dark vertical boundary
    // (especially at non-integer camera/tilt scales). Same approved art/picker.
    const groundLeft = left, groundRight = left + width;
    const paintWholeBand = (tile, bandTop, bandBottom, scale = tScale) => {
      const y0 = Math.max(top, bandTop), y1 = Math.min(top + height, bandBottom);
      if (!tile || y1 <= y0) return;
      c.save();
      c.beginPath(); c.rect(groundLeft, y0, width, y1 - y0); c.clip();
      tileImage(c, tile, groundLeft, y0, groundRight, y1, scale);
      c.restore();
    };
    paintWholeBand(kitStonePick || stoneTile, minY, dockSeamY, stoneScale);
    paintWholeBand(kitWoodPick || woodTile, dockSeamY, maxY);
    // Draw the north edge only once as well; never once per chunk.
    if ((kitStonePick || stoneTile) && minY < top + height && minY + 28 > top) {
      c.save();
      const edgeH = 28;
      const edgeGrad = c.createLinearGradient(0, minY, 0, minY + edgeH);
      edgeGrad.addColorStop(0, "rgba(8, 12, 26, 0.78)");
      edgeGrad.addColorStop(0.4, "rgba(8, 12, 26, 0.35)");
      edgeGrad.addColorStop(1, "rgba(8, 12, 26, 0)");
      c.fillStyle = edgeGrad;
      c.fillRect(left, minY, width, edgeH);
      c.restore();
    }

    // 3b. 南側真海面 (y > maxY)：整條可見南帶以同一張真海圖鋪滿，不留純黑、不壓進中央戰鬥帶
    if (coast.kitOn && coast.sea?.naturalWidth && top + height > maxY) {
      const sStart = Math.max(top, maxY);
      c.save();
      c.beginPath(); c.rect(left, sStart, width, top + height - sStart); c.clip();
      paintCoastSeaBand(c, coast.sea, left, sStart, left + width, top + height);
      c.restore();
    }

    // Paint genuine Nano Banana coastal scenery in world coordinates (dev S2 only).
    if (s2Enabled) {
      const environment = window.getS2Environment?.() || [];
      const cliff = environment.find(e => e.id === "cliff_north_rock")?._img;
      const sea = environment.find(e => e.id === "surface_sea_canonical")?._img;
      if (sea?.naturalWidth && top < minY) {
        // 北側也是海：同一張真海面、同一世界格線連續鋪滿，崖岩作為獨立物件稀疏立在岸線，不平鋪成怪異色帶。
        const northEnd = Math.min(top + height, minY);
        c.save(); c.beginPath(); c.rect(left, top, width, northEnd - top); c.clip();
        tileImage(c, sea, left, top, left + width, northEnd);
        c.restore();
      }
      if (cliff?.naturalWidth && top < minY + 40) {
        const stride = 520, cw = 330, ch = Math.round(cw * cliff.naturalHeight / cliff.naturalWidth);
        const s0 = Math.floor((left - cw) / stride), s1 = Math.ceil((left + width + cw) / stride);
        for (let slot = s0; slot <= s1; slot++) {
          const hsh = ((slot * 2654435761) >>> 0) % 7;
          if (hsh === 3) continue; // 稀疏：約 1/7 空位
          const cx = slot * stride + 90 + hsh * 37;
          c.drawImage(cliff, cx - cw / 2, minY + 8 - ch, cw, ch);
        }
      }
      if (sea?.naturalWidth && top + height > maxY) {
        const southStart = Math.max(top, maxY);
        c.save(); c.beginPath(); c.rect(left, southStart, width, top + height - southStart); c.clip();
        tileImage(c, sea, left, southStart, left + width, top + height);
        c.restore();
      }
    }

    // 4. 石木接縫 (dockSeamY): 於整個可視區域橫向全域連續鋪設，避免按 chunk 裁切產生縱向斷裂補丁
    // Use S2 horizontal transitions if available, otherwise fall back to legacy seamImg
    if (s2TransHPick) {
      // Tile S2 horizontal transitions across the full visible width at dockSeamY
      const transTiles = kitEnabled
        ? (kitHorizontal ? [{ _img: kitHorizontal._img }] : [])
        : (window.getS2TransitionsH?.() || []);
      if (transTiles.length && dockSeamY >= top - 200 && dockSeamY <= top + height + 200) {
        // Use tileImage with the S2 transition picker
        const sample = transTiles[0]._img;
        if (sample?.naturalWidth) {
          const tw = sample.naturalWidth, th = sample.naturalHeight;
          const x0 = Math.floor((left - 120) / tw), x1 = Math.ceil((left + width + 240) / tw);
          const y0 = Math.floor((dockSeamY - th/2) / th), y1 = Math.ceil((dockSeamY + th/2) / th);
          // Read world-to-cache matrix BEFORE switching to pixel coordinates.
          // Resetting first drew the Nano seam at world x beyond the offscreen canvas.
          const xf = c.getTransform?.() || { a: 1, d: 1, e: 0, f: 0 };
          c.save();
          c.setTransform(1, 0, 0, 1, 0, 0);
          c.imageSmoothingEnabled = false;
          // 北石南木、過渡中心對齊 dockSeamY，8px strips fade at both edges.
          const bandH = 232, fadeH = 56, slice = 8;
          const syBase = Math.round(th / 2 - bandH / tScale / 2), srcSlice = slice / tScale;
          const twW = tw * tScale;
          const x0b = Math.floor((left - 120) / twW), x1b = Math.ceil((left + width + 240) / twW);
          for (let tx = x0b; tx < x1b; tx++) {
            const img = s2TransHPick(tx, 0);
            if (!img?.naturalWidth) continue;
            const dx0 = Math.round(tx * twW * (xf?.a || 1) + (xf?.e || 0)), dx1 = Math.round((tx + 1) * twW * (xf?.a || 1) + (xf?.e || 0));
            for (let off = 0; off < bandH; off += slice) {
              const edge = Math.min(off + slice, bandH - off);
              const alpha = Math.min(1, edge / fadeH);
              const wy0 = dockSeamY - bandH / 2 + off;
              const dy0 = Math.round(wy0 * (xf?.d || 1) + (xf?.f || 0));
              const dy1 = Math.round((wy0 + slice) * (xf?.d || 1) + (xf?.f || 0));
              if (dx1 > dx0 && dy1 > dy0) {
                c.globalAlpha = alpha;
                c.drawImage(img, 0, syBase + (off / slice) * srcSlice, img.naturalWidth, srcSlice, dx0, dy0, dx1 - dx0, dy1 - dy0);
                if (img && img.__s2KitId) kitNoteDraw(img.__s2KitId);   // counted only on a REAL paint
              }
            }
          }
          c.globalAlpha = 1;
          c.restore();
        }
      }
    } else if (!s2Enabled && seamImg?.naturalWidth && dockSeamY >= top - 200 && dockSeamY <= top + height + 200) {
      paintPortTransitionSeam(c, seamImg, { x: left - 120, w: width + 240 }, region, dockSeamY, false);
    }
  }

  // S2 Production Art: Render buildings and props from AGY asset manifest
  // Expected manifest structure (v1.3.0-nano):
  // buildings: [{ id, path_webp, width, height, footAnchor: {x, y}, displaySize, status, x: null, y: null, _img, _loaded }]
  // props: [{ id, path_webp, width, height, footAnchor: {x, y}, displaySize, status, x: null, y: null, _img, _loaded }]
  // environment: [{ id, path_webp, width, height, footAnchor?, _img, _loaded }]
  function drawS2BuildingsAndProps(c, chunks, viewLeft, viewRight, minY, maxY, elapsed, motion) {
    const buildings = window.getS2Buildings?.() || [];
    const props = window.getS2Props?.() || [];
    const environment = window.getS2Environment?.() || [];
    if (!buildings.length && !props.length) return;

    const tilt = tiltK() || 1;
    const tiltFactor = clamp((1 - tilt) / 0.4, 0, 1);

    // Helper to draw a building with proper upright and shadow
    const drawBuilding = (img, bx, by, displayW, footAnchorY) => {
      if (!img?.naturalWidth) return;
      const aspect = img.naturalHeight / img.naturalWidth;
      const bh = Math.round(displayW * aspect * (1 + tiltFactor * 0.06));
      // Contact shadow
      c.save();
      c.fillStyle = "rgba(12, 16, 22, 0.44)";
      c.beginPath();
      c.ellipse(bx, by, displayW > 100 ? 72 : 22, displayW > 100 ? 15 : 8, 0, 0, 6.283);
      c.fill();
      c.restore();
      const paintBuilding = () => {
        c.drawImage(img, bx - displayW / 2, by - bh, displayW, bh);
      };
      if (window.VIEWPORT?.upright) window.VIEWPORT.upright(c, bx, by, paintBuilding);
      else paintBuilding();
    };

    // Buildings are now drawn by drawHouse (anchored to the world quiz houses, Ysorted with actors),
    // so the free-floating sparse pass is disabled to avoid duplicate/misaligned buildings.
    const visibleWidth = viewRight - viewLeft;
    if (false && buildings.length && visibleWidth > 0) {
      const stride = 440;
      const from = Math.floor((viewLeft - 300) / stride);
      const to = Math.ceil((viewRight + 300) / stride);
      for (let slot = from; slot <= to; slot++) {
        const index = ((slot % buildings.length) + buildings.length) % buildings.length;
        const bld = buildings[index];
        if (!bld?._loaded || !bld._img?.naturalWidth) continue;
        const stagger = ((slot % 3) + 3) % 3;
        const bx = slot * stride + 190 + stagger * 17;
        const by = minY + 150 + stagger * 13;
        const displayW = Math.min(235, Math.max(178, bld.displaySize?.width ?? bld.width ?? 200));
        drawBuilding(bld._img, bx, by, displayW, by);
      }
    }

    // Render props (south side, near maxY and beyond) - distribute along dock/sea edge
    // 過濾掉石燈籠/提燈/灯籠/beacon/stone_lantern/toro/lighthouse 等關鍵字；僅保留碼頭貨堆/船錨/繫船柱/船燈
    const validProps = props.filter(p => !/lantern|lamp|toro|beacon|stone_lantern|lighthouse/i.test(p.id || ""));
    if (validProps.length > 0) {
      const stride = 285;
      const first = Math.floor((viewLeft - 170) / stride);
      const last = Math.ceil((viewRight + 170) / stride);
      for (let slot = first; slot <= last; slot++) {
        const index = ((slot % validProps.length) + validProps.length) % validProps.length;
        const prop = validProps[index];
        if (!prop?._loaded || !prop._img?.naturalWidth) continue;
        const px = slot * stride + 105;
        const isBoat = /boat/.test(prop.id || "");
        const py = isBoat ? maxY + 5 : maxY - 100 + (((slot % 3) + 3) % 3) * 16;
        const pw = isBoat ? 124 : Math.min(76, Math.max(42, prop.displaySize?.width ?? prop.width ?? 50));

        // Contact shadow
        c.save();
        c.fillStyle = "rgba(10, 14, 18, 0.45)";
        c.beginPath();
        c.ellipse(px, py + 2, pw * 0.4, 5, 0, 0, 6.283);
        c.fill();
        c.restore();

        const paintProp = () => {
          const img = prop._img;
          const ph = pw * img.naturalHeight / img.naturalWidth;
          c.drawImage(img, px - pw / 2, py - ph + 4, pw, ph);
        };

        if (window.VIEWPORT?.upright) window.VIEWPORT.upright(c, px, py, paintProp);
        else paintProp();
      }
    }
  }

  function drawPortSceneLayers(elapsed, chunks, portBounds) {
    if (!portBounds || !Array.isArray(chunks)) return;
    const { minY, maxY } = portBounds;
    const area = window.VIEWPORT?.worldBoundsAtZoom?.(Math.min(1, window.VIEWPORT?.worldZoom?.() ?? 1)) || worldBounds();
    const left = camX + area.left - 240;
    const right = camX + area.left + area.width + 240;
    const motion = allowsMotion();
    const s2Enabled = typeof window.isS2ArtProdEnabled === "function" ? window.isS2ArtProdEnabled() : !!window.S2_ART_PROD_ENABLED;

    // If S2 production art is enabled, render S2 buildings and props instead of legacy hardcoded items
    if (s2Enabled) {
      drawS2BuildingsAndProps(ctx, chunks, left, right, minY, maxY, elapsed, motion);
      return;
    }

    // DEV kit gate (dev=1 & stage=rain-port & s2ground=kit): a real RGBA cliff rock with wave
    // foam stands on the north shoreline. Sparse (one per chunk), drawn behind the north props,
    // never a repeating floor and never inside the walkable belt (minY <= y <= maxY).
    const kitCoast = s2CoastArt();
    if (kitCoast.kitOn && kitCoast.rock?.naturalWidth) {
      const rockImg = kitCoast.rock;
      const rw = 300;
      const rh = Math.round(rw * rockImg.naturalHeight / rockImg.naturalWidth);
      for (const chunk of chunks) {
        if (chunk.x + chunk.w < left || chunk.x > right) continue;
        const rx = chunk.x + 700;
        const ry = minY + 12;
        const paintRock = () => {
          ctx.drawImage(rockImg, rx - rw / 2, ry - rh, rw, rh);
          coastNoteDraw(rockImg);
        };
        if (window.VIEWPORT?.upright) window.VIEWPORT.upright(ctx, rx, ry, paintRock);
        else paintRock();
      }
    }

    for (const chunk of chunks) {
      if (chunk.x + chunk.w < left || chunk.x > right) continue;

      // A. 北側阻擋背景層：沿現核准 A/B 與既有港景錯落遠近疏密，消掉整排一字排開與單調重複
      const chunkIdx = Math.floor(chunk.x / 1024);
      const isAltChunk = (chunkIdx % 2 !== 0);
      const northItems = isAltChunk ? [
        { kind: "fishmonger", offset: 120, w: 201, footY: minY + 6 },
        { kind: "crate", offset: 260, w: 60, footY: minY + 2 },
        { kind: "anchor", offset: 315, w: 44, footY: minY },
        { kind: "crate", offset: 460, w: 68, footY: minY - 10 },
        { kind: "warehouse", offset: 640, w: 187, footY: minY - 24 },
        { kind: "crate", offset: 790, w: 56, footY: minY + 2 },
        { kind: "anchor", offset: 870, w: 46, footY: minY + 4 }
      ] : [
        { kind: "warehouse", offset: 130, w: 187, footY: minY - 22 },
        { kind: "crate", offset: 270, w: 64, footY: minY - 6 },
        { kind: "crate", offset: 420, w: 54, footY: minY + 2 },
        { kind: "fishmonger", offset: 590, w: 201, footY: minY + 8 },
        { kind: "anchor", offset: 740, w: 45, footY: minY + 4 },
        { kind: "crate", offset: 850, w: 66, footY: minY + 2 }
      ];

      for (const item of northItems) {
        const itemX = chunk.x + item.offset;
        if (itemX < left - 120 || itemX > right + 120) continue;
        let img = window.PORT_ART?.[item.kind];
        if (item.kind === "warehouse" && window.PORT_ART?.weatheredWarehouse?.naturalWidth) {
          img = window.PORT_ART.weatheredWarehouse;
        } else if (item.kind === "fishmonger" && window.PORT_ART?.fishWorkshop?.naturalWidth) {
          img = window.PORT_ART.fishWorkshop;
        }

        ctx.save();
        ctx.fillStyle = "rgba(12, 16, 22, 0.44)";
        ctx.beginPath();
        const wide = item.kind === "warehouse" || item.kind === "fishmonger";
        ctx.ellipse(itemX, item.footY, wide ? 72 : 22, wide ? 15 : 8, 0, 0, 6.283);
        ctx.fill();
        ctx.restore();

        const paintNorthItem = () => {
          if (img?.naturalWidth) {
            const candidateSourceRect = (img === window.PORT_ART?.weatheredWarehouse)
              ? { sx: 13, sy: 130, sw: 1227, sh: 1019 }
              : (img === window.PORT_ART?.fishWorkshop)
              ? { sx: 17, sy: 181, sw: 1221, sh: 923 }
              : null;
            const aspect = candidateSourceRect
              ? (candidateSourceRect.sh / candidateSourceRect.sw)
              : (img.naturalHeight / img.naturalWidth);
            const tilt = tiltK() || 1;
            const tiltFactor = clamp((1 - tilt) / 0.4, 0, 1);
            const bh = Math.round(item.w * aspect * (1 + tiltFactor * 0.06));
            if (candidateSourceRect) {
              ctx.drawImage(img, candidateSourceRect.sx, candidateSourceRect.sy, candidateSourceRect.sw, candidateSourceRect.sh,
                itemX - item.w / 2, item.footY - bh, item.w, bh);
            } else {
              ctx.drawImage(img, itemX - item.w / 2, item.footY - bh, item.w, bh);
            }
          }
          if (item.glow) {
            ctx.save();
            const beaconGrad = ctx.createRadialGradient(itemX, item.footY - 50, 4, itemX, item.footY - 50, 56);
            beaconGrad.addColorStop(0, "rgba(255, 190, 90, 0.30)");
            beaconGrad.addColorStop(0.5, "rgba(255, 160, 60, 0.12)");
            beaconGrad.addColorStop(1, "rgba(255, 140, 40, 0)");
            ctx.fillStyle = beaconGrad;
            ctx.beginPath();
            ctx.arc(itemX, item.footY - 50, 56, 0, 6.283);
            ctx.fill();
            ctx.restore();
          }
        };

        if (window.VIEWPORT?.upright) window.VIEWPORT.upright(ctx, itemX, item.footY, paintNorthItem);
        else paintNorthItem();
      }

      // B. 南側碼頭護欄、繫船柱與海灣船隻 (y >= maxY)
      // B. 南側碼頭繫船柱、箱網錨具與海灣船隻 (y >= maxY)
      // 使用現有 PORT_ART 真圖（mooring, crate, anchor, boat, ripple），不繪製幾何護欄線條
      const southProps = [
        { kind: "mooring", offset: 70, w: 34, y: maxY },
        { kind: "mooring", offset: 220, w: 34, y: maxY },
        { kind: "crate", offset: 370, w: 68, y: maxY },
        { kind: "mooring", offset: 520, w: 34, y: maxY },
        { kind: "anchor", offset: 670, w: 48, y: maxY },
        { kind: "mooring", offset: 820, w: 34, y: maxY }
      ];

      for (const sp of southProps) {
        const px = chunk.x + sp.offset;
        if (px < left - 40 || px > right + 40) continue;
        const img = window.PORT_ART?.[sp.kind];

        ctx.save();
        ctx.fillStyle = "rgba(10, 14, 18, 0.45)";
        ctx.beginPath();
        ctx.ellipse(px, sp.y + 2, sp.w * 0.4, 5, 0, 0, 6.283);
        ctx.fill();
        ctx.restore();

        const paintSouthProp = () => {
          if (img?.naturalWidth) {
            const ph = sp.w * img.naturalHeight / img.naturalWidth;
            ctx.drawImage(img, px - sp.w / 2, sp.y - ph + 4, sp.w, ph);
          }
        };
        if (window.VIEWPORT?.upright) window.VIEWPORT.upright(ctx, px, sp.y, paintSouthProp);
        else paintSouthProp();
      }

      const boatImg = window.PORT_ART?.boat;
      const bx = chunk.x + 300;
      const by = maxY + 85;
      if (bx >= left - 120 && bx <= right + 120 && boatImg?.naturalWidth) {
        const bobY = motion ? Math.sin(elapsed * 1.5 + chunk.x * 0.01) * 3.5 : 0;
        const bobRot = motion ? Math.sin(elapsed * 1.2 + chunk.x * 0.01) * 0.025 : 0;

        // 水中船隻柔邊接觸陰影
        ctx.save();
        ctx.fillStyle = "rgba(4, 10, 16, 0.55)";
        ctx.beginPath();
        ctx.ellipse(bx, by + 12 + bobY, 62, 16, 0, 0, 6.283);
        ctx.fill();
        ctx.restore();

        const paintBoat = () => {
          ctx.save();
          ctx.translate(bx, by + bobY);
          ctx.rotate(bobRot);
          const bw = 126;
          const bh = bw * boatImg.naturalHeight / boatImg.naturalWidth;
          ctx.drawImage(boatImg, -bw / 2, -bh * 0.8, bw, bh);
          ctx.restore();
        };
        if (window.VIEWPORT?.upright) window.VIEWPORT.upright(ctx, bx, by, paintBoat);
        else paintBoat();
      }

      const rippleImg = window.PORT_ART?.ripple;
      if (rippleImg?.naturalWidth && motion) {
        ctx.save();
        // 海面特有漣漪（嚴格僅 y > maxY 海面，不侵入陸地石板或碼頭）
        for (let r = 0; r < 4; r++) {
          const rx = chunk.x + 110 + r * 220;
          const ry = maxY + 35 + ((r * 37) % 85);
          const rPhase = ((elapsed * 0.65 + r * 0.28 + chunk.x * 0.003) % 1);
          const rSize = 20 + rPhase * 32;
          ctx.globalAlpha = (1 - rPhase) * 0.40;
          ctx.drawImage(rippleImg, rx - rSize / 2, ry - rSize * 0.24, rSize, rSize * 0.48);
        }
        ctx.restore();
      }
    }
  }

  // Stage8 preview: render ONLY clean isolated props as sparse overlays on approved fallback ground
  // DEV-ONLY: only runs when window.STAGE8_PREVIEW_ENABLED === true
  // Source: irregular 1448x1086 sprite sheet -> 357 connected components -> 47 clean isolated props
  // Ground tiles and path tiles DISABLED (were rectangular artifacts with pale soil borders)
  // Props: genuinely isolated flower stalks, bone fragments, rocks with transparent borders
  // Respects pseudo-2.5D tilt=0.60 and Stage1 micro-chibi proportion
  function renderStage8PreviewOverlays(c, left, top, width, height, chunks) {
    const keys = window.STAGE8_PREVIEW_KEYS;
    if (!keys) return;

    // Load ONLY clean props - ground tiles and path tiles are DISABLED
    const props = keys.props?.map(k => window.ART?.[k]).filter(Boolean) || [];

    if (props.length === 0) {
      return; // No assets loaded yet
    }

    const tilt = 0.60;

    // Scatter clean props (flower stalks, bone fragments, rocks) very sparsely
    // Lower density: ~1 prop per 2-3 chunks, micro-chibi scale
    for (const chunk of chunks) {
      if (chunk.x > left + width || chunk.x + chunk.w < left ||
          chunk.y > top + height || chunk.y + chunk.h < top) continue;

      // Deterministic: ~33% of chunks get a prop (lower density)
      const seed = Math.imul(chunk.x, 73856093) ^ Math.imul(chunk.y, 19349663);
      if ((seed % 3) !== 0) continue; // Only 1/3 of chunks

      const propSeed = Math.imul(chunk.x * 12345, 73856093) ^ Math.imul(chunk.y * 67890, 19349663);
      const px = chunk.x + (propSeed % 1000) / 1000 * chunk.w;
      const py = chunk.y + ((propSeed >> 10) % 1000) / 1000 * chunk.h;
      const propIdx = (propSeed >> 20) % props.length;
      const prop = props[propIdx];
      if (!prop || !prop.naturalWidth) continue;

      // Scale for micro-chibi proportion (Stage1 reference: small decor)
      // Target: ~60-100px max dimension (smaller than before)
      const maxDim = Math.max(prop.naturalWidth, prop.naturalHeight);
      const targetSize = 60 + (propSeed % 100) / 100 * 40; // 60-100px
      const scale = targetSize / maxDim;
      const dw = prop.naturalWidth * scale;
      const dh = prop.naturalHeight * scale;
      const drawX = px - dw / 2;
      const drawY = py - dh * (1 - tilt * 0.3); // Apply pseudo-2.5D tilt
      c.drawImage(prop, drawX, drawY, dw, dh);
    }
  }

  function paintTerrainRegion(c,region,chunks,groundKey,groundImg,toriiImg,toriiReady,sakuraImg,sakuraReady,stageId){
    const {left,top,width,height}=region;
    c.save();c.beginPath();c.rect(left,top,width,height);c.clip();
    // 1024 原稿仍建對齊用 atlas（驗收讀 putImageData）。畫面上只貼原圖，不抽 512 變體。
    if (stageId !== "rain-port") {
      const surface = stageId === "sakura-pass"
        ? (window.SAKURA_ART?.dirt?.naturalWidth ? window.SAKURA_ART.dirt : groundImg)
        : groundImg;
      if (surface && surface.naturalWidth === 1024 && surface.naturalHeight === 1024) groundAtlasFor(surface);
      tileImage(c, surface, left, top, left + width, top + height);
    }
    if (stageId === "rain-port") {
      const stoneTile = portGroundPick("stone")();
      const portBounds = getPortBounds(chunks);
      if (portBounds) {
        paintPortBoundedTerrain(c, region, chunks, stoneTile, portBounds);
      } else {
        c.fillStyle = "#080c1a";
        c.fillRect(left, top, width, height);
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
    }
    if (stageId === "sakura-pass") {
      paintSakuraPathDecals(c, left, top, left + width, top + height);
    }
    // Stage8 preview: overlay extracted items on approved fallback ground (DEV-ONLY, ?dev=1&stage8preview=1)
    // Source: irregular 1448x1086 sprite sheet -> pre-extracted items in art/stage8-yomi/sliced/
    // NON-SEAMLESS: items composed as overlays on approved ground, no fabricated tiling
    if (stageId === "yomi" && window.STAGE8_PREVIEW_ENABLED) {
      renderStage8PreviewOverlays(c, left, top, width, height, chunks);
    }
    c.restore();
  }

  function drawGroundBase(chunks, groundKey, stageId = "") {
    const v = window.VIEWPORT?.get() || {scale:1};
    const area = window.VIEWPORT?.worldBoundsAtZoom?.(Math.min(1, window.VIEWPORT?.worldZoom?.() ?? 1)) || worldBounds();
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
    const portBounds = stageId === "rain-port" ? getPortBounds(chunks) : null;
    const boundsStamp = portBounds ? `${portBounds.minY},${portBounds.maxY}` : "";
    const surfaceCand = typeof window.isPortSurfaceCandidateEnabled === "function"
      ? window.isPortSurfaceCandidateEnabled()
      : !!window.PORT_SURFACE_CANDIDATE_ENABLED;
    const portCandidateRoles = surfaceCand
      ? ["stoneV3", "harborSea", "stoneWoodTransition", "stoneReflection", "northCliff"]
      : [];
    // Coast kit images arrive async: keep them in the cache signature so the port terrain
    // rebuilds as soon as the real sea / cliff artwork exists (no stale dark bands).
    const kitCoastRoles = window.isS2GroundKitEnabled?.() ? ["coastSea", "coastCliff"] : [];
    const portRoles = ["stone", "dock", "stoneVar1", "woodVar1", "stoneWoodV2", ...portCandidateRoles, ...kitCoastRoles];
    // Async S2 assets arrive after the first ground frame; include their image readiness
    // in the terrain-cache signature so we never keep showing legacy tiles indefinitely.
    const s2Tiles = window.S2_ART_PROD_CACHE?.tiles;
    // S2 ground kit readiness (dev gate): the terrain cache must rebuild once the async kit
    // candidates exist, otherwise the page would keep showing the legacy fallback tiles.
    const kitStamp = window.isS2GroundKitEnabled?.() ? [
      window.S2_GROUND_KIT_CACHE?.loaded ? "loaded" : "pending",
      ...(window.S2_GROUND_KIT_CACHE?.items || []).map(t => `${t?.id}:${t?._img?.currentSrc || t?._img?.src || ""}:${t?._img?.naturalWidth || 0}`)
    ].join("|") : "";
    const s2Stamp = window.isS2ArtProdEnabled?.() ? [
      window.S2_ART_PROD_CACHE?.loaded ? "loaded" : "pending",
      ...(s2Tiles?.stoneVariants || []),
      ...(s2Tiles?.woodVariants || []),
      ...(s2Tiles?.transitions?.h || []),
      ...(s2Tiles?.transitions?.v || [])
    ].map(t => typeof t === "string" ? t : `${t?.id}:${t?._img?.currentSrc || t?._img?.src || ""}:${t?._img?.naturalWidth || 0}`).join("|") : "";
    const portStamp = stageId === "rain-port"
      ? `cand:${surfaceCand ? 1 : 0}|` + portRoles.map(role => {
          const img = window.PORT_ART?.[role];
          return `${role}:${img?.currentSrc || img?.src || ""}:${img?.naturalWidth || 0}x${img?.naturalHeight || 0}`;
        }).join("|") + `|bounds:${boundsStamp}|s2:${s2Stamp}|kit:${kitStamp}`
      : "";
    const sakuraStamp = stageId === "sakura-pass"
      ? ["dirt", ...SAKURA_PATH_ROLES].map(role => {
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
        c.fillStyle = stageId === "night-town" || !stageId ? "#0e111a" : "#111420";
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
    if (stageId === "rain-port") {
      const portBounds = getPortBounds(chunks);
      if (portBounds) {
        drawPortSceneLayers(elapsed, chunks, portBounds);
      }
    }
  }
  function drawPortProp(p, viewerY = null) {
    // 雨港嚴禁石燈籠/提燈/灯籠/beacon/stone_lantern/toro 等關鍵字道具；僅保留碼頭貨堆/船錨/繫船柱/船燈
    if (/lantern|lamp|toro|beacon|stone_lantern/i.test(p.kind)) return;
    if (p.kind === "mooring") {
      const portBounds = getPortBounds(window.WORLD_STATE?.chunks);
      if (portBounds && p.y < portBounds.maxY - 40) return;
    }
    let img = window.PORT_ART?.[p.kind];
    if (p.kind === "warehouse" && window.PORT_ART?.weatheredWarehouse?.naturalWidth) {
      img = window.PORT_ART.weatheredWarehouse;
    } else if (p.kind === "fishmonger" && window.PORT_ART?.fishWorkshop?.naturalWidth) {
      img = window.PORT_ART.fishWorkshop;
    }
    const wide = p.kind === "warehouse" || p.kind === "fishmonger" || p.kind === "boat";
    ctx.save();
    ctx.fillStyle = "rgba(10,14,18,0.38)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, wide ? 40 : 16, wide ? 11 : 6, 0, 0, 6.28);
    ctx.fill();
    ctx.restore();
    const paint = () => {
      if (!img?.naturalWidth) return;
      const w = p.kind === "warehouse" || p.kind === "fishmonger" ? 210 : p.kind === "boat" ? 118 : 70;
      const candidateSourceRect = (img === window.PORT_ART?.weatheredWarehouse)
        ? { sx: 13, sy: 130, sw: 1227, sh: 1019 }
        : (img === window.PORT_ART?.fishWorkshop)
        ? { sx: 17, sy: 181, sw: 1221, sh: 923 }
        : null;
      const aspect = candidateSourceRect
        ? (candidateSourceRect.sh / candidateSourceRect.sw)
        : (img.naturalHeight / img.naturalWidth);
      const h = Math.round(w * aspect);
      if (candidateSourceRect) {
        ctx.drawImage(img, candidateSourceRect.sx, candidateSourceRect.sy, candidateSourceRect.sw, candidateSourceRect.sh,
          p.x - w / 2, p.y - h, w, h);
      } else {
        ctx.drawImage(img, p.x - w / 2, p.y - h, w, h);
      }
    };
    if (window.VIEWPORT?.upright) window.VIEWPORT.upright(ctx, p.x, p.y, paint);
    else paint();
  }

  // All ground-contact shadows are rendered BEFORE the upright projection.
  // Their height is flattened by the world camera's current tilt, continuously.
  function drawLampShadow(l) {
    // 雨港無石燈籠/提燈/灯籠，直接返回
    if (currentStageId() === "rain-port") return;
    ctx.save();ctx.fillStyle="rgba(17,14,17,0.42)";
    ctx.beginPath();ctx.ellipse(l.x,l.y+8,16,6,0,0,6.28);ctx.fill();
    ctx.restore();
  }
  function drawHouseShadow(h) {
    // Subtle contact shadow only - no large floating ellipse.
    // Keep material's baked-in shadows; add only a thin grounding line at building base.
    const bw = h.bType === "port_fishmonger" ? 201 : h.bType === "port_warehouse" ? 187 : h.bType === "house_tavern" ? 175 : h.bType === "house_shrine" ? 158 : h.bType === "house_shop" ? 166 : 0;
    if (bw === 0) return;
    const rx = Math.round(bw * 0.35);
    const ry = 6;
    ctx.save();
    ctx.fillStyle = "rgba(16, 14, 17, 0.18)";
    ctx.beginPath();
    ctx.ellipse(h.x, h.y + 48, rx, ry, 0, 0, 6.283);
    ctx.fill();
    ctx.restore();
  }
  function drawPlayerShadow(P, elapsed, moveDir = {x:0,y:0}, moveSpeed = 230) {
    const moving=Math.hypot(moveDir.x||0,moveDir.y||0)>0.1 && allowsMotion();
    const speedScale = Math.max(0.8, Math.min(2.0, (moveSpeed || 230) / 230));
    const strideFreq = 12 * speedScale;
    const bob=moving?Math.abs(Math.sin(elapsed*strideFreq))*1.5:0;
    const spritecook = !!window.SPRITECOOK_DEV?.ready?.(moving ? "run" : "idle");
    const size=spritecook ? 1 : 1-bob/18;
    ctx.save();ctx.fillStyle=spritecook ? "rgba(0,0,0,0.32)" : "rgba(0,0,0,0.39)";
    ctx.beginPath();ctx.ellipse(P.x,P.y+(spritecook?2:22),spritecook?22:28*size,spritecook?7:11*size,0,0,6.28);ctx.fill();
    ctx.restore();
  }
  function drawMonsterShadow(e) {
    const radius=e.type==="boss"?52:e.type==="mis"?32:22;
    ctx.save();ctx.fillStyle="rgba(32,26,31,0.33)";
    ctx.beginPath();ctx.ellipse(e.x,e.y+radius*0.85,radius,radius*0.4,0,0,6.28);ctx.fill();
    ctx.restore();
  }

  // Third-stage optional illustrated props are depth-sorted like actors.
  function drawSakuraProp(prop, viewerY = null) {
    const img = window.SAKURA_ART?.[prop.kind];
    if (!img?.naturalWidth) return;
    const widths = {stoneLantern: 55, torii: 142, fence: 118, marker: 60, mossRocks: 98};
    const bw = widths[prop.kind] || 84;
    const depth = sceneryDepth(prop.y, viewerY);
    const w = bw * depth.scale;
    const h = w * (img.naturalHeight / img.naturalWidth);
    ctx.save();
    ctx.fillStyle = "rgba(25,21,18,0.24)";
    ctx.beginPath();ctx.ellipse(prop.x, prop.y, w * 0.24, 9, 0, 0, 6.28);ctx.fill();
    ctx.restore();
    window.VIEWPORT?.upright?.(ctx, prop.x, prop.y, () => {
      drawStyledSceneryImage(ctx, img, prop.x - w / 2, prop.y - h, w, h, 1, prop.kind, depth.blur);
    });
  }

  // 繪製高精緻度日式町屋店鋪（真實店鋪 Sprite + 障子金光 + 和風招牌）
  function drawHouse(h, viewerY = null) {
    ctx.save();
    if (h.bType === "shrine_pavilion" || h.bType?.startsWith("s3_")) {
      const variants = {
        shrine_pavilion: ["pavilion", "神社"],
        s3_tea_house: ["teaHouse", "山道茶屋"],
        s3_mountain_house: ["mountainHouse", "山宿"],
        s3_storehouse: ["storehouse", "山倉"],
        s3_worship_hall: ["worshipHall", "拜殿"]
      };
      const [role, title] = variants[h.bType] || variants.shrine_pavilion;
      const img = window.SAKURA_ART?.[role]?.naturalWidth
        ? window.SAKURA_ART[role] : window.SAKURA_ART?.pavilion;
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
        const top = (h.y + 48) - bh;
        drawStyledSceneryImage(ctx, img, h.x - bw / 2, top, bw, bh, 1, h.bType, depth.blur);
        ctx.fillStyle = "#e3d0a8";
        ctx.strokeStyle = "#e3d0a8";
        ctx.lineWidth = 0.7;
        ctx.strokeText(title, h.x, signY + 23, 124);
        ctx.fillText(title, h.x, signY + 23, 124);
      } else {
        ctx.fillStyle = "#e3d0a8";
        ctx.fillText(title + "（候選圖待匯入）", h.x, signY + 23, 180);
      }
      ctx.restore();
      return;
    }

    // 2. 新圖依實際透明裁切後的比例單獨定寬；腳底仍以 h.y+48 作為排序點。
    const portRole = h.bType === "port_fishmonger" ? "fishmonger" : h.bType === "port_warehouse" ? "warehouse" : "";
    let houseSprite = null;
    let isFishWorkshop = false;

    if (portRole) {
      if (h.bType === "port_warehouse" && window.PORT_ART?.weatheredWarehouse?.naturalWidth) {
        houseSprite = window.PORT_ART.weatheredWarehouse;
      } else if (h.bType === "port_fishmonger" && window.PORT_ART?.fishWorkshop?.naturalWidth) {
        houseSprite = window.PORT_ART.fishWorkshop;
        isFishWorkshop = true;
      }
      if (!houseSprite) {
        const img = window.PORT_ART?.[portRole];
        if (img?.naturalWidth) houseSprite = img;
      }
    } else if (h.bType === "house_tavern" && window.ART.house_tavern) {
      houseSprite = window.ART.house_tavern;
    } else if (h.bType === "house_shrine" && window.ART.house_shrine) {
      houseSprite = window.ART.house_shrine;
    } else if (window.ART.house_shop) {
      houseSprite = window.ART.house_shop;
    }

    // S2 Nano（dev s2artprod=1）：世界房直接換成 production-s2-nano 的透明 RGBA 建築，
    // 不用 legacy 候選/原稿 sourceRect；缺圖只顯示載入中，不回落 legacy 冒充。
    let s2Building = null;
    if (portRole && (typeof window.isS2ArtProdEnabled === "function" ? window.isS2ArtProdEnabled() : !!window.S2_ART_PROD_ENABLED)) {
      const list = window.getS2Buildings?.() || [];
      houseSprite = null; isFishWorkshop = false;
      if (list.length) {
        // Deterministic world-house assignment; cover all five real Nano buildings
        // during horizontal travel instead of collapsing to only two variants.
        const houseSlot = Math.round(h.x / 390) + Math.round((h.y - 185) / 400);
        const idx = ((houseSlot % list.length) + list.length) % list.length;
        s2Building = list[idx];
        houseSprite = s2Building._img;
        (window.__s2HouseMap ||= {})[Math.round(h.x) + "," + Math.round(h.y)] = s2Building.id; // dev QA：世界房→Nano 建築對應證據
      }
    }
    // 第一關店寬 166、玩家立繪高 114。港倉 220／魚舖 236 約比町屋寬三成，候選再收 15%。
    const bw = s2Building ? Math.min(165, Math.max(145, s2Building.displaySize?.width ?? 160))
      : h.bType === "port_fishmonger" ? 201 : h.bType === "port_warehouse" ? 187 : h.bType === "house_tavern" ? 175 : h.bType === "house_shrine" ? 158 : 166;
    const candidateSourceRect = s2Building ? null : (houseSprite === window.PORT_ART?.weatheredWarehouse)
      ? { sx: 13, sy: 130, sw: 1227, sh: 1019 }
      : (houseSprite === window.PORT_ART?.fishWorkshop)
      ? { sx: 17, sy: 181, sw: 1221, sh: 923 }
      : null;
    const aspect = candidateSourceRect
      ? (candidateSourceRect.sh / candidateSourceRect.sw)
      : (houseSprite && houseSprite.naturalWidth && houseSprite.naturalHeight)
      ? (houseSprite.naturalHeight / houseSprite.naturalWidth)
      : 1.05;
    const tilt = tiltK() || 1;
    const tiltFactor = clamp((1 - tilt) / 0.4, 0, 1);
    // 斜俯視 2.5D 建築立面 upright 與遠近尺度補償：固定 world-depth 比例，不隨 player/cam Y 浮動，僅隨 0.8s mode tween 平滑過渡
    const depthFactor = 1 + tiltFactor * 0.06;
    const bh = Math.round(bw * aspect * depthFactor);

    if (houseSprite && houseSprite.naturalWidth) {
      // Camera looks north: only buildings far above the courier are distant.
      const distance = viewerY == null ? 0 : Math.max(0,viewerY-h.y);
      const focus = clamp((distance-290)/650,0,1)*tiltFactor;
      const top = (h.y + 48) - bh;
      if (s2Building && houseSprite?.naturalWidth) {
        // 透明 RGBA 建築原圖直貼：不走遠景模糊／風格暗化，避免整棟發暗。
        ctx.drawImage(houseSprite, h.x - bw / 2, top, bw, bh);
      } else {
        drawStyledSceneryImage(ctx,houseSprite,h.x-bw/2,top,bw,bh,1,h.bType,
          focus*2.25, candidateSourceRect);
      }
    } else {
      // 缺料不畫幾何房子。
    }

    ctx.save();
    const signW = 132;
    const signY = (h.y + 48) - Math.round(bh * (12 / 174));
    ctx.textAlign = "center";
    // 町屋招牌用和風筆文字體；保留厚實暗底與暖色字，避免 20px 時過細。
    const uiReadableFont = (typeof UI !== "undefined" ? UI : window.UI)?.readableFont;
    ctx.font = (uiReadableFont ? uiReadableFont(21, "400") : "21px serif").replace(
      "'Noto Sans JP', 'Microsoft JhengHei', sans-serif",
      "'Yuji Syuku', 'Kaisei Decol', 'Noto Sans JP', serif"
    );
    ctx.strokeStyle = "#e3d0a8";
    ctx.lineWidth = 0.7;
    const S2_SIGNS = { building_port_warehouse: "港町倉庫", building_fish_workshop: "魚市工坊", building_port_tavern: "海潮酒肆", building_wharf_shop: "碼頭商屋", building_port_teahouse: "番所茶屋" };
    const signLabel = s2Building ? (S2_SIGNS[s2Building.id] || "港町商屋")
      : isFishWorkshop ? "魚市工坊"
      : h.bType === "port_fishmonger" ? "魚舖"
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
  function drawPlayer(P, isDashing, inv, elapsed, moveDir, shield = 0, isSlashing = false, isHurt = false, moveSpeed = 230) {
    ctx.save();
    const isMoving = Math.hypot(moveDir.x, moveDir.y) > 0.1;
    const motion = allowsMotion();
    if (!motion) ghostTrails = [];
    // 1. 步伐彈跳物理 (Procedural Spring Step Bob)
    const atlasKind = isHurt || isDashing ? null : isSlashing ? "attack" : isMoving ? "run" : "idle";
    const spriteAtlasReady = !!(atlasKind && window.SPRITECOOK_DEV?.ready?.(atlasKind));
    const speedScale = Math.max(0.8, Math.min(2.0, (moveSpeed || 230) / 230));
    const strideFreq = 12 * speedScale;
    const walkBob = spriteAtlasReady ? 0 : isMoving && motion && !isHurt ? Math.abs(Math.sin(elapsed * strideFreq)) * 1.5 : 0;

    // 2. 彈性骨骼與次級動態 (Squash & Stretch, Lean Tilt, Secondary Inertial Shear)
    let squash = 1, stretch = 1, leanAng = 0, shearX = 0;
    if (motion && !isHurt) {
      if (isDashing) {
        // 衝刺時：前衝拉伸與前傾俯衝
        squash = 1.15;
        stretch = 0.88;
        leanAng = 0.16;
        shearX = -0.10;
      } else if (isMoving && !spriteAtlasReady) {
        // 跑步步伐有機彈性：著地與起跳交替起伏
        const stridePhase = Math.sin(elapsed * strideFreq);
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

    const devSprites = window.SPRITECOOK_DEV;
    const devKind = atlasKind;
    const devFrame = devSprites?.frame(devKind, elapsed, motion, moveSpeed);
    if (devFrame) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(devFrame.image, devFrame.index*640, 0, 640, 640, -poseHeight/2, -poseHeight + devFrame.footPad*poseHeight/640, poseHeight, poseHeight);
      if (devKind === "attack") devSprites.drawSlash(ctx, devFrame.index);
    } else if (pImg) {
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

  // 海坊主足底湧浪與潮波基座（依 motion 緩慢擴散的湧浪漣漪，walking 時波紋擴張）
  function drawUmibozuWaterBase(targetCtx, elapsed, scale = 0.55, walking = false) {
    targetCtx.save();
    const waveT = elapsed * (walking ? 3.8 : 2.2);
    const surgePulse = walking ? Math.sin(elapsed * 6.5) * 14 * scale : 0;
    const r1 = (85 * scale + surgePulse * 0.5) * (1 + 0.08 * Math.sin(waveT));
    const r2 = (125 * scale + surgePulse) * (1 + 0.06 * Math.sin(waveT + 1.6));

    // 外環水花虛線
    targetCtx.strokeStyle = "rgba(180, 228, 245, 0.35)";
    targetCtx.lineWidth = 2.2;
    targetCtx.setLineDash([8, 6]);
    targetCtx.beginPath();
    targetCtx.ellipse(0, 0, r2, r2 * 0.44, 0, 0, 6.2831853);
    targetCtx.stroke();
    targetCtx.setLineDash([]);

    // 內圈湧浪薄暈
    targetCtx.fillStyle = "rgba(38, 92, 138, 0.22)";
    targetCtx.beginPath();
    targetCtx.ellipse(0, 0, r1, r1 * 0.44, 0, 0, 6.2831853);
    targetCtx.fill();
    targetCtx.strokeStyle = "rgba(220, 245, 255, 0.55)";
    targetCtx.lineWidth = 1.6;
    targetCtx.stroke();
    targetCtx.restore();
  }

  // 繪製妖怪怪物（修正面向問題！根據各 Sprite 原生朝向計算正確鏡像）
  // Phase2：使用 e.faceAng（真移動方向）與 e.walking，停/凍結維持末方向，初始無方向安全回落
  function drawStage2Actor(e, P, elapsed) {
    const spec = e.type === "shiome"
      ? { idle: "shiomeIdle", attack: "shiomeAttack", w: 250, h: 220, ax: 125, ay: 205, scale: 0.48, nativeFacing: -1 }
      : { idle: "bossIdle", attack: "bossAttack", w: 350, h: 330, ax: 175, ay: 320, scale: 0.55, nativeFacing: -1 };
    const key = (!e.shield && e.pose === "attack") ? spec.attack : spec.idle;
    const img = window.PORT_ENEMIES?.[key];
    const motion = allowsMotion();

    // 真移動方向：faceAng 為移動時更新的 atan2(dy,dx)，無移動時保持末值
    // 初始無 faceAng 時，回落玩家相對方向
    const hasFaceAng = typeof e.faceAng === "number" && isFinite(e.faceAng);
    const dir = hasFaceAng ? (Math.cos(e.faceAng) < 0 ? -1 : 1) : (P.x < e.x ? -1 : 1);
    const nativeFacing = spec.nativeFacing ?? 1;

    ctx.save();
    ctx.translate(e.x, e.y);

    // 海坊主足底湧浪與潮波基座（依 motion 緩慢擴散的湧浪漣漪）
    if (e.type !== "shiome" && motion) {
      drawUmibozuWaterBase(ctx, elapsed, spec.scale, !!e.walking);
    }

    // Local contact recoil; water base, shadows and telegraphs keep their real position.
    if (motion && e.type !== "boss" && e.hitReactT > 0) {
      const phase = Math.max(0, Math.min(1, e.hitReactT / 0.14));
      ctx.translate((e.hitReactDir || 1) * 8 * Math.sin(Math.PI * phase), 0);
    }
    ctx.scale(dir * nativeFacing, 1);

    // Bounded 軟骨：呼吸/行走時的 squash/stretch/lean/shear（不只全身位移漂浮）
    if (motion) {
      const walking = !!e.walking;
      const time = elapsed + (e.wob || 0);
      if (e.type === "shiome") {
        // 潮目小僧：提燈自然擺動、步態 squash/stretch 與剪切，腳底錨點固定
        const cadence = elapsed * 8.5 + (e.wob || 0);
        const breath = Math.sin(elapsed * 2.4 + (e.wob || 0)) * 0.035;
        const stride = walking ? Math.sin(cadence) : 0;
        const squash = 1 + breath + stride * 0.07;
        const stretch = 1 - breath * 0.5 - stride * 0.055;
        const shearX = walking ? Math.sin(cadence) * 0.06 : 0;
        ctx.scale(squash, stretch);
        if (shearX !== 0) {
          ctx.transform(1, 0, shearX, 1, 0, 0);
        }
        if (e.flash > 0) {
          const hitScale = 1 + e.flash * 0.15;
          ctx.scale(hitScale, 1 / hitScale);
        }
      } else {
        // 怒りの海坊主 (Ikari Umibozu)：深沉巨浪呼吸 + 潮流顫動 + 依 faceAng/walking 湧浪前傾
        const breathT = time * 1.4;
        const breath = Math.sin(breathT) * 0.04;
        // 呼吸體積守恆：Y 展開時 X 微縮，腳底錨點固定在 (0, 0) 不跳動
        ctx.scale(1 - breath * 0.35, 1 + breath);

        // 緩慢水波顫動與行走時的波湧節奏（水平剪切，y=0 處零位移，保持下盤踏實）
        const waveStride = walking ? Math.sin(elapsed * 5.2) * 0.035 : 0;
        const waveTremor = Math.sin(time * 2.8) * 0.022 + waveStride;
        ctx.transform(1, 0, waveTremor, 1, 0, 0);

        if (walking) {
          // 前進時微幅前傾衝浪勢態
          ctx.transform(1, 0, 0.038, 1, 0, 0);
        }

        // 攻擊起手蓄力 (Windup Anticipation)：傾身後撤、緊繃微震
        const isAttacking = e.pose === "attack" || (e.attackWindup && e.attackWindup > 0) || e.hazard?.phase === "telegraph";
        if (isAttacking) {
          const windupT = e.hazard ? Math.min(1, (e.hazard.t || 0) / (e.hazard.duration || 1)) : 0.5;
          const lean = -0.055 * Math.sin(windupT * Math.PI * 0.5);
          ctx.transform(1, 0, lean, 1, 0, 0);
          const tension = 1 + 0.05 * Math.sin(windupT * Math.PI);
          ctx.scale(1 / Math.sqrt(tension), tension);
          if (windupT > 0.6) {
            const jitter = (windupT - 0.6) / 0.4 * 2.5;
            ctx.translate((Math.sin(elapsed * 45) * jitter), 0);
          }
        }

        // 受擊抽搐 (Hit Twitch)：受傷水平抖動與形變
        if (e.flash > 0) {
          const twitchX = Math.sin(e.flash * 38) * (e.flash * 6.5);
          ctx.translate(twitchX, 0);
          const hitScale = 1 + e.flash * 0.16;
          ctx.scale(hitScale, 1 / hitScale);
        }
      }
    }

    // 腳底對齊：ay 為素材腳點，繪製時保持 pivot 與 shadow/排序錨點一致
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
      drawStage2Actor(e, P, elapsed);
      // All rain-port bosses use this renderer; gatekeepers still need their
      // quiz shield, while drawBossSeal() itself handles shield=false.
      if (e.umibozu && !e.dying) drawBossSeal(e, elapsed);
      return;
    }
    ctx.save();
    const isBoss = e.type === "boss";
    const isMis = e.type === "mis";
    const motion = allowsMotion();
    const bob = motion ? Math.sin(elapsed * 5 + (e.wob || 0)) * 2 : 0;

    // Phase2：真移動方向 faceAng（game.js 移動時寫入 atan2(dy,dx)，停/凍結/擊退/揭露保持末值）
    // 初始無 faceAng 時，安全回落玩家相對方向
    const hasFaceAng = typeof e.faceAng === "number" && isFinite(e.faceAng);
    const dir = hasFaceAng ? (Math.cos(e.faceAng) < 0 ? -1 : 1) : (P.x < e.x ? -1 : 1);
    const scaleX = dir === 1 ? 1 : -1;

    // 程序化次級彈性骨骼與果凍軟體物理 —— 依實際 e.walking 與 faceAng 做 bounded 軟骨
    // 不只全身位移漂浮：腳底 pivot 與 shadow/排序錨點保持
    let sX = 1, sY = 1, tilt = 0;
    if (motion) {
      const walking = !!e.walking;
      const time = elapsed + (e.wob || 0);
      if (isBoss) {
        // 大妖 Boss：威嚴慢速深呼吸與沉重受傷後座力
        const breath = Math.sin(time * 2.6) * 0.04;
        sX = 1 + breath;
        sY = 1 - breath * 0.6;
        if (e.flash > 0) { sX *= 1.12; sY *= 0.90; }
      } else if (e.type === "runner") {
        // 疾走怪：奔馳起伏拉伸與前傾俯衝 —— 僅走路時
        if (walking) {
          const stride = Math.sin(time * 12);
          sX = 1 + stride * 0.12;
          sY = 1 - stride * 0.10;
          // 前傾方向跟隨 faceAng（移動朝向），非玩家相對
          tilt = 0.12 * (hasFaceAng ? Math.sign(Math.cos(e.faceAng)) : dir);
        }
        if (e.flash > 0) { sX *= 1.20; sY *= 0.80; }
      } else if (e.type === "tank") {
        // 巨盾怪：笨重重踏頓挫 —— 僅走路時
        if (walking) {
          const stomp = Math.abs(Math.sin(time * 4));
          sX = 1 + (1 - stomp) * 0.08;
          sY = 1 - (1 - stomp) * 0.07;
        }
        if (e.flash > 0) { sX *= 1.15; sY *= 0.88; }
      } else {
        // 幽靈怪 (ghost / shooter / mis)：果凍軟體呼吸與受傷劇烈彈動震顫
        // 行走時加入微傾斜跟隨 faceAng
        const jelly = Math.sin(time * 4.5) * 0.08;
        sX = 1 + jelly;
        sY = 1 - jelly;
        if (walking && hasFaceAng) {
          tilt = Math.sin(time * 3) * 0.05 * Math.sign(Math.cos(e.faceAng));
        } else {
          tilt = Math.sin(time * 3) * 0.07;
        }
        if (e.flash > 0) { sX *= 1.28; sY *= 0.74; }
      }
    }

    // Enemy contact shadow is rendered separately in world floor space.
    // Visual-only recoil without moving collisions or world-space sort points.
    const recoilPhase = motion ? Math.max(0, Math.min(1, (e.hitReactT || 0) / 0.14)) : 0;
    const recoilX = isBoss ? 0 : (e.hitReactDir || 1) * 9 * Math.sin(Math.PI * recoilPhase);
    ctx.translate(e.x + recoilX, e.y + bob);
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
      // 腳底對齊深度排序與接地陰影基準點 (Boss 44, Mis 27, 一般怪 19)，消除素材懸空與遮擋穿透
      const footY = isBoss ? 44 : isMis ? 27 : 19;
      const box = drawFrame(ctx,sprite,artKey,artIndex,0,footY,actualH);
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
    const s2NightLift = (currentStageId() === "rain-port" && window.isS2ArtProdEnabled?.()) ? 0.5 : 1; // S2 dev：夜色遮罩減半，建築不被壓成剪影
    const nightAlpha = 0.72 * s2NightLift * Math.pow(1 - progress, 1.05) * (1 - lampOut) + 0.97 * lampOut; // 燈滅時整個夜色壓到近乎全黑

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

    // 2. 街角提燈 (LAMPS) 暖光池（燈滅時一併退去；雨港不使用第一關提燈）
    if (currentStageId() !== "rain-port") {
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
    }

    // 夜色遮罩只合成一次。暖光是燈暈上的少數徑向漸層，不再鋪第二張全螢幕。
    ctx.drawImage(lightCv, area.left, area.top, area.width, area.height);
    if (lampOut < 1) paintWarmPool(screenPx, screenPy, baseRadius * 0.62);
    if (lampOut < 1 && currentStageId() !== "rain-port") LAMPS.forEach(l => {
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
    const scale = [0.78, 0.86, 0.94, 1.02, 1.25][tierIdx];
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

  function drawPortAtmosphereRain(targetCtx, area, elapsed) {
    if (!allowsMotion()) return;
    const slant = 0.18; // 保持一致方向斜率
    const spanX = area.width + 160;
    const spanY = area.height + 160;
    const camDriftX = camX * 0.25;
    const camDriftY = camY * 0.25;
    targetCtx.save();
    targetCtx.lineCap = "round";

    // 1. 分層細雨 (front/back 細雨)：總共 46 條，清晰可見且完全在 60 FPS 預算內
    const layers = [
      // Back layer (後層較細、較淡)
      { count: 24, speed: 480, len: 16, width: 1.1, alpha: 0.30, color: "172, 214, 238" },
      // Front layer (前層稍長、稍亮)
      { count: 22, speed: 700, len: 26, width: 1.5, alpha: 0.48, color: "195, 235, 255" }
    ];

    let streakIndex = 0;
    for (const layer of layers) {
      targetCtx.lineWidth = layer.width;
      targetCtx.strokeStyle = `rgba(${layer.color}, ${layer.alpha})`;
      for (let i = 0; i < layer.count; i++, streakIndex++) {
        const seed = streakIndex * 73 + 17;
        const speed = layer.speed * (0.88 + ((seed % 29) / 29) * 0.24);
        const travelX = speed * slant;
        const baseX = ((seed * 137) % spanX);
        const baseY = ((seed * 223) % spanY);
        // 確保取模運算在負數偏移時依然週期平滑無突變
        const rawX = (baseX + elapsed * travelX + camDriftX) % spanX;
        const rawY = (baseY + elapsed * speed + camDriftY) % spanY;
        const x = area.left + ((rawX + spanX) % spanX) - 40;
        const y = area.top + ((rawY + spanY) % spanY) - 40;
        const len = layer.len;
        targetCtx.beginPath();
        targetCtx.moveTo(x, y);
        targetCtx.lineTo(x + len * slant, y + len);
        targetCtx.stroke();
      }
    }

    // 2. 弱地面雨點 (微小水花/雨滴落點)：落在可視陸地石板、碼頭與屋前
    // 總共 18 點，快速生滅，不遮擋人物與 HUD
    targetCtx.lineWidth = 1.0;
    for (let d = 0; d < 18; d++) {
      const dSeed = d * 89 + 31;
      const dCycle = (elapsed * 2.4 + (dSeed % 23) / 23.0) % 1.0;
      if (dCycle > 0.35) continue; // 只在水花觸地瞬間顯示
      const dFrac = dCycle / 0.35; // 0..1
      const dbX = (dSeed * 163) % spanX;
      const dbY = (dSeed * 251) % spanY;
      const dx = area.left + (((dbX + camDriftX * 0.8) % spanX + spanX) % spanX) - 20;
      const dy = area.top + (((dbY + camDriftY * 0.8) % spanY + spanY) % spanY) - 20;
      const dAlpha = (1.0 - dFrac) * 0.38;
      targetCtx.strokeStyle = `rgba(195, 235, 255, ${dAlpha})`;
      targetCtx.beginPath();
      // 微小橢圓水波弧 (半徑 1.5 ~ 3.5px)
      const rad = 1.5 + dFrac * 2.2;
      targetCtx.ellipse(dx, dy, rad, rad * 0.45, 0, 0, 6.283);
      targetCtx.stroke();
    }

    targetCtx.restore();
  }

  function drawAtmosphere(elapsed, petalCount = 50, fireflyCount = FIREFLIES.length) {
    if (!allowsMotion()) return;
    const area = bounds();
    ctx.save();

    // 雨港大氣層：持續細密有方向分層雨絲
    if (currentStageId() === "rain-port") {
      drawPortAtmosphereRain(ctx, area, elapsed);
    }
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

    // 螢火蟲 (夜行幽火 / 浮世繪木版幽火光暈)
    for (let i = 0; i < Math.min(FIREFLIES.length, fireflyCount); i++) {
      const f = FIREFLIES[i];
      const fx = f.x + Math.sin(elapsed * 2 + f.phase) * 30;
      const fy = f.y + Math.cos(elapsed * 1.5 + f.phase) * 20;
      if (fx < area.left - 20 || fx > area.right + 20 || fy < area.top - 20 || fy > area.bottom + 20) continue;
      const pulse = 0.4 + 0.6 * Math.sin(elapsed * 4 + f.phase);
      // 外層和紙水墨幽火光暈 (Soft Ink-Wash Spirit Aura)
      ctx.fillStyle = `rgba(142, 218, 192, ${pulse * 0.32})`;
      ctx.beginPath();
      ctx.arc(fx, fy, 5.5, 0, 6.28);
      ctx.fill();
      // 內層暖玉白芯 (Warm Jade Luminous Core)
      ctx.fillStyle = `rgba(235, 255, 240, ${pulse * 0.85})`;
      ctx.beginPath();
      ctx.arc(fx, fy, 2.2, 0, 6.28);
      ctx.fill();
    }
    ctx.restore();
  }

  // 雨港 tidalFan / rainVortex。D3 原 gate：DEV 候選且水紋 drawImage 成功才是 IMAGE。
  // 正常頁、缺圖、載入中都回舊安全幾何，handled=true，分類 LEGACY_SAFETY_FALLBACK。
  // 四標準 kind 另走 dev=1&bossart=1 跨關 gate；缺圖／gate 關／未知 kind 回 false 交 game C3。
  let bossHazardPass = "UNHANDLED";

  function bossHazardImageDev() {
    return typeof window !== "undefined"
      && typeof window.isFusionArtBindEnabled === "function"
      && window.isFusionArtBindEnabled() === true;
  }
  function bossHazardRipple() {
    const img = typeof window !== "undefined" ? window.PORT_ART?.ripple : null;
    return img && img.naturalWidth > 0 ? img : null;
  }

  // alpha>16 的含端點框：左16 上37 右112 下91。右/下用排除端 113/92，寬97 高55。
  const RIPPLE_BOX = Object.freeze({ l: 16, t: 37, r: 113, b: 92 });

  function drawRippleCircle(c, img, x, y, diameter, alpha) {
    const iw = img.naturalWidth || 128;
    const ih = img.naturalHeight || 128;
    const bw = RIPPLE_BOX.r - RIPPLE_BOX.l;
    const bh = RIPPLE_BOX.b - RIPPLE_BOX.t;
    const destW = diameter * iw / bw;
    const destH = diameter * ih / bh;
    const cx = ((RIPPLE_BOX.l + RIPPLE_BOX.r) / 2) / iw;
    const cy = ((RIPPLE_BOX.t + RIPPLE_BOX.b) / 2) / ih;
    c.save();
    c.globalAlpha = alpha;
    c.drawImage(img, x - cx * destW, y - cy * destH, destW, destH);
    c.restore();
  }

  // BOSS-IMAGE-PROD-R2：跨關 DEV 圖片候選。
  // 四標準 kind 缺圖／gate 關／未知 kind 一律 false 交 game C3；
  // fan/vortex 仍走原 D3 ripple gate，維持 LEGACY_SAFETY_FALLBACK。
  // BOSS 危險圖片渲染接口：
  // - defs=BOSS_HAZARD_ART：危險圖片定義（slam/charge/ring/tide）
  // - 圖片=BOSS_HAZARD_ART_IMG：渲染用的圖片實例
  // - gate=isBossHazardArtEnabled dev=1&bossart=1：僅在 URL 參數 dev=1&bossart=1 時啟用
  function bossHazardArt(kind) {
    if (kind !== "slam" && kind !== "charge" && kind !== "ring" && kind !== "tide" && kind !== "tidalFan" && kind !== "rainVortex") return null;
    if (typeof window === "undefined" || window.isBossHazardArtEnabled?.() !== true) return null;
    const image = window.BOSS_HAZARD_ART_IMG?.[kind];
    const def = window.BOSS_HAZARD_ART?.[kind];
    if (!image || !def || !(image.naturalWidth > 0) || !(image.naturalHeight > 0)) return null;
    return { image, bbox: def.bbox, def };
  }

  function bossPhaseAlpha(h, elapsed, motion) {
    const u = Math.max(0, Math.min(1, (Number(h.t) || 0) / (h.duration > 0 ? h.duration : 1)));
    if (h.phase === "recovery") return 0.36 * (1 - u);
    if (h.phase === "active") return 0.9;
    return motion ? 0.58 + 0.1 * Math.sin((Number(elapsed) || 0) * 7) : 0.68;
  }

  // 只裁 alpha bbox；旋轉時繞目標框中心，讓圖案跟著真危險幾何。
  function bossImageBox(c, art, x, y, w, h, angle = 0) {
    const [l, t, r, b] = art.bbox || [];
    const sw = r - l, sh = b - t;
    if (!(sw > 0 && sh > 0 && w > 0 && h > 0)) return 0;
    c.save();
    if (angle) {
      c.translate(x + w / 2, y + h / 2);
      c.rotate(angle);
      c.drawImage(art.image, l, t, sw, sh, -w / 2, -h / 2, w, h);
    } else {
      c.drawImage(art.image, l, t, sw, sh, x, y, w, h);
    }
    c.restore();
    return 1;
  }

  // slam：真危險圓 h.r；圖片只在水紋 bbox 內，不外擴 r+30。
  function paintSlam(c, art, h) {
    const r = h.r > 0 ? h.r : 150;
    c.beginPath();
    c.arc(h.x, h.y, r, 0, Math.PI * 2);
    c.clip();
    return bossImageBox(c, art, h.x - r, h.y - r, r * 2, r * 2);
  }

  // charge：預告 403x104 朝向帶＋端點；active/recovery 只跟真 owner。
  function paintCharge(c, art, h, owner) {
    const r = h.r > 0 ? h.r : 52;
    const angle = Number.isFinite(h.angle) ? h.angle : 0;
    if ((h.phase || "telegraph") !== "telegraph") {
      // 不可用 h.x/h.y 冒充真 Boss；缺 owner 由 handler 回 false。
      if (!owner || !Number.isFinite(owner.x) || !Number.isFinite(owner.y)) return 0;
      c.beginPath();
      c.arc(owner.x, owner.y, r, 0, Math.PI * 2);
      c.clip();
      return bossImageBox(c, art, owner.x - r, owner.y - r, r * 2, r * 2, angle - Math.PI / 4);
    }
    const length = 620 * 0.65; // 403 world units, 與 BOSS_AI active travel 同長
    c.translate(h.x, h.y);
    c.rotate(angle);
    c.beginPath();
    c.moveTo(0, -r);
    c.lineTo(length, -r);
    c.arc(length, 0, r, -Math.PI / 2, Math.PI / 2);
    c.lineTo(0, r);
    c.arc(0, 0, r, Math.PI / 2, Math.PI * 1.5);
    c.closePath();
    c.clip();
    let n = 0;
    for (let x = -r; x < length + r; x += r * 1.75) {
      n += bossImageBox(c, art, x, -r, r * 2, r * 2, -Math.PI / 4);
    }
    // 端點：同一主圖，依 h.angle 對齊，畫在完整 403 路徑尾端。
    n += bossImageBox(c, art, length - r, -r, r * 2, r * 2, -Math.PI / 4);
    return n;
  }

  // ring：精確 prevR-28..h.r+28 帶；gap 與內洞由 clip 留空，不用時間重推半徑。
  function paintRing(c, art, h) {
    const current = h.r > 0 ? h.r : 80;
    const previous = Number.isFinite(h.prevR) && h.prevR > 0 ? h.prevR : current;
    const inner = Math.max(0, previous - 28);
    const outer = current + 28;
    if (!(outer > inner)) return -1;
    const gap = Number.isFinite(h.gapAngle) ? h.gapAngle : 0;
    const gapWidth = Number.isFinite(h.gapWidth) && h.gapWidth > 0
      ? Math.min(h.gapWidth, Math.PI * 2)
      : Math.PI / 2;
    if (gapWidth >= Math.PI * 2 - 1e-6) return -1;
    const a0 = gap + gapWidth / 2;
    const a1 = gap + Math.PI * 2 - gapWidth / 2;
    c.beginPath();
    c.arc(h.x, h.y, outer, a0, a1);
    c.lineTo(h.x + Math.cos(a1) * inner, h.y + Math.sin(a1) * inner);
    c.arc(h.x, h.y, inner, a1, a0, true);
    c.closePath();
    c.clip();
    // 單向月牙不可只貼一張：同圖多方向旋轉，讓危險環周界都有主圖。
    let n = 0;
    for (let i = 0; i < 6; i++) {
      n += bossImageBox(c, art, h.x - outer, h.y - outer, outer * 2, outer * 2, i * Math.PI / 3);
    }
    return n;
  }

  // tide：h.progress 真波前 ±60；lateral 兩段危險區排除 safeOffset±safeWidth/2。
  function bossVisibleLateral(c, h, cos, sin) {
    if (c.canvas && typeof c.getTransform === "function") {
      const m = c.getTransform(), det = m.a * m.d - m.b * m.c;
      if (Number.isFinite(det) && Math.abs(det) > 1e-12) {
        const values = [];
        for (const [px, py] of [[0, 0], [c.canvas.width, 0], [0, c.canvas.height], [c.canvas.width, c.canvas.height]]) {
          const wx = (m.d * (px - m.e) - m.c * (py - m.f)) / det;
          const wy = (-m.b * (px - m.e) + m.a * (py - m.f)) / det;
          values.push(-sin * (wx - h.x) + cos * (wy - h.y));
        }
        return [Math.floor(Math.min(...values)) - 2, Math.ceil(Math.max(...values)) + 2];
      }
    }
    const span = Math.max(1400, c.canvas?.width || 1600, c.canvas?.height || 900);
    return [-span, span];
  }

  function paintTide(c, art, h) {
    const angle = Number.isFinite(h.angle) ? h.angle : 0;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const lateral = bossVisibleLateral(c, h, cos, sin);
    const progress = Number.isFinite(h.progress) ? h.progress : -280;
    const offset = Number.isFinite(h.safeOffset) ? h.safeOffset : 0;
    const half = (h.safeWidth > 0 ? h.safeWidth : 130) / 2; // 65
    const safeLeft = offset - half;
    const safeRight = offset + half;
    
    // 兩側危險帶（世界座標 lateral 軸）
    const strips = [
      [lateral[0], Math.min(lateral[1], safeLeft)],   // 左危險帶
      [Math.max(lateral[0], safeRight), lateral[1]]   // 右危險帶
    ];
    if (!strips.some(([lo, hi]) => hi > lo)) return -1;
    
    // 源圖裁切參數（1254 寬）
    const SRC_W = art.image.naturalWidth || 1254;
    const SRC_H = art.image.naturalHeight || 1254;
    const LEFT_BANK_SX = 0, LEFT_BANK_EX = 559, LEFT_BANK_SW = 560;
    const RIGHT_BANK_SX = 737, RIGHT_BANK_EX = 1254, RIGHT_BANK_SW = 517;
    const BANK_SY = 117, BANK_SH = 944; // 從 alpha_bbox [0,117,1254,1061]
    
    c.translate(h.x, h.y);
    c.rotate(angle);
    c.beginPath();
    for (const [lo, hi] of strips) {
      if (!(hi > lo)) continue;
      c.moveTo(progress - 60, lo);
      c.lineTo(progress + 60, lo);
      c.lineTo(progress + 60, hi);
      c.lineTo(progress - 60, hi);
      c.closePath();
    }
    c.clip();
    
    let n = 0;
    const waveHeight = 120; // 世界單位：波前厚度 120 (±60)
    const tileH = 256; // 世界單位每 tile 高度，對應源圖 944px 高度的重複鋪設
    
    for (const [lo, hi] of strips) {
      if (!(hi > lo)) continue;
      const isLeftBank = hi <= safeLeft; // 完全在安全通道左側
      const isRightBank = lo >= safeRight; // 完全在安全通道右側
      if (!isLeftBank && !isRightBank) continue; // 橫跨安全通道的不畫（clip 已排除）
      
      const bankSx = isLeftBank ? LEFT_BANK_SX : RIGHT_BANK_SX;
      const bankSw = isLeftBank ? LEFT_BANK_SW : RIGHT_BANK_SW;
      
      // 世界座標下的 lateral 範圍對應源圖的寬度比例
      const worldWidth = hi - lo;
      const scaleX = worldWidth / bankSw; // 世界單位/源圖像素
      
      for (let wy = lo; wy < hi; wy += tileH) {
        const tileWorldH = Math.min(tileH, hi - wy);
        // 源圖 Y 方向循環：源圖高 944px 對應世界 tileH
        const sy = BANK_SY + ((wy - lo) % BANK_SH);
        const sh = Math.min(BANK_SH - (sy - BANK_SY), BANK_SH * tileWorldH / tileH);
        
        // 畫單個 tile
        c.drawImage(
          art.image,
          bankSx, sy, bankSw, sh,
          progress - 60, wy, waveHeight, tileWorldH
        );
        n++;
      }
    }
    return n;
  }

  function paintTidalFan(c, artOrImg, h, phase, elapsed, motion) {
    // 支援兩種呼叫：(c, art, h, phase, elapsed, motion) 或 (c, img, h, phase, elapsed, motion)
    const art = artOrImg.image ? artOrImg : { image: artOrImg, bbox: null };
    // 源圖：tidalFan_v01.png 1254x1254，apex(617,1117) reach 971px，源圖跨角 160度
    // 判定：120度 (±PI/3)。需以 Canvas clip 裁切至判定角度，防止視覺超出傷害區。
    const img = art.image;
    const bbox = art.bbox || [12, 164, 1247, 1118]; // visible bbox from QA
    const sw = bbox[2] - bbox[0];
    const sh = bbox[3] - bbox[1];
    const centerX = h.x;
    const centerY = h.y;
    const coreR = h.r > 0 ? h.r : 200; // 判定半徑 200，active 觸及 230
    const reach = coreR + 30; // 視覺延伸到 230
    
    // 判定角度範圍：120度 = 2*PI/3
    const startAngle = Number.isFinite(h.startAngle) ? h.startAngle : (h.angle || 0) - Math.PI / 3;
    const endAngle = Number.isFinite(h.endAngle) ? h.endAngle : (h.angle || 0) + Math.PI / 3;
    const fanSpan = endAngle - startAngle; // 應為 2*PI/3
    
    // 源圖錨點：apex 在 (617, 1117)，圖片中心約 (627, 627)
    // 繪製時以 apex 為旋轉中心，向外扇展
    const apexX = 617 - bbox[0]; // 相對 bbox 左上角
    const apexY = 1117 - bbox[1];
    const srcCenterX = sw / 2;
    const srcCenterY = sh / 2;
    
    // 源圖內建中心線角度（apex 指向圖片中心）：用於對齊到判定扇區中心線
    const thetaSrc = Math.atan2(srcCenterY - apexY, srcCenterX - apexX);
    // 判定扇區中心線在 startAngle 旋轉後的座標系中的角度
    const hitboxCenterAngle = fanSpan / 2;
    // 對齊旋轉角：讓源圖中心線落在判定扇區中心線
    const alignAngle = hitboxCenterAngle - thetaSrc;
    
    let baseAlpha = motion ? 0.5 + 0.16 * Math.sin((Number(elapsed) || 0) * 7) : 0.66;
    let hotAlpha = baseAlpha;
    let sweepAngle = null;
    
    if (phase === "active") {
      const dur = h.duration > 0 ? h.duration : 0.15;
      const u = Math.min(1, Math.max(0, (Number(h.t) || 0) / dur));
      sweepAngle = startAngle + fanSpan * u; // 掃過 120度
      baseAlpha = 0.42;
      hotAlpha = u < 0.5 ? 0.72 : 0.92;
    } else if (phase === "recovery") {
      const dur = h.duration > 0 ? h.duration : 1.35;
      baseAlpha = 0.36 * Math.max(0, 1 - (Number(h.t) || 0) / dur);
      hotAlpha = baseAlpha;
    }
    if (!(baseAlpha > 0.02)) return 0;
    
    let n = 0;
    
    // 繪製扇面：將源圖按判定角度裁切並縮放到 reach
    // 關鍵：源圖方向固定（rotate startAngle + alignAngle），裁切區域在 aligned 座標系中變化
    // aligned 座標系 = 世界座標系旋轉 -(startAngle + alignAngle)
    // hitbox 在 aligned 座標系中為 [-alignAngle, fanSpan - alignAngle]
    // sweep 區間 [sweepStart, sweepEnd] 在 aligned 座標系中為 [sweepStart - startAngle - alignAngle, sweepEnd - startAngle - alignAngle]
    const drawSector = (a0, a1, alpha) => {
      c.save();
      c.translate(centerX, centerY);
      // 固定旋轉：讓源圖中心線對齊判定扇區中心線（固定為 startAngle + alignAngle）
      c.rotate(startAngle + alignAngle);
      // 裁切路徑：在 aligned 座標系中
      const localStart = a0 - startAngle - alignAngle;
      const localEnd = a1 - startAngle - alignAngle;
      c.beginPath();
      c.moveTo(0, 0);
      c.arc(0, 0, reach, localStart, localEnd);
      c.closePath();
      c.clip();
      
      // 繪製源圖：以 apex 對齊原點，縮放使 reach 對應源圖 reach (971px)
      const scale = reach / 971; // 源圖 reach 971px -> 世界 reach
      const drawW = sw * scale;
      const drawH = sh * scale;
      // apex 在源圖中的位置，繪製時對齊到 (0,0)
      const dx = -apexX * scale;
      const dy = -apexY * scale;
      
      c.globalAlpha = alpha;
      c.drawImage(img, bbox[0], bbox[1], sw, sh, dx, dy, drawW, drawH);
      c.restore();
      n++;
    };
    
    // 基礎扇面：完整 hitbox 範圍 [startAngle, endAngle]
    drawSector(startAngle, endAngle, baseAlpha);
    // Active 階段：高亮掃過弧，裁切到 sweep 範圍與 hitbox 的交集
    if (sweepAngle != null) {
      const pad = Math.PI / 12; // 15度 高亮寬度
      const sweepStart = Math.max(startAngle, sweepAngle - pad);
      const sweepEnd = Math.min(endAngle, sweepAngle + pad);
      if (sweepEnd > sweepStart) {
        drawSector(sweepStart, sweepEnd, hotAlpha);
      }
    }
    return n;
  }

  function paintRainVortex(c, artOrImg, h, phase, elapsed, motion) {
    // 支援兩種呼叫：(c, art, h, phase, elapsed, motion) 或 (c, img, h, phase, elapsed, motion)
    const art = artOrImg.image ? artOrImg : { image: artOrImg, bbox: null };
    // 源圖：rainVortex_v01.png 1254x1254，整圖包含地面漩渦(下半) + 水柱(上半)
    // 需分層：地面足跡受世界 tilt 投影（由主渲染循環統一處理），水柱 billboard 直立不受透視
    // 中心質心 (632.7, 780.8)，判定半徑 48(active) / 28(telegraph)
    // TECH_LIMITATIONS: 無可靠語義分界將源圖乾淨分層；目前以 sh*0.55 估算，Clip 外仍有不透明像素
    const img = art.image;
    const bbox = art.bbox || [37, 39, 1226, 1227];
    const sw = bbox[2] - bbox[0];
    const sh = bbox[3] - bbox[1];
    
    const list = Array.isArray(h.vortexes) && h.vortexes.length
      ? h.vortexes
      : [{ x: h.x, y: h.y, r: h.r || 32 }];
    const dur = h.duration > 0 ? h.duration : (phase === "recovery" ? 1.35 : 0.15);
    const u = Math.min(1, Math.max(0, (Number(h.t) || 0) / dur));
    let alpha = motion ? 0.62 + 0.08 * Math.sin((Number(elapsed) || 0) * 7) : 0.7;
    if (phase === "active") alpha = u < 0.5 ? 0.55 : 0.9;
    else if (phase === "recovery") alpha = 0.36 * Math.max(0, 1 - u);
    if (!(alpha > 0.02)) return 0;
    
    // 源圖分層估算：下半部(地面漩渦)約佔 45%，上半部(水柱)約佔 55%
    // 此為近似切分，無保證語義邊界；Clip 外仍有洩漏 → TECH_LIMITATIONS
    const GROUND_SY = Math.floor(sh * 0.55);
    const GROUND_SH = sh - GROUND_SY;
    const COLUMN_SY = 0;
    const COLUMN_SH = GROUND_SY;
    
    let n = 0;
    for (const v of list) {
      if (!v || !Number.isFinite(v.x) || !Number.isFinite(v.y)) continue;
      const hitR = (Number(v.r) > 0 ? Number(v.r) : 32) + 16;
      const visualR = hitR * 1.2;
      
      c.save();
      c.translate(v.x, v.y);
      
      // === 層 1：地面漩渦足跡 (世界 tilt 由主渲染循環統一處理，此處不再重複 scale) ===
      if (GROUND_SH > 0) {
        c.save();
        c.beginPath();
        c.arc(0, 0, visualR, 0, Math.PI * 2);
        c.clip();
        c.globalAlpha = alpha;
        const scale = visualR * 2 / sw;
        const drawW = sw * scale;
        const drawH = GROUND_SH * scale;
        // 地面層錨點：底部中心，向上延伸
        c.drawImage(img, bbox[0], bbox[1] + GROUND_SY, sw, GROUND_SH, -drawW/2, -drawH, drawW, drawH);
        c.restore();
        n++;
      }
      
      // === 層 2：水柱 (billboard 直立，反世界 tilt 保持垂直) ===
      if (COLUMN_SH > 0) {
        c.save();
        // Billboard 直立：反世界 tilt (scale(1, 1/tiltK()))
        const tilt = typeof window !== "undefined" && window.VIEWPORT?.tiltScale ? window.VIEWPORT.tiltScale() : 1;
        if (tilt !== 1) {
          c.scale(1, 1 / tilt);
        }
        c.beginPath();
        // 水柱較窄，使用完整 visualR 而非 0.7，避免截頂
        c.arc(0, 0, visualR, 0, Math.PI * 2);
        c.clip();
        c.globalAlpha = alpha * 0.9;
        const scale = visualR * 1.4 / sw;
        const drawW = sw * scale;
        const drawH = COLUMN_SH * scale;
        // 水柱錨點：底部中心，向上延伸
        c.drawImage(img, bbox[0], bbox[1] + COLUMN_SY, sw, COLUMN_SH, -drawW/2, -drawH, drawW, drawH);
        c.restore();
        n++;
      }
      
      // === Telegraph/Active/Recovery 視覺回饋：邊緣高亮圓環 ===
      c.save();
      c.globalAlpha = Math.min(0.8, alpha);
      c.strokeStyle = phase === "active" ? "rgba(210, 244, 255, 0.95)" : "rgba(140, 220, 255, 0.7)";
      c.lineWidth = phase === "active" ? 2.5 : 1.5;
      c.beginPath();
      c.arc(0, 0, hitR, 0, Math.PI * 2);
      c.stroke();
      c.restore();
      
      c.restore();
      n++;
    }
    return n;
  }

  function paintLegacyPortHazard(c, h, elapsed) {
    const motion = allowsMotion();
    const phase = h.phase || "telegraph";
    const kind = h.kind || "";
    const fan = kind === "tidalFan" || kind === "tidal_surge" || kind === "tide_fan";
    if (fan) {
      c.save();
      const r = h.r || 210;
      const angle = h.angle || 0;
      const startAngle = h.startAngle ?? (angle - Math.PI / 3);
      const endAngle = h.endAngle ?? (angle + Math.PI / 3);
      const fanSpan = endAngle - startAngle;
      if (phase === "telegraph") {
        const pulse = motion ? Math.sin(elapsed * 7) * 0.08 : 0;
        c.fillStyle = `rgba(32, 105, 155, ${0.20 + pulse})`;
        c.beginPath();
        c.moveTo(h.x, h.y);
        c.arc(h.x, h.y, r, startAngle, endAngle);
        c.closePath();
        c.fill();
        c.strokeStyle = "rgba(140, 220, 255, 0.45)";
        c.lineWidth = 1.8;
        c.beginPath();
        c.moveTo(h.x, h.y);
        c.lineTo(h.x + Math.cos(startAngle) * r, h.y + Math.sin(startAngle) * r);
        c.moveTo(h.x, h.y);
        c.lineTo(h.x + Math.cos(endAngle) * r, h.y + Math.sin(endAngle) * r);
        c.stroke();
        c.strokeStyle = "rgba(220, 248, 255, 0.85)";
        c.lineWidth = 3.2;
        c.setLineDash([10, 6]);
        c.beginPath();
        c.arc(h.x, h.y, r, startAngle, endAngle);
        c.stroke();
        c.setLineDash([]);
        if (motion) {
          const wavePhase = (elapsed * 2.2) % 1;
          c.strokeStyle = `rgba(180, 235, 255, ${0.6 * (1 - wavePhase)})`;
          c.lineWidth = 2.4;
          c.beginPath();
          c.arc(h.x, h.y, r * wavePhase, startAngle, endAngle);
          c.stroke();
        }
      } else if (phase === "active") {
        const u = Math.min(1, (h.t || 0) / (h.duration || 0.45));
        const curR = r * (0.15 + 0.85 * u);
        c.fillStyle = "rgba(25, 80, 125, 0.35)";
        c.beginPath();
        c.moveTo(h.x, h.y);
        c.arc(h.x, h.y, curR, startAngle, endAngle);
        c.closePath();
        c.fill();
        c.strokeStyle = "rgba(40, 125, 185, 0.80)";
        c.lineWidth = 20;
        c.lineCap = "round";
        c.beginPath();
        c.arc(h.x, h.y, curR, startAngle, endAngle);
        c.stroke();
        c.strokeStyle = "rgba(255, 255, 255, 0.95)";
        c.lineWidth = 6;
        c.beginPath();
        c.arc(h.x, h.y, curR + 3, startAngle, endAngle);
        c.stroke();
        if (motion) {
          c.fillStyle = "rgba(240, 250, 255, 0.9)";
          for (let i = 0; i <= 7; i++) {
            const dropAng = startAngle + fanSpan * (i / 7);
            const sprayDist = curR + 10 + Math.sin(i * 3.7 + elapsed * 10) * 8;
            c.beginPath();
            c.arc(h.x + Math.cos(dropAng) * sprayDist, h.y + Math.sin(dropAng) * sprayDist, 3, 0, 6.283);
            c.fill();
          }
        }
      } else {
        const fade = Math.max(0, 1 - (h.t || 0) / (h.duration || 1.35));
        c.strokeStyle = `rgba(180, 230, 250, ${0.45 * fade})`;
        c.lineWidth = 4;
        c.beginPath();
        c.arc(h.x, h.y, r, startAngle, endAngle);
        c.stroke();
      }
      c.restore();
      return;
    }
    c.save();
    const vortexes = Array.isArray(h.vortexes) && h.vortexes.length > 0
      ? h.vortexes
      : [{ x: h.x, y: h.y, r: h.r || 32 }];
    for (const v of vortexes) {
      const vx = v.x, vy = v.y, vr = v.r || 32;
      if (phase === "telegraph") {
        c.save();
        c.translate(vx, vy);
        c.scale(1, 0.58);
        c.rotate(motion ? elapsed * 5.2 : 0);
        c.fillStyle = "rgba(18, 52, 85, 0.65)";
        c.beginPath();
        c.arc(0, 0, vr, 0, 6.283);
        c.fill();
        c.strokeStyle = "rgba(145, 235, 255, 0.85)";
        c.lineWidth = 2.4;
        for (let arm = 0; arm < 3; arm++) {
          c.beginPath();
          const armOffset = (arm * Math.PI * 2) / 3;
          for (let step = 0; step <= 12; step++) {
            const tStep = step / 12;
            const curAng = armOffset + tStep * Math.PI * 1.5;
            const curDist = vr * (1 - tStep * 0.7);
            const px = Math.cos(curAng) * curDist;
            const py = Math.sin(curAng) * curDist;
            if (step === 0) c.moveTo(px, py);
            else c.lineTo(px, py);
          }
          c.stroke();
        }
        c.strokeStyle = "rgba(220, 245, 255, 0.75)";
        c.lineWidth = 1.6;
        c.setLineDash([5, 4]);
        c.beginPath();
        c.arc(0, 0, vr * 1.15, 0, 6.283);
        c.stroke();
        c.setLineDash([]);
        c.restore();
      } else if (phase === "active") {
        const u = Math.min(1, (h.t || 0) / (h.duration || 0.55));
        const riseCurve = Math.sin(u * Math.PI);
        const colHeight = (130 + vr * 1.2) * riseCurve;
        const colWidth = vr * (1.1 + 0.3 * (1 - riseCurve));
        c.save();
        c.translate(vx, vy);
        c.save();
        c.scale(1, 0.55);
        c.strokeStyle = "rgba(240, 252, 255, 0.9)";
        c.lineWidth = 4;
        c.beginPath();
        c.arc(0, 0, colWidth * 1.25, 0, 6.283);
        c.stroke();
        c.restore();
        if (colHeight > 6 && c.createLinearGradient) {
          const grad = c.createLinearGradient(0, 0, 0, -colHeight);
          grad.addColorStop(0, "rgba(35, 115, 175, 0.85)");
          grad.addColorStop(0.7, "rgba(75, 175, 225, 0.80)");
          grad.addColorStop(1, "rgba(220, 248, 255, 0.95)");
          c.fillStyle = grad;
          c.beginPath();
          c.moveTo(-colWidth * 0.5, 0);
          c.quadraticCurveTo(-colWidth * 0.4, -colHeight * 0.5, -colWidth * 0.6, -colHeight);
          c.lineTo(colWidth * 0.6, -colHeight);
          c.quadraticCurveTo(colWidth * 0.4, -colHeight * 0.5, colWidth * 0.5, 0);
          c.closePath();
          c.fill();
          c.fillStyle = "rgba(240, 252, 255, 0.7)";
          c.fillRect(-colWidth * 0.18, -colHeight, colWidth * 0.36, colHeight);
        }
        c.restore();
      } else {
        const fade = Math.max(0, 1 - (h.t || 0) / (h.duration || 1.35));
        c.save();
        c.translate(vx, vy);
        c.scale(1, 0.55);
        c.strokeStyle = `rgba(180, 235, 255, ${0.5 * fade})`;
        c.lineWidth = 2.5;
        c.beginPath();
        c.arc(0, 0, vr * (1.2 + (1 - fade) * 0.6), 0, 6.283);
        c.stroke();
        c.restore();
      }
    }
    c.restore();
  }

  function drawPortBossHazard(targetCtx, h, elapsed = 0, owner = null) {
    if (!h || !Number.isFinite(h.x) || !Number.isFinite(h.y)) {
      bossHazardPass = "UNHANDLED";
      return false;
    }
    const c = targetCtx || ctx;
    if (!c) {
      bossHazardPass = "UNHANDLED";
      return false;
    }
    const kind = h.kind || "";
    const isStandardKind = kind === "slam" || kind === "charge" || kind === "ring" || kind === "tide";
    const fan = kind === "tidalFan" || kind === "tidal_surge" || kind === "tide_fan";
    const vortex = kind === "rainVortex" || kind === "whirlpool_spout" || kind === "vortex";
    const isWaterFanVortex = fan || vortex;

    // 四標準 kind 走獨立 Boss 圖片 gate (dev=1&bossart=1)；未知 kind、gate 關、缺圖都 false 交 game C3。
    if (isStandardKind) {
      const painterMap = { slam: paintSlam, charge: paintCharge, ring: paintRing, tide: paintTide };
      const painter = painterMap[kind];
      const art = bossHazardArt(kind);
      if (!painter || !art) {
        bossHazardPass = "UNHANDLED";
        return false;
      }
      const phase = h.phase || "telegraph";
      if (!["telegraph", "active", "recovery"].includes(phase)
          || (kind === "charge" && phase !== "telegraph"
            && (!owner || !Number.isFinite(owner.x) || !Number.isFinite(owner.y)))) {
        bossHazardPass = "UNHANDLED";
        return false;
      }
      const alpha = bossPhaseAlpha(h, elapsed, allowsMotion());
      // recovery 淡出完成是真 IMAGE_NOT_DRAWN，不可再閃回 game 舊幾何。
      if (phase === "recovery" && alpha <= 0) {
        bossHazardPass = "IMAGE_NOT_DRAWN";
        return true;
      }
      let drew = 0;
      c.save();
      try {
        c.globalAlpha *= alpha;
        if (kind === "charge" && phase !== "telegraph") {
          drew = painter(c, art, h, owner);
        } else {
          drew = painter(c, art, h, phase, elapsed, allowsMotion());
        }
      } finally {
        c.restore();
      }
      bossHazardPass = drew > 0 ? "IMAGE" : drew < 0 ? "IMAGE_NOT_DRAWN" : "UNHANDLED";
      return drew !== 0;
    }

    // tidalFan / rainVortex：優先走 bossart gate (dev=1&bossart=1) 用專屬圖 (tidalFan_v01/rainVortex_v01)；
    // bossart gate 關時退回 fusion gate 用 ripple；缺圖或兩 gate 關走 TECH_SAFETY_ONLY 幾何，絕不 invisible。
    if (isWaterFanVortex) {
      const bossartOn = typeof window !== "undefined" && window.isBossHazardArtEnabled?.() === true;
      if (bossartOn) {
        const art = bossHazardArt(kind);
        if (art) {
          const phase = h.phase || "telegraph";
          const motion = allowsMotion();
          const alpha = bossPhaseAlpha(h, elapsed, motion);
          if (phase === "recovery" && alpha <= 0) {
            bossHazardPass = "IMAGE_NOT_DRAWN";
            return true;
          }
          let drew = 0;
          c.save();
          try {
            c.globalAlpha *= alpha;
            drew = fan
              ? paintTidalFan(c, art, h, phase, elapsed, motion)
              : paintRainVortex(c, art, h, phase, elapsed, motion);
          } finally {
            c.restore();
          }
          bossHazardPass = drew > 0 ? "IMAGE" : drew < 0 ? "IMAGE_NOT_DRAWN" : "UNHANDLED";
          return drew !== 0;
        }
      }
      // bossart gate 關：退回 fusion gate (dev=1&bossart=1 同義) 用 ripple
      if (bossHazardImageDev()) {
        const img = bossHazardRipple();
        if (img) {
          const phase = h.phase || "telegraph";
          const motion = allowsMotion();
          let drew = 0;
          c.save();
          try {
            drew = fan
              ? paintTidalFan(c, img, h, phase, elapsed, motion)
              : paintRainVortex(c, img, h, phase, elapsed, motion);
          } finally {
            c.restore();
          }
          if (drew > 0) {
            bossHazardPass = "IMAGE";
            return true;
          }
        }
      }
      // TECH_SAFETY_ONLY：缺圖或兩 gate 關都走幾何 fallback，保留可見警示
      paintLegacyPortHazard(c, h, elapsed || 0);
      bossHazardPass = "TECH_SAFETY_ONLY";
      return true;
    }

    // 未知 kind
    bossHazardPass = "UNHANDLED";
    return false;
  }

  // =========================================================================
  function isOrbitBack(ang) {
    return Math.sin(ang) < 0;
  }

  function shouldDrawOrbitFlame(ang, pass = "all") {
    if (pass === "back") return Math.sin(ang) < 0;
    if (pass === "front") return Math.sin(ang) >= 0;
    return true; // "all" 或未指定
  }

  function getOrbitDepthStyle(ang, rank = 1) {
    const sinA = Math.sin(ang);
    const isBack = sinA < 0;
    const motion = allowsMotion();
    const is2D = typeof window.VIEWPORT?.is2D === "function" ? window.VIEWPORT.is2D() : false;
    if (is2D || !motion) {
      return { pass: isBack ? "back" : "front", depthScale: 1, depthAlpha: 1, zIndex: isBack ? -1 : 1 };
    }
    const depthScale = isBack ? (0.90 + 0.10 * (1 + sinA)) : (1.0 + 0.08 * sinA);
    const depthAlpha = isBack ? 0.82 : 1.0;
    return { pass: isBack ? "back" : "front", depthScale, depthAlpha, zIndex: isBack ? -1 : 1 };
  }

  function drawFoxfireOrbit(targetCtx, P, fAng, fireLevel, fireSpec, elapsed = 0, ghosts = [], pass = "all") {
    if (!fireSpec || typeof fireSpec.count !== "number" || fireSpec.count <= 0 || !fireLevel || fireLevel <= 0 || !P) return;
    const count = fireSpec.count;
    const rx = fireSpec.rx ?? fireSpec.r;
    const ry = fireSpec.ry ?? fireSpec.r;
    if (!Number.isFinite(rx) || !Number.isFinite(ry)) return;

    const c = targetCtx || ctx;
    if (!c) return;
    const awaySlots = new Set(
      (ghosts || []).filter(p => p.fireAttack && p.life > 0 && p.level === fireLevel).map(p => p.slot)
    );
    const viewport = window.VIEWPORT;
    const is2D = typeof viewport?.is2D === "function" ? viewport.is2D() : false;

    for (let i = 0; i < count; i++) {
      if (awaySlots.has(i)) continue;
      const a = fAng + (i * 6.2831853) / count;
      const sinA = Math.sin(a);
      const isBack = sinA < 0;

      // Pass 判定：'back' 只畫背後半圈，'front' 只畫前瞻半圈，'all' 全畫
      if (pass === "back" && !isBack) continue;
      if (pass === "front" && isBack) continue;

      const fx = P.x + Math.cos(a) * rx;
      const fy = P.y + sinA * ry;

      const style = getOrbitDepthStyle(a, fireLevel);

      const paintFlame = () => {
        c.save();
        c.globalAlpha *= style.depthAlpha;
        if (style.depthScale !== 1) {
          c.translate(fx, fy);
          c.scale(style.depthScale, style.depthScale);
          c.translate(-fx, -fy);
        }
        if (window.SKILLFX?.paint) {
          window.SKILLFX.paint(c, "fire", fireLevel, {
            x: fx, y: fy, ang: a, origin: P, orbitR: rx, orbitRy: ry, rx, ry,
            time: elapsed + i * 0.2, orbit: true, depthScale: style.depthScale, isBack
          });
        }
        c.restore();
      };

      if (!is2D && viewport?.upright) {
        viewport.upright(c, fx, fy, paintFlame);
      } else {
        paintFlame();
      }
    }
  }

  // =========================================================================
  // M2-FUSION-ART-BIND-R1：十招真圖 phase 綁定層（DEV-ONLY 嚴格模式）
  //
  // 生效門檻（assets.js 唯一真實來源）：window.isFusionArtBindEnabled() === true
  //   ⇔ dev=1 (all stages), except fusionart=legacy/gpt or mismatched explicit candidate flags
  // 正式模式（無 dev）一律不載入未核准候選圖；開發測試不依賴 stageId。
  // 這一層完全不畫、不載，既有程序幾何與正式資產路徑完全不變。
  //
  // phase 位置規則：
  //   main   直立（upright）貼施法點／攻擊方向，隨攻擊角旋轉
  //   hit    直立（upright）貼命中點／爆點
  //   ground 世界座標貼地面位置（素材自帶透視比例，用 upright 保持作者視角）
  //   icon   直立小徽章（僅真的有 icon 檔時才畫）
  //
  // 所有候選圖皆為 ART_CANDIDATE / WAITING_ART，只在 dev 門檻內使用，
  // 不覆蓋 assets/img/ 正式資產、不搬移原檔。
  // =========================================================================
  function fusionBindEnabled(kind = null) {
    return typeof window !== "undefined"
      && typeof window.isFusionArtBindEnabled === "function"
      && window.isFusionArtBindEnabled(kind) === true;
  }

  // 取某招某 phase 的真圖（未就緒回 null，不丟錯、不阻塞）
  function fusionBindArt(kind, phase) {
    if (!fusionBindEnabled(kind)) return null;
    if (typeof window.getFusionPhaseArt !== "function") return null;
    const img = window.getFusionPhaseArt(kind, phase);
    return img && img.naturalWidth > 0 ? img : null;
  }

  function fusionBindDef(kind, phase) {
    if (typeof window === "undefined" || typeof window.getFusionArtBindDef !== "function") return null;
    return window.getFusionArtBindDef(kind, phase);
  }

  // 以來源圖的 alpha 內容框裁切後貼圖，避免 1264x848 透明邊界造成偏移與縮小
  function fusionBindSourceRect(kind, phase, img) {
    const def = fusionBindDef(kind, phase);
    const iw = (img && img.naturalWidth) || (def && def.size && def.size[0]) || 1;
    const ih = (img && img.naturalHeight) || (def && def.size && def.size[1]) || 1;
    const b = def && def.bbox;
    if (b && b.length === 4 && b[2] > b[0] && b[3] > b[1]) {
      return { sx: b[0], sy: b[1], sw: b[2] - b[0], sh: b[3] - b[1] };
    }
    return { sx: 0, sy: 0, sw: iw, sh: ih };
  }

  /**
   * 貼一張 phase 真圖。
   * opt: { kind, phase, x, y, width, alpha, flipX, rotate, centerX, anchorY, line }
   *   centerX=true → 以 x 為中心；false → 由 x 起算向右延伸（前向錨點）
   *   anchorY      → 0=貼地、0.5=垂直置中、1=貼頂
   *   line         → 可選 { angle, length, hilt, tip, anchor }，把裁切弦貼上攻擊線
   */
  function drawFusionBindImage(c, img, opt) {
    const def = fusionBindDef(opt.kind, opt.phase);
    if (!img || !def) return false;
    const src = fusionBindSourceRect(opt.kind, opt.phase, img);
    const targetW = Math.max(1, opt.width || 120);
    const targetH = targetW * (src.sh / src.sw);
    const anchorY = opt.anchorY == null ? 0.5 : opt.anchorY;
    const dx = opt.centerX ? -targetW * 0.5 : 0;
    const dy = -targetH * anchorY;
    c.save();
    c.globalAlpha *= Math.max(0, Math.min(1, opt.alpha == null ? 1 : opt.alpha));
    if (opt.filter) c.filter = opt.filter;
    if (opt.composite) c.globalCompositeOperation = opt.composite;
    c.translate(opt.x, opt.y);
    if (opt.line && opt.line.hilt && opt.line.tip) {
      const sw = src.sw || 1;
      const sh = src.sh || 1;
      const du = opt.line.tip[0] - opt.line.hilt[0];
      const dv = opt.line.tip[1] - opt.line.hilt[1];
      const srcLen = Math.hypot(du, dv) || 1;
      const destLen = Math.max(1, opt.line.length || 1);
      const targetW = destLen * sw / srcLen;
      const targetH = targetW * (sh / sw);
      const hx = (opt.line.hilt[0] / sw) * targetW;
      const hy = (opt.line.hilt[1] / sh) * targetH;
      c.rotate(opt.line.angle || 0);
      if (opt.line.anchor === "center") c.translate(-destLen * 0.5, 0);
      c.rotate(-Math.atan2(dv, du));
      c.translate(-hx, -hy);
      c.drawImage(img, src.sx, src.sy, src.sw, src.sh, 0, 0, targetW, targetH);
      c.restore();
      return true;
    }
    if (opt.rotate) c.rotate(opt.rotate);
    if (opt.flipX) {
      c.translate(opt.centerX ? 0 : targetW, 0);
      c.scale(-1, 1);
    }
    c.drawImage(img, src.sx, src.sy, src.sw, src.sh, dx, dy, targetW, targetH);
    c.restore();
    return true;
  }

  // 直立繪製（抵消 2.5D 的 y 壓縮，讓素材保持原比例）
  function fusionBindUpright(c, x, y, draw) {
    const viewport = typeof window !== "undefined" ? window.VIEWPORT : null;
    if (viewport && typeof viewport.upright === "function") return viewport.upright(c, x, y, draw);
    draw();
    return true;
  }

  // 真圖 phase 綁定層：回傳 true 表示此招的視覺已由真圖接管
  function drawFusionBindLayers(c, effect, is2D, tilt, motion, elapsed) {
    const kind = effect.kind;
    if (!fusionBindEnabled(kind)) return false;
    const phase = effect.phase || "active";
    const progress = Number.isFinite(effect.progress) ? Math.max(0, Math.min(1, effect.progress)) : 0;
    const x = Number.isFinite(effect.x) ? effect.x : 0;
    const y = Number.isFinite(effect.y) ? effect.y : 0;
    const angle = Number.isFinite(effect.angle) ? effect.angle : 0;
    const radius = Number.isFinite(effect.radius) ? effect.radius : 200;
    const burnAge = Number.isFinite(effect.burnAge) ? effect.burnAge : 0;

    // 亮度包絡由招式生命週期決定：預警即顯圖，active 保持明亮，最後 20% 再淡出。
    // 避免 sin(progress*PI) 在施法初期幾乎不可見、進入 fade 又立刻消失。
    const env = phase === "warn"
      ? 0.68 + 0.06 * Math.sin(elapsed * 8)
      : phase === "active"
        ? 0.96
        : Math.max(0, Math.min(0.96, 0.96 * (1 - progress) / 0.2));

    // 距離上一次脈衝的時間（用於 hit phase 的閃光包絡）
    const pulseFlash = (interval) => {
      const idx = Number.isFinite(effect.pulseIndex) ? effect.pulseIndex : 0;
      if (idx <= 0) return 0;
      const next = Number.isFinite(effect.nextPulse) ? effect.nextPulse : 0;
      const last = next - (interval || 0.35);
      const t = burnAge - last;
      if (t < 0 || t > 0.28) return 0;
      return Math.max(0, 1 - t / 0.28);
    };

    const drawIcon = (ix, iy, alpha) => {
      const icon = fusionBindArt(kind, "icon");
      if (!icon) return;
      const def = fusionBindDef(kind, "icon");
      if (!def || def.fallback || def.file === fusionBindDef(kind, "main")?.file) return;
      fusionBindUpright(c, ix, iy, () => {
        drawFusionBindImage(c, icon, {
          kind, phase: "icon", x: ix, y: iy, width: 30, alpha: alpha * 0.9, centerX: true, anchorY: 0.5
        });
      });
    };
    const main = fusionBindArt(kind, "main");
    // A pending/failed main image must NOT silently suppress all existing fallback FX.
    if (!main) return false;
    const mainFile = fusionBindDef(kind, "main")?.file;
    // 主圖裁切不是獨立 hit/ground 圖，不重複蓋三次冒充完整 phase。
    const hit = fusionBindDef(kind, "hit")?.file === mainFile ? null : fusionBindArt(kind, "hit");
    const ground = fusionBindDef(kind, "ground")?.file === mainFile ? null : fusionBindArt(kind, "ground");

    const paintKind = () => {

    // ---- #1 墨焰斬：主體刀光 + 地面焦痕 + 命中爆點 ----
    if (kind === "fusion_inkblade") {
      if (ground && (phase === "active" || phase === "fade")) {
        const burnDuration = Number.isFinite(effect.burnDuration) ? effect.burnDuration : 0.8;
        const scorch = phase === "active"
          ? Math.min(1, progress * 1.8) * Math.max(0, 1 - burnAge / (burnDuration || 0.8))
          : Math.max(0, 1 - progress) * Math.max(0, 1 - burnAge / (burnDuration || 0.8));
        fusionBindUpright(c, x, y, () => {
          drawFusionBindImage(c, ground, {
            kind, phase: "ground", x, y, width: radius * 1.55, alpha: env * scorch * 0.16,
            rotate: angle, centerX: true, anchorY: 0.5
          });
        });
      }
      if (main) {
        fusionBindUpright(c, x, y, () => {
          drawFusionBindImage(c, main, {
            kind, phase: "main", x, y, width: radius * 0.94, alpha: env * (burnAge < 0.22 ? 0.96 : burnAge < 0.42 ? 0.78 : 0.48), filter: "brightness(1.42) saturate(1.20)",
            rotate: angle, flipX: true, anchorY: 0.5
          });
        });
      }
      if (hit && phase !== "warn") {
        const hx = x + Math.cos(angle) * radius * 0.55;
        const hy = y + Math.sin(angle) * radius * 0.55;
        fusionBindUpright(c, hx, hy, () => {
          drawFusionBindImage(c, hit, {
            kind, phase: "hit", x: hx, y: hy, width: radius * 0.54, alpha: env * 0.40, centerX: true, anchorY: 0.5
          });
        });
      }
      drawIcon(x - 96, y - 104, env);
      return true;
    }

    // ---- #2 斬界輪：旋轉輪刃（隨 currentRadius 展開） ----
    if (kind === "fusion_slashwheel") {
      // DEV reuse phases: only existing main-image crops; no new source artwork.
      const reusePoints = [{ x, y, r: Math.max(45, (effect.currentRadius || radius * 0.35)) }];
      for (const pt of reusePoints) {
        if (ground) {
          fusionBindUpright(c, pt.x, pt.y, () => {
            drawFusionBindImage(c, ground, {
              kind, phase: "ground", x: pt.x, y: pt.y, width: pt.r * 1.8,
              alpha: env * 0.70, centerX: true, anchorY: 0.5
            });
          });
        }
        if (hit && phase !== "warn") {
          fusionBindUpright(c, pt.x, pt.y, () => {
            drawFusionBindImage(c, hit, {
              kind, phase: "hit", x: pt.x, y: pt.y, width: pt.r * 1.4,
              alpha: env * 0.9, centerX: true, anchorY: 0.5
            });
          });
        }
      }

      if (main) {
        const cur = Number.isFinite(effect.currentRadius) && effect.currentRadius > 0
          ? effect.currentRadius
          : radius * 0.35;
        fusionBindUpright(c, x, y, () => {
          drawFusionBindImage(c, main, {
            kind, phase: "main", x, y, width: Math.max(90, cur * 2), alpha: env * 0.95,
            rotate: motion ? elapsed * 2.6 : 0, centerX: true, anchorY: 0.5
          });
        });
      }
      drawIcon(x - 96, y - 104, env);
      return true;
    }

    // ---- #3 雷狐居合：主軸對齊 lineTargets 前向射線（t=0..radius），不用 target 覆寫 ----
    // upright 抵消 tilt 後，世界向 (cos θ, sin θ) 的螢幕向是 atan2(k sin θ, cos θ)。
    // 弦長 reach*hypot(cos θ, k sin θ) 時，尖端才落在投影後的攻擊線終點。
    // 端點是 R4 裁切內不透明端點；尖端在圖的 +X。命中只畫 hitSet 上的敵人。
    if (kind === "fusion_foxiai") {
      const kTilt = Number.isFinite(tilt) && tilt > 0 ? tilt : 1;
      const cth = Math.cos(angle);
      const sth = Math.sin(angle);
      const hyp = Math.hypot(cth, kTilt * sth) || 1;
      const screenAngle = Math.atan2(kTilt * sth, cth);
      const reachPx = radius * hyp;
      const chord = {
        main: { hilt: [0, 297], tip: [1115, 10] },
        ground: { hilt: [0, 80], tip: [1097, 72] },
        hit: { hilt: [0, 532.5], tip: [644, 77] }
      };
      const paintLine = (img, phaseName, atX, atY, length, anchor, alpha) => {
        fusionBindUpright(c, atX, atY, () => {
          drawFusionBindImage(c, img, {
            kind, phase: phaseName, x: atX, y: atY, alpha,
            line: {
              angle: screenAngle, length, anchor,
              hilt: chord[phaseName].hilt, tip: chord[phaseName].tip
            }
          });
        });
      };
      if (ground) paintLine(ground, "ground", x, y, reachPx, "hilt", env * 0.85);
      if (main) paintLine(main, "main", x, y, reachPx, "hilt", env);
      if (hit && phase !== "warn" && effect.hitSet && typeof effect.hitSet[Symbol.iterator] === "function") {
        const hitDef = fusionBindDef(kind, "hit");
        const hitSw = hitDef && hitDef.bbox && hitDef.bbox[2] > hitDef.bbox[0] ? hitDef.bbox[2] - hitDef.bbox[0] : 1;
        const hitSrc = Math.hypot(chord.hit.tip[0] - chord.hit.hilt[0], chord.hit.tip[1] - chord.hit.hilt[1]) || 1;
        const hitLen = Math.max(1, radius * 0.8 * hitSrc / hitSw);
        for (const e of effect.hitSet) {
          if (!e || !Number.isFinite(e.x) || !Number.isFinite(e.y)) continue;
          paintLine(hit, "hit", e.x, e.y, hitLen, "center", env * 0.95);
        }
      }
      drawIcon(x - 96, y - 104, env);
      return true;
    }

    // ---- #4 退魔符刃：符刃斬 + 每個符印爆點 + 地面火痕 ----
    if (kind === "fusion_exorcistblade") {
      if (ground) {
        fusionBindUpright(c, x, y, () => {
          drawFusionBindImage(c, ground, {
            kind, phase: "ground", x, y, width: radius * 1.6, alpha: env * 0.85,
            rotate: angle, centerX: true, anchorY: 0.5
          });
        });
      }
      if (main) {
        fusionBindUpright(c, x, y, () => {
          drawFusionBindImage(c, main, {
            kind, phase: "main", x, y, width: radius * 1.1, alpha: env,
            rotate: angle, flipX: true, anchorY: 0.5
          });
        });
      }
      if (hit && phase !== "warn") {
        const marks = Array.isArray(effect.marks) ? effect.marks : [];
        const triggered = marks.filter(m => m && m.triggered && m.target);
        if (triggered.length) {
          for (const m of triggered) {
            const mx = m.target.x, my = m.target.y;
            const mr = Number.isFinite(m.radius) ? m.radius : 90;
            fusionBindUpright(c, mx, my, () => {
              drawFusionBindImage(c, hit, {
                kind, phase: "hit", x: mx, y: my, width: mr * 2.2, alpha: env * 0.95, centerX: true, anchorY: 0.5
              });
            });
          }
        } else {
          fusionBindUpright(c, x, y, () => {
            drawFusionBindImage(c, hit, {
              kind, phase: "hit", x, y, width: radius * 0.8, alpha: env * 0.9, centerX: true, anchorY: 0.5
            });
          });
        }
      }
      drawIcon(x - 96, y - 104, env);
      return true;
    }

    // ---- #5 妖火結界：火地 → 暖封界 → 短脈衝。預警只鋪地，命中不常駐遮人。 ----
    if (kind === "fusion_foxfirebarrier") {
      const flash = pulseFlash(effect.pulseInterval);
      if (ground) {
        const groundAlpha = phase === "active" ? Math.min(env * 0.5, 0.40)
          : phase === "warn" ? Math.min(env * 0.28, 0.16)
          : Math.min(env * 0.22, 0.12);
        fusionBindUpright(c, x, y, () => {
          drawFusionBindImage(c, ground, {
            kind, phase: "ground", x, y, width: radius * (phase === "warn" ? 1.25 : 1.9),
            alpha: groundAlpha, centerX: true, anchorY: 0.5
          });
        });
      }
      if (main && phase !== "warn") {
        const sealAlpha = phase === "active" ? Math.min(env * 0.72, 0.50) : Math.min(env * 0.3, 0.18);
        fusionBindUpright(c, x, y, () => {
          drawFusionBindImage(c, main, {
            kind, phase: "main", x, y, width: radius * 1.7, alpha: sealAlpha, centerX: true, anchorY: 0.5
          });
        });
      }
      if (hit && phase === "active" && flash > 0) {
        fusionBindUpright(c, x, y, () => {
          drawFusionBindImage(c, hit, {
            kind, phase: "hit", x, y, width: radius * 2.0,
            alpha: Math.min(0.35, flash * 0.35), centerX: true, anchorY: 0.5
          });
        });
      }
      drawIcon(x - 96, y - 104, env);
      return true;
    }

    // ---- #6 狐雷天燈：每盞燈籠掛真圖 ----
    if (kind === "fusion_foxthunderlantern") {
      // DEV reuse phases: only existing main-image crops; no new source artwork.
      const reusePoints = (Array.isArray(effect.lanterns) ? effect.lanterns : []).filter(ln => ln && ln.struck).map(ln => ({ x: Number.isFinite(ln.targetX) ? ln.targetX : x, y: Number.isFinite(ln.targetY) ? ln.targetY : y, r: effect.strikeRadius || 64 }));
      for (const pt of reusePoints) {
        if (ground) {
          fusionBindUpright(c, pt.x, pt.y, () => {
            drawFusionBindImage(c, ground, {
              kind, phase: "ground", x: pt.x, y: pt.y, width: pt.r * 1.8,
              alpha: env * 0.70, centerX: true, anchorY: 0.5
            });
          });
        }
        if (hit && phase !== "warn") {
          fusionBindUpright(c, pt.x, pt.y, () => {
            drawFusionBindImage(c, hit, {
              kind, phase: "hit", x: pt.x, y: pt.y, width: pt.r * 1.4,
              alpha: env * 0.9, centerX: true, anchorY: 0.5
            });
          });
        }
      }

      if (main) {
        const lanterns = Array.isArray(effect.lanterns) ? effect.lanterns : [];
        for (const ln of lanterns) {
          if (!ln) continue;
          const lx = Number.isFinite(ln.x) ? ln.x : x;
          const ly = Number.isFinite(ln.y) ? ln.y : y;
          fusionBindUpright(c, lx, ly, () => {
            drawFusionBindImage(c, main, {
              kind, phase: "main", x: lx, y: ly, width: 132,
              alpha: env * (ln.struck ? 0.90 : 1), filter: "brightness(1.3) saturate(1.2)", centerX: true, anchorY: 0.5
            });
          });
        }
      }
      drawIcon(x - 96, y - 104, env);
      return true;
    }

    // ---- #7 炎符祭：施放點火符爆 + 每張符引爆點 ----
    if (kind === "fusion_flamefestival") {
      // DEV reuse phases: only existing main-image crops; no new source artwork.
      const reusePoints = (Array.isArray(effect.talismans) ? effect.talismans : []).filter(t => t && t.exploded).map(t => ({ x: Number.isFinite(t.x) ? t.x : x, y: Number.isFinite(t.y) ? t.y : y, r: effect.landRadius || 62 }));
      for (const pt of reusePoints) {
        if (ground) {
          fusionBindUpright(c, pt.x, pt.y, () => {
            drawFusionBindImage(c, ground, {
              kind, phase: "ground", x: pt.x, y: pt.y, width: pt.r * 1.8,
              alpha: env * 0.70, centerX: true, anchorY: 0.5
            });
          });
        }
        if (hit && phase !== "warn") {
          fusionBindUpright(c, pt.x, pt.y, () => {
            drawFusionBindImage(c, hit, {
              kind, phase: "hit", x: pt.x, y: pt.y, width: pt.r * 1.4,
              alpha: env * 0.9, centerX: true, anchorY: 0.5
            });
          });
        }
      }

      if (main) {
        fusionBindUpright(c, x, y, () => {
          drawFusionBindImage(c, main, {
            kind, phase: "main", x, y, width: radius * 1.2, alpha: env * 0.9, centerX: true, anchorY: 0.5
          });
        });
        const talismans = Array.isArray(effect.talismans) ? effect.talismans : [];
        for (const t of talismans) {
          if (!t || !t.exploded) continue;
          const tx = Number.isFinite(t.x) ? t.x : x;
          const ty = Number.isFinite(t.y) ? t.y : y;
          const land = Number.isFinite(effect.landRadius) ? effect.landRadius : 62;
          fusionBindUpright(c, tx, ty, () => {
            drawFusionBindImage(c, main, {
              kind, phase: "main", x: tx, y: ty, width: land * 2.2, alpha: env * 0.85, centerX: true, anchorY: 0.5
            });
          });
        }
      }
      drawIcon(x - 96, y - 104, env);
      return true;
    }

    // ---- #8 雷陣封界：明亮印紋作主圖，落雷單獨用現有 thunder 真圖。
    // 早期 A/B 值 0.25~0.48 在場景過於模糊，預設改為高對比；legacy 仍可用網址切回。
    if (kind === "fusion_thundercircle") {
      const fieldW = radius * 1.50;

      // 判定可視性強度選項 (全域變數或 URL 參數)：
      // 預設為 Option A (0.48)；支援 Option B (0.58) 與 Baseline (0.25)
      let tcMode = "A";
      if (typeof window !== "undefined") {
        if (window.__thundercircleVisibilityOption === "B" || window.__thundercircleVisibilityOption === "high") {
          tcMode = "B";
        } else if (window.__thundercircleVisibilityOption === "baseline" || window.__thundercircleVisibilityOption === "0.25") {
          tcMode = "baseline";
        } else if (typeof URLSearchParams !== "undefined" && window.location && window.location.search) {
          try {
            const sp = new URLSearchParams(window.location.search);
            const tcParam = sp.get("tc_opt") || sp.get("thundercircle_alpha");
            if (tcParam === "B" || tcParam === "high" || tcParam === "0.58") tcMode = "B";
            else if (tcParam === "baseline" || tcParam === "0.25") tcMode = "baseline";
          } catch {}
        }
      }

      if (ground) {
        const groundAlpha = tcMode === "B"
          ? (phase === "active" ? Math.min(env * 0.55, 0.24)
            : phase === "warn" ? Math.min(env * 0.18, 0.12)
            : Math.min(env * 0.15, 0.08))
          : tcMode === "baseline"
            ? (phase === "active" ? Math.min(env * 0.45, 0.12)
              : phase === "warn" ? Math.min(env * 0.16, 0.08)
              : Math.min(env * 0.12, 0.06))
            : (phase === "active" ? Math.min(env * 0.46, 0.36)
              : phase === "warn" ? Math.min(env * 0.38, 0.26)
              : Math.min(env * 0.42, 0.30));

        fusionBindUpright(c, x, y, () => {
          drawFusionBindImage(c, ground, {
            kind, phase: "ground", x, y, width: phase === "warn" ? radius * 1.05 : fieldW,
            alpha: groundAlpha, centerX: true, anchorY: 0.5
          });
        });
      }
      if (main) {
        const sealAlpha = tcMode === "B"
          ? (phase === "active" ? Math.min(env * 0.95, 0.58)
            : phase === "warn" ? Math.min(env * 0.24, 0.18)
            : Math.min(env * 0.30, 0.22))
          : tcMode === "baseline"
            ? (phase === "active" ? Math.min(env * 0.95, 0.25)
              : phase === "warn" ? Math.min(env * 0.18, 0.10)
              : Math.min(env * 0.25, 0.12))
            : (phase === "active" ? Math.min(env * 0.96, 0.88)
              : phase === "warn" ? Math.min(env * 0.90, 0.56)
              : Math.min(env * 0.90, 0.77));

        fusionBindUpright(c, x, y, () => {
          drawFusionBindImage(c, main, {
            kind, phase: "main", x, y, width: phase === "warn" ? radius * 1.50 : radius * 1.80,
            alpha: sealAlpha, filter: "brightness(1.55) saturate(1.35)", composite: "screen", centerX: true, anchorY: 0.5
          });
        });
      }
      if (hit && phase === "active" && Array.isArray(effect.strikes)) {
        for (const s of effect.strikes) {
          if (!s || s.triggered !== true || !Number.isFinite(s.x) || !Number.isFinite(s.y)) continue;
          const age = -Number(s.delay);
          if (!(age >= 0 && age <= 0.28)) continue;
          const bolt = Math.min(0.35, (1 - age / 0.28) * 0.35);
          const sr = Number.isFinite(s.radius) ? s.radius : 90;
          fusionBindUpright(c, s.x, s.y, () => {
            drawFusionBindImage(c, hit, {
              kind, phase: "hit", x: s.x, y: s.y, width: sr * 1.6,
              alpha: bolt, centerX: true, anchorY: 0.5
            });
          });
        }
      }
      // 命中點用既有天狐雷圖；此圖的保護機制不依賴候選 hit 是否獨立出圖。
      const strikeImg = window.thunderRasterArt?.("strike") || window.skillVfxArt?.("thunder", 3);
      if (strikeImg?.naturalWidth && Array.isArray(effect.strikes)) {
        for (const strike of effect.strikes) {
          if (!strike.triggered || !Number.isFinite(strike.x) || !Number.isFinite(strike.y)) continue;
          const age = -Number(strike.delay);
          if (age < 0 || age > 0.34) continue;
          const w = 132, h = w * strikeImg.naturalHeight / strikeImg.naturalWidth;
          fusionBindUpright(c, strike.x, strike.y, () => {
            c.save();
            c.globalAlpha *= Math.max(0, 1 - age / 0.34);
            c.filter = "brightness(1.35) saturate(1.2)";
            c.drawImage(strikeImg, strike.x - w / 2, strike.y - h * 0.82, w, h);
            c.restore();
          });
        }
      }
      drawIcon(x - 96, y - 104, env);
      return true;
    }

    // ---- #9 退魔封陣：符爆主體 + 落點封陣 + 地面封陣 ----
    if (kind === "fusion_exorcistseal") {
      if (ground) {
        fusionBindUpright(c, x, y, () => {
          drawFusionBindImage(c, ground, {
            kind, phase: "ground", x, y, width: radius * 1.9, alpha: env * 0.8, centerX: true, anchorY: 0.5
          });
        });
      }
      if (hit) {
        const flash = pulseFlash(effect.pulseInterval);
        const a = flash > 0 ? flash : env * 0.6;
        fusionBindUpright(c, x, y, () => {
          drawFusionBindImage(c, hit, {
            kind, phase: "hit", x, y, width: radius * 2.0, alpha: a * 0.95, centerX: true, anchorY: 0.5
          });
        });
      }
      if (main) {
        fusionBindUpright(c, x, y, () => {
          drawFusionBindImage(c, main, {
            kind, phase: "main", x, y, width: radius * 1.4, alpha: env * 0.9, centerX: true, anchorY: 0.5
          });
        });
      }
      drawIcon(x - 96, y - 104, env);
      return true;
    }

    // ---- #10 雷符神罰：單一主爆炸 + 既有雷擊圖逐敵 ----
    if (kind === "fusion_thundertalisman") {
      const burnAge = Number.isFinite(effect.burnAge) ? effect.burnAge : 0;
      const strikeRadius = Number.isFinite(effect.strikeRadius) ? effect.strikeRadius : 70;
      const mainExplosionDuration = 0.30;
      const explosionAge = burnAge - (effect.hitEvents?.[0]?.at ?? effect.firstHitAt ?? 0.36);

      // Main explosion: one controlled burst at center (x, y)
      // 0.15-0.25s: scale overshoot -> subtle jitter -> fade out
      if (main && phase !== "warn" && explosionAge >= 0 && explosionAge <= mainExplosionDuration) {
        const t = explosionAge / mainExplosionDuration;
        let scale = 1;
        let alpha = 1;
        let jitterX = 0;
        let jitterY = 0;
        if (t < 0.5) {
          const u = t / 0.5;
          scale = 0.3 + 1.2 * u * u * (3 - 2 * u);
          alpha = 0.9 * (1 - u * 0.3);
        } else {
          const u = (t - 0.5) / 0.5;
          scale = 1.5 - 0.5 * u;
          alpha = 0.6 * (1 - u);
          const jitterAmount = 4 * (1 - u);
          jitterX = (Math.sin(burnAge * 60) * jitterAmount);
          jitterY = (Math.cos(burnAge * 47) * jitterAmount);
        }
        fusionBindUpright(c, x + jitterX, y + jitterY, () => {
          drawFusionBindImage(c, main, {
            kind, phase: "main", x: x + jitterX, y: y + jitterY,
            width: radius * 1.2 * scale, alpha: env * alpha, centerX: true, anchorY: 0.5
          });
        });
      }

      // Per-hit secondary lightning using existing thunder_strike image
      if (phase !== "warn") {
        const thunderImg = (typeof window !== "undefined" && window.thunderRasterArt)
          ? window.thunderRasterArt("strike")
          : (typeof window !== "undefined" ? window.ART?.thunder_raster_strike : null);
        if (thunderImg && thunderImg.naturalWidth) {
          const events = Array.isArray(effect.hitEvents) ? effect.hitEvents : [];
          for (const t of events) {
            if (!t || !Number.isFinite(t.at)) continue;
            const tx = Number.isFinite(t.x) ? t.x : x;
            const ty = Number.isFinite(t.y) ? t.y : y;
            const hitAge = burnAge - t.at;
            if (hitAge < 0 || hitAge > 0.25) continue;
            const hitAlpha = Math.max(0, 1 - hitAge / 0.25);
            fusionBindUpright(c, tx, ty, () => {
              c.save();
              c.globalAlpha = env * hitAlpha * 0.85;
              const w = strikeRadius * 1.4;
              const h = w * (thunderImg.naturalHeight / thunderImg.naturalWidth);
              c.drawImage(thunderImg, tx - w / 2, ty - h / 2, w, h);
              c.restore();
            });
          }
        }
      }

      drawIcon(x - 96, y - 104, env);
      return true;
    }

    return false;
    };

    const painted = paintKind();
    if (!painted) return false;

    // 詳細載入狀態可在 console 查 window.getFusionArtBindReport()；戰鬥畫布不放診斷字。
    return true;
  }

  // =========================================================================
  // F0/F1-A 合技渲染原型：墨焰斬 (fusion_inkblade) 與雷紋陣 (fusion_thundercircle)
  // 共享入口：RENDERER.drawFusionFx(targetCtx, effect, elapsed)
  // Payload 契約：{ kind, phase: 'warn'|'active'|'fade', x, y, angle, radius, progress, seed, ... }
  // =========================================================================
  function drawFusionInkblade(c, x, y, angle, radius, spread, phase, progress, seed, burnDuration, burnAge, is2D, tilt, motion, elapsed) {
    c.save();

    // M2-FUSION-ART-BIND-R1：bind 模式下真圖 ground phase 取代這段程序焦痕。
    const bindOwnsGround = fusionBindEnabled("fusion_inkblade") && !!fusionBindArt("fusion_inkblade", "main");

    // 1. 地面焦墨與狐火裂隙 (Ground Scorch Layer - 2.5D tilt 扁平投影)
    // warn 階段不畫地面焦痕；active 隨進度刻印；fade 隨 burnAge / progress 淡出
    if (!bindOwnsGround && (phase === "active" || phase === "fade")) {
      const scorchProgress = phase === "active" ? Math.min(1, progress * 1.8) : Math.max(0, 1 - progress);
      const scorchDecay = Math.max(0, 1 - (burnAge / (burnDuration || 0.8)));
      const scorchAlpha = scorchProgress * scorchDecay;

      if (scorchAlpha > 0.01) {
        c.save();
        c.translate(x, y);
        if (!is2D) {
          c.scale(1, tilt); // 2.5D 地面透視扁平化
        }
        c.rotate(angle);

        const halfSpread = spread * 0.5;
        const groundR = radius * 0.92;

        // 1-A. 和紙焦墨染底 (Charcoal Sumi Stain)
        c.fillStyle = `rgba(14, 10, 18, ${0.42 * scorchAlpha})`;
        c.beginPath();
        c.moveTo(0, 0);
        c.arc(0, 0, groundR, -halfSpread, halfSpread);
        c.closePath();
        c.fill();

        // 1-B. 地表粗墨撕裂放射紋 (Radiating Sumi Fissures)
        const crackCount = 7;
        c.lineCap = "round";
        for (let i = 0; i < crackCount; i++) {
          const t = (i / (crackCount - 1)) * 2 - 1; // -1 to 1
          const crackAng = t * halfSpread * 0.92;
          const crackLen = groundR * (0.65 + 0.35 * Math.abs(Math.sin(seed * 3.7 + i * 1.9)));
          const midWiggle = (Math.sin(seed * 7.1 + i * 2.3) * 12);

          // 墨痕深溝
          c.strokeStyle = `rgba(22, 14, 26, ${0.78 * scorchAlpha})`;
          c.lineWidth = 3.6;
          c.beginPath();
          c.moveTo(0, 0);
          const midX = Math.cos(crackAng) * crackLen * 0.5 - Math.sin(crackAng) * midWiggle;
          const midY = Math.sin(crackAng) * crackLen * 0.5 + Math.cos(crackAng) * midWiggle;
          const endX = Math.cos(crackAng) * crackLen;
          const endY = Math.sin(crackAng) * crackLen;
          c.quadraticCurveTo(midX, midY, endX, endY);
          c.stroke();

          // 1-C. 焦縫內嵌狐火微溫 (Inner Foxfire Glowing Crevice)
          c.strokeStyle = `rgba(255, 95, 20, ${0.85 * scorchAlpha})`;
          c.lineWidth = 1.8;
          c.beginPath();
          c.moveTo(0, 0);
          c.quadraticCurveTo(midX, midY, endX * 0.85, endY * 0.85);
          c.stroke();

          // 熾熱白金節點 (Hot Ember Nodes)
          c.fillStyle = `rgba(255, 235, 160, ${0.92 * scorchAlpha})`;
          c.beginPath();
          c.arc(midX * 0.7, midY * 0.7, 2.0, 0, 6.283);
          c.fill();
        }

        // 1-D. 弧外緣焦墨毛邊 (Jagged outer rim)
        c.strokeStyle = `rgba(18, 12, 22, ${0.55 * scorchAlpha})`;
        c.lineWidth = 2.4;
        c.setLineDash([12, 8]);
        c.beginPath();
        c.arc(0, 0, groundR * 0.96, -halfSpread * 0.98, halfSpread * 0.98);
        c.stroke();
        c.setLineDash([]);

        c.restore();
      }
    }

    // 2. 拔刀大型扇形破空墨焰斬 (Airborne Slashing Blade - Upright)
    const paintBlade = () => {
      c.save();
      c.translate(x, y);

      if (phase === "warn") {
        // 蓄勢前搖 (Telegraph & Ink Gather)
        const warnAlpha = 0.35 + 0.35 * Math.sin(elapsed * 12);
        const halfSpread = spread * 0.5;

        // 預警扇面虛線
        c.strokeStyle = `rgba(255, 75, 30, ${warnAlpha * 0.75})`;
        c.lineWidth = 2.0;
        c.setLineDash([8, 6]);
        c.beginPath();
        c.arc(0, 0, radius, angle - halfSpread, angle + halfSpread);
        c.stroke();
        c.setLineDash([]);

        // 刀心向內收束墨流 (Inward gathering ink trails)
        c.strokeStyle = `rgba(16, 12, 22, ${warnAlpha * 0.85})`;
        c.lineWidth = 2.5;
        for (let i = 0; i < 4; i++) {
          const a = angle - halfSpread + (i / 3) * spread;
          const gatherR = radius * (0.4 + 0.5 * ((1 - progress + i * 0.25) % 1));
          c.beginPath();
          c.moveTo(Math.cos(a) * gatherR, Math.sin(a) * gatherR);
          c.lineTo(Math.cos(a) * (gatherR * 0.6), Math.sin(a) * (gatherR * 0.6));
          c.stroke();
        }

        // 刀柄聚集狐火星子
        c.fillStyle = `rgba(255, 180, 60, ${warnAlpha * 0.9})`;
        c.beginPath();
        c.arc(0, 0, 4.5, 0, 6.283);
        c.fill();
        c.restore();
        return;
      }

      // active & fade
      const bladeAlpha = phase === "active"
        ? Math.min(1, Math.sin(progress * Math.PI * 0.85) * 1.4)
        : Math.max(0, (1 - progress) * 0.6);

      // M2-FUSION-ART-BIND-R1：bind 模式下主體刀光改由真圖 main/hit phase 畫
      // （真圖層已先畫，legacy 這段只保留 warn 預警扇與提示，不再重疊程序刀弧）。
      if (bindOwnsGround) {
        c.restore();
        return;
      }

      if (bladeAlpha > 0.01) {
        c.rotate(angle);
        const halfSpread = spread * 0.5;
        const curSpread = phase === "active" ? halfSpread * Math.min(1, 0.4 + progress * 0.9) : halfSpread;
        const startA = -curSpread;
        const endA = curSpread;

        const candidateMode = typeof window !== "undefined" && typeof window.getFusionArtMode === "function"
          ? window.getFusionArtMode()
          : "legacy";
        const artStatus = typeof window !== "undefined" && window.FUSION_ART_STATUS
          ? (window.FUSION_ART_STATUS[candidateMode] || "legacy")
          : "legacy";
        const candidateImg = typeof window !== "undefined" && window.FUSION_ART
          ? window.FUSION_ART[candidateMode]
          : null;
        const isArtReady = candidateMode !== "legacy" && artStatus === "ready" && candidateImg && candidateImg.naturalWidth > 0;

        // ===================================================================
        // F1-A-ORIENTATION: 來源圖方位特徵與局部水平鏡像規格表
        // 來源圖構圖方位特徵 (Source Native Orientation Analysis):
        // - banana (Nano main_v01.png / banana_inkblade_alpha_candidate_v01.webp):
        //   原生 C 形凹開口朝向圖片 +X (右)，凸面銳利弧刃在圖片 -X (左)。
        //   翻轉理由 (Flip Rationale): 局部攻擊座標系 (+X 為 forward 迎向敵方，-X 為持刀玩家核心)。
        //   未翻轉時凸刃反而朝向玩家、凹口朝向敵人，方向顛倒；
        //   必須在局部攻擊座標內執行 X 水平翻轉 (translate(targetW, 0) -> scale(-1, 1))，
        //   使凸面刀刃朝向前鋒 (+forward/敵方)，凹缺口與拖尾墨跡貼向玩家核心 (0)。
        // - gpt (GPT gpt_inkblade_original_v01.png / gpt_inkblade_alpha_candidate_v01.webp):
        //   原生 C 形凹開口同樣朝向圖片 +X (右)，凸面刀芒在圖片 -X (左)。
        //   翻轉理由 (Flip Rationale): 未來去背 Gate 解鎖 ready 後，依相同原圖構圖邏輯鏡像，
        //   凸刃朝敵迎擊。目前 usable=false 門禁維持，僅供規格對齊與受控 reference 測試。
        // ===================================================================
        const CANDIDATE_ORIENTATION_SPEC = Object.freeze({
          banana: Object.freeze({
            sourceFile: "art/fusion/candidates/fusion_inkblade/banana_inkblade_alpha_candidate_v01.webp",
            nativeOpening: "right",
            flipX: true,
            rationale: "C-curve opening faces +X (right); flipX aligns convex blade outward towards enemy (+forward)"
          }),
          gpt: Object.freeze({
            sourceFile: "art/fusion/candidates/fusion_inkblade/gpt_inkblade_alpha_candidate_v01.webp",
            nativeOpening: "right",
            flipX: true,
            rationale: "C-curve opening faces +X (right); flipX aligns convex blade outward towards enemy (+forward)"
          })
        });

        if (isArtReady) {
          // ===================================================================
          // F1-A-ART-COMPARE: 候選圖檔已就緒 (Candidate Image Ready)
          // 繪製主體圖檔，移除會遮蔽主體之粗黑大幾何扇形 (2-A) 與厚重炎芯 (2-C)
          // 保留少量墨滴與狐火星芒 (2-E) 作為和風木刻版畫層次輔助
          // ===================================================================
          c.save();
          c.globalAlpha = bladeAlpha;
          const imgAspect = (candidateImg.naturalWidth && candidateImg.naturalHeight)
            ? (candidateImg.naturalWidth / candidateImg.naturalHeight)
            : 1.5;
          const targetW = radius;
          const targetH = targetW / imgAspect;
          const dy = -targetH * 0.5;

          const orient = CANDIDATE_ORIENTATION_SPEC[candidateMode];
          if (orient && orient.flipX) {
            // 局部水平鏡像：在攻擊朝向 (+X) 空間內翻轉，使凸刃迎敵 (+X)，凹口朝持刀玩家 (0)
            // 座標占用維持 [0, targetW] (不超過 radius)，不更動全域世界座標
            c.translate(targetW, 0);
            c.scale(-1, 1);
            c.drawImage(candidateImg, 0, dy, targetW, targetH);
          } else {
            c.drawImage(candidateImg, 0, dy, targetW, targetH);
          }
          c.restore();

          // 2-E. 飛散墨滴與狐火星芒 (少量粒子輔助)
          const sparkCount = 8;
          for (let k = 0; k < sparkCount; k++) {
            const kt = (k / sparkCount);
            const sang = startA + kt * (endA - startA);
            const scatter = (Math.sin(seed * 5.7 + k * 3.9) * 18);
            const distProgress = (phase === "active" ? progress : 1.0) * 24;
            const sr = radius + scatter + distProgress;
            const sx = Math.cos(sang) * sr;
            const sy = Math.sin(sang) * sr;
            if (k % 2 === 0) {
              c.fillStyle = `rgba(12, 8, 16, ${bladeAlpha * 0.85})`;
              c.beginPath();
              c.arc(sx, sy, 2.0, 0, 6.283);
              c.fill();
            } else {
              c.fillStyle = "#ff5522";
              c.beginPath();
              c.arc(sx, sy, 2.4, 0, 6.283);
              c.fill();
            }
          }

          // 候選狀態標記 (ART_CANDIDATE，清楚標註非正式 ART_PASS)
          c.save();
          c.font = "11px sans-serif";
          c.fillStyle = `rgba(255, 215, 0, ${bladeAlpha * 0.85})`;
          c.textAlign = "center";
          c.fillText(`[FUSION ART: ${candidateMode} (loaded)]`, radius * 0.5, -targetH * 0.5 - 6);
          c.restore();

        } else {
          // ===================================================================
          // 安全 Legacy 回落：完整程序浮世繪木版濃墨大外緣 (2-A ~ 2-E)
          // ===================================================================
          const steps = 18;
          const maxThick = 24 * (phase === "active" ? (0.7 + 0.3 * Math.sin(progress * Math.PI)) : (1 - progress * 0.5));

          // 2-A. 浮世繪木版濃墨大外緣 (Outer Sumi Calligraphy Body)
          c.beginPath();
          for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const a = startA + t * (endA - startA);
            const bristle = motion ? Math.sin(seed * 4.1 + i * 2.8) * 4.5 : 0;
            const th = Math.sin(t * Math.PI) * maxThick;
            const r = radius + th * 0.55 + bristle;
            const px = Math.cos(a) * r, py = Math.sin(a) * r;
            if (i === 0) c.moveTo(px, py);
            else c.lineTo(px, py);
          }
          for (let i = steps; i >= 0; i--) {
            const t = i / steps;
            const a = startA + t * (endA - startA);
            const th = Math.sin(t * Math.PI) * maxThick;
            const r = radius - th * 0.45;
            const px = Math.cos(a) * r, py = Math.sin(a) * r;
            c.lineTo(px, py);
          }
          c.closePath();
          c.fillStyle = `rgba(10, 8, 14, ${bladeAlpha * 0.95})`;
          c.fill();

          // 2-B. 飛白狼毫細線 (Calligraphic Flying White / Feathery Strokes)
          c.strokeStyle = `rgba(24, 18, 30, ${bladeAlpha * 0.85})`;
          c.lineWidth = 1.6;
          for (let f = 1; f <= 2; f++) {
            c.beginPath();
            for (let i = 0; i <= steps; i++) {
              const t = i / steps;
              const a = startA + t * (endA - startA);
              const r = radius + Math.sin(t * Math.PI) * (maxThick * (0.2 + f * 0.18));
              const px = Math.cos(a) * r, py = Math.sin(a) * r;
              if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
            }
            c.stroke();
          }

          // 2-C. 狐火烈焰炎芯 (Blazing Foxfire Flaming Core)
          c.strokeStyle = `rgba(255, 60, 20, ${bladeAlpha * 0.95})`;
          c.lineWidth = maxThick * 0.45;
          c.lineCap = "round";
          c.beginPath();
          c.arc(0, 0, radius, startA + 0.08, endA - 0.08);
          c.stroke();

          // 內層高熱金光 (Golden Hot Core)
          c.strokeStyle = `rgba(255, 190, 50, ${bladeAlpha * 0.92})`;
          c.lineWidth = maxThick * 0.22;
          c.beginPath();
          c.arc(0, 0, radius, startA + 0.14, endA - 0.14);
          c.stroke();

          // 鋒刃極限白熱光芒 (Razor Sharp White Core Line)
          c.strokeStyle = `rgba(255, 255, 240, ${bladeAlpha * 0.98})`;
          c.lineWidth = 2.4;
          c.beginPath();
          c.arc(0, 0, radius, startA + 0.20, endA - 0.20);
          c.stroke();

          // 2-D. 逆向燃燒妖火齒羽 (Flame Tendrils / Barbs)
          const barbCount = 8;
          for (let b = 1; b < barbCount; b++) {
            const t = b / barbCount;
            const a = startA + t * (endA - startA);
            const barbLen = 16 + (Math.sin(seed * 3.3 + b * 2.1) * 7);
            const isFlame = b % 2 === 0;

            c.strokeStyle = isFlame
              ? `rgba(255, 140, 30, ${bladeAlpha * 0.9})`
              : `rgba(12, 10, 16, ${bladeAlpha * 0.85})`;
            c.lineWidth = isFlame ? 2.2 : 3.0;

            const bx0 = Math.cos(a) * radius;
            const by0 = Math.sin(a) * radius;
            const tangA = a - Math.PI * 0.55;
            const bx1 = bx0 + Math.cos(tangA) * barbLen;
            const by1 = by0 + Math.sin(tangA) * barbLen;

            c.beginPath();
            c.moveTo(bx0, by0);
            c.lineTo(bx1, by1);
            c.stroke();
          }

          // 2-E. 飛散墨滴與狐火星芒 (Ejected Ink Drops & Foxfire Embers)
          const sparkCount = 14;
          for (let k = 0; k < sparkCount; k++) {
            const kt = (k / sparkCount);
            const sang = startA + kt * (endA - startA);
            const scatter = (Math.sin(seed * 5.7 + k * 3.9) * 22);
            const distProgress = (phase === "active" ? progress : 1.0) * 28;
            const sr = radius + scatter + distProgress;
            const sx = Math.cos(sang) * sr;
            const sy = Math.sin(sang) * sr;
            const isInk = k % 2 === 0;

            if (isInk) {
              c.fillStyle = `rgba(12, 8, 16, ${bladeAlpha * 0.9})`;
              c.beginPath();
              c.arc(sx, sy, 2.2, 0, 6.283);
              c.fill();
            } else {
              c.fillStyle = k % 4 === 1 ? "#ffe082" : "#ff5522";
              c.beginPath();
              c.arc(sx, sy, 2.8, 0, 6.283);
              c.fill();
            }
          }

          // 候選模式無圖時，清楚標記原因與安全回落 (如 GPT missing 或 Banana waiting alpha)
          if (candidateMode !== "legacy") {
            c.save();
            c.font = "11px sans-serif";
            c.fillStyle = `rgba(255, 100, 100, ${bladeAlpha * 0.9})`;
            c.textAlign = "center";
            const reasonTag = candidateMode === "gpt"
              ? (artStatus === "waiting_alpha" ? "GPT waiting alpha" : (artStatus === "missing" ? "GPT missing" : `GPT ${artStatus}`))
              : (artStatus === "waiting_alpha" ? "banana waiting alpha" : (artStatus === "missing" ? "banana missing" : `${candidateMode} ${artStatus}`));
            c.fillText(`[FUSION ART: ${reasonTag} -> fallback legacy]`, radius * 0.6, -maxThick - 12);
            c.restore();
          }
        }
      }
      c.restore();
    };

    const viewport = typeof window !== "undefined" ? window.VIEWPORT : null;
    if (!is2D && viewport?.upright) {
      viewport.upright(c, x, y, paintBlade);
    } else {
      paintBlade();
    }

    c.restore();
    return true;
  }

  function drawFusionThundercircle(c, x, y, radius, phase, progress, seed, is2D, tilt, motion, elapsed) {
    c.save();
    c.translate(x, y);
    if (!is2D) {
      c.scale(1, tilt); // 地面雷陣扁平透視
    }

    const r = radius || 230;
    const rotSpeed = motion ? elapsed * 1.5 : 0;
    const alpha = phase === "warn"
      ? (0.4 + 0.3 * Math.sin(elapsed * 10))
      : phase === "active"
      ? Math.min(1, Math.sin(progress * Math.PI) * 1.2)
      : Math.max(0, 1 - progress);

    // M2-FUSION-ART-BIND-R1：bind 模式用真圖陣域取代程序雷紋環，
    // 但保留 active 的放射雷芒（機制指示：脈衝落雷）。
    const bindOwnsMain = fusionBindEnabled();

    // 1. 外環雷紋結界圈 (Outer Thunder Trigram Seal Ring)
    if (!bindOwnsMain) {
      c.strokeStyle = phase === "warn"
        ? `rgba(255, 200, 80, ${alpha * 0.65})`
        : `rgba(140, 230, 255, ${alpha * 0.92})`;
      c.lineWidth = 3.2;
      c.beginPath();
      c.arc(0, 0, r, 0, 6.283);
      c.stroke();

      // 2. 8 芒雷紋刻度 (8 Trigram / Tomoe Ticks)
      c.save();
      c.rotate(rotSpeed + seed);
      c.lineWidth = 2.4;
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const x0 = Math.cos(a) * (r - 16);
        const y0 = Math.sin(a) * (r - 16);
        const x1 = Math.cos(a) * (r + 8);
        const y1 = Math.sin(a) * (r + 8);
        c.beginPath();
        c.moveTo(x0, y0);
        c.lineTo(x1, y1);
        c.stroke();
      }
      c.restore();
    }

    // 3. 內圈落雷中心與脈衝。綁定真圖時不畫這層，避免幾何圓持續蓋住玩家。
    if (phase === "active" && !bindOwnsMain) {
      c.fillStyle = `rgba(180, 240, 255, ${alpha * 0.35})`;
      c.beginPath();
      c.arc(0, 0, r * 0.45 * progress, 0, 6.283);
      c.fill();

      // 放射雷芒 (Radiating Lightning Arcs)
      c.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
      c.lineWidth = 2.0;
      for (let j = 0; j < 6; j++) {
        const ja = (j * Math.PI) / 3 + seed;
        const jlen = r * (0.3 + 0.6 * progress);
        const jmidX = Math.cos(ja) * jlen * 0.5 + (Math.sin(j * 4.7 + elapsed * 20) * 12);
        const jmidY = Math.sin(ja) * jlen * 0.5 + (Math.cos(j * 4.7 + elapsed * 20) * 12);
        c.beginPath();
        c.moveTo(0, 0);
        c.quadraticCurveTo(jmidX, jmidY, Math.cos(ja) * jlen, Math.sin(ja) * jlen);
        c.stroke();
      }
    }

    c.restore();
    return true;
  }

  // M2-FUSION #3: 雷狐居合 (katana + thunder)
  function drawFusionFoxiai(c, x, y, angle, radius, progress, seed, phase, is2D, tilt, motion, elapsed, targetX, targetY) {
    c.save();
    c.translate(x, y);

    const r = radius || 220;
    const finalAngle = (targetX !== null && targetY !== null)
      ? Math.atan2(targetY - y, targetX - x)
      : angle;
    c.rotate(finalAngle);

    // M2-FUSION-ART-BIND-R1：bind 模式改由真圖 phase 層負責（不再走 legacy 候選圖，
    // 也避免同一個檔案被兩條路徑重複請求）。
    const bindOwnsMain = fusionBindEnabled();
    const candidateImg = (!bindOwnsMain && typeof window !== "undefined")
      ? (window.FUSION_ART?.fusion_foxiai || (window.loadFusionKindArt ? window.loadFusionKindArt("fusion_foxiai") : null))
      : null;
    const isArtReady = !bindOwnsMain && !!(candidateImg && candidateImg.naturalWidth > 0);

    const alpha = phase === "warn"
      ? (0.35 + 0.35 * Math.sin(elapsed * 12))
      : phase === "active"
      ? Math.min(1, Math.sin(progress * Math.PI) * 1.3)
      : Math.max(0, 1 - progress);

    if (isArtReady) {
      c.save();
      c.globalAlpha = alpha;
      const imgAspect = candidateImg.naturalWidth / candidateImg.naturalHeight || 1.49;
      const targetW = r;
      const targetH = targetW / imgAspect;
      // Orientation: 來源凸鋒在西(左 x=93)、凹口開口及拖尾在東(右 x=1207)
      // 局部攻擊座標內翻轉：translate(targetW, 0) -> scale(-1, 1)
      // 確保凸鋒迎敵前向(+forward at targetW)、凹口前向投影小於凸鋒(接近角色核心 x=0)
      c.translate(targetW, 0);
      c.scale(-1, 1);
      c.drawImage(candidateImg, 0, -targetH * 0.5, targetW, targetH);
      c.restore();

      // 微量電弧火花粒子（保留主體真圖視覺）
      if (phase === "active") {
        for (let i = 0; i < 4; i++) {
          const px = r * (0.25 + i * 0.22);
          const py = Math.sin(seed * 3.3 + i * 2.1 + elapsed * 10) * 6;
          c.fillStyle = i % 2 === 0 ? "#80e5ff" : "#ffffff";
          c.beginPath();
          c.arc(px, py, 1.8, 0, 6.283);
          c.fill();
        }
      }

      c.save();
      c.font = "11px sans-serif";
      c.fillStyle = `rgba(180, 240, 255, ${alpha * 0.85})`;
      c.textAlign = "center";
      c.fillText("[FUSION ART: 雷狐居合 (loaded)]", targetW * 0.5, -targetH * 0.5 - 6);
      c.restore();
    } else if (!bindOwnsMain) {
      if (phase === "warn") {
        c.strokeStyle = `rgba(180, 220, 255, ${alpha * 0.65})`;
        c.lineWidth = 1.8;
        c.setLineDash([8, 6]);
        c.beginPath();
        c.moveTo(0, 0);
        c.lineTo(r, 0);
        c.stroke();
        c.setLineDash([]);
      } else {
        c.strokeStyle = `rgba(220, 245, 255, ${alpha * 0.9})`;
        c.lineWidth = 2.4;
        c.beginPath();
        c.moveTo(0, 0);
        c.lineTo(r * (phase === "active" ? Math.min(1, progress * 1.5) : 1), 0);
        c.stroke();

        for (let i = 0; i < 4; i++) {
          const px = r * (0.2 + i * 0.22);
          const py = Math.sin(seed * 3.3 + i * 2.1 + elapsed * 10) * 8;
          c.fillStyle = i % 2 === 0 ? "#80e5ff" : "#ffffff";
          c.beginPath();
          c.arc(px, py, 1.8, 0, 6.283);
          c.fill();
        }

        c.save();
        c.font = "11px sans-serif";
        c.fillStyle = `rgba(140, 200, 255, ${alpha * 0.85})`;
        c.textAlign = "center";
        c.restore();
      }
    }

    c.restore();
    return true;
  }

  // M2-FUSION #4: 退魔符刃 (katana + boom)
  function drawFusionExorcistblade(c, x, y, angle, radius, spread, progress, seed, phase, is2D, tilt, motion, elapsed) {
    c.save();
    c.translate(x, y);
    c.rotate(angle);

    const r = radius || 200;
    const sp = spread || 1.8;
    // M2-FUSION-ART-BIND-R1：bind 模式改由真圖 phase 層負責。
    const bindOwnsMain = fusionBindEnabled();
    const candidateImg = (!bindOwnsMain && typeof window !== "undefined")
      ? (window.FUSION_ART?.fusion_exorcistblade || (window.loadFusionKindArt ? window.loadFusionKindArt("fusion_exorcistblade") : null))
      : null;
    const isArtReady = !bindOwnsMain && !!(candidateImg && candidateImg.naturalWidth > 0);

    const alpha = phase === "warn"
      ? (0.35 + 0.35 * Math.sin(elapsed * 12))
      : phase === "active"
      ? Math.min(1, Math.sin(progress * Math.PI) * 1.3)
      : Math.max(0, 1 - progress);

    if (isArtReady) {
      c.save();
      c.globalAlpha = alpha;
      const imgAspect = candidateImg.naturalWidth / candidateImg.naturalHeight || 1.49;
      const targetW = r;
      const targetH = targetW / imgAspect;
      // Orientation: 來源凸刃在西(左 x=148)、凹口刀柄及符火拖尾在東(右 x=1161)
      // 局部攻擊座標內翻轉：translate(targetW, 0) -> scale(-1, 1)
      // 確保凸鋒迎敵前向(+forward at targetW)、凹口前向投影小於凸鋒(接近角色核心 x=0)
      c.translate(targetW, 0);
      c.scale(-1, 1);
      c.drawImage(candidateImg, 0, -targetH * 0.5, targetW, targetH);
      c.restore();

      // 微量符文金火餘燼（保留主體真圖視覺）
      if (phase === "active") {
        const halfSp = sp * 0.5;
        for (let i = 0; i < 4; i++) {
          const a = -halfSp + (i / 3) * sp;
          const px = Math.cos(a) * r * 0.95;
          const py = Math.sin(a) * r * 0.95;
          c.fillStyle = i % 2 === 0 ? "#ffd54f" : "#ff7043";
          c.beginPath();
          c.arc(px, py, 2.0, 0, 6.283);
          c.fill();
        }
      }

      c.save();
      c.font = "11px sans-serif";
      c.fillStyle = `rgba(255, 220, 100, ${alpha * 0.85})`;
      c.textAlign = "center";
      c.fillText("[FUSION ART: 退魔符刃 (loaded)]", targetW * 0.5, -targetH * 0.5 - 6);
      c.restore();
    } else if (!bindOwnsMain) {
      const halfSp = sp * 0.5;
      if (phase === "warn") {
        c.strokeStyle = `rgba(255, 180, 50, ${alpha * 0.65})`;
        c.lineWidth = 1.8;
        c.setLineDash([8, 6]);
        c.beginPath();
        c.arc(0, 0, r, -halfSp, halfSp);
        c.stroke();
        c.setLineDash([]);
      } else {
        c.strokeStyle = `rgba(255, 230, 120, ${alpha * 0.9})`;
        c.lineWidth = 2.4;
        c.beginPath();
        c.arc(0, 0, r, -halfSp, halfSp);
        c.stroke();

        for (let i = 0; i < 4; i++) {
          const a = -halfSp + (i / 3) * sp;
          const px = Math.cos(a) * r;
          const py = Math.sin(a) * r;
          c.fillStyle = i % 2 === 0 ? "#ffd54f" : "#ff7043";
          c.beginPath();
          c.arc(px, py, 2.2, 0, 6.283);
          c.fill();
        }

        c.save();
        c.font = "11px sans-serif";
        c.fillStyle = `rgba(255, 200, 80, ${alpha * 0.85})`;
        c.textAlign = "center";
        c.restore();
      }
    }

    c.restore();
    return true;
  }

  // M2-FUSION #5: 妖火結界 (fire + barrier)
  function drawFusionFoxfirebarrier(c, x, y, radius, progress, seed, phase, is2D, tilt, motion, elapsed) {
    c.save();
    c.translate(x, y);

    const r = radius || 180;
    // M2-FUSION-ART-BIND-R1：bind 模式改由真圖 phase 層負責。
    const bindOwnsMain = fusionBindEnabled();
    const candidateImg = (!bindOwnsMain && typeof window !== "undefined")
      ? (window.FUSION_ART?.fusion_foxfirebarrier || (window.loadFusionKindArt ? window.loadFusionKindArt("fusion_foxfirebarrier") : null))
      : null;
    const isArtReady = !bindOwnsMain && !!(candidateImg && candidateImg.naturalWidth > 0);

    const alpha = phase === "warn"
      ? (0.35 + 0.35 * Math.sin(elapsed * 10))
      : phase === "active"
      ? Math.min(1, Math.sin(progress * Math.PI) * 1.2)
      : Math.max(0, 1 - progress);

    if (isArtReady) {
      c.save();
      c.globalAlpha = alpha;
      // 地陣 2D / .60 不二次壓得過扁：素材已帶 2.5D 透視 (h/w ~0.67)
      // 在 2.5D tilt.60 下直接維持自然透視寬高，不額外 scale(1, tilt)；在純 2D 下維持均勻圓形
      const targetW = r * 2.0;
      const targetH = is2D ? (r * 2.0) : (targetW * (candidateImg.naturalHeight / candidateImg.naturalWidth || 0.67));
      c.drawImage(candidateImg, -targetW * 0.5, -targetH * 0.5, targetW, targetH);
      c.restore();

      // 環繞狐火微光粒子 (4 顆，不遮蔽主體)
      if (phase === "active") {
        const rot = motion ? elapsed * 1.8 : 0;
        const orbitRx = targetW * 0.48;
        const orbitRy = targetH * 0.48;
        for (let i = 0; i < 4; i++) {
          const a = rot + (i * Math.PI * 0.5);
          const fx = Math.cos(a) * orbitRx;
          const fy = Math.sin(a) * orbitRy;
          c.fillStyle = i % 2 === 0 ? "#ff5722" : "#ffb74d";
          c.beginPath();
          c.arc(fx, fy, 2.2, 0, 6.283);
          c.fill();
        }
      }

      c.save();
      c.font = "11px sans-serif";
      c.fillStyle = `rgba(255, 140, 80, ${alpha * 0.85})`;
      c.textAlign = "center";
      c.fillText("[FUSION ART: 妖火結界 (loaded)]", 0, -targetH * 0.5 - 8);
      c.restore();
    } else if (!bindOwnsMain) {
      if (!is2D) c.scale(1, tilt);
      c.strokeStyle = phase === "warn" ? `rgba(255, 120, 60, ${alpha * 0.6})` : `rgba(255, 90, 40, ${alpha * 0.85})`;
      c.lineWidth = 2.2;
      c.beginPath();
      c.arc(0, 0, r, 0, 6.283);
      c.stroke();

      const rot = motion ? elapsed * 1.8 : 0;
      for (let i = 0; i < 4; i++) {
        const a = rot + (i * Math.PI * 0.5);
        const fx = Math.cos(a) * r;
        const fy = Math.sin(a) * r;
        c.fillStyle = i % 2 === 0 ? "#ff5722" : "#ffb74d";
        c.beginPath();
        c.arc(fx, fy, 2.5, 0, 6.283);
        c.fill();
      }

      c.save();
      c.font = "11px sans-serif";
      c.fillStyle = `rgba(255, 120, 70, ${alpha * 0.85})`;
      c.textAlign = "center";
      c.restore();
    }

    c.restore();
    return true;
  }

  // M2-FUSION #9: 退魔封陣 (barrier + boom)
  function drawFusionExorcistseal(c, x, y, radius, progress, seed, phase, is2D, tilt, motion, elapsed, pulseIndex) {
    c.save();
    c.translate(x, y);

    const r = radius || 210;
    // M2-FUSION-ART-BIND-R1：bind 模式改由真圖 phase 層負責。
    const bindOwnsMain = fusionBindEnabled();
    const candidateImg = (!bindOwnsMain && typeof window !== "undefined")
      ? (window.FUSION_ART?.fusion_exorcistseal || (window.loadFusionKindArt ? window.loadFusionKindArt("fusion_exorcistseal") : null))
      : null;
    const isArtReady = !bindOwnsMain && !!(candidateImg && candidateImg.naturalWidth > 0);

    const alpha = phase === "warn"
      ? (0.35 + 0.35 * Math.sin(elapsed * 10))
      : phase === "active"
      ? Math.min(1, Math.sin(progress * Math.PI) * 1.2)
      : Math.max(0, 1 - progress);

    if (isArtReady) {
      c.save();
      c.globalAlpha = alpha;
      // 地陣 2D / .60 不二次壓得過扁：素材已帶 2.5D 透視 (h/w ~0.67)
      const targetW = r * 2.0;
      const targetH = is2D ? (r * 2.0) : (targetW * (candidateImg.naturalHeight / candidateImg.naturalWidth || 0.67));
      c.drawImage(candidateImg, -targetW * 0.5, -targetH * 0.5, targetW, targetH);
      c.restore();

      // 4 方位微光符文節點 + 震波脈衝 (不覆蓋主體)
      if (phase === "active") {
        const nodeRx = targetW * 0.47;
        const nodeRy = targetH * 0.47;
        for (let i = 0; i < 4; i++) {
          const a = (i * Math.PI * 0.5) + seed;
          const nx = Math.cos(a) * nodeRx;
          const ny = Math.sin(a) * nodeRy;
          c.fillStyle = "#ffe082";
          c.beginPath();
          c.arc(nx, ny, 2.5, 0, 6.283);
          c.fill();
        }

        const pulseScale = ((progress * 1.2 + pulseIndex * 0.2) % 1.0);
        c.strokeStyle = `rgba(255, 240, 180, ${alpha * 0.45})`;
        c.lineWidth = 1.4;
        c.beginPath();
        if (typeof c.ellipse === "function") {
          c.ellipse(0, 0, targetW * 0.5 * pulseScale, targetH * 0.5 * pulseScale, 0, 0, 6.283);
        } else {
          c.arc(0, 0, r * pulseScale, 0, 6.283);
        }
        c.stroke();
      }

      c.save();
      c.font = "11px sans-serif";
      c.fillStyle = `rgba(255, 215, 0, ${alpha * 0.85})`;
      c.textAlign = "center";
      c.fillText("[FUSION ART: 退魔封陣 (loaded)]", 0, -targetH * 0.5 - 8);
      c.restore();
    } else if (!bindOwnsMain) {
      if (!is2D) c.scale(1, tilt);
      c.strokeStyle = phase === "warn" ? `rgba(255, 200, 50, ${alpha * 0.6})` : `rgba(255, 215, 0, ${alpha * 0.85})`;
      c.lineWidth = 2.2;
      c.beginPath();
      c.arc(0, 0, r, 0, 6.283);
      c.stroke();

      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI * 0.5) + seed;
        const nx = Math.cos(a) * r;
        const ny = Math.sin(a) * r;
        c.fillStyle = "#ffe082";
        c.beginPath();
        c.arc(nx, ny, 3.0, 0, 6.283);
        c.fill();
      }

      if (phase === "active") {
        const pulseR = r * ((progress * 1.2 + pulseIndex * 0.2) % 1.0);
        c.strokeStyle = `rgba(255, 240, 180, ${alpha * 0.5})`;
        c.lineWidth = 1.6;
        c.beginPath();
        c.arc(0, 0, pulseR, 0, 6.283);
        c.stroke();
      }

      c.save();
      c.font = "11px sans-serif";
      c.fillStyle = `rgba(255, 200, 60, ${alpha * 0.85})`;
      c.textAlign = "center";
      c.restore();
    }

    c.restore();
    return true;
  }

  // System-A 新增五組的技術占位 VFX（未接新美術；只用既有輔助線／粒子語言）
  // 不含程序幾何冒充正式藝術；標籤明示 WAITING_ART。
  function drawFusionSystemA(c, effect, is2D, tilt, motion, elapsed) {
    const kind = effect.kind;
    const x = Number.isFinite(effect.x) ? effect.x : 0;
    const y = Number.isFinite(effect.y) ? effect.y : 0;
    const phase = effect.phase || "active";
    const progress = Number.isFinite(effect.progress) ? Math.max(0, Math.min(1, effect.progress)) : 0;
    const seed = Number.isFinite(effect.seed) ? effect.seed : 0;
    const alpha = phase === "warn"
      ? 0.35 + 0.35 * Math.sin(elapsed * 10)
      : phase === "active"
        ? Math.min(1, Math.sin(progress * Math.PI) * 1.2)
        : Math.max(0, 1 - progress);

    c.save();
    c.translate(x, y);

    // M2-FUSION-ART-BIND-R1：bind 模式已接真圖 main phase；
    // 下列標籤改標示「main 已綁真圖、其餘 phase 仍待圖」，不冒稱已有正式美術。
    const bindOn = fusionBindEnabled();
    const bindNote = bindOn ? "main=真圖 / hit・ground・icon WAITING_ART" : "WAITING_ART";

    if (kind === "fusion_slashwheel") {
      const r = Number.isFinite(effect.currentRadius) ? effect.currentRadius : (effect.radius || 320);
      c.strokeStyle = `rgba(140, 230, 220, ${alpha * 0.9})`;
      c.lineWidth = 2.6;
      for (const band of (effect.bands || [])) {
        if (r < band.at - 2) continue;
        c.beginPath();
        c.arc(0, 0, band.at, 0, 6.283);
        c.stroke();
      }
      c.save();
      c.rotate((motion ? elapsed * 5 : 0) + seed);
      c.strokeStyle = `rgba(235, 255, 255, ${alpha * 0.55})`;
      c.lineWidth = 1.4;
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        c.beginPath();
        c.moveTo(Math.cos(a) * 40, Math.sin(a) * 40);
        c.lineTo(Math.cos(a) * Math.max(40, r), Math.sin(a) * Math.max(40, r));
        c.stroke();
      }
      c.restore();
      c.fillStyle = `rgba(255, 240, 180, ${alpha * 0.8})`;
      c.font = "11px sans-serif";
      c.textAlign = "center";
    }

    if (kind === "fusion_foxthunderlantern") {
      for (const ln of (effect.lanterns || [])) {
        const lx = (Number.isFinite(ln.x) ? ln.x : x) - x;
        const ly = (Number.isFinite(ln.y) ? ln.y : y) - y;
        c.strokeStyle = `rgba(255, 205, 90, ${alpha * 0.8})`;
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(lx, ly - 26);
        c.lineTo(lx, ly - 8);
        c.stroke();
        c.fillStyle = `rgba(255, 225, 130, ${alpha * (ln.struck ? 0.35 : 0.85)})`;
        c.beginPath();
        c.arc(lx, ly, ln.struck ? 5 : 8, 0, 6.283);
        c.fill();
        if (ln.struck) {
          c.strokeStyle = `rgba(150, 235, 255, ${alpha * 0.55})`;
          c.lineWidth = 1.4;
          c.beginPath();
          c.arc(lx, ly, effect.strikeRadius || 64, 0, 6.283);
          c.stroke();
        }
      }
      c.fillStyle = `rgba(255, 240, 180, ${alpha * 0.8})`;
      c.font = "11px sans-serif";
      c.textAlign = "center";
    }

    if (kind === "fusion_flamefestival") {
      for (const t of (effect.talismans || [])) {
        const tx = (Number.isFinite(t.x) ? t.x : x) - x;
        const ty = (Number.isFinite(t.y) ? t.y : y) - y;
        c.save();
        c.translate(tx, ty);
        c.rotate(Math.atan2(t.targetY - t.fromY, t.targetX - t.fromX) + Math.PI * 0.5);
        c.fillStyle = `rgba(255, 120, 60, ${alpha * (t.exploded ? 0.2 : 0.85)})`;
        c.fillRect(-4, -9, 8, 18);
        c.restore();
        if (t.exploded) {
          c.strokeStyle = `rgba(255, 150, 80, ${alpha * 0.65})`;
          c.lineWidth = 1.6;
          c.beginPath();
          c.arc(tx, ty, effect.landRadius || 62, 0, 6.283);
          c.stroke();
        }
      }
      for (const em of (effect.embers || [])) {
        if (em.ticksLeft <= 0) continue;
        const ex = (Number.isFinite(em.x) ? em.x : x) - x;
        const ey = (Number.isFinite(em.y) ? em.y : y) - y;
        c.fillStyle = `rgba(255, 110, 60, ${alpha * 0.35 * Math.max(0, em.ticksLeft / (effect.emberTicks || 2))})`;
        c.beginPath();
        c.arc(ex, ey, effect.emberRadius || 48, 0, 6.283);
        c.fill();
      }
      c.fillStyle = `rgba(255, 240, 180, ${alpha * 0.8})`;
      c.font = "11px sans-serif";
      c.textAlign = "center";
    }

    if (kind === "fusion_thundertalisman") {
      c.strokeStyle = `rgba(150, 225, 255, ${alpha * 0.85})`;
      c.lineWidth = 2;
      for (const arc of (effect.arcs || [])) {
        c.beginPath();
        c.moveTo(arc.x1 - x, arc.y1 - y);
        const mx = (arc.x1 + arc.x2) * 0.5 - x + Math.sin((arc.x1 + arc.y1) * 0.05) * 18;
        const my = (arc.y1 + arc.y2) * 0.5 - y + Math.cos((arc.x2 + arc.y2) * 0.05) * 18;
        c.quadraticCurveTo(mx, my, arc.x2 - x, arc.y2 - y);
        c.stroke();
      }
      for (const t of (effect.talismans || [])) {
        const tx = (Number.isFinite(t.x) ? t.x : x) - x;
        const ty = (Number.isFinite(t.y) ? t.y : y) - y;
        c.fillStyle = `rgba(120, 210, 255, ${alpha * (t.struck ? 0.18 : 0.8)})`;
        c.fillRect(tx - 4, ty - 10, 8, 20);
        if (t.struck) {
          c.strokeStyle = `rgba(190, 240, 255, ${alpha * 0.75})`;
          c.lineWidth = 1.6;
          c.beginPath();
          c.arc(tx, ty, effect.strikeRadius || 70, 0, 6.283);
          c.stroke();
        }
      }
      c.fillStyle = `rgba(200, 240, 255, ${alpha * 0.8})`;
      c.font = "11px sans-serif";
      c.textAlign = "center";
    }

    c.restore();
    return true;
  }

  // 既有核准靈陣 + 妖刀真圖重組；專用輪刃圖仍待重繪，不使用正視候選輪。
  function drawFusionSlashwheel(c, effect, motion, elapsed) {
    const base = window.barrierCoreArt?.(3);
    const blade = window.skillVfxArt?.("katana", 5);
    const progress = Math.max(0, Math.min(1, effect.progress || 0));
    const fade = effect.phase === "fade" ? Math.max(0, (1 - progress) / 0.2) : 1;
    const r = 142 * (0.72 + 0.28 * Math.min(1, progress * 5));
    c.save();
    c.translate(effect.x || 0, (effect.y || 0) + 20);
    // 呼叫端是地面投影，保留 tilt=.60，不以 upright 抵消成正面圓環。
    if (base?.naturalWidth) {
      c.save(); c.globalAlpha *= fade * 0.72;
      c.rotate(motion ? elapsed * 0.35 : 0);
      c.drawImage(base, -r, -r, r * 2, r * 2); c.restore();
    }
    if (blade?.naturalWidth) {
      c.save();
      c.beginPath(); c.arc(0, 0, r + 16, 0, Math.PI * 2);
      c.arc(0, 0, r - 15, 0, Math.PI * 2, true); c.clip("evenodd");
      for (let i = 0; i < 6; i++) {
        c.save(); c.rotate((motion ? elapsed * 8 : 0) + i * Math.PI / 3);
        c.globalAlpha *= fade * (0.76 + 0.12 * Math.sin(elapsed * 20 + i));
        c.drawImage(blade, -r - 14, -r - 14, (r + 14) * 2, (r + 14) * 2);
        c.restore();
      }
      c.restore();
    }
    c.restore();
    return true;
  }

  function drawFusionFx(targetCtx, effect, elapsed = 0) {
    if (!effect || typeof effect !== "object") return false;
    const kind = effect.kind;
    const SUPPORTED_KINDS = new Set([
      "fusion_inkblade",
      "fusion_thundercircle",
      "fusion_foxiai",
      "fusion_exorcistblade",
      "fusion_foxfirebarrier",
      "fusion_exorcistseal",
      "fusion_slashwheel",
      "fusion_foxthunderlantern",
      "fusion_flamefestival",
      "fusion_thundertalisman"
    ]);
    if (!SUPPORTED_KINDS.has(kind)) return false;

    const c = targetCtx || ctx;
    if (!c) return false;

    const viewport = window.VIEWPORT;
    const is2D = typeof viewport?.is2D === "function" ? viewport.is2D() : false;
    const tilt = tiltK();
    const motion = allowsMotion();

    const x = Number.isFinite(effect.x) ? effect.x : 0;
    const y = Number.isFinite(effect.y) ? effect.y : 0;
    const phase = effect.phase || "active";
    const progress = Number.isFinite(effect.progress) ? Math.max(0, Math.min(1, effect.progress)) : 0;
    const seed = Number.isFinite(effect.seed) ? effect.seed : 0;

    // M2-FUSION-ART-BIND-R1：真圖 phase 綁定層（僅嚴格 dev 門檻生效）。
    // 綁定層先畫真圖（ground → hit → main），下面的 legacy 程序幾何只留機制指示。
    if (kind === "fusion_slashwheel") return drawFusionSlashwheel(c, effect, motion, elapsed);
    // 任一 phase 真圖未就緒不影響其他 phase；不得再把 legacy 幾何整套疊回真圖上。
    if (drawFusionBindLayers(c, effect, is2D, tilt, motion, elapsed)) return true;

    if (kind === "fusion_inkblade") {
      const angle = Number.isFinite(effect.angle) ? effect.angle : 0;
      const radius = Number.isFinite(effect.radius) ? effect.radius : 195;
      const spread = Number.isFinite(effect.spread) ? effect.spread : 2.3;
      const burnDuration = Number.isFinite(effect.burnDuration) ? effect.burnDuration : 0.8;
      const burnAge = Number.isFinite(effect.burnAge) ? effect.burnAge : 0;
      return drawFusionInkblade(c, x, y, angle, radius, spread, phase, progress, seed, burnDuration, burnAge, is2D, tilt, motion, elapsed);
    }

    if (kind === "fusion_thundercircle") {
      const radius = Number.isFinite(effect.radius) ? effect.radius : 230;
      return drawFusionThundercircle(c, x, y, radius, phase, progress, seed, is2D, tilt, motion, elapsed);
    }

    if (kind === "fusion_foxiai") {
      const angle = Number.isFinite(effect.angle) ? effect.angle : 0;
      const radius = Number.isFinite(effect.radius) ? effect.radius : 220;
      const targetX = Number.isFinite(effect.targetX) ? effect.targetX : (Number.isFinite(effect.x2) ? effect.x2 : null);
      const targetY = Number.isFinite(effect.targetY) ? effect.targetY : (Number.isFinite(effect.y2) ? effect.y2 : null);
      return drawFusionFoxiai(c, x, y, angle, radius, progress, seed, phase, is2D, tilt, motion, elapsed, targetX, targetY);
    }

    if (kind === "fusion_exorcistblade") {
      const angle = Number.isFinite(effect.angle) ? effect.angle : 0;
      const radius = Number.isFinite(effect.radius) ? effect.radius : 200;
      const spread = Number.isFinite(effect.spread) ? effect.spread : 1.8;
      return drawFusionExorcistblade(c, x, y, angle, radius, spread, progress, seed, phase, is2D, tilt, motion, elapsed);
    }

    if (kind === "fusion_foxfirebarrier") {
      const radius = Number.isFinite(effect.radius) ? effect.radius : 180;
      return drawFusionFoxfirebarrier(c, x, y, radius, progress, seed, phase, is2D, tilt, motion, elapsed);
    }

    if (kind === "fusion_exorcistseal") {
      const radius = Number.isFinite(effect.radius) ? effect.radius : 210;
      const pulseIndex = Number.isFinite(effect.pulseIndex) ? effect.pulseIndex : 0;
      return drawFusionExorcistseal(c, x, y, radius, progress, seed, phase, is2D, tilt, motion, elapsed, pulseIndex);
    }

    if (kind === "fusion_slashwheel" || kind === "fusion_foxthunderlantern"
      || kind === "fusion_flamefestival" || kind === "fusion_thundertalisman") {
      return drawFusionSystemA(c, effect, is2D, tilt, motion, elapsed);
    }

    return false;
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
    invalidateGroundCache,
    s2CoastDrawEvidence,
    s2GroundKitDrawEvidence,
    resetS2GroundKitDrawCounts,
    sceneryDepth,
    drawHouse,
    drawHouseShadow,
    drawLampShadow,
    drawPlayerShadow,
    drawMonsterShadow,
    drawDecorActor,
    drawSakuraProp,
    drawPortProp,
    getPortBounds,
    paintPortBoundedTerrain,
    drawPortSceneLayers,
    drawDistrictLabels,
    drawScenerySprite,
    drawPlayer,
    drawFrame,
    drawMonster,
    drawStage2Actor,
    drawUmibozuWaterBase,
    drawBossHazard: drawPortBossHazard,
    bossHazardPass: () => bossHazardPass,
    drawPortBossHazard,
    isOrbitBack,
    shouldDrawOrbitFlame,
    getOrbitDepthStyle,
    drawFoxfireOrbit,
    drawFusionFx,
    drawGemShadow,
    drawSpiritGem,
    renderLighting,
    drawDamageNumbers,
    drawSlashArcs,
    drawAtmosphere,
    drawPortAtmosphereRain,
    loadS2NanoAssets,
    getS2NanoStone,
    getS2NanoWood,
    getS2NanoTransH,
    getS2NanoTransV,
    getS2NanoWarehouse,
    getS2NanoFishmonger,
    getShakeOffset() {
      if (!allowsMotion() || shake === 0) return { x: 0, y: 0 };
      return {
        x: (Math.random() - 0.5) * shake,
        y: (Math.random() - 0.5) * shake
      };
    }
  };
})();
