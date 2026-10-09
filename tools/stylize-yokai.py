"""Bake ink-and-woodblock enemy art without changing the sprite frame geometry.
Run from the project root: python tools/stylize-yokai.py
Requires Pillow and NumPy only at authoring time; browsers load ordinary WebP.
Original sprites remain available as the PNG fallback.
"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "img"
DEST = SOURCE / "yokai"
INK = (32, 29, 34)
PAPER = (229, 208, 171)
TONES = {
    "ghost":   [(44, 61, 70), (79, 109, 115), (128, 149, 145), (186, 182, 150)],
    "runner":  [(88, 50, 47), (156, 76, 59), (186, 122, 77), (204, 176, 119)],
    "tank":    [(58, 66, 53), (107, 114, 83), (149, 143, 104), (204, 175, 124)],
    "shooter": [(65, 57, 71), (108, 96, 117), (134, 150, 146), (205, 177, 124)],
    "mis":     [(71, 48, 66), (129, 72, 94), (164, 125, 126), (204, 176, 132)],
    "boss":    [(76, 40, 44), (133, 53, 51), (173, 106, 72), (203, 165, 113)],
}


def stylize(src: Path, dest: Path, key: str):
    original = Image.open(src).convert("RGBA")
    rgba = np.asarray(original, dtype=np.uint8)
    rgb = rgba[:, :, :3].astype(np.float32)
    alpha = rgba[:, :, 3]
    visible = alpha > 95
    if not np.any(visible):
        raise ValueError(f"No visible sprite in {src}")

    # Preserve eyes, folds and weapons using relative local value, rather than
    # painting a flat tint over the whole character.
    lum = rgb[:, :, 0] * .24 + rgb[:, :, 1] * .67 + rgb[:, :, 2] * .09
    lo, hi = np.percentile(lum[visible], [8, 98])
    tone = np.clip((lum - lo) / max(hi - lo, 42), 0, 1)
    h, w = alpha.shape
    yy, xx = np.ogrid[:h, :w]
    fibers = (np.sin(xx * .32 + yy * .17) + np.sin(yy * .43 - xx * .07)) * .014
    tone = np.clip(tone + fibers, 0, 1)
    stops = np.array([INK, *TONES[key], PAPER], dtype=np.uint8)
    paint = stops[np.digitize(tone, [.12, .30, .51, .73, .89])].copy()

    # Engraved interior lines and an inset silhouette outline, not a rectangular
    # atlas border. All alpha and exact image dimensions remain unchanged.
    gray = Image.fromarray(np.uint8(np.clip(lum, 0, 255)), "L")
    detail = np.asarray(gray.filter(ImageFilter.GaussianBlur(1.1)), dtype=np.float32)
    dx = np.abs(np.diff(detail, axis=1, prepend=detail[:, :1]))
    dy = np.abs(np.diff(detail, axis=0, prepend=detail[:1, :]))
    relief = ((dx + dy) > 32) & (tone < .77) & visible
    paint[relief] = (np.asarray(INK) * .73 + paint[relief] * .27).astype(np.uint8)
    inset = np.asarray(Image.fromarray(alpha, "L").filter(ImageFilter.MinFilter(5)), dtype=np.uint8)
    outline = (alpha > 165) & (inset < 125)
    paint[outline] = INK
    hatch = ((xx + 2 * yy) % 13 < 2) & (tone < .34) & (alpha > 235)
    paint[hatch] = np.clip(paint[hatch].astype(np.int16) + 11, 0, 255).astype(np.uint8)
    dest.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(np.dstack((paint, alpha)), "RGBA").save(dest, "WEBP", quality=86, method=6)
    check = Image.open(dest).convert("RGBA")
    if check.size != original.size or check.getchannel("A").getbbox() != original.getchannel("A").getbbox():
        raise ValueError(f"Geometry or silhouette changed for {src.name}")
    print(f"{dest.relative_to(ROOT)} {w}x{h} {dest.stat().st_size // 1024} KiB")


def main():
    for enemy in TONES:
        for suffix in ("", "_motion_v1"):
            filename = f"{enemy}{suffix}.webp"
            stylize(SOURCE / filename, DEST / filename, enemy)


if __name__ == "__main__":
    main()
