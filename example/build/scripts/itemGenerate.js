import { status } from "../scripts/start.js"
//V56: фиксированные подтипы оружия/левой руки сетов (таблица в sets.js) — нужны
//генерации rarity 4; импорт живёт на уровне модуля, цикла нет (sets.js не импортирует нас)
import { SET_WEAPON_SUBTYPE, SET_OFFHAND_KIND } from "../scripts/sets.js"
let itemsParams = [
[2,4],[1,4],[0,3],[0,2],[0,1],[2,3],[1,2],[1,3],[3,4],[0,4]
]
//V57: число спрайтов по папкам предметов — берётся из манифеста предзагрузки
//resources.json (тот перегенерируется resources-update.py при каждом добавлении
//спрайтов). Генерация использует ВСЕ спрайты папки, а не только первые записи
//titleArr: новый спрайт, положенный в папку, подхватывается без правок кода.
//Манифест недоступен (например открытие с file://) — spriteCounts остаётся null,
//generation падает в fallback на длины titleArr (поведение до V57).
let spriteCounts = null
fetch("./images/resources.json").then(r => r.ok ? r.json() : Promise.reject(0)).then(list => {
    let map = {}
    for (let i = 0; i < list.length; i++) {
        let p = list[i]
        let m = p.slice(0, 6) === "items/" ? /^(\d+)\/(\d+)\/(\d+)(?:\/(\d+))?\.png$/.exec(p.slice(6)) : null
        if (!m) continue
        let key = m[4] !== undefined ? m[1] + "/" + m[2] + "/" + m[3] : m[1] + "/" + m[2]
        map[key] = (map[key] || 0) + 1
    }
    spriteCounts = map
}).catch(() => {})
//число файлов в папке предметов (ключ "r/тип" у слотов, "r/тип/подтип" у оружия/левой руки);
//0 — ключа нет (или манифест ещё не загружен)
function spriteCount(key) {
    return spriteCounts ? spriteCounts[key] || 0 : 0
}
function itemGenerate(rarity) {
    let type = Math.trunc(Math.random() * 13)
    let stat
    type < 10 && (stat = itemsParams[type][Math.trunc(Math.random() * 2)])
    let count = Math.trunc(Math.random() * 3) + rarity
    let dop = 0
    let dopType
    let desc = "itemdesc.1"
    if (rarity === 2) {
        dop += Math.trunc(Math.random() * 4) + 3
        desc = "itemdesc.2"
        dopType = Math.trunc(Math.random() * 15)
    }
    if (rarity === 3) {
        dop += Math.trunc(Math.random() * 4) + 6
        desc = "itemdesc.3"
        dopType = Math.trunc(Math.random() * 15)
    }
    if (rarity === 4) {
        dop += Math.trunc(Math.random() * 4) + 9
        desc = "itemdesc.4"
        dopType = Math.trunc(Math.random() * 15)
    }
    //V56/V57: заголовок и спрайт. titleIdx — индекс НАЗВАНИЯ в titleArr: для слотов 0-10
    //это номер названия (спрайт-вариант с V57 живёт в отдельной переменной variant), для
    //оружия (11) — подтип (индекс атаки), для левой руки (12) — вид (0 щит +броня /
    //1 +урон). Редкость 4 (сетовый предмет): сначала равновероятно сет 1-4, спрайт-вариант
    //= сет-1 (0 «Великий вор», 1 «Учёная волшебница», 2 «Победитель турниров»,
    //3 «Доблестный небожитель»); у новых сетов подтип оружия/вид левой руки фиксированы
    //(SET_WEAPON_SUBTYPE/SET_OFFHAND_KIND), у «Великого вора» — как раньше, случайно.
    //Номер сета прячется в item.setN и переносится в item.set только «Идентификацией
    //легенд» (lobby) — до того предмет в бонусы и тултип сета не входит.
    let setN = 0
    let title
    let titleIdx
    let attack = undefined
    //V58: префикс редкости («Мощный», «Древний»…) — отдельным КЛЮЧОМ в item.prefix,
    //собирается в строку только при показе (localization.itemName) — иначе локализация
    //склеенной строки невозможна
    let prefixKey = undefined
    //V57: индекс файла спрайта в папке (у слотов 0-10 — вариант, у оружия/левой руки —
    //файл внутри папки подтипа/вида); на редкости 1-3 выбирается из ВСЕХ файлов папки
    let variant = 0
    if (rarity === 4) {
        setN = Math.trunc(Math.random() * 4) + 1
        variant = setN - 1
        titleIdx = variant
        if (type === 11) {
            let fixed = SET_WEAPON_SUBTYPE[setN]
            titleIdx = fixed !== null ? fixed : Math.trunc(Math.random() * 10)
            attack = titleIdx
            title = setTitleArr[11][variant][titleIdx]
        } else if (type === 12) {
            let fixedK = SET_OFFHAND_KIND[setN]
            titleIdx = fixedK !== null ? fixedK : Math.trunc(Math.random() * 2)
            title = setTitleArr[12][variant][titleIdx]
        } else {
            title = setTitleArr[type][variant][0]
        }
    } else {
        //V56a: пул оружия редкостей 1-3 единый (titleArr[type][rarity-1], подтипы 0-9,
        //«лабрис» на индексе 9) — ошибочное исключение подтипа 9 на редкости 2 удалено:
        //спрайт /2/11/9/0.png существует и был корректно перенесён при пересортировке V56
        let titleHref = createTitle(type,rarity-1)
        title = titleHref[0]
        titleIdx = titleHref[1]
        //V57: спрайт — из ВСЕХ файлов папки. Оружие: подтип (он же индекс атаки) = titleIdx,
        //вариант — любой файл папки подтипа. Левая рука: вид (0 щит +броня / 1 +урон) =
        //titleIdx, вариант — любой файл папки вида. Слоты 0-10: бросок по max(названий,
        //спрайтов), название идёт по кругу row[idx % len] (новые спрайты переиспользуют
        //существующие названия; если дописать их в titleArr — попарно привяжутся к спрайтам),
        //файл спрайта — idx % число файлов
        if (type === 11) {
            attack = titleIdx
            variant = Math.trunc(Math.random() * (spriteCount(rarity + "/11/" + titleIdx) || 1))
        } else if (type === 12) {
            variant = Math.trunc(Math.random() * (spriteCount(rarity + "/12/" + titleIdx) || 1))
        } else {
            let row = titleArr[type][rarity - 1]
            let n = spriteCount(rarity + "/" + type) || row.length
            let idx = Math.trunc(Math.random() * (row.length > n ? row.length : n))
            title = row[idx % row.length]
            titleIdx = idx % row.length
            variant = idx % n
        }
        rarity > 1 && (prefixKey = prefixArr[dopType])
    }
    let typeCell
    //защита от рассинхрона списков оружия и toolTipArr: неизвестный индекс не должен ронять генерацию
    //(fallback — тоже ключи: wt.9 «рубящее», hand.1 «рука»)
    type === 11 ? typeCell = {"desc1":(toolTipArr[attack]||["wt.9","hand.1"])[0],"desc2":(toolTipArr[attack]||["wt.9","hand.1"])[1]} : typeCell = {"desc1":toolTipArrArm[type],"desc2":undefined}
    let damage
    attack !== undefined ? damage = count : damage = undefined
    let statCount
    type !== 11 ? statCount = count : statCount = undefined
    type !== 11 ? true : stat = undefined
    if(type === 10) {stat = 5; statCount = rarity}
    if(type === 12 && titleIdx === 0) {stat = 6; statCount = rarity}
    if(type === 12 && titleIdx === 1) {damage = rarity}
    //V58: «руки» теперь ключ hand.2 — двуручное оружие даёт +1 урон по прежнему правилу
    typeCell.desc2 === "hand.2" && (damage++)
    //V56/V57: путь спрайта. Оружие/левая рука — <редкость>/11|12/<подтип|вид>/<вариант>.png,
    //остальные слоты — <редкость>/<тип>/<вариант>.png; на редкости 4 вариант = сет-1
    //(0 «Великий вор» … 3 «Доблестный небожитель»), на редкостях 1-3 — случайный файл
    //папки (V57: используются ВСЕ спрайты; у оружия/левой руки в папках пока только
    //0.png — работает как прежний «всегда 0», новые файлы подхватятся сами)
    let img = type === 11 ?
        "./images/items/"+rarity+"/11/"+titleIdx+"/"+variant+".png" :
        type === 12 ?
            "./images/items/"+rarity+"/12/"+titleIdx+"/"+variant+".png" :
            "./images/items/"+rarity+"/"+type+"/"+variant+".png"
    //V58: title/prefix/postfix — ключи; строкой имя собирает localization.itemName при показе.
    //title у вещей старых сейвов — русская строка: itemName пропускает её как есть (fallback)
    let item = {"title":title,"prefix":prefixKey,"damage":damage,"attack":attack,"rarity":rarity-1,"types":[type],"type":typeCell,"img":img,"desc":desc,"dop":dop,"dopType":dopType,"stat":stat,"statCount":statCount}
    if (rarity > 2) {
        let rand = Math.trunc(Math.random() * postfixArr.length)
        //V56: доп-способность ставится и легендаркам; сам постфикс-текст у сетовых
        //(rarity 4) по-прежнему не дописывается — заголовок сета остаётся чистым
        item.abil = postfixArr[rand].abil
        rarity < 4 && (item.postfix = postfixArr[rand].postfix)
    }
    setN > 0 && (item.setN = setN)
    let lengthInv = status.inventory.inv.length
    for (let i = 0; i < lengthInv; i++) {
        if(!status.inventory.inv[i]) {
            status.inventory.inv[i] = item
            break
        }
    }
    //V27: возвращаем сгенерированный предмет — takeDrop показывает его окошком-тулипом
    return item
}
let toolTipArrArm = ["slot.0","slot.1","slot.2","slot.3","slot.4","slot.5","slot.6","slot.7","slot.8","slot.9","slot.10","hand.1","hand.1"]
let toolTipArr = [["wt.0","hand.1"],["wt.1","hand.1"],["wt.2","hand.2"],["wt.3","hand.2"],["wt.4","hand.1"],["wt.5","hand.1"],["wt.6","hand.2"],["wt.7","hand.2"],["wt.8","hand.1"],["wt.9","hand.2"]]
let titleArr = [[["item.0.0.0","item.0.0.1","item.0.0.2","item.0.0.3"],["item.0.1.0","item.0.1.1","item.0.1.2"],["item.0.2.0","item.0.2.1","item.0.2.2","item.0.2.3"]],[["item.1.0.0","item.1.0.1","item.1.0.2","item.1.0.3"],["item.1.1.0","item.1.1.1","item.1.1.2"],["item.1.2.0","item.1.2.1","item.1.2.2","item.1.2.3"]],[["item.2.0.0","item.2.0.1","item.2.0.2","item.2.0.3"],["item.2.1.0","item.2.1.1","item.2.1.2"],["item.2.2.0","item.2.2.1","item.2.2.2","item.2.2.3"]],[["item.3.0.0","item.3.0.1","item.3.0.2"],["item.3.1.0","item.3.1.1","item.3.1.2"],["item.3.2.0","item.3.2.1","item.3.2.2","item.3.2.3"]],[["item.4.0.0","item.4.0.1","item.4.0.2"],["item.4.1.0","item.4.1.1","item.4.1.2"],["item.4.2.0","item.4.2.1","item.4.2.2","item.4.2.3"]],[["item.5.0.0","item.5.0.1","item.5.0.2"],["item.5.1.0","item.5.1.1","item.5.1.2"],["item.5.2.0","item.5.2.1","item.5.2.2","item.5.2.3"]],[["item.6.0.0","item.6.0.1","item.6.0.2"],["item.6.1.0","item.6.1.1","item.6.1.2"],["item.6.2.0","item.6.2.1","item.6.2.2","item.6.2.3"]],[["item.7.0.0","item.7.0.1","item.7.0.2"],["item.7.1.0","item.7.1.1","item.7.1.2"],["item.7.2.0","item.7.2.1","item.7.2.2","item.7.2.3"]],[["item.8.0.0","item.8.0.1","item.8.0.2"],["item.8.1.0","item.8.1.1","item.8.1.2"],["item.8.2.0","item.8.2.1","item.8.2.2","item.8.2.3"]],[["item.9.0.0","item.9.0.1","item.9.0.2"],["item.9.1.0","item.9.1.1","item.9.1.2"],["item.9.2.0","item.9.2.1","item.9.2.2","item.9.2.3"]],[["item.10.0.0","item.10.0.1","item.10.0.2"],["item.10.1.0","item.10.1.1"],["item.10.2.0","item.10.2.1","item.10.2.2"]],[["item.11.0.0","item.11.0.1","item.11.0.2","item.11.0.3","item.11.0.4","item.11.0.5","item.11.0.6","item.11.0.7","item.11.0.8","item.11.0.9"],["item.11.1.0","item.11.1.1","item.11.1.2","item.11.1.3","item.11.1.4","item.11.1.5","item.11.1.6","item.11.1.7","item.11.1.8","item.11.1.9"],["item.11.2.0","item.11.2.1","item.11.2.2","item.11.2.3","item.11.2.4","item.11.2.5","item.11.2.6","item.11.2.7","item.11.2.8","item.11.2.9"]],[["item.12.0.0","item.12.0.1"],["item.12.1.0","item.12.1.1"],["item.12.2.0","item.12.2.1"]]]
//V56: названия сетовых предметов (rarity 4) — setTitleArr[тип][сет-1][подтип]; у слотов
//0-10 подтип один. У новых сетов доступны только фиксированные подтипы оружия/левой руки
//(SET_WEAPON_SUBTYPE/SET_OFFHAND_KIND), остальные ячейки заполнены по образцу — на случай
//будущих спрайтов. Слова слотов и видов — те же, что у «Великого вора».
let setTitleArr = [[["iset.0.0.0"],["iset.0.1.0"],["iset.0.2.0"],["iset.0.3.0"]],[["iset.1.0.0"],["iset.1.1.0"],["iset.1.2.0"],["iset.1.3.0"]],[["iset.2.0.0"],["iset.2.1.0"],["iset.2.2.0"],["iset.2.3.0"]],[["iset.3.0.0"],["iset.3.1.0"],["iset.3.2.0"],["iset.3.3.0"]],[["iset.4.0.0"],["iset.4.1.0"],["iset.4.2.0"],["iset.4.3.0"]],[["iset.5.0.0"],["iset.5.1.0"],["iset.5.2.0"],["iset.5.3.0"]],[["iset.6.0.0"],["iset.6.1.0"],["iset.6.2.0"],["iset.6.3.0"]],[["iset.7.0.0"],["iset.7.1.0"],["iset.7.2.0"],["iset.7.3.0"]],[["iset.8.0.0"],["iset.8.1.0"],["iset.8.2.0"],["iset.8.3.0"]],[["iset.9.0.0"],["iset.9.1.0"],["iset.9.2.0"],["iset.9.3.0"]],[["iset.10.0.0"],["iset.10.1.0"],["iset.10.2.0"],["iset.10.3.0"]],[["iset.11.0.0","iset.11.0.1","iset.11.0.2","iset.11.0.3","iset.11.0.4","iset.11.0.5","iset.11.0.6","iset.11.0.7","iset.11.0.8","iset.11.0.9"],["iset.11.1.0","iset.11.1.1","iset.11.1.2","iset.11.1.3","iset.11.1.4","iset.11.1.5","iset.11.1.6","iset.11.1.7","iset.11.1.8","iset.11.1.9"],["iset.11.2.0","iset.11.2.1","iset.11.2.2","iset.11.2.3","iset.11.2.4","iset.11.2.5","iset.11.2.6","iset.11.2.7","iset.11.2.8","iset.11.2.9"],["iset.11.3.0","iset.11.3.1","iset.11.3.2","iset.11.3.3","iset.11.3.4","iset.11.3.5","iset.11.3.6","iset.11.3.7","iset.11.3.8","iset.11.3.9"]],[["iset.12.0.0","iset.12.0.1"],["iset.12.1.0","iset.12.1.1"],["iset.12.2.0","iset.12.2.1"],["iset.12.3.0","iset.12.3.1"]]]
let prefixArr = ["ipfx.0","ipfx.1","ipfx.2","ipfx.3","ipfx.4","ipfx.5","ipfx.6","ipfx.7","ipfx.8","ipfx.9","ipfx.10","ipfx.11","ipfx.12","ipfx.13","ipfx.14"]
//V66: способности эпических предметов (выдаются редкостям 3-4): 0 «ядовитость» (attack.js),
//1 «учёность» (openRoom), 2 «живучесть» (лечение), 3 «везучесть» (дроп),
//4 «известность» (damage.js checkExp — очки меты за уровни), 5 «корыстность» (openRoom — золото)
let postfixArr = [{"postfix":"ipost.0","abil":{"desc":"iabil.0.desc","desc2":"iabil.0.desc2"}},{"postfix":"ipost.1","abil":{"desc":"iabil.1.desc","desc2":"iabil.1.desc2"}},{"postfix":"ipost.2","abil":{"desc":"iabil.2.desc","desc2":"iabil.2.desc2"}},{"postfix":"ipost.3","abil":{"desc":"iabil.3.desc","desc2":"iabil.3.desc2"}},{"postfix":"ipost.4","abil":{"desc":"iabil.4.desc","desc2":"iabil.4.desc2"}},{"postfix":"ipost.5","abil":{"desc":"iabil.5.desc","desc2":"iabil.5.desc2"}}]
function createTitle(type,rarity) {
    let rand = Math.trunc(Math.random() * titleArr[type][rarity].length)
    return [titleArr[type][rarity][rand],rand]
}
export {itemGenerate}
