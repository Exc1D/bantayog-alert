#!/usr/bin/env tsx
/**
 * Prepares a self-contained functions-dist/ directory for Firebase deployment.
 *
 * pnpm workspaces use `workspace:*` deps which Cloud Build (npm) can't resolve.
 * Solution: use esbuild to bundle all @bantayog/* workspace deps inline so
 * Cloud Build only needs to npm-install the external (published) packages.
 *
 * External packages (NOT bundled):
 *   - firebase-admin, firebase-functions (runtime-provided)
 *   - @google-cloud/* (native/large)
 *   - sharp (native binary)
 *   - All others listed in package.json dependencies that are on npm
 */

// fallow-ignore-file security-sink
import { spawnSync } from 'child_process'
import { readFileSync, writeFileSync, rmSync, existsSync, mkdirSync } from 'fs'
import { resolve } from 'path'

const ROOT = resolve(import.meta.dirname, '..')
const DIST = resolve(ROOT, 'functions-dist')
const FUNCTIONS = resolve(ROOT, 'functions')

function run(file: string, args: string[], cwd = ROOT) {
  console.log(`> ${file} ${args.join(' ')}`)
  const result = spawnSync(file, args, { cwd, stdio: 'inherit', shell: false })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

// Build functions TypeScript (esbuild handles @bantayog/* TS source natively)
run('pnpm', ['--filter', '@bantayog/functions', 'build'])

// Prepare clean dist dir
if (existsSync(DIST)) rmSync(DIST, { recursive: true, force: true })
mkdirSync(DIST)
mkdirSync(resolve(DIST, 'lib'))

// Bundle with esbuild: inline @bantayog/* workspace deps, keep published deps external
// This avoids the workspace:* protocol problem entirely.
const EXTERNAL = [
  'firebase-admin',
  'firebase-functions',
  '@google-cloud/bigquery',
  '@google-cloud/logging',
  'sharp',
  '@turf/turf',
  'exifr',
  'file-type',
  'geojson',
  'ngeohash',
  'bcryptjs',
  'zod',
]
const externalFlags = EXTERNAL.map((e) => `--external:${e}`)
run('pnpm', [
  'exec',
  'esbuild',
  'functions/lib/index.js',
  '--bundle',
  '--platform=node',
  '--target=node20',
  '--format=esm',
  ...externalFlags,
  '--outfile=functions-dist/lib/index.js',
])

// Write minimal package.json — only published (non-workspace) deps
const srcPkg = JSON.parse(readFileSync(resolve(FUNCTIONS, 'package.json'), 'utf8')) as {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  engines?: Record<string, string>
}
const distPkg = {
  name: '@bantayog/functions',
  version: '0.0.0',
  private: true,
  type: 'module',
  main: './lib/index.js',
  engines: srcPkg.engines,
  dependencies: Object.fromEntries(
    Object.entries(srcPkg.dependencies ?? {}).filter(([k]) => !k.startsWith('@bantayog/')),
  ),
}
writeFileSync(resolve(DIST, 'package.json'), JSON.stringify(distPkg, null, 2) + '\n')

// Install published deps so Firebase CLI can analyze the bundle
run('npm', ['install', '--prefer-offline', '--no-audit', '--no-fund', '--ignore-scripts'], DIST)
console.log('functions-dist/ ready for Firebase deploy')
