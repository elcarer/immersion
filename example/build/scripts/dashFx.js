// ============================================================================
// dashFx.js — V32 способность «рывок» нетопыря (stats.dash).
//
// В data.js у Нетопыря поле stats.dash = 4 — один параметр задаёт ОБА свойства
// способности: период срабатывания (раз в dash секунд) и дальность рывка
// (dash клеток, клетка = 32px). Механика аналогична «Пронзающему рывку»
// Валькирии (valkyrie.js): летящий спрайт оставляет след из полупрозрачных
// копий текущего кадра (opacity 0.35, гаснут за жизнь кадра-следа, при
// завершении рывка след снимается сразу), пересечение со спрайтом героя
// наносит урон ОДИН раз за рывок — расчёт ровно как при обычной атаке врага
// (случайное значение из stats.dmg через полный пайплайн takeDamage).
//
// Отличия от Валькирии: направление выбирается ОДИН раз на старте (октант к
// герою: оси + диагонали) и ведёт ровно на dash клеток по сетке (диагональ =
// смещение ±N клеток по обеим осям). Рывок прерывается препятствием: пиксель,
// выводящий центр спрайта в непроходимую клетку, не применяется, полёт
// заканчивается на последней свободной позиции. Стан во время полёта тоже
// прерывает его (проверка в enemyTick). Cooldown тикает только у преследующего
// врага, видящего героя (как «тень» — внешние проверки стоят в enemyTick).
//
// Модуль нарочно НЕ импортирует enemyAI.js/enemyMove.js (те импортируют нас):
// никаких циклов — всё нужное передаётся параметрами из точек проводки.
// ============================================================================
import { status } from "../scripts/start.js"
import { image, rectPos, moveSprite, releaseSprite, svgArr } from "../scripts/svg.js"
import { checkCollision } from "../scripts/damage.js"
import { takeDamage } from "../scripts/takeDamage.js"
import { playback, strike } from "../scripts/sound.js"
import { checkZOrder } from "../scripts/heroMove.js"
//V38: бонус «воя» — рывок врага в зоне воя тоже бьёт с прибавкой (howlFx.js)
import { howlBonus } from "../scripts/howlFx.js"
//V56: сет «Победитель турниров» (2 надетых) — урон рывка элит/боссов тоже −10%
import { setEliteDamageMult } from "../scripts/sets.js"

const CELL = 32                 // клетка пола, px
const DASH_PX_PER_TICK = 4      // скорость полёта (~250px/s; настройка темпа рывка)
const GHOST_LIFE = 12           // жизнь одного спрайта следа, тиков (как у Валькирии)
const GHOST_OPACITY = 0.35      // прозрачность следа (как у Валькирии)

// глобальный список следов всех летящих врагов (паттерн emoFx из enemyAI):
// точка гашения одна на тик из enemyMove; владелец нужен, чтобы мгновенно снять
// свой след при завершении рывка и почистить след погибшего врага (type!=enemy)
const ghosts = []
let ghostId = 0

const secFrames = s => Math.max(1, Math.trunc(s * 1000 / 16))

// октант направления к герою по центрам (центры как во всём ИИ врагов: +16,+25);
// возврат — смещение клетки {-1|0|1} по осям
function octantToHero(ex, ey, hx, hy) {
    const k = ((Math.round(Math.atan2(hy - ey, hx - ex) / (Math.PI / 4)) % 8) + 8) % 8
    return [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]][k]
}

// смена позы на кардинальную ориентацию полёта — локальная копия записи атрибутов
// setEnemyPose (импорт из enemyAI дал бы цикл enemyAI <-> dashFx); ярость здесь
// не учитывается сознательно: полёт имеет собственный темп
function faceDashDirection(enemy, ox, oy) {
    const dirIdx = Math.abs(ox) >= Math.abs(oy) ? (ox > 0 ? 3 : 2) : (oy > 0 ? 1 : 0)
    const anim = enemy.class.anims[0].move[dirIdx]
    if (!anim || enemy.currentAnim === anim) return
    enemy.currentAnim = anim
    enemy.currentStill = 0
    enemy.animCounters = Math.max(1, Math.round(60 / anim.speed))
    enemy.img.setAttribute("href", anim.img)
    enemy.img.setAttribute("times", anim.times)
    enemy.img.setAttribute("width", anim.w)
    enemy.img.setAttribute("height", anim.h)
}

// мгновенно снять все следы конкретного врага (завершение/прерывание рывка;
// следы умершего врага добирает глобальное гашение по условию owner.type)
function releaseOwnerGhosts(enemy) {
    for (let i = ghosts.length - 1; i >= 0; i--) {
        if (ghosts[i].owner === enemy) {
            releaseSprite(ghosts[i].img)
            ghosts.splice(i, 1)
        }
    }
}

// старт рывка уже проверенного триггером врага: цель — ровно cells клеток по
// октанту на героя (диагональ даёт смещение ±cells по обеим осям), скорость
// равномерная по прямой линии старая_точка -> целевая
function startDash(enemy, cells) {
    const p = rectPos(enemy.rect)
    const oct = octantToHero(p[0] + 16, p[1] + 25, status.hero.x + 16, status.hero.y + 25)
    const tx = p[0] + oct[0] * cells * CELL
    const ty = p[1] + oct[1] * cells * CELL
    const dxT = tx - p[0]
    const dyT = ty - p[1]
    faceDashDirection(enemy, oct[0], oct[1])
    enemy.dashAge = 0
    enemy.dashFly = {
        sx0: p[0],
        sy0: p[1],
        len: Math.hypot(dxT, dyT),
        ux: Math.hypot(dxT, dyT) ? dxT / Math.hypot(dxT, dyT) : 0,
        uy: Math.hypot(dxT, dyT) ? dyT / Math.hypot(dxT, dyT) : 0,
        tx,
        ty,
        progress: 0,
        // позиция, на которой фактически стоит спрайт после применённых пикселей
        rx: p[0],
        ry: p[1],
        hitDone: 0,
    }
}

// триггер раз в stats.dash секунд; вызывается из enemyTick ТОЛЬКО для врага в
// состоянии CHASE (преследует => знает героя); видимость героя передаётся извне
export function dashTryTrigger(enemy, seesHero) {
    const param = enemy.stats && enemy.stats.dash
    if (!param || !seesHero || enemy.dashFly) return
    if (enemy.dashAge === undefined) enemy.dashAge = 0
    enemy.dashAge++
    if (enemy.dashAge < secFrames(param)) return
    startDash(enemy, param)
}

// обход препятствия: пиксель применяется, только если ЦЕНТР спрайта после шага
// остаётся в проходимой клетке (та же выборка центра, что у расталкивания врагов)
function cellWalkable(x, y) {
    const matrix = status.matrixLevel
    const row = matrix && matrix[Math.trunc((y + 25) / CELL)]
    return !!(row && row[Math.trunc((x + 16) / CELL)] === 1)
}

function spawnGhost(enemy, x, y) {
    ghosts.push({
        owner: enemy,
        life: GHOST_LIFE,
        // слой рисования следа — тот же мировой слой [1], где живут враги
        img: image(svgArr[1], x, y,
            enemy.img.width.animVal.value, enemy.img.height.animVal.value,
            enemy.img.getAttribute("href"),
            { times: enemy.currentAnim.times, id: "dashTr" + (ghostId++), frame: enemy.currentStill, opacity: GHOST_OPACITY }),
    })
}

// полёт: вызывается из enemyTick вместо движения преследования. Продвигает
// прогресс по прямой, применяет целые пиксели с проверкой проходимости КАЖДОГО,
// кладёт спрайт следа в пройденный тик и один раз за рывок бьёт героя при
// пересечении спрайтов (расчёт урона — как при атаке этого врага)
export function dashFlyTick(enemy) {
    const st = enemy.dashFly
    const newPos = rectPos(enemy.rect)
    const beforeX = newPos[0]
    const beforeY = newPos[1]
    // продвижение вдоль прямой до цели (хвостовой тик добирает ровно остаток)
    st.progress = Math.min(st.len, st.progress + DASH_PX_PER_TICK)
    const goalX = Math.round(st.sx0 + st.ux * st.progress)
    const goalY = Math.round(st.sy0 + st.uy * st.progress)
    // целые пиксели, набежавшие с прошлой отрисовки
    let stepX = goalX - st.rx
    let stepY = goalY - st.ry
    let cx = st.rx
    let cy = st.ry
    let blocked = false
    // применяем пиксель за пикселем (сначала ось X, потом Y — при блоке ось Y
    // тоже отменяется: рывок заканчивается на последней свободной позиции)
    while (stepX !== 0 && !blocked) {
        if (!cellWalkable(cx + Math.sign(stepX), cy)) { blocked = true; break }
        cx += Math.sign(stepX)
        stepX -= Math.sign(stepX)
    }
    while (stepY !== 0 && !blocked) {
        if (!cellWalkable(cx, cy + Math.sign(stepY))) { blocked = true; break }
        cy += Math.sign(stepY)
        stepY -= Math.sign(stepY)
    }
    if (blocked) {
        st.progress = st.len   // полёт закончен (частично или полностью)
    } else {
        cx = goalX
        cy = goalY
    }
    if (cx !== st.rx || cy !== st.ry) {
        moveSprite(enemy.img, cx - st.rx, cy - st.ry)
        st.rx = cx
        st.ry = cy
        // след рывка: копия текущего кадра на позиции ДО шага этого тика
        spawnGhost(enemy, beforeX, beforeY)
    }
    // урон герою при пересечении спрайтов — один раз за рывок, полный пайплайн
    // takeDamage (броня/уклон/блок/контрудар), как от снаряда этого врага
    if (!st.hitDone && status.hero.obj.type === "hero") {
        const eRect = enemy.rect
        const hRect = status.hero.obj.rect
        const hPos = rectPos(hRect)
        if (checkCollision(
            st.rx, hPos[0], eRect._w, hRect._w,
            st.ry, hPos[1], eRect._h, hRect._h)) {
            st.hitDone = 1
            enemy.auraMiss = 0   // попадание состоялось — ауре уклонений не засчитывается
            const dmg = enemy.stats.dmg
            playback(strike[15].vol, 0, 0, status.settings.soundVolume)
            //V37: имя врага — для красной строки журнала (полный пайплайн takeDamage)
            //V38: + бонус воя, если бьющий враг стоит в зоне (зоны не складываются)
            //V56: сет «Победитель турниров» (2 надетых): базовый урон рывка элит/боссов ×0.9
            //(до прибавки воя — тем же порядком, что в damageHero.countDamage)
            const raw = Math.trunc(Math.random() * (dmg[1] - dmg[0] + 1) + dmg[0])
            //V68: третьим параметром сам враг — «Вечный жемчуг» отражает ему долю урона
            takeDamage(Math.floor(raw * setEliteDamageMult(enemy)) + howlBonus(enemy), enemy.class.name, enemy)
        }
    }
    checkZOrder(enemy)
    // конец рывка: прошла вся дальность или встречено препятствие
    if (st.progress >= st.len) endDashFlight(enemy)
}

// завершение/прерывание полёта (дальность исчерпана, стена, стан); называется и
// напрямую из enemyTick при внезапном стане. След снимается сразу — механика 1:1
// с endDash Валькирии; кулдаун уже обнулён на старте (dashAge = 0). Путь к герою
// построен ДО рывка с другой клетки — сброс (как при «нырке тени»), CHASE
// пересчитает через flow-field с нового места
export function endDashFlight(enemy) {
    if (!enemy.dashFly) return
    releaseOwnerGhosts(enemy)
    enemy.dashFly = null
    enemy.path = []
    enemy.pathTarget = null
}

// глобальное гашение следов (один вызов за тик из enemyMove рядом с emoFxTick)
export function dashGhostsTick() {
    if (!ghosts.length) return
    for (let i = ghosts.length - 1; i >= 0; i--) {
        const g = ghosts[i]
        g.life--
        if (g.life <= 0 || g.owner.type !== "enemy") {
            releaseSprite(g.img)
            ghosts.splice(i, 1)
        } else {
            g.img.setAttribute("opacity", GHOST_OPACITY * (g.life / GHOST_LIFE))
        }
    }
}

// жёсткая чистка при del() (смена этажа/новый забег): узлы слоя и так сотрутся,
// сбрасываем список и счётчик имён, чтобы след не «оживал» ссылками в новую сцену
export function resetDashGhosts() {
    ghosts.length = 0
}
