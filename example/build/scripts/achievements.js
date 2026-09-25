//V52: достижения — 8 разовых наград, живущих в мете между забегами (meta.achievements —
//8 слотов, normMeta добивает старым сохранениям; metaItems их НЕ сбрасывает, как library).
//Список и все проверки собраны здесь; игровые скрипты зовут хуки в момент событий:
//  achTame — encounters.checkRat (крыса съела еду и стала ручной);
//  achKill — enemyAI.enemyDie (окно ~0.5с: 3+ смерти врагов = «одной атакой», решение пользователя);
//  achFloorStart — newGame (старт этажа: сброс флага «этаж без потерь» и счётчика окна);
//  achFloorEnd — nextFloor до ветвления (Ловкач / Гриндер / «Я сделал!» — status.levelFloor ещё старый);
//  achTick — gameLoop в активном блоке (любая потеря ХП героем за этаж гасит «чистый» этаж:
//  враги, ловушки, алтари, горение — один хук на все источники, сравнение с прошлым тиком);
//  achSkillsCheck — skillTree.skillEffect (все способности ТЕКУЩЕГО класса на своих
//  максимумах за один забег — трактовка «Кап-кап», решение пользователя);
//  achMetaCheck — lobby.upgrade (максимум всех веток прокачки; V74: герои открыты сразу);
//  achDeath — endGame (гибель всеми 4 классами, мета между забегами);
//  V146: achQuestCheck — каждая точка постановки флага сюжетного квеста (все флаги
//  meta.quests = «Архивариус», тот же список, что показывает кнопка «завершённые
//  квесты» лобби); achRelicCheck — relics.relicGenerate (добыты ВСЕ реликвии, пул
//  уникальности опустел — «Коллекционер»); achDressCheck — drag.equip (6 предметов
//  одного сета на кукле = активный 6-й сетовой бонус — «Одетый»); achDuet —
//  enemyAI.enemyDie (в коопе убит босс 4 этажа — «Дуэт»).
//Библиотека берёт ACH_LIST для третьего режима «Достижения» (кнопка achievLib.png): карточка
//до открытия — «???» и чёрный силуэт (приём врагов/объектов), после — название выделяющимся
//цветом (#FFCC66) и текст стандартным цветом надписей (решение пользователя).
//Циклы импорта (lobby↔achievements, library↔achievements) безопасны: импорты используются
//только внутри функций, на верхнем уровне — свои константы (приём модуля).
import { status } from "../scripts/start.js"
import { T } from "../scripts/localization.js"
import { data } from "../scripts/data.js"
import { dataGeneric } from "../scripts/sceneGenerate.js"
import { objectValues, doorPics } from "../scripts/del.js"
import { floatText } from "../scripts/floatText.js"
import { journalAdd } from "../scripts/journal.js"
import { playback, strike } from "../scripts/sound.js"

//реестр достижений: индекс = слот meta.achievements
const ACH_LIST = [
    {"name": "ach.0.name", "desc": "ach.0.desc"},
    {"name": "ach.1.name", "desc": "ach.1.desc"},
    {"name": "ach.2.name", "desc": "ach.2.desc"},
    {"name": "ach.3.name", "desc": "ach.3.desc"},
    {"name": "ach.4.name", "desc": "ach.4.desc"},
    {"name": "ach.5.name", "desc": "ach.5.desc"},
    {"name": "ach.6.name", "desc": "ach.6.desc"},
    {"name": "ach.7.name", "desc": "ach.7.desc"},
    //V146: четыре новых достижения (слоты 8-11, normShared добивает старые сейвы)
    {"name": "ach.8.name", "desc": "ach.8.desc"},
    {"name": "ach.9.name", "desc": "ach.9.desc"},
    {"name": "ach.10.name", "desc": "ach.10.desc"},
    {"name": "ach.11.name", "desc": "ach.11.desc"},
]

const ACH_GOLD = "#FFCC66" //цвет названия открытого достижения (журнал/всплывашка — тем же)
const KILL_WINDOW = 31     //тики (~0.5с): смерти врагов в окне считаются «одной атакой»

let achKillCount = 0  //Массовик: смерти врагов в текущем окне
let achKillTick = 0   //тик последней смерти в окне (status.time)
let achFloorClean = 1 //Ловкач: за текущий этаж не потеряно ни одной жизни
let achPrevHp = 0     //кэш ХП героя для сравнения в achTick

//--- разблокировка: один раз навсегда; фидбек (решение пользователя — полный):
//в забеге — строка журнала + всплывашка над героем + звук, вне забега — только звук
function achUnlock(idx) {
    let got = status.meta.achievements
    Array.isArray(got) || (got = status.meta.achievements = new Array(ACH_LIST.length).fill(0))
    if (got[idx]) return
    got[idx] = 1
    if (status.start === 1 && status.info && status.info.stats.length > 0) {
        journalAdd(T("journ.ach",T(ACH_LIST[idx].name)), ACH_GOLD)
        //V66a: имя достижения — ключ локализации, всплывашка обязана идти через T()
        //(урок: журнал строкой выше был обёрнут, а попап — нет; над героем вылетал
        //сырой «ach.N.name» — замечено на гибели 4-м классом, разблокировка «Перебор»)
        floatText(status.hero.x - 16 + Math.trunc(Math.random() * 32), status.hero.y + 8, T(ACH_LIST[idx].name), ACH_GOLD, "18px", "none")
    }
    playback(strike[8].vol, 0, 0, 3 * status.settings.soundVolume)
}

//--- 0 «Гамельский крысолов»: ручной зверёк появился потому, что съел еду (checkRat).
//Порог проходит и Паук — засчитываем только крысу (по формулировке достижения)
function achTame(enemy) {
    enemy.class.id === 6 && achUnlock(0)
}

//--- 1 «Массовик-затейник»: 3+ смерти врагов в окне ~0.5с (мильный взмах, взрыв, сплэш, яд)
function achKill() {
    if (status.time - achKillTick > KILL_WINDOW) achKillCount = 0
    achKillTick = status.time
    if (++achKillCount >= 3) {
        achKillCount = 0
        achUnlock(1)
    }
}

//--- старт этажа (newGame): свежие забегные счётчики достижений
function achFloorStart() {
    achFloorClean = 1
    achKillCount = 0
    achKillTick = 0
    achPrevHp = status.info ? status.info.hp : 0
}

//--- тик (gameLoop, активный блок — на паузе замирает, как всё остальное):
//ХП героя стало меньше, чем в прошлом тике, — «чистый» этаж испорчен
function achTick() {
    let hp = status.info.hp
    hp < achPrevHp && (achFloorClean = 0)
    achPrevHp = hp
}

//--- завершение этажа (nextFloor, до ветвления): status.levelFloor/status.meta.page —
//ещё завершаемого этажа
function achFloorEnd() {
    //5 «Я сделал!»: пройден четвёртый этаж (финал четвёртой главы), причём за все
    //забеги убиты ВСЕ виды боссов (V113). Виды = записи data.enemes[18] (сейчас три:
    //Циклоп 25 / Медуза 26 / Гриб пустоты 27 — новый босс добавится в проверку сам).
    //Убитые виды копятся в meta.bossesSlain (enemyDie, тег boss — мини-грибы/клоны
    //его не имеют) и между забегами не сбрасываются
    if (status.meta.page === 4 && status.levelFloor === 3) {
        const slain = Array.isArray(status.meta.bossesSlain) ? status.meta.bossesSlain : []
        let all = true
        for (let i = 0; i < data.enemes[18].length; i++) {
            //только записи с тегом boss — в группе лежат и квестовые враги
            //(культист 28 / Огнементаль 29) без него
            const b = data.enemes[18][i]
            b.boss === 1 && slain.indexOf(b.id) === -1 && (all = false)
        }
        all && achUnlock(5)
    }
    //2 «Ловкач 99го уровня»: любой этаж третьей главы без единой потери жизни
    status.meta.page === 3 && achFloorClean === 1 && achUnlock(2)
    //3 «Гриндер»: этаж вычищен полностью (любая глава/этаж)
    grindCheck() && achUnlock(3)
}

//— «Гриндер»: все комнаты открыты ([3]===1) + все клетки коридоров ([2]===1 → [7]===1) +
//все ОТРИСОВАННЫЕ двери открыты + ноль живых врагов (включая призывов; труп/pet — не «enemy») +
//каждый интерактивный объект использован ([7]===1) — выход (13) не считаем (им и спускаются),
//столбы призыва (15) НЕ проверяем (решение пользователя) — а использованный разрушаемый
//([8] undefined — хлам/сундук/обезвреженная ловушка) уже разбит: разбитые удаляются из
//level.objects (destroyObjects/атака). Двери проверяются по кэшу doorPics (del.js — тот же,
//что читает openDoor, чистится del() на этаж): у закрытого тайла href = «тип+этаж*30» из
//набора 9/12/23/24. Именно doorPics, а не записи стен walls[i][6]: двери верхней кромки
//(типы 23/24 на клетке y−1) рисуются ТОЛЬКО при прорисовке коридора (heroMove.createCorridor),
//который [6] не проставляет — проверка по записям делала достижение недостижимым (нашёл
//автотест V52). Тайл, ни разу не отрисованный, игрок открыть не может — он не считается.
function grindCheck() {
    let level = dataGeneric.scenes[status.levelFloor]
    let i
    for (i = 0; i < level.roomsArr.length; i++) {
        if (level.roomsArr[i][3] !== 1) return false
    }
    for (i = 0; i < level.floor.length; i++) {
        if (level.floor[i][2] === 1 && level.floor[i][7] !== 1) return false
    }
    let closedSet = ["./images/dungeon/walls/" + (9 + status.levelFloor * 30) + ".png",
        "./images/dungeon/walls/" + (12 + status.levelFloor * 30) + ".png",
        "./images/dungeon/walls/" + (23 + status.levelFloor * 30) + ".png",
        "./images/dungeon/walls/" + (24 + status.levelFloor * 30) + ".png"]
    for (i = 0; i < doorPics.length; i++) {
        let el = doorPics[i]
        if (!el || typeof el.getAttribute !== "function") continue
        if (closedSet.indexOf(el.getAttribute("href")) !== -1) return false
    }
    for (i = 0; i < objectValues.length; i++) {
        if (objectValues[i].type === "enemy") return false
    }
    for (i = 0; i < level.objects.length; i++) {
        let o = level.objects[i]
        if (o[2] === 13 || o[2] === 15) continue
        if (o[7] !== 1) return false
        if (o[8] === undefined) return false
    }
    return true
}

//--- 4 «Кап-кап»: все способности текущего класса на своих максимумах за один забег.
//Формулы те же, что в skillTree.js: уровень = число вхождений индекса в info.skills,
//максимум — по наличию описаний уровней в data.js
function achSkillsCheck() {
    let cls = status.hero.class
    let skills = data.heroes[cls].skills
    for (let i = 0; i < skills.length; i++) {
        let n = 0
        for (let j = 0; j < status.info.skills.length; j++) status.info.skills[j] === i && n++
        let max = skills[i].descFullL3 ? 3 : skills[i].descFullL2 ? 2 : 1
        if (n < max) return
    }
    achUnlock(4)
}

//--- 6 «Открыватель»: все мета-улучшения (вызывается из лобби после покупки):
//максимум всех веток (вместимость 18, перенос 16, ключи 3, ХП 10, стат 2, отделы 4).
//V74: герои открыты сразу — проверка открытых героев удалена
function achMetaCheck() {
    let m = status.meta
    let all = m.metaInvLen >= 18 && m.invNum >= 16 && m.startKey >= 3 && m.dopHP >= 10 &&
        m.startStat >= 2 && m.metaPageNum >= 4
    all && achUnlock(6)
}

//--- 7 «Перебор»: гибель всеми четырьмя классами (мета, живёт между забегами)
function achDeath() {
    let died = status.meta.diedClasses
    Array.isArray(died) || (died = status.meta.diedClasses = [0, 0, 0, 0])
    died[status.hero.class] = 1
    died[0] && died[1] && died[2] && died[3] && achUnlock(7)
}

//--- 8 «Архивариус» (V146): завершены ВСЕ сюжетные квесты. Список ключей meta.quests —
//тот же, что показывает кнопка «завершённые квесты» лобби (V112): Волк, портал,
//Слаймэн, Огнементаль, Древоброд, Хруп. Новый квест добавит флаг в meta.quests —
//его ключ нужно дописать и сюда (проверка идёт по этому списку). Зовётся из КАЖДОЙ
//точки постановки флага — неизвестно, какой квест станет последним
const QUEST_KEYS = ["wolf", "portal", "slime", "flame", "ent", "hrup"]
function achQuestCheck() {
    let q = status.meta.quests
    if (!q) return
    for (let i = 0; i < QUEST_KEYS.length; i++) {
        if (q[QUEST_KEYS[i]] !== 1) return
    }
    achUnlock(8)
}

//--- 9 «Коллекционер» (V146): добыты все 7 реликвий — пул уникальности (meta.obtainedRelics)
//опустел, боссы больше не дают реликвий. Список = RELICS (relics.js), kind 0..6; новый
//вид реликвий продлит normShared и потребует увеличить порог здесь. Зовётся из
//relics.relicGenerate сразу после записи выпавшей kind в мету
function achRelicCheck() {
    let got = status.meta.obtainedRelics
    if (!Array.isArray(got)) return
    for (let i = 0; i < 7; i++) {
        if (!got[i]) return
    }
    achUnlock(9)
}

//--- 10 «Одетый» (V146): на герое 6 предметов одного сета — активен 6-й сетовой бонус.
//Считаем только настоящие предметы сета на кукле (та же проверка, что itemSet в sets.js —
//без импорта: sets → relics → этот модуль, лишний цикл ни к чему): «Вечный берилл»
//(+1 к каждому сету) и копия «Сапфира» порог НЕ засчитывают — формулировка требует
//именно вещи. 6 предметов на кукле всегда в разных слотах (кукла слот не делит).
//Зовётся из drag.equip — кукла к моменту вызова уже несёт надетый предмет
function achDressCheck(item) {
    if (!item || item.rarity !== 3 || !item.set) return
    let count = 0
    let doll = status.inventory.doll
    for (let i = 0; i < doll.length; i++) {
        let d = doll[i]
        d && d.rarity === 3 && d.set === item.set && count++
    }
    count >= 6 && achUnlock(10)
}

//--- 11 «Дуэт» (V146): в кооперативном режиме убит босс 4 этажа. Виды — записи с тегом
//boss в группе data.enemes[18] (Циклоп 25 / Медуза 26 / Гриб пустоты 27; те же, что
//копит «Я сделал!» — мини-грибы/клоны тега не имеют, культист/Огнементаль тоже).
//Группа спавнится единственным spawnVoidBoss на четвёртом этаже четвёртой главы
//(levelFloor 3 достижим только при page 4: гл.1 — 1 этаж, гл.2 — 2, гл.3 — 3, гл.4 — 4),
//поэтому проверки вида и коопа достаточно. Осколки Медузы наследуют boss честно —
//убийство последнего осколка и есть победа над Медузой. Зовётся из enemyAI.enemyDie
function achDuet(enemy) {
    if (!enemy || !enemy.class || status.players.length < 2) return
    let group = data.enemes[18]
    for (let i = 0; i < group.length; i++) {
        if (group[i].boss === 1 && group[i].id === enemy.class.id) {
            achUnlock(11)
            return
        }
    }
}

export {ACH_LIST, achTame, achKill, achFloorStart, achFloorEnd, achTick, achSkillsCheck, achMetaCheck, achDeath, achQuestCheck, achRelicCheck, achDressCheck, achDuet}
