// R3 аудит: счётчики узлов мира на этаже
import { connect } from "./cdp.mjs"
const conn = await connect()
const send = conn.send
const ev = (expr, ap = false) => send("Runtime.evaluate", { expression: expr, awaitPromise: ap, returnByValue: true })
  .then(r => { if (r.exceptionDetails) throw new Error("eval: " + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || "").slice(0, 400)); return r.result.value })
const res = await ev(`(() => {
  const L = window.__ST.svgArr
  const sp = window.__ST.screenPic
  let wallDraws = 0, objDraws = 0, floorDraws = 0, ui = 0
  const sampleIds = []
  for (const p of sp) { if (!p) continue; const id = String(p.id || "")
    if (sampleIds.length < 6 && id) sampleIds.push(id)
    if (/^\d+WI$/.test(id)) wallDraws++
    else if (/^\d+OI$/.test(id)) objDraws++
    else if (id === "") floorDraws++
    else ui++ }
  const lvl = window.__ST.dataGeneric.scenes[window.__ST.status.levelFloor]
  let owned = 0
  for (const w of lvl.walls) if (w[5] !== undefined) owned++
  return JSON.stringify({
    screenPic: sp.length, alive: sp.filter(Boolean).length,
    wallDraws, objDraws, floorDraws, ui, sampleIds,
    wallsData: lvl.walls.length, wallsOwned: owned,
    layer0Raw: L[0].node.children.length, layer1Raw: L[1].node.children.length,
    doorPics: window.__ST.doorPics.length, wallsOverlay: window.__ST.wallsOverlay.length,
    floor: window.__ST.status.levelFloor
  })
})()`, true)
console.log(res)
