"""Temporary watercolor-style raster composites for the violet fragrance skill.

Input art is already stored in this project. These are reviewable placeholders,
not independent AI paintings or the user's final approved card illustrations.
Do not bake words or decorative card frames into any image.
"""
from __future__ import annotations

import random
from pathlib import Path
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SKILLS = ROOT / "assets/img/skills"
VFX = ROOT / "assets/img/vfx/skills/violet-scent"
RNG = random.Random(17011)


def art(path: str) -> Image.Image:
    return Image.open(ROOT / path).convert("RGBA")


def violet(src: Image.Image, dark="#381d58", bright="#ffd4eb", opacity=1.0) -> Image.Image:
    alpha = src.getchannel("A").point(lambda a: max(0, min(255, round(a * opacity))))
    recolored = ImageOps.colorize(ImageOps.grayscale(src), black=dark, white=bright).convert("RGBA")
    recolored.putalpha(alpha)
    return recolored


def overlay(canvas: Image.Image, src: Image.Image, xy: tuple[float, float],
            dimensions: tuple[int, int], alpha=1.0, rotate=0.0) -> None:
    src = src.resize(dimensions, Image.Resampling.LANCZOS)
    if rotate:
        src = src.rotate(rotate, expand=True, resample=Image.Resampling.BICUBIC)
    if alpha < 1:
        src.putalpha(src.getchannel("A").point(lambda v: int(v * alpha)))
    x, y = xy
    canvas.alpha_composite(src, (int(x - src.width / 2), int(y - src.height / 2)))


def backdrop(seed: int, shift: float) -> Image.Image:
    original = art("assets/img/skills/mut-flamebind/cards/mut-flamebind__art.webp")
    haze = original.convert("RGB").resize((820, 1230)).filter(ImageFilter.GaussianBlur(37))
    haze = ImageOps.colorize(ImageOps.grayscale(haze), "#0e1731", "#664478")
    haze = ImageEnhance.Color(haze).enhance(.76)
    # Horizontal luminosity from existing painted source, not vector/card geometry.
    paper = art("assets/img/stages/sakura-pass/tiles/sakura-pass__ground-dirt.webp")
    paper = paper.convert("RGB").resize((820, 1230)).filter(ImageFilter.GaussianBlur(6))
    paper = ImageOps.colorize(ImageOps.grayscale(paper), "#17213d", "#a783a7")
    return Image.blend(haze, paper, .21 + shift).convert("RGBA")


def write_vfx() -> tuple[Image.Image, Image.Image, Image.Image]:
    VFX.mkdir(parents=True, exist_ok=True)
    smoke = art("art/skills/ink-trail/ink-trail__fade-candidate-20261111-v2.webp")
    poison = art("art/skills/ink-trail/ink-trail__burn-candidate-20261111-v3.webp")
    cloud = violet(smoke, "#38164d", "#ffb5e7", .83)
    poison = violet(poison, "#502070", "#f5a2df", .86)
    confuse = violet(smoke, "#601b75", "#ffe6f8", .74)
    # A blurred copy softens older sharp ink edges into drifting fragrance.
    def soften(image: Image.Image, bloom: float) -> Image.Image:
        base = Image.new("RGBA", image.size)
        blur = image.filter(ImageFilter.GaussianBlur(bloom))
        blur.putalpha(blur.getchannel("A").point(lambda a: int(a * .43)))
        base.alpha_composite(blur)
        base.alpha_composite(image)
        return base
    cloud = soften(cloud, 12)
    poison = soften(poison, 8)
    confuse = soften(confuse, 11)
    for name, image in [("cloud", cloud), ("poison", poison), ("confuse", confuse)]:
        image.save(VFX / f"violet-scent__{name}.webp", "WEBP", quality=92, method=6)
    return cloud, poison, confuse


def make_cards(cloud: Image.Image, poison: Image.Image, confuse: Image.Image) -> None:
    flowering = violet(art("assets/img/stages/sakura-pass/props/sakura-pass__ancient-sakura.webp"),
                       "#1e1b48", "#d7a6eb", .96)
    young = violet(art("assets/img/stages/sakura-pass/props/sakura-pass__forest-spreading.webp"),
                   "#191d39", "#bc87cb", .84)
    blossoms = flowering.crop((80, 35, 730, 460))
    ghost = violet(art("assets/img/enemies/sakura-kodama/sakura-kodama__sprite__idle.webp"),
                   "#24203d", "#da9fdd", .85)
    variants = [
        ("ink_trail", 0, [(-16, 24, 650, 560, -.4), (180, 490, 690, 480, .75),
                         (310, 740, 650, 420, .86), (430, 1000, 480, 350, .72)]),
        ("mut_ink_bloom", 1, [(180, 385, 720, 570, .86), (610, 565, 760, 550, .86),
                             (400, 830, 830, 580, .85)]),
        ("mut_ink_razor", 2, [(310, 400, 570, 640, .64), (420, 735, 610, 690, .9),
                             (510, 1020, 500, 500, .75)]),
        ("mut_ink_linger", 3, [(160, 280, 450, 370, .67), (260, 500, 550, 410, .75),
                              (370, 760, 720, 450, .84), (530, 1000, 500, 400, .83)]),
        ("mut_ink_echo", 4, [(170, 480, 620, 620, .66), (505, 520, 510, 660, .75),
                            (510, 880, 700, 690, .82)])
    ]
    for skill, seed, trails in variants:
        canvas = backdrop(seed, min(.045, .012 * seed))
        if seed == 0:
            overlay(canvas, flowering, (550, 285), (710, 680), .87, -7)
        elif seed == 1:
            overlay(canvas, flowering, (280, 260), (700, 630), .78, 11)
            overlay(canvas, flowering, (710, 360), (720, 630), .62, -25)
        elif seed == 2:
            overlay(canvas, young, (480, 345), (750, 540), .52, 2)
            overlay(canvas, ghost, (410, 760), (510, 570), .88)
        elif seed == 3:
            overlay(canvas, young, (390, 420), (850, 500), .78, 12)
        else:
            overlay(canvas, ghost, (270, 560), (460, 510), .75)
            overlay(canvas, ghost, (580, 740), (440, 490), .63, 8)
        for i, (x, y, width, height, strength) in enumerate(trails):
            art_cloud = cloud if i % 3 else confuse
            overlay(canvas, art_cloud, (x, y), (width, height), strength, [17,-9,24,-19][i % 4])
            if seed == 2 and i == 1:
                overlay(canvas, poison, (470, 730), (490, 590), .68, 12)
        # Hanging painted blossom clusters make the fragrance read as wisteria
        # rather than a magic seal, projectile, or explosion.
        for i in range(4 if seed != 2 else 2):
            overlay(canvas, blossoms, (130 + i * 196, 90 + (i % 2)*130),
                    (305, 238 + (i % 2)*40), .25 if seed == 2 else .44, i * 9 - 15)
        dest = SKILLS / skill.replace("_", "-") / "cards" / (skill.replace("_", "-") + "__art.webp")
        dest.parent.mkdir(parents=True, exist_ok=True)
        canvas.convert("RGB").save(dest, "WEBP", quality=91, method=6)
        print(dest.relative_to(ROOT).as_posix())

    # Seal nail is intentionally a separate amber/stone impact scene, rather
    # than a purple ink trail or a translucent circular barrier.
    seal = art("assets/img/skills/boom/cards/boom__art.webp").resize((820, 1230))
    earth = art("assets/img/vfx/enemies/sakura-tengu/sakura-tengu__earth-break.webp")
    pin = art("assets/img/vfx/skills/ofuda/ofuda__cast.webp")
    overlay(seal, earth, (430, 935), (840, 580), .86, 0)
    overlay(seal, pin, (425, 505), (450, 450), .90, -16)
    dest = SKILLS / "seal-nail/cards/seal-nail__art.webp"
    dest.parent.mkdir(parents=True, exist_ok=True)
    seal.convert("RGB").save(dest, "WEBP", quality=92, method=6)
    print(dest.relative_to(ROOT).as_posix())


def main() -> None:
    cloud, poison, confuse = write_vfx()
    make_cards(cloud, poison, confuse)
    # One-use seal explosions use warm earth/ink impact sprites rather than
    # the perfume cloud. These files are safe for public client asset paths.
    seal_vfx = ROOT / "assets/img/vfx/skills/seal-nail"
    seal_vfx.mkdir(parents=True, exist_ok=True)
    pin = art("assets/img/vfx/skills/ofuda/ofuda__cast.webp")
    earth = art("assets/img/vfx/enemies/sakura-tengu/sakura-tengu__earth-break.webp")
    pin.save(seal_vfx / "seal-nail__pin.webp", "WEBP", quality=93)
    warm = violet(earth, "#64351f", "#fff2b2", .95)
    warm.save(seal_vfx / "seal-nail__burst.webp", "WEBP", quality=92)
    crack = violet(earth, "#4c2221", "#ffb06b", .92)
    crack.save(seal_vfx / "seal-nail__break.webp", "WEBP", quality=92)
    print("VIOLET_ART_TEMP_RASTER_CREATED")


if __name__ == "__main__":
    main()
