import { svgArr,image,worldBar,text,rect,uiRightEdge,uiBottomEdge } from "../scripts/svg.js"
import cacheResources from "../scripts/cacheResources.js"
import { screenPic,del } from "../scripts/del.js"
import { gameLoop } from "../scripts/gameLoop.js"
import { data } from "../scripts/data.js"
import { playback,strike,playTrack,TRACK } from "../scripts/sound.js"
import { lobby } from "../scripts/lobby.js"
import { buttonInit } from "../scripts/sceneGenerate.js"
import { load,loadSettings,save } from "../scripts/save.js"
//V58: локализация — ключи вместо текстов, язык выбирается detectLang (шапка localization.js)
import { T,setLang,detectLang,getLang } from "../scripts/localization.js"
//V59: кнопка «Настройки» стартового экрана открывает панель настроек поверх него.
//Циклический импорт start.js <-> settings.js легален: привязки используются только внутри функций
import { settings,settingsTemp,settingsDel } from "../scripts/settings.js"
//V60: фон и лого заставки рисуются на зумируемых слоях svgArr[0]/[1] — перед отрисовкой
//камеру этих слоёв надо вернуть к полному окну 1920×1080 (после выхода из забега viewBox
//оставался на герое — меню показывалось без фона и лого). Циклический импорт легален
import { resetWorldView } from "../scripts/zoomFx.js"
//МИГРАЦИЯ (M4): предзагрузка GPU-текстур Pixi (тот же resources.json, HTTP-кэш горячий)
import { preloadGameTextures } from "../scripts/pixiBackend.js"

//V66c: эталонный шаблон мета-профиля — единый источник для первичного status и для «Новой
//игры» (полный сброс профиля, решение пользователя). JSON-копия даёт каждому профилю СВОИ
//массивы. Числа слотов — канон normMeta (save.js): 21/21/58/8/4
function defaultMeta() {
    return JSON.parse(JSON.stringify({
        "points":0,
        "killedEnemes":new Array(21).fill(0),
        "library":new Array(21).fill(0),
        "libraryObjects":new Array(58).fill(0),
        "invNum":1,"inv":[null,null,null],
        "page":1,"pageMax":1,"openPage":[0,0,0],
        "metaInvLen":3,"startKey":0,"dopHP":0,"startStat":0,"metaPageNum":1,"identLegends":0,
        "achievements":new Array(8).fill(0),
        "diedClasses":new Array(4).fill(0),
        //V68: пул уникальных реликвий — какие kind уже выпадали (1 = выпадала); живёт между
        //забегами, как libraryObjects; полная «Новая игра» сбрасывает профиль целиком
        "obtainedRelics":new Array(6).fill(0)
    }))
}
let status = {"mouseX":0,"mouseY":0,"start":0,"pause":0,"rectShadow":0,"nextFunction":{},"oVcount":0,"time":0,"inventory":{"doll":[,,,,,,,,,,,,,],"inv":[false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false]},
"info":{"stats":[],"exp":0,"lvl":1,"abilPoints":0,"gold":0,"hp":0,"beltCell":0, "beltCellArr":[],"armor":0,"upStat":0,"keys":0,"skills":[],"poisonus":0,"poisonusMult":1,"expous":0,"lifeus":0,"viewus":1,"invisible":0,"invisibleTime":0,"activeSkills":[],"pins":0,"backStab":1,"cloudeTime":0,"multSpeed":1,"killHeal":0,"keyLock":0,"pinsAdd":0,"pinsStan":false,"bossKill":0,"time":0,"luckus":0,"fameus":0,"greedus":0,"poison":0,"poisonTime":0,"stoneCurse":0,"goldroom":0,"reflect":1,"energyShotCharge":0,"charm":0,"blesses":[]},
"move":0,"moveSpeed":2,"use":0,
"hero":{"class":0,"x":0,"y":0,"direction":1,"obj":{},"waitTime":0,"noStunTime":0},
"levelFloor":0,"panels":0,"attack":{},
//V69: ручные зверьки (pet) текущего забега — снапшот {class, stats} для переноса на новый
//этаж; наполняется в nextFloor (snapshotCarryPets), расходуется в newGame (spawnCarriedPets)
"pets":[],
"meta":defaultMeta(),
//V95: itemFrames/itemGlow — чекбоксы «Рамка предметов»/«Свечение предметов» (1 = включено)
"settings":{"musicVolume":0.1,"soundVolume":0.1,"noShadows":0,"itemFrames":0,"itemGlow":1},
//V59: 1 — сейчас на экране стартовая заставка (нужно settings.js для смены языка:
//перерисовывать надо стартовый экран, а не лобби — status.start у обоих равен 0)
"startScreen":0,
}
//V58: начальный язык — до первого UI (сохранённый settings.lang, иначе язык браузера).
//Обязательно пишем его и в status.settings.lang: иначе первый же save() запишет настройки
//БЕЗ lang, и по правилу «старый сейв без lang → русский» выбор браузера потерялся бы при
//следующей загрузке. load() ниже ещё раз синхронизирует setLang с загруженными настройками
//V76: сохранённые НАСТРОЙКИ (громкости) читаются уже на старте — панель настроек заставки
//сразу показывает сохранённые значения, а не дефолты 0.1. Мета по-прежнему читается только
//load()'ом («Продолжить»/«Загрузить») — шаблонная мета до выбора профиля не перезаписывается
loadSettings()
status.settings.lang = detectLang()
setLang(status.settings.lang)
let weapon = data.basicWeapons[0]
status.inventory.doll = [,,,,,,,,,,,weapon,weapon,]
let attack = data.attacks[weapon.attack]
status.attack = {"img":attack.img,"target":undefined,"current":[],"stack":[{"timer":Math.trunc((attack.cooldown*1000)/16),"abil":attack}]}
// МИГРАЦИЯ (M4): rAF-цикл с аккумулятором удалён — тики игры идут из тикера ядра
// zero_engine (index.js: gameTickSystem, тот же фиксированный шаг 16мс ~62.5Гц)
function start() {
    //V64: полоса загрузки — фон hpBar.png (407×64) по центру экрана, заливка hpBarCol1.png
    //(315×24, смещение внутри фона +49/+20 — геометрия полос героя из takeDamage.js) —
    //картинка НЕ растягивается: растёт ОКНО ВИДИМОСТИ (clipPath-rect, приём полос ХП/опыта
    //и полосы босса hpBar.js). Раньше менялся width самой картинки — заливка сжималась.
    const bgX = 1920/2 - 407/2
    const bgY = 1080/2 - 64/2
    screenPic.push(image(svgArr[0],bgX,bgY,407,64,"./images/UI/panels/hpBar.png"))
    const fillX = bgX + 49
    const fillY = bgY + 20
    //R4: нативная полоса загрузки — окно маски 0 → 315 по мере загрузки (картинка
    //не сжимается, как в SVG-клипе); svgArr[0] целиком сносит del() при onComplete
    const loadFill = worldBar(svgArr[0],fillX,fillY,315,24,"./images/UI/panels/hpBarCol1.png")
    screenPic.push(loadFill)
    cacheResources({
        basePath: './images/',
        fromFile: './images/resources.json',
        onProgress: (cur, max) => {
            loadFill.setBarProgress(Math.trunc((cur/max)*315), "left")
        },
        onComplete: (success) => {
             del()
             // МИГРАЦИЯ (M4): тики уже идут из тикера ядра (index.js). Перед заставкой
             // заливаем текстуры в GPU (HTTP-кэш уже горячий после cacheResources) —
             // без белых вспышек на спрайтах. Затем заставка и кнопки как раньше.
             preloadGameTextures('./images/resources.json', './images/').then(() => {
                 //V59: заставка стартового экрана (фон → логотип → панель с кнопками)
                 drawStartScreen(true)
                 buttonInit()
             })
            }
        })
}

// ==================== V59: стартовый экран ====================
//Схема появления (решение по постановке V59):
//  1) фон /UI/start.png — сразу;
//  2) логотип-название медленно проявляется: /UI/logoRus.png (русский) | /UI/logoIng.png
//     (английский) — по текущему языку; текстом название больше не показывается;
//  3) КОГДА логотип проявился окончательно — мгновенно появляются панель /UI/backStartMenu.png
//     и 4 кнопки: спрайт /UI/emptyButton.png (пустой) + локализованная надпись поверх.
const LOGO_DELAY = 50   //мс паузы после появления фона до старта проявления логотипа
const LOGO_FADE = 2000   //мс проявления логотипа («медленно» — решение пользователя: ~2с)
const LOGO_W = 1076       //логотип logoRus.png / logoIng.png
const LOGO_H = 268
const PANEL_X = 760      //backStartMenu.png 400×500 — подложка под кнопками
const PANEL_Y = 400
const BTN_W = 341        //emptyButton.png
const BTN_H = 96
const BTN_X = 1920/2 - BTN_W/2
//4 кнопки в панели: 4×96 + 3 зазора по 24 = 456, вертикальный центр панели 650 → верх 422
const BTN_YS = [440, 548, 656, 764]
//V84: надпись кнопки при наведении НЕ светится (свечение осталось только у спрайта) —
//заливка текста становится чуть светлее базовой rgb(204, 153, 102), при уходе возвращается
const BTN_TXT_HOVER = "rgb(231, 183, 134)"
//V66b: сброс забегного состояния при входе в таверну СО СТАРТОВОГО ЭКРАНА («Продолжить»/
//«Новая игра»). Раньше после выхода из забега в меню (goMainMenu) status.levelFloor и рюкзак
//status.inventory.inv переживали меню: «Новая игра» начинала забег на брошенном этаже со
//старыми вещами, а comix onClick звал newGame(nextRun) с ОСТАВШИМСЯ nextRun=true от спуска
//между этажами — забег просто продолжался без инициализации героя (репорт V66b). Долл и статы
//героя сбрасывает sceneGenerate(next===false) при старте забега. Сброс ДО лобби: takeSelected
//кладёт отмеченные вещи сундука в inv до comix — поздний сброс безвозвратно терял бы их.
function freshRunReset() {
    status.levelFloor = 0
    status.inventory.inv = [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false]
}
//V66c: «Новая игра» — ПОЛНЫЙ сброс профиля (решение пользователя): мета → эталонный шаблон,
//герой → Рыцарь; save() сразу перезаписывает localStorage-слот, поэтому «Продолжить» после
//сброса продолжает НОВЫЙ профиль. Прежний возвращаем только файлом («Сохранить»/«Загрузить»
//в таверне) — потому перед сбросом подтверждение, пока в localStorage есть запись игры (V71)
function freshProfile() {
    status.meta = defaultMeta()
    status.hero.class = 0
    save()
}
let newGameConfirmTemp = []
function newGameConfirmDel() {
    for (let i = 0; i < newGameConfirmTemp.length; i++) newGameConfirmTemp[i].remove()
    newGameConfirmTemp = []
}
//V71: переход «Новой игры» в лобби — бывшее тело кнопки ДА окна подтверждения. Выделено,
//чтобы тот же переход работал БЕЗ окна: при отсутствии записи игры в localStorage
//(критерий «Продолжить») подтверждать нечего — стирать ещё нечего, игра начинается сразу
function newGameYes() {
    newGameConfirmDel()
    freshProfile()
    status.startScreen = 0
    settingsTemp.length > 0 && settingsDel(1)
    playTrack(TRACK.none)
    status.rectShadow = 1
    status.nextFunction = () => {freshRunReset();lobby(false,false)}
}
//модальное окно подтверждения на заставке (по образцу exitConfirm в settings.js): подложка
//гасит клики мимо кнопок; ESC/клавиатура на заставке неактивны (guard status.start===1).
//V71: открывается только при записи игры в localStorage — иначе «Новая игра» идёт сразу (newGameYes)
function newGameConfirm() {
    if (newGameConfirmTemp.length > 0) return
    const add = (el) => newGameConfirmTemp.push(el)
    add(rect(svgArr[2],0,0,uiRightEdge(),uiBottomEdge(),"none","0px","black",{"fillOpacity":"0.6","func":()=>{}}))
    add(rect(svgArr[2],610,410,700,260,`rgb(204, 153, 102)`,"4px","black",{"rx":"6px"}))
    //V73: фреймы ДА/НЕТ удвоены по высоте (73→146) и подняты на те же 73px (нижняя кромка
    //на месте) — надписи вылезали за фрейм. Фреймы теперь рисуются ДО текстов вопроса:
    //поднятый фрейм не накрывает строки (клики тексты не перехватывают — pointer-events none)
    add(image(svgArr[2],740,590,208,60,"./images/UI/panels/buttons/button.png",{"glow":1,"func":()=>{playback(strike[14].vol,0,0,3*status.settings.soundVolume);newGameYes()}}))
    add(image(svgArr[2],980,590,208,60,"./images/UI/panels//buttons/button.png",{"glow":1,"func":()=>{playback(strike[14].vol,0,0,3*status.settings.soundVolume);newGameConfirmDel()}}))
    add(text(svgArr[2],960,465,"0pt","50pt","none","2px",`rgb(204, 153, 102)`,T("start.newgame.confirm.t1"),{"id":"delItemText","size":40,"font":"baseFont4","anchor":"middle"}))
    add(text(svgArr[2],960,522,"0pt","50pt","none","2px",`rgb(204, 153, 102)`,T("start.newgame.confirm.t2"),{"id":"delItemText","size":28,"font":"baseFont4","anchor":"middle"}))
    add(text(svgArr[2],960,560,"0pt","50pt","none","2px",`rgb(204, 153, 102)`,T("start.newgame.confirm.t3"),{"id":"delItemText","size":28,"font":"baseFont4","anchor":"middle"}))
    add(text(svgArr[2],840,635,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("settings.confirm.yes"),{"id":"delItemText","size":42,"font":"baseFont4","anchor":"middle"}))
    add(text(svgArr[2],1080,635,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("settings.confirm.no"),{"id":"delItemText","size":42,"font":"baseFont4","anchor":"middle"}))
}
let startToken = 0 //поколение отрисовки: таймеры/твины устаревшей заставки не срабатывают
//плавное проявление opacity 0→1 (rAF-твин, квадратичное смягчение). Твин умирает вместе
//с элементом: если заставку снесли (del() при уходе в лобби) — доводить нечего
function fadeIn(el, dur, done) {
    const t0 = performance.now()
    function step(t) {
        if (!el.isConnected) return
        const k = Math.min(1, (t - t0) / dur)
        el.setAttribute("opacity", (k * k).toFixed(3))
        if (k < 1) requestAnimationFrame(step)
        else { el.setAttribute("opacity", "1"); done && done() }
    }
    requestAnimationFrame(step)
}
//drawStartScreen(animate): animate=true — полная заставка (только при загрузке игры);
//animate=false — мгновенная перерисовка сразу в конечном состоянии (смена языка в Настройках,
//открытых со стартового экрана — лого и надписи должны поменяться без повторного ожидания).
//Экспортируется для settings.js (switchLang)
function drawStartScreen(animate) {
    //V60: слои 0/1 зумируются (камера забега) — вернуть их viewBox к полному окну 1920×1080,
    //иначе после выхода из забека фон и лого остаются «за кадром» при видимых кнопках UI-слоя
    resetWorldView()
    del()
    newGameConfirmDel() //V66c: перерисовка заставки (смена языка) уносит ноды окна — чистим пул
    //V61: меню-музыка (CoinCreek) через шину: при перерисовке заставки (смена языка)
    //playTrack(меню) просто оставляет её активной — трек не перезапускается
    playTrack(TRACK.menu)
    status.startScreen = 1
    startToken++
    const token = startToken
    document.title = T("app.title")
    //1) фон — появляется сразу
    screenPic.push(image(svgArr[0],0,0,1920,1080,"./images/UI/start.png"))
    screenPic.push(text(svgArr[1],10,1060,"0pt","50pt","none","3px","#FFFF66","build 2.11",{"id":"title","size":24,"font":"baseFont4","anchor":"start"}))
    //2) логотип-название — картинка по языку
    const logo = image(svgArr[1],1920/2-LOGO_W/2,110,LOGO_W,LOGO_H,"./images/UI/" + (getLang() === "ru" ? "logoRus.png" : "logoIng.png"))
    screenPic.push(logo)
    if (animate) {
        logo.setAttribute("opacity","0")
        setTimeout(() => {
            if (token !== startToken || !logo.isConnected) return
            fadeIn(logo, LOGO_FADE, () => { token === startToken && drawStartButtons() })
        }, LOGO_DELAY)
    } else {
        drawStartButtons()
    }
}
//3) панель и кнопки — рисуются, КОГДА логотип проявился окончательно (появляются мгновенно,
//решение пользователя). До этого момента кнопок не существует в DOM — нажать их раньше
//времени невозможно
function drawStartButtons() {
    const hasSave = !!localStorage.getItem("meta")
    screenPic.push(image(svgArr[2],PANEL_X,PANEL_Y,400,500,"./images/UI/backStartMenu.png"))
    //V82: хелпер кнопки заставки — спрайт (glow) + надпись над ним. Надпись дописывается в
    //слот ПОСЛЕ создания: обработчики svg.js держат массив по ссылке, поэтому обработчики
    //наведения её видят (текст рисуется поверх спрайта — порядок слоёв прежний)
    //V84 (поправка пользователя): у надписи свечения БОЛЬШЕ НЕТ — при наведении светится
    //только спрайт, а заливка текста становится чуть светлее (hoverFill/hoverFillNodes);
    //при уходе курсора цвет возвращается к базовому rgb(204, 153, 102)
    const menuBtn = (y, label, func) => {
        const fillSlot = []
        screenPic.push(image(svgArr[2],BTN_X,y,BTN_W,BTN_H,"./images/UI/panels/buttons/button.png",{"glow":1,"hoverFill":BTN_TXT_HOVER,"hoverFillNodes":fillSlot,"func":func}))
        fillSlot.push(text(svgArr[2],1920/2,y+62,"0pt","50pt","black","3px",`rgb(204, 153, 102)`,label,{"id":"delItemText","size":52,"font":"baseFont4","anchor":"middle"}))
    }
    //1 «Продолжить»: активна только при наличии сохранения; без сейва кнопка видна, но
    //неактивна — приглушена, без обработчика и подсветки (решение пользователя)
    if (hasSave) {
        menuBtn(BTN_YS[0],T("start.continue"),()=>{status.startScreen = 0;settingsTemp.length > 0 && settingsDel(1);playTrack(TRACK.none);status.rectShadow = 1;playback(strike[14].vol,0,0,3*status.settings.soundVolume);status.nextFunction = () => {freshRunReset();load();lobby(true,false)}})
    } else {
        screenPic.push(image(svgArr[2],BTN_X,BTN_YS[0],BTN_W,BTN_H,"./images/UI/panels/buttons/button.png",{"opacity":"0.45"}))
        screenPic.push(text(svgArr[2],1920/2,BTN_YS[0]+62,"0pt","50pt","black","3px",`rgb(204, 153, 102)`,T("start.continue"),{"id":"delItemText","size":52,"font":"baseFont4","anchor":"middle"}))
    }
    //2 «Новая игра» — V66c: полный сброс профиля ПОДТВЕРЖДЕНИЕМ (прямому входу в лобби больше
    //нет: он оставлял загруженный по «Продолжить» профиль — «подгружалось старое лобби»).
    //Переход (startScreen=0/музыка/rectShadow/nextFunction) происходит только в ДА.
    //V71: окно только при наличии записи игры (тот же критерий, что у «Продолжить»):
    //без сейва подтверждать нечего — переход сразу, по телу ДА (newGameYes)
    menuBtn(BTN_YS[1],T("start.newgame"),()=>{playback(strike[14].vol,0,0,3*status.settings.soundVolume);hasSave ? newGameConfirm() : newGameYes()})
    //3 «Настройки»: открывает панель настроек поверх стартового экрана; повторное нажатие
    //закрывает (своей кнопки-меню у стартового экрана нет, ESC в меню не слушается).
    //V60: закрываем через settingsDel(1) — на заставке панели не будят музыку (шина
    //глушит панели только в забеге/лобби, см. musicDuck)
    menuBtn(BTN_YS[2],T("start.settings"),()=>{playback(strike[14].vol,0,0,3*status.settings.soundVolume);settingsTemp.length > 0 ? settingsDel(1) : settings()})
    //4 «Выход»: в electron-сборке закрывает окно приложения, в web-сборке закрывает страницу
    //(если браузер разрешает закрыть вкладку, не открытую скриптом)
    menuBtn(BTN_YS[3],T("start.exit"),()=>{playback(strike[14].vol,0,0,3*status.settings.soundVolume);window.close()})
}

export {start,status,drawStartScreen}
