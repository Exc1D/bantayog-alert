import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../app/firebase'
import { useProvinceMetrics } from '../hooks/useProvinceMetrics'
import { useMunicipalPerformance } from '../hooks/useMunicipalPerformance'
import { MunicipalPerformanceTable } from '../components/MunicipalPerformanceTable'
import { NdrrrmcDrawer } from '../components/NdrrrmcDrawer'

// ── Styles ────────────────────────────────────────────────────────────────────

const PAGE_STYLE: React.CSSProperties = {
  padding: '24px',
  maxWidth: '1200px',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '24px',
}

const SECTION_TITLE_STYLE: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: '#6b7280',
  marginBottom: '12px',
}

const CARD_STYLE: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  padding: '16px 20px',
}

const KPI_GRID_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
  gap: '12px',
}

const KPI_LABEL_STYLE: React.CSSProperties = {
  fontSize: '12px',
  color: '#6b7280',
  marginBottom: '4px',
}

const KPI_VALUE_STYLE: React.CSSProperties = {
  fontSize: '28px',
  fontWeight: 700,
  lineHeight: 1.1,
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string
  value: string | number
  valueColor?: string
  sub?: string
}

function KpiCard({ label, value, valueColor, sub }: KpiCardProps) {
  return (
    <div style={CARD_STYLE}>
      <p style={KPI_LABEL_STYLE}>{label}</p>
      <p style={{ ...KPI_VALUE_STYLE, color: valueColor ?? '#111827' }}>{value}</p>
      {sub !== undefined && (
        <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>{sub}</p>
      )}
    </div>
  )
}

// ── 7-Day Trend query ─────────────────────────────────────────────────────────

function useTrend() {
  return useQuery({
    queryKey: ['province-dashboard', '7day-trend'],
    queryFn: async () => {
      const today = new Date()
      const dates: string[] = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today)
        d.setDate(today.getDate() - i)
        dates.push(d.toISOString().slice(0, 10))
      }
      const rows = await Promise.all(
        dates.map(async (date) => {
          const snap = await getDoc(doc(db, 'analytics_snapshots', date, 'province', 'summary'))
          const data = snap.data()
          return {
            date,
            resolvedToday: typeof data?.resolvedToday === 'number' ? data.resolvedToday : 0,
          }
        }),
      )
      return rows
    },
    refetchInterval: 5 * 60 * 1000,
  })
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function ProvinceDashboardPage() {
  const [ndrrmcOpen, setNdrrmcOpen] = useState(false)

  const metrics = useProvinceMetrics()
  const municipalData = useMunicipalPerformance()
  const trend = useTrend()

  const slowMunicipalities = municipalData.filter(
    (m) => m.avgResponseTimeMinutes !== null && m.avgResponseTimeMinutes > 15,
  )

  const auditStatus =
    metrics.health === null ? 'Unknown' : metrics.health.healthy ? 'Healthy' : 'Degraded'

  const auditColor =
    metrics.health === null ? '#6b7280' : metrics.health.healthy ? '#15803d' : '#dc2626'

  const batchStatus =
    metrics.health === null
      ? 'Unknown'
      : metrics.health.batchGapSeconds < 600
        ? 'On-time'
        : 'Delayed'

  const batchColor =
    metrics.health === null
      ? '#6b7280'
      : metrics.health.batchGapSeconds < 600
        ? '#15803d'
        : '#d97706'

  return (
    <main style={PAGE_STYLE}>
      <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', margin: 0 }}>
        Province Dashboard
      </h1>

      {/* Row 1: KPI cards */}
      <section aria-labelledby="kpi-heading">
        <p id="kpi-heading" style={SECTION_TITLE_STYLE}>
          Live Metrics
        </p>
        <div style={KPI_GRID_STYLE}>
          <KpiCard label="Active Reports" value={metrics.activeReports} />
          <KpiCard label="Responders Available" value={metrics.respondersAvailable} />
          <KpiCard
            label="Avg Response Time (min)"
            value={
              metrics.avgResponseTimeMinutes !== null
                ? metrics.avgResponseTimeMinutes.toFixed(1)
                : '—'
            }
          />
          <KpiCard label="Resolved Today" value={metrics.resolvedToday} />
          <KpiCard
            label="Audit Streaming"
            value={auditStatus}
            valueColor={auditColor}
            {...(metrics.health !== null
              ? { sub: `Gap: ${String(metrics.health.streamingGapSeconds)}s` }
              : {})}
          />
          <KpiCard
            label="Batch Pipeline"
            value={batchStatus}
            valueColor={batchColor}
            {...(metrics.health !== null
              ? { sub: `Gap: ${String(metrics.health.batchGapSeconds)}s` }
              : {})}
          />
        </div>
      </section>

      {/* Row 2: Anomaly alert */}
      {slowMunicipalities.length > 0 && (
        <section aria-labelledby="anomaly-heading">
          <p id="anomaly-heading" style={SECTION_TITLE_STYLE}>
            Response Time Anomalies
          </p>
          <div
            role="alert"
            style={{
              ...CARD_STYLE,
              borderColor: '#fca5a5',
              background: '#fff1f2',
            }}
          >
            <p style={{ fontWeight: 600, color: '#b91c1c', marginBottom: '8px' }}>
              {slowMunicipalities.length === 1
                ? '1 municipality'
                : `${String(slowMunicipalities.length)} municipalities`}{' '}
              exceeding 15-min response threshold
            </p>
            <ul style={{ margin: 0, paddingLeft: '20px', color: '#7f1d1d', fontSize: '14px' }}>
              {slowMunicipalities.map((m) => (
                <li key={m.municipalityId}>
                  {m.municipalityId} —{' '}
                  {m.avgResponseTimeMinutes !== null
                    ? `${m.avgResponseTimeMinutes.toFixed(1)} min`
                    : '—'}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Row 3: Municipal performance table */}
      <section aria-labelledby="muni-table-heading">
        <p id="muni-table-heading" style={SECTION_TITLE_STYLE}>
          Municipal Performance
        </p>
        <div style={CARD_STYLE}>
          <MunicipalPerformanceTable data={municipalData} />
        </div>
      </section>

      {/* Row 4: NDRRMC queue widget */}
      <section aria-labelledby="ndrrmc-heading">
        <p id="ndrrmc-heading" style={SECTION_TITLE_STYLE}>
          NDRRMC Escalation Queue
        </p>
        <div
          style={{
            ...CARD_STYLE,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <p style={{ margin: 0, fontSize: '14px', color: '#374151' }}>
            View pending NDRRMC escalations and submit incident reports.
          </p>
          <button
            type="button"
            onClick={() => {
              setNdrrmcOpen(true)
            }}
            style={{
              padding: '8px 16px',
              background: '#7c3aed',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              marginLeft: '16px',
            }}
          >
            Open NDRRMC Drawer
          </button>
        </div>
      </section>

      {/* Row 5: Quick actions */}
      <section aria-labelledby="actions-heading">
        <p id="actions-heading" style={SECTION_TITLE_STYLE}>
          Quick Actions
        </p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {(
            [
              { label: 'Declare Data Incident', color: '#dc2626' },
              { label: 'Manage Resources', color: '#2563eb' },
              { label: 'System Health', color: '#059669' },
              { label: 'Dead-Letter Replay', color: '#d97706' },
            ] as const
          ).map(({ label, color }) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                /* no-op: Task 5/7 will wire these */
              }}
              style={{
                padding: '8px 16px',
                background: '#fff',
                color,
                border: `1px solid ${color}`,
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Row 6: 7-day trend */}
      <section aria-labelledby="trend-heading">
        <p id="trend-heading" style={SECTION_TITLE_STYLE}>
          7-Day Resolved Trend
        </p>
        <div style={CARD_STYLE}>
          {trend.isLoading ? (
            <p style={{ color: '#9ca3af', fontSize: '14px' }}>Loading trend…</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr>
                  <th
                    style={{
                      textAlign: 'left',
                      padding: '4px 8px',
                      color: '#6b7280',
                      fontWeight: 600,
                      borderBottom: '1px solid #e5e7eb',
                    }}
                  >
                    Date
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      padding: '4px 8px',
                      color: '#6b7280',
                      fontWeight: 600,
                      borderBottom: '1px solid #e5e7eb',
                    }}
                  >
                    Resolved Today
                  </th>
                </tr>
              </thead>
              <tbody>
                {(trend.data ?? []).map((row) => (
                  <tr key={row.date}>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid #f3f4f6' }}>
                      {row.date}
                    </td>
                    <td
                      style={{
                        padding: '4px 8px',
                        textAlign: 'right',
                        borderBottom: '1px solid #f3f4f6',
                        fontWeight: row.resolvedToday > 0 ? 600 : undefined,
                      }}
                    >
                      {row.resolvedToday}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <NdrrrmcDrawer
        open={ndrrmcOpen}
        onClose={() => {
          setNdrrmcOpen(false)
        }}
      />
    </main>
  )
}
