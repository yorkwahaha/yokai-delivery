// 渲染引擎：高畫質和風動態手繪管線、動態 2D 光影、體積霧與 Game Juice 特效
window.RENDERER = (() => {
  const W = 900, H = 600, WW = 2700, WH = 1800;
  let cv, ctx, dpr;
  let lightCv, lightCtx;

  // 鏡頭與打擊震動
  let camX = 0, camY = 0;
  let shake = 0, shakeAngle = 0;
  let hitStop = 0;

  // 環境粒子：櫻花瓣、夜行幽火、夜霧
  const SAKURA = [];
  const FIREFLIES = [];
  const FOG_LAYERS = [
    { x: 0, speed: 12, alpha: 0.08, color: "#9aa6d6" },
    { x: 0, speed: 24, alpha: 0.05, color: "#d9b3ff" }
  ];

  // 浮動文字與打擊火花
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

    // 初始化櫻花瓣 (35 片)
    for (let i = 0; i < 40; i++) {
      SAKURA.push({
        x: Math.random() * WW,
        y: Math.random() * WH,
        vx: 30 + Math.random() * 40,
        vy: 20 + Math.random() * 30,
        size: 5 + Math.random() * 5,
        rot: Math.random() * 6.28,
        vRot: (Math.random() - 0.5) * 3,
        alpha: 0.5 + Math.random() * 0.4
      });
    }

    // 初始化夜行螢火蟲 (25 隻)
    for (let i = 0; i < 25; i++) {
      FIREFLIES.push({
        x: Math.random() * WW,
        y: Math.random() * WH,
        phase: Math.random() * 6.28,
        speed: 8 + Math.random() * 12
      });
    }
  }

  // 輔助繪圖
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  // 觸發打擊頓挫 (Hit-Stop)
  function triggerHitStop(duration = 0.04) {
    hitStop = duration;
  }

  // 觸發畫面震動
  function triggerShake(intensity = 8) {
    shake = Math.max(shake, intensity);
  }

  // 彈跳傷害數字
  function spawnDamageNumber(val, x, y, isCrit = false, color = null) {
    dmgNumbers.push({
      val: Math.round(val * 10) / 10,
      x: x + (Math.random() - 0.5) * 20,
      y: y - 10,
      vy: -110 - Math.random() * 50,
      vx: (Math.random() - 0.5) * 40,
      life: 0.75,
      maxLife: 0.75,
      scale: isCrit ? 1.5 : 1.0,
      isCrit,
      color: color || (isCrit ? "#ffd152" : "#ffffff")
    });
  }

  // 玩家殘影
  function addGhostTrail(img, x, y, flipX, scale, alpha = 0.4) {
    ghostTrails.push({ img, x, y, flipX, scale, life: 0.22, maxLife: 0.22, alpha });
  }

  // 刀光弧線
  function addSlashArc(x, y, radius, angle, spread = 2.1) {
    slashArcs.push({ x, y, radius, angle, spread, life: 0.18, maxLife: 0.18 });
  }

  // 更新特效
  function updateEffects(dt) {
    if (hitStop > 0) {
      hitStop -= dt;
      return true; // 處於頓挫中
    }

    shake = Math.max(0, shake - 32 * dt);

    // 櫻花飄動
    for (const p of SAKURA) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vRot * dt;
      if (p.x > WW) p.x = 0;
      if (p.y > WH) p.y = 0;
    }

    // 霧氣流動
    for (const f of FOG_LAYERS) {
      f.x = (f.x + f.speed * dt) % W;
    }

    // 傷害數字更新
    for (const d of dmgNumbers) {
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vy += 220 * dt; // 輕微重力
      d.life -= dt;
    }
    dmgNumbers = dmgNumbers.filter(d => d.life > 0);

    // 殘影更新
    for (const g of ghostTrails) g.life -= dt;
    ghostTrails = ghostTrails.filter(g => g.life > 0);

    // 斬擊弧更新
    for (const s of slashArcs) s.life -= dt;
    slashArcs = slashArcs.filter(s => s.life > 0);

    return false;
  }

  // 繪製地圖區塊與道路
  function drawGround(elapsed, dawnTime) {
    // 繪製各街區主題地面
    window.DISTRICTS.forEach((d, i) => {
      const col = i % 3, row = (i / 3) | 0;
      const x = col * 900, y = row * 600;

      // 街區底色
      ctx.fillStyle = d.floorColor || "#2b3447";
      ctx.fillRect(x, y, 900, 600);

      // 主題地坪細節
      ctx.save();
      if (d.theme === "water") {
        // 水波倒影紋理
        ctx.fillStyle = "rgba(100, 180, 220, 0.08)";
        for (let r = 0; r < 6; r++) {
          const waveY = y + 70 + r * 90 + Math.sin(elapsed * 2 + r) * 12;
          ctx.fillRect(x + 20, waveY, 860, 22);
        }
      } else if (d.theme === "sakura") {
        // 櫻花坡落瓣
        ctx.fillStyle = "rgba(255, 180, 210, 0.12)";
        for (let k = 0; k < 18; k++) {
          ctx.beginPath();
          ctx.arc(x + 50 + (k * 47) % 800, y + 40 + (k * 31) % 520, 14, 0, 6.28);
          ctx.fill();
        }
      } else if (d.theme === "wood_pier" || d.theme === "market") {
        // 木棧板條紋
        ctx.strokeStyle = "rgba(0, 0, 0, 0.12)";
        ctx.lineWidth = 2;
        for (let py = y + 10; py < y + 600; py += 32) {
          ctx.beginPath();
          ctx.moveTo(x, py);
          ctx.lineTo(x + 900, py);
          ctx.stroke();
        }
      }
      ctx.restore();
    });

    // 寬闊主要街道（石疊大道）
    const ROAD_W = 104;
    [450, 1350, 2250].forEach(rx => {
      ctx.fillStyle = "#3f4657";
      ctx.fillRect(rx - ROAD_W / 2, 0, ROAD_W, WH);
      // 石磚路緣石
      ctx.fillStyle = "#2a303d";
      ctx.fillRect(rx - ROAD_W / 2, 0, 8, WH);
      ctx.fillRect(rx + ROAD_W / 2 - 8, 0, 8, WH);
    });

    [300, 900, 1500].forEach(ry => {
      ctx.fillStyle = "#3f4657";
      ctx.fillRect(0, ry - ROAD_W / 2, WW, ROAD_W);
      ctx.fillStyle = "#2a303d";
      ctx.fillRect(0, ry - ROAD_W / 2, WW, 8);
      ctx.fillRect(0, ry + ROAD_W / 2 - 8, WW, 8);
    });

    // 和風石疊網格
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 2;
    [450, 1350, 2250].forEach(rx => {
      for (let sy = 0; sy < WH; sy += 36) {
        ctx.beginPath();
        ctx.moveTo(rx - ROAD_W / 2 + 8, sy);
        ctx.lineTo(rx + ROAD_W / 2 - 8, sy);
        ctx.stroke();
      }
    });

    // 街區名牌 (半透明日式書法)
    window.DISTRICTS.forEach((d, i) => {
      const col = i % 3, row = (i / 3) | 0;
      const cx = col * 900 + 450, cy = row * 600 + 105;
      ctx.save();
      ctx.textAlign = "center";
      ctx.font = "900 36px 'Kaisei Decol', 'Noto Sans JP', serif";
      ctx.fillStyle = "rgba(255, 240, 210, 0.16)";
      ctx.fillText(d.name, cx, cy);
      ctx.font = "bold 15px 'Zen Maru Gothic', sans-serif";
      ctx.fillStyle = "rgba(255, 240, 210, 0.12)";
      ctx.fillText(`— ${d.sub || ""} —`, cx, cy + 24);
      ctx.restore();
    });
  }

  // 繪製日式町屋房屋 (Machiya)
  function drawHouse(h, hintT) {
    ctx.save();
    // 房屋本體陰影
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.ellipse(h.x, h.y + 45, 68, 26, 0, 0, 6.28);
    ctx.fill();

    // 建築主體 (木造牆面)
    ctx.fillStyle = "#4a3b32";
    ctx.fillRect(h.x - 56, h.y - 15, 112, 60);

    // 格子障子門 (透出溫暖黃光)
    const doorGlow = ctx.createLinearGradient(0, h.y - 5, 0, h.y + 40);
    doorGlow.addColorStop(0, "#ffe8a3");
    doorGlow.addColorStop(1, "#f2a641");
    ctx.fillStyle = doorGlow;
    ctx.fillRect(h.x - 26, h.y + 5, 52, 40);

    // 障子木格
    ctx.strokeStyle = "#2e1e17";
    ctx.lineWidth = 2.5;
    ctx.strokeRect(h.x - 26, h.y + 5, 52, 40);
    ctx.beginPath();
    ctx.moveTo(h.x, h.y + 5); ctx.lineTo(h.x, h.y + 45);
    ctx.moveTo(h.x - 26, h.y + 25); ctx.lineTo(h.x + 26, h.y + 25);
    ctx.stroke();

    // 暖簾 (Noren Curtains)
    ctx.fillStyle = h.color || "#913b47";
    ctx.fillRect(h.x - 28, h.y + 5, 56, 14);
    ctx.fillStyle = "#fff";
    ctx.fillRect(h.x - 1, h.y + 5, 2, 14);

    // 飛簷日式瓦屋頂 (Kawara Tiled Roof)
    ctx.fillStyle = "#273043";
    ctx.beginPath();
    ctx.moveTo(h.x - 72, h.y - 12);
    ctx.quadraticCurveTo(h.x - 40, h.y - 48, h.x, h.y - 62);
    ctx.quadraticCurveTo(h.x + 40, h.y - 48, h.x + 72, h.y - 12);
    ctx.lineTo(h.x + 60, h.y - 5);
    ctx.lineTo(h.x - 60, h.y - 5);
    ctx.closePath();
    ctx.fill();

    // 屋脊與金屬飾角
    ctx.strokeStyle = "#c29d5b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(h.x - 72, h.y - 12);
    ctx.quadraticCurveTo(h.x - 40, h.y - 48, h.x, h.y - 62);
    ctx.quadraticCurveTo(h.x + 40, h.y - 48, h.x + 72, h.y - 12);
    ctx.stroke();

    // 店面掛匾 (單字招牌)
    ctx.fillStyle = "#1e1714";
    ctx.fillRect(h.x - 42, h.y - 36, 84, 25);
    ctx.strokeStyle = "#c29d5b";
    ctx.lineWidth = 2;
    ctx.strokeRect(h.x - 42, h.y - 36, 84, 25);

    ctx.textAlign = "center";
    ctx.fillStyle = "#ffeed4";
    ctx.font = "bold 16px 'Zen Maru Gothic', 'Noto Sans JP', sans-serif";
    ctx.fillText(h.word.jp, h.x, h.y - 18);

    // 門口吉祥物/單字圖示
    ctx.font = "26px sans-serif";
    ctx.fillText(h.word.icon, h.x, h.y + 40);

    // 提示覆蓋
    if (hintT > 0) {
      ctx.fillStyle = "#fff8e7";
      ctx.beginPath();
      ctx.roundRect(h.x - 38, h.y + 54, 76, 22, 6);
      ctx.fill();
      ctx.strokeStyle = "#382d24";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = "#2a1e17";
      ctx.font = "bold 13px 'Noto Sans JP', sans-serif";
      ctx.fillText(h.word.zh, h.x, h.y + 70);
    }
    ctx.restore();
  }

  // 繪製主角（高畫質手繪 Chibi + 程式骨骼彈跳 + 提燈動態）
  function drawPlayer(P, isDashing, inv, elapsed, moveDir) {
    ctx.save();
    const isMoving = Math.hypot(moveDir.x, moveDir.y) > 0.1;
    const walkBob = isMoving ? Math.sin(elapsed * 16) * 4 : Math.sin(elapsed * 4) * 1.5;
    const squash = isMoving ? (1 + Math.sin(elapsed * 16) * 0.06) : 1;
    const stretch = isMoving ? (1 - Math.sin(elapsed * 16) * 0.06) : 1;
    const flipX = moveDir.x < -0.05 ? -1 : 1;

    // 投影陰影
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.beginPath();
    ctx.ellipse(P.x, P.y + 22, 28 * squash, 11 * stretch, 0, 0, 6.28);
    ctx.fill();

    // 衝刺時加入殘影
    if (isDashing && Math.random() < 0.45 && window.ART.player) {
      addGhostTrail(window.ART.player, P.x, P.y + walkBob, flipX, 1.0, 0.45);
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

    // 受擊閃爍
    if (inv > 0 && Math.floor(elapsed * 24) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }

    if (window.ART.player) {
      // 繪製手繪高解析度角色（保持原生高寬比例）
      const pImg = window.ART.player;
      const pw = 84;
      const ph = (pImg.naturalWidth && pImg.naturalHeight) ? (pw * pImg.naturalHeight / pImg.naturalWidth) : 96;
      ctx.drawImage(pImg, -pw / 2, -ph + 20, pw, ph);
    } else {
      // 程序化手繪備援
      ctx.fillStyle = "#e07a3c";
      ctx.beginPath();
      ctx.arc(0, -18, 20, 0, 6.28);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(-7, -20, 4, 0, 6.28);
      ctx.arc(7, -20, 4, 0, 6.28);
      ctx.fill();
    }

    ctx.restore();
  }

  // 繪製妖怪怪物（手繪 Sprite + 呼吸浮動 + 受擊白閃）
  function drawMonster(e, P, elapsed) {
    ctx.save();
    const isBoss = e.type === "boss";
    const isMis = e.type === "mis";
    const bob = Math.sin(elapsed * 7 + (e.wob || 0)) * 5;
    const flipX = (P.x < e.x) ? -1 : 1;

    // 陰影
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    const shadowR = isBoss ? 48 : isMis ? 30 : 20;
    ctx.beginPath();
    ctx.ellipse(e.x, e.y + shadowR * 0.85, shadowR, shadowR * 0.4, 0, 0, 6.28);
    ctx.fill();

    ctx.translate(e.x, e.y + bob);
    ctx.scale(flipX, 1);

    // 受擊白色高亮
    if (e.flash > 0) {
      ctx.filter = "brightness(2.2) contrast(1.5)";
    }

    // 依照怪物類型選取對應的手繪資產
    let sprite = null;
    let sw = 48, sh = 48;

    if (isBoss) {
      sprite = window.ART.boss;
      sw = 120; sh = 120;
    } else if (isMis) {
      sprite = window.ART.mis;
      sw = 72; sh = 72;
    } else if (e.type === "runner") {
      sprite = window.ART.runner || window.ART.ghost;
      sw = 62; sh = 62;
    } else if (e.type === "tank") {
      sprite = window.ART.tank || window.ART.ghost;
      sw = 70; sh = 70;
    } else if (e.type === "shooter") {
      sprite = window.ART.shooter || window.ART.ghost;
      sw = 58; sh = 58;
    } else {
      sprite = window.ART.ghost;
      sw = 50; sh = 50;
    }

    if (sprite) {
      const aspect = (sprite.naturalWidth && sprite.naturalHeight) ? (sprite.naturalHeight / sprite.naturalWidth) : 1;
      const actualH = sw * aspect;
      ctx.drawImage(sprite, -sw / 2, -actualH * 0.85, sw, actualH);
    } else {
      // 備援
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
        // 旋轉符文結界
        const ringRot = elapsed * 1.8;
        ctx.strokeStyle = "#8ae4ffcc";
        ctx.lineWidth = 4;
        ctx.setLineDash([12, 8]);
        ctx.beginPath();
        ctx.arc(0, -30, 64, ringRot, ringRot + 6.28);
        ctx.stroke();
        ctx.setLineDash([]);

        // 結界護盾圖示
        ctx.textAlign = "center";
        ctx.font = "24px sans-serif";
        ctx.fillText("🛡", 0, -100);
      }

      // 血條 (漆器底色 + 漸層血量)
      const bw = 80, bh = 8;
      ctx.fillStyle = "#1e2436";
      ctx.beginPath();
      ctx.roundRect(-bw / 2, 40, bw, bh, 4);
      ctx.fill();

      const hpRatio = clamp(e.hp / (e.max || 1), 0, 1);
      const hpGrad = ctx.createLinearGradient(-bw / 2, 0, bw / 2, 0);
      hpGrad.addColorStop(0, "#ff4d64");
      hpGrad.addColorStop(1, "#ff9e59");
      ctx.fillStyle = hpGrad;
      ctx.beginPath();
      ctx.roundRect(-bw / 2, 40, bw * hpRatio, bh, 4);
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
      ctx.fillText(`${e.w.icon} ${e.w.jp}`, e.x, e.y - 48);
      ctx.restore();
    }
  }

  // 繪製動態 2D 光影遮罩（深夜至黎明）
  function renderLighting(P, LAMPS, oil, elapsed, dawnTime) {
    const progress = clamp(elapsed / dawnTime, 0, 1);
    lightCtx.globalCompositeOperation = "source-over";
    lightCtx.clearRect(0, 0, W, H);

    // 夜色背景色（依黎明進度由深紫藍漸層變至微光）
    const nightR = Math.round(8 + 80 * progress);
    const nightG = Math.round(12 + 50 * progress);
    const nightB = Math.round(28 + 30 * progress);
    const nightAlpha = 0.92 * Math.pow(1 - progress, 1.4);

    lightCtx.fillStyle = `rgba(${nightR}, ${nightG}, ${nightB}, ${nightAlpha})`;
    lightCtx.fillRect(0, 0, W, H);

    // 挖出光源 (destination-out)
    lightCtx.globalCompositeOperation = "destination-out";

    // 1. 主角提燈光照（油量影響半徑與微晃動）
    const screenPx = P.x - camX;
    const screenPy = P.y - camY;
    const flicker = Math.sin(elapsed * 18) * 3;
    const baseRadius = 140 + (oil / 100) * 160 + flicker;

    const playerGlow = lightCtx.createRadialGradient(screenPx, screenPy, 15, screenPx, screenPy, baseRadius);
    playerGlow.addColorStop(0, "rgba(0,0,0,1)");
    playerGlow.addColorStop(0.5, "rgba(0,0,0,0.85)");
    playerGlow.addColorStop(0.85, "rgba(0,0,0,0.35)");
    playerGlow.addColorStop(1, "rgba(0,0,0,0)");

    lightCtx.fillStyle = playerGlow;
    lightCtx.beginPath();
    lightCtx.arc(screenPx, screenPy, baseRadius, 0, 6.28);
    lightCtx.fill();

    // 2. 街角提燈 (LAMPS) 光源
    LAMPS.forEach(l => {
      const lx = l.x - camX, ly = l.y - camY;
      if (lx < -160 || lx > W + 160 || ly < -160 || ly > H + 160) return;
      const g = lightCtx.createRadialGradient(lx, ly, 10, lx, ly, 150);
      g.addColorStop(0, "rgba(0,0,0,0.95)");
      g.addColorStop(0.6, "rgba(0,0,0,0.5)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      lightCtx.fillStyle = g;
      lightCtx.beginPath();
      lightCtx.arc(lx, ly, 150, 0, 6.28);
      lightCtx.fill();
    });

    // 繪製遮罩回主 Canvas
    ctx.drawImage(lightCv, 0, 0, W, H);

    // 疊加提燈金黃色加算光暈 (Additive Blend)
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const warmGlow = ctx.createRadialGradient(screenPx, screenPy, 0, screenPx, screenPy, baseRadius * 0.8);
    warmGlow.addColorStop(0, "rgba(255, 215, 120, 0.35)");
    warmGlow.addColorStop(0.5, "rgba(255, 170, 70, 0.15)");
    warmGlow.addColorStop(1, "rgba(255, 150, 50, 0)");
    ctx.fillStyle = warmGlow;
    ctx.beginPath();
    ctx.arc(screenPx, screenPy, baseRadius * 0.8, 0, 6.28);
    ctx.fill();
    ctx.restore();
  }

  // 繪製彈跳浮動傷害文字
  function drawDamageNumbers() {
    ctx.save();
    for (const d of dmgNumbers) {
      const sx = d.x - camX, sy = d.y - camY;
      const alpha = clamp(d.life / 0.3, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.textAlign = "center";
      ctx.font = `900 ${Math.round(20 * d.scale)}px 'Zen Maru Gothic', sans-serif`;

      // 描邊
      ctx.strokeStyle = "#1a162b";
      ctx.lineWidth = 4;
      ctx.strokeText(d.val, sx, sy);

      // 字體填充
      ctx.fillStyle = d.color;
      ctx.fillText(d.val, sx, sy);
    }
    ctx.restore();
  }

  // 繪製斬擊弧 (和風墨水金光斬)
  function drawSlashArcs() {
    ctx.save();
    for (const s of slashArcs) {
      const alpha = s.life / s.maxLife;
      const sx = s.x - camX, sy = s.y - camY;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(s.angle);

      // 弧形金色流光
      ctx.strokeStyle = `rgba(255, 230, 130, ${alpha * 0.9})`;
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.arc(0, 0, s.radius, -s.spread / 2, s.spread / 2);
      ctx.stroke();

      // 核心高亮白光
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  // 繪製櫻花與大氣霧
  function drawAtmosphere(elapsed) {
    ctx.save();
    // 櫻花雨
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
      ctx.fillStyle = `rgba(180, 255, 220, ${pulse * 0.7})`;
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
