"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const dev = require("../js/dev-mode.js");

const overworld = fs.readFileSync(path.join(__dirname, "../js/overworld.js"), "utf8");
const nodes = [...overworld.matchAll(/type:"stage",stageId:"([^"]+)",label:"([^"]+)"/g)]
  .map(match => ({ type: "stage", stageId: match[1], id: match[1], label: match[2], implemented: true }));

function mem() {
  const box = new Map();
  return {
    getItem: key => box.has(key) ? box.get(key) : null,
    setItem: (key, value) => box.set(key, String(value)),
    keys: () => [...box.keys()]
  };
}

function stageOf(id) {
  return nodes.find(node => node.stageId === id) || { id: "night-town", implemented: true };
}

test("dev mode is only loopback plus dev=1", () => {
  for (const hostname of ["127.0.0.1", "localhost", "::1", "[::1]"]) {
    assert.equal(dev.isDevMode({ hostname, search: "?dev=1" }), true, hostname);
    assert.equal(dev.isDevMode({ hostname, search: "?stage=sakura-pass&dev=1" }), true, hostname);
  }
  for (const hostname of ["yokai.github.io", "example.com", "192.168.0.8", "10.0.0.2", ""]) {
    assert.equal(dev.isDevMode({ hostname, search: "?dev=1" }), false, hostname);
  }
  assert.equal(dev.isDevMode({ hostname: "127.0.0.1", search: "" }), false);
  assert.equal(dev.isDevMode({ hostname: "127.0.0.1", search: "?dev=true" }), false);
  assert.equal(dev.isDevMode({ hostname: "127.0.0.1", search: "?dev=1 " }), false);
  assert.equal(dev.sessionKey({ hostname: "127.0.0.1", search: "?dev=1" }), dev.DEV_KEY);
  assert.equal(dev.sessionKey({ hostname: "127.0.0.1", search: "" }), dev.OFFICIAL_KEY);
});

test("eight legal stages can be chosen and an unknown id is not night-town", () => {
  assert.equal(nodes.length, 8);
  for (const node of nodes) {
    assert.equal(dev.acceptStage(node.stageId, nodes, stageOf), node.stageId);
  }
  assert.equal(dev.acceptStage("not-a-stage", nodes, stageOf), null);
  assert.equal(dev.acceptStage("night-town-extra", nodes, stageOf), null);
  const loc = { hostname: "127.0.0.1", search: "?dev=1&stage=not-a-stage" };
  assert.equal(dev.requestedStage(loc, nodes, stageOf), null);
  assert.equal(dev.requestedStage({ hostname: "127.0.0.1", search: "?dev=1&stage=sakura-pass" }, nodes, stageOf), "sakura-pass");
  assert.equal(dev.requestedStage({ hostname: "127.0.0.1", search: "?dev=1&stage=yomi" }, nodes, stageOf), "yomi");
  assert.equal(dev.requestedStage({ hostname: "example.com", search: "?dev=1&stage=yomi" }, nodes, stageOf), null);
});

test("dev sandbox records and finishes do not touch the official save", () => {
  const storage = mem();
  const official = { best: 40, m: { "ねこ": { ok: 2, box: 1 } }, progress: { unlocked: { "night-town": true }, completed: {} } };
  storage.setItem(dev.OFFICIAL_KEY, JSON.stringify(official));
  const loc = { hostname: "localhost", search: "?dev=1" };
  dev.remember(storage, loc, "いぬ");
  dev.finish(storage, loc, "yomi");
  assert.deepEqual(JSON.parse(storage.getItem(dev.OFFICIAL_KEY)), official);
  const again = dev.readProgress(storage, loc);
  assert.equal(again.m["いぬ"].ok, 1);
  assert.equal(again.progress.completed.yomi, true);
  assert.equal(dev.readProgress(storage, { hostname: "localhost", search: "" }).best, 40);
  assert.equal(dev.readProgress(storage, { hostname: "localhost", search: "" }).m["いぬ"], undefined);
});

test("normal entry still rejects a locked stage; dev can open 3, 5 and 8", () => {
  const locked = { dev: false, unlocked: false, nodes, getStage: stageOf };
  assert.equal(dev.canStart("sakura-pass", locked), false);
  assert.equal(dev.canStart("night-town", { ...locked, unlocked: true }), true);
  assert.equal(dev.canStart("nope", { dev: true, nodes, getStage: stageOf }), false);
  for (const id of ["sakura-pass", "hyakki-kyoto", "yomi"]) {
    assert.equal(dev.canStart(id, { dev: true, unlocked: false, nodes, getStage: stageOf }), true, id);
  }
  assert.equal(nodes[2].stageId, "sakura-pass");
  assert.equal(nodes[4].stageId, "hyakki-kyoto");
  assert.equal(nodes[7].stageId, "yomi");
});

test("real STORE keeps the official key when dev mode is on", () => {
  const vm = require("node:vm");
  const official = JSON.stringify({ best: 9, m: { "ねこ": { ok: 2 } }, progress: { unlocked: { "night-town": true }, completed: {}, stages: {} } });
  function boot(search) {
    const box = new Map([[dev.OFFICIAL_KEY, official]]);
    const env = {
      console,
      URLSearchParams,
      location: { hostname: "127.0.0.1", search },
      localStorage: {
        getItem: key => box.has(key) ? box.get(key) : null,
        setItem: (key, value) => box.set(key, String(value))
      }
    };
    env.window = env;
    const context = vm.createContext(env);
    vm.runInContext(fs.readFileSync(path.join(__dirname, "../js/dev-mode.js"), "utf8"), context);
    vm.runInContext(fs.readFileSync(path.join(__dirname, "../js/store.js"), "utf8"), context);
    return { env, box };
  }
  const live = boot("?dev=1");
  live.env.STORE.finish("yomi", 10, 1, true);
  live.env.STORE.rec("いぬ", true);
  assert.equal(live.box.get(dev.OFFICIAL_KEY), official);
  const sandbox = JSON.parse(live.box.get(dev.DEV_KEY));
  assert.equal(sandbox.progress.completed.yomi, true);
  assert.equal(sandbox.m["いぬ"].ok, 1);
  const normal = boot("");
  normal.env.STORE.finish("night-town", 3, 1, true);
  assert.equal(normal.box.has(dev.DEV_KEY), false);
  assert.equal(JSON.parse(normal.box.get(dev.OFFICIAL_KEY)).progress.completed["night-town"], true);
});

test("index.html loads the dev gate before the store with a fresh query", () => {
  const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  const script = file => {
    const match = html.match(new RegExp(`src="js/${file}\\.js\\?v=([^"\\s]+)"`));
    assert.ok(match, `${file} needs a cache query`);
    assert.ok(match[1].length > 0, `${file} version is empty`);
    return { at: match.index, version: match[1] };
  };
  const devScript = script("dev-mode");
  const storeScript = script("store");
  const gameScript = script("game");
  assert.ok(devScript.at < storeScript.at && storeScript.at < gameScript.at);
  assert.match(gameScript.version, /^20261014-p42/);
});

test("an unknown stage query does not enter on the first click", () => {
  const elements = [];
  function el(tag) {
    const node = { tag, children: [], hidden: false, value: "", textContent: "", type: "", listeners: {} };
    node.appendChild = child => node.children.push(child);
    node.setAttribute = (name, value) => { node[name] = value; };
    node.addEventListener = (type, fn) => { node.listeners[type] = fn; };
    elements.push(node);
    return node;
  }
  const doc = { body: el("body"), createElement: el };
  const entered = [];
  dev.mountDevPanel(doc, {
    dev: true, nodes, preselect: "not-a-stage", getStage: stageOf, onEnter: id => entered.push(id)
  });
  elements.find(node => node.textContent === "直接進關").listeners.click();
  assert.deepEqual(entered, []);
  assert.ok(elements.some(node => node.textContent === "這個關卡代號不能進"));
});

test("the panel preselects a stage and enters only after a click", () => {
  const elements = [];
  function el(tag) {
    const node = { tag, children: [], hidden: false, value: "", textContent: "", type: "", listeners: {} };
    node.appendChild = child => node.children.push(child);
    node.setAttribute = (name, value) => { node[name] = value; };
    node.addEventListener = (type, fn) => { node.listeners[type] = fn; };
    elements.push(node);
    return node;
  }
  const doc = { body: el("body"), createElement: el };
  const entered = [];
  const host = dev.mountDevPanel(doc, {
    dev: true,
    nodes,
    preselect: "sakura-pass",
    getStage: stageOf,
    onEnter: id => entered.push(id)
  });
  assert.equal(entered.length, 0);
  assert.equal(host["data-dev-note"], dev.NOTE);
  const select = elements.find(node => node.tag === "select");
  const chosen = select.children.find(option => option.selected);
  assert.equal(chosen.value, "sakura-pass");
  assert.equal(select.children.length, 8);
  const go = elements.find(node => node.textContent === "直接進關");
  select.value = "yomi";
  go.listeners.click();
  assert.deepEqual(entered, ["yomi"]);
  assert.equal(dev.mountDevPanel(doc, { dev: false, nodes }), null);
});
