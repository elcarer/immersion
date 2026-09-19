import { svgArr, rect, rectPos } from "../scripts/svg.js"

//V27b: ХП-бар врага при получении урона от героя. Урок первой версии: расчёт доли
//верен (round(inner×hp/classMax)), но свободный хвост полоски сливался с тёмным
//фоном — при мелких долях урона бар читался «полностью полным». Теперь израсходо-
//ванная часть выделена КОНТРАСТНЫМ тёмно-багровым хвостом (#5a1414) и бар крупнее.
//Структура: bg-плашка с рамкой → зелёная полоска слева (шириной round(INNER×ratio))
//→ тёмно-багровый хвост до правого края (= INNER − зелёный, 0 при полном ХП).
//Появляется НАД врагом, живёт LIFETIME тиков (~1с при 16мс/тик), повторный удар
//обновляет зелёный/хвост/цвет и СБРАСЫВАЕТ отсчёт. Позиция каждый тик из кэша
//rectPos (_rx/_ry поддерживаются moveSprite/spritePos) — бар «прилипает» к врагу.
//Тики идут только пока игра жива (вызов из gameLoop рядом с flameTick).
const LIFETIME = 62
const BAR_W = 52
const BAR_H = 8
const OFFSET_Y = 10
const INNER_W = BAR_W - 2 //50 — полезная ширина внутри 1px рамки
const INNER_H = BAR_H - 2 //6
//цвет «утраченного» ХП: тёмно-багровый — намеренно контрастен и к полу, и к зелёному
const TAIL_COLOR = "#5a1414"

let list = []

//цвет зелёной части от доли оставшегося ХП — палитра проекта (#33FF66 леч./#FFCC00 эксп./#FF3333 урон)
function fillColor(ratio) {
    return ratio > 0.5 ? "#33FF66" : (ratio > 0.25 ? "#FFCC00" : "#FF3333")
}

function showEnemyHpBar(enemy, beforeHp) {
    //V104: бар показывает и Волку-союзнику (квест, type "pet" с маркером wolfAlly)
    if (!enemy || (enemy.type !== "enemy" && !enemy.wolfAlly)) return
    if (enemy.stats.hp <= 0) return //добитого не подсвечиваем
    //V27b: максимум — ФАКТИЧЕСКИЙ запас ХП этого спавна. Вызывающий код (damage.js)
    //передаёт ХП ДО вычета удара (урон уже вычтен из stats.hp к моменту вызова):
    //спавн в главах 2/3 умножает hp (openRoom/encounters/spiderBossFight:
    //meta.page>1/>2 → ×2/×4 от data.js), поэтому знаменателем НЕ может быть
    //class.stats.hp («полоска застывала почти полной» много ударов). Монотонный
    //максимум корректен и при лечении/подъёме мумии.
    if (beforeHp === undefined) beforeHp = enemy.stats.hp + 1
    if (!enemy._hpBarMax || beforeHp > enemy._hpBarMax) enemy._hpBarMax = beforeHp
    let rec = null
    for (let i = 0; i < list.length; i++) {
        if (list[i].enemy === enemy) { rec = list[i]; break }
    }
    if (!rec) {
        let bg = rect(svgArr[1], 0, 0, BAR_W, BAR_H, "black", "1px", "rgb(30, 22, 18)", {"id":"enemyHpBg", "rx":"2px", "opacity":"0.9"})
        let fill = rect(svgArr[1], 0, 0, INNER_W, INNER_H, "none", "1px", "#33FF66", {"id":"enemyHpFill"})
        let tail = rect(svgArr[1], 0, 0, INNER_W, INNER_H, "none", "1px", TAIL_COLOR, {"id":"enemyHpTail"})
        rec = {"enemy":enemy, "bg":bg, "fill":fill, "tail":tail, "left":LIFETIME, "green":INNER_W}
        list.push(rec)
    } else {
        rec.left = LIFETIME
    }
    let max = enemy._hpBarMax
    let ratio = enemy.stats.hp / max
    ratio < 0 && (ratio = 0)
    ratio > 1 && (ratio = 1)
    let green = Math.round(INNER_W * ratio)
    rec.green = green
    rec.fill.setAttribute("width", green)
    rec.fill.setAttribute("fill", fillColor(ratio))
    rec.tail.setAttribute("width", INNER_W - green)
    placeRec(rec)
}
//позиция НАД врагом: горизонтально по центру окна кадра, сверху с небольшим отступом;
//хвост встраивается вплотную справа от зелёной части
function placeRec(rec) {
    const r = rec.enemy.rect
    if (!r) return
    const pos = rectPos(r)
    const w = r._w !== undefined && r._w !== null ? r._w : r.width.animVal.value
    const x = Math.round(pos[0] + w / 2 - BAR_W / 2)
    const y = Math.round(pos[1] - OFFSET_Y)
    rec.bg.setAttribute("x", x)
    rec.bg.setAttribute("y", y)
    rec.fill.setAttribute("x", x + 1)
    rec.fill.setAttribute("y", y + 1)
    rec.tail.setAttribute("x", x + 1 + rec.green)
    rec.tail.setAttribute("y", y + 1)
}
//вызов из gameLoop раз в тик: отсчёт жизни бара + привязка к позиции врага
function enemyHpBarTick() {
    for (let i = list.length - 1; i >= 0; i--) {
        let rec = list[i]
        rec.left--
        const e = rec.enemy
        //враг умер/стал трупом/узлы стёрты сменой сцены — убрать немедленно
        if (rec.left <= 0 || e.type !== "enemy" || e.stats.hp <= 0 || !rec.bg.isConnected) {
            rec.bg.remove()
            rec.fill.remove()
            rec.tail.remove()
            list.splice(i, 1)
            continue
        }
        placeRec(rec)
    }
}
export { showEnemyHpBar, enemyHpBarTick }
