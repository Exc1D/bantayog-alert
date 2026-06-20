import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HomeHeader } from './HomeHeader.js'
import { useHomeData } from './HomeDataContext.js'
import { NearbyCardFromSource, YourReportCard } from './modules/SecondaryStack.js'

const MODULE_SLOTS = [{ label: 'Your local brief', height: 'min-h-40' }] as const

export function HomeTab() {
  const navigate = useNavigate()
  const [now] = useState(() => Date.now())
  const { alerts, reports, unreadAlertCount } = useHomeData()
  const locationLabel = reports.find((report) =>
    report.municipalityLabel?.trim(),
  )?.municipalityLabel
  const knownLocation = reports.find(
    (report) => Number.isFinite(report.lat) && Number.isFinite(report.lng),
  )
  const userLocation = knownLocation
    ? { lat: knownLocation.lat, lng: knownLocation.lng }
    : undefined
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

        <YourReportCard reports={reports} />
        <NearbyCardFromSource
          municipality={locationLabel ?? ''}
          {...(userLocation ? { userLocation } : {})}
        />

        <section
          data-home-slot="Today's weather"
          className="min-h-24 border-b border-surface-200 px-5 py-5"
        >
          <p className="m-0 text-xs font-bold uppercase tracking-[0.08em] text-surface-600">
            Today&apos;s weather
          </p>
          <p className="mt-3 text-sm text-surface-600">Weather unavailable.</p>
        </section>

        <section data-home-slot="Emergency contacts" className="px-5 py-5">
          <p className="m-0 text-sm font-semibold text-surface-600">Emergency contacts</p>
        </section>
      </div>
    </div>
  )
}
