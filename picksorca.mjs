import { connect } from "./cdp.mjs"
const S = (ms) => new Promise(r => setTimeout(r, ms))
const conn = await connect()
const send = conn.send
const ev = (expr) => send("Runtime.evaluate", { expression: expr, returnByValue: true })
  .then(r => { if (r.exceptionDetails) throw new Error("eval: " + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || "").slice(0, 300)); return r.result.value })
const click = async (x, y) => {
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none", buttons: 0, pointerType: "mouse" })
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1, pointerType: "mouse" })
  await S(50)
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1, pointerType: "mouse" })
  await S(400)
}
const dolls = JSON.parse(await ev(`JSON.stringify(window.__BACKEND.dumpUI().filter(u => u.href && u.href.includes('doll/T')).map(u => ({href: u.href, x: Math.round((u.b.minX+u.b.maxX)/2), y: Math.round((u.b.minY+u.b.maxY)/2)})))`))
console.log("dolls:", JSON.stringify(dolls))
for (const d of dolls) {
  await click(d.x, d.y)
  const name = await ev(`(function(){ const o = window.__BACKEND.dumpUI().filter(u => u.text); return o.map(u=>u.text).join('|') })()`)
  console.log(d.href, "->", name.slice(0, 60))
  if (name.includes("Сорка")) { console.log("SORCA SELECTED"); break }
}
conn.close()
process.exit(0)
