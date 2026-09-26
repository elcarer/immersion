// ============================================================================
// devices.js — V114: устройства ввода кооператива. Профили раскладок:
//   kb1  = WASD (левая половина клавиатуры) — игрок 1;
//   kb2  = стрелки (правая половина) — игрок 2;
//   solo = ОБЕ половины сразу + пад 0 — поведение одиночной игры 1:1;
//   pad0/pad1 = геймпады по индексу Gamepad API (крестовина + ЛЕВЫЙ СТИК — движение).
// V126: привязки ПЕРЕНАЗНАЧАЕМЫ (панель «Управление» в НАСТРОЙКАХ). Хранение —
// status.settings.bindings = {"p0":{действие:код клавиши}, "p1":{...}, "pad":{действие:индекс кнопки}};
// отсутствующие поля (старые сейвы/частичная перенастройка) добираются из дефолтов.
// Клавиатурные значения — МАССИВЫ кодов (соло-профиль держит обе половины),
// перенастройка заменяет массив одной клавишей. Падовые — индексы кнопок, общие
// для обоих падов (пад k в коопе и так принадлежит игроку k, см. padIndex).
// pressedKeys (общий Set кодов) живёт в heroMove.js.
// ============================================================================
import { status } from "../scripts/start.js"

const DIR_NAMES = ["up","down","left","right"]
//панельные действия → индексы clickButton (topMenu): экипировка/карта/журнал/настройки/библиотека
export const PANEL_ACTIONS = [["equip",0],["map",1],["journal",2],["settings",3],["library",4]]
//дефолтные раскладки клавиатуры: p0 = WASD (бывший kb1), p1 = стрелки (бывший kb2).
//СОЛО-устройство объединяет обе половины (DEVICE_KEYS.solo) — в коопе профили
//p0/p1 строго не пересекаются, иначе ownerOfMoveKey не определит владельца.
//Движение в дефолтах привязок НЕ хранится — его дефолты живут в DEVICE_KEYS
//и берутся по УСТРОЙСТВУ игрока (playerMoveKeys)
//V148: «attack» — клавиша ручной атаки (чекбокс «Автоатака» снят): левый Ctrl у
//игрока 1, «0» у игрока 2 (правая половина, рядом со стрелками)
const DEFAULT_BINDINGS = [
    {"equip":["KeyN"],"map":["KeyM"],"journal":["Comma"],"settings":["Period"],"library":["Slash"],"attack":["ControlLeft"]},
    {"equip":["KeyK"],"map":["KeyL"],"journal":["Semicolon"],"settings":["Quote"],"library":["Backspace"],"attack":["Digit0"]}
]
//дефолты движения ПО УСТРОЙСТВУ (V114-семантика): solo = обе половины сразу
const DEVICE_KEYS = {
    kb1: {"up":["KeyW"],"down":["KeyS"],"left":["KeyA"],"right":["KeyD"]},
    kb2: {"up":["ArrowUp"],"down":["ArrowDown"],"left":["ArrowLeft"],"right":["ArrowRight"]},
    solo: {"up":["KeyW","ArrowUp"],"down":["KeyS","ArrowDown"],"left":["KeyA","ArrowLeft"],"right":["KeyD","ArrowRight"]}
}
//дефолтные кнопки пада (стандартная раскладка XInput): A/B/X/Y = 0/1/2/3,
//LB/RB = 4/5, LT/RT = 6/7. V126 (решение юзера): клик курсором — ЛТ (6),
//журнал переезжает с 6 на RT (7); drag предметов — LB (4), как было
const DEFAULT_PAD = {"equip":0,"settings":1,"map":2,"cancel":3,"library":5,"click":6,"drag":4,"journal":7}
//нормализация: массивы клавиш для клавиатуры, числа для пада; чужие типы → дефолт
function kbKeys(pi, action) {
    const b = status.settings.bindings
    const v = b && b["p" + pi] && b["p" + pi][action]
    if (Array.isArray(v) && v.length > 0 && v.every(k => typeof k === "string")) return v
    if (typeof v === "string" && v) return [v]
    return (DEFAULT_BINDINGS[pi] && DEFAULT_BINDINGS[pi][action]) || []
}
function padBtn(action) {
    const b = status.settings.bindings
    const v = b && b.pad && b.pad[action]
    return (typeof v === "number" && v >= 0 && v < 20) ? v : DEFAULT_PAD[action]
}
//набор кодов движения игрока pi: привязка из настроек, иначе дефолт ЕГО устройства
//(solo объединяет обе половины клавиатуры, как до коопа)
function playerMoveKeys(pi, device) {
    const def = DEVICE_KEYS[device] || DEVICE_KEYS.solo
    const out = {}
    for (let d = 0; d < 4; d++) {
        const v = kbKeys(pi, DIR_NAMES[d])
        out[DIR_NAMES[d]] = v.length ? v : def[DIR_NAMES[d]]
    }
    return out
}
//индекс геймпада устройства. V125 (репорт юзера: «второй джойстик не работает»):
//в коопе клавиатурный профиль владеет падом СВОЕГО СЛОТА — пад 0 → игрок 1 (kb1),
//пад 1 → игрок 2 (kb2); solo — пад 0, как раньше. Пад не подключён — getGamepads()[i]
//равен null и ветка движения просто не срабатывает, раскладка живёт на клавиатуре
function padIndex(device) {
    if (device === "pad1" || device === "kb2") return 1
    if (device === "pad0" || device === "kb1" || device === "solo") return 0
    return -1
}
//чей код движения/панели: {player, dir|action} первого игрока, в чью раскладку код
//входит, или null. В соло профиль один на единственного героя; в коопе p0/p1 не пересекаются
//(пока раскладки не пересены вручную на одни клавиши — тогда побеждает первый)
function ownerOfMoveKey(code) {
    for (let i = 0; i < status.players.length; i++) {
        const P = status.players[i]
        const keys = playerMoveKeys(P.idx || 0, P.device)
        for (let d = 0; d < 4; d++) {
            if (keys[DIR_NAMES[d]].indexOf(code) !== -1) return {"player":P,"dir":d}
        }
    }
    return null
}
//чей код панельного хоткея: {player, panel} (индекс clickButton) или null
function ownerOfPanelKey(code) {
    for (let i = 0; i < status.players.length; i++) {
        const P = status.players[i]
        for (let a = 0; a < PANEL_ACTIONS.length; a++) {
            if (kbKeys(P.idx || 0, PANEL_ACTIONS[a][0]).indexOf(code) !== -1) return {"player":P,"panel":PANEL_ACTIONS[a][1]}
        }
    }
    return null
}
//V148: чей код клавиши атаки (ручной режим) — сам игрок или null. Как и панели,
//ищем по ПРОФИЛЮ игрока (kbKeys), не по устройству: в соло профиль p0 один —
//работает только его Ctrl; в коопе Ctrl — игрок 1, «0» — игрок 2
function ownerOfAttackKey(code) {
    for (let i = 0; i < status.players.length; i++) {
        const P = status.players[i]
        if (kbKeys(P.idx || 0, "attack").indexOf(code) !== -1) return P
    }
    return null
}
//шаблон для панели «Управление» и глубокого долива дефолтов при загрузке сейва.
//ТОЛЬКО панельные действия и пад: движение НЕ попадает в привязки, пока игрок не
//переназначил клавишу сам, — иначе записанный дефолт (WASD) перекрыл бы solo-слив
//обеих половин клавиатуры (стрелки в соло перестали бы работать — ловушка V126)
function bindingsTemplate() {
    const clone = o => JSON.parse(JSON.stringify(o))
    return {
        "p0": clone(DEFAULT_BINDINGS[0]),
        "p1": clone(DEFAULT_BINDINGS[1]),
        "pad": clone(DEFAULT_PAD)
    }
}
export {playerMoveKeys,padIndex,ownerOfMoveKey,ownerOfPanelKey,ownerOfAttackKey,kbKeys,padBtn,bindingsTemplate,DEVICE_KEYS,DIR_NAMES}
