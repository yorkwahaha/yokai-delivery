// 特效：預烘焙發光貼圖 + 加法混色粒子池。
// 每個粒子只花一次 drawImage（沒有逐幀漸層、沒有 shadowBlur、沒有 ctx.filter），
// 並依實測幀時間自動縮減發射量，讓華麗感不拖垮低階裝置。
window.FX = (() => {
  const MAX = 460;
  const sprites = new Map();
  const ps = [];
  const bolts = [];
  let budget = 1, avgDt = 1 / 60, calm = !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches, calmCheck = 0;
  let flashT = 0, flashMax = 0.12, flashColor = "#ffffff", flashPower = 0.2;

  const rnd = (a, b) => a + Math.random() * (b - a);
  const rgb = hex => {
    const h = String(hex).replace("#", "");
    const f = h.length === 3 ? h.replace(/./g, "$&$&") : h;
    return [parseInt(f.slice(0, 2), 16) || 0, parseInt(f.slice(2, 4), 16) || 0, parseInt(f.slice(4, 6), 16) || 0];
  };
  const rgba = (hex, a) => { const [r, g, b] = rgb(hex); return `rgba(${r},${g},${b},${a})`; };

  function bake(size, paint) {
    if (typeof document === "undefined" || typeof document.createElement !== "function") return null;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    if (!g) return null;
    paint(g, size);
    return c;
  }

  // 貼圖種類：glow 柔光點、spark 四芒星、ring 光環、rune 八芒星咒陣
  // 刻意不對稱的咒陣：弧段長短不一、輻條角度不等、內圈偏心；tier 越高疊加越多細節。
  function runeArt(g, s, color, tier) {
    const r = s / 2;
    let seed = 7 + tier * 13;
    const rnd1 = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    g.translate(r, r);
    g.lineCap = "round";
    const arcs = (rad, width, style, gap) => {
      g.strokeStyle = style; g.lineWidth = width;
      const start = rnd1() * 6.28; let a = start;
      while (a < start + 6.0) {
        const len = Math.min(0.5 + rnd1() * 0.9, start + 6.28 - a);
        g.beginPath(); g.arc(0, 0, rad, a, a + len); g.stroke();
        a += len + gap + rnd1() * 0.4;
      }
    };
    const spokes = (n, from, to, width, style) => {
      g.strokeStyle = style; g.lineWidth = width;
      let a = rnd1() * 6.28;
      for (let i = 0; i < n; i++) {
        a += 6.28 / n * (0.6 + rnd1() * 0.8);
        const len = from + (to - from) * (0.35 + rnd1() * 0.65);
        g.beginPath(); g.moveTo(Math.cos(a) * r * from, Math.sin(a) * r * from); g.lineTo(Math.cos(a) * r * len, Math.sin(a) * r * len); g.stroke();
      }
    };
    const poly = (n, rad, jitter, width, style, turn) => {
      g.strokeStyle = style; g.lineWidth = width; g.beginPath();
      for (let i = 0; i < n * 2; i++) {
        const a = turn + i * Math.PI / n, k = (i % 2 ? 0.55 : 1) * (1 - jitter + rnd1() * jitter * 2);
        g.lineTo(Math.cos(a) * r * rad * k, Math.sin(a) * r * rad * k);
      }
      g.closePath(); g.stroke();
    };
    const main = rgba(color, 0.9), white = "rgba(255,255,255,0.9)";
    arcs(r * 0.9, s * 0.014, main, 0.28);
    g.save(); g.translate(r * 0.05, -r * 0.04);
    g.strokeStyle = rgba(color, 0.7); g.lineWidth = s * 0.01;
    g.beginPath(); g.arc(0, 0, r * 0.52, 0, 6.2832); g.stroke();
    g.restore();
    spokes(tier === 1 ? 5 : 7, 0.52, 0.88, s * 0.01, rgba(color, 0.75));
    if (tier >= 2) {
      arcs(r * 0.76, s * 0.008, white, 0.35);
      poly(7, 0.66, 0.18, s * 0.008, white, rnd1() * 3);
    }
    if (tier >= 3) {
      g.strokeStyle = rgba(color, 0.85); g.lineWidth = s * 0.007;
      for (let i = 0; i < 16; i++) {
        const a = rnd1() * 6.28, r0 = r * 0.93, r1 = r * (0.97 + rnd1() * 0.03);
        g.beginPath(); g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(a + 0.05) * r1, Math.sin(a + 0.05) * r1); g.stroke();
      }
      poly(3, 0.5, 0.1, s * 0.01, white, rnd1() * 3);
      poly(3, 0.34, 0.1, s * 0.008, rgba(color, 0.9), rnd1() * 3);
      arcs(r * 0.9, s * 0.022, "rgba(255,255,255,0.55)", 1.6);
      g.fillStyle = white; g.save(); g.rotate(Math.PI / 4); g.fillRect(-s * 0.014, -s * 0.014, s * 0.028, s * 0.028); g.restore();
    }
  }

  const PAINT = {
    storm(g,s,color){
      const r=s*0.46;g.translate(s/2,s/2);g.strokeStyle=color;g.lineWidth=s*0.012;
      for(let i=0;i<8;i++){
        const a=i*Math.PI/4,c=Math.cos(a),q=Math.sin(a);
        g.beginPath();g.moveTo(c*r,q*r);g.lineTo(c*r*0.76-q*r*0.08,q*r*0.76+c*r*0.08);
        g.lineTo(c*r*0.55+q*r*0.08,q*r*0.55-c*r*0.08);g.lineTo(c*r*0.3,q*r*0.3);g.stroke();
        g.beginPath();g.arc(0,0,r,a+0.06,a+0.62);g.stroke();
      }
    },
    // 技能用硬邊形狀：亮度集中在刃線、紙符與碎屑，不鋪柔光底。
    shard(g, s, color) {
      g.fillStyle = color; g.beginPath();
      g.moveTo(s * 0.05, s * 0.5); g.lineTo(s * 0.62, s * 0.32);
      g.lineTo(s * 0.96, s * 0.5); g.lineTo(s * 0.55, s * 0.61); g.closePath(); g.fill();
      g.strokeStyle = '#fff1cf'; g.lineWidth = s * 0.035;
      g.beginPath(); g.moveTo(s * 0.25,s * 0.5); g.lineTo(s * 0.8,s * 0.47); g.stroke();
    },
    stroke(g, s, color) {
      g.fillStyle = color; g.beginPath();
      g.moveTo(1,s / 2); g.lineTo(s * 0.72,s * 0.45); g.lineTo(s - 1,s / 2);
      g.lineTo(s * 0.72,s * 0.55); g.closePath(); g.fill();
    },
    edge(g, s, color) {
      g.strokeStyle = color; g.lineWidth = s * 0.018; g.lineCap = 'butt';
      for(let i=0;i<6;i++){g.beginPath();g.arc(s/2,s/2,s*0.46,i*Math.PI/3+0.05,(i+1)*Math.PI/3-0.12);g.stroke();}
    },
    rock(g,s,color) {
      g.fillStyle='#635442';g.strokeStyle='#302b2c';g.lineWidth=s*0.025;
      g.beginPath();g.moveTo(s*.5,s*.04);g.lineTo(s*.78,s*.38);g.lineTo(s*.85,s*.85);g.lineTo(s*.5,s*.96);g.lineTo(s*.14,s*.83);g.lineTo(s*.23,s*.39);g.closePath();g.fill();g.stroke();
      g.fillStyle=color;g.beginPath();g.moveTo(s*.5,s*.04);g.lineTo(s*.5,s*.96);g.lineTo(s*.14,s*.83);g.lineTo(s*.23,s*.39);g.closePath();g.fill();
      g.strokeStyle='#d4be8a';g.lineWidth=s*.018;g.beginPath();g.moveTo(s*.5,s*.08);g.lineTo(s*.35,s*.44);g.lineTo(s*.5,s*.84);g.stroke();
    },
    yin(g,s) {
      const r=s*.38,x=s/2,y=s/2;g.fillStyle='#20202c';g.beginPath();g.arc(x,y,r,0,6.283);g.fill();
      g.fillStyle='#eee8cf';g.beginPath();g.arc(x,y,r,-Math.PI/2,Math.PI/2);g.arc(x,y+r/2,r/2,Math.PI/2,-Math.PI/2,true);g.arc(x,y-r/2,r/2,Math.PI/2,-Math.PI/2);g.fill();
      for(const [dy,color] of [[-r/2,'#20202c'],[r/2,'#eee8cf']]){g.fillStyle=color;g.beginPath();g.arc(x,y+dy,r*.13,0,6.283);g.fill();}
      g.strokeStyle='#e7bd73';g.lineWidth=s*.018;g.beginPath();g.arc(x,y,r,0,6.283);g.stroke();
    },
    current(g,s,color) {
      const r=s/2;g.translate(r,r);g.strokeStyle=color;g.lineWidth=s*.018;
      for(let i=0;i<7;i++){g.save();g.rotate(i*6.283/7);g.beginPath();g.moveTo(0,0);g.lineTo(s*.13,s*.045);g.lineTo(s*.21,-s*.04);g.lineTo(s*.32,s*.015);g.lineTo(s*.43,-s*.03);g.stroke();g.restore();}
    },
    drum(g,s,color) {
      const r=s/2;g.translate(r,r);
      g.fillStyle='#342b46';g.strokeStyle=color;g.lineWidth=s*0.035;
      g.beginPath();g.arc(0,0,s*0.4,0,6.283);g.fill();g.stroke();
      g.fillStyle='#daceac';g.beginPath();g.arc(0,0,s*0.31,0,6.283);g.fill();
      g.fillStyle='#554766';
      for(let i=0;i<3;i++){
        g.save();g.rotate(i*6.283/3);g.beginPath();g.moveTo(0,-s*0.24);
        g.bezierCurveTo(s*0.15,-s*0.25,s*0.2,-s*0.08,s*0.06,s*0.03);
        g.bezierCurveTo(s*0.09,-s*0.07,-s*0.1,-s*0.08,0,-s*0.24);g.fill();g.restore();
      }
    },
    seal(g, s, color) {
      g.fillStyle = color; g.fillRect(s*0.32,s*0.08,s*0.36,s*0.84);
      g.strokeStyle = '#822c32'; g.lineWidth = s*0.04;
      g.strokeRect(s*0.38,s*0.16,s*0.24,s*0.68);
      g.beginPath();g.moveTo(s*0.42,s*0.3);g.lineTo(s*0.6,s*0.4);g.lineTo(s*0.43,s*0.57);g.lineTo(s*0.56,s*0.73);g.stroke();
    },
    glow(g, s, color) {
      const r = s / 2, grad = g.createRadialGradient(r, r, 0, r, r, r);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(0.18, rgba(color, 0.95));
      grad.addColorStop(0.5, rgba(color, 0.32));
      grad.addColorStop(1, rgba(color, 0));
      g.fillStyle = grad;
      g.fillRect(0, 0, s, s);
    },
    spark(g, s, color) {
      const r = s / 2;
      const star = (len, pinch, fill) => {
        g.beginPath();
        for (let i = 0; i < 4; i++) {
          const a = i * Math.PI / 2, b = a + Math.PI / 4;
          g.lineTo(r + Math.cos(a) * len, r + Math.sin(a) * len);
          g.lineTo(r + Math.cos(b) * len * pinch, r + Math.sin(b) * len * pinch);
        }
        g.closePath();
        g.fillStyle = fill;
        g.fill();
      };
      const halo = g.createRadialGradient(r, r, 0, r, r, r * 0.55);
      halo.addColorStop(0, rgba(color, 0.7));
      halo.addColorStop(1, rgba(color, 0));
      g.fillStyle = halo;
      g.fillRect(0, 0, s, s);
      star(r * 0.98, 0.12, rgba(color, 0.95));
      star(r * 0.55, 0.16, "rgba(255,255,255,0.98)");
    },
    ring(g, s, color) {
      const r = s / 2, grad = g.createRadialGradient(r, r, 0, r, r, r);
      grad.addColorStop(0, rgba(color, 0));
      grad.addColorStop(0.68, rgba(color, 0));
      grad.addColorStop(0.84, rgba(color, 0.5));
      grad.addColorStop(0.92, "rgba(255,255,255,0.95)");
      grad.addColorStop(0.97, rgba(color, 0.4));
      grad.addColorStop(1, rgba(color, 0));
      g.fillStyle = grad;
      g.fillRect(0, 0, s, s);
    },
    rune1(g, s, color) { runeArt(g, s, color, 1); },
    rune2(g, s, color) { runeArt(g, s, color, 2); },
    rune3(g, s, color) { runeArt(g, s, color, 3); },
    // 火舌以實色輪廓與小面積火芯分層，不使用徑向光暈。
    flame(g, s, color) {
      const r = s / 2;
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(r, s * 0.02);
      g.bezierCurveTo(r + r * 0.95, s * 0.5, r + r * 0.8, s * 0.97, r, s * 0.97);
      g.bezierCurveTo(r - r * 0.8, s * 0.97, r - r * 0.95, s * 0.5, r, s * 0.02);
      g.fill();
      g.fillStyle = '#ffe7a2'; g.beginPath();
      g.moveTo(r,s*0.35); g.lineTo(s*0.63,s*0.82); g.lineTo(s*0.44,s*0.88); g.closePath();g.fill();
    }
  };

  const SIZE = { glow: 64, spark: 64, ring: 128, rune1: 192, rune2: 192, rune3: 224, flame: 64, shard: 48, stroke: 64, edge: 128, seal: 64, storm:256, drum:128,rock:128,yin:128,current:128 };

  function sprite(kind, color) {
    const key = `${kind}|${color}`;
    if (!sprites.has(key)) sprites.set(key, bake(SIZE[kind], (g, s) => PAINT[kind](g, s, color)));
    return sprites.get(key);
  }

  const count = n => {
    const c = n * budget * (calm ? 0.4 : 1);
    return Math.floor(c) + (Math.random() < c % 1 ? 1 : 0);
  };

  // o.sy：垂直壓扁比例（45 度俯瞰的地面圖案用）；o.ground：畫在角色後方的地面層。
  function add(kind, color, o) {
    const priority=o.priority??(kind==='stroke'||kind==='seal'||(o.ground&&(kind.startsWith('rune')||kind==='storm'||kind==='edge')));
    if (ps.length >= MAX) {
      if(!priority)return;
      const disposable=ps.findIndex(p=>!p.priority);if(disposable<0)return;
      ps[disposable]=ps[ps.length-1];ps.pop();
    }
    ps.push({
      kind, priority, blend: 'lighter',
      s: sprite(kind, color), x: 0, y: 0, vx: 0, vy: 0, drag: 0, g: 0, rot: 0, vr: 0, sx: 1, sy: 1, a: 1,
      s0: 16, s1: 16, delay: 0, ease: false, ground: false, ...o,
      ...(calm ? {vx:0,vy:0,vr:0,g:0,delay:0,s0:o.ground?(o.s1??o.s0??16):(o.s0??16),s1:o.ground?(o.s1??o.s0??16):(o.s0??16)} : {}),
      life: calm ? Math.min(o.life,0.3) : o.life, max: calm ? Math.min(o.life,0.3) : o.life
    });
  }

  // 一圈放射火花：基礎的命中／爆裂回饋
  function burst(x, y, color = "#ffe6aa", n = 12, o = {}) {
    const speed = o.speed || 260, life = o.life || 0.5, size = o.size || 16;
    if (!o.noPop) add("glow", color, { x, y, life: 0.16, s0: size * 2.2, s1: size * 3.6, a: 0.55 });
    for (let i = count(Math.min(n, 40)); i > 0; i--) {
      const a = rnd(0, 6.2832), v = speed * rnd(0.35, 1);
      const star = Math.random() < 0.45;
      add(star ? "spark" : "glow", color, {
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 3.4, g: o.g || 0,
        life: life * rnd(0.6, 1.1), s0: star ? size * rnd(1, 1.7) : size * rnd(0.5, 1), s1: 2,
        rot: rnd(0, 6.28), vr: rnd(-6, 6), a: 0.95
      });
    }
  }

  // 閃電折線：o.h 高度、o.w 粗細倍率、o.jag 抖動幅度
  function bolt(x, y, o = {}) {
    const h = o.h || 620, jag = o.jag || 30, pts = [];
    let px = x + rnd(-40, 40), py = y - h;
    pts.push(px, py);
    for (let i = 1; i < 10; i++) {
      px = x + (px - x) * 0.55 + rnd(-jag, jag);
      py = y - h * (1 - i / 10);
      pts.push(px, py);
    }
    pts.push(x, y);
    bolts.push({ pts, life: o.life || 0.3, max: o.life || 0.3, w: o.w || 1, a: o.a || 1, halo: o.halo ?? 0.28, delay: o.delay || 0 });
    if (bolts.length > 12) bolts.shift();
  }

  // 妖怪消散：幾縷靈魂光絮往上飄
  function death(x, y, color = "#bce9ff", big = false) {
    add("ring", color, { x, y, life: 0.32, s0: 14, s1: big ? 150 : 70, a: 0.8, ease: true });
    for (let i = count(big ? 16 : 5); i > 0; i--) {
      add("glow", i % 2 ? color : "#ffffff", {
        x: x + rnd(-14, 14), y: y + rnd(-10, 10), vx: rnd(-26, 26), vy: -rnd(40, 110), drag: 0.9,
        life: rnd(0.6, 1.1), s0: rnd(18, 32), s1: 4, a: 0.7
      });
    }
    burst(x, y, color, big ? 26 : 10, { speed: big ? 360 : 240, size: big ? 18 : 14 });
  }

  function gem(x, y) {
    add("spark", "#7fe8ff", { x, y, vy: -60, drag: 2, life: 0.35, s0: 26, s1: 4, rot: 0.4, vr: 6 });
    add("glow", "#bff6ff", { x, y, life: 0.25, s0: 36, s1: 8, a: 0.7 });
  }

  function levelUp(x, y) {
    add("glow", "#ffe28b", { x, y: y - 120, life: 0.7, s0: 90, s1: 40, sx: 7, rot: -Math.PI / 2, a: 0.55 });
    add("ring", "#ffd36a", { x, y, life: 0.7, s0: 40, s1: 420, a: 0.95, ease: true });
    add("ring", "#ffffff", { x, y, life: 0.55, delay: 0.08, s0: 30, s1: 300, a: 0.8, ease: true });
    for (let i = count(26); i > 0; i--) {
      add(i % 3 ? "glow" : "spark", i % 2 ? "#ffe28b" : "#fff6d0", {
        x: x + rnd(-60, 60), y: y + rnd(-10, 30), vx: rnd(-30, 30), vy: -rnd(120, 320), drag: 0.8,
        life: rnd(0.7, 1.3), s0: rnd(14, 30), s1: 3, rot: rnd(0, 6), vr: rnd(-4, 4), a: 0.9
      });
    }
  }

  function deliver(x, y) {
    add("ring", "#ffe28b", { x, y, life: 0.6, s0: 30, s1: 300, a: 0.95, ease: true });
    add("glow", "#fff2b8", { x, y, life: 0.4, s0: 120, s1: 260, a: 0.45 });
    for (let i = count(30); i > 0; i--) {
      const a = rnd(-3.4, 0.25);
      add("glow", ["#ffe28b", "#ffb3d9", "#fff6d0"][i % 3], {
        x, y, vx: Math.cos(a) * rnd(120, 340), vy: Math.sin(a) * rnd(160, 380), drag: 1.4, g: 330,
        life: rnd(0.8, 1.4), s0: rnd(14, 26), s1: 4, a: 0.95
      });
    }
  }

  function dashTrail(x, y, dx, dy) {
    const ang = Math.atan2(dy, dx);
    for (let i = 0; i < 6; i++) {
      add("glow", i % 2 ? "#bfeeff" : "#ffffff", {
        x: x - dx * i * 16, y: y - dy * i * 16, life: 0.28 + i * 0.03, s0: 54 - i * 4, s1: 6, sx: 2.3, rot: ang, a: 0.55 - i * 0.05
      });
    }
  }

  function flash(color, life, power) {
    if (calm) return;
    flashColor = color; flashMax = flashT = life; flashPower = power;
  }

  function update(dt) {
    avgDt += (dt - avgDt) * 0.05;
    // 實測 460 顆粒子上限下 update＋draw 約 0.7ms，所以只在掉到約 25fps 以下才縮減粒子量（30fps 螢幕不受影響）。
    if (avgDt > 0.04) budget = Math.max(0.5, budget - 0.012);
    else if (avgDt < 0.036) budget = Math.min(1, budget + 0.004);
    if ((calmCheck -= dt) <= 0) {
      calmCheck = 1;
      calm = !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    }
    flashT = Math.max(0, flashT - dt);
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      if (p.delay > 0) { p.delay -= dt; continue; }
      p.life -= dt;
      if (p.life <= 0) { ps[i] = ps[ps.length - 1]; ps.pop(); continue; }
      if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
      p.vy += p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    for (let i = bolts.length - 1; i >= 0; i--) {
      if (bolts[i].delay > 0) { bolts[i].delay -= dt; continue; }
      if ((bolts[i].life -= dt) <= 0) bolts.splice(i, 1);
    }
  }

  function paint(ctx, p) {
    const t = 1 - p.life / p.max, k = p.ease ? 1 - (1 - t) * (1 - t) : t;
    const size = p.s0 + (p.s1 - p.s0) * k;
    const a = p.a * Math.min(1, t * 9) * (1 - t * t);
    if (a < 0.02 || size < 1) return;
    ctx.globalAlpha = a;
    if(p.foot){
      ctx.save();ctx.translate(p.x,p.y);ctx.fillStyle='rgba(12,17,24,0.25)';
      ctx.beginPath();ctx.ellipse(0,0,size*.32,size*.09,0,0,6.283);ctx.fill();
      ctx.drawImage(p.s,-size/2,-size*.96,size,size);ctx.restore();return;
    }
    if (p.rot === 0 && p.sx === 1 && p.sy === 1 && p.vr === 0) {
      ctx.drawImage(p.s, p.x - size / 2, p.y - size / 2, size, size);
    } else {
      ctx.save();
      ctx.translate(p.x, p.y);
      if (p.sy !== 1) ctx.scale(1, p.sy);
      ctx.rotate(p.rot);
      ctx.drawImage(p.s, -size * p.sx / 2, -size / 2, size * p.sx, size);
      ctx.restore();
    }
  }

  // 在世界座標（已套用鏡頭位移）上加法繪製。view 為螢幕可視範圍，用來裁切。
  // ground=true 畫地面層（咒陣等，要在角色之前、被角色蓋住）；false 畫空中層。
  function drawLayer(ctx, cam, view, ground) {
    const x0 = cam.x + view.left, x1 = cam.x + view.right;
    const y0 = cam.y + view.top, y1 = cam.y + view.bottom;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const p of ps) {
      const margin = Math.max(p.s0,p.s1) * Math.max(1,Math.abs(p.sx),Math.abs(p.sy)) / 2;
      if (p.ground !== ground || p.delay > 0 || !p.s || p.x+margin < x0 || p.x-margin > x1 || p.y+margin < y0 || p.y-margin > y1) continue;
      ctx.globalCompositeOperation = p.blend;
      paint(ctx, p);
    }
    ctx.restore();
  }

  function drawGround(ctx, cam, view) {
    if (ps.length) drawLayer(ctx, cam, view, true);
  }

  function draw(ctx, cam, view) {
    if (!ps.length && !bolts.length) return;
    drawLayer(ctx, cam, view, false);
    if (!bolts.length) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    for (const b of bolts) {
      if (b.delay > 0) continue;
      const a = Math.min(1, b.life / b.max * 1.6) * b.a;
      const trace = () => { ctx.beginPath(); for (let i = 0; i < b.pts.length; i += 2) ctx[i ? "lineTo" : "moveTo"](b.pts[i], b.pts[i + 1]); ctx.stroke(); };
      ctx.strokeStyle = "#ffd54f"; ctx.lineWidth = 16 * b.w; ctx.globalAlpha = a * b.halo; trace();
      ctx.strokeStyle = "#fff6a8"; ctx.lineWidth = 7 * b.w; ctx.globalAlpha = a * 0.7; trace();
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = Math.max(1, 2.6 * b.w); ctx.globalAlpha = a; trace();
    }
    ctx.restore();
  }

  // 螢幕空間的一瞬白光（落雷、Boss 破防）
  function drawFlash(ctx, area) {
    if (flashT <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = flashPower * (flashT / flashMax);
    ctx.fillStyle = flashColor;
    ctx.fillRect(area.left, area.top, area.width, area.height);
    ctx.restore();
  }

  // 給 UI／場景直接用的一次性發光貼圖（不進粒子池）
  function glow(ctx, x, y, size, color = "#ffd36a", alpha = 1) {
    const s = sprite("glow", color);
    if (!s || alpha <= 0.01) return;
    const prev = ctx.globalCompositeOperation, pa = ctx.globalAlpha;
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = pa * alpha;
    ctx.drawImage(s, x - size / 2, y - size / 2, size, size);
    ctx.globalAlpha = pa;
    ctx.globalCompositeOperation = prev;
  }

  function reset() { ps.length = 0; bolts.length = 0; flashT = 0; }

  return {
    // 通用原語：給技能特效檔（skillfx.js）組裝用
    emit: add, count, rnd, bolt, allowsMotion: () => !calm,
    burst, death, gem, levelUp, deliver, dashTrail, flash, update, draw, drawGround, drawFlash, glow, reset,
    stats: () => ({ particles: ps.length, budget, bolts: bolts.length }),
    particles: () => ps // 供測試檢查圖層與透明度，請勿在遊戲邏輯中修改
  };
})();
