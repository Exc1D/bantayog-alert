/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe('globals.css', () => {
  it('exists at src/styles/globals.css', () => {
    const filePath = path.resolve(__dirname, 'globals.css')
    expect(existsSync(filePath)).toBe(true)
  })
})
