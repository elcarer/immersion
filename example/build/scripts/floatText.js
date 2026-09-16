import { svgArr,text } from "../scripts/svg.js"

let floattext = []
//V10: пул текстовых узлов — не создаём/удаляем SVG-текст на каждое число урона
let pool = []
const MAX_FLOATS = 50

function floatText(x,y,textValue,color="white",size="24px",stroke="none") {//,textshadow="0px 0px 1px black, 0 0 1em black") {
    //лимит активных цифр: при толпе врагов не плодим узлы и не проседаем
    if (floattext.length >= MAX_FLOATS) return
    let el = pool.pop()
    if (el) {
        el.setAttribute("x", x)
        el.setAttribute("y", y)
        el.setAttribute("stroke", stroke)
        el.setAttribute("fill", color)
        el.setAttribute("font-size", size)
        el.textContent = textValue
        svgArr[1].append(el)
    } else {
        el = text(svgArr[1],x,y,"50pt","50pt",stroke,"3px",color,textValue,{"id":"floatText","size":size,"font":"baseFont","anchor":"middle", })//"blur":"filter: drop-shadow(0 0 20px rgba(255, 0, 0, 0.8))"
    }
    floattext.push({"time":30,"obj":el})
}
function timerFloat() {
    let lengthText = floattext.length
    for (let i = 0; i < lengthText; i++) {
        floattext[i].time--
        floattext[i].obj.setAttribute("y", floattext[i].obj.y.animVal[0].value - 1)
        if (parseInt(floattext[i].time) < 1) {
            let el = floattext[i].obj
            el.remove()
            pool.push(el)
            floattext.splice(i,1)
            i--
            lengthText--
        }
    }
}

export {floatText,timerFloat,floattext}
