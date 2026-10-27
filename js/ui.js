// 使用者介面（UI）：半水墨、和紙、木版畫介面；面板、按鈕、升級卡共用墨線與版畫色票。
// 光暈優先使用 FX.glow 的預烘焙貼圖；面板仍使用漸層，圖鑑標題保留少量 shadowBlur。
// HUD 可回退：預設 diegetic；也可用 ?hud=classic / ?hud=diegetic 即時比較。
{
  const hasLocation = typeof location !== 'undefined';
  const requestedHud = hasLocation ? new URLSearchParams(location.search).get('hud') : null;
  if (requestedHud === 'classic' || requestedHud === 'diegetic') window.UI_THEME = requestedHud;
  if (window.UI_THEME !== 'classic' && window.UI_THEME !== 'diegetic') window.UI_THEME = hasLocation ? 'diegetic' : 'classic';
}
// R18-U1：乾淨橫向和風卷軸「審閱模式」總開關（OpenCode p8 候選，正式模式預設關閉）。
// ?u1scroll=1 或 hash #u1scroll 開啟；正式網站不帶參數時，三選單渲染與 R17 43fb 基線完全一致。
{
  const hasLocU1 = typeof location !== 'undefined';
  const u1Param = hasLocU1 ? new URLSearchParams(location.search).get('u1scroll') : null;
  const u1Hash = hasLocU1 ? String(location.hash || '') : '';
  if (u1Param === '1' || u1Param === '0') window.U1_EMAKI_PREVIEW = u1Param === '1';
  else if (/u1(?:scroll|-preview)/.test(u1Hash)) window.U1_EMAKI_PREVIEW = true;
}
window.UI = (() => {
  const screenBounds = () => window.VIEWPORT?.bounds() || {left:0,top:0,right:900,bottom:600,width:900,height:600};
  // 暫時停用尚未素材化的 diegetic 假繪馬／假扇子；保留程式以便日後換正式素材再開。
  const DIEGETIC_QUEST_BOARD_ENABLED = false;
  const DIEGETIC_SKILL_FAN_ENABLED = true;
  function fillScreen(ctx) { const b = screenBounds(); ctx.fillRect(b.left,b.top,b.width,b.height); }
  // ---- 窄畫面共用度量（單一來源）------------------------------------------
  // 熱區與字級一律換算成 CSS px：世界座標會隨 VIEWPORT.scale 一起縮小，
  // 若直接用世界座標寫死，360x800（scale .4）的 44 px 熱區只剩 17.6 px。
  const viewScale = () => { const s = window.VIEWPORT?.get?.().scale; return s > 0 ? s : 1; };
  const cssPx = css => Math.max(1, Math.ceil(css / viewScale()));
  const MIN_TOUCH_CSS = 44, MIN_LABEL_CSS = 14;
  // ---- 融合素材共用存取（與 renderer.js 一致，委派至 assets.js 唯一真實來源） ----
  // 生效門檻由 assets.js 的 isFusionArtBindEnabled() 控制；
  // 取圖透過共用 getFusionPhaseArt(kind, phase)；
  // 元資料定義透過 getFusionArtBindDef(kind, phase)；
  // UI 不自建 Image cache、不硬碼候選路徑、不另設獨立 dev gate。
  function isUiFusionArtEnabled() {
    if (typeof window !== "undefined") {
      if (typeof window.isFusionArtBindEnabled === "function") {
        return window.isFusionArtBindEnabled() === true;
      }
      if (window.DEV) return true;
      try {
        if (window.DEV_MODE && typeof window.DEV_MODE.isDevMode === "function" && window.DEV_MODE.isDevMode(location)) return true;
      } catch {}
    }
    return false;
  }

  function getUiFusionArt(id, phase) {
    if (!isUiFusionArtEnabled()) return null;
    if (typeof window !== "undefined") {
      if (typeof window.getFusionPhaseArt === "function") {
        const img = window.getFusionPhaseArt(id, phase);
        if (img && img.naturalWidth > 0) return img;
      }
      // 相容既有單元測試 sandbox 注入之 FUSION_CANDIDATE_IMAGES
      const candImages = (typeof FUSION_CANDIDATE_IMAGES !== "undefined" ? FUSION_CANDIDATE_IMAGES : null) || window.FUSION_CANDIDATE_IMAGES;
      if (candImages) {
        const img = candImages[id + "_" + phase];
        if (img && img.naturalWidth > 0) return img;
        if (phase === "icon") {
          const fallback = candImages[id + "_main"];
          if (fallback && fallback.naturalWidth > 0) return fallback;
        }
      }
    }
    return null;
  }

  function drawFusionIcon(ctx, id, x, y, r) {
    const iconImg = getUiFusionArt(id, "icon");
    const mainImg = iconImg ? null : getUiFusionArt(id, "main");

    if (iconImg && iconImg.naturalWidth) {
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
      const size = r * 2;
      ctx.drawImage(iconImg, x - r, y - r, size, size);
      ctx.restore();
      return;
    }
    if (mainImg && mainImg.naturalWidth) {
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
      const size = r * 2;
      const iw = mainImg.naturalWidth, ih = mainImg.naturalHeight;
      const cropS = Math.min(iw, ih);
      const cx = (iw - cropS) / 2, cy = (ih - cropS) / 2;
      ctx.drawImage(mainImg, cx, cy, cropS, cropS, x - r, y - r, size, size);
      ctx.restore();
      return;
    }
    // 未啟用候選或圖片未就緒：使用正規家紋向量圖回落，不產生程序假美術
    drawEmblem(ctx, id, x, y, r);
  }

  function getFusionAsset(id, type = "main") {
    if (typeof window !== "undefined" && typeof window.getFusionArtBindDef === "function") {
      if (isUiFusionArtEnabled()) {
        const def = window.getFusionArtBindDef(id, type);
        return def ? def.file : null;
      }
    }
    return null;
  }
  let __measureCtx = null;
  // 量「14 CSS 字級的真標籤」需要多少世界寬度；無 DOM（VM 測試）時以全形字寬估算。
  function textWorldWidth(text, cssSize = MIN_LABEL_CSS, weight = "900") {
    const str = String(text || "");
    if (!str) return 0;
    const size = cssPx(cssSize);
    if (!__measureCtx && typeof document !== "undefined" && typeof document.createElement === "function") {
      try { __measureCtx = document.createElement("canvas").getContext("2d"); } catch { __measureCtx = null; }
    }
    if (__measureCtx && typeof __measureCtx.measureText === "function") {
      try {
        __measureCtx.font = `${weight} ${size}px 'Noto Sans JP', sans-serif`;
        const w = __measureCtx.measureText(str).width;
        if (w > 0) return Math.ceil(w);
      } catch { /* 量不到就退回估算，不讓版面函式拋錯 */ }
    }
    let units = 0;
    for (const ch of str) units += /[\x00-\xff]/.test(ch) ? 0.56 : 1;
    return Math.ceil(units * size);
  }
  const W = 900, H = 600;
  const RESTART_BTN = { x: 150, y: 492, w: 180, h: 48 };
  const WORLD_BTN = { x: 360, y: 492, w: 180, h: 48 };
  const HOME_BTN = { x: 570, y: 492, w: 180, h: 48 };
  const MENU_START_BTN = { x: W / 2 - 132, y: 478, w: 264, h: 54 };
  const MENU_CONTROLS_BTN = { x: 20, y: 22, w: 180, h: 38 };
  const HINT_BTN = { x: 532, y: 20, w: 78, h: 40 };
  let omamoriJobRef = null;
  let omamoriEnterAtMs = 0;
  const REROLL_BTN = { x: 620, y: 538, w: 190, h: 44 };
  const TUTORIAL_BTNS = [{x:100,y:390,w:330,h:70},{x:470,y:390,w:330,h:70}];
  const EXIT_BTNS = [{id:'exit-cancel',x:195,y:330,w:240,h:70},{id:'exit-confirm',x:465,y:330,w:240,h:70}];

  // ---- 色票與共用繪製工具 ----
  const C = {
    gold: "#c6a56d", goldHi: "#f3dfad", ink: "#221e24", vermilion: "#bf6149",
    jade: "#82a78e", azure: "#7e9eaa", violet: "#9c88a6", cyan: "#92bac0",
    text: "#f2e4c8", dim: "rgba(225,209,181,.77)"
  };
  const WEAPON_TONE = {
    katana: "#c46b51", barrier: "#7faab1", fire: "#d49459", boom: "#a18aac", thunder: "#cfb577", needle: "#8ab4b1",
    fusion_inkblade: "#d05638", fusion_thundercircle: "#5aa8b8",
    fusion_foxiai: "#e0b34e", fusion_exorcistblade: "#c9553f",
    fusion_foxfirebarrier: "#d98a4e", fusion_exorcistseal: "#b18a5a",
    fusion_flamefestival: "#d85c38", fusion_foxthunderlantern: "#e2a848",
    fusion_slashwheel: "#b56358", fusion_thundertalisman: "#889ac2"
  };
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const calm = () => !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const glow = (ctx, x, y, size, color, alpha) => window.FX?.glow(ctx, x, y, size, color, alpha);
  const pulse = (speed = 3, lo = 0.6) => calm() ? 0.85 : lo + (1 - lo) * (0.5 + 0.5 * Math.sin(Date.now() / 1000 * speed));
  const fontPx = font => Number(font.match(/([\d.]+)px/)[1]);

  const barCache = new WeakMap();
  const BAR_COLORS = {
    oil: [[0,"#a45a3c"],[.6,"#c99150"],[1,"#e3cb8c"]],
    lowOil: [[0,"#922f36"],[1,"#d46f54"]],
    xp: [[0,"#5a7c88"],[1,"#aed2c7"]],
    dawn: [[0,"#647381"],[.7,"#cc8e64"],[1,"#dec38a"]],
    boss: [[0,"#802e39"],[.6,"#b85443"],[1,"#d5a56e"]]
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
  // 木版畫共用框：和紙刷染、墨線、金箔角印；沿用所有舊座標與點擊範圍。
  function glassBox(ctx,x,y,w,h,r=10,fill="rgba(34,31,32,.92)",stroke="rgba(197,162,105,.7)",strokeW=1.5,ornate=false){
    if(!(w>0&&h>0))return;
    ctx.save();ctx.translate(x,y);
    const rad=Math.max(2,Math.min(6,r,w/6,h/6));
    ctx.lineJoin="round";ctx.fillStyle="rgba(23,20,24,.48)";
    ctx.beginPath();ctx.roundRect(2,3,w,h,rad);ctx.fill();
    ctx.beginPath();ctx.roundRect(0,0,w,h,rad);ctx.fillStyle=fill;ctx.fill();
    if(w>34&&h>23){
      ctx.save();ctx.clip();
      ctx.fillStyle="rgba(223,199,150,.065)";
      ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(w*.58,0);
      ctx.lineTo(w*.19,Math.min(h*.46,32));ctx.lineTo(0,h*.7);ctx.closePath();ctx.fill();
      ctx.strokeStyle="rgba(227,199,154,.11)";ctx.lineWidth=1;
      for(const t of [.33,.72]){
        ctx.beginPath();ctx.moveTo(w*t,2);
        ctx.lineTo(Math.min(w-3,w*t+Math.min(38,h*.32)),2);ctx.stroke();
      }
      ctx.restore();
      ctx.beginPath();ctx.roundRect(3,3,w-6,h-6,Math.max(1,rad-2));
      ctx.strokeStyle="rgba(222,191,137,.19)";ctx.lineWidth=1;ctx.stroke();
    }
    if(stroke){ctx.beginPath();ctx.roundRect(0,0,w,h,rad);ctx.strokeStyle=stroke;ctx.lineWidth=strokeW;ctx.stroke();}
    if(ornate&&w>=70&&h>=38){
      ctx.strokeStyle="#b69a64";ctx.lineWidth=2;ctx.lineCap="square";
      const d=Math.min(14,w/8,h/8);
      for(const [cx,cy,sx,sy] of [[5,5,1,1],[w-5,5,-1,1],[5,h-5,1,-1],[w-5,h-5,-1,-1]]){
        ctx.beginPath();ctx.moveTo(cx,cy+d*sy);ctx.lineTo(cx,cy);
        ctx.lineTo(cx+d*sx,cy);ctx.stroke();
      }
      ctx.fillStyle="#c19e62";ctx.beginPath();
      ctx.moveTo(w-23,h-10);ctx.lineTo(w-15,h-16);
      ctx.lineTo(w-8,h-10);ctx.lineTo(w-15,h-5);ctx.closePath();ctx.fill();
    }
    ctx.restore();
  }
  // 核准美術圖檔：不再使用程式生成的和紙作主底板。
  const illustratedArt = Object.create(null);
  const illustratedCharms = Object.create(null);
  const illustratedPassives = Object.create(null);
  if (typeof window.Image === "function") {
    for (const [name, file] of [
      ["ledger", "result_panel"], ["notice", "pause_panel"],
      ["neutral", "button_secondary"], ["primary", "button_primary"],
      ["danger", "button_danger"], ["title", "title_tag"],
      ["awakeningSeal", "awaken_seal"]
    ]) {
      const image = new window.Image();
      image.decoding = "async";
      image.fetchPriority = "low";
      image.onload = () => { illustratedArt[name] = image; };
      image.onerror = () => { /* 無素材時維持程式備援 */ };
      image.src = name === "awakeningSeal"
        ? "assets/img/ui/awaken_seal.svg?v=20261010-seal1"
        : `assets/img/ui/illustrated/${file}.webp?v=20261009-final-art1`;
    }
    // 2026-10-23 御守與被動技能專用素材
    for (const id of ["power", "step", "gather", "cadence", "reach", "guard"]) {
      const img = new window.Image();
      img.onload = () => { illustratedCharms[id] = img; };
      img.src = `assets/img/ui/charm-passive/hud_omamori_${id}.webp`;
    }
    for (const id of ["shield", "dmg", "rate", "crit", "spd", "dash", "oil_max", "mag"]) {
      const img = new window.Image();
      img.onload = () => { illustratedPassives[id] = img; };
      img.src = `assets/img/ui/passive/hud_passive_${id}.webp`;
    }
  }

  // ── R18-UI：三選單（技能升級／融合技／御守替換）共用「橫向卷軸」與卡片 raster 圖 ──
  // 候選捲軸底圖僅在明確注入 window.__UI_SCROLL_BG_SRC 時載入（人審核准前的評審／預覽用），
  // 正式站不注入即維持既有已核可素材行為，不偷換未核圖。
  const illustratedSkills = Object.create(null);
  const SKILL_RASTER_FILES = Object.freeze({
    katana: "assets/img/vfx/raster/katana_l1.webp",
    fire: "assets/img/vfx/raster/fire_attack_l1.webp",
    barrier: "assets/img/vfx/purification_array_vfx.webp",
    boom: "assets/img/vfx/ofuda_projectile.webp",
    thunder: "assets/img/vfx/thunder_strike_vfx.webp",
    needle: "assets/img/vfx/raster/needle.webp",
  });
  // The same manifest determines gameplay and UI skill art. Static paths above
  // are only a fallback before the manifest becomes available/offline.
  function skillCardRasterPath(id) {
    const phase = id === "fire" ? "attack" : id === "thunder" ? "strike" : "main";
    return window.sharedSkillRuntimePath?.(id, phase, 1) || SKILL_RASTER_FILES[id];
  }
  function loadSharedSkillCardArt() {
    if (typeof window.Image !== "function") return;
    for (const id of Object.keys(SKILL_RASTER_FILES)) {
      const img = new window.Image();
      img.onload = () => { illustratedSkills[id] = img; };
      img.onerror = () => { /* 失敗時回退既有 emblem */ };
      img.src = skillCardRasterPath(id) + "?v=20261027-unified-skill1";
    }
  }
  if (typeof window.loadRuntimeArtManifest === "function") {
    window.loadRuntimeArtManifest().then(loadSharedSkillCardArt, loadSharedSkillCardArt);
  } else loadSharedSkillCardArt();
  const scrollCandidateArt = Object.create(null);
  if (typeof window.Image === "function" && typeof window.__UI_SCROLL_BG_SRC === "string" && window.__UI_SCROLL_BG_SRC) {
    const cand = new window.Image();
    cand.decoding = "async";
    cand.onload = () => { scrollCandidateArt.scrollBg = cand; };
    cand.onerror = () => { /* 未核准候選載入失敗時回退既有已核可素材 */ };
    cand.src = window.__UI_SCROLL_BG_SRC;
  }
  function drawWashiSlices(ctx, image, x, y, w, h, cropX, cropY, padX, padY) {
    const iw = image.naturalWidth, ih = image.naturalHeight;
    const sw = [cropX, iw - cropX * 2, cropX], sh = [cropY, ih - cropY * 2, cropY];
    const px = Math.min(padX, w / 3), py = Math.min(padY, h / 3);
    const dw = [px, w - 2 * px, px], dh = [py, h - 2 * py, py];
    let sy = 0, dy = y;
    for (let row = 0; row < 3; row++) {
      let sx = 0, dx = x;
      for (let col = 0; col < 3; col++) {
        ctx.drawImage(image, sx, sy, sw[col], sh[row], dx, dy, dw[col], dh[row]);
        sx += sw[col]; dx += dw[col];
      }
      sy += sh[row]; dy += dh[row];
    }
  }

  // 3-slice：左右裝飾保持原始比例，中央可自由延展。
  function drawRibbonSlices(ctx, image, x, y, w, h, left = 62, right = 58) {
    const iw = image.naturalWidth, ih = image.naturalHeight;
    if (!iw || !ih || w <= 0 || h <= 0) return;
    // 依按鈕高度等比縮放端飾；只讓中段水平延展。
    const dl = Math.min(left * h / ih, w * .27), dr = Math.min(right * h / ih, w * .27);
    ctx.drawImage(image, 0, 0, left, ih, x, y, dl, h);
    ctx.drawImage(image, left, 0, iw-left-right, ih, x+dl, y, w-dl-dr, h);
    ctx.drawImage(image, iw-right, 0, right, ih, x+w-dr, y, dr, h);
  }
  // 舊木牌僅作 WebP 失敗時的備援。hitbox 保留原矩形。
  function tagPath(ctx,x,y,w,h,cut=11) {
    const c=Math.max(2,Math.min(cut,w*.08,h*.27));
    ctx.beginPath();
    ctx.moveTo(x+c,y);ctx.lineTo(x+w-c,y);
    ctx.lineTo(x+w,y+c);ctx.lineTo(x+w,y+h-c);
    ctx.lineTo(x+w-c,y+h);ctx.lineTo(x+c,y+h);
    ctx.lineTo(x,y+h-c);ctx.lineTo(x,y+c);ctx.closePath();
  }
  // R9 Item 2: 奧義重開小和風木牌（避開任務/方向 HUD，安全區錨定，支援觸控、手把、鍵盤）
  const FUSION_REOPEN_BTN = { id: "fusion-reopen", x: 740, y: 76, w: 142, h: 43 };
  // R10 Hitbox: 監聽 pointerdown，讓點擊/觸控右上奧義重開木牌真正觸發 KeyF 打開融合確認視窗
  if (typeof window !== "undefined" && typeof window.addEventListener === "function" && !window.__r10ReopenPointerHooked) {
    window.__r10ReopenPointerHooked = true;
    window.addEventListener("pointerdown", (e) => {
      if (!window.FUSION || typeof window.FUSION.getState !== "function") return;
      const fState = window.FUSION.getState();
      if (fState.state !== "held") return;

      const btn = FUSION_REOPEN_BTN;
      if (!btn) return;

      const cv = document.querySelector("canvas");
      if (!cv) return;

      const r = cv.getBoundingClientRect();
      const v = window.VIEWPORT?.get() || { width: 900, height: 600, offsetX: 0, offsetY: 0 };
      const scale = v.scale || 1;
      const px = (e.clientX - r.left) * v.width / r.width - v.offsetX;
      const py = (e.clientY - r.top) * v.height / r.height - v.offsetY;

      const minimum = 44 / scale;
      const padX = Math.max(0, (minimum - btn.w) / 2);
      const padY = Math.max(0, (minimum - btn.h) / 2);

      if (px >= btn.x - padX && px <= btn.x + btn.w + padX &&
          py >= btn.y - padY && py <= btn.y + btn.h + padY) {
        e.stopPropagation();
        if (e.cancelable) e.preventDefault();
        const keyEvt = typeof KeyboardEvent !== "undefined" ? new KeyboardEvent("keydown", { code: "KeyF", bubbles: true }) : { type: "keydown", code: "KeyF", bubbles: true };
            window.dispatchEvent(keyEvt);
      }
    }, true);
  }
  function drawFusionReopenButton(ctx, opts = {}) {
    const btn = opts.btn || FUSION_REOPEN_BTN;
    const tone = opts.tone || "normal";
    const focused = !!opts.focused;
    const { x, y, w, h } = btn;
    ctx.save();
    drawWoodTag(ctx, { x, y, w, h }, "primary", false, false);
    ctx.fillStyle = "rgba(21, 33, 47, 0.94)";
    ctx.beginPath();ctx.roundRect(x+6,y+5,w-12,h-10,5);ctx.fill();
    ctx.strokeStyle = "#ffe3a8";ctx.lineWidth=1.6;ctx.stroke();
    if (focused) {
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = "rgba(255, 226, 150, 0.95)";
      ctx.beginPath();
      ctx.roundRect(x - 2, y - 2, w + 4, h + 4, 6);
      ctx.stroke();
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = readableFont(16, "900");
    ctx.lineWidth=3;ctx.strokeStyle="#10131c";
    ctx.strokeText("開啟奧義選單", x+w/2, y+h/2+1);
    ctx.fillStyle = "#fff1cf";
    ctx.fillText("開啟奧義選單", x+w/2, y+h/2+1);
    ctx.restore();
  }
  function drawWoodTag(ctx,b,tone="normal",disabled=false,quiet=false) {
    const tagArt = illustratedArt[tone === "primary" ? "primary" : tone === "danger" ? "danger" : "neutral"];
    if (tagArt?.naturalWidth) {
      ctx.save();
      if (disabled) ctx.globalAlpha = 0.56;
      if (quiet && tone === "normal") {
        // 取原畫和紙中段，省去重複流蘇；不是程式產生的新材質。
        const iw=tagArt.naturalWidth, ih=tagArt.naturalHeight,cap=Math.min(65,iw*.19);
        ctx.drawImage(tagArt,cap,0,iw-cap*2,ih,b.x,b.y,b.w,b.h);
        ctx.strokeStyle="rgba(104,72,49,.6)";
        ctx.lineWidth=1.15;
        tagPath(ctx,b.x+1,b.y+1,b.w-2,b.h-2,5);
        ctx.stroke();
      } else drawRibbonSlices(ctx,tagArt,b.x,b.y,b.w,b.h);
      ctx.restore();
      return;
    }
    const t=BUTTON_TONES[tone] || BUTTON_TONES.normal;
    const {x,y,w,h}=b;
    ctx.save();
    ctx.lineJoin="round";
    ctx.fillStyle="rgba(16,13,14,.52)";
    tagPath(ctx,x+2,y+4,w,h,10);ctx.fill();
    ctx.fillStyle=disabled?"#474039":t.fill;
    tagPath(ctx,x,y,w,h,10);ctx.fill();
    ctx.strokeStyle=disabled?"#80776a":t.stroke;
    ctx.lineWidth=tone==="primary"?2.6:2;
    tagPath(ctx,x,y,w,h,10);ctx.stroke();
    ctx.strokeStyle="rgba(226,193,139,.45)";ctx.lineWidth=1;
    tagPath(ctx,x+4,y+4,w-8,h-8,7);ctx.stroke();
    // 木板條紋是垂直纖維與橫向斷墨，不使用 glossy 斜光。
    ctx.strokeStyle="rgba(221,182,119,.10)";
    ctx.lineWidth=1;
    for(const k of [.23,.48,.74]){
      ctx.beginPath();ctx.moveTo(x+13,y+h*k);
      ctx.lineTo(x+w-13,y+h*k+(k>.5?-2:2));ctx.stroke();
    }
    // 兩端的綁繩與印章是物件語彙，不改按鈕的文字安全區。
    ctx.strokeStyle="rgba(221,196,150,.72)";ctx.lineWidth=1.2;
    for(const px of [x+13,x+w-13]){
      ctx.beginPath();ctx.moveTo(px,y+10);ctx.lineTo(px,y+h-10);ctx.stroke();
      ctx.fillStyle="#332822";ctx.beginPath();ctx.arc(px,y+h/2,2,0,6.283);ctx.fill();
    }
    if(tone==="primary"||tone==="danger"){
      const stampX=x+w-23,stampY=y+h/2;
      ctx.fillStyle=tone==="primary"?"rgba(202,137,95,.68)":"rgba(140,63,58,.80)";
      ctx.beginPath();ctx.arc(stampX,stampY,Math.min(9,h*.18),0,6.283);ctx.fill();
      ctx.strokeStyle="rgba(240,202,155,.80)";
      ctx.lineWidth=1;ctx.beginPath();ctx.arc(stampX,stampY,Math.min(6,h*.14),0,6.283);ctx.stroke();
    }
    ctx.restore();
  }

  // 和紙旅帳／告示板：素材正常時使用墨染和紙貼圖，程式木框只作備援。
  // R9: 重構為乾淨厚和紙/木板既有 approved 圖層不拉伸/以九宮切片保留比例，消除「花底變形」。
  function drawWashiBoard(ctx,x,y,w,h,ledger=false,theme=null) {
    const art = illustratedArt[ledger ? "ledger" : "notice"];
    if (art?.naturalWidth) {
      ctx.save();
      const padX = ledger ? 54 : 40, padY = ledger ? 51 : 50;
      drawWashiSlices(ctx, art, x, y, w, h, padX, padY, padX, padY);
      // 中央內容區覆蓋一層厚實乾淨的和紙底，避免底圖花紋在不同寬高比例下拉伸變形
      const cx = x + padX, cy = y + padY, cw = w - padX * 2, ch = h - padY * 2;
      if (cw > 0 && ch > 0) {
        if (theme === "dark" || (!theme && ledger && h > 480)) {
          ctx.fillStyle = "rgba(20, 16, 22, 0.94)";
        } else {
          ctx.fillStyle = "rgba(244, 236, 222, 0.96)";
        }
        ctx.fillRect(cx, cy, cw, ch);
      }
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.translate(x,y);
    ctx.fillStyle="rgba(8,7,8,.55)";
    tagPath(ctx,8,10,w,h,20);ctx.fill();
    ctx.fillStyle="#4b3229";
    tagPath(ctx,0,0,w,h,20);ctx.fill();
    ctx.strokeStyle="#a47b50";ctx.lineWidth=3;
    tagPath(ctx,0,0,w,h,20);ctx.stroke();
    ctx.fillStyle=ledger?"#4e4038":"#57483b";
    tagPath(ctx,10,12,w-20,h-24,14);ctx.fill();
    ctx.strokeStyle="rgba(196,158,112,.65)";ctx.lineWidth=1.5;
    tagPath(ctx,13,15,w-26,h-30,12);ctx.stroke();
    // 橫向紙纖維、卷軸裝訂紋，幾乎不佔畫面而能清楚辨識紙材。
    ctx.save();
    tagPath(ctx,15,18,w-30,h-36,10);ctx.clip();
    ctx.strokeStyle="rgba(230,198,151,.11)";ctx.lineWidth=1;
    for(let k=0;k<12;k++){
      const yy=25+(h-50)*(k+.3)/12;
      ctx.beginPath();ctx.moveTo(24+(k%3)*18,yy);
      ctx.lineTo(w-25-(k%4)*13,yy+(k%2?1:-1));ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle="#6d4d34";ctx.strokeStyle="#b38c59";ctx.lineWidth=1.5;
    if(ledger){
      // 帳冊書脊與上下木軸，使結算頁成為旅帳而不是發光玻璃卡片。
      ctx.fillRect(12,14,13,h-28);
      ctx.fillRect(w-26,14,13,h-28);
      for(const px of [19,w-19]){
        ctx.beginPath();ctx.arc(px,19,9,0,6.283);ctx.fill();ctx.stroke();
        ctx.beginPath();ctx.arc(px,h-19,9,0,6.283);ctx.fill();ctx.stroke();
      }
      ctx.fillStyle="#a26750";ctx.fillRect(w-39,38,5,Math.min(h-76,100));
    }else{
      // 神社告示板的兩根縱木柱、掛繩與頂部庇檐。
      ctx.fillRect(6,14,9,h-28);ctx.fillRect(w-15,14,9,h-28);
      ctx.fillStyle="#654633";
      ctx.beginPath();ctx.moveTo(-10,13);ctx.lineTo(12,-9);
      ctx.lineTo(w-12,-9);ctx.lineTo(w+10,13);ctx.closePath();ctx.fill();
      ctx.strokeStyle="#b58b59";ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(-10,13);ctx.lineTo(12,-9);ctx.lineTo(w-12,-9);ctx.lineTo(w+10,13);ctx.stroke();
      for(const px of [38,w-38]){
        ctx.strokeStyle="#c0a070";ctx.lineWidth=2;
        ctx.beginPath();ctx.moveTo(px,-8);ctx.lineTo(px,15);ctx.stroke();
        ctx.fillStyle="#c5ab78";ctx.beginPath();ctx.arc(px,13,3,0,6.283);ctx.fill();
      }
    }
    // 朱印落款
    ctx.strokeStyle="rgba(170,85,65,.75)";ctx.lineWidth=2;
    ctx.beginPath();ctx.rect(w-40,h-45,18,18);ctx.stroke();
    ctx.strokeStyle="rgba(170,85,65,.35)";
    ctx.beginPath();ctx.moveTo(w-37,h-36);ctx.lineTo(w-25,h-36);
    ctx.moveTo(w-31,h-42);ctx.lineTo(w-31,h-29);ctx.stroke();
    ctx.restore();
  }

  // ── R18-U1 乾淨橫向和風卷軸（僅 u1scroll 審閱模式）────────────────────────────
  // 底圖規格是「卷首／卷尾左右端固定、中段米色和紙可橫向延展」的三切片 raster WebP。
  // 候選檔人審核准前不落 assets/img/、不接 assets.js／runtime-art-manifest；
  // 本函式只有在候選圖真的存在並載入成功時才畫得出來，否則回報 false，
  // 呼叫端沿用 R17 既有 drawWashiBoard／drawRitualCard 底材，不冒充「已正式替換」。
  const U1_SCROLL = {
    enabled: () => typeof window !== "undefined" && window.U1_EMAKI_PREVIEW === true,
    CANDIDATE_PATH: "scratch/r18-ui-scroll-opencode/candidate/ui_scroll_emaki_horizontal.webp",
    CROP_SPEC: "scratch/r18-ui-scroll-opencode/CROP_SPEC.md",
    SLICE_SPEC: { leftFixedRatio: 0.20, rightFixedRatio: 0.20 },
    _art: undefined,
    image() {
      if (U1_SCROLL._art !== undefined) return U1_SCROLL._art;
      if (typeof Image === "undefined") { U1_SCROLL._art = null; return null; }
      const img = new Image();
      img.onload = () => {};
      img.onerror = () => {};   // 無候選圖＝維持既有底材，不傷正式模式
      img.src = U1_SCROLL.CANDIDATE_PATH;
      U1_SCROLL._art = img;
      return img;
    }
  };
  function drawEmakiScroll(ctx, x, y, w, h) {
    if (typeof ctx?.drawImage !== "function" || !(w > 8 && h > 8)) return false;
    const img = U1_SCROLL.image();
    if (!img || !img.complete || img.naturalWidth <= 10 || img.naturalHeight <= 10) return false;
    const nw = img.naturalWidth, nh = img.naturalHeight;
    const capW = Math.max(1, Math.round(nw * U1_SCROLL.SLICE_SPEC.leftFixedRatio));
    const rightW = Math.max(1, Math.round(nw * U1_SCROLL.SLICE_SPEC.rightFixedRatio));
    const midW = Math.max(1, nw - capW - rightW);
    const drawW = Math.round(w * (capW / nw));
    const drawRight = Math.round(w * (rightW / nw));
    const midDrawW = w - drawW - drawRight;
    if (drawW <= 0 || drawRight <= 0 || midDrawW <= 0) return false;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, 0, 0, capW, nh, x, y, drawW, h);                 // 卷首（含上下木軸起端）
    ctx.drawImage(img, capW, 0, midW, nh, x + drawW, y, midDrawW, h);   // 中段：橫向延展，不重複花面
    ctx.drawImage(img, capW + midW, 0, rightW, nh, x + drawW + midDrawW, y, drawRight, h); // 卷尾
    ctx.restore();
    return true;
  }
  // 三選單共用：審閱模式下用卷軸底圖，失敗／未啟用時退回 R17 和紙帳板。
  function emakiBoard(ctx, x, y, w, h, fallback) {
    if (U1_SCROLL.enabled() && drawEmakiScroll(ctx, x, y, w, h)) return true;
    if (fallback) fallback();
    return false;
  }

  // ── R18-UI 三選單共用：橫向卷軸面板（左右木軸、和紙中段、3-slice 保角飾比例）──
  // 第一層：注入的人審候選 WebP（art/ui-scroll-proposal/，未核准不會出現在正式站）；
  // 第二層：既有已核可素材組合（result_panel 和紙中段＋其左右框木條作物當木軸）；
  // 全部為真 raster 圖片作物，沒有 SVG／程式幾何替代。熱區與版面幾何不因本函式改變。
  function drawScrollBoard(ctx, x, y, w, h) {
    const cand = scrollCandidateArt.scrollBg;
    if (cand?.naturalWidth && cand.naturalHeight) {
      // 候選 3-slice：左右木軸（各 cand 寬 12.5%）固定端飾比例，中段和紙延展。
      const iw = cand.naturalWidth, ih = cand.naturalHeight;
      const sliceW = Math.round(iw * 0.125);
      const dl = Math.min(Math.round(sliceW * h / ih), Math.round(Math.min(w * 0.3, Math.max(14, h * 0.16))));
      const dr = dl;
      ctx.drawImage(cand, 0, 0, sliceW, ih, x, y, dl, h);
      ctx.drawImage(cand, sliceW, 0, iw - sliceW * 2, ih, x + dl, y, w - dl - dr, h);
      ctx.drawImage(cand, iw - sliceW, 0, sliceW, ih, x + w - dr, y, dr, h);
      return;
    }
    // 回退一：由已核可 result_panel 組出同語彙橫向卷軸（和紙中段 9-slice＋左右框木條作物當木軸）。
    const art = illustratedArt.notice || illustratedArt.ledger;
    if (art?.naturalWidth && art.naturalHeight) {
      const iw = art.naturalWidth, ih = art.naturalHeight;
      // 中段和紙：沿用既有 9-slice（內框 crop 保住角飾），先畫滿全板。
      drawWashiSlices(ctx, art, x, y, w, h, 40, 42, Math.min(30, w * .09), Math.min(26, h * .2));
      // 木軸：取原畫左右框實心木條（587x323 原座標 crop），畫在板左／右端。
      const dw = Math.max(10, Math.round(Math.min(160, Math.min(h * 0.14, w * 0.14))));
      ctx.drawImage(art, 2, 14, 21, 295, x, y, dw, h);
      ctx.drawImage(art, iw - 24, 210, 21, 95, x + w - dw, y, dw, h);
      return;
    }
    drawWashiBoard(ctx, x, y, w, h, true);
  }
  // 三選單卡片共用 raster 圖：御守（charm-passive）、被動（passive）、技能／融合母技（vfx raster）。
  // 技能圖以中央正方形 crop 呈現（cover），不是整張拉伸；缺圖時回退既有 emblem。
  function drawScrollCardArt(ctx, key, cx, cy, r, opts = {}) {
    let image = null;
    if (typeof key === "string" && key.startsWith("charm_")) image = illustratedCharms[key.slice("charm_".length)];
    else if (illustratedPassives[key]) image = illustratedPassives[key];
    else if (illustratedSkills[key]) image = illustratedSkills[key];
    if (!image?.naturalWidth) return false;
    const R = Math.max(2, r);
    ctx.save();
    if (opts.background !== false) {
      ctx.fillStyle = opts.dark ? "rgba(17,13,15,.35)" : "rgba(61,44,33,.16)";
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.fill();
    }
    const iw = image.naturalWidth, ih = image.naturalHeight;
    const side = Math.min(iw, ih);
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.clip();
    ctx.drawImage(image, (iw - side) / 2, (ih - side) / 2, side, side, cx - R, cy - R, R * 2, R * 2);
    ctx.restore();
    return true;
  }

  // 技能/融合/御守三種抉擇面板共用和風設計語彙：核准 WebP 作主體。
  const RITUAL_COLORS = Object.freeze({
    ink: "#17232c", gold: "#e9c887", paper: "#f6eddb",
    ochre: "#a44939", text: "#34291f", pale: "#fff0cf"
  });
  function drawRitualHeader(ctx, x, y, w, h, title, subtitle = "", seal = "", compact = false) {
    if (!(w > 0 && h > 0)) return;
    ctx.save();
    const art = illustratedArt.title;
    if (art?.naturalWidth) drawRibbonSlices(ctx, art, x, y, w, h);
    ctx.fillStyle = "rgba(19,32,42,.91)";
    ctx.beginPath(); ctx.roundRect(x + 2, y + 1, w - 4, h - 2, Math.min(7, h * .24)); ctx.fill();
    ctx.strokeStyle = "rgba(220,183,115,.72)";
    ctx.lineWidth = Math.max(1, h * .035); ctx.stroke();
    const tall = h >= (compact ? 46 : 32);
    const sealSpace = seal && h >= 35 ? Math.min(h + 4, 44) : 0;
    const centerX = x + (w - sealSpace) / 2;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = RITUAL_COLORS.pale;
    ctx.font = readableFont(h < 30 ? 15 : compact ? 16 : 19, "900");
    fitText(ctx, title, centerX, y + h * (tall && subtitle ? .35 : .52), w - sealSpace - 22, {minSize:10,minCss:12});
    if (tall && subtitle) {
      ctx.font = readableFont(compact ? 9 : 10, "700");
      ctx.fillStyle = "#ead8b5";
      fitText(ctx, subtitle, centerX, y + h * .76, w - sealSpace - 22, {minSize:8,minCss:9});
    }
    if (sealSpace) drawFusionSealStamp(ctx, x + w - sealSpace * .55, y + h / 2, Math.min(11, h * .22), seal);
    ctx.restore();
  }
  function drawRitualCard(ctx, x, y, w, h, {selected = false, focused = false, dark = false} = {}) {
    if (!(w > 4 && h > 4)) return;
    ctx.save();
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 6); ctx.clip();
    const texture = illustratedArt.notice;
    if (texture?.naturalWidth) {
      ctx.globalAlpha = dark ? .23 : .42;
      drawWashiSlices(ctx, texture, x, y, w, h, 40, 42, Math.min(25,w*.12), Math.min(20,h*.2));
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = dark
      ? selected ? "rgba(24,34,40,.93)" : "rgba(21,28,34,.92)"
      : selected ? "rgba(252,239,213,.88)" : "rgba(249,243,230,.83)";
    ctx.fillRect(x, y, w, h);
    ctx.restore();
    ctx.save();
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 6);
    ctx.strokeStyle = selected ? "#c89553" : dark ? "rgba(214,181,129,.64)" : "rgba(113,77,55,.60)";
    ctx.lineWidth = selected ? 2.3 : 1.15; ctx.stroke();
    if (selected) {
      ctx.fillStyle = RITUAL_COLORS.ochre;
      ctx.fillRect(x + 3, y + 5, Math.min(4, w*.02), Math.max(0,h - 10));
    }
    if (focused) {
      ctx.beginPath(); ctx.roundRect(x - 2, y - 2, w + 4, h + 4, 8);
      ctx.lineWidth = 2.1; ctx.strokeStyle = RITUAL_COLORS.gold; ctx.stroke();
    }
    ctx.restore();
  }

  // 像朱印和金泥筆觸的選取回饋，對已核准的插畫不做重新描繪。
  const buttonFeedback = { hoverId: null, pressedId: null, until: 0 };
  function setButtonHover(id = null) { buttonFeedback.hoverId = id; }
  function pressButton(id) {
    buttonFeedback.pressedId = id;
    buttonFeedback.until = Date.now() + 190;
  }
  function isButtonPressed(id) {
    return !!id && buttonFeedback.pressedId === id && Date.now() < buttonFeedback.until;
  }
  function drawMenuFocus(ctx, btn, hovered = false) {
    if (!btn) return;
    const bright = pulse(3.5, .8);
    ctx.save();
    ctx.lineJoin = "round";
    ctx.strokeStyle = hovered ? "rgba(255,229,163,.92)" : `rgba(251,218,145,${.68 * bright})`;
    ctx.lineWidth = hovered ? 2.1 : 1.6;
    // 細金泥沿著紙牌中央的輪廓，不貼近兩端流蘇。
    tagPath(ctx,btn.x + 9,btn.y + 4,btn.w - 25,btn.h - 8,7);
    ctx.stroke();
    // 只在紙牌左內側加朱印／金點，取代原先不容易辨識的短底線。
    ctx.fillStyle = hovered ? "#eeae75" : "#b75f4d";
    ctx.beginPath();ctx.arc(btn.x + 18,btn.y + btn.h*.5,hovered ? 4.4 : 3.6,0,Math.PI*2);ctx.fill();
    ctx.restore();
  }

  const BUTTON_TONES = {
    normal: { fill: "rgba(101,75,56,.98)", stroke: "#c3a279", width: 1.6, text: C.text },
    primary: { fill: "rgba(146,65,48,.98)", stroke: "#e2bd85", width: 2.2, text: "#f7e8c7" },
    danger: { fill: "rgba(113,49,47,.98)", stroke: "#d49a83", width: 1.6, text: "#f7d7c3" },
    cyan: { fill: "rgba(65,96,89,.98)", stroke: "#b2c6aa", width: 1.6, text: "#e5f2e9" }
  };
  // 圖片外緣可能含流蘇、繩結，文字需以實際牌面為中心而非以 hitbox 中心硬對齊。
  function buttonTextArea(b, tone="normal", icon=false) {
    const scale = b.h / 80;
    // 窄型首頁按鈕不應被視覺安全區過度壓縮導致中文字被擠小。
    const compact = b.w < 170;
    const leftIdeal = (compact ? 13 : tone === "primary" || tone === "danger" ? 36 : 30) * scale + (icon ? 22 : 0);
    const rightIdeal = (compact ? 23 : tone === "primary" || tone === "danger" ? 53 : 49) * scale;
    // 手機把按鈕撐到 44 CSS 高時，木牌兩端裝飾不得吃掉半個文字區；
    // 只有「裝飾邊佔比過高」才等比收斂，寬按鈕（桌機）數值完全不變。
    const cap = b.w * 0.38, ideal = leftIdeal + rightIdeal;
    const squeeze = ideal > cap && ideal > 0 ? cap / ideal : 1;
    const left = leftIdeal * squeeze, right = rightIdeal * squeeze;
    const safeW = Math.max(22,b.w - left - right);
    return { x: b.x + left + safeW / 2, width: safeW - (compact ? 6 : 12), y: b.y + b.h/2 };
  }

  // 真正的互動狀態：鍵盤/手把選中、滑鼠 hover、按下、disabled 彼此有差異。
  function scrollFont(size,weight="700") {
    const scale=window.VIEWPORT?.get().scale||1;
    const px=scale<1?Math.max(size,Math.min(28,Math.ceil(14/scale))):size;
    return `${weight} ${px}px 'Noto Serif TC', 'Songti TC', 'PMingLiU', serif`;
  }
  function drawButton(ctx,b,label,{tone="normal",size=18,focus=false,icon=null,disabled=false,quiet=false,scrollText=false,visualOffsetY=0,mapTypography=false,fit=false,fitMin=10,fillAlpha=1}={}) {
    const t=BUTTON_TONES[tone]||BUTTON_TONES.normal;
    const hovered=!disabled && buttonFeedback.hoverId===b.id;
    const pressed=!disabled && isButtonPressed(b.id);
    const selected=!disabled && (focus || hovered);
    ctx.save();
    if(pressed)ctx.translate(0,2);  // 按鈕和文字一同下沉；hitbox 本身完全不變。
    if(selected && !pressed){
      ctx.shadowColor="rgba(245,185,91,.36)";
      ctx.shadowBlur=hovered?13:8;
    }
    // Pass fillAlpha to drawWoodTag
    // 透明化僅限按鈕底板，不降低文字對比；其他按鈕預設不變。
    ctx.save();
    ctx.globalAlpha *= Math.max(0, Math.min(1, fillAlpha));
    drawWoodTag(ctx,b,tone,disabled,quiet);
    ctx.restore();
    ctx.shadowBlur=0;
    if(selected || pressed){
      ctx.save();
      // 只在手繪牌面上刷一層暖光或暗朱色，不疊現代玻璃高光。
      ctx.fillStyle = pressed ? "rgba(53,29,22,.28)" : hovered ? "rgba(255,218,145,.15)" : "rgba(250,208,133,.10)";
      tagPath(ctx,b.x+8,b.y+5,b.w-24,b.h-10,6);
      ctx.fill();
      ctx.restore();
    }


    const showIcon=!!icon && b.w>=120;
    const safe=buttonTextArea(b,tone,showIcon);
    ctx.textAlign="center";
    // 只有旅路 mapTypography 採用同款明朝題字與筆畫描邊；戰鬥/選卡 HUD 保持原樣。
    if(mapTypography==="title"){
      // 與關卡地名共用 Kaisei Decol；只影響旅路首頁鈕，不改其他遊戲按鈕。
      const px=fontPx(scrollFont(size,"700"));
      ctx.font=`700 ${px}px 'Kaisei Decol', 'Noto Serif TC', 'PMingLiU', serif`;
    }else{
      ctx.font=mapTypography?scrollFont(size,"700"):scrollText?scrollFont(size,"700"):readableFont(size,"900");
    }
    // 結算回顧這類長詞鈕可要求等比縮字（fit），避免 fillText maxWidth 非等比壓扁；
    // 未傳 fit 的全部按鈕維持原渲染，零影響。
    if (fit) {
      const tw = ctx.measureText ? ctx.measureText(label).width : 0;
      if (tw > safe.width && tw > 0) {
        const shrunk = Math.max(fitMin, Math.floor(fontPx(ctx.font) * (safe.width / tw) * 10) / 10);
        ctx.font = ctx.font.replace(/([\d.]+)px/, `${shrunk}px`);
      }
    }
    // 真字框（有支援的瀏覽器）校正基準線，否則沿用近似原字體的光學值。
    const metrics=ctx.measureText(label);
    const fontSize=fontPx(ctx.font);
    const asc=Number.isFinite(metrics.actualBoundingBoxAscent)?metrics.actualBoundingBoxAscent:fontSize*.76;
    const desc=Number.isFinite(metrics.actualBoundingBoxDescent)?metrics.actualBoundingBoxDescent:fontSize*.12;
    const y=safe.y+(asc-desc)/2+visualOffsetY;
    const painted=!!illustratedArt[tone==="primary"?"primary":tone==="danger"?"danger":"neutral"]?.naturalWidth;
    const darkLettering=painted && tone!=="primary" && tone!=="danger";
    if(mapTypography){
      const ink=disabled?"#766759":tone==="primary"||tone==="danger"?"#fff0d7":mapTypography==="title"?"#39261d":"#3e281c";
      ctx.lineWidth=1.8;
      ctx.lineJoin="round";
      ctx.strokeStyle=tone==="primary"||tone==="danger"?"rgba(63,29,20,.9)":"rgba(255,245,220,.86)";
      if(typeof ctx.strokeText==="function")ctx.strokeText(label,safe.x,y,safe.width);
      ctx.fillStyle=ink;
      ctx.fillText(label,safe.x,y,safe.width);
    }else{
      ctx.fillStyle=darkLettering?"rgba(255,240,214,.35)":"rgba(18,13,12,.52)";
      ctx.fillText(label,safe.x+1,y+1,safe.width);
      ctx.fillStyle=disabled?"#b7a28a":darkLettering?"#332722":t.text;
      ctx.fillText(label,safe.x,y,safe.width);
    }
    if(showIcon){
      ctx.fillStyle=ctx.strokeStyle=disabled?"#b2a28b":darkLettering?"#594335":C.goldHi;
      drawActionIcon(ctx,icon,b.x+31,b.y+b.h/2,9);
    }
    if(selected && !pressed)drawMenuFocus(ctx,b,hovered);
    if(pressed){
      ctx.fillStyle="rgba(242,211,146,.62)";
      ctx.fillRect(b.x+20,b.y+b.h-6,Math.max(5,b.w-49),1.5);
    }
    ctx.restore();
  }

  function drawExitConfirm(ctx, focus = 0, target = 'home') {
    const toWorld = target === 'world';
    ctx.save();
    ctx.fillStyle = 'rgba(6,8,18,0.84)';fillScreen(ctx);
    drawWashiBoard(ctx,160,160,580,270,false);
    ctx.textAlign = 'center';ctx.fillStyle = '#3a291f';ctx.font = readableFont(24,'900');
    ctx.fillText('是否放棄本局？',450,215);
    ctx.fillStyle = '#46342a';ctx.font = readableFont(15);
    ctx.fillText(toWorld?'將返回旅路地圖，本局未結算的成績不會記錄。':'將返回首頁，本局未結算的成績不會記錄。',450,260);
    ctx.fillText('已儲存的單字學習紀錄會保留。',450,290);
    EXIT_BTNS.forEach((b,i)=>drawButton(ctx,b,i===0?'繼續本局':(toWorld?'放棄並回地圖':'放棄並回首頁'),{tone:i===0?'cyan':'danger',focus:i===focus}));
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
      listen: ['聽音與答題輔助', 'listen', `取貨時會播放發音；看包裹圖像與中文辨認詞義。${key('hint')}是答題輔助：第一階免費、重播並排除一項；第二階耗 4 油、顯示詞句。提示完成不升星，仍得 26 經驗與配送進度、回油 12。`],
      delivery: ['配送答題墊', 'pickup', '沿箭頭前往收件房屋。到站可安心讀題，戰鬥、燈油與局內時間暫停；離開恢復。走上假名答題墊停留 0.65 秒提交，移開可中斷；也可用確認鍵提交目前選項。'],
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
  // 主選單熱區以 44 CSS 保底。drawMainMenu 每幀刷新，game.js 讀同一個 UI.MENU_BTNS，
  // 且 MENU_START_BTN 立即同步（drawMainMenu 自己用 MENU_START_BTN 畫，命中用 MENU_BTNS[0]）。
  function refreshMenuButtons() {
    const minTouch = cssPx(MIN_TOUCH_CSS);
    const startH = Math.max(54, minTouch);
    MENU_START_BTN.h = startH;
    MENU_START_BTN.y = Math.min(MENU_START_BTN.y, H - startH);
    Object.assign(MENU_BTNS[0], { x: MENU_START_BTN.x, y: MENU_START_BTN.y, w: MENU_START_BTN.w, h: startH });
    const topH = Math.max(38, minTouch);
    MENU_CONTROLS_BTN.h = topH;
    for (const b of MENU_BTNS.slice(1)) {
      b.y = 22;
      b.h = topH;
    }
    // 直屏時確保所有主選單按鈕都有 44 CSS 高度
    if (window.VIEWPORT?.get?.().scale < 1) {
      MENU_START_BTN.h = Math.max(MENU_START_BTN.h, minTouch);
      MENU_BTNS[0].h = MENU_START_BTN.h;
      for (const b of MENU_BTNS.slice(1)) {
        b.h = Math.max(b.h, minTouch);
      }
    }
    return MENU_BTNS;
  }
  // 初始化時同步一次佈局（確保 VIEWPORT 已就緒）
  try { window.VIEWPORT?.get?.(); refreshMenuButtons(); } catch {}
  const END_BTNS = [{id:'restart',...RESTART_BTN},{id:'world',...WORLD_BTN},{id:'menu',...HOME_BTN}];
  // 結算畫面「可見 = 可命中」單一來源。勝利只給「回旅路地圖」；失敗保留三顆主按鈕。
  // game.js 命中測試與 drawEndScreen 都必須吃這個 getter，避免畫出但點不到、或點到但沒畫。
  // rect 依實際 scale 放大到至少 44 CSS（END_BTNS 固定 48 logical，phone scale≈0.65 時只有 31 CSS），
  // 以原中心對稱擴張並夾回可見範圍，確保按鈕在畫布內且可點。
  // C-F2：按鈕寬度以「文字安全區」反推——確保 buttonTextArea().width ≥ 實際繪製字級下的文字寬，
  // 而非只比對按鈕總寬；避免 wood-tag 裝飾佔比過大導致 fillText maxWidth 壓扁中文標籤。
  function endScreenButtons(state) {
    const v = (window.VIEWPORT && typeof window.VIEWPORT.get === "function" ? window.VIEWPORT.get() : null) || { scale: 1, width: 900, height: 600, offsetX: 0, offsetY: 0 };
    const scale = v.scale || 1;
    const left = -(v.offsetX || 0), top = -(v.offsetY || 0);
    const right = left + (v.width || 900), bottom = top + (v.height || 600);
    const base = END_BTNS.filter(b => state !== "won" || b.id === "world");
    if (!base.length) return [];
    const gap = cssPx(10), edge = cssPx(12);
    const minW = cssPx(MIN_TOUCH_CSS), minH = cssPx(MIN_TOUCH_CSS);
    const h = Math.max(minH, cssPx(48)); // 確保按鈕高度至少 48 CSS
    // buttonTextArea 內部用 b.h/80 做裝飾縮放，不是 viewport scale。
    // 實際繪製字級來自 scrollFont(18)：scale<1 時 clamp 到 max 28 logical px。
    const btnScaleForDeco = h / 80;
    const drawFontPx = scale < 1 ? Math.max(18, Math.min(28, Math.ceil(14 / scale))) : 18;
    function unitsOfLogical(text) {
      let u = 0;
      for (const ch of String(text)) u += /[\x00-\xff]/.test(ch) ? 0.56 : 1;
      return u;
    }
    function labelNeedLogical(b) {
      const label = END_BTN_LABEL[b.id] || b.id;
      const tone = b.tone || "normal";
      const primary = tone === "primary" || tone === "danger";
      const leftIdeal = (primary ? 36 : 30) * btnScaleForDeco;
      const rightIdeal = (primary ? 53 : 49) * btnScaleForDeco;
      const ideal = leftIdeal + rightIdeal;
      const textW = unitsOfLogical(label) * drawFontPx;
      // wood-tag 裝飾左右內距（受 cap=0.38 限制）+ 12px 文字內距
      // 若 w 足夠大使 cap>=ideal，safeW = w - ideal - 12；否則 safeW = w*0.62 - 12
      // 反推所需 w：在 cap<ideal 情況（手機常見）下 w >= (textW + 12) / 0.62
      const capRatio = 0.38;
      const wIfSqueezed = (textW + 12) / (1 - capRatio);
      const wIfNotSqueezed = textW + ideal + 12;
      return Math.max(wIfSqueezed, wIfNotSqueezed, 180);
    }
    const widestNeed = base.reduce((m, b) => Math.max(m, labelNeedLogical(b)), 0);
    // 桌機／平板原本就夠大時完全不動版面（座標與現在一致），只有真的不足才重排。
    if (widestNeed <= 180 && cssPx(MIN_TOUCH_CSS) <= 48) {
      return base.map(b => ({ ...b, cssW: Math.round(b.w * scale), cssH: Math.round(b.h * scale) }));
    }
    const room = Math.max(minW, right - left - edge * 2);
    const per = Math.floor((room - gap * (base.length - 1)) / base.length);
    const w = Math.max(minW, Math.min(Math.max(widestNeed, 180), per));
    const total = w * base.length + gap * (base.length - 1);
    const x0 = Math.round(left + (right - left - total) / 2);
    const y = Math.round(Math.min(Math.max(492, top), bottom - h));
    return base.map((b, i) => ({
      ...b,
      x: Math.round(x0 + i * (w + gap)),
      y,
      w,
      h,
      cssW: Math.round(w * scale),
      cssH: Math.round(h * scale)
    }));
  }
  const END_BTN_LABEL = { restart: "再踏夜行", world: "回旅路地圖", menu: "回到首頁" };
  function reviewButtons(misses = []) {
    return [...new Map(misses.map(w => [w.jp, w])).values()].slice(0, 3).map((word, i) => ({
      id: `review-${i}`, word, x: 305 + i * 174, y: 428, w: 164, h: 44
    }));
  }

  // 1. 主選單：封面圖＋暖色光暈與上升的火星，主要行動只有一個大按鈕。
  function drawAssetProgress(ctx, centered = false) {
    const p = window.ART_PROGRESS;
    if (!p || p.settled >= p.total) return;
    const b = screenBounds(), x = (b.left+b.right)/2, y = centered ? (b.top+b.bottom)/2 : b.top+104;
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
    refreshMenuButtons();
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

    drawButton(ctx, {...MENU_START_BTN,id:"start"}, "旅路地圖", { tone: "primary", size: 22, focus:focus===0, scrollText:true });

    ctx.fillStyle = C.dim;
    ctx.font = readableFont(13, "bold");
    ctx.fillText(`夜行紀錄：最高得分 ${STORE.data.best || 0} 點｜最高配達 ${STORE.data.bestDel || 0} 件`, W / 2, 565);

    for (const bt of MENU_BTNS.slice(1)) {
      const label = bt.id === "controls" ? "操作與自定義" : bt.id === "cards" ? "卡片一覽" : "單字圖鑑";
      drawButton(ctx, bt, label, { size: 14, focus:MENU_BTNS[focus]?.id===bt.id, quiet:true, scrollText:true });
    }
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

  // Diegetic HUD：把重要資訊變成夜行世界裡的實體物件。
  function drawDiegeticOilLanternFallback(ctx, x, y, oil, maxOil, lowOil, time) {
    const ratio = clamp(oil / Math.max(1, maxOil), 0, 1);
    const cx = x + 45, top = y + 18, bodyH = 106;
    const lit = lowOil ? '#ff6650' : '#ffb23d';
    const flicker = calm() ? 0.84 : 0.78 + Math.sin(time * 7.2) * 0.08 + Math.sin(time * 12.5) * 0.04;
    ctx.save();
    ctx.strokeStyle = '#9b6a34'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - 25, top + 2); ctx.quadraticCurveTo(cx - 31, y - 2, cx, y - 5); ctx.quadraticCurveTo(cx + 31, y - 2, cx + 25, top + 2); ctx.stroke();
    glow(ctx, cx, top + 49, 150, lit, 0.28 * flicker);
    const paper = ctx.createLinearGradient(cx - 42, top, cx + 42, top + bodyH);
    paper.addColorStop(0, lowOil ? '#dfa070' : '#f0cb83'); paper.addColorStop(0.5, lowOil ? '#ce805d' : '#e5ae65'); paper.addColorStop(1, '#bf7748');
    ctx.fillStyle = paper; ctx.strokeStyle = '#5d3422'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(cx - 29, top); ctx.quadraticCurveTo(cx - 46, top + 20, cx - 42, top + 53); ctx.quadraticCurveTo(cx - 40, top + 88, cx - 26, top + bodyH);
    ctx.quadraticCurveTo(cx, top + bodyH + 7, cx + 26, top + bodyH); ctx.quadraticCurveTo(cx + 40, top + 88, cx + 42, top + 53); ctx.quadraticCurveTo(cx + 46, top + 20, cx + 29, top); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(97,47,25,.48)'; ctx.lineWidth = 1.2;
    for (const yy of [top + 22, top + 43, top + 65, top + 86]) { ctx.beginPath(); ctx.moveTo(cx - 39, yy); ctx.quadraticCurveTo(cx, yy + 5, cx + 39, yy); ctx.stroke(); }
    ctx.fillStyle = '#4a2b1d'; ctx.beginPath(); ctx.roundRect(cx - 31, top - 7, 62, 10, 4); ctx.fill(); ctx.beginPath(); ctx.roundRect(cx - 30, top + bodyH - 2, 60, 9, 4); ctx.fill();
    ctx.fillStyle = '#51251d'; ctx.strokeStyle = '#8d532f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(cx - 22, top + 29, 44, 42, 9); ctx.fill(); ctx.stroke();
    glow(ctx, cx, top + 50, 76, lit, 0.6 * flicker);
    const flameH = 10 + 17 * Math.max(0.16, ratio);
    ctx.fillStyle = lowOil ? '#ff684e' : '#ffd258'; ctx.beginPath(); ctx.moveTo(cx, top + 62); ctx.bezierCurveTo(cx - 12, top + 54, cx - 8, top + 47 - flameH * 0.3, cx, top + 38);
    ctx.bezierCurveTo(cx + 2, top + 47 - flameH * 0.22, cx + 12, top + 50, cx + 9, top + 59); ctx.quadraticCurveTo(cx + 5, top + 65, cx, top + 62); ctx.fill();
    ctx.fillStyle = '#fff0a0'; ctx.beginPath(); ctx.ellipse(cx + 1, top + 55, 3.5, 7, 0.2, 0, 6.283); ctx.fill();
    ctx.textAlign = 'center'; ctx.font = readableFont(11, '900'); ctx.fillStyle = '#5b2a1e'; ctx.fillText('燈油', cx, top + 17);
    ctx.font = readableFont(15, '900'); ctx.fillStyle = '#341b16'; ctx.fillText(Math.ceil(oil) + '/' + maxOil, cx, top + 95);
    ctx.strokeStyle = '#9f2d24'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, top + bodyH + 7); ctx.lineTo(cx, top + bodyH + 23); ctx.stroke();
    ctx.lineWidth = 2; for (const dx of [-6,-2,2,6]) { ctx.beginPath(); ctx.moveTo(cx, top + bodyH + 15); ctx.lineTo(cx + dx, top + bodyH + 30); ctx.stroke(); }
    ctx.restore();
  }

  function drawDiegeticOilLantern(ctx, x, y, oil, maxOil, lowOil, time, hit = 0) {
    const art = window.ART?.hud_lantern_oil;
    if (!art?.complete || !art.naturalWidth || !art.naturalHeight) {
      drawDiegeticOilLanternFallback(ctx, x, y, oil, maxOil, lowOil, time);
      return;
    }

    const ratio = clamp(oil / Math.max(1, maxOil), 0, 1);
    const hitImpulse = clamp(hit, 0, 1);
    const motion = !calm();
    const lit = lowOil ? "#ff5848" : "#ffb13b";
    const flicker = motion ? 0.82 + Math.sin(time * 7.2) * 0.065 + Math.sin(time * 12.7) * 0.035 : 0.86;
    const hitDim = 1 - hitImpulse * 0.55;
    const compactLandscape = (window.innerHeight || 600) <= 500 &&
      (window.innerWidth || 900) > (window.innerHeight || 600) * 1.55;
    // 手機橫向的可視邏輯寬度會比 900 大很多；只在這種寬扁視窗放大約 13%，
    // 平板/桌面維持原比例，避免 4:3 畫面左上角過重。
    const assetH = compactLandscape ? 190 : 168;
    const assetW = assetH * (art.naturalWidth / art.naturalHeight);
    const dx = x - 4;
    const dy = y - 6;
    const windowCx = dx + assetW * 0.571;
    const windowCy = dy + assetH * 0.445;
    const windowW = assetW * 0.285;
    const windowH = assetH * 0.235;

    const bodyCx = dx + assetW * 0.57;
    const bodyCy = dy + assetH * 0.55;
    const bodyW = assetW * 0.58;
    const bodyH = assetH * 0.60;
    const oilLight = 0.28 + Math.pow(ratio, 0.7) * 0.72;
    const pivotX = dx + assetW * 0.57;
    const pivotY = dy + assetH * 0.025;
    const idleSwing = motion ? Math.sin(time * 1.55) * 0.012 + Math.sin(time * 2.7 + 0.9) * 0.005 : 0;
    const impactSwing = motion ? hitImpulse * (Math.sin(time * 32) * 0.055 + Math.sin(time * 47 + 0.5) * 0.018) : 0;
    const lanternBob = motion ? Math.sin(time * 2.2 + 0.4) * 0.35 + hitImpulse * Math.sin(time * 36) * 1.3 : 0;

    ctx.save();
    // 整顆提燈以吊鉤為支點做輕微次級物理；受擊時放大擺幅，之後隨 impulse 回穩。
    ctx.translate(pivotX, pivotY + lanternBob);
    ctx.rotate(idleSwing + impactSwing);
    ctx.translate(-pivotX, -pivotY);
    glow(ctx, windowCx, windowCy, assetW * (0.52 + ratio * 0.26), lit, (0.08 + ratio * 0.24) * flicker * hitDim);

    // 先在透明窗洞後方畫火焰，再覆上美術素材，窗框自然遮住邊緣。
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(windowCx - windowW / 2, windowCy - windowH / 2, windowW, windowH, Math.max(4, windowW * 0.12));
    ctx.clip();
    const innerGlow = ctx.createRadialGradient(windowCx, windowCy + windowH * 0.08, 0, windowCx, windowCy, windowW * (0.5 + ratio * 0.18));
    innerGlow.addColorStop(0, lowOil ? `rgba(255,96,58,${0.22 + oilLight * 0.34 * hitDim})` : `rgba(255,209,82,${0.24 + oilLight * 0.42 * hitDim})`);
    innerGlow.addColorStop(0.58, lowOil ? `rgba(190,40,30,${0.12 + oilLight * 0.2 * hitDim})` : `rgba(255,114,24,${0.12 + oilLight * 0.24 * hitDim})`);
    innerGlow.addColorStop(1, "rgba(35,12,10,0)");
    ctx.fillStyle = innerGlow;
    ctx.fillRect(windowCx - windowW / 2, windowCy - windowH / 2, windowW, windowH);

    const baseSway = motion ? Math.sin(time * 2.35) * 0.12 + Math.sin(time * 4.1 + 0.7) * 0.045 : 0;
    const impactSway = motion ? (Math.sin(time * 42) * 0.46 + Math.sin(time * 67 + 1.3) * 0.17) * hitImpulse : 0;
    const sway = baseSway + impactSway;
    const stretch = motion ? 1 + Math.sin(time * 5.2 + 0.4) * 0.045 + Math.sin(time * 31) * 0.12 * hitImpulse : 1;
    const flameScale = (0.46 + Math.pow(ratio, 0.72) * 0.54) * (1 - hitImpulse * 0.1);
    const flameH = windowH * 0.66 * flameScale * stretch;
    const flameW = windowW * 0.42 * flameScale / Math.sqrt(Math.max(0.72, stretch));
    const fy = windowCy + windowH * 0.29;
    const tipX = windowCx + flameW * sway;
    const midX = windowCx + flameW * sway * 0.42;
    ctx.globalAlpha = hitDim;
    ctx.fillStyle = lowOil ? "#ff6a49" : "#ffb52d";
    ctx.beginPath();
    ctx.moveTo(windowCx, fy);
    ctx.bezierCurveTo(windowCx - flameW * 0.72, fy - flameH * 0.2, midX - flameW * 0.35, fy - flameH * 0.62, tipX - flameW * 0.08, fy - flameH);
    ctx.bezierCurveTo(tipX + flameW * 0.02, fy - flameH * 0.66, midX + flameW * 0.64, fy - flameH * 0.5, windowCx + flameW * 0.46, fy - flameH * 0.13);
    ctx.quadraticCurveTo(windowCx + flameW * 0.22, fy + flameH * 0.08, windowCx, fy);
    ctx.fill();
    ctx.fillStyle = lowOil ? "#ffd17a" : "#fff08a";
    ctx.beginPath();
    ctx.ellipse(windowCx + flameW * (0.02 + sway * 0.18), fy - flameH * 0.18, flameW * 0.13, flameH * 0.25, sway * 0.24, 0, 6.283);
    ctx.fill();
    ctx.restore();

    ctx.drawImage(art, dx, dy, assetW, assetH);

    // 紙罩不直接降整張 PNG 透明度：以局部 multiply + screen 疊出內部透光感。
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(bodyCx, bodyCy, bodyW / 2, bodyH / 2, 0, 0, 6.283);
    ctx.clip();
    const dimAlpha = (1 - ratio) * 0.2 + hitImpulse * 0.14;
    if (dimAlpha > 0.005) {
      ctx.globalCompositeOperation = "multiply";
      ctx.globalAlpha = dimAlpha;
      ctx.fillStyle = lowOil ? "#8d3025" : "#5d3b2a";
      ctx.fillRect(bodyCx - bodyW / 2, bodyCy - bodyH / 2, bodyW, bodyH);
    }
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = (0.055 + ratio * 0.21) * hitDim;
    const paperGlow = ctx.createRadialGradient(bodyCx, bodyCy - bodyH * 0.08, bodyW * 0.05, bodyCx, bodyCy, bodyW * 0.56);
    paperGlow.addColorStop(0, lowOil ? "#ff9f62" : "#fff0a4");
    paperGlow.addColorStop(0.65, lowOil ? "#d95b43" : "#ffc45e");
    paperGlow.addColorStop(1, "rgba(255,180,80,0)");
    ctx.fillStyle = paperGlow;
    ctx.fillRect(bodyCx - bodyW / 2, bodyCy - bodyH / 2, bodyW, bodyH);
    ctx.restore();

    // 數字維持即時資料，不烘進圖片。
    const valueY = dy + assetH * 0.655;
    const viewportScale = window.VIEWPORT?.get().scale || 1;
    // 這組數字屬於燈籠美術的一部分，不套全域 14 CSS px 的 readableFont 下限，
    // 否則在手機橫向會被強制放大而超出紙罩。
    const valueSize = Math.max(assetW * 0.10, 11 / Math.max(0.01, viewportScale));
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `900 ${valueSize}px 'Noto Sans JP', 'Microsoft JhengHei', sans-serif`;
    ctx.lineWidth = Math.max(1.2, valueSize * 0.09);
    ctx.strokeStyle = "rgba(255,238,190,.82)";
    ctx.fillStyle = lowOil ? "#7a2c24" : "#4a2a1d";
    const value = String(Math.ceil(oil)) + "/" + String(maxOil);
    ctx.strokeText(value, windowCx, valueY, assetW * 0.48);
    ctx.fillText(value, windowCx, valueY, assetW * 0.48);
    ctx.restore();
  }

  // 雷達專用原創 icon：不依賴 emoji 或貨物內容，避免之後換整套圖示時再牽動雷達。
  function drawRadarPickupIcon(ctx, x, y, scale = 1, urgent = false) {
    const s = 6.4 * scale;
    ctx.save();
    ctx.translate(x, y);
    glow(ctx, 0, 0, s * 3.2, urgent ? "#ff6b50" : "#e8bd68", urgent ? 0.55 : 0.34);
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(1, 1.1 * scale);
    ctx.strokeStyle = urgent ? "#ffd0a3" : "#ffe1a0";
    ctx.fillStyle = urgent ? "#c85f3d" : "#b9783f";
    ctx.beginPath();
    ctx.moveTo(-s, -s * 0.35);
    ctx.lineTo(0, -s * 0.92);
    ctx.lineTo(s, -s * 0.35);
    ctx.lineTo(s, s * 0.72);
    ctx.lineTo(0, s * 1.08);
    ctx.lineTo(-s, s * 0.72);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = urgent ? "#f3b56b" : "#e7b86d";
    ctx.beginPath();
    ctx.moveTo(-s, -s * 0.35);
    ctx.lineTo(0, -s * 0.92);
    ctx.lineTo(s, -s * 0.35);
    ctx.lineTo(0, s * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255,240,190,.68)";
    ctx.beginPath(); ctx.moveTo(0, -s * 0.92); ctx.lineTo(0, s * 1.02); ctx.stroke();
    ctx.restore();
  }

  function drawRadarDeliverySeal(ctx, x, y, scale = 1) {
    const s = 7 * scale;
    ctx.save();
    ctx.translate(x, y);
    glow(ctx, 0, 0, s * 3.8, "#6edff0", 0.44);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = "#234d70";
    ctx.strokeStyle = "#9beaf2";
    ctx.lineWidth = Math.max(1, 1.15 * scale);
    ctx.beginPath(); ctx.roundRect(-s, -s, s * 2, s * 2, s * 0.28); ctx.fill(); ctx.stroke();
    ctx.rotate(-Math.PI / 4);
    ctx.strokeStyle = "#d9fbff";
    ctx.lineWidth = Math.max(1, 1.05 * scale);
    ctx.beginPath(); ctx.arc(0, 0, s * 0.36, 0, 6.283); ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * s * 0.42, Math.sin(a) * s * 0.42);
      ctx.lineTo(Math.cos(a) * s * 0.78, Math.sin(a) * s * 0.78);
      ctx.stroke();
    }
    ctx.fillStyle = "#e9ffff";
    ctx.beginPath(); ctx.arc(0, 0, s * 0.14, 0, 6.283); ctx.fill();
    ctx.restore();
  }

  function drawDiegeticMinimapFallback(ctx, x, y, size, P, orders, job, boss) {
    const cx = x + size / 2, cy = y + size / 2, outerR = size / 2, mapR = outerR - 17, k = (mapR - 7) / 1300;
    ctx.save();
    ctx.fillStyle = 'rgba(7,9,18,.92)'; ctx.beginPath(); ctx.arc(cx + 2, cy + 4, outerR + 3, 0, 6.283); ctx.fill();
    const metal = ctx.createLinearGradient(x, y, x + size, y + size);
    metal.addColorStop(0, '#fff0a2'); metal.addColorStop(.22, '#ba8428'); metal.addColorStop(.55, '#6c4619'); metal.addColorStop(.78, '#e7ba52'); metal.addColorStop(1, '#8b5c20');
    ctx.fillStyle = metal; ctx.beginPath(); ctx.arc(cx, cy, outerR, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#15162a'; ctx.beginPath(); ctx.arc(cx, cy, outerR - 6, 0, 6.283); ctx.fill();
    ctx.strokeStyle = '#e8c36a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, outerR - 10, 0, 6.283); ctx.stroke();
    for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, r0 = outerR - (i % 3 === 0 ? 15 : 12), r1 = outerR - 8; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.stroke(); }
    ctx.font = readableFont(9, '900'); ctx.textAlign = 'center'; ctx.fillStyle = '#f4d77a'; ctx.fillText('北', cx, y + 17); ctx.fillText('南', cx, y + size - 10); ctx.fillText('西', x + 13, cy + 4); ctx.fillText('東', x + size - 13, cy + 4);
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, mapR, 0, 6.283); ctx.clip(); ctx.fillStyle = 'rgba(10,17,34,.97)'; ctx.fillRect(cx-mapR, cy-mapR, mapR*2, mapR*2);
    ctx.strokeStyle = 'rgba(127,227,240,.13)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx-mapR,cy); ctx.lineTo(cx+mapR,cy); ctx.moveTo(cx,cy-mapR); ctx.lineTo(cx,cy+mapR); ctx.stroke();
    for (const rr of [mapR*.38,mapR*.72]) { ctx.beginPath(); ctx.arc(cx,cy,rr,0,6.283); ctx.stroke(); }
    const place = (wx, wy) => { let dx = (wx - P.x) * k, dy = (wy - P.y) * k; const len = Math.hypot(dx,dy), max = mapR - 8, edge = len > max; if (edge && len > 0) { dx *= max / len; dy *= max / len; } return {x:cx+dx,y:cy+dy,edge}; };
    for (const o of orders) { const m = place(o.from.x,o.from.y), urgent = o.life < 25; drawRadarPickupIcon(ctx,m.x,m.y,m.edge?.72:1,urgent); }
    if (job) { const m=place(job.to.x,job.to.y); drawRadarDeliverySeal(ctx,m.x,m.y,m.edge?.76:1); }
    if (boss) { const m=place(boss.x,boss.y); glow(ctx,m.x,m.y,28,'#ff3b4f',.6); ctx.fillStyle='#ff3b4f';ctx.beginPath();ctx.arc(m.x,m.y,5,0,6.283);ctx.fill(); }
    glow(ctx,cx,cy,20,'#ffffff',.65); ctx.fillStyle='#fff'; ctx.save(); ctx.translate(cx,cy); ctx.rotate(P.faceAng||0); ctx.beginPath(); ctx.moveTo(7,0);ctx.lineTo(-4,-4);ctx.lineTo(-1,0);ctx.lineTo(-4,4);ctx.closePath();ctx.fill();ctx.restore();
    ctx.restore(); ctx.restore();
  }

  // ---- 御守 HUD & 替換介面 (M2-OMAMORI-HUD-R1) ----
  function drawCharmHud(ctx, { charms = [], maxSlots = 3, pendingDrop = null, inputMode = 'keyboard' }) {
    const b = screenBounds();
    const slotW = cssPx(64), slotH = cssPx(32), gap = cssPx(10);
    const startX = b.right - (slotW * maxSlots + gap * (maxSlots - 1)) - cssPx(20);
    const startY = b.top + cssPx(20);
    const hitRects = [];

    ctx.save();
    // 容器：和紙微透底板
    glassBox(ctx, startX - cssPx(6), startY - cssPx(6), slotW * maxSlots + gap * (maxSlots - 1) + cssPx(12), slotH + cssPx(12), 6, "rgba(34,31,32,.7)", "rgba(197,162,105,.3)");

    for (let i = 0; i < maxSlots; i++) {
      const charm = charms[i];
      const x = startX + i * (slotW + gap);
      const y = startY;

      // 槽位背景：優先使用核准御守素材
      const charmId = charm ? charm.id.replace("charm_", "") : null;
      const omamoriArt = charmId ? illustratedCharms[charmId] : null;
      if (omamoriArt) {
        const artH = slotH * 0.8;
        const artW = artH * (omamoriArt.naturalWidth / omamoriArt.naturalHeight);
        ctx.drawImage(omamoriArt, x + (slotW - artW) / 2, y + (slotH - artH) / 2, artW, artH);
      } else {
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.beginPath(); ctx.roundRect(x, y, slotW, slotH, 4); ctx.fill();
      }


      if (charm) {
        // 獲取 metadata (從 ui.js 內部定義的 charm 資訊)
        // 這裡假設 metadata 在同一閉包內，我們直接用 id 索引
        const meta = (window.UI_CHARM_META || {
          charm_power: { ja: "力紋守", s: "每層技能傷害係數 +0.20（加算）" },
          charm_step: { ja: "風步守", s: "每層移動速度 +28 px/s" },
          charm_gather: { ja: "招靈守", s: "每層靈玉吸取半徑 +75 px" },
          charm_cadence: { ja: "疾奏守", s: "每層妖刀／靈陣／靈針有效攻速 +0.25" },
          charm_reach: { ja: "遠霞守", s: "每層射程與爆炸半徑 +10%" },
          charm_guard: { ja: "紙甲守", s: "每層受擊燈油損失 -10%（不含答題）" },
        })[charm.id] || { ja: "??", s: "未知" };

        // 渲染名稱
        ctx.fillStyle = C.goldHi;
        ctx.font = readableFont(12, 'bold');
        ctx.textAlign = 'center';
        ctx.fillText(meta.ja, x + slotW / 2, y + slotH / 2 + 4);

        // 等級印記 (小點)
        for (let l = 0; l < 3; l++) {
          ctx.fillStyle = l < charm.level ? C.gold : "rgba(255,255,255,0.2)";
          ctx.beginPath(); ctx.arc(x + 8 + l * 6, y + slotH - 6, 2, 0, 6.283); ctx.fill();
        }
      } else {
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.strokeRect(x + 2, y + 2, slotW - 4, slotH - 4);
      }
      hitRects.push({ id: `charm_slot_${i}`, x, y, w: slotW, h: slotH });
    }

    if (pendingDrop) {
      const px = startX + (slotW * maxSlots + gap * (maxSlots - 1)) / 2;
      const py = startY + slotH + cssPx(14);
      ctx.fillStyle = C.vermilion;
      ctx.font = readableFont(14, 'bold');
      ctx.textAlign = 'center';
      ctx.fillText(`拾取到 ${pendingDrop.name}`, px, py);
      // 簡單的呼吸光暈提示
      glow(ctx, px, py - 4, 20, C.vermilion, 0.4 * pulse(4, 0.5));
    }
    ctx.restore();
    return hitRects;
  }

  function drawCharmSwap(ctx, { charms = [], pending = null, selectedIndex = -1, inputMode = 'keyboard' }) {
    if (!pending) return [];
    const b = screenBounds();
    const midX = (b.left + b.right) / 2;
    const midY = (b.top + b.bottom) / 2;
    const s = viewScale();
    const cssH = b.height * s;
    const isCompact = cssH < 440 || b.height < 440;
    const maxPanelCssW = isCompact ? 560 : 600;
    const maxPanelCssH = isCompact ? 330 : 420;
    const panelW = Math.min(cssPx(maxPanelCssW), b.width - cssPx(16));
    const panelH = Math.min(cssPx(maxPanelCssH), b.height - cssPx(12));
    const x = Math.max(b.left + cssPx(8), midX - panelW / 2);
    const y = Math.max(b.top + cssPx(6), midY - panelH / 2);
    const hitRects = [];

    ctx.save();
    fillScreen(ctx);
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = "rgba(0,0,0,0.72)";
    ctx.fillRect(0, 0, b.width, b.height);
    ctx.globalAlpha = 1;

    drawScrollBoard(ctx, x, y, panelW, panelH);

    const innerX = x + cssPx(isCompact ? 16 : 24);
    const innerW = panelW - cssPx(isCompact ? 32 : 48);

    const charmEffects = {
      charm_power: l => `傷害係數 +${(l * 0.20).toFixed(2)}`,
      charm_step: l => `移速 +${l * 28} px/s`,
      charm_gather: l => `吸靈半徑 +${l * 75} px`,
      charm_cadence: l => `有效攻速 +${(l * 0.25).toFixed(2)}`,
      charm_reach: l => `射程/爆炸半徑 +${l * 10}%`,
      charm_guard: l => `燈油損失 -${l * 10}%`,
    };

    const charmMeta = {
      charm_power: { ja: "力紋守", s: "每層技能傷害係數 +0.20（加算）" },
      charm_step: { ja: "風步守", s: "每層移動速度 +28 px/s" },
      charm_gather: { ja: "招靈守", s: "每層靈玉吸取半徑 +75 px" },
      charm_cadence: { ja: "疾奏守", s: "每層妖刀／靈陣／靈針有效攻速 +0.25" },
      charm_reach: { ja: "遠霞守", s: "每層射程與爆炸半徑 +10%" },
      charm_guard: { ja: "紙甲守", s: "每層受擊燈油損失 -10%（不含答題）" },
      ...(window.UI_CHARM_META || {}),
    };
    const pendingKey = pending.id?.startsWith("charm_") ? pending.id : `charm_${pending.id}`;
    const pMeta = charmMeta[pending.id] || charmMeta[pendingKey] || { ja: pending.name || "新御守", s: "新拾獲御守效果" };
    const pEffectFn = charmEffects[pending.id] || charmEffects[pendingKey];
    const pEffectStr = pEffectFn ? pEffectFn(pending.level || 1) : pMeta.s;

    // 1) 三選單共用的木版題簽（標題與副標於下方一次繪製）。

    // 遮蓋舊標題文字，改用三面板共用的木版奧義題簽；
    // 不挪動以下卡片、按鈕或交換熱區。
    drawRitualHeader(ctx, innerX, y + cssPx(isCompact ? 8 : 9), innerW,
      cssPx(isCompact ? 35 : 45), "御守替換・擇契",
      isCompact ? "" : "新守入匣・擇一舊守交換，亦可放棄", "守", isCompact);

    // 2) 新御守展示：圖示放大 1.2x~1.4x，名稱、效果、說明分三行清楚呈現
    const showY = y + cssPx(isCompact ? 46 : 60);
    const showH = cssPx(isCompact ? 64 : 78);
    drawRitualCard(ctx, innerX, showY, innerW, showH, { dark: true, selected: true });
    {
      const pendingId = String(pending.id || "").replace("charm_", "");
      const art = illustratedCharms[pendingId];
      const artH = showH - cssPx(isCompact ? 8 : 10);
      const artW = Math.min(cssPx(isCompact ? 56 : 62), artH * (art && art.naturalWidth && art.naturalHeight ? (art.naturalWidth / art.naturalHeight) : 0.9));
      const showArtX = innerX + cssPx(isCompact ? 10 : 12);
      if (art && art.naturalWidth) {
        ctx.drawImage(art, showArtX, showY + (showH - artH) / 2, artW, artH);
      } else {
        ctx.fillStyle = "rgba(20, 14, 12, .75)";
        ctx.beginPath(); ctx.roundRect(showArtX, showY + (showH - artH) / 2, artW, artH, 6); ctx.fill();
        ctx.strokeStyle = "rgba(230, 198, 141, .6)"; ctx.lineWidth = cssPx(1.2); ctx.stroke();
        ctx.fillStyle = "#e9c97e";
        ctx.font = readableFont(isCompact ? 15 : 17, '900');
        ctx.textAlign = 'center';
        ctx.fillText("新", showArtX + artW / 2, showY + showH / 2 + cssPx(isCompact ? 5 : 6));
      }

      const tx = showArtX + artW + cssPx(isCompact ? 10 : 12);
      const tw = innerW - (tx - innerX) - cssPx(isCompact ? 8 : 10);
      ctx.textAlign = 'left';

      // 行 1: 名稱（明確標註新守）
      const nameY = showY + cssPx(isCompact ? 18 : 22);
      ctx.fillStyle = "#fff1d9";
      ctx.font = readableFont(isCompact ? 14 : 16, '900');
      ctx.fillText(`${pMeta.ja}・新守`, tx, nameY);

      // 行 2: 核心效果（亮金高對比，避免壓框吃底）
      const effY = showY + cssPx(isCompact ? 35 : 44);
      ctx.fillStyle = "#ffd54f";
      ctx.font = readableFont(isCompact ? 11 : 12, '700');
      fitText(ctx, pMeta.s || pEffectStr, tx, effY, tw, { minSize: 8, minCss: 9 });

      // 行 3: 操作指引
      const noteY = showY + cssPx(isCompact ? 52 : 64);
      ctx.fillStyle = "rgba(235, 220, 195, .8)";
      ctx.font = readableFont(isCompact ? 10 : 11, '600');
      fitText(ctx, "拾獲新御守「" + pMeta.ja + "」・替換下方一守", tx, noteY, tw, { minSize: 7, minCss: 7 });
    }

    // 3) 既有三守槽位：擴大寬高、獨立卡片、高對比文字與自動換行
    const gap = cssPx(isCompact ? 8 : 12);
    const slotW = Math.floor((innerW - gap * 2) / 3);
    const slotH = cssPx(isCompact ? 108 : 132);
    const slotStartX = innerX;
    const slotY = showY + showH + cssPx(isCompact ? 8 : 10);

    for (let i = 0; i < 3; i++) {
      const charm = charms[i];
      const sx = slotStartX + i * (slotW + gap);
      const isSelected = i === selectedIndex;

      const cKey = charm ? (charm.id?.startsWith("charm_") ? charm.id : `charm_${charm.id}`) : null;
      const meta = charm ? (charmMeta[charm.id] || charmMeta[cKey] || { ja: charm.name || "御守", s: "" }) : null;
      const effectFn = charm ? (charmEffects[charm.id] || charmEffects[cKey]) : null;
      const effect = charm && effectFn ? effectFn(charm.level) : (charm ? meta.s : "");
      const label = charm ? `${meta.ja} Lv${charm.level}` : "空白槽";

      // 共通秘卷深墨卡框；點擊區仍保留原 swap_i 矩形。
      drawRitualCard(ctx, sx, slotY, slotW, slotH, { dark: true, selected: isSelected });

      // 上半：御守圖示
      const artZoneH = slotH * 0.44;
      const charmId = charm ? charm.id.replace("charm_", "") : null;
      const omamoriArt = charmId ? illustratedCharms[charmId] : null;
      if (omamoriArt && omamoriArt.naturalWidth) {
        const artH = (artZoneH - cssPx(6)) * 0.95;
        const artW = artH * (omamoriArt.naturalWidth / omamoriArt.naturalHeight);
        ctx.drawImage(omamoriArt, sx + (slotW - artW) / 2, slotY + cssPx(3) + (artZoneH - cssPx(6) - artH) / 2, artW, artH);
      } else {
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.beginPath(); ctx.roundRect(sx + cssPx(4), slotY + cssPx(4), slotW - cssPx(8), artZoneH - cssPx(6), 4); ctx.fill();
        if (!charm) {
          ctx.strokeStyle = "rgba(255,255,255,0.18)";
          ctx.strokeRect(sx + cssPx(8), slotY + cssPx(8), slotW - cssPx(16), artZoneH - cssPx(14));
        }
      }

      // 下半：名稱、等級、核心效果（深色底帶、高對比白字與金字）
      const bandY = slotY + artZoneH;
      const bandH = slotH - artZoneH;
      ctx.fillStyle = isSelected ? "rgba(56, 38, 26, .98)" : "rgba(24, 18, 15, .95)";
      ctx.beginPath(); ctx.roundRect(sx + cssPx(2), bandY, slotW - cssPx(4), bandH - cssPx(2), 4); ctx.fill();
      if (isSelected) {
        ctx.strokeStyle = "#e6bd6a"; ctx.lineWidth = cssPx(1.4);
        ctx.stroke();
      }

      ctx.textAlign = 'center';

      // 1) 名稱與等級（居中排版）
      const nameY = bandY + bandH * 0.44;
      ctx.font = readableFont(12, 'bold');
      ctx.fillStyle = isSelected ? "#ffe6a8" : "#fff1d9";
      fitText(ctx, label, sx + slotW / 2, nameY, slotW - cssPx(8), { minSize: 8, minCss: 8 });

      // 2) 核心效果（居下排版）
      const effY = bandY + bandH * 0.82;
      ctx.font = readableFont(10, '700');
      ctx.fillStyle = isSelected ? "#ffd54f" : "#e2cfa2";
      const effLimitW = Math.min(slotW - cssPx(10), cssPx(106));
      if (effect) {
        ctx.fillText(effect, sx + slotW / 2, effY, effLimitW);
      } else if (!charm) {
        ctx.fillText("尚無御守", sx + slotW / 2, effY, effLimitW);
      }

      // 3) 徽章：僅在選中態繪製於名稱上方
      if (isSelected) {
        const nameSize = fontPx(readableFont(12, 'bold'));
        const nameTop = nameY - nameSize * 0.8;
        const badgeSize = fontPx(readableFont(10, '900'));
        const badgeY = Math.min(bandY + badgeSize * 0.8, nameTop - 1) - badgeSize * 0.2;
        ctx.fillStyle = "#a84537";
        ctx.font = readableFont(10, '900');
        ctx.fillText("替換此守", sx + slotW / 2, badgeY, Math.max(8, slotW - cssPx(8)));
      }

      // 按鈕交互與熱區登記
      drawButton(ctx, { id: `swap_${i}`, x: sx, y: slotY, w: slotW, h: slotH }, "", {
        tone: isSelected ? 'primary' : 'normal',
        focus: isSelected,
        transparent: true,
        fillAlpha: 0.08
      });

      hitRects.push({ id: `swap_${i}`, x: sx, y: slotY, w: slotW, h: slotH });
    }

    // 4) 放棄鈕：明確字級與對齊，保證熱區高寬 >= 44 px 且留在世界與面板內
    const discW = cssPx(isCompact ? 150 : 170);
    const discH = Math.max(44, cssPx(46));
    const discX = midX - discW / 2;
    const discY = Math.min(
      slotY + slotH + cssPx(isCompact ? 6 : 10),
      Math.max(slotY + slotH + cssPx(6), b.bottom - discH - cssPx(4))
    );
    drawButton(ctx, { id: 'swap_discard', x: discX, y: discY, w: discW, h: discH }, "放棄", { tone: 'danger' });
    hitRects.push({ id: 'swap_discard', x: discX, y: discY, w: discW, h: discH });

    ctx.restore();
    return hitRects;
  }

  function drawDiegeticRadarClock(ctx, cx, cy, size, progress, secondsLeft, time) {
    const p = clamp(progress, 0, 1);
    const start = Math.PI * 5 / 6;
    const span = Math.PI * 5 / 3;
    const end = start + span;
    const angle = start + span * p;
    // 時間標記掛在羅盤外緣，不進入雷達資料區；玩家看到它會理解為時序，而非目標點。
    // 軌道再外移，讓月亮/太陽完全脫離雷達資料區與黃銅內框；
    // 標記可以略微超出圖片邊界，但仍緊貼整顆羅盤的視覺輪廓。
    const ringR = size * 0.56;
    const danger = clamp((p - 0.78) / 0.22, 0, 1);
    const dangerPulse = 0.5 + Math.sin(time * 5.4) * 0.5;
    const trackColor = danger > 0.7 ? "#ff5d45" : danger > 0.18 ? "#ff9b52" : "#ffd36f";

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineWidth = Math.max(1.05, size * 0.006);
    ctx.strokeStyle = "rgba(255,237,194,.13)";
    ctx.beginPath(); ctx.arc(cx, cy, ringR, start, end); ctx.stroke();
    ctx.globalAlpha = 0.6 + danger * dangerPulse * 0.35;
    ctx.strokeStyle = trackColor;
    ctx.beginPath(); ctx.arc(cx, cy, ringR, start, angle); ctx.stroke();
    ctx.globalAlpha = 1;

    const mx = cx + Math.cos(angle) * ringR;
    const my = cy + Math.sin(angle) * ringR;
    const eased = p * p * (3 - 2 * p);
    const markerR = size * (0.034 + eased * 0.006);
    const markerColor = danger > 0.55 ? "#ff714e" : eased > 0.5 ? "#ffb347" : "#d9e5ff";
    // 標記本體放大、光暈收斂，讓弦月輪廓比 bloom 更容易辨認。
    glow(ctx, mx, my, size * (0.095 + eased * 0.05 + danger * dangerPulse * 0.04), markerColor, 0.44);

    const moonAlpha = clamp(1 - eased * 1.15, 0, 1);
    if (moonAlpha > 0.01) {
      ctx.globalAlpha = moonAlpha;
      ctx.fillStyle = "#e9efff";
      ctx.strokeStyle = "rgba(255,248,220,.92)";
      ctx.lineWidth = Math.max(1.1, size * 0.007);
      // 不再用雙圓挖空：直接畫單側弦月輪廓，避免視覺上像兩個月亮照鏡子。
      const wax = clamp(eased / 0.46, 0, 1);
      const crescentTipX = mx + markerR * 0.38;
      const crescentOuterX = mx - markerR * (0.90 - wax * 0.05);
      const crescentInnerX = mx - markerR * (0.24 - wax * 0.12);
      const innerBow = markerR * (0.52 + wax * 0.08);
      ctx.beginPath();
      ctx.moveTo(crescentTipX, my - markerR * 0.90);
      ctx.bezierCurveTo(crescentOuterX, my - markerR * 0.72, crescentOuterX, my + markerR * 0.72, crescentTipX, my + markerR * 0.90);
      ctx.bezierCurveTo(crescentInnerX, my + innerBow, crescentInnerX, my - innerBow, crescentTipX, my - markerR * 0.90);
      ctx.closePath();
      ctx.fill();
    }

    const sunAlpha = clamp((eased - 0.22) / 0.78, 0, 1);
    if (sunAlpha > 0.01) {
      ctx.globalAlpha = sunAlpha;
      ctx.strokeStyle = "#ffd36f";
      ctx.fillStyle = "#ffc44f";
      ctx.lineWidth = Math.max(1, size * 0.006);
      if (eased > 0.58) {
        const ray = markerR * (1.55 + eased * 0.2);
        for (let i = 0; i < 8; i++) {
          const a = time * 0.08 + i * Math.PI / 4;
          ctx.beginPath();
          ctx.moveTo(mx + Math.cos(a) * markerR * 1.05, my + Math.sin(a) * markerR * 1.05);
          ctx.lineTo(mx + Math.cos(a) * ray, my + Math.sin(a) * ray);
          ctx.stroke();
        }
      }
      ctx.beginPath(); ctx.arc(mx, my, markerR * (0.72 + eased * 0.18), 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (danger > 0.02) {
      ctx.strokeStyle = `rgba(255,83,62,${0.22 + dangerPulse * danger * 0.55})`;
      ctx.lineWidth = Math.max(1, size * 0.007);
      ctx.beginPath(); ctx.arc(mx, my, markerR * (1.5 + dangerPulse * 0.45), 0, 6.283); ctx.stroke();
    }

    const sec = Math.max(0, Math.ceil(secondsLeft));
    const secPart = sec % 60;
    ctx.textAlign = "center";
    ctx.font = readableFont(10, "900");
    ctx.fillStyle = "rgba(255,239,205,.9)";
    inkText(ctx, `${Math.floor(sec / 60)}:${secPart < 10 ? "0" : ""}${secPart}`, cx, cy + size * 0.23);
    ctx.restore();
  }

  function drawDiegeticRadarStatus(ctx, x, y, w, delivered, goalDeliveries, score) {
    const h = 22;
    const center = x + w / 2;
    ctx.save();
    ctx.fillStyle = ctx.strokeStyle = "#ffe0a4";
    drawActionIcon(ctx, "pickup", center - 24, y + h / 2, 7);
    ctx.textAlign = "left";
    ctx.font = readableFont(12, "900");
    ctx.fillStyle = "#fff1cc";
    inkText(ctx, `${delivered}件`, center - 12, y + 16);
    ctx.restore();
    return h;
  }

  function drawDiegeticMinimap(ctx, x, y, size, P, orders, job, boss, dawnProgress = 0, dawnSecLeft = 0, time = 0) {
    const art = window.ART?.hud_radar_frame;
    if (!art?.complete || !art.naturalWidth || !art.naturalHeight) {
      drawDiegeticMinimapFallback(ctx, x, y, size, P, orders, job, boss);
      drawDiegeticRadarClock(ctx, x + size / 2, y + size / 2, size, dawnProgress, dawnSecLeft, time);
      return;
    }

    // 素材透明洞實測中心約在 (49.9%, 48.1%)，不是圖片幾何正中央。
    // 依實際洞口對位，讓雷達內容向上約 2%，並稍微放大填滿內圈。
    const cx = x + size * 0.499, cy = y + size * 0.481;
    // 放大雷達底盤，讓它吃滿素材的中央透明洞；超出的部分仍會被外框自然遮住。
    const mapR = size * 0.365;
    const k = (mapR - 7) / 1300;
    ctx.save();
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, mapR, 0, 6.283);
    ctx.clip();

    const glass = ctx.createRadialGradient(cx - mapR * 0.22, cy - mapR * 0.28, 0, cx, cy, mapR);
    glass.addColorStop(0, "rgba(22,34,56,.98)");
    glass.addColorStop(0.62, "rgba(9,19,36,.98)");
    glass.addColorStop(1, "rgba(3,9,22,.99)");
    ctx.fillStyle = glass;
    ctx.fillRect(cx - mapR, cy - mapR, mapR * 2, mapR * 2);

    ctx.strokeStyle = "rgba(127,227,240,.13)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - mapR, cy); ctx.lineTo(cx + mapR, cy);
    ctx.moveTo(cx, cy - mapR); ctx.lineTo(cx, cy + mapR);
    ctx.stroke();
    for (const rr of [mapR * 0.36, mapR * 0.7]) {
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, 6.283); ctx.stroke();
    }

    // Phase 2：雷達掃描線。平時偏青，接近破曉時逐漸轉成警戒橘紅。
    const danger = clamp((dawnProgress - 0.78) / 0.22, 0, 1);
    const sweepA = (time * 0.72) % (Math.PI * 2);
    const sx = cx + Math.cos(sweepA) * (mapR - 4);
    const sy = cy + Math.sin(sweepA) * (mapR - 4);
    const sweepColor = danger > 0.4 ? "#ff7558" : "#79dfe9";
    ctx.strokeStyle = danger > 0.4
      ? `rgba(255,117,88,${0.18 + danger * 0.22})`
      : "rgba(121,223,233,.18)";
    ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(sx, sy); ctx.stroke();
    glow(ctx, sx, sy, 15 + danger * 8, sweepColor, 0.22 + danger * 0.22);

    // 危急時用由內向外的 pulse 表達剩餘時間壓力，不另外增加文字或圖示。
    if (danger > 0.01) {
      const pulsePhase = (time * 1.65) % 1;
      ctx.strokeStyle = `rgba(255,83,62,${danger * (1 - pulsePhase) * 0.42})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(cx, cy, mapR * (0.22 + pulsePhase * 0.7), 0, 6.283);
      ctx.stroke();
    }

    // 接近清晨時，雷達南側逐漸出現暖色晨光；保持克制，避免蓋住導航資料。
    const dawnGlow = clamp((dawnProgress - 0.62) / 0.38, 0, 1);
    if (dawnGlow > 0.01) {
      const morning = ctx.createRadialGradient(cx, cy + mapR * 0.72, 0, cx, cy + mapR * 0.72, mapR * 1.15);
      morning.addColorStop(0, `rgba(255,195,112,${0.12 * dawnGlow})`);
      morning.addColorStop(0.55, `rgba(255,125,82,${0.055 * dawnGlow})`);
      morning.addColorStop(1, "rgba(255,110,70,0)");
      ctx.fillStyle = morning;
      ctx.fillRect(cx - mapR, cy - mapR, mapR * 2, mapR * 2);
    }

    const place = (wx, wy) => {
      let dx = (wx - P.x) * k, dy = (wy - P.y) * k;
      const len = Math.hypot(dx, dy), max = mapR - 7, edge = len > max;
      if (edge && len > 0) { dx *= max / len; dy *= max / len; }
      return { x: cx + dx, y: cy + dy, edge };
    };

    for (const o of orders) {
      const m = place(o.from.x, o.from.y), urgent = o.life < 25;
      drawRadarPickupIcon(ctx, m.x, m.y, m.edge ? 0.72 : 1, urgent);
    }
    if (job) {
      const m = place(job.to.x, job.to.y);
      drawRadarDeliverySeal(ctx, m.x, m.y, m.edge ? 0.76 : 1);
    }
    if (boss) {
      const m = place(boss.x, boss.y);
      glow(ctx, m.x, m.y, 28, "#ff3b4f", 0.62);
      ctx.fillStyle = "#ff3b4f";
      ctx.beginPath(); ctx.arc(m.x, m.y, 5, 0, 6.283); ctx.fill();
    }

    glow(ctx, cx, cy, 20, "#ffffff", 0.62);
    ctx.fillStyle = "#fff8df";
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(P.faceAng || 0);
    ctx.beginPath();
    ctx.moveTo(7, 0); ctx.lineTo(-4, -4); ctx.lineTo(-1, 0); ctx.lineTo(-4, 4);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.restore();

    ctx.drawImage(art, x, y, size, size);
    drawDiegeticRadarClock(ctx, cx, cy, size, dawnProgress, dawnSecLeft, time);
    ctx.restore();
  }

  function drawDiegeticQuestBoard(ctx, x, y, w, h) {
    ctx.save();
    ctx.strokeStyle='#7b3b28';ctx.lineWidth=4;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x+w*.26,y+6);ctx.quadraticCurveTo(x+w*.5,y-19,x+w*.74,y+6);ctx.stroke();
    ctx.fillStyle='#9e3428';ctx.beginPath();ctx.arc(x+w*.5,y-6,7,0,6.283);ctx.fill();
    ctx.fillStyle='#3a241b';ctx.strokeStyle='#17110e';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x-9,y+9);ctx.lineTo(x+w*.5,y-2);ctx.lineTo(x+w+9,y+9);ctx.lineTo(x+w-2,y+17);ctx.lineTo(x+2,y+17);ctx.closePath();ctx.fill();ctx.stroke();
    const wood=ctx.createLinearGradient(x,y,x,y+h);wood.addColorStop(0,'#c18b52');wood.addColorStop(.5,'#9f6439');wood.addColorStop(1,'#77472f');
    ctx.fillStyle=wood;ctx.strokeStyle='#4b2d20';ctx.lineWidth=2.4;ctx.beginPath();ctx.roundRect(x,y+12,w,h-12,5);ctx.fill();ctx.stroke();
    ctx.strokeStyle='rgba(72,39,25,.28)';ctx.lineWidth=1.2;for(let i=0;i<4;i++){const yy=y+25+i*11;ctx.beginPath();ctx.moveTo(x+10,yy);ctx.bezierCurveTo(x+w*.28,yy-4,x+w*.67,yy+5,x+w-9,yy);ctx.stroke();}
    ctx.fillStyle='#eee0bb';ctx.strokeStyle='#7e6040';ctx.lineWidth=1.2;ctx.save();ctx.translate(x+15,y+22);ctx.rotate(-.018);ctx.beginPath();ctx.roundRect(0,0,w-30,h-31,2);ctx.fill();ctx.stroke();ctx.restore();
    ctx.fillStyle='#4c3325';for(const px of [x+27,x+w-27]){ctx.beginPath();ctx.arc(px,y+27,2.3,0,6.283);ctx.fill();}ctx.restore();
  }

  function drawDiegeticHintTag(ctx, b, label, disabled) {
    ctx.save();ctx.fillStyle=disabled?'#c8bea7':'#e6d7ac';ctx.strokeStyle=disabled?'#7e786a':'#75512f';ctx.lineWidth=1.6;
    ctx.beginPath();ctx.roundRect(b.x,b.y,b.w,b.h,3);ctx.fill();ctx.stroke();ctx.fillStyle=disabled?'#6b665d':'#39261d';ctx.textAlign='center';ctx.font=readableFont(13,'900');ctx.fillText(label,b.x+b.w/2,b.y+b.h/2+5,b.w-8);ctx.restore();
  }

  function drawDiegeticOmamoriHintFallback(ctx, b, stage, time) {
    const disabled = stage >= 2;
    const label = stage === 0 ? "聴" : stage === 1 ? "詞" : "済";
    const sway = calm() ? 0 : Math.sin(time * 1.9 + 0.5) * 0.028;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(sway);
    ctx.translate(-cx, -cy);

    ctx.strokeStyle = disabled ? "rgba(150,132,112,.65)" : "#d6a54a";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx, b.y - 8);
    ctx.quadraticCurveTo(cx + 6, b.y - 2, cx + 2, b.y + 5);
    ctx.stroke();

    const grad = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
    grad.addColorStop(0, disabled ? "#8a7369" : "#9d2f2a");
    grad.addColorStop(1, disabled ? "#665650" : "#651c20");
    ctx.fillStyle = grad;
    ctx.strokeStyle = disabled ? "#9f8d7e" : "#e1b75f";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(b.x + 4, b.y + 3);
    ctx.quadraticCurveTo(cx, b.y - 1, b.x + b.w - 4, b.y + 3);
    ctx.lineTo(b.x + b.w - 2, b.y + b.h - 8);
    ctx.quadraticCurveTo(cx, b.y + b.h + 1, b.x + 2, b.y + b.h - 8);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = disabled ? "rgba(226,216,194,.72)" : "#f3e3bb";
    ctx.beginPath(); ctx.roundRect(b.x + 7, b.y + 12, b.w - 14, b.h - 24, 3); ctx.fill();
    ctx.fillStyle = disabled ? "#625a54" : "#4c2a24";
    ctx.textAlign = "center";
    ctx.font = readableFont(14, "900");
    ctx.fillText(label, cx, b.y + 31);
    ctx.restore();
  }

  function drawDiegeticOmamoriHint(ctx, b, stage, time, entryProgress = 1, lanternHit = 0) {
    const art = window.ART?.hud_omamori_hint_listen;
    if (!art?.complete || !art.naturalWidth || !art.naturalHeight) {
      drawDiegeticOmamoriHintFallback(ctx, b, stage, time);
      return;
    }

    const disabled = stage >= 2;
    const p = calm() ? 1 : clamp(entryProgress, 0, 1);
    const easeOut = 1 - Math.pow(1 - p, 3);
    const dropY = -14 * (1 - easeOut);
    const entrySwing = calm() ? 0 : Math.sin(p * Math.PI * 5) * (Math.PI / 180 * 18) * Math.pow(1 - p, 1.15);
    const idleSwing = calm() ? 0 : (
      Math.sin((time - 0.11) * 1.35 + 0.35) * 0.018 +
      Math.sin((time - 0.11) * 0.72 + 1.1) * 0.007
    ) * p;
    const impactSwing = calm() ? 0 : Math.sin((time - 0.09) * 18) * 0.045 * clamp(lanternHit, 0, 1) * p;
    const sway = entrySwing + idleSwing + impactSwing;
    const aspect = art.naturalWidth / art.naturalHeight;
    const drawH = b.h;
    const drawW = drawH * aspect;
    const dx = b.x + (b.w - drawW) / 2;
    const dy = b.y;
    const pivotX = b.x + b.w / 2;
    const pivotY = b.y + 3;

    ctx.save();
    ctx.translate(pivotX, pivotY + dropY);
    ctx.rotate(sway);
    ctx.translate(-pivotX, -pivotY);
    ctx.globalAlpha = (disabled ? 0.58 : 1) * clamp(p * 1.8, 0, 1);
    ctx.drawImage(art, dx, dy, drawW, drawH);

    if (stage >= 1) {
      const tag = stage === 1 ? "詞" : "済";
      const r = Math.max(8, b.w * 0.17);
      const tx = b.x + b.w - r * 0.6, ty = b.y + b.h - r * 0.8;
      ctx.globalAlpha = disabled ? 0.72 : 0.92;
      ctx.fillStyle = disabled ? "#6f625c" : "#274f68";
      ctx.strokeStyle = disabled ? "#b9aaa1" : "#bfeef2";
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(tx, ty, r, 0, 6.283); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#f6f0df";
      ctx.textAlign = "center";
      ctx.font = readableFont(Math.max(9, r * 0.9), "900");
      ctx.fillText(tag, tx, ty + r * 0.34);
    }
    ctx.restore();
  }

  // ---- HoloCure 摺扇技能格 (4 主動武器格 + 1 未解鎖鎖頭槽) ----
  let __activeFanSlots = [null, null, null, null];

  function resetFanSlots() {
    __activeFanSlots = [null, null, null, null];
    return __activeFanSlots;
  }

  function isFusionSkill(id) {
    if (!id || typeof id !== "string") return false;
    return id.indexOf("fusion_") === 0 || !!FUSION_UI_META[id];
  }

  function getFusionSkillParents(id) {
    if (!id) return [];
    if (FUSION_UI_META[id]?.parents) return FUSION_UI_META[id].parents;
    if (typeof window !== "undefined" && window.FUSION?.RECIPES?.[id]?.parents) {
      return window.FUSION.RECIPES[id].parents;
    }
    return [];
  }

  function drawFusionParentBadges(ctx, id, cx, cy, r) {
    const parents = getFusionSkillParents(id);
    if (!parents || parents.length < 2) return;

    const badgeR = Math.max(3.2, r * 0.28);
    const offsetDist = r * 0.72;
    // 兩枚母技小符號置於融合球下方兩側（細節裝飾，不額外占球）
    const angles = [Math.PI * 0.65, Math.PI * 0.35];

    ctx.save();
    for (let i = 0; i < 2; i++) {
      const p = parents[i];
      if (!p) continue;
      const bx = cx + Math.cos(angles[i]) * offsetDist;
      const by = cy + Math.sin(angles[i]) * offsetDist;

      ctx.beginPath();
      ctx.arc(bx, by, badgeR + 0.8, 0, 6.283);
      ctx.fillStyle = "rgba(10, 8, 18, 0.92)";
      ctx.fill();
      ctx.strokeStyle = WEAPON_TONE[p] || "#e8c36a";
      ctx.lineWidth = 1;
      ctx.stroke();

      drawEmblem(ctx, p, bx, by, badgeR * 0.75);
    }
    ctx.restore();
  }

  function resolveFanSlots(WL, WI, previousSlots) {
    if (!WL || typeof WL !== "object") return [null, null, null, null];

    const activeKeys = Object.keys(WL).filter(k => (WL[k] || 0) > 0 && (!WI || !WI[k] || WI[k].type === "active" || isFusionSkill(k)));
    const activeSet = new Set(activeKeys);
    const activeFusions = activeKeys.filter(isFusionSkill);

    let slots;
    if (Array.isArray(previousSlots) && previousSlots.length === 4) {
      slots = [...previousSlots];
    } else {
      slots = [...__activeFanSlots];
    }

    // 1. 若有剛融合的武器，在上一輪槽位中尋找母技：融合球占其中一格，另一格清空釋出
    for (const f of activeFusions) {
      if (slots.includes(f)) continue; // 已排入
      const parents = getFusionSkillParents(f);
      if (parents.length >= 2) {
        const idx0 = slots.indexOf(parents[0]);
        const idx1 = slots.indexOf(parents[1]);
        if (idx0 !== -1 && idx1 !== -1) {
          const keepIdx = Math.min(idx0, idx1);
          const freeIdx = Math.max(idx0, idx1);
          slots[keepIdx] = f;
          slots[freeIdx] = null; // 釋出另一母技格
        } else if (idx0 !== -1) {
          slots[idx0] = f;
        } else if (idx1 !== -1) {
          slots[idx1] = f;
        }
      }
    }

    // 2. 清除已不在 activeSet 中的失效技能（例如被融合退場之母技）
    for (let i = 0; i < 4; i++) {
      const k = slots[i];
      if (k && !activeSet.has(k)) {
        slots[i] = null;
      }
    }

    // 3. 處理尚未入槽的融合技能（如冷啟動、母技先前不在 slots 內）
    for (const f of activeFusions) {
      if (!slots.includes(f)) {
        const emptyIdx = slots.indexOf(null);
        if (emptyIdx !== -1) {
          slots[emptyIdx] = f;
        }
      }
    }

    // 4. 依序填入新升級獲得的未入槽武器至空檔
    for (const w of activeKeys) {
      if (!slots.includes(w)) {
        const emptyIdx = slots.indexOf(null);
        if (emptyIdx !== -1) {
          slots[emptyIdx] = w;
        }
      }
    }

    while (slots.length < 4) slots.push(null);
    slots = slots.slice(0, 4);

    __activeFanSlots = [...slots];
    return slots;
  }

  function drawDiegeticSkillFanFallback(ctx, ownedKeys, WL, extra, badgeTextSize, badgeH, motion) {
    const cx=2, cy=78, fanR=132, a0=-1.48, a1=-0.12;
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,.36)';ctx.beginPath();ctx.moveTo(cx+4,cy+5);ctx.arc(cx+4,cy+5,fanR+6,a0,a1);ctx.closePath();ctx.fill();
    const fan=ctx.createRadialGradient(cx,cy,8,cx,cy,fanR);fan.addColorStop(0,'#5a321f');fan.addColorStop(.14,'#34243a');fan.addColorStop(.48,'#182046');fan.addColorStop(1,'#0b1232');
    ctx.fillStyle=fan;ctx.strokeStyle='#d9b65b';ctx.lineWidth=2.2;ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,fanR,a0,a1);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.fillStyle='rgba(224,185,93,.30)';ctx.beginPath();ctx.moveTo(cx+28,cy-32);ctx.lineTo(cx+58,cy-75);ctx.lineTo(cx+79,cy-54);ctx.lineTo(cx+103,cy-83);ctx.lineTo(cx+126,cy-35);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(232,195,106,.75)';ctx.lineWidth=1.3;for(let i=0;i<=8;i++){const a=a0+(a1-a0)*i/8;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(a)*fanR,cy+Math.sin(a)*fanR);ctx.stroke();}
    ctx.fillStyle='#dcb553';ctx.beginPath();ctx.arc(cx,cy,8,0,6.283);ctx.fill();ctx.fillStyle='#5a261d';ctx.beginPath();ctx.arc(cx,cy,3.8,0,6.283);ctx.fill();
    const angles=[-1.34,-1.02,-.70,-.38], iconR=91;
    const slotItems = (Array.isArray(ownedKeys) && ownedKeys.length === 4) ? ownedKeys : resolveFanSlots(WL, null, ownedKeys);
    for(let i=0;i<4;i++){const a=angles[i],sx=cx+Math.cos(a)*iconR,sy=cy+Math.sin(a)*iconR,k=slotItems[i];
      if(k){const tone=WEAPON_TONE[k]||C.gold;glow(ctx,sx,sy,56,tone,motion ? .18*pulse(3,.4) : .1);
        if(isFusionSkill(k)){
          drawFusionIcon(ctx,k,sx,sy,18);
          drawFusionParentBadges(ctx,k,sx,sy,18);
        }else{
          drawEmblem(ctx,k,sx,sy,18);
        }
        const cd=extra?.cd?.[k]||0;
        if(cd>.02){ctx.fillStyle='rgba(4,6,14,.67)';ctx.beginPath();ctx.moveTo(sx,sy);ctx.arc(sx,sy,18,-Math.PI/2,-Math.PI/2+Math.PI*2*cd);ctx.closePath();ctx.fill();}
        const lvl=WL[k]||1;const isFusion=isFusionSkill(k);const badgeLabel=isFusion||lvl>=5?'MAX':'L'+lvl;
        ctx.fillStyle='#e8c36a';ctx.strokeStyle='#6d471d';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(sx-22,sy+20,44,badgeH,4);ctx.fill();ctx.stroke();ctx.fillStyle='#201516';ctx.textAlign='center';ctx.font='900 '+badgeTextSize+'px Noto Sans JP, sans-serif';ctx.fillText(badgeLabel,sx,sy+20+badgeTextSize+3);
      }else{ctx.strokeStyle='rgba(232,195,106,.42)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(sx,sy,19,0,6.283);ctx.stroke();ctx.fillStyle='rgba(232,195,106,.5)';ctx.textAlign='center';ctx.font=readableFont(13,'900');ctx.fillText('＋',sx,sy+5);}
    }
    ctx.restore();
    return 140;
  }

  function drawDiegeticSkillFan(ctx, ownedKeys, WL, extra, badgeTextSize, badgeH, motion) {
    const art = window.ART?.hud_skill_fan;
    if (!art?.complete || !art.naturalWidth || !art.naturalHeight) {
      drawDiegeticSkillFanFallback(ctx, ownedKeys, WL, extra, badgeTextSize, badgeH, motion);
      return 140;
    }

    const drawW = 220;
    const drawH = drawW * (art.naturalHeight / art.naturalWidth);
    const dx = -6;
    // 底部留白給 EXP bar：比上一版上移 16 logical px（實際約 19px）。
    const fanBottomY = 66;
    const dy = fanBottomY - drawH;
    const slots = [
      [0.178, 0.225],
      [0.374, 0.310],
      [0.541, 0.437],
      [0.660, 0.626],
      [0.783, 0.803]
    ];
    const slotR = 15.8;

    ctx.save();
    ctx.drawImage(art, dx, dy, drawW, drawH);

    const slotItems = (Array.isArray(ownedKeys) && ownedKeys.length === 4) ? ownedKeys : resolveFanSlots(WL, null, ownedKeys);
    for (let i = 0; i < 4; i++) {
      const [nx, ny] = slots[i];
      const sx = dx + drawW * nx, sy = dy + drawH * ny;
      const k = slotItems[i];
      if (k) {
        const tone = WEAPON_TONE[k] || C.gold;
        glow(ctx, sx, sy, 46, tone, motion ? 0.17 * pulse(3, 0.4) : 0.09);
        if (isFusionSkill(k)) {
          drawFusionIcon(ctx, k, sx, sy, 13.5);
          drawFusionParentBadges(ctx, k, sx, sy, 13.5);
        } else {
          drawEmblem(ctx, k, sx, sy, 13.5);
        }
        const cd = extra?.cd?.[k] || 0;
        if (cd > 0.02) {
          ctx.fillStyle = "rgba(4,6,14,.68)";
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.arc(sx, sy, slotR - 1, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * cd);
          ctx.closePath();
          ctx.fill();
        }
        // 等級融入技能球外圈：弧長＋和風色階同時區分 Lv1~5，並以克制呼吸光提示成長。
        const isFusion = isFusionSkill(k);
        const lvl = isFusion ? 5 : Math.max(1, Math.min(5, WL[k] || 1));
        const levelProgress = clamp(lvl / 5, 0, 1);
        if (levelProgress > 0) {
          const levelArcStart = -Math.PI / 2;
          const levelArcSweep = Math.PI * 2 * levelProgress;
          const levelR = slotR + 5.2;
          const levelColors = ["#9eb7c2", "#d96c55", "#6dbb91", "#6cb9d2", "#c9a7e6"];
          const levelColor = isFusion ? (WEAPON_TONE[k] || "#e8c36a") : levelColors[lvl - 1];
          const breathe = motion ? (0.5 + 0.5 * pulse(1.7 + lvl * 0.18, i * 0.7)) : 0.55;
          const levelGlowAlpha = 0.28 + breathe * (lvl >= 5 ? 0.32 : 0.18);
          ctx.save();
          ctx.lineCap = "round";
          ctx.lineWidth = lvl >= 5 ? 3.1 : 2.5;
          ctx.strokeStyle = levelColor;
          ctx.shadowColor = levelColor;
          ctx.shadowBlur = (lvl >= 5 ? 9 : 4) + breathe * 3;
          ctx.globalAlpha = 0.68 + levelGlowAlpha * 0.32;
          ctx.beginPath();
          ctx.arc(sx, sy, levelR, levelArcStart, levelArcStart + levelArcSweep);
          ctx.stroke();
          const beadA = levelArcStart + levelArcSweep;
          const beadX = sx + Math.cos(beadA) * levelR;
          const beadY = sy + Math.sin(beadA) * levelR;
          ctx.fillStyle = levelColor;
          ctx.beginPath();
          ctx.arc(beadX, beadY, lvl >= 5 ? 2.7 : 2.2, 0, 6.283);
          ctx.fill();
          ctx.restore();
        }
      } else {
        ctx.fillStyle = "rgba(232,195,106,.52)";
        ctx.textAlign = "center";
        ctx.font = readableFont(13, "900");
        ctx.fillText("＋", sx, sy + 5);
      }
    }

    // 第五洞保留為未解鎖槽：只顯示鎖頭，不綁任何技能資料。
    {
      const [nx, ny] = slots[4];
      const sx = dx + drawW * nx, sy = dy + drawH * ny;
      ctx.fillStyle = "rgba(7,10,24,.62)";
      ctx.beginPath(); ctx.arc(sx, sy, slotR - 1, 0, 6.283); ctx.fill();
      ctx.strokeStyle = "rgba(226,190,98,.72)";
      ctx.lineWidth = 1.7;
      ctx.beginPath(); ctx.arc(sx, sy - 2, 5.6, Math.PI, 0); ctx.stroke();
      ctx.fillStyle = "rgba(226,190,98,.78)";
      ctx.beginPath(); ctx.roundRect(sx - 7, sy - 2, 14, 11, 2.5); ctx.fill();
      ctx.fillStyle = "rgba(32,24,26,.82)";
      ctx.beginPath(); ctx.arc(sx, sy + 3, 1.5, 0, 6.283); ctx.fill();
      ctx.fillRect(sx - 0.7, sy + 3, 1.4, 3.2);
    }

    ctx.restore();
    return drawW;
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

  // 王戰血條：獨立置中、低矮橫向長條；避免大片木框擋住戰場。
  function drawBossBar(ctx, x, y, w, boss, scale, time) {
    const hp = clamp(boss.hp / Math.max(1, boss.max), 0, 1), shield = !!boss.shield;
    const barH = Math.max(11, Math.ceil(10 / scale)), labelPx = fontPx(readableFont(13));
    const h = labelPx + barH + 16;
    ctx.save();
    ctx.fillStyle = "rgba(25,17,20,.82)";
    ctx.beginPath();ctx.roundRect(x,y,w,h,3);ctx.fill();
    ctx.strokeStyle = "rgba(181,136,92,.7)";ctx.lineWidth = 1.2;
    ctx.beginPath();ctx.roundRect(x+.6,y+.6,w-1.2,h-1.2,3);ctx.stroke();
    ctx.textAlign = "left";
    ctx.font = readableFont(13, "900");
    const stageTitle = boss && boss.stageId && window.STORY && typeof window.STORY.get === "function"
      ? (() => { try { const st = window.STORY.get(boss.stageId); return st && st.bossTitle || null; } catch { return null; } })()
      : null;
    // 稱號來源：當前實例所屬關卡 metadata 優先（防跨關錯帶舊稱號），再用實例 title，最後通用 fallback；
    // 三者皆無才用 大妖王/妖將，絕不以共用圖推定關卡。
    const bossLabel = stageTitle || boss.title || (boss.final ? "大妖王" : "妖將");
    const nameW = ctx.measureText(bossLabel).width;
    ctx.fillStyle = "#f4deb1";
    ctx.fillText(bossLabel, x + 10, y + labelPx + 1);
    ctx.textAlign = "right";
    ctx.fillStyle = shield ? "#d7d5aa" : "#efb6a0";
    ctx.fillText(shield ? "結界展開・答對破除" : "結界已破・全力進攻", x + w - 10, y + labelPx + 1, Math.max(1,w-nameW-32));
    const bx = x + 9, by = y + labelPx + 5, bw = w - 18;
    ctx.fillStyle = "#251916";
    ctx.beginPath();ctx.roundRect(bx,by,bw,barH,2);ctx.fill();
    if (hp > 0) {
      ctx.fillStyle = barGradient(ctx,"boss",bx,bx+bw);
      ctx.beginPath();ctx.roundRect(bx,by,Math.min(bw,Math.max(2,bw*hp)),barH,2);ctx.fill();
      ctx.fillStyle = "rgba(251,225,170,.14)";
      ctx.fillRect(bx+2,by+2,Math.max(0,bw*hp-4),1.5);
    }
    ctx.strokeStyle = shield ? "#baad79" : "#a57b5d";ctx.lineWidth = 1.2;
    ctx.beginPath();ctx.roundRect(bx,by,bw,barH,2);ctx.stroke();
    ctx.restore();
    return h;
  }

  // 小繪馬覺醒印：固定靠右，呈現持有印記×N與每3單配送進度3燈循環。
  function drawAwakeningTag(ctx, x, y, availableWidth, a) {
    if (!a) return 0;
    const w = Math.min(150, Math.max(104, availableWidth));
    const px = x + Math.max(0, availableWidth - w), h = 30;
    ctx.save();
    if (illustratedArt.title?.naturalWidth) drawRibbonSlices(ctx, illustratedArt.title, px, y, w, h);
    else glassBox(ctx, px, y, w, h, 5, "rgba(55,36,29,.96)", "#b18a5a", 1.8);
    ctx.fillStyle = "rgba(44,29,26,.86)";
    ctx.beginPath(); ctx.roundRect(px + 30, y + 4, w - 35, h - 8, 4); ctx.fill();
    const seal = illustratedArt.awakeningSeal;
    if (seal?.naturalWidth) ctx.drawImage(seal, px + 3, y + 2, 26, 26);
    else {
      ctx.fillStyle = "#a84537"; ctx.beginPath(); ctx.arc(px + 16, y + 15, 11, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#e6be7c"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(px + 16, y + 15, 8, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = "#f3ddb1"; ctx.textAlign = "left"; ctx.font = readableFont(13, "900");
    const sealCount = a.seals ?? 0;
    ctx.fillText(`×${sealCount}`, px + 32, y + 20);

    // 每 3 單配送進度 3 燈循環（由 a.nextIn 1..3 精準對映，不因 Lv5/earned>=4 停住，不超出木牌）
    const nextIn = a.nextIn ?? 3;
    const isLegacyV3Cap = a.nextIn === 0 && a.awakened !== undefined && a.maxEarned === undefined;
    const total = isLegacyV3Cap ? 4 : 3;
    const progress = isLegacyV3Cap
      ? Math.min(4, Math.max(0, a.awakened))
      : (nextIn === 3 ? 0 : Math.min(3, Math.max(0, 3 - nextIn)));

    for (let i = 0; i < total; i++) {
      const dx = px + w - 12 - (total - 1 - i) * 11;
      const lit = i < progress;
      ctx.fillStyle = lit ? "#f5d483" : "#36251e";
      ctx.strokeStyle = lit ? "#ffeeb5" : "#684c3c";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(dx, y + 15, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
    return h;
  }


  // 2. 全螢幕 HUD：左上生命（燈油）與經驗、中上任務／Boss、右上黎明與小地圖、左下武器格。
  function drawHudBase(theme, ctx, P, oil, maxOil, elapsed, dawnTime, delivered, failed, score, level, xp, xpNeed, job, hintT, orders, inter, bossQ, touch, joy, btnE, btnD, btnPause, WL, WI, b, nameT, goalDeliveries = 6, dashCd = 0, dashMax = 1.8, bossHunt = false, extra = {}) {
    ctx.save();
    const gradientTransform = ctx.getTransform?.();
    const bounds = window.VIEWPORT?.hudBounds() || screenBounds();
    const scale = window.VIEWPORT?.get().scale || (document.getElementById("game")?.getBoundingClientRect().width || 900) / 900;
    const time = extra.time ?? Date.now() / 1000;
    const motion = !calm();
    const diegetic = theme === 'diegetic';
    const curMaxOil = maxOil || 100;
    const oilRatio = clamp(oil / curMaxOil, 0, 1), lowOil = oilRatio <= 0.25;
    if (lowOil) drawLowOil(ctx, oilRatio, time);

    // --- 左上：classic 為條狀油量；diegetic 直接把生命資訊變成提燈本體。 ---
    const oilTextSize = Math.max(20, Math.ceil(18 / scale));
    const oilBarH = Math.max(18, Math.ceil(16 / scale));
    const pBoxX = bounds.left + 18, pBoxY = bounds.top + 14;
    const pBoxW = diegetic ? Math.max(112, Math.ceil(82 / scale)) : Math.max(250, Math.ceil(170 / scale));
    const pBoxH = oilTextSize + oilBarH + 12;
    if (lowOil && motion) glow(ctx, pBoxX + pBoxW / 2, pBoxY + pBoxH / 2, pBoxW * 1.6, '#ff3b3b', 0.3 * pulse(8, 0.3));

    if (diegetic) {
      drawDiegeticOilLantern(ctx, pBoxX, pBoxY - 4, oil, curMaxOil, lowOil, time, extra.lanternHit || 0);
    } else {
      drawLantern(ctx, pBoxX + 16, pBoxY + pBoxH / 2, Math.max(28, oilTextSize * 1.5), lowOil ? '#ff6a4a' : '#ffb03a');
      ctx.fillStyle = '#fff4dd';
      ctx.font = readableFont(oilTextSize, '900');
      ctx.textAlign = 'right';
      inkText(ctx, Math.ceil(oil) + '/' + curMaxOil, pBoxX + pBoxW - 4, pBoxY + oilTextSize);
      ctx.textAlign = 'left';
      const barX = pBoxX + 40, barY = pBoxY + oilTextSize + 7, barW = pBoxW - 44;
      ctx.fillStyle = '#1c1814'; ctx.beginPath(); ctx.roundRect(barX, barY, barW, oilBarH, oilBarH / 2); ctx.fill();
      if (oilRatio > 0) {
        const fillW = Math.max(oilBarH, barW * oilRatio);
        ctx.fillStyle = barGradient(ctx, lowOil ? 'lowOil' : 'oil', barX, barX + barW, gradientTransform);
        ctx.beginPath(); ctx.roundRect(barX, barY, fillW, oilBarH, oilBarH / 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.24)'; ctx.beginPath(); ctx.roundRect(barX + 3, barY + 2, Math.max(0, fillW - 6), oilBarH * 0.34, oilBarH / 4); ctx.fill();
        glow(ctx, barX + fillW, barY + oilBarH / 2, oilBarH * 3.2, lowOil ? '#ff4030' : '#ffc766', 0.75 * (motion ? pulse(4, 0.7) : 0.8));
      }
      ctx.strokeStyle = 'rgba(0,0,0,.32)'; ctx.lineWidth = 1.2; ctx.beginPath();
      for (let i = 1; i < 10; i++) { ctx.moveTo(barX + barW * i / 10, barY + 2); ctx.lineTo(barX + barW * i / 10, barY + oilBarH - 2); }
      ctx.stroke(); ctx.strokeStyle = lowOil ? '#ff8a75' : 'rgba(232,195,106,.7)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.roundRect(barX, barY, barW, oilBarH, oilBarH / 2); ctx.stroke();
    }

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

    // --- 右上：classic 保留獨立時間條；diegetic 將時間、配達與分數整合進雷達群組。 ---
    const sBoxW = 215, sBoxH = 56;
    const sBoxX = bounds.right - sBoxW - Math.max(62, 44 / scale + 18), sBoxY = bounds.top + 14;
    const dawnProgress = clamp(elapsed / dawnTime, 0, 1);
    const dawnSecLeft = Math.max(0, Math.ceil(dawnTime - elapsed));
    const compact = scale < 0.62;
    const compactLandscape = (window.innerHeight || 600) <= 500 &&
      (window.innerWidth || 900) > (window.innerHeight || 600) * 1.55;
    const mapW = diegetic ? (compactLandscape ? 190 : 174) : (compact ? 120 : 172);
    const mapH = diegetic ? mapW : (compact ? 84 : 118);
    const mapX = sBoxX + sBoxW - mapW;
    let mapY, orderY;

    if (diegetic) {
      mapY = sBoxY;
      drawDiegeticMinimap(ctx, mapX, mapY, mapW, P, orders || [], job, extra.boss, dawnProgress, dawnSecLeft, time);
      const statY = mapY + mapH - 8;
      const statH = drawDiegeticRadarStatus(ctx, mapX, statY, mapW, delivered, goalDeliveries, score);
      orderY = statY + statH + 4;
    } else {
      ctx.textAlign = "left";
      ctx.fillStyle = "#ffd54f";
      ctx.beginPath();
      ctx.arc(sBoxX + 17, sBoxY + 17, 7, 0.5, 4.2);
      ctx.arc(sBoxX + 20, sBoxY + 17, 6, 4.0, 0.7, true);
      ctx.fill();
      ctx.font = readableFont(12, "900");
      const clockW = ctx.measureText("10:00").width;
      const dawnBarW = Math.max(12,sBoxW - 46 - clockW), dawnBarX = sBoxX + 34, dawnBarY = sBoxY + 12;
      ctx.fillStyle = "#1b2238";
      ctx.beginPath(); ctx.roundRect(dawnBarX, dawnBarY, dawnBarW, 9, 4.5); ctx.fill();
      if (dawnProgress > 0) {
        ctx.fillStyle = barGradient(ctx,"dawn",dawnBarX,dawnBarX+dawnBarW,gradientTransform);
        ctx.beginPath(); ctx.roundRect(dawnBarX, dawnBarY, Math.max(9, dawnBarW * dawnProgress), 9, 4.5); ctx.fill();
        glow(ctx, dawnBarX + dawnBarW * dawnProgress, dawnBarY + 4.5, 26, "#ffd27a", 0.6);
      }
      ctx.strokeStyle = "rgba(232, 195, 106, 0.55)"; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.roundRect(dawnBarX, dawnBarY, dawnBarW, 9, 4.5); ctx.stroke();
      const dawnSec = dawnSecLeft % 60;
      ctx.fillStyle = "#ffeed4";
      ctx.font = readableFont(12, "900");
      ctx.textAlign = "right";
      inkText(ctx, `${Math.floor(dawnSecLeft / 60)}:${dawnSec < 10 ? "0" : ""}${dawnSec}`, sBoxX + sBoxW - 4, sBoxY + 21);
      ctx.fillStyle = ctx.strokeStyle = "#ffe0a4";
      drawActionIcon(ctx, "pickup", sBoxX + 17, sBoxY + 42, 8);
      ctx.textAlign = "left";
      ctx.font = readableFont(14, "900");
      inkText(ctx, `${delivered}件`, sBoxX + 32, sBoxY + 47);
      mapY = sBoxY + sBoxH + 8;
      drawMinimap(ctx, mapX, mapY, mapW, mapH, P, orders || [], job, extra.boss, time);
      orderY = mapY + mapH + 6;
    }
    if (!compact && orders?.length) drawOrderList(ctx, mapX, orderY, mapW, fontPx(readableFont(12)) + 14, orders, P, inter);

    // --- 暫停鈕：保留原和紙按鈕及 hitbox，墨藍實心符號在流蘇安全區內視覺置中。 ---
    drawWoodTag(ctx,btnPause,"normal");
    ctx.save();
    ctx.translate(btnPause.x + btnPause.w / 2 - 1, btnPause.y + btnPause.h / 2 - 1);
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.3;
    ctx.strokeStyle = "#f5f7f2"; // 淺色描邊可與木框、深背景分離，不再使用黃色
    ctx.fillStyle = "#21364c";
    for (const barX of [-7,3]) {
      ctx.beginPath();ctx.roundRect(barX,-10,4,20,1);
      ctx.stroke();ctx.fill();
    }
    ctx.restore();

    // R9 Item 2: 奧義重開木牌錨定在右上安全區，嚴格避開左中任務/指南針 HUD
    const reopenW = Math.max(132, Math.min(154, Math.round(bounds.width * 0.17)));
    const reopenH = 43;
    // R10: 若真機環境加載實體雷達 (diegetic radar art)，木牌錨定在雷達左側並保留 14px 呼吸間距，消除雷達重疊；單元測試/無貼圖時錨定右側
    const hasRadarArt = !!(window.ART?.hud_radar_frame?.naturalWidth);
    const reopenX = Math.max(bounds.left + 8, (diegetic && hasRadarArt) ? mapX - reopenW - 20 : bounds.right - reopenW - 14);
    const reopenY = bounds.top + ((compactLandscape || compact) ? 70 : 68);
    FUSION_REOPEN_BTN.x = reopenX;
    FUSION_REOPEN_BTN.y = reopenY;
    FUSION_REOPEN_BTN.w = reopenW;
    FUSION_REOPEN_BTN.h = reopenH;

    // 舊版截取 ctx.fill/ctx.stroke 的繪製攔截已移除；game.js 直接呼叫按鈕 API。
    if (false && ctx && !ctx.__r9InterceptHooked) {
      ctx.__r9InterceptHooked = true;
      const origFill = ctx.fill;
      const origStroke = ctx.stroke;
      const origFillText = ctx.fillText;
      ctx.fill = function (...args) {
        if (this.fillStyle === "rgba(220, 160, 60, 0.92)") {
          drawFusionReopenButton(this, { btn: FUSION_REOPEN_BTN });
          return;
        }
        return origFill.apply(this, args);
      };
      ctx.stroke = function (...args) {
        if (this.strokeStyle === "#4a2a10" && this.lineWidth === 3) {
          return;
        }
        return origStroke.apply(this, args);
      };
      ctx.fillText = function (text, x, y, maxW) {
        if (text === "奧義" && this.font && this.font.includes("15px") && this.fillStyle === "#3a1505") {
          return;
        }
        if (text === "重開" && this.font && this.font.includes("11px") && this.fillStyle === "#3a1505") {
          return;
        }
        return origFillText.call(this, text, x, y, maxW);
      };

    }

    // --- 中上任務：暫停使用假繪馬，diegetic 先回到乾淨的浮動資訊。 ---
    const taskX = Math.max(248, pBoxX + pBoxW + 5), taskY = bounds.top + 14;
    const useQuestBoard = diegetic && DIEGETIC_QUEST_BOARD_ENABLED;
    const taskW = Math.min(370, sBoxX - taskX - 15), taskH = useQuestBoard ? 68 : 52;
    if (useQuestBoard) drawDiegeticQuestBoard(ctx, taskX, taskY - 5, taskW, taskH + 5);
    let omamoriEntryProgress = 1;
    if (diegetic && job && !bossHunt) {
      const nowMs = performance.now();
      if (job !== omamoriJobRef) {
        omamoriJobRef = job;
        omamoriEnterAtMs = nowMs;
      }
      omamoriEntryProgress = calm() ? 1 : clamp((nowMs - omamoriEnterAtMs) / 520, 0, 1);
      const lanternArt = window.ART?.hud_lantern_oil;
      const lanternAspect = lanternArt?.naturalWidth && lanternArt?.naturalHeight
        ? lanternArt.naturalWidth / lanternArt.naturalHeight : 0.75;
      const lanternVisualH = compactLandscape ? 190 : 168;
      const lanternVisualW = lanternVisualH * lanternAspect;
      HINT_BTN.w = compactLandscape ? 50 : 43;
      HINT_BTN.h = compactLandscape ? 69 : 60;
      HINT_BTN.x = pBoxX + lanternVisualW - 4;
      HINT_BTN.y = pBoxY + (compactLandscape ? 56 : 50);
      // 護符是已核准燈籠美術的一部分：只把熱區往左右對稱擴到 44 CSS，
      // 不放大畫中護符（drawDiegeticOmamoriHint 以 b.x+b.w/2 置中，故視覺零位移）。
      const hintW = cssPx(MIN_TOUCH_CSS);
      const hintH = cssPx(MIN_TOUCH_CSS);
      if (HINT_BTN.w < hintW) {
        HINT_BTN.x -= Math.round((hintW - HINT_BTN.w) / 2);
        HINT_BTN.w = hintW;
      }
      if (HINT_BTN.h < hintH) {
        HINT_BTN.y -= Math.round((hintH - HINT_BTN.h) / 2);
        HINT_BTN.h = hintH;
      }
    } else {
      omamoriJobRef = null;
      // 非 diegetic 時這裡是普通按鈕，直接吃 44 CSS 熱區。
      HINT_BTN.w = Math.max(78, cssPx(MIN_TOUCH_CSS));
      HINT_BTN.h = Math.max(cssPx(MIN_TOUCH_CSS), cssPx(MIN_TOUCH_CSS));
      HINT_BTN.x = taskX + taskW - HINT_BTN.w - 8;
      HINT_BTN.y = bounds.top + (useQuestBoard ? 28 : 20);
    }
    ctx.textAlign = "left";
    let afterTask = taskY + taskH + 6;
    if (bossHunt) {
      const bossPulse = motion ? 0.65 + 0.35 * Math.sin(time * 4) : 0.85;
      ctx.textAlign = "center";
      ctx.fillStyle = `rgba(255, 138, 154, ${0.7 + bossPulse * 0.3})`;
      ctx.font = "900 22px 'Noto Sans JP', sans-serif";
      const huntTitle = (extra && extra.bossTitle) ? `擊敗${extra.bossTitle}` : "擊敗大妖";
      inkText(ctx, huntTitle, taskX + taskW / 2, taskY + 32);
      drawCompass(ctx, taskX + taskW / 2 - 84, taskY + 26, extra.bossAngle, { color: "#ff3b4f", count: 2, size: 1.2 });
      drawCompass(ctx, taskX + taskW / 2 + 84, taskY + 26, extra.bossAngle, { color: "#ff3b4f", count: 2, size: 1.2 });
    } else if (job) {
      if (!diegetic) {
        const remaining = Math.round(Math.hypot(P.x - job.to.x, P.y - job.to.y) / 10) * 10;
        ctx.fillStyle = useQuestBoard ? '#43291d' : '#fff3ca';
        ctx.font = readableFont(18, '900');
        if (job.word.cue !== 'text') drawWordCue(ctx, job.word, taskX + 27, taskY + 16, 24);
        if (useQuestBoard) ctx.fillText(job.word.zh, taskX + (job.word.cue === 'text' ? 16 : 48), taskY + 27);
        else inkText(ctx, job.word.zh, taskX + (job.word.cue === 'text' ? 16 : 48), taskY + 23);
        drawCompass(ctx, taskX + 24, taskY + 40, extra.guideAngle, { color: '#ffd152', size: 1.1 });
        ctx.fillStyle = useQuestBoard ? '#5a3828' : '#82d8ff';
        ctx.font = readableFont(12, '900');
        if (useQuestBoard) ctx.fillText(String(remaining), taskX + 44, taskY + 48);
        else inkText(ctx, String(remaining), taskX + 44, taskY + 44);
      }

      const hintStage = job.hintStage || 0;
      const hintLabel = hintStage === 0 ? '聽 免費' : hintStage === 1 ? '詞 -4' : '✓';
      if (diegetic) {
        drawDiegeticOmamoriHint(ctx, HINT_BTN, hintStage, time, omamoriEntryProgress, extra.lanternHit || 0);
        ctx.textAlign = 'center'; ctx.font = readableFont(11, '900'); ctx.fillStyle = '#fff3ca';
        inkText(ctx, hintStage === 0 ? '免費' : hintStage === 1 ? '−4油' : '提示済', HINT_BTN.x + HINT_BTN.w / 2, HINT_BTN.y + HINT_BTN.h + 16);
      }
      else if (useQuestBoard) drawDiegeticHintTag(ctx, HINT_BTN, hintLabel, hintStage >= 2);
      else drawButton(ctx, HINT_BTN, hintLabel, {
        tone: 'cyan', size: 14, icon: hintStage === 0 ? 'listen' : 'hint', disabled: hintStage >= 2
      });

      if (job.showMeaningT > 0) {
        ctx.textAlign = "left";
        ctx.fillStyle = "#ffd54f";
        ctx.font = readableFont(11, "bold");
        afterTask += drawHintText(ctx, `${job.word.jp}　${job.word.example || ""}`, taskX, taskY + taskH + 6, taskW) + 6;
      }
    } else if (!diegetic) {
      // 沒有進行中的委託：包裹圖示＋箭頭，朝委託方向前進（靠近時圖示轉金色）。
      ctx.fillStyle = ctx.strokeStyle = inter ? "#ffe082" : "#f4e7cf";
      drawActionIcon(ctx, 'pickup', taskX + 27, taskY + 26, 13);
      drawCompass(ctx, taskX + 68, taskY + 26, extra.guideAngle, { color: inter ? "#ffe082" : "#ffd152", size: 1.3 });
    }
    if (extra.awakening) {
      // 奧義印記移至燈籠下緣，不再懸在畫面中央的任務牌下方。
      // 橫向手機的燈籠高 190，其餘 168；預留原圖流蘇／提示御守的空間。
      const sealY = diegetic ? bounds.top + (compactLandscape ? 200 : 178) : pBoxY + pBoxH + 14;
      drawAwakeningTag(ctx,pBoxX,sealY,150,extra.awakening);
    }
    if (job?.reading || extra.reading?.active && extra.reading.kind === 'delivery') {
      ctx.textAlign = 'left'; ctx.font = readableFont(12, '800'); ctx.fillStyle = '#b6f1e7';
      fitText(ctx, '安心讀題・離開恢復', taskX, afterTask + 16, taskW);
      afterTask += 32;
    }
    // Boss 血量與答題共用底部封印板，不在上方繪製第二塊血條。

    // --- 左下：武器格（含冷卻）＋被動體質欄 ---
    const fanSlots = resolveFanSlots(WL, WI);
    const maxActiveSlots = 4;
    const {badgeTextSize, badgeH, slotSize, footerHeight} = skillMetrics(scale, ctx);
    const slotGap = 8;
    ctx.save();
    ctx.translate(bounds.left + 18, bounds.bottom - footerHeight - 12);
    ctx.scale(1.2, 1.2);
    const slotStartX = 0, slotY = 0;

    const useSkillFan = diegetic && DIEGETIC_SKILL_FAN_ENABLED;
    let fanWidth = 0;
    if (useSkillFan) {
      fanWidth = drawDiegeticSkillFan(ctx, fanSlots, WL, extra, badgeTextSize, badgeH, motion);
    } else {
      for (let i = 0; i < maxActiveSlots; i++) {
        const sx = slotStartX + i * (slotSize + slotGap);
        const k = fanSlots[i];
        if (k) {
          const tone = WEAPON_TONE[k] || C.gold, scx = sx + slotSize / 2, scy = slotY + slotSize / 2;
          glassBox(ctx, sx, slotY, slotSize, slotSize, 9, 'rgba(14, 12, 24, 0.9)', tone, 1.8);
          if (isFusionSkill(k)) {
            drawFusionIcon(ctx, k, scx, scy, 17);
            drawFusionParentBadges(ctx, k, scx, scy, 17);
          } else {
            drawEmblem(ctx, k, scx, scy, 17);
          }
          const cd = extra?.cd?.[k] || 0;
          if (cd > 0.02) {
            ctx.fillStyle = 'rgba(4, 6, 14, 0.66)'; ctx.beginPath(); ctx.moveTo(scx, scy);
            ctx.arc(scx, scy, slotSize / 2 - 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * cd); ctx.closePath(); ctx.fill();
          } else if (motion && extra?.cd) glow(ctx, scx, scy, slotSize * 1.5, tone, 0.18 * pulse(3, 0.4));
          const lvl = WL[k] || 1;
          const badgeText = isFusionSkill(k) || lvl >= 5 ? 'MAX' : 'L' + lvl;
          ctx.fillStyle = C.gold; ctx.beginPath(); ctx.roundRect(sx, slotY + slotSize, slotSize, badgeH, 3); ctx.fill();
          ctx.fillStyle = '#161022'; ctx.textAlign = 'center'; ctx.font = '900 ' + badgeTextSize + 'px Noto Sans JP, sans-serif';
          ctx.fillText(badgeText, sx + slotSize / 2, slotY + slotSize + badgeTextSize + 3);
        } else {
          ctx.save(); ctx.setLineDash([3, 3]); ctx.strokeStyle = 'rgba(180,195,220,.35)'; ctx.lineWidth = 1.5; ctx.fillStyle = 'rgba(12,15,24,.5)';
          ctx.beginPath(); ctx.roundRect(sx, slotY, slotSize, slotSize, 9); ctx.fill(); ctx.stroke(); ctx.fillStyle = 'rgba(180,195,220,.35)';
          ctx.textAlign = 'center'; ctx.font = readableFont(13, 'bold'); ctx.fillText('＋', sx + slotSize / 2, slotY + slotSize / 2 + 5); ctx.restore();
        }
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

    const passiveX = useSkillFan ? fanWidth + 12 : maxActiveSlots * (slotSize + slotGap) + 8;
    const available = (bounds.width - 18 - 180) / 1.2;
    const passiveSlots = Math.max(1, Math.floor((available - passiveX + slotGap) / (slotSize + slotGap)));
    const visibleCount = passives.length <= passiveSlots ? passives.length : passiveSlots - 1;
    passives.slice(0, visibleCount).forEach((pas, pIdx) => {
      const px = passiveX + pIdx * (slotSize + slotGap);
      glassBox(ctx, px, slotY, slotSize, slotSize, 9, "rgba(14, 12, 24, 0.9)", "rgba(255, 213, 79, 0.55)", 1.4);

      const passiveImg = illustratedPassives[pas.id];
      if (passiveImg) {
        const imgS = slotSize * 0.7;
        ctx.drawImage(passiveImg, px + (slotSize - imgS) / 2, slotY + (slotSize - imgS) / 2, imgS, imgS);
      } else {
        drawEmblem(ctx, pas.id, px + slotSize / 2, slotY + slotSize / 2, 14);
      }

      // R9 Item 1: 精簡被動圖示右下角角標，縮小黑金底板與字級（高 11-12px、寬 11-14px），確保主圖紋飾可見度 > 85%（遠超 70% 門檻）
      if (pas.lvl >= 1) {
        const badgeTxt = `×${pas.lvl}`;
        const bFont = Math.max(8, Math.min(10, Math.round(slotSize * 0.22)));
        ctx.font = `900 ${bFont}px 'Noto Sans JP', sans-serif`;
        const bH = Math.max(10, Math.min(12, bFont + 3));
        const bW = Math.max(bH, Math.round(ctx.measureText(badgeTxt).width) + 3);
        const bx = px + slotSize - bW - 1;
        const by = slotY + slotSize - bH - 1;

        ctx.fillStyle = "rgba(14, 10, 16, 0.94)";
        ctx.beginPath();
        ctx.roundRect(bx, by, bW, bH, 2.5);
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 213, 79, 0.85)";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = "#ffd54f";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(badgeTxt, bx + bW / 2, by + bH / 2);
      }
    });
    const hiddenPassives = passives.length - visibleCount;
    if (hiddenPassives > 0) {
      const px = passiveX + visibleCount * (slotSize + slotGap);
      glassBox(ctx, px, slotY, slotSize, slotSize, 6, "rgba(40, 32, 12, 0.94)", "#ffd54f");
      ctx.fillStyle = "#ffe28b"; ctx.textAlign = "center";
      ctx.font = `900 ${badgeTextSize}px 'Noto Sans JP', sans-serif`;
      ctx.fillText(`＋${hiddenPassives}`, px + slotSize / 2, slotY + slotSize * 0.44);
      ctx.font = `700 ${Math.max(8, badgeTextSize - 2)}px 'Noto Sans JP', sans-serif`;
      ctx.fillStyle = "#f2e4c8";
      ctx.fillText("被動", px + slotSize / 2, slotY + slotSize * 0.82);
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

  function drawHudClassic(...args) {
    return drawHudBase('classic', ...args);
  }

  function drawHudDiegetic(...args) {
    return drawHudBase('diegetic', ...args);
  }

  function drawHud(...args) {
    return window.UI_THEME === 'classic' ? drawHudClassic(...args) : drawHudDiegetic(...args);
  }

  // 繪製日式和風紋章勳章（Kamon Emblems - 商業級金屬鍍金家紋）
  function drawEmblem(ctx, id, cx, cy, r) {
    ctx.save();
    ctx.translate(cx, cy);

    // 1. 雙層金箔金屬框與外圈陰影
    ctx.save();
    const goldGrad = ctx.createLinearGradient(-r, -r, r, r);
    goldGrad.addColorStop(0, "#e8d7af");
    goldGrad.addColorStop(0.28, "#c3a168");
    goldGrad.addColorStop(0.72, "#765f43");
    goldGrad.addColorStop(1, "#d7b981");

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
    ctx.fillStyle = "#28262b";
    ctx.fill();

    // 3. 元素專屬底色微光 (Elemental Core Gradient)
    const innerR = r * 0.82;
    const coreGrad = ctx.createRadialGradient(0, 0, innerR * 0.15, 0, 0, innerR);

    const PALETTE = {
      katana: ["#bf6b50", "#593b3a"], barrier: ["#79a6ac", "#394d54"],
      fire: ["#cd9260", "#62412e"], boom: ["#9e83a4", "#483e50"],
      thunder: ["#c3a56a", "#595039"], needle: ["#83ada7", "#355358"],
      fusion_inkblade: ["#d05638", "#3a1e1b"], fusion_thundercircle: ["#5aa8b8", "#243c4a"],
      shield: ["#c2a56e", "#594a35"], oil_max: ["#ba7854", "#5e4637"],
      oil_heal: ["#8ca47d", "#3e5844"], dmg: ["#b16b59", "#543a36"],
      rate: ["#b47e86", "#553a45"], crit: ["#c08a83", "#5a3a42"],
      spd: ["#80aa91", "#3c5749"], dash: ["#998ca9", "#444254"],
      mag: ["#a4ae7a", "#4d593b"]
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

      case "fusion_inkblade": {
        // 墨焰斬：赤墨交纏新月刃弧與靈火核心
        ctx.strokeStyle = "#221e24";
        ctx.lineWidth = Math.max(2.5, s * 0.16);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.65, -Math.PI * 0.7, Math.PI * 0.35);
        ctx.stroke();
        ctx.strokeStyle = "#ff7043";
        ctx.lineWidth = Math.max(1.5, s * 0.08);
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.6, -Math.PI * 0.65, Math.PI * 0.3);
        ctx.stroke();
        const fg = ctx.createRadialGradient(s * 0.1, -s * 0.1, 0, s * 0.1, -s * 0.1, s * 0.35);
        fg.addColorStop(0, "#ffe082");
        fg.addColorStop(0.5, "#d84315");
        fg.addColorStop(1, "rgba(34, 30, 36, 0)");
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.arc(s * 0.1, -s * 0.1, s * 0.35, 0, 6.28);
        ctx.fill();
        break;
      }

      case "fusion_thundercircle": {
        // 雷紋陣：天雷神鼓三環交錯與金雷芒
        ctx.strokeStyle = "#5aa8b8";
        ctx.lineWidth = Math.max(1.5, s * 0.06);
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.72, 0, 6.28);
        ctx.stroke();
        ctx.strokeStyle = "#ffd54f";
        ctx.lineWidth = Math.max(1.5, s * 0.07);
        for (let i = 0; i < 3; i++) {
          const a = (i * 2 * Math.PI) / 3 - Math.PI / 2;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * (s * 0.42), Math.sin(a) * (s * 0.42), s * 0.22, 0, 6.28);
          ctx.stroke();
        }
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.15, 0, 6.28);
        ctx.fill();
        break;
      }

      case "fusion_foxiai": {
        // 雷狐居合：墨刀弧與金雷一閃
        ctx.strokeStyle = "#221e24";
        ctx.lineWidth = Math.max(2, s * 0.16);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.62, -Math.PI * 0.62, Math.PI * 0.28);
        ctx.stroke();
        ctx.strokeStyle = "#ffd54f";
        ctx.lineWidth = Math.max(1.5, s * 0.08);
        ctx.beginPath();
        ctx.moveTo(-s * 0.5, -s * 0.55);
        ctx.lineTo(-s * 0.12, -s * 0.08);
        ctx.lineTo(-s * 0.3, s * 0.04);
        ctx.lineTo(s * 0.48, s * 0.58);
        ctx.stroke();
        break;
      }

      case "fusion_exorcistblade": {
        // 退魔符刃：赤墨斬弧貼符紙
        ctx.strokeStyle = "#c9553f";
        ctx.lineWidth = Math.max(2, s * 0.15);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.64, -Math.PI * 0.7, Math.PI * 0.25);
        ctx.stroke();
        ctx.fillStyle = "#f4e6c4";
        ctx.fillRect(-s * 0.16, -s * 0.34, s * 0.32, s * 0.68);
        ctx.strokeStyle = "#7a2f28";
        ctx.lineWidth = Math.max(1, s * 0.05);
        ctx.beginPath();
        ctx.moveTo(-s * 0.12, -s * 0.12);
        ctx.lineTo(s * 0.12, -s * 0.12);
        ctx.moveTo(-s * 0.12, s * 0.02);
        ctx.lineTo(s * 0.08, s * 0.02);
        ctx.moveTo(-s * 0.12, s * 0.16);
        ctx.lineTo(s * 0.12, s * 0.16);
        ctx.stroke();
        break;
      }

      case "fusion_foxfirebarrier": {
        // 妖火結界：靈陣雙環包覆狐火
        ctx.strokeStyle = "#7fc3c8";
        ctx.lineWidth = Math.max(1.4, s * 0.06);
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.72, 0, 6.28);
        ctx.stroke();
        ctx.strokeStyle = "#d98a4e";
        ctx.lineWidth = Math.max(1.4, s * 0.07);
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.48, 0, 6.28);
        ctx.stroke();
        ctx.fillStyle = "#ffcf7a";
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.38);
        ctx.quadraticCurveTo(s * 0.26, -s * 0.02, 0, s * 0.32);
        ctx.quadraticCurveTo(-s * 0.26, -s * 0.02, 0, -s * 0.38);
        ctx.fill();
        break;
      }

      case "fusion_exorcistseal": {
        // 退魔封陣：符紙四方封印與陣心符火
        ctx.strokeStyle = "#d9b26a";
        ctx.lineWidth = Math.max(1.4, s * 0.06);
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.7, 0, 6.28);
        ctx.stroke();
        ctx.fillStyle = "#f4e6c4";
        for (let i = 0; i < 4; i++) {
          const a = (i * Math.PI) / 2 - Math.PI / 4;
          ctx.save();
          ctx.rotate(a);
          ctx.fillRect(-s * 0.07, -s * 0.66, s * 0.14, s * 0.3);
          ctx.restore();
        }
        ctx.fillStyle = "#c9553f";
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.18, 0, 6.28);
        ctx.fill();
        break;
      }
    }

    ctx.restore();
    ctx.restore();
  }


  // 3. 升級三選一：閱讀優先。只使用一張和紙外框，選項不再重複大面積花飾。
  // M1-E-R4 共用 layout／熱區單一來源：game.js pointerdown/pointermove/重抽經由
  // UI.levelUpLayout(count) 取同一座標；缺 getter 時 game fallback 舊座標（game 側保留）。
  // 卡片几何不沿用舊 720×108：以真 hud 安全寬度置中加寬、固定卡高 130／行距 136，
  // 面板抬頭與已習得摘要壓縮讓位；高度／pitch 全 chart 由此函式唯一決定。
  // 和紙帳頁左右 54、上下 51 是框飾，不是內文區。選卡文字與重抽都放在框內，
  // 並離可見畫布底至少 8 CSS px。三張卡共用同一高度，供 game 熱區逐列命中。
  // 升級三選全新美術UI：16:9 三張直式大卡橫向並排
  function levelUpLayout(count) {
    const v = window.VIEWPORT?.get() || { scale: 1, width: 900, height: 600, offsetX: 0, offsetY: 0 };
    const scale = v.scale || 1;
    const LOGICAL_W = 900, LOGICAL_H = 600;
    const raw = (typeof count === "number" && Number.isFinite(count)) ? count : 3;
    const n = Math.max(1, Math.min(3, Math.round(raw)));

    const panel = {
      x: 30, y: 16,
      w: 840, h: 568
    };
    const titleBar = { x: 50, y: 30, w: 800, h: 32 };
    const summaryBar = { x: 50, y: 68, w: 800, h: 30 };

    // 16:9 橫向排列的三張直式大卡 (三張並排)
    const cardsTop = 110;
    const cardH = 396;
    const gap = 24;
    const cardW = 248;
    const totalW = n * cardW + (n - 1) * gap;
    const startX = Math.round(panel.x + (panel.w - totalW) / 2);

    const cards = [];
    for (let i = 0; i < n; i++) {
      cards.push({
        x: startX + i * (cardW + gap),
        y: cardsTop,
        w: cardW,
        h: cardH,
        index: i
      });
    }

    const card = { x: startX, y: cardsTop, w: cardW, h: cardH, gap, count: n };
    const rW = 150, rH = 42;
    const reroll = { x: panel.x + panel.w - rW - 20, y: cardsTop + cardH + 10, w: rW, h: rH };
    const footerTop = cardsTop + cardH + 10;

    return { card, cards, reroll, panel, titleBar, summaryBar, footer: { y: footerTop, h: 44 }, count: n, scale, pad: 8 };
  }
  const CHOICE_TYPE_LABEL = { weapon: "主動", passive: "被動", charm: "御守", mutation: "變異", duo: "共鳴", fusion: "合武" };
  // 修行進階：drawLevelUp 每幀用真 measureText 量出的內容高（供版面與驗收對照）
  const __levelUpMeasured = { n: 0, h: 0 };
  function choiceText(v) { return (typeof v === "string" && v.length) ? v : ""; }
  // 真卡精簡玩家文案：每則只留「玩家要決定的事」——效果（真實數值照抄 game 的 f）＋必要條件＋硬限制。
  // 未登錄的卡不做字串替換、不截斷、不縮字級：直接顯示遊戲原文，並在下方只補一條不重複的條件/限制行。
  const CARD_BRIEF = {
    // ── 體質修行（被動）──
    oil_max:   { e: "燈油上限 +30、立刻回 30；每秒耗油 −0.06", c: "", l: "最多 2 層" },
    oil_heal:  { e: "回 50% 燈油並震退周圍妖怪", c: "", l: "每場最多 3 次" },
    shield:    { e: "護盾擋 2 次受傷", c: "", l: "最多疊 6 次" },
    dmg:       { e: "基礎傷害加成 +30%", c: "", l: "最多 4 層" },
    rate:      { e: "妖刀、結界、靈針冷卻縮短", c: "", l: "最多 4 層" },
    crit:      { e: "妖刀／天雷爆擊率 +15%、結界 +10%", c: "", l: "爆擊率上限 50%、倍率 1.8" },
    spd:       { e: "移動速度 +15%", c: "", l: "最多 3 層" },
    dash:      { e: "衝刺冷卻縮短，衝刺帶無敵", c: "", l: "最多 3 層" },
    mag:       { e: "靈玉吸取範圍 +80", c: "", l: "最多 3 層" },
    // ── 御守（最多 3 款）──
    charm_power:  { e: "每層基礎傷害 +20%", c: "御守未滿 3 款", l: "" },
    charm_step:   { e: "每層移動速度 +28", c: "御守未滿 3 款", l: "" },
    charm_gather: { e: "每層靈玉吸取半徑 +75", c: "御守未滿 3 款", l: "" },
    charm_cadence:{ e: "每層冷卻時間 -0.25s", c: "御守未滿 3 款", l: "" },
    charm_reach:  { e: "每層射程與爆炸半徑 +10%", c: "御守未滿 3 款", l: "" },
    charm_guard:  { e: "每層燈油損失 -10%", c: "御守未滿 3 款", l: "" },
    mut_crosscut: { e: "主斬後追加一次交叉斬（60% 刀傷）；Lv5 風刃不追加", c: "持有退魔妖刀", l: "不可重複取得；每技能最多 3 種變異" },
    mut_fan: { e: "轉為多角度散射：發數增加、散射角擴大，單發傷害按發數分攤", c: "持有天狐靈針或陰陽符", l: "每技能最多 3 種變異" },
    // ── 共鳴奧義（不占主動、御守、變異槽位；一局只能取得一次，但效果仍可每次攻擊／每次施放觸發）──
    duo_inkfire:     { e: "妖刀命中灼燒目標追加墨焰痕：每次攻擊最多 3 敵各一次，共 20% 刀傷", c: "退魔妖刀 Lv3＋狐火炎 Lv3", l: "不可重複取得；每次攻擊有觸發上限" },
    duo_cinderseal:  { e: "陰陽符主爆命中灼燒目標，0.3 秒後追加一次餘燼，最多 3 敵分攤 15% 符傷", c: "狐火炎 Lv3＋陰陽符 Lv3", l: "不可重複取得；每次引爆限 1 處" },
    duo_thundercircle:{ e: "靈陣內落雷時追加墨紋衝擊：至多 3 敵各一次，共 20% 雷傷", c: "淨化靈陣 Lv3＋天狐雷 Lv3", l: "不可重複取得" },
    duo_frostseal:   { e: "陰陽符主爆命中寒冷目標後：普通怪移速 −35% 持續 0.35 秒、首領移速 −10% 持續 0.15 秒", c: "天狐靈針 Lv3＋陰陽符 Lv3", l: "不可重複取得；每次主爆限 1 敵、2 秒免疫" }
  };
  function cardBrief(id) { return Object.prototype.hasOwnProperty.call(CARD_BRIEF, id) ? CARD_BRIEF[id] : null; }

  // ── P1-MUTATION-CARDS（2026-10-19 使用者票）──
  // 變異／秘術在卡面只留「一句玩家懂的結果」＋一個小示意圖；完整規格仍留在 game 的資料層，不搬上卡面。
  // 單一來源：升級選卡與秘術卡片圖鑑都讀這張表（id 為準，圖鑑以 emblem／日文名反查）。
  const CARD_SHORT = {
    mut_return:    { ja: "靈針・回旋折返",   s: "靈針折返再擊，同一敵人額外受到 35% 傷害。", ic: "return" },
    mut_pulse:     { ja: "靈陣・連環脈衝",   s: "靈陣連震兩次，完整命中總傷害 +30%。",           ic: "pulse" },
    mut_seek:      { ja: "引魂追跡",         s: "飛出的法器會轉向追妖怪，失去目標後直行。", ic: "seek" },
    mut_fan:       { ja: "千本散射",         s: "多發散射，整輪總傷害提升約 20%。",         ic: "fan" },
    mut_frost:     { ja: "冰魄封靈",         s: "命中累積寒冷，之後短暫凍住妖怪。",         ic: "frost" },
    mut_pierce:    { ja: "靈針・穿透增額",   s: "能貫穿更多敵人，後面幾隻額外受傷。",       ic: "pierce" },
    mut_crosscut:  { ja: "妖刀・十字交斬",   s: "主斬後追加交叉斬，原敵也能再受傷。",       ic: "crosscut" },
    mut_branch:    { ja: "天狐雷・連鎖分歧", s: "主雷命中後再分出一道小雷。",             ic: "branch" },
    mut_orbit:     { ja: "狐火・偏心輪道",   s: "狐火橢圓繞行，接觸傷害提高 20%。",               ic: "orbit" },
    mut_splitblast:{ ja: "陰陽符・餘燼爆散", s: "主爆後原地再炸一次小爆。",               ic: "splitblast" },
    charm_power:   { ja: "力紋守",           s: "每層基礎傷害 +20%",                           ic: "power" },
    charm_step:    { ja: "風步守",           s: "每層移動速度 +28",                           ic: "step" },
    charm_gather:  { ja: "招靈守",           s: "每層靈玉吸取半徑 +75",                       ic: "gather" },
    charm_cadence: { ja: "疾奏守",           s: "每層冷卻時間 -0.25s",                       ic: "cadence" },
    charm_reach:   { ja: "遠霞守",           s: "每層射程與爆炸半徑 +10%",                     ic: "reach" },
    charm_guard:   { ja: "紙甲守",           s: "每層燈油損失 -10%",                     ic: "guard" }
  };
  // M2-FUSION：十組合武的固定顯示名／短句／母技／狀態。
  // state：ready=既有基線；pending_tech=戰鬥邏輯已有實作，仍待技術與候選美術核准。
  const FUSION_UI_META = {
    fusion_inkblade:         { name: "奧義・墨焰斬",   short: "妖刀與狐火融合，巨幅赤墨斬擊並留下焦痕灼燒。", ic: "inkblade",      parents: ["katana", "fire"],    state: "ready" },
    fusion_slashwheel:       { name: "奧義・斬界輪",   short: "妖刀與結界融合，旋斬成輪並推開近身妖怪。",     ic: "pulse",         parents: ["katana", "barrier"], state: "pending_tech" },
    fusion_foxiai:           { name: "奧義・雷狐居合", short: "妖刀引雷一閃，居合雷弧貫穿前方並留下雷痕。",   ic: "inkblade",      parents: ["katana", "thunder"], state: "pending_tech" },
    fusion_exorcistblade:    { name: "奧義・退魔符刃", short: "妖刀貼符爆裂，刃風與符火同時斬開妖氣。",       ic: "inkblade",      parents: ["katana", "boom"],    state: "pending_tech" },
    fusion_foxfirebarrier:   { name: "奧義・妖火結界", short: "狐火灌入靈陣，結界化為灼燒妖火的守護領域。",   ic: "pulse",         parents: ["fire", "barrier"],   state: "pending_tech" },
    fusion_foxthunderlantern:{ name: "奧義・狐雷天燈", short: "狐火與天雷共燃，天燈垂落雷火淨化四方。",       ic: "orbit",         parents: ["fire", "thunder"],   state: "pending_tech" },
    fusion_flamefestival:    { name: "奧義・炎符祭",   short: "炎符層層引爆，化為席捲戰場的炎之祭典。",       ic: "splitblast",    parents: ["fire", "boom"],      state: "pending_tech" },
    fusion_thundercircle:    { name: "奧義・雷陣封界", short: "結界與天雷融合，封界之內持續引動九天落雷。",   ic: "thundercircle", parents: ["barrier", "thunder"], state: "ready" },
    fusion_exorcistseal:     { name: "奧義・退魔封陣", short: "靈陣疊合符咒，封住妖路再由符火自陣心爆散。",   ic: "thundercircle", parents: ["barrier", "boom"],    state: "pending_tech" },
    fusion_thundertalisman:  { name: "奧義・雷符神罰", short: "雷符自天而降，對封鎖之敵降下神罰雷柱。",       ic: "branch",        parents: ["thunder", "boom"],   state: "pending_tech" }
  };
  Object.keys(FUSION_UI_META).forEach((id) => {
    const f = FUSION_UI_META[id];
    CARD_SHORT[id] = { ja: f.name, s: f.short, ic: f.ic, st: f.state };
  });
  const CARD_SHORT_BY_JA = Object.freeze(Object.keys(CARD_SHORT).reduce((m, k) => { m[CARD_SHORT[k].ja] = CARD_SHORT[k]; return m; }, {}));
  function cardShort(id, name) {
    if (id && Object.prototype.hasOwnProperty.call(CARD_SHORT, id)) return CARD_SHORT[id];
    if (name && Object.prototype.hasOwnProperty.call(CARD_SHORT_BY_JA, name)) return CARD_SHORT_BY_JA[name];
    return null;
  }
  // 卡面示意圖：以現有墨色細筆風格畫小圖解（線／箭頭／同心圓），非替代主美術的程式假圖。
  function drawCardIcon(ctx, ic, cx, cy, r, ink) {
    // P1-MUTATION-CARDS R2：深色底（圖鑑）傳淡金筆色；淺底（升級選卡）沿用預設深墨。
    const STROKE = ink || "rgba(43,29,22,.86)";
    if (!ic) return false;
    const R = Math.max(8, r);
    ctx.save();
    ctx.translate(cx, cy);   // P1-MUTATION-CARDS R1-fix-origin：圖解原點必須落在呼叫端指定的中心
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.strokeStyle = STROKE; ctx.fillStyle = STROKE;
    ctx.lineWidth = Math.max(1.1, R * 0.11);
    const arrow = (x0, y0, x1, y1) => {
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      const a = Math.atan2(y1 - y0, x1 - x0), h = R * 0.36;
      ctx.beginPath(); ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - h * Math.cos(a - 0.5), y1 - h * Math.sin(a - 0.5));
      ctx.lineTo(x1 - h * Math.cos(a + 0.5), y1 - h * Math.sin(a + 0.5));
      ctx.closePath(); ctx.fill();
    };
    const ring = (x, y, rr, al) => { ctx.globalAlpha = al == null ? 1 : al; ctx.beginPath(); ctx.arc(x, y, rr, 0, 6.2832); ctx.stroke(); ctx.globalAlpha = 1; };
    switch (ic) {
      case "return":     arrow(-R * .8, 0, R * .05, 0); ctx.beginPath(); ctx.arc(0, 0, R * .62, -1.0, 3.5); ctx.stroke(); arrow(R * .05, 0, -R * .55, R * .12); break;
      case "seek":       arrow(-R * .85, -R * .25, R * .3, -R * .25); ctx.beginPath(); ctx.arc(R * .05, -R * .25, R * .5, -0.7, 2.5); ctx.stroke(); arrow(R * .45, R * .1, R * .85, R * .3); break;
      case "fan":        arrow(-R * .8, 0, R * .25, -R * .62); arrow(-R * .8, 0, R * .25, 0); arrow(-R * .8, 0, R * .25, R * .62); break;
      case "frost":      for (let i = 0; i < 3; i++) { const a = i * 1.0472; ctx.beginPath(); ctx.moveTo(-Math.cos(a) * R * .8, -Math.sin(a) * R * .8); ctx.lineTo(Math.cos(a) * R * .8, Math.sin(a) * R * .8); ctx.stroke(); } break;
      case "pierce":     arrow(-R * .85, 0, R * .85, 0); ring(-R * .25, 0, R * .16, .55); ring(R * .3, 0, R * .16, .55); break;
      case "crosscut":   arrow(-R * .7, -R * .7, R * .7, R * .7); arrow(-R * .7, R * .7, R * .7, -R * .7); break;
      case "pulse":      ring(0, 0, R * .85, .5); ring(0, 0, R * .5, 1); ring(0, 0, R * .18, .8); break;
      case "branch":     ctx.beginPath(); ctx.moveTo(-R * .7, -R * .6); ctx.lineTo(-R * .1, 0); ctx.lineTo(R * .2, -R * .2); ctx.lineTo(R * .8, R * .55); ctx.stroke(); arrow(-R * .1, 0, -R * .5, R * .4); break;
      case "orbit":      ctx.beginPath(); ctx.ellipse(0, 0, R * .85, R * .5, 0, 0, 6.2832); ctx.stroke(); ring(R * .45, 0, R * .2, .8); break;
      case "splitblast": ring(-R * .2, -R * .1, R * .7, .75); ring(R * .38, R * .28, R * .38, .95); break;
      case "power":      arrow(0, R * .7, 0, -R * .7); arrow(-R * .55, 0, R * .55, 0); break;
      case "step":       arrow(-R * .7, R * .55, -R * .25, -R * .05); arrow(-R * .25, -R * .05, R * .25, -R * .65); arrow(R * .25, -R * .65, R * .6, -R * .9); break;
      case "gather":     ring(0, 0, R * .3, 1); ring(R * .5, 0, R * .22, .7); ring(-R * .5, 0, R * .22, .7); break;
      case "cadence":    ctx.beginPath(); ctx.arc(0, 0, R * .75, 0, 6.2832); ctx.stroke(); arrow(0, 0, 0, -R * .5); arrow(0, 0, R * .45, R * .2); break;
      case "reach":      arrow(-R * .85, 0, R * .85, 0); ctx.setLineDash([R * .22, R * .18]); ring(R * .35, 0, R * .5, .7); ctx.setLineDash([]); break;
      case "guard":      ctx.beginPath(); ctx.moveTo(0, -R * .8); ctx.lineTo(R * .65, -R * .45); ctx.lineTo(R * .45, R * .55); ctx.lineTo(0, R * .85); ctx.lineTo(-R * .45, R * .55); ctx.lineTo(-R * .65, -R * .45); ctx.closePath(); ctx.stroke(); break;
      case "inkblade":   ctx.beginPath(); ctx.arc(0, 0, R * .8, -Math.PI * .6, Math.PI * .35); ctx.stroke(); arrow(R * .4, -R * .4, R * .65, -R * .1); ring(0, 0, R * .25, .8); break;
      case "thundercircle": ring(0, 0, R * .8, .7); ring(0, 0, R * .45, 1); ctx.beginPath(); ctx.moveTo(-R * .15, -R * .6); ctx.lineTo(R * .1, -R * .1); ctx.lineTo(-R * .1, 0); ctx.lineTo(R * .2, R * .6); ctx.stroke(); break;
      default: ctx.restore(); return false;
    }
    ctx.restore(); return true;
  }
  const CARD_ICON_R = 13;
  function drawLevelUp(ctx, level, choices, WL, WI, rerolls = 0, time = Date.now()/1000, focus = 0, inputMode = "keyboard", awakening = null) {
    const levelFont=(size,weight)=>readableFont(Math.max(size,Math.ceil(14/(window.VIEWPORT?.get().scale||1))),weight);
    ctx.save();
    ctx.fillStyle="rgba(6,8,16,.89)";
    fillScreen(ctx);
    ctx.globalAlpha=.88;
    // 與 game.js 熱區同源：同一 count 取同一 levelUpLayout。
    const L = levelUpLayout(choices.length);
    const { panel, titleBar, summaryBar } = L;
    const panelCX = panel.x + panel.w / 2;
    drawScrollBoard(ctx,panel.x,panel.y,panel.w,panel.h);
    ctx.globalAlpha=1;
    ctx.textBaseline="alphabetic";
    const inkOf=()=>{
      const px=fontPx(ctx.font);
      const m=ctx.measureText?ctx.measureText("國Ay"):{width:px};
      const asc=Number.isFinite(m.actualBoundingBoxAscent)&&m.actualBoundingBoxAscent>0?m.actualBoundingBoxAscent:px*0.82;
      const desc=Number.isFinite(m.actualBoundingBoxDescent)&&m.actualBoundingBoxDescent>0?m.actualBoundingBoxDescent:px*0.18;
      return {px,asc,desc,lh:Math.max(px,Math.ceil(asc+desc))};
    };
    const bandBase=(bar)=>{
      const m=inkOf();
      return bar.y+(bar.h-(m.asc+m.desc))/2+m.asc;
    };
    ctx.textAlign="center";
    ctx.font=levelFont(L.scale<1?18:22,"900");ctx.fillStyle="#39271f";
    const titleText=awakening
      ? `修行進階  Lv.${level}・覺醒印${awakening.seals}`+(titleBar.w*L.scale<480?"":"・Lv4可升MAX")
      : "修行進階  Lv."+level;
    drawRitualHeader(ctx,titleBar.x,titleBar.y,titleBar.w,titleBar.h,titleText);

    ctx.fillStyle="rgba(249,239,217,.93)";
    ctx.beginPath();ctx.roundRect(summaryBar.x,summaryBar.y,summaryBar.w,summaryBar.h,7);ctx.fill();
    ctx.strokeStyle="rgba(100,69,49,.45)";ctx.lineWidth=1;ctx.stroke();
    ctx.textAlign="left";ctx.font=levelFont(15,"900");ctx.fillStyle="#634331";
    const summaryRows=summaryBar.w*L.scale<640?2:1;
    const sumBase=bandBase({...summaryBar,h:summaryBar.h/summaryRows});
    ctx.fillText("已習得",summaryBar.x+12,sumBase);
    const equipped=WI?Object.keys(WI).filter(k=>(WL[k]||0)>0).slice(0,4):[];
    const summaryCols=4/summaryRows;
    const slotStep=(summaryBar.w-120)/summaryCols, slotMax=Math.max(60,Math.floor(slotStep)-12);
    for(let i=0;i<4;i++){
      const k=equipped[i],x=summaryBar.x+108+(i%summaryCols)*slotStep;
      const slotBase=sumBase+Math.floor(i/summaryCols)*(summaryBar.h/summaryRows);
      if(k){
        ctx.font=levelFont(16,"800");ctx.fillStyle="#362820";
        fitText(ctx,WI[k].zh+" Lv."+WL[k],x,slotBase,slotMax,{minSize:Math.ceil(14/L.scale)});
      }else{
        ctx.font=levelFont(15,"700");ctx.fillStyle="#a6947d";
        ctx.fillText("—",x,slotBase);
      }
    }
    const wrapLine=(text,maxWidth)=>{
      const rows=[]; let cur="";
      const w=(s)=>ctx.measureText(s).width;
      const parts=String(text||"").match(/[A-Za-z0-9.+%×/]+|\s+|./gu)||[];
      const push=()=>{ if(cur){rows.push(cur); cur="";} };
      for(const tok of parts){
        if(cur&&w(cur+tok)>maxWidth)push();
        if(!cur&&w(tok)>maxWidth){
          for(const ch of tok){ if(cur&&w(cur+ch)>maxWidth)push(); cur+=ch; }
        }else cur+=tok;
      }
      push();
      return rows.length?rows:[""];
    };
    const cards = L.cards || [L.card];
    choices.forEach((c, i) => {
      const cardRect = cards[i] || L.card;
      const x = cardRect.x, y = cardRect.y, w = cardRect.w, h = cardRect.h;
      const selected = i === focus;
      const weapon = c.type === "weapon";
      const isFusion = c.type === "fusion";
      const awakenCard = c.lv === 5 || c.rarity === "max";

      ctx.save();
      // 直卡陰影與光暈
      if (selected) {
        ctx.shadowColor = "#ffb300";
        ctx.shadowBlur = 16;
      } else {
        ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 4;
      }

      // 卡片底板：支援正式新直式卷軸底板圖（如有），否則標記 ART_ASSET_NEEDED 並使用半水墨深藍浮世繪底
      const cardBoardImg = selected
        ? (window.ART?.card_scroll_sel || window.ART?.card_vertical_sel)
        : (window.ART?.card_scroll_v1 || window.ART?.card_vertical || window.ART?.card_scroll);
      if (cardBoardImg && cardBoardImg.naturalWidth > 0) {
        ctx.drawImage(cardBoardImg, x, y, w, h);
      } else {
        if (typeof window !== "undefined") {
          if (!window.__ART_ASSET_NEEDED) window.__ART_ASSET_NEEDED = new Set();
          window.__ART_ASSET_NEEDED.add("card_scroll_v1");
        }
        const cardBg = ctx.createLinearGradient(x, y, x, y + h);
        cardBg.addColorStop(0, selected ? "#1a253a" : "#131a29");
        cardBg.addColorStop(1, selected ? "#22314d" : "#0e1420");
        ctx.fillStyle = cardBg;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 10);
        ctx.fill();
      }

      // 卡片邊框：選中時明亮金框、未選中時和風深木色
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.strokeStyle = selected ? "#ffd54f" : "#4a5a78";
      ctx.lineWidth = selected ? 3.5 : 1.5;
      ctx.stroke();

      // 卡頂大幅正式技能插畫區 (w - 20, 140px 高度)
      const artX = x + 10, artY = y + 10, artW = w - 20, artH = 142;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(artX, artY, artW, artH, [8, 8, 4, 4]);
      ctx.clip();
      ctx.fillStyle = "#0c1018";
      ctx.fillRect(artX, artY, artW, artH);

      // 插畫繪製：支援技能、被動、御守、融合真圖
      let artDrawn = false;
      if (isFusion) {
        artDrawn = drawFusionCandidateArt(ctx, c.id, artX, artY, artW, artH, 1);
      } else {
        let rasterImg = null;
        if (typeof c.id === "string" && c.id.startsWith("charm_")) rasterImg = illustratedCharms[c.id.slice("charm_".length)];
        else if (illustratedPassives[c.id]) rasterImg = illustratedPassives[c.id];
        else if (illustratedSkills[c.id]) rasterImg = illustratedSkills[c.id];
        else if (window.ART && window.ART[c.id]) rasterImg = window.ART[c.id];

        if (rasterImg && rasterImg.naturalWidth > 0) {
          const rw = rasterImg.naturalWidth, rh = rasterImg.naturalHeight;
          const scale = Math.max(artW / rw, artH / rh);
          const dw = rw * scale, dh = rh * scale;
          ctx.drawImage(rasterImg, artX + (artW - dw) / 2, artY + (artH - dh) / 2, dw, dh);
          artDrawn = true;
        } else {
          artDrawn = drawScrollCardArt(ctx, c.id, artX + artW / 2, artY + artH / 2, 45, { dark: true });
          if (!artDrawn) drawEmblem(ctx, c.id, artX + artW / 2, artY + artH / 2, 38);
        }
      }
      ctx.restore();

      // 插畫框金色飾邊
      ctx.strokeStyle = selected ? "rgba(255, 213, 79, 0.6)" : "rgba(100, 120, 160, 0.35)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(artX, artY, artW, artH, [8, 8, 4, 4]);
      ctx.stroke();

      // 卡片序號印章 (1, 2, 3)
      ctx.save();
      const numBadgeX = artX + 16, numBadgeY = artY + 16;
      ctx.beginPath();
      ctx.arc(numBadgeX, numBadgeY, 12, 0, Math.PI * 2);
      ctx.fillStyle = selected ? "#ffb300" : "#2d3a52";
      ctx.fill();
      ctx.strokeStyle = selected ? "#ffffff" : "#687a9e";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = readableFont(13, "900");
      ctx.fillStyle = selected ? "#1a253a" : "#ffffff";
      ctx.fillText(String(i + 1), numBadgeX, numBadgeY);
      ctx.restore();

      // 下半部資訊區
      const infoTop = artY + artH + 10;
      const typeLabel = CHOICE_TYPE_LABEL[c.type] || "修行";
      const coreLevel = awakenCard ? "覺醒・耗 1 印" : (choiceText(c.levelText) || (weapon ? "主動秘術" : "被動修行"));

      // 類型標籤 pill
      ctx.textAlign = "left";
      ctx.font = readableFont(12, "800");
      const badgeW = ctx.measureText(typeLabel).width + 12;
      ctx.fillStyle = isFusion ? "#7b1fa2" : awakenCard ? "#c2185b" : selected ? "#e65100" : "#2e3b52";
      ctx.beginPath();
      ctx.roundRect(x + 12, infoTop, badgeW, 20, 4);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.fillText(typeLabel, x + 18, infoTop + 14);

      // 等級 / 覺醒標籤
      ctx.textAlign = "right";
      ctx.fillStyle = awakenCard ? "#ffd54f" : "#a8c0e0";
      ctx.font = readableFont(12, "700");
      ctx.fillText(coreLevel, x + w - 12, infoTop + 14);

      // 大字技能名
      const nameY = infoTop + 44;
      ctx.textAlign = "left";
      ctx.font = readableFont(19, "900");
      ctx.fillStyle = selected ? "#fff7d6" : "#ffffff";
      ctx.fillText(c.n, x + 12, nameY, w - 24);

      // 日文假名讀音
      if (c.s) {
        ctx.font = "700 13px 'Noto Sans JP', sans-serif";
        ctx.fillStyle = "#fadb5f";
        ctx.fillText(c.s, x + 12, nameY + 20, w - 24);
      }

      // 精簡效果描述 (1-2 行)
      const descY = nameY + (c.s ? 40 : 26);
      const brief = cardBrief(c.id);
      const short = cardShort(c.id, c.n);
      const descText = (short && short.s) ? String(short.s) : (brief ? String(brief.e || "") : String(c.d || ""));
      ctx.font = readableFont(13, "600");
      ctx.fillStyle = selected ? "#e8e0d0" : "#b0bcd0";
      const lines = wrapLine(descText, w - 24).slice(0, 3);
      lines.forEach((line, li) => {
        ctx.fillText(line, x + 12, descY + li * 18, w - 24);
      });

      // 底部選取提示
      if (selected) {
        ctx.fillStyle = "rgba(255, 213, 79, 0.15)";
        ctx.fillRect(x + 8, y + h - 34, w - 16, 26);
        ctx.textAlign = "center";
        ctx.font = readableFont(13, "900");
        ctx.fillStyle = "#ffd54f";
        ctx.fillText("【 按 Enter / 點擊選取 】", x + w / 2, y + h - 17);
      } else {
        ctx.textAlign = "center";
        ctx.font = readableFont(12, "700");
        ctx.fillStyle = "#637494";
        ctx.fillText(`按 ${i + 1} 鍵選擇`, x + w / 2, y + h - 17);
      }

      ctx.restore();
    });

    ctx.textBaseline="alphabetic";
    ctx.textAlign="left";ctx.font=levelFont(14,"800");ctx.fillStyle="#47352a";
    const legend=inputMode==="gamepad"?"十字鍵／左搖桿 選卡 · A 確認 · Y 重抽"
      :inputMode==="touch"?"點選技能 · 可按右側重抽"
      :(L.card.w*L.scale<480?"↑↓ 選卡 · Enter 確認 · R 重抽":"↑↓ 選卡 · Enter 確認 · 1／2／3 直選 · R 重抽");
    const legendM=inkOf();
    // C-F1-R2：reroll 已移到面板下方，legend baseline 對齊 reroll 中心
    const legendBase=L.reroll.y+(L.reroll.h-(legendM.asc+legendM.desc))/2+legendM.asc;
    fitText(ctx,legend,L.card.x+8,legendBase,Math.max(80,L.reroll.x-L.card.x-16));
    drawButton(ctx,{...L.reroll,id:"reroll"},"重抽 ×"+rerolls,{tone:"normal",size:Math.max(16,Math.ceil(14/L.scale)),icon:"cards",disabled:rerolls<=0,fit:true,fitMin:cssPx(11)});
    ctx.restore();
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
    // 縮短／搬移 Boss HP 條與答題板：保留被動技全數可見，血條垂直浮於底部被動欄上方。
    const left = bounds.left + (bounds.width <= 1024 ? 260 : 282);
    const right = bounds.right - (bounds.width <= 1024 ? 120 : 180);
    const maxW = bounds.width <= 900 ? 320 : bounds.width <= 1024 ? 360 : 420;
    const w = Math.min(maxW, Math.max(1, right - left)), gap = n === 2 ? 18 : 10;
    const optW = Math.min(n === 2 ? 200 : 140, (w - 20 - (n - 1) * gap) / n);
    const optH = Math.max(44, Math.ceil(44 / scale)), h = optH + 54;
    const center = (bounds.left + bounds.right) / 2;
    const x = clamp(center - w / 2, left, right - w);
    const bossBarH = fontPx(readableFont(13)) + Math.max(11, Math.ceil(10 / scale)) + 16;
    const gapToBar = 10;
    const bottomInset = bounds.height <= 480 ? 114 : 118;
    const y = bounds.bottom - bottomInset - bossBarH - gapToBar - h;
    const startX = x + (w - n * optW - (n - 1) * gap) / 2;
    return {x,y,w,h,bar:{x,y:y+h+gapToBar,w,h:bossBarH},
      options:Array.from({length:n},(_,i)=>({x:startX+i*(optW+gap),y:y+46,w:optW,h:optH}))};
  }

  function drawBossQuiz(ctx, bossQ, mode = 'keyboard', boss = null, breakFade = 0) {
    if (!bossQ && !boss) return;
    ctx.save();
    const layout = bossQuizLayout(bossQ?.ans.length || 3);
    const {x:bx,y:by,w:boxW,h:boxH} = layout;
    const mid = bx+boxW/2;

    // 王戰血條只在這裡畫一次；答題板在上、血條在下，不再彼此壓住。
    if (boss) {
      const scale = window.VIEWPORT?.get().scale || 1;
      drawBossBar(ctx,layout.bar.x,layout.bar.y,layout.bar.w,boss,scale,Date.now()/1000);
    }
    if (!bossQ) {
      if (breakFade > 0 && !calm()) {
        // 答對瞬間在答題板原處破封，王戰血條始終清楚留在下方。
        ctx.save();ctx.globalAlpha=breakFade*.86;
        const drift=(1-breakFade)*34;
        for(const side of [-1,1]){
          const edge=mid+side*(5+drift);
          ctx.fillStyle="#d8be91";ctx.strokeStyle="#77513b";ctx.lineWidth=2;
          ctx.beginPath();
          ctx.moveTo(edge,by+25);ctx.lineTo(edge+side*(boxW*.46),by+22);
          ctx.lineTo(edge+side*(boxW*.46),by+73);ctx.lineTo(edge+side*19,by+65);
          ctx.lineTo(edge-side*10,by+53);ctx.lineTo(edge+side*15,by+43);
          ctx.closePath();ctx.fill();ctx.stroke();
          ctx.strokeStyle="#6c4233";
          ctx.beginPath();ctx.moveTo(edge+side*13,by+37);ctx.lineTo(edge+side*49,by+52);
          ctx.lineTo(edge+side*67,by+34);ctx.stroke();
        }
        ctx.restore();
      }
      ctx.restore();
      return;
    }

    // 上層和紙題板：保留原有選項位置，觸控判定與鍵盤快捷鍵不變。
    drawWashiBoard(ctx,bx,by,boxW,boxH,true);
    ctx.fillStyle="rgba(45,30,26,.90)";
    ctx.beginPath();ctx.roundRect(bx+18,by+13,boxW-36,29,4);ctx.fill();

    ctx.textAlign = "center";
    ctx.font = readableFont(11, '800'); ctx.fillStyle = '#f1d9aa';
    const quizNotice = bossQ.reading === false ? '戰鬥已恢復・答對破盾'
      : Number.isFinite(bossQ.barrierTimer) ? `答題結界 ${Math.ceil(bossQ.barrierTimer)}s・答對破盾` : '安心讀題・作答後恢復戰鬥';
    ctx.fillText(quizNotice, mid, by - 12);
    ctx.fillStyle = "#f8e9c8";
    ctx.font = readableFont(20, "900");
    const question = `${bossQ.word.zh}　→　？`;
    if (bossQ.word.cue === "text" || !bossQ.word.icon) {
      fitText(ctx, question, mid, by + 30, boxW - 32, { minSize: 14, wrap: true });
    } else {
      drawWordCue(ctx, bossQ.word, mid - 88, by + 22, 30);
      ctx.textAlign = "left";
      fitText(ctx, question, mid - 62, by + 30, boxW - 110, { minSize: 14, wrap: true });
    }
    ctx.textAlign = "center";

    bossQ.ans.forEach((w, i) => {
      const {x:ox,y:oy,w:optW,h:optH} = layout.options[i];
      const wrong = bossQ.wrong?.includes(i);
      drawWoodTag(ctx,{x:ox,y:oy,w:optW,h:optH},"normal",false,true);
      if (wrong || bossQ.lock > 0) {
        ctx.fillStyle = wrong ? "rgba(115,56,49,.76)" : "rgba(85,76,69,.43)";
        ctx.beginPath();ctx.roundRect(ox+3,oy+3,optW-6,optH-6,5);ctx.fill();
      }
      ctx.fillStyle = wrong ? "#f8e2c4" : bossQ.lock > 0 ? "#6b574e" : "#352822";
      const badge = mode === 'gamepad' ? ["LB", "RB", "Y"][i] : mode === 'touch' ? '' : i + 1;
      const answerText = `${wrong ? '× ' : badge ? badge + ' ' : ''}${w.jp}`;
      ctx.font = answerFont(18, "900");
      if (answerFontReady(answerText, 18, "900")) {
        fitText(ctx, answerText, ox + optW / 2, oy + optH / 2 + 7, optW - 12, { minSize: 13, wrap: true });
      }
    });

    ctx.restore();
  }

  // ---- 奧義融合（Fusion UI：F0/F1-A 雙技歸一；M2 多配方選卡） ----
  // M2-FUSION 契約：getViewModel().eligibleRecipes／selectedRecipeId 為選配；
  // 單配方仍走原 model.recipe 路徑，多配方才啟用同源選卡 buttons（recipe:<id>）。
  function fusionRecipeList(model) {
    const m = model || {};
    const out = [];
    const seen = new Set();
    if (Array.isArray(m.eligibleRecipes)) {
      for (const r of m.eligibleRecipes) {
        if (!r || typeof r.id !== "string" || !r.id || seen.has(r.id)) continue;
        seen.add(r.id);
        out.push(r);
      }
    }
    if (!out.length && m.recipe && typeof m.recipe.id === "string" && m.recipe.id) out.push(m.recipe);
    return out;
  }

  const FUSION_PARENT_NAMES = {
    katana: "妖刀斬", barrier: "淨化靈陣", fire: "狐火炎", boom: "陰陽符", thunder: "天狐雷", needle: "天狐靈針"
  };

  function fusionParents(recipe) {
    const id = recipe && recipe.id;
    const meta = id && FUSION_UI_META[id];
    const parents = recipe && Array.isArray(recipe.parents) ? recipe.parents : (meta ? meta.parents : null);
    if (parents && parents.length >= 2) return [parents[0], parents[1]];
    return id === "fusion_thundercircle" ? ["barrier", "thunder"] : ["katana", "fire"];
  }

  // 來源變異一次免費、非變異不另補償：每張卡都要能直接讀懂。
  function fusionCompensationLabel(recipe, model) {
    const id = recipe && recipe.id;
    const own = recipe && Array.isArray(recipe.sourceMutationIds) ? recipe.sourceMutationIds : null;
    const m = model || {};
    const top = Array.isArray(m.sourceMutationIds) ? m.sourceMutationIds : null;
    const matchTop = !!id && (id === m.selectedRecipeId || (m.recipe && id === m.recipe.id));
    const muts = own || (matchTop ? top : null);
    if (muts && muts.length > 0) return `變異×${muts.length} → 免費非變異×1`;
    if (own) return "來源無變異 → 不另補償";
    return "來源變異 → 免費非變異×1";
  }

  // 候選主圖框：contain 等比縮放於框內；無真圖（非 DEV 頁／未載入）回傳 false，
  // 呼叫端保留既有家紋回落，不產生程序假美術。
  function drawFusionCandidateArt(ctx, id, x, y, w, h, alpha = 1) {
    if (!(w > 0) || !(h > 0)) return false;
    const img = getUiFusionArt(id, "main");
    if (!img || !img.naturalWidth || !img.naturalHeight) return false;
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const s = Math.min(w / iw, h / ih);
    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.drawImage(img, Math.round(x + (w - iw * s) / 2), Math.round(y + (h - ih * s) / 2), Math.round(iw * s), Math.round(ih * s));
    ctx.restore();
    return true;
  }

  // 朱印落款：小尺寸 UI 標示字（既有程序備援系統性質，不作美術主體）。
  function drawFusionSealStamp(ctx, x, y, r, label = "合") {
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283);
    ctx.fillStyle = "rgba(168,68,50,.92)"; ctx.fill();
    ctx.lineWidth = Math.max(1.4, r * .16);
    ctx.strokeStyle = "rgba(255,232,196,.85)"; ctx.stroke();
    ctx.fillStyle = "#ffeccd";
    ctx.font = readableFont(Math.max(9, Math.round(r * 1.05)), "900");
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(label, x, y + r * .06);
    ctx.restore();
  }

  // 融合選單共用「選定配方」報導帶：既有候選真主圖＋母技來源＋效果摘要＋補償章。
  // 舊節目條的黑空白問題由此帶補足；缺圖時左側以合武家紋程序備援。
  function drawFusionHeroPanel(ctx, rect, recipe, model, compact, opts = {}) {
    if (!rect || !(rect.h >= 34) || !(rect.w >= 80)) return;
    const id = recipe && recipe.id;
    const meta = CARD_SHORT[id] || {};
    const parents = fusionParents(recipe);
    const pNames = parents.map(p => `${CARD_SHORT[p]?.ja || FUSION_PARENT_NAMES[p] || p}(MAX)`);
    const name = (recipe && recipe.name) || meta.ja || id;
    const chip = opts.chip !== false;
    const comp = chip ? fusionCompensationLabel(recipe, model) : "";

    ctx.save();
    ctx.textBaseline = "alphabetic";
    drawRitualCard(ctx, rect.x, rect.y, rect.w, rect.h, {dark: true});

    // 左：既有候選真主圖（本機 DEV）；右：名稱／母技來源／效果摘要
    const artW = Math.min(Math.round(rect.h * 1.15), Math.max(48, Math.round(rect.w * .18)));
    const artX = rect.x + 8, artY = rect.y + 5, artH2 = rect.h - 10;
    const drawn = drawFusionCandidateArt(ctx, id, artX, artY, artW, artH2, 1);
    if (!drawn) {
      const rr = Math.min(artW, artH2) * .34;
      drawFusionIcon(ctx, id, artX + artW / 2, artY + artH2 / 2, Math.max(10, rr));
    }

    const tx = artX + artW + 10;
    const chipW = chip ? Math.max(56, Math.min(210, rect.w * .26)) : 0;
    const textW = Math.max(40, rect.w - (tx - rect.x) - chipW - 20);
    const lineTop = (base, size) => base - size * 0.8;
    const lineBot = (base, size) => base + size * 0.2;
    const nameFont = readableFont(compact ? 13 : 16, "900");
    const nameSize = fontPx(nameFont);
    const nameBase = rect.y + (compact ? 16 : 19);
    ctx.textAlign = "left";
    ctx.font = nameFont;
    ctx.fillStyle = "#ffe082";
    fitText(ctx, name, tx, nameBase, textW, { minSize: 9, minCss: 11 });

    const parentFont = readableFont(compact ? 9 : 11, "700");
    const parentSize = fontPx(parentFont);
    let parentBase = rect.y + (compact ? 28 : 34);
    if (lineTop(parentBase, parentSize) < lineBot(nameBase, nameSize) + 2) {
      parentBase = lineBot(nameBase, nameSize) + 2 + parentSize * 0.8;
    }
    ctx.font = parentFont;
    ctx.fillStyle = "#f2e4c8";
    fitText(ctx, `母技：${pNames[0]} ＋ ${pNames[1]}`, tx, parentBase, textW, { minSize: 8, minCss: 10.5 });

    const desc = meta.s || (recipe && (recipe.short || recipe.desc)) || "";
    if (desc && opts.showDescription !== false) {
      const descFont = readableFont(compact ? 8 : 10, "600");
      const descSize = fontPx(descFont);
      let descBase = rect.y + (compact ? 40 : 49);
      if (lineTop(descBase, descSize) < lineBot(parentBase, parentSize) + 2) {
        descBase = lineBot(parentBase, parentSize) + 2 + descSize * 0.8;
      }
      const descBottom = lineBot(descBase, descSize);
      if (descBottom <= rect.y + rect.h - 2 && lineTop(descBase, descSize) >= lineBot(parentBase, parentSize) + 2) {
        ctx.font = descFont;
        ctx.fillStyle = "#e8dcc2";
        fitText(ctx, desc, tx, descBase, textW, {
          minSize: 8, minCss: 10, wrap: false
        });
      }
    }

    if (chip) {
      ctx.font = readableFont(compact ? 8 : 10, "700");
      ctx.fillStyle = "#e9c97e";
      ctx.textAlign = "right";
      fitText(ctx, comp, rect.x + rect.w - 8, rect.y + rect.h - 7, chipW, { minSize: 8, minCss: 10 });
    }
    ctx.restore();
  }

  function fusionMultiLayout(v, model, recipes) {
    const scale = v.scale > 0 ? v.scale : 1;
    // 使用邏輯遊戲空間 (900x600) 作為版面基準，不使用可見視口邊界（會在高直屏延伸導致負座標與卡片過小）。
    const LOGICAL_W = 900, LOGICAL_H = 600;
    const n = recipes.length;

    // 多配方面板略高、內框略窄，仍維持單一和紙帳板，不新增 UI 系統。
    const panelW = Math.round(Math.min(760, Math.max(300, LOGICAL_W - 24)));
    // 面板高度以邏輯高度為基準，避免直屏可視高度過大導致面板過高、卡片被擠壓。
    const panelH = Math.round(Math.min(LOGICAL_H - 20, Math.max(560, LOGICAL_H * 0.82)));
    const panelX = Math.round((LOGICAL_W - panelW) / 2);
    const panelY = Math.round((LOGICAL_H - panelH) / 2);
    const panel = { x: panelX, y: panelY, w: panelW, h: panelH };

    const frameX = Math.round(Math.min(34, panelW * 0.055));
    const frameY = Math.round(Math.min(30, panelH * 0.055));
    const inner = {
      x: panelX + frameX,
      y: panelY + frameY,
      w: panelW - frameX * 2,
      h: panelH - frameY * 2,
      left: panelX + frameX,
      top: panelY + frameY,
      right: panelX + panelW - frameX,
      bottom: panelY + panelH - frameY
    };
    const compact = scale < 0.8 || inner.w < 560;
    const minTouch = Math.ceil(44 / scale);
    const headerH = compact ? 28 : 34;
    const summaryH = compact ? 26 : 20;

    const gap = Math.round(Math.max(16, inner.w * 0.05));
    const btnH = Math.max(compact ? minTouch : 48, minTouch);
    const btnW = Math.round(Math.min(220, Math.max(minTouch, (inner.w - gap - 20) / 2)));
    const btnY = Math.round(inner.bottom - btnH - (compact ? 4 : 8));
    const confirmX = Math.round(panelX + (panelW - (btnW * 2 + gap)) / 2);
    const laterX = confirmX + btnW + gap;
    const confirm = { id: "confirm", x: confirmX, y: btnY, w: btnW, h: btnH, label: "融合奧義", tone: "primary", cssW: Math.round(btnW * scale), cssH: Math.round(btnH * scale) };
    const later = { id: "later", x: laterX, y: btnY, w: btnW, h: btnH, label: "稍後再議", tone: "normal", cssW: Math.round(btnW * scale), cssH: Math.round(btnH * scale) };

    const hintH = compact ? 46 : 36;
    // 選定配方報導帶（既有候選真主圖＋效果摘要）：空間不足以保住 44 CSS 卡片時自動讓位。
    const heroHFull = compact ? 58 : 76;
    const topPad = compact ? 6 : 10;
    const areaBottom = btnY - hintH - (compact ? 2 : 4);
    const designFor = (heroH) => {
      const cardTop = inner.y + headerH + summaryH + heroH + topPad;
      const areaH = Math.max(minTouch, areaBottom - cardTop);
      // 以「整張卡至少約 150 CSS 寬」決定欄數：360x800 直屏 277 CSS → 1 欄；
      // 手機橫屏／桌機 → 2 欄。避免手機上 3 欄把每張卡壓成 90 CSS 寬。
      let cols = (inner.w * scale) >= 420 ? 2 : 1;
      let colGap = compact ? 8 : 12;
      let rowGap = compact ? 6 : 10;
      const gridSize = () => {
        const rows = Math.ceil(n / cols);
        const cardW = Math.floor((inner.w - colGap * (cols - 1)) / cols);
        const cardH = Math.floor((areaH - rowGap * (rows - 1)) / rows);
        return { rows, cardW, cardH };
      };
      let g = gridSize();
      // 矮螢幕先嘗試三欄，確保六組候選仍各保有 44 CSS 熱區，而不是壓縮到不可點。
      if (g.cardH < minTouch && inner.w * scale >= 480) { cols = 3; colGap = 6; g = gridSize(); }
      if (g.cardH < minTouch) { rowGap = 4; g = gridSize(); }
      // 卡片高度上限以 CSS 計，並以按鈕區上緣為界：溢出 footer 就壓高（保住 44 CSS 下限）。
      const maxCardH = compact ? 130 : 120;
      const maxFitH = Math.floor((confirm.y - 14 - cardTop - (g.rows - 1) * rowGap) / g.rows);
      const gridCardH = Math.max(minTouch, Math.min(g.cardH, maxFitH));
      const cardH = Math.min(maxCardH, gridCardH);
      const gridH = g.rows * cardH + (g.rows - 1) * rowGap;
      const gridY = cardTop + Math.max(0, Math.floor((areaH - gridH) / 2));
      return { cardTop, areaH, cols, colGap, g, rowGap, cardH, rows: g.rows, gridY, gridH, bottom: gridY + gridH, clear: gridY + gridH <= confirm.y - 12 };
    };
    let ds = designFor(heroHFull);
    let heroH = heroHFull;
    if (!ds.clear && heroH > 0) { heroH = 0; ds = designFor(0); }
    const rowGap = ds.rowGap, colGap = ds.colGap;
    const grid = { rows: ds.rows, cols: ds.cols, cardW: ds.g.cardW, cardH: ds.cardH };
    const cardH = ds.cardH, areaH = ds.areaH, cardTop = ds.cardTop, gridY = ds.gridY;
    const gridH = ds.gridH;

    const cards = recipes.map((recipe, i) => {
      const row = Math.floor(i / grid.cols), col = i % grid.cols;
      const x = Math.round(inner.x + col * (grid.cardW + colGap));
      const y = Math.round(gridY + row * (cardH + rowGap));
      return {
        id: "recipe:" + recipe.id,
        recipeId: recipe.id,
        x, y,
        w: grid.cardW,
        h: cardH,
        index: i,
        recipe,
        cssW: Math.round(grid.cardW * scale),
        cssH: Math.round(cardH * scale)
      };
    });

    const ids = recipes.map(r => r.id);
    let selectedRecipeId = model && model.selectedRecipeId;
    if (!selectedRecipeId || ids.indexOf(selectedRecipeId) < 0) {
      const opened = model && model.recipe && model.recipe.id;
      selectedRecipeId = opened && ids.indexOf(opened) >= 0 ? opened : ids[0];
    }

    const hero = heroH > 0
      ? { x: inner.x, y: inner.y + headerH + summaryH + 2, w: inner.w, h: heroH - (compact ? 2 : 4) }
      : null;

    return {
      panel, inner, confirm, later,
      buttons: [confirm, later, ...cards],
      cards,
      recipes,
      selectedRecipeId,
      confirmIndex: 0,
      laterIndex: 1,
      multi: true,
      scale,
      compact,
      headerH,
      summaryH,
      hero,
      heroH,
      hintH
    };
  }

function fusionLayout(customViewport, model) {
    const v = customViewport || window.VIEWPORT?.get?.() || { scale: 1, width: 900, height: 600, offsetX: 0, offsetY: 0 };
    const recipeList = fusionRecipeList(model);
    if (recipeList.length > 1) return fusionMultiLayout(v, model, recipeList);
    if (recipeList.length === 1 && (!model || !model.recipe)) model = { ...(model || {}), recipe: recipeList[0] };
    const scale = v.scale > 0 ? v.scale : 1;
    // 使用邏輯遊戲空間 (900x600) 作為版面基準，避免直屏可視視口導致負座標。
    const LOGICAL_W = 900, LOGICAL_H = 600;

    // 面板寬高：置中和紙帳板
    const panelW = Math.round(Math.min(740, Math.max(320, LOGICAL_W - 36)));
    const panelH = Math.round(Math.min(500, Math.max(280, LOGICAL_H - 32)));
    const panelX = Math.round((LOGICAL_W - panelW) / 2);
    const panelY = Math.round((LOGICAL_H - panelH) / 2);
    const panel = { x: panelX, y: panelY, w: panelW, h: panelH };

    const frameX = Math.round(Math.min(54, panelW * 0.08));
    const frameY = Math.round(Math.min(51, panelH * 0.10));
    const inner = {
      x: panelX + frameX,
      y: panelY + frameY,
      w: panelW - frameX * 2,
      h: panelH - frameY * 2,
      left: panelX + frameX,
      top: panelY + frameY,
      right: panelX + panelW - frameX,
      bottom: panelY + panelH - frameY
    };

    const compact = scale < 0.8 || inner.w < 560;

    // 按鈕區：置於 inner 底部，真 CSS 熱區嚴格 >= 44 CSS px（保底 Math.ceil(44 / scale)）
    const minBtnH = Math.ceil(44 / scale);
    const btnH = Math.max(compact ? minBtnH : 48, minBtnH);
    const minBtnW = Math.ceil(44 / scale);
    const gap = Math.round(Math.max(16, inner.w * 0.05));
    const btnW = Math.round(Math.min(220, Math.max(minBtnW, (inner.w - gap - 20) / 2)));
    const btnY = Math.round(inner.bottom - btnH - (compact ? 4 : 8));
    const totalBtnsW = btnW * 2 + gap;
    const confirmX = Math.round(panelX + (panelW - totalBtnsW) / 2);
    const laterX = confirmX + btnW + gap;

    const confirm = { id: "confirm", x: confirmX, y: btnY, w: btnW, h: btnH, label: "融合奧義", tone: "primary", cssW: Math.round(btnW * scale), cssH: Math.round(btnH * scale) };
    const later = { id: "later", x: laterX, y: btnY, w: btnW, h: btnH, label: "稍後再議", tone: "normal", cssW: Math.round(btnW * scale), cssH: Math.round(btnH * scale) };

    return {
      panel,
      inner,
      confirm,
      later,
      buttons: [confirm, later],
      scale,
      compact
    };
  }

  // 多配方：同一 buttons 陣列＝所見即所點；UI 只回傳 layout，不寫 WL。
  function drawFusionRecipeCard(ctx, card, model, compact, focused, selected, artRoom) {
    const recipe = card.recipe || {};
    const id = card.recipeId;
    const meta = CARD_SHORT[id] || {};
    const parents = fusionParents(recipe);
    const name = recipe.name || meta.ja || id;
    const desc = meta.s || recipe.short || recipe.desc || "";
    const comp = fusionCompensationLabel(recipe, model);
    const x = card.x, y = card.y, w = card.w, h = card.h;
    const bodyPx = fontPx(readableFont(compact ? 9 : 11, "600"));

    ctx.save();
    ctx.textBaseline = "alphabetic";
    drawRitualCard(ctx, x, y, w, h, {dark: true, selected, focused});

    // 右上：既有候選真主圖縮呈（本機 DEV）
    let artRight = 0;
    if (artRoom && h >= 40) {
      const th = Math.max(16, Math.min(Math.round(h * .38), 24));
      const tw = Math.round(th * 1.55);
      const drawn = drawFusionCandidateArt(ctx, id, x + w - tw - 7, y + 4, tw, th, .92);
      if (drawn) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(230,198,141,.4)";
        ctx.strokeRect(x + w - tw - 7, y + 4, tw, th);
        artRight = tw + 11;
      }
    }

    // 1. 頂部：奧義名稱與狀態標籤
    const nameBase = y + Math.round(bodyPx * 0.9) + 3;
    const showBadge = selected && w >= 220;
    ctx.textAlign = "left";
    ctx.font = readableFont(compact ? 12 : 14, "900");
    ctx.fillStyle = selected ? "#fff1d9" : "#f2e4c8";
    const nameMaxW = Math.max(40, x + w - 8 - (x + 10) - (showBadge ? 46 : 0) - artRight);
    fitText(ctx, name, x + 10, nameBase, nameMaxW, { minSize: 8, minCss: 11 });

    if (showBadge) {
      ctx.textAlign = "right";
      ctx.font = readableFont(compact ? 9 : 11, "900");
      ctx.fillStyle = "#ffd54f";
      ctx.fillText("選定", x + w - 8, nameBase);
    }

    // 2. 中間：置中母技圖示與雙 Lv.5 條件標章（清晰自上而下排版）
    const p1Name = CARD_SHORT[parents[0]]?.ja || FUSION_PARENT_NAMES[parents[0]] || parents[0];
    const p2Name = CARD_SHORT[parents[1]]?.ja || FUSION_PARENT_NAMES[parents[1]] || parents[1];
    const reqText = `${p1Name} Lv.5 ＋ ${p2Name} Lv.5`;
    const reqY = y + Math.round(h * 0.38);
    const reqBoxH = Math.min(22, Math.max(16, Math.round(h * 0.22)));
    const reqBoxW = Math.min(w - 20, Math.max(160, Math.round(w * 0.82)));
    const reqBoxX = x + (w - reqBoxW) / 2;

    ctx.fillStyle = selected ? "rgba(48, 34, 26, 0.88)" : "rgba(36, 28, 26, 0.82)";
    ctx.beginPath();
    ctx.roundRect(reqBoxX, reqY - reqBoxH / 2, reqBoxW, reqBoxH, 4);
    ctx.fill();
    ctx.strokeStyle = selected ? "rgba(255, 213, 79, 0.55)" : "rgba(214, 177, 118, 0.35)";
    ctx.lineWidth = 1;
    ctx.stroke();

    const emR = Math.min(8, Math.max(6, Math.round(reqBoxH * 0.34)));
    if (!drawScrollCardArt(ctx, parents[0], reqBoxX + emR + 6, reqY, emR, { background: false }))
      drawEmblem(ctx, parents[0], reqBoxX + emR + 6, reqY, emR);
    if (!drawScrollCardArt(ctx, parents[1], reqBoxX + reqBoxW - emR - 6, reqY, emR, { background: false }))
      drawEmblem(ctx, parents[1], reqBoxX + reqBoxW - emR - 6, reqY, emR);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = readableFont(compact ? 9 : 11, "800");
    ctx.fillStyle = selected ? "#ffe28b" : "#e8d6b5";
    fitText(ctx, reqText, x + w / 2, reqY, reqBoxW - (emR * 2 + 16), { minSize: 8, minCss: 10 });

    // 3. 下方：高對比效果說明與補償章
    ctx.textBaseline = "alphabetic";
    const nameSize = fontPx(readableFont(compact ? 12 : 14, "900"));
    let descFont = readableFont(compact ? 9 : 11, "600");
    let compFont = readableFont(compact ? 8 : 10, "700");
    let descSize = fontPx(descFont);
    let compSize = fontPx(compFont);

    let sentenceBase = reqY + Math.round(reqBoxH / 2) + descSize + 2;
    let compBase = y + h - 5;
    const topOf = (base, size) => base - size * 0.8;
    const botOf = (base, size) => base + size * 0.2;
    const cardBot = y + h - 1;

    const collides = topOf(sentenceBase, descSize) < reqY + reqBoxH / 2 + 0.5
      || botOf(sentenceBase, descSize) > topOf(compBase, compSize) + 0.01
      || botOf(compBase, compSize) > cardBot + 0.01;

    let descFit = {
      minSize: 8, minCss: 10.5, wrap: true,
      maxH: Math.max(0, compBase - sentenceBase - 4)
    };
    let compFit = { minSize: 8, minCss: 10 };

    if (collides) {
      const gap = 2;
      const room = Math.max(14, cardBot - (reqY + reqBoxH / 2) - gap * 2);
      const fitted = Math.max(8, Math.floor((room / 2) * 10) / 10);
      descSize = Math.min(descSize, fitted);
      compSize = Math.min(compSize, fitted);
      descFont = descFont.replace(/([\d.]+)px/, `${descSize}px`);
      compFont = compFont.replace(/([\d.]+)px/, `${compSize}px`);
      sentenceBase = reqY + reqBoxH / 2 + gap + descSize * 0.8;
      compBase = botOf(sentenceBase, descSize) + gap + compSize * 0.8;
      if (botOf(compBase, compSize) > cardBot) {
        compBase = cardBot - compSize * 0.2;
        sentenceBase = topOf(compBase, compSize) - gap - descSize * 0.2;
      }
      descFit = { minSize: 8, minCss: 1, wrap: false };
      compFit = { minSize: 8, minCss: 1 };
    }

    ctx.textAlign = "left";
    ctx.font = descFont;
    ctx.fillStyle = selected ? "#ffe8b0" : "#efe2c8";
    fitText(ctx, desc, x + 10, sentenceBase, w - 20 - artRight, descFit);

    ctx.font = compFont;
    ctx.fillStyle = "#e9c97e";
    fitText(ctx, comp, x + 10, compBase, w - 20, compFit);
    ctx.restore();
  }

  function drawFusionMulti(ctx, model, focus, inputMode) {
    const m = model || {};
    const L = fusionLayout(null, m);
    const { panel, inner, confirm, later, compact } = L;
    const cx = panel.x + panel.w / 2;

    ctx.save();
    ctx.fillStyle = "rgba(10, 10, 16, 0.82)";
    fillScreen(ctx);
    drawCollectionBoard(ctx, panel.x, panel.y, panel.w, panel.h);

    // 1) 標題帶：主標＋副標＋朱印落款
    const headerH = L.headerH;
    const headerY = inner.y + 2;
    drawRitualHeader(ctx, inner.x + 8, headerY, inner.w - 16, headerH,
      "【 奧 義 融 合 】", compact ? "" : "兩 技 歸 一 ・ 母 技 合 流 成 新 奧 義", "融", compact);

    // 2) 欄位摘要
    const slotBefore = typeof m.slotBefore === "number" ? m.slotBefore : 4;
    const slotAfter = typeof m.slotAfter === "number" ? m.slotAfter : Math.max(1, slotBefore - 1);
    const released = Math.max(0, slotBefore - slotAfter);
    ctx.fillStyle = "#2b4557";
    ctx.font = readableFont(compact ? 10 : 12, "800");
    fitText(
      ctx,
      `可選合武 ${L.cards.length} 式 · 主動 ${slotBefore} ➔ ${slotAfter}${released > 0 ? `（釋出 ${released} 槽）` : ""}`,
      cx,
      inner.y + headerH + L.summaryH - 4,
      inner.w - 24,
      { minSize: 9, minCss: 11 }
    );

    // 3) 選定配方報導帶：既有候選真主圖＋母技來源＋效果摘要＋補償章
    const selected = L.recipes.find(r => r && r.id === L.selectedRecipeId) || L.recipes[0] || null;
    if (L.hero && selected) drawFusionHeroPanel(ctx, L.hero, selected, m, compact, { showDescription: false });

    // 焦點索引＝buttons 索引；0/1 永遠是 confirm/later，recipe 卡自 2 起。
    const focusBtn = Number.isInteger(focus) && focus >= 0 && focus < L.buttons.length ? L.buttons[focus] : null;
    L.cards.forEach((card) => {
      drawFusionRecipeCard(ctx, card, m, compact, focusBtn === card, card.recipeId === L.selectedRecipeId, !L.hero);
    });
    const lastBottom = L.cards.reduce((max, card) => Math.max(max, card.y + card.h), 0);
    const clearsCards = (baseline, font) => baseline - fontPx(font) * 0.8 >= lastBottom + 1;
    if (false && !L.hero && selected) {
      // 矮螢幕 hero 讓位後，重複選定句只在最後一列卡之下還有空檔時才畫。
      const selMeta = CARD_SHORT[selected.id] || {};
      const selDesc = selMeta.s || selected.short || selected.desc || "";
      const infoFont = readableFont(compact ? 8 : 10, "600");
      if (selDesc) {
        const ruleBase2 = L.confirm.y - 6 - fontPx(readableFont(compact ? 9 : 11, "700")) - 2;
        const yInfo = ruleBase2 - 13;
        if (clearsCards(yInfo, infoFont)) {
          ctx.textAlign = "center";
          ctx.font = infoFont;
          ctx.fillStyle = "#2d4152";
          fitText(ctx, `選定：${selDesc}`, cx, yInfo, inner.w - 24, { minSize: 8, minCss: 10 });
        }
      }
    }

    // 4) 操作提示與來源變異補償規則。字形會壓到最後一列卡時不畫。
    const hintBase = confirm.y - 6;
    const ruleBase = hintBase - fontPx(readableFont(compact ? 9 : 11, "700")) - 2;
    const hintText = inputMode === "gamepad"
      ? "〔方向〕選合武　〔A〕融合　〔B〕稍後"
      : inputMode === "touch"
        ? "點選合武卡後按「融合奧義」"
        : "〔←→↑↓〕選合武　〔Enter〕融合　〔Esc〕稍後";
    const hintFont = readableFont(compact ? 9 : 11, "600");
    const ruleFont = readableFont(compact ? 8 : 10, "700");
    if (clearsCards(hintBase, hintFont)) {
      ctx.textAlign = "center";
      ctx.fillStyle = "#354955";
      ctx.font = hintFont;
      fitText(ctx, hintText, cx, hintBase, inner.w - 24, { minSize: 9, minCss: 11 });
    }
    if (clearsCards(ruleBase, ruleFont)) {
      ctx.textAlign = "center";
      ctx.fillStyle = "#723b2f";
      ctx.font = ruleFont;
      fitText(ctx, "雙母技 MAX 歸一、釋放 1 槽 · 來源有變異時補 1 次免費非變異", cx, ruleBase, inner.w - 24, { minSize: 8, minCss: 10 });
    }

    drawButton(ctx, confirm, confirm.label, { tone: confirm.tone, size: compact ? 15 : 18, focus: focusBtn === confirm, fit: true, fitMin: cssPx(11) });
    drawButton(ctx, later, later.label, { tone: later.tone, size: compact ? 15 : 18, focus: focusBtn === later, fit: true, fitMin: cssPx(11) });
    if (focusBtn === confirm) drawMenuFocus(ctx, confirm, false);
    if (focusBtn === later) drawMenuFocus(ctx, later, false);

    ctx.restore();
    return L;
  }

  function drawFusion(ctx, model = {}, focus = 0, inputMode = "keyboard") {
    const recipeList = fusionRecipeList(model);
    if (recipeList.length > 1) return drawFusionMulti(ctx, model, focus, inputMode);
    if (recipeList.length === 1 && (!model || !model.recipe)) model = { ...(model || {}), recipe: recipeList[0] };
    ctx.save();
    ctx.fillStyle = "rgba(10, 10, 16, 0.82)";
    fillScreen(ctx);

    const L = fusionLayout(null, model);
    const { panel, inner, confirm, later, compact } = L;
    const cx = panel.x + panel.w / 2;

    // 1. 和紙帳底板
    drawCollectionBoard(ctx, panel.x, panel.y, panel.w, panel.h);

    // 2. 標題帶：主標＋副標＋朱印
    const headerH = compact ? 40 : 46;
    drawRitualHeader(ctx, inner.x + 8, inner.y + 2, inner.w - 16, headerH,
      "【 奧 義 融 合 】", "兩 技 歸 一 ・ 母 技 合 流 成 新 奧 義", "融", compact);

    // 3. 模型解析
    const m = model || {};
    const recipe = m.recipe || { id: "fusion_inkblade", name: "奧義・墨焰斬", parents: ["katana", "fire"] };
    const parents = fusionParents(recipe);
    const parent1 = parents[0] || "katana";
    const parent2 = parents[1] || "fire";
    const p1Name = CARD_SHORT[parent1]?.ja || FUSION_PARENT_NAMES[parent1] || parent1;
    const p2Name = CARD_SHORT[parent2]?.ja || FUSION_PARENT_NAMES[parent2] || parent2;
    const fusionName = recipe.name || CARD_SHORT[recipe.id]?.ja || (recipe.id === "fusion_thundercircle" ? "奧義・雷陣封界" : "奧義・墨焰斬");

    // 4. 融合家紋示意（母技1 + 母技2 ➔ 合技）
    const emblemSectionY = inner.y + headerH + (compact ? 26 : 36);
    const pR = compact ? 20 : 26;
    const fR = compact ? 26 : 34;

    const p1X = compact ? cx - 110 : cx - 160;
    const p2X = compact ? cx - 35 : cx - 50;
    const plusX = (p1X + p2X) / 2;
    const fX = compact ? cx + 80 : cx + 120;
    const arrowX = (p2X + fX) / 2;

    drawScrollCardArt(ctx, parent1, p1X, emblemSectionY, pR, { dark: true })
      || drawEmblem(ctx, parent1, p1X, emblemSectionY, pR);
    ctx.font = readableFont(compact ? 11 : 13, "700");
    ctx.fillStyle = "#273c4b";
    ctx.textAlign = "center";
    ctx.fillText(`${p1Name} (MAX)`, p1X, emblemSectionY + pR + (compact ? 13 : 16));

    ctx.font = readableFont(compact ? 16 : 22, "900");
    ctx.fillStyle = "#8c4036";
    ctx.fillText("＋", plusX, emblemSectionY + 6);

    drawScrollCardArt(ctx, parent2, p2X, emblemSectionY, pR, { dark: true })
      || drawEmblem(ctx, parent2, p2X, emblemSectionY, pR);
    ctx.font = readableFont(compact ? 11 : 13, "700");
    ctx.fillStyle = "#273c4b";
    ctx.fillText(`${p2Name} (MAX)`, p2X, emblemSectionY + pR + (compact ? 13 : 16));

    ctx.font = readableFont(compact ? 18 : 24, "900");
    ctx.fillStyle = "#8c4036";
    ctx.fillText("➔", arrowX, emblemSectionY + 7);

    drawFusionIcon(ctx, recipe.id, fX, emblemSectionY, fR);
    ctx.font = readableFont(compact ? 13 : 16, "900");
    ctx.fillStyle = "#172f45";
    ctx.fillText(fusionName, fX, emblemSectionY + fR + (compact ? 15 : 19));

    // 5. 欄位變動摘要（效果摘要改至主圖報導帶）
    const slotBefore = typeof m.slotBefore === "number" ? m.slotBefore : 4;
    const slotAfter = typeof m.slotAfter === "number" ? m.slotAfter : 3;
    const released = Math.max(0, slotBefore - slotAfter);

    const infoY = emblemSectionY + pR + (compact ? 22 : 30);
    const infoBoxH = compact ? 26 : 30;
    ctx.fillStyle = "rgba(35, 25, 22, 0.85)";
    ctx.beginPath();
    ctx.roundRect(inner.x + 12, infoY, inner.w - 24, infoBoxH, 6);
    ctx.fill();
    ctx.strokeStyle = "rgba(196, 158, 112, 0.4)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.fillStyle = "#aed2c7";
    ctx.font = readableFont(compact ? 12 : 14, "900");
    const slotText = `主動招式欄位：${slotBefore} ➔ ${slotAfter}${released > 0 ? `（釋出 ${released} 個主動槽位，可再修習新妖術！）` : ""}`;
    ctx.fillText(slotText, cx, infoY + infoBoxH / 2 + (compact ? 4 : 5));

    // 6./7. 候選主圖報導帶 → 吸收變異與補償提示 → 操作提示（footer 由下往上排）
    const ruleY = confirm.y - 8;
    const hintY = ruleY - (compact ? 13 : 16);
    const footerTop = hintY - (compact ? 9 : 12);
    const mutIds = Array.isArray(m.sourceMutationIds) ? m.sourceMutationIds : [];
    const mutShown = mutIds.length > 0 || !!m.compensationText;
    const compBoxH = compact ? 32 : 38;
    const infoBottom = infoY + infoBoxH + (compact ? 4 : 6);
    const heroMinH = compact ? 40 : 52;
    let contentY = infoBottom;
    let heroRect = null;
    const compTopLimit = footerTop - (mutShown ? compBoxH + (compact ? 4 : 6) : 0);
    const heroAvail = compTopLimit - contentY;
    if (heroAvail >= heroMinH) {
      heroRect = { x: inner.x + 12, y: contentY, w: inner.w - 24, h: Math.min(compact ? 56 : 68, heroAvail) };
      contentY += heroRect.h + (compact ? 4 : 6);
    }
    if (heroRect) drawFusionHeroPanel(ctx, heroRect, recipe, m, compact, { chip: false });

    if (mutShown) {
      ctx.fillStyle = "rgba(42, 38, 28, 0.9)";
      ctx.beginPath();
      ctx.roundRect(inner.x + 12, contentY, inner.w - 24, compBoxH, 4);
      ctx.fill();
      ctx.strokeStyle = "rgba(230, 198, 110, 0.5)";
      ctx.stroke();

      const mutNames = mutIds.map(id => CARD_SHORT[id]?.ja || id).join("、");
      const compMsg = m.compensationText || (mutIds.length > 0 ? `來源變異化為靈息（${mutNames}）：融合後補償 1 次免費非變異強化選擇` : "");

      ctx.textAlign = "center";
      ctx.fillStyle = "#ffe28b";
      ctx.font = readableFont(compact ? 11 : 12, "800");
      fitText(ctx, `★ ${compMsg}`, inner.x + 12 + (inner.w - 24) / 2, contentY + compBoxH / 2 + 4, inner.w - 32, { minSize: 10, wrap: false });
    }

    // 8. 規則說明與操作指引
    if (inputMode === "gamepad") {
      ctx.fillStyle = "#2d4152";
      ctx.font = readableFont(11, "700");
      ctx.fillText("〔A〕決定　〔B〕稍後", cx, hintY);
    } else if (inputMode === "keyboard") {
      ctx.fillStyle = "#354955";
      ctx.font = readableFont(10, "500");
      ctx.fillText("〔Enter / 空白鍵〕決定　〔Esc〕稍後", cx, hintY);
    }

    ctx.textAlign = "center";
    ctx.fillStyle = "#354955";
    ctx.font = readableFont(compact ? 10 : 12, "500");
    const ruleDisclaimer = m.ruleText || "稍後再議不扣繪馬 · 兩母技融合後退場，釋放 1 槽";
    fitText(ctx, ruleDisclaimer, cx, ruleY, inner.w - 24, { minSize: 9, wrap: false });

    // 9. 確定與稍後按鈕
    drawButton(ctx, confirm, confirm.label, {
      tone: confirm.tone,
      size: compact ? 15 : 18,
      focus: focus === 0
    });
    drawButton(ctx, later, later.label, {
      tone: later.tone,
      size: compact ? 15 : 18,
      focus: focus === 1
    });
    drawMenuFocus(ctx, focus === 0 ? confirm : focus === 1 ? later : null, false);

    ctx.restore();
    return L;
  }

  // 5. 系統圖鑑（秘術卡片一覽 ＆ 百鬼單字卷）
  const CARD_LIST = [
    // 主動秘術 (Active Weapons)
    { name: "妖刀斬", jp: "かたな", type: "主動", desc: "揮出凌厲新月刀芒，斬裂前方扇形妖怪", emblem: "katana" },
    { name: "淨化靈陣", jp: "じょうか", type: "主動", desc: "Lv4 解圍；MAX 範圍縮為 220、每 3.2 秒脈衝，留下 1.8 秒固定慢場，不回油", emblem: "barrier" },
    { name: "狐火炎", jp: "きつねび", type: "主動", desc: "三階起三團護火；Lv4 一火追擊，MAX 每六秒召龍，焦土最多兩處且不疊傷", emblem: "fire" },
    { name: "陰陽符", jp: "おふだ", type: "主動", desc: "命中後黏在妖怪身上，延遲爆炸並向周圍濺射", emblem: "boom" },
    { name: "天狐雷", jp: "いかずち", type: "主動", desc: "固定傷害優先打近身威脅；Lv4 三目標，MAX 三朵雷雲，同波同敵只中一次", emblem: "thunder" },
    { name: "天狐靈針", jp: "せんぼん", type: "主動", desc: "向面朝方向連續迸射破魔靈針，貫通前方妖怪", emblem: "needle" },

    // 被動修行 (Passive Enhancements)
    { name: "金剛結界", jp: "けっかい", type: "被動", desc: "召喚金剛勾玉護盾，抵擋 2 次受傷（可疊加）", emblem: "shield" },
    { name: "長明燈油", jp: "あぶら", type: "被動", desc: "燈油上限 +30 並立即補滿，且常駐每秒回油", emblem: "oil_max" },
    { name: "添燈香油", jp: "かいふく", type: "被動", desc: "恢復 50% 燈油，並震退周圍妖怪（每場最多 3 次）", emblem: "oil_heal" },
    { name: "修羅破軍", jp: "こうげき", type: "被動", desc: "整體傷害係數 +0.30（最多 4 層）", emblem: "dmg" },
    { name: "神樂疾奏", jp: "れんぞく", type: "被動", desc: "妖刀、結界、靈針冷卻縮短", emblem: "rate" },
    { name: "心眼一閃", jp: "かいしん", type: "被動", desc: "妖刀/天雷暴擊率 +15%，結界 +10%", emblem: "crit" },
    { name: "神足草履", jp: "いどう", type: "被動", desc: "每層移動速度 +35", emblem: "spd" },
    { name: "縮地瞬步", jp: "ダッシュ", type: "被動", desc: "衝刺冷卻大幅縮短，衝刺附加無敵突進", emblem: "dash" },
    { name: "招財勾玉", jp: "じしゃく", type: "被動", desc: "靈玉吸取範圍 +80", emblem: "mag" }
  ];

  // P1-MUTATION-CARDS：圖鑑的變異／御守／合武條目由同一 CARD_SHORT 來源生成（非人工塞卡）。
  // emblem = id、desc = 短句，因此圖鑑三種版面與升級選卡永遠同一句、同一示意圖。
  Object.keys(CARD_SHORT).forEach((id) => {
    const v = CARD_SHORT[id];
    const isFusion = id.indexOf("fusion_") === 0;
    const baseType = id.indexOf("charm_") === 0 ? "御守" : (isFusion ? "合武" : "變異");
    const state = v.st === "pending_impl" ? "待實裝" : (v.st === "pending_tech" ? "技術待驗／候選特效未核准" : "");
    const type = isFusion && state ? `${baseType}・${state}` : baseType;
    CARD_LIST.push({ name: v.ja, jp: "", type, desc: v.s, emblem: id, status: v.st || "ready" });
  });

  // 三頁共用現有核准木框/和紙/紅流蘇 raster，不以白底或幾何重畫主面板。
  function drawCollectionBoard(ctx, x, y, w, h) {
    const art = illustratedArt.notice;
    if (!art?.naturalWidth) return false;
    drawWashiSlices(ctx, art, x, y, w, h, 40, 42, Math.min(24, w * .1), Math.min(22, h * .16));
    return true;
  }
  let secretDetail = null;
  const codexRows = () => (window.VIEWPORT?.get().scale || 1) < .8 ? 4 : 6;
  function selectSecretDetail(index = null) {
    secretDetail = index == null ? null : Number.isInteger(+index) && CARD_LIST[+index] ? +index : null;
  }
  function secretEntryButtons(page) {
    const count = codexRows(), rows = count / 2, gap = 12, w = 404, h = (372 - gap * (rows - 1)) / rows;
    return CARD_LIST.slice(page * count, (page + 1) * count).map((card, i) => ({
      id: `secret:${page * count + i}`, x: 40 + i % 2 * (w + gap), y: 122 + Math.floor(i / 2) * (h + gap), w, h
    }));
  }
  function drawSecretCodex(ctx, page, focus) {
    if (secretDetail != null && CARD_LIST[secretDetail]) {
      const c = CARD_LIST[secretDetail], short = cardShort(c.emblem, c.name);
      drawCollectionBoard(ctx, 40, 122, 820, 372);
      ctx.textAlign = "left"; ctx.fillStyle = "#172f45"; ctx.font = readableFont(24, "900");
      fitText(ctx, c.name, 74, 165, 740, {minSize:18, minCss:14});
      ctx.font = readableFont(16, "800"); ctx.fillStyle = "#803c32";
      fitText(ctx, c.type.split("・")[0] + (c.jp ? " · " + c.jp : ""), 74, 198, 700, {minSize:14});
      const image = getUiFusionArt(c.emblem, "icon") || illustratedSkills[c.emblem];
      if (image?.naturalWidth) {
        const s = Math.min(125 / image.naturalWidth, 125 / image.naturalHeight);
        ctx.drawImage(image, 696 + (125 - image.naturalWidth * s) / 2, 230, image.naturalWidth * s, image.naturalHeight * s);
      }
      ctx.font = readableFont(18, "700"); ctx.fillStyle = "#302b25";
      const text = c.desc || short?.s || "效果說明待補";
      const lines = []; let line = "";
      for (const ch of text) {
        if (line && ctx.measureText(line + ch).width > 580) { lines.push(line); line = ch; } else line += ch;
      }
      if (line) lines.push(line);
      lines.slice(0, 6).forEach((text, i) => ctx.fillText(text, 74, 242 + i * 32, 580));
      return;
    }
    secretEntryButtons(page).forEach((b, i) => {
      const c = CARD_LIST[page * codexRows() + i], short = cardShort(c.emblem, c.name);
      drawCollectionBoard(ctx, b.x, b.y, b.w, b.h);
      ctx.textAlign = "left"; ctx.fillStyle = "#172f45"; ctx.font = readableFont(20, "900");
      fitText(ctx, c.name, b.x + 22, b.y + 34, b.w - 44, {minSize:15,minCss:13});
      ctx.fillStyle = "#803c32"; ctx.font = readableFont(14, "800");
      ctx.fillText(c.type.split("・")[0], b.x + 22, b.y + 59, b.w - 44);
      ctx.fillStyle = "#302b25"; ctx.font = readableFont(16, "700");
      fitText(ctx, short?.s || c.desc, b.x + 22, b.y + b.h - 22, b.w - 44, {minSize:13,minCss:12});
      if (focus === b.id) drawMenuFocus(ctx, b);
    });
  }
  function wordGalleryViewport() {
    const view = window.VIEWPORT?.get?.() || { width: 900, height: 600, scale: 1, offsetX: 0, offsetY: 0 };
    const scale = view.scale > 0 ? view.scale : 1;
    const offsetY = view.offsetY || 0;
    const tabReach = Math.max(0, (44 / scale - 32) / 2);
    const chrome = Math.max(96, 88 + tabReach + offsetY - 4);
    return {
      scale,
      width: view.width > 0 ? view.width : 900,
      height: Math.max(160, (view.height > 0 ? view.height : 600) - chrome),
      offsetX: view.offsetX || 0,
      offsetY: offsetY - chrome
    };
  }
  function wordGallery() {
    const content = window.CONTENT;
    const words = content && typeof content.getAllWords === "function" ? content.getAllWords() : [];
    const catalogs = {
      stages: Object.values(content && content.STAGES || {}).map(stage => ({ id: stage.id, name: stage.name })),
      packs: Object.values(content && content.WORD_PACKS || {}).map(pack => ({ id: pack.id, name: pack.name, sub: pack.sub || "" }))
    };
    let source = { key: null, marks: Object.create(null) };
    const api = window.CARD_DELIVERY;
    if (api && typeof api.openCards === "function") {
      try {
        const bag = api.openCards(window.localStorage, window.location);
        const snap = typeof bag.snapshot === "function" ? bag.snapshot() : null;
        source = { key: typeof bag.key === "string" ? bag.key : null, marks: snap && snap.marks || Object.create(null) };
      } catch { /* 讀不到配送印記就保持 0，熟練度不能補上 */ }
    }
    const gallery = window.CARD_GALLERY;
    const view = gallery && typeof gallery.project === "function" ? gallery.project(words, source, catalogs) : { cards: [] };
    const sets = window.CARD_COLLECTION && typeof window.CARD_COLLECTION.completeSets === "function"
      ? window.CARD_COLLECTION.completeSets(Object.values(content && content.WORD_PACKS || {}), source.marks)
      : [];
    const done = sets.filter(set => set.complete).length;
    const focus = sets.find(set => set.complete) || sets.find(set => set.total && !set.complete);
    const packLine = sets.length
      ? `收藏 ${done}/${sets.length}${focus ? "・" + focus.name + " " + focus.full + "/" + focus.total : ""}`
      : "";
    return { catalogs, source, cards: view.cards || [], packLine };
  }
  // 圖鑑分頁籤：底邊固定在 y=88，44 CSS 不足時往上長，不壓到下方卡片內容。
  // 桌機（scale>=1）數值與原本 160x32 @ y=56 完全相同。
  function codexTabButtons() {
    const h = Math.max(32, cssPx(MIN_TOUCH_CSS));
    const y = 88 - h;
    const w = Math.max(160, textWorldWidth("秘術卡片", MIN_LABEL_CSS) + cssPx(56));
    return [
      { id: "cards", x: Math.round(W / 2 - 8 - w), y, w, h },
      { id: "words", x: Math.round(W / 2 + 8), y, w, h }
    ];
  }
  function wordCodexButtons(state) {
    const pack = wordGallery();
    const drawn = window.CARD_GALLERY_UI.draw(
      { save() {}, restore() {}, fillText() {} },
      pack.cards,
      state || { filter: { by: "all", id: null }, page: 0 },
      { paper: illustratedArt.neutral, drawCardPanel() {}, drawRibbonSlices() {}, drawWoodTag() {}, drawButton() {}, readableFont },
      wordGalleryViewport(),
      pack.catalogs
    );
    return codexTabButtons().map(b => ({ ...b })).concat(drawn.buttons.filter(button => !String(button.id).startsWith("card:")));
  }
  function codexButtons(tab, page, wordCount, galleryState) {
    if (tab === "words" && window.CARD_GALLERY_UI && typeof window.CARD_GALLERY_UI.draw === "function") {
      return wordCodexButtons(galleryState || { filter: { by: "all", id: null }, page: page || 0 });
    }
    const pages = Math.ceil((tab==='cards'?CARD_LIST.length:wordCount)/(tab==='cards'?codexRows():15));
    const h = Math.max(44, cssPx(MIN_TOUCH_CSS));
    if (tab === 'cards' && secretDetail != null) return [...codexTabButtons(),
      {id:'secret-back',x:330,y:520,w:240,h}];
    return [...codexTabButtons(),
      {id:'prev',x:40,y:520,w:160,h,disabled:page<=0},{id:'next',x:700,y:520,w:160,h,disabled:page>=pages-1},
      {id:'back',x:330,y:520,w:240,h}, ...(tab === 'cards' ? secretEntryButtons(page) : [])];
  }
  function drawCodex(ctx, STORE, ALL, tab = "cards", page = 0, maskReadings = false, focus = tab, galleryState = null) {
    ctx.save();
    ctx.fillStyle = "rgba(10, 14, 26, 0.96)";
    fillScreen(ctx);

    const isCards = tab === "cards";
    const buttons = codexButtons(tab, page, ALL.length, galleryState || { filter: { by: "all", id: null }, page });

    // 1. 頂部大標題
    ctx.textAlign = "center";
    ctx.font = titleFont(28);
    ctx.fillStyle = "#ffe28b";
    ctx.shadowColor = "rgba(255, 215, 100, 0.5)";
    ctx.shadowBlur = 10;
    ctx.fillText(isCards ? "秘術卡片" : "單字圖鑑", W / 2, 40);
    ctx.shadowBlur = 0;

    // 2. 雙標籤頁切換按鈕
    const [tabCards, tabWords] = codexTabButtons();
    const tabW = tabCards.w, tabH = tabCards.h, tabY = tabCards.y;
    const tabCardsX = tabCards.x, tabWordsX = tabWords.x;

    // 🎴 秘術卡片一覽 標籤
    glassBox(ctx, tabCardsX, tabY, tabW, tabH, 8, isCards ? "rgba(38, 52, 84, 0.95)" : "rgba(18, 22, 38, 0.75)", isCards ? "#ffd54f" : "rgba(212, 175, 55, 0.4)", isCards ? 2 : 1.2);
    ctx.textAlign = "center";
    ctx.fillStyle = isCards ? "#ffe28b" : "rgba(255, 235, 180, 0.65)";
    ctx.font = readableFont(13, "900");
    drawActionIcon(ctx,'cards',tabCardsX+22,tabY+tabH/2-1,9);
    ctx.fillText("秘術卡片", tabCardsX + tabW / 2 + 12, tabY + tabH/2 + 4);

    // 📜 百鬼單字卷 標籤
    const isWords = !isCards;
    glassBox(ctx, tabWordsX, tabY, tabW, tabH, 8, isWords ? "rgba(38, 52, 84, 0.95)" : "rgba(18, 22, 38, 0.75)", isWords ? "#ffd54f" : "rgba(212, 175, 55, 0.4)", isWords ? 2 : 1.2);
    ctx.fillStyle = isWords ? "#ffe28b" : "rgba(255, 235, 180, 0.65)";
    ctx.font = readableFont(13, "900");
    drawActionIcon(ctx,'codex',tabWordsX+22,tabY+tabH/2-1,9);
    ctx.fillText("單字圖鑑", tabWordsX + tabW / 2 + 12, tabY + tabH/2 + 4);

    if (isCards) {
      drawSecretCodex(ctx, page, focus);
    } else if (window.CARD_GALLERY_UI && typeof window.CARD_GALLERY_UI.draw === "function") {
      const pack = wordGallery();
      window.CARD_GALLERY_UI.draw(ctx, pack.cards, Object.assign({ packLine: pack.packLine }, galleryState || { filter: { by: "all", id: null }, page }), {
        paper: illustratedArt.neutral,
        drawCardPanel: (c, b) => drawCollectionBoard(c, b.x, b.y, b.w, b.h),
        drawRibbonSlices,
        drawWoodTag,
        drawButton,
        readableFont
      }, wordGalleryViewport(), pack.catalogs);
    } else {
      ctx.textAlign = "center";
      ctx.fillStyle = "#24180f";
      ctx.font = readableFont(16, "900");
      ctx.fillText("言靈圖鑑未載入", W / 2, 180);
    }

    if (isCards) for(const b of buttons.filter(b=>['prev','next','back','secret-back'].includes(b.id))) drawButton(ctx,b,b.id==='prev'?'上一頁':b.id==='next'?'下一頁':b.id==='secret-back'?'返回秘術一覽':'返回',{size:16,disabled:b.disabled,focus:focus===b.id});
    const tabButton=buttons.find(b=>b.id===focus);
    if(tabButton && ['cards','words'].includes(focus))drawMenuFocus(ctx,tabButton);
    if(isCards && secretDetail == null){ctx.textAlign='center';ctx.font=readableFont(13,'700');ctx.fillStyle='#ead8b5';ctx.fillText(`點選條目查看詳情　${page+1}/${Math.ceil(CARD_LIST.length/codexRows())}`,W/2,510);}

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

    const cardX = 210, cardY = 54, cardW = 652, cardH = 430;
    const mid = cardX + cardW / 2;
    drawWashiBoard(ctx,cardX,cardY,cardW,cardH,true);
    // 朱紅題籤以手繪底圖呈現，標題文字仍由程式渲染。
    drawWoodTag(ctx,{x:mid-139,y:cardY+12,w:278,h:58},"primary");
    ctx.textAlign = "center";
    // 木框旅帳標題保留清晰描墨，不增加漂浮光環。
    ctx.font = titleFont(32);
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillText(isWon ? "夜已破曉" : "燈油已盡", mid, cardY + 54);
    ctx.fillStyle = "#f6e9ce";
    ctx.fillText(isWon ? "夜已破曉" : "燈油已盡", mid, cardY + 51);

    // 線條與裝飾已融入紙張貼圖，不再以數位等距分隔線覆蓋。

    // 分數：直接放大，不另加框；新紀錄用發亮字，否則以淡字顯示歷史最高。
    ctx.font = titleFont(60);
    ctx.fillStyle = "#382b22";
    ctx.fillText(score.toLocaleString(), mid, cardY + 160);
    if (summary.newBest) {
      glow(ctx, mid, cardY + 186, 150, C.goldHi, 0.4 * pulse(4, 0.4));
      ctx.fillStyle = "#8c4737";
      ctx.font = readableFont(15, "900");
      ctx.fillText("新紀錄！", mid, cardY + 190);
    } else if (summary.prevBest > 0) {
      ctx.font = readableFont(13, "700");
      ctx.fillStyle = "#654735";
      ctx.fillText(`最高 ${summary.prevBest.toLocaleString()}`, mid, cardY + 190);
    }

    // 送達／誤配：用文字最清楚，只排成一行，不分格。
    const statY = cardY + 230;
    ctx.font = "900 24px 'Zen Maru Gothic', 'Noto Sans JP', sans-serif";
    const stats = [
      [`送達  ${delivered} 件`, "#3c3026"],
      [`誤配  ${failed} 件`, failed > 0 ? "#814e3c" : "#887160"]
    ];
    // 本局時間：只吃 AGY runtime 提供的 summary.elapsedSeconds（已排除暫停）；
    // 不使用 summary.time（那是 performance 演出時間），也不截 600。欄位未到位前不顯示，避免假數字。
    const elapsedSeconds = Number(summary && summary.elapsedSeconds);
    if (Number.isFinite(elapsedSeconds) && elapsedSeconds >= 0) {
      const totalSec = Math.floor(elapsedSeconds);
      const clock = `${String(Math.floor(totalSec / 60)).padStart(2, "0")}:${String(totalSec % 60).padStart(2, "0")}`;
      stats.push([`本局  ${clock}`, "#5c4736"]);
    }
    const pairGap = 72, statW = stats.map(([label]) => ctx.measureText(label).width);
    const statsTotalW = statW.reduce((a, b) => a + b, 0) + pairGap * (stats.length - 1);
    let sx = mid - statsTotalW / 2;
    ctx.textAlign = "left";
    stats.forEach(([label, color], i) => {
      ctx.fillStyle = color;
      ctx.fillText(label, sx, statY);
      sx += statW[i] + pairGap;
    });
    ctx.textAlign = "center";

    const summaryStep = Math.max(34, fontPx(readableFont(15,"700")) * 1.25);
    let summaryY = statY;
    if (summary.learning) {
      const l = summary.learning;
      ctx.font = readableFont(15,"700"); ctx.fillStyle = "#423127";
      summaryY += summaryStep;
      ctx.fillText(l.independent == null ? `今夜練習 ${l.practiced} 字・待複習 ${l.review} 字` : `無提示答對 ${l.independent} 次・提示 ${l.assisted || 0} 次`,mid,summaryY);
      ctx.fillStyle = "#864b37";
      summaryY += summaryStep;
      ctx.fillText(l.independent == null ? `熟練星：升星 +${l.gained}・降星 −${l.lost}` : `下次複習 ${l.review} 字・星數僅記錄本局練習`,mid,summaryY);
    }
    const reviewWords = [...new Map((misses || []).map(w => [w.jp, w])).values()];
    const reviewList = reviewWords.slice(0, 3);
    ctx.font = readableFont(15, "700");
    if (!isWon && reviewList.length > 0) {
      ctx.fillStyle = "#854b40";
      summaryY += summaryStep;
      ctx.fillText(`今夜記錯的字：共 ${reviewWords.length} 字・可選三詞回聽`, mid, summaryY);
      ctx.font = readableFont(16, "700");
      ctx.fillStyle = "#382d27";
      reviewButtons(reviewList).forEach((button, i) => drawButton(ctx, button,
        `${button.word.jp}（${button.word.zh}）`, {size:14, quiet:true, focus:focus===3+i, fit:true}));
    } else if (isWon && summary.clearText) {
      summaryY += summaryStep;
      ctx.font = readableFont(14, "600");
      ctx.fillStyle = "#5c4030";
      ctx.fillText(summary.clearText, mid, summaryY);
    }

    // 與 game.js 命中測試同源：只畫 endScreenButtons(state) 這一個集合，順序即 focus 索引。
    // 勝利只有「回旅路地圖」一顆且不畫任何 review 可點鈕；失敗保留三顆主按鈕＋原有 review。
    endScreenButtons(state).forEach((btn, i) => {
      drawButton(ctx, btn, END_BTN_LABEL[btn.id] || btn.id,
        { tone: i === 0 ? "primary" : "quiet", size: 18, focus: focus === i, scrollText: true, visualOffsetY: -5, fit: true, fitMin: cssPx(11) });
    });

    // 最後繪製特寫，提燈與角色輪廓可跨過資訊卡邊框。
    const courierKey = isWon ? "player_win_v1" : "player_kneel_v1";
    const courier = window.ART && (window.ART[courierKey] || window.ART.player);
    if (courier && courier.naturalWidth) {
      const bounds = screenBounds();
      const ph = bounds.height * 2 / 3;
      // drawFrame 的 x 是腳底水平錨點；依各結算素材的透明邊界預留左側安全距離。
      // 寬螢幕仍沿用原本 108，平板/4:3 會自動右移，避免失敗立繪被畫布左緣裁切。
      ctx.save();
      // 新版勝利／失敗立繪是完整去背單圖，不能使用舊版的固定裁切座標。
      const newPortrait = !!window.ART?.[courierKey] && courier.naturalWidth === 900 && courier.naturalHeight === 1200;
      if (newPortrait) {
        const pw = ph * courier.naturalWidth / courier.naturalHeight;
        const left = Math.max(bounds.left + 10, cardX - pw * .65);
        ctx.drawImage(courier, left, 470 - ph, pw, ph);
      } else {
        const leftAnchorRatio = isWon ? (512 - 111) / 1462 : (612 - 159) / 1161;
        const portraitX = Math.max(108, bounds.left + 12 + ph * leftAnchorRatio);
        if (window.RENDERER?.drawFrame) window.RENDERER.drawFrame(ctx,courier,window.ART[courierKey]?courierKey:'player',0,portraitX,470,ph);
        else ctx.drawImage(courier,portraitX-ph*courier.naturalWidth/courier.naturalHeight/2,470-ph,ph*courier.naturalWidth/courier.naturalHeight,ph);
      }
      ctx.restore();
    }

    ctx.restore();
  }

  // 7. 暫停與系統設定選單 (日式黑漆金箔和風御札)
  const PAUSE_BTNS = [
    { id: "resume", label: "繼續夜行", y: 170, tone: "primary" },
    { id: "cards", label: "秘術卡片", y: 218 },
    { id: "codex", label: "單字圖鑑", y: 266 },
    { id: "settings", label: "夜行設定", y: 314 },
    { id: "world", label: "回旅路地圖", y: 362 },
    { id: "menu", label: "返回主選單", y: 410, tone: "danger" }
  ];
  function pauseButtons(page = "main") {
    const scale = viewScale();
    const compact = scale < 0.8;
    const minTouch = cssPx(MIN_TOUCH_CSS);
    const items = page === "settings" ? [
      { id: "mute", label: "聲音：開", labelMuted: "聲音：關", y: 170 },
      { id: "controls", label: "操作與自定義", y: 218 },
      { id: "tutorial", label: "重看操作教學", y: 266 },
      { id: "pause-back", label: "返回暫停選單", y: 314, tone: "primary" }
    ] : PAUSE_BTNS;
    return items.map((b,i)=>{
      if (!compact) return {...b,x:470,w:280,h:44};
      // 44 CSS 保底：360x800（scale .4）原本只有 28 CSS 高，拇指按不到。
      const h = Math.max(70, minTouch);
      const step = h + Math.max(8, Math.round(10 / scale));
      return {...b,x:i%2?470:70,y:190+Math.floor(i/2)*step,w:360,h};
    });
  }

  function drawPauseMenu(ctx, muted, focus = 0, page = "main") {
    ctx.save();
    ctx.fillStyle = "rgba(6, 8, 16, 0.92)";
    fillScreen(ctx);
    // 紙木告示板不再依賴大面積霓虹氛圍光。

    const buttons = pauseButtons(page);
    const compact=(window.VIEWPORT?.get().scale||1)<.8;
    const panelX = Math.min(...buttons.map(b => b.x)) - (compact?24:65);
    const panelY = 92;
    const panelR = Math.max(...buttons.map(b => b.x + b.w)) + (compact?24:54);
    const panelB = Math.max(...buttons.map(b => b.y + b.h)) + 28;
    // 大尺寸版仿照核准稿：角色與狐狸面具／燈籠留在左側，
    // 右側只放一塊告示紙和七張克制的紙札；狹長螢幕保留原適配排列。
    const panelMid=(panelX+panelR)/2;
    window.loadPauseRestArt?.();
    const courier=window.ART?.player_rest_v1;
    if(courier?.naturalWidth && courier?.naturalHeight){
      // 手機橫向左側有剩餘留白時保留休息角色；小到放不下則省略，
      // 但永遠不縮小暫停面板的觸控 hitbox。
      const margin=panelX-screenBounds().left-8;
      const h=compact?Math.min(235,margin*courier.naturalHeight/courier.naturalWidth):455;
      if(h>=125){
        const w=h*courier.naturalWidth/courier.naturalHeight;
        const x=compact?panelX-w-5:Math.max(0,panelX-w+18);
        const y=compact?panelB-h-9:110;
        ctx.save();ctx.globalAlpha=.96;
        ctx.drawImage(courier,x,y,w,h);
        ctx.restore();
      }
    }
    // 夜櫻神社暫停選單：半水墨浮世繪深藍和紙木框，杜絕突兀大白板
    const boardW = panelR - panelX, boardH = panelB - panelY;
    ctx.save();
    // 背景大板
    const pauseBg = ctx.createLinearGradient(panelX, panelY, panelX, panelB);
    pauseBg.addColorStop(0, "#162035");
    pauseBg.addColorStop(1, "#0f1726");
    ctx.fillStyle = pauseBg;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, boardW, boardH, 12);
    ctx.fill();
    // 和風木質外框與四角金飾
    ctx.strokeStyle = "#c29d5b";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 215, 80, 0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX + 6, panelY + 6, boardW - 12, boardH - 12);
    ctx.restore();

    ctx.textAlign = "center";
    ctx.font = scrollFont(34, "900");
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillText(page === "settings" ? "夜行設定" : "夜櫻暫歇", panelMid, 145);
    ctx.fillStyle = "#ffd54f";
    ctx.fillText(page === "settings" ? "夜行設定" : "夜櫻暫歇", panelMid, 143);

    ctx.font = scrollFont(13, "700");
    ctx.fillStyle = "#c8d4e8";
    ctx.fillText("此夜暫歇・神域庇佑", panelMid, 163);

    buttons.forEach((b, i) => {
      const label = b.id === "mute" && muted ? b.labelMuted : b.label;
      drawButton(ctx, b, label, { tone: b.tone || "normal", size: b.tone === "primary" ? 19 : 17, focus: i === focus,quiet:!b.tone,scrollText:true });
    });

    ctx.fillStyle = "#624633";
    ctx.font = scrollFont(12,"700");
    ctx.fillText("上下選擇 · Enter／A 確認 · Esc／B 繼續", panelMid, panelB - 14);

    ctx.restore();
  }

  // 8. 百鬼夜行：單行短警告與周邊妖氣紅暈。
  function drawSurgeWarning(ctx, surgeWarningT) {
    if (surgeWarningT <= 0) return;
    ctx.save();
    const totalDuration = 2.4;
    const cycleDuration = 0.8;
    const progress = Math.max(0, totalDuration - surgeWarningT);
    const phase = (progress % cycleDuration) / cycleDuration;
    const flashBrightness = Math.sin(phase * Math.PI);
    const alpha = Math.max(0.18, flashBrightness);

    const bounds = screenBounds();
    const edgeDepth = Math.max(58, Math.min(118, Math.min(bounds.width, bounds.height) * 0.17));
    const edgeAlpha = alpha * 0.34;
    const paintEdgeGlow = (x0, y0, x1, y1, x, y, w, h, reverse = false) => {
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      if (reverse) {
        g.addColorStop(0, "rgba(180, 18, 32, 0)");
        g.addColorStop(1, `rgba(210, 24, 40, ${edgeAlpha})`);
      } else {
        g.addColorStop(0, `rgba(210, 24, 40, ${edgeAlpha})`);
        g.addColorStop(1, "rgba(180, 18, 32, 0)");
      }
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
    };
    paintEdgeGlow(bounds.left, bounds.top, bounds.left, bounds.top + edgeDepth,
      bounds.left, bounds.top, bounds.width, edgeDepth);
    paintEdgeGlow(bounds.left, bounds.bottom - edgeDepth, bounds.left, bounds.bottom,
      bounds.left, bounds.bottom - edgeDepth, bounds.width, edgeDepth, true);
    paintEdgeGlow(bounds.left, bounds.top, bounds.left + edgeDepth, bounds.top,
      bounds.left, bounds.top, edgeDepth, bounds.height);
    paintEdgeGlow(bounds.right - edgeDepth, bounds.top, bounds.right, bounds.top,
      bounds.right - edgeDepth, bounds.top, edgeDepth, bounds.height, true);
    ctx.fillStyle = `rgba(160, 10, 24, ${alpha * 0.026})`;
    fillScreen(ctx);

    const bw = 240, bh = 52;
    const bx = (bounds.left+bounds.right-bw)/2, by = bounds.top+110;

    glow(ctx, bx + bw / 2, by + bh / 2, bw * 1.3, "#ff2a2a", alpha * 0.5);
    glassBox(ctx, bx, by, bw, bh, 10, "rgba(52, 10, 14, 0.97)", `rgba(255, 70, 70, ${alpha})`, 2.6, true);

    ctx.textAlign = "center";
    ctx.font = titleFont(24);
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillText("百鬼夜行", bx + bw / 2, by + 36);
    ctx.fillStyle = "#fff2a8";
    ctx.fillText("百鬼夜行", bx + bw / 2, by + 33);

    ctx.restore();
  }

  // 9. 關卡標題卡：進場 3 秒內淡入淡出，不擋操作。
  function drawTitleCard(ctx, stage, chapter, t) {
    const total = 3, age = total - t;
    const a = clamp(Math.min(age / 0.5, t / 0.8), 0, 1);
    if (a <= 0 || !stage) return;
    const b = screenBounds(), cx = (b.left + b.right) / 2, cy = b.top + b.height * 0.36;
    const story = window.STORY && typeof window.STORY.get === "function" && window.STORY.get(stage.id);
    const stageNum = story?.stageNumber || (Object.keys(window.CONTENT?.STAGES || {}).indexOf(stage.id) + 1) || 1;
    const chapNum = story?.chapter || chapter || (stageNum <= 3 ? 1 : stageNum <= 6 ? 2 : 3);
    const chapTitle = story?.chapterTitle || (chapNum === 1 ? "夜行起點" : chapNum === 2 ? "百鬼異變" : "黃泉之門");
    ctx.save();
    ctx.globalAlpha = a;
    glow(ctx, cx, cy, 760, "#0a0d18", 0.55);
    glow(ctx, cx, cy, 420, C.gold, 0.12);
    ctx.textAlign = "center";
    ctx.font = readableFont(14, "900");
    ctx.fillStyle = C.gold;
    ctx.fillText(`第 ${stageNum} 夜・第 ${chapNum} 章「${chapTitle}」`, cx, cy - 34);
    ctx.font = titleFont(44);
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillText(stage.name, cx, cy + 14);
    ctx.fillStyle = C.goldHi;
    ctx.fillText(stage.name, cx, cy + 10);
    if (stage.sub) {
      ctx.font = readableFont(15, "700");
      ctx.fillStyle = C.dim;
      ctx.fillText(stage.sub, cx, cy + 38);
    }
    if (story && story.opening) {
      ctx.font = readableFont(13, "600");
      ctx.fillStyle = "#e3dac9";
      fitText(ctx, story.opening, cx, cy + 62, Math.min(b.width * 0.85, 580));
    }
    const lw = 130 * a;
    ctx.strokeStyle = "rgba(232, 195, 106, 0.6)"; ctx.lineWidth = 1.4;
    ctx.beginPath();
    const lineY = story?.opening ? cy + 80 : cy + 56;
    ctx.moveTo(cx - lw - 10, lineY); ctx.lineTo(cx - 10, lineY); ctx.moveTo(cx + 10, lineY); ctx.lineTo(cx + lw + 10, lineY);
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

  // 日語斷句與禁則處理（行首禁止出現促音、拗音、長音與標點）
  function splitText2(text) {
    if (!text || text.length <= 1) return [text || "", ""];
    const spaceIdx = text.indexOf(" ");
    let splitIdx;
    if (spaceIdx > 0 && spaceIdx < text.length - 1) {
      const afterSpace = text.slice(spaceIdx + 1);
      if (afterSpace.length <= 4) {
        splitIdx = spaceIdx;
      } else {
        splitIdx = Math.ceil(text.length / 2);
      }
    } else {
      splitIdx = Math.ceil(text.length / 2);
    }
    const noLineStart = /[ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮー、。！？]/;
    if (splitIdx < text.length && noLineStart.test(text[splitIdx])) {
      splitIdx++;
    }
    return [text.slice(0, splitIdx).trimEnd(), text.slice(splitIdx).trimStart()];
  }

  function fitText(ctx, text, x, y, maxWidth, options = {}) {
    if (!text) return;
    ctx.save();
    const maxW = Math.max(1, maxWidth || 0);
    const measured = ctx.measureText ? ctx.measureText(text).width : text.length * 16;
    if (!maxW || measured <= maxW) {
      if (options.stroke) ctx.strokeText(text, x, y);
      ctx.fillText(text, x, y);
      ctx.restore();
      return;
    }

    const fontMatch = String(ctx.font).match(/([\d.]+)px/);
    const origSize = fontMatch ? Number(fontMatch[1]) : 16;
    const scaledSize = Math.floor(origSize * (maxW / measured) * 10) / 10;
    // minSize 是世界座標字級；minCss 是「不管 VIEWPORT.scale 多小都至少這麼高的 CSS 字級」。
    // 手機 scale .4 時，readableFont(9) 的世界字級下限只有 3.6 CSS，故以 minCss 補上可讀地板。
    const minFloor = Math.max(options.minSize || 0, options.minCss ? cssPx(options.minCss) : 0) || undefined;

    // 若等比縮小後仍高於可讀下限，或未開啟多行折行，則以單行等比縮小顯示（避免 Canvas 非等比壓扁）
    if (!minFloor || scaledSize >= minFloor || !options.wrap) {
      const finalSize = minFloor ? Math.max(minFloor, scaledSize) : scaledSize;
      ctx.font = ctx.font.replace(/([\d.]+)px/, `${finalSize}px`);
      if (options.stroke) ctx.strokeText(text, x, y);
      ctx.fillText(text, x, y);
      ctx.restore();
      return;
    }

    // 低於可讀性下限：在現有框內進行安全二行折行，不生新 UI
    const [l1, l2] = splitText2(text);
    if (!l2) {
      ctx.font = ctx.font.replace(/([\d.]+)px/, `${minFloor}px`);
      if (options.stroke) ctx.strokeText(text, x, y);
      ctx.fillText(text, x, y);
      ctx.restore();
      return;
    }

    let twoLineSize = Math.max(minFloor, Math.min(origSize - 2, Math.floor(origSize * 0.8)));
    ctx.font = ctx.font.replace(/([\d.]+)px/, `${twoLineSize}px`);
    const w1 = ctx.measureText ? ctx.measureText(l1).width : l1.length * twoLineSize;
    const w2 = ctx.measureText ? ctx.measureText(l2).width : l2.length * twoLineSize;
    const maxSub = Math.max(w1, w2);
    if (maxSub > maxW) {
      twoLineSize = Math.max(minFloor, Math.floor(twoLineSize * (maxW / maxSub) * 10) / 10);
      ctx.font = ctx.font.replace(/([\d.]+)px/, `${twoLineSize}px`);
    }

    const lh = options.lineHeight || Math.max(minFloor + 2, Math.floor(origSize * 0.72));
    let y1, y2;
    if (options.y1 != null && options.y2 != null) {
      y1 = options.y1;
      y2 = options.y2;
    } else if (ctx.textBaseline === "middle") {
      y1 = y - lh * 0.5;
      y2 = y + lh * 0.5;
    } else {
      y1 = y - lh * 0.45;
      y2 = y + lh * 0.55;
    }

    if (options.stroke) {
      ctx.strokeText(l1, x, y1);
      ctx.strokeText(l2, x, y2);
    }
    ctx.fillText(l1, x, y1);
    ctx.fillText(l2, x, y2);
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

  function answerFont(size, weight = "700") {
    const scale = window.VIEWPORT?.get().scale || (document.getElementById("game")?.getBoundingClientRect().width || 900) / 900;
    const readable = scale < 1 ? Math.max(size, Math.min(31, Math.ceil(15 / scale))) : size;
    return `${weight || "700"} ${readable}px 'Noto Sans JP', 'Yu Gothic', 'Meiryo', sans-serif`;
  }

  // 僅地板實體答題字使用行書／毛筆感字型，避免整條字串被粗黑現代字體取代。
  function floorAnswerFont(size) {
    const scale = window.VIEWPORT?.get?.().scale || 1;
    const readable = scale < 1 ? Math.max(size, Math.ceil(15 / scale)) : size;
    return `400 ${readable}px 'Yuji Syuku', 'Kaisei Decol', 'HGS行書体', 'DFKai-SB', 'Yu Mincho', 'Noto Serif JP', serif`;
  }

  let answerFontFallbackGrace = false;
  function answerFontReady(text = "あア日", size = 31, weight = "700") {
    if (!document.fonts?.check || answerFontFallbackGrace) return true;
    const font = answerFont(size, weight);
    try {
      if (document.fonts.check(font, text)) return true;
      document.fonts.load(font, text).then(() => {}).catch(() => {
        answerFontFallbackGrace = true;
      });
      if (typeof window !== "undefined" && !window.__answerFontTimer) {
        window.__answerFontTimer = setTimeout(() => { answerFontFallbackGrace = true; }, 1200);
      }
    } catch {
      return true;
    }
    return false;
  }

  return {
    readableFont,
    answerFont,
    floorAnswerFont,
    answerFontReady,
    fitText,
    splitText2,
    drawHintText,
    controlLabel, tutorialCopy, drawTutorial, drawActionIcon, TUTORIAL_BTNS,
    drawWordCue,
    drawMainMenu,
    drawHud, drawHudClassic, drawHudDiegetic,
    drawLevelUp,
  // P1-MUTATION-CARDS：圖鑑與升級選卡共用的單一短句／示意圖來源（供測試與後續維護直接引用）
  CARD_SHORT,
  cardShort,
  drawCardIcon,
  CARD_ICON_R,
    drawEmblem,
    drawBossQuiz, bossQuizLayout,
    drawCodex, codexRows, codexButtons, selectSecretDetail, wordGallery, wordGalleryViewport,
    drawEndScreen, reviewButtons,
    drawAssetProgress,
    drawPauseMenu,
    setButtonHover, pressButton, buttonTextArea,
    drawSurgeWarning,
    drawTitleCard,
    drawFade,
    drawButton,
    drawCharmHud,
    drawCharmSwap,
    drawAwakeningTag,
    // 旅路與暫停、結算共用核准的手繪材質。
    drawWoodTag, drawWashiBoard,
    PAUSE_BTNS, pauseButtons, MENU_BTNS, END_BTNS, endScreenButtons, EXIT_BTNS, drawExitConfirm,
    refreshMenuButtons,
    PAUSE_BTN_W: 280,
    PAUSE_BTN_H: 44,
    RESTART_BTN,
    WORLD_BTN,
    HOME_BTN,
    MENU_START_BTN,
    MENU_CONTROLS_BTN,
    HINT_BTN,
    REROLL_BTN,
    levelUpLayout,
    fusionLayout,
    drawFusion,
    FUSION_REOPEN_BTN,
    drawFusionReopenButton,
    drawFusionReopenButton,
    CARD_LIST,
    resolveFanSlots,
    resetFanSlots,
    isFusionSkill,
    getFusionSkillParents,
    drawFusionParentBadges,
    drawFusionIcon,
    drawDiegeticSkillFan,
    drawDiegeticSkillFanFallback,
    FUSION_UI_META
  };
})();
if (typeof module !== "undefined" && module.exports) module.exports = window.UI;
