import { status } from "../scripts/start.js"
import { T } from "../scripts/localization.js"
import { screenPic,objectValues } from "../scripts/del.js"
import { svgArr,image,worldBar,text,releaseSprite } from "../scripts/svg.js"
import { endGame } from "../scripts/endGame.js"
import { floatText } from "../scripts/floatText.js"
import { playEffect, relicReflect } from "../scripts/damage.js"
import { data } from "../scripts/data.js"
import { beltChange } from "../scripts/belt.js"
import { useSkill } from "../scripts/activeSkills.js"
import { shieldKnockback,auraDodgeHeal,dashInvulnActive } from "../scripts/valkyrie.js"
import { journalAdd, J_RED } from "../scripts/journal.js"
//V49 баф магического щита (статуя): +2 брони поверх базовой
import { buffArmorBonus } from "../scripts/buffFx.js"
//V56: сет «Победитель турниров» (4 надетых): +1 брони поверх базовой
import { setArmorBonus } from "../scripts/sets.js"
//V67: «Вечный сапфир» — копия брони щита из 1-й ячейки инвентаря (как своя броня)
//V68: «Вечный жемчуг» (relic 4) — 25% входящего урона уходят врагу-источнику (relicReflect)
import { sapphireArmor, hasRelic } from "../scripts/relics.js"
//V75: благословения шкафчика — «Стальная кожа» (кап 16) и «Второе дыхание» (спасение с 1 ХП)
import { blessActive,spendBless } from "../scripts/blessFx.js"
//V115: кооператив — суффиксы DOM-id полос по игроку (hpBarI0/lvlText1…)
import { ctxBar,ctxTx,nextLvlExp } from "../scripts/players.js"

//V86: ЕДИНАЯ сумма брони — и для формулы урона, и для числа на кукле: своя броня
//(щиты, очки рыцаря) + копия щита «Вечного сапфира» + сет «Турниры» (4 предмета) +
//активный баф магического щита. Read-time слагаемые в info.armor не пишутся, поэтому
//кукла обязана показывать сумму целиком (прежняя формула куклы теряла сет и баф)
function dollArmor() {
    return status.info.armor + sapphireArmor() + buffArmorBonus() + setArmorBonus()
}

//damage — урон после брони; srcName — имя врага-источника (для журнала; ловушки/горение
//звонят напрямую в ХП без takeDamage, у них свои строки);
//V68: srcEnemy — сам объект врага (не обязателен): жемчуг отражает ему свою долю урона
function takeDamage(damage, srcName, srcEnemy) {
    let x = status.hero.x
    let y = status.hero.y
    //неуязвимость валькирии после рывка (0.5с)
    if(dashInvulnActive()) return
    //броня: dollArmor() (V86) — своя + «Вечный сапфир» + сет «Турниры» (4) + баф магического
    //щита; read-time слагаемые в info.armor не пишем, начисление/снятие щитов не трогаем
    damage -= dollArmor()
    //контрудар
    if(Math.trunc(Math.random() * 100) < parseInt(status.info.stats[0].dops[1].value2.slice(0,-1))) {
        let lengthAttack = status.attack.stack.length
        for (let i = 0; i < lengthAttack; i++) {
            if (status.attack.stack[i].abil.base === 1) {
                status.attack.stack[i].timer = 1
                floatText(x+16,y-12,T("float.counter"),"#CD5C5C","18px","none")
            }
        }
    }
    //контрмагия
    if(status.info.activeSkills.length > 0 && Math.trunc(Math.random() * 100) < parseInt(status.info.stats[4].dops[2].value2.slice(0,-1))) {
        let rand = Math.trunc(Math.random() * status.info.activeSkills.length)
        status.info.activeSkills[rand].cooldown > 1 && (status.info.activeSkills[rand].cooldown = 1)
            floatText(x+16,y-44,T("float.cd",T(status.info.activeSkills[rand].skill.title)),"#CD5C5C","18px","none")
    }
    //уклонение    //блок
    if(Math.trunc(Math.random() * 100) < parseInt(status.info.stats[1].dops[2].value2.slice(0,-1))) {
        damage = 0
        floatText(x+16,y,T("float.dodge"),"#CD5C5C","18px","none")
        //Аура восстановления валькирии: уклонение лечит 1 ХП
        auraDodgeHeal()
    } else if(Math.trunc(Math.random() * 100) < parseInt(status.info.stats[0].dops[2].value2.slice(0,-1))) {
        damage = Math.trunc(damage/2)
        floatText(x+16,y-28,T("float.block"),"#CD5C5C","18px","none")
    }
    damage < 0 && (damage = 0)
    //V68 «Вечный жемчуг» (relic 4): герой получает на 25% меньше урона, отражённая доля
    //идёт врагу-источнику. Режем то, что реально дошло бы до героя (после брони/уклона/
    //блока, до магического щита — щит дальше поглощает остаток как обычно). Реликвия
    //уникальна (дублей не бывает) — ровно 25%; вызовы без врага (третьего параметра нет)
    //только снижают урон. Отражение по убитому/лежащему врагу отсекает relicReflect
    if(hasRelic(4) && damage > 0) {
        let heroPart = Math.trunc(damage * 3 / 4)
        let refl = damage - heroPart
        refl > 0 && relicReflect(srcEnemy, refl)
        damage = heroPart
    }
    //магический щит
    if(status.info.magicShieldDuration) {
        floatText(x+16,y-12,T("float.mshield",damage),"#CD5C5C","18px","none")
        status.info.magicShieldDuration -= damage
        if(status.info.magicShieldDuration <= 0) {
        let length = objectValues.length
        for (let i = 0; i < length; i++) {
            if(objectValues[i].img.href.animVal === "./images/effects/15.png") {
                    releaseSprite(objectValues[i].img)
                    objectValues[i] = undefined
                    objectValues.splice(i,1)
                    status.info.magicShieldObjI = undefined
                    status.info.magicShieldDuration = undefined
                    length--
                    i--
                }
            }
        }
        damage = 0
    }
    if(damage > 0) {
        status.info.resistanceAbil && damage > (status.info.resistCap || 3) && status.info.resistanceAbil.cooldown === 0 && (damage = useSkill(status.info.resistanceAbil)) //V42: кап 3 → 2 → 1
        //V75 «Стальная кожа» (шкафчик): атака или магия врага не может отнять больше 16 ХП.
        //Ловушки/горение/яд идут мимо takeDamage (свои строки) — не ограничены, как задумано
        blessActive(1) && damage > 16 && (damage = 16)
        floatText(Math.trunc(Math.random() * 32) + x,y+8,damage,"#CD5C5C","12px","none")
        //V37 журнал: красная строка — враг смог нанести урон герою (фактический урон по ХП)
        srcName && journalAdd(T("journ.herodmg",T(srcName),damage), J_RED)
        playEffect(status.hero.obj,data.effects[1])
        status.info.hp = status.info.hp - damage
        //Ветряной щит валькирии: отбрасывает врагов в квадрате 96×96
        shieldKnockback()
        checkFood()
        status.info.hp > 0 ? changeHP(ctxBar("hp"),ctxTx("hp"),"hp") : endGame()
    }
}
function checkFood() {
    let lengthBelt = status.info.beltCellArr.length
    for (let i = 0; i < lengthBelt; i++) {
        if(status.info.beltCellArr[i]) {
            let foodType = status.info.beltCellArr[i]
            foodType += Math.trunc(parseInt(status.info.stats[2].dops[2].value2.slice(0,-1))/100 * foodType)
            if(status.info.hp + Math.trunc(parseInt(status.info.stats[2].dops[0].value2.slice(0,-1)) * foodType) <= parseInt(status.info.stats[2].dops[0].value2.slice(0,-1))) {
                status.info.hp +=  Math.trunc(parseInt(status.info.stats[2].dops[0].value2.slice(0,-1)) * foodType)
                changeHP(ctxBar("hp"),ctxTx("hp"),"hp")
                floatText(status.hero.x - 16 + Math.trunc(Math.random() * 32),status.hero.y+8,"+" + Math.trunc(parseInt(status.info.stats[2].dops[0].value2.slice(0,-1)) * foodType),"#33FF66","18px","none")
                status.info.beltCellArr.splice(i,1)
                i--
                lengthBelt--
            }
        }
    }
    beltChange()
    //воскрешение
    if(status.info.resurrect && status.info.hp <= 0) {
        status.info.hp = Math.trunc(parseInt(status.info.stats[2].dops[0].value2.slice(0,-1))/2)
        changeHP(ctxBar("hp"),ctxTx("hp"),"hp")
        status.info.resurrect = false
        floatText(status.hero.x - 16 + Math.trunc(Math.random() * 32),status.hero.y+8,T("float.rebirth"),"#33FF66","18px","none")
    }
    //V75 «Второе дыхание» (шкафчик): дополняет воскресение — оно тратится первым (полХП),
    //это второй шанс ровно на 1 ХП; после срабатывания эффект расходуется (иконка исчезает).
    //Рыцарь с воскресением спасается дважды, остальные — один раз
    else if(blessActive(6) && status.info.hp <= 0) {
        status.info.hp = 1
        changeHP(ctxBar("hp"),ctxTx("hp"),"hp")
        spendBless(6)
        floatText(status.hero.x - 16 + Math.trunc(Math.random() * 32),status.hero.y+8,T("float.secondwind"),"#33FF66","18px","none")
    }
}
//V115: полосы — по ПАРЕ на игрока: блок P1 сдвинут влево на 460, P2 — вправо на 460
//(прежний составной блок 554..1365 по центру). Суффиксы DOM-id — по idx игрока
function checkHP() {
    for (let pi = 0; pi < status.players.length; pi++) {
        const P = status.players[pi]
        const bx = pi === 0 ? -460 : 460
        const info = P.info
        screenPic.push(image(svgArr[2],958+bx,987,407,64,"./images/UI/panels/hpBar.png"))
        screenPic.push(image(svgArr[2],554+bx,987,407,64,"./images/UI/panels/hpBar.png"))
        //R4: полосы нативные (спрайт + маска) — changeHP правит окно маски напрямую
        screenPic.push(worldBar(svgArr[2],1007+bx,1007,315,24,"./images/UI/panels/hpBarCol2.png",{"id":"hp"+pi}))
        screenPic.push(worldBar(svgArr[2],598+bx,1007,315,24,"./images/UI/panels/hpBarCol1.png",{"id":"exp"+pi}))
        screenPic.push(text(svgArr[2],1164+bx,1026,"0pt","50pt","none","2px",`#FFCC66`,info.hp+"/"+info.stats[2].dops[0].value2.slice(0,-1),{"id":"hpText"+pi,"size":24,"font":"baseFont4","anchor":"middle"}))
        screenPic.push(text(svgArr[2],760+bx,1026,"0pt","50pt","none","2px",`#FFCC66`,info.exp+"/"+nextLvlExp(info.lvl),{"id":"expText"+pi,"size":24,"font":"baseFont4","anchor":"middle"}))
        changeHP(document.getElementById("exp"+pi+"I"),document.getElementById("expText"+pi),"exp",pi)
        changeHP(document.getElementById("hp"+pi+"I"),document.getElementById("hpText"+pi),"hp",pi)

        screenPic.push(image(svgArr[2],927+bx,910,64,101,"./images/UI/panels/lvlBack.png"))
        screenPic.push(image(svgArr[2],912+bx,969,96,96,"./images/UI/panels/portBack2.png"))
        screenPic.push(image(svgArr[2],931+bx,988,58,58,P.attack.img))
        screenPic.push(text(svgArr[2],959+bx,967,"0pt","50pt","none","2px",`#FFCC66`,info.lvl,{"id":"lvlText"+pi,"size":24,"font":"baseFont4","anchor":"middle"}))
    }
}
function changeLvl() {
    //V115: уровень — в окно текущего контекстного игрока
    const el = ctxTx("lvl")
    el && (el.textContent = status.info.lvl)
}
function changeHP(img,text,type,pi) {
    //V115: суффикс полосы можно не передавать — берём idx контекстного игрока
    pi === undefined && (pi = status.hero.idx || 0)
    if(type==="hp" && status.info.randomHealDamageAbil && status.info.randomHealDamageAbil.cooldown === 0 && status.info.hp > parseInt(text.textContent.split('/')[0])) {
        status.info.takeHeal = status.info.hp - parseInt(text.textContent.split('/')[0])
        useSkill(status.info.randomHealDamageAbil)
    }    
    let lengthCol
    type==="hp"&&(lengthCol = Math.trunc(status.info.hp*315 / parseInt(status.info.stats[2].dops[0].value2.slice(0,-1))))
    type==="exp"&&(lengthCol = Math.trunc(status.info.exp*315 / nextLvlExp(status.info.lvl)))
    //R4: окно маски полосы правится напрямую (ХП заполняется слева, опыт — справа);
    //никаких clipPath-пересозданий в defs на каждое изменение
    img.setBarProgress && img.setBarProgress(lengthCol, type==="hp" ? "left" : "right")
    type==="hp"?
        text.textContent = status.info.hp+"/"+status.info.stats[2].dops[0].value2.slice(0,-1):
        text.textContent = status.info.exp+"/"+nextLvlExp(status.info.lvl)
}
export {takeDamage,checkHP,changeHP,changeLvl,checkFood,dollArmor}