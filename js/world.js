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

    const cache = new Map();

    function keyAt(x, y) {
      return chunkKey(Math.floor(x / chunkWidth), Math.floor(y / chunkHeight));
    }

    function getChunk(cx, cy) {
      const key = chunkKey(cx, cy);
      const cached = cache.get(key);
      if (cached) return cached;

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
      } else {
        const layout = HOUSE_LAYOUTS[hashCoords(cx, cy, seed ^ 0x5e1a0d) % HOUSE_LAYOUTS.length];
        const emptySlot = mod(cx + cy * 2 + 1, SPOTS.length);
        const wordOffset = packWords.length > 3 ? hashCoords(cx, cy, seed) % packWords.length : 0;
        const words = [];
        for (let i = 0; i < Math.min(3, packWords.length); i++) {
          words.push(packWords[(wordOffset + i) % packWords.length]);
        }
        let wi = 0;
        SPOTS.forEach((spot, slot) => {
          if (slot === emptySlot || wi >= words.length) return;
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
            bType: stage.id === "rain-port"
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
            props: ["mooring", "boat", "crate", "anchor", "beacon"]
              .filter((_, i) => i === mod(cx + cy, 5) || i === mod(cx * 2 + cy + 2, 5))
              .map((kind, i) => ({
                kind,
                x: baseX + (i === 0 ? 150 : chunkWidth - 210),
                y: baseY + (i === 0 ? chunkHeight - 78 : chunkHeight * 0.46)
              }))
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

      for (let cy = centerY - activeRadius; cy <= centerY + activeRadius; cy++) {
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
      const houses = chunks.flatMap(chunk => chunk.houses);
      const solids = houses.map(h => ({
        x0: h.x - 48,
        x1: h.x + 48,
        y0: h.y - 25,
        y1: h.y + 45,
        chunkKey: h.chunkKey
      }));
      const lamps = chunks.flatMap(chunk => chunk.lamps);

      return { chunks, houses, solids, lamps };
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
