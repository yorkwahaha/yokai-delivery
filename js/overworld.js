// SMB3-inspired node-path overworld: large scrolling map, miniature courier movement, stage landmarks.
(() => {
  const root = typeof window !== "undefined" ? window : globalThis;
  const readableFont = (size, weight = "700") => root.UI?.readableFont ? root.UI.readableFont(size, weight) : `${weight} ${size}px sans-serif`;
  // 旅路專用字體：木牌/標題用和風明朝，資訊正文用穩定無襯線。
  // 以既有 readableFont 取得小畫面的可讀像素，不增加一套字型下載。
  const mapFont = (size, heading = false) => {
    const px = Number(readableFont(size, heading ? "700" : "800").match(/([\d.]+)px/)?.[1]) || size;
    return heading
      ? `700 ${px}px 'Kaisei Decol', 'Noto Serif TC', 'PMingLiU', serif`
      : `800 ${px}px 'Noto Sans JP', 'Microsoft JhengHei', sans-serif`;
  };
  const MAP_TEXT = Object.freeze({
    ink: "#39261d", muted: "#53382a", pale: "#fff0d8",
    lightEdge: "rgba(255,248,228,.88)", darkEdge: "rgba(52,25,20,.87)"
  });
  function drawMapText(ctx, value, x, y, {size=14,heading=false,light=false,maxWidth}={}) {
    ctx.save();
    ctx.textAlign="center";
    ctx.font=mapFont(size,heading);
    ctx.lineJoin="round";
    ctx.lineWidth=light ? 2.4 : 1.5;
    ctx.strokeStyle=light ? MAP_TEXT.darkEdge : MAP_TEXT.lightEdge;
    if (typeof ctx.strokeText==="function") ctx.strokeText(value,x,y,maxWidth);
    ctx.fillStyle=light ? MAP_TEXT.pale : (heading ? MAP_TEXT.ink : MAP_TEXT.muted);
    ctx.fillText(value,x,y,maxWidth);
    ctx.restore();
  }
  const LAYOUT = root.OVERWORLD_LAYOUT || (typeof module !== "undefined" && module.exports ? require("./overworld-layout.js") : null);
  const BACKGROUND_PLACEMENT = LAYOUT?.background || {x:0,y:0,width:3000};
  // A1 approved world anchors, A2 verified portrait-safe visible extent.
  // Keep the five original stage IDs and four historical waypoint IDs for save compatibility.
  const MAP_W = 3000;
  const MAP_H = 2200;
  const VIEW_W = 900;
  const VIEW_H = 600;
  const BACK_BTN = Object.freeze({ x: 18, y: 18, w: 104, h: 40 });
  const backButton = () => ({...BACK_BTN,x:BACK_BTN.x+(root.VIEWPORT?.bounds().left || 0),y:BACK_BTN.y+(root.VIEWPORT?.bounds().top || 0)});
  const ENTER_BTN = Object.freeze({ x: 768, y: 512, w: 112, h: 62 });
  const enterButton = () => {
    const area = root.VIEWPORT?.bounds() || {right:VIEW_W,bottom:VIEW_H};
    return {...ENTER_BTN,x:area.right-132,y:area.bottom-88};
  };
  const BROWSE_BTN = Object.freeze({w:54,h:52});
  const browseButtons = () => {
    const area = root.VIEWPORT?.bounds() || {left:0,right:VIEW_W,bottom:VIEW_H};
    return [{id:"previous",x:area.left+18,y:area.bottom-196,w:54,h:52},
            {id:"next",x:area.right-72,y:area.bottom-196,w:54,h:52}];
  };

  const NODES = Object.freeze([
    {id:"gate",x:180,y:1210,type:"waypoint",label:"旅立ち"},
    {id:"night-town",x:390,y:1180,type:"stage",stageId:"night-town",label:"夜行町",sub:"よるのはいそう",enterable:true,landmark:"town"},
    {id:"cross-west",x:565,y:1220,type:"waypoint",label:"分かれ道",unlockAfter:"night-town"},
    {id:"rain-port",x:730,y:1330,type:"stage",stageId:"rain-port",label:"雨夜港町",sub:"あめよのみなと",enterable:true,landmark:"port",unlockAfter:"night-town"},
    {id:"port-rise",x:910,y:1150,type:"waypoint",label:"港後坡",unlockAfter:"night-town"},
    {id:"sakura-pass",x:1070,y:975,type:"stage",stageId:"sakura-pass",label:"妖櫻山道",sub:"ようざくらさんどう",enterable:true,landmark:"sakura",unlockAfter:"rain-port"},
    {id:"cross-east",x:1220,y:830,type:"waypoint",label:"古道",unlockAfter:"rain-port"},
    {id:"bamboo-maze",x:1380,y:720,type:"stage",stageId:"bamboo-maze",label:"竹影迷宮",sub:"たけかげめいろ",enterable:true,landmark:"bamboo",unlockAfter:"sakura-pass"},
    {id:"bamboo-exit",x:1520,y:845,type:"waypoint",label:"竹林出口",unlockAfter:"sakura-pass"},
    {id:"hyakki-kyoto",x:1710,y:955,type:"stage",stageId:"hyakki-kyoto",label:"百鬼京都",sub:"ひゃっききょうと",enterable:true,landmark:"kyoto",unlockAfter:"bamboo-maze"},
    {id:"lookout",x:1900,y:780,type:"waypoint",label:"見晴台",unlockAfter:"bamboo-maze"},
    {id:"snow-temple",x:2080,y:555,type:"stage",stageId:"snow-temple",label:"雪燈山寺",sub:"せつとうさんじ",enterable:true,landmark:"snow",unlockAfter:"hyakki-kyoto"},
    {id:"snow-pass",x:2260,y:740,type:"waypoint",label:"雪路",unlockAfter:"hyakki-kyoto"},
    {id:"spirit-ferry",x:2430,y:1040,type:"stage",stageId:"spirit-ferry",label:"幽世渡口",sub:"かくりよわたし",enterable:true,landmark:"ferry",unlockAfter:"snow-temple"},
    {id:"yomi-ford",x:2585,y:770,type:"waypoint",label:"幽河彼岸",unlockAfter:"snow-temple"},
    {id:"yomi-ascent",x:2675,y:545,type:"waypoint",label:"黃泉斜坡",unlockAfter:"spirit-ferry"},
    {id:"yomi",x:2770,y:375,type:"stage",stageId:"yomi",label:"黃泉境",sub:"よみのさかい",enterable:true,landmark:"yomi",unlockAfter:"spirit-ferry"}
  ].map(n => {
    const override = LAYOUT?.nodes?.[n.id], route = override?.route;
    const x = Number.isFinite(route?.x) ? route.x : n.x;
    const y = Number.isFinite(route?.y) ? route.y : n.y;
    if (n.type !== "stage") return Object.freeze({...n,x,y});
    const a=override?.art || {}, l=override?.label || {};
    const art = Object.freeze({x:Number.isFinite(a.x)?a.x:x,y:Number.isFinite(a.y)?a.y:y,
      scale:Number.isFinite(a.scale)?Math.max(.25,Math.min(2.5,a.scale)):1});
    const labelPlacement = Object.freeze({x:Number.isFinite(l.x)?l.x:x,y:Number.isFinite(l.y)?l.y:y+43,
      width:Number.isFinite(l.width)?Math.max(100,Math.min(330,l.width)):208});
    return Object.freeze({...n,x,y,art,labelPlacement});
  }));

  const EDGES = Object.freeze([
    ["gate","night-town"],["night-town","cross-west"],["cross-west","rain-port"],
    ["rain-port","port-rise"],["port-rise","sakura-pass"],["sakura-pass","cross-east"],
    ["cross-east","bamboo-maze"],["bamboo-maze","bamboo-exit"],["bamboo-exit","hyakki-kyoto"],
    ["hyakki-kyoto","lookout"],["lookout","snow-temple"],["snow-temple","snow-pass"],
    ["snow-pass","spirit-ferry"],["spirit-ferry","yomi-ford"],["yomi-ford","yomi-ascent"],
    ["yomi-ascent","yomi"]
  ].map(Object.freeze));
  const STAGE_NODES = Object.freeze(NODES.filter(n=>n.type==="stage"));
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
      inspectId: null, // Camera-only browsing does not teleport the courier.
      x: node.x,
      y: node.y,
      facing: 1, // Right-facing source sprite; keep the last movement direction while idle.
      fromId: null,
      targetId: null,
      pathQueue: [],
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

  function selectedNode(state) {
    return nodeById.get(state?.inspectId) || currentNode(state);
  }

  // Locked future stages can be *viewed* without allowing travel or play.
  function inspect(state, stageId) {
    const node = nodeById.get(stageId);
    if (!state || !node || node.type !== "stage" || isMoving(state)) return false;
    state.inspectId = node.id;
    return true;
  }

  function browse(state, direction) {
    if (!state || isMoving(state) || !direction) return false;
    const index = STAGE_NODES.findIndex(n => n.id === selectedNode(state).id);
    // When standing on a waypoint, start from the first playable stage.
    const nextIndex = index < 0 ? (direction > 0 ? 0 : STAGE_NODES.length-1) : Math.max(0, Math.min(STAGE_NODES.length-1, index+(direction>0?1:-1)));
    state.inspectId = STAGE_NODES[nextIndex].id;
    return true;
  }

  function clearInspect(state) {
    if (state) state.inspectId = null;
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
    // Guard new placeholders: getStage() falls back to night-town for unknown IDs.
    const implemented = node.enterable !== false && stage?.id === node.stageId && stage.implemented === true;
    const unlocked = root.STORE && typeof root.STORE.isStageUnlocked === "function"
      ? root.STORE.isStageUnlocked(node.stageId)
      : stage?.unlockedByDefault !== false;
    return implemented && unlocked && isNodeAccessible(node);
  }

  function findPath(fromId, targetId) {
    if (fromId === targetId) return [];
    const queue = [[fromId]];
    const visited = new Set([fromId]);
    while (queue.length > 0) {
      const path = queue.shift();
      const curr = path[path.length - 1];
      for (const nextId of adjacency.get(curr) || []) {
        if (visited.has(nextId)) continue;
        const nextNode = nodeById.get(nextId);
        if (!nextNode) continue;
        const canStep = isNodeAccessible(nextNode) && (nextNode.type !== "stage" || isEnterable(nextNode));
        if (!canStep) continue;
        visited.add(nextId);
        const newPath = [...path, nextId];
        if (nextId === targetId) return newPath.slice(1);
        queue.push(newPath);
      }
    }
    return null;
  }

  function moveTo(state, targetId) {
    if (!state || isMoving(state)) return false;
    const from = currentNode(state);
    const to = nodeById.get(targetId);
    if (!to) return false;
    if (!isNodeAccessible(to) || (to.type === "stage" && !isEnterable(to))) {
      return false;
    }
    clearInspect(state);
    const options = adjacency.get(state.currentId) || [];
    if (options.includes(targetId)) {
      state.pathQueue = [];
      if (Math.abs(to.x - from.x) > 0.5) state.facing = to.x > from.x ? 1 : -1;
      state.fromId = from.id;
      state.targetId = to.id;
      state.moveT = 0;
      state.moveDuration = clamp(Math.hypot(to.x - from.x, to.y - from.y) / 440, 0.42, 0.72);
      return true;
    }
    const path = findPath(state.currentId, targetId);
    if (!path || path.length === 0) return false;
    const firstStep = nodeById.get(path[0]);
    state.pathQueue = path.slice(1);
    if (Math.abs(firstStep.x - from.x) > 0.5) state.facing = firstStep.x > from.x ? 1 : -1;
    state.fromId = from.id;
    state.targetId = firstStep.id;
    state.moveT = 0;
    state.moveDuration = clamp(Math.hypot(firstStep.x - from.x, firstStep.y - from.y) / 440, 0.42, 0.72);
    return true;
  }

  function move(state, dx, dy) {
    if (!state || isMoving(state)) return false;
    state.pathQueue = [];
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
        if (state.pathQueue && state.pathQueue.length > 0) {
          const nextTarget = state.pathQueue.shift();
          const remaining = state.pathQueue;
          if (moveTo(state, nextTarget)) state.pathQueue = remaining;
          else state.pathQueue = [];
        }
      }
    }

    const area = root.VIEWPORT?.bounds() || {left:0,top:0,right:VIEW_W,bottom:VIEW_H};
    const focus = !isMoving(state) ? nodeById.get(state.inspectId) : null;
    const centerX = focus?.x ?? state.x, centerY = focus?.y ?? state.y;
    const targetCamX = clamp(centerX - VIEW_W / 2, -area.left, Math.max(-area.left, MAP_W - area.right));
    const targetCamY = clamp(centerY - VIEW_H / 2, -area.top, Math.max(-area.top, MAP_H - area.bottom));
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
    const wx = sx + state.camX, wy = sy + state.camY;
    let best = null, bestD = radius;
    for (const node of NODES) {
      const d = Math.hypot(wx - node.x, wy - node.y);
      // Name plaques are genuine interactive targets, including future stages.
      const plate=node.labelPlacement;
      const onPlaque = plate && Math.abs(wx-plate.x) <= plate.width/2+4 && wy >= plate.y && wy <= plate.y+46;
      const onArt=node.art && Math.hypot(wx-node.art.x,wy-node.art.y)<52*node.art.scale;
      if (onPlaque || onArt) return node;
      if (d < bestD) { best = node; bestD = d; }
    }
    return best;
  }

  function drawRoad(ctx, a, b) {
    const open = [a,b].every(node => node.type === 'stage' ? isEnterable(node) : isNodeAccessible(node));
    const ax = a.x, ay = a.y, bx = b.x, by = b.y;
    ctx.lineCap = "round";
    ctx.strokeStyle = open ? "rgba(56, 38, 27, 0.42)" : "rgba(58, 45, 43, 0.24)";
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();

    ctx.strokeStyle = open ? "rgba(248, 218, 161, 0.76)" : "rgba(168, 149, 124, 0.50)";
    ctx.lineWidth = 5;
    ctx.setLineDash([10, 12]);
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
      ctx.strokeStyle = canEnter ? "rgba(195, 67, 50, 0.94)" : "rgba(116, 91, 84, 0.86)";
      ctx.lineWidth = 4;
      ctx.shadowColor = "rgba(82, 42, 27, 0.45)";
      ctx.shadowBlur = 5;
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

    ctx.fillStyle = "rgba(237, 216, 171, 0.88)";
    ctx.strokeStyle = canEnter ? "#9c4c35" : "#75665c";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Route marker and decorative artwork are independent editable anchors.
    ctx.restore();
    ctx.save();
    const art=node.art||{x:node.x,y:node.y,scale:1};
    ctx.translate(art.x,art.y);
    ctx.scale(art.scale,art.scale);

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
    const label=node.labelPlacement || {x:node.x,y:node.y+43,width:208};
    const labelPlate={x:label.x-label.width/2,y:label.y,w:label.width,h:node.sub?46:28};
    if (root.UI?.drawWoodTag) root.UI.drawWoodTag(ctx,labelPlate,"normal",!canEnter,true);
    else {ctx.fillStyle="rgba(240,219,182,.95)";ctx.beginPath();ctx.roundRect(labelPlate.x,labelPlate.y,labelPlate.w,labelPlate.h,4);ctx.fill();}
    // 牌面是淺和紙：改深墨字而非白字，細米白外緣像刻入木牌的字。
    drawMapText(ctx,node.label,label.x,label.y+17,{size:15,heading:true,maxWidth:label.width-20});
    drawMapText(ctx,node.sub||"",label.x,label.y+32,{size:11,maxWidth:label.width-25});
    ctx.restore();
  }

  function drawMiniPlayer(ctx, state, elapsed) {
    root.loadMapPlayerArt?.();
    const motion = !root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const bob = motion ? Math.sin(elapsed * 7) * 3 : 0;
    const walking = isMoving(state);
    const walkFrame = Math.floor(elapsed * 10) % 2 === 0 ? "player_walk_left_v2" : "player_walk_right_v2";
    const oldFrame = Math.floor(elapsed * 10) % 2 === 0 ? "player_walk1" : "player_walk2";
    const img = root.ART && (walking && motion
      ? (root.ART[walkFrame] || root.ART[oldFrame] || root.ART.player)
      : (root.ART.player_idle_v2 || root.ART.player_walk_left_v2 || root.ART.player));
    // 到站時站在町屋旁，沿路平滑插值顯示位移，不改節點／命中座標。
    const from = nodeById.get(state.fromId) || currentNode(state), to = nodeById.get(state.targetId) || from;
    const u = walking ? ease(clamp(state.moveT/state.moveDuration,0,1)) : 0;
    const fx = from.type === 'stage' ? -75 : 0, fy = from.type === 'stage' ? 23 : -35;
    const tx = to.type === 'stage' ? -75 : 0, ty = to.type === 'stage' ? 23 : -35;
    ctx.save();
    ctx.translate(state.x+fx+(tx-fx)*u, state.y+fy+(ty-fy)*u+bob);
    // Both walk sprites face right (they are alternating foot poses, not directions).
    // Mirror locally for leftward hops; preserves pivot, size and animation frame timing.
    if (state.facing === -1) ctx.scale(-1, 1);
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
    [[460,1150,210],[985,890,230],[1560,780,250],[2280,640,200],[2710,510,210]].forEach(([x,y,r],i)=>{
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
    const area = root.VIEWPORT?.bounds() || {left:0,top:0,right:VIEW_W,bottom:VIEW_H,width:VIEW_W,height:VIEW_H};
    ctx.fillRect(area.left, area.top, area.width, area.height);

    ctx.save();
    ctx.translate(-state.camX, -state.camY);

    // A4：只繪製選定的純地景圖片；既有道路、木牌、角色與按鈕維持獨立可操作的 Canvas 圖層。
    const background = root.ART?.overworld_approved_v2 || root.ART?.overworld_ukiyoe_v3 || root.ART?.overworld_night_v2;
    if (background?.naturalWidth) {
      // Do not distort the approved 1672×941 artwork to a 3000×2200 portrait-safe world.
      // The extra southern world margin is a softly mirrored misty extension; no second download.
      const bgX=Number.isFinite(BACKGROUND_PLACEMENT.x)?BACKGROUND_PLACEMENT.x:0;
      const bgY=Number.isFinite(BACKGROUND_PLACEMENT.y)?BACKGROUND_PLACEMENT.y:0;
      const bgW=Number.isFinite(BACKGROUND_PLACEMENT.width)?BACKGROUND_PLACEMENT.width:MAP_W;
      const mainH = Math.round(bgW * (background.naturalHeight || 941) / background.naturalWidth);
      const edgeY=bgY+mainH;
      const top = state.camY + area.top, bottom = state.camY + area.bottom;
      if (top < edgeY && bottom > bgY) ctx.drawImage(background, bgX, bgY, bgW, mainH);
      if (edgeY < MAP_H && bottom > edgeY) {
        const extensionH = MAP_H - edgeY;
        const sourceH = Math.min(240, background.naturalHeight || 941);
        ctx.save();
        ctx.translate(bgX, edgeY);
        ctx.scale(1, -1);
        ctx.drawImage(background, 0, background.naturalHeight - sourceH, background.naturalWidth, sourceH,
          0, -extensionH, bgW, extensionH);
        ctx.restore();
        const fog = ctx.createLinearGradient(0, edgeY, 0, MAP_H);
        fog.addColorStop(0, "rgba(218,218,206,0.03)");
        fog.addColorStop(1, "rgba(212,218,218,0.72)");
        ctx.fillStyle = fog;
        ctx.fillRect(bgX, edgeY, bgW, extensionH);
      }
    } else {
    if (!mapBase && root.document?.createElement) {
      mapBase = root.document.createElement('canvas');mapBase.width=MAP_W;mapBase.height=MAP_H;
      drawMapBase(mapBase.getContext('2d'));
    }
    if(mapBase)ctx.drawImage(mapBase,0,0);else drawMapBase(ctx);
    }

    drawMist(ctx,elapsed);
    const visibleLeft = state.camX + area.left - 28, visibleRight = state.camX + area.right + 28;
    const visibleTop = state.camY + area.top - 28, visibleBottom = state.camY + area.bottom + 28;
    for (const [a, b] of EDGES) {
      const from=nodeById.get(a),to=nodeById.get(b);
      if (Math.max(from.x,to.x)<visibleLeft || Math.min(from.x,to.x)>visibleRight ||
          Math.max(from.y,to.y)<visibleTop || Math.min(from.y,to.y)>visibleBottom) continue;
      drawRoad(ctx,from,to);
    }

    const selectedId = state.targetId || state.inspectId || state.currentId;
    for (const node of NODES) {
      const a=node.art, l=node.labelPlacement;
      const xs=[node.x,a?.x??node.x,l?.x??node.x],ys=[node.y,a?.y??node.y,l?.y??node.y];
      if(Math.max(...xs)+160<visibleLeft||Math.min(...xs)-160>visibleRight||Math.max(...ys)+150<visibleTop||Math.min(...ys)-150>visibleBottom)continue;
      drawLandmark(ctx,node,elapsed,node.id===selectedId);
    }

    drawMiniPlayer(ctx, state, elapsed);
    ctx.restore();

    // 旅路固定 UI 沿用暫停與結算的紙札素材，不覆蓋現代黑卡。
    const titleFont = mapFont(Math.max(24, Math.ceil(18 / (root.VIEWPORT?.get?.().scale || 1))),true);
    const subtitleFont = mapFont(12);
    const titleSize = Number(titleFont.match(/([\d.]+)px/)[1]), subtitleSize = Number(subtitleFont.match(/([\d.]+)px/)[1]);
    const titleY = area.top+Math.max(32,titleSize);
    const subtitleY = titleY+Math.max(21,(titleSize+subtitleSize)/2+4);
    const fade=ctx.createLinearGradient(0,area.top,0,area.top+105);
    fade.addColorStop(0,"rgba(21,17,21,.58)");fade.addColorStop(1,"rgba(21,17,21,0)");
    ctx.fillStyle=fade;ctx.fillRect(area.left,area.top,area.width,105);
    const titlePlate={x:VIEW_W/2-191,y:area.top-1,w:382,h:Math.max(75,subtitleY-area.top+19)};
    root.UI?.drawWoodTag?.(ctx,titlePlate,"primary");
    const back = backButton();
    drawMapText(ctx,"妖怪快遞社・旅路圖",VIEW_W/2,titleY-4,{size:titleSize,heading:true,light:true,maxWidth:330});
    drawMapText(ctx,"道をたどって、次の配達先へ",VIEW_W/2,subtitleY-4,{size:subtitleSize,light:true,maxWidth:330});

    if (root.UI?.drawButton) root.UI.drawButton(ctx,{...back,id:"map-home"},"← 首頁",{size:14,quiet:true,scrollText:true,mapTypography:"title"});
    else {ctx.fillStyle="#eed6ae";ctx.fillRect(back.x,back.y,back.w,back.h);drawMapText(ctx,"← 首頁",back.x+back.w/2,back.y+24,{size:14,heading:true,maxWidth:back.w-12});}

    // Browse arrows only pan the camera; they never change the courier's actual location.
    const arrows = browseButtons();
    for (const button of arrows) {
      const label = button.id === "previous" ? "◀" : "▶";
      if (root.UI?.drawButton) root.UI.drawButton(ctx,{...button,id:"map-"+button.id},label,{size:19,quiet:true,mapTypography:"body",visualOffsetY:-4});
      else {ctx.fillStyle="#dfc6a5";ctx.fillRect(button.x,button.y,button.w,button.h);
        ctx.fillStyle="#39291f";ctx.font=readableFont(17,"900");ctx.textAlign="center";
        ctx.fillText(label,button.x+button.w/2,button.y+30);}
    }
    const here = selectedNode(state);
    if (here.type === "stage" && !isMoving(state)) {
      const canEnter = isEnterable(here);
      const panelW = 380, panelH = 100, px = VIEW_W / 2 - panelW / 2, py = area.bottom - 116;
      if(root.UI?.drawWashiBoard)root.UI.drawWashiBoard(ctx,px,py,panelW,panelH,true);
      else{ctx.fillStyle="#eed6ae";ctx.beginPath();ctx.roundRect(px,py,panelW,panelH,8);ctx.fill();}
      // 讓中心紙面略微明亮，保留木框與花紋，避免一般 UI 白字浮在插畫上。
      const cx=px+panelW/2,cy=py+panelH/2;
      const paper=ctx.createRadialGradient(cx,cy,18,cx,cy,166);
      paper.addColorStop(0,"rgba(255,249,229,.72)");
      paper.addColorStop(.66,"rgba(254,246,221,.48)");
      paper.addColorStop(1,"rgba(254,246,221,0)");
      ctx.fillStyle=paper;
      ctx.fillRect(px+35,py+9,panelW-70,panelH-18);
      const completed = !!root.STORE?.isStageCompleted?.(here.stageId);
      const chapter = STAGE_NODES.findIndex(n=>n.id===here.id)+1;
      drawMapText(ctx,`${chapter}/8　${here.label}${completed?'・配達済':''}`,cx,py+28,{size:19,heading:true,maxWidth:panelW-105});
      const best = root.STORE?.getStageStats?.(here.stageId)?.bestScore || 0;
      const atStage = !state.inspectId || state.inspectId === state.currentId;
      const progress=canEnter ? (best ? `最高 ${best.toLocaleString()} 點` : "尚無配達紀錄")
        : (root.CONTENT?.getStage?.(here.stageId)?.implemented ? "尚未解鎖" : "封印中・後續開放");
      drawMapText(ctx,progress,cx,py+55,{size:13,maxWidth:panelW-112});
      if(canEnter)drawMapText(ctx,atStage?"配達開始　Enter / A":"前往這一關・沿路移動",cx,py+81,{size:12,maxWidth:panelW-112});

      if (canEnter) {
        const enter = enterButton(), title = atStage ? "出發" : "前往";
        if(root.UI?.drawButton)root.UI.drawButton(ctx,{...enter,id:"map-enter"},title,{tone:"primary",size:18,scrollText:true,focus:true,mapTypography:true});
        else {ctx.fillStyle="#9c4535";ctx.fillRect(enter.x,enter.y,enter.w,enter.h);
          ctx.fillStyle="#fff2c6";ctx.font=readableFont(15,"900");ctx.fillText(title,enter.x+enter.w/2,enter.y+37);}
      }
    } else {
      ctx.textAlign = "center";
      if(root.UI?.drawWoodTag)root.UI.drawWoodTag(ctx,{x:VIEW_W/2-180,y:area.bottom-54,w:360,h:34},"normal",false,true);
      else{ctx.fillStyle="#eed6ae";ctx.fillRect(VIEW_W/2-180,area.bottom-54,360,34);}
      drawMapText(ctx,"方向鍵移動・◀ ▶ 看八關・點擊木牌選關",VIEW_W/2,area.bottom-36,{size:12,maxWidth:318});
    }

    if (noticeT > 0) {
      const a = Math.min(1, noticeT * 2);
      ctx.globalAlpha=a;
      if(root.UI?.drawWoodTag)root.UI.drawWoodTag(ctx,{x:VIEW_W/2-150,y:area.top+92,w:300,h:48},"danger");
      else{ctx.fillStyle="#7b3935";ctx.fillRect(VIEW_W/2-150,area.top+92,300,48);}
      drawMapText(ctx,"未開放或尚未解鎖",VIEW_W/2,area.top+122,{size:15,heading:true,light:true,maxWidth:245});
    }

    ctx.restore();
  }

  const api = {
    MAP_W,
    MAP_H,
    STAGE_NODES,
    browseButtons,
    enterButton,
    selectedNode,
    inspect,
    browse,
    clearInspect,
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
    findPath,
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
