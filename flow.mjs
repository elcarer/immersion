// Авто-флоу: заставка → лобби → комиксы → этаж + диагностика E-3/спрайтшитов.
// node flow.mjs game
import { connect } from "./cdp.mjs"
import { writeFileSync } from "fs"

const S = (ms) => new Promise(r => setTimeout(r, ms))
const conn = await connect()
const send = conn.send
await send("Page.enable", {})
await send("Runtime.enable", {})

const ev = (expr, ap = false) => send("Runtime.evaluate", { expression: expr, awaitPromise: ap, returnByValue: true })
  .then(r => { if (r.exceptionDetails) throw new Error("eval: " + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || "").slice(0, 300)); return r.result.value })

async function buttons() {
  return JSON.parse(await ev(`JSON.stringify(window.__BACKEND.dumpUI().filter(u => u.text && u.b).map(u => ({t: u.text, x: Math.round((u.b.minX + u.b.maxX) / 2), y: Math.round((u.b.minY + u.b.maxY) / 2)})))`))
}
async function clickAt(x, y) {
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none", buttons: 0, pointerType: "mouse" })
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1, pointerType: "mouse" })
  await S(60)
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1, pointerType: "mouse" })
  await S(400)
}
async function clickText(t, { exact = false } = {}) {
  const list = await buttons()
  const hit = list.find(b => exact ? b.t === t : b.t.toUpperCase().includes(t.toUpperCase()))
  if (!hit) return "no:" + t + " have:" + list.map(b => b.t).join("|")
  await clickAt(hit.x, hit.y)
  return "clicked:" + hit.t
}
const shot = async (name) => {
  const r = await send("Page.captureScreenshot", { format: "png" })
  writeFileSync(`D:/ZCode/project2/shots/${name}.png`, Buffer.from(r.data, "base64"))
}
const state = () => ev(`JSON.stringify({
  start: window.__ST.start,
  objs: window.__ST.objectValues.length,
  ganim: world.queries.ganim.entities.length,
  genemy: world.queries.genemy.entities.length,
  gbullet: world.queries.gbullet.entities.length,
  gpet: world.queries.gpet.entities.length,
  gfx: world.queries.gfx.entities.length,
  warns: (window.__warns || []).length,
  loopErr: window.__loopErr || null
})`)

const mode = process.argv[2] || "game"
if (mode === "game") {
  // универсальный перезапуск из любого экрана: ДАЛЕЕ/НОВАЯ ИГРА(+ДА) до живого этажа
  for (let i = 0; i < 18; i++) {
    const st = JSON.parse(await state())
    if (st.start === 1 && st.objs > 0) break
    const b = await buttons()
    if (b.some(x => x.t === "ДАЛЕЕ")) { console.log(await clickText("ДАЛЕЕ")); await S(900); continue }
    if (b.some(x => x.t === "НОВАЯ ИГРА")) {
      console.log(await clickText("НОВАЯ ИГРА")); await S(900)
      const d = await clickText("ДА", { exact: true })
      if (!d.startsWith("no")) console.log(d)
      await S(900)
      continue
    }
    await clickAt(382, 300); await S(700)   // комиксы/заставка — тыкаем в центр
  }
  await S(1500)
  console.log("state:", await state())
  await shot("floor")
}
conn.close()
process.exit(0)
