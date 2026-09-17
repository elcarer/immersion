// E-17: подсказка героя в лобби при наведении на куклу — по образцу карточки врага:
// имя, портрет, начальные характеристики (5 статов из data.js), описание геймплея.
// Проверка: hover на T0 (Плут) показывает «Сила: 3» и RU-desc; уход курсора гасит
// карточку; hover на T1 (Волшебница) — «Мудрость: 9».
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
const moveMouse = async (x, y) => {
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none", buttons: 0, pointerType: "mouse" })
  await S(250)
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
const exceptions = () => conn.events
  .filter(e => e.method === "Runtime.exceptionThrown")
  .map(e => (e.params.exceptionDetails.exception && e.params.exceptionDetails.exception.description || e.params.exceptionDetails.text || "").slice(0, 300))
const dollPos = async (i) => JSON.parse(await ev(`JSON.stringify(window.__BACKEND.dumpUI().filter(u => u.href && u.href.includes('doll/T${i}.png')).map(u => ({ x: Math.round((u.b.minX + u.b.maxX) / 2), y: Math.round((u.b.minY + u.b.maxY) / 2) })))`, true))
const texts = () => ev(`JSON.stringify(window.__BACKEND.dumpUI().filter(u => u.text).map(u => u.text))`, true).then(s => JSON.parse(s))

await send("Page.reload", { ignoreCache: true })
await S(4500)
//флоу: НОВАЯ ИГРА → ДА → лобби (start=0)
let inLobby = false
for (let i = 0; i < 16; i++) {
  const st = JSON.parse(await ev(`JSON.stringify({ start: window.__ST.status.start })`))
  const dolls = await dollPos(0)
  if (st.start === 0 && dolls.length) { inLobby = true; break }
  if (await clickBtn("ДА")) { await S(500); continue }
  if (await clickBtn("НОВАЯ ИГРА")) { await S(500); continue }
  await S(500)
}
console.log("inLobby:", inLobby)
if (!inLobby) { console.log("FAIL: лобби не открылось"); process.exit(1) }

//hover на Плута (T0)
const d0 = await dollPos(0)
await moveMouse(d0[0].x, d0[0].y)
await moveMouse(d0[0].x + 2, d0[0].y + 2)   //смена позиции — гарантия mouseover
await S(300)
let t = await texts()
const descOpen = await ev(`JSON.stringify((function(){ const s = window.__BACKEND.shimById.get('heroTipDesc'); return !!s && !s._dead })())`, true).then(s => JSON.parse(s))
const rogueTip = t.some(s => s.includes("Сила: 3")) && t.some(s => s.includes("Ловкость: 7")) && descOpen
console.log("Плут-карточка:", rogueTip ? "OK" : "FAIL", "| текстов:", t.length)
if (!rogueTip) { console.log(t.join(" | ").slice(0, 800)); process.exit(1) }
await shot("e17_lobby_rogue")

//уход курсора — карточка гаснет
await moveMouse(960, 900)
await S(300)
t = await texts()
const descGone = await ev(`JSON.stringify((function(){ const s = window.__BACKEND.shimById.get('heroTipDesc'); return !s || !!s._dead })())`, true).then(s => JSON.parse(s))
const gone = !t.some(s => s.includes("Сила: 3")) && descGone
console.log("уход гасит:", gone ? "OK" : "FAIL")
if (!gone) { console.log(t.join(" | ").slice(0, 800)); process.exit(1) }

//hover на Волшебницу (T1)
const d1 = await dollPos(1)
await moveMouse(d1[0].x, d1[0].y)
await moveMouse(d1[0].x + 2, d1[0].y + 2)
await S(300)
t = await texts()
const descOpen2 = await ev(`JSON.stringify((function(){ const s = window.__BACKEND.shimById.get('heroTipDesc'); return !!s && !s._dead })())`, true).then(s => JSON.parse(s))
const mageTip = t.some(s => s.includes("Мудрость: 9")) && t.some(s => s.includes("Волшебница")) && descOpen2
console.log("Волшебница-карточка:", mageTip ? "OK" : "FAIL")
if (!mageTip) { console.log(t.join(" | ").slice(0, 800)); process.exit(1) }
await shot("e17_lobby_mage")

//клик по кукле по-прежнему выбирает героя (имя внизу меняется)
await clickAt(d1[0].x, d1[0].y)
await S(300)
t = await texts()
const picked = t.some(s => s === "Волшебница")
console.log("клик выбирает:", picked ? "OK" : "FAIL")
if (!picked) { console.log(t.join(" | ").slice(0, 800)); process.exit(1) }

//----- багфикс: карточка не переживает del() при смене сцены (старт забега/смерть) -----
//карточка Волшебницы открыта (мышь на кукле после клика); del() — то, что делает сцена
//при старте забега. До фикса heroTip-узлы не регистрировались в screenPic и не гасились —
//карточка висела поверх игры
const killed = await ev(`(async function(){
  const D = await import("./scripts/del.js")
  D.del()
  const shim = window.__BACKEND.shimById.get('heroTipDesc')
  const texts = window.__BACKEND.dumpUI().filter(u => u.text).map(u => u.text)
  return JSON.stringify({ tipShimGone: !shim,
    statLineGone: !texts.some(t => t.includes("Сила:") || t.includes("Мудрость:")) })
})()`, true).then(s => JSON.parse(s))
console.log("del() с открытой карточкой:", JSON.stringify(killed))
const killedOk = killed.tipShimGone && killed.statLineGone
console.log(`карточка снята del(): ${killedOk ? "OK" : "FAIL"}`)
if (!killedOk) process.exit(1)
await shot("e17_after_del")

const exc = exceptions()
console.log("exceptions:", exc.length, exc.slice(0, 3))
if (exc.length) process.exit(1)
console.log("E-17 LOBBY TIP: ВСЁ OK")
process.exit(0)
