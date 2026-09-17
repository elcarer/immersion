//V65: 4 этаж «Пустота» — босс «Циклоп Пустоты» и его особая способность «Сгусток пустоты».
//Спавн: spawnVoidBoss(level) зовётся из newGame ПОСЛЕ sceneGenerate по образцу spawnFinEnemy
//(finPillars.js) — множители глав, инициализация attacksCd, hpBar боссу. Спрайты — ЗАГЛУШКА
//от «Демона» (id 18), сами анимации босса описаны в data.js (группа 18, id 25).
//Способность «voidBlob» (секунды в data.js): раз в N секунд из босса вылетает Сгусток —
//заглушка 64×64, летит по спирали (угол крутится, радиус растёт) от точки спавна, пока не
//покинет пределы комнаты босса; попадание в героя — 6-18 урона напрямую через takeDamage
//(стандартная броня/уклонение/блок применяются, как у любого урона врагов). Сгустки живут
//в собственном массиве (не objectValues) — их двигает spritePos, тик зовёт gameLoop.
//V79: «invulnerability» (секунды в data.js; цикл тикает enemyAI.tickInvuln): каждые N секунд
//босс на N/2 секунд неуязвим (enemy.invulnActive) — чернеет (INVULN_FILTER), стоит на месте,
//атакует как обычно, а каждый залп Сгустков — ДВОЙНОЙ: зеркальная пара, второй Сгусток
//под углом +180° с тем же вращением (решение пользователя), урон каждого обычный (6-18).
//V85: босс 4 этажа случаен (50/50): Циклоп (id 25) или «Медуза пустоты» (id 26); V87: сам
//розыгрыш перенесён в nextFloor — до комикса спуска, заставки 4 этажа зависят от босса.
//У Медузы свои способности вместо циклоповских: «segmentation» (счётчик в data.js) — при
//падении ХП до половины максимума и ниже сущность делится надвое (spawnMedusaPiece:
//осколки вдвое меньше, макс ХП каждого = остаток ХП делившегося, эффект снаряда —
//уменьшенные копии атаки 21 → 22/23); порог проверяет medusaSplitTick из gameLoop.
//Этаж завершается гибелью ПОСЛЕДНЕГО осколка (enemyAI.enemyDie → medusaPieceDied →
//voidBossFinale(осколок): дроп в точке его смерти + выход как у Циклопа). Полоса ХП
//босса — общая на всех осколков (сумма ХП против суммы максимумов, hpBar.changeBossHP).
//Смерть босса (enemyAI.enemyDie → voidBossFinale, V67) НЕ завершает этаж сразу: сначала
//с босса выпадает его дроп (80% сетовая легендарка / 20% реликвия — V86), затем
//в комнате появляется ВЫХОД (интерактивный объект типа 13, как спуск на других этажах,
//спрайт 4exit.png 96×128); взаимодействие с ним запускает стандартное завершение этажа
//(nextFloor → комикс концовки: 4-0/4-1 у Циклопа, 4-2/4-3 у Медузы — V87 → экран очков).
//V91: третий босс — «Гриб пустоты» (id 27, data.enemes[18][2]): выбор в nextFloor стал
//1 из 3. Поведение — как у Циклопа, без его способностей; своя способность «spore»
//(секунды в data.js): раз в N секунд разбрасывает 10 спор по параболе в случайные
//свободные клетки комнаты (спрайт босса в 1/10, отдельный файл spore.png); наступание
//героя уничтожает спору, через 8с лежания невытоптанная прорастает мини-грибом
//(spawnSporeMini: клон класса без тега boss, ХП/урон/опыт 1/10 актуальных статов,
//размер 1/5, скорость полная). При смерти босса споры исчезают (решение пользователя).
//Заставки 4 этажа у Гриба пока медузинские (comix.js — своего арта нет).
import { status } from "../scripts/start.js"
import { data } from "../scripts/data.js"
import { dataGeneric } from "../scripts/sceneGenerate.js"
//V85: releaseSprite — спрайт делившейся Медузы возвращается в пул (труп не оставляем)
import { svgArr, image, worldImage, rectPos, spritePos, releaseSprite } from "../scripts/svg.js"
import { objectValues, screenPic } from "../scripts/del.js"
import { hpBar } from "../scripts/hpBar.js"
import { checkCollision } from "../scripts/damage.js"
import { takeDamage } from "../scripts/takeDamage.js"
//V67: завершение этажа больше не отсюда — выход (тип 13) ведёт через useObject → nextFloor
//V67: дроп босса падает в общую кучу поднимаемого — takeDrop
//V68: пустой пул уникальных реликвий — 10% дроп даёт легендарный item4 (решение пользователя)
import { dropArr } from "../scripts/useObject.js"
import { relicPoolLeft } from "../scripts/relics.js"
//V69: дроп босса не застревает в стенах — перенос на свободную клетку (dropSafe.js)
import { placeDrop } from "../scripts/dropSafe.js"
//V85: деление Медузы — строка в журнале; тень делившейся снимается с пола вместе с ней
import { journalAdd, J_YELLOW } from "../scripts/journal.js"
import { T } from "../scripts/localization.js"
import { removeEntShadow } from "../scripts/groundShadow.js"

//V67: спрайт выхода с 4 этажа (решение пользователя; 96×128, рисуется 1:1 с якорем низа)
const EXIT_SPRITE = "./images/dungeon/objects/4exit.png"

//ЗАГЛУШКА спрайта Сгустка пустоты (64×64) — однокадровый эффект 12.png; заменится
//готовым спрайтом, когда он будет нарисован
const BLOB_SPRITE = "./images/effects/voidstone.png"
const BLOB_SIZE = 64
//радиальный прирост за тик, px (скорость разлёта спирали)
const BLOB_RADIAL = 1.6
//поворот за тик, рад (направление случайное — по/против часовой)
const BLOB_ROT = 0.045
//урон Сгустка: 16 + случайное 0..12 = 16..28 (E-15: было 6..18, юзер дал +10)
const BLOB_DMG_MIN = 16
const BLOB_DMG_SPREAD = 13

let bossRef = null   // объект Циклопа из objectValues (для Медузы остаётся null — V85)
let blobCd = 0       // тики до следующего Сгустка
let blobs = []       // {img, ox, oy, x, y, r, ang, dir, hit, bx1, by1, bx2, by2}
let finaleArmed = false

//V85: Медуза пустоты (data.enemes[18][1]) — её осколки ищутся по class.id во всех
//системах (полоса ХП, тик деления, последний осколок)
const MEDUSA_ID = 26

//----- V91: Гриб пустоты (id 27) — способность «spore» -----
//Раз в stats.spore секунд босс разбрасывает 10 спор: каждая вылетает из центра босса
//и по параболе (линейное сближение + дуга-«высота» визуально вверх) летит в случайную
//свободную клетку комнаты. Лежит 8 секунд: наступание героя уничтожает спору, иначе
//спора прорастает мини-грибом (spawnSporeMini). При смерти босса споры исчезают.
const SPORE_COUNT = 10
const SPORE_SIZE = 13            //128/10 ≈ 13 — спора = спрайт босса в 1/10 (по ТЗ)
const SPORE_SPRITE = "./images/enemy/mushroom/spore.png"
const SPORE_LAND_TICKS = Math.round(8000 / 16) //8с жизни на полу до прорастания
const SPORE_FLY_TICKS = 36       //полёт ~0.6с
const SPORE_ARC = 56             //высота дуги полёта, px
const MINI_K = 1 / 5             //мини-гриб = 1/5 босса (по ТЗ)
//E-15: снаряд мини — уменьшенная копия «Звезды пустоты» (24, спрайт ×0.2 от 21 —
//по принципу осколков Медузы 22/23); урон считается по stats.dmg стрелка
const MINI_ATTACK = 24
//E-15: прибавка к урону мини поверх 1/10 статов босса (2-4 слишком мало → 12-14 на 4 главе)
const MINI_DMG_BONUS = 10

let sporeBossRef = null
let sporeCd = 0
let spores = []   // {img, sx, sy, tx, ty, t, fly, arc, landed, life}

//----- спавн босса (newGame → после sceneGenerate, как configPortal) -----
function spawnVoidBoss(level) {
    if (!level.roomsArr || !level.roomsArr.length) return
    let room = level.roomsArr[0]
    let rf = level.floor[room[0]]
    //клетка босса: центр комнаты по X, 8 клеток ниже верхнего края (герой спавнится
    //в центре — [rf[5], rf[6]-1]; между ними 7 клеток, комната 24×24)
    let cell = [rf[5], rf[1] + 8]
    //V85: босс случаен — 50/50 Циклоп (id 25) / Медуза пустоты (id 26); V87: выбор сделан
    //заранее в nextFloor (до комикса спуска — заставка зависит от босса), здесь читаем его,
    //страховка — при пустом поле решаем на месте
    let bossIdx = status.voidBossId === 26 ? 1 : status.voidBossId === 27 ? 2 : status.voidBossId === 25 ? 0 : Math.trunc(Math.random() * 3)
    let enemy1 = data.enemes[18][bossIdx]
    let stats = JSON.parse(JSON.stringify(enemy1.stats))
    //множители глав — тот же конвейер, что openRoom/encounters/spawnFinEnemy
    if (status.meta.page > 2) {
        stats.hp *= 2
        stats.dmg[0] += 2
        stats.dmg[1] += 6
        stats.speed += 1
        stats.range += 1
    }
    //V65: глава 4 — ещё х1.5 ХП, урон +2/+8, скорость и зоркость +1; V67a: скорость +2
    if (status.meta.page > 3) {
        stats.hp *= 1.5
        stats.dmg[0] += 2
        stats.dmg[1] += 8
        stats.speed += 2
        stats.range += 1
    }
    //V85: максимум ХП фиксируем после множителей — от него считается порог деления
    //Медузы (stats.hp/maxHp) и общая полоса осколков (hpBar)
    stats.maxHp = stats.hp
    let e = {"id":status.oVcount,"type":"enemy","class":enemy1,"stats":stats,"animCounters":60/enemy1.anims[2].others[2].speed,"currentAnim":enemy1.anims[2].others[2],"currentStill":0,"room":room,"cells":[cell],"state":0,"stop":0,"xCell":cell[0],"yCell":cell[1],"noStunTime":0,
    "img":image(svgArr[1],
        cell[0]*32,
        cell[1]*32-19,
        enemy1.anims[2].others[2].w,
        enemy1.anims[2].others[2].h,
        enemy1.anims[2].others[2].img,
        {"times":enemy1.anims[2].others[2].times,"id":status.oVcount,"frame":1})}
    objectValues.push(e)
    status.oVcount++
    e.rect = e.img.clipRect
    enemy1.skills && enemy1.skills.length > 0 && (e.skills = enemy1.skills)
    let lengthAttacks = e.class.attacks.length
    for (let iA = 0; iA < lengthAttacks; iA++) {
        e.stats.attacksCd[iA] = Math.trunc((data.attacks[e.class.attacks[iA]].cooldown*1000)/16)
    }
    enemy1.boss === 1 && hpBar(e)
    //V85: поколение сущности (0 — босс, 1 — мини-осколки, 2 — микро) — размер осколков
    //и копия атаки считаются от parent.pieceLevel + 1
    e.pieceLevel = 0
    //Циклоп — Сгустки (нужен bossRef); Медуза — деление (bossRef не ставим: тик Сгустков
    //выходит сразу, осколками управляет medusaSplitTick, дроп идёт от погибшего осколка)
    if (enemy1.stats.voidBlob) {
        bossRef = e
        blobCd = Math.round(enemy1.stats.voidBlob * 1000 / 16) //4с = 250 тиков
        sporeBossRef = null
    } else if (enemy1.stats.spore) {
        //V91: Гриб пустоты — копилка спор, Сгустков нет
        sporeBossRef = e
        sporeCd = Math.round(enemy1.stats.spore * 1000 / 16) //10с = 625 тиков
        bossRef = null
    } else {
        bossRef = null
        sporeBossRef = null
    }
    finaleArmed = false
}

//----- V85: Медуза пустоты — деление надвое (segmentation) -----
//Осколок = тот же класс (id 26) с уменьшенными в k раз анимациями (k = 1/2^level):
//клон строится ВСЕГДА от базовой записи в data.js (не от parent.class — тот уже
//уменьшен), attackNew перенаправляется на уменьшенные копии снаряда 22/23.
//ХП осколка = ОСТАТОК ХП делившейся (и сразу её максимум), segmentation на 1 меньше.
function spawnMedusaPiece(cell, parent, level) {
    let base = data.enemes[18][1]
    let k = 1 / Math.pow(2, level)
    let cls = JSON.parse(JSON.stringify(base))
    for (let gI = 0; gI < cls.anims.length; gI++) {
        let grp = cls.anims[gI]
        for (let key in grp) {
            let arr = grp[key]
            for (let iA = 0; iA < arr.length; iA++) {
                arr[iA].w = Math.round(arr[iA].w * k)
                arr[iA].h = Math.round(arr[iA].h * k)
                //эффект снаряда тоже меньше (решение пользователя): 22 у мини, 23 у микро
                arr[iA].attackNew && (arr[iA].attackNew.anim[0] = level === 1 ? 22 : 23)
            }
        }
    }
    let stats = JSON.parse(JSON.stringify(parent.stats))
    stats.hp = parent.stats.hp
    stats.maxHp = parent.stats.hp
    stats.segmentation = parent.stats.segmentation - 1
    let wait = cls.anims[2].others[2]
    let frameW = wait.w / (wait.times || 4)
    let e = {"id":status.oVcount,"type":"enemy","class":cls,"stats":stats,"animCounters":60/wait.speed,"currentAnim":wait,"currentStill":0,"room":parent.room,"cells":[cell],"state":0,"stop":0,"xCell":cell[0],"yCell":cell[1],"noStunTime":0,
    "img":image(svgArr[1],
        //кадр центрируем на клетке: логическая клетка (rect.x+16, rect.y+25) остаётся
        //клеткой спавна; сдвиг вверх (-19 у босса) масштабируется тем же k
        cell[0]*32 + 16 - frameW/2,
        cell[1]*32 - Math.round(19*k),
        wait.w,
        wait.h,
        wait.img,
        {"times":wait.times,"id":status.oVcount,"frame":1})}
    objectValues.push(e)
    status.oVcount++
    e.rect = e.img.clipRect
    e.pieceLevel = level
    let lengthAttacks = cls.attacks.length
    for (let iA = 0; iA < lengthAttacks; iA++) {
        e.stats.attacksCd[iA] = Math.trunc((data.attacks[cls.attacks[iA]].cooldown*1000)/16)
    }
    return e
}

//логическая клетка врага — та же формула, что enemyCellOf в enemyAI (центр rect +16/+25)
function pieceCellOf(o) {
    let p = rectPos(o.rect)
    return [Math.trunc((p[0] + 16) / 32), Math.trunc((p[1] + 25) / 32)]
}

//две свободные клетки рядом с делившейся: стены по matrixLevel, не клетка героя,
//не клетка живого врага; порядок — бока, верх/низ, диагонали; не нашли — клетка самой
//Медузы (расталкивание separateEnemiesTick разнесёт осколки)
function freeSplitCells(cell, parent) {
    let matrix = status.matrixLevel
    let heroCell = [Math.trunc(status.hero.x / 32), Math.trunc(status.hero.y / 32)]
    let taken = {}
    for (let i = 0; i < objectValues.length; i++) {
        let o = objectValues[i]
        if (o === parent || o.type !== "enemy" || !o.rect || o.stats.hp <= 0) continue
        let c = pieceCellOf(o)
        taken[c[0] + "," + c[1]] = 1
    }
    let order = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]]
    let free = []
    for (let i = 0; i < order.length && free.length < 2; i++) {
        let cx = cell[0] + order[i][0]
        let cy = cell[1] + order[i][1]
        if (!matrix || !matrix[cy] || matrix[cy][cx] !== 1) continue
        if (heroCell[0] === cx && heroCell[1] === cy) continue
        if (taken[cx + "," + cy]) continue
        free.push([cx, cy])
    }
    while (free.length < 2) free.push(cell)
    return free
}

//само деление: делившаяся исчезает без трупа (спрайт — в пул, тень — с пола, ссылкам
//враг-призрак обозначен типом corpse), рядом встают два осколка, строка в журнале
function splitMedusa(parent) {
    parent.type = "corpse"
    let idx = objectValues.indexOf(parent)
    idx >= 0 && objectValues.splice(idx, 1)
    parent.entShadow && removeEntShadow(parent)
    releaseSprite(parent.img)
    let level = (parent.pieceLevel || 0) + 1
    let spots = freeSplitCells([parent.xCell, parent.yCell], parent)
    journalAdd(T("journ.medusaSplit"), J_YELLOW)
    spawnMedusaPiece(spots[0], parent, level)
    spawnMedusaPiece(spots[1], parent, level)
}

//тик из gameLoop (после урона за тик): все Медузы с segmentation > 0, чьё ХП упало
//до половины максимума или ниже, делятся. Одно попадание, снимающее сразу больше
//половины, убивает без деления (ХП ≤ 0 — обычная смерть, порог не срабатывает)
function medusaSplitTick() {
    for (let i = objectValues.length - 1; i >= 0; i--) {
        let o = objectValues[i]
        if (!o || o.type !== "enemy" || !o.class || o.class.id !== MEDUSA_ID) continue
        if (!(o.stats.segmentation >= 1)) continue
        if (o.stats.hp <= 0 || o.stats.hp > o.stats.maxHp / 2) continue
        splitMedusa(o)
    }
}

//вызывается из enemyAI.enemyDie: true, если погиб ПОСЛЕДНИЙ осколок Медузы —
//только тогда этаж завершается (дроп + выход)
function medusaPieceDied(enemy) {
    for (let i = 0; i < objectValues.length; i++) {
        let o = objectValues[i]
        if (o === enemy || o.type !== "enemy" || !o.class || o.class.id !== MEDUSA_ID) continue
        if (o.stats.hp > 0) return false
    }
    return true
}

//----- V91: Гриб пустоты — тик способности «spore» (gameLoop, вне паузы) -----
function sporeTick() {
    if (!sporeBossRef || sporeBossRef.type !== "enemy" || sporeBossRef.stats.hp <= 0) return
    if (--sporeCd <= 0) {
        sporeCd = Math.round(sporeBossRef.class.stats.spore * 1000 / 16)
        scatterSpores()
    }
    moveSpores()
}

//10 случайных свободных клеток комнаты босса — критерии freeSplitCells: пол матрицы,
//не клетка героя, не клетка живого врага; без дубликатов в партии (40 попыток на спору,
//не нашли — партия меньше)
function scatterSpores() {
    let level = dataGeneric.scenes[status.levelFloor]
    let rf = level.floor[sporeBossRef.room[0]]
    let matrix = status.matrixLevel
    let heroCell = [Math.trunc(status.hero.x / 32), Math.trunc(status.hero.y / 32)]
    let taken = {}
    for (let i = 0; i < objectValues.length; i++) {
        let o = objectValues[i]
        if (o.type !== "enemy" || !o.rect || o.stats.hp <= 0) continue
        let c = pieceCellOf(o)
        taken[c[0] + "," + c[1]] = 1
    }
    let p = rectPos(sporeBossRef.rect)
    let sx = p[0] + sporeBossRef.rect._w / 2
    let sy = p[1] + sporeBossRef.rect._h / 2
    for (let n = 0; n < SPORE_COUNT; n++) {
        let cell = null
        for (let a = 0; a < 40 && !cell; a++) {
            let cx = rf[0] + Math.trunc(Math.random() * rf[2])
            let cy = rf[1] + Math.trunc(Math.random() * rf[3])
            if (!matrix[cy] || matrix[cy][cx] !== 1) continue
            if (heroCell[0] === cx && heroCell[1] === cy) continue
            if (taken[cx + "," + cy]) continue
            cell = [cx, cy]
            taken[cx + "," + cy] = 1
        }
        if (!cell) break
        screenPic.push(worldImage(svgArr[1],
            sx - SPORE_SIZE / 2, sy - SPORE_SIZE / 2, SPORE_SIZE, SPORE_SIZE, SPORE_SPRITE,
            {"id": screenPic.length - 1}))
        spores.push({"img": screenPic[screenPic.length - 1],
            "sx": sx, "sy": sy,
            "tx": cell[0] * 32 + 16, "ty": cell[1] * 32 + 16,
            "t": 0, "fly": SPORE_FLY_TICKS,
            "arc": SPORE_ARC * (0.7 + Math.random() * 0.6),
            "landed": 0, "life": SPORE_LAND_TICKS})
    }
}

function moveSpores() {
    let heroObj = status.hero.obj
    for (let i = spores.length - 1; i >= 0; i--) {
        let s = spores[i]
        if (!s.landed) {
            //полёт: сближение по прямой; «высота» = 4·arc·k·(1−k) — визуальный сдвиг вверх
            s.t++
            let k = s.t / s.fly
            let lift = 4 * s.arc * k * (1 - k)
            spritePos(s.img, s.sx + (s.tx - s.sx) * k - SPORE_SIZE / 2,
                s.sy + (s.ty - s.sy) * k - SPORE_SIZE / 2 - lift)
            if (s.t >= s.fly) {
                s.landed = 1
                spritePos(s.img, s.tx - SPORE_SIZE / 2, s.ty - SPORE_SIZE / 2)
            }
            continue
        }
        //лежит: герой наступил — уничтожена; 8с вышли — проросла мини-грибом
        if (heroObj && heroObj.type === "hero") {
            let hp = rectPos(heroObj.rect)
            if (checkCollision(hp[0], s.tx - SPORE_SIZE / 2, heroObj.rect._w, SPORE_SIZE,
                hp[1], s.ty - SPORE_SIZE / 2, heroObj.rect._h, SPORE_SIZE)) {
                s.img.remove()
                spores.splice(i, 1)
                continue
            }
        }
        if (--s.life <= 0) {
            spawnSporeMini([Math.trunc(s.tx / 32), Math.trunc(s.ty / 32)])
            s.img.remove()
            spores.splice(i, 1)
        }
    }
}

//мини-гриб из проросшей споры: клон базового класса (id 27) БЕЗ тега boss/elite и без
//«spore»; анимации в 1/5 (как у осколков Медузы — k-масштаб w/h, кадр окна не меняется);
//статы — 1/10 АКТУАЛЬНЫХ параметров босса (после множителей глав): ХП (от maxHp)/урон/
//опыт; скорость и зоркость полные, атаки те же (решения пользователя). Структура — как
//у spawnMedusaPiece
function spawnSporeMini(cell) {
    let boss = sporeBossRef
    let cls = JSON.parse(JSON.stringify(data.enemes[18][2]))
    delete cls.boss
    delete cls.elite
    for (let gI = 0; gI < cls.anims.length; gI++) {
        let grp = cls.anims[gI]
        for (let key in grp) {
            let arr = grp[key]
            for (let iA = 0; iA < arr.length; iA++) {
                arr[iA].w = Math.round(arr[iA].w * MINI_K)
                arr[iA].h = Math.round(arr[iA].h * MINI_K)
                //E-15: снаряд мини — уменьшенная копия атаки (как у осколков Медузы)
                arr[iA].attackNew && (arr[iA].attackNew.anim[0] = MINI_ATTACK)
            }
        }
    }
    let miniHp = Math.max(1, Math.trunc(boss.stats.maxHp / 10))
    let stats = {"hp": miniHp, "maxHp": miniHp,
        "dmg": [Math.max(1, Math.round(boss.stats.dmg[0] / 10)) + MINI_DMG_BONUS, Math.max(1, Math.round(boss.stats.dmg[1] / 10)) + MINI_DMG_BONUS],
        "exp": Math.max(1, Math.trunc(boss.stats.exp / 10)),
        "speed": boss.stats.speed, "range": boss.stats.range,
        "attacksCd": [], "noStunTime": boss.stats.noStunTime, "desc": cls.stats.desc}
    let wait = cls.anims[2].others[2]
    let frameW = wait.w / (wait.times || 4)
    let e = {"id":status.oVcount,"type":"enemy","class":cls,"stats":stats,"animCounters":60/wait.speed,"currentAnim":wait,"currentStill":0,"room":boss.room,"cells":[cell],"state":0,"stop":0,"xCell":cell[0],"yCell":cell[1],"noStunTime":0,
    "img":image(svgArr[1],
        cell[0]*32 + 16 - frameW/2,
        cell[1]*32 - Math.round(19*MINI_K),
        wait.w,
        wait.h,
        wait.img,
        {"times":wait.times,"id":status.oVcount,"frame":1})}
    objectValues.push(e)
    status.oVcount++
    e.rect = e.img.clipRect
    let lengthAttacks = cls.attacks.length
    for (let iA = 0; iA < lengthAttacks; iA++) {
        e.stats.attacksCd[iA] = Math.trunc((data.attacks[cls.attacks[iA]].cooldown*1000)/16)
    }
    return e
}

//ручка автотестов: состояние копилки спор без экспорта внутреннего массива
//(по прецеденту minimapDebug/bossBarNodes)
function sporeDebug() {
    return {"count": spores.length,
        "bossAlive": !!(sporeBossRef && sporeBossRef.type === "enemy" && sporeBossRef.stats.hp > 0),
        "cd": sporeCd,
        //E-16: диагностика Сгустков Циклопа (жив ли bossRef, кулдаун, число живых Сгустков)
        "bossRefType": bossRef ? bossRef.type : null,
        "blobCd": blobCd,
        "blobs": blobs.length,
        "blobSpawns": blobSpawnCount,
        "blobLastHit": blobLastHit,
        "spores": spores.map(s => ({"x": Math.round(s.tx), "y": Math.round(s.ty),
            "landed": !!s.landed, "life": s.life}))}
}

//----- тик из gameLoop (вызывается только вне паузы, как остальные системы) -----
function voidBossTick() {
    if (!bossRef || bossRef.type !== "enemy" || bossRef.stats.hp <= 0) return
    //кулдаун способности; на паузе тик не идёт — время замирает, как у всего остального
    if (--blobCd <= 0) {
        blobCd = Math.round(bossRef.class.stats.voidBlob * 1000 / 16)
        //V79: залп — один Сгусток, а в окно неуязвимости (invulnActive ставит
        //enemyAI.tickInvuln) — зеркальная пара: +180°, то же вращение
        let ang = Math.random() * Math.PI * 2
        let dir = Math.random() < 0.5 ? 1 : -1
        spawnBlob(ang, dir)
        bossRef.invulnActive && spawnBlob(ang + Math.PI, dir)
    }
    moveBlobs()
}

//V79: угол и направление вращения задаёт вызывающий (зеркальная пара в неуязвимости)
let blobSpawnCount = 0
let blobLastHit = null   //E-16 (диагностика): ролл урона последнего попавшего Сгустка
function spawnBlob(ang, dir) {
    blobSpawnCount++
    let p = rectPos(bossRef.rect)
    //точка вылета — центр rect босса (клетка = центр, как всюду в проекте)
    let cx = p[0] + bossRef.rect._w / 2
    let cy = p[1] + bossRef.rect._h / 2
    //пределы комнаты босса в px (+ размер Сгустка запаса, чтобы исчезал ЗА стеной, а не на ней)
    let rf = dataGeneric.scenes[status.levelFloor].floor[bossRef.room[0]]
    screenPic.push(worldImage(svgArr[1],
        cx - BLOB_SIZE/2,
        cy - BLOB_SIZE/2,
        BLOB_SIZE,
        BLOB_SIZE,
        BLOB_SPRITE,
        {"id":screenPic.length-1}))
    blobs.push({"img":screenPic[screenPic.length-1],
        "ox":cx, "oy":cy, "x":cx, "y":cy,
        "r":0, "ang":ang,
        "dir":dir,
        "hit":0,
        "bx1":rf[0]*32 - BLOB_SIZE, "by1":rf[1]*32 - BLOB_SIZE,
        "bx2":(rf[0]+rf[2])*32 + BLOB_SIZE, "by2":(rf[1]+rf[3])*32 + BLOB_SIZE})
}

function moveBlobs() {
    let heroObj = status.hero.obj
    for (let i = blobs.length - 1; i >= 0; i--) {
        let b = blobs[i]
        b.r += BLOB_RADIAL
        b.ang += BLOB_ROT * b.dir
        b.x = b.ox + Math.cos(b.ang) * b.r
        b.y = b.oy + Math.sin(b.ang) * b.r
        spritePos(b.img, b.x - BLOB_SIZE/2, b.y - BLOB_SIZE/2)
        //покинул пределы комнаты — исчез
        if (b.x < b.bx1 || b.x > b.bx2 || b.y < b.by1 || b.y > b.by2) {
            b.img.remove()
            blobs.splice(i,1)
            continue
        }
        //попадание в героя: один раз на Сгусток; герой-труп не бьём
        if (!b.hit && heroObj && heroObj.type === "hero") {
            let hp = rectPos(heroObj.rect)
            if (checkCollision(hp[0], b.x - BLOB_SIZE/2, heroObj.rect._w, BLOB_SIZE,
                hp[1], b.y - BLOB_SIZE/2, heroObj.rect._h, BLOB_SIZE)) {
                b.hit = 1
                //E-16 (диагностика): ролл фиксируется до takeDamage — тесты сверяют,
                //сколько Сгусток «принёс» и сколько дошло до ХП
                blobLastHit = BLOB_DMG_MIN + Math.trunc(Math.random() * BLOB_DMG_SPREAD)
                //V68: источнику (Циклопу) уходит доля «Вечного жемчуга», как от его снаряда
                takeDamage(blobLastHit, "enemy.25.name", bossRef)
                b.img.remove()
                blobs.splice(i,1)
            }
        }
    }
}

//----- смерть босса (хук из enemyAI.enemyDie): дроп → пауза на анимацию смерти → выход -----
//V85: источник — погибшая сущность (Циклоп или ПОСЛЕДНИЙ осколок Медузы): в её точке
//смерти падает дроп и появляется выход
function voidBossFinale(source) {
    if (finaleArmed) return
    finaleArmed = true
    //V91: споры Гриба при смерти босса исчезают (решение пользователя) — и лежащие,
    //и летящие; уже проросшие мини-грибы остаются
    for (let i = spores.length - 1; i >= 0; i--) spores[i].img.remove()
    spores.length = 0
    sporeBossRef = null
    //V67: этаж больше не заканчивается сразу — зависшие в воздухе Сгустки (их двигал тик,
    //который после смерти босса не идёт) убираем сразу, иначе провисут до выхода с этажа
    for (let i = blobs.length - 1; i >= 0; i--) blobs[i].img.remove()
    blobs.length = 0
    //V67 (решение пользователя): сначала с босса выпадает его дроп (распределение 70/20/10),
    //выход появится после анимации смерти
    bossDrop(source || bossRef)
    //даём доиграть анимацию смерти (~1.2с), затем в комнате появляется объект выхода.
    //Если в этом окне погиб герой (start сменился/герой труп) — выход не спавнится
    setTimeout(() => {
        status.start === 1 && status.hero.obj && status.hero.obj.type === "hero" && spawnVoidExit()
    }, 1200)
}

//V67: дроп босса 4 этажа — ОДИН предмет. Сам предмет генерируется в момент ПОДНЯТИЯ
//(takeItem 4/5) — иконки кучи стандартные.
//E-16 (решение пользователя): с босса ВСЕГДА падает реликвия (item5) — прежнее
//распределение 80/20 (V86) отменено. Исключение — пул уникальных реликвий исчерпан
//(все уже собраны, V68): тогда падает сетовый легендарный предмет (item4, itemGenerate(4)).
function bossDrop(target) {
    if (!target) return
    let drop = relicPoolLeft() ? {"w":32,"h":36,"img":"./images/dungeon/drop/item5.png"} :
        {"w":32,"h":36,"img":"./images/dungeon/drop/item4.png"}
    //падает в точке смерти (центр rect погибшей сущности)
    let p = rectPos(target.rect)
    screenPic.push(worldImage(svgArr[1],
        p[0] + target.rect._w/2 - drop.w/2,
        p[1] + target.rect._h/2 - drop.h/2,
        drop.w, drop.h, drop.img, {"id":screenPic.length-1}))
    dropArr.push(screenPic[screenPic.length-1])
    //V69: дроп в стене/пустоте невозможен — переносим на свободную клетку рядом
    placeDrop(screenPic[screenPic.length-1],p[0] + target.rect._w/2 - drop.w/2,p[1] + target.rect._h/2 - drop.h/2,drop.w,drop.h)
}

//V67: выход с 4 этажа — интерактивный объект (тип 13, bossKill уже 1 после смерти босса),
//как спуск на других этажах: 2×2 в центре комнаты у северного края ([5]-1,[6]-4).
//Спрайт 4exit.png 96×128 рисуется 1:1 с якорем НИЗА по центру логической клетки 2×2
//(та же геометрия, что ветка isExit4 в createRoom — объект добавлен ПОСЛЕ отрисовки пола,
//поэтому рисуем вручную и регистрируем в level.objects по всем правилам useObject).
function spawnVoidExit() {
    let level = dataGeneric.scenes[status.levelFloor]
    let room = level.roomsArr[0]
    let rf = level.floor[room[0]]
    let x = rf[5] - 1
    let y = rf[6] - 4
    y < rf[1] + 1 && (y = rf[1] + 1)
    level.objects.push([x, y, 13, 2, 2, undefined])
    let obj = level.objects[level.objects.length - 1]
    obj[9] = room
    screenPic.push(worldImage(svgArr[1],
        x*32 + 32 - 48,
        y*32 + 64 - 128,
        96, 128, EXIT_SPRITE, {"id":screenPic.length+"O"}))
    obj[6] = screenPic.length - 1
    //герой рисуется поверх спрайта выхода (как после createRoom в checkNewRoom)
    status.hero.obj && status.hero.obj.img && svgArr[1].append(status.hero.obj.img)
}

//----- смена сцены (del.js): ни босс, ни Сгустки не переживают этаж -----
function resetVoidBoss() {
    bossRef = null
    blobCd = 0
    blobs.length = 0
    finaleArmed = false
    //V91: споры — как Сгустки: узлы убирает разбор сцены в del.js, здесь только ссылки
    sporeBossRef = null
    sporeCd = 0
    spores.length = 0
}

export {spawnVoidBoss, voidBossTick, voidBossFinale, resetVoidBoss, medusaSplitTick, medusaPieceDied, sporeTick, sporeDebug}
