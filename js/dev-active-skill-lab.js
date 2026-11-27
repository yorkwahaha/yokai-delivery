"use strict";

window.DEV_ACTIVE_SKILL_LAB = {
  mount(api, actions) {
    api.loadArt();
    const stylesheet=document.createElement("link");
    stylesheet.rel="stylesheet";
    stylesheet.href="js/dev-active-skill-lab.css?v=20261127-f1";
    document.head.append(stylesheet);

    const panel=document.createElement("details");
    panel.id="active-skill-lab";
    panel.open=true;
    panel.innerHTML=`
      <summary>DEV 秘術演練</summary>
      <form>
        <p>妖刀固定起手。可搭配一至三招候選秘術。</p>
        <div class="lab-config">
          <label>敵群 <select name="scene">
            <option value="normal">普通妖怪</option><option value="tank">重甲妖怪</option>
            <option value="boss">單首領</option><option value="bosses">三首領</option>
            <option value="crowd">高密度怪群</option>
          </select></label>
          <label>種子 <input name="seed" type="number" min="0" max="4294967295" value="101" inputmode="numeric" required></label>
          <label>視角 <select name="tilt"><option value=".6">2.5D</option><option value="1">2D</option></select></label>
          <label><input name="stationary" type="checkbox"> 固定敵人位置</label>
          <label><input name="diagnostics" type="checkbox" checked> 顯示碰撞診斷</label>
        </div>
        <div class="lab-loadouts"></div>
        <p class="lab-message" role="status"></p>
        <div class="lab-buttons">
          <button type="submit">開始／重置</button>
          <button type="button" data-action="pause">暫停／繼續</button>
          <button type="button" data-action="draw">測試抽卡</button>
          <button type="button" data-action="build">本局構築</button>
        </div>
      </form>`;
    const form=panel.querySelector("form"), fields=form.elements;
    const loadouts=panel.querySelector(".lab-loadouts"), message=panel.querySelector(".lab-message");
    const sets=new Map();
    for (const id of api.ids) {
      const field=document.createElement("fieldset");
      const name=api.cards[id].zh;
      field.innerHTML=`<legend>${name}</legend>
        <label>等級 <select aria-label="${name}等級">
          <option value="0">未裝備</option>${api.upgrades[id].map((_,i)=>`<option value="${i+1}">Lv${i+1}</option>`).join("")}
        </select></label>
        <div class="lab-variants">${Object.values(api.mutations).filter(card=>card.skillId===id).map(card=>
          `<label><input type="checkbox" value="${card.id}"> ${card.n}</label>`).join("")}</div>`;
      loadouts.append(field);
      sets.set(id,field);
    }
    sets.values().next().value.querySelector("select").value="5";
    function refresh() {
      const equipped=[...sets.values()].filter(field=>Number(field.querySelector("select").value)>0);
      for (const field of sets.values()) {
        const level=field.querySelector("select"), active=Number(level.value)>0;
        // Keep existing ranks editable when three candidate slots are occupied.
        for (const option of [...level.options].slice(1)) option.disabled=!active && equipped.length===3;
        const boxes=[...field.querySelectorAll("input")];
        const selected=boxes.filter(box=>box.checked);
        for (const box of boxes) box.disabled=!active || (!box.checked && selected.length>=2);
      }
    }
    refresh();
    form.addEventListener("change",event=>{
      refresh();
      if (event.target===fields.tilt) actions.tilt(Number(fields.tilt.value));
      if (event.target===fields.diagnostics) actions.diagnostics(fields.diagnostics.checked);
    });
    form.addEventListener("submit",event=>{
      event.preventDefault();
      const loadout=[];
      for (const [id,field] of sets) {
        const rank=Number(field.querySelector("select").value);
        if (rank) loadout.push({id,rank,mutations:[...field.querySelectorAll("input:checked")].map(box=>box.value)});
      }
      if (!loadout.length || loadout.length>3 || loadout.some(row=>row.mutations.length>2)) {
        message.textContent="請選一至三招，每招最多兩張變異。";
        return;
      }
      actions.start({loadout,scene:fields.scene.value,seed:Number(fields.seed.value),
        tilt:Number(fields.tilt.value),stationary:fields.stationary.checked,diagnostics:fields.diagnostics.checked});
      message.textContent="";
      panel.open=false;
    });
    for (const button of form.querySelectorAll("[data-action]")) button.addEventListener("click",()=>{
      actions[button.dataset.action]();
      panel.open=false;
    });
    for (const name of ["keydown","keyup"]) panel.addEventListener(name,event=>event.stopPropagation());
    document.body.append(panel);
    window.ACTIVE_SKILL_LAB=Object.freeze({snapshot:actions.snapshot});
  }
};
