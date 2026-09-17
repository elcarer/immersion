import { status } from "../scripts/start.js"
import { svgArr,image,worldImage,path, moveSprite } from "../scripts/svg.js"
import { screenPic,objectValues,acidArr } from "../scripts/del.js"
import { data } from "../scripts/data.js"
import { createCells } from "../scripts/encounters.js"
import { dataGeneric } from "../scripts/sceneGenerate.js"
let boss
let bossAttack = []
let eggsArr = []
const moveSpeed = 4
let direction = 1
//V90: точка посадки босса — позиция героя, снятая В МОМЕНТ НАЧАЛА спуска (bossDown);
//на весь спуск фиксируется (решение пользователя), на посадке и в resetBossFight гасится
let bossDownTarget = null
function spiderBossFight() {
    //V96: порог подъёма — 150 потерянных хп (было 100; счётчик копит весь урон по боссу,
    //включая яд и горение)
    if(status.spiderBossFight >= 150) {
        bossUp()
        //пока большой спрайт босса падает — вести его КАЖДЫЙ кадр.
        //Раньше descentBoss вызывался только один раз из bossUp: спрайт замирал на месте,
        //кислотный дождь (bossAttack) не спавнился, посадка и bossDown не наступали.
        boss && descentBoss()
    }
}
function bossUp() {
    let lengthEnemy = objectValues.length
    for (let i = 0; i < lengthEnemy; i++) {
        //только живого босса в обычном состоянии: труп (type "corpse") трогать нельзя,
        //а "upped" (уже поднят) двигает bossDown после спуска
        if (objectValues[i].class && objectValues[i].class.id === 11 && (objectValues[i].type === "enemy" || objectValues[i].type === "up")) {
            if(objectValues[i].type === "enemy" && objectValues[i].currentAnim !== objectValues[i].class.anims[2].others[2]) {
                objectValues[i].poisonTime = 0
                objectValues[i].poison = 0
                objectValues[i].type = "up"
                objectValues[i].stop = 0
                objectValues[i].once = 1
                objectValues[i].currentStill = 0
                objectValues[i].currentAnim = objectValues[i].class.anims[2].others[2]
                objectValues[i].img.setAttribute("href", objectValues[i].class.anims[2].others[2].img)
                objectValues[i].animCounters = 60/objectValues[i].class.anims[2].others[2].speed
            }
            moveSprite(objectValues[i].img, 0, -moveSpeed*3)
            //подняться нужно ВЫШЕ ЭКРАНА (верхняя граница камеры viewBox — это hero.y−540±слежка,
            //а не hero.y−512): −128 = высота спрайта 64 + запас, чтобы босса не было видно
            if (objectValues[i].rect.y.animVal.value < svgArr[0].viewBox.animVal.y - 128) {
                objectValues[i].type = "upped"
                //V68 (репорт юзера): спрайт, запаркованный над ареной, ВИДЕН, когда герой
                //поднимается наверх, — прячем его visibility до самого спуска (bossDown);
                //камера следует за героем, «за экраном» здесь быть не может
                objectValues[i].img.setAttribute("visibility", "hidden")
                descentBoss()
            }
            break
        }
    }
}
function descentBoss() {
    if(!boss) {
        let x = status.hero.x - 256
        let y = status.hero.y - 948
        screenPic.push(worldImage(svgArr[1],x,y,575,448,"./images/enemy/boss.png"))
        boss = screenPic[screenPic.length - 1]
    }
    boss.setAttribute("y", boss.y.animVal.value + moveSpeed * direction)
    if(boss.y.animVal.value > status.hero.y - 500) {
        direction = -1
    }
    if(boss.y.animVal.value < status.hero.y - 948 && direction === -1) {
        status.spiderBossFight = 1
        boss.remove()
        boss = undefined
        direction = 1
        status.bossDown = 1
    }
    if(status.time % 2 === 0) {
        screenPic.push(worldImage(svgArr[0],status.hero.x - 384 + Math.trunc(Math.random() * 768),status.hero.y - 1256 + Math.trunc(Math.random() * 384),32,47,"./images/enemy/bossAttack.png"))
        bossAttack.push({"path":0,"speed":Math.trunc(Math.random() * 3) + 1.5,"img":screenPic[screenPic.length - 1]})
    }
}
function bossDown() {
    let lengthEnemy = objectValues.length
    for (let i = 0; i < lengthEnemy; i++) {
        if (objectValues[i].type === "upped") {
            const e = objectValues[i]
            //V90 (репорт юзера): босс должен спускаться ПРЯМО НА ГЕРОЯ. Раньше он
            //опускался по вертикали за ЖИВЫМ hero.y, а по X оставался над точкой взлёта —
            //садился «в другую точку». Точка-цель снимается один раз, в начале спуска.
            !bossDownTarget && (bossDownTarget = [status.hero.x, status.hero.y])
            const w = e.rect._w !== undefined && e.rect._w !== null ? e.rect._w : e.rect.width.animVal.value
            //цель: центр спрайта босса над центром героя; порог по вертикали прежний —
            //верх спрайта на 32px выше верха героя (клетка героя = top-left + 16/25)
            const tx = bossDownTarget[0] + 16 - w / 2
            const ty = bossDownTarget[1] - 32
            const dx = tx - e.rect.x.animVal.value
            const dy = ty - e.rect.y.animVal.value
            const step = moveSpeed * 3
            if (Math.abs(dx) <= step && dy <= step) {
                //цель в одном шаге — сажаем ТОЧНО в снятую точку
                moveSprite(e.img, dx, dy)
                e.type = "enemy"
                //V68: спуск завершён — спрайт снова виден (прятали в bossUp перед фазой дождя)
                e.img.setAttribute("visibility", "visible")
                status.bossDown = undefined
                bossDownTarget = null
            } else {
                //весь спуск идём к снятой точке: шаг по каждой оси не больше шага спуска
                moveSprite(e.img, Math.max(-step, Math.min(step, dx)), Math.max(-step, Math.min(step, dy)))
            }
            break
        }
    }
}
function descentBossAttack() {
    let lengthBossAttack = bossAttack.length
    for (let i = 0; i < lengthBossAttack; i++) {
        if(bossAttack[i].path <= 1024) {
            bossAttack[i].img.setAttribute("y", bossAttack[i].img.y.animVal.value + moveSpeed*bossAttack[i].speed)
            bossAttack[i].path += moveSpeed*bossAttack[i].speed
        } else {
            screenPic.push(worldImage(svgArr[0],bossAttack[i].img.x.animVal.value,bossAttack[i].img.y.animVal.value + 40,32,15,"./images/effects/acid.png",{"id":screenPic.length-1}))
            acidArr.push(screenPic[screenPic.length - 1])
            bossAttack[i].img.remove()
            bossAttack.splice(i,1)
            i--
            lengthBossAttack--
        }
    }
}
function createEgg(x,y) {
    screenPic.push(worldImage(svgArr[0],x,y,32,25,"./images/enemy/bossEgg.png",{"id":screenPic.length-1}))
    eggsArr.push({"birthTime":400,"img":screenPic[screenPic.length - 1]})
}
function delEgg() {
    let lengthEgg = eggsArr.length
    for (let i = 0; i < lengthEgg; i++) {
        if(eggsArr[i].birthTime <= 0) {
            birthSpiders(eggsArr[i].img.x.animVal.value,eggsArr[i].img.y.animVal.value)
            eggsArr[i].img.remove()
            eggsArr.splice(i,1)
            i--
            lengthEgg--
        } else {
            eggsArr[i].birthTime--
        }
    }
}
function birthSpiders(x,y) {
    let obj = dataGeneric.scenes[status.levelFloor].objects[0]
    //type — ИНДЕКС ГРУППЫ обычного «Паука» (id 13), НЕ босса (Босс-паук — id 11):
    //на 2-м этаже группа 11, на 3-м — группа 17 (копия 2-го этажа)
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
    objectValues.push({"id":status.oVcount,"type":"enemy","class":data.enemes[type][0],"stats":stats,"animCounters":60/data.enemes[type][0].anims[0].move[2].speed,"currentAnim":data.enemes[type][0].anims[0].move[2],"currentStill":0,"state":0,"stop":0,"xCell":obj[0],"yCell":obj[1]+2,"room":obj[9],"cells":createCells(obj[9]),"noStunTime":0,
    "img":image(svgArr[1],
        x,
        y,
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
function resetBossFight() {
    boss = undefined
    bossAttack.length = 0
    eggsArr.length = 0
    status.bossDown = undefined
    status.spiderBossFight = 0
    bossDownTarget = null //V90: снятая точка спуска не переживает смену сцены
}
export {spiderBossFight,descentBossAttack,bossAttack,bossDown,eggsArr,delEgg,createEgg,resetBossFight}