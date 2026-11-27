# 第十至十三招 DEV 實作 V1

狀態 `USER_PLAYTEST_PENDING`。破魔・神弓、絡新婦・妖絲、冰魄・妖毬、冥風・風穴可在隔離 Skill Lab 裝備。五級數值、十六張變異、解鎖條件與同條件傷害比較見 [技術設計](ACTIVE_SKILLS_10_13_DESIGN.md)。發行狀態為公開課堂試玩；正式模式自第一關起開放全部十三招，使用共用隨機抽卡權重；Skill Lab 仍隔離。

## 驗收入口

1. [PC 瀏覽器](http://127.0.0.1:8015/?dev=1&skillLab=expansion) 或 [同區網 iPad Safari](http://192.168.50.107:8015/?dev=1&s3play=1&skillLab=expansion)。開啟右上「DEV 秘術演練」。工作機預覽重開時，使用現有 `tools/serve-tilt.cjs`，設定 `YOKAI_PREVIEW_PORT=8015` 與 `YOKAI_PREVIEW_HOST=0.0.0.0`。預覽依現行規則限制私有 IP。
2. 選普通妖怪、重甲、單首領、三首領或 96 隻高密度配置。「固定敵人位置」適合逐級比較。候選招可選 Lv1～5、各任選兩張變異。妖刀加最多三招候選，合計四槽。
3. 相同配置和種子可重置敵群及測試抽卡。用「測試抽卡」開真實三選一，用「本局構築」確認等級、已取得變異與技能順序。種子控制夾具與選牌。自然走位、暴擊、敵方時序仍走遊戲執行期。
4. 2D／2.5D 可即時切換。測試焦點為神弓遇封印王與前排時的鎖敵、妖絲與風穴在窄巷的可預測性、妖毬的第二跳與終點碎裂。碰撞診斷預設顯示，暫用輪廓和 HUD 單字識別。此階段適合評估機制、力道與敵人的可讀性。

## 程式與資料

| 檔案 | 實作 |
|---|---|
| `js/game-skill-expansion.js` | 四招五級數值、16 變異、發布門禁、空間查詢、投射物與控場生命週期、DEV 素材讀取與音效備援 |
| `js/game-attack-specs.js`、`js/game.js` | 接共用傷害、冷卻、射程、暴擊、碰撞、停火、HUD、Y-sort 與預設敵群 |
| `js/store.js`、`js/game-build-rules.js`、`js/game-catalog.js` | 正式通關資格、發布資格、DEV 牌池及十六張變異 |
| `js/ui.js`、`js/ui-upgrade-trial.js` | 技能 HUD 與匿名門禁、現有卡框和雙層名稱。本局構築沿用現行資料投影 |
| `index.html`、`js/dev-active-skill-lab.js`、`js/dev-active-skill-lab.css` | 私有 DEV 入口、四槽裝備、固定敵群、種子、視角和事件診斷 |
| `tools/serve-tilt.cjs` | 私有預覽幾項已命名的候選素材路徑 |
| `tests/active-skills-10-13.test.cjs`、`tests/helpers/game-runtime.cjs`、`tools/run-tests.cjs` | 數值、玩法、真戰鬥更新與正式隔離回歸 |
| `tools/verify-active-skill-lab-browser.cjs`、`tools/prepare-skill-expansion-art.py` | 受控瀏覽器驗證、ComfyUI 流程、固定種子、原稿和衍生 WebP 清冊 |

正式資格由對應關卡的既有旗標或舊 `clears` 回算，發布另有逐招旗標。一般正式流程的九招維持原出牌流程。DEV 敵群的首領只供演練，排程與存檔採隔離路徑。測試入口保留妖刀起手、四槽限制、Lv5 滿級移出升級、變異去重及同技能連升抑制。

## 美術候選

本機 ComfyUI 首批生成 4 張主卡、16 張變異卡、4 個裁切 HUD 圖示與 17 份戰鬥 raster。每份 WebP 已解碼，雜湊與尺寸與清冊一致，17 份 VFX 均有 Alpha。原始 PNG、模型、種子、尺寸、檔名和完整正反提示詞保存在 [候選清冊](../art/skill-expansion-10-13/manifest.json)。[主卡與變異接觸表](../scratch/active-skill-expansion-cards.png) · [特效接觸表](../scratch/active-skill-expansion-vfx.png)

視覺審查未通過。首批出現偽文字、主體誤成容器、構圖近似及背景殘留。Nova／Copax 探針改善少數輪廓，仍有多餘人物或圖示。Qwen-Image 2.1 本機探針輸出色塊雜訊。保留 [探針接觸表](../scratch/active-skill-expansion-art-probes.png) 與 [Qwen 工作流](../scratch/active-skill-expansion-art-probe/qwen-bow-workflow.json)。所有成品仍為 `ART_CANDIDATE_USER_REVIEW_PENDING`，清冊 `labUse` 為關閉。實機先使用可切換的幾何碰撞診斷。主卡、變異圖和戰鬥 raster 皆待重新生成／人審。

無字插畫需要明確辨識金白和弓及箭、朱紅粉白絲線、可見轉向的青白冰球、中心留空的青綠風穴。沿用現有共用直卡框，變異上方和紙題字為變異名，下方藍色題籤為所屬技能。候選程式只在私有路徑載入清冊，按實際裝備或畫面呈現讀取通過素材。

## 音效需求與備援

下列路徑相對於 `assets/audio/sfx/skills/`。現階段使用現有合成發射與撞擊音。密集同幀撞擊依現有音效節流。風穴持續音目前以一次短提示代替，未接循環檔。來源待後續選 GDC 授權素材剪輯或本機 Stable Audio 3 Medium 自製並試聽。

| 相對路徑 | 觸發 | 建議長度 |
|---|---|---:|
| `hamaya/hamaya__draw.mp3` | 蓄弦開始 | .18–.28s |
| `hamaya/hamaya__release.mp3` | 主箭及追射各出膛一次 | .10–.18s |
| `hamaya/hamaya__impact.mp3` | 一般箭擊及貫穿 | .08–.14s |
| `hamaya/hamaya__heavy__lv05.mp3` | 覺醒主目標重擊 | .22–.38s |
| `spider-silk/spider-silk__cast.mp3` | 絲線展開或單體纏絲 | .15–.25s |
| `spider-silk/spider-silk__cut.mp3` |穿線切割，避免多重尖音疊加 | .07–.12s |
| `spider-silk/spider-silk__collapse.mp3` | 終切、收束或回斬 | .20–.35s |
| `ice-ball/ice-ball__cast.mp3` | 每次一至兩毬同發，單一音 | .10–.18s |
| `ice-ball/ice-ball__impact.mp3` | 撞擊及改向 | .10–.18s |
| `ice-ball/ice-ball__shatter.mp3` | 末次撞擊後碎裂 | .22–.40s |
| `wind-hole/wind-hole__open.mp3` | 主穴或次穴生成 | .18–.30s |
| `wind-hole/wind-hole__suction.mp3` | 生成後 .20s 起，隨清理或收束淡出 | .70–1.20s 可循環 |
| `wind-hole/wind-hole__compress__lv05.mp3` | Lv5 最後 .35s 壓縮開始 | .22–.34s |
| `wind-hole/wind-hole__burst.mp3` | 風壓爆發，次穴使用較低增益 | .30–.50s |

## 驗證與效能

- 起始 `npm test` 為 1,304 通過、0 失敗、1 既有雨港水術美術 TODO。最終為 **1,317 通過、0 失敗、1 相同 TODO**，退出碼 0。相關 JS 語法與 `git diff --check` 通過。既有資產清冊 1,360 檔、151 alias／copy 通過。
- 聚焦 `node --test tests/active-skills-10-13.test.cjs` 為 **13/13**。Phase B 從 4 項缺失實作測試轉綠，再做 Chrome 近程扣血及構築驗證。Phase C 新增 4 項，覆蓋穿線、端點失效、單首領、位移與牆壁，通過後驗 LAN 觸控視口。最終聚焦涵蓋四招五級、全部變異單卡與兩兩組合、共用公式、雙毬及 Boss 命中上限、物件上限、退場、兩種閱讀及反噬停火、正式舊檔回算、缺檔備援。
- `node tools/verify-active-skill-lab-browser.cjs` 退出碼 0。Chrome 以實際遊戲入口驗證不到一秒的神弓／妖毬扣血、雙變異限制、本局構築、雙層題字、暫停、種子重現及正式存檔位元不變。同區網 1180×820 觸控視口驗三首領、96 隻密群和兩種視角。兩個場景無頁面例外或同源 HTTP 錯誤。 [報告](../scratch/active-skill-expansion-browser/report.json) · [本局構築](../scratch/active-skill-expansion-browser/build.png) · [變異雙層題字](../scratch/active-skill-expansion-browser/mutation.png) · [三首領](../scratch/active-skill-expansion-browser/three-bosses.png)
- 每活動更新最多建立一次 128px 敵人格，查詢最多 96 筆，Boss 有獨立短名單。三條絲線共用去重，最長每 .10s 判定，風穴最多 8 個取點、鄰域每點 24 筆、每 .12s 更新吸引名單。場上最多 2 箭、2 毬、14 冰晶、3 絲線、1 風穴及 16 個短特效。沒有新增常駐 Canvas。
- Chrome 桌面取樣在 96 隻怪與四槽、普通追逐下各取 180 幀。2.5D／2D 的 rAF 間隔中位數皆為 16.7ms，p95 分別為 16.7／16.8ms。樣本使用診斷模式。實體 iPad Air M4 Safari 的長局、投影、觸控、資產版幀時間及主觀平衡仍待玩家確認。
