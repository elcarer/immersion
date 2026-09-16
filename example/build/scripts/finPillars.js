// V43 — сценарий босса 3 этажа: столбы призыва и «Демон» (data.js группа 15, id 18).
// Фаза 1: при генерации этажа 3 в 4 случайных комнатах (кроме стартовой) на свободной
// клетке ставится столб (объект типа 15) в случайном состоянии 1 (fin1.png) или 2
// (fin2.png). Столб — обычный интерактивный объект (юз-бар по близости), но в отличие
// от остальных его можно переключать сколько угодно раз: после переключения столб
// «перезаряжается», пока герой не выйдет из зоны взаимодействия (obj[11]).
// Призыв возможен при ДВУХ условиях: (1) все 4 столба находятся в ОТКРЫТЫХ комнатах
// (их комнаты найдены героем — roomsArr[3]===1) и (2) все столбы стоят в состоянии 2
// (неважно — сами от генерации или после переключения игроком).
// Тогда — эффект над героем (effects/14.png), звук (rocket)
// и волна: 30 случайных врагов пула 3 этажа (кроме босса) + сам «Демон» в самой
// большой ОТКРЫТОЙ на текущий момент комнате. Один раз за этаж (status.info.finSummoned).
// Фаза 2: способность босса «summoning»: N (секунды) — получив урон, но не чаще раза
// в N секунд, Демон призывает в случайной точке в радиусе 6 клеток случайного монстра
// своего этажа (тот же пул, кроме босса). Хуки — в damage.js (countDamage/createSplash).
// При каждом призыве под клеткой появления на ~1 с ложится круг призыва effects/penta.png
// (64×51) — позади спрайта призванного врага (эффект создаётся раньше врага).
import { status } from "../scripts/start.js"
import { data } from "../scripts/data.js"
import { dataGeneric } from "../scripts/sceneGenerate.js"
import { svgArr, image, rectPos } from "../scripts/svg.js"
import { screenPic, objectValues } from "../scripts/del.js"
import { hpBar } from "../scripts/hpBar.js"
import { playback, strike } from "../scripts/sound.js"
import { playEffect } from "../scripts/damage.js"

//тип объекта-столба в level.objects (спрайт — спец-кейс в createRoom, формула type+40 не применяется)
const FIN_TYPE = 15
//нативный размер спрайта fin1/fin2.png — рисуется 1:1, низ якорится в клетку объекта
const FIN_SPRITE_W = 32
const FIN_SPRITE_H = 81
//пул случайных врагов 3 этажа (кроме босса): [индекс группы в data.enemes, вариант].
//Имп(12), Нетопырь(13), Суккуб(14.0)/Хаунд(14.1), Змей(16)
const FIN_POOL = [[12,0],[13,0],[14,0],[14,1],[16,0]]
//волна призыва: 30 врагов + 1 босс
const FIN_WAVE = 12
//радиус призыва Демона, клетки (расстояние по прямой)
const FIN_SUMMON_RADIUS = 6

//----- генерация: 4 столба в 4 разных комнатах, кроме стартовой -----
function configFinPillars(level) {
    let rooms = level.roomsArr
    if (!rooms || rooms.length < 5) return
    let idxs = []
    for (let i = 1; i < rooms.length; i++) idxs.push(i)
    idxs.sort(() => Math.random() - 0.5)
    let placed = 0
    for (let k = 0; k < idxs.length && placed < 4; k++) {
        let room = rooms[idxs[k]]
        if (tryPlacePillar(level, level.floor[room[0]], room)) placed++
    }
}
function tryPlacePillar(level, rf, room) {
    for (let attempt = 0; attempt < 50; attempt++) {
        let x = rf[0] + 1 + Math.trunc(Math.random() * (rf[2] - 2))
        let y = rf[1] + 1 + Math.trunc(Math.random() * (rf[3] - 2))
        if (finCellBusy(level, x, y)) continue
        level.objects.push([x, y, FIN_TYPE, 1, 1, undefined])
        let obj = level.objects[level.objects.length - 1]
        obj[9] = room
        //случайное состояние: 1 — выключен (fin1), 2 — активирован (fin2)
        obj[10] = Math.random() < 0.5 ? 1 : 2
        return true
    }
    return false
}
function finCellBusy(level, x, y) {
    for (let i = 0; i < level.objects.length; i++) {
        let o = level.objects[i]
        if (x >= o[0] && x < o[0] + o[3] && y >= o[1] && y < o[1] + o[4]) return true
    }
    for (let i = 0; i < level.walls.length; i++) {
        let w = level.walls[i]
        if (x >= w[0] && x < w[0] + w[3] && y >= w[1] && y < w[1] + w[4]) return true
    }
    return x === level.hero[0] && y === level.hero[1]
}

//----- переключение столба (вызывается из useObject.finishUsedObject) -----
function finPillarToggle(obj) {
    obj[10] = obj[10] === 2 ? 1 : 2
    //V55: f && — «надгробия» (null) в screenPic вместо удалённых спрайтов
    let img = screenPic.find(f => f && f.id === obj[6] + "OI")
    img && img.setAttribute("href", "./images/dungeon/objects/fin" + obj[10] + ".png")
    return obj[10]
}
//готовность призыва: (1) каждый столб лежит в ОТКРЫТОЙ комнате (obj[9]=roomsArr-запись,
//[3]===1 — флаг открытости, ставит checkNewRoom при входе героя) И (2) стоит в состоянии 2
//(состояние 2 от генерации и от переключения игроком равнозначны)
function finPillarsReady() {
    let level = dataGeneric.scenes[status.levelFloor]
    let pillars = 0
    for (let i = 0; i < level.objects.length; i++) {
        let obj = level.objects[i]
        if (obj[2] !== FIN_TYPE) continue
        pillars++
        if (!(obj[9] && obj[9][3] === 1)) return false
        if (obj[10] !== 2) return false
    }
    return pillars > 0
}

//попытка призыва босса: оба условия (все 4 столба в открытых комнатах И все в состоянии 2)
//и волна ещё не выходила → звук (rocket), эффект над героем, волна. Вызывается из ДВУХ мест:
//useObject (после переключения столба) и heroMove.checkNewRoom (после открытия комнаты —
//все столбы могли взойти в состоянии 2 сами, и последнее событие — именно открытие комнаты).
function tryFinSummon() {
    if (status.info.finSummoned === 1 || !finPillarsReady()) return false
    status.info.finSummoned = 1
    playback(strike[12].vol,0,0,3*status.settings.soundVolume)
    playEffect(status.hero.obj, data.effects[14])
    finSummonWave()
    return true
}

//----- волна: 30 случайных врагов пула + Демон в самой большой открытой комнате -----
function finSummonWave() {
    let level = dataGeneric.scenes[status.levelFloor]
    let best = null
    let bestArea = -1
    for (let i = 0; i < level.roomsArr.length; i++) {
        let room = level.roomsArr[i]
        //V64: комнаты-арены портала (room[4]=1, portalFx.js) волной призыва не становятся
        if (room[3] !== 1 || room[4] === 1) continue
        let f = level.floor[room[0]]
        let area = f[2] * f[3]
        if (area > bestArea) { bestArea = area; best = room }
    }
    if (!best) return 0
    let cells = finFreeCells(level.floor[best[0]])
    let spawned = 0
    //босс первым — гарантированная клетка в выбранной комнате
    if (cells.length > 0) {
        spawnFinEnemy(15, 0, cells.shift(), cells, best)
        spawned++
    }
    while (spawned < FIN_WAVE + 1 && cells.length > 0) {
        let pick = FIN_POOL[Math.trunc(Math.random() * FIN_POOL.length)]
        spawnFinEnemy(pick[0], pick[1], cells.shift(), cells, best)
        spawned++
    }
    return spawned
}

//свободные клетки комнаты (случайный порядок): проходимый пол, без объектов,
//без живых врагов и не клетка героя
function finFreeCells(rf) {
    let level = dataGeneric.scenes[status.levelFloor]
    let matrix = status.matrixLevel
    let used = new Set()
    for (let i = 0; i < objectValues.length; i++) {
        let o = objectValues[i]
        if (o.type !== "enemy") continue
        let p = rectPos(o.rect)
        used.add(Math.trunc((p[0] + 16) / 32) * 10000 + Math.trunc((p[1] + 25) / 32))
    }
    used.add(Math.trunc((status.hero.x + 16) / 32) * 10000 + Math.trunc((status.hero.y + 25) / 32))
    let cells = []
    for (let cx = rf[0]; cx < rf[0] + rf[2]; cx++) {
        for (let cy = rf[1]; cy < rf[1] + rf[3]; cy++) {
            if (used.has(cx * 10000 + cy)) continue
            if (!(matrix[cy] && matrix[cy][cx] === 1)) continue
            let busy = false
            for (let i = 0; i < level.objects.length; i++) {
                let o = level.objects[i]
                if (cx >= o[0] && cx < o[0] + o[3] && cy >= o[1] && cy < o[1] + o[4]) { busy = true; break }
            }
            if (!busy) cells.push([cx, cy])
        }
    }
    cells.sort(() => Math.random() - 0.5)
    return cells
}

//----- спавн врага 3 этажа (конвейер openRoom: множители главы, атаки, hpBar боссу) -----
function spawnFinEnemy(groupIdx, variantIdx, cell, cells, room) {
    let enemy1 = data.enemes[groupIdx][variantIdx]
    let stats = JSON.parse(JSON.stringify(enemy1.stats))
    if (status.levelFloor === 0 && status.meta.page > 1) {
        stats.hp *= 2
        stats.dmg[0] += 1
        stats.dmg[1] += 2
    }
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
    let e = {"id":status.oVcount,"type":"enemy","class":enemy1,"stats":stats,"animCounters":60/enemy1.anims[2].others[2].speed,"currentAnim":enemy1.anims[2].others[2],"currentStill":0,"room":room,"cells":cells,"state":Math.trunc(Math.random()*3),"stop":0,"xCell":cell[0],"yCell":cell[1],"noStunTime":0,
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
    return e
}

//----- эффект призыва: круг penta.png на полу под призванным врагом, ~1 с -----
//Однокадровый спрайт: times:1/speed:1 → снятие через 60 тиков (~1 с); frame не ставим —
//иначе окно кадра уезжает за пределы картинки (см. урок valkyrie.js про frame:1).
//Спрайт создаётся ДО спавна врага → в DOM ложится ниже и рисуется ПОЗАДИ его спрайта;
//к врагу не привязан — статичная картинка на клетке призыва (центр по клетке).
const PENTA_FX = {"img":"./images/effects/penta.png","once":1,"times":1,"speed":1,"w":64,"h":51}
function finPentaFx(cell) {
    objectValues.push({"id":status.oVcount,"type":"effect","animCounters":60/PENTA_FX.speed,"currentAnim":PENTA_FX,"currentStill":0,"targets":[],
    "img":image(svgArr[1],
        Math.round(cell[0]*32+16-PENTA_FX.w/2),
        Math.round(cell[1]*32+16-PENTA_FX.h/2),
        PENTA_FX.w,
        PENTA_FX.h,
        PENTA_FX.img,
        {"times":PENTA_FX.times,"id":status.oVcount})})
    status.oVcount++
    objectValues[objectValues.length-1].rect = objectValues[objectValues.length-1].img.clipRect
    objectValues[objectValues.length-1].effectImg = PENTA_FX.img
}

//----- способность босса «summoning»: N — призыв не чаще раза в N секунд -----
//вызывается из damage.js (countDamage/createSplash) ПОСЛЕ вычета урона.
//Кулдаун тратится только при УСПЕШном призыве (нет клетки — ждём следующего урона).
function tryBossSummon(enemy) {
    if (!enemy || enemy.type !== "enemy" || enemy.stats.hp <= 0) return false
    let period = enemy.class.stats.summoning
    if (!period) return false
    let cd = Math.round(period * 1000 / 16)
    if (status.time < (enemy.summonReady || 0)) return false
    let p = rectPos(enemy.rect)
    let bx = Math.trunc((p[0] + 16) / 32)
    let by = Math.trunc((p[1] + 25) / 32)
    let matrix = status.matrixLevel
    let level = dataGeneric.scenes[status.levelFloor]
    let used = new Set()
    for (let i = 0; i < objectValues.length; i++) {
        let o = objectValues[i]
        if (o.type !== "enemy") continue
        let op = rectPos(o.rect)
        used.add(Math.trunc((op[0] + 16) / 32) * 10000 + Math.trunc((op[1] + 25) / 32))
    }
    used.add(Math.trunc((status.hero.x + 16) / 32) * 10000 + Math.trunc((status.hero.y + 25) / 32))
    let found = null
    let extra = []
    for (let tries = 0; tries < 60; tries++) {
        let dx = Math.trunc(Math.random() * (FIN_SUMMON_RADIUS * 2 + 1)) - FIN_SUMMON_RADIUS
        let dy = Math.trunc(Math.random() * (FIN_SUMMON_RADIUS * 2 + 1)) - FIN_SUMMON_RADIUS
        if (dx * dx + dy * dy > FIN_SUMMON_RADIUS * FIN_SUMMON_RADIUS) continue
        let cx = bx + dx
        let cy = by + dy
        let key = cx * 10000 + cy
        if (used.has(key)) continue
        if (!(matrix[cy] && matrix[cy][cx] === 1)) continue
        let busy = false
        for (let i = 0; i < level.objects.length; i++) {
            let o = level.objects[i]
            if (cx >= o[0] && cx < o[0] + o[3] && cy >= o[1] && cy < o[1] + o[4]) { busy = true; break }
        }
        if (busy) continue
        used.add(key)
        if (!found) found = [cx, cy]
        else if (extra.length < 16) extra.push([cx, cy])
    }
    if (!found) return false
    enemy.summonReady = status.time + cd
    finPentaFx(found)
    let pick = FIN_POOL[Math.trunc(Math.random() * FIN_POOL.length)]
    spawnFinEnemy(pick[0], pick[1], found, [found].concat(extra), enemy.room)
    return true
}

export {configFinPillars, finPillarToggle, finPillarsReady, finSummonWave, tryFinSummon, tryBossSummon, FIN_TYPE, FIN_SPRITE_W, FIN_SPRITE_H, FIN_POOL, FIN_WAVE, FIN_SUMMON_RADIUS}
