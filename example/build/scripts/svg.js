import { windowSize } from "../index.js"
import { tipDel } from "../scripts/tip.js"

let svgArr = []
let CTM
function svg(num) {

    for (let i = 0; i < num; i++) {
        let div = document.createElement('div')
        let divId = "board" + String(i)
        div.id = divId
        div.style.width = windowSize.wt+"px"
        div.style.height = windowSize.ht+"px"
        div.style.top = "0px"
        div.style.left = "0px"
        div.style.position = "absolute"
        div.style.zIndex = i
        i===num-1?div.style.pointerEvents = "none":false
        document.body.appendChild(div)
        let divT = document.getElementById(divId)
        let svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
        svg.setAttribute("width", "100%")
        svg.setAttribute("height", "100%")
        svg.setAttribute("viewBox", "0 0 1920 1080")
        svg.setAttribute("preserveAspectRatio", "xMidYMid meet")
        i===0?svg.setAttribute("style", "background:black"):false
        divT.appendChild(svg)
        svgArr.push(svg)
    }
    CTM = svgArr[2].getScreenCTM()
    updateImageRendering()
    //V16: курсор задаём один раз здесь (и в keydown/keyup) — раньше mousemove
    //перезаписывал body.style.cursor на КАЖДОЕ событие (стилевой пересчёт на каждый move)
    document.body.style.cursor = 'url("./images/UI/cur.png"), auto'
}
//V16: CTM UI-слоя меняется только при resize — кэш вместо getScreenCTM() на каждое
//событие mousemove (getScreenCTM форсирует пересчёт layout и был заметен в вводе)
function getCTM() {
    if (!CTM) CTM = svgArr[2].getScreenCTM()
    return CTM
}
//V15: pixelated ТОЛЬКО при целочисленном масштабе (1:1, 2:1, 1:2, …) — там он даёт
//чёткий пиксель-арт без артефактов. При дробном масштабе (уменьшенное окно)
//pixelated квантует пиксели неравномерно — на анимациях «дёргаются пиксели»;
//включаем обычное сглаживание. UI-слой (svgArr[2]) не трогаем — там текст/панели.
function updateImageRendering() {
    const scale = windowSize.wt / 1920
    const r = scale >= 1 ? scale : 1 / scale
    const pixelated = Math.abs(r - Math.round(r)) < 0.02
    svgArr.forEach((s, i) => {
        if (i < 2) s.style.imageRendering = pixelated ? "pixelated" : "auto"
    })
}

window.addEventListener('resize', () => {
    windowSize.wt = window.innerWidth
    windowSize.ht = window.innerHeight
    window.innerWidth >= window.innerHeight*16/9?
    windowSize.wt=window.innerHeight*16/9:windowSize.ht=window.innerWidth*9/16
    document.querySelectorAll('div').forEach(e => {
            e.style.width = windowSize.wt+"px"
            e.style.height = windowSize.ht+"px"
        })
    updateImageRendering()
    CTM = svgArr[2].getScreenCTM()})

function circle(place,cx,cy,r,stroke,strokeWidth,fill,obj={}) {
    let circle = document.createElementNS("http://www.w3.org/2000/svg", "circle")
    circle.setAttribute("cx", cx)
    circle.setAttribute("cy", cy)
    circle.setAttribute("r", r)
    circle.setAttribute("stroke", stroke)
    circle.setAttribute("stroke-width", strokeWidth)
    circle.setAttribute("fill", fill)
    obj.func||obj.hover?circle.setAttribute("pointer-events", "auto"):circle.setAttribute("pointer-events", "none")
    circle.onclick = obj.func
    place.appendChild(circle)
    return circle
}
function rect(place,x,y,width,height,stroke,strokeWidth,fill,obj={}) {
    let rect = document.createElementNS("http://www.w3.org/2000/svg", "rect")
    rect.setAttribute("id", obj.id)
    rect.setAttribute("x", x)
    rect.setAttribute("y", y)
    rect.setAttribute("width", width)
    rect.setAttribute("height", height)
    rect.setAttribute("stroke", stroke)
    rect.setAttribute("stroke-width", strokeWidth)
    rect.setAttribute("fill", fill)
    obj.func||obj.hover?rect.setAttribute("pointer-events", "auto"):rect.setAttribute("pointer-events", "none")
    obj.rx!==undefined?rect.setAttribute("rx", obj.rx):false
    obj.fillOpacity!==undefined?rect.setAttribute("fill-opacity", obj.fillOpacity):false
    obj.opacity!==undefined?rect.setAttribute("opacity", obj.opacity):false
    rect.onclick = obj.func
    place.appendChild(rect)
    return rect
}
function text(place,x,y,width,height,stroke,strokeWidth,fill,textContent,obj={"size":24,"font":"baseFont2"}) {
    let text = document.createElementNS("http://www.w3.org/2000/svg", "text")
    text.setAttribute("id", obj.id)
    text.setAttribute("x", x)
    text.setAttribute("y", y)
    text.setAttribute("width", width)
    text.setAttribute("height", height)
    text.setAttribute("stroke", stroke)
    text.setAttribute("stroke-width", strokeWidth)
    text.setAttribute("fill", fill)
    text.setAttribute("font-size", obj.size)
    text.setAttribute("text-anchor", obj.anchor?obj.anchor:"start")//"anchor":"middle"
    obj.funcShow||obj.func||obj.hover?text.setAttribute("pointer-events", "auto"):text.setAttribute("pointer-events", "none")
    obj.funcShow&&show(obj,text)
    text.setAttribute("style","user-select:none; paint-order: stroke;")
    text.setAttribute("font-family", obj.font+", sans-serif")
    text.textContent = textContent
    text.onclick = obj.func
    place.appendChild(text)
    obj.blur&&blur(text,obj.blur)
    if (obj.hover) {
        //V60: paint-order: stroke обязан сохраняться и в hover-стиле, и после mouseout —
        //раньше он терялся при перезаписи style, чёрная обводка текста начинала рисоваться
        //ПОВЕРХ заливки (номера страниц сундука «чернели» при наведении и не возвращались
        //обратно после первого mouseout). Свечение hover при этом работает как раньше
        text.onmouseover = () => {text.setAttribute("style", "user-select:none; paint-order: stroke;"+obj.hover)}
        text.onmouseout = () => {text.setAttribute("style", "user-select:none; paint-order: stroke;")}}
    return text
}
function textHtml(place,x,y,width,height,stroke,strokeWidth,fill,textContent,obj={"size":24,"font":"baseFont2"}) {
    let textHtml = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject")
    textHtml.setAttribute("id", obj.id)
    textHtml.setAttribute("x", x)
    textHtml.setAttribute("y", y)
    textHtml.setAttribute("width", width)
    textHtml.setAttribute("height", height)
    const div = document.createElement('div')
    div.setAttribute('style', 'color: '+fill+'; font-size: '+obj.size+'px; white-space: pre-wrap;');
    div.innerHTML = textContent
    textHtml.appendChild(div)
    obj.func||obj.hover?textHtml.setAttribute("pointer-events", "auto"):textHtml.setAttribute("pointer-events", "none")
    textHtml.setAttribute("style","user-select:none")
    textHtml.setAttribute("font-family", obj.font+", sans-serif")
    textHtml.onclick = obj.func
    place.appendChild(textHtml)
    obj.blur&&blur(textHtml,obj.blur)
    if (obj.hover) {
        textHtml.onmouseover = () => {textHtml.setAttribute("style", "user-select:none;"+obj.hover)}
        textHtml.onmouseout = () => {textHtml.setAttribute("style", "user-select:none;")}}
    return textHtml
}
function image(place,x,y,w,h,src,obj={}) {
    if (obj.times) {
        //V15: анимированный спрайт — пул узлов + кэш записей; позиционирование
        //АБСОЛЮТНОЕ (проверенная схема): img.x = rect.x − frameW*currentStill
        //(кадровое смещение включено в позицию), окно кадра — rect в МИРОВЫХ
        //координатах (userSpaceOnUse), он же img.clipRect для логики. style.transform
        //НЕ используем: в Chrome SVG-клип движется вместе с transform элемента —
        //окно уезжало от листа (спрайт прыгал на ширину кадра / исчезал).
        const img = acquirePooled(place,w,h,src,obj)
        const xShift = obj.frame ? (w/parseInt(obj.times))*(obj.frame) : 0
        img._shift = xShift
        img.setAttribute('x', x - xShift)
        img.setAttribute('y', y)
        obj.id !== undefined ? img.setAttribute("id", obj.id+"I") : img.setAttribute("id", "")
        obj.borderColor&&(img.style.outline = "2px solid "+obj.borderColor)
        img.setAttribute("pointer-events", "none")
        obj.opacity!==undefined?img.setAttribute("opacity", obj.opacity):img.removeAttribute("opacity")
        obj.blur&&blur(img,obj.blur)
        spritePos(img, x, y)
        return img
    }
    let image = document.createElementNS("http://www.w3.org/2000/svg", "image")
    image.setAttribute('x', x);
    image.setAttribute('y', y);
    image.setAttribute('width', w);
    image.setAttribute('height', h);
    image.setAttribute("href", src)
    obj.id !== undefined ? image.setAttribute("id", obj.id+"I") : image.setAttribute("id", "")
    obj.borderColor&&(image.style.outline = "2px solid "+obj.borderColor)
    obj.funcShow||obj.func||obj.funcDrag||obj.funcDbl||obj.hover?image.setAttribute("pointer-events", "auto"):image.setAttribute("pointer-events", "none")
    obj.func&&(image.onclick = obj.func)
    obj.funcDrag&&draggable(image,obj.funcDrag,obj.item)
    obj.funcDbl&&(image.addEventListener("dblclick", () => obj.funcDbl(obj.item)))
    obj.funcDbl&&(image.addEventListener("contextmenu", () => obj.funcDbl(obj.item)))
    obj.funcShow&&show(obj,image)
    obj.opacity!==undefined?image.setAttribute("opacity", obj.opacity):false
    obj.blur&&blur(image,obj.blur)
    if (obj.hoverOpa) {
        image.onmouseover = () => {image.setAttribute("opacity", "1")}
        image.onmouseout = () => {image.setAttribute("opacity", obj.hoverOpa)}}
    //V47: подсветка кнопочных спрайтов при наведении (как у кнопки мини-карты, minimapFx.js):
    //золотое двойное свечение drop-shadow. Прежний filter элемента сохраняется и
    //возвращается при уходе курсора — опция совместима с blur-подсветками
    //V82: glowNodes — доп. узлы (надписи кнопок главного меню), чей filter переключается
    //вместе со спрайтом. Массив захватывается ПО ССЫЛКЕ: надпись создаётся после кнопки
    //(текст обязан быть выше спрайта) и дописывается в слот позже — обработчики это видят
    if (obj.glow) {
        const glowNodes = obj.glowNodes || []
        const glowFilter = "drop-shadow(0 0 8px rgba(255,214,140,0.95)) drop-shadow(0 0 3px rgb(204,153,102))"
        image.addEventListener("mouseenter", () => {
            image._glowPrev = image.style.filter
            image.style.filter = glowFilter
            for (let i = 0; i < glowNodes.length; i++) {
                glowNodes[i]._glowPrev = glowNodes[i].style.filter
                glowNodes[i].style.filter = glowFilter
            }
        })
        image.addEventListener("mouseleave", () => {
            image.style.filter = image._glowPrev || ""
            for (let i = 0; i < glowNodes.length; i++) glowNodes[i].style.filter = glowNodes[i]._glowPrev || ""
        })
    }
    //V84: осветление заливки доп. узлов (надписи кнопок заставки) при наведении — БЕЗ
    //свечения: спрайт при этом может светиться через glow, а текст лишь становится чуть
    //светлее (hoverFill) и возвращает прежний цвет при уходе курсора. Слот заполняется
    //ПО ССЫЛКЕ после создания надписи — как у glowNodes
    if (obj.hoverFill && obj.hoverFillNodes) {
        const fillNodes = obj.hoverFillNodes
        image.addEventListener("mouseenter", () => {
            for (let i = 0; i < fillNodes.length; i++) {
                fillNodes[i]._fillPrev = fillNodes[i].getAttribute("fill")
                fillNodes[i].setAttribute("fill", obj.hoverFill)
            }
        })
        image.addEventListener("mouseleave", () => {
            for (let i = 0; i < fillNodes.length; i++) fillNodes[i].setAttribute("fill", fillNodes[i]._fillPrev || "")
        })
    }
    place.appendChild(image)
    return image
}
// ---------- V15: пул узлов анимированных спрайтов + кэш DOM-записей ----------
// Пул (img + defs/clipPath + worldRect) переиспользует узлы пуль/эффектов вместо
// создания/удаления (меньше GC-пауз). Ключ — src|w|h|times: разные спрайтшиты
// (обычные враги 128×51, крысы/пауки 128×32, боссы 256×64) живут в разных слотах.
const spritePool = new Map()
const POOL_CAP = 64
function poolKey(src,w,h,times){return src+"|"+w+"|"+h+"|"+times}
function acquirePooled(place,w,h,src,obj) {
    const key = poolKey(src,w,h,obj.times)
    const bucket = spritePool.get(key)
    let e = bucket && bucket.pop()
    if (!e) {
        e = {
            defs: document.createElementNS("http://www.w3.org/2000/svg","defs"),
            clipPath: document.createElementNS("http://www.w3.org/2000/svg","clipPath"),
            worldRect: document.createElementNS("http://www.w3.org/2000/svg","rect"),
            img: document.createElementNS("http://www.w3.org/2000/svg","image"),
        }
        //V15: окно кадра — rect в МИРОВЫХ координатах (clipPathUnits="userSpaceOnUse",
        //координаты родителя); лист «прокручивается» под окном через img.x. ВАЖНО:
        //у элемента с style.transform Chrome двигает и клип — transform для
        //анимированных спрайтов несовместим с таким окном (спрайты пропадали).
        e.clipPath.setAttribute("clipPathUnits","userSpaceOnUse")
        e.worldRect.setAttribute("fill","none")
        e.worldRect.setAttribute("stroke","none")
        e.clipPath.appendChild(e.worldRect)
        e.defs.appendChild(e.clipPath)
        e.key = key
    }
    e.clipPath.setAttribute("id", obj.id)
    e.img.setAttribute("clip-path","url(#"+obj.id+")")
    e.img.setAttribute("href", src)
    e.img.setAttribute("width", w)
    e.img.setAttribute("height", h)
    e.worldRect.setAttribute("width", w/parseInt(obj.times))
    e.worldRect.setAttribute("height", h)
    //V16: числовые размеры окна кадра в кэше — потиковые циклы (damage, animPlay)
    //читают их без animVal-чтений из DOM
    e.worldRect._w = w/parseInt(obj.times)
    e.worldRect._h = h
    e.img.style.filter = ""
    e.img.onclick = null
    e.img.clipRect = e.worldRect
    e.img._slot = e
    e.img._shift = 0
    e.img._fx = null
    e.img._lx = null
    e.img._ly = null
    e.worldRect._rx = null
    e.worldRect._ry = null
    place.appendChild(e.defs)
    place.appendChild(e.img)
    return e.img
}
//Позиция спрайта. У анимированных — rect (окно кадра/логика) + img.x С сохранением
//кадрового смещения img._shift (его пишет animPlay), у обычных — атрибуты x/y.
//Кэш последних записанных значений: при catch-up (до N тиков логики на один кадр)
//атрибут пишется не чаще, чем реально меняется — «один проход записей на кадр».
function spritePos(img, x, y) {
    if (!img) return
    if (img._slot) {
        const r = img.clipRect
        if (r._rx !== x) { r._rx = x; r.setAttribute("x", x) }
        if (r._ry !== y) { r._ry = y; r.setAttribute("y", y) }
        //абсолютная запись с сохранением смещения кадра — «заморозка на первом
        //кадре» из старых багрепортов здесь невозможна по построению
        const ix = x - (img._shift || 0)
        if (img._lx !== ix) { img._lx = ix; img.setAttribute("x", ix) }
        if (img._ly !== y) { img._ly = y; img.setAttribute("y", y) }
    } else {
        if (img._lx !== x) { img._lx = x; img.setAttribute("x", x) }
        if (img._ly !== y) { img._ly = y; img.setAttribute("y", y) }
    }
}
function moveSprite(img, dx, dy) {
    if (!img) return
    if (img._slot) {
        const r = img.clipRect
        spritePos(img, r.x.animVal.value + dx, r.y.animVal.value + dy)
    } else {
        spritePos(img, img.x.animVal.value + dx, img.y.animVal.value + dy)
    }
}
//V16: быстрое чтение позиции окна кадра (worldRect) БЕЗ animVal: кэш _rx/_ry
//поддерживается spritePos/moveSprite (все движения спрайтов идут только через них).
//Fallback — однократное чтение из DOM с записью в кэш (на случай rect, созданного вне пула).
function rectPos(r) {
    let x = r._rx
    if (x === null || x === undefined) {
        r._rx = r.x.animVal.value
        r._ry = r.y.animVal.value
    }
    return [r._rx, r._ry]
}
function releaseSprite(img) {
    if (!img) return
    const e = img._slot
    if (e) {
        img._slot = null
        //V15: worldRect живёт внутри clipPath (окно кадра) — удаляем только img;
        //defs/clipPath/rect остаются в слоте пула и переиспользуются целиком
        try { img.remove() } catch (err) {}
        const bucket = spritePool.get(e.key)
        if (bucket && bucket.length >= POOL_CAP) return //пул переполнен — узел уходит в GC
        bucket ? bucket.push(e) : spritePool.set(e.key, [e])
        return
    }
    try { img.remove() } catch (err) {}
}
function path(place,obj,fill='rgba(0, 0, 0, 0.65)') {
    let path = document.createElementNS("http://www.w3.org/2000/svg", "path")
    path.setAttribute('d', obj.d)
    path.setAttribute('fill', fill)
    path.setAttribute("id", obj.id+"P")
    path.setAttribute("x", obj.x)
    path.setAttribute("y", obj.y)
    path.setAttribute("r", obj.r)
    obj.clipPath&&createPath(place,obj,path)
    place.appendChild(path)
    return path
}
function blur(image,value) {
    image.setAttribute("style", image.getAttribute('style')+";"+value)
}
let selectedElement = null
let offset = { x: 0, y: 0 }
let dragData = null
let dragMap = new WeakMap()
function draggable (obj,funcDrag,item) {
    dragMap.set(obj,{funcDrag,item})
    // Функция для получения точных координат
    function getMousePosition(evt) {
      return {
        x: (evt.clientX - CTM.e) / CTM.a,
        y: (evt.clientY - CTM.f) / CTM.d
      }
    }
    obj.addEventListener('mousedown', (e) => {
      let pos = getMousePosition(e)
      beginDrag(e.target, funcDrag, item, pos.x, pos.y)
    })
    svgArr[2].addEventListener('mousemove', (e) => {
      if (selectedElement) {
        e.preventDefault()
        const coord = getMousePosition(e)
        moveDrag(coord.x, coord.y)
      }
    })
    obj.addEventListener('mouseup', (e) => {
        endDrag(e)
    })
}
function beginDrag (el,funcDrag,item,grabX,grabY) {
    el.setAttribute("style", 'filter: drop-shadow(0 0 6px rgba(255, 255, 204, 0.8))')
    selectedElement = el
    // Получаем текущее смещение (позиция «захвата» относительно левого верхнего угла)
    offset = { x: grabX - el.x.animVal.value, y: grabY - el.y.animVal.value }
    dragData = { funcDrag, item, origX: el.x.animVal.value, origY: el.y.animVal.value, lifted: false }
    tipDel()
    //ВАЖНО: НЕ перекладывать элемент в конец svgArr[2] здесь — re-append внутри mousedown
    //ломает генерацию click/dblclick в браузере (двойной клик по предмету не срабатывал).
    //Поднимаем элемент наверх только при ПЕРВОМ реальном сдвиге мыши (moveDrag).
}
function moveDrag (x,y) {
    if (selectedElement) {
        if (dragData && !dragData.lifted) {
            svgArr[2].append(selectedElement)
            dragData.lifted = true
        }
        selectedElement.setAttribute('x', x - offset.x)
        selectedElement.setAttribute('y', y - offset.y)
    }
}
function endDrag (e) {
    if (selectedElement) {
        let el = selectedElement
        let data = dragData
        selectedElement = null
        dragData = null
        el.setAttribute("style", 'none')
        data.funcDrag(e, data.item, data.origX, data.origY)
    }
}
function elementAtViewBox (x,y) {
    let ctm = svgArr[2].getScreenCTM()
    if(!ctm) return null
    let pt = svgArr[2].createSVGPoint()
    pt.x = x
    pt.y = y
    let sp = pt.matrixTransform(ctm)
    return document.elementFromPoint(sp.x, sp.y)
}
function gamepadDragStart (x,y) {
    let el = elementAtViewBox(x,y)
    if(el) {
        let data = dragMap.get(el)
        if(data) {
            beginDrag(el, data.funcDrag, data.item, x, y)
            return true
        }
    }
    return false
}
function gamepadDragMove (x,y) {
    moveDrag(x,y)
}
function gamepadDragEnd () {
    if(selectedElement) {
        endDrag({target: selectedElement})
    }
}
function isDragging () {
    return selectedElement !== null
}
function show (obj,image) {
    image.onmouseover = obj.funcShow
    image.onmouseout = obj.funcShowOut
}
function createPath(place,obj,pic) {
    let clipPath = document.createElementNS("http://www.w3.org/2000/svg", "clipPath")
    clipPath.setAttribute("id", obj.id+"PV")
    let rect = document.createElementNS("http://www.w3.org/2000/svg", "rect")
    rect.setAttribute("x", obj.x-obj.clipPath[0]/2)
    rect.setAttribute("y", obj.y-obj.clipPath[1]/2)
    rect.setAttribute("width", obj.clipPath[0])
    rect.setAttribute("height", obj.clipPath[1])
    clipPath.appendChild(rect)
    let defs = document.createElementNS("http://www.w3.org/2000/svg", "defs")
    place.appendChild(defs)
    defs.appendChild(clipPath)
    pic.setAttribute("clip-path", 'url(#'+obj.id+"PV"+')')
}
export {svg,svgArr,circle,rect,text,image,textHtml,path,gamepadDragStart,gamepadDragMove,gamepadDragEnd,isDragging,spritePos,moveSprite,releaseSprite,rectPos,getCTM}
