// Re-uses create-test-accounts.ts logic for dev-all.mjs seeding.
// Kept as a separate entrypoint so dev-all.mjs can reference a stable path.
import { spawn } from 'node:child_process'
import { connect } from 'node:net'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const requiredEmulatorPorts = [8081, 9000, 9099]

function canConnect(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect(port, '127.0.0.1')
    socket.setTimeout(1000)
    socket.once('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.once('error', () => resolve(false))
    socket.once('timeout', () => {
      socket.destroy()
      resolve(false)
    })
  })
}

async function waitForEmulators(): Promise<void> {
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    if ((await Promise.all(requiredEmulatorPorts.map(canConnect))).every(Boolean)) return
    await delay(500)
  }
  throw new Error('Timed out waiting for Auth, Firestore, and Realtime Database emulators')
}

await waitForEmulators()

const child = spawn('npx', ['tsx', path.join(__dirname, 'create-test-accounts.ts')], {
  stdio: 'inherit',
  cwd: path.resolve(__dirname, '..'),
})

child.on('exit', (code) => {
  process.exit(code ?? 0)
})
