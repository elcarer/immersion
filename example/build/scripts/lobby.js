import { screenPic,del } from "../scripts/del.js"
import { svgArr,image, text, rect, nativeHtml } from "../scripts/svg.js"
import { data } from "../scripts/data.js"
import { tip,tipDel,rarityColor,itemFrameOn,itemGlowOn } from "../scripts/tip.js"
import { status } from "../scripts/start.js"
import { comix } from "../scripts/comix.js"
import { playback,strike,playTrack,TRACK } from "../scripts/sound.js"
import { clickButton } from "../scripts/topMenu.js"
import { save,saveToFile,loadFromFile } from "../scripts/save.js"
//V52: достижение «Открыватель» — все мета-улучшения (проверка после покупок).
//V74: герои открыты сразу — покупка/затемнение героев удалены, проверка осталась на ветках прокачки
import { achMetaCheck } from "../scripts/achievements.js"
//V53: сетовая система — chestUnidentified считает неидентифицированные легендарки сундука
import { chestUnidentified } from "../scripts/sets.js"
//V69c: продажа отмеченного — isRelic отличает реликвию (поле relic) от обычной редкости 4
import { isRelic } from "../scripts/relics.js"
//V58: локализация — ключи вместо текстов
import { T } from "../scripts/localization.js"

let heroesArr = [
    {"name":"hero.0.name","x":578,"y":488,"w":344,"h":489},
    {"name":"hero.1.name","x":1040,"y":440,"w":290,"h":523},
    {"name":"hero.2.name","x":924,"y":266,"w":279,"h":393},
    {"name":"hero.3.name","x":668,"y":297,"w":349,"h":358},
]
let heroName
let pages = [
    {"name":"chapter.1"},
    {"name":"chapter.2"},
    {"name":"chapter.3"},
    {"name":"chapter.4"}
]
let pageText
//V39: промежуточный пул лобби — клик по вещи в сундуке больше НЕ кладёт её в инвентарь сразу,
//а только ОТМЕЧАЕТ её (жёлтая рамка вокруг иконки). Перенос отмеченного в инвентарь происходит
//один раз — при нажатии кнопки старта забега («Далее», см. takeSelected). Отмечать больше,
//чем влезает в инвентарь героя, нельзя (решение по постановке V39).
let lobbySelect = []     // iMeta отмеченных вещей (в порядке отметки)
let lobbySelFrames = {}  // iMeta -> элемент жёлтой рамки
function lobby(lose,next,pageChest=0) {
    del()
    //E-17: карточка героя при наведении может висеть со старой перерисовки — гасим
    //вместе со слоем (remove() по отцеплённым узлам безвреден, нужен ради массива)
    heroTipDel()
    //V66b: таверна — ни забег (1), ни экран очков (2). Раньше после возврата из вылазки
    //start оставался 2, и тик в лобби продолжал крутить ветку экрана результатов
    //(animPlay/rollNumbers каждые 3 тика) — нормализуем состояние при любом входе
    status.start = 0
    //V39: пул отметок не переживает ни одну перерисовку лобби (апгрейд, страница сундука,
    //загрузка сейва, вход извне) — рамки уносит del(), здесь сбрасываем состояние (решение
    //по постановке V39: сброс при любой перерисовке)
    lobbySelect = []
    lobbySelFrames = {}
    //V40: зажим мета-прогресса в допустимые границы (V65: глав теперь ЧЕТЫРЕ). Старые
    //сохранения могли принести page/pageMax за пределами 1..4 — такая мета роняла changePage
    //(pages[page-1].name). Записи выше четвёртой главы удаляем, save() ниже перезаписывает сейв
    status.meta.page > 4 && (status.meta.page = 4)
    status.meta.pageMax > 4 && (status.meta.pageMax = 4)
    status.meta.page < 1 && (status.meta.page = 1)
    status.meta.pageMax < 1 && (status.meta.pageMax = 1)
    //V61: музыка таверны включается НЕМЕДЛЕННО через шину (старый таймаут 1000мс с флагом
    //musicInit и guard'ами «не переключать посреди игры/на заставке» удалён: порядок
    //переключений разруливает сама шина — звучит всегда последняя команда playTrack,
    //а недекодированный файл добирается из decode-callback)
    playTrack(TRACK.tavern)
    status.settings.lose = lose
    status.settings.next = next
    save()
    screenPic.push(image(svgArr[2],0,0,544,1080,"./images/UI/panels/panelVert.png"))
    screenPic.push(image(svgArr[2],1376,0,544,1080,"./images/UI/panels/panelVert.png"))
    screenPic.push(image(svgArr[2],544,0,832,1080,"./images/lobby/1.png"))
    screenPic.push(text(svgArr[2],960,140,"0pt","50pt","black","4px",`rgb(204, 153, 102)`,T(pages[status.meta.page-1].name),{"id":"delItemText","size":60,"font":"baseFont4","anchor":"middle","blur":"filter: drop-shadow(0 0 14px rgba(204, 153, 100, 1))"}))
    pageText = screenPic[screenPic.length-1]
    screenPic.push(text(svgArr[2],1920/2,944,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T(heroesArr[status.hero.class].name),{"id":"delItemText","size":42,"font":"baseFont4","anchor":"middle"}))
    heroName = screenPic[screenPic.length-1]
    //V74: все герои открыты сразу — силуэты UI/doll/0-3.png и проверка openHeroes удалены,
    //клик по любому герою выбирает его (спрайты UI/doll/T0-T3.png)
    //E-17: наведение на куклу открывает карточку героя (heroTip, как карточка врага в
    //enemyHover.js). hoverOpa здесь НЕ ставим: backend перезаписывает им funcShow/funcShowOut
    for (let i = 0; i < heroesArr.length; i++) {
        screenPic.push(image(svgArr[2],heroesArr[i].x,heroesArr[i].y,heroesArr[i].w,heroesArr[i].h,"./images/UI/doll/T"+i+".png",{"func":e=>{svgArr[2].append(e.target);chengeHero(i)},"funcShow":e=>heroTip(i,e),"funcShowOut":heroTipDel,"opacity":"0.01"}))
    }
    //V59: спрайт кнопки — пустой emptyButton.png (341×96) вместо next.png с запечённым текстом
    screenPic.push(image(svgArr[2],1920/2-341/2,960,341,96,"./images/UI/panels/buttons/button.png",{"glow":1,"func":()=>{status.rectShadow = 1;playback(strike[14].vol,0,0,3*status.settings.soundVolume);status.nextFunction = () => {takeSelected();comix()}}}))
    //V58: подпись кнопки — локализованный SVG-текст поверх пустого спрайта
    screenPic.push(text(svgArr[2],1920/2,1020,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("lobby.next"),{"id":"delItemText","size":48,"font":"baseFont4","anchor":"middle"}))
    screenPic.push(image(svgArr[2],1610,14,48,48,"./images/UI/point.png"))
    screenPic.push(text(svgArr[2],1700,51,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,status.meta.points,{"id":"delItemText","size":42,"font":"baseFont4","anchor":"middle"}))
    if (status.meta.pageMax > 1 || lose === true) {viewMetaInv(pageChest)}
    if (status.meta.pageMax > 1 || lose === true) {viewUpgrades()}
    !status.settings.next && status.meta.pageMax > 1 && viewPages()
    status.meta.pageMax > 1 && viewEnemy()
    screenPic.push(image(svgArr[2],560,10,"208px","60px","./images/UI/panels/buttons/icon4.png",{"glow":1,"func":()=>{clickButton(3)}}))
    //V73: подпись кнопки настроек в лобби — на 48px правее центра (иконка на спрайте слева)
    screenPic.push(text(svgArr[2],690,51,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("settings.title"),{"id":"delItemText","size":36,"font":"baseFont4","anchor":"middle"}))
    screenPic.push(image(svgArr[2],860,10,"208px","60px","./images/UI/panels/buttons/button.png",{"glow":1,"func":()=>{playback(strike[14].vol,0,0,3*status.settings.soundVolume);saveToFile()}}))
    screenPic.push(text(svgArr[2],964,54,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("lobby.save"),{"id":"delItemText","size":48,"font":"baseFont4","anchor":"middle"}))
    screenPic.push(image(svgArr[2],1160,10,"208px","60px","./images/UI/panels/buttons/button.png",{"glow":1,"func":()=>{playback(strike[14].vol,0,0,3*status.settings.soundVolume);loadFromFile()}}))
    screenPic.push(text(svgArr[2],1264,54,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("lobby.load"),{"id":"delItemText","size":48,"font":"baseFont4","anchor":"middle"}))
}
//V74: выбор героя без проверки открытия — закрытых героев и кнопки «ОТКРЫТЬ» больше нет
function chengeHero(hero=0) {
    status.hero.class = hero
    heroName.textContent = T(heroesArr[hero].name)
}

//----- E-17: карточка героя при наведении на куклу -----
//Оформление повторяет карточку врага при наведении (enemyHover.js, та же вёрстка, что в
//Библиотеке): рамка и фон те же, имя сверху, портрет data.heroes[i].img (192×288) вписан
//в коробку слева, начальные характеристики (5 статов из data.js, до очков прокачки)
//справа колонкой, описание геймплея (hero.N.desc) внизу во всю ширину с переносом строк.
//Окно ставится справа от куклы (клампы по краям viewBox 1920×1080), целиком pointer-events:
//none — клик по кукле и чужие подсказки сквозь него работают как раньше.
const HT_W = 392, HT_H = 420
const HT_NAME_SIZE = 32, HT_NAME_Y = 40
const HT_IMG_MAX_W = 134, HT_IMG_MAX_H = 202, HT_IMG_X = 24, HT_IMG_Y = 64
const HT_STAT_SIZE = 26, HT_STAT_X = 176, HT_STAT_Y = 88, HT_STAT_STEP = 34
const HT_DESC_SIZE = 22, HT_DESC_Y = 288, HT_DESC_H = 116
const HT_COL = "rgb(204, 153, 102)"
let heroTipNodes = []
function heroTip(i,e) {
    heroTipDel()
    //позиция: справа от куклы, клампы краёв (у правого края переворот влево не нужен —
    //куклы лежат левее центра, но кламп оставляем на случай будущих перестановок)
    const kx = e.target.x.animVal.value, ky = e.target.y.animVal.value
    let x = kx + heroesArr[i].w + 18
    x + HT_W > 1912 && (x = kx - HT_W - 18)
    x < 8 && (x = 8)
    let y = ky - 24
    y + HT_H > 1072 && (y = 1072 - HT_H)
    y < 8 && (y = 8)
    const h = data.heroes[i]
    heroTipNodes.push(rect(svgArr[2],x,y,HT_W,HT_H,HT_COL,"1px","rgba(16,12,10,0.92)",{"rx":"6px"}))
    heroTipNodes.push(text(svgArr[2],x+HT_W/2,y+HT_NAME_Y,"0pt","50pt","black","2px",HT_COL,T(h.className),{"size":HT_NAME_SIZE,"font":"baseFont4","anchor":"middle"}))
    //портрет героя вписан в коробку ≤134×202 (пропорция 2:3 сохраняется)
    const fit = Math.min(HT_IMG_MAX_W/192, HT_IMG_MAX_H/288)
    heroTipNodes.push(image(svgArr[2],x+HT_IMG_X,y+HT_IMG_Y,Math.round(192*fit),Math.round(288*fit),h.img))
    //начальные характеристики: 5 статов из data.js (Сила/Ловкость/Здоровье/Скорость/Мудрость)
    for (let j = 0; j < h.stats.length; j++) {
        heroTipNodes.push(text(svgArr[2],x+HT_STAT_X,y+HT_STAT_Y+j*HT_STAT_STEP,"0pt","50pt","black","2px",HT_COL,T(h.stats[j].name)+": "+h.stats[j].value,{"size":HT_STAT_SIZE,"font":"baseFont4"}))
    }
    //описание геймплея — нативный html-блок с переносом по словам (как desc врага);
    //id — тестовая ручка: dumpUI нативные тексты не обходит (children слоя их не регистрируют)
    heroTipNodes.push(nativeHtml(svgArr[2],x+HT_IMG_X,y+HT_DESC_Y,HT_W-HT_IMG_X*2,HT_DESC_H,"black","2px",HT_COL,T("hero."+i+".desc"),{"size":HT_DESC_SIZE,"font":"baseFont4","id":"heroTipDesc"}))
}
function heroTipDel() {
    for (let i = 0; i < heroTipNodes.length; i++) heroTipNodes[i].remove()
    heroTipNodes = []
}
function viewMetaInv(pageChest) {
    let lengthEmpty = status.meta.metaInvLen
    for (let i = 0; i < lengthEmpty; i++) {
        screenPic.push(image(svgArr[2],70 + i%3 * 140,130 + Math.trunc(i/3) * 140,128,128,"./images/UI/panels/inv/emptyCell.png"))
    }
    let lengthInv = status.meta.inv.length
    lengthInv > 18 && (lengthInv = 18)
    for (let i = 0; i < lengthInv; i++) {
        let iTotal = 18 * pageChest + i
        if(!status.meta.inv[iTotal]) continue
        let obj = JSON.parse(JSON.stringify(status.meta.inv[iTotal]))
        //V94: обводка редкости под спрайтом — та же, что вокруг спрайта в тултипе
        //(рамка rarityColor 2px + свечение). rect без func/hover сам получает
        //pointer-events:none — клики/подсказки спрайта под ним не трогает.
        //V95: рамку/свечение можно отключить в Настройках
        let rc = rarityColor(obj.rarity)
        itemFrameOn() && screenPic.push(rect(svgArr[2],70 + i%3 * 140,130 + Math.trunc(i/3) * 140,128,128,rc,"2px","none",{"rx":"3px"}))
        let lobbyOpts = {"id":13+i,"func":e=>toggleLobbySelect(e,iTotal,70 + i%3 * 140,130 + Math.trunc(i/3) * 140,pageChest),"funcShow":e => {e.buttons !== 1 ? tip(e,obj) : tipDel()},"funcShowOut":tipDel,"item":obj}
        itemGlowOn() && (lobbyOpts.blur = "filter: drop-shadow(0 0 4px "+rc+")")
        screenPic.push(image(svgArr[2],70 + i%3 * 140,130 + Math.trunc(i/3) * 140,128,128,obj.img,lobbyOpts))
    }
    screenPic.push(image(svgArr[2],240,19,32,36,"./images/dungeon/drop/item1.png"))
    screenPic.push(text(svgArr[2],310,50,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,status.meta.metaInvLen,{"id":"delItemText","size":42,"font":"baseFont4","anchor":"middle"}))
    screenPic.push(text(svgArr[2],278,1058,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("lobby.hint.mark"),{"id":"delItemText","size":28,"font":"baseFont4","anchor":"middle"}))

    for (let i = 0; i < status.meta.metaPageNum; i++) {
        //V60: рамочка вокруг числа ВЫБРАННОЙ страницы сундука (золотая, рисуется под числом).
        //Смена страницы = полная перерисовка лобби (changeChestPage → lobby) — рамка сама
        //переезжает на новый выбранный номер. pointer-events нет — кликает само число
        if(i === pageChest) {
            screenPic.push(rect(svgArr[2],195 + i*50 - 17,966,34,44,`rgb(204, 153, 102)`,"2px","none",{"rx":"4px"}))
        }
        screenPic.push(text(svgArr[2],195 + i*50,1000,"0pt","50pt","black","2px",i === pageChest ? "white" :`rgb(204, 153, 102)`,i+1,{"id":"delItemText","size":36,"font":"baseFont4","anchor":"middle","func": e => changeChestPage(i),"hover":"filter: drop-shadow(0 0 8px rgba(255,214,140,0.95)) drop-shadow(0 0 3px rgb(204,153,102))"}))
        screenPic[screenPic.length-1]
    }
    //V69b: стрелки переноса отмеченного (V57) больше не рисуются «сами по себе» при >1
    //страницы — их видимость считается динамически (updateMoveArrows): отмеченные есть +
    //целевая страница открыта и в ней есть место. При отрисовке лобби пул отметок пуст
    //(сброс в lobby) — стрелок пока нет, их откроет первая отметка
    updateMoveArrows(pageChest)
    //V69c: кнопка «Продать» — та же динамическая схема, пул пуст при отрисовке — скрыта
    updateSellButton(pageChest)
    //V92: «Снять» — та же схема, при отрисовке пула отметок нет — скрыта
    updateClearButton(pageChest)
}
//V69b: динамическая видимость стрелок переноса на соседние страницы сундука. Отметки
//ставятся/снимаются БЕЗ перерисовки лобби (toggleLobbySelect), поэтому стрелки
//пересчитываются точечно при каждом изменении пула. Стрелка показывается только когда:
//есть отмеченные (жёлтая рамка, V39), целевая страница открыта (в пределах metaPageNum)
//и в ней есть хотя бы одна свободная ячейка (решение по постановке: достаточно одной —
//перенос кладёт «сколько влезет», остаток остаётся отмеченным). Старые узлы снимаются
//remove(): для оторванных после del() узлов это безопасный no-op
let moveArrowLeft = undefined
let moveArrowRight = undefined
function updateMoveArrows(pageChest) {
    moveArrowLeft && moveArrowLeft.remove()
    moveArrowRight && moveArrowRight.remove()
    moveArrowLeft = undefined
    moveArrowRight = undefined
    if(moveArrowAllowed(pageChest - 1)) {
        moveArrowLeft = image(svgArr[2],95,962,61,61,"./images/UI/butLeft.png",{"glow":1,"func":()=>{moveSelectedItems(pageChest,pageChest-1)}})
        screenPic.push(moveArrowLeft)
    }
    if(moveArrowAllowed(pageChest + 1)) {
        moveArrowRight = image(svgArr[2],388,962,61,61,"./images/UI/butRight.png",{"glow":1,"func":()=>{moveSelectedItems(pageChest,pageChest+1)}})
        screenPic.push(moveArrowRight)
    }
}
//V69b: свободные ячейки страницы сундука (пустые и недописанные слоты inv считаем
//свободными — та же проверка «!», что и в самом переносе)
function chestPageFreeCells(targetPage) {
    let free = 0
    let base = 18 * targetPage
    for (let i = 0; i < 18; i++) {
        !status.meta.inv[base + i] && free++
    }
    return free
}
function moveArrowAllowed(targetPage) {
    if(lobbySelect.length === 0) return false
    if(targetPage < 0 || targetPage >= status.meta.metaPageNum) return false
    return chestPageFreeCells(targetPage) > 0
}
//V69c: кнопка «Продать» над ячейками сундука (слева от счётчика монет; спрайт button.png,
//как у «Сохранить»/«Загрузить») — динамическая, как стрелки переноса: видна только пока
//есть отмеченные (жёлтая рамка, V39). Подпись без func — pointer-events:none (svg.text),
//клики проходят на спрайт кнопки под ней
let sellButton = undefined
let sellButtonText = undefined
function updateSellButton(pageChest) {
    sellButton && sellButton.remove()
    sellButtonText && sellButtonText.remove()
    sellButton = undefined
    sellButtonText = undefined
    if(lobbySelect.length === 0) return
    sellButton = image(svgArr[2],200,76,150,54,"./images/UI/panels/buttons/button.png",{"glow":1,"func":()=>sellMarked(pageChest)})
    screenPic.push(sellButton)
    sellButtonText = text(svgArr[2],275,114,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("lobby.sell"),{"id":"delItemText","size":34,"font":"baseFont4","anchor":"middle"})
    screenPic.push(sellButtonText)
}
//V92: кнопка «Снять» справа от «Продать» — та же динамическая схема V69c: видна только пока
//есть отмеченные (жёлтая рамка, V39), первый toggle открывает, снятие последней прячет.
//Один клик снимает ВСЕ отметки разом (вместо снятия по одному клику на вещь). Без
//перерисовки лобби: данные сундука не меняются — только точечные обновления, как в
//toggleLobbySelect. Подпись без func — pointer-events:none, клики проходят на спрайт под ней
let clearButton = undefined
let clearButtonText = undefined
function updateClearButton(pageChest) {
    clearButton && clearButton.remove()
    clearButtonText && clearButtonText.remove()
    clearButton = undefined
    clearButtonText = undefined
    if(lobbySelect.length === 0) return
    clearButton = image(svgArr[2],360,76,150,54,"./images/UI/panels/buttons/button.png",{"glow":1,"func":()=>clearMarked(pageChest)})
    screenPic.push(clearButton)
    clearButtonText = text(svgArr[2],435,114,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("lobby.unmark"),{"id":"delItemText","size":34,"font":"baseFont4","anchor":"middle"})
    screenPic.push(clearButtonText)
}
//V92: снятие всех отметок разом: рамки убираются remove() (для оторванных после del()
//узлов это безопасный no-op), пул очищается, динамические элементы пересчитываются —
//при пустом пуле прячутся «Продать», стрелки переноса и сама «Снять»
function clearMarked(pageChest) {
    playback(strike[14].vol,0,0,3*status.settings.soundVolume)
    for (let k = 0; k < lobbySelect.length; k++) {
        lobbySelFrames[lobbySelect[k]] && lobbySelFrames[lobbySelect[k]].remove()
    }
    lobbySelect = []
    lobbySelFrames = {}
    updateMoveArrows(pageChest)
    updateSellButton(pageChest)
    updateClearButton(pageChest)
}
//V69c: цена продажи (решение юзера): обычный 5 / редкий 10 / эпический 20 / легендарный 50 /
//реликвия 1000. Реликвия проверяется ПЕРВОЙ: у неё rarity 4 И поле relic
function sellValue(obj) {
    if(isRelic(obj)) return 1000
    return obj.rarity === 4 ? 50 : obj.rarity === 3 ? 20 : obj.rarity === 2 ? 10 : 5
}
//V69c: продажа всех отмеченных: суммарная цена в мета-очки, вещи удаляются из сундука.
//Перерисовка остаётся на ТЕКУЩЕЙ странице; пул отметок сбрасывается правилом V39 — кнопка
//продажи и стрелки пересчитаются при отрисовке (пул пуст). save() вызывается внутри lobby
function sellMarked(pageChest) {
    playback(strike[14].vol,0,0,3*status.settings.soundVolume)
    let total = 0
    for (let k = 0; k < lobbySelect.length; k++) {
        let obj = status.meta.inv[lobbySelect[k]]
        if(!obj) continue
        total += sellValue(obj)
        status.meta.inv[lobbySelect[k]] = null
    }
    status.meta.points += total
    lobby(status.settings.lose,status.settings.next,pageChest)
}
//V57: перенос отмеченных (жёлтая рамка, V39) на соседнюю страницу сундука, кнопки слева/справа
//от номеров страниц. Порядок переноса — порядок отметок; каждый предмет кладётся в первую
//свободную ячейку целевой страницы, пока там есть место (решение по постановке: «сколько
//влезет»), непоместившиеся остаются отмеченными на текущей — их рамки восстанавливаются
//после перерисовки. Перерисовка остаётся на ТЕКУЩЕЙ странице (решение по постановке);
//сброс пула отметок при перерисовке — общее правило V39.
function moveSelectedItems(curPage,targetPage) {
    playback(strike[14].vol,0,0,3*status.settings.soundVolume)
    if(targetPage < 0 || targetPage >= status.meta.metaPageNum) return
    let base = 18 * targetPage
    let left = []
    for (let k = 0; k < lobbySelect.length; k++) {
        let iMeta = lobbySelect[k]
        let obj = status.meta.inv[iMeta]
        if(!obj) continue
        let done = false
        for (let i = 0; i < 18; i++) {
            if(!status.meta.inv[base + i]) {
                status.meta.inv[base + i] = obj
                status.meta.inv[iMeta] = null
                done = true
                break
            }
        }
        !done && left.push(iMeta)
    }
    lobby(status.settings.lose,status.settings.next,curPage)
    //восстанавливаем отметки непоместивших (без звуков — frame рисуется напрямую, как в
    //toggleLobbySelect; limit инвентаря не нужен — отметки место в инвентаре не занимают)
    lobbySelect = []
    lobbySelFrames = {}
    for (let k = 0; k < left.length; k++) {
        let i = left[k] - 18 * curPage
        let cx = 70 + i%3 * 140
        let cy = 130 + Math.trunc(i/3) * 140
        lobbySelect.push(left[k])
        lobbySelFrames[left[k]] = rect(svgArr[2],cx,cy,128,128,"rgb(200, 248, 9)","4px","none",{"opacity":"1"})
        screenPic.push(lobbySelFrames[left[k]])
    }
    //V69b: после переноса (частичного — тем более) стрелки пересчитываются: целевая
    //страница могла заполниться, отмеченных могло не остаться
    updateMoveArrows(curPage)
    //V69c: кнопка продажи живёт, пока есть непоместившиеся отметки
    updateSellButton(curPage)
    //V92: «Снять» живёт по тому же правилу
    updateClearButton(curPage)
}
//V39: клик по вещи в сундуке — переключение отметки в промежуточном пуле. Рамка — rect без
//func/hover, svg.rect сам ставит pointer-events:none, так что клики и подсказки иконки под ней
//работают как раньше. Повторный клик снимает отметку и рамку. Лимит: отмечать можно не больше,
//чем свободных слотов в инвентаре героя прямо сейчас (иначе перенос при старте не вместит).
//V69b: pageChest — страница, на которой стоит вещь; после каждой смены отметки стрелки
//переноса пересчитываются (открываются первой отметкой / закрываются снятием последней)
function toggleLobbySelect(e,iMeta,cx,cy,pageChest) {
    let idx = lobbySelect.indexOf(iMeta)
    if(idx >= 0) {
        lobbySelect.splice(idx,1)
        lobbySelFrames[iMeta].remove()
        lobbySelFrames[iMeta] = undefined
        playback(strike[14].vol,0,0,3*status.settings.soundVolume)
        updateMoveArrows(pageChest)
        //V69c: снятие последней отметки прячет и кнопку продажи
        updateSellButton(pageChest)
        //V92: и кнопку «Снять» (по постановке — прячется при снятии последней отметки)
        updateClearButton(pageChest)
        return
    }
    let free = 0
    let lengthInv = status.inventory.inv.length
    for (let i = 0; i < lengthInv; i++) {
        !status.inventory.inv[i] && free++
    }
    if(lobbySelect.length >= free) return
    lobbySelect.push(iMeta)
    lobbySelFrames[iMeta] = rect(svgArr[2],cx,cy,128,128,"rgb(200, 248, 9)","4px","none",{"opacity":"1"})
    screenPic.push(lobbySelFrames[iMeta])
    playback(strike[14].vol,0,0,3*status.settings.soundVolume)
    updateMoveArrows(pageChest)
    //V69c: первая отметка открывает кнопку продажи
    updateSellButton(pageChest)
    //V92: и кнопку «Снять»
    updateClearButton(pageChest)
}
//V39: старт забега («Далее») — переносим отмеченные вещи в инвентарь в порядке отметки,
//затем очищаем пул. Вместимости хватает гарантированно: лимит проверяется при каждой отметке.
function takeSelected() {
    let length = lobbySelect.length
    for (let k = 0; k < length; k++) {
        let iMeta = lobbySelect[k]
        let obj = status.meta.inv[iMeta]
        if(!obj) continue
        let lengthInv = status.inventory.inv.length
        for (let i = 0; i < lengthInv; i++) {
            if(!status.inventory.inv[i]) {
                status.inventory.inv[i] = obj
                status.meta.inv[iMeta] = null
                break
            }
        }
    }
    lobbySelect = []
    lobbySelFrames = {}
}
//V53: выбор легендарки для «Идентификации легенд». Порядок: отмеченные жёлтой рамкой (V39,
//в порядке отметок, только неидентифицированные легендарки), иначе первая по порядку слотов
//сундука. За одну прокачку идентифицируется ровно один предмет; перерисовка лобби после
//покупки сбрасывает пул отметок (правило V39) — следующие отмеченные нужно отметить заново.
function identifyMarked() {
    for (let k = 0; k < lobbySelect.length; k++) {
        let obj = status.meta.inv[lobbySelect[k]]
        if(obj && obj.rarity === 3 && !obj.set) {
            //V56: сет предмета записан при генерации в скрытый setN; у вещей старых сейвов
            //setN нет — все они «Великого вора», ставим сет 1
            obj.set = obj.setN || 1
            return
        }
    }
    let lengthInv = status.meta.inv.length
    for (let i = 0; i < lengthInv; i++) {
        let obj = status.meta.inv[i]
        if(obj && obj.rarity === 3 && !obj.set) {
            obj.set = obj.setN || 1
            return
        }
    }
}
function viewUpgrades() {
    screenPic.push(image(svgArr[2],1400,90,500,73,"./images/UI/panels/buttonUp.png",{"glow":1,"func":()=>upgrade(0)}))
    status.meta.metaInvLen < 18 ?
        screenPic.push(text(svgArr[2],1650,141,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("lobby.upg.cap",5+5*status.meta.metaInvLen),{"id":"delItemText","size":48,"font":"baseFont4","anchor":"middle"})) :
        screenPic.push(text(svgArr[2],1650,141,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("lobby.upg.cap.max"),{"id":"delItemText","size":48,"font":"baseFont4","anchor":"middle"}))
    for (let i = 0; i < 18; i++) {
        i < status.meta.metaInvLen ?
        screenPic.push(image(svgArr[2],1400 + i * 28,172,28,29,"./images/UI/panels/pointFull.png")) :
        screenPic.push(image(svgArr[2],1400 + i * 28,172,28,29,"./images/UI/panels/pointEmpty.png"))
    }
    screenPic.push(image(svgArr[2],1400,210,500,73,"./images/UI/panels/buttonUp.png",{"glow":1,"func":()=>upgrade(1)}))
    status.meta.invNum < 16 ?
        screenPic.push(text(svgArr[2],1650,261,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("lobby.upg.gear",30+10*status.meta.invNum),{"id":"delItemText","size":48,"font":"baseFont4","anchor":"middle"})) :
        screenPic.push(text(svgArr[2],1650,261,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("lobby.upg.gear.max"),{"id":"delItemText","size":48,"font":"baseFont4","anchor":"middle"}))
    for (let i = 0; i < 16; i++) {
        i < status.meta.invNum ?
        screenPic.push(image(svgArr[2],1400 + i * 28,292,28,29,"./images/UI/panels/pointFull.png")) :
        screenPic.push(image(svgArr[2],1400 + i * 28,292,28,29,"./images/UI/panels/pointEmpty.png"))
    }
    screenPic.push(image(svgArr[2],1400,330,500,73,"./images/UI/panels/buttonUp.png",{"glow":1,"func":()=>upgrade(2)}))
    status.meta.startKey < 3 ?
        screenPic.push(text(svgArr[2],1650,381,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("lobby.upg.keys",60+40*status.meta.startKey),{"id":"delItemText","size":48,"font":"baseFont4","anchor":"middle"})) :
        screenPic.push(text(svgArr[2],1650,381,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("lobby.upg.keys.max"),{"id":"delItemText","size":48,"font":"baseFont4","anchor":"middle"}))
    for (let i = 0; i < 3; i++) {
        i < status.meta.startKey ?
        screenPic.push(image(svgArr[2],1400 + i * 28,412,28,29,"./images/UI/panels/pointFull.png")) :
        screenPic.push(image(svgArr[2],1400 + i * 28,412,28,29,"./images/UI/panels/pointEmpty.png"))
    }
    screenPic.push(image(svgArr[2],1400,450,500,73,"./images/UI/panels/buttonUp.png",{"glow":1,"func":()=>upgrade(3)}))
    status.meta.dopHP < 10 ?
        screenPic.push(text(svgArr[2],1650,501,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("lobby.upg.hp",80+20*status.meta.dopHP),{"id":"delItemText","size":48,"font":"baseFont4","anchor":"middle"})) :
        screenPic.push(text(svgArr[2],1650,501,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("lobby.upg.hp.max"),{"id":"delItemText","size":48,"font":"baseFont4","anchor":"middle"}))
    for (let i = 0; i < 10; i++) {
        i < status.meta.dopHP ?
        screenPic.push(image(svgArr[2],1400 + i * 28,532,28,29,"./images/UI/panels/pointFull.png")) :
        screenPic.push(image(svgArr[2],1400 + i * 28,532,28,29,"./images/UI/panels/pointEmpty.png"))
    }
    screenPic.push(image(svgArr[2],1400,570,500,73,"./images/UI/panels/buttonUp.png",{"glow":1,"func":()=>upgrade(4)}))
    status.meta.startStat < 2 ?
        screenPic.push(text(svgArr[2],1650,621,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("lobby.upg.stat",200+200*status.meta.startStat),{"id":"delItemText","size":48,"font":"baseFont4","anchor":"middle"})) :
        screenPic.push(text(svgArr[2],1650,621,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("lobby.upg.stat.max"),{"id":"delItemText","size":48,"font":"baseFont4","anchor":"middle"}))
    for (let i = 0; i < 2; i++) {
        i < status.meta.startStat ?
        screenPic.push(image(svgArr[2],1400 + i * 28,652,28,29,"./images/UI/panels/pointFull.png")) :
        screenPic.push(image(svgArr[2],1400 + i * 28,652,28,29,"./images/UI/panels/pointEmpty.png"))
    }
    //V53: «Идентификация легенд» — сразу под «Начальным статом» (оставленное место). Активна
    //только пока в сундуке есть неидентифицированная легендарка: свечение кнопки = активность,
    //проверка дублируется в upgrade(6). Полная прокачка 18 уровней (цена 100, +50 за уровень).
    if(status.meta.identLegends < 18) {
        chestUnidentified() > 0 ?
            screenPic.push(image(svgArr[2],1400,690,500,73,"./images/UI/panels/buttonUp.png",{"glow":1,"func":()=>upgrade(6)})) :
            screenPic.push(image(svgArr[2],1400,690,500,73,"./images/UI/panels/buttonUp.png",{"func":()=>upgrade(6)}))
    }
    status.meta.identLegends < 18 ?
        screenPic.push(text(svgArr[2],1650,741,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("lobby.upg.ident",100+50*status.meta.identLegends),{"id":"delItemText","size":48,"font":"baseFont4","anchor":"middle"})) :
        screenPic.push(text(svgArr[2],1650,741,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("lobby.upg.ident.max"),{"id":"delItemText","size":48,"font":"baseFont4","anchor":"middle"}))
    for (let i = 0; i < 18; i++) {
        i < status.meta.identLegends ?
        screenPic.push(image(svgArr[2],1400 + i * 28,772,28,29,"./images/UI/panels/pointFull.png")) :
        screenPic.push(image(svgArr[2],1400 + i * 28,772,28,29,"./images/UI/panels/pointEmpty.png"))
    }
    if(status.meta.metaInvLen >= 18) {
        screenPic.push(image(svgArr[2],1400,828,500,73,"./images/UI/panels/buttonUp.png",{"glow":1,"func":()=>upgrade(5)}))
        status.meta.metaPageNum < 4 ?
        screenPic.push(text(svgArr[2],1650,879,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("lobby.upg.chest",500+500*status.meta.metaPageNum),{"id":"delItemText","size":48,"font":"baseFont4","anchor":"middle"})) :
        screenPic.push(text(svgArr[2],1650,879,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("lobby.upg.chest.max"),{"id":"delItemText","size":48,"font":"baseFont4","anchor":"middle"}))
        for (let i = 0; i < 4; i++) {
            i < status.meta.metaPageNum ?
            screenPic.push(image(svgArr[2],1400 + i * 28,910,28,29,"./images/UI/panels/pointFull.png")) :
            screenPic.push(image(svgArr[2],1400 + i * 28,910,28,29,"./images/UI/panels/pointEmpty.png"))
        }
    }
}
function upgrade(type) {
    playback(strike[14].vol,0,0,3*status.settings.soundVolume)
    switch (type) {
        case 0:
            if(status.meta.points >= 5+5*status.meta.metaInvLen && status.meta.metaInvLen < 18) {
                status.meta.points -= 5+5*status.meta.metaInvLen
                status.meta.metaInvLen++
                status.meta.inv.push(null)
            }
            break
        case 1:
            if(status.meta.points >= 30+10*status.meta.invNum && status.meta.invNum < 16) {
                status.meta.points -= 30+10*status.meta.invNum
                status.meta.invNum++
            }
            break
        case 2:
            if(status.meta.points >= 60+40*status.meta.startKey && status.meta.startKey < 3) {
                status.meta.points -= 60+40*status.meta.startKey
                status.meta.startKey++
            }
            break
        case 3:
            if(status.meta.points >= 80+20*status.meta.dopHP && status.meta.dopHP < 10) {
                status.meta.points -= 80+20*status.meta.dopHP
                status.meta.dopHP++
            }
            break
        case 4:
            if(status.meta.points >= 200+200*status.meta.startStat && status.meta.startStat < 2) {
                status.meta.points -= 200+200*status.meta.startStat
                status.meta.startStat++
            }
            break
        case 5:
            if(status.meta.points >= 500+500*status.meta.metaPageNum && status.meta.metaPageNum < 4) {
                status.meta.points -= 500+500*status.meta.metaPageNum
                status.meta.metaPageNum++
                for(let i = 0; i < 18; i++) {
                    status.meta.inv.push(null)
                }
            }
            break
        case 6:
            //V53: «Идентификация легенд» — активна только при наличии неидентифицированной
            //легендарки в сундуке; один уровень = одна идентификация (см. identifyMarked)
            if(status.meta.points >= 100+50*status.meta.identLegends && status.meta.identLegends < 18 && chestUnidentified() > 0) {
                status.meta.points -= 100+50*status.meta.identLegends
                status.meta.identLegends++
                identifyMarked()
            }
            break
    }
    //V52: покупка апгрейда — проверка «Открывателя»
    achMetaCheck()
    lobby(status.settings.lose,status.settings.next)
}
function viewPages() {
    screenPic.push(image(svgArr[2],612,92,61,61,"./images/UI/butLeft.png",{"glow":1,"func":()=>{changePage(0)}}))
    screenPic.push(image(svgArr[2],1240,92,61,61,"./images/UI/butRight.png",{"glow":1,"func":()=>{changePage(1)}}))
}
function changePage(num) {
    playback(strike[14].vol,0,0,3*status.settings.soundVolume)
    if(num === 0 && status.meta.page > 1) {status.meta.page--}
    if(num === 1 && status.meta.page < status.meta.pageMax && status.meta.page < pages.length) {status.meta.page++}
    pageText.textContent = T(pages[status.meta.page - 1].name)
    viewEnemy()
}
let enemesArrHead = []
function viewEnemy() {
    let length = enemesArrHead.length
    for (let i = 0; i < length; i++) {
        enemesArrHead[i].remove()
    }
    enemesArrHead = []
    for (let i = 0; i < status.meta.page; i++) {
        screenPic.push(image(svgArr[2],720 + i * 128,150,128,128,"./images/lobby/E"+i+".png",{"blur":"filter: drop-shadow(0 0 14px rgba(204, 153, 100, 1))"}))
        enemesArrHead.push(screenPic[screenPic.length-1])
    }
}
function changeChestPage(i) {
    lobby(status.settings.lose,status.settings.next,i)
}
export {lobby}