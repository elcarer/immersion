
import { sceneGenerate } from "../scripts/sceneGenerate.js"
import { status } from "../scripts/start.js"
//V31: новый забег всегда стартует с зумом 1.0 (zoomFx.js)
import { resetZoom } from "../scripts/zoomFx.js"
//V43: столбы призыва босса 3 этажа (fin1/fin2) — размещение при генерации
import { configFinPillars } from "../scripts/finPillars.js"
//V64: портал (18) и рычаг (19) — по одному порталу на этаж при генерации
import { configPortal, placeRoomObject } from "../scripts/portalFx.js"
//V65: 4 этаж («Пустота») — спавн босса (Циклоп/Медуза пустоты; выбор — nextFloor, V87) после sceneGenerate
import { spawnVoidBoss } from "../scripts/voidBoss.js"
//V69: ручные зверьки переносятся на новый этаж — спавн рядом с героем (pets.js)
import { spawnCarriedPets } from "../scripts/pets.js"
//V104: квест «Сопроводить Волка» — сброс состояния и спавн NPC (2 глава, 1 этаж)
import { questNewGame } from "../scripts/quest.js"
//V52: старт этажа — сброс забегных счётчиков достижений
import { achFloorStart } from "../scripts/achievements.js"

function newGame(next) {
    resetZoom()
    //V66b: новый забег (next=false) — всегда 1 этаж. Защитный guard: status.levelFloor мог
    //остаться от забега, брошенного через меню (endScreen сбрасывает его только при завершении
    //этажа). Смена этажа (next=true) не затрагивается. V87: заодно сброс выбора босса 4 этажа
    //(решается заново при завершении этажа 3 — до комикса спуска)
    next === false && (status.levelFloor = 0, status.voidBossId = null)
    let newData = generateGame()
    sceneGenerate(newData,next)
    //V64a: связка портал/рычаг регистрируется ПОСЛЕ sceneGenerate — её del() сбрасывает
    //link (resetPortalFx); раньше вызов стоял в generateGame и рычаг «использовался вхолостую»
    //(портал не включался, рычаг не гас). Портал к этому моменту уже в пуле объектов
    configPortal(newData.scenes[status.levelFloor])
    //V65: 4 этаж — босс спавнится тоже ПОСЛЕ sceneGenerate (его спрайт живёт только
    //в живой сцене; на генерации дель() ещё не отработал бы)
    status.levelFloor === 3 && spawnVoidBoss(newData.scenes[status.levelFloor])
    //V69: ручные зверьки появляются рядом с героем в стартовой комнате нового этажа
    //(матрица и герой уже готовы; на новом забеге список пуст — sceneGenerate(next=false) чистит)
    spawnCarriedPets()
    //V104: квест «Сопроводить Волка» — на новом забеге сброс; 2 глава, 1 этаж — NPC Волк
    questNewGame(next)
    //V52: статус.info готов — кэшируем ХП, чистим «чистый» этаж и окно Массовика
    achFloorStart()
}
function generateGame() {
    let w = 110
    let h = 70
    let roomMin = 7
    let roomMax = 38
    let roomsMaxNum = 24
    let booferRoom = 1
    let roomsNum = 0
    let extraConnections = 2
    let corridorWidth = 2
    let corridorHeight = 1
    let count = 0
    if(status.levelFloor === 1) {
        //генерация этажа 2
        roomMax = 28
        roomsMaxNum = 28
        extraConnections = 16
        w = 110
        h = 70
    }
    if(status.levelFloor === 2) {
    //генерация этажа 3
    roomMax = 28
    roomsMaxNum = 42
    extraConnections = 6
    w = 160
    h = 90
    }
    //V65: генерация 4 этажа («Пустота») — одна квадратная комната 24×24 (сетка 26×26
    //с клеткой стен по периметру): чистый босс-файт. Ни объектов, ни врагов, ни коридоров —
    //обычный цикл «комнаты+коридоры» пропускается целиком. Стены (углы 2/3/6/7, кромки
    //19/20/21/22) считает общий createWalls: смещение спрайтов +30×этаж даёт на 4 этаже
    //ровно набор 92/93/96/97/109/110/111/112. Пол — пул floorTexturesFloor4 (18–24,
    //sceneGenerate.js). Случайного босса (Циклоп/Медуза, V85) спавнит spawnVoidBoss.
    if(status.levelFloor === 3) {
        w = 26
        h = 26
        let newDataVoid = {"scenes":[
            {"w":w,"h":h,"floor":[],"objects":[],"walls":[],"hero":[0,0]},
            {"w":w,"h":h,"floor":[],"objects":[],"walls":[],"hero":[0,0]},
            {"w":w,"h":h,"floor":[],"objects":[],"walls":[],"hero":[0,0]},
            //комната 24×24 в (1,1); [5]/[6] — центр (13,13); герой — (13,12), как на других этажах
            {"w":w,"h":h,"floor":[[1,1,24,24,3,13,13]],"objects":[],"walls":[],"hero":[13,12]},
        ]}
        createWalls(newDataVoid)
        return newDataVoid
    }
    if (status.levelFloor < (status.meta.page - 1)) {
        w -= 20
        h -= 20
    }
    let newData = {"scenes":[
        {"w":w,"h":h,"floor":[],"objects":[],"walls":[],"hero":[0,0]},
        {"w":w,"h":h,"floor":[],"objects":[],"walls":[],"hero":[0,0]},
        {"w":w,"h":h,"floor":[],"objects":[],"walls":[],"hero":[0,0]},
    ]}
    while (roomsNum < roomsMaxNum&&count < 10000) {
        createRoom(roomMin,roomMax,w,h)
        count++
    }
    function createRoom (min, max, xMax, yMax) {
        let w = Math.floor(Math.random() * (max - min + 1) + min)
        let h = Math.floor(Math.random() * (max - min + 1) + min)
        h/w>1.5&&Math.random()>0.1?h = Math.floor(h/1.5):w/h>1.5&&Math.random()>0.1?w = Math.floor(w/1.5):false
        let x = Math.floor(Math.random() * (xMax - w - 1)) + 1
        let y = Math.floor(Math.random() * (yMax - h - 1)) + 1
        checkRoom(x,y,w,h)
    }
    function checkRoom (x,y,w,h) {
        let lengthArr = newData.scenes[status.levelFloor].floor.length
        let check = 0
        for (let i = 0; i < lengthArr; i++) {
            if(
                x > newData.scenes[status.levelFloor].floor[i][0] + newData.scenes[status.levelFloor].floor[i][2] + booferRoom || 
                x + w + booferRoom < newData.scenes[status.levelFloor].floor[i][0] || 
                y > newData.scenes[status.levelFloor].floor[i][1] + newData.scenes[status.levelFloor].floor[i][3] + booferRoom || 
                y + h + booferRoom < newData.scenes[status.levelFloor].floor[i][1]
            ) {} else {check++}
            if(check!==0){break}
        }
        check===0&&newData.scenes[status.levelFloor].floor.push([x,y,w,h,3,Math.floor(x + w / 2),Math.floor(y + h / 2)])
        check===0&&roomsNum++
    }
    let centers = newData.scenes[status.levelFloor].floor.map(r => ({
        x: Math.floor(r[0] + r[2] / 2),
        y: Math.floor(r[1] + r[3] / 2)
    }))
    buildEdges()
    function buildEdges () {
        let edges = []
        let lengthArr = newData.scenes[status.levelFloor].floor.length
        for (let i = 0; i < lengthArr; i++) {
            for (let j = i + 1; j < lengthArr; j++) {
                let dist = Math.abs(newData.scenes[status.levelFloor].floor[i][0] - newData.scenes[status.levelFloor].floor[j][0]) + Math.abs(newData.scenes[status.levelFloor].floor[i][1] - newData.scenes[status.levelFloor].floor[j][1])
                edges.push({ i, j, dist })
            }
        }
        edges.sort((a, b) => a.dist - b.dist)
        let parent = Array(newData.scenes[status.levelFloor].floor.length).fill().map((_, idx) => idx)
        function find(v) {
            while (parent[v] !== v) {
                parent[v] = parent[parent[v]];
                v = parent[v];
            }
            return v;
        }
        function union(v1, v2) {
            const p1 = find(v1);
            const p2 = find(v2);
            if (p1 !== p2) {
                parent[p2] = p1;
                return true;
            }
            return false;
        }
        const mstEdges = [];
        for (const e of edges) {
            if (union(e.i, e.j)) {
                mstEdges.push({ i: e.i, j: e.j });
            }
        }
        // Выбираем дополнительные случайные рёбра (не вошедшие в MST)
    const nonMstEdges = edges.filter(e => !mstEdges.some(m => (m.i === e.i && m.j === e.j) || (m.i === e.j && m.j === e.i)));
    const shuffled = nonMstEdges.sort(() => Math.random() - 0.5);
    const extra = shuffled.slice(0, extraConnections);

    // Все соединения, которые будем рисовать
    const connections = [...mstEdges, ...extra];

    // Вспомогательная функция рисования толстой линии (горизонтальной или вертикальной)
    function drawThickLine(x1, y1, x2, y2, horizontal,room1,room2) {
        if (horizontal) {
            const y = y1;
            const xStart = Math.min(x1, x2);
            const xEnd = Math.max(x1, x2);
            const dyOffset = corridorHeight;
            for (let x = xStart; x <= xEnd; x++) {
                for (let dy = -dyOffset; dy <= dyOffset; dy++) {
                    const ny = y + dy;
                    if (ny >= 0 && ny <= h) {
                        let lengthArr = newData.scenes[status.levelFloor].floor.length
                        let check = 0
                        for (let i = 0; i < lengthArr; i++) {
                            let room = newData.scenes[status.levelFloor].floor[i]
                            x>=room[0]&&x<room[0]+room[2]&&ny>=room[1]&&ny<room[1]+room[3]&&(check=1)
                            if(check!==0){break}
                        }
                        check===0&&newData.scenes[status.levelFloor].floor.push([x,ny,1,1,2,room1,room2])
                    }
                }
            }
        } else {
            const x = x1;
            const yStart = Math.min(y1, y2);
            const yEnd = Math.max(y1, y2);
            const dxOffset = corridorWidth;
            for (let y = yStart; y <= yEnd; y++) {
                for (let dx = -dxOffset; dx < dxOffset; dx++) {
                    const nx = x + dx;
                    if (nx >= 0 && nx <= w) {
                        let lengthArr = newData.scenes[status.levelFloor].floor.length
                        let check = 0
                        for (let i = 0; i < lengthArr; i++) {
                            let room = newData.scenes[status.levelFloor].floor[i]
                            nx>=room[0]&&nx<room[0]+room[2]&&y>=room[1]&&y<room[1]+room[3]&&(check=1)
                            if(check!==0){break}
                        }
                        check===0&&newData.scenes[status.levelFloor].floor.push([nx,y,1,1,2,room1,room2])
                    }
                }
            }
        }
    }
// Функция прокладки коридора между двумя точками с заданным стилем
function carveCorridor(start, end, style,room1,room2) {
    const { x: x1, y: y1 } = start;
    const { x: x2, y: y2 } = end;
    switch (style) {
        case 0: // Горизонталь, затем вертикаль
            drawThickLine(x1, y1, x2, y1, true,room1,room2);
            drawThickLine(x2, y1, x2, y2, false,room1,room2);
            break;
        case 1: // Вертикаль, затем горизонталь
            drawThickLine(x1, y1, x1, y2, false,room1,room2);
            drawThickLine(x1, y2, x2, y2, true,room1,room2);
            break;
        case 2: // Горизонталь-вертикаль-горизонталь (Z-образный)
            const xMid = Math.floor(Math.random() * (Math.max(x1, x2) - Math.min(x1, x2) + 1)) + Math.min(x1, x2);
            drawThickLine(x1, y1, xMid, y1, true,room1,room2);
            drawThickLine(xMid, y1, xMid, y2, false,room1,room2);
            drawThickLine(xMid, y2, x2, y2, true,room1,room2);
            break;
        case 3: // Вертикаль-горизонталь-вертикаль (S-образный)
            const yMid = Math.floor(Math.random() * (Math.max(y1, y2) - Math.min(y1, y2) + 1)) + Math.min(y1, y2);
            drawThickLine(x1, y1, x1, yMid, false,room1,room2);
            drawThickLine(x1, yMid, x2, yMid, true,room1,room2);
            drawThickLine(x2, yMid, x2, y2, false,room1,room2);
            break;
        default:
            // По умолчанию горизонталь-вертикаль
            drawThickLine(x1, y1, x2, y1, true,room1,room2);
            drawThickLine(x2, y1, x2, y2, false,room1,room2);
    }
}
        // Прокладываем все соединения
        for (const conn of connections) {
            const start = centers[conn.i];
            const end = centers[conn.j];
            // Случайный стиль от 0 до 3
            const style = Math.floor(Math.random() * 4);
            carveCorridor(start, end, style,conn.i,conn.j);
        }
    }
    createWalls(newData)
    return newData
}
function createWalls(newData) {
    let roomsArr = []
    let lengthArr = newData.scenes[status.levelFloor].floor.length
    for (let i = 0; i < lengthArr; i++) {
        let room = newData.scenes[status.levelFloor].floor[i]
        room[2]>1&&roomsArr.push([i,newData.scenes[status.levelFloor].floor[i][2]*newData.scenes[status.levelFloor].floor[i][3]])
        let lengthArr2 = room[2]
        for (let i2 = 0; i2 < lengthArr2; i2++) {
            let lengthArr3 = room[3]
            for (let i3 = 0; i3 < lengthArr3; i3++) {
                    let rooms = [room]
                let length = newData.scenes[status.levelFloor].floor.length
                for (let it = 0; it < length; it++) {
                    let temproom = newData.scenes[status.levelFloor].floor[it]
                    if (room[2]>1&&(room[0]-temproom[0]===1||temproom[0]-room[0]-room[2]===0)||
                        (room[1]-temproom[1]===1||temproom[1]-room[1]-room[3]===0)) {
                        rooms.push(temproom)
                    } else if (room[2]===1&&(temproom[0]-room[0]===1||room[0]-temproom[0]-temproom[2]===0)||
                    (temproom[1]-room[1]===1||room[1]-temproom[1]-temproom[3]===0)) {
                        rooms.push(temproom)
                    }
                }
                let configWall = checkWalls(i2+room[0],i3+room[1],rooms)
                if (room[2]>1) {
                //правая 1 палка
                configWall[0]===0&&configWall[2]!==0&&configWall[3]!==0&&(configWall[7]!==2?(configWall[4]!==2?(configWall[4]===0||configWall[7]===0?
                newData.scenes[status.levelFloor].walls.push([i2+room[0],i3+room[1],21,1,1]):
                newData.scenes[status.levelFloor].walls.push([i2+room[0],i3+room[1],26,1,1])):
                newData.scenes[status.levelFloor].walls.push([i2+room[0],i3+room[1],4,1,1])):
                newData.scenes[status.levelFloor].walls.push([i2+room[0],i3+room[1]-1,1,1,2,i]))
                //левая 1 палка
                configWall[1]===0&&configWall[2]!==0&&configWall[3]!==0&&(configWall[5]!==2?(configWall[6]!==2?(configWall[6]===0||configWall[5]===0?
                newData.scenes[status.levelFloor].walls.push([i2+room[0],i3+room[1],22,1,1]):
                newData.scenes[status.levelFloor].walls.push([i2+room[0],i3+room[1],25,1,1])):
                newData.scenes[status.levelFloor].walls.push([i2+room[0],i3+room[1],5,1,1])):
                newData.scenes[status.levelFloor].walls.push([i2+room[0],i3+room[1]-1,8,1,2,i]))
                //верхняя 1 палка
                configWall[3]===0&&configWall[0]!==0&&configWall[1]!==0&&(!(configWall[5]===0&&configWall[1]===2)?(!(configWall[7]===0&&configWall[0]===2)?
                    newData.scenes[status.levelFloor].walls.push([i2+room[0],i3+room[1],20,1,1]):
                    newData.scenes[status.levelFloor].walls.push([i2+room[0],i3+room[1]-1,15,1,2,i])):
                    newData.scenes[status.levelFloor].walls.push([i2+room[0],i3+room[1]-1,16,1,2,i]))
                //нижняя 1 палка
                configWall[2]===0&&configWall[0]!==0&&configWall[1]!==0&&newData.scenes[status.levelFloor].walls.push([i2+room[0],i3+room[1],19,1,2])
                //нижний правый угол
                configWall[0]===0&&configWall[2]===0&&(configWall[7]===0?
                    newData.scenes[status.levelFloor].walls.push([i2+room[0],i3+room[1],2,1,2]):
                    newData.scenes[status.levelFloor].walls.push([i2+room[0],i3+room[1]-1,18,1,3,i]))
                //нижний левый угол
                configWall[1]===0&&configWall[2]===0&&(configWall[5]===0?
                    newData.scenes[status.levelFloor].walls.push([i2+room[0],i3+room[1],3,1,2]):
                    newData.scenes[status.levelFloor].walls.push([i2+room[0],i3+room[1]-1,17,1,3,i]))
                //верхний левый угол
                configWall[1]===0&&configWall[3]===0&&(configWall[6]!==2?newData.scenes[status.levelFloor].walls.push([i2+room[0],i3+room[1],6,1,1]):newData.scenes[status.levelFloor].walls.push([i2+room[0],i3+room[1],20,1,1]))
                //верхний правый угол
                configWall[0]===0&&configWall[3]===0&&(configWall[4]!==2?newData.scenes[status.levelFloor].walls.push([i2+room[0],i3+room[1],7,1,1]):newData.scenes[status.levelFloor].walls.push([i2+room[0],i3+room[1],20,1,1]))
                //левый верхний стык
                configWall[1]===1&&configWall[3]===2&&configWall[5]===0&&configWall[1]!==0&&newData.scenes[status.levelFloor].walls.push([i2+room[0],i3+room[1],10,1,1])
                //правый верхний стык
                configWall[0]===1&&configWall[3]===2&&configWall[7]===0&&configWall[1]!==0&&newData.scenes[status.levelFloor].walls.push([i2+room[0],i3+room[1],11,1,1])
                //стык справа
                configWall[0]===2&&configWall[4]===0&&configWall[3]===1&&configWall[2]!==0&&newData.scenes[status.levelFloor].walls.push([i2+room[0],i3+room[1],1,1,2])
                //стык слева внизу
                configWall[1]===0&&configWall[6]===2&&newData.scenes[status.levelFloor].walls.push([i2+room[0],i3+room[1],25,1,1])

                //двери
                if (configWall[0]===2) {
                    countHoll1(i2+room[0],i3+room[1],24)
                }
                    function countHoll1(x,y,type3) {
                        let count = 0
                        for (let ic = 0; ic < 6; ic++) {
                            let lengthArr = rooms.length
                            for (let ic1 = 0; ic1 < lengthArr; ic1++) {
                                x+1===rooms[ic1][0]&&y+ic-1===rooms[ic1][1]&&count++
                            }
                        }
                        count===3&&configWall[2]===1&&configWall[5]!==0&&configWall[7]===0&&newData.scenes[status.levelFloor].walls.push([i2+room[0],i3+room[1]-1,type3,1,4])
                    }
                if (configWall[2]===2) {
                    countHoll2(i2+room[0],i3+room[1],9)
                }
                    function countHoll2(x,y,type3) {
                        let count = 0
                        for (let ic = 0; ic < 6; ic++) {
                            let lengthArr = rooms.length
                            for (let ic1 = 0; ic1 < lengthArr; ic1++) {
                                x+ic-1===rooms[ic1][0]&&y+1===rooms[ic1][1]&&count++

                            }
                        }
                        count===4&&configWall[6]===0&&newData.scenes[status.levelFloor].walls.push([i2+room[0],i3+room[1],type3,4,2])
                    }
                if (configWall[1]===2) {
                    countHoll3(i2+room[0],i3+room[1],23)
                }
                    function countHoll3(x,y,type3) {
                        let count = 0
                        for (let ic = 0; ic < 6; ic++) {
                            let lengthArr = rooms.length
                            for (let ic1 = 0; ic1 < lengthArr; ic1++) {
                                x-1===rooms[ic1][0]&&y+ic-1===rooms[ic1][1]&&count++
                            }
                        }
                        count===3&&configWall[2]===1&&configWall[5]===0&&configWall[7]!==0&&newData.scenes[status.levelFloor].walls.push([i2+room[0],i3+room[1]-1,type3,1,4])
                    }
                if (configWall[3]===2) {
                    countHoll4(i2+room[0],i3+room[1],12)
                }
                    function countHoll4(x,y,type3) {
                        let count = 0
                        for (let ic = 0; ic < 6; ic++) {
                            let lengthArr = rooms.length
                            for (let ic1 = 0; ic1 < lengthArr; ic1++) {
                                x+ic-1===rooms[ic1][0]&&y-1===rooms[ic1][1]&&count++
                                (ic===4||ic===0)&&x+ic-1===rooms[ic1][0]&&y===rooms[ic1][1]&&(count+=10)
                            }
                        }
                        count===4&&configWall[5]===0&&newData.scenes[status.levelFloor].walls.push([i2+room[0],i3+room[1]-1,type3,4,2])
                    }
                }
                if (room[2]===1) {
                    //верхняя 1 палка
                    configWall[3]===0&&configWall[0]!==0&&configWall[1]!==0&&newData.scenes[status.levelFloor].walls.push([i2+room[0],i3+room[1]-1,20,1,1,i])
                    //нижняя 1 палка
                    configWall[2]===0&&configWall[0]!==0&&configWall[1]!==0&&newData.scenes[status.levelFloor].walls.push([i2+room[0],i3+room[1],19,1,2])
                    //правая 1 палка
                    configWall[0]===0&&configWall[2]!==0&&configWall[3]!==0&&
                    (configWall[4]!==2?(configWall[7]===0?
                        newData.scenes[status.levelFloor].walls.push([i2+room[0],i3+room[1],21,1,1]):
                        newData.scenes[status.levelFloor].walls.push([i2+room[0],i3+room[1]-1,1,1,2,i])):
                        newData.scenes[status.levelFloor].walls.push([i2+room[0],i3+room[1],26,1,1]))
                    //левая 1 палка
                    configWall[1]===0&&configWall[2]!==0&&configWall[3]!==0&&
                    (configWall[6]!==2?(configWall[5]===0?
                            newData.scenes[status.levelFloor].walls.push([i2+room[0],i3+room[1],22,1,1]):
                            newData.scenes[status.levelFloor].walls.push([i2+room[0],i3+room[1]-1,8,1,2,i])):
                            newData.scenes[status.levelFloor].walls.push([i2+room[0],i3+room[1],25,1,1]))
                    //правый нижний угол
                    configWall[0]===0&&configWall[2]===0&&(configWall[7]===0?newData.scenes[status.levelFloor].walls.push([i2+room[0],i3+room[1],2,1,2]):newData.scenes[status.levelFloor].walls.push([i2+room[0],i3+room[1]-1,18,1,3,i]))
                    //левый нижний угол
                    configWall[1]===0&&configWall[2]===0&&(configWall[5]===0?
                        newData.scenes[status.levelFloor].walls.push([i2+room[0],i3+room[1],3,1,2]):
                        newData.scenes[status.levelFloor].walls.push([i2+room[0],i3+room[1]-1,17,1,3,i]))
                    //правый верхний угол
                    configWall[0]===0&&configWall[3]===0&&(configWall[4]!==2?
                        newData.scenes[status.levelFloor].walls.push([i2+room[0],i3+room[1]-1,14,1,2,i]):newData.scenes[status.levelFloor].walls.push([i2+room[0],i3+room[1]-1,16,1,2,i]))
                    //левый верхний угол
                    configWall[1]===0&&configWall[3]===0&&(configWall[6]!==2?newData.scenes[status.levelFloor].walls.push([i2+room[0],i3+room[1]-1,13,1,2,i]):newData.scenes[status.levelFloor].walls.push([i2+room[0],i3+room[1]-1,15,1,2,i]))
                    //правый нижний угол стыка
                    configWall[5]===0&&configWall[3]!==0&&configWall[1]===1&&newData.scenes[status.levelFloor].walls.push([i2+room[0],i3+room[1],25,1,1])
                    //левый нижний угол стыка
                    configWall[7]===0&&configWall[3]!==0&&configWall[0]===1&&newData.scenes[status.levelFloor].walls.push([i2+room[0],i3+room[1],26,1,1])
                //стык справа вверху
                configWall[6]===0&&configWall[2]===2&&configWall[1]===2&&newData.scenes[status.levelFloor].walls.push([i2+room[0],i3+room[1],8,1,2])
                //стык слева вверху
                configWall[4]===0&&configWall[2]===2&&configWall[0]===2&&newData.scenes[status.levelFloor].walls.push([i2+room[0],i3+room[1],1,1,2])
                }
            }
        }
    }
    function checkWalls(x,y,rooms) {
        let configWall = [0,0,0,0,0,0,0,0]
        let lengthArr = rooms.length
        for (let i = 0; i < lengthArr; i++) {
            let room = rooms[i]
            let lengthArr2 = room[2]
            for (let i2 = 0; i2 < lengthArr2; i2++) {
                let lengthArr3 = room[3]
                for (let i3 = 0; i3 < lengthArr3; i3++) {
                    if (room[2]>1) {
                        x+1===room[0]+i2&&y===room[1]+i3&&(configWall[0] = 1)//+
                        x-1===room[0]+i2&&y===room[1]+i3&&(configWall[1] = 1)//+
                        y+1===room[1]+i3&&x===room[0]+i2&&(configWall[2] = 1)//+
                        y-1===room[1]+i3&&x===room[0]+i2&&(configWall[3] = 1)//+

                        x+1===room[0]+i2&&y+1===room[1]+i3&&(configWall[4] = 1)
                        x-1===room[0]+i2&&y-1===room[1]+i3&&(configWall[5] = 1)
                        y+1===room[1]+i3&&x-1===room[0]+i2&&(configWall[6] = 1)
                        y-1===room[1]+i3&&x+1===room[0]+i2&&(configWall[7] = 1)
                    }
                    if (room[2]===1) {
                        x+1===room[0]+i2&&y===room[1]+i3&&(configWall[0] = 2)
                        x-1===room[0]+i2&&y===room[1]+i3&&(configWall[1] = 2)
                        y+1===room[1]+i3&&x===room[0]+i2&&(configWall[2] = 2)
                        y-1===room[1]+i3&&x===room[0]+i2&&(configWall[3] = 2)

                        x+1===room[0]+i2&&y+1===room[1]+i3&&(configWall[4] = 2)
                        x-1===room[0]+i2&&y-1===room[1]+i3&&(configWall[5] = 2)
                        y+1===room[1]+i3&&x-1===room[0]+i2&&(configWall[6] = 2)
                        y-1===room[1]+i3&&x+1===room[0]+i2&&(configWall[7] = 2)
                    }
                }
            }
        }
        return configWall
    }
    roomsArr.sort((a, b) => a[1] - b[1])
    newData.scenes[status.levelFloor].hero[0] = newData.scenes[status.levelFloor].floor[roomsArr[0][0]][5]
    newData.scenes[status.levelFloor].hero[1] = newData.scenes[status.levelFloor].floor[roomsArr[0][0]][6] - 1
    //V65: 4 этаж («Пустота») — ни объектов, ни врагов: единственная комната помечается
    //открытой (sceneGenerate рисует её сразу), босса спавнит spawnVoidBoss. Дальше
    //обычный конвейер (стартовая бочка, спеки врагов, столбы 3 этажа) не выполняется
    if(status.levelFloor === 3) {
        roomsArr[0][3] = 1
        newData.scenes[status.levelFloor].roomsArr = roomsArr
        return
    }
    newData.scenes[status.levelFloor].objects.push([newData.scenes[status.levelFloor].floor[roomsArr[0][0]][5],newData.scenes[status.levelFloor].floor[roomsArr[0][0]][6] - 3,4,1,2,undefined])
    newData.scenes[status.levelFloor].objects[newData.scenes[status.levelFloor].objects.length-1][9] = roomsArr[0]
    roomsArr[0][3] = 1
    //количество врагов
    let length = roomsArr.length
    for (let i = 0; i < length; i++) {
        let enemyNum = Math.trunc(roomsArr[i][1]/40)
        if (enemyNum > 1) {
            let enemes = []
            let raceType = Math.random()
            if(raceType>0.7) {
                enemes[0] = [0,0]
                enemes[1] = [Math.trunc(enemyNum/2),0]
            } else {enemes[0] = [enemyNum,0]; enemes[1] = [0,0]}
            enemyNum >= 7 && (raceType>0.7?enemes[2] = [1,1]:enemes[2] = [1,0])
            //V43: на 3 этаже босса («Демон») при генерации НЕТ — его призывают столбы
            //(finPillars.js); самая большая комната остаётся обычной комнатой с врагами
            if(i === roomsArr.length - 1 && status.levelFloor !== 2) {enemes[0] = [0,0],enemes[1] = [0,0],enemes[2] = [0,0],enemes[3] = [1,0]}
            roomsArr[i].push(enemes)
            roomsArr[i].push(0)
            newData.scenes[status.levelFloor].roomsArr = roomsArr
            configEnemesRoomObject(roomsArr[i],newData,enemyNum,i)
        } else if (i > 0) {
            configEmptyRoomObject(roomsArr[i],newData)
        }
        //ловушка: шанс на свободную клетку в комнате; в самой ПЕРВОЙ комнате (спавн героя,
        //roomsArr[0]) ловушек не ставим вообще — только во всех последующих
        i > 0 && configTrapObject(roomsArr[i],newData)
    }
    //V43: столбы призыва босса — только на 3 этаже; 4 разные комнаты, кроме стартовой
    //(finPillars.js). roomsArr к этому моменту собран полностью.
    status.levelFloor === 2 && configFinPillars(newData.scenes[status.levelFloor])
}
//ловушка (тип 14, 1x1). Спрайт из ./images/dungeon/traps/ (в obj[10] — номер спрайта:
//3 шипы / 4 кислота / 1 огонь — V63, огонь только на 3-м этаже, там пул из трёх поровну).
//Взведена, пока obj[7] !== 1; обезвреживается как обычный интерактивный объект, после чего
//можно разбить атакой как бочку (obj[7] === 1, obj[8] === undefined).
//V63 фазы (логика в trapsFx.js): obj[12] — таймер фазы (старт с полных 2с), obj[13]=0 —
//«выключенное» состояние (спрайт Ne.png), obj[14..16] — служебные таймеры облака кислоты.
function configTrapObject(room,newData) {
    if(Math.random() >= 0.15) return
    let level = newData.scenes[status.levelFloor]
    //прямоугольник комнаты берётся из floor по индексу room[0] (в roomsArr лежат индекс и площадь)
    let roomFloore = level.floor[room[0]]
    let heroX = level.hero[0]
    let heroY = level.hero[1]
    for (let attempt = 0; attempt < 50; attempt++) {
        let x = roomFloore[0] + 1 + Math.trunc(Math.random() * (roomFloore[2] - 2))
        let y = roomFloore[1] + 1 + Math.trunc(Math.random() * (roomFloore[3] - 2))
        //не ставим на точку спавна героя
        if(x === heroX && y === heroY) continue
        //свободная клетка: без других объектов
        let free = true
        let lengthObjects = level.objects.length
        for (let i = 0; i < lengthObjects; i++) {
            let obj = level.objects[i]
            if(x >= obj[0] && x < obj[0] + obj[3] && y >= obj[1] && y < obj[1] + obj[4]) {
                free = false
                break
            }
        }
        if(free) {
            level.objects.push([x,y,14,1,1,undefined])
            let trap = level.objects[level.objects.length-1]
            trap[9] = room
            //V63: огненная ловушка (1) — только 3-й этаж; на 3-м пул из трёх поровну
            let pool = status.levelFloor === 2 ? [1,3,4] : [3,4]
            trap[10] = pool[Math.trunc(Math.random() * pool.length)]
            trap[12] = 125  //первая фаза — полные 2 секунды
            trap[13] = 0    //старт с «выключенного» состояния (Ne.png)
            return
        }
    }
}
function configEmptyRoomObject(room,newData) {
    let rareObjArr = [
        [3,3,3],
        [6,3,3],
        [10,3,2],
        [11,3,3],
        [12,3,2],
        //V49: статуя неизвестного героя (баф) — на всех этажах, шанс 1/6 на пустую комнату
        [16,1,2],
        //V54: алхимический стол — на всех этажах, шанс 1/7 на пустую комнату; НЕ более 1 на
        //этаж (решение пользователя: минимум 0 — может и не выпасть, максимум 1)
        [17,2,2],
        //V75: шкафчик с древностями (благословение до конца забега) — на всех этажах, шанс
        //1/8 на пустую комнату (пул вырос с 7 до 8); НЕ более 1 на этаж (решение пользователя)
        [20,1,1]]
    //стол (17) и шкафчик (20) уже стоят на этаже — исключаются из пула (лимит 1 на этаж каждый)
    let pool = rareObjArr
    let levelObjects = newData.scenes[status.levelFloor].objects
    let lengthObjects = levelObjects.length
    for (let i = 0; i < lengthObjects; i++) {
        (levelObjects[i][2] === 17 || levelObjects[i][2] === 20) &&
            (pool = pool.filter(t => t[0] !== levelObjects[i][2]))
    }
    let type = Math.trunc(Math.random()*pool.length)
    newData.scenes[status.levelFloor].objects.push([
        newData.scenes[status.levelFloor].floor[room[0]][5]-1,
        newData.scenes[status.levelFloor].floor[room[0]][6]-1,
        pool[type][0],pool[type][1],pool[type][2],undefined])
    newData.scenes[status.levelFloor].objects[newData.scenes[status.levelFloor].objects.length-1][8] = 1
    newData.scenes[status.levelFloor].objects[newData.scenes[status.levelFloor].objects.length-1][9] = room
}
function configEnemesRoomObject(room,newData,enemyNum,i) {
    let commonObjArr = [
        [1,1,2],
        [2,2,2],
        [5,1,1],
        [7,2,2],
        [8,1,1],
        //V64a: портал (18) — из ОБЩЕГО пула объектов в комнатах с врагами (решение
        //пользователя: «как другие интерактивные объекты»); не более 1 на этаж, только
        //на свободной клетке. Рычаг ставит configPortal (portalFx.js) в любой комнате
        [18,1,1]]
    let level = newData.scenes[status.levelFloor]
    //мега-сундук и спуск ставятся ДО пула (V64a): они занимают фиксированные клетки у центра
    //и занятость не проверяют — портал из пула обязан видеть их в cellBusy
    //E-15: в САМОЙ большой комнате (последняя в roomsArr — там босс этажей 1-2 и спуск)
    //регулярный мега-сундук не ставится — вместо него «сундук босса» (ниже, с меткой [10])
    if(enemyNum >= 6 && i !== level.roomsArr.length - 1) {
        level.objects.push([level.floor[room[0]][5]-1,level.floor[room[0]][6]-1,9,2,2,undefined])
        level.objects[level.objects.length-1][9] = room
    }
    if(i === level.roomsArr.length - 1) {
        //верх спуска (2×2) не должен выходить за северную границу комнаты — иначе объект не
        //отрисовывается (вне клеток пола комнаты) и useObject на нём падает
        let exitY = level.floor[room[0]][6]-4
        exitY < level.floor[room[0]][1]+1 && (exitY = level.floor[room[0]][1]+1)
        level.objects.push([level.floor[room[0]][5]-1,exitY,13,2,2,undefined])
        level.objects[level.objects.length-1][9] = room
        //E-15: сундук босса — гарантированный 2×2 сундук в самой большой комнате этажей
        //1-3 (та же клетка у центра, где раньше стоял мега-сундук). Метка [10]=1 (у типа 9
        //поле свободно — занято только у ловушек 14): при вскрытии даёт случайное ОРУЖИЕ,
        //редкость по этажу — 1 этаж редкое / 2 эпическое / 3 легендарное (useObject.drop)
        level.objects.push([level.floor[room[0]][5]-1,level.floor[room[0]][6]-1,9,2,2,undefined])
        level.objects[level.objects.length-1][9] = room
        level.objects[level.objects.length-1][10] = 1
    }
    let lengthCommon = Math.trunc(Math.random()*(enemyNum/2)) + 1
    for (let i = 0; i < lengthCommon; i++) {
        //портал уже стоит на этаже — исключён из пула (лимит 1, как у алхимического стола)
        let pool = commonObjArr
        for (let io = 0; io < level.objects.length; io++) {
            if (level.objects[io][2] === 18) { pool = commonObjArr.filter(t => t[0] !== 18); break }
        }
        let type = Math.trunc(Math.random()*pool.length)
        if (pool[type][0] === 18) {
            //портал — только на свободной клетке (объекты/стены/точка спавна героя, portalFx);
            //свободной нет — вместо портала катится другой хлам из пула
            if (placeRoomObject(level, room, 18, 0)) continue
            pool = pool.filter(t => t[0] !== 18)
            type = Math.trunc(Math.random()*pool.length)
        }
        let x = level.floor[room[0]][0]+1+Math.trunc(Math.random()*(level.floor[room[0]][2]-2))
        let y = level.floor[room[0]][1]+1+Math.trunc(Math.random()*(level.floor[room[0]][3]-3))
        x >= level.floor[room[0]][5]-1 && x <= level.floor[room[0]][5]+1 &&
        y >= level.floor[room[0]][6]-1 && y <= level.floor[room[0]][6]+1 &&
        (x -= 3)
        //объект обязан остаться внутри комнаты: createRoom рисует картинку объекта только на клетке
        //пола своей комнаты, а checkObject находит объекты чисто геометрически — вынесенный за западную
        //стену объект становился невидимым и ронял useObject (find по screenPic давал undefined)
        x < level.floor[room[0]][0]+1 && (x = level.floor[room[0]][0]+1)
        //хлам
        level.objects.push([x,y,pool[type][0],pool[type][1],pool[type][2],undefined])
        level.objects[level.objects.length-1][9] = room
    }
}
export {newGame}