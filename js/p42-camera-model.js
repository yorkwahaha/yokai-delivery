'use strict';
// P4.2 reference mathematics only. Not imported by index.html or the live runtime.
// Camera coordinates retain the existing unzoomed top-left-offset semantics.
const clamp01 = n => Math.max(0, Math.min(1, n));
const smooth01 = n => { const t = clamp01(n); return t * t * (3 - 2 * t); };

function makeCamera({ tilt = 1, zoom = 1, cam = { x: 0, y: 0 },
  anchor = { x: 450, y: 300 }, shake = { x: 0, y: 0 } } = {}) {
  if (![tilt, zoom, cam.x, cam.y, anchor.x, anchor.y, shake.x, shake.y].every(Number.isFinite)
      || tilt <= 0 || tilt > 1 || zoom <= 0) throw new RangeError('Camera requires finite coordinates, 0 < tilt <= 1 and zoom > 0');
  return { tilt, zoom, cam: { ...cam }, anchor: { ...anchor }, shake: { ...shake } };
}

function effectiveZoom({ stageId, tilt = 1, hostname = '', search = '', defaultZoom = 1 } = {}) {
  if (stageId !== 'sakura-pass' || tilt === 1) return 1;
  if (![1, 1.10, 1.15].includes(defaultZoom)) throw new RangeError('Unreviewed zoom default');
  const host = String(hostname).trim().toLowerCase().replace(/^\[|\]$/g, '');
  const local = ['localhost', '127.0.0.1', '::1'].includes(host);
  const raw = new URLSearchParams(search).get('zoom');
  const choices = { '1': 1, '1.1': 1.10, '1.10': 1.10, '1.15': 1.15 };
  const candidate = local && Object.hasOwn(choices, raw) ? choices[raw] : defaultZoom;
  return 1 + (candidate - 1) * clamp01((1 - tilt) / .4);
}

function stableSceneryDepth(worldY, viewerY, { stageId = 'sakura-pass', tilt = 1, mode = 'default' } = {}) {
  if (viewerY == null || tilt > .97) return { scale: 1, blur: 0, grade: 0 };
  const distance = Math.max(0, viewerY - worldY), gain = clamp01((1 - tilt) / .4);
  if (stageId !== 'sakura-pass' || mode === 'off') {
    const focus = clamp01((distance - 290) / 650) * gain;
    return { scale: 1, blur: focus * 2.25, grade: focus };
  }
  const t = smooth01(distance / (mode === 'enhanced' ? 440 : 520)) * gain;
  return { scale: 1, blur: t * t * (mode === 'enhanced' ? 3.2 : 2.6), grade: t };
}

function worldMatrix(c) {
  const { tilt: k, zoom: z, cam, anchor: a, shake: h } = c;
  return [z, 0, 0, k * z, a.x * (1 - z) + z * (-cam.x + h.x),
    a.y * (1 - z) + k * z * (-cam.y + h.y)];
}
function worldToScreen(p, c) {
  const m = worldMatrix(c);
  return { x: m[0] * p.x + m[4], y: m[3] * p.y + m[5] };
}
function screenToWorld(p, c) {
  const { tilt: k, zoom: z, cam, anchor: a, shake: h } = c;
  return { x: cam.x - h.x + a.x + (p.x - a.x) / z,
    y: cam.y - h.y + (a.y + (p.y - a.y) / z) / k };
}
function reanchor(player, previousScreen, next) {
  const w = screenToWorld(previousScreen, { ...next, cam: { x: 0, y: 0 } });
  return { x: player.x - w.x, y: player.y - w.y };
}
function backingMatrix(c, viewport, renderDensity = 1) {
  const m = worldMatrix(c), s = viewport.scale * renderDensity;
  return [s * m[0], 0, 0, s * m[3], s * (viewport.offsetX + m[4]), s * (viewport.offsetY + m[5])];
}
function uprightMatrix(c, foot) {
  const m = worldMatrix(c);
  return [m[0], 0, 0, c.zoom, m[4], m[5] + c.zoom * (c.tilt - 1) * foot.y];
}
function worldBounds(c, bounds, halo = 0) {
  const p = screenToWorld({ x: bounds.left - halo, y: bounds.top - halo }, c);
  const q = screenToWorld({ x: bounds.right + halo, y: bounds.bottom + halo }, c);
  return { left: p.x, top: p.y, right: q.x, bottom: q.y, width: q.x - p.x, height: q.y - p.y };
}
function viewOffsets(c, bounds) {
  return worldBounds({ ...c, cam: { x: 0, y: 0 }, shake: { x: 0, y: 0 } }, bounds);
}
function drawBounds(c, bounds, { left = 0, right = 0, top = 0, bottom = 0, halo = 0 } = {}) {
  const b = worldBounds(c, bounds, halo);
  // Inverted overhangs: a roof below the view can extend upward INTO the view.
  const l = b.left - right, r = b.right + left;
  const t = b.top - bottom / c.tilt, d = b.bottom + top / c.tilt;
  return { left: l, right: r, top: t, bottom: d, width: r - l, height: d - t };
}
function uprightRect(foot, { left = 0, right = 0, top = 0, bottom = 0, halo = 0 }, c) {
  const p = worldToScreen(foot, c), z = c.zoom;
  return { left: p.x - left * z - halo, right: p.x + right * z + halo,
    top: p.y - top * z - halo, bottom: p.y + bottom * z + halo };
}
function clientToLogical(p, rect, viewport) {
  return { x: (p.x - rect.left) * viewport.width / rect.width - viewport.offsetX,
    y: (p.y - rect.top) * viewport.height / rect.height - viewport.offsetY };
}
function logicalToClient(p, rect, viewport) {
  return { x: rect.left + (p.x + viewport.offsetX) * rect.width / viewport.width,
    y: rect.top + (p.y + viewport.offsetY) * rect.height / viewport.height };
}

module.exports = { makeCamera, effectiveZoom, stableSceneryDepth, worldMatrix, backingMatrix,
  uprightMatrix, worldToScreen, screenToWorld, reanchor, viewOffsets, worldBounds, drawBounds,
  uprightRect, clientToLogical, logicalToClient };
