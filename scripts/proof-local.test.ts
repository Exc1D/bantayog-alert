import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

const rootUrl = new URL('../', import.meta.url)

describe('local proof runner', () => {
  it('is exposed as a root package script', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      scripts?: Record<string, string>
    }

    expect(pkg.scripts?.['proof:local']).toBe('node scripts/proof-local.mjs')
  })

  it('prints the managed local proof plan without starting services', () => {
    const result = spawnSync(process.execPath, ['scripts/proof-local.mjs', '--print-plan'], {
      cwd: rootUrl,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    const plan = JSON.parse(result.stdout) as {
      steps: string[]
      managedPorts: Array<{ label: string; host: string; port: number }>
      functionsProbe: { url: string }
      prepare: { args: string[] }
      proof: { args: string[]; env: Record<string, string> }
    }

    expect(plan.steps).toEqual([
      'preflight-ports',
      'prepare-functions',
      'start-local-stack',
      'wait-for-readiness',
      'wait-for-functions',
      'run-proof',
      'shutdown',
    ])
    expect(plan.prepare.args).toContain('scripts/prepare-functions-deploy.ts')
    expect(plan.functionsProbe.url).toBe(
      'http://127.0.0.1:5001/bantayog-alert-staging/asia-southeast1/getOpsMetrics',
    )
    expect(plan.proof.args).toEqual(['--dir', 'e2e-tests', 'proof:local'])
    expect(plan.proof.env).toMatchObject({
      CI: 'true',
      BANTAYOG_FIREBASE_PROJECT_ID: 'bantayog-alert-staging',
    })
    expect(plan.managedPorts.map((item) => item.port).sort((a, b) => a - b)).toEqual([
      4000, 5001, 5173, 5174, 5175, 8081, 9000, 9099, 9199,
    ])
    expect(plan.managedPorts.find((item) => item.label === 'citizen-pwa')?.host).toBe('localhost')
    expect(plan.managedPorts.find((item) => item.label === 'responder-app')?.host).toBe('localhost')
    expect(plan.managedPorts.find((item) => item.label === 'admin-desktop')?.host).toBe('localhost')
    expect(plan.managedPorts.find((item) => item.label === 'functions emulator')?.host).toBe(
      '127.0.0.1',
    )
  })
})
