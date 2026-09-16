import { start } from "./scripts/start.js"
import { svg } from "./scripts/svg.js"

let windowSize={"wt":window.innerWidth,"ht":window.innerHeight}

window.innerWidth >= window.innerHeight*16/9?windowSize.wt=window.innerHeight*16/9:windowSize.ht=window.innerWidth*9/16

document.body.style.overflow = 'hidden'
document.oncontextmenu = function (){return false}

svg(3)
start()

export {windowSize}
