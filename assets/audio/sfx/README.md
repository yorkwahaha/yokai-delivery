# Yokai Delivery SFX override

把自訂 MP3 放在這個資料夾，遊戲會優先播放它；檔案不存在、無法解碼或播放失敗時，會自動使用原本的 Web Audio 合成音效，不會讓遊戲靜音。

建議使用 44.1 kHz 或 48 kHz MP3，短音效前後不要留太長空白。

| 檔名 | 用途 |
| --- | --- |
| `slash.mp3` | 妖刀斬擊 |
| `boomerang.mp3` | 陰陽符迴力鏢 |
| `fireball.mp3` | 狐火 |
| `thunder.mp3` | 落雷 |
| `dash.mp3` | 衝刺 |
| `barrier.mp3` | 淨化靈陣 |
| `needle.mp3` | 破魔靈針 |
| `hurt.mp3` | 玩家受傷 |
| `gem.mp3` | 靈玉／經驗拾取 |
| `pickup.mp3` | 接取配送委託 |
| `sanctuary.mp3` | 結界啟動 |
| `delivery-success.mp3` | 配送答對／成功送達 |
| `delivery-wrong.mp3` | 配送答錯／誤配妖怪出現 |
| `break-shield.mp3` | Boss 破防 |
| `level-up.mp3` | 升級 |
| `warning-pulse.mp3` | 百鬼夜行警報 |

單字語音仍放在 `assets/audio/words/`，BGM 仍使用 `assets/audio/BGM.mp3`（或 `assets/audio/bgm.mp3`）。
