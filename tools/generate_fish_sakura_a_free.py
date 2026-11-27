#!/usr/bin/env python3
"""Stage 3 finalized six new words, Fish Audio A; preserve the original 20 recordings."""
from __future__ import annotations
import concurrent.futures
import json
import os
import pathlib
import subprocess
import generate_fish_rain_port_a_free as engine

ROOT = pathlib.Path(__file__).resolve().parent.parent
engine.OUT = ROOT / "art/audio/fish-sakura-pass/new-six-20261116"
READINGS = {
    "き": "木", "かえる": "かえる", "あり": "あり",
    "ほうき": "ほうき", "ふえ": "笛", "くすり": "薬"
}

def main():
    key = os.getenv("FISH_AUDIO_API_KEY") or os.getenv("FISH_API_KEY")
    if not key:
        raise SystemExit("Fish Audio key unavailable; no request sent")
    js = "require('./js/delivery-lexicon.js');process.stdout.write(JSON.stringify(globalThis.DELIVERY_LEXICON.stages.find(x=>x.id==='sakura-pass').words))"
    words = json.loads(subprocess.check_output(["node", "-e", js], cwd=ROOT, encoding="utf-8"))
    assert len(words) == 20 and set(READINGS) <= {w["jp"] for w in words}
    entries = [dict(index=i, jp=w["jp"], kanji=w["kanji"], zh=w["zh"],
                    tts_text=READINGS[w["jp"]]) for i, w in enumerate(words, 1)
               if w["jp"] in READINGS]
    assert len(entries) == 6
    engine.OUT.mkdir(parents=True, exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        results = list(pool.map(engine.generate, [(w, key) for w in entries]))
    for w, r in zip(entries, results):
        print(f'{w["index"]:02} {w["jp"]} / {w["tts_text"]}: {r["status"]} {r.get("bytes", "")} {r.get("error", "")}', flush=True)
    manifest = dict(status="IN_GAME_TRIAL_PENDING_USER_REVIEW", stage="sakura-pass",
                    model=engine.MODEL, voice_id=engine.REFERENCE_ID, voice="A",
                    language="ja-JP", no_pitch_tags=True, words=entries,
                    results=results, key_included=False,
                    note="Language field normalizes text only; verify real pronunciation by ear.")
    (engine.OUT / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    completed = sum(r["status"] in ("generated", "cached") for r in results)
    print("TOTAL", completed, "/", len(entries), flush=True)
    if completed != len(entries):
        raise SystemExit(2)

if __name__ == "__main__":
    main()
