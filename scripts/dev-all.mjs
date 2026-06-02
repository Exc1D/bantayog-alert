#!/usr/bin/env node
/**
 * Start all dev servers + Firebase emulators in parallel.
 *
 * Usage:
 *   pnpm dev:all
 *
 * Starts:
 *   - Firebase emulators (auth 9099, firestore 8081, db 9000, storage 9199,
 *                        functions 5001, hosting 5002/5007/5008)
 *   - citizen-pwa       http://localhost:5173
 *   - admin-desktop     http://localhost:5175
 *   - responder-app     http://localhost:5174
 *
 * Seeds empty demo accounts automatically after emulators are ready.
 *
 * Press Ctrl-C once to terminate all processes cleanly.
 */

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

const colors = {
  emulators: '\x1b[36m', // cyan
  citizen: '\x1b[32m', // green
  admin: '\x1b[34m', // blue
  responder: '\x1b[35m', // magenta
  seed: '\x1b[33m', // yellow
  reset: '\x1b[0m',
  bold: '\x1b[1m',
}

function prefixLogger(name, color) {
  return (data) => {
    const lines = data.toString().split('\n').filter(Boolean)
    for (const line of lines) {
      console.log(`${color}[${name}]${colors.reset} ${line}`)
    }
  }
}

const procs = []

function start(name, color, cmd, args, opts = {}) {
  console.log(`${colors.bold}${color}▶ Starting ${name}...${colors.reset}`)
  const child = spawn(cmd, args, {
    stdio: 'pipe',
    shell: false,
    ...opts,
  })
  child.stdout.on('data', prefixLogger(name, color))
  child.stderr.on('data', prefixLogger(name, color))
  child.on('exit', (code, signal) => {
    console.log(
      `${color}[${name}] exited${code !== null ? ` with code ${code}` : ` by signal ${signal}`}${colors.reset}`,
    )
  })
  procs.push(child)
  return child
}

function shutdown(exitCode = 0) {
  console.log(`\n${colors.bold}Shutting down all processes...${colors.reset}`)
  for (const proc of procs) {
    proc.kill('SIGTERM')
  }
  // Force kill after 5s
  setTimeout(() => {
    for (const proc of procs) {
      if (!proc.killed) proc.kill('SIGKILL')
    }
    process.exit(exitCode)
  }, 5000)
}

process.on('SIGINT', () => shutdown())
process.on('SIGTERM', () => shutdown())

// ── Start emulators ──────────────────────────────────────────────
const emulators = start(
  'emulators',
  colors.emulators,
  'pnpm',
  [
    'dlx',
    'firebase-tools',
    'emulators:start',
    '--only',
    'auth,firestore,database,storage,functions,hosting',
  ],
  {
    cwd: rootDir,
  },
)
emulators.on('exit', (code) => {
  if (code !== null && code !== 0) shutdown(code)
})

// Wait 15s for emulators to be ready before starting dev servers
setTimeout(() => {
  // ── Start citizen-pwa ──────────────────────────────────────────
  start('citizen-pwa', colors.citizen, 'pnpm', ['dev', '--port', '5173'], {
    cwd: path.join(rootDir, 'apps', 'citizen-pwa'),
    env: {
      ...process.env,
      VITE_USE_EMULATOR: 'true',
    },
  })

  // ── Start admin-desktop ────────────────────────────────────────
  start('admin-desktop', colors.admin, 'pnpm', ['dev', '--port', '5175'], {
    cwd: path.join(rootDir, 'apps', 'admin-desktop'),
    env: {
      ...process.env,
      VITE_USE_EMULATOR: 'true',
    },
  })

  // ── Start responder-app ────────────────────────────────────────
  start('responder-app', colors.responder, 'pnpm', ['dev', '--port', '5174'], {
    cwd: path.join(rootDir, 'apps', 'responder-app'),
    env: {
      ...process.env,
      VITE_USE_EMULATOR: 'true',
    },
  })

  console.log(`\n${colors.bold}All services starting...${colors.reset}`)
  console.log(`${colors.citizen}  citizen-pwa   → http://localhost:5173${colors.reset}`)
  console.log(`${colors.admin}  admin-desktop → http://localhost:5175${colors.reset}`)
  console.log(`${colors.responder}  responder-app → http://localhost:5174${colors.reset}`)
  console.log(`${colors.emulators}  Emulator UI   → http://127.0.0.1:4000${colors.reset}`)

  const seed = start(
    'demo-seed',
    colors.seed,
    'pnpm',
    ['exec', 'tsx', 'scripts/seed-demo-accounts.ts'],
    { cwd: rootDir },
  )
  seed.on('exit', (code) => {
    if (code !== 0) {
      console.error(`${colors.seed}[demo-seed] Failed to prepare demo accounts.${colors.reset}`)
      shutdown(1)
      return
    }

    console.log(`\n${colors.bold}${colors.seed}Demo accounts ready:${colors.reset}`)
    console.log(`  Admin     daet-admin-test-01@test.local / test123456`)
    console.log(`  Responder bfp-responder-test-01@test.local / test123456\n`)
  })
}, 15000)
