# 待審與候選美術資產隔離規格盤點清冊 (E15-03)

- **生效日期**：2026-10-15 03:26（使用者最新最高指示更新）
- **執行 Agent**：AGY（Gemini 3.8 Flash High，Herdr pane `w7:p4`）
- **規範依據**：[AGENTS.md](../AGENTS.md)（10/15 03:26 指示）、[art-asset-only-standard.md](art-asset-only-standard.md)、[stage-identity-standard.md](stage-identity-standard.md)、[stage-art-path-migration-20261015.md](stage-art-path-migration-20261015.md)
- **唯一寫入目標**：`docs/e15-agy-art-review-manifest-20261015.md`（零生圖/零API/零音訊/無git變更）

---

## 一、關卡美術候選與現役資產全量盤點表 (2026-10-15 03:26 更新)

| 關卡與資產項目 | 規範化路徑 (含舊來源) | 規格尺寸與 SHA-256 (WebP) | 審核狀態與依據 | Runtime 與已有 QA 狀態 | 尚缺內容與下一步工作 |
|---|---|---|---|---|---|
| **Stage 2 石木過渡 (修復版 v2)** | `art/stage2-rain-port/scene/G_stone_wood_transition_v2.webp`<br>*(舊: edge-rework/candidate...)* | 512×512 RGB<br>90,730 B<br>`8ba771c198b48fb601cfc3893d702c8e9540c11b3bf3b11e02def9ea91648215`<br>[完整清冊](../art/stage2-rain-port/manifest.json) | **`USER_APPROVED` (素材通過)**<br>03:26 使用者對照視覺通過，此素材不再 WAITING_HUMAN；非整關發行許可 | **未接線**<br>`js/words.js` 維持 `"ground"`，正式海關維持現役硬切 | **缺口**：缺斜向拐角與西石東木反向塊。<br>**下一步**：訂立 Chunk 行座標過渡切換接口。 |
| **Stage 2 專用小怪 (潮目小僧)** | `art/stage2-rain-port/characters/E_shiome_idle.webp`<br>`E_shiome_attack.webp`<br>*(同步: assets/img/rain-port/enemies/)* | 250×220 RGBA<br>idle: 37,608 B (`ff9442bcd085...`)<br>atk: 58,596 B (`e7a5d9d6980f...`)<br>腳錨 (125, 220)<br>[完整清冊](../art/stage2-rain-port/manifest.json) | **`USER_APPROVED` (角色造型)**<br>10/14 使用者明確解除角色閘門；**上層 v1 稿維持拒收** | **已接線待整關驗收**<br>已有 11/11、86/86、R7 Chrome QA 通過；但**整關雨港人審仍未結案** | **缺口**：角色本體無缺口。<br>**防護**：原檔保留嚴禁重繪。 |
| **Stage 2 專屬 Boss (碇海坊主)** | `art/stage2-rain-port/characters/B_ikari_idle.webp`<br>`B_ikari_attack.webp`<br>*(同步: assets/img/rain-port/enemies/)* | 350×330 RGBA<br>idle: 123,806 B (`5a90500d7b55...`)<br>atk: 119,126 B (`6abeef6cbd3c...`)<br>錨點 (175, 330)<br>[完整清冊](../art/stage2-rain-port/manifest.json) | **`USER_APPROVED` (角色造型)**<br>10/14 使用者明確解除角色閘門；**上層 v1 稿維持拒收** | **已接線待整關驗收**<br>已有潮汐技能契約與 Chrome 渲染測試；但**整關雨港人審仍未結案** | **缺口**：角色本體無缺口。<br>**防護**：原檔保留嚴禁重繪。 |
| **Stage 3 主地面 (3張現役)** | `art/stage3-sakura-pass/scene/`<br>`G_mountain_dirt.webp` (163,666 B)<br>`G_trans_dirt_to_steps_h.webp` (147,424 B)<br>`G_sakura_steps.webp` (139,996 B) | 512×512 RGB<br>dirt: `882135a3...`<br>trans_h: `262462da95d8...`<br>steps: `6935c527...`<br>[完整清冊](../art/stage3-sakura-pass/manifest.json) | **`現役保留／已授權接線`**<br>[stage3-ground-integrated-20261014.md](stage3-ground-integrated-20261014.md)；非整關核准 | **已接線**<br>`js/renderer.js` 執行 1D 水平 `tx < 3` 土、`tx = 3` 過渡、`tx >= 4` 石階 | **缺口**：缺乏自適應 2D 轉角（方磚重複）；不依賴人審可規格化減重複交錯規則。 |
| **Stage 3 建築與地標 (神樂殿/古櫻)** | `art/stage3-sakura-pass/scene/`<br>`H_shrine_pavilion.webp` (82,218 B)<br>`O_corrupted_sakura.webp` (138,578 B) | 正面 2.5D RGBA<br>shrine: 470×440 (`835fe17a...`)<br>sakura: 460×460 (`7dd88ec8...`)<br>[完整清冊](../art/stage3-sakura-pass/manifest.json) | **`現役保留／已授權接線`**<br>[stage3-scene-buildings-20261014.md](stage3-scene-buildings-20261014.md)；非整關核准 | **已接線待整關驗收**<br>已有 R10、53/53 自動化測試通過；但**整關妖櫻人審仍未結案** | **缺口**：無建築缺口。<br>**防護**：保留不重製。 |
| **Stage 3 巨石庭院貼花與預覽** | `art/stage3-sakura-pass/candidates/terrain-v2/junction-experiments/candidate_exp_b_shrine_courtyard_decal.*` | 1024×1024 RGBA<br>246,790 B | **`HUMAN_FAIL_REJECTED`**<br>03:26 使用者明確拒收：巨石比例過大、屋缺體積、泥地太規則重複 | **未接線**<br>尚未接入渲染循環 | **拒收重設**：重設合理角色/屋/石比例、2.5D 神社體積感、非規則無縫地表。 |
| **Stage 3 專用妖怪 (櫻精靈/花天狗)** | `art/stage3-sakura-pass/characters/`<br>`E_sakura_spirit_idle.webp`<br>`B_hana_tengu_idle.webp` | RGBA 母版<br>minion: 250×240, 29,172 B (`e3d62da6...`)<br>boss: 380×360, 58,230 B (`9483d384...`)<br>[完整清冊](../art/stage3-sakura-pass/manifest.json) | **`WAITING_HUMAN`**<br>看板新增子門 §3：未見明確核准紀錄，禁止接線 | **未接線**<br>執行期仍調用共通怪與通用 `window.ART.boss` | **缺口**：**完全欠缺 ATTACK 攻擊動作幀**。<br>**下一步**：訂立同源姿態變形 Prompt 與判定框規格。 |
| **Stage 4 黑暗竹泥底與大落葉** | `art/stage4-bamboo-maze/candidates/candidate_ground_bamboo_dirt.*`<br>`preview_stage4_core_trio_scene.png` | 512×512 RGB / 組合預覽 | **`HUMAN_FAIL_REJECTED`**<br>03:26 使用者明確拒收：黑暗竹泥底地、角色高度大落葉及組合預覽 | **未接線**<br>無專屬視覺目錄與渲染分支 | **拒收重設**：重設明亮地面、細長小葉/稀疏點綴、半水墨＋半浮世繪木版。 |
| **Stage 4 專用妖怪母版 (筍童子/竹影魅妖)** | `art/stage4-bamboo-maze/characters/`<br>`E_takenoko_spirit_idle.webp`<br>`B_chikuin_meiyo_idle.webp` | RGBA 母版<br>minion: 250×240, 12,672 B (`91c2a762...`)<br>boss: 380×360, 27,060 B (`66ccdcb5...`)<br>[完整清冊](../art/stage4-bamboo-maze/manifest.json) | **`WAITING_HUMAN` (未判定母版)**<br>03:26 明確維持未判定，**嚴禁誤標拒收或批准** | **未接線**<br>執行期僅有詞包配置，無專屬資產與 AI | **缺口**：**完全欠缺 ATTACK 攻擊動作幀**；缺 3 款竹舍建築、地標、道具。<br>**下一步**：推導建築 slot cycling 矩陣。 |

---

## 二、關鍵防混淆與核准證據辨析 (03:26 增補)

1. **Stage 2 石木過渡 v2 正式獲准**：
   - 使用者於 2026-10-15 03:26 正式判定 `G_stone_wood_transition_v2.webp`（MAD 10.07 / 6.00 / 4.73）對照視覺通過，解除候選 WAITING_HUMAN 狀態。
   - **邊界確認**：素材核准非整關發行許可；衍生方向、runtime 接線與整關驗收仍須另驗。
2. **Stage 3 拒收範圍不擴大**：
   - 拒收對象僅限巨石庭院貼花 (`candidate_exp_b_shrine_courtyard_decal`) 與正交階差矩形轉角。
   - **嚴禁擴大拒收**至現役神樂殿 (`H_shrine_pavilion`)、古櫻 (`O_corrupted_sakura`) 或三張現役地面 (`G_mountain_dirt`、`G_trans_dirt_to_steps_h`、`G_sakura_steps`)。
3. **Stage 4 拒收與未判定母版嚴格區分**：
   - 拒收對象為黑暗竹泥底地、角色高度巨大落葉及其組合預覽。
   - 專屬小怪筍童子 (`E_takenoko_spirit_idle`) 與 Boss 竹影魅妖 (`B_chikuin_meiyo_idle`) 形象母版**維持 WAITING_HUMAN 未判定**，未被拒收，亦未獲批准。
4. **Stage 1 切鏡驗證**：
   - 使用者親測回報 `USER_REPORTED_VISUAL_OK`（目前沒什麼問題），非全裝置 FPS 全過。

---

## 三、安全守則執行核對

- [x] **單一檔案獨占更新**：精確更新 `docs/e15-agy-art-review-manifest-20261015.md`，全庫其他非授權檔案唯讀。
- [x] **路徑規範化反映**：全面納入 `art/stage2-rain-port/`、`art/stage3-sakura-pass/`、`art/stage4-bamboo-maze/` 之標準檔名。
- [x] **人審決策精確對齊**：精準標註 03:26 最新核准（Stage 2 過渡）、拒收（Stage 3 貼花巨石、Stage 4 黑暗地表）與未判定母版（Stage 4 妖怪）。
- [x] **資產與系統保護**：零生圖、零 API、無音訊/TTS/金鑰碰觸，保護 357 筆 dirty 成果，無 git mutation。
