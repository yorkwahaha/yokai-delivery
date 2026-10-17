# M15-03 程式引用改指 canonical（2026-10-15）

本票只改已驗 57 列的程式／測試／工具引用。沒有整理 art、沒有改圖片位元組、沒有接新 runtime。Stage2 核准 v2 留到 M15-04。本票不改畫面行為。

權威對照是 `artifacts/validation/director-m15-20261015/migration-preliminary-hash-audit.json`（57 列，`matches=true`、`exists=true`、新路徑 57 個不重複）。人讀對照是 `docs/stage-art-path-migration-20261015.md`。art manifest 的 SHA 欄位不採用。

機器掃描與 hash 在 `artifacts/validation/grok-m15-art-references-20261015/citation-scan.json`。

## 掃描範圍

讀了 171 個文字檔：`js/**`、`tests/**`、`tools/**`、`index.html`、`service-worker.js`、`assets/img/rain-port/enemies/runtime-manifest-20261014.json`。

未讀：`js/audio.js`、`tools/tts-gemini-25-leda.cjs`、`tools/tts-gemini-aoede.cjs`、`tools/tts-gemini-leda.cjs`。未掃 `docs/**` 與 `art/**` 圖片。`docs/stage-art-path-migration-20261015.md` 與本文件會寫出舊路徑，這是對照紀錄，不是載入器。AGY 清舊檔只看本節的精確路徑規則與 `citation-scan.json` 的 `mayClean`。

比對用完整舊路徑字串，較長路徑蓋過被它包含的較短路徑。目錄前綴不算命中。

結果：canonical 檔 SHA-256 與 audit 57/57 相同；舊檔仍在且 SHA-256 與 audit 57/57 相同。掃描範圍內仍被精確引用 8 條，零引用且兩邊 hash 都等於 audit 的可清舊檔 49 條。

另只對 `art/r4/handpainted-candidates/stage2-enemies/enemies_metadata.json` 搜了路徑字串，沒有 `rework/` 或 `candidate_prop_`。沒有開圖片，沒有採用 manifest SHA 欄。

## 已修改

`js/assets.js`：只加來源註記。`assets/img` loader URL 與 query 維持原字串。註記列出位元組已與 canonical 相同的雨夜港場景檔，並寫明 `O_prop_anchor_gear.webp` 與現役 `prop_anchor_gear.webp` 位元組不同。v2 路徑 `art/stage2-rain-port/scene/G_stone_wood_transition_v2.webp` 只出現在註記，不在載入表。

`tests/stage2-approved-enemies.test.cjs`：四個角色分成 `file`（runtime 檔名）與 `source`（`E_shiome_*`／`B_ikari_*`）。hash 仍是 runtime 位元組對 canonical 位元組。service worker 仍核 runtime 路徑。

`tests/stage3-shrine-buildings.test.cjs`：來源改 `H_shrine_pavilion.webp`、`O_corrupted_sakura.webp`。runtime 路徑與 SHA 斷言保留。

`tests/stage3-ground-transitions.test.cjs`：來源改 `G_mountain_dirt.webp`、`G_sakura_steps.webp`、`G_trans_dirt_to_steps_h.webp`。runtime 路徑、長度與 SHA 斷言保留。

`tests/r6-approved-candidates.acceptance.cjs`：四張 WebP 改指 `H_port_warehouse.webp`、`H_fishmonger.webp`、`G_ground_stone.webp`、`G_ground_wood_dock.webp`。四張 PNG 與 `candidate_awaken_seal.webp` 維持舊路徑。W1／W3 的 SHA 斷言還在。

`tests/spacebunny-stage2-independent.acceptance.cjs`：四張 runtime 另對 `E_`／`B_` canonical。manifest 的 `sha256`／`bytes`／`runtime_path` 斷言保留。不再把舊 `source_candidate_path` 的存在當成通過條件。本檔未執行。

`tests/spacebunny-stage3-ground.acceptance.cjs`：同目錄五張現役 WebP 都配對 canonical。未入表的檔名仍走舊 `candidates/candidate_${檔名}` 公式。原先 `const loader.indexQueries` 是既有語法錯誤（`loader` 已宣告），改成同一表達式的屬性指派。`exactlyThreeRoles === 3` 與 `runtime.length === 3` 沒有放寬。本檔未執行。

`tests/spacebunny-stage3-scene.acceptance.cjs`：神樂殿與古櫻改指 `H_shrine_pavilion.webp`、`O_corrupted_sakura.webp`。hash、尺寸與 service worker 前綴斷言保留。本檔未執行。

`tools/r6-world-cross-edge.cjs`：57 列精確舊路徑零命中，檔案未改。`--check` exit 0。

## 已消除的有效舊引用

開工基準 `program-art-references-start.txt` 裡，下列精確路徑在本次掃描範圍已消失，並進入可清清單：

- `art/stage3-sakura-pass/candidates/candidate_building_shrine_pavilion.webp`
- `art/stage3-sakura-pass/candidates/candidate_landmark_corrupted_sakura.webp`
- `art/stage3-sakura-pass/candidates/candidate_ground_mountain_dirt.webp`
- `art/stage3-sakura-pass/candidates/candidate_ground_sakura_steps.webp`
- `art/stage3-sakura-pass/candidates/transitions/candidate_trans_dirt_to_steps_h.webp`

`tests/stage2-approved-enemies.test.cjs` 已去掉 `stage2-enemies/rework` 這個來源目錄。四張 rework WebP 的完整舊路徑仍在 runtime manifest，不可清。

`tests/r6-approved-candidates.acceptance.cjs` 已去掉四張核准 WebP 的舊路徑。這四條仍被 `tools/r6-art-shots.cjs` 引用，不可清。

## 仍被引用、AGY 不可清的 8 條舊檔

| 舊路徑 | 仍出現於 |
| --- | --- |
| `art/r4/handpainted-candidates/candidate_warehouse.webp` | `tools/r6-art-shots.cjs:542` |
| `art/r4/handpainted-candidates/candidate_fishmonger.webp` | `tools/r6-art-shots.cjs:543` |
| `art/r4/handpainted-candidates/candidate_ground_stone.webp` | `tools/r6-art-shots.cjs:544` |
| `art/r4/handpainted-candidates/candidate_ground_wood.webp` | `tools/r6-art-shots.cjs:545` |
| `art/r4/handpainted-candidates/stage2-enemies/rework/minion_shiome_idle.webp` | `assets/img/rain-port/enemies/runtime-manifest-20261014.json:14` |
| `art/r4/handpainted-candidates/stage2-enemies/rework/minion_shiome_attack.webp` | 同檔 `:32` |
| `art/r4/handpainted-candidates/stage2-enemies/rework/boss_ikari_umibozu_idle.webp` | 同檔 `:50` |
| `art/r4/handpainted-candidates/stage2-enemies/rework/boss_ikari_umibozu_attack.webp` | 同檔 `:68` |

這四支工具／manifest 不在本票可改範圍，所以只回報、未改。

## 未映射、AGY 先不要刪

`tools/r6-world-cross-edge.cjs` 仍開啟：

- `stage2-refine/compat/` 的 `ground_stone_master.webp`、`ground_stone_compat_v1.webp`、`ground_wood_master.webp`、`ground_wood_compat_v1.webp`、`ground_wood_compat_v2.webp`、`ground_trans_stone_wood_h_compat.webp`、`ground_trans_stone_wood_v_compat.webp`、`tiled_preview_4x4_harbor_compat.webp`、`tiled_preview_4x4_stone_compat.webp`、`compat_seam_metrics.json`
- `stage2-enemies/` 非 rework 的 `minion_shiome_idle.png/.webp`、`minion_shiome_attack.png/.webp`、`boss_ikari_umibozu_idle.png/.webp`、`boss_ikari_umibozu_attack.png/.webp`
- `stage2-enemies/enemies_metadata.json`
- 目錄 `art/r4/handpainted-candidates/stage2-enemies`（`readdirSync`，`conceptsPresent` 只要求數量大於 0）

`tests/r6-approved-candidates.acceptance.cjs` 仍讀四張 PNG：`candidate_warehouse.png`、`candidate_fishmonger.png`、`candidate_ground_stone.png`、`candidate_ground_wood.png`。

覺醒印 `art/r4/handpainted-candidates/candidate_awaken_seal.webp` 仍被該測試與 `tools/r6-approved-art-calibration.cjs:64` 引用。

`tools/r6-ground-edge.cjs:6` 只有 `art/r4` 註記，沒有 57 列裡的檔案路徑。未改。

`tests/r6-mutual-edge.acceptance.cjs:160` 引用 `art/audio/aoede-preview/dry-run-report.json`。該路徑不在 57 列。本票沒有開啟該 JSON、沒有跑該測試、沒有改該檔。這份試聽紀錄不可刪。

`tests/spacebunny-stage3-ground.acceptance.cjs` 仍留 `art/stage3-sakura-pass/candidates` 作為未入表檔名的後備。目前 `assets/img/sakura-pass/` 的五張 WebP 都已入表，這條後備在現況目錄不會打開已映射舊檔。以後若該目錄多出未入表的 WebP，後備仍會組舊候選路徑，那些未映射檔先留著。

`tools/r6-art-shots.cjs:267` 會用繪製來源的 basename 去拼 `art/r4/handpainted-candidates/<basename>`。明確點名、必須保留的是上面四張 `candidate_*.webp`。現役 loader 的 basename 與 `candidate_prop_*.webp` 不同。

全部 canonical 新檔、全部 `assets/img` 現役圖都保留。`rework/` 目錄要留，因為四張不可清的 WebP 還在裡面。

## root 重跑通過後，AGY 可清的 49 個舊 source

條件已在本機成立：掃描範圍零精確引用、舊檔存在、舊檔 SHA-256 等於 audit、canonical 新檔 SHA-256 等於 audit。請 root 獨立重跑後再刪。只刪下列舊路徑。對應的 canonical 新檔不准刪。

雨夜港道具舊檔：

- `art/r4/handpainted-candidates/candidate_prop_anchor_gear.webp`
- `art/r4/handpainted-candidates/candidate_prop_cargo_crates.webp`
- `art/r4/handpainted-candidates/candidate_prop_mooring_post.webp`
- `art/r4/handpainted-candidates/candidate_prop_port_boat.webp`
- `art/r4/handpainted-candidates/candidate_prop_port_lighthouse.webp`

`candidate_prop_anchor_gear.webp` 與 canonical `art/stage2-rain-port/scene/O_prop_anchor_gear.webp` 彼此相同（SHA-256 `d003d3e0da38a09211d5acac6a9499ea6096c4ad51c1447e1b164dd50c33f59b`）。現役 `assets/img/rain-port/prop_anchor_gear.webp` 是另一張圖，SHA-256 `2883ceece1aa497a1f0efeaf446cc0f9ea7b672681a364de22766d484d83748e`。清舊候選檔時維持這張現役圖，也不要用 canonical 覆蓋它。

rework 裡可清的是 PNG 與預覽，四張 WebP 不在此列：

- `art/r4/handpainted-candidates/stage2-enemies/rework/boss_ikari_umibozu_attack.png`
- `art/r4/handpainted-candidates/stage2-enemies/rework/boss_ikari_umibozu_idle.png`
- `art/r4/handpainted-candidates/stage2-enemies/rework/minion_shiome_attack.png`
- `art/r4/handpainted-candidates/stage2-enemies/rework/minion_shiome_idle.png`
- `art/r4/handpainted-candidates/stage2-enemies/rework/ikari_umibozu_evolution_audit.png`
- `art/r4/handpainted-candidates/stage2-enemies/rework/ikari_umibozu_idle_vs_attack.png`
- `art/r4/handpainted-candidates/stage2-enemies/rework/ikari_umibozu_overlay_alignment.png`
- `art/r4/handpainted-candidates/stage2-enemies/rework/shiome_evolution_audit.png`
- `art/r4/handpainted-candidates/stage2-enemies/rework/shiome_idle_vs_attack.png`
- `art/r4/handpainted-candidates/stage2-enemies/rework/shiome_overlay_alignment.png`
- `art/r4/handpainted-candidates/stage2-enemies/rework/stage2_rework_scale_comparison.png`

v2 舊檔可清。M15-04 要接的是新檔 `art/stage2-rain-port/scene/G_stone_wood_transition_v2.webp`（SHA-256 `8ba771c198b48fb601cfc3893d702c8e9540c11b3bf3b11e02def9ea91648215`）與同目錄 PNG、三張 `Preview_stone_wood_v2_*.png`。新檔不准刪，也不覆蓋現役地面圖。

- `art/r4/handpainted-candidates/stage2-ground-transition-next/edge-rework/candidate_trans_stone_to_wood_rework.png`
- `art/r4/handpainted-candidates/stage2-ground-transition-next/edge-rework/candidate_trans_stone_to_wood_rework.webp`
- `art/r4/handpainted-candidates/stage2-ground-transition-next/edge-rework/preview_2d_vs_25d_scene_synthesis_v2.png`
- `art/r4/handpainted-candidates/stage2-ground-transition-next/edge-rework/preview_4x4_tiled_shoreline_v2.png`
- `art/r4/handpainted-candidates/stage2-ground-transition-next/edge-rework/preview_before_after_shore_seam_v2.png`

櫻山舊檔：

- `art/stage3-sakura-pass/candidates/candidate_building_shrine_pavilion.png`
- `art/stage3-sakura-pass/candidates/candidate_building_shrine_pavilion.webp`
- `art/stage3-sakura-pass/candidates/candidate_landmark_corrupted_sakura.png`
- `art/stage3-sakura-pass/candidates/candidate_landmark_corrupted_sakura.webp`
- `art/stage3-sakura-pass/candidates/candidate_ground_mountain_dirt.png`
- `art/stage3-sakura-pass/candidates/candidate_ground_mountain_dirt.webp`
- `art/stage3-sakura-pass/candidates/candidate_ground_sakura_steps.png`
- `art/stage3-sakura-pass/candidates/candidate_ground_sakura_steps.webp`
- `art/stage3-sakura-pass/candidates/transitions/candidate_trans_dirt_to_steps_h.png`
- `art/stage3-sakura-pass/candidates/transitions/candidate_trans_dirt_to_steps_h.webp`
- `art/stage3-sakura-pass/candidates/candidate_boss_hana_tengu_idle.png`
- `art/stage3-sakura-pass/candidates/candidate_boss_hana_tengu_idle.webp`
- `art/stage3-sakura-pass/candidates/candidate_minion_sakura_spirit_idle.png`
- `art/stage3-sakura-pass/candidates/candidate_minion_sakura_spirit_idle.webp`
- `art/stage3-sakura-pass/candidates/ground_dirt_vs_steps_seam_check.png`
- `art/stage3-sakura-pass/candidates/scene_contact_sheet.png`
- `art/stage3-sakura-pass/candidates/stage3_scale_comparison_with_player.png`
- `art/stage3-sakura-pass/candidates/terrain-v2/terrain_ground_mountain_dirt_var1.webp`
- `art/stage3-sakura-pass/candidates/terrain-v2/terrain_ground_sakura_steps_var1.webp`
- `art/stage3-sakura-pass/candidates/terrain-v2/terrain_trans_dirt_to_steps_v.webp`
- `art/stage3-sakura-pass/candidates/terrain-v2/terrain_trans_steps_to_dirt_h.webp`
- `art/stage3-sakura-pass/candidates/terrain-v2/terrain_trans_steps_to_dirt_v.webp`

竹林舊檔：

- `art/stage4-bamboo-maze/candidates/candidate_boss_chikuin_meiyo_idle.png`
- `art/stage4-bamboo-maze/candidates/candidate_boss_chikuin_meiyo_idle.webp`
- `art/stage4-bamboo-maze/candidates/candidate_minion_takenoko_spirit_idle.png`
- `art/stage4-bamboo-maze/candidates/candidate_minion_takenoko_spirit_idle.webp`
- `art/stage4-bamboo-maze/candidates/preview_boss_chikuin_meiyo_scale_comparison.png`
- `art/stage4-bamboo-maze/candidates/preview_minion_takenoko_scale_comparison.png`

以上 5+11+5+22+6=49。

## 現役 runtime 與 canonical 的位元組

18 對裡 17 對 SHA-256 相同，且等於 audit。loader 仍讀左欄的 `assets/img` 路徑。

| runtime | canonical | 結果 |
| --- | --- | --- |
| `assets/img/rain-port/port_fishmonger.webp` | `art/stage2-rain-port/scene/H_fishmonger.webp` | 相同 `acf2f337a628680fa77cfd3084db9529ce196e47d69472e7d126bd6527efd734` |
| `assets/img/rain-port/ground_stone.webp` | `art/stage2-rain-port/scene/G_ground_stone.webp` | 相同 `ceca034d36049b004867cd693ed9b1fd080ed4d8060f039c5fc6917729e07e4e` |
| `assets/img/rain-port/ground_wood_dock.webp` | `art/stage2-rain-port/scene/G_ground_wood_dock.webp` | 相同 `6652519e84da76f749e6f5b359ff71cbef7e70cad60dcd336498a82e0ffc265e` |
| `assets/img/rain-port/prop_cargo_crates.webp` | `art/stage2-rain-port/scene/O_prop_cargo_crates.webp` | 相同 `8abe4f889c609cddaa375e26dd44266c68e2bfb5ea113af4901848eb1b889649` |
| `assets/img/rain-port/prop_mooring_post.webp` | `art/stage2-rain-port/scene/O_prop_mooring_post.webp` | 相同 `4dcca1518d8f8ee66d433b7e9ae76f60a2b80e5b60fad5d1d961c0b830da57e9` |
| `assets/img/rain-port/prop_port_boat.webp` | `art/stage2-rain-port/scene/O_prop_port_boat.webp` | 相同 `2179366d582403143c1943264073c8fb2139cf73218a4ec746e9a02e1d752418` |
| `assets/img/rain-port/prop_port_lighthouse.webp` | `art/stage2-rain-port/scene/O_prop_port_lighthouse.webp` | 相同 `70ba1b54f4102edd3edd7729db6146c66ec5036223d75018166146848cb23e88` |
| `assets/img/rain-port/port_warehouse.webp` | `art/stage2-rain-port/scene/H_port_warehouse.webp` | 相同 `d64d8a678af0af6c42d953c01d0ff2081b1d754b84b7ef3cef9d82bfc02b3609` |
| `assets/img/rain-port/enemies/minion_shiome_idle.webp` | `art/stage2-rain-port/characters/E_shiome_idle.webp` | 相同 `ff9442bcd0850b79848d20b426d5be2a70f2cbd29ae64d13d76cf74a3b357bbe` |
| `assets/img/rain-port/enemies/minion_shiome_attack.webp` | `art/stage2-rain-port/characters/E_shiome_attack.webp` | 相同 `e7a5d9d6980f6851ea78d66ba49ce68efca59ac7cfc862f7f42718c6f6cc6551` |
| `assets/img/rain-port/enemies/boss_ikari_umibozu_idle.webp` | `art/stage2-rain-port/characters/B_ikari_idle.webp` | 相同 `5a90500d7b5528ec19d08726ca6e67b1f432e1ef9a5f8573e57d453e6c651d29` |
| `assets/img/rain-port/enemies/boss_ikari_umibozu_attack.webp` | `art/stage2-rain-port/characters/B_ikari_attack.webp` | 相同 `6abeef6cbd3c6cb1585b193375b9159d2b1888b5e270007cc0f83b3fde8e162c` |
| `assets/img/sakura-pass/shrine_pavilion.webp` | `art/stage3-sakura-pass/scene/H_shrine_pavilion.webp` | 相同 `835fe17a73cf1af48bc2fc25cdf9cd7b155c7248423dc81075f079bfd869b22e` |
| `assets/img/sakura-pass/landmark_corrupted_sakura.webp` | `art/stage3-sakura-pass/scene/O_corrupted_sakura.webp` | 相同 `7dd88ec8213577690972f2e6dbd4670ad703562a1a52f024d723db0cd799c7d2` |
| `assets/img/sakura-pass/ground_mountain_dirt.webp` | `art/stage3-sakura-pass/scene/G_mountain_dirt.webp` | 相同 `882135a378a7d9c889953fb5f4d0837d4ae87b8607bae776a5bef489edf86765` |
| `assets/img/sakura-pass/ground_sakura_steps.webp` | `art/stage3-sakura-pass/scene/G_sakura_steps.webp` | 相同 `6935c527db400bb57cf70038d5555d2f063bafb84091fa7df167459914568a6b` |
| `assets/img/sakura-pass/ground_trans_dirt_to_steps_h.webp` | `art/stage3-sakura-pass/scene/G_trans_dirt_to_steps_h.webp` | 相同 `262462da95d8172e888fd191c265b6ec3492702dd3291606f3ea25a2ad73195c` |
| `assets/img/rain-port/prop_anchor_gear.webp` | `art/stage2-rain-port/scene/O_prop_anchor_gear.webp` | 不同。runtime `2883ceece1aa497a1f0efeaf446cc0f9ea7b672681a364de22766d484d83748e`；canonical `d003d3e0da38a09211d5acac6a9499ea6096c4ad51c1447e1b164dd50c33f59b` |

其餘 39 列沒有現役 loader，只核了 canonical 與舊檔都等於 audit。完整列在 `citation-scan.json` 的 `rows`。

## 靜態

九個獨占檔 `node --require ./tools/director-audio-freeze.cjs --check` 都是 exit 0。地面 acceptance 加上兩張場景配對後再 `--check`，exit 0。紀錄：`artifacts/validation/grok-m15-art-references-20261015/syntax-check.txt`。

`loadGameArt` 不含 `handpainted-candidates`（W4 通過）。`assets.js` 不含 `candidate_awaken_seal`（P2 通過）。`assets/img/sakura-pass/` 仍是原有五處 loader 字串（三張地面、神樂殿、古櫻），註記沒有再增加這個子字串。

## 測試

安全 node:test：

`node --require ./tools/director-audio-freeze.cjs --test tests/stage2-approved-enemies.test.cjs tests/stage3-shrine-buildings.test.cjs tests/stage3-ground-transitions.test.cjs`

exit 0，18 pass，0 fail，duration_ms 210.0637。紀錄：`stage-node-tests.txt`。

R6 的 P／W：

`node --require ./tools/director-audio-freeze.cjs --test --test-name-pattern ^[PW] tests/r6-approved-candidates.acceptance.cjs`

exit 1。P1、P2、W2、W4、W5 通過。P1 解出的 WebP 前綴與 audit 一致：倉庫 `d64d8a678af0af6c`、魚舖 `acf2f337a628680f`、青石 `ceca034d36049b00`、木棧 `6652519e84da76f7`。

W1 在 SHA 迴圈之前失敗。`refreshPortArt` 本體是 `loadPortSprites(Object.keys(portCatalog())); loadPortEnemies();`，斷言 `/fishmonger/` 對不上。魚舖字串在 `RAIN_PORT_FISH`，由 `portCatalog()` 併入。這是既有源碼形狀，本票沒有改 renderer，也沒有改這條 regex。SHA 斷言仍在第 166–177 行，這次沒跑到。

W3 在 SHA 斷言之前失敗。`paintPortShore` 使用 `portGroundPick("wood")`，斷言要的是 `/PORT_ART\?\.dock/`。這是既有繪製寫法。SHA 斷言仍在第 228–230 行，這次沒跑到。H1、S1、S2 沒有啟動。

三支 Space Bunny acceptance 會寫歷史證據並開 Chrome，本票完全沒執行：

- `tests/spacebunny-stage2-independent.acceptance.cjs` 會寫 `artifacts/validation/spacebunny-r7-20261014`
- `tests/spacebunny-stage3-ground.acceptance.cjs` 會寫 `artifacts/validation/spacebunny-r9-stage3-ground-20261014`
- `tests/spacebunny-stage3-scene.acceptance.cjs` 會寫 `artifacts/validation/spacebunny-r10-stage3-scene-20261014`

若日後跑地面檔的 staticChecks，有兩項既有紅，本票沒有放寬：`assets/img/sakura-pass/` 現有 5 處，`exactlyThreeRoles` 仍期待 3；該目錄現有 5 張 WebP，`runtime.length === 3` 仍保留。沒有跑 media-cache builder，沒有跑會讀音訊的舊 acceptance。

## 部署

未 Commit／未 Push／未 Deploy。部署門仍 BLOCKED。M15-04 的 renderer／loader 接線本票沒有開始。

## Root QA 增量（沿用，未重跑）

`artifacts/validation/director-m15-20261015/references-focused-preliminary.json` 的 `exitCode` 是 0、`stable` 是 true。同目錄 `.log` 是 tests 41、pass 41、fail 0、skipped 0、todo 0、duration_ms 250.4912。範圍是 `tests/assets-loading.test.cjs` 加上三支來源測試。

交卷當下這五個檔的 SHA-256 與該 JSON 全相同，所以不重跑這 41 項，也不跑 731：

- `js/assets.js` `BB9763D6610621FA54BE5970F85C9F7A547B01774D0AA3FD920C65D1975BB07C`
- `tests/stage2-approved-enemies.test.cjs` `9442D1933364394EC4251DBE7E950D0FEA21307E040EADD99F87FCF064E59A19`
- `tests/stage3-shrine-buildings.test.cjs` `EECC32969EA903F412CBBD89CC00B48CD2AC3807D4B1F2723B3485E383826442`
- `tests/stage3-ground-transitions.test.cjs` `3CB4CFD42FD90D96305176085057DC128B73EC2E1F977E5DCD26BC911162DE1E`
- `tests/assets-loading.test.cjs` `0E1C0B76821051C7B2D7E35EFD32A221B02256994FD1E438D3EB5D57461909C8`

這次增量沒有改這五個檔，也沒有改圖、沒有削 SHA 斷言、沒有改 W1／W3 或其他歷史 acceptance 語義。

錨既有差異維持記錄：canonical `art/stage2-rain-port/scene/O_prop_anchor_gear.webp` 為 `d003d3e0da38a09211d5acac6a9499ea6096c4ad51c1447e1b164dd50c33f59b`；現役 `assets/img/rain-port/prop_anchor_gear.webp` 為 `2883ceece1aa497a1f0efeaf446cc0f9ea7b672681a364de22766d484d83748e`。loader URL 仍是現役檔。

AGY 正在補完整 194 圖 mapping。已鎖定的 57 條舊／新路徑不變。

## 收斂

語法：九個獨占 JS／CJS 先前 `--check` exit 0。本增量未再改它們。

已改：`js/assets.js` 註記；三支來源測試的 canonical 配對；`tests/r6-approved-candidates.acceptance.cjs` 的四張 WebP；三支 Space Bunny 的來源配對（地面檔另含 `loader.indexQueries` 語法修復與五張櫻山配對）。`tools/r6-world-cross-edge.cjs` 未改。`tests/assets-loading.test.cjs` 未改。

仍引用、不可清的 8 條舊檔：`tools/r6-art-shots.cjs` 的倉庫、魚舖、青石、木棧四張 WebP；runtime manifest 的四張 rework WebP（潮子 idle／attack、怒海坊主 idle／attack）。

未映射先留：compat 全套、非 rework 敵人母版、`enemies_metadata.json`、`compat_seam_metrics.json`、四張 PNG、覺醒印、`tests/r6-mutual-edge.acceptance.cjs` 指向的 `art/audio/aoede-preview/dry-run-report.json`。49 條可清舊 source 仍以本文件上一節與 `citation-scan.json` 的 `mayClean` 為準，等 root 認可後再由 AGY 刪。canonical 新檔與 `assets/img` 現役圖都留。

## M15-04 runtime 交接

本票到此結束。下一票只接 Stage2 核准 v2，做成新的 runtime 檔，不覆蓋現役地面圖。

- 來源鎖定 `art/stage2-rain-port/scene/G_stone_wood_transition_v2.webp`，SHA-256 `8ba771c198b48fb601cfc3893d702c8e9540c11b3bf3b11e02def9ea91648215`。同目錄 PNG `G_stone_wood_transition_v2.png` 為 `7fdfd8e8ee7269aa33079d8650b12dca4540d5fe94836ce6cbb58af9c10b3256`。
- 岸是 `cy` 奇數。只用原圖與垂直翻轉，鋪兩條水平縫：奇數塊內部是石北／木南，奇數塊底緣是木北／石南。不接直向、角或斜向。
- 缺圖不畫幾何。Stage1／Stage3 隔離。要新的 Chrome 連續截圖。美術人審與部署門分開。
- 不改錨圖，不削既有 SHA 契約，不借這張票去改 W1／W3 的歷史 regex。57 條路徑維持鎖定。音訊凍結仍在。

## 完整引用收尾（2026-10-15 補充）

AGY 全表 `m15-full-migration-manifest.json`：in_scope 194、out_scope 47。root `full-migration-root-audit.json` 的 192 條保留列 SHA／MD5 一致；兩條 hashFailures 是已刪除的拒稿紀錄，沒有新路徑，本票未動。先鎖定的 57 條仍然有效。

本輪只改來源路徑文字。27 條精確舊路徑（`full-migration-exact-code-refs.json`）在 `js/`、`tests/`、`tools/`、`index.html`、`service-worker.js`、runtime manifest 的再掃描是 0 命中。四支 CJS `--check` exit 0。manifest `JSON.parse` 成功。五個核心檔 SHA 仍與 root 41 快照相同，未重跑。

已改：

- `tools/r6-art-shots.cjs` 四個 WebP literal 改指 `H_port_warehouse`、`H_fishmonger`、`G_ground_stone`、`G_ground_wood_dock`。
- `assets/img/rain-port/enemies/runtime-manifest-20261014.json` 四個 `source_candidate_path` 改指 `E_shiome_idle`、`E_shiome_attack`、`B_ikari_idle`、`B_ikari_attack`。`runtime_path`、bytes、sha256、錨點、說明都沒改。改前四組 manifest SHA 與 runtime、canonical 位元組一致，沒有為了 metadata 改圖。`approval_record.scope` 仍是歷史註記，裡面只有 rework 目錄文字，不是四個檔名。
- `tools/r6-world-cross-edge.cjs`：compat 九圖改指 `G_*`／`Preview_tiled_4x4_*`；舊 v1 角色八圖改指 `E_shiome_*_v1`、`B_ikari_*_v1`。v1 的 SHA 與對應核准 rework（無 `_v1`）不同，沒有用核准稿替換。
- `tools/r6-approved-art-calibration.cjs` 的故障注入來源改指 `O_prop_awaken_seal.webp`。被替換的 runtime URL regex 沒改。
- `tests/r6-approved-candidates.acceptance.cjs` 四張 PNG 與覺醒印改指同名 canonical。`candidate_awaken_seal` 的否定斷言還在。W1／W3 regex 沒改。

這 27 條加上 manifest 四條不再是 mustKeep。映射內、且程式已無完整舊路徑的舊 source，可交 AGY 移轉收尾。47 條 out_scope 不動。

仍留在程式、不在那 27 條裡，AGY 先不要刪：

- `tools/r6-world-cross-edge.cjs` 仍 `readdir` `art/r4/handpainted-candidates/stage2-enemies`，並讀 `enemies_metadata.json`、點名 `compat_seam_metrics.json`。這三條不在 194 的 in_scope 路徑字串裡。
- `tools/r6-art-shots.cjs` 仍會用繪製 basename 去拼 `art/r4/handpainted-candidates/<basename>`。這不是四個已改 literal。
- `tests/spacebunny-stage3-ground.acceptance.cjs` 對未入表檔名仍留 `art/stage3-sakura-pass/candidates` 後備。
- `tests/r6-mutual-edge.acceptance.cjs` 的 `art/audio/aoede-preview/dry-run-report.json` 未打開、未改。

錨的 source／runtime 差異、現役 `assets/img` URL、圖片位元組都沒動。最終短清單在 `docs/m15-art-reference-remaining-20261015.md`。M15-03 結束，下一張接 Stage2 v2 runtime。
