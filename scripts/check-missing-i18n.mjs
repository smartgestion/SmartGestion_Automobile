/**
 * Dev-time check: scans src/components/forms/**.tsx for `t('namespace.key')`
 * usages and reports any keys that are missing from any of the three
 * locale files (fr / en / ar).
 *
 * Usage:  node scripts/check-missing-i18n.mjs
 *
 * Exits with status 1 if any missing keys are found, status 0 otherwise.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const locales = ['fr', 'en', 'ar'].reduce((acc, l) => {
  const file = path.join(root, 'src', 'locales', `${l}.json`)
  acc[l] = JSON.parse(fs.readFileSync(file, 'utf8'))
  return acc
}, {})

function get(obj, dotted) {
  return dotted.split('.').reduce((a, c) => (a == null ? a : a[c]), obj)
}

// Scan every .tsx file under src/ for `t('namespace.key')` and `t("namespace.key")`
// occurrences. The regex intentionally only matches keys containing a dot to
// skip generic helpers like t(label) where the argument is a variable.
const srcDir = path.join(root, 'src')
const re = /t\(\s*['"`]([\w.]+)['"`]/g
// Plural-aware i18next: when a code site calls `t('foo.bar', { count })`, the
// JSON should define `foo.bar_one` / `foo.bar_other` instead of `foo.bar`. We
// treat the bare key as "present" if either variant is defined.
const pluralSuffixes = ['', '_one', '_other', '_zero', '_two', '_few', '_many']
function isPresent(obj, key) {
  return pluralSuffixes.some(suf => get(obj, key + suf) != null)
}

function walk(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else if (entry.isFile() && (full.endsWith('.tsx') || full.endsWith('.ts'))) out.push(full)
  }
  return out
}

const missing = { fr: new Set(), en: new Set(), ar: new Set() }
const files = walk(srcDir)

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8')
  let m
  while ((m = re.exec(src))) {
    const key = m[1]
    if (!key.includes('.')) continue
    for (const loc of ['fr', 'en', 'ar']) {
      if (!isPresent(locales[loc], key)) missing[loc].add(key)
    }
  }
}

let hadMissing = false
for (const loc of ['fr', 'en', 'ar']) {
  const keys = [...missing[loc]].sort()
  if (keys.length === 0) {
    console.log(`[${loc}] OK — no missing keys`)
  } else {
    hadMissing = true
    console.log(`[${loc}] MISSING ${keys.length} key(s):`)
    for (const k of keys) console.log(`  - ${k}`)
  }
}

process.exit(hadMissing ? 1 : 0)
