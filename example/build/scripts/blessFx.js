import { status } from "../scripts/start.js"
import { T } from "../scripts/localization.js"
import { svgArr,image,worldImage,picById,text,rect,nativeHtml } from "../scripts/svg.js"
import { screenPic } from "../scripts/del.js"
//V69: доп. кучка эха не должна застревать в стенах — тот же placeDrop, что у основного дропа
import { placeDrop } from "../scripts/dropSafe.js"
//живая привязка: доп. кучка встаёт в общую очередь подбора (useObject.js dropArr не переназначается)
import { dropArr } from "../scripts/useObject.js"
import { playback,strike,musicDuck } from "../scripts/sound.js"
import { journalAdd, J_GREEN } from "../scripts/journal.js"
//V75 «Кровавый пакт»: пересчёт статов (макс. ХП ×0.8) сразу при выдаче эффекта
import { countDopStats } from "../scripts/countDopStats.js"
import { changeHP } from "../scripts/takeDamage.js"

//V75: ШКАФЧИК С ДРЕВНОСТЯМИ — интерактивный объект 20, спрайт objects/101|101d.png один на
//все этажи (паттерн портала/рычага V64). После использования — пауза и три окна с тремя
//РАЗНЫМИ случайными благословениями из пула (уже взятые исключаются). Клик по окну выдаёт
//эффект ДО КОНЦА ЗАБЕГА (список status.info.blesses), вверх по центру встаёт иконка-подсказка
//effects/bless.png: ряд центрируется, наведение показывает информационное окно, уход курсора
//закрывает его. V77: ряд виден ТОЛЬКО при наведении курсора на верхнюю часть экрана (как
//topmenu). «Выйти»/ESC меню объект НЕ расходует (obj[11]=1 — переиспользование после
//выхода героя из зоны, как у алхимического стола). Взял благословение — obj[7]=1 и спрайт
//«d»-версии, как у прочих объектов. V77: первая выборка трёх эффектов запоминается в самом
//объекте (obj[14]) — отмена и повторное использование показывают ТЕ ЖЕ три, «перероллить»
//многократными откатами нельзя. Игра на паузе (status.pause=1, panels=11 — номер свободен:
//1 кукла, 2 карта, 5 древо, 6 инвентарь/настройки, 7 библиотека, 8 журнал, 9 алхимия, 10 полоса меню).
let COL = `rgb(204, 153, 102)`
//пул благословений: ключи bless.N.name / bless.N.desc (нумерация — как в постановке)
const BLESS_POOL = [1,2,3,4,5,6,7,8,9]
let ancientTemp = []
let ancientObj = null
let hintIcons = []
let blessTip = []

//активен ли эффект у героя (guard: у структур прошлого забега поля blesses может не быть)
function blessActive(id) {
    return Array.isArray(status.info && status.info.blesses) && status.info.blesses.indexOf(id) !== -1
}
//суммарный множитель скорости перемещения: Сын ветра +10%, Громила и Заучка по -10%
//(кламп 0.5 — даже все три эффекта сразу не утопят скорость)
function blessSpeedMult() {
    let m = 1
    blessActive(9) && (m += 0.1)
    blessActive(3) && (m -= 0.1)
    blessActive(4) && (m -= 0.1)
    return m < 0.5 ? 0.5 : m
}
//«Кровавый пакт»: максимум ХП ×0.8 — читается countDopStats при каждом пересчёте статов,
//поэтому бонус переживает смену предметов/уровней (в value2 не пишем, как у реликвий V67)
function blessMaxHpMult() {
    return blessActive(5) ? 0.8 : 1
}
//V75: открытие меню шкафчика — пауза, чёрная подложка, заголовок и три окна благословений
//(панель 380×560 на panel.png, иконка bless.png ×3, имя и переносимое описание)
function openAncient(obj) {
    ancientObj = obj
    status.pause = 1
    status.move = 0
    status.panels = 11
    musicDuck(1)
    //V77: слой НЕ скрываем на время сборки — меню единственное место, где foreignObject
    //строится под display:none, и у части движков такой текст потом не переносится (одна
    //строка; тултип иконок, построенный при видимом слое, переносится нормально). Скрытие
    //бессмысленно и для мигания: сборка синхронная, кадр красится одним куском после выхода
    ancientTemp.push(rect(svgArr[2],0,0,1920,1080,"black","1px","black"))
    ancientTemp.push(image(svgArr[2],520,50,919,73,"./images/UI/panels/endTop.png"))
    ancientTemp.push(text(svgArr[2],960,106,"0pt","50pt","black","2px",COL,T("obj.20.name"),{"id":"ancientTitle","size":56,"font":"baseFont4","anchor":"middle"}))
    ancientTemp.push(text(svgArr[2],960,152,"0pt","50pt","black","2px",COL,T("ancient.pick"),{"id":"ancientPick","size":30,"font":"baseFont4","anchor":"middle"}))
    //три РАЗНЫХ случайных эффекта из пула минус уже взятые (перемешивание Фишера—Йетса;
    //пул 9, шкафчиков максимум 4 за забег — трёх всегда хватает, но режем на всякий случай).
    //V77: первая выборка живёт в самом объекте (obj[14] — свободный индекс: у объектов
    //заняты 0-7 и 10-11, у ловушек 12-13 — таймеры фаз); повторное открытие берёт её из
    //памяти без нового перемешивания
    let picks = Array.isArray(obj[14]) && obj[14].length === 3 ? obj[14] : null
    if (!picks) {
        let left = []
        for (let i = 0; i < BLESS_POOL.length; i++) {
            !blessActive(BLESS_POOL[i]) && left.push(BLESS_POOL[i])
        }
        for (let i = left.length - 1; i > 0; i--) {
            let j = Math.trunc(Math.random() * (i + 1))
            let t = left[i]; left[i] = left[j]; left[j] = t
        }
        picks = left.slice(0,3)
        obj[14] = picks
    }
    for (let i = 0; i < picks.length; i++) {
        let id = picks[i]
        let x = 350 + i * 420
        ancientTemp.push(image(svgArr[2],x,230,380,560,"./images/UI/panels/panel.png",{"glow":1,"func":e => grantBless(id,ancientObj)}))
        ancientTemp.push(image(svgArr[2],x + 142,290,96,99,"./images/effects/bless.png"))
        ancientTemp.push(text(svgArr[2],x + 190,455,"0pt","50pt","black","2px",COL,T("bless." + id + ".name"),{"id":"ancientN"+i,"size":40,"font":"baseFont4","anchor":"middle"}))
        //R4.4: нативный html-блок с переносом по словам на ширине блока
        let fo = nativeHtml(svgArr[2],x + 30,495,320,260,"black","2px",COL,T("bless." + id + ".desc"),{"id":"ancientD"+i,"size":26,"font":"baseFont4"})
        ancientTemp.push(fo)
    }
    //кнопка выхода: закрыть меню и возобновить игру, объект остаётся используемым
    ancientTemp.push(image(svgArr[2],595,980,208,57,"./images/UI/panels/buttons/button.png",{"glow":1,"func":() => {playback(strike[14].vol,0,0,3*status.settings.soundVolume);ancientDel(0)}}))
    ancientTemp.push(text(svgArr[2],699,1020,"0pt","50pt","black","2px",COL,T("ui.exit"),{"id":"ancientExit","size":42,"font":"baseFont4","anchor":"middle"}))
}
//выдача благословения: в список забега, «Кровавый пакт» — сразу +2 очка характеристик и
//−20% к МАКСИМУМУ ХП (текущее обрезается до нового максимума), журнал, объект становится
//неактивным (obj[7]=1 + спрайт 101d.png), иконка-подсказка встаёт в ряд, меню закрывается
function grantBless(id,obj) {
    if (!id || !obj) return
    Array.isArray(status.info.blesses) || (status.info.blesses = [])
    status.info.blesses.push(id)
    if (id === 5) {
        status.info.upStat += 2
        countDopStats()
        let maxHp = parseInt(status.info.stats[2].dops[0].value2.slice(0,-1))
        status.info.hp > maxHp && (status.info.hp = maxHp)
        changeHP(document.getElementById("hpBarI"),document.getElementById("hpText"),"hp")
    }
    journalAdd(T("journ.bless",T("bless." + id + ".name")), J_GREEN)
    playback(strike[13].vol,0,0,2*status.settings.soundVolume)
    //объект использован: флаг + спрайт «d»-версии — защитный поиск по screenPic, как в alchemy
    obj[7] = 1
    let img = picById(obj[6]+"OI")
    if (img) {
        let href = img.getAttribute("href") || ""
        img.setAttribute("href", href.slice(0,-4)+"d"+href.slice(-4))
    }
    renderBlessHints()
    ancientDel(0)
}
//закрытие меню — общий closePanels (ESC/геймпад) и кнопка «Выйти»
function ancientDel(nomusic=0) {
    let length = ancientTemp.length
    for (let i = 0; i < length; i++) {
        ancientTemp[i].remove()
    }
    ancientTemp = []
    ancientObj = null
    status.move = 1
    status.panels = 0
    status.pause = 0
    nomusic === 0 && musicDuck(0)
}
//V77: ряд иконок виден ТОЛЬКО при наведении курсора на верхнюю часть экрана — как полоса
//меню topmenu (checkMenu в gameLoop.js): забег идёт, курсор выше y=100. V77a: полоса меню
//открывается ТЕМ ЖЕ наведением (panels=10), поэтому условие «panels===0» гасило ряд ровно
//в момент, когда курсор наверху, — ряд не мог появиться никогда. Теперь ряд виден и при
//открытой полосе (panels=10 — вкл. карту/журнал/библиотеку, держащие её через topMenu(1)),
//и в переходном состоянии «панели закрыты, курсор в верхней зоне». Прячется при уводе
//курсора вниз, открытии любой другой панели и вне забега; смена этажа чистит слой (del),
//ряд собирается заново только в активной зоне
function blessHintsShown() {
    return status.start === 1 && (status.panels === 10 || (status.panels === 0 && status.mouseY < 100))
}
//сборка ряда заново: прячем текущий, строим только если зона наведения активна
//(зовётся при выдаче/расходе эффекта и после отрисовки этажа — видимость сохраняется)
function renderBlessHints() {
    blessHintsHide()
    if (!blessHintsShown()) return
    let b = status.info && status.info.blesses
    if (!Array.isArray(b) || !b.length) return
    let total = b.length * 44 - 12
    let x0 = 960 - total / 2
    for (let i = 0; i < b.length; i++) {
        hintIcons.push(image(svgArr[2],x0 + i * 44,8,32,33,"./images/effects/bless.png",{"funcShow":e => showBlessTip(b[i],x0 + i * 44),"funcShowOut":hideBlessTip}))
    }
}
//скрытие ряда: иконки и открытое информационное окно гасятся вместе
function blessHintsHide() {
    hideBlessTip()
    let length = hintIcons.length
    for (let i = 0; i < length; i++) {
        hintIcons[i].remove()
    }
    hintIcons = []
}
//тик видимости — gameLoop зовёт каждый тик до блока паузы: ряд гаснет при открытой панели
//даже без движения мыши, появляется при возврате курсора в верхнюю зону; перестройка
//только на смене состояния, в установившемся режиме функция бесплатна
function blessHintsTick() {
    if (blessHintsShown()) {
        hintIcons.length === 0 && renderBlessHints()
    } else {
        hintIcons.length > 0 && blessHintsHide()
    }
}
//информационное окно под иконкой (имя + описание); тексты без func — pointer-events:none,
//наводение остаётся на иконке, уход курсора (funcShowOut) окно закрывает
function showBlessTip(id,ix) {
    hideBlessTip()
    let x = ix - 194
    x < 10 && (x = 10)
    x > 1490 && (x = 1490)
    blessTip.push(rect(svgArr[2],x,48,420,170,COL,"2px","black"))
    blessTip.push(text(svgArr[2],x + 210,84,"0pt","50pt","black","2px",COL,T("bless." + id + ".name"),{"size":30,"font":"baseFont4","anchor":"middle"}))
    let fo = nativeHtml(svgArr[2],x + 20,100,380,110,"black","2px",COL,T("bless." + id + ".desc"),{"size":22,"font":"baseFont4"})
    blessTip.push(fo)
}
function hideBlessTip() {
    let length = blessTip.length
    for (let i = 0; i < length; i++) {
        blessTip[i].remove()
    }
    blessTip = []
}
//эффект израсходован («Второе дыхание» спасло героя): убрать из списка забега —
//иконка-подсказка исчезает вместе с действием эффекта
function spendBless(id) {
    let b = status.info && status.info.blesses
    if (!Array.isArray(b)) return
    let i = b.indexOf(id)
    i !== -1 && b.splice(i,1)
    renderBlessHints()
}
//Хлебосол (10% для еды) / Золотое эхо (30% для золота): при выпадении такой кучки — ещё
//одна ТАКАЯ ЖЕ на соседнюю клетку. Зовётся из всех точек создания дропа; сама доп. кучка
//эхо больше не порождает (точки вызова не рекурсивны). V77: обязательна проверка АКТИВНОСТИ
//эффекта — раньше проверялось только существование списка благословений, и шанс качался
//у всех всегда (репорт: двойная еда без взятого «Хлебосола»)
function blessEcho(drop,x,y) {
    let isFood = typeof drop.img === "string" && drop.img.indexOf("drop/food.png") !== -1
    let isGold = typeof drop.img === "string" && drop.img.indexOf("drop/gold.png") !== -1
    if (!isFood && !isGold) return
    if (isFood && !blessActive(7)) return
    if (isGold && !blessActive(8)) return
    if (Math.random() >= (isFood ? 0.1 : 0.3)) return
    let side = Math.trunc(Math.random() * 4)
    let dx = side === 0 ? -32 : side === 1 ? 32 : 0
    let dy = side === 2 ? -32 : side === 3 ? 32 : 0
    screenPic.push(worldImage(svgArr[1],x + dx,y + dy,drop.w,drop.h,drop.img,{"id":screenPic.length-1}))
    dropArr.push(screenPic[screenPic.length - 1])
    //доп. кучка упала в стену/пустоту — переносим на свободную клетку рядом, как основной дроп
    placeDrop(screenPic[screenPic.length - 1],x + dx,y + dy,drop.w,drop.h)
}
export {blessActive,blessSpeedMult,blessMaxHpMult,blessEcho,spendBless,renderBlessHints,blessHintsTick,openAncient,ancientDel,ancientTemp}
