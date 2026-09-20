// ============================================================================
// dialog.js — V104: диалоговая система (квест «Сопроводить Волка», quest.js).
// Модальное окно поверх живой сцены: игра на паузе (status.pause=1, panels=11 —
// верхнее меню и ховер-окна врагов на это время закрыты), внизу окно текста,
// по сторонам портреты говорящих (герой — слева, Волк — справа). Реплики
// печатаются по буквам («печатная машинка») со звуком step.mp3 на каждые вторые
// буквы (громкость 2×soundVolume — слышимость на уровне штатных звуков игры).
// Цвет текста реплик различается: Волк — золотой rgb(204,153,102) (палитра
// проекта), герой — холодный голубой rgb(153,204,255).
// Управление: клик/Space/Enter — дорисовать строку целиком / следующая реплика;
// на последней — кнопки выбора (script.choices). Escape — как клик.
// Циклы импортов (start/sound/data) легальны: использование только в рантайме.
// ============================================================================
import { svgArr, image, text, rect, uiRightEdge, uiBottomEdge } from "../scripts/svg.js"
import { status } from "../scripts/start.js"
import { T } from "../scripts/localization.js"
import { playback, strike } from "../scripts/sound.js"
import { data } from "../scripts/data.js"

const TYPE_MS = 35            //мс на букву
const WIN_X = 560, WIN_Y = 868, WIN_W = 800, WIN_H = 176
const PORTRAIT_W = 144, PORTRAIT_H = 216
const DLG_F_TEXT = 30                        //кегль реплики (textEl ниже)
const DLG_TEXT_W = WIN_W - 56                //максимальная ширина строки (поля окна)
//цвета реплик: Волк — золотой проекта, герой — голубой (разные оттенки, решение по постановке).
//V109: «Голос из портала» — призрачный лиловый, культист — багряный
const COL_WOLF = "rgb(204, 153, 102)"
const COL_HERO = "rgb(153, 204, 255)"
const COL_VOICE = "rgb(186, 140, 230)"
const COL_CULT = "rgb(220, 110, 100)"

let dlgTemp = []     //узлы окна/портретов/оверлея
let dlgTimer = null
let dlgKey = null
let dlgState = null  //{"lines","idx","typing","shown","choices","onEnd","textEl","nameEl"}

function speakerOf(who) {
    return who === "wolf" ? {"name":T("quest.wolf.name"),"col":COL_WOLF} :
        who === "voice" ? {"name":T("quest.portal.voice"),"col":COL_VOICE} :
        who === "cultist" ? {"name":T("enemy.28.name"),"col":COL_CULT} :
        {"name":T(data.heroes[status.hero.class].name),"col":COL_HERO}
}

//замер ширины строки реальным рендером (рецепт tip.itMeasure — getBBox PIXI.Text)
function dlgMeasure(str, size) {
    try {
        const t = text(svgArr[2],-99999,-99999,"0pt","50pt","none","1px","black",str,{"size":size,"font":"baseFont4"})
        const w = t.getBBox().width
        t.remove()
        return w || str.length * size * 0.56
    } catch {
        return str.length * size * 0.56
    }
}
//жадный перенос по словам (рецепт tip.itWrap): обычный <text> сам НЕ переносит —
//длинная реплика уходила одним хвостом за панель (репорт V109: «А. Ну, да...»
//Голоса портала). Перенос делаю \n-ами — их PIXI.Text рвёт на строки, печатная
//машинка ниже просто печатает строку посимвольно
function dlgWrap(str, size) {
    const words = String(str).split(" ")
    const out = []
    let cur = ""
    for (let i = 0; i < words.length; i++) {
        const probe = cur ? cur + " " + words[i] : words[i]
        if (cur && dlgMeasure(probe, size) > DLG_TEXT_W) {
            out.push(cur)
            cur = words[i]
        } else cur = probe
    }
    cur && out.push(cur)
    return out.join("\n")
}

function openDialog(script) {
    if (dlgState) return
    status.pause = 1
    status.move = 0
    status.panels = 11
    playback(strike[14].vol,0,0,3*status.settings.soundVolume)
    dlgState = {"lines":script.lines || [],"idx":-1,"choices":script.choices || [],"onEnd":script.onEnd}
    //оверлей перехватывает клики по сцене (клик = продолжить диалог)
    dlgTemp.push(rect(svgArr[2],0,0,uiRightEdge(),uiBottomEdge(),"none","0px","none",{"func":e => {advanceDialog()}}))
    //окно текста — тоже продвигает диалог (клик по нему самый естественный)
    dlgTemp.push(rect(svgArr[2],WIN_X,WIN_Y,WIN_W,WIN_H,"2px","rgb(204, 153, 102)","rgba(16, 12, 10, 0.92)",{"rx":"6px","func":e => {advanceDialog()}}))
    //портреты по разные стороны окна: герой слева, справа — второй говорящий
    //(по умолчанию Волк, арт 192×288 — тот же формат, что портрет героя; V106: кадр
    //листа заменён на нормальный UI-портрет). V109: script.right === null — правого
    //портрета нет (реплики «Голоса из портала»/культиста)
    dlgTemp.push(image(svgArr[2],WIN_X - PORTRAIT_W - 48,WIN_Y - PORTRAIT_H + 76,PORTRAIT_W,PORTRAIT_H,data.heroes[status.hero.class].img))
    const rightImg = script.right !== undefined ? script.right : "./images/UI/doll/wolf.png"
    rightImg && dlgTemp.push(image(svgArr[2],WIN_X + WIN_W + 48,WIN_Y - PORTRAIT_H + 76,PORTRAIT_W,PORTRAIT_H,rightImg))
    //имя говорящего и строка реплики (текст печатается в dlgState.textEl)
    dlgState.nameEl = text(svgArr[2],WIN_X + 24,WIN_Y + 38,"0pt","26pt","black","2px",COL_WOLF,"",{"id":"dlgName","size":24,"font":"baseFont4"})
    dlgTemp.push(dlgState.nameEl)
    dlgState.textEl = text(svgArr[2],WIN_X + 24,WIN_Y + 92,"0pt","32pt","black","2px","white","",{"id":"dlgText","size":DLG_F_TEXT,"font":"baseFont4"})
    dlgTemp.push(dlgState.textEl)
    dlgKey = e => {
        if (e.code === "Escape" || e.code === "Space" || e.code === "Enter") {
            e.preventDefault && e.preventDefault()
            advanceDialog()
        }
    }
    document.addEventListener("keydown", dlgKey)
    nextLine()
}

function nextLine() {
    dlgState.idx++
    if (dlgState.idx >= dlgState.lines.length) {
        showChoices()
        return
    }
    const line = dlgState.lines[dlgState.idx]
    const sp = speakerOf(line.who)
    dlgState.nameEl.textContent = sp.name
    dlgState.nameEl.setAttribute("fill", sp.col)
    dlgState.textEl.setAttribute("fill", sp.col)
    dlgState.full = dlgWrap(T(line.key), DLG_F_TEXT)
    dlgState.shown = 0
    dlgState.typing = 1
    dlgState.textEl.textContent = ""
    dlgTimer = setInterval(() => {
        dlgState.shown++
        dlgState.textEl.textContent = dlgState.full.slice(0,dlgState.shown)
        //звук печати — step.mp3 на каждую вторую букву; громкость как у штатных звуков
        dlgState.shown % 2 === 0 && playback(strike[0].vol,0,0,2*status.settings.soundVolume)
        if (dlgState.shown >= dlgState.full.length) stopTyping()
    },TYPE_MS)
}

function stopTyping() {
    clearInterval(dlgTimer)
    dlgTimer = null
    dlgState.typing = 0
    dlgState.textEl.textContent = dlgState.full
}

function advanceDialog() {
    if (!dlgState) return
    if (dlgState.typing) {
        stopTyping()
        return
    }
    if (dlgState.idx >= dlgState.lines.length) return //выбор уже показан
    dlgState.nameEl.textContent = ""
    nextLine()
}

function showChoices() {
    dlgState.nameEl.textContent = ""
    dlgState.textEl.textContent = ""
    const n = dlgState.choices.length
    for (let i = 0; i < n; i++) {
        const c = dlgState.choices[i]
        const w = 232
        const x = WIN_X + WIN_W/2 - (n * (w + 24) - 24)/2 + i * (w + 24)
        dlgTemp.push(image(svgArr[2],x,WIN_Y + WIN_H - 76,w,60,"./images/UI/panels/buttons/button.png",{"glow":1,"func":e => {
            const cb = c.cb
            closeDialog()
            cb && cb()
        }}))
        dlgTemp.push(text(svgArr[2],x + w/2,WIN_Y + WIN_H - 34,"0pt","26pt","black","2px","rgb(204, 153, 102)",T(c.label),{"id":"dlgChoice"+i,"size":24,"font":"baseFont4","anchor":"middle"}))
    }
}

//закрытие с восстановлением состояния (колбэки выбора вызываются снаружи)
function closeDialog() {
    if (!dlgState) return
    dlgTimer && clearInterval(dlgTimer)
    dlgTimer = null
    dlgKey && document.removeEventListener("keydown", dlgKey)
    dlgKey = null
    for (let i = 0; i < dlgTemp.length; i++) {
        const n = dlgTemp[i]
        n && n.remove && n.remove()
    }
    dlgTemp.length = 0
    dlgState = null
    status.pause = 0
    status.move = 1
    status.panels = 0
}

//нештатный снос (del.js: смена сцены при открытом диалоге) — без колбэков
function dialogIsOpen() {
    return !!dlgState
}
function closeDialogHard() {
    if (dlgState) closeDialog()
}

export { openDialog, closeDialogHard, dialogIsOpen }
