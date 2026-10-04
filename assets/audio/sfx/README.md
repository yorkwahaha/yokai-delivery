# Yokai Delivery SFX override

把自訂 MP3 放在這個資料夾，遊戲會優先播放它；檔案不存在、無法解碼或播放失敗時，會自動使用原本的 Web Audio 合成音效，不會讓遊戲靜音。

建議使用 44.1 kHz 或 48 kHz MP3，短音效前後不要留太長空白。

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

狐火、落雷、淨化靈陣、玩家受傷、靈玉拾取及接取委託目前使用合成音效；若要替換成 MP3，須先在 `js/audio.js` 的 `SFX_FILES` 加入對應路徑，單純放入檔案不會生效。

新增的三個結算／死亡音效未提供 MP3 時，會使用內建合成音效。替換現有檔案後須更新 `js/assets.js` 的音訊版本字串，避免正式站台瀏覽器沿用舊快取；目前版本為 `20261003-3`。
