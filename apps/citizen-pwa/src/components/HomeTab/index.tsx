import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HomeHeader } from './HomeHeader.js'
import { useHomeData } from './HomeDataContext.js'

const MODULE_SLOTS = [
  { label: 'Your local brief', height: 'min-h-40' },
  { label: 'Your report', height: 'min-h-28' },
  { label: 'Nearby', height: 'min-h-28' },
  { label: "Today's weather", height: 'min-h-24' },
] as const

export function HomeTab() {
  const navigate = useNavigate()
  const [now] = useState(() => Date.now())
  const { alerts, reports, unreadAlertCount } = useHomeData()
  const locationLabel = reports.find((report) =>
    report.municipalityLabel?.trim(),
  )?.municipalityLabel
  const updatedAt = Math.max(
    0,
    ...alerts.map((alert) => alert.publishedAt),
    ...reports.map((report) => report.lastStatusAt ?? report.submittedAt),
  )

  const openAlerts = () => {
    void navigate('/alerts')
  }

  return (
    <div data-testid="home-tab" className="h-full overflow-y-auto bg-surface-50">
      <div className="mx-auto w-full max-w-lg">
        <HomeHeader
          now={now}
          onOpenAlerts={openAlerts}
          unreadAlertCount={unreadAlertCount}
          {...(locationLabel ? { locationLabel } : {})}
          {...(updatedAt > 0 ? { updatedAt } : {})}
        />

        {MODULE_SLOTS.map(({ label, height }) => (
          <section
            key={label}
            data-home-slot={label}
            className={`${height} border-b border-surface-200 px-5 py-5`}
          >
            <p className="m-0 text-xs font-bold uppercase tracking-[0.08em] text-surface-600">
              {label}
            </p>
            <div className="mt-4 h-4 w-4/5 rounded bg-surface-200" />
            <div className="mt-2 h-4 w-3/5 rounded bg-surface-200" />
          </section>
        ))}

        <section data-home-slot="Emergency contacts" className="px-5 py-5">
          <p className="m-0 text-sm font-semibold text-surface-600">Emergency contacts</p>
        </section>
      </div>
    </div>
  )
}
