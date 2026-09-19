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
                    if (collisionCheckDoors(w)&&collisionCheck(x+13+shiftX,y+37+shiftY,14,14,w[0]*32,w[1]*32,w[3]*32,w[4]*32))
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
function collisionCheckDoors(door) {
    return !(door[2]===9||door[2]===12||door[2]===23||door[2]===24)
}
function collisionCheckObject(obj) {
    //ловушки (тип 14) проходимы — на них можно наступить (урон наносит checkTraps).
    //Рычаг (тип 19, V64a) тоже проходим: спавнится в замкнутой арене рядом с героем, и
    //перекрытие хитбокса спрайтом зажимало движение (репорт V64a). V97: чаши «напёрстков»
    //(тип 22) проходимы — они переезжают при перемешивании и могли бы зажать героя.
    //Юзу проходимость не нужна — зона взаимодействия checkObject шире клетки объекта на ±32px
    return obj[2] !== 14 && obj[2] !== 19 && obj[2] !== 22
}
export {collision}
