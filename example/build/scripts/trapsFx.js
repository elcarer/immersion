//V63: ловушки трёх типов — вся логика собрана здесь (раньше checkTraps жил в checkBuffs.js).
//КИСЛОТНАЯ (спрайт 4) урон напрямую НЕ наносит: при наступании ГЕРОЯ выпускает облако
//кислоты (effects/cloudAcid.png — лист 384×96, 4 кадра 96×96 над зоной 3×3 с offset −32,−32
//от клетки ловушки, ~1с — одноразовый data.effects-эффект, кадры крутит animPlay) — и уже
//ОБЛАКО бьёт 1-3 урона раз в 0.3с по ВСЕМ в зоне (герой + обычные враги). Пока облако живо,
//ловушка новое не выпускает: obj[14] — таймер жизни облака, obj[15] — тик его урона,
//obj[16] — флаг «журнал уже написан» (одна строка на облако, не на каждый тик).
//ШИПАСТАЯ (3): урон поднят на 4 (было 2-7 → стало 6-11), но активна половину времени —
//фазы по 2с: obj[13]=0 «выключена» (3e.png, урона нет) ↔ obj[13]=1 активна (3.png);
//стояние на активной — тики как раньше (первый сразу, далее 0.8с).
//ОГНЕНАЯ (1, только 3 этаж): те же фазы 2с; в обычной (1e.png) 1-8 урона раз в 0.5с, в
//горящей (1.png) 4-10 раз в 0.5с, а ПЕРЕХОД в горящую обжигает всех в радиусе 2 клеток
//(64px от центра ловушки): враги — существующий маркер e.burnT (buffFx.applyEnemyBurn),
//герой — существующее горение applyFlame (flameFx, урон за собственный удар).
//obj[12] — таймер фазы (полные 2с с генерации, старт с «выключенного» состояния).
//Действуют на героя и обычных врагов (не боссов); баф «Великий вор» (6 предметов) удваивает
//урон по врагам; Крылья валькирии / неуязвимость рывка — иммунитет (облако не выпускают).
import { status } from "../scripts/start.js"
//V115: полосы ХП/опыта — суффиксы по игроку (players.js)
import { ctxBar,ctxTx } from "../scripts/players.js"
import { T } from "../scripts/localization.js"
import { data } from "../scripts/data.js"
import { rectPos, picById } from "../scripts/svg.js"
import { objectValues } from "../scripts/del.js"
import { dataGeneric } from "../scripts/sceneGenerate.js"
import { floatText } from "../scripts/floatText.js"
import { changeHP, checkFood } from "../scripts/takeDamage.js"
import { endGame } from "../scripts/endGame.js"
import { checkCollision, playEffect, reanimateCheck } from "../scripts/damage.js"
import { enemyDie } from "../scripts/enemyAI.js"
import { journalAdd, J_RED } from "../scripts/journal.js"
import { setCount, set1TrapDamageMult } from "../scripts/sets.js"
import { wingsActive, dashInvulnActive } from "../scripts/valkyrie.js"
import { applyFlame } from "../scripts/flameFx.js"
import { applyEnemyBurn } from "../scripts/buffFx.js"
import { trapSpriteSrc } from "../scripts/trapSprite.js"
import { playback, strike } from "../scripts/sound.js"

const STATE_TICKS = 125  //фаза состояния шипов/огня: 2с (~62.5 тика/с)
const CLOUD_TICKS = 64   //жизнь облака кислоты ~1с (анимация 4 кадра × 16 тиков, speed 3.75)
const SPIKE_TICK = 48    //тик стояния на активных шипах: 0.8с
const FIRE_TICK = 30     //тик стояния на огненной: 0.5с
const ACID_TICK = 18     //тик урона облака кислоты: 0.3с
const BURN_RADIUS = 64   //радиус ожога огненной ловушки: 2 клетки
//запись эффекта облака ищем по спрайту — индекс в data.effects не должен ничего ломать
const ACID_CLOUD = data.effects.find(f => f.img === "./images/effects/cloudAcid.png")

//V16: переиспользуемый Map «клетка -> взведённая ловушка» вместо перебора с checkCollision
let trapsMap = new Map()

function trapTick() {
    let level = dataGeneric.scenes[status.levelFloor]
    if(!level) return
    let traps = trapsMap
    traps.clear()
    let lengthObjects = level.objects.length
    for (let i = 0; i < lengthObjects; i++) {
        let obj = level.objects[i]
        if(obj[2] !== 14 || obj[7] === 1) continue
        //фазы шипов/огня тикают всегда, герой рядом или нет (обезвреженные исключены выше)
        let s = obj[10]
        ;(s === 3 || s === 1) && tickState(obj)
        traps.set(obj[0]+","+obj[1], obj)
    }
    trapHeroTick(traps)
    trapEnemyTick(traps)
    tickClouds(level)
}

//смена фазы шипов/огня: спрайт на карте (если ловушка отрисована) + ожог при вспышке огня
function tickState(obj) {
    obj[12] = (obj[12] || STATE_TICKS) - 1
    if(obj[12] > 0) return
    obj[12] = STATE_TICKS
    obj[13] = obj[13] === 1 ? 0 : 1
    let img = picById(obj[6]+"OI")
    img && img.setAttribute("href", trapSpriteSrc(obj))
    obj[10] === 1 && obj[13] === 1 && fireBurst(obj)
}

//переход огненной ловушки в горящее состояние: ожог всем в радиусе 2 клеток (64px)
//от центра ловушки — герою applyFlame (горение, урон за удар), врагам маркер burnT
function fireBurst(obj) {
    const cx = obj[0]*32 + 16, cy = obj[1]*32 + 16
    if(status.hero.obj && status.hero.obj.type === "hero") {
        let r = status.hero.obj.rect
        let p = rectPos(r)
        inRadius(p[0] + r._w/2, p[1] + r._h/2, cx, cy) && applyFlame(2)
    }
    let lengthEnemy = objectValues.length
    for (let i = 0; i < lengthEnemy; i++) {
        let e = objectValues[i]
        //V113: Огнементаль (flameQuestMob) огню и шипам не поддаётся — ожог не вешается
        if(e.type !== "enemy" || e.stats.hp <= 0 || e.flameQuestMob === 1) continue
        let p = rectPos(e.rect)
        inRadius(p[0] + e.rect._w/2, p[1] + e.rect._h/2, cx, cy) && applyEnemyBurn(e)
    }
}
function inRadius(x, y, cx, cy) {
    return (x-cx)*(x-cx) + (y-cy)*(y-cy) <= BURN_RADIUS * BURN_RADIUS
}

//герой: наступание на кислотную ловушку выпускает облако; стояние на активных шипах и на
//огненной (в ЛЮБОЙ фазе) — урон тиками, как раньше
function trapHeroTick(traps) {
    if(status.hero.obj.type !== "hero") return
    let rect = status.hero.obj.rect
    let heroPos = rectPos(rect)
    let hx = heroPos[0]
    let hy = heroPos[1]
    //хитбокс «ног» героя тот же, что в collision.js: x+13, y+37, 14x14
    let obj = trapUnder(hx+13,hy+37,14,14,traps)
    if(obj && (wingsActive() || dashInvulnActive())) {
        //Крылья валькирии / неуязвимость после рывка: иммунитет к ловушкам
        status.info.trapTime = 0
        return
    }
    if(obj && obj[10] === 4) {
        //кислотная сама не бьёт: без активного облака — выпуск нового (одно на ловушку)
        !obj[14] && releaseCloud(obj)
        status.info.trapTime = 0
        return
    }
    if(!obj || (obj[10] === 3 && obj[13] !== 1)) {
        //нет ловушки или шипы в фазе «выключена»
        status.info.trapTime = 0
        return
    }
    let tickFrames = obj[10] === 3 ? SPIKE_TICK : FIRE_TICK
    //V37 журнал: строка на СРАБАТЫВАНИЕ ловушки (первый тик наступания), не на каждый тик
    let firstStep = !(status.info.trapTime)
    //обратный отсчёт тика: при наступании ловушка срабатывает сразу, следующий тик — через tickFrames кадров
    let t = (status.info.trapTime||0) - 1
    if(t <= 0) {
        status.info.trapTime = tickFrames
        //V63: шипы 6-11 (+4 к старым 2-7); огонь: горящая 4-10, обычная 1-8
        let damage = obj[10] === 3 ? Math.trunc(Math.random() * 6) + 6
            : obj[13] === 1 ? Math.trunc(Math.random() * 7) + 4
            : Math.trunc(Math.random() * 8) + 1
        status.info.hp -= damage
        status.info.hp <= 0 && (status.info.hp = 0)
        firstStep && journalAdd(T("journ.trap",damage), J_RED)
        floatText(hx + Math.trunc(Math.random() * 32),hy + 8,damage,"#CD5C5C","12px","none")
        playEffect(status.hero.obj,data.effects[1])
        playback(strike[7].vol,0,0,3*status.settings.soundVolume)
        changeHP(ctxBar("hp"),ctxTx("hp"),"hp")
        checkFood()
        status.info.hp <= 0 && endGame()
    } else {
        status.info.trapTime = t
    }
}

//обычные враги (не боссы): те же правила, что у героя — шипы только в активной фазе,
//огонь в обеих, кислотную активируют наступанием (выпуск облака), урон — только облаком
function trapEnemyTick(traps) {
    let lengthEnemy = objectValues.length
    for (let i = 0; i < lengthEnemy; i++) {
        let enemy = objectValues[i]
        //V113: Огнементаль (flameQuestMob) ловушек не касается — шипы/огонь/кислота мимо
        if(enemy.type !== "enemy" || enemy.class.boss === 1 || enemy.flameQuestMob === 1) continue
        if(enemy.stats.hp <= 0) continue
        let rectE = enemy.rect
        let ePos = rectPos(rectE)
        let ex = ePos[0]
        let ey = ePos[1]
        let obj = trapUnder(ex+13,ey+37,14,14,traps)
        if(!obj || (obj[10] === 3 && obj[13] !== 1)) {
            enemy.trapTime = 0
            continue
        }
        if(obj[10] === 4) {
            //репорт: враг активирует ядовитую (кислотную) ловушку так же, как герой —
            //выпускает облако (одно на ловушку); урон приносит само облако (cloudDamage
            //бьёт всех в зоне 3×3, включая этого врага). Прежде кислота скипалась
            //целиком — для врагов ловушка не работала никогда
            !obj[14] && releaseCloud(obj)
            enemy.trapTime = 0
            continue
        }
        let tickFrames = obj[10] === 3 ? SPIKE_TICK : FIRE_TICK
        //обратный отсчёт тика: при наступании срабатывает сразу, следующий тик — через tickFrames кадров
        let t = (enemy.trapTime||0) - 1
        if(t <= 0) {
            enemy.trapTime = tickFrames
            let damage = obj[10] === 3 ? Math.trunc(Math.random() * 6) + 6
                : obj[13] === 1 ? Math.trunc(Math.random() * 7) + 4
                : Math.trunc(Math.random() * 8) + 1
            //V53: сет «Великий вор» (6 надетых): ловушки наносят врагам удвоенный урон
            //V67: «Вечный берилл» удваивает численный бонус — ×4
            setCount(1) >= 6 && (damage *= set1TrapDamageMult())
            enemy.stats.hp -= damage
            floatText(ex + rectE._w/2, ey, damage, "#CD5C5C", "12px", "none")
            enemy.class.effects.takeDamage && playEffect(enemy,data.effects[enemy.class.effects.takeDamage])
            if(enemy.stats.hp <= 0 && !reanimateCheck(enemy)) {
                //смерть от ловушки — как от яда
                enemyDie(enemy)
            }
        } else {
            enemy.trapTime = t
        }
    }
}

//выпуск облака кислоты: таймеры на самом объекте ловушки (никаких списков — таймер
//умирает вместе с уровнем), визуал — одноразовый эффект, кадры/снятие берёт на себя animPlay
function releaseCloud(obj) {
    obj[14] = CLOUD_TICKS
    obj[15] = 0  //первый тик урона облака — сразу при выпуске
    obj[16] = 0  //журнальная строка — одна на облако
    //центр листа 384×96 над клеткой: спрайт 96×96 с offset −32,−32 от клетки ловушки
    //(координаты эффекта считаются от ЦЕНТРА rect: effect.x=0/effect.y=0 дают нужный сдвиг)
    let img = picById(obj[6]+"OI")
    img && playEffect({"rect": img}, ACID_CLOUD)
}

//тики живых облаков: обратный отсчёт + урон 1-3 раз в 0.3с всем в зоне 3×3
function tickClouds(level) {
    let lengthObjects = level.objects.length
    for (let i = 0; i < lengthObjects; i++) {
        let obj = level.objects[i]
        if(obj[2] !== 14 || !(obj[14] > 0)) continue
        obj[14]--
        let t = (obj[15]||0) - 1
        if(t <= 0) {
            obj[15] = ACID_TICK
            cloudDamage(obj)
        } else {
            obj[15] = t
        }
    }
}

//облако бьёт всех в зоне 3×3 (клетка ловушки ±1): герой и обычные враги, параметры урона
//старой кислоты (1-3). Журнал — одна строка на облако.
function cloudDamage(obj) {
    const ax = (obj[0]-1)*32, ay = (obj[1]-1)*32
    if(status.hero.obj && status.hero.obj.type === "hero" && !(wingsActive() || dashInvulnActive())) {
        let rect = status.hero.obj.rect
        let p = rectPos(rect)
        if(checkCollision(p[0]+13, ax, 14, 96, p[1]+37, ay, 14, 96)) {
            let damage = Math.trunc(Math.random() * 3) + 1
            status.info.hp -= damage
            status.info.hp <= 0 && (status.info.hp = 0)
            !obj[16] && (obj[16] = 1, journalAdd(T("journ.trap",damage), J_RED))
            floatText(p[0] + Math.trunc(Math.random() * 32),p[1] + 8,damage,"#CD5C5C","12px","none")
            playEffect(status.hero.obj,data.effects[1])
            playback(strike[7].vol,0,0,3*status.settings.soundVolume)
            changeHP(ctxBar("hp"),ctxTx("hp"),"hp")
            checkFood()
            status.info.hp <= 0 && endGame()
        }
    }
    let lengthEnemy = objectValues.length
    for (let i = 0; i < lengthEnemy; i++) {
        let enemy = objectValues[i]
        //V113: Огнементаль и облако кислоты не задевает
        if(enemy.type !== "enemy" || enemy.class.boss === 1 || enemy.flameQuestMob === 1 || enemy.stats.hp <= 0) continue
        let rectE = enemy.rect
        let ePos = rectPos(rectE)
        if(!checkCollision(ePos[0]+13, ax, 14, 96, ePos[1]+37, ay, 14, 96)) continue
        let damage = Math.trunc(Math.random() * 3) + 1
        //V53: сет «Великий вор» (6 надетых): ловушки наносят врагам удвоенный урон
        //V67: «Вечный берилл» удваивает численный бонус — ×4
        setCount(1) >= 6 && (damage *= set1TrapDamageMult())
        enemy.stats.hp -= damage
        floatText(ePos[0] + rectE._w/2, ePos[1], damage, "#CD5C5C", "12px", "none")
        enemy.class.effects.takeDamage && playEffect(enemy,data.effects[enemy.class.effects.takeDamage])
        if(enemy.stats.hp <= 0 && !reanimateCheck(enemy)) {
            enemyDie(enemy)
        }
    }
}

//V7: клетки (до 2x2), покрываемые хитбоксом x,y,w,h — точный аналог checkCollision с ловушкой 1x1
function trapUnder(x,y,w,h,traps) {
    let x1 = Math.trunc(x/32)
    let x2 = Math.trunc((x+w-1)/32)
    let y1 = Math.trunc(y/32)
    let y2 = Math.trunc((y+h-1)/32)
    for (let cx = x1; cx <= x2; cx++) {
        for (let cy = y1; cy <= y2; cy++) {
            let obj = traps.get(cx+","+cy)
            if(obj) return obj
        }
    }
    return undefined
}

export {trapTick}
