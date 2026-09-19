//V49: «Статуя неизвестному герою» (тип 16) — временные бафы героя и ожог от огненного оружия.
//V50: четвёртый баф «находчивость» (имя пользователя) — кулдауны активных способностей
//тают на 10% быстрее, пока висит (интеграция в activeSkillsCD, рядом с одноимённым статом).
//Бафы СКЛАДЫВАЮТСЯ (решение пользователя): у каждого свой таймер на status.info
//(buffSpeedT / buffFireT / buffShieldT / buffCdT), повторный выпад того же бафа обновляет таймер
//до полных 60 секунд. Таймеры тикают в gameLoop ПОСЛЕ блока паузы (на паузе замирают),
//переживают смену этажа и умирают вместе с status.info в новом забеге.
//Иконки бафов (effects/buff1-4.png) висят в ряд над героем — приём flameFx.js (V26):
//удержание спрайта над головой с пересозданием мёртвых DOM-узлов после смены сцены.
//Огненное оружие: каждая атака героя по врагу (attack.js, момент подтверждённой атаки —
//работает и при нуле урона после брони) вешает/освежает ожог e.burnT на 3 секунды (V69);
//атака по УЖЕ горящему врагу («Аура возмездия»-аналог) наносит 2 плоского урона напрямую
//в ХП (без брони — как пламя импа), с полоской HP, журналом, призывом Демона и enemyDie.
//Над горящим врагом висит спрайт effects/flame.png (решение пользователя).
import { status } from "../scripts/start.js"
import { T } from "../scripts/localization.js"
import { svgArr, image, releaseSprite, spritePos, rectPos } from "../scripts/svg.js"
import { floatText } from "../scripts/floatText.js"
import { changeBossHP } from "../scripts/hpBar.js"
import { showEnemyHpBar } from "../scripts/enemyHpBarFx.js"
import { reanimateCheck } from "../scripts/damage.js"
//enemyDie живёт в enemyAI.js (export function), не в damage.js — как его импортируют damage.js/checkBuffs.js
import { enemyDie } from "../scripts/enemyAI.js"
import { tryBossSummon } from "../scripts/finPillars.js"
import { objectValues } from "../scripts/del.js"
import { journalAdd, J_GREEN } from "../scripts/journal.js"

//1 секунда ≈ 62.5 тика при фикс. шаге 16мс: 60 секунд бафа = 3750 тиков
const BUFF_TICKS = 3750
//ожог огненного оружия: V69 — 3 секунды (186 тиков; было 124 = 2с, удваивало FLAME_TICKS
//пламени импа; по решению пользователя ожог на враге тоже подрос на 1 секунду,
//пока геройский подрос с 1с до 2с)
const BURN_TICKS = 186
const BURN_DMG = 2
const BURN_SRC = "./images/effects/flame.png"
const BUFF_SIZE = 32
const BUFF_SRCS = [null, "./images/effects/buff1.png", "./images/effects/buff2.png", "./images/effects/buff3.png", "./images/effects/buff4.png"]

let buffImgs = [null, null, null, null] //иконки над героем: скорость / огонь / щит / кулдауны
let burnList = [] //{"e": враг, "img": спрайт пламени} — чистится при смерти/смене этажа

function buffT(n) {
    return n === 1 ? status.info.buffSpeedT : n === 2 ? status.info.buffFireT : n === 3 ? status.info.buffShieldT : status.info.buffCdT
}
function buffActive(n) {
    return !!(status.info && buffT(n) > 0)
}
//баф магического щита: +2 брони — прибавляется к базовой броне в takeDamage
function buffArmorBonus() {
    return buffActive(3) ? 2 : 0
}

//активация статуи (useObject case 16): случайный 1 из 4 бафов; бафы складываются,
//повторный выпад того же обновляет его таймер до полных 60 секунд.
//V98: имя выпавшего бафа всплывает над героем и пишется в журнал — повтор того же
//(обновление таймера, решение V50) теперь виден игроку, а не только по звуку статуи
function giveBuff() {
    const roll = Math.trunc(Math.random() * 4) + 1
    if (roll === 1) status.info.buffSpeedT = BUFF_TICKS
    else if (roll === 2) status.info.buffFireT = BUFF_TICKS
    else if (roll === 3) status.info.buffShieldT = BUFF_TICKS
    else status.info.buffCdT = BUFF_TICKS
    const name = T("buff." + roll + ".name")
    floatText(status.hero.x - 16 + Math.trunc(Math.random() * 32), status.hero.y + 8, T("float.buffGet", name), "#FFD68C", "18px", "none")
    journalAdd(T("journ.buffGet", name), J_GREEN)
}

//атака героя по врагу (attack.js): повесить/освежить ожог, по горящему — ещё 2 плоских
function fireOnAttack(target) {
    if (!buffActive(2)) return
    if (!target || target.type !== "enemy" || !target.stats || target.stats.hp <= 0) return
    //V79: неуязвимость (Циклоп, invulnActive) — плоский ожог по горящему не проходит,
    //маркер горения освежается как обычно (догорит после окна)
    if (target.burnT > 0 && !target.invulnActive) {
        const before = target.stats.hp
        target.stats.hp -= BURN_DMG
        showEnemyHpBar(target, before)
        target.class.boss === 1 && changeBossHP(document.getElementById("hpBossBarI"), document.getElementById("hpBossText"))
        if (target.class.id === 11) {
            !status.spiderBossFight && (status.spiderBossFight = 0)
            status.spiderBossFight += BURN_DMG
        }
        target.class.stats && target.class.stats.summoning && tryBossSummon(target)
        const ePos = rectPos(target.rect)
        floatText(Math.trunc(Math.random() * 32) + ePos[0], ePos[1] + 8, BURN_DMG, "#FF8800", "12px", "none")
        journalAdd(T("journ.burn",T(target.class.name),BURN_DMG), J_GREEN)
        target.stats.hp <= 0 && !reanimateCheck(target) && enemyDie(target)
    }
    target.burnT = BURN_TICKS
}

//V63: ожог от огненной ловушки (trapsFx.fireBurst) — тот же маркер, что вешает огненное
//оружие: 3с (BURN_TICKS, V69), пламя над головой подхватит tickEnemyBurns, а удар героя по
//горящему нанесёт +2 плоского урона через fireOnAttack. Мгновенного урона здесь НЕТ —
//это именно маркер, урон наносят последующие удары героя.
function applyEnemyBurn(target) {
    if (!target || target.type !== "enemy" || !target.stats || target.stats.hp <= 0) return
    target.burnT = BURN_TICKS
}

//тик (gameLoop, после flameTick): отсчёт таймеров бафов + ряд иконок над героем,
//отсчёт ожогов врагов + пламя над горящими
function buffTick() {
    const info = status.info
    if (!info || !status.hero.obj || status.hero.obj.type !== "hero") {
        hideBuffs()
        return
    }
    info.buffSpeedT > 0 && info.buffSpeedT--
    info.buffFireT > 0 && info.buffFireT--
    info.buffShieldT > 0 && info.buffShieldT--
    info.buffCdT > 0 && info.buffCdT--
    const active = [info.buffSpeedT > 0, info.buffFireT > 0, info.buffShieldT > 0, info.buffCdT > 0]
    const count = (active[0] ? 1 : 0) + (active[1] ? 1 : 0) + (active[2] ? 1 : 0) + (active[3] ? 1 : 0)
    const r = status.hero.obj.rect
    const pos = rectPos(r)
    //сцена пересоздавалась (новый этаж) — мёртвые DOM-узлы пересоздаются (приём flameFx)
    let idx = 0
    for (let i = 0; i < 4; i++) {
        if (!active[i]) {
            if (buffImgs[i] && buffImgs[i].isConnected) releaseSprite(buffImgs[i])
            buffImgs[i] = null
            continue
        }
        if (buffImgs[i] && !buffImgs[i].isConnected) buffImgs[i] = null
        if (!buffImgs[i]) buffImgs[i] = image(svgArr[1], 0, 0, BUFF_SIZE, BUFF_SIZE, BUFF_SRCS[i + 1], {})
        //ряд иконок центрирован над героем (порядок: скорость, огонь, щит, кулдауны); если герой
        //горит — ряд сдвигается вправо, освобождая центральный слот для пламени
        const shift = info.burning > 0 ? BUFF_SIZE : 0
        spritePos(buffImgs[i], pos[0] + r._w / 2 - (count * BUFF_SIZE) / 2 + idx * BUFF_SIZE + shift, pos[1] - BUFF_SIZE + 6)
        if (svgArr[1].lastElementChild !== buffImgs[i]) svgArr[1].append(buffImgs[i])
        idx++
    }
    tickEnemyBurns()
}

//ожоги врагов: обратный отсчёт e.burnT + удержание пламени над головой горящего.
//Список burnList сам вычищает записи умерших/погасших врагов (releaseSprite спрайта),
//поэтому смерть от любого урона и смена этажа не оставляют висящих спрайтов
function tickEnemyBurns() {
    for (let i = burnList.length - 1; i >= 0; i--) {
        const b = burnList[i]
        //corpse ОСТАЁТСЯ в objectValues (enemyDie меняет только type) — гасим пламя и по типу
        if (objectValues.indexOf(b.e) === -1 || b.e.type !== "enemy" || !(b.e.burnT > 0)) {
            b.img && b.img.isConnected && releaseSprite(b.img)
            burnList.splice(i, 1)
        }
    }
    for (let i = 0; i < objectValues.length; i++) {
        const e = objectValues[i]
        if (e.type !== "enemy" || !(e.burnT > 0)) continue
        e.burnT--
        let b = burnList.find(f => f.e === e)
        if (!b || !b.img.isConnected) {
            b && b.img.isConnected === false && releaseSprite(b.img)
            b = {"e": e, "img": image(svgArr[1], 0, 0, BUFF_SIZE, BUFF_SIZE, BURN_SRC, {})}
            burnList.push(b)
        }
        const r = e.rect
        const pos = rectPos(r)
        spritePos(b.img, pos[0] + r._w / 2 - BUFF_SIZE / 2, pos[1] - BUFF_SIZE + 6)
        if (svgArr[1].lastElementChild !== b.img) svgArr[1].append(b.img)
    }
}

function hideBuffs() {
    for (let i = 0; i < 4; i++) {
        if (buffImgs[i] && buffImgs[i].isConnected) releaseSprite(buffImgs[i])
        buffImgs[i] = null
    }
    for (let i = burnList.length - 1; i >= 0; i--) {
        burnList[i].img && burnList[i].img.isConnected && releaseSprite(burnList[i].img)
    }
    burnList.length = 0
}

export { giveBuff, buffTick, fireOnAttack, buffActive, buffArmorBonus, applyEnemyBurn }
