// 使用者介面（UI）：漆器金箔和風介面。面板、按鈕、HUD、升級卡與結算頁共用同一組色票與繪製函式。
// 光暈優先使用 FX.glow 的預烘焙貼圖；面板仍使用漸層，圖鑑標題保留少量 shadowBlur。
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
  const REROLL_BTN = { x: 620, y: 538, w: 190, h: 44 };
  const TUTORIAL_BTNS = [{x:100,y:390,w:330,h:70},{x:470,y:390,w:330,h:70}];
  const EXIT_BTNS = [{id:'exit-cancel',x:195,y:330,w:240,h:70},{id:'exit-confirm',x:465,y:330,w:240,h:70}];

  // ---- 色票與共用繪製工具 ----
  const C = {
    gold: "#e8c36a", goldHi: "#fff0b8", ink: "#0a0d18", vermilion: "#e0523f",
    jade: "#46c99a", azure: "#4aa3ff", violet: "#b36bff", cyan: "#7fe3f0",
    text: "#fff3da", dim: "rgba(255, 240, 210, 0.68)"
  };
  const WEAPON_TONE = { katana: "#e0523f", barrier: "#4aa3ff", fire: "#ff8a1f", boom: "#b36bff", thunder: "#ffd54f", needle: "#7fe3f0" };
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const calm = () => !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const glow = (ctx, x, y, size, color, alpha) => window.FX?.glow(ctx, x, y, size, color, alpha);
  const pulse = (speed = 3, lo = 0.6) => calm() ? 0.85 : lo + (1 - lo) * (0.5 + 0.5 * Math.sin(Date.now() / 1000 * speed));
  const fontPx = font => Number(font.match(/([\d.]+)px/)[1]);

  const sheenCache = new Map();
  const barCache = new WeakMap();
  const BAR_COLORS = {
    oil: [[0,"#ff6a13"],[0.6,"#ffb42e"],[1,"#ffe28a"]],
    lowOil: [[0,"#d4141f"],[1,"#ff7a43"]],
    xp: [[0,"#2b7bff"],[1,"#7fe3f0"]],
    dawn: [[0,"#4a5bd8"],[0.7,"#ff8a4a"],[1,"#ffe28a"]],
    boss: [[0,"#b3122a"],[0.6,"#ff4d3a"],[1,"#ffb347"]]
  };
  function barGradient(ctx, kind, x0, x1, transform = ctx.getTransform?.()) {
    let cache = barCache.get(ctx);
    if (!cache) { cache = new Map(); barCache.set(ctx,cache); }
    const old = cache.get(kind), a = old?.transform, b = transform;
    if (old && old.x0 === x0 && old.x1 === x1 &&
        a?.a === b?.a && a?.b === b?.b && a?.c === b?.c && a?.d === b?.d && a?.e === b?.e && a?.f === b?.f) return old.gradient;
    const gradient = ctx.createLinearGradient(x0,0,x1,0);
    for (const [offset,color] of BAR_COLORS[kind]) gradient.addColorStop(offset,color);
    cache.set(kind,{x0,x1,transform,gradient});
    return gradient;
  }
  function sheen(ctx, h) {
    const key = Math.round(h);
    let g = sheenCache.get(key);
    if (!g) {
      g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "rgba(255, 244, 214, 0.17)");
      g.addColorStop(0.45, "rgba(255, 244, 214, 0.02)");
      g.addColorStop(1, "rgba(0, 0, 0, 0.2)");
      sheenCache.set(key, g);
    }
    return g;
  }

  // 漆器面板：底影、本體、頂部高光、內側金線、外框；ornate 再加四角金具。
  function glassBox(ctx, x, y, w, h, r = 10, fill = "rgba(14, 18, 30, 0.84)", stroke = "rgba(232, 195, 106, 0.6)", strokeW = 1.5, ornate = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(0, 0, 0, 0.36)";
    ctx.beginPath();
    ctx.roundRect(0, 3, w, h, r);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.fillStyle = sheen(ctx, h);
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = strokeW;
      ctx.stroke();
    }
    if (w > 40 && h > 26) {
      ctx.beginPath();
      ctx.roundRect(3.5, 3.5, w - 7, h - 7, Math.max(2, r - 3));
      ctx.strokeStyle = "rgba(255, 226, 150, 0.16)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    if (ornate) {
      ctx.strokeStyle = C.gold;
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      const d = Math.min(18, w / 5, h / 5);
      for (const [cx, cy, sx, sy] of [[5, 5, 1, 1], [w - 5, 5, -1, 1], [5, h - 5, 1, -1], [w - 5, h - 5, -1, -1]]) {
        ctx.beginPath();
        ctx.moveTo(cx, cy + d * sy);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx + d * sx, cy);
        ctx.stroke();
        ctx.fillStyle = C.goldHi;
        ctx.beginPath();
        ctx.arc(cx + 5 * sx, cy + 5 * sy, 1.7, 0, 6.283);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawMenuFocus(ctx, btn) {
    if (!btn) return;
    const p = pulse(5, 0.55);
    ctx.save();
    ctx.lineJoin = "round";
    ctx.beginPath(); ctx.roundRect(btn.x - 4, btn.y - 4, btn.w + 8, btn.h + 8, 13);
    ctx.strokeStyle = `rgba(127, 227, 240, ${0.1 + 0.12 * p})`; ctx.lineWidth = 10; ctx.stroke();
    ctx.strokeStyle = `rgba(127, 227, 240, ${0.6 + 0.4 * p})`; ctx.lineWidth = 2.6; ctx.stroke();
    ctx.fillStyle = C.cyan;
    for (const [cx, cy] of [[btn.x - 4, btn.y - 4], [btn.x + btn.w + 4, btn.y - 4], [btn.x - 4, btn.y + btn.h + 4], [btn.x + btn.w + 4, btn.y + btn.h + 4]]) {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI / 4); ctx.fillRect(-3, -3, 6, 6); ctx.restore();
    }
    ctx.restore();
  }

  const BUTTON_TONES = {
    normal: { fill: "rgba(24, 20, 36, 0.95)", stroke: "rgba(232, 195, 106, 0.75)", width: 1.6, text: C.text },
    primary: { fill: "rgba(92, 30, 24, 0.97)", stroke: C.gold, width: 2.4, text: "#fff1cc" },
    danger: { fill: "rgba(58, 20, 24, 0.96)", stroke: "#e7a090", width: 1.6, text: "#ffd2c8" },
    cyan: { fill: "rgba(24, 52, 66, 0.95)", stroke: "#80deea", width: 1.6, text: "#e0fbff" }
  };
  // 所有按鈕共用：同一組字級、狀態與焦點樣式。
  function drawButton(ctx, b, label, { tone = "normal", size = 18, focus = false, icon = null, disabled = false } = {}) {
    const t = BUTTON_TONES[tone] || BUTTON_TONES.normal;
    glassBox(ctx, b.x, b.y, b.w, b.h, Math.min(12, b.h / 4), disabled ? "rgba(34, 36, 46, 0.9)" : t.fill, disabled ? "#59606f" : t.stroke, t.width);
    if (tone === "primary" && !disabled) {
      ctx.fillStyle = "rgba(255, 170, 120, 0.16)";
      ctx.beginPath(); ctx.roundRect(b.x + 4, b.y + 4, b.w - 8, b.h * 0.4, 8); ctx.fill();
    }
    ctx.textAlign = "center";
    ctx.font = readableFont(size, "900");
    const y = b.y + b.h / 2 + fontPx(ctx.font) * 0.35, x = b.x + b.w / 2 + (icon ? 10 : 0);
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillText(label, x, y + 1.5, b.w - 24);
    ctx.fillStyle = disabled ? "#8a91a0" : t.text;
    ctx.fillText(label, x, y, b.w - 24);
    if (icon) { ctx.fillStyle = ctx.strokeStyle = disabled ? "#8a91a0" : C.gold; drawActionIcon(ctx, icon, b.x + 24, b.y + b.h / 2, 9); }
    if (focus) drawMenuFocus(ctx, b);
  }

  function drawExitConfirm(ctx, focus = 0) {
    ctx.save();
    ctx.fillStyle = 'rgba(6,8,18,0.84)';fillScreen(ctx);
    glassBox(ctx,160,160,580,270,16,'rgba(16,14,26,0.97)',C.gold,2,true);
    ctx.textAlign = 'center';ctx.fillStyle = '#ffe3ad';ctx.font = readableFont(24,'900');
    ctx.fillText('是否放棄本局？',450,215);
    ctx.fillStyle = '#edf2ff';ctx.font = readableFont(15);
    ctx.fillText('將返回首頁，本局未結算的成績不會記錄。',450,260);
    ctx.fillText('已儲存的單字學習紀錄會保留。',450,290);
    EXIT_BTNS.forEach((b,i)=>drawButton(ctx,b,i===0?'繼續本局':'放棄並回首頁',{tone:i===0?'cyan':'danger',focus:i===focus}));
    ctx.restore();
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
    if (id === 'pickup') {
      // 暫以系統包裹 emoji 代用，之後再換原創圖檔。
      ctx.save();
      ctx.font = `${Math.round(r * 2)}px 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('📦', x, y + 1);
      ctx.restore();
      return;
    }
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
    ctx.save(); ctx.fillStyle='rgba(6,8,16,0.8)'; fillScreen(ctx);
    glassBox(ctx,60,115,780,375,14,'rgba(18,16,30,0.97)',C.gold,2,true);
    glow(ctx,100,155,84,C.gold,0.35);
    ctx.fillStyle=C.goldHi; ctx.strokeStyle=C.goldHi; drawActionIcon(ctx,icon,100,155,16);
    ctx.textAlign='left';ctx.font=readableFont(24,'900');ctx.fillText(title,130,165);
    ctx.fillStyle='#e9e4d6';ctx.font=readableFont(18,'bold');
    let line='', y=211;
    for (const char of body) {
      if (ctx.measureText(line+char).width > 690 && !'，。；：、！？'.includes(char)) {ctx.fillText(line,100,y);y+=fontPx(ctx.font)*1.25;line='';}
      line+=char;
    }
    ctx.fillText(line,100,y);
    ctx.fillStyle='#80deea';ctx.font=readableFont(15,'bold');
    ctx.fillText('操作教學不扣油、不算答題輔助；閱讀期間遊戲暫停。',100,360);
    const labels = [tutorial.replay && tutorial.id !== 'boss' ? '下一張' : '知道了', tutorial.replay ? '結束重看' : '跳過全部教學'];
    TUTORIAL_BTNS.forEach((bt,i)=>drawButton(ctx,bt,labels[i],{tone:i===0?'primary':'normal',focus:tutorial.focus===i}));
    ctx.textAlign='center';ctx.font=readableFont(12,'bold');ctx.fillStyle='#b7bdc8';
    ctx.fillText(mode==='gamepad'?'十字鍵選擇 · A 確認 · B 結束':mode==='touch'?'點選按鈕 · 暫停選單可重看':'Tab／方向鍵選擇 · Enter 確認 · Esc 結束',450,482);
    ctx.restore();
  }

  const MENU_BTNS = [{id:'start',...MENU_START_BTN},{id:'controls',...MENU_CONTROLS_BTN},{id:'cards',x:615,y:22,w:125,h:38},{id:'codex',x:755,y:22,w:125,h:38}];
  const END_BTNS = [{id:'restart',...RESTART_BTN},{id:'world',...WORLD_BTN},{id:'menu',...HOME_BTN}];

  // 1. 主選單：封面圖＋暖色光暈與上升的火星，主要行動只有一個大按鈕。
  function drawAssetProgress(ctx) {
    const p = window.ART_PROGRESS;
    if (!p || p.settled >= p.total) return;
    const b = screenBounds(), x = (b.left+b.right)/2, y = b.top+104;
    ctx.save();
    glassBox(ctx,x-180,y-28,360,62,10,"rgba(12,16,28,0.94)",C.gold);
    ctx.textAlign = "center"; ctx.font = readableFont(15,"700"); ctx.fillStyle = C.text;
    ctx.fillText(`圖像準備 ${p.settled} / ${p.total}`,x,y);
    ctx.fillStyle = "#393441"; ctx.fillRect(x-158,y+14,316,5);
    ctx.fillStyle = C.gold; ctx.fillRect(x-158,y+14,316*p.settled/p.total,5);
    ctx.restore();
  }
  function drawMainMenu(ctx, STORE, elapsed, focus = 0) {
    ctx.save();
    const motion = !calm();
    if (window.ART?.cover) {
      const zoom = motion ? 1 + Math.sin(elapsed * 0.8) * 0.012 : 1;
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

    const b = screenBounds();
    const vig = ctx.createLinearGradient(0, 0, 0, H);
    vig.addColorStop(0, "rgba(6, 9, 20, 0.5)");
    vig.addColorStop(0.55, "rgba(6, 9, 20, 0.5)");
    vig.addColorStop(1, "rgba(6, 9, 20, 0.97)");
    ctx.fillStyle = vig;
    fillScreen(ctx);

    // 暖光層：緩慢呼吸的燈籠光暈與往上飄的火星。
    if (motion) {
      glow(ctx, W * 0.5, H * 0.46, 620, "#ffb04a", 0.1 + 0.05 * Math.sin(elapsed * 1.7));
      for (let i = 0; i < 16; i++) {
        const life = (elapsed * 0.09 + i * 0.137) % 1;
        const x = b.left + (((i * 211 + 30 + Math.sin(elapsed * 0.6 + i) * 24) % b.width) + b.width) % b.width;
        const y = b.bottom - life * (b.height + 40) + 20;
        glow(ctx, x, y, 12 + (i % 4) * 5, i % 3 ? "#ffd27a" : "#ff8a4a", Math.sin(life * Math.PI) * 0.8);
      }
    }

    ctx.textAlign = "center";
    ctx.font = titleFont(24);
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillText("百鬼橫行之夜・單字配達物語", W / 2 + 1.5, 441.5);
    ctx.fillStyle = "#ffe28b";
    ctx.fillText("百鬼橫行之夜・單字配達物語", W / 2, 440);

    drawButton(ctx, MENU_START_BTN, "旅路地圖", { tone: "primary", size: 22, icon: "pickup" });
    if (motion) glow(ctx, W / 2, MENU_START_BTN.y + MENU_START_BTN.h / 2, 380, C.gold, 0.08 + 0.05 * Math.sin(elapsed * 3));

    ctx.fillStyle = C.dim;
    ctx.font = readableFont(13, "bold");
    ctx.fillText(`夜行紀錄：最高得分 ${STORE.data.best || 0} 點｜最高配達 ${STORE.data.bestDel || 0} 件`, W / 2, 565);

    for (const bt of MENU_BTNS.slice(1)) {
      const label = bt.id === "controls" ? "操作與自定義" : bt.id === "cards" ? "卡片一覽" : "單字圖鑑";
      drawButton(ctx, bt, label, { size: 13, icon: bt.id === "cards" ? "cards" : bt.id === "codex" ? "codex" : null });
    }
    drawMenuFocus(ctx, MENU_BTNS[focus]);
    drawAssetProgress(ctx);

    ctx.restore();
  }

  // ---- HUD 元件 ----
  function drawLantern(ctx, x, y, s, lit) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s / 16, s / 16);
    glow(ctx, 0, 0, 34, lit, 0.55);
    ctx.fillStyle = lit;
    ctx.beginPath(); ctx.ellipse(0, 0, 6.2, 8, 0, 0, 6.283); ctx.fill();
    ctx.strokeStyle = "rgba(90, 30, 8, 0.7)"; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.moveTo(-4.2, -4.8); ctx.lineTo(4.2, -4.8); ctx.moveTo(-4.2, 4.8); ctx.lineTo(4.2, 4.8); ctx.stroke();
    ctx.fillStyle = "#2c2118"; ctx.fillRect(-4.4, -10.5, 8.8, 3); ctx.fillRect(-4.4, 7.5, 8.8, 3);
    ctx.fillStyle = "rgba(255, 255, 255, 0.55)"; ctx.beginPath(); ctx.ellipse(-2, -2.5, 1.4, 3, 0, 0, 6.283); ctx.fill();
    ctx.restore();
  }

  const lowOilCache = new Map();
  // 燈油見底：四周泛紅並隨心跳明滅，越接近 0 越快。
  function drawLowOil(ctx, ratio, time) {
    const b = screenBounds(), key = `${Math.round(b.width)}x${Math.round(b.height)}`;
    let g = lowOilCache.get(key);
    if (!g) {
      const cx = b.left + b.width / 2, cy = b.top + b.height / 2, far = Math.hypot(b.width, b.height) / 2;
      g = ctx.createRadialGradient(cx, cy, Math.min(b.width, b.height) * 0.3, cx, cy, far);
      g.addColorStop(0, "rgba(255, 30, 40, 0)");
      g.addColorStop(1, "rgba(255, 30, 40, 0.6)");
      lowOilCache.set(key, g);
    }
    const urgency = 1 - ratio / 0.25;
    const beat = calm() ? 0.7 : 0.55 + 0.45 * Math.max(0, Math.sin(time * (5 + urgency * 5)));
    ctx.save();
    ctx.globalAlpha = (0.4 + 0.5 * urgency) * beat;
    ctx.fillStyle = g;
    fillScreen(ctx);
    ctx.restore();
  }

  function drawMinimap(ctx, x, y, w, h, P, orders, job, boss, time) {
    glassBox(ctx, x, y, w, h, 12, "rgba(8, 12, 24, 0.8)", "rgba(232, 195, 106, 0.75)", 1.6);
    const cx = x + w / 2, cy = y + h / 2, hx = w / 2 - 9, hy = h / 2 - 9, R = 1300, k = hx / R;
    ctx.save();
    ctx.beginPath(); ctx.roundRect(x + 3, y + 3, w - 6, h - 6, 10); ctx.clip();
    ctx.strokeStyle = "rgba(127, 227, 240, 0.12)"; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, y); ctx.lineTo(cx, y + h); ctx.moveTo(x, cy); ctx.lineTo(x + w, cy);
    ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx, cy, hx * 0.5, hx * 0.5, 0, 0, 6.283); ctx.stroke();
    const place = (wx, wy) => {
      let dx = (wx - P.x) * k, dy = (wy - P.y) * k;
      const f = Math.max(Math.abs(dx) / hx, Math.abs(dy) / hy);
      const edge = f > 1;
      if (edge) { dx /= f; dy /= f; }
      return { x: cx + dx, y: cy + dy, edge };
    };
    for (const o of orders) {
      const m = place(o.from.x, o.from.y), urgent = o.life < 25;
      const color = urgent ? "#ff6b5b" : o.life < 55 ? "#ffb347" : C.gold;
      glow(ctx, m.x, m.y, m.edge ? 12 : 18, color, urgent ? 0.5 + 0.4 * pulse(8, 0) : 0.7);
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.edge ? 2.6 : 3.8, 0, 6.283); ctx.fill();
    }
    if (job) {
      const m = place(job.to.x, job.to.y), p = pulse(5, 0.5);
      glow(ctx, m.x, m.y, 30, C.cyan, 0.6 * p);
      ctx.fillStyle = C.cyan;
      ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(Math.PI / 4); ctx.fillRect(-4, -4, 8, 8); ctx.restore();
    }
    if (boss) {
      const m = place(boss.x, boss.y), p = pulse(7, 0.4);
      glow(ctx, m.x, m.y, 34, "#ff3b4f", 0.7 * p);
      ctx.fillStyle = "#ff3b4f";
      ctx.beginPath(); ctx.arc(m.x, m.y, 5, 0, 6.283); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.fillRect(m.x - 0.9, m.y - 2.8, 1.8, 3.4); ctx.fillRect(m.x - 0.9, m.y + 1.4, 1.8, 1.5);
    }
    glow(ctx, cx, cy, 24, "#ffffff", 0.7);
    ctx.fillStyle = "#fff";
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(P.faceAng || 0);
    ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-3.4, -3.8); ctx.lineTo(-1.4, 0); ctx.lineTo(-3.4, 3.8); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  // 無底框文字：用深色描邊取代方塊，字直接浮在場景上仍清楚。
  function inkText(ctx, text, x, y, maxWidth) {
    ctx.save();
    ctx.lineJoin = "round"; ctx.lineWidth = 4; ctx.strokeStyle = "rgba(6, 8, 18, 0.85)";
    if (maxWidth) ctx.strokeText(text, x, y, maxWidth); else ctx.strokeText(text, x, y);
    ctx.restore();
    if (maxWidth) ctx.fillText(text, x, y, maxWidth); else ctx.fillText(text, x, y);
  }

  // 固定位置的方向羅盤：箭頭原地轉向目標，不再貼著畫面邊緣跑。count=2 為 Boss 用的雙箭頭。
  function drawCompass(ctx, x, y, angle, { color = "#ffd152", count = 1, size = 1 } = {}) {
    if (angle == null) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.scale(size, size);
    ctx.fillStyle = color; ctx.strokeStyle = "rgba(6, 8, 18, 0.85)"; ctx.lineWidth = 3; ctx.lineJoin = "round";
    for (let k = 0; k < count; k++) {
      const off = (k - (count - 1) / 2) * -8;
      ctx.beginPath();
      ctx.moveTo(11 + off, 0); ctx.lineTo(-7 + off, -9); ctx.lineTo(-3 + off, 0); ctx.lineTo(-7 + off, 9);
      ctx.closePath(); ctx.stroke(); ctx.fill();
    }
    ctx.restore();
  }

  // 委託總覽：最急的先列，色條＝剩餘時間，箭頭＝房屋方向。不加底框，正在互動的那筆左側亮金線。
  function drawOrderList(ctx, x, y, w, rowH, orders, P, inter) {
    const rows = [...orders].sort((a, b) => a.life - b.life);
    rows.slice(0, 3).forEach((o, i) => {
      const ry = y + i * (rowH + 4), urgent = o.life < 25, ratio = clamp(o.life / 110, 0, 1);
      const tone = urgent ? "#ff6b5b" : ratio < 0.5 ? "#ffb347" : C.gold;
      ctx.fillStyle = "rgba(6, 8, 18, 0.55)";
      ctx.fillRect(x + 7, ry + rowH - 5, w - 14, 2.6);
      ctx.fillStyle = tone;
      ctx.fillRect(x + 7, ry + rowH - 5, (w - 14) * ratio, 2.6);
      if (o === inter) { ctx.fillStyle = C.goldHi; ctx.fillRect(x, ry + 2, 3, rowH - 9); }
      const a = Math.atan2(o.from.y - P.y, o.from.x - P.x), midY = ry + (rowH - 5) / 2;
      ctx.save(); ctx.translate(x + 14, midY); ctx.rotate(a);
      ctx.fillStyle = urgent ? "#ff9a8b" : C.cyan;
      ctx.strokeStyle = "rgba(6, 8, 18, 0.85)"; ctx.lineWidth = 2; ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-2, 0); ctx.lineTo(-5, 5); ctx.closePath(); ctx.stroke(); ctx.fill();
      ctx.restore();
      const hasCue = o.word.cue !== "text";
      if (hasCue) drawWordCue(ctx, o.word, x + 38, midY, 18);
      ctx.font = readableFont(12, "900");
      ctx.fillStyle = C.text;
      ctx.textAlign = "left";
      const ty = midY + fontPx(ctx.font) * 0.35;
      inkText(ctx, o.word.zh, x + (hasCue ? 54 : 30), ty, w - (hasCue ? 118 : 94));
      ctx.textAlign = "right";
      ctx.fillStyle = urgent ? "#ff9a8b" : "#bfe9f0";
      inkText(ctx, `${Math.ceil(o.life)}s`, x + w - 8, ty);
    });
    if (rows.length > 3) {
      ctx.textAlign = "right"; ctx.font = readableFont(11, "bold"); ctx.fillStyle = C.dim;
      inkText(ctx, `＋${rows.length - 3}`, x + w - 4, y + 3 * (rowH + 4) + fontPx(ctx.font));
    }
  }

  // Boss 大血條：名稱、結界狀態、血量與 1/3 刻度。
  function drawBossBar(ctx, x, y, w, boss, scale, time) {
    const hp = clamp(boss.hp / Math.max(1, boss.max), 0, 1), shield = !!boss.shield;
    const barH = Math.max(16, Math.ceil(13 / scale)), labelPx = fontPx(readableFont(13));
    const h = labelPx + barH + 20;
    const tone = shield ? C.cyan : "#ff4d5e";
    glow(ctx, x + w / 2, y + h / 2, w * 1.1, tone, 0.12 * pulse(4, 0.5));
    glassBox(ctx, x, y, w, h, 10, "rgba(26, 8, 16, 0.95)", tone, 2.2);
    ctx.textAlign = "left";
    ctx.font = readableFont(13, "900");
    ctx.fillStyle = "#fff1f3";
    ctx.fillText(boss.final ? "大妖王" : "妖將", x + 12, y + labelPx + 5);
    ctx.textAlign = "right";
    ctx.fillStyle = shield ? C.cyan : "#ff9aa6";
    ctx.fillText(shield ? "結界展開・答對破除" : "結界已破・全力進攻", x + w - 12, y + labelPx + 5);
    const bx = x + 10, by = y + labelPx + 11, bw = w - 20;
    ctx.fillStyle = "#1c0f14";
    ctx.beginPath(); ctx.roundRect(bx, by, bw, barH, barH / 2); ctx.fill();
    if (hp > 0) {
      ctx.fillStyle = barGradient(ctx,"boss",bx,bx+bw);
      ctx.beginPath(); ctx.roundRect(bx, by, Math.max(barH, bw * hp), barH, barH / 2); ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
      ctx.beginPath(); ctx.roundRect(bx + 3, by + 2, Math.max(0, bw * hp - 6), barH * 0.32, barH / 4); ctx.fill();
    }
    ctx.strokeStyle = "rgba(0, 0, 0, 0.45)"; ctx.lineWidth = 2;
    ctx.beginPath();
    for (const t of [1 / 3, 2 / 3]) { ctx.moveTo(bx + bw * t, by); ctx.lineTo(bx + bw * t, by + barH); }
    ctx.stroke();
    if (shield) {
      ctx.strokeStyle = `rgba(127, 227, 240, ${0.55 + 0.35 * pulse(5, 0.2)})`; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.roundRect(bx - 1, by - 1, bw + 2, barH + 2, barH / 2 + 1); ctx.stroke();
    }
    return h;
  }

  // 2. 全螢幕 HUD：左上生命（燈油）與經驗、中上任務／Boss、右上黎明與小地圖、左下武器格。
  function drawHud(ctx, P, oil, maxOil, elapsed, dawnTime, delivered, failed, score, level, xp, xpNeed, job, hintT, orders, inter, bossQ, touch, joy, btnE, btnD, btnPause, WL, WI, b, nameT, goalDeliveries = 6, dashCd = 0, dashMax = 1.8, bossHunt = false, extra = {}) {
    ctx.save();
    const gradientTransform = ctx.getTransform?.();
    const bounds = window.VIEWPORT?.hudBounds() || screenBounds();
    const scale = window.VIEWPORT?.get().scale || (document.getElementById("game")?.getBoundingClientRect().width || 900) / 900;
    const time = extra.time ?? Date.now() / 1000;
    const motion = !calm();
    const curMaxOil = maxOil || 100;
    const oilRatio = clamp(oil / curMaxOil, 0, 1), lowOil = oilRatio <= 0.25;
    if (lowOil) drawLowOil(ctx, oilRatio, time);

    // --- 左上：燈油＝生命。燈籠圖示＋粗條，不加底框；低油時整條轉紅並脈動。 ---
    const oilTextSize = Math.max(20, Math.ceil(18 / scale));
    const oilBarH = Math.max(18, Math.ceil(16 / scale));
    const pBoxX = bounds.left + 18, pBoxY = bounds.top + 14, pBoxW = Math.max(250, Math.ceil(170 / scale));
    const pBoxH = oilTextSize + oilBarH + 12;
    if (lowOil && motion) glow(ctx, pBoxX + pBoxW / 2, pBoxY + pBoxH / 2, pBoxW * 1.6, "#ff3b3b", 0.3 * pulse(8, 0.3));

    drawLantern(ctx, pBoxX + 16, pBoxY + pBoxH / 2, Math.max(28, oilTextSize * 1.5), lowOil ? "#ff6a4a" : "#ffb03a");
    ctx.fillStyle = "#fff4dd";
    ctx.font = readableFont(oilTextSize, "900");
    ctx.textAlign = "right";
    inkText(ctx, `${Math.ceil(oil)}/${curMaxOil}`, pBoxX + pBoxW - 4, pBoxY + oilTextSize);
    ctx.textAlign = "left";

    const barX = pBoxX + 40, barY = pBoxY + oilTextSize + 7, barW = pBoxW - 44;
    ctx.fillStyle = "#1c1814";
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, oilBarH, oilBarH / 2);
    ctx.fill();
    if (oilRatio > 0) {
      const fillW = Math.max(oilBarH, barW * oilRatio);
      ctx.fillStyle = barGradient(ctx,lowOil?"lowOil":"oil",barX,barX+barW,gradientTransform);
      ctx.beginPath(); ctx.roundRect(barX, barY, fillW, oilBarH, oilBarH / 2); ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.24)";
      ctx.beginPath(); ctx.roundRect(barX + 3, barY + 2, Math.max(0, fillW - 6), oilBarH * 0.34, oilBarH / 4); ctx.fill();
      glow(ctx, barX + fillW, barY + oilBarH / 2, oilBarH * 3.2, lowOil ? "#ff4030" : "#ffc766", 0.75 * (motion ? pulse(4, 0.7) : 0.8));
    }
    ctx.strokeStyle = "rgba(0, 0, 0, 0.32)"; ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 1; i < 10; i++) { ctx.moveTo(barX + barW * i / 10, barY + 2); ctx.lineTo(barX + barW * i / 10, barY + oilBarH - 2); }
    ctx.stroke();
    ctx.strokeStyle = lowOil ? "#ff8a75" : "rgba(232, 195, 106, 0.7)"; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.roundRect(barX, barY, barW, oilBarH, oilBarH / 2); ctx.stroke();

    // --- 畫面最下緣：經驗薄條（全寬），等級數字浮在條上方正中。 ---
    {
      const sb = screenBounds(), xpH = Math.max(5, Math.ceil(6 / scale));
      const xpRatio = clamp(xp / Math.max(1, xpNeed), 0, 1), xpY = sb.bottom - xpH;
      ctx.fillStyle = "rgba(6, 10, 22, 0.78)";
      ctx.fillRect(sb.left, xpY, sb.width, xpH);
      if (xpRatio > 0) {
        ctx.fillStyle = barGradient(ctx,"xp",sb.left,sb.right,gradientTransform);
        ctx.fillRect(sb.left, xpY, sb.width * xpRatio, xpH);
        ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
        ctx.fillRect(sb.left, xpY, sb.width * xpRatio, 1);
        if (xpRatio > 0.85) glow(ctx, sb.left + sb.width * xpRatio, xpY + xpH / 2, xpH * 6, C.cyan, 0.6 * pulse(6, 0.4));
      }
      ctx.textAlign = "center";
      ctx.font = readableFont(12, "900");
      ctx.fillStyle = C.cyan;
      inkText(ctx, `Lv.${level}`, (sb.left + sb.right) / 2, xpY - 6);
      ctx.textAlign = "left";
    }

    // --- 右上：黎明進度（月亮＋條）與配達進度（包裹＋件數）＋分數，同樣不加底框。 ---
    const sBoxW = 215, sBoxH = 56;
    const sBoxX = bounds.right - sBoxW - Math.max(62, 44 / scale + 18), sBoxY = bounds.top + 14;
    const dawnProgress = clamp(elapsed / dawnTime, 0, 1);
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffd54f";
    ctx.beginPath();
    ctx.arc(sBoxX + 17, sBoxY + 17, 7, 0.5, 4.2);
    ctx.arc(sBoxX + 20, sBoxY + 17, 6, 4.0, 0.7, true);
    ctx.fill();
    const dawnBarW = sBoxW - 100, dawnBarX = sBoxX + 34, dawnBarY = sBoxY + 12;
    ctx.fillStyle = "#1b2238";
    ctx.beginPath(); ctx.roundRect(dawnBarX, dawnBarY, dawnBarW, 9, 4.5); ctx.fill();
    if (dawnProgress > 0) {
      ctx.fillStyle = barGradient(ctx,"dawn",dawnBarX,dawnBarX+dawnBarW,gradientTransform);
      ctx.beginPath(); ctx.roundRect(dawnBarX, dawnBarY, Math.max(9, dawnBarW * dawnProgress), 9, 4.5); ctx.fill();
      glow(ctx, dawnBarX + dawnBarW * dawnProgress, dawnBarY + 4.5, 26, "#ffd27a", 0.6);
    }
    ctx.strokeStyle = "rgba(232, 195, 106, 0.55)"; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.roundRect(dawnBarX, dawnBarY, dawnBarW, 9, 4.5); ctx.stroke();
    const dawnSecLeft = Math.max(0, Math.ceil(dawnTime - elapsed));
    const dawnSec = dawnSecLeft % 60;
    ctx.fillStyle = "#ffeed4";
    ctx.font = readableFont(12, "900");
    ctx.textAlign = "right";
    inkText(ctx, `${Math.floor(dawnSecLeft / 60)}:${dawnSec < 10 ? '0' : ''}${dawnSec}`, sBoxX + sBoxW - 4, sBoxY + 21);
    ctx.fillStyle = ctx.strokeStyle = "#ffe0a4";
    drawActionIcon(ctx, 'pickup', sBoxX + 17, sBoxY + 42, 8);
    ctx.textAlign = "left";
    ctx.font = readableFont(14, "900");
    inkText(ctx, `${delivered}/${goalDeliveries}`, sBoxX + 32, sBoxY + 47);
    ctx.textAlign = "right";
    ctx.fillStyle = "#fff1cc";
    const scoreText = String(score);
    inkText(ctx, scoreText, sBoxX + sBoxW - 4, sBoxY + 47);
    ctx.fillStyle = C.gold;
    ctx.save(); ctx.translate(sBoxX + sBoxW - 4 - ctx.measureText(scoreText).width - 9, sBoxY + 42); ctx.rotate(Math.PI / 4); ctx.fillRect(-3, -3, 6, 6); ctx.restore();
    ctx.textAlign = "left";

    const compact = scale < 0.62;
    const mapW = compact ? 120 : 172, mapH = compact ? 84 : 118, mapY = sBoxY + sBoxH + 8;
    drawMinimap(ctx, sBoxX + sBoxW - mapW, mapY, mapW, mapH, P, orders || [], job, extra.boss, time);
    if (!compact && orders?.length) drawOrderList(ctx, sBoxX, mapY + mapH + 6, sBoxW, fontPx(readableFont(12)) + 14, orders, P, inter);

    // --- 暫停鈕 ---
    glassBox(ctx, btnPause.x, btnPause.y, btnPause.w, btnPause.h, 10, "rgba(24, 20, 36, 0.94)", C.gold, 1.8);
    ctx.fillStyle = ctx.strokeStyle = "#ffd54f";
    drawActionIcon(ctx, 'pause', btnPause.x + btnPause.w / 2, btnPause.y + btnPause.h / 2, 10);

    // --- 中上：任務。只保留「現在要做什麼」，直接浮在場景上，不加底框。 ---
    const taskX = Math.max(248, pBoxX + pBoxW + 5), taskY = bounds.top + 14;
    const taskW = Math.min(370, sBoxX - taskX - 15), taskH = 52;
    HINT_BTN.x = taskX + taskW - HINT_BTN.w - 8;
    HINT_BTN.y = bounds.top + 20;
    ctx.textAlign = "left";
    let afterTask = taskY + taskH + 6;
    if (bossHunt) {
      const bossPulse = motion ? 0.65 + 0.35 * Math.sin(time * 4) : 0.85;
      ctx.textAlign = "center";
      ctx.fillStyle = `rgba(255, 138, 154, ${0.7 + bossPulse * 0.3})`;
      ctx.font = "900 22px 'Noto Sans JP', sans-serif";
      inkText(ctx, "擊敗大妖", taskX + taskW / 2, taskY + 32);
      drawCompass(ctx, taskX + taskW / 2 - 84, taskY + 26, extra.bossAngle, { color: "#ff3b4f", count: 2, size: 1.2 });
      drawCompass(ctx, taskX + taskW / 2 + 84, taskY + 26, extra.bossAngle, { color: "#ff3b4f", count: 2, size: 1.2 });
    } else if (job) {
      const remaining = Math.round(Math.hypot(P.x - job.to.x, P.y - job.to.y) / 10) * 10;
      ctx.fillStyle = "#fff3ca";
      ctx.font = readableFont(18, "900");
      if (job.word.cue !== "text") drawWordCue(ctx, job.word, taskX + 27, taskY + 16, 24);
      inkText(ctx, job.word.zh, taskX + (job.word.cue === "text" ? 16 : 48), taskY + 23);
      drawCompass(ctx, taskX + 24, taskY + 40, extra.guideAngle, { color: "#ffd152", size: 1.1 });
      ctx.fillStyle = "#82d8ff";
      ctx.font = readableFont(12, "900");
      inkText(ctx, `${remaining}`, taskX + 44, taskY + 44);

      const hintStage = job.hintStage || 0;
      drawButton(ctx, HINT_BTN, hintStage === 0 ? "聽 -3" : hintStage === 1 ? "詞 -4" : "✓", {
        tone: "cyan", size: 14, icon: hintStage === 0 ? "listen" : "hint", disabled: hintStage >= 2
      });

      if (job.showMeaningT > 0) {
        ctx.textAlign = "left";
        ctx.fillStyle = "#ffd54f";
        ctx.font = readableFont(11, "bold");
        afterTask += drawHintText(ctx, `${job.word.jp}　${job.word.example || ""}`, taskX, taskY + taskH + 6, taskW) + 6;
      }
    } else {
      // 沒有進行中的委託：包裹圖示＋箭頭，朝委託方向前進（靠近時圖示轉金色）。
      ctx.fillStyle = ctx.strokeStyle = inter ? "#ffe082" : "#f4e7cf";
      drawActionIcon(ctx, 'pickup', taskX + 27, taskY + 26, 13);
      drawCompass(ctx, taskX + 68, taskY + 26, extra.guideAngle, { color: inter ? "#ffe082" : "#ffd152", size: 1.3 });
    }
    if (extra.boss) drawBossBar(ctx, taskX, afterTask, taskW, extra.boss, scale, time);

    // --- 左下：武器格（含冷卻）＋被動體質欄 ---
    const ownedKeys = WI ? Object.keys(WI).filter(k => (WL[k] || 0) > 0) : [];
    const maxActiveSlots = 4;
    const {badgeTextSize, badgeH, slotSize, footerHeight} = skillMetrics(scale, ctx);
    const slotGap = 8;
    ctx.save();
    ctx.translate(bounds.left + 18, bounds.bottom - footerHeight - 12);
    ctx.scale(1.2, 1.2);
    const slotStartX = 0, slotY = 0;

    for (let i = 0; i < maxActiveSlots; i++) {
      const sx = slotStartX + i * (slotSize + slotGap);
      const k = ownedKeys[i];
      if (k) {
        const tone = WEAPON_TONE[k] || C.gold, scx = sx + slotSize / 2, scy = slotY + slotSize / 2;
        glassBox(ctx, sx, slotY, slotSize, slotSize, 9, "rgba(14, 12, 24, 0.9)", tone, 1.8);
        drawEmblem(ctx, k, scx, scy, 17);
        const cd = extra.cd?.[k] || 0;
        if (cd > 0.02) {
          ctx.fillStyle = "rgba(4, 6, 14, 0.66)";
          ctx.beginPath();
          ctx.moveTo(scx, scy);
          ctx.arc(scx, scy, slotSize / 2 - 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * cd);
          ctx.closePath();
          ctx.fill();
        } else if (motion && extra.cd) {
          glow(ctx, scx, scy, slotSize * 1.5, tone, 0.18 * pulse(3, 0.4));
        }
        const lvl = WL[k];
        ctx.fillStyle = C.gold;
        ctx.beginPath();
        ctx.roundRect(sx, slotY + slotSize, slotSize, badgeH, 3);
        ctx.fill();
        ctx.fillStyle = "#161022";
        ctx.textAlign = "center";
        ctx.font = `900 ${badgeTextSize}px 'Noto Sans JP', sans-serif`;
        ctx.fillText(lvl >= 5 ? "MAX" : `L${lvl}`, sx + slotSize / 2, slotY + slotSize + badgeTextSize + 3);
      } else {
        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = "rgba(180, 195, 220, 0.35)";
        ctx.lineWidth = 1.5;
        ctx.fillStyle = "rgba(12, 15, 24, 0.5)";
        ctx.beginPath();
        ctx.roundRect(sx, slotY, slotSize, slotSize, 9);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "rgba(180, 195, 220, 0.35)";
        ctx.textAlign = "center";
        ctx.font = readableFont(13, "bold");
        ctx.fillText("＋", sx + slotSize / 2, slotY + slotSize / 2 + 5);
        ctx.restore();
      }
    }

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

    const passiveX = maxActiveSlots * (slotSize + slotGap) + 8, available = (bounds.width - 18 - 180) / 1.2;
    const passiveSlots = Math.max(1, Math.floor((available - passiveX + slotGap) / (slotSize + slotGap)));
    const visibleCount = passives.length <= passiveSlots ? passives.length : passiveSlots - 1;
    passives.slice(0, visibleCount).forEach((pas, pIdx) => {
      const px = passiveX + pIdx * (slotSize + slotGap);
      glassBox(ctx, px, slotY, slotSize, slotSize, 9, "rgba(14, 12, 24, 0.9)", "rgba(255, 213, 79, 0.55)", 1.4);
      drawEmblem(ctx, pas.id, px + slotSize / 2, slotY + slotSize / 2, 14);
      ctx.fillStyle = "#ffd54f";ctx.beginPath();
      ctx.roundRect(px, slotY + slotSize, slotSize, badgeH, 3);ctx.fill();
      ctx.fillStyle = "#161022";ctx.textAlign = "center";
      ctx.font = `900 ${badgeTextSize}px 'Noto Sans JP', sans-serif`;
      ctx.fillText(`×${pas.lvl}`, px + slotSize / 2, slotY + slotSize + badgeTextSize + 3);
    });
    const hiddenPassives = passives.length - visibleCount;
    if (hiddenPassives > 0) {
      const px = passiveX + visibleCount * (slotSize + slotGap);
      glassBox(ctx, px, slotY, slotSize, slotSize + badgeH, 6, "rgba(40, 32, 12, 0.94)", "#ffd54f");
      ctx.fillStyle = "#ffe28b";ctx.textAlign = "center";
      ctx.font = `900 ${badgeTextSize}px 'Noto Sans JP', sans-serif`;
      ctx.fillText(`＋${hiddenPassives}`, px + slotSize / 2, slotY + slotSize / 2 + badgeTextSize * 0.35);
      ctx.fillText("被動", px + slotSize / 2, slotY + slotSize + badgeTextSize + 3);
    }
    ctx.restore();

    // --- 觸控虛擬按鈕 ---
    {
      ctx.save();
      if (touch && !joy && elapsed < 15) {
        const hintY = bounds.bottom - footerHeight - 76;
        ctx.strokeStyle = "rgba(255,255,255,0.28)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(bounds.left + 105, hintY, 52, 0, 6.28);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(bounds.left + 105, hintY, 20, 0, 6.28);
        ctx.stroke();
      }
      const cdRatio = clamp(dashCd / Math.max(0.01, dashMax), 0, 1);
      const ready = cdRatio <= 0.001;
      const ring = (btn, fill, stroke) => {
        glow(ctx, btn.x, btn.y, btn.r * 3, stroke, ready ? 0.3 : 0.12);
        ctx.fillStyle = fill;
        ctx.beginPath(); ctx.arc(btn.x, btn.y, btn.r, 0, 6.28); ctx.fill();
        ctx.strokeStyle = stroke; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(btn.x, btn.y, btn.r, 0, 6.28); ctx.stroke();
      };
      ring(btnD, ready ? "rgba(240, 248, 255, 0.78)" : "rgba(26, 32, 52, 0.78)", ready ? "#ffffff" : "#6f7ea8");
      if (!ready) {
        ctx.fillStyle = "rgba(160, 200, 255, 0.42)";
        ctx.beginPath();
        ctx.moveTo(btnD.x, btnD.y);
        ctx.arc(btnD.x, btnD.y, btnD.r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - cdRatio));
        ctx.closePath();
        ctx.fill();
      }
      ctx.textAlign = "center";
      ctx.fillStyle = ctx.strokeStyle = ready ? "#1e2436" : "#ffffff";
      ctx.font = readableFont(16, "900");
      drawActionIcon(ctx, 'dash', btnD.x, btnD.y - 12, 12);
      ctx.fillText(dashCd > 0 ? `${dashCd.toFixed(1)}s` : "衝刺", btnD.x, btnD.y + 20);

      if (inter) {
        ring(btnE, "rgba(255, 210, 80, 0.88)", "#fff3c4");
        ctx.fillStyle = ctx.strokeStyle = "#1e2436";
        drawActionIcon(ctx, 'pickup', btnE.x, btnE.y - 10, 10);
        ctx.fillText("取貨", btnE.x, btnE.y + 20);
      }

      if (joy) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
        ctx.beginPath();
        ctx.arc(joy.x, joy.y, 60, 0, 6.28);
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 240, 200, 0.45)"; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = "rgba(255, 245, 220, 0.78)";
        ctx.beginPath();
        ctx.arc(joy.x + joy.dx * 60, joy.y + joy.dy * 60, 26, 0, 6.28);
        ctx.fill();
      }
      ctx.restore();
    }
    if (!touch && elapsed < 12) {
      glassBox(ctx, bounds.left + 22, bounds.bottom - footerHeight - 50, 72, 30, 8, "rgba(12,16,28,0.7)", "rgba(255,255,255,0.28)", 1);
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,255,255,0.78)";
      ctx.font = readableFont(12, "900");
      ctx.fillText("拖曳移動", bounds.left + 58, bounds.bottom - footerHeight - 30);
    }

    ctx.restore();
  }

  // 繪製日式和風紋章勳章（Kamon Emblems - 商業級金屬鍍金家紋）
  function drawEmblem(ctx, id, cx, cy, r) {
    ctx.save();
    ctx.translate(cx, cy);

    // 1. 雙層金箔金屬框與外圈陰影
    ctx.save();
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


  // 3. 升級三選一：武器色、NEW 緞帶、等級節點與重抽。
  function drawLevelUp(ctx, level, choices, WL, WI, rerolls = 0, time = Date.now() / 1000) {
    ctx.save();
    ctx.fillStyle = "rgba(6, 9, 18, 0.93)";
    fillScreen(ctx);
    glow(ctx, W / 2, 46, 620, C.gold, 0.2 * pulse(2, 0.6));
    glow(ctx, W / 2, 330, 1100, "#2b3a78", 0.1);

    ctx.textAlign = "center";
    ctx.font = titleFont(32);
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillText(`LEVEL UP!　Lv.${level}`, W / 2, 51);
    ctx.fillStyle = C.goldHi;
    ctx.fillText(`LEVEL UP!　Lv.${level}`, W / 2, 48);
    ctx.strokeStyle = "rgba(232, 195, 106, 0.55)"; ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 250, 56); ctx.lineTo(W / 2 - 40, 56); ctx.moveTo(W / 2 + 40, 56); ctx.lineTo(W / 2 + 250, 56);
    ctx.stroke();
    ctx.fillStyle = C.gold;
    ctx.save(); ctx.translate(W / 2, 56); ctx.rotate(Math.PI / 4); ctx.fillRect(-4, -4, 8, 8); ctx.restore();

    // 頂部只顯示 4 個主動槽，不再放長篇說明。
    const ownedKeys = WI ? Object.keys(WI).filter(k => (WL[k] || 0) > 0) : [];
    const maxSlots = 4;
    const barW = 620, barH = 70;
    const barX = W / 2 - barW / 2, barY = 64;

    glassBox(ctx, barX, barY, barW, barH, 10, "rgba(18, 20, 36, 0.9)", C.gold, 1.5);
    const slotStartX = barX + 22;
    for (let s = 0; s < maxSlots; s++) {
      const sx = slotStartX + s * 150;
      const k = ownedKeys[s];
      if (k) {
        glassBox(ctx, sx, barY + 7, 140, 56, 6, "rgba(26, 30, 56, 0.9)", WEAPON_TONE[k] || C.gold, 1.4);
        drawEmblem(ctx, k, sx + 18, barY + 49, 12);
        ctx.fillStyle = "#ffeed4";
        ctx.font = readableFont(12, "900");
        ctx.textAlign = "center";
        fitText(ctx, WI[k].zh, sx + 70, barY + 31, 132);
        ctx.font = readableFont(12, "900");
        ctx.fillText(`L${WL[k]}`, sx + 70, barY + 58);
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
    const cardFill = ctx.createLinearGradient(0, 0, cardW, cardH);
    cardFill.addColorStop(0, "#232a46");
    cardFill.addColorStop(0.5, "#141a2d");
    cardFill.addColorStop(1, "#0d101d");

    choices.forEach((c, i) => {
      const cx = startX;
      const rowY = cy + i * (cardH + gap);
      const isWeapon = c.type === "weapon";
      const isNew = !!c.levelText && (c.levelText.includes("新") || c.levelText.includes("NEW"));
      const awakening = c.lv===5 || c.rarity==='max';
      const tone = awakening ? C.goldHi : isWeapon ? (WEAPON_TONE[c.id] || C.gold) : C.jade;

      // 卡片後方的色光，讓三張卡靠色彩就能分辨。
      glow(ctx, cx + 36, rowY + 62, 150, tone, 0.34);
      glassBox(ctx, cx, rowY, cardW, cardH, 14, cardFill, tone, awakening?3:2.2, isNew||awakening);
      ctx.fillStyle = tone;
      ctx.beginPath(); ctx.roundRect(cx + 6, rowY + 14, 3.5, cardH - 28, 2); ctx.fill();

      // 大型號碼＋紋章，讓鍵盤與觸控的對應一眼可見。
      glassBox(ctx, cx + 14, rowY + 14, 48, 80, 10, "rgba(8, 12, 22, 0.8)", C.gold, 1.3);
      ctx.textAlign = "center";
      ctx.fillStyle = C.goldHi;
      ctx.font = "900 20px sans-serif";
      ctx.fillText(String(i + 1), cx + 38, rowY + 39);
      glow(ctx, cx + 38, rowY + 70, 70, tone, 0.5);
      drawEmblem(ctx, c.id, cx + 38, rowY + 70, 18);

      ctx.textAlign = "left";
      ctx.fillStyle = "#ffffff";
      ctx.font = readableFont(21, "900");
      ctx.fillText(c.n, cx + 80, rowY + 31);
      ctx.fillStyle = "#ffd54f";
      ctx.font = readableFont(12, "bold");
      ctx.fillText(c.s || "", cx + 300, rowY + 31);

      // 右上：等級狀態膠囊，下方節點顯示武器 Lv 進度。
      glassBox(ctx, cx + 500, rowY + 12, 198, 28, 7, isNew ? "rgba(232, 195, 106, 0.26)" : "rgba(60, 140, 230, 0.2)", isNew ? "#ffd54f" : "#64b5f6", 1.2);
      ctx.textAlign = "center";
      ctx.fillStyle = awakening || isNew ? "#ffe082" : "#90caf9";
      ctx.font = readableFont(12, "900");
      fitText(ctx, c.levelText || "◆ 妖力精進", cx + 599, rowY + 31, 180);

      if (isWeapon && !isNew) {
        const cur = WL[c.id] || 0;
        for (let p = 1; p <= 5; p++) {
          const px = cx + 599 + (p - 3) * 22, py = rowY + 54;
          const filled = p <= cur, next = p === cur + 1;
          ctx.fillStyle = filled ? tone : next ? C.goldHi : "rgba(255,255,255,0.14)";
          if (next && !calm()) { glow(ctx, px, py, 26, C.goldHi, 0.5 * pulse(5, 0.3)); }
          ctx.save(); ctx.translate(px, py); ctx.rotate(Math.PI / 4); ctx.fillRect(-5, -5, 10, 10); ctx.restore();
        }
      }
      ctx.fillStyle = tone;
      ctx.font = readableFont(12, "900");
      ctx.textAlign = "right";
      ctx.fillText(isWeapon ? "【主動】" : "【被動】", cx + 486, rowY + 31);

      ctx.textAlign = "left";
      ctx.font = readableFont(14, "bold");
      ctx.fillStyle = "#f1f4ff";
      const lines = [];
      let line = "";
      for (const char of c.d || "") {
        if (ctx.measureText(line + char).width > 620 && line) { lines.push(line); line = ""; }
        line += char;
      }
      lines.push(line);
      lines.slice(0, 2).forEach((text, index) => fitText(ctx, text, cx + 80, rowY + 72 + index * fontPx(ctx.font) * 1.15, 600));
    });

    // 重抽與操作提示
    const rr = REROLL_BTN;
    ctx.textAlign = "left";
    ctx.fillStyle = C.dim;
    ctx.font = readableFont(12, "bold");
    ctx.fillText("按 1 / 2 / 3 或直接點選　R 或 Y 重抽", startX, rr.y + rr.h / 2 + 5);
    drawButton(ctx, rr, `重抽 ×${rerolls}`, { tone: "cyan", size: 16, icon: "cards", disabled: rerolls <= 0 });
    ctx.restore();
  }

  // 4. Boss 破防答題介面
  function skillMetrics(scale, ctx) {
    const badgeTextSize = Math.max(11, Math.ceil(14 / (scale * 1.2))), badgeH = badgeTextSize + 8;
    let labelWidth = badgeTextSize * 3;
    if (ctx) {
      ctx.save();ctx.font = `900 ${badgeTextSize}px 'Noto Sans JP', sans-serif`;
      labelWidth = Math.max(ctx.measureText("MAX").width, ctx.measureText("被動").width);
      ctx.restore();
    }
    const slotSize = Math.max(40, Math.ceil(labelWidth) + 12);
    return {badgeTextSize, badgeH, slotSize, footerHeight:(slotSize + badgeH) * 1.2};
  }

  function bossQuizLayout(n) {
    const bounds = window.VIEWPORT?.hudBounds() || screenBounds();
    const scale = window.VIEWPORT?.get().scale || (document.getElementById('game')?.getBoundingClientRect().width || 900)/900;
    const left = bounds.left+18, right = bounds.right-208;
    const w = Math.min(690,right-left), gap = n===2 ? 36 : 24;
    const optW = Math.min(n===2 ? 260 : 200,(w-42-(n-1)*gap)/n);
    const optH = Math.max(46,Math.ceil(44/scale)), h = optH+59;
    const {footerHeight} = skillMetrics(scale, document.getElementById('game')?.getContext?.('2d'));
    const x = left+(right-left-w)/2, y = bounds.bottom-Math.max(86,footerHeight+24)-h;
    const startX = x+(w-n*optW-(n-1)*gap)/2;
    return {x,y,w,h,options:Array.from({length:n},(_,i)=>({x:startX+i*(optW+gap),y:y+46,w:optW,h:optH}))};
  }

  function drawBossQuiz(ctx, bossQ, mode = 'keyboard') {
    if (!bossQ) return;
    ctx.save();
    const layout = bossQuizLayout(bossQ.ans.length);
    const {x:bx,y:by,w:boxW,h:boxH} = layout;
    const mid = bx+boxW/2;

    glow(ctx, mid, by + boxH / 2, boxW * 1.2, "#ff3b5c", 0.2 * pulse(4, 0.5));
    glassBox(ctx, bx, by, boxW, boxH, 16, "rgba(24, 12, 34, 0.98)", `rgba(255, 84, 112, ${0.75 + 0.25 * pulse(5, 0.2)})`, 2.6, true);

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
      glassBox(ctx, ox, oy, optW, optH, 10, bossQ.lock > 0 ? "#333c57" : "#f4e6c8", bossQ.lock > 0 ? "#6c7592" : C.gold, 2);
      if (bossQ.lock <= 0) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
        ctx.beginPath(); ctx.roundRect(ox + 5, oy + 4, optW - 10, optH * 0.3, 6); ctx.fill();
      }
      ctx.fillStyle = bossQ.lock > 0 ? "#8e97b4" : "#1e1829";
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
    { name: "添燈香油", jp: "かいふく", type: "被動", desc: "恢復 50% 燈油，並震退周圍妖怪（每場最多 3 次）", emblem: "oil_heal" },
    { name: "修羅破軍", jp: "こうげき", type: "被動", desc: "整體傷害係數 +0.35（最多 6 層）", emblem: "dmg" },
    { name: "神樂疾奏", jp: "れんぞく", type: "被動", desc: "妖刀、結界、靈針冷卻縮短", emblem: "rate" },
    { name: "心眼一閃", jp: "かいしん", type: "被動", desc: "妖刀/天雷暴擊率 +15%，結界 +10%", emblem: "crit" },
    { name: "神足草履", jp: "いどう", type: "被動", desc: "移動速度約 +15%（最多 3 層）", emblem: "spd" },
    { name: "縮地瞬步", jp: "ダッシュ", type: "被動", desc: "衝刺冷卻大幅縮短，衝刺附加無敵突進", emblem: "dash" },
    { name: "招財勾玉", jp: "じしゃく", type: "被動", desc: "靈玉吸取範圍 +80", emblem: "mag" }
  ];

  function drawCodex(ctx, STORE, ALL, tab = "cards", page = 0, maskReadings = false) {
    ctx.save();
    ctx.fillStyle = "rgba(10, 14, 26, 0.96)";
    fillScreen(ctx);

    const isCards = tab === "cards";

    // 1. 頂部大標題
    ctx.textAlign = "center";
    ctx.font = titleFont(28);
    ctx.fillStyle = "#ffe28b";
    ctx.shadowColor = "rgba(255, 215, 100, 0.5)";
    ctx.shadowBlur = 10;
    ctx.fillText(isCards ? "秘術卡片" : "單字圖鑑", W / 2, 40);
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
        const revealed = seen && !(maskReadings && m.box < 4);

        glassBox(ctx, cx, cy, cardW, cardH, 8, revealed ? "#fcf4e3" : "#20273a", revealed ? "#d4af37" : "#36415a", 1.5);

        ctx.textAlign = "center";
        ctx.fillStyle = revealed ? "#1e1829" : "#e7ecff";
        ctx.font = compact ? "20px sans-serif" : "24px sans-serif";
        if (revealed) drawWordCue(ctx, w, cx + cardW / 2, cy + 23, 26);
        else ctx.fillText("？", cx + cardW / 2, cy + (compact ? 27 : 32));

        ctx.font = readableFont(20, "900");
        ctx.fillText(revealed ? w.jp : "？？", cx + cardW / 2, cy + (compact ? 48 : 56));

        if (revealed) {
          ctx.font = readableFont(18, "700");
          ctx.fillStyle = "#63503c";
          ctx.fillText(w.zh, cx + cardW / 2, cy + (compact ? 64 : 74));
        }
        if (revealed || (seen && maskReadings)) {
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


  // 6. 結算：勝利是破曉暖光，失敗是冷色月光；只留標題、分數、送達／誤配文字與記錯的字。
  function drawEndScreen(ctx, state, score, delivered, failed, misses, focus = 0, summary = {}) {
    ctx.save();
    const isWon = state === "won";
    const time = summary.time ?? Date.now() / 1000;

    ctx.fillStyle = "rgba(6, 8, 18, 0.8)";
    fillScreen(ctx);
    glow(ctx, W / 2, isWon ? 40 : 60, 1250, isWon ? "#ff9d4a" : "#34457f", isWon ? 0.42 : 0.3);
    if (isWon) glow(ctx, W / 2, 40, 420, "#ffe0a4", 0.28 * pulse(1.5, 0.6));

    if (!calm()) {
      [[120, 70], [760, 96], [180, 400], [820, 330]].forEach((p, i) => {
        ctx.fillStyle = `rgba(255, 186, 206, ${0.2 + i * 0.05})`;
        ctx.beginPath();
        ctx.ellipse(p[0] + Math.sin(time * 0.8 + i * 2) * 14, p[1] + ((time * 14 + i * 90) % 60), 7, 4, i * 0.7 + time * 0.5, 0, 6.28);
        ctx.fill();
      });
    }

    const courierKey = isWon ? "player_win_v1" : "player_kneel_v1";
    const courier = window.ART && (window.ART[courierKey] || window.ART.player);
    if (courier && courier.naturalWidth) {
      const ph = window.ART[courierKey] ? (isWon ? 270 : 210) : 150 * courier.naturalHeight / courier.naturalWidth;
      ctx.save();
      if (window.RENDERER?.drawFrame) window.RENDERER.drawFrame(ctx,courier,window.ART[courierKey]?courierKey:'player',0,108,470,ph);
      else ctx.drawImage(courier,108-ph*courier.naturalWidth/courier.naturalHeight/2,470-ph,ph*courier.naturalWidth/courier.naturalHeight,ph);
      ctx.restore();
    }

    const cardX = 210, cardY = 78, cardW = 652, cardH = 390;
    const mid = cardX + cardW / 2;
    glassBox(ctx, cardX, cardY, cardW, cardH, 16, "rgba(12, 14, 28, 0.93)", isWon ? "rgba(240, 196, 110, 0.95)" : "rgba(196, 154, 122, 0.6)", isWon ? 2.2 : 1.6, true);

    ctx.textAlign = "center";
    glow(ctx, mid, cardY + 52, 300, isWon ? "#ffb347" : "#7b8bd0", 0.3);
    ctx.font = titleFont(32);
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillText(isWon ? "夜已破曉" : "燈油已盡", mid, cardY + 63);
    ctx.fillStyle = isWon ? "#ffe0a4" : "#f0c2bc";
    ctx.fillText(isWon ? "夜已破曉" : "燈油已盡", mid, cardY + 60);

    ctx.strokeStyle = "rgba(232, 188, 106, 0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cardX + 48, cardY + 84);
    ctx.lineTo(mid - 8, cardY + 84);
    ctx.moveTo(mid + 8, cardY + 84);
    ctx.lineTo(cardX + cardW - 48, cardY + 84);
    ctx.stroke();
    ctx.fillStyle = C.gold;
    ctx.save(); ctx.translate(mid, cardY + 84); ctx.rotate(Math.PI / 4); ctx.fillRect(-3, -3, 6, 6); ctx.restore();

    // 分數：直接放大，不另加框；新紀錄用發亮字，否則以淡字顯示歷史最高。
    ctx.font = titleFont(60);
    ctx.fillStyle = "#fff1cc";
    ctx.fillText(score.toLocaleString(), mid, cardY + 160);
    if (summary.newBest) {
      glow(ctx, mid, cardY + 186, 150, C.goldHi, 0.4 * pulse(4, 0.4));
      ctx.fillStyle = C.goldHi;
      ctx.font = readableFont(15, "900");
      ctx.fillText("新紀錄！", mid, cardY + 190);
    } else if (summary.prevBest > 0) {
      ctx.font = readableFont(13, "700");
      ctx.fillStyle = C.dim;
      ctx.fillText(`最高 ${summary.prevBest.toLocaleString()}`, mid, cardY + 190);
    }

    // 送達／誤配：用文字最清楚，只排成一行，不分格。
    const statY = cardY + 238;
    ctx.font = "900 24px 'Zen Maru Gothic', 'Noto Sans JP', sans-serif";
    const stats = [
      [`送達  ${delivered} 件`, "#f4e7cf"],
      [`誤配  ${failed} 件`, failed > 0 ? "#f0b8b4" : "rgba(244, 231, 207, 0.55)"]
    ];
    const pairGap = 72, statW = stats.map(([label]) => ctx.measureText(label).width);
    let sx = mid - (statW[0] + statW[1] + pairGap) / 2;
    ctx.textAlign = "left";
    stats.forEach(([label, color], i) => {
      ctx.fillStyle = color;
      ctx.fillText(label, sx, statY);
      sx += statW[i] + pairGap;
    });
    ctx.textAlign = "center";

    if (summary.learning) {
      const l = summary.learning;
      ctx.font = readableFont(15,"700"); ctx.fillStyle = C.text;
      ctx.fillText(`今夜練習 ${l.practiced} 字・待複習 ${l.review} 字`,mid,cardY+269);
      ctx.fillStyle = C.goldHi;
      ctx.fillText(`熟練星：升星 +${l.gained}・降星 −${l.lost}`,mid,cardY+299);
    }
    const reviewWords = [...new Map((misses || []).map(w => [w.jp, w])).values()];
    const reviewList = reviewWords.slice(0, 5);
    ctx.font = readableFont(15, "700");
    if (reviewList.length > 0) {
      ctx.fillStyle = "rgba(255, 214, 196, 0.9)";
      ctx.fillText(`今夜記錯的字：共 ${reviewWords.length} 字${summary.learning ? "（以下節錄）" : reviewWords.length > 5 ? "，僅顯示前 5 字" : ""}`, mid, cardY + (summary.learning ? 328 : 296));
      ctx.font = readableFont(16, "700");
      ctx.fillStyle = "#fff6ea";
      const parts = reviewList.map(w => `${w.jp}（${w.zh}）`);
      let line = "";
      let lineY = cardY + (summary.learning ? 355 : 325);
      const lineStep = fontPx(ctx.font) * 1.25;
      const lines = [];
      parts.forEach(part => {
        const next = line ? `${line}　　${part}` : part;
        if (line && ctx.measureText(next).width > cardW - 80) {
          lines.push(line);
          line = part;
        } else {
          line = next;
        }
      });
      if (line) lines.push(line);
      const maxLines = Math.max(1,Math.floor((cardY+cardH-14-lineY)/lineStep)+1);
      lines.slice(0,maxLines).forEach((text,i)=>fitText(ctx,text+(i===maxLines-1 && lines.length>maxLines ? "…" : ""),mid,lineY+i*lineStep,cardW-80));
    }

    drawButton(ctx, RESTART_BTN, "再踏夜行", { tone: "primary", size: 18 });
    drawButton(ctx, WORLD_BTN, "回旅路地圖", { size: 18 });
    drawButton(ctx, HOME_BTN, "回到首頁", { size: 18 });
    drawMenuFocus(ctx, END_BTNS[focus]);

    ctx.restore();
  }

  // 7. 暫停與系統設定選單 (日式黑漆金箔和風御札)
  const PAUSE_BTNS = [
    { id: "resume", label: "繼續夜行", y: 180, tone: "primary" },
    { id: "cards", label: "秘術卡片", y: 232 },
    { id: "codex", label: "單字圖鑑", y: 284 },
    { id: "mute", label: "聲音：開", labelMuted: "聲音：關", y: 336 },
    { id: "controls", label: "操作與自定義", y: 388 },
    { id: "tutorial", label: "重看操作教學", y: 440 },
    { id: "menu", label: "返回主選單", y: 492, tone: "danger" }
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
    glow(ctx, W / 2, 120, 700, C.gold, 0.12);

    const buttons = pauseButtons();
    const panelX = Math.min(...buttons.map(b => b.x)) - 24;
    const panelY = 92;
    const panelR = Math.max(...buttons.map(b => b.x + b.w)) + 24;
    const panelB = Math.max(...buttons.map(b => b.y + b.h)) + 28;
    glassBox(ctx, panelX, panelY, panelR - panelX, panelB - panelY, 16, "rgba(14, 12, 18, 0.95)", C.gold, 1.8, true);

    ctx.textAlign = "center";
    ctx.font = titleFont(36);
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillText("暫停", W / 2, 135);
    ctx.fillStyle = C.goldHi;
    ctx.fillText("暫停", W / 2, 132);

    ctx.font = readableFont(13, "bold");
    ctx.fillStyle = "rgba(255, 235, 180, 0.72)";
    ctx.fillText("這一夜先停在這裡", W / 2, 158);

    buttons.forEach((b, i) => {
      const label = b.id === "mute" && muted ? b.labelMuted : b.label;
      drawButton(ctx, b, label, { tone: b.tone || "normal", size: b.tone === "primary" ? 18 : 15, focus: i === focus });
    });

    ctx.fillStyle = "rgba(255, 235, 180, 0.62)";
    ctx.font = readableFont(12, "");
    ctx.fillText("上下選擇 · Enter／A 確認 · Esc／B 繼續", W / 2, panelB - 14);

    ctx.restore();
  }

  // 8. 百鬼夜行 3 次閃爍警報匾額與全螢幕紅光警戒 (Surge Warning Banner)
  function drawSurgeWarning(ctx, surgeWarningT) {
    if (surgeWarningT <= 0) return;
    ctx.save();
    const totalDuration = 2.4;
    const cycleDuration = 0.8;
    const progress = Math.max(0, totalDuration - surgeWarningT);
    const cycle = Math.min(3, Math.floor(progress / cycleDuration) + 1);
    const phase = (progress % cycleDuration) / cycleDuration;
    const flashBrightness = Math.sin(phase * Math.PI);
    const alpha = Math.max(0.18, flashBrightness);

    const bounds = screenBounds();
    ctx.strokeStyle = `rgba(255, 30, 30, ${alpha * 0.85})`;
    ctx.lineWidth = 14;
    ctx.strokeRect(bounds.left + 7, bounds.top + 7, bounds.width - 14, bounds.height - 14);

    ctx.fillStyle = `rgba(255, 20, 20, ${alpha * 0.14})`;
    fillScreen(ctx);

    const bw = 460, bh = 72;
    const bx = (bounds.left+bounds.right-bw)/2, by = bounds.top+110;

    glow(ctx, bx + bw / 2, by + bh / 2, bw * 1.3, "#ff2a2a", alpha * 0.5);
    glassBox(ctx, bx, by, bw, bh, 10, "rgba(52, 10, 14, 0.97)", `rgba(255, 70, 70, ${alpha})`, 2.6, true);

    ctx.fillStyle = "#ffd54f";
    ctx.beginPath();
    ctx.roundRect(bx + bw - 100, by + 10, 88, 22, 5);
    ctx.fill();
    ctx.fillStyle = "#160608";
    ctx.font = readableFont(12, "900");
    ctx.textAlign = "center";
    ctx.fillText(`警報 ${cycle} / 3`, bx + bw - 56, by + 25);

    ctx.textAlign = "center";
    ctx.font = titleFont(24);
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillText("警報・百鬼夜行", bx + bw / 2, by + 36);
    ctx.fillStyle = "#fff2a8";
    ctx.fillText("警報・百鬼夜行", bx + bw / 2, by + 33);

    ctx.font = readableFont(13, "900");
    ctx.fillStyle = "#ffcdd2";
    ctx.fillText("妖氣逼近，準備迎戰", W / 2, by + 57);

    ctx.restore();
  }

  // 9. 關卡標題卡：進場 3 秒內淡入淡出，不擋操作。
  function drawTitleCard(ctx, stage, chapter, t) {
    const total = 3, age = total - t;
    const a = clamp(Math.min(age / 0.5, t / 0.8), 0, 1);
    if (a <= 0 || !stage) return;
    const b = screenBounds(), cx = (b.left + b.right) / 2, cy = b.top + b.height * 0.36;
    ctx.save();
    ctx.globalAlpha = a;
    glow(ctx, cx, cy, 760, "#0a0d18", 0.55);
    glow(ctx, cx, cy, 420, C.gold, 0.12);
    ctx.textAlign = "center";
    ctx.font = readableFont(14, "900");
    ctx.fillStyle = C.gold;
    ctx.fillText(`第 ${chapter} 夜`, cx, cy - 34);
    ctx.font = titleFont(44);
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillText(stage.name, cx, cy + 14);
    ctx.fillStyle = C.goldHi;
    ctx.fillText(stage.name, cx, cy + 10);
    if (stage.sub) {
      ctx.font = readableFont(15, "700");
      ctx.fillStyle = C.dim;
      ctx.fillText(stage.sub, cx, cy + 40);
    }
    const lw = 130 * a;
    ctx.strokeStyle = "rgba(232, 195, 106, 0.6)"; ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx - lw - 10, cy + 56); ctx.lineTo(cx - 10, cy + 56); ctx.moveTo(cx + 10, cy + 56); ctx.lineTo(cx + lw + 10, cy + 56);
    ctx.stroke();
    ctx.restore();
  }

  // 畫面切換時的短暫黑幕淡出（ratio 由 1 → 0）。
  function drawFade(ctx, ratio) {
    ctx.save();
    ctx.fillStyle = `rgba(4, 5, 12, ${clamp(ratio, 0, 1) * 0.85})`;
    fillScreen(ctx);
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
    const height = lines.length * lineHeight + 16;
    glassBox(ctx, x, y, width, height, 8, "rgba(12,16,28,0.94)", "#ffd54f");
    ctx.textAlign = "left";ctx.fillStyle = "#ffd54f";
    lines.forEach((value, i) => ctx.fillText(value, x + 12, y + 8 + lineHeight * (i + 0.8)));
    ctx.restore();
    return height;
  }

  function titleFont(size) {
    const scale = window.VIEWPORT?.get().scale || 1;
    return readableFont(Math.max(size, Math.ceil(18 / scale)), "700").replace("'Noto Sans JP'", "'Kaisei Decol'");
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
    drawAssetProgress,
    drawPauseMenu,
    drawSurgeWarning,
    drawTitleCard,
    drawFade,
    drawButton,
    PAUSE_BTNS, pauseButtons, MENU_BTNS, END_BTNS, EXIT_BTNS, drawExitConfirm,
    PAUSE_BTN_W: 280,
    PAUSE_BTN_H: 44,
    RESTART_BTN,
    WORLD_BTN,
    HOME_BTN,
    MENU_START_BTN,
    MENU_CONTROLS_BTN,
    HINT_BTN,
    REROLL_BTN,
    CARD_LIST
  };
})();
