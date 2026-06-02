// Re-uses create-test-accounts.ts logic for dev-all.mjs seeding.
// Kept as a separate entrypoint so dev-all.mjs can reference a stable path.
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const child = spawn('npx', ['tsx', path.join(__dirname, 'create-test-accounts.ts')], {
  stdio: 'inherit',
  cwd: path.resolve(__dirname, '..'),
})

child.on('exit', (code) => {
  process.exit(code ?? 0)
})
