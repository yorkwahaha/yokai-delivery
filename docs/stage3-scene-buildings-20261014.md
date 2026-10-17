# 第三關神社與古櫻接入（2026-10-14）

神社建築與腐化古櫻已在本機第三關可玩。這不是整關核准。地面仍是現役三圖：`tx < 3` 土路、`tx = 3` 一欄水平過渡、`tx >= 4` 石階。`sakura-terrain-plan.js` 沒有接到 renderer。缺的凹凸轉角圖沒有拿來混鋪。櫻小僧與花天狗沒有接入。

## 圖

原樣複製，SHA-256 與候選圖一致：

- `assets/img/sakura-pass/shrine_pavilion.webp`（470×440，腳點 y=430，寬 210）
- `assets/img/sakura-pass/landmark_corrupted_sakura.webp`（460×460，腳點 y=445，寬 156）

只在進入 `sakura-pass` 時載入。缺圖只顯示「神社圖載入中／失敗」，不改畫第一關町屋、稻荷社或幾何房子。

第三關每間房子的 `bType` 都是 `shrine_pavilion`。第一關、第二關屋型不變。鳥居在第三關關閉。第一關櫻樹資料若還在，第三關不畫。古櫻約每五個區塊一棵，腳點在區塊北緣，不進房屋碰撞，也不壓答題墊。

## 網址

沿用已在聽的 `http://127.0.0.1:8788/`。

- `http://127.0.0.1:8788/?dev=1&stage=sakura-pass`
- 2D：同一網址再加 `&tilt=1`

點「開發選關」，再點「直接進關」。1194×834 是桌面模擬，不是 iPad 真機。

## 測試

`node --test tests/stage3-shrine-buildings.test.cjs tests/stage3-ground-transitions.test.cjs tests/stage2-approved-enemies.test.cjs tests/content-world.test.cjs tests/r6-mutual-edge.acceptance.cjs tests/renderer.test.cjs`

神社與地面、第二關、世界、雨港裝飾、renderer 這幾組在本輪分開跑過，皆 exit 0。沒有讀音檔，也沒有跑全媒體 hash。

Chrome headless 對四個視口（桌機 1280×800、平板寬度 1194×834，各 2D／2.5D）在進關與向右走之後，`drawImage` 都叫到神社與古櫻的 runtime WebP。`night-town` 與 `rain-port` 這兩張圖的 draw 次數是 0。截圖在 `artifacts/validation/codex-lead-20261014-cursor/stage3-scene/`。進關當下標題卡會擋在畫面中央，那是原本的開場，不是建築沒畫。

`index.html` 的 `world.js`、`assets.js`、`renderer.js`、`game.js` 查詢字串是 `?v=20261014-sakura-scene1`。

未 commit、未 push、未 deploy。H/V 交會的中央補丁仍未修，等 AGY 的真轉角與使用者看過之後再接自然分區。
