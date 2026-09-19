import { animPlay } from "../scripts/animPlay.js"
import { status } from "../scripts/start.js"
import { heroMove } from "../scripts/heroMove.js"
import { checkAttack } from "../scripts/attack.js"
import { bars } from "../scripts/useObject.js"
import { damage } from "../scripts/damage.js"
import { timerFloat } from "../scripts/floatText.js"
import * as basicData from "../scripts/data.js"
import { topMenu,topMenuClose,clickButton,closePanels } from "../scripts/topMenu.js"
import { takeDrop } from "../scripts/takeDrop.js"
import { destroyObjects } from "../scripts/destroyObjects.js"
import { openDoor } from "../scripts/openDoor.js"
import { enemyMove } from "../scripts/enemyMove.js"
import { separateEnemiesTick } from "../scripts/enemyAI.js"
import { moveBullet,moveMagicBullet } from "../scripts/moveBullet.js"
import { damageHero } from "../scripts/damageHero.js"
import { checkBuffs } from "../scripts/checkBuffs.js"
import { flameTick } from "../scripts/flameFx.js"
//V49: бафы статуи (таймеры + иконки над героем) и ожоги врагов от огненного оружия
import { buffTick } from "../scripts/buffFx.js"
//V51: «вампиризм» врагов (кулдауны выпивания + шлейфы частиц герой→враг)
import { vampTick } from "../scripts/vampFx.js"
//V52: достижения — фиксация потери ХП героем за этаж (Ловкач)
import { achTick } from "../scripts/achievements.js"
import { activeSkillsCD } from "../scripts/activeSkills.js"
import { enemyHpBarTick } from "../scripts/enemyHpBarFx.js"
import { lvlFlashTick } from "../scripts/lvlFlashFx.js"
import { rollNumbers,loseRun,nextRun } from "../scripts/endGame.js"
import { settings } from "../scripts/settings.js"
import { playback,strike } from "../scripts/sound.js"
import { itemTipTick,tipDel } from "../scripts/tip.js"
//бэкенд-drag при захвате предмета гасит тулип через хук (цикл pixiBackend→tip.js недопустим)
import { backendHooks } from "../scripts/pixiBackend.js"
backendHooks.tipDel = tipDel
import { minimapTick } from "../scripts/minimapFx.js"
//V47: окно врага при наведении на поле — тик зовётся КАЖДЫЙ тик безусловно (до блока паузы),
//guard внутри модуля сам гасит окно при панелях/паузе/выходе из забега
import { enemyHoverTick } from "../scripts/enemyHover.js"
//V77: ряд иконок благословений — виден только при наведении курсора на верх экрана (как
//topmenu); тик тоже безусловный, до блока паузы. V77a: ряд зеркалит полосу меню — при
//открытой полосе (panels=10) виден ВМЕСТЕ с ней (иначе в верхней зоне не появлялся никогда:
//меню открывается тем же наведением, что и ряд)
import { blessHintsTick } from "../scripts/blessFx.js"
//V31: зум игровой сцены колесом мыши — модуль сам вешает wheel-listener при импорте,
//в тик gameLoop ничего не добавляется (камера перечитывает viewBox каждый тик сама)
import "../scripts/zoomFx.js"
import { rectShadow } from "../scripts/rectShadow.js"
//V65: Сгустки пустоты Циклопа (4 этаж) — кулдаун способности и движение по спирали
//V85: там же живёт Медуза пустоты — medusaSplitTick (порог деления segmentation)
//V91: там же Гриб пустоты — sporeTick (копилка спор и их прорастание)
import { voidBossTick, medusaSplitTick, sporeTick } from "../scripts/voidBoss.js"
import { spiderBossFight,descentBossAttack,bossAttack,bossDown,eggsArr,delEgg } from "../scripts/spiderBossFight.js"
import { valkyrieTick } from "../scripts/valkyrie.js"
//V80: наземные тени героя/врагов/питомцев — синхронизация после всех шагов движения
import { shadowTick } from "../scripts/groundShadow.js"
//V97: комната «напёрстков» (вид 3 портала) — фазы показа/перемешивания чаш
import { shellTick } from "../scripts/portalFx.js"
import { svgArr,image, text,gamepadDragStart,gamepadDragMove,gamepadDragEnd,isDragging,getCTM } from "../scripts/svg.js"

//отслеживание мыши
//V16: mousemove приходит 100–1000 раз/сек — не работаем на КАЖДОЕ событие
//(раньше здесь писался body.style.cursor и вызывался getScreenCTM — оба форсировали
//пересчёт стилей/layout и тормозили ввод). Координаты запоминаем, обрабатываем
//один раз за тик в gameLoop.
let pendingMouse = null
document.addEventListener('mousemove', e => {
    pendingMouse = [e.clientX, e.clientY]
  })
function gameLoop() {
    if (pendingMouse) {
        const mx = pendingMouse[0]
        const my = pendingMouse[1]
        pendingMouse = null
        //V17: курсор мог застрять в 'none' (keyup потерян при смене фокуса). Как и до
        //V16, движение мыши возвращает курсор — но пишем только когда он реально
        //скрыт (обычный случай — ноль DOM-записей, не чаще 1 раза за тик).
        if (document.body.style.cursor === 'none') {
            document.body.style.cursor = 'url("./images/UI/cur.png"), auto'
        }
        checkMenu(mx, my)
    }
    gamepad()
    //V47: окно врага при наведении — до блока паузы, чтобы гаснуть даже при открытой панели
    enemyHoverTick()
    //V77: видимость ряда bless-иконок (наведение на верх экрана) — каждый тик, до паузы
    blessHintsTick()
    if(status.start===1 && status.pause === 0) {
        status.time++
        animPlay()
    if(status.hero.obj.type !== "corpse") {
        status.move===1&&valkyrieTick()
        status.move===1&&heroMove()
        if(status.hero.obj.stop&&status.move===1) {status.hero.waitTime++; checkWait()}
        moveBullet()
        moveMagicBullet()
        status.move===1&&checkAttack()
        checkBars()
        //V13: checkBars может завершить этаж прямо в этом тике
        //(useObject case 13 → nextFloor → endScreen/comix → del()): сцена удалена,
        //status.time сброшен в 0 — оставшиеся системы тика не трогаем
        //(иначе activeSkillsCD падал на document.getElementById(i+"P") === null)
        if (status.start !== 1 || status.time === 0) return
        damage()
        timerFloat()
        takeDrop()
        destroyObjects()
        openDoor()
        status.hero.obj.type !== "corpse"&&enemyMove()
        //V28: расталкивание сблизившихся врагов — после всех шагов ИИ за тик
        status.hero.obj.type !== "corpse"&&separateEnemiesTick()
        //V80: наземные тени — после всех сдвигов спрайтов за тик (движение/отбросы/рывки)
        shadowTick()
        damageHero()
        status.hero.noStunTime > 0 && status.hero.noStunTime--
        checkBuffs()
        //V26 горение: отсчёт времени эффекта + спрайт пламени над героем
        flameTick()
        //V49 бафы статуи: таймеры/иконки над героем + ожоги врагов (после блока паузы —
        //на паузе время бафов замирает, как и всё остальное)
        buffTick()
        //V51 вампиризм врагов: кулдауны выпивания + движение шлейфов частиц
        vampTick()
        //V65: Сгустки пустоты Циклопа (4 этаж) — кулдаун способности + спиральное движение;
        //на других этажах модуль выходит сразу (bossRef пуст)
        voidBossTick()
        //V85: Медуза пустоты — проверка порога деления (segmentation) после урона за тик
        medusaSplitTick()
        //V91: Гриб пустоты — кулдаун разброса спор + полёт/прорастание лежащих
        sporeTick()
        //V52 достижения: ХП героя против прошлого тика — любая потеря гасит «чистый» этаж
        achTick()
        //V27: ХП-бары врагов после урона / мигание меню при левелапе / авточистка окошка предмета
        enemyHpBarTick()
        lvlFlashTick()
        itemTipTick()
        //V30: мини-карта — пересборка при смене клетки героя, кружок ползёт каждый тик
        minimapTick()
        //V97: «напёрстки» — отсчёт показа/перемешивания чаш и их скольжение (portalFx.js)
        shellTick()
        activeSkillsCD()
        }
    }
    //экран результатов
    if(status.start===2) {
        status.time++
        animPlay()
        status.time%3===0&&rollNumbers(loseRun,nextRun)
    }
    checkGamepadMenu()
    status.rectShadow === 1 && rectShadow()
    status.spiderBossFight && spiderBossFight()
    bossAttack.length > 0 && descentBossAttack()
    status.bossDown === 1 && bossDown()
    eggsArr.length > 0 && delEgg()
    SHOW_FPS && fpsCounter()
}
//V12: счётчик FPS (включается параметром ?fps в адресе), для замеров оптимизаций
const SHOW_FPS = location.search.includes("fps")
let fpsFrames = 0
let fpsLast = performance.now()
let fpsTextEl = null
function fpsCounter() {
    fpsFrames++
    let now = performance.now()
    if (now - fpsLast >= 500) {
        let fps = Math.round(fpsFrames * 1000 / (now - fpsLast))
        fpsFrames = 0
        fpsLast = now
        if (!fpsTextEl || !fpsTextEl.isConnected) {
            fpsTextEl = text(svgArr[2],1920-110,40,"0pt","50pt","none","2px","#66FF66","FPS: 0",{"id":"fps","size":28,"font":"baseFont","anchor":"middle"})
        }
        fpsTextEl.textContent = "FPS: " + fps
    }
}
function checkBars() {
    let lengthBars = bars.length
    for (let i = 0; i < lengthBars; i++) {
        bars[i].obj.setAttribute("width", bars[i].obj.width.animVal.value + bars[i].speed)
        if (bars[i].obj.width.animVal.value >= bars[i].fin) {
            bars[i].func(bars[i].obj)
            bars.splice(i,1)}
    }
}
function checkWait() {
    if (status.hero.waitTime === 120) {
        status.hero.obj.currentStill = 0
        status.hero.obj.currentAnim = basicData.data.heroes[status.hero.class].anims[2].others[2]
        status.hero.obj.img.setAttribute("href", basicData.data.heroes[status.hero.class].anims[2].others[2].img)
        status.hero.obj.animCounters = 60/basicData.data.heroes[status.hero.class].anims[2].others[2].speed
        status.hero.obj.stop = 0
        status.hero.waitTime = 0
    }
}
function checkMenu(x,y) {
    //V16: CTM из кэша (меняется только при resize), пересчёт вручную без
    //createSVGPoint/matrixTransform-аллокаций на каждое событие
    const ctm = getCTM()
    if(ctm) {
        status.mouseX = (x - ctm.e) / ctm.a
        status.mouseY = (y - ctm.f) / ctm.d
        y = status.mouseY
    } else {
        status.mouseX = x
        status.mouseY = y
    }
    //если курсор геймпада существует — держим его синхронным с координатами (клик всегда по видимому курсору)
    if(status.newMouse) {
        status.newMouse.setAttribute("x", status.mouseX)
        status.newMouse.setAttribute("y", status.mouseY)
        //V16: перекладывать узел каждый раз не нужно — только если он уже не сверху
        if (svgArr[2].lastElementChild !== status.newMouse) svgArr[2].append(status.newMouse)
    }

    y < 100&&status.start===1&&status.panels===0&&topMenu()
    y > 100&&status.start===1&&status.panels===10&&topMenuClose()
}
let timePadButtons = 0
let padDragPrev = false
function checkGamepadMenu() {
    timePadButtons++
    if(status.start === 1 && navigator.getGamepads()[0] && timePadButtons > 15) {
        timePadButtons = 0
        let but = navigator.getGamepads()[0].buttons
        //карта
        if (but[2] && but[2].pressed) {clickButton(1)}
        //отмена
        if (but[3] && but[3].pressed) {closePanels(0);playback(strike[14].vol,0,0,3*status.settings.soundVolume)}
        //экипировка
        if (but[0] && but[0].pressed) {clickButton(0)}
        //журнал
        if (but[6] && but[6].pressed) {clickButton(2)}
        //настройки
        if (but[1] && but[1].pressed) {clickButton(3)}
        //библиотека
        if (but[5] && but[5].pressed) {clickButton(4)}
    }
}
function movePadCursor(x,y) {
    !status.newMouse && (status.newMouse = image(svgArr[2],0,0,23,32,"./images/UI/cur.png"))
    status.newMouse.setAttribute("x",x)
    status.newMouse.setAttribute("y",y)
    //всегда поверх панелей и UI
    svgArr[2].append(status.newMouse)
}
function gamepad() {
    if(navigator.getGamepads()[0]) {
        let pad = navigator.getGamepads()[0]
        let but = pad.buttons
        //попытка перемещения мыши осями джойстика
        if(pad.axes.length > 1 && (Number(pad.axes[0].toFixed(2)) || Number(pad.axes[1].toFixed(2)))) {
            status.mouseX += Number(pad.axes[0].toFixed(2))*8
            status.mouseY += Number(pad.axes[1].toFixed(2))*8
            movePadCursor(status.mouseX, status.mouseY)
        }
        //перетаскивание предметов (LB — левый бампер)
        let dragPressed = but[4] && but[4].pressed
        if(dragPressed && !padDragPrev) {
            gamepadDragStart(status.mouseX, status.mouseY)
        } else if(dragPressed && padDragPrev && isDragging()) {
            gamepadDragMove(status.mouseX, status.mouseY)
        } else if(!dragPressed && padDragPrev) {
            gamepadDragEnd()
        }
        padDragPrev = dragPressed
        status.clickTime && status.clickTime > 0 && status.clickTime--
        if(but[7] && but[7].pressed) {
            if(!status.clickTime) {
                // 1. Создаем точку SVG (в координатах UI-слоя viewBox 0 0 1920 1080)
                const point = svgArr[2].createSVGPoint()
                point.x = status.mouseX
                point.y = status.mouseY
                // 2. Применяем матрицу трансформации UI-слоя svgArr[2].
                // ВАЖНО: НЕ svgArr[0] — у игровых слоёв viewBox сдвигается камерой
                // (sceneGenerate), и transform оттуда давал координаты вне окна → "noElement"
                const screenPoint = point.matrixTransform(svgArr[2].getScreenCTM())
                let element = document.elementFromPoint(screenPoint.x, screenPoint.y)
                element && element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
                //курсор НЕ удаляем — он нужен для последовательных кликов по панелям
                status.clickTime = 30
            }
        }
    }
}

export {gameLoop}