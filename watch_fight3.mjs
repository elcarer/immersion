// Стоячий бой: авто-атака по ближайшим; снапшоты раз в 2с; следим за дропом/трупами/ошибками
import { connect } from "./cdp.mjs"
import { writeFileSync } from "fs"
const conn = await connect()
const send = conn.send
const S = (ms) => new Promise(r => setTimeout(r, ms))
const ev = (e, ap=false) => send("Runtime.evaluate", { expression: e, awaitPromise: ap, returnByValue: true })
  .then(r => { if (r.exceptionDetails) throw new Error("eval: " + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || "").slice(0, 300)); return r.result.value })
const snap = () => ev(`JSON.stringify((function(){
  const o = window.__ST.objectValues
  const hero = window.__ST.status.hero.obj
  const enemies = o.filter(d => d.type === "enemy")
  const nearest = enemies.length && hero.rect ? Math.min.apply(null, enemies.map(e => Math.hypot(e.rect.x.animVal.value - hero.rect.x.animVal.value, e.rect.y.animVal.value - hero.rect.y.animVal.value))) : -1
  return { enemies: enemies.length, corpses: o.filter(d => d.type === "corpse").length,
    bullets: o.filter(d => d.type === "bullet").length,
    fx: o.filter(d => d.type === "effect").length,
    hp: Math.round(window.__ST.status.info.hp), kills: window.__ST.status.info.bossKill,
    dropArr: (window.dropArrSize !== undefined ? window.dropArrSize : -1),
    screenPic: window.__ST.screenPic.filter(Boolean).length,
    warns: (window.__warns||[]).length, loopErr: window.__loopErr || null }
})())`)
for (let i = 0; i < 10; i++) {
  await S(2000)
  console.log(i, await snap())
}
const r = await send("Page.captureScreenshot", { format: "png" })
writeFileSync("D:/ZCode/project2/shots/r3_battle.png", Buffer.from(r.data, "base64"))
conn.close(); process.exit(0)
