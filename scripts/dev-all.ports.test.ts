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
    const accountSeed = readFileSync(new URL('./create-test-accounts.ts', import.meta.url), 'utf8')

    expect(script).toContain('scripts/seed-demo-accounts.ts')
    expect(script).toContain('daet-admin-test-01@test.local')
    expect(script).toContain('bfp-responder-test-01@test.local')
    expect(accountSeed).toContain("'bfp-responder-test-01'")
    expect(accountSeed).toContain("'bfp-responder-test-01@test.local'")
    expect(accountSeed).toContain("collection('responders')")
    expect(accountSeed).toContain("ref('responder_locations/bfp-responder-test-01')")
    expect(script).not.toContain('scripts/bootstrap-staging.ts')
  })

  it('waits for auth, firestore, and realtime database before seeding and propagates failures', () => {
    const wrapper = readFileSync(new URL('./seed-demo-accounts.ts', import.meta.url), 'utf8')
    const accountSeed = readFileSync(new URL('./create-test-accounts.ts', import.meta.url), 'utf8')

    expect(wrapper).toContain('const requiredEmulatorPorts = [8081, 9000, 9099]')
    expect(wrapper).toContain('await waitForEmulators()')
    expect(accountSeed).toContain('process.exit(1)')
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

  it('starts the interactive emulator subset without hosting or pubsub', () => {
    const script = readFileSync(new URL('./dev-all.mjs', import.meta.url), 'utf8')

    expect(script).toContain('auth,firestore,database,storage,functions')
    expect(script).not.toContain('auth,firestore,database,storage,functions,hosting')
  })

  it('starts emulators and apps with one explicit demo project id', () => {
    const script = readFileSync(new URL('./dev-all.mjs', import.meta.url), 'utf8')
    const wrapper = readFileSync(new URL('./seed-demo-accounts.ts', import.meta.url), 'utf8')
    const accountSeed = readFileSync(new URL('./create-test-accounts.ts', import.meta.url), 'utf8')

    expect(script).toContain('BANTAYOG_FIREBASE_PROJECT_ID')
    expect(script).toContain("'--project'")
    expect(script).toContain('VITE_FIREBASE_PROJECT_ID: projectId')
    expect(wrapper).toContain("socket.once('error', () => {")
    expect(wrapper).toContain('socket.destroy()')
    expect(accountSeed).not.toContain("agencyId: 'BFP'")
    expect(accountSeed).toContain("agencyId: 'bfp-daet'")
    expect(accountSeed).toContain('PROJECT_ID = getProjectId()')
  })
})
