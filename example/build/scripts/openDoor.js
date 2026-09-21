import { status } from "../scripts/start.js"
import { checkCollision } from "../scripts/damage.js"
import { screenPic,wallsOverlay,doorPics } from "../scripts/del.js"

//V16: двери хранятся в отдельном кэше doorPics (пополняется при создании тайлов).
//Раньше каждый тик сканировался ВЕСЬ screenPic (тысячи плиток открытых комнат) —
//на открытом этаже это был самый дорогой потиковый проход в игре.
function openDoor () {
    let walls = [
    ["./images/dungeon/walls/9.png","./images/dungeon/walls/27.png"],
    ["./images/dungeon/walls/12.png","./images/dungeon/walls/28.png"],
    ["./images/dungeon/walls/23.png","./images/dungeon/walls/29.png"],
    ["./images/dungeon/walls/24.png","./images/dungeon/walls/30.png"],

    ["./images/dungeon/walls/39.png","./images/dungeon/walls/57.png"],
    ["./images/dungeon/walls/42.png","./images/dungeon/walls/58.png"],
    ["./images/dungeon/walls/53.png","./images/dungeon/walls/59.png"],
    ["./images/dungeon/walls/54.png","./images/dungeon/walls/60.png"],

    ["./images/dungeon/walls/69.png","./images/dungeon/walls/87.png"],
    ["./images/dungeon/walls/72.png","./images/dungeon/walls/88.png"],
    ["./images/dungeon/walls/83.png","./images/dungeon/walls/90.png"],
    ["./images/dungeon/walls/84.png","./images/dungeon/walls/89.png"],]
    let length = doorPics.length
    for (let i = 0; i < length; i++) {
        let pic = doorPics[i]
        //только настоящие SVG-картинки с методами getAttribute/setAttribute — всё остальное пропускаем
        if (!pic || typeof pic.setAttribute !== "function" || typeof pic.getAttribute !== "function") continue
        let href = pic.getAttribute("href")
        if (!href) continue
        let length2 = walls.length
        for (let i2 = 0; i2 < length2; i2++) {
            if (href !== walls[i2][0]) continue
            //V126 (репорт юзера: второй герой не открывал закрытые двери): дверь открывал
            //только контекстный герой — openDoor зовётся из тика ОДИН раз после
            //пер-игроковой фазы, контекст там уже players[0]. Проверяем ВСЕХ живых
            for (let pi = 0; pi < status.players.length; pi++) {
                const P = status.players[pi]
                if (!checkCollision(pic.x.animVal.value,P.x,pic.width.animVal.value,32,pic.y.animVal.value,P.y+19,pic.height.animVal.value,32)) continue
                pic.setAttribute("href",walls[i2][1])
                //E-9: navMatrix ИИ врагов (enemyAI) перестраивается — дверь проходима
                status.navVersion = (status.navVersion || 0) + 1
                //V4: открывшаяся дверь стала накладкой (27/28 на 1-м этаже, 57/58 на 2-м) —
                //добавляем в кэш Z-сортировки (при создании тайла она была 9/12/23/24 и в кэш не попала)
                if (Array.isArray(wallsOverlay) && wallsOverlay.indexOf(pic) === -1 &&
                    (walls[i2][1] === "./images/dungeon/walls/27.png" ||
                     walls[i2][1] === "./images/dungeon/walls/28.png" ||
                     walls[i2][1] === "./images/dungeon/walls/57.png" ||
                     walls[i2][1] === "./images/dungeon/walls/58.png" ||
                     walls[i2][1] === "./images/dungeon/walls/87.png" ||
                     walls[i2][1] === "./images/dungeon/walls/88.png")) {
                    wallsOverlay.push(pic)
                }
                break
            }
        }
    }
}
export {openDoor}
