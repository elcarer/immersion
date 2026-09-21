// ============================================================================
// devices.js — V114: устройства ввода кооператива. Профили раскладок:
//   kb1  = WASD (левая половина клавиатуры) — игрок 1;
//   kb2  = стрелки (правая половина) — игрок 2;
//   solo = ОБЕ половины сразу + пад 0 — поведение одиночной игры 1:1;
//   pad0/pad1 = геймпады по индексу Gamepad API (крестовина — движение).
// pressedKeys (общий Set кодов) живёт в heroMove.js — профили лишь делят,
// чей код чей: ownerOfMoveKey находит игрока-владельца нажатия (рывок),
// moveProfile даёт наборы кодов направления для тика движения.
// Панельные хоткеи (N/M/,/.// у kb1) в V114 общие — per-owner панели (V117).
// ============================================================================
import { status } from "../scripts/start.js"

const MOVE_KEYS = {
    kb1: {"up":["KeyW"],"down":["KeyS"],"left":["KeyA"],"right":["KeyD"]},
    kb2: {"up":["ArrowUp"],"down":["ArrowDown"],"left":["ArrowLeft"],"right":["ArrowRight"]}
}
//соло: обе половины клавиатуры равноправны (как в одиночной игре до коопа)
MOVE_KEYS.solo = {
    "up":["KeyW","ArrowUp"],"down":["KeyS","ArrowDown"],
    "left":["KeyA","ArrowLeft"],"right":["KeyD","ArrowRight"]
}
//код → направление (0 верх/1 низ/2 лево/3 право) — маршрут dashPress (рывок)
const KEY_DIR = {"KeyW":0,"ArrowUp":0,"KeyS":1,"ArrowDown":1,"KeyA":2,"ArrowLeft":2,"KeyD":3,"ArrowRight":3}
const DIR_NAMES = ["up","down","left","right"]

function moveProfile(device) {
    return MOVE_KEYS[device] || MOVE_KEYS.solo
}
//индекс геймпада устройства (solo использует пад 0, как раньше; раскладки kb — без пада)
function padIndex(device) {
    return device === "pad0" ? 0 : device === "pad1" ? 1 : device === "solo" ? 0 : -1
}
//чей код движения: {player, dir} первого игрока, в чей профиль код входит, или null.
//В соло профиль один на единственного игрока; в коопе профили kb1/kb2 не пересекаются
function ownerOfMoveKey(code) {
    const dir = KEY_DIR[code]
    if (dir === undefined) return null
    for (let i = 0; i < status.players.length; i++) {
        const prof = moveProfile(status.players[i].device)
        if (prof[DIR_NAMES[dir]].indexOf(code) !== -1) return {"player":status.players[i],"dir":dir}
    }
    return null
}
export {moveProfile,padIndex,ownerOfMoveKey,KEY_DIR}
