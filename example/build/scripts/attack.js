import { status } from "../scripts/start.js"
import { data } from "../scripts/data.js"
import { screenPic,objectValues } from "../scripts/del.js"
import { checkCollision } from "../scripts/damage.js"
import { dataGeneric } from "../scripts/sceneGenerate.js"
import { addAnim } from "../scripts/animPlay.js"
import { playback,strike } from "../scripts/sound.js"
import { battleDanceHit } from "../scripts/valkyrie.js"
import { flameOnHeroAttack } from "../scripts/flameFx.js"
//V49 огненное оружие (баф статуи): атака по врагу вешает/освежает ожог, по горящему — 2 плоских
import { fireOnAttack, weaponFireOnAttack } from "../scripts/buffFx.js"

function checkAttack() {
    // V34 «очарование»: атаковать нельзя. Стоит ЦЕЛИКОМ (и исполнение, и таймеры
    // стака): накопленных выстрелов после очарования не бывает. Способности не
    // страдают — их кулдауны тикают в отдельном activeSkillsCD, автокасты — в
    // checkEndAnim/valkyrieTick.
    if (status.info.charm) return
    // E-19 (репорт): без оружия на кукле герой не атакует вовсе. unEquip снимает
    // base-атаки из stack/current, но гейт страхует любой рассинхрон (данные анимаций
    // героя мутируются equip'ом и остаются с последним оружием)
    let hasWeapon = false
    for (let k = 11; k <= 12; k++) {
        const w = status.inventory.doll[k]
        w && w.attack !== undefined && (hasWeapon = true)
    }
    if (!hasWeapon) {
        status.attack.current.length = 0
        return
    }
    let lengthCurrent = status.attack.current.length
    for (let i = 0; i < lengthCurrent; i++) {
        let enemy = checkEnemy(status.attack.current[i])
        let obj
        enemy ? true : obj = checkObject(status.attack.current[i])
        if (enemy||obj) {
            playback(strike[5].vol,0,0,3*status.settings.soundVolume)
            enemy ? attack(enemy) :attack(obj)
            status.attack.current.splice(i,1)
            i--
            lengthCurrent--
        }
    }
    let len = status.attack.stack.length
    for (let i = 0; i < len; i++) {
        let check = 0
        let length = status.attack.current.length
        for (let j = 0; j < length; j++) {
            if (status.attack.stack[i].abil === status.attack.current[j]) {
                check = 1
            }
        }
        check === 0 && status.attack.stack[i].timer--
        if (status.attack.stack[i].timer <= 0) {
            status.attack.current.push(status.attack.stack[i].abil)
            let modifyTamer = 0
            let cd = (status.attack.stack[i].abil.cooldown*1000)/16
            status.attack.stack[i].abil.base === 1?
            modifyTamer += Math.trunc(cd*(status.info.stats[3].dops[2].value2.slice(0,-1)/100)):
            modifyTamer += Math.trunc(cd*(status.info.stats[3].dops[1].value2.slice(0,-1)/100))
             status.attack.stack[i].timer = Math.trunc(cd) - modifyTamer
        }
    }
}
function attack(target) {
    let hero = status.hero.obj
    let heroAttack = data.heroes[status.hero.class].anims[1].attack[status.hero.direction]
    hero.currentAnim = heroAttack
    hero.img.setAttribute("href", heroAttack.img)
    hero.img.setAttribute("times", heroAttack.times)
    hero.img.setAttribute("width", heroAttack.w)
    hero.img.setAttribute("height", heroAttack.h)
    hero.currentStill = 0
    hero.stop = 0
    let anim
    if (status.attack.img === "./images/attacks/staff/icon.png" ) {
        anim = [3,0]
    } else if (status.attack.img === "./images/attacks/wand/icon.png") {
        anim = [8,0]
    } else {
        anim = status.hero.obj.currentAnim.new.anim
    }
    addAnim (anim,target,status.hero.obj,status.hero.direction)
    //Боевой танец валькирии: каждый 3-й удар выпускает дротик
    battleDanceHit()
    //V26 горение (info.burning): удар героя под эффектом обжигает его самого
    flameOnHeroAttack()
    //V49 огненное оружие: ожог цели (по уже горящему — ещё 2 плоского урона)
    fireOnAttack(target)
    //V111 зачарование «Погони за пламенем» (item.fire у оружия на кукле): ожог цели
    weaponFireOnAttack(target)
    //убрать 1 дебаф при атаке
    if(status.info.removeDebuff) {
        status.info.poison && (status.info.poison -= status.info.removeDebuff)
        status.info.burning && (status.info.burning -= status.info.removeDebuff)
    }
}
function checkEnemy(attack) {
    if (attack.type === "magic") {
        return checkMagic(attack)
    }
    let len = objectValues.length
    for (let i = 0; i < len; i++) {
        //V113: мирный Огнементаль (квест «Погоня за пламенем», выбор не сделан) —
        //не цель для атак героя; после «НАПАСТЬ» flameNpc сбрасывается и он бьётся
        //V135: то же для мирного Слаймэна (квест «Корм слизи»)
        if (objectValues[i].type === "enemy" && objectValues[i].flameNpc !== 1 &&
            objectValues[i].slimeNpc !== 1 && objectValues[i].entNpc !== 1 &&
            objectValues[i].hrupNpc !== 1) {
            let rect = objectValues[i].rect
            let x1 = rect.x.animVal.value
            let y1 = rect.y.animVal.value
            let w1 = rect.width.animVal.value
            let h1 = rect.height.animVal.value
            let newObjAnim = attack.anims[status.hero.direction]
            let w2 = newObjAnim.w/newObjAnim.times
            let h2 = newObjAnim.h
            if (attack.range) {
                w2 = newObjAnim.w*attack.range
                h2 = newObjAnim.h*attack.range
            }
            let x2 = status.hero.x+16-newObjAnim.w/newObjAnim.times/2+newObjAnim.x
            let y2 = status.hero.y+25-newObjAnim.h/2+newObjAnim.y
            if (checkCollision(x1, x2, w1, w2, y1, y2, h1, h2)) {
                return objectValues[i]
            }
        }
    }
    return false
}
function checkMagic(attack) {
    let len = objectValues.length
    for (let i = 0; i < len; i++) {
        //V113: мирный Огнементаль (квест «Погоня за пламенем», выбор не сделан) —
        //не цель для атак героя; после «НАПАСТЬ» flameNpc сбрасывается и он бьётся
        //V135: то же для мирного Слаймэна (квест «Корм слизи»)
        if (objectValues[i].type === "enemy" && objectValues[i].flameNpc !== 1 &&
            objectValues[i].slimeNpc !== 1 && objectValues[i].entNpc !== 1 &&
            objectValues[i].hrupNpc !== 1) {
            let rect = objectValues[i].rect
            let x1 = rect.x.animVal.value
            let y1 = rect.y.animVal.value
            let x2 = status.hero.x
            let y2 = status.hero.y
            if (Math.abs(x1-x2) + Math.abs(y1-y2) < attack.range * 32) {
                return objectValues[i]
            }
        }
    }
    return false
}
function checkMagicToObj(attack) {
    let len = dataGeneric.scenes[status.levelFloor].objects.length
    for (let i = 0; i < len; i++) {
        if (dataGeneric.scenes[status.levelFloor].objects[i][7] === 1&&dataGeneric.scenes[status.levelFloor].objects[i][8]===undefined) {
            let x1 = dataGeneric.scenes[status.levelFloor].objects[i][0]*32
            let y1 = dataGeneric.scenes[status.levelFloor].objects[i][1]*32
            let x2 = status.hero.x
            let y2 = status.hero.y
            if (Math.abs(x1-x2) + Math.abs(y1-y2) < attack.range * 32) {
                //V55: || false — «надгробия» (null) в screenPic вместо удалённых спрайтов
                return screenPic[dataGeneric.scenes[status.levelFloor].objects[i][6]] || false
            }
        }
    }
    return false
}
function checkObject(attack) {
    if (attack.type === "magic") {
        return checkMagicToObj(attack)
    }
    let len = dataGeneric.scenes[status.levelFloor].objects.length
    for (let i = 0; i < len; i++) {
        if (dataGeneric.scenes[status.levelFloor].objects[i][7] === 1&&dataGeneric.scenes[status.levelFloor].objects[i][8]===undefined) {
            let x1 = dataGeneric.scenes[status.levelFloor].objects[i][0]*32
            let y1 = dataGeneric.scenes[status.levelFloor].objects[i][1]*32
            let w1 = dataGeneric.scenes[status.levelFloor].objects[i][3]*32
            let h1 = dataGeneric.scenes[status.levelFloor].objects[i][4]*32
            let newObjAnim = attack.anims[status.hero.direction]
            let x2 = status.hero.x+16-newObjAnim.w/newObjAnim.times/2+newObjAnim.x
            let y2 = status.hero.y+25-newObjAnim.h/2+newObjAnim.y
            let w2 = newObjAnim.w/newObjAnim.times
            let h2 = newObjAnim.h
            if (attack.range) {
                w2 = newObjAnim.w*attack.range
                h2 = newObjAnim.h*attack.range
            }
            if (checkCollision(x1, x2, w1, w2, y1, y2, h1, h2)) {
                //V55: || false — «надгробия» (null) в screenPic вместо удалённых спрайтов
                return screenPic[dataGeneric.scenes[status.levelFloor].objects[i][6]] || false
            }
        }
    }
    return false
}
export {attack,checkAttack}