import * as basicData from "../scripts/data.js"
import { status } from "../scripts/start.js"
import { dataGeneric,createRoom,floorTexture } from "../scripts/sceneGenerate.js"
import { collision } from "../scripts/collision.js"
import { svgArr,image,worldImage, moveSprite, rectPos } from "../scripts/svg.js"
import { screenPic,objectValues,wallsOverlay,acidArr,doorPics } from "../scripts/del.js"
import { openRoom } from "../scripts/openRoom.js"
import { useObject,stopUseObject } from "../scripts/useObject.js"
//V97: чаши «напёрстков» (22) интерактивны только в фазе выбора (portalFx.shellCupReady)
import { shellCupReady } from "../scripts/portalFx.js"
//V62: импорт map.js (mapTemp) удалён вместе с map-веткой createCorridor — отрисовка
//карты переехала в mapRender.js
import { checkCollision } from "../scripts/damage.js"
import { dashPress,updateRazgon,wingsActive,dashInvulnActive } from "../scripts/valkyrie.js"
//R2.6: единый писатель камеры (плавное следование в scroll) — см. комментарий в scroll
import { setWorldViewBox,coopMode,coopCameraTick } from "../scripts/zoomFx.js"
//V49 баф скорости (статуя): перемещение героя ×1.5
import { buffActive } from "../scripts/buffFx.js"
//V111: квест «Погоня за пламенем» — свежая клетка коридора получает лаву (режим «лава в коридорах»)
import { flameQuestCorridorOpen } from "../scripts/flameQuest.js"
//V43: попытка призыва босса 3 этажа при открытии новой комнаты (все столбы могли
//уже стоять в состоянии 2 от генерации — тогда последнее условие выполняется именно здесь)
import { tryFinSummon } from "../scripts/finPillars.js"
//V114: кооператив — контекст игрока + профили устройств ввода
import { setContext } from "../scripts/players.js"
import { playerMoveKeys,padIndex,ownerOfMoveKey } from "../scripts/devices.js"
//V56: сет «Доблестный небожитель» (6 надетых): скорость перемещения героя ×1.05
import { setHeroSpeedMult } from "../scripts/sets.js"
//V75: благословения шкафчика — Сын ветра +10%, Громила/Заучка по -10% к скорости перемещения
import { blessSpeedMult } from "../scripts/blessFx.js"
//V90: в момент НАЧАЛА движения героя полоса верхнего меню убирается (кроме вспышки левелапа)
import { topMenuClose } from "../scripts/topMenu.js"
import { lvlFlashActive } from "../scripts/lvlFlashFx.js"

let pressedKeys = new Set();
//V114: lastDir/padMaskPrev/wasMoving/lastHeroCellX/Y — ПЕР-ИГРОКОВЫЕ, переехали в поля
//игрока (players.js makePlayer): у каждого свои последнее направление, маска крестовины,
//клетка для чека новых комнат и кэш анимации простоя
document.addEventListener('keydown', (event) => {pressedKeys.add(event.code);
    //автоповтор клавиатуры не считается новым нажатием (иначе зажатая кнопка триггерила бы двойное нажатие рывка)
    if(event.repeat) return
    //V114: рывок (двойное нажатие направления) уходит ВЛАДЕЛЬЦУ кода: в соло профиль один
    //на единственного героя (WASD+стрелки равноправны), в коопе WASD — игрок 1, стрелки — игрок 2
    const hit = ownerOfMoveKey(event.code)
    if (!hit) return
    hit.player.lastDir = hit.dir
    setContext(hit.player)
    dashPress(hit.dir)
    setContext(status.players[0])
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
    for (let i = 0; i < status.players.length; i++) status.players[i].padMaskPrev = 0
    document.body.style.cursor = 'url("./images/UI/cur.png"), auto'
});
//V16: атрибуты img героя (href/times/width/height) пишем ОДИН раз в конце heroMove
//и только при реальной смене анимации — раньше каждая ветка движения перезаписывала
//их каждый тик (5 DOM-записей на тик бега). V114: кэш последней анимации — на игроке
//(status.hero к этому моменту указывает на контекстного игрока)
function syncHeroAnim(hero) {
    const anim = hero.currentAnim
    if (anim !== status.hero.lastAnim) {
        status.hero.lastAnim = anim
        hero.img.setAttribute("href", anim.img)
        hero.img.setAttribute("times", anim.times)
        hero.img.setAttribute("width", anim.w)
        hero.img.setAttribute("height", anim.h)
    }
}
//heroMove(P) — V114: движение ОДНОГО игрока (вызывается из gameLoop в цикле по
//status.players с уже подменённым контекстом). Ввод читается по профилю устройства
//игрока (devices.js): kb1 — WASD, kb2 — стрелки, solo — обе половины + пад 0.
function heroMove (P) {
    !P && (P = status.players[0])
    setContext(P)
    //V126: раскладка из привязок (devices.js, панель «Управление») — коды клавиш игрока
    //по ЕГО устройству (solo объединяет обе половины клавиатуры)
    const keys = playerMoveKeys(P.idx || 0, P.device)
    const kb = n => keys[n].some(c => pressedKeys.has(c))
    let left, right, up, down
    const padIdx = padIndex(P.device)
    if(padIdx >= 0 && navigator.getGamepads()[padIdx]) {
        let pad = navigator.getGamepads()[padIdx]
        let but = pad.buttons
        left = but[14] && but[14].pressed
        right = but[15] && but[15].pressed
        up = but[12] && but[12].pressed
        down = but[13] && but[13].pressed
        //V126 (решение юзера, поправка 2): ЛЕВЫЙ СТИК дублирует перемещение героя
        //(как крестовина); курсор переехал на ПРАВЫЙ стик (gameLoop gamepad).
        //Мёртвая зона 0.35 — дрейф лежащего стика не двигает героя
        if (pad.axes.length > 1) {
            const lx = pad.axes[0], ly = pad.axes[1], DZ = 0.35
            lx < -DZ && (left = true)
            lx > DZ && (right = true)
            ly < -DZ && (up = true)
            ly > DZ && (down = true)
        }
        !left && !right && !up && !down && status.start === 1 && status.hero.obj.currentAnim.once !== 1 && (status.hero.obj.stop = 1)
    }
    //V126 (репорт юзера: на паде не работала диагональ): ЭФФЕКТИВНЫЕ направления —
    //клавиатура + крестовина + левый стик вместе. Кардинальные ветки ниже обязаны
    //исключать диагональ по эффективным направлениям: раньше исключение было только
    //по kb(), и крестовина вверх+вправо проваливалась в ветку «вверх» (право игнор).
    const iUp = up || kb('up'), iDown = down || kb('down'), iLeft = left || kb('left'), iRight = right || kb('right')
    if(padIdx >= 0 && navigator.getGamepads()[padIdx]) {
        //направление взгляда — по последней НАЖАТОЙ кнопке/оси (edge-детект по маске);
        //маска из эффективных направлений — диагональ стиком тоже задаёт взгляд
        let padMask = (iUp?1:0)+(iDown?2:0)+(iLeft?4:0)+(iRight?8:0)
        if(padMask !== P.padMaskPrev) {
            iUp && !(P.padMaskPrev&1) && (P.lastDir = 0)
            iDown && !(P.padMaskPrev&2) && (P.lastDir = 1)
            iLeft && !(P.padMaskPrev&4) && (P.lastDir = 2)
            iRight && !(P.padMaskPrev&8) && (P.lastDir = 3)
            P.padMaskPrev = padMask
        }
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
    if(collision(x,y,data.scenes[num],0)&&!iDown&&iUp&&(!iRight&&!iLeft)) {
        moveSprite(hero.img, 0, -moveSpeed)
        hero.currentAnim = basicData.data.heroes[status.hero.class].anims[0].move[0]
        status.hero.direction = 0
        hero.stop = 0
        status.hero.waitTime = 0
    }
    else if(collision(x,y,data.scenes[num],1)&&!iLeft&&iRight&&(!iUp&&!iDown)) {
        moveSprite(hero.img, moveSpeed, 0)
        hero.currentAnim = basicData.data.heroes[status.hero.class].anims[0].move[3]
        status.hero.direction = 3
        hero.stop = 0
        status.hero.waitTime = 0
    }
    else if(collision(x,y,data.scenes[num],2)&&!iUp&&iDown&&(!iRight&&!iLeft)) {
        moveSprite(hero.img, 0, moveSpeed)
        hero.currentAnim = basicData.data.heroes[status.hero.class].anims[0].move[1]
        status.hero.direction = 1
        hero.stop = 0
        status.hero.waitTime = 0
    }
    else if(collision(x,y,data.scenes[num],3)&&!iRight&&iLeft&&(!iUp&&!iDown)) {
        moveSprite(hero.img, -moveSpeed, 0)
        hero.currentAnim = basicData.data.heroes[status.hero.class].anims[0].move[2]
        status.hero.direction = 2
        hero.stop = 0
        status.hero.waitTime = 0
    }
    else if (collision(x,y,data.scenes[num],4)&&iUp&&iRight) {
        //V15: движение через moveSprite — rect и img.x с сохранением кадрового смещения
        moveSprite(hero.img, moveSpeed*0.8, -moveSpeed*0.8)
        let moveAnim = basicData.data.heroes[status.hero.class].anims[0].move[P.lastDir]
        hero.currentAnim = moveAnim
        status.hero.direction = P.lastDir
        hero.stop = 0
        status.hero.waitTime = 0
    }
    //скольжение 1
    else if (iUp&&iRight) {
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
    else if (collision(x,y,data.scenes[num],5)&&iUp&&iLeft) {
        moveSprite(hero.img, -moveSpeed*0.8, -moveSpeed*0.8)
        let moveAnim = basicData.data.heroes[status.hero.class].anims[0].move[P.lastDir]
        hero.currentAnim = moveAnim
        status.hero.direction = P.lastDir
        hero.stop = 0
        status.hero.waitTime = 0
    }
    //скольжение 2
    else if (iUp&&iLeft) {
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
    else if (collision(x,y,data.scenes[num],6)&&iDown&&iRight) {
        moveSprite(hero.img, moveSpeed*0.8, moveSpeed*0.8)
        let moveAnim = basicData.data.heroes[status.hero.class].anims[0].move[P.lastDir]
        hero.currentAnim = moveAnim
        status.hero.direction = P.lastDir
        hero.stop = 0
        status.hero.waitTime = 0
    }
    //скольжение 3
    else if (iDown&&iRight) {
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
    else if (collision(x,y,data.scenes[num],7)&&iDown&&iLeft) {
        moveSprite(hero.img, -moveSpeed*0.8, moveSpeed*0.8)
        let moveAnim = basicData.data.heroes[status.hero.class].anims[0].move[P.lastDir]
        hero.currentAnim = moveAnim
        status.hero.direction = P.lastDir
        hero.stop = 0
        status.hero.waitTime = 0
    }
    //скольжение 4
    else if (iDown&&iLeft) {
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
    if (cellX !== P.lastCellX || cellY !== P.lastCellY) {
        P.lastCellX = cellX
        P.lastCellY = cellY
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
    //наведением мыши на верх экрана. V114: полосу двигает только игрок 0
    !P.wasMoving && moved && status.panels === 10 && !lvlFlashActive() && topMenuClose()
    P.wasMoving = moved
    //скролл экрана
    //V114: камера следует только за игроком 0; V116: в коопе — кооп-камера
    //(midpoint живых героев + автозум 1..2 + кламп к сцене, колесо отключено)
    if (P === status.players[0]) {
    if (coopMode() && coopCameraTick(data.scenes[num].w * 32, data.scenes[num].h * 32)) {
        //кооп-камера отработала — мёртвая зона не нужна
    } else {
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
        //V16: не пишем тот же viewBox повторно каждый тик у края экрана —
        //сравниваем с текущим значением (раньше setAttribute шёл каждый тик)
        let nx = svgArr[0].viewBox.animVal.x
        let ny = svgArr[0].viewBox.animVal.y
        orient === 2&&(ny -= moveSpeed)
        orient === 1&&(nx += moveSpeed)
        orient === 3&&(ny += moveSpeed)
        orient === 0&&(nx -= moveSpeed)
        if (nx !== svgArr[0].viewBox.animVal.x || ny !== svgArr[0].viewBox.animVal.y) {
            //R2.6: единый писатель камеры. Прежний цикл по слоям 0 и 1 читал
            //animVal.x ВТОРОГО слоя уже ПОСЛЕ записи первого: в шиме оба игровых слоя
            //делят один живой объект cameraVB (makeLayerShim: _vb = cameraVB), поэтому
            //второй слой прибавлял moveSpeed к уже сдвинутому значению — камера ехала
            //в 2 раза быстрее героя, мёртвая зона мигала через тик, и весь мир
            //«подпрыгивал» на ±moveSpeed×масштаб каждый тик (рябь только при скролле).
            //В старом SVG у слоёв были независимые строки viewBox — потому там не прыгало.
            setWorldViewBox(nx, ny)
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
        //V83: кнопка загадки (21) — так же. V97: чаша «напёрстков» (22) — так же
        //(! строка не может начинаться с «(» — после безточного `let hit = …+32` ASI склеивает
        //её в «вызов» выражения: «32 is not a function»)
        obj[11] === 1 && !hit && (obj[2] === 15 || obj[2] === 17 || obj[2] === 18 || obj[2] === 19 || obj[2] === 20 || obj[2] === 21 || obj[2] === 22) && (obj[11] = 0)
        if (!hit) {continue}
        //стоя НА взведённой ловушке (тип 14) обезвреживание не запускается — только с соседней клетки.
        //x,y здесь уже смещены на +16/+50 от rect героя, поэтому хитбокс ног = x-3, y-13, 14x14
        if(obj[2] === 14 && obj[7] !== 1 && checkCollision(x-3,obj[0]*32,14,32,y-13,obj[1]*32,14,32)) {
            status.hero.use === 1 && stopUseObject()
            find = 1
            continue
        }
        //V64: портал (18) и рычаг (19) взаимодействию поддаются только в АКТИВНОЙ фазе
        //(obj[10]===1); в «выключенной» — мёртвый объект (решение по ТЗ).
        //V109b: 18/19 с взведённым obj[11] — ТОЖЕ мимо. Прежде клуза перезарядки
        //охватывала только 15/17/20/21: «перезарядка порталов» из V64 не блокировала
        //юз вовсе — портал под ногами перезапускался каждые ~60 тиков (репорт: диалог
        //квеста зацикливался; сеть V109 вело бесконечной цепочкой портал→портал —
        //target[11]=1 из portalQuestUse молчал). Ванильные юзы 18/19 не ломаются:
        //все они либо телепортируют героя прочь, либо гасят фазу (obj[10]=0)
        //V75: шкафчик (20) с взведённым obj[11] (меню открыто/закрыто без выбора) — мимо.
        //V83: кнопка загадки (21) с взведённым obj[11] — мимо; интерактивна в ОБЕИХ фазах.
        //V97: чаша (22) интерактивна только в фазе выбора «напёрстков» (shellCupReady)
        if (obj[5] === undefined && obj[7] !== 1 && !((obj[2] === 15 || obj[2] === 17 || obj[2] === 18 || obj[2] === 19 || obj[2] === 20 || obj[2] === 21) && obj[11] === 1) && !((obj[2] === 18 || obj[2] === 19) && obj[10] !== 1) && !(obj[2] === 22 && !shellCupReady(obj)) && status.hero.use === 0) {
        status.hero.use = 1
        useObject(obj,i0)
        }
        find = 1
    }
    if (status.hero.use === 1&&find === 0)
    {
        status.hero.use = 0
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
            //E-9: navMatrix ИИ врагов (enemyAI) перестраивается — новая комната проходима
            status.navVersion = (status.navVersion || 0) + 1
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
            //V111: в режиме погони «лава в коридорах» новая клетка заливается лавой сразу
            flameQuestCorridorOpen(level.floor[i])
            //E-9: navMatrix ИИ врагов (enemyAI) перестраивается — коридор проходим
            status.navVersion = (status.navVersion || 0) + 1
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
    //R3: стены индексируются по клетке-началу и по клетке-владению ([5]) — раньше на
    //каждую клетку коридора заново сканировались все стены этажа. Тайлы/стены —
    //нативные спрайты мира (worldImage)
    const wallsByCell = new Map()
    const wallsByOwner = new Map()
    for (let i3 = 0; i3 < level.walls.length; i3++) {
        const w = level.walls[i3]
        const ckey = w[0] + "," + w[1]
        let arr = wallsByCell.get(ckey)
        if (!arr) { arr = []; wallsByCell.set(ckey, arr) }
        arr.push(w)
        if (w[5] !== undefined) {
            let arr2 = wallsByOwner.get(w[5])
            if (!arr2) { arr2 = []; wallsByOwner.set(w[5], arr2) }
            arr2.push(w)
        }
    }
    const drawWall = (w) => {
        conteiner.push(worldImage(layer1,
                    w[0]*tileX,
                    w[1]*tileY,
                    w[3]*tileX,
                    w[4]*tileY,"./images/dungeon/walls/"+(w[2]+status.levelFloor*30)+".png"))
        //V4: стены-накладки (27/28) — в кэш Z-сортировки («;» обязательна:
        //строка начинается с «(» — без неё ASI склеивает с push выше)
        ;(w[2]===27||w[2]===28)&&wallsOverlay.push(conteiner[conteiner.length-1])
        //V16: двери — в кэш openDoor
        ;(w[2]===9||w[2]===12||w[2]===23||w[2]===24)&&doorPics.push(conteiner[conteiner.length-1])
    }
    let lengthFloor = level.floor.length
    for (let i = 0; i < lengthFloor; i++) {
        //пол коридора рисуем ТОЛЬКО для клеток коридора ([2]===1): у комнат [5]/[6] — это
        //координаты ЦЕНТРА, и если центр комнаты совпадал с парой индексов (room1,room2),
        //тайл коридора рисовался ПОВЕРХ тайла комнаты (двойное наложение 0.7+0.7 — полоса)
        if (level.floor[i][2]===1&&level.floor[i][5]===cell[5]&&
            level.floor[i][6]===cell[6]) {
                //пол коридора НЕ рисуем там, где уже есть пол комнаты (createRoom +
                //его ряд [3]+1 + коридор под комнатой — двойной тайл, полоса по нижнему краю)
                !corridorOnRoomFloor(level,level.floor[i][0],level.floor[i][1])&&conteiner.push(worldImage(layer0,
                    level.floor[i][0]*tileX,
                    level.floor[i][1]*tileY,
                    tileX,tileY,floorTexture(status.levelFloor,level.floor[i][4],1),{"opacity":"0.7"}))
            level.floor[i][7] = 1
            const cw = wallsByCell.get(level.floor[i][0] + "," + level.floor[i][1])
            if (cw) for (let k = 0; k < cw.length; k++) drawWall(cw[k])
            const ow = wallsByOwner.get(i)
            if (ow) for (let k = 0; k < ow.length; k++) drawWall(ow[k])
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
export {heroMove,createCorridor,checkZOrder,pressedKeys,checkNewRoom}