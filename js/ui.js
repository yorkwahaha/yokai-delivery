// 使用者介面（UI）：商業級全螢幕懸浮式 HUD、HoloCure 風格武器圖標槽、純視覺化無文字冗餘
window.UI = (() => {
  const screenBounds = () => window.VIEWPORT?.bounds() || {left:0,top:0,right:900,bottom:600,width:900,height:600};
  function fillScreen(ctx) { const b = screenBounds(); ctx.fillRect(b.left,b.top,b.width,b.height); }
  const W = 900, H = 600;
  const RESTART_BTN = { x: 150, y: 492, w: 180, h: 48 };
  const WORLD_BTN = { x: 360, y: 492, w: 180, h: 48 };
  const HOME_BTN = { x: 570, y: 492, w: 180, h: 48 };
  const MENU_START_BTN = { x: W / 2 - 132, y: 478, w: 264, h: 54 };
  const MENU_CONTROLS_BTN = { x: 20, y: 22, w: 180, h: 38 };
  const HINT_BTN = { x: 532, y: 20, w: 78, h: 40 };
  const TUTORIAL_BTNS = [{x:100,y:390,w:330,h:70},{x:470,y:390,w:330,h:70}];
  const EXIT_BTNS = [{id:'exit-cancel',x:195,y:330,w:240,h:70},{id:'exit-confirm',x:465,y:330,w:240,h:70}];

  function drawExitConfirm(ctx, focus = 0) {
    ctx.save();
    ctx.fillStyle = 'rgba(6,8,18,0.88)';fillScreen(ctx);
    glassBox(ctx,160,160,580,270,16,'#101624','#e6c27a',2);
    ctx.textAlign = 'center';ctx.fillStyle = '#ffe3ad';ctx.font = readableFont(24,'900');
    ctx.fillText('是否放棄本局？',450,215);
    ctx.fillStyle = '#edf2ff';ctx.font = readableFont(15);
    ctx.fillText('將返回首頁，本局未結算的成績不會記錄。',450,260);
    ctx.fillText('已儲存的單字學習紀錄會保留。',450,290);
    EXIT_BTNS.forEach((b,i)=>{
      glassBox(ctx,b.x,b.y,b.w,b.h,10,i===0?'#283b42':'#422831','#e6c27a',1.5);
      ctx.fillStyle = '#fff1d4';ctx.font = readableFont(18,'900');
      ctx.fillText(i===0?'繼續本局':'放棄並回首頁',b.x+b.w/2,b.y+43);
    });
    drawMenuFocus(ctx,EXIT_BTNS[focus]);ctx.restore();
  }
  const controlLabel = (action, mode = 'keyboard') => mode === 'gamepad'
    ? ({interact:'A',dash:'B',hint:'X',pause:'Start',move:'左搖桿／十字鍵',boss:'LB／RB／Y'}[action] || '')
    : mode === 'touch' ? ({interact:'右側取貨鈕',dash:'右側衝刺鈕',hint:'上方提示鈕',pause:'右上暫停鈕',move:'左側拖曳',boss:'點選答案'}[action] || '')
    : action === 'move' ? ['u','l','d','r'].map(a=>window.CONTROLS?.label(a) || '').join('／') + ' 或方向鍵'
    : action === 'boss' ? '1／2／3' : window.CONTROLS?.label(action) || ({interact:'E',dash:'空白鍵',hint:'H',pause:'P'}[action] || '');
  function tutorialCopy(id, mode) {
    const key = action => controlLabel(action, mode);
    return {
      pickup: ['取貨', 'pickup', `移動：${key('move')}。沿包裹標記靠近委託房屋，再用${key('interact')}取貨。攻擊會自動發動。`],
      listen: ['聽音與答題輔助', 'listen', `取貨時會播放發音；看包裹圖像與中文辨認詞義。${key('hint')}是答題輔助：第一階耗 3 油、重播並排除一項；第二階再耗 4 油、顯示詞句。使用任一階，這單不升星、得 25 分、回油 10。`],
      delivery: ['配送答題墊', 'pickup', '沿箭頭前往收件房屋，走上你選的假名答題墊。停留 0.45 秒會自動提交；移開可中斷。配送不能用 1／2／3 作答。'],
      dash: ['衝刺避險', 'dash', `移動中用${key('dash')}快速穿過危險；衝刺期間短暫無敵。右側衝刺鈕顯示冷卻秒數，恢復後才能再次使用。`],
      boss: ['Boss 作答', 'listen', `Boss 結界出題時，依圖像與中文選假名。作答：${key('boss')}；答對才能破除結界。取貨、衝刺仍可使用。`]
    }[id];
  }
  // Shared monochrome operation symbols, independent of OS Emoji fonts.
  function drawActionIcon(ctx, id, x, y, r = 10) {
    ctx.save(); ctx.translate(x,y); ctx.scale(r/10,r/10);
    ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    if (id === 'pickup') {
      ctx.rect(-8,-6,16,14); ctx.moveTo(-8,-6);ctx.lineTo(0,-10);ctx.lineTo(8,-6);ctx.moveTo(0,-10);ctx.lineTo(0,8);ctx.moveTo(-8,-2);ctx.lineTo(8,-2);
    } else if (id === 'listen') {
      ctx.moveTo(-8,-3);ctx.lineTo(-4,-3);ctx.lineTo(1,-8);ctx.lineTo(1,8);ctx.lineTo(-4,3);ctx.lineTo(-8,3);ctx.closePath();
      ctx.moveTo(5,-5);ctx.quadraticCurveTo(10,0,5,5);
    } else if (id === 'hint') {
      ctx.arc(0,-2,6,0,Math.PI*2);ctx.moveTo(-3,5);ctx.lineTo(3,5);ctx.moveTo(-3,8);ctx.lineTo(3,8);
    } else if (id === 'dash') {
      ctx.moveTo(-3,-7);ctx.lineTo(4,0);ctx.lineTo(-3,7);ctx.moveTo(3,-7);ctx.lineTo(10,0);ctx.lineTo(3,7);ctx.moveTo(-10,-3);ctx.lineTo(-6,-3);ctx.moveTo(-10,3);ctx.lineTo(-6,3);
    } else if (id === 'pause') {
      ctx.rect(-6,-8,3,16);ctx.rect(3,-8,3,16);
    } else if (id === 'cards') {
      ctx.rect(-5,-7,12,16);ctx.moveTo(-8,5);ctx.lineTo(-8,-10);ctx.lineTo(4,-10);
    } else {
      ctx.rect(-8,-9,16,18);ctx.moveTo(-4,-4);ctx.lineTo(4,-4);ctx.moveTo(-4,1);ctx.lineTo(4,1);ctx.moveTo(-4,6);ctx.lineTo(4,6);
    }
    ctx.stroke(); ctx.restore();
  }
  function drawTutorial(ctx, tutorial, mode) {
    const [title, icon, body] = tutorialCopy(tutorial.id, mode);
    ctx.save(); ctx.fillStyle='rgba(6,8,16,0.84)'; fillScreen(ctx);
    glassBox(ctx,60,115,780,375,14,'#121827','#d4af37',2);
    ctx.fillStyle='#ffe28b'; drawActionIcon(ctx,icon,100,155,16);
    ctx.textAlign='left';ctx.font=readableFont(24,'900');ctx.fillText(title,130,165);
    ctx.fillStyle='#e9e4d6';ctx.font=readableFont(18,'bold');
    let line='', y=211;
    for (const char of body) {
      if (ctx.measureText(line+char).width > 690 && !'，。；：、！？'.includes(char)) {ctx.fillText(line,100,y);y+=29;line='';}
      line+=char;
    }
    ctx.fillText(line,100,y);
    ctx.fillStyle='#80deea';ctx.font=readableFont(15,'bold');
    ctx.fillText('操作教學不扣油、不算答題輔助；閱讀期間遊戲暫停。',100,360);
    const labels = [tutorial.replay && tutorial.id !== 'boss' ? '下一張' : '知道了', tutorial.replay ? '結束重看' : '跳過全部教學'];
    TUTORIAL_BTNS.forEach((bt,i)=>{
      glassBox(ctx,bt.x,bt.y,bt.w,bt.h,10,'#252d40','#d4af37');
      ctx.fillStyle='#fff1d0';ctx.textAlign='center';ctx.font=readableFont(18,'900');ctx.fillText(labels[i],bt.x+bt.w/2,bt.y+43);
      if(tutorial.focus===i) drawMenuFocus(ctx,bt);
    });
    ctx.font=readableFont(12,'bold');ctx.fillStyle='#b7bdc8';
    ctx.fillText(mode==='gamepad'?'十字鍵選擇 · A 確認 · B 結束':mode==='touch'?'點選按鈕 · 暫停選單可重看':'Tab／方向鍵選擇 · Enter 確認 · Esc 結束',450,482);
    ctx.restore();
  }

  const MENU_BTNS = [{id:'start',...MENU_START_BTN},{id:'controls',...MENU_CONTROLS_BTN},{id:'cards',x:615,y:22,w:125,h:38},{id:'codex',x:755,y:22,w:125,h:38}];
  const END_BTNS = [{id:'restart',...RESTART_BTN},{id:'world',...WORLD_BTN},{id:'menu',...HOME_BTN}];
  function drawMenuFocus(ctx, btn) {
    if (!btn) return;
    ctx.save(); ctx.strokeStyle='#80deea'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.roundRect(btn.x-4,btn.y-4,btn.w+8,btn.h+8,10); ctx.stroke(); ctx.restore();
  }

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
  function drawMainMenu(ctx, STORE, elapsed, focus = 0) {
    ctx.save();
    if (window.ART?.cover) {
      const zoom = 1.0 + Math.sin(elapsed * 0.8) * 0.02;
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.scale(zoom, zoom);
      const b = screenBounds(), image = window.ART.cover;
      const scale = Math.max(b.width / image.naturalWidth, b.height / image.naturalHeight);
      ctx.drawImage(image, -image.naturalWidth * scale / 2, -image.naturalHeight * scale / 2, image.naturalWidth * scale, image.naturalHeight * scale);
      ctx.restore();
    } else {
      ctx.fillStyle = "#0c1024";
      fillScreen(ctx);
    }

    const vig = ctx.createLinearGradient(0, 0, 0, H);
    vig.addColorStop(0, "rgba(6, 9, 20, 0.45)");
    vig.addColorStop(0.65, "rgba(6, 9, 20, 0.65)");
    vig.addColorStop(1, "rgba(6, 9, 20, 0.96)");
    ctx.fillStyle = vig;
    fillScreen(ctx);

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
    ctx.fillText("旅 路 地 圖　▶", W / 2, MENU_START_BTN.y + 35);

    ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
    ctx.font = readableFont(13, "bold");
    ctx.fillText(`夜 行 紀 錄 ： 最 高 得 分 ${STORE.data.best || 0} 點　｜　最 高 配 達 ${STORE.data.bestDel || 0} 件`, W / 2, 565);

    glassBox(ctx, W - 285, 22, 125, 38, 8, "rgba(24, 30, 52, 0.9)", "#e3b35d", 1.8);
    ctx.fillStyle = "#ffeed4";
    ctx.font = readableFont(13, "900");
    ctx.fillText("卡片一覽", W - 222, 46);

    glassBox(ctx, W - 145, 22, 125, 38, 8, "rgba(24, 30, 52, 0.9)", "#e3b35d", 1.8);
    ctx.fillStyle = "#ffeed4";
    ctx.font = readableFont(13, "900");
    ctx.fillText("單字圖鑑", W - 82, 46);

    glassBox(ctx, MENU_CONTROLS_BTN.x, MENU_CONTROLS_BTN.y, MENU_CONTROLS_BTN.w, MENU_CONTROLS_BTN.h, 8);
    ctx.fillText("操作與自定義", MENU_CONTROLS_BTN.x + MENU_CONTROLS_BTN.w / 2, 46);
    drawMenuFocus(ctx, MENU_BTNS[focus]);

    ctx.restore();
  }

  // 2. 全螢幕專業無分割 HUD（懸浮微型儀表 + 底部 HoloCure 風格武器格）
  function drawHud(ctx, P, oil, maxOil, elapsed, dawnTime, delivered, failed, score, level, xp, xpNeed, job, hintT, orders, inter, bossQ, touch, joy, btnE, btnD, btnPause, WL, WI, b, nameT, goalDeliveries = 6, dashCd = 0, dashMax = 1.8, bossHunt = false) {
    ctx.save();

    // 注意：完全移除頂部深色橫條！遊戲世界 100% 全螢幕通透顯示！

    // --- 左上角：玩家生存與成長懸浮艙 (燈油即生命 + 經驗值條) ---
    const bounds = window.VIEWPORT?.hudBounds() || screenBounds();
    const pBoxX = bounds.left + 18, pBoxY = bounds.top + 14, pBoxW = 225, pBoxH = 52;
    glassBox(ctx, pBoxX, pBoxY, pBoxW, pBoxH, 10);

    // 1. 提燈油量條（生命條：油盡燈枯即陣亡）
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffb03a";
    ctx.font = readableFont(13, "900");
    ctx.fillText("燈油", pBoxX + 6, pBoxY + 20);

    const oilBarW = 90, oilBarH = 10;
    ctx.fillStyle = "#1c1814";
    ctx.beginPath();
    ctx.roundRect(pBoxX + 46, pBoxY + 11, oilBarW, oilBarH, 4);
    ctx.fill();

    const curMaxOil = maxOil || 100;
    const oilRatio = Math.max(0, Math.min(1, oil / curMaxOil));
    const oilGrad = ctx.createLinearGradient(pBoxX + 46, 0, pBoxX + 46 + oilBarW, 0);
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
      ctx.roundRect(pBoxX + 46, pBoxY + 11, oilBarW * oilRatio, oilBarH, 4);
      ctx.fill();
    }
    ctx.fillStyle = "#ffeed4";
    ctx.font = readableFont(12, "900");
    ctx.fillText(`${Math.ceil(oil)}/${curMaxOil}`, pBoxX + 142, pBoxY + 20);

    // 2. 經驗值條 (滿了即升級)
    ctx.font = readableFont(12, "900");
    ctx.fillStyle = "#40c4ff";
    ctx.fillText(`Lv.${level}`, pBoxX + 6, pBoxY + 42);

    const xpBarW = 80, xpBarH = 9;
    ctx.fillStyle = "#151b27";
    ctx.beginPath();
    ctx.roundRect(pBoxX + 60, pBoxY + 33, xpBarW, xpBarH, 4);
    ctx.fill();
    const xpRatio = Math.min(1, xp / xpNeed);
    if (xpRatio > 0) {
      ctx.fillStyle = "#40c4ff";
      ctx.beginPath();
      ctx.roundRect(pBoxX + 60, pBoxY + 33, xpBarW * xpRatio, xpBarH, 4);
      ctx.fill();
    }
    ctx.fillStyle = "#c5eeff";
    ctx.font = readableFont(11, "bold");
    ctx.fillText(`${xp}/${xpNeed}`, pBoxX + 147, pBoxY + 42);

    // 3. 金剛結界護盾膠囊（位於生命欄正下方，整潔且絕不遮擋中央委託提示）
    if (b.shield && b.shield > 0) {
      const shX = pBoxX, shY = pBoxY + pBoxH + 6;
      glassBox(ctx, shX, shY, 140, 26, 6, "rgba(36, 30, 14, 0.94)", "#ffd54f", 1.5);
      ctx.textAlign = "center";
      ctx.font = readableFont(12, "900");
      ctx.fillStyle = "#ffe28b";
      ctx.fillText(`✦ 結界護盾 x${b.shield}`, shX + 70, shY + 18);
    }

    // --- 右上角：進度與統計懸浮艙 (Dawn, Deliveries & Score) ---
    const sBoxW = 205, sBoxH = 52;
    const sBoxX = bounds.right - sBoxW - 62, sBoxY = bounds.top + 14;
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

    const miniDawnW = 110, miniDawnH = 7;
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
    ctx.font = readableFont(11, "bold");
    ctx.fillText(`${dawnMin}:${dawnSec < 10 ? '0' : ''}${dawnSec}`, sBoxX + 148, sBoxY + 20);

    // 配達目標與得分
    ctx.fillStyle = "#ffeed4";
    ctx.font = readableFont(13, "900");
    ctx.fillText(`配達 ${delivered}/${goalDeliveries}  |  ${score}pt`, sBoxX + 12, sBoxY + 42, 185);

    // --- 右上角暫停按鈕 (btnPause) ---
    glassBox(ctx, btnPause.x, btnPause.y, btnPause.w, btnPause.h, 10, "rgba(20, 26, 44, 0.92)", "#d4af37", 1.8);
    const pcx = btnPause.x + btnPause.w / 2, pcy = btnPause.y + btnPause.h / 2;
    ctx.fillStyle = "#ffd54f";
    drawActionIcon(ctx,'pause',pcx,pcy,10);

    // --- 中上：HoloCure 式單一任務條。只保留「現在要做什麼」與方向資訊。 ---
    const taskX = Math.max(248, pBoxX + pBoxW + 5), taskY = bounds.top + 14;
    const taskW = Math.min(370, sBoxX - taskX - 15), taskH = 52;
    HINT_BTN.x = taskX + taskW - HINT_BTN.w - 8;
    HINT_BTN.y = bounds.top + 20;
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
      ctx.font = readableFont(12, "900");
      ctx.fillText("赤い双矢印を追え", taskX + taskW / 2, taskY + 43);
    } else if (job) {
      const remaining = Math.round(Math.hypot(P.x - job.to.x, P.y - job.to.y) / 10) * 10;
      ctx.fillStyle = "#fff3ca";
      ctx.font = readableFont(18, "900");
      if (job.word.cue !== "text") drawWordCue(ctx, job.word, taskX + 25, taskY + 16, 24);
      ctx.fillText(job.word.zh, taskX + (job.word.cue === "text" ? 14 : 46), taskY + 23);
      ctx.fillStyle = "#82d8ff";
      ctx.font = readableFont(12, "900");
      ctx.fillText(`➜ ${remaining}`, taskX + 14, taskY + 43);

      const hintStage = job.hintStage || 0;
      const hintLabel = hintStage === 0 ? "聽 -3" : hintStage === 1 ? "詞 -4" : "✓";
      const hintEnabled = hintStage < 2;
      glassBox(ctx, HINT_BTN.x, HINT_BTN.y, HINT_BTN.w, HINT_BTN.h, 9, hintEnabled ? "rgba(31, 61, 77, 0.94)" : "rgba(44, 48, 58, 0.82)", hintEnabled ? "#80deea" : "#6b7280", 1.6);
      ctx.textAlign = "center";
      ctx.fillStyle = hintEnabled ? "#e0fbff" : "#b7bdc8";
      ctx.font = readableFont(14, "900");
      drawActionIcon(ctx, hintStage === 0 ? 'listen' : 'hint', HINT_BTN.x+17,HINT_BTN.y+20,9);
      ctx.fillText(hintLabel, HINT_BTN.x + 49, HINT_BTN.y + 25);

      if (job.showMeaningT > 0) {
        ctx.textAlign = "left";
        ctx.fillStyle = "#ffd54f";
        ctx.font = readableFont(11, "bold");
        const helper = `${job.word.jp}　${job.word.example || ""}`;
        drawHintText(ctx, helper, taskX, taskY + taskH + 6, taskW);
      }
    } else {
      ctx.fillStyle = inter ? "#ffe082" : "#f4e7cf";
      ctx.font = readableFont(17, "900");
      drawActionIcon(ctx,'pickup',taskX+25,taskY+24,10);
      ctx.fillText("取貨", taskX + 46, taskY + 31);
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = readableFont(12, "");
      ctx.fillText("➜", taskX + 128, taskY + 31);
    }

    // --- 左下角：HoloCure 風格【主動秘術 4 槽位 + 被動體質欄】 ---
    const ownedKeys = WI ? Object.keys(WI).filter(k => (WL[k] || 0) > 0) : [];
    const maxActiveSlots = 4;
    ctx.save();
    ctx.translate(bounds.left + 18, bounds.bottom - 62);
    ctx.scale(1.2, 1.2);
    const slotStartX = 0, slotY = 0;
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
        ctx.font = readableFont(13, "bold");
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
      if ((px+28)*1.2 < bounds.width-18-180) {
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
    ctx.restore();

    // 觸控虛擬按鈕
    {
      ctx.save();
      // 開場只用半透明搖桿輪廓提示「左側可拖曳」，不彈教學文字。
      if (touch && !joy && elapsed < 15) {
        ctx.strokeStyle = "rgba(255,255,255,0.28)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(bounds.left + 105, bounds.bottom - 125, 52, 0, 6.28);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(bounds.left + 105, bounds.bottom - 125, 20, 0, 6.28);
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
      ctx.font = readableFont(16, "900");
      drawActionIcon(ctx,'dash',btnD.x,btnD.y-12,12);
      ctx.fillText(dashCd > 0 ? `${dashCd.toFixed(1)}s` : "衝刺", btnD.x, btnD.y + 20);

      if (inter) {
        ctx.fillStyle = "rgba(255, 210, 80, 0.85)";
        ctx.beginPath();
        ctx.arc(btnE.x, btnE.y, btnE.r, 0, 6.28);
        ctx.fill();
        ctx.fillStyle = "#1e2436";
        drawActionIcon(ctx,'pickup',btnE.x,btnE.y-10,10);
        ctx.fillText("取貨", btnE.x, btnE.y + 20);
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
    if (!touch && elapsed < 12) {
      glassBox(ctx, bounds.left + 22, bounds.bottom - 112, 72, 30, 7, "rgba(12,16,28,0.62)", "rgba(255,255,255,0.25)", 1);
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = readableFont(12, "900");
      ctx.fillText("拖曳移動", bounds.left + 58, bounds.bottom - 92);
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
    fillScreen(ctx);

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
        ctx.font = readableFont(12, "900");
        ctx.textAlign = "left";
        fitText(ctx, WI[k].zh, sx + 38, barY + 22, 62);
        ctx.font = "900 11px sans-serif";
        ctx.fillText(`L${WL[k]}`, sx + 38, barY + 38);
      } else {
        ctx.save();
        ctx.setLineDash([3, 3]);
        glassBox(ctx, sx, barY + 7, 104, 38, 6, "rgba(10, 14, 24, 0.5)", "rgba(180, 195, 220, 0.35)", 1);
        ctx.fillStyle = "rgba(180, 195, 220, 0.4)";
        ctx.font = readableFont(11, "bold");
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
      ctx.font = readableFont(12, "bold");
      ctx.fillText(c.s || "", cx + 78, rowY + 51);

      const isNew = c.levelText && (c.levelText.includes("新") || c.levelText.includes("NEW"));
      glassBox(ctx, cx + 500, rowY + 14, 198, 28, 7, isNew ? "rgba(212, 175, 55, 0.25)" : "rgba(33, 150, 243, 0.2)", isNew ? "#ffd54f" : "#64b5f6", 1.2);
      ctx.textAlign = "center";
      ctx.fillStyle = isNew ? "#ffe082" : "#90caf9";
      ctx.font = readableFont(12, "900");
      fitText(ctx, c.levelText || "◆ 妖力精進", cx + 599, rowY + 33, 180);

      ctx.textAlign = "left";
      ctx.font = readableFont(14, "bold");
      ctx.fillStyle = "#ffffff";
      const lines = [];
      let line = "";
      for (const char of c.d || "") {
        if (ctx.measureText(line + char).width > 620 && line) { lines.push(line); line = ""; }
        line += char;
      }
      lines.push(line);
      lines.slice(0, 2).forEach((text, index) => fitText(ctx, text, cx + 78, rowY + 76 + index * 23, 620));
      ctx.fillStyle = "#98a9c5";
      ctx.font = readableFont(11, "900");
      ctx.textAlign = "center";
      fitText(ctx, isWeapon ? "【主動】" : "【被動】", cx + 350, rowY + 51, 180);
    });

    ctx.restore();
  }

  // 4. Boss 破防答題介面
  function bossQuizLayout(n) {
    const bounds = window.VIEWPORT?.hudBounds() || screenBounds();
    const scale = window.VIEWPORT?.get().scale || (document.getElementById('game')?.getBoundingClientRect().width || 900)/900;
    const left = bounds.left+18, right = bounds.right-208;
    const w = Math.min(690,right-left), gap = n===2 ? 36 : 24;
    const optW = Math.min(n===2 ? 260 : 200,(w-42-(n-1)*gap)/n);
    const optH = Math.max(46,Math.ceil(44/scale)), h = optH+59;
    const x = left+(right-left-w)/2, y = bounds.bottom-86-h;
    const startX = x+(w-n*optW-(n-1)*gap)/2;
    return {x,y,w,h,options:Array.from({length:n},(_,i)=>({x:startX+i*(optW+gap),y:y+46,w:optW,h:optH}))};
  }

  function drawBossQuiz(ctx, bossQ, mode = 'keyboard') {
    if (!bossQ) return;
    ctx.save();
    const layout = bossQuizLayout(bossQ.ans.length);
    const {x:bx,y:by,w:boxW,h:boxH} = layout;
    const mid = bx+boxW/2;

    glassBox(ctx, bx, by, boxW, boxH, 16, "rgba(20, 14, 34, 0.98)", "#ff5470", 2.5);

    const n = bossQ.ans.length;
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffeed4";
    ctx.font = readableFont(20, "900");
    if (bossQ.word.cue === "text" || !bossQ.word.icon) {
      ctx.fillText(`${bossQ.word.zh}　→　？`, mid, by + 30);
    } else {
      drawWordCue(ctx, bossQ.word, mid - 88, by + 22, 30);
      ctx.textAlign = "left";
      ctx.fillText(`${bossQ.word.zh}　→　？`, mid - 62, by + 30);
    }
    ctx.textAlign = "center";

    bossQ.ans.forEach((w, i) => {
      const {x:ox,y:oy,w:optW,h:optH} = layout.options[i];
      glassBox(ctx, ox, oy, optW, optH, 10, bossQ.lock > 0 ? "#333c57" : "#ffeed4", "#d4af37", 2);
      ctx.fillStyle = "#1e1829";
      ctx.font = readableFont(18, "900");
      const badge = mode === 'gamepad' ? ["LB", "RB", "Y"][i] : mode === 'touch' ? '' : i + 1;
      ctx.fillText(`${badge ? badge + ' ' : ''}${w.jp}`, ox + optW / 2, oy + optH/2+7, optW - 12);
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

  function drawCodex(ctx, STORE, ALL, tab = "cards", page = 0) {
    ctx.save();
    ctx.fillStyle = "rgba(10, 14, 26, 0.96)";
    fillScreen(ctx);

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
    ctx.font = readableFont(13, "900");
    drawActionIcon(ctx,'cards',tabCardsX+22,tabY+15,9);
    ctx.fillText("秘術卡片", tabCardsX + tabW / 2 + 12, tabY + 20);

    // 📜 百鬼單字卷 標籤
    const isWords = !isCards;
    glassBox(ctx, tabWordsX, tabY, tabW, tabH, 8, isWords ? "rgba(38, 52, 84, 0.95)" : "rgba(18, 22, 38, 0.75)", isWords ? "#ffd54f" : "rgba(212, 175, 55, 0.4)", isWords ? 2 : 1.2);
    ctx.fillStyle = isWords ? "#ffe28b" : "rgba(255, 235, 180, 0.65)";
    ctx.font = readableFont(13, "900");
    drawActionIcon(ctx,'codex',tabWordsX+22,tabY+15,9);
    ctx.fillText("單字圖鑑", tabWordsX + tabW / 2 + 12, tabY + 20);

    if (isCards) {
      // 3. 卡片一覽表格頁面
      ctx.font = readableFont(13, "bold");
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
      ctx.font = readableFont(13, "900");
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
        ctx.font = readableFont(13, "900");
        ctx.fillText(c.name, 86, midY);

        // 2. 日文名稱
        ctx.textAlign = "center";
        ctx.fillStyle = "#ffe082";
        ctx.font = readableFont(13, "bold");
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
        ctx.font = readableFont(11, "900");
        ctx.fillText(c.type, 340, midY + 0.5);

        // 4. 招式說明
        ctx.textAlign = "left";
        ctx.fillStyle = "#e0e6ed";
        ctx.font = readableFont(12, "bold");
        ctx.fillText(c.desc, 410, midY);
      });
      ctx.textBaseline = "alphabetic";

    } else {
      // 3. 百鬼單字卷頁面 (36 個妖怪單字)
      ctx.font = readableFont(13, "bold");
      ctx.fillStyle = "#cad7f5";
      ctx.fillText(`答對升星、答錯降星；較不熟的單字會更常出現。 ${page + 1}/${Math.max(1, Math.ceil(ALL.length / 15))}`, W / 2, 102);

      const mastered = ALL.filter(w => STORE.get(w.jp).box >= 4).length;
      const compact = false;
      const columns = 5, cardW = 154, cardH = 118;
      const stepX = 166, stepY = 132, startX = 40, startY = 128;
      for (const [x, label] of [[40, "‹"], [796, "›"]]) {
        glassBox(ctx, x, 78, 64, 40, 8);
        ctx.fillStyle = "#ffe28b";
        ctx.font = "900 28px sans-serif";
        ctx.fillText(label, x + 32, 107);
      }
      ALL.slice(page * 15, page * 15 + 15).forEach((w, i) => {
        const col = i % columns;
        const row = (i / columns) | 0;
        const cx = startX + col * stepX;
        const cy = startY + row * stepY;

        const m = STORE.get(w.jp);
        const seen = (m.ok + m.ng) > 0;

        glassBox(ctx, cx, cy, cardW, cardH, 8, seen ? "#fcf4e3" : "#20273a", seen ? "#d4af37" : "#36415a", 1.5);

        ctx.textAlign = "center";
        ctx.fillStyle = seen ? "#1e1829" : "#e7ecff";
        ctx.font = compact ? "20px sans-serif" : "24px sans-serif";
        if (seen) drawWordCue(ctx, w, cx + cardW / 2, cy + 23, 26);
        else ctx.fillText("？", cx + cardW / 2, cy + (compact ? 27 : 32));

        ctx.font = readableFont(20, "900");
        ctx.fillText(seen ? w.jp : "？？", cx + cardW / 2, cy + (compact ? 48 : 56));

        if (seen) {
          ctx.font = readableFont(18, "700");
          ctx.fillStyle = "#63503c";
          ctx.fillText(w.zh, cx + cardW / 2, cy + (compact ? 64 : 74));

          ctx.fillStyle = "#d48819";
          ctx.font = readableFont(16, "700");
          ctx.fillText("★".repeat(m.box) + "☆".repeat(4 - m.box), cx + cardW / 2, cy + (compact ? 94 : 107));
        }
      });

      ctx.font = readableFont(14, "900");
      ctx.fillStyle = "#ffe28b";
      ctx.fillText(`←/→ 翻頁・Tab 或 LB/RB 頁籤　精通 ${mastered}/${ALL.length}`, W / 2, 545);
    }

    // 4. 底部返回按鈕
    glassBox(ctx, W / 2 - 85, 554, 170, 32, 8, "#d4af37", "#ffffff", 1.5);
    ctx.textAlign = "center";
    ctx.fillStyle = "#1a162b";
    ctx.font = readableFont(14, "900");
    ctx.fillText("返回 [ESC / C / B]", W / 2, 574);

    ctx.restore();
  }

  // 結算：同一條夜路壓暗，左邊站著快遞員，中間是今夜的帳。
  function drawEndScreen(ctx, state, score, delivered, failed, misses, focus = 0) {
    ctx.save();
    const isWon = state === "won";

    ctx.fillStyle = "rgba(6, 8, 18, 0.76)";
    fillScreen(ctx);
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
    fillScreen(ctx);
    const vig = ctx.createRadialGradient(W / 2, 250, 80, W / 2, 280, 520);
    vig.addColorStop(0, "rgba(6, 8, 18, 0.42)");
    vig.addColorStop(1, "rgba(6, 8, 18, 0)");
    ctx.fillStyle = vig;
    fillScreen(ctx);

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
    ctx.font = readableFont(14, "700");
    ctx.fillStyle = "rgba(255, 236, 214, 0.72)";
    ctx.fillText(isWon ? "這一夜的配達，送到天明" : "燈滅了，路還留在原處", mid, cardY + 78);

    ctx.strokeStyle = "rgba(232, 188, 106, 0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cardX + 48, cardY + 98);
    ctx.lineTo(cardX + cardW - 48, cardY + 98);
    ctx.stroke();

    ctx.font = readableFont(13, "700");
    ctx.fillStyle = "rgba(255, 226, 180, 0.7)";
    ctx.fillText("今夜功績", mid, cardY + 128);
    ctx.font = "900 54px 'Kaisei Decol', serif";
    ctx.fillStyle = "#fff1cc";
    ctx.fillText(score.toLocaleString(), mid, cardY + 186);

    ctx.font = readableFont(18, "700");
    ctx.fillStyle = "#f4e7cf";
    ctx.fillText(`送達  ${delivered} 件`, mid - 110, cardY + 232);
    ctx.fillStyle = failed > 0 ? "#f0b8b4" : "#f4e7cf";
    ctx.fillText(`誤配  ${failed} 件`, mid + 110, cardY + 232);

    const reviewWords = [...new Map((misses || []).map(w => [w.jp, w])).values()];
    const reviewList = reviewWords.slice(0, 5);
    ctx.font = readableFont(15, "700");
    if (reviewList.length > 0) {
      ctx.fillStyle = "rgba(255, 214, 196, 0.86)";
      ctx.fillText(`今夜記錯的字：共 ${reviewWords.length} 字${reviewWords.length > 5 ? "，僅顯示前 5 字" : ""}`, mid, cardY + 278);
      ctx.font = readableFont(16, "700");
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

    const drawEndButton = (btn, label, primary = false) => {
      ctx.fillStyle = primary ? "#1a140e" : "rgba(16, 20, 32, 0.94)";
      ctx.beginPath();
      ctx.roundRect(btn.x, btn.y, btn.w, btn.h, 8);
      ctx.fill();
      ctx.strokeStyle = primary ? "#e6c27a" : "rgba(220, 226, 238, 0.55)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = primary ? "#ffe3ad" : "#edf2ff";
      ctx.font = readableFont(18, "900");
      ctx.fillText(label, btn.x + btn.w / 2, btn.y + 31);
    };
    drawEndButton(RESTART_BTN, "再踏夜行", true);
    drawEndButton(WORLD_BTN, "回旅路地圖");
    drawEndButton(HOME_BTN, "回到首頁");
    drawMenuFocus(ctx, END_BTNS[focus]);

    ctx.restore();
  }

  // 7. 暫停與系統設定選單 (日式黑漆金箔和風御札)
  const PAUSE_BTNS = [
    { id: "resume", label: "◆ 繼 續 夜 行 ◆", y: 180 },
    { id: "cards", label: "◆ 秘 術 卡 片 一 覽 ◆", y: 232 },
    { id: "codex", label: "◆ 百 鬼 單 字 卷 ◆", y: 284 },
    { id: "mute", label: "◆ 聲 音 音 效 ： 開 ◆", labelMuted: "◆ 聲 音 音 效 ： 關 ◆", y: 336 },
    { id: "controls", label: "◆ 操作與自定義 ◆", y: 388 },
    { id: "tutorial", label: "◆ 重看操作教學 ◆", y: 440 },
    { id: "menu", label: "◆ 返 回 主 選 單 ◆", y: 492 }
  ];
  function pauseButtons() {
    const compact = (window.VIEWPORT?.get().scale || 1) < 0.8;
    return PAUSE_BTNS.map((b,i)=>compact
      ? {...b,x:i%2?470:70,y:190+Math.floor(i/2)*85,w:360,h:70}
      : {...b,x:310,w:280,h:44});
  }

  function drawPauseMenu(ctx, muted, focus = 0) {
    ctx.save();
    ctx.fillStyle = "rgba(6, 8, 16, 0.92)";
    fillScreen(ctx);

    ctx.textAlign = "center";
    ctx.font = "900 36px 'Kaisei Decol', 'Noto Sans JP', serif";
    ctx.fillStyle = "#ffe28b";
    ctx.shadowColor = "rgba(255, 215, 100, 0.6)";
    ctx.shadowBlur = 14;
    ctx.fillText("— 暫 歇 —", W / 2, 138);
    ctx.shadowBlur = 0;

    ctx.font = readableFont(12, "bold");
    ctx.fillStyle = "rgba(255, 235, 180, 0.55)";
    ctx.fillText("SYSTEM PAUSE", W / 2, 164);

    pauseButtons().forEach((b, i) => {
      let label = b.label;
      if (b.id === "mute") {
        label = muted ? b.labelMuted : b.label;
      }
      glassBox(ctx, b.x, b.y, b.w, b.h, 10, "rgba(18, 22, 36, 0.95)", "rgba(212, 175, 55, 0.8)", 1.6);
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffeed4";
      ctx.font = readableFont(15, "900");
      ctx.fillText(label, b.x+b.w/2, b.y+b.h/2+6);
      if(i === focus) drawMenuFocus(ctx,b);
    });

    ctx.fillStyle = "rgba(255, 235, 180, 0.45)";
    ctx.font = readableFont(12, "");
    ctx.fillText("[ ↑↓ 選擇 · Enter/A 確認 · Esc/B 繼續 ]", W / 2, 570);

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
    const bounds = screenBounds();
    ctx.strokeRect(bounds.left + 7, bounds.top + 7, bounds.width - 14, bounds.height - 14);

    ctx.fillStyle = `rgba(255, 20, 20, ${alpha * 0.14})`;
    fillScreen(ctx);

    // 2. 中央神社朱漆警報木匾
    const bw = 460, bh = 72;
    const bx = (bounds.left+bounds.right-bw)/2, by = bounds.top+110;

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
    ctx.font = readableFont(12, "900");
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
    ctx.font = readableFont(13, "900");
    ctx.fillStyle = "#ffcdd2";
    ctx.fillText("— 妖 氣 逼 近 ！ 請 準 備 迎 戰 —", W / 2, by + 57);

    ctx.restore();
  }

  function fitText(ctx, text, x, y, maxWidth) {
    ctx.save();
    const width = ctx.measureText(text).width;
    if (width > maxWidth) {
      ctx.font = ctx.font.replace(/([\d.]+)px/, (_, size) => `${Number(size) * maxWidth / width}px`);
    }
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  // 天氣圖案不依賴 Emoji 字型；抽象方向與缺圖單字使用中文語意。
  function drawWordCue(ctx, word, x, y, size = 28) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (!word || word.cue === "text" || !word.icon) {
      ctx.font = readableFont(Math.min(size, 18), "900");
      fitText(ctx, word?.zh || "？", x, y, size * 2);
    } else if (["ame", "kaze", "kumo", "kiri", "kaminari", "yuki"].includes(word.cue)) {
      ctx.translate(x, y);
      ctx.scale(size / 32, size / 32);
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#409bb7";
      if (["ame", "kumo", "kiri", "kaminari"].includes(word.cue)) {
        ctx.fillStyle = "#dce9f3";
        ctx.beginPath();
        ctx.moveTo(-12, 3);
        ctx.bezierCurveTo(-20, 3, -18, -8, -10, -7);
        ctx.bezierCurveTo(-9, -18, 8, -18, 10, -7);
        ctx.bezierCurveTo(20, -9, 21, 3, 12, 3);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#688ca2";
        ctx.stroke();
        ctx.strokeStyle = "#409bb7";
      }
      if (word.cue === "ame") {
        ctx.beginPath();
        for (const dx of [-9, 0, 9]) { ctx.moveTo(dx, 7); ctx.lineTo(dx - 3, 14); }
        ctx.stroke();
      } else if (word.cue === "kiri") {
        ctx.strokeStyle = "#6e8896";
        ctx.beginPath();
        for (const dy of [7, 12, 17]) { ctx.moveTo(-15, dy); ctx.lineTo(15, dy); }
        ctx.stroke();
      } else if (word.cue === "kaminari") {
        ctx.fillStyle = "#ffd54f";
        ctx.beginPath();
        ctx.moveTo(1, 3); ctx.lineTo(-7, 11); ctx.lineTo(-1, 11);
        ctx.lineTo(-4, 20); ctx.lineTo(10, 7); ctx.lineTo(4, 7); ctx.lineTo(7, 3);
        ctx.closePath(); ctx.fill();
      } else if (word.cue === "kaze") {
        ctx.beginPath();
        for (const dy of [-8, 0, 8]) {
          ctx.moveTo(-16, dy); ctx.lineTo(8, dy);
          ctx.bezierCurveTo(21, dy, 15, dy - 11, 10, dy - 5);
        }
        ctx.stroke();
      } else if (word.cue === "yuki") {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = i * Math.PI / 3, c = Math.cos(a), s = Math.sin(a);
          ctx.moveTo(0, 0); ctx.lineTo(c * 15, s * 15);
          for (const side of [-1, 1]) {
            ctx.moveTo(c * 9, s * 9);
            ctx.lineTo(c * 9 + Math.cos(a + side * 2.2) * 5, s * 9 + Math.sin(a + side * 2.2) * 5);
          }
        }
        ctx.stroke();
      }
    } else {
      ctx.font = `${size}px 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif`;
      ctx.fillText(word.icon, x, y);
    }
    ctx.restore();
  }

  function drawHintText(ctx, text, x, y, width) {
    ctx.save();
    ctx.font = readableFont(12, "bold");
    const lines = []; let line = "";
    for (const char of text) {
      if (line && ctx.measureText(line + char).width > width - 24) { lines.push(line); line = ""; }
      line += char;
    }
    if (line) lines.push(line);
    const lineHeight = Number(ctx.font.match(/([\d.]+)px/)[1]) * 1.35;
    glassBox(ctx, x, y, width, lines.length * lineHeight + 16, 8, "rgba(12,16,28,0.94)", "#ffd54f");
    ctx.textAlign = "left";ctx.fillStyle = "#ffd54f";
    lines.forEach((value, i) => ctx.fillText(value, x + 12, y + 8 + lineHeight * (i + 0.8)));
    ctx.restore();
  }

  function readableFont(size, weight = "700") {
    const scale = window.VIEWPORT?.get().scale || (document.getElementById("game")?.getBoundingClientRect().width || 900) / 900;
    const readable = scale < 1 ? Math.max(size, Math.min(28, Math.ceil(14 / scale))) : size;
    return `${weight || "700"} ${readable}px 'Noto Sans JP', 'Microsoft JhengHei', sans-serif`;
  }

  return {
    readableFont,
    drawHintText,
    controlLabel, tutorialCopy, drawTutorial, drawActionIcon, TUTORIAL_BTNS,
    drawWordCue,
    drawMainMenu,
    drawHud,
    drawLevelUp,
    drawEmblem,
    drawBossQuiz, bossQuizLayout,
    drawCodex,
    drawEndScreen,
    drawPauseMenu,
    drawSurgeWarning,
    PAUSE_BTNS, pauseButtons, MENU_BTNS, END_BTNS, EXIT_BTNS, drawExitConfirm,
    PAUSE_BTN_W: 280,
    PAUSE_BTN_H: 44,
    RESTART_BTN,
    WORLD_BTN,
    HOME_BTN,
    MENU_START_BTN,
    MENU_CONTROLS_BTN,
    HINT_BTN,
    CARD_LIST
  };
})();
