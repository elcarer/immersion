// ============================================================================
// enemyAI.js — боевой ИИ врагов (переписано начисто).
//
// Явная машина состояний enemy.state (константы ENEMY_STATE):
//   IDLE            стоит на месте; заметив героя (range) — переходит в CHASE
//   PATROL_LOOP     патруль «туда-сюда» (маятник: клетка спавна <-> случайная точка)
//   PATROL_WANDER   патруль-блуждание по случайным точкам своей комнаты
//   CHASE           преследование: идёт по построенному пути к клетке героя; путь
//                   перестраивается в конечной клетке (onPathEnd → enemyChase), после
//                   конца анимации атаки (checkEndAnim → enemyChase) и после 3 смен
//                   клетки героя (PATH_HERO_MOVES — компромисс живости и покоя, E-9).
//                   Потеряв героя, доходит до последней известной клетки
//                   и переходит в PATROL_WANDER
//   ATTACK          проигрывает анимацию атаки (снаряд спавнится в animPlay по
//                   attackNew); по концу анимации — CHASE (видит героя) или IDLE
//   STUN            оглушён (noStunTime); по окончании — CHASE (видит) или IDLE
//   DOWN            лежит (только Mummy, reanimate): неубиваем, через 3с встаёт
//   FLEE            раненый (E-10): ≤25% ХП спавна (не босс) — фаза "flee" убегает от
//                   героя, фаза "sneak" подкрадывается со спины/сбоку, избегая линию
//                   огня «герой→другой враг» и сектор перед героем; дальнобойные
//                   только отходят на дистанцию стрельбы. Боссы — всегда напролом
// Мёртвый враг = type "corpse" (машина его не трогает). type "pet" (ручная крыса
// из checkRat) просто доходит по остатку пути.
//
// Честный прицел (enemyAim): враг атакует ТОЛЬКО если герой видим и кадр снаряда
// в выбранном направлении реально пересекает героя; летящие снаряды (range) —
// только когда герой стоит на оси полёта в пределах дальности. Никаких атак
// «в пустоту», сквозь стены и по диагонали мимо цели.
//
// E-9 (2026-09-17, «ИИ не дёргается»): поиск пути — только когда активного пути нет:
// в конечной клетке предыдущего (onPathEnd → enemyChase) и после конца анимации атаки,
// плюс после PATH_HERO_MOVES смен клетки героя (перечитывает заметно ушедшего героя,
// не дожидаясь конца пути — решение пользователя). Перестроение пути при КАЖДОЙ смене
// клетки героя снесено; атака при этом проверяется каждый тик (enemyTryAttack), так что
// «пройти мимо» героя в зоне удара враг не может. Прямые шаги по осям тоже снесены
// (у тонкой стенки «пилили» и не находили окружной путь) — движение всегда по пути.
// E-9b: проходимость для ИИ — navMatrix: пол matrixLevel ТОЛЬКО в открытых героем
// комнатах (roomsArr[k][3]===1) и коридорах (floor[i][7]===1) минус клетки закрытых
// дверей (открывает только герой; status.navVersion — счётчик изменений, инкрементится
// в heroMove.checkNewRoom и openDoor). Путь строится по всей карте, но только по
// разведанному — враг больше не идёт сквозь закрытые двери в неоткрытые комнаты.
// E-10: раненые враги убегают и заходят со спины (состояние FLEE); прежний комнатный
// A* снесён (astar.js и pathfinding.js удалены) — патруль тоже ходит общим bfsPath.
// ============================================================================
import { status } from "../scripts/start.js"
import { T } from "../scripts/localization.js"
import { data } from "../scripts/data.js"
import { dataGeneric } from "../scripts/sceneGenerate.js"
import { checkCollision, playEffect, dropKey, checkExp, reanimateCheck } from "../scripts/damage.js"
import { svgArr, image, worldImage, spritePos, moveSprite, rectPos, releaseSprite } from "../scripts/svg.js"
import { checkZOrder } from "../scripts/heroMove.js"
import { enemyOnTrail } from "../scripts/valkyrie.js"
import { checkRat } from "../scripts/encounters.js"
import { floatText } from "../scripts/floatText.js"
//V90: снятие полосы ХП босса при смерти владельца (полоса оставалась после убийства)
import { changeBossHP, bossBarOwnerDied } from "../scripts/hpBar.js"
import { playback, strike } from "../scripts/sound.js"
import { objectValues,screenPic,doorPics } from "../scripts/del.js"
//V52: «Массовик-затейник» — окно смертей врагов «одной атакой»
import { achKill } from "../scripts/achievements.js"
//V64: смерть монстра арены — счёт «все 9 убиты» и появление рычага арены
import { portalArenaKill } from "../scripts/portalFx.js"
//V104: Волк-союзник (квест «Сопроводить Волка») — поведение в ветке pet enemyTick.
//Цикл импортов quest<->enemyAI легален: вызовы только в рантайме
import { wolfAllyTick } from "../scripts/quest.js"
//V109: культист квеста «Голос в портале» — мирный перехват тика (cultNpc) и хук
//смерти (дроп части посоха / победа над культистом). Цикл импортов легален: рантайм
import { portalQuestCultTick, portalQuestEnemyDie } from "../scripts/portalQuest.js"
// V32 «рывок» нетопыря (stats.dash): триггер и полёт живёт в dashFx.js,
// сюда встроены только точки проводки (аналогично tickShadow выше)
import { dashTryTrigger, dashFlyTick, endDashFlight } from "../scripts/dashFx.js"
// V34 «очарование» суккуба (stats.charm): триггер и снаряды живут в charmFx.js
import { charmTryTrigger } from "../scripts/charmFx.js"
// V38 «вой» Хаунда (stats.howl): зоны живут в howlFx.js, сюда — точка смерти
import { howlDie } from "../scripts/howlFx.js"
//V90: еда «удачи» питомца — появляется на нём самом, когда он остановился у героя
//(пробег за едой живёт в pets.js)
import { petLuckyTick } from "../scripts/pets.js"
import { journalAdd, J_YELLOW } from "../scripts/journal.js"
//V56: сет «Победитель турниров» (6 надетых) — шанс кучки золота на месте убийства;
//сет «Доблестный небожитель» (2 надетых) — элиты/боссы медленнее на 1
import { rollGoldKillPile, setEliteSpeedMod } from "../scripts/sets.js"
import { dropArr } from "../scripts/useObject.js"
//V69: кучка золота не должна падать в стену — перенос на свободную клетку (dropSafe.js)
//V103: dropFly — кучка вылетает из центра спрайта источника и летит по параболе
import { placeDrop,dropFly } from "../scripts/dropSafe.js"
//V75: Золотое эхо (шкафчик) — шанс доп. кучки золота рядом с упавшей
import { blessEcho } from "../scripts/blessFx.js"
//V65: смерть Циклопа Пустоты (stats.voidBlob) сразу завершает 4 этаж
//V85: Медуза пустоты — этаж завершается только гибелью ПОСЛЕДНЕГО осколка
import { voidBossFinale, medusaPieceDied } from "../scripts/voidBoss.js"

export const ENEMY_STATE = { IDLE: 0, PATROL_LOOP: 1, PATROL_WANDER: 2, CHASE: 3, ATTACK: 4, STUN: 5, DOWN: 6, FLEE: 7 }

// ---------- поза (анимация) и переход состояния ----------
//интервал смены кадра (в тиках ≈62.5 Гц): переключение кадров зависит от параметра
//speed самой анимации (60/speed); в ярости (stats.rage) эффективная скорость ×1.5 —
//кадры сменяются в полтора раза чаще, ускорение врага ощущается визуально
export function animInterval (enemy, anim) {
    const speed = enemy.rageActive ? anim.speed * 1.5 : anim.speed
    //V65: глава 4 — эффекты атак врагов (снаряды/взмахи/эффекты попаданий с флагом fxSlow,
    //ставится в addAnim/crushBurst/playEffect) играют вдвое медленнее: живут вдвое дольше,
    //а мили-взмахи-снаряды за это время пролетают вдвое дальше. Тело самого врага не замедляется
    const slow = enemy.fxSlow ? 2 : 1
    return Math.max(1, Math.round(60 * slow / speed))
}
export function setEnemyPose(enemy, anim) {
    if (!anim) return
    enemy.currentAnim = anim
    enemy.currentStill = 0
    enemy.animCounters = animInterval(enemy, anim)
    enemy.img.setAttribute("href", anim.img)
    enemy.img.setAttribute("times", anim.times)
    enemy.img.setAttribute("width", anim.w)
    enemy.img.setAttribute("height", anim.h)
}
export function setEnemyState(enemy, state) {
    enemy.state = state
    enemy.stop = 0
    enemy.currentStill = 0
}
function idlePose(enemy) {
    setEnemyState(enemy, ENEMY_STATE.IDLE)
    setEnemyPose(enemy, waitPose(enemy))
}

// ---------- обнаружение (геометрический range, как раньше) ----------
export function enemySeesHero(enemy) {
    if (status.hero.obj.type !== "hero") return false
    const range = (enemy.class.stats.range - status.info.invisible) * 32
    if (range < 0) return false
    const r = enemy.rect
    const pos = rectPos(r)
    return checkCollision(
        pos[0] - range, status.hero.x, r._w + 2 * range, 32,
        pos[1] - range, status.hero.y, r._h + 2 * range, 51)
}

// ---------- эмоция «заметил героя»: emo1.png над rect на 1с ----------
let emoFx = []
function spawnEmo(enemy) {
    for (let i = 0; i < emoFx.length; i++) {
        if (emoFx[i].enemy === enemy) return
    }
    const r = enemy.rect
    emoFx.push({
        enemy,
        time: 63,
        img: image(svgArr[1], r.x.animVal.value + r.width.animVal.value - 32, r.y.animVal.value - 32, 32, 32, "./images/effects/emo1.png", {}),
    })
}
export function emoFxTick() {
    if (!emoFx.length) return
    for (let i = emoFx.length - 1; i >= 0; i--) {
        const fx = emoFx[i]
        if (fx.time <= 0 || fx.enemy.type !== "enemy") {
            fx.img.remove()
            emoFx.splice(i, 1)
            continue
        }
        fx.time--
        const r = fx.enemy.rect
        const rPos = rectPos(r)
        spritePos(fx.img, rPos[0] + r._w - 32, rPos[1] - 32)
    }
}
export function resetEmoFx() {
    for (let i = 0; i < emoFx.length; i++) emoFx[i].img.remove()
    emoFx.length = 0
}

// ---------- navMatrix: проходимость этажа для ИИ (E-9b) ----------
// Пол matrixLevel ТОЛЬКО в открытых героем комнатах (roomsArr[k][3]===1) и открытых
// коридорах (клетки floor[i] с [2]===1 и флагом [7]===1), минус клетки закрытых дверей
// (закрытые текстуры из openDoor.js — открывает только герой). Кэш по паре
// (matrixLevel ref, status.navVersion): счётчик инкрементится в heroMove.checkNewRoom
// (открытие комнаты/коридора) и openDoor (открытие двери) — navMatrix перестраивается
// только после реальных изменений карты, между ними это чистые чтения типизированного
// массива. Flow-field и bfsPath ходят ТОЛЬКО по navMatrix — враг не строит путь сквозь
// закрытые двери и в неоткрытые комнаты.
let navMatrixRef = null   // status.matrixLevel, по которому построен nav
let navVersionRef = -1    // status.navVersion на момент постройки
let nav = null            // Uint8Array w*h: 1 — проходимо для ИИ
let navW = 0
let navH = 0
// закрытые двери всех этажей (пара «закрытая» из openDoor.js); при открытии href
// меняется на открытую текстуру — клетка снова проходима
const CLOSED_DOOR_HREFS = new Set(
    [9, 12, 23, 24, 39, 42, 53, 54, 69, 72, 83, 84].map(n => "./images/dungeon/walls/" + n + ".png"))
function ensureNavMatrix() {
    const matrix = status.matrixLevel
    if (!matrix || !matrix[0]) return null
    const ver = status.navVersion || 0
    if (nav && navMatrixRef === matrix && navVersionRef === ver) return nav
    const h = matrix.length
    const w = matrix[0].length
    const n = new Uint8Array(w * h)
    const lv = dataGeneric.scenes[status.levelFloor]
    // комнаты: прямоугольник пола открытой комнаты
    for (let k = 0; k < lv.roomsArr.length; k++) {
        if (lv.roomsArr[k][3] !== 1) continue
        const f = lv.floor[lv.roomsArr[k][0]]
        for (let y = f[1]; y < f[1] + f[3]; y++) {
            const row = matrix[y]
            if (!row) continue
            for (let x = f[0]; x < f[0] + f[2]; x++) {
                if (row[x] === 1) n[y * w + x] = 1
            }
        }
    }
    // коридоры: одиночные клетки floor[i] ([2]===1 — размер клетки), флаг открытости [7].
    //V110: без требования matrix===1 — клетки проёма у дверей перекрыты записями боковых
    //стен (createMatrix пишет 2 ПОВЕРХ пола коридора), и с прежним условием nav считал
    //их стенами навсегда: коридор был наглухо разорван для ИИ даже с открытыми дверями
    //(волк квеста вставал в проёме и больше не следовал за героем). Открытая клетка
    //коридора всегда нарисована полом (createCorridor) — проходима.
    for (let i = 0; i < lv.floor.length; i++) {
        const f = lv.floor[i]
        if (f[2] === 1 && f[7] === 1 && matrix[f[1]] && matrix[f[1]][f[0]] !== undefined) {
            n[f[1] * w + f[0]] = 1
        }
    }
    // закрытые двери — блокеры
    closeDoorsOnMatrix(n, w, h)
    navMatrixRef = matrix
    navVersionRef = ver
    navW = w
    navH = h
    nav = n
    return n
}
// закрытые двери — блокеры в ЛЮБОЙ карте ИИ (могут перекрывать больше одной клетки,
// если тайл шире 32px); общие для navMatrix и boss-карты (E-18)
function closeDoorsOnMatrix(n, w, h) {
    for (let i = 0; i < doorPics.length; i++) {
        const p = doorPics[i]
        if (!p || typeof p.getAttribute !== "function") continue
        const href = p.getAttribute("href")
        if (!href || !CLOSED_DOOR_HREFS.has(href)) continue
        const px = p.x.animVal.value
        const py = p.y.animVal.value
        const x0 = Math.floor(px / 32)
        const y0 = Math.floor(py / 32)
        const x1 = Math.floor((px + p.width.animVal.value - 1) / 32)
        const y1 = Math.floor((py + p.height.animVal.value - 1) / 32)
        for (let y = y0; y <= y1; y++) {
            for (let x = x0; x <= x1; x++) {
                if (x >= 0 && y >= 0 && x < w && y < h) n[y * w + x] = 0
            }
        }
    }
}

// ---------- flow-field: один общий BFS от клетки героя по всему открытому этажу ----------
let flowNavRef = null
let flowCenter = [-1, -1]
let flowDirs = null
let flowW = 0
let flowH = 0
//V16: типизированные буферы переиспользуются между пересчётами (раньше 4 новых
//массива на каждую смену клетки героя — GC-мусор при движении)
let flowDist = null
let flowQx = null
let flowQy = null
const DX = [0, 0, -1, 1]
const DY = [-1, 1, 0, 0]
function ensureFlowField() {
    const n = ensureNavMatrix()
    if (!n) return false
    const heroCell = [Math.trunc(status.hero.x / 32), Math.trunc(status.hero.y / 32)]
    if (flowNavRef === n && flowDirs && flowCenter[0] === heroCell[0] && flowCenter[1] === heroCell[1]) return true
    const h = navH
    const w = navW
    const size = w * h
    if (!flowDist || flowDist.length !== size) {
        flowDist = new Int32Array(size)
        flowDirs = new Uint8Array(size)
        flowQx = new Int32Array(size)
        flowQy = new Int32Array(size)
    }
    flowDist.fill(-1)
    flowDirs.fill(255)
    const dist = flowDist
    const dirs = flowDirs
    const qx = flowQx
    const qy = flowQy
    let head = 0
    let tail = 0
    const sx = heroCell[0]
    const sy = heroCell[1]
    // герой может стоять в клетке закрытой двери (момент её открытия) — сеем её всегда,
    // расширяемся только по navMatrix
    if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
        dist[sy * w + sx] = 0
        qx[tail] = sx
        qy[tail] = sy
        tail++
    }
    while (head < tail) {
        const cx = qx[head]
        const cy = qy[head]
        head++
        const d = dist[cy * w + cx]
        for (let k = 0; k < 4; k++) {
            const nx = cx + DX[k]
            const ny = cy + DY[k]
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
            if (n[ny * w + nx] !== 1) continue
            if (dist[ny * w + nx] !== -1) continue
            dist[ny * w + nx] = d + 1
            dirs[ny * w + nx] = k ^ 1
            qx[tail] = nx
            qy[tail] = ny
            tail++
        }
    }
    flowNavRef = n
    flowCenter = heroCell
    flowDirs = dirs
    flowW = w
    flowH = h
    return true
}
//V28: индивидуальный «фланг» врага — какую из равных по длине ветвей пути к герою
//предпочитать: −1/1 = обходить цель чуть слева/справа от прямого направления,
//0 = без предпочтения. Лениво при первом преследовании, живёт на враге навсегда.
function flankOf(enemy) {
    if (enemy.flank === undefined) {
        const r = Math.random()
        enemy.flank = r < 0.4 ? -1 : r < 0.8 ? 1 : 0
    }
    return enemy.flank
}
// ---------- V28b: квота прямых атакующих, остальные заходят сбоку/в спину ----------
// Если рядом сошлось CROWD_MIN и больше врагов (CROWD_R между центрами), напрямую
// к герою идут не более MAX_DIRECT_PER_CROWD — БЛИЖАЙШИЕ к нему; «лишние» строют
// длинный путь к клетке в кольце 2..5 шагов flow-дистанции ВОКРУГ героя, выбирая
// точку максимально ПРОТИВ вектора своего наступления (бок/спина). Дойдя до точки
// обхода, враг перечитывает роль (onPathEnd → enemyChase): ближе героя к цели он
// уже сам, и как правило переключается на прямое сближение. Цель недостижима —
// падение в обычное прямое поведение. Путь к точке обхода — локальный BFS.
const CROWD_R = 72                 // px между центрами — «рядом»
const CROWD_MIN = 3                // столпилось столько — включается режим обхода
const MAX_DIRECT_PER_CROWD = 2     // напрямую идут максимум двое
const FLANK_SCAN = 6               // окно поиска точки обхода вокруг героя (клетки)
const PATH_RETRY_TICKS = 30        // пауза между попытками построить путь (не каждый тик)
const PATH_HERO_MOVES = 3          // живой путь перечитывается после стольких смен клетки героя
// V57: боссы (class.boss / «Босс» в имени) из толпы исключены целиком — см. crowdRankOf:
// сами всегда идут напрямую и в size толпы не входят
function crowdRankOf(enemy) {
    const vb = svgArr[0].viewBox.animVal
    const me = rectPos(enemy.rect)
    const mx = me[0] + 16
    const my = me[1] + 25
    const hpx = status.hero.x + 16
    const hpy = status.hero.y + 25
    const crew = [] // [расстояние-до-героя, id] — только живые ходячие в кадре
    //E-3: перебор врагов из группы genemy (маркер на спавне); фильтр type — 1:1
    const gE = world.queries.genemy && world.queries.genemy.entities
    if (!gE) return { size: 0, rank: -1 }
    const snap = gE.slice()
    for (let i = 0; i < snap.length; i++) {
        const o = DATA.bag[snap[i]]
        if (!o || o.type !== "enemy") continue
        if (o.lying !== undefined || o.shadowFx) continue
        //E-10: раненые в бегстве/подкрадывании к герою не приближаются — из толпы исключены
        if (o.state === ENEMY_STATE.STUN || o.state === ENEMY_STATE.ATTACK || o.state === ENEMY_STATE.FLEE) continue
        //V57: боссы вне «толпы» (fix «Демон путается и не может подойти к герою»):
        //class.boss (Демон, Лидер гоблинов) и «Босс-паук» (по имени) всегда идут на героя
        //НАПРЯМУЮ — rank −1 отключает им фланг-обход — и не раздувают толпу для других.
        //Физических коллизий враг-враг/враг-объект в движке нет: босс просто идёт через
        //толпу по кратчайшему маршруту
        //V58: боссы определяются флагом class.boss (у всех трёх он есть в data) — без проверок имён
        if (o.class.boss) continue
        const p = rectPos(o.rect)
        //V31: размер окна камеры из viewBox (зависит от зума), не литералы 1920/1080
        if (p[0] < vb.x || p[0] > vb.x + vb.width || p[1] < vb.y || p[1] > vb.y + vb.height) continue
        const ox = p[0] + 16
        const oy = p[1] + 25
        const dd = Math.hypot(ox - mx, oy - my)
        if (o !== enemy && dd > CROWD_R) continue
        crew.push([Math.hypot(ox - hpx, oy - hpy), o.id])
    }
    crew.sort((a, b) => a[0] - b[0] || a[1] - b[1])
    return { size: crew.length, rank: crew.findIndex(c => c[1] === enemy.id) }
}
function flankTargetFor(heroCell, mx, my, wob) {
    if (!ensureFlowField()) return null
    const dist = flowDist
    const n = nav
    const w = flowW
    const hx = heroCell[0]
    const hy = heroCell[1]
    // единичный вектор «герой → я»: точка с dot≈−1 позади героя, ≈0 — сбоку
    const ux0 = mx - (hx * 32 + 16)
    const uy0 = my - (hy * 32 + 25)
    const ulen = Math.hypot(ux0, uy0) || 1
    const ux = ux0 / ulen
    const uy = uy0 / ulen
    let best = null
    let bestS = -Infinity
    for (let dy = -FLANK_SCAN; dy <= FLANK_SCAN; dy++) {
        for (let dx = -FLANK_SCAN; dx <= FLANK_SCAN; dx++) {
            const x = hx + dx
            const y = hy + dy
            if (x < 0 || y < 0 || x >= w || y >= flowH) continue
            if (n[y * w + x] !== 1) continue
            const d = dist[y * w + x]
            if (d < 2 || d > 5) continue // не сама клетка и не дальние подступы
            const len = Math.hypot(dx, dy) || 1
            const dot = (dx / len) * ux + (dy / len) * uy
            const s = -dot + Math.sin(wob + x * 13.7 + y * 7.9) * 0.3
            if (s > bestS) { bestS = s; best = [x, y] }
        }
    }
    return best
}
let bfsSeen = null
let bfsQ = null
// общий BFS-раннер по матрице проходимости: массив узлов ПОСЛЕ стартовой клетки,
// последний узел = to; unreachable/кривые входы → []. bfsPath и bfsPathBoss (E-18)
// никогда не перемешаны в стеке — общий scratch-буфер безопасен
function bfsRun(n, w, h, from, to) {
    if (from[0] === to[0] && from[1] === to[1]) return []
    if (from[0] < 0 || from[1] < 0 || from[0] >= w || from[1] >= h) return []
    if (to[0] < 0 || to[1] < 0 || to[0] >= w || to[1] >= h) return []
    if (status.matrixLevel[from[1]][from[0]] !== 1 || n[to[1] * w + to[0]] !== 1) return []
    const size = w * h
    if (!bfsSeen || bfsSeen.length !== size) bfsSeen = new Int32Array(size)
    if (!bfsQ || bfsQ.length !== size) bfsQ = new Int32Array(size)
    bfsSeen.fill(-1)
    const q = bfsQ
    let head = 0
    let tail = 0
    const si = from[1] * w + from[0]
    const ti = to[1] * w + to[0]
    bfsSeen[si] = -2
    q[tail++] = si
    while (head < tail) {
        const cur = q[head++]
        if (cur === ti) break
        const cx = cur % w
        const cy = (cur / w) | 0
        for (let k = 0; k < 4; k++) {
            const nx = cx + DX[k]
            const ny = cy + DY[k]
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
            const ni = ny * w + nx
            if (n[ni] !== 1) continue
            if (bfsSeen[ni] !== -1) continue
            bfsSeen[ni] = cur
            q[tail++] = ni
        }
    }
    if (bfsSeen[ti] === -1) return []
    const path = []
    let cur = ti
    while (cur !== si && cur >= 0) {
        path.push([cur % w, (cur / w) | 0])
        cur = bfsSeen[cur]
    }
    path.reverse()
    return path
}
// BFS по navMatrix (E-9b: открытые комнаты/коридоры минус закрытые двери) от from до to.
// Стартовая клетка допускается на «сыром» полу (matrix===1) даже вне nav — враг мог быть
// выдавлен расталкиванием в клетку закрытой двери, пути оттуда всё равно должны строиться.
function bfsPath(from, to) {
    const n = ensureNavMatrix()
    if (!n) return []
    return bfsRun(n, navW, navH, from, to)
}

// ---------- boss-карта: весь пол этажа (E-18) ----------
// Обычные враги ходят только по открытому (navMatrix, E-9b), но магия героя бьёт сквозь
// стены: босс в неоткрытой комнате получал урон и молча стоял — путь по navMatrix пуст
// (клетка героя вне поля). Боссам (class.boss) при пустом nav-пути путь строится по
// ВСЕМУ полу этажа (matrixLevel===1). Двери для босса НЕ блокер (он не умеет их
// открывать — иначе в сценарии «магия за закрытой дверью» упирался бы в неё навсегда):
// идёт через проём. Открытие комнат/дверей не влияет — карта от пола не зависит.
let bossNavRef = null
let bossNavVer = -1
let bossNav = null
let bossW = 0
let bossH = 0
function ensureBossMatrix() {
    const matrix = status.matrixLevel
    if (!matrix || !matrix[0]) return null
    const ver = status.navVersion || 0
    if (bossNav && bossNavRef === matrix && bossNavVer === ver) return bossNav
    const h = matrix.length
    const w = matrix[0].length
    const n = new Uint8Array(w * h)
    for (let y = 0; y < h; y++) {
        const row = matrix[y]
        if (!row) continue
        for (let x = 0; x < w; x++) row[x] === 1 && (n[y * w + x] = 1)
    }
    bossNavRef = matrix
    bossNavVer = ver
    bossW = w
    bossH = h
    bossNav = n
    return n
}
function bfsPathBoss(from, to) {
    const n = ensureBossMatrix()
    if (!n) return []
    return bfsRun(n, bossW, bossH, from, to)
}

//V28: путь по flow-field с per-enemy выбором среди РАВНОЦЕННЫХ ветвей.
//BFS от героя даёт dist-поле: строго оптимальный спуск — на соседнюю клетку
//с dist−1; таких соседей часто НЕСКОЛЬКО (параллельные коридоры/проходы комнат).
//Старый код брал единственный precomputed dirs — все враги шли «спрайт-в-спрайт»
//одним маршрутом. Теперь на каждом узле выбираем кандидата по оценке:
//выравнивание на героя + бонус за выбранную сторону (фланг) + стабильный
//псевдослучайный джиттер конкретного врага (_wob). Длина пути не меняется
//(только равные ветви), но траектории разных врагов расходятся.
//Без третьего аргумента (прочие вызовы) поведение совпадает со старым.
//export: используется тестом v28EnemyDiversity.txt для проверки на синтетической карте
export function buildChasePath(enemyCell, heroCell, enemy) {
    if (!ensureFlowField()) return []
    const dist = flowDist
    const n = nav
    const w = flowW
    const flank = enemy ? flankOf(enemy) : 0
    const wob = enemy ? (enemy._wob = enemy._wob ?? Math.random() * 1000) : 0
    let cx = enemyCell[0]
    let cy = enemyCell[1]
    // стартовая клетка недостижима/вне поля — пути нет (как раньше при dirs=255)
    if (dist[cy * w + cx] < 0) return []
    //V28b: толпа — прямой маршрут только у первых двоих по близости к герою (V57: боссы —
    //всегда напрямую, вне квоты); без rect (синтетика тестов) роль не считаем
    if (enemy && enemy.rect && dist[cy * w + cx] > 5) {
        const crowd = crowdRankOf(enemy)
        if (crowd.size >= CROWD_MIN && crowd.rank >= MAX_DIRECT_PER_CROWD) {
            const me = rectPos(enemy.rect)
            const B = flankTargetFor(heroCell, me[0] + 16, me[1] + 25, wob)
            if (B) {
                const fp = bfsPath([cx, cy], B)
                if (fp.length) return fp // иначе падение в прямое поведение
            }
        }
    }
    const path = []
    let guard = 0
    while (guard < 600) {
        const cd = dist[cy * w + cx]
        if (cd <= 0) break // 0 — клетка героя, −1 — недостижимо
        const vx = heroCell[0] - cx
        const vy = heroCell[1] - cy
        let bestK = -1
        let bestS = -Infinity
        for (let k = 0; k < 4; k++) {
            const nx = cx + DX[k]
            const ny = cy + DY[k]
            if (nx < 0 || ny < 0 || nx >= w || ny >= flowH) continue
            if (n[ny * w + nx] !== 1) continue
            if (dist[ny * w + nx] !== cd - 1) continue // только оптимальный спуск
            const dot = vx * DX[k] + vy * DY[k]
            const cross = vx * DY[k] - vy * DX[k]
            let s = dot * 10
            if (flank !== 0 && (cross > 0 ? 1 : cross < 0 ? -1 : 0) === flank) s += 6
            s += Math.sin(wob + guard * 7.13 + k * 3.7) * 2
            if (s > bestS) { bestS = s; bestK = k }
        }
        if (bestK < 0) break
        cx += DX[bestK]
        cy += DY[bestK]
        path.push([cx, cy])
        if (cx === heroCell[0] && cy === heroCell[1]) break
        guard++
    }
    return path
}

// ---------- преследование ----------
export function enemyChase(enemy) {
    if (enemy.type !== "enemy" || enemy.lying !== undefined) return
    // во время анимации стана состояние не трогаем (переход — в checkEndAnim):
    // countDamage станит и сразу зовёт enemyNoticeHero — иначе CHASE затирал бы
    // STUN в том же тике, и анимация урона не проигрывалась вовсе
    if (enemy.state === ENEMY_STATE.STUN) return
    // во время анимации атаки состояние не трогаем (переход — в checkEndAnim)
    if (enemy.state === ENEMY_STATE.ATTACK) return
    const ePos = rectPos(enemy.rect)
    const mx = ePos[0] + 16
    const my = ePos[1] + 25
    //клетка врага — по ЦЕНТРУ rect (x+16, y+25): спрайты спавнятся со смещением −19px
    //по Y, и клетка «по верху» прямоугольника может оказаться стеной/пустотой — путь бы не строился
    const enemyCell = [Math.trunc(mx / 32), Math.trunc(my / 32)]
    const heroCell = [Math.trunc(status.hero.x / 32), Math.trunc(status.hero.y / 32)]
    // враг уже стоит на клетке героя — путь не нужен (атакует с места)
    if (enemyCell[0] === heroCell[0] && enemyCell[1] === heroCell[1]) {
        enemy.called = 0
        enemy.lastSeen = heroCell
        if (enemy.state !== ENEMY_STATE.CHASE) setEnemyState(enemy, ENEMY_STATE.CHASE)
        return
    }
    // герой недостижим по открытому полу (за стеной) — обычный враг остаётся на месте.
    // E-18: боссу путь строится по ВСЕМУ этажу (bfsPathBoss): магия бьёт сквозь стены,
    // и раненый из неоткрытой комнаты босс иначе стоял вечно; повторный урон (и открытие
    // дверей/комнат) пересчитывает путь — погоня возобновляется сама
    let path = buildChasePath(enemyCell, heroCell, enemy)
    if (!path.length && enemy.class && enemy.class.boss === 1) path = bfsPathBoss(enemyCell, heroCell)
    if (!path.length) return
    enemy.lastSeen = heroCell
    enemy.path = path
    enemy.pathTarget = heroCell
    setEnemyState(enemy, ENEMY_STATE.CHASE)
}
// враг заметил героя: эмоция + переход в преследование
export function enemyNoticeHero(enemy) {
    if (enemy.type !== "enemy" || enemy.lying !== undefined) return
    if (!enemy.noticed) {
        enemy.noticed = 1
        spawnEmo(enemy)
    }
    enemyChase(enemy)
}

// ---------- прицел атаки: направление, в котором снаряд РЕАЛЬНО попадёт ----------
// Зоны попадания атаки по 4 направлениям: прямоугольник, который занимает кадр
// снаряда/взмаха из позиции врага (ровно как addAnim ставит спрайт). Для range —
// коридор полёта снаряда по оси dir длиной range*32. Для magic — null (дистанция).
// V16: шаблоны зон прекалкулируются на (атака) и кэшируются — раньше attackZones
// создавала 4 объекта на каждый вызов, а aimMiss вызывалась на каждого воюющего
// врага по нескольку раз за тик (плюс до 4 проб в chaseStep) — постоянный GC-мусор.
const zoneTemplatesCache = new Map()
function zoneTemplatesFor(attack) {
    let list = zoneTemplatesCache.get(attack)
    if (list) return list
    const anims = attack.anims
    list = []
    for (let dir = 0; dir < 4; dir++) {
        const anim = anims[dir] || anims[0]
        const frameW = anim.w / anim.times
        const frameH = anim.h
        let bx = anim.x || 0
        let by = anim.y || 0
        if (attack.range) {
            bx = bx < 0 ? -32 : bx > 0 ? 32 : 0
            by = by < 0 ? -32 : by > 0 ? 32 : 0
        }
        const dx = 16 - frameW / 2 + bx
        const dy = 25 - frameH / 2 + by
        if (attack.range) {
            list.push({
                dx, dy,
                w: dir === 2 || dir === 3 ? frameW + attack.range * 32 : frameW,
                h: dir === 0 || dir === 1 ? frameH + attack.range * 32 : frameH,
                x0: dir === 2 ? -attack.range * 32 : 0,
                y0: dir === 0 ? -attack.range * 32 : 0,
            })
        } else {
            list.push({ dx, dy, w: frameW, h: frameH, x0: 0, y0: 0 })
        }
    }
    zoneTemplatesCache.set(attack, list)
    return list
}
export function enemyAim(enemy, attackId, ex, ey) {
    if (ex === undefined) { let p = rectPos(enemy.rect); ex = p[0]; ey = p[1] }
    const attack = data.attacks[attackId]
    const hx = status.hero.x
    const hy = status.hero.y
    if (attack.type === "magic") {
        // магия летит к цели (moveMagicBullet) — достаточно дистанции range
        return Math.abs(ex - (hx + 16)) + Math.abs(ey - (hy + 35)) < attack.range * 32 ? 0 : null
    }
    const t = zoneTemplatesFor(attack)
    for (let dir = 0; dir < 4; dir++) {
        const z = t[dir]
        if (checkCollision(ex + z.dx + z.x0, hx, z.w, 32, ey + z.dy + z.y0, hy, z.h, 51)) return dir
    }
    return null
}
// «Сколько герою не хватает до зоны попадания» из позиции врага (ex, ey):
// 0 — удар достаёт уже сейчас, иначе — минимальный манхэттенский путь героя до
// зоны хотя бы одного направления; -1 — у врага нет доступных атак (не мешаем).
// есть ли у врага дальняя атака (range-снаряд или магия): дальнобойные встают
// на дистанцию удара, мили-враги подходят вплотную
function hasRangedAttack(enemy) {
    for (let i = 0; i < enemy.class.attacks.length; i++) {
        if (enemy.stats.attacksCd[i] === undefined) continue
        const a = data.attacks[enemy.class.attacks[i]]
        if (a.range || a.type === "magic") return true
    }
    return false
}
function aimMiss(enemy, ex, ey) {
    const attacks = enemy.class.attacks
    const hx = status.hero.x
    const hy = status.hero.y
    let best = Infinity
    let any = false
    for (let i = 0; i < attacks.length; i++) {
        if (enemy.stats.attacksCd[i] === undefined) continue
        any = true
        const attack = data.attacks[attacks[i]]
        if (attack.type === "magic") {
            const range = attack.range * 32
            const m = Math.abs(ex - (hx + 16)) + Math.abs(ey - (hy + 35))
            best = Math.min(best, Math.max(0, m - range))
            continue
        }
        const t = zoneTemplatesFor(attack)
        for (let d = 0; d < t.length; d++) {
            const z = t[d]
            const zx = ex + z.dx + z.x0
            const zy = ey + z.dy + z.y0
            // строгое пересечение, как в checkCollision: касание попаданием не считается
            const mx = Math.max(0, zx - (hx + 32) + 1, hx - (zx + z.w) + 1)
            const my = Math.max(0, zy - (hy + 51) + 1, hy - (zy + z.h) + 1)
            best = Math.min(best, mx + my)
        }
    }
    return any ? best : -1
}
// поза ожидания: у Крысы/Паука others[2] в данных нет (только damage/death) — берём
// move-анимацию, иначе после атаки враг оставался бы на attack-анимации и спамил
// attackNew без кулдауна
export function waitPose(enemy) {
    return enemy.class.anims[2].others[2] || enemy.class.anims[0].move[enemy.direction === undefined ? 2 : enemy.direction]
}

// ---------- атака ----------
// кулдауны атак тикают всегда (в CHASE — внутри enemyTryAttack, в STUN — из enemyTick):
// выйдя из стана, враг бьёт сразу, а не ждёт ещё кулдаун
function tickAttackCd(enemy) {
    const cd = enemy.stats.attacksCd
    for (let i = 0; i < cd.length; i++) {
        if (cd[i] > 0) cd[i]--
    }
}
export function enemyTryAttack(enemy) {
    tickAttackCd(enemy)
    const attacks = enemy.class.attacks
    for (let i = 0; i < attacks.length; i++) {
        //совместимость со спавнами без инициализированных кулдаунов (старые тесты):
        //без записи attacksCd враг не атакует, как раньше (NaN-цикл был «вечным кулдауном»)
        if (enemy.stats.attacksCd[i] === undefined || enemy.stats.attacksCd[i] > 0) continue
        const dir = enemyAim(enemy, attacks[i])
        if (dir !== null) {
            enemy.stats.attacksCd[i] = Math.trunc(data.attacks[attacks[i]].cooldown * 1000 / 16)
            enemy.auraMiss = 1
            setEnemyState(enemy, ENEMY_STATE.ATTACK)
            setEnemyPose(enemy, enemy.class.anims[1].attack[dir])
            status.info.auraReflect && checkReflect(enemy)
            return dir
        }
    }
    return null
}

// ---------- стан ----------
export function enemyStun(enemy) {
    // Исходное проектирование: noStunTime — НЕ длительность стана, а ИММУНИТЕТ —
    // время ПОСЛЕ получения стана, в течение которого повторный стан не действует.
    // Сам стан длится ровно анимацию others[0] (damage). Иммунитет тикает всегда
    // (enemyTick), поэтому в окне noStunTime враг действует и отвечает герою.
    if (enemy.type !== "enemy" || enemy.lying !== undefined || enemy.noStunTime !== 0) return
    enemy.noStunTime = enemy.stats.noStunTime
    setEnemyState(enemy, ENEMY_STATE.STUN)
    setEnemyPose(enemy, enemy.class.anims[2].others[0])
}

// ---------- ярость (stats.rage, напр. «Goba Lider») ----------
// Каждые stats.rage секунд враг на stats.rage/2 секунд «впадает в ярость»:
// спрайт краснеет (tint + красная тень — style.filter применяет pixiBackend;
// до миграции R5 была CSS-строка sepia/saturate/hue-rotate, которую бэкенд молча
// не применял — красное свечение не отображалось), скорость передвижения растёт
// в 1.5 раза с округлением ВВЕРХ (speed 7 → Math.ceil(10.5) = 11).
// Цикл не зависит от состояния (тикает и в STUN/ATTACK — как кулдауны атак);
// первое впадение в ярость — через rage секунд после появления врага, дальше
// каждые rage секунд. У врагов без поля rage механика полностью отключена.
const RAGE_FILTER = "tint(255,86,64) drop-shadow(0 0 7px rgba(255,40,32,0.9))"
function rageFrames(seconds) {
    return Math.max(1, Math.trunc(seconds * 1000 / 16))
}
// эффективная скорость передвижения (учитывает ярость) — только для шагов движения
export function moveSpeed (enemy) {
    //V56: сет «Доблестный небожитель» (2 надетых): элиты и боссы двигаются на 1 медленнее
    //(минимум 1; read-time — действует и на уже заспавненных врагов)
    const base = Math.max(1, enemy.stats.speed - setEliteSpeedMod(enemy))
    return enemy.rageActive ? Math.ceil(base * 1.5) : base
}
// бюджет шага на тик (px) — УНИВЕРСАЛЬНЫЙ темп движения без потолка.
// Старая формула status.time % Math.trunc(12/speed) задумывалась как «speed пикселей
// за 12 тиков», но Math.trunc обнулял разницу: уже при speed 7 интервал становился 1,
// и ВСЕ быстрые враги (7, 8, 10…) ходили с одинаковой максимальной скоростью.
// Теперь шкала линейна: скорость → speed/12 px за тик, дробные пиксели копятся
// в enemy.stepAcc. Темпы скоростей 1,2,3,4,6 совпадают со старыми точно (пятёрки
// в данных нет), скорости 7+ впервые реально различаются. Ярость НЕ имеет отдельного
// расчёта движения: она просто повышает значение скорости (moveSpeed), темп растёт
// автоматически (7 → ceil(10.5)=11 даёт ×1.57 пикселей за тик).
export function stepBudget (enemy) {
    const acc = (enemy.stepAcc || 0) + moveSpeed(enemy) / 12
    const whole = Math.floor(acc)
    enemy.stepAcc = acc - whole
    return whole
}
function startRage (enemy) {
    enemy.rageActive = 1
    enemy.img.style.filter = RAGE_FILTER
}
function endRage (enemy) {
    enemy.rageActive = 0
    enemy.img.style.filter = ""
}
export function tickRage (enemy) {
    const rage = enemy.stats.rage
    if (!rage) return
    const period = rageFrames(rage)      // кадры полного цикла: ярость каждые rage секунд
    const dur = rageFrames(rage / 2)     // кадры самого состояния ярости (rage/2 секунд)
    if (enemy.rageAge === undefined) enemy.rageAge = 0
    enemy.rageAge++
    // окна ярости: age period+1..period+dur, затем каждые period кадров
    const raging = enemy.rageAge > period && (enemy.rageAge - period) % period < dur
    if (raging && !enemy.rageActive) startRage(enemy)
    else if (!raging && enemy.rageActive) endRage(enemy)
}

// ---------- неуязвимость (stats.invulnerability, «Циклоп Пустоты») ----------
// V79: каждые stats.invulnerability секунд босс на invulnerability/2 секунд (16 → 8с)
// становится неуязвим к ЛЮБОМУ урону: приёмники урона проверяют флаг enemy.invulnActive
// (countDamage/damageEnemy/createSplash/relicReflect/яд/штыри/«гаечка»/ожог — только урон,
// стан/отбрасывание/холода проходят как обычно, решение пользователя). Спрайт чернеет —
// INVULN_FILTER, тот же механизм что у фильтра ярости (CSS на img, переживает смену поз,
// пул спрайтов сбрасывает фильтр при переиспользовании), но чёрный силуэт со светлой
// окантовкой, чтобы читался на тёмном полу. В окне босс не двигается (gate в enemyTick),
// но продолжает атаковать и выпускает двойные Сгустки (voidBoss.js). Цикл зеркалит ярость:
// якорь — появление врага, тикает в любом состоянии; у врагов без поля invulnerability
// механика полностью отключена.
const INVULN_FILTER = "brightness(0) drop-shadow(0 0 6px rgba(255,255,255,0.6))"
function invulnFrames(seconds) {
    return Math.max(1, Math.trunc(seconds * 1000 / 16))
}
function startInvuln (enemy) {
    enemy.invulnActive = 1
    enemy.img.style.filter = INVULN_FILTER
}
function endInvuln (enemy) {
    enemy.invulnActive = 0
    enemy.img.style.filter = ""
}
function tickInvuln (enemy) {
    const inv = enemy.stats.invulnerability
    if (!inv) return
    const period = invulnFrames(inv)     // кадры полного цикла: окно каждые inv секунд
    const dur = invulnFrames(inv / 2)    // кадры самой неуязвимости (16 → 8 секунд)
    if (enemy.invulnAge === undefined) enemy.invulnAge = 0
    enemy.invulnAge++
    // окно неуязвимости: age period+1..period+dur, затем каждые period кадров
    const shielded = enemy.invulnAge > period && (enemy.invulnAge - period) % period < dur
    if (shielded && !enemy.invulnActive) startInvuln(enemy)
    else if (!shielded && enemy.invulnActive) endInvuln(enemy)
}

// ---------- тень (stats.shadow, «Тёмный воин») ----------
// Каждые stats.shadow секунд враг «ныряет в тень» и всплывает рядом с героем.
// Хореография: под спрайтом на полу появляется чёрная непрозрачная лужа
// (shadowPool.png, z-порядок — ПОД спрайтом врага), спрайт уезжает ВНИЗ сквозь
// маску окна кадра (двигается ТОЛЬКО img.y: animPlay пишет лишь img.x — прокрутку
// листа, окно кадра и кэш rectPos фаза не трогает), лужа исчезает; логическая
// позиция меняется ОДИН раз между фазами через spritePos (он же честно двигает
// окно кадра); у героя на свободной клетке появляется новая лужа, из которой
// спрайт поднимается СНИЗУ ВВЕРХ. Пока идут фазы, ИИ врага заморожен
// (early-return в enemyTick). Если герой уже ближе SHADOW_MIN_DIST клеток —
// цикл пропускается и перезапустится через shadow секунд. Вне камеры враг не
// тикает — фаза замирает (как всё движение в игре). У врагов без поля shadow
// механика полностью отключена.
const SHADOW_POOL_SRC = "./images/effects/shadowPool.png"
const SHADOW_POOL_W = 30
const SHADOW_POOL_H = 12
const SHADOW_PHASE_TICKS = Math.trunc(700 / 16)   // ~0.7с на погружение и столько же на всплытие
const SHADOW_MIN_DIST = 2                          // клетки (чебышёв): ближе героя не мигаем

function shadowSecondsFrames(seconds) {
    return Math.max(1, Math.trunc(seconds * 1000 / 16))
}
function enemyCellOf(enemy) {
    const p = rectPos(enemy.rect)
    return [Math.trunc((p[0] + 16) / 32), Math.trunc((p[1] + 25) / 32)]
}
// лужа тени НА ПОЛУ, строго под ногами: центр — линия нижней кромки окна кадра
// (в неё «проваливается» спрайт при погружении) + 2px — читается как тень у ног
function spawnShadowPool(enemy, wx, wy) {
    const fh = enemy.rect.height.animVal.value
    const pool = image(enemy.img.parentNode, wx - SHADOW_POOL_W / 2 + 16, wy + fh - SHADOW_POOL_H / 2 + 2,
        SHADOW_POOL_W, SHADOW_POOL_H, SHADOW_POOL_SRC, { times: 1 })
    // z-порядок: лужа под спрайтом врага (но над полом)
    enemy.img.parentNode.insertBefore(pool, enemy.img)
    return pool
}
// свободная клетка рядом с героем: периметр кольца r=2, иначе r=3;
// требования — проходимость, не клетка героя, без других живых врагов
function pickShadowLanding(enemy) {
    const heroCell = [Math.trunc(status.hero.x / 32), Math.trunc(status.hero.y / 32)]
    const matrix = status.matrixLevel
    const walkable = (cx, cy) => !!(matrix && matrix[cy] && matrix[cy][cx] === 1)
    const taken = new Set()
    //E-3: перебор врагов из группы genemy (маркер на спавне); фильтр type — 1:1
    const gE = world.queries.genemy && world.queries.genemy.entities
    if (gE) for (let i = 0; i < gE.length; i++) {
        const o = DATA.bag[gE[i]]
        if (!o || o === enemy || o.type !== "enemy" || o.lying !== undefined) continue
        const c = enemyCellOf(o)
        taken.add(c[0] + "," + c[1])
    }
    for (const r of [SHADOW_MIN_DIST, SHADOW_MIN_DIST + 1]) {
        const spots = []
        for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
                if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue   // только периметр кольца
                const cx = heroCell[0] + dx
                const cy = heroCell[1] + dy
                if (!walkable(cx, cy)) continue
                if (taken.has(cx + "," + cy)) continue
                spots.push([cx, cy])
            }
        }
        if (spots.length) return spots[Math.floor(Math.random() * spots.length)]
    }
    return null
}
function startShadowDive(enemy, targetCell) {
    const pos = rectPos(enemy.rect)
    const eCell = enemyCellOf(enemy)
    enemy.shadowFx = {
        phase: 0, t: 0, dur: SHADOW_PHASE_TICKS,
        baseX: pos[0], baseY: pos[1],
        // логическую позицию меняем смещением на целое число клеток — стартовые
        // оффсинты спрайта внутри клетки сохраняются точно
        toX: pos[0] + (targetCell[0] - eCell[0]) * 32,
        toY: pos[1] + (targetCell[1] - eCell[1]) * 32,
        frameH: enemy.rect.height.animVal.value,
        pool: spawnShadowPool(enemy, pos[0], pos[1])
    }
}
// прерывание хореографии (смерть/воскрешение): убрать лужу, вернуть спрайт в окно
function cancelShadowFx(enemy) {
    const fx = enemy.shadowFx
    if (!fx) return
    fx.pool && releaseSprite(fx.pool)
    const p = rectPos(enemy.rect)
    enemy.img.setAttribute("y", p[1])
    enemy.img._hidden = 0
    enemy.shadowFx = null
}
function stepShadowFx(enemy) {
    const fx = enemy.shadowFx
    if (enemy.type !== "enemy") { cancelShadowFx(enemy); return }
    fx.t++
    const k = Math.min(1, fx.t / fx.dur)
    if (fx.phase === 0) {
        // E-22: у ECS-сущностей узел каждый кадр позиционирует ecsRenderSync из
        // компонентов — прежняя хореография «уезжает img.y вниз» спрайт не двигала
        // (враг 0.7с стоял на месте и затем мигал на новой клетке). Погружение
        // честно прячем флагом _hidden (renderSync гасит видимость): лужа под
        // врагом — враг «ушёл под пол»
        enemy.img._hidden = 1
        if (k >= 1) {
            releaseSprite(fx.pool)
            fx.pool = null
            // единственная перестановка логики: spritePos честно двигает окно кадра (rect)
            spritePos(enemy.img, fx.toX, fx.toY)
            // спрайт остаётся скрытым до конца всплытия (второй фазы)
            enemy.path = []
            enemy.pathTarget = null
            enemy.lastSeen = null
            enemy.patrol = null
            fx.phase = 1
            fx.t = 0
            fx.pool = spawnShadowPool(enemy, fx.toX, fx.toY)
        }
        return
    }
    // всплытие: спрайт скрыт, у целевой клетки растёт вторая лужа; в конце фазы —
    // показ (renderSync вернёт видимость, как только _hidden будет снят)
    if (k >= 1) {
        enemy.img._hidden = 0
        releaseSprite(fx.pool)
        enemy.shadowFx = null
        checkZOrder(enemy)
    }
}
// периодический триггер способности; вызывается из enemyTick вне ATTACK/STUN/DOWN
function tickShadow (enemy) {
    const s = enemy.stats.shadow
    if (!s || enemy.shadowFx) return
    if (enemy.shadowAge === undefined) enemy.shadowAge = 0
    enemy.shadowAge++
    if (enemy.shadowAge < shadowSecondsFrames(s)) return
    enemy.shadowAge = 0
    // герой вплотную — мигать незачем
    const eCell = enemyCellOf(enemy)
    const hCell = [Math.trunc(status.hero.x / 32), Math.trunc(status.hero.y / 32)]
    if (Math.max(Math.abs(eCell[0] - hCell[0]), Math.abs(eCell[1] - hCell[1])) < SHADOW_MIN_DIST) return
    const spot = pickShadowLanding(enemy)
    if (!spot) return
    startShadowDive(enemy, spot)
}

// ---------- смерть (общий блок трупа для всех источников урона) ----------
//V56: кучка золота сета «Победитель турниров» — тот же рецепт дропа, что у ключа элит
//(dropKey в damage.js): спрайт на слое объектов + очередь подбора dropArr
function spawnGoldPile(x, y, w=64, h=64) {
    let drop = {"w":28,"h":32,"img":"./images/dungeon/drop/gold.png"}
    screenPic.push(worldImage(svgArr[1],x + 16,y + 55,drop.w,drop.h,drop.img,{"id":screenPic.length-1}))
    //V103: полёт из центра спрайта врага (w/h передаёт вызов — размеры rect врага)
    let el = screenPic[screenPic.length - 1]
    placeDrop(el,x + 16,y + 55,drop.w,drop.h)
    dropFly(el, x + w/2, y + h/2)
    //V75: Золотое эхо — шанс доп. кучки золота рядом
    blessEcho(drop,x + 16,y + 55)
}
export function enemyDie(enemy, exp) {
    if (enemy.type !== "enemy") return
    !status.meta.killedEnemes[enemy.class.id] && (status.meta.killedEnemes[enemy.class.id] = 0)
    status.meta.killedEnemes[enemy.class.id]++
    //V36: зачёт библиотеки живёт между забегами — killedEnemes (забегный счётчик опыта) сбрасывается
    //на экране выбора предметов (metaItems), library не сбрасывается никогда
    Array.isArray(status.meta.library) || (status.meta.library = new Array(21).fill(0))
    status.meta.library[enemy.class.id] = 1
    enemy.type = "corpse"
    //V52: «Массовик-затейник» — смерть врага в окно ~0.5с «одной атаки»
    achKill()
    //мёртвый враг не должен остаться красным (ярость)
    endRage(enemy)
    enemy.rageAge = undefined
    //V79: и чёрным (неуязвимость; урон в окне заблокирован, сброс — на крайний случай)
    endInvuln(enemy)
    enemy.invulnAge = undefined
    //прервать хореографию тени, если враг убили во время нырка/всплытия
    cancelShadowFx(enemy)
    enemy.shadowAge = undefined
    //V80: тень остаётся под трупом (решение пользователя) — кладём её ПОД спрайт трупа:
    //prepend тени, затем prepend спрайта => порядок [тень, труп, ...]
    enemy.entShadow && svgArr[1].prepend(enemy.entShadow)
    playback(strike[9].vol, 0, 0, status.settings.soundVolume)
    svgArr[1].prepend(enemy.img)
    //V103: размеры rect врага — для вылета кучки из центра спрайта (dropSafe.dropFly)
    enemy.class.elite === 1 && dropKey(enemy.rect.x.animVal.value, enemy.rect.y.animVal.value, enemy.rect._w, enemy.rect._h)
    //V56: сет «Победитель турниров» (6 надетых): 1% шанс кучки золота на месте убитого
    //(любого врага, включая элит и боссов); рецепты дропа — те же, что у ключа элит
    rollGoldKillPile(enemy) && spawnGoldPile(enemy.rect.x.animVal.value, enemy.rect.y.animVal.value, enemy.rect._w, enemy.rect._h)
    let gain = exp !== undefined ? exp : enemy.stats.exp
    //V46 аудит доп. статов: «Обучаемость» — шанс двойного опыта = countLog% из value2
    //напрямую; раньше лишнее «/100» при πцелочисленном Math.trunc(random*100) прижимало
    //шанс к константному ~1% (0% при 0–2 очках) независимо от прокачки
    Math.trunc(Math.random() * 100) < parseInt(status.info.stats[4].dops[1].value2.slice(0, -1)) && (gain *= 2)
    status.info.exp += gain
    //V37 журнал: жёлтая строка — убийство врага и полученный опыт (фактический gain)
    journalAdd(T("journ.kill",T(enemy.class.name),gain), J_YELLOW)
    //V38: способность «вой» (stats.howl) — смерть хаунда создаёт зону-бафф (строка воя в журнале)
    howlDie(enemy)
    //V64: убийство монстра арены (по room находим арену; 9/9 — появляется рычаг арены)
    portalArenaKill(enemy)
    //V109: хуки квеста «Голос в портале» — дроп части посоха у помеченного врага /
    //победа над культистом (кучка реликвии + отметка в мете)
    portalQuestEnemyDie(enemy)
    checkExp(gain)
    enemy.stop = 0
    enemy.currentStill = 0
    setEnemyPose(enemy, enemy.class.anims[2].others[1])
    enemy.class.boss === 1 && (status.info.bossKill = 1)
    //V90: полоса ХП босса (правый верхний угол) снимается смертью владельца
    //(Медуза — с гибелью последнего живого осколка; логика в hpBar.js)
    bossBarOwnerDied(enemy)
    //V65: Циклоп Пустоты (4 этаж, stats.voidBlob) — смерть босса сразу запускает
    //стандартное завершение этажа: комикс концовки → экран очков (объекта «спуск» нет)
    enemy.stats.voidBlob && voidBossFinale()
    //V85: Медуза пустоты (id 26) — дроп и выход только с гибелью ПОСЛЕДНЕГО осколка;
    //сами деления смертью не считаются (осколки спавнит medusaSplitTick до ХП ≤ 0)
    enemy.class.id === 26 && medusaPieceDied(enemy) && voidBossFinale(enemy)
    //V91: Гриб пустоты (id 27) — финал по смерти БОССА; мини-грибы из спор — клоны
    //без тега boss, этаж не завершают (споры гасятся внутри voidBossFinale)
    enemy.class.id === 27 && enemy.class.boss === 1 && voidBossFinale(enemy)
}

// ---------- воскрешение Mummy (reanimate) ----------
function reviveEnemy(enemy) {
    enemy.lying = undefined
    enemy.stats.hp = Math.trunc(enemy.class.stats.hp * enemy.stats.reanimate)
    enemy.stats.hp < 1 && (enemy.stats.hp = 1)
    enemy.path = []
    enemy.pathTarget = null
    enemy.lastSeen = null
    enemy.patrol = null
    enemy.noticed = 0
    enemy.called = 0
    enemy.noStunTime = 0
    //сброс ярости: воскрешённый начинает цикл заново, без красного тона
    enemy.rageAge = undefined
    endRage(enemy)
    //сброс цикла тени
    cancelShadowFx(enemy)
    enemy.shadowAge = undefined
    idlePose(enemy)
}

// ---------- урон врагу (путь валькирии/отражения — был в attackEnemy.js) ----------
export function damageEnemy(enemy, damage) {
    //V79: неуязвимость (Циклоп, invulnActive) — прямой канал урона (валькирия/отражения) закрыт
    if (enemy.invulnActive) return
    const x = enemy.rect.x.animVal.value + enemy.rect.width.animVal.value / 2
    const y = enemy.rect.y.animVal.value + enemy.rect.height.animVal.value / 2
    enemy.stats.hp -= damage
    enemy.stats.call && callAllies(enemy)
    enemy.class.boss === 1 && changeBossHP(document.getElementById("hpBossBarI"), document.getElementById("hpBossText"))
    if (enemy.class.id === 11) {
        !status.spiderBossFight && (status.spiderBossFight = 0)
        status.spiderBossFight += damage
    }
    floatText(x, y, damage, "white", "12px", "none")
    enemy.class.effects.takeDamage && playEffect(enemy, data.effects[enemy.class.effects.takeDamage])
    if (enemy.stats.hp <= 0 && !reanimateCheck(enemy)) {
        enemyDie(enemy)
    }
}
// отражение атаки аурой-щитом героя
function checkReflect(enemy) {
    const r = enemy.rect
    const x1 = r.x.animVal.value
    const y1 = r.y.animVal.value
    const w1 = r.width.animVal.value
    const h1 = r.height.animVal.value
    const x2 = status.info.auraReflect.x.animVal.value
    const y2 = status.info.auraReflect.y.animVal.value
    const w2 = status.info.auraReflect.width.animVal.value
    const h2 = status.info.auraReflect.height.animVal.value
    if (checkCollision(x1, x2, w1, w2, y1, y2, h1, h2)) {
        const damageReflect = status.info.reflect + Math.trunc(status.info.stats[2].dops[1].value1 / 10)
        damageEnemy(enemy, damageReflect)
        if (status.info.energyShot) {
            status.info.energyShotCharge === 0 ? status.info.energyShotCharge = 1 :
            status.info.energyShotCharge === 1 ? status.info.energyShotCharge = 2 :
            status.info.energyShotCharge === 2 ? status.info.energyShotCharge = 4 :
            status.info.energyShotCharge === 4 ? status.info.energyShotCharge = 8 : false
        }
    }
}

// ---------- «call» (стата Goba): урон от игрока — оповещение соседей ----------
export function callAllies(enemy) {
    const call = enemy.stats.call
    if (!call) return
    const range = call * 32
    const cx = enemy.rect.x.animVal.value + enemy.rect.width.animVal.value / 2
    const cy = enemy.rect.y.animVal.value + enemy.rect.height.animVal.value / 2
    //E-3: перебор врагов из группы genemy (маркер на спавне); фильтр type — 1:1
    const gE = world.queries.genemy && world.queries.genemy.entities
    if (!gE) return
    const snap = gE.slice()
    for (let i = 0; i < snap.length; i++) {
        const o = DATA.bag[snap[i]]
        if (!o || o === enemy || o.type !== "enemy") continue
        const ox = o.rect.x.animVal.value + o.rect.width.animVal.value / 2
        const oy = o.rect.y.animVal.value + o.rect.height.animVal.value / 2
        if ((cx - ox) * (cx - ox) + (cy - oy) * (cy - oy) <= range * range) {
            o.called = 1
            enemyNoticeHero(o)
        }
    }
}

// ---------- патруль ----------
// E-9: путь строится общим bfsPath по navMatrix — враг может вернуться в свою комнату
// из чужого конца этажа через открытые коридоры. Прежний комнатный A* (astar.js,
// библиотека pathfinding.js) снесён: один поисковый движок на все режимы ИИ.
// Цели патруля — клетки enemy.cells (свободные клетки своей комнаты), как раньше.
function patrolPathTo(enemy, cell) {
    const cur = [Math.trunc((enemy.rect.x.animVal.value + 16) / 32), Math.trunc((enemy.rect.y.animVal.value + 25) / 32)]
    return bfsPath(cur, cell)
}
// случайная достижимая точка комнаты (не текущая клетка; пустой путь исключён)
function pickPatrolTarget(enemy) {
    if (!enemy.room || !enemy.cells || !enemy.cells.length) return null
    //текущая клетка — по ногам врага (как в enemyChase)
    const cur = [Math.trunc((enemy.rect.x.animVal.value + 16) / 32), Math.trunc((enemy.rect.y.animVal.value + 25) / 32)]
    for (let tries = 0; tries < 8; tries++) {
        const c = enemy.cells[Math.trunc(Math.random() * enemy.cells.length)]
        if (c[0] === cur[0] && c[1] === cur[1]) continue
        const path = patrolPathTo(enemy, c)
        if (path.length) return { cell: c, path }
    }
    return null
}
function startPatrolWander(enemy) {
    const t = pickPatrolTarget(enemy)
    if (t) {
        enemy.patrol = t.cell
        enemy.path = t.path
        setEnemyState(enemy, ENEMY_STATE.PATROL_WANDER)
    } else {
        idlePose(enemy)
    }
}
function startPatrolLoop(enemy) {
    if (!enemy.patrol) {
        const t = pickPatrolTarget(enemy)
        if (!t) {
            idlePose(enemy)
            return
        }
        enemy.patrol = { from: [enemy.xCell, enemy.yCell], to: t.cell }
        enemy.path = t.path
        setEnemyState(enemy, ENEMY_STATE.PATROL_LOOP)
    } else {
        // дошли до конца — разворачиваем маятник
        const tmp = enemy.patrol.from
        enemy.patrol.from = enemy.patrol.to
        enemy.patrol.to = tmp
        const path = patrolPathTo(enemy, enemy.patrol.to)
        if (!path.length) {
            enemy.patrol = null
            idlePose(enemy)
            return
        }
        enemy.path = path
        setEnemyState(enemy, ENEMY_STATE.PATROL_LOOP)
    }
}

// ---------- преследование ----------
// E-9: путь живёт до конечной клетки. Пока путь есть — идём по нему БЕЗ пересчёта:
// ни смена клетки героя, ни прицельные манёвры путь не перестраивают. Пересчёт —
// когда пути нет (старт преследования), когда он исчерпан (конечная клетка; дальше
// onPathEnd → enemyChase), после конца анимации атаки/стана (checkEndAnim → enemyChase)
// и после PATH_HERO_MOVES смен клетки героя (живой путь перечитывается). Неудачная
// постройка (герой в закрытом регионе за порталом) ретраится раз в PATH_RETRY_TICKS.
// Прямые шаги по осям снесены (E-9): у тонкой стенки враг «пилил», тыкался по осям
// и не находил длинный окружной путь — теперь движение всегда по пути через весь
// открытый этаж (navMatrix), а прицельное позиционирование (блок ниже) — часть
// атаки и тикает каждый тик, путь не трогает.
function chaseStep(enemy) {
    if (enemyOnTrail(enemy) && status.time % 5 === 0) return
    if (enemy.cold) {
        enemy.cold--
        return
    }
    if (enemy.stop === 1) return
    const sees = enemySeesHero(enemy)
    let tx, ty
    if (sees || enemy.called) {
        //цель — живая позиция героя; запоминаем клетку как «последнюю известную».
        //E-9: попутно считаем смены клетки героя с момента постройки живого пути —
        //их счётчик решает, не пора ли перечитать путь (PATH_HERO_MOVES)
        const hcNow = [Math.trunc(status.hero.x / 32), Math.trunc(status.hero.y / 32)]
        if (enemy._lastHeroCell && (enemy._lastHeroCell[0] !== hcNow[0] || enemy._lastHeroCell[1] !== hcNow[1])) {
            enemy._heroCellMoves = (enemy._heroCellMoves || 0) + 1
        }
        enemy._lastHeroCell = hcNow
        enemy.lastSeen = hcNow
        tx = status.hero.x + 16
        ty = status.hero.y + 25
    } else if (enemy.lastSeen) {
        //герой потерян — идём к последней известной клетке
        tx = enemy.lastSeen[0] * 32 + 16
        ty = enemy.lastSeen[1] * 32 + 25
    } else {
        startPatrolWander(enemy)
        return
    }
    const ePos = rectPos(enemy.rect)
    const mx = ePos[0] + 16
    const my = ePos[1] + 25
    const dx = tx - mx
    const dy = ty - my
    const nav = ensureNavMatrix()
    const walkable = (cx, cy) => !!(nav && nav[cy * navW + cx] === 1)
    // герой потерян: дошли до последней известной клетки — блуждаем
    if (!sees && !enemy.called && Math.abs(dx) < 8 && Math.abs(dy) < 8) {
        enemy.noticed = 0
        startPatrolWander(enemy)
        return
    }
    // герой видим: цель движения — позиция, с которой атака РЕАЛЬНО достаёт героя.
    // Уже достаёт — стоим (enemyTryAttack бьёт по кулдауну КАЖДЫЙ тик из enemyTick,
    // до chaseStep — проверка атаки чаще, чем движение). Не достаёт — шагаем туда,
    // где герою до зоны попадания ближе всего. Для длинного оружия (копьё Тёмного
    // воина) в упор это шаг НАЗАД — иначе враг навсегда застревал вплотную к герою
    // без возможности ударить и стоял, пока герой не сдвинется.
    if (sees || enemy.called) {
        const ex = mx - 16
        const ey = my - 25
        const ranged = hasRangedAttack(enemy)
        const miss0 = aimMiss(enemy, ex, ey)
        const close = Math.abs(dx) < 40 && Math.abs(dy) < 40
        // стоим, когда удар уже достаёт: дальнобойные — с любой дистанции,
        // мили — только вплотную (иначе мили-враг застревал бы на краю зоны
        // взмаха с касанием в 1px вместо того, чтобы подойти)
        if (miss0 === 0 && (ranged || close)) return
        // удар не достаёт: дальнобойные выравниваются с любой дистанции, мили
        // вплотную (длинное оружие — копьё) отшагивают в позицию попадания
        if (miss0 > 0 && (ranged || close)) {
            let best = null
            const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]]
            for (let k = 0; k < 4; k++) {
                const sx = dirs[k][0]
                const sy = dirs[k][1]
                const nx = Math.trunc((mx + sx * 16) / 32)
                const ny = Math.trunc((my + sy * 16) / 32)
                if (!walkable(nx, ny)) continue
                const m = aimMiss(enemy, ex + sx, ey + sy)
                if (m < 0) break // доступных атак нет — обычное сближение
                if (m < miss0 && (!best || m < best.miss)) best = { sx, sy, miss: m }
            }
            if (best) {
                const mv = stepBudget(enemy)
                for (let s = 0; s < mv; s++) shiftEnemy(enemy, best.sx, best.sy)
                setMovePose(enemy, best.sx > 0 ? 3 : best.sx < 0 ? 2 : best.sy > 0 ? 1 : 0)
                ;(enemy.class.id === 6 || enemy.class.id === 13) && checkRat(enemy)
                checkZOrder(enemy)
                return
            }
        }
    }
    // E-9: путь живёт до конечной клетки, но не дольше PATH_HERO_MOVES смен клетки
    // героя — заметно ушедшего героя враг перечитывает, не доходя до конца пути
    if (enemy.path && enemy.path.length && (enemy._heroCellMoves || 0) >= PATH_HERO_MOVES) {
        enemy.path = []
        enemy.pathTarget = null
    }
    // E-9: путь строится ТОЛЬКО когда активного пути нет (старт преследования или
    // конечная клетка предыдущего). Живой путь не перестраивается при движении героя.
    // Неудачная постройка: первая — пауза PATH_RETRY_TICKS (враг караулит у закрытой
    // двери, героя видит сквозь неё), повторная — героя нет в достижимой зоне
    // (регион за порталом), обычный патруль.
    if (!enemy.path || !enemy.path.length) {
        const retry = enemy.pathFail !== undefined && status.time - enemy.pathFail >= PATH_RETRY_TICKS
        if (enemy.pathFail !== undefined && !retry) return
        const goal = [Math.trunc(tx / 32), Math.trunc(ty / 32)]
        const start = [Math.trunc(mx / 32), Math.trunc(my / 32)]
        enemy.path = buildChasePath(start, goal, enemy)
        if (enemy.path.length) {
            enemy.pathFail = undefined
            enemy.pathTarget = goal
            enemy._heroCellMoves = 0
        } else if (retry) {
            enemy.noticed = 0
            enemy.pathFail = undefined
            startPatrolWander(enemy)
            return
        } else {
            enemy.pathFail = status.time
            return
        }
    }
    stepAlongPath(enemy)
}

// ---------- шаг по пути (1px/тик с частотой 12/speed) ----------
function stepAlongPath(enemy) {
    if (enemyOnTrail(enemy) && status.time % 5 === 0) return // вихревой след валькирии: −20%
    if (enemy.cold) {
        enemy.cold--
        return
    }
    if (enemy.stop === 1) return
    if (!enemy.path || !enemy.path.length) return
    const rect = enemy.rect
    const sPos = rectPos(rect)
    const x = sPos[0]
    const y = sPos[1]
    const [px, py] = enemy.path[0]
    const tx = px * 32
    const ty = py * 32
    if (x === tx && y === ty) {
        // пришли на клетку пути
        (enemy.class.id === 6 || enemy.class.id === 13) && checkRat(enemy)
        enemy.path.shift()
        if (!enemy.path.length) onPathEnd(enemy)
        checkZOrder(enemy)
        return
    }
    //сколько пикселей идти в этом тике (0 — нет шага); в ярости — дробный бюджет
    const mv = stepBudget(enemy)
    if (!mv) return
    const dxs = x < tx ? 1 : x > tx ? -1 : 0
    const dys = dxs === 0 ? (y < ty ? 1 : y > ty ? -1 : 0) : 0
    //шаг строго ДО центра клетки пути: много-пиксельные шаги ярости иначе проскакивают
    //центр (x уже никогда не сравняется с tx — вечное «дрожание» вокруг клетки)
    const dist = Math.abs(tx - x) + Math.abs(ty - y)
    const applied = Math.min(mv, dist)
    for (let s = 0; s < applied; s++) shiftEnemy(enemy, dxs, dys)
    setMovePose(enemy, dxs > 0 ? 3 : dxs < 0 ? 2 : dys > 0 ? 1 : 0)
    if (applied >= dist) {
        //центр клетки достигнут — узел пути потребляется этим же тиком
        (enemy.class.id === 6 || enemy.class.id === 13) && checkRat(enemy)
        enemy.path.shift()
        if (!enemy.path.length) onPathEnd(enemy)
    }
    checkZOrder(enemy)
}
function shiftEnemy(enemy, dx, dy) {
    moveSprite(enemy.img, dx, dy)
}
function setMovePose(enemy, dir) {
    if (enemy.currentAnim !== enemy.class.anims[0].move[dir]) {
        setEnemyPose(enemy, enemy.class.anims[0].move[dir])
        enemy.direction = dir
    }
}
function onPathEnd(enemy) {
    if (enemy.type !== "enemy") return
    if (enemy.state === ENEMY_STATE.CHASE) {
        if (enemySeesHero(enemy) || enemy.called) enemyChase(enemy)
        else {
            // дошли до последней известной клетки героя, его там нет — блуждаем
            enemy.noticed = 0
            startPatrolWander(enemy)
        }
    } else if (enemy.state === ENEMY_STATE.FLEE) {
        // E-10: добежал (фаза flee) — теперь подкрадывание; дошёл до точки захода —
        // ищем новую точку (fleeTick перестраивает путь по текущей фазе)
        //E-22: дальнобойные подкрадывание не берут (ТЗ E-10 «только отходят») —
        //держат фазу бегства, иначе byPathEnd уводил их к герою
        enemy.fleePhase = rangedKeepDist(enemy) > 0 ? "flee" : "sneak"
    } else if (enemy.state === ENEMY_STATE.PATROL_WANDER) {
        startPatrolWander(enemy)
    } else if (enemy.state === ENEMY_STATE.PATROL_LOOP) {
        startPatrolLoop(enemy)
    }
}

// ---------- E-10: раненые враги — бегство и подкрадывание ----------
// Враг с ХП ≤ 25% от ХП на спавне (не босс) переключается в FLEE и живёт циклом:
// фаза "flee" — убегает от героя (BFS к клетке с большей flow-дистанцией от него);
// фаза "sneak" — подкрадывается «со спины»/«сбоку»: цель — клетка вокруг героя,
// максимально противоположная вектору подхода, с штрафом SNEAK_HOT за «горячие»
// клетки — линию огня «герой → другой враг» (ось, до соседа и 2 клетки перелёта)
// и сектор перед героем по его взгляду. Дойдя, атакует как обычно (проверка атаки
// каждый тик), после атаки checkEndAnim возвращает CHASE — раненый снова в FLEE:
// получается «hit-and-run». Дальнобойные (rangedKeepDist > 0) не подкрадываются —
// только отходят, когда герой ближе дистанции стрельбы, и снова стреляют, когда
// дистанция удержана. Боссы (class.boss) не ранятся этим никогда — всегда напролом.
const WOUNDED_HP = 0.25        // порог «раненый» — доля ХП от ХП на спавне
const FLEE_MAX_DEPTH = 64      // предел BFS бегства (клеток)
const SNEAK_SCAN = 6           // окно поиска точки подкрадывания вокруг героя (клетки)
const SNEAK_MIN_D = 2          // ближе героя не подкрадываемся (клетки, чебышёв)
const SNEAK_MAX_D = 5
const SNEAK_HOT = 4            // штраф клетки в зоне возможной атаки героя
// 0 вверх, 1 вниз, 2 влево, 3 вправо — та же конвенция, что у setMovePose/status.hero.direction
const DIRV = [[0, -1], [0, 1], [-1, 0], [1, 0]]
// ранен ли враг; _maxHp снимается лениво на первом тике (ХП на спавне, до первого урона)
function isWounded(enemy) {
    if (enemy.class.boss) return false
    if (enemy._maxHp === undefined) enemy._maxHp = enemy.stats.hp
    return enemy.stats.hp > 0 && enemy.stats.hp <= enemy._maxHp * WOUNDED_HP
}
// дистанция удержания огня (клетки): максимум range среди ДОСТУПНЫХ дальнобойных атак;
// 0 — милишник (подкрадывается). Доступность — по наличию attacksCd (как в hasRangedAttack).
// _keepMetric — метрика той же атаки: снаряды летят по осям и бьют зоной (чебышёв),
// магия летит к цели и меряется манхэттеном (enemyAim) — метрика удержания обязана
// совпадать с метрикой реальной досягаемости, иначе раненый мечется на границе
function rangedKeepDist(enemy) {
    if (enemy._keepDist === undefined) {
        let r = 0
        let magic = false
        const attacks = enemy.class.attacks
        for (let i = 0; i < attacks.length; i++) {
            if (enemy.stats.attacksCd[i] === undefined) continue
            const a = data.attacks[attacks[i]]
            if ((a.range || a.type === "magic") && a.range > r) {
                r = a.range
                magic = a.type === "magic"
            }
        }
        enemy._keepDist = r
        enemy._keepMetric = magic ? "m" : "c"
    }
    return enemy._keepDist
}
// «горячие» клетки вокруг героя: линия огня на других живых врагов + сектор взгляда
function sneakHotCells(enemy, pivot) {
    const hot = new Set()
    // сектор перед героем: 3 клетки по направлению взгляда
    const hd = status.hero.direction
    if (hd !== undefined) {
        const dv = DIRV[hd] || DIRV[1]
        for (let k = 1; k <= 3; k++) {
            hot.add((pivot[0] + dv[0] * k) + "," + (pivot[1] + dv[1] * k))
        }
    }
    // линия огня «герой → другой враг»: ось от героя к соседу до него + 2 клетки перелёта
    const gE = world.queries.genemy && world.queries.genemy.entities
    if (gE) {
        const snap = gE.slice()
        for (let i = 0; i < snap.length; i++) {
            const o = DATA.bag[snap[i]]
            if (!o || o === enemy || o.type !== "enemy" || o.lying !== undefined) continue
            const c = enemyCellOf(o)
            const vx = c[0] - pivot[0]
            const vy = c[1] - pivot[1]
            if (!vx && !vy) continue
            const isX = Math.abs(vx) >= Math.abs(vy)
            const sx = isX ? Math.sign(vx) : 0
            const sy = isX ? 0 : Math.sign(vy)
            const dist = isX ? Math.abs(vx) : Math.abs(vy)
            for (let k = 1; k <= dist + 2; k++) {
                hot.add((pivot[0] + sx * k) + "," + (pivot[1] + sy * k))
            }
        }
    }
    return hot
}
// точка подкрадывания: клетка вокруг героя (кольцо 2..5, чебышёв), максимально
// противоположная вектору «герой → враг» (за спиной/сбоку), с штрафом за горячие клетки
function buildSneakPath(enemy, pivot) {
    if (!ensureFlowField()) return []
    const n = nav
    const w = navW
    const ec = enemyCellOf(enemy)
    const wob = enemy._wob !== undefined ? enemy._wob : (enemy._wob = Math.random() * 1000)
    const hot = sneakHotCells(enemy, pivot)
    // единичный вектор «герой → я»: чем ближе dot к −1, тем сильнее точка «за спиной»
    const ux0 = ec[0] - pivot[0]
    const uy0 = ec[1] - pivot[1]
    const ulen = Math.hypot(ux0, uy0) || 1
    const ux = ux0 / ulen
    const uy = uy0 / ulen
    let best = null
    let bestS = -Infinity
    for (let dy = -SNEAK_SCAN; dy <= SNEAK_SCAN; dy++) {
        for (let dx = -SNEAK_SCAN; dx <= SNEAK_SCAN; dx++) {
            const cheb = Math.max(Math.abs(dx), Math.abs(dy))
            if (cheb < SNEAK_MIN_D || cheb > SNEAK_MAX_D) continue
            const x = pivot[0] + dx
            const y = pivot[1] + dy
            if (x < 0 || y < 0 || x >= w || y >= navH) continue
            const ni = y * w + x
            if (n[ni] !== 1) continue
            if (flowDist[ni] < 1) continue // сама клетка героя или недостижимый регион
            const len = Math.hypot(dx, dy) || 1
            const dot = (dx / len) * ux + (dy / len) * uy
            const s = -dot + Math.sin(wob + x * 13.7 + y * 7.9) * 0.3
                - (hot.has(x + "," + y) ? SNEAK_HOT : 0)
            if (s > bestS) { bestS = s; best = [x, y] }
        }
    }
    if (!best) return []
    return bfsPath(ec, best)
}
// путь бегства: BFS от врага по navMatrix, цель — достигнутая клетка с БОЛЬШЕЙ
// flow-дистанцией от героя (строго дальше текущей), ближе и «постабильнее» — лучше
let fleeSeen = null
let fleeParent = null
let fleeQ = null
function buildFleePath(enemy, pivot) {
    if (!ensureFlowField()) return []
    const n = nav
    const w = navW
    const h = navH
    const size = w * h
    if (!fleeSeen || fleeSeen.length !== size) {
        fleeSeen = new Int32Array(size)
        fleeParent = new Int32Array(size)
        fleeQ = new Int32Array(size)
    }
    fleeSeen.fill(-1)
    const ec = enemyCellOf(enemy)
    const si = ec[1] * w + ec[0]
    const startFlow = flowDist[si]
    if (startFlow < 0) return [] // враг вне региона героя (за порталом) — бежать по полю некуда
    let head = 0
    let tail = 0
    const wob = enemy._wob !== undefined ? enemy._wob : (enemy._wob = Math.random() * 1000)
    fleeSeen[si] = 0
    fleeParent[si] = -1
    fleeQ[tail++] = si
    let best = -1
    let bestS = -Infinity
    while (head < tail) {
        const cur = fleeQ[head++]
        const depth = fleeSeen[cur]
        if (depth >= FLEE_MAX_DEPTH) continue
        const cx = cur % w
        const cy = (cur / w) | 0
        const fd = flowDist[cur]
        if (fd > startFlow) {
            const s = fd - depth * 0.05 + Math.sin(wob + cx * 3.1 + cy * 7.7) * 0.4
            if (s > bestS) { bestS = s; best = cur }
        }
        for (let k = 0; k < 4; k++) {
            const nx = cx + DX[k]
            const ny = cy + DY[k]
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
            const ni = ny * w + nx
            if (n[ni] !== 1 || fleeSeen[ni] !== -1) continue
            fleeSeen[ni] = depth + 1
            fleeParent[ni] = cur
            fleeQ[tail++] = ni
        }
    }
    if (best < 0) return [] // дальше от героя идти некуда (угол) — зажат
    const path = []
    let cur = best
    while (cur !== si && cur >= 0) {
        path.push([cur % w, (cur / w) | 0])
        cur = fleeParent[cur]
    }
    path.reverse()
    return path
}
// тик раненого: атака проверяется каждый тик (п.1 ТЗ — огрызается и на отходе),
// движение — по фазе flee/sneak; героя нет — обычный патруль
function fleeTick(enemy, sees) {
    if (enemyOnTrail(enemy) && status.time % 5 === 0) return
    if (enemy.cold) {
        enemy.cold--
        return
    }
    if (enemy.stop === 1) return
    enemyTryAttack(enemy)
    if (enemy.state === ENEMY_STATE.ATTACK) return
    let pivot
    if (sees || enemy.called) {
        pivot = [Math.trunc(status.hero.x / 32), Math.trunc(status.hero.y / 32)]
        enemy.lastSeen = pivot
    } else if (enemy.lastSeen) {
        pivot = enemy.lastSeen
    } else {
        // героя давно не видно — раненый возвращается к обычному патрулю
        enemy.noticed = 0
        startPatrolWander(enemy)
        return
    }
    if (!enemy.path || !enemy.path.length) {
        if (enemy.fleeFail !== undefined && status.time - enemy.fleeFail < PATH_RETRY_TICKS) return
        let p = enemy.fleePhase === "sneak" ? buildSneakPath(enemy, pivot) : buildFleePath(enemy, pivot)
        if (!p.length && enemy.fleePhase === "flee") {
            // бежать некуда (тупик/угол) — попробуем подкрадывание
            enemy.fleePhase = "sneak"
            p = buildSneakPath(enemy, pivot)
        }
        if (!p.length && enemy.fleePhase === "sneak") {
            //E-21 (репорт «раненые просто стоят, не окружают»): обратный fallback —
            //если sneak-точка недостижима (герой за узким коридором/в другом регионе),
            //раненый застревал в фазе sneak НАВСЕГДА: обратного перехода в бегство не
            //было, ретрай каждые PATH_RETRY_TICKS строил только sneak и снова пусто.
            //Теперь каждый ретрай пробует ОБЕ фазы — вечного стояния больше нет
            enemy.fleePhase = "flee"
            p = buildFleePath(enemy, pivot)
        }
        if (!p.length) {
            // и бегство, и подкрадывание не строятся — зажат в угол: стоит и огрызается
            //(атака проверяется выше по тику); ретрай обеих фаз — через PATH_RETRY_TICKS
            enemy.fleeFail = status.time
            return
        }
        enemy.fleeFail = undefined
        enemy.path = p
    }
    stepAlongPath(enemy)
}

// ---------- V28: расталкивание врагов ----------
// Враги, чьи ЦЕНТРЫ (x+16, y+25) сблизились ближе SEP_DIST, мягко расходятся:
// каждому начисляется половина перекрытия в накопитель; как только накопитель
// набирает целый пиксель, враг сдвигается на 1px ПО ОДНОЙ оси и только если
// клетка после сдвига проходима (через стену не продавливает). Дробные сдвиги
// запрещены по построению: stepAlongPath сравнивает координату с узлом пути
// НА ТОЧНОЕ РАВЕНСТВО — субпиксельное смещение дало бы вечное дрожание вокруг
// узла. Анимации позы расталкивание НЕ трогает (это физическое теснение,
// а не походка), но checkZOrder обновляет — наложения меняют порядок отрисовки.
const SEP_DIST = 30   // «тесно» ближе этого расстояния между центрами, px
const SEP_RATE = 0.35 // доля перекрытия, идущая в накопитель за тик (мягкость)
const SEP_ACC_MAX = 3 // предел накопителя (против спайков в толпе)
export function separateEnemiesTick() {
    const matrix = status.matrixLevel
    if (!matrix || !matrix[0]) return
    const vb = svgArr[0].viewBox.animVal
    const list = []
    //E-3: перебор врагов из группы genemy (маркер на спавне) со снимком; фильтры type — 1:1
    const gE0 = world.queries.genemy && world.queries.genemy.entities
    if (!gE0) return
    const snap0 = gE0.slice()
    for (let i = 0; i < snap0.length; i++) {
        const o = DATA.bag[snap0[i]]
        if (!o || o.type !== "enemy") continue              // питомцы/пули/трупы — нет
        if (o.lying !== undefined || o.shadowFx || o.dashFly) continue   // DOWN-мумии, фазы тени, летящий рывок
        //E-21 (репорт: «убегающий враг не может пробиться через врагов, бегущих на героя»):
        //FLEE вне расталкивания целиком — на убегающего не действует теснение набегающей
        //толпы (и он сам никого не толкает): пробегает её без «топтания на месте»
        if (o.state === ENEMY_STATE.STUN || o.state === ENEMY_STATE.ATTACK || o.state === ENEMY_STATE.FLEE) continue
        //V58: флаг class.boss вместо проверки имени
        if (o.class.boss) continue
        const p = rectPos(o.rect)
        // те же границы камеры, что у enemyMove — за экраном не толкаем
        //V31: размер окна камеры из viewBox (зависит от зума), не литералы 1920/1080
        if (p[0] < vb.x || p[0] > vb.x + vb.width || p[1] < vb.y || p[1] > vb.y + vb.height) continue
        o._sx0 = p[0]
        o._sy0 = p[1]
        list.push(o)
    }
    const n = list.length
    if (n < 2) return
    for (let i = 0; i < n - 1; i++) {
        const a = list[i]
        const ax = a._sx0 + 16
        const ay = a._sy0 + 25
        for (let j = i + 1; j < n; j++) {
            const b = list[j]
            let dx = (b._sx0 + 16) - ax
            let dy = (b._sy0 + 25) - ay
            let d2 = dx * dx + dy * dy
            if (d2 >= SEP_DIST * SEP_DIST) continue
            let d = Math.sqrt(d2)
            if (d < 0.01) {
                // центры совпали — детерминированный диагональный развод по id
                dx = a.id < b.id ? -0.707 : 0.707
                dy = -dx
                d = 1
            }
            const half = (SEP_DIST - d) * 0.5 * SEP_RATE / d
            sepAccum(a, -dx * half, -dy * half)
            sepAccum(b, dx * half, dy * half)
        }
    }
}
function sepAccum(e, fx, fy) {
    e._sepX = Math.max(-SEP_ACC_MAX, Math.min(SEP_ACC_MAX, (e._sepX || 0) + fx))
    e._sepY = Math.max(-SEP_ACC_MAX, Math.min(SEP_ACC_MAX, (e._sepY || 0) + fy))
    const sx = Math.trunc(e._sepX)
    const sy = Math.trunc(e._sepY)
    if (!sx && !sy) return
    e._sepX -= sx
    e._sepY -= sy
    pushEnemySep(e, sx, sy)
}
function pushEnemySep(e, sx, sy) {
    const matrix = status.matrixLevel
    const walkableAt = (x, y) => {
        const row = matrix[Math.trunc((y + 25) / 32)]
        return !!(row && row[Math.trunc((x + 16) / 32)] === 1)
    }
    if (sx) {
        const p = rectPos(e.rect)
        if (walkableAt(p[0] + sx, p[1])) moveSprite(e.img, sx, 0)
    }
    if (sy) {
        const p = rectPos(e.rect)
        if (walkableAt(p[0], p[1] + sy)) moveSprite(e.img, 0, sy)
    }
    if (sx || sy) checkZOrder(e)
}

// ---------- V78: питомец держится рядом с героем ----------
// Постоянного следования у pet не было (V69: единственный пробег к герою — 1% «удача»
// petLuckyFood, дальше стоит на месте). Теперь: дальше PET_STOP_CELLS клеток (Чебышёв)
// питомец строит путь к герою общим flow-field (buildChasePath — BFS-поле кэшируется
// по клетке героя, так что перестройка пути дешева) и идёт штатным stepAlongPath;
// в радиусе — стоит, недоигранный путь сбрасывается. Толпа/фланги не при чём:
// crowdRankOf собирает только type "enemy", у pet rank −1 — всегда прямой маршрут.
// Неудачная постройка (герой временно недостижим) ретраится раз в PET_RETRY_TICKS,
// а не каждый тик: pathTarget === null — признак именно НЕУДАЧИ, у свежего pet
// pathTarget undefined. Тик pet не гейтируется камерой (enemyMove) — иначе отставший
// за экран питомец замер бы навсегда.
const PET_STOP_CELLS = 2
const PET_RETRY_TICKS = 20
//V104: экспортирован для quest.js — Волк-союзник в мирном режиме ходит «по пятам»
//той же механикой, что питомцы
export function petFollowTick(pet) {
    //V90: «удача» (пробег за едой, pets.js) главнее следования — путь питомца не
    //сбрасываем и не перестраиваем, пока он сам не доставит еду остановкой у героя
    if (pet.luckyRun) return
    const p = rectPos(pet.rect)
    const petCell = [Math.trunc((p[0] + 16) / 32), Math.trunc((p[1] + 25) / 32)]
    const hc = [Math.trunc(status.hero.x / 32), Math.trunc(status.hero.y / 32)]
    const far = Math.max(Math.abs(petCell[0] - hc[0]), Math.abs(petCell[1] - hc[1])) > PET_STOP_CELLS
    if (!far) {
        // в радиусе стоит: недоигранный путь сбрасываем
        if (pet.path && pet.path.length) {
            pet.path = []
            pet.pathTarget = null
        }
        return
    }
    const t = pet.pathTarget
    if (pet.path && pet.path.length && t && t[0] === hc[0] && t[1] === hc[1]) return
    if (t === null && status.time % PET_RETRY_TICKS !== pet.id % PET_RETRY_TICKS) return
    pet.path = buildChasePath(petCell, hc, pet)
    //V110: стартовая клетка питомца вне nav (выдавлен в проём двери/на накладку стены) —
    //flow-field от героя до неё не доходит и путь пуст навсегда. Фолбэк bfsPath: он
    //допускает старт на «сыром» полу matrix===1 (тот же запас, что у погони врагов)
    if (!pet.path.length) pet.path = bfsPath(petCell, hc)
    pet.pathTarget = pet.path.length ? hc : null
}

// ---------- главный тик врага (вызывается из enemyMove) ----------
export function enemyTick(enemy) {
    if (enemy.type === "pet") {
        //V104: Волк-союзник (квест «Сопроводить Волка», quest.js) — поведение своим
        //тиком (мирный NPC стоит; принятый — за героем через petFollowTick; в бою —
        //свой ИИ укуса), движение всё равно отыгрывает общий stepAlongPath
        if (enemy.wolfAlly) {
            wolfAllyTick(enemy)
            stepAlongPath(enemy)
            return
        }
        //V90: доставка еды «удачи» — путь иссяк, пет остановился, еда на нём
        petLuckyTick(enemy)
        petFollowTick(enemy)
        stepAlongPath(enemy)
        return
    }
    if (enemy.type !== "enemy") return
    //V109: культист квеста «Голос в портале» — мирный NPC своим тиком (стоит в углу,
    //ждёт диалога; cultNpc=0 после «НАПАСТЬ» — дальше штатный ИИ)
    if (enemy.cultNpc) {
        portalQuestCultTick(enemy)
        return
    }
    // совместимость со старыми спавнами (враг создан с behaviour, без state)
    if (enemy.state === undefined) {
        enemy.state = enemy.behaviour === 1 || enemy.behaviour === 2 ? enemy.behaviour : enemy.behaviour === 4 ? ENEMY_STATE.CHASE : ENEMY_STATE.IDLE
    }
    // DOWN: лежит и воскресает (Mummy)
    if (enemy.lying !== undefined) {
        if (enemy.lying > 0) {
            enemy.lying--
            if (enemy.lying === 0) reviveEnemy(enemy)
        }
        return
    }
    // тень (shadow): пока идут фазы погружения/всплытия — ИИ заморожен,
    // кадры хореографии двигает stepShadowFx
    if (enemy.shadowFx) {
        stepShadowFx(enemy)
        return
    }
    // ярость (rage): цикл тикает в любом состоянии — как кулдауны атак
    tickRage(enemy)
    // V79: неуязвимость (stats.invulnerability) — тот же паттерн, что ярость
    tickInvuln(enemy)
    // иммунитет к стану (noStunTime) тикает всегда, независимо от состояния
    if (enemy.noStunTime > 0) enemy.noStunTime--
    // V32: внезапный стан во время рывка прерывает полёт (след снимается сразу);
    // обычные ветки ниже в этот тик всё равно не доходят — рано возвращаемся
    if (enemy.dashFly && (enemy.state === ENEMY_STATE.STUN || enemy.lying !== undefined)) {
        endDashFlight(enemy)
        return
    }
    // STUN: проигрывается анимация стана (others[0] — она и есть длительность стана);
    // выход — в animPlay checkEndAnim по концу анимации (враг снова действует)
    if (enemy.state === ENEMY_STATE.STUN) {
        // кулдауны атак тикают и в стане: выйдя из стана, враг бьёт сразу
        tickAttackCd(enemy)
        return
    }
    // ATTACK: анимация атаки идёт; переход — в animPlay checkEndAnim
    if (enemy.state === ENEMY_STATE.ATTACK) return
    // способность «тень» (stats.shadow): периодический нырок к герою.
    // Раненый в FLEE не ныряет К герою — противоречит бегству
    enemy.state !== ENEMY_STATE.FLEE && tickShadow(enemy)
    const sees = enemySeesHero(enemy)
    if (!sees && !enemy.called) enemy.noticed = 0
    // обнаружение. E-10: раненого в FLEE не «переобнаруживаем» — иначе каждый тик
    // получался notice → setEnemyState(CHASE) с постройкой пути, и тут же раненый
    // блок возвращал FLEE с обнулённым путём: путь перестраивался и не жил ни тика,
    // подкрадывание разваливалось. Заметит снова — сам: вылеченный раненый выходит
    // в CHASE через ветку «вылечен», а потеряв героя, раненый уходит в патруль
    if ((sees || enemy.called) && enemy.state !== ENEMY_STATE.CHASE && enemy.state !== ENEMY_STATE.FLEE) enemyNoticeHero(enemy)
    // атака — только преследующий враг (CHASE). CHASE недостижимого героя невозможен
    // (enemyChase не переводит в CHASE при пустом пути), поэтому враг не бьёт сквозь
    // стены и не машет в пустоту: цель всегда достижима и в зоне реального попадания
    if (enemy.state === ENEMY_STATE.CHASE) {
        // V32: в полёте рывка прицел не берётся — атака прервала бы механику полёта
        if (!enemy.dashFly) enemyTryAttack(enemy)
        if (enemy.state === ENEMY_STATE.ATTACK) return
        // V32 «рывок» нетопыря (stats.dash): периодический триггер у преследователя,
        // видящего героя; пока длится полёт, движение chaseStep полностью заменяется им
        if (!enemy.dashFly) dashTryTrigger(enemy, sees)
        if (enemy.dashFly) {
            dashFlyTick(enemy)
            return
        }
        // V34 «очарование» суккуба (stats.charm): периодический снаряд к герою —
        // попадание отнимает управление движением/атакой на charm секунд
        charmTryTrigger(enemy, sees)
    }
    // E-10: раненые враги (≤25% ХП спавна, не боссы) — бегство/подкрадывание.
    // Дальнобойные только отходят, удерживая дистанцию стрельбы (rangedKeepDist);
    // у милишников цикл flee→sneak до конца боя. Вне боевой тревоги (не замечен,
    // не позван, не в FLEE) раненый живёт как обычный — убегать от героя, которого
    // не видел, смысла нет
    if (isWounded(enemy) && (enemy.noticed || enemy.called || enemy.state === ENEMY_STATE.FLEE)) {
        const kd = rangedKeepDist(enemy)
        const hc = [Math.trunc(status.hero.x / 32), Math.trunc(status.hero.y / 32)]
        const ec = enemyCellOf(enemy)
        const dx = Math.abs(ec[0] - hc[0]), dy = Math.abs(ec[1] - hc[1])
        const tooClose = kd !== 0 && (enemy._keepMetric === "m" ? dx + dy : Math.max(dx, dy)) < kd
        //E-22 (репорт «стреляющие крутятся на месте, не зная: бежать или атаковать»):
        //раненый дальнобойный НЕ убегает, пока его атака реально достаёт героя
        //(aimMiss === 0 — та же проверка, что у решения об атаке): пусть стреляет.
        //Бегство — только когда герой прижал ВНУТРЬ дистанции удержания, а достать
        //не может (за укрытием/на границе). Метрика дистанции — та же, что у
        //досягаемости атаки (_keepMetric), иначе на диагоналях вечные флипы
        const ePos = rectPos(enemy.rect)
        const reaches = kd > 0 && aimMiss(enemy, ePos[0], ePos[1]) === 0
        if (enemy.state === ENEMY_STATE.FLEE) {
            if (kd > 0 && (!tooClose || reaches)) {
                // отошёл на комфортную дистанцию ИЛИ герой снова в зоне поражения —
                // обычная стрельба
                enemy.fleePhase = undefined
                enemy.path = []
                enemy.pathTarget = null
                setEnemyState(enemy, ENEMY_STATE.CHASE)
            }
        } else if (kd === 0 || (tooClose && !reaches)) {
            //E-22: в бегство уходит МИЛИШНИК всегда (hit-and-run, как в E-10);
            //дальнобойный — только когда прижат и бить не может. Прежде дальнобойный
            //в CHASE флопал в FLEE безусловно, а в FLEE на дистанции — обратно в
            //CHASE: флип каждый тик, враг дёргался между бегством и атакой
            enemy.fleePhase = "flee"
            enemy.path = []
            enemy.pathTarget = null
            setEnemyState(enemy, ENEMY_STATE.FLEE)
        }
    } else if (enemy.state === ENEMY_STATE.FLEE) {
        // раненый вылечен (воскрешение мумии) — обычное поведение
        enemy.fleePhase = undefined
        enemy.path = []
        enemy.pathTarget = null
        setEnemyState(enemy, enemySeesHero(enemy) || enemy.called ? ENEMY_STATE.CHASE : ENEMY_STATE.IDLE)
    }
    // движение
    if (enemy.state === ENEMY_STATE.FLEE) {
        fleeTick(enemy, sees)
        return
    }
    if (enemy.state === ENEMY_STATE.CHASE) {
        // V79: окно неуязвимости (invulnActive) — Циклоп стоит на месте; атаки выше
        // уже отработали (enemyTryAttack до этой точки), с конца окна движение идёт само
        if (enemy.invulnActive) return
        chaseStep(enemy)
        return
    }
    if (enemy.state === ENEMY_STATE.PATROL_WANDER) {
        if (!enemy.path || !enemy.path.length) startPatrolWander(enemy)
        stepAlongPath(enemy)
        return
    }
    if (enemy.state === ENEMY_STATE.PATROL_LOOP) {
        if (!enemy.path || !enemy.path.length) startPatrolLoop(enemy)
        stepAlongPath(enemy)
        return
    }
    // IDLE — стоим; героя заметим в следующем тике
}
