"use strict";

// 本機 ?dev=1 選關。未接到 index.html / store.js / game.js 之前，頁面不會出現。
const OFFICIAL_KEY = "yokai-delivery-v1";
const DEV_KEY = "yokai-delivery-dev-v1";
const NOTE = "開發測試，不寫入正式進度";

function hostnameOf(loc) {
  return String(loc && loc.hostname || "").trim().toLowerCase().replace(/^\[|\]$/g, "");
}

function isLoopback(loc) {
  const host = hostnameOf(loc);
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function searchParams(loc) {
  const raw = String(loc && loc.search || "");
  return new URLSearchParams(raw.charAt(0) === "?" ? raw.slice(1) : raw);
}

function isDevMode(loc) {
  return isLoopback(loc) && searchParams(loc).get("dev") === "1";
}

function sessionKey(loc) {
  return isDevMode(loc) ? DEV_KEY : OFFICIAL_KEY;
}

function stageNodes(nodes) {
  return (nodes || []).filter(node => node && (node.stageId || node.type === "stage"));
}

function acceptStage(id, nodes, getStage) {
  if (typeof id !== "string" || !id) return null;
  const known = stageNodes(nodes).some(node => (node.stageId || node.id) === id);
  if (!known) return null;
  if (typeof getStage === "function") {
    const stage = getStage(id);
    if (!stage || stage.id !== id || stage.implemented === false) return null;
  }
  return id;
}

function requestedStage(loc, nodes, getStage) {
  if (!isDevMode(loc)) return null;
  const id = searchParams(loc).get("stage");
  if (!id) return null;
  return acceptStage(id, nodes, getStage);
}

function canStart(id, opts) {
  const o = opts || {};
  const accepted = acceptStage(id, o.nodes, o.getStage);
  if (!accepted) return false;
  if (o.dev) return true;
  return o.unlocked === true;
}

function freshProgress() {
  return {
    m: {},
    best: 0,
    bestDel: 0,
    progress: { unlocked: { "night-town": true }, completed: {}, stages: {} }
  };
}

function readProgress(storage, loc) {
  try {
    const raw = JSON.parse(storage.getItem(sessionKey(loc)) || "null");
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return freshProgress();
    return raw;
  } catch {
    return freshProgress();
  }
}

function writeProgress(storage, loc, data) {
  const key = sessionKey(loc);
  if (isDevMode(loc) && key !== DEV_KEY) throw new Error("dev mode refused the official save");
  storage.setItem(key, JSON.stringify(data));
  return key;
}

function remember(storage, loc, jp) {
  const data = readProgress(storage, loc);
  data.m = data.m || {};
  const row = data.m[jp] && typeof data.m[jp] === "object" ? data.m[jp] : { ok: 0 };
  row.ok = (row.ok | 0) + 1;
  data.m[jp] = row;
  writeProgress(storage, loc, data);
  return data;
}

function finish(storage, loc, stageId) {
  const data = readProgress(storage, loc);
  const p = data.progress && typeof data.progress === "object" ? data.progress : {};
  for (const k of ["unlocked", "completed", "stages"]) if (!p[k] || typeof p[k] !== "object") p[k] = {};
  data.progress = p;
  data.progress.completed[stageId] = true;
  data.progress.unlocked[stageId] = true;
  writeProgress(storage, loc, data);
  return data;
}

function mountDevPanel(doc, opts) {
  const o = opts || {};
  if (!o.dev || !doc || typeof doc.createElement !== "function") return null;
  const nodes = stageNodes(o.nodes);
  const host = doc.createElement("div");
  host.id = "dev-stage-picker";
  host.setAttribute("data-dev-note", NOTE);
  if (host.style) host.style.cssText = "position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:20;max-width:240px;font:14px/1.3 sans-serif;color:#24180f;pointer-events:auto;";
  const toggle = doc.createElement("button");
  toggle.type = "button";
  toggle.textContent = "開發選關";
  const panel = doc.createElement("div");
  panel.hidden = true;
  const note = doc.createElement("p");
  note.textContent = NOTE;
  const select = doc.createElement("select");
  select.setAttribute("aria-label", "開發者選關");
  nodes.forEach((node, index) => {
    const id = node.stageId || node.id;
    const option = doc.createElement("option");
    option.value = id;
    option.textContent = `第${index + 1}關 ${node.label || id}`;
    if (id === o.preselect) option.selected = true;
    select.appendChild(option);
  });
  let urlRejected = !!(o.preselect && !acceptStage(o.preselect, nodes, o.getStage));
  if (urlRejected) {
    const warn = doc.createElement("p");
    warn.textContent = "這個關卡代號不能進";
    panel.appendChild(warn);
  } else if (acceptStage(o.preselect, nodes, o.getStage)) {
    select.value = o.preselect;
  }
  const go = doc.createElement("button");
  go.type = "button";
  go.textContent = "直接進關";
  select.addEventListener("change", () => { urlRejected = false; });
  go.addEventListener("click", () => {
    if (urlRejected) return;
    const id = acceptStage(select.value, nodes, o.getStage);
    if (id && typeof o.onEnter === "function") o.onEnter(id);
  });
  toggle.addEventListener("click", () => { panel.hidden = !panel.hidden; });
  panel.appendChild(note);
  panel.appendChild(select);
  panel.appendChild(go);
  host.appendChild(toggle);
  host.appendChild(panel);
  (doc.body || doc.documentElement).appendChild(host);
  return host;
}

const api = {
  OFFICIAL_KEY,
  DEV_KEY,
  NOTE,
  isLoopback,
  isDevMode,
  sessionKey,
  acceptStage,
  requestedStage,
  canStart,
  freshProgress,
  readProgress,
  writeProgress,
  remember,
  finish,
  mountDevPanel
};

if (typeof module === "object" && module.exports) module.exports = api;
if (typeof globalThis !== "undefined") globalThis.DEV_MODE = api;
