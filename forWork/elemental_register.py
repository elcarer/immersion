#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""V111: регистрация Огнементя (квестовый NPC, арт из 5 сырых AI-листов 4x4 на
teal-фоне — forWork/sprites/src_elemental/). Конвейер cultist_register.py:
  1) клетки режутся по точной сетке 4x4, teal-фон снимается альфа-ключом;
  2) нормализация: премультиплицированный BOX-даунскейл до логических пикселей
     (~48px рост стоя) + NEAREST x2 — чанковый пиксель-арт, кадр по центру-X и
     ступням (y=62);
  3) сборка листа 5x11 (64x64): стандартные 11 строк. Ходка — лист B целиком
     (r0 фронт 3 фазы + возврат, r1 влево, r2 вправо, r3 спина); wait — E r0
     (фронт-idle с угольками); атаки — A r0 (фронт-каст с огненными шарами),
     D r3 (спина: руки-вверх -> выброс), A r2 (влево, слэш-арка релизом),
     D r2 (вправо, взмах огненным мечом); смерть — взрыв (D r3 c2) -> лужа
     пламени (C r3); урон — вспышка-шаровая (A r0 c3) + флинч (E r0 c1) x2;
  4) полосы -> forWork/legacy_strips/enemy/elemental/..., манифест elemental_64.json;
  5) прогон штатного make_sheets_map.py.
Идемпотентно: повторный запуск перезаписывает те же файлы.
"""
import json, os, subprocess, sys
from PIL import Image, ImageChops, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPR = os.path.join(ROOT, 'forWork', 'sprites')
SRC = os.path.join(SPR, 'src_elemental')
LEG = os.path.join(ROOT, 'forWork', 'legacy_strips', 'enemy', 'elemental')
GEN = os.path.join(ROOT, 'forWork', 'make_sheets_map.py')

CELL, COLS, ROWS = 64, 5, 11
BG = (43, 122, 116)          # teal-фон сырых листов
STAND_H = 48.0               # рост стоя в клетке (у культиста 48), logical = 24
FEET_Y = 62                  # базовая линия ступней, как у культиста

# (источник, строка, кадр, зеркало); ходка целиком из B (чистый walk-лист)
PLAN = {
    'wait':         [('E', 0, 0, 0), ('E', 0, 1, 0), ('E', 0, 3, 0), ('E', 0, 1, 0)],
    'walk_front':   [('B', 0, 0, 0), ('B', 0, 1, 0), ('B', 0, 2, 0), ('B', 0, 1, 0)],
    'walk_back':    [('B', 3, 0, 0), ('B', 3, 1, 0), ('B', 3, 2, 0), ('B', 3, 3, 0)],
    'walk_left':    [('B', 1, 0, 0), ('B', 1, 1, 0), ('B', 1, 2, 0), ('B', 1, 3, 0)],
    'walk_right':   [('B', 2, 0, 0), ('B', 2, 1, 0), ('B', 2, 2, 0), ('B', 2, 3, 0)],
    # фронт: кулаки-шары (замах) -> выброс пламени -> гашение -> idle
    'attack_front': [('A', 0, 2, 0), ('A', 0, 3, 0), ('A', 0, 1, 0), ('E', 0, 0, 0)],
    # спина: руки вверх (замах) -> сбор -> выброс в стороны -> idle-спина (B r0 c3)
    'attack_back':  [('D', 3, 0, 0), ('D', 3, 1, 0), ('D', 3, 3, 0), ('B', 0, 3, 0)],
    # влево (A r2): замах -> выпад огненным мечом -> взмах вверх -> СЛЭШ-АРКА (релиз)
    'attack_left':  [('A', 2, 0, 0), ('A', 2, 1, 0), ('A', 2, 3, 0), ('A', 2, 2, 0)],
    # вправо (D r2): огненный меч вверх -> диагональ -> проводка вниз -> возврат
    'attack_right': [('D', 2, 1, 0), ('D', 2, 2, 0), ('D', 2, 3, 0), ('D', 2, 0, 0)],
    # смерть: взрыв (D r3 c2) -> лужа пламени большая -> средняя -> искры
    'death':        [('D', 3, 2, 0), ('C', 3, 0, 0), ('C', 3, 1, 0), ('C', 3, 3, 0)],
    # урон: вспышка-шар у корпуса + флинч, x2 (стандарт: вспышка + отшатнуться)
    'damage':       [('A', 0, 3, 0), ('E', 0, 1, 0), ('A', 0, 3, 0), ('E', 0, 1, 0)],
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
REF_FRAMES = {'A': [(0, 1)], 'B': [(0, 1)], 'C': [(0, 0)], 'D': [(0, 0)], 'E': [(0, 0)]}
EXT = {t: '.png' for t in 'ABCDE'}

_keycache = {}
_cells = {}

def cut(im, r, c):
    w, h = im.size
    return im.crop((round(c * w / 4), round(r * h / 4), round((c + 1) * w / 4), round((r + 1) * h / 4)))

def keyed(tag):
    """RGBA клетки с teal-фон снятым (мягкий альфа-ключ по максимуму дельты каналов)."""
    if tag in _keycache:
        return _keycache[tag]
    im = Image.open(os.path.join(SRC, tag + EXT[tag])).convert('RGB')
    bg = Image.new('RGB', im.size, BG)
    m = ImageChops.difference(im, bg)
    r, g, b = m.split()
    m = ImageChops.lighter(ImageChops.lighter(r, g), b)
    a = m.point(lambda v: 0 if v <= 20 else (255 if v > 46 else (v - 20) * 255 // 26))
    #второй ключ: светло-серый «пол» из исходников (B r3/D r3/C r3) садится в нижней
    #зоне клеток; след — бирюзово-белые смеси фона (b>=r), тело/искры всегда тёплые
    #(r заметно больше b) — в нижних 12% вычищаем всё холодное и нейтральное
    px = im.load()
    pa = a.load()
    ch4 = im.height / 4
    for row in range(4):
        y0 = round(row * ch4 + ch4 * 0.88)
        for y in range(y0, min(im.height, round((row + 1) * ch4))):
            for x in range(im.width):
                pr, pg, pb = px[x, y]
                if pb + 12 >= pr and min(pr, pg, pb) > 60:
                    pa[x, y] = 0
    out = im.convert('RGBA')
    out.putalpha(a)
    _keycache[tag] = out
    return out

def cell(tag, r, c):
    key = (tag, r, c)
    if key not in _cells:
        _cells[key] = cut(keyed(tag), r, c)
    return _cells[key]

def norm(fr, scale):
    """контент -> премультиплицированный BOX до логических, NEAREST x2 -> 64-клетка,
    якорь: центр-X / ступни y=62. Широкие кадры (слэш-арка) вжимаются в клетку."""
    b = fr.getchannel('A').getbbox()
    if not b:
        raise RuntimeError('пустой кадр')
    content = fr.crop(b)
    lw = max(1, round(content.width * scale / 2))
    lh = max(1, round(content.height * scale / 2))
    if lw > CELL:                                   # арка шире клетки — вжимаем
        lh = max(1, round(lh * CELL / lw))
        lw = CELL
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
    for tag, refs in REF_FRAMES.items():
        hs = [cell(tag, r, c).getchannel('A').getbbox()[3] - cell(tag, r, c).getchannel('A').getbbox()[1]
              for r, c in refs]
        scale[tag] = STAND_H / (sum(hs) / len(hs))
        print(f'  scale[{tag}] = {scale[tag]:.4f} (stand {sum(hs) / len(hs):.0f}px)')

    sheet = Image.new('RGBA', (CELL * COLS, CELL * ROWS), (0, 0, 0, 0))
    for name, plan in PLAN.items():
        row = ROW_OF[name]
        for c, (tag, r, f, mir) in enumerate(plan):
            fr = cell(tag, r, f)
            if mir:
                fr = ImageOps.mirror(fr)
            sheet.paste(norm(fr, scale[tag]), (c * CELL, row * CELL))
    os.makedirs(SPR, exist_ok=True)
    sheet.save(os.path.join(SPR, 'elemental_64.png'))

    man = {'size': CELL, 'columns': COLS, 'fps': 8,
           'animations': [{'name': n, 'row': r, 'frames': 4} for n, r, _, _ in ANIMS]}
    with open(os.path.join(SPR, 'elemental_64.json'), 'w', encoding='utf-8') as f:
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
        print(f'  elemental {name}: row {row} window dx={x0} dy={y0} {fw}x{fh}')

    r = subprocess.run([sys.executable, GEN], cwd=ROOT)
    sys.exit(r.returncode)

if __name__ == '__main__':
    main()
