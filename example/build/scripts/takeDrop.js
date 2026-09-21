import { status } from "../scripts/start.js"
//E-15: bossWeaponDrops — кучки из сундука босса: подбор генерирует предмет с фильтром
import { dropArr, bossWeaponDrops } from "../scripts/useObject.js"
import { checkCollision } from "../scripts/damage.js"
import { floatText } from "../scripts/floatText.js"
import { itemGenerate } from "../scripts/itemGenerate.js"
//V58: локализация журнальных строк и имён предметов
import { T,itemName } from "../scripts/localization.js"
import { beltChange } from "../scripts/belt.js"
import { changeHP } from "../scripts/takeDamage.js"
import { playback,strike } from "../scripts/sound.js"
import { showItemTip } from "../scripts/tip.js"
import { journalAdd, J_STD, J_YELLOW, J_SCROLL, J_RARITY } from "../scripts/journal.js"
//V56: сет «Учёная волшебница» (6 надетых) — 5% шанс +1 золота с кучки
import { rollGoldPickup } from "../scripts/sets.js"
//V67: реликвии — «Вечный сапфир»: копия «живучести» источника; генерация реликвии (10% босса 4 этажа)
import { relicGenerate, abilCopyBonus } from "../scripts/relics.js"
//V109: квест «Голос в портале» — кучка «части посоха» (маркер WeakSet, ветка до href-цепочки)
import { portalQuestTakePile } from "../scripts/portalQuest.js"
//V111: квест «Погоня за пламенем» — кучка-награда (зачарование текущего оружия)
import { flameQuestTakePile } from "../scripts/flameQuest.js"
//V67: новый предмет мог встать в 1-ю ячейку инвентаря — пересчёт копии «Вечного сапфира»
import { changeDopStat } from "../scripts/drag.js"
//V114: кооператив — контекст игрока (кучку забирает наступивший)
import { setContext, playerAlive } from "../scripts/players.js"

function takeDrop() {
    //V114: проход подбора — у КАЖДОГО живого игрока свой: золото/ключи/еда/предметы
    //падают в его status.info/inventory (контекст), один тик = один подбор на игрока
    for (let pi = 0; pi < status.players.length; pi++) {
        const P = status.players[pi]
        if (!playerAlive(P)) continue
        setContext(P)
        takeDropFor()
    }
    setContext(status.players[0])
}
function takeDropFor() {
    let length = dropArr.length
    for (let i = 0; i < length; i++) {
        let x1 = parseInt(dropArr[i].getAttribute('x'))
        let y1 = parseInt(dropArr[i].getAttribute('y'))
        let w1 = parseInt(dropArr[i].getAttribute('width'))
        let h1 = parseInt(dropArr[i].getAttribute('height'))
        let x2 = status.hero.x + 16
        let y2 = status.hero.y + 25
        let w2 = 32
        let h2 = 32
        if (checkCollision(x1, x2, w1, w2, y1, y2, h1, h2)) {
            let useDrop = false
            //V109: кучка квеста «Голос в портале» (часть посоха) — ветка в portalQuest.js
            if (portalQuestTakePile(dropArr[i])) {
                playback(strike[3].vol,0,0,7*status.settings.soundVolume)
                dropArr[i].remove()
                dropArr.splice(i, 1)
                return
            }
            //V111: кучка квеста «Погоня за пламенем» (огненное оружие) — ветка в flameQuest.js
            if (flameQuestTakePile(dropArr[i])) {
                playback(strike[3].vol,0,0,7*status.settings.soundVolume)
                dropArr[i].remove()
                dropArr.splice(i, 1)
                return
            }
            //E-15: кучка из сундука босса — случайное ОРУЖИЕ фиксированной редкости
            //(фильтр в itemGenerate); href-цепочка ниже — обычные кучки
            let bossRarity = bossWeaponDrops.get(dropArr[i])
            if (bossRarity !== undefined) {
                useDrop = takeItem(bossRarity, {"type": 11})
                useDrop && bossWeaponDrops.delete(dropArr[i])
            } else {
                dropArr[i].getAttribute("href") === "./images/dungeon/drop/gold.png" && (useDrop = takeGold())
                dropArr[i].getAttribute("href") === "./images/dungeon/drop/food.png" && (useDrop = takeFood())
                dropArr[i].getAttribute("href") === "./images/dungeon/drop/scroll.png" && (useDrop = takeScroll())
                dropArr[i].getAttribute("href") === "./images/dungeon/drop/key.png" && (useDrop = takeKey())
                dropArr[i].getAttribute("href") === "./images/dungeon/drop/item1.png" && (useDrop = takeItem(1))
                dropArr[i].getAttribute("href") === "./images/dungeon/drop/item2.png" && (useDrop = takeItem(2))
                dropArr[i].getAttribute("href") === "./images/dungeon/drop/item3.png" && (useDrop = takeItem(3))
                dropArr[i].getAttribute("href") === "./images/dungeon/drop/item4.png" && (useDrop = takeItem(4))
                //V67: item5.png — кучка РЕЛИКВИИ (дроп босса 4 этажа, 10%)
                dropArr[i].getAttribute("href") === "./images/dungeon/drop/item5.png" && (useDrop = takeItem(5))
            }
            if(useDrop) {
                playback(strike[3].vol,0,0,7*status.settings.soundVolume)
                dropArr[i].remove()
                dropArr.splice(i, 1)
                return
            }
        }
    }
}
function takeGold() {
    let gold = Math.trunc(Math.random() * 5) + status.meta.page
    //V56: сет «Учёная волшебница» (6 надетых): 5% шанс получить +1 золото при поднятии
    //кучки — прибавка до всплывающего числа и строки журнала
    rollGoldPickup() && gold++
    status.info.gold += gold
    floatText(status.hero.x - 16 + Math.trunc(Math.random() * 32),status.hero.y+8,gold,"#FFCC66","18px","none")
    //V37 журнал: золото
    journalAdd(T("journal.gold",gold), J_YELLOW)
    return true
}
function takeScroll() {
    status.info.upStat++
    //V37 журнал: свиток
    journalAdd(T("journal.scroll"), J_SCROLL)
    return true
}
function takeKey() {
    status.info.keys++
    //V37 журнал: ключ
    journalAdd(T("journal.key"), J_STD)
    return true
}
function takeFood() {
    //V67: копия «живучести» (Вечный сапфир) усиливает лечение едой как своя
    let foodType = (Math.trunc(Math.random() * 5) + 1 + status.info.lifeus + abilCopyBonus("lifeus")) / 20
    foodType += Math.trunc(parseInt(status.info.stats[2].dops[2].value2.slice(0,-1))/100 * foodType)
    //5% - 40% * Выносливость
    if(status.info.hp + Math.trunc(parseInt(status.info.stats[2].dops[0].value2.slice(0,-1)) * foodType) <= parseInt(status.info.stats[2].dops[0].value2.slice(0,-1))) {
        status.info.hp +=  Math.trunc(parseInt(status.info.stats[2].dops[0].value2.slice(0,-1)) * foodType)
        changeHP(document.getElementById("hpBarI"),document.getElementById("hpText"),"hp")
        floatText(status.hero.x - 16 + Math.trunc(Math.random() * 32),status.hero.y+8,"+" + Math.trunc(parseInt(status.info.stats[2].dops[0].value2.slice(0,-1)) * foodType),"#33FF66","18px","none")
        return true
    } else if(status.info.beltCell > 0) {
        let lengthBelt = status.info.beltCellArr.length
        for (let i = 0; i < lengthBelt; i++) {
            if(!status.info.beltCellArr[i]) {
                status.info.beltCellArr[i] = foodType
                beltChange()
                return true
            }
        }
    }
    return false
}
function takeItem(rarity, filter) {
    let countInv = 0
    let length = status.inventory.inv.length
    for (let i = 0; i < length; i++) {
        status.inventory.inv[i] && (countInv++)
    }
    if (countInv < 24) {
        let color
        rarity === 1 && (color = "grey")
        rarity === 2 && (color = "#3300ff")
        rarity === 3 && (color = "#9900ff")
        rarity === 4 && (color = "#ffff66")
        //V67: редкость 5 — реликвия, КРАСНЫЙ (максимальная редкость)
        rarity === 5 && (color = "#FF0000")
        floatText(status.hero.x + 16,status.hero.y+8,"?",color,"18px","none")
        //V67: реликвия генерируется отдельно (без характеристик); V68: реликвии уникальны —
        //generate выбирает только из невыпадавших, пустой пул (страховка, bossDrop обычно
        //уже положил item4) даёт обычный легендарный предмет
        //E-15: filter — фильтры генерации ({type: 11} = оружие у сундуков боссов)
        let item = rarity === 5 ? (relicGenerate() || itemGenerate(4)) : itemGenerate(rarity, filter)
        //V67 «Вечный сапфир»: предмет мог встать в 1-ю ячейку инвентаря (или дать ей освободиться
        //нельзя тут — добавление только занимает) — пересчёт копии сразу
        changeDopStat()
        //V27: окошко с характеристиками сгенерированного предмета (низ экрана, 2с)
        item && showItemTip(item)
        //V37 журнал: предмет, цвет строки — по редкости
        item && journalAdd(T("journal.gotitem",itemName(item)), J_RARITY[rarity])
        return true
    }
    return false
}
export {takeDrop}