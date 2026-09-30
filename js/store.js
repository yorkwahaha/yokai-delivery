// 詞彙熟練度與存檔（localStorage）：答對升星、答錯歸零；越不熟的詞越常出現。
window.STORE = (() => {
  const K = "yokai-delivery-v1", WT = [6, 4, 2, 1, .5]; let d = { m: {}, best: 0, bestDel: 0 };
  try { const r = JSON.parse(localStorage.getItem(K)); if (r && r.m) d = r; } catch {}
  const save = () => { try { localStorage.setItem(K, JSON.stringify(d)); } catch {} };
  const get = jp => d.m[jp] || (d.m[jp] = { ok: 0, ng: 0, box: 0 });
  return {
    data: d, get,
    rec(jp, c) { const m = get(jp); if (c) { m.ok++; m.box = Math.min(4, m.box + 1); } else { m.ng++; m.box = 0; } save(); },
    pick(all) { const w = all.map(x => WT[get(x.jp).box]); let r = Math.random() * w.reduce((a, b) => a + b, 0);
      for (let i = 0; i < all.length; i++) { r -= w[i]; if (r <= 0) return all[i]; } return all[all.length - 1]; },
    finish(s, n) { if (s > d.best) d.best = s; if (n > d.bestDel) d.bestDel = n; save(); }
  };
})();
