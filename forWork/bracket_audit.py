#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Аудит скобок data.js: честный обход с пропуском строк/комментариев,
печать стека открытых скобок на заданных строках."""
import sys

path = sys.argv[1] if len(sys.argv) > 1 else 'example/build/scripts/data.js'
src = open(path, encoding='utf-8').read()
pairs = {']': '[', '}': '{'}
stack = []
line = 1
i = 0
n = len(src)
targets = {568, 569, 576, 593, 594, 602, 603, 620, 621, 630, 647, 648, 649, 650}
report = {}
while i < n:
    c = src[i]
    if c == '\n':
        if line in targets:
            report[line] = (''.join(stack[-6:]), src.split('\n')[line - 1].strip()[:60])
        line += 1
        i += 1
        continue
    if c == '/' and i + 1 < n and src[i + 1] == '/':
        while i < n and src[i] != '\n':
            i += 1
        continue
    if c == '"' or c == "'" or c == '`':
        q = c
        i += 1
        while i < n and src[i] != q:
            if src[i] == '\\':
                i += 1
            i += 1
        i += 1
        continue
    if c in '[{':
        stack.append(c)
    elif c in ']}':
        if not stack or stack[-1] != pairs[c]:
            print(f'МИСМАТЧ на строке {line}: {c!r}, стек={stack[-8:]}')
            sys.exit(1)
        stack.pop()
    i += 1

for ln in sorted(report):
    st, txt = report[ln]
    print(f'{ln}: depth={len(st)} стек={st!r} | {txt}')
print('ИТОГ: глубина в конце файла =', len(stack))
