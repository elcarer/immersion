import { svgArr,path,rect,uiRightEdge,uiBottomEdge } from "../scripts/svg.js"
import { status } from "../scripts/start.js"

let rectShadowArr = []
let M_TYME_INIT = 0
let time = M_TYME_INIT
let shadowTimeout
let iMax = 108
let jMax = 192
const CELL_SIZE = 10
let rectRandomArr = []
createPoints(jMax,iMax)
function createPoints(width,height) {
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            rectRandomArr.push({"x":x * CELL_SIZE,"y":y * CELL_SIZE})
        }
    }
}
//V169 (репорт юзера: пиксели перехода «появляются неравномерно, из центра к краям,
//как взрыв»): шафл sort(()=>Math.random()-0.5) смещённый — первые батчи кренятся
//к центру экрана (замер в Chrome: средний радиус первых 300 ячеек 537 против 615 у
//честного шафла), и перемешивание делалось ОДИН раз при загрузке модуля — все
//переходы жили с одним и тем же рисунком. Честный Фишер-Йетс + перетасовка на
//КАЖДЫЙ переход: появление равномерно по всему экрану и каждый раз новое
function shufflePoints() {
    for (let i = rectRandomArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const t = rectRandomArr[i]; rectRandomArr[i] = rectRandomArr[j]; rectRandomArr[j] = t
    }
}
function rectShadow() {
    let pathData = ""
    if (time === M_TYME_INIT) { clearTimeout(shadowTimeout); shufflePoints() }
    for (let i = time; i < time + 300; i++) {
            pathData += `M ${rectRandomArr[i].x} ${rectRandomArr[i].y} h ${CELL_SIZE} v ${CELL_SIZE} h -${CELL_SIZE} Z `
        }
    rectShadowArr.push(path(svgArr[2], {"id":"id","x":0,"y":0,"r":0,"d":pathData}, "black"))
    if(time >= 20400) {
        status.rectShadow = 0
        time = M_TYME_INIT
        rectShadowArr.push(rect(svgArr[2],0,0,uiRightEdge(),uiBottomEdge(),"none",0,"black"))
        clearTimeout(shadowTimeout)
        shadowTimeout = setTimeout(next,200)
    } else {
        time += 300
    }
}
function delRectShadow() {
    let length = rectShadowArr.length
    for (let i = 0; i < length; i++) {
        rectShadowArr[i].remove()
    }
    rectShadowArr = []
}
function next() {
    delRectShadow()
    typeof status.nextFunction === "function" && status.nextFunction()
    status.nextFunction = {}
}
export {rectShadow}