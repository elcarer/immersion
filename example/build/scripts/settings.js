import { status,drawStartScreen } from "../scripts/start.js"
import { svgArr,image, text, rect, path, uiRightEdge, uiBottomEdge } from "../scripts/svg.js"
import { tipDel } from "../scripts/tip.js"
import { playback,strike,musicDuck,setMusicVolume } from "../scripts/sound.js"
import { lobby } from "../scripts/lobby.js"
import { save,saveSettings } from "../scripts/save.js"
//V80: галочка «Отключение теней» — мгновенное применение к текущей сцене
import { applyGroundShadows } from "../scripts/groundShadow.js"
//V58: тексты — ключи локализации; блок выбора языка (русский/english)
import { T,setLang,getLang } from "../scripts/localization.js"
//V126: кнопка «Управление» — панель переназначения кнопок (обратная связь — хук, без цикла)
import { openControls, controlsHooks } from "../scripts/controls.js"
controlsHooks.toSettings = () => settings()

let settingsTemp = []
let musicPoint
let effectPoint
//V80: отметка галочки «Отключение теней» — показ/скрытие при переключении
let shadowCheckMark = null
//V95: отметки чекбоксов «Рамка предметов»/«Свечение предметов»
let framesCheckMark = null
let glowCheckMark = null
function toggleShadows() {
    playback(strike[14].vol,0,0,3*status.settings.soundVolume)
    status.settings.noShadows = status.settings.noShadows ? 0 : 1
    saveSettings()
    applyGroundShadows()
    shadowCheckMark && shadowCheckMark.setAttribute("display", status.settings.noShadows ? "inline" : "none")
}
//V95: чекбоксы «Рамка предметов»/«Свечение предметов» — видимость эффектов V94 на иконках.
//Поля status.settings.itemFrames/itemGlow (0/1, слот settings, saveSettings). Семантика
//«=== 0 ? 1 : 0»: в старых сейвах поля нет (undefined = включено) — первый клик выключает,
//как и ожидается для включённого по умолчанию эффекта
function toggleItemFrames() {
    playback(strike[14].vol,0,0,3*status.settings.soundVolume)
    status.settings.itemFrames = status.settings.itemFrames === 0 ? 1 : 0
    saveSettings()
    framesCheckMark && framesCheckMark.setAttribute("display", status.settings.itemFrames ? "inline" : "none")
    refreshItemFxContext()
}
function toggleItemGlow() {
    playback(strike[14].vol,0,0,3*status.settings.soundVolume)
    status.settings.itemGlow = status.settings.itemGlow === 0 ? 1 : 0
    saveSettings()
    glowCheckMark && glowCheckMark.setAttribute("display", status.settings.itemGlow ? "inline" : "none")
    refreshItemFxContext()
}
//V95: немедленное применение к открытому экрану. В лобби сундук виден за панелью настроек —
//полная перерисовка (та же последовательность, что у смены языка: settingsDel(1) → lobby →
//settings). На заставке предметов нет, в забеге панели перекрыты — эффекты применятся при
//следующем открытии инвентаря/куклы/алхимии/экрана предметов
function refreshItemFxContext() {
    if (status.startScreen === 1 || status.start === 1) return
    settingsDel(1)
    lobby(status.settings.lose,status.settings.next)
    settings()
}
const SLIDER_X = 975
//V47: полоса громкости — спрайт soundBar.png (220×14, вдвое длиннее прежнего expBar 110×14):
//точность настройки выше. Вся математика ползунка считается от SLIDER_W — больше ничего менять не нужно
const SLIDER_W = 220
const VOL_MAX = 0.4
function settings() {
    status.pause = 1
    status.move = 0
    status.panels = 6
    musicDuck(1) //V61: панель глушит музыку (на заставке шина музыку не трогает)
    settingsTemp.push(image(svgArr[2],525,160,919,796,"./images/UI/panels/panel.png"))
    settingsTemp.push(text(svgArr[2],960,215,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("settings.title"),{"id":"delItemText","size":60,"font":"baseFont4","anchor":"middle"}))
    settingsTemp.push(image(svgArr[2],700,290,500,73,"./images/UI/panels/buttonUp.png",{"glow":1,"func":()=>{playback(strike[14].vol,0,0,3*status.settings.soundVolume);status.settings.musicVolume=0;status.settings.soundVolume=0;musicVolume();saveSettings()}}))
    settingsTemp.push(text(svgArr[2],960,341,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("settings.sound.off"),{"id":"delItemText","size":48,"font":"baseFont4","anchor":"middle"}))

    settingsTemp.push(image(svgArr[2],975,402,SLIDER_W,14,"./images/UI/panels/soundBar.png",{"func":e=>{setMusicFromX(getMousePosition(e).x);playMusicFeedback()}}))
    settingsTemp.push(image(svgArr[2],975 + (status.settings.musicVolume*SLIDER_W)/0.4,394,28,29,"./images/UI/panels/pointFull.png"))
    musicPoint = settingsTemp[settingsTemp.length-1]
    settingsTemp.push(text(svgArr[2],890,420,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("settings.music"),{"id":"delItemText","size":48,"font":"baseFont4","anchor":"middle"}))

    settingsTemp.push(image(svgArr[2],975,452,SLIDER_W,14,"./images/UI/panels/soundBar.png",{"func":e=>{setEffectFromX(getMousePosition(e).x);playEffectFeedback()}}))
    settingsTemp.push(image(svgArr[2],975 + (status.settings.soundVolume*SLIDER_W)/0.4,445,28,29,"./images/UI/panels/pointFull.png"))
    effectPoint = settingsTemp[settingsTemp.length-1]
    settingsTemp.push(text(svgArr[2],890,470,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("settings.fx"),{"id":"delItemText","size":48,"font":"baseFont4","anchor":"middle"}))

    //V80: галочка «Отключение теней». Значение — status.settings.noShadows (0/1), пишется
    //в слот settings сразу (saveSettings), применение к сцене — мгновенное
    //(applyGroundShadows; со стартового экрана применится при сборке первого этажа).
    //Отмеченная галочка = тени выключены. V80a: чекбокс создаётся ПЕРВЫМ, галочка-path
    //поверх него (наоборот заливка чекбокса перекрывала отметку); pointer-events="none"
    //у отметки — клики по ней доходят до кликабельного чекбокса.
    settingsTemp.push(rect(svgArr[2],700,522,34,34,`rgb(204, 153, 102)`,"3px","black",{"rx":"4px","func":toggleShadows}))
    shadowCheckMark = path(svgArr[2],{"id":"shadowsCheck","x":0,"y":0,"r":0,
        "d":"M 705 542 L 714 552 L 729 529 L 725 526 L 714 545 L 709 539 Z"},`rgb(204, 153, 102)`)
    shadowCheckMark.setAttribute("display", status.settings.noShadows ? "inline" : "none")
    shadowCheckMark.setAttribute("pointer-events", "none")
    settingsTemp.push(shadowCheckMark)
    settingsTemp.push(text(svgArr[2],752,550,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("settings.shadowsOff"),{"id":"delItemText","size":42,"font":"baseFont4","anchor":"start"}))

    //V58: выбор языка. Надписи кнопок — нативные («Русский»/«English») в ОБЕИХ языках, чтобы
    //раздел всегда можно было найти. Текущая кнопка подсвечена (белый текст + свечение).
    //Смена языка: сохранение в settings.lang и мгновенная перерисовка (в лобби — лобби целиком,
    //в забеге — панель настроек; остальной текст подхватится при следующей отрисовке).
    settingsTemp.push(text(svgArr[2],960,610,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("settings.lang"),{"id":"delItemText","size":42,"font":"baseFont4","anchor":"middle"}))
    getLang() === "ru" ?
        settingsTemp.push(image(svgArr[2],710,658,208,60,"./images/UI/panels/buttons/button.png",{"glow":1,"func":()=>switchLang("ru")})) :
        settingsTemp.push(image(svgArr[2],710,658,208,60,"./images/UI/panels/buttons/button.png",{"glow":1,"func":()=>switchLang("ru")}))
    settingsTemp.push(text(svgArr[2],820,701,"0pt","50pt","black","2px",getLang() === "ru" ? "white" : `rgb(204, 153, 102)`,T("settings.lang.ru"),{"id":"delItemText","size":42,"font":"baseFont4","anchor":"middle"}))
    getLang() === "en" ?
        settingsTemp.push(image(svgArr[2],1050,658,208,60,"./images/UI/panels/buttons/button.png",{"glow":1,"func":()=>switchLang("en")})) :
        settingsTemp.push(image(svgArr[2],1050,658,208,60,"./images/UI/panels/buttons/button.png",{"glow":1,"func":()=>switchLang("en")}))
    settingsTemp.push(text(svgArr[2],1160,701,"0pt","50pt","black","2px",getLang() === "en" ? "white" : `rgb(204, 153, 102)`,T("settings.lang.en"),{"id":"delItemText","size":42,"font":"baseFont4","anchor":"middle"}))

    //V95: чекбоксы эффектов предметов — одна строка в свободной полосе между блоком языка
    //и нижней кнопкой. Отрисовка как у «Отключения теней» (V80a): чекбокс первым, галочка
    //поверх с pointer-events="none" — клики по галочке доходят до чекбокса
    settingsTemp.push(rect(svgArr[2],640,730,34,34,`rgb(204, 153, 102)`,"3px","black",{"rx":"4px","func":toggleItemFrames}))
    framesCheckMark = path(svgArr[2],{"id":"framesCheck","x":0,"y":0,"r":0,
        "d":"M 645 750 L 654 760 L 669 737 L 665 734 L 654 753 L 649 747 Z"},`rgb(204, 153, 102)`)
    framesCheckMark.setAttribute("display", status.settings.itemFrames !== 0 ? "inline" : "none")
    framesCheckMark.setAttribute("pointer-events", "none")
    settingsTemp.push(framesCheckMark)
    settingsTemp.push(text(svgArr[2],692,758,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("settings.itemFrames"),{"id":"delItemText","size":34,"font":"baseFont4","anchor":"start"}))
    settingsTemp.push(rect(svgArr[2],1020,730,34,34,`rgb(204, 153, 102)`,"3px","black",{"rx":"4px","func":toggleItemGlow}))
    glowCheckMark = path(svgArr[2],{"id":"glowCheck","x":0,"y":0,"r":0,
        "d":"M 1025 750 L 1034 760 L 1049 737 L 1045 734 L 1034 753 L 1029 747 Z"},`rgb(204, 153, 102)`)
    glowCheckMark.setAttribute("display", status.settings.itemGlow !== 0 ? "inline" : "none")
    glowCheckMark.setAttribute("pointer-events", "none")
    settingsTemp.push(glowCheckMark)
    settingsTemp.push(text(svgArr[2],1072,758,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("settings.itemGlow"),{"id":"delItemText","size":34,"font":"baseFont4","anchor":"start"}))

    //V60: нижняя кнопка панели. Со стартового экрана — ОТМЕНА (просто закрыть настройки),
    //иначе — ГЛАВНОЕ МЕНЮ: из забега (status.start===1) с окном предупреждения ДА/НЕТ
    //(решение пользователя), из лобби — сразу (забег не идёт, предупреждение не нужно).
    //V126: слева добавлена кнопка «УПРАВЛЕНИЕ» — панель переназначения кнопок (controls.js)
    settingsTemp.push(image(svgArr[2],560,810,420,73,"./images/UI/panels/buttonUp.png",{"glow":1,"func":()=>{playback(strike[14].vol,0,0,3*status.settings.soundVolume);settingsDel(1);openControls()}}))
    settingsTemp.push(text(svgArr[2],770,861,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("settings.controls"),{"id":"delItemText","size":42,"font":"baseFont4","anchor":"middle"}))
    if (status.startScreen === 1) {
        settingsTemp.push(image(svgArr[2],1000,810,420,73,"./images/UI/panels/buttonUp.png",{"glow":1,"func":()=>{playback(strike[14].vol,0,0,3*status.settings.soundVolume);settingsDel(1)}}))
        settingsTemp.push(text(svgArr[2],1210,861,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("settings.cancel"),{"id":"delItemText","size":42,"font":"baseFont4","anchor":"middle"}))
    } else {
        settingsTemp.push(image(svgArr[2],1000,810,420,73,"./images/UI/panels/buttonUp.png",{"glow":1,"func":()=>{playback(strike[14].vol,0,0,3*status.settings.soundVolume);status.start === 1 ? exitConfirm() : goMainMenu()}}))
        settingsTemp.push(text(svgArr[2],1210,861,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("settings.mainmenu"),{"id":"delItemText","size":42,"font":"baseFont4","anchor":"middle"}))
    }

    sliderDrag(musicPoint, setMusicFromX, playMusicFeedback)
    sliderDrag(effectPoint, setEffectFromX, playEffectFeedback)
}
function settingsDel(nomusic=0) {
    let length = settingsTemp.length
    for (let i = 0; i < length; i++) {
        settingsTemp[i].remove()
    }
    settingsTemp = []
    //V60: если было открыто окно предупреждения — сбросить его пул (сами ноды уже удалены
    //выше вместе с settingsTemp), иначе повторный exitConfirm заблокируется защитой
    confirmTemp.length > 0 && exitConfirmDel()
    status.move = 1
    status.panels = 0
    status.pause = 0
    tipDel()
    nomusic === 0 && musicDuck(0)
}
//V60: окно предупреждения при выходе в главное меню ИЗ ЗАБЕГА: «Это завершит текущий
//забег. Вы уверены?» с кнопками ДА (завершить забег и уйти в заставку) и НЕТ (вернуться
//в настройки). Ноды кладутся И в settingsTemp (любой внешний путь закрытия настроек —
//ESC/closePanels, тумблер «Настройки» — уносит и окно), и в confirmTemp (точечное
//закрытие кнопками ДА/НЕТ). Смена языка при открытом окне невозможна: кнопки языка
//перекрыты гасящей подложкой на весь экран
let confirmTemp = []
function exitConfirm() {
    if (confirmTemp.length > 0) return
    const add = (el) => {settingsTemp.push(el); confirmTemp.push(el)}
    //подложка: перекрывает панель настроек и гасит клики мимо кнопок (pointer-events
    //включается наличием func); клик по ней сам по себе ничего не закрывает
    add(rect(svgArr[2],0,0,uiRightEdge(),uiBottomEdge(),"none","0px","black",{"fillOpacity":"0.6","func":()=>{}}))
    add(rect(svgArr[2],650,420,620,240,`rgb(204, 153, 102)`,"4px","black",{"rx":"6px"}))
    //V73: фреймы ДА/НЕТ удвоены по высоте (73→146) и подняты на те же 73px (нижняя кромка
    //на месте) — надписи вылезали за фрейм. Фреймы рисуются ДО текстов вопроса, чтобы
    //поднятый фрейм их не накрыл (клики тексты не перехватывают — pointer-events none)
    add(image(svgArr[2],730,563,208,60,"./images/UI/panels/buttons/button.png",{"glow":1,"func":()=>{playback(strike[14].vol,0,0,3*status.settings.soundVolume);exitConfirmDel();goMainMenu()}}))
    add(image(svgArr[2],990,563,208,60,"./images/UI/panels/buttons/button.png",{"glow":1,"func":()=>{playback(strike[14].vol,0,0,3*status.settings.soundVolume);exitConfirmDel()}}))
    add(text(svgArr[2],960,490,"0pt","50pt","none","2px",`rgb(204, 153, 102)`,T("settings.confirm.t1"),{"id":"delItemText","size":32,"font":"baseFont4","anchor":"middle"}))
    add(text(svgArr[2],960,535,"0pt","50pt","none","2px",`rgb(204, 153, 102)`,T("settings.confirm.t2"),{"id":"delItemText","size":32,"font":"baseFont4","anchor":"middle"}))
    add(text(svgArr[2],830,606,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("settings.confirm.yes"),{"id":"delItemText","size":42,"font":"baseFont4","anchor":"middle"}))
    add(text(svgArr[2],1090,606,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("settings.confirm.no"),{"id":"delItemText","size":42,"font":"baseFont4","anchor":"middle"}))
}
function exitConfirmDel() {
    for (let i = 0; i < confirmTemp.length; i++) {
        confirmTemp[i].remove()
    }
    confirmTemp = []
}
//сам выход в главное меню (после ДА, либо сразу из лобби): панель закрывается БЕЗ
//возобновления музыки (nomusic=1 — unduck не случится, заставку озвучит playTrack(menu)
//внутри drawStartScreen), забег останавливается
//(status.start=0 — gameLoop простаивает), заставка рисуется СРАЗУ в конечном состоянии
//(решение пользователя: без повторной анимации лого). del() внутри drawStartScreen сносит
//весь мир забега и заодно полосу иконок (topMenuClose)
function goMainMenu() {
    settingsDel(1)
    status.start = 0
    //V61: музыку глушит сама шина — drawStartScreen внутри себя зовёт playTrack(TRACK.menu),
    //что гасит гейн любого прежнего трека (подземелье/таверна) и включает меню-музыку.
    //Никакого ручного suspend'а контекстов больше не нужно
    drawStartScreen(false)
}
function clampX(x) {
    return Math.max(SLIDER_X, Math.min(SLIDER_X + SLIDER_W, x))
}
function setMusicFromX(x) {
    let cx = clampX(x)
    musicPoint && musicPoint.setAttribute("x", cx)
    status.settings.musicVolume = (cx - SLIDER_X) * VOL_MAX / SLIDER_W
    //V61: громкость применяет шина ко всем трекам (меню-музыка на заставке меняется живьём)
    setMusicVolume()
    //V76: каждое изменение громкости (клик по полосе или шаг перетаскивания) сразу пишется
    //в слот настроек — иначе «Продолжить» с заставки откатывал бы его load()'ом из localStorage
    saveSettings()
}
function setEffectFromX(x) {
    let cx = clampX(x)
    effectPoint && effectPoint.setAttribute("x", cx)
    status.settings.soundVolume = (cx - SLIDER_X) * VOL_MAX / SLIDER_W
    saveSettings()
}
//V93: шапка гейна 1.0 — 3×vol на максимуме (0.4) давал 1.2: клиппинг слышался как «гул»
//вместо блипа (репорт V93); на обычных громкостях поведение не меняется
function playMusicFeedback() {
    playback(strike[14].vol,0,0,Math.min(1,3*status.settings.musicVolume))
}
function playEffectFeedback() {
    playback(strike[5].vol,0,0,Math.min(1,3*status.settings.soundVolume))
}
//перетаскивание ползунка: apply вызывается на каждом движении, onEnd — при отпускании.
//V93: захват ползунка сам громкость НЕ меняет — новое значение применяется только первым
//ДВИЖЕНИЕМ. Раньше apply на mousedown переписывал громкость точкой захвата: клик по
//ползунку «самому на себе» ставил его же позицию — регулирование казалось сломанным,
//и застрявшая на минимуме громкость держалась в сейве циклами (репорт V93)
function sliderDrag(knob, apply, onEnd) {
    knob.setAttribute("pointer-events", "auto")
    knob.addEventListener('mousedown', (ev) => {
        ev.preventDefault()
        ev.stopPropagation()
        let moved = false
        function onMove(e) {
            e.preventDefault()
            moved = true
            apply(getMousePosition(e).x)
        }
        function onUp() {
            document.removeEventListener('mousemove', onMove)
            document.removeEventListener('mouseup', onUp)
            moved && onEnd && onEnd()
        }
        document.addEventListener('mousemove', onMove)
        document.addEventListener('mouseup', onUp)
    })
}
function musicVolume() {
    musicPoint.x.baseVal.value = 975
    effectPoint.x.baseVal.value = 975
    //V61: «Звук выкл.» глушит и музыку меню (гейны всех треков → 0)
    setMusicVolume()
}
//V58: переключение языка — сохранить и немедленно перерисовать. В лобби (status.start!==1)
//перерисовываем лобби целиком (del() в lobby() сносит и панели), затем заново открываем
//настройки; в забеге — только панель настроек (мир не трогаем, остальной текст обновится
//при следующей отрисовке). nomusic=1 в settingsDel — музыку не resumes на полпути.
//V59: у стартового экрана status.start тоже 0, поэтому контекст различаем флагом
//status.startScreen: смена языка из Настроек, открытых со стартового экрана, перерисовывает
//заставку (лого logoRus/logoIng и надписи кнопок — сразу, без повторной анимации)
function switchLang(l) {
    playback(strike[14].vol,0,0,3*status.settings.soundVolume)
    if(getLang() === l) return
    setLang(l)
    status.settings.lang = l
    save()
    document.title = T("app.title")
    settingsDel(1)
    if (status.start === 1) {
        settings()
    } else if (status.startScreen === 1) {
        drawStartScreen(false)
        settings()
    } else {
        lobby(status.settings.lose,status.settings.next)
        settings()
    }
}
function getMousePosition(evt) {
    const CTM = svgArr[2].getScreenCTM();
    return {
      x: (evt.clientX - CTM.e) / CTM.a,
      y: (evt.clientY - CTM.f) / CTM.d
    }
  }
export {settings,settingsTemp,settingsDel}
