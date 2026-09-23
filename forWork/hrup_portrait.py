#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""V140: портрет Хрупа для диалогов — example/build/images/UI/doll/hrup.png.
Формат UI-портрета 192x288 (рисуется в диалоге 144x216), по рецепту ent.png
(V138): кадр wait c0 листа forWork/sprites/hrup_64.png, контент ×6 NEAREST,
якорь по низу-центру. Идемпотентно."""
import os
from PIL import Image

SPR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'forWork', 'sprites')
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   'example', 'build', 'images', 'UI', 'doll', 'hrup.png')

sheet = Image.open(os.path.join(SPR, 'hrup_64.png'))
frame = sheet.crop((0, 0, 64, 64))
bb = frame.getchannel('A').getbbox()
assert bb, 'пустой кадр'
content = frame.crop(bb)
big = content.resize((content.width * 6, content.height * 6), Image.NEAREST)
canvas = Image.new('RGBA', (192, 288), (0, 0, 0, 0))
canvas.paste(big, ((192 - big.width) // 2, 288 - big.height))
canvas.save(OUT)
print('hrup.png:', canvas.size, 'content', big.size)
