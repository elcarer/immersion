// E-13: фуллскрин-подложки (карта/алхимия/bless/настройки/подтверждение/rectShadow)
// на весь ЭКРАН, а не дизайн 1920×1080 — иначе на окнах шире 16:9 чёрный квадрат
// «резал» часть прибитой к краю миникарты. Проверка: 2000×1080 (миникарта=straddles
// 1920), открыть миникарту → открыть КАРТУ → подложка доходит до краёв, миникарта
// полностью под ней (по границам rects из dumpUI + скриншот).
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
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1, pointerType: "mouse" })
  await S(60)
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1, pointerType: "mouse" })
  await S(400)
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
const resize = async (w, h) => {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false })
  await S(400)
}

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
console.log("flow:", await ev(`JSON.stringify({ start: window.__ST.status.start, cls: window.__ST.status.hero.class })`))

// окно-кейс: 2000×1080 — правый край экрана (2000) внутри границ миникарты
// (1771..1995 в дизайн-координатах при uiRightEdge=2000) — старый баг резал её краем 1920
await resize(2000, 1080)

// открыть миникарту кликом по кнопке
const openMinimap = async () => {
  const b = JSON.parse(await ev(`JSON.stringify((function(){ const s = window.__BACKEND.shimById.get("minimapBtn"); const b = s.node.getBounds(); return { x: Math.round((b.minX + b.maxX) / 2), y: Math.round((b.minY + b.maxY) / 2) } })())`))
  await clickAt(b.x, b.y)
}
await openMinimap()
const mm = JSON.parse(await ev(`JSON.stringify((function(){ const s = window.__BACKEND.shimById.get("minimapWin"); const b = s && !s.node.destroyed ? s.node.getBounds() : null; return b ? { minX: Math.round(b.minX), maxX: Math.round(b.maxX) } : null })())`))
console.log("minimap frame:", JSON.stringify(mm), "(ожидание ~1771..1995 — straddles 1920)")
await shot("map_e13_before")

// открыть КАРТУ кнопкой топ-меню
if (!await clickBtn("КАРТА")) { console.log("FAIL: кнопка КАРТА не найдена"); process.exit(1) }
await S(600)
const state = JSON.parse(await ev(`JSON.stringify((function(){
  const B = window.__BACKEND
  // фуллскрин-подложка = САМЫЙ БОЛЬШОЙ rect слоя UI (меньшие — подложка окна
  // миникарты и пр.); границы в клиентских px
  let big = null, bigA = 0
  const walk = (shim, d) => {
    if (!shim || d > 6) return
    if (shim.kind === "rect" && shim.node && !shim.node.destroyed) {
      try {
        const b = shim.node.getBounds()
        if (b) {
          const a = (b.maxX - b.minX) * (b.maxY - b.minY)
          if (a > bigA) { bigA = a; big = { minX: Math.round(b.minX), minY: Math.round(b.minY), maxX: Math.round(b.maxX), maxY: Math.round(b.maxY) } }
        }
      } catch (e) {}
    }
    const kids = shim.children || []
    for (const c of kids) walk(c, d + 1)
  }
  walk(B.layers[2], 0)
  const mmw = B.shimById.get("minimapWin")
  const mmB = mmw && !mmw.node.destroyed ? mmw.node.getBounds() : null
  return { panels: window.__ST.status.panels, iw: window.innerWidth, ih: window.innerHeight,
    backdrop: big, minimapAlive: !!mmB, mmX: mmB ? Math.round(mmB.minX) : null }
})())`))
console.log("map state:", JSON.stringify(state))
const eq = (a, b, tol) => Math.abs(a - b) <= (tol || 2)
const okBackdrop = state.backdrop && eq(state.backdrop.minX, 0) && eq(state.backdrop.minY, 0) &&
  eq(state.backdrop.maxX, state.iw) && eq(state.backdrop.maxY, state.ih)
// миникарта полностью под подложкой: правый край кадра ≤ правого края подложки
const okCovered = state.backdrop && mm && state.backdrop.maxX >= mm.maxX
console.log(`E13 map-backdrop: ${okBackdrop ? "OK" : "FAIL"} подложка=${JSON.stringify(state.backdrop)} экран=${state.iw}x${state.ih}; миникарта скрыта целиком: ${okCovered ? "OK" : "FAIL"}`)
await shot("map_e13_after")

// настройки — вторая подложка (0.6): закрыть карту тем же кликом по кнопке
// КАРТА (подложка без func пропускает клики сквозь), затем открыть настройки
const mapBtn = (await uiButtons()).find(b => b.t === "КАРТА")
if (mapBtn) { await clickAt(mapBtn.x, mapBtn.y); await S(400) }
console.log("panels after close:", await ev(`window.__ST.status.panels`))
// настройки открываем прямым вызовом (после закрытия карты topMenu-тексты
// пересобираются игрой и недоступны dumpUI сразу)
const setOpened = JSON.parse(await ev(`(function(){
  const st = window.__ST.status
  const before = st.panels
  import("./scripts/settings.js").then(m => m.settings())
  return JSON.stringify({ before })
})()`))
await S(600)
// E-13 ещё на одной подложке: exitConfirm (0.6 поверх всего) — открыть кнопкой
// ГЛАВНОЕ МЕНЮ на открытых настройках, померить, отменить НЕТ
if (await clickBtn("ГЛАВНОЕ МЕНЮ")) {
  await S(500)
  const st2 = JSON.parse(await ev(`JSON.stringify((function(){
    const B = window.__BACKEND
    let big = null, bigA = 0
    const walk = (shim, d) => {
      if (!shim || d > 6) return
      if (shim.kind === "rect" && shim.node && !shim.node.destroyed) {
        try {
          const b = shim.node.getBounds()
          if (b) { const a = (b.maxX - b.minX) * (b.maxY - b.minY); if (a > bigA) { bigA = a; big = { maxX: Math.round(b.maxX), maxY: Math.round(b.maxY) } } }
        } catch (e) {}
      }
      const kids = shim.children || []
      for (const c of kids) walk(c, d + 1)
    }
    walk(B.layers[2], 0)
    return { backdrop: big, iw: window.innerWidth, ih: window.innerHeight }
  })())`))
  const ok2 = st2.backdrop && eq(st2.backdrop.maxX, st2.iw) && eq(st2.backdrop.maxY, st2.ih)
  console.log(`E13 exitConfirm-backdrop: ${ok2 ? "OK" : "FAIL"} ${JSON.stringify(st2.backdrop)} vs ${st2.iw}x${st2.ih}`)
  await shot("map_e13_settings")
  await clickBtn("НЕТ")
} else console.log("E13 exitConfirm: кнопка не найдена (пропуск)")

const fps = await ev(`new Promise(res => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 1500) requestAnimationFrame(f); else res(Math.round(n / 1.5)) }; requestAnimationFrame(f) })`, true)
console.log("FPS:", fps)
const errList = exceptions()
console.log("JS exceptions:", errList.length ? errList.join(" | ") : "нет")
const runtimeErrs = JSON.parse(await ev(`JSON.stringify(window.__errs || [])`))
console.log("window errors:", runtimeErrs.length ? runtimeErrs.join(" | ") : "нет")
await send("Emulation.clearDeviceMetricsOverride", {})
process.exit(0)
