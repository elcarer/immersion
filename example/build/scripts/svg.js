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
// R3: нативный спрайт мира (тайлы/стены/объекты/дроп) — PIXI.Sprite без шима.
// Контракт чтения тот же (x/y/width/height.animVal, href, getAttribute), запись —
// href/x/y/opacity/style/id; позиция ставится при создании и не переписывается
function worldImage(place,x,y,w,h,src,obj={}) {
    return backend.createWorldImage(place,x,y,w,h,src,obj)
}
// R3: поиск мирового узла по id-ключу («15OI»/«3RI») за O(1) — замена сканов
// screenPic.find(f => f && f.id === ...) в useObject/trapsFx/finPillars/blessFx/alchemy
function picById(key) {
    return backend.worldById(key)
}
// R4: нативная графика — один PIXI.Graphics для набора статичных фигур
// (панель карты: комнаты/коридоры/стены/двери). Фигуры рисует вызывающий
// через handle.node.rect(x,y,w,h).fill(color); remove() уничтожает Graphics
function nativeGraphics(place) {
    return backend.createNativeGraphics(place)
}
// R4: нативная полоса (ХП/опыт/босс/загрузка) — спрайт заливки + маска-Graphics;
// прогресс: handle.setBarProgress(colPx, "left"|"right") вместо clipPath-пересозданий
function worldBar(place,x,y,w,h,src,obj={}) {
    return backend.createWorldBar(place,x,y,w,h,src,obj)
}
// R4: нативный текст (PIXI.Text + текстовый DOM-поднабор) — floatText-пул и
// последующие панели; базлайн-семантика SVG сохранена (y = базлайн)
function nativeText(place,x,y,w,h,stroke,strokeWidth,fill,textContent,obj={}) {
    return backend.createNativeText(place,x,y,w,h,stroke,strokeWidth,fill,textContent,obj)
}
// R4.4: нативные примитивы панелей — замены shim-эмуляций, которые сносит R5:
// nativeGroup — слой прокрутки journal/library (контейнер + setClip-маска) вместо
// createElementNS("g") с clip-path; nativeHtml — текстовый блок от левого верхнего
// угла с переносом по словам вместо textHtml/foreignObject; nativeSector — сектор
// кулдауна (setSector(angle,clockwise)) вместо path()+clipPath; nativePoly — полигон
// с federated-событиями на node вместо createElementNS("polygon")
function nativeGroup(place,obj={}) {
    return backend.createNativeGroup(place,obj)
}
function nativeHtml(place,x,y,w,h,stroke,strokeWidth,fill,textContent,obj={}) {
    return backend.createNativeHtml(place,x,y,w,h,stroke,strokeWidth,fill,textContent,obj)
}
function nativeSector(place,cx,cy,r,clipW,obj={}) {
    return backend.createNativeSector(place,cx,cy,r,clipW,obj)
}
function nativePoly(place,points,fill,stroke,strokeWidth,obj={}) {
    return backend.createNativePoly(place,points,fill,stroke,strokeWidth,obj)
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

export {svg,svgArr,circle,rect,text,image,path,worldImage,worldBar,nativeText,nativeGroup,nativeHtml,nativeSector,nativePoly,picById,nativeGraphics,gamepadDragStart,gamepadDragMove,gamepadDragEnd,isDragging,spritePos,moveSprite,releaseSprite,rectPos,getCTM}
