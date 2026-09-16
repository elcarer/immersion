# RENDER_MIGRATION — полный отказ от SVG-контейнеров (план, 2026-09-17)

Рябь при скролле уровня осталась после фикса тик-ритма и растра (ce6b9ab), в старом
SVG-билде её не было → источник — сам шим-слой (DOM-фасад поверх PixiJS), а не тайминги.
Решение: довести миграцию до конца — игра рендерится ИСКЛЮЧИТЕЛЬНО через ECS-ядро
zero_engine на PixiJS, DOM-шим (ShimEl + svg.js) сносится. Рефакторинг большой, поэтому
идёт поэтапно: каждый этап — отдельный коммит, самостоятельная игра полностью работоспособна
после каждого этапа, откат = git revert одного коммита.

## 1. Аудит текущего состояния (2026-09-17, build/)

### Слои рендера сейчас
```
78 игровых файлов
  ├─ svg.js (73 строки) — фасад: svg/circle/rect/text/image/textHtml/path/
  │   spritePos/moveSprite/releaseSprite/rectPos/getCTM — импортируют 61 файл
  ├─ прямые вызовы DOM-методов на шим-элементах — 43 файла, ~180 setAttribute
  └─ pixiBackend.js (2027 строк) — ShimEl: эмуляция DOM над Pixi
      setAttribute-роутер applyAttr, style-прокси, animVal, clipPath-маски,
      drop-shadow через запечённые glow-текстуры + теневые копии-сиблинги,
      drag, события (onclick→federated), пулы, graveyard,
      monkey-patch document.createElementNS (18 вызовов в игре)
```

### Гистограмма setAttribute в игровых файлах
x(26) y(33) opacity(19) href(19) width(16) id(14) height(12) visibility(6)
times(6) pointer-events(6) display(6) clip-path(6) fill(5) font-size(4) style(3)
viewBox(2) transform(2) stroke(2) cx/cy(по 2) stroke-width/points/d(по 1)

document.* в игре: getElementById 66 (UI-панели), addEventListener 19 (инпут —
остаётся DOM всегда, это не рендер), createElementNS 18 (через monkey-patch → шим),
elementFromPoint 1 (геймпад-клик).

### Контракт анимированного спрайта (главный подозреваемый ряби)
Один анимированный объект = ДВА шим-узла:
- `rect` (vrect, без Pixi-узла) — логическое окно кадра (x,y,w,h кадра);
- `img` (anim) — спрайт, у которого `img.x = rect.x − frameW*currentStill`
  (кадровое смещение `_shift`), текстура — текущий кадр-подокно листа.

`still` ВЫВОДИТСЯ на каждую запись: `applyPosition` считает `(rect.x − img.x)/frameW`
и зовёт `setFrame` (смена текстуры) + `syncShadowCopies` + `syncEcsPos`. Один шаг
сущности = до 4 setAttribute, каждый идёт через applyAttr-свитч. Между записями rect
и img внутри тика существуют промежуточные состояния (rect уже новый, img ещё старый) —
SVG-браузер рендерил атомарно раз в кадр, шим воспроизводит семантику поэлементно.
Плюс теневые копии-сиблинги, дробные масштабы, пер-записевые свопы текстур.

### ECS уже в сердце (сделано ранее)
- `objectValues` = Proxy-список → registerEcs: компоненты etype/posX/posY/cullPad/
  animCounter/animStill + маркеры isEnemy/isPet/isBullet/isFx, группы
  battle/ganim/genemy/gpet/gbullet/gfx;
- 6 горячих систем (animPlay, moveBullet, damageHero, damage, enemyMove, enemyAI) — на группах;
- `ecsRenderSync` каждый кадр прячет сущности вне камеры (culling).

**Вывод аудита:** остался один «не-нисходящий» слой — узлы Pixi пишутся синхронно из
setAttribute-пути, а не являются функцией компонентов. Убираем этот слой поэтапно.

## 2. Целевая архитектура

1. **Единственный источник истины — ECS-компоненты.** Позиция, кадр, альфа, слой,
   видимость боевых сущностей живут в типизированных массивах; узлы Pixi применяются
   ровно ОДИН раз за кадр в ecsRenderSync. Промежуточные состояния между записями
   невозможны по построению — класс причин ряби исчезает целиком.
2. **Фабрики движка вместо DOM-элементов:** makeSprite(sheetId, frame)/makeText/
   makeGraphics возвращают entity id; никаких setAttribute/appendChild.
3. **API игры — нативные функции** (setEntityPos/setEntityFrame/setEntityAlpha/…),
   svg.js удаляется, импорты переписываются.
4. **Логика отделяется от отображения:** rect-объекты остаются логическими
   координатами (коллизии/ИИ читают их), рендер их не наблюдает.
5. **Инпут не мигрирует:** мышь/клавиатура/геймпад остаются DOM-событиями (это не рендер).

Ограничения, учитываемые на всех этапах:
- лимит 32 компонента на сущность (ядро заняло биты 0..12) — новые компоненты
  компактные (Uint8/Uint16/Float32), реестры вместо строк (sheetId);
- игра мутирует `obj.type` на месте — группы остаются coarse, фильтры по type внутри систем;
- пулы спрайтов (буллеты/эффекты) и z-order (checkZOrder) сохраняют поведение.

## 3. Этапы

### R0. Страховочная сетка + baseline (пол-сессии)
- Golden-скриншоты ключевых сцен: лобби, старт этажа, бой, смерть героя, панели
  (инвентарь/таланты/журнал), минимапа, экран результатов — до любых правок.
- Автопрогоны готовой обвязкой: flow.mjs (до этажа), combat.mjs (бой с ИИ-врагами),
  риппл-тест (серия кадров при скролле камеры + попиксельный диф).
- Метрики baseline: FPS, тиков/с, warns, 404, число живых шимов/узлов.
- Всё сохраняется в forWork/render_baseline/ (вне билда) — с ним сравнивается каждый этап.

### R1. Рендер боевых сущностей из компонентов (ядро анти-ряби)
- Новые компоненты: `sheetId` (Uint16, реестр листов sheetsMap), `frame` (Uint16),
  `alpha` (Float32), `visible` (Uint8, уже покрыт culling'ом), `dead` (Uint8 —
  одноразовая команда уничтожения узла).
- anim/animStill-ветки applyAttr, spritePos/moveSprite пишут ТОЛЬКО компоненты —
  узел не трогают. Вывод still вычитанием исчезает: animPlay уже пишет компонент
  animStill напрямую (E-3), hero.img-смена анимации (href/times/width/height) →
  запись sheetId + rebuild-команда.
- ecsRenderSync расширяется до полного применения: позиция + кадр (texture swap) +
  альфа + видимость + обработка dead — один проход по battle/ganim за кадр.
- Теневые копии боевых сущностей: спрятать за компонент (shadowSpec → та же проекция),
  затем заменить нативным Pixi-фильтром/спрайтом в R4.
- Критерий приёмки: golden-скриншоты попиксельно (допуск ≤2px на тексте), риппл-тест
  чистый, полный цикл игры в headless без warns/404.

### R2. Игровые системы пишут компоненты напрямую
- animPlay, heroMove, enemyMove, moveBullet/moveMagicBullet, floatText, groundShadow,
  enemyHpBar, hpBar — нативный API (setEntityPos/setEntityFrame/setEntityAlpha) вместо
  setAttribute/moveSprite; rect остаётся логикой (rectPos читается как раньше).
- Спавн: makeEnemy/буллеты/эффекты получают нативный хэндл (entity id) вместо шима;
  пул буллетов — пул entity id.
- Критерий: grep — в перечисленных файлах 0 setAttribute/moveSprite; поведение 1:1.

### R3. Мир нативно (тайлы, двери, объекты)
- sceneGenerate/mapRender/openRoom/useObject/openDoor — статичные тайлы и объекты
  через батч-фабрику (общий батчер Pixi; при профиле — particleContainer), позиция
  ставится при создании и не переписывается.
- screenPic становится логическим реестром записей {sheetId, x, y, id-ключ}; поиск
  по `f.id === obj[6]+"OI"` (useObject/blessFx/alchemy/finPillars/trapsFx) → Map по ключу.
- del() — пакетное уничтожение слоя (существующий cleanup слоёв), graveyard сокращается.
- Критерий: старт этажа попиксельно, доставка/использование объектов, смена этажа.

### R4. UI нативно (тексты, полосы, иконки, миникарта, drag)
- Полосы ХП/опыта/босса (clipPath-маски) → прямой redraw Graphics; journal/library/
  settings/tip/миникарта/minimapFx → makeText/makeGraphics; drop-shadow декора →
  нативный фильтр (теневые копии-сиблинги удаляются как класс).
- События: onclick/onmouseover шимов → federated events напрямую (логика wirePixiEvents
  переезжает в публичный API); elementFromPoint → hitTestUI; drag.js → нативный pointer-drag.
- Критерий: панели, тултипы, drag предметов, геймпад-клик, минимапа.

### R5. Снос шима
- Удалить: ShimEl, applyAttr-роутер, style-прокси, animVal, clipPath-маски,
  glow-запекалку, createElementNS monkey-patch, svg.js, пулы шимов.
- Остатся: app/слои/камера/текстуры (движок), фабрики, ecsBridge/renderSync.
- Финальный аудит: grep по scripts/ вне бэкенда — 0 вхождений setAttribute,
  createElementNS, appendChild, style-записей на рендер-объектах.
- Документы: SESSION_HANDOFF.md, ENGINE.md, GAME.md — новый контракт рендера.

## 4. Протокол проверки каждого этапа (единый)
1. `node --input-type=module --check` каждого правленого модуля (node --check молчит на CJS!).
2. Headless-прогон полного цикла (Chrome CDP 9333): заставка → лобби → выбор героя →
   комиксы → этаж → дверь → бой 5+ врагов → убийство → смерть героя → результаты;
   warns=0, 404=0, FPS не ниже baseline.
3. Golden-диф скриншотов против forWork/render_baseline/.
4. Риппл-тест: ход у границы экрана, серия 30 кадров, попиксельный диф соседних кадров
   (двойные контуры = провал).
5. Коммит + пуш. Откат — revert одного коммита.

## 5. Риски
- Лимит 32 компонента: считаем биты на каждом этапе; при переполнении — упаковка
  (sheetId+frame в один Uint32).
- Строки нельзя в типизированные массивы — все ссылочные сущности через числовые
  реестры (листы уже сведены в sheetsMap.js).
- Порядок слоёв/z-order: checkZOrder (heroMove) трогает узлы напрямую — на R2/R3
  переводится на слой-компонент, сортировка в renderSync.
- Пулы и «мёртвые» узлы (игра переиспользует шимы после remove) — на R2 пул
  переезжает на entity id, destroy откладывается до десквот.
- UI-сущности в слое 2 не кульлятся камерой (endGame-экран очков) — правило
  сохраняется в renderSync.
