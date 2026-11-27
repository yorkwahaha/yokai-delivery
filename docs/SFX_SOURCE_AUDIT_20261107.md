# Yokai Delivery 音效來源盤點（2026-11-07）

## 尾王死亡：新制正式路徑

- 呼叫：`js/game.js` 尾王死亡 `AUDIO.finalBossDeath()`。
- 新錄音位置：`assets/audio/sfx/final-boss-death.mp3`。
- 目前檔案 **未放入**；只在最終 Boss 擊敗時讀取，沒有預先下載。
- 缺檔、播放政策拒絕、無法解碼時，**不產生任何合成音**。
- 一般（非最終）Boss 照舊：`assets/audio/sfx/boss-death.mp3`。

## 目前必定使用 Web Audio 合成器（尚無專用 MP3 路徑）

| 音效 | API | 實際實作 |
|---|---|---|
| 普通／重擊／爆擊命中音 | `AUDIO.impact(tier)` | 低頻 oscillator + 自製 noise buffer |
| 玩家受傷 | `AUDIO.hurt()` | square oscillator 下降音 |
| 經驗珠／靈玉拾取 | `AUDIO.gem()` | `playSuzu` 合成鈴 |
| 接取委託包裹 | `AUDIO.pickup()` | 合成鈴＋三味線 |

## 專屬分級音檔缺少，但有其他 MP3 或合成後備

| 缺少檔案 | 現在會發生什麼事 |
|---|---|
| `katana-lv1-4.mp3` | 優先退回已存在的 `slash.mp3`；僅播放失敗才合成 |
| `barrier-lv1-4.mp3` | 無通用 `barrier.mp3`，故 **Lv1–4 靈陣施放仍用合成聲** |
| `needle-lv1-4.mp3` | 優先退回已存在的 `needle.mp3` |
| `needle-lv5.mp3` | 優先退回已存在的 `needle.mp3` |
| `boss/rain_port_water_slam_warn.ogg` | 雨港水擊預警仍用合成太鼓／鈴 |
| `boss/rain_port_water_slam_impact.ogg` | 雨港水擊命中仍用合成太鼓／鈴 |

已存在的 `boss-slam-impact.mp3`、`boss-death.mp3`、
`fire-lv1-4.mp3`、`fire-lv5-dragon.mp3`、`fire-lv5-ball.mp3`、
`boom-lv1-4.mp3`、`boom-lv5.mp3`、`thunder-lv1-4.mp3`、
`thunder-lv5.mp3`、`sanctuary.mp3`、`delivery-success.mp3`、
`delivery-wrong.mp3` 等事件正常優先使用錄音。

## 特殊後備

- 一般 Boss 死亡、升級、破盾、警報、失敗與通關等 **已存在 MP3**，
  但播放器若被阻擋或解碼失敗，原合成 fallback 仍可能出現。
- 未載入外部 BGM 時，`updateBgm` 仍可用合成三味線／太鼓／鈴聲循環。
- 單字 MP3／Fish Audio 無法播放時，會回退瀏覽器日文 TTS，
  這是語音合成，與 Web Audio 的音效合成不同。
- **尾王死亡不再有任何合成後備**。
