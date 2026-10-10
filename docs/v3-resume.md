# V3 暫停與接續紀錄

2026-10-10：使用者要求在目前段落收尾、讓四位 Agent 休息，待額度恢復再續。此次只保存本機 WIP，禁止把此 checkpoint 當作可部署版本。整體完成度粗估 **70%**，依功能實作、整合、獨立驗收與部署工作估算，非測試通過率。

## 已修改／已驗證

1. AGY 的 config、evolutions、store、words、boss-ai 模組已提交；固定首領時間與 HP、配送印章、錯詞間隔、共用碎冰預算及首領預告／收招已加入。
2. Grok 的 game.js 主體已寫入，含六技能調整、配送回饋、讀題保護、六單加終王結算、三詞朗讀回顧。此檔仍是未完成整合的 WIP。
3. Codex 的介面、教學文案、載入順序與字型子集工具修正已保存；瀏覽器受控情境確認免費首次提示、錯答一次扣六油、原單補送與首領讀題凍結。截圖不是自然通關證據，且遊戲 harness 來源尚須在最終修正後重建。
4. 已由 Codex 獨立核對：已知正確 baseline da98b4b 為 392/392 PASS；核心／study／baseline 組 53/53 PASS；UI／source／V3 UI 組 64/64 PASS；模組舊回歸 37/37 PASS；首領 AI 11/11 PASS；字型工具 1/1 PASS。各組有範圍差異，不合併冒稱全套通過。
5. 最後廣域回歸紀錄為 478 項、406 PASS、72 FAIL，之後已修部分舊預期，但尚未重跑全套。契約測試先前為 17/19 PASS，再新增第 20 項「未接觸首領詞先介紹」並觀察到 RED。尚未全綠。
6. Codex 獨立木樁：三種子 × 十五組四 MAX 配裝共 45 筆，1400 HP、B2.4、無入傷控制，擊殺 23.1–43.52 秒。這不是含走位、入傷或配送的實戰結果。模組覆蓋率只涵蓋選定模組，不能代表全專案。
7. 暫停收尾時，game.js、ui.js、game-runtime helper、input-runtime 舊回歸、兩支 V3 工具的 node --check 皆退出碼 0；git diff --check 退出碼 0。本次不展開新一輪測試。

## 尚待完成，按接續順序

1. 先確認 game.js 最終單一作者。Grok 已交回 WIP，Codex 可接最終整合；接手前透過 Herdr 明確鎖定責任，避免共寫。
2. 修 MAX 刀波：命中同時限制距發射原點 ≤720、方向角差 ≤1.22，保留穿牆、六敵上限與前三全傷／後三各 0.75；目前後方及超距離契約測試 RED。
3. study session 存在而 pick 回 null 時不發單，不能 fallback 全詞庫繞過本局詞池與錯詞冷卻；只有無 session 的相容路徑可沿用舊 fallback。
4. Boss AI 的 blocked 預設碰撞半徑由 16 修為 32。首次未接觸詞必須顯示詞／意思／圖、朗讀並算協助，不升獨立回想星；bossQ.reading 必須反映實際保護，關閉保護後仍能作答破盾。檢查過期凍結來源是否清除。
5. AGY 的 tests/input-runtime.test.cjs 已做部分 V3 migration，仍需完整跑實質互動回歸。AGY 交接回報 128 PASS／27 FAIL，另稱最終目標 154 項，數量有矛盾且尚未由 Codex 複核，不當作驗收結果。不能 skip、刪斷言或改成空測試。保留鍵盤／手把／觸控、一次音效、死亡與即時勝利驗收。
6. Hermes 的 game-runtime helper 已整理重複定義、修 coverage 檔名、加入選卡回呼；tools/v3-acceptance.cjs 已修木樁秒數與配裝標籤。自然路線仍有校準腳本與 runner 的矛盾，需要同 seed、同 spawn 設定與相同配送函式比較 xp／level／state。連送兩單後 xp52、level1 的校準結果，不可當自然成長驗收。
7. Hermes 回報 seed11 與 seed12 第一單可走通；此新增路線證據尚未由 Codex 複跑。完整十二單、四 MAX 可達性、被動選卡 6–8 次、XP 來源與站樁／配送比較尚未量測。v3-acceptance-11.json 與 v3-acceptance-codex-current.json 為未完成草稿，不能用作通過證明。
8. 修正後依序跑契約組、input-runtime、npm test、必要覆蓋率與自然配送量測，再重建 tools/build-v3-smoke.cjs 產物、核對主要互動／魔王安全通道／手機介面。舊木樁與畫面證據須核對來源雜湊，不冒稱最終版本。
9. 四位完成、Codex 獨立放行後才 commit／push master 並驗證 GitHub Pages 工作與線上 JS 雜湊。使用者原先已授權直接提交部署；此次暫停指示優先，尚未 push／deploy。

## 現場 Agent 與檔案責任

| Agent | Herdr pane | 接續責任 |
|---|---|---|
| Codex | w3:p1 | 契約、整合、UI、獨立驗證、最後放行 |
| Grok | w3:p8 | game.js 已交接；恢復後由 Codex 安排獨立審查或局部修復 |
| AGY | w3:p9 | 模組已完成；input-runtime 單檔回歸仍待驗收 |
| Hermes | w3:p7 | helper、acceptance runner、自然配送與核心回歸 |

1. 使用現場 Herdr CLI，不替換為另開模型。提示一律單行，避免 CLI 拆成多個排隊回合；Hermes 活躍時用 /steer。metadata 的 idle 不足以證明 Hermes 已結束，須讀 pane。
2. 基準提交 da98b4b；此段前最後 local commit 42d9738。本次 WIP checkpoint 會收主實作、helper、回歸、工具及此紀錄，提交訊息標示 pending acceptance。
3. 不使用 git add .。artifacts/imports、skill-assets、skills、舊驗收目錄、kirigane 文件等既有未追蹤檔均保持原狀。_probe.cjs 是暫時校準檔，不納入提交。
4. 受控驗收在本機 8081，正式站為 https://yorkwahaha.github.io/yokai-delivery/；正式環境仍是舊版。瀏覽器暫時 viewport 已還原。沒有設定自動喚醒排程，額度恢復後從此紀錄接續。
