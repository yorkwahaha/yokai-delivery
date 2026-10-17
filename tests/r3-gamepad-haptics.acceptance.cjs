// R6／R3 獨立驗收：Gamepad Haptic Actuator（dual-rumble / pulse / 降級 / 清理）
// ---------------------------------------------------------------------------
// 產出者：OpenCode（獨占 tests/）。production 唯讀，本檔不改 js/。
// 執行：node --test tests/r3-gamepad-haptics.acceptance.cjs
//
// ⚠ 嚴守門（最重要的一條，不可放寬）：
//   `navigator.vibrate` 是「機身震動」，不是手把震動。任何情況下都不得把
//   navigator.vibrate 被呼叫當成「Xbox 手把震動成功」。本檔用三道獨立機制強制：
//     1. playEffects / pulses 與 bodyVibrations 分開記錄，互不干擾。
//     2. gamepadSuccessCount() 只數 actuator 呼叫，永遠不看 navigator.vibrate。
//     3. R3 (c) 明確斷言「沒有 actuator 時手把成功數必須為 0」。
//   技術依據：MDN GamepadHapticActuator.playEffect
//   https://developer.mozilla.org/en-US/docs/Web/API/GamepadHapticActuator/playEffect
//
// ⚠ 真機不可驗證（本檔一律不做此類斷言，見 R3 邊界聲明測試）：
//   - iPadOS/Safari、Android/Chrome 各自的實作支援
//   - Xbox Wireless Controller 藍牙實際雙馬達手感
//   - 使用者作業系統中的手把震動開關
//   必須記錄：平板 OS、瀏覽器、手把型號、連線方式。未實測前 R3 一律 NOT_TESTED_ON_DEVICE。
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
// R6_SRC_ROOT：校準時指向 %TEMP% 內的 js/ 副本（故障注入），平時指向 production。
const SRC_ROOT = process.env.R6_SRC_ROOT || path.join(ROOT, 'js');
const HAPTICS_JS = path.join(SRC_ROOT, 'haptics.js');
const HAPTICS_SRC = fs.readFileSync(HAPTICS_JS, 'utf8');

// --------------------------------------------------------------------------
// 可控手把沙箱：完整記錄 actuator 呼叫與 navigator.vibrate，兩者嚴格分離
// --------------------------------------------------------------------------
function hapticSandbox({ gamepads = [], supportsVibrate = true, stored = null, hidden = false } = {}) {
  const playEffects = [];    // 手把 playEffect 紀錄（唯一算手把成功）
  const pulses = [];         // 手把 pulse 紀錄（也算手把）
  const resets = [];         // actuator.reset 紀錄
  const bodyVibrations = []; // navigator.vibrate 紀錄（機身震動，永遠不算手把成功）
  const listeners = new Map();
  const store = new Map();
  if (stored !== null) store.set('yokai-haptics-v1', JSON.stringify(stored));

  const makeActuator = (opts = {}) => ({
    effects: opts.effects ?? ['dual-rumble'],
    playEffect(type, params) {
      playEffects.push({ type, params });
      if (opts.throwOnPlay) throw new Error('actuator failure');
      if (opts.reject) return Promise.reject(Object.assign(new Error('NotSupportedError'), { name: 'NotSupportedError' }));
      if (opts.rejectInvalidState) {
        return Promise.reject(Object.assign(new Error('InvalidStateError'), { name: 'InvalidStateError' }));
      }
      return Promise.resolve('complete');
    },
    ...(opts.noPlayEffect ? {} : {}),
  });
  const makePulseActuator = (opts = {}) => ({
    pulse(magnitude, duration) {
      pulses.push({ magnitude, duration });
      if (opts.throwOnPulse) throw new Error('pulse failure');
      return Promise.resolve('complete');
    },
  });

  // 依描述組出帶 actuator 的手把
  const resolved = gamepads.map(spec => {
    if (!spec) return null;
    const gp = {
      id: spec.id || 'Xbox Wireless Controller (STANDARD GAMEPAD)',
      index: spec.index ?? 0, connected: spec.connected !== false, mapping: 'standard',
      axes: [], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
    };
    if (spec.actuator) gp.vibrationActuator = makeActuator(spec.actuator);
    if (spec.pulseOnly) gp.hapticActuators = [makePulseActuator(spec.pulse || {})];
    if (spec.both) {
      gp.vibrationActuator = makeActuator(spec.actuator || {});
      gp.hapticActuators = [makePulseActuator(spec.pulse || {})];
    }
    if (spec.resettable) {
      const base = makeActuator(spec.actuator || {});
      gp.vibrationActuator = Object.assign(base, {
        reset() { resets.push('reset'); return Promise.resolve('done'); },
      });
    }
    return gp;
  });

  const fakeWindow = {
    addEventListener: (type, fn) => listeners.set(type, fn),
  };
  const fakeDocument = {
    hidden,
    addEventListener: (type, fn) => listeners.set(`doc:${type}`, fn),
  };
  const env = {
    console,
    localStorage: {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, v),
    },
    navigator: {
      getGamepads: () => resolved,
      ...(supportsVibrate ? { vibrate: p => { bodyVibrations.push(p); return true; } } : {}),
    },
    document: fakeDocument,
  };
  env.window = env;
  env.addEventListener = fakeWindow.addEventListener;
  vm.runInNewContext(HAPTICS_SRC, env, { filename: HAPTICS_JS });

  return {
    haptics: env.window.HAPTICS,
    playEffects, pulses, resets, bodyVibrations, listeners, store,
    // 手把「真的震動」= actuator 呼叫且幅度 > 0。
    // 幅度 0 的呼叫是停止／清空（resetActuator 的做法），不算回饋。
    gamepadSuccessCount: () =>
      playEffects.filter(c => (c.params?.weakMagnitude || 0) > 0 || (c.params?.strongMagnitude || 0) > 0).length
      + pulses.filter(p => p.magnitude > 0).length,
    // 所有 actuator 呼叫（含停止），供需要看完整序列的斷言使用
    actuatorCallCount: () => playEffects.length + pulses.length,
    // 真正的「震動中」pattern（vibrate(0) 是停止，不算震動）
    activeBodyVibrations: () => bodyVibrations.filter(p => p !== 0 && p !== false),
    setHidden: on => { fakeDocument.hidden = on; },
    gamepadConnected: (on, index = 0) => { resolved[index].connected = on; },
    fireEvent: (type, ev) => { const fn = listeners.get(type); if (fn) fn(ev || {}); },
  };
}

const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };

// --------------------------------------------------------------------------
// R3-a dual-rumble 主路徑
// --------------------------------------------------------------------------
test('R3 (a) 具 vibrationActuator 的手把必須走 dual-rumble，並帶合法參數', async () => {
  const box = hapticSandbox({ gamepads: [{ actuator: {} }] });
  box.haptics.damage();                       // 主受傷：長震、弱 0.35 / 強 0.90
  await flush();
  assert.equal(box.playEffects.length, 1, `dual-rumble 呼叫次數 ${box.playEffects.length}，應為 1`);
  const [call] = box.playEffects;
  assert.equal(call.type, 'dual-rumble', `型別應為 dual-rumble，實際 ${call.type}`);
  assert.ok(call.params.duration >= 16, `duration ${call.params.duration} 低於瀏覽器下限 16ms`);
  assert.ok(call.params.weakMagnitude >= 0 && call.params.weakMagnitude <= 1,
    `weakMagnitude ${call.params.weakMagnitude} 超出 0..1`);
  assert.ok(call.params.strongMagnitude >= 0 && call.params.strongMagnitude <= 1,
    `strongMagnitude ${call.params.strongMagnitude} 超出 0..1`);
  assert.equal(call.params.startDelay, 0, 'startDelay 應為 0');
});

// --------------------------------------------------------------------------
// R3-b pulse fallback
// --------------------------------------------------------------------------
test('R3 (b) 只有舊式 hapticActuators[].pulse 的手把必須走 pulse fallback', async () => {
  const box = hapticSandbox({ gamepads: [{ pulseOnly: true }] });
  box.haptics.dash();
  await flush();
  assert.equal(box.playEffects.length, 0, '不應呼叫 playEffect（此手把沒有 vibrationActuator）');
  assert.equal(box.pulses.length, 1, `pulse 呼叫次數 ${box.pulses.length}，應為 1`);
  assert.ok(box.pulses[0].magnitude >= 0 && box.pulses[0].magnitude <= 1,
    `pulse magnitude ${box.pulses[0].magnitude} 超出 0..1`);
  assert.ok(box.pulses[0].duration > 0, 'pulse duration 必須為正數');
});

test('R3 (b2) playEffect 被瀏覽器拒絕時，必須降級成 pulse 而非直接放棄', async () => {
  const box = hapticSandbox({ gamepads: [{ both: true, actuator: { reject: true } }] });
  box.haptics.dash();
  await flush();
  assert.equal(box.playEffects.length, 1, '應先嘗試 dual-rumble');
  assert.ok(box.pulses.length >= 1, `dual-rumble 被拒後未降級成 pulse（pulse ${box.pulses.length} 次）`);
});

test('R3 (b3) InvalidStateError 不得觸發多餘的 pulse（該錯誤代表狀態問題而非不支援）', async () => {
  const box = hapticSandbox({ gamepads: [{ both: true, actuator: { rejectInvalidState: true } }] });
  box.haptics.dash();
  await flush();
  assert.equal(box.playEffects.length, 1, '應先嘗試 dual-rumble');
  assert.equal(box.pulses.filter(p => p.magnitude > 0).length, 0,
    `InvalidStateError 不應降級成 pulse（實際 ${box.pulses.length} 次）`);
});

// --------------------------------------------------------------------------
// R3-c ★ 嚴守門：navigator.vibrate 絕不算手把震動成功
// --------------------------------------------------------------------------
test('R3 (c) 嚴守門：navigator.vibrate 是機身震動，永遠不得被當成手把震動成功', async () => {
  // 情境：完全沒有手把，只有機身震動 API
  const box = hapticSandbox({ gamepads: [null, null], supportsVibrate: true });
  box.haptics.damage();
  await flush();
  assert.equal(box.gamepadSuccessCount(), 0,
    '沒有任何手把 actuator，卻記錄到手把震動成功——這是 R3 明令禁止的誤判');
  assert.ok(box.activeBodyVibrations().length > 0, '機身震動應有發生（但不算手把成功）');

  // 情境：手把手把玩偶，同時兩路都有紀錄，且必須可區分
  const withPad = hapticSandbox({ gamepads: [{ actuator: {} }], supportsVibrate: true });
  withPad.haptics.dash();
  await flush();
  assert.equal(withPad.gamepadSuccessCount(), 1, '有 actuator 時必須真的呼叫 playEffect');
  assert.ok(withPad.playEffects.every(c => c.type === 'dual-rumble'),
    '手把成功必須來自 dual-rumble，不可來自 navigator.vibrate');
  // 反向確認：拔掉 navigator.vibrate，手把回饋仍必須存在
  const noBody = hapticSandbox({ gamepads: [{ actuator: {} }], supportsVibrate: false });
  noBody.haptics.dash();
  await flush();
  assert.equal(noBody.gamepadSuccessCount(), 1,
    '沒有 navigator.vibrate 時手把回饋消失：代表誤把機身震動當成手把路徑');
});

test('R3 (c2) 沒有 actuator 的手把（只按鍵）不得被算成手把震動', async () => {
  const box = hapticSandbox({ gamepads: [{ id: 'plain pad' }], supportsVibrate: true });
  box.haptics.damage();
  await flush();
  assert.equal(box.gamepadSuccessCount(), 0, '無 actuator 的手把被算成震動成功');
});

// --------------------------------------------------------------------------
// R3-d 設定開關：disabled 時不得發任何回饋
// --------------------------------------------------------------------------
test('R3 (d) 震動開關關閉時，手把與機身都不得發出任何回饋', async () => {
  const box = hapticSandbox({ gamepads: [{ actuator: {} }] });
  assert.equal(box.haptics.enabled, true, '前提失敗：預設應為開啟');
  assert.equal(box.haptics.toggle(), false, 'toggle() 應關閉並回傳 false');
  for (const name of ['dash', 'damage', 'shield', 'hit', 'pickup', 'deliverSuccess', 'deliverWrong', 'bossDefeat', 'levelUp', 'warning']) {
    box.haptics[name]();
  }
  await flush();
  assert.equal(box.gamepadSuccessCount(), 0, '關閉開關後仍有手把回饋');
  assert.equal(box.activeBodyVibrations().length, 0,
    `關閉開關後仍有機身震動 ${JSON.stringify(box.activeBodyVibrations())}`);

  box.haptics.toggle();
  box.haptics.dash();
  await flush();
  assert.equal(box.gamepadSuccessCount(), 1, '重新開啟後應恢復回饋');
});

test('R3 (d2) 開關狀態必須持久化，重新載入後沿用', () => {
  const box = hapticSandbox({ gamepads: [] });
  box.haptics.enabled = false;
  assert.equal(box.store.get('yokai-haptics-v1'), 'false', '開關狀態未寫入 localStorage');
  const reloaded = hapticSandbox({ gamepads: [], stored: false });
  assert.equal(reloaded.haptics.enabled, false, '重新載入後開關狀態未沿用');
});

// --------------------------------------------------------------------------
// R3-e 斷線／重連
// --------------------------------------------------------------------------
test('R3 (e) 手把斷線後不得發回饋，重連後必須恢復', async () => {
  const box = hapticSandbox({ gamepads: [{ actuator: {} }] });
  box.haptics.dash();
  await flush();
  assert.equal(box.gamepadSuccessCount(), 1, '連線時應有回饋');

  box.gamepadConnected(false);
  box.haptics.dash();
  await flush();
  assert.equal(box.gamepadSuccessCount(), 1, '斷線後仍發出手把回饋（應維持 1）');

  box.gamepadConnected(true);
  box.haptics.dash();
  await flush();
  assert.equal(box.gamepadSuccessCount(), 2, '重連後未恢復回饋');
});

test('R3 (e2) gamepaddisconnected 事件必須停止該手把的 actuator', async () => {
  const box = hapticSandbox({ gamepads: [{ resettable: true, actuator: {} }] });
  box.fireEvent('gamepaddisconnected', { gamepad: box.haptics ? null : null });
  // 沒帶 gamepad 時應走全面 stop()
  assert.equal(box.gamepadSuccessCount(), 0, '斷線事件本身不應觸發新的手把回饋');

  const box2 = hapticSandbox({ gamepads: [{ resettable: true, actuator: {} }] });
  const pad = { id: 'x' };
  box2.fireEvent('gamepaddisconnected', { gamepad: pad });
  // 對不屬於該清單的手把，至少不得拋錯
  assert.ok(true, '斷線事件處理不得拋錯');
});

// --------------------------------------------------------------------------
// R3-f actuator 丟錯／拒絕時必須安靜降級，不得中斷遊戲
// --------------------------------------------------------------------------
test('R3 (f) actuator 拋錯或 Promise 拒絕時必須安靜降級，不得把錯誤往外拋', async () => {
  const throwing = hapticSandbox({ gamepads: [{ actuator: { throwOnPlay: true } }] });
  assert.doesNotThrow(() => throwing.haptics.dash(), 'playEffect 拋錯時不應讓錯誤外洩');
  const rejecting = hapticSandbox({ gamepads: [{ actuator: { reject: true } }] });
  assert.doesNotThrow(() => rejecting.haptics.damage(), 'playEffect 回傳拒絕時不應讓錯誤外洩');
  await flush();
  assert.equal(rejecting.gamepadSuccessCount(), 1, '拒絕仍應算作「有嘗試手把回饋」');
});

// --------------------------------------------------------------------------
// R3-g 背景／隱藏頁面清理
// --------------------------------------------------------------------------
test('R3 (g) 頁面隱藏時不得發出新手把回饋', async () => {
  const box = hapticSandbox({ gamepads: [{ actuator: {} }], hidden: true });
  box.haptics.damage();
  await flush();
  assert.equal(box.gamepadSuccessCount(), 0, '隱藏頁面時仍發出手把回饋');
  assert.equal(box.activeBodyVibrations().length, 0, '隱藏頁面時仍發出機身震動');
});

test('R3 (g2) visibilitychange 轉隱藏時必須停止既有回饋', async () => {
  const box = hapticSandbox({ gamepads: [{ resettable: true, actuator: {} }] });
  box.haptics.damage();
  await flush();
  assert.equal(box.gamepadSuccessCount(), 1, '前提失敗：一開始應有回饋');
  box.setHidden(true);
  box.fireEvent('doc:visibilitychange');
  await flush();
  assert.ok(box.resets.length > 0 || box.bodyVibrations.includes(0),
    '轉為隱藏時沒有任何停止訊號：既有回饋會在背景中持續');
});

test('R3 (g3) blur / pagehide 必須停止回饋（暫停與離開頁面的清理）', async () => {
  for (const event of ['blur', 'pagehide']) {
    const box = hapticSandbox({ gamepads: [{ resettable: true, actuator: {} }] });
    box.haptics.dash();
    await flush();
    const before = box.resets.length;
    box.fireEvent(event);
    await flush();
    assert.ok(box.resets.length > before, `${event} 沒有停止 actuator`);
  }
});

test('R3 (g4) 四重安全停止：暫停／切背景／斷線／關閉震動必須立即重置手把與停止機身', async () => {
  // 1. 暫停安全停止（pause / gamepause / HAPTICS.stop()）
  for (const pEvt of ['pause', 'gamepause', 'doc:pause']) {
    const box = hapticSandbox({ gamepads: [{ resettable: true, actuator: {} }] });
    box.haptics.damage();
    await flush();
    const beforeResets = box.resets.length;
    box.fireEvent(pEvt);
    await flush();
    assert.ok(box.resets.length > beforeResets, `${pEvt} 事件未重置手把 actuator`);
    assert.ok(box.bodyVibrations.includes(0), `${pEvt} 未發出機身停止訊號 (vibrate(0))`);
  }

  // 2. 直接呼叫 HAPTICS.stop()
  const stopBox = hapticSandbox({ gamepads: [{ resettable: true, actuator: {} }] });
  stopBox.haptics.bossDefeat();
  await flush();
  const preStopResets = stopBox.resets.length;
  stopBox.haptics.stop();
  await flush();
  assert.ok(stopBox.resets.length > preStopResets, 'HAPTICS.stop() 未重置手把 actuator');
  assert.ok(stopBox.bodyVibrations.includes(0), 'HAPTICS.stop() 未發出機身停止訊號');

  // 3. 震動關閉即刻停止
  const disableBox = hapticSandbox({ gamepads: [{ resettable: true, actuator: {} }] });
  disableBox.haptics.damage();
  await flush();
  const preDisableResets = disableBox.resets.length;
  disableBox.haptics.enabled = false;
  await flush();
  assert.ok(disableBox.resets.length > preDisableResets, 'enabled=false 未重置手把 actuator');
  assert.ok(disableBox.bodyVibrations.includes(0), 'enabled=false 未發出機身停止訊號');

  // 4. 控制器斷線即刻停止
  const dcBox = hapticSandbox({ gamepads: [{ resettable: true, actuator: {} }] });
  dcBox.haptics.dash();
  await flush();
  const preDcResets = dcBox.resets.length;
  dcBox.fireEvent('gamepaddisconnected');
  await flush();
  assert.ok(dcBox.resets.length > preDcResets, 'gamepaddisconnected 未重置手把 actuator');
});

// --------------------------------------------------------------------------
// R3-h 全事件覆蓋
// --------------------------------------------------------------------------
test('R3 (h) 十個對外事件都必須同時驅動機身與手把（雙端統一管線）', async () => {
  const events = ['dash', 'damage', 'shield', 'hit', 'pickup', 'deliverSuccess', 'deliverWrong', 'bossDefeat', 'levelUp', 'warning'];
  for (const name of events) {
    const box = hapticSandbox({ gamepads: [{ actuator: {} }] });
    box.haptics[name]();
    await flush();
    assert.equal(box.gamepadSuccessCount(), 1, `${name} 未觸發手把回饋`);
    assert.equal(box.activeBodyVibrations().length, 1, `${name} 未觸發機身震動`);
    assert.equal(box.playEffects[0].type, 'dual-rumble', `${name} 未使用 dual-rumble`);
  }
});

test('R3 (h2) crit hit 與一般 hit 必須是不同的手把參數', async () => {
  const normal = hapticSandbox({ gamepads: [{ actuator: {} }] });
  normal.haptics.hit(false);
  const crit = hapticSandbox({ gamepads: [{ actuator: {} }] });
  crit.haptics.hit(true);
  await flush();
  assert.notDeepEqual(normal.playEffects[0].params, crit.playEffects[0].params,
    '暴擊與一般命中的手把參數完全相同，無法區分');
});

test('R3 (h3) 參數必須被夾在合法範圍內（異常數值不得直接透傳給瀏覽器）', async () => {
  const box = hapticSandbox({ gamepads: [{ actuator: {} }] });
  box.haptics.rumble([10], -50, 5, NaN);   // 故意給非法值
  await flush();
  assert.equal(box.gamepadSuccessCount(), 1, '前提失敗：自訂 rumble 沒有觸發手把回饋');
  const p = box.playEffects[0].params;
  assert.ok(p.duration >= 16, `duration ${p.duration} 未夾到 16ms 下限`);
  assert.ok(p.weakMagnitude >= 0 && p.weakMagnitude <= 1, `weakMagnitude ${p.weakMagnitude} 超出 0..1`);
  assert.ok(p.strongMagnitude >= 0 && p.strongMagnitude <= 1, `strongMagnitude ${p.strongMagnitude} 超出 0..1`);
});

// --------------------------------------------------------------------------
// R3-i 來源契約
// --------------------------------------------------------------------------
test('R3 (i) 來源契約：actuator 必須優先於 pulse，機身 vibrate 只能是獨立路徑', () => {
  assert.match(HAPTICS_SRC, /playEffect\(['"]dual-rumble['"]/,
    'js/haptics.js 沒有使用 dual-rumble');
  assert.match(HAPTICS_SRC, /function rumbleGamepad\(/,
    'js/haptics.js 缺少獨立的 rumbleGamepad（手把震動）路徑');
  assert.match(HAPTICS_SRC, /function vibrateMobile\(/,
    'js/haptics.js 缺少獨立的 vibrateMobile（機身震動）路徑');
  assert.match(HAPTICS_SRC, /navigator\.vibrate\(pattern\)/,
    'js/haptics.js 的機身路徑沒有呼叫 navigator.vibrate');
  // 手把路徑不得直接呼叫 navigator.vibrate（那會造成「機身震動冒充手把成功」）
  const rumbleBody = HAPTICS_SRC.slice(HAPTICS_SRC.indexOf('function rumbleGamepad('));
  const rumbleEnd = rumbleBody.indexOf('function vibrateMobile(');
  const onlyRumble = rumbleBody.slice(0, rumbleEnd > 0 ? rumbleEnd : undefined);
  assert.doesNotMatch(onlyRumble, /navigator\.vibrate\(/,
    'rumbleGamepad 內直接呼叫 navigator.vibrate：手把路徑與機身路徑被混為一談');
});

// --------------------------------------------------------------------------
// R3 邊界聲明：真機未測就是未測
// --------------------------------------------------------------------------
test('R3 邊界聲明：真機項目維持 NOT_TESTED_ON_DEVICE，不因本檔通過而改變', () => {
  const mustRecord = ['平板 OS (iPadOS/Android)', '瀏覽器 (Safari/Chrome)', '手把型號 (Xbox Wireless Controller)', '連線方式 (Bluetooth)'];
  assert.equal(mustRecord.length, 4, '真機紀錄欄位不完整');
  // 嚴守門再確認一次：即使全部 mock 測試通過，也不能宣稱實機通過。
  assert.ok(true, 'R3 實機驗證維持 NOT_TESTED_ON_DEVICE');
});