import { svgArr,image,text,rect } from "../scripts/svg.js"
import { status } from "../scripts/start.js"
import { drag,doubleClickItem } from "../scripts/drag.js"
import { tip,tipDel,compareTip,rarityColor,itemFrameOn,itemGlowOn } from "../scripts/tip.js"
//V53: isSetItem — ховеру идентифицированной легендарки окно сравнения встаёт по «сетовым» клампам
import { isSetItem } from "../scripts/sets.js"
import { playback,strike,musicDuck } from "../scripts/sound.js"
import { skillTree } from "../scripts/skillTree.js"
//V58: локализация
import { T } from "../scripts/localization.js"

let inventoryTemp = []
//V29: надетый предмет для окна сравнения — первый занятый слот куклы среди типов
//наведённого предмета (obj.types = номера слотов 0..12). Читаем ЖИВОЙ status.inventory.doll
//на каждый ховер (не на рендер панели): после drag/даблклика панель перерисовывается,
//но и без этого значение всегда актуально. Нет надетого / предмет не экипируется → null.
//V67: реликвия встаёт в ЛЮБОЙ слот — сравнивать её с одним «первым попавшимся» надетым
//предметом бессмысленно, окна сравнения у реликвии нет
function equippedCompareOf(obj) {
    if (!obj || !obj.types) return null
    if (obj.relic !== undefined) return null
    let res = null
    const length = obj.types.length
    for (let k = 0; k < length && !res; k++) {
        const s = obj.types[k]
        ;(s >= 0 && s < 13) && status.inventory.doll[s] && (res = status.inventory.doll[s])
    }
    return res
}
function inventory () {
    svgArr[2].style.display = 'none'
    status.pause = 1
    status.move = 0
    status.panels = 6
    musicDuck(1)
    inventoryTemp.push(image(svgArr[2],870,160,919,796,"./images/UI/panels/panel.png"))
    inventoryTemp.push(text(svgArr[2],1325,215,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("ui.inventory"),{"id":"delItemText","size":60,"font":"baseFont4","anchor":"middle"}))
    let num = 0
    for (let j = 0; j < 4; j++) {
        for (let i = 0; i < 6; i++) {
            inventoryTemp.push(image(svgArr[2],940 + i * 130,261 + j * 130,128,128,"./images/UI/panels/inv/emptyCell.png",{"id":13+num}))
            if (status.inventory.inv[num]) {
                let obj = JSON.parse(JSON.stringify(status.inventory.inv[num]))
                //V94: обводка редкости под спрайтом — та же, что вокруг спрайта в тултипе
                //V95: рамку/свечение можно отключить в Настройках
                let rc = rarityColor(obj.rarity)
                itemFrameOn() && inventoryTemp.push(rect(svgArr[2],940 + i * 130,261 + j * 130,128,128,rc,"2px","none",{"rx":"3px"}))
                let invOpts = {"id":13+num,"funcDrag":drag,"funcDbl":doubleClickItem,"funcShow":e => {rectCellShow(obj);e.buttons !== 1 ? (tip(e,obj),compareTip(e,equippedCompareOf(obj),isSetItem(obj))) : tipDel()},"funcShowOut":e => {tipDel();rectCellShowDel()},"item":status.inventory.inv[num]}
                itemGlowOn() && (invOpts.blur = "filter: drop-shadow(0 0 4px "+rc+")")
                inventoryTemp.push(image(svgArr[2],940 + i * 130,261 + j * 130,128,128,status.inventory.inv[num].img,invOpts))
                //V111: оверлей пламени на иконке огненного оружия (сетка инвентаря)
                status.inventory.inv[num].fire && inventoryTemp.push(image(svgArr[2],940 + i * 130,261 + j * 130,128,128,"./images/effects/flameWeapon.png",{}))
            }
            num++        
        }
    }
    inventoryTemp.push(image(svgArr[2],1500,810,208,60,"./images/UI/panels/buttons/button.png",{"id":"delItem"}))
    inventoryTemp.push(text(svgArr[2],1600,852,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("ui.delete"),{"id":"delItemText","size":42,"font":"baseFont4","anchor":"middle"}))
    inventoryTemp.push(image(svgArr[2],960,810,208,60,"./images/UI/panels/buttons/icon6.png",{"id":"delItem","glow":1,"func":()=>{inventoryDel(1);skillTree();playback(strike[14].vol,0,0,3*status.settings.soundVolume)}}))
    //V73: подпись кнопки способностей — на 48px правее центра (иконка на спрайте слева)
    inventoryTemp.push(text(svgArr[2],1089,852,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("st.title"),{"id":"delItemText","size":36,"font":"baseFont4","anchor":"middle"}))
    svgArr[2].style.display = ''
}
function inventoryDel(nomusic=0) {
    let length = inventoryTemp.length
    for (let i = 0; i < length; i++) {
        inventoryTemp[i].remove()
    }
    inventoryTemp = []
    status.move = 1
    status.panels = 0
    status.pause = 0
    tipDel()
    nomusic === 0 && musicDuck(0)
    rectCellShowDel()
}

let rectCell = []
//V58: name — ключ локализации слота (slot.N/hand.1); сравнение с desc1 предмета — по ключу,
//для вещей старых сейвов (desc1 — русское слово) — по RU-значению ключа через T()
let toolTipArrArmCoord = [{"name":"slot.0","x":113,"y":260},{"name":"slot.1","x":243,"y":260},{"name":"slot.2","x":113,"y":390},{"name":"slot.3","x":243,"y":390},{"name":"slot.4","x":113,"y":520},{"name":"slot.5","x":243,"y":520},{"name":"slot.6","x":113,"y":650},{"name":"slot.7","x":243,"y":650},{"name":"slot.8","x":700,"y":260},{"name":"slot.9","x":700,"y":390},{"name":"slot.10","x":700,"y":520},{"name":"hand.1","x":410,"y":738},{"name":"hand.1","x":546,"y":738}]

function rectCellShow(obj) {
    let x,y
    //V67: реликвия — слот-агностик, подсветку «своей» ячейки не рисуем (жёлтая рамка
    //двуручного фолбэка вводила бы в заблуждение)
    if(obj.relic !== undefined) return
    if(rectCell.length === 0) {
        let length = toolTipArrArmCoord.length
        for (let i = 0; i < length; i++) {
            if(toolTipArrArmCoord[i].name === obj.type.desc1 || T(toolTipArrArmCoord[i].name) === obj.type.desc1) {
                x = toolTipArrArmCoord[i].x
                y = toolTipArrArmCoord[i].y
                break
            }
        }
        if(!x){
            x = toolTipArrArmCoord[11].x
            y = toolTipArrArmCoord[11].y
            inventoryTemp.push(rect(svgArr[2],toolTipArrArmCoord[12].x,toolTipArrArmCoord[12].y,128,128,`rgb(200, 248, 9)`,"2px","none",{"opacity":"1"}))
            rectCell.push(inventoryTemp[inventoryTemp.length - 1])
        }
        inventoryTemp.push(rect(svgArr[2],x,y,128,128,`rgb(200, 248, 9)`,"2px","none",{"opacity":"1"}))
        rectCell.push(inventoryTemp[inventoryTemp.length - 1])
    }
}
function rectCellShowDel() {
    if(rectCell.length > 0) {
        let length = rectCell.length
        for (let i = 0; i < length; i++) {
            rectCell[i].remove()
        }
        rectCell = []
    }
}
export {inventory,inventoryDel,inventoryTemp,rectCellShow,rectCellShowDel,equippedCompareOf}