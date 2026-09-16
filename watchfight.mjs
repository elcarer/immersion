import { connect } from "./cdp.mjs"
import { writeFileSync } from "fs"
const S = (ms) => new Promise(r => setTimeout(r, ms))
const conn = await connect()
const send = conn.send
const ev = (expr) => send("Runtime.evaluate", { expression: expr, returnByValue: true })
  .then(r => { if (r.exceptionDetails) throw new Error("eval: " + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || "").slice(0, 300)); return r.result.value })
const probe = `JSON.stringify((function(){
  const o = window.__ST.objectValues
  const byType = {}
  for (const d of o) byType[d.type] = (byType[d.type] || 0) + 1
  return { types: byType, gb: world.queries.gbullet.entities.length, hp: window.__ST.status.info.hp, exp: window.__ST.status.info.exp, time: window.__ST.status.time }
})())`
let seen = {}
for (let i = 0; i < 20; i++) {
  await S(1000)
  seen = JSON.parse(await ev(probe))
  if ((seen.types.bullet || 0) > 0 || (seen.types.corpse || 0) > 0 || seen.exp > 0) console.log("t" + i, JSON.stringify(seen))
  if ((seen.types.corpse || 0) > 0 || seen.exp > 0) break
}
const r = await send("Page.captureScreenshot", { format: "png" })
writeFileSync("D:/ZCode/project2/shots/fight_live.png", Buffer.from(r.data, "base64"))
console.log("final:", JSON.stringify(seen))
conn.close()
process.exit(0)
