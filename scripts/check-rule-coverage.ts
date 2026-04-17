import { readFileSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'

interface RulePath {
  collection: string
  line: number
}

function extractRulePaths(rulesSrc: string): RulePath[] {
  const paths: RulePath[] = []
  const lines = rulesSrc.split('\n')
  let depth = 0
  lines.forEach((line, idx) => {
    const stripped = line.replace(/\{[^}]+\}/g, 'VAR')
    const opensBlock = stripped.includes('{')
    const closesBlock = stripped.includes('}')
    const m = line.match(/^\s*match\s+\/([a-zA-Z_][\w]*)\//)
    if (m) {
      if (depth == 2) {
        paths.push({ collection: m[1], line: idx + 1 })
      }
    }
    if (opensBlock) depth++
    if (closesBlock) depth = Math.max(0, depth - 1)
  })
  return Array.from(
    new Set(paths.filter((p) => p.collection !== 'document').map((p) => p.collection)),
  ).map((c, i) => ({ collection: c, line: i }))
}

function readAllTestFiles(testRoot: string): string {
  const files: string[] = []
  try {
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
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error(`✗ Failed to read test files from ${testRoot}: ${err.message}`)
      process.exit(1)
    }
    throw err
  }
  return files.join('\n')
}

function isServerOnly(rulesSrc: string, collection: string): boolean {
  const lines = rulesSrc.split('\n')
  let inBlock = false
  let braceDepth = 0
  const blockLines: string[] = []
  for (const line of lines) {
    // Check for match statement with collection name (handle template interpolation)
    const matchPattern = new RegExp(`^\\s*match\\s+/\\s*${collection}\\s*/\\s*\\{?\\w*\\}\\s*\\{`)
    const matchMatch = line.match(matchPattern)
    if (matchMatch) {
      inBlock = true
      braceDepth = 1
      blockLines.push(line)
      continue
    }
    if (inBlock) {
      blockLines.push(line)
      const openCount = (line.match(/\{/g) || []).length
      const closeCount = (line.match(/\}/g) || []).length
      braceDepth += openCount - closeCount
      if (braceDepth === 0 && blockLines.length > 2) break
    }
  }
  if (blockLines.length === 0) return false
  const block = blockLines.join('\n')
  const normalized = block.replace(/\s+/g, ' ').replace(/\/\/.*$/gm, '')
  // Match "allow <ops>: if false;" where <ops> can be comma-separated (e.g., "read, write")
  const hasAllowIfFalse = /allow\s+[\w\s,]+:\s*if\s+false\s*;/.test(normalized)
  const hasAllowNotFalse = /allow\s+[\w\s,]+:\s*if\s+(?!false)/.test(normalized)
  return hasAllowIfFalse && !hasAllowNotFalse
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
    if (!hasPositive && !isServerOnly(rulesSrc, collection)) {
      m.push('positive (assertSucceeds) missing')
    }
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