// V64: спрайт Портала (тип 18) и Рычага (тип 19) по СОСТОЯНИЮ объекта — единая формула
// для createRoom (sceneGenerate.js) и mapRender.js (аналог trapSprite.js, БЕЗ импортов —
// циклы исключены). obj[10]: 1 — активная фаза (100.png / 102.png),
// 0 — выключенная фаза (100d.png / 102d.png, пути юзера).
// V83: у Портала два вида, определяемых при генерации (portalFx, слот obj[12]):
// 1 — старый (100.png), 2 — новый (100a.png); вид виден только в активной фазе.
// Аренные/возвратные порталы obj[12] не получают — активный спрайт 100.png.
// V83: Кнопка загадки (тип 21) — та же формула по obj[10]: 1 — push1.png, 0 — push0.png.
const PORTAL_ACTIVE = "./images/dungeon/objects/100.png"
const PORTAL_KIND2 = "./images/dungeon/objects/100a.png"
const PORTAL_OFF = "./images/dungeon/objects/100d.png"
const LEVER_ACTIVE = "./images/dungeon/objects/102.png"
const LEVER_OFF = "./images/dungeon/objects/102d.png"
const BUTTON_ON = "./images/dungeon/objects/push1.png"
const BUTTON_OFF = "./images/dungeon/objects/push0.png"
function portalSpriteSrc(obj) {
    return obj[2] === 18
        ? (obj[10] === 1 ? (obj[12] === 2 ? PORTAL_KIND2 : PORTAL_ACTIVE) : PORTAL_OFF)
        : obj[2] === 21
            ? (obj[10] === 1 ? BUTTON_ON : BUTTON_OFF)
            : (obj[10] === 1 ? LEVER_ACTIVE : LEVER_OFF)
}
export { portalSpriteSrc }
