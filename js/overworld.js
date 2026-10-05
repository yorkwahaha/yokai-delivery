// SMB3-inspired node-path overworld: large scrolling map, miniature courier movement, stage landmarks.
(() => {
  const root = typeof window !== "undefined" ? window : globalThis;
  const readableFont = (size, weight = "700") => root.UI?.readableFont ? root.UI.readableFont(size, weight) : `${weight} ${size}px sans-serif`;
  const MAP_W = 1800;
  const MAP_H = 1050;
  const VIEW_W = 900;
  const VIEW_H = 600;
  const BACK_BTN = Object.freeze({ x: 18, y: 18, w: 104, h: 40 });
  const backButton = () => ({...BACK_BTN,x:BACK_BTN.x+(root.VIEWPORT?.bounds().left || 0),y:BACK_BTN.y+(root.VIEWPORT?.bounds().top || 0)});
  const ENTER_BTN = Object.freeze({ x: 768, y: 512, w: 112, h: 62 });

  const NODES = Object.freeze([
    Object.freeze({ id: "gate", x: 210, y: 820, type: "waypoint", label: "旅立ち" }),
    Object.freeze({ id: "night-town", x: 470, y: 760, type: "stage", stageId: "night-town", label: "夜行町", sub: "よるのはいそう", enterable: true, landmark: "town" }),
    Object.freeze({ id: "cross-west", x: 720, y: 690, type: "waypoint", label: "分かれ道", unlockAfter: "night-town" }),
    Object.freeze({ id: "rain-port", x: 800, y: 900, type: "stage", stageId: "rain-port", label: "雨夜港町", sub: "あめよのみなと", enterable: true, landmark: "port", unlockAfter: "night-town" }),
    Object.freeze({ id: "sakura-pass", x: 980, y: 535, type: "stage", stageId: "sakura-pass", label: "妖櫻山道", sub: "ようざくらさんどう", enterable: false, landmark: "sakura", unlockAfter: "rain-port" }),
    Object.freeze({ id: "cross-east", x: 1215, y: 500, type: "waypoint", label: "古道", unlockAfter: "rain-port" }),
    Object.freeze({ id: "lookout", x: 1260, y: 755, type: "waypoint", label: "見晴台", unlockAfter: "rain-port" }),
    Object.freeze({ id: "hyakki-kyoto", x: 1460, y: 555, type: "stage", stageId: "hyakki-kyoto", label: "百鬼京都", sub: "ひゃっききょうと", enterable: false, landmark: "kyoto", unlockAfter: "sakura-pass" }),
    Object.freeze({ id: "yomi", x: 1605, y: 285, type: "stage", stageId: "yomi", label: "黃泉境", sub: "よみのさかい", enterable: false, landmark: "yomi", unlockAfter: "hyakki-kyoto" })
  ]);

  const EDGES = Object.freeze([
    Object.freeze(["gate", "night-town"]),
    Object.freeze(["night-town", "cross-west"]),
    Object.freeze(["cross-west", "rain-port"]),
    Object.freeze(["cross-west", "sakura-pass"]),
    Object.freeze(["sakura-pass", "cross-east"]),
    Object.freeze(["cross-east", "lookout"]),
    Object.freeze(["cross-east", "hyakki-kyoto"]),
    Object.freeze(["hyakki-kyoto", "yomi"])
  ]);

  const nodeById = new Map(NODES.map(n => [n.id, n]));
  const adjacency = new Map(NODES.map(n => [n.id, []]));
  for (const [a, b] of EDGES) {
    adjacency.get(a).push(b);
    adjacency.get(b).push(a);
  }

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const ease = t => t * t * (3 - 2 * t);

  function createState(startId = "gate") {
    const node = nodeById.get(startId) || NODES[0];
    const area = root.VIEWPORT?.bounds() || {left:0,top:0,right:VIEW_W,bottom:VIEW_H};
    return {
      currentId: node.id,
      x: node.x,
      y: node.y,
      fromId: null,
      targetId: null,
      moveT: 0,
      moveDuration: 0.42,
      camX: clamp(node.x - VIEW_W / 2, -area.left, MAP_W - area.right),
      camY: clamp(node.y - VIEW_H / 2, -area.top, MAP_H - area.bottom)
    };
  }

  function currentNode(state) {
    return nodeById.get(state.currentId) || NODES[0];
  }

  function isMoving(state) {
    return !!state.targetId;
  }

  function isNodeAccessible(node) {
    if (!node) return false;
    if (!node.unlockAfter) return true;
    if (root.STORE && typeof root.STORE.isStageCompleted === "function") {
      return root.STORE.isStageCompleted(node.unlockAfter);
    }
    return false;
  }

  function isEnterable(node) {
    if (!node || node.type !== "stage") return false;
    const stage = root.CONTENT && root.CONTENT.getStage ? root.CONTENT.getStage(node.stageId) : null;
    const implemented = stage && typeof stage.implemented === "boolean" ? stage.implemented : !!node.enterable;
    const unlocked = root.STORE && typeof root.STORE.isStageUnlocked === "function"
      ? root.STORE.isStageUnlocked(node.stageId)
      : stage?.unlockedByDefault !== false;
    return implemented && unlocked && isNodeAccessible(node);
  }

  function moveTo(state, targetId) {
    if (!state || isMoving(state)) return false;
    const options = adjacency.get(state.currentId) || [];
    if (!options.includes(targetId)) return false;
    const from = currentNode(state);
    const to = nodeById.get(targetId);
    if (!to) return false;
    if (!isNodeAccessible(to) || (to.type === "stage" && !isEnterable(to))) {
      return false;
    }
    state.fromId = from.id;
    state.targetId = to.id;
    state.moveT = 0;
    state.moveDuration = clamp(Math.hypot(to.x - from.x, to.y - from.y) / 440, 0.42, 0.72);
    return true;
  }

  function move(state, dx, dy) {
    if (!state || isMoving(state)) return false;
    const len = Math.hypot(dx, dy);
    if (len < 0.1) return false;
    dx /= len;
    dy /= len;

    const from = currentNode(state);
    let best = null;
    let bestScore = 0.22;
    for (const id of adjacency.get(from.id) || []) {
      const to = nodeById.get(id);
      const vx = to.x - from.x;
      const vy = to.y - from.y;
      const d = Math.hypot(vx, vy) || 1;
      const dot = (vx / d) * dx + (vy / d) * dy;
      const score = dot - Math.min(0.12, d / 5000);
      if (score > bestScore) {
        bestScore = score;
        best = id;
      }
    }
    return best ? moveTo(state, best) : false;
  }

  function update(state, dt) {
    if (!state) return;

    if (state.targetId) {
      const from = nodeById.get(state.fromId);
      const to = nodeById.get(state.targetId);
      state.moveT = Math.min(1, state.moveT + dt / state.moveDuration);
      const t = ease(state.moveT);
      state.x = from.x + (to.x - from.x) * t;
      state.y = from.y + (to.y - from.y) * t;
      if (state.moveT >= 1) {
        state.currentId = to.id;
        state.x = to.x;
        state.y = to.y;
        state.fromId = null;
        state.targetId = null;
        state.moveT = 0;
      }
    }

    const area = root.VIEWPORT?.bounds() || {left:0,top:0,right:VIEW_W,bottom:VIEW_H};
    const targetCamX = clamp(state.x - VIEW_W / 2, -area.left, MAP_W - area.right);
    const targetCamY = clamp(state.y - VIEW_H / 2, -area.top, MAP_H - area.bottom);
    const k = Math.min(1, dt * 6.5);
    state.camX += (targetCamX - state.camX) * k;
    state.camY += (targetCamY - state.camY) * k;
  }

  function confirm(state) {
    if (!state || isMoving(state)) return { ok: false, moving: true };
    const node = currentNode(state);
    if (node.type !== "stage") return { ok: false, waypoint: true };
    if (!isEnterable(node)) {
      return { ok: false, locked: true, stageId: node.stageId, name: node.label };
    }
    return { ok: true, stageId: node.stageId, name: node.label };
  }

  function hitTest(state, sx, sy, radius = 52) {
    const wx = sx + state.camX;
    const wy = sy + state.camY;
    let best = null;
    let bestD = radius;
    for (const node of NODES) {
      const d = Math.hypot(wx - node.x, wy - node.y);
      if (d < bestD) {
        best = node;
        bestD = d;
      }
    }
    return best;
  }

  function drawRoad(ctx, a, b) {
    const open = [a,b].every(node => node.type === 'stage' ? isEnterable(node) : isNodeAccessible(node));
    const ax = a.x, ay = a.y, bx = b.x, by = b.y;
    ctx.lineCap = "round";
    ctx.strokeStyle = open ? "rgba(20, 28, 34, 0.56)" : "rgba(34, 31, 42, 0.38)";
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();

    ctx.strokeStyle = open ? "rgba(220, 200, 154, 0.72)" : "rgba(122, 111, 132, 0.42)";
    ctx.lineWidth = 9;
    ctx.setLineDash([20, 11]);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawMountain(ctx, x, y, s = 1) {
    ctx.fillStyle = "rgba(49, 66, 58, 0.9)";
    ctx.beginPath();
    ctx.moveTo(x - 74 * s, y + 54 * s);
    ctx.lineTo(x, y - 72 * s);
    ctx.lineTo(x + 76 * s, y + 54 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(223, 228, 214, 0.72)";
    ctx.beginPath();
    ctx.moveTo(x - 25 * s, y - 29 * s);
    ctx.lineTo(x, y - 72 * s);
    ctx.lineTo(x + 25 * s, y - 29 * s);
    ctx.lineTo(x + 9 * s, y - 35 * s);
    ctx.lineTo(x, y - 22 * s);
    ctx.lineTo(x - 10 * s, y - 36 * s);
    ctx.closePath();
    ctx.fill();
  }

  function drawLandmark(ctx, node, elapsed, selected) {
    const canEnter = isEnterable(node);
    const accessible = isNodeAccessible(node);
    const pulse = selected && !root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ? 1 + Math.sin(elapsed * 5) * 0.05 : 1;
    ctx.save();
    ctx.translate(node.x, node.y);
    ctx.scale(pulse, pulse);

    if (selected) {
      ctx.strokeStyle = canEnter ? "rgba(255, 226, 130, 0.95)" : "rgba(196, 156, 220, 0.9)";
      ctx.lineWidth = 4;
      ctx.shadowColor = canEnter ? "#ffe082" : "#a86bd1";
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(0, 0, 49, 0, Math.PI * 2);
      ctx.stroke();

    }

    if (node.type === "waypoint") {
      ctx.fillStyle = accessible ? "#d8c8a0" : "#756c76";
      ctx.strokeStyle = accessible ? "#594d3a" : "#403744";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (!accessible) {
        ctx.fillStyle = "#e3c6ef";
        ctx.font = readableFont(12, "900");
        ctx.textAlign = "center";
        ctx.fillText("封", 0, 4);
      }
      ctx.restore();
      return;
    }

    ctx.fillStyle = "rgba(28, 35, 42, 0.88)";
    ctx.strokeStyle = canEnter ? "#d9b957" : "#77667e";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const artKey = node.landmark === 'town' ? 'map_night_town_v1' : node.landmark === 'port' ? 'map_rain_port_v1' : null;
    const landmarkArt = artKey && root.ART?.[artKey];
    const completed = canEnter && !!root.STORE?.isStageCompleted?.(node.stageId);
    if (landmarkArt?.naturalWidth && root.RENDERER?.drawFrame) {
      root.RENDERER.drawFrame(ctx,landmarkArt,artKey,completed?1:0,0,32,100);
    } else if (node.landmark === "town") {
      const img = root.ART && root.ART.house_tavern;
      if (img && img.complete && img.naturalWidth) ctx.drawImage(img, -40, -55, 80, 72);
      else {
        ctx.fillStyle = "#d98d4e";
        ctx.fillRect(-23, -22, 46, 34);
        ctx.fillStyle = "#4b2d25";
        ctx.beginPath();
        ctx.moveTo(-30, -22); ctx.lineTo(0, -47); ctx.lineTo(30, -22); ctx.closePath(); ctx.fill();
      }
    } else if (node.landmark === "port") {
      ctx.strokeStyle = "#8ed7ee";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 4, 18, 0.1, Math.PI - 0.1);
      ctx.stroke();
      ctx.fillStyle = "#d7edf4";
      ctx.beginPath();
      ctx.moveTo(-20, 8); ctx.lineTo(18, 8); ctx.lineTo(8, 23); ctx.lineTo(-13, 23); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#d7edf4"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(0, -24); ctx.stroke();
    } else if (node.landmark === "sakura") {
      const img = root.ART && root.ART.prop_sakura;
      if (img && img.complete && img.naturalWidth) ctx.drawImage(img, -39, -68, 78, 82);
      else {
        ctx.fillStyle = "#ffb8d4";
        for (let i = 0; i < 5; i++) {
          const a = i * Math.PI * 0.4 - Math.PI / 2;
          ctx.beginPath(); ctx.arc(Math.cos(a) * 16, Math.sin(a) * 16, 12, 0, Math.PI * 2); ctx.fill();
        }
      }
    } else if (node.landmark === "kyoto") {
      const img = root.ART && root.ART.prop_torii;
      if (img && img.complete && img.naturalWidth) ctx.drawImage(img, -42, -61, 84, 84);
      else {
        ctx.strokeStyle = "#d44737"; ctx.lineWidth = 7;
        ctx.beginPath(); ctx.moveTo(-24, 27); ctx.lineTo(-24, -24); ctx.moveTo(24, 27); ctx.lineTo(24, -24); ctx.moveTo(-34, -22); ctx.lineTo(34, -22); ctx.stroke();
      }
    } else {
      const g = ctx.createRadialGradient(0, 0, 3, 0, 0, 28);
      g.addColorStop(0, "rgba(213, 111, 255, 0.9)");
      g.addColorStop(0.55, "rgba(90, 25, 120, 0.82)");
      g.addColorStop(1, "rgba(20, 10, 32, 0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.fill();
    }

    if (!canEnter) {
      ctx.fillStyle = "rgba(16, 13, 24, 0.58)";
      ctx.beginPath(); ctx.arc(0, 0, 37, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#e3c6ef";
      ctx.font = readableFont(Math.max(22, Math.ceil(18 / (root.VIEWPORT?.get?.().scale || 1))), "700").replace("'Noto Sans JP'", "'Kaisei Decol'");
      ctx.textAlign = "center";
      ctx.fillText("封", 0, 8);
    } else if (completed) {
      ctx.save();ctx.translate(37,24);ctx.rotate(-0.12);
      ctx.fillStyle='#f5e4bd';ctx.fillRect(-15,-16,30,32);
      ctx.strokeStyle='#9e3327';ctx.lineWidth=2;ctx.strokeRect(-15,-16,30,32);
      ctx.fillStyle='#9e3327';ctx.font=readableFont(20,'900');ctx.textAlign='center';ctx.fillText('済',0,8);ctx.restore();
    }

    ctx.restore();

    ctx.save();
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(12,14,28,0.9)";
    ctx.beginPath();ctx.roundRect(node.x-104,node.y+43,208,node.sub?46:28,7);ctx.fill();
    ctx.font = readableFont(16, "900");
    ctx.fillStyle = canEnter ? "#fff0c2" : "#d4bcdf";
    ctx.fillText(node.label, node.x, node.y + 62);
    ctx.font = readableFont(11, "700");
    ctx.fillStyle = "#c1c9dd";
    ctx.fillText(node.sub || "", node.x, node.y + 79);
    ctx.restore();
  }

  function drawMiniPlayer(ctx, state, elapsed) {
    const motion = !root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const bob = motion ? Math.sin(elapsed * 7) * 3 : 0;
    const walking = isMoving(state);
    const walkFrame = Math.floor(elapsed * 10) % 2 === 0 ? "player_walk1" : "player_walk2";
    const img = root.ART && (walking && motion ? (root.ART[walkFrame] || root.ART.player) : root.ART.player);
    // 到站時站在町屋旁，沿路平滑插值顯示位移，不改節點／命中座標。
    const from = nodeById.get(state.fromId) || currentNode(state), to = nodeById.get(state.targetId) || from;
    const u = walking ? ease(clamp(state.moveT/state.moveDuration,0,1)) : 0;
    const fx = from.type === 'stage' ? -75 : 0, fy = from.type === 'stage' ? 23 : -35;
    const tx = to.type === 'stage' ? -75 : 0, ty = to.type === 'stage' ? 23 : -35;
    ctx.save();
    ctx.translate(state.x+fx+(tx-fx)*u, state.y+fy+(ty-fy)*u+bob);
    if (img && img.complete && img.naturalWidth) {
      const h = 108;
      const w = h * img.naturalWidth / img.naturalHeight;
      ctx.shadowColor = "rgba(0,0,0,0.45)";
      ctx.shadowBlur = 7;
      ctx.drawImage(img, -w / 2, -h + 12, w, h);
    } else {
      ctx.fillStyle = "#fff3d3";
      ctx.beginPath(); ctx.arc(0, -9, 17, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#d27b47";
      ctx.beginPath(); ctx.moveTo(-13, -20); ctx.lineTo(-7, -38); ctx.lineTo(-1, -19); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(13, -20); ctx.lineTo(7, -38); ctx.lineTo(1, -19); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function drawMist(ctx, elapsed) {
    const motion = !root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const t = motion ? elapsed : 0;
    // 谷地緩慢平移；霧在道路、地標與角色下方，不擋選關。
    [[410,560,210],[880,360,230],[1330,710,250],[1580,230,180]].forEach(([x,y,r],i)=>{
      const drift=Math.sin(t*0.09+i*1.7)*65;
      ctx.save();ctx.translate(x+drift,y);ctx.scale(1,0.23);
      const g=ctx.createRadialGradient(0,0,0,0,0,r);
      g.addColorStop(0,'rgba(190,216,235,0.18)');g.addColorStop(0.55,'rgba(190,216,235,0.07)');g.addColorStop(1,'rgba(190,216,235,0)');
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.restore();
    });
  }

  let mapBase = null;
  function drawMapBase(ctx) {
    ctx.fillStyle = "#9dc7be";
    ctx.fillRect(0, 0, MAP_W, MAP_H);

    // Large land mass.
    ctx.fillStyle = "#c9c59b";
    ctx.beginPath();
    ctx.moveTo(70, 920);
    ctx.bezierCurveTo(210, 610, 300, 540, 560, 470);
    ctx.bezierCurveTo(840, 390, 1120, 250, 1360, 180);
    ctx.bezierCurveTo(1570, 120, 1735, 130, 1770, 250);
    ctx.lineTo(1720, 790);
    ctx.bezierCurveTo(1450, 860, 1220, 820, 1010, 930);
    ctx.bezierCurveTo(720, 1065, 390, 1045, 70, 920);
    ctx.closePath();
    ctx.fill();

    // Rivers and bays.
    ctx.strokeStyle = "rgba(94, 151, 165, 0.92)";
    ctx.lineWidth = 42;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(1110, 180);
    ctx.bezierCurveTo(1090, 380, 1180, 560, 1050, 790);
    ctx.bezierCurveTo(980, 900, 920, 970, 860, 1040);
    ctx.stroke();

    ctx.fillStyle = "rgba(105, 160, 170, 0.82)";
    ctx.beginPath();
    ctx.ellipse(820, 930, 220, 95, -0.08, 0, Math.PI * 2);
    ctx.fill();

    drawMountain(ctx, 1030, 300, 1.05);
    drawMountain(ctx, 1270, 250, 0.8);
    drawMountain(ctx, 1500, 190, 0.68);

    // Forest clusters.
    for (const [x, y] of [[350,610],[410,570],[560,590],[1180,650],[1320,700],[1510,710],[1410,360]]) {
      ctx.fillStyle = "rgba(66, 112, 73, 0.78)";
      ctx.beginPath(); ctx.arc(x, y, 30, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(48, 88, 60, 0.62)";
      ctx.beginPath(); ctx.arc(x + 20, y + 18, 24, 0, Math.PI * 2); ctx.fill();
    }

  }

  function draw(ctx, state, elapsed, noticeT = 0) {
    ctx.save();
    const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    sky.addColorStop(0, "#d9d5b6");
    sky.addColorStop(0.55, "#a7c1a0");
    sky.addColorStop(1, "#73958b");
    ctx.fillStyle = sky;
    const area = root.VIEWPORT?.bounds() || {left:0,top:0,width:VIEW_W,height:VIEW_H};
    ctx.fillRect(area.left, area.top, area.width, area.height);

    ctx.save();
    ctx.translate(-state.camX, -state.camY);

    const background = root.ART?.overworld_night_v2;
    if (background?.naturalWidth) {
      ctx.drawImage(background,0,0,MAP_W,MAP_H);
    } else {
    if (!mapBase && root.document?.createElement) {
      mapBase = root.document.createElement('canvas');mapBase.width=MAP_W;mapBase.height=MAP_H;
      drawMapBase(mapBase.getContext('2d'));
    }
    if(mapBase)ctx.drawImage(mapBase,0,0);else drawMapBase(ctx);
    }

    drawMist(ctx,elapsed);
    for (const [a, b] of EDGES) drawRoad(ctx, nodeById.get(a), nodeById.get(b));

    const selectedId = state.targetId || state.currentId;
    for (const node of NODES) {
      if(node.x+140<state.camX+area.left||node.x-140>state.camX+area.left+area.width||node.y+140<state.camY+area.top||node.y-140>state.camY+area.top+area.height)continue;
      drawLandmark(ctx,node,elapsed,node.id===selectedId);
    }

    drawMiniPlayer(ctx, state, elapsed);
    ctx.restore();

    // Fixed UI: title + current location only. No stage cards.
    ctx.fillStyle = "rgba(16, 23, 27, 0.78)";
    const titleFont = readableFont(Math.max(24, Math.ceil(18 / (root.VIEWPORT?.get?.().scale || 1))), "700").replace("'Noto Sans JP'", "'Kaisei Decol'");
    const subtitleFont = readableFont(12,"700");
    const titleSize = Number(titleFont.match(/([\d.]+)px/)[1]), subtitleSize = Number(subtitleFont.match(/([\d.]+)px/)[1]);
    const titleY = area.top+Math.max(32,titleSize);
    const subtitleY = titleY+Math.max(21,(titleSize+subtitleSize)/2+4);
    ctx.fillRect(area.left, area.top, area.width, Math.max(72,subtitleY-area.top+subtitleSize*.25+6));
    const back = backButton();
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff1bd";
    ctx.font = titleFont;
    ctx.fillText("妖怪快遞社・旅路圖", VIEW_W / 2, titleY);
    ctx.font = subtitleFont;
    ctx.fillStyle = "rgba(255,255,255,0.68)";
    ctx.fillText("道をたどって、次の配達先へ", VIEW_W / 2, subtitleY);

    ctx.fillStyle = "rgba(19, 24, 30, 0.82)";
    ctx.beginPath(); ctx.roundRect(back.x, back.y, back.w, back.h, 10); ctx.fill();
    ctx.strokeStyle = "rgba(255,236,190,0.6)"; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.textAlign = "center"; ctx.fillStyle = "#fff0c2"; ctx.font = readableFont(13, "900");
    ctx.fillText("← 首頁", back.x + back.w / 2, back.y + 25);

    const here = currentNode(state);
    if (here.type === "stage" && !isMoving(state)) {
      const canEnter = isEnterable(here);
      const panelW = 380, panelH = 100, px = VIEW_W / 2 - panelW / 2, py = VIEW_H - 116;
      ctx.fillStyle = canEnter ? "rgba(31, 25, 20, 0.91)" : "rgba(30, 24, 34, 0.91)";
      ctx.beginPath(); ctx.roundRect(px, py, panelW, panelH, 14); ctx.fill();
      ctx.strokeStyle = canEnter ? "#e4c264" : "#80668a"; ctx.lineWidth = 2; ctx.stroke();
      ctx.textAlign = "center";
      ctx.fillStyle = canEnter ? "#ffe6a5" : "#e0c8e7";
      ctx.font = readableFont(19, "900");
      const completed = canEnter && !!root.STORE?.isStageCompleted?.(here.stageId);
      ctx.fillText(here.label+(completed?'・配達済':''), VIEW_W / 2, py + 25);
      ctx.font = readableFont(12, "800");
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      const best = root.STORE?.getStageStats?.(here.stageId)?.bestScore || 0;
      ctx.fillText(canEnter ? (best ? `最高 ${best.toLocaleString()} 點` : '尚無配達紀錄') : '封印中・後續開放', VIEW_W / 2, py + 52);
      if(canEnter)ctx.fillText('配達開始　Enter / A', VIEW_W / 2, py + 82);

      if (canEnter) {
        const glow = root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ? 0.72 : 0.72 + Math.sin(elapsed * 5) * 0.18;
        ctx.fillStyle = `rgba(121, 78, 28, ${glow})`;
        ctx.beginPath(); ctx.roundRect(ENTER_BTN.x, ENTER_BTN.y, ENTER_BTN.w, ENTER_BTN.h, 16); ctx.fill();
        ctx.strokeStyle = "#ffe39a"; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = "#fff2c6"; ctx.font = readableFont(15, "900");
        ctx.fillText("出發", ENTER_BTN.x + ENTER_BTN.w / 2, ENTER_BTN.y + 37);
      }
    } else {
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(20, 27, 31, 0.7)";
      ctx.beginPath(); ctx.roundRect(VIEW_W / 2 - 180, VIEW_H - 54, 360, 34, 12); ctx.fill();
      ctx.fillStyle = "#fff1c9"; ctx.font = readableFont(12, "800");
      ctx.fillText("方向鍵 / 搖桿 / 點擊相鄰地標移動", VIEW_W / 2, VIEW_H - 32);
    }

    if (noticeT > 0) {
      const a = Math.min(1, noticeT * 2);
      ctx.fillStyle = `rgba(44, 18, 53, ${0.9 * a})`;
      ctx.beginPath(); ctx.roundRect(VIEW_W / 2 - 150, 92, 300, 48, 12); ctx.fill();
      ctx.strokeStyle = `rgba(220, 180, 235, ${a})`; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = `rgba(248, 225, 255, ${a})`; ctx.font = readableFont(15, "900");
      ctx.fillText("未開放或尚未解鎖", VIEW_W / 2, 122);
    }

    ctx.restore();
  }

  const api = {
    MAP_W,
    MAP_H,
    VIEW_W,
    VIEW_H,
    BACK_BTN, backButton,
    ENTER_BTN,
    NODES,
    EDGES,
    createState,
    currentNode,
    isMoving,
    isNodeAccessible,
    isEnterable,
    move,
    moveTo,
    update,
    confirm,
    hitTest,
    draw
  };

  root.OVERWORLD = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
