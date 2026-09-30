import { status } from "../scripts/start.js"
import { rect,uiRightEdge,uiBottomEdge } from "../scripts/svg.js"
import { mapRender } from "../scripts/mapRender.js"
import { musicDuck } from "../scripts/sound.js"

let mapTemp = []
function map(data,num,layer) {
    mapDel()
    status.move = 0
    status.pause = 1
    musicDuck(1)
    //E-13 (репорт юзера): подложка — на ВЕСЬ экран, а не дизайн 1920×1080: при окне
    //шире 16:9 миникарта (прибита к правому краю экрана) частично торчала из-под
    //чёрного квадрата и «резалась» им
    mapTemp.push(rect(layer,0,0,uiRightEdge(),uiBottomEdge(),"black","1px","black"))
    //V163: масштаб — по ИСХОДНОМУ размеру этажа (baseW/baseH, штампует newGame): комнаты,
    //порождённые порталами после генерации (арена/загадка/напёрстки/конь), растят scene.h,
    //и раньше карта при их создании сжималась. С базовой высотой «острова» рендерятся
    //ниже нижней кромки панели (их y ≥ исходного h) — невидимы, карту не сжимают;
    //карта показывает только исходные комнаты этажа. Старые сейвы — fallback на текущие w/h
    let tileX = 1920/(data.scenes[num].baseW || data.scenes[num].w)
    let tileY = 1080/(data.scenes[num].baseH || data.scenes[num].h)
    //V62: содержимое карты (комнаты и коридоры прямоугольниками, объекты и герой
    //спрайтами) строит mapRender.js. Раньше здесь звались createRoom/createCorridor
    //в map-режиме — тот же потайловый рендер, что у основного поля: тысячи <image>
    //и квадратичный перебор стен на каждый тайл — карта открывалась с задержкой.
    //Заглушка data.heroes больше не пишется — данные уровня не мутируются.
    mapTemp.push(...mapRender(data.scenes[num],tileX,tileY,layer))
    status.panels = 2
}
function mapDel(nomusic=0) {
    let range = mapTemp.length
    for (let i = 0; i < range; i++) {
        mapTemp[i].remove()
    }
    mapTemp = []
    status.move = 1
    status.panels = 0
    status.pause = 0
    nomusic === 0 && musicDuck(0)
}
export {map,mapDel,mapTemp}
