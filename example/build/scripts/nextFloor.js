import { status } from "../scripts/start.js"
import { endScreen } from "../scripts/endGame.js"
import { comix } from "../scripts/comix.js"
//V52: достижения завершения этажа (Ловкач/Гриндер/«Я сделал!»)
import { achFloorEnd } from "../scripts/achievements.js"
//V69: снапшот ручных зверьков перед пересозданием сцены (pets.js)
import { snapshotCarryPets } from "../scripts/pets.js"
//V104: выход с этажа с живым Волком — прощальный диалог и награда (quest.js)
import { questFloorExit } from "../scripts/quest.js"

function nextFloor() {
    //V104: квест «Сопроводить Волка» активен — сначала прощальный диалог и награда
    //(случайный легендарный сетовый предмет), продолжение перехода — после «ПРИНЯТЬ»
    if (status.quest && status.quest.state === 2) {
        questFloorExit(() => nextFloorGo())
        return
    }
    nextFloorGo()
}
function nextFloorGo() {
    //V52: проверка до ветвления — status.levelFloor ещё завершаемого этажа
    achFloorEnd()
    let next = true
    status.meta.page === 1 && (next = false)
    //V69: спуск на следующий этаж — запоминаем ручных зверьков (делать это надо ДО del()
    //в endScreen/comix, который чистит objectValues); новый забег снапшот игнорирует
    next && snapshotCarryPets()
    //контент по главам: гл.1 — этаж 1; гл.2 — этажи 1+2; гл.3 — этажи 1+2+3; гл.4 — этажи 1+2+3+4 (V65).
    //гл.2: этаж 1 → комикс → этаж 2 → концовка. гл.3: этаж 1 → этаж 2 → комикс → этаж 3 → концовка.
    //V65 гл.4: этаж 1 → этаж 2 → этаж 3 → комикс спуска → этаж 4 («Пустота») → концовка.
    //V87: диптихи 4 этажа зависят от босса, поэтому выбор (Циклоп 25 / Медуза пустоты 26 /
    //Гриб пустоты 27 — V91, поровну) делается ЗДЕСЬ — при завершении этажа 3, ДО comix(2);
    //spawnVoidBoss читает готовый
    status.meta.page === 4 && status.levelFloor === 2 && (status.voidBossId = [25, 26, 27][Math.trunc(Math.random() * 3)])
    status.levelFloor === 0 && status.meta.page === 2 ? comix(2) :
    status.levelFloor === 1 && status.meta.page === 3 ? comix(2) :
    status.levelFloor === 2 && status.meta.page === 4 ? comix(2) :
    status.meta.page === 4 && status.levelFloor === 3 ? comix(1) :
    status.meta.page < 4 && (status.levelFloor === 1 || status.levelFloor === 2) ? comix(1) : endScreen(false,next)
}
export {nextFloor}