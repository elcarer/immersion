# -*- coding: utf-8 -*-
# comix_b32.py — конверсия комикс-панелей в схему B32 (как весь арт игры):
# k-means палитра 32 цвета, без дизеринга; альфа сохраняется (маска на случай
# прозрачных участков).
# Запуск: python forWork/comix_b32.py <вход.png> [<вход2.png> ...]
# Результат: <имя>_b32.png рядом с исходником.
import sys, os
import numpy as np
from PIL import Image

K = 32          # цветов в палитре (B32)
SAMPLE = 24000  # сэмпл пикселей для k-means
ITERS = 14      # итераций k-means

def kmeans(sample, k=K, iters=ITERS, seed=42):
    rng = np.random.RandomState(seed)
    centers = sample[rng.choice(len(sample), size=min(k, len(sample)), replace=False)].copy()
    for _ in range(iters):
        d = ((sample[:, None, :] - centers[None, :, :]) ** 2).sum(-1)
        lab = d.argmin(1)
        moved = False
        for kk in range(len(centers)):
            sel = sample[lab == kk]
            if len(sel):
                nc = sel.mean(0)
                if not np.array_equal(nc, centers[kk]):
                    centers[kk] = nc
                    moved = True
        if not moved:
            break
    return centers

def b32(src, dst):
    im = Image.open(src).convert("RGBA")
    a = np.array(im).astype(np.float32)
    rgb, alpha = a[..., :3], a[..., 3]

    opaque = alpha > 30
    pix = rgb[opaque]
    if len(pix) == 0:
        print(f"{src}: нет непрозрачных пикселей — пропущен")
        return

    rng = np.random.RandomState(42)
    sample = pix[rng.choice(len(pix), size=min(SAMPLE, len(pix)), replace=False)]
    centers = kmeans(sample)

    # маппинг всех непрозрачных пикселей на ближайший центр (чанками)
    ys, xs = np.where(opaque)
    res = np.empty((len(ys), 3), dtype=np.float32)
    for i in range(0, len(ys), 200000):
        c = rgb[ys[i:i + 200000], xs[i:i + 200000]]
        d = ((c[:, None, :] - centers[None, :, :]) ** 2).sum(-1)
        res[i:i + 200000] = centers[d.argmin(1)]

    out = a.copy()
    out[ys, xs, :3] = res

    img = Image.fromarray(out.astype(np.uint8), "RGBA")
    # панели непрозрачны (альфа-порог выше) — квантование идёт в RGB
    # (PIL: MEDIANCUT для RGBA не работает)
    img = img.convert("RGB")
    # палитровый PNG ровно с 32 цветами (как арты игры)
    img = img.quantize(colors=K, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    img.save(dst)
    uniq = len(set(img.getdata()))
    print(f"{src} -> {dst}: {uniq} цветов, размер {img.size}")

if __name__ == "__main__":
    for f in sys.argv[1:]:
        root, ext = os.path.splitext(f)
        b32(f, root + "_b32" + ext)
