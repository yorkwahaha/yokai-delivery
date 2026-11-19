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
  function kyoto(cx, cy, hash) {
    const alternate = (cx - cy) % 2 !== 0;
    return {
      houses: [
        [211, 104, alternate ? "kyoto_sweets_house" : "kyoto_grocery"],
        [667, 101, alternate ? "kyoto_grocery" : "kyoto_noodle_house"]
      ],
      obstacles: [
        [68, 407, 215, 513, "kyoto-stall"],
        [269, 427, 335, 472 + hash % 20, "kyoto-stall"],
        [561, 426, 629, 507, "kyoto-stall"],
        [692, 387, 829, 513, "kyoto-stall"]
      ]
    };
  }
  return Object.freeze({ "bamboo-maze": bamboo, "hyakki-kyoto": kyoto });
})();
