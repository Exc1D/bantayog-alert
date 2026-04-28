#!/usr/bin/env node
// e2e-tests/k6/run.cjs
// Cross-platform wrapper for npm run load-test.
// Usage: SCENARIO=accept-dispatch-race npm run load-test

const scenario = process.env.SCENARIO
if (!scenario) {
  console.error('Error: SCENARIO env var is required.')
  console.error('Usage: SCENARIO=accept-dispatch-race npm run load-test')
  process.exit(1)
}

const { execFileSync } = require('child_process')
const path = require('path')

const scenarioPath = path.join(__dirname, 'scenarios', `${scenario}.js`)

try {
  execFileSync('k6', ['run', scenarioPath], { stdio: 'inherit' })
} catch (err) {
  process.exit(err.status || 1)
}
