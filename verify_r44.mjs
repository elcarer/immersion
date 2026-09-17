// R4.4 верификация: журнал/библиотека (нативные группы с клипом), режимы библиотеки,
// тултип (nativeHtml), кнопка-уголок миникарты (nativePoly + federated-события).
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
const clickAt = async (x, y) => {
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none", buttons: 0, pointerType: "mouse" })
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1, pointerType: "mouse" })
  await S(60)
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1, pointerType: "mouse" })
  await S(400)
}
const wheelAt = async (x, y, dy) => {
  await send("Input.dispatchMouseEvent", { type: "mouseWheel", x, y, deltaX: 0, deltaY: dy, button: "none", buttons: 0, pointerType: "mouse" })
  await S(200)
}
const uiButtons = async () => JSON.parse(await ev(`JSON.stringify(window.__BACKEND.dumpUI().filter(u => u.text && u.b).map(u => ({ t: u.text, x: Math.round((u.b.minX + u.b.maxX) / 2), y: Math.round((u.b.minY + u.b.maxY) / 2) })))`))
const clickBtn = async (t) => {
  const find = (await uiButtons()).find(b => b.t === t)
  if (!find) return false
  await clickAt(find.x, find.y)
  return true
}

// — flow: заставка → забег (НОВАЯ ИГРА → ДА → ДАЛЕЕ...) —
await send("Page.reload", { ignoreCache: true })
await S(4500)
for (let i = 0; i < 18; i++) {
  const st = JSON.parse(await ev(`JSON.stringify({ start: window.__ST.status.start, objs: window.__ST.objectValues.length })`))
  if (st.start === 1 && st.objs > 0) break
  if (await clickBtn("ДАЛЕЕ")) { await S(500); continue }
  if (await clickBtn("НОВАЯ ИГРА")) {
    await S(500)
    await clickBtn("ДА")
    continue
  }
  await clickAt(382, 300); await S(400)
}
await S(800)
console.log("flow:", await ev(`JSON.stringify({ start: window.__ST.status.start, objs: window.__ST.objectValues.length })`))

// — ЖУРНАЛ: clickButton(2) через модуль, проба, колесо, скриншот, закрытие —
await ev(`import("./scripts/topMenu.js").then(m => m.clickButton(2))`, true)
await S(500)
const jp = await ev(`import("./scripts/journal.js").then(m => m.journalProbe())`, true)
console.log("journal:", JSON.stringify(jp))
await shot("r44_journal")
// колесо над зоной строк (листать вниз-вверх)
await wheelAt(800, 500, 480)
await wheelAt(800, 500, -480)
const jp2 = await ev(`import("./scripts/journal.js").then(m => m.journalProbe())`, true)
console.log("journal after wheel:", JSON.stringify(jp2))
// подсыпать событий и переоткрыть — проверить скролл при maxOff>0 (ползунок + клип)
await ev(`import("./scripts/journal.js").then(m => { const J = m; for (let i = 0; i < 25; i++) J.journalAdd("событие " + i, "#33FF66") })`, true)
await ev(`import("./scripts/topMenu.js").then(m => m.clickButton(2))`, true)
await S(400)
await ev(`import("./scripts/topMenu.js").then(m => m.clickButton(2))`, true)
await S(500)
const jp3 = await ev(`import("./scripts/journal.js").then(m => m.journalProbe())`, true)
console.log("journal reopened:", JSON.stringify(jp3))
await wheelAt(800, 500, -960)
const jp4 = await ev(`import("./scripts/journal.js").then(m => m.journalProbe())`, true)
console.log("journal scrolled up:", JSON.stringify(jp4))
await shot("r44_journal_scrolled")
await ev(`import("./scripts/topMenu.js").then(m => m.clickButton(2))`, true)
await S(400)
await ev(`import("./scripts/topMenu.js").then(m => m.clickButton(2))`, true)
await S(400)

// — БИБЛИОТЕКА: clickButton(4), проба, режимы, колесо, скриншоты —
await ev(`import("./scripts/topMenu.js").then(m => m.clickButton(4))`, true)
await S(600)
const lp = await ev(`import("./scripts/library.js").then(m => m.libraryProbe())`, true)
console.log("library:", JSON.stringify(lp))
await shot("r44_library_enemies")
// режим «Объекты» — клик по центру bounds кнопки (клиентские координаты = viewBox×масштаб)
const btnCenter = async (id) => JSON.parse(await ev(`(function(){
  const el = document.getElementById("${id}")
  if (!el) return JSON.stringify(null)
  const b = el.node.getBounds()
  return JSON.stringify({ x: Math.round((b.minX + b.maxX) / 2), y: Math.round((b.minY + b.maxY) / 2) })
})()`, true))
let c = await btnCenter("libModeOI")
c && await clickAt(c.x, c.y)
await S(500)
console.log("library objects:", JSON.stringify(await ev(`import("./scripts/library.js").then(m => m.libraryProbe())`, true)))
await shot("r44_library_objects")
// режим «Достижения»
c = await btnCenter("libModeAI")
c && await clickAt(c.x, c.y)
await S(500)
console.log("library ach:", JSON.stringify(await ev(`import("./scripts/library.js").then(m => m.libraryProbe())`, true)))
// колесо над зоной карточек (у объектов карточек больше — скролл есть точно после клика по объектам,
// здесь просто проверяем что колесо не роняет панель)
await wheelAt(800, 500, 480)
console.log("library ach+wheel:", JSON.stringify(await ev(`import("./scripts/library.js").then(m => m.libraryProbe())`, true)))
await ev(`import("./scripts/topMenu.js").then(m => m.clickButton(4))`, true)
await S(400)

// — ТУЛТИП (nativeHtml): helpWord рисует фрейм с описанием стата —
await ev(`import("./scripts/tip.js").then(m => m.helpWord("#3300ff", 0, 300, 300))`, true)
await S(300)
await shot("r44_tip")
await ev(`import("./scripts/tip.js").then(m => m.tipDel())`, true)
await S(200)

// — КНОПКА-УГОЛОК МИНИКАРТЫ (nativePoly): hover → свечение, клик → панель —
await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 1899, y: 8, button: "none", buttons: 0, pointerType: "mouse" })
await S(300)
await shot("r44_mmbtn_hover")
await clickAt(1899, 8)
await S(600)
await shot("r44_minimap_open")
await clickAt(1899, 8)
await S(400)

const errs = await ev(`JSON.stringify({ errs: window.__errs, loopErr: window.__loopErr || null, panels: window.__ST.status.panels })`, true)
console.log("final:", errs)
conn.close(); process.exit(0)
