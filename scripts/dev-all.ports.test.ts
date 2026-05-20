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
})
