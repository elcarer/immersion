import * as basicData from "../scripts/data.js"
import { status } from "../scripts/start.js"
import { dataGeneric,createRoom,floorTexture } from "../scripts/sceneGenerate.js"
import { collision } from "../scripts/collision.js"
import { svgArr,image, moveSprite, rectPos } from "../scripts/svg.js"
import { screenPic,objectValues,wallsOverlay,acidArr,doorPics } from "../scripts/del.js"
import { openRoom } from "../scripts/openRoom.js"
import { useObject,stopUseObject } from "../scripts/useObject.js"
//V62: импорт map.js (mapTemp) удалён вместе с map-веткой createCorridor — отрисовка
//карты переехала в mapRender.js
import { checkCollision } from "../scripts/damage.js"
import { dashPress,updateRazgon,wingsActive,dashInvulnActive } from "../scripts/valkyrie.js"
//V49 баф скорости (статуя): перемещение героя ×1.5
import { buffActive } from "../scripts/buffFx.js"
//V43: попытка призыва босса 3 этажа при открытии новой комнаты (все столбы могли
//уже стоять в состоянии 2 от генерации — тогда последнее условие выполняется именно здесь)
import { tryFinSummon } from "../scripts/finPillars.js"
//V56: сет «Доблестный небожитель» (6 надетых): скорость перемещения героя ×1.05
import { setHeroSpeedMult } from "../scripts/sets.js"
//V75: благословения шкафчика — Сын ветра +10%, Громила/Заучка по -10% к скорости перемещения
import { blessSpeedMult } from "../scripts/blessFx.js"
//V90: в момент НАЧАЛА движения героя полоса верхнего меню убирается (кроме вспышки левелапа)
import { topMenuClose } from "../scripts/topMenu.js"
import { lvlFlashActive } from "../scripts/lvlFlashFx.js"

let pressedKeys = new Set();
//последнее нажатое направление движения (0-верх,1-низ,2-лево,3-право) — для выбора анимации на диагоналях
let lastDir = 1
//предыдущая маска кнопок крестовины геймпада (биты: 1-верх,2-низ,4-лево,8-право) для edge-детекта
let padMaskPrev = 0
//V90: двигалась ли героиня в прошлом тике — детект НАЧАЛА движения (курсор/полоса меню)
let wasMoving = false
document.addEventListener('keydown', (event) => {pressedKeys.add(event.code);
    //автоповтор клавиатуры не считается новым нажатием (иначе зажатая кнопка триггерила бы двойное нажатие рывка)
    if(event.repeat) return
    if(event.code==="ArrowUp"||event.code==="KeyW") {lastDir = 0; dashPress(0)}
    if(event.code==="ArrowDown"||event.code==="KeyS") {lastDir = 1; dashPress(1)}
    if(event.code==="ArrowLeft"||event.code==="KeyA") {lastDir = 2; dashPress(2)}
    if(event.code==="ArrowRight"||event.code==="KeyD") {lastDir = 3; dashPress(3)}
});
//V90: возврат курсора на keyup убран — курсор появляется ТОЛЬКО при движении мыши
//(gameLoop, блок pendingMouse), а прячется в heroMove на всё время движения героя
document.addEventListener('keyup', (event) => {pressedKeys.delete(event.code)});
//V17: при потере фокуса с зажатой клавишей keyup может не прийти — «призрачная»
//клавиша вечно держала героя в движении, а курсор оставался скрытым 'none'
//(до V16 его восстанавливал каждый mousemove, маскируя проблему). Сбрасываем на blur;
//возврат курсора здесь — страховка, обычно его возвращает движение мыши.
window.addEventListener('blur', () => {
    pressedKeys.clear()
    padMaskPrev = 0
    document.body.style.cursor = 'url("./images/UI/cur.png"), auto'
});
//V16: атрибуты img героя (href/times/width/height) пишем ОДИН раз в конце heroMove
//и только при реальной смене анимации — раньше каждая ветка движения перезаписывала
//их каждый тик (5 DOM-записей на тик бега).
let lastHeroAnim = null
function syncHeroAnim(hero) {
    const anim = hero.currentAnim
    if (anim !== lastHeroAnim) {
        lastHeroAnim = anim
        hero.img.setAttribute("href", anim.img)
        hero.img.setAttribute("times", anim.times)
        hero.img.setAttribute("width", anim.w)
        hero.img.setAttribute("height", anim.h)
    }
}
//последняя клетка героя — комнаты/коридоры появляются только при переходе в новую клетку
let lastHeroCellX = -1
let lastHeroCellY = -1
function heroMove () {
    let left, right, up, down
    if(navigator.getGamepads()[0]) {
        let pad = navigator.getGamepads()[0]
        let but = pad.buttons
        left = but[14] && but[14].pressed
        right = but[15] && but[15].pressed    
        up = but[12] && but[12].pressed
        down = but[13] && but[13].pressed
        //направление взгляда — по последней НАЖАТОЙ кнопке крестовины (edge-детект по маске)
        let padMask = (up?1:0)+(down?2:0)+(left?4:0)+(right?8:0)
        if(padMask !== padMaskPrev) {
            up && !(padMaskPrev&1) && (lastDir = 0)
            down && !(padMaskPrev&2) && (lastDir = 1)
            left && !(padMaskPrev&4) && (lastDir = 2)
            right && !(padMaskPrev&8) && (lastDir = 3)
            padMaskPrev = padMask
        }
        !left && !right && !up && !down && status.start === 1 && status.hero.obj.currentAnim.once !== 1 && (status.hero.obj.stop = 1)
    }
        let moveSpeed = status.moveSpeed + status.moveSpeed*(status.info.stats[3].dops[0].value2.slice(0,-1)/100)
        //увеличение скорости в Скрытности с Теневым скольжением
        status.info.multSpeed > 1 && status.info.invisibleTime > 0 && (moveSpeed *= status.info.multSpeed)
        //Разгон валькирии: +5% за каждые 2с непрерывного бега, макс +25%
        status.info.razgonBonus > 0 && (moveSpeed *= 1 + status.info.razgonBonus/100)
        //V56: сет «Доблестный небожитель» (6 надетых): скорость перемещения ×1.05
        moveSpeed *= setHeroSpeedMult()
        //V75: благословения шкафчика — Сын ветра +10%, Громила/Заучка по -10%
        moveSpeed *= blessSpeedMult()
        //V49 баф скорости статуи: перемещение ×1.5 (поверх остальных множителей)
        buffActive(1) && (moveSpeed *= 1.5)
        let hero = status.hero.obj
        let data = dataGeneric
        let num = status.levelFloor
        //V16: координаты из кэша rect (rectPos) вместо animVal-чтений
        let heroPos = rectPos(hero.rect)
        let x = heroPos[0]
        let y = heroPos[1]
    //во время рывка валькирии обычное движение не выполняется (героиню двигает valkyrieTick);
    //V34 «очарование» суккуба: герой теряет управление движением — ввод игнорируется
    //(вся забота ниже — комнаты/кислота/синхронизация status.hero.x — продолжается)
    if (!status.info.dash && !status.info.charm) {
    if(collision(x,y,data.scenes[num],0)&&!pressedKeys.has('ArrowDown')&&!pressedKeys.has('KeyS')&&(up||pressedKeys.has('ArrowUp')||pressedKeys.has('KeyW'))&&(!pressedKeys.has('ArrowRight')&&!pressedKeys.has('ArrowLeft')&&!pressedKeys.has('KeyA')&&!pressedKeys.has('KeyD'))) {
        moveSprite(hero.img, 0, -moveSpeed)
        hero.currentAnim = basicData.data.heroes[status.hero.class].anims[0].move[0]
        status.hero.direction = 0
        hero.stop = 0
        status.hero.waitTime = 0
    }
    else if(collision(x,y,data.scenes[num],1)&&!pressedKeys.has('ArrowLeft')&&!pressedKeys.has('KeyA')&&(right||pressedKeys.has('ArrowRight')||pressedKeys.has('KeyD'))&&(!pressedKeys.has('ArrowUp')&&!pressedKeys.has('ArrowDown')&&!pressedKeys.has('KeyS')&&!pressedKeys.has('KeyW'))) {
        moveSprite(hero.img, moveSpeed, 0)
        hero.currentAnim = basicData.data.heroes[status.hero.class].anims[0].move[3]
        status.hero.direction = 3
        hero.stop = 0
        status.hero.waitTime = 0
    }
    else if(collision(x,y,data.scenes[num],2)&&!pressedKeys.has('ArrowUp')&&!pressedKeys.has('KeyW')&&(down||pressedKeys.has('ArrowDown')||pressedKeys.has('KeyS'))&&(!pressedKeys.has('ArrowRight')&&!pressedKeys.has('ArrowLeft')&&!pressedKeys.has('KeyA')&&!pressedKeys.has('KeyD'))) {
        moveSprite(hero.img, 0, moveSpeed)
        hero.currentAnim = basicData.data.heroes[status.hero.class].anims[0].move[1]
        status.hero.direction = 1
        hero.stop = 0
        status.hero.waitTime = 0
    }
    else if(collision(x,y,data.scenes[num],3)&&!pressedKeys.has('ArrowRight')&&!pressedKeys.has('KeyD')&&(left||pressedKeys.has('ArrowLeft')||pressedKeys.has('KeyA'))&&(!pressedKeys.has('ArrowUp')&&!pressedKeys.has('ArrowDown')&&!pressedKeys.has('KeyS')&&!pressedKeys.has('KeyW'))) {
        moveSprite(hero.img, -moveSpeed, 0)
        hero.currentAnim = basicData.data.heroes[status.hero.class].anims[0].move[2]
        status.hero.direction = 2
        hero.stop = 0
        status.hero.waitTime = 0
    }
    else if (collision(x,y,data.scenes[num],4)&&(up||pressedKeys.has('ArrowUp')||pressedKeys.has('KeyW'))&&(right||pressedKeys.has('ArrowRight')||pressedKeys.has('KeyD'))) {
        //V15: движение через moveSprite — rect и img.x с сохранением кадрового смещения
        moveSprite(hero.img, moveSpeed*0.8, -moveSpeed*0.8)
        let moveAnim = basicData.data.heroes[status.hero.class].anims[0].move[lastDir]
        hero.currentAnim = moveAnim
        status.hero.direction = lastDir
        hero.stop = 0
        status.hero.waitTime = 0
    }
    //скольжение 1
    else if ((up||pressedKeys.has('ArrowUp')||pressedKeys.has('KeyW'))&&(right||pressedKeys.has('ArrowRight')||pressedKeys.has('KeyD'))) {
        if(collision(x,y,data.scenes[num],0) && !collision(x,y,data.scenes[num],1)) {
            moveSprite(hero.img, 0, -moveSpeed)
            hero.currentAnim = basicData.data.heroes[status.hero.class].anims[0].move[0]
            status.hero.direction = 0
            hero.stop = 0
            status.hero.waitTime = 0
        }
        else if(!collision(x,y,data.scenes[num],0) && collision(x,y,data.scenes[num],1)) {
            moveSprite(hero.img, moveSpeed, 0)
            hero.currentAnim = basicData.data.heroes[status.hero.class].anims[0].move[3]
            status.hero.direction = 3
            hero.stop = 0
            status.hero.waitTime = 0
        }
    }
    else if (collision(x,y,data.scenes[num],5)&&(up||pressedKeys.has('ArrowUp')||pressedKeys.has('KeyW'))&&(left||pressedKeys.has('ArrowLeft')||pressedKeys.has('KeyA'))) {
        moveSprite(hero.img, -moveSpeed*0.8, -moveSpeed*0.8)
        let moveAnim = basicData.data.heroes[status.hero.class].anims[0].move[lastDir]
        hero.currentAnim = moveAnim
        status.hero.direction = lastDir
        hero.stop = 0
        status.hero.waitTime = 0
    }
    //скольжение 2
    else if ((up||pressedKeys.has('ArrowUp')||pressedKeys.has('KeyW'))&&(left||pressedKeys.has('ArrowLeft')||pressedKeys.has('KeyA'))) {
        if(collision(x,y,data.scenes[num],0) && !collision(x,y,data.scenes[num],3)) {
            moveSprite(hero.img, 0, -moveSpeed)
            hero.currentAnim = basicData.data.heroes[status.hero.class].anims[0].move[0]
            status.hero.direction = 0
            hero.stop = 0
            status.hero.waitTime = 0
        }
        else if(!collision(x,y,data.scenes[num],0) && collision(x,y,data.scenes[num],3)) {
            moveSprite(hero.img, -moveSpeed, 0)
            hero.currentAnim = basicData.data.heroes[status.hero.class].anims[0].move[2]
            status.hero.direction = 2
            hero.stop = 0
            status.hero.waitTime = 0
        }
    }
    else if (collision(x,y,data.scenes[num],6)&&(down||pressedKeys.has('ArrowDown')||pressedKeys.has('KeyS'))&&(right||pressedKeys.has('ArrowRight')||pressedKeys.has('KeyD'))) {
        moveSprite(hero.img, moveSpeed*0.8, moveSpeed*0.8)
        let moveAnim = basicData.data.heroes[status.hero.class].anims[0].move[lastDir]
        hero.currentAnim = moveAnim
        status.hero.direction = lastDir
        hero.stop = 0
        status.hero.waitTime = 0
    }
    //скольжение 3
    else if ((down||pressedKeys.has('ArrowDown')||pressedKeys.has('KeyS'))&&(right||pressedKeys.has('ArrowRight')||pressedKeys.has('KeyD'))) {
        if(collision(x,y,data.scenes[num],2) && !collision(x,y,data.scenes[num],1)) {
            moveSprite(hero.img, 0, moveSpeed)
            hero.currentAnim = basicData.data.heroes[status.hero.class].anims[0].move[1]
            status.hero.direction = 1
            hero.stop = 0
            status.hero.waitTime = 0
        }
        else if(!collision(x,y,data.scenes[num],2) && collision(x,y,data.scenes[num],1)) {
            moveSprite(hero.img, moveSpeed, 0)
            hero.currentAnim = basicData.data.heroes[status.hero.class].anims[0].move[3]
            status.hero.direction = 3
            hero.stop = 0
            status.hero.waitTime = 0
        }
    }
    else if (collision(x,y,data.scenes[num],7)&&(down||pressedKeys.has('ArrowDown')||pressedKeys.has('KeyS'))&&(left||pressedKeys.has('ArrowLeft')||pressedKeys.has('KeyA'))) {
        moveSprite(hero.img, -moveSpeed*0.8, moveSpeed*0.8)
        let moveAnim = basicData.data.heroes[status.hero.class].anims[0].move[lastDir]
        hero.currentAnim = moveAnim
        status.hero.direction = lastDir
        hero.stop = 0
        status.hero.waitTime = 0
    }
    //скольжение 4
    else if ((down||pressedKeys.has('ArrowDown')||pressedKeys.has('KeyS'))&&(left||pressedKeys.has('ArrowLeft')||pressedKeys.has('KeyA'))) {
        if(collision(x,y,data.scenes[num],2) && !collision(x,y,data.scenes[num],3)) {
            moveSprite(hero.img, 0, moveSpeed)
            hero.currentAnim = basicData.data.heroes[status.hero.class].anims[0].move[1]
            status.hero.direction = 1
            hero.stop = 0
            status.hero.waitTime = 0
        }
        else if(!collision(x,y,data.scenes[num],2) && collision(x,y,data.scenes[num],3)) {
            moveSprite(hero.img, -moveSpeed, 0)
            hero.currentAnim = basicData.data.heroes[status.hero.class].anims[0].move[2]
            status.hero.direction = 2
            hero.stop = 0
            status.hero.waitTime = 0
        }
    }
    }
    //V16: атрибуты img синхронизируем один раз за тик и только при смене анимации
    syncHeroAnim(hero)
    //чек на новую комнату — только при переходе в новую клетку (раньше сканировался
    //весь список комнат/коридоров каждый тик)
    const cellX = Math.trunc((x + 16) / 32)
    const cellY = Math.trunc((y + 50) / 32)
    if (cellX !== lastHeroCellX || cellY !== lastHeroCellY) {
        lastHeroCellX = cellX
        lastHeroCellY = cellY
        checkNewRoom (data,num,x,y)
    }
    //V16: позицию после движения читаем из кэша (rectPos), двинулась ли героиня — одним сравнением
    const posAfter = rectPos(hero.rect)
    const moved = posAfter[0] !== x || posAfter[1] !== y
    //Разгон: считаем, двигалась ли героиня в этом тике (по смене координат rect)
    updateRazgon(moved)
    //V90: курсор прячется на всё время движения героя; возвращает его ТОЛЬКО движение
    //мыши. Прежние «прятать на keydown / возвращать на keyup» давали мелькание курсора
    //при отпускании клавиш без мыши. Запись в style — один раз на начало движения
    //(guard по текущему значению, без писанины в DOM каждый тик).
    moved && document.body.style.cursor !== 'none' && (document.body.style.cursor = 'none')
    //V90: в момент НАЧАЛА движения героя полоса верхнего меню убирается (мешала обзору,
    //пока курсор стоял в верхней зоне). Меню, поднятое вспышкой левелапа, не трогаем —
    //оно закроется само (lvlFlashTick); закрытое меню при желании снова откроется
    //наведением мыши на верх экрана.
    !wasMoving && moved && status.panels === 10 && !lvlFlashActive() && topMenuClose()
    wasMoving = moved
    //скролл экрана
    //V31: мёртвая зона слежения масштабируется под ОКНО камеры: при зуме видимая
    //область уже (1920/zoom × 1080/zoom). Прежние литералы 500/1420/450/630 были
    //зеркальными маржами 500/450 px от краёв кадра 1920×1080 — соотношение сохранено.
    const vbCam = svgArr[0].viewBox.animVal
    const camMX = vbCam.width * (500 / 1920)
    const camMY = vbCam.height * (450 / 1080)
        x < vbCam.x + camMX && scroll(0)
        x > vbCam.x + vbCam.width - camMX && scroll(1)
        y < vbCam.y + camMY && scroll(2)
        y > vbCam.y + vbCam.height - camMY && scroll(3)
    function scroll(orient) {
        let lengthSvg = svgArr.length
        //V31: размер окна камеры берём из viewBox (зависит от зума, zoomFx.js), не литерал
        const camW = svgArr[0].viewBox.animVal.width
        const camH = svgArr[0].viewBox.animVal.height
        for(let i = 0; i < lengthSvg; i++) {
            if (i !== lengthSvg-1) {
                //V16: не пишем тот же viewBox повторно каждый тик у края экрана —
                //сравниваем с текущим значением (раньше setAttribute шёл каждый тик)
                let nx = svgArr[i].viewBox.animVal.x
                let ny = svgArr[i].viewBox.animVal.y
                orient === 2&&(ny -= moveSpeed)
                orient === 1&&(nx += moveSpeed)
                orient === 3&&(ny += moveSpeed)
                orient === 0&&(nx -= moveSpeed)
                if (nx !== svgArr[i].viewBox.animVal.x || ny !== svgArr[i].viewBox.animVal.y) {
                    svgArr[i].setAttribute("viewBox", nx+" "+ny+" "+camW+" "+camH)
                }
            }   
        }
    }
    //детект обьекта
    checkObject (data.scenes[num],x,y)
    //V16: кислота (урон/время жизни) проверяется каждый тик, Z-сортировка стен/объектов —
    //только когда героиня реально сдвинулась (отношения перекрытий не меняются на месте).
    //Во время рывка валькирии героиню двигает valkyrieTick ДО heroMove — сортируем и тогда.
    acidTick(hero)
    ;(moved || status.info.dash) && checkZOrder (hero,1)
    status.hero.x = posAfter[0]
    status.hero.y = posAfter[1]
}
function checkObject (level,x,y) {
    x+=16
    y+=50
    let find = 0
    let i0Max = level.objects.length
    for (let i0 = 0; i0 < i0Max; i0++) {
        let obj = level.objects[i0]
        let hit =
            x>obj[0]*32-32&&
            y>obj[1]*32-32&&
            x<obj[0]*32+obj[3]*32+32&&
            y<obj[1]*32+obj[4]*32+32
        //V43: переключённый столб (тип 15), V54: алхимический стол (тип 17) и V64: портал (18)/
        //рычаг (19) «перезаряжаются», пока герой не выйдет из зоны взаимодействия (obj[11]) —
        //иначе стояние рядом щёлкало бы бесконечно. V75: шкафчик с древностями (тип 20) — так же.
        //V83: кнопка загадки (21) — так же
        //(! строка не может начинаться с «(» — после безточного `let hit = …+32` ASI склеивает
        //её в «вызов» выражения: «32 is not a function»)
        obj[11] === 1 && !hit && (obj[2] === 15 || obj[2] === 17 || obj[2] === 18 || obj[2] === 19 || obj[2] === 20 || obj[2] === 21) && (obj[11] = 0)
        if (!hit) {continue}
        //стоя НА взведённой ловушке (тип 14) обезвреживание не запускается — только с соседней клетки.
        //x,y здесь уже смещены на +16/+50 от rect героя, поэтому хитбокс ног = x-3, y-13, 14x14
        if(obj[2] === 14 && obj[7] !== 1 && checkCollision(x-3,obj[0]*32,14,32,y-13,obj[1]*32,14,32)) {
            status.use === 1 && stopUseObject()
            find = 1
            continue
        }
        //V64: портал (18) и рычаг (19) взаимодействию поддаются только в АКТИВНОЙ фазе
        //(obj[10]===1); в «выключенной» — мёртвый объект (решение по ТЗ).
        //V75: шкафчик (20) с взведённым obj[11] (меню открыто/закрыто без выбора) — мимо.
        //V83: кнопка загадки (21) с взведённым obj[11] — мимо; интерактивна в ОБЕИХ фазах
        if (obj[5] === undefined && obj[7] !== 1 && !((obj[2] === 15 || obj[2] === 17 || obj[2] === 20 || obj[2] === 21) && obj[11] === 1) && !((obj[2] === 18 || obj[2] === 19) && obj[10] !== 1) && status.use === 0) {
        status.use = 1
        useObject(obj,i0)
        }
        find = 1
    }
    if (status.use === 1&&find === 0)
    {
        status.use = 0
        stopUseObject()
    }
}
function checkNewRoom (data,num,x,y) {
    x+=16
    y+=50
    let level = data.scenes[num]
    let i0Max = level.roomsArr.length
    for (let i0 = 0; i0 < i0Max; i0++) {
        if (level.roomsArr[i0][3] !==1 &&
            x+(status.info.viewus*32)>level.floor[level.roomsArr[i0][0]][0]*32&&
            y+(status.info.viewus*32)>level.floor[level.roomsArr[i0][0]][1]*32&&
            x-(status.info.viewus*32)<level.floor[level.roomsArr[i0][0]][0]*32+level.floor[level.roomsArr[i0][0]][2]*32&&
            y-(status.info.viewus*32)<level.floor[level.roomsArr[i0][0]][1]*32+level.floor[level.roomsArr[i0][0]][3]*32
        ) {
            createRoom (level,i0,32,32)
            level.roomsArr[i0][3] = 1
            openRoom(level.roomsArr[i0])
            tryFinSummon()
            svgArr[1].append(status.hero.obj.img)
            break
        }
    }
    let lengthFloor = level.floor.length
    for (let i = 0; i < lengthFloor; i++) {
        if (level.floor[i][2]===1&&level.floor[i][7] !== 1&&
            x>level.floor[i][0]*32-64&&
            y>level.floor[i][1]*32-64&&
            x<level.floor[i][0]*32+32+64&&
            y<level.floor[i][1]*32+32+64) {
            createCorridor(level.floor[i],32,32,level)
            svgArr[1].append(status.hero.obj.img)
            break
        }
    }
}
//V21: тайл коридора ложится ПОВЕРХ уже нарисованного пола комнаты, если клетка коридора
//покрыта полом комнаты (createRoom рисует пол комнаты как w×(h+1) — цикл строк [3]+1, т.е.
//на один ряд ниже прямоугольника комнаты). Возвращает true, если клетка уже на полу комнаты.
function corridorOnRoomFloor(level, cx, cy) {
    let n = level.floor.length
    for (let j = 0; j < n; j++) {
        const f = level.floor[j]
        //[2]>1 — комнаты (у коридоров [2]===1); строки комнаты рисуются до f[1]+f[3] включительно
        if (f[2] > 1 && cx >= f[0] && cx < f[0] + f[2] && cy >= f[1] && cy <= f[1] + f[3]) return true
    }
    return false
}
//V62: параметр map и map-ветка удалены — createCorridor рисует ТОЛЬКО коридор основного
//поля (svgArr[0]/[1], screenPic) и выставляет флаги открытости клеток [7]. Карту строит
//mapRender.js (коридоры — прямые сегменты-прямоугольники вместо потайловых спрайтов).
function createCorridor (cell,tileX,tileY,level) {
    let conteiner = screenPic
    let layer0 = svgArr[0]
    let layer1 = svgArr[1]
    let lengthFloor = level.floor.length
    for (let i = 0; i < lengthFloor; i++) {
        //пол коридора рисуем ТОЛЬКО для клеток коридора ([2]===1): у комнат [5]/[6] — это
        //координаты ЦЕНТРА, и если центр комнаты совпадал с парой индексов (room1,room2),
        //тайл коридора рисовался ПОВЕРХ тайла комнаты (двойное наложение 0.7+0.7 — полоса)
        if (level.floor[i][2]===1&&level.floor[i][5]===cell[5]&&
            level.floor[i][6]===cell[6]) {
                //пол коридора НЕ рисуем там, где уже есть пол комнаты (createRoom +
                //его ряд [3]+1 + коридор под комнатой — двойной тайл, полоса по нижнему краю)
                !corridorOnRoomFloor(level,level.floor[i][0],level.floor[i][1])&&conteiner.push(image(layer0,
                    level.floor[i][0]*tileX,
                    level.floor[i][1]*tileY,
                    tileX,tileY,floorTexture(status.levelFloor,level.floor[i][4],1),{"opacity":"0.7"}))
            level.floor[i][7] = 1
            let lengthWalls = level.walls.length
            for (let i3 = 0; i3 < lengthWalls; i3++) {
                if (level.walls[i3][0]===level.floor[i][0]&&
                    level.walls[i3][1]===level.floor[i][1]) {
                        conteiner.push(image(layer1,
                    level.walls[i3][0]*tileX,
                    level.walls[i3][1]*tileY,
                    level.walls[i3][3]*tileX,
                    level.walls[i3][4]*tileY,"./images/dungeon/walls/"+(level.walls[i3][2]+status.levelFloor*30)+".png"))
                    //V4: стены-накладки (27/28) — в кэш Z-сортировки («;» обязательна:
                    //строка начинается с «(» — без неё ASI склеивает с push выше)
                    ;(level.walls[i3][2]===27||level.walls[i3][2]===28)&&wallsOverlay.push(conteiner[conteiner.length-1])
                    //V16: двери — в кэш openDoor
                    ;(level.walls[i3][2]===9||level.walls[i3][2]===12||level.walls[i3][2]===23||level.walls[i3][2]===24)&&doorPics.push(conteiner[conteiner.length-1])
                }
            }
            let lengthWalls2 = level.walls.length
            for (let i4 = 0; i4 < lengthWalls2; i4++) {
                if (level.walls[i4][5] !== undefined && level.walls[i4][5] === i) {
                    conteiner.push(image(layer1,
                        level.walls[i4][0]*tileX,
                        level.walls[i4][1]*tileY,
                        level.walls[i4][3]*tileX,
                        level.walls[i4][4]*tileY,"./images/dungeon/walls/"+(level.walls[i4][2]+status.levelFloor*30)+".png"))
                    ;(level.walls[i4][2]===27||level.walls[i4][2]===28)&&wallsOverlay.push(conteiner[conteiner.length-1])
                    ;(level.walls[i4][2]===9||level.walls[i4][2]===12||level.walls[i4][2]===23||level.walls[i4][2]===24)&&doorPics.push(conteiner[conteiner.length-1])
                }
            }
        }
    }
}
function checkZOrder (obj,hero = 0) {
    let rect1 = obj.rect
    let length = objectValues.length
    for (let i = 0; i < length; i++) {
        if (objectValues[i].img !== obj.img && svgArr[1].contains(objectValues[i].img)) {
            let rect2 = objectValues[i].rect
            //V16: координаты из кэша (rectPos) — animVal не читаем в цикле
            let r2 = rectPos(rect2)
            if (checkCollision(rect1.x.animVal.value,r2[0],rect1.width.animVal.value,rect2.width.animVal.value,rect1.y.animVal.value,r2[1],rect1.height.animVal.value,rect2.height.animVal.value)) {
                if (r2[1]+rect2.height.animVal.value < rect1.y.animVal.value+rect1.height.animVal.value) {
                    svgArr[1].append(obj.img)
                }
            }
        }
    }
    //V4: стены-накладки (27/28 на 1-м этаже, 57/58 на 2-м) и кислота — из кэшей,
    //а не полным проходом по screenPic (там тысячи плиток, и на каждый вызов читался href.animVal)
    let lengthWalls = wallsOverlay.length
    for (let i = 0; i < lengthWalls; i++) {
        let wall = wallsOverlay[i]
        if (svgArr[1].contains(wall)&&checkCollision(rect1.x.animVal.value,wall.x.animVal.value,rect1.width.animVal.value,wall.width.animVal.value,rect1.y.animVal.value,wall.y.animVal.value,rect1.height.animVal.value,wall.height.animVal.value)) {
            if (wall.y.animVal.value+wall.height.animVal.value < obj.rect.y.animVal.value+obj.rect.height.animVal.value) {
                svgArr[1].prepend(wall)
            } else {
                svgArr[1].append(wall)
            }
        }
    }
}
//V16: кислота вынесена из checkZOrder в отдельный потиковый вызов: урон героине и
//время жизни должны тикать КАЖДЫЙ кадр, даже когда героиня стоит на месте (checkZOrder
//теперь запускается только при движении)
function acidTick(hero) {
    let rect1 = hero.rect
    let lengthAcid = acidArr.length
    for (let i = 0; i < lengthAcid; i++) {
        let acid = acidArr[i]
        !acid.time ? acid.time = 1 : acid.time++
        if(acid.time >= 20 && acid.time%20 === 0 && checkCollision(rect1.x.animVal.value,acid.x.animVal.value,rect1.width.animVal.value,acid.width.animVal.value,rect1.y.animVal.value,acid.y.animVal.value,rect1.height.animVal.value,acid.height.animVal.value)) {
            //Крылья валькирии / неуязвимость после рывка: иммунитет к кислоте
            !wingsActive() && !dashInvulnActive() && (status.info.poison++)
        }
        //V46b: «Выносливость» сокращает время жизни кислотных луж (100 тиков) —
        //меньше тиков контакта, меньше пополнений накопленного яда
        if(acid.time >= Math.max(1, 100 - Math.trunc(100 * parseInt(status.info.stats[2].dops[2].value2.slice(0,-1))/100))) {
            acid.remove()
            let oi = screenPic.indexOf(acid)
            //V55: вместо splice — «надгробие» (null). Индексы screenPic (objects[i][6],
            //walls[j][6]) обязаны оставаться неизменными весь этаж: splice сдвигал все
            //последующие индексы, и destroyObjects по устаревшему objects[i][6] удалял
            //СПРАЙТ ПЛИТКИ ПОЛА вместо спрайта разрушенного атакой объекта (чёрный квадрат)
            oi !== -1 && (screenPic[oi] = null)
            acidArr.splice(i,1)
            i--
            lengthAcid--
        }
    }
}
export {heroMove,createCorridor,checkZOrder,pressedKeys}