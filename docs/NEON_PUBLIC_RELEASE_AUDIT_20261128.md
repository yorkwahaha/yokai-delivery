# Yokai Delivery｜八關公開試玩版獨立全面審查報告（2026-11-28）

- **審查基準 Commit**：`0f5792664a5420fab0b7528f30fb9c4b0913885f`（`Release eight-stage classroom playtest and consolidate project`）
- **對應前次公開發布基準**：`0e5875d5`
- **目標公開站點**：`https://yorkwahaha.github.io/yokai-delivery/`
- **審查原則**：只讀審查，**未修改任何正式程式碼、素材或既有測試，未提交、未推送、未部署**。所有結論皆以本機 `0f57926` 磁碟程式碼、Git 追蹤清單（`git -c core.quotepath=false ls-files`，共 2,413 檔）、實際執行回歸與獨立受控驗證腳本為依據。

---

## 一、執行摘要與實際驗證結果

### 1.1 驗證範圍與通過項目

| 驗證項目 | 執行指令／方式 | 實際結果 | 備註 |
|---|---|---|---|
| Git 基準與工作樹 | `git rev-parse HEAD` / `git status --short` | `0f5792664a5420fab0b7528f30fb9c4b0913885f`；審查前工作樹乾淨 | 與 `origin/master` 一致 |
| 現行回歸測試 | `npm run test:current` | **1,360 PASS / 0 FAIL / 1 既有 TODO**（21.1s） | 僅涵蓋既有測試，盲點見 `P2-05` |
| 退役測試來源驗證 | `node tools/run-tests.cjs legacy-check` | **PASS**（83 份退役來源全數核驗；現行 199 檔） | 無歷史測試偽裝 PASS |
| 素材登錄檢查 | `py -3 tools/asset_registry.py --check` | **PASS**（1,721 檔、151 別名／副本；0 漏登、0 漂移） | 4 份忽略本機原稿不存在屬預期 |
| Git 追蹤完整性與 SW 雜湊 | 獨立 Python 稽核（`audit_static.py` / `audit_final_checks.py`） | SW `MEDIA_REVISIONS` **1,718 / 1,718** 全數存在 Git 且 **0 SHA256 漂移**；70 份 S5–S8 音訊、41 份新四招圖＋manifest、247 份 S5–S8 場景敵人圖全數追蹤；自 `0e5875d5` 以來所有異動 JS/CSS 之 `?v=` 皆已更新（**0 過期**） | 9 份 `.woff2` 字型未在 SW 內（見 `P2-03`） |
| 八關地形與答題格幾何檢查 | 獨立 Node 稽核（`audit_geometry.cjs`） | 8 關 × 2D (`scaleY=1`) 與 2.5D (`scaleY=1.2`) 共 1,690 個採樣答題點：**0 起點受阻、0 答題格卡牆、0 越界** | 靜態幾何確認，不含自然長局走位 |
| 題庫與語音路由檢查 | 獨立 Python 稽核（`audit_deep.py`） | 7 關 × 20 題＝**140 唯一日文詞彙與 140 唯一中文釋義**（0 重複、0 缺圖、0 缺音檔）；S8 黃泉境正確彙整 140 詞總複習；`あめ`／`は` 等同音字均經 `DELIVERY_MEDIA.pathForWord` 正確區隔，無舊 `ame.mp3`/`ha.mp3` 衝突 | 實際發音清晰度與中文教學貼切度仍待教師聽審 |
| 公開主機瀏覽器實測 | Playwright 攔截 `https://yorkwahaha.github.io/yokai-delivery/`，**僅伺服 Git 追蹤檔案**（完全阻斷 `art/` 與 `scratch/`） | 新手初始狀態、全 8 關解鎖狀態、網址參數濫用測試、損壞 `localStorage` 復原、舊存檔升級皆完成實測，0 未預期 `pageerror` | 重現 3 項公開版實證問題（`P1-01`、`P2-01`、`P2-04`） |
| 響度分析（EBU R128） | `ffmpeg -filter_complex ebur128=peak=true` | 完整量測 S1–S5/S8/共用 Boss BGM 之 Integrated LUFS、True Peak 與 LRA | 實證 S1–S4 Boss BGM 音量驟降 5.6–7.4 LU（`P1-03`） |
| 敏感資訊掃描 | 掃描全倉庫 2,413 個追蹤檔 | **0 API Key／Token／憑證外洩** | 11 份 `docs/` 含本機路徑或區網 IP（`P3-04`） |

> [!NOTE]
> **網路邊界聲明**：本審查環境沙盒無法讀取外部線上站點回應內文（對 `https://yorkwahaha.github.io/yokai-delivery/` 的直接外部請求僅能觸及邊界限制，未驗證遠端 CDN 當下實際吐出之 HTML 雜湊）。所有公開網站實測均以「`0f57926` 乾淨 `git ls-files` 追蹤集合 ＋ 精確對應 `https://yorkwahaha.github.io/yokai-delivery/` Origin」之受控瀏覽器環境完成；**實體 iPad Safari、觸控雙指操作、實體手把、自然長局通關手感與課堂多人網路頻寬，均列為待真人驗收項目，不宣稱已通過**。

### 1.2 問題嚴重度總覽

| 嚴重度 | 數量 | 摘要 |
|---|---:|---|
| **P0（阻斷／資料毀損／資安漏洞）** | **0** | 八關均可於無 DEV 參數下正常載入，無崩潰、無存檔毀損、無金鑰外洩、無 `art/` 正式載入缺失 |
| **P1（核心體驗／通關激勵／跨裝置音訊嚴重缺陷）** | **4** | `P1-01` 式神正式版美術退回舊圖（19 檔死檔）；`P1-02` 第 10–13 招缺首次介紹與防飢餓保底；`P1-03` 前四關獨立 Boss BGM 音量驟降 5.6–7.4 LU；`P1-04` iPad Safari BGM 閃避失效與後四關靜音進入後永久脫離 WebAudio 增益鏈 |
| **P2（局部功能／記憶體／發布體積／測試與文件債）** | **6** | `P2-01` `?u1scroll=1` 公開網址洩漏；`P2-02` 連跑多關圖片與音訊解碼快取累積；`P2-03` 285.23 MiB 部署體積與字型未入 SW；`P2-04` 舊存檔僅含 `completed` 時未推導下一關解鎖；`P2-05` 回歸測試公開主機與響度盲點；`P2-06` 發布文件／清冊過期、3 份舊 `art/` 仍追蹤、Stable Audio 3 授權未留存核對 |
| **P3（低優先度／已知保留項目／倉庫衛生）** | **4** | `P3-01` S1–S4 多王錯峰維持 DEV；`P3-02` 休眠 `art/` 程式碼殘留；`P3-03` S5/S6 第三王外觀共用與 S8 結尾曲 176.85s 待確認；`P3-04` 11 份文件含本機路徑／區網 IP |

### 1.3 問題性質分類對照

- **已實際重現／量測證實之問題（7 項）**：`P1-01`、`P1-02`、`P1-03`、`P2-01`、`P2-03`、`P2-04`、`P2-06`
- **靜態原始碼推論／高機率跨裝置架構風險（5 項）**：`P1-04`（依 iOS Safari `HTMLMediaElement.volume` 只讀規範與 `js/audio.js` 實作推論，須實體 iPad 實測確認）、`P2-02`、`P2-05`、`P3-02`、`P3-04`
- **已知保留或必須真人／實體裝置驗收之項目（2 項＋獨立清單）**：`P3-01`、`P3-03`，以及第五節所列實體 iPad／自然長局／課堂試玩必測項目。

---

## 二、審查發現明細（依嚴重度排序）

> 以下每則發現均包含：編號與嚴重度、影響範圍、檔案／行號／函式、根因、重現步驟與證據、建議修復、回歸風險與驗收標準。

---

### P1-01｜第 9 招式神・召喚在公開版仍被鎖於 DEV `isStageLab`，19 份已上架正式美術全成死檔

1. **編號與嚴重度**：`P1-01`｜**P1（核心美術與 Lv5 覺醒視覺退化）**（已重現）
2. **影響關卡／裝置／玩家情境**：所有已通關第三關（`sakura-pass`）並在第四～八關使用第 9 招「式神・召喚（`shikigami`）」的公開正式版玩家（所有裝置）。
3. **相關檔案、行號與函式**：
   - `js/game-shikigami.js:22-23`（`trialArt`、`CARD_ART_PATH`）
   - `js/game-shikigami.js:67-70`（`loadBlackArt`）
   - `js/game-shikigami.js:76-80`（`loadArt` 內 `whiteBite`、`summon`、`vanish`）
   - `js/game.js:3455`（`if (WL.shikigami === 5 && stageLab) shikigamiModule.loadBlackArt(art);`）
4. **問題根因**：
   - 雖然 `0f57926` 已將 36 份式神成品圖正式納入 `assets/img/characters/shikigami/`、`assets/img/skills/shikigami/cards/shikigami__card.webp` 及 `assets/img/vfx/skills/shikigami/` 並寫入 `service-worker.js`，但 `js/game-shikigami.js:22` 仍以 `const trialArt = window.DEV_MODE?.isStageLab?.(window.location) === true;` 作為開關，且 `js/game.js:3455` 亦將黑狼美術載入綁死在 `stageLab`。
   - 公開域名 `yorkwahaha.github.io` 上 `isStageLab` 恆為 `false`，導致公開版永遠退回舊版單張待機圖 `hound-idle__f01.webp` 當作抽卡卡圖、Lv5 覺醒無法載入黑狼（`black-idle/run/bite` 共 10 檔）、白狼咬擊（`white-bite` 4 檔）、召喚與離場特效（`shikigami__summon.webp`、`shikigami__departure.webp`）全數未載入，合計 19 份已發布成品圖於正式站點形同死檔，而卡面敘述仍寫「Lv5 喚出黑白雙狼分頭獵殺」，產生文圖不符。
5. **重現步驟與具體證據**：
   - 於 Playwright 模擬公開站點 `https://yorkwahaha.github.io/yokai-delivery/`（無任何 DEV 參數，匯入已通關 S1–S8 存檔），檢查 `GAME_SHIKIGAMI.CARD.artPath` 與 `loadArt("hound")`／`loadBlackArt(art)` 結果（詳見 `scratch/public-audit-20261128/public-browser-report.json`）：
     - `shikigamiCardPath`: `"assets/img/characters/shikigami/shikigami__sprite__hound-idle__f01.webp"`（應為 `assets/img/skills/shikigami/cards/shikigami__card.webp`）
     - `shikigamiHasBlackArt`: `false`
     - `shikigamiHasWhiteBite`: `false`
     - `shikigamiHasSummonVfx`: `false`
6. **建議修復方式**：
   - 移除 `js/game-shikigami.js:22` 的 `isStageLab` 條件，直接啟用已正式上架之 `shikigami__card.webp`、`black-idle/run/bite`、`white-bite`、`shikigami__summon.webp` 與 `shikigami__departure.webp`。
   - 將 `js/game.js:3455` 改為 `if (WL.shikigami === 5) shikigamiModule.loadBlackArt(art);`（保留只在升至 Lv5 時延遲載入黑狼影格，避免前期多餘記憶體佔用）。
   - 同步確認 `index.html` 中 `js/game-shikigami.js?v=` 與 `js/game.js?v=` 版本字串更新。
7. **修復後的回歸風險**：
   - 低至中：需確認 Lv5 黑白雙狼同時咬擊與召喚／離場特效在 iPad 上同時解碼 10 幀 WebP 不致造成瞬間掉幀；同時確認 `tests/` 中是否有舊測試假設非 `stageLab` 時 `CARD.artPath` 必須是 `hound-idle__f01.webp`。
8. **建議驗收標準**：
   - 新增「公開非 DEV 主機（`yorkwahaha.github.io`）」自動化測試：確認 `CARD.artPath === "assets/img/skills/shikigami/cards/shikigami__card.webp"`、`loadArt("hound")` 含 `whiteBite`/`summon`/`vanish`，且 `WL.shikigami === 5` 時自動載入 `art.black`、0 筆 404。
   - 實機在第四關升到式神 Lv5，目視確認出現一白一黑雙狼與專屬召喚／離場特效。

---

### P1-02｜第 10–13 招於公開版缺席「首次解鎖必出介紹」與「保底防飢餓」抽卡機制

1. **編號與嚴重度**：`P1-02`｜**P1（核心進度獎勵與新技能觸達率嚴重受損）**（已重現／程式碼確認）
2. **影響關卡／裝置／玩家情境**：所有已通關第四～七關、期待體驗新解鎖技能（10 破魔・神弓、11 絡新婦・妖絲、12 冰魄・妖毬、13 冥風・風穴）的公開試玩版學生。
3. **相關檔案、行號與函式**：
   - `js/store.js:342`（`skillClearStage` 僅列 `ink_trail`、`seal_nail`、`shikigami`）
   - `js/store.js:378-401`（`markSkillExperienced`、`pendingIntroductions`、`pendingSkillIntroduction`、`rotateSkillIntroduction` 皆僅查 `skillClearStage`）
   - `js/game.js:2059-2088`（升級三選一的 `unseenRewards` 僅包含 `BAMBOO_STARTER_CHOICES` 加上 `guidedExpansionDraft && expansionIds`，其中 `guidedExpansionDraft` 為 DEV-only）
4. **問題根因**：
   - 第 7–9 招（紫藤毒香、封印釘、式神召喚）設計有完整的「通關解鎖 → 下場首抽必出介紹 → 婉拒則輪替 → 未抽到累積 5 次保底出現（`unseenRewards`）」機制。
   - 然而第 10–13 招正式公開時，只把 `GAME_SKILL_EXPANSION.releases[*].published` 改為 `true`，卻**未將四招納入 `STORE` 的 `skillClearStage`／`pendingIntroductions`**，也未在公開版納入 `js/game.js:2081` 的 `unseenRewards`（該行把 `expansionIds` 綁在 `guidedExpansionDraft`，而 `guidedExpansionDraft` 在公開主機永遠為 `false`）。
   - 公開版滿解鎖時有 12 招候選主動技能競爭 3 個空槽（妖刀固定佔 1 槽），每場升級抽卡還混入既有技能升等、變異與被動；缺少首次必出與 5 次防飢餓保底後，學生破完 S4–S7 常會連打 1～2 局仍一次都抽不到剛解鎖的新招，直接削弱後四關的進度回饋感。
5. **重現步驟與具體證據**：
   - 在 `audit_public_runtime_s58.cjs` 測試「已通關 S1–S4」存檔：`STORE.isActiveSkillUnlocked("hamaya")` 回傳 `true`，但檢查 `js/store.js:385` `pendingIntroductions()` 永遠只篩 `Object.keys(skillClearStage)`（不含 `hamaya`、`spider_silk`、`ice_ball`、`wind_hole`）；呼叫 `STORE.markSkillExperienced("hamaya")` 亦直接回傳 `false`（因 `js/store.js:379` 檢查 `!Object.hasOwn(skillClearStage, id)`）。
   - 在 `public-browser-report.json` 中確認公開主機 `guidedDraft: false`，故 `js/game.js:2082` 不會把 `expansionIds` 加入 `unseenRewards`。
6. **建議修復方式**：
   - 在 `js/store.js` 將所有正式公開之通關解鎖技能（`skillClearStage` ＋ `GAME_SKILL_EXPANSION.releases` 中 `published === true` 者，依解鎖關卡順序 `S1→S7` 排序）納入 `pendingIntroductions()`、`markSkillExperienced()` 與 `rotateSkillIntroduction()`。
   - 在 `js/game.js:2081-2082` 讓公開版之 `unseenRewards` 納入所有 `STORE.isActiveSkillUnlocked(id)` 的已解鎖擴充技能（與 `BAMBOO_STARTER_CHOICES` 一致，不依賴 DEV `guidedExpansionDraft`），保留 `guidedExpansionDraft` 僅用於 DEV 測試用強制腳本。
7. **修復後的回歸風險**：
   - 中：已通關 S1–S7 的老玩家若同時累積多招未體驗技能，需確認 `pendingSkillIntroduction()` 一次僅推 1 招（既有設計已如此，依關卡順序推播且可輪替），避免一次擠佔三選一全部欄位導致無法升級妖刀或既有技能。
8. **建議驗收標準**：
   - 單元測試驗證：破完 S4 後 `pendingSkillIntroduction()` 回傳 `"hamaya"`（若前 3 招均已體驗），抽中後呼叫 `markSkillExperienced("hamaya")` 回傳 `true` 且不再重複強制出現；破完 S5/S6/S7 依序支援 `spider_silk`/`ice_ball`/`wind_hole`。
   - 模擬公開版 100 場 S5 開局抽卡，確認已解鎖但尚未選取的 `hamaya` 在前 5 次升級內出現率達 100%，且三選一仍維持 3 張不重複卡片。

---

### P1-03｜前四關新上架獨立 Boss BGM 響度比一般戰鬥曲低 5.6–7.4 LU，進王戰反而明顯變小聲

1. **編號與嚴重度**：`P1-03`｜**P1（核心視聽高潮退化，影響所有 S1–S4 玩家）**（已量測證實）
2. **影響關卡／裝置／玩家情境**：第 1–4 關（`night-town`、`rain-port`、`sakura-pass`、`bamboo-maze`）所有破封進入最終 Boss 戰的玩家（所有裝置，尤其教室 iPad 外放環境更明顯）。
3. **相關檔案、行號與函式**：
   - `js/audio.js:65`（`STAGE_BOSS_BGM_PROVIDED = new Set(window.CONTENT ? Object.keys(STAGE_BOSS_BGM_FILES) : [])`）
   - `assets/audio/bgm/stages/night-town/night-town__boss.mp3`
   - `assets/audio/bgm/stages/rain-port/rain-port__boss.mp3`
   - `assets/audio/bgm/stages/sakura-pass/sakura-pass__boss.mp3`
   - `assets/audio/bgm/stages/bamboo-maze/bamboo-maze__boss.mp3`
4. **問題根因**：
   - `0f57926` 新增四首前四關獨立 Boss BGM（約 65.6–69.7 秒）並立即於公開版全面啟用，但四首音檔未與各關一般戰鬥曲做 Integrated LUFS 響度對齊，且既有音訊測試僅檢查峰值 `≤ -0.5 dBFS`（見 `P2-05`），未檢查響度下限或與同關一般曲的響度落差。
   - 在 `js/audio.js` 中，一般戰鬥曲與 Boss 曲共用相同的 `BGM_NORMAL_VOLUME = 0.27` 播放增益，導致破封切進 Boss 戰時音樂能量反而驟降 5.6～7.4 LU，使王戰張力大打折扣。
5. **重現步驟與具體證據**：
   - 執行 `ffmpeg -i <file> -filter_complex ebur128=peak=true -f null -` 實測結果（`audit_final_checks.py`）：

   | 關卡 | 一般戰鬥曲（Integrated / True Peak） | 獨立 Boss 曲（Integrated / True Peak） | 切入 Boss 響度落差 |
   |---|---|---|---|
   | S1 百鬼夜行町 | `-11.1 LUFS` / `+0.4 dBFS` | **`-17.7 LUFS`** / `-2.9 dBFS` | **-6.6 LU** |
   | S2 驟雨漁港 | `-11.0 LUFS` / `+0.4 dBFS` | **`-18.4 LUFS`** / `-5.2 dBFS` | **-7.4 LU** |
   | S3 落櫻山道 | `-11.1 LUFS` / `+0.2 dBFS` | **`-17.9 LUFS`** / **`-8.2 dBFS`** | **-6.8 LU** |
   | S4 迷霧竹林 | `-11.8 LUFS` / `+0.3 dBFS` | **`-17.4 LUFS`** / `-2.0 dBFS` | **-5.6 LU** |
   | *(對照)* S5 百鬼京町 | `-15.5 LUFS` / `-0.9 dBFS` | `-15.0 LUFS` / `-1.1 dBFS` | +0.5 LU（正常） |
   | *(對照)* 原共用 Boss 曲 | — | `-9.2 LUFS` / `+0.7 dBFS` | — |

6. **建議修復方式**：
   - **優先方案（音檔母帶一致化，需使用者核准後執行）**：保留原檔備份，對四首 S1–S4 Boss MP3 以透明增益／限幅調整至約 `-11.5` 至 `-12.5 LUFS`（同時嚴守 True Peak ≤ `-1.0 dBFS`、Sample Peak ≤ `-0.5 dBFS`），使王戰響度與同關戰鬥曲持平或略高 `+0.5 LU`，並同步更新 `service-worker.js` `MEDIA_REVISIONS` 與資產登錄清冊。
   - **或程式補償方案（不改音檔）**：若暫不動原始音檔，需先改以 WebAudio GainNode 掛載 S1–S4 BGM（一併解決 `P1-04`），並為各曲設定校準增益係數（但仍以直接母帶校準較乾淨、免於數位削峰）。
7. **修復後的回歸風險**：
   - 低：須注意 `S1–S4` 一般戰鬥曲本身 True Peak 已略高於 `0 dBFS`（`+0.2`～`+0.4 dBFS`），新 Boss 曲調整時切勿為追上響度而超標觸發既有的 `-0.5 dBFS` 峰值門檻測試；建議將 S1–S4 Boss 曲定在 `-12.5 LUFS` 左右且 Peak ≤ `-0.8 dBFS`，由真人試聽確認不炸耳。
8. **建議驗收標準**：
   - 四首 S1–S4 Boss BGM 之 Integrated LUFS 落於 `-13.0` 至 `-11.5 LUFS`（與同關戰鬥曲差距在 ±2.0 LU 內），且 True Peak ≤ `-0.8 dBFS`、既有音訊回歸測試 100% PASS。
   - 資產清冊與 `service-worker.js` 雜湊同步通過檢查。

---

### P1-04｜iPad／iOS Safari 音訊音量架構缺陷：後四關「靜音進關後解除靜音」永久脫離 GainNode，且前四關 BGM 閃避全面依賴只讀的 `audio.volume`

1. **編號與嚴重度**：`P1-04`｜**P1（教室主要裝置 iPad Safari 教學語音可聽性與音訊平衡重大風險）**（靜態原始碼精準確認，須實體 iPad 複核）
2. **影響關卡／裝置／玩家情境**：所有使用 **iPadOS / iOS Safari** 遊玩的學生；特別是「在教室先靜音進關、戴上耳機後才解除靜音」玩第 5–8 關的情境，以及在第 1–4 關一邊聽 BGM 一邊聽日文配送單字發音的情境。
3. **相關檔案、行號與函式**：
   - `js/audio.js:905-918`（`getCtx()` 在 `muted || suspended` 時直接回傳 `null`）
   - `js/audio.js:207-243`（`stageTrack(event)` 僅於首次建立 `<audio>` 時呼叫 `getCtx()` 並綁定 `createMediaElementSource` 與 `GainNode`）
   - `js/audio.js:187-192`（`trackVolume(track, value)` 在 `stageMediaNodes` 缺失時退回 `track.volume = value`）
   - `js/audio.js:127-149`、`js/audio.js:88-115`（S1–S4 一般與 Boss BGM 全程未掛載 `MediaElementAudioSourceNode`，僅寫入 `audio.volume`）
4. **問題根因**：
   - 在 iOS / iPadOS Safari 上，依 Apple WebKit 規範，`HTMLAudioElement.prototype.volume` 為**唯讀常數 `1.0`**，JS 指派 `audio.volume = 0.27` 或 `0.10` 會被靜默忽略，必須透過 Web Audio API `GainNode` 才能真正控制音量。
   - **後四關缺陷（S5–S8）**：程式雖為後四關實作了 `createMediaElementSource` + `GainNode`（`stageMediaNodes`），但 `stageTrack(event)` 只在首次建立該軌時呼叫 `const ac = getCtx()`。而 `getCtx()`（`js/audio.js:906`）在 `muted === true` 或 `suspended === true` 時直接回傳 `null`。因此只要學生「靜音狀態進入 S5–S8（或切回背景時進入）」，`stageTrack` 便會在沒有 `stageMediaNodes` 的情況下快取該 `Audio` 實例；之後學生解除靜音，該曲目**在離開本關前永遠不會補掛 `GainNode`**，於 iPad 上將以 100% 滿載音量（而非 `0.27`）播放，且無法與 Boss 曲／結尾曲淡入淡出、無法於日文單字朗讀時降音（ducking）。
   - **前四關結構限制（S1–S4）**：S1–S4 的 `stageBgmTracks`、`stageBossBgmTracks`、`window.BGM`、`window.MAP_BGM`、`window.BOSS_BGM` 均直接操作 `audio.volume`，在 iPad Safari 上同樣無法執行 `0.27 → 0.10` 的日文語音閃避或暫停降音（`0.055`），恐使背景音樂壓過日文單字發音。
5. **重現步驟與具體證據**：
   - 程式碼路徑直接追蹤：`localStorage["yokai-muted-v1"] = "true"` → 進入 `hyakki-kyoto` → `prepareMusic("play", "hyakki-kyoto")` 呼叫 `stageTrack("battle")` → 第 215 行 `getCtx()` 因第 906 行 `if (muted || suspended) return null` 回傳 `null` → 第 216 行 `if (ac?.createMediaElementSource)` 跳過 → 第 236 行 `stageTracks.set("battle", track)` 快取無節點音軌 → 玩家點選解除靜音 → `stageTrack("battle")` 第 208 行直接回傳快取 `track` → `trackVolume` 第 191 行永遠只寫 `track.volume`。
6. **建議修復方式**：
   - 將 `ensureStageMediaNode(track)` 抽成冪等函式：在 `stageTrack()`、`setMuted(false)`、`unlockFromInput()` 與 `playMusic()` 中，只要 `AudioContext` 可用且尚未為該 `track` 綁定 `stageMediaNodes`，即補掛 `createMediaElementSource` + `GainNode`（注意同一個 `HTMLMediaElement` 只能呼叫一次 `createMediaElementSource`，以 `WeakSet` 防重複並 `try/catch` 保護）。
   - 長期建議亦將 S1–S4 BGM 與 `MAP_BGM` 納入同一套 `GainNode` 路由（確認同源無 CORS 問題；GitHub Pages 同源可正常路由），確保 iPad Safari 上 8 關皆能確實執行單字發音閃避（ducking）與暫停降音。
7. **修復後的回歸風險**：
   - 中：iOS Safari 對 `createMediaElementSource` 搭配 `AudioContext` 狀態（`suspended` / `interrupted`）較敏感；若 `AudioContext` 未於使用者手勢內 `resume()`，掛載 `MediaElementSource` 後可能無聲。因此**必須**在實體 iPad Safari 上反覆驗證首次點擊解鎖、靜音切換、鎖屏恢復、電話／通知中斷恢復。
8. **建議驗收標準**：
   - 新增單元測試：先 `AUDIO.setMuted(true)` → 進入 `hyakki-kyoto` → 再 `AUDIO.setMuted(false)`，斷言 `stageMediaNodes` 已成功掛載且透過 `GainNode` 控制 `0.27`／`0.10`（語音閃避）／`0.055`（暫停）。
   - 實體 iPad Safari 驗證 S1 與 S5 在開聲進關、靜音進關再解除靜音兩種情境下，BGM 音量皆明顯低於單字語音，且播放日文發音時背景音樂確實變小。

---

### P2-01｜公開站點 URL 參數 `?u1scroll=1`／`#u1scroll` 未受 DEV 隔離，會對不存在的 `scratch/` 發出 404 請求

1. **編號與嚴重度**：`P2-01`｜**P2（公開與 DEV 隔離破口、404 雜訊）**（已重現）
2. **影響關卡／裝置／玩家情境**：任何在公開站點網址附帶 `?u1scroll=1` 或 `#u1scroll`（例如誤貼過去試看連結）的使用者。
3. **相關檔案、行號與函式**：
   - `js/ui.js:12-18`（頂層立即函式解析 `u1scroll` 參數與 hash，直接設定 `window.U1_EMAKI_PREVIEW = true`，未檢查 `DEV_MODE.isDevMode`）
   - `js/ui.js:724-740`（啟用時載入 `scratch/r18-ui-scroll-opencode/candidate/ui_scroll_emaki_horizontal.webp`）
4. **問題根因**：
   - `js/dev-mode.js` 已嚴格攔截 `dev=1`、`stageLab`、`skillLab`、`fusionlab`、`bossStagger`、`draft=guided`、`sealTrial`、`deliveryArt` 等全部 DEV 參數，但早期留下的 R18-U1 卷軸審閱開關直接寫在 `js/ui.js:12-18`，未經 `DEV_MODE.isDevMode(location)` 守門。
   - 由於 `scratch/` 已被 `.gitignore` 排除且未部署上 GitHub Pages，該參數在公開網站只會造成 404 並切換至未定案預覽繪製路徑。
5. **重現步驟與具體證據**：
   - 於 `audit_public_browser.cjs` 開啟 `https://yorkwahaha.github.io/yokai-delivery/?dev=1&stage=yomi&stageLab=1&skillLab=expansion&fusionlab=1&bossStagger=1&draft=guided&u1scroll=1&sealTrial=1&deliveryArt=1`：
   - 結果（`public-browser-report.json:49-63`）：所有其他 DEV 旗標皆為 `false`，**唯獨 `u1EmakiPreview: true`**。
6. **建議修復方式**：
   - 在 `js/ui.js:13` 加上 `window.DEV_MODE?.isDevMode?.(location) === true` 守門，或若該 R18 候選已淘汰則直接移除 `U1_EMAKI_PREVIEW` 分支。
7. **修復後的回歸風險**：
   - 極低：預設公開模式原本即為 `false`，加守門不影響任何現行選單外觀。
8. **建議驗收標準**：
   - 公開主機帶 `?u1scroll=1` 與 `#u1scroll` 載入時，`window.U1_EMAKI_PREVIEW` 為 `false`／`undefined`，且無任何對 `scratch/` 的網路請求。

---

### P2-02｜連跑八關與第 8 關 140 詞總複習存在圖片與解碼音訊快取累積（iPad Safari 記憶體風險）

1. **編號與嚴重度**：`P2-02`｜**P2（長局／連續過關在低 RAM iPad 上可能觸發頁籤重整）**（靜態程式碼確認）
2. **影響關卡／裝置／玩家情境**：在 3GB–4GB RAM 之教室 iPad 上一次連續遊玩多關（尤其經由 S4 竹林進入 S5–S8，或反覆遊玩 S8 黃泉境 140 詞總複習）的學生。
3. **相關檔案、行號與函式**：
   - `js/bamboo-art.js`（整檔無 `unload()` 方法；35 張 WebP 與 2 張離屏 `cutLayers` Canvas 永久駐留，見 `js/game.js:1647-1653` 僅呼叫 S5–S8 `unload()`）
   - `js/delivery-icon-art.js:9`（`imageCache = new Map()` 無容量上限或切關淘汰，連玩 8 關或跑 S8 最多常駐 140 張配送圖 `Image` 解碼紋理）
   - `js/audio.js:152, 248, 866`（`clipBuffers` 在 `clearStageEffects()` 只刪除 S5–S8 關卡音效，**永不清理已解碼的日文單字 PCM `AudioBuffer`**；另 `stageBgmTracks` 與 `stageBossBgmTracks` 跨關不釋放）
   - `js/game.js:1647-1653`（雖有釋放 S2 `resetS2ArtProdCache`／`releaseWorldBackings` 與 S5–S8 `unload()`，但 S1／S3 與 S4 竹林切離後並未卸載）
4. **問題根因**：
   - 後四關已針對記憶體做 `unload()` 清理，但早期系統（S4 `BAMBOO_ART`、`DELIVERY_ICON_ART`、單字語音 `clipBuffers`）在擴充至 8 關與 140 詞後尚未補上上限（LRU）或切關卸載機制。
   - iOS Safari 對單一分頁的解碼圖片紋理與未壓縮 WebAudio `AudioBuffer`（每支單字音檔解碼成 Float32 PCM 約 200–400 KB，140 支約 30–55 MB，疊加數百張 Canvas/WebP 紋理）容忍度較桌面低，易在連續遊玩 30–40 分鐘後觸發系統強制重載頁籤（Jetsam）。
5. **重現步驟與具體證據**：
   - 程式碼檢視確認：`js/game.js:1647-1653` 切關清理清單不含 `BAMBOO_ART`、`DELIVERY_ICON_ART`、`AUDIO.clearWordBuffers`；`js/delivery-icon-art.js` 全檔無 `.delete(` 或 `.clear(`；`js/audio.js:248` 僅迭代 `stageCatalog.byStage[stageAudioId]`。
6. **建議修復方式**：
   - 為 `BAMBOO_ART` 補上 `unload()`（清空 `images` 並將 `cutLayers` 寬高歸 0），於 `js/game.js` 離開 `bamboo-maze` 時呼叫。
   - 為 `DELIVERY_ICON_ART.imageCache` 加上簡易 LRU 上限（例如最多保留 32 張，切關時可清空非當前關卡圖）。
   - 為 `AUDIO` 的單字語音 `clipBuffers` 加上獨立 `wordBuffers` Map 與 LRU 上限（例如 24～32 支，S8 總複習即可穩定控制在 <10 MB PCM），切關時順帶釋放非當前關卡的 `stageBgmTracks`／`stageBossBgmTracks`。
7. **修復後的回歸風險**：
   - 低至中：需確保 LRU 淘汰不會移除「正在場上顯示的配送題圖」或「正在播放中的語音」；保留近期 24–32 筆即可避免場上 3–4 個選項重複重抓。
8. **建議驗收標準**：
   - 在 Chrome DevTools Memory 與實體 iPad Web Inspector 連跑 S1 → S4 → S5 → S8 後回到主選單，JS Heap 與 GPU 紋理／解碼圖片總數應回落至穩定高原，不隨關卡數線性增長。

---

### P2-03｜公開部署體積達 285.23 MiB（含重複檔與大量 PNG），且 9 份字型未納入 SW 並殘留 4 份無效 `@font-face`

1. **編號與嚴重度**：`P2-03`｜**P2（教室多人共用 Wi-Fi 首載／快取效率與網路雜訊）**（已量測證實）
2. **影響關卡／裝置／玩家情境**：教室 20～30 台 iPad 同時連線 GitHub Pages 首次載入或版本更新時。
3. **相關檔案、行號與函式**：
   - `assets/`（Git 追蹤共 1,770 檔、**285.23 MiB**）
   - `assets/fonts/`（共 9 份 `.woff2` 合計 4.86 MiB，皆**未**列入 `service-worker.js` `MEDIA_REVISIONS`；其中 `Bakudai`、`Masa`、`WenKai`、`Xuandong` 共 4 份為 Phase 42 試用字型，公開版未預設使用卻一併部署）
   - `index.html:94-122`（仍宣告 4 份**未追蹤於 Git** 的本機授權字型 `@font-face`：`HanWang`、`CwTeX`、`ChillKai`，指向不存在之 `assets/fonts/*.woff2`）
   - `service-worker.js`（僅清單化媒體雜湊，71 份 JS/CSS 依賴瀏覽器 HTTP 快取＋`?v=` 查詢參數，正常更新沒問題，但離線無法完整啟動 App Shell）
4. **問題根因**：
   - 媒體統計（`audit_static.py`）顯示 `assets/` 內含：
     - **45.60 MiB** `.png` 檔案（多數為早期圖檔，未壓成 WebP）；
     - **29.26 MiB** SHA256 完全重複之檔案（153 組重複，例如 `assets/audio/BGM.mp3` 4.31 MiB 與 `night-town__battle.mp3` 完全相同，係為相容別名而保留副本）；
     - 後四關部分 MP3 體積達 4.4–5.4 MiB（如 `snow-temple__boss.mp3` 5.42 MiB、`yomi__ending.mp3` 5.11 MiB）。
   - `index.html:94-122` 保留 4 組指向本機測試字型的 `@font-face`；雖公開版預設字型經實測已正確切為 `MoonStars Kai T`（`compendiumUsesLocalFont: false`，且確認無任何 HanWang GPL 二進位字型被提交進 Git），但若 CSS fallback 鏈觸發到這些字型族名，瀏覽器仍會發出無效請求。
5. **重現步驟與具體證據**：
   - `audit_static.py` 掃描 Git 追蹤之 `assets/`：
     - `assets/` 總大小：`285.23 MiB`（1,770 檔）
     - `.png` 總大小：`45.60 MiB`
     - 完全重複檔案浪費空間：`29.26 MiB`（153 組）
     - `assets/fonts/*.woff2`：9 檔（4.86 MiB）皆不在 `service-worker.js` `MEDIA_REVISIONS` 中。
   - 對照 `index.html:94-122` 與 `git ls-files assets/fonts/`，確認 `HanWang`、`CwTeX`、`ChillKai` 4 組 `@font-face` 目標檔案不存在於 Git。
   - **正面確認**：首頁與單關均採延遲載入（lazy load），不會一次下載全部 285 MiB；且自 `0e5875d5` 以來所有異動的 JS/CSS（71 份）均已正確更新 `?v=` 查詢參數，不會發生新舊 JS 混用。
6. **建議修復方式**：
   - 清理 `index.html:94-122` 中指向未追蹤本機字型的 `@font-face`（若本機仍需比較，改由 DEV 動態注入）。
   - 將實際使用的公開字型（如 `MoonStars Kai T` 及必要 UI 字型）納入 `service-worker.js` 快取，並評估移除 4 份未使用的 Phase 42 試用 `.woff2`（若無預覽需求）。
   - 後續里程碑可逐步以 `js/asset-paths.js` 統一重導重複音圖（減少 29 MiB 冗餘）並壓縮舊 `.png` 為 WebP（需使用者核准與逐項比對清冊）。
7. **修復後的回歸風險**：
   - 中：刪除別名副本前必須確認無任何舊快取或硬編碼路徑直接繞過 `asset-paths.js`；變更任何 `assets/` 檔皆須同步執行 `tools/asset_registry.py` 與更新 `service-worker.js`。
8. **建議驗收標準**：
   - 公開版 `index.html` 不再宣告指向不存在檔案的 `@font-face`。
   - 教室實測單一裝置首載與跨關載入流量合理，且 `MoonStars Kai T` 可由 SW 快取重複命中。

---

### P2-04｜`STORE.isStageUnlocked()` 未由 `completed` 推導下一關解鎖，對缺漏 `unlocked` 欄位的舊／匯入存檔會產生進度矛盾

1. **編號與嚴重度**：`P2-04`｜**P2（防禦性存檔遷移缺口）**（已重現）
2. **影響關卡／裝置／玩家情境**：
   - 先澄清：`0e5875d5`（上次公開發布版本）的 `js/store.js` **已預先包含完整 8 關 `NEXT_STAGE`**，因此「在 `0e5875d5` 上正常通關 S4 的學生」其存檔裡原本就會寫入 `unlocked["hyakki-kyoto"] = true`，本次升級可正常解鎖 S5。
   - 然而若學生持有**更早於 `NEXT_STAGE` 擴充八關前的舊存檔**（當時破完 `bamboo-maze` 沒有 `NEXT_STAGE["bamboo-maze"]`），或未來進行存檔匯入／修復時僅有 `completed["bamboo-maze"] = true` 而無 `unlocked["hyakki-kyoto"]`，就會卡在無法進入第 5 關。
3. **相關檔案、行號與函式**：
   - `js/store.js:79-111`（`decodeBaseline` 未依 `completed` 補齊 `unlocked[NEXT_STAGE[id]]`）
   - `js/store.js:340`（`isStageUnlocked` 僅檢查 `stageId === "night-town" || d.progress.unlocked[stageId] === true`）
4. **問題根因**：
   - `isActiveSkillUnlocked()`（`js/store.js:347, 362`）已正確採用 `isStageCompleted(stageId) || getStageStats(stageId).clears > 0` 推導資格，但 `isStageUnlocked()` 卻只讀 `d.progress.unlocked[stageId]`，未在 `decodeBaseline()` 或 `syncJournal()` 中依 `NEXT_STAGE` 從已通關紀錄補齊下一關解鎖狀態。
5. **重現步驟與具體證據**：
   - 於 `audit_public_runtime_s58.cjs` 測試舊格式存檔（`unlocked` 與 `completed` 均含 S1–S4、`stageStats["bamboo-maze"].clears = 1`）：
     - `isHamayaUnlocked`: **`true`**（系統認定已破 S4，解鎖第 10 招）
     - `isHyakkiUnlocked`: **`false`**（地圖卻鎖住第 5 關，出現自相矛盾）
   - 另驗證損壞 JSON（`"{bad-json!!!"`）與型別錯亂／`__proto__` 污染存檔：`js/store.js` 皆安全回退為乾淨初始存檔且無原型鏈污染（`polluted: false`）。
6. **建議修復方式**：
   - 在 `js/store.js` 的 `decodeBaseline()` 與 `syncJournal()` 結尾，補上一段冪等推導迴圈：凡 `state.progress.completed[id] === true` 或 `state.progress.stages[id]?.clears > 0`，皆確保 `state.progress.unlocked[id] = true` 且若 `NEXT_STAGE[id]` 存在則 `state.progress.unlocked[NEXT_STAGE[id]] = true`。
7. **修復後的回歸風險**：
   - 極低：純屬向後相容的正向補全，不會誤解鎖未通關關卡，也不會回寫破壞既有 journal。
8. **建議驗收標準**：
   - 新增單元測試：僅提供 `completed: { "bamboo-maze": true }`（或 `stages["bamboo-maze"].clears: 1`）而不給 `unlocked["hyakki-kyoto"]`，驗證 `STORE.isStageUnlocked("hyakki-kyoto") === true`；同時驗證僅破 S1 時 S3 仍為 `false`。

---

### P2-05｜現行 1,360 則回歸測試存在公開主機、響度一致性與抽卡防飢餓盲點

1. **編號與嚴重度**：`P2-05`｜**P2（品質保證盲點，導致 P1 問題在「0 FAIL」狀態下進入正式版）**（已確認）
2. **影響關卡／裝置／玩家情境**：開發與發布前把關流程（所有後續版本）。
3. **相關檔案、行號與函式**：
   - `tests/phase-f3-audio-20261127.test.cjs:1-145`（僅以模擬 `Audio` 驗證路由與峰值門檻，未檢核實檔 Integrated LUFS 下限與一般曲／Boss 曲響度差）
   - `tests/game-shikigami-runtime-20261119.test.cjs`（未以公開非 DEV `location` 檢查 `GAME_SHIKIGAMI.CARD.artPath` 與 Lv5 黑狼載入）
   - `tests/ink-variants-seal-nail-20261117.test.cjs`（僅覆蓋第 7–9 招的 `unseenRewards`／`pendingSkillIntroduction`，未覆蓋第 10–13 招公開版行為）
   - 全 `tests/` 目錄對 `u1scroll`／`U1_EMAKI_PREVIEW` 覆蓋數為 **0**
4. **問題根因**：
   - 許多現行測試建立於 S5–S8 與第 10–13 招仍處於 DEV Stage Lab 時期，測試替身（harness）常注入 `isStageLab: () => true` 或直接對靜態清冊斷言，缺少「模擬 `https://yorkwahaha.github.io/yokai-delivery/`、零 DEV 參數、全 8 關公開運作」的整合契約測試。
5. **重現步驟與具體證據**：
   - 針對 `tests/` 全目錄檢索結果：
     - `u1scroll`／`u1Emaki`：**0 檔**
     - `pendingSkillIntroduction`／`unseenRewards` 針對第 10–13 招公開版：**0 檔**
     - `isStageLab === false` 下的式神正式圖檢查：**0 檔**
     - `LUFS`／`ebur128` 響度一致性檢查：**0 檔**
   - 因而 `npm run test:current` 雖達 `1,360 PASS / 0 FAIL`，仍遺漏了本報告的 `P1-01`、`P1-02`、`P1-03`、`P2-01`、`P2-04`。
6. **建議修復方式**：
   - 新增一支輕量「公開發布契約測試」（`tests/public-release-contract.test.cjs`），專門在模擬 `https://yorkwahaha.github.io/yokai-delivery/`（無任何 DEV 參數）下檢核：
     1. DEV 隔離（含 `u1scroll=1`、`dev=1`、`stageLab=1`、`skillLab=expansion`、`bossStagger=1`、`draft=guided`、`fusionlab=1`、`sealTrial=1`）；
     2. 式神公開版成品圖與 Lv5 黑狼載入；
     3. 第 7–13 招全數納入公開版 `pendingSkillIntroduction` 與 `unseenRewards`；
     4. 舊存檔 `completed` 推導下一關解鎖；
     5. 靜音進後四關再解除靜音後 `GainNode` 補掛。
   - 另在音訊靜態檢核加入 S1–S8 BGM 響度區間檢查（或工具腳本報表），避免單純靠 `-0.5 dBFS` 峰值門檻漏掉過小聲的 Boss 曲。
7. **修復後的回歸風險**：
   - 極低：新增測試不修改任何既有歷史／現行斷言。
8. **建議驗收標準**：
   - `npm run test:current` 納入上述契約測試並全數 PASS，且刻意還原任一 P1/P2 缺陷時測試可立即紅燈攔截。

---

### P2-06｜發布文件、狀態清冊與 Git 追蹤內容殘留嚴重不一致，且 Stable Audio 3 授權條款未留存公開發布核對記錄

1. **編號與嚴重度**：`P2-06`｜**P2（後續交接誤判、殘留舊檔部署與素材授權合規風險）**（已確認）
2. **影響關卡／裝置／玩家情境**：教師公開分享、後續 Codex／ChatGPT 接手開發與素材授權合規審查。
3. **相關檔案、行號與函式**：
   - `README.md:23-24`（仍寫目前正式站點部署在 `0e5875d` 第二關版本、工作樹未合併）
   - `roadmap.md:18-20`（在 2026-11-28 公開發布段落正下方仍寫「未提交、推送、部署。後四關及新四招仍 DEV」）
   - `docs/STAGE_PATHS.json:12-16, 155, 191-192`（仍保留 `published_head: "0e5875d5..."`、`no_commit_or_deploy: true`，並指向已封存文件 `docs/RAIN_PORT_DELIVERY_TRIAL_20261031.md` 與 `docs/SAKURA_PASS_DELIVERY_TRIAL_20261116.md`）
   - `docs/FIRST_FOUR_STAGES_POLISH_PHASE_E_20261125.md` 與 `docs/FIRST_FOUR_STAGES_QUALITY_BALANCE_AUDIT_20261125.md`（共 2 處斷裂相對連結）
   - Git 仍追蹤 3 份舊版第二關封存素材：`art/stage2-rain-port/archive/legacy-pebble-ground-20261101/ground_stone*.webp`（會隨 GitHub Pages 公開）
   - `docs/agent-handoff.md:8` 明確註記「Stable Audio 3 商業使用須另核對 Community License 資格與註冊」，而 `0f57926` 已將 57 支 Stable Audio 3 Medium 生成之後四關音效正式公開至 `assets/audio/`，目前倉庫中未見授權資格／免費教育非商業聲明或註冊記錄檔。
4. **問題根因**：
   - 發布 `0f57926` 時集中更新了程式碼、素材與主要手冊，但未同步回頭清查 `README.md`、`roadmap.md` 舊「下一步」段落與 `docs/STAGE_PATHS.json` 頂部中繼資料，也未將早期 `git add` 進去的 3 張 `art/stage2-rain-port/archive/` 移出追蹤。
5. **重現步驟與具體證據**：
   - 直接閱讀 `README.md:23-24`、`roadmap.md:18-20`、`docs/STAGE_PATHS.json:12-16` 即可見矛盾敘述；`git ls-files art/` 回傳 3 份 `art/stage2-rain-port/archive/legacy-pebble-ground-20261101/ground_stone*.webp`。
6. **建議修復方式**：
   - 同步更新 `README.md`、`roadmap.md`（移除或改寫過期的「未部署／仍 DEV」舊段落）與 `docs/STAGE_PATHS.json`（更新 `published_head`、移除 `no_commit_or_deploy: true`、修正封存文件路徑），並修復 2 處斷裂相對連結。
   - 待使用者授權後，以 `git rm --cached` 將 3 份 `art/stage2-rain-port/archive/` 移出公開追蹤（保留本機原檔）。
   - 由專案擁有者確認 Stable Audio 3 Medium Community License（如年營收／非商業課堂使用資格與帳號註冊義務）並於授權說明文件留存日期與結論；另同步確認 4 首 S1–S4 ACE-Step 1.5 XL Turbo Boss BGM 之生成來源與授權記錄均已登載。
7. **修復後的回歸風險**：
   - 極低：文件與 `git rm --cached` 不影響遊戲執行（已確認 3 份 `legacy-pebble-ground` 無任何程式參照）。
8. **建議驗收標準**：
   - `git ls-files art/` 為空；`README.md`、`roadmap.md`、`docs/STAGE_PATHS.json` 發布狀態三方一致；所有現役 `docs/` 相對連結 0 斷鏈；音訊授權清單完整記錄 Stable Audio 3 與 ACE-Step 來源。

---

### P3-01｜前四關多王錯峰（`earlyBossStagger`）仍限 DEV `?bossStagger=1`，課堂試玩須注意前四關多王同時出招壓力

1. **編號與嚴重度**：`P3-01`｜**P3（刻意保留待真人驗收，但具體驗落差風險）**（程式碼確認）
2. **影響關卡／裝置／玩家情境**：第 1–4 關雙王／多王同場段落之公開版學生玩家（相較第 5–8 關預設啟用多王錯峰）。
3. **相關檔案、行號與函式**：
   - `js/game.js:515-516`（`earlyBossStagger` 限 `DEV_MODE.isDevMode && bossStagger === '1'`）
   - `js/game.js:5482-5483`（傳入 `BOSS_AI.step` 之 `stagger` 與 `earlyStagger`）
4. **問題根因**：
   - 依既有規格刻意先不變更前四關正式平衡，將前四關多王錯峰隔離在 DEV 參數，待真人課堂試玩後再決定是否全面開啟。
5. **重現步驟與具體證據**：
   - `js/game.js:515-516` 明確鎖在 `isDevMode && bossStagger === '1'`。
6. **建議修復方式**：
   - 本階段**不擅自改正式平衡**；請教師與學生在課堂試玩時特別觀察 S2–S4 多王同時出招是否出現無解閃避或過高挫敗，若回報偏硬，再於下一版授權開放。
7. **修復後的回歸風險**：
   - 若未來開啟，須重檢 S1–S4 通關時長與傷血曲線，避免前四關難度過低。
8. **建議驗收標準**：
   - 課堂試玩回饋明確記錄「S2–S4 多王是否需要開啟錯峰」之決策。

---

### P3-02｜正式 JS 仍殘留休眠中的 `art/` 參考路徑與 `kyoto` loopback-only 保護語句

1. **編號與嚴重度**：`P3-02`｜**P3（程式碼整潔度與未來誤開風險）**（程式碼確認）
2. **影響關卡／裝置／玩家情境**：公開版現行不會觸發（已驗證 0 次請求），屬維護性債務。
3. **相關檔案、行號與函式**：
   - `js/assets.js:858, 3192, 3223`（`art/fusion/candidates/` 與 `STAGE8_PREVIEW_ENABLED = false` 保護之 `art/stage8-yomi/sliced_v2/`）
   - `js/delivery-icon-art.js:41`（`art/delivery-icons/`，僅在 DEV `?deliveryArt=1` 觸發）
   - `js/audio.js:1146`（`if (name.startsWith('kyoto') && !window.DEV_MODE?.isLoopback?.(window.location)) return;` — 目前無呼叫端傳入 `kyoto*`，因 S5–S8 已改走 `stageLabCue`，但該註解仍稱 Kyoto 為未發布關卡）
4. **問題根因**：
   - 開發過渡期遺留的 DEV 預覽路徑與過期註解，未在 8 關公開後集中清整。
5. **重現步驟與具體證據**：
   - 靜態掃描 `js/` 全部檔案與 `audit_public_browser.cjs` 網路監聽確認：公開版 0 次觸發上述路徑。
6. **建議修復方式**：
   - 後續整併週期清除已退役的 `STAGE8_PREVIEW_ENABLED` 區塊，並更新 `js/audio.js:1143-1146` 過期註解；若 `fusion` 仍依規範保留程式與素材，則維持原樣隔離即可。
7. **修復後的回歸風險**：
   - 極低（須遵守 AGENTS.md「融合系統停止但保留程式及素材」之規則，不可刪除融合模組）。
8. **建議驗收標準**：
   - 公開版 JS 不再存在指向已不存在目錄（如 `art/stage8-yomi/sliced_v2/`）之死碼。

---

### P3-03｜第 5、6 關第三王外觀尚未獨立化，及第 8 關結尾曲 176.85s 長版意圖待確認

1. **編號與嚴重度**：`P3-03`｜**P3（已知未完成項目與資源體積評估）**（已確認）
2. **影響關卡／裝置／玩家情境**：第 5 關（`hyakki-kyoto`）、第 6 關（`snow-temple`）第三王辨識度，以及第 8 關（`yomi`）通關結尾曲下載量（5.11 MiB）。
3. **相關檔案、行號與函式**：
   - `js/kyoto-procession.js`／`js/snow-temple-combat.js`（兩關第三王已具獨立戰鬥腳本，但視覺外觀仍與第一王共用；候選存於本機 `art/yokai-late-boss-art-pack/`，因造型一致性未過關而暫不接入）
   - `assets/audio/bgm/stages/yomi/yomi__ending.mp3`（176.853 秒、5.11 MiB）
4. **問題根因**：
   - 依既有計畫屬明確標記的已知未完成項目，先以既有穩定圖檔公開試玩，不強行接入造型不一致的候選圖；`yomi__ending.mp3` 依規定保留原長不擅自剪裁。
5. **重現步驟與具體證據**：
   - 審查確認第 8 關第三王（玄巖墓蛇）維持原圓形特效，未被冥門骸武者矩形重斬素材誤替換（`yomiHeavySlash: true`、`yomiSerpent: true`）；第 5、6 關第三王於公開版 0 缺圖。
6. **建議修復方式**：
   - 維持現狀進入課堂試玩；待後續美術重新定案 S5/S6 第三王一致造型，並由作者確認 `yomi__ending.mp3` 是否維持完整終章演奏曲。
7. **修復後的回歸風險**：
   - 無（現階段不異動）。
8. **建議驗收標準**：
   - 課堂試玩期間確認 S5/S6 第三王機制可辨識、S8 破關播畢終章曲與結算畫面不卡頓。

---

### P3-04｜11 份已追蹤 `docs/*.md` 含有本機開發路徑或區網 IP（無憑證外洩）

1. **編號與嚴重度**：`P3-04`｜**P3（公開 GitHub 倉庫文件衛生）**（已確認）
2. **影響關卡／裝置／玩家情境**：公開 GitHub 倉庫讀者，不影響遊戲執行與安全性。
3. **相關檔案、行號與函式**：
   - 11 份已追蹤 `docs/*.md`（含 `AGENTS.md`、`docs/agent-handoff.md` 等工作規範與近期報告，內含 `I:/Projects/yokai-delivery` 或本機測試區網 `192.168.50.107`）。
4. **問題根因**：
   - 內部多 Agent 協作交接文件直接存放在公開 repo 之 `docs/` 目錄下。
5. **重現步驟與具體證據**：
   - 針對全倉庫 2,413 個追蹤檔執行正規式掃描：0 筆 API Key／Token／密碼／Bearer 憑證；僅 11 份文件含本機磁碟路徑或區網 IP。
6. **建議修復方式**：
   - 若介意公開揭露本機工作目錄結構，可於後續版本將內網測試紀錄收斂或改寫為相對路徑；目前不構成資安風險。
7. **修復後的回歸風險**：
   - 無。
8. **建議驗收標準**：
   - 未來新增文件持續維持零密鑰、優先使用倉庫相對路徑。

---

## 三、七大審查面向（A–G）總檢核表

| 面向 | 狀態 | 核心檢核結論 |
|---|---|---|
| **A. 公開發布與 DEV 隔離** | **多數通過，2 項待修** | 8 關在零 DEV 參數下正常解鎖與載入、0 `art/` 請求、0 `404`、0 過期 `?v=`、融合與 guided draft 嚴格隔離；但 **`P1-01`（式神 19 檔誤鎖 DEV）** 與 **`P2-01`（`?u1scroll=1` 未隔離）** 須修補；`P2-04` 建議補齊舊存檔推導。 |
| **B. 八關玩法與 Boss 狀態機** | **技術面完整，待真人驗收** | 8 關起點與 1,690 個答題格於 2D/2.5D 均 0 卡牆／0 越界；S7 泥濘池、S8 重斬矩形與玄巖墓蛇圓形隔離正確；S5–S8 多王錯峰開啟，S1–S4 多王錯峰依規劃維持 DEV（`P3-01`）。自然長局與尾王擊殺演出待真人實跑。 |
| **C. 十三招主動技能與抽卡** | **核心運作完整，2 項 P1** | 妖刀起手、四主動槽、最高 Lv5、每招最多 2 不重複變異、融合停用皆符合規範；41 份新四招圖與 14 支專屬音效全數到位。但 **`P1-01`（第 9 招公開圖退化）** 與 **`P1-02`（第 10–13 招缺公開首次必出與防飢餓保底）** 直接影響玩家體驗。 |
| **D. 日文單字配送與教學體驗** | **資料完整，iPad 語音閃避有風險** | 140 唯一日文詞彙＋140 唯一中文釋義＋140 圖片＋140 MP3 全數對齊且無重複／缺檔；S8 總複習彙整正確；`あめ`/`は` 音檔路由正確無碰撞。唯 **`P1-04`** 可能讓 iPad Safari 單字發音被 BGM 壓過。 |
| **E. 效能、記憶體與 iPad 相容** | **基本可控，長局與音訊待補強** | `js/world.js` 區塊快取有正確回收、`js/game-skill-expansion.js` 卡圖快取有上限（limit 26）；但 **`P1-04`（iPad 音量架構）**、**`P2-02`（S4 竹林／配送圖／單字 PCM 累積）** 與 **`P2-03`（285 MiB 部署體積）** 須在實體 iPad 長時間連玩中重點觀察。 |
| **F. 安全、隱私、SW 與存檔** | **安全良好** | 0 金鑰外洩、損壞與惡意 `localStorage` 不崩潰且無原型鏈污染、SW 1,718 筆媒體雜湊 0 漂移、71 份異動腳本 `?v=` 全數更新。缺點僅 `P2-01`、`P2-03`（字型未入 SW）、`P2-04`。 |
| **G. 發布、文件與授權狀態** | **文件過期，授權須補確認** | `P2-06`（`README.md`、`roadmap.md`、`STAGE_PATHS.json` 仍殘留舊版未發布敘述；3 張舊 `art/` 未移出追蹤；Stable Audio 3 Community License 公開發布條款尚未留存正式核對紀錄）。HanWang 等本機測試字型已確認未進入公開 Git。 |

---

## 四、各關與整體品質評分（技術完成度 vs 實玩品質分列）

> **評分說明**：本審查嚴格區分「**技術完成度（依程式碼、素材、幾何、音訊量測與受控測試可驗證分數）**」與「**實玩與實體裝置品質（需真人自然長局、實體 iPad Safari、手把與教師教學體驗驗證）**」。在真人與實體 iPad 完成驗收前，實玩品質一律標記為 **「待驗收」**，不以自動化分數取代真人結論。

| 關卡 | 技術完成度（/100） | 實玩與實體裝置品質 | 主要扣分點與觀察重點 |
|---|---:|---|---|
| **S1 百鬼夜行町（`night-town`）** | **87 / 100** | 待真人／iPad 驗收 | 結構與母風格最成熟；扣分於 `P1-03`（獨立 Boss 曲低 6.6 LU）、`P1-04`（iPad BGM 語音閃避）。 |
| **S2 驟雨漁港（`rain-port`）** | **85 / 100** | 待真人／iPad 驗收 | 具獨立記憶體回收與雨港演出；扣分於 `P1-03`（Boss 曲低 7.4 LU，全場落差最大）、`P1-04`、3 份舊 `art/` 殘留追蹤。 |
| **S3 落櫻山道（`sakura-pass`）** | **85 / 100** | 待真人／iPad 驗收 | 專屬三招櫻天狗 AI 與幾何齊備；扣分於 `P1-03`（Boss 曲低 6.8 LU、True Peak 僅 `-8.2 dBFS`）、`P1-04`、`P3-01`（多王未錯峰）。 |
| **S4 迷霧竹林（`bamboo-maze`）** | **79 / 100** | 待真人／iPad 驗收 | 扣分於 `P1-01`（首關正式解鎖之式神 Lv5 黑白雙狼在公開版退回舊圖）、`P1-03`（Boss 曲低 5.6 LU）、`P2-02`（`BAMBOO_ART` 無 `unload()`）、`P1-04`。 |
| **S5 百鬼京町（`hyakki-kyoto`）** | **82 / 100** | 待真人／iPad 驗收 | 69 張場景圖與音訊 0 缺檔、戰鬥曲／Boss 曲響度平衡佳（`-15.5` vs `-15.0 LUFS`）；扣分於 `P1-01`、`P1-02`（破 S4 解鎖之破魔神弓缺保底必出）、`P1-04`（靜音進關 GainNode 脫鉤）、`P3-03`（第三王共用外觀）。 |
| **S6 寒雪神社（`snow-temple`）** | **82 / 100** | 待真人／iPad 驗收 | 54 張場景圖與音訊 0 缺檔；扣分同 S5（`P1-01`、`P1-02` 妖絲缺保底、`P1-04`、`P3-03` 第三王共用外觀）。 |
| **S7 靈渡河川（`spirit-ferry`）** | **83 / 100** | 待真人／iPad 驗收 | 沉鐘鬼將泥濘池與場景／音訊完整接入、0 缺檔；扣分於 `P1-01`、`P1-02`（冰魄妖毬缺保底）、`P1-04`。 |
| **S8 黃泉境（`yomi`）** | **83 / 100** | 待真人／iPad 驗收 | 冥門骸武者矩形重斬與玄巖墓蛇圓形特效正確分離、140 詞總複習完整；扣分於 `P1-01`、`P1-02`（冥風風穴缺保底）、`P1-04`、`P2-02`（140 詞圖／PCM 累積）、`P3-03`（176.85s 結尾曲 5.11 MiB）。 |
| **整體總評** | **83 / 100（技術可上線試玩，但建議優先補上 4 項 P1）** | **待實體 iPad 與課堂自然長局驗收** | 無 P0 阻斷錯誤；技術骨架、資料一致性與 DEV 隔離品質高，主要失分集中在「公開切換遺漏（式神圖／新四招保底）」、「S1–S4 Boss BGM 響度」與「iPad 音訊／記憶體細節」。 |

---

## 五、必須由真人與實體裝置完成之驗收清單（本輪未代測）

1. **實體 iPad Safari（含不同世代／低記憶體機型）**：
   - 教室實際 Wi-Fi 首次載入體感與字型顯示（`MoonStars Kai T` 辨識度與無掉字）。
   - 驗證 `P1-04`：開聲進關 vs **靜音進關再解除靜音**（S1 與 S5/S8），確認 BGM 音量是否過大、單字朗讀時 BGM 是否確實降音、鎖屏／切回背景恢復後是否無聲。
   - 連續遊玩 4～8 關（含 S8 140 詞總複習）觀察是否發熱、掉幀或 Safari 強制重整分頁。
   - 觸控雙指（虛擬搖桿＋閃避／大招／安全讀題）與直／橫向安全區操作。
2. **自然長局玩法、難度與手感**：
   - 第 5–8 關自然通關節奏、彈幕／預警清晰度、S7 泥濘池與 S8 矩形重斬判定手感。
   - 第 10–13 招 Lv1–Lv5 與 16 張變異卡實際視覺判讀（尤其神弓蓄力遮擋、妖絲線段可讀性、冰球彈跳與風穴吸怪視覺回饋）。
   - S1–S4 多王同場難度評估（決定 `P3-01` 是否開啟錯峰）。
3. **教室教學與聽覺審核**：
   - 140 個日文單字之語音發音自然度、音量平衡與中文釋義教學精準度。
   - 實體藍牙手把（選單、夜行典籍空間導覽、戰鬥操作）實機操作。

---

## 六、交接修復清單（依嚴重度與相依性排序，可直接派工 Codex／ChatGPT）

### Phase 1：課堂試玩前強烈建議完成（P1 核心修復，估計工作量低、收益最高）

1. **[T1 / 對應 P1-01] 解鎖公開版第 9 招式神正式美術**
   - 檔案：`js/game-shikigami.js:22-23, 67-80`、`js/game.js:3455`、`index.html`（更新 `?v=`）。
   - 動作：移除 `isStageLab` 限制，使公開版正式使用 `shikigami__card.webp`、白狼咬擊、召喚／離場特效，以及 Lv5 黑狼三組動作影格。
2. **[T2 / 對應 P1-02] 將第 10–13 招納入公開版首次介紹與防飢餓保底**
   - 檔案：`js/store.js:342, 378-401`、`js/game.js:2081-2082`、`index.html`（更新 `?v=`）。
   - 動作：擴充 `pendingIntroductions`／`markSkillExperienced` 涵蓋所有已發布擴充技能，並讓公開版 `unseenRewards` 納入已解鎖的 10–13 招（不綁定 DEV `guidedExpansionDraft`）。
3. **[T3 / 對應 P1-04] 修復後四關靜音進關後 `GainNode` 永不掛載缺陷（並評估統一 S1–S4 音量路由）**
   - 檔案：`js/audio.js:187-243, 905-918, 1228-1250`、`index.html`（更新 `?v=`）。
   - 動作：抽離冪等 `ensureStageMediaNode(track)`，於解除靜音／手勢解鎖／播放時補掛 `MediaElementAudioSourceNode`＋`GainNode`；第二階段評估把 S1–S4 BGM 亦改經 `GainNode` 讓 iPad 支援語音閃避（必須實體 iPad 實測）。
4. **[T4 / 對應 P1-03] 校準前四關獨立 Boss BGM 響度（需使用者核准音檔處理）**
   - 檔案：`assets/audio/bgm/stages/{night-town,rain-port,sakura-pass,bamboo-maze}/*__boss.mp3`、`service-worker.js`、資產清冊。
   - 動作：先備份原檔，將四首 S1–S4 Boss BGM 調整至約 `-12.5` 至 `-11.5 LUFS` 且 True Peak ≤ `-0.8 dBFS`（Sample Peak ≤ `-0.5 dBFS`），同步更新 `MEDIA_REVISIONS` 與 `asset_registry.py --check`。

### Phase 2：快速硬化與測試補漏（P2，可與 Phase 1 同批或緊接執行）

5. **[T5 / 對應 P2-01 + P2-04] 封鎖公開版 `?u1scroll=1` 並補齊 `STORE` 舊存檔解鎖推導**
   - 檔案：`js/ui.js:12-18`、`js/store.js:79-111, 340`。
   - 動作：為 `U1_EMAKI_PREVIEW` 加上 `DEV_MODE.isDevMode` 守門；於 `STORE` `decodeBaseline`/`syncJournal` 依 `completed`/`clears` 補齊 `unlocked[NEXT_STAGE[id]]`。
6. **[T6 / 對應 P2-05] 補齊公開發布契約自動化測試**
   - 檔案：新增 `tests/public-release-contract.test.cjs`（及音訊響度區間檢核）。
   - 動作：以公開 hostname 覆蓋 T1～T5 全部修復點，確保未來任何發布都不再漏過公開切換與響度落差。
7. **[T7 / 對應 P2-06] 同步發布文件、移除 3 份追蹤舊圖與補齊授權記錄**
   - 檔案：`README.md`、`roadmap.md`、`docs/STAGE_PATHS.json`、2 份斷鏈文件、`git rm --cached art/stage2-rain-port/archive/...`（須使用者授權）、授權紀錄檔（核對 Stable Audio 3 Community License 與 ACE-Step 來源）。

### Phase 3：課堂首輪試玩後依實機數據優化（P2/P3 長期項目）

8. **[T8 / 對應 P2-02] iPad 連跑多關記憶體防線**
   - 檔案：`js/bamboo-art.js`、`js/delivery-icon-art.js`、`js/audio.js`、`js/game.js`。
   - 動作：補上 `BAMBOO_ART.unload()`、配送圖快取 LRU 上限（32 張）、單字解碼 PCM `AudioBuffer` LRU 上限（24–32 支）與切關釋放舊 BGM 軌。
9. **[T9 / 對應 P2-03] 清理無效本機 `@font-face`、將正式字型納入 SW 並評估瘦身部署體積**
   - 檔案：`index.html:94-122`、`service-worker.js`、`assets/fonts/`（移除 4 份未使用試用字型需核准）。
10. **[T10 / 對應 P3-01, P3-02, P3-03] 依課堂回饋決策與收尾**
    - 決定 S1–S4 多王錯峰是否正式啟用；清整休眠 `art/` 死碼；完成 S5/S6 第三王獨立一致美術並確認 `yomi__ending.mp3` 長版保留政策。

## 七、本機修復與驗證（2026-11-28）

公開發布基準仍為 `0f57926`。以下為本機工作樹的修復驗證，等待獨立複查。上文保留 Neon 的原始觀察。

| 編號 | 核實與修復 | 驗證證據 | 狀態 |
| --- | --- | --- | --- |
| P1-01 | 公開玩家在第三關通關後使用雙狼技能卡、白狼與黑狼正式動作及召喚、咬擊、離場接線。 | 公開 hostname Lv5 雙狼受控載入，回歸檢查光柵影格、腳點及特效。 | 已修復並驗證 |
| P1-02 | S4–S7 解鎖維持既有資格，四招沿用解鎖介紹與第五次合資格正常抽卡保底。名額不足時延後，保留變異、御守及既有保護。 | 400 種子 × 20 抽 × 2 組，共 16,000 次。兩組零空牌、零非法重複、零未解鎖洩漏，最多四槽。新增的保底插牌 246 次，全是 Lv1，單張上限，連續最多四次。 | 已修復並驗證 |
| P1-03 | S1 實播 `parade`。S1–S4 Boss 以播放增益補償，四首原檔保留且備份逐一核對 SHA256。 | FFmpeg EBU R128 測八關 16 首實播曲，S1–S4 進王戰差值由 −5.6 至 −7.4 LU 縮至 −0.3 至 −0.6 LU。 | 已修復並驗證 |
| P1-04 | 所有正式 BGM 共用單一 AudioContext，進入播放或解鎖後可補掛 GainNode，每個媒體元素至多建立一次 source。無法建立節點時沿用 HTML 音量。 | 模擬 Safari 在靜音、延遲解鎖、ducking、暫停與重玩條件下驗證。Chrome 實際進度及 gain 通過。Windows WebKit 缺 AudioContext，原生音訊增益未驗證。 | 待實體裝置驗收 |
| P2-01 | 卷軸 query/hash、診斷面板與試用字型宣告由 DEV 門禁控制。 | Chrome 與 WebKit 使用公開 hostname 及 DEV 參數組合，零私有路徑請求。 | 已修復並驗證 |
| P2-02 | 竹林卸載、配送圖 LRU 32、語音 PCM LRU 32、離關釋放舊音軌。 | Chrome 八關切換、黃泉重玩、返回旅路與首頁。數量見下表。 | 已修復並驗證 |
| P2-03 | 封存三份同位元 BGM 舊檔及四份 DEV 字型，正式字型五份納入按需 SW 內容版本。典籍卡框優先使用等像素 WebP，保留 PNG 備援。 | 原先 162 組同雜湊，剩 159 組。資產總量少 11.52 MiB。Chrome 驗證字型快取與 MP3 Range。其餘包含仍有用途的 alias、動態路徑及備援。 | 部分修復 |
| P2-04 | 從合法 `completed` 修補當關與下一關。若舊存檔缺整份解鎖表，可採合法通關次數。匯入保留其他原有關卡、紀錄及金幣。 | 新檔、舊檔、部分欄位、損壞 JSON、非法值與正式／DEV 隔離通過。 | 已修復並驗證 |
| P2-05 | 將公開契約、響度和音訊生命週期納入現行回歸，擴充存檔案例。 | 200 份、1,372 PASS／0 FAIL／1 既有 TODO、0 跳過。83 份退役來源核驗。 | 已修復並驗證 |
| P2-06 | 同步正式發布文件、修補兩處歷史斷鏈，雨港三張舊地板移至統一封存並留復原 SHA256。Stable Audio 3／ACE-Step 原始來源及待確認事項已補。 | 349,432 bytes 舊地板封存後重算 SHA256 相符。Git 未暫存的三筆刪除已核對。授權的實際用途、資格及必要註冊由專案擁有者確認。 | 待使用者決策 |
| P3-01 | 前四關多王錯峰依現行規格限 DEV。 | 公開 hostname 即使帶 `bossStagger=1` 仍維持正式行為。 | 延後處理 |
| P3-02 | 移除已停用的黃泉 `sliced_v2` loader、renderer 及預覽路由。京都公開音效的 catalog 與本機舊試聽 hook 已註明。 | 兩個瀏覽器的公開資源請求未觸及私有路徑。 | 已修復並驗證 |
| P3-03 | S5／S6 第三王外觀與 S8 長版終章曲待人審。 | 共用外觀與獨立戰鬥腳本已確認。 | 延後處理 |
| P3-04 | 歷史交接仍有本機路徑與區網紀錄，屬文件衛生。 | 封存與發布記錄保持可追溯。 | 延後處理 |

### 正常播放配樂

| 關卡 | 檔案戰鬥 LUFS／dBTP | 檔案 Boss LUFS／dBTP | 戰鬥增益 | Boss 增益前 → 後 | 播出戰鬥 LUFS／dBTP | 播出 Boss LUFS／dBTP 前 → 後 | Boss − 戰鬥 LU 前 → 後 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S1 | −11.1／+0.4 | −17.7／−2.9 | 0.270 | 0.270 → 0.539 | −22.5／−11.0 | −29.1／−14.3 → −23.1／−8.3 | −6.6 → −0.6 |
| S2 | −11.0／+0.4 | −18.4／−5.2 | 0.270 | 0.270 → 0.604 | −22.4／−11.0 | −29.8／−16.6 → −22.8／−9.6 | −7.4 → −0.4 |
| S3 | −11.1／+0.2 | −17.9／−8.2 | 0.270 | 0.270 → 0.571 | −22.5／−11.2 | −29.3／−19.6 → −22.8／−13.1 | −6.8 → −0.3 |
| S4 | −11.8／+0.3 | −17.4／−2.0 | 0.270 | 0.270 → 0.480 | −23.2／−11.1 | −28.8／−13.4 → −23.8／−8.4 | −5.6 → −0.6 |
| S5 | −15.5／−0.9 | −15.0／−1.1 | 0.270 | 0.270 → 0.270 | −26.9／−12.3 | −26.4／−12.5 | +0.5 → +0.5 |
| S6 | −14.9／−0.9 | −14.8／−1.1 | 0.270 | 0.270 → 0.270 | −26.3／−12.3 | −26.2／−12.5 | +0.1 → +0.1 |
| S7 | −15.0／−0.9 | −14.8／−0.6 | 0.270 | 0.270 → 0.270 | −26.4／−12.3 | −26.2／−12.0 | +0.2 → +0.2 |
| S8 | −15.1／−0.6 | −14.5／−1.3 | 0.270 | 0.270 → 0.270 | −26.5／−12.0 | −25.9／−12.7 | +0.6 → +0.6 |

播放數字套用實際單軌增益，取正常、無答題及無暫停時的交叉淡出終點。個別音檔 True Peak 與實際單軌 True Peak 分列。四首 Boss 加成為 +6／+7／+6.5／+5 dB，保留音源動態。音檔位元及既有音訊 manifest SHA256 相符，無需改寫。共用 Boss 備用曲 −9.2 LUFS／+0.7 dBTP，增益 0.270，估算播放峰值 −10.7 dBTP。

### 資源與抽卡對照

| 指標 | 基準 | 本機修復後 |
| --- | ---: | ---: |
| 正式 `assets/` Git 路徑的現存檔案 | 1,781 | 1,774 |
| 正式 `assets/` 容量 | 285.38 MiB | 273.86 MiB |
| 多餘的同 SHA256 位元副本 | 166 檔／29.39 MiB | 163 檔／19.70 MiB |
| 竹林圖片離關後由 JS 持有 | 34 | 0 |
| 黃泉境處理 140 詞後的可追蹤圖片／PCM | 140／140 | 32／32 |
| 八關切換後／回首頁的關卡音樂與環境音軌 | 8／8 | 2／0 |
| 黃泉境離開後的圖片／PCM | 140／140 | 0／32 |

容量以所有 Git 追蹤的 `assets/` 檔案、含非媒體資料計算。PNG 比對涵蓋五個大檔，現行 WebP 卡框較 PNG 少 648,191 bytes，所有有 alpha 的像素及 alpha 通道相等，保留既有 PNG。JavaScript 數量來自實際切關的瀏覽器採樣，瀏覽器記憶體與 GPU 釋放未量測。

| 新招 | A → B 局內看過 | A → B 取得 |
| --- | ---: | ---: |
| 破魔・神弓 | 201 → 320 | 54 → 116 |
| 絡新婦・妖絲 | 147 → 186 | 46 → 54 |
| 冰魄・妖毬 | 102 → 143 | 32 → 42 |
| 冥風・風穴 | 45 → 44 | 17 → 14 |

A 組在同一正式抽卡流程中關閉新四招的新增介紹與保底，B 組啟用。各種子有不同的通關資格。依既有順序介紹舊欠卡的多解鎖情境會增加同池競爭。上表為固定種子及選卡策略的計數。逐關解鎖測試獨立確認四招在首次合資格且欠卡順序輪到時均有 Lv1 介紹。

### 瀏覽器和資料驗證

- Chrome 公開 hostname 受控進入八關、跨關、重玩與返回首頁通過。970 個不同公開路徑，0 404、0 console error、0 私有請求。用 Git 追蹤且在工作樹存在的檔案回答，外部字型 CDN 在兩個瀏覽器的重現環境回空樣式。
- Windows WebKit 公開 hostname 八關渲染及重返首頁通過，759 個不同路徑，0 404、0 console error、0 私有請求。此建置缺 AudioContext，原生音訊測試逾時。模擬測試涵蓋 GainNode 及 fallback，實體 iPad 仍需驗證。
- Service Worker 1,720 筆內容版本皆對應 Git 追蹤且存在的檔案，雜湊一致。Chrome 實測正式字型寫入內容版本 cache，冷載 MP3 後以 Range 讀取 32 bytes 回 206。
- 素材清冊 1,723 個本機媒體、151 映射，4 個選用本機原稿依原有規則可缺。舊地板、音樂副本及 DEV 字型共 10 路徑移出發布樹，封存 SHA256 已核對。三張雨港舊圖仍以未暫存刪除顯示在 Git。
- 線上 CDN 回應無法從本機驗證。公開測試使用正式 hostname 的受控重現，部署狀態沿用使用者提供的版本。
