//V69: дроп не должен застревать в недоступных клетках. Спрайты дропа (ключи элит, еда
//«Волшебницы», золото сетов, дроп босса 4 этажа, лут из бочек/дверей) ставятся со смещением
//вниз от точки смерти/объекта — у нижней стены комнаты спрайт оказывался в стене, откуда
//его нельзя взять. placeDrop проверяет клетку ПОД ЦЕНТРОМ спрайта дропа по status.matrixLevel
//(1 = проходимый пол) и при промахе переносит спрайт на ближайшую свободную клетку: сначала
//на 1 вверх (пример пользователя), затем вбок/по диагоналям, в крайнем случае на 2 клетки.
//Координаты клеток — [колонка, строка] = пиксель/32; матрица после транспонирования в
//sceneGenerate.createMatrix индексируется [строка][колонка]. Дверные клетки (типы 9/12/23/24)
//в матрице остаются «полом» — дроп на двери подобрать можно.
//V90: «свободная» клетка — это ещё и клетка БЕЗ блокирующих объектов (репорт: ключ элиты
//переехал на клетку вверх и оказался внутри интерактивного объекта — взять его нельзя).
//Проходимые для персонажа объекты — тот же список, что в collision.collisionCheckObject:
//ловушки (тип 14) и рычаг (тип 19) клетку не блокируют, любой другой объект — блокирует.
import { status } from "../scripts/start.js"
import { moveSprite,spritePos } from "../scripts/svg.js"
import { dataGeneric } from "../scripts/sceneGenerate.js"
//V103: полёт кучки заканчивается постановкой в dropArr (подбор возможен только после
//приземления); dropArr живёт в useObject.js — цикл импортов useObject ↔ dropSafe,
//все использования в рантайме (проектная практика)
import { dropArr } from "../scripts/useObject.js"

//порядок обхода соседних клеток: вверх приоритетен (решение пользователя), затем стороны
//и верхние диагонали, потом нижние; хвост — клетки на расстоянии 2 как последний шанс
const OFFSETS = [
    [0,-1],[-1,0],[1,0],[-1,-1],[1,-1],[0,1],[-1,1],[1,1],
    [0,-2],[-1,-2],[1,-2],[-2,0],[2,0],[-2,-1],[2,-1]
]

//клетка свободна: пол по матрице (1 = проходимый) И ни одного блокирующего объекта
//(все типы, кроме проходимых ловушек 14, рычага 19 и чаш «напёрстков» 22 — как
//collisionCheckObject)
function cellFree(col,row) {
    const m = status.matrixLevel
    if (!(m && m[row] && m[row][col] === 1)) return false
    const scene = dataGeneric.scenes[status.levelFloor]
    const objects = scene && scene.objects
    if (!objects) return true
    for (let i = 0; i < objects.length; i++) {
        const ob = objects[i]
        if (ob[2] !== 14 && ob[2] !== 19 && ob[2] !== 22 && col >= ob[0] && col < ob[0] + ob[3] && row >= ob[1] && row < ob[1] + ob[4]) return false
    }
    return true
}

//выбор свободной клетки по рецепту placeDrop (вверх приоритетен, затем стороны/диагонали,
//хвост — расстояние 2). Возвращает [колонка, строка]: исходная клетка свободна — её же;
//иначе первую свободную соседнюю; свободных нет рядом — исходную (хуже не сделаем).
//V90: используется и для спавна крысы/мумии из объекта (encounters.js) — раньше они
//появлялись на клетке obj[1]+2 даже если это стена
function freeDropCell(col,row) {
    if (cellFree(col,row)) return [col,row]
    for (let i = 0; i < OFFSETS.length; i++) {
        const nc = col + OFFSETS[i][0]
        const nr = row + OFFSETS[i][1]
        if (cellFree(nc,nr)) return [nc,nr]
    }
    return [col,row]
}

//img — уже созданный спрайт дропа; x/y/w/h — его исходная геометрия. Если центр спрайта
//попал на несвободную клетку (стена, пустота или блокирующий объект), спрайт сдвигается
//moveSprite'ом в центр первой свободной соседней клетки
function placeDrop(img,x,y,w,h) {
    const col = Math.trunc((x + w/2)/32)
    const row = Math.trunc((y + h/2)/32)
    const cell = freeDropCell(col,row)
    if (cell[0] !== col || cell[1] !== row) {
        moveSprite(img, cell[0]*32 + 16 - w/2 - x, cell[1]*32 + 16 - h/2 - y)
    }
}

//------ V103: полёт кучки по параболе (решение пользователя) ------
//При появлении дроп не сразу лежит в точке спавна: сначала он в ЦЕНТРЕ спрайта-источника
//(враг, сундук, герой…), затем по параболе летит к точке приземления. В dropArr кучка
//попадает только по приземлении — takeDrop/encounters ходят по dropArr, летящую
//подобрать/съесть нельзя. Паттерн полёта — тот же, что у спор Гриба пустоты
//(voidBoss.moveSpores): сближение по прямой + «высота» 4·arc·k·(1−k); тик раз в игровой
//цикл (gameLoop → dropFlyTick), на паузе время замирает, как у всего остального.
//Смена сцены — del() зовёт resetFlyDrops вместе с dropArr.length = 0.
const DROP_FLY_TICKS = 24  //полёт ~0.4с
const DROP_ARC = 40        //базовая высота дуги, px (у каждой кучки свой случайный размах)
let flyDrops = []          // {img, sx, sy, tx, ty, t, fly, arc}

//el — уже созданный спрайт кучки в ТОЧКЕ ПРИЗЕМЛЕНИЯ (после placeDrop); cx,cy — центр
//спрайта-источника. Спрайт переносится в (cx,cy) и летит к точке приземления. Источник
//совпал с приземлением (сундук под собой, дроп босса в центре босса) — кучка просто
//подпрыгивает на месте по той же дуге.
function dropFly(el, cx, cy) {
    let w = parseInt(el.getAttribute("width"))
    let h = parseInt(el.getAttribute("height"))
    let tx = el.x.animVal.value
    let ty = el.y.animVal.value
    spritePos(el, cx - w/2, cy - h/2)
    flyDrops.push({"img":el,"sx":cx - w/2,"sy":cy - h/2,"tx":tx,"ty":ty,
        "t":0,"fly":DROP_FLY_TICKS,"arc":DROP_ARC * (0.7 + Math.random() * 0.6)})
}

function dropFlyTick() {
    for (let i = flyDrops.length - 1; i >= 0; i--) {
        let f = flyDrops[i]
        f.t++
        let k = f.t / f.fly
        let lift = 4 * f.arc * k * (1 - k)
        spritePos(f.img, f.sx + (f.tx - f.sx) * k, f.sy + (f.ty - f.sy) * k - lift)
        if (f.t >= f.fly) {
            spritePos(f.img, f.tx, f.ty)
            dropArr.push(f.img)
            flyDrops.splice(i, 1)
        }
    }
}

function resetFlyDrops() {
    flyDrops.length = 0
}

export { placeDrop, freeDropCell, dropFly, dropFlyTick, resetFlyDrops }
