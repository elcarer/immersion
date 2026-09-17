// Флоу до этажа, где у стартовой комнаты есть нарисованные закрытые двери
import { connect } from "./cdp.mjs"
const conn = await connect()
const send = conn.send
await send("Page.enable", {})
await send("Runtime.enable", {})
const S = (ms) => new Promise(r => setTimeout(r, ms))
const ev = (e, ap=false) => send("Runtime.evaluate", { expression: e, awaitPromise: ap, returnByValue: true })
  .then(r => { if (r.exceptionDetails) throw new Error("eval: " + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || "").slice(0, 300)); return r.result.value })
for (let attempt = 1; attempt <= 6; attempt++) {
  await send("Page.reload", { ignoreCache: true })
  await S(4500)
  for (let i = 0; i < 18; i++) {
    const st = JSON.parse(await ev(`JSON.stringify({ start: window.__ST.status.start, objs: window.__ST.objectValues.length })`))
    if (st.start === 1 && st.objs > 0) break
    const buttons = JSON.parse(await ev(`JSON.stringify(window.__BACKEND.dumpUI().filter(u => u.text && u.b).map(u => ({ t: u.text, x: Math.round((u.b.minX + u.b.maxX) / 2), y: Math.round((u.b.minY + u.b.maxY) / 2) })))`))
    const click = async (x, y) => {
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none", buttons: 0, pointerType: "mouse" })
      await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1, pointerType: "mouse" })
      await S(60)
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1, pointerType: "mouse" })
      await S(450)
    }
    if (buttons.some(b => b.t === "ДАЛЕЕ")) { await click(buttons.find(b => b.t === "ДАЛЕЕ").x, buttons.find(b => b.t === "ДАЛЕЕ").y); await S(800); continue }
    if (buttons.some(b => b.t === "НОВАЯ ИГРА")) {
      await click(buttons.find(b => b.t === "НОВАЯ ИГРА").x, buttons.find(b => b.t === "НОВАЯ ИГРА").y); await S(800)
      const da = buttons.find(b => b.t === "ДА")
      if (da) { await click(da.x, da.y); await S(800) }
      continue
    }
    await click(382, 300); await S(600)
  }
  await S(1200)
  const n = await ev(`window.__ST.doorPics.length`)
  console.log("attempt", attempt, "doorPics:", n)
  if (n > 0) { console.log("READY"); conn.close(); process.exit(0) }
}
console.log("FAIL: ни на одном этаже нет дверей в doorPics")
conn.close(); process.exit(1)
