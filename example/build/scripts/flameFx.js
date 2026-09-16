//V26: горение (stats.flame у врага). Попадание вражеской атаки по герою накладывает
//эффект: каждый следующий удар ГЕРОЯ обжигает его самого на flame ХП — плоский урон
//напрямую в ХП (как у ловушек/яда), без брони/уклонения/блока. Спрайт
//./images/effects/flame.png всё время действия висит НАД спрайтом героя.
//Повторное попадание flame-врага СКЛАДЫВАЕТ время: остаток += FLAME_TICKS.
//Счётчик живёт на status.info.burning — это поле уже учитывает существующий в attack.js
//дебаф-съём «убрать 1 дебаф при атаке» (skillTree, removeDebuff), поэтому атаки героя
//с этим скиллом дополнительно гасят горение. Сила эффекта — status.info.burningPower,
//= stats.flame последнего наложившего врага. Оба поля пересоздаются при новом забеге.
import { status } from "../scripts/start.js"
import { T } from "../scripts/localization.js"
import { svgArr, image, releaseSprite, spritePos, rectPos } from "../scripts/svg.js"
import { floatText } from "../scripts/floatText.js"
import { changeHP, checkFood } from "../scripts/takeDamage.js"
import { endGame } from "../scripts/endGame.js"
import { journalAdd, J_FIRE } from "../scripts/journal.js"

const FLAME_SRC = "./images/effects/flame.png"
const FLAME_SIZE = 32 //flame.png — лист 32×32, одиночный кадр
//длительность одного наложения: 2 секунды ≈ 124 тика при фикс. шаге 16мс (~62.5 тик/с).
//V69: было 62 тика (1с) — ожог на игроке теперь висит на 1 секунду дольше (решение пользователя)
const FLAME_TICKS = 124

let flameImg = null

//наложение горения (damageHero: коллизия пули атакующего со stats.flame и героем)
function applyFlame(power) {
    //V37 журнал: новое горение (продление/складывание не пишем)
    !(status.info.burning > 0) && journalAdd(T("journ.burning"), J_FIRE)
    //V46 аудит доп. статов: «Выносливость» (2×countLog%) сокращает длительность горения —
    //повторные наложения складывают уже укороченные порции, как и яд в checkPoison
    let ticks = Math.max(1, FLAME_TICKS - Math.trunc(FLAME_TICKS * parseInt(status.info.stats[2].dops[2].value2.slice(0,-1))/100))
    status.info.burning = (status.info.burning || 0) + ticks
    status.info.burningPower = power || 2
}

//тик эффекта (gameLoop): обратный отсчёт + удержание спрайта над головой героя
function flameTick() {
    let left = status.info ? (status.info.burning || 0) : 0
    if (left <= 0 || !status.hero.obj || status.hero.obj.type !== "hero") {
        hideFlame()
        return
    }
    status.info.burning = left - 1
    //сцена пересоздавалась (новый этаж) — старый DOM-узел мёртв, создаём заново
    if (flameImg && !flameImg.isConnected) flameImg = null
    if (!flameImg) {
        flameImg = image(svgArr[1], 0, 0, FLAME_SIZE, FLAME_SIZE, FLAME_SRC, {})
    }
    const r = status.hero.obj.rect
    const pos = rectPos(r)
    //центр по X героя, низ огня слегка перекрывает макушку («висит над спрайтом»)
    spritePos(flameImg, pos[0] + r._w / 2 - FLAME_SIZE / 2, pos[1] - FLAME_SIZE + 6)
    //иконка статуса — поверх игровых спрайтов; перезакладываем только если затеснили
    if (svgArr[1].lastElementChild !== flameImg) svgArr[1].append(flameImg)
    if (status.info.burning <= 0) hideFlame()
}

function hideFlame() {
    if (flameImg && flameImg.isConnected) releaseSprite(flameImg)
    flameImg = null
}

//урон герою за удар под горением (attack(): момент фактической атаки по цели)
function flameOnHeroAttack() {
    if (!(status.info && status.info.burning > 0)) return
    if (!status.hero.obj || status.hero.obj.type !== "hero") return
    const damage = status.info.burningPower || 2
    const pos = rectPos(status.hero.obj.rect)
    status.info.hp -= damage
    status.info.hp <= 0 && (status.info.hp = 0)
    floatText(pos[0] + Math.trunc(Math.random() * 32), pos[1] + 8, damage, "#FF8800", "12px", "none")
    changeHP(document.getElementById("hpBarI"), document.getElementById("hpText"), "hp")
    checkFood()
    status.info.hp <= 0 && endGame()
}

export { applyFlame, flameTick, flameOnHeroAttack }
