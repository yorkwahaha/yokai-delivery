"""Import the five user-selected Stage3 images without replacing existing art."""
from pathlib import Path
from PIL import Image
from collections import Counter
import hashlib
import json
import shutil

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path('E:/Downloads')
ART = ROOT / 'art/stage3-sakura-pass/scene'
RUNTIME = ROOT / 'assets/img/stages/sakura-pass'
FILES = [
    ('dirt', 'image-gen-1(20261024-195404).png', 'tiles', 'ground-dirt'),
    ('stoneStraight', 'image-gen-1(20261025-033148).png', 'tiles', 'stone-path-straight'),
    ('stoneLeft', 'image-gen-2(20261025-033151).png', 'tiles', 'stone-path-left'),
    ('stoneRight', 'image-gen-4(20261025-033158).png', 'tiles', 'stone-path-right'),
    ('stoneBroken', 'image-gen-3(20261025-033154).png', 'tiles', 'stone-path-broken'),
]


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def write_json(p, data):
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def main():
    records = []
    ART.mkdir(parents=True, exist_ok=True)
    for role, filename, folder, name in FILES:
        source = SOURCE / filename
        original = ART / f'sakura-pass__{name}.png'
        if original.exists():
            assert sha(original) == sha(source), f'Original differs: {original}'
        else:
            shutil.copy2(source, original)
        target = RUNTIME / folder / f'sakura-pass__{name}.webp'
        target.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(original) as im:
            # Encoding only: same pixels/dimensions and original alpha.
            if not target.exists():
                im.save(target, 'WEBP', lossless=True, exact=True, method=6)
            with Image.open(target) as packed:
                assert packed.mode == im.mode and packed.size == im.size
                assert packed.tobytes() == im.tobytes(), f'Pixel mismatch: {target}'
            records.append(dict(role=role, path=target.relative_to(ROOT).as_posix(),
                source=original.relative_to(ROOT).as_posix(), original_attachment=str(source),
                source_sha256=sha(original), sha256=sha(target), size=list(im.size), mode=im.mode,
                visual_status='USER_SELECTED_PREVIOUSLY_APPROVED_20261116',
                runtime_status='IN_GAME_TRIAL_PENDING_USER_REVIEW',
                processing='lossless WebP encoding only; no resize, crop or alpha replacement'))
    manifest = dict(stage='sakura-pass', updated='2026-11-16',
        scope='User requested these five exact images for local Stage3 scene correction; no deployment.',
        assets=records)
    write_json(RUNTIME / 'manifest.json', manifest)
    write_json(ART / 'manifest-user-selected-20261116.json', manifest)
    stage_manifest = ROOT / 'art/stage3-sakura-pass/manifest.json'
    stage = json.loads(stage_manifest.read_text(encoding='utf-8'))
    stage['local_selected_scene'] = 'art/stage3-sakura-pass/scene/manifest-user-selected-20261116.json'
    write_json(stage_manifest, stage)
    # Register only this task's five files. Do not absorb unrelated dirty audio.
    inv_path = ROOT / 'docs/ASSET_INVENTORY.json'
    inv = json.loads(inv_path.read_text(encoding='utf-8'))
    indexed = {item['path']: item for item in inv['files']}
    for item in records:
        if item['path'] in indexed:
            assert indexed[item['path']]['sha256'] == item['sha256']
        indexed[item['path']] = dict(path=item['path'], status='trial_pending_review',
            bytes=(ROOT / item['path']).stat().st_size, sha256=item['sha256'])
    inv['files'] = list(indexed.values())
    inv['totals'] = dict(files=len(inv['files']), by_status=dict(Counter(x['status'] for x in inv['files'])))
    write_json(inv_path, inv)
    reg_path = ROOT / 'docs/ASSET_REGISTRY.json'
    reg = json.loads(reg_path.read_text(encoding='utf-8'))
    reg['trials']['stage_scene'] = {'sakura-pass': 'assets/img/stages/sakura-pass/manifest.json'}
    write_json(reg_path, reg)
    print(f'Imported {len(records)} exact-pixel images; originals retained; unrelated media unchanged.')


if __name__ == '__main__':
    main()
