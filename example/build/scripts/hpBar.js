import { svgArr,image,worldBar,path,text } from "../scripts/svg.js"
import { screenPic,objectValues } from "../scripts/del.js"

let bossTemp
let bossHPMax
//V16: clipPath полосы босса создаётся ОДИН раз в hpBar() — раньше changeBossHP на
//каждый тик урона удалял старый clipPath и создавал новый (remove + 2 createElementNS
//+ 4 setAttribute + appendChild на каждый удар — постоянный DOM-мусор в бою с боссом).
let bossBarImg = null
let bossTextEl = null
//V90 (репорт юзера): после убийства босса полоса ХП оставалась в правом верхнем углу до
//конца этажа. Референсы трёх узлов полосы — для снятия в момент смерти владельца.
let bossBarEls = []
function hpBar(boss) {
    bossTemp = boss
    bossHPMax = boss.stats.hp
    let bg = image(svgArr[2],1458,30,407,64,"./images/UI/panels/hpBar.png")
    screenPic.push(bg)
    bossBarEls.push(bg)
    //R4: нативная полоса (спрайт + маска), clipPath не нужен; полоса сразу полная
    bossBarImg = worldBar(svgArr[2],1507,50,315,24,"./images/UI/panels/hpBarCol2.png",{"id":"hpBossBar"})
    bossBarImg.setBarProgress(315, "left")
    screenPic.push(bossBarImg)
    bossBarEls.push(bossBarImg)
    bossTextEl = text(svgArr[2],1664,69,"0pt","50pt","none","2px",`#FFCC66`,bossTemp.stats.hp+"/"+bossHPMax,{"id":"hpBossText","size":24,"font":"baseFont4","anchor":"middle"})
    screenPic.push(bossTextEl)
    bossBarEls.push(bossTextEl)
}
function changeBossHP(img,text) {
    if (!bossTemp || !bossBarImg || !bossTextEl) return
    bossTemp.stats.hp < 0 && (bossTemp.stats.hp = 0)
    let lengthCol = Math.trunc(bossTemp.stats.hp*315 / bossHPMax)
    let label = bossTemp.stats.hp+"/"+bossHPMax
    //V85: Медуза пустоты (id 26) — полоса ОБЩАЯ на всех осколков: сумма ХП живых
    //против суммы максимумов (суммарный запас при делении не меняется: maxHp осколка
    //= остаток ХП делившейся). bossTemp — спавн-объект босса, класс читается у него
    if (bossTemp.class && bossTemp.class.id === 26) {
        let hp = 0
        let max = 0
        for (let i = 0; i < objectValues.length; i++) {
            let o = objectValues[i]
            if (!o || o.type !== "enemy" || !o.class || o.class.id !== 26) continue
            o.stats.hp < 0 && (o.stats.hp = 0)
            hp += o.stats.hp
            max += o.stats.maxHp || 0
        }
        max > 0 && (lengthCol = Math.trunc(hp*315 / max))
        label = hp+"/"+max
    }
    //V16/R4: меняем только окно маски и текст — никакого пересоздания узлов
    bossBarImg.setBarProgress(lengthCol, "left")
    bossTextEl.textContent = label
}
//V90: снять полосу босса (смерть владельца). Узлы отцепляются от DOM; из screenPic их
//не извлекаем — del() на смене сцены вызывает remove() повторно безвредно (no-op).
//clipPath (id "hpBossBar") удаляем вместе с родительским defs-узлом, референсы гасим —
//guard в changeBossHP делает дальнейшие обновления пустыми.
function hideBossBar() {
    for (let i = 0; i < bossBarEls.length; i++) {
        bossBarEls[i].remove()
    }
    bossBarEls = []
    bossBarImg = null
    bossTextEl = null
    bossTemp = null
    bossHPMax = 0
}
//вызов из enemyAI.enemyDie: умер владелец полосы. Медуза пустоты (id 26) — полоса ОБЩАЯ
//на все осколки (тот же инвариант суммы, что в changeBossHP): снимается только с гибелью
//ПОСЛЕДНЕГО живого осколка; остальные боссы — по совпадению с боссом, на которого полоса
//заводилась в hpBar()
function bossBarOwnerDied(enemy) {
    if (!bossTemp) return
    if (bossTemp.class && bossTemp.class.id === 26) {
        for (let i = 0; i < objectValues.length; i++) {
            const o = objectValues[i]
            if (o && o.type === "enemy" && o.class && o.class.id === 26 && o.stats.hp > 0) return
        }
        hideBossBar()
        return
    }
    enemy === bossTemp && hideBossBar()
}
export {hpBar,changeBossHP,bossBarOwnerDied}
