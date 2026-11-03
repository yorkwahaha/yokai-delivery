# Yokai Delivery — 130 份歷史測試完整分流（2026-11-04）

原始 commit f88362b 的 130 份歷史測試逐檔實跑：37 份全過，93 份失敗或超時；共 974 項、366 項失敗。

## 結果

- 59 份已移回 npm test，所有移回的檔案均單獨測過並由整體現行回歸驗證。
- 71 份已逐檔歸類，保留原始碼及 opt-in 的 legacy 測試通道。它們不是綠燈，也不是確認無 bug。
- 原測試數字、失敗訊息、每檔處置與替代防線記錄於 TEST_TRIAGE_20261104.json。

| 歷史類型 | 份數 | 理由 |
|---|---:|---|
| frozen | 3 | 鎖定歷史版本的實驗或 UI 快照，不應作為當前發布規格 |
| review | 13 | 重要整合行為但原測試框架不再有效，需改成有時間上限的現行 runtime 測試 |
| future | 9 | 第三至八關規畫或尚未發布的場景材質提案，與正式關卡資產不同 |
| asset | 17 | 使用已清理的未提交原稿／舊清冊與候選路徑，應查正式媒體清冊 |
| ui | 8 | 歷史 HUD/UI 像素、配色與原始碼字串要求已被新美術及佈局取代 |
| fusion | 16 | 融合、試做圖或 DEV 閘門已非正式六招的發布要求 |
| runtime | 5 | 舊版數值／升級流程或未更新的 VM 載入器，與拆分後規則不相符 |

## 保留審核項

原本高風險測試包含錯誤的 VM 載入順序、過時的融合規格、漏傳 target 的觸控模擬、未提交原圖與超時的全場移動迴圈。封存是明示分流，不是改成假綠；若重新啟用該功能，需建立符合現行 runtime 且有時間上限的測試。

## 歷史檔案清單

| 檔案 | 分類 | 原始通過／總數 | 清理依據 |
|---|---|---:|---|
| agy-m1-c.test.cjs | runtime | 7/11 | 舊版數值／升級流程或未更新的 VM 載入器，與拆分後規則不相符 |
| agy-m1-d.test.cjs | runtime | 42/88 | 舊版數值／升級流程或未更新的 VM 載入器，與拆分後規則不相符 |
| agy-m1-g.test.cjs | runtime | 3/7 | 舊版數值／升級流程或未更新的 VM 載入器，與拆分後規則不相符 |
| agy-m1-integration.test.cjs | review | 超時 | 原策略全場模擬超時，未限制最大步數 |
| agy-m1-n2.test.cjs | runtime | 1/3 | 舊版數值／升級流程或未更新的 VM 載入器，與拆分後規則不相符 |
| agy-m1-runtime.test.cjs | review | 7/14 | 重要整合行為但原測試框架不再有效，需改成有時間上限的現行 runtime 測試 |
| agy-m1-stage1-balance.test.cjs | review | 5/9 | 重要整合行為但原測試框架不再有效，需改成有時間上限的現行 runtime 測試 |
| agy-stage-content-check.test.cjs | future | 5/6 | 第三至八關規畫或尚未發布的場景材質提案，與正式關卡資產不同 |
| b-stage-content.test.cjs | future | 0/1 | 第三至八關規畫或尚未發布的場景材質提案，與正式關卡資產不同 |
| b6-night-town-polish-20261031.test.cjs | ui | 5/6 | 歷史 HUD/UI 像素、配色與原始碼字串要求已被新美術及佈局取代 |
| b7-omamori-and-ui-20261031.test.cjs | ui | 3/7 | 歷史 HUD/UI 像素、配色與原始碼字串要求已被新美術及佈局取代 |
| b8-passive-caps-and-seal-20261101.test.cjs | ui | 3/5 | 歷史 HUD/UI 像素、配色與原始碼字串要求已被新美術及佈局取代 |
| b9-art-and-cargo-20261101.test.cjs | asset | 1/4 | 使用已清理的未提交原稿／舊清冊與候選路徑，應查正式媒體清冊 |
| boss-image-qa-r1.test.cjs | asset | 9/15 | 使用已清理的未提交原稿／舊清冊與候選路徑，應查正式媒體清冊 |
| codex-s1-difficulty.test.cjs | review | 超時 | 舊完整難度模擬超時，沒有已驗證的正式回歸 |
| delivery-media-routes.test.cjs | asset | 1/2 | 使用已清理的未提交原稿／舊清冊與候選路徑，應查正式媒體清冊 |
| delivery-v3.test.cjs | asset | 3/7 | 使用已清理的未提交原稿／舊清冊與候選路徑，應查正式媒體清冊 |
| director-media-image-revisions.test.cjs | asset | 0/1 | 使用已清理的未提交原稿／舊清冊與候選路徑，應查正式媒體清冊 |
| e15-r16-harness-calibration.test.cjs | review | 0/1 | 重要整合行為但原測試框架不再有效，需改成有時間上限的現行 runtime 測試 |
| fusion-art-ui-20261023.test.cjs | frozen | 1/1 | 1/1 過關但為已退役的融合 DEV 美術候選 |
| fusion-dual-realgame.test.cjs | fusion | 0/5 | 融合、試做圖或 DEV 閘門已非正式六招的發布要求 |
| fusion-fan-hud-20261025.test.cjs | fusion | 13/14 | 融合、試做圖或 DEV 閘門已非正式六招的發布要求 |
| fusion-replace-20261025.test.cjs | fusion | 0/8 | 融合、試做圖或 DEV 閘門已非正式六招的發布要求 |
| fusion-thundercircle-visibility-r5.test.cjs | fusion | 2/6 | 融合、試做圖或 DEV 閘門已非正式六招的發布要求 |
| fusion-vfx-visible-20261025.test.cjs | fusion | 3/14 | 融合、試做圖或 DEV 閘門已非正式六招的發布要求 |
| fusion-visual-qa-r2.test.cjs | fusion | 0/4 | 融合、試做圖或 DEV 閘門已非正式六招的發布要求 |
| grok-d1-foxiai-direction.test.cjs | fusion | 0/2 | 融合、試做圖或 DEV 閘門已非正式六招的發布要求 |
| grok-d2-array-phase.test.cjs | fusion | 0/2 | 融合、試做圖或 DEV 閘門已非正式六招的發布要求 |
| grok-d3-boss-image.test.cjs | asset | 0/2 | 使用已清理的未提交原稿／舊清冊與候選路徑，應查正式媒體清冊 |
| grok-m1-e-r11.test.cjs | fusion | 0/3 | 融合、試做圖或 DEV 閘門已非正式六招的發布要求 |
| grok-m1-e-r12.test.cjs | review | 超時 | 歷史融合全場模擬超時，且正式融合已停用 |
| grok-m2-omamori-core-r3.test.cjs | review | 3/5 | 重要整合行為但原測試框架不再有效，需改成有時間上限的現行 runtime 測試 |
| input-runtime.test.cjs | review | 103/161 | 103/161 通過；58 項包括舊提示、三變異限制、未設 target 的 pointer 夾具，不等於 58 項正式缺陷 |
| kilo-m2-stage2-motion.test.cjs | future | 0/1 | 第三至八關規畫或尚未發布的場景材質提案，與正式關卡資產不同 |
| kilo-stage-flow.test.cjs | future | 0/1 | 第三至八關規畫或尚未發布的場景材質提案，與正式關卡資產不同 |
| kilo-stage3-8-flow.test.cjs | future | 0/1 | 第三至八關規畫或尚未發布的場景材質提案，與正式關卡資產不同 |
| m2-fusion-art-bind-r1.test.cjs | fusion | 2/5 | 融合、試做圖或 DEV 閘門已非正式六招的發布要求 |
| muse-m1-stagemeta.test.cjs | ui | 0/2 | 依賴未合入的 STORY.get() Boss 稱號方案；正式使用 boss.title 回退 |
| night-town-a-common-kanji-free.test.cjs | asset | 1/2 | 使用已清理的未提交原稿／舊清冊與候選路徑，應查正式媒體清冊 |
| night-town-approved-fish.test.cjs | asset | 3/4 | 使用已清理的未提交原稿／舊清冊與候選路徑，應查正式媒體清冊 |
| night-town-kanji-fish-voices.test.cjs | asset | 0/4 | 使用已清理的未提交原稿／舊清冊與候選路徑，應查正式媒體清冊 |
| opencode-m2-fusion-runtime.test.cjs | fusion | 0/8 | 融合、試做圖或 DEV 閘門已非正式六招的發布要求 |
| opencode-m2-fusion-ui.test.cjs | fusion | 4/5 | 融合、試做圖或 DEV 閘門已非正式六招的發布要求 |
| playtest-r15-stage1-visual-20261029.test.cjs | asset | 2/4 | 使用已清理的未提交原稿／舊清冊與候選路徑，應查正式媒體清冊 |
| playtest-r16-water-shield-ring-20261029.test.cjs | asset | 3/4 | 舊版盾牌透明度／顯示位置畫稿，須依現行 renderer 確認 |
| playtest-r7-ui.test.cjs | ui | 1/3 | 歷史 HUD/UI 像素、配色與原始碼字串要求已被新美術及佈局取代 |
| playtest-r9-ui.test.cjs | ui | 1/4 | 歷史 HUD/UI 像素、配色與原始碼字串要求已被新美術及佈局取代 |
| r12-assets-loader.test.cjs | asset | 4/6 | 使用已清理的未提交原稿／舊清冊與候選路徑，應查正式媒體清冊 |
| r12-boss-canonical-kilo.test.cjs | asset | 9/12 | 使用已清理的未提交原稿／舊清冊與候選路徑，應查正式媒體清冊 |
| r12-shared-art-manifest.test.cjs | asset | 0/3 | 舊版全面列入十融合候選與原圖，與正式 runtime-art-manifest 發布定義不同 |
| r12-ui-canonical.test.cjs | frozen | 4/4 | 4/4 過關但為 R12 舊 UI 定稿，現行由 B13/B16 覆蓋 |
| rain-port-delivery-trial.test.cjs | asset | 1/3 | 使用已清理的未提交原稿／舊清冊與候選路徑，應查正式媒體清冊 |
| s2-ground-kit-contract.test.cjs | asset | 0/1 | 需要未提交的 S2 art/ 原始圖，發行時應查正式 WebP |
| sakura-terrain-plan.test.cjs | future | 2/3 | 尚未接線的程序化地面計畫；正式第三關採核准石階／泥土材質 |
| spacebunny-m1-g-return.test.cjs | review | 2/5 | 重要整合行為但原測試框架不再有效，需改成有時間上限的現行 runtime 測試 |
| spacebunny-m1-p0.test.cjs | runtime | 1/3 | 舊版數值／升級流程或未更新的 VM 載入器，與拆分後規則不相符 |
| spritecook-dev.test.cjs | asset | 0/6 | 使用已清理的未提交原稿／舊清冊與候選路徑，應查正式媒體清冊 |
| stage-art-reset-20261024.test.cjs | future | 1/5 | 第三至八關規畫或尚未發布的場景材質提案，與正式關卡資產不同 |
| stage2-approved-enemies.test.cjs | review | 5/11 | 舊普通模式潮汐波已停用以免與射擊疊加；原最終王測試使用不準確的快轉夾具 |
| stage3-ground-transitions.test.cjs | future | 0/4 | 第三至八關規畫或尚未發布的場景材質提案，與正式關卡資產不同 |
| stage3-shrine-buildings.test.cjs | future | 1/4 | 第三至八關規畫或尚未發布的場景材質提案，與正式關卡資產不同 |
| system-a-fusion-playable.test.cjs | fusion | 0/9 | 融合、試做圖或 DEV 閘門已非正式六招的發布要求 |
| system-delivery-distance-r1-distance.test.cjs | review | 2/6 | 480~1650px 與隔屋規則已拆到 game-delivery-rules.js；舊測試僅比對原 game.js 字串 |
| ui-polish-r1.test.cjs | fusion | 6/10 | 融合、試做圖或 DEV 閘門已非正式六招的發布要求 |
| ui-polish-r3.test.cjs | fusion | 2/7 | 融合、試做圖或 DEV 閘門已非正式六招的發布要求 |
| ui-polish-r4.test.cjs | fusion | 1/2 | 融合、試做圖或 DEV 閘門已非正式六招的發布要求 |
| ui-readability.test.cjs | ui | 32/50 | 歷史 HUD/UI 像素、配色與原始碼字串要求已被新美術及佈局取代 |
| v3-baseline.test.cjs | frozen | 12/12 | 12/12 過關但鎖定 V3 歷史版基線，只可用於歷史對照 |
| v3-growth-accounting.test.cjs | review | 2/3 | 重要整合行為但原測試框架不再有效，需改成有時間上限的現行 runtime 測試 |
| v3-route.test.cjs | review | 超時 | 歷史真步行測試 12 秒超時，無 bounded frame 上限 |
| v3-ui.test.cjs | ui | 7/13 | 歷史 HUD/UI 像素、配色與原始碼字串要求已被新美術及佈局取代 |
