import { expect, afterEach, beforeEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'
import 'fake-indexeddb/auto'

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers)

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Clear IndexedDB before each test
beforeEach(() => {
  indexedDB.databases().then((dbs) => {
    return Promise.all(
      dbs.map((db) => indexedDB.deleteDatabase(db.name))
    )
  })
})
