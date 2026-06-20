import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { AlertDoc } from '@bantayog/shared-types'
import type { PublicIncident } from '../MapTab/types.js'
import {
  getFreshnessPresentation,
  getHazardTypePresentation,
  getSeverityPresentation,
  type StatusIcon,
} from '../../utils/status-registry.js'

const SEVERITY_ORDER: Record<AlertDoc['severity'], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
}

interface HomeHeroProps {
  alerts: AlertDoc[]
  alertsError: Error | null
  alertsLoading: boolean
  hasKnownLocation: boolean
  incidents: PublicIncident[]
  incidentsError: unknown
  incidentsLoading: boolean
  locationLabel?: string
  reportsError: string | null
  reportsLoading: boolean
  updatedAt: number
}

interface StatusBadgeProps {
  ariaLabel: string
  background?: string
  color: string
  Icon: StatusIcon
  label: string
}

interface HeroCardProps {
  badge: ReactNode
  bodyClassName?: string
  children?: ReactNode
  className: string
  description: ReactNode
  style?: CSSProperties
  title: ReactNode
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural
}

function formatCaughtUpThrough(timestamp: number): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp))
}

function displayPlace(locationLabel: string | undefined): string {
  const trimmed = locationLabel?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : 'This area'
}

function selectHeroAlert(alerts: AlertDoc[]): AlertDoc | null {
  return (
    [...alerts].sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.publishedAt - a.publishedAt,
    )[0] ?? null
  )
}

function selectPrimaryIncident(incidents: PublicIncident[]): PublicIncident | null {
  return [...incidents].sort((a, b) => b.submittedAt - a.submittedAt)[0] ?? null
}

function StatusBadge({ ariaLabel, background, color, Icon, label }: StatusBadgeProps) {
  return (
    <span
      aria-label={ariaLabel}
      className="inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold"
      style={{ backgroundColor: background ?? 'var(--surface-100)', color }}
    >
      <Icon size={14} aria-hidden="true" />
      {label}
    </span>
  )
}

function HomeHeroShell({ children }: { children: ReactNode }) {
  return (
    <section
      data-home-slot="Your local brief"
      data-testid="home-hero"
      className="min-h-40 border-b border-surface-200 px-5 py-5"
    >
      <p className="m-0 text-xs font-bold uppercase tracking-[0.08em] text-surface-600">
        Your local brief
      </p>
      {children}
    </section>
  )
}

function HeroCard({
  badge,
  bodyClassName = 'text-surface-600',
  children,
  className,
  description,
  style,
  title,
}: HeroCardProps) {
  return (
    <HomeHeroShell>
      <div className={`mt-4 rounded-3xl border p-4 ${className}`} style={style}>
        {badge}
        <h2 className="mt-3 text-2xl font-black leading-tight text-surface-900">{title}</h2>
        <p className={`mt-2 text-sm leading-relaxed ${bodyClassName}`}>{description}</p>
        {children}
      </div>
    </HomeHeroShell>
  )
}

function LoadingHero() {
  const freshness = getFreshnessPresentation('unavailable')
  return (
    <HeroCard
      badge={
        <StatusBadge
          ariaLabel={`Local brief status: ${freshness.label}`}
          color={freshness.colorToken}
          Icon={freshness.icon}
          label={freshness.label}
        />
      }
      className="border-surface-200 bg-white"
      title="Loading local brief"
      description="Checking official alerts and nearby reports before we call the area calm."
    />
  )
}

function ErrorHero() {
  const freshness = getFreshnessPresentation('stale')
  return (
    <HeroCard
      badge={
        <StatusBadge
          ariaLabel={`Local brief status: ${freshness.label}`}
          background="var(--warning-400)"
          color="var(--surface-900)"
          Icon={freshness.icon}
          label={freshness.label}
        />
      }
      className="border-warning-400/30 bg-white"
      title="Couldn't refresh your local brief"
      description="We will not label the area calm until alert and incident sources respond."
    />
  )
}

function UnknownAreaHero() {
  const freshness = getFreshnessPresentation('unavailable')
  return (
    <HeroCard
      badge={
        <StatusBadge
          ariaLabel={`Local brief status: ${freshness.label}`}
          color={freshness.colorToken}
          Icon={freshness.icon}
          label={freshness.label}
        />
      }
      className="border-surface-200 bg-white"
      title="Local brief needs a known area"
      description="Your report card below unlocks nearby context once a report has a confirmed location."
    />
  )
}

function AlertHero({ alert }: { alert: AlertDoc }) {
  const severity = getSeverityPresentation(alert.severity)
  return (
    <HeroCard
      badge={
        <StatusBadge
          ariaLabel={`Official alert severity: ${severity.label}`}
          background={severity.bg}
          color={severity.fg}
          Icon={severity.icon}
          label={severity.label}
        />
      }
      bodyClassName="text-surface-700"
      className="shadow-sm"
      description={alert.body}
      style={{
        background: `linear-gradient(135deg, ${severity.bg}, #fff)`,
        borderColor: severity.fg,
      }}
      title={alert.title}
    >
      <Link
        to="/alerts"
        className="mt-4 inline-flex rounded-full bg-surface-900 px-4 py-2 text-sm font-bold text-white active:bg-surface-700"
      >
        View official alert
      </Link>
    </HeroCard>
  )
}

function IncidentHero({ incidents }: { incidents: PublicIncident[] }) {
  const primary = selectPrimaryIncident(incidents)
  if (!primary) return null

  const hazard = getHazardTypePresentation(primary.reportType)
  const severity = getSeverityPresentation(primary.severity)
  const count = incidents.length

  return (
    <HeroCard
      badge={
        <div className="flex flex-wrap gap-2">
          <StatusBadge
            ariaLabel={`Nearby hazard: ${hazard.label}`}
            color={hazard.colorToken}
            Icon={hazard.icon}
            label={hazard.label}
          />
          <StatusBadge
            ariaLabel={`Nearby severity: ${severity.label}`}
            background={severity.bg}
            color={severity.fg}
            Icon={severity.icon}
            label={severity.label}
          />
        </div>
      }
      bodyClassName="text-surface-700"
      className="border-brand-600/20 bg-brand-50 shadow-sm"
      description={`Latest: ${hazard.label} in ${primary.municipalityLabel}. Check the map before you move.`}
      title={
        <>
          {count} {pluralize(count, 'incident', 'incidents')} reported nearby
        </>
      }
    >
      <Link
        to="/map"
        className="mt-4 inline-flex rounded-full bg-brand-600 px-4 py-2 text-sm font-bold text-white active:bg-brand-700"
      >
        Open map
      </Link>
    </HeroCard>
  )
}

function CalmHero({ locationLabel, updatedAt }: { locationLabel?: string; updatedAt: number }) {
  const freshness = getFreshnessPresentation('empty_confirmed')
  const place = displayPlace(locationLabel)
  return (
    <HeroCard
      badge={
        <StatusBadge
          ariaLabel={`Local brief status: ${freshness.label}`}
          background="var(--brand-50)"
          color={freshness.colorToken}
          Icon={freshness.icon}
          label={freshness.label}
        />
      }
      className="border-brand-600/15 bg-white shadow-sm"
      title={`${place} is calm today`}
      description={`You're caught up through ${formatCaughtUpThrough(updatedAt)}`}
    />
  )
}

export function HomeHero({
  alerts,
  alertsError,
  alertsLoading,
  hasKnownLocation,
  incidents,
  incidentsError,
  incidentsLoading,
  locationLabel,
  reportsError,
  reportsLoading,
  updatedAt,
}: HomeHeroProps) {
  if (alertsLoading) return <LoadingHero />
  if (alertsError) return <ErrorHero />

  const alert = selectHeroAlert(alerts)
  if (alert) return <AlertHero alert={alert} />

  if (reportsLoading || incidentsLoading) return <LoadingHero />
  if (reportsError || incidentsError) return <ErrorHero />
  if (!hasKnownLocation) return <UnknownAreaHero />
  if (incidents.length > 0) return <IncidentHero incidents={incidents} />

  return <CalmHero {...(locationLabel ? { locationLabel } : {})} updatedAt={updatedAt} />
}
