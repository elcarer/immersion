import { screenPic,del,objectValues,wallsOverlay,doorPics } from "../scripts/del.js"
import { status } from "../scripts/start.js"
//V63: спрайт ловушки по её состоянию (Ne.png/N.png) — единая формула с mapRender/enemyHover/trapsFx
import { trapSpriteSrc } from "../scripts/trapSprite.js"
//V64: спрайт Портала (18) и Рычага (19) по состоянию — единая формула с mapRender/portalFx
//V97: спрайт Чаши «напёрстков» (22) по полноте (goldFull/goldEmpty) — оттуда же
import { portalSpriteSrc, cupSpriteSrc } from "../scripts/portalSprite.js"
//V75: шкафчик с древностями — ряд иконок-подсказок активных благословений пересобирается на этаже
import { renderBlessHints } from "../scripts/blessFx.js"
import { T } from "../scripts/localization.js"
import { svgArr,image,worldImage } from "../scripts/svg.js"
//V104: открытый диалог (quest.js) блокирует хоткеи панелей — панель поверх диалога недопустима
import { dialogIsOpen } from "../scripts/dialog.js"
//V62: импорт map.js удалён вместе с map-веткой createRoom — отрисовка карты
//переехала в mapRender.js (комнаты/коридоры прямоугольниками)
import * as basicData from "../scripts/data.js"
import { countDopStats } from "../scripts/countDopStats.js"
import { checkHP } from "../scripts/takeDamage.js"
import { doll } from "../scripts/doll.js"
import { inventory } from "../scripts/inventory.js"
import { skillTree } from "../scripts/skillTree.js"
import { playback,strike,playTrack,TRACK } from "../scripts/sound.js"
import { clickButton,closePanels,topMenuClose } from "../scripts/topMenu.js"
import { minimapBtn } from "../scripts/minimapFx.js"
//V31: зум игровой сцены — единый писатель камеры игровых слоёв
import { setWorldViewBox } from "../scripts/zoomFx.js"
import { activeSkills } from "../scripts/activeSkills.js"
import { settings } from "../scripts/settings.js"
//V80: наземные тени статичных объектов карты (кроме ловушек-плиток — они плоские)
import { objectShadow } from "../scripts/groundShadow.js"
import { beltChange } from "../scripts/belt.js"
import { journalAdd, J_FLOOR } from "../scripts/journal.js"
//V114: кооператив — контекст игрока + спавн соседней клетки для второго героя
import { setContext } from "../scripts/players.js"
import { collision } from "../scripts/collision.js"

let dataGeneric
function sceneGenerate(data,next=false) {
    dataGeneric = data
    del()
    status.start = 1
    //V114: инициализация забега — у КАЖДОГО игрока своя кукла/стек атак/статы.
    //Классы у игроков РАЗНЫЕ (правило кооператива), поэтому мутация анимаций
    //класса под оружие (hero.anims[...].new.anim[0]) не конфликтует между ними
    if(next === false) {
        //V69: новый забег — ручные зверьки прошлого забега не переносятся
        status.pets = []
        for (let pi = 0; pi < status.players.length; pi++) {
            const P = status.players[pi]
            const hero = basicData.data.heroes[P.class]
            let weapon = basicData.data.basicWeapons[hero.weapon]
            P.class === 0 ? P.inventory.doll = [,,,,,,,,,,,weapon,weapon,] : P.inventory.doll = [,,,,,,,,,,,weapon,,]
            if(P.class === 2) {
                P.inventory.doll = [,,,,,,,,,,,weapon,basicData.data.basicWeapons[10],]
            }
            if(P.class === 3) {
                P.inventory.doll = [,,,,,,,,,,,weapon,basicData.data.basicWeapons[11],]
            }
            let attack = basicData.data.attacks[weapon.attack]
            P.attack = {"img":attack.img,"target":undefined,"current":[],"stack":[{"timer":Math.trunc((attack.cooldown*1000)/16),"abil":attack}]}
            let length = hero.anims[1].attack.length
            for (let i = 0; i < length; i++) {
                hero.anims[1].attack[i].new.anim[0] = weapon.attack
            }
            P.info = {"stats":JSON.parse(JSON.stringify(hero.stats)),"exp":0,"lvl":1,"abilPoints":0,"gold":0,"hp":0,"beltCell":0, "beltCellArr":[],"armor":0,"upStat":status.meta.startStat,"keys":status.meta.startKey,"skills":[],"poisonus":0,"poisonusMult":1,"expous":0,"lifeus":0,"viewus":1,"invisible":0,"invisibleTime":0,"activeSkills":[],"pins":0,"backStab":1,"cloudeTime":0,"multSpeed":1,"killHeal":0,"keyLock":0,"pinsAdd":0,"pinsStan":false,"bossKill":0,"time":0,"luckus":0,"fameus":0,"greedus":0,"poison":0,"poisonTime":0,"stoneCurse":0,"goldroom":0,"reflect":1,"energyShotCharge":0,"charm":0,"blesses":[],"log":[],"puzzleUsed":0,"shellUsed":0}
            setContext(P)
            countDopStats()
            P.info.time = Date.now()
        }
        setContext(status.players[0])
    }
    //отметки этажа — у каждого игрока (bossKill нужен юзу выхода, finSummoned — столбам)
    for (let pi = 0; pi < status.players.length; pi++) {
        status.players[pi].info.bossKill = 0
        status.players[pi].info.finSummoned = 0
    }
    //V37 журнал: отметка этажа (log живёт в info — весь забег, включая смены этажей)
    journalAdd(T("journ.floor",status.levelFloor + 1), J_FLOOR)
    status.spiderBossFight = 0
    status.move = 0
    status.moveSpeed = 2
    let num = status.levelFloor
    let tileX = 32
    let tileY = 32
    //пол этажа
    let i0Max = data.scenes[num].roomsArr.length
    for (let i0 = 0; i0 < i0Max; i0++) {
        data.scenes[num].roomsArr[i0][3] === 1 && createRoom (data.scenes[num],i0,tileX,tileY)
    }
    //create heroes — V114: спавн ВСЕХ игроков; первый — в штатной точке этажа,
    //остальные — на свободной соседней клетке (spawnCellNear ниже)
    for (let pi = 0; pi < status.players.length; pi++) {
        const P = status.players[pi]
        const hero = basicData.data.heroes[P.class]
        const cell = pi === 0 ? data.scenes[num].hero : spawnCellNear(data.scenes[num], data.scenes[num].hero[0], data.scenes[num].hero[1])
        objectValues.push({"id":status.oVcount,"type":"hero","animCounters":60/hero.anims[2].others[2].speed,"currentAnim":hero.anims[2].others[2],"currentStill":0,
        "img":image(svgArr[1],
            cell[0]*tileX,
            cell[1]*tileY,
            hero.anims[2].others[2].w,
            hero.anims[2].others[2].h,
            hero.anims[2].others[2].img,
            {"times":hero.anims[2].others[2].times,"id":status.oVcount,"frame":1})})
        status.oVcount++
        P.obj = objectValues[objectValues.length-1]
        P.obj.rect = P.obj.img.clipRect
        P.info.hp = parseInt(P.info.stats[2].dops[0].value2.slice(0,-1))
        P.idx = pi
        P.x = cell[0]*tileX
        P.y = cell[1]*tileY
        P.direction = 1
        P.waitTime = 0
        P.noStunTime = 0
        P.use = 0
        P.lastCellX = -1
        P.lastCellY = -1
        P.lastAnim = null
    }
    //V31: окно камеры (1920/zoom × 1080/zoom) подставляет setWorldViewBox; x/y прежние —
    //центрирование на точке спавна при входе на этаж. Зум переживает смену этажа внутри забега.
    //V114: камера — по точке спавна игрока 1 (кооп-камера — V116)
    setContext(status.players[0])
    setWorldViewBox(data.scenes[num].hero[0]*tileX-480, data.scenes[num].hero[1]*tileY-270)
    status.move = 1
    checkHP()
    createMatrix()
    //V61: музыка подземелья через шину (переключение с таверны/меню — мгновенное)
    playTrack(TRACK.dungeon)
    activeSkills()
    beltChange()
    //V45: броня щитов на кукле начисляется ОДИН РАЗ за забег (next === false). Раньше блок
    //выполнялся и при сменах этажей — броня текущих щитов добавлялась заново каждый этаж,
    //число на кукле росло кумулятивно (к 3 этажу стартовый щит учитывался трижды).
    //Дальше броню меняют только equip/unEquip (drag.js) и «Сверхзащита» (skillTree.js).
    //V114: у каждого игрока своя кукла и своя броня
    if(next === false) {
        for (let pi = 0; pi < status.players.length; pi++) {
            const P = status.players[pi]
            let length = P.inventory.doll.length
            for (let i = 0; i < length; i++) {
                P.inventory.doll[i] && P.inventory.doll[i].stat === 6 && (P.info.armor += P.inventory.doll[i].statCount)
            }
        }
    }
    //V30: кнопка мини-карты — постоянный UI угла экрана; del() вычищает svgArr[2],
    //поэтому пересоздаётся на каждом этаже здесь
    minimapBtn()
    //V75: ряд иконок-подсказок активных благословений (шкафчик) — тоже пересоздаётся на этаже
    renderBlessHints()
}
//V114: свободная соседняя клетка для спавна второго игрока: 4 стороны, затем диагонали;
//критерий — свободны все 4 cardinal-направления (collision: true = можно идти); в стартовой
//комнате candidate находится с первой попытки, fallback — клетка справа
function spawnCellNear(scene,hx,hy) {
    const offs = [[1,0],[0,1],[-1,0],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]
    for (let i = 0; i < offs.length; i++) {
        const cx = hx + offs[i][0], cy = hy + offs[i][1]
        const x = cx*32, y = cy*32
        if (collision(x,y,scene,0)&&collision(x,y,scene,1)&&collision(x,y,scene,2)&&collision(x,y,scene,3)) return [cx,cy]
    }
    return [hx+1,hy]
}
function createMatrix() {
    let emptyArr = dataGeneric.scenes[status.levelFloor].floor
    let matrixLevel = new Array(dataGeneric.scenes[status.levelFloor].w).fill(null).map(() => new Array(dataGeneric.scenes[status.levelFloor].h).fill(0))
    let length = emptyArr.length
    for (let i = 0; i < length; i++) {
        let length2 = emptyArr[i][0] + emptyArr[i][2]
        let length3 = emptyArr[i][1] + emptyArr[i][3]
        for (let j = emptyArr[i][0]; j < length2; j++) {
            for (let k = emptyArr[i][1]; k < length3; k++) {
                matrixLevel[j][k] = 1
            }
        }
    }
    let length2 = dataGeneric.scenes[status.levelFloor].walls.length
    for (let i = 0; i < length2; i++) {
        if(dataGeneric.scenes[status.levelFloor].walls[i][2] !== 9 &&
            dataGeneric.scenes[status.levelFloor].walls[i][2] !== 12 &&
            dataGeneric.scenes[status.levelFloor].walls[i][2] !== 23 &&
            dataGeneric.scenes[status.levelFloor].walls[i][2] !== 24) {
            let length3 = dataGeneric.scenes[status.levelFloor].walls[i][3] + dataGeneric.scenes[status.levelFloor].walls[i][0]
            let length4 = dataGeneric.scenes[status.levelFloor].walls[i][4] + dataGeneric.scenes[status.levelFloor].walls[i][1]
            for (let j = dataGeneric.scenes[status.levelFloor].walls[i][0]; j < length3; j++) {
                for (let k = dataGeneric.scenes[status.levelFloor].walls[i][1]; k < length4; k++) {
                    matrixLevel[j][k] = 2
                }
            }
        }
    }
    //транспонирование
    matrixLevel = matrixLevel[0].map((_, colIndex) => matrixLevel.map(row => row[colIndex]))
    status.matrixLevel = matrixLevel
}
function buttonInit() {
    document.addEventListener('keydown', function(e){
        if(status.start === 1) {
            //V104: диалог (квест «Сопроводить Волка») — хоткеи панелей глушим целиком
            //(Escape диалог продвигает его собственный слушатель в dialog.js)
            if (dialogIsOpen()) return
            //карта
            if (e.code === 'KeyM') {clickButton(1)}
            //отмена
            //V93: Esc закрывает и полосу кнопок — все кнопочные пути закрытия (clickButton)
            //делают то же (closePanels+topMenuClose); без topMenuClose полоса оставалась
            //нарисованной при panels=0, и автоскрытие (y>100&&panels===10) её не подбирало
            if (e.code === 'Escape') {closePanels(0);topMenuClose();playback(strike[14].vol,0,0,3*status.settings.soundVolume)}
            //экипировка
            if (e.code === 'KeyN') {clickButton(0)}
            //журнал
            if (e.code === 'Comma') {clickButton(2)}
            //настройки
            if (e.code === 'Period') {clickButton(3)}
            //библиотека
            if (e.code === 'Slash') {clickButton(4)}
        }
    })
    document.addEventListener('keyup', function(e){status.start === 1 && status.hero.obj.currentAnim.once !== 1 && (status.hero.obj.stop = 1)})
}
//случайная текстура пола: 1-й этаж (levelFloor 0) — список 1, 2-й (1) — список 2, 3-й (2) —
//список 3, 4-й «Пустота» (3, V65) — список 18–24, дальше — прежняя схема (база+этаж)
let floorTexturesFloor1 = [1,3,5,6,7]
let floorTexturesFloor2 = [2,4,16,17]
let floorTexturesFloor3 = [8,9,10,11,12,13,14,15]
let floorTexturesFloor4 = [18,19,20,21,22,23,24]
function floorTexture(levelFloor,base,plus=0) {
    let pool = levelFloor === 0 ? floorTexturesFloor1 :
               levelFloor === 1 ? floorTexturesFloor2 :
               levelFloor === 2 ? floorTexturesFloor3 :
               levelFloor === 3 ? floorTexturesFloor4 : null
    if(pool) {
        return "./images/dungeon/floor/"+pool[Math.trunc(Math.random()*pool.length)]+".png"
    }
    return "./images/dungeon/floor/"+(base+levelFloor+plus)+".png"
}
//V62: параметр map и map-ветка удалены — createRoom рисует ТОЛЬКО основное поле
//(svgArr[0]/[1], screenPic). Карту строит mapRender.js.
//R3: тайлы/стены/объекты — нативные спрайты мира (worldImage, без шима); стены и
//объекты индексируются по клетке-началу (Map) — раньше на КАЖДЫЙ тайл пола заново
//сканировались все стены и все объекты этажа (квадратичный перебор). Порядок записей
//внутри клетки сохраняется исходный — порядок отрисовки 1:1.
function createRoom (level,i0,tileX,tileY) {
    let layer0 = svgArr[0]
    let layer1 = svgArr[1]
    const roomRec = level.floor[level.roomsArr[i0][0]]
    //индекс стен по клетке-началу (в исходном порядке) + список стен-владений комнаты
    const wallsByCell = new Map()
    const wallsOwned = []
    for (let i3 = 0; i3 < level.walls.length; i3++) {
        const w = level.walls[i3]
        if (w[5] !== undefined && w[5] === level.roomsArr[i0][0]) wallsOwned.push(w)
        const key = w[0] + "," + w[1]
        let arr = wallsByCell.get(key)
        if (!arr) { arr = []; wallsByCell.set(key, arr) }
        arr.push(w)
    }
    //индекс объектов по клетке-началу
    const objectsByCell = new Map()
    for (let i3 = 0; i3 < level.objects.length; i3++) {
        const o = level.objects[i3]
        const key = o[0] + "," + o[1]
        let arr = objectsByCell.get(key)
        if (!arr) { arr = []; objectsByCell.set(key, arr) }
        arr.push(o)
    }
    //стена: спрайт + индекс в screenPic (walls[j][6]) + кэши Z-сортировки/дверей
    const drawWall = (w) => {
        screenPic.push(worldImage(layer1,
            w[0]*tileX,
            w[1]*tileY,
            w[3]*tileX,
            w[4]*tileY,"./images/dungeon/walls/"+(w[2]+status.levelFloor*30)+".png",{"id":screenPic.length+"W"}))
        w[6] = screenPic.length-1
        //V4: стены-накладки (27/28) — в кэш Z-сортировки («;» обязательна: строка
        //начинается с «(» — без неё ASI склеивает с присваиванием выше)
        ;(w[2]===27||w[2]===28)&&wallsOverlay.push(screenPic[screenPic.length-1])
        //V16: двери (9/12/23/24) — в кэш openDoor (не сканировать весь screenPic каждый тик)
        ;(w[2]===9||w[2]===12||w[2]===23||w[2]===24)&&doorPics.push(screenPic[screenPic.length-1])
    }
    const drawObject = (o) => {
        //ловушка (тип 14) рендерится из папки traps — спрайт по ФАЗЕ ловушки
        //(trapSprite.js: 3e/1e в «выключенном» состоянии, 3/4/1 в активном)
        //столб призыва (тип 15, V43) — спец-спрайт fin1/fin2 по состоянию objects[i3][10]
        //статуя героя (тип 16, V49) — спрайты по этажам objects/14|34|54.png (формула 14+этаж*20)
        //алхимический стол (тип 17, V54) — спрайты по этажам objects/15|35|55.png (формула 15+этаж*20)
        //V64: портал (18) и рычаг (19) — спрайты по фазе objects[i3][10] (portalSprite.js)
        //V67: выход с 4 этажа (тип 13 на этаже «Пустота») — спрайт 4exit.png
        //V75: шкафчик с древностями (тип 20) — спрайт 101|101d.png по использованию
        //V83: портал вида 2 (obj[12]=2, 100a.png) и кнопка загадки (21, push0/push1) —
        //там же, в portalSprite.js
        let objSrc = o[2] === 13 && status.levelFloor === 3 ?
            "./images/dungeon/objects/4exit.png" :
            o[2] === 14 ?
            trapSpriteSrc(o) :
            o[2] === 18 || o[2] === 19 || o[2] === 21 ?
                portalSpriteSrc(o) :
            o[2] === 22 ?
                cupSpriteSrc(o) :
            o[2] === 15 ?
                "./images/dungeon/objects/fin"+(o[10]||1)+".png" :
                o[2] === 16 ?
                    "./images/dungeon/objects/"+(14+status.levelFloor*20)+".png" :
                    o[2] === 17 ?
                        "./images/dungeon/objects/"+(15+status.levelFloor*20)+".png" :
                        o[2] === 20 ?
                            "./images/dungeon/objects/"+(o[7] ? "101d" : "101")+".png" :
                            "./images/dungeon/objects/"+(o[2]+status.levelFloor*20)+".png"
        //столб 32×81 рисуется 1:1 с якорем низа в клетку объекта (логика — клетка 1×1)
        let isPillar = o[2] === 15
        //статуя (сетка 1×2) рисуется 1:1 натуральной высоты (65/69/48) с якорем низа
        //в 2 клетки — спрайт 48px третьего этажа нельзя растягивать до 64
        let isStatue = o[2] === 16
        let statueH = isStatue ? [65,69,48][status.levelFloor] : 0
        //V64: портал 64×84 рисуется 1:1 с якорем низа и центром по клетке
        //(логика — клетка 1×1); рычаг 32×32 идёт по обычной ветке 1×1
        let isPortalObj = o[2] === 18
        //V67: выход с 4 этажа 96×128 рисуется 1:1 с якорем низа и центром по
        //логической клетке 2×2 (та же геометрия, что у спавна в voidBoss.js)
        let isExit4 = o[2] === 13 && status.levelFloor === 3
        //V75: шкафчик 64×42 рисуется 1:1 с якорем низа и центром по клетке
        //(логика — клетка 1×1, как у портала)
        let isAncient = o[2] === 20
        screenPic.push(worldImage(layer1,
            isExit4 ? o[0]*tileX + tileX - 48 :
            isAncient ? o[0]*tileX + tileX/2 - 32 :
            isPortalObj ? o[0]*tileX + tileX/2 - 64/2 : o[0]*tileX,
            isPillar ? o[1]*tileY + tileY - 81 :
                isPortalObj ? o[1]*tileY + tileY - 84 :
                isAncient ? o[1]*tileY + tileY - 42 :
                isStatue ? o[1]*tileY + 2*tileY - statueH :
                isExit4 ? o[1]*tileY + 2*tileY - 128 : o[1]*tileY,
            isPillar ? 32 : isPortalObj ? 64 : isStatue ? 32 : isExit4 ? 96 : isAncient ? 64 : o[3]*tileX,
            isPillar ? 81 : isPortalObj ? 84 : isStatue ? statueH : isExit4 ? 128 : isAncient ? 42 : o[4]*tileY,objSrc,{"id":screenPic.length+"O"}))
        o[6] = screenPic.length-1
        //V80: наземная тень под объектом (тип 14 — ловушка-плитка: лежит на полу,
        //тень не нужна; V97: чаша 22 — переезжает при перемешивании, статичная тень
        //осталась бы на старом месте). При выключенных тенях хост запоминает groundShadow.js
        o[2] !== 14 && o[2] !== 22 && objectShadow(screenPic[screenPic.length-1])
    }
    //пол комнаты + стены/объекты в клетках
    for (let i = 0; i < roomRec[2]; i++) {
        for (let i2 = 0; i2 < roomRec[3] + 1; i2++) {
            const cx = roomRec[0] + i
            const cy = roomRec[1] + i2
            screenPic.push(worldImage(layer0,
                cx*tileX,
                cy*tileY,
                tileX,tileY,floorTexture(status.levelFloor,roomRec[4]),{"opacity":"0.7"}))
            const cellWalls = wallsByCell.get(cx + "," + cy)
            if (cellWalls) for (let k = 0; k < cellWalls.length; k++) drawWall(cellWalls[k])
            const cellObjs = objectsByCell.get(cx + "," + cy)
            if (cellObjs) for (let k = 0; k < cellObjs.length; k++) drawObject(cellObjs[k])
        }
    }
    //R3: стены-владения комнаты ([5]===floorIdx), начало которых ВНЕ диапазона тайлов
    //(ряд над верхом комнаты и т.п.) — РОВНО ОДИН РАЗ каждая. Раньше этот цикл был
    //внутри тайлового и рисовал их заново на каждый тайл: сотни невидимых копий одного
    //спрайта (замер 2026-09-17: 124 спрайта слоя объектов из 137 — копии шести стен).
    //Стены с началом внутри диапазона уже нарисованы циклом клеток (прежний цикл A).
    for (let k = 0; k < wallsOwned.length; k++) {
        const w = wallsOwned[k]
        if (w[0] >= roomRec[0] && w[0] < roomRec[0] + roomRec[2] &&
            w[1] >= roomRec[1] && w[1] <= roomRec[1] + roomRec[3]) continue
        drawWall(w)
    }
}
export {sceneGenerate,createRoom,dataGeneric,buttonInit,floorTexture,createMatrix}