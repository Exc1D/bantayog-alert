import { Link } from 'react-router-dom'
import {
  getHazardTypePresentation,
  getOperationalStagePresentation,
  getSeverityPresentation,
} from '../../../utils/status-registry.js'
import type { MunicipalityContact } from '../../../hooks/useMunicipalityContact.js'
import type { MyReport, PublicIncident } from '../../MapTab/types.js'

interface LocationPoint {
  lat: number
  lng: number
}

interface YourReportCardProps {
  error?: unknown
  loading?: boolean
  onRetry?: () => void
  reports: MyReport[]
}

interface NearbyCardProps {
  error?: unknown
  incidents: PublicIncident[]
  loading: boolean
  onRetry?: () => void
  userLocation?: LocationPoint
}

interface EmergencyContactsCardProps {
  contact: MunicipalityContact
}

const REPORT_STAGE_BY_STATUS: Record<MyReport['status'], string> = {
  acknowledged: 'response_coordinated',
  assigned: 'response_coordinated',
  awaiting_verify: 'being_reviewed',
  cancelled: 'not_accepted',
  cancelled_false_report: 'not_accepted',
  closed: 'addressed',
  draft_inbox: 'saved',
  en_route: 'response_coordinated',
  merged_as_duplicate: 'not_accepted',
  new: 'received',
  on_scene: 'response_coordinated',
  queued: 'saved',
  rejected: 'not_accepted',
  reopened: 'being_reviewed',
  resolved: 'addressed',
  verified: 'being_reviewed',
}

const EARTH_RADIUS_KM = 6_371

function isKnownLocation(location: LocationPoint | undefined): location is LocationPoint {
  return Boolean(location && Number.isFinite(location.lat) && Number.isFinite(location.lng))
}

function latestReport(reports: MyReport[]): MyReport | null {
  return (
    [...reports].sort(
      (left, right) =>
        (right.lastStatusAt ?? right.submittedAt) - (left.lastStatusAt ?? left.submittedAt),
    )[0] ?? null
  )
}

function distanceKm(from: LocationPoint, to: LocationPoint): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180
  const deltaLat = toRadians(to.lat - from.lat)
  const deltaLng = toRadians(to.lng - from.lng)
  const startLat = toRadians(from.lat)
  const endLat = toRadians(to.lat)
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(deltaLng / 2) ** 2
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function distanceBand(km: number): string {
  if (km < 1) return 'Within 1 km'
  if (km < 5) return '1-5 km away'
  if (km < 15) return '5-15 km away'
  return '15+ km away'
}

function phoneHref(hotline: string): string | undefined {
  const normalized = hotline.replace(/[^\d+]/g, '')
  if (!/\d/.test(normalized)) return undefined
  return `tel:${normalized}`
}

function CardSkeleton({ label, minHeight }: { label: string; minHeight: string }) {
  return (
    <section
      data-home-slot={label}
      className={`${minHeight} border-b border-surface-200 px-5 py-5`}
    >
      <div className="h-3 w-28 rounded bg-surface-200" />
      <div className="mt-4 h-4 w-4/5 rounded bg-surface-200" />
      <div className="mt-2 h-4 w-3/5 rounded bg-surface-200" />
    </section>
  )
}

function RetryButton({ label, onRetry }: { label: string; onRetry?: () => void }) {
  if (!onRetry) return null
  return (
    <button
      type="button"
      onClick={onRetry}
      className="mt-3 rounded-full border border-surface-300 px-3 py-1.5 text-xs font-bold text-surface-700 active:bg-surface-100"
    >
      {label}
    </button>
  )
}

export function YourReportCard({ error, loading = false, onRetry, reports }: YourReportCardProps) {
  if (loading) return <CardSkeleton label="Your report" minHeight="min-h-28" />

  if (error) {
    return (
      <section
        data-home-slot="Your report"
        className="min-h-28 border-b border-surface-200 px-5 py-5"
      >
        <p className="m-0 text-xs font-bold uppercase tracking-[0.08em] text-surface-600">
          Your report
        </p>
        <p role="alert" className="mt-3 text-sm font-semibold text-danger-600">
          Couldn&apos;t load your report
        </p>
        <RetryButton label="Retry report" {...(onRetry ? { onRetry } : {})} />
      </section>
    )
  }

  const report = latestReport(reports)
  if (!report) {
    return (
      <section
        data-home-slot="Your report"
        className="min-h-28 border-b border-surface-200 px-5 py-5"
      >
        <p className="m-0 text-xs font-bold uppercase tracking-[0.08em] text-surface-600">
          Your report
        </p>
        <p className="mt-3 text-base font-bold text-surface-900">No active report</p>
        <p className="mt-1 text-sm text-surface-600">
          Start a report when you need help, then track it here.
        </p>
      </section>
    )
  }

  const stage = getOperationalStagePresentation(REPORT_STAGE_BY_STATUS[report.status])
  const StageIcon = stage.icon
  const hazard = getHazardTypePresentation(report.reportType)

  return (
    <section
      data-home-slot="Your report"
      className="min-h-28 border-b border-surface-200 px-5 py-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 text-xs font-bold uppercase tracking-[0.08em] text-surface-600">
            Your report
          </p>
          <p className="mt-2 truncate text-base font-bold text-surface-900">{hazard.label}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-surface-500">
            {report.publicRef}
          </p>
        </div>
        <span
          aria-label={`Report status: ${stage.label}`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface-100 px-3 py-1.5 text-xs font-bold"
          style={{ color: stage.colorToken }}
        >
          <StageIcon size={14} aria-hidden="true" />
          {stage.label}
        </span>
      </div>
      <Link
        to={`/track/${encodeURIComponent(report.publicRef)}`}
        className="mt-4 inline-flex rounded-full bg-surface-900 px-3 py-1.5 text-xs font-bold text-white active:bg-surface-700"
      >
        View report
      </Link>
    </section>
  )
}

export function NearbyCard({ error, incidents, loading, onRetry, userLocation }: NearbyCardProps) {
  if (loading) return <CardSkeleton label="Nearby" minHeight="min-h-28" />

  if (error) {
    return (
      <section data-home-slot="Nearby" className="min-h-28 border-b border-surface-200 px-5 py-5">
        <p className="m-0 text-xs font-bold uppercase tracking-[0.08em] text-surface-600">Nearby</p>
        <p role="alert" className="mt-3 text-sm font-semibold text-danger-600">
          Couldn&apos;t load nearby incidents
        </p>
        <RetryButton label="Retry nearby" {...(onRetry ? { onRetry } : {})} />
      </section>
    )
  }

  if (!isKnownLocation(userLocation)) {
    return (
      <section data-home-slot="Nearby" className="min-h-28 border-b border-surface-200 px-5 py-5">
        <p className="m-0 text-xs font-bold uppercase tracking-[0.08em] text-surface-600">Nearby</p>
        <p className="mt-3 text-sm text-surface-600">
          Nearby incidents appear after Home has a known report location.
        </p>
      </section>
    )
  }

  const nearby = incidents
    .filter((incident) => isKnownLocation(incident.publicLocation))
    .map((incident) => ({ incident, distance: distanceKm(userLocation, incident.publicLocation) }))
    .sort((left, right) => left.distance - right.distance)
    .slice(0, 3)

  if (nearby.length === 0) {
    return (
      <section data-home-slot="Nearby" className="min-h-28 border-b border-surface-200 px-5 py-5">
        <p className="m-0 text-xs font-bold uppercase tracking-[0.08em] text-surface-600">Nearby</p>
        <p className="mt-3 text-sm text-surface-600">No nearby public incidents right now.</p>
      </section>
    )
  }

  return (
    <section data-home-slot="Nearby" className="min-h-28 border-b border-surface-200 px-5 py-5">
      <p className="m-0 text-xs font-bold uppercase tracking-[0.08em] text-surface-600">Nearby</p>
      <ul className="mt-3 space-y-3">
        {nearby.map(({ incident, distance }) => {
          const hazard = getHazardTypePresentation(incident.reportType)
          const severity = getSeverityPresentation(incident.severity)
          const SeverityIcon = severity.icon
          const municipality = incident.municipalityLabel.trim()
          const mapHref =
            municipality === '' ? '/map' : `/map?municipality=${encodeURIComponent(municipality)}`
          return (
            <li key={incident.id}>
              <Link
                to={mapHref}
                aria-label={`View ${hazard.label} incidents${municipality === '' ? '' : ` in ${municipality}`} on map`}
                className="flex min-h-11 items-start justify-between gap-3 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              >
                <div className="min-w-0">
                  <p className="m-0 text-sm font-bold text-surface-900">{hazard.label}</p>
                  <p className="mt-1 text-xs font-semibold text-surface-500">
                    {distanceBand(distance)}
                  </p>
                </div>
                <span
                  aria-label={`Nearby severity: ${severity.label}`}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
                  style={{ backgroundColor: severity.bg, color: severity.fg }}
                >
                  <SeverityIcon size={13} aria-hidden="true" />
                  {severity.label}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function EmergencyContactsCard({ contact }: EmergencyContactsCardProps) {
  const href = phoneHref(contact.hotline)

  return (
    <section data-home-slot="Emergency contacts" className="min-h-24 px-5 py-5">
      <p className="m-0 text-xs font-bold uppercase tracking-[0.08em] text-surface-600">
        Emergency contacts
      </p>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 text-base font-bold text-surface-900">{contact.label}</p>
          <p className="mt-1 text-sm text-surface-600">{contact.hotline}</p>
        </div>
        {href ? (
          <a
            href={href}
            aria-label={`Call ${contact.label}`}
            className="shrink-0 rounded-full bg-brand-600 px-3 py-1.5 text-xs font-bold text-white active:bg-brand-700"
          >
            Call
          </a>
        ) : (
          <p role="alert" className="m-0 text-xs font-semibold text-danger-600">
            Hotline unavailable
          </p>
        )}
      </div>
    </section>
  )
}
