/**
 * Build rules codegen — generates firestore.rules from firestore.rules.template.
 *
 * Reads DISPATCH_TRANSITIONS from shared-validators and emits the
 * validResponderTransition helper into the template's // @@TRANSITION_TABLES@@ marker.
 *
 * Run: pnpm exec tsx scripts/build-rules.ts
 * Predeploy hook: firebase.json predeploys this via pnpm exec tsx scripts/build-rules.ts
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const TEMPLATE_PATH = resolve(import.meta.dirname, '../infra/firebase/firestore.rules.template')
const OUTPUT_PATH = resolve(import.meta.dirname, '../infra/firebase/firestore.rules')
const MARKER = '// @@TRANSITION_TABLES@@'

interface Transition {
  from: string
  to: string
}

async function main() {
  const template = readFileSync(TEMPLATE_PATH, 'utf8')
  if (!template.includes(MARKER)) {
    console.error(`ERROR: Marker '${MARKER}' not found in template at ${TEMPLATE_PATH}`)
    process.exit(1)
  }

  const SHARED_VALIDATORS_PATH = resolve(
    import.meta.dirname,
    '../packages/shared-validators/src/state-machines/dispatch-states.ts',
  )
  const source = readFileSync(SHARED_VALIDATORS_PATH, 'utf8')

  const dispatchTransitions = extractTransitions(source, 'DISPATCH_TRANSITIONS')
  if (dispatchTransitions.length === 0) {
    console.error('ERROR: Could not extract DISPATCH_TRANSITIONS from shared-validators')
    process.exit(1)
  }

  const validResponderTransitionFn = generateValidResponderTransitionFn(dispatchTransitions)
  const result = template.replace(MARKER, validResponderTransitionFn)

  writeFileSync(OUTPUT_PATH, result, 'utf8')
  console.log(`✓ Rules codegen complete — wrote ${OUTPUT_PATH}`)
  console.log(`  DISPATCH_TRANSITIONS: ${dispatchTransitions.length} entries`)
}

function extractTransitions(source: string, constantName: string): Transition[] {
  // Match: export const DISPATCH_TRANSITIONS: readonly [DispatchStatus, DispatchStatus][] = [
  //                                                    or: readonly [string, string][] = [
  const regex = new RegExp(
    `export\\s+const\\s+${constantName}\\s*:\\s*readonly\\s+\\[(?:DispatchStatus|string),\\s*(?:DispatchStatus|string)\\]\\[\\]\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as\\s*const`,
    'm',
  )
  const match = source.match(regex)
  if (!match) return []

  const body = match[1]
  const tupleRegex = /\[\s*'([^']+)'\s*,\s*'([^']+)'\s*\]/g
  const transitions: Transition[] = []
  let tupleMatch
  while ((tupleMatch = tupleRegex.exec(body)) !== null) {
    transitions.push({ from: tupleMatch[1], to: tupleMatch[2] })
  }
  return transitions
}

function generateValidResponderTransitionFn(transitions: Transition[]): string {
  const base = '      '
  const cont = '          || '
  const arms = transitions.map(({ from, to }) => `${base}(from == '${from}' && to == '${to}')`)
  const body = arms.length > 0 ? arms.join('\n' + cont) + '\n' + cont + 'false;' : 'false;'
  return `function validResponderTransition(from, to) {
      return ${body}
    }`
}

main().catch((err) => {
  console.error('build-rules.ts failed:', err)
  process.exit(1)
})
