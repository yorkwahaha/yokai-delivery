// 使用者介面（UI）：商業級和風日式繪卷 HUD、HoloCure 風格升級抽卡、Boss 破防答題與單字圖鑑
window.UI = (() => {
  const W = 900, H = 600;

  // 繪製圓角方塊
  function roundBox(ctx, x, y, w, h, r = 10, fill = "#1c2438", stroke = null, strokeW = 2) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = strokeW;
      ctx.stroke();
    }
  }

  // 1. 主選單 (Title / Cover Screen)
  function drawMainMenu(ctx, STORE, elapsed) {
    ctx.save();
    // 繪製生成的商業級封面圖（帶微幅縮放呼吸感）
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

    // 暗角與底部漸層
    const vig = ctx.createLinearGradient(0, 0, 0, H);
    vig.addColorStop(0, "rgba(8, 12, 26, 0.45)");
    vig.addColorStop(0.65, "rgba(8, 12, 26, 0.7)");
    vig.addColorStop(1, "rgba(8, 12, 26, 0.96)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    // 遊戲副標題與日文特色
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffeed4";
    ctx.font = "bold 20px 'Zen Maru Gothic', sans-serif";
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 8;
    ctx.fillText("百鬼橫行夜・單字送達之卷", W / 2, 380);

    // 操作指南簡報
    roundBox(ctx, W / 2 - 320, 410, 640, 92, 14, "rgba(22, 28, 48, 0.85)", "#c29d5b", 2);
    ctx.font = "bold 15px 'Noto Sans JP', sans-serif";
    ctx.fillStyle = "#dfe8ff";
    ctx.fillText("【取貨】到各家門口按 E，記牢日文單字　【送貨】在正確名字圈內站 0.5 秒", W / 2, 438);
    ctx.fillText("【戰鬥】自動攻擊四周妖怪　【衝刺】Shift 或 觸控鍵　【燈油】送貨補充", W / 2, 462);
    ctx.fillStyle = "#ffe28b";
    ctx.font = "bold 14px 'Noto Sans JP', sans-serif";
    ctx.fillText("WASD 移動　H 提示(-3燈油)　M 靜音　C 妖怪單字圖鑑", W / 2, 486);

    // 開始提示（呼吸閃爍）
    const blink = 0.65 + 0.35 * Math.sin(elapsed * 5);
    ctx.fillStyle = `rgba(255, 230, 150, ${blink})`;
    ctx.font = "900 24px 'Kaisei Decol', 'Noto Sans JP', serif";
    ctx.fillText("— 按 ENTER 或 點擊任意處開始夜行 —", W / 2, 545);

    // 歷史紀錄標籤
    ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
    ctx.font = "14px 'Noto Sans JP', sans-serif";
    ctx.fillText(`最高得分：${STORE.data.best || 0}　最長送達：${STORE.data.bestDel || 0} 件`, W / 2, 580);

    // 圖鑑快捷按鈕
    roundBox(ctx, W - 140, 24, 116, 38, 8, "rgba(30, 38, 64, 0.85)", "#e3b35d", 2);
    ctx.fillStyle = "#ffeed4";
    ctx.font = "bold 15px 'Noto Sans JP', sans-serif";
    ctx.fillText("📖 單字圖鑑 [C]", W - 82, 48);

    ctx.restore();
  }

  // 2. 遊戲主畫面 HUD
  function drawHud(ctx, P, oil, elapsed, dawnTime, delivered, failed, score, level, xp, xpNeed, job, hintT, orders, inter, bossQ, touch, joy, btnE, btnD, WL, WI) {
    ctx.save();

    // 頂部狀態橫條 (漆器底 + 金線飾邊)
    const hudGrad = ctx.createLinearGradient(0, 0, 0, 78);
    hudGrad.addColorStop(0, "rgba(14, 18, 32, 0.95)");
    hudGrad.addColorStop(1, "rgba(14, 18, 32, 0.75)");
    ctx.fillStyle = hudGrad;
    ctx.fillRect(0, 0, W, 74);
    ctx.fillStyle = "#c29d5b";
    ctx.fillRect(0, 73, W, 2);

    // --- 左側：燈油計量瓶 ---
    ctx.textAlign = "left";
    ctx.font = "24px sans-serif";
    ctx.fillText("🏮", 16, 36);

    // 燈油槽
    const oilW = 160, oilH = 14;
    roundBox(ctx, 48, 22, oilW, oilH, 7, "#242c44", "#3f4d75", 1.5);
    const oilRatio = Math.max(0, Math.min(1, oil / 100));
    const oilColor = oil < 25 ? "#ff5252" : oil < 50 ? "#ffab40" : "#ffd152";
    roundBox(ctx, 48, 22, oilW * oilRatio, oilH, 7, oilColor);

    ctx.font = "bold 12px 'Zen Maru Gothic', sans-serif";
    ctx.fillStyle = "#ffeed4";
    ctx.fillText(`燈油 ${Math.ceil(oil)}%`, 54, 48);

    // --- 生命值 (心之勾玉) ---
    ctx.font = "18px sans-serif";
    ctx.fillText("❤️", 226, 35);
    const hpW = 90, hpH = 14;
    roundBox(ctx, 252, 22, hpW, hpH, 7, "#242c44", "#3f4d75", 1.5);
    const hpRatio = Math.max(0, Math.min(1, P.hp / P.maxHp));
    roundBox(ctx, 252, 22, hpW * hpRatio, hpH, 7, "#ff5964");
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px 'Zen Maru Gothic', sans-serif";
    ctx.fillText(`${P.hp}/${P.maxHp}`, 275, 34);

    // --- 中間：配送統計 ---
    ctx.fillStyle = "#dfe8ff";
    ctx.font = "bold 14px 'Noto Sans JP', sans-serif";
    ctx.fillText(`送達 ${delivered} 件`, 365, 28);
    ctx.fillStyle = "#b8c9f0";
    ctx.font = "13px 'Noto Sans JP', sans-serif";
    ctx.fillText(`失誤 ${failed} | 得分 ${score}`, 365, 48);

    // --- 右側：黎明時鐘與經驗條 ---
    // 黎明天盤進度
    const dawnProgress = Math.min(1, elapsed / dawnTime);
    ctx.font = "16px sans-serif";
    ctx.fillText("🌙", 520, 34);
    const dawnW = 140, dawnH = 10;
    roundBox(ctx, 542, 24, dawnW, dawnH, 5, "#242c44", "#3f4d75", 1);
    roundBox(ctx, 542, 24, dawnW * dawnProgress, dawnH, 5, "#f39c12");
    ctx.fillText("🌅", 688, 34);

    // 經驗值條
    const xpRatio = Math.min(1, xp / xpNeed);
    roundBox(ctx, 542, 42, dawnW, 8, 4, "#1d263b", "#334163", 1);
    roundBox(ctx, 542, 42, dawnW * xpRatio, 8, 4, "#54d8ff");
    ctx.fillStyle = "#54d8ff";
    ctx.font = "bold 13px 'Zen Maru Gothic', sans-serif";
    ctx.fillText(`Lv.${level}`, 688, 50);

    // 提示與靜音
    roundBox(ctx, 740, 16, 144, 44, 8, "rgba(35, 45, 75, 0.7)", "#4d6094", 1);
    ctx.fillStyle = "#ffeed4";
    ctx.font = "bold 12px 'Noto Sans JP', sans-serif";
    ctx.fillText("H：看中文(-3油)", 752, 34);
    ctx.fillText("M：靜音　C：圖鑑", 752, 50);

    // --- 任務卷軸 (中央浮動任務指示) ---
    const bannerY = 88;
    if (job) {
      // 進行中委託
      roundBox(ctx, W / 2 - 240, bannerY, 480, 36, 10, "rgba(28, 22, 46, 0.92)", "#c29d5b", 2);
      ctx.textAlign = "center";
      ctx.font = "bold 15px 'Zen Maru Gothic', sans-serif";
      ctx.fillStyle = "#ffe699";
      if (job.rev) {
        ctx.fillText(`📜 句子委託：「${job.word.jp}をください」 ➔ 送往「${job.to.word.jp}」站圈答圖案`, W / 2, bannerY + 23);
      } else {
        const hintStr = hintT > 0 ? `（${job.word.zh}）` : "";
        ctx.fillText(`📦 貨物已打包 ➔ 送往「${job.to.word.jp}」站圈選日文名 ${hintStr}`, W / 2, bannerY + 23);
      }
    } else {
      // 等待接單
      roundBox(ctx, W / 2 - 210, bannerY, 420, 32, 8, "rgba(20, 26, 44, 0.85)", "#4f6594", 1.5);
      ctx.textAlign = "center";
      ctx.font = "bold 14px 'Noto Sans JP', sans-serif";
      ctx.fillStyle = "#dfe8ff";
      ctx.fillText("⛩ 尋找屋頂有委託氣泡的町屋，門口按 E 取貨", W / 2, bannerY + 21);
    }

    // 武器狀態列（左下角）
    roundBox(ctx, 16, H - 42, 320, 28, 6, "rgba(14, 18, 32, 0.85)", "#3f4d75", 1);
    ctx.textAlign = "left";
    ctx.font = "bold 13px 'Zen Maru Gothic', sans-serif";
    ctx.fillStyle = "#ffe28b";
    const wepText = Object.keys(WI)
      .filter(k => WL[k] > 0)
      .map(k => `${WI[k].jp} Lv.${WL[k]}`)
      .join("  |  ");
    ctx.fillText(wepText || "刀 Lv.1", 26, H - 24);

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
      ctx.font = "bold 16px 'Zen Maru Gothic', sans-serif";
      ctx.fillText("衝刺", btnD.x, btnD.y + 6);

      // 取貨鈕
      if (inter) {
        ctx.fillStyle = "rgba(255, 210, 80, 0.75)";
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
        ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
        ctx.beginPath();
        ctx.arc(joy.x + joy.dx * 60, joy.y + joy.dy * 60, 26, 0, 6.28);
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.restore();
  }

  // 3. 升級選卡視窗（HoloCure 風格卡牌設計）
  function drawLevelUp(ctx, level, choices) {
    ctx.save();
    // 全屏半透明和風黑幕
    ctx.fillStyle = "rgba(10, 14, 26, 0.88)";
    ctx.fillRect(0, 0, W, H);

    // 標題金紋裝飾
    ctx.textAlign = "center";
    ctx.font = "900 32px 'Kaisei Decol', 'Noto Sans JP', serif";
    ctx.fillStyle = "#ffe28b";
    ctx.shadowColor = "rgba(255, 215, 100, 0.6)";
    ctx.shadowBlur = 12;
    ctx.fillText(`— 妖術覺醒・等級提升 Lv.${level} —`, W / 2, 120);

    ctx.shadowBlur = 0;
    ctx.font = "bold 16px 'Zen Maru Gothic', sans-serif";
    ctx.fillStyle = "#cad7f5";
    ctx.fillText("選擇一項秘術以繼續夜行（點擊卡牌 或 按數字鍵 1 / 2 / 3）", W / 2, 155);

    // 繪製三張立體卡牌
    const cardW = 240, cardH = 340;
    const startX = 65, gap = 40;

    choices.forEach((c, i) => {
      const cx = startX + i * (cardW + gap);
      const cy = 190;

      // 卡牌底框與金邊
      const cardGrad = ctx.createLinearGradient(cx, cy, cx + cardW, cy + cardH);
      cardGrad.addColorStop(0, "#232d47");
      cardGrad.addColorStop(1, "#141a2c");

      roundBox(ctx, cx, cy, cardW, cardH, 16, cardGrad, "#d4af37", 3);

      // 卡牌頂部標籤
      roundBox(ctx, cx + 18, cy + 18, cardW - 36, 32, 8, "#323f63", null);
      ctx.fillStyle = "#ffe28b";
      ctx.font = "bold 15px 'Zen Maru Gothic', sans-serif";
      ctx.fillText(c.s ? `[ ${c.s} ]` : "[ 強化秘術 ]", cx + cardW / 2, cy + 40);

      // 卡牌名稱
      ctx.font = "900 24px 'Kaisei Decol', 'Noto Sans JP', serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(c.n, cx + cardW / 2, cy + 115);

      // 說明描述
      ctx.font = "bold 16px 'Noto Sans JP', sans-serif";
      ctx.fillStyle = "#b8cbfa";
      ctx.fillText(c.d, cx + cardW / 2, cy + 190);

      // 底部按鍵引導
      roundBox(ctx, cx + cardW / 2 - 28, cy + cardH - 58, 56, 36, 10, "#c29d5b", "#fff", 1.5);
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
    const boxW = 680, boxH = 105;
    const bx = (W - boxW) / 2, by = H - 125;

    roundBox(ctx, bx, by, boxW, boxH, 16, "rgba(22, 16, 36, 0.95)", "#ff5470", 2.5);

    ctx.textAlign = "center";
    ctx.font = "900 19px 'Kaisei Decol', 'Noto Sans JP', serif";
    ctx.fillStyle = "#ffeed4";
    ctx.fillText(`🛡【大妖鬼結界】：${bossQ.word.icon} 的日文名是？（按 1 / 2 / 3 或點選）`, W / 2, by + 30);

    // 三個選項
    const optW = 195, optH = 46;
    bossQ.ans.forEach((w, i) => {
      const ox = bx + 22 + i * (optW + 24);
      const oy = by + 46;
      roundBox(ctx, ox, oy, optW, optH, 10, bossQ.lock > 0 ? "#333c57" : "#ffeed4", "#c29d5b", 2);
      ctx.fillStyle = "#1e1829";
      ctx.font = "900 18px 'Zen Maru Gothic', sans-serif";
      ctx.fillText(`${i + 1}. ${w.jp}`, ox + optW / 2, oy + 29);
    });

    ctx.restore();
  }

  // 5. 單字圖鑑 (Codex / Japanese Dictionary)
  function drawCodex(ctx, STORE, ALL) {
    ctx.save();
    ctx.fillStyle = "rgba(12, 16, 28, 0.95)";
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = "center";
    ctx.font = "900 30px 'Kaisei Decol', 'Noto Sans JP', serif";
    ctx.fillStyle = "#ffe28b";
    ctx.fillText("— 妖怪單字繪卷 (Codex) —", W / 2, 60);

    ctx.font = "bold 14px 'Noto Sans JP', sans-serif";
    ctx.fillStyle = "#cad7f5";
    ctx.fillText("★ = 熟練度：答對升星、答錯歸零。越不熟的單字，夜行委託越常出現。（按 C 或 點擊返回）", W / 2, 88);

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

      // 卡牌底框
      roundBox(ctx, cx, cy, cardW, cardH, 10, seen ? "#fcf4e3" : "#242d44", seen ? "#c29d5b" : "#3b4766", 1.5);

      ctx.fillStyle = "#1e1829";
      ctx.font = "26px sans-serif";
      ctx.fillText(seen ? w.icon : "？", cx + cardW / 2, cy + 36);

      ctx.font = "bold 14px 'Zen Maru Gothic', sans-serif";
      ctx.fillText(seen ? w.jp : "？？", cx + cardW / 2, cy + 62);

      if (seen) {
        ctx.font = "bold 12px 'Noto Sans JP', sans-serif";
        ctx.fillStyle = "#63503c";
        ctx.fillText(w.zh, cx + cardW / 2, cy + 82);

        // 星級
        ctx.fillStyle = "#d48819";
        ctx.font = "12px sans-serif";
        ctx.fillText("★".repeat(m.box) + "☆".repeat(4 - m.box), cx + cardW / 2, cy + 101);
      }
    });

    // 總結進度
    ctx.font = "900 17px 'Zen Maru Gothic', sans-serif";
    ctx.fillStyle = "#ffe28b";
    ctx.fillText(`已精通詞彙：${mastered} / ${ALL.length} 語`, W / 2, 545);

    roundBox(ctx, W / 2 - 80, 560, 160, 32, 8, "#c29d5b", "#fff", 1.5);
    ctx.fillStyle = "#1a162b";
    ctx.font = "bold 15px 'Noto Sans JP', sans-serif";
    ctx.fillText("返回主選單", W / 2, 582);

    ctx.restore();
  }

  // 6. 結算畫面 (勝利 / 失敗)
  function drawEndScreen(ctx, state, score, delivered, failed, misses) {
    ctx.save();
    ctx.fillStyle = "rgba(10, 14, 26, 0.92)";
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = "center";
    const isWon = state === "won";

    ctx.font = "900 36px 'Kaisei Decol', 'Noto Sans JP', serif";
    ctx.fillStyle = isWon ? "#ffe28b" : "#ff6b81";
    ctx.fillText(isWon ? "🌅 平安迎向黎明！百鬼散去！" : "🏮 燈油燃盡…黑夜吞沒了街區", W / 2, 180);

    ctx.font = "bold 20px 'Zen Maru Gothic', sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`本次夜行得分：${score} 分`, W / 2, 240);
    ctx.fillText(`成功送達：${delivered} 件　失誤：${failed} 次`, W / 2, 275);

    // 待複習字詞
    const reviewList = [...new Map(misses.map(w => [w.jp, w])).values()].slice(0, 6);
    if (reviewList.length > 0) {
      roundBox(ctx, W / 2 - 280, 315, 560, 80, 12, "#242036", "#c29d5b", 1.5);
      ctx.fillStyle = "#ffeed4";
      ctx.font = "bold 15px 'Noto Sans JP', sans-serif";
      ctx.fillText("【本次需要複習的單字】", W / 2, 342);
      ctx.fillStyle = "#ffd152";
      const wStr = reviewList.map(w => `${w.icon}${w.jp}＝${w.zh}`).join("　");
      ctx.fillText(wStr, W / 2, 372);
    } else {
      ctx.fillStyle = "#ffe28b";
      ctx.font = "bold 17px 'Noto Sans JP', sans-serif";
      ctx.fillText("✨ 全數正確無誤配！你是傳奇快遞大師！", W / 2, 350);
    }

    // 重新開始
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
