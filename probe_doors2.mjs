import { connect } from "./cdp.mjs"
const conn = await connect()
const ev = (e, ap=false) => conn.send("Runtime.evaluate", { expression: e, awaitPromise: ap, returnByValue: true })
  .then(r => { if (r.exceptionDetails) throw new Error("eval: " + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || "").slice(0, 300)); return r.result.value })
console.log(await ev(`(() => {
  const lvl = window.__ST.dataGeneric.scenes[window.__ST.status.levelFloor]
  const open = []
  for (let r = 0; r < lvl.roomsArr.length; r++) if (lvl.roomsArr[r][3] === 1) open.push(r)
  const isDoor = t => t === 9 || t === 12 || t === 23 || t === 24
  let doorTypes = {}
  for (const w of lvl.walls) if (isDoor(w[2])) doorTypes[w[2]] = (doorTypes[w[2]] || 0) + 1
  let ownedDoors = 0, inRangeDoors = 0
  for (const r of open) {
    const rec = lvl.roomsArr[r], f = lvl.floor[rec[0]]
    for (const w of lvl.walls) {
      if (!isDoor(w[2]) || w[5] !== rec[0]) continue
      ownedDoors++
      if (w[0] >= f[0] && w[0] < f[0] + f[2] && w[1] >= f[1] && w[1] <= f[1] + f[3]) inRangeDoors++
    }
  }
  const sprites = window.__ST.svgArr[1].node.children
  let doorSprites = 0
  for (const n of sprites) {
    const fn = (n.texture && n.texture.source && n.texture.source._filename) || ""
    if (fn.indexOf("/walls/9.png") >= 0 || fn.indexOf("/walls/12.png") >= 0 || fn.indexOf("/walls/23.png") >= 0 || fn.indexOf("/walls/24.png") >= 0) doorSprites++
  }
  return JSON.stringify({ openRooms: open.length, doorTypes, ownedDoors, inRangeDoors, doorSprites, layer1: sprites.length })
})()`, true))
conn.close(); process.exit(0)
