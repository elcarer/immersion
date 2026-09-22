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
//V115: бафы расщеплены — checkBuffs (герой, per player) + enemyBuffsTick (ловушки/яд врагов/шипы)
import { checkBuffs,enemyBuffsTick } from "../scripts/checkBuffs.js"
import { flameTick } from "../scripts/flameFx.js"
//V49: бафы статуи (таймеры + иконки над героем) и ожоги врагов от огненного оружия
import { buffTick,tickEnemyBurns } from "../scripts/buffFx.js"
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
//V103: полёт кучек дропа по параболе (dropSafe.js) — тик в общем цикле, как у спор Гриба
import { dropFlyTick } from "../scripts/dropSafe.js"
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
//V109: квест «Голос в портале» — тик состояния (исчезновение NPC-портала при выходе
//из стартовой комнаты, полоска взаимодействия)
import { portalQuestTick } from "../scripts/portalQuest.js"
//V111: квест «Погоня за пламенем» — тик состояния (полоска взаимодействия, перебежки
//огнементя, режимы лавы)
import { flameQuestTick } from "../scripts/flameQuest.js"
import { svgArr,image, text,gamepadDragStart,gamepadDragMove,gamepadDragEnd,isDragging,getCTM } from "../scripts/svg.js"
//V114: кооператив — подмена контекста игрока + гварды живости
import { setContext,anyAlive,playerAlive } from "../scripts/players.js"
//V126: переназначаемые кнопки пада (панель «Управление» в НАСТРОЙКАХ)
import { padBtn } from "../scripts/devices.js"
import { closeControls } from "../scripts/controls.js"

//отслеживание мыши
//V16: mousemove приходит 100–1000 раз/сек — не работаем на КАЖДОЕ событие
//(раньше здесь писался body.style.cursor и вызывался getScreenCTM — оба форсировали
//пересчёт стилей/layout и тормозили ввод). Координаты запоминаем, обрабатываем
//один раз за тик в gameLoop.
let pendingMouse = null
document.addEventListener('mousemove', e => {
    pendingMouse = [e.clientX, e.clientY]
  })
//V128 (репорт юзера: после сворачивания/смены фокуса окна геймпад перестаёт работать):
//Chrome замораживает выдачу Gamepad API, пока окно не в фокусе, и после возврата пады
//появляются в getGamepads() не сразу. Фоновый опрос раз в 500мс держит состояние тёплым,
//пульс на focus форсирует пере-перечисление сразу при возврате в окно
setInterval(() => { navigator.getGamepads && navigator.getGamepads() }, 500)
window.addEventListener("focus", () => { navigator.getGamepads && navigator.getGamepads() })
function gameLoop() {
    if (pendingMouse) {
        const mx = pendingMouse[0]
        const my = pendingMouse[1]
        pendingMouse = null
        //V126: восстановление ОС-курсора на mousemove убрано — ОС-курсор над страницей
        //скрыт ВСЕГДА (единый курсор — спрайт cur.png, его двигают и мышь, и правый стик)
        checkMenu(mx, my)
    }
    gamepad()
    cursorTick()
    //V47: окно врага при наведении — до блока паузы, чтобы гаснуть даже при открытой панели
    enemyHoverTick()
    //V77: видимость ряда bless-иконок (наведение на верх экрана) — каждый тик, до паузы
    blessHintsTick()
    if(status.start===1 && status.pause === 0) {
        //V117: страховка — вне пер-игроковой фазы контекст обязан быть P1
        //(квест-диалоги/полоски могли оставить контекст триггер-игрока)
        status.hero !== status.players[0] && setContext(status.players[0])
        status.time++
        animPlay()
    //V114: мир тикает, пока жив хотя бы один игрок
    if(anyAlive()) {
        //V114: ПЕР-ИГРОКОВАЯ ФАЗА — у каждого игрока свои движение, рывок, простой,
        //атаки, кулдаун способностей и нестан. Контекст (hero/info/attack/inventory)
        //подменяется на игрока, после цикла возвращается на players[0]
        for (let pi = 0; pi < status.players.length; pi++) {
            const P = status.players[pi]
            if (!playerAlive(P)) continue
            setContext(P)
            status.move===1&&valkyrieTick()
            status.move===1&&heroMove(P)
            if(P.obj.stop&&status.move===1) {P.waitTime++; checkWait()}
            status.move===1&&checkAttack()
            P.noStunTime > 0 && P.noStunTime--
            //V122: у каждого игрока свой ряд иконок над своими полосками — тикаем UI всем
            activeSkillsCD()
            //V115: герой-часть бафов (яд/невидимость/автокасты/щит), горение,
            //бафы статуи (иконки над своим героем), ачивка «Ловкач» — per player
            checkBuffs()
            flameTick()
            buffTick()
            achTick()
        }
        setContext(status.players[0])
        moveBullet()
        moveMagicBullet()
        checkBars()
        //V13: checkBars может завершить этаж прямо в этом тике
        //(useObject case 13 → nextFloor → endScreen/comix → del()): сцена удалена,
        //status.time сброшен в 0 — оставшиеся системы тика не трогаем
        //(иначе activeSkillsCD падал на document.getElementById(i+"P") === null)
        if (status.start !== 1 || status.time === 0) return
        damage()
        timerFloat()
        //V103: полёт кучек — ДО takeDrop, приземлившаяся в этом тике доступна подбору сразу
        dropFlyTick()
        takeDrop()
        destroyObjects()
        openDoor()
        anyAlive()&&enemyMove()
        //V28: расталкивание сблизившихся врагов — после всех шагов ИИ за тик
        anyAlive()&&separateEnemiesTick()
        //V80: наземные тени — после всех сдвигов спрайтов за тик (движение/отбросы/рывки)
        shadowTick()
        damageHero()
        //V115: ловушки + яд ВРАГОВ + шипы на поле — один раз за тик
        enemyBuffsTick()
        //V115: горение героев и бафы статуи переехали в пер-игроковую фазу;
        //здесь остался глобальный тик ожогов ВРАГОВ (дважды тикать нельзя)
        tickEnemyBurns()
        //V51 вампиризм врагов: кулдауны выпивания + движение шлейфов частиц
        vampTick()
        //V65: Сгустки пустоты Циклопа (4 этаж) — кулдаун способности + спиральное движение;
        //на других этажах модуль выходит сразу (bossRef пуст)
        voidBossTick()
        //V85: Медуза пустоты — проверка порога деления (segmentation) после урона за тик
        medusaSplitTick()
        //V91: Гриб пустоты — кулдаун разброса спор + полёт/прорастание лежащих
        sporeTick()
        //V27: ХП-бары врагов после урона / мигание меню при левелапе / авточистка окошка предмета
        enemyHpBarTick()
        lvlFlashTick()
        itemTipTick()
        //V30: мини-карта — пересборка при смене клетки героя, кружок ползёт каждый тик
        minimapTick()
        //V97: «напёрстки» — отсчёт показа/перемешивания чаш и их скольжение (portalFx.js)
        shellTick()
        //V109: «Голос в портале» — состояние квеста (portalQuest.js)
        portalQuestTick()
        //V111: «Погоня за пламенем» — состояние квеста (flameQuest.js)
        flameQuestTick()
        //V114: activeSkillsCD переехал в пер-игроковую фазу (кулдауны у каждого свои)
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
            //V114: полоска юза объекта принадлежит конкретному игроку — завершение
            //(ключи/лечение/эксп у владельца) исполняется в его контексте
            bars[i].owner !== undefined && status.players[bars[i].owner] && setContext(status.players[bars[i].owner])
            bars[i].func(bars[i].obj)
            setContext(status.players[0])
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

    menuHoverTick()
}
//V128 (репорт юзера: курсор пада в верхней части экрана не вызывает верхнее меню):
//наведение меню раньше жило только в checkMenu (путь mousemove) — стик пада двигал
//status.mouseY, но проверку верхней зоны не проходил. Теперь это общий тик для мыши
//и пада: y<100 поднимает меню, y>100 закрывает (при открытой полосе)
function menuHoverTick() {
    status.mouseY < 100 && status.start === 1 && status.panels === 0 && topMenu()
    status.mouseY > 100 && status.start === 1 && status.panels === 10 && topMenuClose()
}
let timePadButtons = 0
let padDragPrev = false
function checkGamepadMenu() {
    timePadButtons++
    if(status.start !== 1 || timePadButtons <= 15) return
    //V125 (репорт юзера: второй геймпад не работает): каждый подключённый пад
    //обслуживает СВОЕГО игрока — пад k → players[k] (пад 0 → игрок 1, пад 1 →
    //игрок 2), панели открываются per-owner (clickButton(n, ownerIdx), V117).
    //Курсор/клики/drag (gamepad ниже) остаются за падом 0 — курсор на экране один,
    //drag-машина синглтонна
    const pads = navigator.getGamepads()
    let handled = false
    //V126: панель «Управление» — из пада работает только «отмена» (B), назад в настройки
    if (status.panels === 12) {
        for (let pi = 0; pi < status.players.length; pi++) {
            const pad = pads[pi]
            if (!pad) continue
            const b = pad.buttons[padBtn("cancel")]
            b && b.pressed && (closeControls(0,1), handled = true)
        }
        handled && (timePadButtons = 0)
        return
    }
    for (let pi = 0; pi < status.players.length; pi++) {
        const pad = pads[pi]
        if (!pad) continue
        handled = true
        let but = pad.buttons
        const P = (n) => { const b = but[padBtn(n)]; return b && b.pressed }
        //карта
        if (P("map")) {clickButton(1,pi)}
        //отмена
        if (P("cancel")) {closePanels(0);playback(strike[14].vol,0,0,3*status.settings.soundVolume)}
        //экипировка
        if (P("equip")) {clickButton(0,pi)}
        //журнал (V126: переехал с ЛТ на RT — ЛТ теперь клик курсора; переназначается)
        if (P("journal")) {clickButton(2,pi)}
        //настройки
        if (P("settings")) {clickButton(3,pi)}
        //библиотека
        if (P("library")) {clickButton(4,pi)}
    }
    handled && (timePadButtons = 0)
}
function movePadCursor(x,y) {
    //V126: шим мог быть уничтожен при смене сцены (del() чистит UI-слой) — пересоздаём
    !status.newMouse || status.newMouse._dead
        ? status.newMouse = image(svgArr[2],x,y,23,32,"./images/UI/cur.png")
        : (status.newMouse.setAttribute("x",x), status.newMouse.setAttribute("y",y))
    //всегда поверх панелей и UI
    svgArr[2].append(status.newMouse)
}
//V126: ЕДИНЫЙ КУРСОР — спрайт cur.png (status.newMouse) и есть курсор на ВСЕХ экранах
//(меню/лобби/забег/панели/результаты): его двигают и мышь (checkMenu), и правый стик
//(gamepad). ОС-курсор над страницей скрыт всегда — двойного курсора больше нет (репорт
//V126: «два курсора на экране»). Пока любой герой бежит (в игре, без панелей и паузы)
//курсор прячется (репорт V126: «перестал скрываться при движении героев»); возвращает
//его любое движение мыши или стика. На blur ОС-курсор возвращает старый обработчик
//(heroMove) — при возврате фокуса прячем снова
function cursorTick() {
    ;(!status.newMouse || status.newMouse._dead) && movePadCursor(status.mouseX || 960, status.mouseY || 540)
    const hide = status.start === 1 && status.pause === 0 && status.panels === 0 &&
        (status.players || []).some(P => P.wasMoving)
    const want = hide ? "none" : ""
    if (status.newMouse.getAttribute("display") !== want) status.newMouse.setAttribute("display", want)
    //ОС-курсор скрыт всегда; возвращает его только blur-обработчик (уход с окна)
    document.body.style.cursor !== "none" && (document.body.style.cursor = "none")
}
function gamepad() {
    //V128: кулдаун клика тикает и без пада — застрявший clickTime (смена фокуса на
    //паде зажала его) не блокировал клики после возврата пада
    status.clickTime && status.clickTime > 0 && status.clickTime--
    const pad = navigator.getGamepads()[0]
    if(!pad) return
    let but = pad.buttons
    //V126 (решение юзера, поправка 2): курсор двигает ПРАВЫЙ стик (оси 2/3) — ЛЕВЫЙ
    //стик с V126 дублирует перемещение героя (heroMove). Мёртвая зона 0.15, скорость
    //×8/тик — чувствительность прежнего левого стика
    if(pad.axes.length > 3) {
        const ax = Number(pad.axes[2].toFixed(2)), ay = Number(pad.axes[3].toFixed(2))
        if(Math.abs(ax) > 0.15 || Math.abs(ay) > 0.15) {
            status.mouseX += ax * 8
            status.mouseY += ay * 8
            movePadCursor(status.mouseX, status.mouseY)
            //V128: верхняя зона экрана открывает меню и для курсора пада
            menuHoverTick()
            //синтетический ховер: тултипы/подсветка под курсором пада (pixiBackend)
            const ctm = getCTM()
            ctm && backendHooks.padHover(status.mouseX * ctm.a + ctm.e, status.mouseY * ctm.d + ctm.f)
        }
    }
    //перетаскивание предметов (LB, переназначается — панель «Управление»)
    const dragBtn = padBtn("drag")
    let dragPressed = but[dragBtn] && but[dragBtn].pressed
    if(dragPressed && !padDragPrev) {
        gamepadDragStart(status.mouseX, status.mouseY)
    } else if(dragPressed && padDragPrev && isDragging()) {
        gamepadDragMove(status.mouseX, status.mouseY)
    } else if(!dragPressed && padDragPrev) {
        gamepadDragEnd()
    }
    padDragPrev = dragPressed
    //клик курсором (V126: ЛТ — «левый нижний курок», кнопка 6, переназначается) =
    //клик курсором мыши во всех местах: тот же synthetic-click через хит-тест UI
    const clickBtn = padBtn("click")
    if(clickBtn !== undefined && but[clickBtn] && but[clickBtn].pressed) {
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

export {gameLoop}