import { screenPic,objectValues,acidArr } from "../scripts/del.js"
import { checkCollision,playEffect } from "../scripts/damage.js"
import { status } from "../scripts/start.js"
import { dataGeneric } from "../scripts/sceneGenerate.js"
import { data } from "../scripts/data.js"
import { svgArr,image, moveSprite, releaseSprite, rectPos } from "../scripts/svg.js"
import { createEgg } from "../scripts/spiderBossFight.js"

function moveBullet() {
    let length = objectValues.length
    for (let i = 0; i < length; i++) {
        if (objectValues[i].currentAnim && objectValues[i].currentAnim.bullet !== "all" && (objectValues[i].currentAnim.bullet || objectValues[i].bullet)) {
            let rect = objectValues[i].rect
            //V16: позиция снаряда из кэша (rectPos) — она же нужна в коллизиях ниже
            let bPos = rectPos(rect)
            let bulletSpeed
            objectValues[i].currentAnim.bulletSpeed ? bulletSpeed = objectValues[i].currentAnim.bulletSpeed : bulletSpeed = 3
            if(objectValues[i].currentAnim.poisonMove === 1 && status.time % 31 === 0) {
                let x = bPos[0] + Math.trunc(Math.random() * 64)
                let y = bPos[1] + Math.trunc(Math.random() * 64)
                screenPic.push(image(svgArr[0],x,y,32,15,"./images/effects/acid.png",{"id":screenPic.length-1}))
                acidArr.push(screenPic[screenPic.length - 1])

                Math.trunc(Math.random() * 15) === 0 && checkCollision(x - 512, status.hero.x, 1056, 32, y - 256, status.hero.y, 563, 25) && createEgg(x,y)
            }
            if (objectValues[i].currentAnim.bullet === "right" || objectValues[i].bullet === "right") {
                moveSprite(objectValues[i].img, bulletSpeed, 0)
            }
            if (objectValues[i].currentAnim.bullet === "left" || objectValues[i].bullet === "left") {
                moveSprite(objectValues[i].img, -bulletSpeed, 0)
            }
            if (objectValues[i].currentAnim.bullet === "down" || objectValues[i].bullet === "down") {
                moveSprite(objectValues[i].img, 0, bulletSpeed)
            }
            if (objectValues[i].currentAnim.bullet === "top" || objectValues[i].bullet === "top") {
                moveSprite(objectValues[i].img, 0, -bulletSpeed)
            }
            if (objectValues[i].currentAnim.bullet === "topright" || objectValues[i].bullet === "topright") {
                moveSprite(objectValues[i].img, bulletSpeed, -bulletSpeed)
            }
            if (objectValues[i].currentAnim.bullet === "downright" || objectValues[i].bullet === "downright") {
                moveSprite(objectValues[i].img, bulletSpeed, bulletSpeed)
            }
            if (objectValues[i].currentAnim.bullet === "topleft" || objectValues[i].bullet === "topleft") {
                moveSprite(objectValues[i].img, -bulletSpeed, -bulletSpeed)
            }
            if (objectValues[i].currentAnim.bullet === "downleft" || objectValues[i].bullet === "downleft") {
                moveSprite(objectValues[i].img, -bulletSpeed, bulletSpeed)
            }
            //"crushAttack" (Шип): осколки летят по диагонали crushAttack клеток (32px)
            //от точки исчезновения основного снаряда и удаляются, пролетев это расстояние
            if (objectValues[i].crush) {
                objectValues[i].crushDist += bulletSpeed * Math.SQRT2
                if (objectValues[i].crushDist >= objectValues[i].crushRange) {
                    releaseSprite(objectValues[i].img)
                    objectValues.splice(i,1)
                    length--
                    i--
                    continue
                }
            }
            if(objectValues[i].currentAnim.effect !== undefined) {
                //V16: позиция ПОСЛЕ движения этого тика (блоки движения выше двигали спрайт)
                bPos = rectPos(rect)
                let remove = 0
                let lengthWalls = dataGeneric.scenes[status.levelFloor].walls.length
                for (let j = 0; j < lengthWalls; j++) {
                    if (screenPic[dataGeneric.scenes[status.levelFloor].walls[j][6]]) {
                    let rectM = screenPic[dataGeneric.scenes[status.levelFloor].walls[j][6]]
                        if (checkCollision(rectM.x.animVal.value,bPos[0],
                            rectM.width.animVal.value,rect.width.animVal.value,
                            rectM.y.animVal.value,bPos[1],
                            rectM.height.animVal.value,rect.height.animVal.value)) {
                                playEffect(objectValues[i],data.effects[objectValues[i].currentAnim.effect])
                                releaseSprite(objectValues[i].img)
                                objectValues.splice(i,1)
                                length--
                                i--
                                remove = 1
                                break
                        }
                    }
                }
                if(remove === 0) {
                    //V31: границы окна камеры из viewBox (зависит от зума), не литералы 1920/1080
                    const vbCam = svgArr[0].viewBox.animVal
                    if (!(bPos[0] + 100 >= vbCam.x && bPos[0] - 100 <= vbCam.x + vbCam.width && bPos[1] + 100 >= vbCam.y && bPos[1] - 100 <= vbCam.y + vbCam.height) || (status.info.cloude && checkCollision(status.info.cloude.x.animVal.value,bPos[0],
                        status.info.cloude.width.animVal.value,rect.width.animVal.value,
                        status.info.cloude.y.animVal.value,bPos[1],
                        status.info.cloude.height.animVal.value,rect.height.animVal.value))) {
                        releaseSprite(objectValues[i].img)
                        objectValues.splice(i,1)
                        length--
                        i--
                    }
                }
            }
        }
    }
}
function moveMagicBullet() {
        let length = objectValues.length
        for (let i = 0; i < length; i++) {
            if (objectValues[i].currentAnim && objectValues[i].currentAnim.bullet && objectValues[i].currentAnim.bullet === "all") {
                let rect = objectValues[i].rect
                let bPos = rectPos(rect)
                //V68 (репорт юзера): самонаводящийся магический снаряд героя, выпущенный В
                //объект карты (цель — СПРАЙТ объекта из screenPic, DOM-узел), после разрушения
                //объекта оставался навсегда: цель отсоединена от DOM, но жива как ссылка —
                //снаряд вечно кружил на её последних координатах (destroyObjects снимает только
                //снаряд-инициатор). isConnected === false только у отрезанного от DOM узла;
                //у врагов/героя (обычные JS-объекты) поля нет — проверку не проходят
                if (objectValues[i].target && objectValues[i].target.type !== "corpse" && objectValues[i].target.isConnected !== false) {
                    let rectE
                    objectValues[i].target.img ? rectE = objectValues[i].target.rect : rectE = objectValues[i].target
                    if (bPos[0] < rectE.x.animVal.value) {
                        moveSprite(objectValues[i].img, objectValues[i].currentAnim.bulletSpeed, 0)
                        bPos = rectPos(rect)
                    }
                    if (bPos[0] > rectE.x.animVal.value) {
                        moveSprite(objectValues[i].img, -objectValues[i].currentAnim.bulletSpeed, 0)
                        bPos = rectPos(rect)
                    }
                    if (bPos[1] < rectE.y.animVal.value) {
                        moveSprite(objectValues[i].img, 0, objectValues[i].currentAnim.bulletSpeed)
                        bPos = rectPos(rect)
                    }
                    if (bPos[1] > rectE.y.animVal.value) {
                        moveSprite(objectValues[i].img, 0, -objectValues[i].currentAnim.bulletSpeed)
                    }
            } else {
                playEffect(objectValues[i],data.effects[objectValues[i].currentAnim.effect])
                releaseSprite(objectValues[i].img)
                objectValues.splice(i,1)
                length--
                i--
            }
        }
    }
}
export {moveBullet,moveMagicBullet}