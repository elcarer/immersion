// Репродукция бага шкафчика древностей: инжектим объект 20 рядом с героем,
// юзаем, кликаем панель благословения, смотрим: выдался ли bless и закрылось ли меню.
import { connect } from "./cdp.mjs"
import { writeFileSync } from "fs"

const S = (ms) => new Promise(r => setTimeout(r, ms))
const conn = await connect()
const send = conn.send
await send("Page.enable", {})
await send("Runtime.enable", {})
const ev = (e, ap = false) => send("Runtime.evaluate", { expression: e, awaitPromise: ap, returnByValue: true })
  .then(r => { if (r.exceptionDetails) throw new Error("eval: " + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || "").slice(0, 600)); return r.result.value })
const shot = async (name) => {
  const r = await send("Page.captureScreenshot", { format: "png" })
  writeFileSync(`D:/ZCode/project2/shots/${name}.png`, Buffer.from(r.data, "base64"))
}
const clickAt = async (x, y) => {
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none", buttons: 0, pointerType: "mouse" })
  await S(60)
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1, pointerType: "mouse" })
  await S(60)
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1, pointerType: "mouse" })
  await S(500)
}
const key = async (code, down) => send("Input.dispatchKeyEvent", { type: down ? "keyDown" : "keyUp", code, windowsVirtualKeyCode: 0, nativeVirtualKeyCode: 0 })
const walk = async (code, ms) => { await key(code, true); await S(ms); await key(code, false); await S(80) }
const uiButtons = async () => JSON.parse(await ev(`JSON.stringify(window.__BACKEND.dumpUI().filter(u => u.text && u.b).map(u => ({ t: u.text, x: Math.round((u.b.minX + u.b.maxX) / 2), y: Math.round((u.b.minY + u.b.maxY) / 2) })))`))

// 1. флоу до этажа
await send("Page.reload", { ignoreCache: true })
await S(4500)
// ловим ВСЕ исключения страницы (обработчики событий не попадают в __tickError)
await ev(`window.__errs = []; window.addEventListener('error', e => window.__errs.push(String(e.message) + " @ " + String(e.filename) + ":" + e.lineno)); window.addEventListener('unhandledrejection', e => window.__errs.push("rej: " + String(e.reason)))`)
for (let i = 0; i < 18; i++) {
  const st = JSON.parse(await ev(`JSON.stringify({ start: window.__ST.status.start, objs: window.__ST.objectValues.length })`))
  if (st.start === 1 && st.objs > 0) break
  const buttons = await uiButtons()
  const find = t => buttons.find(b => b.t === t)
  if (find("ДАЛЕЕ")) { await clickAt(find("ДАЛЕЕ").x, find("ДАЛЕЕ").y); await S(700); continue }
  if (find("НОВАЯ ИГРА")) {
    await clickAt(find("НОВАЯ ИГРА").x, find("НОВАЯ ИГРА").y); await S(700)
    if (find("ДА")) { await clickAt(find("ДА").x, find("ДА").y); await S(700) }
    continue
  }
  await clickAt(382, 300); await S(500)
}
await S(1000)

// 2. инжект шкафчика на 2 клетки ниже героя, затем заход в неё
const inj = await ev(`(async function(){
  const svg = await import("./scripts/svg.js")
  const hero = window.__ST.status.hero
  const cx = Math.trunc(hero.x / 32), cy = Math.trunc(hero.y / 32) + 2
  const lvl = window.__ST.dataGeneric.scenes[window.__ST.status.levelFloor]
  const sp = window.__ST.screenPic
  const rec = [cx, cy, 20, 1, 1]
  lvl.objects.push(rec)
  const node = svg.worldImage(window.__ST.svgArr[1], cx*32, cy*32 + 32 - 42, 64, 42, "./images/dungeon/objects/101.png", {"id": sp.length + "O"})
  sp.push(node)
  rec[6] = sp.length - 1
  return JSON.stringify({ ok: true, cx, cy, idx: rec[6] })
})()`, true)
console.log("inject:", inj)

// 3. заход в клетку объекта — юз по подходу (полоса ~0.8с → меню)
await walk("ArrowDown", 900)
await S(1500)
const menuState = JSON.parse(await ev(`JSON.stringify({
  panels: window.__ST.status.panels, pause: window.__ST.status.pause,
  layer2: window.__ST.svgArr[2].node.children.length,
  blesses: (window.__ST.status.info.blesses || []).length
})`, true))
console.log("menu open:", JSON.stringify(menuState))
await shot("bless_menu_open")
if (menuState.panels !== 11) { console.log("МЕНЮ НЕ ОТКРЫЛОСЬ"); conn.close(); process.exit(1) }

// 4. клик по первой панели (координаты открытого меню: панель 350..730 × 230..790, экранные
// координаты = мировые слоя 2 (камеры нет) — кликуем центр первой карточки)
await clickAt(540, 500)
await S(600)
const after1 = JSON.parse(await ev(`JSON.stringify({
  panels: window.__ST.status.panels, pause: window.__ST.status.pause,
  layer2: window.__ST.svgArr[2].node.children.length,
  blesses: (window.__ST.status.info.blesses || []),
  warns: (window.__warns || []).length, loopErr: window.__loopErr || null
})`, true))
console.log("after click1:", JSON.stringify(after1))
console.log("page errors:", JSON.stringify(await ev(`JSON.stringify(window.__errs || [])`)))
await shot("bless_menu_after_click")

// 5. если меню живо — второй клик (репродукция «каждый клик выдаёт bless»)
if (after1.panels === 11) {
  await clickAt(960, 500)
  await S(600)
  const after2 = JSON.parse(await ev(`JSON.stringify({
    panels: window.__ST.status.panels, layer2: window.__ST.svgArr[2].node.children.length,
    blesses: (window.__ST.status.info.blesses || []), warns: (window.__warns || []).length
  })`, true))
  console.log("after click2:", JSON.stringify(after2))
}
conn.close(); process.exit(0)
