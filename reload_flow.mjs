// Перезагрузка страницы + флоу до живого этажа (после правок build/)
import { connect } from "./cdp.mjs"
const conn = await connect()
const send = conn.send
await send("Page.enable", {})
await send("Runtime.enable", {})
const S = (ms) => new Promise(r => setTimeout(r, ms))
const ev = (expr, ap = false) => send("Runtime.evaluate", { expression: expr, awaitPromise: ap, returnByValue: true })
  .then(r => { if (r.exceptionDetails) throw new Error("eval: " + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || "").slice(0, 400)); return r.result.value })
await send("Page.reload", { ignoreCache: true })
await S(4000)
// ждём заставку (start() отрисован)
for (let i = 0; i < 20; i++) {
  const ready = await ev(`!!window.__ST && !!window.__BACKEND && document.querySelectorAll("*").length > 0`)
  if (ready) break
  await S(1000)
}
await S(2000)
console.log("reloaded")
conn.close()
process.exit(0)
