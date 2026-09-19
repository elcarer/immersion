// V64a — Портал (тип 18) и Рычаг (тип 19): связка «комната-арена».
//
// Генерация: ПОРТАЛ кладёт ОБЩИЙ пул интерактивных объектов — configEnemesRoomObject
// (newGame.js), комнаты с врагами, шанс как у обычного хлама, НЕ более 1 на этаж, только
// на свободной клетке (решение пользователя: портал появляется «как другие интерактивные
// объекты»). В «выключенной фазе» (obj[10]=0, спрайт 100d.png) взаимодействовать с ним
// нельзя. Рычаг (спрайт 102.png, активная фаза obj[10]=1) ставит configPortal — В ЛЮБОЙ
// комнате этажа (решение пользователя); в данных он существует с генерации — спрайт
// появляется штатно при отрисовке его комнаты, а в стартовой (единственной уже открытой)
// рисуется сразу. ВАЖНО: configPortal зовётся из newGame ПОСЛЕ sceneGenerate — её del()
// сбрасывает link (resetPortalFx), регистрация связки обязана идти после.
//
// Портал и Рычаг НИКОГДА не разрушаемы (решение пользователя; исключает софтлок арены):
// obj[7] им не ставится никогда, а destroyObjects уничтожает только объекты с obj[7]===1.
//
// Цикл: юз Рычага → Рычаг «выключенная фаза» и больше не используется, Портал
// «активная фаза». Юз главного Портала → Рычаг снова «активная фаза», Портал «выключенная
// фаза» и герой телепортируется в комнату-арену: 9×9 клетки, в стороне от этажа
// (полоса под картой), БЕЗ коридоров; в ней выключенный Портал и 9 случайных монстров
// этажа (каждый из 9 роллится отдельно из всех не-боссовых видов этажа). Все 9 убиты →
// в арене появляется Рычаг в активной фазе, связанный с Порталом этой арены. Его юз →
// Рычаг «выключенная фаза», аренный Портал «активная фаза»; юз аренного Портала →
// герой телепортируется обратно к главному Порталу.
// V64a4: арена у главного Портала ОДНА на этаж — повторные его юзы НЕ создают новые
// комнаты и НЕ спавнят врагов, а телепортируют в ту же (возможно уже пустую) арену;
// возвращение в зачищенную арену снова взводит её Рычаг (иначе герой заперт в арене).
//
// V83 — два вида главного Портала, определяются при ГЕНЕРАЦИИ (obj[12], решение
// пользователя): 1 — старый вид (100.png, комната-арена), 2 — новый вид (100a.png,
// комната-загадка). Игрок видит вид по нажатию Рычага. Вид 2 — НЕ БОЛЕЕ ОДНОГО за
// забег (флаг status.info.puzzleUsed переживает смены этажей), остальные порталы
// забега — вида 1; вероятность ролла 50/50. Комната-загадка (createPuzzleRoom) —
// «остров» 13×13 правее слота арены вида 1: возвратный Портал (неактивный, клетка
// (7,5) от угла), взведённый Рычаг (5,5) и 9 КНОПОК (тип 21) по углам и центрам
// сторон комнаты + в центре. Кнопка — повторяемый объект (как столб 15): юз
// переключает её и соседей по ЛОГИЧЕСКОЙ сетке 3×3 (решение пользователя) на
// противоположные. Все 9 в «1» (первый раз) — награда: случайная активная
// способность ЧУЖОГО класса уровня 1 (grantForeignSkill — новая механика).
//
// Состояние обмена: obj[10] — 1 активная / 0 выключенная фаза; obj[11] — «перезарядка»
// до выхода героя из зоны (как у столба 15 и алхимического стола 17). Арена (ОДНА на
// этаж, V64a4) хранится в link.arenas (комната-«остров» в roomsArr — opens/спавн/туман
// работают штатно). V83: вид портала — obj[12]; комната-загадка — link.puzzle.
// V97 — третий вид Портала, красный (100b.png, obj[12]=3, решение пользователя): комната
// «напёрстков» — третий «остров» нижнего ряда (правее комнаты-загадки), 13×13. Внутри —
// возвратный Портал, взведённый Рычаг и 9 ЧАШ (тип 22, спрайты goldFull/goldEmpty) в той
// же раскладке 3×3, что кнопки загадки. У ОДНОЙ чаши спрайт goldFull. Через 2с после
// появления (shellTick — тики игры, вызов из gameLoop) «полная» чаша меняет спрайт на
// «пустой», и чаши начинают меняться местами (скольжение: интервал 45 тиков, каждый
// следующий своп быстрее — ×0.78, минимум 10); через 8с останавливаются (репорт V97:
// 6с — слишком легко угадать). Юз чаши в фазе
// выбора (перезарядка obj[11], как у кнопки): «настоящая» показывает goldFull, все чаши
// перестают быть интерактивными. Угадал — 9 кучек золота вокруг героя; не угадал — Рычаг
// исчезает, возвратный Портал гаснет и появляется Лидер гоблинов (босс 1 этажа) с
// максимальным усилением 4 главы (все три блока множителей openRoom), но БЕЗ тега boss
// (без полосы ХП и зачёта bossKill). После его смерти (portalArenaKill) Рычаг
// возвращается — герой активирует им портал и уходит.
import { status } from "../scripts/start.js"
import { data } from "../scripts/data.js"
import { dataGeneric, createMatrix } from "../scripts/sceneGenerate.js"
import { svgArr, image, worldImage, spritePos } from "../scripts/svg.js"
//V97: objectValues — спавн Лидера гоблинов в комнате «напёрстков»
import { screenPic, objectValues } from "../scripts/del.js"
//V97: кучки золота — подбор через takeDrop (dropArr) и страховка от стен (placeDrop)
//V103: постановку в dropArr делает dropFly (полёт из центра героя по параболе)
import { placeDrop,dropFly } from "../scripts/dropSafe.js"
//V31: единый писатель камеры + фактический размер окна (зависит от зума)
import { setWorldViewBox, worldViewW, worldViewH } from "../scripts/zoomFx.js"
//спрайты по состоянию — та же формула, что в createRoom/mapRender (модуль без импортов)
import { portalSpriteSrc, cupSpriteSrc } from "../scripts/portalSprite.js"
//V83: выдача чужой активной способности — тот же конвейер, что дерево способностей
import { skillEffect } from "../scripts/skillTree.js"
//V83: анонс награды загадки — всплывающий текст и журнал
import { T } from "../scripts/localization.js"
import { floatText } from "../scripts/floatText.js"
import { journalAdd, J_STD } from "../scripts/journal.js"

const PORTAL_TYPE = 18
const LEVER_TYPE = 19
//V83: кнопка загадки (тип 21) и размер комнаты-загадки
const BUTTON_TYPE = 21
const PUZZLE_SIZE = 13
//V97: чаша «напёрстков» — интерактивный объект комнаты вида 3
const CUP_TYPE = 22
//V97: комната «напёрстков» (вид 3 портала) и её тайминги (60 тиков ≈ 1 секунда)
const SHELL_SIZE = 13
const SHELL_REVEAL_TICKS = 120 //2с показа «полной» чаши
const SHELL_SWAP_TICKS = 480   //8с перемещений (репорт V97: 6с — слишком легко угадать)
const SHELL_SWAP_START = 45    //тиков между свопами в начале
const SHELL_SWAP_MIN = 10      //потолок скорости к концу
const SHELL_SWAP_DECAY = 0.78  //множитель ускорения каждого следующего свопа
//нативный размер спрайта портала 100.png/100d.png — рисуется 1:1, низ по клетке объекта,
//горизонтально по центру клетки (аналог столба 32×81, но шире клетки)
const PORTAL_SPRITE_W = 64
const PORTAL_SPRITE_H = 84
//арена: 9×9 клеток (решение пользователя), 9 монстров
const ARENA_SIZE = 9
const ARENA_ENEMES = 9

let link = null // {portal, lever, arenas: [{room, portal, lever, left, entryCell}], puzzle: {room, portal, lever, buttons, solved, entry}|null, shell: {room, portal, lever, cups, full, phase, timer, interval, swapIn, done, bossSpawned, bossDown, entry}|null}

//----- генерация: портал кладёт ОБЩИЙ пул объектов (configEnemesRoomObject в newGame.js,
//комнаты с врагами, не более 1 на этаж — решение пользователя V64a); здесь только рычаг -----
function configPortal(level) {
    link = null
    //портала на этаже нет — связки нет
    let portal = null
    for (let i = 0; i < level.objects.length; i++) {
        if (level.objects[i][2] === PORTAL_TYPE) { portal = level.objects[i]; break }
    }
    if (!portal) return
    //V97: вид портала (obj[12]) — пул из трёх видов: 1 — арена (100.png), 2 — комната-
    //загадка (100a.png), 3 — «напёрстки» (100b.png). Каждый спец-вид — не более одного
    //за забег (решение пользователя): флаги status.info (puzzleUsed/shellUsed) переживают
    //смены этажей; уже использованные виды выпадают из пула. У арен/возвратных порталов
    //obj[12] не ставится
    let kinds = [1]
    status.info.puzzleUsed || kinds.push(2)
    status.info.shellUsed || kinds.push(3)
    portal[12] = kinds[Math.trunc(Math.random() * kinds.length)]
    portal[12] === 2 && (status.info.puzzleUsed = 1)
    portal[12] === 3 && (status.info.shellUsed = 1)
    //рычаг — в ЛЮБОЙ комнате этажа (решение пользователя, включая стартовую и комнату портала)
    let rooms = level.roomsArr
    let idxs = []
    for (let i = 0; i < rooms.length; i++) idxs.push(i)
    idxs.sort(() => Math.random() - 0.5)
    for (let r = 0; r < idxs.length; r++) {
        let leverObj = placeRoomObject(level, rooms[idxs[r]], LEVER_TYPE, 1)
        if (leverObj) {
            link = { portal: portal, lever: leverObj, arenas: [], puzzle: null }
            //единственная открытая (и уже отрисованная sceneGenerate) комната — стартовая:
            //рычаг в ней надо нарисовать сразу, createRoom для неё больше не вызовется
            leverObj[9][3] === 1 && drawObjectSprite(leverObj)
            return
        }
    }
}
function placeRoomObject(level, room, type, state) {
    let rf = level.floor[room[0]]
    for (let attempt = 0; attempt < 50; attempt++) {
        let x = rf[0] + 1 + Math.trunc(Math.random() * (rf[2] - 2))
        let y = rf[1] + 1 + Math.trunc(Math.random() * (rf[3] - 2))
        if (cellBusy(level, x, y)) continue
        level.objects.push([x, y, type, 1, 1, undefined])
        let obj = level.objects[level.objects.length - 1]
        obj[9] = room
        obj[10] = state
        return obj
    }
    return null
}
function cellBusy(level, x, y) {
    for (let i = 0; i < level.objects.length; i++) {
        let o = level.objects[i]
        if (x >= o[0] && x < o[0] + o[3] && y >= o[1] && y < o[1] + o[4]) return true
    }
    for (let i = 0; i < level.walls.length; i++) {
        let w = level.walls[i]
        if (x >= w[0] && x < w[0] + w[3] && y >= w[1] && y < w[1] + w[4]) return true
    }
    return x === level.hero[0] && y === level.hero[1]
}

//----- юз объекта (вызывается из useObject.finishUsedObject вместо actionsObject) -----
function portalUse(obj) {
    if (!link) return
    let level = dataGeneric.scenes[status.levelFloor]
    if (obj[2] === PORTAL_TYPE) {
        //V83: возвратный портал комнаты-загадки — телепорт ОБРАТНО к главному порталу
        //(его рычаг гаснет, сам портал гаснет; связка не одноразовая — повторный вход
        //через главный портал пере-взводит рычаг, иначе герой был бы заперт в комнате).
        //Нет свободной клетки рядом с главным порталом — юз не расходуется
        let pz = link.puzzle
        if (pz && obj === pz.portal) {
            if (obj[10] !== 1) return
            let cell = freeCellNear(level, link.portal[0], link.portal[1])
            if (!cell) return
            setObjectState(obj, 0)
            pz.lever && setObjectState(pz.lever, 0)
            teleportHero(cell[0], cell[1])
            return
        }
        //V97: возвратный портал комнаты «напёрстков» — телепорт ОБРАТНО к главному порталу
        //(аналог комнаты-загадки; во время наказания рычага нет — guard ниже пропустит)
        let sh = link.shell
        if (sh && obj === sh.portal) {
            if (obj[10] !== 1) return
            let cell = freeCellNear(level, link.portal[0], link.portal[1])
            if (!cell) return
            setObjectState(obj, 0)
            sh.lever && setObjectState(sh.lever, 0)
            teleportHero(cell[0], cell[1])
            return
        }
        //аренный портал — телепорт ОБРАТНО к главному порталу (рычаг арены гаснет,
        //он и так уже выключен своим юзом; сам портал гаснет, но связка НЕ одноразовая:
        //вернувшись главным порталом, герой снова взведёт рычаг зачищенной арены).
        //Нет свободной клетки рядом с главным порталом — юз не расходуется (герой
        //не телепортируется НА клетку объекта — застрянет в нём)
        let arena = link.arenas.find(a => a.portal === obj)
        if (arena) {
            if (obj[10] !== 1) return
            let cell = freeCellNear(level, link.portal[0], link.portal[1])
            if (!cell) return
            setObjectState(obj, 0)
            arena.lever && setObjectState(arena.lever, 0)
            teleportHero(cell[0], cell[1])
            return
        }
        //главный портал: рычаг снова активен (портал иначе был бы одноразовым), портал
        //гаснет. V64a4: арена ОДНА — первый юз создаёт её, повторные телепортируют в Ту ЖЕ
        //комнату без нового спавна комнат/врагов (решение пользователя: каждый юз порождал
        //новую арену с 9 монстрами — бесконечная ферма). Возврат в ЗАЧИЩЕННУЮ арену снова
        //взводит её рычаг — без этого герой в пустой арене заперт (выход только через
        //ареный портал за рычагом); в недозачищенной рычага ещё нет — добивание спавнит
        //его штатно (portalArenaKill)
        if (obj !== link.portal || obj[10] !== 1) return
        setObjectState(link.lever, 1)
        setObjectState(link.portal, 0)
        //V83: вид 2 — комната-загадка вместо арены: первый юз создаёт её, повторные
        //телепортируют в ту же (кнопки хранят состояния); рычаг возврата пере-взводится
        if (obj[12] === 2) {
            if (!link.puzzle) createPuzzleRoom(level)
            else link.puzzle.lever && link.puzzle.lever[10] !== 1 && setObjectState(link.puzzle.lever, 1)
            teleportHero(link.puzzle.entry[0], link.puzzle.entry[1])
            return
        }
        //V97: вид 3 — комната «напёрстков» вместо арены: первый юз создаёт её (и запускает
        //отсчёт «напёрстков»), повторные телепортируют в ту же (выбор мог быть ещё не
        //сделан); рычаг возврата пере-взводится, если он существует (после проигрыша он
        //появится только с победой над боссом)
        if (obj[12] === 3) {
            if (!link.shell) createShellRoom(level)
            else link.shell.lever && link.shell.lever[10] !== 1 && setObjectState(link.shell.lever, 1)
            teleportHero(link.shell.entry[0], link.shell.entry[1])
            return
        }
        let target = link.arenas[0]
        if (!target) target = createArena(level)
        else if (target.left <= 0 && target.lever) setObjectState(target.lever, 1)
        teleportHero(target.entryCell[0], target.entryCell[1])
    } else if (obj === link.lever) {
        //рычаг этажа: включает главный портал
        if (link.portal[10] === 1) return
        setObjectState(obj, 0)
        setObjectState(link.portal, 1)
    } else if (link.puzzle && obj === link.puzzle.lever) {
        //V83: рычаг комнаты-загадки — включает возвратный портал
        if (link.puzzle.portal[10] === 1) return
        setObjectState(obj, 0)
        setObjectState(link.puzzle.portal, 1)
    } else if (link.shell && obj === link.shell.lever) {
        //V97: рычаг комнаты «напёрстков» — включает возвратный портал
        if (link.shell.portal[10] === 1) return
        setObjectState(obj, 0)
        setObjectState(link.shell.portal, 1)
    } else {
        //рычаг арены: включает портал своей арены
        let arena = link.arenas.find(a => a.lever === obj)
        if (!arena || arena.portal[10] === 1) return
        setObjectState(obj, 0)
        setObjectState(arena.portal, 1)
    }
}
//свободная проходимая клетка, соседняя с (cx,cy) — точка выхода героя из арены
//(рядом с главным порталом, но не в нём и не в другом объекте)
function freeCellNear(level, cx, cy) {
    let matrix = status.matrixLevel
    let dirs = [[0,1],[0,-1],[-1,0],[1,0]]
    for (let d = 0; d < dirs.length; d++) {
        let x = cx + dirs[d][0]
        let y = cy + dirs[d][1]
        if (!(matrix[y] && matrix[y][x] === 1)) continue
        let busy = false
        for (let i = 0; i < level.objects.length; i++) {
            let o = level.objects[i]
            x >= o[0] && x < o[0] + o[3] && y >= o[1] && y < o[1] + o[4] && (busy = true)
        }
        if (!busy) return [x, y]
    }
    return null
}
//переключение фазы: состояние в obj[10] + свап href отрисованного спрайта (obj[6] —
//индекс в screenPic; спрайта может не быть — комната ещё не отрисована, тогда спрайт
//создаст createRoom уже по новому состоянию; «надгробия» V55 — guard img &&)
function setObjectState(obj, state) {
    obj[10] = state
    let img = obj[6] !== undefined ? screenPic[obj[6]] : null
    img && img.setAttribute("href", portalSpriteSrc(obj))
}

//----- арена -----
function createArena(level) {
    //«в стороне от этажа»: полоса ПОД картой, колонны по 4 арены; level.h растёт —
    //от него строятся матрица проходимости и масштаб панели «Карта»
    let idx = link.arenas.length
    let ax = 3 + (idx % 4) * 12
    let ay = level.h + 3 + Math.trunc(idx / 4) * 12
    level.h = ay + 12
    let floorIdx = level.floor.length
    //пол-прямоугольник комнаты: [x, y, w, h, tex, centerX, centerY] (как у newGame)
    level.floor.push([ax, ay, ARENA_SIZE, ARENA_SIZE, 3, ax + 4, ay + 4])
    //кольцо стен — рецепты изолированной комнаты newGame.createWalls: все НА клетках пола
    //([5]-связи не нужны, createRoom рисует по координатам): верх 20 (1×1), лево 22 /
    //право 21 (1×1), низ 19 (1×2), верхние углы 6/7 (1×1), нижние 3/2 (1×2)
    let walls = level.walls
    walls.push([ax, ay, 6, 1, 1])
    walls.push([ax + 8, ay, 7, 1, 1])
    for (let i = 1; i < 8; i++) {
        walls.push([ax + i, ay, 20, 1, 1])
        walls.push([ax, ay + i, 22, 1, 1])
        walls.push([ax + 8, ay + i, 21, 1, 1])
        walls.push([ax + i, ay + 8, 19, 1, 2])
    }
    walls.push([ax, ay + 8, 3, 1, 2])
    walls.push([ax + 8, ay + 8, 2, 1, 2])
    //комната в roomsArr: [индекс floor, площадь, спек врагов, флаг открытости] — коридоров
    //НЕТ: комната-«остров», откроется штатно (checkNewRoom → createRoom + openRoom),
    //спавн 9 монстров с множителями главы сделает openRoom по спеку.
    //[4]=1 — маркер арены: волна призыва Демона (finSummonWave) в арену не ходит
    let room = [floorIdx, ARENA_SIZE * ARENA_SIZE, arenaSpec(), 0]
    room[4] = 1
    level.roomsArr.push(room)
    //выключенный портал — в центре арены (спрайт создаст createRoom при входе героя)
    level.objects.push([ax + 4, ay + 4, PORTAL_TYPE, 1, 1, undefined])
    let portal = level.objects[level.objects.length - 1]
    portal[9] = room
    portal[10] = 0
    //матрица проходимости: арена — «остров»; BFS врагов и коллизии читают её каждый тик
    createMatrix()
    let arena = { room: room, portal: portal, lever: undefined, left: ARENA_ENEMES, entryCell: [ax + 4, ay + 5] }
    link.arenas.push(arena)
    return arena
}
//спек формата openRoom: на каждую группу iE (data.enemes[iE + 6*levelFloor]) пара
//[количество, вариант]. Каждый из 9 монстров роллится ОТДЕЛЬНО из не-боссовых видов
//СВОЕГО этажа (решение пользователя): минус боссы и минус классы без анимации спавна
//(см. guard в пуле ниже — id 6/13/20).
//У этажа ровно 6 групп (формула openRoom): 1-й — 0..5, 2-й — 6..11, 3-й — 12..17.
//Прежний count=7 на 1-м этаже тянул группу 6 — дворфа (id 7) со 2-го этажа (репорт V64a).
function arenaSpec() {
    let lf = status.levelFloor
    let base = 6 * lf
    let count = 6
    let pool = []
    for (let g = base; g < base + count; g++) {
        let grp = data.enemes[g]
        let classes = Array.isArray(grp) ? grp : [grp]
        if (classes.some(c => c.boss === 1)) continue
        //V64a: у класса обязана быть анимация спавна anims[2].others[2] — её читает openRoom
        //при создании врага. У id 6, id 13 и id 20 (последняя группа каждого этажа)
        //others.length===2, и спавн ронял openRoom посреди комнаты: в арене выходило меньше
        //9 монстров, счётчик убийств не доходил до нуля — рычаг арены не появлялся (репорт
        //пользователя). Обычные комнаты не падали, потому что их спек использует только
        //первые 4 группы этажа
        if (!classes.every(c => c.anims && c.anims[2] && c.anims[2].others && c.anims[2].others[2])) continue
        pool.push(g)
    }
    let spec = []
    for (let i = 0; i < count; i++) spec.push([0, 0])
    if (pool.length === 0) return spec
    let variants = {}
    for (let n = 0; n < ARENA_ENEMES; n++) {
        let g = pool[Math.trunc(Math.random() * pool.length)]
        let idx = g - base
        spec[idx][0]++
        if (variants[g] === undefined) {
            let grp = data.enemes[g]
            let vn = Array.isArray(grp) ? grp.length : 1
            variants[g] = vn > 1 ? Math.trunc(Math.random() * vn) : 0
        }
        spec[idx][1] = variants[g]
    }
    return spec
}
//счёт убийств арены: хук из enemyAI.enemyDie (единственная точка смерти врага).
//Враги знают свою room (roomsArr-запись из openRoom) — по ней находим арену.
//V97: та же точка возвращает Рычаг комнаты «напёрстков» после победы над её боссом
function portalArenaKill(enemy) {
    if (!link || !enemy.room) return
    let arena = link.arenas.length > 0 && link.arenas.find(a => a.room === enemy.room && a.left > 0)
    if (arena) {
        arena.left--
        arena.left <= 0 && spawnArenaLever(dataGeneric.scenes[status.levelFloor], arena)
        return
    }
    let sh = link.shell
    if (sh && sh.room === enemy.room && sh.bossSpawned && !sh.bossDown) {
        sh.bossDown = true
        spawnShellLever(dataGeneric.scenes[status.levelFloor], sh)
    }
}
//все 9 убиты — в арене появляется Рычаг в АКТИВНОЙ фазе (решение по ТЗ) на случайной
//свободной клетке интерьера (не клетка портала, не пересекая хитбокс героя). Комната уже
//отрисована (герой внутри) — спрайт создаём сразу тем же конвейером, что createRoom
//(id «NO» + svg.image дописывает «I», obj[6] = индекс в screenPic)
function spawnArenaLever(level, arena) {
    let f = level.floor[arena.room[0]]
    let matrix = status.matrixLevel
    let cells = []
    for (let x = f[0] + 1; x < f[0] + f[2] - 1; x++) {
        for (let y = f[1] + 1; y < f[1] + f[3] - 1; y++) {
            if (!(matrix[y] && matrix[y][x] === 1)) continue
            //исключаем не «клетку ног» (x+16, y+50), а любую клетку, пересекающую ХИТБОКС
            //героя (x+13, y+37, 14×14 — как в collision.js): хитбокс заходит и в соседние
            //клетки, и рычаг в такой клетке клался прямо на героя (репорт V64a). Сам рычаг
            //к тому же проходим (collision.collisionCheckObject) — зажать героя он не может
            let hx = status.hero.x + 13
            let hy = status.hero.y + 37
            let busy = hx < x * 32 + 32 && hx + 14 > x * 32 && hy < y * 32 + 32 && hy + 14 > y * 32
            for (let i = 0; i < level.objects.length && !busy; i++) {
                let o = level.objects[i]
                x >= o[0] && x < o[0] + o[3] && y >= o[1] && y < o[1] + o[4] && (busy = true)
            }
            !busy && cells.push([x, y])
        }
    }
    if (cells.length === 0) return
    let cell = cells[Math.trunc(Math.random() * cells.length)]
    level.objects.push([cell[0], cell[1], LEVER_TYPE, 1, 1, undefined])
    let lever = level.objects[level.objects.length - 1]
    lever[9] = arena.room
    lever[10] = 1
    arena.lever = lever
    drawObjectSprite(lever)
}

//----- комната-загадка (вид 2 портала, V83) -----
//«правее» слота арены вида 1 (та занимает x=3..11 в полосе ПОД картой): тот же приём
//«острова», что у createArena; level.h растёт — от него строятся матрица проходимости
//и масштаб панели «Карта». Размер 13×13 (решение пользователя)
function createPuzzleRoom(level) {
    let px = 17
    let py = level.h + 3
    level.h = py + PUZZLE_SIZE + 3
    let floorIdx = level.floor.length
    //пол-прямоугольник комнаты: [x, y, w, h, tex, centerX, centerY] (как у newGame)
    level.floor.push([px, py, PUZZLE_SIZE, PUZZLE_SIZE, 3, px + 6, py + 6])
    //кольцо стен — рецепт createArena/createWalls: все НА клетках пола: верх 20 (1×1),
    //лево 22 / право 21 (1×1), низ 19 (1×2), верхние углы 6/7 (1×1), нижние 3/2 (1×2)
    let walls = level.walls
    walls.push([px, py, 6, 1, 1])
    walls.push([px + 12, py, 7, 1, 1])
    for (let i = 1; i < 12; i++) {
        walls.push([px + i, py, 20, 1, 1])
        walls.push([px, py + i, 22, 1, 1])
        walls.push([px + 12, py + i, 21, 1, 1])
        walls.push([px + i, py + 12, 19, 1, 2])
    }
    walls.push([px, py + 12, 3, 1, 2])
    walls.push([px + 12, py + 12, 2, 1, 2])
    //комната в roomsArr: спек из шести ПУСТЫХ групп (формат openRoom, как у arenaSpec с
    //пустым пулом) — врагов нет; [4]=1 — маркер «острова»: волна призыва Демона не ходит
    let spec = []
    for (let i = 0; i < 6; i++) spec.push([0, 0])
    let room = [floorIdx, PUZZLE_SIZE * PUZZLE_SIZE, spec, 0]
    room[4] = 1
    level.roomsArr.push(room)
    //возвратный портал — неактивный, «чуть правее и выше центра» (клетка (7,5) от угла);
    //рычаг, его активирующий, — «чуть левее и выше центра» (5,5), взведён сразу.
    //obj[12] возвратному порталу не ставится — активный спрайт 100.png (portalSprite.js)
    level.objects.push([px + 7, py + 5, PORTAL_TYPE, 1, 1, undefined])
    let portal = level.objects[level.objects.length - 1]
    portal[9] = room
    portal[10] = 0
    level.objects.push([px + 5, py + 5, LEVER_TYPE, 1, 1, undefined])
    let lever = level.objects[level.objects.length - 1]
    lever[9] = room
    lever[10] = 1
    //9 кнопок (тип 21): углы и центры сторон комнаты + центр — логическая сетка 3×3,
    //растянутая по комнате (решение пользователя). Стартовые состояния — случайный
    //НАВЕДИМЫЙ набор: случайные нажатия накатываются на решённое «всё в 1», поэтому
    //решение существует всегда, а пустой набор нажатий запрещает старт решённой загадки
    let states = []
    for (let b = 0; b < 9; b++) states.push(1)
    let presses = 0
    for (let b = 0; b < 9; b++) {
        if (Math.random() < 0.5) { puzzleFlip(states, b); presses++ }
    }
    presses === 0 && puzzleFlip(states, Math.trunc(Math.random() * 9))
    let buttons = []
    let cells = [[1, 1], [6, 1], [11, 1], [1, 6], [6, 6], [11, 6], [1, 11], [6, 11], [11, 11]]
    for (let b = 0; b < 9; b++) {
        level.objects.push([px + cells[b][0], py + cells[b][1], BUTTON_TYPE, 1, 1, undefined])
        let btn = level.objects[level.objects.length - 1]
        btn[9] = room
        btn[10] = states[b]
        buttons.push(btn)
    }
    //матрица проходимости: комната — «остров»; BFS врагов и коллизии читают её каждый тик
    createMatrix()
    //герой входит между рычагом и порталом (клетка над центром комнаты)
    link.puzzle = {room: room, portal: portal, lever: lever, buttons: buttons, solved: false, entry: [px + 6, py + 5]}
}
//флип в логической сетке 3×3 (порядок row-major): кнопка + соседи по вертикали/горизонтали
function puzzleFlip(states, b) {
    let nb = [b, b - 3, b + 3]
    let c = b % 3
    c > 0 && nb.push(b - 1)
    c < 2 && nb.push(b + 1)
    for (let i = 0; i < nb.length; i++) {
        let n = nb[i]
        n >= 0 && n < 9 && (states[n] = states[n] === 1 ? 0 : 1)
    }
}
//юз кнопки (вызывается из useObject, тип 21): переключает её и соседей по логической
//сетке на противоположные. Все 9 в «1» и ещё не решено — награда (один раз за комнату):
//случайная активная способность чужого класса уровня 1. Кнопки повторяемые (obj[11],
//как у столба 15) — после решения щёлкать можно, награда не повторяется
function puzzleButtonUse(obj) {
    if (!link || !link.puzzle) return
    let b = link.puzzle.buttons.indexOf(obj)
    if (b === -1) return
    let flip = [b]
    let c = b % 3
    c > 0 && flip.push(b - 1)
    c < 2 && flip.push(b + 1)
    b - 3 >= 0 && flip.push(b - 3)
    b + 3 < 9 && flip.push(b + 3)
    for (let i = 0; i < flip.length; i++) {
        let btn = link.puzzle.buttons[flip[i]]
        setObjectState(btn, btn[10] === 1 ? 0 : 1)
    }
    if (!link.puzzle.solved && link.puzzle.buttons.every(btn => btn[10] === 1)) {
        link.puzzle.solved = true
        grantForeignSkill()
    }
}
//случайная активная способность ДРУГОГО класса, уровень 1 (новая механика V83). Пул —
//индексы, которые skillEffect кладёт в activeSkills (только повторяемые/автокаст ветки).
//Выдача — тот же skillEffect с явным классом и уровнем 1; info.skills НЕ трогаем — чужая
//способность не принадлежит дереву героя и не прокачивается (tip показывает descFull).
//Анонс — всплывающий текст над героем и запись в журнале
const FOREIGN_ACTIVES = [[1, 2, 5, 11, 13], [0, 1, 2, 6, 9], [1, 2, 11, 13], [0, 3, 11, 12, 13]]
function grantForeignSkill() {
    let pool = []
    for (let c = 0; c < 4; c++) {
        if (c === status.hero.class) continue
        for (let i = 0; i < FOREIGN_ACTIVES[c].length; i++) pool.push([c, FOREIGN_ACTIVES[c][i]])
    }
    let pick = pool[Math.trunc(Math.random() * pool.length)]
    let skill = data.heroes[pick[0]].skills[pick[1]]
    skillEffect(pick[1], pick[0], 1)
    floatText(status.hero.x - 16 + Math.trunc(Math.random() * 32), status.hero.y + 8, T("float.skillGet", T(skill.title)), "#FFD68C", "18px", "none")
    journalAdd(T("journ.skillGet", T(skill.title)), J_STD)
}

//----- комната «напёрстков» (вид 3 портала, V97) -----
//Третий «остров» нижнего ряда, правее комнаты-загадки: арена занимает x=3..11, загадка
//x=17..29, «напёрстки» — x=31..43 (шаг 14 клеток, как между ареной и загадкой)
function createShellRoom(level) {
    let sx = 31
    let sy = level.h + 3
    level.h = sy + SHELL_SIZE + 3
    let floorIdx = level.floor.length
    //пол-прямоугольник комнаты: [x, y, w, h, tex, centerX, centerY] (как у newGame)
    level.floor.push([sx, sy, SHELL_SIZE, SHELL_SIZE, 3, sx + 6, sy + 6])
    //кольцо стен — рецепт createArena/createPuzzleRoom: верх 20 (1×1), лево 22 / право 21
    //(1×1), низ 19 (1×2), верхние углы 6/7 (1×1), нижние 3/2 (1×2)
    let walls = level.walls
    walls.push([sx, sy, 6, 1, 1])
    walls.push([sx + 12, sy, 7, 1, 1])
    for (let i = 1; i < 12; i++) {
        walls.push([sx + i, sy, 20, 1, 1])
        walls.push([sx, sy + i, 22, 1, 1])
        walls.push([sx + 12, sy + i, 21, 1, 1])
        walls.push([sx + i, sy + 12, 19, 1, 2])
    }
    walls.push([sx, sy + 12, 3, 1, 2])
    walls.push([sx + 12, sy + 12, 2, 1, 2])
    //комната в roomsArr: спек из шести ПУСТЫХ групп (формат openRoom) — врагов нет;
    //[4]=1 — маркер «острова»: волна призыва Демона не ходит
    let spec = []
    for (let i = 0; i < 6; i++) spec.push([0, 0])
    let room = [floorIdx, SHELL_SIZE * SHELL_SIZE, spec, 0]
    room[4] = 1
    level.roomsArr.push(room)
    //возвратный портал — неактивный, клетка (7,5) от угла; взведённый рычаг — (5,5),
    //как в комнате-загадке. obj[12] возвратному порталу не ставится (portalSprite.js)
    level.objects.push([sx + 7, sy + 5, PORTAL_TYPE, 1, 1, undefined])
    let portal = level.objects[level.objects.length - 1]
    portal[9] = room
    portal[10] = 0
    level.objects.push([sx + 5, sy + 5, LEVER_TYPE, 1, 1, undefined])
    let lever = level.objects[level.objects.length - 1]
    lever[9] = room
    lever[10] = 1
    //9 чаш (тип 22) в той же раскладке, что кнопки загадки: углы, центры сторон, центр.
    //У случайной чаши спрайт goldFull (obj[10]=1), у остальных goldEmpty
    let cups = []
    let cells = [[1, 1], [6, 1], [11, 1], [1, 6], [6, 6], [11, 6], [1, 11], [6, 11], [11, 11]]
    let fullIdx = Math.trunc(Math.random() * 9)
    for (let b = 0; b < 9; b++) {
        level.objects.push([sx + cells[b][0], sy + cells[b][1], CUP_TYPE, 1, 1, undefined])
        let cup = level.objects[level.objects.length - 1]
        cup[9] = room
        cup[10] = b === fullIdx ? 1 : 0
        cups.push(cup)
    }
    //матрица проходимости: комната — «остров»; BFS врагов и коллизии читают её каждый тик
    createMatrix()
    //фаза 1 — «показ»: 2с герой запоминает полную чашу, затем её спрайт становится
    //«пустым» и начинается перемешивание (shellTick). Спрайты чаш создаст createRoom при
    //открытии комнаты (герой входит телепортом в тот же тик) — все операции со спрайтами
    //в shellTick под guard'ом
    link.shell = {room: room, portal: portal, lever: lever, cups: cups, full: cups[fullIdx],
        phase: 1, timer: SHELL_REVEAL_TICKS, interval: SHELL_SWAP_START, swapIn: SHELL_SWAP_START,
        done: false, bossSpawned: false, bossDown: false, entry: [sx + 6, sy + 5]}
}
//каждый тик игры (вызов из gameLoop): фазы «напёрстков» + скольжение чаш.
//Фаза 1 (2с): по истечении «полная» чаша становится «пустой». Фаза 2 (8с): раз в
//interval тиков ДВЕ пары свободных чаш меняются клетками, интервал ускоряется ×0.78
//(45 → 10 тиков); по истечении новых свопов нет — когда доедут последние, фаза 3
//(выбор). Пауза игры тик не доставляет — таймеры стоят вместе со всей сценой
function shellTick() {
    if (!link || !link.shell) return
    let sh = link.shell
    moveShellCups(sh)
    if (sh.phase === 1) {
        sh.timer--
        if (sh.timer <= 0) {
            setCupSprite(sh.full, 0)
            sh.phase = 2
            sh.timer = SHELL_SWAP_TICKS
            sh.interval = SHELL_SWAP_START
            sh.swapIn = SHELL_SWAP_START
        }
    } else if (sh.phase === 2) {
        sh.timer--
        if (sh.timer > 0) {
            if (!cupsMoving(sh)) {
                sh.swapIn--
                if (sh.swapIn <= 0) {
                    shellSwap(sh, sh.interval)
                    sh.interval = Math.max(SHELL_SWAP_MIN, Math.trunc(sh.interval * SHELL_SWAP_DECAY))
                    sh.swapIn = sh.interval
                }
            }
        } else if (!cupsMoving(sh)) {
            sh.phase = 3
        }
    }
}
//скольжение: чаша едет из move.fx/fy в свою клетку [0]/[1] линейно за move.dur тиков;
//координаты объекта обновлены на старте переезда (checkObject/коллизии), спрайт догоняет
function moveShellCups(sh) {
    for (let i = 0; i < sh.cups.length; i++) {
        let c = sh.cups[i]
        if (!c.move) continue
        c.move.age++
        let img = c[6] !== undefined ? screenPic[c[6]] : null
        if (!img) { c.move = null; continue }
        if (c.move.age >= c.move.dur) {
            spritePos(img, c[0] * 32, c[1] * 32)
            c.move = null
        } else {
            let t = c.move.age / c.move.dur
            spritePos(img, Math.round(c.move.fx + (c[0] * 32 - c.move.fx) * t), Math.round(c.move.fy + (c[1] * 32 - c.move.fy) * t))
        }
    }
}
function cupsMoving(sh) {
    for (let i = 0; i < sh.cups.length; i++) {
        if (sh.cups[i].move) return true
    }
    return false
}
//за цикл меняются местами ДВЕ пары чаш одновременно (решение пользователя V99):
//первая пара берётся из всех свободных чаш, вторая — из оставшихся (чаш в скольжении
//может не хватить — вторая пара пропускается); dur — тиков на переезд, равен текущему
//интервалу (к концу перемешивания чаши переезжают быстрее)
function shellSwap(sh, dur) {
    for (let p = 0; p < 2; p++) {
        let free = []
        for (let i = 0; i < sh.cups.length; i++) !sh.cups[i].move && free.push(sh.cups[i])
        if (free.length < 2) return
        let i1 = Math.trunc(Math.random() * free.length)
        let i2 = (i1 + 1 + Math.trunc(Math.random() * (free.length - 1))) % free.length
        let a = free[i1]
        let b = free[i2]
        let ax = a[0], ay = a[1]
        a.move = {fx: ax * 32, fy: ay * 32, dur: dur, age: 0}
        b.move = {fx: b[0] * 32, fy: b[1] * 32, dur: dur, age: 0}
        a[0] = b[0]; a[1] = b[1]
        b[0] = ax; b[1] = ay
    }
}
//спрайт чаши по полноте (obj[10]): свап href отрисованного спрайта — как setObjectState
function setCupSprite(cup, full) {
    cup[10] = full
    let img = cup[6] !== undefined ? screenPic[cup[6]] : null
    img && img.setAttribute("href", cupSpriteSrc(cup))
}
//интерактивность чаши (guard в heroMove.checkObject): только в фазе выбора и пока выбор
//не сделан — в фазах показа/перемешивания и после вскрытия чаши «мёртвые» объекты
function shellCupReady(obj) {
    return !!(link && link.shell && link.shell.phase === 3 && !link.shell.done &&
        link.shell.cups.indexOf(obj) !== -1)
}
//юз чаши (вызов из useObject, тип 22): выбор сделан — «настоящая» показывает goldFull,
//все чаши перестают быть интерактивными. Угадал — 9 кучек золота вокруг героя;
//нет — рычаг исчезает, возвратный портал гаснет и появляется Лидер гоблинов
//(глава 4 без тега boss)
function shellCupUse(obj) {
    if (!shellCupReady(obj)) return
    let sh = link.shell
    sh.done = true
    let level = dataGeneric.scenes[status.levelFloor]
    setCupSprite(sh.full, 1)
    if (obj === sh.full) {
        spawnGoldRing()
        journalAdd(T("journ.shellWin"), J_STD)
    } else {
        removeShellLever(level, sh)
        sh.portal[10] === 1 && setObjectState(sh.portal, 0)
        sh.bossSpawned = true
        let cls = spawnShellBoss(level, sh)
        cls && journalAdd(T("journ.shellLose", T(cls.name)), J_STD)
    }
}
//9 кучек золота вокруг героя: ближайшие свободные клетки (пол матрицы), кольца r=1..3;
//placeDrop страхует от стен/объектов (спрайт переедет на соседнюю клетку)
function spawnGoldRing() {
    let m = status.matrixLevel
    let hc = [Math.trunc(status.hero.x / 32), Math.trunc(status.hero.y / 32)]
    let placed = {}
    let n = 0
    for (let r = 1; r <= 3 && n < 9; r++) {
        for (let dy = -r; dy <= r && n < 9; dy++) {
            for (let dx = -r; dx <= r && n < 9; dx++) {
                if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
                let cx = hc[0] + dx
                let cy = hc[1] + dy
                if (!(m[cy] && m[cy][cx] === 1) || placed[cx + "_" + cy]) continue
                placed[cx + "_" + cy] = 1
                screenPic.push(worldImage(svgArr[1], cx * 32, cy * 32, 64, 32, "./images/dungeon/drop/gold.png", {"id": screenPic.length - 1}))
                //V103: полёт из центра спрайта героя (центр хитбокса, как его видит takeDrop)
                let el = screenPic[screenPic.length - 1]
                placeDrop(el, cx * 32, cy * 32, 64, 32)
                dropFly(el, status.hero.x + 16, status.hero.y + 25)
                n++
            }
        }
    }
}
//рычаг исчезает: объект из level.objects + его спрайт из screenPic («надгробие» —
//guard, как в setObjectState)
function removeShellLever(level, sh) {
    if (!sh.lever) return
    let idx = level.objects.indexOf(sh.lever)
    idx >= 0 && level.objects.splice(idx, 1)
    let img = sh.lever[6] !== undefined ? screenPic[sh.lever[6]] : null
    img && img.remove()
    sh.lever = null
}
//Лидер гоблинов (id 4, босс 1 этажа) с максимальным усилением 4 главы —
//все три блока множителей openRoom (гл.2: hp×2, урон +1/+2; гл.3: hp×2, +2/+6, скорость
//и зоркость +1; гл.4: hp×1.5, +2/+8, скорость +2, зоркость +1; итого hp×6). Тег boss
//снимается у КЛОНА класса: полосы ХП нет, bossKill не засчитывается (решение
//пользователя). Клетка — свободный интерьер комнаты, не пересекающий хитбокс героя
//(поиск как у spawnArenaLever). ВАЖНО: ГРУППА enemes ≠ id врага — у 1 этажа id = группа+1,
//data.enemes[4] — Мумия (репорт V97: по ошибке спавнилась она) — поэтому класс ищется
//по id. Возвращает клон класса (или null — свободных клеток нет)
function spawnShellBoss(level, sh) {
    let lider = null
    for (let g = 0; g < data.enemes.length && !lider; g++) {
        let grp = data.enemes[g]
        let arr = Array.isArray(grp) ? grp : [grp]
        for (let v = 0; v < arr.length; v++) {
            if (arr[v].id === 4) { lider = arr[v]; break }
        }
    }
    if (!lider) return null
    let f = level.floor[sh.room[0]]
    let matrix = status.matrixLevel
    let cells = []
    for (let x = f[0] + 1; x < f[0] + f[2] - 1; x++) {
        for (let y = f[1] + 1; y < f[1] + f[3] - 1; y++) {
            if (!(matrix[y] && matrix[y][x] === 1)) continue
            let hx = status.hero.x + 13
            let hy = status.hero.y + 37
            let busy = hx < x * 32 + 32 && hx + 14 > x * 32 && hy < y * 32 + 32 && hy + 14 > y * 32
            for (let i = 0; i < level.objects.length && !busy; i++) {
                let o = level.objects[i]
                x >= o[0] && x < o[0] + o[3] && y >= o[1] && y < o[1] + o[4] && (busy = true)
            }
            !busy && cells.push([x, y])
        }
    }
    if (cells.length === 0) return
    let cell = cells[Math.trunc(Math.random() * cells.length)]
    let cls = JSON.parse(JSON.stringify(lider))
    delete cls.boss
    let stats = JSON.parse(JSON.stringify(lider.stats))
    stats.hp *= 2
    stats.dmg[0] += 1
    stats.dmg[1] += 2
    stats.hp *= 2
    stats.dmg[0] += 2
    stats.dmg[1] += 6
    stats.speed += 1
    stats.range += 1
    stats.hp *= 1.5
    stats.dmg[0] += 2
    stats.dmg[1] += 8
    stats.speed += 2
    stats.range += 1
    let spawnAnim = cls.anims[2].others[2]
    objectValues.push({"id":status.oVcount,"type":"enemy","class":cls,"stats":stats,
    "animCounters":60/spawnAnim.speed,"currentAnim":spawnAnim,"currentStill":0,"room":sh.room,"cells":cells,
    "state":0,"stop":0,"xCell":cell[0],"yCell":cell[1],"noStunTime":0,
    "img":image(svgArr[1],
        cell[0]*32,
        cell[1]*32-19,
        spawnAnim.w,
        spawnAnim.h,
        spawnAnim.img,
        {"times":spawnAnim.times,"id":status.oVcount,"frame":1})})
    status.oVcount++
    objectValues[objectValues.length-1].rect = objectValues[objectValues.length-1].img.clipRect
    let lengthAttacks = cls.attacks.length
    for (let iA = 0; iA < lengthAttacks; iA++) {
        objectValues[objectValues.length-1].stats.attacksCd[iA] = Math.trunc((data.attacks[cls.attacks[iA]].cooldown*1000)/16)
    }
    return cls
}
//победа над боссом (portalArenaKill): рычаг возвращается на свободную клетку интерьера
//(клетки чаш заняты объектами — там рычаг не встанет); комната уже отрисована — спрайт
//создаём сразу тем же конвейером, что spawnArenaLever
function spawnShellLever(level, sh) {
    let f = level.floor[sh.room[0]]
    let matrix = status.matrixLevel
    let cells = []
    for (let x = f[0] + 1; x < f[0] + f[2] - 1; x++) {
        for (let y = f[1] + 1; y < f[1] + f[3] - 1; y++) {
            if (!(matrix[y] && matrix[y][x] === 1)) continue
            let hx = status.hero.x + 13
            let hy = status.hero.y + 37
            let busy = hx < x * 32 + 32 && hx + 14 > x * 32 && hy < y * 32 + 32 && hy + 14 > y * 32
            for (let i = 0; i < level.objects.length && !busy; i++) {
                let o = level.objects[i]
                x >= o[0] && x < o[0] + o[3] && y >= o[1] && y < o[1] + o[4] && (busy = true)
            }
            !busy && cells.push([x, y])
        }
    }
    if (cells.length === 0) return
    let cell = cells[Math.trunc(Math.random() * cells.length)]
    level.objects.push([cell[0], cell[1], LEVER_TYPE, 1, 1, undefined])
    let lever = level.objects[level.objects.length - 1]
    lever[9] = sh.room
    lever[10] = 1
    sh.lever = lever
    drawObjectSprite(lever)
}
//состояние комнаты «напёрстков» (тест-харнесс: чтение фаз/чаш в headless)
function shellState() {
    return link && link.shell ? link.shell : null
}

//спрайт объекта 1×1 (рычаг) «вне createRoom»: комната уже отрисована — рисуем сразу тем же
//конвейером (id «NO», svg.image дописывает «I», obj[6] = индекс в screenPic)
function drawObjectSprite(obj) {
    screenPic.push(worldImage(svgArr[1], obj[0] * 32, obj[1] * 32, 32, 32, portalSpriteSrc(obj), {"id": screenPic.length + "O"}))
    obj[6] = screenPic.length - 1
}

//----- телепорт героя: хитбокс героя (x+13, y+37, 14×14) кладём СТРОГО внутрь клетки —
//x = cell*32-4, y = cell*32-28 (посадка «по рецепту тест-драйва» y-50 навешивала хитбокс
//на клетку объекта сверху — герой застревал в блокирующем объекте). Клеточные проверки
//(checkNewRoom/checkObject: (x+16,y+50)) видят героя в целевой клетке -----
function teleportHero(cellX, cellY) {
    let px = cellX * 32 - 4
    let py = cellY * 32 - 28
    spritePos(status.hero.obj.img, px, py)
    status.hero.x = px
    status.hero.y = py
    setWorldViewBox(px - worldViewW() / 2, py - worldViewH() / 2)
}

//смена сцены (del.js): связка этажа и арены не переживают del()
function resetPortalFx() {
    link = null
}

export {configPortal, portalUse, portalArenaKill, resetPortalFx, placeRoomObject, puzzleButtonUse, shellTick, shellCupUse, shellCupReady, shellState, PORTAL_TYPE, LEVER_TYPE, PORTAL_SPRITE_W, PORTAL_SPRITE_H}
