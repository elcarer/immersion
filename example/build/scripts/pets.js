//V69: ручные зверьки (pet — накормленные крысы id 6 и пауки id 13 из encounters.checkRat)
//переносятся между этажами забега. Сцена при спуске пересоздаётся (del() чистит objectValues),
//поэтому в nextFloor (ДО del в endScreen/comix) снимаем снапшот: status.pets — список
//{class, stats} (class — живая ссылка на запись data.enemes, она вне сцен; stats — копия
//текущих характеристик). В newGame ПОСЛЕ sceneGenerate спавним их рядом с героем в стартовой
//комнате: свободные клетки по status.matrixLevel вокруг клетки героя, без дублей.
//Бонус приручённости: при открытии новой комнаты (openRoom) с шансом 2% случайный питомец
//получает путь к герою (buildChasePath, идёт штатным stepAlongPath врагов — врагом при
//этом не становится), и ТОЛЬКО когда добежал и остановился — еда появляется НА НЁМ САМОМ
//(V90: «чтобы было понятно, что именно он принёс еду»; раньше еда появлялась сразу у
//героя, а пробег мог оборвать petFollowTick). Пока «удача» не доиграна, petFollowTick
//путь питомца не трогает (guard в enemyAI) — не отвлекается.
//Сами питомцы еду НЕ едят — guard в checkRat; урон по pet не проходит (damage() читает
//только type "enemy"), поэтому питомцы бессмертны и живут до конца забега.
import { status } from "../scripts/start.js"
import { svgArr, image, worldImage, rectPos } from "../scripts/svg.js"
import { objectValues, screenPic } from "../scripts/del.js"
//V103: принесённая еда вылетает из центра спрайта пета и летит по параболе (dropSafe.js);
//в dropArr кучка попадает по приземлении — dropFly сам её добавляет
import { dropFly } from "../scripts/dropSafe.js"
import { buildChasePath } from "../scripts/enemyAI.js"
//V75: Хлебосол (шкафчик) — «любое выпадение еды», включая находку питомца
import { blessEcho } from "../scripts/blessFx.js"
//V97: еда принесена — над петом однократно играет эффект приручения (effects/4.png)
import { data } from "../scripts/data.js"
import { playEffect } from "../scripts/damage.js"

const PET_FOOD_CHANCE = 0.02 //V96: поднято с 0.01 (решение пользователя)

//кольцо клеток вокруг героя для спавна питомцев/еды: сначала 8 соседей, затем расстояние 2
const NEAR = [[0,-1],[1,-1],[-1,-1],[1,0],[-1,0],[1,1],[-1,1],[0,1],[0,-2],[2,0],[-2,0],[0,2]]

//первая свободная (пол матрицы === 1) клетка рядом с данной; used — уже занятые разными
//питомцами клетки одного спавна (и клетка еды), чтобы двое не встали на одну точку
function freeCellNear(col,row,used) {
    const m = status.matrixLevel
    if (!m) return null
    for (let i = 0; i < NEAR.length; i++) {
        const c = col + NEAR[i][0]
        const r = row + NEAR[i][1]
        if (m[r] && m[r][c] === 1 && !(used && used[c + "_" + r])) return [c,r]
    }
    return null
}

//nextFloor.js: снимок ручных зверьков перед пересозданием сцены (del() в endScreen/comix
//уже ничего не оставляет от objectValues)
function snapshotCarryPets() {
    status.pets = []
    for (let i = 0; i < objectValues.length; i++) {
        const e = objectValues[i]
        if (e.type === "pet" && e.stats && e.stats.hp > 0) {
            status.pets.push({"class": e.class, "stats": JSON.parse(JSON.stringify(e.stats))})
        }
    }
}

//newGame.js (после sceneGenerate — матрица и герой готовы): питомцы появляются рядом
//с героем в стартовой комнате нового этажа; список забирается целиком (снапшот одноразовый)
function spawnCarriedPets() {
    const pets = status.pets
    status.pets = []
    if (!pets.length || status.start !== 1 || !status.hero.obj || status.hero.obj.type !== "hero") return
    const hc = [Math.trunc(status.hero.x / 32), Math.trunc(status.hero.y / 32)]
    const used = {}
    for (let i = 0; i < pets.length; i++) {
        const spot = freeCellNear(hc[0], hc[1], used)
        if (!spot) break
        used[spot[0] + "_" + spot[1]] = 1
        spawnPet(pets[i], spot)
    }
}

//объект питомца — по рецепту createRat (encounters.js), но type "pet" сразу и без привязки
//к комнате (боевой ИИ питомцу не нужен: enemyTick для pet — только следование за героем
//petFollowTick, V78, и доведение остатка пути stepAlongPath)
function spawnPet(p,spot) {
    const anim = p.class.anims[0].move[2]
    objectValues.push({"id":status.oVcount,"type":"pet","class":p.class,"stats":p.stats,
    "animCounters":60/anim.speed,"currentAnim":anim,"currentStill":0,"room":null,"cells":[],
    "state":0,"stop":0,"xCell":spot[0],"yCell":spot[1],"noStunTime":0,
    "img":image(svgArr[1],
        spot[0]*32,
        spot[1]*32,
        anim.w,
        anim.h,
        anim.img,
        {"times":anim.times,"id":status.oVcount,"frame":1})})
    status.oVcount++
    objectValues[objectValues.length-1].rect = objectValues[objectValues.length-1].img.clipRect
}

//openRoom.js: 2% на открытие новой комнаты при живом питомце — случайный питомец получает
//путь к герою («удача»). V90: еда появляется НЕ сразу, а когда питомец добежит (petLuckyTick,
//вызов из enemyAI). Путь не построился (герой временно недостижим) — доставляем сразу.
//Повторный бросок, пока «удача» не доиграна, сгорает — питомец с пути не переназначается.
function petLuckyFood() {
    if (Math.random() >= PET_FOOD_CHANCE) return
    let pets = []
    for (let i = 0; i < objectValues.length; i++) {
        objectValues[i].type === "pet" && !objectValues[i].luckyRun && pets.push(objectValues[i])
    }
    if (!pets.length) return
    const pet = pets[Math.trunc(Math.random() * pets.length)]
    //путь к герою: клетка питомца — по ЦЕНТРУ rect (x+16, y+25), как у всех врагов
    const p = rectPos(pet.rect)
    const petCell = [Math.trunc((p[0] + 16) / 32), Math.trunc((p[1] + 25) / 32)]
    const hc = [Math.trunc(status.hero.x / 32), Math.trunc(status.hero.y / 32)]
    pet.path = buildChasePath(petCell, hc, pet)
    if (!pet.path.length) {
        //дойти нельзя — пет стоит на месте, еда появляется на нём сразу
        spawnLuckyFood(pet)
        return
    }
    pet.luckyRun = 1
    pet.pathTarget = hc
}
//еда «удачи» — обычный food.png с подбором героем; появляется НА питомце (репорт V90:
//«чтобы было понятно, что именно он принёс еду») — на его текущей клетке в момент
//остановки. Клетка пета проходима по построению пути; V75: Хлебосол — шанс доп. кучи
function spawnLuckyFood(pet) {
    const p = rectPos(pet.rect)
    const spot = [Math.trunc((p[0] + 16) / 32), Math.trunc((p[1] + 25) / 32)]
    //V97: «зверёк принёс еду» — однократный эффект приручения (data.effects[4],
    //effects/4.png) над петом, тем же вызовом, что в encounters.checkRat
    playEffect(pet, data.effects[4], 1)
    const drop = {"w":32,"h":36,"img":"./images/dungeon/drop/food.png"}
    screenPic.push(worldImage(svgArr[1],spot[0]*32,spot[1]*32 - 2,drop.w,drop.h,drop.img,{"id":screenPic.length-1}))
    //V103: полёт из центра спрайта пета; в dropArr — по приземлении (dropSafe.dropFly)
    dropFly(screenPic[screenPic.length - 1], p[0] + pet.rect._w/2, p[1] + pet.rect._h/2)
    blessEcho(drop,spot[0]*32,spot[1]*32 - 2)
}
//вызов из enemyAI.enemyTick раз в тик питомца: остановился ли «удачный» пробег.
//Доставка — когда путь иссяк в stepAlongPath (пет дошёл до снятой клетки героя
//и ОСТАНОВИЛСЯ): еда появляется на нём самом. Путь, сброшенный сменой сцены/прочим,
//доставляет сразу — «удача» не должна зависать навсегда.
function petLuckyTick(pet) {
    if (!pet.luckyRun) return
    if (!pet.path || !pet.path.length) {
        pet.luckyRun = undefined
        pet.pathTarget = null
        spawnLuckyFood(pet)
    }
}

export { snapshotCarryPets, spawnCarriedPets, petLuckyFood, petLuckyTick }
