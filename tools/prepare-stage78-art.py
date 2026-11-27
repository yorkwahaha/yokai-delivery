"""Slice selected built-in ImageGen sheets into DEV-only, registered WebPs."""
import argparse
from hashlib import sha256
import json
from pathlib import Path
from dev_stage_art_paths import runtime_path
import runpy
import shutil

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
STATUS = "ART_CANDIDATE_USER_REVIEW_PENDING"
shared = runpy.run_path(str(ROOT / "tools/prepare-stage56-art.py"))
cells, cutout, foot, periodic, terrain_variants = (shared[key] for key in
    ("cells", "clean_cutout", "frame_at_foot", "periodic", "terrain_variants"))
FILTER = Image.Resampling.LANCZOS
TILE = (768, 512)

PROPS = {
    "ferry-docks-v2": [[None, "floating-deck", "dock-junction"], ["ticket-pavilion", "gate", "covered-ferry"]],
    "ferry-props": [["lantern-post", "empty-boat", "river-shrine", "pier-roof"],
        ["cargo-barrels", "bollards", "parcels", "reeds"], ["shore-ridge", "spirit-lantern", "plank-stack", "waymarker"]],
    "ferry-extra": [["postal-shop", "boathouse", "dockside-inn", "shrine-gate"], ["caged-lamp", "rope", "sandals", "bench"]],
    "yomi-props": [["torii", "palace", "basalt-spire", "pavilion"], ["stone-bridge", "altar", "lantern-post", "jizo"],
        ["spider-lilies", "boulder", "broken-flagstone", "brazier"]],
    "yomi-structures-v2": [["moon", "palace-wall", "stair-gate"], ["cliff-ledge", "bell-tower", "fallen-torii"]],
}
ACTORS = {
    "ferry-mobs": ["paper-passenger", "shadow-kappa", "drowned-turtle", "boat-mail-spirit"],
    "ferry-bosses": ["shore-lion", "drowned-maiden", "ferryman"],
    "yomi-mobs": ["ember-ghost", "scarlet-runner", "basalt-oni", "gate-priest"],
    "yomi-bosses": ["grave-samurai", "cinder-priestess", "word-soul-core"],
}
ATTACKS = {
    "ferry-vfx": ["soul-splash", "spirit-tide", "oar-sweep"],
    "yomi-vfx-v2": ["cinder-burst", "fault-line", "eclipse"],
}


def digest(path):
    return sha256(path.read_bytes()).hexdigest()


def float_texture(art):
    return periodic(np.array(art.convert("RGB").resize(TILE, FILTER), dtype=float))


def atlas_cells(atlas, rows, columns):
    """Locate transparent gutters near the grid marks in generated sheets."""
    opaque = np.asarray(atlas.convert("RGBA").getchannel("A")) > 100

    def find_edges(projection, count):
        size = len(projection)
        spread = round(size / count * .22)
        marks = [0]
        for index in range(1, count):
            middle = round(index * size / count)
            marks.append(min(range(middle - spread, middle + spread + 1),
                             key=lambda point: (projection[point], abs(point - middle))))
        return marks + [size]

    y_edges = find_edges(opaque.sum(axis=1), rows)
    x_edges = [find_edges(opaque[top:bottom].sum(axis=0), columns)
               for top, bottom in zip(y_edges, y_edges[1:])]
    return cells(atlas, rows, columns, x_edges=x_edges, y_edges=y_edges)


def ferry_ground(mud, water, boards):
    wood = float_texture(boards) * .90
    y, x = np.mgrid[0:TILE[1], 0:TILE[0]]
    u, v = x * 900 / (TILE[0] - 1), y * 600 / (TILE[1] - 1)
    coast = np.minimum(u, 900 - u)
    edge = np.clip(np.minimum.reduce([u, 900 - u, v, 600 - v]) / 56, 0, 1)
    for index in range(6):
        phase = index * np.pi / 3
        shore = (np.sin(v / 32 + phase) * 9 + np.cos(v / 15 + phase) * 3) * edge
        blend = np.clip((172 + shore - coast) / 26, 0, 1)[..., None]
        dock = (np.clip((214 + shore - coast) / 21, 0, 1) *
                np.clip((90 - np.abs(v - 300)) / 10, 0, 1))[..., None]
        pixels = (mud + (shore * .38)[..., None]) * (1 - blend) + water * blend
        image = periodic(pixels * (1 - dock) + wood * dock, band=13)
        yield Image.fromarray(np.rint(image).clip(0, 255).astype(np.uint8))


def prepare(number, stage, prefix, source_index):
    folder = ROOT / f"art/stage{number}-{stage}"
    manifest_path = folder / "manifest.json"
    manifest = json.loads(manifest_path.read_bytes())
    sources, output = {}, []

    def open_sheet(key, category):
        spec = source_index[key]
        path = folder / category / "sources-stage78" / (key + ".png")
        original = Path(spec["path"])
        path.parent.mkdir(parents=True, exist_ok=True)
        if not path.exists():
            shutil.copyfile(original, path)
        elif original.exists() and digest(path) != digest(original):
            raise SystemExit(f"Preserve existing source {path}")
        sources[key] = {"path": path.relative_to(ROOT).as_posix(), "sha256": digest(path),
                        "generator": "OpenAI built-in ImageGen", "prompt": spec.get("prompt")}
        with Image.open(path) as source:
            return source.copy()

    def write(image, relative, source, *, lossless=False, pivot=None):
        path = runtime_path(stage, relative)
        path.parent.mkdir(parents=True, exist_ok=True)
        image.save(path, "WEBP", lossless=lossless, quality=28 if lossless else 86, method=4)
        row = {"path": path.relative_to(ROOT).as_posix(), "source": source, "sha256": digest(path),
               "bytes": path.stat().st_size, "width_px": image.width, "height_px": image.height,
               "mode": image.mode, "approval": STATUS}
        if pivot is not None:
            row["pivot_px"] = pivot
        output.append(row)

    for key, rows in PROPS.items():
        if not key.startswith(prefix):
            continue
        atlas = open_sheet(key, "scene")
        for roles, pieces in zip(rows, atlas_cells(atlas, len(rows), len(rows[0]))):
            for role, piece in zip(roles, pieces):
                if role is None:
                    continue
                sprite = cutout(piece)
                sprite.thumbnail((530, 470), FILTER)
                write(sprite, f"scene/{stage}__{role}.webp", key, pivot=[sprite.width // 2, round(sprite.height * .96)])

    def actor(role, pieces, key):
        sprites = [cutout(piece) for piece in pieces]
        scale = min(329 / max(s.height for s in sprites), 334 / max(s.width for s in sprites))
        for pose, sprite in zip(("idle", "windup", "action"), sprites):
            sprite = sprite.resize((round(sprite.width * scale), round(sprite.height * scale)), FILTER)
            write(foot(sprite, 384, 360), f"characters/poses/{prefix}-{role}__sprite__{pose}.webp",
                  key, pivot=[192, 360])

    for key, roles in ACTORS.items():
        if key.startswith(prefix):
            atlas = open_sheet(key, "characters")
            for role, poses in zip(roles, zip(*atlas_cells(atlas, 3, len(roles)))):
                actor(role, poses, key)
    column = number - 7
    key = "gate-actors"
    atlas = open_sheet(key, "characters")
    actor(("bell-oni", "grave-serpent")[column], list(zip(*atlas_cells(atlas, 3, 2)))[column], key)

    for key, attacks in ATTACKS.items():
        if not key.startswith(prefix):
            continue
        atlas = open_sheet(key, "characters")
        for attack, pieces in zip(attacks, atlas_cells(atlas, 3, 2)):
            for phase, piece in zip(("warning", "impact"), pieces):
                sprite = cutout(piece, threshold=16)
                sprite.thumbnail((585, 430), FILTER)
                write(sprite, f"characters/vfx/{prefix}-{attack}__{phase}.webp", key)

    key = "stage78-accents"
    atlas = open_sheet(key, "characters")
    for (role, size), row in zip((("shooter__projectile", (152, 100)), ("boss__arrival", (256, 256))), atlas_cells(atlas, 2, 2)):
        sprite = cutout(row[column], threshold=16)
        sprite.thumbnail(size, FILTER)
        write(sprite, f"characters/vfx/{prefix}-{role}.webp", key)

    ground_key = f"{prefix}-ground"
    atlas = open_sheet(ground_key, "scene")
    w, h = atlas.size
    left = float_texture(atlas.crop((18, 12, w // 2 - 56, h - 12)))
    right = float_texture(atlas.crop((w // 2 + 64, 12, w - 18, h - 12)))
    if prefix == "ferry":
        ground_sources = [ground_key, "ferry-wood"]
        variations = ferry_ground(left, right, open_sheet(ground_sources[1], "scene"))
    else:
        ground_sources = [ground_key]
        variations = terrain_variants(left, right)
    for index, image in enumerate(variations):
        write(image, f"scene/{stage}__ground-{index}.webp", ground_sources, lossless=True)

    manifest["stage78_generation_sources"] = sources
    manifest["stage78_dev_trial"] = {"status": "IN_GAME_TRIAL_PENDING_USER_REVIEW", "date": "2026-11-26",
                                     "asset_count": len(output), "items": output}
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{stage}: {len(output)} WebPs, {sum(r['bytes'] for r in output):,} bytes")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("sources", type=Path, help="JSON with built-in ImageGen source paths and prompts")
    args = parser.parse_args()
    source_index = json.loads(args.sources.read_text(encoding="utf-8-sig"))
    prepare(7, "spirit-ferry", "ferry", source_index)
    prepare(8, "yomi", "yomi", source_index)
