// Physical key codes keep movement independent of keyboard language / Caps Lock.
window.CONTROLS = (() => {
  const defaults = { u: 'KeyW', d: 'KeyS', l: 'KeyA', r: 'KeyD', dash: 'Space', interact: 'KeyE', pause: 'KeyP', codex: 'KeyC', mute: 'KeyM' };
  const leftHand = { ...defaults, u:'KeyI', d:'KeyK', l:'KeyJ', r:'KeyL', interact:'KeyU' };
  const fixed = { ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r', Escape: 'pause', ShiftLeft: 'dash', ShiftRight: 'dash' };
  const labels = { u: '向上', d: '向下', l: '向左', r: '向右', dash: '衝刺', interact: '取貨／確認', pause: '暫停', codex: '圖鑑', mute: '靜音' };
  const directions = {u:'up', d:'down', l:'left', r:'right'};
  const valid = code => typeof code === 'string' && /^(Key[A-Z]|Space|ShiftLeft|ShiftRight|Numpad[0456789])$/.test(code);
  const storageKey = 'yokai-controls-v1';
  const actions = Object.keys(defaults);
  let bindings = { ...defaults };
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved && actions.every(a => valid(saved[a]) && (!fixed[saved[a]] || fixed[saved[a]] === a)) &&
        new Set(actions.map(a => saved[a])).size === actions.length) {
      bindings = Object.fromEntries(actions.map(a => [a, saved[a]]));
    }
  } catch {}
  const save = () => { try { localStorage.setItem(storageKey, JSON.stringify(bindings)); } catch {} };
  const display = code => code === 'Space' ? '空白鍵' : code === 'ShiftLeft' ? '左 Shift' : code === 'ShiftRight' ? '右 Shift' : code.replace('Key', '').replace('Numpad', '數字鍵盤 ');
  const focus = node => window.UI_COMPENDIUM ? window.UI_COMPENDIUM.focusControl(node) : node?.focus();
  let dialog, waiting = null, tabs = [], panels = [], presetButtons = [], actionButtons = [];
  let selectedTab = 0, cancelButton, status, padDirection = '';

  function renderBindings() {
    for (const button of actionButtons) {
      const action = button.dataset.action;
      const title = document.createElement('span');
      title.textContent = labels[action];
      const key = document.createElement('kbd');
      key.textContent = waiting === action ? '等待輸入' : display(bindings[action]);
      button.replaceChildren(title, key);
      button.setAttribute('aria-pressed', String(waiting === action));
    }
    for (const button of presetButtons) {
      const preset = button.dataset.preset === 'left' ? leftHand : defaults;
      button.setAttribute('aria-pressed', String(actions.every(key => bindings[key] === preset[key])));
    }
    if (cancelButton) cancelButton.hidden = !waiting;
  }

  function announce(message) {
    if (status) status.textContent = message;
  }

  function finishBinding(message) {
    const action = waiting;
    waiting = null;
    renderBindings();
    announce(message);
    if (action) focus(actionButtons.find(button => button.dataset.action === action));
  }

  function selectTab(index, move = true) {
    if (!tabs.length) return;
    selectedTab = (index + tabs.length) % tabs.length;
    for (const [i, tab] of tabs.entries()) {
      tab.tabIndex = i === selectedTab ? 0 : -1;
      tab.setAttribute('aria-selected', String(i === selectedTab));
    }
    for (const panel of panels) panel.hidden = panel.dataset.controlsPanel !== tabs[selectedTab].dataset.controlsTab;
    if (move) focus(tabs[selectedTab]);
  }

  function back() {
    if (waiting) finishBinding('已取消綁定。');
    else dialog.close();
  }

  function moveFocus(direction) {
    if (tabs.includes(document.activeElement) && (direction === 'left' || direction === 'right')) {
      selectTab(selectedTab + (direction === 'left' ? -1 : 1));
      return true;
    }
    if (window.UI_COMPENDIUM) return window.UI_COMPENDIUM.moveFocus(dialog, direction);
    const buttons = [...dialog.querySelectorAll('button, input')];
    const delta = direction === 'left' || direction === 'up' ? -1 : 1;
    const index = buttons.indexOf(document.activeElement);
    const next = index < 0 ? (delta > 0 ? 0 : buttons.length - 1) : (index + delta + buttons.length) % buttons.length;
    focus(buttons[next]);
    return !!buttons.length;
  }

  const api = {
    label: action => display(bindings[action] || ''),
    action: code => fixed[code] || actions.find(a => bindings[a] === code),
    bind(action, code) {
      if (!Object.hasOwn(defaults, action) || !valid(code) || (fixed[code] && fixed[code] !== action) ||
          actions.some(a => a !== action && bindings[a] === code)) return false;
      bindings[action] = code; save(); return true;
    },
    preset(hand) {
      bindings = { ...(hand === 'left' ? leftHand : defaults) };
      save(); waiting = null; renderBindings();
    },
    isOpen: () => !!dialog?.open,
    gamepad(gp, previous) {
      const pressed = i => gp.buttons[i]?.pressed && !previous[i];
      if (pressed(1) || pressed(9)) { back(); return; }
      if (waiting) return;
      const digital = ['up','down','left','right'].find((_, i) => pressed(12 + i));
      const [x = 0, y = 0] = gp.axes || [];
      const horizontal = Math.abs(x) > Math.abs(y);
      const axis = horizontal ? x : y;
      const stick = Math.abs(axis) > .55 ? (horizontal ? (axis > 0 ? 'right' : 'left') : (axis > 0 ? 'down' : 'up')) : '';
      const move = digital || (stick !== padDirection ? stick : '');
      padDirection = stick;
      if (pressed(4) || pressed(5) || move || pressed(0)) dialog.setAttribute?.('data-pad','');
      if (pressed(4) || pressed(5)) selectTab(selectedTab + (pressed(4) ? -1 : 1));
      else if (move) moveFocus(move);
      else if (pressed(0) && dialog.contains?.(document.activeElement) !== false) document.activeElement?.click();
    },
    mount() {
      dialog = document.getElementById('controls-dialog');
      const opener = document.getElementById('controls-open');
      tabs = [...dialog.querySelectorAll('[data-controls-tab]')];
      panels = [...dialog.querySelectorAll('[data-controls-panel]')];
      actionButtons = [...dialog.querySelectorAll('[data-action]')];
      presetButtons = [...dialog.querySelectorAll('[data-preset]')];
      cancelButton = dialog.querySelector?.('[data-controls-cancel]');
      status = document.getElementById('controls-status');
      if (window.DEV_MODE?.isLoopback?.(window.location) || window.DEV_MODE?.isDevMode?.(window.location)) {
        dialog.classList.add('local-font');
      }
      if (window.HAPTICS) {
        const toggles = [...dialog.querySelectorAll('[data-haptics]')];
        if (!toggles.length) toggles.push(document.getElementById('haptics-enabled'));
        for (const input of toggles) {
          input.checked = window.HAPTICS.enabled;
          input.onchange = () => {
            window.HAPTICS.enabled = input.checked;
            for (const toggle of toggles) toggle.checked = input.checked;
          };
        }
      }
      opener.onclick = () => {
        waiting = null;
        padDirection = '';
        announce('');
        renderBindings();
        selectTab(0,false);
        dialog.showModal();
        focus(tabs[0]);
      };
      for (const [i, tab] of tabs.entries()) tab.onclick = () => { if (!waiting) selectTab(i); };
      for (const button of actionButtons) button.onclick = () => {
        if (waiting) return;
        waiting = button.dataset.action;
        focus(button);
        renderBindings();
        announce('請按下新的按鍵');
      };
      for (const button of presetButtons) button.onclick = () => {
        if (waiting) return;
        api.preset(button.dataset.preset);
        announce('已套用並儲存預設按鍵。');
      };
      const reset = dialog.querySelector?.('[data-controls-reset]');
      const returnButton = dialog.querySelector?.('[data-controls-back]');
      if (reset) reset.onclick = () => {
        if (waiting) return;
        api.preset('right');
        announce('已恢復預設按鍵。');
      };
      if (returnButton) returnButton.onclick = back;
      if (cancelButton) cancelButton.onclick = () => finishBinding('已取消綁定。');
      dialog.addEventListener('pointerdown', () => dialog.removeAttribute('data-pad'));
      dialog.addEventListener('close', () => { waiting = null; document.getElementById('game').focus(); });
      dialog.addEventListener('cancel', event => { event.preventDefault(); back(); });
      dialog.addEventListener('keydown', event => {
        const {code} = event;
        dialog.removeAttribute?.('data-pad');
        event.stopPropagation();
        if (code === 'Escape') {
          event.preventDefault();
          if (!event.repeat) back();
        } else if (waiting) {
          event.preventDefault();
          if (event.repeat || event.metaKey || event.altKey || event.ctrlKey) return;
          if (api.bind(waiting, code)) finishBinding('已儲存按鍵。');
          else announce('此鍵已使用或保留。請按另一鍵，或按 Esc 取消。Shift 僅用於衝刺。');
        } else {
          const action = api.action(code);
          if (directions[action] && moveFocus(directions[action])) event.preventDefault();
          else if (action === 'interact' && code !== 'Enter' && code !== 'Space') {
            event.preventDefault();
            if (!event.repeat) document.activeElement?.click();
          }
        }
      });
      renderBindings();
    }
  };
  return api;
})();
