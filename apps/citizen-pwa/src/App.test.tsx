import '@testing-library/jest-dom/vitest'
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { App } from './App.js'

describe('App', () => {
  it('renders without throwing', () => {
    expect(() => render(<App />)).not.toThrow()
  })
})
