import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useDispatch } from '../hooks/useDispatch'
import { useReport } from '../hooks/useReport'
import { useAcceptDispatch } from '../hooks/useAcceptDispatch'
import { useAdvanceDispatch } from '../hooks/useAdvanceDispatch'
import { useDeclineDispatch } from '../hooks/useDeclineDispatch'
import { useMarkDispatchUnableToComplete } from '../hooks/useMarkDispatchUnableToComplete'
import { useAddFieldNote } from '../hooks/useAddFieldNote'
import { useFieldNoteDraft } from '../hooks/useFieldNoteDraft'
import { CancelledScreen } from './CancelledScreen'
import { RaceLossScreen } from './RaceLossScreen'
import { PreArrivalInfo } from './PreArrivalInfo'
import { getReportTypeLabel } from '../lib/incident-labels'
import { getDispatchProgress, getStepValue } from '../lib/dispatch-progress'
import { DispatchRing } from '../components/DispatchRing'
import styles from './DispatchDetailPage.module.css'

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

const DECLINE_REASONS = [
  'Already on another assignment',
  'Unable to respond — not available',
  'Too far away',
  'Not my specialization',
  'Vehicle / equipment issue',
  'Safety concern (hazardous conditions)',
]

const UNABLE_REASONS = [
  'Safety — scene conditions changed',
  'Medical — responder health issue',
  'Equipment failure',
  'Jurisdiction conflict',
]

const TIMELINE_STEPS = ['Accepted', 'Acknowledged', 'En Route', 'On Scene', 'Resolved'] as const

function getFirebaseErrorCode(error: Error | undefined): string {
  if (!error || !('code' in error)) return ''
  const code = (error as { code?: unknown }).code
  return typeof code === 'string' ? code : ''
}

function getActionErrorMessage(error: Error | undefined): string | null {
  if (!error) return null
  const code = getFirebaseErrorCode(error)
  if (code === 'functions/permission-denied') return 'This dispatch is no longer available.'
  if (code === 'functions/already-exists') return 'Another responder already claimed this dispatch.'
  if (code === 'functions/failed-precondition')
    return 'This action is no longer allowed from the current state.'
  if (error.message === 'auth_required') return 'You must be signed in.'
  if (error.message === 'resolutionSummary_required') return 'A resolution summary is required.'
  if (error.message === 'reason_required') return 'A reason is required.'
  return 'Something went wrong. Please retry.'
}

function statusLabel(uiStatus: string | undefined, fallback: string): string {
  if (uiStatus === 'heading_to_scene') return 'En Route'
  if (uiStatus === 'on_scene') return 'On Scene'
  return uiStatus ?? fallback
}

type DispatchRecord = NonNullable<ReturnType<typeof useDispatch>['dispatch']>
type ReportRecord = NonNullable<ReturnType<typeof useReport>['report']>
type FieldNoteDraftState = ReturnType<typeof useFieldNoteDraft>
type AdvanceDispatch = ReturnType<typeof useAdvanceDispatch>['advance']
type AddFieldNote = ReturnType<typeof useAddFieldNote>['addNote']
type RefreshDispatch = ReturnType<typeof useDispatch>['refresh']

function isActiveStatus(status: DispatchRecord['status']): boolean {
  return ['accepted', 'acknowledged', 'en_route', 'on_scene'].includes(status)
}

function shouldShowPreArrival(status: DispatchRecord['status'] | undefined): boolean {
  return status === 'acknowledged' || status === 'en_route'
}

function DispatchHeader({
  title,
  isActive = false,
  dispatchId,
  onBack,
}: {
  title: string
  isActive?: boolean
  dispatchId?: string | undefined
  onBack: () => void
}) {
  return (
    <div className={styles.pageHeader}>
      <button className={styles.backBtn} onClick={onBack} aria-label="Back">
        ←
      </button>
      <h1 className={styles.pageTitle}>{title}</h1>
      {isActive && dispatchId !== undefined && (
        <Link to={`/dispatches/${dispatchId}/sos`} className={styles.pageHeaderSos}>
          SOS
        </Link>
      )}
    </div>
  )
}

function LoadingState({ onBack }: { onBack: () => void }) {
  return (
    <div className={styles.page}>
      <DispatchHeader title="Loading…" onBack={onBack} />
    </div>
  )
}

function MessageState({ message, isError = false }: { message: string; isError?: boolean }) {
  return (
    <div className={styles.page}>
      <div className={styles.body}>
        <p className={isError ? styles.errorMsg : undefined}>{message}</p>
      </div>
    </div>
  )
}

function IncidentSummaryCard({
  report,
  reportId,
  reportTypeLabelText,
  severityClass,
}: {
  report: ReportRecord
  reportId: string
  reportTypeLabelText: string
  severityClass?: string | undefined
}) {
  return (
    <div className={styles.incidentCard}>
      <h2 className={styles.incidentTitle}>
        {reportTypeLabelText}
        <span className={[styles.severityBadge, severityClass].filter(Boolean).join(' ')}>
          {report.severity}
        </span>
      </h2>
      <div className={styles.incidentMeta}>
        <span>
          {report.municipalityLabel ?? report.municipalityId}
          {report.barangayId !== undefined ? ` · ${report.barangayId}` : ''}
        </span>
        <span>Report #{reportId.slice(0, 8)}</span>
      </div>
      {report.description !== '' && <p className={styles.incidentDesc}>{report.description}</p>}
    </div>
  )
}

function getDispatchTitle(report: ReportRecord | null | undefined): string {
  return report ? getReportTypeLabel(report.reportType) : 'Dispatch'
}

function getSeverityClass(severity: ReportRecord['severity'] | undefined): string | undefined {
  if (severity === 'high') return styles.sevHigh
  if (severity === 'medium') return styles.sevMedium
  return styles.sevLow
}

function getMapsUrl(publicLocation: ReportRecord['publicLocation'] | undefined): string | null {
  if (!publicLocation) return null
  return `https://maps.google.com/?q=${String(publicLocation.latitude)},${String(publicLocation.longitude)}`
}

function getTerminalDispatchSurface(
  dispatch: DispatchRecord | null | undefined,
  acceptError: Error | undefined,
) {
  if (dispatch?.terminalSurface === 'cancelled') return <CancelledScreen dispatch={dispatch} />
  if (
    dispatch?.terminalSurface === 'race_loss' ||
    getFirebaseErrorCode(acceptError) === 'functions/already-exists'
  ) {
    return <RaceLossScreen />
  }
  return null
}

function MaybeIncidentSummary({
  report,
  reportId,
}: {
  report: ReportRecord | null | undefined
  reportId: string
}) {
  if (!report) return null

  return (
    <IncidentSummaryCard
      report={report}
      reportId={reportId}
      reportTypeLabelText={getReportTypeLabel(report.reportType)}
      severityClass={getSeverityClass(report.severity)}
    />
  )
}

function ProgressCard({
  status,
  step,
  progress,
}: {
  status: DispatchRecord['status']
  step: ReturnType<typeof getStepValue>
  progress: number
}) {
  const isPendingTimeline = status === 'pending'

  return (
    <div
      className={styles.progressCard}
      role="progressbar"
      aria-label="Dispatch progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress}
      aria-valuetext={step.text}
    >
      <DispatchRing
        mode="progress"
        percent={progress}
        tone={status === 'resolved' ? 'success' : 'accent'}
        ariaLabel={`Dispatch progress ${String(progress)} percent`}
      >
        <span className={styles.progressPercent}>{String(progress)}%</span>
        <span className={styles.progressLabel}>{step.text}</span>
      </DispatchRing>
      <div className={styles.progressSteps} aria-hidden="true">
        {TIMELINE_STEPS.map((label, index) => (
          <span
            key={label}
            className={[
              styles.progressStep,
              index < step.value ? styles.progressStepDone : '',
              !isPendingTimeline && index === step.value ? styles.progressStepCurrent : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {label}
          </span>
        ))}
      </div>
      <span className={styles.onboardingHint}>
        Next step: tap the action button below to advance.
      </span>
    </div>
  )
}

function NavigateSection({ mapsUrl }: { mapsUrl: string }) {
  return (
    <div className={styles.navigateSection}>
      <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className={styles.navigateBtn}>
        🗺️ Navigate to Scene
      </a>
      <p className={styles.onboardingHint}>
        Enable location access to calculate live distance. Navigate to Scene still works if location
        is off.
      </p>
    </div>
  )
}

function MaybeNavigateSection({
  isActive,
  mapsUrl,
}: {
  isActive: boolean
  mapsUrl: string | null
}) {
  if (!isActive || mapsUrl === null) return null
  return <NavigateSection mapsUrl={mapsUrl} />
}

function MaybePreArrivalInfo({
  isActive,
  status,
  report,
  distanceMeters,
}: {
  isActive: boolean
  status: DispatchRecord['status']
  report: ReportRecord | null | undefined
  distanceMeters: number | null
}) {
  if (!isActive || !shouldShowPreArrival(status) || !report) return null
  return <PreArrivalInfo reportType={report.reportType} distanceMeters={distanceMeters} />
}

function PendingDispatchActions({
  accepting,
  declining,
  showDecline,
  declineReason,
  acceptError,
  declineError,
  onAccept,
  onToggleDecline,
  onDeclineReasonChange,
  onConfirmDecline,
  onCancelDecline,
}: {
  accepting: boolean
  declining: boolean
  showDecline: boolean
  declineReason: string
  acceptError?: Error | undefined
  declineError?: Error | undefined
  onAccept: () => void
  onToggleDecline: () => void
  onDeclineReasonChange: (reason: string) => void
  onConfirmDecline: () => void
  onCancelDecline: () => void
}) {
  return (
    <div className={styles.statusSection}>
      <p className={styles.statusTitle}>Action Required</p>
      <div className={styles.quickToggles}>
        <button
          className={[styles.toggleBtn, styles.togglePrimary].filter(Boolean).join(' ')}
          onClick={onAccept}
          disabled={accepting}
        >
          {accepting ? 'Accepting…' : '✓ Accept'}
        </button>
        <button className={styles.toggleBtn} onClick={onToggleDecline}>
          ✕ Decline
        </button>
      </div>
      {showDecline && (
        <div className={styles.selectMargin}>
          <select
            value={declineReason}
            onChange={(e) => {
              onDeclineReasonChange(e.target.value)
            }}
            className={styles.select}
            aria-label="Decline reason"
          >
            <option value="">Select reason…</option>
            {DECLINE_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button
            className={[styles.dangerBtn, styles.dangerBtnSpaced].filter(Boolean).join(' ')}
            onClick={onConfirmDecline}
            disabled={!declineReason || declining}
          >
            {declining ? 'Declining…' : 'Confirm Decline'}
          </button>
          <button type="button" className={styles.secondaryBtn} onClick={onCancelDecline}>
            Cancel
          </button>
        </div>
      )}
      {acceptError && <p className={styles.errorMsg}>{getActionErrorMessage(acceptError)}</p>}
      {declineError && <p className={styles.errorMsg}>{getActionErrorMessage(declineError)}</p>}
    </div>
  )
}

function MaybePendingDispatchActions({
  status,
  ...props
}: {
  status: DispatchRecord['status']
} & Parameters<typeof PendingDispatchActions>[0]) {
  if (status !== 'pending') return null
  return <PendingDispatchActions {...props} />
}

function MaybeAutoAdvancePill({
  autoAdvanceState,
}: {
  autoAdvanceState: 'idle' | 'pending' | 'done'
}) {
  if (autoAdvanceState === 'idle') return null

  return (
    <p role="status" className={styles.autoAdvancePill ?? ''}>
      {autoAdvanceState === 'pending' ? 'Acknowledging dispatch…' : 'Acknowledged'}
    </p>
  )
}

function MaybeRetryAcknowledgement({
  status,
  advanceError,
  advanceLoading,
  onRetryAcknowledgement,
}: {
  status: DispatchRecord['status']
  advanceError?: Error | undefined
  advanceLoading: boolean
  onRetryAcknowledgement: () => void
}) {
  if (status !== 'accepted' || !advanceError || advanceLoading) return null

  return (
    <button
      className={[styles.toggleBtn, styles.togglePrimary].filter(Boolean).join(' ')}
      onClick={onRetryAcknowledgement}
    >
      Retry acknowledgement
    </button>
  )
}

function MaybeAdvanceButton({
  status,
  expectedStatus,
  label,
  disabled,
  onClick,
}: {
  status: DispatchRecord['status']
  expectedStatus: DispatchRecord['status']
  label: string
  disabled: boolean
  onClick: () => void
}) {
  if (status !== expectedStatus) return null

  return (
    <div className={styles.quickToggles}>
      <button
        className={[styles.toggleBtn, styles.togglePrimary].filter(Boolean).join(' ')}
        onClick={onClick}
        disabled={disabled}
      >
        {label}
      </button>
    </div>
  )
}

function MaybeResolutionForm({
  status,
  resolutionSummary,
  advanceLoading,
  onResolutionSummaryChange,
  onResolve,
}: {
  status: DispatchRecord['status']
  resolutionSummary: string
  advanceLoading: boolean
  onResolutionSummaryChange: (summary: string) => void
  onResolve: () => void
}) {
  if (status !== 'on_scene') return null

  return (
    <div className={styles.resolutionForm}>
      <label htmlFor="resolution-summary" className={styles.fieldLabel}>
        Resolution Summary
      </label>
      <textarea
        id="resolution-summary"
        className={styles.textarea}
        value={resolutionSummary}
        maxLength={2000}
        onChange={(e) => {
          onResolutionSummaryChange(e.target.value)
        }}
        placeholder="Resolution summary (required)"
        rows={3}
      />
      <span className={styles.charCount}>{resolutionSummary.length}/2000</span>
      <button
        className={[styles.toggleBtn, styles.togglePrimary].filter(Boolean).join(' ')}
        onClick={onResolve}
        disabled={!resolutionSummary.trim() || advanceLoading}
      >
        ✅ Mark Resolved
      </button>
    </div>
  )
}

function ActiveDispatchStatus({
  dispatch,
  dispatchId,
  autoAdvanceState,
  advanceLoading,
  advanceError,
  resolutionSummary,
  onResolutionSummaryChange,
  onRetryAcknowledgement,
  onAdvanceEnRoute,
  onAdvanceOnScene,
  onResolve,
}: {
  dispatch: DispatchRecord
  dispatchId: string
  autoAdvanceState: 'idle' | 'pending' | 'done'
  advanceLoading: boolean
  advanceError?: Error | undefined
  resolutionSummary: string
  onResolutionSummaryChange: (summary: string) => void
  onRetryAcknowledgement: () => void
  onAdvanceEnRoute: () => void
  onAdvanceOnScene: () => void
  onResolve: () => void
}) {
  return (
    <div className={styles.statusSection} data-testid={`dispatch-status-${dispatchId}`}>
      <p className={styles.statusTitle}>
        Status: {statusLabel(dispatch.uiStatus, dispatch.status)}
      </p>
      <MaybeAutoAdvancePill autoAdvanceState={autoAdvanceState} />
      <MaybeRetryAcknowledgement
        status={dispatch.status}
        advanceError={advanceError}
        advanceLoading={advanceLoading}
        onRetryAcknowledgement={onRetryAcknowledgement}
      />
      <MaybeAdvanceButton
        status={dispatch.status}
        expectedStatus="acknowledged"
        label="📍 En Route"
        disabled={advanceLoading}
        onClick={onAdvanceEnRoute}
      />
      <MaybeAdvanceButton
        status={dispatch.status}
        expectedStatus="en_route"
        label="🔧 On Scene"
        disabled={advanceLoading}
        onClick={onAdvanceOnScene}
      />
      <MaybeResolutionForm
        status={dispatch.status}
        resolutionSummary={resolutionSummary}
        advanceLoading={advanceLoading}
        onResolutionSummaryChange={onResolutionSummaryChange}
        onResolve={onResolve}
      />
      {advanceError && <p className={styles.errorMsg}>{getActionErrorMessage(advanceError)}</p>}
    </div>
  )
}

function MaybeActiveDispatchStatus({
  isActive,
  dispatchId,
  dispatch,
  ...props
}: {
  isActive: boolean
  dispatchId?: string | undefined
  dispatch: DispatchRecord
} & Omit<Parameters<typeof ActiveDispatchStatus>[0], 'dispatch' | 'dispatchId'>) {
  if (!isActive || dispatchId === undefined || dispatch.status === 'pending') return null
  return <ActiveDispatchStatus dispatch={dispatch} dispatchId={dispatchId} {...props} />
}

function ActiveDispatchActions({
  dispatchId,
  contactPhone,
  showUnable,
  unableReason,
  markingUnable,
  unableError,
  onShowUnable,
  onUnableReasonChange,
  onSubmitUnable,
}: {
  dispatchId?: string | undefined
  contactPhone?: string | undefined
  showUnable: boolean
  unableReason: string
  markingUnable: boolean
  unableError?: Error | undefined
  onShowUnable: () => void
  onUnableReasonChange: (reason: string) => void
  onSubmitUnable: () => void
}) {
  return (
    <div className={styles.statusSection}>
      <p className={styles.statusTitle}>Actions</p>
      <div className={styles.actionStack}>
        {dispatchId !== undefined && (
          <Link to={`/dispatches/${dispatchId}/backup`} className={styles.navBtn}>
            🆘 Request Backup
          </Link>
        )}
        {contactPhone ? (
          <a href={`tel:${contactPhone}`} className={styles.navBtn}>
            📞 Call Admin
          </a>
        ) : (
          <button
            type="button"
            className={styles.navBtn}
            disabled
            title="Admin phone not available"
          >
            📞 Call Admin
          </button>
        )}
        {dispatchId !== undefined && (
          <Link to={`/dispatches/${dispatchId}/witness-report`} className={styles.navBtn}>
            📋 File Witness Report
          </Link>
        )}
        {!showUnable ? (
          <button className={styles.dangerBtn} onClick={onShowUnable}>
            Unable to Complete
          </button>
        ) : (
          <div>
            <select
              value={unableReason}
              onChange={(e) => {
                onUnableReasonChange(e.target.value)
              }}
              className={styles.select}
              aria-label="Unable-to-complete reason"
            >
              <option value="">Select reason…</option>
              {UNABLE_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <button
              className={[styles.dangerBtn, styles.dangerBtnSpaced].filter(Boolean).join(' ')}
              onClick={onSubmitUnable}
              disabled={!unableReason || markingUnable}
            >
              {markingUnable ? 'Submitting…' : 'Submit — No Penalty'}
            </button>
            {unableError && <p className={styles.errorMsg}>{getActionErrorMessage(unableError)}</p>}
          </div>
        )}
      </div>
    </div>
  )
}

function MaybeActiveDispatchActions({
  isActive,
  ...props
}: {
  isActive: boolean
} & Parameters<typeof ActiveDispatchActions>[0]) {
  if (!isActive) return null
  return <ActiveDispatchActions {...props} />
}

function FieldNoteForm({
  draft,
  addingNote,
  onSubmit,
}: {
  draft: FieldNoteDraftState
  addingNote: boolean
  onSubmit: () => void
}) {
  return (
    <div className={styles.statusSection}>
      <p className={styles.statusTitle}>Add Field Note</p>
      <div className={styles.fieldNoteForm}>
        <label htmlFor="field-notes" className={styles.fieldLabel}>
          Field Notes
        </label>
        <textarea
          id="field-notes"
          className={styles.noteInput}
          value={draft.value}
          maxLength={2000}
          disabled={!draft.loaded}
          onChange={(e) => {
            draft.setValue(e.target.value)
          }}
          placeholder="On scene. Water is waist-deep…"
          rows={2}
        />
        <span className={styles.charCount}>{draft.value.length}/2000</span>
        <button
          className={styles.noteSubmitBtn}
          disabled={!draft.loaded || !draft.value.trim() || addingNote}
          onClick={onSubmit}
        >
          {addingNote ? 'Saving…' : 'Add Note'}
        </button>
      </div>
    </div>
  )
}

function MaybeFieldNoteForm({
  isActive,
  ...props
}: {
  isActive: boolean
} & Parameters<typeof FieldNoteForm>[0]) {
  if (!isActive) return null
  return <FieldNoteForm {...props} />
}

async function submitFieldNote(
  value: string,
  addNote: AddFieldNote,
  clearDraft: FieldNoteDraftState['clear'],
) {
  try {
    await addNote(value)
  } catch (err: unknown) {
    console.error('[DispatchDetailPage] addNote failed:', err)
    return
  }

  try {
    await clearDraft()
  } catch (err: unknown) {
    console.error('[DispatchDetailPage] clearing field-note draft failed:', err)
  }
}

function useAutoAcknowledgement(
  status: DispatchRecord['status'] | undefined,
  advance: AdvanceDispatch,
) {
  const [autoAdvanceState, setAutoAdvanceState] = useState<'idle' | 'pending' | 'done'>('idle')

  useEffect(() => {
    if (status !== 'accepted') return
    // Sync state set is intentional: the pill must render in the same paint
    // as the status flip to give the user immediate feedback.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAutoAdvanceState('pending')
    let cleared = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    advance('acknowledged').then(
      () => {
        if (cleared) return
        setAutoAdvanceState('done')
        timeoutId = setTimeout(() => {
          setAutoAdvanceState('idle')
        }, 2000)
      },
      () => {
        if (!cleared) setAutoAdvanceState('idle')
      },
    )
    return () => {
      cleared = true
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [status, advance])

  return autoAdvanceState
}

function useSceneDistance(
  status: DispatchRecord['status'] | undefined,
  publicLocation: ReportRecord['publicLocation'] | undefined,
) {
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null)

  useEffect(() => {
    if (!shouldShowPreArrival(status)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDistanceMeters(null)
      return
    }
    if (!publicLocation) {
      setDistanceMeters(null)
      return
    }

    const handleSuccess = (pos: GeolocationPosition) => {
      const dist = haversine(
        pos.coords.latitude,
        pos.coords.longitude,
        publicLocation.latitude,
        publicLocation.longitude,
      )
      setDistanceMeters(Math.round(dist))
    }

    const handleError = (err: GeolocationPositionError) => {
      console.warn('[DispatchDetailPage] geolocation unavailable:', err.code, err.message)
      setDistanceMeters(null)
    }

    // Geolocation may be unavailable in insecure contexts or some environments.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(handleSuccess, handleError)
    } else {
      setDistanceMeters(null)
    }
  }, [status, publicLocation])

  return distanceMeters
}

function useRefreshOnActionError(
  acceptError: Error | undefined,
  declineError: Error | undefined,
  advanceError: Error | undefined,
  unableError: Error | undefined,
  refresh: RefreshDispatch,
) {
  useEffect(() => {
    if (acceptError ?? declineError ?? advanceError ?? unableError) {
      void refresh()
    }
  }, [acceptError, declineError, advanceError, unableError, refresh])
}

export function DispatchDetailPage() {
  const { dispatchId } = useParams<{ dispatchId: string }>()
  const navigate = useNavigate()
  const { dispatch, loading, error, refresh } = useDispatch(dispatchId)
  const { report } = useReport(dispatch?.reportId)

  const { accept, loading: accepting, error: acceptError } = useAcceptDispatch(dispatchId ?? '')
  const { decline, loading: declining, error: declineError } = useDeclineDispatch(dispatchId ?? '')
  const {
    advance,
    loading: advanceLoading,
    error: advanceError,
  } = useAdvanceDispatch(dispatchId ?? '')
  const {
    markUnableToComplete,
    loading: markingUnable,
    error: unableError,
  } = useMarkDispatchUnableToComplete(dispatchId ?? '')
  const { addNote, loading: addingNote } = useAddFieldNote(dispatch?.reportId ?? '')

  const [showDecline, setShowDecline] = useState(false)
  const [declineReason, setDeclineReason] = useState('')
  const [showUnable, setShowUnable] = useState(false)
  const [unableReason, setUnableReason] = useState('')
  const [resolutionSummary, setResolutionSummary] = useState('')
  const fieldNoteDraft = useFieldNoteDraft(dispatchId)
  const autoAdvanceState = useAutoAcknowledgement(dispatch?.status, advance)
  const distanceMeters = useSceneDistance(dispatch?.status, report?.publicLocation)

  useRefreshOnActionError(acceptError, declineError, advanceError, unableError, refresh)

  if (loading) {
    return <LoadingState onBack={() => void navigate('/')} />
  }

  const terminalSurface = getTerminalDispatchSurface(dispatch, acceptError)
  if (terminalSurface) return terminalSurface
  if (error) {
    return <MessageState message={error.message} isError />
  }
  if (!dispatch) {
    return <MessageState message="Dispatch not found." />
  }

  const isActive = isActiveStatus(dispatch.status)
  const mapsUrl = getMapsUrl(report?.publicLocation)
  const title = getDispatchTitle(report)
  const step = getStepValue(dispatch.status)
  const progress = getDispatchProgress(dispatch.status)

  return (
    <div className={styles.page}>
      <DispatchHeader
        title={title}
        isActive={isActive}
        dispatchId={dispatchId}
        onBack={() => void navigate('/')}
      />

      <div className={styles.body}>
        <MaybeIncidentSummary report={report} reportId={dispatch.reportId} />

        <ProgressCard status={dispatch.status} step={step} progress={progress} />

        <MaybeNavigateSection isActive={isActive} mapsUrl={mapsUrl} />

        <MaybePreArrivalInfo
          isActive={isActive}
          status={dispatch.status}
          report={report}
          distanceMeters={distanceMeters}
        />

        <MaybePendingDispatchActions
          status={dispatch.status}
          accepting={accepting}
          declining={declining}
          showDecline={showDecline}
          declineReason={declineReason}
          acceptError={acceptError}
          declineError={declineError}
          onAccept={() => void accept().catch(() => undefined)}
          onToggleDecline={() => {
            setShowDecline((v) => !v)
          }}
          onDeclineReasonChange={setDeclineReason}
          onConfirmDecline={() => {
            if (!declineReason) return
            void decline(declineReason).catch((err: unknown) => {
              console.error('[DispatchDetailPage] decline failed:', err)
            })
          }}
          onCancelDecline={() => {
            setShowDecline(false)
            setDeclineReason('')
          }}
        />

        <MaybeActiveDispatchStatus
          isActive={isActive}
          dispatch={dispatch}
          dispatchId={dispatchId}
          autoAdvanceState={autoAdvanceState}
          advanceLoading={advanceLoading}
          advanceError={advanceError}
          resolutionSummary={resolutionSummary}
          onResolutionSummaryChange={setResolutionSummary}
          onRetryAcknowledgement={() => void advance('acknowledged').catch(() => undefined)}
          onAdvanceEnRoute={() => void advance('en_route').catch(() => undefined)}
          onAdvanceOnScene={() => void advance('on_scene').catch(() => undefined)}
          onResolve={() => {
            void advance('resolved', { resolutionSummary }).catch((err: unknown) => {
              console.error('[DispatchDetailPage] resolve failed:', err)
            })
          }}
        />

        <MaybeActiveDispatchActions
          isActive={isActive}
          dispatchId={dispatchId}
          contactPhone={report?.contactPhone}
          showUnable={showUnable}
          unableReason={unableReason}
          markingUnable={markingUnable}
          unableError={unableError}
          onShowUnable={() => {
            setShowUnable(true)
          }}
          onUnableReasonChange={setUnableReason}
          onSubmitUnable={() => {
            if (!unableReason) return
            void markUnableToComplete(unableReason).catch((err: unknown) => {
              console.error('[DispatchDetailPage] unable-to-complete failed:', err)
            })
          }}
        />

        <MaybeFieldNoteForm
          isActive={isActive}
          draft={fieldNoteDraft}
          addingNote={addingNote}
          onSubmit={() => {
            void submitFieldNote(fieldNoteDraft.value, addNote, fieldNoteDraft.clear)
          }}
        />
      </div>
    </div>
  )
}
