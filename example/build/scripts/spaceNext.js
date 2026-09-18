// ============================================================================
// spaceNext.js — Пробел как дубликат кнопки «Далее» (E-22, пожелание юзера)
// ============================================================================
// На экране подсчёта очков (endScreen/rollNumbers) и на экране взятия предметов
// (metaItems) кнопка «Далее» реагирует и на Пробел. Экран-владелец «взводит»
// действие (armSpaceNext) в момент создания кнопки; нажатие Пробела при активном
// экране исполняет его один раз ( armed сбрасывается — как одиночный клик).
// Гвардия status.start === 2 (оба экрана) делает взведённое действие инертным
// везде, где экран уже сменился (лобби/настройки — 0, забег — 1): повторное
// нажатие/забытый взвод не срабатывает мимо экрана.
import { status } from "../scripts/start.js"

let armed = null

document.addEventListener("keydown", e => {
    if (e.code !== "Space" || e.repeat) return
    if (!armed || !status || status.start !== 2) return
    e.preventDefault()
    const fn = armed
    armed = null
    fn()
})

export function armSpaceNext(fn) { armed = fn }
export function clearSpaceNext() { armed = null }
