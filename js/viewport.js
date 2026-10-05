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
  root.VIEWPORT = { calculate, get, bounds, hudBounds };
  if (typeof module !== 'undefined') module.exports = root.VIEWPORT;
})();
