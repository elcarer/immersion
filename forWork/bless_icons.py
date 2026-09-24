# V145: нарезка иконок благословений (bless) из спрайтшита юзера.
# 1.png (1290x720, RGBA с непрозрачным чёрным фоном): скруглённые плашки, ряды по Y
# делятся чётко (зазор ~12px), по X зазоры перекрываются свечением — поэтому диапазоны
# по X ищутся ВНУТРИ каждой строки отдельно; сетка нерегулярна (ряд 0 — 9 иконок,
# ряды 1-4 — по 10). Режем 128x128 из центра клетки, выход — bless1..9.png.
import os
from PIL import Image

SRC = r"E:\Program Files\VSCodeProjectLearn\рогалик\арты\иконки\1.png"
DST = r"D:\ZCode\project2\example\build\images\effects\bless"

im = Image.open(SRC).convert("RGBA")
W, H = im.size
g = im.convert("L")
px = g.load()

def ranges(mask):
    out, start = [], None
    for i, v in enumerate(mask):
        if v and start is None:
            start = i
        elif not v and start is not None:
            out.append((start, i - 1)); start = None
    if start is not None:
        out.append((start, len(mask) - 1))
    return out

#строки: проекция яркости по Y
rows_mask = []
for y in range(H):
    rows_mask.append(sum(px[x, y] for x in range(0, W, 2)) / (W // 2) > 14)
rr = [r for r in ranges(rows_mask) if r[1] - r[0] > 40]
print("rows:", len(rr), rr)

#для каждой строки — диапазоны по X внутри её полосы
row_cols = []
for (y0, y1) in rr:
    mask = []
    for x in range(W):
        mask.append(sum(px[x, y] for y in range(y0, y1 + 1, 2)) / ((y1 - y0) // 2 + 1) > 14)
    cr = [r for r in ranges(mask) if r[1] - r[0] > 40]
    row_cols.append(cr)
    print("row", rr.index((y0, y1)), "cols:", len(cr), cr)

os.makedirs(DST, exist_ok=True)

#bless -> [строка, колонка в строке] (0-индексы, слева-направо).
#ВНИМАНИЕ: ряд 1 даёт 11 диапазонов — спрут (2) и корона (5) расколоты надвое, из-за
#чего индексы после 2-й колонки сдвинуты: три меча = col7 (779..896), красный кубок = col9
PICKS = {
    1: (0, 3),  # Стальная кожа — фиолетовый щит со звездой
    2: (3, 8),  # Зеркало — золотое око-линза
    3: (1, 7),  # Громила — три золотых меча
    4: (0, 6),  # Заучка — фиолетовый глаз с молниями
    5: (4, 0),  # Кровавый пакт — чёрная руна с красными лучами
    6: (3, 3),  # Второе дыхание — феникс
    7: (1, 9),  # Хлебосол — красный кубок с пиршеством
    8: (0, 8),  # Золотое эхо — золотой кубок с камнями
    9: (3, 6),  # Сын ветра — торнадо
}

def cut(rowi, coli, size=128):
    c, r = row_cols[rowi][coli], rr[rowi]
    cw, ch = c[1] - c[0] + 1, r[1] - r[0] + 1
    cx, cy = c[0] + cw // 2, r[0] + ch // 2
    half = size // 2
    return im.crop((cx - half, cy - half, cx - half + size, cy - half + size)), (cw, ch)

for bid, (rowi, coli) in sorted(PICKS.items()):
    img, dims = cut(rowi, coli)
    out = os.path.join(DST, "bless%d.png" % bid)
    img.save(out)
    print("bless%d" % bid, "<- row%d,col%d" % (rowi, coli), "cell", dims, "->", out)
print("done")
