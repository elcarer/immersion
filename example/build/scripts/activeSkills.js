import { status } from "../scripts/start.js"
//V115: полосы ХП/опыта — суффиксы по игроку (players.js)
import { ctxBar,ctxTx } from "../scripts/players.js"
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
//E-19: подсказка на иконках активных способностей (та же, что в дереве способностей)
import { tip,tipDel } from "../scripts/tip.js"
//E-22: телепорт — снап камеры по фактическим половинам окна зума; открытие посадки
//через checkNewRoom (комнаты/коридор вокруг точки высадки рисуются сразу)
import { worldViewW, worldViewH } from "../scripts/zoomFx.js"
//V123: совместный телепорт
import { teleportPartners } from "../scripts/portalFx.js"
import { checkNewRoom } from "../scripts/heroMove.js"

let activeSkillsTemp = []
//V16: кэш узлов секторов кулдауна — раньше activeSkillsCD делал getElementById(i+"P")
//десять раз за тик, а updateCooldown на каждый тик кулдауна перечитывал x/y/r
//getAttribute'ми и пересобирал строку path d
let sectorCache = []
function activeSkills() {
    activeSkillsDel()
    //V122 (репорт юзера): ряд иконок активных способностей — у КАЖДОГО игрока, НАД
    //ЕГО полосками ХП/опыта (сдвиг блока bx — как в checkHP: P1 -460, P2 +460).
    //Раньше ряд был один, справа внизу, и только у игрока 1.
    for (let pi = 0; pi < status.players.length; pi++) {
        const P = status.players[pi]
        if (!P.obj || P.obj.type !== "hero") continue
        const bx = pi === 0 ? -460 : 460
        sectorCache[pi] = sectorCache[pi] || []
        let lengthActiveSkills = P.info.activeSkills.length
        for (let i = 0; i < lengthActiveSkills; i++) {
        //V83: чужая активная способность (portalFx.grantForeignSkill) может стать шестой —
        //ряд продолжается ВТОРОЙ СТРОКОЙ над первой
        //E-19: подсказка при наведении — как в дереве способностей (skillTree tip);
        //skill захватываем в константу: массив activeSkills может переиндексироваться
        //к моменту наведения (смена этажа перерисовывает ряд)
        const sk = P.info.activeSkills[i].skill
        let yUp = 0
        i >= 5 && (yUp = 110)
        let xIcon = 960 + bx - 268 + (i >= 5 ? i - 5 : i) * 110
        let yIcon = 806 - yUp // нижний ряд вплотную над lvlBack полосок (910)
        const ic = image(svgArr[2],xIcon,yIcon,96,96,sk.img,
            {"funcShow":e => tip(e,sk),"funcShowOut":tipDel})
        activeSkillsTemp.push(ic)
        //R4.4: нативный сектор (Graphics) вместо path()+clipPath. V110: радиус 46 —
        //вписанная в иконку 96×96 окружность. V122 (репорт юзера: «круг затемнения
        //не обрезается по размеру иконки»): затемнение = ТЁМНАЯ КОПИЯ иконки (tint 0,
        //alpha 0.65), маскированная сектором-«пирогом». Паттерн — как у полос ХП
        //(спрайт под Graphics-маской — единственная работающая маска бэкенда:
        //Graphics-под-маской не клипует — V110, спрайт-маска гасит маскируемое — V122).
        //Сектор сам становится маской и потому нигде не виден: тёмный силуэт арта
        //«наедется» ровно по форме иконки и по углу пирога кулдауна
        let sector = nativeSector(svgArr[2], xIcon + 48, yIcon + 48, 46, 96, {"id": pi + "_" + i})
        const dark = image(svgArr[2],xIcon,yIcon,96,96,sk.img,{})
        dark.node.tint = 0
        dark.node.alpha = 0.65
        sector.setMasked(dark)
        activeSkillsTemp.push(dark)
        sectorCache[pi][i] = sector
        //V45: стартовое состояние сектора — по фактическому кулдауну/длительности. Раньше
        //сектор всегда рисовался ПОЛНЫМ тёмным кругом: способность, уже готовая (cooldown 0)
        //в момент пересборки иконок (смена этажа, изучение новой активной способности),
        //оставалась с тёмной иконкой навсегда — при cooldown===0 activeSkillsCD сектор
        //не перерисовывает, само по себе тёмное пятно не снималось.
        let skillEntry = P.info.activeSkills[i]
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
}
function activeSkillsDel() {
    let length = activeSkillsTemp.length
    for (let i = 0; i < length; i++) {
        activeSkillsTemp[i].remove()
    }
    activeSkillsTemp = []
    sectorCache.length = 0
}
//V114: withUI — тикать ли UI-сектора кулдаунов. Ряд иконок рисуется по контексту
//игрока 1 (sectorCache — его узлы), поэтому чужой контекст тикает ТОЛЬКО числа
//(кулдауны/длительности в своём info), не трогая чужие сектора
function activeSkillsCD(withUI = true) {
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
        let sector = null
        if (withUI) {
            //V122: сектора пер-игроковые — индекс контекстного игрока (status.hero.idx)
            const pi = status.hero.idx || 0
            sectorCache[pi] = sectorCache[pi] || []
            sector = sectorCache[pi][i]
            if (!sector) {
                sector = document.getElementById(pi + "_" + i)
                sectorCache[pi][i] = sector
            }
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
            //V113: мирный Огнементаль не цепляется (flameNpc — квест «Погоня за пламенем»)
            if(objectValues[i].type === "enemy" && objectValues[i].flameNpc !== 1 && checkCollision(status.hero.x-64,objectValues[i].rect.x.animVal.value,160,objectValues[i].rect.width.animVal.value,status.hero.y-64,objectValues[i].rect.y.animVal.value,179,objectValues[i].rect.height.animVal.value)) {
                objectValues[i].grap = 1
                status.info.graped = objectValues[i]
                skill.cooldown = skill.skill.cooldown
            }
        }
    }
    //V113: мирный Огнементаль не становится целью способностей (два дальних
    //радиуса 352×371 у шара и земли — текст одинаковый, поэтому с заголовком)
    if(skill.skill.title === "skill.1.0.title") {
        let length = objectValues.length
        for(let i = 0; i < length; i++) {
            if(objectValues[i].type === "enemy" && objectValues[i].flameNpc !== 1 && checkCollision(status.hero.x-160,objectValues[i].rect.x.animVal.value,352,objectValues[i].rect.width.animVal.value,status.hero.y-160,objectValues[i].rect.y.animVal.value,371,objectValues[i].rect.height.animVal.value)) {
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
            if(objectValues[i].type === "enemy" && objectValues[i].flameNpc !== 1 && checkCollision(status.hero.x-32,objectValues[i].rect.x.animVal.value,96,objectValues[i].rect.width.animVal.value,status.hero.y-32,objectValues[i].rect.y.animVal.value,115,objectValues[i].rect.height.animVal.value)) {
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
            if(objectValues[i].type === "enemy" && objectValues[i].flameNpc !== 1 && checkCollision(status.hero.x-160,objectValues[i].rect.x.animVal.value,352,objectValues[i].rect.width.animVal.value,status.hero.y-160,objectValues[i].rect.y.animVal.value,371,objectValues[i].rect.height.animVal.value)) {
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
        //E-11 (ТЗ юзера): телепорт по взгляду вместо случайной комнаты. E-22 (репорт):
        //дальность 2..6 клеток по направлению взгляда героя (0 вверх, 1 вниз, 2 влево,
        //3 вправо); цель — ПЕРВАЯ свободная клетка ДРУГОЙ локации. Локация — комната
        //(номер в roomsArr) или коридор (сегмент floor [2]===1): «в/из коридора» теперь
        //работает как «в/из комнаты». Комната — открытая (либо закрытая — только «со
        //щитом», skill.1.13/флаг magicShield); коридор — только ОТКРЫТАЯ клетка ([7]===1:
        //отрисована, двери сегмента открыты — посадка в закрытую дверь/темноту исключена).
        //«Свободна»: пол по матрице этажа, без твёрдых объектов (правила
        //collisionCheckObject: ловушка 14 и рычаг 19 проходимы) и живых врагов.
        //Кандидатов нет — телепорт НЕ применяется: кулдаун не тратится, ранний return
        //из useSkill (без «Вечного цитрина»), следующая попытка — с следующим
        //проигрышем анимации wait (триггер checkEndAnim)
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
        //сегмент коридора клетки → индекс записи floor ([2]===1), иначе −1
        const corridorAt = (cx, cy) => {
            for (let i = 0; i < lv.floor.length; i++) {
                const f = lv.floor[i]
                if (f[2] === 1 && f[0] === cx && f[1] === cy) return i
            }
            return -1
        }
        //идентификатор локации клетки: комната или сегмент коридора
        const locOf = (cx, cy) => {
            const rk = roomAt(cx, cy)
            return rk >= 0 ? "r" + rk : "c" + corridorAt(cx, cy)
        }
        const heroLoc = locOf(hx, hy)
        let target = null
        for (let step = 2; step <= 6 && !target; step++) {
            const cx = hx + dv[0] * step, cy = hy + dv[1] * step
            if (!m[cy] || m[cy][cx] !== 1) continue
            const rk = roomAt(cx, cy)
            if (locOf(cx, cy) === heroLoc) continue
            if (rk >= 0) {
                if (lv.roomsArr[rk][3] !== 1 && status.info.magicShield !== 1) continue
            } else {
                const ci = corridorAt(cx, cy)
                if (ci < 0 || lv.floor[ci][7] !== 1) continue
            }
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
        //E-21 (репорт «застрял в нижней стене другой комнаты»): посадка «хитбокс строго
        //внутрь клетки» — та же формула, что teleportHero в portalFx.js. Прежняя
        //x=c*32+16,y=c*32+16 клала хитбокс героя (x+13..x+27, y+37..y+51) на клетки
        //СПРАВА и СНИЗУ цели: телепорт по взгляду вверх сажал хитбокс в нижнюю стену
        //комнаты-цели (сам герой при этом стоял на проверенной свободной клетке)
        status.hero.x = target[0] * 32 - 4
        status.hero.y = target[1] * 32 - 28
        spritePos(status.hero.obj.img, status.hero.x, status.hero.y)
        //V123 (решение юзера): телепорт Волшебницы переносит ОБОИХ — партнёр рядом
        teleportPartners(dataGeneric.scenes[status.levelFloor], target[0], target[1])
        //E-22 (репорт «камера медленно доезжает»): прежний снап вычитал 960/540 —
        //половину 1920×1080; при зуме по умолчанию 2 окно камеры всего 960×540, герой
        //оставался в правом нижнем квадранте, и экран довозила медленная прокрутка
        //scroll() в heroMove. Центрируем по фактическим половинам окна (как
        //teleportHero в portalFx.js) — герой в центре экрана в тот же тик
        setWorldViewBox(status.hero.x - worldViewW() / 2, status.hero.y - worldViewH() / 2)
        //E-22: посадка в коридор/край комнаты — комнаты и коридор вокруг точки высадки
        //открываются (рисуются) сразу, не дожидаясь ближайшей смены клетки в heroMove
        checkNewRoom(dataGeneric, status.levelFloor, status.hero.x, status.hero.y)
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
            changeHP(ctxBar("hp"),ctxTx("hp"),"hp")
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
            //V113: мирный Огнементаль — не цель сплэша (и рядом с центром не пострадает:
            //фильтр есть и в createSplash)
            if (objectValues[i].type === "enemy" && objectValues[i].flameNpc !== 1) {
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