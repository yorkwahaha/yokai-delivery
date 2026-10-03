(() => {
  const root = typeof window !== 'undefined' ? window : globalThis;
  function calculate(width, height) {
    const scale = Math.min(width / 900, height / 600);
    const w = width / scale, h = height / scale;
    return { width: w, height: h, scale, offsetX: (w - 900) / 2, offsetY: (h - 600) / 2 };
  }
  const get = () => calculate(root.innerWidth || 900, root.innerHeight || 600);
  const bounds = () => {
    const v = get();
    return { left: -v.offsetX, top: -v.offsetY, right: 900 + v.offsetX, bottom: 600 + v.offsetY, width: v.width, height: v.height };
  };
  root.VIEWPORT = { calculate, get, bounds };
  if (typeof module !== 'undefined') module.exports = root.VIEWPORT;
})();
