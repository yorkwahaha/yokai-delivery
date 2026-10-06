// 觸覺回饋系統：行動裝置 (Web Vibration API) 與藍芽／USB 手把 (Gamepad Haptics API Dual-Rumble)
window.HAPTICS = (() => {
  let enabled = true;
  const storageKey = 'yokai-haptics-v1';
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved !== null) enabled = JSON.parse(saved);
  } catch {}

  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify(enabled)); } catch {}
  }

  // 取得目前連接且具備震動馬達的手把
  function getActiveGamepad() {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
    try {
      const gps = navigator.getGamepads();
      if (!gps) return null;
      for (let i = 0; i < gps.length; i++) {
        const gp = gps[i];
        if (gp && gp.connected && (gp.vibrationActuator || gp.hapticActuators?.length)) {
          return gp;
        }
      }
    } catch {}
    return null;
  }

  // 觸發手把雙馬達震動 (Dual-Rumble: weak=高頻金屬輕震, strong=低頻重衝擊)
  function rumbleGamepad(duration = 100, weak = 0.5, strong = 0.5) {
    if (!enabled) return;
    const gp = getActiveGamepad();
    if (!gp) return;
    try {
      if (gp.vibrationActuator?.playEffect) {
        gp.vibrationActuator.playEffect('dual-rumble', {
          startDelay: 0,
          duration: Math.max(16, duration),
          weakMagnitude: Math.max(0, Math.min(1, weak)),
          strongMagnitude: Math.max(0, Math.min(1, strong))
        }).catch(() => {});
      } else if (gp.hapticActuators?.[0]?.pulse) {
        gp.hapticActuators[0].pulse(Math.max(weak, strong), duration).catch(() => {});
      }
    } catch {}
  }

  // 觸發行動裝置震動 (Web Vibration API)
  function vibrateMobile(pattern = 25) {
    if (!enabled) return;
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    try {
      navigator.vibrate(pattern);
    } catch {}
  }

  // 雙端統一觸覺管線
  function trigger(mobilePattern, gpDuration, gpWeak, gpStrong) {
    if (!enabled) return;
    vibrateMobile(mobilePattern);
    rumbleGamepad(gpDuration, gpWeak, gpStrong);
  }

  return {
    get enabled() { return enabled; },
    set enabled(val) { enabled = !!val; save(); },
    toggle() { enabled = !enabled; save(); return enabled; },

    // 1. 衝刺 (Dash): 極短促清脆輕震，破風瞬間爆發感
    dash() {
      trigger(28, 65, 0.65, 0.15);
    },

    // 2. 主角受傷 (Damage): 雙重重擊警示，沉重受挫感
    damage() {
      trigger([50, 40, 75], 160, 0.35, 0.90);
    },

    // 3. 護盾抵擋 (Shield Block): 金剛勾玉碎裂高頻清響
    shield() {
      trigger([30, 25, 45], 90, 0.75, 0.25);
    },

    // 4. 攻擊命中妖怪 (Hit / Katana Slash): 刀刃破空與切開目標的清脆回饋
    hit(isCrit = false) {
      if (isCrit) trigger(35, 90, 0.85, 0.45);
      else trigger(18, 48, 0.60, 0.10);
    },

    // 5. 取貨／交互點擊 (Pickup / Click): 機械開關撥動般的微點擊觸感
    pickup() {
      trigger(16, 35, 0.40, 0.05);
    },

    // 6. 送達成功 (Deliver Success): 輕快的雙重肯定節奏
    deliverSuccess() {
      trigger([25, 30, 45], 110, 0.60, 0.30);
    },

    // 7. 送達錯誤／誤配 (Deliver Wrong): 沉重錯扼短警報
    deliverWrong() {
      trigger([60, 40, 60], 140, 0.40, 0.70);
    },

    // 8. 破曉／大妖擊破 (Boss Defeat / Victory): 勝利沉穩深長震鳴
    bossDefeat() {
      trigger([90, 60, 180], 360, 0.60, 0.95);
    },

    // 9. 升級選卡 (Level Up): 勾玉灌注微震
    levelUp() {
      trigger([30, 40, 60], 120, 0.70, 0.35);
    },

    // 10. 警示脈衝 (Surge / Warning): 急促危險預警跳動
    warning() {
      trigger([40, 50, 40], 100, 0.45, 0.60);
    },

    // 自訂回饋測試介面
    rumble: trigger
  };
})();
