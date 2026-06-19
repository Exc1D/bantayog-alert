import { describe, expect, it, vi } from 'vitest'

import { withFirestoreRulesDisabled } from './firestore-emulator-context.js'

describe('withFirestoreRulesDisabled', () => {
  it('skips without registering a rules-disabled callback when the emulator is unavailable', async () => {
    const skip = vi.fn()
    const run = vi.fn()

    await withFirestoreRulesDisabled({
      env: undefined,
      available: false,
      skip,
      run,
    })

    expect(skip).toHaveBeenCalledWith('Firestore emulator unavailable')
    expect(run).not.toHaveBeenCalled()
  })
})
