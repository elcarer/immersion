function aStar(map,end,start) {
    let width = map[0].length
    let height = map.length
    let grid = new PF.Grid(width,height)
    let finder = new PF.AStarFinder()
    let length = map.length
    let length2 = map[0].length
    for (let i = 0; i < length; i++) {
        for (let i1 = 0; i1 < length2; i1++) {
            (map[i][i1]===0 || map[i][i1]===2) && grid.setWalkableAt(i1, i, false)
        }
    }
    //V17: защита от координат вне сетки: PF.Grid.setWalkableAt на несуществующем узле
    //падал «Cannot set properties of undefined (setting 'walkable')» (враг вне своей
    //комнаты при патруле). Вызывающие стороны проверяют границы, это — страховка.
    let sx = start[0] < 0 ? 0 : start[0] >= width ? width - 1 : start[0]
    let sy = start[1] < 0 ? 0 : start[1] >= height ? height - 1 : start[1]
    let ex = end[0] < 0 ? 0 : end[0] >= width ? width - 1 : end[0]
    let ey = end[1] < 0 ? 0 : end[1] >= height ? height - 1 : end[1]
    grid.setWalkableAt(sx, sy, true)
    grid.setWalkableAt(ex, ey, true)
    let path = finder.findPath(sx, sy, ex, ey, grid)
    path.shift()
    return path
}

export {aStar}
