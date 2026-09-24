// ============================================================================
// hrupQuest.js — V140: сюжетный одноразовый квест «Гонка за сокровищами».
// Только 4 глава (meta.page===4), 1 ЭТАЖ (levelFloor===0): в углу стартовой
// комнаты появляется мирный Хруп (id 32, лист hrup_64.png, hrupNpc=1 — не
// атакует и не атакуется). Полоска взаимодействия открывает диалог с выбором:
// «АТАКОВАТЬ» — Хруп становится обычным врагом (hrupNpc=0, штатный ИИ, атака
// 28); его смерть (hrupQuestEnemyDie) даёт 2 случайных ЭПИЧЕСКИХ предмета
// (кучки hrupEpicDrops → takeItem(2), редкость #3300ff) и meta.quests.hrup=1;
// «ОБОГНАТЬ» — ГОНКА: Хруп остаётся мирным, но действует самостоятельно (тик
// перехвачен из enemyAI.enemyTick в hrupRacerTick): бегает по этажу, открывает
// коридоры (createCorridor), неоткрытые комнаты (createRoom+openRoom — враги
// комнаты спавнятся штатно) и двери (href-смена по таблице openDoor.js),
// убивает врагов комнат (прямой урон в середине замаха — атрибуция вклада по
// _hrupKillTarget) и «портит» активируемые объекты (obj[7]=1 + спрайт *d.png —
// герои их больше не активируют). Комната считается ЗАЧИЩЕННОЙ, когда она
// открыта, в ней нет живых врагов и все активируемые объекты использованы;
// зачитывается тому, кто внёс больше вклада (убийства + объекты; при равенстве
// — герою). Чей счёт первым достиг 3 — тот победил: Хруп — диалог «Ха-ха-ха!
// Победил!» (meta, исчезает); герой — «Нет! Нечестно!…Ладно, держи! Выиграл!»
// (meta, исчезает, оставляя ПОВЯЗКУ: подбор вешает эффект на предмет ПОЯСА
// (слот куклы 10 «талия», пусто — не накладывает, как Ком слизи): +5% к
// передвижению (barbMoveBonus в countDopStats), оверлей effects/barbTrue.png.
// ============================================================================
import { status } from "../scripts/start.js"
//V117: кооператив — полоску растит ближайший живой герой
import { nearestPlayer } from "../scripts/players.js"
import { T } from "../scripts/localization.js"
import { data } from "../scripts/data.js"
import { dataGeneric, createRoom } from "../scripts/sceneGenerate.js"
import { openRoom } from "../scripts/openRoom.js"
import { createCorridor } from "../scripts/heroMove.js"
//V111: режим «лава в коридорах» — свежие клетки Хрупа заливаются как у героя
import { flameQuestCorridorOpen } from "../scripts/flameQuest.js"
import { animInterval, setEnemyPose, damageEnemy } from "../scripts/enemyAI.js"
//эпик-кучки Хрупа: подбор — takeItem(2) без фильтра оружия (ветка в takeDrop)
import { bossWeaponDrops } from "../scripts/useObject.js"
//+5% к передвижению пересчитывается сразу (цикла нет: countDopStats импортирует только relics/blessFx/start)
import { countDopStats } from "../scripts/countDopStats.js"
import { svgArr, image, worldImage, text, rect, uiRightEdge, releaseSprite, rectPos, picById, moveSprite } from "../scripts/svg.js"
import { objectValues, screenPic, doorPics, wallsOverlay } from "../scripts/del.js"
import { floatText } from "../scripts/floatText.js"
import { journalAdd, J_STD, J_RED, J_YELLOW } from "../scripts/journal.js"
import { openDialog, closeDialogHard } from "../scripts/dialog.js"
import { save } from "../scripts/save.js"
import { removeEntShadow } from "../scripts/groundShadow.js"
//полёт и посадка кучек-наград — как у Ростка (entQuest)
import { placeDrop, dropFly } from "../scripts/dropSafe.js"
import { playback, strike } from "../scripts/sound.js"

const USE_TICKS = 45             //полоска взаимодействия (как у Древоброда)
const NEAR = [[0,0],[0,-1],[1,-1],[-1,-1],[1,0],[-1,0],[1,1],[-1,1],[0,1]]
const WANTED = 3                 //комнат до победы в гонке
const NPC = 32                   //Хруп (hrup_64.png)
const BELT_SLOT = 10             //слот ПОЯСА куклы («талия»)
const RACER_SPEED = 24           //скорость Хрупа-гонщика: mv=2px/тик — как шаг героя
                                 //(V140a: было 12 (полускорость); со честными путями
                                 //(BFS только по полу) гонка при 12 не имела шансов)
const FOE_RANGE = 44             //дистанция удара по врагу
const OBJ_RANGE = 40             //дистанция поломки объекта
const BAR_BACK = "./images/UI/panels/bar1mini.png"
const SASH_SRC = "./images/effects/barbTrue.png"   //кучка-Повязка
const EPIC_SRC = "./images/dungeon/drop/item2.png" //кучка эпического предмета
const PORTRAIT = "./images/UI/doll/hrup.png"
//«разрушенный» вид объекта: href спрайта -> *d.png (рецепт useObject.actionsObject);
//активируемые типы объектов зачистки — все, кроме спуска (13)
const BREAKABLE = new Set([1,2,3,4,5,6,7,8,9,10,11,12,14,15,16,17,18,19,20,21,22])
//закрытые/открытые дверные текстуры (таблица openDoor.js, все 3 этажа)
const DOOR_WALLS = [
    ["./images/dungeon/walls/9.png","./images/dungeon/walls/27.png"],
    ["./images/dungeon/walls/12.png","./images/dungeon/walls/28.png"],
    ["./images/dungeon/walls/23.png","./images/dungeon/walls/29.png"],
    ["./images/dungeon/walls/24.png","./images/dungeon/walls/30.png"],
    ["./images/dungeon/walls/39.png","./images/dungeon/walls/57.png"],
    ["./images/dungeon/walls/42.png","./images/dungeon/walls/58.png"],
    ["./images/dungeon/walls/53.png","./images/dungeon/walls/59.png"],
    ["./images/dungeon/walls/54.png","./images/dungeon/walls/60.png"],
    ["./images/dungeon/walls/69.png","./images/dungeon/walls/87.png"],
    ["./images/dungeon/walls/72.png","./images/dungeon/walls/88.png"],
    ["./images/dungeon/walls/83.png","./images/dungeon/walls/90.png"],
    ["./images/dungeon/walls/84.png","./images/dungeon/walls/89.png"],
]
const OPEN_OVERLAYS = new Set([27,28,57,58,87,88].map(n => "./images/dungeon/walls/" + n + ".png"))

let useBarFill = null
let useBarBack = null
let useT = 0
//эпик-кучки Хрупа (Map кучка -> редкость 2): подбор — любой случайный эпический предмет
const hrupEpicDrops = new Map()
//кучки-Повязки: маркер хэндла → ветка подбора в takeDrop
const hrupPiles = new WeakSet()
//враг, по которому Хруп наносит удар ПРЯМЫМ уроном (синхронно: damageEnemy может
//убить в том же вызове — enemyDie прочитает метку и зачтёт вклад Хрупу)
let hrupKillTarget = null

// ---------- окно «текущих квестов» (правый край, как у Древоброда) ----------
let trackNodes = []
let trackCntEl = null
function trackerShow() {
    trackerHide()
    const x = 1612 + (uiRightEdge() - 1920)
    trackNodes.push(rect(svgArr[2],x,252,296,88,"1px","rgb(204, 153, 102)","rgba(16, 12, 10, 0.85)",{"rx":"5px","id":"eqWinBack"}))
    trackNodes.push(text(svgArr[2],x + 148,284,"0pt","26pt","black","2px","rgb(204, 153, 102)",T("quest.hrup.title"),{"id":"eqWinTitle","size":24,"font":"baseFont4","anchor":"middle"}))
    trackCntEl = text(svgArr[2],x + 20,322,"0pt","24pt","black","2px","rgb(204, 153, 102)",T("quest.hrup.score",0,WANTED),{"id":"eqWinCnt","size":22,"font":"baseFont4"})
    trackNodes.push(trackCntEl)
}
function trackerCount(q) {
    if (!trackCntEl) return
    trackCntEl.textContent = T("quest.hrup.score", q.h, q.n)
}
function trackerHide() {
    while (trackNodes.length > 0) {
        const n = trackNodes.pop()
        n && n.remove && n.remove()
    }
    trackCntEl = null
}

// ---------- спавн Хрупа (newGame: 4 глава, 1 этаж) ----------
export function hrupQuestNewGame(next) {
    clearSession()
    status.questHrup = null
    if (status.meta.page !== 4 || status.levelFloor !== 0) return
    if (status.meta.quests && status.meta.quests.hrup) return
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
    let cell = null
    for (let i = 0; i < NEAR.length && !cell; i++) {
        const cx = f[0] + 1 + NEAR[i][0]
        const cy = f[1] + 1 + NEAR[i][1]
        status.matrixLevel[cy] && status.matrixLevel[cy][cx] === 1 && !cellBusy(lv, cx, cy) && (cell = [cx, cy])
    }
    if (!cell) return
    const base = findClassById(NPC)
    if (!base) return
    status.questHrup = {"state":1,"startIdx":startIdx,"npc":null,"woke":0,
        "h":0,"n":0,"score":new Map(),"target":-1,"targetCell":null,"pickCd":0}
    const q = status.questHrup
    //мирный Хруп: класс 32 (анимации), hrupNpc=1 — не атакует (перехват тика) и не атакуется
    //(guard в attack.js, как slimeNpc/entNpc)
    const anim = base.anims[2].others[2]
    objectValues.push({"id":status.oVcount,"type":"enemy","hrupNpc":1,"class":base,
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

// ---------- тик (gameLoop, после entQuestTick) ----------
// state 1/4 — полоска взаимодействия; state 2 (гонка) тикается из перехвата
// enemyTick (hrupQuestNpcTickHook), state 3 (бой) — штатный ИИ Хрупа
export function hrupQuestTick() {
    const q = status.questHrup
    if (!q) return
    if (q.state === 1 || q.state === 4) {
        //ТЗ: покидание стартовой комнаты «будит» Хрупа (гонка доступна). Диалог
        //доступен и до выхода — выход ни на что не влияет, просто отметка
        if (q.state === 1 && !q.woke && !anyHeroInStartRoom(q)) q.woke = 1
        npcUseBarTick(q)
    }
}
function anyHeroInStartRoom(q) {
    const lv = dataGeneric.scenes[status.levelFloor]
    const f = lv.floor[lv.roomsArr[q.startIdx][0]]
    for (let i = 0; i < status.players.length; i++) {
        const P = status.players[i]
        if (P.obj.type !== "hero") continue
        const hx = Math.trunc(P.x / 32)
        const hy = Math.trunc(P.y / 32)
        if (hx >= f[0] && hx < f[0] + f[2] && hy >= f[1] && hy < f[1] + f[3]) return true
    }
    return false
}
//полоска взаимодействия с Хрупом (state 1 — старт-диалог, state 4 — финальный)
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
        useBarFill = rect(svgArr[1],wp[0] - 9,wp[1] - 16,0,10,"none","0px","#cc9966",{"id":"hrupUseBar"})
        useBarBack = worldImage(svgArr[1],wp[0] - 11,wp[1] - 19,64,14,BAR_BACK,{"id":"hrupUseBarR"})
    }
    useBarFill.setAttribute("width", Math.trunc(60 * useT / USE_TICKS))
    if (useT >= USE_TICKS) {
        useBarFill.remove()
        useBarFill = null
        useBarBack && useBarBack.remove()
        useBarBack = null
        useT = 0
        q.recharge = 1
        q.state === 1 ? openChoiceDialog(q) : (q.n >= WANTED ? openLostDialog(q) : openWinDialog(q))
    }
}

// ---------- диалоги ----------
function openChoiceDialog(q) {
    openDialog({
        "right": PORTRAIT,
        "lines":[
            {"who":"hrup","key":"dlg.hrup.1"},
            {"who":"hero","key":"dlg.hrup.2"},
            {"who":"hrup","key":"dlg.hrup.3"},
            {"who":"hero","key":"dlg.hrup.4"}
        ],
        "choices":[
            {"label":"dlg.hrup.attack","cb":() => startFight(q)},
            {"label":"dlg.hrup.race","cb":() => startRace(q)}
        ]
    })
}
//АТАКОВАТЬ: Хруп становится обычным врагом (штатный ИИ), награда — на его трупе
function startFight(q) {
    const e = q.npc
    if (!e) return
    //статы боя: модификаторы 4 главы как у штатных спавнов (page>2 и page>3)
    const s = e.stats
    s.hp *= 2; s.dmg[0] += 2; s.dmg[1] += 6; s.speed += 1; s.range += 1
    s.hp *= 1.5; s.dmg[0] += 2; s.dmg[1] += 8; s.speed += 2; s.range += 1
    //кулдауны атак — без записи враг не атакует (enemyTryAttack)
    const len = e.class.attacks.length
    for (let iA = 0; iA < len; iA++) {
        s.attacksCd[iA] = Math.trunc(data.attacks[e.class.attacks[iA]].cooldown * 1000 / 16)
    }
    e.hrupNpc = 0
    e._hrupFight = 1
    e.noticed = 1
    e.stop = 0
    q.state = 3
    journalAdd(T("journ.hrup.fight"), J_RED)
}
//ОБОГНАТЬ: гонка — Хруп остаётся мирным (hrupNpc=1), действует самостоятельно
function startRace(q) {
    const e = q.npc
    if (!e) return
    e.stats.speed = RACER_SPEED
    //урон врагам — с модификаторами 4 главы, чтобы справлялся с комнатами
    e.stats.dmg[0] += 4
    e.stats.dmg[1] += 14
    //кулдаун удара (без него «undefined > 0» = ложь — удар каждый тик)
    const len = e.class.attacks.length
    for (let iA = 0; iA < len; iA++) {
        e.stats.attacksCd[iA] = Math.trunc(data.attacks[e.class.attacks[iA]].cooldown * 1000 / 16)
    }
    e.path = []
    e.stop = 0
    q.state = 2
    trackerShow()
    trackerCount(q)
    journalAdd(T("journ.hrup.race"), J_STD)
}
function openWinDialog(q) {
    openDialog({
        "right": PORTRAIT,
        "lines":[
            {"who":"hrup","key":"dlg.hrup.win1"},
            {"who":"hero","key":"dlg.hrup.win2"},
            {"who":"hrup","key":"dlg.hrup.win3"}
        ],
        "choices":[{"label":"dlg.hrup.take","cb":() => raceEnd(q, 1)}]
    })
}
function openLostDialog(q) {
    openDialog({
        "right": PORTRAIT,
        "lines":[{"who":"hrup","key":"dlg.hrup.lost1"}],
        "choices":[{"label":"dlg.hrup.hmph","cb":() => raceEnd(q, 0)}]
    })
}
//финал гонки: квест в мету при любом исходе; победа героя (sash=1) — Повязка
function raceEnd(q, sash) {
    const e = q.npc
    const p = e ? rectPos(e.rect) : [status.hero.x, status.hero.y]
    removeNpc(q)
    if (sash) {
        screenPic.push(worldImage(svgArr[1], p[0] + 16, p[1] + 40, 32, 32, SASH_SRC, {"id": screenPic.length - 1}))
        const el = screenPic[screenPic.length - 1]
        placeDrop(el, p[0] + 16, p[1] + 40, 32, 32)
        dropFly(el, p[0] + 16, p[1] + 25)
        hrupPiles.add(el)
        journalAdd(T("journ.hrup.item"), J_STD)
    }
    status.meta.quests.hrup = 1
    save()
    journalAdd(T("journ.hrup.done"), J_YELLOW)
    trackerHide()
    status.questHrup = null
    playback(strike[3].vol,0,0,2*status.settings.soundVolume)
}

// ---------- гонка (state 2, тик из hrupQuestNpcTickHook) ----------
function raceTick(q) {
    const e = q.npc
    if (!e || objectValues.indexOf(e) === -1) return
    raceScoreTick(q)
    if (!status.questHrup) return //гонка могла завершиться в raceScoreTick
    e.stats.attacksCd[0] > 0 && e.stats.attacksCd[0]--
    //замах: событие в середине (как attackNew.step 3 из 4 у врагов)
    if (e.attacking) {
        e.attackTicks--
        if (e._swingTick > 0) {
            e._swingTick--
            e._swingTick === 0 && swingResolve(q, e)
        }
        if (e.attackTicks <= 0) {
            e.attacking = 0
            e.stop = 0
            setEnemyIdle(e)
        }
        return
    }
    //1) враги в текущей комнате — бой
    const k = roomAt(e)
    if (k !== -1) {
        const rec = lv().roomsArr[k]
        const foe = nearestFoe(e, rec)
        if (foe) { combatTick(q, e, foe); return }
        //2) несломанные активируемые объекты комнаты — портить
        const obj = nextBreakable(lv(), rec)
        if (obj) { breakTick(q, e, obj); return }
    }
    //3) движение к следующей неоткрытой комнате
    moveTick(q, e)
}
function lv() { return dataGeneric.scenes[status.levelFloor] }
function setEnemyIdle(e) {
    const w = e.class.anims[2].others[2] || e.class.anims[0].move[1]
    e.currentAnim !== w && setEnemyPose(e, w)
}

//текущая комната клетки Хрупа (или -1 — коридор)
function roomAt(e) {
    const lvv = lv()
    const p = rectPos(e.rect)
    const hx = Math.trunc((p[0] + 16) / 32)
    const hy = Math.trunc((p[1] + 25) / 32)
    for (let k = 0; k < lvv.roomsArr.length; k++) {
        const f = lvv.floor[lvv.roomsArr[k][0]]
        if (hx >= f[0] && hx < f[0] + f[2] && hy >= f[1] && hy < f[1] + f[3]) return k
    }
    return -1
}
function aliveFoes(rec) {
    const out = []
    for (let i = 0; i < objectValues.length; i++) {
        const o = objectValues[i]
        if (o && o.type === "enemy" && o.room === rec && o.stats.hp > 0 && o.lying === undefined &&
            !o.entNpc && !o.entSpider && !o.hrupNpc) out.push(o)
    }
    return out
}
function nearestFoe(e, rec) {
    const foes = aliveFoes(rec)
    if (!foes.length) return null
    const ep = rectPos(e.rect)
    let best = null, bd = 1e9
    for (let i = 0; i < foes.length; i++) {
        const fp = rectPos(foes[i].rect)
        const d = Math.hypot(fp[0] - ep[0], fp[1] - ep[1])
        if (d < bd) { bd = d; best = foes[i] }
    }
    return best
}
//боевой тик: подойти и ударить (урон прямой, в середине замаха)
function combatTick(q, e, foe) {
    const ep = rectPos(e.rect)
    const fp = rectPos(foe.rect)
    const dx = (fp[0] + 16) - (ep[0] + 16)
    const dy = (fp[1] + 25) - (ep[1] + 25)
    if (Math.hypot(dx, dy) <= FOE_RANGE) {
        if (e.stats.attacksCd[0] > 0) { e.path = []; e.stop = 1; return }
        const dir = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 3 : 2) : (dy > 0 ? 1 : 0)
        const anim = e.class.anims[1].attack[dir]
        const swing = anim.times * animInterval(e, anim)
        e.stop = 0
        setEnemyPose(e, anim)
        e.attacking = 1
        e.attackTicks = swing + 1
        e._swingTick = Math.max(1, Math.round(swing * 3 / 4))
        e._swingFoe = foe
        e._swingObj = null
        e.stats.attacksCd[0] = Math.trunc(data.attacks[e.class.attacks[0]].cooldown * 1000 / 16)
        e.path = []
        return
    }
    e.stop = 0
    const ec = [Math.trunc((ep[0] + 16) / 32), Math.trunc((ep[1] + 25) / 32)]
    const tc = [Math.trunc((fp[0] + 16) / 32), Math.trunc((fp[1] + 25) / 32)]
    //путь перестраивается только когда враг СМЕНИЛ КЛЕТКУ: пересборка на каждом тике
    //от «передней» клетки бегущего Хрупа давала зигзаг на границе клеток (гасила скорость)
    if (!e.path || !e.path.length || !e._pathTc || e._pathTc[0] !== tc[0] || e._pathTc[1] !== tc[1]) {
        e._pathTc = tc
        e.path = bfsPath(ec, tc)
    }
    e.path && e.path.length && stepAlongPath(q, e)
}
//удар Хрупа: прямой урон с меткой-атрибутом (синхронно — enemyDie зачтёт вклад)
function hrupStrike(e) {
    const foe = e._swingFoe
    e._swingFoe = null
    if (!foe || foe.type !== "enemy" || foe.stats.hp <= 0 || foe.lying !== undefined) return
    const dmg = e.stats.dmg[0] + Math.trunc(Math.random() * (e.stats.dmg[1] - e.stats.dmg[0] + 1))
    hrupKillTarget = foe
    damageEnemy(foe, dmg)
    hrupKillTarget = null
}
//шаг по пути (1 клетка узла; темп speed/12 px за тик, как у врагов stepBudget)
function stepAlongPath(q, e) {
    if (e.stop === 1) return
    if (!e.path || !e.path.length) return
    const sPos = rectPos(e.rect)
    const x = sPos[0], y = sPos[1]
    const [px, py] = e.path[0]
    const tx = px * 32, ty = py * 32
    if (x === tx && y === ty) {
        e.path.shift()
        onHrupCell(q, e)
        return
    }
    const mv = Math.max(1, Math.trunc(e.stats.speed / 12))
    const dxs = x < tx ? 1 : x > tx ? -1 : 0
    const dys = dxs === 0 ? (y < ty ? 1 : y > ty ? -1 : 0) : 0
    const dist = Math.abs(tx - x) + Math.abs(ty - y)
    const applied = Math.min(mv, dist)
    for (let s = 0; s < applied; s++) moveSprite(e.img, dxs, dys)
    const dir = dxs > 0 ? 3 : dxs < 0 ? 2 : dys > 0 ? 1 : 0
    const m = e.class.anims[0].move[dir]
    e.currentAnim !== m && setEnemyPose(e, m)
    e.direction = dir
    if (applied >= dist) {
        e.path.shift()
        onHrupCell(q, e)
    }
}
//клетка на пути: открыть коридор/комнату/двери под ногами
function onHrupCell(q, e) {
    const lvv = lv()
    const p = rectPos(e.rect)
    const x = p[0] + 16, y = p[1] + 25
    //комната: рисуем и спавним её врагов (openRoom) при подходе на viewus героя
    //(32px за прямоугольник комнаты — геометрия heroMove.checkNewRoom: Хруп
    //«открывает по пути» и комнаты, мимо которых пробегает)
    for (let k = 0; k < lvv.roomsArr.length; k++) {
        if (lvv.roomsArr[k][3] === 1) continue
        const f = lvv.floor[lvv.roomsArr[k][0]]
        if (x + 32 > f[0] * 32 && y + 32 > f[1] * 32 &&
            x - 32 < (f[0] + f[2]) * 32 && y - 32 < (f[1] + f[3]) * 32) {
            createRoom(lvv, k, 32, 32)
            lvv.roomsArr[k][3] = 1
            openRoom(lvv.roomsArr[k])
            status.navVersion = (status.navVersion || 0) + 1
        }
    }
    //коридор: клетка в коробе 64px (как у героя) — createCorridor рисует ЦЕЛЫЙ
    //сегмент [5]/[6]; в режиме лавы свежая клетка заливается сразу
    for (let i = 0; i < lvv.floor.length; i++) {
        const f = lvv.floor[i]
        if (f[2] !== 1 || f[7] === 1) continue
        if (x > f[0] * 32 - 64 && y > f[1] * 32 - 64 &&
            x < f[0] * 32 + 96 && y < f[1] * 32 + 96) {
            createCorridor(f, 32, 32, lvv)
            flameQuestCorridorOpen(f)
            status.navVersion = (status.navVersion || 0) + 1
            break
        }
    }
    openHrupDoors(e)
}
function openHrupDoors(e) {
    const p0 = rectPos(e.rect)
    let changed = 0
    for (let i = 0; i < doorPics.length; i++) {
        const p = doorPics[i]
        if (!p || typeof p.getAttribute !== "function") continue
        const href = p.getAttribute("href")
        if (!href) continue
        const px = p.x.animVal.value, py = p.y.animVal.value
        if (Math.hypot(px - p0[0], py - p0[1]) > 96) continue
        for (let d = 0; d < DOOR_WALLS.length; d++) {
            if (href !== DOOR_WALLS[d][0]) continue
            p.setAttribute("href", DOOR_WALLS[d][1])
            changed = 1
            //открывшаяся дверь стала накладкой — в кэш Z-сортировки (как openDoor)
            if (wallsOverlay && wallsOverlay.indexOf(p) === -1 && OPEN_OVERLAYS.has(DOOR_WALLS[d][1])) {
                wallsOverlay.push(p)
            }
            break
        }
    }
    changed && (status.navVersion = (status.navVersion || 0) + 1)
}
//BFS по ПОЛУ (matrixLevel===1: клетки комнат и коридоров, открыты или нет —
//неоткрытые Хруп открывает на ходу; двери — тоже пол, он открывает их вблизи).
//V140a (репорт юзера): было >0 — а 2 в matrixLevel это СТЕНА (0 пустота,
//1 пол, 2 стена; семантику >0 Хрупу принёс BFS призрачного паука V138, который
//ползёт сквозь породу) — Хруп резал углы сквозь стены: шёл «через темноту»,
//а коридоры/комнаты по пути оставались тёмными (он по ним не проходил)
function bfsPath(from, to) {
    if (from[0] === to[0] && from[1] === to[1]) return []
    const w = status.matrixLevel[0].length
    const pass = (x, y) => status.matrixLevel[y] && status.matrixLevel[y][x] === 1
    if (!pass(to[0], to[1])) return null
    const prev = new Map()
    const queue = [from]
    prev.set(from[1] * w + from[0], -1)
    let head = 0
    while (head < queue.length) {
        const c = queue[head++]
        if (c[0] === to[0] && c[1] === to[1]) {
            const path = []
            let key = c[1] * w + c[0]
            while (key !== -1) {
                path.push([key % w, Math.trunc(key / w)])
                key = prev.get(key)
            }
            path.reverse()
            //стартовая клетка ОСТАЁТСЯ: первый узел выравнивает к центру текущей
            //клетки — пересборки на бегу не разворачивают Хрупа (гасили скорость)
            return path
        }
        const nb = [[c[0]+1,c[1]],[c[0]-1,c[1]],[c[0],c[1]+1],[c[0],c[1]-1]]
        for (let i = 0; i < nb.length; i++) {
            const key = nb[i][1] * w + nb[i][0]
            if (prev.has(key)) continue
            if (!pass(nb[i][0], nb[i][1])) continue
            prev.set(key, c[1] * w + c[0])
            queue.push(nb[i])
        }
    }
    return null
}
//несломанный активируемый объект комнаты (спуск 13 — не активируемый)
function nextBreakable(level, rec) {
    const f = level.floor[rec[0]]
    for (let i = 0; i < level.objects.length; i++) {
        const o = level.objects[i]
        if (!BREAKABLE.has(o[2]) || o[7] === 1 || o._hrupSkip) continue
        if (o[0] >= f[0] && o[0] < f[0] + f[2] && o[1] >= f[1] && o[1] < f[1] + f[3]) return o
    }
    return null
}
//поломка объекта: подойти и ударить (obj[7]=1 — «разрушенный» вид, юз закрыт)
function breakTick(q, e, obj) {
    const ep = rectPos(e.rect)
    const tx = obj[0] * 32, ty = obj[1] * 32
    if (Math.hypot(tx - ep[0], ty - ep[1]) <= OBJ_RANGE) {
        if (e.stats.attacksCd[0] > 0) { e.path = []; e.stop = 1; return }
        const anim = e.class.anims[1].attack[1]
        const swing = anim.times * animInterval(e, anim)
        setEnemyPose(e, anim)
        e.attacking = 1
        e.attackTicks = swing + 1
        e._swingTick = Math.max(1, Math.round(swing * 3 / 4))
        e._swingFoe = null
        e._swingObj = obj
        e.stats.attacksCd[0] = 20
        e.path = []
        return
    }
    e.stop = 0
    const ec = [Math.trunc((ep[0] + 16) / 32), Math.trunc((ep[1] + 25) / 32)]
    if (!e.path || !e.path.length || !e._pathTc || e._pathTc[0] !== obj[0] || e._pathTc[1] !== obj[1]) {
        e._pathTc = [obj[0], obj[1]]
        e.path = bfsPath(ec, [obj[0], obj[1]])
        if (!e.path) { obj._hrupSkip = 1; e.path = []; return } //не дотянуться — пропустить
    }
    e.path && e.path.length && stepAlongPath(q, e)
}
//событие в середине замаха: поломка объекта или удар по врагу
function swingResolve(q, e) {
    if (e._swingObj) {
        const obj = e._swingObj
        e._swingObj = null
        if (obj[7] === 1) return
        obj[7] = 1
        const img = picById(obj[6] + "OI")
        if (img) {
            const href = img.getAttribute("href")
            href && img.setAttribute("href", href.replace(/e?\.png$/, "d.png"))
        }
        bumpScore(q, obj, 1)
        return
    }
    hrupStrike(e)
}
//вклад в комнату: who 0 — герой, 1 — Хруп
function bumpScore(q, obj, who) {
    const lvv = lv()
    let k = -1
    for (let i = 0; i < lvv.roomsArr.length; i++) {
        const rf = lvv.floor[lvv.roomsArr[i][0]]
        if (obj[0] >= rf[0] && obj[0] < rf[0] + rf[2] && obj[1] >= rf[1] && obj[1] < rf[1] + rf[3]) { k = i; break }
    }
    if (k === -1 || k === q.startIdx) return
    let s = q.score.get(k)
    if (!s) { s = {"h":0,"n":0}; q.score.set(k, s) }
    who === 0 ? s.h++ : s.n++
}

//засчитка зачищенных комнат (каждый тик гонки)
function raceScoreTick(q) {
    const lvv = lv()
    for (let k = 0; k < lvv.roomsArr.length; k++) {
        if (k === q.startIdx) continue
        let s = q.score.get(k)
        if (!s) { s = {"h":0,"n":0}; q.score.set(k, s) }
        if (s.counted) continue
        const rec = lvv.roomsArr[k]
        if (rec[3] !== 1) continue
        if (aliveFoes(rec).length) continue
        const f = lvv.floor[rec[0]]
        let clean = true
        for (let i = 0; i < lvv.objects.length && clean; i++) {
            const o = lvv.objects[i]
            if (!BREAKABLE.has(o[2]) || o[7] === 1) continue
            if (o[0] >= f[0] && o[0] < f[0] + f[2] && o[1] >= f[1] && o[1] < f[1] + f[3]) clean = false
        }
        if (!clean) continue
        s.counted = 1
        if (s.h >= s.n) {
            q.h++
            journalAdd(T("journ.hrup.roomH", q.h), J_STD)
        } else {
            q.n++
            journalAdd(T("journ.hrup.roomN", q.n), J_RED)
        }
        trackerCount(q)
        if (q.h >= WANTED || q.n >= WANTED) {
            q.state = 4
            q.npc && (q.npc.path = [], q.npc.stop = 1, setEnemyIdle(q.npc))
            journalAdd(q.h >= WANTED ? T("journ.hrup.win") : T("journ.hrup.lost"), J_YELLOW)
            return
        }
    }
}
//движение по цели: случайная неоткрытая комната (не старт, не остров)
function moveTick(q, e) {
    const lvv = lv()
    //цель ещё не открыта — идём к ней
    if (q.target !== -1 && lvv.roomsArr[q.target] && lvv.roomsArr[q.target][3] !== 1 && q.targetCell) {
        const p = rectPos(e.rect)
        const ec = [Math.trunc((p[0] + 16) / 32), Math.trunc((p[1] + 25) / 32)]
        if (!e.path || !e.path.length) {
            e.path = bfsPath(ec, q.targetCell)
            if (!e.path) { q.target = -1; q.pickCd = 20 } //не дотянуться — другая цель
        }
        e.path && e.path.length && stepAlongPath(q, e)
        return
    }
    if (q.pickCd > 0) { q.pickCd--; setEnemyIdle(e); return }
    //выбор новой цели
    const cand = []
    for (let k = 0; k < lvv.roomsArr.length; k++) {
        if (k === q.startIdx || lvv.roomsArr[k][3] === 1) continue
        const f = lvv.floor[lvv.roomsArr[k][0]]
        if (f[0] + f[2] > lvv.w || f[1] + f[3] > lvv.h) continue
        cand.push(k)
    }
    if (!cand.length) { setEnemyIdle(e); return }
    const k = cand[Math.trunc(Math.random() * cand.length)]
    const f = lvv.floor[lvv.roomsArr[k][0]]
    //клетка-цель: центр комнаты или любой пол комнаты (только matrixLevel===1)
    let cell = [f[0] + (f[2] >> 1), f[1] + (f[3] >> 1)]
    if (!(status.matrixLevel[cell[1]] && status.matrixLevel[cell[1]][cell[0]] === 1)) {
        cell = null
        for (let y = f[1]; y < f[1] + f[3] && !cell; y++) {
            for (let x = f[0]; x < f[0] + f[2] && !cell; x++) {
                status.matrixLevel[y] && status.matrixLevel[y][x] === 1 && (cell = [x, y])
            }
        }
        if (!cell) { q.pickCd = 20; return }
    }
    q.target = k
    q.targetCell = cell
    e.path = []
}

// ---------- прямой вызов финального диалога (для кооп-интеракции/тестов) ----------
//lost=false — реплики победы героя (ВЗЯТЬ/Повязка), true — победа Хрупа (ХМЫКНУТЬ)
export function hrupQuestOpenFinal(lost) {
    const q = status.questHrup
    if (!q || q.state !== 4) return false
    closeDialogHard() //застывший диалог (если был) сносится без колбэков
    lost ? openLostDialog(q) : openWinDialog(q)
    return true
}

// ---------- хук смерти врага (enemyDie) ----------
export function hrupQuestEnemyDie(enemy) {
    //бой: Хруп убит героями — 2 случайных эпика + мета
    if (enemy.class.id === NPC && enemy._hrupFight) {
        const q = status.questHrup
        const p = [enemy.rect.x.animVal.value, enemy.rect.y.animVal.value]
        for (let i = 0; i < 2; i++) {
            const x = p[0] + 16 + Math.trunc(Math.random() * 32) - 16
            const y = p[1] + 40
            screenPic.push(worldImage(svgArr[1], x, y, 32, 36, EPIC_SRC, {"id": screenPic.length - 1}))
            const el = screenPic[screenPic.length - 1]
            placeDrop(el, x, y, 32, 36)
            dropFly(el, p[0] + enemy.rect._w / 2, p[1] + enemy.rect._h / 2)
            hrupEpicDrops.set(el, 2)
        }
        if (q) {
            trackerHide()
            status.questHrup = null
        }
        status.meta.quests.hrup = 1
        save()
        journalAdd(T("journ.hrup.done"), J_YELLOW)
        journalAdd(T("journ.hrup.epic"), J_STD)
        return
    }
    //гонка: вклад в зачистку комнаты. ВНИМАНИЕ: enemyDie ставит type="corpse"
    //ДО вызова квест-хуков — проверять именно corpse
    const q = status.questHrup
    if (!q || q.state !== 2 || enemy.type !== "corpse") return
    const lvv = lv()
    const k = lvv.roomsArr.indexOf(enemy.room)
    if (k === -1 || k === q.startIdx) return
    let s = q.score.get(k)
    if (!s) { s = {"h":0,"n":0}; q.score.set(k, s) }
    hrupKillTarget === enemy ? s.n++ : s.h++
}

// ---------- хук использования объекта героем (useObject.finishUsedObject) ----------
export function hrupQuestObjectUsed(obj) {
    const q = status.questHrup
    if (!q || q.state !== 2) return
    bumpScore(q, obj, 0)
}

// ---------- подбор кучек (takeDrop) ----------
//эпик-кучка: ветка подтверждает подбор, сам предмет генерирует takeItem(2)
export function hrupQuestTakeEpic(el) {
    if (!hrupEpicDrops.has(el)) return false
    hrupEpicDrops.delete(el)
    return true
}
//Повязка: эффект «+5% к передвижению» предмету ПОЯСА (слот 10 «талия»). Пояса нет —
//подбор проходит, накладывать нечего (как Ком слизи/Росток, решение пользователя)
export function hrupQuestTakePile(el) {
    if (!hrupPiles.has(el)) return false
    hrupPiles.delete(el)
    const w = status.inventory.doll[BELT_SLOT]
    if (w) {
        w.barb = 1
        countDopStats()
        journalAdd(T("journ.hrup.barb", T("item.barb.name")), J_YELLOW)
        floatText(status.hero.x - 16 + Math.trunc(Math.random() * 32), status.hero.y + 8, T("float.hrup.barb"), "#66CCFF", "18px", "none")
    }
    return true
}

// ---------- перехват тика мирного Хрупа из enemyAI.enemyTick ----------
export function hrupQuestNpcTickHook(enemy) {
    const q = status.questHrup
    if (!q || q.npc !== enemy) { enemy.hrupNpc = 0; return }
    //мирный (state 1/4) — стоит; гонка (state 2) — самостоятельный тик
    q.state === 2 ? raceTick(q) : setEnemyIdle(enemy)
}

// ---------- смена сцены (del.js) ----------
export function hrupQuestDel() {
    clearSession()
    status.questHrup = null
}
