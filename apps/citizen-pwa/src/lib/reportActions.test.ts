import { describe, it, expect } from 'vitest'
import { actionsFor } from './reportActions.js'

describe('actionsFor', () => {
  it('returns edit and cancel for new', () => {
    expect(actionsFor('new')).toEqual(['edit', 'cancel'])
  })

  it('returns edit and cancel for awaiting_verify', () => {
    expect(actionsFor('awaiting_verify')).toEqual(['edit', 'cancel'])
  })

  it('returns request_correction for verified', () => {
    expect(actionsFor('verified')).toEqual(['request_correction'])
  })

  it('returns request_correction for en_route', () => {
    expect(actionsFor('en_route')).toEqual(['request_correction'])
  })

  it('returns request_correction for resolved', () => {
    expect(actionsFor('resolved')).toEqual(['request_correction'])
  })

  it('returns empty for closed', () => {
    expect(actionsFor('closed')).toEqual([])
  })

  it('returns empty for cancelled', () => {
    expect(actionsFor('cancelled')).toEqual([])
  })

  it('returns empty for draft_inbox', () => {
    expect(actionsFor('draft_inbox')).toEqual([])
  })
})
