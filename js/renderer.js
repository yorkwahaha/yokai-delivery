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
  let terrainCv = null, terrainState = null;
  const hitSilhouettes = new WeakMap();

  // 鏡頭與打擊震動
  let camX = 0, camY = 0;
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

    // 初始化飄落櫻花雨 (50 片)；無邊界世界改採螢幕空間粒子。
    for (let i = 0; i < 50; i++) {
      SAKURA.push({
        x: area.left + Math.random() * area.width,
        y: area.top + Math.random() * area.height,
        vx: 35 + Math.random() * 45,
        vy: 25 + Math.random() * 35,
        size: 5 + Math.random() * 6,
        rot: Math.random() * 6.28,
        vRot: (Math.random() - 0.5) * 3,
        alpha: 0.55 + Math.random() * 0.4
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

  // 生成和風石磚路紋理 Pattern（確保高效且具備立體高光與溝縫）
  function createStonePattern() {
    const pc = document.createElement("canvas");
    pc.width = 160;
    pc.height = 160;
    const pctx = pc.getContext("2d");

    // 底色：深灰黑夜石材
    pctx.fillStyle = "#181d28";
    pctx.fillRect(0, 0, 160, 160);

    // 磚塊陣列
    const stones = [
      { x: 4, y: 4, w: 72, h: 34, c: "#222736" },
      { x: 80, y: 4, w: 76, h: 34, c: "#1e2330" },
      { x: 4, y: 42, w: 48, h: 34, c: "#252b3a" },
      { x: 56, y: 42, w: 60, h: 34, c: "#202533" },
      { x: 120, y: 42, w: 36, h: 34, c: "#272d3e" },
      { x: 4, y: 80, w: 84, h: 34, c: "#1f2432" },
      { x: 92, y: 80, w: 64, h: 34, c: "#242a39" },
      { x: 4, y: 118, w: 56, h: 38, c: "#262c3c" },
      { x: 64, y: 118, w: 54, h: 38, c: "#212635" },
      { x: 122, y: 118, w: 34, h: 38, c: "#1d222f" }
    ];

    stones.forEach(s => {
      pctx.fillStyle = s.c;
      pctx.beginPath();
      pctx.roundRect(s.x, s.y, s.w, s.h, 4);
      pctx.fill();

      // 頂部高光
      pctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
      pctx.lineWidth = 1.5;
      pctx.beginPath();
      pctx.moveTo(s.x + 2, s.y + s.h - 2);
      pctx.lineTo(s.x + 2, s.y + 2);
      pctx.lineTo(s.x + s.w - 2, s.y + 2);
      pctx.stroke();

      // 底部溝縫陰影
      pctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
      pctx.lineWidth = 1.5;
      pctx.beginPath();
      pctx.moveTo(s.x + s.w - 2, s.y + 2);
      pctx.lineTo(s.x + s.w - 2, s.y + s.h - 2);
      pctx.lineTo(s.x + 2, s.y + s.h - 2);
      pctx.stroke();
    });

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
    for (const p of SAKURA) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vRot * dt;
      if (p.x > area.right + 30) p.x = area.left - 30;
      if (p.y > area.bottom + 30) p.y = area.top - 30;
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

  function drawStaticChunk(c, chunk, toriiImg, toriiReady, sakuraImg, sakuraReady) {
    const cx = chunk.x + chunk.w / 2, cy = chunk.y + chunk.h / 2;
    c.save();
    c.textAlign = "center";
    c.font = "900 38px 'Kaisei Decol', 'Noto Sans JP', serif";
    c.fillStyle = "rgba(255, 230, 180, 0.18)";
    c.fillText(chunk.name, cx, chunk.y + 105);
    c.font = "bold 15px 'Zen Maru Gothic', sans-serif";
    c.fillStyle = "rgba(255, 230, 180, 0.14)";
    c.fillText(`— ${chunk.sub || ""} —`, cx, chunk.y + 129);
    if (chunk.decor?.torii && toriiReady) {
      c.fillStyle = "rgba(0, 0, 0, 0.4)";
      c.beginPath();
      c.ellipse(cx, cy + 45, 90, 24, 0, 0, 6.28);
      c.fill();
      const tw = 150, th = tw * toriiImg.naturalHeight / toriiImg.naturalWidth;
      c.drawImage(toriiImg, cx - tw / 2, cy - th + 36, tw, th);
    }
    if (sakuraReady) {
      const sw = 108, sh = sw * sakuraImg.naturalHeight / sakuraImg.naturalWidth;
      for (const tree of chunk.decor?.sakuraTrees || []) {
        c.fillStyle = "rgba(0, 0, 0, 0.35)";
        c.beginPath();
        c.ellipse(tree.x, tree.y - 4, 28, 10, 0, 0, 6.28);
        c.fill();
        c.drawImage(sakuraImg, tree.x - sw / 2, tree.y - sh, sw, sh);
      }
    }
    c.restore();
  }

  // 地名、鳥居與櫻樹跟底圖一起快取。
  function drawGroundBase(chunks, groundKey) {
    const area = bounds(), v = window.VIEWPORT?.get() || {scale:1};
    const pixelScale = ctx.getTransform?.()?.a || (v.scale || 1) * dpr, x = camX + area.left, y = camY + area.top;
    const groundImg = window.ART && window.ART[groundKey];
    const toriiImg = window.ART && window.ART.prop_torii;
    const sakuraImg = window.ART && window.ART.prop_sakura;
    const toriiReady = !!(toriiImg && toriiImg.complete && toriiImg.naturalWidth);
    const sakuraReady = !!(sakuraImg && sakuraImg.complete && sakuraImg.naturalWidth);
    const cached = terrainState;
    if (!cached || cached.key !== groundKey || cached.image !== groundImg || cached.pixelScale !== pixelScale ||
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
      if (groundImg && groundImg.complete && groundImg.naturalWidth) {
        if (groundPatternImage !== groundImg) {groundPattern = c.createPattern(groundImg,"repeat");groundPatternImage = groundImg;}
        c.fillStyle = groundPattern || "#181d28";
      } else c.fillStyle = dirt ? "#6b5135" : stonePattern || "#181d28";
      c.fillRect(left,top,width,height);
      for (const chunk of chunks) {
        if (chunk.x > left+width || chunk.x+chunk.w < left || chunk.y > top+height || chunk.y+chunk.h < top) continue;
        const cx = chunk.x+chunk.w/2, cy = chunk.y+chunk.h/2;
        const g = c.createRadialGradient(cx,cy,100,cx,cy,Math.max(chunk.w,chunk.h)*0.54);
        const tint = chunk.theme === "sakura" ? ["255,160,200",0.14] :
          chunk.theme === "water" || chunk.theme === "lotus" ? ["70,180,220",0.16] :
          chunk.theme === "tavern" || chunk.theme === "market" ? ["255,180,100",0.14] :
          chunk.theme === "mystic" ? ["180,140,255",0.15] : ["120,190,140",0.12];
        g.addColorStop(0,`rgba(${tint[0]},${tint[1]})`);g.addColorStop(1,`rgba(${tint[0]},0)`);
        c.fillStyle = g;c.fillRect(chunk.x,chunk.y,chunk.w,chunk.h);
        drawStaticChunk(c, chunk, toriiImg, toriiReady, sakuraImg, sakuraReady);
      }
      terrainState = {left,top,width:pw/pixelScale,height:ph/pixelScale,key:groundKey,image:groundImg,pixelScale,toriiReady,sakuraReady,viewW:area.width,viewH:area.height,chunks:chunks.slice()};
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

    // 1. 建築深邃接觸陰影
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.beginPath();
    ctx.ellipse(h.x, h.y + 46, 62, 18, 0, 0, 6.28);
    ctx.fill();

    // 2. 選擇高品質手繪建築 Sprite（寬 132px，腳底貼近門口）
    let houseSprite = window.ART.house_shop;
    if (h.bType === "house_tavern" && window.ART.house_tavern) {
      houseSprite = window.ART.house_tavern;
    } else if (h.bType === "house_shrine" && window.ART.house_shrine) {
      houseSprite = window.ART.house_shrine;
    } else if (window.ART.house_shop) {
      houseSprite = window.ART.house_shop;
    }

    const bw = 132;
    const aspect = (houseSprite && houseSprite.naturalWidth && houseSprite.naturalHeight)
      ? (houseSprite.naturalHeight / houseSprite.naturalWidth)
      : 1.05;
    const bh = bw * aspect;

    if (houseSprite) {
      ctx.drawImage(houseSprite, h.x - bw / 2, h.y - bh + 48, bw, bh);
    } else {
      ctx.fillStyle = "#3e3128";
      ctx.fillRect(h.x - 48, h.y - 30, 96, 75);
    }

    // 3. 店門前和風黑漆金箔懸掛匾額；配送內容由委託氣泡顯示。
    ctx.save();
    const signW = 132, signH = 32;
    const signY = h.y + 36;

    ctx.fillStyle = "#19141e";
    ctx.beginPath();
    ctx.roundRect(h.x - signW / 2, signY, signW, signH, 5);
    ctx.fill();
    ctx.strokeStyle = "#d4af37";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.font = UI.readableFont(20, "900");
    ctx.fillStyle = "#ffeed4";
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
    // 步伐畫在走路幀裡。擠壓會把左右腳吃掉，所以主體不再跟著正弦變形。
    const walkBob = isMoving && motion ? Math.sin(elapsed * 10) * 2 : 0;
    const squash = 1;
    const stretch = 1;

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

    // 投影陰影
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.beginPath();
    ctx.ellipse(P.x, P.y + 22, 28 * squash, 11 * stretch, 0, 0, 6.28);
    ctx.fill();

    // 衝刺時加入殘影
    if (isDashing && motion && Math.random() < 0.45 && pImg) {
      addGhostTrail(pImg, P.x, P.y + walkBob, flipX, 1.0, 0.45, pKey, poseHeight);
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

    // 主體變換
    ctx.translate(P.x, P.y + walkBob);
    ctx.scale(flipX * squash, stretch);

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
    const bob = allowsMotion() ? Math.sin(elapsed * 5 + (e.wob || 0)) * 2 : 0;

    // 目標朝向：玩家在怪物左邊時為 -1，在右邊時為 1
    const dirTowardsPlayer = (P.x < e.x) ? -1 : 1;

    // 新素材一律朝畫面右側，玩家在左側時才水平翻轉。
    const scaleX = dirTowardsPlayer === 1 ? 1 : -1;

    // 陰影
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    const shadowR = isBoss ? 52 : isMis ? 32 : 22;
    ctx.beginPath();
    ctx.ellipse(e.x, e.y + shadowR * 0.85, shadowR, shadowR * 0.4, 0, 0, 6.28);
    ctx.fill();

    ctx.translate(e.x, e.y + bob);
    ctx.scale(scaleX, 1);

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
        ctx.strokeStyle = "#8ae4ffdd";
        ctx.lineWidth = 4.5;
        ctx.setLineDash([14, 8]);
        ctx.beginPath();
        ctx.arc(0, -35, 68, ringRot, ringRot + 6.28);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.textAlign = "center";
        ctx.font = "26px sans-serif";
        ctx.fillText("🛡", 0, -110);
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
      ctx.fillStyle = "rgba(35, 14, 52, 0.88)";
      ctx.beginPath();
      ctx.roundRect(e.x - bw / 2, e.y - 72, bw, 32, 6);
      ctx.fill();
      ctx.strokeStyle = "#e1bee7";
      ctx.lineWidth = 1.4;
      ctx.stroke();

      if (typeof UI.drawWordCue === "function") UI.drawWordCue(ctx, e.w, e.x - bw / 2 + 22, e.y - 56, 22);
      ctx.fillStyle = "#f5d4ff";
      ctx.textAlign = "center";
      ctx.fillText(badgeText, e.x + 12, e.y - 49);
      ctx.restore();
    }
  }

  // 繪製立體多光源動態光影（柔和三次樣條光暈 + 街燈光暈池）
  const LAMP_LIGHT_LIFT = 30; // 石燈火袋離腳底的高度；game.js 的石燈光暈用同一數值
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
      const g = lightCtx.createRadialGradient(lx, ly, 12, lx, ly, 160);
      g.addColorStop(0, "rgba(0,0,0,0.95)");
      g.addColorStop(0.5, "rgba(0,0,0,0.5)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      lightCtx.fillStyle = g;
      lightCtx.beginPath();
      lightCtx.arc(lx, ly, 160, 0, 6.28);
      lightCtx.fill();
    });

    lightCtx.globalAlpha = 1;

    // 夜色遮罩只合成一次。暖光是燈暈上的少數徑向漸層，不再鋪第二張全螢幕。
    ctx.drawImage(lightCv, area.left, area.top, area.width, area.height);
    if (lampOut < 1) paintWarmPool(screenPx, screenPy, baseRadius * 0.62);
    if (lampOut < 1) LAMPS.forEach(l => {
      const lx = l.x - camX + offset.x, ly = l.y - LAMP_LIGHT_LIFT - camY + offset.y;
      if (lx < area.left - 180 || lx > area.right + 180 || ly < area.top - 180 || ly > area.bottom + 180) return;
      paintWarmPool(lx, ly, 108);
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

  function drawSlashArcs() {
    ctx.save();
    for (const s of slashArcs) {
      const progress = 1 - (s.life / s.maxLife);
      const tierIdx = Math.min(5, Math.max(1, s.tier || 3)) - 1;
      const alpha = s.life / s.maxLife * [0.8, 0.85, 0.95, 1, 1][tierIdx];
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);

      // 1. 三日月流光刀芒多邊形 (Crescent Blade Polygon - 刀背厚、刀尖刀尾銳利如針)
      const steps = 28;
      const startAng = -s.spread / 2;
      const endAng = s.spread / 2;
      const maxThick = [7, 8, 12, 17, 22][tierIdx] * (0.55 + 0.45 * alpha);

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

      // 單刃 → 雙刃 → 三刃；細實色輪廓取代厚金焰漸層。
      ctx.fillStyle = `rgba(226, 192, 128, ${alpha * 0.75})`;
      ctx.fill();

      // 2. 刀尖極限鋒刃白熱光芒 (Razor Sharp Core Line)
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
      ctx.lineWidth = [1.6, 1.7, 2.2, 2.8, 3.4][tierIdx];
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

      // 4. 刀刃破裂火星 (Flying Sparks along the cutting arc)
      const sparkCount = [3, 6, 9, 12, 16][tierIdx];
      for (let k = 0; k < sparkCount; k++) {
        const st = (k + (s.life * 13) % 1) / sparkCount;
        const sang = startAng + st * (endAng - startAng);
        const sr = s.radius + (Math.sin(k * 7.3) * 16) + progress * 24;
        const sx = Math.cos(sang) * sr;
        const sy = Math.sin(sang) * sr;
        ctx.fillStyle = k % 2 === 0 ? "#ffffff" : "#ffe082";
        ctx.fillRect(sx - 1.5, sy - 1.5, 3, 3);
      }

      ctx.restore();
    }
    ctx.restore();
  }

  function drawAtmosphere(elapsed, petalCount = 50, fireflyCount = FIREFLIES.length) {
    if (!allowsMotion()) return;
    const area = bounds();
    ctx.save();
    // 飄動櫻花雨
    for (let i=0;i<Math.min(SAKURA.length,petalCount);i++) {
      const p=SAKURA[i];
      const sx = p.x, sy = p.y;
      if (sx < area.left - 30 || sx > area.right + 30 || sy < area.top - 30 || sy > area.bottom + 30) continue;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(p.rot);
      ctx.fillStyle = `rgba(255, 195, 220, ${p.alpha})`;
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
      ctx.fillStyle = `rgba(180, 255, 220, ${pulse * 0.75})`;
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
    drawHouse,
    drawPlayer,
    drawFrame,
    drawMonster,
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
