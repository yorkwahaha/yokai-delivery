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
    if (window.ART.cover) {
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
    ctx.fillStyle = "#ffeed4";
    ctx.font = "900 22px 'Zen Maru Gothic', sans-serif";
    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.shadowBlur = 10;
    ctx.fillText("百鬼橫行之夜・單字配達物語", W / 2, 385);

    // 核心操作導引
    glassBox(ctx, W / 2 - 320, 412, 640, 92, 12, "rgba(18, 22, 36, 0.9)", "#d4af37", 2);
    ctx.font = "bold 15px 'Noto Sans JP', sans-serif";
    ctx.fillStyle = "#dfe8ff";
    ctx.fillText("【取貨】到各家町屋門口按 E，記住日文單字　【送貨】在正確名字圈內站 0.5 秒", W / 2, 440);
    ctx.fillText("【戰鬥】妖刀自動連斬四周妖怪　【衝刺】Shift 或 觸控鍵　【燈油】送貨補充", W / 2, 464);
    ctx.fillStyle = "#ffd27a";
    ctx.font = "bold 14px 'Noto Sans JP', sans-serif";
    ctx.fillText("WASD 移動　H 提示(-3油)　M 靜音　C 妖怪單字圖鑑", W / 2, 488);

    const blink = 0.65 + 0.35 * Math.sin(elapsed * 5);
    ctx.fillStyle = `rgba(255, 230, 150, ${blink})`;
    ctx.font = "900 25px 'Kaisei Decol', 'Noto Sans JP', serif";
    ctx.fillText("— 按 ENTER 或 點擊任意處開始夜行 —", W / 2, 545);

    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.font = "14px 'Noto Sans JP', sans-serif";
    ctx.fillText(`最高得分：${STORE.data.best || 0}　最高送達：${STORE.data.bestDel || 0} 件`, W / 2, 580);

    glassBox(ctx, W - 145, 22, 125, 38, 8, "rgba(24, 30, 52, 0.9)", "#e3b35d", 2);
    ctx.fillStyle = "#ffeed4";
    ctx.font = "bold 15px 'Zen Maru Gothic', sans-serif";
    ctx.fillText("📖 單字圖鑑 [C]", W - 82, 47);

    ctx.restore();
  }

  // 2. 全螢幕專業無分割 HUD（懸浮微型儀表 + 底部 HoloCure 風格武器格）
  function drawHud(ctx, P, oil, elapsed, dawnTime, delivered, failed, score, level, xp, xpNeed, job, hintT, orders, inter, bossQ, touch, joy, btnE, btnD, WL, WI, b) {
    ctx.save();

    // 注意：完全移除頂部深色橫條！遊戲世界 100% 全螢幕通透顯示！

    // --- 左上角：玩家生存狀態懸浮艙 (Health & Oil) ---
    const pBoxX = 18, pBoxY = 14, pBoxW = 205, pBoxH = 50;
    glassBox(ctx, pBoxX, pBoxY, pBoxW, pBoxH, 10);

    // 生命值條
    ctx.textAlign = "left";
    ctx.font = "15px sans-serif";
    ctx.fillText("❤️", pBoxX + 8, pBoxY + 20);

    const hpBarW = 100, hpBarH = 10;
    ctx.fillStyle = "#1e141a";
    ctx.beginPath();
    ctx.roundRect(pBoxX + 32, pBoxY + 11, hpBarW, hpBarH, 4);
    ctx.fill();

    const hpRatio = Math.max(0, Math.min(1, P.hp / P.maxHp));
    const hpGrad = ctx.createLinearGradient(pBoxX + 32, 0, pBoxX + 32 + hpBarW, 0);
    hpGrad.addColorStop(0, "#e83a54");
    hpGrad.addColorStop(1, "#ff6b8b");
    if (hpRatio > 0) {
      ctx.fillStyle = hpGrad;
      ctx.beginPath();
      ctx.roundRect(pBoxX + 32, pBoxY + 11, hpBarW * hpRatio, hpBarH, 4);
      ctx.fill();
    }
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 12px 'Zen Maru Gothic', sans-serif";
    ctx.fillText(`${P.hp}/${P.maxHp}`, pBoxX + 140, pBoxY + 20);

    // 提燈油量條
    ctx.font = "16px sans-serif";
    ctx.fillText("🏮", pBoxX + 7, pBoxY + 41);

    const oilBarW = 100, oilBarH = 10;
    ctx.fillStyle = "#1c1814";
    ctx.beginPath();
    ctx.roundRect(pBoxX + 32, pBoxY + 31, oilBarW, oilBarH, 4);
    ctx.fill();

    const oilRatio = Math.max(0, Math.min(1, oil / 100));
    const oilGrad = ctx.createLinearGradient(pBoxX + 32, 0, pBoxX + 32 + oilBarW, 0);
    if (oil < 25) {
      oilGrad.addColorStop(0, "#ff4343");
      oilGrad.addColorStop(1, "#ff8843");
    } else {
      oilGrad.addColorStop(0, "#ffaa33");
      oilGrad.addColorStop(1, "#ffd554");
    }
    if (oilRatio > 0) {
      ctx.fillStyle = oilGrad;
      ctx.beginPath();
      ctx.roundRect(pBoxX + 32, pBoxY + 31, oilBarW * oilRatio, oilBarH, 4);
      ctx.fill();
    }
    ctx.fillStyle = "#ffeed4";
    ctx.font = "900 12px 'Zen Maru Gothic', sans-serif";
    ctx.fillText(`${Math.ceil(oil)}%`, pBoxX + 140, pBoxY + 41);

    // --- 右上角：進度與等級懸浮艙 (Level, Dawn & Score) ---
    const sBoxW = 210, sBoxH = 50;
    const sBoxX = W - sBoxW - 18, sBoxY = 14;
    glassBox(ctx, sBoxX, sBoxY, sBoxW, sBoxH, 10);

    // 等級與經驗
    ctx.font = "900 13px 'Zen Maru Gothic', sans-serif";
    ctx.fillStyle = "#40c4ff";
    ctx.fillText(`Lv.${level}`, sBoxX + 10, sBoxY + 20);

    const xpBarW = 100, xpBarH = 8;
    ctx.fillStyle = "#151b27";
    ctx.beginPath();
    ctx.roundRect(sBoxX + 46, sBoxY + 12, xpBarW, xpBarH, 4);
    ctx.fill();
    const xpRatio = Math.min(1, xp / xpNeed);
    if (xpRatio > 0) {
      ctx.fillStyle = "#40c4ff";
      ctx.beginPath();
      ctx.roundRect(sBoxX + 46, sBoxY + 12, xpBarW * xpRatio, xpBarH, 4);
      ctx.fill();
    }

    // 黎明天盤進度
    const dawnProgress = Math.min(1, elapsed / dawnTime);
    ctx.font = "14px sans-serif";
    ctx.fillText("🌙", sBoxX + 154, sBoxY + 20);
    const miniDawnW = 32, miniDawnH = 6;
    ctx.fillStyle = "#222a3d";
    ctx.beginPath();
    ctx.roundRect(sBoxX + 172, sBoxY + 13, miniDawnW, miniDawnH, 3);
    ctx.fill();
    ctx.fillStyle = "#ffa726";
    ctx.beginPath();
    ctx.roundRect(sBoxX + 172, sBoxY + 13, miniDawnW * dawnProgress, miniDawnH, 3);
    ctx.fill();

    // 配達與得分（精簡無文字贅述）
    ctx.fillStyle = "#ffeed4";
    ctx.font = "bold 13px 'Noto Sans JP', sans-serif";
    ctx.fillText(`📦 ${delivered}  |  ★ ${score}`, sBoxX + 12, sBoxY + 41);

    // 快捷鍵極簡小標籤
    ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
    ctx.font = "11px sans-serif";
    ctx.fillText("H提示 M靜音 C圖鑑", sBoxX + 115, sBoxY + 41);

    // --- 中央：進行中任務簡約金標（無任務時完全不擋視野） ---
    if (job) {
      const jBoxW = 320, jBoxH = 34;
      const jBoxX = W / 2 - jBoxW / 2, jBoxY = 16;
      glassBox(ctx, jBoxX, jBoxY, jBoxW, jBoxH, 8, "rgba(24, 16, 36, 0.9)", "#d4af37", 1.5);
      ctx.textAlign = "center";
      ctx.font = "900 15px 'Zen Maru Gothic', sans-serif";
      ctx.fillStyle = "#ffe699";
      if (job.rev) {
        ctx.fillText(`📜「${job.word.jp}」➔ 送往「${job.to.word.jp}」`, W / 2, jBoxY + 22);
      } else {
        const hintStr = hintT > 0 ? ` (${job.word.zh})` : "";
        ctx.fillText(`📦 ${job.word.icon} ${job.word.jp} ➔ 送往「${job.to.word.jp}」${hintStr}`, W / 2, jBoxY + 22);
      }
    }

    // --- 左下角：HoloCure 風格【武器與被動技能圖標欄】（完全無文字，純圖標+等級） ---
    const slotStartX = 18, slotY = H - 52;
    const wepList = [
      { key: "katana", icon: "🗡️", color: "#ffd54f" },
      { key: "boom", icon: "📜", color: "#80d8ff" },
      { key: "fire", icon: "🔥", color: "#ff8a80" },
      { key: "thunder", icon: "⚡", color: "#ea80fc" }
    ];

    wepList.forEach((wep, idx) => {
      const sx = slotStartX + idx * 44;
      const lvl = WL[wep.key];
      const isUnlocked = lvl > 0;

      // 裝備卡槽底座
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(sx, slotY, 38, 38, 8);
      ctx.fillStyle = isUnlocked ? "rgba(22, 28, 48, 0.88)" : "rgba(14, 16, 24, 0.55)";
      ctx.fill();
      ctx.strokeStyle = isUnlocked ? wep.color : "rgba(80, 95, 130, 0.4)";
      ctx.lineWidth = isUnlocked ? 2 : 1;
      ctx.stroke();

      // 圖標
      ctx.textAlign = "center";
      ctx.font = "20px sans-serif";
      ctx.globalAlpha = isUnlocked ? 1.0 : 0.3;
      ctx.fillText(wep.icon, sx + 19, slotY + 26);

      // 角落等級數字標記 (Lv.X)
      if (isUnlocked) {
        ctx.fillStyle = "#d4af37";
        ctx.beginPath();
        ctx.roundRect(sx + 18, slotY + 23, 19, 14, 4);
        ctx.fill();
        ctx.fillStyle = "#161022";
        ctx.font = "900 10px sans-serif";
        ctx.fillText(lvl >= 5 ? "MAX" : `L${lvl}`, sx + 27, slotY + 34);
      }
      ctx.restore();
    });

    // 被動能力小型圖標欄 (磁鐵, 衝刺, 攻擊)
    const passives = [
      { icon: "🧲", lvl: b.mag, max: 3 },
      { icon: "👟", lvl: b.dash, max: 3 },
      { icon: "⚔️", lvl: Math.round(b.dmg), max: 9 }
    ];
    passives.forEach((pas, pIdx) => {
      const px = slotStartX + 184 + pIdx * 34;
      const isUp = pas.lvl > (pas.icon === "⚔️" ? 1 : 0);
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(px, slotY + 6, 28, 28, 6);
      ctx.fillStyle = isUp ? "rgba(30, 36, 56, 0.85)" : "rgba(16, 18, 26, 0.45)";
      ctx.fill();
      ctx.strokeStyle = isUp ? "#c29d5b" : "rgba(70, 80, 105, 0.35)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.textAlign = "center";
      ctx.font = "15px sans-serif";
      ctx.globalAlpha = isUp ? 1.0 : 0.35;
      ctx.fillText(pas.icon, px + 14, slotY + 25);
      ctx.restore();
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

  // 3. 升級選卡視窗（HoloCure 風格 3D 浮雕金箔卡牌）
  function drawLevelUp(ctx, level, choices) {
    ctx.save();
    ctx.fillStyle = "rgba(8, 12, 22, 0.92)";
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = "center";
    ctx.font = "900 34px 'Kaisei Decol', 'Noto Sans JP', serif";
    ctx.fillStyle = "#ffe28b";
    ctx.shadowColor = "rgba(255, 215, 100, 0.7)";
    ctx.shadowBlur = 14;
    ctx.fillText(`— 秘術覺醒・等級提升 Lv.${level} —`, W / 2, 115);

    ctx.shadowBlur = 0;
    ctx.font = "900 16px 'Zen Maru Gothic', sans-serif";
    ctx.fillStyle = "#cad7f5";
    ctx.fillText("選擇一項秘術以增強夜行妖力（點擊卡牌 或 按數字鍵 1 / 2 / 3）", W / 2, 150);

    const cardW = 240, cardH = 350;
    const startX = 65, gap = 40;

    choices.forEach((c, i) => {
      const cx = startX + i * (cardW + gap);
      const cy = 180;

      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.beginPath();
      ctx.roundRect(cx + 6, cy + 8, cardW, cardH, 16);
      ctx.fill();

      const cardGrad = ctx.createLinearGradient(cx, cy, cx + cardW, cy + cardH);
      cardGrad.addColorStop(0, "#232b42");
      cardGrad.addColorStop(0.5, "#161c2d");
      cardGrad.addColorStop(1, "#101422");

      glassBox(ctx, cx, cy, cardW, cardH, 16, cardGrad, "#d4af37", 3);

      glassBox(ctx, cx + 16, cy + 18, cardW - 32, 32, 8, "#2e3957", null);
      ctx.fillStyle = "#ffe28b";
      ctx.font = "900 15px 'Zen Maru Gothic', sans-serif";
      ctx.fillText(c.s ? `[ ${c.s} ]` : "[ 強化秘術 ]", cx + cardW / 2, cy + 40);

      ctx.font = "900 24px 'Kaisei Decol', 'Noto Sans JP', serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(c.n, cx + cardW / 2, cy + 115);

      ctx.font = "bold 16px 'Noto Sans JP', sans-serif";
      ctx.fillStyle = "#b8cbfa";
      ctx.fillText(c.d, cx + cardW / 2, cy + 195);

      glassBox(ctx, cx + cardW / 2 - 28, cy + cardH - 58, 56, 36, 10, "#d4af37", "#ffffff", 1.5);
      ctx.fillStyle = "#1a162b";
      ctx.font = "900 20px sans-serif";
      ctx.fillText(String(i + 1), cx + cardW / 2, cy + cardH - 33);
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

  // 6. 結算畫面
  function drawEndScreen(ctx, state, score, delivered, failed, misses) {
    ctx.save();
    ctx.fillStyle = "rgba(8, 12, 22, 0.94)";
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = "center";
    const isWon = state === "won";

    ctx.font = "900 36px 'Kaisei Decol', 'Noto Sans JP', serif";
    ctx.fillStyle = isWon ? "#ffe28b" : "#ff6b81";
    ctx.fillText(isWon ? "🌅 平安迎向黎明！百鬼皆散！" : "🏮 燈油燃盡…黑夜吞沒了街區", W / 2, 175);

    ctx.font = "900 21px 'Zen Maru Gothic', sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`本次夜行得分：${score} 分`, W / 2, 235);
    ctx.fillText(`成功送達：${delivered} 件　失誤：${failed} 次`, W / 2, 270);

    const reviewList = [...new Map(misses.map(w => [w.jp, w])).values()].slice(0, 6);
    if (reviewList.length > 0) {
      glassBox(ctx, W / 2 - 280, 310, 560, 84, 12, "#201c30", "#d4af37", 1.5);
      ctx.fillStyle = "#ffeed4";
      ctx.font = "900 15px 'Noto Sans JP', sans-serif";
      ctx.fillText("【本次需要複習的單字】", W / 2, 338);
      ctx.fillStyle = "#ffd152";
      const wStr = reviewList.map(w => `${w.icon}${w.jp}＝${w.zh}`).join("　");
      ctx.fillText(wStr, W / 2, 368);
    } else {
      ctx.fillStyle = "#ffe28b";
      ctx.font = "900 18px 'Noto Sans JP', sans-serif";
      ctx.fillText("✨ 全數正確送達！妖怪快遞傳奇！", W / 2, 345);
    }

    ctx.fillStyle = "#ffe28b";
    ctx.font = "900 22px 'Zen Maru Gothic', sans-serif";
    ctx.fillText("— 按 ENTER 或 點擊任意處再跑一趟 —", W / 2, 450);

    ctx.restore();
  }

  return {
    drawMainMenu,
    drawHud,
    drawLevelUp,
    drawBossQuiz,
    drawCodex,
    drawEndScreen
  };
})();
