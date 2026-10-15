"use strict";

// 妖櫻山道下一階段的地面分區。尚未接到 renderer。正式畫面仍是 tx<3 土、tx=3 水平過渡、tx>=4 石階。
const TILE = 512;
const SEED = 587;
const CELL = 6;
const LIVE_RULE = "tx<3 dirt, tx=3 transH, tx>=4 steps";
const SHRINES = Object.freeze([
  { id: "east-gate", tx: 6, ty: 2 },
  { id: "west-gate", tx: -14, ty: -6 },
  { id: "upper-shrine", tx: 28, ty: 18 },
  { id: "south-gate", tx: 10, ty: -20 }
]);

const REQUIRED_ART = Object.freeze([
  { id: "h-dirt-west", kind: "edge", axis: "H", west: "dirt", east: "steps", north: "steps", south: "steps", have: "ground_trans_dirt_to_steps_h" },
  { id: "h-dirt-east", kind: "edge", axis: "H", west: "steps", east: "dirt", north: "steps", south: "steps", have: null },
  { id: "v-dirt-north", kind: "edge", axis: "V", west: "steps", east: "steps", north: "dirt", south: "steps", have: null },
  { id: "v-dirt-south", kind: "edge", axis: "V", west: "steps", east: "steps", north: "steps", south: "dirt", have: null },
  { id: "corner-steps-nw", kind: "convex", west: "dirt", east: "steps", north: "dirt", south: "steps", have: null },
  { id: "corner-steps-ne", kind: "convex", west: "steps", east: "dirt", north: "dirt", south: "steps", have: null },
  { id: "corner-steps-sw", kind: "convex", west: "dirt", east: "steps", north: "steps", south: "dirt", have: null },
  { id: "corner-steps-se", kind: "convex", west: "steps", east: "dirt", north: "steps", south: "dirt", have: null },
  { id: "corner-dirt-nw", kind: "concave", west: "steps", east: "dirt", north: "steps", south: "dirt", have: null },
  { id: "corner-dirt-ne", kind: "concave", west: "dirt", east: "steps", north: "steps", south: "dirt", have: null },
  { id: "corner-dirt-sw", kind: "concave", west: "steps", east: "dirt", north: "dirt", south: "steps", have: null },
  { id: "corner-dirt-se", kind: "concave", west: "dirt", east: "steps", north: "dirt", south: "steps", have: null }
]);

const CURRENT_CATALOG = Object.freeze({
  fills: {
    dirt: Object.freeze(["ground_mountain_dirt"]),
    steps: Object.freeze(["ground_sakura_steps"])
  },
  masks: Object.freeze({
    "h-dirt-west": "ground_trans_dirt_to_steps_h"
  })
});

function mix(x, y, salt) {
  let n = Math.imul(x | 0, 0x9e3779b1) ^ Math.imul(y | 0, 0x85ebca6b) ^ Math.imul((salt | 0) + SEED, 0xc2b2ae35);
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return (n ^ (n >>> 16)) >>> 0;
}

function nearShrine(cx, cy) {
  const tx = cx * CELL + 3;
  const ty = cy * CELL + 3;
  for (const shrine of SHRINES) {
    if (Math.max(Math.abs(tx - shrine.tx), Math.abs(ty - shrine.ty)) <= 12) return true;
  }
  return false;
}

function baseMaterial(tx, ty) {
  const cx = Math.floor(tx / CELL);
  const cy = Math.floor(ty / CELL);
  const parent = mix(Math.floor(cx / 2), Math.floor(cy / 2), 1) / 4294967296;
  const local = mix(cx, cy, 2) / 4294967296;
  const stepsCut = nearShrine(cx, cy) ? 0.78 : (parent < 0.58 ? 0.28 : 0.55);
  return local < stepsCut ? "steps" : "dirt";
}

function worldTile(x, y) {
  return { tx: Math.floor(x / TILE), ty: Math.floor(y / TILE) };
}

function sides(tx, ty) {
  return {
    own: baseMaterial(tx, ty),
    n: baseMaterial(tx, ty - 1),
    e: baseMaterial(tx + 1, ty),
    s: baseMaterial(tx, ty + 1),
    w: baseMaterial(tx - 1, ty)
  };
}

function cornerId(prefix, touch) {
  if (touch.n && touch.w) return prefix + "-nw";
  if (touch.n && touch.e) return prefix + "-ne";
  if (touch.s && touch.w) return prefix + "-sw";
  if (touch.s && touch.e) return prefix + "-se";
  return null;
}

function maskFor(tx, ty) {
  const s = sides(tx, ty);
  if (s.own === "steps") {
    const touch = { n: s.n === "dirt", e: s.e === "dirt", s: s.s === "dirt", w: s.w === "dirt" };
    const count = touch.n + touch.e + touch.s + touch.w;
    if (count === 0) return { kind: "fill", material: "steps", mask: null };
    if (count === 1 && touch.w) return { kind: "edge", material: "transition", mask: "h-dirt-west" };
    if (count === 1 && touch.e) return { kind: "edge", material: "transition", mask: "h-dirt-east" };
    if (count === 1 && touch.n) return { kind: "edge", material: "transition", mask: "v-dirt-north" };
    if (count === 1 && touch.s) return { kind: "edge", material: "transition", mask: "v-dirt-south" };
    const corner = count === 2 ? cornerId("corner-steps", touch) : null;
    if (corner) return { kind: "convex", material: "transition", mask: corner };
    return { kind: "unsupported", material: "transition", mask: null };
  }
  const touch = { n: s.n === "steps", e: s.e === "steps", s: s.s === "steps", w: s.w === "steps" };
  const corner = cornerId("corner-dirt", touch);
  const count = touch.n + touch.e + touch.s + touch.w;
  if (corner && count === 2) return { kind: "concave", material: "transition", mask: corner };
  return { kind: "fill", material: "dirt", mask: null };
}

function assetFor(mask, tx, ty, catalog) {
  const book = catalog || CURRENT_CATALOG;
  if (!mask.mask) {
    const family = book.fills && book.fills[mask.material];
    if (!family || !family.length) return { assetId: null, status: "MISSING_REQUIRED_ART" };
    return { assetId: family[mix(tx, ty, 9) % family.length], status: "PASS" };
  }
  const file = book.masks && book.masks[mask.mask];
  if (!file) return { assetId: null, status: "MISSING_REQUIRED_ART" };
  return { assetId: file, status: "PASS" };
}

function planTile(tx, ty, catalog) {
  const decided = maskFor(tx, ty);
  const art = assetFor(decided, tx, ty, catalog);
  const spec = REQUIRED_ART.find(item => item.id === decided.mask) || null;
  return {
    tx, ty,
    base: baseMaterial(tx, ty),
    kind: decided.kind,
    material: decided.material,
    mask: decided.mask,
    orientation: spec,
    assetId: art.assetId,
    status: decided.kind === "unsupported" ? "UNSUPPORTED_NEIGHBORHOOD" : art.status
  };
}

const api = {
  TILE, SEED, CELL, LIVE_RULE, SHRINES, REQUIRED_ART, CURRENT_CATALOG,
  worldTile, baseMaterial, planTile
};

if (typeof module === "object" && module.exports) module.exports = api;
