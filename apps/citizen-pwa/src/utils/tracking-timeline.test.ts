import { describe, expect, it } from 'vitest'
import type { MyReport } from '../components/MapTab/types.js'
import { buildTrackingTimeline } from './tracking-timeline.js'

const baseReport = {
  publicRef: 'BNTY-1234',
  reportType: 'flood',
  severity: 'high',
  lat: 14.11,
  lng: 122.95,
  submittedAt: 1_713_350_000_000,
  municipalityLabel: 'Daet',
} satisfies Omit<MyReport, 'status'>

describe('buildTrackingTimeline', () => {
  it.each([
    ['queued', 'saved', []],
    ['draft_inbox', 'saved', []],
    ['new', 'received', ['saved']],
    ['awaiting_verify', 'being_reviewed', ['saved', 'received']],
    ['verified', 'being_reviewed', ['saved', 'received']],
    ['reopened', 'being_reviewed', ['saved', 'received']],
    ['assigned', 'response_coordinated', ['saved', 'received', 'being_reviewed']],
    ['acknowledged', 'response_coordinated', ['saved', 'received', 'being_reviewed']],
    ['en_route', 'response_coordinated', ['saved', 'received', 'being_reviewed']],
    ['on_scene', 'response_coordinated', ['saved', 'received', 'being_reviewed']],
    ['resolved', 'addressed', ['saved', 'received', 'being_reviewed', 'response_coordinated']],
    ['closed', 'addressed', ['saved', 'received', 'being_reviewed', 'response_coordinated']],
    ['cancelled', 'addressed', ['saved', 'received']],
    ['cancelled_false_report', 'addressed', ['saved', 'received']],
    ['merged_as_duplicate', 'addressed', ['saved', 'received', 'being_reviewed']],
  ] as const)(
    'maps %s to %s without marking a later stage reached',
    (status, currentStage, reachedStages) => {
      const timeline = buildTrackingTimeline({ ...baseReport, status })

      expect(timeline.currentStage).toBe(currentStage)
      expect(
        timeline.stages.filter((stage) => stage.state === 'reached').map((stage) => stage.id),
      ).toEqual(reachedStages)

      const currentIndex = timeline.stages.findIndex((stage) => stage.state === 'current')
      expect(currentIndex).toBeGreaterThanOrEqual(0)
      expect(
        timeline.stages.slice(currentIndex + 1).every((stage) => stage.state === 'upcoming'),
      ).toBe(true)
    },
  )

  it('renders rejection as a terminal not-accepted path without responder progress', () => {
    const timeline = buildTrackingTimeline({ ...baseReport, status: 'rejected' })

    expect(timeline.currentStage).toBe('not_accepted')
    expect(timeline.stages.map((stage) => stage.id)).toEqual([
      'saved',
      'received',
      'being_reviewed',
      'not_accepted',
    ])
    expect(timeline.stages.find((stage) => stage.id === 'not_accepted')?.state).toBe('current')
    expect(timeline.stages.some((stage) => stage.id === 'response_coordinated')).toBe(false)
  })

  it('falls back conservatively for an unknown status without throwing', () => {
    const timeline = buildTrackingTimeline({
      ...baseReport,
      status: 'garbage-status' as MyReport['status'],
    })

    expect(timeline.currentStage).toBe('received')
    expect(timeline.fineStatus).toBe('Status unavailable')
    expect(timeline.stages.find((stage) => stage.id === 'being_reviewed')?.state).toBe('upcoming')
  })

  it('does not invent dated transition events when no transition timestamp exists', () => {
    const withoutTransition = buildTrackingTimeline({ ...baseReport, status: 'en_route' })
    const withTransition = buildTrackingTimeline({
      ...baseReport,
      status: 'en_route',
      lastStatusAt: baseReport.submittedAt + 60_000,
    })

    expect(withoutTransition.events).toHaveLength(1)
    expect(withTransition.events).toHaveLength(2)
    expect(withTransition.events[1]).toMatchObject({
      at: baseReport.submittedAt + 60_000,
      title: 'Help is on the way',
    })
  })
})
