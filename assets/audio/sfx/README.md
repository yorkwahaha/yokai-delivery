# Yokai Delivery SFX override

把自訂 MP3 放在這個資料夾，遊戲會優先播放它；檔案不存在、無法解碼或播放失敗時，會自動使用原本的 Web Audio 合成音效，不會讓遊戲靜音。

建議使用 44.1 kHz 或 48 kHz MP3，短音效前後不要留太長空白。

## 主動技能兩階音效

六技能支援分級音效；狐火則依「護火、龍入場、龍吐球、地面燃燒」分事件播放。缺檔會退回既有 MP3／合成音。請直接放入本資料夾，不要建立空白佔位檔。Lv5 陰陽符音效於命中爆炸時播放，其餘依現有施放／命中節奏。

| 技能 | Lv1–4 | Lv5／MAX |
|---|---|---|
| 妖刀斬 | `katana-lv1-4.mp3` | `katana-lv5.mp3` |
| 淨化靈陣 | `barrier-lv1-4.mp3` | `barrier-lv5.mp3` |
| 天狐靈針 | `needle-lv1-4.mp3` | `needle-lv5.mp3` |
| 陰陽符 | `boom-lv1-4.mp3` | `boom-lv5.mp3` |
| 狐火炎（護火／出擊火球） | `fire-lv1-4.mp3` | `fire-lv1-4.mp3` |
| 天狐雷 | `thunder-lv1-4.mp3` | `thunder-lv5.mp3` |

狐火 Lv5 專屬事件音效（3 支音檔均在此資料夾）：
- 龍入場：`fire-lv5-dragon.mp3`；每次出場播放一次。
- 龍一次吐三顆火球：`fire-lv5-ball.mp3`；每次三連發只播放一次，避免三聲互蓋。
- 火球落地形成燃燒焦土：`fire-lv5.mp3`；每波新焦土開始燃燒時播放一次。
- 龍從畫面外進場 0.35 秒、在場 1.5 秒、退出 0.35 秒；退場後五秒才再出現（每輪約 7.2 秒）。每輪 3 顆火球，最多 3 處燃燒區，存續 5 秒、尾段漸隱。


完整路徑前綴為 `assets/audio/sfx/`。放檔後更新 `js/assets.js` 的音訊版本，正式站台需重新部署。

| 檔名 | 用途 |
| --- | --- |
| `slash.mp3` | 妖刀斬擊 |
| `boomerang.mp3` | 陰陽符迴力鏢 |
| `dash.mp3` | 衝刺 |
| `needle.mp3` | 破魔靈針 |
| `sanctuary.mp3` | 結界啟動 |
| `delivery-success.mp3` | 配送答對／成功送達 |
| `delivery-wrong.mp3` | 配送答錯／誤配妖怪出現 |
| `break-shield.mp3` | Boss 破防 |
| `level-up.mp3` | 升級 |
| `warning-pulse.mp3` | 百鬼夜行警報 |
| `boss-death.mp3` | Boss 死亡（含一般與最終 Boss） |
| `fanfare.mp3` | 過關結算畫面，進入時播放一次 |
| `lose.mp3` | 失敗結算畫面，進入時播放一次 |

單字語音仍放在 `assets/audio/words/`，BGM 仍使用 `assets/audio/BGM.mp3`（或 `assets/audio/bgm.mp3`）。

狐火、落雷、淨化靈陣可使用上表的技能音效。玩家受傷、靈玉拾取及接取委託目前使用合成音效；若要替換它們，須在 `js/audio.js` 的 `SFX_FILES` 加入對應路徑。

新增的三個結算／死亡音效未提供 MP3 時，會使用內建合成音效。替換現有檔案後須更新 `js/assets.js` 的音訊版本字串，避免正式站台瀏覽器沿用舊快取；目前版本為 `20261003-3`。
