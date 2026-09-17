// R4.5 верификация: pointer-drag предмета (кукла ↔ инвентарь), dblclick-экипировка,
// геймпад-drag (viewBox→client) и геймпад-клик (elementFromPoint + dispatchEvent).
import { connect } from "./cdp.mjs"
import { writeFileSync } from "fs"

const S = (ms) => new Promise(r => setTimeout(r, ms))
const conn = await connect()
const send = conn.send
await send("Page.enable", {})
await send("Runtime.enable", {})
const ev = (e, ap = false) => send("Runtime.evaluate", { expression: e, awaitPromise: ap, returnByValue: true })
  .then(r => { if (r.exceptionDetails) throw new Error("eval: " + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || "").slice(0, 500)); return r.result.value })
await ev(`window.__errs = []; window.addEventListener('error', e => window.__errs.push(String(e.message)))`)
const shot = async (name) => {
  const r = await send("Page.captureScreenshot", { format: "png" })
  writeFileSync(`D:/ZCode/project2/shots/${name}.png`, Buffer.from(r.data, "base64"))
}
const move = (x, y, buttons) => send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none", buttons, pointerType: "mouse" })
const press = (x, y) => send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1, pointerType: "mouse" })
const release = (x, y) => send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1, pointerType: "mouse" })
const dragMouse = async (x1, y1, x2, y2) => {
  await move(x1, y1, 0); await S(80)
  await press(x1, y1); await S(120)
  await move((x1 + x2) / 2, (y1 + y2) / 2, 1); await S(60)
  await move(x2, y2, 1); await S(120)
  await release(x2, y2); await S(400)
}
const clickAt = async (x, y) => {
  await move(x, y, 0); await S(60)
  await press(x, y); await S(60)
  await release(x, y); await S(250)
}
const uiButtons = async () => JSON.parse(await ev(`JSON.stringify(window.__BACKEND.dumpUI().filter(u => u.text && u.b).map(u => ({ t: u.text, x: Math.round((u.b.minX + u.b.maxX) / 2), y: Math.round((u.b.minY + u.b.maxY) / 2) })))`))
const centerOf = async (mod, list, id) => JSON.parse(await ev(`import("./scripts/${mod}").then(m => {
  const el = m.${list}.find(e => e.getAttribute && e.getAttribute("id") === "${id}")
  if (!el || !el.node) return JSON.stringify(null)
  const b = el.node.getBounds()
  return JSON.stringify({ x: Math.round((b.minX + b.maxX) / 2), y: Math.round((b.minY + b.maxY) / 2) })
})`, true))
const invState = () => ev(`JSON.stringify({ doll11: !!window.__ST.status.inventory.doll[11], inv0: !!window.__ST.status.inventory.inv[0], inv1: !!window.__ST.status.inventory.inv[1], attackImg: window.__ST.status.attack.img !== null, panels: window.__ST.status.panels })`)

// — flow в забег —
await send("Page.reload", { ignoreCache: true })
await S(4500)
for (let i = 0; i < 18; i++) {
  const st = JSON.parse(await ev(`JSON.stringify({ start: window.__ST.status.start })`))
  if (st.start === 1) break
  const btns = await uiButtons()
  const find = t => btns.find(b => b.t === t)
  if (find("ДАЛЕЕ")) { await clickAt(find("ДАЛЕЕ").x, find("ДАЛЕЕ").y); await S(600); continue }
  if (find("НОВАЯ ИГРА")) {
    await clickAt(find("НОВАЯ ИГРА").x, find("НОВАЯ ИГРА").y); await S(500)
    if (find("ДА")) await clickAt(find("ДА").x, find("ДА").y)
    continue
  }
  await clickAt(382, 300); await S(400)
}
await S(800)
console.log("start:", await ev(`window.__ST.status.start`))

// — панель экипировки+инвентарь —
await ev(`import("./scripts/topMenu.js").then(m => m.clickButton(0))`, true)
await S(600)
const w = await centerOf("doll.js", "dollTemp", "11I")
const c13 = await centerOf("inventory.js", "inventoryTemp", "13I")
const c14 = await centerOf("inventory.js", "inventoryTemp", "14I")
console.log("weapon icon:", w, "cell13:", c13, "cell14:", c14)
if (!w || !c13) { console.log("FAIL: icons not found"); process.exit(1) }

// — 1) мышиный drag: оружие куклы (слот 11) → ячейку 13 инвентаря = СНИТЬ —
await dragMouse(w.x, w.y, c13.x, c13.y)
console.log("after unequip drag:", await invState())
await shot("r45_after_unequip")

// — 2) dblclick по иконке в инвентаре = ОДЕТЬ обратно (два тапа < 350мс —
// детектор dblclick в wirePixiEvents меряет промежуток) —
await move(c13.x, c13.y, 0); await S(60)
await press(c13.x, c13.y); await S(50)
await release(c13.x, c13.y); await S(80)
await press(c13.x, c13.y); await S(50)
await release(c13.x, c13.y); await S(500)
console.log("after dblclick equip:", await invState())
await shot("r45_after_equip")

// — 3) геймпад-drag (viewBox-координаты!): оружие куклы → ячейку 14 —
// (после шага 2 оружие снова в слоте 11)
const wvb = { x: w.x / 0.8, y: w.y / 0.8 }
const c14vb = { x: c14.x / 0.8, y: c14.y / 0.8 }
const gp = await ev(`(async function(){
  const svg = await import("./scripts/svg.js")
  const ok = svg.gamepadDragStart(${wvb.x}, ${wvb.y})
  if (!ok) return "start-miss"
  svg.gamepadDragMove((${wvb.x} + ${c14vb.x}) / 2, (${wvb.y} + ${c14vb.y}) / 2)
  svg.gamepadDragMove(${c14vb.x}, ${c14vb.y})
  svg.gamepadDragEnd()
  return "dragged"
})()`, true)
await S(400)
console.log("gamepad drag:", gp)
console.log("after gamepad drag:", await invState())
await shot("r45_after_gpad")

// — 4) геймпад-клик: точный путь gameLoop (createSVGPoint → CTM → elementFromPoint → click)
// по кнопке КАРТА в топ-меню — откроется карта (panels===2) —
await ev(`import("./scripts/topMenu.js").then(m => m.clickButton(0))`, true) // закрыть панели
await S(500)
await ev(`import("./scripts/topMenu.js").then(m => m.clickButton(2))`, true) // журнал рисует topMenu
await S(500)
const kart = (await uiButtons()).find(b => b.t === "КАРТА")
if (!kart) { console.log("FAIL: КАРТА button not found"); process.exit(1) }
// центр КНОПКИ в viewBox (кнопка — шим-нимод: статус по dumpUI уже в клиентских, переводим)
const gpClick = await ev(`(function(){
  const point = window.__ST.svgArr[2].createSVGPoint()
  point.x = ${kart.x / 0.8}
  point.y = ${kart.y / 0.8}
  const sp = point.matrixTransform(window.__ST.svgArr[2].getScreenCTM())
  const el = document.elementFromPoint(sp.x, sp.y)
  if (!el) return "noElement"
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  return "clicked"
})()`, true)
await S(500)
console.log("gamepad click:", gpClick, "state:", await invState())
await shot("r45_gp_click_map")

const errs = await ev(`JSON.stringify({ errs: window.__errs, loopErr: window.__loopErr || null })`, true)
console.log("final:", errs)
conn.close(); process.exit(0)
