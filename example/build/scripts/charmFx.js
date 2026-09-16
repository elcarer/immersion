// ============================================================================
// charmFx.js — V34 способность «очарование» суккуба (stats.charm).
//
// В data.js у Суккуба поле stats.charm = 1 — параметр задаёт ДЛИТЕЛЬНОСТЬ потери
// управления героем в секундах (charm: 1 = 1 секунда). Раз в 5 СЕКУНД (период
// зафиксирован константой CHARM_PERIOD_S, в данных его нет) суккуб в состоянии
// CHASE, видящий героя, выпускает один снаряд по прямой в направлении к герою.
//
// Снаряд: спрайт ./images/effects/4.png — лист 128×32 из 4 кадров 32×32
// (кадр сменяется каждые 6 тиков — speed 10, как в data.effects[4], анимация
// зациклена). Летит 5 клеток (160px, клетка = 32px) с шагом 4px/тик и исчезает;
// с ПРЕПЯТСТВИЯМИ коллизий НЕТ (матрица пола не читается — проходит сквозь
// стены). При пересечении с окном спрайта героя снаряд исчезает, а герой на
// charm секунд теряет управление: не может двигаться (блок ветки движения
// heroMove и рывок Валькирии) и атаковать (checkAttack стоит целиком — таймеры
// оружия не копят очередь, поэтому «залпа» после очарования не бывает).
// Способности НЕ страдают: activeSkillsCD тикает независимо, автокасты
// (checkEndAnim/valkyrieTick) работают — заморожен только dashTick (полёт
// рывка — это движение).
//
// Индикация: на весь срок действия эффекта НАД спрайтом героя висит анимация
// из того же листа 4.png (4 кадра по кругу) — маркер следует за героем каждый
// тик (телепорт-способность работает и под очарованием) и исчезает вместе с
// эффектом; плюс однократный всплывающий текст «Очарован!». Урона способность
// не наносит — пайплайн takeDamage не трогается.
//
// Модуль нарочно НЕ импортирует enemyAI.js/enemyMove.js (те импортируют нас):
// никаких циклов — всё нужное передаётся параметрами из точек проводки.
// Список снарядов собственный (вне objectValues — moveBullet/animPlay их не
// трогают), кадры листа двигаем по той же схеме _shift, что animPlay (V15).
// ============================================================================
import { status } from "../scripts/start.js"
import { T } from "../scripts/localization.js"
import { image, svgArr, moveSprite, spritePos, releaseSprite, rectPos } from "../scripts/svg.js"
import { checkCollision } from "../scripts/damage.js"
import { playback, strike } from "../scripts/sound.js"
import { floatText } from "../scripts/floatText.js"
import { journalAdd, J_CHARM } from "../scripts/journal.js"

const CELL = 32                    // клетка пола, px
const CHARM_PERIOD_S = 5           // период выстрела, сек (по описанию способности)
const CHARM_RANGE_PX = 5 * CELL    // дальность полёта снаряда — 5 клеток
const CHARM_PX_PER_TICK = 4        // скорость снаряда, px/тик (~250px/s, темп рывка V32)
const FRAME_TICKS = 6              // тиков на кадр листа (speed 10, как data.effects[4])
const FRAME_W = 32                 // ширина кадра листа 4.png (лист 128×32, 4 кадра)
const SHEET_W = 128                // ширина листа 4.png
const SHEET_H = 32                 // высота листа 4.png
const CHARM_SRC = "./images/effects/4.png"

const secFrames = s => Math.max(1, Math.trunc(s * 1000 / 16))

// собственный список летящих снарядов + счётчик имён пулевых узлов (прецедент
// ghostId в dashFx: свои имена, status.oVcount не трогаем)
const bullets = []
let bulletId = 0

// ---------- маркер эффекта: анимация 4.png над спрайтом героя ----------
// живёт ровно status.info.charm тиков: создаётся попаданием, каждый тик
// следует за героем и крутит кадры листа, снимается по истечении эффекта
let charmMark = null
let charmMarkId = 0
let charmMarkCounter = 0
let charmMarkStill = 0

function createCharmMark() {
    releaseCharmMark()
    charmMarkCounter = 0
    charmMarkStill = 0
    charmMark = image(svgArr[1], status.hero.x, status.hero.y - SHEET_H, SHEET_W, SHEET_H, CHARM_SRC,
        { times: 4, id: "chM" + (charmMarkId++), frame: 0 })
}

function releaseCharmMark() {
    if (!charmMark) return
    releaseSprite(charmMark)
    charmMark = null
}

// кадр листа маркера — та же схема _shift, что у снарядов и animPlay
function charmMarkFrameTick() {
    if (++charmMarkCounter < FRAME_TICKS) return
    charmMarkCounter = 0
    charmMarkStill = (charmMarkStill + 1) & 3
    const p0 = rectPos(charmMark.clipRect)
    charmMark._shift = FRAME_W * charmMarkStill
    charmMark.setAttribute("x", p0[0] - FRAME_W * charmMarkStill)
}

// ---------- состояние «очарования» героя ----------
// применяется попаданием снаряда; status.info.charm — остаток эффекта в тиках
// (инициализируется нулём в start.js/sceneGenerate.js)
function charmHero(seconds) {
    //V37 журнал: новое очарование (повторное попадание лишь продлевает — не пишем)
    !status.info.charm && journalAdd(T("journ.charmed"), J_CHARM)
    //V46b: «Выносливость» (stats[2].dops[2], countLog(2·v1)%, потолок 99) сокращает
    //длительность очарования, минимум 1 тик
    let charmFrames = secFrames(seconds)
    status.info.charm = Math.max(1, charmFrames - Math.trunc(charmFrames * parseInt(status.info.stats[2].dops[2].value2.slice(0,-1))/100))
    status.hero.obj.stop = 1        // отпустить «клавиши»: машинерия ожидания героя обычная
    status.hero.waitTime = 0
    createCharmMark()
    floatText(status.hero.x + 16, status.hero.y - 8, T("float.charmed"), "#FF69B4", "14px", "none")
    playback(strike[14].vol, 0, 0, 3 * status.settings.soundVolume)
}

// обратный отсчёт очарования (вызывается раз за тик из charmTick в enemyMove —
// состояние героя живёт в том же темпе, что и весь мир)
function charmStateTick() {
    const c = status.info.charm
    if (!c) return
    status.info.charm = c - 1
    if (status.info.charm <= 0) {
        status.info.charm = 0
        releaseCharmMark()          // эффект закончился — анимация над героем пропадает
        return
    }
    // маркер следует за героем и анимируется (телепорт живёт и под очарованием)
    if (charmMark) {
        charmMarkFrameTick()
        spritePos(charmMark, status.hero.x, status.hero.y - SHEET_H)
    }
}

// ---------- снаряд ----------
// выстрел уже проверенного триггером суккуба: прямая линия центр_суккуба ->
// центр_героя (как у рывка, октантов нет — направление произвольное)
function fireCharmBullet(enemy, charmSeconds) {
    if (!status.hero.obj || status.hero.obj.type !== "hero") return
    const ePos = rectPos(enemy.rect)
    const scx = ePos[0] + 16
    const scy = ePos[1] + 25
    const hcx = status.hero.x + 16
    const hcy = status.hero.y + 25
    const dx = hcx - scx
    const dy = hcy - scy
    const len = Math.hypot(dx, dy)
    if (len < 1) return // суккуб стоит в герое — стрелять некуда
    const img = image(svgArr[1], scx - 16, scy - 16, SHEET_W, SHEET_H, CHARM_SRC,
        { times: 4, id: "chB" + (bulletId++), frame: 0 })
    bullets.push({
        owner: enemy,
        img,
        charmSeconds,
        ux: dx / len,
        uy: dy / len,
        left: CHARM_RANGE_PX,
        counter: 0,
        still: 0,
        sx: scx,   // центр спавна — нужен тесту для замера пройденной дистанции
        sy: scy,
    })
    playback(strike[11].vol, 0, 0, 3 * status.settings.soundVolume)
}

// триггер раз в CHARM_PERIOD_S секунд; вызывается из enemyTick ТОЛЬКО для врага
// в состоянии CHASE; видимость героя передаётся извне (как dashTryTrigger)
export function charmTryTrigger(enemy, seesHero) {
    const param = enemy.stats && enemy.stats.charm
    if (!param || !seesHero) return
    if (enemy.charmAge === undefined) enemy.charmAge = 0
    enemy.charmAge++
    if (enemy.charmAge < secFrames(CHARM_PERIOD_S)) return
    enemy.charmAge = 0
    fireCharmBullet(enemy, param)
}

// полёт всех снарядов за тик: кадр листа, шаг по прямой, попадание в героя,
// исчезновение по исчерпании дальности. С матрицей пола снаряд НЕ сверяется —
// стены игнорируются по заданию.
function charmBulletsTick() {
    if (!bullets.length) return
    const heroAlive = status.hero.obj && status.hero.obj.type === "hero"
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i]
        // кадр анимации: 4 кадра листа по кругу; схема _shift — как в animPlay
        if (++b.counter >= FRAME_TICKS) {
            b.counter = 0
            b.still = (b.still + 1) & 3
            const p0 = rectPos(b.img.clipRect)
            b.img._shift = FRAME_W * b.still
            b.img.setAttribute("x", p0[0] - FRAME_W * b.still)
        }
        // шаг: хвостовой тик добирает ровно остаток дальности
        const step = Math.min(CHARM_PX_PER_TICK, b.left)
        b.left -= step
        moveSprite(b.img, b.ux * step, b.uy * step)
        // попадание: окно кадра 32×32 против rect героя (32×51) — строгое
        // пересечение, как во всей игре; урона нет, только потеря управления
        if (heroAlive) {
            const p = rectPos(b.img.clipRect)
            const hRect = status.hero.obj.rect
            const hPos = rectPos(hRect)
            if (checkCollision(p[0], hPos[0], FRAME_W, hRect._w, p[1], hPos[1], FRAME_W, hRect._h)) {
                charmHero(b.charmSeconds)
                releaseSprite(b.img)
                bullets.splice(i, 1)
                continue
            }
        }
        // дальность 5 клеток исчерпана — снаряд исчезает (вне зависимости от стен)
        if (b.left <= 0) {
            releaseSprite(b.img)
            bullets.splice(i, 1)
        }
    }
}

// единая точка вызова за тик (enemyMove, рядом с dashGhostsTick)
export function charmTick() {
    charmStateTick()
    charmBulletsTick()
}

// снимок для тестов: позиции/остаток дальности летящих снарядов
export function charmProbe() {
    return bullets.map(b => {
        const p = rectPos(b.img.clipRect)
        return { x: p[0], y: p[1], sx: b.sx, sy: b.sy, left: b.left }
    })
}

// жёсткая чистка при del() (смена этажа/новый забег): узлы слоя и так сотрутся,
// сбрасываем список, очарование и маркер, чтобы ничего не «оживало» ссылками
export function resetCharmBullets() {
    for (let i = 0; i < bullets.length; i++) releaseSprite(bullets[i].img)
    bullets.length = 0
    status.info.charm = 0
    releaseCharmMark()
}
