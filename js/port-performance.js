(() => {
  "use strict";
  const WINDOW_FRAMES = 600;
  const HISTORY_LIMIT = 246;
  const comparisons = {
    uiShadows: ["HUD 陰影","cached","original","off"],
    lighting: ["光照","original","direct","off"],
    damageText: ["傷害數字","original","atlas","off"],
    fxBatch: ["粒子來源","original","canvas","image","bitmap"],
    smoothQuality: ["圖片取樣","medium","low","high"],
    gemBatch: ["靈玉繪製","ordered","original"],
    terrainCache: ["地形快取","original","projected","repaint","direct"],
    rainBatch: ["雨絲描線",false,true],
    bossRaster: ["雨港 Boss 貼圖",false,true],
    sanctuaryPulse: ["靈陣地面脈衝","original","single"]
  };
  const defaults = Object.freeze({array:true, rain:true, accents:true, airParticles:true, gems:null, rank:null,
    resolution:1, hold:false, detail:false,
    ...Object.fromEntries(Object.entries(comparisons).map(([key,[,initial]]) => [key,initial]))});
  const particleSources = new WeakMap();
  function registerParticleSource(image, kind, sourceType) {
    particleSources.set(image,{kind,sourceType});
  }
  const round = n => Math.round(n * 100) / 100;
  const clock = () => performance.now();
  const endpoint = /^\d{1,3}(?:\.\d{1,3}){3}$/;
  function allowedHost(host) {
    if (["localhost","127.0.0.1","[::1]","::1"].includes(host)) return true;
    if (!endpoint.test(host)) return false;
    const octets = host.split(".").map(Number);
    const [a,b] = octets;
    return octets.every(n => n <= 255) && (a === 10 || a === 192 && b === 168 || a === 172 && b >= 16 && b <= 31);
  }

  function percentiles(values) {
    if (!values.length) return null;
    values.sort((a,b) => a-b);
    const at = p => round(values[Math.ceil(values.length * p) - 1]);
    return {p50:at(.5), p95:at(.95), p99:at(.99)};
  }

  function imageBounds(ctx, args, namedDimensions) {
    const [w,h] = namedDimensions;
    const [x,y,dw = w,dh = h] = args.length === 8 ? args.slice(4) : args;
    const m = ctx.getTransform?.();
    if (!m) return null;
    const x0 = m.a*x + m.c*y + m.e, y0 = m.b*x + m.d*y + m.f;
    const ax = m.a*dw, ay = m.b*dw, bx = m.c*dh, by = m.d*dh;
    const left = x0 + Math.min(0,ax) + Math.min(0,bx);
    const right = x0 + Math.max(0,ax) + Math.max(0,bx);
    const top = y0 + Math.min(0,ay) + Math.min(0,by);
    const bottom = y0 + Math.max(0,ay) + Math.max(0,by);
    return Math.max(0, Math.min(ctx.canvas.width,right) - Math.max(0,left)) *
      Math.max(0, Math.min(ctx.canvas.height,bottom) - Math.max(0,top));
  }

  function createDiagnostics({sampleEvery = 60, snapshot = () => ({})} = {}) {
    const fields = ["interval","callback","outside","entryLag","update","world","ui","effects","other"];
    const series = fields.map(() => new Float32Array(WINDOW_FRAMES));
    const tags = new Array(WINDOW_FRAMES);
    const contexts = new Map();
    const counts = Object.create(null), sources = new Map(), filters = new Map(), airParticleGroups = new Map();
    const history = [], drawHistory = [];
    let config = {...defaults};
    let position = 0, length = 0, last, frame, started, frames = 0, detailedFrames = 0;
    let nextSample = 0, nextHistory = 0, section = "world", inspecting = false, intervalSum = 0;

    function begin(timestamp, entry) {
      started ??= entry;
      frame = {timestamp, entry, update:0, world:0, ui:0, effects:0};
      section = "ui";
      frames++;
      inspecting = config.detail && frames % sampleEvery === 0;
      if (inspecting) detailedFrames++;
    }
    function invalidate() { last = undefined; }
    function end(exit, tag, visible, hud) {
      if (!frame) return;
      const finished = frame;
      finished.callback = exit - finished.entry;
      finished.tag = tag;
      finished.inspected = inspecting;
      frame = undefined;
      inspecting = false;
      if (!visible) { invalidate(); return; }
      const interval = last && finished.timestamp - last.timestamp;
      if (interval > 0 && !last.inspected && !finished.inspected) {
        const {callback, entry, timestamp, update, world, ui, effects} = last;
        intervalSum += interval - series[0][position];
        series[0][position] = interval;
        series[1][position] = callback;
        series[2][position] = Math.max(0,interval-callback);
        series[3][position] = Math.max(0,entry-timestamp);
        series[4][position] = update;
        series[5][position] = world;
        series[6][position] = ui;
        series[7][position] = effects;
        series[8][position] = Math.max(0,callback-update-world-ui);
        tags[position] = last.tag;
        position = (position + 1) % WINDOW_FRAMES;
        length = Math.min(length+1, WINDOW_FRAMES);
      }
      last = finished;
      if (exit >= nextSample && length) {
        nextSample = exit + 1000;
        const p95 = percentileAt(0).p95, gap = percentileAt(2).p50;
        const label = `FPS ${Math.round(1000*length/intervalSum)} | p95 ${p95}ms | gap ${gap}ms`;
        hud?.(label);
      }
      if (exit >= nextHistory) {
        nextHistory = exit + 5000;
        history.push({wallSeconds:round((exit-started)/1000), tag, config:{...config}, frame:timing(), state:snapshot()});
        if (history.length > HISTORY_LIMIT) history.shift();
      }
    }

    const percentileAt = i => percentiles(Array.from(series[i].subarray(0,length)));
    function timing() {
      if (!length) return {samples:0};
      const [interval, callback, outside, lag, update, world, ui, effects, other] =
        fields.map((_,i) => percentileAt(i));
      const canvas = percentiles(Array.from({length}, (_,i) => series[5][i]+series[6][i]));
      return {samples:length, fps:round(1000*length/intervalSum), intervalMs:interval, callbackMs:callback,
        outsideCallbackMs:outside, rafEntryLagMs:lag, updateMs:update, worldMs:world,
        uiMs:ui, canvasJsMs:canvas, effectsWithinWorldMs:effects, otherCallbackMs:other};
    }

    function byScene() {
      const groups = new Map();
      for (let i=0;i<length;i++) {
        const tag = tags[i];
        if (!groups.has(tag)) groups.set(tag,[]);
        groups.get(tag).push(series[0][i]);
      }
      return Object.fromEntries(Array.from(groups, ([tag, values]) =>
        [tag,{samples:values.length, intervalMs:percentiles(values)}]));
    }

    function instrument(ctx, surface) {
      const previous = contexts.get(surface);
      if (!ctx || previous?.ctx === ctx) return;
      if (previous) restore(previous);
      // A browser without Canvas filters can still accept ctx.filter as a JS
      // expando. save()/restore() will not track that value on such a browser.
      const prototype = Object.getPrototypeOf(ctx);
      const data = {ctx, surface, original:new Map(), filterSupported:!!prototype && "filter" in prototype};
      contexts.set(surface,data);
      if (config.detail) wrap(data);
    }
    function restore({ctx,original}) {
      for (const [method,native] of original) {
        if (native) ctx[method] = native;
        else delete ctx[method];
      }
      original.clear();
    }
    function wrap({ctx,surface,original,filterSupported}) {
      const stateCalls = new Set(["save","restore","translate","scale","rotate","transform","setTransform"]);
      for (const method of ["drawImage","fill","stroke","fillRect","clearRect","strokeRect","fillText","strokeText",...stateCalls]) {
        const native = ctx[method];
        if (typeof native !== "function") continue;
        original.set(method,Object.hasOwn(ctx,method) ? native : null);
        ctx[method] = function(...args) {
          if (inspecting) {
            const key = `${surface}/${section}`;
            const tally = counts[key] ??= {drawImage:0, imageBoundsPixels:0, translucentBoundsPixels:0,
              offscreenImages:0, filteredImages:0, shadowedOps:0, blendedOps:0};
            tally[method] = (tally[method] || 0) + 1;
            if (this.shadowBlur > 0 && !stateCalls.has(method)) tally.shadowedOps++;
            const blend = this.globalCompositeOperation || "source-over";
            if (blend !== "source-over" && !stateCalls.has(method)) tally.blendedOps++;
            if (method === "drawImage") {
              const source = args[0];
              const w = source.naturalWidth ?? source.width, h = source.naturalHeight ?? source.height;
              const pixels = imageBounds(this, args.slice(1), [w,h]);
              const boundsPixels = Math.round(pixels || 0);
              tally.imageBoundsPixels += boundsPixels;
              // RGBA images and offscreen canvases may have per-pixel alpha at globalAlpha=1.
              if (this.globalAlpha < 1 || source.naturalWidth !== undefined || section !== "map")
                tally.translucentBoundsPixels += boundsPixels;
              if (pixels === 0) tally.offscreenImages++;
              if (section === "particlesAir") {
                const particle = particleSources.get(source);
                if (particle) {
                  const key = `${particle.kind}/${particle.sourceType}/${blend}`;
                  let group = airParticleGroups.get(key);
                  if (!group) {
                    group = {...particle,blend,draws:0,boundsPixels:0,offscreenDraws:0};
                    airParticleGroups.set(key,group);
                  }
                  group.draws++;
                  group.boundsPixels += boundsPixels;
                  if (pixels === 0) group.offscreenDraws++;
                }
              }
              if (filterSupported) {
                const filter = String(this.filter || "none").trim();
                if (filter && filter !== "none") {
                  tally.filteredImages++;
                  const key = `${surface}/${filter}`;
                  if (filters.has(key) || filters.size < 24) filters.set(key,(filters.get(key) || 0)+1);
                }
              }
              const url = source.currentSrc || source.src;
              if (url && (sources.has(url) || sources.size < 192)) {
                const item = sources.get(url) || {width:w,height:h,draws:0, boundsPixels:0, peakBoundsPixels:0};
                item.draws++;
                item.boundsPixels += boundsPixels;
                item.peakBoundsPixels = Math.max(item.peakBoundsPixels, boundsPixels);
                sources.set(url,item);
              }
            }
          }
          return native.apply(this,args);
        };
      }
    }

    function configure(options) {
      const next = {...defaults,...options};
      if (![null,50,53,200,512].includes(next.gems) || ![null,1,5].includes(next.rank) ||
          ![.5,.75,1].includes(next.resolution)) throw new RangeError("Unsupported diagnostic fixture");
      for (const [key, [, ...values]] of Object.entries(comparisons)) {
        if (!values.includes(next[key])) throw new RangeError(`Unsupported diagnostic comparison: ${key}`);
      }
      for (const key of ["hold","detail","rain","array","accents","airParticles"]) next[key] = Boolean(next[key]);
      if (next.gems !== null || next.rank !== null) next.hold = true;
      if (detailedFrames) {
        drawHistory.push({config:{...config}, tag:last?.tag, frame:timing(), draw:drawReport()});
        if (drawHistory.length > 24) drawHistory.shift();
      }
      if (next.detail !== config.detail) {
        for (const data of contexts.values()) next.detail ? wrap(data) : restore(data);
      }
      config = Object.freeze(next);
      length = position = detailedFrames = 0;
      series[0].fill(0);
      intervalSum = 0;
      for (const key of Object.keys(counts)) delete counts[key];
      sources.clear();
      filters.clear();
      airParticleGroups.clear();
      invalidate();
      return config;
    }

    function drawReport() {
      return {sampledFrames:detailedFrames, passes:{...counts},
        airParticleGroups:[...airParticleGroups.values()].sort((a,b) => b.boundsPixels-a.boundsPixels),
        filterSupport:Object.fromEntries([...contexts].map(([surface,data]) => [surface,data.filterSupported])),
        filters:Object.fromEntries(filters), sources:[...sources].sort((a,b) => b[1].boundsPixels-a[1].boundsPixels).slice(0,25)};
    }

    return {begin,end,invalidate,configure,instrument,
      get config() { return config; },
      pass(name) { section = name; },
      time(name,ms) { if (frame) frame[name] += ms; },
      report: () => ({config:{...config}, frame:timing(), scenes:byScene(),
        recentIntervalsMs:Array.from({length}, (_,i) => round(series[0][(position-length+i+WINDOW_FRAMES)%WINDOW_FRAMES])),
        draw:drawReport(), drawHistory:[...drawHistory], history:[...history]})
    };
  }

  function monitorResources(root) {
    const totals = {imageRequests:0,responseMs:0,transferredBytes:0,zeroTransfer:0,dropped:0,longTasks:null};
    try {
      const observer = new root.PerformanceObserver((list, _, options) => {
        totals.dropped += options?.droppedEntriesCount || 0;
        for (const e of list.getEntries()) {
          if (!/\.(webp|png|jpe?g|svg|gif|avif)(\?|$)/i.test(e.name)) continue;
          totals.imageRequests++;
          totals.responseMs += e.duration;
          totals.transferredBytes += e.transferSize || 0;
          if (!e.transferSize) totals.zeroTransfer++;
        }
      });
      observer.observe({type:"resource", buffered:true});
      totals.supported = true;
    } catch { totals.supported = false; }
    if (root.PerformanceObserver?.supportedEntryTypes?.includes("longtask")) {
      const tasks = {count:0,totalMs:0,maxMs:0};
      try {
        const observer = new root.PerformanceObserver(list => {
          for (const e of list.getEntries()) {
            tasks.count++;
            tasks.totalMs += e.duration;
            tasks.maxMs = Math.max(tasks.maxMs,e.duration);
          }
        });
        observer.observe({type:"longtask",buffered:true});
        totals.longTasks = tasks;
      } catch { /* support reporting is optional */ }
    }
    return totals;
  }

  function mountPanel(doc, api, platform = globalThis) {
    const panel = doc.createElement("details");
    panel.style.cssText = "position:fixed;z-index:35;left:50%;bottom:env(safe-area-inset-bottom,0px);transform:translateX(-50%);max-width:92vw;padding:3px 8px;background:#121d2a;color:#f1f8ff;font:13px system-ui";
    const summary = doc.createElement("summary");
    summary.textContent = "效能實驗";
    const select = doc.createElement("select");
    select.setAttribute("aria-label","效能實驗條件");
    const scenarios = [
      ["H 實玩與長期採樣",{}], ["A 定格・完整畫質",{hold:true}],
      ["B 定格・隔離大型靈陣",{hold:true,array:false}],
      ["C 定格・隔離雨滴",{hold:true,rain:false}],
      ["D 定格・隔離靈陣罩層與重疊施法圖",{hold:true,accents:false}],
      ...[50,53,200,512].map(gems => [`E 定格・${gems} 顆靈玉`,{gems}]),
      ...[1,5].map(rank => [`F 定格・靈陣 Lv${rank}`,{rank}]),
      ...[1,.75,.5].map(resolution => [`G 定格・解析度 ${resolution * 100}%`,{hold:true,resolution}]),
      ["P 定格・隔離空中粒子貼圖",{hold:true,airParticles:false}]
    ];
    for (const [name] of scenarios) {
      const option = doc.createElement("option");
      option.textContent = name;
      select.append(option);
    }
    const toggle = doc.createElement("input");
    toggle.type = "checkbox";
    const label = doc.createElement("label");
    label.append(toggle," 抽樣繪圖指令");
    const download = doc.createElement("button");
    download.type = "button";
    download.textContent = "下載診斷 JSON";
    const refreshTerrain = doc.createElement("button");
    refreshTerrain.type = "button";
    refreshTerrain.textContent = "重畫地面";
    refreshTerrain.addEventListener("click", () => api.refreshTerrain?.());
    let fixture = {};
    const controls = doc.createElement("div");
    const inputs = new Map();
    const change = () => {
      const options = scenarios[select.selectedIndex][1];
      if (!select.selectedIndex) fixture = {};
      if (options.rank) fixture.rank = options.rank;
      if (options.gems) fixture.gems = options.gems;
      const settings = Object.fromEntries([...inputs].map(([key,input]) =>
        [key,comparisons[key][input.selectedIndex+1]]));
      api.configure({...fixture,...options,...settings,detail:toggle.checked});
    };
    const captions = {cached:"快取",original:"原路徑",off:"隔離",direct:"主畫布",atlas:"圖集",
      canvas:"Canvas 圖集",image:"Image 圖集",bitmap:"ImageBitmap 圖集",ordered:"保序合批",
      projected:"投影高度",repaint:"投影高度・移動重畫",single:"單層脈衝"};
    for (const [key,[heading,...values]] of Object.entries(comparisons)) {
      const input = doc.createElement("select");
      input.setAttribute("aria-label",heading);
      for (const value of values) {
        const option = doc.createElement("option");
        option.textContent = typeof value === "boolean" ? (value ? "候選" : "原路徑") : captions[value] ?? value;
        input.append(option);
      }
      const row = doc.createElement("label");
      row.append(heading+" ",input," ");
      controls.append(row);
      inputs.set(key,input);
      input.addEventListener("change",change);
    }
    select.addEventListener("change",change);
    toggle.addEventListener("change",change);
    download.addEventListener("click",() => {
      const url = platform.URL.createObjectURL(new platform.Blob([JSON.stringify(api.report(),null,2)],{type:"application/json"}));
      const link = doc.createElement("a");
      link.href = url;
      link.download = "yokai-port-performance.json";
      doc.body.append(link);
      link.click();
      link.remove();
      platform.setTimeout(() => platform.URL.revokeObjectURL(url),10000);
    });
    panel.append(summary, select, label, download, refreshTerrain, controls);
    doc.body.append(panel);
  }

  const root = typeof window === "object" ? window : null;
  if (typeof module === "object" && module.exports) module.exports = {createDiagnostics,allowedHost,monitorResources,mountPanel,registerParticleSource};
  if (!root || !allowedHost(root.location?.hostname) ||
      new URLSearchParams(root.location.search).get("perf") !== "1") return;
  root.PORT_PERF = {createDiagnostics, monitorResources:()=>monitorResources(root), clock, mountPanel, registerParticleSource};
})();
