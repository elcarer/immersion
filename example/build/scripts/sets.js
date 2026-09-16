import { status } from "../scripts/start.js"
//V67: «Вечный берилл» (реликвия) считается предметом КАЖДОГО сета и удваивает численные
//сетовые бонусы; «Вечный сапфир» копирует принадлежность к сету источника из 1-й ячейки
import { relicCount, hasRelic, sapphireSource } from "../scripts/relics.js"
//V53: сетовая система легендарных предметов. Легендарки генерируются как itemGenerate(4),
//но ХРАНЯТСЯ с rarity 3 (золотой цвет тултипов). Мета-апгрейд «Идентификация легенд» (lobby)
//переносит предмету сундука скрытый номер сета setN в поле set — до него легендарка считается
//неидентифицированной: сетового окошка в тултипе не имеет и в сетовые бонусы не входит.
//V56: сетов ЧЕТЫРЕ (порядок = вариант спрайтов /items/4/<слот>/<сет-1>.png):
//0-вариант — «Великий вор», 1 — «Учёная волшебница», 2 — «Победитель турниров»,
//3 — «Доблестный небожитель». Бонусы считаются ОТДЕЛЬНО по каждому сету (setCount(set)).
//Старые сейвы: у предметов без setN идентификация ставит сет 1 — все старые легендарки
//принадлежали «Великому вору» (спрайт-вариант 0).
//V58: тексты сетов — ключи локализации (set.N.name/gen, set.N.b<K>.desc; метки «N предметов»
//общие — set.bl<K>). Отображение — T() в setTip (tip.js)
const SETS = [
    {"name":"set.1.name","gen":"set.1.gen","bonuses":[
        {"need":2,"label":"set.bl0","desc":"set.1.b0.desc"},
        {"need":4,"label":"set.bl1","desc":"set.1.b1.desc"},
        {"need":6,"label":"set.bl2","desc":"set.1.b2.desc"},
    ]},
    {"name":"set.2.name","gen":"set.2.gen","bonuses":[
        {"need":2,"label":"set.bl0","desc":"set.2.b0.desc"},
        {"need":4,"label":"set.bl1","desc":"set.2.b1.desc"},
        {"need":6,"label":"set.bl2","desc":"set.2.b2.desc"},
    ]},
    {"name":"set.3.name","gen":"set.3.gen","bonuses":[
        {"need":2,"label":"set.bl0","desc":"set.3.b0.desc"},
        {"need":4,"label":"set.bl1","desc":"set.3.b1.desc"},
        {"need":6,"label":"set.bl2","desc":"set.3.b2.desc"},
    ]},
    {"name":"set.4.name","gen":"set.4.gen","bonuses":[
        {"need":2,"label":"set.bl0","desc":"set.4.b0.desc"},
        {"need":4,"label":"set.bl1","desc":"set.4.b1.desc"},
        {"need":6,"label":"set.bl2","desc":"set.4.b2.desc"},
    ]},
]
//фиксированные подтипы оружия/левой руки новых сетов (индекс = номер сета; null — случайно,
//как у «Великого вора»). Подтип оружия = индекс атаки (3 посох, 4 молот/булава, 6 протазан/
//копьё); вид левой руки: 0 — щит (+броня), 1 — предмет на +урон (у Волшебницы — книга)
const SET_WEAPON_SUBTYPE = [null,null,3,4,6]
const SET_OFFHAND_KIND = [null,null,1,0,0]
//номер сета идентифицированного предмета: 0 — не сетовый или ещё неидентифицированный
//(set ставит только мета-апгрейд «Идентификация легенд»)
function itemSet(obj) {
    return !!obj && obj.rarity === 3 && obj.set ? obj.set : 0
}
//идентифицированный сетовый предмет (для тултипов/окна сравнения)
function isSetItem(obj) {
    return itemSet(obj) > 0
}
//сколько идентифицированных предметов СЕТА setN засчитано на кукле героя прямо сейчас
//V67: «Вечный берилл» — +1 (за каждую надетую) к КАЖДОМУ сету; «Вечный сапфир» — копия
//сета источника из 1-й ячейки инвентаря (по relicCount(2) за каждую надетую копию)
function setCount(setN) {
    let count = 0
    let lengthDoll = status.inventory.doll.length
    for (let i = 0; i < lengthDoll; i++) {
        itemSet(status.inventory.doll[i]) === setN && count++
    }
    count += relicCount(3)
    let src = sapphireSource()
    src && itemSet(src) === setN && (count += relicCount(2))
    return count
}

//V67 «Вечный берилл»: множитель ЧИСЛЕННЫХ сетовых бонусов (величины прибавок удваиваются;
//пороги «N предметов» не меняются, «+1 предмет» самого берилла не удваивается)
function setBonusMult() {
    return hasRelic(3) ? 2 : 1
}
//неидентифицированные легендарки в мета-сундуке — условие активности апгрейда
function chestUnidentified() {
    let count = 0
    let lengthInv = status.meta.inv.length
    for (let i = 0; i < lengthInv; i++) {
        let obj = status.meta.inv[i]
        obj && obj.rarity === 3 && !obj.set && count++
    }
    return count
}
//элитный/боссовый враг — общая проверка порогов всех боевых бонусов
function isBossElite(enemy) {
    return !!enemy && !!enemy.class && (enemy.class.boss === 1 || enemy.class.elite === 1)
}
// ---------------------------------------------------------------------------
// Бонусы в бою — все read-time: пересчитываются в момент события; уже сложившиеся
// комбинации экипировки не разбираются, когда число предметов сета падает ниже порога.
// ---------------------------------------------------------------------------
//Сет 2 «Волшебница» (2 предмета): множитель урона СПОСОБНОСТЕЙ героя по элитам/боссам
//(магические снаряды в damage.js countDamage и сплэши способностей в createSplash)
function setAbilDamageMult(enemy) {
    return setCount(2) >= 2 && isBossElite(enemy) ? 1 + 0.05 * setBonusMult() : 1
}
//Сет 2 «Волшебница» (4 предмета): прибавка к ставке таяния кулдаунов (activeSkillsCD,
//складывается со статом «Находчивость» и бафом статуи)
function setCdRateBonus() {
    return setCount(2) >= 4 ? 0.05 * setBonusMult() : 0
}
//Сет 2 «Волшебница» (6 предметов): шанс +1 золота при поднятии кучки (takeGold);
//rng — необязательная подмена генератора для тестов
function rollGoldPickup(rng) {
    return setCount(2) >= 6 && (rng || Math.random)() < 0.05 * setBonusMult()
}
//Сет 3 «Турниры» (2 предмета): множитель входящего урона ОТ элит/боссов (снаряды
//в damageHero.countDamage и контакт рывка в dashFx); floor — на малых уронах даёт
//видимое снижение (5 → 4), округление вверх/вниз к целому вернуло бы исходное
function setEliteDamageMult(enemy) {
    return setCount(3) >= 2 && isBossElite(enemy) ? 1 - 0.1 * setBonusMult() : 1
}
//Сет 3 «Турниры» (4 предмета): +1 брони — прибавка в takeDamage поверх info.armor
//(как баф магического щита статуи); V67: берилл удваивает — +2 брони
function setArmorBonus() {
    return setCount(3) >= 4 ? 1 * setBonusMult() : 0
}
//Сет 3 «Турниры» (6 предметов): шанс кучки золота на месте убитого врага (любого,
//включая элит и боссов); сам спавн — в enemyDie (enemyAI), рядом с дропом ключа у
//элит. rng — подмена генератора для тестов
function rollGoldKillPile(enemy, rng) {
    return setCount(3) >= 6 && (rng || Math.random)() < 0.01 * setBonusMult()
}
//Сет 4 «Небожитель» (2 предмета): модификатор скорости движения элит/боссов (−1 к
//enemy.stats.speed, минимум 1 — применяется в moveSpeed, enemyAI); на лету, без
//пересоздания уже заспавненных врагов
function setEliteSpeedMod(enemy) {
    return setCount(4) >= 2 && isBossElite(enemy) ? 1 : 0
}
//Сет 4 «Небожитель» (4 предмета): двуручное оружие занимает только одну руку —
//снимает конфликты «двуручное ↔ второй слот» в extraHandItems и старой ветке drag.js
function setTwoHandOneHand() {
    return setCount(4) >= 4
}
//Сет 4 «Небожитель» (6 предметов): множитель скорости перемещения героя (heroMove)
function setHeroSpeedMult() {
    return setCount(4) >= 6 ? 1 + 0.05 * setBonusMult() : 1
}
//Сет 1 «Великий вор» (2 предмета): множитель урона БАЗОВОЙ атаки по элитам/боссам
//(damage.js countDamage); V67: +10% → +20% под бериллом
function set1AttackDamageMult() {
    return setCount(1) >= 2 ? 1 + 0.1 * setBonusMult() : 1
}
//Сет 1 «Великий вор» (4 предмета): время использования интерактивных объектов
//60 тиков −10% (54); V67: берилл удваивает — 48 тиков (useObject)
function setUseTicks() {
    return setCount(1) >= 4 ? 60 - 6 * setBonusMult() : 60
}
//Сет 1 «Великий вор» (6 предметов): ловушки наносят врагам удвоенный урон (trapsFx);
//V67: берилл удваивает — ×4 (значение только под guard'ом setCount(1) >= 6)
function set1TrapDamageMult() {
    return 2 * setBonusMult()
}
export {SETS,SET_WEAPON_SUBTYPE,SET_OFFHAND_KIND,itemSet,isSetItem,setCount,chestUnidentified,setAbilDamageMult,setCdRateBonus,rollGoldPickup,setEliteDamageMult,setArmorBonus,rollGoldKillPile,setEliteSpeedMod,setTwoHandOneHand,setHeroSpeedMult,set1AttackDamageMult,setUseTicks,set1TrapDamageMult}
