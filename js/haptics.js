// 觸覺回饋：機身 Web Vibration 與手把 Gamepad Haptics（dual-rumble，失敗才 pulse）。
// 機身 vibrate 成功不代表手把在震。playEffect 的 Promise 被接受也不代表真機已震過。
// 遊戲畫面不顯示震動成功。暫停要停手把時，須由 game.js 呼叫 stop()（見 docs/r3-gamepad-validation.md）。
window.HAPTICS = (() => {
  let enabled = true;
  let wave = 0;
  const storageKey = 'yokai-haptics-v1';
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (typeof parsed === 'boolean') enabled = parsed;
    }
  } catch {}

  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify(enabled)); } catch {}
  }

  function clamp01(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
  }

  function durationMs(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 16;
    return Math.max(16, Math.round(n));
  }

  function pageHidden() {
    try {
      return typeof document !== 'undefined' && document.hidden === true;
    } catch {
      return false;
    }
  }

  function listen(target, type, fn) {
    if (target && typeof target.addEventListener === 'function') target.addEventListener(type, fn);
  }

  function actuatorsOf(gp) {
    const list = [];
    const push = actuator => {
      if (actuator && !list.includes(actuator)) list.push(actuator);
    };
    if (!gp) return list;
    push(gp.vibrationActuator);
    const extras = gp.hapticActuators;
    if (extras && typeof extras.length === 'number') {
      for (let i = 0; i < extras.length; i++) push(extras[i]);
    }
    return list;
  }

  // true／false＝瀏覽器已表明是否支援；null＝沒有 effects／type，交給 playEffect 的拒絕。
  function effectSupported(actuator, type) {
    const effects = actuator && actuator.effects;
    if (effects && typeof effects.length === 'number') {
      for (let i = 0; i < effects.length; i++) if (effects[i] === type) return true;
      return false;
    }
    if (actuator && typeof actuator.type === 'string' && actuator.type) return actuator.type === type;
    return null;
  }

  function settle(result) {
    if (result && typeof result.catch === 'function') result.catch(() => {});
  }

  function resetActuator(actuator) {
    if (!actuator) return;
    try {
      if (typeof actuator.reset === 'function') {
        settle(actuator.reset());
        return;
      }
    } catch {}
    try {
      if (typeof actuator.playEffect === 'function' && effectSupported(actuator, 'dual-rumble') !== false) {
        settle(actuator.playEffect('dual-rumble', {
          startDelay: 0, duration: 1, weakMagnitude: 0, strongMagnitude: 0
        }));
        return;
      }
    } catch {}
    try {
      if (typeof actuator.pulse === 'function') settle(actuator.pulse(0, 1));
    } catch {}
  }

  function eachPad(visit) {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return;
    let pads;
    try { pads = navigator.getGamepads(); } catch { return; }
    if (!pads) return;
    for (let i = 0; i < pads.length; i++) if (pads[i]) visit(pads[i]);
  }

  function stopDevice() {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    try { navigator.vibrate(0); } catch {}
  }

  function stop(extraPad) {
    wave += 1;
    stopDevice();
    if (extraPad) actuatorsOf(extraPad).forEach(resetActuator);
    eachPad(gp => actuatorsOf(gp).forEach(resetActuator));
  }

  function connectedPad() {
    let found = null;
    eachPad(gp => {
      if (!found && gp.connected && actuatorsOf(gp).length) found = gp;
    });
    return found;
  }

  function pulse(actuator, duration, weak, strong) {
    if (!enabled || pageHidden() || !actuator || typeof actuator.pulse !== 'function') return;
    try {
      settle(actuator.pulse(Math.max(clamp01(weak), clamp01(strong)), duration));
    } catch {}
  }

  function playDual(actuator, duration, weak, strong, fallback) {
    const stamp = wave;
    const retry = () => {
      if (stamp !== wave || !enabled || pageHidden()) return;
      pulse(fallback, duration, weak, strong);
    };
    let pending;
    try {
      pending = actuator.playEffect('dual-rumble', {
        startDelay: 0,
        duration,
        weakMagnitude: clamp01(weak),
        strongMagnitude: clamp01(strong)
      });
    } catch {
      retry();
      return;
    }
    if (!pending || typeof pending.then !== 'function') return;
    pending.then(() => {}, err => {
      if (err && err.name === 'InvalidStateError') return;
      retry();
    });
  }

  function rumbleGamepad(duration, weak, strong) {
    if (!enabled || pageHidden()) return;
    const gp = connectedPad();
    if (!gp) return;
    const list = actuatorsOf(gp);
    let dual = null;
    let unknown = null;
    let pulser = null;
    for (let i = 0; i < list.length; i++) {
      const actuator = list[i];
      if (typeof actuator.playEffect === 'function') {
        const support = effectSupported(actuator, 'dual-rumble');
        if (support === true && !dual) dual = actuator;
        else if (support === null && !unknown) unknown = actuator;
      }
      if (!pulser && typeof actuator.pulse === 'function') pulser = actuator;
    }
    const chosen = dual || unknown;
    const ms = durationMs(duration);
    if (chosen) playDual(chosen, ms, weak, strong, pulser || chosen);
    else pulse(pulser, ms, weak, strong);
  }

  function vibrateMobile(pattern) {
    if (!enabled || pageHidden()) return;
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    try { navigator.vibrate(pattern); } catch {}
  }

  function trigger(mobilePattern, gpDuration, gpWeak, gpStrong) {
    if (!enabled) return;
    vibrateMobile(mobilePattern);
    rumbleGamepad(gpDuration, gpWeak, gpStrong);
  }

  function setEnabled(val) {
    enabled = !!val;
    save();
    if (!enabled) stop();
  }

  listen(typeof window !== 'undefined' ? window : null, 'blur', () => stop());
  listen(typeof window !== 'undefined' ? window : null, 'pagehide', () => stop());
  listen(typeof window !== 'undefined' ? window : null, 'pause', () => stop());
  listen(typeof window !== 'undefined' ? window : null, 'gamepause', () => stop());
  listen(typeof window !== 'undefined' ? window : null, 'gamepaddisconnected', ev => {
    const pad = ev && ev.gamepad;
    if (!pad) {
      stop();
      return;
    }
    wave += 1;
    actuatorsOf(pad).forEach(resetActuator);
  });
  if (typeof document !== 'undefined') {
    listen(document, 'visibilitychange', () => { if (document.hidden) stop(); });
    listen(document, 'pause', () => stop());
    listen(document, 'gamepause', () => stop());
  }

  return {
    get enabled() { return enabled; },
    set enabled(val) { setEnabled(val); },
    toggle() { setEnabled(!enabled); return enabled; },
    stop,

    dash() { trigger(28, 65, 0.65, 0.15); },
    damage() { trigger([50, 40, 75], 160, 0.35, 0.90); },
    shield() { trigger([30, 25, 45], 90, 0.75, 0.25); },
    hit(isCrit = false) {
      if (isCrit) trigger(35, 90, 0.85, 0.45);
      else trigger(18, 48, 0.60, 0.10);
    },
    pickup() { trigger(16, 35, 0.40, 0.05); },
    deliverSuccess() { trigger([25, 30, 45], 110, 0.60, 0.30); },
    deliverWrong() { trigger([60, 40, 60], 140, 0.40, 0.70); },
    bossDefeat() { trigger([90, 60, 180], 360, 0.60, 0.95); },
    levelUp() { trigger([30, 40, 60], 120, 0.70, 0.35); },
    warning() { trigger([40, 50, 40], 100, 0.45, 0.60); },
    rumble: trigger
  };
})();
