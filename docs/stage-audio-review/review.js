"use strict";

const status = document.querySelector("#status");
const catalog = window.STAGE58_AUDIO;
const expansion = window.GAME_SKILL_EXPANSION;
if (!["localhost", "127.0.0.1", "[::1]"].includes(location.hostname) || !catalog) {
  status.textContent = "請透過本機預覽服務開啟音訊試聽頁。";
} else {
  startReview().catch(() => { status.textContent = "讀取音檔清單失敗。請重新整理。"; });
}

const SHARED_BOSS_PATH = "assets/audio/bgm/boss/boss__encounter.mp3";
const EARLY_STAGE_BGM = [
  { id: "night-town-battle", stage: "night-town", group: "配樂", name: "第一關・夜行町一般 BGM（初次上陣）", when: "進關與一般戰鬥循環", kind: "music", loop: true, priority: "P0", path: "assets/audio/bgm/stages/night-town/night-town__parade.mp3", fallbackPath: "assets/audio/bgm/stages/night-town/night-town__battle.mp3", note: "維持現行初次上陣緊張曲；備援為 night-town__battle.mp3" },
  { id: "night-town-battle-fallback", stage: "night-town", group: "配樂", name: "第一關・一般 BGM 備援軌", when: "主軌失敗時之既有備援", kind: "music", loop: true, priority: "P1", path: "assets/audio/bgm/stages/night-town/night-town__battle.mp3", note: "既有備援檔" },
  { id: "night-town-boss", stage: "night-town", group: "配樂", name: "第一關・夜行町獨立 Boss BGM（DEV 試聽候選）", when: "第一關尾王破封後播放", kind: "music", loop: true, priority: "P0", path: "assets/audio/bgm/stages/night-town/night-town__boss.mp3", fallbackPath: SHARED_BOSS_PATH, note: "未提供獨立檔時自動使用共用 boss__encounter.mp3" },
  { id: "rain-port-battle", stage: "rain-port", group: "配樂", name: "第二關・雨夜港町一般 BGM", when: "進關與一般戰鬥循環", kind: "music", loop: true, priority: "P0", path: "assets/audio/bgm/stages/rain-port/rain-port__battle.mp3" },
  { id: "rain-port-boss", stage: "rain-port", group: "配樂", name: "第二關・雨夜港町獨立 Boss BGM（DEV 試聽候選）", when: "第二關尾王破封後播放", kind: "music", loop: true, priority: "P0", path: "assets/audio/bgm/stages/rain-port/rain-port__boss.mp3", fallbackPath: SHARED_BOSS_PATH, note: "未提供獨立檔時自動使用共用 boss__encounter.mp3" },
  { id: "sakura-pass-battle", stage: "sakura-pass", group: "配樂", name: "第三關・妖櫻山道一般 BGM", when: "進關與一般戰鬥循環", kind: "music", loop: true, priority: "P0", path: "assets/audio/bgm/stages/sakura-pass/sakura-pass__battle.mp3" },
  { id: "sakura-pass-boss", stage: "sakura-pass", group: "配樂", name: "第三關・妖櫻山道獨立 Boss BGM（DEV 試聽候選）", when: "第三關尾王破封後播放", kind: "music", loop: true, priority: "P0", path: "assets/audio/bgm/stages/sakura-pass/sakura-pass__boss.mp3", fallbackPath: SHARED_BOSS_PATH, note: "未提供獨立檔時自動使用共用 boss__encounter.mp3" },
  { id: "bamboo-maze-battle", stage: "bamboo-maze", group: "配樂", name: "第四關・竹影迷宮一般 BGM", when: "進關與一般戰鬥循環", kind: "music", loop: true, priority: "P0", path: "assets/audio/bgm/stages/bamboo-maze/bamboo-maze__battle.mp3" },
  { id: "bamboo-maze-boss", stage: "bamboo-maze", group: "配樂", name: "第四關・竹影迷宮獨立 Boss BGM（DEV 試聽候選）", when: "第四關尾王破封後播放", kind: "music", loop: true, priority: "P0", path: "assets/audio/bgm/stages/bamboo-maze/bamboo-maze__boss.mp3", fallbackPath: SHARED_BOSS_PATH, note: "未提供獨立檔時自動使用共用 boss__encounter.mp3" },
  { id: "shared-boss-encounter", stage: "all-bgm", group: "配樂", name: "前四關共用最終 Boss BGM（現行備援）", when: "前四關獨立 Boss 曲未放檔時自動接手", kind: "music", loop: true, priority: "P0", path: SHARED_BOSS_PATH }
];

const SHARED_EVENT_NOTES = {
  "hyakki-kyoto-arrival.kyoto-taiko-warden": "共用標記：第五關第三王 kyoto-crossroads-boss（十字街鬼將）目前共用此登場音。",
  "hyakki-kyoto-kyoto-taiko-warden-crossing.warning": "共用標記：第五關第三王 kyoto-crossroads-boss 十字封街共用此預警音。",
  "hyakki-kyoto-kyoto-taiko-warden-crossing.impact": "共用標記：第五關第三王 kyoto-crossroads-boss 十字封街共用此爆發音。",
  "snow-temple-arrival.snow-frost-bell-guardian": "共用標記：第六關第三王 snow-ice-pillar-boss（冰柱法僧）目前共用此登場音。",
  "snow-temple-frost-bell.warning": "共用標記：第六關第三王 snow-ice-pillar-boss 三連冰柱共用此預警音。",
  "snow-temple-frost-bell.impact": "共用標記：第六關第三王 snow-ice-pillar-boss 三連冰柱共用此爆發音。",
  "yomi-cinder-burst.warning": "玄巖墓蛇圓爆預警；冥門骸武者重斬獨立音缺檔時使用此備援。",
  "yomi-cinder-burst.impact": "玄巖墓蛇圓爆爆發；冥門骸武者重斬獨立音缺檔時使用此備援。"
};

const SKILL_GROUPS = {
  hamaya: "破魔・神弓（4 支）",
  spider_silk: "絡新婦・妖絲（3 支）",
  ice_ball: "冰魄・妖毬（3 支）",
  wind_hole: "冥風・風穴（4 支）"
};

async function startReview() {
  const response = await fetch("files.json");
  if (!response.ok) throw new Error("Audio listing unavailable");
  const { metadata } = await response.json();
  const get = id => document.getElementById(id);
  const stage = get("stage"), missing = get("missing"), player = get("audio");
  const entries = get("entries"), loop = get("loop"), volume = get("volume"), stop = get("stop");
  const now = get("now");
  let request = 0;
  const fallbackModel = row => row.kind === "music" ? "ACE-Step 1.5 XL Turbo／Lyria 備用提示詞" : "Stable Audio 3 Medium";
  const hasFile = path => path && Object.hasOwn(metadata, path);

  const views = {
    "all-bgm": "全八關 BGM 總覽（一般／Boss／終章）",
    "skills-10-13": "新四招 10–13 專屬音效（14 支）",
    "night-town": "第一關・夜行町",
    "rain-port": "第二關・雨夜港町",
    "sakura-pass": "第三關・妖櫻山道",
    "bamboo-maze": "第四關・竹影迷宮",
    ...catalog.stages
  };
  for (const [id, name] of Object.entries(views)) stage.add(new Option(name, id));
  const linkStage = new URLSearchParams(location.search).get("stage");
  if (linkStage && Object.hasOwn(views, linkStage)) stage.value = linkStage;
  else stage.value = "hyakki-kyoto";

  const skillRows = Object.values(expansion?.sfxCatalog || {}).map(spec => ({
    id: "skill-" + spec.key,
    stage: "skills-10-13",
    group: SKILL_GROUPS[spec.id] || spec.id,
    name: spec.name,
    when: `${spec.when}（節流 ${spec.throttleMs}ms，優先度 ${spec.priority}）`,
    kind: "effect",
    priority: spec.priority,
    loop: !!spec.loop,
    path: spec.path
  }));

  function add(parent, tag, value, className) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = value;
    parent.append(node);
    return node;
  }

  function halt() {
    request++;
    player.pause();
    player.removeAttribute("src");
    player.load();
    now.textContent = "請選一個音檔";
    stop.disabled = true;
  }

  function renderCard(list, row) {
    const direct = hasFile(row.path);
    const playPath = direct ? row.path : (hasFile(row.fallbackPath) ? row.fallbackPath : null);
    const info = metadata[playPath];
    const card = add(list, "article", "", "panel");
    const head = add(card, "div", "", "cardhead");
    const h3 = add(head, "h3", row.name);
    if (!direct && playPath) add(h3, "span", "使用備援", "badge");
    if (SHARED_EVENT_NOTES[row.id]) add(h3, "span", "共用音檔", "badge");
    if (row.loop) add(h3, "span", "循環", "badge");
    const button = add(head, "button", direct ? "播放" : playPath ? "試聽備援" : "缺檔");
    button.type = "button";
    button.disabled = !playPath;
    button.setAttribute("aria-label", "播放 " + row.name);
    button.addEventListener("click", () => {
      const id = ++request;
      player.pause();
      player.src = "/" + playPath;
      player.loop = loop.checked = !!row.loop;
      now.textContent = row.name + (!direct && playPath ? "（備援）" : "");
      stop.disabled = false;
      player.play().catch(() => {
        if (id === request) status.textContent = "無法播放「" + row.name + "」。";
      });
    });
    add(card, "p", row.when);
    if (row.note) add(card, "small", row.note);
    if (SHARED_EVENT_NOTES[row.id]) add(card, "small", SHARED_EVENT_NOTES[row.id]);
    const stateText = direct
      ? (row.stage === "skills-10-13" ? "已建檔・DEV Skill Lab 接線" : row.path.startsWith("assets/") ? "正式路徑已存在" : "DEV 已接線・候選待審")
      : playPath ? `尚缺獨立檔・退回 ${row.fallbackPath}` : "待補檔";
    const metaParts = [stateText];
    if (info?.duration) metaParts.push(`${info.duration} 秒`);
    else if (row.seconds) metaParts.push(`${row.seconds} 秒（規格）`);
    if (typeof info?.peakDbfs === "number") metaParts.push(`Peak ${info.peakDbfs} dBFS`);
    if (typeof info?.integratedLufs === "number") metaParts.push(`${info.integratedLufs} LUFS`);
    if (info?.license) metaParts.push(info.license);
    else if (info?.model) metaParts.push(info.model);
    else if (!direct && !row.path.startsWith("assets/")) metaParts.push(fallbackModel(row));
    add(card, "small", metaParts.join(" · "));
    add(card, "code", row.path, "asset");
    if (row.prompt || row.lyriaPrompt || info?.sources) {
      const details = add(card, "details", "");
      add(details, "summary", info?.sources ? "來源與處理紀錄" : "事件 ID、提示詞與設定");
      add(details, "code", row.id, "asset");
      if (row.lyriaPrompt || row.prompt) add(details, "p", row.lyriaPrompt || row.prompt);
      if (info?.sources) add(details, "p", "來源 WAV：" + info.sources.join(" + "));
      if (info?.f3GainAdjust) add(details, "small", `F3 增益調整 ${info.f3GainAdjust.gainDb} dB（備份：${info.f3GainAdjust.backupPath}）`);
      else if (row.bpm || row.seed) {
        add(details, "small", [row.priority, info?.seed ? "seed " + info.seed : row.seed ? "預定 seed " + row.seed : "",
          row.bpm && row.bpm + " BPM"].filter(Boolean).join(" · "));
      }
    }
  }

  function draw() {
    entries.replaceChildren();
    const sel = stage.value;
    let sections = [];
    if (sel === "all-bgm") {
      const stage58Music = catalog.entries.filter(row => row.kind === "music");
      sections = [
        ["前四關一般與 Boss BGM（含備援槽）", EARLY_STAGE_BGM],
        ["後四關 BGM 與黃泉終章（10 首）", stage58Music]
      ];
    } else if (sel === "skills-10-13") {
      for (const label of Object.values(SKILL_GROUPS)) {
        sections.push([label, skillRows.filter(row => row.group === label)]);
      }
    } else if (EARLY_STAGE_BGM.some(r => r.stage === sel)) {
      sections = [["一般與獨立 Boss BGM", EARLY_STAGE_BGM.filter(r => r.stage === sel)]];
    } else {
      const rows = catalog.entries.filter(row => row.stage === sel);
      sections = [
        ["配樂", rows.filter(row => row.kind === "music")],
        ["環境音", rows.filter(row => row.kind === "ambience")],
        ["頭目", rows.filter(row => row.kind === "effect" && row.priority === "P0")],
        ["小怪與戰場提示", rows.filter(row => row.kind === "effect" && row.priority !== "P0")]
      ];
    }
    const allRows = sections.flatMap(([, list]) => list);
    const directCount = allRows.filter(row => hasFile(row.path)).length;
    const fallbackCount = allRows.filter(row => !hasFile(row.path) && hasFile(row.fallbackPath)).length;
    status.textContent = `${views[sel]}・${directCount} 個已建檔／${fallbackCount} 個備援中／${allRows.length - directCount - fallbackCount} 個待補`;

    for (const [label, list] of sections) {
      const show = list.filter(row => !missing.checked || !hasFile(row.path));
      if (show.length === 0) continue;
      const section = add(entries, "section", "");
      add(section, "h2", label);
      const grid = add(section, "div", "", "entries");
      for (const row of show) renderCard(grid, row);
    }
  }

  player.volume = Number(volume.value) / 100;
  stage.addEventListener("change", () => { halt(); draw(); });
  missing.addEventListener("change", draw);
  stop.addEventListener("click", halt);
  loop.addEventListener("change", () => { player.loop = loop.checked; });
  volume.addEventListener("input", () => { player.volume = Number(volume.value) / 100; });
  get("download").addEventListener("click", () => {
    const csv = [["狀態", "關卡", "事件", "名稱", "路徑", "長度（秒）", "BPM", "英文提示詞"]];
    for (const row of catalog.entries.filter(item => item.kind === "music" || !hasFile(item.path))) {
      csv.push([hasFile(row.path) ? "候選待審 / 可重生" : "待補", catalog.stages[row.stage], row.id, row.name,
        row.path, row.seconds, row.bpm ?? "", row.lyriaPrompt || row.prompt]);
    }
    const text = "\ufeff" + csv.map(fields => fields.map(field => '"' + String(field).replaceAll('"', '""') + '"').join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "yokai-stage58-audio-prompts.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  addEventListener("pagehide", halt);
  get("review").hidden = false;
  draw();
}
