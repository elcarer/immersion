// ============================================================================
// players.js — V114: кооператив (2 игрока, 1 экран). Игрок = «герой + его
// окружение»: класс/позиция/спрайт (бывший status.hero), забегные статы
// (бывший status.info), стек атак (бывший status.attack), инвентарь
// (бывший status.inventory), устройство ввода (device) и пер-игроковые кэши
// движения (lastDir/padMaskPrev/... — бывшие module-vars heroMove.js).
//
// status.hero / status.info / status.attack / status.inventory остаются КАК
// УКАЗАТЕЛИ на данные «активного» игрока: все системы игры читают их как
// раньше, а gameLoop перед тиком каждого игрока подменяет контекст
// setContext'ом и после пер-игроковой фазы возвращает players[0]. Все кэши
// вида «const info = status.info» в кодовой базе функциональные (внутри
// функций) — подмена МЕЖДУ вызовами безопасна.
//
// ПРАВИЛО: код, ЗАМЕНЯЮЩИЙ объект целиком (P.info = {...}, P.attack = {...}),
// обязан после этого вызвать setContext(P), иначе указатели разъедутся.
// ============================================================================
import { status } from "../scripts/start.js"

//забегные статы игрока — бывший шаблон status.info (start.js / sceneGenerate.js);
//upStat/keys заполняет sceneGenerate из меты при новом забеге
function defaultInfo() {
    return {"stats":[],"exp":0,"lvl":1,"abilPoints":0,"gold":0,"hp":0,"beltCell":0,"beltCellArr":[],"armor":0,"upStat":0,"keys":0,"skills":[],"poisonus":0,"poisonusMult":1,"expous":0,"lifeus":0,"viewus":1,"invisible":0,"invisibleTime":0,"activeSkills":[],"pins":0,"backStab":1,"cloudeTime":0,"multSpeed":1,"killHeal":0,"keyLock":0,"pinsAdd":0,"pinsStan":false,"bossKill":0,"time":0,"luckus":0,"fameus":0,"greedus":0,"poison":0,"poisonTime":0,"stoneCurse":0,"goldroom":0,"reflect":1,"energyShotCharge":0,"charm":0,"blesses":[],"log":[],"puzzleUsed":0,"shellUsed":0}
}
//инвентарь игрока — бывший шаблон status.inventory: кукла 14 слотов (оружие 11/12) + рюкзак 24
function defaultInventory() {
    return {"doll":[,,,,,,,,,,,,,],"inv":[false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false]}
}

// ==================== V124: раздельная мета коопа ====================
//Пер-игроковые поля меты — прокачка и сундук КАЖДОГО игрока (его очки, его апгрейды,
//его сундук). Все остальные поля меты (главы, ачивки, библиотека, зачёты убийств/объектов,
//боссы, реликвии, квесты) — ОБЩИЕ и живут в status.metaShared
const META_PLAYER_FIELDS = ["points","inv","metaInvLen","metaPageNum","invNum","startKey","dopHP","startStat","identLegends"]
//шаблон пер-игроковой части меты (числа каноничны defaultMeta в start.js)
function playerMetaTemplate() {
    return {"points":0,"inv":[null,null,null],"metaInvLen":3,"startKey":0,"dopHP":0,"startStat":0,"metaPageNum":1,"identLegends":0,"invNum":1}
}
//общая часть полного объекта меты: всё, кроме пер-игроковых полей
function sharedMetaPart(full) {
    const sh = {}
    for (let k in full) {
        !META_PLAYER_FIELDS.includes(k) && (sh[k] = full[k])
    }
    return sh
}
//status.meta в коопе — прокси-УКАЗАТЕЛЬ на мету активного игрока (та же схема, что
//status.hero/info/inventory): пер-игроковые поля читаются/пишутся в p.meta, общие —
//в status.metaShared. Все потребители продолжают читать status.meta.* как раньше.
//Прокси кэшируется на игроке (metaView): setContext зовётся каждый тик — новая
//обёртка не создаётся, а replace status.metaShared требует сброса metaView (save.js/start.js)
function makeMetaView(p) {
    return new Proxy(status.metaShared, {
        get(t,k) { return META_PLAYER_FIELDS.includes(k) ? p.meta[k] : t[k] },
        set(t,k,v) { if (META_PLAYER_FIELDS.includes(k)) p.meta[k] = v; else t[k] = v; return true },
        has(t,k) { return k in p.meta || k in t },
        deleteProperty(t,k) { return Reflect.deleteProperty(t,k) },
        //V127 (репорт юзера: «ownKeys on proxy: trap returned duplicate entries» при
        //загрузке из файла): ключ мог лежать И в metaShared, И в p.meta (после миграций
        //старых сейвов) — дубликаты в ownKeys роняли JSON.stringify(status.meta).
        //Дедупликация: пер-игроковое поле затеняет общее (как и в get)
        ownKeys(t) { return [...new Set([...Reflect.ownKeys(t), ...Reflect.ownKeys(p.meta)])] },
        getOwnPropertyDescriptor(t,k) {
            return META_PLAYER_FIELDS.includes(k) ? Object.getOwnPropertyDescriptor(p.meta,k) : Reflect.getOwnPropertyDescriptor(t,k)
        }
    })
}
//фабрика игрока. device — раскладка из devices.js: "solo" (вся клавиатура + пад 0,
//поведение одиночной игры 1:1), "kb1" (WASD), "kb2" (стрелки), "pad0"/"pad1".
//idx — номер игрока (0/1): суффикс DOM-id его полос ХП/опыта (hpBarI0/lvlText1…)
function makePlayer(device = "solo", cls = 0, idx = 0) {
    return {"class":cls,"x":0,"y":0,"direction":1,"obj":{},"waitTime":0,"noStunTime":0,"idx":idx,
        //V114: юз объектов — ПЕР-ИГРОКОВОЙ (бывший status.use): полоска использования
        //одного игрока больше не сбивается проходом другого
        "use":0,
        //пер-игроковые кэши движения (бывшие module-vars heroMove.js)
        "lastDir":1,"padMaskPrev":0,"wasMoving":false,"lastCellX":-1,"lastCellY":-1,"lastAnim":null,
        "info":defaultInfo(),"attack":{},"inventory":defaultInventory(),
        //V124: своя мета (прокачка/сундук) у каждого игрока; metaView — кэш прокси
        "meta":playerMetaTemplate(),"metaView":null,"device":device}
}
//подмена активного игрока: все четыре указателя всегда меняются ВМЕСТЕ
function setContext(p) {
    status.hero = p
    status.info = p.info
    status.attack = p.attack
    status.inventory = p.inventory
    //V124: в коопе пятым указателем идёт мета (прокси активного игрока);
    //в соло status.meta — обычный объект, его контекст не трогает
    status.players.length > 1 && (status.meta = p.metaView || (p.metaView = makeMetaView(p)))
}
//жив ли игрок (type="hero"; после смерти obj.type="corpse" до конца забега)
function playerAlive(p) {
    return !!p.obj && p.obj.type === "hero"
}
//жив хотя бы один игрок — общий гвард тика мира
function anyAlive() {
    for (let i = 0; i < status.players.length; i++) {
        if (playerAlive(status.players[i])) return true
    }
    return false
}
//игрок-владелец мирового объекта (спрайт героя): bullet.atacker / target / d из animPlay
function ownerPlayer(obj) {
    if (!obj) return null
    for (let i = 0; i < status.players.length; i++) {
        if (status.players[i].obj === obj) return status.players[i]
    }
    return null
}
//ближайший ЖИВОЙ герой к точке (x,y) мира — цель врагов/эффектов (null, если все мертвы)
function nearestPlayer(x, y) {
    let best = null
    let bd = Infinity
    for (let i = 0; i < status.players.length; i++) {
        const P = status.players[i]
        if (!playerAlive(P)) continue
        const d = Math.abs(P.x - x) + Math.abs(P.y - y)
        if (d < bd) { bd = d; best = P }
    }
    return best
}
//прогон fn в контексте КАЖДОГО живого игрока (опыт с убийства — обоим и т.п.);
//после цикла контекст возвращается игроку 1
function forAlive(fn) {
    for (let i = 0; i < status.players.length; i++) {
        const P = status.players[i]
        if (!playerAlive(P)) continue
        setContext(P)
        fn(P)
    }
    setContext(status.players[0])
}
//V122 (решение юзера — баланс коопа): опыт для поднятия КАЖДОГО уровня — вдвое больше
//соло-нормы (выдача опыта при этом обычная). lvl передаётся явно: checkHP считает по
//P.info каждого игрока вне контекста
function nextLvlExp(lvl) {
    const base = Math.trunc(((1 + 20/lvl)**(lvl/20) - 1) / (Math.exp(1) - 1) * 100)
    return status.players.length > 1 ? base * 2 : base
}
//суффиксы DOM-id полос текущего контекста: полоса — base+"I"+idx (svg.image суффиксит
//"I"), текст/уровень — base+"Text"+idx / "lvlText"+idx (svg.text пишет id дословно)
function ctxBar(base) {
    return document.getElementById(base + (status.hero.idx || 0) + "I")
}
function ctxTx(base) {
    return document.getElementById(base + "Text" + (status.hero.idx || 0))
}
export {defaultInfo,defaultInventory,META_PLAYER_FIELDS,playerMetaTemplate,sharedMetaPart,makeMetaView,makePlayer,setContext,playerAlive,anyAlive,ownerPlayer,nearestPlayer,forAlive,ctxBar,ctxTx,nextLvlExp}
