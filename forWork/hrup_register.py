#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""V139: регистрация Хрупа (квестовый персонаж-берсерк, арт из 4 сырых AI-листов
в forWork/sprites/src_hrup/ — teal-градиент). Конвейер (по образцу ent_register):
  A.png — 1696x2528, атака 4x4: r0 фронт (замах -> замах глубже -> слэм с пылью ->
          стойка с топором у плеча), r1 влево / r2 вправо (удар с искрой, родные
          направления), r3 спина (занос -> замах -> удар с пылью -> стойка);
  B.png — 848x1264 (полрезинки), ходьба 4x4: r0 фронт, r1 влево, r2 вправо,
          r3 спина — направления родные, без зеркал;
  C.png — 1696x2528, смерть-падение, НЕравномерная сетка (кадры шире клетки):
          r0 — 3 кадра (стойка с обломком щита / шатнулся / падение на спину),
          r1 — 2 кадра (падение на попу / тело вверх ногами с улетевшим топором),
          r2 — 2 кадра (лежит на боку / лежит на спине), r3 — 3 стойки+лежит
          (не используются);
  D.png — 1696x2528: r0 стойки (фронт/лево x2/спина), r1 вздрагивание-урон
          (фронт-крик / наклон x2 / спина), r2 стойки+лежание, r3 распад
          (не используется); wait = пара фронт-стоек (топор у ноги/у бедра),
          damage = крик+наклон.
  1) фон снимается подгонкой плоскости по рамке клетки (робастно, 2 прохода,
     выбросы > 25); сетки у листов разные — ячейки задаются списками долей;
  2) чистка маски: компоненты < 150 px и тонкие чёрточки-разделители выбрасываются;
  3) нормализация: премультиплицированный BOX-даунскейл + NEAREST x2, якорь
     центр-X / ступни y=62; рост стоя 48 px; КЛАМП ширины 62 (широкий кадр
     падения и стойки с топором упираются в края клетки);
  4) сборка листа 5x11 (64x64): wait/walk x4/attack x4/death/damage — раскладка
     строк как у всех врагов;
  5) полосы (окно = объединение альфа-bbox 4 кадров строки) в
     forWork/legacy_strips/enemy/hrup/..., манифест hrup_64.json;
  6) оверлей атаки НЕ строится: атака 28 в data.js использует готовые спрайты
     images/attacks/axe/{back,front,left,right}.png (принцип mace);
  7) прогон штатного make_sheets_map.py (верификация + sheetsMap.js + копия листа
     в билд + resources.json).
Идемпотентно: повторный запуск перезаписывает те же файлы.
"""
import json, os, subprocess, sys
from PIL import Image, ImageChops
import numpy as np
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPR = os.path.join(ROOT, 'forWork', 'sprites')
SRC = os.path.join(SPR, 'src_hrup')
LEG = os.path.join(ROOT, 'forWork', 'legacy_strips', 'enemy', 'hrup')
GEN = os.path.join(ROOT, 'forWork', 'make_sheets_map.py')

CELL, COLS, ROWS = 64, 5, 11
STAND_H = 48.0               # рост стоя в клетке (у культиста/слаймэна/энта 48)
FEET_Y = 62                  # базовая линия ступней
MAX_W = 62                   # клэмп ширины контента в клетке

# сетки источников: по строкам — список (x0, x1) в долях ширины листа;
# строки делятся на 4 равными долями высоты
def grid_x(spec):
    """по строке — границы кадров списком долей ширины листа"""
    return [[(xs[i], xs[i + 1]) for i in range(len(xs) - 1)] for xs in spec]
GRIDS = {
    'A': grid_x([[0, .25, .5, .75, 1]] * 4),
    'B': grid_x([[0, .25, .5, .75, 1]] * 4),
    'C': grid_x([[0, .2624, .5222, 1], [0, .5012, 1], [0, .5012, 1], [0, .25, .5, 1]]),
    'D': grid_x([[0, .25, .5, .75, 1]] * 4),
}

# (лист, строка, кадр) на каждый кадр анимации; строки листа — как у всех врагов
PLAN = {
    # wait: пара фронт-стоек — топор у бедра / у ноги (лёгкое покачивание)
    'wait':         [('D', 0, 0), ('D', 2, 0), ('D', 0, 0), ('D', 2, 0)],
    'walk_front':   [('B', 0, 0), ('B', 0, 1), ('B', 0, 2), ('B', 0, 3)],
    'walk_back':    [('B', 3, 0), ('B', 3, 1), ('B', 3, 2), ('B', 3, 3)],
    'walk_left':    [('B', 1, 0), ('B', 1, 1), ('B', 1, 2), ('B', 1, 3)],
    'walk_right':   [('B', 2, 0), ('B', 2, 1), ('B', 2, 2), ('B', 2, 3)],
    # фронт: замах -> замах глубже -> слэм с пылью -> стойка с топором у плеча
    'attack_front': [('A', 0, 0), ('A', 0, 1), ('A', 0, 2), ('A', 0, 3)],
    # спина: занос -> замах -> удар с пылью -> стойка
    'attack_back':  [('A', 3, 0), ('A', 3, 1), ('A', 3, 2), ('A', 3, 3)],
    # бока: занос -> взмах -> удар с искрой -> стойка (родные направления)
    'attack_left':  [('A', 1, 0), ('A', 1, 1), ('A', 1, 2), ('A', 1, 3)],
    'attack_right': [('A', 2, 0), ('A', 2, 1), ('A', 2, 2), ('A', 2, 3)],
    # смерть: стойка -> шатнулся -> падение на спину -> лежит на спине
    'death':        [('C', 0, 0), ('C', 0, 1), ('C', 0, 2), ('C', 2, 1)],
    # урон: крик + шатнулся (вздрагивание, нейтрально к направлению)
    'damage':       [('D', 1, 0), ('D', 1, 1), ('D', 1, 0), ('D', 1, 1)],
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
REF_FRAMES = {'A': (0, 3), 'B': (0, 0), 'C': (0, 0), 'D': (0, 0)}
# кадры с дочисткой осколков искры (стойки/взмахи рядом с ударными кадрами)
# и спиновые кадры с нарисованным «полом» под ступнями
SPARK_CELLS = {('A', 1, 1), ('A', 1, 3), ('A', 2, 3)}
FLOOR_CELLS = {('A', 3, 0), ('A', 3, 1), ('A', 3, 2), ('A', 3, 3),
               ('B', 3, 0), ('B', 3, 1), ('B', 3, 2), ('B', 3, 3)}

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
    for r, row in enumerate(GRIDS[tag]):
        y0, y1 = int(r * H / 4), int((r + 1) * H / 4)
        for c, (fx0, fx1) in enumerate(row):
            x0, x1 = int(fx0 * W), int(fx1 * W)
            cell = a[y0:y1, x0:x1]
            h, w = cell.shape[:2]
            ring = np.zeros((h, w), bool)
            m = max(4, min(h, w) // 40)
            ring[:m, :] = ring[-m:, :] = True
            ring[:, :m] = ring[:, -m:] = True
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

def cell(tag, r, i):
    """кадр i строки r листа tag с учётом неравномерной сетки C"""
    key = (tag, r, i)
    if key not in _cells:
        im = keyed(tag)
        W, H = im.size
        x0 = round(GRIDS[tag][r][i][0] * W)
        x1 = round(GRIDS[tag][r][i][1] * W)
        _cells[key] = im.crop((x0, round(r * H / 4), x1, round((r + 1) * H / 4)))
    return _cells[key]

def clean(fr, min_area=150, spark=False, floor=False):
    """Чистка маски: teal-ореол, «пол» под ступнями спин, дымка, компоненты-мусор
    (пятна ключа, чёрточки-разделители строк источника) выбрасываются.
    spark — дочистка мелких бело-жёлтых осколков искры чужих кадров."""
    a = np.asarray(fr).copy()
    # teal-ореол: пиксели цвета фона листа любой прозрачности (виньетка вокруг
    # рогов не дожата плоскостью; тёмная виньетка даёт g-r ~ 25-40 — порог низкий).
    # У персонажа всё зелёно-синее отсутствует (кожа/мех/металл — все с r>=g), безопасно
    r_, g_, b_ = a[:, :, 0].astype(int), a[:, :, 1].astype(int), a[:, :, 2].astype(int)
    teal = g_ - r_ > 18
    a[:, :, 3][teal] = 0
    # нарисованный в источнике светлый «пол» под ступнями спиновых кадров
    # (узкое правило: почти белый, самый низ — бежевая пыль удара не задевается)
    if floor:
        h = a.shape[0]
        mn = a[:, :, :3].min(2)
        mx = a[:, :, :3].max(2)
        zone = np.zeros(a.shape[:2], bool)
        zone[int(h * 0.90):, :] = True
        a[:, :, 3][zone & (mn > 150) & (mx - mn < 22)] = 0
    # блёклая дымка-«тень» из источника (светлая, полупрозрачная — верх альфа-рампы
    # ключа 20..46) срезается: тёмные края и насыщенные дуги (alpha 255) не задеваются
    haze = (a[:, :, 3] > 0) & (a[:, :, :3].min(2) > 140) & (a[:, :, 3] < 52)
    if haze.any():
        a[:, :, 3][haze] = 0
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
            continue
        if spark and area < 2500:
            px = a[comp]
            mn = px[:, :3].min(1).astype(int)
            mx = px[:, :3].max(1).astype(int)
            whiteish = (mn > 170) & (mx - mn < 50)
            yellow = px[:, 0].astype(int) - px[:, 2].astype(int) > 90
            if (whiteish | yellow).mean() > 0.35:
                a[:, :, 3][comp] = 0
                dropped.append(f'spark {area}px {w}x{h}')
    if dropped:
        print(f'    clean: -[{"; ".join(dropped)}]')
    return Image.fromarray(a, 'RGBA')

def norm(fr, scale):
    """контент -> премультиплицированный BOX до логических, NEAREST x2 -> 64-клетка,
    якорь: центр-X / ступни y=62; ширина клампится до MAX_W."""
    b = fr.getchannel('A').getbbox()
    if not b:
        raise RuntimeError('пустой кадр')
    content = fr.crop(b)
    sc = scale
    if content.width * sc > MAX_W:
        sc = MAX_W / content.width
    lw = max(1, round(content.width * sc / 2))
    lh = max(1, round(content.height * sc / 2))
    r, g, bl, a = content.split()
    prem = Image.merge('RGBA', (ImageChops.multiply(r, a), ImageChops.multiply(g, a),
                                ImageChops.multiply(bl, a), a))
    small = prem.resize((lw, lh), Image.BOX)
    # unpremultiply по логической сетке (крошечное изображение — питоний цикл дёшев)
    sp = small.load()
    for y in range(lh):
        for x in range(lw):
            r, g, bl, a = sp[x, y]
            if a < 30:
                # малая альфа: unpremultiply раздувает шум округления premultiply
                # в яркие точки — такой пиксель прозрачен
                sp[x, y] = (0, 0, 0, 0)
            elif a:
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
        for c, (tag, r, f) in enumerate(plan):
            fr = clean(cell(tag, r, f), spark=(tag, r, f) in SPARK_CELLS,
                       floor=(tag, r, f) in FLOOR_CELLS)
            sheet.paste(norm(fr, scale[tag]), (c * CELL, row * CELL))
    sheet.save(os.path.join(SPR, 'hrup_64.png'))

    man = {'size': CELL, 'columns': COLS, 'fps': 8,
           'animations': [{'name': n, 'row': r, 'frames': 4} for n, r, _, _ in ANIMS]}
    with open(os.path.join(SPR, 'hrup_64.json'), 'w', encoding='utf-8') as f:
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
        print(f'  hrup {name}: row {row} window dx={x0} dy={y0} {fw}x{fh}')

    r = subprocess.run([sys.executable, GEN], cwd=ROOT)
    sys.exit(r.returncode)

if __name__ == '__main__':
    main()
