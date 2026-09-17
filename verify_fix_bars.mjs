// Фикс z-порядка attachShim: текст ХП/опыта должен быть ВЫШЕ нативных заливок worldBar.
// Урон в бою → скриншот + программная проверка индексов в raw-дереве слоя 2.
import { connect } from "./cdp.mjs"
import { writeFileSync } from "fs"

const S = (ms) => new Promise(r => setTimeout(r, ms))
const conn = await connect()
const send = conn.send
await send("Page.enable", {})
await send("Runtime.enable", {})
const ev = (e, ap = false) => send("Runtime.evaluate", { expression: e, awaitPromise: ap, returnByValue: true })
  .then(r => { if (r.exceptionDetails) throw new Error("eval: " + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || "").slice(0, 500)); return r.result.value })
await ev(`window.__errs = []; window.addEventListener('error', e => window.__errs.push(String(e.message)))`)
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
const key = async (code, down) => send("Input.dispatchKeyEvent", { type: down ? "keyDown" : "keyUp", code, windowsVirtualKeyCode: 0, nativeVirtualKeyCode: 0 })
const walk = async (code, ms) => { await key(code, true); await S(ms); await key(code, false); await S(80) }
const uiButtons = async () => JSON.parse(await ev(`JSON.stringify(window.__BACKEND.dumpUI().filter(u => u.text && u.b).map(u => ({ t: u.text, x: Math.round((u.b.minX + u.b.maxX) / 2), y: Math.round((u.b.minY + u.b.maxY) / 2) })))`))

await send("Page.reload", { ignoreCache: true })
await S(4500)
for (let i = 0; i < 18; i++) {
  const st = JSON.parse(await ev(`JSON.stringify({ start: window.__ST.status.start, objs: window.__ST.objectValues.length })`))
  if (st.start === 1 && st.objs > 0) break
  const buttons = await uiButtons()
  const find = t => buttons.find(b => b.t === t)
  if (find("ДАЛЕЕ")) { await clickAt(find("ДАЛЕЕ").x, find("ДАЛЕЕ").y); await S(700); continue }
  if (find("НОВАЯ ИГРА")) {
    await clickAt(find("НОВАЯ ИГРА").x, find("НОВАЯ ИГРА").y); await S(700)
    if (find("ДА")) { await clickAt(find("ДА").x, find("ДА").y); await S(700) }
    continue
  }
  await clickAt(382, 300); await S(500)
}
await S(1000)
// урон: телепорт в комнату с врагами и стоять — враги бьют
const tp = JSON.parse(await ev(`(function(){
  const lvl = window.__ST.dataGeneric.scenes[window.__ST.status.levelFloor]
  for (let r = 0; r < lvl.roomsArr.length; r++) {
    const rec = lvl.roomsArr[r]
    if (rec[3] === 1 || !rec[2] || !rec[2].length) continue
    const f = lvl.floor[rec[0]]
    for (let y = f[1] + 1; y < f[1] + f[3]; y++) for (let x = f[0] + 1; x < f[0] + f[2]; x++) {
      let blocked = false
      for (const w of lvl.walls) if (x >= w[0] && x < w[0] + w[3] && y >= w[1] && y < w[1] + w[4]) { blocked = true; break }
      if (!blocked) return JSON.stringify({ ok: true, x: x * 32, y: y * 32 })
    }
  }
  return JSON.stringify({ ok: false })
})()`, true))
if (!tp.ok) { console.log("NO ROOM"); conn.close(); process.exit(1) }
await ev(`window.__ST.status.info.hp = 999`)
await ev(`window.__BACKEND.spritePos(window.__ST.status.hero.obj.img, ${tp.x}, ${tp.y})`)
await S(250)
await walk("ArrowDown", 300)
let hp = 0
for (let i = 0; i < 12; i++) {
  await S(1500)
  hp = await ev(`Math.round(window.__ST.status.info.hp)`)
  if (hp > 0 && hp < 40) break
  hp > 0 && await ev(`window.__ST.status.info.hp = Math.min(window.__ST.status.info.hp, 999)`)
}
console.log("hp after damage:", hp)
// Z-ПОРЯДОК: индекс текста ХП в raw-дереве слоя 2 должен быть БОЛЬШЕ индекса заливки
const z = await ev(`(function(){
  const layer = document.getElementById("hpText").node.parent
  const t = layer.getChildIndex(document.getElementById("hpText").node)
  const f = layer.getChildIndex(document.getElementById("hpBarI").node)
  const e = layer.getChildIndex(document.getElementById("expText").node)
  const ef = layer.getChildIndex(document.getElementById("expBarI").node)
  return JSON.stringify({ hpText: t, hpFill: f, ok: t > f, expText: e, expFill: ef, expOk: e > ef })
})()`, true)
console.log("z-order:", z)
const hpText = await ev(`document.getElementById("hpText").textContent`)
console.log("hpText:", hpText)
await shot("r4x_bars_fixed")
const errs = await ev(`JSON.stringify({ errs: window.__errs, warns: (window.__warns || []).length, loopErr: window.__loopErr || null })`, true)
console.log("final:", errs)
conn.close(); process.exit(0)
