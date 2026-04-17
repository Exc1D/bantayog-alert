import { readFileSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'

interface RulePath {
  collection: string
  line: number
}

function extractRulePaths(rulesSrc: string): RulePath[] {
  const paths: RulePath[] = []
  const lines = rulesSrc.split('\n')
  lines.forEach((line, idx) => {
    const m = line.match(/match\s+\/([a-zA-Z_][\w]*)/)
    if (m) {
      paths.push({ collection: m[1], line: idx + 1 })
    }
  })
  return Array.from(
    new Set(paths.filter((p) => p.collection !== 'document').map((p) => p.collection)),
  ).map((c, i) => ({ collection: c, line: i }))
}

function readAllTestFiles(testRoot: string): string {
  const files: string[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (
        entry.name.endsWith('.rules.test.ts') ||
        entry.name === 'rtdb.rules.test.ts' ||
        entry.name === 'storage.rules.test.ts'
      ) {
        files.push(readFileSync(full, 'utf8'))
      }
    }
  }
  walk(testRoot)
  return files.join('\n')
}

function main(): void {
  const rulesPath = resolve(process.cwd(), 'infra/firebase/firestore.rules')
  const rulesSrc = readFileSync(rulesPath, 'utf8')
  const paths = extractRulePaths(rulesSrc)

  const testsRoot = resolve(process.cwd(), 'functions/src/__tests__')
  const testsSrc = readAllTestFiles(testsRoot)

  const missing: { collection: string; missing: string[] }[] = []
  for (const { collection } of paths) {
    const m: string[] = []
    const refRegex = new RegExp(`['"\`]${collection}[/'"\`]`)
    const matches = testsSrc.split(/\n\s*it\(/).filter((block) => refRegex.test(block))
    const hasPositive = matches.some((b) => /assertSucceeds/.test(b))
    const hasNegative = matches.some((b) => /assertFails/.test(b))
    if (!hasPositive) m.push('positive (assertSucceeds) missing')
    if (!hasNegative) m.push('negative (assertFails) missing')
    if (m.length > 0) missing.push({ collection, missing: m })
  }

  if (missing.length > 0) {
    console.error('✗ Rule coverage gaps detected:')
    for (const gap of missing) {
      console.error(`  - /${gap.collection}: ${gap.missing.join(', ')}`)
    }
    process.exit(1)
  }

  console.log(
    `✓ Rule coverage OK — ${paths.length} collections, positive + negative tests present for each.`,
  )
}

main()