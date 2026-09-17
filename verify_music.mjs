// Фикс музыки: самопочинка зацикливания. Flow до лобби (таверна, activeTrack=3) →
// срез __MUSIC → kill(3) (штатного пути смерти источника нет — stop эмулирует
// нештатную смерть) → через onended источник обязан пересоздаться тем же гейном.
import { connect } from "./cdp.mjs"

const S = (ms) => new Promise(r => setTimeout(r, ms))
const conn = await connect()
const send = conn.send
await send("Page.enable", {})
await send("Runtime.enable", {})
const ev = (e, ap = false) => send("Runtime.evaluate", { expression: e, awaitPromise: ap, returnByValue: true })
  .then(r => { if (r.exceptionDetails) throw new Error("eval: " + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || "").slice(0, 500)); return r.result.value })
const clickAt = async (x, y) => {
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none", buttons: 0, pointerType: "mouse" })
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1, pointerType: "mouse" })
  await S(60)
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1, pointerType: "mouse" })
  await S(500)
}
const uiButtons = async () => JSON.parse(await ev(`JSON.stringify(window.__BACKEND.dumpUI().filter(u => u.text && u.b).map(u => ({ t: u.text, x: Math.round((u.b.minX + u.b.maxX) / 2), y: Math.round((u.b.minY + u.b.maxY) / 2) })))`))

await send("Page.reload", { ignoreCache: true })
await S(4500)
let snap = null
let reached = false
for (let i = 0; i < 25; i++) {
  snap = await ev(`window.__MUSIC.snap()`)
  if (snap.activeTrack === 3) { reached = true; break }
  const buttons = await uiButtons()
  const find = t => buttons.find(b => b.t.toUpperCase().includes(t))
  if (snap.activeTrack === 1) {
    if (find("ПРОДОЛЖИТЬ")) { await clickAt(find("ПРОДОЛЖИТЬ").x, find("ПРОДОЛЖИТЬ").y); continue }
    if (find("НОВАЯ ИГРА")) {
      await clickAt(find("НОВАЯ ИГРА").x, find("НОВАЯ ИГРА").y); await S(500)
      const da = find("ДА")
      if (da) await clickAt(da.x, da.y)
      continue
    }
  }
  // комикс/промежуточные экраны (музыка none): листаем «ДАЛЕЕ»
  if (find("ДАЛЕЕ")) { await clickAt(find("ДАЛЕЕ").x, find("ДАЛЕЕ").y); continue }
  await S(800)
}
console.log("lobby reached:", reached)
if (!reached) { conn.close(); process.exit(1) }
await S(800)
const before = await ev(`window.__MUSIC.snap()`)
console.log("before:", JSON.stringify(before))
const tavern = before.tracks.find(t => t.track === 3)
if (!tavern || !tavern.loop) { console.log("FAIL: tavern track missing or not looping"); conn.close(); process.exit(1) }
// kill: источники не останавливаются штатно никогда — stop() = нештатная смерть
await ev(`window.__MUSIC.kill(3)`)
await S(400)
const after = await ev(`window.__MUSIC.snap()`)
console.log("after:", JSON.stringify(after))
const tav2 = after.tracks.find(t => t.track === 3)
const ok = after.activeTrack === 3 && tav2 && tav2.loop && tav2.gain === tavern.gain && after.trackGen > before.trackGen
console.log(ok ? "SELF-HEAL OK" : "SELF-HEAL FAIL")
conn.close(); process.exit(ok ? 0 : 1)
