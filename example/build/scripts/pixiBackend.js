// ============================================================================
// pixiBackend.js — рендер-бэкенд PixiJS с DOM-шим контрактом svg.js (M4)
// ============================================================================
// МИГРАЦИЯ MIGRATION (2026-09-16): игра уходит с SVG на PixiJS (ядро zero_engine,
// build/engine/). Все игровые модули общаются с рендером через узкий DOM-поднабор
// (setAttribute/getAttribute, x.animVal.value, clipRect, DOM-порядок слоёв) — этот
// файл реализует ЭТОТ контракт поверх Pixi-узлов, поэтому игровые файлы не меняются.
//
// Слои (бывшие svgArr):
//   [0] пол       → floorLayer (внутри worldContainer — двигается камерой)
//   [1] объекты   → objLayer   (внутри worldContainer)
//   [2] UI        → uiLayer    (вне камеры, viewBox всегда 0 0 1920 1080)
// Камера: viewBox-математика сохранена дословно — screen = (world − vb.x)·s;
// реализовано pivot=(vb.x, vb.y), scale=(windowSize.wt / vb.width).
//
// ECS (M5): каждый clipRect сущности несёт _ecs — позиции пишутся прямо в
// компоненты posX/posY (регистрация в ecsBridge.js), группы читает renderSync.
// ============================================================================

const SVG_NS = "http://www.w3.org/2000/svg"

let app = null
let worldContainer = null
let layerNodes = []        // [floorContainer, objContainer, uiContainer] (Pixi)
let layers = []            // ShimEl[3] (возвращаются из svg())
let windowSize = { wt: 1920, ht: 1080 }
let cameraVB = { x: 0, y: 0, width: 1920, height: 1080 }  // слои 0/1
const uiVB = { x: 0, y: 0, width: 1920, height: 1080 }
let uiCTM = null           // кэш getScreenCTM UI-слоя (инвалидация на resize)
let pixelatedNow = null    // текущий режим scaleMode текстур (null — не установлен)

const shimById = new Map()   // id → ShimEl (для document.getElementById)
// «кладбище» откреплённых remove()-шимов: освобождаем Pixi-узлы отложенно
// (пересоздаваемые пулами узлы успевают вернуться в строй до уничтожения)
const graveyard = []
// уничтожает ОДНО кладбищенское имя, если оно не было переиспользовано (gen не менялся).
// ВАЖНО: Text/HTML НИКОГДА не уничтожаем — игра переиспользует их своим пулом
// (floatText: remove() → pool → append), destroyed-узел при переподключении роняет рендер
function cleanupGraveyardOne() {
    while (graveyard.length) {
        const e = graveyard.shift()
        const shim = e.shim
        if (e.gen === (shim._gen || 0) && !shim.parent && shim.kind !== "text" && shim.kind !== "html") {
            destroyShimNode(shim); return
        }
    }
}
const texCache = new Map()   // src → PIXI.Texture
const frameCache = new Map() // src|times → PIXI.Texture[] (кадры листа)
const blurFilters = new Map()// radius → PIXI.BlurFilter (общие)
let warned = {}              // одноразовые предупреждения
function warnOnce(key, msg) {
    if (!warned[key]) {
        warned[key] = 1
        console.warn("[pixiBackend] " + msg)
        ;(window.__warns = window.__warns || []).push(msg)
    }
}

// числовой аргумент игры: svg-контракт допускал строки с единицами ("128px","2px" —
// doll/inventory/topMenu/lobby/tip/settings) — parseFloat; NaN («0pt» и мусор) → 0
function num(v) {
    if (typeof v === "string") {
        const f = parseFloat(v)
        return isFinite(f) ? f : 0
    }
    const n = +v
    return isFinite(n) ? n : 0
}

// ---------- Текстуры ----------
// шимы, созданные до загрузки текстуры (страховочная сетка: preload normally first)
const pendingShims = new Map()   // src → ShimEl[] (статические)
const frameUsers = new Map()     // src|times → ShimEl[] (анимированные)
function registerPending(src, shim) {
    let arr = pendingShims.get(src)
    if (!arr) { arr = []; pendingShims.set(src, arr) }
    arr.push(shim)
}
function registerFrameUser(src, times, shim) {
    const key = src + "|" + times
    let arr = frameUsers.get(key)
    if (!arr) { arr = []; frameUsers.set(key, arr) }
    arr.push(shim)
}
function getTexture(src) {
    let t = texCache.get(src)
    if (!t) {
        t = PIXI.Texture.EMPTY
        texCache.set(src, t)
        // докгрузка вне предзагрузки (не должна случиться: cacheResources греет кэш,
        // preloadGameTextures заливает GPU до заставки) — подмена текстуры по готовности
        PIXI.Assets.load(src).then(loaded => {
            texCache.set(src, loaded)
            applyTextureRetro(String(src), loaded)
        }).catch(() => {})
    }
    return t
}
// подмена текстуры у уже созданных шимов (отложенная загрузка)
function applyTextureRetro(src, tex) {
    for (const frames of frameCache.values()) {
        if (frames._src === src) {
            rebuildFrames(src, frames._times, frames)
            const users = frameUsers.get(frames._src + "|" + frames._times)
            if (users) for (const shim of users) {
                if (shim._dead || !shim.node) continue
                shim._still = undefined
                setFrame(shim, shim._pendingStill || 0)
            }
        }
    }
    const arr = pendingShims.get(src)
    if (!arr) return
    pendingShims.delete(src)
    for (const shim of arr) {
        if (shim._dead || !shim.node) continue
        if (shim.kind === "image") {
            shim.node.texture = tex
            applySize(shim)
            syncShadowCopies(shim)
        }
    }
}
function getFrameTextures(src, times) {
    const key = src + "|" + times
    let frames = frameCache.get(key)
    if (!frames) {
        frames = []
        frames._src = src
        frames._times = times
        frameCache.set(key, frames)
        rebuildFrames(src, times, frames)
    }
    return frames
}
function rebuildFrames(src, times, frames) {
    const base = texCache.get(src) || getTexture(src)
    const n = parseInt(times)
    const fw = Math.max(1, Math.floor(base.width / n))
    const fh = base.height
    frames.length = 0
    for (let i = 0; i < n; i++) {
        frames.push(new PIXI.Texture({
            source: base.source,
            frame: new PIXI.Rectangle(i * fw, 0, fw, fh),
        }))
    }
    return base
}

// предзагрузка GPU-текстур по списку ресурсов (вызывается start.js после cacheResources:
// HTTP-кэш уже горячий, здесь decode+upload в GPU — до отрисовки заставки, без вспышек)
async function preloadGameTextures(fromFile, basePath) {
    try {
        const resp = await fetch(fromFile)
        if (!resp.ok) throw new Error("HTTP " + resp.status)
        const list = await resp.json()
        const loads = list.map(p => PIXI.Assets.load(basePath + p).then(t => { texCache.set(basePath + p, t) }).catch(() => {}))
        // порциями по 64, чтобы не держать сотни декодеров одновременно
        for (let i = 0; i < loads.length; i += 64) await Promise.all(loads.slice(i, i + 64))
    } catch (e) {
        console.error("[pixiBackend] preloadGameTextures:", e)
    }
}

// ---------- scaleMode (аналог image-rendering: pixelated) ----------
function applyPixelated() {
    const scale = (windowSize.wt / 1920) * (1920 / cameraVB.width)
    const r = scale >= 1 ? scale : 1 / scale
    const pixelated = Math.abs(r - Math.round(r)) < 0.02
    if (pixelated === pixelatedNow) return
    pixelatedNow = pixelated
    const mode = pixelated ? "nearest" : "linear"
    for (const t of texCache.values()) {
        if (t && t.source) t.source.style.scaleMode = mode
    }
    for (const frames of frameCache.values()) {
        for (const t of frames) if (t && t.source) t.source.style.scaleMode = mode
    }
}

// ---------- Раскладка окна 16:9 (как windowSize в index.js/svg.js) ----------
function recalcWindowSize() {
    windowSize.wt = window.innerWidth
    windowSize.ht = window.innerHeight
    window.innerWidth >= window.innerHeight * 16 / 9
        ? windowSize.wt = window.innerHeight * 16 / 9
        : windowSize.ht = window.innerWidth * 9 / 16
}

// ---------- Камера ----------
function applyCamera() {
    if (!worldContainer) return
    const s1 = windowSize.wt / cameraVB.width
    worldContainer.pivot.set(cameraVB.x, cameraVB.y)
    worldContainer.scale.set(s1)
    const sUi = windowSize.wt / uiVB.width
    layerNodes[2].scale.set(sUi)
    uiCTM = { a: sUi, b: 0, c: 0, d: sUi, e: 0, f: 0 }
}

function onWindowResize() {
    recalcWindowSize()
    applyCamera()
    applyPixelated()
    for (const l of layers) l && l._onResize && l._onResize()
}

// ---------- Парсинг стилевых строк ----------
// возвращает [{dx,dy,blur,color,alpha}] из "drop-shadow(0 0 8px rgba(...)) drop-shadow(...)"
// цвет — rgba()/rgb() СО СКОБКАМИ (нельзя [^)]+: внутренняя скобка цвета обрывала строку)
function parseDropShadows(str) {
    const out = []
    if (!str || str === "none") return out
    const re = /drop-shadow\(\s*([-\d.]+)[px]*\s+([-\d.]+)[px]*\s+([-\d.]+)[px]*\s+(rgba?\([^)]*\)|#[0-9a-fA-F]{3,8}|[a-zA-Z]+)\s*\)/g
    let m
    while ((m = re.exec(str))) {
        out.push({ dx: +m[1], dy: +m[2], blur: +m[3], color: m[4].trim() })
    }
    return out
}
function cssColorToPixi(str) {
    // Pixi понимает CSS-строки напрямую; вернём как есть (валидация не нужна)
    return str
}

// фильтры размытия — общие по радиусу
function getBlurFilter(radius) {
    const key = Math.round(radius)
    let f = blurFilters.get(key)
    if (!f) {
        f = new PIXI.BlurFilter({ strength: Math.max(1, key / 2), quality: 3 })
        blurFilters.set(key, f)
    }
    return f
}

// ---------- свечение/тени: запечённые силуэтные копии-СИБЛИНГИ ниже узла ----------
// Три наблюдения из живой отладки: (1) ребёнок в Pixi рисуется НАД собственной
// текстурой родителя — размытая копия-ребёнок ложилась ПОВЕРХ кнопки и «размывала»
// её саму; (2) фильтры на детях Sprite в v8 молча не работают; (3) tint копии
// УМНОЖАЕТСЯ на текстуру: тёмная кнопка × золотой tint = грязный тёмный ореол
// (CSS drop-shadow красит силуэт ЧИСТЫМ цветом). Итог: силуэт текстуры один раз
// запекается в БЕЛУЮ размытую текстуру (getGlowTexture), копия-сиблинг (вставлена
// в родителя ПРЯМО ПЕРЕД узлом — узел рисуется поверх, чёткий силуэт как у CSS)
// красится tint'ом в цвет тени. Текстовые копии — живой блюр на белом клоне стиля.
const glowTexCache = new Map()   // src|radius|k → текстура (белая размытая силуэт-текстура)
// Запекание ТОЛЬКО на CPU (canvas 2d + box-blur альфы): вызов renderer.render в
// обработчике pointerout/over на WebGPU (GTX 1060, v8.19) клинил командный энкодер —
// тикер зависал на первом же кадре. Здесь GPU не трогается вовсе
function getGlowTexture(src, radiusVB, k) {
    const key = src + "|" + radiusVB.toFixed(1) + "|" + k.toFixed(2)
    let t = glowTexCache.get(key)
    if (t) return t
    const base = texCache.get(src)
    if (!base || base === PIXI.Texture.EMPTY || !base.width) return null
    const img = base.source.resource
    if (!img || !img.width) return null
    const rTex = Math.max(1, Math.min(64, radiusVB / k))
    const r = Math.round(rTex)
    const pad = r * 2 + 2
    const w = base.width, h = base.height
    const cv = document.createElement("canvas")
    cv.width = w + pad * 2; cv.height = h + pad * 2
    const ctx = cv.getContext("2d")
    ctx.drawImage(img, pad, pad)
    const id = ctx.getImageData(0, 0, cv.width, cv.height)
    const W = cv.width, H = cv.height
    let a = new Float32Array(W * H)
    for (let i = 0; i < W * H; i++) a[i] = id.data[i * 4 + 3] / 255
    // СВЕЧЕНИЕ ТОЛЬКО ПО КРАЮ (просьба пользователя): ореол = размытая альфа
    // минус исходная — внутри силуэта копия прозрачна (не заливает ячейку,
    // как было с плотным зелёным квадратом у скилл-иконок), светит контур
    let b = new Float32Array(a)
    for (let pass = 0; pass < 3; pass++) b = boxBlurAlpha(b, W, H, r)
    for (let i = 0; i < W * H; i++) {
        const ring = Math.max(0, b[i] - a[i])
        id.data[i * 4] = 255; id.data[i * 4 + 1] = 255; id.data[i * 4 + 2] = 255
        id.data[i * 4 + 3] = Math.round(Math.min(1, ring) * 255)
    }
    ctx.putImageData(id, 0, 0)
    t = PIXI.Texture.from(cv)
    t.source.style.scaleMode = "linear"
    glowTexCache.set(key, t)
    return t
}
// разделяемый box-blur ×3 (три прохода ≈ гауссиана) по альфа-каналу
function boxBlurAlpha(buf, W, H, r) {
    if (r < 1) return buf
    const tmp = new Float32Array(W * H)
    const out = new Float32Array(W * H)
    const win = r * 2 + 1
    for (let y = 0; y < H; y++) {
        const row = y * W
        let acc = 0
        for (let x = -r; x <= r; x++) acc += buf[row + Math.min(W - 1, Math.max(0, x))]
        for (let x = 0; x < W; x++) {
            tmp[row + x] = acc / win
            acc += buf[row + Math.min(W - 1, x + r + 1)] - buf[row + Math.max(0, x - r)]
        }
    }
    for (let x = 0; x < W; x++) {
        let acc = 0
        for (let y = -r; y <= r; y++) acc += tmp[Math.min(H - 1, Math.max(0, y)) * W + x]
        for (let y = 0; y < H; y++) {
            out[y * W + x] = acc / win
            acc += tmp[Math.min(H - 1, y + r + 1) * W + x] - tmp[Math.max(0, y - r) * W + x]
        }
    }
    return out
}
function makeShadowCopy(shim, sp) {
    let copy = null
    if (shim.kind === "image" && shim.node instanceof PIXI.Sprite && shim.attrs.href) {
        // запечённый силуэт годится только статичной картинке: у анимированного
        // спрайта href — ЛИСТ кадров, силуэт листа был бы неверным
        const k = shim.node.scale.x || 1
        const baked = getGlowTexture(String(shim.attrs.href), sp.blur, k)
        if (!baked) return null
        copy = new PIXI.Sprite(baked)
        // паддинг запечки: r*2+2, где r = round(clamp(sp.blur/k, 1..64)) — см. getGlowTexture
        copy._glowPad = Math.round(Math.max(1, Math.min(64, sp.blur / k))) * 2 + 2
    } else if (shim.kind === "text" || shim.kind === "html") {
        // белый клон стиля: tint красит силуэт чистым цветом (как CSS drop-shadow)
        const st = Object.assign({}, shim.node.style, { fill: 0xffffff, stroke: undefined })
        copy = new PIXI.Text({ text: shim.node.text, style: st })
        if (sp.blur > 0) copy.filters = [getBlurFilter(sp.blur)]
    } else {
        warnOnce("shadow" + shim.kind, "drop-shadow на " + shim.kind + " не поддержан — пропущен")
        return null
    }
    const col = new PIXI.Color(cssColorToPixi(sp.color))
    copy.tint = col
    copy._baseAlpha = col.alpha
    copy.alpha = col.alpha
    copy._isShadowCopy = 1
    return copy
}
function removeShadowCopies(shim) {
    if (!shim._shadowCopies) return
    for (const c of shim._shadowCopies) c.destroy({ children: true })
    shim._shadowCopies = null
}
function mountShadowCopies(shim) {
    removeShadowCopies(shim)
    const specs = shim._shadowSpecs
    if (!specs || !specs.length) return
    if (!shim.parent || !shim.parent.node || !shim.node || shim.node.destroyed) return
    const copies = []
    for (const sp of specs) {
        const copy = makeShadowCopy(shim, sp)
        if (!copy) continue
        copy._shadowDx = sp.dx
        copy._shadowDy = sp.dy
        copies.push(copy)
    }
    if (!copies.length) return
    shim._shadowCopies = copies
    syncShadowCopies(shim)
    const idx = shim.parent.node.getChildIndex(shim.node)
    for (const c of copies) shim.parent.node.addChildAt(c, idx)
}
// синхронизация копий вслед за узлом — горячие точки (applyPosition/applySize/setFrame)
// вызывают её на каждый тик, поэтому выход по отсутствию копий — первая проверка
function syncShadowCopies(shim) {
    const copies = shim._shadowCopies
    if (!copies || !shim.node || shim.node.destroyed) return
    const n = shim.node
    for (const c of copies) {
        c.visible = n.visible
        // копия — sibling и НЕ наследует alpha узла: opacity шима (hoverOpa,
        // setAttribute("opacity") — подсветка доступных способностей 0.3)
        // обязана ослаблять и свечение, иначе копия светит полной альфой
        c.alpha = (c._baseAlpha !== undefined ? c._baseAlpha : 1) * n.alpha
        if (c instanceof PIXI.Text) {
            c.text = n.text
        } else {
            // запечённая текстура не меняется; сдвиг: левый-верх узла в родителе
            // минус паддинг запечки, всё в масштабе узла
            const kx = n.scale.x || 1, ky = n.scale.y || 1
            const tlx = n.x - n.anchor.x * n.width
            const tly = n.y - n.anchor.y * n.height
            c.scale.set(kx, ky)
            c.position.set(tlx + (c._shadowDx - c._glowPad) * kx, tly + (c._shadowDy - c._glowPad) * ky)
            continue
        }
        if (n.anchor) c.anchor.set(n.anchor.x, n.anchor.y)
        c.position.set(n.x + c._shadowDx, n.y + c._shadowDy)
    }
}

// силуэтные копии под узлом: drop-shadow(0 0 r color) ≈ запечённый белый силуэт × tint
function applyDropShadow(shim, styleStr) {
    if (location.search.includes("noglow")) return // отладочная бисекция зависания WebGPU
    shim._shadowSpecs = parseDropShadows(styleStr)
    shim._shadowStyleRaw = styleStr || ""
    mountShadowCopies(shim)
}

// ============================================================================
// ShimEl — шим SVG-элемента над Pixi-узлом
// ============================================================================
class ShimEl {
    constructor(kind, node) {
        this.kind = kind          // layer|image|anim|rect|circle|text|html|path|poly|group|clip|vrect|defs
        this.node = node          // Pixi-узел (может быть null у vrect/clip)
        this.attrs = {}           // хранилище атрибутов (как у DOM)
        this._style = {}          // разобранный style
        this.children = []
        this.parent = null
        this._layer = null        // слой-предок (ownerSVGElement)
        this._interactive = 0
        this._dead = 0
        this._onclick = null
        this._over = null
        this._out = null
        this._down = null
        this._up = null
        this._listeners = null   // доп. (dblclick/contextmenu/wheel…)
    }
    // ---------- дерево ----------
    get parentNode() { return this.parent }
    get ownerSVGElement() { return this._layer }
    get isConnected() {
        let p = this.parent
        while (p) { if (p.kind === "layer") return true; p = p.parent }
        return false
    }
    get firstChild() {
        // foreignObject-контракт: textHtml держит <div> ребёнком, игра задаёт ширину
        // переноса через fo.firstChild.style.width (blessFx/library/enemyHover)
        if (this.kind === "html" && this.children.length === 0) {
            if (!this._htmlDiv) {
                const shim = this
                this._htmlDiv = {
                    get style() {
                        return {
                            set width(v) {
                                shim.attrs.width = num(v)
                                if (shim.node) {
                                    shim.node.style.wordWrapWidth = Math.max(10, num(v))
                                    shim.node.style.wordWrap = true
                                    shim.node.style.breakWords = true
                                }
                            },
                            get width() { return shim.attrs.width || 0 },
                        }
                    },
                }
            }
            return this._htmlDiv
        }
        return this.children[0] || null
    }
    get lastElementChild() { return this.children[this.children.length - 1] || null }
    appendChild(shim) { return attachShim(this, shim, this.children.length) }
    append(...shims) { for (const s of shims) attachShim(this, s, this.children.length) }
    prepend(shim) { return attachShim(this, shim, 0) }
    insertBefore(shim, before) {
        const i = this.children.indexOf(before)
        return attachShim(this, shim, i === -1 ? this.children.length : i)
    }
    removeChild(shim) {
        const i = this.children.indexOf(shim)
        if (i !== -1) { this.children.splice(i, 1); detachShim(shim) }
        return shim
    }
    contains(shim) {
        let p = shim
        while (p) { if (p === this) return true; p = p.parent }
        return false
    }
    remove() {
        if (this.parent) this.parent.removeChild(this)
        // маски клипов снимаются с дерева сразу (иначе «белый прямоугольник»-призрак)
        if (this.kind === "clip" && this._maskG && this._maskG.parent) {
            this._maskG.parent.removeChild(this._maskG)
        }
        // ВАЖНО: только ОТКРЕПЛЯЕМ (семантика SVG remove): пулы (floatText и др.)
        // переиспользуют узел ПОСЛЕ remove — уничтожение здесь ломало бы рендер
        // («renderPipeId of null» на переподключении уничтоженного узла).
        // Гарантированное освобождение — зачистка слоёв в del() и graveyard ниже.
        graveyard.push({ shim: this, gen: this._gen || 0 })
        if (graveyard.length > 512) cleanupGraveyardOne()
    }
    // ---------- атрибуты ----------
    setAttribute(name, value) {
        // мёртвый Pixi-узел (уничтожен через группу/слои) — тихий no-op: запись в него
        // роняла бы рендер («position of null»); игра такие шимы переиспользует вслепую
        if (this.node && this.node.destroyed) return
        this.attrs[name] = value
        applyAttr(this, name, value)
    }
    getAttribute(name) {
        const v = this.attrs[name]
        return v === undefined ? null : v
    }
    // DOM-контракт element.id: всегда строка ("" у отсутствующего). Игра ищет спрайты
    // в screenPic через свойство (f.id === obj[6]+"OI" в useObject/blessFx/alchemy/
    // finPillars/trapsFx) — без геттера находка всегда false: рамка использования
    // не удалялась, подсветка и смена спрайта «использованного» объекта не работали
    get id() { const v = this.attrs.id; return v === undefined || v === null ? "" : String(v) }
    set id(v) { this.setAttribute("id", String(v)) }
    removeAttribute(name) {
        delete this.attrs[name]
        applyAttr(this, name, name === "opacity" ? 1 : name === "display" ? "" : "")
    }
    // числовые атрибуты как объекты с animVal (DOM-контракт: rect.x.animVal.value)
    get x() { return numAttr(this, "x") }
    get y() { return numAttr(this, "y") }
    get width() { return numAttr(this, "width") }
    get height() { return numAttr(this, "height") }
    get cx() { return numAttr(this, "cx") }
    get cy() { return numAttr(this, "cy") }
    get r() { return numAttr(this, "r") }
    get href() { return { animVal: this.attrs.href || "" } }
    get clipRect() { return this._clipRect || null }
    get style() {
        if (!this._styleProxy) this._styleProxy = makeStyleProxy(this)
        return this._styleProxy
    }
    // ---------- текст ----------
    get textContent() { return this.attrs["#text"] || "" }
    set textContent(v) {
        this.attrs["#text"] = domText(v)
        if (this.kind === "text") this.node.text = domText(v)
        else if (this.kind === "html") this.node.text = stripHtml(domText(v))
        syncShadowCopies(this)
    }
    getBBox() {
        if (this.kind === "anim" && this._frameW) {
            return { x: 0, y: 0, width: this._frameW, height: +(this.attrs.height || 0) }
        }
        if (this.node && isFinite(this.node.width)) {
            return { x: 0, y: 0, width: this.node.width, height: this.node.height }
        }
        return { x: 0, y: 0, width: 0, height: 0 }
    }
    // ---------- события ----------
    set onclick(fn) { this._onclick = fn; this._syncInteractive() }
    get onclick() { return this._onclick }
    set onmouseover(fn) { this._over = fn; this._syncInteractive() }
    get onmouseover() { return this._over }
    set onmouseout(fn) { this._out = fn; this._syncInteractive() }
    get onmouseout() { return this._out }
    set onmousedown(fn) { this._down = fn; this._syncInteractive() }
    get onmousedown() { return this._down }
    set onmouseup(fn) { this._up = fn; this._syncInteractive() }
    get onmouseup() { return this._up }
    set onmousemove(fn) { this._move = fn; this._syncInteractive() }
    get onmousemove() { return this._move }
    addEventListener(type, fn) {
        if (!this._listeners) this._listeners = new Map()
        let arr = this._listeners.get(type)
        if (!arr) { arr = []; this._listeners.set(type, arr) }
        arr.push(fn)
        this._syncInteractive()
    }
    removeEventListener(type, fn) {
        if (!this._listeners) return
        const arr = this._listeners.get(type)
        if (arr) { const i = arr.indexOf(fn); if (i !== -1) arr.splice(i, 1) }
    }
    // synthetic dispatch (геймпад-клик: elementFromPoint → dispatchEvent(new MouseEvent('click')))
    dispatchEvent(evt) {
        const type = evt && evt.type
        if (type === "click" && this._onclick) { this._onclick(wrapEvt(evt, this)); return true }
        const arr = this._listeners && this._listeners.get(type)
        if (arr) { for (const fn of arr.slice()) fn(wrapEvt(evt, this)); return true }
        return false
    }
    _syncInteractive() {
        const want = !!(this._onclick || this._over || this._out || this._down || this._up || this._move ||
            (this._listeners && this._listeners.size > 0))
        if (want === this._interactive) return
        this._interactive = want ? 1 : 0
        if (this.node) {
            // КОНТРАКТ ОРИГИНАЛА (svg.js 6161717): ВСЕ примитивы по умолчанию
            // pointer-events="none", и только элементы с обработчиками
            // (func/hover/funcShow/funcDrag/funcDbl) получают "auto" — перехватывают
            // клики. Никакого visiblePainted: тултипы/рамки/декор не мешают кликам
            this.node.eventMode = want ? "static" : "none"
            if (want && !this._wired) { this._wired = 1; wirePixiEvents(this) }
        }
    }
}

// числовой атрибут-объект (DOM: el.x.animVal.value === number).
// SVG-особенности, которыми пользуется игра:
//   animVal[0].value — y/x текстов как СПИСОК чисел (floatText/doll) → animVal[0] = сам объект;
//   baseVal.value = N — ЗАПИСЬ через baseVal (ползунки настроек) → роутим в setAttribute
function numAttr(shim, name) {
    if (shim._numAttrs && shim._numAttrs[name]) return shim._numAttrs[name]
    if (!shim._numAttrs) shim._numAttrs = {}
    const anim = {
        get value() {
            const v = shim.attrs[name]
            return v === undefined || v === null ? defaultNum(shim, name) : +v || 0
        },
        set value(v) { shim.setAttribute(name, v) },
    }
    anim[0] = anim
    const holder = {
        animVal: anim,
        baseVal: anim,
        get value() { return anim.value },
        set value(v) { anim.value = v },
    }
    shim._numAttrs[name] = holder
    return holder
}
function defaultNum(shim, name) {
    if (name === "width" || name === "height") {
        if (shim.node) return shim.node.width || 0
    }
    return 0
}

// прокси style: filter/outline/display/opacity/imageRendering/cursor
function makeStyleProxy(shim) {
    const store = shim._style
    return {
        set filter(v) { store.filter = v; applyDropShadow(shim, v) },
        get filter() { return store.filter || "" },
        set outline(v) { store.outline = v; applyOutline(shim, v) },
        get outline() { return store.outline || "" },
        set display(v) { store.display = v; if (shim.node) shim.node.visible = (v !== "none"); syncShadowCopies(shim) },
        get display() { return store.display || "" },
        set opacity(v) { if (shim.node) shim.node.alpha = +v },
        get opacity() { return shim.node ? String(shim.node.alpha) : "1" },
        set imageRendering(v) { store.imageRendering = v; applyPixelated() },
        get imageRendering() { return store.imageRendering || "" },
        set cursor(v) { document.body.style.cursor = v },
        get cursor() { return document.body.style.cursor },
        set zIndex(v) { /* порядок задаётся деревом */ },
    }
}
// outline "2px solid #xxx" — рамка по границам узла
function applyOutline(shim, v) {
    if (shim._outlineG) { shim._outlineG.destroy(); shim._outlineG = null }
    const m = /(\d+(?:\.\d+)?)px\s+solid\s+(\S+)/.exec(v || "")
    if (!m || !shim.node) return
    const w = +m[1], color = m[2]
    const g = new PIXI.Graphics()
    const wd = isFinite(shim.node.width) ? shim.node.width : 0, ht = isFinite(shim.node.height) ? shim.node.height : 0
    g.rect(-w / 2, -w / 2, wd + w, ht + w).stroke({ width: w, color })
    shim.node.addChild(g)
    shim._outlineG = g
}

// ----------------------------------------------------------------------------
// Применение атрибутов
// ----------------------------------------------------------------------------
function applyAttr(shim, name, value) {
    switch (name) {
        case "id": {
            if (value !== undefined && value !== null && value !== "") shimById.set(String(value), shim)
            else for (const [k, v] of shimById) if (v === shim) shimById.delete(k)
            return
        }
        case "x": case "y": {
            applyPosition(shim)
            return
        }
        case "width": case "height": {
            applySize(shim)
            return
        }
        case "href": {
            if (shim.kind === "image") {
                shim.node.texture = getTexture(String(value))
                applySize(shim)
                applyPixelated()
                syncShadowCopies(shim)
            } else if (shim.kind === "anim") {
                // смена листа анимации (syncHeroAnim/setEnemyPose меняют href на живом
                // спрайте): кадры пересобираются под новый лист, кадр восстанавливается
                // по сохранённому смещению
                shim._frames = getFrameTextures(String(value), parseInt(shim._times) || 1)
                shim._still = undefined
                setFrame(shim, Math.round((shim._shift || 0) / (shim._frameW || 1)))
            }
            return
        }
        case "times": {
            // «times» в SVG — атрибут-хранитель; в шиме ведёт _times (число кадров листа)
            if (shim.kind === "anim") shim._times = value
            return
        }
        case "opacity": {
            if (shim.node) shim.node.alpha = value === undefined || value === "" ? 1 : +value
            syncShadowCopies(shim)
            return
        }
        case "display": {
            if (shim.node) shim.node.visible = value !== "none"
            syncShadowCopies(shim)
            return
        }
        case "clip-path": {
            applyClipPath(shim, value)
            return
        }
        case "style": {
            // полная запись style-строки (svg.js text hover меняет style целиком)
            applyStyleString(shim, value)
            return
        }
        case "viewBox": {
            if (shim.kind === "layer") {
                const p = String(value).trim().split(/\s+/).map(Number)
                const vb = shim._vb
                vb.x = p[0]; vb.y = p[1]; vb.width = p[2]; vb.height = p[3]
                applyCamera()
            }
            return
        }
        case "d": {
            if (shim.kind === "path") redrawPath(shim)
            return
        }
        case "points": {
            if (shim.kind === "poly") redrawPoly(shim)
            return
        }
        case "cx": case "cy": case "r": {
            if (shim.kind === "circle") redrawCircle(shim)
            return
        }
        case "rx": case "stroke-width": case "fill-opacity": case "fill": case "stroke": {
            if (shim.kind === "rect") redrawRect(shim)
            else if (shim.kind === "circle") redrawCircle(shim)
            // poly/path: игра ставит stroke/fill ПОСЛЕ points/d (minimapFx-кнопка,
            // секторы кулдаунов) — без перерисовки фигура оставалась пустой (0×0)
            else if (shim.kind === "poly") redrawPoly(shim)
            else if (shim.kind === "path") redrawPath(shim)
            else if (shim.kind === "text" || shim.kind === "html") applyTextStyle(shim)
            shim._syncInteractive()
            return
        }
        case "font-size": case "text-anchor": case "font-family": {
            if (shim.kind === "text" || shim.kind === "html") applyTextStyle(shim)
            return
        }
        case "text": {
            if (shim.kind === "text" || shim.kind === "html") { shim.node.text = String(value); syncShadowCopies(shim) }
            return
        }
        case "transform": {
            // единственная используемая игрой форма: "rotate(deg cx cy)" — вихрь
            // дротиков Валькирии (valkyrie.js). Вокруг точки (cx,cy) родителя:
            // pivot = центр − угол спрайта, position = центр
            const m = /rotate\(\s*([-\d.]+)(?:[,\s]+([-\d.]+)[,\s]+([-\d.]+))?\s*\)/.exec(String(value || ""))
            if (!m || !shim.node) {
                if (shim.node) { // сброс transform
                    shim._trCx = undefined; shim._trCy = undefined
                    shim.node.rotation = 0
                    shim.node.pivot.set(0, 0)
                    shim.node.position.set(num(shim.attrs.x), num(shim.attrs.y))
                }
                return
            }
            const deg = +m[1]
            const hasC = m[2] !== undefined
            const cx = hasC ? +m[2] : num(shim.attrs.x)
            const cy = hasC ? +m[3] : num(shim.attrs.y)
            shim._trCx = cx; shim._trCy = cy
            shim.node.rotation = deg * Math.PI / 180
            shim.node.pivot.set(cx - num(shim.attrs.x), cy - num(shim.attrs.y))
            shim.node.position.set(cx, cy)
            return
        }
        case "pointer-events": {
            // единственная семантика, которую игра использует: "none" (прозрачность)
            shim._syncInteractive()
            return
        }
        case "preserveAspectRatio": case "clipPathUnits":
        case "stroke-linejoin": case "stroke-linecap":
            return // семантика покрыта eventMode/деревом
        default:
            return
    }
}

function applyStyleString(shim, str) {
    // сохраняем paint-order/user-select (не влияют на Pixi), извлекаем filter/display
    shim._styleRaw = str
    if (!str) return
    const filterMatch = /filter:\s*([^;]+)/.exec(str)
    applyDropShadow(shim, filterMatch ? filterMatch[1] : "")
    const dispMatch = /display:\s*([^;]+)/.exec(str)
    if (dispMatch && shim.node) shim.node.visible = dispMatch[1].trim() !== "none"
}

function applyPosition(shim) {
    if (shim.node && shim.node.destroyed) return
    if (shim.kind === "anim") {
        // img.x несёт кадровое смещение: still = (rect.x − img.x)/frameW (контракт _shift)
        const cr = shim._clipRect
        if (!cr) return
        const rx = +(cr.attrs.x || 0), ry = +(cr.attrs.y || 0)
        if (shim.attrs.x !== undefined) {
            const shift = rx - (+shim.attrs.x || 0)
            shim._shift = shift
            const fw = shim._frameW || 1
            setFrame(shim, Math.round(shift / fw))
        }
        if (shim.node) shim.node.position.set(rx, ry)
        syncEcsPos(shim)
        return
    }
    if (shim.kind === "vrect") {
        // окно кадра — координаты читаются из attrs (кэш _rx/_ry поддерживаем)
        shim._rx = +(shim.attrs.x || 0)
        shim._ry = +(shim.attrs.y || 0)
        syncEcsPos(shim)
        return
    }
    if (shim.kind === "cliprect") {
        shim._rx = num(shim.attrs.x)
        shim._ry = num(shim.attrs.y)
        if (shim.parent && shim.parent.kind === "clip") updateClipMask(shim.parent)
        return
    }
    // rect/circle: координаты живут ВНУТРИ геометрии Graphics (redrawRect/redrawCircle),
    // position узла — нулевой; повторная запись x/y двигает ТОЛЬКО геометрию (в SVG
    // атрибут x у rect сдвигает фигуру — двойной сдвиг «позиция+геометрия» ломал полосы
    // прогресса и рамки, которые игра двигает через setAttribute("x"/"y"))
    if (shim.kind === "rect") { redrawRect(shim); return }
    if (shim.kind === "circle") { redrawCircle(shim); return }
    // path/poly: x/y — хранилище (на d/points не влияют, как в SVG)
    if (shim.kind === "path" || shim.kind === "poly") return
    if (shim.kind === "text" || shim.kind === "html") {
        // повторная запись x/y у текста обязана сохранить базлайн-вычет и якорь
        // (та же формула, что в applyTextStyle, иначе текст съезжает вниз/влево)
        applyTextStyle(shim)
        return
    }
    if (shim.node && (shim.attrs.x !== undefined || shim.attrs.y !== undefined)) {
        // при активном rotate-транформе позиция узла = центр вращения
        if (shim._trCx !== undefined) shim.node.position.set(shim._trCx, shim._trCy)
        else shim.node.position.set(num(shim.attrs.x), num(shim.attrs.y))
        syncEcsPos(shim)
    }
}

function applySize(shim) {
    const w = num(shim.attrs.width), h = num(shim.attrs.height)
    if (shim.kind === "cliprect") {
        if (shim.parent && shim.parent.kind === "clip") updateClipMask(shim.parent)
        return
    }
    if (shim.kind === "anim") {
        // SVG-контракт: width/height на img — размер ЛИСТА (его читают animPlay/enemyHover
        // через img.width.animVal для culling и hit-тестов). Окно кадра (clipRect) НЕ
        // трогается — оно постоянно для сущности (кадр wait/run/attack одного врага
        // одинаков); его перезапись листом ломала тени и коллизии (128 вместо 32)
        const n = parseInt(shim._times) || 1
        shim._frameW = w / n
        if (shim.node) { shim.node.width = shim._frameW; shim.node.height = h }
        // пересобрать кадры под новый лист/число кадров (setFrame поставит текущий)
        if (shim.attrs.href) {
            shim._frames = getFrameTextures(String(shim.attrs.href), shim._times)
            shim._still = undefined
            setFrame(shim, Math.round((shim._shift || 0) / (shim._frameW || 1)))
        }
        return
    }
    // Graphics-примитивы НЕ масштабируются width-сеттером: у пустой геометрии
    // (полоса использования начинается с width 0) scale = w/0 → Infinity, и первый
    // же рост ширины «выстреливает» прямоугольник за экран («прилетает справа»).
    // SVG-семантика: атрибут width ПЕРЕОПРЕДЕЛЯЕТ геометрию — перерисовываем
    if (shim.kind === "rect" || shim.kind === "circle" || shim.kind === "path" || shim.kind === "poly") {
        if (shim.kind === "rect") redrawRect(shim)
        else if (shim.kind === "circle") redrawCircle(shim)
        syncShadowCopies(shim)
        return
    }
    if (shim.node && shim.node.width !== undefined) {
        shim.node.width = w
        shim.node.height = h
    }
    syncShadowCopies(shim)
}

// кадр анимированного спрайта (текстура-подокно)
function setFrame(shim, still) {
    const frames = shim._frames
    if (!frames || !frames.length) { shim._pendingStill = still; return }
    const times = parseInt(shim._times) || 1
    let s = still
    if (s < 0) s = 0
    if (s > times - 1) s = times - 1
    if (shim._still === s) return
    shim._still = s
    if (shim.node && frames[s]) {
        // страховка: destroyed-спрайт (в Pixi v8 destroy обнуляет _anchor → «reading 'x'»)
        // или текстура-кадр с null frame роняют GPU-батчер — пресекаем и логируем виновника
        if (shim.node.destroyed) {
            warnOnce("dead" + frames._src, "setFrame на уничтоженном спрайте " + frames._src + " — пропуск")
            return
        }
        if (!frames[s].frame) {
            warnOnce("nullframe" + frames._src, "кадр " + s + " с null frame у " + frames._src + " — пересборка листа")
            shim._still = undefined
            rebuildFrames(frames._src, frames._times, frames)
            if (!frames[s] || !frames[s].frame) return
        }
        shim.node.texture = frames[s]
        shim.node.width = shim._frameW
        shim.node.height = +shim.attrs.height || frames[s].height
        syncShadowCopies(shim)
    }
}

// ECS: позиция окна кадра → компоненты posX/posY (мост ecsBridge ставит _ecs)
function syncEcsPos(shim) {
    const id = shim._ecs
    if (id === undefined || id === null) return
    COMPONENTS.posX[id] = num(shim.attrs.x)
    COMPONENTS.posY[id] = num(shim.attrs.y)
}

// ----------------------------------------------------------------------------
// Скрытие/показ (display) для group/defs — visible затрагивает поддерево Pixi сам
// ----------------------------------------------------------------------------

// ----------------------------------------------------------------------------
// clipPath (полосы ХП/опыта/босса/журнала/библиотеки): шим держит Graphics-маску
// ----------------------------------------------------------------------------
function makeClipMask(clipShim) {
    const g = new PIXI.Graphics()
    g.rect(0, 0, 0, 0).fill({ color: 0xffffff })
    clipShim._maskG = g
    clipShim._maskUsers = []
}
function updateClipMask(clipShim) {
    const rectShim = clipShim.children.find(c => c.kind === "cliprect")
    if (!rectShim || !clipShim._maskG) return
    const x = num(rectShim.attrs.x), y = num(rectShim.attrs.y)
    const w = num(rectShim.attrs.width), h = num(rectShim.attrs.height)
    // маска в КООРДИНАТАХ РОДИТЕЛЯ пользователя: у UI-слоя всё в общих viewBox-координатах,
    // у игровых слоёв — тоже (общий worldContainer) — Grafika-маску добавляем пользователю
    const g = clipShim._maskG
    g.clear()
    if (w > 0 && h > 0) g.rect(x, y, w, h).fill({ color: 0xffffff })
}
function applyClipPath(shim, value) {
    // открепить старую
    if (shim._clipSrc) {
        const users = shim._clipSrc._maskUsers
        const i = users ? users.indexOf(shim) : -1
        if (i !== -1) users.splice(i, 1)
        if (shim.node) shim.node.mask = null
        shim._clipSrc = null
    }
    const m = /url\(#([^)]+)\)/.exec(String(value || ""))
    if (!m) return
    const clip = shimById.get(m[1])
    if (!clip || clip.kind !== "clip") { warnOnce("clip" + m[1], "clip-path на несуществующий id " + m[1]); return }
    shim._clipSrc = clip
    clip._maskUsers.push(shim)
    if (clip._maskG && shim.node) {
        // маска живёт в координатах слоя пользователя: добавляем Graphics в тот же слой
        if (!clip._maskG.parent) {
            const layer = shim._layer || layers[2]
            layer.node.addChild(clip._maskG)
        }
        shim.node.mask = clip._maskG
        updateClipMask(clip)
    }
}

// ----------------------------------------------------------------------------
// Отрисовка примитивов (Graphics)
// ----------------------------------------------------------------------------
function redrawRect(shim) {
    const g = shim.node
    const x = num(shim.attrs.x), y = num(shim.attrs.y)
    const w = num(shim.attrs.width), h = num(shim.attrs.height)
    const rx = num(shim.attrs.rx)
    const fill = shim.attrs.fill
    const stroke = shim.attrs.stroke
    const sw = num(shim.attrs["stroke-width"])
    const fo = num(shim.attrs["fill-opacity"] ?? 1)
    g.clear()
    if (w > 0 && h > 0) {
        const path = rx > 0 ? g.roundRect(x, y, w, h, rx) : g.rect(x, y, w, h)
        if (fill && fill !== "none") path.fill({ color: fill, alpha: fo })
        if (stroke && stroke !== "none" && sw > 0) path.stroke({ width: sw, color: stroke })
    }
    if (shim._outlineG) { /* outline пересоздаётся style-прокси при следующей записи */ }
}
function redrawCircle(shim) {
    const g = shim.node
    const cx = num(shim.attrs.cx), cy = num(shim.attrs.cy), r = num(shim.attrs.r)
    const fill = shim.attrs.fill, stroke = shim.attrs.stroke
    const sw = num(shim.attrs["stroke-width"])
    g.clear()
    if (r > 0) {
        const p = g.circle(cx, cy, r)
        if (fill && fill !== "none") p.fill({ color: fill })
        if (stroke && stroke !== "none" && sw > 0) p.stroke({ width: sw, color: stroke })
    }
}
function redrawPoly(shim) {
    const g = shim.node
    const pts = String(shim.attrs.points || "").trim().split(/[\s,]+/).map(Number)
    const flat = []
    for (let i = 0; i + 1 < pts.length; i += 2) flat.push(pts[i], pts[i + 1])
    const fill = shim.attrs.fill, stroke = shim.attrs.stroke
    const sw = num(shim.attrs["stroke-width"])
    g.clear()
    if (flat.length >= 6) {
        const p = g.poly(flat)
        if (fill && fill !== "none") p.fill({ color: fill })
        if (stroke && stroke !== "none" && sw > 0) p.stroke({ width: sw, color: stroke })
    }
}
// парсер d: M/L/H/V/Z + A/a (эллиптическая дуга — радиальные секторы кулдаунов
// способностей: getSectorPath в activeSkills). Дуга сэмплируется полилинией
function pathPoints(d) {
    const pts = []
    const tokens = String(d).match(/[MLHVZAmlhvza]|[-+]?[\d.]+(?:e[-+]?\d+)?/g) || []
    let i = 0, cx = 0, cy = 0, cmd = ""
    let sx = 0, sy = 0
    const addArc = (x2, y2, rx, ry, rotDeg, largeArc, sweep, rel) => {
        const x1 = cx, y1 = cy
        if (rel) { x2 += x1; y2 += y1 }
        rx = Math.abs(rx); ry = Math.abs(ry)
        if (rx < 1e-6 || ry < 1e-6) { pts.push(x2, y2); cx = x2; cy = y2; return }
        // F.6.5 (W3C): центр дуги по конечным точкам и радиусам
        const phi = rotDeg * Math.PI / 180
        const cosP = Math.cos(phi), sinP = Math.sin(phi)
        const dx2 = (x1 - x2) / 2, dy2 = (y1 - y2) / 2
        const x1p = cosP * dx2 + sinP * dy2
        const y1p = -sinP * dx2 + cosP * dy2
        const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry)
        if (lam > 1) { const s = Math.sqrt(lam); rx *= s; ry *= s }
        const num0 = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p
        const co = (largeArc !== sweep ? 1 : -1) * Math.sqrt(Math.max(0, num0 / (rx * rx * ry * ry)))
        const cxp = co * rx * y1p / ry
        const cyp = -co * rx * x1p / ry
        const ccx = cosP * cxp - sinP * cyp + (x1 + x2) / 2
        const ccy = sinP * cxp + cosP * cyp + (y1 + y2) / 2
        const ang = (ux, uy, vx, vy) => {
            const dot = ux * vx + uy * vy, len = Math.sqrt(ux * ux + uy * uy) * Math.sqrt(vx * vx + vy * vy)
            let a = Math.acos(Math.min(1, Math.max(-1, dot / (len || 1))))
            if (ux * vy - uy * vx < 0) a = -a
            return a
        }
        const th1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry)
        let dth = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry)
        if (!sweep && dth > 0) dth -= 2 * Math.PI
        if (sweep && dth < 0) dth += 2 * Math.PI
        // сэмплирование: шаг ~10°, минимум 8 сегментов
        const steps = Math.max(8, Math.ceil(Math.abs(dth) / (Math.PI / 18)))
        for (let k = 1; k <= steps; k++) {
            const th = th1 + dth * k / steps
            const px = ccx + rx * Math.cos(th) * cosP - ry * Math.sin(th) * sinP
            const py = ccy + rx * Math.cos(th) * sinP + ry * Math.sin(th) * cosP
            pts.push(px, py)
        }
        cx = x2; cy = y2
    }
    while (i < tokens.length) {
        const t = tokens[i]
        if (/[MLHVZAmlhvza]/.test(t)) { cmd = t; i++; if (cmd === "Z" || cmd === "z") { pts.push(sx, sy); continue } }
        const rel = cmd === cmd.toLowerCase() && cmd.toLowerCase() !== "z"
        switch (cmd.toLowerCase()) {
            case "m": case "l": {
                const x = +tokens[i] + (rel ? cx : 0), y = +tokens[i + 1] + (rel ? cy : 0)
                if (cmd.toLowerCase() === "m" && pts.length === 0) { sx = x; sy = y }
                pts.push(x, y); cx = x; cy = y; i += 2
                // неявные L после M
                if (cmd === "M" || cmd === "m") cmd = rel ? "l" : "L"
                break
            }
            case "h": { const x = +tokens[i] + (rel ? cx : 0); pts.push(x, cy); cx = x; i += 1; break }
            case "v": { const y = +tokens[i] + (rel ? cy : 0); pts.push(cx, y); cy = y; i += 1; break }
            case "a": {
                addArc(+tokens[i + 5], +tokens[i + 6], +tokens[i], +tokens[i + 1], +tokens[i + 2], +tokens[i + 3], +tokens[i + 4], rel)
                i += 7
                break
            }
            default: i++
        }
    }
    return pts
}
function redrawPath(shim) {
    const g = shim.node
    const pts = pathPoints(shim.attrs.d)
    const fill = shim.attrs.fill !== undefined ? shim.attrs.fill : "rgba(0, 0, 0, 0.65)"
    const stroke = shim.attrs.stroke, sw = num(shim.attrs["stroke-width"])
    g.clear()
    if (pts.length >= 6) {
        const p = g.poly(pts)
        if (fill && fill !== "none") p.fill({ color: fill })
        if (stroke && stroke !== "none" && sw > 0) p.stroke({ width: sw, color: stroke })
    }
}

// ----------------------------------------------------------------------------
// Текст
// ----------------------------------------------------------------------------
const TEXT_BASELINE_K = 0.8 // SVG y = baseline; Pixi anchor(0,0) = верх глифа
function applyTextStyle(shim) {
    if (!shim.node) return
    const o = shim._textOpts || {}
    const size = num(shim.attrs["font-size"]) || num(o.size) || 24
    const fill = shim.attrs.fill || "#ffffff"
    const stroke = shim.attrs.stroke
    const sw = +(shim.attrs["stroke-width"] || 0)
    const family = (shim.attrs["font-family"] || (o.font || "baseFont2")) + ", sans-serif"
    // КОМТРАКТ ОРИГИНАЛА: <text> — y это БАЗЛАЙН (якорь по x из text-anchor);
    // textHtml (foreignObject) — блок от ЛЕВОГО ВЕРХНЕГО угла (x,y), text-anchor
    // на foreignObject НЕ действовал: если рисовать html от центра/базлайна,
    // текст «вылезает» влево-вверх из своих фреймов (helpWord/ addToSkill/library)
    const isHtml = shim.kind === "html"
    const anchorX = !isHtml && shim.attrs["text-anchor"] === "middle" ? 0.5 : 0
    const st = {
        fontFamily: family,
        fontSize: size,
        fill,
        stroke: stroke && stroke !== "none" && sw > 0 ? { color: stroke, width: sw, join: "round" } : undefined,
        breakWords: isHtml,
        wordWrap: isHtml,
        wordWrapWidth: isHtml ? Math.max(10, +(shim.attrs.width || o.w || 100)) : undefined,
        lineHeight: isHtml ? size * 1.15 : undefined,
    }
    shim.node.style = st
    shim.node.resolution = Math.min(2, window.devicePixelRatio || 1)
    shim.node.anchor.set(anchorX, 0)
    const px = num(shim.attrs.x)
    const py = isHtml ? num(shim.attrs.y) : num(shim.attrs.y) - size * TEXT_BASELINE_K
    shim.node.position.set(px, py)
    syncShadowCopies(shim)
}

// ----------------------------------------------------------------------------
// Дерево: подключение/отключение шимов
// ----------------------------------------------------------------------------
function attachShim(parent, shim, index) {
    // страховка: пул вернул УНИЧТОЖЕННЫЙ текстовый шим (уже невозможно по фиксу
    // layer.removeChild, но старые пулы могли запомнить шим из прежней сцены) —
    // пересоздаём PIXI.Text по сохранённым атрибутам, иначе рендер падает на destroyed
    if (shim.node && shim.node.destroyed) {
        if (shim.kind === "text" || shim.kind === "html") {
            shim.node = new PIXI.Text({ text: shim.attrs["#text"] || "" })
            shim._wired = 0
            shim._interactive = 0
            shim._shadowCopies = null
            shim._outlineG = null
            applyTextStyle(shim)
        } else {
            return shim // не-текст уничтоженный не прикрепляем
        }
    }
    if (shim.parent) {
        const old = shim.parent
        const i = old.children.indexOf(shim)
        if (i !== -1) old.children.splice(i, 1)
        if (shim.node && shim.node.parent === old.node) old.node.removeChild(shim.node)
    }
    shim.parent = parent
    shim._gen = (shim._gen || 0) + 1 // переиспользованные узлы защищены от graveyard-очистки
    shim._layer = parent.kind === "layer" ? parent : parent._layer
    if (index >= parent.children.length) parent.children.push(shim)
    else parent.children.splice(index, 0, shim)
    if (shim.node && parent.node) {
        // индекс в Pixi-дереве считается по СОСЕДЯМ-ШИМАМ С УЗЛАМИ, а не по индексу
        // шима: в raw-дереве есть узлы вне шим-дерева (тени-копии, маски Graphics) —
        // из-за расхождения новые узлы вставлялись ПЕРЕД уже существующими, и кнопки
        // меню оказывались ПОВЕРХ панели настроек, воруя её клики
        let rawIdx
        if (index <= 0) {
            // prepend (SVG: в начало = на самый нижний слой) — checkZOrder героя
            // опускает стены/накладки под себя именно prepend'ом
            rawIdx = 0
        } else {
            rawIdx = parent.node.children.length
            for (let k = index - 1; k >= 0; k--) {
                const s = parent.children[k]
                if (s !== shim && s.node && s.node.parent === parent.node) {
                    rawIdx = parent.node.getChildIndex(s.node) + 1
                    break
                }
            }
        }
        parent.node.addChildAt(shim.node, Math.min(rawIdx, parent.node.children.length))
        // маски-Graphics клипов переезжают вместе с пользователем (applyClipPath перевесит)
        if (shim._clipSrc && shim._clipSrc._maskG && shim._clipSrc._maskG.parent !== shim._layer.node) {
            const layer = shim._layer || layers[2]
            layer.node.addChild(shim._clipSrc._maskG)
        }
    }
    // копии свечения/теней переезжают вместе с узлом (drag перебрасывает иконку в слой)
    mountShadowCopies(shim)
    return shim
}
function detachShim(shim) {
    shim.parent = null
    if (shim.node && shim.node.parent) shim.node.parent.removeChild(shim.node)
    removeShadowCopies(shim)
}
function destroyShimNode(shim) {
    if (shim._dead) return
    shim._dead = 1
    if (shim.kind === "clip" && shim._maskG) {
        // пользователи теряют маску (пересоздаются на новом этаже — как в SVG)
        for (const u of shim._maskUsers || []) if (u.node) u.node.mask = null
        if (shim._maskG.parent) shim._maskG.parent.removeChild(shim._maskG)
        shim._maskG.destroy()
    }
    // пользователь клипа умирает: если клип без пользователей — маска уходит с дерева
    if (shim._clipSrc) {
        const users = shim._clipSrc._maskUsers
        const i = users ? users.indexOf(shim) : -1
        if (i !== -1) users.splice(i, 1)
        if (users && users.length === 0 && shim._clipSrc._maskG && shim._clipSrc._maskG.parent) {
            shim._clipSrc._maskG.parent.removeChild(shim._clipSrc._maskG)
        }
        shim._clipSrc = null
    }
    removeShadowCopies(shim)
    if (shim.node) shim.node.destroy({ children: true })
}

// ----------------------------------------------------------------------------
// Pixi-события → DOM-подобные вызовы
// ----------------------------------------------------------------------------
function wrapEvt(nativeOrFederated, targetShim) {
    const src = nativeOrFederated || {}
    const client = src.client || src
    const cx = client.x !== undefined ? client.x : src.clientX || 0
    const cy = client.y !== undefined ? client.y : src.clientY || 0
    return {
        target: targetShim,
        currentTarget: targetShim,
        clientX: cx, clientY: cy,
        buttons: src.buttons !== undefined ? src.buttons : 1,
        button: src.button !== undefined ? src.button : 0,
        deltaY: src.deltaY,
        repeat: false,
        code: src.code,
        key: src.key,
        isConnected: true,
        // ВАЖНО: НЕ прокидываем preventDefault/stopPropagation в нативное событие.
        // Игра вызывает ev.preventDefault() в обработчиках mousedown (ползунок настроек,
        // полосы прокрутки журнала/библиотеки) — в DOM-SVG это было безвредно, но у
        // нативного pointerdown отмена preventDefault'ом подавляет ВСЕ совместимые
        // события мыши до pointerup: document-mousemove/mouseup игрых мертвы, ползунок
        // «прилипал» к курсору (mouseup не доходил, document-слушатели не снимались)
        preventDefault() {},
        stopPropagation() {},
    }
}
function wirePixiEvents(shim) {
    const n = shim.node
    // DOM-мост: Pixi-события дублируются в _listeners под DOM-именами — addEventListener
    // на шимах (ползунки настроек/журнала/библиотеки, drag предметов, мини-карта,
    // glow-кнопки) жил на mouseenter/mousedown/click и БЕЗ него эти механики мертвы
    n.on("pointertap", e => {
        shim._onclick && shim._onclick(wrapEvt(e, shim))
        fire(shim, "click", e, shim)
    })
    n.on("pointerover", e => {
        shim._over && shim._over(wrapEvt(e, shim))
        fire(shim, "mouseover", e, shim)
        fire(shim, "mouseenter", e, shim)
    })
    n.on("pointerout", e => {
        shim._out && shim._out(wrapEvt(e, shim))
        fire(shim, "mouseout", e, shim)
        fire(shim, "mouseleave", e, shim)
    })
    n.on("pointerdown", e => {
        shim._down && shim._down(wrapEvt(e, shim))
        fire(shim, "mousedown", e, shim)
        // dblclick-детект (Pixi v8 не эмитит dblclick сам)
        const now = performance.now()
        if (now - (shim._lastTap || 0) < 350) fire(shim, "dblclick", e, shim)
        shim._lastTap = now
    })
    n.on("pointerup", e => {
        shim._up && shim._up(wrapEvt(e, shim))
        fire(shim, "mouseup", e, shim)
    })
    n.on("pointermove", e => {
        shim._move && shim._move(wrapEvt(e, shim))
        fire(shim, "mousemove", e, shim)
    })
    n.on("rightclick", e => { fire(shim, "contextmenu", e, shim) })
}
function fire(shim, type, e, target) {
    const arr = shim._listeners && shim._listeners.get(type)
    if (arr) for (const fn of arr.slice()) fn(wrapEvt(e, target))
}

// ----------------------------------------------------------------------------
// Фабрики примитивов (вызывает svg.js-фасад)
// ----------------------------------------------------------------------------
function baseInteractive(shim, obj) {
    if (!obj) return
    if (obj.id !== undefined) { shim.attrs.id = obj.id; if (obj.id !== "" ) shimById.set(String(obj.id), shim) }
    if (obj.opacity !== undefined) { shim.attrs.opacity = obj.opacity; shim.node.alpha = +obj.opacity }
    if (obj.blur) applyDropShadow(shim, String(obj.blur).replace(/^filter:\s*/, ""))
    if (obj.func) shim._onclick = obj.func
    if (obj.funcShow) { shim._over = obj.funcShow; if (obj.funcShowOut) shim._out = obj.funcShowOut }
    if (obj.hoverOpa) {
        const base = obj.hoverOpa
        shim.node.alpha = base
        shim._over = () => { shim.node.alpha = 1 }
        shim._out = () => { shim.node.alpha = base }
    }
    if (obj.glow) wireGlow(shim, obj)
    // ОДНА синхронизация В КОНЦЕ: обработчики уже присвоены. Раньше sync шёл первым —
    // want считался по пустым полям, _interactive оставался 0, pointertap-слушатели
    // не вешались: клики по rect-чекбоксам/полосам громкости были мертвы
    shim._syncInteractive()
}
// glow-подсветка кнопок (hover): золотое свечение через силуэтные копии
function wireGlow(shim, obj) {
    if (location.search.includes("noglow")) return // отладочная бисекция зависания WebGPU
    const glowNodes = obj.glowNodes || []
    const specs = [
        { blur: 8, color: "rgba(255,214,140,0.95)" },
        { blur: 3, color: "rgb(204,153,102)" },
    ]
    const specStr = "drop-shadow(0 0 8px rgba(255,214,140,0.95)) drop-shadow(0 0 3px rgb(204,153,102))"
    shim.node.eventMode = "static"
    if (!shim._wired) { shim._wired = 1; wirePixiEvents(shim) }
    shim.node.on("pointerover", () => { applyDropShadow(shim, specStr); for (const g of glowNodes) applyDropShadow(g, specStr) })
    shim.node.on("pointerout", () => { applyDropShadow(shim, ""); for (const g of glowNodes) applyDropShadow(g, g._styleRaw && /filter/.test(g._styleRaw) ? /filter:\s*([^;]+)/.exec(g._styleRaw)[1] : "") })
    if (obj.hoverFill && obj.hoverFillNodes) {
        const nodes = obj.hoverFillNodes
        shim.node.on("pointerover", () => { for (const t of nodes) { t._fillPrev = t.attrs.fill; t.setAttribute("fill", obj.hoverFill) } })
        shim.node.on("pointerout", () => { for (const t of nodes) t.setAttribute("fill", t._fillPrev || "") })
    }
}

function createImage(place, x, y, w, h, src, obj = {}) {
    const sprite = new PIXI.Sprite()
    const shim = new ShimEl("image", sprite)
    const wN = num(w), hN = num(h)
    shim.attrs.x = num(x); shim.attrs.y = num(y); shim.attrs.width = wN; shim.attrs.height = hN
    // ВАЖНО: texture ДО width/height — width-сеттер делит на ширину текстуры, при
    // пустой (0) он даёт scale=1 и размер игнорируется: картинка рисовалась в
    // НАТИВНОМ размере файла (тени 30px вместо ~14, кнопки 208px вместо 500px)
    sprite.texture = getTexture(String(src))
    if (sprite.texture === PIXI.Texture.EMPTY) registerPending(String(src), shim)
    sprite.position.set(num(x), num(y))
    sprite.width = wN; sprite.height = hN
    shim.attrs.href = String(src)
    // контракт svg.js: id статичных картинок хранится С суффиксом «I» (getElementById
    // в game-коде ищет именно «…I»: expBarI/hpBarI — полосы ХП/опыта и т.д.)
    const idVal = obj.id
    const objNoId = idVal !== undefined ? Object.assign({}, obj, { id: undefined }) : obj
    baseInteractive(shim, objNoId)
    // картинки без обработчиков тоже ПЕРЕХВАТЫВАЮТ клики (visiblePainted): панель
    // настроек не должна пропускать клики к кнопкам меню под собой
    shim._syncInteractive()
    shim.setAttribute("id", idVal !== undefined ? String(idVal) + "I" : "")
    // двойной клик/правый клик — надеть/снять предмет (doubleClickItem из drag.js);
    // в SVG это были addEventListener("dblclick"/"contextmenu") на элементе
    if (obj.funcDbl) {
        shim.addEventListener("dblclick", () => obj.funcDbl(obj.item))
        shim.addEventListener("contextmenu", () => obj.funcDbl(obj.item))
        shim._syncInteractive()
    }
    if (obj.funcDrag) draggableShim(shim, obj.funcDrag, obj.item)
    if (obj.borderColor) applyOutline(shim, "2px solid " + obj.borderColor)
    place.appendChild(shim)
    applyPixelated()
    return shim
}

function createAnimImage(place, x, y, w, h, src, obj = {}) {
    const times = obj.times
    const n = parseInt(times)
    const wN = num(w), hN = num(h)
    // виртуальный rect (окно кадра/логическая позиция) — без Pixi-узла
    const clipRect = new ShimEl("vrect", null)
    clipRect.attrs.width = wN / n
    clipRect.attrs.height = hN
    clipRect._w = wN / n
    clipRect._h = hN
    const sprite = new PIXI.Sprite()
    const shim = new ShimEl("anim", sprite)
    shim._times = times
    shim._frameW = wN / n
    shim._clipRect = clipRect
    clipRect._img = shim
    shim.attrs.x = num(x); shim.attrs.y = num(y); shim.attrs.width = wN; shim.attrs.height = hN
    shim.attrs.href = String(src)
    const xShift = obj.frame ? (wN / n) * obj.frame : 0
    shim._shift = xShift
    clipRect.attrs.x = num(x); clipRect.attrs.y = num(y)
    clipRect._rx = num(x); clipRect._ry = num(y)
    if (obj.id !== undefined && obj.id !== "") {
        shim.attrs.id = String(obj.id) + "I"
        shimById.set(shim.attrs.id, shim)
    }
    sprite.position.set(num(x), num(y))
    shim._frames = getFrameTextures(String(src), times)
    setFrame(shim, Math.round(xShift / (wN / n)))
    sprite.width = wN / n
    sprite.height = hN
    sprite.eventMode = "none"
    applyPixelated()
    place.appendChild(shim)
    registerFrameUser(String(src), times, shim)
    // clipRect не в дереве DOM — доступ через img.clipRect (как в SVG)
    return shim
}

function createRect(place, x, y, w, h, stroke, strokeWidth, fill, obj = {}) {
    const g = new PIXI.Graphics()
    const shim = new ShimEl("rect", g)
    shim.attrs.x = num(x); shim.attrs.y = num(y); shim.attrs.width = num(w); shim.attrs.height = num(h)
    shim.attrs.stroke = stroke; shim.attrs["stroke-width"] = strokeWidth; shim.attrs.fill = fill
    if (obj.rx !== undefined) shim.attrs.rx = num(obj.rx)
    if (obj.fillOpacity !== undefined) shim.attrs["fill-opacity"] = num(obj.fillOpacity)
    redrawRect(shim)
    baseInteractive(shim, obj)
    // eventMode (перехват кликов/интерактивность) решает _syncInteractive
    place.appendChild(shim)
    return shim
}

function createCircle(place, cx, cy, r, stroke, strokeWidth, fill, obj = {}) {
    const g = new PIXI.Graphics()
    const shim = new ShimEl("circle", g)
    shim.attrs.cx = num(cx); shim.attrs.cy = num(cy); shim.attrs.r = num(r)
    shim.attrs.stroke = stroke; shim.attrs["stroke-width"] = strokeWidth; shim.attrs.fill = fill
    redrawCircle(shim)
    baseInteractive(shim, obj)
    place.appendChild(shim)
    return shim
}

// DOM-семантика textContent: присвоение null/undefined даёт ПУСТУЮ строку,
// а не текст "undefined" (игра создаёт тексты с T(undefined) — подсказки
// способностей: внизу фрейма рисовалось слово «undefined»)
function domText(v) { return v === undefined || v === null ? "" : String(v) }

function createTextEl(place, x, y, w, h, stroke, strokeWidth, fill, textContent, obj = {}) {
    const t = new PIXI.Text({ text: domText(textContent) })
    const shim = new ShimEl("text", t)
    shim._textOpts = obj
    shim.attrs.x = num(x); shim.attrs.y = num(y)
    shim.attrs.stroke = stroke; shim.attrs["stroke-width"] = strokeWidth; shim.attrs.fill = fill
    shim.attrs["font-size"] = obj.size || 24
    shim.attrs["font-family"] = obj.font || "baseFont2"
    shim.attrs["text-anchor"] = obj.anchor || "start"
    shim.attrs["#text"] = domText(textContent)
    if (obj.id !== undefined) { shim.attrs.id = obj.id; if (obj.id !== "") shimById.set(String(obj.id), shim) }
    applyTextStyle(shim)
    if (obj.funcShow) { shim._over = obj.funcShow; if (obj.funcShowOut) shim._out = obj.funcShowOut }
    if (obj.func) shim._onclick = obj.func
    if (obj.hover) {
        // hover на тексте: стиль переписывается строкой с сохранением paint-order (V60)
        shim._over = () => { applyStyleString(shim, "user-select:none; paint-order: stroke;" + obj.hover) }
        shim._out = () => { applyStyleString(shim, "user-select:none; paint-order: stroke;") }
    }
    if (obj.blur) applyDropShadow(shim, String(obj.blur).replace(/^filter:\s*/, ""))
    shim._syncInteractive()
    place.appendChild(shim)
    return shim
}

function stripHtml(html) {
    return String(html)
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]*>/g, "")
        .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
}
function createTextHtml(place, x, y, w, h, stroke, strokeWidth, fill, textContent, obj = {}) {
    const t = new PIXI.Text({ text: stripHtml(domText(textContent)) })
    const shim = new ShimEl("html", t)
    shim._textOpts = obj
    shim.attrs.x = num(x); shim.attrs.y = num(y); shim.attrs.width = num(w); shim.attrs.height = num(h)
    shim.attrs.stroke = stroke; shim.attrs["stroke-width"] = strokeWidth; shim.attrs.fill = fill
    shim.attrs["font-size"] = obj.size || 24
    shim.attrs["font-family"] = obj.font || "baseFont2"
    shim.attrs["text-anchor"] = obj.anchor || "start"
    shim.attrs["#text"] = stripHtml(domText(textContent))
    if (obj.id !== undefined) { shim.attrs.id = obj.id; if (obj.id !== "") shimById.set(String(obj.id), shim) }
    applyTextStyle(shim)
    if (obj.func) shim._onclick = obj.func
    if (obj.hover) {
        shim._over = () => { if (shim.node) shim.node.alpha = 0.85 }
        shim._out = () => { if (shim.node) shim.node.alpha = 1 }
    }
    if (obj.blur) applyDropShadow(shim, String(obj.blur).replace(/^filter:\s*/, ""))
    shim._syncInteractive()
    place.appendChild(shim)
    return shim
}

function createPath(place, obj, fill) {
    const g = new PIXI.Graphics()
    const shim = new ShimEl("path", g)
    shim.attrs.d = obj.d
    if (obj.id) { shim.attrs.id = obj.id; shimById.set(String(obj.id), shim) }
    if (obj.x !== undefined) shim.attrs.x = obj.x
    if (obj.y !== undefined) shim.attrs.y = obj.y
    if (fill) shim.attrs.fill = fill
    redrawPath(shim)
    // eventMode решает _syncInteractive: залитый path перехватывает клики (visiblePainted)
    shim._syncInteractive()
    place.appendChild(shim)
    if (obj.clipPath) {
        // окно-клип [w,h] вокруг (x,y) — как svg.js createPath
        const clip = new ShimEl("clip", null)
        makeClipMask(clip)
        clip.attrs.id = obj.id + "PV"
        shimById.set(obj.id + "PV", clip)
        const cr = new ShimEl("cliprect", null)
        cr.attrs.x = obj.x - obj.clipPath[0] / 2
        cr.attrs.y = obj.y - obj.clipPath[1] / 2
        cr.attrs.width = obj.clipPath[0]
        cr.attrs.height = obj.clipPath[1]
        cr.parent = clip
        clip.children.push(cr)
        updateClipMask(clip)
        shim.setAttribute("clip-path", "url(#" + obj.id + "PV)")
    }
    return shim
}

function createGroup(place) {
    const c = new PIXI.Container()
    const shim = new ShimEl("group", c)
    c.eventMode = "static" // дети сами решают (интерактивные узлы внутри групп)
    place.appendChild(shim)
    return shim
}

function createElementNS(tag, place) {
    // перехват document.createElementNS(SVG_NS, tag) — 6 игровых файлов создают
    // clipPath/rect/defs/g/polygon напрямую (start/takeDamage/hpBar/journal/library/minimapFx)
    switch (tag) {
        case "clipPath": {
            const shim = new ShimEl("clip", null)
            makeClipMask(shim)
            return shim
        }
        case "rect": {
            // rect внутри clipPath — клип-окно: чистые атрибуты без Pixi-узла
            // (createElementNS("…rect") в игре используется ТОЛЬКО внутри clipPath:
            // start/takeDamage/hpBar/journal/library)
            const shim = new ShimEl("cliprect", null)
            return shim
        }
        case "defs": {
            const shim = new ShimEl("defs", null) // виртуальный контейнер (без Pixi-узла)
            return shim
        }
        case "g": return createGroup(layers[2])
        case "polygon": {
            const g = new PIXI.Graphics()
            const shim = new ShimEl("poly", g)
            g.eventMode = "static"
            return shim
        }
        case "svg": {
            return layers[2] || null
        }
        default: {
            warnOnce("ns" + tag, "createElementNS: тег " + tag + " не поддержан — заглушка group")
            return createGroup(layers[2])
        }
    }
}

// ----------------------------------------------------------------------------
// Drag&drop (контракт svg.js: draggable/beginDrag/moveDrag/endDrag)
// ----------------------------------------------------------------------------
let dragSelected = null
let dragData = null
const dragMap = new WeakMap()
function draggableShim(shim, funcDrag, item) {
    dragMap.set(shim, { funcDrag, item })
    shim.addEventListener("mousedown", e => {
        beginDragShim(e.target, funcDrag, item, e.clientX, e.clientY)
    })
}
function dragClientToView(cx, cy) {
    const ctm = layers[2].getScreenCTM()
    return { x: (cx - ctm.e) / ctm.a, y: (cy - ctm.f) / ctm.d }
}
function beginDragShim(shim, funcDrag, item, clientX, clientY) {
    applyDropShadow(shim, "filter: drop-shadow(0 0 6px rgba(255, 255, 204, 0.8))")
    dragSelected = shim
    const pos = dragClientToView(clientX, clientY)
    const ox = +shim.attrs.x || 0, oy = +shim.attrs.y || 0
    dragData = { funcDrag, item, origX: ox, origY: oy, lifted: false, offX: pos.x - ox, offY: pos.y - oy }
    if (backendHooks.tipDel) backendHooks.tipDel()
}
function moveDragShim(cx, cy) {
    if (!dragSelected) return
    if (dragData && !dragData.lifted) {
        layers[2].append(dragSelected)
        dragData.lifted = true
    }
    const pos = dragClientToView(cx, cy)
    dragSelected.setAttribute("x", pos.x - dragData.offX)
    dragSelected.setAttribute("y", pos.y - dragData.offY)
}
function endDragShim(shim, clientX, clientY) {
    if (!dragSelected) return
    const el = dragSelected
    const data = dragData
    dragSelected = null
    dragData = null
    applyDropShadow(el, "")
    el._styleRaw = "none"
    // реальные клиентские координаты отпускания (как у mouseup в SVG): часть вызовов
    // funcDrag читает evt.clientX/clientY
    data.funcDrag({ target: el, clientX: clientX || 0, clientY: clientY || 0 }, data.item, data.origX, data.origY)
}
// контейнер перетаскиваемых данных для фасада
const backendHooks = { tipDel: null }

// Pointer-поток для drag: слушаем канвас один раз (drag активен только с зажатым элементом)
function installDragListeners() {
    const cv = app.canvas
    cv.addEventListener("pointermove", e => {
        if (dragSelected && e.buttons === 1) {
            e.preventDefault()
            moveDragShim(e.clientX, e.clientY)
        }
    })
    cv.addEventListener("pointerup", e => { if (dragSelected) endDragShim(dragSelected, e.clientX, e.clientY) })
}

// ----------------------------------------------------------------------------
// Хит-тест UI-слоя (elementFromPoint для геймпад-кликов)
// ----------------------------------------------------------------------------
function hitTestUI(cx, cy) {
    function walk(shim) {
        const ch = shim.children
        for (let i = ch.length - 1; i >= 0; i--) {
            const c = ch[i]
            if (!c.node || !c.node.visible || c.node.alpha === 0) continue
            if (c.kind === "defs" || c.kind === "clip") continue
            const deep = walk(c)
            if (deep) return deep
            if (c._interactive) {
                const b = c.node.getBounds()
                // NaN/бесконечные bounds (сломанная геометрия) — не хит
                if (!isFinite(b.x) || !isFinite(b.width)) continue
                if (cx >= b.x && cx <= b.x + b.width && cy >= b.y && cy <= b.y + b.height) return c
            }
        }
        return null
    }
    return walk(layers[2])
}

// ----------------------------------------------------------------------------
// Слои
// ----------------------------------------------------------------------------
function makeLayerShim(index, node) {
    const c = node || new PIXI.Container()
    c.eventMode = "static"
    c.interactiveChildren = true
    const shim = new ShimEl("layer", c)
    // removeChild на СЛОЕ — путь очистки сцены (del.js: while firstChild removeChild):
    // шим отсоединяется и его Pixi-узел уничтожается (иначе утечка GPU между этажами).
    // ВАЖНО: text/html НЕ уничтожаются — игровые пулы (floatText и др.) переиспользуют
    // свои шимы ПОСЛЕ del(): уничтоженный PIXI.Text, вставленный пулом обратно в дерево,
    // валил рендер каждый кадр («null._x» в updateLocalTransform) — чёрный экран
    shim.removeChild = child => {
        const i = shim.children.indexOf(child)
        if (i !== -1) {
            shim.children.splice(i, 1)
            detachShim(child)
            if (child.kind !== "text" && child.kind !== "html") destroyShimNode(child)
        }
        return child
    }
    shim._vb = index === 2 ? uiVB : cameraVB
    Object.defineProperty(shim, "viewBox", {
        get() { return { animVal: shim._vb } },
    })
    shim._onResize = () => { uiCTM = null }
    shim.getScreenCTM = () => {
        if (index === 2) {
            if (!uiCTM) {
                const s = windowSize.wt / uiVB.width
                uiCTM = { a: s, b: 0, c: 0, d: s, e: 0, f: 0 }
            }
            return uiCTM
        }
        const s = windowSize.wt / cameraVB.width
        return { a: s, b: 0, c: 0, d: s, e: -cameraVB.x * s, f: -cameraVB.y * s }
    }
    shim.createSVGPoint = () => ({
        x: 0, y: 0,
        matrixTransform(m) { return { x: this.x * m.a + this.y * m.c + m.e, y: this.x * m.b + this.y * m.d + m.f } },
    })
    shim.querySelector = sel => {
        if (sel === "defs") {
            let defs = shim.children.find(ch => ch.kind === "defs")
            if (!defs) {
                defs = new ShimEl("defs", null)
                shim.appendChild(defs)
            }
            return defs
        }
        return shim.children.find(ch => ch.attrs.id === sel.replace("#", "")) || null
    }
    return shim
}

// ----------------------------------------------------------------------------
// Установка бэкенда (index.js: после await init())
// ----------------------------------------------------------------------------
function setupBackend(engineApi) {
    app = engineApi.app
    worldContainer = engineApi.worldContainer
    recalcWindowSize()
    // Pixi по умолчанию делает preventDefault на нативном pointerdown — браузер в ответ
    // подавляет ВСЕ совместимые события мыши до pointerup, и document-слушатели игры
    // (перетаскивание ползунков/полос прокрутки) не получают ни mousemove, ни mouseup.
    // Канвас на всю страницу, прокрутки/выделения нет — отключаем безопасно
    app.renderer.events.autoPreventDefault = false
    // Pixi v8 делает app.stage корневым renderGroup по умолчанию; в 8.19 сочетание
    // этого кэша инструкций со stencil-масками (clipPath полос ХП/опыта) ломает
    // отрисовку sibling-ветки: worldContainer перестаёт рисоваться (чёрный экран
    // при живом HUD) после первого changeHP. Сняем renderGroup — маски и мир
    // сосуществуют корректно
    app.stage.renderGroup = null
    // слои камеры поверх particleContainer движка (не используется игрой)
    layerNodes = [new PIXI.Container(), new PIXI.Container(), new PIXI.Container()]
    worldContainer.addChild(layerNodes[0])
    worldContainer.addChild(layerNodes[1])
    app.stage.addChild(layerNodes[2])
    layers = [makeLayerShim(0, layerNodes[0]), makeLayerShim(1, layerNodes[1]), makeLayerShim(2, layerNodes[2])]
    for (let i = 0; i < 3; i++) layers[i]._layer = layers[i]
    applyCamera()
    installDragListeners()
    window.addEventListener("resize", onWindowResize)
    // перехват DOM: createElementNS (SVG NS), getElementById (шим-реестр), elementFromPoint
    const nativeCreateElementNS = document.createElementNS.bind(document)
    const nativeGetElementById = document.getElementById.bind(document)
    const nativeElementFromPoint = document.elementFromPoint.bind(document)
    document.createElementNS = (ns, tag) => {
        if (ns === SVG_NS) {
            if (tag === "rect") {
                // rect в игре создаётся через NS ТОЛЬКО внутри clipPath — клип-окно:
                // чистые атрибуты без Pixi-узла, маску двигает updateClipMask
                return new ShimEl("cliprect", null)
            }
            return createElementNS(tag)
        }
        return nativeCreateElementNS(ns, tag)
    }
    document.getElementById = id => nativeGetElementById(id) || shimById.get(id) || null
    document.elementFromPoint = (x, y) => hitTestUI(x, y) || nativeElementFromPoint(x, y)
    // отладочный хендл (консоль браузера): сцена, слои, реестры
    window.__BACKEND = {
        app, worldContainer, layerNodes, layers, texCache, frameCache,
        shimById, spritePool, cameraVB, windowSize: () => windowSize,
    }
}

// svg(3): создать слои (вызывает svg.js-фасад)
function createLayers(num) {
    for (let i = 0; i < num; i++) if (!layers[i]) { layers[i] = makeLayerShim(i); layers[i]._layer = layers[i] }
    return layers
}

// ----------------------------------------------------------------------------
// Позиционирование/пул (контракт svg.js)
// ----------------------------------------------------------------------------
function spritePos(img, x, y) {
    if (!img) return
    if (img.kind === "anim") {
        const cr = img._clipRect
        if (cr._rx !== x) { cr._rx = x; cr.setAttribute("x", x) }
        if (cr._ry !== y) { cr._ry = y; cr.setAttribute("y", y) }
        const ix = x - (img._shift || 0)
        if (img._lx !== ix) { img._lx = ix; img.setAttribute("x", ix) }
        if (img._ly !== y) { img._ly = y; img.setAttribute("y", y) }
        return
    }
    if (img.kind === "vrect") {
        if (img._rx !== x) { img._rx = x; img.setAttribute("x", x) }
        if (img._ry !== y) { img._ry = y; img.setAttribute("y", y) }
        return
    }
    if (img._lx !== x) { img._lx = x; img.setAttribute("x", x) }
    if (img._ly !== y) { img._ly = y; img.setAttribute("y", y) }
}
function moveSprite(img, dx, dy) {
    if (!img) return
    if (img.kind === "anim") {
        const cr = img._clipRect
        spritePos(img, cr._rx + dx, cr._ry + dy)
        return
    }
    if (img.kind === "vrect") {
        spritePos(img, img._rx + dx, img._ry + dy)
        return
    }
    spritePos(img, (+img.attrs.x || 0) + dx, (+img.attrs.y || 0) + dy)
}
function rectPos(r) {
    let x = r._rx
    if (x === null || x === undefined) {
        r._rx = +(r.attrs.x || 0)
        r._ry = +(r.attrs.y || 0)
    }
    return [r._rx, r._ry]
}

// пул анимированных шимов (контракт acquirePooled/releaseSprite)
const spritePool = new Map()
const POOL_CAP = 64
function poolKey(src, w, h, times) { return src + "|" + w + "|" + h + "|" + times }
function acquirePooled(place, w, h, src, obj) {
    const key = poolKey(src, w, h, obj.times)
    const bucket = spritePool.get(key)
    const e = bucket && bucket.pop()
    if (e && !e.img.node.destroyed) {
        // реанимация слота: новые атрибуты, чистые слушатели/стили (как acquirePooled в SVG)
        const shim = e.img
        shim._dead = 0
        shim._onclick = null; shim._over = null; shim._out = null; shim._down = null; shim._up = null
        shim._listeners = null
        shim._interactive = 0
        shim.node.eventMode = "none"
        applyDropShadow(shim, "")
        shim._styleRaw = undefined
        const cr = shim._clipRect
        cr._dead = 0
        cr._rx = null; cr._ry = null
        shim._lx = null; shim._ly = null
        // обновить геометрию/лист
        const n = parseInt(obj.times)
        shim._times = obj.times
        shim._frameW = w / n
        shim.attrs.width = w; shim.attrs.height = h
        cr.attrs.width = w / n; cr.attrs.height = h
        cr._w = w / n; cr._h = h
        if (shim.attrs.href !== String(src)) {
            shim.attrs.href = String(src)
            shim._frames = getFrameTextures(String(src), obj.times)
            shim._still = undefined
        }
        shim._shift = 0
        if (obj.id !== undefined) { shim.attrs.id = String(obj.id) + "I"; shimById.set(shim.attrs.id, shim) }
        place.appendChild(shim)
        return shim
    }
    const shim = createAnimImage(place, 0, 0, w, h, src, obj)
    shim._slot = { key, img: shim, clipRect: shim._clipRect }
    return shim
}
function releaseSprite(img) {
    if (!img) return
    const slot = img._slot
    if (slot) {
        img._slot = null
        img._pooled = 1 // шим принадлежит пулу: повторные release НЕ уничтожают узел
        if (img.parent) img.parent.removeChild(img)
        img.node.visible = true
        const bucket = spritePool.get(slot.key)
        if (bucket && bucket.length >= POOL_CAP) { destroyShimNode(img); return }
        bucket ? bucket.push(slot) : spritePool.set(slot.key, [slot])
        return
    }
    // ИДЕМПОТЕНТНОСТЬ: шим уже возвращён в пул (двойной release через реестры модулей —
    // dashFx/charmFx и del.js) — уничтожать узел нельзя, слот в бакете ссылается на него
    if (img._pooled) return
    if (img.parent) img.parent.removeChild(img)
    destroyShimNode(img)
}

// ============================================================================
// Экспорт
// ============================================================================
export {
    setupBackend, createLayers, windowSize, layers,
    createImage, createAnimImage, acquirePooled, releaseSprite,
    createRect, createCircle, createTextEl, createTextHtml, createPath, createGroup,
    spritePos, moveSprite, rectPos, getCTMExport, applyPixelated, cameraView,
    preloadGameTextures, backendHooks, dragState,
    installGameTicks, gameTickSystem,
}
function getCTMExport() {
    return layers[2] ? layers[2].getScreenCTM() : null
}
// окно камеры игровых слоёв (viewBox слоёв 0/1) — читает ecsRenderSync каждый кадр
function cameraView() {
    return cameraVB
}
function dragState() {
    return {
        start: (shim, cx, cy) => { /* через draggableShim */ },
        move: (cx, cy) => moveDragShim(cx, cy),
        end: () => endDragShim(dragSelected),
        isDragging: () => dragSelected !== null,
        startAt: (cx, cy) => {
            const el = hitTestUI(cx, cy)
            if (el) {
                const data = dragMap.get(el)
                if (data) { beginDragShim(el, data.funcDrag, data.item, cx, cy); return true }
            }
            return false
        },
    }
}
// тики игры (фиксированный шаг 16мс) — регистрируется index.js через engine.addSystem
let _gameTick = null
let lastTick = 0
let tickAcc = 0
function installGameTicks(fn) { _gameTick = fn }
function gameTickSystem() {
    if (!_gameTick) return
    const ts = performance.now()
    if (lastTick === 0) lastTick = ts
    tickAcc += ts - lastTick
    lastTick = ts
    if (tickAcc > 100) tickAcc = 16
    while (tickAcc >= 16) {
        tickAcc -= 16
        // V11-гарантия оригинала: исключение в gameLoop не убивает цикл (в SVG-версии
        // rAF планировался ДО логики). Здесь — try/catch: рвёт ли цепочку тикера Pixi,
        // чтобы ошибка одного тика не останавливала все следующие кадры.
        try {
            _gameTick()
        } catch (e) {
            console.error("[gameTick] исключение в тике игры:", e)
            window.__tickError = String(e && e.stack || e).slice(0, 1200)
        }
    }
}
