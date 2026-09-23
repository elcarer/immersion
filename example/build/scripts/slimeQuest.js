// ============================================================================
// slimeQuest.js — V133: сюжетный одноразовый квест «Корм слизи» (группа
// meta.quests наравне с Волком/порталом/огнементалем). Только 3 глава
// (meta.page===3), 1 этаж (levelFloor===0): в углу стартовой комнаты появляется
// ЗЕЛЁНЫЙ портал (тип 18, obj[12]=4 → 100c.png) и рядом рычаг (тип 19),
// переносящий в отдельную комнату 9×9 — четвёртый слот нижнего ряда «островов»
// под картой (арена x=3, загадка 17, напёрстки 31, эта — 45). Ушли из стартовой
// комнаты, не перенесясь, — портал и рычаг исчезают (как портал V109).
//
// В углу комнаты квеста — ВЫКЛЮЧЕННЫЙ возвратный портал и взведённый рычаг
// (юз рычага включает портал, юз портала возвращает к стартовому и снова
// взводит рычаг — цикл как у арены V64). В противоположном углу — мирный
// Слаймэн (id 30, лист slime_64.png). Диалог: «ОСТАВИТЬ» — ничего;
// «ПОИСКАТЬ» — квест начат: 3 случайных ТИПА ячеек предметов (пул itemGenerate
// 0..12), в правом квестовом окне «Найдено:» и строки записей.
//
// Кормление: выброшенный на «УДАЛИТЬ» предмет РЯДОМ со Слаймэном (хук из
// drag.js): тип подходит и ещё не съеден — кучка летит К слизню и исчезает при
// приземлении (метка _slimeFed, ветка в takeDrop), запись «<имя>: подошёл»;
// не подходит — остаётся на полу, запись «<имя>: неподошёл». Пока квест идёт,
// каждый юз активируемого объекта даёт дополнительный серый предмет (кучка
// item1.png = штатная takeItem(1)). Три съеденных типа — финальный диалог:
// «ПОДОЖДАТЬ» — Слаймэн исчезает, оставляя Ком слизи (подбор = эффект «слизь»
// предмету в ЛЕВОЙ руке: получив урон от врага, тот враг теряет 1 макс. атаки,
// оверлей effects/slimeShield.png на иконке — по механике «Погоня за пламенем»);
// «НАПАСТЬ» — Слаймэн становится врагом (штатный ИИ, атака 26), после победы
// выпадают ТРИ съеденных предмета (кучки itemDrops с точным возвратом).
// Любая кнопка финала — квест выполнен (meta.quests.slime=1, save сразу).
// ============================================================================
import { status } from "../scripts/start.js"
//V117: кооператив — полоску растит ближайший живой герой
import { nearestPlayer } from "../scripts/players.js"
import { T, itemName } from "../scripts/localization.js"
import { data } from "../scripts/data.js"
import { dataGeneric, createRoom, createMatrix } from "../scripts/sceneGenerate.js"
import { svgArr, image, worldImage, text, rect, uiRightEdge, releaseSprite, rectPos, picById } from "../scripts/svg.js"
import { objectValues, screenPic } from "../scripts/del.js"
import { floatText } from "../scripts/floatText.js"
import { journalAdd, J_STD, J_RED, J_YELLOW } from "../scripts/journal.js"
import { openDialog } from "../scripts/dialog.js"
import { save } from "../scripts/save.js"
//исчезающий Слаймэн уносит тень (как Волк/культист/огнементаль)
import { removeEntShadow, removeObjShadow, objectShadow } from "../scripts/groundShadow.js"
//штатные хелперы порталов (телепорты переносят ОБОИХ игроков — V123)
import { setObjectState, freeCellNear, teleportHero } from "../scripts/portalFx.js"
//спрайты портала/рычага по фазе (obj[12]=4 — зелёный 100c.png, V133)
import { portalSpriteSrc } from "../scripts/portalSprite.js"
//полёт и посадка кучек — как в portalQuest/flameQuest
import { placeDrop, dropFly } from "../scripts/dropSafe.js"
//точный возврат съеденных предметов после боя (цикл useObject↔slimeQuest легален:
//обращение к itemDrops только в рантайме, как portalFx↔portalQuest)
import { itemDrops } from "../scripts/useObject.js"
import { playback, strike } from "../scripts/sound.js"

const USE_TICKS = 45             //полоска взаимодействия (как у Волка/культиста, ~0.72с)
const NEAR = [[0,0],[0,-1],[1,-1],[-1,-1],[1,0],[-1,0],[1,1],[-1,1],[0,1]]
const FEED_DIST = 68             //радиус кормления (как зона портала V109)
const WANTED = 3                 //сколько типов надо принести
const CLOD_SRC = "./images/effects/slimeShield.png"   //иконка Кома слизи
const BAR_BACK = "./images/UI/panels/bar1mini.png"    //задний фрейм полоски юза
const PORTAL_RED = "./images/dungeon/objects/100b.png"

let useBarFill = null
let useBarBack = null
let useT = 0
//кучка-«Ком слизи»: маркер хэндла → ветка подбора в takeDrop (WeakSet — записи
//умирают со сценой)
const slimePiles = new WeakSet()

// ---------- окно «текущих квестов» (правый край, как у Волка/огнементля) ----------
let trackNodes = []
let trackBack = null
let trackRecEls = []
const TRACK_MAX = 10             //строк записей в окне (старые вытесняются)
function trackerShow() {
    trackerHide()
    const x = 1612 + (uiRightEdge() - 1920)
    trackBack = rect(svgArr[2],x,252,296,120,"1px","rgb(204, 153, 102)","rgba(16, 12, 10, 0.85)",{"rx":"5px","id":"sqWinBack"})
    trackNodes.push(trackBack)
    trackNodes.push(text(svgArr[2],x + 148,284,"0pt","26pt","black","2px","rgb(204, 153, 102)",T("quest.slime.title"),{"id":"sqWinTitle","size":24,"font":"baseFont4","anchor":"middle"}))
    trackNodes.push(text(svgArr[2],x + 20,320,"0pt","24pt","black","2px","rgb(204, 153, 102)",T("quest.slime.found"),{"id":"sqWinFound","size":22,"font":"baseFont4"}))
}
//строка записи: «<предмет>: подошёл» (зелёная) / «<предмет>: неподошёл» (красная)
function trackerRecord(name, fit) {
    if (!trackBack) return
    if (trackRecEls.length >= TRACK_MAX) {
        const old = trackRecEls.shift()
        old && old.remove && old.remove()
        for (let i = 0; i < trackRecEls.length; i++) {
            trackRecEls[i] && trackRecEls[i].setAttribute("y", 348 + i * 24)
        }
    }
    const x = 1612 + (uiRightEdge() - 1920)
    const el = text(svgArr[2],x + 20,348 + trackRecEls.length * 24,"0pt","20pt","black","2px",
        fit ? "rgb(140, 220, 140)" : "rgb(210, 150, 140)",
        name + ": " + T(fit ? "quest.slime.fit" : "quest.slime.nofit"),
        {"id":"sqRec" + trackRecEls.length,"size":18,"font":"baseFont4"})
    trackRecEls.push(el)
    trackNodes.push(el)
    trackBack.setAttribute("height", 120 + trackRecEls.length * 24 + 8)
}
function trackerHide() {
    while (trackNodes.length > 0) {
        const n = trackNodes.pop()
        n && n.remove && n.remove()
    }
    trackBack = null
    trackRecEls = []
}

// ---------- спавн зелёного портала и рычага (newGame: 3 глава, 1 этаж) ----------
export function slimeQuestNewGame(next) {
    clearSession()
    status.questSlime = null
    if (next === false) return
    //одноразовый сюжетный: выполненный (мета) не предлагается
    if (status.meta.page !== 3 || status.levelFloor !== 0) return
    if (status.meta.quests && status.meta.quests.slime) return
    spawnStartObjects()
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
    return x === level.hero[0] && y === level.hero[1]
}
function spawnStartObjects() {
    const lv = dataGeneric.scenes[status.levelFloor]
    if (!lv.roomsArr || !lv.roomsArr[0]) return
    const f = lv.floor[lv.roomsArr[0][0]]
    //угол стартовой комнаты (клетка внутрь от угла, как у Волка/портала):
    //портал + СВОБОДНАЯ соседняя клетка под рычаг
    const free = []
    for (let i = 0; i < NEAR.length; i++) {
        const cx = f[0] + 1 + NEAR[i][0]
        const cy = f[1] + 1 + NEAR[i][1]
        status.matrixLevel[cy] && status.matrixLevel[cy][cx] === 1 && !cellBusy(lv, cx, cy) && free.push([cx, cy])
    }
    if (!free.length) return
    const pcell = free[0]
    const lcell = free.find(c => Math.abs(c[0] - pcell[0]) + Math.abs(c[1] - pcell[1]) === 1) || free[1] || null
    status.questSlime = {"state":1,"entered":0,"room":[f[0],f[1],f[2],f[3]],"portal":null,"lever":null,
        "npc":null,"roomObj":null,"backPortal":null,"backLever":null,"entry":null,
        "wanted":[],"fedTypes":[],"fedItems":[],"fedCount":0,"ready":0,"finalShown":0,"recharge":0}
    const q = status.questSlime
    lv.objects.push([pcell[0], pcell[1], 18, 1, 1, undefined])
    const portal = lv.objects[lv.objects.length - 1]
    portal[9] = lv.roomsArr[0]
    portal[10] = 1
    portal[12] = 4               //зелёный вид — 100c.png (V133)
    q.portal = portal
    //портал 64×84 в живой сцене — та же геометрия, что drawQuestPortal (V109)
    screenPic.push(worldImage(svgArr[1], pcell[0]*32 + 16 - 32, pcell[1]*32 + 32 - 84, 64, 84, portalSpriteSrc(portal), {"id": screenPic.length + "O"}))
    portal[6] = screenPic.length - 1
    objectShadow(screenPic[portal[6]])
    if (lcell) {
        lv.objects.push([lcell[0], lcell[1], 19, 1, 1, undefined])
        const lever = lv.objects[lv.objects.length - 1]
        lever[9] = lv.roomsArr[0]
        lever[10] = 1
        q.lever = lever
        //рычаг 32×32 рисуется сразу — стартовая комната уже отрисована
        screenPic.push(worldImage(svgArr[1], lcell[0]*32, lcell[1]*32, 32, 32, portalSpriteSrc(lever), {"id": screenPic.length + "O"}))
        lever[6] = screenPic.length - 1
    }
}
function removeStartObjects(q) {
    const level = dataGeneric.scenes[status.levelFloor]
    for (const o of [q.portal, q.lever]) {
        if (!o) continue
        const idx = level.objects.indexOf(o)
        idx !== -1 && level.objects.splice(idx, 1)
        const img = o[6] !== undefined ? screenPic[o[6]] : null
        img && img.remove()
        img && removeObjShadow(img)
    }
    q.portal = null
    q.lever = null
    useBarFill && useBarFill.remove()
    useBarFill = null
    useBarBack && useBarBack.remove()
    useBarBack = null
    useT = 0
}

// ---------- тик (gameLoop, после flameQuestTick) ----------
export function slimeQuestTick() {
    const q = status.questSlime
    if (!q) return
    //ушли из стартовой комнаты ДО первой телепортации рычагом — портал и рычаг
    //исчезают (репорт-логика V109). q.entered ставит юз стартового рычага: после
    //переноса в комнату квеста игроки ВНЕ стартовой — это не повод удалять квест
    if (q.state === 1 && !q.entered) {
        let anyInside = false
        for (let i = 0; i < status.players.length; i++) {
            const P = status.players[i]
            if (P.obj.type !== "hero") continue
            const hx = Math.trunc(P.x / 32)
            const hy = Math.trunc(P.y / 32)
            if (hx >= q.room[0] && hx < q.room[0] + q.room[2] && hy >= q.room[1] && hy < q.room[1] + q.room[3]) { anyInside = true; break }
        }
        if (!anyInside) {
            removeStartObjects(q)
            status.questSlime = null
            return
        }
    }
    ;(q.state === 1 || q.state === 2) && npcUseBarTick(q)
}
//полоска взаимодействия с мирным Слаймэном: герой рядом — растёт (как у культиста);
//после диалога — recharge, снимается выходом героя из зоны (репорт V109)
function npcUseBarTick(q) {
    const e = q.npc
    if (!e || objectValues.indexOf(e) === -1) return
    const wp = rectPos(e.rect)
    const HQ = nearestPlayer(wp[0], wp[1])
    if (!HQ) return
    const d = Math.hypot((HQ.x + 16) - (wp[0] + 16), (HQ.y + 25) - (wp[1] + 25))
    if (d > 56) {
        useT > 0 && (useT = 0)
        useBarFill && useBarFill.setAttribute("width", 0)
        q.recharge = 0
        return
    }
    if (q.recharge) return
    useT++
    if (!useBarFill) {
        useBarFill = rect(svgArr[1],wp[0] - 9,wp[1] - 16,0,6,"none","0px","#cc9966",{"id":"slimeUseBar"})
        //V133 (репорт юзера): задний фрейм bar1mini — как у полосок интерактивных
        //объектов (фикс и для волка/огнементля/культиста — в их модулях)
        useBarBack = worldImage(svgArr[1],wp[0] - 11,wp[1] - 19,64,14,BAR_BACK,{"id":"slimeUseBarR"})
    }
    useBarFill.setAttribute("width", Math.trunc(50 * useT / USE_TICKS))
    if (useT >= USE_TICKS) {
        useBarFill.remove()
        useBarFill = null
        useBarBack && useBarBack.remove()
        useBarBack = null
        useT = 0
        q.recharge = 1
        q.state === 1 ? openStartDialog(q) : openRemindDialog()
    }
}

// ---------- комната квеста (9×9, четвёртый слот нижнего ряда) ----------
function buildQuestRoom() {
    const q = status.questSlime
    const level = dataGeneric.scenes[status.levelFloor]
    //слоты «островов» под картой: арена x=3, загадка 17, напёрстки 31 — эта четвёртая
    const rx = 45
    const ry = level.h + 3
    const SZ = 9
    level.h = ry + SZ + 3
    const floorIdx = level.floor.length
    //пол-прямоугольник и кольцо стен — рецепт createArena (9×9)
    level.floor.push([rx, ry, SZ, SZ, 3, rx + 4, ry + 4])
    const walls = level.walls
    walls.push([rx, ry, 6, 1, 1])
    walls.push([rx + 8, ry, 7, 1, 1])
    for (let k = 1; k < 8; k++) {
        walls.push([rx + k, ry, 20, 1, 1])
        walls.push([rx, ry + k, 22, 1, 1])
        walls.push([rx + 8, ry + k, 21, 1, 1])
        walls.push([rx + k, ry + 8, 19, 1, 2])
    }
    walls.push([rx, ry + 8, 3, 1, 2])
    walls.push([rx + 8, ry + 8, 2, 1, 2])
    //спек из пустых групп (формат openRoom); [3]=1 — комната сразу открыта (openRoom
    //не вызовется, как у сети V109) — и комнаты [3]=1 попадают в navMatrix ИИ
    const spec = []
    for (let g = 0; g < 6; g++) spec.push([0, 0])
    const room = [floorIdx, SZ * SZ, spec, 1]
    room[4] = 1
    const roomIdx = level.roomsArr.length
    level.roomsArr.push(room)
    //выключенный возвратный портал (1,1) и взведённый рычаг (2,1) в углу
    level.objects.push([rx + 1, ry + 1, 18, 1, 1, undefined])
    const bp = level.objects[level.objects.length - 1]
    bp[9] = room
    bp[10] = 0
    level.objects.push([rx + 2, ry + 1, 19, 1, 1, undefined])
    const bl = level.objects[level.objects.length - 1]
    bl[9] = room
    bl[10] = 1
    q.backPortal = bp
    q.backLever = bl
    //отрисовка сразу (герой войдёт телепортом в тот же тик) + матрица проходимости
    createRoom(level, roomIdx, 32, 32)
    createMatrix()
    q.roomObj = room
    q.entry = [rx + 4, ry + 5]
    spawnSlimeNpc(room, rx + 7, ry + 7)
}
function spawnSlimeNpc(room, cx, cy) {
    const q = status.questSlime
    const base = findClassById(30)
    const lider = findClassById(4)
    if (!base || !lider) return
    //класс Слаймэна (анимации, ближняя атака 26 в attackNew), статы боя — рецепт
    //культиста/огнементля: вождь гоблинов (id 4) с модификаторами глав до 3-й
    //(этаж 3 главы). Без boss/elite: нет полосы босса, зачёта bossKill и ключа элит
    const c = JSON.parse(JSON.stringify(base))
    delete c.boss
    delete c.elite
    const stats = JSON.parse(JSON.stringify(lider.stats))
    stats.hp *= 2; stats.dmg[0] += 1; stats.dmg[1] += 2
    stats.hp *= 2; stats.dmg[0] += 2; stats.dmg[1] += 6; stats.speed += 1; stats.range += 1
    stats.hp *= 1.5; stats.dmg[0] += 2; stats.dmg[1] += 8; stats.speed += 2; stats.range += 1
    stats.exp = 10
    const anim = c.anims[2].others[2]
    objectValues.push({"id":status.oVcount,"type":"enemy","slimeNpc":1,"class":c,"stats":stats,
    "animCounters":60/anim.speed,"currentAnim":anim,"currentStill":0,"room":room,"cells":[],
    "state":0,"stop":0,"xCell":cx,"yCell":cy,"noStunTime":0,"direction":1,
    "img":image(svgArr[1],cx*32,cy*32-16,anim.w,anim.h,anim.img,
        {"times":anim.times,"id":status.oVcount,"frame":1})})
    status.oVcount++
    const e = objectValues[objectValues.length - 1]
    e.rect = e.img.clipRect
    e.stats.attacksCd[0] = Math.trunc(data.attacks[26].cooldown * 1000 / 16)
    q.npc = e
}

// ---------- юз портала/рычага (хук из portalFx.portalUse) ----------
export function slimeQuestUse(obj) {
    const q = status.questSlime
    if (!q) return false
    if (obj === q.lever) {
        //стартовый рычаг: перенос в комнату квеста (комната создаётся лениво, один раз)
        if (q.state === 3) return true
        if (!q.roomObj) buildQuestRoom()
        if (!q.roomObj) return true
        q.entered = 1          //перенос состоялся — проверка исчезновения больше не действует
        teleportHero(q.entry[0], q.entry[1])
        return true
    }
    if (obj === q.backLever) {
        //рычаг комнаты: включает возвратный портал (сам гаснет, как аренный)
        if (q.backPortal[10] === 1) return true
        setObjectState(obj, 0)
        setObjectState(q.backPortal, 1)
        return true
    }
    if (obj === q.backPortal) {
        //возвратный портал: телепорт к стартовому порталу; портал гаснет, рычаг взводится
        //(пере-взвод как у арены V64a — иначе герой, вернувшись, остался бы без входа)
        if (q.backPortal[10] !== 1) return true
        const level = dataGeneric.scenes[status.levelFloor]
        const cell = q.portal ? freeCellNear(level, q.portal[0], q.portal[1]) : null
        if (!cell) return true
        setObjectState(obj, 0)
        q.backLever && setObjectState(q.backLever, 1)
        teleportHero(cell[0], cell[1])
        return true
    }
    return false
}

// ---------- кормление (хук из drag.js: предмет выброшен на «УДАЛИТЬ») ----------
//возвращает null (обычный дроп на пол) либо [x,y] — посадку КУЧКИ К СЛИЗНЮ:
//подошедший предмет улетает к нему и исчезает при «переваривании» (_slimeFed)
export function slimeQuestFeedSpot(item, P) {
    const q = status.questSlime
    if (!q || q.state !== 2) return null
    const e = q.npc
    if (!e || objectValues.indexOf(e) === -1) return null
    const wp = rectPos(e.rect)
    const d = Math.hypot((P.x + 16) - (wp[0] + 16), (P.y + 25) - (wp[1] + 25))
    if (d > FEED_DIST) return null
    const nm = itemName(item)
    const fit = q.wanted.findIndex(t => q.fedTypes.indexOf(t) === -1 &&
        item.types && item.types.indexOf(t) !== -1)
    if (fit === -1) {
        trackerRecord(nm, 0)
        return null
    }
    q.fedTypes.push(q.wanted[fit])
    q.fedItems.push(item)
    q.fedCount++
    trackerRecord(nm, 1)
    journalAdd(T("journ.slime.feed", nm), J_STD)
    q.fedCount >= WANTED && (q.ready = 1)
    return [wp[0] + 16 - 14, wp[1] + 40]
}
//кучка-корм приземлилась (ветка в takeDrop до проверки хитбокса): исчезает; третий
//съеденный тип открывает финальный диалог
export function slimeQuestFedLanded(el) {
    delete el._slimeFed
    const q = status.questSlime
    if (q && q.ready && !q.finalShown) {
        q.finalShown = 1
        openFinalDialog(q)
    }
}

// ---------- диалоги ----------
function openStartDialog(q) {
    openDialog({
        "right": "./images/UI/doll/slime.png",
        "lines":[
            {"who":"slime","key":"dlg.slime.1"},
            {"who":"hero","key":"dlg.slime.2"},
            {"who":"slime","key":"dlg.slime.3"},
            {"who":"hero","key":"dlg.slime.4"}
        ],
        "choices":[
            {"label":"dlg.slime.leave","cb":null},
            {"label":"dlg.slime.search","cb":() => startQuest(q)}
        ]
    })
}
//ПОИСКАТЬ: 3 случайных ТИПА ячеек из пула генерации (0..12), без повторов
function startQuest(q) {
    q.state = 2
    const pool = []
    for (let t = 0; t < 13; t++) pool.push(t)
    pool.sort(() => Math.random() - 0.5)
    q.wanted = pool.slice(0, WANTED)
    q.fedTypes = []
    q.fedItems = []
    q.fedCount = 0
    q.ready = 0
    trackerShow()
    journalAdd(T("journ.slime.accept"), J_STD)
}
function openRemindDialog() {
    openDialog({
        "right": "./images/UI/doll/slime.png",
        "lines":[{"who":"slime","key":"dlg.slime.remind"}],
        "choices":[{"label":"dlg.slime.dots","cb":null}]
    })
}
function openFinalDialog(q) {
    openDialog({
        "right": "./images/UI/doll/slime.png",
        "lines":[{"who":"slime","key":"dlg.slime.final"}],
        "choices":[
            {"label":"dlg.slime.wait","cb":() => waitEnd(q)},
            {"label":"dlg.slime.attack","cb":() => fight(q)}
        ]
    })
}
//любая кнопка финала = квест выполнен: мета сразу (решение пользователя)
function questDone(q) {
    status.meta.quests.slime = 1
    save()
    //стартовый портал — красный и мёртвый (как после сети V109), рычаг исчезает
    if (q.portal) {
        q.portal[10] = 0
        q.portal[12] = 3
        const img = q.portal[6] !== undefined ? screenPic[q.portal[6]] : null
        img && img.setAttribute("href", PORTAL_RED)
    }
    const level = dataGeneric.scenes[status.levelFloor]
    if (q.lever) {
        const idx = level.objects.indexOf(q.lever)
        idx !== -1 && level.objects.splice(idx, 1)
        const lim = q.lever[6] !== undefined ? screenPic[q.lever[6]] : null
        lim && lim.remove()
        q.lever = null
    }
    journalAdd(T("journ.slime.done"), J_YELLOW)
    playback(strike[3].vol,0,0,2*status.settings.soundVolume)
}
//ПОДОЖДАТЬ: Слаймэн уползает, оставляя Ком слизи (эффект вешает подбор — takeDrop)
function waitEnd(q) {
    const e = q.npc
    const p = rectPos(e.rect)
    removeEntShadow(e)
    const idx = objectValues.indexOf(e)
    idx !== -1 && objectValues.splice(idx, 1)
    releaseSprite(e.img)
    q.npc = null
    screenPic.push(worldImage(svgArr[1], p[0] + 16, p[1] + 40, 32, 32, CLOD_SRC, {"id": screenPic.length - 1}))
    const el = screenPic[screenPic.length - 1]
    placeDrop(el, p[0] + 16, p[1] + 40, 32, 32)
    dropFly(el, p[0] + 16, p[1] + 25)
    slimePiles.add(el)
    journalAdd(T("journ.slime.clod"), J_STD)
    questDone(q)
    trackerHide()
    status.questSlime = null
}
//НАПАСТЬ: Слаймэн становится обычным врагом (штатный ИИ, ближняя атака 26);
//q не обнуляем — съеденные предметы вернутся в slimeQuestEnemyDie
function fight(q) {
    const e = q.npc
    e.slimeNpc = 0
    e.slimeFight = 1
    e.noticed = 1
    e.called = 1
    q.state = 3
    journalAdd(T("journ.slime.fight"), J_RED)
    questDone(q)
    trackerHide()
}

// ---------- дроп/подбор (хуки из enemyAI.enemyDie и takeDrop) ----------
//победа в бою (НАПАСТЬ): возвращаются ТРИ съеденных предмета — точный возврат
export function slimeQuestEnemyDie(enemy) {
    if (!enemy.slimeFight) return
    const q = status.questSlime
    if (!q) return
    const p = rectPos(enemy.rect)
    for (let i = 0; i < q.fedItems.length; i++) {
        const it = q.fedItems[i]
        screenPic.push(worldImage(svgArr[1], p[0] + 16, p[1] + 55, 28, 32, it.img, {"id": screenPic.length - 1}))
        const el = screenPic[screenPic.length - 1]
        placeDrop(el, p[0] + 16, p[1] + 55, 28, 32)
        dropFly(el, p[0] + enemy.rect._w / 2, p[1] + enemy.rect._h / 2)
        itemDrops.set(el, it)
    }
    status.questSlime = null
}
//подбор Кома слизи: эффект «слизь» — предмету в ЛЕВОЙ руке (слот куклы 12).
//Левая рука пуста — подбор проходит, накладывать нечего (решение пользователя,
//как у «Погоня за пламенем»)
export function slimeQuestTakePile(el) {
    if (!slimePiles.has(el)) return false
    slimePiles.delete(el)
    const w = status.inventory.doll[12]
    if (w) {
        w.slime = 1
        journalAdd(T("journ.slime.clodItem"), J_YELLOW)
        floatText(status.hero.x - 16 + Math.trunc(Math.random() * 32), status.hero.y + 8, T("float.slime"), "#66FF66", "18px", "none")
    }
    return true
}
//эффект «слизь»: герой, получивший урон от врага (хук из damageHero.countDamage),
//снижает МАКСИМАЛЬНУЮ атаку этого врага на 1 (не ниже минимальной)
export function slimeRetaliate(attacker) {
    const w = status.inventory.doll[12]
    if (!w || !w.slime) return
    const st = attacker && attacker.stats
    if (!st || !st.dmg || st.dmg[1] <= st.dmg[0]) return
    st.dmg[1]--
    const p = rectPos(attacker.rect)
    floatText(p[0] + 16, p[1], "-1", "#66FF66", "16px", "none")
}
//пока квест идёт: каждый юз активируемого объекта даёт доп. серый предмет
//(кучка item1.png = штатная ветка takeItem(1)); вызов из useObject.finishUsedObject
export function slimeQuestExtraDrop(obj) {
    const q = status.questSlime
    if (!q || q.state !== 2) return
    const img = picById(obj[6] + "OI")
    const bx = img ? img.x.animVal.value : obj[0] * 32
    const by = img ? img.y.animVal.value : obj[1] * 32
    const x = bx + Math.trunc(Math.random() * obj[3] * 16)
    const y = by + obj[4] * 32 + Math.trunc(Math.random() * 16) - 16
    screenPic.push(worldImage(svgArr[1], x, y, 32, 36, "./images/dungeon/drop/item1.png", {"id": screenPic.length - 1}))
    const el = screenPic[screenPic.length - 1]
    placeDrop(el, x, y, 32, 36)
    dropFly(el, bx + obj[3] * 16, by + obj[4] * 16)
}

// ---------- перехват тика мирного Слаймэна из enemyAI.enemyTick ----------
export function slimeQuestNpcTickHook(enemy) {
    const q = status.questSlime
    if (!q || q.npc !== enemy) enemy.slimeNpc = 0
}

// ---------- смена сцены (del.js) ----------
export function slimeQuestDel() {
    clearSession()
    status.questSlime = null
}
