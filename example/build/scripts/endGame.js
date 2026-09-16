import { status } from "../scripts/start.js"
import { T } from "../scripts/localization.js"
import { data } from "../scripts/data.js"
import { screenPic,del,objectValues } from "../scripts/del.js"
import { svgArr,image, text } from "../scripts/svg.js"
import { playback,strike,ctx_sound,playTrack,TRACK } from "../scripts/sound.js"
import { metaItems } from "../scripts/metaItems.js"
import { newGame } from "../scripts/newGame.js"
import { journalAdd, J_DEATH } from "../scripts/journal.js"
//V52: достижение «Перебор» — класс гибели в мете
import { achDeath } from "../scripts/achievements.js"
function endGame() {
    let hero = status.hero.obj
    if (hero.type === "corpse") return
    //V37 журнал: гибель героя
    journalAdd(T("journ.death"), J_DEATH)
    hero.currentAnim = data.heroes[status.hero.class].anims[2].others[1]
    hero.img.setAttribute("href", data.heroes[status.hero.class].anims[2].others[1].img)
    hero.img.setAttribute("times", data.heroes[status.hero.class].anims[2].others[1].times)
    hero.img.setAttribute("width", data.heroes[status.hero.class].anims[2].others[1].w)
    hero.img.setAttribute("height", data.heroes[status.hero.class].anims[2].others[1].h)
    status.hero.waitTime = 0
    hero.stop = 0
    hero.type = "corpse"
    //V52: «Перебор» — фиксация класса гибели (мета между забегами)
    achDeath()
    hero.currentStill = 0
    hero.animCounters = 60/data.heroes[status.hero.class].anims[2].others[1].speed
    setTimeout(()=>endScreen(true,false),2000)
}
let numbersArr = []
let points
let pointsLocal
let loseRun
let nextRun
function endScreen(lose,next) {
    del()
    status.hero.obj && (status.hero.obj.type = "corpse")
    loseRun = lose
    nextRun = next
    status.start = 2
    //V65: глава 4 — после её прохождения глав больше нет (зажим снят с 3 до 4)
    if(!lose && !next && status.meta.page < 4) {
        status.meta.pageMax++
        status.meta.page++
    }
    //гасим ВСЮ музыку (шина: активный трек → беззвучно) и дозвуки уровня: контекст эффектов
    //suspend'ится, playback сам разбудит его для звуков подсчёта очков
    playTrack(TRACK.none)
    ctx_sound.suspend()
    screenPic.push(image(svgArr[2],520,50,919,73,"./images/UI/panels/endTop.png"))
    screenPic.push(text(svgArr[2],1920/2,106,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("eg.level"),{"id":"delItemText","size":60,"font":"baseFont4","anchor":"middle"}))
    screenPic.push(image(svgArr[2],35,160,919,796,"./images/UI/panels/panel.png"))
    screenPic.push(text(svgArr[2],485,216,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("eg.enemies"),{"id":"delItemText","size":60,"font":"baseFont4","anchor":"middle"}))
    screenPic.push(image(svgArr[2],965,160,919,796,"./images/UI/panels/panel.png"))
    screenPic.push(text(svgArr[2],1415,216,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("eg.gold"),{"id":"delItemText","size":60,"font":"baseFont4","anchor":"middle"}))
    //убитые враги
    numbersArr.length = 0
    rollStart = 0
    rollAccrued = 0
    //плоская карта врагов по id: data.enemes — это массив групп,
    //и id врага НЕ совпадает с индексом группы (некоторые группы содержат 2 врагов)
    let enemyById = {}
    for (let g = 0; g < data.enemes.length; g++) {
        let group = data.enemes[g]
        for (let k = 0; k < group.length; k++) {
            if (group[k]) enemyById[group[k].id] = group[k]
        }
    }
    let lengthKilledEnemes = status.meta.killedEnemes.length
    //V35: у монстров 3-го этажа собственные id 14-20 (раньше были дубли 7-13 заглушки) —
    //база смещения экрана результатов всегда этаж × 7
    let floorBase = status.levelFloor * 7
    for(let i = floorBase; i < floorBase + 7 && i < lengthKilledEnemes; i++) {
        if(status.meta.killedEnemes[i]) {
            let enemy1 = enemyById[i]
            if(!enemy1) continue
            let rel = i - floorBase
            //V72: боссы (data-флаг boss) на экране очков сжаты по вертикали до размера обычных
            //врагов — кадр высотой 51px рисуется ×2 = 102px, как у всех; иначе крупные листы
            //(Демон/Циклоп 128px → 256px при ×2) перекрывали соседние строки списка.
            //Ширина масштабируется с той же пропорцией (кадр не растягивается)
            let anim = enemy1.anims[0].move[1]
            let sprW = anim.w*2, sprH = anim.h*2
            if (enemy1.boss === 1) {
                sprH = 102
                sprW = Math.round(anim.w*102/anim.h)
            }
            objectValues.push({"id":status.oVcount,"type":"enemy","animCounters":60/anim.speed,"currentAnim":anim,"currentStill":0,"stop":0,
            "img":image(svgArr[2],
                150 + Math.trunc(rel/4)*384,
                280 + rel%4*150,
                sprW,
                sprH,
                anim.img,
                {"times":anim.times,"id":status.oVcount,"frame":1})})
            status.oVcount++
            objectValues[objectValues.length-1].rect = objectValues[objectValues.length-1].img.clipRect
            screenPic.push(image(svgArr[2],330 + Math.trunc(rel/4)*384,303 + rel%4*150,64,64,"./images/UI/point.png"))
            numbersArr.push({"input":text(svgArr[2],280 + Math.trunc(rel/4)*384,350 + rel%4*150,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,enemy1.stats.exp*status.meta.killedEnemes[i],{"id":"delItemText","size":42,"font":"baseFont4","anchor":"middle"}),"export":text(svgArr[2],430 + Math.trunc(rel/4)*384,350 + rel%4*150,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,enemy1.stats.exp*status.meta.killedEnemes[i],{"id":"delItemText","size":42,"font":"baseFont4","anchor":"middle"})})
            screenPic.push(numbersArr[numbersArr.length - 1].export)
            screenPic.push(numbersArr[numbersArr.length - 1].input)
        }
    }
    //собранное золото
    screenPic.push(image(svgArr[2],1200,300,64,64,"./images/UI/gold1.png"))
    screenPic.push(image(svgArr[2],1500,300,64,64,"./images/UI/point.png"))
    numbersArr.push({"input":text(svgArr[2],1310,345,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,status.info.gold,{"id":"delItemText","size":42,"font":"baseFont4","anchor":"middle"}),"export":text(svgArr[2],1610,345,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,status.info.gold,{"id":"delItemText","size":42,"font":"baseFont4","anchor":"middle"})})
    screenPic.push(numbersArr[numbersArr.length - 1].export)
    screenPic.push(numbersArr[numbersArr.length - 1].input)
    //всего очков
    screenPic.push(image(svgArr[2],1600,50,64,64,"./images/UI/point.png"))
    screenPic.push(text(svgArr[2],1710,95,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,status.meta.points,{"id":"delItemText","size":42,"font":"baseFont4","anchor":"middle"}))
    points = screenPic[screenPic.length-1]
    screenPic.push(text(svgArr[2],1380,445,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("eg.total"),{"id":"delItemText","size":42,"font":"baseFont4","anchor":"middle"}))
    screenPic.push(text(svgArr[2],1580,445,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,0,{"id":"delItemText","size":42,"font":"baseFont4","anchor":"middle"}))
    pointsLocal = screenPic[screenPic.length-1]
    if(!lose && status.meta.page === 2 && status.meta.openPage[0] === 0) {
        screenPic.push(text(svgArr[2],1400,520,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("eg.chapter",status.meta.page),{"id":"delItemText","size":42,"font":"baseFont4","anchor":"middle"}))
        screenPic.push(text(svgArr[2],1400,595,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("eg.stronger"),{"id":"delItemText","size":42,"font":"baseFont4","anchor":"middle"}))
        screenPic.push(text(svgArr[2],1400,670,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("eg.spider0"),{"id":"delItemText","size":42,"font":"baseFont4","anchor":"middle"}))
        status.meta.openPage[0] = 1
    }
    if(!lose && status.meta.page === 3 && status.meta.openPage[1] === 0) {
        screenPic.push(text(svgArr[2],1400,520,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("eg.chapter",status.meta.page),{"id":"delItemText","size":42,"font":"baseFont4","anchor":"middle"}))
        screenPic.push(text(svgArr[2],1400,595,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("eg.maxstrong"),{"id":"delItemText","size":42,"font":"baseFont4","anchor":"middle"}))
        status.meta.openPage[1] = 1
    }
    //V65: разблокировка главы 4 («Финал») — после победы над 3 главой
    if(!lose && status.meta.page === 4 && status.meta.openPage[2] === 0) {
        screenPic.push(text(svgArr[2],1400,520,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("eg.chapter",status.meta.page),{"id":"delItemText","size":42,"font":"baseFont4","anchor":"middle"}))
        screenPic.push(text(svgArr[2],1400,595,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("eg.finstrong"),{"id":"delItemText","size":42,"font":"baseFont4","anchor":"middle"}))
        status.meta.openPage[2] = 1
    }
    !lose && next && status.levelFloor === 0 && screenPic.push(text(svgArr[2],1400,670,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("eg.descend0"),{"id":"delItemText","size":42,"font":"baseFont4","anchor":"middle"}))
    !lose && next && status.levelFloor === 1 && screenPic.push(text(svgArr[2],1400,670,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("eg.descend1"),{"id":"delItemText","size":42,"font":"baseFont4","anchor":"middle"}))
    //V65: спуск на 4 этаж («Пустота») — только глава 4 (в гл.1–3 этаж 3 был последним)
    !lose && next && status.levelFloor === 2 && screenPic.push(text(svgArr[2],1400,670,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("eg.descend2"),{"id":"delItemText","size":42,"font":"baseFont4","anchor":"middle"}))
    let millisec =  Date.now() - status.info.time
    let sec = Math.trunc(millisec/1000)
    let min = Math.trunc(sec/60)
    let hour = Math.trunc(min/60)
    let mm = String(min%60).padStart(2,"0")
    let ss = String(sec%60).padStart(2,"0")
    screenPic.push(text(svgArr[2],1400,745,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("eg.time",hour+":"+mm+":"+ss),{"id":"delItemText","size":42,"font":"baseFont4","anchor":"middle"}))
    next === true ? status.levelFloor++ : status.levelFloor = 0
    lose === true && (status.levelFloor = 0)
    status.meta.page === 1  && (status.levelFloor = 0)
}
let rollStart = 0
let rollAccrued = 0
const ROLL_RATE = 20 //очков в секунду (ускорено в 2 раза по запросу пользователя, было 10)
function rollNumbers(lose,next) {
    let lengthNumbersArr = numbersArr.length
    if (lengthNumbersArr === 0) return
    if (rollStart === 0) rollStart = Date.now()
    let elapsed = (Date.now() - rollStart) / 1000
    //сколько всего очков нужно начислить (input хранит исходное значение и не меняется)
    let total = 0
    for(let i = 0; i < lengthNumbersArr; i++) {
        total += parseInt(numbersArr[i].input.textContent) || 0
    }
    let target = Math.min(total, Math.floor(elapsed * ROLL_RATE))
    let toAccrue = target - rollAccrued
    if (toAccrue > 0) {
        rollAccrued = target
        for(let i = 0; i < lengthNumbersArr && toAccrue > 0; i++) {
            let current = parseInt(numbersArr[i].export.textContent) || 0
            if (current > 0) {
                let take = Math.min(current, toAccrue)
                numbersArr[i].export.textContent = current - take
                status.meta.points += take
                points.textContent = status.meta.points
                pointsLocal.textContent = parseInt(pointsLocal.textContent) + take
                toAccrue -= take
                playback(strike[5].vol,0,0,status.settings.soundVolume)
            }
        }
    }
    if (rollAccrued >= total) {
        numbersArr.length = 0
        rollStart = 0
        rollAccrued = 0
        //V59: спрайт кнопки — пустой emptyButton.png вместо next.png с запечённым текстом;
        //надпись «Далее» — локализованный текст поверх (раньше текст был запечён в спрайте)
        screenPic.push(image(svgArr[2],1920/2-341/2,960,341,96,"./images/UI/panels/buttons/button.png",{"glow":1,"func":()=>{if(!lose && next){newGame(nextRun)} else {metaItems(lose,next)}}}))
        screenPic.push(text(svgArr[2],1920/2,1025,"0pt","50pt","black","2px",`rgb(204, 153, 102)`,T("lobby.next"),{"id":"delItemText","size":48,"font":"baseFont4","anchor":"middle"}))
        playback(strike[2].vol,0,0,status.settings.soundVolume)
    }
}
export {endGame,rollNumbers,endScreen,loseRun,nextRun}