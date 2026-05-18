import { useRef, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { SeverityBadge } from './SeverityBadge'
import { ReportTypeIcon } from './ReportTypeIcon'
import { ConfirmationModal } from './ConfirmationModal'
import type { Report } from '../types'

interface ResponderEntry {
  uid: string
  displayName?: string
  agency?: string
}

interface Props {
  report: Report | null
  responders?: ResponderEntry[]
  onClose: () => void
  onVerify: (id: string) => void
  onReject: (id: string) => void
  onDispatch: (id: string, agency: string, responder: string) => void
  onDeclareAlert?: (reportId: string) => void
}

const AGENCIES = ['BFP', 'PNP', 'MDRRMO', 'Coast Guard'] as const

export function TriagePanel({
  report,
  responders,
  onClose,
  onVerify,
  onReject,
  onDispatch,
  onDeclareAlert,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [showDispatchForm, setShowDispatchForm] = useState(false)
  const [agency, setAgency] = useState('')
  const [responder, setResponder] = useState('')
  const [holdProgress, setHoldProgress] = useState(0)
  const holdTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Reset dispatch form state when the selected report changes so stale selections don't leak across reports
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setShowDispatchForm(false)
    setAgency('')
    setResponder('')
    setHoldProgress(0)
    if (holdTimerRef.current) {
      clearInterval(holdTimerRef.current)
      holdTimerRef.current = null
    }
  }, [report?.id, report?.status])
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) {
        clearInterval(holdTimerRef.current)
        holdTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!report?.id) return
    previousFocusRef.current = document.activeElement as HTMLElement
    panelRef.current?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      if (previousFocusRef.current) {
        previousFocusRef.current.focus()
      }
    }
  }, [report?.id, onClose])

  if (!report) return null

  const filteredResponders = agency ? (responders ?? []).filter((r) => r.agency === agency) : []
  const canAdvanceToReview = report.status === 'new'
  const canVerify = report.status === 'awaiting_verify'
  const canReject = report.status === 'awaiting_verify'
  const canDispatch =
    report.status === 'verified' ||
    report.status === 'assigned' ||
    report.status === 'acknowledged' ||
    report.status === 'en_route' ||
    report.status === 'on_scene' ||
    report.status === 'reopened'

  const startHold = () => {
    if (!agency || !responder) return
    setHoldProgress(0)
    holdTimerRef.current = setInterval(() => {
      setHoldProgress((p) => {
        if (p >= 100) {
          if (holdTimerRef.current) clearInterval(holdTimerRef.current)
          if (agency && responder) {
            onDispatch(report.id, agency, responder)
          }
          return 0
        }
        return p + 10
      })
    }, 100)
  }

  const endHold = () => {
    if (holdTimerRef.current) clearInterval(holdTimerRef.current)
    setHoldProgress(0)
  }

  return (
    <>
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="triage-panel-title"
        className="absolute right-0 top-0 z-[1000] h-full w-[380px] overflow-y-auto border-l border-white/10 bg-[var(--color-surface-elevated)] shadow-xl transition-transform duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] lg:w-[420px] xl:w-[480px]"
      >
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <h3 id="triage-panel-title" className="font-semibold text-[var(--color-text-primary)]">
            Report Detail
          </h3>
          <button
            onClick={onClose}
            className="rounded p-2 hover:bg-white/10"
            aria-label="Close panel"
          >
            <X className="h-4 w-4 text-[var(--color-text-secondary)]" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {report.municipality}, {report.barangay}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <ReportTypeIcon type={report.type} />
              <SeverityBadge severity={report.severity} />
              <span className="rounded-sm border border-white/10 px-2 py-0.5 text-xs uppercase text-[var(--color-text-secondary)]">
                {report.status.replaceAll('_', ' ')}
              </span>
            </div>
          </div>

          <p className="text-sm text-[var(--color-text-primary)]">{report.description}</p>

          <div className="space-y-2">
            {(canAdvanceToReview || canVerify) && (
              <button
                onClick={() => {
                  onVerify(report.id)
                }}
                className="w-full rounded-md bg-[var(--color-success)] py-2 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-success)]"
              >
                {canAdvanceToReview ? 'Advance to review' : 'Verify'}
              </button>
            )}
            {canReject && (
              <button
                onClick={() => {
                  setRejectModalOpen(true)
                }}
                className="w-full rounded-md border border-[var(--color-danger)] py-2 text-sm font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-danger)]"
              >
                Reject
              </button>
            )}
          </div>

          {canDispatch && (
            <div className="border-t border-white/10 pt-4">
              <button
                onClick={() => {
                  setShowDispatchForm((s) => !s)
                }}
                className="w-full rounded-md bg-[var(--color-info)] py-2 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-info)]"
              >
                Dispatch Responder
              </button>
              {showDispatchForm && (
                <div className="mt-3 space-y-2">
                  <select
                    aria-label="Select Agency"
                    value={agency}
                    onChange={(e) => {
                      setAgency(e.target.value)
                      setResponder('')
                    }}
                    className="w-full rounded border border-white/10 bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                  >
                    <option value="">Select Agency</option>
                    {AGENCIES.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                  {agency && (
                    <select
                      aria-label="Select Responder"
                      value={responder}
                      onChange={(e) => {
                        setResponder(e.target.value)
                      }}
                      className="w-full rounded border border-white/10 bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                    >
                      <option value="">
                        {filteredResponders.length === 0
                          ? 'No responders available'
                          : 'Select Responder'}
                      </option>
                      {filteredResponders.map((r) => (
                        <option key={r.uid} value={r.uid}>
                          {r.displayName ?? r.uid}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    type="button"
                    disabled={!agency || !responder}
                    aria-disabled={!agency || !responder}
                    aria-label="Hold to Dispatch responder (press and hold Space or Enter)"
                    onMouseDown={startHold}
                    onMouseUp={endHold}
                    onMouseLeave={endHold}
                    onTouchStart={startHold}
                    onTouchEnd={endHold}
                    onKeyDown={(e) => {
                      if (e.repeat) return
                      if (e.key !== ' ' && e.key !== 'Enter') return
                      e.preventDefault()
                      startHold()
                    }}
                    onKeyUp={(e) => {
                      if (e.key !== ' ' && e.key !== 'Enter') return
                      endHold()
                    }}
                    onBlur={endHold}
                    className="relative w-full overflow-hidden rounded-md bg-[var(--color-info)] py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="relative z-10">Hold to Dispatch</span>
                    {holdProgress > 0 && (
                      <div
                        className="pointer-events-none absolute inset-0 origin-left rounded-md bg-white/20"
                        style={{
                          transform: `scaleX(${String(holdProgress / 100)})`,
                          transition: 'transform 100ms linear',
                        }}
                        aria-hidden="true"
                      />
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {canDispatch && onDeclareAlert && (
            <div className="border-t border-white/10 pt-4">
              <button
                onClick={() => {
                  onDeclareAlert(report.id)
                }}
                className="w-full rounded-md bg-[var(--color-danger)] py-2 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-danger)]"
              >
                Declare Alert
              </button>
            </div>
          )}

          <p className="text-xs text-[var(--color-text-muted)]">Report #{report.id}</p>
        </div>
      </div>

      <ConfirmationModal
        open={rejectModalOpen}
        title="Reject Report"
        message="This will permanently remove the report from the queue."
        confirmLabel="Reject"
        confirmVariant="danger"
        onConfirm={() => {
          onReject(report.id)
          setRejectModalOpen(false)
        }}
        onCancel={() => {
          setRejectModalOpen(false)
        }}
      />
    </>
  )
}
