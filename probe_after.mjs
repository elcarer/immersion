import { connect } from "./cdp.mjs"
const conn = await connect()
const ev = (e, ap=false) => conn.send("Runtime.evaluate", { expression: e, awaitPromise: ap, returnByValue: true })
  .then(r => { if (r.exceptionDetails) throw new Error("eval: " + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || "").slice(0, 300)); return r.result.value })
console.log(await ev(`JSON.stringify({
  hero: { x: window.__ST.status.hero.x, y: window.__ST.status.hero.y, rect: (() => { const r = window.__ST.status.hero.obj.rect; return [r.x.animVal.value, r.y.animVal.value] })() },
  doors: (window.__ST.doorPics||[]).map(p => ({ href: p.getAttribute("href"), x: p.x.animVal.value, y: p.y.animVal.value, dead: p._dead || 0 })),
  openRooms: (() => { const l = window.__ST.dataGeneric.scenes[window.__ST.status.levelFloor]; let n = 0; for (const r of l.roomsArr) if (r[3] === 1) n++; return n })(),
  objs: window.__ST.objectValues.length,
  warns: (window.__warns||[]).length
})`))
conn.close(); process.exit(0)
