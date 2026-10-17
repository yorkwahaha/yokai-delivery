# P4.2 固定景物尺寸與世界相機拉近契約

2026-10-14／Codex。純數學參考已測試；正式 runtime 由 Cursor 實作、Space Bunny 獨立 Chrome 驗收。這份契約不是 runtime 已完成或美術核准紀錄。

## 1. 根因與最小修復

`renderer.js sceneryDepth(worldY,viewerY)` 用玩家 Y 算 `distance=max(0,viewerY-worldY)`；第三關預設 `scale=1-smooth01(distance/520)*0.12`，enhanced 為 reach 440、降幅 0.15。固定神社寬 210 隨玩家走動可變成 184.8／178.5，古櫻也同樣變小。這是物件本身尺寸變化，相機 zoom 只會一起放大這個問題。

1. 先令 scenery depth 的 `scale` 恆為 1，保留既有平滑 blur／grade；不改已核准圖、不加假遠景。玩家移動、viewerY、depth mode 不再改房屋或樹的尺寸。
2. 另加世界相機 zoom；只作用第三關 `sakura-pass` 的 2.5D。2D 與其他關一律 1。
3. loopback 本機 `?zoom=1`、`?zoom=1.10`、`?zoom=1.15` 比較，白名單解析，公開網址忽略 query。預設先 1，1.10／1.15 最終選擇 WAITING_HUMAN。
4. 沿用直立 sprite、世界碰撞、玩家速度、配送座標與 chunk。這是正交投影拉近，不引入真正透視，也不以 CSS 放大。

| k=0.60，名義 900×600 logical viewport | 世界視野寬 | 世界視野高 |
|---|---:|---:|
| Z=1 | 900 | 1000 |
| Z=1.10 | 818.18 | 909.09 |
| Z=1.15 | 782.61 | 869.57 |

拉近會減少可見世界，需檢查資訊與效能；實際 viewport 的 letterbox 外區依現有 bounds 計算。比較時使用相同初始 tilt、spacing、seed 和位置；現役初始 2.5D spacingScaleY=1.2 不得因 zoom 或切鏡重建。

## 2. 座標與精確公式

`L=VIEWPORT.scale` 是 CSS 對 900×600 布局縮放，`D=RENDERER.getDpr()` 是有效 backing density，`k=tiltScale`，`Z=worldZoom`。三者分開。`A=(450,300)` 是 logical 螢幕中心；C 是現役相機 top-left offset；H 是 world-unit shake；P 是世界點。使用現役 offsets，不能重新定義 cam 為世界中心。

```text
Sx = Ax + Z*(Px-Cx+Hx-Ax)
Sy = Ay + Z*(k*(Py-Cy+Hy)-Ay)
Px = Cx-Hx+Ax+(Sx-Ax)/Z
Py = Cy-Hy+(Ay+(Sy-Ay)/Z)/k

world CTM [a,b,c,d,e,f]:
[Z,0,0,kZ, Ax*(1-Z)+Z*(-Cx+Hx), Ay*(1-Z)+kZ*(-Cy+Hy)]
backing CTM:
[LDZ,0,0,LDkZ, LD*(offsetX+e), LD*(offsetY+f)]
```

在現有 layout CTM 內 world save/restore：`translate(A); scale(Z,Z); translate(-A);` 再現役 tiltWorld。HUD 永遠畫於 restore 後的 layout CTM，backing canvas 尺寸不隨 Z 改變。

直立圖片沿用 `T(F)·scale(1,1/k)·T(-F)`，只抵消 k、不抵消 Z。合成後 a=d=Z，f 變 `f+Z*(k-1)*Fy`，腳錨 F 仍投影到同一 S。保留現役神社 art contact `h.y+48` 與 upright `h.y+46` 的 2px local 差，不順便重寫碰撞或圖片。

玩家另有既有 local offset：`drawFrame(ctx,pImg,pKey,0,0,20,poseHeight)` 的圖片矩形下緣在 local y=20；standing時其矩形錨應為 project(P)+(0,20*Z)。實際alpha腳底留白可能更高，walkBob／inv閃爍另影響像素。QA要捕获該player sprite的crop/dest與CTM，再核對聲明錨點；不能把全畫面顏色門檻找出的最下緣當玩家腳，也不能擅修原圖／既有偏移。原有alpha接地觀感另列HUMAN_REVIEW。

鏡頭追隨目標仍 `Cx=player.x-450; Cy=player.y-300/k`，平滑參數不改。tilt／zoom 切換時先用旧 k/Z 計算玩家 S（shake=0），再用新 k/Z 且 C=0 的 inverse 求 Q，令新 `C=P-Q`，同時保存 X/Y；不得只修 Y，或把震動累积到相機。

zoom 與現役 tilt 0.8 秒 smooth transition 同步：`Z=1+(selectedZ-1)*clamp((1-k)/0.4,0,1)`。2D 精確回 1，模式過渡連續。

## 3. bounds、直立屋頂與繪圖快取

Logical B 保留 `left=-offsetX, top=-offsetY, right=900+offsetX, bottom=600+offsetY`。absolute worldBounds 是 B 左上／右下透過 inverse。現役 `VIEWPORT.worldBounds()` 契約是 camera-relative offsets：用 C=H=0 算，不可換成 absolute 後 game 又加 cam 一次。新增 drawBounds helper 可 absolute，但命名與 callsite 必須明確。

直立物 local overhang `{left,right,top,bottom}`、logical halo h 的查詢 bounds：先 inverse(B±h)，再 `left-=right; right+=left; top-=bottom/k; bottom+=top/k`（各方向使用原 overhang 值）。屋頂在螢幕下方仍可伸進畫面，不能繼續假設固定 220 world-unit 能容納所有圖。也可逐 actor 將腳點投影，以 `footS±Z*overhang±halo` 做螢幕矩形相交；不要因此更動 collision。

filter 座標在 output bitmap 空間，並不隨 CTM 自動放大，見 [WHATWG Canvas filters](https://html.spec.whatwg.org/multipage/canvas.html#filters)。保守截圖 guard 可用 `haloLogical=ceil((3*maxBlurBitmapPx+maxShadowOffsetBitmapPx+1)/(L*D))`；3σ 是實用邊界而非無限 Gaussian 的絕對範圍。陰影／blur 邊界仍須 Chrome 檢查。

`drawGroundBase` 快取 raster density 固定用 L*D，不能直接用含 Z 的 `ctx.getTransform().a`：否則切鏡每 frame 重新配置快取。cache coverage 用新 inverse bounds，原本位移覆蓋邏輯保留；最後 drawImage 由 world CTM 拉近。最多 15% 重採樣品質列 HUMAN_REVIEW，避免新增大型多層 cache 框架。主畫布、light canvas 不因 Z 改 backing 尺寸。Chunk streaming 不因 Z 重新生成；獨立檢查負座標、tablet、模式過渡的 drawBounds 已被現役 chunks 覆蓋。

## 4. input、光效與 HUD

1. `pp()` 繼續 client→logical：`(clientX-rect.left)*v.width/rect.width-v.offsetX`，Y 同理。世界點擊才再 screenToWorld；不直接對 HUD 或手把軸做 inverse。
2. 虛擬搖桿 60 logical cap、keyboard/gamepad 世界速度維持原值。觸控 HUD hitButton／44 CSS pixel 標準不隨 Z 改。
3. 主 world、skillFX、dragonHUDOverlay world 部分使用同一 CTM。hitbox/VFX 世界中心不變，world glyph 清楚不套景物 blur。
4. bossHunt 等手寫 `x-camX`／`k*(y-camY)` 改共用 worldToScreen，螢幕提示文字保持 HUD 大小。
5. `renderLighting` 若啟用：玩家光／燈光位置共用 projection；燈火中心 project(l.x,l.y+8) 再減 30*Z logical；世界光半徑乘 Z，ellipse flatten k 一次，不重複乘 Z。不碰音訊。
6. `FX.drawFlash` 在 world restore 後應傳 logical screen bounds，不可傳縮小的 worldBounds 造成 flash crop。ambient screen mist 與 HUD 保持螢幕空間。
7. spawnRadius 建議仍取 Z=1 conservative bounds，避免拉近順便改敵人 spawn 節奏；地圖／房屋 ID、solid、world coords、配送與攻擊距離完全不改。

## 5. Cursor 最小修改 hook／owner

| 檔案 | 修改 hook |
|---|---|
| js/viewport.js | guarded worldZoom、同一 forward/inverse、camera-relative bounds、upright 保留 Z、必要 drawBounds helper |
| js/game.js | tiltWorld 與 overlay、runFrame 雙軸 reanchor、屋頂 culling、bossHunt 投影、screen flash bounds；不改速度與 world |
| js/renderer.js | sceneryDepth scale=1、ground cache density、手寫 lighting 投影 |
| index.html | 只有需要的 script cache version；不載入 CommonJS 參考模型 |
| tests/p42-camera-runtime.test.cjs | 直接驗正式 globals/CTM 的整合契約 |
| tests/viewport.test.cjs、stage3-house-density-depth 相關既有 test | 只修鎖住舊動態縮放的斷言，保留密度、blur、grade、sign 與其他關 baseline |

`js/p42-camera-model.js` 為 Codex 所有的 Node 參考，未接 runtime。不需大規模拆模組。Cursor 完成須交 `docs/p42-camera-runtime-20261014.md`，實際命令／退出碼／統計與檔案清單。Space Bunny 只新增專項 tests/docs/artifacts，驗收 frozen production；修 FAIL 先解除 QA freeze 再給 Cursor 單一 owner。

## 6. 可追溯 gate

RED：參考 API 未實作時 15 個語意測試 FAIL（runner 可載入）。GREEN：16 個純數學案例＋6 個既有 viewport 案例 22/22 PASS、0 FAIL、0 SKIP；命令：

```text
node --test --experimental-test-coverage --test-coverage-include=js/p42-camera-model.js tests/p42-camera-zoom-math.test.cjs tests/viewport.test.cjs
```

參考模組 coverage line 100%、branch 97.56%、function 100%，不是 runtime 或全 repo coverage。範圍：2D legacy、0.6×1.10/1.15 inverse、中心／切鏡 lag 錨定、移動景物大小不變、世界 ID／collision 不变、input／HUD、desktop/tablet 不同 CSS/DPR、關卡隔離、负座標／屋頂 culling、世界速度 invariant。測試碼不讀音訊。

正式 Node gate 另須直接載入 viewport/renderer/runtime hook，不能以參考模型綠灯代替。既有 stage3 遠房 `width<=near*0.9` 的需求已被使用者新指令取代：改成 same Z 下 viewerY 變化 width 恆定（允許 backing rounding ≤1px），不能刪除其他 assertion。

獨立真 Chrome 最少 desktop 1280×800、tablet viewport 1194×834，各跑 2D／2.5D、Z=1/1.10/1.15。固定同 seed／位置／asset，以上下移動連續影格驗房屋 drawImage dimensions 不變、blur/grade 仍存在、屋頂與角落無 crop、腳錨／碰撞／hit VFX 對位；切鏡中心連續、HUD bbox 不放大、pointer inverse、切關 night-town/rain-port/其他關 Z=1。冷啟與 ground cache rebuild 次數可測須留證據，不能僅拍靜止單張。保存實際 screenshots、URL、測試 hook 與 production hashes。

結果逐項 PASS／FAIL／HUMAN_REVIEW；viewport 不冒稱實體 iPad、headless frame timing 不冒稱真機 FPS。Zoom 比例、美術／地板／字體觀感、實體手感仍待人審或真機。若 lighting、stream coverage、culling 或 input 契約無法證實，該項 BLOCKED，先修再驗。未 Commit／未 Push／未 Deploy；音訊凍結。
