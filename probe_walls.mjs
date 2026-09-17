import { connect } from "./cdp.mjs"
const conn = await connect()
const ev = (e, ap=false) => conn.send("Runtime.evaluate", { expression: e, awaitPromise: ap, returnByValue: true })
  .then(r => { if (r.exceptionDetails) throw new Error("eval: " + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || "").slice(0, 400)); return r.result.value })
console.log(await ev(`(() => {
  const lvl = window.__ST.dataGeneric.scenes[window.__ST.status.levelFloor]
  // стены-кандидаты: (2720,1792) w5/w25, (2720,1888) w8, (2720,1952) w3
  const cand = lvl.walls.filter(w => w[0] === 85 && w[1] >= 56 && w[1] <= 63)
  const recs = cand.map(w => ({ x: w[0], y: w[1], t: w[2], w: w[3], h: w[4], owner: w[5], idx: w[6] }))
  // какие открытые комнаты покрывают клетку (85, y)?
  const rooms = []
  for (let r = 0; r < lvl.roomsArr.length; r++) {
    const rec = lvl.roomsArr[r], f = lvl.floor[rec[0]]
    rooms.push({ idx: rec[0], fx: f[0], fy: f[1], fw: f[2], fh: f[3], open: rec[3] })
  }
  const actual = []
  for (const n of window.__ST.svgArr[1].node.children) {
    if (n.x === 2720 && n.y >= 1792 && n.y <= 1984) {
      const fn = (n.texture && n.texture.source && n.texture.source._filename) || ""
      actual.push({ y: n.y, fn: fn.slice(fn.lastIndexOf("/") + 1), w: Math.round(n.width), h: Math.round(n.height) })
    }
  }
  return JSON.stringify({ recs: recs.slice(0, 12), rooms: rooms.filter(m => m.open === 1), actual })
})()`, true))
conn.close(); process.exit(0)
