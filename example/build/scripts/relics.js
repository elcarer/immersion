//V67: реликвии — пятая (максимальная) редкость предмета: item.rarity 4, КРАСНЫЙ цвет
//тултипов/журнала (tip.js rarityColor, takeDrop, journal J_RARITY[5]). Единственный
//источник — дроп босса 4 этажа «Пустота» (voidBoss.bossDrop, 20% из распределения
//80/20 — V86). Реликвия НЕ имеет обычных характеристик — только одна уникальная способность
//(desc, красной строкой внизу тултипа); вставляется в ЛЮБОЙ слот куклы (types 0-12).
//Все способности читаются НА ЛЕТУ (read-time, как сетовые бонусы): equip/unEquip реликвии
//ничего не начисляют, надетость проверяют hasRelic/relicCount, «Сапфир» копирует источник
//динамически. Решения пользователя (V67): «Изумруд» прибавляет ПОЛНЫЕ проценты крита
//(включая базу мощи 100%); «Сапфир» копирует всё, кроме типа атаки и занимаемого слота:
//числа, броню/пояс, доп-способность (postfix) и принадлежность к сету.
//V68 (решение пользователя): реликвии УНИКАЛЬНЫ — каждая kind выпадает ОДИН раз за профиль
//(дублей не бывает, прежнее «стакаются свободно» отменено). Выпавшая kind пишется в
//meta.obtainedRelics (живёт между забегами, normMeta/defaultMeta), relicGenerate выбирает
//только из невыпадавших; пустой пул bossDrop обходит (10% дают item4), takeItem страхуется.
import { status } from "../scripts/start.js"
//V102: автонадевание реликвии в пустой слот при генерации (решение пользователя); цикл
//импортов relics → drag → takeDamage → relics допустим — все использования в рантайме
import { tryAutoEquip } from "../scripts/drag.js"

//семь реликвий (индекс = номер спрайта /items/5/N.png и поле relic у предмета)
export const RELICS = [
    {"title":"rel.0.name","desc":"rel.0.desc","img":"./images/items/5/0.png"}, //Вечный изумруд
    {"title":"rel.1.name","desc":"rel.1.desc","img":"./images/items/5/1.png"}, //Вечный цитрин
    {"title":"rel.2.name","desc":"rel.2.desc","img":"./images/items/5/2.png"}, //Вечный сапфир
    {"title":"rel.3.name","desc":"rel.3.desc","img":"./images/items/5/3.png"}, //Вечный берилл
    {"title":"rel.4.name","desc":"rel.4.desc","img":"./images/items/5/4.png"}, //Вечный жемчуг (V68)
    {"title":"rel.5.name","desc":"rel.5.desc","img":"./images/items/5/5.png"}, //Вечный рубин (V68)
    {"title":"rel.6.name","desc":"rel.6.desc","img":"./images/items/5/6.png"}, //Вечный алмаз (E-16)
]

function isRelic(item) {
    return !!item && item.relic !== undefined
}

//сколько реликвий вида kind (0-3) надето на куклу прямо сейчас (дубли считаются)
function relicCount(kind) {
    let count = 0
    let lengthDoll = status.inventory.doll.length
    for (let i = 0; i < lengthDoll; i++) {
        let d = status.inventory.doll[i]
        isRelic(d) && d.relic === kind && count++
    }
    return count
}

function hasRelic(kind) {
    return relicCount(kind) > 0
}

//сколько реликвий ещё НЕ выпадало (пул уникальности V68). Меты нет/старый сейв до
//normMeta — считаем все доступными (страховка, поля может не быть только в theory)
function relicPoolLeft() {
    let arr = status.meta && status.meta.obtainedRelics
    if(!Array.isArray(arr)) return RELICS.length
    let left = 0
    for(let i = 0; i < RELICS.length; i++) !arr[i] && left++
    return left
}

//генерация случайной реликвии (takeDrop → takeItem(5)); кладётся в первую свободную
//ячейку инвентаря, как itemGenerate. Характеристик нет: только title/desc/relic/img/type.
//V68: выбираем только среди ещё не выпадавших (пул уникальных), выпавшую kind пишем в
//meta.obtainedRelics; пул пуст — null (takeDrop страхуется обычным предметом item4)
function relicGenerate() {
    let arr = status.meta && status.meta.obtainedRelics
    let pool = []
    for(let i = 0; i < RELICS.length; i++) !(Array.isArray(arr) && arr[i]) && pool.push(i)
    if(!pool.length) return null
    let n = pool[Math.trunc(Math.random() * pool.length)]
    let r = RELICS[n]
    let item = {"title":r.title,"rarity":4,"relic":n,"types":[0,1,2,3,4,5,6,7,8,9,10,11,12],
        "type":{"desc1":"slot.relic","desc2":undefined},"img":r.img,"desc":r.desc}
    Array.isArray(arr) && (arr[n] = 1)
    //V102: пустой слот (реликвия встаёт в любой из 0-12) — сразу надевается, как у
    //itemGenerate; equip реликвии ничего не начисляет (способности read-time), поэтому
    //здесь достаточно постановки в doll. Иначе — первая свободная ячейка инвентаря
    if (!tryAutoEquip(item)) {
        let lengthInv = status.inventory.inv.length
        for (let i = 0; i < lengthInv; i++) {
            if(!status.inventory.inv[i]) {
                status.inventory.inv[i] = item
                break
            }
        }
    }
    return item
}

//------ «Вечный сапфир» (relic 2): живая копия параметров предмета из 1-й ячейки инвентаря ------
//Источник — ЛЮБОЙ предмет (не реликвия) в inv[0]; ячейка пуста или там реликвия — копии нет.
//Копия «живая»: читается в момент каждого расчёта, смена предмета в inv[0] меняет и копию.
function sapphireSource() {
    if (!hasRelic(2)) return null
    let src = status.inventory.inv[0]
    return src && !isRelic(src) ? src : null
}

//множитель копии = число надетых «Вечных сапфиров» (дубли складываются — решение V67)
function sapphireMult() {
    return relicCount(2)
}

//копия урона (damage) — прибавка к минимальному урону оружия (countDopStats)
function sapphireDamage() {
    let s = sapphireSource()
    return s && s.damage ? s.damage * sapphireMult() : 0
}

//копия базового стата группы i (0-4; спец-статы 5/6 — у них отдельные функции ниже)
function sapphireStat(i) {
    let s = sapphireSource()
    return s && s.stat !== undefined && s.stat === i ? s.statCount * sapphireMult() : 0
}

//копия доп. стата (dopType/dop)
function sapphireDop(dopStat) {
    let s = sapphireSource()
    return s && s.dopType === dopStat ? s.dop * sapphireMult() : 0
}

//копия брони щита (спец-стат 6) — читается там же, где status.info.armor
function sapphireArmor() {
    let s = sapphireSource()
    return s && s.stat === 6 ? s.statCount * sapphireMult() : 0
}

//копия ячеек пояса (спец-стат 5) — читается в belt.js рядом с status.info.beltCell
function sapphireBelt() {
    let s = sapphireSource()
    return s && s.stat === 5 ? s.statCount * sapphireMult() : 0
}

//копия доп-способности (postfix, V56): счётчики героя читают +abilCopyBonus(counter).
//counter — имя поля status.info, ключ способности тот же, что проверяет equip (drag.js)
const ABIL_COUNTER = {"poisonus":"iabil.0.desc","expous":"iabil.1.desc","lifeus":"iabil.2.desc","luckus":"iabil.3.desc","fameus":"iabil.4.desc","greedus":"iabil.5.desc"}
function abilCopyBonus(counter) {
    let s = sapphireSource()
    return s && s.abil && s.abil.desc === ABIL_COUNTER[counter] ? sapphireMult() : 0
}

//------ «Вечный алмаз» (relic 6, E-16): +10% ко всем 5 основным статам героя ------
//Прибавка считается ОТ ТЕКУЩЕГО значения стата (база: очки героя + «Сапфир» +
//доп-статы предметов) с округлением ВВЕРХ; встроена в формулы value1 в countDopStats —
//read-time, снятие реликвии откатывает статы. Второго алмаза не бывает (уникальность
//V68), множитель надетых не нужен.
function diamondStatBonus(base) {
    return hasRelic(6) ? Math.ceil(base * 0.1) : 0
}

export {isRelic,relicCount,hasRelic,relicGenerate,relicPoolLeft,sapphireSource,sapphireDamage,sapphireStat,sapphireDop,sapphireArmor,sapphireBelt,abilCopyBonus,diamondStatBonus}
