// ============================================================================
// controls.js — V126: панель «Управление» (вызывается из НАСТРОЕК). Переназначение
// кнопок клавиатуры (у КАЖДОГО игрока свои) и геймпада (общая схема кнопок; сами
// пады распределены по игрокам слотами — devices.js padIndex). Хранение —
// status.settings.bindings (слот settings, saveSettings), формат в devices.js.
// Захват: клик по ячейке → «Нажмите клавишу…» (первое keydown; Esc — отмена) или
// «Нажмите кнопку пада…» (опрос гейпадов 5с; берётся НОВАЯ нажатая кнопка).
// Конфликты внутри одного профиля решаются переносом: код уходит с прежнего действия.
// ============================================================================
import { status } from "../scripts/start.js"
import { svgArr,image, text, rect } from "../scripts/svg.js"
import { musicDuck } from "../scripts/sound.js"
import { saveSettings } from "../scripts/save.js"
import { T } from "../scripts/localization.js"
import { bindingsTemplate, kbKeys, padBtn, DEVICE_KEYS } from "../scripts/devices.js"

let controlsTemp = []
//активный захват: {"kind":"kb","pi","action"} | {"kind":"pad","action"} | null
let capture = null
let captureKey = null
let padPollTimer = null
let padPollTimeout = null
let padPollPrev = null

//строки-действия таблицы: [ключ локализации, действие kb или null, действие пада или null]
const ROWS = [
    ["controls.up","up",null],
    ["controls.down","down",null],
    ["controls.left","left",null],
    ["controls.right","right",null],
    ["controls.equip","equip","equip"],
    ["controls.map","map","map"],
    ["controls.journal","journal","journal"],
    ["controls.settings","settings","settings"],
    ["controls.library","library","library"],
    ["controls.cancel",null,"cancel"],
    ["controls.click",null,"click"],
    ["controls.drag",null,"drag"]
]
//короткая подпись кода клавиши
function keyLabel(code) {
    if (!code) return "—"
    const MAP = {"ArrowUp":"↑","ArrowDown":"↓","ArrowLeft":"←","ArrowRight":"→","Comma":",","Period":".",
        "Slash":"/","Semicolon":";","Quote":"'","Backspace":"⌫","Space":"ПРОБЕЛ","Minus":"-","Equal":"=",
        "BracketLeft":"[","BracketRight":"]","Enter":"ENTER","ShiftLeft":"SHIFT","ShiftRight":"SHIFT",
        "ControlLeft":"CTRL","ControlRight":"CTRL","AltLeft":"ALT","AltRight":"ALT","Tab":"TAB","CapsLock":"CAPS"}
    if (MAP[code]) return MAP[code]
    if (code.startsWith("Key")) return code.slice(3)
    if (code.startsWith("Digit")) return code.slice(5)
    if (code.startsWith("Numpad")) return "NUM" + code.slice(6)
    return code
}
//короткая подпись кнопки пада (стандартная раскладка)
function padLabel(idx) {
    const NAMES = {"0":"A","1":"B","2":"X","3":"Y","4":"LB","5":"RB","6":"LT","7":"RT","8":"BACK","9":"START",
        "10":"LS","11":"RS","12":"↑","13":"↓","14":"←","15":"→"}
    return NAMES[String(idx)] || ("B" + idx)
}
//долив недостающих полей дефолтами (старые сейвы/частичная перенастройка)
function ensureBindings() {
    const t = bindingsTemplate()
    const b = status.settings.bindings || {}
    for (const pk of ["p0","p1","pad"]) {
        b[pk] = b[pk] || {}
        for (const k of Object.keys(t[pk])) if (b[pk][k] === undefined) b[pk][k] = t[pk][k]
    }
    status.settings.bindings = b
}
//эффективная клавиша действия: переназначенная, иначе дефолт УСТРОЙСТВА игрока
//(движение до перенастройки в bindings не хранится — devices.js DEVICE_KEYS)
function effectiveKb(pi, action) {
    const bound = kbKeys(pi, action)
    if (bound.length) return bound[0]
    const P = status.players[pi]
    const dev = (P && P.device) || "solo"
    const dk = DEVICE_KEYS[dev] || DEVICE_KEYS.solo
    return dk[action] ? dk[action][0] : null
}
function assignKb(pi, action, code) {
    ensureBindings()
    const prof = status.settings.bindings["p" + pi]
    //перенос: если код уже занят другим действием этого игрока — снять с него
    for (const k of Object.keys(prof)) {
        if (k === action) continue
        if (Array.isArray(prof[k])) prof[k] = prof[k].filter(c => c !== code)
    }
    prof[action] = [code]
    saveSettings()
    redraw()
}
function assignPad(action, idx) {
    ensureBindings()
    const pad = status.settings.bindings.pad
    for (const k of Object.keys(pad)) {
        if (k !== action && pad[k] === idx) pad[k] = -1
    }
    pad[action] = idx
    saveSettings()
    redraw()
}
function stopCapture() {
    if (captureKey) { document.removeEventListener("keydown", captureKey, true); captureKey = null }
    if (padPollTimer) { clearInterval(padPollTimer); padPollTimer = null }
    if (padPollTimeout) { clearTimeout(padPollTimeout); padPollTimeout = null }
    capture = null
    padPollPrev = null
}
function startKbCapture(pi, action) {
    stopCapture()
    capture = {"kind":"kb","pi":pi,"action":action}
    captureKey = e => {
        e.preventDefault()
        e.stopPropagation()
        if (e.code === "Escape") { stopCapture(); redraw(); return }
        const code = e.code
        stopCapture()
        assignKb(pi, action, code)
    }
    document.addEventListener("keydown", captureKey, true)
    redraw()
}
function startPadCapture(action) {
    stopCapture()
    capture = {"kind":"pad","action":action}
    padPollPrev = null
    padPollTimer = setInterval(() => {
        const pads = navigator.getGamepads()
        const pressed = []
        for (let i = 0; i < 4; i++) {
            const pad = pads[i]
            if (!pad) continue
            for (let bi = 0; bi < pad.buttons.length; bi++) pad.buttons[bi].pressed && pressed.push(bi)
        }
        //первый срез — база (уже зажатые кнопки не считаются «новыми»)
        if (padPollPrev === null) { padPollPrev = pressed; return }
        const fresh = pressed.filter(b => padPollPrev.indexOf(b) === -1)
        if (fresh.length > 0 && capture) {
            const idx = fresh[0]
            const act = capture.action
            stopCapture()
            assignPad(act, idx)
            return
        }
        padPollPrev = pressed
    }, 50)
    padPollTimeout = setTimeout(() => { stopCapture(); redraw() }, 5000)
    redraw()
}
function openControls() {
    status.pause = 1
    status.move = 0
    status.panels = 12
    musicDuck(1)
    ensureBindings()
    drawControls()
}
//перерисовка (capture-подсказки и новые подписи): снос узлов, полная отрисовка заново
function redraw() {
    for (let i = 0; i < controlsTemp.length; i++) controlsTemp[i].remove()
    controlsTemp = []
    status.panels === 12 && drawControls()
}
function cell(x, y, w, h, label, fn) {
    controlsTemp.push(image(svgArr[2],x,y,w,h,"./images/UI/panels/buttons/button.png",{"glow":1,"func":fn}))
    controlsTemp.push(text(svgArr[2],x + w/2,y + h/2 + 10,"0pt","50pt","black","2px","white",label,{"id":"controlsCell","size":26,"font":"baseFont4","anchor":"middle"}))
}
function drawControls() {
    controlsTemp.push(image(svgArr[2],525,160,919,796,"./images/UI/panels/panel.png"))
    controlsTemp.push(text(svgArr[2],960,215,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("controls.title"),{"id":"delItemText","size":60,"font":"baseFont4","anchor":"middle"}))
    //подсказка захвата / постоянная подсказка по падам
    controlsTemp.push(text(svgArr[2],960,268,"0pt","50pt","black","2px","white",
        capture ? (capture.kind === "kb" ? T("controls.press") : T("controls.pressPad")) : T("controls.hint"),
        {"id":"controlsHint","size":24,"font":"baseFont4","anchor":"middle"}))
    //заголовки колонок: игрок 1 / игрок 2 / геймпад
    controlsTemp.push(text(svgArr[2],850,312,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("controls.player1"),{"id":"controlsHead","size":30,"font":"baseFont4","anchor":"middle"}))
    controlsTemp.push(text(svgArr[2],1010,312,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("controls.player2"),{"id":"controlsHead","size":30,"font":"baseFont4","anchor":"middle"}))
    controlsTemp.push(text(svgArr[2],1170,312,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("controls.gamepad"),{"id":"controlsHead","size":30,"font":"baseFont4","anchor":"middle"}))
    const rowH = 42
    const y0 = 336
    for (let i = 0; i < ROWS.length; i++) {
        const [key,kbAct,padAct] = ROWS[i]
        const y = y0 + i * rowH + rowH/2
        controlsTemp.push(text(svgArr[2],700,y + 8,"0pt","50pt","none","1px",`rgb(204, 153, 102)`,T(key),{"id":"controlsRow","size":24,"font":"baseFont4","anchor":"start"}))
        if (kbAct) {
            //клавиатурная ячейка: переназначенная клавиша или дефолт устройства
            const cur = effectiveKb(0, kbAct) || "—"
            cell(790,y - 17,120,34,capture && capture.kind === "kb" && capture.pi === 0 && capture.action === kbAct ? "…" : keyLabel(cur),() => startKbCapture(0,kbAct))
            const cur1 = effectiveKb(1, kbAct) || "—"
            cell(950,y - 17,120,34,capture && capture.kind === "kb" && capture.pi === 1 && capture.action === kbAct ? "…" : keyLabel(cur1),() => startKbCapture(1,kbAct))
        }
        if (padAct) {
            const curP = padBtn(padAct)
            cell(1110,y - 17,120,34,capture && capture.kind === "pad" && capture.action === padAct ? "…" : padLabel(curP),() => startPadCapture(padAct))
        }
    }
    //низ: сброс + назад в настройки
    controlsTemp.push(image(svgArr[2],640,808,200,60,"./images/UI/panels/buttons/button.png",{"glow":1,"func":() => {
        status.settings.bindings = bindingsTemplate()
        saveSettings()
        redraw()
    }}))
    controlsTemp.push(text(svgArr[2],740,838,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("controls.reset"),{"id":"delItemText","size":34,"font":"baseFont4","anchor":"middle"}))
    controlsTemp.push(image(svgArr[2],900,808,420,73,"./images/UI/panels/buttonUp.png",{"glow":1,"func":() => { closeControls(1,true) }}))
    controlsTemp.push(text(svgArr[2],1110,859,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("controls.back"),{"id":"delItemText","size":42,"font":"baseFont4","anchor":"middle"}))
}
//закрытие панели. toSettings=1 — вернуться в НАСТРОЙКИ (кнопка ОТМЕНА/Esc/B);
//иначе — обычное закрытие (closePanels). nomusic — как в settingsDel
function closeControls(nomusic=0,toSettings=0) {
    stopCapture()
    for (let i = 0; i < controlsTemp.length; i++) controlsTemp[i].remove()
    controlsTemp = []
    if (toSettings) {
        //настройки сами ставят panels/pause/musicDuck (флаг закрытия панелей уже снят)
        status.move = 1
        status.panels = 0
        status.pause = 0
        controlsHooks.toSettings && controlsHooks.toSettings()
        return
    }
    controlsDel(nomusic)
}
//полный сброс панели (путь closePanels/topMenu.js): узлы + состояние
function controlsDel(nomusic=0) {
    stopCapture()
    for (let i = 0; i < controlsTemp.length; i++) controlsTemp[i].remove()
    controlsTemp = []
    status.move = 1
    status.panels = 0
    status.pause = 0
    nomusic === 0 && musicDuck(0)
}
function controlsIsOpen() {
    return controlsTemp.length > 0
}
//V126: settings.js регистрирует здесь свой settings()-переоткрыватель (без цикла модулей:
//settings.js → controls.js напрямую, обратная связь — только через этот хук)
const controlsHooks = {"toSettings":null}
export {openControls,closeControls,controlsDel,controlsIsOpen,controlsTemp,controlsHooks}
