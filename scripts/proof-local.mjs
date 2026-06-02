#!/usr/bin/env node
import { spawn } from 'node:child_process'
import net from 'node:net'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_PROJECT_ID = 'bantayog-alert-staging'
const PORT_TIMEOUT_MS = 180_000

const MANAGED_PORTS = [
  { label: 'emulator ui', host: '127.0.0.1', port: 4000 },
  { label: 'functions emulator', host: '127.0.0.1', port: 5001 },
  { label: 'citizen hosting emulator', host: '127.0.0.1', port: 5002 },
  { label: 'admin hosting emulator', host: '127.0.0.1', port: 5007 },
  { label: 'responder hosting emulator', host: '127.0.0.1', port: 5008 },
  { label: 'citizen-pwa', host: 'localhost', port: 5173 },
  { label: 'responder-app', host: 'localhost', port: 5174 },
  { label: 'admin-desktop', host: 'localhost', port: 5175 },
  { label: 'firestore emulator', host: '127.0.0.1', port: 8081 },
  { label: 'rtdb emulator', host: '127.0.0.1', port: 9000 },
  { label: 'auth emulator', host: '127.0.0.1', port: 9099 },
  { label: 'storage emulator', host: '127.0.0.1', port: 9199 },
]

export function buildPlan(env = process.env) {
  const projectId = env.BANTAYOG_FIREBASE_PROJECT_ID?.trim() || DEFAULT_PROJECT_ID
  return {
    steps: [
      'preflight-ports',
      'prepare-functions',
      'start-local-stack',
      'wait-for-readiness',
      'run-proof',
      'shutdown',
    ],
    managedPorts: MANAGED_PORTS,
    prepare: {
      command: 'pnpm',
      args: ['exec', 'tsx', 'scripts/prepare-functions-deploy.ts'],
    },
    stack: {
      command: 'pnpm',
      args: ['dev:all'],
    },
    proof: {
      command: 'pnpm',
      args: ['--dir', 'e2e-tests', 'proof:local'],
      env: {
        CI: 'true',
        BANTAYOG_FIREBASE_PROJECT_ID: projectId,
      },
    },
  }
}

function logStep(message) {
  console.log(`\n[proof:local] ${message}`)
}

function runCommand(step, command, args, options = {}) {
  logStep(step)
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT_DIR,
      env: process.env,
      stdio: 'inherit',
      shell: false,
      ...options,
    })

    child.on('error', reject)
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve()
        return
      }
      const suffix = code !== null ? `exit code ${code}` : `signal ${signal ?? 'unknown'}`
      reject(new Error(`${step} failed with ${suffix}`))
    })
  })
}

function startStack(plan) {
  logStep('Starting local Firebase/app stack')
  const child = spawn(plan.stack.command, plan.stack.args, {
    cwd: ROOT_DIR,
    env: process.env,
    stdio: 'inherit',
    shell: false,
  })
  child.on('exit', (code, signal) => {
    if (code !== null && code !== 0) {
      console.error(`[proof:local] local stack exited with code ${code}`)
    } else if (signal) {
      console.error(`[proof:local] local stack exited by signal ${signal}`)
    }
  })
  return child
}

function canConnect(host, port, timeoutMs = 500) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port })
    const finish = (open) => {
      socket.removeAllListeners()
      socket.destroy()
      resolve(open)
    }
    socket.setTimeout(timeoutMs)
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(false))
    socket.once('error', () => finish(false))
  })
}

async function assertPortsFree(ports) {
  const occupied = []
  for (const item of ports) {
    if (await canConnect(item.host, item.port)) occupied.push(item)
  }
  if (occupied.length === 0) return

  const list = occupied.map((item) => `${item.label} ${item.host}:${item.port}`).join(', ')
  throw new Error(`Local proof manages these ports, but they are already in use: ${list}`)
}

async function waitForPorts(ports, timeoutMs) {
  logStep('Waiting for local stack readiness')
  const startedAt = Date.now()
  const pending = new Map(ports.map((item) => [item.port, item]))

  while (pending.size > 0 && Date.now() - startedAt < timeoutMs) {
    for (const [port, item] of [...pending.entries()]) {
      if (await canConnect(item.host, port)) {
        pending.delete(port)
        console.log(`[proof:local] ready: ${item.label} ${item.host}:${port}`)
      }
    }
    if (pending.size > 0) await delay(500)
  }

  if (pending.size > 0) {
    const list = [...pending.values()]
      .map((item) => `${item.label} ${item.host}:${item.port}`)
      .join(', ')
    throw new Error(`Timed out waiting for local proof ports: ${list}`)
  }
}

async function stopStack(child) {
  if (!child || child.exitCode !== null) return

  logStep('Stopping local stack')
  child.kill('SIGTERM')
  const exited = await new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(false), 10_000)
    child.once('exit', () => {
      clearTimeout(timeout)
      resolve(true)
    })
  })

  if (!exited) {
    child.kill('SIGKILL')
  }
}

async function main() {
  const plan = buildPlan()
  if (process.argv.includes('--print-plan')) {
    console.log(JSON.stringify(plan, null, 2))
    return
  }

  let stack
  let interrupted = false
  const interrupt = () => {
    interrupted = true
    void stopStack(stack).finally(() => process.exit(130))
  }
  process.once('SIGINT', interrupt)
  process.once('SIGTERM', interrupt)

  try {
    await assertPortsFree(plan.managedPorts)
    await runCommand('Preparing functions-dist', plan.prepare.command, plan.prepare.args)
    stack = startStack(plan)
    await waitForPorts(plan.managedPorts, PORT_TIMEOUT_MS)
    await delay(3000)
    await runCommand('Running C00-C09 reliability proof', plan.proof.command, plan.proof.args, {
      env: { ...process.env, ...plan.proof.env },
    })
  } finally {
    if (!interrupted) await stopStack(stack)
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
