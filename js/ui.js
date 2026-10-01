// 使用者介面（UI）：商業級全螢幕懸浮式 HUD、HoloCure 風格武器圖標槽、純視覺化無文字冗餘
window.UI = (() => {
  const W = 900, H = 600;

  // 繪製日式黑漆金箔懸浮圓角框
  function glassBox(ctx, x, y, w, h, r = 10, fill = "rgba(14, 18, 30, 0.82)", stroke = "rgba(212, 175, 55, 0.55)", strokeW = 1.5) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = strokeW;
      ctx.stroke();
    }
    ctx.restore();
  }

  // 1. 主選單 (Title / Cover Screen)
  function drawMainMenu(ctx, STORE, elapsed) {
    ctx.save();
    if (window.ART?.cover) {
      const zoom = 1.0 + Math.sin(elapsed * 0.8) * 0.02;
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.scale(zoom, zoom);
      ctx.drawImage(window.ART.cover, -W / 2, -H / 2, W, H);
      ctx.restore();
    } else {
      ctx.fillStyle = "#0c1024";
      ctx.fillRect(0, 0, W, H);
    }

    const vig = ctx.createLinearGradient(0, 0, 0, H);
    vig.addColorStop(0, "rgba(6, 9, 20, 0.45)");
    vig.addColorStop(0.65, "rgba(6, 9, 20, 0.65)");
    vig.addColorStop(1, "rgba(6, 9, 20, 0.96)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = "center";
    ctx.fillStyle = "#ffe28b";
    ctx.font = "900 24px 'Kaisei Decol', 'Noto Sans JP', serif";
    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.shadowBlur = 12;
    ctx.fillText("百 鬼 橫 行 之 夜 ・ 單 字 配 達 物 語", W / 2, 440);
    ctx.shadowBlur = 0;

    const blink = 0.65 + 0.35 * Math.sin(elapsed * 5);
    ctx.fillStyle = `rgba(255, 230, 150, ${blink})`;
    ctx.font = "900 25px 'Kaisei Decol', 'Noto Sans JP', serif";
    ctx.fillText("— 點 擊 任 意 處 或 按 ENTER 開 始 夜 行 —", W / 2, 510);

    ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
    ctx.font = "bold 13px 'Noto Sans JP', sans-serif";
    ctx.fillText(`夜 行 紀 錄 ： 最 高 得 分 ${STORE.data.best || 0} 點　｜　最 高 配 達 ${STORE.data.bestDel || 0} 件`, W / 2, 565);

    glassBox(ctx, W - 165, 22, 145, 38, 8, "rgba(24, 30, 52, 0.9)", "#e3b35d", 2);
    ctx.fillStyle = "#ffeed4";
    ctx.font = "900 14px 'Zen Maru Gothic', sans-serif";
    ctx.fillText("百鬼單字卷 [C]", W - 92, 46);

    ctx.restore();
  }

  // 2. 全螢幕專業無分割 HUD（懸浮微型儀表 + 底部 HoloCure 風格武器格）
  function drawHud(ctx, P, oil, maxOil, elapsed, dawnTime, delivered, failed, score, level, xp, xpNeed, job, hintT, orders, inter, bossQ, touch, joy, btnE, btnD, btnPause, WL, WI, b) {
    ctx.save();

    // 注意：完全移除頂部深色橫條！遊戲世界 100% 全螢幕通透顯示！

    // --- 左上角：玩家生存與成長懸浮艙 (燈油即生命 + 經驗值條) ---
    const pBoxX = 18, pBoxY = 14, pBoxW = 215, pBoxH = 52;
    glassBox(ctx, pBoxX, pBoxY, pBoxW, pBoxH, 10);

    // 1. 提燈油量條（生命條：油盡燈枯即陣亡）
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffb03a";
    ctx.font = "900 13px 'Zen Maru Gothic', sans-serif";
    ctx.fillText("燈油", pBoxX + 6, pBoxY + 20);

    const oilBarW = 102, oilBarH = 10;
    ctx.fillStyle = "#1c1814";
    ctx.beginPath();
    ctx.roundRect(pBoxX + 34, pBoxY + 11, oilBarW, oilBarH, 4);
    ctx.fill();

    const curMaxOil = maxOil || 100;
    const oilRatio = Math.max(0, Math.min(1, oil / curMaxOil));
    const oilGrad = ctx.createLinearGradient(pBoxX + 34, 0, pBoxX + 34 + oilBarW, 0);
    if (oil < 25) {
      oilGrad.addColorStop(0, "#ff3838");
      oilGrad.addColorStop(1, "#ff7943");
    } else {
      oilGrad.addColorStop(0, "#ff9d26");
      oilGrad.addColorStop(1, "#ffd554");
    }
    if (oilRatio > 0) {
      ctx.fillStyle = oilGrad;
      ctx.beginPath();
      ctx.roundRect(pBoxX + 34, pBoxY + 11, oilBarW * oilRatio, oilBarH, 4);
      ctx.fill();
    }
    ctx.fillStyle = "#ffeed4";
    ctx.font = "900 12px 'Zen Maru Gothic', sans-serif";
    ctx.fillText(`${Math.ceil(oil)}/${curMaxOil}`, pBoxX + 142, pBoxY + 20);

    // 2. 經驗值條 (滿了即升級)
    ctx.font = "900 12px 'Zen Maru Gothic', sans-serif";
    ctx.fillStyle = "#40c4ff";
    ctx.fillText(`Lv.${level}`, pBoxX + 6, pBoxY + 42);

    const xpBarW = 96, xpBarH = 9;
    ctx.fillStyle = "#151b27";
    ctx.beginPath();
    ctx.roundRect(pBoxX + 44, pBoxY + 33, xpBarW, xpBarH, 4);
    ctx.fill();
    const xpRatio = Math.min(1, xp / xpNeed);
    if (xpRatio > 0) {
      ctx.fillStyle = "#40c4ff";
      ctx.beginPath();
      ctx.roundRect(pBoxX + 44, pBoxY + 33, xpBarW * xpRatio, xpBarH, 4);
      ctx.fill();
    }
    ctx.fillStyle = "#c5eeff";
    ctx.font = "bold 11px sans-serif";
    ctx.fillText(`${xp}/${xpNeed}`, pBoxX + 147, pBoxY + 42);

    // 3. 金剛結界護盾膠囊（位於生命欄正下方，整潔且絕不遮擋中央委託提示）
    if (b.shield && b.shield > 0) {
      const shX = pBoxX, shY = pBoxY + pBoxH + 6;
      glassBox(ctx, shX, shY, 96, 26, 6, "rgba(36, 30, 14, 0.94)", "#ffd54f", 1.5);
      ctx.textAlign = "center";
      ctx.font = "900 12px 'Zen Maru Gothic', sans-serif";
      ctx.fillStyle = "#ffe28b";
      ctx.fillText(`✦ 結界護盾 x${b.shield}`, shX + 48, shY + 18);
    }

    // --- 右上角：進度與統計懸浮艙 (Dawn, Deliveries & Score) ---
    const sBoxW = 205, sBoxH = 52;
    const sBoxX = W - sBoxW - 62, sBoxY = 14;
    glassBox(ctx, sBoxX, sBoxY, sBoxW, sBoxH, 10);

    // 黎明天盤進度
    const dawnProgress = Math.min(1, elapsed / dawnTime);
    ctx.textAlign = "left";
    // 弦月徽記
    ctx.fillStyle = "#ffd54f";
    ctx.beginPath();
    ctx.arc(sBoxX + 16, sBoxY + 16, 7, 0.5, 4.2);
    ctx.arc(sBoxX + 19, sBoxY + 16, 6, 4.0, 0.7, true);
    ctx.fill();

    const miniDawnW = 120, miniDawnH = 7;
    ctx.fillStyle = "#222a3d";
    ctx.beginPath();
    ctx.roundRect(sBoxX + 32, sBoxY + 12, miniDawnW, miniDawnH, 3.5);
    ctx.fill();
    ctx.fillStyle = "#ffa726";
    ctx.beginPath();
    ctx.roundRect(sBoxX + 32, sBoxY + 12, miniDawnW * dawnProgress, miniDawnH, 3.5);
    ctx.fill();

    const dawnSecLeft = Math.max(0, Math.ceil(dawnTime - elapsed));
    const dawnMin = Math.floor(dawnSecLeft / 60);
    const dawnSec = dawnSecLeft % 60;
    ctx.fillStyle = "#ffeed4";
    ctx.font = "bold 11px sans-serif";
    ctx.fillText(`${dawnMin}:${dawnSec < 10 ? '0' : ''}${dawnSec}`, sBoxX + 160, sBoxY + 20);

    // 配達與得分
    ctx.fillStyle = "#ffeed4";
    ctx.font = "900 13px 'Noto Sans JP', sans-serif";
    ctx.fillText(`配達 ${delivered}  |  功績 ${score}`, sBoxX + 12, sBoxY + 42);

    // 快捷小標
    ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
    ctx.font = "11px sans-serif";
    ctx.fillText("H提示 M靜音", sBoxX + 125, sBoxY + 42);

    // --- 右上角暫停按鈕 (btnPause) ---
    glassBox(ctx, btnPause.x, btnPause.y, btnPause.w, btnPause.h, 10, "rgba(20, 26, 44, 0.92)", "#d4af37", 1.8);
    const pcx = btnPause.x + btnPause.w / 2, pcy = btnPause.y + btnPause.h / 2;
    ctx.fillStyle = "#ffd54f";
    ctx.fillRect(pcx - 6, pcy - 8, 4, 16);
    ctx.fillRect(pcx + 2, pcy - 8, 4, 16);

    // --- 中央：進行中任務精緻金標（無任務時不擋視野，絕不洩漏地面答案） ---
    if (job) {
      const jBoxW = 320, jBoxH = 36;
      const jBoxX = W / 2 - jBoxW / 2, jBoxY = 14;
      glassBox(ctx, jBoxX, jBoxY, jBoxW, jBoxH, 8, "rgba(20, 16, 30, 0.92)", "#d4af37", 1.6);
      ctx.textAlign = "center";
      ctx.font = "900 14px 'Zen Maru Gothic', sans-serif";
      ctx.fillStyle = "#ffe699";

      const targetText = job.to.word.jp;
      const itemText = job.rev ? job.word.zh : job.word.jp;
      const hintStr = hintT > 0 ? ` (${job.rev ? job.word.jp : job.word.zh})` : "";

      ctx.fillText(`送往町屋「${targetText}」：【 ${itemText} 】${hintStr}`, W / 2, jBoxY + 23);
    }

    // --- 左下角：HoloCure 風格【主動秘術 4 槽位 + 被動體質欄】 ---
    const ownedKeys = WI ? Object.keys(WI).filter(k => (WL[k] || 0) > 0) : [];
    const maxActiveSlots = 4;
    const slotStartX = 18, slotY = H - 54;
    const slotSize = 40, slotGap = 8;

    for (let i = 0; i < maxActiveSlots; i++) {
      const sx = slotStartX + i * (slotSize + slotGap);
      const k = ownedKeys[i];
      if (k) {
        // 主動技能格：繪製精緻微型和風家紋勳章 (r = 17)
        drawEmblem(ctx, k, sx + slotSize / 2, slotY + slotSize / 2, 17);
        // 右下角等級徽章
        const lvl = WL[k];
        ctx.fillStyle = "#d4af37";
        ctx.beginPath();
        ctx.roundRect(sx + slotSize - 20, slotY + slotSize - 13, 20, 13, 3);
        ctx.fill();
        ctx.fillStyle = "#161022";
        ctx.textAlign = "center";
        ctx.font = "900 9px sans-serif";
        ctx.fillText(lvl >= 5 ? "MAX" : `L${lvl}`, sx + slotSize - 10, slotY + slotSize - 3);
      } else {
        // 未解鎖空槽位：虛線框
        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = "rgba(180, 195, 220, 0.35)";
        ctx.lineWidth = 1.5;
        ctx.fillStyle = "rgba(12, 15, 24, 0.45)";
        ctx.beginPath();
        ctx.roundRect(sx, slotY, slotSize, slotSize, 8);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "rgba(180, 195, 220, 0.35)";
        ctx.textAlign = "center";
        ctx.font = "bold 13px sans-serif";
        ctx.fillText("＋", sx + slotSize / 2, slotY + slotSize / 2 + 5);
        ctx.restore();
      }
    }

    // 被動體質欄 (護盾, 增傷, 攻速, 暴擊, 移速, 衝刺, 燈油, 磁鐵)
    const passives = [
      { id: "shield", lvl: b.shield || 0, active: (b.shield || 0) > 0 },
      { id: "dmg", lvl: Math.round(((b.dmg || 1.2) - 1.2) / 0.35), active: (b.dmg || 1.2) > 1.25 },
      { id: "rate", lvl: b.rate || 0, active: (b.rate || 0) > 0 },
      { id: "crit", lvl: b.crit || 0, active: (b.crit || 0) > 0 },
      { id: "spd", lvl: b.spd || 0, active: (b.spd || 0) > 0 },
      { id: "dash", lvl: b.dash || 0, active: (b.dash || 0) > 0 },
      { id: "oil_max", lvl: Math.max(0, Math.round(((maxOil || 100) - 100) / 30)), active: (maxOil || 100) > 100 },
      { id: "mag", lvl: b.mag || 0, active: (b.mag || 0) > 0 }
    ].filter(p => p.active);

    passives.forEach((pas, pIdx) => {
      const px = slotStartX + 200 + pIdx * 34;
      if (px < W - 180) {
        drawEmblem(ctx, pas.id, px + 14, slotY + 20, 14);
        if (pas.lvl > 1) {
          ctx.fillStyle = "#ffd54f";
          ctx.beginPath();
          ctx.roundRect(px + 14, slotY + 20, 14, 11, 3);
          ctx.fill();
          ctx.fillStyle = "#161022";
          ctx.textAlign = "center";
          ctx.font = "900 8px sans-serif";
          ctx.fillText(`+${pas.lvl}`, px + 21, slotY + 28);
        }
      }
    });

    // 觸控虛擬按鈕
    if (touch) {
      ctx.save();
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      ctx.beginPath();
      ctx.arc(btnD.x, btnD.y, btnD.r, 0, 6.28);
      ctx.fill();
      ctx.textAlign = "center";
      ctx.fillStyle = "#1e2436";
      ctx.font = "900 16px 'Zen Maru Gothic', sans-serif";
      ctx.fillText("衝刺", btnD.x, btnD.y + 6);

      if (inter) {
        ctx.fillStyle = "rgba(255, 210, 80, 0.85)";
        ctx.beginPath();
        ctx.arc(btnE.x, btnE.y, btnE.r, 0, 6.28);
        ctx.fill();
        ctx.fillStyle = "#1e2436";
        ctx.fillText("取貨", btnE.x, btnE.y + 6);
      }

      if (joy) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
        ctx.beginPath();
        ctx.arc(joy.x, joy.y, 60, 0, 6.28);
        ctx.fill();
        ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
        ctx.beginPath();
        ctx.arc(joy.x + joy.dx * 60, joy.y + joy.dy * 60, 26, 0, 6.28);
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.restore();
  }

  // 繪製日式和風紋章勳章（Kamon Emblems - 商業級金屬鍍金家紋）
  function drawEmblem(ctx, id, cx, cy, r) {
    ctx.save();
    ctx.translate(cx, cy);

    // 1. 雙層金箔金屬框與外圈陰影
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.65)";
    ctx.shadowBlur = r * 0.28;
    ctx.shadowOffsetY = r * 0.1;

    const goldGrad = ctx.createLinearGradient(-r, -r, r, r);
    goldGrad.addColorStop(0, "#fff1a8");
    goldGrad.addColorStop(0.28, "#d4af37");
    goldGrad.addColorStop(0.72, "#856417");
    goldGrad.addColorStop(1, "#f5dc7a");

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, 6.283);
    ctx.fillStyle = goldGrad;
    ctx.fill();
    ctx.restore();

    // 四方菊花金釘 (Cardinal studs)
    const studR = Math.max(1.5, r * 0.08);
    const studDist = r * 0.91;
    ctx.fillStyle = "#fff8d1";
    for (let i = 0; i < 4; i++) {
      const sa = (i * Math.PI) / 2;
      ctx.beginPath();
      ctx.arc(Math.cos(sa) * studDist, Math.sin(sa) * studDist, studR, 0, 6.283);
      ctx.fill();
    }

    // 2. 內凹深色金屬襯圈
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.86, 0, 6.283);
    ctx.fillStyle = "#0c0e18";
    ctx.fill();

    // 3. 元素專屬底色微光 (Elemental Core Gradient)
    const innerR = r * 0.82;
    const coreGrad = ctx.createRadialGradient(0, 0, innerR * 0.15, 0, 0, innerR);

    const PALETTE = {
      katana:   ["#d32f2f", "#4a0b12"], // 赤紅妖刀
      barrier:  ["#1976d2", "#072042"], // 蔚藍結界
      fire:     ["#f57c00", "#451602"], // 烈火狐炎
      boom:     ["#8e24aa", "#290638"], // 幽紫咒符
      thunder:  ["#fbc02d", "#3b2c02"], // 曜金雷光
      needle:   ["#00acc1", "#022e33"], // 蒼青靈針
      shield:   ["#ffa000", "#422500"], // 金剛護盾
      oil_max:  ["#e64a19", "#401305"], // 常夜燈火
      oil_heal: ["#388e3c", "#0a290f"], // 翡翠仙露
      dmg:      ["#b71c1c", "#3b0000"], // 修羅狂怒
      rate:     ["#c2185b", "#3d031c"], // 神樂舞踏
      crit:     ["#d81b60", "#3d0218"], // 心眼致命
      spd:      ["#00897b", "#022924"], // 風天神足
      dash:     ["#673ab7", "#1c0b3d"], // 縮地幻步
      mag:      ["#43a047", "#0d2b10"]  // 招財引靈
    };

    const [c1, c2] = PALETTE[id] || ["#37474f", "#12191d"];
    coreGrad.addColorStop(0, c1);
    coreGrad.addColorStop(1, c2);

    ctx.beginPath();
    ctx.arc(0, 0, innerR, 0, 6.283);
    ctx.fillStyle = coreGrad;
    ctx.fill();

    // 細金內線圈
    ctx.strokeStyle = "rgba(255, 235, 140, 0.45)";
    ctx.lineWidth = Math.max(1, r * 0.035);
    ctx.stroke();

    // 4. 精緻和風紋章幾何圖形繪製 (Specific Kamon Vector Geometry)
    const s = innerR * 0.85;
    ctx.save();

    switch (id) {
      case "katana": {
        // 太刀交錯新月斬紋
        ctx.strokeStyle = "#e0f7fa";
        ctx.lineWidth = Math.max(2, s * 0.12);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(-s * 0.6, s * 0.6);
        ctx.quadraticCurveTo(-s * 0.1, -s * 0.1, s * 0.65, -s * 0.55);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(s * 0.6, s * 0.6);
        ctx.quadraticCurveTo(s * 0.1, -s * 0.1, -s * 0.65, -s * 0.55);
        ctx.stroke();
        ctx.fillStyle = "#ffd54f";
        ctx.beginPath();
        ctx.ellipse(-s * 0.35, s * 0.35, s * 0.12, s * 0.06, Math.PI / 4, 0, 6.28);
        ctx.ellipse(s * 0.35, s * 0.35, s * 0.12, s * 0.06, -Math.PI / 4, 0, 6.28);
        ctx.fill();
        ctx.strokeStyle = "#ffe28b";
        ctx.lineWidth = Math.max(1.5, s * 0.08);
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.72, -0.6, 2.2);
        ctx.stroke();
        ctx.fillStyle = "#ffb2c9";
        ctx.beginPath();
        ctx.ellipse(0, -s * 0.45, s * 0.1, s * 0.16, 0.4, 0, 6.28);
        ctx.fill();
        break;
      }

      case "barrier": {
        // 神道三つ巴八咫八角陣
        ctx.strokeStyle = "rgba(255, 235, 140, 0.5)";
        ctx.lineWidth = Math.max(1, s * 0.05);
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * (s * 0.3), Math.sin(a) * (s * 0.3));
          ctx.lineTo(Math.cos(a) * (s * 0.88), Math.sin(a) * (s * 0.88));
          ctx.stroke();
        }
        ctx.strokeStyle = "#80d8ff";
        ctx.lineWidth = Math.max(1.5, s * 0.07);
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.75, 0, 6.28);
        ctx.stroke();
        for (let i = 0; i < 3; i++) {
          ctx.save();
          ctx.rotate((i * 2 * Math.PI) / 3);
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(0, -s * 0.28, s * 0.22, 0, 6.28);
          ctx.fill();
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = s * 0.22;
          ctx.beginPath();
          ctx.arc(0, 0, s * 0.28, -Math.PI / 2, 0.2);
          ctx.stroke();
          ctx.fillStyle = "#0d2347";
          ctx.beginPath();
          ctx.arc(0, -s * 0.28, s * 0.08, 0, 6.28);
          ctx.fill();
          ctx.restore();
        }
        break;
      }

      case "fire": {
        // 靈火三尾旋輪紋
        for (let i = 0; i < 3; i++) {
          ctx.save();
          ctx.rotate((i * 2 * Math.PI) / 3);
          const fg = ctx.createLinearGradient(0, -s * 0.7, 0, 0);
          fg.addColorStop(0, "#ffe082");
          fg.addColorStop(0.5, "#ff7043");
          fg.addColorStop(1, "#d84315");
          ctx.fillStyle = fg;
          ctx.beginPath();
          ctx.moveTo(0, -s * 0.75);
          ctx.bezierCurveTo(s * 0.35, -s * 0.45, s * 0.3, 0, 0, s * 0.15);
          ctx.bezierCurveTo(-s * 0.15, 0, -s * 0.15, -s * 0.4, 0, -s * 0.75);
          ctx.fill();
          ctx.restore();
        }
        ctx.fillStyle = "#fffde7";
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.2, 0, 6.28);
        ctx.fill();
        break;
      }

      case "boom": {
        // 陰陽太極封魔符印
        ctx.save();
        ctx.rotate(-0.35);
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.6, -Math.PI / 2, Math.PI / 2);
        ctx.arc(0, s * 0.3, s * 0.3, Math.PI / 2, -Math.PI / 2, true);
        ctx.arc(0, -s * 0.3, s * 0.3, Math.PI / 2, -Math.PI / 2);
        ctx.fill();
        ctx.fillStyle = "#21102e";
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.6, Math.PI / 2, -Math.PI / 2);
        ctx.arc(0, -s * 0.3, s * 0.3, -Math.PI / 2, Math.PI / 2, true);
        ctx.arc(0, s * 0.3, s * 0.3, -Math.PI / 2, Math.PI / 2);
        ctx.fill();
        ctx.fillStyle = "#21102e";
        ctx.beginPath();
        ctx.arc(0, -s * 0.3, s * 0.1, 0, 6.28);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(0, s * 0.3, s * 0.1, 0, 6.28);
        ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.rotate(0.35);
        ctx.fillStyle = "#fff8e1";
        ctx.strokeStyle = "#ffd54f";
        ctx.lineWidth = Math.max(1, s * 0.05);
        ctx.beginPath();
        ctx.roundRect(-s * 0.22, -s * 0.5, s * 0.44, s * 0.95, 3);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = "#d32f2f";
        ctx.lineWidth = Math.max(1, s * 0.06);
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.35);
        ctx.lineTo(0, -s * 0.1);
        ctx.moveTo(-s * 0.12, -s * 0.25);
        ctx.lineTo(s * 0.12, -s * 0.25);
        ctx.moveTo(-s * 0.08, 0.05);
        ctx.lineTo(s * 0.08, 0.05);
        ctx.lineTo(0, s * 0.3);
        ctx.stroke();
        ctx.restore();
        break;
      }

      case "thunder": {
        // 雷神三鼓天雷紋
        ctx.strokeStyle = "#ffd54f";
        ctx.lineWidth = Math.max(1.5, s * 0.06);
        for (let i = 0; i < 3; i++) {
          const a = (i * 2 * Math.PI) / 3 - Math.PI / 2;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * (s * 0.55), Math.sin(a) * (s * 0.55), s * 0.22, 0, 6.28);
          ctx.stroke();
        }
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#ffeb3b";
        ctx.lineWidth = Math.max(2, s * 0.08);
        ctx.beginPath();
        ctx.moveTo(s * 0.2, -s * 0.7);
        ctx.lineTo(-s * 0.35, -s * 0.05);
        ctx.lineTo(0, -s * 0.05);
        ctx.lineTo(-s * 0.2, s * 0.7);
        ctx.lineTo(s * 0.35, 0.05);
        ctx.lineTo(0, 0.05);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }

      case "needle": {
        // 五芒穿雲千本紋 (5 發破魔靈針)
        for (let i = -2; i <= 2; i++) {
          ctx.save();
          ctx.rotate(i * 0.26);
          ctx.strokeStyle = "rgba(128, 222, 234, 0.6)";
          ctx.lineWidth = Math.max(1, s * 0.04);
          ctx.beginPath();
          ctx.moveTo(0, s * 0.4);
          ctx.lineTo(0, -s * 0.3);
          ctx.stroke();
          ctx.fillStyle = "#ffffff";
          ctx.strokeStyle = "#4dd0e1";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, -s * 0.75);
          ctx.lineTo(s * 0.06, -s * 0.1);
          ctx.lineTo(-s * 0.06, -s * 0.1);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
        break;
      }

      case "shield": {
        // 八咫鏡四ツ勾玉金剛紋
        for (let i = 0; i < 4; i++) {
          ctx.save();
          ctx.rotate((i * Math.PI) / 2);
          ctx.fillStyle = "#ffd54f";
          ctx.beginPath();
          ctx.arc(0, -s * 0.42, s * 0.18, 0, 6.28);
          ctx.fill();
          ctx.strokeStyle = "#ffd54f";
          ctx.lineWidth = s * 0.16;
          ctx.beginPath();
          ctx.arc(0, 0, s * 0.42, -Math.PI / 2, 0.1);
          ctx.stroke();
          ctx.restore();
        }
        ctx.fillStyle = "#fff8e1";
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.28);
        ctx.lineTo(s * 0.28, 0);
        ctx.lineTo(0, s * 0.28);
        ctx.lineTo(-s * 0.28, 0);
        ctx.closePath();
        ctx.fill();
        break;
      }

      case "oil_max": {
        // 常夜石燈籠紋
        ctx.fillStyle = "#ffd54f";
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.68);
        ctx.lineTo(s * 0.55, -s * 0.4);
        ctx.lineTo(-s * 0.55, -s * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#ffd54f";
        ctx.lineWidth = Math.max(1.5, s * 0.06);
        ctx.strokeRect(-s * 0.32, -s * 0.38, s * 0.64, s * 0.5);
        ctx.fillStyle = "#ffb300";
        ctx.beginPath();
        ctx.arc(0, -s * 0.13, s * 0.16, 0, 6.28);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(0, -s * 0.13, s * 0.08, 0, 6.28);
        ctx.fill();
        ctx.fillStyle = "#ffd54f";
        ctx.fillRect(-s * 0.4, s * 0.14, s * 0.8, s * 0.12);
        ctx.fillRect(-s * 0.2, s * 0.26, s * 0.4, s * 0.3);
        ctx.fillRect(-s * 0.48, s * 0.56, s * 0.96, s * 0.12);
        break;
      }

      case "oil_heal": {
        // 仙露御神瓢簞印
        ctx.fillStyle = "#a5d6a7";
        ctx.strokeStyle = "#ffd54f";
        ctx.lineWidth = Math.max(1.5, s * 0.06);
        ctx.beginPath();
        ctx.arc(0, -s * 0.22, s * 0.22, 0, 6.28);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, s * 0.22, s * 0.34, 0, 6.28);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#e53935";
        ctx.fillRect(-s * 0.18, -s * 0.04, s * 0.36, s * 0.08);
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(s * 0.1, -s * 0.25, s * 0.06, 0, 6.28);
        ctx.fill();
        break;
      }

      case "dmg": {
        // 鬼神修羅兜雙戟紋
        ctx.fillStyle = "#ffd54f";
        ctx.beginPath();
        ctx.moveTo(0, s * 0.1);
        ctx.quadraticCurveTo(-s * 0.35, -s * 0.3, -s * 0.65, -s * 0.68);
        ctx.quadraticCurveTo(-s * 0.2, -s * 0.5, 0, -s * 0.3);
        ctx.quadraticCurveTo(s * 0.2, -s * 0.5, s * 0.65, -s * 0.68);
        ctx.quadraticCurveTo(s * 0.35, -s * 0.3, 0, s * 0.1);
        ctx.fill();
        ctx.fillStyle = "#ff1744";
        ctx.fillRect(-s * 0.3, s * 0.15, s * 0.6, s * 0.15);
        ctx.fillStyle = "#ffd54f";
        ctx.beginPath();
        ctx.arc(-s * 0.14, s * 0.22, s * 0.05, 0, 6.28);
        ctx.arc(s * 0.14, s * 0.22, s * 0.05, 0, 6.28);
        ctx.fill();
        ctx.strokeStyle = "#e0e0e0";
        ctx.lineWidth = Math.max(1.5, s * 0.07);
        ctx.beginPath();
        ctx.moveTo(-s * 0.55, s * 0.65);
        ctx.lineTo(s * 0.55, -s * 0.45);
        ctx.moveTo(s * 0.55, s * 0.65);
        ctx.lineTo(-s * 0.55, -s * 0.45);
        ctx.stroke();
        break;
      }

      case "rate": {
        // 神樂三鈴飛絹紋
        const bPos = [
          { x: 0, y: -s * 0.35 },
          { x: -s * 0.32, y: s * 0.18 },
          { x: s * 0.32, y: s * 0.18 }
        ];
        bPos.forEach(p => {
          ctx.fillStyle = "#ffd54f";
          ctx.strokeStyle = "#fff9c4";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(p.x, p.y, s * 0.2, 0, 6.28);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "#261502";
          ctx.beginPath();
          ctx.arc(p.x, p.y + s * 0.08, s * 0.07, 0, 6.28);
          ctx.fill();
        });
        ctx.strokeStyle = "rgba(255, 235, 140, 0.5)";
        ctx.lineWidth = Math.max(1, s * 0.05);
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.72, 0, 6.28);
        ctx.stroke();
        break;
      }

      case "crit": {
        // 天狐心眼破空十字閃
        ctx.fillStyle = "#fff8e1";
        ctx.beginPath();
        ctx.moveTo(-s * 0.65, 0);
        ctx.quadraticCurveTo(0, -s * 0.45, s * 0.65, 0);
        ctx.quadraticCurveTo(0, s * 0.45, -s * 0.65, 0);
        ctx.fill();
        ctx.fillStyle = "#d50000";
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.26, 0, 6.28);
        ctx.fill();
        ctx.fillStyle = "#ffd54f";
        ctx.beginPath();
        ctx.ellipse(0, 0, s * 0.06, s * 0.24, 0, 0, 6.28);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = Math.max(1.5, s * 0.06);
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.7);
        ctx.lineTo(0, s * 0.7);
        ctx.moveTo(-s * 0.7, 0);
        ctx.lineTo(s * 0.7, 0);
        ctx.stroke();
        break;
      }

      case "spd": {
        // 風天飛雲草履輪紋
        ctx.strokeStyle = "#80cbc4";
        ctx.lineWidth = Math.max(1.5, s * 0.08);
        ctx.beginPath();
        ctx.arc(-s * 0.25, 0, s * 0.35, -Math.PI / 2, Math.PI / 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(s * 0.25, 0, s * 0.35, Math.PI / 2, -Math.PI / 2);
        ctx.stroke();
        ctx.fillStyle = "#fff9c4";
        ctx.strokeStyle = "#004d40";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(0, 0, s * 0.18, s * 0.48, -0.4, 0, 6.28);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = "#e53935";
        ctx.lineWidth = Math.max(1, s * 0.06);
        ctx.beginPath();
        ctx.moveTo(-s * 0.1, -s * 0.1);
        ctx.lineTo(0, -s * 0.25);
        ctx.lineTo(s * 0.1, -s * 0.1);
        ctx.stroke();
        break;
      }

      case "dash": {
        // 斷空紫電瞬閃印
        ctx.strokeStyle = "#e1bee7";
        ctx.lineWidth = Math.max(2, s * 0.1);
        ctx.beginPath();
        ctx.moveTo(-s * 0.65, s * 0.45);
        ctx.lineTo(s * 0.55, -s * 0.55);
        ctx.moveTo(-s * 0.45, s * 0.65);
        ctx.lineTo(s * 0.65, -s * 0.35);
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        for (let i = 0; i < 3; i++) {
          const px = (i - 1) * s * 0.35;
          const py = (1 - i) * s * 0.35;
          ctx.beginPath();
          ctx.arc(px, py, s * 0.09, 0, 6.28);
          ctx.fill();
        }
        break;
      }

      case "mag": {
        // 雙生翡翠引靈陣
        for (let i = 0; i < 2; i++) {
          ctx.save();
          ctx.rotate(i * Math.PI);
          ctx.fillStyle = "#a5d6a7";
          ctx.beginPath();
          ctx.arc(0, -s * 0.32, s * 0.26, 0, 6.28);
          ctx.fill();
          ctx.strokeStyle = "#a5d6a7";
          ctx.lineWidth = s * 0.24;
          ctx.beginPath();
          ctx.arc(0, 0, s * 0.32, -Math.PI / 2, 0.4);
          ctx.stroke();
          ctx.fillStyle = "#1b5e20";
          ctx.beginPath();
          ctx.arc(0, -s * 0.32, s * 0.08, 0, 6.28);
          ctx.fill();
          ctx.restore();
        }
        break;
      }

      default: {
        ctx.strokeStyle = "#ffd54f";
        ctx.lineWidth = Math.max(1, s * 0.06);
        for (let i = 0; i < 8; i++) {
          ctx.save();
          ctx.rotate((i * Math.PI) / 4);
          ctx.beginPath();
          ctx.ellipse(0, -s * 0.45, s * 0.12, s * 0.28, 0, 0, 6.28);
          ctx.stroke();
          ctx.restore();
        }
        ctx.fillStyle = "#ffd54f";
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.18, 0, 6.28);
        ctx.fill();
        break;
      }
    }

    ctx.restore();
    ctx.restore();
  }

  // 3. 升級選卡視窗（HoloCure 風格 3D 浮雕金箔卡牌 + 家紋徽章 + 4 槽位限制視覺化）
  function drawLevelUp(ctx, level, choices, WL, WI) {
    ctx.save();
    ctx.fillStyle = "rgba(6, 9, 18, 0.94)";
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = "center";
    ctx.font = "900 32px 'Kaisei Decol', 'Noto Sans JP', serif";
    ctx.fillStyle = "#ffe28b";
    ctx.shadowColor = "rgba(255, 215, 100, 0.7)";
    ctx.shadowBlur = 14;
    ctx.fillText(`— 秘術覺醒・等級提升 Lv.${level} —`, W / 2, 64);
    ctx.shadowBlur = 0;

    // --- 頂部：主動秘術槽位進度欄 (4 槽位限制) ---
    const ownedKeys = WI ? Object.keys(WI).filter(k => (WL[k] || 0) > 0) : [];
    const maxSlots = 4;
    const barW = 560, barH = 46;
    const barX = W / 2 - barW / 2, barY = 82;

    glassBox(ctx, barX, barY, barW, barH, 10, "rgba(18, 24, 40, 0.9)", "#d4af37", 1.5);

    ctx.textAlign = "left";
    ctx.font = "900 14px 'Zen Maru Gothic', sans-serif";
    ctx.fillStyle = "#ffe89e";
    ctx.fillText(`主動秘術 (${ownedKeys.length}/${maxSlots})：`, barX + 16, barY + 28);

    // 4 個槽位小方格
    const slotStartX = barX + 165;
    for (let s = 0; s < maxSlots; s++) {
      const sx = slotStartX + s * 95;
      const k = ownedKeys[s];
      if (k) {
        glassBox(ctx, sx, barY + 6, 88, 34, 6, "rgba(26, 36, 62, 0.9)", "#d4af37", 1.2);
        drawEmblem(ctx, k, sx + 18, barY + 23, 14);
        ctx.fillStyle = "#ffeed4";
        ctx.font = "900 12px 'Noto Sans JP', sans-serif";
        ctx.fillText(`Lv.${WL[k]}`, sx + 38, barY + 27);
      } else {
        ctx.save();
        ctx.setLineDash([3, 3]);
        glassBox(ctx, sx, barY + 6, 88, 34, 6, "rgba(10, 14, 24, 0.5)", "rgba(180, 195, 220, 0.35)", 1);
        ctx.fillStyle = "rgba(180, 195, 220, 0.4)";
        ctx.font = "bold 11px sans-serif";
        ctx.fillText("＋ 空槽", sx + 22, barY + 27);
        ctx.restore();
      }
    }

    ctx.textAlign = "center";
    ctx.font = "bold 13px 'Zen Maru Gothic', sans-serif";
    ctx.fillStyle = "#a8bedd";
    if (ownedKeys.length >= maxSlots) {
      ctx.fillText("※ 秘術槽位已滿（4/4）！僅能精進既有秘術等級 或 修煉被動流派體質", W / 2, 150);
    } else {
      ctx.fillText("※ 尚可修煉全新秘術！請依攻擊爆發、防禦生存或神速等流派策略搭配", W / 2, 150);
    }

    // --- 3 張浮雕卡牌 ---
    const cardW = 248, cardH = 385;
    const startX = 60, gap = 44;
    const cy = 170;

    choices.forEach((c, i) => {
      const cx = startX + i * (cardW + gap);

      // 卡牌底層立體黑影
      ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
      ctx.beginPath();
      ctx.roundRect(cx + 6, cy + 8, cardW, cardH, 16);
      ctx.fill();

      // 卡牌主體漸層底板
      const cardGrad = ctx.createLinearGradient(cx, cy, cx + cardW, cy + cardH);
      cardGrad.addColorStop(0, "#222a42");
      cardGrad.addColorStop(0.45, "#141a2b");
      cardGrad.addColorStop(1, "#0d101d");

      glassBox(ctx, cx, cy, cardW, cardH, 16, cardGrad, "#d4af37", 2.5);

      // 1. 頂部流派類別標籤膠囊 (精簡無冗餘)
      const isWeapon = c.type === "weapon";
      const catColor = isWeapon ? (c.id === "barrier" ? "#1976d2" : (c.id === "katana" ? "#c62828" : "#8e24aa")) : "#00897b";
      glassBox(ctx, cx + 24, cy + 14, cardW - 48, 26, 6, "rgba(10, 14, 24, 0.85)", catColor, 1.5);
      ctx.fillStyle = "#ffeed4";
      ctx.font = "900 12px 'Zen Maru Gothic', sans-serif";
      ctx.fillText(c.cat || "【 秘術 】", cx + cardW / 2, cy + 31);

      // 2. 日文副標與秘術主名
      ctx.font = "bold 13px 'Noto Sans JP', serif";
      ctx.fillStyle = "#ffd54f";
      ctx.fillText(c.s ? `— ${c.s} —` : "— 秘術 —", cx + cardW / 2, cy + 56);

      ctx.font = "900 23px 'Kaisei Decol', 'Noto Sans JP', serif";
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "rgba(0,0,0,0.8)";
      ctx.shadowBlur = 6;
      ctx.fillText(c.n, cx + cardW / 2, cy + 84);
      ctx.shadowBlur = 0;

      // 3. 中央大型帥氣紋章勳章 (r = 44px, 直徑 88px)
      drawEmblem(ctx, c.id, cx + cardW / 2, cy + 155, 44);

      // 4. 等級進階標籤膠囊 (精簡標註)
      const isNew = c.levelText && (c.levelText.includes("新") || c.levelText.includes("NEW"));
      glassBox(ctx, cx + 36, cy + 214, cardW - 72, 24, 6, isNew ? "rgba(212, 175, 55, 0.25)" : "rgba(33, 150, 243, 0.2)", isNew ? "#ffd54f" : "#64b5f6", 1.2);
      ctx.fillStyle = isNew ? "#ffe082" : "#90caf9";
      ctx.font = "900 12px 'Zen Maru Gothic', sans-serif";
      ctx.fillText(c.levelText || "◆ 妖力精進", cx + cardW / 2, cy + 230);

      // 5. 效果詳解說明框
      glassBox(ctx, cx + 14, cy + 246, cardW - 28, 74, 8, "rgba(10, 14, 24, 0.65)", null);
      ctx.font = "bold 13px 'Noto Sans JP', sans-serif";
      const words = c.d || "";
      let line1 = words, line2 = "";
      if (words.length > 13) {
        const puncIdx = words.search(/[，、\s]/);
        if (puncIdx >= 6 && puncIdx <= 16) {
          line1 = words.slice(0, puncIdx);
          line2 = words.slice(puncIdx + 1);
        } else {
          line1 = words.slice(0, 13);
          line2 = words.slice(13);
        }
      }
      if (line2) {
        ctx.fillText(line1, cx + cardW / 2, cy + 273);
        ctx.fillText(line2, cx + cardW / 2, cy + 297);
      } else {
        ctx.fillText(line1, cx + cardW / 2, cy + 285);
      }

      // 6. 底部熱鍵選擇按鈕
      glassBox(ctx, cx + cardW / 2 - 42, cy + cardH - 52, 84, 38, 10, "#d4af37", "#ffffff", 1.8);
      ctx.fillStyle = "#1a162b";
      ctx.font = "900 17px 'Zen Maru Gothic', sans-serif";
      ctx.fillText(`[ ${i + 1} 選擇 ]`, cx + cardW / 2, cy + cardH - 27);
    });

    ctx.restore();
  }

  // 4. Boss 破防答題介面
  function drawBossQuiz(ctx, bossQ) {
    if (!bossQ) return;
    ctx.save();
    const boxW = 690, boxH = 105;
    const bx = (W - boxW) / 2, by = H - 128;

    glassBox(ctx, bx, by, boxW, boxH, 16, "rgba(20, 14, 34, 0.98)", "#ff5470", 2.5);

    ctx.textAlign = "center";
    ctx.font = "900 19px 'Kaisei Decol', 'Noto Sans JP', serif";
    ctx.fillStyle = "#ffeed4";
    ctx.fillText(`🛡【大妖鬼結界】：${bossQ.word.icon} 的日文名是？（按 1 / 2 / 3 或點選破防）`, W / 2, by + 30);

    const optW = 200, optH = 46;
    bossQ.ans.forEach((w, i) => {
      const ox = bx + 22 + i * (optW + 24);
      const oy = by + 46;
      glassBox(ctx, ox, oy, optW, optH, 10, bossQ.lock > 0 ? "#333c57" : "#ffeed4", "#d4af37", 2);
      ctx.fillStyle = "#1e1829";
      ctx.font = "900 18px 'Zen Maru Gothic', sans-serif";
      ctx.fillText(`${i + 1}. ${w.jp}`, ox + optW / 2, oy + 29);
    });

    ctx.restore();
  }

  // 5. 單字圖鑑 (Codex)
  function drawCodex(ctx, STORE, ALL) {
    ctx.save();
    ctx.fillStyle = "rgba(10, 14, 26, 0.96)";
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = "center";
    ctx.font = "900 32px 'Kaisei Decol', 'Noto Sans JP', serif";
    ctx.fillStyle = "#ffe28b";
    ctx.fillText("— 妖怪單字繪卷 (Codex) —", W / 2, 58);

    ctx.font = "bold 14px 'Noto Sans JP', sans-serif";
    ctx.fillStyle = "#cad7f5";
    ctx.fillText("★ = 熟練度：答對升星、答錯歸零。越不熟的單字，夜行委託越常出現。（按 C 或 點擊返回）", W / 2, 86);

    let mastered = 0;
    const cardW = 86, cardH = 112;
    const startX = 46, startY = 115;

    ALL.forEach((w, i) => {
      const col = i % 9;
      const row = (i / 9) | 0;
      const cx = startX + col * 95;
      const cy = startY + row * 124;

      const m = STORE.get(w.jp);
      const seen = (m.ok + m.ng) > 0;
      if (m.box >= 4) mastered++;

      glassBox(ctx, cx, cy, cardW, cardH, 10, seen ? "#fcf4e3" : "#20273a", seen ? "#d4af37" : "#36415a", 1.5);

      ctx.fillStyle = "#1e1829";
      ctx.font = "26px sans-serif";
      ctx.fillText(seen ? w.icon : "？", cx + cardW / 2, cy + 36);

      ctx.font = "900 14px 'Zen Maru Gothic', sans-serif";
      ctx.fillText(seen ? w.jp : "？？", cx + cardW / 2, cy + 62);

      if (seen) {
        ctx.font = "bold 12px 'Noto Sans JP', sans-serif";
        ctx.fillStyle = "#63503c";
        ctx.fillText(w.zh, cx + cardW / 2, cy + 82);

        ctx.fillStyle = "#d48819";
        ctx.font = "12px sans-serif";
        ctx.fillText("★".repeat(m.box) + "☆".repeat(4 - m.box), cx + cardW / 2, cy + 101);
      }
    });

    ctx.font = "900 18px 'Zen Maru Gothic', sans-serif";
    ctx.fillStyle = "#ffe28b";
    ctx.fillText(`已精通詞彙：${mastered} / ${ALL.length} 語`, W / 2, 545);

    glassBox(ctx, W / 2 - 80, 560, 160, 32, 8, "#d4af37", "#ffffff", 1.5);
    ctx.fillStyle = "#1a162b";
    ctx.font = "900 15px 'Noto Sans JP', sans-serif";
    ctx.fillText("返回主選單", W / 2, 582);

    ctx.restore();
  }

  // 6. 結算畫面 (日式神壇金箔額匾・和風繪馬・大作質感)
  function drawEndScreen(ctx, state, score, delivered, failed, misses) {
    ctx.save();
    const isWon = state === "won";

    // 1. 全螢幕電影感氛圍幕
    ctx.fillStyle = "rgba(6, 8, 16, 0.94)";
    ctx.fillRect(0, 0, W, H);

    // 2. 獲勝時的黎明破曉天光輻射 / 失敗時的深淵幽冥暗火
    if (isWon) {
      // 黎明暖金曙光自背後放射
      const dawnGrad = ctx.createRadialGradient(W / 2, 280, 40, W / 2, 280, 520);
      dawnGrad.addColorStop(0, "rgba(255, 220, 110, 0.32)");
      dawnGrad.addColorStop(0.4, "rgba(255, 140, 60, 0.15)");
      dawnGrad.addColorStop(0.8, "rgba(80, 60, 140, 0.08)");
      dawnGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = dawnGrad;
      ctx.fillRect(0, 0, W, H);

      // 曙光放射光束 (Dawn Sun Rays)
      ctx.save();
      ctx.translate(W / 2, 280);
      for (let r = 0; r < 12; r++) {
        const rayA = (r * Math.PI) / 6;
        ctx.fillStyle = "rgba(255, 230, 130, 0.05)";
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(rayA - 0.1) * 600, Math.sin(rayA - 0.1) * 600);
        ctx.lineTo(Math.cos(rayA + 0.1) * 600, Math.sin(rayA + 0.1) * 600);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    } else {
      // 燈盡夜沉幽冥鬼火暗流
      const defeatGrad = ctx.createRadialGradient(W / 2, 280, 40, W / 2, 280, 480);
      defeatGrad.addColorStop(0, "rgba(180, 20, 50, 0.28)");
      defeatGrad.addColorStop(0.5, "rgba(80, 10, 40, 0.14)");
      defeatGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = defeatGrad;
      ctx.fillRect(0, 0, W, H);
    }

    // 3. 頂部大氣和風書法標題
    ctx.textAlign = "center";
    ctx.font = "900 44px 'Kaisei Decol', 'Noto Sans JP', serif";
    ctx.fillStyle = isWon ? "#ffe28b" : "#ff5470";
    ctx.shadowColor = isWon ? "rgba(255, 215, 100, 0.75)" : "rgba(255, 60, 80, 0.75)";
    ctx.shadowBlur = 18;
    ctx.fillText(isWon ? "— 破 曉 迎 曦 —" : "— 燈 盡 夜 沉 —", W / 2, 92);
    ctx.shadowBlur = 0;

    ctx.font = "900 12px 'Zen Maru Gothic', sans-serif";
    ctx.fillStyle = isWon ? "rgba(255, 226, 139, 0.65)" : "rgba(255, 120, 140, 0.65)";
    ctx.fillText(isWon ? "DAWN HAS BROKEN ・ 夜 行 配 達 完 遂" : "THE FLAME HAS FADED ・ 燈 枯 命 盡", W / 2, 116);

    // 4. 中央主體：神社奉納繪馬・黑漆額匾 (Shrine Votive Ema & Lacquer Tablet)
    const cardW = 540, cardH = 310;
    const cx = W / 2 - cardW / 2, cy = 136;

    // 繪馬多層黑漆底板
    const plaqueGrad = ctx.createLinearGradient(cx, cy, cx + cardW, cy + cardH);
    plaqueGrad.addColorStop(0, "#161c2c");
    plaqueGrad.addColorStop(0.5, "#0f1320");
    plaqueGrad.addColorStop(1, "#0a0c16");

    ctx.save();
    ctx.fillStyle = plaqueGrad;
    ctx.beginPath();
    ctx.roundRect(cx, cy, cardW, cardH, 16);
    ctx.fill();

    // 雙重金箔框線
    ctx.strokeStyle = isWon ? "#d4af37" : "rgba(212, 175, 55, 0.65)";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.strokeStyle = "rgba(255, 235, 160, 0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(cx + 6, cy + 6, cardW - 12, cardH - 12, 12);
    ctx.stroke();

    // 繪馬四角和風雲紋金金屬件 (Cloud Corner Metal Brackets)
    const bracketSize = 22;
    const drawCornerBracket = (bx, by, rot) => {
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(rot);
      ctx.fillStyle = "#d4af37";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(bracketSize, 0);
      ctx.lineTo(bracketSize, 5);
      ctx.lineTo(5, 5);
      ctx.lineTo(5, bracketSize);
      ctx.lineTo(0, bracketSize);
      ctx.closePath();
      ctx.fill();
      // 小金釘
      ctx.fillStyle = "#fff8d1";
      ctx.beginPath();
      ctx.arc(8, 8, 2, 0, 6.28);
      ctx.fill();
      ctx.restore();
    };

    drawCornerBracket(cx + 4, cy + 4, 0);
    drawCornerBracket(cx + cardW - 4, cy + 4, Math.PI / 2);
    drawCornerBracket(cx + cardW - 4, cy + cardH - 4, Math.PI);
    drawCornerBracket(cx + 4, cy + cardH - 4, -Math.PI / 2);

    // 5. 硃砂赤紅篆刻落款印 (Vermilion Seal Stamp)
    ctx.save();
    ctx.translate(cx + cardW - 68, cy + 32);
    ctx.rotate(-0.06);
    ctx.fillStyle = isWon ? "#c62828" : "#8e0000";
    ctx.beginPath();
    ctx.roundRect(-24, -24, 48, 48, 6);
    ctx.fill();
    ctx.strokeStyle = "#ffcdd2";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 19px 'Kaisei Decol', serif";
    ctx.textAlign = "center";
    ctx.fillText(isWon ? "完遂" : "無念", 0, 7);
    ctx.restore();

    // 6. 功績得分與大氣排版
    ctx.textAlign = "center";
    ctx.font = "900 13px 'Zen Maru Gothic', sans-serif";
    ctx.fillStyle = "#ffd54f";
    ctx.fillText("❖ 今 夜 功 績 得 分 ❖", W / 2, cy + 36);

    ctx.font = "900 50px 'Kaisei Decol', sans-serif";
    const scoreGrad = ctx.createLinearGradient(0, cy + 42, 0, cy + 96);
    scoreGrad.addColorStop(0, "#ffffff");
    scoreGrad.addColorStop(0.3, "#fff3b0");
    scoreGrad.addColorStop(1, "#f5c53d");
    ctx.fillStyle = scoreGrad;
    ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
    ctx.shadowBlur = 8;
    ctx.fillText(score.toLocaleString(), W / 2, cy + 92);
    ctx.shadowBlur = 0;

    // 裝飾花紋分割線
    ctx.strokeStyle = "rgba(212, 175, 55, 0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + 40, cy + 114);
    ctx.lineTo(cx + cardW - 40, cy + 114);
    ctx.stroke();

    ctx.fillStyle = "#d4af37";
    ctx.font = "9px sans-serif";
    ctx.fillText("◆ ────────── 夜 行 配 達 結 果 ────────── ◆", W / 2, cy + 117);

    // 7. 左右對稱黑漆木札數據欄
    const plateW = 195, plateH = 58;
    const p1x = W / 2 - plateW - 14, p2x = W / 2 + 14, py = cy + 134;

    // 配達完遂木札
    glassBox(ctx, p1x, py, plateW, plateH, 8, "rgba(14, 34, 22, 0.95)", "#4caf50", 1.8);
    ctx.textAlign = "left";
    ctx.fillStyle = "#c8e6c9";
    ctx.font = "900 13px 'Zen Maru Gothic', sans-serif";
    ctx.fillText("【 配達完遂 】", p1x + 16, py + 24);
    ctx.font = "900 24px 'Kaisei Decol', sans-serif";
    ctx.fillStyle = "#a5d6a7";
    ctx.fillText(`${delivered} 件`, p1x + 18, py + 50);

    // 妖怪誤配木札
    glassBox(ctx, p2x, py, plateW, plateH, 8, "rgba(36, 16, 22, 0.95)", "#ef5350", 1.8);
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffcdd2";
    ctx.font = "900 13px 'Zen Maru Gothic', sans-serif";
    ctx.fillText("【 妖怪誤配 】", p2x + 16, py + 24);
    ctx.font = "900 24px 'Kaisei Decol', sans-serif";
    ctx.fillStyle = "#ef9a9a";
    ctx.fillText(`${failed} 件`, p2x + 18, py + 50);

    // 8. 失誤單字卷軸
    const reviewList = [...new Map(misses.map(w => [w.jp, w])).values()].slice(0, 5);
    if (reviewList.length > 0) {
      const rwW = cardW - 56, rwH = 48;
      const rwx = W / 2 - rwW / 2, rwy = cy + 206;
      glassBox(ctx, rwx, rwy, rwW, rwH, 8, "rgba(24, 18, 36, 0.95)", "#ba68c8", 1.5);
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffe28b";
      ctx.font = "900 12px 'Zen Maru Gothic', sans-serif";
      ctx.fillText("今夜失誤單字複習：", W / 2, rwy + 18);
      ctx.fillStyle = "#ffeed4";
      ctx.font = "bold 13px 'Noto Sans JP', sans-serif";
      const wStr = reviewList.map(w => `${w.jp}（${w.zh}）`).join("　");
      ctx.fillText(wStr, W / 2, rwy + 37);
    } else {
      // 零失誤特典印記
      ctx.textAlign = "center";
      ctx.font = "900 14px 'Kaisei Decol', sans-serif";
      ctx.fillStyle = "#a5d6a7";
      ctx.fillText("★ 今 夜 配 達 零 失 誤 ・ 大 顯 神 威 ★", W / 2, cy + 235);
    }

    ctx.restore();

    // 9. 底部再戰按鈕 (神社御神籤御札風格)
    const btnW = 260, btnH = 52;
    const bx = W / 2 - btnW / 2, by = cy + cardH + 20;

    const btnGrad = ctx.createLinearGradient(bx, by, bx + btnW, by + btnH);
    btnGrad.addColorStop(0, "#ffe57f");
    btnGrad.addColorStop(0.5, "#d4af37");
    btnGrad.addColorStop(1, "#b8860b");

    ctx.save();
    ctx.shadowColor = "rgba(255, 215, 100, 0.5)";
    ctx.shadowBlur = 14;
    glassBox(ctx, bx, by, btnW, btnH, 12, btnGrad, "#ffffff", 2);
    ctx.shadowBlur = 0;

    ctx.textAlign = "center";
    ctx.fillStyle = "#161022";
    ctx.font = "900 20px 'Kaisei Decol', 'Noto Sans JP', serif";
    ctx.fillText("◆ 再 踏 夜 行 ◆", W / 2, by + 34);
    ctx.restore();

    ctx.restore();
  }

  // 7. 暫停與設定選單 (日式黑漆金箔和風御札，無任何彩虹膠囊與 Emoji)
  const PAUSE_BTNS = [
    { id: "resume", label: "◆ 繼 續 夜 行 ◆", y: 215 },
    { id: "mute", label: "◆ 聲 音 音 效 ： 開 ◆", labelMuted: "◆ 聲 音 音 效 ： 關 ◆", y: 280 },
    { id: "codex", label: "◆ 百 鬼 單 字 卷 ◆", y: 345 },
    { id: "menu", label: "◆ 返 回 主 選 單 ◆", y: 410 }
  ];

  function drawPauseMenu(ctx, muted) {
    ctx.save();
    ctx.fillStyle = "rgba(6, 8, 16, 0.92)";
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = "center";
    ctx.font = "900 36px 'Kaisei Decol', 'Noto Sans JP', serif";
    ctx.fillStyle = "#ffe28b";
    ctx.shadowColor = "rgba(255, 215, 100, 0.6)";
    ctx.shadowBlur = 14;
    ctx.fillText("— 暫 歇 —", W / 2, 145);
    ctx.shadowBlur = 0;

    ctx.font = "bold 12px 'Noto Sans JP', sans-serif";
    ctx.fillStyle = "rgba(255, 235, 180, 0.55)";
    ctx.fillText("PAUSE", W / 2, 172);

    const btnW = 280, btnH = 46;
    const bx = W / 2 - btnW / 2;

    PAUSE_BTNS.forEach(b => {
      let label = b.label;
      if (b.id === "mute") {
        label = muted ? b.labelMuted : b.label;
      }
      glassBox(ctx, bx, b.y, btnW, btnH, 10, "rgba(18, 22, 36, 0.95)", "rgba(212, 175, 55, 0.8)", 1.6);
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffeed4";
      ctx.font = "900 16px 'Zen Maru Gothic', 'Noto Sans JP', sans-serif";
      ctx.fillText(label, W / 2, b.y + 29);
    });

    ctx.fillStyle = "rgba(255, 235, 180, 0.45)";
    ctx.font = "12px 'Noto Sans JP', sans-serif";
    ctx.fillText("[ 按 ESC 或 P 鍵返回夜行 ]", W / 2, 495);

    ctx.restore();
  }

  return {
    drawMainMenu,
    drawHud,
    drawLevelUp,
    drawEmblem,
    drawBossQuiz,
    drawCodex,
    drawEndScreen,
    drawPauseMenu,
    PAUSE_BTNS,
    PAUSE_BTN_W: 280,
    PAUSE_BTN_H: 46
  };
})();
