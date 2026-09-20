import { screenPic,objectValues,acidArr } from "../scripts/del.js"
import { checkCollision,playEffect } from "../scripts/damage.js"
import { status } from "../scripts/start.js"
import { dataGeneric } from "../scripts/sceneGenerate.js"
import { data } from "../scripts/data.js"
import { svgArr,image,worldImage, moveSprite, releaseSprite, rectPos } from "../scripts/svg.js"
import { createEgg } from "../scripts/spiderBossFight.js"
//V110: crushBurst — разделение снаряда на 4 осколка при исчезновении (как у Шипа,
//у которого срабатывает на конце once-анимации в animPlay)
import { crushBurst } from "../scripts/animPlay.js"

// E-3: обе системы крутятся по группе gbullet (маркер isBullet — пули на спавне),
// а не сканируют весь objectValues. Снимок группы на входе = старая семантика
// «граница цикла зафиксирована»: пули, выпущенные за тик, обрабатываются со следующего.
// ВНУТРЕННИЕ фильтры по currentAnim.bullet/bullet сохранены 1:1 (игра мутирует
// obj.type на месте — см. ecsBridge), удаление — indexOf+splice (группа чистится мостом).
function despawn(o) {
    const idx = objectValues.indexOf(o)
    idx !== -1 && objectValues.splice(idx, 1)
}
function moveBullet() {
    const ents = world.queries.gbullet && world.queries.gbullet.entities
    if (!ents) return
    const snap = ents.slice()
    for (let i = 0; i < snap.length; i++) {
        const b = DATA.bag[snap[i]]
        if (b && b.currentAnim && b.currentAnim.bullet !== "all" && (b.currentAnim.bullet || b.bullet)) {
            let rect = b.rect
            //V16: позиция снаряда из кэша (rectPos) — она же нужна в коллизиях ниже
            let bPos = rectPos(rect)
            let bulletSpeed
            b.currentAnim.bulletSpeed ? bulletSpeed = b.currentAnim.bulletSpeed : bulletSpeed = 3
            if(b.currentAnim.poisonMove === 1 && status.time % 31 === 0) {
                let x = bPos[0] + Math.trunc(Math.random() * 64)
                let y = bPos[1] + Math.trunc(Math.random() * 64)
                screenPic.push(worldImage(svgArr[0],x,y,32,15,"./images/effects/acid.png",{"id":screenPic.length-1}))
                acidArr.push(screenPic[screenPic.length - 1])

                Math.trunc(Math.random() * 15) === 0 && checkCollision(x - 512, status.hero.x, 1056, 32, y - 256, status.hero.y, 563, 25) && createEgg(x,y)
            }
            if (b.currentAnim.bullet === "right" || b.bullet === "right") {
                moveSprite(b.img, bulletSpeed, 0)
            }
            if (b.currentAnim.bullet === "left" || b.bullet === "left") {
                moveSprite(b.img, -bulletSpeed, 0)
            }
            if (b.currentAnim.bullet === "down" || b.bullet === "down") {
                moveSprite(b.img, 0, bulletSpeed)
            }
            if (b.currentAnim.bullet === "top" || b.bullet === "top") {
                moveSprite(b.img, 0, -bulletSpeed)
            }
            if (b.currentAnim.bullet === "topright" || b.bullet === "topright") {
                moveSprite(b.img, bulletSpeed, -bulletSpeed)
            }
            if (b.currentAnim.bullet === "downright" || b.bullet === "downright") {
                moveSprite(b.img, bulletSpeed, bulletSpeed)
            }
            if (b.currentAnim.bullet === "topleft" || b.bullet === "topleft") {
                moveSprite(b.img, -bulletSpeed, -bulletSpeed)
            }
            if (b.currentAnim.bullet === "downleft" || b.bullet === "downleft") {
                moveSprite(b.img, -bulletSpeed, bulletSpeed)
            }
            //"crushAttack" (Шип): осколки летят по диагонали crushAttack клеток (32px)
            //от точки исчезновения основного снаряда и удаляются, пролетев это расстояние
            if (b.crush) {
                b.crushDist += bulletSpeed * Math.SQRT2
                if (b.crushDist >= b.crushRange) {
                    releaseSprite(b.img)
                    despawn(b)
                    continue
                }
            }
            if(b.currentAnim.effect !== undefined) {
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
                                playEffect(b,data.effects[b.currentAnim.effect])
                                //V110: снаряд врага с crushAttack (культист квеста «Голос в
                                //портале») исчезает о стену — разделяется на 4 осколка, как у
                                //Шипа (у того burst стоит на конце once-анимации в animPlay,
                                //но «Звезда пустоты» гаснет о стену, а не по таймеру анимации).
                                //Прямое попадание в героя/волка осколков не даёт — снаряд
                                //поглощается без burst (иначе двойной урон в упор)
                                if (b.type === "bullet" && b.atacker && b.atacker.type === "enemy" &&
                                    b.atacker.stats.crushAttack && !b.crush) crushBurst(b)
                                releaseSprite(b.img)
                                despawn(b)
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
                        releaseSprite(b.img)
                        despawn(b)
                    }
                }
            }
        }
    }
}
function moveMagicBullet() {
        const ents = world.queries.gbullet && world.queries.gbullet.entities
        if (!ents) return
        const snap = ents.slice()
        for (let i = 0; i < snap.length; i++) {
            const b = DATA.bag[snap[i]]
            if (b && b.currentAnim && b.currentAnim.bullet && b.currentAnim.bullet === "all") {
                let rect = b.rect
                let bPos = rectPos(rect)
                //V68 (репорт юзера): самонаводящийся магический снаряд героя, выпущенный В
                //объект карты (цель — СПРАЙТ объекта из screenPic, DOM-узел), после разрушения
                //объекта оставался навсегда: цель отсоединена от DOM, но жива как ссылка —
                //снаряд вечно кружил на её последних координатах (destroyObjects снимает только
                //снаряд-инициатор). isConnected === false только у отрезанного от DOM узла;
                //у врагов/героя (обычные JS-объекты) поля нет — проверку не проходят
                if (b.target && b.target.type !== "corpse" && b.target.isConnected !== false) {
                    let rectE
                    b.target.img ? rectE = b.target.rect : rectE = b.target
                    if (bPos[0] < rectE.x.animVal.value) {
                        moveSprite(b.img, b.currentAnim.bulletSpeed, 0)
                        bPos = rectPos(rect)
                    }
                    if (bPos[0] > rectE.x.animVal.value) {
                        moveSprite(b.img, -b.currentAnim.bulletSpeed, 0)
                        bPos = rectPos(rect)
                    }
                    if (bPos[1] < rectE.y.animVal.value) {
                        moveSprite(b.img, 0, b.currentAnim.bulletSpeed)
                        bPos = rectPos(rect)
                    }
                    if (bPos[1] > rectE.y.animVal.value) {
                        moveSprite(b.img, 0, -b.currentAnim.bulletSpeed)
                    }
            } else {
                playEffect(b,data.effects[b.currentAnim.effect])
                releaseSprite(b.img)
                despawn(b)
            }
        }
    }
}
export {moveBullet,moveMagicBullet}