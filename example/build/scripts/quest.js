// ============================================================================
// quest.js — V104: квестовая система. Первый квест — «Сопроводить Волка».
//
// Мирный NPC: Волк (лист images/sheets/wolf_64.png) стоит в углу стартовой
// комнаты 1 этажа ТОЛЬКО во 2 главе (status.meta.page === 2). Ушёл из комнаты,
// не заговорив — Волк исчезает. Взаимодействие — как у объектов: подойти,
// полоска использования, диалог (dialog.js) на паузе.
//   СОГЛАСИТЬСЯ → квест: справа окно «текущих квестов» («Сопроводить Волка.»),
//   Волк становится боевым союзником (type "pet" — идут штатные следование
//   petFollowTick/stepAlongPath, тени, ХП-бар), параметры — гоблин data.js с
//   модификаторами глав вплоть до 4-й (как в encounters.js): hp 15,
//   dmg [5,17], speed 13, range 8; бьёт атакой 11 «Укус».
//   ОТКАЗАТЬСЯ → Волк исчезает, квест не начинается.
// Враги НАВОДЯТСЯ только на героя; их снаряды при пересечении с Волком бьют
// ВОЛКА (damageHero → wolfHitBy). Волк бросается на врагов, напавших на героя
// (noticed/called/ATTACK в радиусе), подходит по BFS и кусает; урон считается
// в damage.js countDamage по его stats.dmg (ветка wolfAlly).
// ХП Волка иссякли → смерть (анимация), квест провален, окно квеста гаснет.
// Выход с этажа с живым Волком (nextFloor) → прощальный диалог, «ПРИНЯТЬ» →
// случайный легендарный (сетовый) предмет (itemGenerate(4)) → квест закрыт.
// Состояния status.quest.state: 0 нет, 1 NPC предложен, 2 активен,
// 4 выполнен, 5 провален.
// ============================================================================
import { status } from "../scripts/start.js"
//V117: кооператив — квест-триггеры срабатывает БЛИЖАЙШИЙ живой герой
import { nearestPlayer,setContext } from "../scripts/players.js"
import { T } from "../scripts/localization.js"
import { data } from "../scripts/data.js"
import { dataGeneric } from "../scripts/sceneGenerate.js"
import { svgArr, image, text, rect, rectPos, uiRightEdge, releaseSprite, worldImage } from "../scripts/svg.js"
import { objectValues, screenPic } from "../scripts/del.js"
import { floatText } from "../scripts/floatText.js"
import { checkCollision, playEffect } from "../scripts/damage.js"
//V105: постоянный ХП-бар Волка + мгновенное гашение при уходе (hideEnemyHpBar)
import { showEnemyHpBar, hideEnemyHpBar } from "../scripts/enemyHpBarFx.js"
//V105: тень уходит вместе с Волком (removeWolf — он исчезает живым, без трупа)
import { removeEntShadow } from "../scripts/groundShadow.js"
import { journalAdd, J_RED } from "../scripts/journal.js"
import { playback, strike } from "../scripts/sound.js"
import { addAnim } from "../scripts/animPlay.js"
import { openDialog } from "../scripts/dialog.js"
import { itemGenerate } from "../scripts/itemGenerate.js"
//V106: отметка о выполнении сюжетного квеста сохраняется сразу (meta в localStorage)
import { save } from "../scripts/save.js"
//следование «по пятам» и путь — штатная механика питомцев enemyAI (цикл импортов
//легален: enemyAI зовёт wolfAllyTick только в рантайме)
import { ENEMY_STATE, animInterval, buildChasePath, petFollowTick, setEnemyPose, waitPose } from "../scripts/enemyAI.js"

//параметры: гоблин data.js (id 0) с главовыми модификаторами вплоть до 4-й
//(encounters.js: ×2 ХП, dmg +2/+4, speed/range +1; ещё ×1.5 ХП, dmg +2/+8, speed +2, range +1).
//V105: скорость ПОДНЯТА 13 → 30 (шаг 30/12 = 2.5px/тик против 2px/тик героя) — при равной
//со героем скорости Волк, отстав, уже не догонял бы (шаг по пути идёт только при цели
//дальше 2 клеток); с 2.5 он наверстывает отставание и держится «по пятам»
const WOLF_STATS = {"hp":15,"dmg":[5,17],"exp":0,"speed":30,"range":8,"attacksCd":[],"noStunTime":55}
//класс Волка — структура как у врагов data.js, анимации читаются из листа wolf_64.png
//через SHEETS (пути легаси-полос ./images/enemy/wolf/...). attackNew НЕ ставится:
//цель укуса — конкретный враг, снаряд спавнит combatTick через addAnim сам.
const wolfClass = {
    "id": 100,
    "name": "quest.wolf.name",
    "attacks": [11],
    "effects": {"takeDamage": 1},
    "anims": [
        {"move":[
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/wolf/move/back.png"},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/wolf/move/front.png"},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/wolf/move/left.png"},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/wolf/move/right.png"}
        ]},
        {"attack":[
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/wolf/attack/back.png","once":1},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/wolf/attack/front.png","once":1},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/wolf/attack/left.png","once":1},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/wolf/attack/right.png","once":1}
        ]},
        {"others":[
            {"speed":10,"times":4,"w":128,"h":51,"img":"./images/enemy/wolf/others/damage.png","once":1,"stun":1},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/wolf/others/death.png","once":1},
            {"speed":5,"times":4,"w":128,"h":51,"img":"./images/enemy/wolf/others/wait.png"}
        ]}
    ],
}
const WOLF_AGGRO = 8 * 32        //радиус «враги напали на героя» от Волка (px)
const WOLF_BITE_RANGE = 52       //дистанция укуса (центр-центр)
const BITE_CD = 25               //кулдаун укуса: attack.11 cooldown 0.4с ≈ 25 тиков
const USE_TICKS = 45             //полоска взаимодействия с NPC (как у объектов, ~0.72с)
//V131: сколько тиков Волк игнорирует врага, к которому не смог построить путь (~4.8с)
const WOLF_FOE_SKIP_TICKS = 300
//кольцо клеток вокруг данной для поиска свободной (как NEAR в pets.js)
const NEAR = [[0,0],[0,-1],[1,-1],[-1,-1],[1,0],[-1,0],[1,1],[-1,1],[0,1]]

let wolfRef = null      //живая сущность Волка текущей сцены
let useBarFill = null   //полоска взаимодействия над NPC
//V133 (репорт юзера): задний фрейм полоски (bar1mini.png) — как у интерактивных объектов
let useBarBack = null
let useT = 0

function wolfUnit() {
    return wolfRef
}

// ---------- спавн NPC (newGame: 2 глава, 1 этаж, стартовая комната) ----------
function questNewGame(next) {
    if (next === false) {
        status.quest = {"state":0}
        useT = 0
        useBarFill = null
        useBarBack = null
        wolfRef = null
        //V106: квест одноразовый (сюжетный) — выполненный больше не предлагается
        status.meta.page === 2 && status.levelFloor === 0 &&
            !(status.meta.quests && status.meta.quests.wolf) && spawnWolfNpc()
        return
    }
    //новый этаж при активном квесте сюда дойти не может (награда выдаётся на выходе
    //этажа, в nextFloor) — страховка от рассинхрона: сцена сменилась, ссылки гасим
    wolfRef = null
    useBarFill = null
    useBarBack = null
    useT = 0
}

function spawnWolfNpc() {
    const lv = dataGeneric.scenes[status.levelFloor]
    if (!lv.roomsArr || !lv.roomsArr[0]) return
    const f = lv.floor[lv.roomsArr[0][0]]
    status.quest = {"state":1,"room":[f[0],f[1],f[2],f[3]]}
    //угол комнаты (клетка внутрь от угла); клетка не пол — поиск по кольцу NEAR
    let cell = null
    for (let i = 0; i < NEAR.length; i++) {
        const cx = f[0] + 1 + NEAR[i][0]
        const cy = f[1] + 1 + NEAR[i][1]
        if (status.matrixLevel[cy] && status.matrixLevel[cy][cx] === 1) { cell = [cx,cy]; break }
    }
    //V110: вся угловая зона могла оказаться перекрыта записями стен (createMatrix пишет
    //2 поверх пола — тот же дефект, что рвал проёмы дверей для navMatrix) — тогда Волк
    //молча не спавнился. Запасной проход: первая клетка пола в глубине комнаты
    if (!cell) {
        for (let y = f[1] + 1; y < f[1] + f[3] - 1 && !cell; y++) {
            for (let x = f[0] + 1; x < f[0] + f[2] - 1 && !cell; x++) {
                status.matrixLevel[y] && status.matrixLevel[y][x] === 1 && (cell = [x, y])
            }
        }
    }
    if (!cell) { status.quest = {"state":0}; return }
    const anim = wolfClass.anims[2].others[2]
    objectValues.push({"id":status.oVcount,"type":"pet","wolfAlly":1,"npc":1,"class":wolfClass,
    "stats":JSON.parse(JSON.stringify(WOLF_STATS)),"attacksCdInit":1,"idleT":0,
    "animCounters":60/anim.speed,"currentAnim":anim,"currentStill":0,"room":null,"cells":[],
    "state":0,"stop":0,"xCell":cell[0],"yCell":cell[1],"noStunTime":0,
    "img":image(svgArr[1],cell[0]*32,cell[1]*32,anim.w,anim.h,anim.img,{"times":anim.times,"id":status.oVcount,"frame":1})})
    status.oVcount++
    wolfRef = objectValues[objectValues.length-1]
    wolfRef.rect = wolfRef.img.clipRect
    //кулдаун укуса — как у врагов при спавне (encounters.js)
    wolfRef.stats.attacksCd[0] = Math.trunc(data.attacks[wolfClass.attacks[0]].cooldown*1000/16)
}

function removeWolf(wolf) {
    if (useBarFill) { useBarFill.remove(); useBarFill = null }
    if (useBarBack) { useBarBack.remove(); useBarBack = null }
    useT = 0
    removeEntShadow(wolf)
    hideEnemyHpBar(wolf)
    const idx = objectValues.indexOf(wolf)
    idx !== -1 && objectValues.splice(idx, 1)
    releaseSprite(wolf.img)
    wolfRef === wolf && (wolfRef = null)
}

// ---------- окно «текущих квестов» (правый край, под мини-картой) ----------
let trackNodes = []
function questTrackerShow() {
    questTrackerHide()
    const x = 1612 + (uiRightEdge() - 1920)
    trackNodes.push(rect(svgArr[2],x,252,296,86,"1px","rgb(204, 153, 102)","rgba(16, 12, 10, 0.85)",{"rx":"5px","id":"questWinBack"}))
    trackNodes.push(text(svgArr[2],x + 148,284,"0pt","26pt","black","2px","rgb(204, 153, 102)",T("quest.title"),{"id":"questWinTitle","size":24,"font":"baseFont4","anchor":"middle"}))
    trackNodes.push(text(svgArr[2],x + 148,318,"0pt","24pt","black","2px","rgb(230, 220, 200)",T("quest.track"),{"id":"questWinText","size":22,"font":"baseFont4","anchor":"middle"}))
}
function questTrackerHide() {
    while (trackNodes.length > 0) {
        const n = trackNodes.pop()
        n && n.remove && n.remove()
    }
}

// ---------- тик Волка (вызов из enemyAI.enemyTick, ветка pet) ----------
function wolfAllyTick(wolf) {
    if (!status.quest) return
    if (wolf.dying) {
        wolf.deathTicks--
        wolf.deathTicks <= 0 && removeWolf(wolf)
        return
    }
    if (status.quest.state === 1) { npcTick(wolf); return }
    if (status.quest.state !== 2) return
    //V105: постоянный ХП-бар — игрок всегда видит состояние Волка (каждый тик
    //освежает lifetime бара enemyHpBarFx)
    showEnemyHpBar(wolf)
    //V105: замах укуса — Волк СТОИТ, анимация атаки доигрывается целиком. Раньше
    //позу атаки сразу перебивала ходьба (followTick после гибели цели от первого
    //укуса / stepAlongPath по пути к герою) — сами анимации атаки не были видны.
    //Укус (снаряд атаки 11) спавнится в середине замаха — как attackNew.step=3 у врагов
    if (wolf.attacking) {
        wolf.attackTicks--
        if (wolf.biteTick > 0) {
            wolf.biteTick--
            if (wolf.biteTick === 0 && wolf.biteFoe && wolf.biteFoe.type === "enemy" &&
                wolf.biteFoe.stats.hp > 0) {
                addAnim([11,wolf.biteDir],wolf.biteFoe,wolf,wolf.biteDir)
            }
        }
        if (wolf.attackTicks <= 0) {
            wolf.attacking = 0
            wolf.stop = 0
            wolf.idleT = 0
            setEnemyPose(wolf, waitPose(wolf))
        }
        return
    }
    //V106: конец once-анимаций обрабатывается в своих ветках (замах — выше);
    //старый «стоп-сброс» убран: он размораживал простой и сразу ставил wait
    const foe = findFoe(wolf)
    foe ? combatTick(wolf, foe) : followTick(wolf)
}

//NPC: стоит в углу; герой ушёл из стартовой комнаты не поговорив — исчезает
function npcTick(wolf) {
    const r = status.quest.room
    //V117: NPC исчезает, только когда ИЗ стартовой комнаты ушли ВСЕ живые герои
    let anyInside = false
    for (let i = 0; i < status.players.length; i++) {
        const P = status.players[i]
        if (P.obj.type !== "hero") continue
        const hx = Math.trunc(P.x / 32)
        const hy = Math.trunc(P.y / 32)
        if (hx >= r[0] && hx < r[0] + r[2] && hy >= r[1] && hy < r[1] + r[3]) { anyInside = true; break }
    }
    if (!anyInside) {
        removeWolf(wolf)
        status.quest = {"state":0}
        return
    }
    useBarTick(wolf)
}

//взаимодействие с NPC: герой рядом — растёт полоска (как у объектов), полная — диалог
function useBarTick(wolf) {
    const wp = rectPos(wolf.rect)
    //V117: полоску взаимодействия растит БЛИЖАЙШИЙ к Волку живой герой;
    //класс триггера фиксируется для награды диалога (контекст к моменту
    //клика уже не гарантирован — мир на паузе)
    const HQ = nearestPlayer(wp[0], wp[1])
    if (!HQ) return
    setContext(HQ)
    const d = Math.hypot((HQ.x + 16) - (wp[0] + 16), (HQ.y + 25) - (wp[1] + 25))
    if (d > 56) {
        useT > 0 && (useT = 0)
        useBarFill && useBarFill.setAttribute("width", 0)
        setContext(status.players[0])
        return
    }
    useT++
    if (!useBarFill) {
        useBarFill = rect(svgArr[1],wp[0] - 9,wp[1] - 16,0,6,"none","0px","#cc9966",{"id":"wolfUseBar"})
        //V133: задний фрейм bar1mini — как у полосок интерактивных объектов
        useBarBack = worldImage(svgArr[1],wp[0] - 11,wp[1] - 19,64,14,"./images/UI/panels/bar1mini.png",{"id":"wolfUseBarR"})
    }
    useBarFill.setAttribute("width", Math.trunc(50 * useT / USE_TICKS))
    if (useT >= USE_TICKS) {
        useBarFill.remove()
        useBarFill = null
        if (useBarBack) { useBarBack.remove(); useBarBack = null }
        useT = 0
        //V126: владелец квеста фиксируется (кто приручил Волка) — награда прощания
        //идёт ЕГО классу и в ЕГО инвентарь (в коопе игроки разные)
        questHero = HQ
        openWolfDialog(wolf)
    }
}

function openWolfDialog(wolf) {
    openDialog({
        "lines":[
            {"who":"wolf","key":"dlg.wolf.1"},
            {"who":"hero","key":"dlg.hero.1"},
            {"who":"wolf","key":"dlg.wolf.2"}
        ],
        "choices":[
            {"label":"dlg.choice.agree","cb":() => {
                status.quest.state = 2
                wolf.npc = 0
                questTrackerShow()
            }},
            {"label":"dlg.choice.deny","cb":() => {
                removeWolf(wolf)
                status.quest = {"state":0}
            }}
        ]
    })
}

//враги, напавшие на героя (заметили/позваны/атакуют/раненые в бегстве), в радиусе
//от Волка — ближайший. V107: добавлено состояние FLEE (E-10) — раненый враг, который
//уже нападал на героя, остаётся целью Волка, иначе он «не помогал» против убегающих
function findFoe(wolf) {
    const wp = rectPos(wolf.rect)
    const wx = wp[0] + 16
    const wy = wp[1] + 25
    let best = null
    let bestD = Infinity
    //V131: недостижимая цель (3 пустых пути в combatTick) временно пропускается —
    //иначе Волк вечно стоит над ней и не следует за героем
    const skipLive = wolf.skippedFoe && status.time - (wolf.skippedT || 0) < WOLF_FOE_SKIP_TICKS
    const gE = world.queries.genemy && world.queries.genemy.entities
    if (!gE) return null
    const snap = gE.slice()
    for (let i = 0; i < snap.length; i++) {
        const o = DATA.bag[snap[i]]
        if (!o || o.type !== "enemy" || o.lying !== undefined || o.stats.hp <= 0) continue
        //V113: мирный Огнементаль Волк не трогает (квест «Погоня за пламенем»)
        if (o.flameNpc === 1) continue
        if (skipLive && o === wolf.skippedFoe) continue
        if (!(o.noticed || o.called || o.state === ENEMY_STATE.ATTACK || o.state === ENEMY_STATE.FLEE)) continue
        const p = rectPos(o.rect)
        const d = Math.hypot((p[0] + 16) - wx,(p[1] + 25) - wy)
        if (d < bestD) { bestD = d; best = o }
    }
    return bestD <= WOLF_AGGRO ? best : null
}

//стояние как у героя (V106): при остановке кадр ходьбы ЗАМОРАЖИВАЕТСЯ (stop=1 —
//animPlay не листает кадры, как при keyup героя), wait-анимация запускается
//однократно только после долгого простоя — 120 тиков ≈ 2с, как checkWait героя
const IDLE_WAIT_TICKS = 120
function followTick(wolf) {
    //мирный режим: «по пятам» за героем штатной механикой питомцев (petFollowTick
    //строит путь, stepAlongPath в enemyAI его отыгрывает)
    petFollowTick(wolf)
    if (wolf.path && wolf.path.length) {
        //пошёл: разморозка и сброс простоя
        if (wolf.stop === 1 || wolf.idleT) { wolf.stop = 0; wolf.idleT = 0 }
        return
    }
    //стоит на месте: заморозить кадр ходьбы, через 120 тиков — wait
    const idle = wolf.idleT || 0
    if (idle < IDLE_WAIT_TICKS) {
        if (!idle) wolf.stop = 1
        wolf.idleT = idle + 1
    }
    if (wolf.idleT === IDLE_WAIT_TICKS) {
        const wait = waitPose(wolf)
        if (wolf.currentAnim !== wait) {
            wolf.stop = 0
            setEnemyPose(wolf, wait)
        }
    }
}

function combatTick(wolf, foe) {
    wolf.stats.attacksCd[0] > 0 && wolf.stats.attacksCd[0]--
    const wp = rectPos(wolf.rect)
    const fp = rectPos(foe.rect)
    const dx = (fp[0] + 16) - (wp[0] + 16)
    const dy = (fp[1] + 25) - (wp[1] + 25)
    if (Math.hypot(dx,dy) <= WOLF_BITE_RANGE) {
        if (wolf.stats.attacksCd[0] > 0) {
            //ждёт кулдаун у цели: кадр ходьбы заморожен (как при остановке)
            wolf.path = []
            wolf.stop = 1
            return
        }
        const dir = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 3 : 2) : (dy > 0 ? 1 : 0)
        wolf.direction = dir
        const anim = wolfClass.anims[1].attack[dir]
        wolf.stop = 0
        setEnemyPose(wolf, anim)
        wolf.attacking = 1
        const swing = Math.ceil(anim.times * animInterval(wolf, anim))
        wolf.attackTicks = swing + 1
        //укус — в середине замаха (как attackNew.step 3 из 4 у врагов)
        wolf.biteDir = dir
        wolf.biteFoe = foe
        wolf.biteTick = Math.max(1, Math.round(swing * 3 / 4))
        wolf.stats.attacksCd[0] = BITE_CD
        wolf.path = []
        return
    }
    //V107: подход к цели — обязательно снять заморозку. stop=1 от ожидания кулдауна
    //у ПРЕЖНЕЙ цели переживал смену цели (та умерла/убежала), а stepAlongPath при
    //stop=1 молчит: Волк навсегда замирал посреди комнаты, «не помогая в бою»
    wolf.stop = 0
    wolf.idleT = 0
    //подход к врагу по BFS (общий поиск пути), перестройка при смене его клетки
    const wc = [Math.trunc((wp[0] + 16) / 32),Math.trunc((wp[1] + 25) / 32)]
    const tc = [Math.trunc((fp[0] + 16) / 32),Math.trunc((fp[1] + 25) / 32)]
    if (wolf.path && wolf.path.length && wolf.pathTarget &&
        wolf.pathTarget[0] === tc[0] && wolf.pathTarget[1] === tc[1]) return
    if (wolf.pathTarget === null && status.time % 20 !== wolf.id % 20) return
    wolf.path = buildChasePath(wc,tc,wolf)
    //V131 (репорт юзера: «волк останавливался посреди комнаты и не следовал ни за каким
    //игроком»): findFoe видит врагов «через стены» (aggro по радиусу, без LOS) — враг за
    //закрытой дверью/в неоткрытой комнате давал ПУСТОЙ путь каждый ретрай, и Волк стоял
    //над недостижимой целью вечно. Три неудачные попытки (~1с, ретрай раз в 20 тиков) —
    //цель отпускается (findFoe пропускает её WOLF_FOE_SKIP_TICKS): Волк возвращается к
    //герою; когда путь появится (дверь открыта), цель подхватится снова
    if (wolf.path.length) {
        wolf.pathFails = 0
        wolf.pathTarget = tc
    } else {
        wolf.pathTarget = null
        wolf.pathFails = (wolf.pathFails || 0) + 1
        if (wolf.pathFails >= 3) {
            wolf.skippedFoe = foe
            wolf.skippedT = status.time
            wolf.pathFails = 0
        }
    }
}

// ---------- урон по Волку ----------
//снаряд врага задел Волка (вызов из damageHero; герой проверяется первым — если
//снаряд попал герою, до Волка он не доходит). Урон гасит снаряд, как попадание.
function wolfHitBy(bullet) {
    const wolf = wolfUnit()
    if (!wolf || wolf.dying || bullet.result === 1) return false
    const wp = rectPos(wolf.rect)
    const bp = rectPos(bullet.rect)
    if (!checkCollision(wp[0],bp[0],wolf.rect._w,bullet.rect._w,wp[1],bp[1],wolf.rect._h,bullet.rect._h)) return false
    bullet.currentAnim.effect && playEffect(bullet,data.effects[bullet.currentAnim.effect])
    playback(strike[15].vol,0,0,status.settings.soundVolume)
    bullet.result = 1
    if (bullet.type === "bullet") {
        releaseSprite(bullet.img)
        const idx = objectValues.indexOf(bullet)
        idx !== -1 && objectValues.splice(idx, 1)
    }
    const a = bullet.atacker
    let dmg = 1
    a && a.stats && a.stats.dmg &&
        (dmg = Math.trunc(Math.random() * (a.stats.dmg[1] - a.stats.dmg[0] + 1) + a.stats.dmg[0]))
    wolfDamage(wolf,dmg)
    return true
}

//плоский урон Волку (снаряды врагов) — красная цифра, ХП-бар, смерть = провал
function wolfDamage(wolf, dmg) {
    if (wolf.dying) return
    const wp = rectPos(wolf.rect)
    const before = wolf.stats.hp
    wolf.stats.hp -= dmg
    floatText(Math.trunc(Math.random() * 24) + wp[0],wp[1] - 6,dmg,"#CD5C5C","12px","none")
    showEnemyHpBar(wolf,before)
    if (wolf.stats.hp <= 0) questFail(wolf)
}

function questFail(wolf) {
    wolf.dying = 1
    //анимация смерти (once) — по концу animPlay заморозит сущность, тик добьёт
    setEnemyPose(wolf,wolfClass.anims[2].others[1])
    wolf.deathTicks = Math.ceil(wolfClass.anims[2].others[1].times *
        animInterval(wolf,wolfClass.anims[2].others[1])) + 2
    status.quest.state = 5
    questTrackerHide()
    hideEnemyHpBar(wolf)
    playback(strike[9].vol,0,0,2*status.settings.soundVolume)
    floatText(status.hero.x - 16 + Math.trunc(Math.random() * 32),status.hero.y - 16,T("quest.failed"),"#FF3333","20px","none")
    journalAdd(T("quest.journ.fail"),J_RED)
}

// ---------- выход с этажа с живым Волком (вызов из nextFloor) ----------
//V126: владелец квеста (кто приручил) — для награды по ЕГО классу
let questHero = null
function questFloorExit(cont) {
    openDialog({
        "lines":[{"who":"wolf","key":"dlg.wolf.3"}],
        "choices":[{"label":"dlg.choice.accept","cb":() => {
            //случайный легендарный (сетовый) предмет сета ПО КЛАССУ героя (V106):
            //Плут — «Великий вор», Волшебница — «Учёная волшебница», Рыцарь —
            //«Победитель турниров», Валькирия — «Доблестный небожитель»;
            //itemGenerate сам кладёт его в инвентарь/пустой слот куклы (V102).
            //V126 (репорт юзера: после «ПРИНЯТЬ» не было ни спуска, ни экрана очков):
            //здесь читался HQ — локальная переменная useBarTick, ReferenceError убивал
            //весь колбэк; берём зафиксированного владельца квеста (кооп — свой герой)
            const hero = (questHero && status.players.indexOf(questHero) !== -1) ? questHero : status.players[0]
            setContext(hero)
            itemGenerate(4,{"setN":[1,2,3,4][hero.class] || 1})
            playback(strike[3].vol,0,0,2*status.settings.soundVolume)
            questTrackerHide()
            status.quest.state = 4
            //V106: отметка о выполнении сюжетного квеста — в мету (сохраняется)
            status.meta.quests.wolf = 1
            save()
            const wolf = wolfUnit()
            wolf && removeWolf(wolf)
            setContext(status.players[0])
            cont()
        }}]
    })
}

//снос при пересоздании сцены (del.js)
function questDel() {
    questTrackerHide()
    useBarFill && useBarFill.remove()
    useBarFill = null
    useBarBack && useBarBack.remove()
    useBarBack = null
    useT = 0
    wolfRef = null
    questHero = null
    status.quest = {"state":0}
}

export { questNewGame, questFloorExit, questDel, wolfAllyTick, wolfHitBy, wolfUnit, questTrackerHide }
