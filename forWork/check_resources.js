//разовая сверка images/resources.json с фактическими png (и пересборка при расхождении)
const fs = require("fs")
const path = require("path")
const root = path.join(__dirname, "..", "example", "build", "images")
let files = []
;(function walk(d) {
    for (const f of fs.readdirSync(d, {withFileTypes: true})) {
        if (f.isDirectory()) walk(path.join(d, f.name))
        else if (f.name.endsWith(".png")) files.push(path.relative(root, path.join(d, f.name)).split(path.sep).join("/"))
    }
})(root)
files.sort()
const jsonPath = path.join(root, "resources.json")
const arr = JSON.parse(fs.readFileSync(jsonPath, "utf8"))
const set = new Set(arr)
const fset = new Set(files)
console.log("json entries:", arr.length, "| png files:", files.length)
console.log("missing in json:", files.filter(f => !set.has(f)))
console.log("stale in json:", arr.filter(f => !fset.has(f)))
if (process.argv[2] === "--fix") {
    fs.writeFileSync(jsonPath, JSON.stringify(files))
    console.log("resources.json rewritten:", files.length, "entries")
}
