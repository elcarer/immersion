import { connect } from "./cdp.mjs"
const conn = await connect()
const ev = (e, ap=false) => conn.send("Runtime.evaluate", { expression: e, awaitPromise: ap, returnByValue: true })
  .then(r => { if (r.exceptionDetails) throw new Error("eval: " + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || "").slice(0, 300)); return r.result.value })
const a = await ev(`window.__BACKEND.app.ticker.FPS`)
await new Promise(r => setTimeout(r, 3000))
const b = await ev(`JSON.stringify({ fps: Math.round(window.__BACKEND.app.ticker.FPS), warns: (window.__warns||[]).length, shims: (() => { let n = 0; const w = s => { n++; (s.children||[]).forEach(w) }; window.__BACKEND.layers.forEach(w); return n })(), layerRaw: window.__BACKEND.layers.map(l => l.node.children.length) })`)
console.log("fps1:", a, "fps2:", b)
conn.close(); process.exit(0)
