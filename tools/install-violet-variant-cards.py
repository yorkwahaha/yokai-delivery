#!/usr/bin/env python3
"""Safely install the 4 user-selected Violet Scent variant center illustrations.

Usage: python tools/install-violet-variant-cards.py <downloaded-zip>
Only artwork bytes are replaced; the existing UI, card border, texts and skill
effects are intentionally untouched. Backups are stored outside published art.
"""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
from zipfile import ZipFile

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BACKUP = ROOT / ".cleanup-archive" / "2026-11-18" / "violet-variant-cards-before-install"
SKILLS = {
    "mut_ink_bloom": "mut-ink-bloom",
    "mut_ink_razor": "mut-ink-razor",
    "mut_ink_linger": "mut-ink-linger",
    "mut_ink_echo": "mut-ink-echo",
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("zip_path", type=Path)
    parser.add_argument("--verify-only", action="store_true",
                        help="Check archive and artwork without changing project files")
    args = parser.parse_args()
    zip_path = args.zip_path.resolve()
    if not zip_path.is_file():
        raise FileNotFoundError(f"Package not found: {zip_path}")

    pending = {}
    with ZipFile(zip_path) as z:
        manifest = json.loads(z.read("VIOLET_VARIANT_MAPPING.json"))
        records = manifest.get("assets", [])
        if len(records) != len(SKILLS):
            raise ValueError("Expected exactly four reviewed mutation illustrations")
        for record in records:
            skill = record["skill_id"]
            if skill not in SKILLS or skill in pending:
                raise ValueError(f"Unexpected or duplicate skill: {skill}")
            slug = SKILLS[skill]
            expected = f"assets/img/skills/{slug}/cards/{slug}__art.webp"
            if record["target"] != expected:
                raise ValueError(f"Unexpected target: {record['target']}")
            data = z.read(expected)
            if hashlib.sha256(data).hexdigest() != record["sha256"]:
                raise ValueError(f"SHA mismatch: {skill}")
            with Image.open(io.BytesIO(data)) as image:
                if image.format != "WEBP" or image.size != (820, 1230):
                    raise ValueError(f"Unexpected image format/size: {skill}")
            pending[skill] = (expected, data)
    if set(pending) != set(SKILLS):
        raise ValueError("Some mutation illustrations are missing")

    if args.verify_only:
        print("VERIFIED: four reviewed WebP artworks have valid IDs, sizes, and checksums")
        return

    BACKUP.mkdir(parents=True, exist_ok=True)
    for skill, (relative, data) in pending.items():
        dest = ROOT / relative
        if not dest.is_file():
            raise FileNotFoundError(f"Existing in-game art missing: {dest}")
        backup = BACKUP / dest.name
        if not backup.exists():
            shutil.copy2(dest, backup)

    for skill, (relative, data) in pending.items():
        dest = ROOT / relative
        tmp = dest.with_name(dest.name + ".violet-pending")
        tmp.write_bytes(data)
        os.replace(tmp, dest)
        print(f"INSTALLED {skill}: {relative} ({len(data)} bytes)")

    # Preserve the canonical inventory and refresh service-worker file hashes.
    subprocess.run([sys.executable, "tools/asset_registry.py", "--build"], cwd=ROOT, check=True)
    subprocess.run(["node", "tools/build-media-cache.cjs"], cwd=ROOT, check=True)
    subprocess.run([sys.executable, "tools/asset_registry.py", "--check"], cwd=ROOT, check=True)
    print("READY_FOR_LOCAL_REVIEW: restart/refresh preview; not yet deployed")


if __name__ == "__main__":
    main()
