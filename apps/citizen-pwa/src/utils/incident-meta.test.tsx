import '@testing-library/jest-dom/vitest'
import { describe, it, expect } from 'vitest'
import {
  incidentIcon,
  incidentLabel,
  statusMeta,
  severityDotColor,
  INCIDENT_TYPES,
} from './incident-meta'

describe('incident-meta', () => {
  it('incidentIcon returns non-null for all known types', () => {
    for (const type of INCIDENT_TYPES) {
      const icon = incidentIcon(type)
      expect(icon).not.toBeNull()
      expect(icon).toBeDefined()
    }
  })

  it('incidentIcon returns fallback for unknown type', () => {
    const icon = incidentIcon('unknown_type')
    expect(icon).toBeDefined()
  })

  it('incidentLabel returns non-empty string for all known types', () => {
    for (const type of INCIDENT_TYPES) {
      const label = incidentLabel(type)
      expect(label).toBeTruthy()
      expect(label.length).toBeGreaterThan(0)
    }
  })

  it('incidentLabel returns formatted fallback for unknown type', () => {
    expect(incidentLabel('some_new_type')).toBe('some new type')
  })

  it('incidentLabel returns correct labels for key types', () => {
    expect(incidentLabel('fire')).toBe('Fire')
    expect(incidentLabel('flood')).toBe('Flood')
    expect(incidentLabel('power_outage')).toBe('Power Outage')
    expect(incidentLabel('storm_surge')).toBe('Storm Surge')
  })
})

describe('statusMeta', () => {
  it('returns Sending… for queued', () => {
    expect(statusMeta('queued').label).toBe('Sending…')
  })

  it('returns Sending… for draft_inbox', () => {
    expect(statusMeta('draft_inbox').label).toBe('Sending…')
  })

  it('returns Received for new', () => {
    expect(statusMeta('new').label).toBe('Received')
  })

  it('returns Under review for awaiting_verify', () => {
    expect(statusMeta('awaiting_verify').label).toBe('Under review')
  })

  it('returns Verified for verified', () => {
    expect(statusMeta('verified').label).toBe('Verified')
  })

  it('returns Help on the way for assigned', () => {
    expect(statusMeta('assigned').label).toBe('Help on the way')
  })

  it('returns Help on the way for acknowledged', () => {
    expect(statusMeta('acknowledged').label).toBe('Help on the way')
  })

  it('returns Responder en route for en_route', () => {
    expect(statusMeta('en_route').label).toBe('Responder en route')
  })

  it('returns On scene for on_scene', () => {
    expect(statusMeta('on_scene').label).toBe('On scene')
  })

  it('returns Resolved for resolved', () => {
    expect(statusMeta('resolved').label).toBe('Resolved')
  })

  it('returns Resolved for closed', () => {
    expect(statusMeta('closed').label).toBe('Resolved')
  })

  it('returns Re-opened for reopened', () => {
    expect(statusMeta('reopened').label).toBe('Re-opened')
  })

  it('returns Not accepted for rejected', () => {
    expect(statusMeta('rejected').label).toBe('Not accepted')
    expect(statusMeta('rejected').bg).toBe('bg-danger-400/20')
    expect(statusMeta('rejected').color).toBe('text-danger-500')
  })

  it('returns Cancelled for cancelled', () => {
    expect(statusMeta('cancelled').label).toBe('Cancelled')
  })

  it('returns Cancelled for cancelled_false_report', () => {
    expect(statusMeta('cancelled_false_report').label).toBe('Cancelled')
  })

  it('returns Merged for merged_as_duplicate', () => {
    expect(statusMeta('merged_as_duplicate').label).toBe('Merged')
  })

  it('returns formatted fallback for unknown status', () => {
    const result = statusMeta('some_new_status')
    expect(result.label).toBe('some new status')
    expect(result.bg).toBe('bg-surface-200')
    expect(result.color).toBe('text-surface-600')
  })

  it('returns success styles for assigned', () => {
    expect(statusMeta('assigned').bg).toBe('bg-success-400/20')
    expect(statusMeta('assigned').color).toBe('text-success-500')
  })
})

describe('severityDotColor', () => {
  it('returns red for high severity', () => {
    expect(severityDotColor('high')).toBe('#dc2626')
  })

  it('returns amber for medium severity', () => {
    expect(severityDotColor('medium')).toBe('#d97706')
  })

  it('returns slate for low severity', () => {
    expect(severityDotColor('low')).toBe('#334155')
  })

  it('returns slate default for unknown severity', () => {
    expect(severityDotColor('unknown')).toBe('#334155')
  })
})
