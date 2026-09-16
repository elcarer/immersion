import { status } from "../scripts/start.js"
import { dataGeneric } from "../scripts/sceneGenerate.js"
import { checkCollision,playEffect } from "../scripts/damage.js"
import { screenPic,objectValues } from "../scripts/del.js"
import { releaseSprite } from "../scripts/svg.js"
//V80: вместе с разрушенным объектом снимается его наземная тень
import { removeObjShadow } from "../scripts/groundShadow.js"
import { data } from "../scripts/data.js"
import { playback,strike } from "../scripts/sound.js"

//V16: раньше каждый тик делался полный проход objects×bullets и внутри — screenPic.find
//(линейный скан тысяч элементов) на КАЖДУЮ пару. Теперь: пуль нет — выходим сразу,
//иначе один прескан пуль + прямой доступ к спрайту объекта по его индексу в screenPic
//(objects[i][6] и есть индекс, он проставляется при создании тайла).
function destroyObjects() {
    let bullets = []
    let lengthBullets = objectValues.length
    for (let j = 0; j < lengthBullets; j++) {
        if (objectValues[j].type === "bullet") bullets.push(j)
    }
    if (bullets.length === 0) return
    let lengthObjects = dataGeneric.scenes[status.levelFloor].objects.length
    for (let i = 0; i < lengthObjects; i++) {
        if (dataGeneric.scenes[status.levelFloor].objects[i][7] === 1&&dataGeneric.scenes[status.levelFloor].objects[i][8]===undefined) {
            let rectM = screenPic[dataGeneric.scenes[status.levelFloor].objects[i][6]]
            if (!rectM || typeof rectM.x !== "object") continue
            for (let b = 0; b < bullets.length; b++) {
                let j = bullets[b]
                if (j >= objectValues.length || objectValues[j].type !== "bullet") continue
                let rectB = objectValues[j].rect
                if (checkCollision( rectM.x.animVal.value,rectB.x.animVal.value,
                    rectM.width.animVal.value,rectB.width.animVal.value,
                    rectM.y.animVal.value,rectB.y.animVal.value,
                    rectM.height.animVal.value,rectB.height.animVal.value)) {
                        playEffect(rectM,data.effects[2],0)
                        playback(strike[4].vol,0,0,3*status.settings.soundVolume)
                        removeObjShadow(rectM)
                        rectM.remove()
                        dataGeneric.scenes[status.levelFloor].objects.splice(i,1)
                        if (objectValues[j].currentAnim.bullet) {
                            let effect
                            objectValues[j].currentAnim.effect !== undefined ? effect = data.effects[objectValues[j].currentAnim.effect] : effect = data.effects[0]
                            playEffect(objectValues[j],effect)
                            releaseSprite(objectValues[j].img)
                            objectValues.splice(j,1)
                            lengthBullets--
                            bullets.splice(b,1)
                            b--
                        }
                        return
                    }
                }
            }
    }
}
export {destroyObjects}
