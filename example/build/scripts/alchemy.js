import { status } from "../scripts/start.js"
import { T } from "../scripts/localization.js"
import { svgArr,image,picById,text,rect,uiRightEdge,uiBottomEdge } from "../scripts/svg.js"
import { tip,tipDel,rarityColor,itemFrameOn,itemGlowOn } from "../scripts/tip.js"
import { cellPickArr } from "../scripts/doll.js"
//V54: объединение трёх предметов одного качества — снятие с куклы только через unEquip
//V67: «Вечный сапфир» — состав inv[0] изменился (удаление/новый предмет), копия пересчитывается
import { unEquip,changeDopStat } from "../scripts/drag.js"
import { itemGenerate } from "../scripts/itemGenerate.js"
import { playback,strike,musicDuck } from "../scripts/sound.js"

//V54: алхимический стол — интерактивный объект (тип 17, спрайты objects/15|35|55.png).
//Меню в стиле metaItems: кукла + инвентарь БЕЗ перетаскивания/даблклика — только ячейки,
//подсказки (tip.js) и выделение рамкой. Игра на паузе (status.pause=1, panels=9).
//Выход (кнопка/ESC через closePanels) НЕ расходует объект: obj[11]=1 держит до выхода
//героя из зоны (heroMove.checkObject) — «отойти и использовать повторно».
//Успешное объединение: −золото, 3 предмета удалены навсегда (кукла — через unEquip),
//itemGenerate качества+1 в инвентарь, объект получает obj[7]=1 и спрайт «d»-версии.
let alchemyTemp = []
let alchemyObj = null
//выделение: {src:"inv"|"doll", idx, item} — item ЖИВОЙ (по нему удаление), рамки параллельно
let alchemySelect = []
let selFrames = []
let mergeBtn = []
//стоимость объединения по хранимой редкости: 0 обычный, 1 редкий, 2 эпический (3 — сет, нельзя)
//V97: цены 0/20/100 (было 50/100/150); 0 = объединение обычных предметов бесплатное
let mergeCost = [0,20,100]

function openAlchemy(obj) {
    alchemyObj = obj
    musicDuck(1)
    svgArr[2].style.display = 'none'
    //чёрная подложка — скрывает игровое поле (как у Карты, map.js)
    alchemyTemp.push(rect(svgArr[2],0,0,uiRightEdge(),uiBottomEdge(),"black","1px","black"))
    alchemyTemp.push(image(svgArr[2],520,50,919,73,"./images/UI/panels/endTop.png"))
    alchemyTemp.push(text(svgArr[2],1920/2,106,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("alchemy.title"),{"id":"alchemyTitle","size":56,"font":"baseFont4","anchor":"middle"}))
    //кукла — только ячейки с предметами
    alchemyTemp.push(image(svgArr[2],50,160,823,796,"./images/UI/panels/equip.png"))
    let lengthDoll = cellPickArr.length
    for (let i = 0; i < lengthDoll; i++) {
        let cx = cellPickArr[i].x
        let cy = cellPickArr[i].y
        if (status.inventory.doll[i]) {
            alchemyTemp.push(image(svgArr[2],cx,cy,"128px","128px","./images/UI/doll/empty.png",{"id":"aD"+i}))
            let objShow = JSON.parse(JSON.stringify(status.inventory.doll[i]))
            let item = status.inventory.doll[i]
            //V94: обводка редкости под спрайтом — та же, что вокруг спрайта в тултипе
            //V95: рамку/свечение можно отключить в Настройках
            let rc = rarityColor(objShow.rarity)
            itemFrameOn() && alchemyTemp.push(rect(svgArr[2],cx,cy,"128px","128px",rc,"2px","none",{"rx":"3px"}))
            let aDollOpts = {"id":"aDe"+i,"func":e => toggleAlchemySelect(e,"doll",i,item,cx,cy),"funcShow":e => {e.buttons !== 1 ? tip(e,objShow) : tipDel()},"funcShowOut":tipDel,"item":item}
            itemGlowOn() && (aDollOpts.blur = "filter: drop-shadow(0 0 4px "+rc+")")
            alchemyTemp.push(image(svgArr[2],cx,cy,"128px","128px",item.img,aDollOpts))
        } else {
            alchemyTemp.push(image(svgArr[2],cx,cy,"128px","128px",cellPickArr[i].href,{"id":"aD"+i}))
        }
    }
    //инвентарь — только ячейки с предметами
    alchemyTemp.push(image(svgArr[2],870,160,919,796,"./images/UI/panels/panel.png"))
    alchemyTemp.push(text(svgArr[2],1325,215,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("ui.inventory"),{"id":"alchemyInvText","size":50,"font":"baseFont4","anchor":"middle"}))
    //золото этого забега (мета-очки не считаются) — крупно под ячейками инвентаря,
    //на пустой полосе панели, чтобы было видно, хватает ли на объединение
    alchemyTemp.push(image(svgArr[2],1237,852,30,30,"./images/UI/gold.png"))
    alchemyTemp.push(text(svgArr[2],1282,888,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,status.info.gold,{"id":"alchemyGold","size":42,"font":"baseFont4","anchor":"start"}))
    let num = 0
    for (let j = 0; j < 4; j++) {
        for (let i = 0; i < 6; i++) {
            let cx = 940 + i * 130
            let cy = 261 + j * 130
            alchemyTemp.push(image(svgArr[2],cx,cy,128,128,"./images/UI/panels/inv/emptyCell.png",{"id":"aI"+num}))
            if (status.inventory.inv[num]) {
                //V54 фикс: num — ВНЕШНЯЯ переменная цикла (после отрисовки равна 24) — замыкание
                //клика обязано захватывать ЛОКАЛЬНУЮ копию индекса, иначе удаление писало в inv[24]
                let idx = num
                let objShow = JSON.parse(JSON.stringify(status.inventory.inv[num]))
                let item = status.inventory.inv[num]
                //V94: обводка редкости под спрайтом — та же, что вокруг спрайта в тултипе
                //V95: рамку/свечение можно отключить в Настройках
                let rc = rarityColor(objShow.rarity)
                itemFrameOn() && alchemyTemp.push(rect(svgArr[2],cx,cy,128,128,rc,"2px","none",{"rx":"3px"}))
                let aInvOpts = {"id":"aIe"+idx,"func":e => toggleAlchemySelect(e,"inv",idx,item,cx,cy),"funcShow":e => {e.buttons !== 1 ? tip(e,objShow) : tipDel()},"funcShowOut":tipDel,"item":item}
                itemGlowOn() && (aInvOpts.blur = "filter: drop-shadow(0 0 4px "+rc+")")
                alchemyTemp.push(image(svgArr[2],cx,cy,128,128,item.img,aInvOpts))
            }
            num++
        }
    }
    //кнопка выхода: закрыть меню и возобновить игру, объект остаётся используемым
    alchemyTemp.push(image(svgArr[2],595,980,208,57,"./images/UI/panels/buttons/button.png",{"glow":1,"func":() => {playback(strike[14].vol,0,0,3*status.settings.soundVolume);alchemyDel(0)}}))
    alchemyTemp.push(text(svgArr[2],699,1020,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("ui.exit"),{"id":"alchemyExitText","size":42,"font":"baseFont4","anchor":"middle"}))
    //V101: подсказка внизу меню — суть эффекта стола (просьба пользователя); полоса под кнопками (ниже 1037)
    alchemyTemp.push(text(svgArr[2],1920/2,1066,"0pt","26pt","black","2px","rgba(204, 153, 102, 0.6)",T("alchemy.hint"),{"id":"alchemyHintText","size":26,"font":"baseFont4","anchor":"middle"}))
    refreshMergeButton()
    svgArr[2].style.display = ''
    //V147: пауза/панель ставятся ПОСЛЕ отрисовки всех узлов — если рисование упадёт,
    //игра НЕ зависает на «pause=1 при пустой панели» (такое залипание ловил авто-прогон:
    //флаги стояли, узлов не было, ESC бессилен — closePanels не видел alchemyTemp)
    status.pause = 1
    status.move = 0
    status.panels = 9
}

//клик по предмету — переключение рамки выделения (стиль рамки V39). Легендарки (rarity 3,
//сетовые) и реликвии (rarity 4, V67: максимальная редкость с уникальной способностью —
//уничтожать три реликвии ради «предмета качеством выше» нельзя) не выделяются вообще.
//Выделений больше трёх быть может — кнопка при этом скрыта.
function toggleAlchemySelect(e,src,idx,item,cx,cy) {
    if (item.rarity >= 3) return
    let found = -1
    let length = alchemySelect.length
    for (let k = 0; k < length; k++) {
        alchemySelect[k].item === item && (found = k)
    }
    if (found >= 0) {
        alchemySelect.splice(found,1)
        selFrames.splice(found,1)[0].remove()
        playback(strike[14].vol,0,0,3*status.settings.soundVolume)
        refreshMergeButton()
        return
    }
    alchemySelect.push({"src":src,"idx":idx,"item":item})
    let frame = rect(svgArr[2],cx,cy,128,128,"rgb(200, 248, 9)","4px","none",{"opacity":"1"})
    alchemyTemp.push(frame)
    selFrames.push(frame)
    playback(strike[14].vol,0,0,3*status.settings.soundVolume)
    refreshMergeButton()
}

//кнопка объединения видна только при ровно 3 выделенных одного не-легендарного качества.
//Активна при достаточном золоте И свободном слоте инвентаря под результат (слоты выделенных
//из инвентаря считаются освобождающимися); иначе тёмная (полупрозрачная) и неактивная.
//V97: три выделенных разной редкости — тёмная кнопка с подсказкой «одной редкости»;
//цены 0/20/100 — обычные предметы объединяются бесплатно.
function refreshMergeButton() {
    let length = mergeBtn.length
    for (let i = 0; i < length; i++) {
        mergeBtn[i].remove()
    }
    mergeBtn = []
    if (alchemySelect.length !== 3) return
    let rarity = alchemySelect[0].item.rarity
    for (let k = 1; k < 3; k++) {
        alchemySelect[k].item.rarity !== rarity && (rarity = -1)
    }
    if (rarity < 0) {
        //V97: три выделенных разной редкости — раньше кнопка молча не рисовалась вовсе;
        //теперь та же тёмная неактивная кнопка, но с подсказкой (место «недостаточно золота»)
        mergeBtn.push(image(svgArr[2],865,980,380,57,"./images/UI/panels/buttons/button.png",{"opacity":"0.25"}))
        mergeBtn.push(text(svgArr[2],1055,1020,"0pt","50pt","black","2px","rgba(204, 153, 102, 0.35)",T("alchemy.samerarity"),{"id":"alchemyMergeText","size":30,"font":"baseFont4","anchor":"middle"}))
        return
    }
    if (rarity > 2) return
    let cost = mergeCost[rarity]
    let freeInv = 0
    let lengthInv = status.inventory.inv.length
    for (let i = 0; i < lengthInv; i++) {
        !status.inventory.inv[i] && freeInv++
    }
    let selectedInv = 0
    for (let k = 0; k < 3; k++) {
        alchemySelect[k].src === "inv" && selectedInv++
    }
    let canGold = status.info.gold >= cost
    let canSlot = freeInv + selectedInv >= 1
    let can = canGold && canSlot
    //неактивная кнопка ПРОСТО ТЕКСТОМ называет причину (тёмная и с прозрачностью 0.25):
    //раньше молчаливый клик по тёмной кнопке выглядел как «объединение не сработало»
    mergeBtn.push(image(svgArr[2],865,980,380,57,"./images/UI/panels/buttons/button.png",can ? {"glow":1,"func":mergeSelected} : {"opacity":"0.25"}))
    mergeBtn.push(text(svgArr[2],1055,1020,"0pt","50pt","black","2px",can ? `rgb(204, 153, 102)` : "rgba(204, 153, 102, 0.35)",can ? T("alchemy.merge",cost) : (canGold ? T("alchemy.nospace") : T("alchemy.nogold",cost)),{"id":"alchemyMergeText","size":30,"font":"baseFont4","anchor":"middle"}))
}

function mergeSelected() {
    if (alchemySelect.length !== 3 || !alchemyObj) return
    let rarity = alchemySelect[0].item.rarity
    for (let k = 1; k < 3; k++) {
        alchemySelect[k].item.rarity !== rarity && (rarity = -1)
    }
    if (rarity < 0 || rarity > 2) return
    let cost = mergeCost[rarity]
    if (status.info.gold < cost) return
    //удаление/оплата/генерация — в try/finally: меню обязано закрыться при любом сбое,
    //причина пишется в консоль (иначе половинное состояние выглядит как «предметы не удалились»)
    try {
        //три выделенных предмета удаляются навсегда; с куклы — через unEquip (статы/броня/оружие)
        for (let k = 0; k < 3; k++) {
            let s = alchemySelect[k]
            if (s.src === "doll") {
                status.inventory.doll[s.idx] = null
                unEquip(s.item)
            } else {
                status.inventory.inv[s.idx] = null
            }
        }
        status.info.gold -= cost
        //новый случайный предмет качеством выше — itemGenerate сам кладёт в первый слот инвентаря
        //(проверка свободного слота сделана в refreshMergeButton)
        itemGenerate(rarity + 2)
        //V67 «Вечный сапфир»: удалены/созданы предметы инвентаря — inv[0] мог измениться,
        //копия пересчитывается (unEquip с куклы пересчитал сам, добавка безвредна)
        changeDopStat()
        //объект использован: флаг + спрайт «d»-версии (15d/35d/55d), как у прочих объектов.
        //Поиск защитный: без animVal-чтений и с guard от не-элементов в screenPic
        alchemyObj[7] = 1
        let img = picById(alchemyObj[6]+"OI")
        if (img) {
            let href = img.getAttribute("href") || ""
            img.setAttribute("href", href.slice(0,-4)+"d"+href.slice(-4))
        }
        playback(strike[13].vol,0,0,2*status.settings.soundVolume)
    } catch (e) {
        console.error("V54: ошибка объединения предметов:", e)
    } finally {
        alchemyDel(0)
    }
}

function alchemyDel(nomusic=0) {
    let length = alchemyTemp.length
    for (let i = 0; i < length; i++) {
        alchemyTemp[i].remove()
    }
    alchemyTemp = []
    selFrames = []
    //V54 фикс: кнопка объединения живёт в mergeBtn, а НЕ в alchemyTemp — раньше она
    //не удалялась и оставалась «призраком» на экране после закрытия меню
    let lengthM = mergeBtn.length
    for (let i = 0; i < lengthM; i++) {
        mergeBtn[i].remove()
    }
    mergeBtn = []
    alchemySelect = []
    alchemyObj = null
    status.move = 1
    status.panels = 0
    status.pause = 0
    tipDel()
    nomusic === 0 && musicDuck(0)
}

export {openAlchemy,alchemyDel,alchemyTemp,alchemySelect}
