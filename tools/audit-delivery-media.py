"""Check all seven source sets and optionally copy Stage 5–7 DEV media into runtime."""
import argparse
from array import array
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
import json
import math
from pathlib import Path
import shutil
import subprocess

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
STATUS = "IN_GAME_TRIAL_PENDING_USER_REVIEW"
LATE = {"hyakki-kyoto", "snow-temple", "spirit-ferry"}
VOICE_A = "97eda32449cf443bbc4b8782853ca554"


def read(path):
    return json.loads(path.read_bytes())


def sound(path):
    decoded = subprocess.run(["ffmpeg", "-v", "error", "-xerror", "-i", str(path), "-f", "s16le",
                              "-ac", "1", "-ar", "16000", "-"], check=True, capture_output=True).stdout
    pcm = array("h", decoded)
    if not pcm:
        raise ValueError(f"No decodable samples in {path}")
    peak = max(map(abs, pcm))
    rms = math.sqrt(sum(v * v for v in pcm) / len(pcm))
    voiced = [i for i, v in enumerate(pcm) if abs(v) > 500]
    return {"seconds": round(len(pcm) / 16000, 3), "rms_dbfs": round(20 * math.log10(max(rms, 1) / 32768), 1),
            "peak": peak, "leading_ms": round(voiced[0] / 16) if voiced else None,
            "trailing_ms": round((len(pcm) - voiced[-1] - 1) / 16) if voiced else None,
            "voiced_ms": round((voiced[-1] - voiced[0] + 1) / 16) if voiced else 0,
            "clipped_samples": sum(abs(v) >= 32767 for v in pcm)}


def picture(path):
    with Image.open(path) as im:
        im.load()
        alpha = im.convert("RGBA").getchannel("A")
        box = alpha.getbbox()
        if not box or alpha.getextrema() != (0, 255) or box == (0, 0, *im.size):
            raise ValueError(f"Bad transparent edges in {path}: {box} / {alpha.getextrema()}")
        return {"size": im.size, "alpha_box": box}


def media_set(stage, words, kind, apply):
    late = stage in LATE
    folder, ext = ("img", "webp") if kind == "image" else ("audio", "mp3")
    destination = ROOT / 'assets' / folder / 'delivery' / stage
    source = destination
    if late:
        source = ROOT / (f"art/delivery-icons/{stage}/words-20261119" if kind == "image"
                         else f"art/audio/fish-{stage}/a-common-ja")
    manifest = read(source / "manifest.json")
    assert manifest['stage'] == stage and manifest['count'] == len(words)
    if late and kind == 'audio':
        assert manifest['model'] == 's2.1-pro-free' and manifest['voice_id'] == VOICE_A
        assert manifest['language'] == 'ja-JP' and manifest['no_pitch_tags']
        references = [a | b for a, b in zip(manifest['words'], manifest['results'], strict=True)]
    else:
        references = manifest['items']
    files = []
    for i, (word, row) in enumerate(zip(words, references, strict=True), 1):
        file = f"{i:02}.{ext}"
        assert row['index'] == i and row['file'] == file, (stage, kind, i)
        assert all(row[key] == word[key] for key in ('jp', 'kanji', 'zh')), (stage, kind, i, row, word)
        path = source / file
        hash_value = sha256(path.read_bytes()).hexdigest()
        assert row['sha256'] == hash_value, (stage, kind, i, file, 'source hash')
        if late and kind == 'audio':
            assert row['tts_text'], (stage, kind, i)
        record = {'index': i, **{k: word[k] for k in ('jp', 'kanji', 'zh')}, 'file': file,
                  'sha256': hash_value, 'source': path.relative_to(ROOT).as_posix(), 'bytes': path.stat().st_size}
        if row.get('tts_text'):
            record['tts_text'] = row['tts_text']
        files.append((path, record))

    inspect = picture if kind == 'image' else sound
    with ThreadPoolExecutor(max_workers=4) as pool:
        stats = list(pool.map(inspect, (path for path, _ in files)))
    flagged = []
    for (_, row), result in zip(files, stats, strict=True):
        if kind == 'audio' and (result['voiced_ms'] < 140 or result['rms_dbfs'] < -36 or
                               result['clipped_samples'] >= 8 or result['trailing_ms'] < 12):
            flagged.append(row['index'])
        row['analysis'] = result
    if late and apply:
        destination.mkdir(exist_ok=True, parents=True)
        for path, row in files:
            target = destination / row['file']
            if target.exists():
                assert sha256(target.read_bytes()).hexdigest() == row['sha256'], f"Keep existing {target}"
            else:
                shutil.copyfile(path, target)
        copy_manifest = {'schema': 1, 'stage': stage, 'status': STATUS, 'kind': kind, 'count': len(files),
                         'candidate_manifest': (source / 'manifest.json').relative_to(ROOT).as_posix(),
                         'items': [record for _, record in files]}
        if kind == 'audio':
            copy_manifest.update(voice='A', voice_id=VOICE_A, model_used=manifest['model'], language='ja-JP')
        target_manifest = destination / 'manifest.json'
        if target_manifest.exists():
            assert read(target_manifest) == copy_manifest, f"Keep existing {target_manifest}"
        else:
            target_manifest.write_text(json.dumps(copy_manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    count = sum((destination / row['file']).is_file() for _, row in files)
    return {'coverage': count, 'flagged': flagged, 'items': [row for _, row in files]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--copy-dev', action='store_true')
    parser.add_argument('--report', type=Path, required=True)
    args = parser.parse_args()
    code = "require('./js/delivery-lexicon.js');process.stdout.write(JSON.stringify(globalThis.DELIVERY_LEXICON.stages))"
    lexicon = json.loads(subprocess.check_output(['node', '-e', code], cwd=ROOT, encoding='utf8'))
    reports, readings = {}, defaultdict(list)
    for row in lexicon:
        stage, words = row['id'], row['words']
        for i, word in enumerate(words, 1):
            readings[word['jp']].append([stage, i, word['zh']])
        reports[stage] = {'words': len(words), **{kind: media_set(stage, words, kind, args.copy_dev) for kind in ('image', 'audio')}}
        print(stage, *(f"{kind} {reports[stage][kind]['coverage']}/{len(words)}; flags {reports[stage][kind]['flagged']}"
                       for kind in ('image', 'audio')), flush=True)
    duplicate = {k: v for k, v in readings.items() if len(v) > 1}
    assert not duplicate, duplicate
    reports['yomi'] = {'words': len(readings), 'image': sum(r['image']['coverage'] for r in reports.values()),
                       'audio': sum(r['audio']['coverage'] for r in reports.values())}
    args.report.write_text(json.dumps({'stages': reports, 'duplicate_readings': duplicate}, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    print('yomi', reports['yomi'], flush=True)


if __name__ == '__main__':
    main()
