// 渲染引擎：商業級和風手繪管線、石疊地坪紋理、町屋店鋪建築、動態 2D 多光源與 Game Juice
window.RENDERER = (() => {
  const W = 900, H = 600, WW = 2700, WH = 1800;
  let cv, ctx, dpr;
  let lightCv, lightCtx;
  let stonePattern = null;

  // 鏡頭與打擊震動
  let camX = 0, camY = 0;
  let shake = 0, shakeAngle = 0;
  let hitStop = 0;

  // 環境粒子：櫻花瓣、夜行幽火、落葉
  const SAKURA = [];
  const FIREFLIES = [];
  let dmgNumbers = [];
  let slashArcs = [];
  let ghostTrails = [];

  function init(canvas) {
    cv = canvas;
    ctx = cv.getContext("2d");
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = W * dpr;
    cv.height = H * dpr;

    lightCv = document.createElement("canvas");
    lightCv.width = W;
    lightCv.height = H;
    lightCtx = lightCv.getContext("2d");

    // 預先生成高品質石疊（和風石磚路）無縫貼圖
    createStonePattern();

    // 初始化飄落櫻花雨 (50 片)
    for (let i = 0; i < 50; i++) {
      SAKURA.push({
        x: Math.random() * WW,
        y: Math.random() * WH,
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
        x: Math.random() * WW,
        y: Math.random() * WH,
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
    hitStop = duration;
  }

  function triggerShake(intensity = 8) {
    shake = Math.max(shake, intensity);
  }

  function spawnDamageNumber(val, x, y, isCrit = false, color = null) {
    dmgNumbers.push({
      val: Math.round(val * 10) / 10,
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

  function addGhostTrail(img, x, y, flipX, scale, alpha = 0.4) {
    ghostTrails.push({ img, x, y, flipX, scale, life: 0.22, maxLife: 0.22, alpha });
  }

  function addSlashArc(x, y, radius, angle, spread = 2.2) {
    slashArcs.push({ x, y, radius, angle, spread, life: 0.2, maxLife: 0.2 });
  }

  function updateEffects(dt) {
    if (hitStop > 0) {
      hitStop -= dt;
      return true;
    }

    shake = Math.max(0, shake - 32 * dt);

    for (const p of SAKURA) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vRot * dt;
      if (p.x > WW) p.x = 0;
      if (p.y > WH) p.y = 0;
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

    return false;
  }

  // 繪製高質感石疊地坪與自然街區過渡
  function drawGround(elapsed, dawnTime) {
    // 1. 全地圖統一鋪設高精細石磚無縫貼圖（告別廉價大色塊）
    if (stonePattern) {
      ctx.fillStyle = stonePattern;
      ctx.fillRect(0, 0, WW, WH);
    } else {
      ctx.fillStyle = "#181d28";
      ctx.fillRect(0, 0, WW, WH);
    }

    // 2. 街區專屬環境微地坪（自然柔和光彩，無尖銳分割線）
    window.DISTRICTS.forEach((d, i) => {
      const col = i % 3, row = (i / 3) | 0;
      const cx = col * 900 + 450, cy = row * 600 + 300;

      ctx.save();
      // 使用柔和徑向漸層，讓街區自然融合
      const bgGrad = ctx.createRadialGradient(cx, cy, 100, cx, cy, 480);
      if (d.theme === "sakura") {
        bgGrad.addColorStop(0, "rgba(255, 160, 200, 0.14)");
        bgGrad.addColorStop(1, "rgba(255, 160, 200, 0.0)");
      } else if (d.theme === "water" || d.theme === "lotus") {
        bgGrad.addColorStop(0, "rgba(70, 180, 220, 0.16)");
        bgGrad.addColorStop(1, "rgba(70, 180, 220, 0.0)");
      } else if (d.theme === "tavern" || d.theme === "market") {
        bgGrad.addColorStop(0, "rgba(255, 180, 100, 0.14)");
        bgGrad.addColorStop(1, "rgba(255, 180, 100, 0.0)");
      } else if (d.theme === "mystic") {
        bgGrad.addColorStop(0, "rgba(180, 140, 255, 0.15)");
        bgGrad.addColorStop(1, "rgba(180, 140, 255, 0.0)");
      } else {
        bgGrad.addColorStop(0, "rgba(120, 190, 140, 0.12)");
        bgGrad.addColorStop(1, "rgba(120, 190, 140, 0.0)");
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(col * 900, row * 600, 900, 600);

      // 主題水域波光
      if (d.theme === "water" || d.theme === "lotus") {
        ctx.fillStyle = "rgba(100, 210, 255, 0.06)";
        for (let w = 0; w < 5; w++) {
          const wy = row * 600 + 100 + w * 100 + Math.sin(elapsed * 2 + w) * 10;
          ctx.beginPath();
          ctx.roundRect(col * 900 + 40, wy, 820, 28, 14);
          ctx.fill();
        }
      }
      ctx.restore();
    });

    // 3. 主幹道（寬闊御影石大道）
    const ROAD_W = 110;
    ctx.save();
    [450, 1350, 2250].forEach(rx => {
      // 道路深色基底
      ctx.fillStyle = "rgba(12, 15, 24, 0.55)";
      ctx.fillRect(rx - ROAD_W / 2, 0, ROAD_W, WH);

      // 兩側路緣石與陰影
      ctx.fillStyle = "#333d52";
      ctx.fillRect(rx - ROAD_W / 2, 0, 10, WH);
      ctx.fillRect(rx + ROAD_W / 2 - 10, 0, 10, WH);
      ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
      ctx.fillRect(rx - ROAD_W / 2 + 10, 0, 4, WH);
      ctx.fillRect(rx + ROAD_W / 2 - 14, 0, 4, WH);
    });

    [300, 900, 1500].forEach(ry => {
      ctx.fillStyle = "rgba(12, 15, 24, 0.55)";
      ctx.fillRect(0, ry - ROAD_W / 2, WW, ROAD_W);

      ctx.fillStyle = "#333d52";
      ctx.fillRect(0, ry - ROAD_W / 2, WW, 10);
      ctx.fillRect(0, ry + ROAD_W / 2 - 10, WW, 10);
      ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
      ctx.fillRect(0, ry - ROAD_W / 2 + 10, WW, 4);
      ctx.fillRect(0, ry + ROAD_W / 2 - 14, WW, 4);
    });
    ctx.restore();

    // 4. 街區金箔書法浮水印名標
    window.DISTRICTS.forEach((d, i) => {
      const col = i % 3, row = (i / 3) | 0;
      const cx = col * 900 + 450, cy = row * 600 + 105;
      ctx.save();
      ctx.textAlign = "center";
      ctx.font = "900 38px 'Kaisei Decol', 'Noto Sans JP', serif";
      ctx.fillStyle = "rgba(255, 230, 180, 0.18)";
      ctx.fillText(d.name, cx, cy);
      ctx.font = "bold 15px 'Zen Maru Gothic', sans-serif";
      ctx.fillStyle = "rgba(255, 230, 180, 0.14)";
      ctx.fillText(`— ${d.sub || ""} —`, cx, cy + 24);
      ctx.restore();
    });

    // 5. 主幹道十字路口的鳥居與石燈籠裝飾
    const toriiImg = window.ART.prop_torii;
    if (toriiImg) {
      const intersections = [
        { x: 1350, y: 300 },
        { x: 1350, y: 1500 }
      ];
      intersections.forEach(pt => {
        ctx.save();
        // 鳥居陰影
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        ctx.beginPath();
        ctx.ellipse(pt.x, pt.y + 45, 90, 24, 0, 0, 6.28);
        ctx.fill();

        const tw = 160, th = 150;
        ctx.drawImage(toriiImg, pt.x - tw / 2, pt.y - th + 45, tw, th);
        ctx.restore();
      });
    }
  }

  // 繪製高精緻度日式町屋店鋪（真實店鋪 Sprite + 障子金光 + 和風招牌）
  function drawHouse(h, hintT) {
    ctx.save();

    // 1. 建築深邃接觸陰影
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.beginPath();
    ctx.ellipse(h.x, h.y + 46, 62, 18, 0, 0, 6.28);
    ctx.fill();

    // 2. 選擇高品質手繪建築 Sprite（縮小至 115px，保持視野開闊）
    let houseSprite = window.ART.house_shop;
    if (h.bType === "house_tavern" && window.ART.house_tavern) {
      houseSprite = window.ART.house_tavern;
    } else if (h.bType === "house_shrine" && window.ART.house_shrine) {
      houseSprite = window.ART.house_shrine;
    } else if (window.ART.house_shop) {
      houseSprite = window.ART.house_shop;
    }

    const bw = 115;
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

    // 3. 店門前和風黑漆金箔懸掛匾額（單字看板）
    ctx.save();
    const signW = 76, signH = 22;
    const signY = h.y + 36;

    ctx.fillStyle = "#19141e";
    ctx.beginPath();
    ctx.roundRect(h.x - signW / 2, signY, signW, signH, 5);
    ctx.fill();
    ctx.strokeStyle = "#d4af37";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.font = "900 13px 'Zen Maru Gothic', 'Noto Sans JP', sans-serif";
    ctx.fillStyle = "#ffeed4";
    ctx.fillText(h.word.jp, h.x, signY + 15);
    ctx.restore();

    // 4. 提示覆蓋
    if (hintT > 0) {
      ctx.save();
      ctx.fillStyle = "rgba(255, 250, 235, 0.95)";
      ctx.beginPath();
      ctx.roundRect(h.x - 36, h.y + 64, 72, 20, 5);
      ctx.fill();
      ctx.strokeStyle = "#382d24";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.textAlign = "center";
      ctx.fillStyle = "#2a1e17";
      ctx.font = "bold 12px 'Noto Sans JP', sans-serif";
      ctx.fillText(h.word.zh, h.x, h.y + 78);
      ctx.restore();
    }

    ctx.restore();
  }

  // 繪製主角（高解析度 Chibi + 步伐彈跳 + 衝刺殘影）
  function drawPlayer(P, isDashing, inv, elapsed, moveDir, shield = 0) {
    ctx.save();
    const isMoving = Math.hypot(moveDir.x, moveDir.y) > 0.1;
    const walkBob = isMoving ? Math.sin(elapsed * 16) * 4 : Math.sin(elapsed * 4) * 1.5;
    const squash = isMoving ? (1 + Math.sin(elapsed * 16) * 0.06) : 1;
    const stretch = isMoving ? (1 - Math.sin(elapsed * 16) * 0.06) : 1;

    // 主角天然朝向為 RIGHT (1)
    const flipX = moveDir.x < -0.05 ? -1 : 1;

    // 兩幀步伐切換：移動時左右腳邁步 (walk1 <-> walk2)，靜止時站立 (player)
    let pImg = window.ART.player;
    if (isMoving) {
      const stepIdx = Math.floor(elapsed * 8) % 2;
      if (stepIdx === 0 && window.ART.player_walk1) {
        pImg = window.ART.player_walk1;
      } else if (stepIdx === 1 && window.ART.player_walk2) {
        pImg = window.ART.player_walk2;
      }
    }

    // 投影陰影
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.beginPath();
    ctx.ellipse(P.x, P.y + 22, 28 * squash, 11 * stretch, 0, 0, 6.28);
    ctx.fill();

    // 衝刺時加入殘影
    if (isDashing && Math.random() < 0.45 && pImg) {
      addGhostTrail(pImg, P.x, P.y + walkBob, flipX, 1.0, 0.45);
    }

    // 繪製殘影
    for (const g of ghostTrails) {
      const a = (g.life / g.maxLife) * g.alpha;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(g.x, g.y);
      ctx.scale(g.flipX, 1);
      const pw = 84;
      const ph = (g.img.naturalWidth && g.img.naturalHeight) ? (pw * g.img.naturalHeight / g.img.naturalWidth) : 96;
      ctx.drawImage(g.img, -pw / 2, -ph + 20, pw, ph);
      ctx.restore();
    }

    // 主體變換
    ctx.translate(P.x, P.y + walkBob);
    ctx.scale(flipX * squash, stretch);

    // 金剛結界護盾環繞（若 shield > 0）
    if (shield > 0) {
      ctx.save();
      const rot = elapsed * 2.8;
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
        ctx.shadowColor = "#ffb700";
        ctx.shadowBlur = 10;
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
      const pw = 84;
      const ph = (pImg.naturalWidth && pImg.naturalHeight) ? (pw * pImg.naturalHeight / pImg.naturalWidth) : 96;
      ctx.drawImage(pImg, -pw / 2, -ph + 20, pw, ph);
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
    const bob = Math.sin(elapsed * 7 + (e.wob || 0)) * 5;

    // 目標朝向：玩家在怪物左邊時為 -1，在右邊時為 1
    const dirTowardsPlayer = (P.x < e.x) ? -1 : 1;

    // 依照各怪物的原生手繪面向修正 flipX：
    // ghost.png: 原生面向 LEFT (-1) -> 當 dirTowardsPlayer 為 -1 時不翻轉 (scaleX = 1)；為 1 時翻轉 (scaleX = -1)
    // runner.png: 原生面向 LEFT (-1) -> dirTowardsPlayer === -1 ? 1 : -1
    // mis.png: 原生面向 LEFT (-1) -> dirTowardsPlayer === -1 ? 1 : -1
    // shooter.png: 原生吐火面向 RIGHT (1) -> dirTowardsPlayer === 1 ? 1 : -1
    // boss, tank: 對稱/正面朝向 -> 跟隨玩家方位微側
    let scaleX = 1;
    if (e.type === "ghost" || e.type === "mis") {
      scaleX = (dirTowardsPlayer === -1) ? 1 : -1;
    } else if (e.type === "runner" || e.type === "shooter") {
      scaleX = (dirTowardsPlayer === 1) ? 1 : -1;
    } else {
      scaleX = (dirTowardsPlayer === -1) ? 1 : -1;
    }

    // 陰影
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    const shadowR = isBoss ? 52 : isMis ? 32 : 22;
    ctx.beginPath();
    ctx.ellipse(e.x, e.y + shadowR * 0.85, shadowR, shadowR * 0.4, 0, 0, 6.28);
    ctx.fill();

    ctx.translate(e.x, e.y + bob);
    ctx.scale(scaleX, 1);

    // 受擊白色高亮
    if (e.flash > 0) {
      ctx.filter = "brightness(2.2) contrast(1.5)";
    }

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
      ctx.drawImage(sprite, -sw / 2, -actualH * 0.85, sw, actualH);
    } else {
      ctx.fillStyle = isBoss ? "#8a2434" : isMis ? "#68399e" : "#80c4ff";
      ctx.beginPath();
      ctx.arc(0, -sw * 0.4, sw * 0.4, 0, 6.28);
      ctx.fill();
    }

    ctx.filter = "none";
    ctx.restore();

    // Boss 結界與血條
    if (isBoss) {
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

    // 誤配妖怪頭頂名牌
    if (isMis && e.w) {
      ctx.save();
      ctx.textAlign = "center";
      ctx.font = "bold 15px 'Zen Maru Gothic', sans-serif";
      ctx.fillStyle = "#f5d4ff";
      ctx.shadowColor = "#491566";
      ctx.shadowBlur = 6;
      ctx.fillText(`${e.w.icon} ${e.w.jp}`, e.x, e.y - 50);
      ctx.restore();
    }
  }

  // 繪製立體多光源動態光影（柔和三次樣條光暈 + 街燈光暈池）
  function renderLighting(P, LAMPS, oil, elapsed, dawnTime) {
    const progress = clamp(elapsed / dawnTime, 0, 1);
    lightCtx.globalCompositeOperation = "source-over";
    lightCtx.clearRect(0, 0, W, H);

    // 夜色背景（深紫青色調，黎明過渡）
    const nightR = Math.round(7 + 75 * progress);
    const nightG = Math.round(10 + 45 * progress);
    const nightB = Math.round(26 + 25 * progress);
    const nightAlpha = 0.94 * Math.pow(1 - progress, 1.3);

    lightCtx.fillStyle = `rgba(${nightR}, ${nightG}, ${nightB}, ${nightAlpha})`;
    lightCtx.fillRect(0, 0, W, H);

    // 挖出光源 (destination-out)
    lightCtx.globalCompositeOperation = "destination-out";

    // 1. 主角提燈核心光照
    const screenPx = P.x - camX;
    const screenPy = P.y - camY;
    const flicker = Math.sin(elapsed * 16) * 3;
    const baseRadius = 150 + (oil / 100) * 170 + flicker;

    const playerGlow = lightCtx.createRadialGradient(screenPx, screenPy, 15, screenPx, screenPy, baseRadius);
    playerGlow.addColorStop(0, "rgba(0,0,0,1)");
    playerGlow.addColorStop(0.4, "rgba(0,0,0,0.85)");
    playerGlow.addColorStop(0.8, "rgba(0,0,0,0.35)");
    playerGlow.addColorStop(1, "rgba(0,0,0,0)");

    lightCtx.fillStyle = playerGlow;
    lightCtx.beginPath();
    lightCtx.arc(screenPx, screenPy, baseRadius, 0, 6.28);
    lightCtx.fill();

    // 2. 街角提燈 (LAMPS) 暖光池
    LAMPS.forEach(l => {
      const lx = l.x - camX, ly = l.y - camY;
      if (lx < -180 || lx > W + 180 || ly < -180 || ly > H + 180) return;
      const g = lightCtx.createRadialGradient(lx, ly, 12, lx, ly, 160);
      g.addColorStop(0, "rgba(0,0,0,0.95)");
      g.addColorStop(0.5, "rgba(0,0,0,0.5)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      lightCtx.fillStyle = g;
      lightCtx.beginPath();
      lightCtx.arc(lx, ly, 160, 0, 6.28);
      lightCtx.fill();
    });

    // 繪製遮罩回主 Canvas
    ctx.drawImage(lightCv, 0, 0, W, H);

    // 疊加提燈金黃色光暈（Screen Blend 溫暖柔光）
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const warmGlow = ctx.createRadialGradient(screenPx, screenPy, 0, screenPx, screenPy, baseRadius * 0.85);
    warmGlow.addColorStop(0, "rgba(255, 220, 130, 0.38)");
    warmGlow.addColorStop(0.45, "rgba(255, 160, 60, 0.16)");
    warmGlow.addColorStop(1, "rgba(255, 140, 40, 0)");
    ctx.fillStyle = warmGlow;
    ctx.beginPath();
    ctx.arc(screenPx, screenPy, baseRadius * 0.85, 0, 6.28);
    ctx.fill();

    // 街角提燈的橘紅色暖光暈
    LAMPS.forEach(l => {
      const lx = l.x - camX, ly = l.y - camY;
      if (lx < -180 || lx > W + 180 || ly < -180 || ly > H + 180) return;
      const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, 130);
      lg.addColorStop(0, "rgba(255, 175, 70, 0.28)");
      lg.addColorStop(1, "rgba(255, 150, 50, 0)");
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.arc(lx, ly, 130, 0, 6.28);
      ctx.fill();
    });
    ctx.restore();
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
      const alpha = s.life / s.maxLife;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);

      // 金黃金箔斬擊流光
      ctx.strokeStyle = `rgba(255, 235, 140, ${alpha * 0.95})`;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(0, 0, s.radius, -s.spread / 2, s.spread / 2);
      ctx.stroke();

      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawAtmosphere(elapsed) {
    ctx.save();
    // 飄動櫻花雨
    for (const p of SAKURA) {
      const sx = p.x - camX, sy = p.y - camY;
      if (sx < -30 || sx > W + 30 || sy < -30 || sy > H + 30) continue;
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
    for (const f of FIREFLIES) {
      const fx = (f.x + Math.sin(elapsed * 2 + f.phase) * 30) - camX;
      const fy = (f.y + Math.cos(elapsed * 1.5 + f.phase) * 20) - camY;
      if (fx < -20 || fx > W + 20 || fy < -20 || fy > H + 20) continue;
      const pulse = 0.4 + 0.6 * Math.sin(elapsed * 4 + f.phase);
      ctx.fillStyle = `rgba(180, 255, 220, ${pulse * 0.75})`;
      ctx.beginPath();
      ctx.arc(fx, fy, 3.5, 0, 6.28);
      ctx.fill();
    }
    ctx.restore();
  }

  return {
    init,
    W, H, WW, WH,
    getCam: () => ({ x: camX, y: camY }),
    setCam(x, y) { camX = x; camY = y; },
    getDpr: () => dpr,
    getCtx: () => ctx,
    getCanvas: () => cv,
    triggerHitStop,
    triggerShake,
    spawnDamageNumber,
    addSlashArc,
    updateEffects,
    drawGround,
    drawHouse,
    drawPlayer,
    drawMonster,
    renderLighting,
    drawDamageNumbers,
    drawSlashArcs,
    drawAtmosphere,
    getShakeOffset() {
      return {
        x: (Math.random() - 0.5) * shake,
        y: (Math.random() - 0.5) * shake
      };
    }
  };
})();
