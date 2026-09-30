// 使用者介面（UI）：商業級和風黑漆金箔繪卷 HUD、HoloCure 風格 3D 浮雕卡牌、黎明天球儀與高級圖鑑
window.UI = (() => {
  const W = 900, H = 600;

  // 輔助繪圖：日式黑漆金箔圓角框
  function lacquerBox(ctx, x, y, w, h, r = 8, fill = "#141824", stroke = "#d4af37", strokeW = 2) {
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
    // 繪製商業級封面圖（帶微幅縮放呼吸感）
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

    // 豪華黑漆暗角與日式繪卷底紋
    const vig = ctx.createLinearGradient(0, 0, 0, H);
    vig.addColorStop(0, "rgba(6, 9, 20, 0.45)");
    vig.addColorStop(0.6, "rgba(6, 9, 20, 0.65)");
    vig.addColorStop(1, "rgba(6, 9, 20, 0.96)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    // 遊戲副標題與和風特色
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffeed4";
    ctx.font = "900 22px 'Zen Maru Gothic', sans-serif";
    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.shadowBlur = 10;
    ctx.fillText("百鬼橫行之夜・單字配達物語", W / 2, 385);

    // 核心玩法導引卡 (黑漆金邊)
    lacquerBox(ctx, W / 2 - 330, 412, 660, 94, 12, "rgba(18, 22, 36, 0.9)", "#d4af37", 2);
    ctx.font = "bold 15px 'Noto Sans JP', sans-serif";
    ctx.fillStyle = "#dfe8ff";
    ctx.fillText("【取貨】到各家町屋門口按 E，記住日文單字　【送貨】在正確名字圈內站 0.5 秒", W / 2, 440);
    ctx.fillText("【戰鬥】妖刀自動連斬周圍妖怪　【衝刺】Shift 或 觸控鍵　【燈油】送貨補充", W / 2, 464);
    ctx.fillStyle = "#ffd27a";
    ctx.font = "bold 14px 'Noto Sans JP', sans-serif";
    ctx.fillText("WASD 移動　H 提示(-3油)　M 靜音　C 妖怪單字圖鑑", W / 2, 488);

    // 開始提示（呼吸金色光芒）
    const blink = 0.65 + 0.35 * Math.sin(elapsed * 5);
    ctx.fillStyle = `rgba(255, 230, 150, ${blink})`;
    ctx.font = "900 25px 'Kaisei Decol', 'Noto Sans JP', serif";
    ctx.fillText("— 按 ENTER 或 點擊任意處開始夜行 —", W / 2, 545);

    // 最佳紀錄金牌
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.font = "14px 'Noto Sans JP', sans-serif";
    ctx.fillText(`最高得分：${STORE.data.best || 0}　最高送達：${STORE.data.bestDel || 0} 件`, W / 2, 580);

    // 圖鑑按鈕
    lacquerBox(ctx, W - 145, 22, 125, 38, 8, "rgba(24, 30, 52, 0.9)", "#e3b35d", 2);
    ctx.fillStyle = "#ffeed4";
    ctx.font = "bold 15px 'Zen Maru Gothic', sans-serif";
    ctx.fillText("📖 單字圖鑑 [C]", W - 82, 47);

    ctx.restore();
  }

  // 2. 遊戲主畫面 HUD（商業級和風黑漆金箔儀表板）
  function drawHud(ctx, P, oil, elapsed, dawnTime, delivered, failed, score, level, xp, xpNeed, job, hintT, orders, inter, bossQ, touch, joy, btnE, btnD, WL, WI) {
    ctx.save();

    // 頂部主面板 (黑漆底 + 金色雲紋頂線)
    const hudGrad = ctx.createLinearGradient(0, 0, 0, 80);
    hudGrad.addColorStop(0, "rgba(10, 13, 24, 0.98)");
    hudGrad.addColorStop(1, "rgba(10, 13, 24, 0.85)");
    ctx.fillStyle = hudGrad;
    ctx.fillRect(0, 0, W, 76);

    // 金箔金屬線條
    ctx.fillStyle = "#d4af37";
    ctx.fillRect(0, 75, W, 2);
    ctx.fillStyle = "rgba(212, 175, 55, 0.35)";
    ctx.fillRect(0, 77, W, 1);

    // --- 左側：提燈油量槽 (立體液態槽 + 燃燒火光) ---
    ctx.textAlign = "left";
    ctx.font = "26px sans-serif";
    ctx.fillText("🏮", 16, 38);

    const oilW = 160, oilH = 16;
    // 槽底
    lacquerBox(ctx, 50, 22, oilW, oilH, 8, "#1a1622", "#3a3648", 1.5);
    const oilRatio = Math.max(0, Math.min(1, oil / 100));

    // 液態漸層
    const oilGrad = ctx.createLinearGradient(50, 0, 50 + oilW, 0);
    if (oil < 25) {
      oilGrad.addColorStop(0, "#ff4343");
      oilGrad.addColorStop(1, "#ff8843");
    } else {
      oilGrad.addColorStop(0, "#ffaa33");
      oilGrad.addColorStop(1, "#ffd554");
    }
    if (oilRatio > 0) {
      ctx.save();
      ctx.fillStyle = oilGrad;
      ctx.beginPath();
      ctx.roundRect(50, 22, oilW * oilRatio, oilH, 8);
      ctx.fill();
      ctx.restore();
    }
    // 燈油百分比
    ctx.font = "900 12px 'Zen Maru Gothic', sans-serif";
    ctx.fillStyle = "#ffeed4";
    ctx.fillText(`燈油 ${Math.ceil(oil)}%`, 58, 52);

    // 低燈油警示邊緣呼吸燈
    if (oil < 25) {
      const pulse = 0.3 + 0.3 * Math.sin(elapsed * 8);
      ctx.fillStyle = `rgba(255, 50, 50, ${pulse * 0.4})`;
      ctx.fillRect(0, 0, W, 4);
    }

    // --- 生命值：日式勾玉心之容器 (Magatama) ---
    ctx.font = "20px sans-serif";
    ctx.fillText("❤️", 230, 36);

    const hpW = 95, hpH = 16;
    lacquerBox(ctx, 258, 22, hpW, hpH, 8, "#1a1622", "#3a3648", 1.5);
    const hpRatio = Math.max(0, Math.min(1, P.hp / P.maxHp));
    const hpGrad = ctx.createLinearGradient(258, 0, 258 + hpW, 0);
    hpGrad.addColorStop(0, "#e83a54");
    hpGrad.addColorStop(1, "#ff6b8b");
    if (hpRatio > 0) {
      ctx.fillStyle = hpGrad;
      ctx.beginPath();
      ctx.roundRect(258, 22, hpW * hpRatio, hpH, 8);
      ctx.fill();
    }
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 12px 'Zen Maru Gothic', sans-serif";
    ctx.fillText(`${P.hp}/${P.maxHp}`, 286, 35);

    // --- 中間：配達統計 ---
    ctx.fillStyle = "#dfe8ff";
    ctx.font = "900 15px 'Zen Maru Gothic', sans-serif";
    ctx.fillText(`已送達：${delivered} 件`, 375, 29);
    ctx.fillStyle = "#b8c9f0";
    ctx.font = "bold 13px 'Noto Sans JP', sans-serif";
    ctx.fillText(`失誤：${failed} 次  |  得分：${score}`, 375, 50);

    // --- 右側：黎明天球儀 (日夜進度) 與靈玉經驗條 ---
    const dawnProgress = Math.min(1, elapsed / dawnTime);
    ctx.font = "18px sans-serif";
    ctx.fillText("🌙", 535, 36);

    const dawnW = 135, dawnH = 10;
    lacquerBox(ctx, 560, 24, dawnW, dawnH, 5, "#1a1e2b", "#364157", 1);
    const dawnGrad = ctx.createLinearGradient(560, 0, 560 + dawnW, 0);
    dawnGrad.addColorStop(0, "#7488b0");
    dawnGrad.addColorStop(1, "#ffa726");
    lacquerBox(ctx, 560, 24, dawnW * dawnProgress, dawnH, 5, dawnGrad);
    ctx.fillText("🌅", 702, 36);

    // 靈氣經驗條
    const xpRatio = Math.min(1, xp / xpNeed);
    lacquerBox(ctx, 560, 42, dawnW, 8, 4, "#151b27", "#27344a", 1);
    lacquerBox(ctx, 560, 42, dawnW * xpRatio, 8, 4, "#40c4ff");

    ctx.fillStyle = "#40c4ff";
    ctx.font = "900 13px 'Zen Maru Gothic', sans-serif";
    ctx.fillText(`Lv.${level}`, 702, 50);

    // 快捷鍵提示窗
    lacquerBox(ctx, 755, 14, 130, 48, 8, "rgba(22, 28, 46, 0.8)", "#3a4b73", 1);
    ctx.fillStyle = "#ffeed4";
    ctx.font = "bold 12px 'Noto Sans JP', sans-serif";
    ctx.fillText("H：看中文(-3油)", 764, 32);
    ctx.fillText("M：靜音  C：圖鑑", 764, 50);

    // --- 中央懸掛式任務木札 (絵馬 / 配送卷軸) ---
    const bannerY = 88;
    if (job) {
      lacquerBox(ctx, W / 2 - 250, bannerY, 500, 38, 10, "rgba(22, 16, 36, 0.95)", "#d4af37", 2);
      ctx.textAlign = "center";
      ctx.font = "900 15px 'Zen Maru Gothic', sans-serif";
      ctx.fillStyle = "#ffe699";
      if (job.rev) {
        ctx.fillText(`📜【句子委託】：「${job.word.jp}をください」 ➔ 送往「${job.to.word.jp}」站圈選圖案`, W / 2, bannerY + 24);
      } else {
        const hintStr = hintT > 0 ? `（${job.word.zh}）` : "";
        ctx.fillText(`📦【已打包】➔ 送往「${job.to.word.jp}」站圈 0.5 秒選出日文名 ${hintStr}`, W / 2, bannerY + 24);
      }
    } else {
      lacquerBox(ctx, W / 2 - 220, bannerY, 440, 34, 8, "rgba(16, 22, 38, 0.9)", "#4d6294", 1.5);
      ctx.textAlign = "center";
      ctx.font = "bold 14px 'Noto Sans JP', sans-serif";
      ctx.fillStyle = "#dfe8ff";
      ctx.fillText("⛩ 尋找屋頂有委託氣泡的町屋，門口按 E 取貨", W / 2, bannerY + 22);
    }

    // 左下角：裝備武器欄（金箔木盒）
    lacquerBox(ctx, 16, H - 44, 330, 30, 8, "rgba(16, 20, 34, 0.92)", "#d4af37", 1.5);
    ctx.textAlign = "left";
    ctx.font = "900 13px 'Zen Maru Gothic', sans-serif";
    ctx.fillStyle = "#ffe28b";
    const wepText = Object.keys(WI)
      .filter(k => WL[k] > 0)
      .map(k => `${WI[k].zh} Lv.${WL[k]}`)
      .join("   |   ");
    ctx.fillText(wepText || "妖刀斬 Lv.1", 28, H - 24);

    // 觸控虛擬搖桿與按鈕
    if (touch) {
      ctx.save();
      // 衝刺鈕
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      ctx.beginPath();
      ctx.arc(btnD.x, btnD.y, btnD.r, 0, 6.28);
      ctx.fill();
      ctx.textAlign = "center";
      ctx.fillStyle = "#1e2436";
      ctx.font = "900 16px 'Zen Maru Gothic', sans-serif";
      ctx.fillText("衝刺", btnD.x, btnD.y + 6);

      // 取貨鈕
      if (inter) {
        ctx.fillStyle = "rgba(255, 210, 80, 0.85)";
        ctx.beginPath();
        ctx.arc(btnE.x, btnE.y, btnE.r, 0, 6.28);
        ctx.fill();
        ctx.fillStyle = "#1e2436";
        ctx.fillText("取貨", btnE.x, btnE.y + 6);
      }

      // 虛擬方向搖桿
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
    // 半透明黑漆屏風底
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

    // 三張立體浮雕卡牌
    const cardW = 240, cardH = 350;
    const startX = 65, gap = 40;

    choices.forEach((c, i) => {
      const cx = startX + i * (cardW + gap);
      const cy = 180;

      // 卡牌底層陰影
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.beginPath();
      ctx.roundRect(cx + 6, cy + 8, cardW, cardH, 16);
      ctx.fill();

      // 卡牌漸層底框
      const cardGrad = ctx.createLinearGradient(cx, cy, cx + cardW, cy + cardH);
      cardGrad.addColorStop(0, "#232b42");
      cardGrad.addColorStop(0.5, "#161c2d");
      cardGrad.addColorStop(1, "#101422");

      lacquerBox(ctx, cx, cy, cardW, cardH, 16, cardGrad, "#d4af37", 3);

      // 卡牌頂部稀有度籤條
      lacquerBox(ctx, cx + 16, cy + 18, cardW - 32, 32, 8, "#2e3957", null);
      ctx.fillStyle = "#ffe28b";
      ctx.font = "900 15px 'Zen Maru Gothic', sans-serif";
      ctx.fillText(c.s ? `[ ${c.s} ]` : "[ 強化秘術 ]", cx + cardW / 2, cy + 40);

      // 卡牌名稱（書法大字）
      ctx.font = "900 24px 'Kaisei Decol', 'Noto Sans JP', serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(c.n, cx + cardW / 2, cy + 115);

      // 說明描述
      ctx.font = "bold 16px 'Noto Sans JP', sans-serif";
      ctx.fillStyle = "#b8cbfa";
      ctx.fillText(c.d, cx + cardW / 2, cy + 195);

      // 底部快捷按鍵鈕
      lacquerBox(ctx, cx + cardW / 2 - 28, cy + cardH - 58, 56, 36, 10, "#d4af37", "#ffffff", 1.5);
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

    lacquerBox(ctx, bx, by, boxW, boxH, 16, "rgba(20, 14, 34, 0.98)", "#ff5470", 2.5);

    ctx.textAlign = "center";
    ctx.font = "900 19px 'Kaisei Decol', 'Noto Sans JP', serif";
    ctx.fillStyle = "#ffeed4";
    ctx.fillText(`🛡【大妖鬼結界】：${bossQ.word.icon} 的日文名是？（按 1 / 2 / 3 或點選破防）`, W / 2, by + 30);

    const optW = 200, optH = 46;
    bossQ.ans.forEach((w, i) => {
      const ox = bx + 22 + i * (optW + 24);
      const oy = by + 46;
      lacquerBox(ctx, ox, oy, optW, optH, 10, bossQ.lock > 0 ? "#333c57" : "#ffeed4", "#d4af37", 2);
      ctx.fillStyle = "#1e1829";
      ctx.font = "900 18px 'Zen Maru Gothic', sans-serif";
      ctx.fillText(`${i + 1}. ${w.jp}`, ox + optW / 2, oy + 29);
    });

    ctx.restore();
  }

  // 5. 單字圖鑑 (Codex / Japanese Dictionary)
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

      lacquerBox(ctx, cx, cy, cardW, cardH, 10, seen ? "#fcf4e3" : "#20273a", seen ? "#d4af37" : "#36415a", 1.5);

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

    lacquerBox(ctx, W / 2 - 80, 560, 160, 32, 8, "#d4af37", "#ffffff", 1.5);
    ctx.fillStyle = "#1a162b";
    ctx.font = "900 15px 'Noto Sans JP', sans-serif";
    ctx.fillText("返回主選單", W / 2, 582);

    ctx.restore();
  }

  // 6. 結算畫面 (勝利 / 失敗)
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
      lacquerBox(ctx, W / 2 - 280, 310, 560, 84, 12, "#201c30", "#d4af37", 1.5);
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
