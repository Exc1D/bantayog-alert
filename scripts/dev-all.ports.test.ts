import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('dev-all ports', () => {
  it('matches the Playwright and Vite app ports', () => {
    const script = readFileSync(new URL('./dev-all.mjs', import.meta.url), 'utf8')

    expect(script).toContain('http://localhost:5173')
    expect(script).toContain('http://localhost:5174')
    expect(script).toContain('http://localhost:5175')
    expect(script).not.toContain('http://localhost:3001')
    expect(script).not.toContain('http://localhost:4173')
  })

  it('automatically seeds the canonical empty demo accounts', () => {
    const script = readFileSync(new URL('./dev-all.mjs', import.meta.url), 'utf8')

    expect(script).toContain('scripts/seed-demo-accounts.ts')
    expect(script).toContain('daet-admin-test-01@test.local')
    expect(script).toContain('bfp-responder-test-01@test.local')
    expect(script).not.toContain('scripts/bootstrap-staging.ts')
  })

  it('stops instead of launching apps after emulator startup fails', () => {
    const script = readFileSync(new URL('./dev-all.mjs', import.meta.url), 'utf8')

    expect(script).toContain("emulators.on('exit', (code)")
    expect(script).toContain('if (code !== null && code !== 0) shutdown(code)')
  })

  it('keeps signal names out of the numeric shutdown exit code', () => {
    const script = readFileSync(new URL('./dev-all.mjs', import.meta.url), 'utf8')

    expect(script).toContain("process.on('SIGINT', () => shutdown())")
    expect(script).toContain("process.on('SIGTERM', () => shutdown())")
  })

  it('starts the interactive emulator subset without pubsub', () => {
    const script = readFileSync(new URL('./dev-all.mjs', import.meta.url), 'utf8')

    expect(script).toContain('auth,firestore,database,storage,functions,hosting')
    expect(script).not.toContain('auth,firestore,database,storage,functions,hosting,pubsub')
  })
})
