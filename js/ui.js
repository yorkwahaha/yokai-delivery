// 使用者介面（UI）：商業級全螢幕懸浮式 HUD、HoloCure 風格武器圖標槽、純視覺化無文字冗餘
window.UI = (() => {
  const W = 900, H = 600;
  const RESTART_BTN = { x: (W - 232) / 2, y: 492, w: 232, h: 48 };
  const MENU_START_BTN = { x: W / 2 - 132, y: 478, w: 264, h: 54 };
  const HINT_BTN = { x: 532, y: 20, w: 78, h: 40 };

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

    const blink = 0.78 + 0.22 * Math.sin(elapsed * 5);
    glassBox(ctx, MENU_START_BTN.x, MENU_START_BTN.y, MENU_START_BTN.w, MENU_START_BTN.h, 12, `rgba(30, 24, 18, ${0.86 + blink * 0.08})`, "#ffe082", 2.4);
    ctx.fillStyle = "#ffe9ad";
    ctx.font = "900 22px 'Kaisei Decol', 'Noto Sans JP', serif";
    ctx.fillText("夜 行 開 始　▶", W / 2, MENU_START_BTN.y + 35);

    ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
    ctx.font = "bold 13px 'Noto Sans JP', sans-serif";
    ctx.fillText(`夜 行 紀 錄 ： 最 高 得 分 ${STORE.data.best || 0} 點　｜　最 高 配 達 ${STORE.data.bestDel || 0} 件`, W / 2, 565);

    glassBox(ctx, W - 285, 22, 125, 38, 8, "rgba(24, 30, 52, 0.9)", "#e3b35d", 1.8);
    ctx.fillStyle = "#ffeed4";
    ctx.font = "900 13px 'Zen Maru Gothic', sans-serif";
    ctx.fillText("🎴 卡片一覽", W - 222, 46);

    glassBox(ctx, W - 145, 22, 125, 38, 8, "rgba(24, 30, 52, 0.9)", "#e3b35d", 1.8);
    ctx.fillStyle = "#ffeed4";
    ctx.font = "900 13px 'Zen Maru Gothic', sans-serif";
    ctx.fillText("📜 百鬼單字 [C]", W - 82, 46);

    ctx.restore();
  }

  // 2. 全螢幕專業無分割 HUD（懸浮微型儀表 + 底部 HoloCure 風格武器格）
  function drawHud(ctx, P, oil, maxOil, elapsed, dawnTime, delivered, failed, score, level, xp, xpNeed, job, hintT, orders, inter, bossQ, touch, joy, btnE, btnD, btnPause, WL, WI, b, nameT, goalDeliveries = 6, dashCd = 0, dashMax = 1.8, bossHunt = false) {
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

    // 配達目標與得分
    ctx.fillStyle = "#ffeed4";
    ctx.font = "900 13px 'Noto Sans JP', sans-serif";
    ctx.fillText(`配達 ${delivered}/${goalDeliveries}  |  ${score}pt`, sBoxX + 12, sBoxY + 42);

    // --- 右上角暫停按鈕 (btnPause) ---
    glassBox(ctx, btnPause.x, btnPause.y, btnPause.w, btnPause.h, 10, "rgba(20, 26, 44, 0.92)", "#d4af37", 1.8);
    const pcx = btnPause.x + btnPause.w / 2, pcy = btnPause.y + btnPause.h / 2;
    ctx.fillStyle = "#ffd54f";
    ctx.fillRect(pcx - 6, pcy - 8, 4, 16);
    ctx.fillRect(pcx + 2, pcy - 8, 4, 16);

    // --- 中上：HoloCure 式單一任務條。只保留「現在要做什麼」與方向資訊。 ---
    const taskX = 248, taskY = 14, taskW = 370, taskH = 52;
    const bossPulse = 0.5 + 0.5 * Math.sin(elapsed * 7);
    const taskStroke = bossHunt
      ? `rgba(255, 68, 86, ${0.72 + bossPulse * 0.28})`
      : nameT > 0 ? "#ffe082" : "rgba(212, 175, 55, 0.62)";
    glassBox(ctx, taskX, taskY, taskW, taskH, 10, bossHunt ? "rgba(48, 8, 20, 0.94)" : "rgba(12, 16, 28, 0.9)", taskStroke, bossHunt ? 3 : (nameT > 0 ? 2.4 : 1.4));
    ctx.textAlign = "left";
    if (bossHunt) {
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff1f3";
      ctx.font = "900 20px 'Noto Sans JP', sans-serif";
      ctx.fillText("⚠ 大妖鬼を倒せ！", taskX + taskW / 2, taskY + 23);
      ctx.fillStyle = "#ff8a9a";
      ctx.font = "900 12px 'Zen Maru Gothic', sans-serif";
      ctx.fillText("赤い双矢印を追え", taskX + taskW / 2, taskY + 43);
    } else if (job) {
      const remaining = Math.round(Math.hypot(P.x - job.to.x, P.y - job.to.y) / 10) * 10;
      const prompt = `${job.word.icon} ${job.word.zh}`;
      ctx.fillStyle = "#fff3ca";
      ctx.font = "900 18px 'Noto Sans JP', sans-serif";
      ctx.fillText(prompt, taskX + 14, taskY + 23);
      ctx.fillStyle = "#82d8ff";
      ctx.font = "900 12px 'Zen Maru Gothic', sans-serif";
      ctx.fillText(`➜ ${remaining}`, taskX + 14, taskY + 43);

      const hintStage = job.hintStage || 0;
      const hintLabel = hintStage === 0 ? "💡 -3" : hintStage === 1 ? "👁 -4" : "✓";
      const hintEnabled = hintStage < 2;
      glassBox(ctx, HINT_BTN.x, HINT_BTN.y, HINT_BTN.w, HINT_BTN.h, 9, hintEnabled ? "rgba(31, 61, 77, 0.94)" : "rgba(44, 48, 58, 0.82)", hintEnabled ? "#80deea" : "#6b7280", 1.6);
      ctx.textAlign = "center";
      ctx.fillStyle = hintEnabled ? "#e0fbff" : "#b7bdc8";
      ctx.font = "900 14px 'Zen Maru Gothic', sans-serif";
      ctx.fillText(hintLabel, HINT_BTN.x + HINT_BTN.w / 2, HINT_BTN.y + 25);

      if (job.showMeaningT > 0) {
        ctx.textAlign = "left";
        ctx.fillStyle = "#ffd54f";
        ctx.font = "bold 11px 'Noto Sans JP', sans-serif";
        const helper = `${job.word.jp}　${job.word.example || ""}`;
        ctx.fillText(helper.slice(0, 13), taskX + 122, taskY + 23);
      }
    } else {
      ctx.fillStyle = inter ? "#ffe082" : "#f4e7cf";
      ctx.font = "900 17px 'Zen Maru Gothic', sans-serif";
      ctx.fillText(inter ? (touch ? "📦　取貨" : "📦　E / 取貨") : "📦　取貨", taskX + 16, taskY + 31);
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "12px sans-serif";
      ctx.fillText("➜", taskX + 128, taskY + 31);
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
      // 開場只用半透明搖桿輪廓提示「左側可拖曳」，不彈教學文字。
      if (!joy && elapsed < 15) {
        ctx.strokeStyle = "rgba(255,255,255,0.28)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(105, H - 105, 52, 0, 6.28);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(105, H - 105, 20, 0, 6.28);
        ctx.stroke();
      }
      const cdRatio = Math.max(0, Math.min(1, dashCd / Math.max(0.01, dashMax)));
      const readyRatio = 1 - cdRatio;
      ctx.fillStyle = cdRatio <= 0.001 ? "rgba(255, 255, 255, 0.72)" : "rgba(30, 38, 58, 0.72)";
      ctx.beginPath();
      ctx.arc(btnD.x, btnD.y, btnD.r, 0, 6.28);
      ctx.fill();
      if (cdRatio > 0.001) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.42)";
        ctx.beginPath();
        ctx.moveTo(btnD.x, btnD.y);
        ctx.arc(btnD.x, btnD.y, btnD.r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * readyRatio);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.78)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(btnD.x, btnD.y, btnD.r, 0, 6.28);
        ctx.stroke();
      }
      ctx.textAlign = "center";
      ctx.fillStyle = cdRatio <= 0.001 ? "#1e2436" : "#ffffff";
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
    } else if (elapsed < 12) {
      glassBox(ctx, 22, H - 112, 72, 30, 7, "rgba(12,16,28,0.62)", "rgba(255,255,255,0.25)", 1);
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = "900 12px sans-serif";
      ctx.fillText("WASD", 58, H - 92);
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

  // 3. 升級選卡：HoloCure 式橫向選項列；整列都是觸控區，降低手機誤觸。
  function drawLevelUp(ctx, level, choices, WL, WI) {
    ctx.save();
    ctx.fillStyle = "rgba(6, 9, 18, 0.94)";
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = "center";
    ctx.font = "900 30px 'Kaisei Decol', 'Noto Sans JP', serif";
    ctx.fillStyle = "#ffe28b";
    ctx.shadowColor = "rgba(255, 215, 100, 0.7)";
    ctx.shadowBlur = 14;
    ctx.fillText(`LEVEL UP!　Lv.${level}`, W / 2, 48);
    ctx.shadowBlur = 0;

    // 頂部只顯示 4 個主動槽，不再放長篇說明。
    const ownedKeys = WI ? Object.keys(WI).filter(k => (WL[k] || 0) > 0) : [];
    const maxSlots = 4;
    const barW = 500, barH = 52;
    const barX = W / 2 - barW / 2, barY = 64;

    glassBox(ctx, barX, barY, barW, barH, 10, "rgba(18, 24, 40, 0.9)", "#d4af37", 1.5);
    const slotStartX = barX + 22;
    for (let s = 0; s < maxSlots; s++) {
      const sx = slotStartX + s * 116;
      const k = ownedKeys[s];
      if (k) {
        glassBox(ctx, sx, barY + 7, 104, 38, 6, "rgba(26, 36, 62, 0.9)", "#d4af37", 1.2);
        drawEmblem(ctx, k, sx + 18, barY + 23, 14);
        ctx.fillStyle = "#ffeed4";
        ctx.font = "900 12px 'Noto Sans JP', sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(`${WI[k].zh} L${WL[k]}`, sx + 38, barY + 27);
      } else {
        ctx.save();
        ctx.setLineDash([3, 3]);
        glassBox(ctx, sx, barY + 7, 104, 38, 6, "rgba(10, 14, 24, 0.5)", "rgba(180, 195, 220, 0.35)", 1);
        ctx.fillStyle = "rgba(180, 195, 220, 0.4)";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("＋", sx + 52, barY + 29);
        ctx.restore();
      }
    }

    const cardW = 720, cardH = 108;
    const startX = 90, gap = 14, cy = 176;

    choices.forEach((c, i) => {
      const cx = startX;
      const rowY = cy + i * (cardH + gap);
      ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
      ctx.beginPath();
      ctx.roundRect(cx + 5, rowY + 6, cardW, cardH, 14);
      ctx.fill();

      const cardGrad = ctx.createLinearGradient(cx, rowY, cx + cardW, rowY + cardH);
      cardGrad.addColorStop(0, "#222a42");
      cardGrad.addColorStop(0.45, "#141a2b");
      cardGrad.addColorStop(1, "#0d101d");
      const isWeapon = c.type === "weapon";
      const catColor = isWeapon ? (c.id === "barrier" ? "#1976d2" : (c.id === "katana" ? "#c62828" : "#8e24aa")) : "#00897b";
      glassBox(ctx, cx, rowY, cardW, cardH, 14, cardGrad, catColor, 2.2);

      // 大型號碼＋紋章，讓鍵盤與觸控的對應一眼可見。
      glassBox(ctx, cx + 12, rowY + 14, 48, 80, 10, "rgba(8, 12, 22, 0.78)", "#d4af37", 1.3);
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffe082";
      ctx.font = "900 20px sans-serif";
      ctx.fillText(String(i + 1), cx + 36, rowY + 39);
      drawEmblem(ctx, c.id, cx + 36, rowY + 70, 18);

      ctx.textAlign = "left";
      ctx.fillStyle = "#ffffff";
      ctx.font = "900 20px 'Kaisei Decol', 'Noto Sans JP', serif";
      ctx.fillText(c.n, cx + 78, rowY + 31);
      ctx.fillStyle = "#ffd54f";
      ctx.font = "bold 12px 'Noto Sans JP', sans-serif";
      ctx.fillText(c.s || "", cx + 78, rowY + 51);

      const isNew = c.levelText && (c.levelText.includes("新") || c.levelText.includes("NEW"));
      glassBox(ctx, cx + 500, rowY + 14, 198, 28, 7, isNew ? "rgba(212, 175, 55, 0.25)" : "rgba(33, 150, 243, 0.2)", isNew ? "#ffd54f" : "#64b5f6", 1.2);
      ctx.textAlign = "center";
      ctx.fillStyle = isNew ? "#ffe082" : "#90caf9";
      ctx.font = "900 12px 'Zen Maru Gothic', sans-serif";
      ctx.fillText(c.levelText || "◆ 妖力精進", cx + 599, rowY + 33);

      ctx.textAlign = "left";
      ctx.font = "bold 14px 'Noto Sans JP', sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText((c.d || "").slice(0, 42), cx + 78, rowY + 82);
      ctx.fillStyle = "#98a9c5";
      ctx.font = "900 11px 'Zen Maru Gothic', sans-serif";
      ctx.fillText(c.cat || "", cx + 500, rowY + 76);
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

    const n = bossQ.ans.length;
    ctx.textAlign = "center";
    ctx.font = "900 24px 'Kaisei Decol', 'Noto Sans JP', serif";
    ctx.fillStyle = "#ffeed4";
    ctx.fillText(`🛡　${bossQ.word.icon}　→　？`, W / 2, by + 30);

    const optW = n === 2 ? 260 : 200, optH = 46;
    const gap = n === 2 ? 36 : 24;
    const totalW = n * optW + (n - 1) * gap;
    const startX = bx + (boxW - totalW) / 2;

    bossQ.ans.forEach((w, i) => {
      const ox = startX + i * (optW + gap);
      const oy = by + 46;
      glassBox(ctx, ox, oy, optW, optH, 10, bossQ.lock > 0 ? "#333c57" : "#ffeed4", "#d4af37", 2);
      ctx.fillStyle = "#1e1829";
      ctx.font = "900 18px 'Zen Maru Gothic', sans-serif";
      ctx.fillText(`${i + 1}. ${w.jp}`, ox + optW / 2, oy + 29);
    });

    ctx.restore();
  }

  // 5. 系統圖鑑（秘術卡片一覽 ＆ 百鬼單字卷）
  const CARD_LIST = [
    // 主動秘術 (Active Weapons)
    { name: "妖刀斬", jp: "かたな", type: "主動", desc: "揮出凌厲新月刀芒，斬裂前方扇形妖怪", emblem: "katana" },
    { name: "淨化靈陣", jp: "じょうか", type: "主動", desc: "展開 360 度除魔陣，週期性震退並重創周身妖怪", emblem: "barrier" },
    { name: "狐火炎", jp: "きつねび", type: "主動", desc: "周身飛旋烈焰火把，高速甩擊灼燒貼身妖怪", emblem: "fire" },
    { name: "陰陽符", jp: "おふだ", type: "主動", desc: "擲出迴旋陰陽符咒，來回穿透路徑上的敵人", emblem: "boom" },
    { name: "天狐雷", jp: "いかずち", type: "主動", desc: "引導九天金雷轟擊最強妖怪，造成毀滅性打擊", emblem: "thunder" },
    { name: "天狐靈針", jp: "せんぼん", type: "主動", desc: "向面朝方向連續迸射破魔靈針，貫通前方妖怪", emblem: "needle" },

    // 被動修行 (Passive Enhancements)
    { name: "金剛結界", jp: "けっかい", type: "被動", desc: "召喚金剛勾玉護盾，抵擋 2 次受傷（可疊加）", emblem: "shield" },
    { name: "長明燈油", jp: "あぶら", type: "被動", desc: "燈油上限 +30 並立即補滿，且常駐每秒回油", emblem: "oil_max" },
    { name: "添燈香油", jp: "かいふく", type: "被動", desc: "恢復 50% 燈油，並震退周圍妖怪", emblem: "oil_heal" },
    { name: "修羅破軍", jp: "こうげき", type: "被動", desc: "整體傷害係數 +0.35", emblem: "dmg" },
    { name: "神樂疾奏", jp: "れんぞく", type: "被動", desc: "妖刀、結界、靈針冷卻縮短", emblem: "rate" },
    { name: "心眼一閃", jp: "かいしん", type: "被動", desc: "妖刀/天雷暴擊率 +15%，結界 +10%", emblem: "crit" },
    { name: "神足草履", jp: "いどう", type: "被動", desc: "移動速度約 +15%（最多 3 層）", emblem: "spd" },
    { name: "縮地瞬步", jp: "ダッシュ", type: "被動", desc: "衝刺冷卻大幅縮短，衝刺附加無敵突進", emblem: "dash" },
    { name: "招財勾玉", jp: "じしゃく", type: "被動", desc: "靈玉吸取範圍 +80", emblem: "mag" }
  ];

  function drawCodex(ctx, STORE, ALL, tab = "cards") {
    ctx.save();
    ctx.fillStyle = "rgba(10, 14, 26, 0.96)";
    ctx.fillRect(0, 0, W, H);

    const isCards = tab === "cards";

    // 1. 頂部大標題
    ctx.textAlign = "center";
    ctx.font = "900 28px 'Kaisei Decol', 'Noto Sans JP', serif";
    ctx.fillStyle = "#ffe28b";
    ctx.shadowColor = "rgba(255, 215, 100, 0.5)";
    ctx.shadowBlur = 10;
    ctx.fillText(isCards ? "— 秘 術 卡 片 一 覽 (Card Compendium) —" : "— 百 鬼 單 字 繪 卷 (Codex) —", W / 2, 40);
    ctx.shadowBlur = 0;

    // 2. 雙標籤頁切換按鈕
    const tabW = 160, tabH = 32, tabY = 56;
    const tabCardsX = W / 2 - tabW - 8, tabWordsX = W / 2 + 8;

    // 🎴 秘術卡片一覽 標籤
    glassBox(ctx, tabCardsX, tabY, tabW, tabH, 8, isCards ? "rgba(38, 52, 84, 0.95)" : "rgba(18, 22, 38, 0.75)", isCards ? "#ffd54f" : "rgba(212, 175, 55, 0.4)", isCards ? 2 : 1.2);
    ctx.textAlign = "center";
    ctx.fillStyle = isCards ? "#ffe28b" : "rgba(255, 235, 180, 0.65)";
    ctx.font = "900 13px 'Zen Maru Gothic', sans-serif";
    ctx.fillText("🎴 秘術卡片一覽", tabCardsX + tabW / 2, tabY + 20);

    // 📜 百鬼單字卷 標籤
    const isWords = !isCards;
    glassBox(ctx, tabWordsX, tabY, tabW, tabH, 8, isWords ? "rgba(38, 52, 84, 0.95)" : "rgba(18, 22, 38, 0.75)", isWords ? "#ffd54f" : "rgba(212, 175, 55, 0.4)", isWords ? 2 : 1.2);
    ctx.fillStyle = isWords ? "#ffe28b" : "rgba(255, 235, 180, 0.65)";
    ctx.font = "900 13px 'Zen Maru Gothic', sans-serif";
    ctx.fillText("📜 百鬼單字卷", tabWordsX + tabW / 2, tabY + 20);

    if (isCards) {
      // 3. 卡片一覽表格頁面
      ctx.font = "bold 13px 'Zen Maru Gothic', 'Noto Sans JP', sans-serif";
      ctx.fillStyle = "#cad7f5";
      ctx.fillText("夜行修煉秘術與體質修行總覽・按照 中文名稱、日文名稱、主動／被動、招式說明 排序", W / 2, 102);

      // 表格框架 (寬 828, 高 426)
      const tX = 36, tY = 114, tW = 828, tH = 426;
      glassBox(ctx, tX, tY, tW, tH, 10, "rgba(14, 18, 32, 0.95)", "#d4af37", 1.8);

      // 表頭 (Header)
      const hH = 30;
      ctx.fillStyle = "rgba(28, 38, 62, 0.95)";
      ctx.beginPath();
      ctx.roundRect(tX, tY, tW, hH, [10, 10, 0, 0]);
      ctx.fill();

      ctx.strokeStyle = "rgba(212, 175, 55, 0.6)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(tX, tY + hH);
      ctx.lineTo(tX + tW, tY + hH);
      ctx.stroke();

      // 表頭欄位標題 (精準符合用戶要求順序)
      ctx.fillStyle = "#ffd54f";
      ctx.font = "900 13px 'Zen Maru Gothic', 'Noto Sans JP', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("中文名稱", 125, tY + 20);
      ctx.fillText("日文名稱", 240, tY + 20);
      ctx.fillText("主動／被動", 340, tY + 20);
      ctx.textAlign = "left";
      ctx.fillText("招式說明", 410, tY + 20);

      // 15 行表格數據 (高度 26.2px)
      const rowH = 26.2;
      CARD_LIST.forEach((c, i) => {
        const ry = tY + hH + i * rowH;

        // 隔行底色
        ctx.fillStyle = i % 2 === 0 ? "rgba(255, 255, 255, 0.02)" : "rgba(255, 255, 255, 0.055)";
        ctx.fillRect(tX + 1, ry, tW - 2, rowH);

        // 分隔橫線
        if (i < CARD_LIST.length - 1) {
          ctx.strokeStyle = "rgba(212, 175, 55, 0.12)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(tX + 10, ry + rowH);
          ctx.lineTo(tX + tW - 10, ry + rowH);
          ctx.stroke();
        }

        const midY = ry + rowH / 2;

        // 1. 中文名稱 (微型神紋圖章 + 名字)
        drawEmblem(ctx, c.emblem, 68, midY, 9);
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#ffffff";
        ctx.font = "900 13px 'Kaisei Decol', 'Noto Sans JP', serif";
        ctx.fillText(c.name, 86, midY);

        // 2. 日文名稱
        ctx.textAlign = "center";
        ctx.fillStyle = "#ffe082";
        ctx.font = "bold 13px 'Noto Sans JP', sans-serif";
        ctx.fillText(c.jp, 240, midY);

        // 3. 主動／被動 膠囊標籤
        const isAct = c.type === "主動";
        const pillW = 54, pillH = 18;
        const pillX = 340 - pillW / 2, pillY = midY - pillH / 2;
        ctx.fillStyle = isAct ? "rgba(211, 47, 47, 0.25)" : "rgba(0, 137, 123, 0.25)";
        ctx.beginPath();
        ctx.roundRect(pillX, pillY, pillW, pillH, 4);
        ctx.fill();
        ctx.strokeStyle = isAct ? "#ef5350" : "#26a69a";
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.textAlign = "center";
        ctx.fillStyle = isAct ? "#ffcdd2" : "#b2dfdb";
        ctx.font = "900 11px 'Zen Maru Gothic', sans-serif";
        ctx.fillText(c.type, 340, midY + 0.5);

        // 4. 招式說明
        ctx.textAlign = "left";
        ctx.fillStyle = "#e0e6ed";
        ctx.font = "bold 12px 'Zen Maru Gothic', sans-serif";
        ctx.fillText(c.desc, 410, midY);
      });
      ctx.textBaseline = "alphabetic";

    } else {
      // 3. 百鬼單字卷頁面 (36 個妖怪單字)
      ctx.font = "bold 13px 'Noto Sans JP', sans-serif";
      ctx.fillStyle = "#cad7f5";
      ctx.fillText("★ = 熟練度：答對升星、答錯降一星。越不熟或間隔久未複習的單字越常出現。（按 C 或 點擊返回）", W / 2, 102);

      let mastered = 0;
      const cardW = 86, cardH = 112;
      const startX = 46, startY = 118;

      ALL.forEach((w, i) => {
        const col = i % 9;
        const row = (i / 9) | 0;
        const cx = startX + col * 95;
        const cy = startY + row * 116;

        const m = STORE.get(w.jp);
        const seen = (m.ok + m.ng) > 0;
        if (m.box >= 4) mastered++;

        glassBox(ctx, cx, cy, cardW, cardH, 8, seen ? "#fcf4e3" : "#20273a", seen ? "#d4af37" : "#36415a", 1.5);

        ctx.textAlign = "center";
        ctx.fillStyle = "#1e1829";
        ctx.font = "24px sans-serif";
        ctx.fillText(seen ? w.icon : "？", cx + cardW / 2, cy + 32);

        ctx.font = "900 13px 'Zen Maru Gothic', sans-serif";
        ctx.fillText(seen ? w.jp : "？？", cx + cardW / 2, cy + 56);

        if (seen) {
          ctx.font = "bold 11px 'Noto Sans JP', sans-serif";
          ctx.fillStyle = "#63503c";
          ctx.fillText(w.zh, cx + cardW / 2, cy + 74);

          ctx.font = "9px 'Noto Sans JP', sans-serif";
          ctx.fillStyle = "#786957";
          const ex = (w.example || "").replaceAll(" ", "");
          ctx.fillText(ex.length > 10 ? ex.slice(0, 9) + "…" : ex, cx + cardW / 2, cy + 91);

          ctx.fillStyle = "#d48819";
          ctx.font = "11px sans-serif";
          ctx.fillText("★".repeat(m.box) + "☆".repeat(4 - m.box), cx + cardW / 2, cy + 107);
        }
      });

      ctx.font = "900 14px 'Zen Maru Gothic', sans-serif";
      ctx.fillStyle = "#ffe28b";
      ctx.fillText(`已精通詞彙：${mastered} / ${ALL.length} 語`, W / 2, 545);
    }

    // 4. 底部返回按鈕
    glassBox(ctx, W / 2 - 85, 554, 170, 32, 8, "#d4af37", "#ffffff", 1.5);
    ctx.textAlign = "center";
    ctx.fillStyle = "#1a162b";
    ctx.font = "900 14px 'Zen Maru Gothic', 'Noto Sans JP', sans-serif";
    ctx.fillText("返回 [ESC / C]", W / 2, 574);

    ctx.restore();
  }

  // 結算：同一條夜路壓暗，左邊站著快遞員，中間是今夜的帳。
  function drawEndScreen(ctx, state, score, delivered, failed, misses) {
    ctx.save();
    const isWon = state === "won";

    ctx.fillStyle = "rgba(6, 8, 18, 0.76)";
    ctx.fillRect(0, 0, W, H);
    const sky = ctx.createLinearGradient(0, 0, 0, 280);
    if (isWon) {
      sky.addColorStop(0, "rgba(255, 168, 80, 0.46)");
      sky.addColorStop(0.4, "rgba(120, 72, 96, 0.2)");
      sky.addColorStop(1, "rgba(6, 8, 18, 0)");
    } else {
      sky.addColorStop(0, "rgba(12, 14, 28, 0.35)");
      sky.addColorStop(1, "rgba(6, 8, 18, 0)");
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    const vig = ctx.createRadialGradient(W / 2, 250, 80, W / 2, 280, 520);
    vig.addColorStop(0, "rgba(6, 8, 18, 0.42)");
    vig.addColorStop(1, "rgba(6, 8, 18, 0)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    const petals = [[120, 70], [760, 96], [640, 210], [90, 240], [800, 340], [180, 400]];
    petals.forEach((p, i) => {
      ctx.fillStyle = `rgba(255, 186, 206, ${0.28 + (i % 3) * 0.08})`;
      ctx.beginPath();
      ctx.ellipse(p[0], p[1], 7, 4, i * 0.7, 0, 6.28);
      ctx.fill();
    });

    const courier = window.ART && window.ART.player;
    if (courier && courier.naturalWidth) {
      const pw = 150;
      const ph = pw * courier.naturalHeight / courier.naturalWidth;
      ctx.save();
      if (!isWon) ctx.filter = "brightness(0.62) saturate(0.8)";
      ctx.drawImage(courier, 24, 528 - ph, pw, ph);
      ctx.restore();
    }

    const cardX = 210, cardY = 78, cardW = 652, cardH = 390;
    const mid = cardX + cardW / 2;
    ctx.fillStyle = "rgba(12, 16, 30, 0.9)";
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 14);
    ctx.fill();
    ctx.strokeStyle = isWon ? "rgba(232, 188, 106, 0.85)" : "rgba(196, 154, 122, 0.55)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.font = "900 36px 'Kaisei Decol', 'Noto Sans JP', serif";
    ctx.fillStyle = isWon ? "#ffe0a4" : "#f0c2bc";
    ctx.fillText(isWon ? "夜已破曉" : "燈油已盡", mid, cardY + 52);
    ctx.font = "700 14px 'Zen Maru Gothic', sans-serif";
    ctx.fillStyle = "rgba(255, 236, 214, 0.72)";
    ctx.fillText(isWon ? "這一夜的配達，送到天明" : "燈滅了，路還留在原處", mid, cardY + 78);

    ctx.strokeStyle = "rgba(232, 188, 106, 0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cardX + 48, cardY + 98);
    ctx.lineTo(cardX + cardW - 48, cardY + 98);
    ctx.stroke();

    ctx.font = "700 13px 'Zen Maru Gothic', sans-serif";
    ctx.fillStyle = "rgba(255, 226, 180, 0.7)";
    ctx.fillText("今夜功績", mid, cardY + 128);
    ctx.font = "900 54px 'Kaisei Decol', serif";
    ctx.fillStyle = "#fff1cc";
    ctx.fillText(score.toLocaleString(), mid, cardY + 186);

    ctx.font = "700 18px 'Zen Maru Gothic', sans-serif";
    ctx.fillStyle = "#f4e7cf";
    ctx.fillText(`送達  ${delivered} 件`, mid - 110, cardY + 232);
    ctx.fillStyle = failed > 0 ? "#f0b8b4" : "#f4e7cf";
    ctx.fillText(`誤配  ${failed} 件`, mid + 110, cardY + 232);

    const reviewList = [...new Map((misses || []).map(w => [w.jp, w])).values()].slice(0, 5);
    ctx.font = "700 15px 'Zen Maru Gothic', 'Noto Sans JP', sans-serif";
    if (reviewList.length > 0) {
      ctx.fillStyle = "rgba(255, 214, 196, 0.86)";
      ctx.fillText("今夜記錯的字", mid, cardY + 278);
      ctx.font = "700 16px 'Noto Sans JP', sans-serif";
      ctx.fillStyle = "#fff6ea";
      const parts = reviewList.map(w => `${w.jp}（${w.zh}）`);
      let line = "";
      let lineY = cardY + 308;
      parts.forEach(part => {
        const next = line ? `${line}　　${part}` : part;
        if (line && ctx.measureText(next).width > cardW - 80) {
          ctx.fillText(line, mid, lineY);
          line = part;
          lineY += 24;
        } else {
          line = next;
        }
      });
      if (line) ctx.fillText(line, mid, lineY);
    } else {
      ctx.fillStyle = "rgba(255, 236, 214, 0.82)";
      const note = delivered >= 3 ? "送出的包裹，今夜都送到了" : delivered > 0 ? "送出去的，都沒有送錯" : "這一路還沒把包裹送出去";
      ctx.fillText(note, mid, cardY + 292);
    }

    const bx = RESTART_BTN.x, by = RESTART_BTN.y, btnW = RESTART_BTN.w, btnH = RESTART_BTN.h;
    ctx.fillStyle = "#1a140e";
    ctx.beginPath();
    ctx.roundRect(bx, by, btnW, btnH, 8);
    ctx.fill();
    ctx.strokeStyle = "#e6c27a";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "#ffe3ad";
    ctx.font = "900 18px 'Kaisei Decol', 'Noto Sans JP', serif";
    ctx.fillText("再踏夜行", bx + btnW / 2, by + 31);

    ctx.restore();
  }

  // 7. 暫停與系統設定選單 (日式黑漆金箔和風御札)
  const PAUSE_BTNS = [
    { id: "resume", label: "◆ 繼 續 夜 行 ◆", y: 195 },
    { id: "cards", label: "◆ 秘 術 卡 片 一 覽 ◆", y: 255 },
    { id: "codex", label: "◆ 百 鬼 單 字 卷 ◆", y: 315 },
    { id: "mute", label: "◆ 聲 音 音 效 ： 開 ◆", labelMuted: "◆ 聲 音 音 效 ： 關 ◆", y: 375 },
    { id: "menu", label: "◆ 返 回 主 選 單 ◆", y: 435 }
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
    ctx.fillText("— 暫 歇 —", W / 2, 138);
    ctx.shadowBlur = 0;

    ctx.font = "bold 12px 'Noto Sans JP', sans-serif";
    ctx.fillStyle = "rgba(255, 235, 180, 0.55)";
    ctx.fillText("SYSTEM PAUSE", W / 2, 164);

    const btnW = 280, btnH = 44;
    const bx = W / 2 - btnW / 2;

    PAUSE_BTNS.forEach(b => {
      let label = b.label;
      if (b.id === "mute") {
        label = muted ? b.labelMuted : b.label;
      }
      glassBox(ctx, bx, b.y, btnW, btnH, 10, "rgba(18, 22, 36, 0.95)", "rgba(212, 175, 55, 0.8)", 1.6);
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffeed4";
      ctx.font = "900 15px 'Zen Maru Gothic', 'Noto Sans JP', sans-serif";
      ctx.fillText(label, W / 2, b.y + 28);
    });

    ctx.fillStyle = "rgba(255, 235, 180, 0.45)";
    ctx.font = "12px 'Noto Sans JP', sans-serif";
    ctx.fillText("[ 按 ESC 或 P 鍵返回夜行 ]", W / 2, 515);

    ctx.restore();
  }

  // 6. 百鬼夜行 3 次閃爍警報匾額與全螢幕紅光警戒 (Surge Warning Banner)
  function drawSurgeWarning(ctx, surgeWarningT) {
    if (surgeWarningT <= 0) return;
    ctx.save();
    const totalDuration = 2.4;
    const cycleDuration = 0.8;
    const progress = Math.max(0, totalDuration - surgeWarningT);
    const cycle = Math.min(3, Math.floor(progress / cycleDuration) + 1);
    const phase = (progress % cycleDuration) / cycleDuration;
    // 0~1 的平滑閃爍光波
    const flashBrightness = Math.sin(phase * Math.PI);
    const alpha = Math.max(0.18, flashBrightness);

    // 1. 全螢幕四邊暗紅警戒警報光暈
    ctx.strokeStyle = `rgba(255, 30, 30, ${alpha * 0.85})`;
    ctx.lineWidth = 14;
    ctx.strokeRect(0, 0, W, H);

    ctx.fillStyle = `rgba(255, 20, 20, ${alpha * 0.14})`;
    ctx.fillRect(0, 0, W, H);

    // 2. 中央神社朱漆警報木匾
    const bw = 460, bh = 72;
    const bx = W / 2 - bw / 2, by = 110;

    ctx.shadowColor = `rgba(255, 40, 40, ${alpha * 0.95})`;
    ctx.shadowBlur = 22;

    const bgGrad = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
    bgGrad.addColorStop(0, "rgba(42, 8, 12, 0.96)");
    bgGrad.addColorStop(0.5, "rgba(68, 14, 20, 0.96)");
    bgGrad.addColorStop(1, "rgba(35, 6, 10, 0.96)");
    glassBox(ctx, bx, by, bw, bh, 10, bgGrad, `rgba(255, 70, 70, ${alpha})`, 2.5);

    ctx.shadowBlur = 0;

    // 警報角標 [ 預警 1/3 ]
    ctx.fillStyle = "#ffd54f";
    ctx.beginPath();
    ctx.roundRect(bx + bw - 100, by + 10, 88, 22, 5);
    ctx.fill();
    ctx.fillStyle = "#160608";
    ctx.font = "900 12px 'Zen Maru Gothic', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`警報 ${cycle} / 3`, bx + bw - 56, by + 25);

    // 主標題
    ctx.textAlign = "center";
    ctx.font = "900 24px 'Kaisei Decol', serif";
    ctx.fillStyle = "#fff2a8";
    ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
    ctx.shadowBlur = 6;
    ctx.fillText("⚠ 警 報 ・ 百 鬼 夜 行 ⚠", bx + bw / 2 - 25, by + 33);
    ctx.shadowBlur = 0;

    // 副標題
    ctx.font = "900 13px 'Zen Maru Gothic', 'Noto Sans JP', sans-serif";
    ctx.fillStyle = "#ffcdd2";
    ctx.fillText("— 妖 氣 逼 近 ！ 請 準 備 迎 戰 —", W / 2, by + 57);

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
    drawSurgeWarning,
    PAUSE_BTNS,
    PAUSE_BTN_W: 280,
    PAUSE_BTN_H: 44,
    RESTART_BTN,
    MENU_START_BTN,
    HINT_BTN,
    CARD_LIST
  };
})();
