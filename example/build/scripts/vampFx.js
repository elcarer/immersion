// ============================================================================
// vampFx.js — V51 способность «вампиризм» (stats.vampirism, Вампир id 19).
//
// stats.vampirism = N — сколько ХП враг восстанавливает, когда его атака
// РЕАЛЬНО отняла ХП герою. Уклон, неуязвимость после рывка и полный съёт
// урона щитом — крови нет, лечения нет; «Блок» (половина урона) — лечит.
// Не чаще одного раза в 3 секунды: внутренний кулдаун stats.vampCd на
// экземпляре врага (stats — глубокая копия спавна, openRoom), тикает в
// vampTick. Темп атак не меняется — по кулдауну атаки из data.attacks.
//
// Потолок лечения — фактический запас ХП этого спавна: главы умножают hp
// при спавне (openRoom: levelFloor 0 и page>1 → ×2, page>2 → ещё ×2), тот
// же знаменатель, что у ХП-бара (enemyHpBarFx); монотонный _hpBarMax (если
// бар уже засветился) тоже учитывается.
//
// Визуал: процедурный шлейф красных SVG-частиц (circle, без картинок),
// летящих от героя к врагу ~1 секунду (STREAM_TTL тиков). Точка вылета —
// центр героя (со случайным разбросом), точка прилёта — ЦЕНТР врага,
// перечитывается каждый тик: частицы «прилипают» к вампиру, пока он идёт.
// Своя скорость у каждой частицы + синусоида поперёк курса («шлейф»).
// Слой svgArr[1] — поверх пола и спрайтов (как ХП-бары/пламя).
//
// Тик — из gameLoop (рядом с buffTick): только пока игра жива, на паузе
// шлейф замирает, как и всё остальное. Жёсткая чистка — из del() при
// смене этажа/забега. Модуль НЕ импортирует damageHero/enemyAI — циклов
// нет: всё нужное передаётся параметрами из точки проводки (приём howlFx).
// ============================================================================
import { status } from "../scripts/start.js"
import { T } from "../scripts/localization.js"
import { objectValues } from "../scripts/del.js"
import { svgArr, circle, rectPos } from "../scripts/svg.js"
import { showEnemyHpBar } from "../scripts/enemyHpBarFx.js"
import { floatText } from "../scripts/floatText.js"
import { journalAdd, J_GREEN } from "../scripts/journal.js"

const secFrames = s => Math.max(1, Math.trunc(s * 1000 / 16))
const VAMP_CD_TICKS = secFrames(3)   // кулдаун выпивания: 187 тиков ≈ 3с
const STREAM_TTL = 62                // шлейф выпускает частицы ~1с
const STREAM_TAIL = 20               // после конца выпуска — хвост на долёт последних
const PART_COLORS = ["#FF2222", "#CD5C5C", "#FF4444", "#8B0000"]
const PART_MIN_R = 1.4               // размер частицы, px
const PART_MAX_R = 3
const SPAWN_RAD = 10                 // разброс точки вылета вокруг центра героя, px
const ARRIVE_DIST = 7                // ближе этого — частица «впиталась», px
const PART_MIN_SPEED = 4.5           // шаг к цели за тик, px
const PART_MAX_SPEED = 7.5

// живые шлейфы: {hero, enemy, age, ttl, parts:[{el,x,y,sp,ph,w}]}
const streams = []

// центр rect (клетка врага/героя = центр его rect, как в damageHero/hpBar)
function centerPos(obj) {
    const p = rectPos(obj.rect)
    return [p[0] + obj.rect._w / 2, p[1] + obj.rect._h / 2]
}

// фактический максимум ХП этого спавна — формула спавна openRoom (главы ×2/×4/×6)
function spawnHpMax(enemy) {
    let max = enemy.class.stats.hp
    if (status.levelFloor === 0 && status.meta.page > 1) max *= 2
    if (status.meta.page > 2) max *= 2
    //V65: глава 4 — ещё х1.5
    if (status.meta.page > 3) max *= 1.5
    return max
}

// лечение врага за счёт героя. Вызов из damageHero ПОСЛЕ countDamage и ТОЛЬКО
// если status.info.hp реально уменьшился (проверка в точке вызова)
export function vampDrain(enemy) {
    if (!enemy || enemy.type !== "enemy" || !(enemy.stats.vampirism > 0)) return
    if (enemy.stats.vampCd > 0) return
    const cap = Math.max(enemy._hpBarMax || 0, spawnHpMax(enemy))
    const heal = Math.min(enemy.stats.vampirism, cap - enemy.stats.hp)
    if (heal <= 0) return
    const hpBefore = enemy.stats.hp
    enemy.stats.hp += heal
    //ХП-бар над врагом: до лечения — как «до удара» в damage.js (монотонный максимум)
    showEnemyHpBar(enemy, hpBefore)
    const rp = rectPos(enemy.rect)
    floatText(rp[0] + Math.trunc(Math.random() * 32), rp[1] + 8, "+" + heal, "#33FF66", "12px", "none")
    journalAdd(T("journ.vamp",T(enemy.class.name),heal), J_GREEN)
    enemy.stats.vampCd = VAMP_CD_TICKS
    //шлейф от героя: героя могла убить эта же атака (endGame) — тогда без шлейфа
    if (status.hero.obj && status.hero.obj.type === "hero") {
        streams.push({ "hero": status.hero.obj, "enemy": enemy, "age": 0, "ttl": STREAM_TTL, "parts": [] })
    }
}

// выпуск одной частицы из окрестности центра героя
function emitParticle(s) {
    const hp = centerPos(s.hero)
    const ang = Math.random() * Math.PI * 2
    const rad = Math.random() * SPAWN_RAD
    const el = circle(svgArr[1],
        hp[0] + Math.cos(ang) * rad,
        hp[1] + Math.sin(ang) * rad,
        PART_MIN_R + Math.random() * (PART_MAX_R - PART_MIN_R),
        "none", 0, PART_COLORS[Math.trunc(Math.random() * PART_COLORS.length)])
    s.parts.push({ "el": el,
        "x": hp[0] + Math.cos(ang) * rad, "y": hp[1] + Math.sin(ang) * rad,
        "sp": PART_MIN_SPEED + Math.random() * (PART_MAX_SPEED - PART_MIN_SPEED),
        "ph": Math.random() * Math.PI * 2,                       // фаза синусоиды
        "w": 0.8 + Math.random() * 1.2 })                        // амплитуда «шлейфа», px
}

// тик (из gameLoop, после buffTick): кулдауны вампиризма + движение шлейфов
export function vampTick() {
    for (let i = 0; i < objectValues.length; i++) {
        const o = objectValues[i]
        o && o.type === "enemy" && o.stats.vampirism > 0 && o.stats.vampCd > 0 && o.stats.vampCd--
    }
    for (let i = streams.length - 1; i >= 0; i--) {
        const s = streams[i]
        s.age++
        //выпуск — пока шлейф активен и оба конца живы (вампир умер — выпуск stop)
        if (s.age <= s.ttl && s.hero.type === "hero" && s.enemy.type === "enemy" && s.enemy.stats.hp > 0) {
            emitParticle(s)
        }
        //цель перечитывается каждый тик — вампир может идти/лежать трупом
        const target = s.enemy.rect ? centerPos(s.enemy) : null
        for (let k = s.parts.length - 1; k >= 0; k--) {
            const pt = s.parts[k]
            if (!target) { pt.el.remove(); s.parts.splice(k, 1); continue }
            let dx = target[0] - pt.x
            let dy = target[1] - pt.y
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist < ARRIVE_DIST) { pt.el.remove(); s.parts.splice(k, 1); continue }
            const step = Math.min(pt.sp, dist)
            dx /= dist
            dy /= dist
            const sway = Math.sin(pt.ph + s.age * 0.35) * pt.w   // поперёк курса
            pt.x += dx * step - dy * sway
            pt.y += dy * step + dx * sway
            pt.el.setAttribute("cx", pt.x.toFixed(1))
            pt.el.setAttribute("cy", pt.y.toFixed(1))
        }
        //конец шлейфа: выпуск кончился и всё долетело (или хвост принудительно)
        if ((s.age > s.ttl && s.parts.length === 0) || s.age > s.ttl + STREAM_TAIL) {
            for (let k = 0; k < s.parts.length; k++) s.parts[k].el.remove()
            streams.splice(i, 1)
        }
    }
}

// жёсткая чистка при del() (смена этажа/новый забег): узлы слоя и так сотрутся,
// сбрасываем список шлейфов, чтобы ничего не «оживало» ссылками (приём howlFx)
export function resetVampFx() {
    for (let i = 0; i < streams.length; i++) {
        for (let k = 0; k < streams[i].parts.length; k++) streams[i].parts[k].el.remove()
    }
    streams.length = 0
}
