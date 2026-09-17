import { status } from "../scripts/start.js"
//V67: «Вечный изумруд» (крит → макс. ХП) и «Вечный сапфир» (копия параметров 1-й ячейки)
import { hasRelic, sapphireDamage, sapphireStat, sapphireDop, diamondStatBonus } from "../scripts/relics.js"
//V75: «Кровавый пакт» (шкафчик) — максимум ХП ×0.8
import { blessMaxHpMult } from "../scripts/blessFx.js"

//итоговая база стата (группа i, строка j): очки героя + «Сапфир» + доп-статы предметов;
//«Вечный алмаз» (relic 6, E-16) прибавляет сверху +10% от этой базы (округление вверх) —
//все производные value2 и геймплейные формулы читают value1, так что бонус входит всюду
function statValue1(i,j) {
    let base = status.info.stats[i].value + sapphireStat(i) + addDopStatItems(i,j)
    return base + diamondStatBonus(base)
}

function countDopStats() {
    let damageMin = 0
    let length = status.inventory.doll.length
    for (let i = 0; i < length; i++) {
        status.inventory.doll[i] && status.inventory.doll[i].damage && (damageMin += status.inventory.doll[i].damage)
    }
    //V67 «Вечный сапфир»: копия урона источника из 1-й ячейки инвентаря (как своё)
    damageMin += sapphireDamage()
    let lengthStats = status.info.stats.length
    for (let i = 0; i < lengthStats; i++) {
        let lengthDopStats = status.info.stats[i].dops.length
        for (let j = 0; j < lengthDopStats; j++) {
            i===0&&j===0&&
            (status.info.stats[i].dops[j].value1 = statValue1(i,j))&&
            (status.info.stats[i].dops[j].value2 = damageMin+"-"+status.info.stats[i].dops[j].value1)
            i===0&&j===1&&
            (status.info.stats[i].dops[j].value1 = statValue1(i,j))&&
            (status.info.stats[i].dops[j].value2 = (countLog(Math.trunc(status.info.stats[i].dops[j].value1/2))+"%"))
            i===0&&j===2&&
            (status.info.stats[i].dops[j].value1 = statValue1(i,j))&&
            (status.info.stats[i].dops[j].value2 = (countLog(status.info.stats[i].dops[j].value1)+"%"))

            i===1&&j===0&&
            (status.info.stats[i].dops[j].value1 = statValue1(i,j))&&
            (status.info.stats[i].dops[j].value2 = (countLog(status.info.stats[i].dops[j].value1)+"%"))
            i===1&&j===1&&
            (status.info.stats[i].dops[j].value1 = statValue1(i,j))&&
            (status.info.stats[i].dops[j].value2 = (100+2*countLog(status.info.stats[i].dops[j].value1)+"%"))
            i===1&&j===2&&
            (status.info.stats[i].dops[j].value1 = statValue1(i,j))&&
            (status.info.stats[i].dops[j].value2 = (countLog(Math.trunc(status.info.stats[i].dops[j].value1/2)))+"%")

            i===2&&j===0&&
            (status.info.stats[i].dops[j].value1 = statValue1(i,j))&&
            //V67 «Вечный изумруд»: криты героя отключены (damage.js), ВЕСЬ шанс крита (N%) и
            //вся мощь крита (включая базу 100%) уходят в макс. ХП — решение пользователя.
            //V75 «Кровавый пакт» (шкафчик): итог умножается на 0.8 — снижается именно МАКСИМУМ
            (status.info.stats[i].dops[j].value2 = (Math.trunc((10+status.meta.dopHP+5*status.info.stats[i].dops[j].value1+emeraldHpBonus())*blessMaxHpMult())+"x"))
            i===2&&j===1&&
            (status.info.stats[i].dops[j].value1 = statValue1(i,j))&&
            (status.info.stats[i].dops[j].value2 = (countLog(status.info.stats[i].dops[j].value1)+"%"))
            i===2&&j===2&&
            (status.info.stats[i].dops[j].value1 = statValue1(i,j))&&
            (status.info.stats[i].dops[j].value2 = ((countLog(2*status.info.stats[i].dops[j].value1))+"%"))

            i===3&&j===0&&
            (status.info.stats[i].dops[j].value1 = statValue1(i,j))&&
            (status.info.stats[i].dops[j].value2 = (countLog(status.info.stats[i].dops[j].value1)+"%"))
            i===3&&j===1&&
            (status.info.stats[i].dops[j].value1 = statValue1(i,j))&&
            (status.info.stats[i].dops[j].value2 = (countLog(status.info.stats[i].dops[j].value1)+"%"))
            i===3&&j===2&&
            (status.info.stats[i].dops[j].value1 = statValue1(i,j))&&
            (status.info.stats[i].dops[j].value2 = (countLog(Math.trunc(status.info.stats[i].dops[j].value1/2)))+"%")

            i===4&&j===0&&
            (status.info.stats[i].dops[j].value1 = statValue1(i,j))&&
            (status.info.stats[i].dops[j].value2 = "x-"+status.info.stats[i].dops[j].value1)
            i===4&&j===1&&
            (status.info.stats[i].dops[j].value1 = statValue1(i,j))&&
            (status.info.stats[i].dops[j].value2 = (countLog(Math.trunc(status.info.stats[i].dops[j].value1/3))+"%"))
            i===4&&j===2&&
            (status.info.stats[i].dops[j].value1 = statValue1(i,j))&&
            (status.info.stats[i].dops[j].value2 = (countLog(status.info.stats[i].dops[j].value1)+"%"))
        }
    }
}
function countLog(i) {
        return (Math.trunc(((1 + 40/i)**(i/40) - 1) / (Math.exp(1) - 1) * 100))
}
//V67 «Вечный изумруд» (relic 0): прибавка к макс. ХП — полные итоговые проценты крита:
//шанс крита (countLog от value1) + мощь крита (100 + 2·countLog от value1), формулы те же,
//что выводятся в скобках куклы (stats[1].dops[0/1]); к моменту расчёта ХП (группа 2)
//группа 1 уже посчитана в этом же проходе. Бонус считается ОДИН раз (надетых изумрудов
//может быть сколько угодно, но крит-статы у героя одни)
function emeraldHpBonus() {
    if (!hasRelic(0)) return 0
    return countLog(status.info.stats[1].dops[0].value1) + (100 + 2 * countLog(status.info.stats[1].dops[1].value1))
}
//копия стата «Вечного сапфира» встроена в формулы выше (value + sapphireStat(i));
//копия спец-статов 5/6 живёт в belt.js/takeDamage.js
function addDopStatItems(i,j) {
    let dopStat = i*3+j
    let add = 0
    let lengthInv = status.inventory.doll.length
    for (let i = 0; i < lengthInv; i++) {
        if (status.inventory.doll[i]&&status.inventory.doll[i].dopType === dopStat) {
            add += status.inventory.doll[i].dop
        }
    }
    //V67 «Вечный сапфир»: копия доп. стата источника
    add += sapphireDop(dopStat)
    return add
}
export {countDopStats}