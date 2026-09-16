import { status } from "../scripts/start.js"
import { svgArr,image } from "../scripts/svg.js"
import { objectValues } from "../scripts/del.js"
import { data } from "../scripts/data.js"
import { dataGeneric } from "../scripts/sceneGenerate.js"
import { checkCollision,playEffect } from "../scripts/damage.js"
import { dropArr } from "../scripts/useObject.js"
//V52: достижение «Гамельский крысолов» (ручной зверёк, съевший еду)
import { achTame } from "../scripts/achievements.js"
//V90: спавн крысы/мумии из объекта — клетка obj[1]+2 могла быть стеной; берём ближайшую
//свободную (пол матрицы без блокирующих объектов) тем же поиском, что у дропа (dropSafe.js)
import { freeDropCell } from "../scripts/dropSafe.js"

function encounters(obj) {
    obj[2] === 11 ? createMummy(obj) : createRat(obj)
}
function createMummy(obj) {
    //V90: клетка спавна [obj[0], obj[1]+2] могла оказаться стеной (объект недалеко от
    //нижней стены комнаты — мумия спавнилась В стене). Ближайшая свободная клетка.
    const spawn = freeDropCell(obj[0],obj[1]+2)
    let type = 4 + 6*status.levelFloor
    let stats = JSON.parse(JSON.stringify(data.enemes[type][0].stats))
    if(status.meta.page > 2) {
        stats.hp *= 2
        stats.dmg[0] += 2
        stats.dmg[1] += 4
        stats.speed += 1
        stats.range += 1
    }
    //V65: глава 4 — ещё х1.5 ХП, урон +2/+8, скорость и зоркость +1; V67a: скорость +2
    if(status.meta.page > 3) {
        stats.hp *= 1.5
        stats.dmg[0] += 2
        stats.dmg[1] += 8
        stats.speed += 2
        stats.range += 1
    }
    objectValues.push({"id":status.oVcount,"type":"enemy","class":data.enemes[type][0],"stats":stats,"animCounters":60/data.enemes[type][0].anims[2].others[2].speed,"currentAnim":data.enemes[type][0].anims[2].others[2],"currentStill":0,"room":obj[9],"cells":createCells(obj[9]),"state":0,"stop":0,"xCell":spawn[0],"yCell":spawn[1],"noStunTime":0,
    "img":image(svgArr[1],
        spawn[0]*32,
        spawn[1]*32,
        data.enemes[type][0].anims[2].others[2].w,
        data.enemes[type][0].anims[2].others[2].h,
        data.enemes[type][0].anims[2].others[2].img,
        {"times":data.enemes[type][0].anims[2].others[2].times,"id":status.oVcount,"frame":1})})
    status.oVcount++
    objectValues[objectValues.length-1].rect = objectValues[objectValues.length-1].img.clipRect
    let lengthAttacks = data.enemes[type][0].attacks.length
    for (let iA = 0; iA < lengthAttacks; iA++) {
        objectValues[objectValues.length-1].stats.attacksCd[iA] = Math.trunc((data.attacks[data.enemes[type][0].attacks[iA]].cooldown*1000)/16)
    }
}
function createRat(obj) {
    //V90 (репорт юзера): крыса из объекта спавнилась на клетке [obj[0], obj[1]+2] даже
    //если это стена у нижнего края комнаты. Ближайшая свободная клетка — как у мумии.
    const spawn = freeDropCell(obj[0],obj[1]+2)
    let type = 5 + 6*status.levelFloor
    let stats = JSON.parse(JSON.stringify(data.enemes[type][0].stats))
    if(status.meta.page > 2) {
        stats.hp *= 2
        stats.dmg[0] += 2
        stats.dmg[1] += 4
        stats.speed += 1
        stats.range += 1
    }
    //V65: глава 4 — ещё х1.5 ХП, урон +2/+8, скорость и зоркость +1; V67a: скорость +2
    if(status.meta.page > 3) {
        stats.hp *= 1.5
        stats.dmg[0] += 2
        stats.dmg[1] += 8
        stats.speed += 2
        stats.range += 1
    }
    objectValues.push({"id":status.oVcount,"type":"enemy","class":data.enemes[type][0],"stats":stats,"animCounters":60/data.enemes[type][0].anims[0].move[2].speed,"currentAnim":data.enemes[type][0].anims[0].move[2],"currentStill":0,"room":obj[9],"cells":createCells(obj[9]),"state":0,"stop":0,"xCell":spawn[0],"yCell":spawn[1],"noStunTime":0,
    "img":image(svgArr[1],
        spawn[0]*32,
        spawn[1]*32,
        data.enemes[type][0].anims[0].move[2].w,
        data.enemes[type][0].anims[0].move[2].h,
        data.enemes[type][0].anims[0].move[2].img,
        {"times":data.enemes[type][0].anims[0].move[2].times,"id":status.oVcount,"frame":1})})
    status.oVcount++
    objectValues[objectValues.length-1].rect = objectValues[objectValues.length-1].img.clipRect
    let lengthAttacks = data.enemes[type][0].attacks.length
    for (let iA = 0; iA < lengthAttacks; iA++) {
        objectValues[objectValues.length-1].stats.attacksCd[iA] = Math.trunc((data.attacks[data.enemes[type][0].attacks[iA]].cooldown*1000)/16)
    }
}
function createCells(room) {
    let roomFloore = dataGeneric.scenes[status.levelFloor].floor[room[0]]
    let x = roomFloore[0]
    let y = roomFloore[1]
    let w = roomFloore[2]
    let h = roomFloore[3]
    let lengthX = w
    let lengthY = h
    let lengthWalls = dataGeneric.scenes[status.levelFloor].walls.length
    let lengthObjects = dataGeneric.scenes[status.levelFloor].objects.length
    let emptyCellArr = []
    for (let ix = 0; ix < lengthX; ix++) {
        for (let iy = 0; iy < lengthY; iy++) {
            let push = true
            for (let iw = 0; iw < lengthWalls; iw++) {
                //проверка стен
                let lengthWX = dataGeneric.scenes[status.levelFloor].walls[iw][3]
                let lengthWY = dataGeneric.scenes[status.levelFloor].walls[iw][4]
                for (let iwx = 0; iwx < lengthWX; iwx++) {
                    for (let iwy = 0; iwy < lengthWY; iwy++) {
                        dataGeneric.scenes[status.levelFloor].walls[iw][0]+iwx===x+ix&&dataGeneric.scenes[status.levelFloor].walls[iw][1]+iwy===y+iy&&
                        (push = false)
                    }
                }
            }
            for (let io = 0; io < lengthObjects; io++) {
                //проверка обьектов
                let lengthWX = dataGeneric.scenes[status.levelFloor].objects[io][3]
                let lengthWY = dataGeneric.scenes[status.levelFloor].objects[io][4]
                for (let iwx = 0; iwx < lengthWX; iwx++) {
                    for (let iwy = 0; iwy < lengthWY; iwy++) {
                        dataGeneric.scenes[status.levelFloor].objects[io][0]+iwx===x+ix&&dataGeneric.scenes[status.levelFloor].objects[io][1]+iwy===y+iy&&
                        (push = false)
                    }
                }
            }
            if (push) {
                emptyCellArr.push([x+ix,y+iy])
            }
        }
    }
    emptyCellArr.sort((a,b) => Math.random() - 0.5)
    return emptyCellArr
}
function checkRat(enemy) {
    //V69: ручные зверьки еду НЕ едят (кроме первой, которой их приручили — она уже съедена
    //до смены type на "pet"); питомец пробегает мимо еды, не съедая её
    if (enemy.type === "pet") return
    let lengthDropArr = dropArr.length
    for (let i = 0; i < lengthDropArr; i++) {
        if(dropArr[i].href.animVal === "./images/dungeon/drop/food.png" && checkCollision(
            enemy.img.x.animVal.value,
            dropArr[i].x.animVal.value,
            enemy.img.width.animVal.value/4,
            dropArr[i].width.animVal.value,
            enemy.img.y.animVal.value,
            dropArr[i].y.animVal.value,
            enemy.img.height.animVal.value,
            dropArr[i].height.animVal.value)) {
            dropArr[i].remove()
            dropArr.splice(i,1)
            playEffect(enemy,data.effects[4],1)
            enemy.type = "pet"
            //V52: засчитывается только крыса (фильтр внутри achTame)
            achTame(enemy)
            return
        }
    }
}
export {encounters,checkRat,createCells}