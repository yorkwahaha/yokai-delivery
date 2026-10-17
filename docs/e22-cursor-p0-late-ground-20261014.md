# E22 P0 晚載交接（cursor_prod w5:p9）

**NOT_REPRODUCED，不是修好。** 人審與真機仍 WAITING_HUMAN／WAITING_DEVICE。未 Commit／未 Push／未 Deploy。沒有改 production。沒有測 FPS。

今輪命令：`node tests/cursor-e22-p0-cold.acceptance.cjs`，**exit 0**。PASS 11／FAIL 0／HUMAN_REVIEW 1／BLOCKED 0。log：`artifacts/validation/cursor-e22-p0-20261014/qa-log.txt`。

`ground_dirt` HTTP 留包 5009ms／5001ms，真圖 134446 bytes。新鮮 profile、cache disabled、9528／9529。桌機 1280×800 tilt 1，平板模擬 1194×834 tilt 0.60。

載入期間畫面停在「圖像準備 20/21」，世界地板沒有先畫出來。今輪 `decode()` 比第一次 `drawGround` 早 6ms（桌機）與 4ms（平板）。第一次快取 `imageWidth` 已是 512。scrollReuse 桌機 5 次、平板 4 次，寬度維持 512，pixelScale 維持 1.333／1.327。玩家位移 521px／552px。

`*-first-world.png` 的最近 screencast 幀仍是 20/21 封面（桌機偏差 −70ms）。第一張看得到夜行町石板的存檔是 `*-world-plus400.png`；`*-first-scroll.png` 在移動後仍是同一套石板，沒有缺磚或舊尺度錯位。

正式檔 SHA 前後相同：`js/renderer.js` `a69631d91c019fb2234202a650f1fe7d66bbaa74`，`js/game.js` `68445fe56681f8471c4ca9db6618e32af015f3be`，`index.html` `ad74d100d746eb5b75514115b31920c22751eb0b`。音訊 2 次、0 bytes。

下一票不要為這條晚載改 renderer。P0 門繼續開，等真機與人審。
