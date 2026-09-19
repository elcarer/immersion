#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""V104: регистрация волка (images/sheets/wolf_64.png) в штатном конвейере карт
спрайтшитов. Лист волка уже лежит в билде, но манифеста/легаси-полос у него не было —
генератор (make_sheets_map.py) его не видел. Здесь:
  1) лист копируется в forWork/sprites/wolf_64.png + пишется манифест .json
     (5 колонок × 11 строк 64×64, раскладка строк как у всех: wait/walk×4/attack×4/death/damage);
  2) из листа извлекаются легаси-полосы (4 кадра строки, окно = объединение альфа-bbox
     кадров строки — гарантирует, что ни один пиксель кадра не обрезан) в
     forWork/legacy_strips/enemy/wolf/...;
  3) прогоняется штатный make_sheets_map.py — он сам верифицирует полосы пиксель-в-пиксель,
     пересобирает build/scripts/sheetsMap.js и images/resources.json.
Идемпотентно: повторный запуск просто перезаписывает те же файлы.
"""
import json, os, shutil, subprocess, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPR = os.path.join(ROOT, 'forWork', 'sprites')
LEG = os.path.join(ROOT, 'forWork', 'legacy_strips', 'enemy', 'wolf')
SRC = os.path.join(ROOT, 'example', 'build', 'images', 'sheets', 'wolf_64.png')
GEN = os.path.join(ROOT, 'forWork', 'make_sheets_map.py')

CELL = 64
FRAMES = 4
ANIMS = [  # (имя, строка, подкаталог полосы, имя файла)
    ('wait', 0, 'others', 'wait.png'), ('death', 9, 'others', 'death.png'), ('damage', 10, 'others', 'damage.png'),
    ('walk_front', 1, 'move', 'front.png'), ('walk_back', 2, 'move', 'back.png'),
    ('walk_left', 3, 'move', 'left.png'), ('walk_right', 4, 'move', 'right.png'),
    ('attack_front', 5, 'attack', 'front.png'), ('attack_back', 6, 'attack', 'back.png'),
    ('attack_right', 7, 'attack', 'right.png'), ('attack_left', 8, 'attack', 'left.png'),
]

def main():
    sheet = Image.open(SRC).convert('RGBA')
    assert sheet.width == CELL * 5 and sheet.height == CELL * 11, f'неожиданный размер листа {sheet.size}'

    os.makedirs(SPR, exist_ok=True)
    shutil.copy2(SRC, os.path.join(SPR, 'wolf_64.png'))
    man = {'size': CELL, 'columns': 5, 'fps': 8,
           'animations': [{'name': n, 'row': r, 'frames': FRAMES} for n, r, _, _ in ANIMS]}
    with open(os.path.join(SPR, 'wolf_64.json'), 'w', encoding='utf-8') as f:
        json.dump(man, f, indent=2)

    for name, row, sub, fname in ANIMS:
        # окно строки — объединение альфа-bbox всех 4 кадров (кадры одной строки гуляют
        # на 1-2px — окно обязано накрывать все, иначе пиксели строк анимации резались бы)
        x0 = y0 = 10 ** 9
        x1 = y1 = -1
        for c in range(FRAMES):
            fr = sheet.crop((c * CELL, row * CELL, (c + 1) * CELL, (row + 1) * CELL))
            b = fr.getchannel('A').getbbox()
            if not b:
                continue
            x0, y0 = min(x0, b[0]), min(y0, b[1])
            x1, y1 = max(x1, b[2]), max(y1, b[3])
        assert x1 > x0 and y1 > y0, f'пустая строка {name}'
        fw, fh = x1 - x0, y1 - y0
        strip = Image.new('RGBA', (fw * FRAMES, fh), (0, 0, 0, 0))
        for c in range(FRAMES):
            strip.paste(sheet.crop((c * CELL + x0, row * CELL + y0, c * CELL + x1, row * CELL + y1)), (c * fw, 0))
        d = os.path.join(LEG, sub)
        os.makedirs(d, exist_ok=True)
        strip.save(os.path.join(d, fname))
        print(f'  wolf {name}: row {row} window dx={x0} dy={y0} {fw}x{fh}')

    r = subprocess.run([sys.executable, GEN], cwd=ROOT)
    sys.exit(r.returncode)

if __name__ == '__main__':
    main()
