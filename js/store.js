// 詞彙熟練度與存檔（localStorage）：答對升星、答錯降一星；間隔時間久、生詞或剛答錯的單字優先出現。
window.STORE = (() => {
  const K = "yokai-delivery-v1", WT = [6, 4, 2, 1, .5]; let d = { m: {}, best: 0, bestDel: 0 };
  try { const r = JSON.parse(localStorage.getItem(K)); if (r && r.m) d = r; } catch {}
  const save = () => { try { localStorage.setItem(K, JSON.stringify(d)); } catch {} };
  const get = jp => d.m[jp] || (d.m[jp] = { ok: 0, ng: 0, box: 0, lastSeen: 0, missBoost: 1 });
  return {
    data: d, get,
    startRun() {
      // 每次夜行開局，重置當夜答錯追蹤加成，保留已保存的星等與時間戳
      Object.values(d.m).forEach(m => { m.missBoost = 1; });
    },
    rec(jp, c) {
      const m = get(jp);
      if (c) {
        m.ok++;
        m.box = Math.min(4, m.box + 1);
        m.lastSeen = Date.now();
        m.missBoost = 1;
      } else {
        m.ng++;
        m.box = Math.max(0, m.box - 1);
        // 答錯不刷新 lastSeen（保留高權重），並在今夜賦予強烈加成係數，確保近期再次回流複習
        m.missBoost = 2.5;
      }
      save();
    },
    recAssisted(jp) {
      const m = get(jp);
      m.ok++;
      m.lastSeen = Date.now(); // 看答案送達標記為剛接觸，今夜少出現，防止刷題刷油
      m.missBoost = 1;
      save();
    },
    pick(all) {
      const now = Date.now();
      const w = all.map(x => {
        const m = get(x.jp);
        const ageHours = m.lastSeen ? (now - m.lastSeen) / (1000 * 3600) : 24;
        const decay = Math.min(2.5, 1 + ageHours * 0.1);
        const missMult = m.missBoost || 1;
        return WT[m.box] * decay * missMult;
      });
      let r = Math.random() * w.reduce((a, b) => a + b, 0);
      for (let i = 0; i < all.length; i++) { r -= w[i]; if (r <= 0) return all[i]; }
      return all[all.length - 1];
    },
    finish(s, n) { if (s > d.best) d.best = s; if (n > d.bestDel) d.bestDel = n; save(); }
  };
})();
