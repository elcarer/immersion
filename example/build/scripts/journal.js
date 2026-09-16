//V37: журнал (кнопка 3, ./images/UI/panels/buttons/icon3.png) — лог событий забега.
//Панель lib.png по центру, заголовок «ЖУРНАЛ», строки событий в цветах по типу события
//(палитра игры), справа полоса прокрутки (колесо мыши над панелью + перетаскивание ползунка +
//клики по треку). Слой строк обрезается клипом по зоне просмотра — при скролле строки не
//выезжают за верхнюю/нижнюю границу зоны (механика Библиотеки V36: клип на РОДИТЕЛЬСКОЙ
//группе, не на самих узлах — Chrome тащит клип элемента за его transform).
//Строки пишет journalAdd(text, color) — её вызывают игровые скрипты в момент события
//(урон, убийство+опыт, уровень, предметы, ловушки, статусы, этаж, гибель).
//Хранилище — status.info.log: info пересоздаётся в sceneGenerate только на НОВЫЙ забег
//(смены этажа внутри забега его сохраняют), поэтому журнал живёт ровно один забег.
//Открытие — автоскролл к низу (свежие события). Игра на паузе (как инвентарь/карта).
import { status } from "../scripts/start.js"
import { T } from "../scripts/localization.js"
import { svgArr, image, text, rect, releaseSprite, getCTM } from "../scripts/svg.js"
import { playback, strike, musicDuck } from "../scripts/sound.js"

//геометрия — как у Библиотеки (та же панель lib.png, view 1920×1080)
const PANEL_X = 92, PANEL_Y = 142, PANEL_W = 1735, PANEL_H = 843
const VIEW_X = 122, VIEW_Y = 238, VIEW_W = 1568, VIEW_H = 672
const TRACK_X = VIEW_X + VIEW_W + 10 //1700
const TRACK_W = 14
const ROW_H = 68                  //высота строки журнала (V37 доводка: ×2 вместе со шрифтом)
const ROW_X = VIEW_X + 28         //отступ текста строк слева
const ROW_SIZE = 44               //шрифт строки (V37 доводка: ×2 для читаемости, фидбек игрока)
const ROW_MAX_W = VIEW_W - 70     //лимит ширины строки (не залезать под трек)
const COL = "rgb(204, 153, 102)"  //фирменный цвет панелей
const COL_DIM = "rgb(110, 90, 70)" //приглушённый цвет плейсхолдера
const LOG_MAX = 200               //журнал помнит последние 200 событий
const NS = "http://www.w3.org/2000/svg"

//цвета строк — палитра игры (floatText/панели); экспорт для хуков
export const J_GREEN = "#33FF66"  //урон игрока врагу
export const J_RED = "#CD5C5C"    //урон врага игроку, ловушка
export const J_STD = COL          //уровень, ключ (стандартный цвет надписей)
export const J_YELLOW = "#FFCC66" //убийство+опыт, золото
export const J_SCROLL = "#6666FF" //свиток
export const J_POISON = "#9966FF" //отравление героя
export const J_FIRE = "#FF6600"   //горение героя
export const J_CHARM = "#FF69B4"  //очарование героя (цвет «Очарован!» из charmFx)
export const J_FLOOR = "#66CCFF"  //отметка этажа
export const J_DEATH = "#FF2222"  //гибель героя
export const J_RARITY = [null, "grey", "#3300ff", "#9900ff", "#ffff66", "#FF0000"] //редкость предмета 1-5 (цвета takeDrop; 5 = реликвия V67, красный)

let journalTemp = [] //ВСЕ созданные узлы панели (для удаления и проверки closePanels)
let jNodes = []      //строки, ездящие со скроллом: {el, y}
let jGroup = null    //слой строк с клипом по зоне просмотра
let thumbEl = null, thumbH = 0, maxOff = 0, scrollOff = 0

//добавить событие в журнал. Вызывается из любых скриптов в любой момент; вне забега
//(info ещё не создан) молчит. Цвет не передан — стандартный.
function journalAdd(t, c) {
    let log = status.info && status.info.log
    if (!log) return
    log.push({"t": String(t), "c": c || J_STD})
    log.length > LOG_MAX && log.splice(0, log.length - LOG_MAX)
}

//подгонка размера шрифта под ширину строки: длинные «... урона от ...» не должны
//вылезать за панель; короткие строки остаются крупными
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

//регистрация строки, ездящей со скроллом (базовая позиция = позиция при scrollOff 0);
//одновременно попадает в journalTemp — иначе journalDel не удалит строки (грабля V35)
function regNode(el, y) {
    journalTemp.push(el)
    jNodes.push({"el": el, "y": y})
}

//пересчёт позиций/видимости при скролле + ползунок (обрезку частичных строк делает клип слоя)
function applyScroll() {
    for (let i = 0; i < jNodes.length; i++) {
        let n = jNodes[i]
        let y = n.y - scrollOff
        let visible = y > VIEW_Y - ROW_H && y < VIEW_Y + VIEW_H + ROW_H
        if (!visible) {
            n.el.getAttribute("visibility") !== "hidden" && n.el.setAttribute("visibility", "hidden")
        } else {
            n.el.setAttribute("visibility", "visible")
            n.el.setAttribute("y", y)
        }
    }
    thumbEl && maxOff > 0 && thumbEl.setAttribute("y", VIEW_Y + (VIEW_H - thumbH) * scrollOff / maxOff)
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

function journal() {
    journalDel(1)
    status.move = 0
    status.pause = 1
    status.panels = 8
    musicDuck(1)
    scrollOff = 0
    journalTemp.push(image(svgArr[2], PANEL_X, PANEL_Y, PANEL_W, PANEL_H, "./images/UI/panels/lib.png"))
    journalTemp.push(text(svgArr[2], 1920 / 2, 198, "0pt", "50pt", "black", "2px", COL, T("journal.title"), {"id": "delItemText", "size": 60, "font": "baseFont4", "anchor": "middle"}))
    //слой строк с клипом по зоне просмотра — строки, выезжающие при скролле за верхнюю/
    //нижнюю границу зоны, срезаются клипом (сами узлы продолжают ездить внутри слоя)
    let defs = document.createElementNS(NS, "defs")
    let clip = document.createElementNS(NS, "clipPath")
    clip.setAttribute("id", "journalClip")
    let clipRect = document.createElementNS(NS, "rect")
    clipRect.setAttribute("x", VIEW_X)
    clipRect.setAttribute("y", VIEW_Y)
    clipRect.setAttribute("width", VIEW_W)
    clipRect.setAttribute("height", VIEW_H)
    clip.appendChild(clipRect)
    defs.appendChild(clip)
    jGroup = document.createElementNS(NS, "g")
    jGroup.setAttribute("clip-path", "url(#journalClip)")
    svgArr[2].appendChild(defs)
    svgArr[2].appendChild(jGroup)
    journalTemp.push(defs)
    journalTemp.push(jGroup)
    let log = (status.info && status.info.log) || []
    if (log.length === 0) {
        journalTemp.push(text(svgArr[2], VIEW_X + VIEW_W / 2, VIEW_Y + 60, "0pt", "50pt", "black", "2px", COL_DIM, T("journal.empty"), {"size": 24, "font": "baseFont4", "anchor": "middle"}))
        maxOff = 0
        thumbEl = null
    } else {
        for (let i = 0; i < log.length; i++) {
            let y = VIEW_Y + i * ROW_H + 48
            regNode(fitText(text(jGroup, ROW_X, y, "0pt", "50pt", "black", "2px", log[i].c, log[i].t, {"size": ROW_SIZE, "font": "baseFont4"}), ROW_MAX_W), y)
        }
        let totalH = log.length * ROW_H
        maxOff = Math.max(0, totalH - VIEW_H)
        //полоса прокрутки: трек (клик — страница вверх/вниз) + ползунок (перетаскивание);
        //листать нечего (короткий журнал) — трека и ползунка нет (иначе деление на maxOff=0)
        if (maxOff > 0) {
            thumbH = Math.max(48, Math.round(VIEW_H * VIEW_H / totalH))
            let track = rect(svgArr[2], TRACK_X, VIEW_Y, TRACK_W, VIEW_H, COL, "1px", "rgba(0, 0, 0, 0.3)", {"func": () => {}})
            journalTemp.push(track)
            thumbEl = rect(svgArr[2], TRACK_X, VIEW_Y, TRACK_W, thumbH, "black", "1px", COL, {"func": () => {}})
            journalTemp.push(thumbEl)
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
        }
        //открытие — к свежим событиям (низ списка)
        scrollOff = maxOff
        applyScroll()
    }
    playback(strike[14].vol, 0, 0, 3 * status.settings.soundVolume)
}

function journalDel(nomusic = 0) {
    for (let i = 0; i < journalTemp.length; i++) {
        let el = journalTemp[i]
        el._slot ? releaseSprite(el) : el.remove()
    }
    journalTemp = []
    jNodes = []
    jGroup = null
    thumbEl = null
    status.move = 1
    status.panels = 0
    status.pause = 0
    nomusic === 0 && musicDuck(0)
}

//колесо мыши над зоной строк листает журнал (только пока панель открыта;
//зум-модуль в это время молчит — он требует pause===0). passive:false ОБЯЗАТЕЛЕН:
//document-wheel в Chrome пассивен по умолчанию — preventDefault без флага даёт
//«[Intervention] Unable to preventDefault inside passive event listener» на каждый скролл
document.addEventListener("wheel", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (status.panels !== 8 || journalTemp.length === 0) return
    if (status.mouseX < VIEW_X || status.mouseX > TRACK_X + TRACK_W || status.mouseY < VIEW_Y || status.mouseY > VIEW_Y + VIEW_H) return
    e.preventDefault()
    let d = e.deltaY
    e.deltaMode === 1 && (d *= 33)
    setScroll(scrollOff + d)
}, {"passive": false})

//тестовый доступ (по образцу libraryProbe): состояние панели без лазания по DOM
function journalProbe() {
    return {
        "open": journalTemp.length > 0,
        "rows": jNodes.length,
        "count": status.info && status.info.log ? status.info.log.length : 0,
        "scroll": scrollOff,
        "maxOff": maxOff,
        "thumbY": thumbEl ? Number(thumbEl.getAttribute("y")) : null,
        "clip": jGroup !== null
    }
}

export {journal, journalDel, journalTemp, journalAdd, journalProbe}
