/**
 * Dev-time check: scans src/**.tsx for `placeholder="..."` strings that are
 * hard-coded (not i18n'd). Skips obvious technical strings (URLs, numeric
 * masks, single-character placeholders).
 *
 * Usage: node scripts/check-hardcoded-placeholders.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

function walk(dir) {
  const out = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...walk(p))
    else if (e.isFile() && p.endsWith('.tsx')) out.push(p)
  }
  return out
}

const re = /placeholder=(?:"([^"]+)"|'([^']+)'|`([^`]+)`)/g
const isTechnical = v =>
  /^https?:/.test(v) ||
  /^[\d\s.+/_-]+$/.test(v) ||
  v.length < 3

const files = walk(path.join(root, 'src'))
const hits = {}

for (const f of files) {
  const c = fs.readFileSync(f, 'utf8')
  let m
  while ((m = re.exec(c))) {
    const v = m[1] || m[2] || m[3]
    if (isTechnical(v)) continue
    const rel = path.relative(root, f).replace(/\\/g, '/')
    ;(hits[rel] = hits[rel] || []).push(v)
  }
}

const total = Object.values(hits).reduce((a, b) => a + b.length, 0)
console.log(`Found ${total} hard-coded placeholder(s) in ${Object.keys(hits).length} file(s):\n`)
for (const [f, vs] of Object.entries(hits)) {
  console.log(`  ${f}  (${vs.length})`)
  for (const v of vs) console.log(`    - ${v}`)
}

process.exit(total > 0 ? 1 : 0)
