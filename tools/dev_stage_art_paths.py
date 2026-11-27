"""Canonical DEV image placement shared by stage-art preparation tools."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
DEV_ROOT = ROOT / "art/dev-runtime/img"

def runtime_path(stage, relative):
    p = Path(relative)
    n = p.name
    if not re.fullmatch(r"[a-z0-9_-]+\.webp", n):
        raise ValueError(f"Invalid DEV runtime filename: {relative}")
    identifier = n.split("__", 1)[0]
    if p.parts[:2] == ("characters", "poses"):
        return DEV_ROOT / "enemies" / identifier / n
    if p.parts[:2] == ("characters", "vfx"):
        return DEV_ROOT / "vfx/enemies" / identifier / n
    if p.parts[0] == "scene":
        category = "tiles" if re.search(r"__(?:perimeter-)?ground", n) else "scene"
        return DEV_ROOT / "stages" / stage / category / n
    raise ValueError(f"Unknown DEV image category: {relative}")
