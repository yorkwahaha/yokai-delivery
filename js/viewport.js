(() => {
  const root = typeof window !== 'undefined' ? window : globalThis;
  function calculate(width, height) {
    const scale = Math.min(width / 900, height / 600);
    const w = width / scale, h = height / scale;
    return { width: w, height: h, scale, offsetX: (w - 900) / 2, offsetY: (h - 600) / 2 };
  }
  let lastWidth, lastHeight, viewport, area, hud;
  const get = () => {
    const width=root.innerWidth||900,height=root.innerHeight||600;
    if(width!==lastWidth||height!==lastHeight){
      lastWidth=width;lastHeight=height;viewport=calculate(width,height);
      const v=viewport,inset=20/v.scale;
      area={left:-v.offsetX,top:-v.offsetY,right:900+v.offsetX,bottom:600+v.offsetY,width:v.width,height:v.height};
      hud={left:area.left+inset,top:area.top+inset,right:area.right-inset,bottom:area.bottom-inset,width:area.width-inset*2,height:area.height-inset*2};
    }
    return viewport;
  };
  const bounds = () => { get();return area; };
  const hudBounds = () => { get();return hud; };
  // Playable 0.60 review default in a browser, with a reversible 2D fallback.
  // ?tilt=1 restores the original rendering; ?spacing=1 keeps the dense 0.60 layout.
  // Test VM environments without a location retain legacy 2D semantics.
  const initialTiltScale = () => {
    const query = root.location?.search;
    if (typeof query !== "string") return 1;
    if (/(?:^|[?&])tilt=(?:1(?:\.0)?|2d|off)(?:&|$)/.test(query)) return 1;
    const raw = /(?:^|[?&])tilt=(0\.85|0\.70|0\.7|0\.60|0\.6)(?:&|$)/.exec(query)?.[1];
    return raw ? Number(raw) : 0.6;
  };
  // Camera/projector may change during gameplay without reconstructing houses or delivery jobs.
  // World spacing belongs to the current run and must not depend on the live projector.
  let selectedTilt = null, transition = null;
  const tiltScale = () => selectedTilt ?? initialTiltScale();
  const tiltTargetScale = () => transition?.to ?? tiltScale();
  const setTiltScale = value => {
    transition = null;
    if (value == null) { selectedTilt = null; return tiltScale(); }
    if (value !== 1 && value !== 0.6) return tiltScale();
    selectedTilt = value;
    return value;
  };
  // Smoothstep interpolation of the real projection matrix, not a screen zoom.
  const animateTiltScale = (to, duration = 0.8) => {
    if (to !== 1 && to !== 0.6) return tiltScale();
    const from = tiltScale();
    if (Math.abs(from - to) < 1e-6 || duration <= 0) return setTiltScale(to);
    transition = {from,to,time:0,duration};
    selectedTilt = from;
    return selectedTilt;
  };
  const advanceTilt = dt => {
    if (!transition) return tiltScale();
    transition.time = Math.min(transition.duration,
      transition.time + Math.max(0, Number.isFinite(dt) ? dt : 0));
    const t = transition.time / transition.duration, ease = t*t*(3-2*t);
    selectedTilt = transition.from + (transition.to-transition.from)*ease;
    if (t >= 1) { selectedTilt = transition.to; transition = null; }
    return selectedTilt;
  };
  let zoomStageId = "";
  const setZoomStage = id => { zoomStageId = id || ""; };
  function zoomChoice(loc) {
    const place = loc || root.location;
    const host = String(place && place.hostname || "").trim().toLowerCase().replace(/^\[|\]$/g, "");
    const loop = host === "localhost" || host === "127.0.0.1" || host === "::1";
    if (!loop) return 1;
    const raw = String(place && place.search || "");
    const query = new URLSearchParams(raw.charAt(0) === "?" ? raw.slice(1) : raw).get("zoom");
    const choices = { "1": 1, "1.1": 1.1, "1.10": 1.1, "1.15": 1.15 };
    return Object.hasOwn(choices, query) ? choices[query] : 1;
  }
  const selectedWorldZoom = () => zoomStageId === "sakura-pass" ? zoomChoice() : 1;
  // dev=1&stage=rain-port&s2artprod=1 專用：2D 縮到 0.78（約 770 世界像素高）才放得下北建築＋石木岸＋南海。
  // tilt .60 原本就看得到全景，縮放隨 tilt 平滑歸 1。其他關／沒 flag 一律 1。
  const S2_DEV_ZOOM = 0.78;
  const s2DevZoomActive = () => zoomStageId === "rain-port" && typeof root.isS2ArtProdEnabled === "function" && root.isS2ArtProdEnabled();
  const worldZoom = () => {
    const k = tiltScale();
    if (s2DevZoomActive()) {
      const gainS2 = Math.max(0, Math.min(1, (k - 0.6) / 0.4));
      return 1 - (1 - S2_DEV_ZOOM) * gainS2;
    }
    const selected = selectedWorldZoom();
    if (selected === 1 || k === 1) return 1;
    const gain = Math.max(0, Math.min(1, (1 - k) / 0.4));
    return 1 + (selected - 1) * gain;
  };
  const projectPoint = (x, y, cam = { x: 0, y: 0 }, shake = { x: 0, y: 0 }, k = tiltScale(), z = worldZoom()) => {
    const ax = 450, ay = 300;
    return {
      x: ax + z * (x - cam.x + shake.x - ax),
      y: ay + z * (k * (y - cam.y + shake.y) - ay)
    };
  };
  const unprojectPoint = (x, y, cam = { x: 0, y: 0 }, shake = { x: 0, y: 0 }, k = tiltScale(), z = worldZoom()) => {
    const ax = 450, ay = 300;
    return {
      x: cam.x - shake.x + ax + (x - ax) / z,
      y: cam.y - shake.y + (ay + (y - ay) / z) / k
    };
  };
  function depthMode(loc) {
    const place = loc || root.location;
    const host = String(place && place.hostname || "").trim().toLowerCase().replace(/^\[|\]$/g, "");
    const loop = host === "localhost" || host === "127.0.0.1" || host === "::1";
    if (!loop) return "default";
    const raw = String(place && place.search || "");
    const query = new URLSearchParams(raw.charAt(0) === "?" ? raw.slice(1) : raw).get("depth");
    return query === "off" || query === "enhanced" ? query : "default";
  }
  const spacingScaleY = () => {
    if (initialTiltScale() !== 0.6) return 1;
    const query = root.location?.search || "";
    return /(?:^|[?&])spacing=1(?:\.0)?(?:&|$)/.test(query) ? 1 : 1.2;
  };
  const boundsAtZoom = z => {
    const a = bounds();
    const p = unprojectPoint(a.left, a.top, { x: 0, y: 0 }, { x: 0, y: 0 }, tiltScale(), z);
    const q = unprojectPoint(a.right, a.bottom, { x: 0, y: 0 }, { x: 0, y: 0 }, tiltScale(), z);
    return { left: p.x, top: p.y, right: q.x, bottom: q.y, width: q.x - p.x, height: q.y - p.y };
  };
  const worldBounds = () => boundsAtZoom(worldZoom());
  const worldBoundsAtZoom = z => boundsAtZoom(z);
  const worldToScreen = (x, y, cam = { x: 0, y: 0 }, shake = { x: 0, y: 0 }) => projectPoint(x, y, cam, shake);
  const screenToWorld = (x, y, cam = { x: 0, y: 0 }, shake = { x: 0, y: 0 }) => unprojectPoint(x, y, cam, shake);
  function drawBounds(cam = { x: 0, y: 0 }, shake = { x: 0, y: 0 }, overhang = {}, halo = 0) {
    const k = tiltScale();
    const a = bounds();
    const p = unprojectPoint(a.left - halo, a.top - halo, cam, shake);
    const q = unprojectPoint(a.right + halo, a.bottom + halo, cam, shake);
    const leftOver = overhang.left || 0, rightOver = overhang.right || 0;
    const topOver = overhang.top || 0, bottomOver = overhang.bottom || 0;
    const left = p.x - rightOver, right = q.x + leftOver;
    const top = p.y - bottomOver / k, bottom = q.y + topOver / k;
    return { left, right, top, bottom, width: right - left, height: bottom - top };
  }
  function reanchor(player, cam, prevK, prevZ, nextK, nextZ) {
    const s = projectPoint(player.x, player.y, cam, { x: 0, y: 0 }, prevK, prevZ);
    const q = unprojectPoint(s.x, s.y, { x: 0, y: 0 }, { x: 0, y: 0 }, nextK, nextZ);
    return { x: player.x - q.x, y: player.y - q.y };
  }
  const upright = (ctx,x,y,draw) => {
    const k=tiltScale();
    if(k===1)return draw();
    ctx.save();ctx.translate(x,y);ctx.scale(1,1/k);ctx.translate(-x,-y);
    try{return draw();}finally{ctx.restore();}
  };
  root.VIEWPORT = {calculate,get,bounds,hudBounds,tiltScale,tiltTargetScale,setTiltScale,animateTiltScale,advanceTilt,spacingScaleY,depthMode,
    setZoomStage,selectedWorldZoom,worldZoom,worldBounds,worldBoundsAtZoom,drawBounds,reanchor,worldToScreen,screenToWorld,upright};
  if (typeof module !== 'undefined') module.exports = root.VIEWPORT;
})();
