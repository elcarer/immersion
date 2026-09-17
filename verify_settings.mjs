// R5.1 верификация настроек: ползунок (sliderDrag → mousedown/document-mousemove),
// клик по полосе (func + getScreenCTM), «Звук выкл.» (запись x.baseVal.value = 975),
// чекбокс теней (setAttribute display). Всё это — контракт класса El после сноса
// лишних on*-аксессоров/cx-cy-r-геттеров/cursor-прокси.
import { connect } from "./cdp.mjs"
import { writeFileSync } from "fs"

const S = (ms) => new Promise(r => setTimeout(r, ms))
const conn = await connect()
const send = conn.send
const LOG = (m) => console.error("[vs]", m)
LOG("start")
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
// drag: зажать, несколько движений, отпустить (контракт sliderDrag: значение с 1-го ДВИЖЕНИЯ)
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
const uiButtons = async () => JSON.parse(await ev(`JSON.stringify(window.__BACKEND.dumpUI().filter(u => u.text && u.b).map(u => ({ t: u.text, x: Math.round((u.b.minX + u.b.maxX) / 2), y: Math.round((u.b.minY + u.b.maxY) / 2) })))`))
const clickBtn = async (t) => {
  const find = (await uiButtons()).find(b => b.t === t)
  if (!find) return false
  await clickAt(find.x, find.y)
  return true
}
// шим-поиск: точка pointFull / полоса soundBar / галочка shadowsCheck в слое 2
const knobProbe = () => ev(`(() => {
  const out = {}
  const walk = (s) => { for (const c of (s.children||[])) {
    if (c.attrs && String(c.attrs.href||"").includes("pointFull")) { out[out.music === undefined ? "music" : "fx"] = { x: +c.attrs.x, y: +c.attrs.y } }
    if (c.attrs && c.attrs.id === "shadowsCheck") out.check = c.attrs.display
    walk(c)
  } }
  walk(window.__BACKEND.layers[2])
  const st = window.__ST.status.settings
  out.vol = { music: st.musicVolume, fx: st.soundVolume, noShadows: st.noShadows }
  return JSON.stringify(out)
})()`, true)

LOG("reload")
await send("Page.reload", { ignoreCache: true })
await S(4500)
for (let i = 0; i < 18; i++) {
  const st = JSON.parse(await ev(`JSON.stringify({ start: window.__ST.status.start, objs: window.__ST.objectValues.length })`))
  if (st.start === 1 && st.objs > 0) break
  if (await clickBtn("ДАЛЕЕ")) { await S(500); continue }
  if (await clickBtn("НОВАЯ ИГРА")) { await S(500); await clickBtn("ДА"); continue }
  await clickAt(382, 300); await S(400)
}
await S(800)
LOG("flow done")

// — открыть настройки (кнопка 3 топ-меню) —
await ev(`import("./scripts/topMenu.js").then(m => m.clickButton(3))`, true)
await S(500)
console.log("before:", await knobProbe())

// — drag ползунка музыки вправо-влево (sliderDrag-контракт) —
// knob music: attrs.x = 975 + vol*220/0.4; клиентские = viewBox×0.8 (окно 1536×864)
const k0 = JSON.parse(await knobProbe())
const kx = (k0.music.x) * 0.8, ky = (k0.music.y + 14) * 0.8
await dragTo(kx, ky, kx + 60, ky)
console.log("after drag right:", await knobProbe())
const k1 = JSON.parse(await knobProbe())
await dragTo(k1.music.x * 0.8, k1.music.y * 0.8 + 12, k1.music.x * 0.8 - 50, k1.music.y * 0.8 + 12)
console.log("after drag left:", await knobProbe())

// — клик по полосе эффектов (func + getMousePosition/getScreenCTM) —
// полоса эффектов: viewBox (975..1195, 452..466) → клиентские
await clickAt(1120 * 0.8, 459 * 0.8)
console.log("after fx bar click:", await knobProbe())

// — «Звук выкл.»: baseVal-запись x на обоих ползунках (975) —
const btns = await ev(`JSON.stringify(window.__BACKEND.dumpUI().filter(u => u.href && u.href.includes("buttonUp")).map(u => ({ x: Math.round((u.b.minX + u.b.maxX) / 2), y: Math.round((u.b.minY + u.b.maxY) / 2) })))`, true)
const off = JSON.parse(btns).find(b => b.y < 380 * 0.8)
if (off) await clickAt(off.x, off.y)
console.log("after sound off:", await knobProbe())

// — чекбокс теней: display галочки меняется, noShadows flips —
const st0 = JSON.parse(await knobProbe())
await clickAt(700 * 0.8 + 17 * 0.8, 522 * 0.8 + 17 * 0.8)
const st1 = JSON.parse(await knobProbe())
console.log("shadows toggle:", st0.vol.noShadows, "→", st1.vol.noShadows, "| checkmark:", st0.check, "→", st1.check)
await shot("r51_settings")

// — закрыть настройки и вернуть громкости (сохраняются в localStorage!) —
await clickAt(960 * 0.8 + 250 * 0.8, 846 * 0.8)
await S(300)
await ev(`(() => { const st = window.__ST.status.settings; st.musicVolume = 0.2; st.soundVolume = 0.2; st.noShadows = ${st0.vol.noShadows};
  return import("./scripts/settings.js").then(m => {}) })()`, true)
const fin = await ev(`JSON.stringify({ errs: window.__errs, panels: window.__ST.status.panels })`, true)
console.log("final:", fin)
