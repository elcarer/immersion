import { svgArr, image, rectPos } from "../scripts/svg.js"
import { status } from "../scripts/start.js"
import { objectValues } from "../scripts/del.js"

// ---------- V80: наземные тени (ground shadows) ----------
// Мягкий эллипс shadowPool.png (30×12) под hero/enemy/pet и статичными объектами карты.
// Ширина тени пропорциональна ширине спрайта (85%), непрозрачность 0.35; V80a: центр лужи
// поднят на полвысоты и совпадает с линией ног (нижняя кромка окна кадра), нижний край
// лужи на 2px заходит под спрайт. Тень сущности вставляется в DOM ПЕРЕД img владельца: любые
// последующие append'ы спрайтов (checkZOrder) всегда рисуются НАД тенями. Тени трупов
// (враг после смерти) остаются лежать со спрайтом до смены сцены. Отключаются галочкой
// «Отключение теней» в Настройках (status.settings.noShadows, слот settings, saveSettings).
// Именование: поле сущности entShadow (имя shadowFx занято механикой «Тёмного воина»).

const SHADOW_SRC = "./images/effects/shadowPool.png"
const SHADOW_WK = 0.85        // ширина тени от ширины спрайта
const SHADOW_OPACITY = "0.35"
const SHADOW_FEET_OVERLAP = 2 // тень чуть заходит под нижнюю кромку спрайта

// реестр теней сущностей: труп не в objectValues, но запись держит его тень до reset;
// записи переживают выкл/вкл галочки — по ним пересоздаются и трупные тени (V80a)
let entShadows = []
// тени статичных объектов: host-спрайт (screenPic) -> узел тени; список хостов —
// для пересоздания теней при включении галочки посреди этажа
let objShadows = new Map()
let objShadowHosts = []

function shadowsOn() {
    return !status.settings.noShadows
}

function makeShadowNode(rx, ry, rw, rh) {
    const w = Math.max(8, Math.round(rw * SHADOW_WK))
    const h = Math.max(4, Math.round(w * 12 / 30))
    const x = rx + rw / 2 - w / 2
    const y = ry + rh + SHADOW_FEET_OVERLAP - h
    const node = image(svgArr[1], x, y, w, h, SHADOW_SRC, { opacity: SHADOW_OPACITY })
    node._sx = x
    node._sy = y
    node._sw = w
    node._sh = h
    return node
}

// запись атрибутов только при реальном изменении — тот же принцип, что spritePos
function moveShadowNode(node, x, y) {
    if (node._sx !== x) { node._sx = x; node.setAttribute("x", x) }
    if (node._sy !== y) { node._sy = y; node.setAttribute("y", y) }
}

function attachEntityShadow(ent) {
    const r = ent.rect
    // размер кадра сущности постоянен (пул слотов по src|w|h|times, смена позы не меняет
    // worldRect) — геометрия тени кэшируется один раз при привязке
    const rw = r.width.animVal.value
    const rh = r.height.animVal.value
    const p = rectPos(r)
    const node = makeShadowNode(p[0], p[1], rw, rh)
    ent.img.parentNode.insertBefore(node, ent.img)
    ent.entShadow = node
    entShadows.push({ node, ent, rw, rh })
}

// пересоздание узла тени по готовой записи — применение галочки ON посреди этажа: труп
// не в objectValues, shadowTick его не достроит, поэтому восстанавливаем по записи
function reattachEntityShadow(e) {
    const ent = e.ent
    if (!ent || ent.entShadow || !ent.rect || !ent.img || !ent.img.isConnected) return
    const p = rectPos(ent.rect)
    const node = makeShadowNode(p[0], p[1], e.rw, e.rh)
    ent.img.parentNode.insertBefore(node, ent.img)
    ent.entShadow = node
    e.node = node
}

// тик из gameLoop (после всех шагов движения за тик): достройка недостающих теней +
// синхронизация по кэшу rectPos (DOM-чтений нет; запись — только при сдвиге)
function shadowTick() {
    if (!shadowsOn()) return
    const n = objectValues.length
    for (let i = 0; i < n; i++) {
        const o = objectValues[i]
        if (!o || !o.img || !o.rect || o.entShadow) continue
        if (o.type !== "hero" && o.type !== "enemy" && o.type !== "pet") continue
        attachEntityShadow(o)
    }
    for (let i = 0; i < entShadows.length; i++) {
        const e = entShadows[i]
        const r = e.ent && e.ent.rect
        if (!r) continue
        const p = rectPos(r)
        moveShadowNode(e.node,
            p[0] + e.rw / 2 - e.node._sw / 2,
            p[1] + e.rh + SHADOW_FEET_OVERLAP - e.node._sh)
    }
}

function addObjShadow(host) {
    const node = makeShadowNode(host.x.animVal.value, host.y.animVal.value,
        host.width.animVal.value, host.height.animVal.value)
    host.parentNode.insertBefore(node, host)
    objShadows.set(host, node)
}

// тень статичного объекта карты (createRoom); при выключенных тенях хост запоминается —
// галочка, включённая посреди этажа, достроит тени без пересборки сцены
function objectShadow(host) {
    objShadowHosts.push(host)
    shadowsOn() && addObjShadow(host)
}

function removeObjShadow(host) {
    const node = objShadows.get(host)
    if (node) {
        node.remove()
        objShadows.delete(host)
    }
}

// мгновенное применение галочки «Отключение теней» (Настройки, в том числе посреди забега)
function applyGroundShadows() {
    if (shadowsOn()) {
        for (let i = 0; i < objShadowHosts.length; i++) {
            const host = objShadowHosts[i]
            if (host.isConnected && !objShadows.has(host)) addObjShadow(host)
        }
        // записи сущностей восстанавливаем здесь же: живых достроил бы и shadowTick,
        // но труп не в objectValues — его поднимает только этот проход (V80a)
        for (let i = 0; i < entShadows.length; i++) reattachEntityShadow(entShadows[i])
    } else {
        objShadows.forEach(node => node.remove())
        objShadows.clear()
        // узлы снимаются, ent.entShadow сбрасывается, но ЗАПИСИ сохраняются — обратное
        // включение достроит тени по ним же, в том числе трупам (V80a)
        for (let i = 0; i < entShadows.length; i++) {
            entShadows[i].node.remove()
            entShadows[i].ent && (entShadows[i].ent.entShadow = undefined)
        }
    }
}

// смена сцены (del.js): сами узлы снесены очисткой svgArr[1] — остаются только реестры
function resetGroundShadows() {
    entShadows.length = 0
    objShadows.clear()
    objShadowHosts.length = 0
}

//V85: сущность исчезает без трупа (деление Медузы пустоты) — её тень снимается с пола
//и убирается из реестра, чтобы shadowTick не двигал отвязанный узел
function removeEntShadow(ent) {
    for (let i = entShadows.length - 1; i >= 0; i--) {
        if (entShadows[i].ent !== ent) continue
        entShadows[i].node.remove()
        entShadows.splice(i, 1)
    }
    ent.entShadow = undefined
}

export { shadowTick, objectShadow, removeObjShadow, applyGroundShadows, resetGroundShadows, removeEntShadow }
