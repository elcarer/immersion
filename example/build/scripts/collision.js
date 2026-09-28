//V16: клеточный индекс стен/объектов этажа — раньше collision() сканировал ВСЕ стены
//и объекты этажа на каждый вызов (heroMove делает 8–14 вызовов за тик, рывок валькирии —
//до 6 вызовов на тик по 1px). Теперь проверяются только клетки (2×2), которые
//покрывает хитбокс героя. Индекс строится один раз на этаж, перестраивается только
//при разрушении объекта (длина objects меняется).
let indexedLevel = null
let indexedObjectsLen = -1
let wallIndex = new Map()
let objIndex = new Map()
function buildCollisionIndex(level) {
    wallIndex.clear()
    objIndex.clear()
    for (let i = 0; i < level.walls.length; i++) {
        const w = level.walls[i]
        for (let cx = w[0]; cx < w[0] + w[3]; cx++) {
            for (let cy = w[1]; cy < w[1] + w[4]; cy++) {
                const key = cy * 4096 + cx
                let b = wallIndex.get(key)
                b ? b.push(w) : wallIndex.set(key, [w])
            }
        }
    }
    for (let i = 0; i < level.objects.length; i++) {
        const o = level.objects[i]
        for (let cx = o[0]; cx < o[0] + o[3]; cx++) {
            for (let cy = o[1]; cy < o[1] + o[4]; cy++) {
                const key = cy * 4096 + cx
                let b = objIndex.get(key)
                b ? b.push(o) : objIndex.set(key, [o])
            }
        }
    }
    indexedLevel = level
    indexedObjectsLen = level.objects.length
}
function collision(x,y,level,ori) {
    let shiftX = 0
    let shiftY = 0
    ori===0&&(shiftY-=3)
    ori===1&&(shiftX+=3)
    ori===2&&(shiftY+=3)
    ori===3&&(shiftX-=3)
    if (ori===4){shiftY-=3;shiftX+=3}
    if (ori===5){shiftY-=3;shiftX-=3}
    if (ori===6){shiftY+=3;shiftX+=3}
    if (ori===7){shiftY+=3;shiftX-=3}

    if (indexedLevel !== level || indexedObjectsLen !== level.objects.length) buildCollisionIndex(level)
    //хитбокс героя 14×14 в (x+13+shiftX, y+37+shiftY) — покрывает не более 2×2 клеток
    const x1 = Math.trunc((x + 13 + shiftX) / 32)
    const x2 = Math.trunc((x + 13 + shiftX + 14 - 1) / 32)
    const y1 = Math.trunc((y + 37 + shiftY) / 32)
    const y2 = Math.trunc((y + 37 + shiftY + 14 - 1) / 32)
    for (let cy = y1; cy <= y2; cy++) {
        for (let cx = x1; cx <= x2; cx++) {
            const key = cy * 4096 + cx
            const walls = wallIndex.get(key)
            if (walls) {
                for (let i = 0; i < walls.length; i++) {
                    const w = walls[i]
                    if (collisionCheckDoors(w, x + 13 + shiftX, y + 37 + shiftY, 14, 14) && collisionCheck(x+13+shiftX,y+37+shiftY,14,14,w[0]*32,w[1]*32,w[3]*32,w[4]*32))
                    {return false}
                }
            }
            const objs = objIndex.get(key)
            if (objs) {
                for (let i = 0; i < objs.length; i++) {
                    const o = objs[i]
                    if (collisionCheckObject(o)&&collisionCheck(x+13+shiftX,y+37+shiftY,14,14,o[0]*32,o[1]*32,o[3]*32,o[4]*32))
                    {return false}
                }
            }
        }
    }
    return true
}
function collisionCheck(x1,y1,w1,h1,x2,y2,w2,h2) {
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
}
//V151: проход через дверь — только 2 ЦЕНТРАЛЬНЫЕ клетки спрайта по его длине:
//горизонтальные двери (9/12, спрайт 4×2 клетки) — проход по x (клетки 1-2 из 4),
//вертикальные (23/24, 1×4) — по y. Крайние клетки блокируются как стена.
//Возврат: true — запись блокирует (не-дверь: проверяется общим collisionCheck по
//всему rect; дверь: хитбокс задел крайнюю зону — общий check тоже вернёт пересечение).
function collisionCheckDoors(door, hx, hy, hw, hh) {
    const t = door[2]
    if (t === 9 || t === 12 || t === 23 || t === 24) {
        if (door[3] > door[4]) {
            // горизонтальная: крайние клетки по x (левая и правая), весь y
            return collisionCheck(hx,hy,hw,hh,door[0]*32,door[1]*32,32,door[4]*32) ||
                   collisionCheck(hx,hy,hw,hh,(door[0]+door[3]-1)*32,door[1]*32,32,door[4]*32)
        }
        // вертикальная: крайние клетки по y (верхняя и нижняя), весь x
        return collisionCheck(hx,hy,hw,hh,door[0]*32,door[1]*32,door[3]*32,32) ||
               collisionCheck(hx,hy,hw,hh,door[0]*32,(door[1]+door[4]-1)*32,door[3]*32,32)
    }
    return true
}
function collisionCheckObject(obj) {
    //ловушки (тип 14) проходимы — на них можно наступить (урон наносит checkTraps).
    //Рычаг (тип 19, V64a) тоже проходим: спавнится в замкнутой арене рядом с героем, и
    //перекрытие хитбокса спрайтом зажимало движение (репорт V64a). V97: чаши «напёрстков»
    //(тип 22) проходимы — они переезжают при перемешивании и могли бы зажать героя.
    //Юзу проходимость не нужна — зона взаимодействия checkObject шире клетки объекта на ±32px
    return obj[2] !== 14 && obj[2] !== 19 && obj[2] !== 22
}
//V150: записи стен/объектов, покрывающие клетки прямоугольника — для Z-сортировки
//checkZOrder (heroMove.js): против статичных стен/дверей/объектов раньше не сортировало
//вовсе. Индекс переиспользуется (тот же, что у collision), записи уникальны — одна
//стена покрывает несколько клеток прямоугольника.
//V152: результат РАЗДЕЛЬНЫЙ {walls, objs} — у стен и объектов типы в [2] пересекаются
//численно (19 — и нижняя стена, и рычаг; 22 — и левая стена, и чаша), а правила
//сортировки разные: стены сортируются все, плоские объекты (14/19/22) — не сортируются.
//Выборка берётся по ЛОГИЧЕСКИМ клеткам коллайдеров, расширенным на 2 клетки ВНИЗ и
//по 1 клетке влево/вправо: у высоких объектов спрайт торчит ВВЕРХ от логической клетки
//(столб 81px, портал 84px, выход 128px — якорь низа в клетку), и сущность «за» объектом
//стоит в клетках его СПРАЙТА, но не логики. Пересечение потом проверяется точно — по
//спрайтам в checkZOrder, лишние записи отсеиваются.
function zNear(level, x, y, w, h) {
    if (indexedLevel !== level || indexedObjectsLen !== level.objects.length) buildCollisionIndex(level)
    const x1 = Math.trunc((x - 32) / 32)
    const x2 = Math.trunc((x + w - 1 + 32) / 32)
    const y1 = Math.trunc(y / 32)
    const y2 = Math.trunc((y + h - 1 + 64) / 32)
    const outWalls = []
    const outObjs = []
    const seenW = new Set()
    const seenO = new Set()
    for (let cy = y1; cy <= y2; cy++) {
        for (let cx = x1; cx <= x2; cx++) {
            const key = cy * 4096 + cx
            const walls = wallIndex.get(key)
            if (walls) {
                for (let i = 0; i < walls.length; i++) {
                    const rec = walls[i]
                    if (!seenW.has(rec)) { seenW.add(rec); outWalls.push(rec) }
                }
            }
            const objs = objIndex.get(key)
            if (objs) {
                for (let i = 0; i < objs.length; i++) {
                    const rec = objs[i]
                    if (!seenO.has(rec)) { seenO.add(rec); outObjs.push(rec) }
                }
            }
        }
    }
    return {walls: outWalls, objs: outObjs}
}
export {collision, zNear}
