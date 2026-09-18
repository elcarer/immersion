// Аудит-скан: импорты/экспорты, ключи локализации, пути картинок
import { readFileSync, readdirSync, existsSync, statSync } from "fs"
import { join, dirname } from "path"

const SCR = "D:/ZCode/project2/example/build/scripts"
const IMG = "D:/ZCode/project2/example/build"
const files = readdirSync(SCR).filter(f => f.endsWith(".js"))

let problems = []

// ---------- 1. Импорты: файл существует + именованный экспорт есть ----------
const exportsMap = new Map() // file -> Set of exported names
for (const f of files) {
    const src = readFileSync(join(SCR, f), "utf8")
    const names = new Set()
    // export { a, b, c }
    for (const m of src.matchAll(/export\s*\{([^}]+)\}/g)) {
        for (let part of m[1].split(",")) {
            part = part.trim()
            if (!part) continue
            // "a as b" — наружу идёт b
            const as = part.split(/\s+as\s+/)
            names.add((as[1] || as[0]).trim())
        }
    }
    // export function/const/let/var/class name
    for (const m of src.matchAll(/export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1])
    // export default
    if (/export\s+default\s/.test(src)) names.add("default")
    exportsMap.set(f, names)
}

for (const f of files) {
    const src = readFileSync(join(SCR, f), "utf8")
    for (const m of src.matchAll(/import\s+(?:([A-Za-z_$][\w$]*)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s*["']([^"']+)["']/g)) {
        const [, defImport, named, spec] = m
        const target = spec.replace(/^\.\.\//, "").replace(/^\.\//, "")
        const tf = target.startsWith("scripts/") ? target.slice(8) : target
        if (!exportsMap.has(tf)) { problems.push(`IMPORT 404: ${f} -> ${spec}`); continue }
        if (named) {
            for (let part of named.split(",")) {
                part = part.trim(); if (!part) continue
                const as = part.split(/\s+as\s+/)
                const want = (as[0] || part).trim()
                if (!exportsMap.get(tf).has(want)) problems.push(`EXPORT MISSING: ${f} imports {${want}} from ${spec}; has: ${[...exportsMap.get(tf)].join(",")}`)
            }
        }
    }
}

// ---------- 2. Ключи локализации ----------
const locSrc = readFileSync(join(SCR, "localization.js"), "utf8")
const locKeys = new Set()
for (const m of locSrc.matchAll(/\[\s*"([^"]+)"\s*,/g)) locKeys.add(m[1])

const dynPrefixes = [] // T("enemy."+e.class.name+".name") — проверяем по data.js отдельно
for (const f of files) {
    const src = readFileSync(join(SCR, f), "utf8")
    for (const m of src.matchAll(/\bT\(\s*"([^"]+)"\s*\)/g)) {
        const key = m[1]
        if (!locKeys.has(key)) {
            // возможна конкатенация: T("a."+x) — это отдельный класс, пропускаем не-константы
            problems.push(`LOC KEY MISSING: ${f}: T("${key}")`)
        }
    }
}

// ---------- 3. Пути картинок ----------
function* walk(dir) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name)
        if (e.isDirectory()) yield* walk(p)
        else yield p
    }
}
const imgFiles = new Set()
for (const p of walk(join(IMG, "images"))) imgFiles.add(p.replace(/\\/g, "/").slice(IMG.length + 1))
const resJson = join(IMG, "images", "resources.json")
if (existsSync(resJson)) {
    const listed = JSON.parse(readFileSync(resJson, "utf8"))
    for (const rel of listed) if (!imgFiles.has("images/" + rel)) problems.push(`RESJSON MISSING FILE: images/${rel}`)
    const listedSet = new Set(listed.map(r => "images/" + r))
    for (const p of imgFiles) if (!listedSet.has(p) && p.endsWith(".png")) problems.push(`NOT IN RESJSON: ${p}`)
}

for (const f of files) {
    const src = readFileSync(join(SCR, f), "utf8")
    for (const m of src.matchAll(/["'](\.\/images\/[^"']+)["']/g)) {
        const rel = m[1].replace(/^\.\//, "")
        if (!imgFiles.has(rel)) problems.push(`IMG 404: ${f}: ${m[1]}`)
    }
}
// data.js — картинки в данных
{
    const src = readFileSync(join(SCR, "data.js"), "utf8")
    for (const m of src.matchAll(/["'](\.\/images\/[^"']+)["']/g)) {
        const rel = m[1].replace(/^\.\//, "")
        if (!imgFiles.has(rel)) problems.push(`IMG 404: data.js: ${m[1]}`)
    }
}

// ---------- 4. T() с конкатенацией: собрать префиксы и проверить, что такие ключи вообще есть ----------
const usedDyn = new Map()
for (const f of files) {
    const src = readFileSync(join(SCR, f), "utf8")
    for (const m of src.matchAll(/T\(\s*"([^"]+)"\s*\+/g)) {
        const pre = m[1]
        if (!usedDyn.has(pre)) usedDyn.set(pre, new Set())
        usedDyn.get(pre).add(f)
    }
}
for (const [pre, fs] of usedDyn) {
    const any = [...locKeys].some(k => k.startsWith(pre))
    if (!any) problems.push(`DYN PREFIX EMPTY: "${pre}" used in ${[...fs].join(",")} — нет ни одного ключа`)
}

console.log(problems.length ? problems.join("\n") : "NO PROBLEMS")
console.log(`--- files: ${files.length}, locKeys: ${locKeys.size}, images: ${imgFiles.size}`)
