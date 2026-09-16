// ============================================================================
// ecsBridge.js — мост objectValues ↔ ECS-ядро zero_engine (M5, 2026-09-16)
// ============================================================================
// Каждый игровой объект (hero/enemy/bullet/effect/pet/corpse) при добавлении в
// objectValues получает РЕАЛЬНУЮ ECS-сущность: типизированные компоненты etype /
// posX / posY / cullPad и ссылочные DATA.bag (сам объект) + DATA.sprite (шим-спрайт).
// Записи позиций идут из бэкенда: clipRect сущности несёт _ecs, шим пишет
// COMPONENTS.posX/posY при каждом движении. renderSync (система после тиков игры)
// раз в кадр расставляет видимость по окну камеры — источник выигрыша Pixi:
// вне кадра спрайты пропускаются рендером целиком.
//
// Этап E-3 (будущие сессии): перенос систем (animPlay → moveBullet → damage →
// enemyAI) с bag-объектов на чтение/запись компонентов и групп напрямую.

// Глобали ECS/world/COMPONENTS/DATA — из engine/build/engine (классический скрипт
// грузится до всех модулей, так же как в zero_engine)
import { cameraView, layers, applyStillTexture } from "./pixiBackend.js"

const TYPE_CODES = { hero: 1, enemy: 2, bullet: 3, effect: 4, pet: 5, corpse: 6 }

// Регистрация компонентов (идемпотентна; ядро занимает биты 0..12, наши — 13+)
ECS.registerComponent("etype", Uint8Array)
ECS.registerComponent("posX", Float32Array)
ECS.registerComponent("posY", Float32Array)
ECS.registerComponent("cullPad", Float32Array)
// E-3 (animPlay): горячие счётчики анимации — типизированные компоненты. Поля
// obj.animCounters / obj.currentStill переопределяются акцессорами поверх них
// (defAnimAccessor), поэтому ~14 игровых файлов продолжают писать их как раньше —
// запись идёт в компонент. Состояние одно — в компоненте.
ECS.registerComponent("animCounter", Float32Array)
ECS.registerComponent("animStill", Float32Array)
// E-3 (moveBullet/damage/damageHero/enemyMove/enemyAI): грубые множества по типу
// на момент спавна. ВАЖНО: игра мутирует obj.type НА МЕСТЕ (enemy→corpse в enemyDie,
// enemy→pet в encounters, босс enemy→up→upped→enemy в spiderBossFight) БЕЗ перерегистрации,
// поэтому группы — только coarse-множество, а ВНУТРЕННИЕ фильтры по obj.type в системах
// сохранены 1:1: лишние (stale) члены группы отсеиваются фильтром, как в старом скане
// objectValues. Объекты, ЧЬИ типы совпали на спавне, в группе есть всегда.
ECS.registerComponent("isEnemy", Uint8Array)
ECS.registerComponent("isPet", Uint8Array)
ECS.registerComponent("isBullet", Uint8Array)
ECS.registerComponent("isFx", Uint8Array)
if (!DATA.bag) DATA.bag = new Array(100000)
if (!DATA.sprite) DATA.sprite = new Array(100000)
// Группа боевых сущностей — читается renderSync и будущими системами (E-3)
ECS.createQuery(world, "battle", ["etype", "posX", "posY", "cullPad"])
// E-3: группа анимированных сущностей — по ней крутится animPlay (не сканируя objectValues)
ECS.createQuery(world, "ganim", ["etype", "animCounter", "animStill"])
// E-3: типовые группы систем (двигаются маркерами, см. комментарий выше)
ECS.createQuery(world, "genemy", ["isEnemy"])
ECS.createQuery(world, "gpet", ["isPet"])
ECS.createQuery(world, "gbullet", ["isBullet"])
ECS.createQuery(world, "gfx", ["isFx"])

// акцессор поля объекта поверх компонента: единое состояние в типизированном массиве
function defAnimAccessor(obj, field, comp) {
    Object.defineProperty(obj, field, {
        configurable: true, enumerable: true,
        get() { return COMPONENTS[comp][this._ecs] },
        set(v) { COMPONENTS[comp][this._ecs] = v },
    })
}

function registerEcs(obj) {
    const id = ECS.addEntity(world)
    obj._ecs = id
    DATA.bag[id] = obj
    DATA.sprite[id] = obj.img || null
    ECS.addComponent(world, id, "etype", TYPE_CODES[obj.type] || 0)
    // логическая позиция = окно кадра (clipRect), как у анимированных спрайтов в SVG
    const cr = obj.img && obj.img.clipRect
    if (cr) cr._ecs = id
    const px = cr ? +(cr.attrs.x || 0) : +((obj.img && obj.img.attrs.x) || 0)
    const py = cr ? +(cr.attrs.y || 0) : +((obj.img && obj.img.attrs.y) || 0)
    ECS.addComponent(world, id, "posX", px)
    ECS.addComponent(world, id, "posY", py)
    // запас кульма: полугабарит листа + поля 64px (та же формула, что была culling-ом
    // animPlay: спрайт прячется только когда ЦЕЛИКОМ за окном камеры)
    const half = cr ? Math.max(cr._w || 0, cr._h || 0) / 2 : 64
    ECS.addComponent(world, id, "cullPad", half + 64)
    // E-3: счётчики анимации — в компоненты (инициал из литерала спавна), затем
    // поля объекта переопределяются акцессорами поверх компонентов.
    // R1: у спавнов с frame-смещением (дэш-призраки и пр.) currentStill может быть
    // не задан — тогда фактический кадр уже применён в шим (setFrame при создании):
    // берём его, иначе первый renderSync мигнул бы кадром 0.
    const initStill = obj.currentStill !== undefined ? +obj.currentStill
        : (obj.img && obj.img._still !== undefined ? obj.img._still : 0)
    ECS.addComponent(world, id, "animCounter", +obj.animCounters || 0)
    ECS.addComponent(world, id, "animStill", initStill)
    defAnimAccessor(obj, "animCounters", "animCounter")
    defAnimAccessor(obj, "currentStill", "animStill")
    // E-3: маркеры типовых групп по типу НА СПАВНЕ (см. комментарий у createQuery)
    obj.type === "enemy" && ECS.addComponent(world, id, "isEnemy", 1)
    obj.type === "pet" && ECS.addComponent(world, id, "isPet", 1)
    obj.type === "bullet" && ECS.addComponent(world, id, "isBullet", 1)
    obj.type === "effect" && ECS.addComponent(world, id, "isFx", 1)
}

function unregisterEcs(obj) {
    const id = obj._ecs
    if (id === undefined) return
    const cr = obj.img && obj.img.clipRect
    if (cr && cr._ecs === id) cr._ecs = null
    if (DATA.bag[id] === obj) { DATA.bag[id] = undefined; DATA.sprite[id] = undefined }
    ECS.removeEntity(world, id)
    obj._ecs = undefined
}

// objectValues как Proxy-список: push/splice/length=0 синхронизируют ECS-сущности.
// Все 14 точек спавна (push) и ~10 точек удаления (splice/length=0) покрываются
// без правок игровых файлов.
export function createEntityList() {
    const target = []
    return new Proxy(target, {
        get(t, prop) {
            if (prop === "push") {
                return (...items) => {
                    for (let i = 0; i < items.length; i++) items[i] && registerEcs(items[i])
                    return t.push(...items)
                }
            }
            if (prop === "splice") {
                return (start, del, ...items) => {
                    const removed = t.splice(start, del)
                    for (let i = 0; i < removed.length; i++) removed[i] && unregisterEcs(removed[i])
                    for (let i = 0; i < items.length; i++) {
                        if (items[i] && items[i]._ecs === undefined) registerEcs(items[i])
                        t.push(items[i])
                    }
                    return removed
                }
            }
            const v = t[prop]
            return typeof v === "function" ? v.bind(t) : v
        },
        set(t, prop, v) {
            if (prop === "length" && v === 0) {
                for (let i = 0; i < t.length; i++) t[i] && unregisterEcs(t[i])
            }
            t[prop] = v
            return true
        },
    })
}

// Система синхронизации рендера: вызывается КАЖДЫЙ кадр ПОСЛЕ всех тиков игры
// (порядок задаёт index.js: gameTickSystem → ecsRenderSync). R1: ЕДИНСТВЕННОЕ место,
// где боевые анимированные сущности получают позицию и кадр текстуры — из компонентов
// (posX/posY/animStill), один раз за кадр. Промежуточные состояния между setAttribute-
// записями внутри тика больше не доходят до GPU — класс причин ряби при скролле
// устранён структурно. Видимость: сущности, целиком вышедшие за окно камеры
// (+cullPad), исключаются из рендера (как клиппинг SVG, только дешевле).
export function ecsRenderSync() {
    const ents = world.queries.battle && world.queries.battle.entities
    if (!ents) return
    const vb = cameraView()
    const left = vb.x - 64, right = vb.x + vb.width + 64
    const top = vb.y - 64, bottom = vb.y + vb.height + 64
    for (let i = 0; i < ents.length; i++) {
        const id = ents[i]
        const sprite = DATA.sprite[id]
        if (!sprite || !sprite.node) continue
        // UI-сущности (спрайты убитых врагов на экране очков — их кладёт endGame
        // в svgArr[2] с ЭКРАННЫМИ координатами) камерой слоя 1 не кульлятся:
        // их (150..1800, 280..600) «вне окна камеры» гасило каждый кадр
        if (sprite._layer === layers[2]) continue
        const pad = COMPONENTS.cullPad[id]
        const x = COMPONENTS.posX[id], y = COMPONENTS.posY[id]
        const node = sprite.node
        if (x < left - pad || x > right + pad || y < top - pad || y > bottom + pad) {
            node.visible = false
            continue
        }
        node.visible = true
        // R1: позиция/кадр — только для анимированных боевых сущностей (их узел
        // больше никто не двигает). Статичные image-сущности живут по-старому:
        // их posX/posY не обновляются из шима, двигать узел здесь нельзя.
        if (sprite.kind === "anim" && sprite._clipRect) {
            node.position.set(x, y)
            const s = COMPONENTS.animStill[id]
            if (s !== sprite._still) {
                // _still фиксируем только при успешном применении (кадры ещё
                // не загружены — ретрай на следующем кадре, как в applyTextureRetro)
                if (applyStillTexture(sprite, s)) sprite._still = s
            }
        }
    }
}
