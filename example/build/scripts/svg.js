// ============================================================================
// svg.js — ФАСАД контракта рендера над pixiBackend (миграция M4, 2026-09-16)
// ============================================================================
// Игра перенесена с SVG на PixiJS (ядро zero_engine). Все экспорты СОХРАНЕНЫ 1:1 —
// игровые модули не меняют ни импортов, ни логики отрисовки. Прежняя SVG-реализация
// (document.createElementNS + clipPath-окна) целиком ушла в pixiBackend.js:
// шим-элементы дают DOM-поднабор (setAttribute/animVal/clipRect/DOM-порядок),
// анимированные спрайты — текстуры-кадры, слои — контейнеры камеры.
// Контракт позиционирования НЕ изменился: двигать спрайты только через
// moveSprite/spritePos; rect — логическая позиция; img.x несёт кадровое смещение.
import * as backend from "./pixiBackend.js"

// windowSize переехал в pixiBackend (миграция): раньше импортировался из index.js —
// убран цикл index→svg→index, обязательный для top-level await в точке входа
export { windowSize } from "./pixiBackend.js"

let svgArr = []

function svg(num) {
    svgArr = backend.createLayers(num)
    //V16: курсор задаём один раз здесь (и в keydown/keyup) — mousemove его не трогает
    document.body.style.cursor = 'url("./images/UI/cur.png"), auto'
}

function circle(place,cx,cy,r,stroke,strokeWidth,fill,obj={}) {
    return backend.createCircle(place,cx,cy,r,stroke,strokeWidth,fill,obj)
}
function rect(place,x,y,width,height,stroke,strokeWidth,fill,obj={}) {
    return backend.createRect(place,x,y,width,height,stroke,strokeWidth,fill,obj)
}
function text(place,x,y,width,height,stroke,strokeWidth,fill,textContent,obj={"size":24,"font":"baseFont2"}) {
    return backend.createTextEl(place,x,y,width,height,stroke,strokeWidth,fill,textContent,obj)
}
function textHtml(place,x,y,width,height,stroke,strokeWidth,fill,textContent,obj={"size":24,"font":"baseFont2"}) {
    return backend.createTextHtml(place,x,y,width,height,stroke,strokeWidth,fill,textContent,obj)
}
function image(place,x,y,w,h,src,obj={}) {
    if (obj.times) {
        // Анимированный спрайт — пул узлов; позиционирование АБСОЛЮТНОЕ:
        // img.x = rect.x − frameW*currentStill (кадровое смещение в _shift),
        // rect (clipRect) — мировая позиция для логики. Контракт прежний.
        const img = backend.acquirePooled(place,w,h,src,obj)
        const xShift = obj.frame ? (w/parseInt(obj.times))*(obj.frame) : 0
        img._shift = xShift
        img.setAttribute('x', x - xShift)
        img.setAttribute('y', y)
        obj.id !== undefined ? img.setAttribute("id", obj.id+"I") : img.setAttribute("id", "")
        obj.borderColor&&(img.style.outline = "2px solid "+obj.borderColor)
        img.setAttribute("pointer-events", "none")
        obj.opacity!==undefined?img.setAttribute("opacity", obj.opacity):img.removeAttribute("opacity")
        obj.blur&&blur(img,obj.blur)
        backend.spritePos(img, x, y)
        return img
    }
    return backend.createImage(place,x,y,w,h,src,obj)
}
function path(place,obj,fill='rgba(0, 0, 0, 0.65)') {
    return backend.createPath(place,obj,fill)
}
function blur(image,value) {
    image.setAttribute("style", (image.getAttribute('style')||'')+";"+value)
}
function spritePos(img, x, y) { backend.spritePos(img, x, y) }
function moveSprite(img, dx, dy) { backend.moveSprite(img, dx, dy) }
function releaseSprite(img) { backend.releaseSprite(img) }
function rectPos(r) { return backend.rectPos(r) }
function getCTM() { return backend.getCTMExport() }
function gamepadDragStart (x,y) { return backend.dragState().startAt(x,y) }
function gamepadDragMove (x,y) { backend.dragState().move(x,y) }
function gamepadDragEnd () { backend.dragState().end() }
function isDragging () { return backend.dragState().isDragging() }

export {svg,svgArr,circle,rect,text,image,textHtml,path,gamepadDragStart,gamepadDragMove,gamepadDragEnd,isDragging,spritePos,moveSprite,releaseSprite,rectPos,getCTM}
