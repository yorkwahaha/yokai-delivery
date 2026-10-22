'use strict';
// ART-S2DEV-INTEGRATE-R1 — S2 ground kit CLI (dev/QA only).
//
// Commands
//   verify    per-file manifest SHA compare + FULL Pillow decode (1254x1254 RGB) + negative cases
//   preview   REAL composition: stone 3x3 per variant, wood 3x3 per variant, 6x6 mixed, 10x10 long run,
//             plus observed-orientation diagnostics for the three transition candidates
//   edge-qa   self-comparison + ALL ordered pairs inside each material (4 edges / corners /
//             edge-vs-interior deltas, common bright-dark + repeated-feature corroboration)
//   contract  runtime contract summary
//
// Rules honoured here
//   - art/s2/** is READ ONLY. Nothing is cropped, washed, rotated or mirrored.
//   - A missing source => WAITING_SOURCE (exit 2). A bad manifest / bad bytes => not SOURCES_VERIFIED (exit 3).
//   - No input => exit 1 with a precise error, never a fake success.
//   - Seam problems are recorded as TECH_QA_FAIL; no metric is beautified and ART_PASS is never emitted.
//
// Pillow is used through the already-installed interpreter; no new dependency, no install, no codec.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const ART_S2_DIR = path.join(ROOT, 'art', 's2');
const OUT_DIR = path.join(ROOT, 'scratch', 's2-ground-kit', 'integrate-r1');
const MANIFEST_PATH = path.join(ART_S2_DIR, 'manifest.json');
const TMP_DIR = path.join(OUT_DIR, '.tmp');
const PY = process.env.PYTHON_BIN || 'python';

const EXPECTED_FILES = [
  'g_stone_01.png', 'g_stone_02.png', 'g_stone_03.png', 'g_stone_04.png',
  'g_wood_01.png', 'g_wood_02.png', 'g_wood_03.png',
  't_stone_wood_h01.png', 't_stone_wood_v01.png', 't_stone_wood_c01.png'
];
const EXPECTED_DIMENSIONS = { width: 1254, height: 1254 };
const EXPECTED_MODE = 'RGB';
const CELL = 256;                 // preview cell size in px
const MAX_EDGE = 2560;            // preview long-edge cap
const PREVIEW_SEED = 777;

// Observed orientation comes from the IMAGES (the file-name letters do NOT match):
const OBSERVED_ORIENTATION = {
  't_stone_wood_v01.png': 'horizontal',   // stone TOP / wood BOTTOM, horizontal junction
  't_stone_wood_h01.png': 'diagonal',     // stone UPPER-LEFT / wood LOWER-RIGHT, diagonal junction
  't_stone_wood_c01.png': 'vertical'      // stone LEFT / wood RIGHT, vertical straight boundary
};
const PLACEMENT = {
  't_stone_wood_v01.png': { use: 'dockSeamY horizontal seam', state: 'USED' },
  't_stone_wood_h01.png': { use: 'no diagonal stone/wood junction exists in this world layout', state: 'SKIPPED_ORIENTATION_MISMATCH' },
  't_stone_wood_c01.png': { use: 'no legal stone/wood corner exists in this world layout', state: 'SKIPPED_NO_VALID_CORNER' }
};

const sha256 = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const j = v => JSON.stringify(v, null, 2);
function fail(msg, code) { console.error('S2_GROUND_KIT_FAIL: ' + msg); process.exit(code ?? 1); }

// ---------------------------------------------------------------------------
// Python helper (Pillow). Written to the ticket scratch dir at runtime.
// ---------------------------------------------------------------------------
const PY_HELPER = String.raw`
import json, os, sys, hashlib
from PIL import Image

def sha256(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()

def decode_one(spec):
    out = {'file': spec['file'], 'path': spec['path']}
    try:
        out['bytes'] = os.path.getsize(spec['path'])
        with Image.open(spec['path']) as im:
            im.load()                      # FULL decode, not just the header
            out['mode'] = im.mode
            out['size'] = list(im.size)
            out['decoded'] = True
            if 'expectW' in spec: out['expectW'] = spec['expectW']
            if 'expectH' in spec: out['expectH'] = spec['expectH']
            if 'expectMode' in spec: out['expectMode'] = spec['expectMode']
            if 'expectSha' in spec: out['expectSha'] = spec['expectSha']
            out['actualSha'] = sha256(spec['path'])
            out['shaMatch'] = (out['actualSha'] == spec['expectSha'])
            out['sizeOk'] = (out['size'] == [spec.get('expectW', 1254), spec.get('expectH', 1254)])
            out['modeOk'] = (out['mode'] == spec.get('expectMode', 'RGB'))
            out['ok'] = bool(out['shaMatch'] and out['sizeOk'] and out['modeOk'])
    except Exception as e:
        out['decoded'] = False
        out['ok'] = False
        out['error'] = str(e)
    return out

def cell_hash(seed, col, row, salt):
    h = (seed * 2654435761 + col * 40503 + row * 65537 + salt * 2246822519) & 0xffffffff
    h ^= (h >> 15)
    h = (h * 2246822519) & 0xffffffff
    h ^= (h >> 13)
    return h

def compose(job):
    os.makedirs(job['outDir'], exist_ok=True)
    manifest = {'seed': job['seed'], 'cell': job['cell'], 'previews': []}
    for comp in job['compositions']:
        cols, rows = comp['cols'], comp['rows']
        cw = min(job['cell'], (comp.get('maxEdge', 2560) // cols))
        ch = min(job['cell'], (comp.get('maxEdge', 2560) // rows))
        canvas = Image.new('RGB', (cols * cw, rows * ch))
        cells = []
        for row in range(rows):
            for col in range(cols):
                if comp['mode'] == 'single':
                    src = comp['sources'][0]
                    salt = 0
                else:
                    salt = comp.get('salt', 0)
                    src = comp['sources'][cell_hash(job['seed'], col, row, salt) % len(comp['sources'])]
                with Image.open(src['path']) as im:
                    im = im.convert('RGB').resize((cw, ch), Image.LANCZOS)
                    canvas.paste(im, (col * cw, row * ch))
                cells.append({'col': col, 'row': row, 'src': src['file'], 'srcSha': src['sha'], 'scale': round(cw / 1254.0, 6)})
        outPath = os.path.join(job['outDir'], comp['name'] + '.png')
        canvas.save(outPath)
        manifest['previews'].append({
            'name': comp['name'], 'file': os.path.basename(outPath),
            'cols': cols, 'rows': rows, 'cellPx': [cw, ch],
            'outputPx': [cols * cw, rows * ch],
            'longEdge': max(cols * cw, rows * ch),
            'mode': comp['mode'], 'seed': job['seed'], 'salt': comp.get('salt', 0),
            'sources': [s['file'] for s in comp['sources']],
            'cells': cells
        })
    with open(os.path.join(job['outDir'], 'preview-manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    return manifest

def edge_stats(path, n=8):
    with Image.open(path) as im:
        im = im.convert('RGB')
        W, H = im.size
        px = im.load()
        def strip_mean(x0, y0, x1, y1):
            acc = [0.0, 0.0, 0.0]
            cnt = 0
            for y in range(y0, y1):
                for x in range(x0, x1):
                    c = px[x, y]
                    acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2]; cnt += 1
            if cnt == 0: return [0.0, 0.0, 0.0]
            return [a / cnt for a in acc]
        def mean_abs(a, b):
            return sum(abs(x - y) for x, y in zip(a, b)) / 3.0
        def patch_mean(x0, y0, s):
            return strip_mean(x0, y0, x0 + s, y0 + s)
        left = strip_mean(0, 0, n, H)
        right = strip_mean(W - n, 0, W, H)
        top = strip_mean(0, 0, W, n)
        bottom = strip_mean(0, H - n, W, H)
        interior = strip_mean(W // 4, H // 4, 3 * W // 4, 3 * H // 4)
        corner = 96
        corners = {
            'tl': patch_mean(0, 0, corner), 'tr': patch_mean(W - corner, 0, corner),
            'bl': patch_mean(0, H - corner, corner), 'br': patch_mean(W - corner, H - corner, corner)
        }
        # brightness histogram (16 bins) for common bright/dark corroboration
        hist = [0] * 16
        step = max(1, W // 96)
        cnt = 0
        for y in range(0, H, step):
            for x in range(0, W, step):
                r, g, b = px[x, y]
                lum = (r * 299 + g * 587 + b * 114) // 1000
                hist[min(15, lum // 16)] += 1
                cnt += 1
        tot = float(cnt or 1)
        hist = [h / tot for h in hist]
        # repeated-feature probe: mean abs diff between the tile and a shifted copy of itself
        shift = W // 3
        diff = 0.0; sc = 0
        for y in range(0, H - shift, max(1, (H - shift) // 48)):
            for x in range(0, W - shift, max(1, (W - shift) // 48)):
                a = px[x, y]; b = px[x + shift, y]
                diff += abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2])
                sc += 3
        selfShift = diff / sc if sc else 0.0
        return {'left': left, 'right': right, 'top': top, 'bottom': bottom, 'interior': interior,
                'corners': corners, 'hist': hist, 'selfShiftDelta': selfShift}

def edge_qa(job):
    out = {'groups': {}, 'pairs': [], 'selfComparison': []}
    for gname, g in job['groups'].items():
        stats = {}
        for f in g['files']:
            stats[f['file']] = edge_stats(f['path'])
        out['groups'][gname] = {'files': [f['file'] for f in g['files']], 'stats': stats}
        for f in g['files']:
            s = stats[f['file']]
            out['selfComparison'].append({
                'file': f['file'],
                'rightVsLeft': round(sum(abs(a - b) for a, b in zip(s['right'], s['left'])) / 3.0, 3),
                'bottomVsTop': round(sum(abs(a - b) for a, b in zip(s['bottom'], s['top'])) / 3.0, 3),
                'interiorVsInterior': round(sum(abs(a - b) for a, b in zip(s['interior'], s['interior'])) / 3.0, 3),
                'selfShiftDelta': round(s['selfShiftDelta'], 3)
            })
        for a in g['files']:
            for b in g['files']:
                if a['file'] == b['file']: continue
                sa, sb = stats[a['file']], stats[b['file']]
                rightLeft = sum(abs(x - y) for x, y in zip(sa['right'], sb['left'])) / 3.0
                leftRight = sum(abs(x - y) for x, y in zip(sa['left'], sb['right'])) / 3.0
                bottomTop = sum(abs(x - y) for x, y in zip(sa['bottom'], sb['top'])) / 3.0
                topBottom = sum(abs(x - y) for x, y in zip(sa['top'], sb['bottom'])) / 3.0
                interior = sum(abs(x - y) for x, y in zip(sa['interior'], sb['interior'])) / 3.0
                cornerKeys = list(sa['corners'].keys())
                cornerDelta = sum(
                    sum(abs(x - y) for x, y in zip(sa['corners'][ck], sb['corners'][ck])) / 3.0
                    for ck in cornerKeys) / len(cornerKeys)
                histOverlap = sum(min(x, y) for x, y in zip(sa['hist'], sb['hist']))
                out['pairs'].append({
                    'group': gname, 'a': a['file'], 'b': b['file'],
                    'rightToLeft': round(rightLeft, 3), 'leftToRight': round(leftRight, 3),
                    'bottomToTop': round(bottomTop, 3), 'topToBottom': round(topBottom, 3),
                    'cornerDelta': round(cornerDelta, 3),
                    'interiorDelta': round(interior, 3),
                    'edgeVsInteriorRatio': round(max(rightLeft, leftRight, bottomTop, topBottom) / max(interior, 1.0), 3),
                    'histOverlap': round(histOverlap, 4),
                    'aSelfShiftDelta': round(sa['selfShiftDelta'], 3),
                    'bSelfShiftDelta': round(sb['selfShiftDelta'], 3)
                })
    return out

def orientation_probe(job):
    out = []
    for f in job['files']:
        s = edge_stats(f['path'])
        def side(m):
            r, g, b = m
            return round((r * 299 + g * 587 + b * 114) / 1000.0, 2)
        out.append({
            'file': f['file'],
            'declaredOrientation': f.get('declared'),
            'observedBySampling': {
                'topLuma': side(s['top']), 'bottomLuma': side(s['bottom']),
                'leftLuma': side(s['left']), 'rightLuma': side(s['right']),
                'interiorLuma': side(s['interior'])
            },
            'hist': [round(h, 4) for h in s['hist']],
            'note': 'sampling is a heuristic aid only; the observed orientation recorded in the kit is the human-verified one'
        })
    return out

def diag(job):
    from PIL import ImageDraw
    os.makedirs(job['outDir'], exist_ok=True)
    out = {}
    cell = job.get('cell', 380)
    band = 64
    # 1) transition orientation strip: the three ORIGINALS, original orientation, no rotate/mirror
    trans = job.get('transitions', [])
    if trans:
        W = cell * len(trans)
        H = cell + band
        canvas = Image.new('RGB', (W, H), (18, 18, 22))
        d = ImageDraw.Draw(canvas)
        for i, t in enumerate(trans):
            with Image.open(t['path']) as im:
                im = im.convert('RGB').resize((cell, cell), Image.LANCZOS)
                canvas.paste(im, (i * cell, 0))
            label = '%s  %s' % (t['file'], (t.get('sha') or '')[:12])
            label2 = 'observed=%s  %s' % (t.get('observed', '?'), t.get('state', '?'))
            d.text((i * cell + 4, cell + 6), label, fill=(240, 230, 200))
            d.text((i * cell + 4, cell + 26), label2, fill=(200, 200, 160))
            d.text((i * cell + 4, cell + 44), t.get('use', ''), fill=(170, 170, 140))
        p = os.path.join(job['outDir'], 'transition_orientation_diag.png')
        canvas.save(p)
        out['transitionOrientationStrip'] = os.path.basename(p)
    # 2) mixed-variant 3x3 for stone (4 variants) and wood (3 variants)
    for group in job.get('groups', []):
        srcs = group['files']
        cols = rows = 3
        cw = cell
        canvas = Image.new('RGB', (cols * cw, rows * cw), (18, 18, 22))
        d = ImageDraw.Draw(canvas)
        cells = []
        for idx in range(rows * cols):
            cx, cy = idx % cols, idx // cols
            src = srcs[cell_hash(job['seed'], cx, cy, group.get('salt', 0)) % len(srcs)]
            with Image.open(src['path']) as im:
                im = im.convert('RGB').resize((cw, cw), Image.LANCZOS)
                canvas.paste(im, (cx * cw, cy * cw))
            d.rectangle([cx * cw, cy * cw, cx * cw + cw - 1, cy * cw + cw - 1], outline=(20, 20, 24))
            d.text((cx * cw + 6, cy * cw + 6), '%s %s' % (src['file'], (src.get('sha') or '')[:10]), fill=(245, 235, 205))
            cells.append({'col': cx, 'row': cy, 'src': src['file'], 'srcSha': src['sha']})
        p = os.path.join(job['outDir'], group['name'] + '_3x3_mixed_variants.png')
        canvas.save(p)
        out[group['name']] = {'file': os.path.basename(p), 'seed': job['seed'], 'salt': group.get('salt', 0), 'cells': cells}
    with open(os.path.join(job['outDir'], 'diagnostic-manifest.json'), 'w', encoding='utf-8') as f:
        json.dump({'seed': job['seed'], 'cell': job.get('cell', 380), 'outputs': out}, f, ensure_ascii=False, indent=2)
    return out

def main():
    job = json.load(open(sys.argv[1], encoding='utf-8'))
    mode = job['mode']
    if mode == 'decode':
        res = {'decode': [decode_one(s) for s in job['files']]}
        json.dump(res, open(job['out'], 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    elif mode == 'compose':
        m = compose(job)
        json.dump({'previewCount': len(m['previews'])}, open(job['out'], 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    elif mode == 'edge':
        res = edge_qa(job)
        json.dump(res, open(job['out'], 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    elif mode == 'orientation':
        res = {'orientation': orientation_probe(job)}
        json.dump(res, open(job['out'], 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    elif mode == 'diag':
        res = {'outputs': diag(job)}
        json.dump(res, open(job['out'], 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    else:
        raise SystemExit('unknown mode ' + mode)

main()
`;

function writeHelper() {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  const p = path.join(TMP_DIR, 'ground_kit.py');
  fs.writeFileSync(p, PY_HELPER);
  return p;
}
function runHelper(job) {
  const helper = writeHelper();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const jobPath = path.join(TMP_DIR, 'job.json');
  const outPath = path.resolve(job.out);
  fs.writeFileSync(jobPath, JSON.stringify(job));
  if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
  const r = spawnSync(PY, [helper, jobPath], { encoding: 'utf8', windowsHide: true });
  if (r.error) fail('python helper could not start: ' + r.error.message + ' (cmd: ' + PY + ' ' + helper + ' ' + jobPath + ')', 4);
  if (r.status !== 0) fail('python helper exit ' + r.status + ': ' + (r.stderr || '').slice(0, 600), 4);
  if (!fs.existsSync(outPath)) fail('python helper produced no output (cmd: ' + PY + ' ' + helper + ' ' + jobPath + ' -> ' + outPath + ')', 4);
  return JSON.parse(fs.readFileSync(outPath, 'utf8'));
}

// ---------------------------------------------------------------------------
// manifest / source verification
// ---------------------------------------------------------------------------
function readManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) return { error: 'manifest missing: ' + MANIFEST_PATH };
  let parsed;
  try { parsed = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')); }
  catch (e) { return { error: 'manifest not parseable: ' + e.message }; }
  return { manifest: parsed, sha: sha256(MANIFEST_PATH) };
}
function manifestEntries(manifest) {
  const map = new Map();
  for (const a of (manifest?.assets || [])) {
    if (!a || typeof a.path !== 'string') continue;
    map.set(path.basename(a.path).replace(/\\/g, '/'), a);
  }
  return map;
}
function verifyAll() {
  const out = {
    generatedAt: new Date().toISOString(), artS2Dir: ART_S2_DIR,
    manifestPath: MANIFEST_PATH, manifestSha256: null, manifestStatus: null,
    expected: EXPECTED_FILES, files: {}, missing: [], digestMismatch: [], decodeFailed: [],
    status: 'UNKNOWN', exitCode: 0
  };
  const m = readManifest();
  if (m.error) { out.manifestStatus = 'MANIFEST_INVALID'; out.manifestError = m.error; out.status = 'SOURCES_REJECTED'; out.exitCode = 3; return out; }
  out.manifestSha256 = m.sha;
  out.manifestStatus = m.manifest?.status || null;
  out.manifestGroup = m.manifest?.group || null;
  const entries = manifestEntries(m.manifest);
  const decodeSpecs = [];
  for (const file of EXPECTED_FILES) {
    const p = path.join(ART_S2_DIR, file);
    const entry = entries.get(file);
    const rec = { file, path: p, exists: fs.existsSync(p), inManifest: !!entry };
    out.files[file] = rec;
    if (!rec.exists) { rec.status = 'MISSING'; out.missing.push(file); continue; }
    if (!entry) { rec.status = 'NOT_IN_MANIFEST'; out.missing.push(file); continue; }
    rec.manifestSha256 = entry.sha256 || null;
    rec.manifestStatus = entry.status || null;
    rec.manifestPath = entry.path || null;
    rec.manifestWidth = entry.width ?? null;
    rec.manifestHeight = entry.height ?? null;
    rec.manifestMode = entry.mode ?? null;
    decodeSpecs.push({
      file, path: p, expectSha: entry.sha256, expectW: entry.width ?? EXPECTED_DIMENSIONS.width,
      expectH: entry.height ?? EXPECTED_DIMENSIONS.height, expectMode: entry.mode ?? EXPECTED_MODE
    });
  }
  if (decodeSpecs.length) {
    const res = runHelper({ mode: 'decode', files: decodeSpecs, out: path.join(TMP_DIR, 'decode.json') });
    for (const d of res.decode) {
      const rec = out.files[d.file];
      rec.bytes = d.bytes; rec.actualSha256 = d.actualSha; rec.shaMatch = d.shaMatch;
      rec.decoded = d.decoded; rec.mode = d.mode; rec.size = d.size; rec.sizeOk = d.sizeOk; rec.modeOk = d.modeOk;
      if (!d.ok) {
        rec.status = d.decoded === false ? 'DECODE_FAILED' : (d.shaMatch === false ? 'DIGEST_MISMATCH' : 'ATTRIBUTE_MISMATCH');
        if (rec.status === 'DIGEST_MISMATCH') out.digestMismatch.push(d.file);
        if (rec.status === 'DECODE_FAILED') out.decodeFailed.push(d.file);
        out.missing.push(d.file);
      } else rec.status = 'OK';
    }
  }
  const bad = out.missing.length > 0;
  out.totalBytes = EXPECTED_FILES.reduce((n, f) => n + (out.files[f]?.bytes || 0), 0);
  out.allPresent = !bad;
  out.allValid = !bad && Object.values(out.files).every(f => f.status === 'OK');
  if (out.allValid) { out.status = 'SOURCES_VERIFIED'; out.exitCode = 0; }
  else if (out.missing.length) { out.status = 'WAITING_SOURCE'; out.exitCode = 2; }
  else { out.status = 'SOURCES_REJECTED'; out.exitCode = 3; }
  return out;
}

// ---------------------------------------------------------------------------
// negative fixtures (independent copies under the ticket scratch dir; originals untouched)
// ---------------------------------------------------------------------------
function negativeFixtures() {
  const dir = path.join(OUT_DIR, 'fixtures', 'negative');
  fs.mkdirSync(dir, { recursive: true });
  const cases = [];
  const src = path.join(ART_S2_DIR, 'g_stone_01.png');

  // 1. path escape: a manifest path that climbs out of art/s2
  const esc = path.join(dir, 'escape-manifest.json');
  fs.writeFileSync(esc, JSON.stringify({
    stage: 'rain-port', status: 'ART_CANDIDATE_NOT_TILE_QA',
    assets: [{ path: '../../../etc/passwd.png', width: 1254, height: 1254, mode: 'RGB', sha256: 'x', status: 'ART_CANDIDATE_NOT_SEAMLESS' }]
  }));
  cases.push({ name: 'path_escape_manifest', file: esc, expect: 'REJECTED' });

  // 2. missing file
  cases.push({ name: 'missing_file', file: path.join(dir, 'definitely-missing.png'), expect: 'REJECTED' });

  // 3. digest mismatch (real bytes, wrong expected sha)
  const copy = path.join(dir, 'digest-mismatch.png');
  fs.copyFileSync(src, copy);
  cases.push({ name: 'digest_mismatch', file: copy, expect: 'REJECTED', expectSha: '0'.repeat(64) });

  // 4. corrupt PNG (truncated bytes)
  const corrupt = path.join(dir, 'corrupt.png');
  const buf = fs.readFileSync(src);
  fs.writeFileSync(corrupt, buf.subarray(0, Math.floor(buf.length / 3)));
  cases.push({ name: 'corrupt_png', file: corrupt, expect: 'REJECTED' });

  return cases;
}

// ---------------------------------------------------------------------------
// commands
// ---------------------------------------------------------------------------
function cmdVerify() {
  const res = verifyAll();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'source-verification.json'), j(res));
  console.log('=== S2 Ground Kit Source Verification (manifest SHA + full Pillow decode) ===');
  console.log('manifest sha256 : ' + (res.manifestSha256 || 'n/a') + '  status=' + res.manifestStatus);
  console.log('total source bytes: ' + res.totalBytes + ' (' + (res.totalBytes / 1048576).toFixed(2) + ' MiB)');
  for (const f of EXPECTED_FILES) {
    const r = res.files[f];
    console.log('  ' + (r.status === 'OK' ? 'OK ' : 'XX ') + ' ' + f + ' sha=' + (r.actualSha256 || '-').slice(0, 16) +
      ' decode=' + (r.decoded ? r.mode + ' ' + (r.size || []).join('x') : 'FAILED') + (r.status !== 'OK' ? '  <- ' + r.status : ''));
  }
  console.log('STATUS ' + res.status);
  console.log('JSON ' + path.relative(ROOT, path.join(OUT_DIR, 'source-verification.json')));
  process.exit(res.exitCode);
}

function cmdNegative() {
  const cases = negativeFixtures();
  const results = [];
  for (const c of cases) {
    const exists = fs.existsSync(c.file);
    let verdict = 'ACCEPTED', detail = '';
    if (c.name === 'path_escape_manifest') {
      let bad = false;
      try {
        const m = JSON.parse(fs.readFileSync(c.file, 'utf8'));
        for (const a of (m.assets || [])) {
          const resolved = path.resolve(ART_S2_DIR, a.path);
          if (!resolved.startsWith(ART_S2_DIR + path.sep)) { bad = true; detail = 'path escapes art/s2: ' + a.path; }
        }
        if (!bad) detail = 'no escape detected';
      } catch (e) { bad = true; verdict = 'REJECTED'; detail = 'parse error ' + e.message; }
      if (bad) verdict = 'REJECTED';
      results.push({ ...c, verdict, detail });
      continue;
    }
    if (!exists) { verdict = 'REJECTED'; detail = 'file not found'; results.push({ ...c, verdict, detail }); continue; }
    const spec = { file: path.basename(c.file), path: c.file, expectSha: c.expectSha || '0'.repeat(64), expectW: 1254, expectH: 1254, expectMode: 'RGB' };
    let out = null;
    try { out = runHelper({ mode: 'decode', files: [spec], out: path.join(TMP_DIR, 'neg.json') }); }
    catch (e) { verdict = 'REJECTED'; detail = 'decode threw: ' + e.message; results.push({ ...c, verdict, detail }); continue; }
    const d = out.decode[0];
    const rejected = !(d.ok);
    results.push({ ...c, verdict: rejected ? 'REJECTED' : 'ACCEPTED', detail: 'shaMatch=' + d.shaMatch + ' decoded=' + d.decoded + ' mode=' + (d.mode || '-') + (d.error ? ' err=' + d.error : '') });
  }
  const allRejected = results.every(r => r.verdict === 'REJECTED');
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'negative-cases.json'), j({ cases: results, allRejected }));
  console.log('=== S2 Ground Kit Negative Cases (independent fixtures; originals untouched) ===');
  for (const r of results) console.log('  ' + r.verdict + '  ' + r.name + '  ' + r.detail);
  console.log('allRejected=' + allRejected);
  console.log('JSON ' + path.relative(ROOT, path.join(OUT_DIR, 'negative-cases.json')));
  process.exit(allRejected ? 0 : 5);
}

function cmdPreview() {
  const ver = verifyAll();
  if (!ver.allValid) {
    console.log('STATUS ' + ver.status + ' - previews not generated (missing: ' + ver.missing.join(',') + ')');
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUT_DIR, 'source-verification.json'), j(ver));
    process.exit(ver.exitCode || 2);
  }
  const stone = EXPECTED_FILES.filter(f => f.startsWith('g_stone')).map(f => ({ file: f, path: path.join(ART_S2_DIR, f), sha: ver.files[f].actualSha256 }));
  const wood = EXPECTED_FILES.filter(f => f.startsWith('g_wood')).map(f => ({ file: f, path: path.join(ART_S2_DIR, f), sha: ver.files[f].actualSha256 }));
  const comps = [];
  for (const s of stone) comps.push({ name: 'stone_3x3_' + s.file.replace('.png', ''), cols: 3, rows: 3, mode: 'single', sources: [s] });
  for (const w of wood) comps.push({ name: 'wood_3x3_' + w.file.replace('.png', ''), cols: 3, rows: 3, mode: 'single', sources: [w] });
  comps.push({ name: 'mixed_6x6_stone_wood', cols: 6, rows: 6, mode: 'mixed', salt: 0x5354, sources: stone.concat(wood) });
  comps.push({ name: 'mixed_6x6_stone_only', cols: 6, rows: 6, mode: 'mixed', salt: 0x5354, sources: stone });
  comps.push({ name: 'mixed_6x6_wood_only', cols: 6, rows: 6, mode: 'mixed', salt: 0x5744, sources: wood });
  comps.push({ name: 'long_10x10_stone_wood', cols: 10, rows: 10, mode: 'mixed', salt: 0x4c4f, sources: stone.concat(wood) });
  const outDir = path.join(OUT_DIR, 'previews');
  const res = runHelper({ mode: 'compose', outDir, seed: PREVIEW_SEED, cell: CELL, compositions: comps, out: path.join(TMP_DIR, 'compose.json') });
  // orientation diagnostics for the three transition candidates (observed, not letter-derived)
  const transFiles = EXPECTED_FILES.filter(f => f.startsWith('t_stone_wood')).map(f => ({
    file: f, path: path.join(ART_S2_DIR, f), sha: ver.files[f].actualSha256,
    declared: (OBSERVED_ORIENTATION[f] || 'unknown') + ' (observed; file-name letter is misleading)'
  }));
  const orient = runHelper({ mode: 'orientation', files: transFiles, out: path.join(TMP_DIR, 'orient.json') });
  const report = {
    generatedAt: new Date().toISOString(), seed: PREVIEW_SEED, cellPx: CELL, maxEdge: MAX_EDGE,
    sourceBytes: ver.totalBytes, previewCount: res.previewCount,
    orientation: orient.orientation,
    placement: Object.fromEntries(Object.entries(OBSERVED_ORIENTATION).map(([f, o]) => [f, { observed: o, ...PLACEMENT[f] }])),
    note: 'Originals are READ ONLY: no crop, no edge wash, no rotate, no mirror. Previews are thumbnails.'
  };
  fs.writeFileSync(path.join(OUT_DIR, 'preview-report.json'), j(report));
  fs.writeFileSync(path.join(OUT_DIR, 'source-verification.json'), j(ver));
  console.log('=== S2 Ground Kit Real Previews ===');
  console.log('previews written: ' + res.previewCount + '  -> ' + path.relative(ROOT, outDir));
  console.log('orientation (observed):');
  for (const o of orient.orientation) {
    const p = report.placement[o.file] || {};
    console.log('  ' + o.file + '  observed=' + (p.observed || '?') + '  state=' + (p.state || '?') + '  use=' + (p.use || '-'));
  }
  console.log('JSON ' + path.relative(ROOT, path.join(OUT_DIR, 'preview-report.json')));
  process.exit(0);
}

function cmdEdgeQa() {
  const ver = verifyAll();
  if (!ver.allValid) { console.log('STATUS ' + ver.status + ' - edge-qa skipped'); process.exit(ver.exitCode || 2); }
  const stone = EXPECTED_FILES.filter(f => f.startsWith('g_stone')).map(f => ({ file: f, path: path.join(ART_S2_DIR, f), sha: ver.files[f].actualSha256 }));
  const wood = EXPECTED_FILES.filter(f => f.startsWith('g_wood')).map(f => ({ file: f, path: path.join(ART_S2_DIR, f), sha: ver.files[f].actualSha256 }));
  const res = runHelper({
    mode: 'edge', groups: { stone: { files: stone }, wood: { files: wood } }, out: path.join(TMP_DIR, 'edge.json')
  });
  const ratios = res.pairs.map(p => p.edgeVsInteriorRatio).filter(x => Number.isFinite(x)).sort((a, b) => a - b);
  const median = ratios.length ? ratios[Math.floor(ratios.length / 2)] : null;
  const worst = res.pairs.slice().sort((a, b) => b.edgeVsInteriorRatio - a.edgeVsInteriorRatio)[0] || null;
  const verdict = (median !== null && median > 1.5) ? 'TECH_QA_FAIL' : 'TECH_QA_PASS_WITH_MANUAL_REVIEW';
  const report = {
    generatedAt: new Date().toISOString(), verdict,
    policy: 'Composition field stays MANUAL_REVIEW_PENDING. No metric is beautified; no ART_PASS is emitted.',
    selfComparison: res.selfComparison, groups: res.groups,
    pairCount: res.pairs.length,
    medianEdgeVsInteriorRatio: median,
    worstPair: worst,
    pairs: res.pairs
  };
  fs.writeFileSync(path.join(OUT_DIR, 'edge-qa.json'), j(report));
  console.log('=== S2 Ground Kit Edge QA (self + all ordered pairs) ===');
  console.log('pairs=' + res.pairs.length + '  medianEdgeVsInteriorRatio=' + median + '  verdict=' + verdict);
  console.log('worst pair: ' + (worst ? worst.a + ' <-> ' + worst.b + ' ratio=' + worst.edgeVsInteriorRatio : 'n/a'));
  console.log('composition: MANUAL_REVIEW_PENDING');
  console.log('JSON ' + path.relative(ROOT, path.join(OUT_DIR, 'edge-qa.json')));
  process.exit(0);
}

function cmdDiag() {
  const ver = verifyAll();
  if (!ver.allValid) { console.log('STATUS ' + ver.status + ' - diag skipped'); process.exit(ver.exitCode || 2); }
  const stone = EXPECTED_FILES.filter(f => f.startsWith('g_stone')).map(f => ({ file: f, path: path.join(ART_S2_DIR, f), sha: ver.files[f].actualSha256 }));
  const wood = EXPECTED_FILES.filter(f => f.startsWith('g_wood')).map(f => ({ file: f, path: path.join(ART_S2_DIR, f), sha: ver.files[f].actualSha256 }));
  const trans = EXPECTED_FILES.filter(f => f.startsWith('t_stone_wood')).map(f => ({
    file: f, path: path.join(ART_S2_DIR, f), sha: ver.files[f].actualSha256,
    observed: OBSERVED_ORIENTATION[f], state: PLACEMENT[f].state, use: PLACEMENT[f].use
  }));
  const outDir = path.join(OUT_DIR, 'previews');
  const res = runHelper({
    mode: 'diag', outDir, seed: PREVIEW_SEED, cell: 380,
    transitions: trans,
    groups: [{ name: 'stone', salt: 0x5354, files: stone }, { name: 'wood', salt: 0x5744, files: wood }],
    out: path.join(TMP_DIR, 'diag.json')
  });
  console.log('=== S2 Ground Kit Orientation / Variant Diagnostic PNGs ===');
  console.log('outputs: ' + JSON.stringify(Object.keys(res.outputs)));
  console.log('  transition_orientation_diag.png  (3 originals, ORIGINAL orientation, no rotate/mirror)');
  console.log('  stone_3x3_mixed_variants.png / wood_3x3_mixed_variants.png (seed ' + PREVIEW_SEED + ', per-cell src+SHA)');
  console.log('JSON ' + path.relative(ROOT, path.join(outDir, 'diagnostic-manifest.json')));
  process.exit(0);
}

function cmdContract() {
  console.log('=== S2 Ground Kit Runtime Integration Contract ===');
  console.log(`
assets.js:
  - isS2GroundKitEnabled(): STRICT dev gate  dev=1 && stage=rain-port && s2ground=kit
  - loadS2GroundKit(): starts ONLY when the gate is on (no preload of the 10 candidates otherwise)
  - S2_GROUND_KIT_SPECS / S2_GROUND_KIT_PLACEMENT (observed orientation + placement decision)
  - window.getS2GroundKit() / window.__S2_GROUND_KIT_EVIDENCE()  (dev-only readable evidence)

renderer.js:
  - s2KitVariantPick(): per WORLD TILE CELL deterministic variant (stable, no per-frame change)
  - paintPortBoundedTerrain(): stone band / wood band use the kit pickers when the kit is loaded
  - horizontal seam uses t_stone_wood_v01.png (OBSERVED horizontal), NOT the file-name letter
  - t_stone_wood_h01 (diagonal) -> SKIPPED_ORIENTATION_MISMATCH
  - t_stone_wood_c01 (vertical straight) -> SKIPPED_NO_VALID_CORNER
  - kitStamp inside portStamp => terrain cache rebuilds when the async kit images land
  - RENDERER.invalidateGroundCache() / RENDERER.s2GroundKitDrawEvidence()
`);
}

function main() {
  const cmd = process.argv[2] || 'verify';
  if (!fs.existsSync(ART_S2_DIR)) fail('source directory missing: ' + ART_S2_DIR, 2);
  switch (cmd) {
    case 'verify': cmdVerify(); break;
    case 'negative': cmdNegative(); break;
    case 'preview': cmdPreview(); break;
    case 'edge-qa': cmdEdgeQa(); break;
    case 'diag': cmdDiag(); break;
    case 'contract': cmdContract(); break;
    default:
      console.log('Usage: node tools/s2-ground-preview.cjs [verify|negative|preview|edge-qa|contract]');
      process.exit(1);
  }
}
main();
