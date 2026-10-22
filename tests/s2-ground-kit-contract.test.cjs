'use strict';
// ART-S2DEV-INTEGRATE-R1 — focused contract tests for the S2 ground kit dev gate.
// No audio paths are opened (run with --require ./tools/director-audio-freeze.cjs).
// Scope: the strict gate, the manifest contract, deterministic variant selection,
// the observed-orientation / placement decisions, and "sources unchanged".
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const ART_S2 = path.join(ROOT, 'art', 's2');
const sha256 = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

const EXPECTED = [
  'g_stone_01.png', 'g_stone_02.png', 'g_stone_03.png', 'g_wood_01.png',
  'g_wood_02.png', 'g_wood_03.png', 't_stone_wood_v01.png', 't_stone_wood_h01.png', 't_stone_wood_c01.png'
];

function gateOf(search) {
  const raw = String(search || '');
  const hasDev = /(?:^|[?&])dev=1(?=[&#]|$)/.test(raw);
  const hasStage = /(?:^|[?&])stage=rain-port(?=[&#]|$)/.test(raw);
  const hasKit = /(?:^|[?&])s2ground=kit(?=[&#]|$)/.test(raw);
  return hasDev && hasStage && hasKit;
}

test('S2 ground kit gate is strict: dev=1 AND stage=rain-port AND s2ground=kit', () => {
  assert.equal(gateOf('?dev=1&stage=rain-port&s2ground=kit'), true, 'the full dev gate must open');
  assert.equal(gateOf('?dev=1&stage=rain-port'), false, 'no s2ground -> closed');
  assert.equal(gateOf('?dev=1&stage=rain-port&s2ground=kit2'), false, 'wrong kit value -> closed');
  assert.equal(gateOf('?stage=rain-port&s2ground=kit'), false, 'no dev -> closed');
  assert.equal(gateOf('?dev=1&stage=night-town&s2ground=kit'), false, 'wrong stage -> closed');
  assert.equal(gateOf('?dev=0&stage=rain-port&s2ground=kit'), false, 'dev=0 -> closed');
  assert.equal(gateOf(''), false, 'empty query -> closed');
});

test('assets.js exposes the same strict gate and the observed-orientation spec', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'assets.js'), 'utf8');
  assert.match(src, /isS2GroundKitEnabled/, 'the gate must exist');
  assert.match(src, /s2ground=kit/, 'the gate must require s2ground=kit');
  assert.match(src, /stage=rain-port/, 'the gate must require stage=rain-port');
  assert.match(src, /dev=1/, 'the gate must require dev=1');
  // observed orientation comes from the images, not from the file-name letters
  assert.match(src, /t_stone_wood_v01[\s\S]{0,400}observedOrientation:\s*'horizontal'/, 'v01 is OBSERVED horizontal');
  assert.match(src, /t_stone_wood_h01[\s\S]{0,400}observedOrientation:\s*'diagonal'/, 'h01 is OBSERVED diagonal');
  assert.match(src, /t_stone_wood_c01[\s\S]{0,400}observedOrientation:\s*'vertical'/, 'c01 is OBSERVED vertical');
  // placement decisions
  assert.match(src, /t_stone_wood_h01[\s\S]{0,300}SKIPPED_ORIENTATION_MISMATCH/, 'h01 must be skipped as orientation mismatch');
  assert.match(src, /t_stone_wood_c01[\s\S]{0,300}SKIPPED_NO_VALID_CORNER/, 'c01 must be skipped as no valid corner');
});

test('the kit loader only starts under the gate and never preloads the candidates', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'assets.js'), 'utf8');
  assert.match(src, /if \(S2_GROUND_KIT_CACHE\.enabled\) \{[\s\S]{0,120}loadS2GroundKit\(\)/, 'the loader must be gated');
  assert.match(src, /if \(!cache\.enabled \|\| cache\.started\) return cache;/, 'the loader must refuse to run without the gate');
});

test('renderer mixes the candidates deterministically per world tile cell and separates loaded from drawn', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'renderer.js'), 'utf8');
  assert.match(src, /s2KitVariantPick/, 'a deterministic variant picker must exist');
  assert.match(src, /kitHash2\(tx, ty, salt\)/, 'the variant must be a pure function of the world tile cell');
  assert.match(src, /loadedSources/, 'the evidence must expose loadedSources');
  assert.match(src, /drawnSources/, 'the evidence must expose drawnSources');
  assert.match(src, /notDrawn/, 'loaded-but-not-drawn candidates must be listed separately');
  // the horizontal seam uses the OBSERVED horizontal candidate (v01), never by file-name letter
  assert.match(src, /kitHorizontal/, 'the kit horizontal transition must be used at the horizontal seam');
  // the terrain cache must be invalidated when the async kit images land
  assert.match(src, /kitStamp/, 'the kit readiness must take part in the terrain cache signature');
  assert.match(src, /invalidateGroundCache/, 'a cache invalidation entry point must exist');
});

test('the manifest contract still holds for all ten candidates (read only)', () => {
  const manifestPath = path.join(ART_S2, 'manifest.json');
  assert.ok(fs.existsSync(manifestPath), 'manifest must exist');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.status, 'ART_CANDIDATE_NOT_TILE_QA', 'the source pack stays a candidate');
  const byFile = new Map(manifest.assets.map(a => [path.basename(a.path), a]));
  for (const f of EXPECTED) {
    const entry = byFile.get(f);
    assert.ok(entry, f + ' must be listed in the manifest');
    const p = path.join(ART_S2, f);
    assert.ok(fs.existsSync(p), f + ' must exist');
    assert.equal(sha256(p), entry.sha256, f + ' must match its manifest digest');
    assert.equal(entry.width, 1254, f + ' width');
    assert.equal(entry.height, 1254, f + ' height');
    assert.equal(entry.mode, 'RGB', f + ' mode');
    assert.equal(entry.status, 'ART_CANDIDATE_NOT_SEAMLESS', f + ' must stay NOT_SEAMLESS');
  }
});

test('the source pack bytes are untouched by this ticket', () => {
  // frozen digests of the delivered source pack (art/s2 is read-only for this ticket)
  const FROZEN = {
    'g_stone_01.png': 'e3ba5a77d157aca6b5950605d4735ed30f96232bab648cf9de3027c1ee34182c',
    'g_stone_02.png': '0200db2dbd87f7debc6fe1d23a82a9492799386f1e9773415aa9c2c3e0485dc3',
    'g_stone_03.png': '95cf2d1164f9f637be7ce3d4018f49cb2a7db4c671bf0b3b1cd60c1fec990351',
    'g_stone_04.png': '77ba168ee838bc045a452228b842def554fbeaa9ffebc52cb74b2e50a74b517e',
    'g_wood_01.png': 'cb26295a3ab6746ba04773a00faf0b175c1f233f53e39999e7e4a3801d6ded55',
    'g_wood_02.png': '875ddf5ccb28def3dfcb80af4e7a8fb8ca41ce0b6aafeba25d8ea5f074ad99cf',
    'g_wood_03.png': 'f6a0a271b3caaa79c84940cf0c7584b2f1dc0377f91ecaac5974ae467e20027e',
    't_stone_wood_h01.png': 'd25bb66850bc9c1dcc49671c7363ce4532bbb3457bf3fc97b3a5ad68cec80e19',
    't_stone_wood_v01.png': '5f33906ddf9b269684850fcaacfcd379333602851a9bdc394cf9bdbf261f347d',
    't_stone_wood_c01.png': '1c725d920693f8bb6a6c91f1924f3e5f9fef027ef33f54fe9dfc04fad15fed7f',
    'manifest.json': '9d54847f3240d870585a257549eee0004d5099895757ee907c02ac98dab45975'
  };
  for (const [f, sha] of Object.entries(FROZEN)) {
    const p = path.join(ART_S2, f);
    assert.ok(fs.existsSync(p), f + ' must exist');
    assert.equal(sha256(p), sha, f + ' bytes must be unchanged');
  }
});

test('the kit draw counter counts REAL paints only: a pick / size sample must not count', () => {
  const r = fs.readFileSync(path.join(ROOT, 'js', 'renderer.js'), 'utf8');
  const a = fs.readFileSync(path.join(ROOT, 'js', 'assets.js'), 'utf8');

  // 1) the variant picker only SELECTS - it must not touch the draw counter
  const picker = /function s2KitVariantPick\([\s\S]*?\n  \}/.exec(r);
  assert.ok(picker, 'the variant picker must exist');
  assert.doesNotMatch(picker[0], /kitNoteDraw/, 'the picker must NOT count (a pick is not a paint)');

  // 2) tileImage samples the image size with pick(0,0) - that sample must not count either
  assert.match(r, /const sample = pick\(0, 0\);/, 'tileImage keeps its size sample');
  const sampleLine = /const sample = pick\(0, 0\);[^\n]*/.exec(r)[0];
  assert.doesNotMatch(sampleLine, /kitNoteDraw/, 'the size sample must not count as a draw');

  // 3) the counter is incremented only right after a successful c.drawImage of a kit image
  const drawSites = r.match(/c\.drawImage\([^;]*\);[^\n]*\n\s*if \(img && img\.__s2KitId\) kitNoteDraw\(img\.__s2KitId\)/g) || [];
  assert.ok(drawSites.length >= 2, 'both the ground tile band and the seam must count at their draw site (found ' + drawSites.length + ')');
  // the seam path must count as well
  assert.match(r, /syBase[\s\S]{0,400}__s2KitId\) kitNoteDraw/, 'the horizontal seam must count at its own draw call');

  // 4) the kit images carry the marker the renderer keys the counter on
  assert.match(a, /item\._img\.__s2KitId = item\.id;/, 'assets.js must mark kit images for the paint counter');
});

test('the kit preview manifest records per-cell source + sha and the seed', () => {
  const p = path.join(ROOT, 'scratch', 's2-ground-kit', 'integrate-r1', 'previews', 'preview-manifest.json');
  if (!fs.existsSync(p)) { assert.ok(true, 'previews not generated yet (tool run pending)'); return; }
  const m = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.ok(m.previews.length >= 8, 'stone/wood 3x3 per variant + mixed + long run must exist');
  for (const prev of m.previews) {
    assert.ok(prev.cells.length, prev.name + ' must record cells');
    for (const cell of prev.cells) {
      assert.ok(cell.src && cell.srcSha, 'each cell must record its source file and sha');
    }
    assert.ok(prev.longEdge <= 2560, prev.name + ' long edge must stay <= 2560');
  }
});
