import { useEffect, useRef, useState, type CSSProperties, type TouchEvent } from 'react'
import { actionsFor } from '../../lib/reportActions.js'
import type { MyReport, PublicIncident } from './types.js'

type Props =
  | {
      mode: 'public'
      incident: PublicIncident
      sheetPhase: 'hidden' | 'peek' | 'expanded'
      onClose: () => void
      onCollapse: () => void
    }
  | {
      mode: 'myReport'
      report: MyReport
      sheetPhase: 'hidden' | 'peek' | 'expanded'
      onClose: () => void
      onCollapse: () => void
    }

const LABELS: Record<string, string> = {
  flood: 'Flood',
  fire: 'Fire',
  earthquake: 'Earthquake',
  typhoon: 'Typhoon',
  landslide: 'Landslide',
  storm_surge: 'Storm Surge',
  medical: 'Medical',
  accident: 'Accident',
  structural: 'Structural',
  security: 'Security',
  other: 'Other',
}

const PROGRESS_STATUSES = ['new', 'awaiting_verify', 'verified', 'en_route', 'resolved'] as const

function timeAgo(timestamp: number): string {
  const minutes = Math.floor((Date.now() - timestamp) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${String(minutes)} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${String(hours)} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${String(days)} day${days === 1 ? '' : 's'} ago`
}

function progressStatus(status: MyReport['status']): (typeof PROGRESS_STATUSES)[number] {
  if (status === 'queued' || status === 'draft_inbox' || status === 'new') return 'new'
  if (status === 'awaiting_verify') return 'awaiting_verify'
  if (status === 'verified' || status === 'assigned' || status === 'acknowledged') return 'verified'
  if (status === 'en_route' || status === 'on_scene') return 'en_route'
  return 'resolved'
}

export function DetailSheet(props: Props) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | null>(null)
  const startY = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    [],
  )

  if (props.sheetPhase === 'hidden') return null

  function handleCopy(text: string) {
    void navigator.clipboard.writeText(text)
    setCopied(true)
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      setCopied(false)
    }, 2000)
  }

  function handleTouchStart(event: TouchEvent<HTMLElement>) {
    startY.current = event.touches[0]?.clientY ?? null
  }

  function handleTouchEnd(event: TouchEvent<HTMLElement>) {
    if (startY.current === null) return
    const delta = (event.changedTouches[0]?.clientY ?? 0) - startY.current
    startY.current = null
    if (delta > 80) props.onClose()
    else if (delta > 30) props.onCollapse()
  }

  const baseStyle: CSSProperties = {
    position: 'fixed',
    inset: 'auto 0 0',
    zIndex: 60,
    maxHeight: '80dvh',
    overflowY: 'auto',
    padding: '0 20px 32px',
    background: 'var(--color-surface-container-low)',
    borderRadius: '16px 16px 0 0',
    boxShadow: '0 -4px 32px rgba(0,30,64,0.15)',
  }

  const dragHandle = (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 16px' }}>
      <div
        style={{
          width: 32,
          height: 4,
          borderRadius: 9999,
          background: 'var(--color-on-surface-variant)',
          opacity: 0.35,
        }}
      />
    </div>
  )

  if (props.mode === 'public') {
    const incident = props.incident
    return (
      <section style={baseStyle} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {dragHandle}
        <p
          style={{
            margin: 0,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontWeight: 800,
            fontSize: '1.125rem',
          }}
        >
          {LABELS[incident.reportType] ?? incident.reportType}
        </p>
        <p
          style={{
            margin: '4px 0 12px',
            fontFamily: "'Inter', sans-serif",
            fontSize: '0.75rem',
            fontWeight: 700,
          }}
        >
          {incident.severity.toUpperCase()}
        </p>
        <p style={{ margin: '0 0 4px', color: 'var(--color-on-surface-variant)' }}>
          📍 {incident.barangayId}, {incident.municipalityLabel}
        </p>
        <p style={{ margin: '0 0 16px', color: 'var(--color-on-surface-variant)' }}>
          Reported {timeAgo(incident.submittedAt)}
        </p>
        <button type="button" aria-label="Close" onClick={props.onClose}>
          Close
        </button>
      </section>
    )
  }

  const report = props.report
  const displayStatus = progressStatus(report.status)
  const actions = actionsFor(displayStatus)
  const statusIndex = PROGRESS_STATUSES.indexOf(displayStatus)

  return (
    <section style={baseStyle} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {dragHandle}
      <p style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800 }}>
        ★ Your Report
      </p>
      <p
        style={{
          margin: '4px 0 16px',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontWeight: 700,
          fontSize: '1.125rem',
        }}
      >
        {LABELS[report.reportType] ?? report.reportType}
        {report.status !== 'queued' && report.status !== 'new'
          ? ` · ${report.status.replace(/_/g, ' ')}`
          : ' · Awaiting Review'}
      </p>
      <div
        style={{
          background: 'var(--color-surface-container-lowest)',
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <p
            style={{
              margin: '0 0 4px',
              fontSize: '0.625rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-on-surface-variant)',
            }}
          >
            Tracking Code
          </p>
          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800 }}>
            {report.publicRef}
          </span>
        </div>
        <button
          type="button"
          aria-label={copied ? 'Copied' : 'Copy'}
          onClick={() => {
            handleCopy(report.publicRef)
          }}
        >
          {copied ? 'Copied ✓' : 'Copy'}
        </button>
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {PROGRESS_STATUSES.map((step, index) => (
          <div
            key={step}
            style={{
              display: 'flex',
              alignItems: 'center',
              flex: index < PROGRESS_STATUSES.length - 1 ? 1 : 'none',
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background:
                  index <= statusIndex
                    ? 'var(--color-primary)'
                    : 'var(--color-surface-container-low)',
                border: '2px solid var(--color-primary)',
              }}
            />
            {index < PROGRESS_STATUSES.length - 1 ? (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  background:
                    index < statusIndex
                      ? 'var(--color-primary)'
                      : 'var(--color-surface-container-low)',
                }}
              />
            ) : null}
          </div>
        ))}
      </div>
      {actions.includes('edit') ? (
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button type="button" aria-label="Edit">
            Edit
          </button>
          <button type="button" aria-label="Cancel report">
            Cancel
          </button>
        </div>
      ) : null}
      {actions.includes('request_correction') ? (
        <button type="button" aria-label="Request correction" style={{ marginBottom: 8 }}>
          Request Correction
        </button>
      ) : null}
      <button type="button" aria-label="Close" onClick={props.onClose}>
        Close
      </button>
    </section>
  )
}
