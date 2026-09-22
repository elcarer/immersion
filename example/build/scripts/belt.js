import { status } from "../scripts/start.js"
//V67: «Вечный сапфир» — копия ячеек пояса (спец-стат 5) источника из 1-й ячейки инвентаря
import { sapphireBelt } from "../scripts/relics.js"
import { svgArr,image } from "../scripts/svg.js"

let beltTemp = []
function beltCreate() {
    //V131 (репорт юзера: «ячейки пояса одного игрока перекрывают ячейки другого»):
    //пояс пер-игроковой — колонка ячеек у СВОЕГО края экрана: игрок 1 слева (x=40),
    //игрок 2 справа (x=1784); по вертикали НАД полосками ХП/опыта (их фон с y=987)
    //и ПОД иконками активных способностей (нижний ряд y=806..902 у центров блоков —
    //края экрана они не занимают). Раньше колонка была ОДНА из status.info (контекста):
    //любая перерисовка пояса любого игрока клала обе колонки в одни координаты
    for (let pi = 0; pi < status.players.length; pi++) {
        const info = status.players[pi].info
        const x = pi === 0 ? 40 : 1784
        //V67: копия ячеек пояса работает как свои (итоговое число = свои + копия)
        let lengthBeltCell = info.beltCell + sapphireBelt(pi)
        for (let i = 0; i < lengthBeltCell; i++) {
            const y = 875 - i * 110
            beltTemp.push(image(svgArr[2],x,y,96,96,"./images/UI/panels/portBack.png",{"id":pi+"_"+i+"B"}))
            !info.beltCellArr[i] && (info.beltCellArr[i] = 0)
            //спрайты еды на диске — 1..14: экстремальный билд с 10+ «живучестями» дал бы 15+,
            //клампим на последний существующий
            info.beltCellArr[i] && beltTemp.push(image(svgArr[2],x,y,96,96,"./images/consume/food/"+Math.min(14,Math.round(info.beltCellArr[i]*20))+".png",{"id":pi+"_"+i+"BT"}))
        }
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
