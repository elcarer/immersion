// ============================================================================
// entQuest.js — V138: сюжетный одноразовый квест «Разрастание» (группа
// meta.quests наравне с Волком/порталом/огнементалем/Слаймэном). Только 4 глава
// (meta.page===4), 2 этаж (levelFloor===1): в углу стартовой комнаты появляется
// мирный Древоброд (id 31, лист ent_64.png, entNpc=1 — не атакует и не
// атакуется, как Слаймэн V135). Ушли из стартовой комнаты, не поговорив, —
// Древоброд исчезает. Полоска взаимодействия (как у Слаймэна) открывает диалог:
// «ОТКАЗАТЬСЯ» — квест отменён, Древоброд исчезает; «ПОМОЧЬ» — квест начат:
// 3 случайных ЗАКРЫТЫХ комнаты этажа (кроме стартовой и комнаты спуска;
// острова-квесты за границами карты отсеиваются) получают РОСТОК
// (images/dungeon/objects/plant.png) в середине — он появляется в момент
// ОТКРЫТИЯ комнаты (room[3]=1, heroMove), у уже открытых — сразу. С появлением
// ростка стартует таймер 10с: каждую секунду в случайном углу комнаты
// появляется квестовый Паук (id 13, entSpider=1) и ползёт К РОСТКУ, игнорируя
// героев (тик перехвачен в enemyAI.entSpiderTick по пути buildChasePath →
// stepAlongPath). Паук, дошедший до ростка, съедает его — квест ПРОВАЛЕН:
// ростки и Древоброд исчезают, квестовые пауки становятся обычными врагами.
// Таймер истёк, росток жив — спавн в этой комнате прекращается, этап +1
// (трекер «Ростки: N/3»); живые пауки продолжают ползти — их надо добить.
// 3/3 — у Древоброда финальный диалог, «ХМЫКНУТЬ» — квест выполнен
// (meta.quests.ent=1, save), Древоброд исчезает, оставляя Росток: подбор даёт
// эффект «рост» предмету на ТЕЛЕ (слот куклы 3): +10 к максимальному ХП, пока
// предмет надет (growHpBonus в countDopStats), оверлей effects/plantGrow.png на
// иконке — по механике Кома слизи (V133).
// ============================================================================
import { status } from "../scripts/start.js"
//V117: кооператив — полоску растит ближайший живой герой
import { nearestPlayer } from "../scripts/players.js"
import { T, itemName } from "../scripts/localization.js"
import { data } from "../scripts/data.js"
import { dataGeneric } from "../scripts/sceneGenerate.js"
//V138: подбор Ростка навешивает «рост» — максимум ХП пересчитывается сразу
//цикла нет: countDopStats импортирует только relics/blessFx/start
import { countDopStats } from "../scripts/countDopStats.js"
import { svgArr, image, worldImage, text, rect, uiRightEdge, releaseSprite, rectPos } from "../scripts/svg.js"
import { objectValues, screenPic } from "../scripts/del.js"
import { floatText } from "../scripts/floatText.js"
import { journalAdd, J_STD, J_RED, J_YELLOW } from "../scripts/journal.js"
import { openDialog } from "../scripts/dialog.js"
import { save } from "../scripts/save.js"
//исчезающий Древоброд уносит тень (как Волк/культист/огнементаль/Слаймэн);
//ростку — своя тень, как у порталов/объектов
import { removeEntShadow, removeObjShadow, objectShadow } from "../scripts/groundShadow.js"
//полёт и посадка кучки-награды — как у Кома слизи (slimeQuest/portalQuest)
import { placeDrop, dropFly } from "../scripts/dropSafe.js"
import { playback, strike } from "../scripts/sound.js"

const USE_TICKS = 45             //полоска взаимодействия (как у Слаймэна, ~0.72с)
const NEAR = [[0,0],[0,-1],[1,-1],[-1,-1],[1,0],[-1,0],[1,1],[-1,1],[0,1]]
const WANTED = 3                 //сколько ростков надо защитить
const TIMER_TICKS = 600          //10 секунд на росток
const SPAWN_EVERY = 60           //паук появляется раз в секунду
const EAT_DIST = 16              //паук у центра ростка — росток съеден
const NPC = 31                   //Древоброд (ent_64.png)
const SPIDER = 13                //Паук (штатный враг data.js)
const BODY_SLOT = 3              //слот ТЕЛА куклы (torso)
const BAR_BACK = "./images/UI/panels/bar1mini.png"
const SPROUT_SRC = "./images/dungeon/objects/plant.png"
const PORTRAIT = "./images/UI/doll/ent.png"

let useBarFill = null
let useBarBack = null
let useT = 0
//кучка-«Росток»: маркер хэндла → ветка подбора в takeDrop (WeakSet — записи
//умирают со сценой)
const entPiles = new WeakSet()

// ---------- окно «текущих квестов» (правый край, как у Слаймэна) ----------
let trackNodes = []
let trackBack = null
let trackCntEl = null
function trackerShow() {
    trackerHide()
    const x = 1612 + (uiRightEdge() - 1920)
    trackBack = rect(svgArr[2],x,252,296,88,"1px","rgb(204, 153, 102)","rgba(16, 12, 10, 0.85)",{"rx":"5px","id":"eqWinBack"})
    trackNodes.push(trackBack)
    trackNodes.push(text(svgArr[2],x + 148,284,"0pt","26pt","black","2px","rgb(204, 153, 102)",T("quest.ent.title"),{"id":"eqWinTitle","size":24,"font":"baseFont4","anchor":"middle"}))
    trackCntEl = text(svgArr[2],x + 20,322,"0pt","24pt","black","2px","rgb(204, 153, 102)",T("quest.ent.sprouts","0/" + WANTED),{"id":"eqWinCnt","size":22,"font":"baseFont4"})
    trackNodes.push(trackCntEl)
}
function trackerCount(q) {
    if (!trackCntEl) return
    trackCntEl.textContent = T("quest.ent.sprouts", q.saved + "/" + WANTED)
}
function trackerHide() {
    while (trackNodes.length > 0) {
        const n = trackNodes.pop()
        n && n.remove && n.remove()
    }
    trackBack = null
    trackCntEl = null
}

// ---------- спавн Древоброда (newGame: 4 глава, 2 этаж) ----------
export function entQuestNewGame(next) {
    clearSession()
    status.questEnt = null
    if (status.meta.page !== 4 || status.levelFloor !== 1) return
    if (status.meta.quests && status.meta.quests.ent) return
    spawnNpc()
}
function clearSession() {
    trackerHide()
    useBarFill && useBarFill.remove()
    useBarFill = null
    useBarBack && useBarBack.remove()
    useBarBack = null
    useT = 0
}
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
    return false
}
function startRoomRec(lv) {
    //стартовая комната — та, где спавнится герой (lv.hero), как в slimeQuest V134
    for (let k = 0; k < lv.roomsArr.length; k++) {
        const rf = lv.floor[lv.roomsArr[k][0]]
        if (lv.hero[0] >= rf[0] && lv.hero[0] < rf[0] + rf[2] && lv.hero[1] >= rf[1] && lv.hero[1] < rf[1] + rf[3]) return k
    }
    return 0
}
function spawnNpc() {
    const lv = dataGeneric.scenes[status.levelFloor]
    if (!lv.roomsArr || !lv.roomsArr.length) return
    const startIdx = startRoomRec(lv)
    const f = lv.floor[lv.roomsArr[startIdx][0]]
    //угол комнаты: первая свободная клетка из NEAR-окрестности угловой
    let cell = null
    for (let i = 0; i < NEAR.length && !cell; i++) {
        const cx = f[0] + 1 + NEAR[i][0]
        const cy = f[1] + 1 + NEAR[i][1]
        status.matrixLevel[cy] && status.matrixLevel[cy][cx] === 1 && !cellBusy(lv, cx, cy) && (cell = [cx, cy])
    }
    if (!cell) return
    const base = findClassById(NPC)
    if (!base) return
    status.questEnt = {"state":1,"room":[f[0],f[1],f[2],f[3]],"startIdx":startIdx,
        "npc":null,"sprouts":[],"saved":0}
    const q = status.questEnt
    //мирный Древоброд: класс 31 (анимации), entNpc=1 — не атакует (тик перехвачен)
    //и не атакуется (guard в attack.js, как slimeNpc V135)
    const anim = base.anims[2].others[2]
    objectValues.push({"id":status.oVcount,"type":"enemy","entNpc":1,"class":base,
    "stats":JSON.parse(JSON.stringify(base.stats)),
    "animCounters":60/anim.speed,"currentAnim":anim,"currentStill":0,"room":lv.roomsArr[startIdx],"cells":[],
    "state":0,"stop":0,"xCell":cell[0],"yCell":cell[1],"noStunTime":0,"direction":1,
    "img":image(svgArr[1],cell[0]*32,cell[1]*32-16,anim.w,anim.h,anim.img,
        {"times":anim.times,"id":status.oVcount,"frame":1})})
    status.oVcount++
    const e = objectValues[objectValues.length - 1]
    e.rect = e.img.clipRect
    q.npc = e
}
function removeNpc(q) {
    const e = q.npc
    if (!e) return
    removeEntShadow(e)
    const idx = objectValues.indexOf(e)
    idx !== -1 && objectValues.splice(idx, 1)
    releaseSprite(e.img)
    q.npc = null
}

// ---------- тик (gameLoop, после slimeQuestTick) ----------
export function entQuestTick() {
    const q = status.questEnt
    if (!q) return
    //ушли из стартовой комнаты ДО разговора — Древоброд исчезает (ТЗ V138)
    if (q.state === 1) {
        let anyInside = false
        for (let i = 0; i < status.players.length; i++) {
            const P = status.players[i]
            if (P.obj.type !== "hero") continue
            const hx = Math.trunc(P.x / 32)
            const hy = Math.trunc(P.y / 32)
            if (hx >= q.room[0] && hx < q.room[0] + q.room[2] && hy >= q.room[1] && hy < q.room[1] + q.room[3]) { anyInside = true; break }
        }
        if (!anyInside) {
            removeNpc(q)
            status.questEnt = null
            return
        }
        npcUseBarTick(q)
        return
    }
    if (q.state === 2) sproutsTick(q)
    //state 3 — вернулись за наградой: полоска снова активна
    q.state === 3 && npcUseBarTick(q)
}
//полоска взаимодействия с Древобродом: растёт у ближайшего героя; после диалога —
//recharge, снимается отходом (репорт V109, геометрия V136)
function npcUseBarTick(q) {
    const e = q.npc
    if (!e || objectValues.indexOf(e) === -1) return
    const wp = rectPos(e.rect)
    const HQ = nearestPlayer(wp[0], wp[1])
    if (!HQ) return
    const d = Math.hypot((HQ.x + 16) - (wp[0] + 16), (HQ.y + 25) - (wp[1] + 25))
    if (d > 56) {
        useT > 0 && (useT = 0)
        useBarFill && (useBarFill.remove(), useBarFill = null)
        useBarBack && (useBarBack.remove(), useBarBack = null)
        q.recharge = 0
        return
    }
    if (q.recharge) return
    useT++
    if (!useBarFill) {
        useBarFill = rect(svgArr[1],wp[0] - 9,wp[1] - 16,0,10,"none","0px","#cc9966",{"id":"entUseBar"})
        useBarBack = worldImage(svgArr[1],wp[0] - 11,wp[1] - 19,64,14,BAR_BACK,{"id":"entUseBarR"})
    }
    useBarFill.setAttribute("width", Math.trunc(60 * useT / USE_TICKS))
    if (useT >= USE_TICKS) {
        useBarFill.remove()
        useBarFill = null
        useBarBack && useBarBack.remove()
        useBarBack = null
        useT = 0
        q.recharge = 1
        q.state === 1 ? openStartDialog(q) : openFinalDialog(q)
    }
}

// ---------- ростки (state 2) ----------
function sproutsTick(q) {
    const level = dataGeneric.scenes[status.levelFloor]
    for (let i = 0; i < q.sprouts.length; i++) {
        const s = q.sprouts[i]
        if (!s.placed) {
            const rec = level.roomsArr[s.roomIdx]
            rec && rec[3] === 1 && placeSprout(level, s, rec)
            continue
        }
        if (!s.alive || s.done) continue
        s.ticks--
        if (s.ticks <= 0) {
            //таймер истёк, росток жив: спавн пауков в этой комнате прекращается
            s.done = 1
            q.saved++
            trackerCount(q)
            journalAdd(T("journ.ent.saved", q.saved), J_STD)
            if (q.saved >= WANTED) {
                q.state = 3
                journalAdd(T("journ.ent.return"), J_YELLOW)
            }
            continue
        }
        //каждую секунду — паук в случайном углу комнаты
        s.ticks % SPAWN_EVERY === 0 && spawnSpider(q, s)
    }
}
//ПОМОЧЬ: 3 случайных ЗАКРЫТЫХ комнаты (кроме стартовой и комнаты спуска);
//если закрытых меньше трёх — добираем открытыми не-стартовыми (росток у них
//появится сразу — комната уже открыта)
function chooseRooms(q) {
    const lv = dataGeneric.scenes[status.levelFloor]
    //клетка объекта-спуска (тип 13): его комната исключается
    const exitObj = lv.objects.find(o => o[2] === 13)
    const exitCell = exitObj ? [exitObj[0], exitObj[1]] : null
    const closed = []
    const open = []
    for (let k = 0; k < lv.roomsArr.length; k++) {
        if (k === q.startIdx) continue
        const rec = lv.roomsArr[k]
        const f = lv.floor[rec[0]]
        //острова-квесты (арена/загадка/напёрстки) строятся за границами карты — мимо
        if (f[0] + f[2] > lv.w || f[1] + f[3] > lv.h) continue
        if (exitCell && exitCell[0] >= f[0] && exitCell[0] < f[0] + f[2] &&
            exitCell[1] >= f[1] && exitCell[1] < f[1] + f[3]) continue
        ;(rec[3] === 1 ? open : closed).push(k)
    }
    closed.sort(() => Math.random() - 0.5)
    open.sort(() => Math.random() - 0.5)
    const pick = closed.slice(0, WANTED)
    for (let k = 0; pick.length < WANTED && k < open.length; k++) pick.push(open[k])
    q.sprouts = pick.map(k => ({"roomIdx":k,"placed":0,"alive":0,"done":0,"ticks":0,
        "cx":0,"cy":0,"px":0,"py":0,"img":null}))
}
function placeSprout(level, s, rec) {
    const f = level.floor[rec[0]]
    //середина комнаты; клетка пола любой проходимости (матрица 0 = стены/пустота,
    //2 = «тёмная» комната — до открытия её центр не 1); всё занято — ставим ПОВЕРХ:
    //тупик «росток не поставился никогда» хуже наложения на объект
    const mcx = f[0] + (f[2] >> 1)
    const mcy = f[1] + (f[3] >> 1)
    let cell = null
    const passable = (cy, cx) => !!(status.matrixLevel[cy] && status.matrixLevel[cy][cx] > 0)
    passable(mcy, mcx) && !cellBusy(level, mcx, mcy) && (cell = [mcx, mcy])
    for (let i = 0; i < NEAR.length && !cell; i++) {
        const cx = mcx + NEAR[i][0]
        const cy = mcy + NEAR[i][1]
        passable(cy, cx) && !cellBusy(level, cx, cy) && (cell = [cx, cy])
    }
    if (!cell) cell = [mcx, mcy]
    s.cx = cell[0]
    s.cy = cell[1]
    s.px = cell[0] * 32
    s.py = cell[1] * 32
    screenPic.push(worldImage(svgArr[1], s.px, s.py, 32, 32, SPROUT_SRC, {"id": screenPic.length + "O"}))
    s.img = screenPic[screenPic.length - 1]
    objectShadow(s.img)
    s.placed = 1
    s.alive = 1
    s.ticks = TIMER_TICKS
    journalAdd(T("journ.ent.sprout"), J_RED)
}
function spawnSpider(q, s) {
    const level = dataGeneric.scenes[status.levelFloor]
    const rec = level.roomsArr[s.roomIdx]
    const f = level.floor[rec[0]]
    //случайный угол комнаты: NEAR-окрестность угловой клетки, первая свободная
    //(матрица >0 — тёмные комнаты до открытия имеют 2, а спавн идёт в открытых)
    const corners = [[f[0] + 1, f[1] + 1], [f[0] + f[2] - 2, f[1] + 1],
        [f[0] + 1, f[1] + f[3] - 2], [f[0] + f[2] - 2, f[1] + f[3] - 2]]
    corners.sort(() => Math.random() - 0.5)
    let cell = null
    for (let c = 0; c < corners.length && !cell; c++) {
        for (let i = 0; i < NEAR.length && !cell; i++) {
            const cx = corners[c][0] + NEAR[i][0]
            const cy = corners[c][1] + NEAR[i][1]
            status.matrixLevel[cy] && status.matrixLevel[cy][cx] > 0 && !cellBusy(level, cx, cy) && (cell = [cx, cy])
        }
    }
    if (!cell) return
    const base = findClassById(SPIDER)
    if (!base) return
    //статы паука 4 главы — модификаторы глав как у штатных спавнов (encounters.js)
    const stats = JSON.parse(JSON.stringify(base.stats))
    stats.hp *= 2
    stats.dmg[0] += 2
    stats.dmg[1] += 4
    stats.speed += 1
    stats.range += 1
    stats.hp *= 1.5
    stats.dmg[0] += 2
    stats.dmg[1] += 8
    stats.speed += 2
    stats.range += 1
    //у паука НЕТ wait-строки (others = death×2) — стартовая поза ходьба-фронт,
    //как у крысы из объектов (encounters.createRat)
    const anim = base.anims[0].move[1]
    objectValues.push({"id":status.oVcount,"type":"enemy","entSpider":1,"class":base,"stats":stats,
    "_sprout":s,"animCounters":60/anim.speed,"currentAnim":anim,"currentStill":0,"room":rec,"cells":[],
    "state":0,"stop":0,"xCell":cell[0],"yCell":cell[1],"noStunTime":0,"direction":1,
    "img":image(svgArr[1],cell[0]*32,cell[1]*32-16,anim.w,anim.h,anim.img,
        {"times":anim.times,"id":status.oVcount,"frame":1})})
    status.oVcount++
    const e = objectValues[objectValues.length - 1]
    e.rect = e.img.clipRect
    const len = base.attacks.length
    for (let iA = 0; iA < len; iA++) {
        e.stats.attacksCd[iA] = Math.trunc(data.attacks[base.attacks[iA]].cooldown * 1000 / 16)
    }
}
//ПАУК ДОШЁЛ до ростка (вызов из enemyAI.entSpiderTick): квест провален
export function entQuestSproutEaten(s) {
    const q = status.questEnt
    if (!q || !s || !s.alive) return
    //все ростки убираются, пауки квеста становятся обычными врагами
    for (let i = 0; i < q.sprouts.length; i++) removeSprout(q.sprouts[i])
    for (let i = 0; i < objectValues.length; i++) {
        const o = objectValues[i]
        if (o && o.type === "enemy" && o.entSpider) {
            o.entSpider = 0
            o.noticed = 0
        }
    }
    removeNpc(q)
    trackerHide()
    status.questEnt = null
    journalAdd(T("journ.ent.fail"), J_RED)
}
function removeSprout(s) {
    s.alive = 0
    s.img && (s.img.remove(), removeObjShadow(s.img))
    s.img = null
}

// ---------- диалоги ----------
function openStartDialog(q) {
    openDialog({
        "right": PORTRAIT,
        "lines":[
            {"who":"hero","key":"dlg.ent.1"},
            {"who":"ent","key":"dlg.ent.2"},
            {"who":"hero","key":"dlg.ent.3"},
            {"who":"ent","key":"dlg.ent.4"},
            {"who":"hero","key":"dlg.ent.5"},
            {"who":"ent","key":"dlg.ent.6"},
            {"who":"hero","key":"dlg.ent.7"},
            {"who":"ent","key":"dlg.ent.8"}
        ],
        "choices":[
            {"label":"dlg.ent.deny","cb":() => denyEnd(q)},
            {"label":"dlg.ent.help","cb":() => startQuest(q)}
        ]
    })
}
//ОТКАЗАТЬСЯ: квест отменён, Древоброд исчезает
function denyEnd(q) {
    removeNpc(q)
    status.questEnt = null
    journalAdd(T("journ.ent.deny"), J_RED)
}
function startQuest(q) {
    q.state = 2
    chooseRooms(q)
    trackerShow()
    trackerCount(q)
    journalAdd(T("journ.ent.accept"), J_STD)
}
function openFinalDialog(q) {
    openDialog({
        "right": PORTRAIT,
        "lines":[{"who":"ent","key":"dlg.ent.final"}],
        "choices":[{"label":"dlg.ent.hmph","cb":() => hmphEnd(q)}]
    })
}
//ХМЫКНУТЬ: квест выполнен (мета сразу, как у Слаймэна) — Древоброд уходит,
//оставляя Росток (эффект вешает подбор — takeDrop)
function hmphEnd(q) {
    const e = q.npc
    const p = e ? rectPos(e.rect) : [status.hero.x, status.hero.y]
    removeNpc(q)
    screenPic.push(worldImage(svgArr[1], p[0] + 16, p[1] + 40, 32, 32, SPROUT_SRC, {"id": screenPic.length - 1}))
    const el = screenPic[screenPic.length - 1]
    placeDrop(el, p[0] + 16, p[1] + 40, 32, 32)
    dropFly(el, p[0] + 16, p[1] + 25)
    entPiles.add(el)
    journalAdd(T("journ.ent.item"), J_STD)
    status.meta.quests.ent = 1
    save()
    journalAdd(T("journ.ent.done"), J_YELLOW)
    trackerHide()
    status.questEnt = null
    playback(strike[3].vol,0,0,2*status.settings.soundVolume)
}

// ---------- награда (хук из takeDrop: подбор кучки-Ростка) ----------
//эффект «рост» — предмету на ТЕЛЕ (слот куклы 3). Тело пусто — подбор проходит,
//накладывать нечего (как у Кома слизи, решение пользователя)
export function entQuestTakePile(el) {
    if (!entPiles.has(el)) return false
    entPiles.delete(el)
    const w = status.inventory.doll[BODY_SLOT]
    if (w) {
        w.grow = 1
        countDopStats()
        journalAdd(T("journ.ent.grow", itemName(w)), J_YELLOW)
        floatText(status.hero.x - 16 + Math.trunc(Math.random() * 32), status.hero.y + 8, T("float.ent.grow"), "#66FF66", "18px", "none")
    }
    return true
}

// ---------- перехват тика мирного Древоброда из enemyAI.enemyTick ----------
export function entQuestNpcTickHook(enemy) {
    const q = status.questEnt
    if (!q || q.npc !== enemy) enemy.entNpc = 0
}

// ---------- смена сцены (del.js) ----------
export function entQuestDel() {
    clearSession()
    status.questEnt = null
}
