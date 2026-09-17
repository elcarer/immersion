import { status } from "../scripts/start.js"
import { svgArr,image,worldImage,nativeSector, spritePos } from "../scripts/svg.js"
import { delPins } from "../scripts/checkBuffs.js"
import { checkCollision,playEffect,createSplash } from "../scripts/damage.js"
import { data } from "../scripts/data.js"
import { screenPic,del,objectValues } from "../scripts/del.js"
import { addAnim } from "../scripts/animPlay.js"
import { dataGeneric } from "../scripts/sceneGenerate.js"
import { changeHP } from "../scripts/takeDamage.js"
import { floatText } from "../scripts/floatText.js"
//V31: зум игровой сцены — единый писатель камеры игровых слоёв
import { setWorldViewBox } from "../scripts/zoomFx.js"
//V50: баф статуи «находчивость» (4-й баф, buff4.png) — кулдауны тают на 10% быстрее, пока висит
import { buffActive } from "../scripts/buffFx.js"
//V56: сет «Учёная волшебница» (4 надетых) — кулдауны тают на 5% быстрее
import { setCdRateBonus } from "../scripts/sets.js"
//V67: реликвии — «Вечный цитрин» (щит после активной способности) и копия «ядовитости»
import { hasRelic, abilCopyBonus } from "../scripts/relics.js"
//V67: общий щит неуязвимости (как после рывка Валькирии)
import { grantDashShield } from "../scripts/valkyrie.js"

let activeSkillsTemp = []
//V16: кэш узлов секторов кулдауна — раньше activeSkillsCD делал getElementById(i+"P")
//десять раз за тик, а updateCooldown на каждый тик кулдауна перечитывал x/y/r
//getAttribute'ми и пересобирал строку path d
let sectorCache = []
function activeSkills() {
    activeSkillsDel()
    let lengthActiveSkills = status.info.activeSkills.length
    for (let i = 0; i < lengthActiveSkills; i++) {
        let yUp = 0
        i >= 5 && (yUp = 110)
        //V83: чужая активная способность (portalFx.grantForeignSkill) может стать шестой —
        //ряд продолжается ВТОРОЙ СТРОКОЙ над первой (прежде i=5 рисовал x=1920 — за экраном)
        let xIcon = 1370 + (i >= 5 ? i - 5 : i) * 110
        activeSkillsTemp.push(image(svgArr[2],xIcon,970 - yUp,96,96,status.info.activeSkills[i].skill.img,{}))
        //R4.4: нативный сектор (Graphics + маска-окно 96×96) вместо path()+clipPath;
        //геометрия d-string — та же (getSectorPath переехал в pixiBackend)
        let sector = nativeSector(svgArr[2], xIcon + 48, 970 + 48 - yUp, 64, 96, {"id": i})
        sector._sx = xIcon + 48
        sector._sy = 970 + 48 - yUp
        sector._sr = 64
        sectorCache[i] = sector
        //V45: стартовое состояние сектора — по фактическому кулдауну/длительности. Раньше
        //сектор всегда рисовался ПОЛНЫМ тёмным кругом: способность, уже готовая (cooldown 0)
        //в момент пересборки иконок (смена этажа, изучение новой активной способности),
        //оставалась с тёмной иконкой навсегда — при cooldown===0 activeSkillsCD сектор
        //не перерисовывает, само по себе тёмное пятно не снималось.
        let skillEntry = status.info.activeSkills[i]
        if(skillEntry.cooldown > 0) {
            updateCooldown(skillEntry.cooldown,0,sector,skillEntry.skill.cooldown)
        } else if(skillEntry.duration > 0) {
            updateCooldown(skillEntry.duration,0,sector,skillEntry.skill.duration,true)
        } else {
            sector.setSector(0)
        }
        activeSkillsTemp.push(sector)
    }
}
function activeSkillsDel() {
    let length = activeSkillsTemp.length
    for (let i = 0; i < length; i++) {
        activeSkillsTemp[i].remove()
    }
    activeSkillsTemp = []
    sectorCache.length = 0
}
function activeSkillsCD() {
    let lengthActiveSkills = status.info.activeSkills.length
    //V46 аудит доп. статов: «Находчивость» (stats[3].dops[1], countLog%) сокращает время
    //перезарядки АКТИВНЫХ способностей — кулдаун тает на 1+нах% за тик, дробный остаток
    //копится в cdCarry (пересоздаётся с новым status.info на каждый забег). Прежде стат
    //был мёртв: его ветка в attack.js недостижима (в стеке героя только атаки base:1)
    let cdRate = 1 + parseInt(status.info.stats[3].dops[1].value2.slice(0,-1))/100
    //V50: 4-й баф статуи («находчивость», buff4.png) — пока висит, кулдауны всех активных
    //способностей тают на 10% быстрее (складывается с одноимённым статом сложением ставок)
    buffActive(4) && (cdRate += 0.1)
    //V56: сет «Учёная волшебница» (4 надетых): −5% кулдауна всех способностей — та же
    //механика ставки, складывается со статом «Находчивость» и бафом статуи сложением
    cdRate += setCdRateBonus()
    for (let i = 0; i < lengthActiveSkills; i++) {
        //V16: узел из кэша; fallback getElementById — если скилл добавили без пересборки UI
        let sector = sectorCache[i]
        if (!sector) {
            sector = document.getElementById(i+"P")
            sectorCache[i] = sector
        }
        if(status.info.activeSkills[i].cooldown > 0) {
            status.info.cdCarry = (status.info.cdCarry || 0) + cdRate
            let step = Math.trunc(status.info.cdCarry)
            status.info.cdCarry -= step
            step > 0 && (status.info.activeSkills[i].cooldown = Math.max(0, status.info.activeSkills[i].cooldown - step))
            updateCooldown(status.info.activeSkills[i].cooldown,0,sector,status.info.activeSkills[i].skill.cooldown)
        } else if(status.info.activeSkills[i].duration > 0) {
            status.info.activeSkills[i].duration--
            updateCooldown(status.info.activeSkills[i].duration,0,sector,status.info.activeSkills[i].skill.duration,true)
        } else {
            status.info.activeSkills[i].skill.title === "skill.0.2.title" && useSkill(status.info.activeSkills[i])
        }
    }
}
function updateCooldown(now,startTime,sectorPath,cooldownDuration,clockwise) {
    //сцена могла быть удалена (endScreen/comix → del()) — сектора кулдауна больше нет в DOM
    if (!sectorPath) return
    const elapsed = now - startTime;
    let remainingPercent = 1 - (elapsed / cooldownDuration);
    if (remainingPercent < 0) remainingPercent = 0;
    // Угол: от 360° (только начали, полностью закрыто) до 0° (открыто)
    let angle = 360 * remainingPercent;
    // Обновляем путь сектора
    //V16: x/y/r из кэша (проставлены в activeSkills), а не getAttribute-парсинг на тик
    if (sectorPath._sr === undefined) {
        sectorPath._sx = parseInt(sectorPath.getAttribute('x'))
        sectorPath._sy = parseInt(sectorPath.getAttribute('y'))
        sectorPath._sr = parseInt(sectorPath.getAttribute('r'))
    }
    sectorPath.setSector(angle, clockwise)
    if (elapsed === 0) {
        // Кулдаун окончен – убираем оверлей совсем (или скрываем)
        sectorPath.setSector(0)  // полностью открыто
    }
}
function useSkill(skill) {
    if(skill.skill.title === "skill.0.1.title") {
        status.info.invisible = 5
        status.info.invisibleTime = skill.skill.duration
        status.hero.obj.img.setAttribute("opacity", 0.5)
        skill.duration = skill.skill.duration
    }
    if(skill.skill.title === "skill.0.2.title") {
        delPins()
        status.info.pins = 3 + status.info.pinsAdd
        skill.cooldown = skill.skill.cooldown
    }
    if(skill.skill.title === "skill.0.5.title") {
        let rect = status.hero.obj.rect
        let length = objectValues.length
        for(let i = 0; i < length; i++) {
            if(objectValues[i].type === "bullet" && objectValues[i].target === status.hero.obj) {
                let rectB = objectValues[i].rect
                if(checkCollision(rectB.x.animVal.value - 32,rect.x.animVal.value,
                    rectB.width.animVal.value + 64,rect.width.animVal.value,
                    rectB.y.animVal.value - 32,rect.y.animVal.value,
                    rectB.height.animVal.value + 64,rect.height.animVal.value)) {
                    //V42: ур.2 Едкого дыма — длительность 150 тиков (~2.5с)
                    let dur = status.info.cloudeDur || skill.skill.duration
                    skill.duration = dur
                    status.info.cloudeTime = dur
                    status.info.cloude = playEffect(status.hero.obj,data.effects[5])
                }
            }
        }
    }
    if(skill.skill.title === "skill.0.13.title") {
        let rect = status.hero.obj.rect
        let length = objectValues.length
        for(let i = 0; i < length; i++) {
            if(objectValues[i].type === "enemy" && objectValues[i].direction === status.hero.direction) {
                let rectB = objectValues[i].rect
                let order
                if(status.hero.direction === 0) {rect.y.animVal.value < rectB.y.animVal.value ? order = 0 : order = 1}
                if(status.hero.direction === 1) {rect.y.animVal.value > rectB.y.animVal.value ? order = 0 : order = 1}
                if(status.hero.direction === 2) {rect.x.animVal.value < rectB.x.animVal.value ? order = 0 : order = 1}
                if(status.hero.direction === 3) {rect.x.animVal.value > rectB.x.animVal.value ? order = 0 : order = 1}
                if(((status.hero.direction === 2 || status.hero.direction === 3) &&
                    rectB.y.animVal.value - 16 < rect.y.animVal.value &&
                    rectB.y.animVal.value + 16 > rect.y.animVal.value &&
                    Math.abs(rectB.x.animVal.value - rect.x.animVal.value) < 256)||
                    ((status.hero.direction === 0 || status.hero.direction === 1) &&
                        rectB.x.animVal.value - 16 < rect.x.animVal.value &&
                        rectB.x.animVal.value + 16 > rect.x.animVal.value &&
                        Math.abs(rectB.y.animVal.value - rect.y.animVal.value) < 256)) {
                    let direct = []
                    if(status.hero.direction === 0) {order ? direct = [0,6,4] : direct = [1,7,5]}
                    if(status.hero.direction === 1) {order ? direct = [1,7,5] : direct = [0,6,4]}
                    if(status.hero.direction === 2) {order ? direct = [2,7,6] : direct = [3,4,5]}
                    if(status.hero.direction === 3) {order ? direct = [3,4,5] : direct = [2,7,6]}
                    addAnim ([12,direct[0]],objectValues[i],status.hero.obj,direct[0])
                    addAnim ([12,direct[1]],objectValues[i],status.hero.obj,direct[1])
                    addAnim ([12,direct[2]],objectValues[i],status.hero.obj,direct[2])
                    skill.cooldown = skill.skill.cooldown
                }
            }
        }
    }
    if(skill.skill.title === "skill.0.11.title") {
        let lengthEnemy = objectValues.length
        for(let i = 0; i < lengthEnemy; i++) {
            if(objectValues[i].type === "enemy" && checkCollision(status.hero.x-64,objectValues[i].rect.x.animVal.value,160,objectValues[i].rect.width.animVal.value,status.hero.y-64,objectValues[i].rect.y.animVal.value,179,objectValues[i].rect.height.animVal.value)) {
                objectValues[i].grap = 1
                status.info.graped = objectValues[i]
                skill.cooldown = skill.skill.cooldown
            }
        }
    }
    if(skill.skill.title === "skill.1.0.title") {
        let length = objectValues.length
        for(let i = 0; i < length; i++) {
            if(objectValues[i].type === "enemy" && checkCollision(status.hero.x-160,objectValues[i].rect.x.animVal.value,352,objectValues[i].rect.width.animVal.value,status.hero.y-160,objectValues[i].rect.y.animVal.value,371,objectValues[i].rect.height.animVal.value)) {
                //V42: урон шара по уровню (2/3/4) — копия скилла, data.js не мутируем
                addAnim ([16,0],objectValues[i],status.hero.obj,undefined,Object.assign({},skill.skill,{"damage":status.info.fireDmg || skill.skill.damage}))
                skill.cooldown = skill.skill.cooldown
                status.info.grimore === 1 && (skill.cooldown -= 60)
                break
            }
        }
    }
    if(skill.skill.title === "skill.1.1.title") {
        let length = objectValues.length
        for(let i = 0; i < length; i++) {
            if(objectValues[i].type === "enemy" && checkCollision(status.hero.x-32,objectValues[i].rect.x.animVal.value,96,objectValues[i].rect.width.animVal.value,status.hero.y-32,objectValues[i].rect.y.animVal.value,115,objectValues[i].rect.height.animVal.value)) {
                addAnim ([18,0],objectValues[i],status.hero.obj,undefined,skill.skill)
                skill.cooldown = skill.skill.cooldown
                status.info.grimore === 1 && (skill.cooldown -= 60)
                if(status.info.coldAbilPoison) {
                    //V42: базовый яд Отравленного льда 1 → 2 → 3 по уровню способности
                    //V67: копия «ядовитости» (Вечный сапфир) прибавляется к базовому ядру
                    let poison = status.info.coldAbilPoison || 1
                    status.info.poisonus + abilCopyBonus("poisonus") > 0 && (poison += status.info.poisonus + abilCopyBonus("poisonus"))
                    !objectValues[i].poison && (objectValues[i].poison = 0)
                    !objectValues[i].poisonTime && (objectValues[i].poisonTime = 0)
                    objectValues[i].poison += Math.trunc(poison * status.info.poisonusMult)
                    objectValues[i].poisonTime += 30
                    playEffect(objectValues[i],data.effects[3])
                }
                break
            }
        }
    }
    if(skill.skill.title === "skill.1.2.title") {
        let length = objectValues.length
        for(let i = 0; i < length; i++) {
            if(objectValues[i].type === "enemy" && checkCollision(status.hero.x-160,objectValues[i].rect.x.animVal.value,352,objectValues[i].rect.width.animVal.value,status.hero.y-160,objectValues[i].rect.y.animVal.value,371,objectValues[i].rect.height.animVal.value)) {
                playEffect(objectValues[i],data.effects[9])
                skill.cooldown = skill.skill.cooldown
                status.info.grimore === 1 && (skill.cooldown -= 60)
                status.info.earthAbilCooldown && (skill.cooldown -= status.info.earthAbilCooldown)
                break
            }
        }
    }
    if(skill.skill.title === "skill.1.6.title") {
        status.info.meteorTime = 120
        skill.cooldown = skill.skill.cooldown
        status.info.grimore === 1 && (skill.cooldown -= 60)
        status.info.meteorHole = playEffect(status.hero.obj,data.effects[11])
        screenPic.push(worldImage(svgArr[0],status.hero.obj.rect.x.animVal.value - 16,status.hero.obj.rect.y.animVal.value - 600,64,66,"./images/effects/12.png"))
        status.info.meteor = screenPic[screenPic.length-1]
    }
    if(skill.skill.title === "skill.1.9.title") {
        //E-11 (ТЗ юзера): телепорт по взгляду вместо случайной комнаты. Проверяются
        //клетки 1..5 по направлению взгляда героя (0 вверх, 1 вниз, 2 влево, 3 вправо),
        //начиная от его клетки; цель — ПЕРВАЯ свободная клетка в ДРУГОЙ комнате (не в
        //той, где стоит герой). Обычный телепорт — только открытая комната; улучшенный
        //«со щитом» (skill.1.13, флаг magicShield) — и закрытая. «Свободна»: пол по
        //матрице этажа, без твёрдых объектов (правила collisionCheckObject: ловушка 14
        //и рычаг 19 проходимы) и живых врагов. Кандидатов нет — телепорт НЕ применяется:
        //кулдаун не тратится, ранний return из useSkill (без «Вечного цитрина»),
        //следующая попытка — с следующим проигрышем анимации wait (триггер checkEndAnim)
        const DIRV = [[0, -1], [0, 1], [-1, 0], [1, 0]]
        const m = status.matrixLevel
        const lv = dataGeneric.scenes[status.levelFloor]
        const hx = Math.trunc(status.hero.x / 32), hy = Math.trunc(status.hero.y / 32)
        const dv = DIRV[status.hero.direction] || DIRV[1]
        //комната клетки → номер в roomsArr (−1 — коридор/вне комнат)
        const roomAt = (cx, cy) => {
            for (let k = 0; k < lv.roomsArr.length; k++) {
                const f = lv.floor[lv.roomsArr[k][0]]
                if (cx >= f[0] && cx < f[0] + f[2] && cy >= f[1] && cy < f[1] + f[3]) return k
            }
            return -1
        }
        const heroRoom = roomAt(hx, hy)
        let target = null
        for (let step = 1; step <= 5 && !target; step++) {
            const cx = hx + dv[0] * step, cy = hy + dv[1] * step
            if (!m[cy] || m[cy][cx] !== 1) continue
            const rk = roomAt(cx, cy)
            if (rk < 0 || rk === heroRoom) continue
            if (lv.roomsArr[rk][3] !== 1 && status.info.magicShield !== 1) continue
            let blocked = false
            //твёрдые объекты этажа (габариты — в клетках o[3]×o[4], как в collision.js)
            for (let i = 0; i < lv.objects.length && !blocked; i++) {
                const o = lv.objects[i]
                if (o[2] === 14 || o[2] === 19) continue
                blocked = cx >= o[0] && cx < o[0] + o[3] && cy >= o[1] && cy < o[1] + o[4]
            }
            //живые враги
            for (let i = 0; i < objectValues.length && !blocked; i++) {
                const o = objectValues[i]
                if (!o || o.type !== "enemy" || o.lying !== undefined) continue
                blocked = o.rect.x.animVal.value < (cx + 1) * 32 &&
                    o.rect.x.animVal.value + o.rect.width.animVal.value > cx * 32 &&
                    o.rect.y.animVal.value < (cy + 1) * 32 &&
                    o.rect.y.animVal.value + o.rect.height.animVal.value > cy * 32
            }
            if (!blocked) target = [cx, cy]
        }
        if (!target) return
        status.hero.x = target[0] * 32 + 16
        status.hero.y = target[1] * 32 + 16
        spritePos(status.hero.obj.img, status.hero.x, status.hero.y)
        //V31: окно камеры подставляет setWorldViewBox (1920/zoom × 1080/zoom), x/y прежние
        setWorldViewBox(status.hero.x - 960, status.hero.y - 540)
        playEffect(status.hero.obj,data.effects[14])
        if (status.info.magicShield === 1) {
            playEffect(status.hero.obj,data.effects[15])
            status.info.magicShieldDuration = 300
        }
        skill.cooldown = skill.skill.cooldown
        status.info.grimore === 1 && (skill.cooldown -= 60)
    }
    if(skill.skill.title === "skill.2.1.title") {
        if(status.info.reflect === 1) {
            status.info.auraReflect = image(svgArr[1],status.hero.obj.rect.x.animVal.value - 32,status.hero.obj.rect.y.animVal.value - 19,96,96,"./images/effects/reflect.png",{})
        } else if(status.info.reflect === 2) {
            status.info.auraReflect = image(svgArr[1],status.hero.obj.rect.x.animVal.value - 64,status.hero.obj.rect.y.animVal.value - 51,160,160,"./images/effects/reflect2.png",{})
        }
        svgArr[1].prepend(status.info.auraReflect)
        status.info.auraReflect.setAttribute("opacity", 0.7)
        skill.duration = skill.skill.duration
    }
    if(skill.skill.title === "skill.2.2.title") {
        //V45: «Восстановление» лечит при ХП < макс. ХП и клампится к макс. ХП —
        //dops[0] («Жизни»). Раньше брался dops[2] («Выносливость, %»): лечение
        //срабатывало только при ХП ниже числа выносливости и клампилось к нему.
        status.info.healSelfAbil && status.info.hp < parseInt(status.info.stats[2].dops[0].value2.slice(0,-1)) && restoreHP()
        function restoreHP() {
            status.info.hp += status.info.healSelfAbil
            status.info.hp > parseInt(status.info.stats[2].dops[0].value2.slice(0,-1)) && (status.info.hp = parseInt(status.info.stats[2].dops[0].value2.slice(0,-1)))
            changeHP(document.getElementById("hpBarI"),document.getElementById("hpText"),"hp")
            floatText(status.hero.x - 16 + Math.trunc(Math.random() * 32),status.hero.y+8,"+" + status.info.healSelfAbil,"#33FF66","18px","none") //V42: показываем реальное лечение (1/2)
        }
        skill.cooldown = skill.skill.cooldown
        //V42: кап входящего урона 3 → 2 → 1 по уровню Противодействия
        return status.info.resistCap || 3
    }
    if(skill.skill.title === "skill.2.11.title") {
        skill.cooldown = skill.skill.cooldown
        let length = objectValues.length
        let enemyArr = []
        for(let i = 0; i < length; i++) {
            if (objectValues[i].type === "enemy") {
                enemyArr.push(objectValues[i])
            }
        }
        if (enemyArr.length > 0) {
            let target = enemyArr[Math.floor(Math.random() * enemyArr.length)]
            //V37: имя умения — для строк журнала о сплэш-уроне
            createSplash(target,7,status.info.takeHeal,0,32,1,skill.skill.title)
        }
        status.info.takeHeal = 0
    }
    if(skill.skill.title === "skill.2.13.title") {
        skill.cooldown = skill.skill.cooldown
    }
    //V67 «Вечный цитрин» (relic 1): после применения ЛЮБОЙ активной способности герой
    //получает щит неуязвимости 0.5с — ровно как у Валькирии после рывка (общий
    //grantDashShield: таймер dashInvuln + спрайт immun.png; повторный каст обновляет таймер).
    //useSkill — единая точка применения: здесь проходят и ручные касты (animPlay), и
    //автокасты (checkBuffs), и срабатывающие по событию реакции (казнь/противодействие)
    hasRelic(1) && grantDashShield()
}
export {activeSkills,activeSkillsCD,useSkill,activeSkillsDel}