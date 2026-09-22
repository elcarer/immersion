#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""V132: регистрация Слаймэна (квестовый персонаж, арт из 5 сырых AI-листов 4x4 на
teal-градиенте — forWork/sprites/src_slime/). Конвейер (по образцу cultist_register):
  1) клетки режутся по точной сетке 4x4; фон снимается ПОДГОНКОЙ плоскости по рамке
     клетки (фон-градиент, углы листа расходятся до ~90 единиц канала — глобальный
     альфа-ключ оставлял шум), робастно: 2 прохода с отбраковкой выбросов >25;
  2) чистка маски: связные компоненты < 150 px и тонкие чёрточки-разделители строк
     источника (h<=5, w>=12) выбрасываются; в кадрах частиц удара порог 25;
  3) нормализация в стиль существующих листов: премультиплицированный BOX-даунскейл
     до логических пикселей + NEAREST x2; кадр якорится по центру-X и по ступням
     (y=62); рост стоя 48 px — как у культиста/шамана;
  4) сборка листа 5x11 (64x64): стандартные 11 строк — wait/walk x4/attack x4/death/
     damage. Источники: B — ходьба 4 направления, C r0 — idle, D r1 — удар влево
     (вправо — зеркало), D r0 — фронт-замах, D r3 — сплющивания (спина/урон/смерть),
     C r3 c2/c3 — сплэт, A r0 c3 — лужа, E c3 — частицы удара;
  5) полосы (окно = объединение альфа-bbox 4 кадров строки) в
     forWork/legacy_strips/enemy/slime/..., манифест slime_64.json;
  6) оверлей атаки: 4 кадра частиц из E c3 -> images/attacks/slime/all.png (128x32),
     в data.js добавляется атака 26 (не делает register — см. правку data.js);
  7) прогон штатного make_sheets_map.py (верификация пиксель-в-пиксель + sheetsMap.js
     + копия листа в билд + resources.json).
Идемпотентно: повторный запуск перезаписывает те же файлы.
"""
import json, os, subprocess, sys
from PIL import Image, ImageChops, ImageOps
import numpy as np
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPR = os.path.join(ROOT, 'forWork', 'sprites')
SRC = os.path.join(SPR, 'src_slime')
LEG = os.path.join(ROOT, 'forWork', 'legacy_strips', 'enemy', 'slime')
GEN = os.path.join(ROOT, 'forWork', 'make_sheets_map.py')
ATT = os.path.join(ROOT, 'example', 'build', 'images', 'attacks', 'slime')

CELL, COLS, ROWS = 64, 5, 11
STAND_H = 48.0               # рост стоя в клетке (у культиста 48)
FEET_Y = 62                  # базовая линия ступней, как у культиста

# (источник, строка, кадр, зеркало) на каждую анимацию; раскладка строк листа —
# как у всех врагов (см. cultist_64.json)
PLAN = {
    'wait':         [('C', 0, 0, 0), ('C', 0, 1, 0), ('C', 0, 2, 0), ('C', 0, 3, 0)],
    'walk_front':   [('B', 0, 0, 0), ('B', 0, 1, 0), ('B', 0, 2, 0), ('B', 0, 3, 0)],
    'walk_back':    [('B', 3, 0, 0), ('B', 3, 1, 0), ('B', 3, 2, 0), ('B', 3, 3, 0)],
    'walk_left':    [('B', 1, 0, 0), ('B', 1, 1, 0), ('B', 1, 2, 0), ('B', 1, 3, 0)],
    'walk_right':   [('B', 2, 0, 0), ('B', 2, 1, 0), ('B', 2, 2, 0), ('B', 2, 3, 0)],
    # фронт: стойка -> замах (кулаки к груди, держим 2 кадра) -> сплэт вперёд
    # (частицы = точка выпуска эффекта, кадр 3 = step:3)
    'attack_front': [('D', 0, 0, 0), ('D', 0, 1, 0), ('D', 0, 1, 0), ('C', 3, 2, 0)],
    # спина: стойка -> сжатие -> сплющивание с раскидом (держим) — хлопок корпусом
    'attack_back':  [('D', 3, 0, 0), ('D', 3, 1, 0), ('D', 3, 2, 0), ('D', 3, 2, 0)],
    # бока: полная последовательность удара D r1 (стойка->замах->выброс->проводка);
    # right — зеркало покадрово
    'attack_left':  [('D', 1, 0, 0), ('D', 1, 1, 0), ('D', 1, 2, 0), ('D', 1, 3, 0)],
    'attack_right': [('D', 1, 0, 1), ('D', 1, 1, 1), ('D', 1, 2, 1), ('D', 1, 3, 1)],
    # смерть: сжатие -> сплэт с брызгами -> кучка -> плоская лужа
    'death':        [('D', 3, 1, 0), ('C', 3, 2, 0), ('C', 3, 3, 0), ('A', 0, 3, 0)],
    # урон: сплющивание-флинч, x2 (стандарт: вспышка + отшатнуться), поза нейтральна
    # к направлению
    'damage':       [('D', 3, 2, 0), ('D', 3, 1, 0), ('D', 3, 2, 0), ('D', 3, 1, 0)],
}
ROW_OF = {'wait': 0, 'walk_front': 1, 'walk_back': 2, 'walk_left': 3, 'walk_right': 4,
          'attack_front': 5, 'attack_back': 6, 'attack_right': 7, 'attack_left': 8,
          'death': 9, 'damage': 10}
ANIMS = [  # (имя, строка, подкаталог полосы, имя файла)
    ('wait', 0, 'others', 'wait.png'), ('death', 9, 'others', 'death.png'), ('damage', 10, 'others', 'damage.png'),
    ('walk_front', 1, 'move', 'front.png'), ('walk_back', 2, 'move', 'back.png'),
    ('walk_left', 3, 'move', 'left.png'), ('walk_right', 4, 'move', 'right.png'),
    ('attack_front', 5, 'attack', 'front.png'), ('attack_back', 6, 'attack', 'back.png'),
    ('attack_right', 7, 'attack', 'right.png'), ('attack_left', 8, 'attack', 'left.png'),
]
# кадры-эталоны роста стоя для масштаба источника
REF_FRAMES = {'A': (0, 1), 'B': (0, 0), 'C': (0, 1), 'D': (0, 0), 'E': (0, 0)}
# оверлей атаки: 4 кадра частиц (порядок: малый -> пик -> пик -> разлёт)
ATTACK_FX = [('E', 2, 3), ('E', 0, 3), ('E', 1, 3), ('E', 3, 3)]

_keycache = {}
_cells = {}

def keyed(tag):
    """RGBA клетки исходного листа с фоном, снятым подгонкой плоскости по рамке
    каждой клетки (робастно: 2 прохода, выбросы канала > 25 отбрасываются)."""
    if tag in _keycache:
        return _keycache[tag]
    im = Image.open(os.path.join(SRC, tag + '.png')).convert('RGB')
    W, H = im.size
    a = np.asarray(im).astype(np.float64)
    alpha = np.zeros((H, W))
    cw, ch = W / 4.0, H / 4.0
    for r in range(4):
        for c in range(4):
            x0, x1 = int(round(c * cw)), int(round((c + 1) * cw))
            y0, y1 = int(round(r * ch)), int(round((r + 1) * ch))
            cell = a[y0:y1, x0:x1]
            h, w = cell.shape[:2]
            ring = np.zeros((h, w), bool)
            ring[:8, :] = ring[-8:, :] = True
            ring[:, :8] = ring[:, -8:] = True
            ys, xs = np.mgrid[0:h, 0:w]
            pts = np.stack([np.ones(h * w), xs.ravel(), ys.ravel()], 1)
            cols = cell.reshape(-1, 3)
            ringf = ring.ravel()
            pr, cr = pts[ringf], cols[ringf]
            keep = np.ones(len(pr), bool)
            for _ in range(2):
                coef, *_ = np.linalg.lstsq(pr[keep], cr[keep], rcond=None)
                keep = np.abs(cr - pr @ coef).max(1) < 25
            d = np.abs(cols - pts @ coef).max(1)
            al = np.zeros(len(d))
            al[d > 46] = 255
            mid = (d > 20) & (d <= 46)
            al[mid] = (d[mid] - 20) * 255 / 26
            alpha[y0:y1, x0:x1] = al.reshape(h, w)
    out = Image.fromarray(np.dstack([a, alpha]).astype(np.uint8), 'RGBA')
    _keycache[tag] = out
    return out

def cut(im, r, c):
    w, h = im.size
    return im.crop((round(c * w / 4), round(r * h / 4), round((c + 1) * w / 4), round((r + 1) * h / 4)))

def cell(tag, r, c):
    key = (tag, r, c)
    if key not in _cells:
        _cells[key] = cut(keyed(tag), r, c)
    return _cells[key]

def clean(fr, min_area=150):
    """Чистка маски: связные компоненты-мусор (пятна ключа, чёрточки-разделители
    строк источника) выбрасываются. Частицы удара — отдельные мелкие брызги —
    переживают только при min_area=25."""
    a = np.asarray(fr).copy()
    mask = a[:, :, 3] > 0
    lab, n = ndimage.label(mask, structure=np.ones((3, 3), bool))
    dropped = []
    for i in range(1, n + 1):
        comp = lab == i
        area = int(comp.sum())
        ys, xs = np.where(comp)
        h, w = ys.max() - ys.min() + 1, xs.max() - xs.min() + 1
        if area < min_area or (h <= 5 and w >= 12):
            a[:, :, 3][comp] = 0
            dropped.append(f'{area}px {w}x{h}')
    if dropped:
        print(f'    clean: -[{"; ".join(dropped)}]')
    return Image.fromarray(a, 'RGBA')

def norm(fr, scale):
    """контент -> премультиплицированный BOX до логических, NEAREST x2 -> 64-клетка,
    якорь: центр-X / ступни y=62."""
    b = fr.getchannel('A').getbbox()
    if not b:
        raise RuntimeError('пустой кадр')
    content = fr.crop(b)
    lw = max(1, round(content.width * scale / 2))
    lh = max(1, round(content.height * scale / 2))
    r, g, bl, a = content.split()
    prem = Image.merge('RGBA', (ImageChops.multiply(r, a), ImageChops.multiply(g, a),
                                ImageChops.multiply(bl, a), a))
    small = prem.resize((lw, lh), Image.BOX)
    # unpremultiply по логической сетке (крошечное изображение — питоний цикл дёшев)
    sp = small.load()
    for y in range(lh):
        for x in range(lw):
            r, g, bl, a = sp[x, y]
            if a:
                sp[x, y] = (min(255, (r * 255 + a // 2) // a),
                            min(255, (g * 255 + a // 2) // a),
                            min(255, (bl * 255 + a // 2) // a), a)
    out = small.resize((lw * 2, lh * 2), Image.NEAREST)
    cellim = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
    cellim.paste(out, (32 - out.width // 2, FEET_Y - out.height))
    return cellim

def main():
    # масштаб источника: эталонный рост стоя -> STAND_H
    scale = {}
    for tag, (r, c) in REF_FRAMES.items():
        bb = clean(cell(tag, r, c)).getchannel('A').getbbox()
        hs = bb[3] - bb[1]
        scale[tag] = STAND_H / hs
        print(f'  scale[{tag}] = {scale[tag]:.4f} (stand {hs}px)')

    sheet = Image.new('RGBA', (CELL * COLS, CELL * ROWS), (0, 0, 0, 0))
    for name, plan in PLAN.items():
        row = ROW_OF[name]
        for c, (tag, r, f, mir) in enumerate(plan):
            fr = clean(cell(tag, r, f), min_area=25 if (tag, r, c) in
                       [(t, rr, cc) for t, rr, cc in ATTACK_FX] else 150)
            if mir:
                fr = ImageOps.mirror(fr)
            sheet.paste(norm(fr, scale[tag]), (c * CELL, row * CELL))
    sheet.save(os.path.join(SPR, 'slime_64.png'))

    man = {'size': CELL, 'columns': COLS, 'fps': 8,
           'animations': [{'name': n, 'row': r, 'frames': 4} for n, r, _, _ in ANIMS]}
    with open(os.path.join(SPR, 'slime_64.json'), 'w', encoding='utf-8') as f:
        json.dump(man, f, indent=2)

    for name, row, sub, fname in ANIMS:
        x0 = y0 = 10 ** 9
        x1 = y1 = -1
        for c in range(4):
            b = sheet.crop((c * CELL, row * CELL, (c + 1) * CELL, (row + 1) * CELL)).getchannel('A').getbbox()
            if not b:
                continue
            x0, y0 = min(x0, b[0]), min(y0, b[1])
            x1, y1 = max(x1, b[2]), max(b[3], y1)
        assert x1 > x0 and y1 > y0, f'пустая строка {name}'
        fw, fh = x1 - x0, y1 - y0
        strip = Image.new('RGBA', (fw * 4, fh), (0, 0, 0, 0))
        for c in range(4):
            strip.paste(sheet.crop((c * CELL + x0, row * CELL + y0, c * CELL + x1, row * CELL + y1)), (c * fw, 0))
        d = os.path.join(LEG, sub)
        os.makedirs(d, exist_ok=True)
        strip.save(os.path.join(d, fname))
        print(f'  slime {name}: row {row} window dx={x0} dy={y0} {fw}x{fh}')

    # оверлей атаки: 4 кадра частиц в 32x32, якорь центр-X / низ y=30
    os.makedirs(ATT, exist_ok=True)
    fx = Image.new('RGBA', (128, 32), (0, 0, 0, 0))
    for c, (tag, r, f) in enumerate(ATTACK_FX):
        fr = clean(cell(tag, r, f), min_area=25)
        b = fr.getchannel('A').getbbox()
        content = fr.crop(b)
        sc = min(26.0 / content.width, 26.0 / content.height)
        lw = max(1, round(content.width * sc / 2))
        lh = max(1, round(content.height * sc / 2))
        small = content.resize((lw, lh), Image.BOX)
        out = small.resize((lw * 2, lh * 2), Image.NEAREST)
        fx.paste(out, (c * 32 + 16 - out.width // 2, 30 - out.height))
    fx.save(os.path.join(ATT, 'all.png'))
    print('  attack overlay -> images/attacks/slime/all.png')

    r = subprocess.run([sys.executable, GEN], cwd=ROOT)
    sys.exit(r.returncode)

if __name__ == '__main__':
    main()
