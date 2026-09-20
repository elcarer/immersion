import { worldImage, nativeGraphics, rectPos } from "../scripts/svg.js"
import { status } from "../scripts/start.js"
//V63: спрайт ловушки по её состоянию (Ne.png/N.png) — та же формула, что в createRoom
import { trapSpriteSrc } from "../scripts/trapSprite.js"
//V64: спрайт Портала (18) и Рычага (19) по состоянию — та же формула, что в createRoom
import { portalSpriteSrc, cupSpriteSrc } from "../scripts/portalSprite.js"

// V62: отрисовка содержимого БОЛЬШОЙ КАРТЫ (панель «Карта», map.js) — вынесена из
// sceneGenerate.js (map-ветка createRoom) и heroMove.js (map-ветка createCorridor).
// Открытая комната — прямоугольник, открытый коридор — несколько прямоугольников по
// числу прямых сегментов, стены открытых зон — тёмные прямоугольники, двери — светлые
// пятна под цвет пола, объекты и герой — спрайты. Туман войны — только по флагам игры.
//
// R4: панель рисуется НАТИВНО — все прямоугольники одним PIXI.Graphics (4 заливки),
// объекты и герой — нативные спрайты (worldImage). Никаких шим-узлов: return — хэндлы
// с remove() (map.js держит их в mapTemp и снимает при закрытии панели).
//
// Заливка — коричнево-серый #8a7458, ТОТ ЖЕ цвет, что у прогонов мини-карты
// (MM_RUN_FILL в minimapFx.js; решение пользователя после ручной проверки V62 —
// светло-серый rgb(185,182,174)/0.7 забракован). Непрозрачная НАМЕРЕННО: rect разных
// пар коридоров могут перекрываться клетками — прозрачность давала бы тёмные пятна
// двойной заливки в местах пересечения. Стены #6e5d46 (чуть темнее, решение юзера).
// Двери (9/12/23/24) — светлые пятна под цвет пола в тёмной полосе стен.

const MAP_FILL = "#8a7458"
const WALL_FILL = "#6e5d46"
const DOOR_TYPES = [9, 12, 23, 24]
//иконка героя: doll-иконка класса
const HERO_ICONS = ["./images/UI/doll/rogue.png","./images/UI/doll/sorceress.png","./images/UI/doll/knight.png","./images/UI/doll/valciria.png"]

//строит содержимое карты на слое layer (svgArr[2]), возвращает хэндлы —
//их регистрирует у себя mapTemp (map.js) для закрытия панели
function mapRender(level, tileX, tileY, layer) {
    const nodes = []
    //слой прячем на время сборки — контент появляется одним куском
    layer.style.display = "none"
    try {
        //все прямоугольники карты — ОДИН Graphics (R4)
        const g = nativeGraphics(layer)
        nodes.push(g)
        const fill = (x, y, w, h, color) => g.node.rect(x, y, w, h).fill(color)
        //1. комнаты: один прямоугольник на ОТКРЫТУЮ комнату (флаг roomsArr[k][3]===1)
        const openRooms = []
        for (let k = 0; k < level.roomsArr.length; k++) {
            if (level.roomsArr[k][3] !== 1) continue
            const f = level.floor[level.roomsArr[k][0]]
            openRooms.push({"fx": f[0], "fy": f[1], "fw": f[2], "fh": f[3]})
            fill(f[0]*tileX, f[1]*tileY, f[2]*tileX, f[3]*tileY, MAP_FILL)
        }
        //2. коридоры: ОТКРЫТЫЕ ([7]===1) клетки группируются по коридору ([5]/[6] —
        //пара комнат из генератора) и раскладываются на прямые сегменты-прямоугольники
        const pairs = new Map()
        const corrCells = new Set() // "x,y" открытых клеток коридоров — для отбора стен
        for (let i = 0; i < level.floor.length; i++) {
            const c = level.floor[i]
            if (c[2] !== 1 || c[7] !== 1) continue
            corrCells.add(c[0] + "," + c[1])
            const key = c[5] + "_" + c[6]
            let group = pairs.get(key)
            if (!group) { group = []; pairs.set(key, group) }
            group.push(c)
        }
        pairs.forEach(group => {
            cellRects(group).forEach(r => {
                fill(r[0]*tileX, r[1]*tileY, r[2]*tileX, r[3]*tileY, MAP_FILL)
            })
        })
        //3. стены ОТКРЫТЫХ зон — прямоугольниками. Отбор записей walls — как в старой
        //map-ветке: владелец [5] — открытая комната или открытая клетка коридора, ЛИБО
        //координаты в открытой зоне (комнаты берутся с рядом fy-1 над верхом — часть
        //записей стен/дверей стоит на [y-1]). Клетки стен сливаются в максимальные
        //прямоугольники: длинная стена комнаты — один прямоугольник
        const wallOwners = new Set() // floor-индексы открытых комнат и открытых клеток коридоров
        for (let k = 0; k < level.roomsArr.length; k++) {
            level.roomsArr[k][3] === 1 && wallOwners.add(level.roomsArr[k][0])
        }
        for (let i = 0; i < level.floor.length; i++) {
            const c = level.floor[i]
            c[2] === 1 && c[7] === 1 && wallOwners.add(i)
        }
        //клетки открытых зон (быстрый отбор стен по координатам вместо перебора комнат)
        const openCells = new Set()
        for (let r = 0; r < openRooms.length; r++) {
            const room = openRooms[r]
            for (let y = room.fy - 1; y <= room.fy + room.fh; y++)
                for (let x = room.fx; x < room.fx + room.fw; x++) openCells.add(x + "," + y)
        }
        const wallRecs = []
        const doorRecs = []
        for (let i = 0; i < level.walls.length; i++) {
            const w = level.walls[i]
            const take = wallOwners.has(w[5]) || corrCells.has(w[0] + "," + w[1]) || openCells.has(w[0] + "," + w[1])
            if (!take) continue
            ;(DOOR_TYPES.indexOf(w[2]) !== -1 ? doorRecs : wallRecs).push(w)
        }
        cellRects(expandSpans(wallRecs)).forEach(r => {
            fill(r[0]*tileX, r[1]*tileY, r[2]*tileX, r[3]*tileY, WALL_FILL)
        })
        //двери — СВЕТЛЫЕ пятна под цвет пола ПОВЕРХ тёмной полосы: игрок видит проход;
        //рисуются после стен, спрайты дверей на карте не рисуются
        cellRects(expandSpans(doorRecs)).forEach(r => {
            fill(r[0]*tileX, r[1]*tileY, r[2]*tileX, r[3]*tileY, MAP_FILL)
        })
        //4. объекты ОТКРЫТЫХ комнат — нативными спрайтами. Геометрия и спец-кейсы —
        //копия ветки объектов createRoom (sceneGenerate.js): ловушка из traps/, столб
        //32×81 с якорем низа в клетку, статуя натуральной высоты (65/69/48) с якорем
        //низа в 2 клетки, алхимический стол 15+этаж*20, шкафчик (V75) 101|101d 64×42;
            //V83: кнопка загадки (21) — push0/push1 по фазе, там же портал вида 2 (100a);
            //V97: чаша «напёрстков» (22) — goldFull/goldEmpty по полноте (cupSpriteSrc)
            for (let i = 0; i < level.objects.length; i++) {
                const o = level.objects[i]
                let inRoom = false
                for (let r = 0; r < openRooms.length; r++) {
                    const room = openRooms[r]
                    if (o[0] >= room.fx && o[0] < room.fx + room.fw && o[1] >= room.fy && o[1] <= room.fy + room.fh) {
                        inRoom = true
                        break
                    }
                }
                if (!inRoom) continue
                const objSrc = o[2] === 14 ? trapSpriteSrc(o) :
                    o[2] === 18 || o[2] === 19 || o[2] === 21 ? portalSpriteSrc(o) :
                    o[2] === 22 ? cupSpriteSrc(o) :
                    o[2] === 15 ? "./images/dungeon/objects/fin"+(o[10]||1)+".png" :
                o[2] === 16 ? "./images/dungeon/objects/"+(14+status.levelFloor*20)+".png" :
                o[2] === 17 ? "./images/dungeon/objects/"+(15+status.levelFloor*20)+".png" :
                o[2] === 20 ? "./images/dungeon/objects/"+(o[7] ? "101d" : "101")+".png" :
                    "./images/dungeon/objects/"+(o[2]+status.levelFloor*20)+".png"
            const isPillar = o[2] === 15
            const isStatue = o[2] === 16
            //V64: портал (18) — 1:1 64×84 с якорем низа, центр по клетке (как в createRoom);
            //рычаг (19) — 1:1 32×32 на клетку
            const isPortal = o[2] === 18
            const isLever = o[2] === 19
            //V75: шкафчик (20) — 1:1 64×42 с якорем низа, центр по клетке
            const isAncient = o[2] === 20
            const statueH = isStatue ? [65,69,48][status.levelFloor] : 0
            nodes.push(worldImage(layer,
                isPortal ? o[0]*tileX + tileX/2 - 32 :
                isAncient ? o[0]*tileX + tileX/2 - 32 : o[0]*tileX,
                isPillar ? o[1]*tileY + tileY - 81 :
                    isPortal ? o[1]*tileY + tileY - 84 :
                    isAncient ? o[1]*tileY + tileY - 42 :
                    isStatue ? o[1]*tileY + 2*tileY - statueH : o[1]*tileY,
                isPillar ? 32 : isPortal ? 64 : isLever ? 32 : isStatue ? 32 : isAncient ? 64 : o[3]*tileX,
                isPillar ? 81 : isPortal ? 84 : isLever ? 32 : isStatue ? statueH : isAncient ? 42 : o[4]*tileY,
                objSrc))
        }
        //5. иконка героя — doll-иконка класса с золотым свечением, позиция из мировых
        //координат героя (hero.x/y в px, тайл поля 32px); свечение — style drop-shadow,
        //нативный хэндл ведёт его той же glow-запекалкой (duck-typing)
        const heroIcon = worldImage(layer,
            (tileX/32)*status.hero.x,
            (tileY/32)*status.hero.y,
            20, 32, HERO_ICONS[status.hero.class])
        heroIcon.setAttribute("style", "filter: drop-shadow(0 0 8px rgba(255, 255, 204, 1))")
        nodes.push(heroIcon)
        //V113: убегающий Огнементаль квеста «Погоня за пламенем» — маркер на карте,
        //пока идёт погоня (state 2, npc жив) — wait-кадр листа + оранжевое свечение
        //(координаты — мировые px спрайта NPC, как у героя)
        const fq = status.questFlame
        if (fq && fq.state === 2 && fq.npc && fq.npc.stats.hp > 0) {
            const fp = rectPos(fq.npc.rect)
            const flameIcon = worldImage(layer,
                (tileX/32)*fp[0],
                (tileY/32)*fp[1],
                20, 30, "./images/UI/map/elemental.png")
            flameIcon.setAttribute("style", "filter: drop-shadow(0 0 8px rgba(255, 150, 60, 1))")
            nodes.push(flameIcon)
        }
    } finally {
        layer.style.display = ""
    }
    return nodes
}
//разворачивает записи стен/дверей в клетки ПОЛНОГО размера [3]×[4] — тёмная полоса стен
//и светлые пятна дверей повторяют фактические габариты спрайтов поля
//(многоклеточные записи: углы 1×3, стыки 1×2, двери 4×2)
function expandSpans(recs) {
    const cells = []
    for (let i = 0; i < recs.length; i++) {
        const w = recs[i]
        for (let dy = 0; dy < w[4]; dy++)
            for (let dx = 0; dx < w[3]; dx++) cells.push([w[0]+dx, w[1]+dy])
    }
    return cells
}
//жадное разложение клеток (записи с [0]=x, [1]=y: клетки коридоров И записи стен) на
//максимальные прямоугольники: горизонтальный прогон любой строки расширяется вниз, пока
//нижние строки покрывают его диапазон ЦЕЛИКОМ. Толстые коридоры (3-4 клетки) схлопываются
//в один прямоугольник на прямой сегмент, каждый изгиб добавляет свой; длинные стены комнат
//становятся одним прямоугольником
function cellRects(cells) {
    const live = new Set()
    for (let i = 0; i < cells.length; i++) live.add(cells[i][0] + "," + cells[i][1])
    const rects = []
    while (live.size > 0) {
        const start = live.values().next().value.split(",")
        const y = +start[1]
        let x0 = +start[0]
        let x1 = x0
        live.delete(x0 + "," + y)
        while (live.has((x0-1) + "," + y)) { x0--; live.delete(x0 + "," + y) }
        while (live.has((x1+1) + "," + y)) { x1++; live.delete(x1 + "," + y) }
        let h = 1
        for (;;) {
            let full = true
            for (let x = x0; x <= x1; x++) {
                if (!live.has(x + "," + (y+h))) { full = false; break }
            }
            if (!full) break
            for (let x = x0; x <= x1; x++) live.delete(x + "," + (y+h))
            h++
        }
        rects.push([x0, y, x1 - x0 + 1, h])
    }
    return rects
}
export { mapRender }
