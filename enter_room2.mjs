// Телепорт над второй дверью → шаги вниз/вверх → комната должна открыться (враги)
import { connect } from "./cdp.mjs"
const conn = await connect()
const send = conn.send
const S = (ms) => new Promise(r => setTimeout(r, ms))
const ev = (e, ap=false) => send("Runtime.evaluate", { expression: e, awaitPromise: ap, returnByValue: true })
  .then(r => { if (r.exceptionDetails) throw new Error("eval: " + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || "").slice(0, 300)); return r.result.value })
const key = async (code, down) => send("Input.dispatchKeyEvent", { type: down ? "keyDown" : "keyUp", code, windowsVirtualKeyCode: 0, nativeVirtualKeyCode: 0 })
const walk = async (code, ms) => { await key(code, true); await S(ms); await key(code, false); await S(80) }
// над дверью 2 (2208,1440): подход сверху
await ev(`window.__BACKEND.spritePos(window.__ST.status.hero.obj.img, 2224, 1408)`)
await S(250)
for (let i = 0; i < 6 && true; i++) {
  await walk("ArrowDown", 400)
  await walk("ArrowUp", 120)
  const st = JSON.parse(await ev(`JSON.stringify({ objs: window.__ST.objectValues.length, y: window.__ST.status.hero.y })`))
  console.log("iter", i, st)
  if (st.objs > 1) break
}
console.log(await ev(`JSON.stringify({ openRooms: (() => { const l = window.__ST.dataGeneric.scenes[window.__ST.status.levelFloor]; let n = 0; for (const r of l.roomsArr) if (r[3] === 1) n++; return n })(), warns: (window.__warns||[]).length })`))
conn.close(); process.exit(0)
