// Chunk-based world manager. Keeps only nearby chunks plus chunks pinned by active delivery jobs.
(() => {
  const root = typeof window !== "undefined" ? window : globalThis;

  const SPOTS = Object.freeze([
    Object.freeze([210, 175]),
    Object.freeze([690, 175]),
    Object.freeze([210, 440]),
    Object.freeze([690, 440])
  ]);
  // Three deterministic staggered arrangements validated for adjacent chunks.
  const HOUSE_LAYOUTS = Object.freeze([
    Object.freeze([[191,150],[710,156],[446,443]].map(Object.freeze.bind(Object))),
    Object.freeze([[193,141],[707,155],[453,454]].map(Object.freeze.bind(Object))),
    Object.freeze([[198,159],[710,156],[456,450]].map(Object.freeze.bind(Object)))
  ]);
  // Shared locations used by answer rendering, interaction and geometry tests.
  function answerPositions(h) {
    return [
      {x:h.x-110,y:h.y+125},
      {x:h.x+110,y:h.y+125},
      {x:h.x,y:h.y+190}
    ];
  }

  const mod = (n, m) => ((n % m) + m) % m;

  function hashCoords(x, y, seed = 0) {
    let h = Math.imul((x | 0) ^ 0x9e3779b9, 0x85ebca6b);
    h ^= Math.imul((y | 0) ^ seed, 0xc2b2ae35);
    h ^= h >>> 16;
    h = Math.imul(h, 0x7feb352d);
    h ^= h >>> 15;
    h = Math.imul(h, 0x846ca68b);
    h ^= h >>> 16;
    return h >>> 0;
  }

  function chunkKey(cx, cy) {
    return `${cx},${cy}`;
  }

  function parseChunkKey(key) {
    const [x, y] = String(key).split(",").map(Number);
    return Number.isFinite(x) && Number.isFinite(y) ? { cx: x, cy: y } : null;
  }

  function buildingType(theme, slot) {
    if (theme === "tavern" || theme === "market") return "house_tavern";
    if (theme === "mystic" || theme === "lotus") return "house_shrine";
    if (theme === "water" || theme === "sakura") return slot % 2 === 0 ? "house_shop" : "house_tavern";
    return "house_shop";
  }

  function createStageWorld(stage, content, options = {}) {
    if (!stage || !content) throw new Error("createStageWorld requires stage and content");

    const worldCfg = stage.world || {};
    const chunkWidth = worldCfg.chunkWidth || 900;
    // 2.5D Y spacing is real world geometry, not sprite-only displacement.
    // Original chunks/layout remain unchanged at spacingScaleY=1.
    const spacingScaleY = Number.isFinite(options.spacingScaleY)
      ? Math.max(1, Math.min(1.3, options.spacingScaleY)) : 1;
    const chunkHeight = (worldCfg.chunkHeight || 600) * spacingScaleY;
    const activeRadius = Math.max(1, worldCfg.activeRadius || 2);
    const seed = worldCfg.seed || 0;
    const layoutOffset = worldCfg.layoutOffset || 0;
    const packIds = (stage.wordPacks || []).filter(id => content.getPack(id));
    if (packIds.length === 0) throw new Error("stage has no usable word packs");

    // rain-port 戰鬥帶：約 600px，minY..maxY（其他關為 null）
    const isRainPort = stage.id === "rain-port";
    const bounds = isRainPort ? { minY: 180, maxY: 780 } : null;
    // rain-port：限制 Y chunk 範圍（只在戰鬥帶內生成 house/answerPositions）
    const rainPortChunkMinY = isRainPort ? Math.floor(bounds.minY / chunkHeight) : null;
    const rainPortChunkMaxY = isRainPort ? Math.ceil(bounds.maxY / chunkHeight) : null;

    // ------------------------------------------------------------------
    // rain-port 專屬：港町屋散落配置（其他關卡的函式／座標完全不動）
    //   - 房屋沿「世界 X 軸」用全域格子散落：pitch 700px + 低差異抖動，
    //     相鄰兩棟的間距恆在 509~891px。每 chunk 因此自然落在 1~2 棟
    //     （約 7 成單屋、3 成雙屋），不再每 chunk 固定三棟、也不會連續空段。
    //   - X 直接是世界座標，鄰塊共用同一套間距；兩棟的最小水平距離 ≥ 509px，
    //     遠大於 footprint（港倉 201 / 魚舖 187）所需，
    //     不再拿 SPOTS 的座標去對 HOUSE_LAYOUTS 的位置（舊 slotTypes/usedSlots 對錯座標）。
    //   - Y 分上/下兩帶交錯（近崖上帶 160~330／近碼頭下帶 430~570），
    //     屋底與答題墊（y+125 / y+190）都留在戰鬥帶 180~780 內，不落水面。
    //   - 房屋只住在戰鬥帶上緣那一列 Y chunk（cy === PORT_ROW），
    //     避免同一 X 在別列再生成一份重複房屋。
    // ------------------------------------------------------------------
    const PORT_ROW = 0;                 // 房屋所在的 Y chunk 列（戰鬥帶上緣那一列）
    const PORT_PITCH = 700;             // 房屋格子的基本間距（世界 px）
    const PORT_SPREAD = 200;            // 格子抖動幅度（±100px）；每個900px chunk至少一棟
    const PORT_MIN_DX = 255;            // footprint 所需的最小水平距離（港倉201/魚舖187 + 答題墊）
    const PORT_BANDS = Object.freeze([
      Object.freeze({ min: 160, max: 330 }),   // 近崖上帶
      Object.freeze({ min: 430, max: 570 })    // 近碼頭下帶
    ]);
    const PORT_MAX_HOUSE_Y = 570;       // 答題墊 y+190 必須 <= belt.maxY-18 = 762
    // ------------------------------------------------------------------
    // R2 視覺淨空（visual clearance）：北側背景屋
    //   renderer.js drawPortSceneLayers() 會在每個 chunk 的北側畫一排「背景屋」
    //   （northItems：warehouse / fishmonger，腳點 = belt.minY-24 .. belt.minY+8）。
    //   背景屋跟港町屋用同一組素材、同一顆 upright 投影，所以北列屋一旦落在
    //   背景屋的 X 欄位裡，屋頂會直接壓在背景屋的立面上，畫面疊成一團（使用者回報）。
    //   這裡只複製背景屋的「幾何」來做淨空判定，不會畫任何東西。
    //
    //   尺寸經核真圖（assets/img/rain-port 的 cutout PNG，alpha 輪廓 == sourceRect 外框，
    //   見 scratch/s2-port-clearance-r2/png-contour.cjs）：
    //     port_warehouse   drawn w=187  sourceRect 1227x1019 → 螢幕高 165
    //     port_fishmonger  drawn w=201  sourceRect 1221x923  → 螢幕高 161
    //   螢幕幾何（renderer.js + viewport.js）：世界 Y 被 tilt .60 壓縮，但 upright 會把
    //   房屋拉回原高，所以一棟屋在螢幕上＝整張 sprite 高（bh），屋底錨點 = h.y+46。
    // ------------------------------------------------------------------
    const PORT_SPRITE = Object.freeze({
      port_warehouse: Object.freeze({ w: 187, sw: 1227, sh: 1019 }),
      port_fishmonger: Object.freeze({ w: 201, sw: 1221, sh: 923 })
    });
    const PORT_TILT = 0.6;              // viewport.js 預設 tilt（2.5D）
    const PORT_DEPTH = 1.06;            // renderer.js depthFactor = 1 + tiltFactor*0.06
    const PORT_VISUAL_MARGIN = 24;      // 螢幕像素：兩棟建築輪廓之間的最小淨空
    const PORT_SKYLINE = Object.freeze([
      Object.freeze({ alt: false, off: 130, bType: "port_warehouse",   footDy: -22 }),
      Object.freeze({ alt: false, off: 590, bType: "port_fishmonger", footDy: 8 }),
      Object.freeze({ alt: true,  off: 120, bType: "port_fishmonger", footDy: 6 }),
      Object.freeze({ alt: true,  off: 640, bType: "port_warehouse",   footDy: -24 })
    ]);
    const portSpriteH = t => {
      const s = PORT_SPRITE[t];
      return s ? Math.round(s.w * (s.sh / s.sw) * PORT_DEPTH) : 0;
    };
    // 某個 chunk 的北側背景屋（只算不畫；alt = chunk.x/1024 奇數）
    function portSkylineAt(cx) {
      const chunkX = cx * chunkWidth;
      const alt = Math.floor(chunkX / 1024) % 2 !== 0;
      const out = [];
      for (const s of PORT_SKYLINE) {
        if (s.alt !== alt) continue;
        out.push({ x: chunkX + s.off, bType: s.bType, footY: bounds.minY + s.footDy });
      }
      return out;
    }
    // 港町屋 vs 背景屋的螢幕淨空（>0 有淨空；<=0 太近）。bbox 保守估計（已用 alpha 輪廓核對）。
    function portSkylineClearance(house, sky) {
      const houseBase = (house.y + 46) * PORT_TILT + 2;   // upright 錨點 = 屋底 h.y+46
      const skyBase = sky.footY * PORT_TILT;
      // 屋頂已經落在背景屋腳線之下 → 上下完全分開
      if (houseBase - portSpriteH(house.bType) >= skyBase) return Infinity;
      const need = PORT_SPRITE[house.bType].w / 2 + PORT_SPRITE[sky.bType].w / 2 + PORT_VISUAL_MARGIN;
      return Math.abs(house.x - sky.x) - need;
    }
    function portSkylineWorst(house) {
      let worst = Infinity;
      const cx = Math.floor(house.x / chunkWidth);
      for (let c = cx - 1; c <= cx + 1; c++) {
        for (const sky of portSkylineAt(c)) {
          const g = portSkylineClearance(house, sky);
          if (g < worst) worst = g;
        }
      }
      return worst;
    }
    // 某屋型要站在背景屋「前面」所需的最小世界 Y（含 margin）
    function portSkylineClearY(bType) {
      const bh = portSpriteH(bType);
      let need = 0;
      for (const s of PORT_SKYLINE) {
        const footY = bounds.minY + s.footDy;
        need = Math.max(need, footY + (bh + PORT_VISUAL_MARGIN - 2) / PORT_TILT - 46);
      }
      return Math.ceil(need);
    }
    // 北列屋沿 X 滑到最近的淨空位置：同 chunk、維持左右順序、維持 PORT_MIN_DX 最小間距。
    // 滑動上限由格子的左右間距決定（左右兩棟若同時對滑，合計不超過間距-255）。
    function portSlideX(baseX, y, bType, n) {
      const cx = Math.floor(baseX / chunkWidth);
      const lo = cx * chunkWidth + 8, hi = (cx + 1) * chunkWidth - 8;
      const roomRight = Math.floor((portLatticeX(n + 1) - portLatticeX(n) - PORT_MIN_DX - 2) / 2);
      const roomLeft = Math.floor((portLatticeX(n) - portLatticeX(n - 1) - PORT_MIN_DX - 2) / 2);
      const probe = x => ({ x, y, bType });
      for (let d = 0; d <= Math.max(roomLeft, roomRight); d++) {
        const candidates = d === 0 ? [baseX] : [baseX + d, baseX - d];
        for (const x of candidates) {
          if (x < lo || x > hi) continue;
          if (d > roomRight && x > baseX) continue;
          if (d > roomLeft && x < baseX) continue;
          if (portSkylineWorst(probe(x)) >= 0) return x;
        }
      }
      return null;
    }
    const PORT_PROP_KINDS = Object.freeze(["crate", "anchor", "mooring"]);
    // 碼頭線（maxY）所在的 Y chunk 列：貨堆/船錨/繫船柱只放在那一列，避免多列疊在同一 X
    const portShoreRow = isRainPort ? Math.floor(bounds.maxY / chunkHeight) : null;
    const portPhase = (hashCoords(0, 0, seed ^ 0x504f5254) % 1000) / 1000;
    const portFrac = v => v - Math.floor(v);
    // 全域第 n 棟的世界 X：等距 pitch + 低差異抖動（黃金比例相位，看不出固定節奏）
    const portLatticeX = n =>
      n * PORT_PITCH + (portFrac(n * 0.6180339887498949 + portPhase) - 0.5) * PORT_SPREAD;

    // 這個 chunk 內的港町屋（deterministic，不依賴鄰塊是否已生成）
    function portHousePlan(cx) {
      const x0 = cx * chunkWidth;
      const x1 = x0 + chunkWidth;
      const out = [];
      // X 對 n 單調遞增 → 從保守起點往後掃，命中本 chunk 的格子點
      const nEnd = Math.ceil((x1 + PORT_SPREAD) / PORT_PITCH) + 1;
      for (let n = Math.floor((x0 - PORT_SPREAD) / PORT_PITCH) - 1; n <= nEnd; n++) {
        const x = portLatticeX(n);
        if (x < x0 || x >= x1) continue;
        out.push({
          n,
          x,
          hx: hashCoords(n * 31 + 7, PORT_ROW * 13, seed ^ 0x58585858),
          hy: hashCoords(n * 17 + 3, PORT_ROW * 29, seed ^ 0x59595959),
          ht: hashCoords(n * 11 + 5, PORT_ROW * 7, seed ^ 0x54545454)
        });
      }
      return out;
    }

    // 碼頭小物：只用既有 PORT_ART 真圖（crate 貨堆 / anchor 船錨 / mooring 繫船柱），
    // 落在碼頭線附近，且不壓住房屋的答題墊。
    function portPropsFor(cx, cy) {
      if (!isRainPort || cy !== portShoreRow) return [];
      const baseX = cx * chunkWidth;
      // 用「實際落點」的房屋 X（含 R2 淨空滑動），避免小物壓到答題墊。
      const plan = portShoreRow === PORT_ROW ? portHousePlan(cx) : getChunk(cx, PORT_ROW).houses;
      const out = [];
      const count = hashCoords(cx * 3 + 11, cy * 5 + 2, seed ^ 0x70726f70) % 3;   // 0~2 件
      for (let i = 0; i < count; i++) {
        const hx = hashCoords(cx * 19 + i * 13 + 4, cy * 7 + 1, seed ^ 0x70726f7070);
        const hy = hashCoords(cx * 23 + i * 17 + 6, cy * 11 + 3, seed ^ 0x70726f7071);
        const kind = PORT_PROP_KINDS[hashCoords(cx * 29 + i * 3 + 8, cy * 13 + 5, seed ^ 0x70726f7072) % PORT_PROP_KINDS.length];
        const x = baseX + 60 + (hx % Math.max(1, chunkWidth - 120));
        // 繫船柱只畫在碼頭線附近；貨堆/船錨可稍往帶內退一點，但都不得超過 maxY+50
        const y = kind === "mooring"
          ? bounds.maxY - 30 + (hy % 50)
          : bounds.maxY - 80 + (hy % 100);
        if (y > bounds.maxY + 50) continue;
        // 不壓住答題墊（房屋 ±110）與其他小物
        let clash = false;
        for (const p of out) if (Math.abs(p.x - x) < 90) { clash = true; break; }
        if (clash) continue;
        for (const h of plan) if (Math.abs(h.x - x) < 150) { clash = true; break; }
        if (clash) continue;
        out.push({ kind, x, y });
      }
      return out;
    }

    const cache = new Map();

    function keyAt(x, y) {
      return chunkKey(Math.floor(x / chunkWidth), Math.floor(y / chunkHeight));
    }

    function getChunk(cx, cy) {
      const key = chunkKey(cx, cy);
      const cached = cache.get(key);
      if (cached) return cached;

      // rain-port：跳過超出戰鬥帶的 Y chunk（不生成 house/answerPositions）
      if (isRainPort && (cy < rainPortChunkMinY || cy > rainPortChunkMaxY)) {
        // 只回傳空 chunk 結構（無 houses、無 decor、無 lamps），供地形渲染用
        const emptyChunk = {
          key,
          cx,
          cy,
          x: cx * chunkWidth,
          y: cy * chunkHeight,
          w: chunkWidth,
          h: chunkHeight,
          packId: packIds[0],
          name: "",
          sub: "",
          color: "#000",
          floorColor: "#000",
          theme: "",
          houses: [],
          lamps: [],
          decor: { torii: false, sakuraTrees: [], port: null, ancientSakura: [] }
        };
        cache.set(key, emptyChunk);
        return emptyChunk;
      }

      // 0..2 × 0..2 reproduces the old nine-district order exactly.
      const packIndex = mod(cx + cy * 3 + layoutOffset, packIds.length);
      const pack = content.getPack(packIds[packIndex]);
      const baseX = cx * chunkWidth;
      const baseY = cy * chunkHeight;
      const packWords = pack.words || [];
      const houses = [];
      if (stage.id === "sakura-pass") {
        // 原每塊 3 間。山道只留 1 間，並縮在區塊中段，避免鏡頭邊緣同時掃到鄰塊。
        if (packWords.length) {
          const hx = hashCoords(cx, cy, seed ^ 0x51a7c3);
          const hy = hashCoords(cx * 5 + 3, cy * 7 + 1, seed ^ 0xc0ffee);
          const localX = 260 + (hx % 380);
          const localY = 210 + (hy % 180);
          const word = packWords[hashCoords(cx, cy, seed) % packWords.length];
          houses.push({
            id: `${stage.id}:${cx},${cy}:0`,
            phase: (hashCoords(cx * 11, cy * 17, seed) % 10000) / 997,
            chunkKey: key,
            x: baseX + localX,
            y: baseY + localY * spacingScaleY,
            dx: baseX + localX,
            dy: baseY + localY * spacingScaleY + 60,
            color: pack.color,
            bType: "shrine_pavilion",
            district: pack.name,
            packId: pack.id,
            word
          });
        }
      } else if (isRainPort) {
        // 港町屋：世界 X 軸上的散落格子，每 chunk 1~2 棟，Y 上下兩帶交錯。
        // 不再使用通用 HOUSE_LAYOUTS + SPOTS（舊座標對錯會讓左右雙屋疊在同高度）。
        // 房屋只住在 PORT_ROW 那一列 Y chunk：別列不生成，避免同 X 重複房屋。
        const plan = cy === PORT_ROW ? portHousePlan(cx) : [];
        const wordOffset = packWords.length > 3 ? hashCoords(cx, PORT_ROW, seed) % packWords.length : 0;
        // 先算好每棟的落點，再統一處理「北側背景屋淨空」與同 chunk 兩棟的高度差。
        const slots = [];
        for (let i = 0; i < plan.length; i++) {
          if (!packWords.length) break;
          const p = plan[i];
          // 單棟時上下帶由 hash 決定；兩棟時一上一下交錯，不會疊在同高度
          const bandIndex = plan.length === 1 ? (p.hx % PORT_BANDS.length) : (i % PORT_BANDS.length);
          const band = PORT_BANDS[bandIndex];
          let py = band.min + (p.hy % Math.max(1, band.max - band.min));
          // 屋底留在本列 Y chunk 內，避免同一 X 在別列再生成一份
          const rowTop = PORT_ROW * chunkHeight;
          py = Math.max(rowTop + 8, Math.min(rowTop + chunkHeight - 8, py));
          const bType = (p.ht % 2) ? "port_warehouse" : "port_fishmonger";
          // R2：屋頂／立面淨空。先沿 X 滑到最近的淨空位置（維持原深度與左右順序）；
          // 滑不動才把整棟往南挪到背景屋腳線之前（此時屋頂不再壓在背景屋立面上）。
          let hx = p.x;
          if (portSkylineWorst({ x: hx, y: py, bType }) < 0) {
            const slid = portSlideX(p.x, py, bType, p.n);
            if (slid !== null) {
              hx = slid;
            } else {
              py = Math.max(py, portSkylineClearY(bType));
            }
          }
          slots.push({ p, py, hx, bType, bandIndex });
        }
        // 同 chunk 兩棟必須差 100px 以上（上下兩列的視覺節奏）；北棟往南讓不動時，
        // 由南棟再往南讓（南棟仍留在 belt 與答題墊範圍內）。
        if (slots.length === 2) {
          const north = slots[0].bandIndex === 0 ? slots[0] : slots[1];
          const south = slots[0].bandIndex === 0 ? slots[1] : slots[0];
          if (Math.abs(north.py - south.py) <= 100) {
            const want = north.py + 101;
            if (want <= PORT_MAX_HOUSE_Y) {
              south.py = want;
            } else {
              north.py = Math.max(north.py - (101 - Math.abs(north.py - south.py)), south.py - 101);
            }
          }
        }
        for (let i = 0; i < slots.length; i++) {
          const slot = slots[i];
          const p = slot.p;
          const py = slot.py;
          const hx = slot.hx;
          const word = packWords[(wordOffset + i) % packWords.length];
          const phaseHash = hashCoords(p.n * 11 + i, PORT_ROW * 17 + i, seed);
          houses.push({
            id: `${stage.id}:${cx},${cy}:${i}`,
            phase: (phaseHash % 10000) / 997,
            chunkKey: key,
            x: hx,
            y: py,
            dx: hx,
            dy: py + 60,
            color: pack.color,
            bType: slot.bType,
            district: pack.name,
            packId: pack.id,
            word
          });
        }
      } else {
        const layout = HOUSE_LAYOUTS[hashCoords(cx, cy, seed ^ 0x5e1a0d) % HOUSE_LAYOUTS.length];
        const emptySlot = mod(cx + cy * 2 + 1, SPOTS.length);
        const wordOffset = packWords.length > 3 ? hashCoords(cx, cy, seed) % packWords.length : 0;
        const words = [];
        for (let i = 0; i < Math.min(3, packWords.length); i++) {
          words.push(packWords[(wordOffset + i) % packWords.length]);
        }
        let wi = 0;

        // rain-port：使用基於建築 footprint 的間距，避免重疊
        const isRainPort = stage.id === "rain-port";
        const buildingWidths = {
          port_warehouse: 201,
          port_fishmonger: 187,
          house_shop: 166,
          house_tavern: 175,
          house_shrine: 158
        };
        const minGap = 24; // 建築間最小間隙

        // 預計算每個 slot 的建築類型與寬度
        const slotTypes = [];
        SPOTS.forEach((spot, slot) => {
          if (slot === emptySlot) return;
          const bType = isRainPort
            ? (mod(cx + slot, 2) === 0 ? "port_warehouse" : "port_fishmonger")
            : buildingType(pack.theme, slot);
          slotTypes.push({ slot, bType, width: buildingWidths[bType] || 166 });
        });

        // 簡單的防重疊：若相鄰 slot 寬度總和超過可用空間，跳過較窄的那一棟
        const usedSlots = new Set();
        slotTypes.forEach((st, idx) => {
          if (idx > 0) {
            const prev = slotTypes[idx - 1];
            const prevRight = SPOTS[prev.slot][0] + prev.width / 2;
            const currLeft = SPOTS[st.slot][0] - st.width / 2;
            if (currLeft - prevRight < minGap) {
              // 空間不足，移除較窄的建築
              if (st.width < prev.width) {
                return; // 跳過這個 slot
              } else {
                usedSlots.delete(prev.slot); // 移除前一個
              }
            }
          }
          usedSlots.add(st.slot);
        });

        SPOTS.forEach((spot, slot) => {
          if (slot === emptySlot || wi >= words.length || !usedSlots.has(slot)) return;
          const position = layout[wi];
          const word = words[wi++];
          const phaseHash = hashCoords(cx * 11 + slot, cy * 17 + slot, seed);
          const id = `${stage.id}:${cx},${cy}:${slot}`;
          houses.push({
            id,
            phase: (phaseHash % 10000) / 997,
            chunkKey: key,
            x: baseX + position[0],
            y: baseY + position[1] * spacingScaleY,
            dx: baseX + position[0],
            dy: baseY + position[1] * spacingScaleY + 60,
            color: pack.color,
            bType: isRainPort
              ? (mod(cx + slot, 2) === 0 ? "port_warehouse" : "port_fishmonger")
              : buildingType(pack.theme, slot),
            district: pack.name,
            packId: pack.id,
            word
          });
        });
      }

      const chunk = {
        key,
        cx,
        cy,
        x: baseX,
        y: baseY,
        w: chunkWidth,
        h: chunkHeight,
        packId: pack.id,
        name: pack.name,
        sub: pack.sub,
        color: pack.color,
        floorColor: pack.floorColor,
        theme: pack.theme,
        houses,
        lamps: stage.id === "rain-port" ? [] : [{ x: baseX + chunkWidth / 2 + 62, y: baseY + (chunkHeight / 2 - 62 * spacingScaleY) }],
        decor: {
          torii: stage.id === "rain-port" ? false : stage.id === "sakura-pass" ? false : mod(cx, 3) === 1 && mod(cy, 2) === 0,
          sakuraTrees: stage.id === "rain-port" ? [] : pack.theme === "sakura"
            ? [
                { x: baseX + 160, y: baseY + 120 * spacingScaleY },
                { x: baseX + chunkWidth - 140, y: baseY + 120 * spacingScaleY }
              ]
            : [],
          // 只在雨夜港町加視覺道具，不新增碰撞，也不改夜行町的房子與道路。
          port: stage.id === "rain-port" ? {
            shore: mod(cy, 2) === 1,
            bounds: bounds, // 同一組戰鬥帶數值供 AGY renderer 消費
            // 碼頭小物：既有 PORT_ART 真圖（crate 貨堆 / anchor 船錨 / mooring 繫船柱），
            // 由 hash 決定數量與位置，只落在碼頭線附近且不壓住答題墊。
            props: portPropsFor(cx, cy)
          } : null,
          // 約每五個區塊一棵，腳點在北緣，避開房屋本體與南側答題墊。
          ancientSakura: stage.id === "sakura-pass" && mod(cx * 2 + cy * 3, 5) === 0
            ? [{ x: baseX + 450, y: baseY + 72 * spacingScaleY }]
            : []
        }
      };

      cache.set(key, chunk);
      return chunk;
    }

    function update(playerX, playerY, pinnedKeys = []) {
      const centerX = Math.floor(playerX / chunkWidth);
      const centerY = Math.floor(playerY / chunkHeight);
      const desired = new Set();

      // rain-port：只保留戰鬥帶內的 Y chunk
      let minCy = centerY - activeRadius;
      let maxCy = centerY + activeRadius;
      if (bounds) {
        minCy = Math.max(minCy, rainPortChunkMinY);
        maxCy = Math.min(maxCy, rainPortChunkMaxY);
      }

      for (let cy = minCy; cy <= maxCy; cy++) {
        for (let cx = centerX - activeRadius; cx <= centerX + activeRadius; cx++) {
          desired.add(chunkKey(cx, cy));
        }
      }

      for (const key of pinnedKeys || []) {
        if (parseChunkKey(key)) desired.add(key);
      }

      const chunks = [];
      for (const key of desired) {
        const parsed = parseChunkKey(key);
        if (!parsed) continue;
        chunks.push(getChunk(parsed.cx, parsed.cy));
      }

      for (const key of [...cache.keys()]) {
        if (!desired.has(key)) cache.delete(key);
      }

      chunks.sort((a, b) => (a.cy - b.cy) || (a.cx - b.cx));
      let houses = chunks.flatMap(chunk => chunk.houses);

      // rain-port：篩選/調整 houses，讓 dy 和 answerPositions 全在 minY+18..maxY-18
      if (bounds) {
        const minDy = bounds.minY + 18;
        const maxDy = bounds.maxY - 18;
        houses = houses.map(h => {
          const ans = answerPositions(h);
          let dy = h.dy;
          // 先嘗試調整 dy 到合法範圍
          if (dy < minDy) dy = minDy;
          if (dy > maxDy) dy = maxDy;
          // 再確認 answerPositions 都在範圍內
          const ansMinY = Math.min(...ans.map(a => a.y));
          const ansMaxY = Math.max(...ans.map(a => a.y));
          if (ansMinY < minDy) dy += (minDy - ansMinY);
          if (ansMaxY > maxDy) dy -= (ansMaxY - maxDy);
          return { ...h, dy: Math.max(minDy, Math.min(maxDy, dy)) };
        });
        // rain-port：真正的世界座標 footprint 去重（取代舊的 50px 粗略分組）。
        // 舊分組會把相鄰的合法房子整個濾掉，讓沿途可配送點不足；
        // 現在只丟掉水平距離真的小於 footprint 間距的那一棟。
        const kept = [];
        for (const h of houses) {
          let clash = false;
          for (const k of kept) {
            if (Math.abs(k.x - h.x) < PORT_MIN_DX) { clash = true; break; }
          }
          if (!clash) kept.push(h);
        }
        houses = kept;
      }

      const solids = houses.map(h => ({
        x0: h.x - 48,
        x1: h.x + 48,
        y0: h.y - 25,
        y1: h.y + 45,
        chunkKey: h.chunkKey
      }));
      const lamps = chunks.flatMap(chunk => chunk.lamps);

      return { chunks, houses, solids, lamps, bounds };
    }

    return {
      chunkWidth,
      chunkHeight,
      activeRadius,
      keyAt,
      getChunk,
      update,
      reset() {
        cache.clear();
      },
      getCacheSize() {
        return cache.size;
      },
      getCachedKeys() {
        return [...cache.keys()];
      }
    };
  }

  const api = { SPOTS, HOUSE_LAYOUTS, answerPositions, mod, hashCoords, chunkKey, parseChunkKey, createStageWorld };
  root.WORLD = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
