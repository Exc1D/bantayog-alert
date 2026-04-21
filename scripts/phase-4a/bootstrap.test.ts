import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const BOOTSTRAP_PATH = resolve(process.cwd(), '../../scripts/phase-4a/bootstrap.ts')

describe('bootstrap.ts --allow-prod guard', () => {
  it('exits with code 1 when run without --emulator or --allow-prod', async () => {
    // Set a fake GCLOUD_PROJECT to simulate non-emulator environment
    const proc = spawn('node', [BOOTSTRAP_PATH], {
      env: { ...process.env, GCLOUD_PROJECT: 'fake-prod', FIREBASE_PROJECT: 'fake-prod' },
    })
    const exitCode = await new Promise<number>((resolve) => {
      proc.on('exit', (code) => resolve(code ?? 1))
    })
    expect(exitCode).toBe(1)
  })

  it('exits with code 0 when run with --emulator flag', async () => {
    const proc = spawn('node', [BOOTSTRAP_PATH, '--emulator'], {
      env: { ...process.env, GCLOUD_PROJECT: 'fake-prod' },
    })
    const exitCode = await new Promise<number>((resolve) => {
      proc.on('exit', (code) => resolve(code ?? 1))
    })
    expect(exitCode).toBe(0)
  })

  it('exits with code 0 when run with --allow-prod flag', async () => {
    const proc = spawn('node', [BOOTSTRAP_PATH, '--allow-prod'], {
      env: { ...process.env, GCLOUD_PROJECT: 'fake-prod' },
    })
    const exitCode = await new Promise<number>((resolve) => {
      proc.on('exit', (code) => resolve(code ?? 1))
    })
    expect(exitCode).toBe(0)
  })
})
