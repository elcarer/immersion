import { objectValues } from "../scripts/del.js"
import { status } from "../scripts/start.js"
//V63: логика ловушек (фазы шипов/огня, облако кислоты, ожог от вспышки) — trapsFx.js
import { trapTick } from "../scripts/trapsFx.js"
import { svgArr,image, spritePos, moveSprite, releaseSprite, rectPos } from "../scripts/svg.js"
import { floatText } from "../scripts/floatText.js"
import { reanimateCheck,checkCollision,playEffect } from "../scripts/damage.js"
import { enemyDie, enemyStun } from "../scripts/enemyAI.js"
import { data } from "../scripts/data.js"
import { activeSkills,useSkill } from "../scripts/activeSkills.js"
import { changeHP,checkFood } from "../scripts/takeDamage.js"
import { playback,strike } from "../scripts/sound.js"
import { endGame } from "../scripts/endGame.js"
import { changeBossHP } from "../scripts/hpBar.js"
import { wingsActive,dashInvulnActive } from "../scripts/valkyrie.js"

function checkBuffs() {
    trapTick()
    checkPoison()
    checkInvisible()
    checkPins()
    checkDamPins()
    status.info.cloudeAbil && checkCloude()
    status.info.knifeAbil && checkKnife()
    status.info.grapAbil && checkGrap()
    status.info.fireAbil && checkFireball()
    status.info.coldAbil && checkCold()
    status.info.earthAbil && checkEarth()
    status.info.meteorTime && checkMeteor()
    //магический щит
    if(status.info.magicShieldDuration) {
        status.info.magicShieldDuration--
        let length = objectValues.length
        for (let i = 0; i < length; i++) {
            if(objectValues[i].img.href.animVal === "./images/effects/15.png") {
                spritePos(objectValues[i].img, status.hero.obj.rect.x.animVal.value, status.hero.obj.rect.y.animVal.value)
                if(status.info.magicShieldDuration <= 0) {
                    releaseSprite(objectValues[i].img)
                    objectValues[i] = undefined
                    objectValues.splice(i,1)
                    status.info.magicShieldObjI = undefined
                    status.info.magicShieldDuration = undefined
                    length--
                    i--
                }
                break
            }
        }
    }
    status.info.reflectAbil && checkReflect()
}
//V63: ловушки переехали в trapsFx.js — фазы шипов/огня (2с), облако кислоты (урон только
//у облака, не у самой ловушки), ожог от вспышки огненной ловушки. trapTick() зовётся в
//checkBuffs на месте старого checkTraps; удвоение урона врагам от сета «Великий вор»
//тоже живёт там (импорт setCount перенесён вслед за логикой).
function checkPoison() {
    let lengthEnemy = objectValues.length
    for (let i = 0; i < lengthEnemy; i++) {
        //V79: неуязвимость (Циклоп, invulnActive) — яд замирает на окно: стек и таймер
        //не тратятся, сигналит после конца окна как обычно
        if (objectValues[i].type === "enemy" && objectValues[i].poison > 0 && !objectValues[i].invulnActive) {
            objectValues[i].poisonTime--
            if(objectValues[i].poisonTime <= 0) {
                objectValues[i].stats.hp -= objectValues[i].poison
                objectValues[i].class.boss === 1 && changeBossHP(document.getElementById("hpBossBarI"),document.getElementById("hpBossText"))
                if(objectValues[i].class.id === 11) {
                    !status.spiderBossFight && (status.spiderBossFight = 0)
                    status.spiderBossFight += objectValues[i].poison
                }
                let rectM = objectValues[i].rect
                let mPos = rectPos(rectM)
                let x = mPos[0] + rectM._w/2
                let y = mPos[1]
                floatText(x,y,objectValues[i].poison,"#339966","12px","none")
                //V67a: пул половинится каждый тик (округление вниз) — было -1,
                //итоговая сумма N+(N-1)+…+1 выходила слишком сильной
                objectValues[i].poison = Math.trunc(objectValues[i].poison / 2)
                objectValues[i].poisonTime = 30
            }
            if(objectValues[i].stats.hp <= 0 && !reanimateCheck(objectValues[i])) {
                enemyDie(objectValues[i])
            }
        }
        if (objectValues[i].type === "hero" && status.info.poison && !wingsActive() && !dashInvulnActive()) {
            status.info.poisonTime--
            if(status.info.poisonTime <= 0) {
                //V46b: «Выносливость» пропускает часть тиков яда (проц с накопительным
                //шансом вын% — урона нет). V67a: пул яда КАЖДЫЙ тик половинится
                //(округление вниз; было -1 — сумма N+(N-1)+…+1 выходила слишком
                //сильной), пропущенный тик так же половинит пул — без урона
                status.info.poisonSkipCarry = (status.info.poisonSkipCarry || 0) + parseInt(status.info.stats[2].dops[2].value2.slice(0,-1))
                let skipPoison = status.info.poisonSkipCarry >= 100
                skipPoison && (status.info.poisonSkipCarry -= 100)
                let takePoison = skipPoison ? 0 : status.info.poison
                status.info.hp -= takePoison
                status.info.hp <= 0 && (status.info.hp = 0)
                let rectM = status.hero.obj.rect
                let x = rectM.x.animVal.value + rectM.width.animVal.value/2
                let y = rectM.y.animVal.value
                takePoison > 0 && floatText(x,y,takePoison,"#339966","12px","none")
                status.info.poison = Math.trunc(status.info.poison / 2)
                status.info.poisonTime = 30
                changeHP(document.getElementById("hpBarI"),document.getElementById("hpText"),"hp")
            }
            checkFood()
            status.info.hp <= 0 && endGame()
        }
    }
}
function checkInvisible() {
    status.info.invisibleTime > 0 && status.info.invisibleTime--
    if(status.info.invisible > 0 && status.info.invisibleTime <= 0) {
        status.info.invisible = 0
        status.hero.obj.img.setAttribute("opacity", 1)
        let i = status.info.activeSkills.findIndex(f => f.skill.title === "skill.0.1.title")
        i !== -1 && (status.info.activeSkills[i].cooldown = status.info.activeSkills[i].skill.cooldown)
    }
}
function checkMeteor() {
    status.info.meteorTime--
    spritePos(status.info.meteor, status.info.meteor.x.animVal.value, status.info.meteor.y.animVal.value + 5)
    if(status.info.meteorTime <= 0) {
        status.info.meteorTime = 0
        status.info.meteor.remove()
        //падение метеорита
        let length = objectValues.length
        for (let i = 0; i < length; i++) {
            if(objectValues[i].img === status.info.meteorHole) {
                playEffect(objectValues[i],data.effects[13])
                playback(strike[12].vol,0,0,6*status.settings.soundVolume)
                releaseSprite(objectValues[i].img)
                objectValues.splice(i,1)
                length--
                i--
                status.info.meteorHole = undefined
                break
            }
        }
    }
}
let pinsArr = []
function checkPins() {
    if(status.info.pins > 0 && checkPin()) {
        status.info.pins--
        createPin()
        let i = status.info.activeSkills.findIndex(f => f.skill.title === "skill.0.2.title")
        if(i !== -1 && status.info.pins === 0) {
            status.info.activeSkills[i].cooldown = status.info.activeSkills[i].skill.cooldown
        }
    }
    function checkPin() {
        let lengthPins = pinsArr.length
        for (let i = 0; i < lengthPins; i++) {
            if(pinsArr[i].x === Math.trunc(status.hero.x/32) && pinsArr[i].y === Math.trunc((status.hero.y+35)/32)) {
                return false
            }
        }
        return true
    }
    function createPin() {
        pinsArr.push({"x":Math.trunc(status.hero.x/32),"y":Math.trunc((status.hero.y+35)/32),"img":image(svgArr[1],Math.trunc(status.hero.x/32)*32,Math.trunc((status.hero.y+35)/32)*32,32,32,"./images/effects/pin.png",{})})
    }
}
function delPins(num = 0) {
    let lengthPins
    num === 0 ? lengthPins = pinsArr.length : lengthPins = num
    for (let i = 0; i < lengthPins; i++) {
        delPin(pinsArr,i)
        lengthPins--
        i--
    }
    pinsArr = []
}
function delPin(pinsArr,i) {
    pinsArr[i].img.remove()
    pinsArr.splice(i,1)
}
function checkDamPins() {
    let lengthEnemy = objectValues.length
    for (let i = 0; i < lengthEnemy; i++) {
        if (objectValues[i].type === "enemy") {
            let rectM = objectValues[i].rect
            let mPos = rectPos(rectM)
            let x = mPos[0]
            let y = mPos[1]
            let w = rectM._w
            let h = rectM._h
            let lengthPins = pinsArr.length
            for (let j = 0; j < lengthPins; j++) {
                let x2 = pinsArr[j].x*32
                let y2 = pinsArr[j].y*32
                let w2 = 32
                let h2 = 32
                if(checkCollision(x,x2,w,w2,y,y2,h,h2)) {
                    //V79: неуязвимость (Циклоп, invulnActive) — штырь тратится, урона нет,
                    //стан (pinsStan) проходит как обычно (решение пользователя)
                    if(!objectValues[i].invulnActive) {
                        let damage = Math.trunc(Math.random() * (status.info.stats[4].dops[0].value1) + 1)
                        damage < 1 && (damage = 1)
                        objectValues[i].stats.hp -= damage
                        objectValues[i].class.boss === 1 && changeBossHP(document.getElementById("hpBossBarI"),document.getElementById("hpBossText"))
                        if(objectValues[i].class.id === 11) {
                            !status.spiderBossFight && (status.spiderBossFight = 0)
                            status.spiderBossFight += damage
                        }
                        floatText(x,y,damage,"white","12px","none")
                        objectValues[i].class.effects.takeDamage && playEffect(objectValues[i],data.effects[objectValues[i].class.effects.takeDamage])
                    }
                    delPin(pinsArr,j)
                    lengthPins--
                    j--
                    if(status.info.pinsStan && objectValues[i].noStunTime === 0) {
                        enemyStun(objectValues[i])
                    }
                    if(objectValues[i].stats.hp <= 0 && !reanimateCheck(objectValues[i])) {
                        enemyDie(objectValues[i])
                    }
                }
            }
        }
    }
}
function checkCloude() {
    if(status.info.cloudeTime > 0) {
        status.info.cloudeTime--
        if(status.info.cloudeTime <= 0) {
            status.info.cloude = undefined
            status.info.cloudeAbil.cooldown = status.info.cloudeAbil.skill.cooldown
        }
    }
    if(status.info.cloudeAbil.cooldown <= 0 && status.info.cloudeAbil.duration <= 0) {
        useSkill(status.info.cloudeAbil)
    }
}
function checkKnife() {
    if(status.info.knifeAbil.cooldown <= 0) {
        useSkill(status.info.knifeAbil)
    }
}
function checkFireball() {
    if(status.info.fireAbil.cooldown <= 0) {
        useSkill(status.info.fireAbil)
    }
}
function checkCold() {
    if(status.info.coldAbil.cooldown <= 0) {
        useSkill(status.info.coldAbil)
    }
}
function checkEarth() {
    if(status.info.earthAbil.cooldown <= 0) {
        useSkill(status.info.earthAbil)
    }
}
function checkReflect() {
    if(status.info.reflectAbil.cooldown > 0 && !status.info.auraReflect) {
        status.info.reflectAbil.cooldown--
    }
    if(status.info.reflectAbil.cooldown <= 0 && !status.info.auraReflect) {
        useSkill(status.info.reflectAbil)
    }
    if(status.info.auraReflect) {
        let x,y
        status.info.auraReflect.href.animVal === "./images/effects/reflect.png" ? (x = 32, y = 19) : (x = 64, y = 51)
        spritePos(status.info.auraReflect, status.hero.obj.rect.x.animVal.value - x, status.hero.obj.rect.y.animVal.value - y)
        status.info.reflectAbil.duration > 0 && status.info.reflectAbil.duration--
        if(status.info.reflectAbil.duration <= 0) {
            status.info.reflectAbil.cooldown = status.info.reflectAbil.skill.cooldown
            status.info.auraReflect.remove()
            status.info.auraReflect = undefined
        }
    }
}
function checkGrap() {
    if(status.info.grapAbil && status.info.grapAbil.cooldown <= 0) {
        useSkill(status.info.grapAbil)
    }
    if(status.info.graped && status.info.graped.type === "enemy") {
        let rect = status.info.graped.rect
        let x = rect.x.animVal.value
        let y = rect.y.animVal.value
        let speed = 3
        if(x < status.hero.x) {
            moveSprite(status.info.graped.img, speed, 0)
        } else {
            moveSprite(status.info.graped.img, -speed, 0)
        }
        if(y < status.hero.y) {
            moveSprite(status.info.graped.img, 0, speed)
        } else {
            moveSprite(status.info.graped.img, 0, -speed)
        }
        if(Math.abs(x - status.hero.x) <= speed && Math.abs(y - status.hero.y) <= speed) {
            let damage = Math.trunc(Math.random() * (status.info.stats[4].dops[0].value1 + 1))
            if(damage > 0) {
                //V79: неуязвимость (Циклоп, invulnActive) — урон «гаечки» блокируется,
                //подтягивание и стан проходят как обычно (решение пользователя)
                if(!status.info.graped.invulnActive) {
                    status.info.graped.stats.hp -= damage
                    status.info.graped.class.boss === 1 && changeBossHP(document.getElementById("hpBossBarI"),document.getElementById("hpBossText"))
                    if(status.info.graped.class.id === 11) {
                        !status.spiderBossFight && (status.spiderBossFight = 0)
                        status.spiderBossFight += damage
                    }
                    floatText(x,y,damage,"white","12px","none")
                    status.info.graped.class.effects.takeDamage && playEffect(status.info.graped,data.effects[status.info.graped.class.effects.takeDamage])
                }
                if(status.info.graped.noStunTime === 0) {
                    enemyStun(status.info.graped)
                }
                if(status.info.graped.stats.hp <= 0 && !reanimateCheck(status.info.graped)) {
                    enemyDie(status.info.graped)
                }
            }
            status.info.graped = undefined
        } 
    }
}
export {checkBuffs,delPins,delPin,pinsArr}