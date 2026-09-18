// E-18: волна фиксов по репорту пользователя:
// (1) красное свечение ярости босса (RAGE_FILTER → tint+тень в pixiBackend; прежняя
//     CSS-строка sepia/saturate/hue-rotate бэкендом молча не применялась),
// (2) тулип предмета гаснет при захвате drag'ом (backendHooks.tipDel),
// (3) рамка редкости едет вместе со спрайтом при drag (и возвращается при провале),
// (4) босс строит путь к герою по ВСЕМУ этажу (boss-карта) — урон магией сквозь стены
//     больше не оставляет его стоять в неоткрытой комнате; обычные враги — как раньше (E-9b).
// Чистки: атаки 15–24 без мёртвого img; belt clamp на food/14.png; normMeta добивает
// obtainedRelics до 7 слотов.
import { connect } from "./cdp.mjs"
import { writeFileSync } from "fs"

const S = (ms) => new Promise(r => setTimeout(r, ms))
const conn = await connect()
const send = conn.send
await send("Page.enable", {})
await send("Runtime.enable", {})
const ev = (e, ap = false) => send("Runtime.evaluate", { expression: e, awaitPromise: ap, returnByValue: true })
  .then(r => { if (r.exceptionDetails) throw new Error("eval: " + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || "").slice(0, 800)); return r.result.value })
const shot = async (name) => {
  const r = await send("Page.captureScreenshot", { format: "png" })
  writeFileSync(`D:/ZCode/project2/shots/${name}.png`, Buffer.from(r.data, "base64"))
}
const clickAt = async (x, y) => {
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none", buttons: 0, pointerType: "mouse" })
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1, pointerType: "mouse" })
  await S(60)
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1, pointerType: "mouse" })
  await S(400)
}
const dragTo = async (x0, y0, x1, y1) => {
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x0, y: y0, button: "none", buttons: 0, pointerType: "mouse" })
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: x0, y: y0, button: "left", buttons: 1, clickCount: 1, pointerType: "mouse" })
  await S(60)
  for (let i = 1; i <= 4; i++) {
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x0 + (x1 - x0) * i / 4, y: y0 + (y1 - y0) * i / 4, button: "left", buttons: 1, pointerType: "mouse" })
    await S(40)
  }
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: x1, y: y1, button: "left", buttons: 0, clickCount: 1, pointerType: "mouse" })
  await S(400)
}
// динамический перевод viewBox → клиентские: по ФАКТИЧЕСКОМУ getScreenCTM слоя
// (канвас прижат к левому верху, ctm.e/f = 0 — модель «центрирования» давала промах по X)
const toClient = async (gx, gy) => {
  const p = JSON.parse(await ev(`(function(){
    const ctm = window.__BACKEND.layers[2].getScreenCTM()
    return JSON.stringify({ x: Math.round(${gx} * ctm.a + ctm.e), y: Math.round(${gy} * ctm.d + ctm.f) })
  })()`))
  return [p.x, p.y]
}
const uiButtons = async () => JSON.parse(await ev(`JSON.stringify(window.__BACKEND.dumpUI().filter(u => u.text && u.b).map(u => ({ t: u.text, x: Math.round((u.b.minX + u.b.maxX) / 2), y: Math.round((u.b.minY + u.b.maxY) / 2) })))`))
const clickBtn = async (t) => {
  const find = (await uiButtons()).find(b => b.t === t)
  if (!find) return false
  await clickAt(find.x, find.y)
  return true
}
const exceptions = () => conn.events
  .filter(e => e.method === "Runtime.exceptionThrown")
  .map(e => (e.params.exceptionDetails.exception && e.params.exceptionDetails.exception.description || e.params.exceptionDetails.text || "").slice(0, 300))
// живой узел слоя 2: полный обход без 250-узлового лимита dumpUI
const WALK2_FN = `() => {
  const out = []
  const walk = (s) => { for (const c of s.children) { out.push(c); walk(c) } }
  walk(window.__BACKEND.layers[2])
  return out
}`
const tipAlive = async () => ev(`(() => {
  // rect-фабрика ставит id БЕЗ суффикса «I» (тот добавляет только image-фабрика)
  const n = (${WALK2_FN})().find(n => !n._dead && n.attrs && n.attrs.id === "tip")
  return !!n
})()`)
// живой rect слоя 2 по геометрии ячейки (рамка редкости: 128×128, без заливки, не жёлтая подсветка)
const FRAME_FN = `(x, y) => (${WALK2_FN})().find(n => !n._dead && n.kind === "rect" &&
  +n.attrs.x === x && +n.attrs.y === y && +n.attrs.width === 128 && +n.attrs.height === 128 &&
  n.attrs.fill === "none" && n.attrs.stroke !== "rgb(200, 248, 9)") || null`

await send("Page.reload", { ignoreCache: true })
await S(4500)
let dollsClicked = false
for (let i = 0; i < 24; i++) {
  const st = JSON.parse(await ev(`JSON.stringify({ start: window.__ST.status.start, objs: window.__ST.objectValues.length })`))
  if (st.start === 1 && st.objs > 0) break
  const dolls = JSON.parse(await ev(`JSON.stringify(window.__BACKEND.dumpUI().filter(u => u.href && u.href.includes('doll/T1')).map(u => ({ x: Math.round((u.b.minX + u.b.maxX) / 2), y: Math.round((u.b.minY + u.b.maxY) / 2) })))`, true))
  if (dolls.length && !dollsClicked) { await clickAt(dolls[0].x, dolls[0].y); dollsClicked = true; await S(300); continue }
  if (await clickBtn("ДАЛЕЕ")) { await S(500); continue }
  if (await clickBtn("НОВАЯ ИГРА")) { await S(500); await clickBtn("ДА"); continue }
  await clickAt(382, 300); await S(400)
}
console.log("flow:", await ev(`JSON.stringify({ start: window.__ST.status.start })`))

//===== 1. юнит applyFilterString: tint(r,g,b) цветной тон, "" — сброс в белый =====
const tintUnit = await ev(`(async function(){
  const IMG = await import("./scripts/svg.js")
  const D = await import("./scripts/data.js")
  const a = D.data.enemes[4][0].anims[2].others[2]
  const img = IMG.image(IMG.svgArr[2], 100, 100, a.w, a.h, a.img, {"times":a.times,"id":"e18tint","frame":1})
  const before = img.node.tint
  img.style.filter = "tint(255,86,64) drop-shadow(0 0 7px rgba(255,40,32,0.9))"
  const red = img.node.tint
  const shadow = String(img._shadowStyleRaw || "")
  img.style.filter = ""
  const reset = img.node.tint
  // жёлтый (WINGS_FILTER валькирии)
  img.style.filter = "tint(255,224,96)"
  const yellow = img.node.tint
  // brightness — прежний контракт (силуэты/неуязвимость) не сломан
  img.style.filter = "brightness(0) drop-shadow(0 0 6px rgba(255,255,255,0.6))"
  const black = img.node.tint
  img.style.filter = ""
  img.remove()
  return JSON.stringify({ before, red, shadow: shadow.includes("rgba(255,40,32"), reset, yellow, black })
})()`, true).then(s => JSON.parse(s))
const tintOk = tintUnit.red === (255 << 16 | 86 << 8 | 64) && tintUnit.reset === 0xffffff &&
  tintUnit.yellow === (255 << 16 | 224 << 8 | 96) && tintUnit.black === 0 && tintUnit.shadow
console.log(`tintUnit: ${tintOk ? "OK" : "FAIL"} ${JSON.stringify(tintUnit)}`)
if (!tintOk) { console.log("FAIL: applyFilterString tint"); process.exit(1) }

//===== 3. баг 4: босс-погоня из неоткрытой комнаты + регрессия E-9b обычного врага =====
const chase = await ev(`(async function(){
  const AI = await import("./scripts/enemyAI.js")
  const D = await import("./scripts/data.js")
  const st = window.__ST.status
  const lv = window.__ST.dataGeneric.scenes[st.levelFloor]
  // открыть ТОЛЬКО стартовую комнату
  lv.roomsArr.forEach((r, i) => { r[3] = i === 0 ? 1 : 0 })
  st.navVersion = (st.navVersion || 0) + 1
  // герой в центр комнаты 0
  const f0 = lv.floor[lv.roomsArr[0][0]]
  const hx = (f0[0] + f0[2] / 2) * 32, hy = (f0[1] + f0[3] / 2) * 32
  const M = await import("./scripts/svg.js")
  M.moveSprite(st.hero.obj.img, hx - st.hero.x, hy - st.hero.y)
  st.hero.x = hx; st.hero.y = hy
  // спавн в ПОСЛЕДНЕЙ (неоткрытой) комнате: босс «Гоба Лидер» (id 4, boss:1, rage — ВНИМАНИЕ:
  // индекс группы ≠ id: лидер живёт в enemes[3], enemes[4] — обычный id 5) и обычный враг (id 0)
  const last = lv.roomsArr.length - 1
  const fN = lv.floor[lv.roomsArr[last][0]]
  const cell = [fN[0] + Math.floor(fN[2] / 2), fN[1] + Math.floor(fN[3] / 2)]
  const spawn = (cls) => {
    const cur = cls.anims[2].others[2]
    const stats = JSON.parse(JSON.stringify(cls.stats))
    const e = {"id":st.oVcount,"type":"enemy","class":cls,"stats":stats,"animCounters":60/cur.speed,
      "currentAnim":cur,"currentStill":0,"room":last,"cells":[[cell[0],cell[1]]],"state":0,"stop":0,
      "xCell":cell[0],"yCell":cell[1],"noStunTime":0,
      "img":M.image(M.svgArr[1], cell[0]*32, cell[1]*32-19, cur.w, cur.h, cur.img,
        {"times":cur.times,"id":st.oVcount,"frame":1})}
    window.__ST.objectValues.push(e)
    st.oVcount++
    e.rect = e.img.clipRect
    for (let iA = 0; iA < e.class.attacks.length; iA++)
      e.stats.attacksCd[iA] = Math.trunc((D.data.attacks[e.class.attacks[iA]].cooldown * 1000) / 16)
    return e
  }
  const boss = spawn(D.data.enemes[3][0])
  const plain = spawn(D.data.enemes[0][0])
  window.__E18BOSS = boss
  window.__E18PLAIN = plain
  const bossPos0 = [boss.rect.x.animVal.value, boss.rect.y.animVal.value]
  // «урон магией» — тот же вызов, что делает damage(): оповещение врага
  AI.enemyNoticeHero(boss)
  AI.enemyNoticeHero(plain)
  return JSON.stringify({
    bossState: boss.state, bossPath: boss.path ? boss.path.length : -1,
    plainState: plain.state, plainPath: plain.path ? plain.path.length : -1,
    rooms: lv.roomsArr.length, bossPos0 })
})()`, true).then(s => JSON.parse(s))
console.log("chase:", JSON.stringify(chase))
const chaseOk = chase.bossState === 3 && chase.bossPath > 0 && chase.plainState !== 3
console.log(`bossChase: ${chase.bossState === 3 && chase.bossPath > 0 ? "OK" : "FAIL"}; plainStays (E-9b): ${chase.plainState !== 3 ? "OK" : "FAIL"}`)
if (!chaseOk) { console.log("FAIL: boss chase"); process.exit(1) }

// босс реально ИДЁТ к герою: 240 тиков enemyMove — путь потребляется (клетки
// расходуются), и ПОСЛЕДНЯЯ клетка пути — клетка героя. Евклид тут не критерий:
// начало обхода может временно удалять от героя
const walked = await ev(`(async function(){
  const EM = await import("./scripts/enemyMove.js")
  const boss = window.__E18BOSS
  const st = window.__ST.status
  const heroCell = [Math.trunc(st.hero.x / 32), Math.trunc(st.hero.y / 32)]
  const p0 = boss.path ? boss.path.length : -1
  const r0 = [boss.rect.x.animVal.value, boss.rect.y.animVal.value]
  for (let i = 0; i < 240; i++) EM.enemyMove()
  const p1 = boss.path ? boss.path.length : -1
  const moved = Math.hypot(boss.rect.x.animVal.value - r0[0], boss.rect.y.animVal.value - r0[1])
  const last = boss.path && boss.path.length ? boss.path[boss.path.length - 1] : null
  return JSON.stringify({ p0, p1, moved: Math.round(moved), state: boss.state,
    pathEndsAtHero: !!last && last[0] === heroCell[0] && last[1] === heroCell[1] })
})()`, true).then(s => JSON.parse(s))
console.log("walked:", JSON.stringify(walked))
if (!(walked.moved > 50 && walked.state === 3 && walked.pathEndsAtHero)) { console.log("FAIL: босс не идёт к герою"); process.exit(1) }
console.log("bossWalks: OK")

//===== 4. ярость: tickRage красит спрайт (текст: красный tint при входе, белый при выходе) =====
const rage = await ev(`(async function(){
  const AI = await import("./scripts/enemyAI.js")
  const boss = window.__E18BOSS
  boss.rageAge = 500               // rage 8с = 500 тиков: следующий тик — вход в ярость
  AI.tickRage(boss)
  const on = { active: boss.rageActive, tint: boss.img.node.tint,
    shadow: String(boss.img._shadowStyleRaw || "").includes("rgba(255,40,32") }
  boss.rageAge = 749               // тик 750: (250 % 500)=250 не < 250 — выход
  AI.tickRage(boss)
  const off = { active: boss.rageActive, tint: boss.img.node.tint }
  return JSON.stringify({ on, off })
})()`, true).then(s => JSON.parse(s))
const rageOk = rage.on.active === 1 && rage.on.tint === (255 << 16 | 86 << 8 | 64) && rage.on.shadow &&
  rage.off.active === 0 && rage.off.tint === 0xffffff
console.log(`rageGlow: ${rageOk ? "OK" : "FAIL"} ${JSON.stringify(rage)}`)
if (!rageOk) { console.log("FAIL: rage glow"); process.exit(1) }

//===== 5. drag: tip гаснет при захвате; рамка/свечение редкости ПРОПАДАЮТ на время drag,
//          drag-glow ДВИГАЕТСЯ со спрайтом; провал возвращает рамку и свечение =====
// предмет редкости 1 (синяя рамка #0066FF) в inv[0]; рамки/свечение включены в настройках
const gen = await ev(`(async function(){
  const IG = await import("./scripts/itemGenerate.js")
  const st = window.__ST.status
  st.settings.itemFrames = 1
  st.settings.itemGlow = 1
  IG.itemGenerate(1)
  const it = st.inventory.inv[0]
  return JSON.stringify({ ok: !!it, rarity: it && it.rarity, img: it && it.img })
})()`, true).then(s => JSON.parse(s))
console.log("item:", JSON.stringify(gen))
if (!gen.ok) { console.log("FAIL: itemGenerate"); process.exit(1) }

await ev(`(async function(){ const I = await import("./scripts/inventory.js"); I.inventory() })()`, true)
await S(500)
const [c0x, c0y] = await toClient(1004, 325)   // центр ячейки 0 инвентаря (940,261 + 64)
// 5a: ховер без кнопки — тулип открыт (сначала отводим мышь: pointerover срабатывает
// только на входе в узел, из неподвижной позиции флоу-кликов входа могло не быть)
const [farX, farY] = await toClient(60, 540)
await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: farX, y: farY, button: "none", buttons: 0, pointerType: "mouse" })
await S(200)
await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: c0x, y: c0y, button: "none", buttons: 0, pointerType: "mouse" })
await S(300)
const tipOpen = await tipAlive()
console.log(`tipOpen: ${tipOpen ? "OK" : "FAIL"}`)
// 5b: захват — тулип ОБЯЗАН погаснуть; рамка СКРЫТА на своей ячейке; drag-glow на спрайте и едет с ним.
// Drag гоняем через бэкенд-API dragState (тот же beginDrag/moveDrag/endDrag, что и у мыши)
const grab = await ev(`(function(){
  const ok = window.__BACKEND.dragState().startAt(1004, 325)
  return JSON.stringify({ ok, dragging: window.__BACKEND.dragState().isDragging() })
})()`)
const grabS = JSON.parse(grab)
console.log(`grab: ${grabS.ok && grabS.dragging ? "OK" : "FAIL"} ${grab}`)
await ev(`window.__BACKEND.dragState().move(1044, 345)`)
await S(120)
const dragState = await ev(`(function(){
  const nodes = (${WALK2_FN})()
  const sprite = window.__BACKEND.shimById.get("13I")
  const tipNode = nodes.find(n => !n._dead && n.attrs && n.attrs.id === "tip")
  // рамка ДОЛЖНА остаться на ячейке (940,261), но быть скрытой
  const frame = nodes.find(n => n.kind === "rect" && +n.attrs.x === 940 && +n.attrs.y === 261 &&
    +n.attrs.width === 128 && +n.attrs.height === 128 && n.attrs.fill === "none" &&
    n.attrs.stroke !== "rgb(200, 248, 9)")
  // drag-glow: стиль на спрайте; копия существует
  const copies = sprite && sprite._shadowCopies
  return JSON.stringify({ tipGone: !tipNode,
    frameHidden: !!(frame && frame.node && frame.node.visible === false),
    glowStyle: String((sprite && sprite._shadowStyleRaw) || "").includes("rgba(255, 255, 204"),
    hasCopy: !!(copies && copies.length),
    s0: sprite ? sprite.node.x : 0, c0: copies && copies[0] ? copies[0].x : 0,
    spriteX: sprite ? +sprite.attrs.x : null })
})()`)
const ds0 = JSON.parse(dragState)
// сдвиг: копия обязана сдвинуться РОВНО на столько же, сколько спрайт (тень стоит с
// glowPad-смещением — сравниваем ДЕЛЬТЫ, а не абсолют)
await ev(`window.__BACKEND.dragState().move(1084, 385)`)
await S(120)
const dsDelta = await ev(`(function(){
  const sprite = window.__BACKEND.shimById.get("13I")
  const copies = sprite && sprite._shadowCopies
  return JSON.stringify({ s1: sprite ? sprite.node.x : 0, c1: copies && copies[0] ? copies[0].x : 0 })
})()`)
const ds1 = JSON.parse(dsDelta)
const copyMoves = Math.abs((ds1.s1 - ds0.s0) - (ds1.c1 - ds0.c0)) < 0.5
const ds = { tipGone: ds0.tipGone, frameHidden: ds0.frameHidden, glowStyle: ds0.glowStyle, copyMoves }
console.log(`tipGone: ${ds.tipGone ? "OK" : "FAIL"}; frameHidden: ${ds.frameHidden ? "OK" : "FAIL"}; dragGlow: ${ds.glowStyle ? "OK" : "FAIL"}; glowMoves: ${ds.copyMoves ? "OK" : "FAIL"} (sprite ${ds0.spriteX})`)
await shot("e19_drag_glow")
if (!(tipOpen && grabS.ok && grabS.dragging && ds.tipGone && ds.frameHidden && ds.glowStyle && ds.copyMoves)) {
  console.log("FAIL: tip/glow при drag"); process.exit(1)
}
// 5c: дроп в соседнюю пустую ячейку — перенос, рамка и свечение редкости на новой ячейке
await ev(`window.__BACKEND.dragState().move(1134, 325); window.__BACKEND.dragState().end()`)
await S(600)
const dropped = await ev(`(function(){
  const st = window.__ST.status
  const frameNew = (${FRAME_FN})(1070, 261)
  return JSON.stringify({ inv0: !!st.inventory.inv[0], inv1: !!st.inventory.inv[1],
    frameOnNew: !!frameNew, frameVisible: frameNew && frameNew.node ? frameNew.node.visible === true : false })
})()`)
const dd = JSON.parse(dropped)
console.log(`dropSwap: ${!dd.inv0 && dd.inv1 ? "OK" : "FAIL"}; frameOnNewCell: ${dd.frameOnNew && dd.frameVisible ? "OK" : "FAIL"}`)
// 5d: провал — drag мимо ячеек: спрайт вернулся, рамка видима на месте, свечение редкости восстановлено
const failDrop = await ev(`(async function(){
  const I = await import("./scripts/inventory.js")
  I.inventoryDel(1)
  await import("./scripts/itemGenerate.js").then(m => m.itemGenerate(1))
  I.inventory()                    // перерисовать: новый предмет рисуется в ячейке 0
  const it = window.__ST.status.inventory.inv[0]
  return JSON.stringify({ rarity: it && it.rarity })
})()`, true).then(s => JSON.parse(s))
console.log("item2:", JSON.stringify(failDrop))
const failDrag = await ev(`(async function(){
  const ok = window.__BACKEND.dragState().startAt(1004, 325)
  window.__BACKEND.dragState().move(950, 450)
  window.__BACKEND.dragState().move(900, 550)
  window.__BACKEND.dragState().end()
  return JSON.stringify({ ok })
})()`, true).then(s => JSON.parse(s))
console.log("failDrag:", JSON.stringify(failDrag))
const afterFail = await ev(`(function(){
  const frame = (${FRAME_FN})(940, 261)
  const sprite = window.__BACKEND.shimById.get("13I")
  const raw = String((sprite && sprite._shadowStyleRaw) || "")
  return JSON.stringify({ back: sprite ? +sprite.attrs.x : null,
    frameBack: !!frame, frameVisible: frame && frame.node ? frame.node.visible === true : false,
    // свечение редкости = прежний blur-фильтр ячейки (цвет зависит от rarity),
    // drag-glow (жёлтый) к этому моменту снят
    glow: raw.includes("drop-shadow") && !raw.includes("rgba(255, 255, 204"),
    inv0: !!window.__ST.status.inventory.inv[0] })
})()`)
const af = JSON.parse(afterFail)
console.log(`failReturn: ${af.back === 940 && af.inv0 ? "OK" : "FAIL"}; frameBack: ${af.frameBack && af.frameVisible ? "OK" : "FAIL"}; glowRestored: ${af.glow ? "OK" : "FAIL"} ${JSON.stringify(af)}`)
await ev(`(async function(){ const I = await import("./scripts/inventory.js"); I.inventoryDel(1) })()`, true)
await S(300)
if (!(dd.frameOnNew && dd.frameVisible && af.back === 940 && af.inv0 && af.frameBack && af.frameVisible && af.glow)) {
  console.log("FAIL: drag-блок"); process.exit(1)
}

//===== 6. стресс: 20 переносов туда-сюда — предметы не копируются, «призраков»-копий нет =====
const stress = await ev(`(async function(){
  const st = window.__ST.status
  await import("./scripts/inventory.js").then(m => m.inventory())
  const DS = window.__BACKEND.dragState()
  const A = [1004, 325], B = [1134, 325]
  for (let i = 0; i < 20; i++) {
    const [from, to] = i % 2 === 0 ? [A, B] : [B, A]
    if (!DS.startAt(from[0], from[1])) return JSON.stringify({ err: "startAt " + i })
    DS.move((from[0] + to[0]) / 2, (from[1] + to[1]) / 2)
    DS.move(to[0], to[1])
    DS.end()
  }
  const nodes = (${WALK2_FN})()
  const item = st.inventory.inv[0]
  const item2 = st.inventory.inv[1]
  const hrefs = [item.img, item2 && item2.img].filter(Boolean)
  const itemImgs = nodes.filter(n => !n._dead && n.kind === "image" && hrefs.includes(n.attrs.href)).length
  const invCount = st.inventory.inv.filter(Boolean).length
  const frameList = nodes.filter(n => !n._dead && n.kind === "rect" && n.attrs.fill === "none" &&
    n.attrs.stroke !== "rgb(200, 248, 9)").map(n => [n.attrs.x, n.attrs.y, n.attrs.stroke])
  // рамки в ЗОНЕ инвентаря (x>=940): по одной на предмет; рамка стартового оружия
  // на слоте куклы (410,738) — законный третий узел вне зоны
  const invFrames = frameList.filter(f => f[0] >= 940).length
  const ghosts = nodes.filter(n => !n._dead && n._isShadowCopy).length
  return JSON.stringify({ invCount, itemImgs, frames: invFrames, frameList, ghosts })
})()`, true).then(s => JSON.parse(s))
console.log("stress20:", JSON.stringify(stress))
const stressOk = stress.invCount === 2 && stress.itemImgs === 2 && stress.frames === 2 && stress.ghosts === 0
console.log(`noCopies: ${stressOk ? "OK" : "FAIL"}`)
await ev(`(async function(){ const I = await import("./scripts/inventory.js"); I.inventoryDel(1) })()`, true)
if (!stressOk) { console.log("FAIL: копирование предметов"); process.exit(1) }

//===== 7. атака без оружия: снял оба оружия — атака не копится и не выполняется =====
const noWeapon = await ev(`(async function(){
  const DR = await import("./scripts/drag.js")
  const A = await import("./scripts/attack.js")
  const st = window.__ST.status
  const D = await import("./scripts/data.js")
  const hero = D.data.heroes[st.hero.class]
  // снять всё оружие с рук
  for (const slot of [11, 12]) {
    const w = st.inventory.doll[slot]
    if (!w) continue
    const invIdx = st.inventory.inv.findIndex(c => !c)
    st.inventory.inv[invIdx] = w
    st.inventory.doll[slot] = null
    DR.unEquip(w)
  }
  const after = { img: st.attack.img, stack: st.attack.stack.length }
  // страховочный рассинхрон: подброшенная base-атака НЕ должна ожить
  st.attack.stack.push({ timer: 1, abil: D.data.attacks[hero.anims[1].attack[1].new.anim[0]] })
  for (let i = 0; i < 60; i++) A.checkAttack()
  const off = { cur: st.attack.current.length, stack: st.attack.stack.length }
  // вернуть оружие — атака снова накапливается (стек жив)
  const w = st.inventory.inv.find(c => c && c.attack !== undefined)
  const idx = st.inventory.inv.indexOf(w)
  st.inventory.inv[idx] = null
  st.inventory.doll[11] = w
  DR.equip(w)
  st.attack.stack.push({ timer: 1, abil: D.data.attacks[w.attack] })
  for (let i = 0; i < 10; i++) A.checkAttack()
  const on = { cur: st.attack.current.length, stack: st.attack.stack.length }
  // убрать обратно тестовое оружие
  st.inventory.doll[11] = null
  DR.unEquip(w)
  return JSON.stringify({ after, off, on })
})()`, true).then(s => JSON.parse(s))
const noWeaponOk = noWeapon.after.img === null && noWeapon.after.stack === 0 &&
  noWeapon.off.cur === 0 && noWeapon.on.cur > 0
console.log(`noWeaponAttack: ${noWeaponOk ? "OK" : "FAIL"} ${JSON.stringify(noWeapon)}`)
if (!noWeaponOk) { console.log("FAIL: атака без оружия"); process.exit(1) }

//===== 8. HUD: tip при наведении на иконку активной способности =====
const hud = await ev(`(async function(){
  const D = await import("./scripts/data.js")
  const AS = await import("./scripts/activeSkills.js")
  const st = window.__ST.status
  st.info.activeSkills.push({ "cooldown": 0, "duration": 0, "skill": D.data.heroes[st.hero.class].skills[0] })
  AS.activeSkills()
  return JSON.stringify({ n: st.info.activeSkills.length,
    x: 1370 + 48, y: 970 + 48 })
})()`, true).then(s => JSON.parse(s))
const [hx, hy] = await toClient(hud.x, hud.y)
const [hfx, hfy] = await toClient(100, 300)
await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: hfx, y: hfy, button: "none", buttons: 0, pointerType: "mouse" })
await S(200)
await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: hx, y: hy, button: "none", buttons: 0, pointerType: "mouse" })
await S(400)
const hudTip = await tipAlive()
await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: hfx, y: hfy, button: "none", buttons: 0, pointerType: "mouse" })
await S(400)
const hudTipGone = !(await tipAlive())
console.log(`hudTip: ${hudTip ? "OK" : "FAIL"}; hudTipGone: ${hudTipGone ? "OK" : "FAIL"}`)
if (!(hudTip && hudTipGone)) { console.log("FAIL: HUD tip"); process.exit(1) }

//===== 9. чистки =====
const cleanup = await ev(`(async function(){
  const D = await import("./scripts/data.js")
  const st = window.__ST.status
  // belt clamp: 0.75*20=15 → 14.png (15.png на диске нет)
  st.info.beltCell = 2
  st.info.beltCellArr = [0.25, 0.75]
  const B = await import("./scripts/belt.js")
  B.beltChange()
  const b0 = window.__BACKEND.shimById.get("0BTI")
  const b1 = window.__BACKEND.shimById.get("1BTI")
  const attacksDead = [15,16,17,18,19,20,21,22,23,24].every(i => D.data.attacks[i].img === undefined)
  const attacksAlive = [0,5,9,15].slice(0,3).every(i => !!D.data.attacks[i].img)
  return JSON.stringify({ food0: b0 && String(b0.attrs.href).split("/").pop(),
    food1: b1 && String(b1.attrs.href).split("/").pop(),
    attacksDead, attacksAlive })
})()`, true).then(s => JSON.parse(s))
console.log("cleanup:", JSON.stringify(cleanup))
const cleanupOk = cleanup.food0 === "5.png" && cleanup.food1 === "14.png" && cleanup.attacksDead && cleanup.attacksAlive
if (!cleanupOk) { console.log("FAIL: чистки"); process.exit(1) }

//===== 10. normMeta: obtainedRelics добивается до 7 (в конце — load() перетирает мету/настройки) =====
const norm = await ev(`(async function(){
  localStorage.setItem("meta", JSON.stringify({"obtainedRelics":[1,1,1]}))
  const Sv = await import("./scripts/save.js")
  Sv.load()
  const m = window.__ST.status.meta
  return JSON.stringify({ len: m.obtainedRelics.length, head: m.obtainedRelics.slice(0, 3) })
})()`, true).then(s => JSON.parse(s))
console.log("normRelics:", JSON.stringify(norm))
const normOk = norm.len === 7 && JSON.stringify(norm.head) === "[1,1,1]"
console.log(`normMeta: ${normOk ? "OK" : "FAIL"}`)
if (!normOk) { console.log("FAIL: normMeta"); process.exit(1) }

await S(800)
const errs = exceptions()
console.log("page errors:", JSON.stringify(errs))
console.log("ALL OK")
await conn.close()
process.exit(0)
