(() => {
"use strict";

// 尚未被 index 載入。只畫呼叫端給的已投影卡片，不寫存檔、不播音。
const gallery = typeof module === "object" && module.exports
  ? require("./card-gallery-model.js")
  : globalThis.CARD_GALLERY;

const STATUS = "C3_LOADED";
const PAGE_SIZE = 8;
const INK = "#24180f";
const PAGE_INK = "#efe2bf";

function touchSize(scale) {
  const safe = scale > 0 ? scale : 1;
  return Math.ceil(44 / safe);
}

function frameOf(viewport) {
  const view = viewport || {};
  const scale = view.scale > 0 ? view.scale : 1;
  const width = view.width > 0 ? view.width : 900;
  const height = view.height > 0 ? view.height : 600;
  const left = Number.isFinite(view.offsetX) ? -view.offsetX : 0;
  const top = Number.isFinite(view.offsetY) ? -view.offsetY : 0;
  const touch = touchSize(scale);
  const gap = 8;
  const inner = Math.max(1, width - gap * 2);
  let columns = 4;
  while (columns > 1 && Math.floor((inner - gap * (columns - 1)) / columns) < 48) columns = columns === 4 ? 2 : 1;
  const yFilters = top + gap;
  const yPager = yFilters + touch + gap;
  const yBack = top + height - gap - touch;
  const gridTop = yPager + touch + gap;
  const gridBottom = yBack - gap;
  let rows = 2;
  const gridH = gridBottom - gridTop;
  const minCard = 132;
  while (rows > 1 && Math.floor((gridH - gap * (rows - 1)) / rows) < minCard) rows -= 1;
  if (gridH < 36) rows = 1;
  const pageSize = Math.max(1, columns * rows);
  const cardW = Math.max(1, Math.floor((inner - gap * (columns - 1)) / columns));
  const cardH = Math.max(1, Math.floor((Math.max(gridH, 36) - gap * (rows - 1)) / rows));
  const half = Math.max(touch, Math.floor((inner - gap) / 2));
  return {
    scale, left, top, right: left + width, bottom: top + height, width, height, touch, gap,
    columns, rows, pageSize, cardW, cardH, gridTop, yFilters, yPager, yBack, half, inner
  };
}

function visible(cards, filter) {
  const list = cards || [];
  if (!filter || filter.by === "all" || filter.id == null || filter.id === "") return list;
  if (filter.by === "stage") return list.filter(card => Array.isArray(card.stages) && card.stages.includes(filter.id));
  if (filter.by === "pack") return list.filter(card => card.category && card.category.id === filter.id);
  return list;
}

function show(cards, state, viewport) {
  const filter = (state && state.filter) || { by: "all", id: null };
  const selected = visible(cards, filter);
  const size = viewport ? frameOf(viewport).pageSize : PAGE_SIZE;
  const page = gallery.paginate(selected, state && state.page, size);
  return { filter, page: page.page, pageCount: page.pageCount, total: page.total, cards: page.cards };
}

function optionList(kind, catalogs) {
  const rows = kind === "stage" ? (catalogs && catalogs.stages) || [] : (catalogs && catalogs.packs) || [];
  const out = [];
  const seen = new Set();
  for (const row of rows) {
    if (!row || typeof row.id !== "string" || !row.id || seen.has(row.id)) continue;
    const label = typeof row.name === "string" && row.name ? row.name : "";
    if (!label) continue;
    seen.add(row.id);
    out.push({ id: row.id, label });
  }
  return out;
}

function cycleFilter(kind, filter, catalogs) {
  const list = optionList(kind, catalogs);
  if (!list.length) return { by: "all", id: null };
  if (!filter || filter.by !== kind || filter.id == null || filter.id === "") return { by: kind, id: list[0].id };
  const index = list.findIndex(item => item.id === filter.id);
  if (index < 0 || index >= list.length - 1) return { by: "all", id: null };
  return { by: kind, id: list[index + 1].id };
}

function reduce(cards, state, action, viewport, catalogs) {
  const size = viewport ? frameOf(viewport).pageSize : PAGE_SIZE;
  const current = show(cards, state, viewport || null);
  if (action && action.type === "cycle") {
    const kind = action.by === "pack" ? "pack" : "stage";
    return { filter: cycleFilter(kind, current.filter, catalogs), page: 0, close: null };
  }
  if (action && action.type === "filter") {
    return { filter: { by: action.by || "all", id: action.id == null ? null : action.id }, page: 0, close: null };
  }
  if (action && (action.type === "back" || action.type === "close")) {
    return { filter: current.filter, page: current.page, close: "pause" };
  }
  const delta = action && action.type === "page" ? (action.delta || 0) : 0;
  const paged = gallery.paginate(visible(cards, current.filter), current.page + delta, size);
  return { filter: current.filter, page: paged.page, close: null };
}

function button(id, x, y, w, h, extra) {
  return Object.assign({ id, x, y, w, h, disabled: false }, extra);
}

function filterLabel(kind, filter, catalogs) {
  const prefix = kind === "stage" ? "關卡：" : "詞包：";
  const chosen = filter && filter.by === kind && filter.id != null && filter.id !== "";
  if (!chosen) return prefix + "全部";
  const hit = optionList(kind, catalogs).find(item => item.id === filter.id);
  return prefix + (hit ? hit.label : "未命名");
}

function splitText2(text) {
  if (!text || text.length <= 1) return [text || "", ""];
  const spaceIdx = text.indexOf(" ");
  let splitIdx;
  if (spaceIdx > 0 && spaceIdx < text.length - 1) {
    const afterSpace = text.slice(spaceIdx + 1);
    if (afterSpace.length <= 4) {
      splitIdx = spaceIdx;
    } else {
      splitIdx = Math.ceil(text.length / 2);
    }
  } else {
    splitIdx = Math.ceil(text.length / 2);
  }
  const noLineStart = /[ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮー、。！？]/;
  if (splitIdx < text.length && noLineStart.test(text[splitIdx])) {
    splitIdx++;
  }
  return [text.slice(0, splitIdx).trimEnd(), text.slice(splitIdx).trimStart()];
}

function ink(ctx, hooks, size, text, x, y, maxWidth, color, opts) {
  ctx.fillStyle = color || INK;
  const fontFn = (s) => hooks && hooks.readableFont ? hooks.readableFont(s, "900") : `${s}px sans-serif`;
  ctx.font = fontFn(size);
  const maxW = Math.max(1, maxWidth || 0);
  const measured = ctx.measureText ? ctx.measureText(text).width : text.length * size * 0.9;
  if (!maxW || measured <= maxW) {
    ctx.fillText(text, x, y, maxW);
    return;
  }
  // 等比縮小字級，避免 Canvas fillText 水平擠壓失真
  const scaled = Math.floor(size * (maxW / measured) * 10) / 10;
  const minFloor = (opts && opts.minSize) || 10;
  if (scaled >= minFloor) {
    ctx.font = fontFn(scaled);
    ctx.fillText(text, x, y, maxW);
  } else {
    // 低於可讀下限時，於原卡槽內拆為安全兩行，不生新 UI
    const [l1, l2] = splitText2(text);
    if (!l2) {
      ctx.font = fontFn(minFloor);
      ctx.fillText(text, x, y, maxW);
      return;
    }
    let subSize = Math.max(minFloor - 1, Math.min(size - 2, Math.floor(size * 0.8)));
    ctx.font = fontFn(subSize);
    const m1 = ctx.measureText ? ctx.measureText(l1).width : l1.length * subSize;
    const m2 = ctx.measureText ? ctx.measureText(l2).width : l2.length * subSize;
    const maxSub = Math.max(m1, m2);
    if (maxSub > maxW) {
      subSize = Math.max(8, Math.floor(subSize * (maxW / maxSub) * 10) / 10);
      ctx.font = fontFn(subSize);
    }
    const lh = Math.max(8, Math.floor(size * 0.75));
    ctx.fillText(l1, x, y - lh * 0.45, maxW);
    ctx.fillText(l2, x, y + lh * 0.55, maxW);
  }
}

function pageStatusY(box, index) {
  const gap = 22 / box.scale;
  return box.yPager + Math.max(0, (box.touch - gap) / 2) + gap * index;
}

function writeCard(ctx, hooks, lines, x, y, w, h) {
  const left = Math.min(62 * h / 85, w * 0.27);
  const right = Math.min(58 * h / 85, w * 0.27);
  const top = y + h * (12 / 85);
  const bottom = y + h * (61 / 85);
  const band = Math.max(1, bottom - top);
  const step = band / lines.length;
  const size = Math.max(12, Math.min(18, Math.floor(step * 0.72)));
  const textW = Math.max(1, w - left - right - 8);
  lines.forEach((text, index) => {
    ink(ctx, hooks, size, text, x + left + (w - left - right) / 2, top + step * (index + 0.78), textW);
  });
}

function draw(ctx, cards, state, hooks, viewport, catalogs) {
  const box = frameOf(viewport);
  const view = show(cards, state, viewport);
  const paper = hooks && hooks.paper;
  const hasPaper = !!(paper && paper.naturalWidth);
  const x0 = box.left + box.gap;
  const stageLabel = filterLabel("stage", view.filter, catalogs);
  const packLabel = filterLabel("pack", view.filter, catalogs);
  const buttons = [
    button("filter-stage", x0, box.yFilters, box.half, box.touch, { label: stageLabel }),
    button("filter-pack", x0 + box.half + box.gap, box.yFilters, box.half, box.touch, { label: packLabel }),
    button("prev", x0, box.yPager, Math.min(box.half, 140), box.touch, { disabled: view.page <= 0 }),
    button("next", x0 + Math.min(box.half, 140) + box.gap, box.yPager, Math.min(box.half, 140), box.touch, { disabled: view.page >= view.pageCount - 1 }),
    button("back", x0, box.yBack, box.half, box.touch),
    button("replay", x0 + box.half + box.gap, box.yBack, box.half, box.touch, { disabled: true, reason: "audio-frozen" })
  ];
  if (hooks && hooks.drawWoodTag) {
    hooks.drawWoodTag(ctx, buttons[0]);
    hooks.drawWoodTag(ctx, buttons[1]);
  }
  if (hooks && hooks.drawButton) {
    hooks.drawButton(ctx, buttons[2], "上一頁", { disabled: buttons[2].disabled });
    hooks.drawButton(ctx, buttons[3], "下一頁", { disabled: buttons[3].disabled });
    hooks.drawButton(ctx, buttons[4], "返回", { disabled: false });
    hooks.drawButton(ctx, buttons[5], "再聽", { disabled: true });
  }
  ctx.save();
  ctx.textAlign = "center";
  ink(ctx, hooks, 15, stageLabel, buttons[0].x + buttons[0].w / 2, buttons[0].y + buttons[0].h * 0.65, buttons[0].w - 12);
  ink(ctx, hooks, 15, packLabel, buttons[1].x + buttons[1].w / 2, buttons[1].y + buttons[1].h * 0.65, buttons[1].w - 12);
  if (state && state.packLine) {
    ink(ctx, hooks, 13, state.packLine, x0 + box.inner * 0.72, pageStatusY(box, 0), Math.max(1, box.inner * 0.34), PAGE_INK);
  }
  if (view.cards.some(card => card.reveal === "open" && card.illustration && card.illustration.text)) {
    ink(ctx, hooks, 13, "待解鎖插畫", x0 + box.inner * 0.72, pageStatusY(box, 1), Math.max(1, box.inner * 0.34), PAGE_INK);
  }
  view.cards.forEach((card, index) => {
    const col = index % box.columns;
    const row = Math.floor(index / box.columns);
    const x = x0 + col * (box.cardW + box.gap);
    const y = box.gridTop + row * (box.cardH + box.gap);
    const plate = button("card:" + card.key, x, y, box.cardW, box.cardH, { disabled: card.reveal !== "open" });
    if (plate.y + plate.h > box.yBack - 4) return;
    buttons.push(plate);
    if (hasPaper && hooks.drawRibbonSlices) hooks.drawRibbonSlices(ctx, paper, x, y, box.cardW, box.cardH);
    const lines = card.reveal !== "open"
      ? ["鎖", card.progress]
      : [card.jp || "", card.zh || "", card.kana || "", "4/4"];
    writeCard(ctx, hooks, lines, x, y, box.cardW, box.cardH);
  });
  ctx.restore();
  return { status: STATUS, buttons, cards: view.cards, view: { page: view.page, pageCount: view.pageCount, total: view.total } };
}

function hit(point, buttons) {
  const found = (buttons || []).find(box => point.x >= box.x && point.x <= box.x + box.w && point.y >= box.y && point.y <= box.y + box.h);
  if (!found) return null;
  if (found.disabled) return { id: found.id, ok: false, reason: found.reason || "disabled" };
  return { id: found.id, ok: true };
}

const api = { STATUS, PAGE_SIZE, visible, reduce, draw, hit, ink, splitText2 };
if (typeof module === "object" && module.exports) module.exports = api;
if (typeof globalThis !== "undefined") globalThis.CARD_GALLERY_UI = api;
})();
