// Logical coordinates before the stage's Y spacing is applied.
window.STAGE_ROUTE_LAYOUTS = (() => {
  const grid = { columns: 5, rows: 5 };
  const bounds = { minX: 112, maxX: 4388, minY: 104, maxY: 2896 };
  const bambooKinds = ["bamboo-column", "bamboo-thicket", "bamboo-fork"];
  const outer = [[610,940],[890,570],[1480,515],[2050,630],[2680,415],
    [3320,575],[3830,910],[3970,1530],[3650,2060],[3430,2515],
    [2790,2555],[2250,2365],[1660,2570],[970,2460],[645,2040],[470,1520]];
  const stations = [
    [950,438],[1530,390],[2110,522],[2700,294],[3390,460],[3825,795],
    [4020,1435],[3720,1950],[3460,2370],[2800,2425],[2260,2230],[1650,2465],
    [945,2340],[655,1925],[480,1420],[1195,1280],[1620,1410],[2870,1175],
    [3210,1390],[2080,1840]
  ];
  function trail(anchors, width, closed = false) {
    const limit = closed ? anchors.length : anchors.length - 1;
    const at = i => anchors[closed ? (i + anchors.length) % anchors.length : Math.max(0, Math.min(i, limit))];
    const points = [];
    for (let i = 0; i < limit; i++) {
      const [a, b, c, d] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
      const steps = Math.ceil(Math.hypot(c[0] - b[0], c[1] - b[1]) / 38);
      for (let step = 0; step < steps; step++) {
        const t = step / steps;
        points.push(b.map((value, axis) => value + .5 * t * ((c[axis] - a[axis]) +
          t * (2 * a[axis] - 5 * value + 4 * c[axis] - d[axis] +
          t * (3 * value - a[axis] - 3 * c[axis] + d[axis])))));
      }
    }
    points.push(closed ? anchors[0] : anchors.at(-1));
    return { points, width };
  }
  const trails = [
    trail(outer, 142, true),
    trail([outer[15],[1120,1390],[1610,1540],[2250,1500],[2690,1300],[3300,1480],outer[7]], 122),
    trail([outer[2],[1495,1010],[1610,1540],[1290,1950],outer[12]], 96),
    trail([outer[4],[2690,760],[2420,1030],[2690,1300],[2820,1860],outer[10]], 102),
    trail([[2250,1500],[2030,1950],outer[11]], 93),
    trail([[2690,1300],[2900,1302],[3040,1380],[3300,1480]], 84)
  ];
  const trailClear = trails.flatMap(({ points, width }) =>
    points.map(([x, y]) => [x, y, width / 2 + 82]));

  function bamboo(cx, cy, hash) {
    const baseX = cx * 900, baseY = cy * 600;
    const houses = [], obstacles = [], props = [];
    for (const [index, [x, y]] of stations.entries()) {
      if (Math.floor(x / 900) !== cx || Math.floor(y / 600) !== cy) continue;
      const tea = index % 2 === 0;
      houses.push([x - baseX, y - baseY, tea ? "bamboo_tea_house" : "bamboo_produce_house"]);
      props.push([x - baseX + (tea ? -102 : 102), y - baseY + 51,
        tea ? "stone-lantern" : "shoot-baskets", tea ? 34 : 45]);
    }
    const n = (i, salt, max) => ((hash >>> (salt % 18)) + i * 113 + salt * 157) % max;
    for (let i = 0; i < 12; i++) {
      const x = 90 + (i % 4) * 226 + n(i, 5, 107) - 53;
      const y = 98 + Math.floor(i / 4) * 190 + n(i, 8, 121) - 60;
      const wx = baseX + x, wy = baseY + y;
      if (wx < bounds.minX + 122 || wx > bounds.maxX - 122 ||
          wy < bounds.minY + 102 || wy > bounds.maxY - 102) continue;
      if (trailClear.some(([px, py, r]) => (wx - px) ** 2 + (wy - py) ** 2 < r * r)) continue;
      if (stations.some(([hx, hy]) => Math.abs(wx - hx) < 194 && wy > hy - 86 && wy < hy + 256)) continue;
      const width = 84 + n(i, 12, 51);
      const half = Math.round(width * .34);
      obstacles.push([x - half, y - 44, x + half, y, "bamboo-stand",
        bambooKinds[(hash + i) % bambooKinds.length], width]);
      if ((hash + i) % 5 === 0) props.push([x + 40, y + 11, "moss-rocks", 55]);
      if ((hash + i) % 11 === 0) props.push([x - 30, y + 13, "bamboo-fence", 57]);
    }
    function wall(horizontal, coordinate) {
      const count = horizontal ? 10 : 8, pitch = (horizontal ? 900 : 600) / count;
      const edge = coordinate - (horizontal ? baseY : baseX);
      const side = coordinate === bounds.minX || coordinate === bounds.minY ? -1 : 1;
      for (let i = 0; i < count; i++) {
        const along = (i + .5) * pitch + n(i, 15, 17) - 8;
        const role = bambooKinds[(hash + i) % bambooKinds.length];
        const width = 106 + n(i, 7, 48);
        props.push(horizontal ? [along, edge, role, width, true] : [edge, along, role, width, true]);
        if (i % 2 === 0) {
          const back = edge + side * (38 + n(i, 9, 21));
          const stagger = along + pitch * .49;
          props.push(horizontal ? [stagger, back, "bamboo-thicket", 133, true]
            : [back, stagger, "bamboo-thicket", 133, true]);
        }
      }
    }
    if (cy === 0) wall(true, bounds.minY);
    if (cy === grid.rows - 1) wall(true, bounds.maxY);
    if (cx === 0) wall(false, bounds.minX);
    if (cx === grid.columns - 1) wall(false, bounds.maxX);
    return { houses, obstacles, props };
  }
  Object.assign(bamboo, { grid, bounds, trails });
  const kyotoStreet = Object.freeze({ left: 330, right: 570, north: 170, south: 405 });
  const kyotoGrid = Object.freeze({ columns: 3, rows: 3 });
  const kyotoBounds = Object.freeze({ minX: 64, maxX: 2636, minY: 64, maxY: 1736 });
  function kyoto(cx, cy, hash) {
    const { left, right, north, south } = kyotoStreet;
    const alternate = (cx - cy) % 2 !== 0;
    const edge = [];
    if (cy === 0) edge.push([450, 65, "kyoto-perimeter-gate", 256], [314, 87, "kyoto-maple", 94], [594, 92, "kyoto-maple", 92]);
    if (cy === 2) edge.push([450, 536, "kyoto-perimeter-gate", 256], [311, 548, "kyoto-maple", 102], [593, 555, "kyoto-maple", 104]);
    if (cx === 0 || cx === 2) {
      const x = cx === 0 ? 18 : 882;
      for (const y of [204, 287, 369]) edge.push([x, y, "kyoto-perimeter-gate", 111]);
    }
    const landmark = cx === 1 && cy === 1
      ? [687, 472, "kyoto-three-tier-pagoda", 197]
      : [132 + hash % 37, 450 + hash % 28, hash % 2 ? "kyoto-maple" : "kyoto-festival-kiosk", 126];
    return {
      terrain: (hash >>> 6) % 6,
      houses: [
        [200, 136, alternate ? "kyoto_sweets_house" : hash % 3 ? "kyoto_tea_house" : "kyoto_grocery", 67],
        [700, 136, alternate ? "kyoto_grocery" : "kyoto_noodle_house", alternate ? 78 : 45]
      ],
      obstacles: [
        [0, 0, left, north, "kyoto-block"], [right, 0, 900, north, "kyoto-block"],
        [0, south, left, 600, "kyoto-block"], [right, south, 900, 600, "kyoto-block"]
      ],
      props: [
        ...[[0, left], [right, 900]].flatMap(([x0, x1]) => {
          const x = (x0 + x1) / 2, width = x1 - x0;
          return [
            [x, 104, alternate ? "kyoto-rear-townhouses" : "kyoto-block-frontage", width], [x, north, "kyoto-block-wall", width],
            [x, 486, "kyoto-block-wall", width], [x, 593, "kyoto-block-frontage", width]
          ];
        }),
        [111, 553, "kyoto-stall", 142], [275, 499, "kyoto-crate-stack", 65],
        [627, 503, "kyoto-crate-stack", 68], [798, 549, "kyoto-stall", 136],
        [306, north, "kyoto-stone-lantern", 36], [826, north, "kyoto-double-lantern", 51],
        [626, 412, "kyoto-festival-banners", 54], [268, 429, "kyoto-red-railing", 84],
        [617, 516, "kyoto-stone-basin", 58], [841, 439, "kyoto-lantern-stand", 55],
        [96, 399, "kyoto-komainu", 56], [277, 545, "kyoto-maple-shrub", 101],
        ...(alternate ? [[719, 475, "kyoto-footbridge", 105]] : [[776, 455, "kyoto-maple", 125]]),
        hash % 2 ? [150, 496, "kyoto-market-shrine", 132] : [181, 498, "kyoto-cloth-merchant", 108],
        landmark, ...edge
      ],
      groundProps: [[314, 207, "kyoto-maple-leaves", 64], [602, 390, "kyoto-maple-leaves", 53]]
    };
  }
  function kyotoChasePoint(from, to, width, height, radius) {
    const { left, right, north, south } = kyotoStreet;
    const spacing = height / 600;
    const rowOffset = (north + south) * spacing / 2, colOffset = (left + right) / 2;
    const row = Math.floor(from.y / height) * height, targetRow = Math.floor(to.y / height) * height;
    const col = Math.floor(from.x / width) * width, targetCol = Math.floor(to.x / width) * width;
    const inRow = (y, origin, margin) => y >= origin + north * spacing + margin && y <= origin + south * spacing - margin;
    const inCol = (x, origin, margin) => x >= origin + left + margin && x <= origin + right - margin;
    const onRow = inRow(from.y, row, radius);
    const targetOnRow = inRow(to.y, targetRow, 0), targetOnCol = inCol(to.x, targetCol, 0);
    if (onRow && targetOnRow && row === targetRow ||
        inCol(from.x, col, radius) && targetOnCol && col === targetCol) return to;
    if (onRow) {
      const x = colOffset + (targetOnCol ? targetCol : Math.round(((from.x + to.x) / 2 - colOffset) / width) * width);
      return Math.abs(from.x - x) > 2
        ? { x, y: row + rowOffset }
        : { x, y: targetOnRow ? targetRow + rowOffset : to.y };
    }
    const y = rowOffset + (targetOnRow ? targetRow : Math.round(((from.y + to.y) / 2 - rowOffset) / height) * height);
    return { x: col + colOffset, y };
  }
  Object.assign(kyoto, { grid: kyotoGrid, bounds: kyotoBounds, street: kyotoStreet, chasePoint: kyotoChasePoint });

  function snow(cx, cy, hash) {
    const hasTemple = hash % 3 !== 0;
    const side = hash % 2;
    const landmark = (hash >>> 4) % 3;
    const [x, y, kind, width] = [
      [716, 533, "snow-ice-cliff", 150], [174, 509, "snow-torii", 126], [678, 510, "snow-bridge", 134]
    ][landmark];
    return {
      terrain: (hash >>> 6) % 6,
      houses: hasTemple ? [[207, 117, "snow_shrine", 52], [696, 133, "snow_temple", 58]]
        : [[side ? 704 : 207, 126, "snow_shrine", 52]],
      obstacles: [
        [100, 435, 145, 470, "snow-outcrop", "snow-boulders", 81],
        [744, 68, 806, 100, "snow-outcrop", "snow-pine", 99],
        [x - 34, y - 33, x + 34, y, "snow-landmark", kind, width]
      ],
      props: [
        [307, 235, "snow-stone-lantern", 45], [590, 375, "snow-stone-lantern", 51],
        [177, 446, "snow-paper-lantern", 45], [771, 454, "snow-cedar-fence", 104],
        [270, 125, "snow-offertory", 48], [93, 136, "snow-ice-cliff", 99],
        [745, 574, "snow-boulders", 63], [323, 500, "snow-pine", 92],
        [97, 585, "snow-juniper", 72], [790, 230, "snow-snowdrift", 68],
        ...(hash % 4 === 0 ? [[837, 510, "snow-octagonal-shrine", 94]] : [])
      ],
      groundProps: [[600, 145, "snow-steps", 108], [270, 390, "snow-ice-patch", 128]]
    };
  }
  function ferry(cx, cy, hash) {
    const station = hash % 3;
    return {
      terrain: (hash >>> 6) % 6,
      houses: [[297, 110, cx === 1 && cy === 1 ? "ferry_ticket" : ["ferry_mail", "ferry_boathouse", "ferry_inn"][station], 64],
        [602, 113, station ? "ferry_mail" : "ferry_shelter", 58]],
      obstacles: [
        [0, 0, 166, 215, "ferry-water"], [734, 0, 900, 215, "ferry-water"],
        [0, 385, 166, 600, "ferry-water"], [734, 385, 900, 600, "ferry-water"],
        [312, 472, 385, 508, "ferry-landmark", "ferry-river-shrine", 101],
        [558, 464, 624, 512, "ferry-landmark", ["ferry-pier-roof", "ferry-gate", "ferry-shrine-gate"][station], 158]
      ],
      props: [
        [142, 175, "ferry-covered-ferry", 144], [782, 478, "ferry-empty-boat", 103],
        [177, 259, "ferry-lantern-post", 51], [724, 360, "ferry-lantern-post", 56],
        [170, 359, "ferry-bollards", 69], [740, 245, "ferry-bollards", 58],
        [318, 134, "ferry-cargo-barrels", 54], [576, 150, "ferry-parcels", 44],
        [212, 523, "ferry-plank-stack", 70], [700, 532, "ferry-waymarker", 43],
        [336, 440, "ferry-bench", 65], [647, 450, "ferry-caged-lamp", 38], [686, 368, "ferry-rope", 57],
        [75, 455 + hash % 49, "ferry-spirit-lantern", 34], [806, 102, "ferry-spirit-lantern", 35]
      ],
      groundProps: [[187, 420, "ferry-reeds", 53], [719, 191, "ferry-reeds", 62],
        [193, 507, "ferry-shore-ridge", 98], [712, 62, "ferry-shore-ridge", 87],
        [216, 354, "ferry-sandals", 42], [722, 300, "ferry-dock-junction", 145],
        [477, 442, "ferry-floating-deck", 88]]
    };
  }
  ferry.chasePoint = (from, to, width, height, radius) => {
    const col = Math.floor(from.x / width), targetCol = Math.floor(to.x / width);
    const row = Math.floor(from.y / height);
    const bridge = (row + .5) * height;
    const bridgeClearance = 85 * height / 600 - radius - 2;
    if (Math.abs(from.y - bridge) <= bridgeClearance && Math.abs(to.y - bridge) <= bridgeClearance)
      return to;
    if (col === targetCol) {
      const landX = Math.max(col * width + 167 + radius, Math.min((col + 1) * width - 167 - radius, from.x));
      return landX === from.x ? to : { x: landX, y: from.y };
    }
    if (Math.abs(from.y - bridge) > 3) {
      const localX = from.x - col * width;
      if (localX < 166 + radius || localX > width - 166 - radius) {
        if (Math.abs(from.y - bridge) < bridgeClearance)
          return { x: (targetCol + (targetCol > col ? .30 : .70)) * width, y: from.y };
      }
      return { x: from.x, y: bridge };
    }
    return { x: (col + (targetCol > col ? 1.30 : -.30)) * width, y: bridge };
  };

  function yomi(cx, cy, hash) {
    const central = cx === 1 && cy === 1;
    const corner = (hash >>> 9) % 4;
    const ruin = ["cliff-ledge", "bell-tower", "fallen-torii", "stair-gate"][corner];
    return {
      terrain: (hash >>> 6) % 6,
      houses: [[233, 112, "yomi_pavilion", 61], [689, 117, "yomi_palace", 79]],
      obstacles: [
        [91, 466, 158, 508, "yomi-basalt", "yomi-basalt-spire", 138],
        [693, 446, 768, 491, "yomi-ruin", `yomi-${ruin}`, 154],
        ...(central ? [[346, 85, 378, 119, "yomi-torii-foot"], [522, 85, 554, 119, "yomi-torii-foot"]]
          : [[372, 74, 528, 119, "yomi-gate", "yomi-palace-wall", 193]])
      ],
      props: [
        [322, 128, "yomi-lantern-post", 47], [610, 139, "yomi-lantern-post", 51],
        [183, 397, "yomi-jizo", 54], [368, 518, "yomi-altar", 85],
        [864, 89, "yomi-basalt-spire", 96], [561, 473, "yomi-brazier", 43],
        [47, 129, "yomi-boulder", 66], [800, 109, "yomi-brazier", 48],
        ...(central ? [[450, 119, "yomi-torii", 282], [598, 272, "yomi-moon", 370, true]] : [])
      ],
      groundProps: [[581, 231, "yomi-stone-bridge", 116], [179, 527, "yomi-spider-lilies", 52],
        [809, 415, "yomi-spider-lilies", 46], [365, 210, "yomi-broken-flagstone", 61]]
    };
  }

  return Object.freeze({ "bamboo-maze": bamboo, "hyakki-kyoto": kyoto, "snow-temple": snow,
    "spirit-ferry": ferry, yomi });
})();
