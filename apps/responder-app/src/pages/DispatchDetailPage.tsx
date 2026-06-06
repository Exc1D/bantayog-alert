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
  const [autoAdvanceState, setAutoAdvanceState] = useState<'idle' | 'pending' | 'done'>('idle')
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null)
  const fieldNoteDraft = useFieldNoteDraft(dispatchId)

  useEffect(() => {
    if (dispatch?.status !== 'accepted') return
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
  }, [dispatch?.status, advance])

  useEffect(() => {
    if (dispatch?.status !== 'acknowledged' && dispatch?.status !== 'en_route') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDistanceMeters(null)
      return
    }
    if (!report?.publicLocation) {
      setDistanceMeters(null)
      return
    }

    const publicLocation = report.publicLocation

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch?.status, report?.publicLocation?.latitude, report?.publicLocation?.longitude])

  useEffect(() => {
    if (acceptError ?? declineError ?? advanceError ?? unableError) {
      void refresh()
    }
  }, [acceptError, declineError, advanceError, unableError, refresh])

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <button className={styles.backBtn} onClick={() => void navigate('/')} aria-label="Back">
            ←
          </button>
          <h1 className={styles.pageTitle}>Loading…</h1>
        </div>
      </div>
    )
  }

  if (dispatch?.terminalSurface === 'cancelled') return <CancelledScreen dispatch={dispatch} />
  if (
    dispatch?.terminalSurface === 'race_loss' ||
    getFirebaseErrorCode(acceptError) === 'functions/already-exists'
  ) {
    return <RaceLossScreen />
  }
  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.body}>
          <p className={styles.errorMsg}>{error.message}</p>
        </div>
      </div>
    )
  }
  if (!dispatch) {
    return (
      <div className={styles.page}>
        <div className={styles.body}>
          <p>Dispatch not found.</p>
        </div>
      </div>
    )
  }

  const isActive = ['accepted', 'acknowledged', 'en_route', 'on_scene'].includes(dispatch.status)
  const sevClass =
    report?.severity === 'high'
      ? styles.sevHigh
      : report?.severity === 'medium'
        ? styles.sevMedium
        : styles.sevLow

  const mapsUrl = report?.publicLocation
    ? `https://maps.google.com/?q=${String(report.publicLocation.latitude)},${String(report.publicLocation.longitude)}`
    : null

  const reportTypeLabelText = report ? getReportTypeLabel(report.reportType) : ''
  const step = getStepValue(dispatch.status)
  const isPendingTimeline = dispatch.status === 'pending'

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <button className={styles.backBtn} onClick={() => void navigate('/')} aria-label="Back">
          ←
        </button>
        <h1 className={styles.pageTitle}>{report ? reportTypeLabelText : 'Dispatch'}</h1>
        {isActive && dispatchId !== undefined && (
          <Link to={`/dispatches/${dispatchId}/sos`} className={styles.pageHeaderSos}>
            SOS
          </Link>
        )}
      </div>

      <div className={styles.body}>
        {report && (
          <div className={styles.incidentCard}>
            <h2 className={styles.incidentTitle}>
              {reportTypeLabelText}
              <span className={[styles.severityBadge, sevClass].filter(Boolean).join(' ')}>
                {report.severity}
              </span>
            </h2>
            <div className={styles.incidentMeta}>
              <span>
                {report.municipalityLabel ?? report.municipalityId}
                {report.barangayId !== undefined ? ` · ${report.barangayId}` : ''}
              </span>
              <span>Report #{dispatch.reportId.slice(0, 8)}</span>
            </div>
            {report.description !== '' && (
              <p className={styles.incidentDesc}>{report.description}</p>
            )}
          </div>
        )}

        <div
          className={styles.progressCard}
          role="progressbar"
          aria-label="Dispatch progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={getDispatchProgress(dispatch.status)}
          aria-valuetext={step.text}
        >
          <DispatchRing
            mode="progress"
            percent={getDispatchProgress(dispatch.status)}
            tone={dispatch.status === 'resolved' ? 'success' : 'accent'}
            ariaLabel={`Dispatch progress ${String(getDispatchProgress(dispatch.status))} percent`}
          >
            <span className={styles.progressPercent}>
              {String(getDispatchProgress(dispatch.status))}%
            </span>
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

        {isActive && mapsUrl !== null && (
          <div className={styles.navigateSection}>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.navigateBtn}
            >
              🗺️ Navigate to Scene
            </a>
            <p className={styles.onboardingHint}>
              Enable location access to calculate live distance. Navigate to Scene still works if
              location is off.
            </p>
          </div>
        )}

        {isActive &&
          (dispatch.status === 'acknowledged' || dispatch.status === 'en_route') &&
          report && (
            <PreArrivalInfo reportType={report.reportType} distanceMeters={distanceMeters} />
          )}

        {dispatch.status === 'pending' && (
          <div className={styles.statusSection}>
            <p className={styles.statusTitle}>Action Required</p>
            <div className={styles.quickToggles}>
              <button
                className={[styles.toggleBtn, styles.togglePrimary].filter(Boolean).join(' ')}
                onClick={() => void accept().catch(() => undefined)}
                disabled={accepting}
              >
                {accepting ? 'Accepting…' : '✓ Accept'}
              </button>
              <button
                className={styles.toggleBtn}
                onClick={() => {
                  setShowDecline((v) => !v)
                }}
              >
                ✕ Decline
              </button>
            </div>
            {showDecline && (
              <div className={styles.selectMargin}>
                <select
                  value={declineReason}
                  onChange={(e) => {
                    setDeclineReason(e.target.value)
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
                  onClick={() => {
                    if (!declineReason) return
                    void decline(declineReason).catch((err: unknown) => {
                      console.error('[DispatchDetailPage] decline failed:', err)
                    })
                  }}
                  disabled={!declineReason || declining}
                >
                  {declining ? 'Declining…' : 'Confirm Decline'}
                </button>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => {
                    setShowDecline(false)
                    setDeclineReason('')
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
            {acceptError && <p className={styles.errorMsg}>{getActionErrorMessage(acceptError)}</p>}
            {declineError && (
              <p className={styles.errorMsg}>{getActionErrorMessage(declineError)}</p>
            )}
          </div>
        )}

        {isActive && dispatchId !== undefined && dispatch.status !== 'pending' && (
          <div className={styles.statusSection} data-testid={`dispatch-status-${dispatchId}`}>
            <p className={styles.statusTitle}>
              Status: {statusLabel(dispatch.uiStatus, dispatch.status)}
            </p>
            {autoAdvanceState !== 'idle' && (
              <p role="status" className={styles.autoAdvancePill ?? ''}>
                {autoAdvanceState === 'pending' ? 'Acknowledging dispatch…' : 'Acknowledged'}
              </p>
            )}
            {dispatch.status === 'accepted' && advanceError && !advanceLoading && (
              <button
                className={[styles.toggleBtn, styles.togglePrimary].filter(Boolean).join(' ')}
                onClick={() => void advance('acknowledged').catch(() => undefined)}
              >
                Retry acknowledgement
              </button>
            )}
            {dispatch.status === 'acknowledged' && (
              <div className={styles.quickToggles}>
                <button
                  className={[styles.toggleBtn, styles.togglePrimary].filter(Boolean).join(' ')}
                  onClick={() => void advance('en_route').catch(() => undefined)}
                  disabled={advanceLoading}
                >
                  📍 En Route
                </button>
              </div>
            )}
            {dispatch.status === 'en_route' && (
              <div className={styles.quickToggles}>
                <button
                  className={[styles.toggleBtn, styles.togglePrimary].filter(Boolean).join(' ')}
                  onClick={() => void advance('on_scene').catch(() => undefined)}
                  disabled={advanceLoading}
                >
                  🔧 On Scene
                </button>
              </div>
            )}
            {dispatch.status === 'on_scene' && (
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
                    setResolutionSummary(e.target.value)
                  }}
                  placeholder="Resolution summary (required)"
                  rows={3}
                />
                <span className={styles.charCount}>{resolutionSummary.length}/2000</span>
                <button
                  className={[styles.toggleBtn, styles.togglePrimary].filter(Boolean).join(' ')}
                  onClick={() => {
                    void advance('resolved', { resolutionSummary }).catch((err: unknown) => {
                      console.error('[DispatchDetailPage] resolve failed:', err)
                    })
                  }}
                  disabled={!resolutionSummary.trim() || advanceLoading}
                >
                  ✅ Mark Resolved
                </button>
              </div>
            )}
            {advanceError && (
              <p className={styles.errorMsg}>{getActionErrorMessage(advanceError)}</p>
            )}
          </div>
        )}

        {isActive && (
          <div className={styles.statusSection}>
            <p className={styles.statusTitle}>Actions</p>
            <div className={styles.actionStack}>
              {dispatchId !== undefined && (
                <Link to={`/dispatches/${dispatchId}/backup`} className={styles.navBtn}>
                  🆘 Request Backup
                </Link>
              )}
              {report?.contactPhone ? (
                <a href={`tel:${report.contactPhone}`} className={styles.navBtn}>
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
                <button
                  className={styles.dangerBtn}
                  onClick={() => {
                    setShowUnable(true)
                  }}
                >
                  Unable to Complete
                </button>
              ) : (
                <div>
                  <select
                    value={unableReason}
                    onChange={(e) => {
                      setUnableReason(e.target.value)
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
                    onClick={() => {
                      if (!unableReason) return
                      void markUnableToComplete(unableReason).catch((err: unknown) => {
                        console.error('[DispatchDetailPage] unable-to-complete failed:', err)
                      })
                    }}
                    disabled={!unableReason || markingUnable}
                  >
                    {markingUnable ? 'Submitting…' : 'Submit — No Penalty'}
                  </button>
                  {unableError && (
                    <p className={styles.errorMsg}>{getActionErrorMessage(unableError)}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {isActive && (
          <div className={styles.statusSection}>
            <p className={styles.statusTitle}>Add Field Note</p>
            <div className={styles.fieldNoteForm}>
              <label htmlFor="field-notes" className={styles.fieldLabel}>
                Field Notes
              </label>
              <textarea
                id="field-notes"
                className={styles.noteInput}
                value={fieldNoteDraft.value}
                maxLength={2000}
                disabled={!fieldNoteDraft.loaded}
                onChange={(e) => {
                  fieldNoteDraft.setValue(e.target.value)
                }}
                placeholder="On scene. Water is waist-deep…"
                rows={2}
              />
              <span className={styles.charCount}>{fieldNoteDraft.value.length}/2000</span>
              <button
                className={styles.noteSubmitBtn}
                disabled={!fieldNoteDraft.loaded || !fieldNoteDraft.value.trim() || addingNote}
                onClick={() => {
                  void (async () => {
                    try {
                      await addNote(fieldNoteDraft.value)
                    } catch (err: unknown) {
                      console.error('[DispatchDetailPage] addNote failed:', err)
                      return
                    }

                    try {
                      await fieldNoteDraft.clear()
                    } catch (err: unknown) {
                      console.error('[DispatchDetailPage] clearing field-note draft failed:', err)
                    }
                  })()
                }}
              >
                {addingNote ? 'Saving…' : 'Add Note'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
