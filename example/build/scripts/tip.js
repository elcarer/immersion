import { svgArr,image,rect,text,nativeHtml } from "../scripts/svg.js"
import * as basicData from "../scripts/data.js"
import { status } from "../scripts/start.js"
//V53: окошко сета «Великий вор» — рисуется под основным тултипом идентифицированной легендарки
import { SETS,itemSet,isSetItem,setCount } from "../scripts/sets.js"
//V58: локализация — T() для строк, itemName() для имён предметов (сборка из ключей)
import { T,itemName } from "../scripts/localization.js"

let tempTip = []
//V58: подписи статов/допов/их описаний — КЛЮЧИ локализации (вместо русских литералов).
//stat 5/6 («Ячейки», «Броня») — отдельные ключи ui.stat.*; слова допов общие для классов —
//берутся из строки допов класса 0 (слова во всех классах одинаковые)
let statArr = ["stat.0.0","stat.0.1","stat.0.2","stat.0.3","stat.0.4","ui.stat.cells","ui.stat.armor"]
let statArrDop = ["dop.0.0.0","dop.0.0.1","dop.0.0.2","dop.0.1.0","dop.0.1.1","dop.0.1.2","dop.0.2.0","dop.0.2.1","dop.0.2.2","dop.0.3.0","dop.0.3.1","dop.0.3.2","dop.0.4.0","dop.0.4.1","dop.0.4.2"]
let statArrDopDesc = ["dopdesc.0","dopdesc.1","dopdesc.2","dopdesc.3","dopdesc.4","dopdesc.5","dopdesc.6","dopdesc.7","dopdesc.8","dopdesc.9","dopdesc.10","dopdesc.11","dopdesc.12","dopdesc.13","dopdesc.14"]
//V29: цвет рамки по редкости — один источник для всех окон (основной тулип,
//окно сравнения, карточка предмета); раньше блок повторялся трижды
//V67: редкость 4 — реликвия, КРАСНЫЙ (решение пользователя)
function rarityColor(rarity) {
    let color = `rgb(204, 153, 102)`
    rarity === 0 && (color = "grey")
    rarity === 1 && (color = "#0066FF")
    rarity === 2 && (color = "#9933CC")
    rarity === 3 && (color = "#FFCC66")
    rarity === 4 && (color = "#FF0000")
    return color
}
//V95: переключатели эффектов предметов из Настроек («Рамка предметов»/«Свечение предметов»).
//Отношение только к рамкам/свечению на ячейках интерфейса (V94) — тултип свои рамку и
//свечение показывает всегда. В старых сейвах полей нет: отсутствие = включено
function itemFrameOn() {
    return status.settings.itemFrames !== 0
}
function itemGlowOn() {
    return status.settings.itemGlow !== 0
}
//V29: координаты ЛЕВОГО ВЕРХНЕГО угла основного тулипа под курсором — общие для
//основного окна и окна сравнения (то же позиционирование, что было в tip() инлайн):
//справа от иконки (+128), прижим к левой половине экрана при x>1280, клампы по Y.
//V53: lower=1 — под окном будет ещё окошко сета, кламп Y жёстче (10..196), чтобы
//основное окно 600px + зазор + окно сета гарантированно влезали в viewBox 1080
function tipCoords(e,lower=0) {
    let x = e.target.x.animVal.value+128
    let y = e.target.y.animVal.value-300
    x > 1280 && (x -= 528)
    y < 10 && (y = 10)
    y > 470 && (y = 470)
    lower && y > 196 && (y = 196)
    return [x,y]
}
//V27c: автопоказ КОМПАКТНОЙ карточки поднятого предмета — правый нижний угол экрана,
//высота по числу строк характеристик; БЕЗ боковых словарей (helpWord/helpWord2/helpWord3
//не вызываются) и БЕЗ фейкового event.target — карточка рисуется сама через rect/text/image.
//Отсчёт тиковый (itemTipTick из gameLoop). Любой РУЧНОЙ вызов tip() сбрасывает авто-окно:
//наведённый игроком тулип таймер не гасит (и наоборот — tipDel() сотрёт карточку).
const ITEM_TIP_TICKS = 125 //~2с при 16мс/тик
let itemTipLeft = 0

//V28a: читаемость — ШРИФТЫ УВЕЛИЧЕНЫ ВДВОЕ (заголовок 30 / строки 24 / desc 20,
//было 15/12/10). Окно выросло 200→360px по ширине (пропорционально шрифту),
//высота считается из числа СТРОК ПОСЛЕ ПЕРЕНОСА длинных текстов (ability-desc
//и подсказки статов переносятся по словам; точная ширина — getBBox реального
//рендера, при недоступности — грубая оценка len×0.56×size). Привязка к правому
//нижнему углу и отсутствие боковых словарей сохранены.
const IT_W = 360                 // ширина карточки
const IT_PADX = 18               // боковые поля; макс. ширина строки = W−2·PADX
const IT_F_TITLE = 30
const IT_F_ROW = 24
const IT_F_DESC = 20
function itMeasure(str, size) {
    try {
        const t = text(svgArr[2], -99999, -99999, "0pt", "50pt", "none", "1px", "black", str, {"size":size,"font":"baseFont4"})
        const w = t.getBBox().width
        t.remove()
        return w || str.length * size * 0.56
    } catch {
        return str.length * size * 0.56
    }
}
//жадный перенос по словам: массив строк, каждая гарантированно ≤ maxPx
function itWrap(str, size, maxPx) {
    const words = String(str).split(" ")
    const out = []
    let cur = ""
    for (let i = 0; i < words.length; i++) {
        const probe = cur ? cur + " " + words[i] : words[i]
        if (cur && itMeasure(probe, size) > maxPx) {
            out.push(cur)
            cur = words[i]
        } else cur = probe
    }
    cur && out.push(cur)
    return out.length ? out : [String(str)]
}
//V60: заголовок тултипа. Название ≤24 символов (включая пробелы — замер пользователя)
//влезает: одна строка 38px, как раньше. Длиннее — шрифт меньше (30px) и ДО ДВУХ строк
//(деление по словам с балансом длин половин, базлайны y−15/y+15); если половина всё
//равно шире окна — дозжим шрифта по 2px (одно слово без пробелов не дробим — только жмём).
//Применяется во всех трёх окнах с одинаковой геометрией заголовка: основной тулип,
//окно сравнения (compareTip) и окно уровня способности (lvlTip) — решение пользователя
const TIP_TITLE_MAX = 24   //символов — порог «влезает/не влезает»
const TIP_TITLE_W = 364    //внутренняя ширина окна 400 − боковые поля (как maxPx в setTip)
function tipTitle(x,y,color,name,id) {
    const s = String(name)
    if (s.length <= TIP_TITLE_MAX) {
        tempTip.push(text(svgArr[2],x,y,"0pt","50pt","none","2px",color,s,{"id":id,"size":38,"font":"baseFont4","anchor":"middle"}))
        return
    }
    const parts = splitTitleBalanced(s)
    let size = 30
    while (size > 22 && parts.some(p => itMeasure(p,size) > TIP_TITLE_W)) size -= 2
    if (parts.length === 1) {
        tempTip.push(text(svgArr[2],x,y,"0pt","50pt","none","2px",color,parts[0],{"id":id,"size":size,"font":"baseFont4","anchor":"middle"}))
    } else {
        tempTip.push(text(svgArr[2],x,y-15,"0pt","50pt","none","2px",color,parts[0],{"id":id,"size":size,"font":"baseFont4","anchor":"middle"}))
        tempTip.push(text(svgArr[2],x,y+15,"0pt","50pt","none","2px",color,parts[1],{"id":id,"size":size,"font":"baseFont4","anchor":"middle"}))
    }
}
//деление названия на две части по словам с минимальной разницей длин (одно слово — без деления)
function splitTitleBalanced(s) {
    const words = s.split(" ")
    if (words.length < 2) return [s]
    let best = [s]
    let diff = Infinity
    for (let i = 1; i < words.length; i++) {
        const a = words.slice(0,i).join(" ")
        const b = words.slice(i).join(" ")
        const d = Math.abs(a.length - b.length)
        if (d < diff) { diff = d; best = [a,b] }
    }
    return best
}
function showItemTip(obj) {
    const color = rarityColor(obj.rarity)
    //логические строки считаем ДО создания плашки, затем переносим длинные
    let lines = []
    if (obj.type !== undefined) {
        let d = obj.type.desc2 ? T(obj.type.desc1)+" - "+T(obj.type.desc2) : T(obj.type.desc1)
        lines.push(["#CC9900", d])
    }
    obj.damage !== undefined && lines.push(["#cc9966", T("tip.damage",obj.damage)])
    obj.attack !== undefined && lines.push(["#cc9966", T("tip.attack",T(basicData.data.attacks[obj.attack].name),basicData.data.attacks[obj.attack].cooldown)])
    obj.stat !== undefined && lines.push(["#999999", T(statArr[obj.stat]) + " +" + obj.statCount])
    obj.dopType !== undefined && lines.push(["#9999FF", T(statArrDop[obj.dopType]) + " +" + obj.dop])
    obj.abil !== undefined && lines.push(["#9933CC", T(obj.abil.desc)])
    const maxPx = IT_W - IT_PADX * 2
    let rows = [] //перенесённые строки характеристик
    for (let i = 0; i < lines.length; i++)
        for (const part of itWrap(lines[i][1], IT_F_ROW, maxPx)) rows.push([lines[i][0], part])
    const rowTitles = itWrap(itemName(obj), IT_F_TITLE, maxPx)     //длинное название тоже переносим
    const rowDesc = itWrap(T(obj.desc ?? ""), IT_F_DESC, maxPx)
    //вертикаль: картинка 56 вверху + заголовок(ы) + строки + desc; щели за счёт
    //прежнего пустого места окна — высота растёт только от реального числа строк
    const H = 94 - 8 + rowTitles.length * 32 + 4 + rows.length * 28 + 8 + rowDesc.length * 24 + 16
    const X = 1920 - IT_W - 12 //отступы 12px от правого и нижнего краёв viewBox 1920×1080
    const Y = 1080 - H - 12
    tempTip.push(rect(svgArr[2], X, Y, IT_W, H, color, "3px", "black", {"id":"itemDropTip","rx":"5px"}))
    tempTip.push(image(svgArr[2], X + (IT_W - 56) / 2, Y + 8, 56, 56, obj.img, {"blur":"filter: drop-shadow(0 0 4px "+color+")"}))
    let cy = Y + 94
    for (let i = 0; i < rowTitles.length; i++) {
        tempTip.push(text(svgArr[2], X + IT_W / 2, cy, "0pt","50pt","none","1px", color, rowTitles[i], {"id":"itemName","size":IT_F_TITLE,"font":"baseFont4","anchor":"middle"}))
        cy += 32
    }
    cy += 4
    for (let i = 0; i < rows.length; i++) {
        tempTip.push(text(svgArr[2], X + IT_W / 2, cy, "0pt","50pt","none","1px", rows[i][0], rows[i][1], {"id":"itemName","size":IT_F_ROW,"font":"baseFont4","anchor":"middle"}))
        cy += 28
    }
    cy += 8
    for (let i = 0; i < rowDesc.length; i++) {
        tempTip.push(text(svgArr[2], X + IT_W / 2, cy, "0pt","50pt","none","1px", color, rowDesc[i], {"id":"itemName","size":IT_F_DESC,"font":"baseFont4","anchor":"middle"}))
        cy += 24
    }
    itemTipLeft = ITEM_TIP_TICKS
}
function itemTipTick() {
    if (itemTipLeft <= 0) return
    itemTipLeft--
    if (itemTipLeft === 0) {
        //гасим только если это всё ещё наше окно (не заменено ручным тулипом)
        tempTip.length > 0 && tipDel()
    }
}
function tip (e,obj) {
    itemTipLeft = 0 //ручной тулип отменяет авточистку карточки предмета
    tipDel()
    obj.rarity === undefined && (obj.rarity = 5)
    //V53: у идентифицированной легендарки под основным окном будет окошко сета — кламп Y жёстче
    const [x,y] = tipCoords(e, isSetItem(obj) ? 1 : 0)
    const color = rarityColor(obj.rarity)
    tempTip.push(rect(svgArr[2],x,y,400,600,color,"4px","black",{"id":"tip","rx":"6px"}))
    //V60: длинное название — меньше шрифт и до двух строк (см. tipTitle)
    tipTitle(x+200,y+45,color,itemName(obj),"itemName")
    tempTip.push(rect(svgArr[2],x+71,y+66,258,258,color,"2px","black",{"id":"tip","rx":"6px"}))
    tempTip.push(image(svgArr[2],x+72,y+67,256,256,obj.img,{"blur":'filter: drop-shadow(0 0 4px '+color+')'}))
    let strokeNum = 0
    if (obj.type!==undefined) {
        let desc
        obj.type.desc2 ? desc = T(obj.type.desc1)+" - "+T(obj.type.desc2) : desc = T(obj.type.desc1)
        tempTip.push(text(svgArr[2],x+200,y+365+strokeNum*35,"0pt","50pt","none","2px","#CC9900",desc,{"id":"itemName","size":32,"font":"baseFont4","anchor":"middle"}))
        strokeNum++
    }
    if (obj.damage) {
        tempTip.push(text(svgArr[2],x+200,y+365+strokeNum*35,"0pt","50pt","none","2px","#cc9966",T("tip.damage",obj.damage),{"id":"itemName","size":32,"font":"baseFont4","anchor":"middle"}))
        strokeNum++
    }
    if (obj.attack !== undefined) {
        tempTip.push(text(svgArr[2],x+200,y+365+strokeNum*35,"0pt","50pt","none","2px","#cc9966",T("tip.attack",T(basicData.data.attacks[obj.attack].name),basicData.data.attacks[obj.attack].cooldown),{"id":"itemName","size":32,"font":"baseFont4","anchor":"middle"}))
        strokeNum++
    }
    if (obj.stat!==undefined) {
        tempTip.push(text(svgArr[2],x+200,y+365+strokeNum*35,"0pt","50pt","none","2px","#999999",T(statArr[obj.stat]) + " +" + obj.statCount,{"id":"itemName","size":32,"font":"baseFont4","anchor":"middle"}))
        strokeNum++
    }
    if (obj.dopType!==undefined) {
        tempTip.push(text(svgArr[2],x+200,y+365+strokeNum*35,"0pt","50pt","none","2px","#9999FF",T(statArrDop[obj.dopType]) + " +" + obj.dop,{"id":"itemName","size":32,"font":"baseFont4","anchor":"middle"}))
        strokeNum++
        helpWord(color,obj.dopType,x-16,y)
    }
    if (obj.abil!==undefined) {
        tempTip.push(text(svgArr[2],x+200,y+365+strokeNum*35,"0pt","50pt","none","2px","#9933CC",T(obj.abil.desc),{"id":"itemName","size":32,"font":"baseFont4","anchor":"middle"}))
        strokeNum++
    }
    obj.abil && obj.rarity > 1 && obj.rarity < 5 && helpWord2(color,obj.abil,x-16,y+255)
    tempTip.push(text(svgArr[2],x+200,y+580,"0pt","50pt","none","2px",color,T(obj.desc),{"id":"itemName","size":26,"font":"baseFont4","anchor":"middle"}))
    if(obj.descFull) {
        let y1 = y
        obj.damage && (y1 = y1 + 35*strokeNum)
        //V42: выученная улучшаемая способность (уровень < макс) — ВТОРОЕ окно слева
        //с описанием ПОСЛЕ апгрейда (паттерн compareTip); невыученные и макс — одно окно
        const heroes = basicData.data.heroes[status.hero && status.hero.class]
        const idx = heroes ? heroes.skills.indexOf(obj) : -1
        let cur = 0
        if(idx >= 0) {
            for (let j = 0; j < status.info.skills.length; j++) status.info.skills[j] === idx && cur++
        }
        const max = obj.descFullL3 ? 3 : obj.descFullL2 ? 2 : 1
        //V42a: главное окно показывает описание ТЕКУЩЕГО уровня способности —
        //после прокачи на 2-й/3-й уровень это descFullL2/descFullL3, а не descFull
        const curDesc = cur >= 3 && obj.descFullL3 ? obj.descFullL3 : cur === 2 && obj.descFullL2 ? obj.descFullL2 : obj.descFull
        addToSkill(x,y1,T(curDesc),color)
        if(idx >= 0 && cur >= 1 && cur < max) {
            const nextDesc = cur === 1 ? obj.descFullL2 : obj.descFullL3
            let x2 = x - 414
            x2 < 10 && (x2 = 10)
            tempTip.push(rect(svgArr[2],x2,y,400,600,color,"4px","black",{"id":"lvlTip","rx":"6px"}))
            //V60: длинное название — меньше шрифт и до двух строк (см. tipTitle)
            tipTitle(x2+200,y+45,color,itemName(obj),"lvlTipName")
            tempTip.push(rect(svgArr[2],x2+71,y+66,258,258,color,"2px","black",{"id":"lvlTipFrame","rx":"6px"}))
            tempTip.push(image(svgArr[2],x2+72,y+67,256,256,obj.img,{"blur":'filter: drop-shadow(0 0 4px '+color+')'}))
            tempTip.push(text(svgArr[2],x2+200,y+346,"0pt","50pt","none","1px","#999999",T("tip.level",cur+1),{"id":"lvlTipLabel","size":20,"font":"baseFont4","anchor":"middle"}))
            addToSkill(x2,y1,T(nextDesc),color)
        }
    }
    obj.stat > 4 && helpWord3(color,obj.stat,x-16,y+255)
    //V53/V56: идентифицированная легендарка — окошко ЕЁ сета под основным окном
    const objSetN = itemSet(obj)
    objSetN > 0 && setTip(x,y,color,objSetN)
}
//V29: окно сравнения с УЖЕ НАДЕТЫМ предметом того же слота — рисуется СЛЕВА от
//основного тулипа на той же высоте (та же геометрия 400×600 и разметка, минус
//боковые словари helpWord/helpWord2/helpWord3/descFull), плюс метка «СЕЙЧАС НАДЕТО».
//Все ноды кладутся в общий tempTip: один mouseout → один tipDel() гасит оба окна.
//Вызывается ТОЛЬКО для ховера по инвентарю (надетый предмет сравнивать с самим собой
//нечего); obj=null/без type → тихий отказ. Цвет рамки — редкость НАДЕТОГО предмета.
//V53: lower пробрасывается из inventory.js (идентифицированная легендарка в ховере) —
//окно сравнения встаёт на ту же уменьшенную высоту, что и основное окно с окном сета.
function compareTip(e,obj,lower=0) {
    if (!e || !obj || !obj.type) return
    obj.rarity === undefined && (obj.rarity = 5)
    const c = tipCoords(e,lower)
    let x = c[0]-414 //основное окно 400px + зазор 14px слева от него
    x < 10 && (x = 10) //защита от выхода за левый край viewBox
    const y = c[1]
    const color = rarityColor(obj.rarity)
    tempTip.push(rect(svgArr[2],x,y,400,600,color,"4px","black",{"id":"cmpTip","rx":"6px"}))
    //V60: длинное название — меньше шрифт и до двух строк (см. tipTitle)
    tipTitle(x+200,y+45,color,itemName(obj),"itemName")
    tempTip.push(rect(svgArr[2],x+71,y+66,258,258,color,"2px","black",{"id":"cmpTip","rx":"6px"}))
    tempTip.push(image(svgArr[2],x+72,y+67,256,256,obj.img,{"blur":'filter: drop-shadow(0 0 4px '+color+')'}))
    let strokeNum = 0
    if (obj.type!==undefined) {
        let desc
        obj.type.desc2 ? desc = T(obj.type.desc1)+" - "+T(obj.type.desc2) : desc = T(obj.type.desc1)
        tempTip.push(text(svgArr[2],x+200,y+365+strokeNum*35,"0pt","50pt","none","2px","#CC9900",desc,{"id":"itemName","size":32,"font":"baseFont4","anchor":"middle"}))
        strokeNum++
    }
    if (obj.damage) {
        tempTip.push(text(svgArr[2],x+200,y+365+strokeNum*35,"0pt","50pt","none","2px","#cc9966",T("tip.damage",obj.damage),{"id":"itemName","size":32,"font":"baseFont4","anchor":"middle"}))
        strokeNum++
    }
    if (obj.attack !== undefined) {
        tempTip.push(text(svgArr[2],x+200,y+365+strokeNum*35,"0pt","50pt","none","2px","#cc9966",T("tip.attack",T(basicData.data.attacks[obj.attack].name),basicData.data.attacks[obj.attack].cooldown),{"id":"itemName","size":32,"font":"baseFont4","anchor":"middle"}))
        strokeNum++
    }
    if (obj.stat!==undefined) {
        tempTip.push(text(svgArr[2],x+200,y+365+strokeNum*35,"0pt","50pt","none","2px","#999999",T(statArr[obj.stat]) + " +" + obj.statCount,{"id":"itemName","size":32,"font":"baseFont4","anchor":"middle"}))
        strokeNum++
    }
    if (obj.dopType!==undefined) {
        tempTip.push(text(svgArr[2],x+200,y+365+strokeNum*35,"0pt","50pt","none","2px","#9999FF",T(statArrDop[obj.dopType]) + " +" + obj.dop,{"id":"itemName","size":32,"font":"baseFont4","anchor":"middle"}))
        strokeNum++
    }
    if (obj.abil!==undefined) {
        tempTip.push(text(svgArr[2],x+200,y+365+strokeNum*35,"0pt","50pt","none","2px","#9933CC",T(obj.abil.desc),{"id":"itemName","size":32,"font":"baseFont4","anchor":"middle"}))
        strokeNum++
    }
    //метка между картинкой и характеристиками: игроку сразу ясно, какое из двух окон «старое»
    tempTip.push(text(svgArr[2],x+200,y+346,"0pt","50pt","none","1px","#999999",T("tip.worn"),{"id":"cmpLabel","size":20,"font":"baseFont4","anchor":"middle"}))
    tempTip.push(text(svgArr[2],x+200,y+580,"0pt","50pt","none","2px",color,T(obj.desc),{"id":"itemName","size":26,"font":"baseFont4","anchor":"middle"}))
}
//V53: окошко сета ПОД основным тултипом идентифицированной легендарки
//(y+600 основное окно + зазор 14). V56: окно принадлежит сету setN самого предмета —
//заголовок/бонусы/счётчик берутся из SETS[setN-1], worn считается по этому сету.
//Заголовок с числом надетых сетовых вещей на кукле (в лобби надетых нет — 0/6); строки
//бонусов: активные (надето >= need) — полная яркость, неактивные — полупрозрачные
//(fill rgba с альфой 0.4; text() произвольные атрибуты, вроде opacity, не пробрасывает).
//Высота окна считается по факту переносов строк.
function setTip(x,y,color,setN) {
    const set = SETS[setN-1]
    const worn = setCount(setN)
    const maxPx = 400 - 36
    let rowsAll = []
    let lines = 0
    for (let i = 0; i < set.bonuses.length; i++) {
        let parts = itWrap(T(set.bonuses[i].label)+": "+T(set.bonuses[i].desc),24,maxPx)
        rowsAll.push(parts)
        lines += parts.length
    }
    //V81: заголовок «Сет «…» (N/6)» длиннее 28 символов (замер пользователя) переносится
    //в ДВЕ строки, как название предмета в основном тулипе (V60 tipTitle): сбалансированное
    //деление по словам, базлайны ±15, дозжим шрифта по 2px; окно и строки бонусов
    //сдвигаются на +12 (иначе дескендеры второй строки задевают первую бонус-строку)
    const head = T("tip.set",T(set.name),worn)
    const headParts = head.length > 28 ? splitTitleBalanced(head) : null
    let headSize = 32
    if (headParts) while (headSize > 24 && headParts.some(p => itMeasure(p,headSize) > maxPx)) headSize -= 2
    const SET_H = 66 + (headParts && headParts.length > 1 ? 12 : 0) + lines*28 + 8*(set.bonuses.length-1) + 14
    tempTip.push(rect(svgArr[2],x,y+614,400,SET_H,color,"4px","black",{"id":"setTip","rx":"6px"}))
    if (!headParts) {
        tempTip.push(text(svgArr[2],x+200,y+625+38,"0pt","50pt","none","2px",color,head,{"id":"setName","size":32,"font":"baseFont4","anchor":"middle"}))
    } else if (headParts.length === 1) {
        //одно слово без пробелов не дробим — одна строка дозжатым шрифтом (как в tipTitle)
        tempTip.push(text(svgArr[2],x+200,y+625+38,"0pt","50pt","none","2px",color,headParts[0],{"id":"setName","size":headSize,"font":"baseFont4","anchor":"middle"}))
    } else {
        tempTip.push(text(svgArr[2],x+200,y+625+38-15,"0pt","50pt","none","2px",color,headParts[0],{"id":"setName","size":headSize,"font":"baseFont4","anchor":"middle"}))
        tempTip.push(text(svgArr[2],x+200,y+625+38+15,"0pt","50pt","none","2px",color,headParts[1],{"id":"setName","size":headSize,"font":"baseFont4","anchor":"middle"}))
    }
    let rowY = y+614+76 + (headParts && headParts.length > 1 ? 12 : 0)
    for (let i = 0; i < set.bonuses.length; i++) {
        let active = worn >= set.bonuses[i].need
        for (let p = 0; p < rowsAll[i].length; p++) {
            tempTip.push(text(svgArr[2],x+200,rowY + 10,"0pt","50pt","none","2px",active ? "#FFCC66" : "rgba(255, 204, 102, 0.4)",rowsAll[i][p],{"id":"setRow","size":24,"font":"baseFont4","anchor":"middle"}))
            rowY += 28
        }
        rowY += 8
    }
}
function tipDel () {
    let length = tempTip.length
    for (let i = 0; i < length; i++) {
        tempTip[i].remove()
    }
    tempTip = []
}
function helpWord(color,dop,x,y,arr1=statArrDop,arr2=statArrDopDesc) {
    tempTip.push(rect(svgArr[2],x+420,y,300,250,color,"4px","black",{"id":"tip","rx":"6px"}))
    tempTip.push(text(svgArr[2],x+570,y+45,"0pt","50pt","none","2px","#CC9900",T(arr1[dop]),{"id":"wordName","size":38,"font":"baseFont4","anchor":"middle"}))
    tempTip.push(nativeHtml(svgArr[2],x+440,y+60,260,280,"none","2px","#CCCCCC",T(arr2[dop]),{"id":"wordNameText","size":32,"font":"baseFont4","anchor":"middle"}))
}
function helpWord2(color,abil,x,y) {
    tempTip.push(rect(svgArr[2],x+420,y,300,250,color,"4px","black",{"id":"tip","rx":"6px"}))
    tempTip.push(text(svgArr[2],x+570,y+45,"0pt","50pt","none","2px","#CC9900",T(abil.desc),{"id":"wordName","size":38,"font":"baseFont4","anchor":"middle"}))
    tempTip.push(nativeHtml(svgArr[2],x+440,y+60,260,280,"none","2px","#CCCCCC",T(abil.desc2),{"id":"wordNameText","size":32,"font":"baseFont4","anchor":"middle"}))
}
//V58: подписи статов 5/6 (ячейки/броня) — ключи локализации
let superStatArr = ["supstat.0","supstat.1"]
function helpWord3(color,stat,x,y) {
    tempTip.push(rect(svgArr[2],x-300,y-250,300,250,color,"4px","black",{"id":"tip","rx":"6px"}))
    tempTip.push(text(svgArr[2],x-150,y-205,"0pt","50pt","none","2px","#CC9900",T(statArr[stat]),{"id":"wordName","size":38,"font":"baseFont4","anchor":"middle"}))
    tempTip.push(nativeHtml(svgArr[2],x-280,y-190,260,280,"none","2px","#CCCCCC",T(superStatArr[stat-5]),{"id":"wordNameText","size":32,"font":"baseFont4","anchor":"middle"}))
}
function addToSkill(x,y,descFull,color) {
    //MIGRATION: шрифт 40px не влезал во фрейм тултипа способности (репорт) — уменьшен до 32
    tempTip.push(nativeHtml(svgArr[2],x+30,y+340,340,260,"none","2px","#CCCCCC",descFull,{"id":"deckSkillText","size":32,"font":"baseFont4","anchor":"middle"}))
}
//V94: rarityColor отдаётся наружу — обводка редкости на ячейках (лобби/инвентарь/кукла/
//алхимия/экран предметов) обязана совпадать по цвету с рамкой тултипа, один источник
export { tip,tipDel,helpWord,showItemTip,itemTipTick,compareTip,rarityColor,itemFrameOn,itemGlowOn }