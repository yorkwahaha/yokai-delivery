#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""F1-A-MATTE：墨焰斬兩張候選圖 alpha 去背（本機 Pillow + numpy 唯讀處理）

唯一寫入：
  art/fusion/candidates/fusion_inkblade/banana_inkblade_alpha_candidate_v01.webp
  art/fusion/candidates/fusion_inkblade/gpt_inkblade_alpha_candidate_v01.webp
  scratch/fusion-art-compare/qa-matte-<stamp>/  (mask/eval JSON/合成預覽)

不修改源圖、不改 js/**、index.html、roadmap；不呼叫任何 API/模型；只新增檔案。
源圖：
  main_v01.png                1264x848 RGB  深灰平背景 ~[24,24,24]
  gpt_inkblade_original_v01.png 1536x1024 RGBA 殘餘和紙底/暗角（alpha 0..252，無 255）

方法（低風險、保留細節）：
  banana：以邊框環估背景色與噪聲，alpha = smoothstep(最大通道色差) ∪ 深墨救援（比背景更暗的墨線），
          再做 closing 補筆觸內部小孔 + 0.8px 羽化；不套 median（避免吃掉 1px 火星）。
  gpt   ：多線索紙底判定（亮 × 低飽和 × 低細節）× 邊框低細節暗暈，取 1-paper；原圖 alpha<6 強制透明；
          暗墨/金焰不被亮度門檻誤刪。兩組強度取較佳者。
"""
import hashlib
import json
import os
import sys
from datetime import datetime, timezone

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CAND = os.path.join(ROOT, "art", "fusion", "candidates", "fusion_inkblade")
OUT_BANANA = os.path.join(CAND, "banana_inkblade_alpha_candidate_v01.webp")
OUT_GPT = os.path.join(CAND, "gpt_inkblade_alpha_candidate_v01.webp")
STAMP = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
QA = os.path.join(ROOT, "scratch", "fusion-art-compare", "qa-matte-" + STAMP)


def sha256(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for c in iter(lambda: f.read(1 << 20), b""):
            h.update(c)
    return h.hexdigest()


def smoothstep(x, e0, e1):
    t = np.clip((x - e0) / max(float(e1) - float(e0), 1e-6), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def border_pixels(arr, w):
    return np.concatenate([
        arr[:w].reshape(-1, arr.shape[2]),
        arr[-w:].reshape(-1, arr.shape[2]),
        arr[:, :w].reshape(-1, arr.shape[2]),
        arr[:, -w:].reshape(-1, arr.shape[2]),
    ])


def lum(rgb):
    return 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]


def clean_mask(a, feather=0.8, close=True):
    m = Image.fromarray(np.clip(a * 255.0, 0, 255).astype(np.uint8), "L")
    if close:
        m = m.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    if feather > 0:
        m = m.filter(ImageFilter.GaussianBlur(feather))
    return np.asarray(m, dtype=np.float32) / 255.0


def compose_preview(rgba, bg_img, box_w, box_h, out_path, pad=0.10):
    """把透明候選縮放置中貼到背景，輸出 PNG。"""
    canvas = bg_img.convert("RGB").copy()
    cw, ch = canvas.size
    max_w, max_h = int(cw * (1 - 2 * pad)), int(ch * (1 - 2 * pad))
    sc = min(max_w / box_w, max_h / box_h)
    w, h = max(1, int(box_w * sc)), max(1, int(box_h * sc))
    fg = rgba.resize((w, h), Image.LANCZOS)
    canvas.paste(fg, ((cw - w) // 2, (ch - h) // 2), fg.split()[3])
    canvas.save(out_path, "PNG")
    return out_path


def washi_bg(w, h):
    y = np.linspace(0, 1, h, dtype=np.float32)[:, None]
    x = np.linspace(0, 1, w, dtype=np.float32)[None, :]
    base = np.stack([
        236 - 26 * y + 4 * x,
        226 - 28 * y + 3 * x,
        204 - 30 * y + 2 * x,
    ], axis=2)
    vig = 1.0 - 0.18 * ((x - 0.5) ** 2 + (y - 0.5) ** 2) * 2.2
    base = np.clip(base * vig[..., None], 0, 255).astype(np.uint8)
    return Image.fromarray(base, "RGB")


def checker_bg(w, h, cell=16):
    yy, xx = np.mgrid[0:h, 0:w]
    mask = ((xx // cell) + (yy // cell)) % 2 == 0
    arr = np.where(mask[..., None], np.array([42, 42, 42], np.uint8), np.array([214, 214, 210], np.uint8))
    return Image.fromarray(arr.astype(np.uint8), "RGB")


def metrics(src_rgb, src_a_orig, out_a, kind, bg=None):
    a = out_a
    L = lum(src_rgb)
    sat = src_rgb.max(axis=2) - src_rgb.min(axis=2)
    coverage = float(np.mean(a > 0.05) * 100)
    opaque = float(np.mean(a > 0.98) * 100)
    transparent = float(np.mean(a < 0.02) * 100)
    soft = float(np.mean((a > 0.05) & (a < 0.95)) * 100)
    h, w = a.shape
    bw = max(2, int(min(h, w) * 0.02))
    ring = np.concatenate([a[:bw].ravel(), a[-bw:].ravel(), a[:, :bw].ravel(), a[:, -bw:].ravel()])
    res = {
        "alpha_coverage_pct": round(coverage, 2),
        "opaque_pct": round(opaque, 2),
        "transparent_pct": round(transparent, 2),
        "soft_edge_pct": round(soft, 2),
        "mean_alpha": round(float(a.mean()) * 255, 1),
        "border_ring_mean_alpha": round(float(ring.mean()) * 255, 1),
        "border_ring_alpha_p95": round(float(np.percentile(ring, 95)) * 255, 1),
    }
    if kind == "banana":
        d = np.max(np.abs(src_rgb - bg), axis=2)
        bgish = d <= 8.0
        res["bg_colour_residual_pct"] = round(float(np.mean(bgish & (a > 0.2)) * 100), 2)
        bg_l = float(lum(bg[None, None, :])[0, 0])
        ink = L < max(10.0, bg_l - 8.0)   # 比背景更暗的墨線（背景約 L=24，門檻約 L<16）
        res["bg_lum"] = round(bg_l, 1)
        res["ink_candidate_px_pct"] = round(float(np.mean(ink) * 100), 2)
        res["ink_kept_pct"] = round(float(np.mean(a[ink] > 0.5) * 100), 2) if ink.any() else None
        res["ink_mean_alpha"] = round(float(a[ink].mean()) * 255, 2) if ink.any() else None
    else:
        paper = (L > 170) & (sat < 28)
        res["paper_colour_residual_pct"] = round(float(np.mean(paper & (a > 0.2)) * 100), 2)
        dark_ink = L < 80
        res["dark_ink_px_pct"] = round(float(np.mean(dark_ink) * 100), 2)
        res["dark_ink_kept_pct"] = round(float(np.mean(a[dark_ink] > 0.5) * 100), 2) if dark_ink.any() else None
        res["dark_ink_mean_alpha"] = round(float(a[dark_ink].mean()) * 255, 2) if dark_ink.any() else None
        res["orig_alpha_forced_clear_pct"] = round(float(np.mean(src_a_orig < 6) * 100), 2)
        dark_bg = (L < 60) & (sat < 30)
        res["dark_vignette_residual_pct"] = round(float(np.mean(dark_bg & (a > 0.2)) * 100), 2)
    halo = (a > 0.1) & (a < 0.5) & (L > 190)
    res["bright_halo_pct"] = round(float(np.mean(halo) * 100), 2)
    keep = a > 0.5
    if keep.any():
        res["kept_mean_lum"] = round(float(np.mean(L[keep])), 1)
    res["src_mean_lum"] = round(float(np.mean(L)), 1)
    return res


def banana_mask(rgb, strength=1.0):
    bg = np.median(border_pixels(rgb, 10), axis=0)
    d = np.max(np.abs(rgb - bg), axis=2)
    d_ring = np.max(np.abs(border_pixels(rgb, 10) - bg), axis=1)
    noise = 1.4826 * float(np.median(np.abs(d_ring - np.median(d_ring))))
    t0 = max(3.0, 4.0 * noise) / strength
    t1 = t0 + max(9.0, 8.0 * noise * strength)
    a_soft = smoothstep(d, t0, t1)
    L = lum(rgb)
    bgL = float(lum(bg[None, None, :])[0, 0])
    dark = smoothstep(bgL - L, 2.0 + 2.0 * noise, 8.0 + 10.0 * noise)
    a = np.maximum(a_soft, dark * 0.95)
    return clean_mask(a, feather=0.8), {"bg_rgb": [round(float(v), 1) for v in bg], "noise_sigma": round(noise, 2), "t0": round(t0, 2), "t1": round(t1, 2)}


def _reconstruct(seed, cand, iters=90):
    """從邊框種子做形態學重建：只吃與邊框連通的紙底，內部墨塊不受影響。"""
    cur = seed.copy()
    for _ in range(iters):
        m = Image.fromarray((cur * 255).astype(np.uint8), "L").filter(ImageFilter.MaxFilter(3))
        nxt = (np.asarray(m, dtype=np.uint8) > 127) & cand
        if np.array_equal(nxt, cur):
            break
        cur = nxt
    return cur


def gpt_mask(rgba, strength=1.0):
    rgb = rgba[..., :3].astype(np.float32)
    orig_a = rgba[..., 3].astype(np.float32) / 255.0
    L = lum(rgb)
    sat = rgb.max(axis=2) - rgb.min(axis=2)
    cr = sat / np.maximum(L, 1.0)
    Limg = Image.fromarray(np.clip(L, 0, 255).astype(np.uint8), "L")
    detail = np.abs(L - np.asarray(Limg.filter(ImageFilter.GaussianBlur(16)), dtype=np.float32))
    # 紙底/暗角共同特徵：低細節 + 低彩度比；金焰彩度高、墨線細節高 → 不會被吃
    smooth = 1.0 - smoothstep(detail, 2.0, 9.0 + 3.0 * strength)
    neutral = 1.0 - smoothstep(cr, 0.18 * strength, 0.36 * strength)
    cand = (smooth >= 0.5) & (neutral >= 0.5)
    h, w = L.shape
    b = max(2, int(min(h, w) * 0.02))
    seed = np.zeros((h, w), dtype=bool)
    seed[:b, :] = cand[:b, :]
    seed[-b:, :] = cand[-b:, :]
    seed[:, :b] = cand[:, :b]
    seed[:, -b:] = cand[:, -b:]
    paper = _reconstruct(seed, cand)
    a = np.clip(1.0 - paper.astype(np.float32), 0.0, 1.0)
    a[orig_a < 6.0 / 255.0] = 0.0
    return clean_mask(a, feather=0.8), {"strength": strength, "paper_pct": round(float(paper.mean() * 100), 2)}


def score(m):
    s = 0.0
    s += 3.0 * (m.get("bg_colour_residual_pct", m.get("paper_colour_residual_pct", 0)) or 0)
    s += 2.0 * (m.get("border_ring_mean_alpha", 0) / 255.0 * 100)
    s += 1.0 * (m.get("bright_halo_pct", 0))
    s -= 0.6 * (m.get("ink_kept_pct", m.get("dark_ink_kept_pct", 100)) or 0)
    return round(s, 3)


def verdict(m, kind):
    res = m.get("bg_colour_residual_pct", m.get("paper_colour_residual_pct"))
    kept = m.get("ink_kept_pct", m.get("dark_ink_kept_pct"))
    ring = m["border_ring_mean_alpha"]
    reasons = []
    if res is not None and res > 3.0:
        reasons.append("背景殘留 %.2f%% > 3%%" % res)
    if ring > 18:
        reasons.append("邊框環平均 alpha %.1f 偏高（可能見方形底）" % ring)
    if kept is not None and kept < 90:
        reasons.append("主體保留率 %.1f%% < 90%%（細節損失）" % kept)
    if not reasons:
        return "USABLE_CANDIDATE", reasons
    if res is not None and res <= 8.0 and (kept is None or kept >= 80):
        return "PARTIAL_CANDIDATE", reasons
    return "NOT_USABLE", reasons


def main():
    os.makedirs(QA, exist_ok=True)
    report = {"probe": "F1-A-MATTE", "stamp_utc": STAMP, "tool": "tools/fusion_art_matte_preview.py",
              "engine": "Pillow + numpy（本機、無 API）", "assets": {}, "notes": []}

    # ---------- banana ----------
    src_b = os.path.join(CAND, "main_v01.png")
    im_b = Image.open(src_b)
    rgb_b = np.asarray(im_b.convert("RGB"), dtype=np.float32)
    best_b = None
    for st in (1.0, 1.45):
        a, meta = banana_mask(rgb_b, st)
        m = metrics(rgb_b, None, a, "banana", bg=np.array(meta["bg_rgb"]))
        m["params"] = dict(meta, strength=st)
        m["score"] = score(m)
        if best_b is None or m["score"] < best_b[0]["score"]:
            best_b = (m, a)
    mb, ab = best_b
    rgba_b = np.dstack([np.clip(rgb_b, 0, 255).astype(np.uint8), np.clip(ab * 255, 0, 255).astype(np.uint8)])
    out_b = Image.fromarray(rgba_b, "RGBA")
    out_b.save(OUT_BANANA, "WEBP", quality=92, method=6, exact=True)
    vb, rb = verdict(mb, "banana")
    mb.update({"src": os.path.relpath(src_b, ROOT).replace("\\", "/"), "src_sha256": sha256(src_b),
               "src_bytes": os.path.getsize(src_b), "src_size": list(im_b.size), "src_mode": im_b.mode,
               "out": os.path.relpath(OUT_BANANA, ROOT).replace("\\", "/"), "out_sha256": sha256(OUT_BANANA),
               "out_bytes": os.path.getsize(OUT_BANANA), "verdict": vb, "verdict_reasons": rb})
    report["assets"]["banana"] = mb

    # ---------- gpt ----------
    src_g = os.path.join(CAND, "gpt_inkblade_original_v01.png")
    im_g = Image.open(src_g)
    rgba_g = np.asarray(im_g.convert("RGBA"), dtype=np.float32)
    best_g = None
    for st in (1.0, 1.3):
        a, meta = gpt_mask(rgba_g, st)
        m = metrics(rgba_g[..., :3], rgba_g[..., 3], a, "gpt")
        m["params"] = meta
        m["score"] = score(m)
        if best_g is None or m["score"] < best_g[0]["score"]:
            best_g = (m, a)
    mg, ag = best_g
    rgba_out_g = np.dstack([np.clip(rgba_g[..., :3], 0, 255).astype(np.uint8), np.clip(ag * 255, 0, 255).astype(np.uint8)])
    out_g = Image.fromarray(rgba_out_g, "RGBA")
    out_g.save(OUT_GPT, "WEBP", quality=92, method=6, exact=True)
    vg, rg = verdict(mg, "gpt")
    mg.update({"src": os.path.relpath(src_g, ROOT).replace("\\", "/"), "src_sha256": sha256(src_g),
               "src_bytes": os.path.getsize(src_g), "src_size": list(im_g.size), "src_mode": im_g.mode,
               "out": os.path.relpath(OUT_GPT, ROOT).replace("\\", "/"), "out_sha256": sha256(OUT_GPT),
               "out_bytes": os.path.getsize(OUT_GPT), "verdict": vg, "verdict_reasons": rg})
    report["assets"]["gpt"] = mg

    # ---------- 預覽與 mask ----------
    previews = {}
    for key, out_img, w, h in (("banana", out_b, *im_b.size), ("gpt", out_g, *im_g.size)):
        washi = washi_bg(980, 660)
        checker = checker_bg(980, 660)
        p1 = compose_preview(out_img, washi, w, h, os.path.join(QA, "preview_%s_washi.png" % key))
        p2 = compose_preview(out_img, checker, w, h, os.path.join(QA, "preview_%s_checker.png" % key))
        mask_path = os.path.join(QA, "mask_%s.png" % key)
        out_img.split()[3].save(mask_path, "PNG")
        previews[key] = {
            "washi": os.path.relpath(p1, ROOT).replace("\\", "/"),
            "checker": os.path.relpath(p2, ROOT).replace("\\", "/"),
            "mask": os.path.relpath(mask_path, ROOT).replace("\\", "/"),
            "bytes": {k: os.path.getsize(v) for k, v in (("washi", p1), ("checker", p2), ("mask", mask_path))},
        }
    report["previews"] = previews
    report["status"] = ("MATTE_CANDIDATE_READY"
                        if all(report["assets"][k]["verdict"] == "USABLE_CANDIDATE" for k in ("banana", "gpt"))
                        else "MATTE_CANDIDATE_PARTIAL")
    report["notes"] = [
        "源圖未修改；只新增 webp 衍生檔與 scratch 證據。",
        "banana 深墨與 [24,24,24] 背景接近：以「深墨救援」保留墨線，代價是極暗墨可能仍半透明，已記 ink_mean_alpha。",
        "gpt 原圖 99.81% 半透明和紙底 + 暗角：以亮×低飽和×低細節 + 邊框暗暈判紙底，非以 RGBA 含 A 即視為已去背。",
        "候選僅供 AGY 接入評估，非 ART_PASS；FILTER/最終核准仍屬使用者人審。",
    ]
    out_json = os.path.join(QA, "matte-eval.json")
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(json.dumps({"status": report["status"], "json": os.path.relpath(out_json, ROOT).replace("\\", "/"),
                      "banana": {k: report["assets"]["banana"][k] for k in ("verdict", "out_bytes", "alpha_coverage_pct", "border_ring_mean_alpha", "verdict_reasons")},
                      "gpt": {k: report["assets"]["gpt"][k] for k in ("verdict", "out_bytes", "alpha_coverage_pct", "border_ring_mean_alpha", "verdict_reasons")}},
                     ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
