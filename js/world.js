// Chunk-based world manager. Keeps only nearby chunks plus chunks pinned by active delivery jobs.
(() => {
  const root = typeof window !== "undefined" ? window : globalThis;

  const SPOTS = Object.freeze([
    Object.freeze([210, 175]),
    Object.freeze([690, 175]),
    Object.freeze([210, 440]),
    Object.freeze([690, 440])
  ]);

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

  function createStageWorld(stage, content) {
    if (!stage || !content) throw new Error("createStageWorld requires stage and content");

    const worldCfg = stage.world || {};
    const chunkWidth = worldCfg.chunkWidth || 900;
    const chunkHeight = worldCfg.chunkHeight || 600;
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
      const emptySlot = mod(cx + cy * 2 + 1, SPOTS.length);
      const packWords = pack.words || [];
      const wordOffset = packWords.length > 3 ? hashCoords(cx, cy, seed) % packWords.length : 0;
      const words = [];
      for (let i = 0; i < Math.min(3, packWords.length); i++) {
        words.push(packWords[(wordOffset + i) % packWords.length]);
      }

      let wi = 0;
      const houses = [];
      SPOTS.forEach((spot, slot) => {
        if (slot === emptySlot || wi >= words.length) return;
        const word = words[wi++];
        const phaseHash = hashCoords(cx * 11 + slot, cy * 17 + slot, seed);
        const id = `${stage.id}:${cx},${cy}:${slot}`;
        houses.push({
          id,
          phase: (phaseHash % 10000) / 997,
          chunkKey: key,
          x: baseX + spot[0],
          y: baseY + spot[1],
          dx: baseX + spot[0],
          dy: baseY + spot[1] + 60,
          color: pack.color,
          bType: buildingType(pack.theme, slot),
          district: pack.name,
          packId: pack.id,
          word
        });
      });

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
        lamps: [{ x: baseX + chunkWidth / 2 + 62, y: baseY + chunkHeight / 2 - 62 }],
        decor: {
          torii: mod(cx, 3) === 1 && mod(cy, 2) === 0,
          sakuraTrees: pack.theme === "sakura"
            ? [
                { x: baseX + 160, y: baseY + 120 },
                { x: baseX + chunkWidth - 140, y: baseY + 120 }
              ]
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

  const api = { SPOTS, mod, hashCoords, chunkKey, parseChunkKey, createStageWorld };
  root.WORLD = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
