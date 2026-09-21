// enemyMove.js — тонкая обёртка над машиной состояний врагов (enemyAI.js):
// тикает всех врагов/питомцев в камере + эмоции обнаружения.
import { objectValues } from "../scripts/del.js"
import { svgArr,rectPos } from "../scripts/svg.js"
import { emoFxTick, enemyTick } from "../scripts/enemyAI.js"
//V115: контекст игрока
import { setContext } from "../scripts/players.js"
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
    //E-3: враги/питомцы — из групп genemy/gpet (маркеры на спавне) со снимком на входе
    //(старая семантика «граница зафиксирована»); фильтры type сохранены 1:1 — игра мутирует
    //obj.type на месте (charm enemy→pet, смерть enemy→corpse), stale-члены группы отсеивает фильтр
    const vb = svgArr[0].viewBox.animVal
    const gE = world.queries.genemy && world.queries.genemy.entities
    if (gE) {
        const snap = gE.slice()
        for (let i = 0; i < snap.length; i++) {
            const o = DATA.bag[snap[i]]
            if (!o || (o.type !== "enemy" && o.type !== "pet")) continue
            const pos = rectPos(o.rect)
            //V31: размер окна камеры из viewBox (зависит от зума, zoomFx.js), не литералы
            //V78: pet тикается и вне кадра — иначе отставший за экран питомец навсегда
            //замер бы на месте и не догнал бы героя; у врагов гейт остался (условие 1:1:
            //очарованный враг (type стал "pet", сидит в genemy) вне кадра тоже тикается)
            //E-18: боссы — тоже вне гейта: погоня после урона магией сквозь стены живёт
            //и за экраном (иначе раненый из-за кадра босс «стоял» до подхода героя)
            const offscreen = pos[0] < vb.x || pos[0] > vb.x + vb.width || pos[1] < vb.y || pos[1] > vb.y + vb.height
            if (offscreen && o.type !== "pet" && !(o.class && o.class.boss === 1)) continue
            enemyTick(o)
        }
    }
    const gP = world.queries.gpet && world.queries.gpet.entities
    if (gP) {
        const snap = gP.slice()
        for (let i = 0; i < snap.length; i++) {
            const o = DATA.bag[snap[i]]
            //V78: pet тикается и вне кадра — иначе отставший за экран питомец навсегда
            //замер бы на месте и не догнал бы героя; у врагов гейт остался выше
            if (!o || o.type !== "pet") continue
            enemyTick(o)
        }
    }
    //V115: enemyTick ставил контекст цели врага — возвращаем игроку 1
    setContext(status.players[0])
}
export { enemyMove }
