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
  const spacingScaleY = () => {
    if (initialTiltScale() !== 0.6) return 1;
    const query = root.location?.search || "";
    return /(?:^|[?&])spacing=1(?:\.0)?(?:&|$)/.test(query) ? 1 : 1.2;
  };
  const worldBounds = () => {
    const a = bounds(), k = tiltScale();
    return {left:a.left,right:a.right,top:a.top/k,bottom:a.bottom/k,width:a.width,height:a.height/k};
  };
  const worldToScreen = (x,y,cam={x:0,y:0},shake={x:0,y:0}) =>
    ({x:x-cam.x+shake.x,y:(y-cam.y+shake.y)*tiltScale()});
  const screenToWorld = (x,y,cam={x:0,y:0},shake={x:0,y:0}) =>
    ({x:x+cam.x-shake.x,y:y/tiltScale()+cam.y-shake.y});
  const upright = (ctx,x,y,draw) => {
    const k=tiltScale();
    if(k===1)return draw();
    ctx.save();ctx.translate(x,y);ctx.scale(1,1/k);ctx.translate(-x,-y);
    try{return draw();}finally{ctx.restore();}
  };
  root.VIEWPORT = {calculate,get,bounds,hudBounds,tiltScale,tiltTargetScale,setTiltScale,animateTiltScale,advanceTilt,spacingScaleY,worldBounds,
    worldToScreen,screenToWorld,upright};
  if (typeof module !== 'undefined') module.exports = root.VIEWPORT;
})();
