//V47: всплывающее окно врага при наведении курсора на игровом поле — оформление КАРТОЧКИ
//полностью повторяет Библиотеку (library.js): имя, анимация движения спереди (видимый кадр
//≤160×84, центр по горизонтали), статы в 2 колонки (слева жизни/урон/скорость, справа
//зоркость/устойчивость/атака), способность ниже во всю ширину с переносом строк.
//Отличия от карточки Библиотеки (решения пользователя по постановке V47):
//  1) неизученный враг (meta.library[id]===0) — «???» + чёрный силуэт, как в Библиотеке;
//  2) значения статов — ФАКТИЧЕСКИЕ (с усилениями главы из d.stats), жизни показываются
//     ТЕКУЩИЕ и обновляются каждый тик, пока окно открыто.
//V48: тот же механизм обслуживает ИНТЕРАКТИВНЫЕ ОБЪЕКТЫ карты (useObject.js): наведение на
//объект показывает его карточку из data.objectsLib (имя, статичный спрайт, эффект). Приоритет
//у врагов — они отрисованы поверх объектов, поиск врагов идёт первым. Зона наведения объекта —
//его сетка на карте (клетки*32; столб призыва рисуется 32×81 с подъёмом на 49px, как в
//createRoom), отвечает только отрисованный объект (спрайт в screenPic по obj[6]). Неиспользованный
//объект (meta.libraryObjects[id] === 0) — «???» и чёрный силуэт, как в Библиотеке;
//id = тип + этаж*20 (ловушки — три карточки 14/34/54 по типу, V63; столб призыва — 55).
//Поведение окна: открывается при наведении курсора на врага, следует за курсором (со сдвигом
//вправо-вниз, у правого края переворачивается влево, клампы по краям viewBox); исчезает при
//уходе курсора с врага, при открытии любой панели/полосы кнопок (status.panels!==0), при паузе,
//при смене сцены (resetEnemyHover из del.js). V96: при скрытом курсоре (герой движется —
//heroMove прячет body.style.cursor) окно не открывается, а открытое гаснет; курсор
//возвращается только реальным движением мыши (gameLoop) — с ним окно снова доступно.
//Зона наведения — окно кадра спрайта врага: rect (клип-окно, кэш rectPos) + размеры кадра
//d._frameW/d._ch (кэш animPlay.js, фолбэк — размеры из currentAnim). Поиск ведётся с конца
//objectValues — верхний отрисованный враг побеждает. Тик вызывается из gameLoop КАЖДЫЙ тик
//безусловно (до блока паузы): guard внутри сам гасит окно при panels!==0/pause!==0.
//Пауза окну не нужна: анимация карточки крутится тиками игры (пока окно открыто, игра живёт —
//панели закрыты). Окно целиком pointer-events:none (ни у одного узла нет func) — клики
//и подсказки сквозь него работают как раньше.
import { status } from "../scripts/start.js"
import { T } from "../scripts/localization.js"
import { data } from "../scripts/data.js"
import { dataGeneric } from "../scripts/sceneGenerate.js"
import { svgArr, image, rect, text, nativeHtml, releaseSprite, spritePos, rectPos, isDragging } from "../scripts/svg.js"
import { objectValues, screenPic } from "../scripts/del.js"
//V63: спрайт/id ловушки по её состоянию и типу — та же формула, что в createRoom/useObject
import { trapSpriteSrc } from "../scripts/trapSprite.js"

//V48a: описание врага = поле desc из data.js — показывается всегда, когда есть, без требования
//ключа умения из старого списка (тот же критерий, что в library.js); без префикса — решение юзера

//геометрия карточки — те же константы вёрстки, что в library.js (createCard)
const CARD_W = 392
const CARD_H = 336
const NAME_SIZE = 32, NAME_Y = 40
const ANIM_MAX_W = 160, ANIM_MAX_H = 84, ANIM_Y = 52
const STAT_SIZE = 28, STAT_Y = 166, STAT_STEP = 32
const STAT_LX = 36, STAT_RX = 196, STAT_LW = 150, STAT_RW = 182
const ABIL_SIZE = 28, ABIL_Y = 250, ABIL_H = 78
//V48: вёрстка карточки объекта (спрайт крупнее вражьей анимации — объекты квадратные)
const OBJ_MAX_H = 110
const OBJ_DESC_Y = 186, OBJ_DESC_H = 130
const COL = "rgb(204, 153, 102)"
const COL_DIM = "rgb(110, 90, 70)"
//сдвиг окна от курсора и клампы краёв (viewBox UI-слоя 1920×1080)
const CUR_DX = 24, CUR_DY = 20, EDGE = 8

let hovered = null   //цель под курсором: {kind:"enemy", d} | {kind:"object", o, id} (V48)
let winNodes = []    //узлы окна: {el, dx, dy, pooled}
let cardImg = null   //анимация карточки (спрайт из пула, svgArr[2])
let cardAnim = null  //{counter, reset, still, times, frameW}
let cardHpText = null //строка «Жизни: …» — обновляется каждый тик
let cardHpLast = ""   //кэш последней записанной строки (ноль лишних DOM-записей)
let winX = 0, winY = 0 //текущий левый-верхний угол окна во viewBox UI
let ehId = 0          //монотонный счётчик id клипов спрайтов пула

//V48a: описание врага — просто поле desc (data.js); нет desc → строка пропускается.
//V60a: desc — ключ локализации, переводим на месте показа (как в library.js)
function abilityDesc(stats) {
    return stats.desc ? T(stats.desc) : null
}

//подгонка размера шрифта под ширину колонки (копия fitText из library.js)
function fitText(el, maxW) {
    try {
        let size = parseFloat(el.getAttribute("font-size"))
        while (size > 13 && el.getComputedTextLength() > maxW) {
            size -= 1
            el.setAttribute("font-size", size)
        }
    } catch (err) {}
    return el
}

//курсор (viewBox UI) → мировые координаты игры: viewBox камеры = 1920/zoom × 1080/zoom
function mouseWorld() {
    const vb = svgArr[0].viewBox.animVal
    return [vb.x + status.mouseX * (vb.width / 1920), vb.y + status.mouseY * (vb.height / 1080)]
}

//курсор внутри окна кадра спрайта врага? Размеры кадра — кэш animPlay (d._frameW/d._ch),
//фолбэк для врага первого тика жизни — размеры из currentAnim
function hitTest(d, wx, wy) {
    const pos = rectPos(d.rect)
    const anim = d.currentAnim
    const fw = d._frameW || (anim ? anim.w / (anim.times || 1) : 32)
    const fh = d._ch || (anim ? anim.h : 32)
    return wx >= pos[0] && wx <= pos[0] + fw && wy >= pos[1] && wy <= pos[1] + fh
}

//живой враг на поле: не труп (enemyDie ставит type "corpse"), не лежащий (mummy, hp<=0),
//не удалённый из objectValues
function alive(d) {
    return d.type === "enemy" && d.stats && d.stats.hp > 0 && objectValues.indexOf(d) !== -1
}

//V48: id карточки объекта в data.objectsLib / meta.libraryObjects: тип + этаж*20 (формула
//спрайта createRoom); столб призыва — 55. V63: у ловушек ТРИ карточки — по спрайту obj[10]:
//шипы (3) → 14, кислота (4) → 34, огонь (1) → 54
function objId(o) {
    return o[2] === 15 ? 55 : o[2] === 14 ? (o[10] === 3 ? 14 : o[10] === 4 ? 34 : 54) : o[2] + status.levelFloor * 20
}

//спрайт объекта — та же формула, что при отрисовке комнаты: fin1 у столба, ловушка —
//спрайт её ТЕКУЩЕЙ фазы (trapSprite.js: 3e/1e/3/4/1), objects/14|34|54.png у статуи (V49,
//пути юзера), objects/15|35|55.png у алхимического стола (V54, пути юзера), objects/{id}.png у остальных
function objImgSrc(o) {
    return o[2] === 15
        ? "./images/dungeon/objects/fin1.png"
        : o[2] === 14
            ? trapSpriteSrc(o)
            : o[2] === 16
                ? "./images/dungeon/objects/" + (14 + status.levelFloor * 20) + ".png"
                : o[2] === 17
                    ? "./images/dungeon/objects/" + (15 + status.levelFloor * 20) + ".png"
                    : "./images/dungeon/objects/" + (o[2] + status.levelFloor * 20) + ".png"
}

//отрисовывается ли объект: спрайт создаётся только для объектов в отрисованных комнатах
//(obj[6] — индекс в screenPic, ставится в createRoom). V55: проверка на truthy — в screenPic
//бывают «надгробия» (null) вместо удалённых спрайтов (heroMove.acidTick, drag.unEquip)
function objDrawn(o) {
    return o[6] !== undefined && !!screenPic[o[6]]
}

//зона наведения объекта — его сетка на карте; столб призыва рисуется 32×81 с подъёмом (createRoom)
function objHitTest(o, wx, wy) {
    const pillar = o[2] === 15
    const x = o[0] * 32
    const y = pillar ? o[1] * 32 + 32 - 81 : o[1] * 32
    const w = pillar ? 32 : o[3] * 32
    const h = pillar ? 81 : o[4] * 32
    return wx >= x && wx <= x + w && wy >= y && wy <= y + h
}

//живой объект: ещё числится в level.objects (уничтоженные контейнеры сплайсятся) и отрисован
function objAlive(o) {
    return dataGeneric.scenes[status.levelFloor].objects.indexOf(o) !== -1 && objDrawn(o)
}

function openWindow(h) {
    hovered = h
    const isEnemy = h.kind === "enemy"
    //карточка объекта берётся из data.objectsLib по id; нет записи (данные неполны) — как «???»
    const ob = isEnemy ? null : data.objectsLib.find(e => e.id === h.id)
    const unlocked = isEnemy
        ? (status.meta.library || [])[h.d.class.id] > 0
        : (status.meta.libraryObjects || [])[h.id] > 0 && !!ob
    const col = unlocked ? COL : COL_DIM
    winNodes.push({"el": rect(svgArr[2], winX, winY, CARD_W, CARD_H, COL, "1px", "rgba(16,12,10,0.92)", {"rx":"6px"}), "dx": 0, "dy": 0})
    winNodes.push({"el": text(svgArr[2], winX + CARD_W / 2, winY + NAME_Y, "0pt", "50pt", "black", "2px", col, unlocked ? T(isEnemy ? h.d.class.name : ob.name) : "???", {"size": NAME_SIZE, "font": "baseFont4", "anchor": "middle"}), "dx": CARD_W / 2, "dy": NAME_Y})
    if (isEnemy) {
        //анимация спереди: кадр листа вписан в коробку ≤160×84 и центрирован (как в Библиотеке)
        let anim = h.d.class.anims[0].move[1]
        let frameRaw = anim.w / anim.times
        let fit = Math.min(ANIM_MAX_W / frameRaw, ANIM_MAX_H / anim.h)
        let sheetW = Math.round(anim.w * fit)
        let frameW = sheetW / anim.times
        let fh = Math.round(anim.h * fit)
        let sx = winX + CARD_W / 2 - frameW / 2, sy = winY + ANIM_Y
        let img = image(svgArr[2], sx, sy, sheetW, fh, anim.img, {"times": anim.times, "id": "ehA" + (ehId++), "frame": 1})
        !unlocked && (img.style.filter = "brightness(0)") //чёрный силуэт для неубитого
        cardImg = img
        winNodes.push({"el": img, "dx": CARD_W / 2 - frameW / 2, "dy": ANIM_Y, "pooled": true})
        cardAnim = {"counter": 60 / anim.speed, "reset": 60 / anim.speed, "still": 1, "times": anim.times, "frameW": frameW}
        if (unlocked) {
            let s = h.d.stats //фактические статы (с усилениями главы)
            let rows = [
                [T("eh.hp",s.hp), T("eh.vision",s.range)],
                [T("eh.dmg",s.dmg[0],s.dmg[1]), T("eh.stun",s.noStunTime)],
                [T("eh.speed",s.speed), T("eh.attack",T(data.attacks[h.d.class.attacks[0]].name))]
            ]
            for (let i = 0; i < rows.length; i++) {
                let ly = STAT_Y + i * STAT_STEP
                winNodes.push({"el": fitText(text(svgArr[2], winX + STAT_LX, winY + ly, "0pt", "50pt", "black", "2px", COL, rows[i][0], {"size": STAT_SIZE, "font": "baseFont4"}), STAT_LW), "dx": STAT_LX, "dy": ly})
                winNodes.push({"el": fitText(text(svgArr[2], winX + STAT_RX, winY + ly, "0pt", "50pt", "black", "2px", COL, rows[i][1], {"size": STAT_SIZE, "font": "baseFont4"}), STAT_RW), "dx": STAT_RX, "dy": ly})
                i === 0 && (cardHpText = winNodes[winNodes.length - 2].el) //«Жизни: …» — обновляется каждый тик
            }
            //способность: нативный html-блок с переносом по словам (R4.4)
            let desc = abilityDesc(s)
            if (desc) {
                let fo = nativeHtml(svgArr[2], winX + STAT_LX, winY + ABIL_Y, CARD_W - STAT_LX * 2, ABIL_H, "black", "2px", COL, desc, {"size": ABIL_SIZE, "font": "baseFont4"})
                winNodes.push({"el": fo, "dx": STAT_LX, "dy": ABIL_Y})
            }
            cardHpLast = T("eh.hp",s.hp)
        }
        return
    }
    //V48: объект — статичный спрайт в коробке ≤160×110 (размеры отрисовки как на карте)
    let fit = Math.min(ANIM_MAX_W / ob.w, OBJ_MAX_H / ob.h)
    let w = Math.round(ob.w * fit), fh = Math.round(ob.h * fit)
    let sx = winX + CARD_W / 2 - w / 2, sy = winY + ANIM_Y
    let img = image(svgArr[2], sx, sy, w, fh, objImgSrc(h.o), {"id": "ehO" + (ehId++)})
    !unlocked && (img.style.filter = "brightness(0)") //чёрный силуэт для неиспользованного
    winNodes.push({"el": img, "dx": CARD_W / 2 - w / 2, "dy": ANIM_Y})
    if (unlocked) {
        //эффект: нативный html-блок с переносом по словам (R4.4)
        let fo = nativeHtml(svgArr[2], winX + STAT_LX, winY + OBJ_DESC_Y, CARD_W - STAT_LX * 2, OBJ_DESC_H, "black", "2px", COL, T(ob.desc), {"size": ABIL_SIZE, "font": "baseFont4"})
        winNodes.push({"el": fo, "dx": STAT_LX, "dy": OBJ_DESC_Y})
    }
}

function closeWindow() {
    for (let i = 0; i < winNodes.length; i++) {
        winNodes[i].pooled ? releaseSprite(winNodes[i].el) : winNodes[i].el.remove()
    }
    winNodes = []
    cardImg = null
    cardAnim = null
    cardHpText = null
    cardHpLast = ""
    hovered = null
}

//окно ставится на позицию курсора (viewBox UI) со сдвигом вправо-вниз; у правого края
//переворачивается влево, по вертикали кламп к верхней/нижней кромке
function placeWindow() {
    winX = status.mouseX + CUR_DX
    if (winX + CARD_W > 1920 - EDGE) winX = status.mouseX - CARD_W - CUR_DX
    winX < EDGE && (winX = EDGE)
    winY = status.mouseY + CUR_DY
    winY + CARD_H > 1080 - EDGE && (winY = 1080 - CARD_H - EDGE)
    winY < EDGE && (winY = EDGE)
    for (let i = 0; i < winNodes.length; i++) {
        let n = winNodes[i]
        n.pooled ? spritePos(n.el, winX + n.dx, winY + n.dy) : (n.el.setAttribute("x", winX + n.dx), n.el.setAttribute("y", winY + n.dy))
    }
}

//главный тик — из gameLoop каждый тик БЕЗУСЛОВНО (до блока паузы): гасит окно при панелях/
//паузе/выходе из забега, ищет врага/объект под курсором, следит за живостью текущей цели
function enemyHoverTick() {
    //V96: скрытый курсор = идёт движение героя — окно объектов/врагов не вызываем
    if (status.start !== 1 || status.panels !== 0 || status.pause !== 0 || isDragging() ||
        document.body.style.cursor === "none") {
        hovered && closeWindow()
        return
    }
    const [wx, wy] = mouseWorld()
    if (hovered) {
        if (hovered.kind === "enemy") {
            if (!alive(hovered.d) || !hitTest(hovered.d, wx, wy)) {
                closeWindow()
                return
            }
            //живое HP и кадр анимации карточки обновляются каждый тик, окно следует за курсором
            if (cardHpText) {
                let line = T("eh.hp",Math.max(0, Math.ceil(hovered.d.stats.hp)))
                if (line !== cardHpLast) {
                    cardHpLast = line
                    cardHpText.textContent = line
                }
            }
            cardAnim && --cardAnim.counter <= 0 && (cardAnim.counter = cardAnim.reset, cardAnim.still = (cardAnim.still + 1) % cardAnim.times, cardImg && (cardImg._shift = cardAnim.frameW * cardAnim.still))
        } else {
            //V48: объект статичен — следим только за живостью (уничтоженные сплайсятся) и попаданием
            if (!objAlive(hovered.o) || !objHitTest(hovered.o, wx, wy)) {
                closeWindow()
                return
            }
        }
        placeWindow()
        return
    }
    //окна нет — сначала враг под курсором с конца objectValues (верхний отрисованный побеждает,
    //враги рисуются поверх объектов), затем объекты уровня
    for (let i = objectValues.length - 1; i >= 0; i--) {
        const d = objectValues[i]
        if (d && d.type === "enemy" && d.stats && d.stats.hp > 0 && hitTest(d, wx, wy)) {
            openWindow({"kind": "enemy", "d": d})
            placeWindow()
            return
        }
    }
    const objs = dataGeneric.scenes[status.levelFloor].objects
    for (let i = 0; i < objs.length; i++) {
        const o = objs[i]
        //V64: у Портала (18) и Рычага (19) карточек в Библиотеке нет — ховер-окно не открываем.
        //V83: у кнопки загадки (21) карточки тоже нет
        if (o[2] === 18 || o[2] === 19 || o[2] === 21) continue
        if (objDrawn(o) && objHitTest(o, wx, wy)) {
            openWindow({"kind": "object", "o": o, "id": objId(o)})
            placeWindow()
            return
        }
    }
}

//сброс при смене сцены (del.js): слой svgArr[2] вычищен целиком — узлы удалять нечем,
//гасим состояние модуля (remove() по отцеплённым узлам безвреден, но не нужен)
function resetEnemyHover() {
    winNodes = []
    cardImg = null
    cardAnim = null
    cardHpText = null
    cardHpLast = ""
    hovered = null
}

//нажатие ЛЮБОЙ клавиши гасит окно (постановка V47)
document.addEventListener("keydown", () => {
    hovered && closeWindow()
})

//тестовый доступ (по образцу libraryProbe): состояние окна без лазания по DOM
function enemyHoverProbe() {
    const ob = hovered && hovered.kind === "object" ? data.objectsLib.find(e => e.id === hovered.id) : null
    return {
        "open": hovered !== null,
        "kind": hovered ? hovered.kind : null,
        "name": hovered ? (hovered.kind === "enemy" ? hovered.d.class.name : ob ? ob.name : "???") : null,
        "unlocked": hovered
            ? (hovered.kind === "enemy"
                ? (status.meta.library || [])[hovered.d.class.id] > 0
                : (status.meta.libraryObjects || [])[hovered.id] > 0)
            : null,
        "nodes": winNodes.length,
        "x": winX, "y": winY
    }
}

export {enemyHoverTick, resetEnemyHover, enemyHoverProbe}
