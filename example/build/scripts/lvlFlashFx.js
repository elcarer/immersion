import { status } from "../scripts/start.js"
import { svgArr, rect } from "../scripts/svg.js"
import { topMenu, topMenuClose } from "../scripts/topMenu.js"
import { dollTemp } from "../scripts/doll.js"
import { inventoryTemp } from "../scripts/inventory.js"
import { mapTemp } from "../scripts/map.js"
import { skillTreeTemp } from "../scripts/skillTree.js"
import { settingsTemp } from "../scripts/settings.js"

//V27: при повышении уровня показать на ~2 секунды верхнее меню с выделенной кнопкой
//«экипировка» (icon1.png рисуется в (50,50) размером 208×60): рамка 2px rgb(200,248,9),
//клики сквозь рамку проходят (pointer-events:none). Отсчёт тиковый (как весь движок) —
//на паузе мигание замирает. Если игрок за это время САМ что-то открыл/закрыл или меню
//было закрыто штатно (курсор вниз, смена сцены через topMenuClose) — форсированное
//закрытие отменяется, работает обычный сценарий topMenu.
const FLASH_TICKS = 125 //~2с при 16мс/тик
let left = 0
let frame = null
let startPanelsSnapshot = null

function panelSnapshot() {
    return [dollTemp.length, inventoryTemp.length, mapTemp.length, skillTreeTemp.length, settingsTemp.length]
}
function dropFrame() {
    if (frame) { frame.remove(); frame = null }
}
function lvlFlashShow() {
    //уже открытые меню/панели не перехватываем
    if (status.start !== 1 || status.panels !== 0) return
    dropFrame()
    topMenu() //рисует 5 кнопок, status.panels = 10
    frame = rect(svgArr[2], 50, 50, 208, 60, "rgb(200, 248, 9)", "2px", "none", {"id":"lvlFlash"})
    startPanelsSnapshot = panelSnapshot()
    left = FLASH_TICKS
}
function lvlFlashDrop() {
    //хук из topMenuClose: меню убрано вне нашего таймера — рамка не должна переживать меню
    dropFrame()
    left = 0
    startPanelsSnapshot = null
}
//V90: активна ли форсированная вспышка левелапа — heroMove не закрывает движением героя
//меню, поднятое вспышкой (оно закроется само по таймеру lvlFlashTick)
function lvlFlashActive() {
    return left > 0
}
//вызов из gameLoop раз в тик
function lvlFlashTick() {
    if (left <= 0) return
    left--
    //меню закрыли извне или игрок начал взаимодействие (открыл панель) — только снять рамку
    if (status.panels !== 10) { lvlFlashDrop(); return }
    if (startPanelsSnapshot && panelSnapshot().join() !== startPanelsSnapshot.join()) { lvlFlashDrop(); return }
    if (left <= 0) {
        dropFrame()
        topMenuClose()
        startPanelsSnapshot = null
    }
}
export { lvlFlashShow, lvlFlashTick, lvlFlashDrop, lvlFlashActive }
