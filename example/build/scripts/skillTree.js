import { svgArr,image, text, rect } from "../scripts/svg.js"
import { status } from "../scripts/start.js"
import { T } from "../scripts/localization.js"
import { tip,tipDel } from "../scripts/tip.js"
import { data } from "../scripts/data.js"
import { activeSkills,useSkill } from "../scripts/activeSkills.js"
import { playback,strike,musicDuck } from "../scripts/sound.js"
//V52: достижение «Кап-кап» — все способности класса на максимумах за один забег
import { achSkillsCheck } from "../scripts/achievements.js"
//V86: число брони на кукле — единая сумма dollArmor() (та же, что в формуле урона)
import { dollArmor } from "../scripts/takeDamage.js"
import { inventory,inventoryTemp } from "../scripts/inventory.js"

let skillTreeTemp = []
//V42: уровень способности = число вхождений индекса в status.info.skills —
//повторная покупка выученной способности стоит 1 очко и поднимает уровень
//(старые сейвы совместимы: без дублей все способности имеют уровень 1)
function skillLevel(i) {
    let n = 0
    for (let j = 0; j < status.info.skills.length; j++) status.info.skills[j] === i && n++
    return n
}
//V42: максимальный уровень способности — по наличию описаний уровней в data.js
function skillMax(skill) {
    return skill.descFullL3 ? 3 : skill.descFullL2 ? 2 : 1
}
//V70: кап способностей — все способности ТЕКУЩЕГО класса выучены на своих максимумах
//(формулы те же, что в achSkillsCheck: уровень = вхождения индекса, максимум — по descFullL2/L3)
function skillsCapped() {
    let skills = data.heroes[status.hero.class].skills
    for (let i = 0; i < skills.length; i++) {
        if (skillLevel(i) < skillMax(skills[i])) return false
    }
    return true
}
//V70: при капе лишним очкам способностей некуда деться — автоматически переводим
//их в неизрасходованные очки характеристик 1:1 (вызовы: уровень героя, алтарь obj.12,
//открытие дерева — ретро-конвертация очков, застрявших до введения перевода)
function abilOverflowToStats() {
    if (status.info.abilPoints > 0 && skillsCapped()) {
        status.info.upStat += status.info.abilPoints
        status.info.abilPoints = 0
    }
}
function skillTree() {
    status.pause = 1
    status.move = 0
    status.panels = 5
    musicDuck(1)
    //V70: конвертация при каждом открытии дерева (в т.ч. сразу после покупки последнего уровня)
    abilOverflowToStats()
    skillTreeTemp.push(image(svgArr[2],870,160,919,796,"./images/UI/panels/panel.png"))
    skillTreeTemp.push(image(svgArr[2],870,160,919,796,"./images/UI/skill/"+status.hero.class+".png"))
    skillTreeTemp.push(text(svgArr[2],1325,215,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("st.title"),{"id":"delItemText","size":60,"font":"baseFont4","anchor":"middle"}))
    status.info.abilPoints && skillTreeTemp.push(text(svgArr[2],1325,938,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("st.unspent",status.info.abilPoints),{"id":"delItemText","size":40,"font":"baseFont4","anchor":"middle"}))
    let lengthSkills = data.heroes[status.hero.class].skills.length
    for (let i = 0; i < lengthSkills; i++) {
        //V83a: здесь cls НЕТ (это отрисовка дерева, а не skillEffect) — прежнее обращение
        let skill = data.heroes[status.hero.class].skills[i]
        skillTreeTemp.push(image(svgArr[2],910+142*skill.x,280+150*skill.y,128,128,skill.img,{//"borderColor":`rgb(204, 153, 102)`,
        "func":() => shooseSkill(skill,i),
        "funcShow":e => {
            tip(e,skill)},
        "funcShowOut":e => {
            tipDel()}
    }))
        let iconEl = skillTreeTemp[skillTreeTemp.length - 1]
        //V42: findSkill — выучена ли (уровень > 0); findPrev — число РАЗЛИЧНЫХ выученных
        //предков: дубли (уровни одной способности) не должны ломать проверку доступа
        let findSkill = skillLevel(i) > 0 ? 1 : 0
        let findPrev = 0
        if (typeof(skill.prev) === "object") {
            let uniqLearned = [...new Set(status.info.skills)]
            for (let j = 0; j < skill.prev.length; j++) uniqLearned.indexOf(skill.prev[j]) !== -1 && findPrev++
        }
        if((skill.prev === 0 && findSkill === 0) || (findPrev === skill.prev.length && findSkill === 0)) {
            skillTreeTemp[skillTreeTemp.length - 1].setAttribute("opacity", 0.3)
            skillTreeTemp[skillTreeTemp.length - 1].style.filter = "drop-shadow(0 0 10px rgba(102, 255, 102, 1))"
            findSkill = 1
        }
        if(findSkill === 0) {
            skillTreeTemp[skillTreeTemp.length - 1].setAttribute("opacity", 0.3)
            skillTreeTemp.push(image(svgArr[2],950+142*skill.x,310+150*skill.y,48,67,"./images/UI/panels/lock.png"))
        }
        //V42: бейдж «текущий/макс» в углу иконки выученной многоуровневой способности +
        //зелёная подсветка, если способность ещё не на максимуме (можно улучшить)
        let lvl = skillLevel(i)
        let maxLvl = skillMax(skill)
        if(lvl > 0 && maxLvl > 1) {
            lvl < maxLvl && (iconEl.style.filter = "drop-shadow(0 0 10px rgba(102, 255, 102, 1))")
            skillTreeTemp.push(rect(svgArr[2],910+142*skill.x+82,280+150*skill.y+98,46,30,`rgb(204, 153, 102)`,"1px","rgba(16,12,10,0.75)",{"id":"skillLvlBack","rx":"4px"}))
            skillTreeTemp.push(text(svgArr[2],910+142*skill.x+105,280+150*skill.y+120,"0pt","50pt","none","1px",`rgb(204, 153, 102)`,lvl+"/"+maxLvl,{"id":"skillLvlText","size":26,"font":"baseFont4","anchor":"middle"}))
        }
    }
    inventoryTemp.push(image(svgArr[2],1550,165,208,60,"./images/UI/panels/buttons/icon7.png",{"id":"delItem","glow":1,"func":()=>{skillTreeDel(1);inventory();playback(strike[14].vol,0,0,3*status.settings.soundVolume)}}))
    //V73: подпись кнопки инвентаря — на 48px правее центра (иконка на спрайте слева)
    inventoryTemp.push(text(svgArr[2],1680,207,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("ui.inventory"),{"id":"delItemText","size":36,"font":"baseFont4","anchor":"middle"}))
}
function skillTreeDel(nomusic=0) {
    let length = skillTreeTemp.length
    for (let i = 0; i < length; i++) {
        skillTreeTemp[i].remove()
    }
    skillTreeTemp = []
    status.move = 1
    status.panels = 0
    status.pause = 0
    tipDel()
    nomusic === 0 && musicDuck(0)
}
function shooseSkill(skill,i) {
    if (status.info.abilPoints > 0) {
        //V42: findSkill — выучена ли (уровень > 0); findPrev — число РАЗЛИЧНЫХ выученных
        //предков: дубли (уровни одной способности) не должны ломать проверку доступа
        let findSkill = skillLevel(i) > 0 ? 1 : 0
        let findPrev = 0
        if (typeof(skill.prev) === "object") {
            let uniqLearned = [...new Set(status.info.skills)]
            for (let j = 0; j < skill.prev.length; j++) uniqLearned.indexOf(skill.prev[j]) !== -1 && findPrev++
        }
        if(findSkill === 0 && (skill.prev === 0 || findPrev === skill.prev.length)) {
            status.info.abilPoints--
            status.info.skills.push(i)
            skillEffect(i)
            skillTreeDel(1)
            skillTree()
        } else if(findSkill === 1 && skillMax(skill) > skillLevel(i)) {
            //V42: апгрейд выученной многоуровневой способности — тоже за 1 очко
            status.info.abilPoints--
            status.info.skills.push(i)
            skillEffect(i)
            skillTreeDel(1)
            skillTree()
        }
    }
}
//V83: cls/lvl — явные аргументы со старыми дефолтами: портал вида 2 выдаёт чужую
//активную способность уровня 1 тем же конвейером (portalFx.grantForeignSkill), не трогая
//info.skills. Дефолты сохраняют прежнее поведение вызовов из shooseSkill
function skillEffect(i, cls = status.hero.class, lvl = skillLevel(i)) {
    //V42: lvl — уровень способности ПОСЛЕ текущего изучения/апгрейда (push уже сделан)
    //способности роги
    if(cls === 0) {
        i === 0 && (status.info.poisonus += 1)
        if(i === 1) {
            status.info.activeSkills.push({"cooldown":1,"duration":0,"skill":data.heroes[cls].skills[i]})
            activeSkills()
        }
        if(i === 2) {
            status.info.activeSkills.push({"cooldown":data.heroes[cls].skills[i].cooldown,"maxNumber":6,"skill":data.heroes[cls].skills[i]})
            activeSkills()
            useSkill(status.info.activeSkills[status.info.activeSkills.length - 1])
        }
        i === 3 && (status.info.backStab += 0.5)
        i === 4 && (status.info.multSpeed += 0.2)
        if(i === 5) {
            if(lvl === 1) {
                status.info.activeSkills.push({"cooldown":1,"duration":0,"skill":data.heroes[cls].skills[i]})
                status.info.cloudeAbil = status.info.activeSkills[status.info.activeSkills.length - 1]
                activeSkills()
            } else {
                //V42 ур.2: длительность дыма 90 → 150 тиков (~2.5с)
                status.info.cloudeDur = 150
            }
        }
        i === 6 && (status.info.pinsAdd++)
        //V42: Отмычки 50% → 75% на втором уровне
        i === 7 && (lvl === 1 ? status.info.keyLock += 50 : status.info.keyLock += 25)
        i === 8 && (status.info.poisonusMult++)
        i === 9 && (status.info.killHeal++)
        i === 10 && (status.info.pinsStan = true)
        if(i === 11) {
            status.info.activeSkills.push({"cooldown":1,"skill":data.heroes[cls].skills[i]})
            status.info.grapAbil = status.info.activeSkills[status.info.activeSkills.length - 1]
            activeSkills()
        }
        if(i === 12) {status.info.viewus += 3;status.info.goldroom += 1}
        if(i === 13) {
            status.info.activeSkills.push({"cooldown":1,"skill":data.heroes[cls].skills[i]})
            status.info.knifeAbil = status.info.activeSkills[status.info.activeSkills.length - 1]
            activeSkills()
        }
    }
    //способности волшебницы
    if(cls === 1) {
        if(i === 0) {
            if(lvl === 1) {
                status.info.activeSkills.push({"cooldown":1,"skill":data.heroes[cls].skills[i]})
                status.info.fireAbil = status.info.activeSkills[status.info.activeSkills.length - 1]
                activeSkills()
            }
            //V42: урон 2 → 3 → 4 (потребитель — useSkill «Огненный шар»)
            status.info.fireDmg = 1 + lvl
        }
        i === 3 && (status.info.fireSplash = 1)
        if(i === 1) {
            if(lvl === 1) {
                status.info.activeSkills.push({"cooldown":1,"skill":data.heroes[cls].skills[i]})
                status.info.coldAbil = status.info.activeSkills[status.info.activeSkills.length - 1]
                activeSkills()
            } else {
                //V42 ур.2: заморозка 60 → 90 тиков (1.5с)
                status.info.coldDur = 90
            }
        }
        if(i === 2) {
            status.info.activeSkills.push({"cooldown":1,"skill":data.heroes[cls].skills[i]})
            status.info.earthAbil = status.info.activeSkills[status.info.activeSkills.length - 1]
            activeSkills()
        }
        i === 7 && (status.info.stoneCurse++)
        i === 10 && (status.info.earthAbilCooldown = 120)
        //V42: Отравленный лёд — базовый яд 1 → 2 → 3 (потребитель читает coldAbilPoison)
        i === 5 && (status.info.coldAbilPoison++)
        i === 4 && (status.info.fireIce = 1.5)
        if(i === 6) {
            status.info.activeSkills.push({"cooldown":1,"skill":data.heroes[cls].skills[i]})
            activeSkills()
        }
        if(i === 9) {
            status.info.activeSkills.push({"cooldown":120,"skill":data.heroes[cls].skills[i]})
            activeSkills()
        }
        i === 13 && (status.info.magicShield = 1)
        i === 12 && (status.info.grimore = 1)
        //V42: Кулинария 5% → 10% на втором уровне (потребитель — damage.js)
        if(i === 11) {
            status.info.beacon = 1
            status.info.cookChance = lvl === 1 ? 0.05 : 0.10
        }
        i === 8 && (status.info.luckus++)
    }
    //способности рыцаря
    if(cls === 2) {
        //V42: armorText создаётся только при открытии куклы (doll.js) — на свежем забеге его нет
        //V86: показываем полный итог dollArmor() — раньше писали голый info.armor, терялись
        //копия «Вечного сапфира», сет «Турниры» (4) и баф магического щита
        if(i === 0) {status.info.armor++;status.info.armorText && (status.info.armorText.textContent = dollArmor())}
        if(i === 1) {
            status.info.activeSkills.push({"cooldown":1,"duration":900,"skill":data.heroes[cls].skills[i]})
            status.info.reflectAbil = status.info.activeSkills[status.info.activeSkills.length - 1]
            activeSkills()
        }
        i === 5 && status.info.reflect++
        i === 4 && (status.info.energyShot = 1)
        if(i === 2) {
            if(lvl === 1) {
                status.info.activeSkills.push({"cooldown":1,"skill":data.heroes[cls].skills[i]})
                status.info.resistanceAbil = status.info.activeSkills[status.info.activeSkills.length - 1]
                activeSkills()
            }
            //V42: кап входящего урона 3 → 2 → 1 (потребители — takeDamage.js/activeSkills.js)
            status.info.resistCap = 4 - lvl
        }
        if(i === 6) {
            //V42: лечение 1 → 2 на втором уровне
            status.info.healSelfAbil++
        }
        if(i === 11) {
            status.info.activeSkills.push({"cooldown":1,"skill":data.heroes[cls].skills[i]})
            status.info.randomHealDamageAbil = status.info.activeSkills[status.info.activeSkills.length - 1]
            activeSkills()
        }
        i === 7 && (status.info.searshFood = 0.2)
        i === 10 && (status.info.resurrect = true)
        i === 3 && (status.info.stoneSkin = true)
        //V42: −1с → −2с дебафов на втором уровне
        i === 9 && (status.info.removeDebuff++)
        i === 8 && (status.info.powerCrush = 1)
        if(i === 13) {
            if(lvl === 1) {
                status.info.activeSkills.push({"cooldown":1,"skill":data.heroes[cls].skills[i]})
                status.info.executionAbil = status.info.activeSkills[status.info.activeSkills.length - 1]
                activeSkills()
            }
            //V42 ур.2: порог казни 30% → 40% (потребитель — damage.js)
            lvl === 2 && (status.info.executionPct = 0.4)
        }
        i === 12 && (status.info.defMaxAttack = true)
    }
    //способности валькирии
    if(cls === 3) {
        //0 — Пронзающий рывок: активный, активация двумя разными направлениями за 0.5с (логика в valkyrie.js)
        if(i === 0) {
            status.info.activeSkills.push({"cooldown":1,"duration":0,"skill":data.heroes[cls].skills[i]})
            status.info.dashAbil = status.info.activeSkills[status.info.activeSkills.length - 1]
            activeSkills()
        }
        //1 — Разгон: пассив
        if(i === 1) {
            status.info.razgonAbil = 1
            //V42 ур.2: макс. бонус +25% → +40% (потребитель — valkyrie.js)
            lvl === 2 && (status.info.razgonMax = 40)
        }
        //2 — Боевой танец: пассив
        i === 2 && (status.info.danceAbil = 1)
        //3 — Вихрь дротиков: активный, автокаст
        if(i === 3) {
            if(lvl === 1) {
                status.info.activeSkills.push({"cooldown":1,"duration":0,"skill":data.heroes[cls].skills[i]})
                status.info.whirlAbil = status.info.activeSkills[status.info.activeSkills.length - 1]
                activeSkills()
            }
            //V42: 2 → 3 → 4 дротика (потребитель — startWhirl в valkyrie.js)
            status.info.whirlDarts = 1 + lvl
        }
        //4 — Вихревой след: пассив
        i === 4 && (status.info.trailAbil = 1)
        //5 — Импульс: пассив
        i === 5 && (status.info.impulseAbil = 1)
        //6 — Ветряной щит: пассив
        i === 6 && (status.info.shieldAbil = 1)
        //7 — Дротик-бумеранг: пассив
        i === 7 && (status.info.boomerangAbil = 1)
        //8 — Рывок-отскок: пассив
        i === 8 && (status.info.bounceAbil = 1)
        //9 — Высшая справедливость: пассив
        if(i === 9) {
            status.info.justiceAbil = 1
            //V42 ур.2: шанс 25% → 40% (потребитель — valkyrie.js)
            lvl === 2 && (status.info.justiceChance = 0.4)
        }
        //10 — Торнадо дротиков: пассив
        i === 10 && (status.info.tornadoAbil = 1)
        //11 — Крылья валькирии: активный, автокаст
        if(i === 11) {
            status.info.activeSkills.push({"cooldown":1,"duration":0,"skill":data.heroes[cls].skills[i]})
            status.info.wingsAbil = status.info.activeSkills[status.info.activeSkills.length - 1]
            activeSkills()
        }
        //12 — Аура восстановления: активный, автокаст
        if(i === 12) {
            if(lvl === 1) {
                status.info.activeSkills.push({"cooldown":1,"duration":0,"skill":data.heroes[cls].skills[i]})
                status.info.auraAbil = status.info.activeSkills[status.info.activeSkills.length - 1]
                activeSkills()
            }
            //V42 ур.2: лечение до 2 ХП за срабатывание (потребитель — valkyrie.js auraHeal)
            lvl === 2 && (status.info.auraCap = 2)
        }
        //13 — Гроза Йотунов: активный, автокаст (заряжает следующий дротик)
        if(i === 13) {
            if(lvl === 1) {
                status.info.activeSkills.push({"cooldown":1,"duration":0,"skill":data.heroes[cls].skills[i]})
                status.info.stormAbil = status.info.activeSkills[status.info.activeSkills.length - 1]
                activeSkills()
            }
            //V42 ур.2: 20% → 30% макс. ХП врага (потребитель — valkyrie.js dartDamage)
            lvl === 2 && (status.info.stormPct = 0.3)
        }
    }
    //V52: после каждого изучения/апгрейда — проверка «Кап-кап»
    achSkillsCheck()
}
export {skillTree,skillTreeDel,skillTreeTemp,abilOverflowToStats,skillEffect}