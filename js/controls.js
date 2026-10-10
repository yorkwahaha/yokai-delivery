// Physical key codes keep movement independent of keyboard language / Caps Lock.
window.CONTROLS = (() => {
  const defaults = { u: 'KeyW', d: 'KeyS', l: 'KeyA', r: 'KeyD', dash: 'Space', interact: 'KeyE', hint: 'KeyH', pause: 'KeyP', codex: 'KeyC', mute: 'KeyM' };
  const fixed = { ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r', Escape: 'pause', ShiftLeft: 'dash', ShiftRight: 'dash' };
  const labels = { u: '向上', d: '向下', l: '向左', r: '向右', dash: '衝刺', interact: '取貨／確認', hint: '提示', pause: '暫停', codex: '圖鑑', mute: '靜音' };
  const valid = code => /^(Key[A-Z]|Space|ShiftLeft|ShiftRight|Numpad[0456789])$/.test(code);
  const storageKey = 'yokai-controls-v1';
  let bindings = { ...defaults };
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved && Object.keys(defaults).every(a => valid(saved[a]) && (!fixed[saved[a]] || fixed[saved[a]] === a)) && new Set(Object.values(saved)).size === Object.keys(defaults).length) bindings = Object.fromEntries(Object.keys(defaults).map(a => [a, saved[a]]));
  } catch {}
  const save = () => { try { localStorage.setItem(storageKey, JSON.stringify(bindings)); } catch {} };
  let dialog, waiting = null;
  const display = code => code === 'Space' ? '空白鍵' : code === 'ShiftLeft' ? '左 Shift' : code === 'ShiftRight' ? '右 Shift' : code.replace('Key', '').replace('Numpad', '數字鍵盤 ');
  function render() {
    if (!dialog) return;
    dialog.querySelectorAll('[data-action]').forEach(btn => {
      const action = btn.dataset.action;
      btn.textContent = `${labels[action]}：${waiting === action ? '請按新按鍵…' : display(bindings[action])}`;
    });
  }
  const api = {
    label: action => display(bindings[action] || ''),
    action: code => fixed[code] || Object.keys(bindings).find(a => bindings[a] === code),
    bind(action, code) {
      if (!(action in defaults) || !valid(code) || (fixed[code] && fixed[code] !== action) || Object.keys(bindings).some(a => a !== action && bindings[a] === code)) return false;
      bindings[action] = code; save(); return true;
    },
    preset(hand) {
      bindings = hand === 'left' ? { ...defaults, u: 'KeyI', d: 'KeyK', l: 'KeyJ', r: 'KeyL', interact: 'KeyU', hint: 'KeyO' } : { ...defaults };
      save(); waiting = null; render();
    },
    isOpen: () => !!dialog?.open,
    gamepad(gp, previous) {
      const pressed = i => gp.buttons[i]?.pressed && !previous[i];
      if (pressed(1) || pressed(9)) {
        if (waiting) { waiting = null; render(); }
        else dialog.close();
        return;
      }
      const buttons = [...dialog.querySelectorAll('button, input')];
      const delta = pressed(12) || pressed(14) ? -1 : pressed(13) || pressed(15) ? 1 : 0;
      if (delta) {
        const index = buttons.indexOf(document.activeElement);
        const next = index < 0 ? (delta > 0 ? 0 : buttons.length - 1) : (index + delta + buttons.length) % buttons.length;
        buttons[next]?.focus();
      } else if (pressed(0) && buttons.includes(document.activeElement)) document.activeElement.click();
    },
    mount() {
      dialog = document.getElementById('controls-dialog');
      if (window.HAPTICS) {
        const haptics = document.getElementById('haptics-enabled');
        haptics.checked = window.HAPTICS.enabled;
        haptics.onchange = () => { window.HAPTICS.enabled = haptics.checked; };
      }
      document.getElementById('controls-open').onclick = () => { waiting = null; render(); dialog.showModal(); };
      dialog.querySelectorAll('[data-action]').forEach(btn => { btn.onclick = () => { waiting = btn.dataset.action; render(); }; });
      dialog.querySelectorAll('[data-preset]').forEach(btn => { btn.onclick = () => { api.preset(btn.dataset.preset); }; });
      dialog.addEventListener('close', () => { waiting = null; document.getElementById('game').focus(); });
      dialog.addEventListener('keydown', e => {
        if (e.code === 'Escape') {
          e.preventDefault(); e.stopPropagation();
          if (waiting) { waiting = null; render(); }
          else dialog.close();
          return;
        }
        if (!waiting) return;
        e.preventDefault(); e.stopPropagation();
        const status = document.getElementById('controls-status');
        if (api.bind(waiting, e.code)) { waiting = null; status.textContent = '已儲存按鍵。'; }
        else status.textContent = '按鍵已使用或保留；請選英文字母、空白或數字鍵盤。Shift 僅用於衝刺。';
        render();
      });
      render();
    }
  };
  return api;
})();
