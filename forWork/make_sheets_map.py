#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Генератор карты «старая полоса анимации → клетка спрайтшита» (миграция анимаций
героев/врагов на листы zero_engine, 2026-09-16).

Листы собраны в forWork/sprites (<имя>_<64|128>.png + манифест .json: размер клетки,
колонок, fps, анимации по строкам). Старые полосы — images/{enemy,hero}/<имя>/
{move,attack,others}/<направление>.png (горизонтальные, 4 кадра).

Каждая строка листа — та же анимация, что старая полоса; кадр игры (окно fw×fh)
лежит внутри клетки листа со СМЕЩЕНИЕМ (dx,dy), которое вычисляется здесь по
альфа-bbox кадра 0 и ПРОВЕРЯЕТСЯ по всем кадрам строки (пиксель-в-пиксель).
Итог: build/scripts/sheetsMap.js + копия PNG в build/images/sheets/ +
включение их в images/resources.json (прогоном штатного resources-update.py).
Полосы без строки в манифесте (rat wait, spider/spiderRed wait|damage) не
ремапятся — рендер продолжает читать старый файл.
"""
import os, json, glob, shutil, subprocess, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))          # project2
IMG = os.path.join(ROOT, 'example', 'build', 'images')
# старые полосы удалены из билда (рендер читает листы); оригинал хранится здесь
# для перегенерации/верификации карты
LEGACY = os.path.join(ROOT, 'forWork', 'legacy_strips')
SPR = os.path.join(ROOT, 'forWork', 'sprites')
OUT_DIR = os.path.join(ROOT, 'example', 'build', 'images', 'sheets')
OUT_JS = os.path.join(ROOT, 'example', 'build', 'scripts', 'sheetsMap.js')

# имя полосы в папке → имя анимации в манифесте
STRIP2ANIM = {
    'others/wait.png':   'wait',
    'others/death.png':  'death',
    'others/damage.png': 'damage',
    'move/front.png':    'walk_front',
    'move/back.png':     'walk_back',
    'move/left.png':     'walk_left',
    'move/right.png':    'walk_right',
    'attack/front.png':  'attack_front',
    'attack/back.png':   'attack_back',
    'attack/left.png':   'attack_left',
    'attack/right.png':  'attack_right',
}

def bbox(im):
    if im.mode != 'RGBA':
        return None
    return im.getchannel('A').getbbox()

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    sheets = {f[:-5] for f in os.listdir(SPR) if f.endswith('.json')}
    entries = {}      # './images/enemy/bat/others/wait.png' -> {sheet, cell, row, dx, dy}
    problems = []

    for kind in ('enemy', 'hero'):
        base = os.path.join(LEGACY, kind)
        for ch in sorted(os.listdir(base)):
            p = os.path.join(base, ch)
            if not os.path.isdir(p):
                continue
            sh = [s for s in sheets if s.split('_')[0] == ch and s.startswith(ch + '_')]
            if not sh:
                problems.append(f'{kind}/{ch}: листа нет')
                continue
            sheet_name = sh[0]
            man = json.load(open(os.path.join(SPR, sheet_name + '.json')))
            cell = man['size']
            rows = {a['name']: a for a in man['animations']}
            sheet = Image.open(os.path.join(SPR, sheet_name + '.png')).convert('RGBA')

            for strip_rel, anim in STRIP2ANIM.items():
                strip_path = os.path.join(p, strip_rel)
                if not os.path.exists(strip_path):
                    continue                     # у персонажа просто нет этой полосы
                if anim not in rows:
                    problems.append(f'{kind}/{ch}/{strip_rel}: нет строки {anim} — остаётся старый файл')
                    continue
                row = rows[anim]
                strip = Image.open(strip_path).convert('RGBA')
                fw, fh = strip.width // row['frames'], strip.height
                if row['frames'] != strip.width // fw or fw * row['frames'] != strip.width:
                    problems.append(f'{kind}/{ch}/{strip_rel}: кадров в полосе ({strip.width}//{fw}) != манифеста ({row["frames"]}) — пропущен')
                    continue
                # смещение по первому непустому кадру
                dx = dy = None
                for i in range(row['frames']):
                    ob = bbox(strip.crop((i * fw, 0, (i + 1) * fw, fh)))
                    sb = bbox(sheet.crop((i * cell, row['row'] * cell, (i + 1) * cell, (row['row'] + 1) * cell)))
                    if ob and sb:
                        dx, dy = sb[0] - ob[0], sb[1] - ob[1]
                        break
                if dx is None:
                    problems.append(f'{kind}/{ch}/{strip_rel}: все кадры пустые — пропущен')
                    continue
                # проверка всех непустых кадров + границы клетки
                bad = 0
                for i in range(row['frames']):
                    ob = bbox(strip.crop((i * fw, 0, (i + 1) * fw, fh)))
                    sb = bbox(sheet.crop((i * cell, row['row'] * cell, (i + 1) * cell, (row['row'] + 1) * cell)))
                    if ob and sb and (sb[0] - ob[0], sb[1] - ob[1]) != (dx, dy):
                        bad += 1
                    x0, y0 = i * cell + dx, row['row'] * cell + dy
                    if x0 < 0 or y0 < 0 or x0 + fw > sheet.width or y0 + fh > sheet.height:
                        problems.append(f'{kind}/{ch}/{strip_rel}: кадр {i} выходит за лист ({x0},{y0},{fw},{fh}) — пропущен')
                        bad = -1
                        break
                if bad < 0:
                    continue
                if bad:
                    problems.append(f'{kind}/{ch}/{strip_rel}: {bad} кадров с другим смещением — пропущен')
                    continue
                url = f'./images/{kind}/{ch}/{strip_rel}'
                entries[url] = {
                    'sheet': f'./images/sheets/{sheet_name}.png',
                    'cell': cell, 'row': row['row'], 'dx': dx, 'dy': dy,
                    'fw': fw, 'fh': fh,
                }

    # копия PNG листов в билд
    n_png = 0
    for f in os.listdir(SPR):
        if f.endswith('.png'):
            shutil.copy2(os.path.join(SPR, f), os.path.join(OUT_DIR, f))
            n_png += 1

    # sheetsMap.js (плоская карта по URL полосы)
    lines = [
        '// GENERATED by forWork/make_sheets_map.py — не править руками.',
        '// Карта «старая полоса анимации → кадр спрайтшита»: клетка cell, строка row,',
        '// окно кадра fw×fh лежит в клетке со смещением (dx,dy). Верифицировано',
        '// пофреймово по альфа-bbox (пиксель-в-пиксель со старой полосой).',
        'export const SHEETS = {',
    ]
    for url in sorted(entries):
        e = entries[url]
        lines.append(f'    "{url}": {{ sheet: "{e["sheet"]}", cell: {e["cell"]}, row: {e["row"]}, dx: {e["dx"]}, dy: {e["dy"]}, fw: {e["fw"]}, fh: {e["fh"]} }},')
    lines += ['}', '']
    open(OUT_JS, 'w', encoding='utf-8', newline='\n').write('\n'.join(lines))

    # resources.json — штатный апдейтер (листы уже в images/sheets)
    subprocess.run([sys.executable, 'resources-update.py'], cwd=IMG, check=True)

    chars = len({url.rsplit('/', 1)[0] for url in entries})
    print(f'OK: {len(entries)} полос ({chars} персонажей) -> sheetsMap.js; листов скопировано: {n_png}')
    for p in problems:
        print('  ~', p)

if __name__ == '__main__':
    main()
