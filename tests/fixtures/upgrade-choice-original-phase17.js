function assemble(awakenCard, fc, wc, cc, dc, pc, mc, shuffle) {
    let result = [];
    if (awakenCard) {
      const restPool = shuffle([...fc, ...wc.slice(0, 2), ...cc.slice(0, 2), ...dc.slice(0, 2), ...pc.slice(0, 2)]);
      const rest = mc.length > 0
        ? [...restPool.slice(0, Math.max(0, 2 - mc.length)), ...mc.slice(0, 2)]
        : restPool.slice(0, 2);
      if (cc.length > 0 && !rest.some(card => card.type === "charm")) {
        const nonMutIdx = rest.findIndex(c => c.type !== "mutation");
        if (nonMutIdx >= 0) {
          rest[nonMutIdx] = cc[0];
        } else if (rest.length < 2) {
          rest.push(cc[0]);
        }
      }
      result = shuffle([awakenCard, ...rest]);
      if (!result.some(card => card.lv === 5)) result[result.length - 1] = awakenCard;
      result = result.slice(0, 3);
    } else {
      const pool = [];
      if (fc.length > 0) pool.push(...fc);
      if (wc.length > 0) pool.push(...wc.slice(0, 2));
      if (cc.length > 0) pool.push(...cc.slice(0, 2));
      if (dc.length > 0) pool.push(...dc.slice(0, 2));
      if (pc.length > 0) pool.push(...pc.slice(0, 2));
      const baseChoices = shuffle(pool).slice(0, 3);
      result = mc.length > 0
        ? [...baseChoices.slice(0, Math.max(0, 3 - mc.length)), ...mc.slice(0, 2)]
        : baseChoices;
      if (cc.length > 0 && !result.some(card => card.type === "charm")) {
        const nonMutIdx = result.findIndex(c => c.type !== "mutation");
        if (nonMutIdx >= 0) {
          result[nonMutIdx] = cc[0];
        } else if (result.length < 3) {
          result.push(cc[0]);
        }
      }
    }
    if (fc.length && !result.some(card => card.type === "fusion")) {
      const replaceIndex = result.findIndex(card => card !== awakenCard && card.type !== "mutation");
      if (replaceIndex >= 0) result[replaceIndex] = fc[0];
      else if (result.length < 3) result.push(fc[0]);
    }
    return result;
}
