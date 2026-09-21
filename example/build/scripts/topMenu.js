import { status } from "../scripts/start.js"
import { svgArr,image,text } from "../scripts/svg.js"
//V73: подписи кнопок — T-ключи (переиспользованы заголовки панелей, для карты новый ui.map)
import { T } from "../scripts/localization.js"
import { dataGeneric } from "../scripts/sceneGenerate.js"
import { map,mapDel,mapTemp } from "../scripts/map.js"
import { doll,dollDel,dollTemp } from "../scripts/doll.js"
import { inventory,inventoryDel,inventoryTemp } from "../scripts/inventory.js"
import { skillTreeDel,skillTreeTemp } from "../scripts/skillTree.js"
import { library,libraryDel,libraryTemp } from "../scripts/library.js"
import { journal,journalDel,journalTemp } from "../scripts/journal.js"
import { playback,strike } from "../scripts/sound.js"
import { settings,settingsTemp,settingsDel } from "../scripts/settings.js"
//V54: алхимический стол — закрывается общим closePanels (ESC/геймпад «отмена»)
import { alchemyDel,alchemyTemp } from "../scripts/alchemy.js"
//V75: шкафчик с древностями — закрывается так же, объект не расходуется
import { ancientDel,ancientTemp } from "../scripts/blessFx.js"
import { tipDel } from "../scripts/tip.js"
import { lvlFlashDrop } from "../scripts/lvlFlashFx.js"
//V117: кооператив — панели per-owner (контекст игрока на время панели)
import { setContext } from "../scripts/players.js"

let menuPic = []
//V73: подписи кнопок полосы меню — на 48px правее центра кнопки, чтобы осталась видна
//иконка, нарисованная на спрайте кнопки (icon1..5). Ключи: кукла/карта/журнал/настройки/библиотека
let menuLabels = ["doll.title","ui.map","journal.title","settings.title","lib.title"]
function topMenu(map=0) {
    if (status.panels === 0 || map !== 0) {
        topMenuClose(1)
        for (let i = 0; i < 5; i++) {
            menuPic.push(image(svgArr[2],50 + i * 220,50,"208px","60px","./images/UI/panels/buttons/icon"+(i+1)+".png",{"glow":1,"func":()=>{clickButton(i)}}))
            menuPic.push(text(svgArr[2],50 + i * 220 + 127,92,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T(menuLabels[i]),{"id":"delItemText","size":36,"font":"baseFont4","anchor":"middle"}))
        }
    }
    map===0&&(status.panels = 10)
}
//закрыть все открытые панели. nomusic=1 — не возобновлять музыку (при переключении)
function closePanels(nomusic=0) {
    //V117: после закрытия всех панелей контекст возвращается игроку 1
    dollTemp.length > 0 && dollDel(nomusic)
    inventoryTemp.length > 0 && inventoryDel(nomusic)
    settingsTemp.length > 0 && settingsDel(nomusic)
    skillTreeTemp.length > 0 && skillTreeDel(nomusic)
    libraryTemp.length > 0 && libraryDel(nomusic)
    journalTemp.length > 0 && journalDel(nomusic)
    mapTemp.length > 0 && mapDel(nomusic)
    //V54: алхимический стол — выход БЕЗ расхода объекта (объект можно использовать снова)
    alchemyTemp.length > 0 && alchemyDel(nomusic)
    //V75: шкафчик с древностями — выход БЕЗ расхода объекта (благословение не выдано)
    ancientTemp.length > 0 && ancientDel(nomusic)
    tipDel()
    status.hero !== status.players[0] && setContext(status.players[0])
}
//V117: ownerIdx — игрок, вызвавший панель (клавиша его раскладки / его геймпад).
//Контекст ставится на владельца ПЕРЕД открытием — кукла/инвентарь/дерево/журнал
//рисуют ЕГО данные; закрытие возвращает контекст через closePanels. Мышиные
//кнопки полосы меню и дефолт — игрок 1.
function clickButton(buttonNumber, ownerIdx = 0) {
    playback(strike[14].vol,0,0,3*status.settings.soundVolume)
    const owner = status.players[ownerIdx] || status.players[0]
    switch (buttonNumber) {
        case 0: //экипировка (кукла + инвентарь)
            if (dollTemp.length > 0 || inventoryTemp.length > 0) {
                closePanels(0)
                topMenuClose()
            } else {
                closePanels(1)
                setContext(owner)
                doll()
                inventory()
            }
            break
        case 1: //карта
            if (mapTemp.length > 0) {
                closePanels(0)
                topMenuClose()
            } else {
                closePanels(1)
                setContext(owner)
                map(dataGeneric,status.levelFloor,svgArr[2])
                topMenu(1)
            }
            break
        case 2: //журнал
            if (journalTemp.length > 0) {
                closePanels(0)
                topMenuClose()
            } else {
                closePanels(1)
                setContext(owner)
                journal()
                topMenu(1) //панель держит полосу кнопок видимой — повторное нажатие закрывает (как карта)
            }
            break
        case 3: //настройки
            if (settingsTemp.length > 0) {
                closePanels(0)
                topMenuClose()
            } else {
                closePanels(1)
                setContext(owner)
                settings()
            }
            break
        case 4: //библиотека
            if (libraryTemp.length > 0) {
                closePanels(0)
                topMenuClose()
            } else {
                closePanels(1)
                setContext(owner)
                library()
                topMenu(1) //панель держит полосу кнопок видимой — повторное нажатие закрывает (как карта)
            }
            break
    }
}
function topMenuClose(map=0) {
    //V27: если меню закрыто вне вспышки левелапа (курсор вниз/смена сцены) — рамка не переживает меню
    lvlFlashDrop()
    let length = menuPic.length
    for (let i = 0; i < length; i++) {
        menuPic[i].remove()
    }
    menuPic = []
    map===0&&(status.panels = 0)
}
export {topMenu,topMenuClose,clickButton,closePanels}
