"""Prepare local DEV WebPs from the reviewed Stage 5 and 6 ImageGen sheets."""
from hashlib import sha256
import json
from pathlib import Path
from dev_stage_art_paths import runtime_path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "art"
STATUS = "ART_CANDIDATE_USER_REVIEW_PENDING"
FILTER = Image.Resampling.LANCZOS
TILE_SIZE = (768, 512)
SHEETS = {
    "kyoto-props": [["maple", "footbridge", "festival-kiosk"],
                    ["festival-banners", "red-railing", "maple-leaves"]],
    "kyoto-structures": [["perimeter-gate", "cloth-merchant"], ["market-shrine", "rear-townhouses"]],
    "kyoto-extra-props": [["stone-basin", "lantern-stand"], ["komainu", "maple-shrub"]],
    "snow-structures": [["shrine", "temple", "torii"], ["stone-lantern", "steps", "bridge"]],
    "snow-props": [["boulders", "pine", "ice-cliff"], ["offertory", "paper-lantern", "cedar-fence"]],
    "snow-extras": [["ice-patch", "snowdrift"], ["octagonal-shrine", "juniper"]],
}
EFFECTS = {
    "kyoto-vfx": ["taiko", "pennant", "procession"],
    "snow-vfx": ["frost-bell", "ice-gale", "blizzard-claws"],
}
ACTORS = {
    "snow-mobs": ["rabbit", "kamaitachi", "ice-badger", "lantern-monk"],
    "snow-bosses": ["frost-bell-guardian", "white-kimono", "mountain-lion"],
}


def clean_cutout(cell, threshold=14):
    rgba = np.array(cell.convert("RGBA"))
    alpha = rgba[:, :, 3]
    core = Image.fromarray(np.where(alpha >= 100, 255, 0).astype(np.uint8)).getbbox()
    if not core or core[2] - core[0] < 30 or core[3] - core[1] < 22:
        raise ValueError(f"No visible sprite in {cell.size}")
    # Clean low-alpha spill from the generated gutters while preserving the painted edges.
    alpha[alpha < threshold] = 0
    result = Image.fromarray(rgba)
    return result.crop((max(0, core[0] - 5), max(0, core[1] - 5),
                        min(cell.width, core[2] + 5), min(cell.height, core[3] + 5)))


def cells(image, rows, columns, *, x_edges=None, y_edges=None):
    w, h = image.size
    y_edges = y_edges or [round(i * h / rows) for i in range(rows + 1)]
    for row in range(rows):
        x_row = x_edges[row] if x_edges else [round(i * w / columns) for i in range(columns + 1)]
        yield [image.crop((x_row[col], y_edges[row], x_row[col + 1], y_edges[row + 1]))
               for col in range(columns)]


def frame_at_foot(sprite, size, foot_y):
    a = np.asarray(sprite.getchannel("A"))
    ys, xs = np.where(a > 115)
    bottom = int(ys.max())
    foot_x = int(np.median(xs[ys > bottom - 13]))
    frame = Image.new("RGBA", (size, size))
    x = max(1, min(size // 2 - foot_x, size - 1 - sprite.width))
    frame.paste(sprite, (x, foot_y - bottom))
    return frame


def periodic(pixels, band=23):
    """Feather each opposite edge toward a shared sample, then lock the corners."""
    result = pixels.copy()
    for axis in (0, 1):
        view = np.swapaxes(result, 0, axis)
        for i in range(band):
            weight = (1 + np.cos(np.pi * i / band)) / 2
            left, right = view[i].copy(), view[-1 - i].copy()
            average = (left + right) / 2
            view[i] = left * (1 - weight) + average * weight
            view[-1 - i] = right * (1 - weight) + average * weight
    return result


def terrain_variants(base, stone=None):
    width, height = TILE_SIZE
    y, x = np.mgrid[0:height, 0:width]
    sx, sy = x / (width - 1), y / (height - 1)
    edge_fade = np.clip(np.minimum.reduce([x, width - 1 - x, y, height - 1 - y]) / 55, 0, 1)
    for variant in range(6):
        # Modulate the generated textures only within the chunk. Every variant shares edge texels.
        phase = variant * np.pi / 3
        local = np.sin(sx * 8 + phase) * np.cos(sy * 6 - phase) * edge_fade
        if stone is None:
            pixels = base + (local * 7)[..., None] * [1, .74, .38]
        else:
            cross_x = .5 + .075 * np.sin(phase + sy * 7) * edge_fade
            cross_y = .483 + .067 * np.cos(phase + sx * 7) * edge_fade
            road_x = (.071 + .021 * local - np.abs(sx - cross_x)) * width
            road_y = (.124 + .024 * local - np.abs(sy - cross_y)) * height
            grain = (base[:, :, 0] - base[:, :, 2]) / 12
            blend = np.clip((np.maximum(road_x, road_y) + grain + 8) / 19, 0, 1)[..., None]
            pixels = (base + (local * 13)[..., None] * [1, .85, .38]) * (1 - blend) + stone * blend
        pixels = periodic(pixels, band=9)
        yield Image.fromarray(np.rint(pixels).clip(0, 255).astype(np.uint8))


def prepare(stage_dir, stage):
    manifest_path = ART / stage_dir / "manifest.json"
    manifest = json.loads(manifest_path.read_bytes())
    sources = manifest["stage56_generation_sources"]
    output = []

    def open_role(role):
        image = Image.open(ROOT / sources[role]["path"])
        image.load()
        return image

    def write(image, relative, source, *, lossless=False, pivot=None):
        path = runtime_path(stage, relative)
        path.parent.mkdir(exist_ok=True, parents=True)
        image.save(path, "WEBP", lossless=lossless, quality=24 if lossless else 84, method=3)
        data = path.read_bytes()
        record = {
            "path": path.relative_to(ROOT).as_posix(), "source": source, "bytes": len(data),
            "sha256": sha256(data).hexdigest(), "width_px": image.width,
            "height_px": image.height, "mode": image.mode, "approval": STATUS,
        }
        if pivot:
            record["pivot_px"] = pivot
        output.append(record)

    for key, roles in SHEETS.items():
        if key not in sources:
            continue
        atlas = open_role(key)
        x_edges = [[0, 811, atlas.width], [0, 710, atlas.width]] if key == "kyoto-structures" else None
        if key == "kyoto-extra-props":
            x_edges = [[0, 645, atlas.width], [0, 570, atlas.width]]
        y_edges = [0, 510, atlas.height] if key == "snow-extras" else None
        for row, pieces in zip(roles, cells(atlas, len(roles), len(roles[0]), x_edges=x_edges, y_edges=y_edges)):
            for role, piece in zip(row, pieces):
                sprite = clean_cutout(piece)
                sprite.thumbnail((520, 520), FILTER)
                write(sprite, f"scene/{stage}__{role}.webp", key, pivot=[sprite.width // 2, round(sprite.height * .96)])

    for key, attacks in EFFECTS.items():
        if key not in sources:
            continue
        atlas = open_role(key)
        y_edges = [0, 363, 587, 1024] if key == "snow-vfx" else None
        xs = [[0, 746, atlas.width]] * 3 if key == "snow-vfx" else None
        for role, pieces in zip(attacks, cells(atlas, 3, 2, x_edges=xs, y_edges=y_edges)):
            for phase, piece in zip(("warning", "impact"), pieces):
                sprite = clean_cutout(piece, threshold=16)
                sprite.thumbnail((600, 448), FILTER)
                prefix = key.split("-")[0]
                write(sprite, f"characters/vfx/{prefix}-{role}__{phase}.webp", key)

    accents = open_role("stage56-action-accents")
    column = 0 if stage == "hyakki-kyoto" else 1
    prefix = "kyoto" if column == 0 else "snow"
    for name, size, row in zip(("shooter__projectile", "boss__arrival"), ((160, 96), (256, 256)), cells(accents, 2, 2)):
        sprite = clean_cutout(row[column], threshold=16)
        sprite.thumbnail(size, FILTER)
        write(sprite, f"characters/vfx/{prefix}-{name}.webp", "stage56-action-accents")

    for key, actors in ACTORS.items():
        if key not in sources:
            continue
        atlas = open_role(key)
        y_edges = [0, 335, 669, atlas.height] if key == "snow-bosses" else [0, 375, 705, atlas.height]
        x_edges = [[0, 355, 704, 1060, atlas.width]] * 3 if key == "snow-mobs" else None
        rows = list(cells(atlas, 3, len(actors), x_edges=x_edges, y_edges=y_edges))
        for actor, pieces in zip(actors, zip(*rows)):
            sprites = [clean_cutout(piece) for piece in pieces]
            scale = min(338 / max(sprite.height for sprite in sprites), 332 / max(sprite.width for sprite in sprites))
            for pose, sprite in zip(("idle", "windup", "action"), sprites):
                sprite = sprite.resize((round(sprite.width * scale), round(sprite.height * scale)), FILTER)
                write(frame_at_foot(sprite, 384, 360), f"characters/poses/snow-{actor}__sprite__{pose}.webp",
                      key, pivot=[192, 360])

    if stage == "hyakki-kyoto":
        atlas = open_role("kyoto-walk")
        pieces = [piece for row in cells(atlas, 2, 2) for piece in row]
        for actor, piece in zip(("straw-sandal", "crow-bell-courier", "rice-bale-oni", "box-bellows"), pieces):
            pose_path = runtime_path(stage, f"characters/poses/kyoto-{actor}__sprite__idle.webp")
            with Image.open(pose_path) as idle:
                target_height = clean_cutout(idle).height
            stride = clean_cutout(piece)
            scale = min(target_height / stride.height, 430 / stride.width)
            stride = stride.resize((round(stride.width * scale), round(stride.height * scale)), FILTER)
            write(frame_at_foot(stride, 512, 480), f"characters/poses/kyoto-{actor}__sprite__walk.webp",
                  "kyoto-walk", pivot=[256, 480])
        for role in ("tea-house", "three-tier-pagoda"):
            name = f"{stage}__{role}"
            source = ART / stage_dir / "scene" / f"{name}__candidate.png"
            with Image.open(source) as image:
                sprite = clean_cutout(image)
            sprite.thumbnail((620, 560), FILTER)
            write(sprite, f"scene/{name}.webp", source.relative_to(ROOT).as_posix(),
                  pivot=[sprite.width // 2, round(sprite.height * .96)])
        base_path = runtime_path(stage, f"scene/{stage}__ground-grid.webp")
        with Image.open(base_path) as image:
            base = periodic(np.asarray(image.convert("RGB").resize(TILE_SIZE, FILTER), dtype=float))
        side_path = ART / stage_dir / "scene" / "G_side_stone.png"
        with Image.open(side_path) as image:
            side = periodic(np.asarray(image.convert("RGB").resize((384, 384), FILTER), dtype=float))
        side = Image.fromarray(np.rint(side * .43).astype(np.uint8))
        write(side, f"scene/{stage}__perimeter-ground.webp", side_path.relative_to(ROOT).as_posix())
        stone = None
        ground_source = base_path.relative_to(ROOT).as_posix()
    else:
        base = periodic(np.asarray(open_role("snow-ground").convert("RGB").resize(TILE_SIZE, FILTER), dtype=float))
        stone = periodic(np.asarray(open_role("snow-path").convert("RGB").resize(TILE_SIZE, FILTER), dtype=float))
        ground_source = ["snow-ground", "snow-path"]
    for variant, image in enumerate(terrain_variants(base, stone)):
        write(image, f"scene/{stage}__ground-{variant}.webp", ground_source, lossless=True)

    manifest["stage56_dev_trial"] = {
        "status": "IN_GAME_TRIAL_PENDING_USER_REVIEW",
        "date": "2026-11-26",
        "asset_count": len(output),
        "items": output,
    }
    if stage == "snow-temple":
        manifest["status"] = STATUS
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{stage}: {len(output)} WebPs, {sum(record['bytes'] for record in output):,} bytes")


if __name__ == "__main__":
    prepare("stage5-hyakki-kyoto", "hyakki-kyoto")
    prepare("stage6-snow-temple", "snow-temple")
