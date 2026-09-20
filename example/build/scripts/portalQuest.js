// ============================================================================
// portalQuest.js — V109: сюжетный квест «Голос в портале» (одноразовый, группа
// meta.quests наравне с Волком). Только 3 глава (meta.page===3), 2 этаж
// (levelFloor===1), в углу стартовой комнаты появляется ВЫКЛЮЧЕННЫЙ портал
// (тип 18, obj[10]=0 — спрайт 100d.png). Ушёл из комнаты не поговорив — объект
// исчезает. Диалоги — dialog.js (реплики «Голос из портала»/культиста без
// портрета, герой слева).
//
// Акт 1 — СОГЛАСИТЬСЯ: в 3 случайных комнатах этажа с врагами (кроме стартовой)
//   один случайный враг помечается (staffPart) — при смерти выпадает «часть
//   посоха» (кучка item2.png с маркером, ветка в takeDrop). Подбор: 0/3 → 3/3
//   в правом квестовом окне. ОТКАЗАТЬСЯ — объект исчезает.
// Акт 2 (3/3, возврат в стартовую комнату, юз портала): кнопка «...» →
//   квест-портал становится СИНИМ активным (obj[12]=2 → 100a.png, не гаснет) и
//   строится СЕТЬ: 7 комнат 9×9 — «островов» под картой (рецепт createArena),
//   в каждой 4 синих портала по углам и рычаг в центре. Граф связей случайный
//   со случайным остовом (цепочка перемешанных комнат, двусторонние пары
//   порталов) + добивка — все комнаты достижимы. Юз портала сети телепортирует
//   к парному (freeCellNear + teleportHero), рычаг гаснет и продвигает 0/7 → 7/7.
//   Все 7 — героя возвращает в стартовую комнату, сеть ПОЛНОСТЬЮ зачищается
//   (узлы спрайтов комнат remove() по записанным диапазонам screenPic —
//   append-only, чужие индексы не сдвигаются; объекты/пол/стены/roomsArr —
//   обрезка хвостов, createMatrix), квест-портал краснеет (100b.png) и мертвеет.
// Акт 3 — рядом культист (мирный, перехват тика через enemyTickcultNpc):
//   «СОГЛАСИТЬСЯ» — культист и портал исчезают, квест НЕ отмечается в мете
//   (повторится в новом забеге 3 главы); «НАГРАДУ» — реплика и 3 свитка очков
//   характеристик (scroll.png → takeScroll +1 upStat каждый), мета portal=1;
//   «НАПАСТЬ» — культист становится врагом: статы вождя гоблинов (id 4) со ВСЕМИ
//   модификаторами глав вплоть до 4-й (рецепт spawnShellBoss: hp×6, dmg +5/+16,
//   speed +3, range +2; V110: ещё hp×4), атака 22 — уменьшенная «Звезда пустоты»
//   (×0.5 спрайт, как осколки Медузы пустоты), снаряды при исчезновении разделяются
//   на 4 (crushAttack:1, как у Шипа), БЕЗ тега boss (и без elite — не дропает ключ).
//   Победа — кучка item5.png (подбор = случайная реликвия, relicGenerate) и мета portal=1.
// ============================================================================
import { status } from "../scripts/start.js"
import { T } from "../scripts/localization.js"
import { data } from "../scripts/data.js"
import { dataGeneric, createRoom, createMatrix } from "../scripts/sceneGenerate.js"
import { svgArr, image, text, rect, rectPos, uiRightEdge, releaseSprite, worldImage } from "../scripts/svg.js"
import { objectValues, screenPic } from "../scripts/del.js"
import { floatText } from "../scripts/floatText.js"
import { journalAdd, J_STD, J_RED, J_YELLOW } from "../scripts/journal.js"
import { playback, strike } from "../scripts/sound.js"
import { openDialog } from "../scripts/dialog.js"
//V109: отметка о выполнении сюжетного квеста сохраняется сразу (meta в localStorage)
import { save } from "../scripts/save.js"
//V109: исчезающий живым культист уносит тень (как Волк в removeWolf); тень статичного
//объекта — objectShadow/removeObjShadow (тем же конвейером, что createRoom)
import { removeEntShadow, removeObjShadow, objectShadow } from "../scripts/groundShadow.js"
//штатные хелперы порталов. Цикл импортов portalFx↔portalQuest легален: он вызывает
//portalQuestUse в рантайме (юз портала/рычага сети), мы зовём его хелперы в рантайме
import { setObjectState, freeCellNear, teleportHero } from "../scripts/portalFx.js"
//спрайты порталов по фазе (100a синий активный / 100d выключенный) — модуль без импортов
import { portalSpriteSrc } from "../scripts/portalSprite.js"
//полёт и посадка кучек (страховка от стен) — как spawnGoldRing
import { placeDrop, dropFly } from "../scripts/dropSafe.js"

const USE_TICKS = 45             //полоска взаимодействия (как у Волка/объектов, ~0.72с)
const NET_ROOMS = 7              //комнат в сети
const NET_SIZE = 9               //клетка комнаты сети (9×9, как арена)
const NET_LEVERS = 7
const PORTAL_RED = "./images/dungeon/objects/100b.png"
//кольцо клеток для поиска свободной клетки (как NEAR в quest.js/pets.js)
const NEAR = [[0,0],[0,-1],[1,-1],[-1,-1],[1,0],[-1,0],[1,1],[-1,1],[0,1]]

//кучки-«части посоха»: маркер хэндла → ветка подбора в takeDrop (WeakSet —
//неподобранные кучки не держат память, записи умирают со сценой)
const staffPiles = new WeakSet()

let useBarFill = null
let useT = 0

// ---------- окно «текущих квестов» (правый край, как у Волка) ----------
let trackNodes = []
let trackTextEl = null
function trackerShow(baseKey) {
    trackerHide()
    const x = 1612 + (uiRightEdge() - 1920)
    trackNodes.push(rect(svgArr[2],x,252,296,86,"1px","rgb(204, 153, 102)","rgba(16, 12, 10, 0.85)",{"rx":"5px","id":"pqWinBack"}))
    trackNodes.push(text(svgArr[2],x + 148,284,"0pt","26pt","black","2px","rgb(204, 153, 102)",T("quest.title"),{"id":"pqWinTitle","size":24,"font":"baseFont4","anchor":"middle"}))
    trackTextEl = text(svgArr[2],x + 148,318,"0pt","24pt","black","2px","rgb(230, 220, 200)",T(baseKey),{"id":"pqWinText","size":22,"font":"baseFont4","anchor":"middle"})
    trackNodes.push(trackTextEl)
}
function trackerText(key, n, max) {
    //строка с счётчиком: «Активируй рычаги. 3/7»
    trackTextEl && (trackTextEl.textContent = T(key) + " " + n + "/" + max)
}
function trackerSet(str) {
    trackTextEl && (trackTextEl.textContent = str)
}
function trackerHide() {
    while (trackNodes.length > 0) {
        const n = trackNodes.pop()
        n && n.remove && n.remove()
    }
    trackTextEl = null
}

// ---------- спавн выключенного портала (newGame: 3 глава, 2 этаж) ----------
export function portalQuestNewGame(next) {
    clearSession()
    status.questPortal = null
    if (next === false) return
    //одноразовый сюжетный: выполненный (мета) не предлагается
    if (status.meta.page !== 3 || status.levelFloor !== 1) return
    if (status.meta.quests && status.meta.quests.portal) return
    spawnQuestPortal()
}
function clearSession() {
    trackerHide()
    useBarFill && useBarFill.remove()
    useBarFill = null
    useT = 0
}
function spawnQuestPortal() {
    const lv = dataGeneric.scenes[status.levelFloor]
    if (!lv.roomsArr || !lv.roomsArr[0]) return
    const f = lv.floor[lv.roomsArr[0][0]]
    //угол стартовой комнаты (клетка внутрь от угла, как у Волка); клетка — свободный пол
    let cell = null
    for (let i = 0; i < NEAR.length; i++) {
        const cx = f[0] + 1 + NEAR[i][0]
        const cy = f[1] + 1 + NEAR[i][1]
        if (status.matrixLevel[cy] && status.matrixLevel[cy][cx] === 1 && !cellBusy(lv, cx, cy)) { cell = [cx,cy]; break }
    }
    if (!cell) return
    status.questPortal = {"state":1,"room":[f[0],f[1],f[2],f[3]],"parts":0,
        "partRooms":[],"pendingRooms":[],"portal":null,"net":null,"cult":null}
    lv.objects.push([cell[0], cell[1], 18, 1, 1, undefined])
    const obj = lv.objects[lv.objects.length - 1]
    obj[9] = lv.roomsArr[0]
    obj[10] = 0               //выключенная фаза — спрайт 100d.png, юзом не берётся
    status.questPortal.portal = obj
    drawQuestPortal(obj)
}
//свободна ли клетка под объект (объекты + стены + герой) — локальная копия cellBusy
function cellBusy(level, x, y) {
    for (let i = 0; i < level.objects.length; i++) {
        const o = level.objects[i]
        if (x >= o[0] && x < o[0] + o[3] && y >= o[1] && y < o[1] + o[4]) return true
    }
    for (let i = 0; i < level.walls.length; i++) {
        const w = level.walls[i]
        if (x >= w[0] && x < w[0] + w[3] && y >= w[1] && y < w[1] + w[4]) return true
    }
    return x === level.hero[0] && y === level.hero[1]
}
//портал 64×84 в живой сцене — та же геометрия, что ветка isPortalObj в createRoom
function drawQuestPortal(obj) {
    screenPic.push(worldImage(svgArr[1], obj[0]*32 + 16 - 32, obj[1]*32 + 32 - 84, 64, 84, portalSpriteSrc(obj), {"id": screenPic.length + "O"}))
    obj[6] = screenPic.length - 1
    const img = screenPic[obj[6]]
    img && objectShadow(img)
}
function removeQuestPortal() {
    const qp = status.questPortal
    if (!qp || !qp.portal) return
    const level = dataGeneric.scenes[status.levelFloor]
    const idx = level.objects.indexOf(qp.portal)
    idx !== -1 && level.objects.splice(idx, 1)
    const img = qp.portal[6] !== undefined ? screenPic[qp.portal[6]] : null
    img && img.remove()
    img && removeObjShadow(img)
    qp.portal = null
    useBarFill && useBarFill.remove()
    useBarFill = null
    useT = 0
}

// ---------- тик (gameLoop, после shellTick) ----------
export function portalQuestTick() {
    const qp = status.questPortal
    if (!qp) return
    const lv = dataGeneric.scenes[status.levelFloor]
    if (!lv || !lv.roomsArr) return
    if (qp.state === 1) {
        //герой покинул стартовую комнату, не поговорив — объект исчезает
        const hx = Math.trunc(status.hero.x / 32)
        const hy = Math.trunc(status.hero.y / 32)
        if (hx < qp.room[0] || hx >= qp.room[0] + qp.room[2] || hy < qp.room[1] || hy >= qp.room[1] + qp.room[3]) {
            removeQuestPortal()
            status.questPortal = null
            return
        }
        portalUseBarTick()
        return
    }
    //сбор частей: портал ждёт в стартовой комнате (взаимодействие — напоминание/сдача)
    if (qp.state === 2) portalUseBarTick()
}
//взаимодействие с порталом-объектом: герой рядом — растёт полоска (как у Волка)
function portalUseBarTick() {
    const qp = status.questPortal
    if (!qp.portal) return
    //перезарядка после диалога: любой диалог портала взводит qp.recharge, снимается
    //выходом героя из МОЕЙ зоны (ветка d>68 — ДО гейта, иначе снятия не случится
    //никогда) — повторный диалог только «отошёл-подошёл» (репорт V109: бар refill'ился
    //на месте и диалог зацикливался). НЕ объектный [11]: герой из нижней клетки портала
    //вне ванильного хитбокса ±32 (точка героя y+50) — checkObject сбрасывал бы [11]
    //каждый тик, пока мой радиус 68 его видит
    const img = qp.portal[6] !== undefined ? screenPic[qp.portal[6]] : null
    if (!img || !img.isConnected) return
    const px = img.x.animVal.value + 32
    const py = img.y.animVal.value + 55
    const d = Math.hypot((status.hero.x + 16) - px, (status.hero.y + 25) - py)
    //68, а не 56 (как у Волка): спрайт портала 64×84 торчит НАД клеткой — центр
    //«тела» на 52px выше ноги, снизу/сбоку дистанция до героя больше
    if (d > 68) {
        useT > 0 && (useT = 0)
        useBarFill && useBarFill.setAttribute("width", 0)
        qp.recharge = 0          //вышел из зоны — перезарядка снята
        return
    }
    if (qp.recharge) return
    useT++
    if (!useBarFill) {
        useBarFill = rect(svgArr[1],px - 25,img.y.animVal.value - 6,0,6,"none","0px","#cc9966",{"id":"pqUseBar"})
    }
    useBarFill.setAttribute("width", Math.trunc(50 * useT / USE_TICKS))
    if (useT >= USE_TICKS) {
        useBarFill.remove()
        useBarFill = null
        useT = 0
        qp.recharge = 1
        qp.portal[11] = 1        //и ванильная перезарядка: в state 3 синий портал не
                                 //должен авто-телепортировать стоящего на месте героя
        if (qp.state === 1) openPortalDialog()
        else if (qp.parts >= 3) openStaffDialog()
        else openRemindDialog()
    }
}

// ---------- диалоги ----------
function openPortalDialog() {
    openDialog({
        "right": null,
        "lines":[
            {"who":"voice","key":"dlg.pq.1"},
            {"who":"hero","key":"dlg.pq.2"},
            {"who":"voice","key":"dlg.pq.3"},
            {"who":"hero","key":"dlg.pq.4"},
            {"who":"voice","key":"dlg.pq.5"}
        ],
        "choices":[
            {"label":"dlg.choice.agree","cb":acceptQuest},
            {"label":"dlg.choice.deny","cb":() => {
                removeQuestPortal()
                status.questPortal = null
            }}
        ]
    })
}
function acceptQuest() {
    const qp = status.questPortal
    qp.state = 2
    choosePartRooms()
    trackerShow("quest.portal.track1")
    trackerText("quest.portal.track1", qp.parts, 3)
    journalAdd(T("journ.pq.accept"), J_STD)
}
//3 случайных комнаты этажа с врагами (кроме стартовой и «островов»); открытые —
//метка сразу, закрытые — лениво при openRoom (portalQuestMarkRoom)
function choosePartRooms() {
    const qp = status.questPortal
    const lv = dataGeneric.scenes[status.levelFloor]
    const cand = []
    for (let i = 1; i < lv.roomsArr.length; i++) {
        const r = lv.roomsArr[i]
        if (r[4] === 1) continue
        if (!r[2] || !r[2].some(g => g[0] > 0)) continue
        cand.push(r)
    }
    cand.sort(() => Math.random() - 0.5)
    qp.partRooms = cand.slice(0, 3)
    qp.pendingRooms = []
    for (const room of qp.partRooms) {
        if (room[3] === 1) markInRoom(room)
        else qp.pendingRooms.push(room)
    }
}
function markInRoom(room) {
    const cand = objectValues.filter(o => o.type === "enemy" && o.room === room &&
        !o.staffPart && o.lying === undefined && o.stats.hp > 0)
    if (!cand.length) return
    cand[Math.trunc(Math.random() * cand.length)].staffPart = 1
}
//хук из openRoom (хвост): комната с отложенной меткой открылась — враги заспавнены
export function portalQuestMarkRoom(room) {
    const qp = status.questPortal
    if (!qp || qp.state !== 2 || !qp.pendingRooms) return
    const i = qp.pendingRooms.indexOf(room)
    if (i === -1) return
    qp.pendingRooms.splice(i, 1)
    markInRoom(room)
}
function openRemindDialog() {
    openDialog({
        "right": null,
        "lines":[{"who":"voice","key":"dlg.pq.remind"}],
        "choices":[{"label":"dlg.pq.dots","cb":null}]
    })
}
function openStaffDialog() {
    openDialog({
        "right": null,
        "lines":[
            {"who":"hero","key":"dlg.pq.6"},
            {"who":"voice","key":"dlg.pq.7"},
            {"who":"hero","key":"dlg.pq.8"},
            {"who":"voice","key":"dlg.pq.9"}
        ],
        "choices":[{"label":"dlg.pq.dots","cb":buildNetwork}]
    })
}

// ---------- сеть порталов ----------
function buildNetwork() {
    const qp = status.questPortal
    const level = dataGeneric.scenes[status.levelFloor]
    const net = {"rooms":[],"portals":[],"levers":[],"objects":[],"linkMap":new Map(),
        "ranges":[],"activated":0,
        "baseFloor":level.floor.length,"baseRooms":level.roomsArr.length,
        "baseWalls":level.walls.length,"baseH":level.h}
    qp.net = net
    qp.state = 3
    const sy = level.h + 3
    for (let i = 0; i < NET_ROOMS; i++) {
        const x = 3 + i * (NET_SIZE + 3)
        const y = sy
        level.h = y + NET_SIZE + 3
        const floorIdx = level.floor.length
        //пол-прямоугольник и кольцо стен — рецепт createArena (9×9)
        level.floor.push([x, y, NET_SIZE, NET_SIZE, 3, x + 4, y + 4])
        const walls = level.walls
        walls.push([x, y, 6, 1, 1])
        walls.push([x + 8, y, 7, 1, 1])
        for (let k = 1; k < 8; k++) {
            walls.push([x + k, y, 20, 1, 1])
            walls.push([x, y + k, 22, 1, 1])
            walls.push([x + 8, y + k, 21, 1, 1])
            walls.push([x + k, y + 8, 19, 1, 2])
        }
        walls.push([x, y + 8, 3, 1, 2])
        walls.push([x + 8, y + 8, 2, 1, 2])
        //спек из пустых групп (openRoom не вызовется — комната сразу открыта)
        const spec = []
        for (let g = 0; g < 6; g++) spec.push([0, 0])
        const room = [floorIdx, NET_SIZE * NET_SIZE, spec, 1]
        room[4] = 1
        const roomIdx = level.roomsArr.length
        level.roomsArr.push(room)
        net.rooms.push(room)
        //4 синих портала по углам (obj[12]=2 → 100a.png) и рычаг в центре
        const row = []
        const corners = [[1,1],[7,1],[1,7],[7,7]]
        for (const c of corners) {
            level.objects.push([x + c[0], y + c[1], 18, 1, 1, undefined])
            const o = level.objects[level.objects.length - 1]
            o[9] = room
            o[10] = 1
            o[12] = 2
            row.push(o)
            net.objects.push(o)
        }
        net.portals.push(row)
        level.objects.push([x + 4, y + 4, 19, 1, 1, undefined])
        const lever = level.objects[level.objects.length - 1]
        lever[9] = room
        lever[10] = 1
        net.levers.push(lever)
        net.objects.push(lever)
        //отрисовка сразу (createRoom читает floor/walls/objects) — диапазон screenPic
        //запоминаем для зачистки (screenPic append-only, индексы стабильны)
        const s = screenPic.length
        createRoom(level, roomIdx, 32, 32)
        net.ranges.push([s, screenPic.length])
    }
    buildNetGraph(qp, net)
    createMatrix()
    //квест-портал — синий активный (юзом берётся штатно, portalUse → portalQuestUse)
    qp.portal[12] = 2
    setObjectState(qp.portal, 1)
    trackerText("quest.portal.track2", 0, NET_LEVERS)
    journalAdd(T("journ.pq.net"), J_STD)
}
//случайный связный граф: остов — цепочка перемешанных комнат (двусторонние пары
//порталов), добивка — каждый свободный портал ведёт в случайный портал чужой комнаты
function buildNetGraph(qp, net) {
    const order = [0,1,2,3,4,5,6]
    order.sort(() => Math.random() - 0.5)
    const used = net.portals.map(() => [0,0,0,0])
    const pickFree = (ri) => {
        const free = []
        for (let pi = 0; pi < 4; pi++) !used[ri][pi] && free.push(pi)
        if (!free.length) return null
        const pi = free[Math.trunc(Math.random() * free.length)]
        used[ri][pi] = 1
        return net.portals[ri][pi]
    }
    const link = (a, b) => { a && b && (net.linkMap.set(a, b), net.linkMap.set(b, a)) }
    for (let i = 0; i < NET_ROOMS - 1; i++) link(pickFree(order[i]), pickFree(order[i + 1]))
    for (let ri = 0; ri < NET_ROOMS; ri++) {
        for (const o of net.portals[ri]) {
            if (net.linkMap.has(o)) continue
            let other = ri
            while (other === ri) other = Math.trunc(Math.random() * NET_ROOMS)
            net.linkMap.set(o, net.portals[other][Math.trunc(Math.random() * 4)])
        }
    }
    //вход в сеть — квест-портал ведёт в случайный портал первой комнаты
    net.linkMap.set(qp.portal, net.portals[0][Math.trunc(Math.random() * 4)])
}
//все 7 рычагов — возврат в стартовую комнату, полная зачистка сети, красный портал
function finishNetwork() {
    const qp = status.questPortal
    const level = dataGeneric.scenes[status.levelFloor]
    const net = qp.net
    const cell = freeCellNear(level, qp.portal[0], qp.portal[1])
    //спрайты комнат: remove() по записанным диапазонам (индексы screenPic не сдвигаются —
    //паттерн проекта: дырки остаются, setObjectState-и чужих объектов не ломаются)
    for (let r = 0; r < net.ranges.length; r++) {
        for (let i = net.ranges[r][0]; i < net.ranges[r][1]; i++) {
            const n = screenPic[i]
            n && n.remove && n.remove()
        }
    }
    //объекты сети: из level.objects + их спрайты/тени
    for (const o of net.objects) {
        const idx = level.objects.indexOf(o)
        idx !== -1 && level.objects.splice(idx, 1)
        const img = o[6] !== undefined ? screenPic[o[6]] : null
        img && img.remove()
        img && removeObjShadow(img)
    }
    //пол/стены/комнаты — мои записи в хвостах массивов: обрезка; level.h — обратно
    level.floor.length = net.baseFloor
    level.roomsArr.length = net.baseRooms
    level.walls.length = net.baseWalls
    level.h = net.baseH
    createMatrix()
    qp.net = null
    cell && teleportHero(cell[0], cell[1])
    //портал — красный (100b.png) и больше не активируется (obj[10]=0)
    qp.portal[10] = 0
    qp.portal[12] = 3
    const pimg = qp.portal[6] !== undefined ? screenPic[qp.portal[6]] : null
    pimg && pimg.setAttribute("href", PORTAL_RED)
    trackerSet(T("quest.portal.track3"))
    spawnCultist(level)
    //акт 3: мирный культист ждёт диалога
    qp.state = 4
}

// ---------- юз портала/рычага сети (хук из portalFx.portalUse) ----------
export function portalQuestUse(obj) {
    const qp = status.questPortal
    if (!qp || qp.state !== 3 || !qp.net) return false
    const net = qp.net
    if (obj === qp.portal || net.portals.some(row => row.indexOf(obj) !== -1)) {
        const target = net.linkMap.get(obj)
        if (!target) return true
        const level = dataGeneric.scenes[status.levelFloor]
        const cell = freeCellNear(level, target[0], target[1])
        if (cell) {
            //цель на перезарядке ([11]): герой приземляется В ЗОНЕ портала-цели — без
            //этого useObject тут же начинал его юз и героя вело бесконечной цепочкой
            //(портал -> портал). [11] снимается выходом героя из зоны, как у всех объектов
            target[11] = 1
            teleportHero(cell[0], cell[1])
        }
        return true
    }
    const vi = net.levers.indexOf(obj)
    if (vi !== -1) {
        setObjectState(obj, 0)
        net.activated++
        trackerText("quest.portal.track2", net.activated, NET_LEVERS)
        floatText(status.hero.x - 16 + Math.trunc(Math.random() * 32), status.hero.y + 8,
            net.activated + "/" + NET_LEVERS, "#CC9966", "18px", "none")
        journalAdd(T("journ.pq.lever", net.activated), J_STD)
        net.activated >= NET_LEVERS && finishNetwork()
        return true
    }
    return false
}

// ---------- культист (акт 3) ----------
function findClassById(id) {
    for (let g = 0; g < data.enemes.length; g++) {
        const grp = data.enemes[g]
        const arr = Array.isArray(grp) ? grp : [grp]
        for (let v = 0; v < arr.length; v++) {
            if (arr[v].id === id) return arr[v]
        }
    }
    return null
}
function spawnCultist(level) {
    const qp = status.questPortal
    const base = findClassById(28)
    const lider = findClassById(4)
    if (!base || !lider) return
    //класс культиста (анимации), атака — уменьшенная копия «Звезды пустоты» (22, ×0.5
    //спрайт — как осколки Медузы пустоты), статы — вождь гоблинов со всеми модификаторами
    //глав (вплоть до 4-й). Без boss/elite: нет полосы босса, зачёта bossKill и ключа элит.
    //V110 (решение пользователя): ХП ×4 к прежним 240; базовые снаряды при исчезновении
    //разделяются на 4 осколка, как у Шипа (crushAttack:1 — burst-хук в moveBullet)
    const cls = JSON.parse(JSON.stringify(base))
    delete cls.boss
    delete cls.elite
    cls.attacks = [22]
    for (const a of cls.anims[1].attack) a.attackNew && (a.attackNew.anim[0] = 22)
    const stats = JSON.parse(JSON.stringify(lider.stats))
    stats.hp *= 2; stats.dmg[0] += 1; stats.dmg[1] += 2
    stats.hp *= 2; stats.dmg[0] += 2; stats.dmg[1] += 6; stats.speed += 1; stats.range += 1
    stats.hp *= 1.5; stats.dmg[0] += 2; stats.dmg[1] += 8; stats.speed += 2; stats.range += 1
    stats.hp *= 4
    stats.crushAttack = 1
    stats.exp = 10
    //клетка рядом с порталом: свободный пол, не хитбокс героя (поиск как spawnShellBoss)
    const f = level.floor[level.roomsArr[0][0]]
    const matrix = status.matrixLevel
    const cells = []
    for (let x = f[0] + 1; x < f[0] + f[2] - 1; x++) {
        for (let y = f[1] + 1; y < f[1] + f[3] - 1; y++) {
            if (!(matrix[y] && matrix[y][x] === 1)) continue
            let busy = false
            for (let i = 0; i < level.objects.length && !busy; i++) {
                const o = level.objects[i]
                x >= o[0] && x < o[0] + o[3] && y >= o[1] && y < o[1] + o[4] && (busy = true)
            }
            //не клетка, пересекающая хитбокс героя (14×14, x+13/y+37 — как spawnShellBoss)
            const hx = status.hero.x + 13
            const hy = status.hero.y + 37
            hx < x * 32 + 32 && hx + 14 > x * 32 && hy < y * 32 + 32 && hy + 14 > y * 32 && (busy = true)
            !busy && cells.push([x, y])
        }
    }
    if (!cells.length) return
    cells.sort((a, b) => (Math.hypot(a[0] - qp.portal[0], a[1] - qp.portal[1]) -
        Math.hypot(b[0] - qp.portal[0], b[1] - qp.portal[1])))
    const cell = cells[0]
    const anim = cls.anims[2].others[2]
    objectValues.push({"id":status.oVcount,"type":"enemy","cultNpc":1,"class":cls,"stats":stats,
    "animCounters":60/anim.speed,"currentAnim":anim,"currentStill":0,"room":level.roomsArr[0],"cells":[],
    "state":0,"stop":0,"xCell":cell[0],"yCell":cell[1],"noStunTime":0,
    "img":image(svgArr[1],cell[0]*32,cell[1]*32-19,anim.w,anim.h,anim.img,
        {"times":anim.times,"id":status.oVcount,"frame":1})})
    status.oVcount++
    const e = objectValues[objectValues.length - 1]
    e.rect = e.img.clipRect
    e.stats.attacksCd[0] = Math.trunc(data.attacks[22].cooldown * 1000 / 16)
    qp.cult = e
}
//тик мирного культиста (перехват из enemyAI.enemyTick до штатного ИИ): стоит и ждёт
export function portalQuestCultTick(enemy) {
    const qp = status.questPortal
    if (!qp || qp.state !== 4 || qp.cult !== enemy) { enemy.cultNpc = 0; return }
    cultUseBarTick(enemy)
}
function cultUseBarTick(enemy) {
    const wp = rectPos(enemy.rect)
    const d = Math.hypot((status.hero.x + 16) - (wp[0] + 16), (status.hero.y + 25) - (wp[1] + 25))
    if (d > 56) {
        useT > 0 && (useT = 0)
        useBarFill && useBarFill.setAttribute("width", 0)
        return
    }
    useT++
    if (!useBarFill) {
        useBarFill = rect(svgArr[1],wp[0] - 9,wp[1] - 16,0,6,"none","0px","#cc9966",{"id":"pqCultBar"})
    }
    useBarFill.setAttribute("width", Math.trunc(50 * useT / USE_TICKS))
    if (useT >= USE_TICKS) {
        useBarFill.remove()
        useBarFill = null
        useT = 0
        openCultDialog(enemy)
    }
}
function openCultDialog(enemy) {
    openDialog({
        //правый портрет — загруженный арт культиста (192×288, формат портрета Волка)
        "right": "./images/UI/doll/cultist.png",
        "lines":[{"who":"cultist","key":"dlg.pq.10"}],
        "choices":[
            {"label":"dlg.choice.agree","cb":() => cultAgree(enemy)},
            {"label":"dlg.pq.reward","cb":() => cultReward(enemy)},
            {"label":"dlg.pq.attack","cb":() => cultFight(enemy)}
        ]
    })
}
//СОГЛАСИТЬСЯ: культист и портал исчезают, квест НЕ завершён (в мете не отмечается —
//повторится в новом забеге 3 главы)
function cultAgree(enemy) {
    trackerHide()
    removeCult(enemy)
    removeQuestPortal()
    status.questPortal = null
}
//НАГРАДУ: реплика, 3 свитка очков характеристик (подбор = +1 upStat каждый),
//культист и портал исчезают, квест завершён (мета)
function cultReward(enemy) {
    openDialog({
        "right": "./images/UI/doll/cultist.png",
        "lines":[{"who":"cultist","key":"dlg.pq.11"}],
        "choices":[{"label":"dlg.pq.dots","cb":() => {
            const wp = rectPos(enemy.rect)
            spawnScrollPiles(Math.trunc(wp[0] / 32), Math.trunc(wp[1] / 32), wp[0] + 16, wp[1] + 25)
            questComplete(enemy)
        }}]
    })
}
//НАПАСТЬ: культист становится обычным врагом (штатный ИИ), победа — в enemyDie-хуке
function cultFight(enemy) {
    enemy.cultNpc = 0
    enemy.cultFight = 1
    enemy.noticed = 1
    enemy.called = 1
    trackerHide()
    journalAdd(T("journ.pq.fight"), J_RED)
}
function removeCult(enemy) {
    if (!enemy) return
    removeEntShadow(enemy)
    const idx = objectValues.indexOf(enemy)
    idx !== -1 && objectValues.splice(idx, 1)
    releaseSprite(enemy.img)
    const qp = status.questPortal
    qp && (qp.cult = null)
}
function questComplete(enemy) {
    removeCult(enemy)
    removeQuestPortal()
    status.meta.quests.portal = 1
    save()
    journalAdd(T("journ.pq.done"), J_YELLOW)
    playback(strike[3].vol,0,0,2*status.settings.soundVolume)
    trackerHide()
    status.questPortal = null
}
//3 свитка очков характеристик вокруг клетки (scroll.png → takeScroll: +1 upStat)
function spawnScrollPiles(cx, cy, fx, fy) {
    const m = status.matrixLevel
    const placed = {}
    let n = 0
    for (let r = 1; r <= 3 && n < 3; r++) {
        for (let dy = -r; dy <= r && n < 3; dy++) {
            for (let dx = -r; dx <= r && n < 3; dx++) {
                if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
                const x = cx + dx
                const y = cy + dy
                if (!(m[y] && m[y][x] === 1) || placed[x + "_" + y]) continue
                placed[x + "_" + y] = 1
                screenPic.push(worldImage(svgArr[1], x * 32, y * 32, 32, 36, "./images/dungeon/drop/scroll.png", {"id": screenPic.length - 1}))
                const el = screenPic[screenPic.length - 1]
                placeDrop(el, x * 32, y * 32, 32, 36)
                dropFly(el, fx, fy)
                n++
            }
        }
    }
}

// ---------- дроп (хуки из enemyAI.enemyDie и takeDrop) ----------
//умер помеченный враг — выпадает «часть посоха» (кучка item2.png с маркером)
//победа над культистом в бою — случайная реликвия (кучка item5.png → relicGenerate)
export function portalQuestEnemyDie(enemy) {
    const qp = status.questPortal
    if (enemy.staffPart && qp && qp.state === 2) {
        const p = rectPos(enemy.rect)
        screenPic.push(worldImage(svgArr[1], p[0] + 16, p[1] + 55, 32, 36, "./images/dungeon/drop/item2.png", {"id": screenPic.length - 1}))
        const el = screenPic[screenPic.length - 1]
        placeDrop(el, p[0] + 16, p[1] + 55, 32, 36)
        dropFly(el, p[0] + enemy.rect._w / 2, p[1] + enemy.rect._h / 2)
        staffPiles.add(el)
    }
    if (enemy.cultFight && qp && qp.state === 4) {
        const p = rectPos(enemy.rect)
        screenPic.push(worldImage(svgArr[1], p[0] + 16, p[1] + 55, 32, 36, "./images/dungeon/drop/item5.png", {"id": screenPic.length - 1}))
        const el = screenPic[screenPic.length - 1]
        placeDrop(el, p[0] + 16, p[1] + 55, 32, 36)
        dropFly(el, p[0] + enemy.rect._w / 2, p[1] + enemy.rect._h / 2)
        journalAdd(T("journ.pq.done"), J_YELLOW)
        status.meta.quests.portal = 1
        save()
        removeQuestPortal()
        qp.cult = null
        status.questPortal = null
    }
}
//подбор части посоха (ветка в takeDrop до href-цепочки): 0/3 → 3/3 в квестовом окне
export function portalQuestTakePile(el) {
    if (!staffPiles.has(el)) return false
    staffPiles.delete(el)
    const qp = status.questPortal
    qp && qp.state === 2 && qp.parts < 3 && qp.parts++
    const n = qp ? qp.parts : 3
    floatText(status.hero.x - 16 + Math.trunc(Math.random() * 32), status.hero.y + 8,
        T("quest.portal.track1") + " " + n + "/3", "#CC9966", "16px", "none")
    journalAdd(T("journ.pq.part", n), J_STD)
    qp && qp.state === 2 && trackerText("quest.portal.track1", qp.parts, 3)
    return true
}

// ---------- смена сцены (del.js) ----------
export function portalQuestDel() {
    clearSession()
    status.questPortal = null
}
