# E22 頁級文字對比（cursor_prod）

頁級「收藏 …」與「待解鎖插畫」改為紙色 `#efe2bf`，兩條 baseline 相距 22 CSS。紙卡與木 tag 仍用深墨 `#24180f`。未改 core／bridge／game／renderer／viewport／world／assets。未 Commit／未 Push／未 Deploy。

`node --test tests/director-card-page-contrast.test.cjs tests/card-gallery-ui.test.cjs`：13 PASS／0 FAIL。其中 root 兩視口對比測試已綠。`node --check js/card-gallery-ui.js` 通過。

真 Chrome（9538，音訊 stub／204，0 音檔 bytes）：

- `artifacts/validation/cursor-e22-ui-contrast-20261014/desktop-1280x800.png`
- `artifacts/validation/cursor-e22-ui-contrast-20261014/tablet-1194x834.png`
- `artifacts/validation/cursor-e22-ui-contrast-20261014/mobile-844x390.png`

三張都是單字圖鑑。暗底上兩行淺色可讀；ねこ／4/4 與關卡、詞包木 tag 仍是深墨。

| 檔 | git hash-object |
| --- | --- |
| `js/card-gallery-ui.js` | `0eff360e388cb9e94d25af43990ec3f97617a01e` |
| `index.html` | `07f7b137124bfab93d30a3e1a3209ab1ff6255ff` |

`index.html` 只把 `card-gallery-ui.js` 版本改成 `20261014-p42-c4-e22`。

停 production，等 root 獨立 focused 重驗。不跑全套。
