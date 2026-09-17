(async () => {
  const S = ms => new Promise(r => setTimeout(r, ms))
  try {
    const B = window.__BACKEND
    const { image } = await import("./scripts/svg.js")
    const src = "./images/enemy/bat/others/wait.png"
    const map = B.SHEETS[src]
    const img = image(B.layers[2], 300, 300, map.fw * 4, map.fh, src, { times: 4 })
    const obj = { type: "effect", img, rect: img.clipRect, currentAnim: { times: 4, img: src, once: 0 },
      currentStill: 0, animCounters: 0, stats: {} }
    window.__ST.objectValues.push(obj)
    await S(250)
    const before = { ecs: obj._ecs, shimStill: img._still, compStill: COMPONENTS.animStill[obj._ecs], vis: img.node.visible }
    obj.currentStill = 2
    await S(250)
    const after = { shimStill: img._still, compStill: COMPONENTS.animStill[obj._ecs],
      frameX: img.node.texture.frame ? Math.round(img.node.texture.frame.x) : -1 }
    obj.rect.setAttribute("x", 305)
    await S(250)
    const pos = { nodeX: Math.round(img.node.x), compX: Math.round(COMPONENTS.posX[obj._ecs]) }
    const i = window.__ST.objectValues.indexOf(obj)
    if (i !== -1) window.__ST.objectValues.splice(i, 1)
    img.remove()
    window.__probe = JSON.stringify({ before, after, pos })
  } catch (e) { window.__probe = "ERR:" + (e && e.message) }
})().then(() => {})
