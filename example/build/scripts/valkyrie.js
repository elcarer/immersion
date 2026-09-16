// ВСЯ логика способностей Валькирии (class 3).
// Правки дерева скиллов в data.js: у «Дротик-бумеранг» next [10] (было [7]), у «Рывок-отскок» prev [4] (было [5]).
// Активные скиллы (рынок: Вихрь дротиков, Крылья, Аура, Гроза Йотунов) — автокаст при готовности,
// Пронзающий рывок — по нажатию двух РАЗНЫХ направлений за 0.5с (30 кадров), направление = последнее.
// Спрайты-заглушки: дротики — ножи (attacks/knife/*.png), стрелы дротиков — лук (attacks/bow/*.png),
// след ветра — acid.png, аура — healAura.png (финальный). Графика будет заменена позже.
// V57: длительность «Крыльев валькирии» заглушкой больше НЕ отмечается — спрайт героини
// подсвечивается жёлтым фильтром (как «ярость» Вождя гоблинов в enemyAI, но жёлтый оттенок).
import { status } from "../scripts/start.js"
import { objectValues } from "../scripts/del.js"
import { svgArr, image, spritePos, moveSprite, releaseSprite, rectPos } from "../scripts/svg.js"
import { checkCollision } from "../scripts/damage.js"
import { damageEnemy } from "../scripts/enemyAI.js"
import { collision } from "../scripts/collision.js"
import { data } from "../scripts/data.js"
import { dataGeneric } from "../scripts/sceneGenerate.js"
import { floatText } from "../scripts/floatText.js"
import { changeHP } from "../scripts/takeDamage.js"
import { playback, strike } from "../scripts/sound.js"

const DIR_OPPOSITE = { 0: 1, 1: 0, 2: 3, 3: 2 }
//V57: жёлтое свечение героини на duration «Крыльев» — тот же приём, что у «ярости»
//Вождя гоблинов (enemyAI RAGE_FILTER), но hue-rotate в плюс: сепия (~40°) → жёлтый (~60°)
const WINGS_FILTER = "sepia(0.4) saturate(3) hue-rotate(20deg)"
//направления героя (0-верх,1-низ,2-лево,3-право) → ori для collision() (0-верх,1-ПРАВО,2-низ,3-ЛЕВО)
const DIR_TO_COLLISION = { 0: 0, 1: 2, 2: 3, 3: 1 }
//счётчик id для декоративных спрайтов валькирии (след рывка/щит) — НЕ трогает status.oVcount,
//иначе сдвигаются id игровых объектов (objectValues), которые код ищет по id
let dashSpriteId = 0

//главный тик — вызывается из gameLoop раз в кадр (до heroMove)
function valkyrieTick() {
  const info = status.info
  //автокаст активных
  if (info.whirlAbil && info.whirlAbil.cooldown <= 0 && info.whirlAbil.duration <= 0 && !info.whirl) startWhirl()
  if (info.stormAbil && info.stormAbil.cooldown <= 0 && !info.stormCharge) {
    info.stormCharge = 1
    info.stormAbil.cooldown = info.stormAbil.skill.cooldown
    playback(strike[11].vol, 0, 0, status.settings.soundVolume)
  }
  if (info.wingsAbil && info.wingsAbil.cooldown <= 0 && info.wingsAbil.duration <= 0 && !info.wingsGlow) startWings()
  if (info.auraAbil && info.auraAbil.cooldown <= 0 && info.auraAbil.duration <= 0 && !info.auraImg) startAura()
  //дэш — это ДВИЖЕНИЕ: под «очарованием» (V34) замирает, способности выше продолжают
  !info.charm && dashTick()
  //вихрь дротиков
  whirlTick()
  //дротики в полёте
  dartsTick()
  //след ветра
  trailsTick()
  //эффекты высшей справедливости (спрайт поражения 0.5с)
  justiceFxTick()
  //аура/крылья: позиция и завершение
  aurasTick()
  //неуязвимость после рывка: тик, позиция щита, снятие
  if ((info.dashInvuln || 0) > 0) {
    info.dashInvuln--
    if (info.dashShieldImg) {
      //V15: позиция — через spritePos (rect логики + transform рендера); окно кадра
      //(bbox-клип) следует за спрайтом автоматически
      const shieldPos = rectPos(status.hero.obj.rect)
      const hx = shieldPos[0]
      const hy = shieldPos[1]
      spritePos(info.dashShieldImg, hx, hy)
      //щит — ПОД спрайтом героини: держим его в DOM сразу перед героем
      //(checkZOrder при движении перекладывает героя в конец — вставляем заново каждый тик)
      if (svgArr[1].contains(info.dashShieldImg) && svgArr[1].contains(status.hero.obj.img)) {
        svgArr[1].insertBefore(info.dashShieldImg, status.hero.obj.img)
      }
      if (info.dashInvuln <= 0) {
        releaseSprite(info.dashShieldImg)
        info.dashShieldImg = null
        info.dashShieldRect = null
      }
    }
  }
  //импульс: лог клеток
  if (info.impulseAbil) {
    const r = status.hero.obj.rect
    const rPos = rectPos(r)
    const cx = Math.trunc((rPos[0] + 16) / 32)
    const cy = Math.trunc((rPos[1] + 35) / 32)
    const last = info.impulseLast
    if (!last || last.cx !== cx || last.cy !== cy) {
      info.impulseLog = info.impulseLog || []
      info.impulseLog.push({ t: status.time, cx, cy })
      info.impulseLast = { cx, cy }
    }
    while (info.impulseLog.length && status.time - info.impulseLog[0].t > 120) info.impulseLog.shift()
  }
  if ((info.auraHealCd || 0) > 0) info.auraHealCd--
}

//==================== ПРОНЗАЮЩИЙ РЫВОК ====================
//вызывается из keydown в heroMove.js
function dashPress(dir) {
  const info = status.info
  //только во время геймплея (не в меню/панелях); V34: под «очарованием» рывок недоступен
  if (status.start !== 1 || status.move !== 1 || info.charm) return
  if (!info.dashAbil || info.dashAbil.cooldown > 0 || info.dash) return
  const now = status.time
  //двойное быстрое нажатие ОДНОГО направления за 0.3с (19 тиков) — направление = это направление
  if (info.dashLastDir === dir && now - info.dashLastTime <= 19) {
    startDash(dir)
    info.dashLastDir = undefined
    info.dashLastTime = undefined
  } else {
    info.dashLastDir = dir
    info.dashLastTime = now
  }
}
function startDash(dir) {
  const info = status.info
  info.dash = { dir, dist: info.bounceAbil ? 128 : 96, hits: new Set(), cells: new Set(), bounced: 0 }
  info.dashAbil.cooldown = info.dashAbil.skill.cooldown
  setHeroMoveAnim(dir)
  playback(strike[0].vol, 0, 0, 5 * status.settings.soundVolume)
}
function dashTick() {
  const info = status.info
  if (!info.dash) return
  const d = info.dash
  if (status.hero.noStunTime > 0) { endDash(); return }
  const hero = status.hero.obj
  let dPos = rectPos(hero.rect)
  let x = dPos[0]
  let y = dPos[1]
  //стартовая позиция тика — финальную применяем от НЕЁ, а не от сдвинутого циклом x
  const startX = x
  const startY = y
  let moved = 0
  let blocked = false
  //двигаемся по 1px с проверкой коллизии на КАЖДОМ шаге (иначе рывок пролетал сквозь стены)
  while (moved < 6 && d.dist > 0 && !blocked) {
    let nx = x, ny = y
    d.dir === 0 && (ny -= 1)
    d.dir === 1 && (ny += 1)
    d.dir === 2 && (nx -= 1)
    d.dir === 3 && (nx += 1)
    if (collision(nx, ny, dataGeneric.scenes[status.levelFloor], DIR_TO_COLLISION[d.dir])) {
      x = nx
      y = ny
      moved++
      d.dist--
    } else {
      blocked = true
    }
  }
  if (moved > 0) {
    let dx = 0, dy = 0
    d.dir === 2 && (dx = -moved)
    d.dir === 3 && (dx = moved)
    d.dir === 0 && (dy = -moved)
    d.dir === 1 && (dy = moved)
    //V15: движение через moveSprite — кадровое смещение в img.x не трогается
    moveSprite(hero.img, dx, dy)
    status.hero.x = startX + dx
    status.hero.y = startY + dy
    //полупрозрачный след из спрайтов героини (текущий кадр спрайтшита), гаснет и удаляется с концом рывка
    d.trail = d.trail || []
    d.trail.push({
      img: image(svgArr[1], startX, startY, hero.img.width.animVal.value, hero.img.height.animVal.value, hero.img.getAttribute("href"), { times: hero.currentAnim.times, id: "dashTr" + (dashSpriteId++), frame: hero.currentStill, opacity: 0.35 }),
      life: 12,
    })
    //клетки пути (для вихревого следа)
    const fx = Math.trunc((startX + dx + 13) / 32)
    const fy = Math.trunc((startY + dy + 37) / 32)
    d.cells.add(fx + "," + fy)
    //урон врагам на пути
    const hr = hero.rect
    const hrPos = rectPos(hr)
    for (let i = 0; i < objectValues.length; i++) {
      const e = objectValues[i]
      if (e.type !== "enemy" || e.stats.hp <= 0) continue
      if (!d.hits.has(e.id)) {
        const ePos = rectPos(e.rect)
        if (checkCollision(hrPos[0], ePos[0], hr._w, e.rect._w, hrPos[1], ePos[1], hr._h, e.rect._h)) {
        d.hits.add(e.id)
        let dmg = dashDamage()
        if (d.hits.size === 1) {
          const imp = consumeImpulse()
          imp > 0 && (dmg += Math.trunc(dmg * imp / 100))
        }
        damageEnemy(e, dmg)
        }
      }
    }
  }
  //след рывка: постепенно гаснет (удаляется полностью в endDash)
  if (d.trail) {
    for (let i = d.trail.length - 1; i >= 0; i--) {
      const t = d.trail[i]
      t.life--
      if (t.life <= 0) {
        releaseSprite(t.img)
        d.trail.splice(i, 1)
      } else {
        t.img.setAttribute("opacity", 0.35 * (t.life / 12))
      }
    }
  }
  if (blocked) {
    if (info.bounceAbil && d.bounced === 0 && d.dist > 0) {
      d.bounced = 1
      d.dir = DIR_OPPOSITE[d.dir]
      setHeroMoveAnim(d.dir)
    } else {
      endDash()
      return
    }
  }
  if (d.dist <= 0) endDash()
}
function dashDamage() {
  //1 + 1 за каждые 10 Подвижности (Подвижность — % из value2)
  const mobility = parseInt(status.info.stats[3].dops[0].value2.slice(0, -1))
  return 1 + Math.trunc(mobility / 10)
}
function endDash() {
  const info = status.info
  const d = info.dash
  if (d) {
    //след рывка исчезает с завершением рывка
    if (d.trail) {
      for (const t of d.trail) releaseSprite(t.img)
      d.trail = []
    }
    if (info.trailAbil) {
      for (const key of d.cells) {
        const [cx, cy] = key.split(",").map(Number)
        const already = (info.trails || []).some(t => t.x === cx && t.y === cy && t.time > 0)
        if (!already) {
          info.trails = info.trails || []
          info.trails.push({ x: cx, y: cy, time: 120, img: image(svgArr[0], cx * 32, cy * 32, 32, 32, "./images/effects/airPath.png", {}) })
        }
      }
    }
  }
  info.dash = null
  //неуязвимость 0.5с (31 тик) ПОСЛЕ рывка + финальный спрайт щита (effects/immun.png, 192×42/6 кадров).
  //V67: общий механизм вынесен в grantDashShield — им же пользуется «Вечный цитрин»
  grantDashShield()
}
//V67: щит неуязвимости 0.5с (31 тик) + спрайт immun.png — общий для рывка Валькирии и
//«Вечного цитрина» (relic 1: после ЛЮБОЙ активной способности). Повторный вызов просто
//обновляет таймер; спрайт, если уже висит, не пересоздаётся
function grantDashShield() {
  const info = status.info
  info.dashInvuln = 31
  if (!info.dashShieldImg) {
    const hx = status.hero.obj.rect.x.animVal.value
    const hy = status.hero.obj.rect.y.animVal.value
    info.dashShieldImg = image(svgArr[1], hx, hy, 192, 42, "./images/effects/immun.png", { times: 6, id: "dashSh" + (dashSpriteId++), frame: 0 })
    //окно кадра (clipRect) храним отдельно — его надо двигать вместе с картинкой
    info.dashShieldRect = info.dashShieldImg.clipRect
  }
}
function setHeroMoveAnim(dir) {
  const hero = status.hero.obj
  const anim = data.heroes[status.hero.class].anims[0].move[dir]
  hero.currentAnim = anim
  hero.img.setAttribute("href", anim.img)
  hero.img.setAttribute("times", anim.times)
  hero.img.setAttribute("width", anim.w)
  hero.img.setAttribute("height", anim.h)
  status.hero.direction = dir
  hero.stop = 0
  status.hero.waitTime = 0
}

//==================== ВИХРЬ ДРОТИКОВ ====================
function startWhirl() {
  const info = status.info
  const n = (info.whirlDarts || 2) + (info.tornadoAbil ? 2 : 0) //V42: ур. Вихря 2/3/4
  info.whirl = { darts: [], angleBase: 0 }
  for (let k = 0; k < n; k++) {
    //общий спрайт дротика (effects/spear.png, 14×32, остриё вверх) — как у «Боевого танца»
    const img = image(svgArr[1], 0, 0, 14, 32, "./images/effects/spear.png", {})
    info.whirl.darts.push({ img, angle: (k * 2 * Math.PI) / n })
  }
  //длительность всегда случайная: базовая 90 тиков + 0..18 (0–0.3с) → 1.5–1.8с
  info.whirlAbil.duration = info.whirlAbil.skill.duration + Math.trunc(Math.random() * 19)
  playback(strike[11].vol, 0, 0, status.settings.soundVolume)
}
function whirlTick() {
  const info = status.info
  if (!info.whirl) return
  const w = info.whirl
  //закончился duration (его тикает activeSkillsCD) — оставшиеся дротики РАЗЛЕТАЮТСЯ
  //в разные стороны по своим текущим радиальным направлениям (дальше их ведёт dartsTick:
  //полёт, урон врагам, стена/бумеранг), и ставится КД
  if (info.whirlAbil.duration <= 0) {
    info.darts = info.darts || []
    for (const d of w.darts) {
      const a = w.angleBase + d.angle
      info.darts.push({
        img: d.img,
        x: d.img.x.animVal.value,
        y: d.img.y.animVal.value,
        w: 14,
        h: 32,
        dx: Math.cos(a),
        dy: Math.sin(a),
        returning: false,
      })
    }
    info.whirl = null
    info.whirlAbil.cooldown = info.whirlAbil.skill.cooldown
    return
  }
  const hx = status.hero.x + 16
  const hy = status.hero.y + 25
  const r = 44
  w.angleBase += 0.14
  for (let i = w.darts.length - 1; i >= 0; i--) {
    const dart = w.darts[i]
    const a = w.angleBase + dart.angle
    const dx = hx + r * Math.cos(a) - 7
    const dy = hy + r * Math.sin(a) - 16
    spritePos(dart.img, dx, dy)
    //остриё (верх спрайта) — по касательной к орбите (направление движения)
    const deg = Math.atan2(-Math.sin(a), -Math.cos(a)) * 180 / Math.PI
    dart.img.setAttribute("transform", "rotate(" + deg + " " + (dx + 7) + " " + (dy + 16) + ")")
    let removed = false
    //враги
    for (let j = 0; j < objectValues.length && !removed; j++) {
      const e = objectValues[j]
      if (e.type !== "enemy" || e.stats.hp <= 0) continue
      if (checkCollision(dx, e.rect.x.animVal.value, 14, e.rect.width.animVal.value, dy, e.rect.y.animVal.value, 32, e.rect.height.animVal.value)) {
        damageEnemy(e, dartDamage(e))
        removeWhirlDart(w, i)
        removed = true
      }
    }
    if (removed) continue
    //поглощение вражеских снарядов: оба исчезают
    for (let j = 0; j < objectValues.length && !removed; j++) {
      const b = objectValues[j]
      if (b.type !== "bullet" || b.result === 1 || !b.currentAnim || !b.currentAnim.bullet || b.target !== status.hero.obj) continue
      if (checkCollision(dx, b.rect.x.animVal.value, 14, b.rect.width.animVal.value, dy, b.rect.y.animVal.value, 32, b.rect.height.animVal.value)) {
        releaseSprite(b.img)
        objectValues.splice(j, 1)
        removeWhirlDart(w, i)
        removed = true
      }
    }
  }
}
function removeWhirlDart(w, i) {
  releaseSprite(w.darts[i].img)
  w.darts.splice(i, 1)
}

//==================== ДРОТИКИ (Боевой танец + бумеранг) ====================
//вызывается из attack.js после каждой базовой атаки (счётчик внутри)
function battleDanceHit() {
  const info = status.info
  if (!info.danceAbil) return
  //только базовые атаки (не посох/палочка)
  if (status.attack.img === "./images/attacks/staff/icon.png" || status.attack.img === "./images/attacks/wand/icon.png") return
  info.danceCount = (info.danceCount || 0) + 1
  if (info.danceCount % 3 === 0) spawnDart(status.hero.direction)
}
function spawnDart(dir) {
  const info = status.info
  info.darts = info.darts || []
  //единый спрайт дротика: effects/spear.png, 14×32, остриё вверх (поворот задаёт dartsTick)
  const w = 14
  const h = 32
  const img = image(svgArr[1], 0, 0, w, h, "./images/effects/spear.png", {})
  const x = status.hero.x + 16 - w / 2
  const y = status.hero.y + 25 - h / 2
  spritePos(img, x, y)
  info.darts.push({ img, x, y, w, h, dx: dir === 2 ? -1 : dir === 3 ? 1 : 0, dy: dir === 0 ? -1 : dir === 1 ? 1 : 0, returning: false })
}
function dartsTick() {
  const info = status.info
  if (!info.darts || !info.darts.length) return
  const matrix = status.matrixLevel
  for (let i = info.darts.length - 1; i >= 0; i--) {
    const dart = info.darts[i]
    dart.x += dart.dx * 4
    dart.y += dart.dy * 4
    spritePos(dart.img, dart.x, dart.y)
    //остриё (верх спрайта) всегда в направлении полёта
    const deg = Math.atan2(dart.dx, -dart.dy) * 180 / Math.PI
    dart.img.setAttribute("transform", "rotate(" + deg + " " + (dart.x + dart.w / 2) + " " + (dart.y + dart.h / 2) + ")")
    const cx = Math.trunc((dart.x + dart.w / 2) / 32)
    const cy = Math.trunc((dart.y + dart.h / 2) / 32)
    //препятствие (вне карты или не пол)
    if (!matrix || !matrix[cy] || matrix[cy][cx] !== 1) {
      if (info.boomerangAbil && !dart.returning) {
        dart.returning = true
        dart.dx = -dart.dx
        dart.dy = -dart.dy
        continue
      }
      releaseSprite(dart.img)
      info.darts.splice(i, 1)
      continue
    }
    //враги
    let hit = false
    for (let j = 0; j < objectValues.length && !hit; j++) {
      const e = objectValues[j]
      if (e.type !== "enemy" || e.stats.hp <= 0) continue
      if (checkCollision(dart.x, e.rect.x.animVal.value, dart.w, e.rect.width.animVal.value, dart.y, e.rect.y.animVal.value, dart.h, e.rect.height.animVal.value)) {
        damageEnemy(e, dartDamage(e))
        releaseSprite(dart.img)
        info.darts.splice(i, 1)
        hit = true
      }
    }
    if (hit) continue
    //возвращающийся дротик достиг героини
    if (dart.returning) {
      const hr = status.hero.obj.rect
      if (checkCollision(dart.x, hr.x.animVal.value, dart.w, hr.width.animVal.value, dart.y, hr.y.animVal.value, dart.h, hr.height.animVal.value)) {
        releaseSprite(dart.img)
        info.darts.splice(i, 1)
      }
    }
  }
}

//==================== ВИХРЕВОЙ СЛЕД ====================
function trailsTick() {
  const info = status.info
  if (!info.trails || !info.trails.length) return
  for (let i = info.trails.length - 1; i >= 0; i--) {
    info.trails[i].time--
    if (info.trails[i].time <= 0) {
      releaseSprite(info.trails[i].img)
      info.trails.splice(i, 1)
    }
  }
}
//враг стоит на следе? (замедление 20% — враг пропускает каждый 5-й свой тик движения)
function enemyOnTrail(enemy) {
  const info = status.info
  if (!info.trails || !info.trails.length) return false
  const r = enemy.rect
  const cx = Math.trunc((r.x.animVal.value + 13 + 7) / 32)
  const cy = Math.trunc((r.y.animVal.value + 37 + 7) / 32)
  for (let i = 0; i < info.trails.length; i++) {
    if (info.trails[i].x === cx && info.trails[i].y === cy) return true
  }
  return false
}

//==================== КРЫЛЬЯ / АУРА ====================
function startWings() {
  const info = status.info
  info.wingsAbil.duration = info.wingsAbil.skill.duration
  //V57: спрайт-заглушка (reflect.png 160×160) убрана — длительность отмечает жёлтое
  //свечение спрайта героини (WINGS_FILTER); снимается в aurasTick по концу duration
  info.wingsGlow = 1
  status.hero.obj.img.style.filter = WINGS_FILTER
  playback(strike[11].vol, 0, 0, status.settings.soundVolume)
}
function startAura() {
  const info = status.info
  info.auraAbil.duration = info.auraAbil.skill.duration
  //финальный спрайт ауры (96×96) — раньше была заглушка reflect.png
  info.auraImg = image(svgArr[1], status.hero.x + 16 - 48, status.hero.y + 25 - 48, 96, 96, "./images/effects/healAura.png", {})
  info.auraHealCd = 0
  playback(strike[11].vol, 0, 0, status.settings.soundVolume)
}
function aurasTick() {
  const info = status.info
  //V57: «крылья» — жёлтое свечение спрайта героини вместо спрайта-заглушки. Фильтр
  //переустанавливается каждый тик: спрайт героини пересоздаётся при смене этажа, так
  //свечение самовосстанавливается; по концу duration — снятие фильтра и КД
  if (info.wingsGlow) {
    if (info.wingsAbil.duration <= 0) {
      status.hero.obj.img.style.filter = ""
      info.wingsGlow = 0
      info.wingsAbil.cooldown = info.wingsAbil.skill.cooldown
    } else {
      status.hero.obj.img.style.filter = WINGS_FILTER
    }
  }
  if (info.auraImg) {
    if (info.auraAbil.duration <= 0) {
      releaseSprite(info.auraImg)
      info.auraImg = null
      info.auraAbil.cooldown = info.auraAbil.skill.cooldown
    } else {
      spritePos(info.auraImg, status.hero.x + 16 - 48, status.hero.y + 25 - 48)
    }
  }
}
function wingsActive() {
  return !!(status.info.wingsAbil && status.info.wingsAbil.duration > 0)
}
//враг в радиусе ауры (3 клетки)?
function enemyInAura(enemy) {
  const r = enemy.rect
  const cx = r.x.animVal.value + r.width.animVal.value / 2
  const cy = r.y.animVal.value + r.height.animVal.value / 2
  return Math.abs(cx - (status.hero.x + 16)) <= 96 && Math.abs(cy - (status.hero.y + 25)) <= 96
}
//лечение ауры: 1 ХП, не чаще 1 раз в секунду
function auraHeal() {
  const info = status.info
  if (!info.auraAbil || info.auraAbil.duration <= 0) return
  if ((info.auraHealCd || 0) > 0) return
  const maxHp = parseInt(info.stats[2].dops[0].value2.slice(0, -1))
  if (info.hp >= maxHp) return
  //V42: ур.2 Ауры — до 2 ХП за срабатывание (не выше макс. ХП)
  const heal = Math.min(info.auraCap || 1, maxHp - info.hp)
  info.hp += heal
  info.auraHealCd = 60
  floatText(status.hero.x - 16 + Math.trunc(Math.random() * 32), status.hero.y + 8, "+" + heal, "#33FF66", "18px", "none")
  changeHP(document.getElementById("hpBarI"), document.getElementById("hpText"), "hp")
}
//враг закончил атаку, не попав по героине (вызывается из animPlay)
function auraMissEnd(enemy) {
  if (enemyInAura(enemy)) auraHeal()
}
//героиня уклонилась (вызывается из takeDamage)
function auraDodgeHeal() {
  const info = status.info
  if (!info.auraAbil || info.auraAbil.duration <= 0) return
  for (let i = 0; i < objectValues.length; i++) {
    const e = objectValues[i]
    if (e.type === "enemy" && e.auraMiss && enemyInAura(e)) {
      auraHeal()
      return
    }
  }
}

//==================== ПРОЧЕЕ ====================
//Импульс: бонус % за клетки, пройденные за 2с; потребляется следующей атакой/способностью
function consumeImpulse() {
  const info = status.info
  if (!info.impulseAbil) return 0
  const log = info.impulseLog || []
  while (log.length && status.time - log[0].t > 120) log.shift()
  if (!log.length) return 0
  const bonus = Math.min(30, 5 * log.length)
  info.impulseLog = []
  return bonus
}
//Разгон: бонус скорости за непрерывный бег (обновляется из heroMove)
function updateRazgon(moved) {
  const info = status.info
  if (!info.razgonAbil) return 0
  if (moved) {
    info.razgonTime = (info.razgonTime || 0) + 1
    if (info.razgonTime >= 120) {
      info.razgonTime = 0
      info.razgonBonus = Math.min(info.razgonMax || 25, (info.razgonBonus || 0) + 5) //V42: ур.2 — макс +40%
    }
  } else {
    info.razgonTime = 0
    info.razgonBonus = 0
  }
  return info.razgonBonus || 0
}
//урон дротика: Сила воли (1..value1) + Гроза Йотунов (20% макс. ХП) + Импульс
function dartDamage(enemy) {
  const info = status.info
  let dmg = 1 + Math.trunc(Math.random() * info.stats[4].dops[0].value1)
  if (info.stormCharge) {
    dmg += Math.trunc(enemy.class.stats.hp * (info.stormPct || 0.2)) //V42: ур.2 — 30%
    info.stormCharge = 0
    playback(strike[5].vol, 0, 0, status.settings.soundVolume)
  }
  const imp = consumeImpulse()
  imp > 0 && (dmg += Math.trunc(dmg * imp / 100))
  return dmg
}
//Высшая справедливость: урон по врагам открытой комнаты (вызывается из openRoom).
//На попавших под удар (25% шанс) врагах показываем финальный спрайт поражения 0.5с (31 тик).
//Спрайт ведём вручную: playEffect ставит frame:1, что для однокадрового спрайта сдвигает
//окно за пределы картинки (спрайт был бы невидим).
function justiceStrike(room) {
  const info = status.info
  if (!info.justiceAbil) return
  for (let i = 0; i < objectValues.length; i++) {
    const e = objectValues[i]
    if (e.type === "enemy" && e.room === room && Math.random() < (info.justiceChance || 0.25)) { //V42: ур.2 — 40%
      damageEnemy(e, 1 + Math.trunc(Math.random() * info.stats[4].dops[0].value1))
      const r = e.rect
      info.justiceFx = info.justiceFx || []
      info.justiceFx.push({
        enemy: e,
        time: 31,
        img: image(svgArr[1], r.x.animVal.value + r.width.animVal.value / 2 - 16, r.y.animVal.value + r.height.animVal.value / 2 - 25, 32, 50, "./images/effects/wra.png", {}),
      })
    }
  }
}
//тик эффектов высшей справедливости (вызывается из valkyrieTick): следует за врагом и гаснет через 0.5с
function justiceFxTick() {
  const info = status.info
  if (!info.justiceFx || !info.justiceFx.length) return
  for (let i = info.justiceFx.length - 1; i >= 0; i--) {
    const fx = info.justiceFx[i]
    fx.time--
    if (fx.time <= 0) {
      releaseSprite(fx.img)
      info.justiceFx.splice(i, 1)
      continue
    }
    const r = fx.enemy.rect
    spritePos(fx.img, r.x.animVal.value + r.width.animVal.value / 2 - 16, r.y.animVal.value + r.height.animVal.value / 2 - 25)
  }
}
//Ветряной щит: отбрасывание врагов в квадрате 96×96 от героини (вызывается из takeDamage)
function shieldKnockback() {
  const info = status.info
  if (!info.shieldAbil) return
  const hx = status.hero.x + 16
  const hy = status.hero.y + 25
  const matrix = status.matrixLevel
  for (let i = 0; i < objectValues.length; i++) {
    const e = objectValues[i]
    if (e.type !== "enemy" || e.stats.hp <= 0) continue
    const r = e.rect
    const cx = r.x.animVal.value + r.width.animVal.value / 2
    const cy = r.y.animVal.value + r.height.animVal.value / 2
    if (Math.abs(cx - hx) > 48 || Math.abs(cy - hy) > 48) continue
    let tx = 0, ty = 0
    if (Math.abs(cx - hx) >= Math.abs(cy - hy)) tx = cx >= hx ? 32 : -32
    else ty = cy >= hy ? 32 : -32
    const nx = r.x.animVal.value + tx
    const ny = r.y.animVal.value + ty
    const cellX = Math.trunc((nx + 16) / 32)
    const cellY = Math.trunc((ny + 35) / 32)
    //не заталкивать в стену
    if (matrix && matrix[cellY] && matrix[cellY][cellX] === 1) {
      moveSprite(e.img, tx, ty)
      e.xCell = cellX
      e.yCell = cellY
    }
  }
}
//сброс состояния при del()
function resetValkyrie() {
  const info = status.info
  if (info.whirl) {
    for (const d of info.whirl.darts) releaseSprite(d.img)
    info.whirl = null
  }
  if (info.darts) {
    for (const d of info.darts) releaseSprite(d.img)
    info.darts = []
  }
  if (info.trails) {
    for (const t of info.trails) releaseSprite(t.img)
    info.trails = []
  }
  if (info.justiceFx) {
    for (const fx of info.justiceFx) releaseSprite(fx.img)
    info.justiceFx = []
  }
  if (info.auraImg) { releaseSprite(info.auraImg); info.auraImg = null }
  //V57: у «крыльев» вместо спрайта-заглушки — фильтр на спрайте героини; при del()
  //снимаем (спрайт героя может быть уже разобран — защищаемся проверкой)
  if (info.wingsGlow) {
    info.wingsGlow = 0
    status.hero.obj.img && (status.hero.obj.img.style.filter = "")
  }
  if (info.dashShieldImg) { releaseSprite(info.dashShieldImg); info.dashShieldImg = null }
  info.dashShieldRect = null
  if (info.dash && info.dash.trail) {
    for (const t of info.dash.trail) releaseSprite(t.img)
  }
  info.dash = null
  info.dashInvuln = 0
  info.dashLastDir = undefined
  info.dashLastTime = undefined
  info.razgonTime = 0
  info.razgonBonus = 0
  info.impulseLog = []
  info.impulseLast = undefined
  info.stormCharge = 0
  info.danceCount = 0
}
//неуязвимость 0.5с после рывка?
function dashInvulnActive() {
  return (status.info.dashInvuln || 0) > 0
}
export { valkyrieTick, dashPress, updateRazgon, consumeImpulse, battleDanceHit, enemyOnTrail, justiceStrike, shieldKnockback, auraMissEnd, auraDodgeHeal, wingsActive, dashInvulnActive, resetValkyrie, grantDashShield }
