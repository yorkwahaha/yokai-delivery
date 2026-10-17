# M15-03 剩餘引用（最終）

程式裡 27 條精確舊路徑已是 0。五個核心檔 SHA 與 root `references-focused-preliminary.json` 5/5 相同，41 PASS 與既有 8 支語法檢查沿用，沒有重跑。沒有讀音訊，沒有跑 media builder，沒有改現役圖，沒有削 SHA。

錨維持原差異，loader 仍讀現役檔：

- canonical `art/stage2-rain-port/scene/O_prop_anchor_gear.webp`：`d003d3e0da38a09211d5acac6a9499ea6096c4ad51c1447e1b164dd50c33f59b`
- runtime `assets/img/rain-port/prop_anchor_gear.webp`：`2883ceece1aa497a1f0efeaf446cc0f9ea7b672681a364de22766d484d83748e`

## 仍會打開或拼出的舊位置

- `tools/r6-world-cross-edge.cjs:513` 目錄 `art/r4/handpainted-candidates/stage2-enemies`
- 同檔 `:514` 與 `:607` `art/r4/handpainted-candidates/stage2-enemies/enemies_metadata.json`
- 同檔 `:537` `art/r4/handpainted-candidates/stage2-refine/compat/compat_seam_metrics.json`
- `tools/r6-art-shots.cjs:267` 拼接 `art/r4/handpainted-candidates/<繪製 basename>`。這不是固定檔名。
- `tests/spacebunny-stage3-ground.acceptance.cjs:57` 後備目錄 `art/stage3-sakura-pass/candidates`。現役五張櫻山 WebP 已走 canonical，未入表的檔名仍會組舊路徑。
- `tests/r6-mutual-edge.acceptance.cjs:160` `art/audio/aoede-preview/dry-run-report.json`。未開啟。
- runtime manifest `:7` 的 `approval_record.scope` 只剩 rework 目錄歷史註記，四個 `source_candidate_path` 已是 `E_`／`B_`。

47 條 out_scope 不在本次移轉。上述路徑與 out_scope 先留。其餘已無完整舊路徑的 mapped source 可交 AGY 收尾。

機器清單：`artifacts/validation/grok-m15-art-references-20261015/remaining-code-refs.json`。

## 部署

未 Commit／未 Push／未 Deploy。M15-03 到此結束。下一張是 Stage2 v2 runtime：新檔 `art/stage2-rain-port/scene/G_stone_wood_transition_v2.webp`（`8ba771c198b48fb601cfc3893d702c8e9540c11b3bf3b11e02def9ea91648215`）與同目錄 PNG。`cy` 奇數岸用原圖與垂直翻轉鋪兩條水平縫，不覆蓋現役地面圖。
