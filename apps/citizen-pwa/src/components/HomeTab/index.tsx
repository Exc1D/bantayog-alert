import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AlertDoc } from '@bantayog/shared-types'
import { usePublicIncidents } from '../../hooks/usePublicIncidents.js'
import type { PublicIncident } from '../MapTab/types.js'
import { HomeHeader } from './HomeHeader.js'
import { HomeHero } from './HomeHero.js'
import { useHomeData } from './HomeDataContext.js'
import { NearbyCard, YourReportCard } from './modules/SecondaryStack.js'

interface LocationPoint {
  lat: number
  lng: number
}

interface HomeBriefModulesProps {
  alerts: AlertDoc[]
  alertsError: Error | null
  alertsLoading: boolean
  locationLabel?: string
  municipality: string
  reports: ReturnType<typeof useHomeData>['reports']
  reportsError: string | null
  reportsLoading: boolean
  updatedAt: number
  userLocation?: LocationPoint
}

interface HomeBriefContentProps extends HomeBriefModulesProps {
  hasKnownLocation: boolean
  incidents: PublicIncident[]
  incidentsError: unknown
  incidentsLoading: boolean
  onRetryNearby?: () => void
}

function HomeBriefContent({
  alerts,
  alertsError,
  alertsLoading,
  hasKnownLocation,
  incidents,
  incidentsError,
  incidentsLoading,
  locationLabel,
  onRetryNearby,
  reports,
  reportsError,
  reportsLoading,
  updatedAt,
  userLocation,
}: HomeBriefContentProps) {
  return (
    <>
      <HomeHero
        alerts={alerts}
        alertsError={alertsError}
        alertsLoading={alertsLoading}
        hasKnownLocation={hasKnownLocation}
        incidents={incidents}
        incidentsError={incidentsError}
        incidentsLoading={incidentsLoading}
        {...(locationLabel ? { locationLabel } : {})}
        reportsError={reportsError}
        reportsLoading={reportsLoading}
        updatedAt={updatedAt}
      />
      <div data-testid="home-secondary-stack">
        <YourReportCard error={reportsError} loading={reportsLoading} reports={reports} />
        <NearbyCard
          error={incidentsError}
          incidents={incidents}
          loading={incidentsLoading}
          {...(onRetryNearby ? { onRetry: onRetryNearby } : {})}
          {...(userLocation ? { userLocation } : {})}
        />
      </div>
    </>
  )
}

function HomeBriefIncidentSource({
  onRetryNearby,
  ...props
}: HomeBriefModulesProps & { onRetryNearby: () => void; userLocation: LocationPoint }) {
  const { incidents, loading, error } = usePublicIncidents({ municipality: props.municipality })

  return (
    <HomeBriefContent
      {...props}
      hasKnownLocation={true}
      incidents={incidents}
      incidentsError={error}
      incidentsLoading={loading}
      onRetryNearby={onRetryNearby}
    />
  )
}

function HomeBriefModules(props: HomeBriefModulesProps) {
  const [retryKey, setRetryKey] = useState(0)

  if (!props.userLocation) {
    return (
      <HomeBriefContent
        {...props}
        hasKnownLocation={false}
        incidents={[]}
        incidentsError={null}
        incidentsLoading={false}
      />
    )
  }

  return (
    <HomeBriefIncidentSource
      key={retryKey}
      {...props}
      onRetryNearby={() => {
        setRetryKey((value) => value + 1)
      }}
      userLocation={props.userLocation}
    />
  )
}

export function HomeTab() {
  const navigate = useNavigate()
  const [now] = useState(() => Date.now())
  const {
    alerts,
    alertsError,
    alertsLoading,
    reports,
    reportsError,
    reportsLoading,
    unreadAlertCount,
  } = useHomeData()
  const locationLabel = reports.find((report) =>
    report.municipalityLabel?.trim(),
  )?.municipalityLabel
  const knownLocation = reports.find(
    (report) => Number.isFinite(report.lat) && Number.isFinite(report.lng),
  )
  const userLocation =
    knownLocation && locationLabel ? { lat: knownLocation.lat, lng: knownLocation.lng } : undefined
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

        <HomeBriefModules
          alerts={alerts}
          alertsError={alertsError}
          alertsLoading={alertsLoading}
          municipality={locationLabel ?? ''}
          reports={reports}
          reportsError={reportsError}
          reportsLoading={reportsLoading}
          updatedAt={updatedAt > 0 ? updatedAt : now}
          {...(locationLabel ? { locationLabel } : {})}
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
