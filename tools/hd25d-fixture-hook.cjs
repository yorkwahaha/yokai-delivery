// P6 驗收共用 fixture 掛鉤（只給驗收用）。
// 這段字串會被「記憶體內」附加到 js/game.js 的 IIFE 結尾之前，
// 只在 Node VM 測試與驗收伺服器的回應內容中出現；
// 磁碟上的 js/game.js 永遠不被修改，也不需要在正式程式加 debug 介面。
'use strict';
module.exports = `window.fixture = {
    start, frame, update, drawWorld, weapons, hurt,
    viewport: window.VIEWPORT,
    freezeSpawn: () => { spawnT = Infinity; surgeT = Infinity; },
    setWeaponRank: (id, rank) => { WL[id] = rank; wT[id] = 0; },
    soloSkill: (id, rank) => { Object.keys(WL).forEach(k => WL[k] = 0); WL[id] = rank; Object.keys(wT).forEach(k => wT[k] = Infinity); wT[id] = 0; },
    // 事件影格隔離：讓所有武器冷卻停在待機，避免手動 SKILLFX.play 與武器自動施放重疊，
    // 造成多雲／重複粒子而無法判斷單一事件的實際圖形。
    freezeWeapons: () => { Object.keys(wT).forEach(k => wT[k] = Infinity); return true; },
    scene: (foes, walls = []) => {
      syncWorld();
      enemies = foes.map((e, i) => ({ x: P.x + e.dx, y: P.y + (e.dy || 0), hp: 999, max: 999, type: 'ghost', speed: 0, wob: 0, flash: 0, id: i + 1, ...e }));
      solids.splice(0, solids.length, ...walls.map(s => ({ x0: P.x + s.x0, x1: P.x + s.x1, y0: P.y + s.y0, y1: P.y + s.y1 })));
    },
    wallBullet: () => { syncWorld(); solids.push({ x0: P.x + 150, x1: P.x + 210, y0: P.y - 40, y1: P.y + 40 }); enemyBullets.push({ x: P.x + 180, y: P.y, vx: 0, vy: 0, life: 2 }); },
    addEnemyBullet: (dx, dy) => { syncWorld(); enemyBullets.push({ x: P.x + dx, y: P.y + dy, vx: 0, vy: 0, life: 3 }); },
    prepareBoss: (word) => { const bs = { id: 900, x: P.x + 170, y: P.y, type: 'boss', word: word || ALL[0], hp: 9999, max: 9999, shield: true, speed: 0, wob: 0, flash: 0 }; enemies.push(bs); bossQ = mkQ(bs); bossQ.lock = 0; },
    setOil: v => { oil = v; },
    setElapsed: v => { elapsed = v; },
    // 驗收用：清掉開場標題卡、轉場淡入與殘留特效，讓畫面只剩受控場景本身。
    // 不改任何正式 UI 行為，只在驗收注入層生效。
    clearScene: () => { titleCardT = 0; fadeT = 0; FX.reset?.(); SKILLFX.reset?.(); texts.splice(0); rings.splice(0); return true; },
    tiltWorld, playerPos: () => ({ x: P.x, y: P.y }),
    fireSkill: (id, ev, lv, p) => SKILLFX.play(id, ev, lv, p),
    setFace: a => { P.faceAng = a; },
    addSlashArc: (x, y, reach, ang, tier) => RENDERER.addSlashArc(x, y, reach, ang, 2.2, tier),
    pushHazard: o => { const hx = (o.x != null ? o.x : P.x), hy = (o.y != null ? o.y : P.y);
      enemies.push({ id: 800, x: hx, y: hy, hp: 999, max: 999, type: 'ghost', speed: 0, wob: 0, flash: 0,
        hazard: { life: 9, max: 9, angle: 0, safeOffset: 0, phase: 'telegraph', kind: 'tide', ...o, x: hx, y: hy } });
      return true; },
    skillState: () => ({ ghosts: ghosts.length, winds: (typeof winds !== 'undefined' ? winds : []).length,
      needles: (typeof needles !== 'undefined' ? needles : []).length, proj: proj.length,
      dragonShots: typeof dragonShots !== 'undefined' ? dragonShots : 0,
      dragonScorches: typeof dragonScorches !== 'undefined' ? dragonScorches : 0,
      dragons: ghosts.filter(g => g.dragon && g.life > 0).length }),
    bossQuizRects: n => window.UI.bossQuizLayout(n),
    hudBounds: () => window.VIEWPORT.hudBounds(),
    snapshot: () => ({ oil, xp, score, level, elapsed, delivered, gems,
      enemies: enemies.map(e => ({ id: e.id, hp: +Number(e.hp).toFixed(4), type: e.type, x: +e.x.toFixed(4), y: +e.y.toFixed(4) })),
      bullets: enemyBullets.map(b => ({ x: +b.x.toFixed(4), y: +b.y.toFixed(4), life: +b.life.toFixed(4) })),
      cooldowns: Object.fromEntries(Object.entries(wT).map(([k, v]) => [k, +Number(v).toFixed(5)])),
      bossQ: bossQ ? { lock: bossQ.lock, tries: bossQ.tries } : null,
      spacing: window.VIEWPORT.spacingScaleY(), tilt: +window.VIEWPORT.tiltScale().toFixed(6),
      player: { x: +P.x.toFixed(4), y: +P.y.toFixed(4) } }), };`;