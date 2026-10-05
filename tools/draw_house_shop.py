"""Redraw assets/img/house_shop.png (and .webp) as a night wooden shop.

Pipeline:
  inline SVG (structure, materials) -> headless Chrome @4x -> numpy paint pass
  (material noise, relief light, cavity AO, window bloom, colour grade)
  -> LANCZOS downscale -> PNG + WebP.

Run: python tools/draw_house_shop.py
"""

import math
import os
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image, ImageFilter

W, H = 471, 425
SS = 4  # supersample factor for the Chrome screenshot
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_PNG = os.path.join(ROOT, "assets", "img", "house_shop.png")
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

# night palette: teal-blue shadow, amber key, desaturated mid
WOOD_D = "#1e1611"
WOOD_M = "#3b2a1e"
WOOD_L = "#55392a"
WOOD_H = "#7d5a3f"
TILE_D = "#171a1f"
TILE_M = "#2b3038"
TILE_L = "#454d59"
STONE_D = "#202126"
STONE_M = "#3a3c43"
GLOW_IN = "#fff3d0"
GLOW_MID = "#f5b055"
INDIGO_D = "#141c33"
INDIGO_L = "#283761"


def f(v):
    return f"{v:.2f}"


def lerp(a, b, t):
    return a + (b - a) * t


def eave_y(x):
    """Eave line sags in the middle and lifts toward both corners."""
    t = (x - W / 2) / (W / 2)
    return 116 + 14 * (1 - t * t)


def defs():
    return f"""
<defs>
  <linearGradient id="woodG" x1="0.1" y1="0" x2="0.6" y2="1">
    <stop offset="0" stop-color="{WOOD_L}"/>
    <stop offset="0.5" stop-color="{WOOD_M}"/>
    <stop offset="1" stop-color="{WOOD_D}"/>
  </linearGradient>
  <linearGradient id="woodG2" x1="0.1" y1="0" x2="0.6" y2="1">
    <stop offset="0" stop-color="#4a3325"/>
    <stop offset="1" stop-color="#1a130f"/>
  </linearGradient>
  <linearGradient id="roofG" x1="0.2" y1="0" x2="0.6" y2="1">
    <stop offset="0" stop-color="{TILE_L}"/>
    <stop offset="0.4" stop-color="{TILE_M}"/>
    <stop offset="1" stop-color="{TILE_D}"/>
  </linearGradient>
  <linearGradient id="stoneG" x1="0" y1="0" x2="0.3" y2="1">
    <stop offset="0" stop-color="#42444b"/>
    <stop offset="1" stop-color="#1e1f24"/>
  </linearGradient>
  <radialGradient id="winGlow" cx="0.5" cy="0.62" r="0.8">
    <stop offset="0" stop-color="{GLOW_IN}"/>
    <stop offset="0.45" stop-color="#ffcf7d"/>
    <stop offset="1" stop-color="#c1691f"/>
  </radialGradient>
  <radialGradient id="haloGlow" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="#ffc978" stop-opacity="0.8"/>
    <stop offset="0.5" stop-color="#e08a3a" stop-opacity="0.3"/>
    <stop offset="1" stop-color="#e08a3a" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="paperG" x1="0.2" y1="0" x2="0.8" y2="1">
    <stop offset="0" stop-color="#fdf0cd"/>
    <stop offset="1" stop-color="#dfa95f"/>
  </linearGradient>
  <linearGradient id="rimG" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#a8c8ee" stop-opacity="0.55"/>
    <stop offset="1" stop-color="#a8c8ee" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="shaftG" x1="0" y1="0" x2="0.2" y2="1">
    <stop offset="0" stop-color="#ffcb84" stop-opacity="0.5"/>
    <stop offset="1" stop-color="#ffcb84" stop-opacity="0"/>
  </linearGradient>
  <filter id="blur2" x="-30%" y="-30%" width="160%" height="160%">
    <feGaussianBlur stdDeviation="2.4"/>
  </filter>
  <filter id="blur6" x="-45%" y="-45%" width="190%" height="190%">
    <feGaussianBlur stdDeviation="7"/>
  </filter>
  <filter id="blur14" x="-60%" y="-60%" width="220%" height="220%">
    <feGaussianBlur stdDeviation="15"/>
  </filter>
  <filter id="brush" x="-6%" y="-6%" width="112%" height="112%">
    <feTurbulence type="fractalNoise" baseFrequency="0.019" numOctaves="3" seed="9" result="warp"/>
    <feDisplacementMap in="SourceGraphic" in2="warp" scale="3.4" xChannelSelector="R" yChannelSelector="G" result="rough"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="3" seed="4" result="noise"/>
    <feColorMatrix in="noise" type="saturate" values="0" result="mono"/>
    <feComponentTransfer in="mono" result="faint">
      <feFuncA type="linear" slope="0.12"/>
    </feComponentTransfer>
    <feComposite in="faint" in2="rough" operator="in" result="grain"/>
    <feBlend in="rough" in2="grain" mode="overlay"/>
  </filter>
</defs>"""


# --------------------------------------------------------------------------- svg

def planks(x, y, w, h, step=12):
    """Vertical boards: per-board tone jitter, grain highlight, knots, seams."""
    out = []
    n = int(w / step)
    for i in range(n + 1):
        px = x + i * step
        if px > x + w:
            break
        j = ((i * 61 + int(px) * 13) % 17) / 17
        tone = WOOD_D if i % 2 else "#2a1e17"
        op = 0.22 + 0.5 * j
        out.append(f'<rect x="{f(px)}" y="{f(y)}" width="{f(step)}" height="{f(h)}" fill="{tone}" opacity="{f(op)}"/>')
        if j > 0.72:
            out.append(f'<rect x="{f(px)}" y="{f(y)}" width="{f(step)}" height="{f(h)}" fill="{WOOD_H}" opacity="0.1"/>')
        out.append(f'<rect x="{f(px + step - 1.4)}" y="{f(y)}" width="1.4" height="{f(h)}" fill="#0b0706" opacity="0.55"/>')
        out.append(f'<rect x="{f(px + 1.2)}" y="{f(y)}" width="1" height="{f(h)}" fill="{WOOD_H}" opacity="0.18"/>')
    for kx, ky, kr in ((x + w * 0.2, y + h * 0.28, 3.2), (x + w * 0.73, y + h * 0.63, 2.4),
                       (x + w * 0.46, y + h * 0.85, 2.0), (x + w * 0.9, y + h * 0.15, 1.8)):
        out.append(f'<ellipse cx="{f(kx)}" cy="{f(ky)}" rx="{f(kr)}" ry="{f(kr * 1.6)}" fill="#0f0a08" opacity="0.45"/>')
        out.append(f'<ellipse cx="{f(kx - 0.8)}" cy="{f(ky - 0.8)}" rx="{f(kr * 0.55)}" ry="{f(kr * 0.9)}" fill="{WOOD_H}" opacity="0.18"/>')
    return "".join(out)


def lattice(x, y, w, h, cols, rows, color="#2a1c14", width=2.2, shadow=True):
    out = []
    if shadow:
        out.append(f'<rect x="{f(x)}" y="{f(y)}" width="{f(w)}" height="{f(h)}" fill="#0d0806" opacity="0.28"/>')
    for i in range(1, cols):
        cx = x + (w * i) / cols
        out.append(f'<line x1="{f(cx)}" y1="{f(y)}" x2="{f(cx)}" y2="{f(y + h)}" stroke="{color}" stroke-width="{f(width)}"/>')
    for j in range(1, rows):
        cy = y + (h * j) / rows
        out.append(f'<line x1="{f(x)}" y1="{f(cy)}" x2="{f(x + w)}" y2="{f(cy)}" stroke="{color}" stroke-width="{f(width)}"/>')
    return "".join(out)


def interior(x, y, w, h, seed=0, opacity=0.24):
    """Faint silhouettes behind the paper: depth, not clutter."""
    out = [f'<ellipse cx="{f(x + w * 0.5)}" cy="{f(y + h * 0.2)}" rx="{f(w * 0.11)}" ry="{f(h * 0.07)}" '
           f'fill="#8a5220" opacity="{f(opacity * 0.9)}" filter="url(#blur2)"/>',
           f'<line x1="{f(x + w * 0.5)}" y1="{f(y)}" x2="{f(x + w * 0.5)}" y2="{f(y + h * 0.15)}" '
           f'stroke="#7a4a1c" stroke-width="1.4" opacity="{f(opacity * 0.7)}"/>']
    sy = y + h * 0.66
    out.append(f'<rect x="{f(x)}" y="{f(sy)}" width="{f(w)}" height="{f(h * 0.05)}" fill="#6b3f18" '
               f'opacity="{f(opacity)}" filter="url(#blur2)"/>')
    for bx, bh_ in ((0.2, 0.2), (0.44, 0.14), (0.72, 0.24)):
        out.append(f'<rect x="{f(x + w * bx)}" y="{f(sy - h * bh_)}" width="{f(w * 0.12)}" height="{f(h * bh_)}" '
                   f'rx="{f(w * 0.05)}" fill="#5c3413" opacity="{f(opacity * 0.9)}" filter="url(#blur2)"/>')
    return "".join(out)


def shoji(x, y, w, h, cols, rows, brightness=1.0, seed=0, things=True):
    halo = (f'<ellipse cx="{f(x + w / 2)}" cy="{f(y + h / 2)}" rx="{f(w * 1.15)}" ry="{f(h * 1.35)}" '
            f'fill="url(#haloGlow)" opacity="{f(0.5 * brightness)}" filter="url(#blur14)"/>')
    paper = (f'<rect x="{f(x)}" y="{f(y)}" width="{f(w)}" height="{f(h)}" rx="2" fill="url(#winGlow)" '
             f'opacity="{f(0.78 + 0.2 * brightness)}"/>')
    stuff = interior(x, y, w, h, seed) if things else ""
    mull = lattice(x, y, w, h, cols, rows, "#3a2618", 2.4)
    frame = (f'<rect x="{f(x)}" y="{f(y)}" width="{f(w)}" height="{f(h)}" rx="2" fill="none" '
             f'stroke="#170f0a" stroke-width="5"/>'
             f'<rect x="{f(x - 2.5)}" y="{f(y - 2.5)}" width="{f(w + 5)}" height="{f(h + 5)}" rx="3" fill="none" '
             f'stroke="{WOOD_H}" stroke-width="2.2" opacity="0.55"/>'
             # recessed reveal: frame casts inward shadow on the top and left of the paper
             f'<path d="M {f(x)} {f(y + h)} L {f(x)} {f(y)} L {f(x + w)} {f(y)}" fill="none" stroke="#100a07" '
             f'stroke-width="9" opacity="0.5" filter="url(#blur2)"/>'
             f'<rect x="{f(x)}" y="{f(y)}" width="{f(w)}" height="4" fill="#0c0705" opacity="0.4"/>')
    return halo + paper + stuff + mull + frame


def roof():
    ridge_l, ridge_r = 141, 330
    eave_l, eave_r = 44, 427
    out = []
    out.append(f'<path d="M {ridge_l} 52 Q {W / 2} 43 {ridge_r} 52 L {eave_r} {f(eave_y(eave_r))} '
               f'Q {W / 2} {f(eave_y(W / 2) + 3)} {eave_l} {f(eave_y(eave_l))} Z" fill="url(#roofG)"/>')

    for k in range(1, 5):
        t = k / 5
        left, right = lerp(ridge_l, eave_l, t), lerp(ridge_r, eave_r, t)
        yl, yr = lerp(48, eave_y(eave_l), t), lerp(48, eave_y(eave_r), t)
        out.append(f'<path d="M {f(left)} {f(yl)} L {f(right)} {f(yr)}" stroke="#0d0f12" stroke-width="2.6" opacity="0.55" fill="none"/>')
        out.append(f'<path d="M {f(left)} {f(yl + 2.8)} L {f(right)} {f(yr + 2.8)}" stroke="{TILE_L}" stroke-width="1.3" opacity="0.32" fill="none"/>')

    n = 29
    for i in range(n + 1):
        t = i / n
        sx, ex = lerp(ridge_l, ridge_r, t), lerp(eave_l, eave_r, t)
        ey = eave_y(ex)
        mx = lerp(sx, ex, 0.55) + (t - 0.5) * 5
        my = lerp(48, ey, 0.55)
        d = f"M {f(sx)} 48 Q {f(mx)} {f(my)} {f(ex)} {f(ey)}"
        out.append(f'<path d="{d}" fill="none" stroke="#0a0c0f" stroke-width="3.6" opacity="0.6"/>')
        out.append(f'<path d="{d}" fill="none" stroke="{TILE_L}" stroke-width="1.7" opacity="0.5" transform="translate(-1.5,0)"/>')
        out.append(f'<path d="{d}" fill="none" stroke="#0a0c0f" stroke-width="1.1" opacity="0.45" transform="translate(1.8,0)"/>')
        # round eave tile cap
        out.append(f'<circle cx="{f(ex)}" cy="{f(ey - 2)}" r="3.1" fill="{TILE_M}"/>')
        out.append(f'<circle cx="{f(ex - 0.8)}" cy="{f(ey - 3)}" r="1.5" fill="{TILE_L}" opacity="0.7"/>')

    # gutter shadow under the eave board
    out.append(f'<path d="M 40 116 Q {W / 2} 134 431 116 L 429 126 Q {W / 2} 142 42 126 Z" fill="#0d0b0a" opacity="0.5"/>')
    # eave board with upturned tips
    out.append(f'<path d="M 38 110 Q {W / 2} 130 433 110 Q 434 124 {W / 2} 135 Q 37 124 38 110 Z" fill="#1a1410"/>')
    out.append(f'<path d="M 42 113 Q {W / 2} 130 429 113" fill="none" stroke="{WOOD_H}" stroke-width="2.4" opacity="0.5"/>')
    out.append(f'<path d="M 42 124 Q {W / 2} 141 429 124" fill="none" stroke="#000" stroke-width="2" opacity="0.35" fill-opacity="0"/>')
    # ridge stack
    out.append(f'<path d="M {ridge_l - 10} 55 Q {W / 2} 39 {ridge_r + 10} 55 Q {W / 2} 64 {ridge_l - 10} 55 Z" fill="#241a14"/>')
    out.append(f'<path d="M {ridge_l - 10} 55 Q {W / 2} 39 {ridge_r + 10} 55" fill="none" stroke="{WOOD_H}" stroke-width="2.2" opacity="0.55"/>')
    for i in range(9):
        tx = lerp(ridge_l - 2, ridge_r + 2, i / 8)
        ty = 47 - 3 * (1 - ((tx - W / 2) / 100) ** 2)
        out.append(f'<path d="M {f(tx - 5)} {f(ty + 5)} Q {f(tx)} {f(ty - 2)} {f(tx + 5)} {f(ty + 5)}" fill="none" '
                   f'stroke="{TILE_M}" stroke-width="3"/>')
    for ex, flip in ((ridge_l - 13, 1), (ridge_r + 13, -1)):
        out.append(f'<g transform="translate({f(ex)},38) scale({flip},1)">'
                   f'<path d="M -13 15 L 0 -7 L 13 15 Z" fill="#2c211a"/>'
                   f'<path d="M -7 15 L 0 0 L 7 15 Z" fill="#3d2e23" opacity="0.8"/>'
                   f'<circle cx="0" cy="-1" r="3.2" fill="{WOOD_H}" opacity="0.65"/></g>')
    return "".join(out)


def lantern(x, y, scale=1.0, glow=1.0):
    s = scale
    return (
        f'<line x1="{f(x)}" y1="118" x2="{f(x)}" y2="{f(y - 16 * s)}" stroke="#1d1410" stroke-width="2.2"/>'
        f'<ellipse cx="{f(x)}" cy="{f(y + 8 * s)}" rx="{f(30 * s)}" ry="{f(34 * s)}" fill="url(#haloGlow)" '
        f'opacity="{f(0.85 * glow)}" filter="url(#blur14)"/>'
        f'<ellipse cx="{f(x)}" cy="{f(y + 8 * s)}" rx="{f(12 * s)}" ry="{f(18 * s)}" fill="url(#paperG)"/>'
        f'<ellipse cx="{f(x - 3.5 * s)}" cy="{f(y + 3 * s)}" rx="{f(4.6 * s)}" ry="{f(8 * s)}" fill="#fffaea" opacity="0.85"/>'
        f'<path d="M {f(x - 11 * s)} {f(y - 9 * s)} Q {f(x)} {f(y - 15 * s)} {f(x + 11 * s)} {f(y - 9 * s)} '
        f'L {f(x + 10 * s)} {f(y - 5 * s)} Q {f(x)} {f(y - 11 * s)} {f(x - 10 * s)} {f(y - 5 * s)} Z" fill="#22190f"/>'
        f'<path d="M {f(x - 9 * s)} {f(y + 25 * s)} Q {f(x)} {f(y + 30 * s)} {f(x + 9 * s)} {f(y + 25 * s)} '
        f'L {f(x + 8 * s)} {f(y + 29 * s)} Q {f(x)} {f(y + 34 * s)} {f(x - 8 * s)} {f(y + 29 * s)} Z" fill="#22190f"/>'
        f'<ellipse cx="{f(x)}" cy="{f(y + 8 * s)}" rx="{f(12 * s)}" ry="{f(18 * s)}" fill="none" '
        f'stroke="#8a2f22" stroke-width="1.4" opacity="0.65"/>'
        f'<ellipse cx="{f(x)}" cy="{f(y + 8 * s)}" rx="{f(12 * s)}" ry="{f(18 * s)}" fill="none" '
        f'stroke="#7a2a1e" stroke-width="1" opacity="0.4" transform="translate(0,{f(5 * s)})"/>'
    )


def noren(x, y, w, h, chars):
    pw = w / len(chars)
    out = [f'<rect x="{f(x - 3)}" y="{f(y - 5)}" width="{f(w + 6)}" height="5" rx="2" fill="#1c130d"/>']
    for i, ch in enumerate(chars):
        px = x + i * pw
        shade = 0.0 if i % 2 == 0 else 0.12
        out.append(f'<path d="M {f(px + 1.5)} {f(y)} L {f(px + pw - 1.5)} {f(y)} L {f(px + pw - 1.5)} {f(y + h - 5)} '
                   f'Q {f(px + pw / 2)} {f(y + h)} {f(px + 1.5)} {f(y + h - 5)} Z" fill="{INDIGO_D}"/>')
        out.append(f'<path d="M {f(px + 1.5)} {f(y)} L {f(px + pw / 2)} {f(y)} L {f(px + pw / 2)} {f(y + h - 2)} '
                   f'Q {f(px + pw * 0.34)} {f(y + h - 6)} {f(px + 1.5)} {f(y + h - 5)} Z" fill="{INDIGO_L}" opacity="{f(0.5 + shade)}"/>')
        out.append(f'<path d="M {f(px + pw / 2)} {f(y)} L {f(px + pw - 1.5)} {f(y)} L {f(px + pw - 1.5)} {f(y + h - 5)} '
                   f'Q {f(px + pw * 0.66)} {f(y + h - 6)} {f(px + pw / 2)} {f(y + h - 2)} Z" fill="#0d1322" opacity="0.45"/>')
        out.append(f'<text x="{f(px + pw / 2)}" y="{f(y + h * 0.74)}" font-family="Yu Gothic, MS Gothic, sans-serif" '
                   f'font-size="{f(h * 0.6)}" font-weight="700" fill="#eef2fa" text-anchor="middle" opacity="0.9">{ch}</text>')
    return "".join(out)


def shaft(x, y, w, h, skew, opacity):
    return (f'<path d="M {f(x)} {f(y)} L {f(x + w)} {f(y)} L {f(x + w + skew)} {f(y + h)} L {f(x + skew)} {f(y + h)} Z" '
            f'fill="url(#shaftG)" opacity="{f(opacity)}" filter="url(#blur6)"/>')


def ground_floor():
    parts = []
    gx, gy, gw, gh = 100, 240, 271, 150
    parts.append(f'<rect x="{gx}" y="{gy}" width="{gw}" height="{gh}" fill="url(#woodG)"/>')
    parts.append(planks(gx, gy, gw, gh))
    # ambient darkening in the wall corners and under the eave
    parts.append(f'<rect x="{gx}" y="{gy}" width="{gw}" height="26" fill="#0a0705" opacity="0.55" filter="url(#blur6)"/>')
    parts.append(f'<rect x="{gx}" y="{gy + gh - 34}" width="{gw}" height="34" fill="#0a0705" opacity="0.45" filter="url(#blur6)"/>')
    parts.append(f'<rect x="{gx + gw - 44}" y="{gy}" width="44" height="{gh}" fill="#0a0705" opacity="0.3" filter="url(#blur6)"/>')
    # warm bounce from the paper screens onto the surrounding boards
    for bx, by, rx, ry, op in ((236, 320, 96, 86, 0.42), (149, 296, 52, 50, 0.3), (323, 296, 52, 50, 0.28)):
        parts.append(f'<ellipse cx="{bx}" cy="{by}" rx="{rx}" ry="{ry}" fill="url(#haloGlow)" opacity="{op}" filter="url(#blur14)"/>')
    # doorway recess
    dx, dy, dw, dh = 196, 262, 80, 128
    parts.append(f'<rect x="{dx - 6}" y="{dy - 6}" width="{dw + 12}" height="{dh + 6}" fill="#0f0a07"/>')
    parts.append(f'<rect x="{dx}" y="{dy}" width="{dw}" height="{dh}" fill="#3d2716"/>')
    parts.append(f'<ellipse cx="{dx + dw / 2}" cy="{dy + dh * 0.58}" rx="60" ry="70" fill="url(#haloGlow)" opacity="0.8" filter="url(#blur14)"/>')
    parts.append(f'<rect x="{dx + 6}" y="{dy + 10}" width="{dw - 12}" height="{dh - 10}" rx="3" fill="url(#winGlow)" opacity="0.92"/>')
    parts.append(interior(dx + 6, dy + 10, dw - 12, dh - 10, seed=3, opacity=0.42))
    parts.append(lattice(dx + 6, dy + 10, dw - 12, dh - 10, 2, 4, "#2c1c12", 2.6))
    parts.append(f'<rect x="{dx + 6}" y="{dy + 10}" width="{dw - 12}" height="6" fill="#0c0705" opacity="0.4"/>')
    parts.append(noren(dx - 5, dy + 3, dw + 10, 42, list("夜行")))
    parts.append(shoji(114, 266, 70, 64, 3, 3, 1.0, seed=1))
    parts.append(shoji(288, 266, 70, 64, 3, 3, 0.95, seed=2))
    # bench, crate, broom, stone lantern
    parts.append(f'<rect x="284" y="338" width="76" height="8" rx="2" fill="{WOOD_L}"/>')
    parts.append(f'<rect x="284" y="338" width="76" height="2.4" fill="{WOOD_H}" opacity="0.5"/>')
    parts.append(f'<rect x="290" y="346" width="6" height="24" fill="{WOOD_D}"/>')
    parts.append(f'<rect x="350" y="346" width="6" height="24" fill="{WOOD_D}"/>')
    parts.append(f'<rect x="118" y="342" width="42" height="32" rx="3" fill="{WOOD_M}"/>')
    parts.append(f'<rect x="118" y="342" width="42" height="32" rx="3" fill="none" stroke="#180f0a" stroke-width="2.6"/>')
    parts.append(f'<line x1="120" y1="355" x2="158" y2="355" stroke="#180f0a" stroke-width="2" opacity="0.7"/>')
    parts.append(f'<line x1="139" y1="342" x2="139" y2="374" stroke="#180f0a" stroke-width="1.6" opacity="0.5"/>')
    parts.append(f'<path d="M 168 388 L 172 344" stroke="#6b4a2c" stroke-width="3"/>')
    parts.append(f'<path d="M 172 344 q 8 4 8 16 q -8 6 -14 2 q 0 -12 6 -18 Z" fill="#7a5a33" opacity="0.85"/>')
    parts.append(f'<g transform="translate(404,358) scale(0.95)">'
                 f'<rect x="-11" y="0" width="22" height="7" rx="2" fill="{STONE_M}"/>'
                 f'<rect x="-7" y="7" width="14" height="16" fill="#43454c"/>'
                 f'<rect x="-11" y="23" width="22" height="6" rx="2" fill="{STONE_M}"/>'
                 f'<rect x="-4" y="-8" width="8" height="8" fill="#43454c"/>'
                 f'<ellipse cx="0" cy="-2" rx="9" ry="11" fill="#ffce8c" opacity="0.75"/>'
                 f'<ellipse cx="0" cy="-2" rx="4.5" ry="6" fill="#fff4d6"/></g>')
    # posts, beam, moonlight rim
    for px in (100, 186, 276, 359):
        wdt = 12 if px in (100, 359) else 10
        parts.append(f'<rect x="{px}" y="{gy - 5}" width="{wdt}" height="{gh + 7}" fill="{WOOD_D}"/>')
        parts.append(f'<rect x="{px + 1.4}" y="{gy - 5}" width="2.6" height="{gh + 7}" fill="{WOOD_H}" opacity="0.35"/>')
        parts.append(f'<rect x="{px + wdt - 1.6}" y="{gy - 5}" width="1.6" height="{gh + 7}" fill="#000" opacity="0.3"/>')
    parts.append(f'<rect x="{gx}" y="244" width="{gw}" height="11" fill="{WOOD_L}"/>')
    parts.append(f'<rect x="{gx}" y="244" width="{gw}" height="3" fill="{WOOD_H}" opacity="0.5"/>')
    parts.append(f'<rect x="{gx}" y="253" width="{gw}" height="3.4" fill="#0e0907" opacity="0.6"/>')
    parts.append(f'<rect x="{gx}" y="{gy - 6}" width="18" height="{gh + 9}" fill="url(#rimG)" opacity="0.75"/>')
    return "".join(parts)


def second_floor():
    sx, sy, sw, sh = 112, 122, 247, 116
    parts = [f'<rect x="{sx}" y="{sy}" width="{sw}" height="{sh}" fill="url(#woodG2)"/>',
             planks(sx, sy, sw, sh, 11),
             f'<rect x="{sx}" y="{sy}" width="{sw}" height="20" fill="#0a0705" opacity="0.45" filter="url(#blur6)"/>']
    parts.append(shoji(126, 142, 102, 58, 4, 3, 0.6, seed=4))
    parts.append(shoji(243, 142, 102, 58, 4, 3, 0.52, seed=5))
    # railing + small planters
    parts.append(f'<rect x="{sx - 5}" y="204" width="{sw + 10}" height="7" fill="{WOOD_L}"/>')
    parts.append(f'<rect x="{sx - 5}" y="204" width="{sw + 10}" height="2.2" fill="{WOOD_H}" opacity="0.55"/>')
    for i in range(1, 13):
        bx = lerp(sx, sx + sw, i / 13)
        parts.append(f'<rect x="{f(bx - 1.7)}" y="206" width="3.4" height="17" fill="{WOOD_M}"/>')
    parts.append(f'<rect x="{sx - 5}" y="221" width="{sw + 10}" height="10" fill="{WOOD_D}"/>')
    parts.append(f'<rect x="{sx - 5}" y="221" width="{sw + 10}" height="2.4" fill="{WOOD_H}" opacity="0.4"/>')
    for px, pw in ((150, 26), (300, 22)):
        parts.append(f'<path d="M {px} 204 L {px + pw} 204 L {px + pw - 3} 194 L {px + 3} 194 Z" fill="#5a3a26"/>')
        for k in range(5):
            a = -1.1 + k * 0.55
            parts.append(f'<path d="M {px + pw / 2} 196 q {f(6 * math.sin(a))} -12 {f(14 * math.sin(a))} -6" '
                         f'fill="none" stroke="#4e6b3f" stroke-width="2" opacity="0.85"/>')
    for px in (sx - 7, sx + sw - 4):
        parts.append(f'<rect x="{px}" y="{sy - 7}" width="11" height="{sh + 9}" fill="{WOOD_D}"/>')
        parts.append(f'<rect x="{px + 1.4}" y="{sy - 7}" width="2.4" height="{sh + 9}" fill="{WOOD_H}" opacity="0.35"/>')
    parts.append(f'<rect x="{sx - 8}" y="{sy - 12}" width="{sw + 16}" height="9" fill="{WOOD_M}"/>')
    parts.append(f'<rect x="{sx - 8}" y="{sy - 12}" width="{sw + 16}" height="2.6" fill="{WOOD_H}" opacity="0.45"/>')
    return "".join(parts)


def sign_board():
    x, y = 392, 176
    out = [f'<line x1="{x}" y1="140" x2="{x}" y2="{y}" stroke="#1d1410" stroke-width="2"/>',
           f'<rect x="{x - 16}" y="{y}" width="32" height="94" rx="4" fill="#0d0907" opacity="0.5" filter="url(#blur2)"/>',
           f'<rect x="{x - 15}" y="{y}" width="30" height="92" rx="4" fill="#efe3c8" stroke="#2a1e14" stroke-width="3"/>',
           f'<rect x="{x - 15}" y="{y}" width="30" height="92" rx="4" fill="#c9a97a" opacity="0.25"/>']
    for i, (ch, size, dy) in enumerate((("夜", 19, 28), ("行", 19, 52), ("商", 19, 76))):
        out.append(f'<text x="{x}" y="{y + dy}" font-family="Yu Gothic, MS Gothic, sans-serif" font-size="{size}" '
                   f'font-weight="700" fill="#8c2b20" text-anchor="middle">{ch}</text>')
    out.append(f'<text x="{x}" y="{y + 92}" font-family="Yu Gothic, MS Gothic, sans-serif" font-size="13" '
               f'font-weight="700" fill="#8c2b20" text-anchor="middle" opacity="0.85">店</text>')
    return "".join(out)


def plinth():
    parts = [f'<path d="M 92 388 L 379 388 L 371 420 L 100 420 Z" fill="url(#stoneG)"/>',
             f'<path d="M 92 388 L 379 388 L 378 393 L 93 393 Z" fill="#4c4f57"/>',
             f'<path d="M 92 388 L 379 388 L 378 391 L 93 391 Z" fill="#6a6e78" opacity="0.4"/>']
    for i in range(1, 6):
        px = lerp(96, 374, i / 5)
        parts.append(f'<line x1="{f(px)}" y1="393" x2="{f(px - 3)}" y2="420" stroke="#141519" stroke-width="2.2" opacity="0.7"/>')
    parts.append(f'<path d="M 176 420 L 196 396 L 276 396 L 296 420 Z" fill="#4d4f57"/>')
    parts.append(f'<path d="M 176 420 L 196 396 L 276 396 L 296 420 Z" fill="none" stroke="#191a1f" stroke-width="2.6"/>')
    parts.append(f'<path d="M 186 411 q 22 -8 44 -2 q 24 -6 42 2" fill="none" stroke="#6b6e78" stroke-width="2" opacity="0.45"/>')
    parts.append(f'<path d="M 118 388 q 15 -11 32 -2 q -17 7 -32 2 Z" fill="#4e6b3f" opacity="0.5"/>')
    parts.append(f'<path d="M 320 390 q 13 -9 27 -1 q -15 6 -27 1 Z" fill="#4e6b3f" opacity="0.42"/>')
    parts.append(f'<path d="M 104 396 q 18 -6 30 0 q -16 8 -30 0 Z" fill="#3d5c34" opacity="0.35"/>')
    return "".join(parts)


def building():
    parts = []
    # light spilling onto the ground in front of the door
    parts.append(shaft(206, 392, 60, 30, 16, 0.5))
    parts.append(shaft(120, 392, 56, 24, -12, 0.32))
    parts.append(shaft(296, 392, 56, 24, 14, 0.3))
    parts.append(f'<ellipse cx="{W / 2}" cy="404" rx="140" ry="30" fill="url(#haloGlow)" opacity="0.45" filter="url(#blur14)"/>')
    parts.append(roof())
    parts.append(plinth())
    parts.append(second_floor())
    parts.append(ground_floor())
    parts.append(sign_board())
    parts.append(lantern(72, 168))
    return "".join(parts)


def svg():
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">'
            f'{defs()}<g filter="url(#brush)">{building()}</g></svg>')


def html():
    return ("<!doctype html><meta charset='utf-8'>"
            "<style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}</style>" + svg())


# ----------------------------------------------------------------------- painting

def value_noise(h, w, cell, rng):
    gh, gw = max(2, int(h / cell)), max(2, int(w / cell))
    grid = (rng.random((gh, gw)) * 255).astype(np.uint8)
    return np.asarray(Image.fromarray(grid).resize((w, h), Image.BICUBIC), dtype=np.float32) / 255.0


def fbm(h, w, cell, rng, octaves=4, gain=0.5):
    total = np.zeros((h, w), np.float32)
    amp, norm = 1.0, 0.0
    for o in range(octaves):
        total += amp * value_noise(h, w, cell / (2 ** o), rng)
        norm += amp
        amp *= gain
    return total / norm


def blur(arr, radius):
    if isinstance(arr, np.ndarray) and arr.ndim == 3:
        img = Image.fromarray(np.clip(arr * 255, 0, 255).astype(np.uint8), "RGB")
        return np.asarray(img.filter(ImageFilter.GaussianBlur(radius)), np.float32) / 255.0
    img = Image.fromarray(np.clip(arr * 255, 0, 255).astype(np.uint8), "L")
    return np.asarray(img.filter(ImageFilter.GaussianBlur(radius)), np.float32) / 255.0


def paint(img):
    """Relief light, cavity AO, material noise, window bloom and colour grade."""
    a = np.asarray(img, np.float32) / 255.0
    rgb, alpha = a[..., :3], a[..., 3:4]
    h, w = alpha.shape[:2]
    mask = (alpha[..., 0] > 0.02).astype(np.float32)
    mask_s = blur(mask, 2.0)[..., None]

    luma = rgb @ np.array([0.2126, 0.7152, 0.0722], np.float32)

    rng = np.random.default_rng(20261004)

    # material texture: stretched streaks (wood grain) + isotropic mottle
    streak = fbm(h, w, 44, rng, octaves=4)
    streak = value_noise(h, w, 110, rng) * 0.5 + streak * 0.5
    mottle = fbm(h, w, 17, rng, octaves=4)
    tex = 1.0 + 0.10 * (streak - 0.5) + 0.05 * (mottle - 0.5)
    rgb *= tex[..., None]

    # relief from luminance + silhouette, lit from upper left
    lx = np.gradient(blur(luma, 1.0))[1] * mask
    ly = np.gradient(blur(luma, 1.0))[0] * mask
    strength = 17.0
    nx, ny, nz = -lx * strength, -ly * strength, np.ones_like(lx)
    norm = np.sqrt(nx * nx + ny * ny + nz * nz)
    light = np.array([-0.42, -0.66, 0.62], np.float32)
    light /= np.linalg.norm(light)
    diff = np.clip((nx * light[0] + ny * light[1] + nz * light[2]) / norm, 0, 1)
    shade = (0.70 + 0.62 * diff)[..., None]
    shade = lerp_arr(shade, np.ones_like(shade), 0.18)
    rgb *= shade * mask_s + (1 - mask_s)

    # cavity occlusion: darken where local luminance sits below its neighbourhood
    wide = blur(luma, 14)
    tight = blur(luma, 5)
    cavity = np.clip(wide - luma, 0, 1) * 1.5 + np.clip(tight - luma, 0, 1) * 0.9
    rgb *= (1.0 - np.clip(cavity, 0, 0.55))[..., None] * mask_s + (1 - mask_s)

    # edge contact darkening just inside the silhouette
    edge = np.clip(blur(mask, 5) - mask, 0, 1)
    rgb *= (1.0 - 0.45 * edge)[..., None]

    # window bloom
    bright = np.clip((luma - 0.52) / 0.48, 0, 1)[..., None] * rgb
    bloom = blur(bright, 22) + 0.6 * blur(bright, 60)
    rgb = 1.0 - (1.0 - np.clip(rgb, 0, 1)) * (1.0 - np.clip(bloom * 0.85, 0, 1))

    # colour grade: teal shadows, amber highlights, gentle S-curve, saturation
    luma = np.clip(rgb @ np.array([0.2126, 0.7152, 0.0722], np.float32), 0, 1)
    rgb += (np.array([0.02, 0.05, 0.10], np.float32) * (1 - luma)[..., None])
    rgb += (np.array([0.10, 0.05, -0.02], np.float32) * (luma ** 2)[..., None])
    luma = np.clip(rgb @ np.array([0.2126, 0.7152, 0.0722], np.float32), 0, 1)
    rgb = np.clip((rgb - 0.5) * 1.10 + 0.5, 0, 1)
    rgb = np.clip(luma[..., None] + (rgb - luma[..., None]) * 1.12, 0, 1)

    # subtle vignette on the sprite itself
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    rad = np.sqrt(((xx / w) - 0.5) ** 2 + ((yy / h) - 0.5) ** 2) / 0.72
    rgb *= (1.0 - np.clip(rad - 0.55, 0, 1) * 0.35)[..., None]

    out = np.concatenate([np.clip(rgb, 0, 1), alpha], axis=2)
    out[alpha[..., 0] < 0.004] = 0
    return Image.fromarray((out * 255 + 0.5).astype(np.uint8), "RGBA")


def lerp_arr(a, b, t):
    return a + (b - a) * t


def shoot(document_path, png_path):
    cmd = [CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
           "--default-background-color=00000000",
           f"--force-device-scale-factor={SS}",
           f"--window-size={W},{H}",
           f"--screenshot={png_path}",
           f"file:///{document_path.replace(os.sep, '/')}"]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
    if not os.path.exists(png_path):
        sys.exit("chrome screenshot failed:\n" + proc.stdout + proc.stderr)


def main():
    if not os.path.exists(CHROME):
        sys.exit(f"chrome not found at {CHROME}")
    with tempfile.TemporaryDirectory() as tmp:
        doc = os.path.join(tmp, "house.html")
        raw = os.path.join(tmp, f"house@{SS}x.png")
        with open(doc, "w", encoding="utf-8") as fh:
            fh.write(html())
        shoot(doc, raw)
        img = paint(Image.open(raw).convert("RGBA")).resize((W, H), Image.LANCZOS)
        img = img.filter(ImageFilter.UnsharpMask(radius=1.2, percent=52, threshold=3))
        img.save(OUT_PNG, optimize=True)
        img.save(OUT_PNG.replace(".png", ".webp"), "WEBP", quality=88, method=6)
    print(f"wrote {OUT_PNG} ({os.path.getsize(OUT_PNG)} bytes)")


if __name__ == "__main__":
    main()