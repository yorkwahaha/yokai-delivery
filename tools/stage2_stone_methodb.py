#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""S2 雨夜漁港石板 Method B — 零付費離線無縫候選製作工具（S2-STONE-METHODB-NOCOST-P1）

規格來源：docs/S2_STONE_METHOD_B_PRODUCTION_20261021.md

輸入（唯讀，不修改）
  art/stage2-rain-port/s2-ground-redraw-20261021/G_ground_stone_nano_nb21_v3.png
  真手繪 NanoBanana 原稿，2048x2048 RGB。

輸出（只新增）
  art/stage2-rain-port/s2-stone-methodb-20261021/**

方法（純圖像像素處理；不用 SVG、不畫程序幾何石頭）
  A. 取 7 個來源 1024² 裁切（master + 6 variants），不重繪石板。
  B. 低頻平坦化：每個裁切減去 sigma=128 的 Gaussian 低頻場，再加共同常數
     target RGB，移除原稿大面積打光差與色偏；保留局部墨線、石紋與反光。
  C. 共用邊帶：所有 tile 最外 1px 使用同一組來源條帶（master 中心 x=512／
     y=512 的相鄰 2px 對），並以 ring 顏色向內指數衰減到各 tile 自身邊緣。因此任意
     A→B 的右→左、下→上接界都等於 master 自身的 1px 接界；tile 內部仍各自
     不同。這是 1px 契約，不是舊版的 192px 灰框。
  D. 每個 tile 最後做全域亮度對齊到中位數（上限 ±2），避免亮暗棋盤格。

**已知限制（本輪實測，必須如實揭露）**
  1px 共用邊帶在數學上無縫（self-seam 與所有 ordered pair 相同），但 6×6
  預覽仍看得到細格線；裁切的中頻亮度差亦會形成大塊明暗。這是來源單張高
  對比斜向石板＋強打光梯度的限制，不是「任意混鋪已美術 PASS」。本工具預設
  輸出 ART_FAIL_DIAGNOSTIC_ONLY，交由人類決定是否另開重繪／人工修邊票。

LEGACY：下方 Quilter／min_cut_path 是舊 2T-canvas 路徑，只留作稽核；
  其 seam_columns() 只在 x=T 附近寫 2B 帶、未處理輸出右緣 x=2T，會在帶的
  內緣留下硬框，**不可**再產生候選。main() 已改用 SharedRingBuilder。

依賴：Pillow + numpy（本機；無網路、無任何付費 API）
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import platform
import time
from datetime import datetime, timezone

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

TICKET = "S2-STONE-METHODB-NOCOST-P1"


# ---------------------------------------------------------------- 基本工具 --

def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def load_rgb(path: str) -> np.ndarray:
    with Image.open(path) as im:
        im = im.convert("RGB")
        return np.asarray(im, dtype=np.uint8)


def save_rgb(arr: np.ndarray, path: str) -> None:
    Image.fromarray(np.clip(np.rint(arr), 0, 255).astype(np.uint8), "RGB").save(
        path, format="PNG", optimize=True
    )


def torus_ranges(start: int, length: int, size: int) -> list[tuple[int, int, int]]:
    """把可 wrap 的 1D 區段拆成不重疊的 (dst_start, len, src_start)。"""
    out, pos, remaining, src = [], start % size, length, 0
    while remaining > 0:
        take = min(remaining, size - pos)
        out.append((pos, take, src))
        src += take
        remaining -= take
        pos = (pos + take) % size
    return out


def slice_torus(arr: np.ndarray, y0: int, x0: int, ph: int, pw: int) -> np.ndarray:
    """讀取 arr 上 (y0,x0) 起 ph×pw 的環面區域（可 wrap）。"""
    h, w = arr.shape[:2]
    rows, cols = torus_ranges(y0, ph, h), torus_ranges(x0, pw, w)
    out = np.empty((ph, pw, 3), dtype=np.float32)
    py = 0
    for dy, ny, _ in rows:
        px = 0
        for dx, nx, _ in cols:
            out[py:py + ny, px:px + nx] = arr[dy:dy + ny, dx:dx + nx]
            px += nx
        py += ny
    return out


# ------------------------------------------------------- 最小誤差切割路徑 --

def min_cut_path(err: np.ndarray, max_step: int = 1) -> np.ndarray:
    """err (n, m)：位置 i 選狀態 j 的成本。回傳長度 n 的狀態序，相鄰差 ≤ max_step。"""
    n, m = err.shape
    if n == 1:
        return np.argmin(err, axis=1).astype(np.int32)
    inf = np.float32(1e18)
    dp = err[0].astype(np.float32).copy()
    parent = np.zeros((n, m), dtype=np.int16)
    idx = np.arange(m)
    for i in range(1, n):
        best, bestp = dp.copy(), idx.copy()
        for step in range(1, max_step + 1):
            if step >= m:
                break
            cand = np.full(m, inf, dtype=np.float32)
            cand[step:] = dp[:-step]
            take = cand < best
            best[take] = cand[take]
            bestp[take] = (idx[take] - step).astype(np.int16)
            cand = np.full(m, inf, dtype=np.float32)
            cand[:-step] = dp[step:]
            take = cand < best
            best[take] = cand[take]
            bestp[take] = (idx[take] + step).astype(np.int16)
        dp = err[i] + best
        parent[i] = bestp
    c = int(np.argmin(dp))
    path = np.zeros(n, dtype=np.int32)
    for i in range(n - 1, -1, -1):
        path[i] = c
        if i > 0:
            c = int(parent[i, c])
    return path


def alpha_from_cut(cut: np.ndarray, width: int, feather: float, axis: int) -> np.ndarray:
    """由切割路徑產生 0..1 權重（1 = 取平移側內容）。"""
    cols = np.arange(width, dtype=np.float32)
    c = cut.astype(np.float32)
    if axis == 0:                       # cut 沿 rows（每 row 一個位置）
        a = (cols[None, :] - (c[:, None] - 0.5)) / max(feather, 1e-3)
    else:                               # cut 沿 cols（每 col 一個位置）
        a = (cols[:, None] - (c[None, :] - 0.5)) / max(feather, 1e-3)
    return np.clip(a, 0.0, 1.0)


# --------------------------------------------------------------- quilting ---

# LEGACY / REFERENCE ONLY. The 2T-canvas path below is kept for audit and diff
# only; its seam_columns() writes a 2B band around x=T but never repairs the
# output's right edge (x=2T), leaving a hard 192px frame at the band's inner
# edge. main() uses SharedRingBuilder instead. Do not generate candidates here.
class Quilter:
    """2T 工作帆布貼片 quilting + torus 裁剪縫合（legacy, 不再使用）。"""

    def __init__(self, src: np.ndarray, tile: int, patch: int, rng: np.random.Generator,
                 feather: float = 3.0, max_step: int = 1, cand_k: int = 12,
                 warm_boost: float = 3.0, score_stride: int = 2, band_w: int = 192):
        self.src = src
        self.H, self.W = src.shape[:2]
        self.T, self.P, self.s = tile, patch, patch // 2
        self.O = patch - self.s
        self.Wc = 2 * tile
        assert patch > self.s > 0 and patch % 2 == 0
        assert (self.Wc - patch) % self.s == 0, "2T 必須滿足 (2T-P) % s == 0"
        self.n = (self.Wc - patch) // self.s + 1
        self.rng, self.feather, self.max_step = rng, feather, max_step
        self.cand_k, self.score_stride = cand_k, score_stride
        self.band_w = min(band_w, self.P)

        self.canvas = np.zeros((self.Wc, self.Wc, 3), dtype=np.uint8)

        # 用量／暖色反光圖
        self.stride = 32
        self.gy_n, self.gx_n = max(1, self.H // self.stride), max(1, self.W // self.stride)
        self.usage = np.zeros((self.gy_n, self.gx_n), dtype=np.float32)
        f = src.astype(np.float32)
        lum = 0.299 * f[..., 0] + 0.587 * f[..., 1] + 0.114 * f[..., 2]
        warm = ((f[..., 0] - f[..., 2]) > 26) & (lum > 120)
        cells = np.zeros((self.gy_n, self.gx_n), dtype=np.float32)
        for cy in range(self.gy_n):
            y0, y1 = cy * self.stride, min((cy + 1) * self.stride, self.H)
            for cx in range(self.gx_n):
                x0, x1 = cx * self.stride, min((cx + 1) * self.stride, self.W)
                cells[cy, cx] = float(warm[y0:y1, x0:x1].mean())
        self.warm = (cells > 0.02).astype(np.float32)
        self.warm_boost = warm_boost
        self.placements: list[dict] = []

    # ---- 來源 / 畫布 -----------------------------------------------------
    def read_patch(self, cy: int, cx: int) -> np.ndarray:
        return slice_torus(self.src, cy, cx, self.P, self.P)

    def canvas_region(self, y0: int, x0: int, ph: int, pw: int) -> np.ndarray:
        h = w = self.Wc
        rows, cols = torus_ranges(y0, ph, h), torus_ranges(x0, pw, w)
        out = np.empty((ph, pw, 3), dtype=np.float32)
        py = 0
        for dy, ny, _ in rows:
            px = 0
            for dx, nx, _ in cols:
                out[py:py + ny, px:px + nx] = self.canvas[dy:dy + ny, dx:dx + nx]
                px += nx
            py += ny
        return out

    def write(self, y0: int, x0: int, arr: np.ndarray) -> None:
        ph, pw = arr.shape[:2]
        h = w = self.Wc
        for dy, ny, sy in torus_ranges(y0, ph, h):
            for dx, nx, sx in torus_ranges(x0, pw, w):
                self.canvas[dy:dy + ny, dx:dx + nx] = \
                    np.clip(np.rint(arr[sy:sy + ny, sx:sx + nx]), 0, 255).astype(np.uint8)

    # ---- 用量 / 暖色 -----------------------------------------------------
    def _cells(self, cy: int, cx: int) -> tuple[np.ndarray, np.ndarray]:
        y0, y1 = cy // self.stride, (cy + self.P) // self.stride
        x0, x1 = cx // self.stride, (cx + self.P) // self.stride
        ys = np.arange(max(0, y0), min(self.gy_n, y1 + 1)) % self.gy_n
        xs = np.arange(max(0, x0), min(self.gx_n, x1 + 1)) % self.gx_n
        return np.ix_(ys, xs)

    def usage_score(self, cy: int, cx: int) -> float:
        ry, rx = self._cells(cy, cx)
        u, w = self.usage[ry, rx], self.warm[ry, rx]
        return float(u.mean() + self.warm_boost * (u * w).mean())

    def bump_usage(self, cy: int, cx: int) -> None:
        ry, rx = self._cells(cy, cx)
        self.usage[ry, rx] += 1.0

    # ---- 貼片間切割 ------------------------------------------------------
    def cut_axis(self, patch: np.ndarray, x0: int, y0: int, axis: str) -> np.ndarray:
        """axis='h': 與左鄰居在 O 寬帶切割；axis='v': 與上鄰居。"""
        O = self.O
        if axis == "h":
            existing = self.canvas_region(y0, x0, self.P, O)
            new = patch[:, :O]
            err = ((existing - new) ** 2).mean(axis=2)
            cut = min_cut_path(err, self.max_step)
            a = alpha_from_cut(cut, O, self.feather, axis=0)[..., None]
            patch[:, :O] = existing * (1 - a) + new * a
        else:
            existing = self.canvas_region(y0, x0, O, self.P)
            new = patch[:O, :]
            err = ((existing - new) ** 2).mean(axis=2)
            cut = min_cut_path(err.T, self.max_step)
            a = alpha_from_cut(cut, O, self.feather, axis=1)[..., None]
            patch[:O, :] = existing * (1 - a) + new * a
        return patch

    # ---- 候選評分 --------------------------------------------------------
    def score(self, cy: int, cx: int, x0: int, y0: int, gx: int, gy: int) -> float:
        st = self.score_stride
        ssd = 0.0
        if gx > 0:
            e = self.canvas_region(y0, x0, self.P, self.O)
            c = self.read_patch(cy, cx)[:, :self.O]
            ssd += ((e[::st, ::st] - c[::st, ::st]) ** 2).sum()
        if gy > 0:
            e = self.canvas_region(y0, x0, self.O, self.P)
            c = self.read_patch(cy, cx)[:self.O]
            ssd += ((e[::st, ::st] - c[::st, ::st]) ** 2).sum()
        return float(ssd) / (st * st)

    # ---- 縫合（torus 裁剪）-----------------------------------------------
    def seam_columns(self) -> None:
        """輸出視窗左右邊界：以視窗邊界為中心的完整環帶 [T-B, T+B) 做一次環形最小切割。

        寫出：視窗左半帶 [T-B, T) 被合成內容覆蓋；右半帶 [T, T+B) 保持原狀。
        因環帶長 2B 且切割路徑連續，接縫（T mod T = 0）兩側在視窗邊界處連續。
        """
        B, T = self.band_w, self.T
        # 製作環帶冠軍：以視窗左緣為 x 起點，取 2B 寬
        band = self.canvas[:, T - B:T + B] if T - B >= 0 else None
        assert T - B >= 0, "band 過大"
        band = band.astype(np.float32)
        bl = band.copy()                       # 左半 B 欄（視窗左側）
        br = band.copy()                       # 右半 B 欄（視窗右側）
        # 對每一列，比較 [x in band, 2B) 的左段與 [T+(x-2B) mod T 位置] ...
        # 直接以「絕對座標」策略：切割以 column k in [0, 2B) 為切點，
        # 上側（band 起點側）取原 working 內容，下側取平移 T 的 working 內容。
        shifted = np.roll(band, -T % (2 * B) + 0, axis=1) if False else None
        # 平移 T 的working內容 = 把 band 兩半互換後再 roll：等價於 working[:, T:x] ∪ y[:, x:T]
        # 以陣列實作：y = concat(bright_half, left_half) 的環形平移（長度 2*B 對齊視窗邊界）
        y = np.concatenate([band[:, B:2 * B], band[:, 0:B]], axis=1)      # 平移 B 不是 T…
        # 正確平移量：視窗左右邊界在環面上相同，等價於平移 T ≢ mod 2B；
        # 因此以最小值取代：y_cand = 將整張 canvas 平移 T 後再取同一 band（價格可接受）
        ys, xs = np.arange(0, self.Wc), np.arange(T - B, T + B)
        y_full = slice_torus(np.roll(self.canvas, -T, axis=1), ys[0, None] * 0 + 0, xs[0] * 0 + 0, self.Wc, 2 * B) \
            if False else None
        # 簡潔做法：直接平移整張畫布 T 得 y（記憶體 3 x 4096 x 4096 float32 ≈ 200MB，可接受）
        y_full = np.roll(self.canvas.astype(np.float32), -T, axis=1)[:, T - B:T + B]
        err = ((band - y_full) ** 2).mean(axis=2)                # (Wc, 2B)
        cut = min_cut_path(err, self.max_step)                    # 每列切點 k
        cols = np.arange(2 * B, dtype=np.float32)[None, :]
        a = np.clip((cols - (cut.astype(np.float32)[:, None] - 0.5)) / self.feather, 0.0, 1.0)
        merged = band * (1 - a[..., None]) + y_full * a[..., None]
        self.canvas[:, T - B:T + B] = np.clip(np.rint(merged), 0, 255).astype(np.uint8)

    def seam_rows(self) -> None:
        """上／下邊界，同法：以視窗邊界為中心的完整環帶做一次環形 min-cut。"""
        B, T = self.band_w, self.T
        top = self.canvas[T - B:T, :].astype(np.float32)
        bottom = self.canvas[T:T + B, :].astype(np.float32)
        err = np.empty((2 * B, self.Wc), dtype=np.float32)
        for k in range(2 * B):
            if k < B:
                err[k] = (top[k:B] - bottom[0:B - k]).mean(axis=(0, 2))
            else:
                pk = 2 * B - k
                err[k] = (top[0:pk] - bottom[pk:2 * B]).mean(axis=(0, 2))
        cut = min_cut_path(err, self.max_step)
        row_cut = cut + (T - B)
        rows = np.arange(T - B, T)[:, None].astype(np.float32)
        a_tb = np.clip((rows - (row_cut[None, :] - 0.5)) / self.feather, 0.0, 1.0)[..., None]
        merged = top * (1 - a_tb) + bottom * a_tb
        self.canvas[T - B:T, :] = np.clip(np.rint(merged), 0, 255).astype(np.uint8)

    # ---- 主流程 ----------------------------------------------------------
    def build(self, verbose: bool = False) -> np.ndarray:
        n = self.n
        for gy in range(n):
            for gx in range(n):
                x0, y0 = gx * self.s, gy * self.s
                best = None
                for _ in range(self.cand_k):
                    cy = int(self.rng.integers(0, self.H - self.P + 1))
                    cx = int(self.rng.integers(0, self.W - self.P + 1))
                    sc = 0.0
                    if gx > 0 or gy > 0:
                        sc = self.score(cy, cx, x0, y0, gx, gy)
                    sc += 0.35 * self.usage_score(cy, cx)
                    sc += float(self.rng.uniform(0.0, 0.02 * (self.score(0, 0, 0, 0, 0, 0) + 1.0)))
                    if best is None or sc < best[0]:
                        best = (sc, cy, cx)
                sc, cy, cx = best
                patch = self.read_patch(cy, cx)
                if gx > 0:
                    patch = self.cut_axis(patch, x0, y0, "h")
                if gy > 0:
                    patch = self.cut_axis(patch, x0, y0, "v")
                self.write(y0, x0, patch)
                self.bump_usage(cy, cx)
                self.placements.append({"gx": gx, "gy": gy, "src_xy": [int(cx), int(cy)]})
        self.seam_columns()
        self.seam_rows()
        return self.canvas[self.T:self.Wc, self.T:self.Wc].astype(np.float32)


# ------------------------------------------------ shared-ring tile builder ---

def gaussian_lowfreq(arr: np.ndarray, sigma: float) -> np.ndarray:
    """RGB Gaussian 低頻場（Pillow，和紙／墨線不會被當成高頻洗掉）。"""
    im = Image.fromarray(np.clip(np.rint(arr), 0, 255).astype(np.uint8), "RGB")
    return np.asarray(im.filter(ImageFilter.GaussianBlur(float(sigma))), dtype=np.float32)


def luminance(arr: np.ndarray) -> np.ndarray:
    return 0.299 * arr[..., 0] + 0.587 * arr[..., 1] + 0.114 * arr[..., 2]


class SharedRingBuilder:
    """來源裁切 + 低頻平坦化 + 1px 共用邊帶／向內指數羽化（tile 自身邊緣）。

    契約：每個 tile 的最外 1px 由同一組條帶覆蓋（右→左、下→上相接），
    因此所有 ordered pair（含 self）的邊界像素完全相同；tile 內部仍各自
    來自不同裁切。這是唯一能保證任意互拼的邊帶，寬度刻意壓到 1px，
    避免舊版 192px 灰框；但 1px 細線仍可能在 6×6 目視看到，見 QA_NOTES。
    """

    def __init__(self, src: np.ndarray, crops: list[tuple[int, int]], tile: int = 1024,
                 flatten_sigma: float = 128.0, ring_xy: tuple[int, int] = (512, 512),
                 ring_feather: int = 4):
        self.src = src
        self.H, self.W = src.shape[:2]
        self.T = tile
        self.crops = crops
        self.sigma = flatten_sigma
        self.vx, self.hy = ring_xy
        self.feather = ring_feather
        for x, y in crops:
            assert 0 <= x <= self.W - tile and 0 <= y <= self.H - tile, \
                f"crop {(x, y)} outside {self.W}x{self.H} for tile {tile}"
        assert 0 <= ring_feather <= tile // 8
        assert 0 <= self.vx - ring_feather and self.vx + ring_feather + 2 <= self.W
        assert 0 <= self.hy - ring_feather and self.hy + ring_feather + 2 <= self.H

    def build(self) -> tuple[list[np.ndarray], dict]:
        T, fe = self.T, self.feather
        raw = [self.src[y:y + T, x:x + T].copy() for x, y in self.crops]
        target = np.mean(np.concatenate([c.reshape(-1, 3) for c in raw], axis=0), axis=0)
        flat = []
        lf_std, raw_lum = [], []
        for c in raw:
            f = np.clip(c - gaussian_lowfreq(c, self.sigma) + target, 0, 255)
            flat.append(f)
            lf_std.append(round(float(gaussian_lowfreq(c, 96.0).std()), 3))
            raw_lum.append(round(float(luminance(c).mean()), 2))
        lums = [float(luminance(f).mean()) for f in flat]
        lum_target = float(np.median(lums))
        for i, f in enumerate(flat):
            flat[i] = f + float(np.clip(lum_target - lums[i], -2.0, 2.0))

        srcf = np.clip(self.src - gaussian_lowfreq(self.src, self.sigma) + target, 0, 255)
        vstrip = srcf[:T, self.vx - fe:self.vx + fe + 2]       # (T, 2fe+2), pair at fe/fe+1
        hstrip = srcf[self.hy - fe:self.hy + fe + 2, :T]       # (2fe+2, T)
        cb = srcf[self.hy:self.hy + 2, self.vx:self.vx + 2]

        tiles = []
        for f in flat:
            t = f.astype(np.float32).copy()
            left_ring = vstrip[:, fe + 1]
            right_ring = vstrip[:, fe]
            top_ring = hstrip[fe + 1, :]
            bottom_ring = hstrip[fe, :]
            for k in range(1, fe + 1):
                # decay to the tile's own edge; do not paste a foreign 4px strip
                a = 0.5 ** k
                t[:, k] = a * left_ring + (1 - a) * t[:, k]
                t[:, T - 1 - k] = a * right_ring + (1 - a) * t[:, T - 1 - k]
                t[k, :] = a * top_ring + (1 - a) * t[k, :]
                t[T - 1 - k, :] = a * bottom_ring + (1 - a) * t[T - 1 - k, :]
            t[:, 0] = vstrip[:, fe + 1]
            t[:, T - 1] = vstrip[:, fe]
            t[0, :] = hstrip[fe + 1, :]
            t[T - 1, :] = hstrip[fe, :]
            t[0, 0] = cb[1, 1]
            t[0, T - 1] = cb[1, 0]
            t[T - 1, 0] = cb[0, 1]
            t[T - 1, T - 1] = cb[0, 0]
            tiles.append(np.clip(np.rint(t), 0, 255).astype(np.uint8))

        meta = {
            "crops_xy": [[int(x), int(y)] for x, y in self.crops],
            "flatten_sigma_px": self.sigma,
            "flatten_target_rgb": [round(float(v), 3) for v in target],
            "luminance_target": round(lum_target, 3),
            "luminance_shift_max": 2.0,
            "ring": {
                "shared_px": 1,
                "feather_px": fe,
                "center_xy": [int(self.vx), int(self.hy)],
                "vertical_pair_x": [int(self.vx), int(self.vx + 1)],
                "horizontal_pair_y": [int(self.hy), int(self.hy + 1)],
                "vertical_pair_sha256": hashlib.sha256(vstrip[:, fe:fe + 2].tobytes()).hexdigest(),
                "horizontal_pair_sha256": hashlib.sha256(hstrip[fe:fe + 2, :].tobytes()).hexdigest(),
                "corner_block_sha256": hashlib.sha256(cb.tobytes()).hexdigest(),
                "corner_block_rgb": cb.astype(np.uint8).tolist(),
            },
            "crop_lowfreq_std_sigma96": lf_std,
            "crop_raw_mean_luminance": raw_lum,
            "tile_mean_luminance_pre_ring": [round(x, 3) for x in lums],
        }
        return tiles, meta


# ------------------------------------------------------------------- QA -----

def edge_metrics(arr: np.ndarray) -> dict:
    t = arr.shape[0]
    a = arr.astype(np.int16)  # uint8 subtraction would wrap and understate the seam
    lr = float(np.abs(a[:, 0] - a[:, -1]).mean())
    tb = float(np.abs(a[0, :] - a[-1, :]).mean())
    ci, ri = [], []
    for k in range(1, 9):
        c = (t * k) // 9
        ci.append(float(np.abs(a[:, c] - a[:, c - 1]).mean()))
        ri.append(float(np.abs(a[c, :] - a[c - 1, :]).mean()))
    ic, ir = float(np.mean(ci)), float(np.mean(ri))
    return {
        "seam_left_right_mean_abs_rgb": round(lr, 4),
        "seam_top_bottom_mean_abs_rgb": round(tb, 4),
        "internal_adjacent_cols_mean_abs_rgb": round(ic, 4),
        "internal_adjacent_rows_mean_abs_rgb": round(ir, 4),
        "seam_ratio_vs_internal_cols": round(lr / max(1e-6, ic), 3),
        "seam_ratio_vs_internal_rows": round(tb / max(1e-6, ir), 3),
    }


def periodicity(arr: np.ndarray, lags: list[int]) -> dict:
    a = arr.astype(np.int16)
    out = {}
    for lag in lags:
        out[f"lag_{lag}"] = {
            "dx": round(float(np.abs(a - np.roll(a, lag, axis=1)).mean()), 3),
            "dy": round(float(np.abs(a - np.roll(a, lag, axis=0)).mean()), 3),
            "dxy": round(float(np.abs(a - np.roll(np.roll(a, lag, axis=1), lag, axis=0)).mean()), 3),
        }
    return out


def color_stats(arr: np.ndarray) -> dict:
    mean = arr.reshape(-1, 3).mean(axis=0)
    lum = 0.299 * arr[..., 0] + 0.587 * arr[..., 1] + 0.114 * arr[..., 2]
    return {
        "mean_rgb": [round(float(mean[0]), 2), round(float(mean[1]), 2), round(float(mean[2]), 2)],
        "mean_luminance": round(float(lum.mean()), 2),
        "luminance_p5_p95": [round(float(np.percentile(lum, 5)), 1), round(float(np.percentile(lum, 95)), 1)],
        "warm_highlight_ratio": round(float((((arr[..., 0] - arr[..., 2]) > 26) & (lum > 120)).mean()), 4),
    }


def autocell(arr: np.ndarray, k: int = 3) -> dict:
    """縮圖 k×k 九宮格自相關：揭露共同石板骨架／等距週期。"""
    im = Image.fromarray(np.clip(np.rint(arr), 0, 255).astype(np.uint8), "RGB").resize((192, 192), Image.LANCZOS)
    a = np.asarray(im, dtype=np.float32)
    cell = 192 // k
    cells = []
    for i in range(k):
        for j in range(k):
            cells.append(a[i * cell:(i + 1) * cell, j * cell:(j + 1) * cell].reshape(-1, 3).mean(axis=0))
    c = np.stack(cells)
    d = [round(float(np.abs(c[i] - c[j]).mean()), 3) for i in range(len(c)) for j in range(i + 1, len(c))]
    return {"k": k, "mean_intercell_abs_rgb": round(float(np.mean(d)), 3),
            "min": min(d), "max": max(d)}


def pair_edge_matrix(tiles: list[np.ndarray], side: str) -> list[list[float]]:
    """完整 ordered pair 邊差矩陣（含對角 self-tiling）。"""
    out = []
    for a in tiles:
        row = []
        for b in tiles:
            if side == "lr":
                d = np.abs(a[:, -1].astype(np.int16) - b[:, 0].astype(np.int16)).mean()
            elif side == "tb":
                d = np.abs(a[-1, :].astype(np.int16) - b[0, :].astype(np.int16)).mean()
            else:
                raise ValueError(side)
            row.append(round(float(d), 4))
        out.append(row)
    return out


def pair_image_matrix(tiles: list[np.ndarray]) -> list[list[float]]:
    out = []
    for a in tiles:
        out.append([round(float(np.abs(a.astype(np.int16) - b.astype(np.int16)).mean()), 4)
                    for b in tiles])
    return out


def corner_contract(tiles: list[np.ndarray]) -> dict:
    """外 1px 角落契約：TL/TR/BL/BR 在各 tile 必須同值；四拼交接再現來源 2x2。"""
    pos = {"tl": (0, 0), "tr": (0, -1), "bl": (-1, 0), "br": (-1, -1)}
    values = {k: [t[y, x].tolist() for t in tiles] for k, (y, x) in pos.items()}
    same = {k: all(v == vals[0] for v in vals) for k, vals in values.items()}
    junction = [
        [tiles[0][-1, -1].tolist(), tiles[1][-1, 0].tolist()],
        [tiles[2][0, -1].tolist(), tiles[3][0, 0].tolist()],
    ]
    block = np.asarray(junction, dtype=np.uint8)
    return {
        "corner_pixels": values,
        "corner_pixels_identical_across_tiles": same,
        "four_tile_junction_2x2_rgb": junction,
        "four_tile_junction_sha256": hashlib.sha256(block.tobytes()).hexdigest(),
        "note": ("outer 1px corners are shared; the 4-tile junction reproduces the source "
                 "center 2x2 block up to the per-tile luminance shift (per-channel delta reported)"),
    }


def junction_metric(grid: np.ndarray, cx: int, cy: int, half: int = 2) -> dict:
    """四拼交接 4x4 的局部相鄰差，與同一張圖的內部相鄰差對照。"""
    b = grid[cy - half:cy + half, cx - half:cx + half].astype(np.int16)
    hd = np.abs(b[:, 1:] - b[:, :-1]).mean(axis=(0, 2))
    vd = np.abs(b[1:, :] - b[:-1, :]).mean(axis=(1, 2))
    return {"max_horizontal_adjacent": round(float(hd.max()), 3),
            "max_vertical_adjacent": round(float(vd.max()), 3)}


# --------------------------------------------------------------- 預覽 -------

def _thumb(t: np.ndarray, cell: int) -> Image.Image:
    im = Image.fromarray(np.clip(np.rint(t), 0, 255).astype(np.uint8), "RGB")
    return im.resize((cell, cell), Image.LANCZOS) if im.width != cell else im


def tile_grid(t: np.ndarray, k: int, cell: int) -> np.ndarray:
    g = Image.new("RGB", (cell * k, cell * k))
    t = _thumb(t, cell)
    for i in range(k):
        for j in range(k):
            g.paste(t, (j * cell, i * cell))
    return np.asarray(g, dtype=np.uint8)


def mixed_grid(tiles: list[np.ndarray], cell: int, k: int, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    ids = rng.integers(0, len(tiles), size=(k, k))
    g = Image.new("RGB", (cell * k, cell * k))
    cache = {}
    for i in range(k):
        for j in range(k):
            idx = int(ids[i, j])
            if idx not in cache:
                cache[idx] = _thumb(tiles[idx], cell)
            g.paste(cache[idx], (j * cell, i * cell))
    return np.asarray(g, dtype=np.uint8)


def contact_sheet(tiles: list[np.ndarray], names: list[str], cell: int) -> np.ndarray:
    pad, label_h = 16, 26
    n = len(tiles)
    cols = min(4, n)
    rows = math.ceil(n / cols)
    sheet = Image.new("RGB", (cols * cell + pad * (cols + 1), rows * (cell + label_h) + pad * (rows + 1)), (24, 24, 26))
    dr = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("arial.ttf", 16)
    except Exception:
        font = ImageFont.load_default(size=16)
    for i, t in enumerate(tiles):
        r, c = divmod(i, cols)
        x, y = pad + c * (cell + pad), pad + r * (cell + label_h + pad)
        sheet.paste(_thumb(t, cell), (x, y))
        dr.text((x, y + cell + 4), names[i], fill=(220, 220, 220), font=font)
    return np.asarray(sheet, dtype=np.uint8)


# --------------------------------------------------------------- 主程式 -----

EXPECTED_SOURCE_SHA = "aff52293f82289248c2bd3d2795f2fd1bd6418a35d8cbcc5fa66a4a6e3f7efe6"
DEFAULT_GAP = (
    "來源 v3 的 1024 裁切在 6×6 仍看得到 1px 共用邊帶細格線與中頻明暗大塊；"
    "需要人工重繪／修邊一張真正 1024 無縫母版（或在 Photoshop 以內容感知修補接縫）"
    "後，才能再談 6 變體混鋪。"
)


def default_crops(src_w: int, src_h: int, tile: int) -> list[tuple[int, int]]:
    xs, ys = [0, src_w - tile], [0, src_h - tile]
    crops = [(x, y) for y in ys for x in xs]
    crops += [(tile // 2, tile // 2), (tile // 2, 0), (0, tile // 2),
              (tile, tile // 2), (tile // 2, tile)]
    return crops


def candidate_filename(name: str) -> str:
    if name == "master":
        return "G_ground_stone_master_candidate_v1.png"
    return f"G_ground_stone_{name}_candidate_v1.png"


def main() -> int:
    ap = argparse.ArgumentParser(description="S2 stone Method B offline shared-ring candidates")
    ap.add_argument("--source", default="art/stage2-rain-port/s2-ground-redraw-20261021/G_ground_stone_nano_nb21_v3.png")
    ap.add_argument("--out-dir", default="art/stage2-rain-port/s2-stone-methodb-20261021")
    ap.add_argument("--tile", type=int, default=1024)
    ap.add_argument("--variants", type=int, default=6)
    ap.add_argument("--game-size", type=int, default=512)
    ap.add_argument("--flatten-sigma", type=float, default=128.0)
    ap.add_argument("--ring-x", type=int, default=512)
    ap.add_argument("--ring-y", type=int, default=512)
    ap.add_argument("--ring-feather", type=int, default=4)
    ap.add_argument("--seed", type=int, default=20261021)
    ap.add_argument("--expected-source-sha", default=EXPECTED_SOURCE_SHA)
    ap.add_argument("--verdict", default="ART_FAIL_DIAGNOSTIC_ONLY")
    ap.add_argument("--gap", default=DEFAULT_GAP)
    args = ap.parse_args()

    t_start = time.time()
    if not os.path.isfile(args.source):
        print(f"[{TICKET}] source not found: {args.source}")
        return 2
    src_sha = sha256_file(args.source)
    if args.expected_source_sha and src_sha.lower() != args.expected_source_sha.lower():
        print(f"[{TICKET}] SOURCE SHA MISMATCH\n expected {args.expected_source_sha}\n actual   {src_sha}")
        return 2
    src = load_rgb(args.source)
    if src.ndim != 3 or src.shape[2] != 3:
        print(f"[{TICKET}] source is not RGB: {src.shape}")
        return 2
    T = args.tile
    if src.shape[0] < T or src.shape[1] < T:
        print(f"[{TICKET}] source {src.shape[1]}x{src.shape[0]} smaller than tile {T}")
        return 2

    os.makedirs(args.out_dir, exist_ok=True)
    src_path = args.source.replace("\\", "/")
    print(f"[{TICKET}] source {src_path} {src.shape[1]}x{src.shape[0]} sha256={src_sha}")

    crops = default_crops(src.shape[1], src.shape[0], T)
    if args.variants < 1 or args.variants + 1 > len(crops):
        print(f"[{TICKET}] variants must be 1..{len(crops) - 1} (got {args.variants})")
        return 2
    selected = [crops[0]] + crops[1:1 + args.variants]
    names = ["master"] + [f"var{i:02d}" for i in range(1, args.variants + 1)]
    all_state = "ART_FAIL_DIAGNOSTIC_ONLY / NOT_ART_PASS" if args.verdict.startswith("ART_FAIL") \
        else "ART_CANDIDATE / NOT_ART_PASS"

    builder = SharedRingBuilder(src, selected, tile=T, flatten_sigma=args.flatten_sigma,
                                ring_xy=(args.ring_x, args.ring_y),
                                ring_feather=args.ring_feather)
    t0 = time.time()
    tiles, meta = builder.build()
    build_seconds = round(time.time() - t0, 1)
    print(f"[{TICKET}] built {len(tiles)} tiles in {build_seconds}s "
          f"(shared ring 1px + {args.ring_feather}px feather, flatten sigma={args.flatten_sigma})")

    written: list[str] = []

    # 1024 candidates
    for nm, tile in zip(names, tiles):
        fn = candidate_filename(nm)
        save_rgb(tile, os.path.join(args.out_dir, fn))
        written.append(fn)

    # 512 game candidates
    for nm, tile in zip(names, tiles):
        fn = f"G_ground_stone_{nm}_game512.png"
        _thumb(tile, args.game_size).save(os.path.join(args.out_dir, fn),
                                          format="PNG", optimize=True)
        written.append(fn)

    # previews
    print(f"[{TICKET}] previews ...")
    variants = tiles[1:]
    seam_grid = np.empty((2 * T, 2 * T, 3), dtype=np.uint8)
    for idx, (dy, dx) in enumerate([(0, 0), (0, T), (T, 0), (T, T)]):
        seam_grid[dy:dy + T, dx:dx + T] = variants[idx % len(variants)]
    seam_img = seam_grid[T - T // 2:T + T // 2, T - T // 2:T + T // 2]
    junction = seam_grid[T - 16:T + 16, T - 16:T + 16]
    junction_4x = np.asarray(Image.fromarray(junction).resize((128, 128), Image.NEAREST))

    previews = [
        ("review_master_3x3.png", "master 3x3 @1024", tile_grid(tiles[0], 3, 1024)),
        ("review_master_6x6.png", "master 6x6 @512", tile_grid(tiles[0], 6, 512)),
        ("review_variants_3x3.png", f"{len(variants)} variants mixed 3x3 @1024",
         mixed_grid(variants, 1024, 3, args.seed + 11)),
        ("review_variants_6x6.png", f"{len(variants)} variants mixed 6x6 @512",
         mixed_grid(variants, 512, 6, args.seed + 12)),
        ("review_variants_10x10.png", f"{len(variants)} variants mixed 10x10 @384",
         mixed_grid(variants, 384, 10, args.seed + 13)),
        ("review_contact_sheet.png", "master + variants contact sheet @512",
         contact_sheet(tiles, names, 512)),
        ("review_seam_1to1.png", "four-tile junction 1:1 crop", seam_img),
        ("review_junction_4x.png", "four-tile junction 32px @4x nearest", junction_4x),
    ]
    for fn, what, arr in previews:
        save_rgb(arr, os.path.join(args.out_dir, fn))
        written.append(fn)

    # per-tile QA
    report_tiles = []
    for nm, tile in zip(names, tiles):
        fn = candidate_filename(nm)
        gfn = f"G_ground_stone_{nm}_game512.png"
        path = os.path.join(args.out_dir, fn)
        gpath = os.path.join(args.out_dir, gfn)
        report_tiles.append({
            "name": nm, "file": fn, "size": [int(tile.shape[1]), int(tile.shape[0])],
            "mode": "RGB", "sha256": sha256_file(path), "bytes": os.path.getsize(path),
            "edges": edge_metrics(tile), "color": color_stats(tile),
            "periodicity": periodicity(tile, [128, 256, 384, 512]),
            "autocell_3x3": autocell(tile, 3),
            "game512_file": gfn, "game512_sha256": sha256_file(gpath),
            "game512_bytes": os.path.getsize(gpath),
        })

    lr_matrix = pair_edge_matrix(tiles, "lr")
    tb_matrix = pair_edge_matrix(tiles, "tb")
    img_matrix = pair_image_matrix(tiles)
    lr_flat = [v for row in lr_matrix for v in row]
    tb_flat = [v for row in tb_matrix for v in row]
    offdiag = [img_matrix[i][j] for i in range(len(tiles)) for j in range(len(tiles)) if i != j]
    lums = [t["color"]["mean_luminance"] for t in report_tiles]
    corners = corner_contract(tiles)
    junction_arr = np.asarray(corners["four_tile_junction_2x2_rgb"], dtype=np.int16)
    source_corner_arr = np.asarray(meta["ring"]["corner_block_rgb"], dtype=np.int16)
    junction_delta = int(np.abs(junction_arr - source_corner_arr).max())
    corners["junction_vs_source_max_channel_delta"] = junction_delta
    corners["junction_matches_source_corner_block"] = junction_delta == 0
    corners["junction_matches_source_corner_block_within_luminance_shift"] = (
        junction_delta <= int(round(meta["luminance_shift_max"])))

    report = {
        "ticket": TICKET,
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "python": platform.python_version(),
        "numpy": np.__version__,
        "paid_api_calls": 0,
        "source": {
            "path": src_path, "sha256": src_sha, "width": int(src.shape[1]),
            "height": int(src.shape[0]), "mode": "RGB", "mutated": False,
            "ticket_sha256": EXPECTED_SOURCE_SHA,
            "ticket_sha256_matches": src_sha.lower() == EXPECTED_SOURCE_SHA.lower(),
        },
        "params": {
            "tile_size": T, "variants": len(variants), "game_size": args.game_size,
            "crops_xy": meta["crops_xy"], "flatten_sigma_px": meta["flatten_sigma_px"],
            "flatten_target_rgb": meta["flatten_target_rgb"],
            "luminance_target": meta["luminance_target"],
            "luminance_shift_max": meta["luminance_shift_max"],
            "ring": meta["ring"], "seed": args.seed,
            "method": "source 1024 crops + low-frequency flatten + shared 1px ring "
                      "with per-tile exponential inward feather; no 2T-canvas seam",
            "legacy_2T_path": "Quilter retained reference-only; not used for generation",
        },
        "crop_stats": {
            "lowfreq_std_sigma96": meta["crop_lowfreq_std_sigma96"],
            "raw_mean_luminance": meta["crop_raw_mean_luminance"],
            "mean_luminance_pre_ring": meta["tile_mean_luminance_pre_ring"],
        },
        "build_seconds": build_seconds,
        "tiles": report_tiles,
        "edge_pair_matrix_lr": lr_matrix,
        "edge_pair_matrix_tb": tb_matrix,
        "edge_pair_matrix_labels": names,
        "edge_pair_matrix_identical": {
            "lr_all_equal": bool(max(lr_flat) - min(lr_flat) < 1e-6),
            "tb_all_equal": bool(max(tb_flat) - min(tb_flat) < 1e-6),
            "lr_min": min(lr_flat), "lr_max": max(lr_flat),
            "tb_min": min(tb_flat), "tb_max": max(tb_flat),
            "note": "shared 1px ring makes every ordered pair (including self) identical",
        },
        "pair_mean_abs_rgb_matrix": img_matrix,
        "corner_contract": corners,
        "junction_metric_4x4": junction_metric(seam_grid, T, T, 2),
        "variant_internal_difference": {
            f"{names[i]}_vs_{names[j]}_mean_abs_rgb": img_matrix[i][j]
            for i in range(len(tiles)) for j in range(i + 1, len(tiles))
        },
        "dedupe": {
            "min_offdiag_mean_abs_rgb": min(offdiag),
            "max_offdiag_mean_abs_rgb": max(offdiag),
            "pairs_below_2_rgb": sum(1 for v in offdiag if v < 2.0),
            "note": "6 variants are different 1024 crops; overlaps at 512 offsets share stones",
        },
        "luminance_consistency": {
            "min": min(lums), "max": max(lums),
            "spread": round(max(lums) - min(lums), 3),
        },
        "previews": [
            {"file": fn, "what": what,
             "size": [int(arr.shape[1]), int(arr.shape[0])],
             "sha256": sha256_file(os.path.join(args.out_dir, fn)),
             "bytes": os.path.getsize(os.path.join(args.out_dir, fn))}
            for fn, what, arr in previews
        ],
        "gate": {
            "status": args.verdict,
            "assets_state": all_state,
            "verdict_reason": args.gap,
            "human_review_required": True,
            "next_paid_image_allowed": False,
            "production_wiring": False,
            "game_runtime_2d_tilt060": "NOT_RUN_SEPARATE_GATE",
            "no_paid_api": True,
            "no_git_write": True,
            "no_audio": True,
        },
        "written_files": written,
        "manifest": {
            "file": "candidates_manifest.json",
            "written_last": True,
            "excludes_self": True,
            "qa_report_written_before_manifest": True,
        },
    }

    # QA_NOTES.md（先寫，讓 manifest 能收它的 SHA）
    cand_lines = "\n".join(
        f"- `{t['file']}` — {t['size'][0]}x{t['size'][1]} RGB, {t['bytes']} bytes, "
        f"SHA256 `{t['sha256']}`" for t in report_tiles)
    prev_lines = "\n".join(
        f"- `{p['file']}` — {p['size'][0]}x{p['size'][1]}, SHA256 `{p['sha256']}`"
        for p in report["previews"])
    lr0 = lr_matrix[0][0]
    tb0 = tb_matrix[0][0]
    im_master = report_tiles[0]["edges"]
    notes = f"""# S2 石板 Method B — handoff-p5-r1 QA 註記

- 狀態：**{args.verdict}**；`{all_state}`
- 票號：`{TICKET}`；本輪 0 付費 API，未執行 `--execute`，未設 `NANOBANANA_APPROVED`
- 來源：`{src_path}`，{src.shape[1]}x{src.shape[0]} RGB，SHA256 `{src_sha}`
- 來源 ticket SHA 核對：**{'PASS' if report['source']['ticket_sha256_matches'] else 'FAIL'}**
- 工具：`tools/stage2_stone_methodb.py`；輸出：`{args.out_dir}`
- 所有圖僅供人審／診斷，**不是 ART_PASS，不接 production／game runtime**

## 1. 方法

1. 由 v3 取 {len(selected)} 個 1024² 裁切：master `{selected[0]}` + variants `{selected[1:]}`。
2. 每張減去 sigma={args.flatten_sigma:g} 的 Gaussian 低頻場，再加共同 target RGB
   `{[round(float(v), 2) for v in meta['flatten_target_rgb']]}`；把原稿大面積打光差與色偏壓平，保留局部墨線與石紋。
3. 最外 **1px** 使用同一組 master 中心 `{meta['ring']['center_xy']}` 條帶：
   右緣→左緣、下緣→上緣等於來源相鄰像素；向內 {args.ring_feather}px 以 ring 顏色指數衰減到各 tile 自身邊緣（不貼外來條帶）。
   所有 ordered pair（含 self）的邊界像素因此完全相同，這是任意混鋪的契約。
4. 每張最後做全域亮度對齊到中位數（上限 ±2），降低跨 tile 亮暗差。

## 2. 量測摘要

| 項目 | 值 |
|---|---|
| master self LR seam | {lr0:.4f} |
| master self TB seam | {tb0:.4f} |
| master internal adjacent cols / rows | {im_master['internal_adjacent_cols_mean_abs_rgb']:.4f} / {im_master['internal_adjacent_rows_mean_abs_rgb']:.4f} |
| LR ordered-pair 全等 | {report['edge_pair_matrix_identical']['lr_all_equal']} |
| TB ordered-pair 全等 | {report['edge_pair_matrix_identical']['tb_all_equal']} |
| 亮度 min / max / spread | {report['luminance_consistency']['min']:.2f} / {report['luminance_consistency']['max']:.2f} / {report['luminance_consistency']['spread']:.2f} |
| 去背外變體最小 / 最大 mean abs RGB | {report['dedupe']['min_offdiag_mean_abs_rgb']:.2f} / {report['dedupe']['max_offdiag_mean_abs_rgb']:.2f} |
| 四拼 4x4 最大水平 / 垂直相鄰差 | {report['junction_metric_4x4']['max_horizontal_adjacent']:.2f} / {report['junction_metric_4x4']['max_vertical_adjacent']:.2f} |
| 來源 crop 低頻 std（sigma96） | {meta['crop_lowfreq_std_sigma96']} |

完整 7×7 ordered LR/TB 邊差、image diff、corner contract、periodicity、autocell 與每個 game512
的 SHA 都在 `qa_report.json`。

## 3. 為何是 ART_FAIL／已知限制

- 1px 共用邊帶在數學上無縫，且 6×6 仍看得到細格線；這是共用邊帶的可見代價。
- 來源為單張高對比斜向石板＋強打光梯度；不同裁切的中頻亮暗分布不同，6×6 仍出現大塊明暗，
  不是只靠平均亮度／色偏就能消除。
- 4 個角落只共享最外 1px；2×2 junction 是來源中心 2×2 經各 tile 亮度位移（每通道 ±1）後的結果，
  但角落內側 3px 仍是各 tile 自己的羽化，不是 2D 全連續。`review_junction_4x.png` 可 4× 檢視。
- 因此本輪**不宣稱美術 PASS**；6 張變體只作診斷，不因檔名 candidate 而升級。

## 4. 單一缺口（最值得人工處理）

{args.gap}

## 5. 候選（diagnostic）

{cand_lines}

## 6. 預覽

{prev_lines}

## 7. 未動／未執行

- 未 stage／commit／push／deploy／reset／clean／checkout；未 `git add -A`／`git add .`
- 未讀／改 `assets/audio/**`、`art/audio/**`、`js/audio.js`、TTS／BGM／KEY／env
- 未改 `js/*`、`assets/*`、原 stone_v2/v3、production 或既有 A/B 八關候選
- 未呼叫任何 Nano Banana／Gemini／外部付費 API；未試探配額
- 遊戲 2D／tilt=.60 是後續獨立 Gate，本票未跑
"""
    notes_path = os.path.join(args.out_dir, "QA_NOTES.md")
    with open(notes_path, "w", encoding="utf-8") as fh:
        fh.write(notes)
    written.append("QA_NOTES.md")

    # qa_report.json（在 manifest 之前）
    report["elapsed_seconds"] = round(time.time() - t_start, 1)
    report_path = os.path.join(args.out_dir, "qa_report.json")
    with open(report_path, "w", encoding="utf-8") as fh:
        json.dump(report, fh, ensure_ascii=False, indent=2)
    written.append("qa_report.json")

    # manifest 最後；排除自己，且不收 0 byte／重複項
    manifest_path = os.path.join(args.out_dir, "candidates_manifest.json")
    unique = sorted(set(written))
    file_entries = []
    for fn in unique:
        path = os.path.join(args.out_dir, fn)
        size = os.path.getsize(path)
        assert size > 0, f"zero-byte output: {fn}"
        file_entries.append({"file": fn, "bytes": size, "sha256": sha256_file(path)})
    manifest = {
        "ticket": TICKET,
        "generated_utc": datetime.now(timezone.utc).isoformat(),
        "candidates_manifest": "candidates_manifest.json",
        "written_last": True,
        "excludes_self": True,
        "count": len(file_entries),
        "files": file_entries,
    }
    with open(manifest_path, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, ensure_ascii=False, indent=2)

    print(f"[{TICKET}] verdict={args.verdict} files={len(file_entries)} "
          f"elapsed={report['elapsed_seconds']}s -> {args.out_dir}")
    print(f"[{TICKET}] manifest={manifest_path} (last, excludes self)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
