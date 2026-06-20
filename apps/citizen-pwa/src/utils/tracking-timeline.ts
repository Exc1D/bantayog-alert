import type { MyReport } from '../components/MapTab/types.js'

export const TRACKING_STAGE_IDS = [
  'saved',
  'received',
  'being_reviewed',
  'response_coordinated',
  'addressed',
] as const

export type TrackingStageId = (typeof TRACKING_STAGE_IDS)[number] | 'not_accepted'
export type TrackingStageState = 'reached' | 'current' | 'upcoming'

export interface TrackingStage {
  id: TrackingStageId
  state: TrackingStageState
  detail?: string
}

export interface TrackingNarrativeEvent {
  at: number
  detail: string
  title: string
}

export interface TrackingTimeline {
  currentStage: TrackingStageId
  events: TrackingNarrativeEvent[]
  explanation: string
  fineStatus: string
  headline: string
  nextStep: string
  stages: TrackingStage[]
}

interface StatusConfig {
  currentStage: TrackingStageId
  explanation: string
  fineStatus: string
  headline: string
  nextStep: string
  reachedStages: readonly TrackingStageId[]
}

const DEFAULT_CONFIG: StatusConfig = {
  currentStage: 'received',
  explanation: 'The latest detailed status is unavailable. Your tracking code is still valid.',
  fineStatus: 'Status unavailable',
  headline: 'Your report was received',
  nextStep: 'Keep this page available and check again for a confirmed update.',
  reachedStages: ['saved'],
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
  queued: {
    currentStage: 'saved',
    explanation: 'It will send automatically when you are back online.',
    fineStatus: 'Saved offline',
    headline: 'Saved on this phone',
    nextStep: 'Keep this device available so the report can retry.',
    reachedStages: [],
  },
  draft_inbox: {
    currentStage: 'saved',
    explanation: 'It will send automatically when you are back online.',
    fineStatus: 'Saved offline',
    headline: 'Saved on this phone',
    nextStep: 'Keep this device available so the report can retry.',
    reachedStages: [],
  },
  new: {
    currentStage: 'received',
    explanation: 'Your report reached the response system.',
    fineStatus: 'Received',
    headline: 'Your report was received',
    nextStep: 'Watch this page for verification and responder updates.',
    reachedStages: ['saved'],
  },
  awaiting_verify: {
    currentStage: 'being_reviewed',
    explanation:
      'An operator is checking the details. You do not need to submit again unless the situation changes.',
    fineStatus: 'Awaiting verification',
    headline: 'Your report was received',
    nextStep: 'Watch this page for verification and responder updates.',
    reachedStages: ['saved', 'received'],
  },
  verified: {
    currentStage: 'being_reviewed',
    explanation: 'It is now being handled.',
    fineStatus: 'Verified',
    headline: 'Your report was verified',
    nextStep: 'Watch this page for responder updates.',
    reachedStages: ['saved', 'received'],
  },
  reopened: {
    currentStage: 'being_reviewed',
    explanation: 'Operators reopened the report to check new information.',
    fineStatus: 'Review reopened',
    headline: 'Your report is under review again',
    nextStep: 'Watch this page for the next status update.',
    reachedStages: ['saved', 'received'],
  },
  assigned: {
    currentStage: 'response_coordinated',
    explanation: 'Please stay safe and avoid the affected area.',
    fineStatus: 'Responder assigned',
    headline: 'A responder has been assigned',
    nextStep: 'Call responders only if the danger changes or people need urgent help.',
    reachedStages: ['saved', 'received', 'being_reviewed'],
  },
  acknowledged: {
    currentStage: 'response_coordinated',
    explanation: 'Please stay safe and avoid the affected area.',
    fineStatus: 'Assignment acknowledged',
    headline: 'A responder has been assigned',
    nextStep: 'Call responders only if the danger changes or people need urgent help.',
    reachedStages: ['saved', 'received', 'being_reviewed'],
  },
  en_route: {
    currentStage: 'response_coordinated',
    explanation: 'Please stay safe and avoid the affected area.',
    fineStatus: 'Responder en route',
    headline: 'Help is on the way',
    nextStep: 'Keep this tracking code available for follow-up.',
    reachedStages: ['saved', 'received', 'being_reviewed'],
  },
  on_scene: {
    currentStage: 'response_coordinated',
    explanation: 'Emergency staff are checking the situation on scene.',
    fineStatus: 'Responder on scene',
    headline: 'Responders are at or near the area',
    nextStep: 'Stay clear of the affected area unless responders ask for information.',
    reachedStages: ['saved', 'received', 'being_reviewed'],
  },
  resolved: {
    currentStage: 'addressed',
    explanation: 'The response loop for this report is complete.',
    fineStatus: 'Resolved',
    headline: 'This report was resolved',
    nextStep: 'Your report helped complete the response loop.',
    reachedStages: ['saved', 'received', 'being_reviewed', 'response_coordinated'],
  },
  closed: {
    currentStage: 'addressed',
    explanation: 'The response loop for this report is complete.',
    fineStatus: 'Closed',
    headline: 'This report was resolved',
    nextStep: 'Your report helped complete the response loop.',
    reachedStages: ['saved', 'received', 'being_reviewed', 'response_coordinated'],
  },
  rejected: {
    currentStage: 'not_accepted',
    explanation: 'The review did not confirm enough details to keep it active.',
    fineStatus: 'Not accepted',
    headline: 'This report could not be verified',
    nextStep: 'Submit a new report only if the situation changes or you have clearer details.',
    reachedStages: ['saved', 'received', 'being_reviewed'],
  },
  cancelled: {
    currentStage: 'addressed',
    explanation: 'It is no longer active, and the audit record is kept.',
    fineStatus: 'Withdrawn',
    headline: 'Your report was withdrawn',
    nextStep: 'Submit a new report only if there is a new or changing emergency.',
    reachedStages: ['saved', 'received'],
  },
  cancelled_false_report: {
    currentStage: 'addressed',
    explanation: 'It is no longer active, and the audit record is kept.',
    fineStatus: 'Withdrawn',
    headline: 'Your report was withdrawn',
    nextStep: 'Submit a new report only if there is a new or changing emergency.',
    reachedStages: ['saved', 'received'],
  },
  merged_as_duplicate: {
    currentStage: 'addressed',
    explanation: 'Operators found another report for the same incident.',
    fineStatus: 'Merged with another report',
    headline: 'This report was merged with another report',
    nextStep: 'The response continues through the main incident record.',
    reachedStages: ['saved', 'received', 'being_reviewed'],
  },
}

function buildStages(config: StatusConfig): TrackingStage[] {
  const stageIds: readonly TrackingStageId[] =
    config.currentStage === 'not_accepted'
      ? ['saved', 'received', 'being_reviewed', 'not_accepted']
      : TRACKING_STAGE_IDS
  const reached = new Set(config.reachedStages)

  return stageIds.map((id) => {
    if (id === config.currentStage) {
      return { id, state: 'current', detail: config.fineStatus }
    }
    return { id, state: reached.has(id) ? 'reached' : 'upcoming' }
  })
}

function buildEvents(report: MyReport, config: StatusConfig): TrackingNarrativeEvent[] {
  const isSaved = config.currentStage === 'saved'
  const events: TrackingNarrativeEvent[] = [
    {
      at: report.submittedAt,
      detail: isSaved
        ? 'Stored safely on this device. Automatic retry is enabled.'
        : 'The response system recorded this report.',
      title: isSaved ? 'Saved on this phone' : 'Report received',
    },
  ]

  if (report.lastStatusAt && report.lastStatusAt > report.submittedAt) {
    events.push({
      at: report.lastStatusAt,
      detail: config.explanation,
      title: config.headline,
    })
  }

  return events
}

export function buildTrackingTimeline(report: MyReport): TrackingTimeline {
  const config = STATUS_CONFIG[report.status] ?? DEFAULT_CONFIG
  return {
    currentStage: config.currentStage,
    events: buildEvents(report, config),
    explanation: config.explanation,
    fineStatus: config.fineStatus,
    headline: config.headline,
    nextStep: config.nextStep,
    stages: buildStages(config),
  }
}
