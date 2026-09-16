import { status } from "../scripts/start.js"
import { checkCollision,playEffect } from "../scripts/damage.js"
import { objectValues } from "../scripts/del.js"
import { data } from "../scripts/data.js"

function enemySkills(enemy) {
    if(enemy.skills) {
        let lengthSkills = enemy.skills.length
        for (let i = 0; i < lengthSkills; i++) {
            switch (enemy.skills[i]) {
                case 0: mirror(enemy)
                    break
            }
        }
    }
}
function mirror(enemy) {
    let lengthBullet = objectValues.length
    for (let i = 0; i < lengthBullet; i++) {
        if (objectValues[i].type === "bullet" && objectValues[i].stats.range && objectValues[i].mirror === undefined && objectValues[i].target === enemy &&
        checkCollision(objectValues[i].rect.x.animVal.value,enemy.rect.x.animVal.value - 32,
                        objectValues[i].rect.width.animVal.value,enemy.rect.width.animVal.value + 64,
                        objectValues[i].rect.y.animVal.value,enemy.rect.y.animVal.value - 32,
                        objectValues[i].rect.height.animVal.value,enemy.rect.height.animVal.value + 64))
        {
            if(Math.trunc(Math.random() * 10) === 0) {
                objectValues[i].target = status.hero.obj
                objectValues[i].atacker = enemy
                playEffect(enemy,data.effects[6])
                if(objectValues[i].direction !== undefined) {
                    objectValues[i].direction === 0 ? objectValues[i].direction = 1 :
                    objectValues[i].direction === 1 ? objectValues[i].direction = 0 :
                    objectValues[i].direction === 2 ? objectValues[i].direction = 3 :
                    objectValues[i].direction === 3 ? objectValues[i].direction = 2 :false
                }
            }
            objectValues[i].mirror = 1
        }
    }
}
export {enemySkills}