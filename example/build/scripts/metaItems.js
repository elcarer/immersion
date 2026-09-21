import { status } from "../scripts/start.js"
import { T } from "../scripts/localization.js"
import { screenPic,del } from "../scripts/del.js"
import { svgArr,image,text,rect } from "../scripts/svg.js"
import { tip,tipDel,rarityColor,itemFrameOn,itemGlowOn } from "../scripts/tip.js"
import { cellPickArr } from "../scripts/doll.js"
import { lobby,coopLobby } from "../scripts/lobby.js"
//E-22: Пробел дублирует кнопку «Далее» на экране взятия предметов
import { armSpaceNext, clearSpaceNext } from "../scripts/spaceNext.js"
//V124: кооп — экран предметов по очереди для каждого игрока
import { setContext } from "../scripts/players.js"

let invNumText
let change
//V124: кооп — экран показывается ДВАЖДЫ, по игроку (свои вещи, свой сундук, свой invNum).
//metaItems — вход цепочки (игрок 1), metaItemsBuild — отрисовка экрана ТЕКУЩЕГО контекста
let miCoopIdx = 0
function metaItems(lose,next) {
    miCoopIdx = 0
    status.players.length > 1 && setContext(status.players[0])
    metaItemsBuild(lose,next)
}
function metaItemsBuild(lose,next) {
    del()
    //E-22: экран очков мог оставить взведённый Пробел — снимаем до сборки своего
    clearSpaceNext()
    status.meta.killedEnemes = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] //V35: 21 враг — у монстров 3-го этажа свои id 14-20
    //V66b (репорт юзера): сброс зачёта «Объектов» Библиотеки УДАЛЁН — meta.libraryObjects,
    //как meta.library (враги) и meta.achievements, живёт МЕЖДУ забегами; первое использование
    //объекта пишет 1 в useObject.finishUsedObject (id до 57 — алхимический стол 3 этажа, V48–V54).
    //Старые сейвы добивает до 58 слотов normMeta (save.js). Раньше строка ниже обнуляла зачёт
    //каждым завершением забега — карточки объектов «забывались» после первой же вылазки:
    //status.meta.libraryObjects = new Array(58).fill(0)
    change = status.meta.invNum
    screenPic.push(image(svgArr[2],520,50,919,73,"./images/UI/panels/endTop.png"))
    screenPic.push(text(svgArr[2],1920/2,106,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("mi.title"),{"id":"delItemText","size":60,"font":"baseFont4","anchor":"middle"}))
    //V124: кооп — подпись игрока на раздельном экране предметов
    status.players.length > 1 && screenPic.push(text(svgArr[2],590,106,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("coop.pn",status.hero.idx+1),{"id":"delItemText","size":30,"font":"baseFont4","anchor":"middle"}))
    if(next === false) {
        screenPic.push(image(svgArr[2],50,160,823,796,"./images/UI/panels/equip.png"))
        for (let i = 0; i < 13; i++) {
            if (status.inventory.doll[i]) {screenPic.push(image(svgArr[2],cellPickArr[i].x,cellPickArr[i].y,"128px","128px","./images/UI/doll/empty.png",{"id":i,"func":()=>{}}))
            let obj = JSON.parse(JSON.stringify(status.inventory.doll[i]))
            //V94: обводка редкости под спрайтом — та же, что вокруг спрайта в тултипе
            //V95: рамку/свечение можно отключить в Настройках; id "rf"+ячейка — чтобы
            //changeItem смог снять рамку вместе с предметом
            let rc = rarityColor(obj.rarity)
            itemFrameOn() && screenPic.push(rect(svgArr[2],cellPickArr[i].x,cellPickArr[i].y,"128px","128px",rc,"2px","none",{"rx":"3px","id":"rf"+i}))
            let miDollOpts = {"id":i,"func":e=>changeItem(e,obj),"funcShow":e => {e.buttons !== 1 ? tip(e,obj) : tipDel()},"funcShowOut":tipDel,"item":status.inventory.doll[i]}
            itemGlowOn() && (miDollOpts.blur = "filter: drop-shadow(0 0 4px "+rc+")")
            screenPic.push(image(svgArr[2],cellPickArr[i].x,cellPickArr[i].y,"128px","128px",status.inventory.doll[i].img,miDollOpts))}
        }
    }
    screenPic.push(image(svgArr[2],870,160,919,796,"./images/UI/panels/panel.png"))
    screenPic.push(text(svgArr[2],1325,215,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("ui.inventory"),{"id":"delItemText","size":60,"font":"baseFont4","anchor":"middle"}))
    let num = 0
    for (let j = 0; j < 4; j++) {
        for (let i = 0; i < 6; i++) {
            screenPic.push(image(svgArr[2],940 + i * 130,261 + j * 130,128,128,"./images/UI/panels/inv/emptyCell.png",{"id":13+num}))
            if (status.inventory.inv[num]) {
                let obj = JSON.parse(JSON.stringify(status.inventory.inv[num]))
                //V94: обводка редкости под спрайтом — та же, что вокруг спрайта в тултипе
                //V95: рамку/свечение можно отключить в Настройках; id "rf"+ячейка — для changeItem
                let rc = rarityColor(obj.rarity)
                itemFrameOn() && screenPic.push(rect(svgArr[2],940 + i * 130,261 + j * 130,128,128,rc,"2px","none",{"rx":"3px","id":"rf"+(13+num)}))
                let miInvOpts = {"id":13+num,"func":e=>changeItem(e,obj),"funcShow":e => {e.buttons !== 1 ? tip(e,obj) : tipDel()},"funcShowOut":tipDel,"item":status.inventory.inv[num]}
                itemGlowOn() && (miInvOpts.blur = "filter: drop-shadow(0 0 4px "+rc+")")
                screenPic.push(image(svgArr[2],940 + i * 130,261 + j * 130,128,128,status.inventory.inv[num].img,miInvOpts))
            }
            num++        
        }
    }
    //V59: спрайт кнопки — пустой emptyButton.png вместо next.png с запечённым текстом;
    //надпись «Далее» — локализованный текст поверх (раньше текст был запечён в спрайте)
    //E-22: эффект кнопки дублируется Пробелом (spaceNext.js) — то же замыкание
    //V124: кооп — после предметов игрока 1 экран перестраивается для игрока 2;
    //после игрока 2 — чистка кукол/рюкзаков ОБОИХ и лобби (в коопе — шаг игрока 1)
    const miNext = () => {
        if (status.players.length > 1 && miCoopIdx === 0) {
            miCoopIdx = 1
            setContext(status.players[1])
            metaItemsBuild(lose,next)
            return
        }
        if(next === false) {
            for (let i = 0; i < status.players.length; i++) {
                status.players[i].inventory.doll = [,,,,,,,,,,,,,]
                status.players[i].inventory.inv = [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false]
            }
        }
        status.players.length > 1 ? coopLobby(0,lose,next) : lobby(lose,next)
    }
    screenPic.push(image(svgArr[2],1920/2-341/2,960,341,96,"./images/UI/panels/buttons/button.png",{"glow":1,"func":miNext}))
    armSpaceNext(miNext)
    screenPic.push(text(svgArr[2],1920/2,1025,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("lobby.next"),{"id":"delItemText","size":48,"font":"baseFont4","anchor":"middle"}))
    screenPic.push(image(svgArr[2],1650,63,32,36,"./images/dungeon/drop/item1.png"))
    screenPic.push(text(svgArr[2],1710,95,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,change,{"id":"delItemText","size":42,"font":"baseFont4","anchor":"middle"}))
    invNumText = screenPic[screenPic.length-1]
}
function changeItem(e,obj) {
    let empty = false
    let lengthInv = status.meta.inv.length
    for (let i = 0; i < lengthInv; i++) {
        if(!status.meta.inv[i]) {
            empty = true
            break
        }
    }
    if(change > 0 && empty) {
        change--
        invNumText.textContent = change
        let lengthMetaInv = status.meta.inv.length
        for (let i = 0; i < lengthMetaInv; i++) {
            if(!status.meta.inv[i]) {
                status.meta.inv[i] = obj
                break
            }
        }
        parseInt(e.target.getAttribute("id").slice(0,-1)) < 13 ?
        status.inventory.doll[parseInt(e.target.getAttribute("id").slice(0,-1))] = null :
        status.inventory.inv[parseInt(e.target.getAttribute("id").slice(0,-1))-13] = null
        e.target.remove()
        //V95: рамка редкости принадлежит предмету — снимается вместе с ним
        //(id спрайта = ячейка+"I", id рамки = "rf"+ячейка)
        let fr = document.getElementById("rf" + e.target.getAttribute("id").slice(0,-1))
        fr && fr.remove()
        tipDel()
    }
}
export {metaItems}