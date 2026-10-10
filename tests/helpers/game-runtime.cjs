// V3 驗收用遊戲執行期工具（Hermes 責任範圍）。
// 目的：在真正的 vm 沙箱內載入 js/game.js 及其相依模組，取得可觀測狀態，
// 供 tests/v3-*.test.cjs 做行為斷言。與 tests/input-runtime.test.cjs 的
// 私有 loadGame 同源，但獨立存在，不修改舊測試。
//
// 校準基準：HEAD da98b4b，392/392 通過（見 tests/v3-baseline.test.cjs）。
//
// 設計規則：所有探針都用 typeof 包起來讀取「可能尚未存在」的 production 變數，
// 讓 V3 尚未實作的行為表現為明確斷言失敗（RED），而不是 vm 載入期 ReferenceError。
'use strict';

const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const read = name => fs.readFileSync(path.join(ROOT, 'js', name), 'utf8');

// V3 校準基準提交。baseline 測試必須固定讀這個版本的 js/*，否則
// production 實作後「舊行為」會被改掉，校準測試就失去意義（會變成假綠）。
const BASELINE_REVISION = 'da98b4b';

/**
 * 從 git 物件庫讀出某個提交下的 js 檔案內容。
 * 用於把「舊規格基線」與「現行 working tree」在時間上切開。
 */
function readAtRevision(revision, name) {
  return execFileSync('git', ['-C', ROOT, 'show', `${revision}:js/${name}`],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}

const MODULE_ORDER = [
  'words', 'world', 'store', 'config', 'viewport', 'controls',
  'overworld', 'fx', 'skillfx', 'evolutions'
];

// V3 新增模組：只在 working tree 載入。baseline revision 不讀它，
// 否則基線校準會混入 V3 尚未存在的程式，等於把兩個時間點混為一談。
const V3_ONLY_MODULES = ['boss-ai'];

// 注入 game.js 的 fixture。snapshot 以 typeof 守衛讀取 V3 新狀態；
// 現行 da98b4b 下這些欄位為 undefined，測試會如實看到「未實作」。
const FIXTURE = `window.fixture = {
  start, update, frame, makeOrder, hurt, offerUp, triggerHint, resolve, spawnEnemy, weapons, answerChoices,
  answerBoss, mkQ,
  configureStage: id => configureStage(id),
  weaponChoices: () => choices.filter(c=>c.type==='weapon'),
  currentChoices: () => choices,
  pendingPickup: () => inter,
  reviewWords: () => misses,
  failCount: () => failed,
  setState: next => { state=next; ended=false; },
  setOil: value => { oil=value; },
  setElapsed: value => { elapsed=value; },
  setXp: value => { xp=value; },
  currentXp: () => xp,
  currentLevel: () => level,
  meetDeliveryGoal: () => { delivered=GOAL_DELIVERIES; },
  // 受控單元用：直接建立一張委託並完成取貨。
  // 這是「controlled scene」路徑——不含真步行、不產生戰鬥 XP，
  // 供 XP／印／提示等數值斷言使用。真實路徑請用 walkToInteract + runOneRun。
  // 真的走一次升級流程（呼叫 pickUp），像玩家一樣選一張卡。
  // 必要原因：interact() 要求 state==='play'，而 XP 累積會觸發 offerUp()。
  // 走動途中遇到升級卡時要怎麼處理：預設走 resolveLevelUps（真的 pickUp）。
  // runner 可覆寫成自己的選卡策略（觀察 cap3／四槽拒卡等規則）。
  onLevelUp: null,
  // XP 花費帳（累加器）：takeLevelUpChoice 每次成功選卡時記下 pickUp 實際扣掉的
  // xpNeed 值。開新局時必須歸零，否則殘留值會讓 XP 帳失真。
  xpSpentLedger: { total: 0, entries: [] },
  resetXpLedger: () => { fixture.xpSpentLedger.total = 0; fixture.xpSpentLedger.entries.length = 0; },
  // 真正的一幀：走 runFrame(now)，它會遞減 levelupCooldown。
  // 注意：update(dt) 在 state !== 'play' 時直接 return，所以升級冷卻必須靠幀推進，
  // 這是先前 walkToInteract 無限迴圈的根因。
  stepFrame: ms => {
    // 沙箱的 performance.now() 恆為 0，若每次傳同一個 now，dt 會是 0，
    // levelupCooldown 永遠不減（這是先前無限迴圈的真正機制）。
    // 用檔案層的單調時鐘推進，確保每幀 dt = 指定毫秒。
    fixture.__now += (ms || 16.7);
    runFrame(fixture.__now);
    return { state, levelupCooldown };
  },
  __now: 1000,
  stepFrames: (count, ms) => {
    let n = 0;
    for (let i = 0; i < (count || 1); i++) { fixture.stepFrame(ms); n++; }
    return { frames: n, state, levelupCooldown };
  },
  levelUpCooldown: () => levelupCooldown,
  // 等待升級冷卻歸零（用幀推進，不強改 state、不跳過 choices 流程）。
  waitLevelUpCooldown: maxFrames => {
    let n = 0;
    const limit = maxFrames || 120;
    while (levelupCooldown > 0 && n < limit) { fixture.stepFrame(16.7); n++; }
    return { frames: n, levelupCooldown, state };
  },
  resolveLevelUps: maxChoices => {
    let handled = 0;
    const limit = maxChoices || 40;
    while (state === 'levelup' && handled < limit) {
      if (!choices.length) break;
      pickUp(0);
      handled++;
      update(1 / 60);
    }
    return { handled, state };
  },
  // 受控單元用：建立一張委託並完成取貨。
  // 最小式：不清空 orders、不等待額度、不做真步行。真步行見 walkToInteract（runner B 類）。
  // 注意：interact() 要求 state==='play'，所以呼叫端必須先離開 levelup。
  prepareOrder: () => {
    job = null;
    if (!orders.length) makeOrder();
    inter = orders[0] || null;
    if (!inter) return false;
    const ok = interact();
    if (job) job.lock = 0;
    return !!job;
  },
  // 真正的答案墊位置（由遊戲自己的 ansPos 決定），不硬編座標。
  answerPad: index => { const j = job; if (!j) return null; return ansPos(j.to)[index == null ? j.ans.indexOf(j.word) : index]; },
  // 真步進走到答案墊並提交：只用 walkNear（keys 驅動），不瞬移。
  // atAnswer／atDestination 仍保留給 controlled 單元測試使用，兩者不可混用。
  // dwell 量測要包含「進半徑後已累積的 hold」：walkNear 的容差可能讓玩家
  // 在 hold 已經開始累積時才到位。因此總 dwell = job.hold + 到達後的等待。
  jobHold: () => (job ? (job.hold || 0) : 0),
  // XP 來源帳：pickUp 每次升級恰好扣掉當級 xpNeed(level)，因此累計花費可精確回推。
  // 這讓「敵掉落 XP = 總獲得 − 配送 26×單數」在有升級時仍然正確（不再出現負值）。
  // 注意：xpNeed() 內部已乘 XP_NEED_SCALE（Math.round(CFG.xpNeed(level) * SCALE)），
  // 因此累積花費直接呼叫 xpNeed()，與遊戲扣的是同一個值，不會漏掉關卡縮放。
  // XP 帳的正確算法：xpNeed() 無參數時讀「當前 level」，因此迴圈裡呼叫
  // 每次都加同一個值 → 高估花費（曾讓六單帳變成 198/42 而非 156/0）。
  // 正確做法是照 game.js:510 的公式逐級求和：Math.round(CFG.xpNeed(lv) * SCALE)。
  xpSpentTotal: maxLevel => {
    let total = 0;
    const to = maxLevel === undefined ? level : maxLevel;
    for (let lv = 1; lv < to; lv++) total += Math.round(CFG.xpNeed(lv) * XP_NEED_SCALE);
    return total;
  },
  // 實際花費：以 pickUp 前讀到的 xpNeed 為準逐次累加，與遊戲扣的數字完全一致。
  // 兩者相等可當帳務正確的交叉驗證。
  xpSpentActual: () => fixture.xpSpentLedger.total,
  xpEarnedTotal: () => xp + fixture.xpSpentLedger.total,
  enemyXp: () => {
    const total = fixture.xpEarnedTotal();
    const fromDelivery = 26 * delivered;
    return { totalEarned: total, fromDelivery, fromEnemies: total - fromDelivery, level, xp, delivered };
  },
  walkToAnswerPad: (opts) => {
    const o = opts || {};
    const j = job;
    if (!j) return { ok: false, reason: 'no-job' };
    const pad = fixture.answerPad(o.index);
    if (!pad) return { ok: false, reason: 'no-pad' };
    const tolerance = o.tolerance || 26;
    const r = fixture.walkNear(pad.x, pad.y, tolerance, o.maxSeconds || 60, 1 / 60, o.tolerance2 || tolerance);
    if (!r.reached) return { ok: false, reason: 'pad-unreachable', walk: r, pad: { x: Math.round(pad.x), y: Math.round(pad.y) } };
    // 進入墊子半徾時 hold 可能已開始累積，因此先記錄，再等提交。
    const preHold = job ? (job.hold || 0) : 0;
    let waited = 0;
    while (job && waited < (o.maxWait || 4)) { update(1 / 60); waited += 1 / 60; }
    return {
      ok: !job,
      preHold: +preHold.toFixed(3),
      postWait: +waited.toFixed(3),
      // 總停留時間 = 進半徾前已累積 + 到達後等待；這才是玩家實際感受的讀題時間。
      dwell: +(preHold + waited).toFixed(3),
      walk: r,
      pad: { x: Math.round(pad.x), y: Math.round(pad.y) },
      delivered: delivered, xp: xp, level: level
    };
  },
  // 進答題區（觸發結界）：真步進到 job.to 附近，而不是直接設座標。
  walkIntoAnswerZone: opts => {
    const o = opts || {};
    const j = job;
    if (!j) return { ok: false, reason: 'no-job' };
    return fixture.walkNear(j.to.x, j.to.y + 110, o.tolerance || 190, o.maxSeconds || 60, 1 / 60, 26);
  },
  preparePickup: () => { makeOrder(); inter=orders[0]; },
    // 清掉互動快取，讓 update() 依玩家實際位置重新判定 inter（真取貨流程）。
    clearInteract: () => { inter=null; },
    realPickup: () => { interact(); return !!job; },
    ordersNow: () => orders.map(o=>({from:{...o.from},to:{...o.to},word:o.word,life:o.life})),
  pickupWord: word => { const route=orders[0] || {from:houses[0],to:houses[1],rev:false};
    orders=[{...route,word,life:110}]; job=null; inter=orders[0]; interact(); job.lock=0; },
  atDestination: () => { P.x=job.to.x; P.y=job.to.y+110; },
  atAnswer: () => { const p=ansPos(job.to)[job.ans.indexOf(job.word)]; P.x=p.x; P.y=p.y; },
  housesNow: () => houses.map(h=>({id:h.id,x:h.x,y:h.y,word:h.word})),
  placeAt: (x,y) => { P.x=x; P.y=y; },
  face: angle => { P.faceAng=angle; },
    blocked: (x,y,r=16) => blocked(x,y,r),
    // 真實步進：以 keys 驅動 move()，逐幀真走（含建築物滑移），不用 placeAt 瞬移。
    // 路徑以 BFS 在 blocked() 上求出，再沿路點行走；無法在時限內到達時視為失敗，
    // 路由驗收據此判定「路徑可通行」。不用貪婪轉向，因為建築物之間需要繞行。
    // BFS 在 blocked() 上求路徑。町屋本體是 solid，目標格必然被擋，
    // 因此終點取「目標周邊可走格」；遊戲互動判定本來也是靠近外框即可。
    _planPath: (tx, ty, grid=32, radius=16, goalTolerance=170) => {
      const sx = Math.round(P.x / grid), sy = Math.round(P.y / grid);
      // 限制在 start/target 外框 + 邊界內，避免整張地圖 BFS。
      const minX = Math.min(sx, Math.round(tx / grid)) - 24, maxX = Math.max(sx, Math.round(tx / grid)) + 24;
      const minY = Math.min(sy, Math.round(ty / grid)) - 24, maxY = Math.max(sy, Math.round(ty / grid)) + 24;
      const W = maxX - minX + 1, H = maxY - minY + 1;
      if (W * H > 400000) return null;
      const idx = (x, y) => (y - minY) * W + (x - minX);
      const prev = new Int32Array(W * H).fill(-1);
      const seen = new Uint8Array(W * H);
      const queue = new Int32Array(W * H);
      let head = 0, tail = 0;
      const sIdx = idx(sx, sy);
      seen[sIdx] = 1; queue[tail++] = sIdx;
      const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
      let goalIdx = -1, bestD = Infinity;
      while (head < tail) {
        const cur = queue[head++];
        const cx = cur % W + minX, cy = Math.floor(cur / W) + minY;
        const d = Math.hypot(cx * grid - tx, cy * grid - ty);
        if (d < goalTolerance && d < bestD) { bestD = d; goalIdx = cur; if (d < grid * 1.2) break; }
        for (const [dx, dy] of dirs) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < minX || nx > maxX || ny < minY || ny > maxY) continue;
          const ni = idx(nx, ny);
          if (seen[ni]) continue;
          if (blocked(nx * grid, ny * grid, radius + 8)) continue;
          seen[ni] = 1; prev[ni] = cur; queue[tail++] = ni;
        }
      }
      if (goalIdx < 0) return null;
      const cells = [];
      for (let c = goalIdx; c !== -1; c = prev[c]) {
        cells.unshift({ x: (c % W + minX) * grid, y: (Math.floor(c / W) + minY) * grid });
      }
      return cells;
    },
    // 依 move() 的正規化邏輯決定按鍵：move() 會把 (x,y) 正規化成長度 1 的向量，
  // 因此同時按兩個軸會得到「斜走」（每軸約 0.707），單軸則是全速直走。
  // 這裡依「主要軸」單鍵全速；若該軸被擋，就退到次要軸，最後才用斜走。
  pushKeys: step => {
    const ax = Math.abs(step[0]), ay = Math.abs(step[1]);
    const kx = step[0] > 0 ? 'r' : 'l', ky = step[1] > 0 ? 'd' : 'u';
    // 探測半徑必須等於遊戲實際使用的碰撞半徑：遊戲以 blocked(x,y) 的預設
    // r=18 判定玩家位移。若探測用 16，就會把「實際被擋」的軸判成可走，
    // 按下去卻不動 → 玩家永久卡在格子邊（先前 seed11 第4單的真正原因）。
    const probe = 22;
    const xFree = !blocked(P.x + step[0] * probe, P.y);
    const yFree = !blocked(P.x, P.y + step[1] * probe);
    if (ax >= ay && xFree) keys.add(kx);
    else if (ay > ax && yFree) keys.add(ky);
    else if (xFree) keys.add(kx);
    else if (yFree) keys.add(ky);
    else { keys.add(kx); keys.add(ky); }   // 兩軸都被擋：讓遊戲的滑移處理
    return [...keys];
  },
  // 真步進走位：以 keys 驅動 move()，逐幀走（含建築滑移）。
  // 路徑一次 BFS 後依序走完；距離接近時轉局部探測（建築角落會讓格點卡住）。
  // 嚴格限制：任何一步都不瞬移、不給 XP、不改等級。
  walkTo: (tx, ty, maxSeconds=90, dt=1/60, tolerance=40) => {
    let path = fixture._planPath(tx, ty);
    let idx = 0, t = 0, lastD = Infinity, stuck = 0, localProbe = false, replans = 0;
    while (t < maxSeconds) {
      const d = Math.hypot(tx - P.x, ty - P.y);
      if (d < tolerance) { keys.clear(); return { reached: true, seconds: +t.toFixed(2), distance: +d.toFixed(1), planCells: path ? path.length : 0, replans }; }
      // 升級卡：幀推進解冷卻（update 在非 play 時直接 return，冷卻只由 runFrame 減）。
      if (state === 'levelup') {
        keys.clear();
        if (typeof fixture.onLevelUp === 'function') fixture.onLevelUp();
        else fixture.resolveLevelUps(40);
        if (state === 'levelup') fixture.waitLevelUpCooldown(240);
        fixture.stepFrame(16.7);
        t += 16.7 / 1000;
        lastD = d;
        continue;
      }
      // 路徑耗盡或走不動 → 局部探測；連續失敗才重新規劃（上限 3 次，避免抖動）。
      if (!path || idx >= path.length) { path = null; localProbe = true; }
      if (!localProbe && (!path || path.length === 0)) {
        if (replans >= 3) localProbe = true;
        else { path = fixture._planPath(tx, ty); idx = 0; replans++; if (!path) localProbe = true; }
      }
      let step = null;
      if (!localProbe && path && path.length) {
        while (idx < path.length - 1 && Math.hypot(path[idx].x - P.x, path[idx].y - P.y) < 30) idx++;
        const wp = path[Math.min(idx, path.length - 1)];
        const wd = Math.hypot(wp.x - P.x, wp.y - P.y) || 1;
        if (wd < 8 && idx >= path.length - 1) localProbe = true;
        else step = [(wp.x - P.x) / wd, (wp.y - P.y) / wd];
      }
      if (!step) {
        const base = Math.atan2(ty - P.y, tx - P.x);
        for (const off of [0, 0.4, -0.4, 0.8, -0.8, 1.3, -1.3, 1.9, -1.9, 2.5, -2.5, 3.1, -3.1]) {
          const a = base + off;
          if (!blocked(P.x + Math.cos(a) * 18, P.y + Math.sin(a) * 18, 16)) { step = [Math.cos(a), Math.sin(a)]; break; }
        }
        if (!step) step = [Math.cos(base), Math.sin(base)];
      }
      keys.clear();
      fixture.pushKeys(step);
      update(dt); t += dt;
      if (lastD - d < 0.02) { stuck += dt; if (stuck > 2) { stuck = 0; localProbe = true; } } else stuck = 0;
      lastD = d;
    }
    keys.clear();
    return {
      reached: false, seconds: +t.toFixed(2),
      distance: +Math.hypot(tx - P.x, ty - P.y).toFixed(1),
      timeout: true, planCells: path ? path.length : 0, replans
    };
  },
    tapKey: (k, down=true) => { if (down) keys.add(k); else keys.delete(k); },
    keyState: () => [...keys],
  clearSolids: () => solids.splice(0),
  clearOrders: () => { orders=[]; job=null; },
  clearEnemies: () => { enemies=enemies.filter(e=>e.type==='boss'); },
  stopSpawns: () => { spawnT=Infinity; surgeT=Infinity; },
  scheduleBoss: () => { bossT=0; },
  advanceBossClock: offset => { elapsed=BOSS_TIMES[bossStage]+offset; bossT=-offset; },
  prepareBoss: word => { const bs={x:P.x+200,y:P.y,type:'boss',word:word||ALL[0],hp:999,max:999,shield:true,flash:0,wob:0,speed:0};
    enemies.push(bs); bossQ=mkQ(bs); bossQ.lock=0; },
  unlockBoss: () => { bossQ.lock=0; },
  moveBoss: distance => { const bs=enemies.find(e=>e.type==='boss'); Object.assign(bs,{x:P.x+distance,y:P.y,speed:0,wob:0,flash:0}); },
  matchBossToJob: () => { const bs=enemies.find(e=>e.type==='boss'); bs.word=job.word; bossQ=mkQ(bs); bossQ.lock=0; },
  setWeaponRank: (id,rank) => { WL[id]=rank; wT[id]=Infinity; },
    // 讓已持有的武器立刻可用（wT[id]=0），用於測試實際施放而非被 Infinity 冷卻擋住。
    armWeapons: () => { for(const k of Object.keys(WL)) if (WL[k]>0) wT[k]=0; },
    addEnemyBullets: count => { for(let i=0;i<count;i++) enemyBullets.push({x:P.x+120+ (i%3)*8,y:P.y-20+Math.floor(i/3)*10,vx:0,vy:0,life:5,maxLife:5}); },
    bar: () => ({ damage: b.dmg, rate: b.rate, crit: b.crit||0, spd: b.spd||0, oilRegen: b.oilRegen||0, dmgUp: b.dmgUp||0, shield: b.shield||0, dash: b.dash||0, mag: b.mag||0 }),
    barMax: () => ({ ...wMax }),
    weaponTimers: () => ({ ...wT }),
    katanaTimer: () => atkT,
    fireEmitTimer: () => fireEmitT,
    fireAttackTimer: () => fireAttackT,
  combatScene: (weapon, foes, walls=[], rank=1) => {
    Object.keys(WL).forEach(k=>WL[k]=0); WL[weapon]=rank; wT[weapon]=0;
    enemies=foes.map(e=>({x:P.x+(e.dx||0),y:P.y+(e.dy||0),hp:999,max:999,type:'ghost',flash:0,wob:0,...e}));
    solids.splice(0,solids.length,...walls.map(s=>({x0:P.x+s.x0,x1:P.x+s.x1,y0:P.y+s.y0,y1:P.y+s.y1})));
  },
  tune: id => UP.find(u=>u.id===id),
  maxOutUpgrades: () => { Object.keys(WL).forEach(k=>WL[k]=['katana','barrier','needle','fire'].includes(k)?5:0);
    for(const u of UP) while(!u.ok || u.ok()) u.f(); },
  runSummary: () => runSummary,
  // Boss 量測：直接在場上放一隻已破盾的 Boss，供 DPS／擊殺時間對照使用。
  // 不走排程、不含讀題，純量輸出時間；呼叫端必須自行記錄這些限制。
  // 木樁 boss：必須明確停攻，否則 bossAI 會攻擊玩家並中止量測。
  // attackCd: Infinity 是必要的靜態木樁設定；真實戰鬥要另驗（含招式迴避）。
  placeBoss: (hp, opts={}) => {
    enemies.push({ id: 'probe-boss', x: P.x + (opts.dx ?? 140), y: P.y + (opts.dy ?? 0),
      type: 'boss', final: false, word: ALL[0], shield: false,
      hp, max: hp, speed: 0, flash: 0, wob: 0,
      slam: null, slamCd: 99, slamRecovery: 0, attackT: 0,
      attackCd: Infinity, bossIndex: opts.bossIndex ?? 3, _attackStep: 0 });
    return true;
  },
  // XP 來源與升級次數：da98b4b 沒有分類統計，V3 也未實作。
  // 用 typeof 守衛讀取——未實作時回傳 null，代表「未量測」而不是 0。
  xpSources: () => ({
    gemXp: typeof xpFromGems !== 'undefined' ? xpFromGems : null,
    deliveryXp: typeof xpFromDelivery !== 'undefined' ? xpFromDelivery : null,
    total: xp
  }),
  levelUps: () => typeof levelUpCount !== 'undefined' ? levelUpCount : null,
  takeLevelUpChoice: index => {
    if (state !== 'levelup') return { ok: false, reason: 'not-levelup', state };
    const c = choices[index];
    if (!c) return { ok: false, reason: 'no-choice', count: choices.length, ids: choices.map(x => x.id) };
    // pickUp 被 levelupCooldown 擋下；先等冷卻（幀推進），再選。
    if (levelupCooldown > 0) fixture.waitLevelUpCooldown(120);
    if (state !== 'levelup') return { ok: false, reason: 'cooldown-ended-state', state };
    const beforeLevel = level;
    const needed = xpNeed();            // pickUp 即扣這個值（xp = max(0, xp - xpNeed())）
    pickUp(index);
    const effective = level !== beforeLevel && state !== 'levelup';
    if (effective) { const L = fixture.xpSpentLedger; L.total += needed; L.entries.push({ atLevel: beforeLevel, needed, level: level }); }
    return {
      ok: effective, id: c.id, type: c.type, lv: c.lv,
      level, beforeLevel, state,
      reason: effective ? null : ('pick-had-no-effect:lvl' + beforeLevel + '->' + level + ',state=' + state)
    };
  },
  forceLevelUp: () => { xp = xpNeed(); update(1/60); return state; },
  setDamageCoefficient: value => { b.dmg = value; },
  damageCoefficient: () => b.dmg,
  walkNear: (tx, ty, tolerance=70, maxSeconds=90, dt=1/60) => fixture.walkTo(tx, ty, maxSeconds, dt, tolerance),
  // 走到町屋直到遊戲自己判定可互動（inter 產生）為止。
  // 互動判定是玩家中心到町屋外框 clamp 點 < 46px，比我的 spot 容差更權威。
  // 走到町屋外框，直到遊戲自己判定可互動（inter 產生）。
  // 路徑只規劃一次（BFS 於 blocked() 上），依序走完；走完或卡住才轉局部探測。
  // 終點條件是遊戲自身的 inter 判定，不用我自己選的 spot。
  walkToInteract: (house, maxSeconds=150, dt=1/60) => {
    const target = house;
    const path = fixture._planPath(target.x, target.y);
    let idx = 0, t = 0, stuck = 0, lastD = Infinity, localProbe = false;
    while (t < maxSeconds) {
      if (inter) {
        return { reached: true, seconds: +t.toFixed(2), viaInteract: true, planCells: path ? path.length : 0, localProbe };
      }
      const d = Math.hypot(target.x - P.x, target.y - P.y);
      let step = null;
      if (path && path.length && !localProbe) {
        while (idx < path.length - 1 && Math.hypot(path[idx].x - P.x, path[idx].y - P.y) < 30) idx++;
        const wp = path[Math.min(idx, path.length - 1)];
        const wd = Math.hypot(wp.x - P.x, wp.y - P.y) || 1;
        if (wd < 10 && idx >= path.length - 1) localProbe = true;   // 路徑走完
        else step = [(wp.x - P.x) / wd, (wp.y - P.y) / wd];
      }
      if (!step) {
        // 局部探測：朝目標方位擠壓，遇牆試側向，直到互動距離成立。
        const ang = Math.atan2(target.y - P.y, target.x - P.x);
        for (const off of [0, 0.45, -0.45, 0.9, -0.9, 1.4, -1.4, 2.0, -2.0, 2.6, -2.6, 3.2, -3.2]) {
          const a = ang + off;
          if (!blocked(P.x + Math.cos(a) * 16, P.y + Math.sin(a) * 16, 16)) { step = [Math.cos(a), Math.sin(a)]; break; }
        }
        if (!step) step = [Math.cos(ang), Math.sin(ang)];
      }
      keys.clear();
      fixture.pushKeys(step);
      update(dt); t += dt;
      // 卡住判定放寬：連續 2 秒距離沒縮短就轉局部探測（換方向），而非直接放棄。
      // 進度判定：以「目標是否變近」為準，並容許離題誤差的浮動。
      // 若遊戲切到 levelup（XP 累積觸發），先讓呼叫端處理選擇再繼續走。
      if (state === 'levelup') {
        // 升級卡期間不能只呼叫 update()：state 非 play 時 update 直接 return，
        // levelupCooldown 只在 runFrame 遞減，因此這裡必須推進真幀。
        keys.clear();
        if (typeof fixture.onLevelUp === 'function') fixture.onLevelUp();
        else if (state === 'levelup') fixture.resolveLevelUps(40);
        // 等待冷卻（走幀）直到可以再次操作
        if (state === 'levelup') fixture.waitLevelUpCooldown(120);
        fixture.stepFrame(16.7);
        t += 16.7 / 1000;
        lastD = d;
        continue;
      }
      if (lastD - d < 0.02) { stuck += dt; if (stuck > 2) { stuck = 0; localProbe = true; } } else stuck = 0;
      lastD = d;
    }
    keys.clear();
    return {
      reached: !!inter, seconds: +t.toFixed(2), viaInteract: !!inter,
      distance: Math.round(Math.hypot(target.x - P.x, target.y - P.y)),
      planCells: path ? path.length : 0, localProbe
    };
  },
  __path: null, __pathIdx: 0,
  // 町屋外框的可走點：町屋本體是 solid，要找外圍第一個不與建築重疊的位置。
  nearestHouseFreeSpot: h => {
    for (const r of [56, 72, 88, 104, 120, 140, 160, 180]) {
      for (let a = 0; a < 32; a++) {
        const ang = a / 32 * 6.283;
        const x = h.x + Math.cos(ang) * r, y = h.y + Math.sin(ang) * r;
        if (!blocked(x, y, 16)) return { x, y };
      }
    }
    return null;
  },
  oilNow: () => oil,
  maxOilNow: () => maxOil,
  bNow: () => ({ ...b }),
  weaponLevels: () => ({ ...WL }),
  // V3 探針：da98b4b 下全部 undefined（RED 訊號），實作後才會有值。
  v3: () => ({
    seals: typeof seals!=='undefined' ? seals : undefined,
    sealCount: typeof seals!=='undefined' ? seals : undefined,
    sealMax: typeof CFG!=='undefined' && CFG.AWAKEN_MAX!==undefined ? CFG.AWAKEN_MAX : undefined,
    deliveryXp: typeof DELIVERY_XP!=='undefined' ? DELIVERY_XP : undefined,
    deliveryXpOverride: typeof DELIVER_XP!=='undefined' ? DELIVER_XP : undefined,
    bossReadFrozen: typeof readFrozen!=='undefined' ? readFrozen : undefined,
    answerHoldSeconds: typeof ANSWER_HOLD!=='undefined' ? ANSWER_HOLD : undefined,
    wrongPenalty: typeof WRONG_OIL!=='undefined' ? WRONG_OIL : undefined,
    hintCost1: typeof HINT_COST_FIRST!=='undefined' ? HINT_COST_FIRST : undefined,
    hintCost2: typeof HINT_COST_SECOND!=='undefined' ? HINT_COST_SECOND : undefined,
    katanaMaxTravel: typeof KATANA_MAX_TRAVEL!=='undefined' ? KATANA_MAX_TRAVEL : undefined,
    katanaMaxPierce: typeof KATANA_MAX_PIERCE!=='undefined' ? KATANA_MAX_PIERCE : undefined,
    needleExtraBudget: typeof NEEDLE_EXTRA_BUDGET!=='undefined' ? NEEDLE_EXTRA_BUDGET : undefined,
    needleExtraRadius: typeof NEEDLE_EXTRA_RADIUS!=='undefined' ? NEEDLE_EXTRA_RADIUS : undefined,
    boomBulletCap: typeof BOOM_BULLET_CAP!=='undefined' ? BOOM_BULLET_CAP : undefined,
    boomCooldownFloor: typeof BOOM_CD_FLOOR!=='undefined' ? BOOM_CD_FLOOR : undefined,
    needleCooldownFloor: typeof NEEDLE_CD_FLOOR!=='undefined' ? NEEDLE_CD_FLOOR : undefined,
    katanaCooldownFloor: typeof KATANA_CD_FLOOR!=='undefined' ? KATANA_CD_FLOOR : undefined,
    barrierCooldownFloor: typeof BARRIER_CD_FLOOR!=='undefined' ? BARRIER_CD_FLOOR : undefined,
    barrierLv5Radius: typeof BARRIER_LV5_R!=='undefined' ? BARRIER_LV5_R : undefined,
    barrierFieldSeconds: typeof BARRIER_FIELD_T!=='undefined' ? BARRIER_FIELD_T : undefined,
    barrierHeals: typeof BARRIER_HEALS!=='undefined' ? BARRIER_HEALS : undefined,
    thunderExecutesOnHp: typeof THUNDER_HP_EXECUTE!=='undefined' ? THUNDER_HP_EXECUTE : undefined,
    thunderLv5Radius: typeof THUNDER_LV5_R!=='undefined' ? THUNDER_LV5_R : undefined,
    thunderLv5Cooldown: typeof THUNDER_LV5_CD!=='undefined' ? THUNDER_LV5_CD : undefined,
    fireOrbitLv5: typeof FIRE_ORBIT_LV5!=='undefined' ? FIRE_ORBIT_LV5 : undefined,
    dragonCooldown: typeof DRAGON_CD!=='undefined' ? DRAGON_CD : undefined,
    scorchSeconds: typeof SCORCH_T!=='undefined' ? SCORCH_T : undefined,
    scorchMaxZones: typeof SCORCH_MAX_ZONES!=='undefined' ? SCORCH_MAX_ZONES : undefined,
    bossHpTable: typeof BOSS_HP!=='undefined' ? BOSS_HP : undefined,
    bossHpScalesWithPower: typeof BOSS_SCALES_WITH_POWER!=='undefined' ? BOSS_SCALES_WITH_POWER : undefined,
    gatekeeperHp: typeof GATEKEEPER_HP!=='undefined' ? GATEKEEPER_HP : undefined,
    bossQuizPerBoss: typeof BOSS_QUIZ_PER_BOSS!=='undefined' ? BOSS_QUIZ_PER_BOSS : undefined,
    passiveDamageStep: typeof PASSIVE_DMG_STEP!=='undefined' ? PASSIVE_DMG_STEP : undefined,
    passiveDamageMax: typeof PASSIVE_DMG_MAX!=='undefined' ? PASSIVE_DMG_MAX : undefined,
    critChanceCap: typeof CRIT_CHANCE_CAP!=='undefined' ? CRIT_CHANCE_CAP : undefined,
    oilRegenCap: typeof OIL_REGEN_CAP!=='undefined' ? OIL_REGEN_CAP : undefined,
    pickupSlow: typeof PICKUP_SLOW!=='undefined' ? PICKUP_SLOW : undefined,
    recallGuardSeconds: typeof RECALL_GUARD!=='undefined' ? RECALL_GUARD : undefined
  }),
  snapshot: () => ({
    state, level, xp, xpNeed: xpNeed(), oil, maxOil, score, delivered, failed,
    elapsed, bossStage, bossT, finalBossDefeated, x:P.x, y:P.y, inv:P.inv,
    job, orders, bossQ, bossQsDone: typeof bossQsDone!=='undefined' ? bossQsDone : undefined,
    enemies, enemyBullets, gems, winds: typeof winds==='undefined'?[]:winds,
    dragonShots: typeof dragonShots==='undefined'?[]:dragonShots,
    ghosts: typeof ghosts==='undefined'?[]:ghosts,
    dragonGhosts: typeof ghosts==='undefined'?[]:ghosts.filter(sp=>sp.dragon),
    dragonScorches: typeof dragonScorches==='undefined'?[]:dragonScorches,
    proj: typeof proj==='undefined'?[]:proj,
    needles: typeof needles==='undefined'?[]:needles,
    choiceLv: choices.map(c=>c.lv), choiceIds: choices.map(c=>c.id),
    runSummary
  })
};`;

/**
 * 建立一個完整的遊戲執行期沙箱。
 * @param {{seed?:number, stage?:string, storage?:Object}} options
 *   seed 決定 Math.random 的固定序列，讓排程／抽詞可重現。
 */
function loadGame(options = {}) {
  const seed = options.seed === undefined ? 1 : options.seed;
  const stage = options.stage || 'night-town';
  // revision 指向 git 提交時，全部 js/* 一律讀該版本（baseline 用）。
  const revision = options.revision || null;
  const reader = revision
    ? name => readAtRevision(revision, name)
    : read;

  // 可重現亂數：mulberry32，取代 Math.random。
  let state = seed >>> 0;
  const rand = () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const seededMath = Object.create(Math);
  seededMath.random = rand;

  const gradient = { addColorStop() {} };
  const ctx = new Proxy({
    setTransform() {}, fillText() {}, measureText: () => ({ width: 40 }),
    createLinearGradient: () => gradient, createRadialGradient: () => gradient
  }, { get: (o, k) => o[k] || (() => {}) });

  const canvas = {
    addEventListener() {}, setPointerCapture() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 900, height: 600 })
  };
  const events = {};
  const storage = new Map([['yokai-tutorial-v1', '"skip"']]);
  const env = {
    console, Set, Map, Math: seededMath, Date, performance: { now: () => 0 },
    navigator: {}, requestAnimationFrame() {},
    localStorage: { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, v) },
    document: {
      hidden: false, getElementById: id => id === 'controls-open' ? { click() {} } : canvas,
      addEventListener() {}
    },
    addEventListener: (k, f) => { events[k] = f; }
  };
  env.window = env;
  env.innerWidth = 900;
  env.innerHeight = 600;

  // vm.runInContext 必須帶 filename，否則 V8 coverage 無法把行數歸回 js/*.js，
// 只會看到 helper 本身，直接 require 的 config/store 也無法計入 game.js 的覆蓋率。
// 注意：即使帶了 filename，coverage 也只涵蓋沙箱實際載入並走到的路徑，
// 不可宣稱「整個 game.js 80% 覆蓋」。
const runSource = (c, source, name, revision) => {
  // name 不含副檔名（MODULE_ORDER 用 'words'、'game'…），coverage 的
  // filename 必須指向真實存在的 js/<name>.js，否則行數會歸到不存在的路徑。
  const base = name.endsWith('.js') ? name : `${name}.js`;
  const file = revision ? `${revision}:js/${base}` : path.join(ROOT, 'js', base);
  return vm.runInContext(source, c, { filename: file });
};

const c = vm.createContext(env);
  for (const name of MODULE_ORDER) runSource(c, reader(`${name}.js`), name, revision);
  if (!revision) {
    for (const name of V3_ONLY_MODULES) {
      // 注意副檔名：V3_ONLY_MODULES 存的是 'boss-ai'，檔名是 'boss-ai.js'。
      const file = path.join(ROOT, 'js', `${name}.js`);
      if (fs.existsSync(file)) runSource(c, fs.readFileSync(file, 'utf8'), name, null);
    }
  }
  c.CONTROLS.mount = () => {};
  const audioCalls = [];
  c.AUDIO = new Proxy({}, { get: (o, name) => () => audioCalls.push(name) });

  // 記錄 SKILLFX.play：讓測試觀察「實際施放了什麼、幾次、範圍多大」，
  // 而不是要求 production 為了測試新增常數旗標。
  const skillFxLog = [];
  const realSkillFx = c.SKILLFX;
  c.SKILLFX = new Proxy(realSkillFx, {
    get: (o, k) => {
      if (k === 'play') return (id, event, level, params) => {
        skillFxLog.push({ id, event, level: level ?? null, params: params || null });
        return o.play(id, event, level, params);
      };
      const v = o[k];
      return typeof v === 'function' ? v.bind(o) : v;
    }
  });

  const slashLog = [];
  c.RENDERER = new Proxy({
    getCtx: () => ctx, getDpr: () => 1, getCam: () => ({ x: 900, y: 600 }),
    getShakeOffset: () => ({ x: 0, y: 0 }), updateEffects: () => false,
    triggerShake() {},
    addSlashArc: (x, y, reach, ang, width, tier) => { slashLog.push({ x, y, reach, ang, width, tier }); },
    spawnDamageNumber() {}
  }, { get: (o, k) => o[k] || (() => {}) });
  runSource(c, reader('ui.js'), 'ui.js', revision);
  const uiStatics = Object.fromEntries(Object.entries(c.UI).filter(([, v]) => typeof v !== 'function'));
  c.UI = new Proxy({
    ...uiStatics,
    bossQuizLayout: c.UI.bossQuizLayout, codexButtons: c.UI.codexButtons,
    codexRows: c.UI.codexRows, pauseButtons: c.UI.pauseButtons,
    HINT_BTN: { x: 532, y: 20, w: 78, h: 40 },
    readableFont: () => '20px sans-serif'
  }, { get: (o, k) => o[k] || (() => {}) });

  const source = reader('game.js');
  const end = source.lastIndexOf('})();');
  runSource(c, source.slice(0, end) + FIXTURE + source.slice(end), 'game.js', revision);

  const fixture = c.window.fixture;
  fixture.ctx = ctx;
  fixture.env = c;
  fixture.audioCalls = audioCalls;
  fixture.events = events;
  fixture.seed = seed;
  fixture.skillFxLog = skillFxLog;
  fixture.slashLog = slashLog;
  // 測試用的環境 STORE（js/store.js 依賴 window，不能直接 require）。
  fixture.store = () => c.STORE;
  fixture.clearSkillFxLog = () => { skillFxLog.length = 0; };
  if (stage !== 'night-town') fixture.configureStage(stage);
  // start 需在沙箱內呼叫內部 resetRun，這裡以 startRun 的別名暴露。
  fixture.startRun = fixture.start;
  return fixture;
}

module.exports = { loadGame, ROOT, BASELINE_REVISION, readAtRevision };
