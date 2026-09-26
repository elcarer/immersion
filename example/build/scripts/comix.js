import { screenPic,del } from "../scripts/del.js"
import { newGame } from "../scripts/newGame.js"
import { svgArr,image } from "../scripts/svg.js"
import { status } from "../scripts/start.js"
import { nextRun,endScreen } from "../scripts/endGame.js"
import { playTrack,TRACK } from "../scripts/sound.js"

let finClick
let comixTimeout
function comix(fin = 0) {
    del()
    finClick = fin
    //V147 (репорт авто-прогона): во время комикса мир ЖИЛ — start оставался 1, тик шёл,
    //и враги у killed героя на комиксе сгоравшего спуска продолжали бить. Комикс — пауза:
    //никаких смертей на нём; снятие — в onClick перед переходом (newGame/endScreen)
    status.pause = 1
    status.move = 0
    //после завершения этажа (финальный/междуглавий комикс) музыка уровня должна замолкнуть
    if(fin !== 0) {
        playTrack(TRACK.none)
    }
    //после таверны
    if(fin === 0) {
        if(status.hero.class === 0) {
            if(status.meta.page === 1) {
                screenPic.push(image(svgArr[2],0,0,960,1080,"./images/comix/"+status.hero.class+"/0.png"))
                screenPic.push(image(svgArr[2],960,0,960,1080,"./images/comix/empty.png"))
            }
            if(status.meta.page >= 2) {
                screenPic.push(image(svgArr[2],0,0,960,1080,"./images/comix/"+status.hero.class+"/0.png"))
                screenPic.push(image(svgArr[2],960,0,960,1080,"./images/comix/"+status.hero.class+"/1.png"))
            }
        } else {
            if(status.meta.pageMax === 3) {
                screenPic.push(image(svgArr[2],0,0,960,1080,"./images/comix/"+status.hero.class+"/0.png"))
                screenPic.push(image(svgArr[2],960,0,960,1080,"./images/comix/"+status.hero.class+"/1.png"))
            } else {
                screenPic.push(image(svgArr[2],0,0,960,1080,"./images/comix/"+status.hero.class+"/0.png"))
                screenPic.push(image(svgArr[2],960,0,960,1080,"./images/comix/empty.png"))
            }
        }
    }
    //концовка (после 3-го этажа — глава 3 — свой диптих final3-0/final3-1; после 4-го этажа —
    //глава 4 (V65) — диптих 4-0/4-1; V87: если босс этажа — Медуза пустоты, свой диптих
    //4-2/4-3 — выбор босса сделан в nextFloor ещё до комикса спуска; V147: Грибу пустоты
    //(id 27) — свой диптих 4-3_1/4-3_2 (B32, арт от пользователя), раньше показывалась Медуза)
    if(fin === 1) {
        let finPair = status.meta.page === 4 ?
                      (status.voidBossId === 27 ? ["4-3_1.png","4-3_2.png"] :
                       status.voidBossId === 26 ? ["4-2.png","4-3.png"] : ["4-0.png","4-1.png"]) :
                      status.meta.page === 3 ? ["final3-0.png","final3-1.png"] : ["final1.png","final2.png"]
        screenPic.push(image(svgArr[2],0,0,960,1080,"./images/comix/"+finPair[0]))
        screenPic.push(image(svgArr[2],960,0,960,1080,"./images/comix/"+finPair[1]))
    }
    //между уровнями (спуск на 3-й этаж — глава 3 — арт final3-0; спуск на 4-й этаж «Пустота» —
    //глава 4 (V65) — диптих по боссу (V87): Медуза пустоты — 4-2/empty, Циклоп — boss4-0/boss4-1;
    //V147: Гриб пустоты — свой арт 4-3_1/empty (раньше диптих Медузы))
    if(fin === 2) {
        if(status.meta.page === 4) {
            if(status.voidBossId === 27) {
                screenPic.push(image(svgArr[2],0,0,960,1080,"./images/comix/4-3_1.png"))
                screenPic.push(image(svgArr[2],960,0,960,1080,"./images/comix/empty.png"))
            } else if(status.voidBossId === 26) {
                screenPic.push(image(svgArr[2],0,0,960,1080,"./images/comix/4-2.png"))
                screenPic.push(image(svgArr[2],960,0,960,1080,"./images/comix/empty.png"))
            } else {
                screenPic.push(image(svgArr[2],0,0,960,1080,"./images/comix/boss4-0.png"))
                screenPic.push(image(svgArr[2],960,0,960,1080,"./images/comix/boss4-1.png"))
            }
        } else {
            let midPic = status.meta.page === 3 ? "final3-0.png" : "final1.png"
            screenPic.push(image(svgArr[2],0,0,960,1080,"./images/comix/"+midPic))
            screenPic.push(image(svgArr[2],960,0,960,1080,"./images/comix/empty.png"))
        }
    }
    clearTimeout(comixTimeout)
    comixTimeout = setTimeout(() => {
        document.removeEventListener('click', onClick)
        document.removeEventListener('keydown', onClick)
        document.addEventListener('click', onClick)
        document.addEventListener('keydown', onClick)
    }, 20)
}
function onClick() {
    //слушатели снимаются ДО вызова newGame/endScreen: исключение внутри них не должно
    //оставлять onClick навсегда на document (иначе любая клавиша/клик перезапускает забег)
    document.removeEventListener('click', onClick)
    document.removeEventListener('keydown', onClick)
    //V147: снимаем паузу комикса — дальше newGame поднимет свой забег, endScreen покажет очки
    status.pause = 0
    status.move = 1
    //V66b: вход в забег из таверны — ВСЕГДА новый забег: newGame(nextRun) тянул module-состояние
    //endGame.js (nextRun оставался true от последнего спуска этажа) — «Новая игра» после выхода
    //в меню продолжала старый забег без инициализации героя (репорт юзера). Спуски между этажами
    //идут через endScreen/кнопку очков, не через comix(0), поэтому false здесь корректен всегда
    finClick === 0 && newGame(false)
    finClick === 1 && endScreen(false,false)
    finClick === 2 && endScreen(false,true)
}
export {comix}