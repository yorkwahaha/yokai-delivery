"""Prepare the DEV black wolf, paired bite poses, skill card and summon effects."""
from hashlib import sha256
import json
from pathlib import Path
import runpy
import shutil
import sys

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'art/skills/shikigami'
STATUS = 'IN_GAME_TRIAL_PENDING_USER_REVIEW'
shared = runpy.run_path(str(ROOT / 'tools/prepare-stage56-art.py'))
cells, cutout, FILTER = (shared[key] for key in ('cells', 'clean_cutout', 'FILTER'))


def aligned(sprite, max_width, max_height, foot_y, offset=0):
    sprite.thumbnail((max_width, max_height), FILTER)
    frame = Image.new('RGBA', (512, 352))
    frame.paste(sprite, (256 - sprite.width // 2 + offset, foot_y - sprite.height))
    return frame


def main(source_index):
    selected = ART / 'sources/stage78'
    selected.mkdir(exist_ok=True, parents=True)
    items, sources = [], {}

    def open_sheet(key):
        row = source_index[key]
        path = selected / (key + '.png')
        if not path.exists():
            shutil.copyfile(row['path'], path)
        sources[key] = {'path': path.relative_to(ROOT).as_posix(), 'sha256': sha256(path.read_bytes()).hexdigest(),
                        'generator': 'OpenAI built-in ImageGen', 'prompt': row['prompt']}
        with Image.open(path) as image:
            return image.copy()

    def write(image, folder, file, source, *, pivot=None):
        path = ROOT / 'assets/img' / folder / file
        path.parent.mkdir(exist_ok=True, parents=True)
        if not path.exists():
            image.save(path, 'WEBP', quality=87, method=4)
        media = {'path': path.relative_to(ROOT).as_posix(), 'source': source,
                 'sha256': sha256(path.read_bytes()).hexdigest(), 'bytes': path.stat().st_size,
                 'width_px': image.width, 'height_px': image.height, 'approval': STATUS}
        if pivot is not None:
            media['pivot_px'] = pivot
        items.append(media)

    wolf_dir = 'characters/shikigami'
    black = 'wolf-black-run'
    atlas = open_sheet(black)
    art = [cutout(cell) for row in cells(atlas, 2, 3) for cell in row]
    for i, (pose, n, y) in enumerate([('idle', 1, 320), ('idle', 2, 320), ('run', 1, 316),
                                        ('run', 2, 298), ('run', 3, 319), ('run', 4, 319)]):
        # Existing white idle/run frames use the same 512×352 frame and baseline schedule.
        image = aligned(art[i], 360 if pose == 'idle' else 409, 306 if pose == 'idle' else 254, y)
        write(image, wolf_dir, f'shikigami__sprite__black-{pose}__f{n:02}.webp', black, pivot=[256, 320])
    bites = 'wolf-bites'
    for coat, row in zip(('white', 'black'), cells(open_sheet(bites), 2, 4), strict=True):
        for i, cell in enumerate(row):
            sprite = cutout(cell)
            image = aligned(sprite, (392, 417, 414, 371)[i], (221, 231, 228, 249)[i],
                            (320, 308, 310, 320)[i], (0, 17, 14, 0)[i])
            write(image, wolf_dir, f'shikigami__sprite__{coat}-bite__f{i+1:02}.webp', bites, pivot=[256, 320])
    card = open_sheet('wolf-card').convert('RGB')
    card.thumbnail((512, 768), FILTER)
    write(card, 'skills/shikigami/cards', 'shikigami__card.webp', 'wolf-card')
    for role, part in zip(('summon', 'departure'), next(cells(open_sheet('wolf-fx'), 1, 2)), strict=True):
        image = cutout(part, threshold=12)
        image.thumbnail((224, 224), FILTER)
        write(image, 'vfx/skills/shikigami', f'shikigami__{role}.webp', 'wolf-fx')
    manifest = {'status': STATUS, 'sources': sources, 'items': items, 'count': len(items)}
    (ROOT / 'assets/img/skills/shikigami/manifest.json').write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    print(f'Shikigami: {len(items)} WebPs / {sum(row["bytes"] for row in items):,} bytes')


if __name__ == '__main__':
    main(json.loads(Path(sys.argv[1]).read_text(encoding='utf-8-sig')))
