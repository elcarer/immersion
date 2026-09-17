// Диагностика репорта: «анимация смерти играет не полностью».
// Смертельный урон → семплим каждый ~120мс: компонент animStill, применённый кадр
// (sprite._still), href, currentStill, членство в ganim — и скриншоты.
import { connect } from "./cdp.mjs"
import { writeFileSync } from "fs"

const S = (ms) => new Promise(r => setTimeout(r, ms))
const conn = await connect()
const send = conn.send
await send("Page.enable", {})
await send("Runtime.enable", {})
const ev = (e, ap = false) => send("Runtime.evaluate", { expression: e, awaitPromise: ap, returnByValue: true })
  .then(r => { if (r.exceptionDetails) throw new Error("eval: " + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || "").slice(0, 600)); return r.result.value })
const shot = async (name) => {
  const r = await send("Page.captureScreenshot", { format: "png" })
  writeFileSync(`D:/ZCode/project2/shots/${name}.png`, Buffer.from(r.data, "base64"))
}
const clickAt = async (x, y) => {
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none", buttons: 0, pointerType: "mouse" })
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1, pointerType: "mouse" })
  await S(60)
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1, pointerType: "mouse" })
  await S(400)
}
const uiButtons = async () => JSON.parse(await ev(`JSON.stringify(window.__BACKEND.dumpUI().filter(u => u.text && u.b).map(u => ({ t: u.text, x: Math.round((u.b.minX + u.b.maxX) / 2), y: Math.round((u.b.minY + u.b.maxY) / 2) })))`))
const clickBtn = async (t) => {
  const find = (await uiButtons()).find(b => b.t === t)
  if (!find) return false
  await clickAt(find.x, find.y)
  return true
}

await send("Page.reload", { ignoreCache: true })
await S(4500)
for (let i = 0; i < 18; i++) {
  const st = JSON.parse(await ev(`JSON.stringify({ start: window.__ST.status.start, objs: window.__ST.objectValues.length })`))
  if (st.start === 1 && st.objs > 0) break
  if (await clickBtn("ДАЛЕЕ")) { await S(500); continue }
  if (await clickBtn("НОВАЯ ИГРА")) { await S(500); await clickBtn("ДА"); continue }
  await clickAt(382, 300); await S(400)
}
console.log("flow:", await ev(`JSON.stringify({ start: window.__ST.status.start, objs: window.__ST.objectValues.length })`))

// смертельный урон (мимо врагов — детерминированно)
await ev(`import("./scripts/takeDamage.js").then(m => { window.__dmg = m; m.takeDamage(9999, null, null) })`, true)
await S(100)

// проба состояния анимации смерти
const probe = `(() => {
  const hero = window.__ST.status.hero.obj
  const id = hero._ecs
  const spr = window.DATA && window.DATA.sprite ? window.DATA.sprite[id] : null
  const inGanim = window.world && window.world.queries.ganim ? window.world.queries.ganim.entities.includes(id) : null
  const inBattle = window.world && window.world.queries.battle ? window.world.queries.battle.entities.includes(id) : null
  const inOV = window.__ST.objectValues.indexOf(hero)
  return JSON.stringify({
    type: hero.type, stop: hero.stop, ecs: id,
    stillComp: window.COMPONENTS ? window.COMPONENTS.animStill[id] : null,
    counter: window.COMPONENTS ? Math.round(window.COMPONENTS.animCounter[id]) : null,
    curStill: hero.currentStill,
    applied: spr ? spr._still : null,
    href: spr ? String(spr.attrs.href).split("/").slice(-2).join("/") : null,
    frameW: spr ? spr._frameW : null,
    frames: spr && spr._frames ? spr._frames.length : null,
    nodeW: spr && spr.node ? spr.node.width : null,
    inGanim, inBattle, inOV,
    start: window.__ST.status.start,
  })
})()`

for (let t = 0; t <= 2600; t += 130) {
  const s = await ev(probe)
  console.log(`t=${String(t).padStart(4)}:`, s)
  if (t === 130 || t === 520 || t === 900 || t === 1600 || t === 2500) await shot(`death_t${t}`)
  await S(130)
}
