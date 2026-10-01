import { status } from "../scripts/start.js"
import { T } from "../scripts/localization.js"
import { svgArr,image,picById,text,rect,uiRightEdge,uiBottomEdge } from "../scripts/svg.js"
import { tip,tipDel,rarityColor,itemFrameOn,itemGlowOn } from "../scripts/tip.js"
import { cellPickArr } from "../scripts/doll.js"
//V155: алтарь-наковальня (тип 24) — перековка ОДНОГО основного стата предмета за золото.
//V54: снятие с куклы и пересчёт статов — те же приёмы, что у алхимического стола
//V67: «Вечный сапфир» — состав inv[0] не меняется (предмет остаётся), но пересчёт
//безвреден; changeDopStat нужен для пересчёта статов героя после смены стата предмета
import { changeDopStat } from "../scripts/drag.js"
//V153: сет «Исследователь пустоты» — шанс, что наковальня не гаснет после перековки
import { rollVoidReuse } from "../scripts/sets.js"
import { playback,strike,musicDuck } from "../scripts/sound.js"

//V155: алтарь-наковальня — интерактивный объект (тип 24, спрайты objects/103|103d.png,
//один вид на все этажи). Меню в стиле алхимического стола (alchemy.js): кукла + инвентарь
//БЕЗ перетаскивания — только ячейки, тултипы и выделение. Игра на паузе (pause=1, panels=13).
//Выбирается ОДИН предмет, у которого есть ОСНОВНОЙ стат (stat 0-4: Сила/Ловкость/Здоровье/
//Скорость/Мудрость — statCount > 0). Реликвии (stat нет), пояса (stat 5) и щиты/книги
//(stat 6) не перековываются. Цена = 5 золота за КАЖДУЮ единицу стата (решение пользователя; V166 — было 10);
//стат заменяется на СЛУЧАЙНЫЙ из остальных четырёх той же величины (statCount сохраняется).
//Перековка гасит объект (obj[7]=1, спрайт 103d.png); сет «Исследователь пустоты» (3 надетых)
//с шансом 10% оставляет его переиспользуемым (obj[11]=1, rollVoidReuse) — как у алхимии.
//Выход (кнопка/ESC) объект НЕ расходует.
let anvilTemp = []
let anvilObj = null
//выделение: {src:"inv"|"doll", idx, item} — item ЖИВОЙ (по нему замена стата), ровно одно
let anvilSelect = null
let selFrame = null
let reforgeBtn = []

function openAnvil(obj) {
    anvilObj = obj
    musicDuck(1)
    svgArr[2].style.display = 'none'
    //чёрная подложка — скрывает игровое поле (как у Карты, map.js)
    anvilTemp.push(rect(svgArr[2],0,0,uiRightEdge(),uiBottomEdge(),"black","1px","black"))
    anvilTemp.push(image(svgArr[2],520,50,919,73,"./images/UI/panels/endTop.png"))
    anvilTemp.push(text(svgArr[2],1920/2,106,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("anvil.title"),{"id":"anvilTitle","size":56,"font":"baseFont4","anchor":"middle"}))
    //кукла — только ячейки с предметами
    anvilTemp.push(image(svgArr[2],50,160,823,796,"./images/UI/panels/equip.png"))
    let lengthDoll = cellPickArr.length
    for (let i = 0; i < lengthDoll; i++) {
        let cx = cellPickArr[i].x
        let cy = cellPickArr[i].y
        if (status.inventory.doll[i]) {
            anvilTemp.push(image(svgArr[2],cx,cy,"128px","128px","./images/UI/doll/empty.png",{"id":"nD"+i}))
            let objShow = JSON.parse(JSON.stringify(status.inventory.doll[i]))
            let item = status.inventory.doll[i]
            let rc = rarityColor(objShow.rarity)
            itemFrameOn() && anvilTemp.push(rect(svgArr[2],cx,cy,"128px","128px",rc,"2px","none",{"rx":"3px"}))
            let aDollOpts = {"id":"nDe"+i,"func":e => toggleAnvilSelect(e,"doll",i,item,cx,cy),"funcShow":e => {e.buttons !== 1 ? tip(e,objShow) : tipDel()},"funcShowOut":tipDel,"item":item}
            itemGlowOn() && (aDollOpts.blur = "filter: drop-shadow(0 0 4px "+rc+")")
            anvilTemp.push(image(svgArr[2],cx,cy,"128px","128px",item.img,aDollOpts))
        } else {
            anvilTemp.push(image(svgArr[2],cx,cy,"128px","128px",cellPickArr[i].href,{"id":"nD"+i}))
        }
    }
    //инвентарь — только ячейки с предметами
    anvilTemp.push(image(svgArr[2],870,160,919,796,"./images/UI/panels/panel.png"))
    anvilTemp.push(text(svgArr[2],1325,215,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("ui.inventory"),{"id":"anvilInvText","size":50,"font":"baseFont4","anchor":"middle"}))
    //золото этого забега — крупно под ячейками инвентаря (как у алхимии)
    anvilTemp.push(image(svgArr[2],1237,852,30,30,"./images/UI/gold.png"))
    anvilTemp.push(text(svgArr[2],1282,888,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,status.info.gold,{"id":"anvilGold","size":42,"font":"baseFont4","anchor":"start"}))
    let num = 0
    for (let j = 0; j < 4; j++) {
        for (let i = 0; i < 6; i++) {
            let cx = 940 + i * 130
            let cy = 261 + j * 130
            anvilTemp.push(image(svgArr[2],cx,cy,128,128,"./images/UI/panels/inv/emptyCell.png",{"id":"nI"+num}))
            if (status.inventory.inv[num]) {
                let idx = num
                let objShow = JSON.parse(JSON.stringify(status.inventory.inv[num]))
                let item = status.inventory.inv[num]
                let rc = rarityColor(objShow.rarity)
                itemFrameOn() && anvilTemp.push(rect(svgArr[2],cx,cy,128,128,rc,"2px","none",{"rx":"3px"}))
                let aInvOpts = {"id":"nIe"+idx,"func":e => toggleAnvilSelect(e,"inv",idx,item,cx,cy),"funcShow":e => {e.buttons !== 1 ? tip(e,objShow) : tipDel()},"funcShowOut":tipDel,"item":item}
                itemGlowOn() && (aInvOpts.blur = "filter: drop-shadow(0 0 4px "+rc+")")
                anvilTemp.push(image(svgArr[2],cx,cy,128,128,item.img,aInvOpts))
            }
            num++
        }
    }
    //кнопка выхода: закрыть меню и возобновить игру, объект остаётся используемым
    anvilTemp.push(image(svgArr[2],595,980,208,57,"./images/UI/panels/buttons/button.png",{"glow":1,"func":() => {playback(strike[14].vol,0,0,3*status.settings.soundVolume);anvilDel(0)}}))
    anvilTemp.push(text(svgArr[2],699,1020,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("ui.exit"),{"id":"anvilExitText","size":42,"font":"baseFont4","anchor":"middle"}))
    //подсказка внизу меню — суть эффекта наковальни (как у алхимии)
    anvilTemp.push(text(svgArr[2],1920/2,1066,"0pt","26pt","black","2px","rgba(204, 153, 102, 0.6)",T("anvil.hint"),{"id":"anvilHintText","size":26,"font":"baseFont4","anchor":"middle"}))
    refreshReforgeButton()
    svgArr[2].style.display = ''
    //V147: пауза/панель ставятся ПОСЛЕ отрисовки всех узлов (гвард от «pause=1 при пустой панели»)
    status.pause = 1
    status.move = 0
    status.panels = 13
}

//клик по предмету — выделение единственного предмета с основным статом (stat 0-4 и
//statCount > 0). Реликвии (stat нет), пояса (stat 5), щиты/книги (stat 6) не выделяются
//вообще. Повторный клик по выделенному снимает выделение; клик по другому переносит его
function toggleAnvilSelect(e,src,idx,item,cx,cy) {
    if (item.stat === undefined || item.stat > 4 || !(item.statCount > 0)) return
    if (anvilSelect && anvilSelect.item === item) {
        anvilSelect = null
        selFrame && selFrame.remove()
        selFrame = null
        playback(strike[14].vol,0,0,3*status.settings.soundVolume)
        refreshReforgeButton()
        return
    }
    anvilSelect = {"src":src,"idx":idx,"item":item}
    selFrame && selFrame.remove()
    selFrame = rect(svgArr[2],cx,cy,128,128,"rgb(200, 248, 9)","4px","none",{"opacity":"1"})
    anvilTemp.push(selFrame)
    playback(strike[14].vol,0,0,3*status.settings.soundVolume)
    refreshReforgeButton()
}

//кнопка перековки: видна при выделенном предмете; активна при достаточном золоте —
//цена 5 золота за каждую единицу стата (V166, было 10). Неактивная называет причину текстом
//V155: строка выбранного стата — «Сила +4» + куда заменится, над кнопкой
function refreshReforgeButton() {
    let length = reforgeBtn.length
    for (let i = 0; i < length; i++) {
        reforgeBtn[i].remove()
    }
    reforgeBtn = []
    if (!anvilSelect) return
    let item = anvilSelect.item
    let cost = 5 * item.statCount
    let can = status.info.gold >= cost
    reforgeBtn.push(text(svgArr[2],1055,948,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("anvil.will",T(statKey(item.stat)),item.statCount),{"id":"anvilWillText","size":28,"font":"baseFont4","anchor":"middle"}))
    reforgeBtn.push(image(svgArr[2],865,980,380,57,"./images/UI/panels/buttons/button.png",can ? {"glow":1,"func":reforgeSelected} : {"opacity":"0.25"}))
    reforgeBtn.push(text(svgArr[2],1055,1020,"0pt","50pt","black","2px",can ? `rgb(204, 153, 102)` : "rgba(204, 153, 102, 0.35)",can ? T("anvil.reforge",cost) : T("anvil.nogold",cost),{"id":"anvilReforgeText","size":30,"font":"baseFont4","anchor":"middle"}))
}

//ключ имени стата — та же таблица, что в тултипе (tip.js statArr)
function statKey(stat) {
    return ["stat.0.0","stat.0.1","stat.0.2","stat.0.3","stat.0.4"][stat]
}

function reforgeSelected() {
    if (!anvilSelect || !anvilObj) return
    let item = anvilSelect.item
    let cost = 5 * item.statCount
    if (status.info.gold < cost) return
    //замена/оплата/гашение — в try/finally: меню обязано закрыться при любом сбое
    try {
        //случайный ДРУГОЙ стат из оставшихся четырёх, той же величины (statCount сохраняется)
        let pool = [0,1,2,3,4].filter(t => t !== item.stat)
        item.stat = pool[Math.trunc(Math.random() * pool.length)]
        status.info.gold -= cost
        //пересчёт статов героя (предмет мог быть на кукле — стат поменялся)
        changeDopStat()
        //объект использован: флаг + спрайт «d»-версии (103d), как у прочих объектов.
        //V153: сет «Исследователь пустоты» (3 надетых) — с шансом 10% не гаснет (obj[11]=1)
        if (rollVoidReuse()) {
            anvilObj[11] = 1
        } else {
            anvilObj[7] = 1
            let img = picById(anvilObj[6]+"OI")
            if (img) {
                let href = img.getAttribute("href") || ""
                img.setAttribute("href", href.slice(0,-4)+"d"+href.slice(-4))
            }
        }
        playback(strike[13].vol,0,0,2*status.settings.soundVolume)
    } catch (e) {
        console.error("V155: ошибка перековки предмета:", e)
    } finally {
        anvilDel(0)
    }
}

function anvilDel(nomusic=0) {
    let length = anvilTemp.length
    for (let i = 0; i < length; i++) {
        anvilTemp[i].remove()
    }
    anvilTemp = []
    selFrame = null
    let lengthM = reforgeBtn.length
    for (let i = 0; i < lengthM; i++) {
        reforgeBtn[i].remove()
    }
    reforgeBtn = []
    anvilSelect = null
    anvilObj = null
    status.move = 1
    status.panels = 0
    status.pause = 0
    tipDel()
    nomusic === 0 && musicDuck(0)
}

export {openAnvil,anvilDel,anvilTemp,anvilSelect,toggleAnvilSelect,reforgeSelected}
