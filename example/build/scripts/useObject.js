import { dataGeneric } from "../scripts/sceneGenerate.js"
import { status } from "../scripts/start.js"
import { T } from "../scripts/localization.js"
import { svgArr,image,worldImage,rect,picById } from "../scripts/svg.js"
import { screenPic } from "../scripts/del.js"
import { encounters } from "../scripts/encounters.js"
import { changeHP } from "../scripts/takeDamage.js"
import { floatText } from "../scripts/floatText.js"
import { checkExp } from "../scripts/damage.js"
//V70: кап способностей — очко от алтаря (obj.12) при капе уходит в очки характеристик
import { abilOverflowToStats } from "../scripts/skillTree.js"
//V43: столбы призыва босса 3 этажа — переключение и волна
import { finPillarToggle, tryFinSummon } from "../scripts/finPillars.js"
import { playback,strike } from "../scripts/sound.js"
import { nextFloor } from "../scripts/nextFloor.js"
//V49: статуя неизвестного героя (тип 16) — случайный баф из трёх складывающихся
import { giveBuff } from "../scripts/buffFx.js"
//V53: сет «Великий вор» — бонус «4 предмета» к времени использования интерактивных объектов
//V67: «Вечный берилл» — численные сетовые бонусы удваиваются (54 → 48 тиков), см. setUseTicks
import { setUseTicks } from "../scripts/sets.js"
//V67: «Вечный сапфир» — копия доп-способности источника (везучесть → шанс дропа)
import { abilCopyBonus } from "../scripts/relics.js"
//V54: алхимический стол (тип 17) — меню объединения трёх предметов одного качества
import { openAlchemy } from "../scripts/alchemy.js"
//V64: портал (18) и рычаг (19) — переключение фаз и телепорт в арену;
//V83: кнопка загадки (21) — флип себя и соседей по логической сетке;
//V97: чаша «напёрстков» (22) — выбор чаши (фазы и последствия в portalFx.js)
import { portalUse, puzzleButtonUse, shellCupUse } from "../scripts/portalFx.js"
//V69: дроп из объектов (бочки/двери) не застревает в стенах — dropSafe.js
import { placeDrop } from "../scripts/dropSafe.js"
//V75: шкафчик с древностями (тип 20) — меню благословений; эхо Хлебосола/Золотого эха на дропе
import { openAncient,blessEcho } from "../scripts/blessFx.js"

let bars = []
function useObject(obj,i0) {
    status.use === 1&&stopUseObject()
    status.use = 1
    //подсветка только если картинка объекта отрисована (защита от find===undefined: объект вне
    //отрисованных клеток комнаты не имеет спрайта, но геометрически находится checkObject'ом).
    //R3: поиск по id-ключу за O(1) (shimById), «надгробия» (null) в Map не попадают
    let hl = picById(obj[6]+"OI")
    hl && hl.setAttribute("style", 'filter: drop-shadow(0 0 6px rgba(255, 255, 204, 0.8))')
    screenPic.push(rect(svgArr[1],obj[0]*32+2+obj[3]*16-32,obj[1]*32-21,0,10,"none","0px","#cc9966"))
    //V53: сет «Великий вор» (4 надетых): -10% ко времени использования — полоска 60 → 54 тика
    //(V67: «Вечный берилл» удваивает численные бонусы сета — 48 тиков)
    bars.push({"type":"use","fin":setUseTicks(),"speed":1,"obj":screenPic[screenPic.length - 1],"func":() => finishUsedObject(obj)})
    screenPic.push(worldImage(svgArr[1],obj[0]*32+obj[3]*16-32,obj[1]*32-24,64,14,"./images/UI/panels/bar1mini.png",{"id":i0+"R"}))
    obj[5] = i0
}
function stopUseObject() {
    let level = dataGeneric.scenes[status.levelFloor]
    let i0Max = level.objects.length
    for (let i0 = 0; i0 < i0Max; i0++) {
        if (level.objects[i0][5]!==undefined) {
            let lengthBars = bars.length
            for (let i = 0; i < lengthBars; i++) {
                if (bars[i].type === "use") {
                bars[i].obj.remove()
                bars.splice(i,1)
                break
                }
            }
            let barBg = picById(level.objects[i0][5]+"RI")
            barBg && barBg.remove()
            level.objects[i0][5] = undefined
            let obj = picById(level.objects[i0][6]+"OI")
            obj && obj.setAttribute("style", 'filter: none')
            status.use = 0
        }
    }
}
function finishUsedObject(obj) {
    if(obj[2] === 9 && status.info.keys <= 0) {
        stopUseObject()
        floatText(status.hero.x - 16 + Math.trunc(Math.random() * 32),status.hero.y+8,T("float.needkey"),"grey","18px","none")
        playback(strike[7].vol,0,0,3*status.settings.soundVolume)
        return
    }
    if(obj[2] === 13 && status.info.bossKill !== 1) {
        stopUseObject()
        floatText(status.hero.x - 16 + Math.trunc(Math.random() * 32),status.hero.y+8,T("float.needboss"),"grey","18px","none")
        playback(strike[7].vol,0,0,3*status.settings.soundVolume)
        return
    }
    //V43: столб (15), статуя (16, V49), алхимический стол (17, V54), портал и рычаг (18/19, V64),
    //V83: кнопка загадки (21), V97: чаша «напёрстков» (22) — с обычным звуком «использования»
    (obj[2] === 3||obj[2] === 10||obj[2] === 11||obj[2] === 12||obj[2] === 6||obj[2] === 15||obj[2] === 16||obj[2] === 17||obj[2] === 18||obj[2] === 19||obj[2] === 20||obj[2] === 21||obj[2] === 22) ? playback(strike[13].vol,0,0,2*status.settings.soundVolume) : playback(strike[1].vol,0,0,5*status.settings.soundVolume)
    if(obj[2] === 15) {
        //V43: столб в отличие от остальных объектов ПОВТОРЯЕМЫЙ — obj[7] не ставится,
        //повторный юз разрешается после выхода героя из зоны (obj[11], heroMove.checkObject)
        finPillarToggle(obj)
        obj[11] = 1
        tryFinSummon()
    } else if(obj[2] === 17) {
        //V54: алхимический стол тоже ПОВТОРЯЕМЫЙ до успешного объединения: меню ставит игру
        //на паузу; «Выйти»/ESC закрывает меню, объект остаётся используемым (obj[11], как у
        //столба — повторный юз после выхода героя из зоны). obj[7] ставит только mergeSelected.
        obj[11] = 1
        openAlchemy(obj)
    } else if(obj[2] === 18 || obj[2] === 19) {
        //V64: портал и рычаг ПОВТОРЯЕМЫЕ (перезарядка obj[11] до выхода из зоны): фазы
        //переключает и телепортирует portalFx.js; obj[7] никогда не ставится — оба объекта
        //неразрушаемы (решение пользователя), в Библиотеку не зачисляются (карточек нет)
        obj[11] = 1
        portalUse(obj)
    } else if(obj[2] === 21) {
        //V83: кнопка загадки ПОВТОРЯЕМАЯ (перезарядка obj[11] до выхода из зоны, как у
        //столба 15): флип себя и соседей по логической сетке делает portalFx.js;
        //obj[7] не ставится — кнопка неразрушаема, карточки в Библиотеке нет
        obj[11] = 1
        puzzleButtonUse(obj)
    } else if(obj[2] === 22) {
        //V97: чаша «напёрстков» ПОВТОРЯЕМАЯ (перезарядка obj[11] до выхода из зоны), но
        //интерактивна только в фазе выбора (guard в heroMove.checkObject): выбор и все
        //последствия — portalFx.shellCupUse. obj[7] не ставится — чаша неразрушаема,
        //карточки в Библиотеке нет
        obj[11] = 1
        shellCupUse(obj)
    } else {
        actionsObject(obj)
    }
    //V48: первое использование объекта открывает его карточку в Библиотеке (зачёт между забегами).
    //id = тип + этаж*20 (формула спрайта createRoom); V63: у ловушек три карточки по спрайту
    //obj[10] — шипы (3) → 14, кислота (4) → 34, огонь (1) → 54; столб — 55. V64: 18/19 — мимо.
    //V67: выход с 4 этажа (13 на «Пустоте») — мимо: карточки obj.73 в Библиотеке нет,
    //обычный спуск уже зачтён как obj.13 на первом этаже. V83: кнопка загадки (21) — мимо.
    //V97: чаша «напёрстков» (22) — мимо
    let libObj = status.meta.libraryObjects
    Array.isArray(libObj) && !(obj[2] === 13 && status.levelFloor === 3) && obj[2] !== 18 && obj[2] !== 19 && obj[2] !== 21 && obj[2] !== 22 && (libObj[obj[2] === 15 ? 55 : obj[2] === 14 ? (obj[10] === 3 ? 14 : obj[10] === 4 ? 34 : 54) : obj[2] + status.levelFloor * 20] = 1)
    stopUseObject()
    //V75: шкафчик (20) тоже мимо — obj[7]=1 ставит только grantBless (взял благословение),
    //до выбора объект остаётся переиспользуемым. V83: кнопка (21) — мимо (повторяемая).
    //V97: чаша (22) — мимо (повторяемая, неразрушаемая)
    obj[2] !== 15 && obj[2] !== 17 && obj[2] !== 18 && obj[2] !== 19 && obj[2] !== 20 && obj[2] !== 21 && obj[2] !== 22 && (obj[7] = 1)
    status.attack.current = []
}
function actionsObject(obj) {
    switch (obj[2]) {
        case 1: drop(obj)
            break
        case 2: drop(obj)
            break
        case 3: status.info.hp = parseInt(status.info.stats[2].dops[0].value2.slice(0,-1));changeHP(document.getElementById("hpBarI"),document.getElementById("hpText"),"hp");floatText(status.hero.x - 16 + Math.trunc(Math.random() * 32),status.hero.y+8,"+" + status.info.hp,"#33FF66","18px","none")
            break
        case 4: drop(obj)
            break
        case 5: drop(obj)
            break
        case 6: drop(obj,2)
            break
        case 7: drop(obj)
            break
        case 8: drop(obj)
            break
        case 9: status.info.keyLock === 0 ? status.info.keys-- : Math.trunc(Math.random() * 100) < status.info.keyLock ? false : status.info.keys--; drop(obj,1)
            break
        //V96: порог «ровно до следующего уровня» — ТА ЖЕ формула, что в checkExp (damage.js):
        //((1+20/lvl)^(lvl/20)−1)/(e−1)·100. Прежняя ((1+30/(lvl+3))^((lvl+3)/30)) совпадала
        //с ней только на 6 уровне: выше 6-го алтарь недоливал опыт, ниже — переливал.
        case 10: status.info.hp -= checkStoneSkin(Math.trunc(2*status.info.hp/3));let nextLvl = Math.trunc(((1 + 20/(status.info.lvl))**((status.info.lvl)/20) - 1) / (Math.exp(1) - 1) * 100)-status.info.exp;status.info.exp += nextLvl;checkExp(nextLvl);changeHP(document.getElementById("hpBarI"),document.getElementById("hpText"),"hp")
        break
        case 11: encounters(obj);drop(obj);drop(obj);drop(obj)
        break
        case 12: status.info.hp -= checkStoneSkin(Math.trunc(status.info.hp/3));status.info.abilPoints++;abilOverflowToStats();changeHP(document.getElementById("hpBarI"),document.getElementById("hpText"),"hp")
        break
        case 13: nextFloor()
        break
        case 14: status.info.exp += 1;checkExp(1)
        break
        //V49 статуя неизвестного героя: случайный 1 из 3 бафов на 60 секунд (бафы складываются)
        case 16: giveBuff()
        break
        //V75 шкафчик с древностями: пауза, три случайных благословения — одно на выбор.
        //ESC/«Выйти» объект НЕ расходует (obj[11]=1 — переиспользование после выхода
        //героя из зоны, как у алхимического стола); взял благословение — grantBless ставит obj[7]=1
        case 20: obj[11] = 1;openAncient(obj)
        break
    }
    //R3: поиск по id-ключу за O(1)
    let img = picById(obj[6]+"OI")
    //для ловушек это traps/1d|3d|4d.png (обезвреженный спрайт); V63: у шипов/огня текущий
    //спрайт может быть «выключенного» состояния (3e/1e.png) — e-суффикс снимается перед d,
    //иначе наивная склейка давала несуществующий 3ed.png.
    //V67: выход с 4 этажа (4exit.png) — «d»-версии не существует, спрайт не меняем.
    //V75: шкафчик (20) тоже мимо — 101d.png ставит только grantBless (объект «потемнел»
    //именно при ПОЛУЧЕНИИ благословения, а не при открытии меню)
    !(obj[2] === 13 && status.levelFloor === 3) && obj[2] !== 20 && img && img.setAttribute("href", img.href.animVal.replace(/e?\.png$/, "d.png"))
}
function checkStoneSkin(damageTrap) {
    if(status.info.stoneSkin) {
        damageTrap -= Math.trunc(damageTrap*(parseInt(status.info.stats[2].dops[2].value2.slice(0,-1))/100))
    }
    return damageTrap
}
let dropArr = []
//E-15: транспорт «это кучка из сундука босса» в takeDrop: ключ — хэндл кучки,
//значение — фиксированная редкость; предмет генерируется при ПОДБОРЕ с фильтром
//«оружие» (itemGenerate(rarity, {type: 11})). WeakMap: неподобранные кучки не
//держат память — хэндлы умирают при разборе сцены, записи собирает GC
const bossWeaponDrops = new WeakMap()

function drop(obj,lvl=0) {
    //E-15: сундук босса (тип 9 с меткой obj[10]=1, ставится newGame в самой большой
    //комнате) — гарантированная кучка ПРЕДМЕТА вместо обычного generateDrop: случайное
    //ОРУЖИЕ, редкость по этажу (1 этаж — редкое, 2 — эпическое, 3 — легендарное/сет);
    //спрайт кучки — по редкости (item2/3/4.png), фильтр уезжает в takeDrop
    let drop
    let bossRarity = 0
    if(obj[2] === 9 && obj[10] === 1) {
        bossRarity = status.levelFloor + 2
        //E-15: свои кучки юзера (16×42): 1 этаж bossitem1 (редкое), 2 — bossitem2
        //(эпическое), 3 — bossitem3 (легендарное); индекс = этаж
        drop = bossLootTable[status.levelFloor]
    } else {
        drop = generateDrop(lvl)
        drop === false && obj[2] !== 11 && encounters(obj)
        drop === false && status.info.searshFood && Math.random() < status.info.searshFood && (drop = lootTable[4])
    }
    if (drop) {
        //R3: поиск по id-ключу за O(1)
        let img = picById(obj[6]+"OI")
        //если спрайта объекта нет (объект вне отрисованных клеток комнаты), дропаем от его
        //собственной клетки — img обязателен был только ради координат
        let bx = img ? img.x.animVal.value : obj[0]*32
        let by = img ? img.y.animVal.value : obj[1]*32
        let x = bx + Math.trunc(Math.random() * obj[3]*16)
        let y = by + obj[4]*32 + Math.trunc(Math.random() * 16) - 16
        screenPic.push(worldImage(svgArr[1],x,y,drop.w,drop.h,drop.img,{"id":screenPic.length-1}))
        dropArr.push(screenPic[screenPic.length - 1])
        bossRarity > 0 && bossWeaponDrops.set(dropArr[dropArr.length - 1], bossRarity)
        //V69: дроп упал в стену/пустоту — переносим на свободную клетку рядом
        placeDrop(screenPic[screenPic.length - 1],x,y,drop.w,drop.h)
        //V75: Хлебосол/Золотое эхо — шанс доп. кучки еды/золота рядом
        blessEcho(drop,x,y)
    }
}
let lootTable = [
    {"w":64,"h":32,"img":"./images/dungeon/drop/gold.png"},
    {"w":32,"h":36,"img":"./images/dungeon/drop/item1.png"},
    {"w":32,"h":36,"img":"./images/dungeon/drop/item2.png"},
    {"w":32,"h":36,"img":"./images/dungeon/drop/item3.png"},
    {"w":32,"h":36,"img":"./images/dungeon/drop/food.png"},
    {"w":32,"h":36,"img":"./images/dungeon/drop/scroll.png"},
    {"w":28,"h":32,"img":"./images/dungeon/drop/key.png"},
    {"w":32,"h":36,"img":"./images/dungeon/drop/item4.png"}
]
//E-15: кучки сундука босса — спрайты юзера (16×42), индекс = этаж (0..2):
//bossitem1 — редкое оружие 1 этажа, bossitem2 — эпическое 2 этажа, bossitem3 —
//легендарное 3 этажа; рисуются на месте старых item2/3/4.png
let bossLootTable = [
    {"w":16,"h":42,"img":"./images/dungeon/drop/bossitem1.png"},
    {"w":16,"h":42,"img":"./images/dungeon/drop/bossitem2.png"},
    {"w":16,"h":42,"img":"./images/dungeon/drop/bossitem3.png"}
]
function generateDrop(lvl) {
    //V67: копия «везучести» (Вечный сапфир, источник в 1-й ячейке инвентаря) работает как свои
    let rand = Math.trunc(Math.random() * 100) + status.info.luckus + abilCopyBonus("luckus")
    if(lvl === 0) {
        if (rand < 20) return false
        if (rand < 60) return lootTable[0]
        if (rand < 80) return checkConsumable()
        if (rand < 95) return lootTable[1]
        if (rand < 99) return lootTable[2]
        return lootTable[3]
    }
    if(lvl === 1) {
        if (rand < 90) return lootTable[2]
        if (rand < 99) return lootTable[3]
        return lootTable[7]
    }
    if(lvl === 2) {
        return lootTable[5]
    }
}
function checkConsumable() {
    let rand = Math.trunc(Math.random() * 100) + status.info.luckus + abilCopyBonus("luckus")
    if (rand < 90) return lootTable[4]
    if (rand < 99) return lootTable[6]
    return lootTable[5]
}
export {useObject,stopUseObject,bars,dropArr,bossWeaponDrops}