import { inventory,inventoryDel,inventoryTemp } from "../scripts/inventory.js"
import { checkCollision } from "../scripts/damage.js"
import { svgArr,image,worldImage } from "../scripts/svg.js"
import { doll,dollDel,dollTemp,cellPickArr,viewStats } from "../scripts/doll.js"
import { status } from "../scripts/start.js"
//V115: полосы ХП/опыта — суффиксы по игроку (players.js)
import { ctxBar,ctxTx } from "../scripts/players.js"
import { screenPic } from "../scripts/del.js"
//V123: дроп удаляемого предмета на пол (кооп)
import { dropArr,itemDrops } from "../scripts/useObject.js"
import { placeDrop,dropFly } from "../scripts/dropSafe.js"
import * as basicData from "../scripts/data.js"
import { countDopStats } from "../scripts/countDopStats.js"
import { beltChange } from "../scripts/belt.js"
//V86: итог брони куклы (сапфир + сет «Турниры» + баф щита) считает dollArmor() из takeDamage
import { changeHP,dollArmor } from "../scripts/takeDamage.js"
//V56: сет «Доблестный небожитель» (4 надетых): двуручное оружие занимает только одну руку
import { setTwoHandOneHand } from "../scripts/sets.js"
//V63a: двуручность нельзя определять только строкой "hand.2": у вещей из старого сундука
//V58-миграция (keyByRu) перевела русское «руки» в ПЕРВЫЙ подходящий ключ пары —
//"weapon.2.desc2", поэтому проверка desc2 === "hand.2" их не видела, и щит второй руки
//не снимался при надевании старой двуручки. Двуручные ключи: "hand.2" (генерируемые
//с V58) + weapon.2/3/7/9.desc2 (двуручные подтипы; keyByRu сводит ЛЮБОЕ старое «руки»
//к weapon.2.desc2 — набор покрывает и мигрированные вещи, и стартовое оружие).
//Исключение по решению пользователя: стартовый протазан Валькирии (basicWeapons[6],
//weapon.6.desc2) остаётся ОДНОРУЧНЫМ — совместим со щитом, ярлык «рука» не меняем.
const TWO_HAND_DESC2 = ["hand.2", "weapon.2.desc2", "weapon.3.desc2", "weapon.7.desc2", "weapon.9.desc2"]
function isTwoHand(item) {
    return !!item && !!item.type && TWO_HAND_DESC2.includes(item.type.desc2)
}

//V129 (репорт юзера: «предмет копируется при переносе с куклы в инвентарь»): циклы
//визуальной хирургии dollTemp ниже обходят ВСЕ узлы панели, а узлы без id (рамка
//редкости — rect, жёлтая подсветка слота) возвращают getAttribute("id") === null.
//null.slice ронял funcDrag ПОСЛЕ записи данных, но ДО перерисовки панели: старый шим
//куклы оставался жив (лежал над ячейкой инвентаря), и следующий жест тем же шимом
//(одиночный клик/даблклик) проходил по ветке обмена с кукольным id-источником —
//предмет возвращался на куклу, не очистив инвентарь = копия. Узлы без id дают NaN
//(ни с каким слотом не совпадёт — узел просто пропускается)
function slotNum(el) {
    const v = el.getAttribute("id")
    return v === null || v === undefined ? NaN : parseInt(v.slice(0, -1))
}

function drag (e,item,x,y) {
    let xBase = x
    let yBase = y
    if(inventoryTemp.length > 0) {
        let x = e.target.x.animVal.value
        let y = e.target.y.animVal.value
        let length = inventoryTemp.length
        for (let i = 0; i < length; i++) {
            let x2 = inventoryTemp[i].x.animVal.value
            let y2 = inventoryTemp[i].y.animVal.value
            if(inventoryTemp[i].getAttribute("href") === "./images/UI/panels/inv/emptyCell.png" && !status.inventory.inv[inventoryTemp[i].getAttribute("id").slice(0,-1)-13]) {
                if(checkCollision(x+32, x2, 64, 128, y+32, y2, 64, 128)) {
                    e.target.setAttribute("x", x2)
                    e.target.setAttribute("y", y2)
                    status.inventory.inv[inventoryTemp[i].getAttribute("id").slice(0,-1)-13] = item
                    if (parseInt(e.target.getAttribute("id").slice(0,-1)) < 13) {
                        status.inventory.doll[parseInt(e.target.getAttribute("id").slice(0,-1))] = null
                        let length3 = dollTemp.length
                        for (let j = 0; j < length3; j++) {
                            if(slotNum(dollTemp[j]) === parseInt(e.target.getAttribute("id").slice(0,-1)) && dollTemp[j].getAttribute("href") === "./images/UI/doll/empty.png") {
                                dollTemp[j].setAttribute("href", cellPickArr[parseInt(e.target.getAttribute("id").slice(0,-1))].href)
                            }
                            if(slotNum(dollTemp[j]) === parseInt(e.target.getAttribute("id").slice(0,-1)) && dollTemp[j].getAttribute("href") ===e.target.getAttribute("href")) {
                                dollTemp.splice(j,1)
                                length3--
                                j--
                            }
                        }
                        inventoryTemp.push(e.target)
                        unEquip (item)
                    } else {
                        status.inventory.inv[parseInt(e.target.getAttribute("id").slice(0,-1))-13] = null
                    }
                    e.target.setAttribute("id", inventoryTemp[i].getAttribute("id"))
                    //V67 «Вечный сапфир»: предмет сменил ячейку — состав inv[0] мог измениться,
                    //копия (статы/урон) пересчитывается сразу (unEquip выше уже звал changeDopStat
                    //для ветки куклы — здесь добиваем чистые перемещения по инвентарю)
                    changeDopStat()
                    //V95: полная перерисовка — рамка редкости следует за предметом
                    //(спрайт перемещался точечно, старая рамка оставалась на прежней ячейке)
                    reRenderPanels()
                    return
                }
            } else if(inventoryTemp[i].getAttribute("href") === "./images/UI/panels/inv/emptyCell.png" && checkCollision(x+32, x2, 64, 128, y+32, y2, 64, 128) && inventoryTemp[i].getAttribute("id") !== e.target.getAttribute("id")) {
                //тип заменяемого предмета
                let changeItem2 = status.inventory.inv[inventoryTemp[i].getAttribute("id").slice(0,-1)-13]
                // Проверяем, подходит ли предмет для текущей ячейки
                let checkTypes = false
                let lengthTypes = changeItem2.types.length
                for (let k = 0; k < lengthTypes; k++) {
                    if (changeItem2.types[k] === parseInt(e.target.getAttribute("id").slice(0, -1))) {
                        checkTypes = 2
                        break
                    }
                }
                // Дополнительные проверки для оружия (ячейки 11 и 12)
                if (checkTypes && (parseInt(e.target.getAttribute("id").slice(0, -1)) === 11 || parseInt(e.target.getAttribute("id").slice(0, -1)) === 12)) {
                    let lengthDoll = status.inventory.doll.length;
                    for (let k = 0; k < lengthDoll; k++) {
                        if (parseInt(e.target.getAttribute("id").slice(0, -1)) !== k && status.inventory.doll[k] && status.inventory.doll[k].attack !== undefined && status.inventory.doll[k].attack !== changeItem2.attack && changeItem2.attack !== undefined) {
                            checkTypes = false
                            break
                        }
                        if (parseInt(e.target.getAttribute("id").slice(0, -1)) !== k && status.inventory.doll[k] && (k === 11 || k === 12) && isTwoHand(changeItem2) && !setTwoHandOneHand()) {
                            checkTypes = false
                            break
                        }
                    }
                }
                // Разрешаем перемещение предметов в инвентарь
                !checkTypes && parseInt(e.target.getAttribute("id").slice(0, -1)) >= 13 && parseInt(inventoryTemp[i].getAttribute("id").slice(0, -1)) >= 13 && (checkTypes = true)
                if(checkTypes) {
                    //обмен предметов в массиве status.inventory.inv
                    if (parseInt(e.target.getAttribute("id").slice(0,-1)) >= 13) {
                        status.inventory.inv[e.target.getAttribute("id").slice(0,-1)-13] = changeItem2
                    }
                    if(parseInt(inventoryTemp[i].getAttribute("id").slice(0,-1)) >= 13) {
                        status.inventory.inv[inventoryTemp[i].getAttribute("id").slice(0,-1)-13] = item
                    }
                    //обмен предметов в массиве status.inventory.doll
                    if(checkTypes === 2) {
                        //код на смену предметов: снятый с куклы предмет (item) уходит в
                        //инвентарь (inv[dst] выше), а заменённый из инвентаря (changeItem2)
                        //встаёт в ОСВОБОЖДАЕМЫЙ СЛОТ-ИСТОЧНИК куклы — checkTypes===2 здесь
                        //означает «типы changeItem2 включают слот-источник» (V127: раньше
                        //писали через id источника, для инвентарных источников это были
                        //фантомные слоты doll[13+]; гвард отсекает мусорные записи)
                        const srcSlot = parseInt(e.target.getAttribute("id").slice(0,-1))
                        unEquip (item)
                        if (srcSlot >= 0 && srcSlot < 13) {
                            status.inventory.doll[srcSlot] = changeItem2
                            equip(changeItem2)
                        }
                    }
                    //V67 «Вечный сапфир»: обмен в инвентаре меняет состав inv[0] — копия пересчитывается
                    //сразу (при обмене «кукла↔инвентарь» equip/unEquip уже пересчитали, дубль безвреден)
                    changeDopStat()
                    reRenderPanels()
                    return
                }
            }
        }
        //выкинуть предмет
        if(checkCollision(x+32, 1500, 64, 208, y+32, 810, 64, 60)) {
            if (parseInt(e.target.getAttribute("id").slice(0,-1)) < 13) {
                status.inventory.doll[parseInt(e.target.getAttribute("id").slice(0,-1))] = null
                let length3 = dollTemp.length
                for (let j = 0; j < length3; j++) {
                    if(slotNum(dollTemp[j]) === parseInt(e.target.getAttribute("id").slice(0,-1)) && dollTemp[j].getAttribute("href") === "./images/UI/doll/empty.png") {
                        dollTemp[j].setAttribute("href", cellPickArr[parseInt(e.target.getAttribute("id").slice(0,-1))].href)
                    }
                    if(slotNum(dollTemp[j]) === parseInt(e.target.getAttribute("id").slice(0,-1)) && dollTemp[j].getAttribute("href") ===e.target.getAttribute("href")) {
                        dollTemp.splice(j,1)
                        length3--
                        j--
                    }
                }
                unEquip (item)
            } else {
                status.inventory.inv[parseInt(e.target.getAttribute("id").slice(0,-1))-13] = null
                //V67 «Вечный сапфир»: выброшен предмет инвентаря — inv[0] мог опустеть, копия
                //пересчитывается (сdoll-ветки unEquip пересчитал сам)
                changeDopStat()
            }
            //V123 (решение юзера): в коопе «УДАЛИТЬ» не уничтожает — предмет падает
            //на пол у владельца панели; подобрать его может этот или другой игрок,
            //и вернётся РОВНО этот же предмет (кучка несёт его в itemDrops)
            if (status.players.length > 1) {
                const P = status.hero
                const el = worldImage(svgArr[1], P.x + 16, P.y + 40, 28, 32, item.img, {"id": screenPic.length - 1})
                screenPic.push(el)
                placeDrop(el, P.x + 16, P.y + 40, 28, 32)
                dropFly(el, P.x + 16, P.y + 25)
                itemDrops.set(el, item)
                //V126 (решение юзера): кучка помнит, КТО выбросил предмет, — takeDrop не
                //поднимет её выбросившим, пока тот не выйдет из хитбокса и не подойдёт снова
                el._dropBy = P.idx || 0
            }
            e.target.remove()
            //V95: полная перерисовка — рамка редкости не остаётся на пустой ячейке
            reRenderPanels()
        }
    }
    if (dollTemp.length > 0) {
        let length = dollTemp.length
        for (let i = 0; i < length; i++) {
            let length2 = cellPickArr.length
            for (let j = 0; j < length2; j++) {
                let x2 = dollTemp[i].x.animVal.value
                let y2 = dollTemp[i].y.animVal.value
                if (dollTemp[i].getAttribute("href") === cellPickArr[j].href) {
                    let x = e.target.x.animVal.value
                    let y = e.target.y.animVal.value
                    let checkTypes = false
                    let lengthTypes = item.types.length
                    for (let k = 0; k < lengthTypes; k++) {
                        item.types[k] === j && (checkTypes = true)
                    }
                    //V55: оружейные слоты — конфликт второй руки больше не запрещает экипировку:
                    //конфликтный предмет снимается в инвентарь (extraHandItems); нехватка
                    //свободных ячеек отменяет экипировку (иконка вернётся на исходную)
                    let extra = j === 11 || j === 12 ? extraHandItems(item, j) : []
                    let free = []
                    for (let f = 0; f < status.inventory.inv.length; f++) {
                        !status.inventory.inv[f] && free.push(f)
                    }
                    if(checkTypes && free.length >= extra.length && parseInt(e.target.getAttribute("id").slice(0,-1)) >= 13 && checkCollision(x+32, x2, 64, 128, y+32, y2, 64, 128)) {
                        //V55: снять конфликтные предметы второй руки в свободные ячейки
                        for (let v = 0; v < extra.length; v++) {
                            status.inventory.doll[extra[v].slot] = null
                            unEquip (extra[v].item)
                            status.inventory.inv[free.shift()] = extra[v].item
                        }
                        e.target.setAttribute("x", x2)
                        e.target.setAttribute("y", y2)
                        status.inventory.doll[j] = item
                        status.inventory.inv[parseInt(e.target.getAttribute("id").slice(0,-1))-13] = null
                        e.target.setAttribute("id", dollTemp[i].getAttribute("id"))
                        dollTemp[i].setAttribute("href", "./images/UI/doll/empty.png")
                        dollTemp.push(e.target)
                        let length3 = inventoryTemp.length
                        for (let k = 0; k < length3; k++) {
                            if (inventoryTemp[k] === e.target) {
                                inventoryTemp.splice(k,1)
                                break
                            }
                        }
                        equip(item)
                        //V95: перерисовка всегда (не только при конфликте рук) — иначе рамка
                        //редкости остаётся в старой ячейке инвентаря, а на слоте куклы её нет
                        reRenderPanels()
                        return
                    }
                } else if(dollTemp[i].getAttribute("href") === "./images/UI/doll/empty.png") {
                    //тип заменяемого предмета
                    let slotId = parseInt(dollTemp[i].getAttribute("id").slice(0,-1))
                    let changeItem2 = status.inventory.doll[slotId]
                    let x = e.target.x.animVal.value
                    let y = e.target.y.animVal.value
                    let x2 = dollTemp[i].x.animVal.value
                    let y2 = dollTemp[i].y.animVal.value
                    let checkTypes = false
                    let lengthTypes = item.types.length
                    for (let k = 0; k < lengthTypes; k++) {
                        //тип проверяем по ячейке-ЦЕЛИ (slotId), а не по счётчику j цикла
                        //(иначе сапоги можно было обменять в слот шлема)
                        item.types[k] === slotId && (checkTypes = true)
                    }
                    // Дополнительные проверки для оружия (ячейки 11 и 12)
                    let isWeaponSlot = slotId === 11 || slotId === 12
                    //V55: конфликт второй руки больше не запрещает замену — конфликтный предмет
                    //(двуручное или другое оружие, в т.ч. пара одинаковых) снимается в инвентарь;
                    //при нехватке места замена отменяется (иконка вернётся на исходную ячейку)
                    let extra = isWeaponSlot ? extraHandItems(item, slotId) : []
                    let free = []
                    for (let f = 0; f < status.inventory.inv.length; f++) {
                        //ячейка одеваемого предмета освободится, но зарезервирована под changeItem2
                        //(заменяемый предмет куклы) — «лишним» предметам её не даём
                        !status.inventory.inv[f] && f !== parseInt(e.target.getAttribute("id").slice(0,-1))-13 && free.push(f)
                    }
                    if(checkTypes && free.length >= extra.length && parseInt(e.target.getAttribute("id").slice(0,-1)) >= 13 && checkCollision(x+32, x2, 64, 128, y+32, y2, 64, 128)) {
                        //код на смену предметов
                        status.inventory.inv[parseInt(e.target.getAttribute("id").slice(0,-1))-13] = changeItem2
                        status.inventory.doll[slotId] = null
                        unEquip (changeItem2)
                        //V55: снять конфликтные предметы второй руки в свободные ячейки
                        //(двуручное занимает обе руки — его «лишний» предмет попадает сюда же)
                        for (let v = 0; v < extra.length; v++) {
                            status.inventory.doll[extra[v].slot] = null
                            unEquip (extra[v].item)
                            status.inventory.inv[free.shift()] = extra[v].item
                        }
                        status.inventory.doll[slotId] = item
                        equip(item)
                        reRenderPanels()
                        return
                    }
                }
            }
        }
    }
    //перемещение не удалось (неверный слот/конфликт рук) — возвращаем иконку на исходную ячейку
    e.target.setAttribute("x", xBase)
    e.target.setAttribute("y", yBase)
}
function equip(item) {
    if (status.attack.img === null && item.attack !== undefined) {
        status.attack.img = basicData.data.attacks[item.attack].img
        //V127: иконка в окно типа атаки СВОЕГО игрока (bx-смещение блока) и со своим
        //id — прежние 931,988 без смещения в коопе рисовали её в зазоре между блоками
        const bx = (status.hero.idx || 0) === 0 ? -460 : 460
        screenPic.push(image(svgArr[2],931+bx,988,58,58,status.attack.img,{"id":"atkIco"+(status.hero.idx || 0)}))
        status.attack.stack.push({"timer":Math.trunc((basicData.data.attacks[item.attack].cooldown*1000)/16),"abil":basicData.data.attacks[item.attack]})
        let length = basicData.data.heroes[status.hero.class].anims[1].attack.length
        for (let i = 0; i < length; i++) {
            basicData.data.heroes[status.hero.class].anims[1].attack[i].new.anim[0] = item.attack
        }
    }
    item.stat !== undefined && item.stat < 5 && (status.info.stats[item.stat].value += item.statCount)
    item.dopType !== undefined && (status.info.stats[Math.trunc(item.dopType/3)].dops[item.dopType%3].value1 += item.dop)
    let length = dollTemp.length
    for (let i = 0; i < length; i++) {
        if (dollTemp[i].getAttribute("id") === "statValue"+item.stat) {
            dollTemp[i].textContent = status.info.stats[item.stat].value
            break
        }
    }
    changeDopStat()
    if(item.stat === 5) {
        status.info.beltCell+=item.statCount
        beltChange()
    }
    if(item.stat === 6) {
        //V56: фикс знака — при НАДЕВАНИИ щита броня растёт (снятие в unEquip остаётся -=).
        //Раньше equip тоже вычитал statCount: надетый щит уменьшал броню
        status.info.armor += item.statCount
        //V54: armorText создаётся doll() — до первого открытия панели экипировки его нет
        //(объединение на алхимическом столе снимает предметы с куклы без панели)
        //V67/V86: показываем полный итог dollArmor() (надетый 4-й предмет сета меняет число)
        status.info.armorText && (status.info.armorText.textContent = dollArmor())
    }
    if(item.stat === 2 || item.dopType === 6) {
        changeHP(ctxBar("hp"),ctxTx("hp"),"hp")
    }
    //V110: реликвии меняют статы read-time («Вечный изумруд» — макс. ХП, «Вечный алмаз» —
    //параметры): changeDopStat пересчитал формулы, но полоса/текст ХП обновляются только
    //по changeHP — без него изумруд на HUD не виден ни при надевании, ни при снятии
    if(item.relic !== undefined) {
        changeHP(ctxBar("hp"),ctxTx("hp"),"hp")
    }
    if(item.abil && item.abil.desc === "iabil.0.desc") {
        status.info.poisonus++
    }
    if(item.abil && item.abil.desc === "iabil.1.desc") {
        status.info.expous++
    }
    if(item.abil && item.abil.desc === "iabil.2.desc") {
        status.info.lifeus++
    }
    if(item.abil && item.abil.desc === "iabil.3.desc") {
        status.info.luckus++
    }
    //V66: «известность» (iabil.4) и «корыстность» (iabil.5) — счётчик надетых предметов,
    //эффекты применяют damage.js (checkExp) и openRoom.js
    if(item.abil && item.abil.desc === "iabil.4.desc") {
        status.info.fameus++
    }
    if(item.abil && item.abil.desc === "iabil.5.desc") {
        status.info.greedus++
    }
}
function unEquip(item) {
    //E-20: страховка половинных путей (changeItem2 = null в обмене со слотом) — раньше
    //unEquip(null) ронял funcDrag исключением посреди записи состояния
    if (!item) return
    if (item.attack !== undefined) {
        let check = false
        let lengthDoll = status.inventory.doll.length
        for (let k = 0; k < lengthDoll; k++) {
            status.inventory.doll[k] && status.inventory.doll[k].attack !== undefined && (check = true)
        }
        if (check === false) {
            //V127 (репорт юзера: в окошках типа атаки пропали иконки): снимаем иконку
            //по id СВОЕГО игрока — прежний поиск «первого совпадения href по screenPic»
            //в коопе уносил иконку ДРУГОГО игрока с тем же оружием
            const pi = status.hero.idx || 0
            //id картинок хранится с суффиксом «I» (контракт svg.js) — ищем «atkIco0I»
            const oldIcon = document.getElementById("atkIco" + pi + "I")
            if (oldIcon) {
                const idx = screenPic.indexOf(oldIcon)
                idx !== -1 && (screenPic[idx] = null) //«надгробие» вместо splice — см. V55
                oldIcon.remove()
            }
            status.attack.img = null
            let lengthCur = status.attack.current.length
            for (let i = 0; i < lengthCur; i++) {
                if (status.attack.current[i].base === 1) {
                    status.attack.current.splice(i,1)
                    lengthCur--
                    i--
                }
            }
            let lengthStack = status.attack.stack.length
            for (let i = 0; i < lengthStack; i++) {
                if (status.attack.stack[i].abil.base === 1) {
                    status.attack.stack.splice(i,1)
                    lengthStack--
                    i--
                }
            }
        }
    }
    item.stat !== undefined && item.stat < 5 && (status.info.stats[item.stat].value -= item.statCount)
    item.dopType !== undefined && (status.info.stats[Math.trunc(item.dopType/3)].dops[item.dopType%3].value1 -= item.dop)
    let length = dollTemp.length
    for (let i = 0; i < length; i++) {
        if (dollTemp[i].getAttribute("id") === "statValue"+item.stat) {
            dollTemp[i].textContent = status.info.stats[item.stat].value
            break
        }
    }
    changeDopStat()
    if(item.stat === 5) {
        status.info.beltCell-=item.statCount
        beltChange()
    }
    if(item.stat === 6) {
        status.info.armor -= item.statCount
        //V54: armorText создаётся doll() — до первого открытия панели экипировки его нет
        //(объединение на алхимическом столе снимает предметы с куклы без панели)
        //V67/V86: показываем полный итог dollArmor() (снятый 4-й предмет сета меняет число)
        status.info.armorText && (status.info.armorText.textContent = dollArmor())
    }
    if(item.stat === 2 || item.dopType === 6) {
        changeHP(ctxBar("hp"),ctxTx("hp"),"hp")
    }
    //V110: реликвии — см. equip: снятие тоже обязано обновить полосу/текст ХП
    //(прибавка «Вечного изумруда» к максимуму уходит, HUD должен это показать)
    if(item.relic !== undefined) {
        changeHP(ctxBar("hp"),ctxTx("hp"),"hp")
    }
    if(item.abil && item.abil.desc === "iabil.0.desc") {
        status.info.poisonus--
    }
    if(item.abil && item.abil.desc === "iabil.1.desc") {
        status.info.expous--
    }
    if(item.abil && item.abil.desc === "iabil.2.desc") {
        status.info.lifeus--
    }
    if(item.abil && item.abil.desc === "iabil.3.desc") {
        status.info.luckus--
    }
    if(item.abil && item.abil.desc === "iabil.4.desc") {
        status.info.fameus--
    }
    if(item.abil && item.abil.desc === "iabil.5.desc") {
        status.info.greedus--
    }
}
function changeDopStat() {
    countDopStats()
    //V45: максимум ХП мог упасть (снят предмет с допом «+жизни») — текущее ХП
    //не должно оставаться выше нового максимума (иначе в HUD висело «65/60»)
    let maxHp = parseInt(status.info.stats[2].dops[0].value2.slice(0,-1))
    status.info.hp > maxHp && (status.info.hp = maxHp)
    viewStats()
    viewStats()
}
function reRenderPanels() {
    dollDel(1)
    inventoryDel(1)
    doll()
    inventory()
}
//V55: предметы ВТОРОЙ руки, конфликтующие с одеваемым в оружейный слот (11/12).
//Возвращаем [{"slot": номер слота, "item": предмет}] — их снимаем в инвентарь, а не запрещаем
//экипировку (решение пользователя): «на кукле два одинаковых кинжала, одеваем меч», одноручное
//поверх двуручного. Щит и прочее не-оружие совместимы с обычным оружием во второй руке.
//V56: сет «Доблестный небожитель» (4 надетых) — двуручное занимает только одну руку:
//оба конфликта «двуручное ↔ второй слот» исчезают; оружие против оружия решают
//прежние правила (другой подтип — снимается, одинаковая пара — остаётся)
function extraHandItems(item, slot) {
    if (slot !== 11 && slot !== 12) return []
    const otherSlot = slot === 11 ? 12 : 11
    const other = status.inventory.doll[otherSlot]
    if (!other) return []
    const twoAsOne = setTwoHandOneHand()
    //двуручное занимает обе руки — второй слот освобождается всегда
    //V63a: через isTwoHand — покрывает старые вещи сундука (weapon.2.desc2 после keyByRu)
    if (isTwoHand(item) && !twoAsOne) return [{"slot":otherSlot,"item":other}]
    //в другой руке двуручное — конфликт для любого одноручного (включая щит)
    if (isTwoHand(other) && !twoAsOne) return [{"slot":otherSlot,"item":other}]
    //другое оружие во второй руке — снимаем (одно и то же оружие парой остаётся)
    if (item.attack !== undefined && other.attack !== undefined && other.attack !== item.attack) return [{"slot":otherSlot,"item":other}]
    return []
}
//V102: автонадевание сгенерированного/подобранного предмета (решение пользователя):
//если подходящий слот куклы ПУСТ и конфликтов второй руки нет (extraHandItems пуст —
//двуручное/парное оружие автонадеванием не трогаем), предмет сразу встаёт на куклу —
//тот же путь, что у двойного клика (equip). Иначе — обычный путь в ячейку инвентаря.
//Замены надетых предметов НЕ делаем (просьба строго про пустую ячейку). true — предмет надет
function tryAutoEquip(item) {
    if (!item || !item.types) return false
    let length = item.types.length
    for (let i = 0; i < length; i++) {
        let slot = item.types[i]
        if (slot < 0 || slot > 12) continue
        if (status.inventory.doll[slot]) continue
        if (extraHandItems(item, slot).length > 0) continue
        status.inventory.doll[slot] = item
        equip(item)
        return true
    }
    return false
}
//двойной клик по предмету: одеть из инвентаря в подходящий слот куклы (при необходимости
//обменяв с лежащим там предметом) или снять с куклы в первую пустую ячейку инвентаря.
//Ячейку ищем ПО ИДЕНТИЧНОСТИ ОБЪЕКТА (indexOf), а не по id иконки: иконка может быть
//перемещена drag'ом в другую ячейку, а замыкание funcDbl хранит id с момента отрисовки —
//иначе предмет одевался, но оставался и в новой ячейке (копия)
function doubleClickItem(item) {
    if (!item) return
    let cellId = status.inventory.inv.indexOf(item)
    if (cellId !== -1) {
        cellId += 13 //ячейка инвентаря
    } else {
        cellId = status.inventory.doll.indexOf(item)
        if (cellId === -1) return //предмета уже нет нигде
    }
    if (cellId >= 13) {
        const invCell = cellId - 13
        //V67: реликвия встаёт в ЛЮБОЙ слот — двойной клик выбирает первый ПУСТОЙ слот,
        //чтобы не выкидывать надетую вещь; пустых нет — первый по списку (как у обычных вещей)
        const slots = item.relic !== undefined ?
            [...item.types.filter(s => !status.inventory.doll[s]), ...item.types] :
            item.types
        for (const slot of slots) {
            const cur = status.inventory.doll[slot]
            //V55: конфликтные предметы второй руки снимаем в инвентарь (см. extraHandItems)
            const extra = extraHandItems(item, slot)
            //свободные ячейки под «лишние» предметы; invCell годится для них только когда
            //слот-цель пуст — иначе invCell займёт снимаемый с куклы предмет
            let need = extra.length
            let free = []
            for (let i = 0; i < status.inventory.inv.length && free.length < need; i++) {
                if (i === invCell) {
                    cur || free.push(i)
                    continue
                }
                !status.inventory.inv[i] && free.push(i)
            }
            //некуда положить снимаемые предметы — экипировка отменяется целиком (решение пользователя)
            if (free.length < need) continue
            //обмен/освобождение
            if (cur) {
                status.inventory.doll[slot] = null
                unEquip(cur)
                status.inventory.inv[invCell] = cur
            } else {
                status.inventory.inv[invCell] = null
            }
            //V55: снять конфликтные предметы второй руки в свободные ячейки
            for (let x = 0; x < extra.length; x++) {
                status.inventory.doll[extra[x].slot] = null
                unEquip(extra[x].item)
                status.inventory.inv[free.shift()] = extra[x].item
            }
            status.inventory.doll[slot] = item
            equip(item)
            reRenderPanels()
            return
        }
    } else {
        //предмет с куклы — снять в первую пустую ячейку инвентаря
        for (let i = 0; i < status.inventory.inv.length; i++) {
            if (!status.inventory.inv[i]) {
                status.inventory.inv[i] = item
                status.inventory.doll[cellId] = null
                unEquip(item)
                reRenderPanels()
                return
            }
        }
    }
}
export {drag,doubleClickItem,equip,unEquip,changeDopStat,tryAutoEquip}