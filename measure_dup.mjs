// Дубликаты стен: сколько спрайтов слоя 1 стоят на одной позиции, и вклад цикла B
import { connect } from "./cdp.mjs"
const conn = await connect()
const send = conn.send
const ev = (expr, ap = false) => send("Runtime.evaluate", { expression: expr, awaitPromise: ap, returnByValue: true })
  .then(r => { if (r.exceptionDetails) throw new Error("eval: " + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || "").slice(0, 400)); return r.result.value })
const res = await ev(`(() => {
  const L1 = window.__ST.svgArr[1].node.children
  const pos = new Map()
  for (const n of L1) { const k = n.x + "," + n.y; pos.set(k, (pos.get(k) || 0) + 1) }
  let dupSprites = 0, dupSlots = 0
  pos.forEach(c => { if (c > 1) { dupSlots++; dupSprites += c } })
  const lvl = window.__ST.dataGeneric.scenes[window.__ST.status.levelFloor]
  // вклад цикла B по открытым комнатам: для комнаты r — стены с [5]===floorIdx_r
  let bDraws = 0, bWalls = 0
  for (let r = 0; r < lvl.roomsArr.length; r++) {
    if (lvl.roomsArr[r][3] !== 1) continue
    const f = lvl.floor[lvl.roomsArr[r][0]]
    const tiles = f[2] * (f[3] + 1)
    let k = 0
    for (const w of lvl.walls) if (w[5] === lvl.roomsArr[r][0]) k++
    bWalls += k; bDraws += k * tiles
  }
  return JSON.stringify({ layer1Sprites: L1.length, uniquePos: pos.size, dupSlots, dupSprites, bWalls, bDrawsIfPerTile: bDraws })
})()`, true)
console.log(res)
