// ============================================================================
// howlFx.js — V38 способность «вой» Хаунда (stats.howl).
//
// В data.js у Хаунда (id 17) поле stats.howl = 6 — ОДИН параметр задаёт всё:
// радиус зоны (howl клеток, клетка = 32px), длительность (howl секунд) и
// бонус к урону врагов внутри зоны (+howl).
//
// При смерти хаунда (enemyDie → howlDie) в точке его центра создаётся зона:
// все ВРАГИ, чей центр попадает в круг (евклид), наносят +howl урона. Бонус
// НЕ складывается от перекрывающихся зон — берётся одна, максимальная.
// Бонус вычисляется в момент броска урона (howlBonus из countDamage/dashFx):
// враг вышел из зоны или зона истекла — бонуса нет, состояний на враге не
// заводится.
//
// Визуал: процедурные красные SVG-кружки (случайные позиция в диске, размер,
// цвет, фаза и темп мигания), слой svgArr[0] — поверх пола, ПОД стенами и
// спрайтами. Мигают каждый тик (синусоида по фазе частицы), исчезают вместе
// с зоной.
//
// Тик — из enemyMove (рядом с charmTick): зона живёт в мировом времени, в
// паузе замирает; жёсткая чистка — из del() при смене этажа/забега.
// Модуль нарочно НЕ импортирует enemyAI.js/enemyMove.js (те импортируют нас):
// никаких циклов — всё нужное передаётся параметрами из точек проводки.
// ============================================================================
import { status } from "../scripts/start.js"
import { T } from "../scripts/localization.js"
import { svgArr, circle, rectPos } from "../scripts/svg.js"
import { playback, strike } from "../scripts/sound.js"
import { journalAdd, J_RED } from "../scripts/journal.js"

const CELL = 32                     // клетка пола, px
const secFrames = s => Math.max(1, Math.trunc(s * 1000 / 16))
const PART_MIN_R = 1.5              // размер частицы, px
const PART_MAX_R = 3.5
const PART_COUNT = 28               // частиц на зону
const PART_COLORS = ["#FF2222", "#CD5C5C", "#FF4444"]
const BLINK_MIN_TICKS = 12          // период мигания частицы, тиков
const BLINK_MAX_TICKS = 30
// звук воя — rocket.mp3 (падение метеора) из существующих ассетов, как у
// очарования (menu.mp3) — заглушается общим status.settings.soundVolume
const HOWL_VOL = 3

// живые зоны воя: {x, y, r, value, ttl, age, parts:[{el, phase, period}]}
const zones = []

// смерть врага со stats.howl: зона в точке его центра (вызов из enemyDie)
export function howlDie(enemy) {
    const howl = enemy.stats && enemy.stats.howl
    if (!howl || !enemy.rect) return
    const p = rectPos(enemy.rect)
    const cx = p[0] + 16
    const cy = p[1] + 25
    //V46b: «Выносливость» героя сокращает время жизни зоны воя — частицы на полу
    //исчезают вместе с зоной; враги внутри теряют бонус раньше
    let ttl = secFrames(howl)
    ttl = Math.max(1, ttl - Math.trunc(ttl * parseInt(status.info.stats[2].dops[2].value2.slice(0,-1))/100))
    const zone = { x: cx, y: cy, r: howl * CELL, value: howl, ttl, age: 0, parts: [] }
    for (let i = 0; i < PART_COUNT; i++) {
        const ang = Math.random() * Math.PI * 2
        const rad = zone.r * Math.sqrt(Math.random())   // равномерно по диску
        const el = circle(svgArr[0], cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad,
            PART_MIN_R + Math.random() * (PART_MAX_R - PART_MIN_R),
            "none", 0, PART_COLORS[Math.trunc(Math.random() * PART_COLORS.length)])
        zone.parts.push({
            el,
            phase: Math.random() * Math.PI * 2,
            period: BLINK_MIN_TICKS + Math.random() * (BLINK_MAX_TICKS - BLINK_MIN_TICKS),
        })
    }
    zones.push(zone)
    //V37 журнал: красная строка — враги рядом стали опаснее
    journalAdd(T("journ.howl",T(enemy.class.name)), J_RED)
    playback(strike[12].vol, 0, 0, HOWL_VOL * status.settings.soundVolume)
}

// бонус воя для врага: зоны НЕ складываются — максимальная из накрывающих его
// центр; вызывается в момент броска урона (damageHero countDamage / dashFx)
export function howlBonus(enemy) {
    if (!zones.length || !enemy || !enemy.rect) return 0
    const p = rectPos(enemy.rect)
    const cx = p[0] + 16
    const cy = p[1] + 25
    let bonus = 0
    for (let i = 0; i < zones.length; i++) {
        const z = zones[i]
        const dx = cx - z.x
        const dy = cy - z.y
        if (dx * dx + dy * dy <= z.r * z.r && z.value > bonus) bonus = z.value
    }
    return bonus
}

// тик всех зон (из enemyMove): мигание частиц + обратный отсчёт жизни зоны
export function howlTick() {
    for (let i = zones.length - 1; i >= 0; i--) {
        const z = zones[i]
        z.age++
        for (let k = 0; k < z.parts.length; k++) {
            const pt = z.parts[k]
            // плавное мигание 0.1..1 по синусоиде — своя фаза и темп у каждой частицы
            const w = 0.5 + 0.5 * Math.sin(Math.PI * 2 * z.age / pt.period + pt.phase)
            pt.el.setAttribute("opacity", (0.1 + 0.9 * w).toFixed(3))
        }
        if (--z.ttl <= 0) {
            for (let k = 0; k < z.parts.length; k++) z.parts[k].el.remove()
            zones.splice(i, 1)
        }
    }
}

// снимок для тестов: число зон, их параметры и число частиц
export function howlProbe() {
    return {
        count: zones.length,
        list: zones.map(z => ({ x: z.x, y: z.y, r: z.r, value: z.value, ttl: z.ttl, parts: z.parts.length })),
    }
}

// жёсткая чистка при del() (смена этажа/новый забег): узлы слоя и так сотрутся,
// сбрасываем список зон, чтобы ничего не «оживало» ссылками
export function resetHowlZones() {
    for (let i = 0; i < zones.length; i++) {
        for (let k = 0; k < zones[i].parts.length; k++) zones[i].parts[k].el.remove()
    }
    zones.length = 0
}
