#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Сборка спрайтшита босса 4 этажа «Гриб пустоты» из сырых листов Retro Diffusion
(forWork/4floor3boss, 1024×1024, сетка 4×4 по 256px) — та же технология, что у
оборотня (wolf_128): вырезание кадров, хрома-ключ зелёного фона, срез серых
ярлыков с листа атак, даунскейл ×0.5 (арт натягивается 2×2), выравнивание
посадки по альфа-bbox полосы wait Циклопа (все 128-боссы рисуются из игры
одинаково: image(cell*32, cell*32-19, 512, 128)).

Итог:
  forWork/legacy_strips/enemy/mushroom/{move,attack,others}/*.png  — 11 полос 512×128
  forWork/sprites/mushroom_128.png + .json                         — лист 5×11 + манифест
  example/build/images/enemy/mushroom/spore.png                    — отдельный кадр для объекта-споры
  forWork/4floor3boss/preview_mushroom_sheet.png                   — предпросмотр листа

После него гонится штатный forWork/make_sheets_map.py (sheetsMap.js + копия листа
в build/images/sheets + resources.json).
"""
import os
import json
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'forWork', '4floor3boss')
LEGACY = os.path.join(ROOT, 'forWork', 'legacy_strips', 'enemy', 'mushroom')
SPR = os.path.join(ROOT, 'forWork', 'sprites')
BUILD_IMG = os.path.join(ROOT, 'example', 'build', 'images')
CYCLOP_WAIT = os.path.join(ROOT, 'forWork', 'legacy_strips', 'enemy', 'cyclop', 'others', 'wait.png')

# сырые листы (сетка 4×4, клетка 256)
F_WAIT = 'replace-the-void-jellyfish-character-in-this-sprit.png'          # idle ×4 направления
F_WALK = 'replace-the-movement-walking-animation-poses-in-th.png'          # ходьба ×4 направления
F_MOVE1 = 'на-прикреплённом-изображении-анимации-движения-пер.png'          # атаки: спина (кольцо), профиль
F_MOVE2 = 'на-прикреплённом-изображении-анимации-анимации-заглушка.png'     # (не существует — ниже реальные имена)
F_MOVE2 = 'на-прикреплённом-изображении-анимации-движения-пер (1).png'      # атаки: фронт (луч), профиль (плевок)
F_DMG = 'на-прикреплённом-изображении-анимации-атак-персона.png'            # урон 1-4, смерть-вортекс, спора-шар; С ЯРЛЫКАМИ
F_DEATH = 'на-прикреплённом-изображении-анимации-атак-персона (1).png'      # смерть фрон. 16 кадров: трещины→взрыв→руины→лужа

CELL = 256          # клетка сырого листа
FRAME = 128         # кадр игры (боссы 128, полоса 512×128)
TOL = 40            # порог хрома-ключа от зелёного фона
LABEL_GRAY = (128, 128, 128)
LABEL_TOL = 60

def load_raw(name):
    im = Image.open(os.path.join(RAW, name)).convert('RGBA')
    assert im.width == 1024 and im.height == 1024, name
    return im

def key_bg(im, label_corner=False):
    """хрома-ключ фона по угловому цвету; label_corner — срезать серые ярлыки в левом верхнем углу клеток"""
    px = im.load()
    bg = px[2, 2][:3]
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            d = ((r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2) ** 0.5
            if d < TOL:
                px[x, y] = (r, g, b, 0)
            elif label_corner and x % CELL < 64 and y % CELL < 64:
                dg = ((r - LABEL_GRAY[0]) ** 2 + (g - LABEL_GRAY[1]) ** 2 + (b - LABEL_GRAY[2]) ** 2) ** 0.5
                if dg < LABEL_TOL:
                    px[x, y] = (r, g, b, 0)
    return im

def cell(im, row, col):
    return im.crop((col * CELL, row * CELL, (col + 1) * CELL, (row + 1) * CELL))

def cell_lin(im, idx):
    return cell(im, idx // 4, idx % 4)

def downscale(fr):
    """256 → 128; арт пиксельный с удвоением — NEAREST. Неравномерность блоков считаем."""
    assert fr.width == CELL and fr.height == CELL
    px = fr.load()
    bad = 0
    for y in range(0, CELL, 2):
        for x in range(0, CELL, 2):
            q = [px[x + dx, y + dy][3] for dx in (0, 1) for dy in (0, 1)]
            if len(set(q)) > 1:
                bad += 1
    if bad > CELL * CELL / 4 * 0.05:
        print(f'  ~ неаккуратные 2×2 блоки: {bad}')
    return fr.resize((FRAME, FRAME), Image.NEAREST)

def union_bbox(frames):
    l, t, r, b = FRAME, FRAME, 0, 0
    for f in frames:
        bb = f.getchannel('A').getbbox()
        if bb:
            l, t = min(l, bb[0]), min(t, bb[1])
            r, b = max(r, bb[2]), max(b, bb[3])
    return (l, t, r, b)

def main():
    wait_im = key_bg(load_raw(F_WAIT))
    walk_im = key_bg(load_raw(F_WALK))
    move1 = key_bg(load_raw(F_MOVE1))
    move2 = key_bg(load_raw(F_MOVE2))
    dmg_im = key_bg(load_raw(F_DMG), label_corner=True)
    death_im = key_bg(load_raw(F_DEATH), label_corner=True)

    # --- кадры (0-индексация строк/колонок сырых листов) ---
    strips = {}
    strips['others/wait.png'] = [cell(wait_im, 0, c) for c in range(4)]
    strips['move/front.png'] = [cell(walk_im, 3, c) for c in range(4)]
    strips['move/back.png'] = [cell(walk_im, 0, c) for c in range(4)]
    strips['move/left.png'] = [cell(walk_im, 2, c) for c in range(4)]
    strips['move/right.png'] = [cell(walk_im, 1, c) for c in range(4)]
    # атака фронтом: зарядка (3 стойки с нарастающим свечением с листа смерти) →
    # ВЫЛУЧКА взрывом-звездой на шляпке (последний кадр, attackNew step:3);
    # исходный «луч» листа движения не годится — стреляет вбок, а фронт читается на камеру
    strips['attack/front.png'] = [cell_lin(death_im, i) for i in (0, 1, 2)] + [cell(dmg_im, 0, 3)]
    # атака спиной: разлёт спор, кольцо-импульс последним
    strips['attack/back.png'] = [cell(move1, 3, c) for c in (0, 1, 3, 2)]
    # атака справа: профиль → пасть open → ПЛЕВОК → закрытие
    strips['attack/right.png'] = [cell(move2, 1, c) for c in range(4)]
    # атака слева — зеркало правой (как у оборотня)
    strips['attack/left.png'] = [ImageOps.mirror(f) for f in strips['attack/right.png']]
    # урон: фронт, звезда-всплеск на 4-м кадре
    strips['others/damage.png'] = [cell(dmg_im, 0, c) for c in range(4)]
    # смерть: трещина → разлом → руины → лужа (последний кадр остаётся «трупом»)
    strips['others/death.png'] = [cell_lin(death_im, i) for i in (3, 5, 8, 12)]

    raw_frames = {k: [downscale(f) for f in v] for k, v in strips.items()}

    # --- посадка: низ и центр X — как у Циклопа (у всех 128-боссов общая геометрия вызова) ---
    cw = Image.open(CYCLOP_WAIT).convert('RGBA')
    cf = [cw.crop((i * FRAME, 0, (i + 1) * FRAME, FRAME)) for i in range(4)]
    cl, ct, cr, cb = union_bbox(cf)
    target_cx = (cl + cr) / 2
    print(f'циклоп wait bbox=({cl},{ct},{cr},{cb}) → centerX={target_cx}, низ={cb}')

    out_rows = {}
    for rel, frames in raw_frames.items():
        l, t, r, b = union_bbox(frames)
        dx = round(target_cx - (l + r) / 2)
        dy = cb - b
        placed = []
        for f in frames:
            canvas = Image.new('RGBA', (FRAME, FRAME), (0, 0, 0, 0))
            canvas.paste(f, (dx, dy), f)
            placed.append(canvas)
        out_rows[rel] = placed
        print(f'{rel}: bbox=({l},{t},{r},{b}) сдвиг=({dx},{dy})')

    # --- полосы 512×128 в legacy_strips ---
    for rel, frames in out_rows.items():
        p = os.path.join(LEGACY, rel)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        strip = Image.new('RGBA', (512, FRAME), (0, 0, 0, 0))
        for i, f in enumerate(frames):
            strip.paste(f, (i * FRAME, 0))
        strip.save(p)

    # --- лист 5×11 + манифест (порядок строк = cyclop_128) ---
    ROWS = [
        ('wait', 'others/wait.png'), ('walk_front', 'move/front.png'),
        ('walk_back', 'move/back.png'), ('walk_left', 'move/left.png'),
        ('walk_right', 'move/right.png'), ('attack_front', 'attack/front.png'),
        ('attack_back', 'attack/back.png'), ('attack_right', 'attack/right.png'),
        ('attack_left', 'attack/left.png'), ('death', 'others/death.png'),
        ('damage', 'others/damage.png'),
    ]
    sheet = Image.new('RGBA', (5 * FRAME, len(ROWS) * FRAME), (0, 0, 0, 0))
    anims = []
    for row_i, (name, rel) in enumerate(ROWS):
        for i, f in enumerate(out_rows[rel]):
            sheet.paste(f, (i * FRAME, row_i * FRAME))
        anims.append({'name': name, 'row': row_i, 'frames': 4})
    os.makedirs(SPR, exist_ok=True)
    sheet.save(os.path.join(SPR, 'mushroom_128.png'))
    json.dump({'size': FRAME, 'columns': 5, 'fps': 8, 'animations': anims},
              open(os.path.join(SPR, 'mushroom_128.json'), 'w'), indent=2)
    sheet.save(os.path.join(RAW, 'preview_mushroom_sheet.png'))

    # --- отдельный спрайт споры (кадр 0 wait): рисуется в игре 13×13 (1/10 босса) ---
    os.makedirs(os.path.join(BUILD_IMG, 'enemy', 'mushroom'), exist_ok=True)
    out_rows['others/wait.png'][0].save(os.path.join(BUILD_IMG, 'enemy', 'mushroom', 'spore.png'))

    print('OK: 11 полос + лист + манифест + spore.png')

if __name__ == '__main__':
    main()
