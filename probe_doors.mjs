import { connect } from "./cdp.mjs"
const conn = await connect()
const ev = (e, ap=false) => conn.send("Runtime.evaluate", { expression: e, awaitPromise: ap, returnByValue: true })
  .then(r => { if (r.exceptionDetails) throw new Error("eval: " + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || "").slice(0, 300)); return r.result.value })
console.log(await ev(`JSON.stringify({
  doors: (window.__ST.doorPics||[]).map(p => ({ href: p.getAttribute && p.getAttribute("href"), kind: p.kind, x: p.x && p.x.animVal.value, y: p.y && p.y.animVal.value, dead: p._dead })),
  overlay: (window.__ST.wallsOverlay||[]).length,
  hero: { x: window.__ST.status.hero.x, y: window.__ST.status.hero.y }
})`))
conn.close(); process.exit(0)
