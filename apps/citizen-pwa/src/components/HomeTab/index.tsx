import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import type { AlertDoc } from '@bantayog/shared-types'
import { usePublicIncidents } from '../../hooks/usePublicIncidents.js'
import { useReducedMotion } from '../../hooks/useReducedMotion.js'
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
  isEmergency: boolean
  locationLabel?: string
  municipality: string
  prefersReducedMotion: boolean
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

const HOME_EASE = [0.2, 0, 0, 1] as const

function heroMotionProps(prefersReducedMotion: boolean, isEmergency: boolean) {
  if (prefersReducedMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      transition: { duration: 0 },
    }
  }
  if (isEmergency) {
    return {
      initial: { opacity: 0, scale: 0.985 },
      animate: { opacity: 1, scale: 1 },
      transition: { duration: 0.22, ease: HOME_EASE },
    }
  }
  return {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3, ease: HOME_EASE, delay: 0.1 },
  }
}

function secondaryMotionProps(prefersReducedMotion: boolean, isEmergency: boolean, delay: number) {
  if (prefersReducedMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      transition: { duration: 0 },
    }
  }
  if (isEmergency) {
    return {
      initial: { opacity: 0, y: 0 },
      animate: { opacity: 0.68, y: 0 },
      transition: { duration: 0.2, ease: HOME_EASE, delay: 0.08 },
    }
  }
  return {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { type: 'spring' as const, stiffness: 260, damping: 30, delay },
    whileTap: { scale: 0.97 },
  }
}

function HomeBriefContent({
  alerts,
  alertsError,
  alertsLoading,
  hasKnownLocation,
  incidents,
  incidentsError,
  incidentsLoading,
  isEmergency,
  locationLabel,
  onRetryNearby,
  prefersReducedMotion,
  reports,
  reportsError,
  reportsLoading,
  updatedAt,
  userLocation,
}: HomeBriefContentProps) {
  return (
    <>
      <motion.div
        data-testid="home-motion-hero"
        {...heroMotionProps(prefersReducedMotion, isEmergency)}
      >
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
      </motion.div>
      <div data-testid="home-secondary-stack">
        <motion.div
          data-testid="home-motion-report"
          {...secondaryMotionProps(prefersReducedMotion, isEmergency, 0.16)}
        >
          <YourReportCard error={reportsError} loading={reportsLoading} reports={reports} />
        </motion.div>
        <motion.div
          data-testid="home-motion-nearby"
          {...secondaryMotionProps(prefersReducedMotion, isEmergency, 0.21)}
        >
          <NearbyCard
            error={incidentsError}
            incidents={incidents}
            loading={incidentsLoading}
            {...(onRetryNearby ? { onRetry: onRetryNearby } : {})}
            {...(userLocation ? { userLocation } : {})}
          />
        </motion.div>
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
  const prefersReducedMotion = useReducedMotion()
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
  const isEmergency = alerts.length > 0

  const openAlerts = () => {
    void navigate('/alerts')
  }

  return (
    <div data-testid="home-tab" className="h-full overflow-y-auto bg-surface-50">
      <div className="mx-auto w-full max-w-lg">
        <HomeHeader
          isEmergency={isEmergency}
          now={now}
          onOpenAlerts={openAlerts}
          prefersReducedMotion={prefersReducedMotion}
          unreadAlertCount={unreadAlertCount}
          {...(locationLabel ? { locationLabel } : {})}
          {...(updatedAt > 0 ? { updatedAt } : {})}
        />

        <HomeBriefModules
          alerts={alerts}
          alertsError={alertsError}
          alertsLoading={alertsLoading}
          isEmergency={isEmergency}
          municipality={locationLabel ?? ''}
          prefersReducedMotion={prefersReducedMotion}
          reports={reports}
          reportsError={reportsError}
          reportsLoading={reportsLoading}
          updatedAt={updatedAt > 0 ? updatedAt : now}
          {...(locationLabel ? { locationLabel } : {})}
          {...(userLocation ? { userLocation } : {})}
        />

        <motion.section
          data-home-slot="Today's weather"
          className="min-h-24 border-b border-surface-200 px-5 py-5"
          {...secondaryMotionProps(prefersReducedMotion, isEmergency, 0.26)}
        >
          <p className="m-0 text-xs font-bold uppercase tracking-[0.08em] text-surface-600">
            Today&apos;s weather
          </p>
          <p className="mt-3 text-sm text-surface-600">Weather unavailable.</p>
        </motion.section>

        <motion.section
          data-home-slot="Emergency contacts"
          className="px-5 py-5"
          {...secondaryMotionProps(prefersReducedMotion, isEmergency, 0.31)}
        >
          <p className="m-0 text-sm font-semibold text-surface-600">Emergency contacts</p>
        </motion.section>
      </div>
    </div>
  )
}
