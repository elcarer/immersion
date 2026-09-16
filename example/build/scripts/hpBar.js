import { svgArr,image,path,text } from "../scripts/svg.js"
import { screenPic,objectValues } from "../scripts/del.js"

let bossTemp
let bossHPMax
//V16: clipPath полосы босса создаётся ОДИН раз в hpBar() — раньше changeBossHP на
//каждый тик урона удалял старый clipPath и создавал новый (remove + 2 createElementNS
//+ 4 setAttribute + appendChild на каждый удар — постоянный DOM-мусор в бою с боссом).
let bossClipRect = null
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
    let barImg = image(svgArr[2],1507,50,315,24,"./images/UI/panels/hpBarCol2.png",{"id":"hpBossBar"})
    screenPic.push(barImg)
    bossBarEls.push(barImg)
    bossTextEl = text(svgArr[2],1664,69,"0pt","50pt","none","2px",`#FFCC66`,bossTemp.stats.hp+"/"+bossHPMax,{"id":"hpBossText","size":24,"font":"baseFont4","anchor":"middle"})
    screenPic.push(bossTextEl)
    bossBarEls.push(bossTextEl)
    //постоянный clipPath полосы (id "hpBossBar" — как было у пересоздаваемого узла)
    let oldClip = document.getElementById("hpBossBar")
    if (oldClip) oldClip.remove()
    let clipPath = document.createElementNS("http://www.w3.org/2000/svg", "clipPath")
    clipPath.setAttribute("id", "hpBossBar")
    bossClipRect = document.createElementNS("http://www.w3.org/2000/svg", "rect")
    bossClipRect.setAttribute("x", 1507)
    bossClipRect.setAttribute("y", 50)
    bossClipRect.setAttribute("height", 24)
    //V17: ширина ОБЯЗАТЕЛЬНА при создании: rect без width = 0px обрезки — полоса
    //не отображалась до первого удара (её делал видимой только changeBossHP).
    bossClipRect.setAttribute("width", 315)
    clipPath.appendChild(bossClipRect)
    let defs = svgArr[2].querySelector('defs')
    if (!defs) {
        defs = document.createElementNS("http://www.w3.org/2000/svg", "defs")
        svgArr[2].appendChild(defs)
    }
    defs.appendChild(clipPath)
    barImg.setAttribute("clip-path", "url(#hpBossBar)")
}
function changeBossHP(img,text) {
    if (!bossTemp || !bossClipRect || !bossTextEl) return
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
    //V16: меняем только ширину rect'а и текст — никакого пересоздания узлов
    bossClipRect.setAttribute("width", lengthCol)
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
    bossClipRect && bossClipRect.parentNode && bossClipRect.parentNode.remove()
    bossClipRect = null
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
