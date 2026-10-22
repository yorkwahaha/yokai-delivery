import os
import sys
import json
import hashlib
from PIL import Image

ART_ROOT = "art"
OUTPUT_REPORT = os.path.join(ART_ROOT, "stage-art-consistency-audit.json")

STAGES = [
    "stage2-rain-port",
    "stage3-sakura-pass",
    "stage4-bamboo-maze",
    "stage5-hyakki-kyoto",
    "stage6-snow-temple",
    "stage7-spirit-ferry",
    "stage8-yomi"
]

def sha256_file(fpath):
    h = hashlib.sha256()
    with open(fpath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()

def audit_stage_art():
    print("Auditing Stage Art Consistency across Stages 2 - 8...")
    report = {
        "audit_version": "2026-10-15-AGY-V1",
        "stages": {},
        "overall_summary": {
            "total_stages": len(STAGES),
            "clean_directories": True,
            "prefix_violations": [],
            "missing_webps": [],
            "manifest_discrepancies": []
        }
    }

    for stage in STAGES:
        stage_dir = os.path.join(ART_ROOT, stage)
        stage_report = {
            "stage_id": stage,
            "exists": os.path.exists(stage_dir),
            "subdirectories": [],
            "extra_subdirectories": [],
            "files_count": 0,
            "characters_count": 0,
            "scene_count": 0,
            "preview_count": 0,
            "violations": []
        }

        if not os.path.exists(stage_dir):
            stage_report["violations"].append("Directory does not exist")
            report["stages"][stage] = stage_report
            continue

        entries = os.listdir(stage_dir)
        subdirs = [e for e in entries if os.path.isdir(os.path.join(stage_dir, e))]
        stage_report["subdirectories"] = subdirs

        # Rule 1: Exactly 'characters' and 'scene'
        for sd in subdirs:
            if sd not in ["characters", "scene"]:
                stage_report["extra_subdirectories"].append(sd)
                stage_report["violations"].append(f"Extra subdirectory forbidden: {sd}")
                report["overall_summary"]["clean_directories"] = False

        # Rule 2: Root files naming (Only images must start with Preview_)
        root_files = [e for e in entries if os.path.isfile(os.path.join(stage_dir, e))]
        for rf in root_files:
            if rf.lower().endswith((".png", ".webp", ".jpg")):
                if not rf.startswith("Preview_"):
                    stage_report["violations"].append(f"Root image must start with Preview_: {rf}")
                    report["overall_summary"]["prefix_violations"].append(f"{stage}/{rf}")
                else:
                    stage_report["preview_count"] += 1
            else:
                # Metadata / documentation file
                pass

        # Rule 3: Characters naming
        char_dir = os.path.join(stage_dir, "characters")
        if os.path.exists(char_dir):
            for cf in os.listdir(char_dir):
                if cf.lower().endswith((".png", ".webp", ".jpg")):
                    if not (cf.startswith("E_") or cf.startswith("B_")):
                        stage_report["violations"].append(f"Character file must start with E_ or B_: characters/{cf}")
                        report["overall_summary"]["prefix_violations"].append(f"{stage}/characters/{cf}")
                    else:
                        stage_report["characters_count"] += 1
                    # Check webp pairing
                    if cf.endswith(".png"):
                        w_counterpart = os.path.join(char_dir, cf[:-4] + ".webp")
                        if not os.path.exists(w_counterpart):
                            report["overall_summary"]["missing_webps"].append(f"{stage}/characters/{cf}")

        # Rule 4: Scene naming
        scene_dir = os.path.join(stage_dir, "scene")
        if os.path.exists(scene_dir):
            for sf in os.listdir(scene_dir):
                if sf.lower().endswith((".png", ".webp", ".jpg")):
                    if not (sf.startswith("G_") or sf.startswith("H_") or sf.startswith("O_")):
                        stage_report["violations"].append(f"Scene file must start with G_, H_, or O_: scene/{sf}")
                        report["overall_summary"]["prefix_violations"].append(f"{stage}/scene/{sf}")
                    else:
                        stage_report["scene_count"] += 1
                    # Check webp pairing
                    if sf.endswith(".png"):
                        w_counterpart = os.path.join(scene_dir, sf[:-4] + ".webp")
                        if not os.path.exists(w_counterpart):
                            report["overall_summary"]["missing_webps"].append(f"{stage}/scene/{sf}")

        report["stages"][stage] = stage_report

    with open(OUTPUT_REPORT, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print(f"Audit completed. Report saved to: {OUTPUT_REPORT}")
    print(f"Summary: Clean Dirs={report['overall_summary']['clean_directories']}, Prefix Violations={len(report['overall_summary']['prefix_violations'])}, Missing WebPs={len(report['overall_summary']['missing_webps'])}")
    return report

if __name__ == "__main__":
    audit_stage_art()
