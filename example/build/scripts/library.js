//V36: библиотека (кнопка 5, ./images/UI/panels/buttons/icon5.png) — база знаний о монстрах.
//Панель lib.png по центру, заголовок «Библиотека», карточки врагов 2 ряда × 4 столбца,
//справа полоса прокрутки (колесо мыши над панелью + перетаскивание ползунка + клики по треку).
//V36: слой карточек обрезается клипом по зоне просмотра — при скролле карточки не выезжают
//за верхнюю/нижнюю границы сетки (частично видимые ряды срезаются по границе зоны).
//Раскрытый враг (meta.library[id] > 0 — зачёт библиотеки живёт между забегами, в отличие от
//забегного killedEnemes, который сбрасывается в metaItems) показан анимацией движения спереди
//(видимый кадр центрирован в ячейке по горизонтали, спрайт-пул V15) и статами в 2 колонки
//(слева жизни/урон/скорость, справа зоркость/устойчивость/атака) крупным шрифтом; способность —
//ниже колонок во всю ширину с переносом строк. Неубитый — чёрным силуэтом (та же анимация под
//filter: brightness(0)) с именем «???» без статов.
//Игра на паузе (как инвентарь/карта), НО анимации карточек должны жить: тик игры стоит при
//pause=1, поэтому кадрами крутит собственный rAF-цикл модуля (при закрытии — cancel).
//V48a: строка описания врага = поле desc из data.js, показывается ВСЕГДА, когда оно есть
//(проверяем САМО поле desc, без требования ключа умения из старого списка — из-за того молчали
//Дворф, Отродье, Хаунд/howl, Босс-паук, Демон/summoning); БЕЗ префикса — решение пользователя.
//V48: второй режим «Объекты» — интерактивные объекты карты (useObject.js, раздел data.objectsLib).
//Справа от полосы прокрутки две кнопки 60×60 (enemyLib.png/objectLib.png): активная — полная
//непрозрачность, неактивная приглушена, у обеих подсветка при наведении (опция glow); клик
//пересобирает карточки, каждое открытие стартует в режиме «Враги». Карточка объекта: имя,
//статичный спрайт (вписан в коробку ≤160×110), эффект. Неиспользованный объект
//(meta.libraryObjects[id] === 0) — «???» и чёрный силуэт, как у врагов; id = тип + этаж*20
//(ловушка — одна карточка id 14 на все этажи, столб призыва — id 55).
//V52: третий режим «Достижения» (achievLib.png под кнопками врагов/объектов) — 8 карточек
//из ACH_LIST (achievements.js). Неоткрытое — «???» и чёрный силуэт без текста (название и
//текст открываются только после выполнения условий); открытое — название выделяющимся
//цветом (#FFCC66), текст стандартным цветом надписей (решения пользователя).
import { status } from "../scripts/start.js"
import { T } from "../scripts/localization.js"
import { data } from "../scripts/data.js"
import { svgArr, image, text, rect, textHtml, releaseSprite, spritePos, getCTM } from "../scripts/svg.js"
import { playback, strike, musicDuck } from "../scripts/sound.js"
//V52: реестр достижений (карточки третьего режима)
import { ACH_LIST } from "../scripts/achievements.js"

//плоский список всех врагов data.enemes (группы по порядку этажей; в парных группах — оба)
const LIB_ENEMES = (() => {
    let arr = []
    for (let g = 0; g < data.enemes.length; g++) {
        let group = data.enemes[g]
        for (let k = 0; k < group.length; k++) {
            group[k] && arr.push(group[k])
        }
    }
    return arr
})()
//V48: плоский список объектов для режима «Объекты» (data.objectsLib уже упорядочен: этажи 1→3,
//в конце ловушка и столб призыва)
const LIB_OBJECTS = data.objectsLib

//геометрия (viewBox 1920×1080): панель по центру, зона карточек, трек справа
const PANEL_X = 92, PANEL_Y = 142, PANEL_W = 1735, PANEL_H = 843
const VIEW_X = 122, VIEW_Y = 238, VIEW_W = 1568, VIEW_H = 672
const COLS = 4
const CARD_W = VIEW_W / COLS //392
const CARD_H = 336
const TRACK_X = VIEW_X + VIEW_W + 10 //1700
const TRACK_W = 14
const COL = "rgb(204, 153, 102)" //фирменный цвет панелей
const COL_DIM = "rgb(110, 90, 70)" //приглушённый цвет для «???»
const ACH_GOLD = "#FFCC66" //V52: выделяющийся цвет названия открытого достижения
//вёрстка карточки (V36): имя, анимация (видимый кадр ≤160×84, центр ячейки), статы в 2 колонки
//крупным шрифтом, способность ниже во всю ширину с переносом строк
const NAME_SIZE = 32, NAME_Y = 40
const ANIM_MAX_W = 160, ANIM_MAX_H = 84, ANIM_Y = 48
const STAT_SIZE = 32, STAT_Y = 166, STAT_STEP = 32
const STAT_LX = 32, STAT_RX = 186, STAT_LW = 150, STAT_RW = 182
const ABIL_SIZE = 24, ABIL_Y = 246, ABIL_H = 78
//V48: кнопки режимов (свободная полоса справа от трека 1714–1827) и вёрстка карточки объекта
const MODE_X = 1740, MODE_Y = VIEW_Y + 24
const OBJ_MAX_H = 110
const OBJ_DESC_Y = 186, OBJ_DESC_H = 130
const NS = "http://www.w3.org/2000/svg"

let libraryTemp = [] //ВСЕ созданные узлы панели (для удаления и проверки closePanels)
let libNodes = []    //узлы, ездящие со скроллом: {el, x, y, pooled}
let libCards = []    //диапазоны узлов карточек: {from, to, y0, y1} — прячутся вне зоны просмотра
let libAnims = []    //анимации карточек: {node, times, frameW, reset, counter, still}
let libGroup = null  //V36: слой карточек с клипом по зоне просмотра
let thumbEl = null, thumbH = 0, maxOff = 0, scrollOff = 0
let libId = 0 //монотонный счётчик id клипов спрайтов (не сбрасывается между открытиями)
let rafId = 0, lastTs = 0, tickAcc = 0
let libMode = "enemy"      //V48: текущий режим («enemy» — стартовый при каждом открытии)
let modeBtnEnemy = null, modeBtnObject = null, modeBtnAch = null //кнопки режимов
let libTotalH = 0          //V48: полная высота списка карточек текущего режима (для ползунка)

//V48a: описание врага — просто поле desc (data.js); нет desc → строка пропускается.
//V60a: desc — ключ локализации, переводим на месте показа (иначе в карточке виден сырой ключ)
function abilityDesc(stats) {
    return stats.desc ? T(stats.desc) : null
}

//подгонка размера шрифта под ширину колонки: редкие длинные значения («Атака: Бросок дубины»)
//не должны вылезать за свою колонку; короткие строки остаются крупными
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

//регистрация узла, ездящего со скроллом (базовая позиция = позиция при scrollOff 0);
//одновременно попадает в libraryTemp — иначе libraryDel не удалит карточки (баг первого прогона V35)
function regNode(el, x, y, pooled) {
    libraryTemp.push(el)
    libNodes.push({"el": el, "x": x, "y": y, "pooled": pooled})
}

function createCard(en, col, row, place) {
    let cardX = VIEW_X + col * CARD_W
    let cardY = VIEW_Y + row * CARD_H
    let from = libNodes.length
    let unlocked = (status.meta.library || [])[en.id] > 0
    //рамка ячейки
    regNode(rect(place, cardX + 14, cardY + 8, CARD_W - 28, CARD_H - 16, COL, "1px", "none"), cardX + 14, cardY + 8, false)
    //имя (неубитый — «???»)
    regNode(text(place, cardX + CARD_W / 2, cardY + NAME_Y, "0pt", "50pt", "black", "2px", unlocked ? COL : COL_DIM, unlocked ? T(en.name) : "???", {"size": NAME_SIZE, "font": "baseFont4", "anchor": "middle"}), cardX + CARD_W / 2, cardY + NAME_Y, false)
    //анимация движения спереди: у спрайт-пула видимое окно кадра = sheetW/times (лист «едет» под
    //окном через img.x), поэтому масштабируем КАДР (не весь лист) в коробку ≤160×84 и центрируем
    //по горизонтали именно окно кадра — в V35 центрировался весь лист и кадр уезжал от центра
    let anim = en.anims[0].move[1]
    let frameRaw = anim.w / anim.times
    let fit = Math.min(ANIM_MAX_W / frameRaw, ANIM_MAX_H / anim.h)
    let sheetW = Math.round(anim.w * fit)
    let frameW = sheetW / anim.times
    let fh = Math.round(anim.h * fit)
    let sx = Math.round(cardX + CARD_W / 2 - frameW / 2), sy = cardY + ANIM_Y
    let img = image(place, sx, sy, sheetW, fh, anim.img, {"times": anim.times, "id": "libA" + (libId++), "frame": 1})
    !unlocked && (img.style.filter = "brightness(0)") //чёрный силуэт для неубитого
    regNode(img, sx, sy, true)
    libAnims.push({"node": libNodes.length - 1, "times": anim.times, "frameW": frameW, "reset": 60 / anim.speed, "counter": 60 / anim.speed, "still": 1})
    if (unlocked) {
        let s = en.stats
        //статы в 2 колонки: слева жизни/урон/скорость, справа зоркость/устойчивость/атака
        let rows = [
            [T("eh.hp",s.hp), T("eh.vision",s.range)],
            [T("eh.dmg",s.dmg[0],s.dmg[1]), T("eh.stun",s.noStunTime)],
            [T("eh.speed",s.speed), T("eh.attack",T(data.attacks[en.attacks[0]].name))]
        ]
        for (let i = 0; i < rows.length; i++) {
            let ly = cardY + STAT_Y + i * STAT_STEP
            regNode(fitText(text(place, cardX + STAT_LX, ly, "0pt", "50pt", "black", "2px", COL, rows[i][0], {"size": STAT_SIZE, "font": "baseFont4"}), STAT_LW), cardX + STAT_LX, ly, false)
            regNode(fitText(text(place, cardX + STAT_RX, ly, "0pt", "50pt", "black", "2px", COL, rows[i][1], {"size": STAT_SIZE, "font": "baseFont4"}), STAT_RW), cardX + STAT_RX, ly, false)
        }
        //способность ниже колонок во всю ширину карточки: textHtml (foreignObject, как в tip.js,
        //где перенос pre-wrap работает). Причина бага «одной строкой»: div внутри foreignObject
        //получал ширину из вьюпорта foreignObject, а внутри клип-группы Chrome оставлял блок
        //шириной по содержимому — задаём ширину div ЯВНО, pre-wrap переносит по словам
        let desc = abilityDesc(s)
        if (desc) {
            let fo = textHtml(place, cardX + STAT_LX, cardY + ABIL_Y, CARD_W - STAT_LX * 2, ABIL_H, "black", "2px", COL, desc, {"size": ABIL_SIZE, "font": "baseFont4"})
            fo.firstChild.style.width = (CARD_W - STAT_LX * 2) + "px"
            regNode(fo, cardX + STAT_LX, cardY + ABIL_Y, false)
        }
    }
    libCards.push({"from": from, "to": libNodes.length - 1, "y0": cardY, "y1": cardY + CARD_H})
}

//V48: карточка объекта (режим «Объекты») — рамка, имя, статичный спрайт в коробке ≤160×110,
//у использованного — эффект; неиспользованный — «???» и чёрный силуэт (как у врагов)
function createObjectCard(ob, col, row, place) {
    let cardX = VIEW_X + col * CARD_W
    let cardY = VIEW_Y + row * CARD_H
    let from = libNodes.length
    let unlocked = (status.meta.libraryObjects || [])[ob.id] > 0
    //рамка ячейки
    regNode(rect(place, cardX + 14, cardY + 8, CARD_W - 28, CARD_H - 16, COL, "1px", "none"), cardX + 14, cardY + 8, false)
    //имя (неиспользованный — «???»)
    regNode(text(place, cardX + CARD_W / 2, cardY + NAME_Y, "0pt", "50pt", "black", "2px", unlocked ? COL : COL_DIM, unlocked ? T(ob.name) : "???", {"size": NAME_SIZE, "font": "baseFont4", "anchor": "middle"}), cardX + CARD_W / 2, cardY + NAME_Y, false)
    //статичный спрайт: вписан в коробку ≤160×110 (крупнее вражьей анимации — объекты квадратные)
    //и отцентрирован; размеры отрисовки — как на карте (клетки*32, формула createRoom)
    let fit = Math.min(ANIM_MAX_W / ob.w, OBJ_MAX_H / ob.h)
    let w = Math.round(ob.w * fit), h = Math.round(ob.h * fit)
    let sx = Math.round(cardX + CARD_W / 2 - w / 2), sy = cardY + ANIM_Y
    let img = image(place, sx, sy, w, h, ob.img, {"id": "libO" + (libId++)})
    !unlocked && (img.style.filter = "brightness(0)") //чёрный силуэт для неиспользованного
    regNode(img, sx, sy, false)
    if (unlocked) {
        //эффект: foreignObject с ЯВНОЙ шириной div (перенос по словам — приём из карточки врага)
        let fo = textHtml(place, cardX + STAT_LX, cardY + OBJ_DESC_Y, CARD_W - STAT_LX * 2, OBJ_DESC_H, "black", "2px", COL, T("lib.effect",T(ob.desc)), {"size": ABIL_SIZE, "font": "baseFont4"})
        fo.firstChild.style.width = (CARD_W - STAT_LX * 2) + "px"
        regNode(fo, cardX + STAT_LX, cardY + OBJ_DESC_Y, false)
    }
    libCards.push({"from": from, "to": libNodes.length - 1, "y0": cardY, "y1": cardY + CARD_H})
}

//V52: карточка достижения (режим «Достижения») — рамка, имя, иконка (60×60 растянута до
//100×100 в центре ячейки), текст. Неоткрытое — «???», чёрный силуэт, без текста;
//открытое — имя золотом (выделяющийся цвет), текст стандартным цветом надписей
function createAchCard(ach, col, row, place) {
    let cardX = VIEW_X + col * CARD_W
    let cardY = VIEW_Y + row * CARD_H
    let from = libNodes.length
    let idx = ACH_LIST.indexOf(ach)
    let unlocked = (status.meta.achievements || [])[idx] > 0
    //рамка ячейки
    regNode(rect(place, cardX + 14, cardY + 8, CARD_W - 28, CARD_H - 16, COL, "1px", "none"), cardX + 14, cardY + 8, false)
    //имя (неоткрытое — «???»)
    regNode(text(place, cardX + CARD_W / 2, cardY + NAME_Y, "0pt", "50pt", "black", "2px", unlocked ? ACH_GOLD : COL_DIM, unlocked ? T(ach.name) : "???", {"size": NAME_SIZE, "font": "baseFont4", "anchor": "middle"}), cardX + CARD_W / 2, cardY + NAME_Y, false)
    //иконка достижения
    let sx = Math.round(cardX + CARD_W / 2 - 50), sy = cardY + ANIM_Y + 5
    let img = image(place, sx, sy, 100, 100, "./images/UI/panels/buttons/achievLib.png", {"id": "libAch" + (libId++)})
    !unlocked && (img.style.filter = "brightness(0)") //чёрный силуэт для неоткрытого
    regNode(img, sx, sy, false)
    if (unlocked) {
        //текст: foreignObject с ЯВНОЙ шириной div (перенос по словам — приём карточки врага)
        let fo = textHtml(place, cardX + STAT_LX, cardY + OBJ_DESC_Y, CARD_W - STAT_LX * 2, OBJ_DESC_H, "black", "2px", COL, T(ach.desc), {"size": ABIL_SIZE, "font": "baseFont4"})
        fo.firstChild.style.width = (CARD_W - STAT_LX * 2) + "px"
        regNode(fo, cardX + STAT_LX, cardY + OBJ_DESC_Y, false)
    }
    libCards.push({"from": from, "to": libNodes.length - 1, "y0": cardY, "y1": cardY + CARD_H})
}

//пересчёт позиций/видимости при скролле + ползунок (обрезку частичных рядов делает клип слоя)
function applyScroll() {
    for (let i = 0; i < libCards.length; i++) {
        let c = libCards[i]
        let visible = c.y0 - scrollOff < VIEW_Y + VIEW_H && c.y1 - scrollOff > VIEW_Y
        for (let j = c.from; j <= c.to; j++) {
            let n = libNodes[j]
            if (!visible) {
                n.el.getAttribute("visibility") !== "hidden" && n.el.setAttribute("visibility", "hidden")
            } else {
                n.el.setAttribute("visibility", "visible")
                n.pooled ? spritePos(n.el, n.x, n.y - scrollOff) : n.el.setAttribute("y", n.y - scrollOff)
            }
        }
    }
    //V52: режим «Достижения» — 8 карточек ровно по высоте зоны (maxOff=0): деление давало NaN
    thumbEl && thumbEl.setAttribute("y", maxOff > 0 ? VIEW_Y + (VIEW_H - thumbH) * scrollOff / maxOff : VIEW_Y)
}

function setScroll(v) {
    let nv = Math.max(0, Math.min(maxOff, Math.round(v)))
    if (nv === scrollOff) return
    scrollOff = nv
    applyScroll()
}

//в координаты viewBox из клиентских (кэшированный CTM UI-слоя)
function viewY(clientY) {
    let ctm = getCTM()
    return ctm ? (clientY - ctm.f) / ctm.d : 0
}

//кадры анимаций карточек: собственный rAF (тик игры стоит на паузе), шаг 16мс как у движка
function tickLib(ts) {
    rafId = requestAnimationFrame(tickLib)
    if (!lastTs) { lastTs = ts; return }
    tickAcc += ts - lastTs
    lastTs = ts
    if (tickAcc > 100) tickAcc = 16
    while (tickAcc >= 16) {
        tickAcc -= 16
        for (let i = 0; i < libAnims.length; i++) {
            let a = libAnims[i]
            if (--a.counter > 0) continue
            a.counter = a.reset
            a.still = (a.still + 1) % a.times
            let n = libNodes[a.node]
            n.el._shift = a.frameW * a.still
            spritePos(n.el, n.x, n.y - scrollOff)
        }
    }
}

//V48: снять карточки текущего режима (панель и кнопки режимов остаются): пул возвращается,
//обычные узлы удаляются, из libraryTemp вычищаются тоже — regNode кладёт туда всё
function clearCards() {
    let cardEls = new Set(libNodes.map(n => n.el))
    for (let i = 0; i < libNodes.length; i++) {
        let n = libNodes[i]
        n.pooled ? releaseSprite(n.el) : n.el.remove()
    }
    libraryTemp = libraryTemp.filter(el => !cardEls.has(el))
    libNodes = []
    libCards = []
    libAnims = []
}

//V48: сборка карточек текущего режима + пересчёт диапазона скролла
function buildCards() {
    let list = libMode === "object" ? LIB_OBJECTS : libMode === "ach" ? ACH_LIST : LIB_ENEMES
    libTotalH = Math.ceil(list.length / COLS) * CARD_H
    maxOff = Math.max(0, libTotalH - VIEW_H)
    for (let i = 0; i < list.length; i++) {
        libMode === "object"
            ? createObjectCard(list[i], i % COLS, Math.trunc(i / COLS), libGroup)
            : libMode === "ach"
                ? createAchCard(list[i], i % COLS, Math.trunc(i / COLS), libGroup)
                : createCard(list[i], i % COLS, Math.trunc(i / COLS), libGroup)
    }
}

//V48: высота ползунка зависит от размера списка режима (у объектов карточек больше) —
//пересчитывается и при открытии, и при смене режима
function updateThumb() {
    thumbH = Math.max(48, Math.round(VIEW_H * VIEW_H / libTotalH))
    thumbEl && thumbEl.setAttribute("height", thumbH)
}

//V48: активная кнопка режима — полная непрозрачность, неактивная приглушена
function updateModeButtons() {
    modeBtnEnemy && modeBtnEnemy.setAttribute("opacity", libMode === "enemy" ? 1 : 0.45)
    modeBtnObject && modeBtnObject.setAttribute("opacity", libMode === "object" ? 1 : 0.45)
    modeBtnAch && modeBtnAch.setAttribute("opacity", libMode === "ach" ? 1 : 0.45)
}

//V48: переключение режима Библиотеки (клики по кнопкам справа от полосы прокрутки)
function setMode(m) {
    if (m === libMode) return
    libMode = m
    scrollOff = 0
    clearCards()
    buildCards()
    updateThumb()
    updateModeButtons()
    applyScroll()
    playback(strike[5].vol, 0, 0, status.settings.soundVolume)
}

function library() {
    libraryDel(1)
    status.move = 0
    status.pause = 1
    status.panels = 7
    musicDuck(1)
    scrollOff = 0
    libraryTemp.push(image(svgArr[2], PANEL_X, PANEL_Y, PANEL_W, PANEL_H, "./images/UI/panels/lib.png"))
    libraryTemp.push(text(svgArr[2], 1920 / 2, 198, "0pt", "50pt", "black", "2px", COL, T("lib.title"), {"id": "delItemText", "size": 60, "font": "baseFont4", "anchor": "middle"}))
    //V36: слой карточек с клипом по зоне просмотра — карточки, выезжающие при скролле за
    //верхнюю/нижнюю границу сетки, срезаются клипом (сами узлы продолжают ездить внутри слоя)
    let defs = document.createElementNS(NS, "defs")
    let clip = document.createElementNS(NS, "clipPath")
    clip.setAttribute("id", "libClip")
    let clipRect = document.createElementNS(NS, "rect")
    clipRect.setAttribute("x", VIEW_X)
    clipRect.setAttribute("y", VIEW_Y)
    clipRect.setAttribute("width", VIEW_W)
    clipRect.setAttribute("height", VIEW_H)
    clip.appendChild(clipRect)
    defs.appendChild(clip)
    libGroup = document.createElementNS(NS, "g")
    libGroup.setAttribute("clip-path", "url(#libClip)")
    svgArr[2].appendChild(defs)
    svgArr[2].appendChild(libGroup)
    libraryTemp.push(defs)
    libraryTemp.push(libGroup)
    //V48: кнопки режимов в свободной полосе справа от трека; каждый открытие стартует «Врагами»
    libMode = "enemy"
    modeBtnEnemy = image(svgArr[2], MODE_X, MODE_Y, 60, 60, "./images/UI/panels/buttons/enemyLib.png", {"glow":1, "id":"libModeE", "func": () => setMode("enemy")})
    libraryTemp.push(modeBtnEnemy)
    modeBtnObject = image(svgArr[2], MODE_X, MODE_Y + 70, 60, 60, "./images/UI/panels/buttons/objectLib.png", {"glow":1, "id":"libModeO", "func": () => setMode("object")})
    libraryTemp.push(modeBtnObject)
    //V52: третья кнопка режимов — «Достижения» (под врагами/объектами)
    modeBtnAch = image(svgArr[2], MODE_X, MODE_Y + 140, 60, 60, "./images/UI/panels/buttons/achievLib.png", {"glow":1, "id":"libModeA", "func": () => setMode("ach")})
    libraryTemp.push(modeBtnAch)
    updateModeButtons()
    buildCards()
    updateThumb()
    //полоса прокрутки: трек (клик — страница вверх/вниз) + ползунок (перетаскивание)
    let track = rect(svgArr[2], TRACK_X, VIEW_Y, TRACK_W, VIEW_H, COL, "1px", "rgba(0, 0, 0, 0.3)", {"func": () => {}})
    libraryTemp.push(track)
    thumbEl = rect(svgArr[2], TRACK_X, VIEW_Y, TRACK_W, thumbH, "black", "1px", COL, {"func": () => {}})
    libraryTemp.push(thumbEl)
    track.onclick = (e) => {
        let y = viewY(e.clientY)
        setScroll(scrollOff + (y < Number(thumbEl.getAttribute("y")) + thumbH / 2 ? -VIEW_H : VIEW_H))
        playback(strike[5].vol, 0, 0, status.settings.soundVolume)
    }
    thumbEl.addEventListener("mousedown", (e) => {
        let grab = viewY(e.clientY) - Number(thumbEl.getAttribute("y"))
        let move = (ev) => { setScroll((viewY(ev.clientY) - VIEW_Y - grab) * maxOff / (VIEW_H - thumbH)) }
        let up = () => {
            document.removeEventListener("mousemove", move)
            document.removeEventListener("mouseup", up)
        }
        document.addEventListener("mousemove", move)
        document.addEventListener("mouseup", up)
        e.preventDefault()
    })
    lastTs = 0
    tickAcc = 0
    rafId = requestAnimationFrame(tickLib)
    applyScroll()
    playback(strike[14].vol, 0, 0, 3 * status.settings.soundVolume)
}

function libraryDel(nomusic = 0) {
    if (rafId) cancelAnimationFrame(rafId)
    rafId = 0
    for (let i = 0; i < libraryTemp.length; i++) {
        let el = libraryTemp[i]
        el._slot ? releaseSprite(el) : el.remove()
    }
    libraryTemp = []
    libNodes = []
    libCards = []
    libAnims = []
    libGroup = null
    thumbEl = null
    modeBtnEnemy = null
    modeBtnObject = null
    modeBtnAch = null
    status.move = 1
    status.panels = 0
    status.pause = 0
    nomusic === 0 && musicDuck(0)
}

//колесо мыши над зоной карточек листает библиотеку (только пока панель открыта;
//зум-модуль в это время молчит — он требует pause===0). passive:false ОБЯЗАТЕЛЕН:
//document-wheel в Chrome пассивен по умолчанию — preventDefault без флага даёт
//«[Intervention] Unable to preventDefault inside passive event listener» на каждый скролл
document.addEventListener("wheel", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (status.panels !== 7 || libraryTemp.length === 0) return
    if (status.mouseX < VIEW_X || status.mouseX > TRACK_X + TRACK_W || status.mouseY < VIEW_Y || status.mouseY > VIEW_Y + VIEW_H) return
    e.preventDefault()
    let d = e.deltaY
    e.deltaMode === 1 && (d *= 33)
    setScroll(scrollOff + d)
}, {"passive": false})

//тестовый доступ (по образцу charmProbe): состояние панели без лазания по DOM
function libraryProbe() {
    return {
        "open": libraryTemp.length > 0,
        "mode": libMode,
        "cards": libCards.length,
        "anims": libAnims.length,
        "scroll": scrollOff,
        "maxOff": maxOff,
        "thumbY": thumbEl ? Number(thumbEl.getAttribute("y")) : null,
        "clip": libGroup !== null
    }
}

export {library, libraryDel, libraryTemp, libraryProbe}
