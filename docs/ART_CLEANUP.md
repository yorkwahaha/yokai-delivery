# Yokai Delivery｜舊素材清理、短檔名與遷移稽核

版本 1.0｜2026-10-21｜**本輪為實際檔案盤點與非破壞整理**。不移動／刪除 source、manifest 連結或現役程式引用；只有使用者明確核定白名單且核實零引用後才能搬入可還原封存。

## 1. 這次真實盤點（唯讀事實）
- `art/` 約 **1051 個非音訊檔**（含 JSON/MD），其中圖片 PNG/WebP/JPG 約 **831 張**。畫面為當次快照，不要當永遠固定數字。
- 核心累積：`stage2-rain-port/` 約 **373 檔／344.9 MiB**；`stage8-yomi/` 約 **283 檔／289.6 MiB**；`stage3-sakura-pass/` 約 **92 檔／140.3 MiB**，為減少尋檔時間的重點。
- 依**實檔長度+ SHA256** 確認 **11 組圖片位元組完全相同，11 份冗餘副本**。僅證明資料相同，**不證明哪份無引用／可刪**，記為 `DUPLICATE_REVIEW`。

### 相同檔案例（各 pair 必須分別查 manifest／source／JS／docs 引用）
1. `art/stage2-rain-port/production-s2/tiles/stone/tile_stone_canonical.png` = `.../tile_stone_var1.png`（557412 B）；其 WebP 也是一對（97274 B）。
2. `art/stage2-rain-port/production-s2/tiles/wood/tile_wood_dock_canonical.png` = `.../tile_wood_dock_var1.png`（530839 B）；其 WebP 也是一對（100108 B）。
3. `art/fusion/candidates/fusion_inkblade/banana_inkblade_alpha_candidate_v01.webp` = 同資料夾 `main_alpha_candidate_v01.webp`（212012 B）；其中任何一名可能是 consumer 的指定名稱。
4. `art/stage8-yomi/sliced/prop_7.png` = `art/stage8-yomi/sliced_v2/clean_prop_2.png`（29969 B）；`prop_9` = `clean_prop_3`（29071 B）；`prop_6` = `clean_prop_1`（22368 B）；`prop_5` = `clean_prop_0`（20850 B）；`prop_10` = `clean_prop_7`（14977 B）；`prop_11` = `clean_prop_8`（13444 B）。
- 完整 SHA 可由下次 Agent 針對**此 11 組**重算；不應把名稱相似但 bytes 不同的美術稿誤歸為重複。

## 2. 明確歷史／保留／待整理分類
| 範圍 | 本輪處置 | 原因 |
|---|---|---|
| `assets/img/`、正在載入的 `art/stage*/scene/`、核准地圖 | **PRESERVE** | 現役與批准來源，移動將破壞 runtime |
| `art/stage2-rain-port/production-s2-nano-20261020/` | **PRESERVE + REVIEW** | S2 18張原稿衍生與真頁證據，現仍候選／dev integration |
| `art/stage2-rain-port/s2-ground-redraw-20261021/` | **HISTORY_KEEP** | v2/v3 失敗 QA、付費帳本、母圖與真原始出圖不可無證刪 |
| `art/stage2-rain-port/s2-stone-methodb-20261021/`、`handoff-p5-r1/` | **HISTORY_KEEP / ART_FAIL** | 演算法實驗有不合格診斷但要保留可追溯 QA |
| `art/batch1a-nb21-prep-20261020/`／`batch1a-nb21-review-20261020/` | **PRESERVE** | 八關 prompts、成本、A/B 視覺審核入口 |
| `art/stage8-yomi/sliced/`、`sliced_v2/` | **DUPLICATE_REVIEW** | 部分相同 bytes，但單體仍待拆件合法性與實際引用 |
| `art/fusion/candidates/` | **PRESERVE / DUPLICATE_REVIEW** | 融合技有獨立付費生成、alpha 衍生與模型來源需保留 |
| `art/stage_asset_production_v1/`、`art/review/` | **PRESERVE_HISTORY** | QA／人工候選和歷史視覺分歧，需更新入口而非直接砍 |
| `art/stage3-.../` 早期被退巨石庭院、`art/stage4-.../` 被退黑竹泥／巨葉 | **REJECTED_REFERENCE_ONLY** | 使用者拒收；保留已核准現役、未判怪物與證據；**不得刪整關資料夾** |
| `docs/*20261014*.md` 與舊 roadmap 執行板 | **HISTORY_DOC** | 長日期文檔仍可能被證據引用，不搶改 Codex 權威文 |
| `.cleanup-archive/2026-10-10/` | **PRESERVE_EXISTING_ARCHIVE** | 既有可還原封存，舊清理 manifest 見 `docs/project-cleanup.md` |

**實際清理效果**：本輪新增 **四份短文件＋一份 `art/README.md` 入口**，未搬刪上述原檔，不更改 runtime/音訊/圖像字節；將「已拒收」、「待選」、「已審」、「正式」清楚區分，先解決尋檔混亂及下輪生成亂命名。

## 3. 之後新素材的簡化檔名（**自本輪起**）
- 新候選只放**單層** `art/sN/`，不要層層 `stage-name/production-date/tiles/type/review/...`。
- 語意簡短前綴：**g** ground、**t** transition、**d** decal、**h** house、**o** object、**e** enemy、**b** boss、**p** preview；格式 `<type>_<subject>_<nn>.png`，動作 `e_ghost_idle_01.png`。
- 好的例子：`art/s2/g_stone_01.png`、`art/s2/t_stone_wood_h01.png`、`art/s3/h_shrine_01.png`、`art/s8/p_ash_6x6.png`。**長檔名都不再複製年份／模型名／候選註記**。
- `art/sN/manifest.json` 負責繁瑣資訊：`id,path,category,stage,version,status,model,prompt_id,source_paths,source_sha256,sha256,size_px,has_alpha,light,view,foot_anchor,depth_layer,created_at,cost_estimated,cost_actual,reviewer,reviewed_at,replaces`；unknown 記 null、不可捏造。
- Model prompt 與付費 request 原文仍需留底，但在**一份 stage manifest 或一份頂層 `art/prompts.json`**，不再逐張建 `20261021_a/b/final_final_v2_request...txt`。已有帳本和 API 原始 JSON **不搬不改**。
- 短檔名是**新增稿政策，不是舊資產破壞性改名要求**；新路徑 runtime loader 未必識別，接線另立 ticket。

## 4. 後續可授權的分批清理 Gate（**本輪不執行**）
1. 檢查現役 Herdr panes、所有 manifest、Markdown 引用、JS loader、HTML/CSS 引用、preview、tests 和 staged/dirty；**不得只用 basename grep 判無引用**。
2. 每個候選對比 bytes+SHA、審圖狀態及來源，選定主件；保留 source 原圖和付費交易 ledger，拒收稿保留文字證據。
3. 先產生**逐檔白名單提案**（原路徑→待存 `.cleanup-archive/<date>/...`、sha、引用數、是否 dirty/ignored、回復指令），交 Codex／使用者核可。
4. 合格且不影響任何 consumer 才以**可還原移動**處理；搬前及搬後 SHA 一致，試跑關聯 focused tests；不刪未知大圖、禁止 reset／clean。
5. 遇有任何引用／不確定來源、已核准藝術、失敗 QA 證據、付費原稿/metadata、近期 working Agent 寫檔 → **BLOCKED, KEEP**。
6. 整理使用者常找的圖，優先更新 `art/README.md` 一頁導航與 previews；真正節省磁碟空間需另獲永久刪除權，不把搬到 archive 當釋放空間。

## 5. 優先清理次序（下一輪才啟動）
A. 先從**Stage2 舊 production-s2 兩對 PNG+WebP duplicates**（4 組）與 Stage8 sliced 6 組做**零引用核查**；B. 再核 fusion 1 組；C. 同類保留已核准和付費母稿，整理預覽入口；D. 最後整理歷史 docs。**避免一開始就搬 300+ 張圖**。

## 6. Agent 交接硬性守門
- 先讀 `AGENTS.md`、`roadmap.md` 頂部、`art/README.md`、`docs/ART_STYLE.md`，相關 A/B 文件按需讀。
- 系統開發三條線（融合、平衡、HUD）在寫 JS 時，藝術整理 Agent **只寫文檔與新 art/sN 候選**；不得趁機重構 loader/index、修改權威 roadmap 或偷換美術。
- 禁 API 付費／未授權模型替代／讀 key、音訊/TTS/BGM；禁止 git add -A/add ./reset/clean/checkout/commit/push/deploy。
