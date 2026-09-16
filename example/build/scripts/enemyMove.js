// enemyMove.js — тонкая обёртка над машиной состояний врагов (enemyAI.js):
// тикает всех врагов/питомцев в камере + эмоции обнаружения.
import { objectValues } from "../scripts/del.js"
import { svgArr,rectPos } from "../scripts/svg.js"
import { emoFxTick, enemyTick } from "../scripts/enemyAI.js"
// V32: глобальное гашение следов рывка нетопыря (dashFx.js), один вызов за тик
import { dashGhostsTick } from "../scripts/dashFx.js"
// V34: снаряды «очарования» суккуба + обратный отсчёт эффекта (charmFx.js)
import { charmTick } from "../scripts/charmFx.js"
// V38: зоны «воя» Хаунда — мигание частиц + обратный отсчёт (howlFx.js)
import { howlTick } from "../scripts/howlFx.js"

function enemyMove() {
    emoFxTick()
    dashGhostsTick()
    charmTick()
    howlTick()
    //V16: viewBox камеры читаем ОДИН раз за тик (раньше — внутри цикла, на каждого врага),
    //позиции врагов — из кэша rectPos вместо animVal
    const vb = svgArr[0].viewBox.animVal
    let length = objectValues.length
    for (let i = 0; i < length; i++) {
        const o = objectValues[i]
        if (o.type !== "enemy" && o.type !== "pet") continue
        const pos = rectPos(o.rect)
        //V31: размер окна камеры из viewBox (зависит от зума, zoomFx.js), не литералы
        //V78: pet тикается и вне кадра — иначе отставший за экран питомец навсегда
        //замер бы на месте и не догнал бы героя; на врагов гейт не тронут
        if (o.type !== "pet" && (pos[0] < vb.x || pos[0] > vb.x + vb.width || pos[1] < vb.y || pos[1] > vb.y + vb.height)) continue
        enemyTick(o)
    }
}
export { enemyMove }
