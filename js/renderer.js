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
  const SCENE_PIXELS = 921600, LIGHT_PIXELS = 280000;
  const HOUSE_NAMES = { house_shop: "夜行商店", house_tavern: "宵待酒屋", house_shrine: "稻荷社" };
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
  function drawFrame(c, image, key, index, x, y, height) {
    const frames = FRAME_BOUNDS[key] || [[0,0,image.naturalWidth,image.naturalHeight,image.naturalWidth/2]];
    const r = frames[index] || frames[0], scale = height / frames[0][3];
    const box = {sx:r[0],sy:r[1],sw:r[2],sh:r[3],dx:x+(r[0]-r[4])*scale,dy:y-r[3]*scale,dw:r[2]*scale,dh:r[3]*scale};
    c.drawImage(image,box.sx,box.sy,box.sw,box.sh,box.dx,box.dy,box.dw,box.dh);
    return box;
  }
  let cv, ctx, dpr;
  let lightCv, lightCtx;
  let stonePattern = null;
  let groundPattern = null;
  let groundPatternImage = null;
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
    // 畫面像素預算約 720p。點擊座標仍走 CSS 邏輯座標，縮小的是 backing store。
    dpr = Math.min(window.devicePixelRatio || 1, 2, Math.max(0.34, Math.sqrt(SCENE_PIXELS / Math.max(1, cssPixels))));
    cv.width = Math.round(v.width * scale * dpr); cv.height = Math.round(v.height * scale * dpr);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "low";
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

    // 預先生成高品質石疊（和風石磚路）無縫貼圖
    createStonePattern();

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

  // 生成木版畫式石疊 Pattern：硬墨線、低彩度色塊與乾刷紋，避免現代立體高光。
  function createStonePattern() {
    const pc = document.createElement("canvas");
    pc.width = 160;
    pc.height = 160;
    const pctx = pc.getContext("2d");

    pctx.fillStyle = "#24252a";
    pctx.fillRect(0, 0, 160, 160);

    const stones = [
      { x: 3, y: 5, w: 73, h: 31, c: "#34343a" },
      { x: 81, y: 3, w: 76, h: 35, c: "#2d3035" },
      { x: 2, y: 43, w: 50, h: 32, c: "#39383b" },
      { x: 57, y: 41, w: 59, h: 36, c: "#303136" },
      { x: 121, y: 44, w: 37, h: 31, c: "#3a393d" },
      { x: 3, y: 81, w: 85, h: 32, c: "#2f3135" },
      { x: 93, y: 80, w: 64, h: 35, c: "#37373b" },
      { x: 2, y: 120, w: 58, h: 36, c: "#39373a" },
      { x: 65, y: 119, w: 53, h: 38, c: "#303136" },
      { x: 123, y: 118, w: 35, h: 39, c: "#2b2d31" }
    ];

    stones.forEach((s,i) => {
      pctx.fillStyle = s.c;
      pctx.beginPath();
      pctx.moveTo(s.x+2,s.y+3);
      pctx.lineTo(s.x+s.w-3,s.y+(i%2?1:4));
      pctx.lineTo(s.x+s.w-1,s.y+s.h-3);
      pctx.lineTo(s.x+4,s.y+s.h-1);
      pctx.closePath();
      pctx.fill();
      pctx.strokeStyle = "rgba(17, 16, 20, 0.78)";
      pctx.lineWidth = 2.2;
      pctx.stroke();
      pctx.strokeStyle = i%2 ? "rgba(181, 164, 128, 0.10)" : "rgba(152, 167, 158, 0.10)";
      pctx.lineWidth = 1;
      pctx.beginPath();
      pctx.moveTo(s.x+9,s.y+9);pctx.lineTo(s.x+s.w-11,s.y+8+(i%3)*4);
      pctx.moveTo(s.x+13,s.y+s.h-9);pctx.lineTo(s.x+s.w-16,s.y+s.h-12);
      pctx.stroke();
    });
    pctx.strokeStyle = "rgba(221, 207, 170, 0.055)";
    pctx.lineWidth = 1;
    for(let y=12;y<160;y+=23){pctx.beginPath();pctx.moveTo(0,y);pctx.lineTo(160,y-5);pctx.stroke();}

    stonePattern = ctx.createPattern(pc, "repeat");
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
        p.x += p.vx * dt - camDx * ((p.depth || 1) - 1);
        p.y += p.vy * dt - camDy * ((p.depth || 1) - 1);
        p.rot += p.vRot * dt;
      }
      if (p.x > area.right + 40) p.x = area.left - 40;
      else if (p.x < area.left - 40) p.x = area.right + 40;
      if (p.y > area.bottom + 40) p.y = area.top - 40;
      else if (p.y < area.top - 40) p.y = area.bottom + 40;
    }

    for (const d of dmgNumbers) {
      d.x += d.vx * dt;
      d.y += d.vy * dt;
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

  function drawStyledSceneryImage(c,image,x,y,w,h,alpha=1,kind="scenery") {
    if(!image || !image.naturalWidth)return false;
    c.save();
    c.globalAlpha *= alpha;
    c.filter = kind === "sakura" ? "saturate(78%) contrast(101%) brightness(92%)" :
      kind === "house_tavern" || kind === "house_shrine" ? "saturate(86%) contrast(101%) sepia(2%) brightness(91%)" :
      "saturate(88%) contrast(102%) sepia(2%) brightness(94%)";
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

  function drawStaticChunk(c, chunk, toriiImg, toriiReady, sakuraImg, sakuraReady, paving) {
    const cx = chunk.x + chunk.w / 2, cy = chunk.y + chunk.h / 2;
    c.save();
    // 柔和土色道路，不再在房屋周圍畫黑色矩形庭院與筆直粗墨線。
    if(chunk.houses?.length) {
      const wet=chunk.theme==='water'||chunk.theme==='lotus'||chunk.theme==='harbor';
      c.lineJoin='round';c.lineCap='round';
      const road=()=>{
        c.beginPath();c.moveTo(chunk.x,cy);c.lineTo(chunk.x+chunk.w,cy);
        c.moveTo(cx,chunk.y);c.lineTo(cx,chunk.y+chunk.h);
        for(const h of chunk.houses){c.moveTo(h.x,h.y+140);c.lineTo(cx,h.y+140);c.lineTo(cx,cy);}c.stroke();
      };
      c.strokeStyle=wet?'rgba(77,92,96,0.10)':'rgba(122,99,73,0.09)';
      c.lineWidth=72;road();
      for(const h of chunk.houses) {
        // 庭院與門前鋪面改為淡土色橢圓，避免 340x186px 的硬邊方框。
        c.fillStyle=wet?'rgba(79,95,98,0.07)':'rgba(137,114,82,0.07)';
        c.beginPath();c.ellipse(h.x,h.y+140,156,83,0,0,6.283);c.fill();
      }
    }
    c.textAlign = "center";
    c.font = "900 38px 'Kaisei Decol', 'Noto Sans JP', serif";
    c.fillStyle = "rgba(255, 230, 180, 0.18)";
    c.fillText(chunk.name, cx, chunk.y + 105);
    c.font = "bold 15px 'Zen Maru Gothic', sans-serif";
    c.fillStyle = "rgba(255, 230, 180, 0.14)";
    c.fillText(`— ${chunk.sub || ""} —`, cx, chunk.y + 129);
    if (chunk.decor?.torii && toriiReady) {
      c.fillStyle = "rgba(16, 14, 17, 0.48)";
      c.beginPath();
      c.ellipse(cx, cy + 45, 90, 24, 0, 0, 6.28);
      c.fill();
      const tw = 150, th = tw * toriiImg.naturalHeight / toriiImg.naturalWidth;
        drawStyledSceneryImage(c,toriiImg,cx-tw/2,cy-th+36,tw,th,1,"torii");
    }
    if (sakuraReady) {
      for (const tree of chunk.decor?.sakuraTrees || []) {
        const factor=[.92,1,1.08][groundTileIndex(Math.floor(tree.x),Math.floor(tree.y))%3];
        const sw=114*factor,sh=sw*sakuraImg.naturalHeight/sakuraImg.naturalWidth;
        c.fillStyle = "rgba(0, 0, 0, 0.35)";
        c.beginPath();
        c.ellipse(tree.x, tree.y - 4, 28, 10, 0, 0, 6.28);
        c.fill();
        drawStyledSceneryImage(c,sakuraImg,tree.x-sw/2,tree.y-sh,sw,sh,.89,"sakura");
      }
    }
    c.restore();
  }

  // 地名、鳥居與櫻樹跟底圖一起快取。
  function drawGroundBase(chunks, groundKey) {
    const area = bounds(), v = window.VIEWPORT?.get() || {scale:1};
    const pixelScale = ctx.getTransform?.()?.a || (v.scale || 1) * dpr, x = camX + area.left, y = camY + area.top;
    const groundImg = window.ART && window.ART[groundKey];
    const courtImg = window.ART?.ground;
    const toriiImg = window.ART && window.ART.prop_torii;
    const sakuraImg = window.ART && window.ART.prop_sakura;
    const toriiReady = !!(toriiImg && toriiImg.complete && toriiImg.naturalWidth);
    const sakuraReady = !!(sakuraImg && sakuraImg.complete && sakuraImg.naturalWidth);
    const cached = terrainState;
    if (!cached || cached.key !== groundKey || cached.image !== groundImg || cached.courtImage !== courtImg || cached.pixelScale !== pixelScale ||
        cached.toriiReady !== toriiReady || cached.sakuraReady !== sakuraReady ||
        cached.viewW !== area.width || cached.viewH !== area.height || x < cached.left || y < cached.top ||
        x + area.width > cached.left + cached.width || y + area.height > cached.top + cached.height ||
        cached.chunks.length !== chunks.length || chunks.some((chunk,i)=>chunk!==cached.chunks[i])) {
      const left = x - 120, top = y - 120, width = area.width + 240, height = area.height + 240;
      const pw = Math.ceil(width * pixelScale), ph = Math.ceil(height * pixelScale);
      terrainCv ||= document.createElement("canvas");
      if (terrainCv.width !== pw) terrainCv.width = pw;
      if (terrainCv.height !== ph) terrainCv.height = ph;
      const c = terrainCv.getContext("2d");
      c.setTransform(1,0,0,1,0,0);
      c.clearRect(0,0,terrainCv.width,terrainCv.height);
      c.setTransform(pixelScale,0,0,pixelScale,-left*pixelScale,-top*pixelScale);
      c.imageSmoothingEnabled = true;
      c.imageSmoothingQuality = "low";
      const dirt = groundKey === "ground_dirt";
      // 第一層永遠先填實色，避免新圖延遲下載時露出黑框。
      c.fillStyle = dirt ? "#6b5135" : stonePattern || "#303b42";
      c.fillRect(left,top,width,height);
      const atlas = groundAtlasFor(groundImg);
      if(atlas){
        const x0=Math.floor(left/SCENE_TILE),x1=Math.ceil((left+width)/SCENE_TILE);
        const y0=Math.floor(top/SCENE_TILE),y1=Math.ceil((top+height)/SCENE_TILE);
        for(let ty=y0;ty<y1;ty++)for(let tx=x0;tx<x1;tx++){
          const variant=groundTileIndex(tx,ty);
          c.save();c.globalAlpha=0.78;
          c.drawImage(atlas,(variant&1)*512,(variant>>1)*512,512,512,tx*SCENE_TILE,ty*SCENE_TILE,512,512);
          c.restore();
        }
      }else if(groundImg?.naturalWidth){
        if(groundPatternImage!==groundImg){groundPattern=c.createPattern(groundImg,"repeat");groundPatternImage=groundImg;}
        c.save();c.globalAlpha=0.78;
        c.fillStyle=groundPattern||"#303b42";c.fillRect(left,top,width,height);
        c.restore();
      }
      // 淡米茶／青灰過色，讓石徑仍可辨識，但減少暗墨、花瓣、草叢的搶眼程度。
      c.fillStyle=dirt?'rgba(154,132,103,0.12)':'rgba(79,94,102,0.11)';
      c.fillRect(left,top,width,height);
      // 原有固定間距的乾刷直線和未 seamless 的 courtyard repeat 會加重方格感。
      for (const chunk of chunks) {
        if (chunk.x > left+width || chunk.x+chunk.w < left || chunk.y > top+height || chunk.y+chunk.h < top) continue;
        const cx = chunk.x+chunk.w/2, cy = chunk.y+chunk.h/2;
        const tint = chunk.theme === "sakura" ? "rgba(112,76,91,0.045)" :
          chunk.theme === "water" || chunk.theme === "lotus" || chunk.theme === "harbor" ? "rgba(61,85,92,0.05)" :
          chunk.theme === "tavern" || chunk.theme === "market" ? "rgba(112,78,56,0.045)" :
          chunk.theme === "mystic" ? "rgba(83,70,96,0.045)" : "rgba(69,83,72,0.035)";
        c.fillStyle=tint;c.beginPath();c.ellipse(cx,cy,chunk.w*.47,chunk.h*.43,0,0,6.283);c.fill();
        drawStaticChunk(c, chunk, toriiImg, toriiReady, sakuraImg, sakuraReady);
      }
      terrainState = {left,top,width:pw/pixelScale,height:ph/pixelScale,key:groundKey,image:groundImg,courtImage:courtImg,pixelScale,toriiReady,sakuraReady,viewW:area.width,viewH:area.height,chunks:chunks.slice()};
    }
    const t = terrainState;
    ctx.drawImage(terrainCv,t.left,t.top,t.width,t.height);
  }

  // 海邊與池塘不再鋪會上下游動的水帶。那幾條會蓋在鳥居上，看起來像燈光在呼吸。
  function drawGround(elapsed, dawnTime, chunks = [], groundKey = "ground") {
    drawGroundBase(chunks, groundKey);
  }

  // 繪製高精緻度日式町屋店鋪（真實店鋪 Sprite + 障子金光 + 和風招牌）
  function drawHouse(h) {
    ctx.save();

    // 1. 木版畫式接觸墨影：硬邊、低透明，不做柔亮卡通陰影。
    ctx.fillStyle = "rgba(17, 14, 17, 0.62)";
    ctx.beginPath();
    ctx.ellipse(h.x, h.y + 46, 62, 18, 0, 0, 6.28);
    ctx.fill();

    // 2. 新圖依實際透明裁切後的比例單獨定寬；腳底仍以 h.y+48 作為排序點。
    let houseSprite = window.ART.house_shop;
    if (h.bType === "house_tavern" && window.ART.house_tavern) {
      houseSprite = window.ART.house_tavern;
    } else if (h.bType === "house_shrine" && window.ART.house_shrine) {
      houseSprite = window.ART.house_shrine;
    } else if (window.ART.house_shop) {
      houseSprite = window.ART.house_shop;
    }

    const bw = h.bType === "house_tavern" ? 175 : h.bType === "house_shrine" ? 158 : 166;
    const aspect = (houseSprite && houseSprite.naturalWidth && houseSprite.naturalHeight)
      ? (houseSprite.naturalHeight / houseSprite.naturalWidth)
      : 1.05;
    const bh = bw * aspect;

    if (houseSprite) {
      drawStyledSceneryImage(ctx,houseSprite,h.x-bw/2,h.y-bh+48,bw,bh,1,h.bType);
    } else {
      ctx.fillStyle = "#3e3128";
      ctx.fillRect(h.x - 48, h.y - 30, 96, 75);
    }

    // 3. 木版招牌：墨色木板＋暗金細線，避免像獨立 UI 元件浮在場景上。
    ctx.save();
    const signW = 132, signH = 32;
    const signY = h.y + 36;

    ctx.fillStyle = "#2a211d";
    ctx.beginPath();
    ctx.roundRect(h.x - signW / 2, signY, signW, signH, 2);
    ctx.fill();
    ctx.strokeStyle = "#171317";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = "#9d7a45";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.textAlign = "center";
    // 町屋招牌用和風筆文字體；保留厚實暗底與暖色字，避免 20px 時過細。
    ctx.font = UI.readableFont(21, "400").replace(
      "'Noto Sans JP', 'Microsoft JhengHei', sans-serif",
      "'Yuji Syuku', 'Kaisei Decol', 'Noto Sans JP', serif"
    );
    ctx.strokeStyle = "#e3d0a8";
    ctx.lineWidth = 0.7;
    ctx.strokeText(HOUSE_NAMES[h.bType] || HOUSE_NAMES.house_shop, h.x, signY + 23, signW - 8);
    ctx.fillStyle = "#e3d0a8";
    ctx.fillText(HOUSE_NAMES[h.bType] || HOUSE_NAMES.house_shop, h.x, signY + 23, signW - 8);
    ctx.restore();

    ctx.restore();
  }

  // 繪製主角（高解析度 Chibi + 步伐彈跳 + 衝刺殘影）
  function drawPlayer(P, isDashing, inv, elapsed, moveDir, shield = 0) {
    ctx.save();
    const isMoving = Math.hypot(moveDir.x, moveDir.y) > 0.1;
    const motion = allowsMotion();
    if (!motion) ghostTrails = [];
    // 1. 步伐彈跳物理 (Procedural Spring Step Bob)
    const walkBob = isMoving && motion ? Math.abs(Math.sin(elapsed * 12)) * 3.5 : 0;

    // 2. 彈性骨骼與次級動態 (Squash & Stretch, Lean Tilt, Secondary Inertial Shear)
    let squash = 1, stretch = 1, leanAng = 0, shearX = 0;
    if (motion) {
      if (isDashing) {
        // 衝刺時：前衝拉伸與前傾俯衝
        squash = 1.15;
        stretch = 0.88;
        leanAng = 0.16;
        shearX = -0.10;
      } else if (isMoving) {
        // 跑步步伐有機彈性：著地與起跳交替起伏
        const stridePhase = Math.sin(elapsed * 12);
        squash = 1.0 + stridePhase * 0.05;
        stretch = 1.0 - stridePhase * 0.04;
        // 跑步身體微前傾
        leanAng = clamp(moveDir.x * (P.faceX || 1) * 0.07, -0.12, 0.12);
        // 背負木箱與手持提燈的次級慣性滯後剪切 (Secondary Pendulum Shear)
        shearX = clamp(-moveDir.x * (P.faceX || 1) * 0.06, -0.08, 0.08);
      } else if (inv > 0) {
        // 受傷頓挫震顫
        const flinch = Math.sin(elapsed * 26) * 0.10;
        squash = 1.0 + flinch;
        stretch = 1.0 - flinch * 0.8;
      }
    }

    // 素材朝右。左右移動才改面向，停下或只上下走時維持最後朝向。
    if (moveDir.x < -0.05) P.faceX = -1;
    else if (moveDir.x > 0.05) P.faceX = 1;
    const flipX = P.faceX < 0 ? -1 : 1;

    // 兩幀步伐切換：移動時左右腳邁步 (walk1 <-> walk2)，靜止時站立 (player)
    let pKey = "player", pImg = window.ART.player;
    if (isMoving && motion) {
      const stepIdx = Math.floor(elapsed * 6) % 2;
      if (stepIdx === 0 && window.ART.player_walk1) {
        pImg = window.ART.player_walk1;
        pKey = "player_walk1";
      } else if (stepIdx === 1 && window.ART.player_walk2) {
        pImg = window.ART.player_walk2;
        pKey = "player_walk2";
      }
    }
    if (isDashing && window.ART.player_dash_v1) { pKey = "player_dash_v1"; pImg = window.ART[pKey]; }
    const poseHeight = pKey === "player_dash_v1" ? 80 : 114;

    // 投影陰影：隨身體起伏微幅呼吸
    const shadowScale = motion && isMoving ? (1.0 - (walkBob / 18)) : 1.0;
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.beginPath();
    ctx.ellipse(P.x, P.y + 22, 28 * shadowScale, 11 * shadowScale, 0, 0, 6.28);
    ctx.fill();

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
  function drawMonster(e, P, elapsed) {
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

    // 陰影：隨身體呼吸同步縮放
    ctx.fillStyle = "rgba(32, 26, 31, 0.37)";
    const shadowR = (isBoss ? 52 : isMis ? 32 : 22) * sX;
    ctx.beginPath();
    ctx.ellipse(e.x, e.y + (isBoss ? 52 : isMis ? 32 : 22) * 0.85, shadowR, shadowR * 0.4, 0, 0, 6.28);
    ctx.fill();

    ctx.translate(e.x, e.y + bob);
    ctx.scale(scaleX * sX, sY);
    if (tilt !== 0) ctx.rotate(tilt);

    let sprite = null;
    let sw = 50;

    if (isBoss) {
      sprite = window.ART.boss;
      sw = 125;
    } else if (isMis) {
      sprite = window.ART.mis;
      sw = 76;
    } else if (e.type === "runner") {
      sprite = window.ART.runner || window.ART.ghost;
      sw = 66;
    } else if (e.type === "tank") {
      sprite = window.ART.tank || window.ART.ghost;
      sw = 74;
    } else if (e.type === "shooter") {
      sprite = window.ART.shooter || window.ART.ghost;
      sw = 62;
    } else {
      sprite = window.ART.ghost;
      sw = 54;
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

    // Boss 結界與血條
    if (isBoss && !e.dying) {
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

      // 漆器金邊血條
      const bw = 88, bh = 9;
      ctx.fillStyle = "#191522";
      ctx.beginPath();
      ctx.roundRect(-bw / 2, 42, bw, bh, 4);
      ctx.fill();
      ctx.strokeStyle = "#d4af37";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const hpRatio = clamp(e.hp / (e.max || 1), 0, 1);
      const hpGrad = ctx.createLinearGradient(-bw / 2, 0, bw / 2, 0);
      hpGrad.addColorStop(0, "#ff4d64");
      hpGrad.addColorStop(1, "#ffa726");
      ctx.fillStyle = hpGrad;
      ctx.beginPath();
      ctx.roundRect(-bw / 2, 42, bw * hpRatio, bh, 4);
      ctx.fill();
      ctx.restore();
    }

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

  // 手繪六角封印靈玉：墨線、和紙面與低強度金箔圈。
  function drawSpiritGem(g, elapsed) {
    const large = g.v > 2, radius = large ? 10 : 8;
    const rise = allowsMotion() ? Math.sin(elapsed * 4 + g.x * .07) * 1.7 : 0;
    ctx.save();
    ctx.translate(g.x, g.y - rise);
    ctx.fillStyle = "rgba(31,26,32,.32)";
    ctx.beginPath();ctx.ellipse(0,radius*.75,radius*.86,3,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle = large ? "rgba(203,165,92,.72)" : "rgba(203,165,92,.48)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();ctx.ellipse(0,0,radius+3,(radius+3)*.85,0,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle = "#6d9999";
    ctx.strokeStyle = "#24252c";
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.beginPath();ctx.moveTo(0,-radius);ctx.lineTo(radius*.72,-radius*.35);
    ctx.lineTo(radius*.72,radius*.42);ctx.lineTo(0,radius);
    ctx.lineTo(-radius*.72,radius*.42);ctx.lineTo(-radius*.72,-radius*.35);
    ctx.closePath();ctx.fill();ctx.stroke();
    ctx.fillStyle = "#d9cda9";
    ctx.beginPath();ctx.moveTo(0,-radius*.7);ctx.lineTo(radius*.35,-radius*.18);
    ctx.lineTo(0,radius*.36);ctx.lineTo(-radius*.35,-radius*.18);
    ctx.closePath();ctx.fill();
    ctx.strokeStyle = "#354d58";ctx.lineWidth = 1.1;
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
    const screenPx = P.x - camX + offset.x;
    const screenPy = P.y - camY + offset.y;
    const flicker = allowsMotion() ? Math.sin(elapsed * 16) * 3 : 0;
    const baseRadius = Math.max(16, (150 + clamp(oil / Math.max(1, maxOil), 0, 1) * 170 + flicker) * (1 - lampOut));

    const playerGlow = lightCtx.createRadialGradient(screenPx, screenPy, 15, screenPx, screenPy, baseRadius);
    playerGlow.addColorStop(0, "rgba(0,0,0,1)");
    playerGlow.addColorStop(0.4, "rgba(0,0,0,0.85)");
    playerGlow.addColorStop(0.8, "rgba(0,0,0,0.35)");
    playerGlow.addColorStop(1, "rgba(0,0,0,0)");

    lightCtx.fillStyle = playerGlow;
    lightCtx.beginPath();
    lightCtx.arc(screenPx, screenPy, baseRadius, 0, 6.28);
    lightCtx.fill();

    // 2. 街角提燈 (LAMPS) 暖光池（燈滅時一併退去）
    lightCtx.globalAlpha = 1 - lampOut;
    LAMPS.forEach(l => {
      const lx = l.x - camX + offset.x, ly = l.y - LAMP_LIGHT_LIFT - camY + offset.y; // 光心在石燈火袋，不是腳底
      if (lx < area.left - 180 || lx > area.right + 180 || ly < area.top - 180 || ly > area.bottom + 180) return;
      const g = lightCtx.createRadialGradient(lx, ly, 10, lx, ly, 125);
      g.addColorStop(0, "rgba(0,0,0,0.95)");
      g.addColorStop(0.5, "rgba(0,0,0,0.5)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      lightCtx.fillStyle = g;
      lightCtx.beginPath();
      lightCtx.arc(lx, ly, 125, 0, 6.28);
      lightCtx.fill();
    });

    lightCtx.globalAlpha = 1;

    // 夜色遮罩只合成一次。暖光是燈暈上的少數徑向漸層，不再鋪第二張全螢幕。
    ctx.drawImage(lightCv, area.left, area.top, area.width, area.height);
    if (lampOut < 1) paintWarmPool(screenPx, screenPy, baseRadius * 0.62);
    if (lampOut < 1) LAMPS.forEach(l => {
      const lx = l.x - camX + offset.x, ly = l.y - LAMP_LIGHT_LIFT - camY + offset.y;
      if (lx < area.left - 180 || lx > area.right + 180 || ly < area.top - 180 || ly > area.bottom + 180) return;
      paintWarmPool(lx, ly, 76);
    });

    function paintWarmPool(x, y, radius) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 1 - lampOut;
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
      const alpha = clamp(d.life / 0.3, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.textAlign = "center";
      ctx.font = `900 ${Math.round(20 * d.scale)}px 'Zen Maru Gothic', sans-serif`;

      ctx.strokeStyle = "#1a162b";
      ctx.lineWidth = 4;
      ctx.strokeText(d.val, d.x, d.y);

      ctx.fillStyle = d.color;
      ctx.fillText(d.val, d.x, d.y);
    }
    ctx.restore();
  }

  function katanaVfxArt(rank = 3) {
    const ranked = window.skillVfxArt?.("katana", rank);
    if (ranked && ranked.naturalWidth > 0 && ranked.naturalHeight > 0) return { img: ranked, mirror: false };
    const legacy = window.ART?.katana_wave_ukiyoe;
    return legacy && legacy.naturalWidth > 0 && legacy.naturalHeight > 0 ? { img: legacy, mirror: true } : null;
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
      const progress = 1 - (s.life / s.maxLife);
      const tierIdx = Math.min(5, Math.max(1, s.tier || 3)) - 1;
      const alpha = s.life / s.maxLife * [0.8, 0.85, 0.95, 1, 1][tierIdx];
      if (drawKatanaSlashArt(s, alpha, tierIdx, progress)) continue;
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
    }
    ctx.restore();
  }

    // 水墨雲影：低透明平塗墨團，不使用現代柔光徑向漸層。
  function drawGroundParallax(elapsed, dawnTime, cam = { x: camX, y: camY }) {
    if (!allowsMotion()) return;
    const area = bounds();
    ctx.save();
    const cloudSpeed = elapsed * 15;
    const cloudParallax = 0.20;
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
    const mistYBase = [area.top + area.height * 0.26, area.top + area.height * 0.68];
    for (let m = 0; m < 2; m++) {
      const mSpeed = (m === 0 ? 12 : -9) * elapsed;
      const basePhase = m * 3.1 + elapsed * 0.4;
      const puffs = 4;
      const step = (area.width + 500) / puffs;
      for (let i = 0; i < puffs; i++) {
        const seed = i * 197 + m * 431;
        const driftX = ((cam.x * 0.45 + mSpeed + i * step) % (area.width + 500)) - 250;
        const px = area.left + driftX;
        const py = mistYBase[m] + Math.sin(basePhase + i * 1.4) * 20 + ((cam.y * 0.15) % 40);
        const rx = 180 + (seed % 60);
        const ry = 46 + (seed % 20);

        ctx.fillStyle = m===0 ? "rgba(132, 145, 166, 0.018)" : "rgba(154, 148, 151, 0.016)";
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
    drawHouse,
    drawScenerySprite,
    drawPlayer,
    drawFrame,
    drawMonster,
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
