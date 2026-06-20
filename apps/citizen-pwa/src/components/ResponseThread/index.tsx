import { useState } from 'react'
import { ArrowLeft, ChevronDown } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMyActiveReports } from '../../hooks/useMyActiveReports.js'
import {
  getHazardTypePresentation,
  getOperationalStagePresentation,
} from '../../utils/status-registry.js'
import { buildTrackingTimeline, type TrackingStageId } from '../../utils/tracking-timeline.js'

const EVENT_DATE = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function StageStateLabel({ state }: { state: 'reached' | 'current' | 'upcoming' }) {
  if (state === 'current') return <span className="font-bold text-surface-900">Current</span>
  if (state === 'reached') return <span className="font-semibold text-success-700">Reached</span>
  return <span className="text-surface-500">No update yet</span>
}

export function ResponseThread() {
  const navigate = useNavigate()
  const { id = '' } = useParams()
  const { reports, loading, error, retry } = useMyActiveReports()
  const [expandedStage, setExpandedStage] = useState<TrackingStageId | null>(null)
  const report = reports.find((candidate) => candidate.id === id || candidate.publicRef === id)

  const goBack = () => {
    if (window.history.length > 1) {
      void navigate(-1)
      return
    }
    void navigate('/')
  }

  if (loading) {
    return (
      <main className="min-h-[100dvh] bg-surface-50 px-5 py-8 text-surface-900">
        <p role="status" className="mx-auto max-w-lg text-sm text-surface-600">
          Loading report updates...
        </p>
      </main>
    )
  }

  if (error && !report) {
    return (
      <main className="min-h-[100dvh] bg-surface-50 px-5 py-8 text-surface-900">
        <div className="mx-auto max-w-lg">
          <p role="alert" className="text-sm text-danger-700">
            {error}
          </p>
          <button
            type="button"
            onClick={retry}
            className="mt-4 min-h-11 rounded-lg bg-brand-600 px-4 text-sm font-bold text-white"
          >
            Try again
          </button>
        </div>
      </main>
    )
  }

  if (!report) {
    return (
      <main className="min-h-[100dvh] bg-surface-50 px-5 py-8 text-surface-900">
        <div className="mx-auto max-w-lg">
          <button
            type="button"
            onClick={goBack}
            className="flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-700"
          >
            <ArrowLeft size={18} aria-hidden="true" />
            Back
          </button>
          <h1 className="mt-8 text-xl font-bold">Report not found</h1>
          <p className="mt-2 text-sm text-surface-600">
            This device does not have a report matching that tracking link.
          </p>
        </div>
      </main>
    )
  }

  const timeline = buildTrackingTimeline(report)
  const hazard = getHazardTypePresentation(report.reportType)
  const currentStage = getOperationalStagePresentation(timeline.currentStage)

  return (
    <main className="min-h-[100dvh] bg-surface-50 text-surface-900">
      <header className="sticky top-0 z-10 border-b border-surface-200 bg-surface-50/95 px-5 pb-4 pt-3 backdrop-blur">
        <div className="mx-auto max-w-lg">
          <button
            type="button"
            onClick={goBack}
            className="flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-700"
          >
            <ArrowLeft size={18} aria-hidden="true" />
            Back
          </button>
          <div className="mt-2 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-surface-500">
                {hazard.label} report
              </p>
              <h1 className="mt-1 text-xl font-extrabold">Response thread</h1>
              <p className="mt-1 font-mono text-sm font-bold text-surface-700">
                {report.publicRef}
              </p>
            </div>
            <div
              className="flex max-w-40 items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-bold shadow-sm"
              style={{ color: currentStage.colorToken }}
            >
              <currentStage.icon size={16} aria-hidden="true" />
              <span>{currentStage.label}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-5 pb-12 pt-6">
        <section className="rounded-2xl border border-brand-200 bg-brand-50 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-brand-700">
            {timeline.fineStatus}
          </p>
          <h2 className="mt-2 text-2xl font-extrabold leading-tight">{timeline.headline}</h2>
          <p className="mt-2 text-sm leading-relaxed text-surface-700">{timeline.explanation}</p>
          <p className="mt-3 text-sm font-semibold text-surface-800">{timeline.nextStep}</p>
        </section>

        <section aria-labelledby="response-progress-heading" className="mt-8">
          <h2 id="response-progress-heading" className="text-lg font-extrabold">
            Response progress
          </h2>
          <div className="mt-4 space-y-3">
            {timeline.stages.map((stage) => {
              const presentation = getOperationalStagePresentation(stage.id)
              const isExpanded = expandedStage === stage.id
              return (
                <div key={stage.id} className="rounded-xl border border-surface-200 bg-white">
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    onClick={() => {
                      setExpandedStage(isExpanded ? null : stage.id)
                    }}
                    className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left"
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-100"
                      style={{ color: presentation.colorToken }}
                    >
                      <presentation.icon size={20} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-surface-900">
                        {presentation.label}
                      </span>
                      <span className="mt-0.5 block text-xs">
                        <StageStateLabel state={stage.state} />
                      </span>
                    </span>
                    <ChevronDown
                      size={18}
                      aria-hidden="true"
                      className={`text-surface-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {isExpanded ? (
                    <p className="border-t border-surface-200 px-4 py-3 text-sm text-surface-600">
                      {stage.detail ??
                        (stage.state === 'reached'
                          ? 'The current report status confirms this grouped stage was reached.'
                          : 'No finer update has been recorded for this stage.')}
                    </p>
                  ) : null}
                </div>
              )
            })}
          </div>
        </section>

        <section aria-labelledby="response-history-heading" className="mt-8">
          <h2 id="response-history-heading" className="text-lg font-extrabold">
            Dated updates
          </h2>
          <ol className="mt-4 border-l-2 border-surface-200 pl-5">
            {timeline.events.map((event) => (
              <li key={`${event.title}-${String(event.at)}`} className="relative pb-6 last:pb-0">
                <span className="absolute -left-[1.7rem] top-1.5 h-3 w-3 rounded-full border-2 border-surface-50 bg-brand-600" />
                <time
                  dateTime={new Date(event.at).toISOString()}
                  className="text-xs text-surface-500"
                >
                  {EVENT_DATE.format(new Date(event.at))}
                </time>
                <h3 className="mt-1 text-sm font-bold">{event.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-surface-600">{event.detail}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </main>
  )
}
