import { status } from "../scripts/start.js"
//V67: «Вечный сапфир» — копия ячеек пояса (спец-стат 5) источника из 1-й ячейки инвентаря
import { sapphireBelt } from "../scripts/relics.js"
import { svgArr,image } from "../scripts/svg.js"

let beltTemp = []
function beltCreate() {
    //V67: копия ячеек пояса работает как свои (итоговое число = свои + копия)
    let lengthBeltCell = status.info.beltCell + sapphireBelt()
    for (let i = 0; i < lengthBeltCell; i++) {
        beltTemp.push(image(svgArr[2],50 + i * 110,970,96,96,"./images/UI/panels/portBack.png",{"id":i+"B"}))
        !status.info.beltCellArr[i] && (status.info.beltCellArr[i] = 0)
        status.info.beltCellArr[i] && beltTemp.push(image(svgArr[2],50 + i * 110,970,96,96,"./images/consume/food/"+Math.round(status.info.beltCellArr[i]*20)+".png",{"id":i+"BT"}))
    }
}
function beltChange() {
    beltDel()
    beltCreate()
}
function beltDel() {
    let length = beltTemp.length
    for (let i = 0; i < length; i++) {
        beltTemp[i].remove()
    }
    beltTemp = []
}
export {beltCreate,beltChange}