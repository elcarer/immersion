import { svgArr,image, text, rect } from "../scripts/svg.js"
import { status } from "../scripts/start.js"
//V115: полосы ХП/опыта — суффиксы по игроку (players.js)
import { ctxBar,ctxTx,nextLvlExp } from "../scripts/players.js"
import * as basicData from "../scripts/data.js"
import { drag,doubleClickItem } from "../scripts/drag.js"
import { tip,tipDel,helpWord,rarityColor,itemFrameOn,itemGlowOn } from "../scripts/tip.js"
import { countDopStats } from "../scripts/countDopStats.js"
import { changeHP, dollArmor } from "../scripts/takeDamage.js"
import { musicDuck } from "../scripts/sound.js"
import { rectCellShow,rectCellShowDel } from "../scripts/inventory.js"
//V67: итог брони куклы (включая копию «Вечного сапфира») считает dollArmor() из takeDamage
//V58: локализация
import { T } from "../scripts/localization.js"

let dollTemp = []
let cellPickArr = [
    {"x":113,"y":260,"href":"./images/UI/doll/head.png"},{"x":243,"y":260,"href":"./images/UI/doll/cape.png"},
    {"x":113,"y":390,"href":"./images/UI/doll/shoulder.png"},{"x":243,"y":390,"href":"./images/UI/doll/torso.png"},
    {"x":113,"y":520,"href":"./images/UI/doll/bracer.png"},{"x":243,"y":520,"href":"./images/UI/doll/leg.png"},
    {"x":113,"y":650,"href":"./images/UI/doll/hand.png"},{"x":243,"y":650,"href":"./images/UI/doll/boots.png"},
    {"x":700,"y":260,"href":"./images/UI/doll/amulet.png"},{"x":700,"y":390,"href":"./images/UI/doll/ring.png"},
    {"x":700,"y":520,"href":"./images/UI/doll/belt.png"},{"x":410,"y":738,"href":"./images/UI/doll/mainHand.png"},
    {"x":546,"y":738,"href":"./images/UI/doll/offHand.png"}]
function doll() {
    svgArr[2].style.display = 'none'
    status.pause = 1
    status.move = 0
    status.panels = 1
    musicDuck(1)
    dollTemp.push(image(svgArr[2],50,160,823,796,"./images/UI/panels/equip.png"))
    //V60a: заголовок панели (в один ряд с «ИНВЕНТАРЬ» (1325,215) и «НАСТРОЙКИ» (960,215);
    //центр панели 50+823/2, полоса 160–260 над ячейками свободна)
    dollTemp.push(text(svgArr[2],461.5,215,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("doll.title"),{"id":"delItemText","size":60,"font":"baseFont4","anchor":"middle"}))
    status.info.upStat && dollTemp.push(text(svgArr[2],455,938,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("doll.unspent",status.info.upStat),{"id":"delItemText","size":40,"font":"baseFont4","anchor":"middle"}))
    let length = cellPickArr.length
    for (let i = 0; i < length; i++) {
        if (status.inventory.doll[i]) {dollTemp.push(image(svgArr[2],cellPickArr[i].x,cellPickArr[i].y,"128px","128px","./images/UI/doll/empty.png",{"id":i,"func":()=>{}}))
        let obj = JSON.parse(JSON.stringify(status.inventory.doll[i]))
        //V94: обводка редкости под спрайтом — та же, что вокруг спрайта в тултипе
        //V95: рамку/свечение можно отключить в Настройках
        let rc = rarityColor(obj.rarity)
        itemFrameOn() && dollTemp.push(rect(svgArr[2],cellPickArr[i].x,cellPickArr[i].y,"128px","128px",rc,"2px","none",{"rx":"3px"}))
        let dollOpts = {"id":i,"funcDrag":drag,"funcDbl":doubleClickItem,"funcShow":e => {rectCellShow(obj);e.buttons !== 1 ? tip(e,obj) : tipDel()},"funcShowOut":e => {tipDel();rectCellShowDel()},"item":status.inventory.doll[i]}
        itemGlowOn() && (dollOpts.blur = "filter: drop-shadow(0 0 4px "+rc+")")
        dollTemp.push(image(svgArr[2],cellPickArr[i].x,cellPickArr[i].y,"128px","128px",status.inventory.doll[i].img,dollOpts))
        //V111: оверлей пламени на иконке огненного оружия (слоты куклы)
        status.inventory.doll[i].fire && dollTemp.push(image(svgArr[2],cellPickArr[i].x,cellPickArr[i].y,"128px","128px","./images/effects/flameWeapon.png",{}))
        //V133: оверлей слизи на иконке предмета с эффектом «слизь» (слоты куклы)
        status.inventory.doll[i].slime && dollTemp.push(image(svgArr[2],cellPickArr[i].x,cellPickArr[i].y,"128px","128px","./images/effects/slimeShield.png",{}))
        //V138: оверлей роста на иконке предмета с эффектом «рост» (слоты куклы)
        status.inventory.doll[i].grow && dollTemp.push(image(svgArr[2],cellPickArr[i].x,cellPickArr[i].y,"128px","128px","./images/effects/plantGrow.png",{}))
        //V140: эффект «повязка» — оверлей на иконке пояса (кукла)
        status.inventory.doll[i].barb && dollTemp.push(image(svgArr[2],cellPickArr[i].x,cellPickArr[i].y,"128px","128px","./images/effects/barbTrue.png",{}))}
        else
        {dollTemp.push(image(svgArr[2],cellPickArr[i].x,cellPickArr[i].y,"128px","128px",cellPickArr[i].href,{"id":i,"func":()=>{}}))}
    }
    dollTemp.push(image(svgArr[2],410,261,260,441,"./images/UI/panels/charBack.png",{"func":viewStats}))
    dollTemp.push(image(svgArr[2],452,385,192,288,basicData.data.heroes[status.hero.class].img))
    dollTemp.push(text(svgArr[2],548,331,"0pt","50pt","none","2px",`rgb(204, 153, 102)`,T(basicData.data.heroes[status.hero.class].className),{"id":"buttonName","size":46,"font":"baseFont4","anchor":"middle"}))
    dollTemp.push(image(svgArr[2],493,356,110,14,"./images/UI/panels/expBar.png"))

    dollTemp.push(image(svgArr[2],703,655,123,209,"./images/UI/panels/paramsBack.png"))
    dollTemp.push(image(svgArr[2],720,666,32,32,"./images/UI/panels/fonIcon1.png",{"funcShow":e => helpWord(`rgb(204, 153, 102)`,0,e.target.x.animVal.value,e.target.y.animVal.value,statWordArr,statWordArrDesc),"funcShowOut":tipDel}))
    dollTemp.push(image(svgArr[2],720,704,32,32,"./images/UI/panels/fonIcon2.png",{"funcShow":e => helpWord(`rgb(204, 153, 102)`,1,e.target.x.animVal.value,e.target.y.animVal.value,statWordArr,statWordArrDesc),"funcShowOut":tipDel}))
    dollTemp.push(image(svgArr[2],720,742,32,32,"./images/UI/panels/fonIcon3.png",{"funcShow":e => helpWord(`rgb(204, 153, 102)`,2,e.target.x.animVal.value,e.target.y.animVal.value,statWordArr,statWordArrDesc),"funcShowOut":tipDel}))
    dollTemp.push(image(svgArr[2],720,780,32,32,"./images/UI/panels/fonIcon4.png",{"funcShow":e => helpWord(`rgb(204, 153, 102)`,3,e.target.x.animVal.value,e.target.y.animVal.value,statWordArr,statWordArrDesc),"funcShowOut":tipDel}))
    dollTemp.push(image(svgArr[2],720,818,32,32,"./images/UI/panels/fonIcon5.png",{"funcShow":e => helpWord(`rgb(204, 153, 102)`,4,e.target.x.animVal.value,e.target.y.animVal.value,statWordArr,statWordArrDesc),"funcShowOut":tipDel}))

    //V58: слова статов и их описаний — ключи локализации
    let statWordArr = ["stat.0.0","stat.0.1","stat.0.2","stat.0.3","stat.0.4"]
        let statWordArrDesc = ["statdesc.0","statdesc.1","statdesc.2","statdesc.3","statdesc.4"]
    let lengthStats = basicData.data.heroes[status.hero.class].stats.length
    for (let i = 0; i < lengthStats; i++) {
        dollTemp.push(text(svgArr[2],790,692+i*38,"0pt","50pt","none","1px",`rgb(204, 153, 102)`,status.info.stats[i].value,{"id":"statValue"+i,"size":32,"font":"baseFont4","anchor":"middle","funcShow":e => helpWord(`rgb(204, 153, 102)`,i,e.target.x.animVal[0].value,e.target.y.animVal[0].value,statWordArr,statWordArrDesc),"funcShowOut":tipDel}))
    }
    dollTemp.push(image(svgArr[2],120,784,242,28,"./images/UI/panels/decor0.png"))
    dollTemp.push(image(svgArr[2],120,850,242,28,"./images/UI/panels/decor1.png"))
    dollTemp.push(text(svgArr[2],165,841,"0pt","50pt","none","2px",`rgb(204, 153, 102)`,status.info.gold,{"id":"goldText","size":32,"font":"baseFont4","anchor":"middle"}))
    dollTemp.push(image(svgArr[2],190,823,20,20,"./images/UI/gold.png"))
    
    //V96: делитель — настоящий порог уровня (формула checkExp из damage.js), а не прежний
    //(1+30/(lvl+3))^(lvl/30): полоса показывала прогресс не к тому порогу.
    //V126 (репорт юзера): порог через nextLvlExp — В КООПЕ он ×2 (V122), а полоса над
    //портретом считала соло-порог и показывала двойной прогресс
    let lengthCol = status.info.exp*100 / nextLvlExp(status.info.lvl)
    for (let i = 0; i < lengthCol; i++) {
        dollTemp.push(image(svgArr[2],498+i,361,"1px","4px","./images/UI/panels/expBarCol.png"))
    }
    if(status.info.upStat > 0) {
        for (let i = 0; i < 5; i++) {
            dollTemp.push(image(svgArr[2],833,672+i*38,20,20,"./images/UI/upStat.png",{"glow":1,"func":() => upStat(i)}))
        }
    }
    dollTemp.push(text(svgArr[2],285,841,"0pt","50pt","none","2px",`rgb(204, 153, 102)`,status.info.keys,{"id":"keyText","size":32,"font":"baseFont4","anchor":"middle"}))
    dollTemp.push(image(svgArr[2],310,817,25,28,"./images/dungeon/drop/key.png"))
    dollTemp.push(image(svgArr[2],640,670,40,45,"./images/UI/armor.png"))
    //V67/V86: показываем ИТОГОВУЮ броню — dollArmor(): своя + копия щита «Вечного сапфира» +
    //сет «Турниры» (4 предмета) + активный баф магического щита (та же сумма, что в уроне)
    status.info.armorText = text(svgArr[2],660,702,"0pt","50pt","none","2px",`rgb(204, 153, 102)`,dollArmor(),{"id":"keyText","size":32,"font":"baseFont4","anchor":"middle"})
    dollTemp.push(status.info.armorText)
    svgArr[2].style.display = ''
}
function upStat(i) {
    status.info.stats[i].value++
    status.info.upStat--
    countDopStats()
    i === 2 && changeHP(ctxBar("hp"),ctxTx("hp"),"hp")
    dollDel(1)
    doll()
}
function dollDel(nomusic=0) {
    let range = dollTemp.length
    for (let i = 0; i < range; i++) {
        dollTemp[i].remove()
    }
    dollTemp = []
    status.move = 1
    status.panels = 0
    status.pause = 0
    let rangeDops = dopsView.length
        for (let i = 0; i < rangeDops; i++) {
            dopsView[i].remove()
        }
    dopsView = []
    tipDel()
    nomusic === 0 && musicDuck(0)
}
let dopsView = []
function viewStats() {
    if(dopsView.length === 0) {
        dopsView.push(image(svgArr[2],410,261,260,441,"./images/UI/panels/charBack.png",{"func":viewStats}))
        let lengthStats = status.info.stats.length
        for (let i = 0; i < lengthStats; i++) {
            let lengthDopStats = status.info.stats[i].dops.length
            for (let j = 0; j < lengthDopStats; j++) {
                dopsView.push(text(svgArr[2],435,301+i*81+j*27,"0pt","50pt","none","2px",`rgb(204, 153, 102)`,T(status.info.stats[i].dops[j].name),{"id":"dopStatName","size":24,"font":"baseFont4","anchor":"start","funcShow":e => helpWord(`rgb(204, 153, 102)`,i*3+j,e.target.x.animVal[0].value,e.target.y.animVal[0].value),"funcShowOut":tipDel}))
                dopsView.push(text(svgArr[2],579,301+i*81+j*27,"0pt","50pt","none","2px",`rgb(204, 153, 102)`,status.info.stats[i].dops[j].value1,{"id":"dopStatValue1"+(i*3+j),"size":24,"font":"baseFont4","anchor":"middle"}))
                dopsView.push(text(svgArr[2],627,301+i*81+j*27,"0pt","50pt","none","2px",`rgb(204, 153, 102)`,"("+status.info.stats[i].dops[j].value2+")",{"id":"buttonName","size":24,"font":"baseFont4","anchor":"middle"}))
            }
        }
    } else {
        let range = dopsView.length
        for (let i = 0; i < range; i++) {
            dopsView[i].remove()
        }
        dopsView = []
    }
}
export {doll,dollDel,dollTemp,cellPickArr,viewStats}