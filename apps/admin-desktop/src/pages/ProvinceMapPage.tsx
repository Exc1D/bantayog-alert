import { useState, useEffect, useCallback } from 'react'
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore'
import { db } from '../app/firebase'
import type { Timestamp } from 'firebase/firestore'

// ── Styles ────────────────────────────────────────────────────────────────────

const PAGE_STYLE: React.CSSProperties = {
  padding: '24px',
  maxWidth: '1200px',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '24px',
}

const CARD_STYLE: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  padding: '16px 20px',
}

const SECTION_TITLE_STYLE: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: '#6b7280',
  marginBottom: '12px',
}

const PLACEHOLDER_STYLE: React.CSSProperties = {
  background: '#fef9c3',
  border: '1px solid #fde047',
  borderRadius: '6px',
  padding: '12px 16px',
  fontSize: '13px',
  color: '#713f12',
  marginBottom: '16px',
}

const TABLE_STYLE: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '13px',
}

const TH_STYLE: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 12px',
  borderBottom: '2px solid #e5e7eb',
  fontWeight: 600,
  color: '#374151',
  background: '#f9fafb',
}

const TD_STYLE: React.CSSProperties = {
  padding: '8px 12px',
  borderBottom: '1px solid #e5e7eb',
  color: '#111827',
}

const FILTER_ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  gap: '12px',
  flexWrap: 'wrap',
  alignItems: 'center',
  marginBottom: '16px',
}

const SELECT_STYLE: React.CSSProperties = {
  padding: '6px 10px',
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  fontSize: '13px',
  background: '#fff',
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReportDoc {
  municipality: string
  hazardType: string
  status: string
  createdAt: Timestamp | null
}

interface ReportRow extends ReportDoc {
  id: string
}

interface ResponderRow {
  id: string
  name: string
  availabilityStatus: string
  municipality: string
}

type TimeWindow = '24h' | '7d' | 'all'

// ── Helpers ───────────────────────────────────────────────────────────────────

function toStr(val: unknown, fallback = '—'): string {
  return typeof val === 'string' ? val : fallback
}

function toTimestamp(val: unknown): Timestamp | null {
  if (val != null && typeof (val as Timestamp).toDate === 'function') {
    return val as Timestamp
  }
  return null
}

const WINDOW_MS: Record<TimeWindow, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  all: Infinity,
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ProvinceMapPage() {
  const [reports, setReports] = useState<ReportRow[]>([])
  const [responders, setResponders] = useState<ResponderRow[]>([])
  const [hazardFilter, setHazardFilter] = useState<string>('all')
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('24h')
  const [municipalityFilter, setMunicipalityFilter] = useState<string>('all')

  useEffect(() => {
    return onSnapshot(
      query(collection(db, 'responders'), where('availabilityStatus', '==', 'available')),
      (snap) => {
        setResponders(
          snap.docs.map((d) => ({
            id: d.id,
            name: toStr(d.data().name, d.id),
            availabilityStatus: toStr(d.data().availabilityStatus, 'unknown'),
            municipality: toStr(d.data().municipality),
          })),
        )
      },
    )
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setReports(
        snap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            municipality: toStr(data.municipality),
            hazardType: toStr(data.hazardType),
            status: toStr(data.status),
            createdAt: toTimestamp(data.createdAt),
          }
        }),
      )
    })
    return unsub
  }, [])

  // Stable threshold computation — captured once, not per-render
  const isInWindow = useCallback(
    (createdAt: Timestamp | null): boolean => {
      if (timeWindow === 'all') return true
      if (createdAt === null) return true
      return Date.now() - createdAt.toDate().getTime() <= WINDOW_MS[timeWindow]
    },
    [timeWindow],
  )

  const filtered = reports.filter((r) => {
    if (hazardFilter !== 'all' && r.hazardType !== hazardFilter) return false
    if (municipalityFilter !== 'all' && r.municipality !== municipalityFilter) return false
    return isInWindow(r.createdAt)
  })

  const hazardTypes = ['all', ...Array.from(new Set(reports.map((r) => r.hazardType))).sort()]
  const municipalities = ['all', ...Array.from(new Set(reports.map((r) => r.municipality))).sort()]

  return (
    <div style={PAGE_STYLE}>
      <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', margin: 0 }}>
        Province Map
      </h1>

      <div style={PLACEHOLDER_STYLE}>
        Province Map — Leaflet not installed. Run:{' '}
        <code style={{ fontFamily: 'monospace' }}>pnpm add leaflet @types/leaflet</code> to enable
        the interactive map.
      </div>

      <div style={CARD_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Active Reports by Municipality</div>

        <div style={FILTER_ROW_STYLE}>
          <label style={{ fontSize: '13px', color: '#374151' }}>
            Hazard:&nbsp;
            <select
              style={SELECT_STYLE}
              value={hazardFilter}
              onChange={(e) => {
                setHazardFilter(e.target.value)
              }}
            >
              {hazardTypes.map((h) => (
                <option key={h} value={h}>
                  {h === 'all' ? 'All types' : h}
                </option>
              ))}
            </select>
          </label>

          <label style={{ fontSize: '13px', color: '#374151' }}>
            Time window:&nbsp;
            <select
              style={SELECT_STYLE}
              value={timeWindow}
              onChange={(e) => {
                setTimeWindow(e.target.value as TimeWindow)
              }}
            >
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="all">All time</option>
            </select>
          </label>

          <label style={{ fontSize: '13px', color: '#374151' }}>
            Municipality:&nbsp;
            <select
              style={SELECT_STYLE}
              value={municipalityFilter}
              onChange={(e) => {
                setMunicipalityFilter(e.target.value)
              }}
            >
              {municipalities.map((m) => (
                <option key={m} value={m}>
                  {m === 'all' ? 'All municipalities' : m}
                </option>
              ))}
            </select>
          </label>
        </div>

        {filtered.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#6b7280' }}>
            No reports match the selected filters.
          </p>
        ) : (
          <table style={TABLE_STYLE}>
            <thead>
              <tr>
                <th style={TH_STYLE}>Municipality</th>
                <th style={TH_STYLE}>Hazard Type</th>
                <th style={TH_STYLE}>Status</th>
                <th style={TH_STYLE}>Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td style={TD_STYLE}>{r.municipality}</td>
                  <td style={TD_STYLE}>{r.hazardType}</td>
                  <td style={TD_STYLE}>{r.status}</td>
                  <td style={TD_STYLE}>{r.createdAt?.toDate().toLocaleString() ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={CARD_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Available Responders ({responders.length})</div>
        {responders.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#6b7280' }}>No available responders right now.</p>
        ) : (
          <table style={TABLE_STYLE}>
            <thead>
              <tr>
                <th style={TH_STYLE}>Name</th>
                <th style={TH_STYLE}>Municipality</th>
                <th style={TH_STYLE}>Status</th>
              </tr>
            </thead>
            <tbody>
              {responders.map((r) => (
                <tr key={r.id}>
                  <td style={TD_STYLE}>{r.name}</td>
                  <td style={TD_STYLE}>{r.municipality}</td>
                  <td style={TD_STYLE}>{r.availabilityStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
