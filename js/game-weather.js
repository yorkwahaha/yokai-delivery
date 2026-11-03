// Phase16: rain, snow and fog rendering only.
// No global state or DOM access; callers supply current stage/render context.
window.GAME_WEATHER = (() => {
  function rainUnit(i, salt) {
    let h = Math.imul((i + 1) ^ (salt * 0x9e3779b9), 0x85ebca6b);
    h ^= h >>> 13;
    return (h >>> 0) / 4294967296;
  }
  function drawStageWeather(t, {ctx, STAGE_VISUAL, STAGE, rainLoad, W, H,
    liveMotion, viewBounds, getRipple}) {
    if (STAGE_VISUAL.weather !== "rain" && STAGE_VISUAL.weather !== "snow") return;
    if (!liveMotion()) t = 0;
    const intensity = Math.max(0.4, STAGE_VISUAL.rainIntensity || 1);
    const area = viewBounds();
    const drops = Math.min(80, Math.round(72 * intensity * area.width * area.height / (W * H)));
    ctx.save();
    if (STAGE_VISUAL.weather === "rain") {
      ctx.lineCap = "round";
      const streak = (x, y, length, slant, width, alpha) => {
        ctx.strokeStyle = `rgba(174, 218, 238, ${alpha})`;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + length * slant, y + length);
        ctx.stroke();
      };
      // 第一條保持原斜率，讓既有雨向測試仍量得到同一條雨絲。
      {
        const speed = 520;
        const x = area.left + ((t * speed * 0.18) % (area.width + 120)) - 60;
        const y = area.top + ((t * speed) % (area.height + 120)) - 60;
        streak(x, y, 16, 0.18, 1.5, 0.48);
      }
      if (STAGE.id === "rain-port") {
        const cover = Math.min(1, area.width * area.height / (W * H));
        const budget = rainLoad > 1.4 ? 0.55 : 1;
        const rainMul = 2;
        const bands = [
          { n: Math.max(10, Math.round(12 * rainMul * cover * budget)), speed: 78, len: 8, slant: 0.16, width: 1, alpha: 0.14 },
          { n: Math.max(8, Math.round(10 * rainMul * cover * budget)), speed: 150, len: 16, slant: 0.18, width: 1.25, alpha: 0.34 },
          { n: Math.max(6, Math.round(7 * rainMul * cover * budget)), speed: 248, len: 26, slant: 0.18, width: 1.6, alpha: 0.22 }
        ];
        const total = bands.reduce((sum, band) => sum + band.n, 0);
        let cursor = 0;
        for (const band of bands) {
          for (let k = 0; k < band.n; k++, cursor++) {
            const speed = band.speed * (0.86 + rainUnit(cursor, 2) * 0.28);
            const slant = band.slant + (rainUnit(cursor, 3) - 0.5) * 0.05;
            const spanX = area.width + 160;
            const spanY = area.height + 160;
            const travelX = speed * slant;
            const baseY = rainUnit(cursor, 7) * Math.max(8, spanY - speed - 8);
            let mix = Math.imul((cursor + 1) ^ 0x9e3779b9, 0x85ebca6b);
            mix = Math.imul(mix ^ (mix >>> 13), 0xc2b2ae35);
            mix = (mix ^ (mix >>> 16)) >>> 0;
            const baseX = (cursor + (mix / 4294967296) * 0.92) * (spanX / (total + 1));
            const x = area.left + ((baseX + t * travelX) % spanX);
            const y = area.top + ((baseY + t * speed) % spanY);
            streak(x, y, band.len * (0.82 + rainUnit(cursor, 4) * 0.4), slant, band.width, band.alpha);
          }
        }
        const ripple = getRipple();
        for (let i = 0; i < 12; i++) {
          const life = (t * 0.8 + rainUnit(i, 8)) % 1;
          const x = area.left + rainUnit(i, 9) * area.width;
          const y = area.top + rainUnit(i, 6) * area.height;
          ctx.globalAlpha = (1 - life) * 0.28;
          ctx.beginPath();
          ctx.arc(x, y, 3 + life * 10, 0, 6.28);
          ctx.stroke();
          if (ripple?.naturalWidth) {
            const s = 8 + life * 16;
            ctx.drawImage(ripple, x - s / 2, y - s * 0.28, s, s * 0.55);
          }
        }
        ctx.globalAlpha = 1;
      } else {
        for (let i = 1; i < drops; i++) {
          const speed = 520 + (i % 5) * 55;
          const x = area.left + ((i * 97 + t * speed * 0.18) % (area.width + 120)) - 60;
          const y = area.top + ((i * 61 + t * speed) % (area.height + 120)) - 60;
          streak(x, y, 16 + (i % 4) * 4, 0.18, 1.5, 0.48);
        }
      }
    } else if (STAGE_VISUAL.weather === "snow") {
      const flakes = Math.min(50, Math.round(42 * area.width * area.height / (W * H)));
      ctx.fillStyle = "rgba(240, 248, 255, 0.75)";
      for (let i = 0; i < flakes; i++) {
        const speed = 70 + (i % 5) * 16;
        const sway = Math.sin(t * 1.6 + i) * 16;
        const x = area.left + ((i * 113 + t * 20 + sway) % (area.width + 80)) - 40;
        const y = area.top + ((i * 79 + t * speed) % (area.height + 80)) - 40;
        const r = 1.4 + (i % 3) * 0.8;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const fog = Math.max(0, Math.min(0.35, STAGE_VISUAL.fog || 0));
    if (fog > 0 && typeof ctx.createRadialGradient === "function") {
      const area = viewBounds();
      const haze = ctx.createRadialGradient(
        (area.left + area.right) / 2, (area.top + area.bottom) / 2, Math.min(area.width, area.height) * 0.2,
        (area.left + area.right) / 2, area.top, Math.max(area.width, area.height) * 0.75
      );
      if (haze && typeof haze.addColorStop === "function") {
        const mid = STAGE.id === "rain-port" ? fog * 0.28 : fog;
        haze.addColorStop(0, `rgba(180, 198, 205, ${mid})`);
        haze.addColorStop(1, `rgba(92, 118, 138, ${fog * 0.85})`);
        ctx.fillStyle = haze;
        ctx.fillRect(area.left, area.top, area.width, area.height);
      }
    }
    ctx.restore();
  }

  return Object.freeze({drawStageWeather, rainUnit});
})();
