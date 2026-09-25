// ============================================================================
// flameQuest.js — V111: сюжетный квест «Погоня за пламенем» (одноразовый, группа
// meta.quests наравне с Волком/порталом). Только 4 глава (meta.page===4), 3 этаж
// (levelFloor===2), в углу стартовой комнаты появляется МИРНЫЙ Огнементаль
// (id 29, лист images/sheets/elemental_64.png). Диалог при взаимодействии:
// «НАПАСТЬ» — бой (статы как у культиста V110 — вождь гоблинов id 4 со всеми
// модификаторами глав и hp×4=960, но ближняя атака 25 — огненный взмах по
// принципу mace); победа — бафф «Огненное оружие» статуи (info.buffFireT) на
// ВЕСЬ ЭТАЖ — таймер-гигант, снимается в del-хуке при уходе с этажа.
// «ПРОСЛЕДИТЬ» — режим погони: каждое взаимодействие — огнементаль перебегает
// в центр случайной СОСЕДНЕЙ комнаты (связь — пары [5]/[6] коридорных клеток,
// коллизии/двери игнорируются, в первую очередь закрытые комнаты) со скоростью
// 2× скорости героя. Каждые 10 секунд в погоне меняется «режим лавы» (случайный
// ≠ текущему): 1 — лава ушла, 2 — лава на всех открытых клетках коридоров,
// 3 — лава на полу открытых комнат; спрайты effects/lava.png ложатся на слой
// svg[0] (поверх пола, под всеми объектами и стенами). Герой на клетке лавы
// получает 1 урона в секунду. Взаимодействие в комнате выхода (самая большая —
// roomsArr[last], там спуск) — финал: огонёк уходит в дыру, дроп с иконкой
// баффа огня (effects/buff2.png); подбор — зачарование ТЕКУЩЕГО оружия
// (item.fire): каждая атака героя вешает ожог (buffFx.weaponFireOnAttack),
// на иконке оружия везде оверлей effects/flameWeapon.png, в подсказке —
// оранжевая метка «огненное». Оружия нет — награда не на что накладывать.
// ============================================================================
import { status } from "../scripts/start.js"
//V117: кооператив — триггеры по ближайшему герою, лава бьёт каждого
import { nearestPlayer,setContext,forAlive } from "../scripts/players.js"
//V115: полосы ХП/опыта — суффиксы по игроку (players.js)
import { ctxBar,ctxTx } from "../scripts/players.js"
import { T } from "../scripts/localization.js"
import { data } from "../scripts/data.js"
import { dataGeneric } from "../scripts/sceneGenerate.js"
import { svgArr, image, worldImage, text, rect, uiRightEdge, releaseSprite, rectPos, moveSprite } from "../scripts/svg.js"
import { objectValues, screenPic } from "../scripts/del.js"
import { floatText } from "../scripts/floatText.js"
import { journalAdd, J_STD, J_RED, J_YELLOW, J_GREEN } from "../scripts/journal.js"
import { openDialog } from "../scripts/dialog.js"
//V111: отметка о выполнении сюжетного квеста сохраняется сразу (meta в localStorage)
import { save } from "../scripts/save.js"
//V111: исчезающий огнементаль уносит тень (как культист в removeCult)
import { removeEntShadow } from "../scripts/groundShadow.js"
//полёт и посадка кучек (страховка от стен) — как в portalQuest
import { placeDrop, dropFly } from "../scripts/dropSafe.js"
//V111: урон лавы идёт мимо брони напрямую в ХП (как алтарь case 12)
import { changeHP } from "../scripts/takeDamage.js"
//V146: «Архивариус» — проверка «все сюжетные квесты завершены» при постановке флага
import { achQuestCheck } from "../scripts/achievements.js"

const USE_TICKS = 45             //полоска взаимодействия (как у Волка/культиста, ~0.72с)
const NEAR = [[0,0],[0,-1],[1,-1],[-1,-1],[1,0],[-1,0],[1,1],[-1,1],[0,1]]
const LAVA_SRC = "./images/effects/lava.png"
const FLAME_ICON_SRC = "./images/effects/buff2.png"   //иконка баффа огня статуи
const LAVA_SWITCH_TICKS = 625    //10 секунд смены режима лавы (62.5 тика/с)
const LAVA_SEC_TICKS = 62        //проверка «герой на лаве» раз в секунду
const BUFF_FLOOR_TICKS = 1e9     //«до конца этажа»: снимает del-хук, не истекает сам

let useBarFill = null
//V133 (репорт юзера): задний фрейм полоски (bar1mini.png) — как у интерактивных объектов
let useBarBack = null
let useT = 0
//кучка-награда финала: маркер хэндла → ветка подбора в takeDrop (WeakSet — записи
//умирают со сценой, неподобранные кучки память не держат)
const flamePiles = new WeakSet()

// ---------- окно «текущих квестов» (правый край, как у Волка/культиста) ----------
let trackNodes = []
let trackTextEl = null
function trackerShow(baseKey) {
    trackerHide()
    const x = 1612 + (uiRightEdge() - 1920)
    trackNodes.push(rect(svgArr[2],x,252,296,86,"1px","rgb(204, 153, 102)","rgba(16, 12, 10, 0.85)",{"rx":"5px","id":"fqWinBack"}))
    trackNodes.push(text(svgArr[2],x + 148,284,"0pt","26pt","black","2px","rgb(204, 153, 102)",T("quest.flame.title"),{"id":"fqWinTitle","size":24,"font":"baseFont4","anchor":"middle"}))
    trackTextEl = text(svgArr[2],x + 148,318,"0pt","24pt","black","2px","rgb(230, 220, 200)",T(baseKey),{"id":"fqWinText","size":22,"font":"baseFont4","anchor":"middle"})
    trackNodes.push(trackTextEl)
}
function trackerHide() {
    while (trackNodes.length > 0) {
        const n = trackNodes.pop()
        n && n.remove && n.remove()
    }
    trackTextEl = null
}

// ---------- спавн мирного Огнементя (newGame: 4 глава, 3 этаж) ----------
export function flameQuestNewGame(next) {
    clearSession()
    status.questFlame = null
    if (next === false) return
    //одноразовый сюжетный: выполненный (мета) не предлагается
    if (status.meta.page !== 4 || status.levelFloor !== 2) return
    if (status.meta.quests && status.meta.quests.flame) return
    spawnFlameNpc()
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
//свободна ли клетка под спавн (объекты + стены + герой) — локальная копия cellBusy
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
function spawnFlameNpc() {
    const lv = dataGeneric.scenes[status.levelFloor]
    if (!lv.roomsArr || !lv.roomsArr[0]) return
    const cls = findClassById(29)
    const lider = findClassById(4)
    if (!cls || !lider) return
    const f = lv.floor[lv.roomsArr[0][0]]
    const matrix = status.matrixLevel
    //угол стартовой комнаты (клетка внутрь от угла, как у Волка/портала); запасной
    //проход V110 — первая свободная клетка пола в глубине комнаты
    let cell = null
    for (let i = 0; i < NEAR.length && !cell; i++) {
        const cx = f[0] + 1 + NEAR[i][0]
        const cy = f[1] + 1 + NEAR[i][1]
        matrix[cy] && matrix[cy][cx] === 1 && !cellBusy(lv, cx, cy) && (cell = [cx, cy])
    }
    if (!cell) {
        for (let y = f[1] + 1; y < f[1] + f[3] - 1 && !cell; y++) {
            for (let x = f[0] + 1; x < f[0] + f[2] - 1 && !cell; x++) {
                matrix[y] && matrix[y][x] === 1 && !cellBusy(lv, x, y) && (cell = [x, y])
            }
        }
    }
    if (!cell) return
    //класс Огнементя (анимации, атака 25 в attackNew), статы боя — рецепт культиста
    //V110: вождь гоблинов (id 4) со ВСЕМИ модификаторами глав вплоть до 4-й, hp ×4 = 960.
    //Без boss/elite: нет полосы босса, зачёта bossKill и ключа элит
    const c = JSON.parse(JSON.stringify(cls))
    delete c.boss
    delete c.elite
    const stats = JSON.parse(JSON.stringify(lider.stats))
    stats.hp *= 2; stats.dmg[0] += 1; stats.dmg[1] += 2
    stats.hp *= 2; stats.dmg[0] += 2; stats.dmg[1] += 6; stats.speed += 1; stats.range += 1
    stats.hp *= 1.5; stats.dmg[0] += 2; stats.dmg[1] += 8; stats.speed += 2; stats.range += 1
    stats.hp *= 4
    stats.exp = 10
    const anim = c.anims[2].others[2]
    //flameNpc — «мирный» (сбрасывается выбором боя); flameQuestMob — ПОСТОЯННЫЙ маркер
    //«это Огнементаль»: ловушки на него не действуют ни до, ни после «НАПАСТЬ» (V113)
    objectValues.push({"id":status.oVcount,"type":"enemy","flameNpc":1,"flameQuestMob":1,"class":c,"stats":stats,
    "animCounters":60/anim.speed,"currentAnim":anim,"currentStill":0,"room":lv.roomsArr[0],"cells":[],
    "state":0,"stop":0,"xCell":cell[0],"yCell":cell[1],"noStunTime":0,"direction":1,
    "img":image(svgArr[1],cell[0]*32,cell[1]*32-16,anim.w,anim.h,anim.img,
        {"times":anim.times,"id":status.oVcount,"frame":1})})
    status.oVcount++
    const e = objectValues[objectValues.length - 1]
    e.rect = e.img.clipRect
    e.stats.attacksCd[0] = Math.trunc(data.attacks[25].cooldown * 1000 / 16)
    //комната выхода — САМАЯ БОЛЬШАЯ (roomsArr отсортирован по площади по возрастанию,
    //последняя запись; там генератор ставит спуск — тип 13)
    status.questFlame = {"state":1,"npc":e,"exitRoom":lv.roomsArr[lv.roomsArr.length-1],
        "lavaMode":0,"lavaT":LAVA_SWITCH_TICKS,"secT":0,"lavaImgs":[],"lavaSet":new Set(),
        "flying":null,"recharge":0,"floorBuff":0,"links":null}
}

// ---------- тик (gameLoop, после portalQuestTick) ----------
//перехват тика мирного Огнементя из enemyAI.enemyTick: ТОЛЬКО гасит штатный ИИ —
//вся логика (полоска взаимодействия, перебежки, лава) живёт в flameQuestTick
export function flameQuestNpcTickHook(enemy) {
    const q = status.questFlame
    if (!q || q.npc !== enemy) enemy.flameNpc = 0
}
export function flameQuestTick() {
    const q = status.questFlame
    if (!q) return
    //лава дышит только в режиме погони
    q.state === 2 && lavaTick(q)
    const e = q.npc
    if (!e || e.type !== "enemy" || objectValues.indexOf(e) === -1) return
    if (q.flying) { flyTick(q, e); return }
    npcUseBarTick(q, e)
}
//полоска взаимодействия: герой рядом — растёт полоска (как у культиста); после
//диалога/перебежки — recharge, снимается выходом героя из зоны (репорт V109)
function npcUseBarTick(q, e) {
    const wp = rectPos(e.rect)
    //V117: полоску растит ближайший к Огнементю живой герой
    const HQ = nearestPlayer(wp[0], wp[1])
    if (!HQ) return
    const d = Math.hypot((HQ.x + 16) - (wp[0] + 16), (HQ.y + 25) - (wp[1] + 25))
    if (d > 56) {
        useT > 0 && (useT = 0)
        //V136 (репорт юзера): при отходе полоска исчезает целиком, вместе с фреймом
        useBarFill && (useBarFill.remove(), useBarFill = null)
        useBarBack && (useBarBack.remove(), useBarBack = null)
        q.recharge = 0
        return
    }
    if (q.recharge) return
    useT++
    if (!useBarFill) {
        //V136: геометрия как у полосок интерактивных объектов — fill 60×10 внутри фрейма 64×14
        useBarFill = rect(svgArr[1],wp[0] - 9,wp[1] - 16,0,10,"none","0px","#cc9966",{"id":"fqUseBar"})
        //V133: задний фрейм bar1mini — как у полосок интерактивных объектов
        useBarBack = worldImage(svgArr[1],wp[0] - 11,wp[1] - 19,64,14,"./images/UI/panels/bar1mini.png",{"id":"fqUseBarR"})
    }
    useBarFill.setAttribute("width", Math.trunc(60 * useT / USE_TICKS))
    if (useT >= USE_TICKS) {
        useBarFill.remove()
        useBarFill = null
        useBarBack && useBarBack.remove()
        useBarBack = null
        useT = 0
        q.recharge = 1
        interact(q, e)
    }
}
function interact(q, e) {
    if (q.state === 1) { openStartDialog(q, e); return }
    //погоня: в комнате выхода — финал, в любой другой — огонёк убегает
    const p = rectPos(e.rect)
    if (roomOfCell(q, Math.trunc((p[0] + 16) / 32), Math.trunc((p[1] + 40) / 32)) === q.exitRoom) {
        openFinalDialog(q, e)
        return
    }
    flee(q, e)
}
//комната по клетке (перебор roomsArr — их на этаже полтора десятка)
function roomOfCell(q, x, y) {
    const lv = dataGeneric.scenes[status.levelFloor]
    if (!lv || !lv.roomsArr) return null
    for (let k = 0; k < lv.roomsArr.length; k++) {
        const f = lv.floor[lv.roomsArr[k][0]]
        if (x >= f[0] && x < f[0] + f[2] && y >= f[1] && y < f[1] + f[3]) return lv.roomsArr[k]
    }
    return null
}

// ---------- погоня: перебежки ----------
//смежность комнат — напрямую из коридорных клеток: генератор пишет в [5]/[6] пары
//«floor-индекс комнаты A — комнаты B» (newGame.buildEdges → drawThickLine)
function buildLinks(q) {
    const lv = dataGeneric.scenes[status.levelFloor]
    const map = new Map()
    for (let i = 0; i < lv.floor.length; i++) {
        const f = lv.floor[i]
        if (f[2] !== 1 || f[5] === undefined || f[6] === undefined) continue
        !map.has(f[5]) && map.set(f[5], new Set())
        map.get(f[5]).add(f[6])
        !map.has(f[6]) && map.set(f[6], new Set())
        map.get(f[6]).add(f[5])
    }
    q.links = map
}
function flee(q, e) {
    const lv = dataGeneric.scenes[status.levelFloor]
    const p = rectPos(e.rect)
    const cur = roomOfCell(q, Math.trunc((p[0] + 16) / 32), Math.trunc((p[1] + 40) / 32))
    if (!cur) return
    q.links || buildLinks(q)
    const set = q.links.get(cur[0])
    if (!set || !set.size) return
    const neighbors = Array.from(set).map(fi => lv.roomsArr.find(r => r[0] === fi)).filter(Boolean)
    //коллизии/двери не действуют: закрытые комнаты предпочитаются открытым
    const closed = neighbors.filter(r => r[3] !== 1)
    const pool = closed.length ? closed : neighbors
    const target = pool[Math.trunc(Math.random() * pool.length)]
    const f = lv.floor[target[0]]
    q.flying = {"x": f[5] * 32, "y": f[6] * 32 - 16}
    journalAdd(T("journ.fq.flee"), J_STD)
}
//полёт к центру комнаты: 2× текущей скорости героя, коллизии игнорируются
function flyTick(q, e) {
    const fl = q.flying
    const p = rectPos(e.rect)
    let dx = fl.x - p[0]
    let dy = fl.y - p[1]
    const dist = Math.hypot(dx, dy)
    const hs = status.moveSpeed + status.moveSpeed * (status.info.stats[3].dops[0].value2.slice(0, -1) / 100)
    const sp = hs * 2
    if (dist <= sp) {
        moveSprite(e.img, dx, dy)
        q.flying = null
        q.recharge = 1
        e.xCell = Math.trunc(fl.x / 32)
        e.yCell = Math.trunc((fl.y + 16) / 32)
        setPose(e, e.class.anims[2].others[2])
        return
    }
    dx = dx / dist * sp
    dy = dy / dist * sp
    moveSprite(e.img, dx, dy)
    //анимация ходьбы по доминирующей оси (move: [спина, фронт, влево, вправо])
    const dir = Math.abs(fl.x - p[0]) > Math.abs(fl.y - p[1])
        ? (fl.x > p[0] ? 3 : 2)
        : (fl.y > p[1] ? 1 : 0)
    if (e.direction !== dir) {
        e.direction = dir
        setPose(e, e.class.anims[0].move[dir])
    }
}
//смена анимации NPC — локальная (setEnemyPose не импортируем: enemyAI уже импортирует
//этот модуль, лишний цикл ни к чему)
function setPose(e, anim) {
    e.currentAnim = anim
    e.img.setAttribute("href", anim.img)
    e.img.setAttribute("times", anim.times)
    e.img.setAttribute("width", anim.w)
    e.img.setAttribute("height", anim.h)
    e.currentStill = 0
    e.stop = 0
    e.animCounters = 60 / anim.speed
}

// ---------- режимы лавы ----------
function lavaTick(q) {
    //каждые 10 секунд — случайный режим ≠ текущему: сначала гаснут ВСЕ спрайты лавы
    q.lavaT--
    if (q.lavaT <= 0) {
        q.lavaT = LAVA_SWITCH_TICKS
        let m = q.lavaMode
        while (m === q.lavaMode) m = Math.trunc(Math.random() * 3) + 1
        setLavaMode(q, m)
    }
    //герой на спрайте лавы — 1 урона в секунду (мимо брони, как алтарь)
    q.secT++
    if (q.secT >= LAVA_SEC_TICKS) {
        q.secT = 0
        //V117: лава жжёт КАЖДОГО живого игрока, стоящего на лавовой клетке
        forAlive(P => {
            if (P.obj.type !== "hero" || P.info.hp <= 0) return
            const hx = Math.trunc(P.x / 32)
            const hy = Math.trunc(P.y / 32)
            if (q.lavaSet.has(hx + "_" + hy)) {
                P.info.hp -= 1
                changeHP(ctxBar("hp"),ctxTx("hp"),"hp")
                floatText(P.x - 16 + Math.trunc(Math.random() * 32), P.y + 8, "1", "#FF5500", "14px", "none")
            }
        })
    }
}
function setLavaMode(q, mode) {
    clearLava(q)
    q.lavaMode = mode
    const lv = dataGeneric.scenes[status.levelFloor]
    if (mode === 1) { journalAdd(T("journ.fq.lava1"), J_STD); return }
    if (mode === 2) {
        //лава в коридорах: ТОЛЬКО открытые ([7]===1 — нарисованные heroMove) клетки;
        //вновь открытые коридоры получает хук flameQuestCorridorOpen
        for (let i = 0; i < lv.floor.length; i++) {
            const f = lv.floor[i]
            f[2] === 1 && f[7] === 1 && addLava(q, f[0], f[1])
        }
        journalAdd(T("journ.fq.lava2"), J_STD)
        return
    }
    //лава в комнатах: пол всех ОТКРЫТЫХ комнат ([3]===1)
    for (let k = 0; k < lv.roomsArr.length; k++) {
        const r = lv.roomsArr[k]
        if (r[3] !== 1) continue
        const f = lv.floor[r[0]]
        for (let y = f[1]; y < f[1] + f[3]; y++) {
            for (let x = f[0]; x < f[0] + f[2]; x++) addLava(q, x, y)
        }
    }
    journalAdd(T("journ.fq.lava3"), J_STD)
}
//спрайт лавы — слой svg[0]: поверх тайлов пола, ПОД всеми объектами и стенами (svg[1])
function addLava(q, x, y) {
    const key = x + "_" + y
    if (q.lavaSet.has(key)) return
    q.lavaSet.add(key)
    q.lavaImgs.push(worldImage(svgArr[0], x * 32, y * 32, 32, 32, LAVA_SRC, {}))
}
function clearLava(q) {
    for (let i = 0; i < q.lavaImgs.length; i++) {
        const n = q.lavaImgs[i]
        n && n.remove && n.remove()
    }
    q.lavaImgs.length = 0
    q.lavaSet.clear()
}
//хук из heroMove (создание тайла коридора при подходе героя): в режиме «лава в
//коридорах» свежая клетка тоже заливается
export function flameQuestCorridorOpen(cell) {
    const q = status.questFlame
    if (!q || q.state !== 2 || q.lavaMode !== 2) return
    addLava(q, cell[0], cell[1])
}

// ---------- диалоги ----------
function openStartDialog(q, e) {
    openDialog({
        "right": null,
        "lines":[{"who":"narr","key":"dlg.fq.1"}],
        "choices":[
            {"label":"dlg.fq.attack","cb":() => fight(q, e)},
            {"label":"dlg.fq.track","cb":() => track(q)}
        ]
    })
}
//НАПАСТЬ: огнементаль становится обычным врагом (штатный ИИ, ближняя атака 25),
//победа — в flameQuestEnemyDie
function fight(q, e) {
    e.flameNpc = 0
    e.flameFight = 1
    e.noticed = 1
    e.called = 1
    q.state = 3
    trackerHide()
    journalAdd(T("journ.fq.fight"), J_RED)
}
//ПРОСЛЕДИТЬ: режим погони — трекер, граф смежности, первый случайный режим лавы
function track(q) {
    q.state = 2
    buildLinks(q)
    trackerShow("quest.flame.track")
    setLavaMode(q, Math.trunc(Math.random() * 3) + 1)
    q.lavaT = LAVA_SWITCH_TICKS
    journalAdd(T("journ.fq.chase"), J_STD)
}
function openFinalDialog(q, e) {
    openDialog({
        "right": null,
        "lines":[{"who":"narr","key":"dlg.fq.final"}],
        "choices":[{"label":"dlg.fq.inspect","cb":() => finale(q, e)}]
    })
}
//ОСМОТРЕТЬ: огонёк уходит в дыру, на месте — кучка с иконкой баффа огня.
//Квест завершён (мета); зачарование оружия вешает ПОДБОР кучки (takeDrop-хук)
function finale(q, e) {
    const p = rectPos(e.rect)
    removeEntShadow(e)
    const idx = objectValues.indexOf(e)
    idx !== -1 && objectValues.splice(idx, 1)
    releaseSprite(e.img)
    q.npc = null
    screenPic.push(worldImage(svgArr[1], p[0] + 16, p[1] + 40, 32, 32, FLAME_ICON_SRC, {"id": screenPic.length - 1}))
    const el = screenPic[screenPic.length - 1]
    placeDrop(el, p[0] + 16, p[1] + 40, 32, 32)
    dropFly(el, p[0] + 16, p[1] + 25)
    flamePiles.add(el)
    status.meta.quests.flame = 1
    //V146: «Архивариус» — не стал ли этот квест последним
    achQuestCheck()
    save()
    journalAdd(T("journ.fq.done"), J_YELLOW)
    clearLava(q)
    trackerHide()
    status.questFlame = null
}

// ---------- дроп/смерть (хуки из enemyAI.enemyDie и takeDrop) ----------
//победа в бою (НАПАСТЬ): бафф «Огненное оружие» статуи на весь этаж
export function flameQuestEnemyDie(enemy) {
    if (!enemy.flameFight) return
    const q = status.questFlame
    //V117: бафф этажа — ОБЕИМ живым игрокам
    forAlive(P => { P.info.buffFireT = BUFF_FLOOR_TICKS })
    //floorBuff остаётся в questFlame ДО del-хука (он снимет бафф при уходе с этажа):
    //обнулять questFlame здесь нельзя — иначе бафф переживал бы смену этажа
    q && (q.floorBuff = 1)
    q && (q.state = 3)
    q && (q.npc = null)
    floatText(status.hero.x - 16 + Math.trunc(Math.random() * 32), status.hero.y + 8, T("float.flameBuff"), "#FF8800", "18px", "none")
    journalAdd(T("journ.fq.buff"), J_GREEN)
    status.meta.quests.flame = 1
    //V146: «Архивариус» — не стал ли этот квест последним
    achQuestCheck()
    save()
}
//подбор кучки-награды: зачарование ТЕКУЩЕГО оружия (слоты куклы 11-12).
//Оружия нет — подбор проходит, накладывать нечего (решение пользователя)
export function flameQuestTakePile(el) {
    if (!flamePiles.has(el)) return false
    flamePiles.delete(el)
    let any = 0
    for (let k = 11; k <= 12; k++) {
        const w = status.inventory.doll[k]
        w && w.attack !== undefined && (w.fire = 1) && (any = 1)
    }
    any && journalAdd(T("journ.fq.weapon"), J_YELLOW)
    any && floatText(status.hero.x - 16 + Math.trunc(Math.random() * 32), status.hero.y + 8, T("float.flameWeapon"), "#FF8800", "18px", "none")
    return true
}

// ---------- смена сцены (del.js) ----------
export function flameQuestDel() {
    //бафф «Огненное оружие» жил только до завершения этажа
    const q = status.questFlame
    if (q && q.floorBuff && status.info) status.info.buffFireT = 0
    clearSession()
    status.questFlame = null
}
