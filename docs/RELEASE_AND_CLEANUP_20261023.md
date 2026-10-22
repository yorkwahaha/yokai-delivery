# 2026-10-23 — Student release and repository cleanup

## Production release

- Release 1: `a1e8c05` — first/second stage gameplay, latest skill rendering code, necessary music/effects, picture VFX and learning word art.
- Release 2: `0d622e7` — urgent `js/fusion.js` missing-script fix and refreshed HTML script version. The preceding release had erroneously left `js/fusion.js` untracked, causing a production HTTP 404; follow-up commit restores it.
- Canonical URL: https://yorkwahaha.github.io/yokai-delivery/
- GitHub Pages publishes `master` /`.`, legacy GitHub Actions. Validate deployed commit and key resource hashes after every push.
- Release smoke: 27 targeted Node tests passed. Broad `npm test` exceeded its 180-second runner timeout and is **not** a full-suite PASS. Phone/tablet human playtest remains to be done.

## Cleanup

- Initial state before cleanup: **33,430 untracked physical files**, including **31,566 scratch** and **1,658 art**; only 32 already tracked files were modified. These are not 33,430 tracked Git changes.
- Archived 113 explicitly obsolete/candidate files (~84 MB) to `I:\Projects\yokai-delivery-archive-20261023`; complete original path, byte length and SHA256 manifest in `manifest-stage2-cleanup.json`. This includes 30 non-approved stage3–8 candidates, 55 historical tests, 13 old stage3–8 helper tools, 10 obsolete QA/planning docs, and five miscellaneous legacy items. Nothing was permanently lost; the archive sits **outside** the Git repository.
- Moved historical snapshot copies `scratch/headcopy`, `scratch/m1copy`, `scratch/commitcopy`, `scratch/sw-old` and `scratch/head.zip` to the sibling archive `scratch-backups/` for reversible preservation.
- Removed 70 disposable Chrome QA profile and `.tmp` cache directories from `scratch/`, without touching game/audio production assets. The path audit log is `scratch/CLEANUP_BROWSER_CACHE_20261023.json`.
- `.gitignore` now excludes local `scratch/`, `art/` production/candidate workspaces, local Kilo config and explicitly experimental assets. They remain on disk for work-in-progress; only approved production media from `assets/img/` and `assets/audio/` is deployed. After future **user art approval**, add final required art to the production asset tree and re-run `node tools/build-media-cache.cjs`; do not deploy an art candidate simply because it exists locally.
- Focused regression and production tooling source files have been retained. Archived historical QA source files can be restored from the manifest if necessary.

## Pending user UI/art feedback (third phase, not part of first release)

1. Improve washi swap modal readability: stronger text contrast plus inline numbers/effect explanations for each of the three held charms and the incoming one.
2. Charm drop/icons distinguish six effects by approved images and restrained colors; BGM must continue during charm replacement.
3. Replace cryptic passive-skill icons with readable symbols and use tasteful native Japanese UI art for level badges instead of bright yellow rectangles.
4. `fusion_inkblade` earned in game but visual unchanged: verify 2D/2.5D candidate load/render gate and actual `drawImage`, and distinguish DEV-only candidate art from approved production assets. Update release only after focused regression and manual art review.

## Agent and safety

- Keep Codex as oversight/roadmap coordinator. Respect current Herdr model selection; if Kilo fails choose Gemini 2.5 Flash, if OpenCode fails choose DeepSeek 4.1 Flash or Nemotron 3 Ultra Free. Original Grok Build may be used when quota permits.
- Single writer per production module. Avoid local Ollama model execution to reserve GPU VRAM for ComfyUI. Do not auto-delete approved source art, original audio, TTS or environment/secret files.
