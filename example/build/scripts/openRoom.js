import { data } from "../scripts/data.js"
import { dataGeneric } from "../scripts/sceneGenerate.js"
import { status } from "../scripts/start.js"
import { objectValues } from "../scripts/del.js"
import { svgArr,image } from "../scripts/svg.js"
import { playback,strike } from "../scripts/sound.js"
import { hpBar } from "../scripts/hpBar.js"
import { justiceStrike } from "../scripts/valkyrie.js"
import { checkExp } from "../scripts/damage.js"
//V66: «корыстность» — всплывающее золото и строка журнала при открытии комнаты
import { floatText } from "../scripts/floatText.js"
import { T } from "../scripts/localization.js"
import { journalAdd, J_YELLOW } from "../scripts/journal.js"
//V67: «Вечный сапфир» — копия доп-способности источника (учёность/корыстность)
import { abilCopyBonus } from "../scripts/relics.js"
//V69: 1% шанс при открытии комнаты — питомец подбегает, рядом с героем появляется еда
import { petLuckyFood } from "../scripts/pets.js"
//V109: квест «Голос в портале» — метка «части посоха» случайному врагу открытой комнаты
import { portalQuestMarkRoom } from "../scripts/portalQuest.js"
//V115: кооператив — опыт открытия комнаты получают оба живых игрока
import { forAlive } from "../scripts/players.js"

function openRoom(room) {
    playback(strike[16].vol,0,0,2*status.settings.soundVolume)
    status.info.gold += status.info.goldroom
    //V50: «учёность» (постфикс «мысли») — 1 опыт за открытие новой (ещё не открытой) комнаты.
    //Стакается по числу надетых предметов (expous). Стартовая комната открыта при генерации —
    //сюда не попадает; коридоры открываются мимо openRoom и опыта не дают.
    //V67: копия «учёности» (Вечный сапфир) считается как своя
    //V115: «учёность» — опыт за комнату идёт КАЖДОМУ живому игроку (левелап свой)
    forAlive(P => {
        const expousTotal = P.info.expous + abilCopyBonus("expous")
        if (expousTotal > 0) {
            P.info.exp += expousTotal
            checkExp(expousTotal)
        }
    })
    //V66: «корыстность» (постфикс «корыстности») — 20% шанс найти 1 золото при открытии
    //новой (ещё не открытой) комнаты; стакается по числу надетых предметов — каждая копия
    //бросает свой шанс. Стартовая комната открыта при генерации, коридоры — мимо openRoom.
    //V67: копия «корыстности» (Вечный сапфир) бросает свой шанс наравне со своими
    let greedusTotal = status.info.greedus + abilCopyBonus("greedus")
    if (greedusTotal > 0) {
        let greedGold = 0
        for (let iG = 0; iG < greedusTotal; iG++) {
            Math.random() < 0.2 && greedGold++
        }
        if (greedGold > 0) {
            status.info.gold += greedGold
            floatText(status.hero.x - 16 + Math.trunc(Math.random() * 32),status.hero.y+8,greedGold,"#FFCC66","18px","none")
            journalAdd(T("journal.gold",greedGold), J_YELLOW)
        }
    }
    //V69/V90: удача питомца — при живом ручном зверьке 1%: он получает путь к герою и
    //бежит (другие триггеры путь не перебивают); когда остановится — еда появится на
    //нём самом (pets.petLuckyTick). Бросок на КАЖДОЕ открытие новой комнаты
    petLuckyFood()
    if (room[2]) {
    let roomFloore = dataGeneric.scenes[status.levelFloor].floor[room[0]]
    let x = roomFloore[0]
    let y = roomFloore[1]
    let w = roomFloore[2]
    let h = roomFloore[3]
    let lengthX = w-1
    let lengthY = h-1
    let lengthWalls = dataGeneric.scenes[status.levelFloor].walls.length
    let lengthObjects = dataGeneric.scenes[status.levelFloor].objects.length
    let emptyCellArr = []
    for (let ix = 1; ix < lengthX; ix++) {
        for (let iy = 0; iy < lengthY; iy++) {
            let push = true
            for (let iw = 0; iw < lengthWalls; iw++) {
                //проверка стен
                let lengthWX = dataGeneric.scenes[status.levelFloor].walls[iw][3]
                let lengthWY = dataGeneric.scenes[status.levelFloor].walls[iw][4]
                for (let iwx = 0; iwx < lengthWX; iwx++) {
                    for (let iwy = 0; iwy < lengthWY; iwy++) {
                        dataGeneric.scenes[status.levelFloor].walls[iw][0]+iwx===x+ix&&dataGeneric.scenes[status.levelFloor].walls[iw][1]+iwy===y+iy&&
                        (push = false)
                    }
                }
            }
            for (let io = 0; io < lengthObjects; io++) {
                //проверка обьектов
                let lengthWX = dataGeneric.scenes[status.levelFloor].objects[io][3]
                let lengthWY = dataGeneric.scenes[status.levelFloor].objects[io][4]
                for (let iwx = 0; iwx < lengthWX; iwx++) {
                    for (let iwy = 0; iwy < lengthWY; iwy++) {
                        dataGeneric.scenes[status.levelFloor].objects[io][0]+iwx===x+ix&&dataGeneric.scenes[status.levelFloor].objects[io][1]+iwy===y+iy&&
                        (push = false)
                    }
                }
            }
            if (push) {
                emptyCellArr.push([x+ix,y+iy])
            }
        }
    }
    emptyCellArr.sort((a,b) => Math.random() - 0.5)
    let lengthEnemes = room[2].length
    let enemesCount = 0
    for (let iE = 0; iE < lengthEnemes; iE++) {
        let length = room[2][iE][0]
        for (let i = 0; i < length; i++) {
            let enemy1 = data.enemes[iE+6*status.levelFloor][room[2][iE][1]]
            let stats = JSON.parse(JSON.stringify(enemy1.stats))
            if(status.levelFloor === 0 && status.meta.page > 1) {
                stats.hp *= 2
                stats.dmg[0] += 1
                stats.dmg[1] += 2
            }
            //V143: 3 глава — скорость +2 (было +1 с V65)
            if(status.meta.page > 2) {
                stats.hp *= 2
                stats.dmg[0] += 2
                stats.dmg[1] += 6
                stats.speed += 2
                stats.range += 1
            }
            //V65: глава 4 — ещё х1.5 ХП, урон +2/+8, зоркость +1; V67a: скорость +2; V143: скорость ещё +4 (было +2)
            if(status.meta.page > 3) {
                stats.hp *= 1.5
                stats.dmg[0] += 2
                stats.dmg[1] += 8
                stats.speed += 4
                stats.range += 1
            }
            if (emptyCellArr.length>enemesCount) {
                objectValues.push({"id":status.oVcount,"type":"enemy","class":enemy1,"stats":stats,"animCounters":60/enemy1.anims[2].others[2].speed,"currentAnim":enemy1.anims[2].others[2],"currentStill":0,"room":room,"cells":emptyCellArr,"state":Math.trunc(Math.random()*3),"stop":0,"xCell":emptyCellArr[enemesCount][0],"yCell":emptyCellArr[enemesCount][1],"noStunTime":0,
                "img":image(svgArr[1],
                    emptyCellArr[enemesCount][0]*32,
                    emptyCellArr[enemesCount][1]*32-19,
                    enemy1.anims[2].others[2].w,
                    enemy1.anims[2].others[2].h,
                    enemy1.anims[2].others[2].img,
                    {"times":enemy1.anims[2].others[2].times,"id":status.oVcount,"frame":1})})
                enemesCount++
                status.oVcount++
                objectValues[objectValues.length-1].rect = objectValues[objectValues.length-1].img.clipRect
                enemy1.skills && enemy1.skills.length > 0 && (objectValues[objectValues.length-1].skills = enemy1.skills)
                let lengthAttacks = objectValues[objectValues.length-1].class.attacks.length
                for (let iA = 0; iA < lengthAttacks; iA++) {
                    objectValues[objectValues.length-1].stats.attacksCd[iA] = Math.trunc((data.attacks[objectValues[objectValues.length-1].class.attacks[iA]].cooldown*1000)/16)
                }
                enemy1.boss === 1 && hpBar(objectValues[objectValues.length-1])
            }
        }
    }
    //Высшая справедливость валькирии: 25% шанс урона от Силы воли каждому врагу открытой комнаты
    justiceStrike(room)
    //V109: квест «Голос в портале» — открылась комната из списка «частей посоха»:
    //случайный враг комнаты получает метку (при смерти выпадет часть посоха)
    portalQuestMarkRoom(room)
}
}
export {openRoom}