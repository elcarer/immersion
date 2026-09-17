import { svgArr,rect,circle,image,nativePoly } from "../scripts/svg.js"
import { status } from "../scripts/start.js"
import { playback,strike } from "../scripts/sound.js"
import { dataGeneric } from "../scripts/sceneGenerate.js"

//V30/V30a/V30b: мини-карта. Треугольная кнопка-«уголок» в правом верхнем углу экрана
//открывает/закрывает окошко ~200×200 с частью уровня вокруг героя (радиус 30 клеток):
//комнаты/коридоры — прямоугольники, герой — кружок. Больше ничего.
//
//V30b ТУМАН ВОЙНЫ — ТОЛЬКО ОТКРЫТЫЕ зоны. Мини-карта зеркалит правила БОЛЬШОЙ КАРТЫ
//(map.js) и мирового рендера: комната видима ⇔ её roomsArr-запись имеет флаг [3]===1,
//клетка коридора ⇔ запись dataGeneric.floor имеет [7]===1. Эти флаги выставляет
//САМА ИГРА в heroMove.checkNewRoom при подходе героя (окно viewus×32px вокруг героя
//для комнат, 64px для клеток коридоров) — здесь НИКАКОГО собственного состояния
//исследованности нет и не нужно: мини-карта всегда показывает текущую истину игры,
//пересобирается по смене отпечатка открытости/клетки героя/этажа.
//
//Кнопка живёт весь забег: создаётся в sceneGenerate (del() каждый раз вычищает ВСЕ
//svg-слои, включая постоянный UI на svgArr[2]). Окно пересобирается при смене клетки
//героя/этажа/открытости; кружок героя плавно ползёт КАЖДЫЙ тик по точным мировым
//координатам (масштаб 3px за клетку 32px, запись только при смене целых координат).
//Тик — из gameLoop рядом с остальными UI-тиками (внутри блока живого героя).
//
//ГРАБЛИ (были золотыми): обёртка UI-слоя создаётся с div pointerEvents="none" (svg.js) —
//интерактивные узлы ОБЯЗАНЫ сами ставить pointer-events; хелпер circle() игнорирует
//obj.id — вешать вручную; элементный style.cursor НЕ ТРОГАТЬ — игровой курсор один
//на всю игру управляется через body и не должен меняться ни на одном узле.

const MM_SIZE = 200                       // сторона окна
const MM_CELL = 3                         // пикселей на клетку уровня (клетка = 32px мира)
const MM_N = 30                           // радиус обзора в клетках (видно 61×61 клеток)
const MM_INNER = (MM_N * 2 + 1) * MM_CELL // 183px сетки внутри окна
const MM_PAD = Math.round((MM_SIZE - MM_INNER) / 2)
//V41a поправка пользователя: вся мини-карта (рамка, подложка, сетка, кружок) сдвинута на
//5px влево и 5px вниз — «встык к углу экрана» сменили отступы 5px справа и сверху
const MM_SHIFT_X = -5
const MM_SHIFT_Y = 5
const MM_X = 1920 - MM_SIZE - 12 + MM_SHIFT_X // 1703 — от него считается вся сетка и кружок
const MM_Y = 12 + MM_SHIFT_Y                  // 17
//V41: рамка окна — нарисованный арт ./images/UI/panels/minimap.png (224×224, ТОЛЬКО ободок
//~5px по краю, внутренность прозрачная) вместо генерённого rect-контура. Кладём 1:1 вокруг
//зоны карты 200×200: 12px запаса на рамку с каждой стороны. Внутренность арта прозрачна —
//тёмную подложку держит отдельный rect чуть под ободком (без него сквозь окно просвечивал бы мир)
const MM_FRAME = 224                          // сторона canvas арта рамки
const MM_IMG_X = 1920 - MM_FRAME + MM_SHIFT_X // 1691
const MM_IMG_Y = MM_SHIFT_Y                   // 5
const MM_RUN_FILL = "#8a7458"             // комнаты/коридоры
const MM_HERO_FILL = "#FFD24A"            // кружок героя
const BTN_LEG = 56                        // катет треугольной кнопки-уголка
const BTN_STROKE = 3                      // V30a: толще — уголок мелкий, тонкая рамка терялась

let btnNodes = []
let winNodes = []     // фон окна
let runNodes = []     // прямоугольники комнат/коридоров текущего рендера
let dotEl = null      // кружок героя (живёт поверх прямоугольников)
let dotX = -1         // последние записанные координаты кружка (ноль лишних записей)
let dotY = -1
let miniOpen = false
let renderAnchor = null // клетка героя, относительно которой построен текущий РЕНДЕР

//V30b данные этажа для быстрой проверки видимости клетки
let floorRef = null   // matrixLevel, к которому относится ownerRec
let ownerRec = null   // Int32Array W*H — клетка → индекс записи в dataGeneric.floor (−1 нет)
let recEntry = null   // Int32Array по записям floor — индекс записи → номер в roomsArr (−1 не комната)
let lastFp = ""       // отпечаток открытости последнего рендера

function mmFloor () {
    return dataGeneric && dataGeneric.scenes ? dataGeneric.scenes[status.levelFloor] : null
}
//клеточная карта принадлежности + карта «запись пола → roomsArr». Пересоздаётся на этаже.
function mmPrepare () {
    const m = status.matrixLevel
    const H = m.length
    const W = m[0].length
    floorRef = m
    ownerRec = new Int32Array(W * H).fill(-1)
    const lv = mmFloor()
    if (!lv) return
    for (let i = 0; i < lv.floor.length; i++) {
        const f = lv.floor[i]
        const x1 = Math.min(W, f[0] + f[2])
        const y1 = Math.min(H, f[1] + f[3])
        for (let y = Math.max(0, f[1]); y < y1; y++)
            for (let x = Math.max(0, f[0]); x < x1; x++) ownerRec[y * W + x] = i
    }
    recEntry = new Int32Array(lv.floor.length).fill(-1)
    for (let k = 0; k < lv.roomsArr.length; k++) {
        const idx = lv.roomsArr[k][0]
        idx >= 0 && idx < recEntry.length && (recEntry[idx] = k)
    }
}
//видима ли клетка: правила большие карты (map.js): комната открыта целиком по
//roomsArr[k][3]===1; клетка коридора — по своему флагу floor[i][7]===1 (флаги читаются
//ЖИВЫМИ — их меняет игра в checkNewRoom)
function mmVisible (ri) {
    const lv = mmFloor()
    if (!lv || ri < 0 || ri >= lv.floor.length) return false
    const f = lv.floor[ri]
    if (f[2] === 1) return f[7] === 1 //клетка коридора
    const k = recEntry ? recEntry[ri] : -1
    return k >= 0 && lv.roomsArr[k][3] === 1 //комната открыта целиком
}
//отпечаток открытости: число открытых комнат ×1e5 + число открытых клеток коридоров;
//флаги монотонны (закрытых обратно не бывает) — достаточно количеств
function mmFingerprint () {
    const lv = mmFloor()
    if (!lv) return ""
    let r = 0
    for (let k = 0; k < lv.roomsArr.length; k++) lv.roomsArr[k][3] === 1 && r++
    let c = 0
    for (let i = 0; i < lv.floor.length; i++) lv.floor[i][2] === 1 && lv.floor[i][7] === 1 && c++
    return r * 100000 + c
}
//создать кнопку-уголок. Вызывается из sceneGenerate на КАЖДОМ этаже (после del(),
//вычистившего прошлую кнопку вместе со всеми слоями).
function minimapBtn () {
    minimapBtnDel()
    closeMinimap()
    const bx = 1920 - BTN_LEG
    //R4.4: нативный Graphics-полигон с federated-событиями на узле вместо
    //createElementNS("polygon"); eventMode static в фабрике = бывший pointer-events:all.
    //Стилевой курсор НЕ переопределяем: курсор в игре один (body url cur.png)
    const poly = nativePoly(svgArr[2], [[bx, 0], [1920, 0], [1920, BTN_LEG]], "rgba(30,22,17,0.65)", "rgb(204,153,102)", BTN_STROKE, {"id": "minimapBtn"})
    poly.setAttribute("opacity", "0.7")
    poly.node.on("pointerover", () => {
        //V30a: подсветка заметнее — полная непрозрачность + двойное свечение
        poly.setAttribute("opacity", "1")
        poly.setAttribute("style", "filter: drop-shadow(0 0 8px rgba(255,214,140,0.95)) drop-shadow(0 0 3px rgb(204,153,102))")
    })
    poly.node.on("pointerout", () => {
        poly.setAttribute("opacity", "0.7")
        poly.setAttribute("style", "")
    })
    poly.node.on("pointertap", toggleMinimap)
    btnNodes.push(poly)
}
function minimapBtnDel () {
    while (btnNodes.length > 0) {
        const n = btnNodes.pop()
        n && n.remove && n.remove()
    }
}
function toggleMinimap () {
    if (status.start !== 1) return
    playback(strike[14].vol, 0, 0, 3 * status.settings.soundVolume)
    miniOpen ? closeMinimap() : openMinimap()
}
function openMinimap () {
    closeMinimap()
    miniOpen = true
    //V41: подложка — тёмный rect ПОД артом рамки, на 6px шире зоны карты (заходит под ободок,
    //щели не остаётся); без func оба узла сами получают pointer-events:none (svg.js)
    winNodes.push(rect(svgArr[2], MM_IMG_X + 6, MM_IMG_Y + 6, MM_FRAME - 12, MM_FRAME - 12, "none", "0px", "rgba(16,12,10,0.85)", {"id":"minimapWinBack","rx":"5px"}))
    //ВНИМАНИЕ: image() дописывает к obj.id суффикс "I" (svg.js) — как у кружка ниже, id вешаем руками
    const frameEl = image(svgArr[2], MM_IMG_X, MM_IMG_Y, MM_FRAME, MM_FRAME, "./images/UI/panels/minimap.png")
    frameEl.setAttribute("id", "minimapWin")
    winNodes.push(frameEl)
    //ВНИМАНИЕ: хелпер circle() НЕ ставит obj.id (игнорирует поле) — вешаем вручную
    dotEl = circle(svgArr[2], -100, -100, 4, "#1c150f", "1px", MM_HERO_FILL)
    dotEl.setAttribute("id", "minimapHero")
    //мгновенная отрисовка даже под паузой панелей: следующий тик мог бы не наступить
    if (status.start === 1 && status.matrixLevel) {
        status.matrixLevel !== floorRef && mmPrepare()
        const hx = Math.trunc(status.hero.x / 32)
        const hy = Math.trunc(status.hero.y / 32)
        mmRebuild(hx, hy)
        lastFp = mmFingerprint()
        mmPlaceDot()
    }
}
function closeMinimap () {
    while (runNodes.length > 0) {
        const n = runNodes.pop()
        n && n.remove && n.remove()
    }
    dotEl && dotEl.remove()
    dotEl = null
    while (winNodes.length > 0) {
        const n = winNodes.pop()
        n && n.remove && n.remove()
    }
    miniOpen = false
}
//пересборка окна вокруг клетки героя (hx,hy): строки matrixLevel===1, клетки которых
//принадлежат ОТКРЫТОЙ комнате или ОТКРЫТОЙ клетке коридора, сливаются в горизонтальные
//прогоны-прямоугольники. Вызывается при смене клетки/этажа/открытости.
function mmRebuild (hx, hy) {
    const m = status.matrixLevel
    while (runNodes.length > 0) {
        const n = runNodes.pop()
        n && n.remove && n.remove()
    }
    renderAnchor = {"x":hx, "y":hy}
    const x0 = hx - MM_N
    const y0 = hy - MM_N
    const H = m.length
    const W = m[0] ? m[0].length : 0
    for (let ry = y0; ry <= y0 + MM_N * 2; ry++) {
        if (ry < 0 || ry >= H) continue
        const row = m[ry]
        let runStart = -1
        //проход с шагом за пределом окна, чтобы закрыть последний прогон
        for (let rx = x0; rx <= x0 + MM_N * 2 + 1; rx++) {
            const wi = ry * W + rx
            const ri = wi >= 0 && wi < ownerRec.length ? ownerRec[wi] : -1
            const on = rx >= 0 && rx < W && rx <= x0 + MM_N * 2 && row[rx] === 1 && mmVisible(ri)
            if (on && runStart < 0) runStart = rx
            if (!on && runStart >= 0) {
                runNodes.push(rect(svgArr[2],
                    MM_X + MM_PAD + (runStart - x0) * MM_CELL,
                    MM_Y + MM_PAD + (ry - y0) * MM_CELL,
                    (rx - runStart) * MM_CELL,
                    MM_CELL, "none", "0px", MM_RUN_FILL))
                runStart = -1
            }
        }
    }
    dotEl && svgArr[2].appendChild(dotEl) //кружок — строго ПОВЕРХ прямоугольников
}
//плавное положение кружка из точных мировых координат героя (+16 к центру клетки);
//без клэмпа кружок у кромки карты уезжал бы в темное поле окна
function mmPlaceDot () {
    if (!dotEl || !renderAnchor) return
    const scale = MM_CELL / 32
    let cx = MM_X + MM_PAD + (status.hero.x + 16 - (renderAnchor.x - MM_N) * 32) * scale
    let cy = MM_Y + MM_PAD + (status.hero.y + 16 - (renderAnchor.y - MM_N) * 32) * scale
    cx < MM_X + MM_PAD + 3 && (cx = MM_X + MM_PAD + 3)
    cy < MM_Y + MM_PAD + 3 && (cy = MM_Y + MM_PAD + 3)
    cx > MM_X + MM_PAD + MM_INNER - 3 && (cx = MM_X + MM_PAD + MM_INNER - 3)
    cy > MM_Y + MM_PAD + MM_INNER - 3 && (cy = MM_Y + MM_PAD + MM_INNER - 3)
    cx = Math.round(cx)
    cy = Math.round(cy)
    if (cx !== dotX || cy !== dotY) {
        dotX = cx
        dotY = cy
        dotEl.setAttribute("cx", cx)
        dotEl.setAttribute("cy", cy)
    }
}
//тик из gameLoop (блок живого героя): пересборка при смене клетки/этажа/ОТКРЫТОСТИ
//(флаги читает сама игра — мини-карта догоняет в тот же тик), кружок — каждый тик.
//Закрытая мини-карта ничего не делает: истина живёт в данных игры, история не нужна.
function minimapTick () {
    if (status.start !== 1 || !status.matrixLevel) {
        miniOpen && closeMinimap()
        return
    }
    if (status.matrixLevel !== floorRef) mmPrepare()
    if (!miniOpen) return
    const fp = mmFingerprint()
    const hx = Math.trunc(status.hero.x / 32)
    const hy = Math.trunc(status.hero.y / 32)
    if (!renderAnchor || fp !== lastFp || renderAnchor.x !== hx || renderAnchor.y !== hy) {
        mmRebuild(hx, hy)
        lastFp = fp
    }
    mmPlaceDot()
}
//для тестов: снимок открытости (те же правила, что видит рендер)
function minimapDebug () {
    const res = {"openRooms":[], "corridorOpen":0, "runs":runNodes.length, "prepared":!!ownerRec}
    const lv = mmFloor()
    if (!lv) return res
    for (let k = 0; k < lv.roomsArr.length; k++) {
        if (lv.roomsArr[k][3] === 1) {
            const f = lv.floor[lv.roomsArr[k][0]]
            res.openRooms.push([f[0], f[1], f[2], f[3]])
        }
    }
    for (let i = 0; i < lv.floor.length; i++) lv.floor[i][2] === 1 && lv.floor[i][7] === 1 && res.corridorOpen++
    return res
}
export { minimapBtn, minimapBtnDel, minimapTick, minimapDebug }
