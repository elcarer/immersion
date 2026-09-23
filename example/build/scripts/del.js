import { floattext } from "../scripts/floatText.js"
import { mapDel } from "../scripts/map.js"
import { status } from "../scripts/start.js"
import { activeSkillsDel } from "../scripts/activeSkills.js"
import { tipDel } from "../scripts/tip.js"
import { svgArr, releaseSprite } from "../scripts/svg.js"
import { topMenuClose } from "../scripts/topMenu.js"
import { delPins } from "../scripts/checkBuffs.js"
import { bars, dropArr } from "../scripts/useObject.js"
import { resetBossFight } from "../scripts/spiderBossFight.js"
import { resetValkyrie } from "../scripts/valkyrie.js"
import { resetEmoFx } from "../scripts/enemyAI.js"
import { resetDashGhosts } from "../scripts/dashFx.js"
import { resetCharmBullets } from "../scripts/charmFx.js"
import { resetHowlZones } from "../scripts/howlFx.js"
//V51: шлейфы «вампиризма» не переживают смену сцены
import { resetVampFx } from "../scripts/vampFx.js"
import { resetEnemyHover } from "../scripts/enemyHover.js"
//E-17: карточка героя в лобби (heroTip) не переживает смену сцены
import { heroTipDel } from "../scripts/lobby.js"
//V64: связка портал/рычаг/арены не переживает смену сцены
import { resetPortalFx } from "../scripts/portalFx.js"
//V65: Циклоп Пустоты и его Сгустки не переживают смену сцены
import { resetVoidBoss } from "../scripts/voidBoss.js"
//V80: реестры наземных теней — только на текущем этаже
import { resetGroundShadows } from "../scripts/groundShadow.js"
//V103: летящие кучки дропа — чистятся при смене сцены вместе с dropArr
import { resetFlyDrops } from "../scripts/dropSafe.js"
//V104: квест «Сопроводить Волка» — сброс состояния/трекера/ссылок сцены
import { questDel } from "../scripts/quest.js"
//V109: квест «Голос в портале» — сброс состояния/трекера/ссылок сцены
import { portalQuestDel } from "../scripts/portalQuest.js"
//V111: квест «Погоня за пламенем» — сброс состояния/трекера/лавы + этажный бафф огня
import { flameQuestDel } from "../scripts/flameQuest.js"
//V133: квест «Корм слизи» — сброс состояния/трекера/полоски
import { slimeQuestDel } from "../scripts/slimeQuest.js"
//V138: квест «Разрастание» — сброс состояния/трекера/полоски
import { entQuestDel } from "../scripts/entQuest.js"
import { hrupQuestDel } from "../scripts/hrupQuest.js"
//V114: кооператив — контекст игрока (снос спрайтов всех героев, пер-игроковой resetValkyrie)
import { setContext } from "../scripts/players.js"
// МИГРАЦИЯ M5: objectValues — Proxy-список, синхронизирующий ECS-сущности zero_engine
// (компоненты etype/posX/posY/cullPad, группа battle). Контракт массива прежний:
// push/splice/length=0, индексы, порядок. Подробности — ecsBridge.js
import { createEntityList } from "../scripts/ecsBridge.js"

let screenPic = []
let objectValues = createEntityList()
//V4-кэши для checkZOrder (heroMove.js): пополняются при создании тайлов/эффектов, чистятся в del()
let wallsOverlay = []
let acidArr = []
//V16: кэш дверных спрайтов для openDoor (раньше openDoor каждый тик сканировал ВЕСЬ
//screenPic — тысячи плиток открытых комнат — в поисках 8 вариантов дверей)
let doorPics = []

function del() {
    let num = screenPic.length
    for (let i = 0; i < num; i++) {
        screenPic[i] && screenPic[i].remove && screenPic[i].remove() 
    }
    screenPic.length = 0

    let num2 = objectValues.length
    for (let i = 0; i < num2; i++) {
        //V15: пули/эффекты — обратно в пул узлов, остальные — обычное удаление
        if (objectValues[i].type === "bullet" || objectValues[i].type === "effect") {
            releaseSprite(objectValues[i].img)
        } else {
            objectValues[i].rect && objectValues[i].rect.remove()
            objectValues[i].img.remove()
        }
    }
    objectValues.length = 0
    //V114: героев несколько — сносим спрайты (rect+img) всех игроков
    for (let i = 0; i < status.players.length; i++) {
        const o = status.players[i].obj
        if (o && o.img && svgArr[1].contains(o.img)) {
            o.rect && o.rect.remove()
            o.img.remove()
        }
    }

    let lengthText = floattext.length
    for (let i = 0; i < lengthText; i++) {
            floattext[i].obj.remove()
    }
    floattext.length = 0

    //V66e: аргумент mapDel — nomusic (пропустить unduck), а не состояние забега: при смерти
    //status.start===1 и musicDuck(0) проглатывался. Всегда 0: следом идёт playTrack (none/
    //tavern/dungeon), который и задаёт финальную громкость синхронно в том же стеке
    mapDel(0)
    activeSkillsDel()
    tipDel()
    topMenuClose()
    delPins()
    bars.length = 0
    dropArr.length = 0
    resetFlyDrops()
    //V104: квест «Сопроводить Волка» — сброс состояния, трекера и ссылок сцены
    questDel()
    wallsOverlay.length = 0
    acidArr.length = 0
    doorPics.length = 0
    resetBossFight()
    //V114: пер-игроковые состояния валькирии (рывки/дротики/ауры живут в info) чистим
    //у КАЖДОГО игрока. V124: контекст возвращается ВХОДЯЩИМ игроком, а не players[0] —
    //del() зовётся из coopLobby/цепочек экранов (очки/предметы ×2), где контекст уже
    //переключён на нужного игрока, и перерисовка обязана остаться в его данных
    const ctxHero = status.hero
    for (let i = 0; i < status.players.length; i++) {
        setContext(status.players[i])
        resetValkyrie()
    }
    setContext(ctxHero && status.players.includes(ctxHero) ? ctxHero : status.players[0])
    resetEmoFx()
    resetDashGhosts()
    resetCharmBullets()
    resetHowlZones()
    resetVampFx()
    resetEnemyHover() //V47: окно врага не переживает смену сцены
    heroTipDel() //E-17: карточка героя в лобби гаснет при старте забега/смене сцены
    resetPortalFx() //V64: связка портал/рычаг/арены — только на текущем этаже
    portalQuestDel() //V109: квест «Голос в портале» — только на текущем этаже
    flameQuestDel() //V111: квест «Погоня за пламенем» — лава/этажный бафф только на текущем этаже
    slimeQuestDel() //V133: квест «Корм слизи» — только на текущем этаже
    entQuestDel()
hrupQuestDel() //V138: квест «Разрастание» — только на текущем этаже
    resetVoidBoss() //V65: босс 4 этажа и его Сгустки — только на текущем этаже
    resetGroundShadows() //V80: реестры наземных теней — узлы уже снесены очисткой слоёв

    status.time = 0

    while (svgArr[0].firstChild) {
        svgArr[0].removeChild(svgArr[0].firstChild)
    }while (svgArr[1].firstChild) {
        svgArr[1].removeChild(svgArr[1].firstChild)
    }while (svgArr[2].firstChild) {
        svgArr[2].removeChild(svgArr[2].firstChild)
    }
}
export {screenPic,del,objectValues,wallsOverlay,acidArr,doorPics}