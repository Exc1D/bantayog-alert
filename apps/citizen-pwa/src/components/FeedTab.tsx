import { useEffect, useMemo, useState, type SyntheticEvent } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Flag,
  Info,
  MapPin,
  Send,
  ShieldCheck,
  User,
} from 'lucide-react'
import { CAMARINES_NORTE_MUNICIPALITIES } from '@bantayog/shared-validators'
import { useSituationUpdates } from '../hooks/useSituationUpdates.js'
import { useOnlineStatus } from '../hooks/useOnlineStatus.js'
import { hasFirebaseConfig } from '../services/firebase.js'
import {
  createSituationUpdate,
  reportSituationUpdate,
  type SituationCondition,
  type SituationHazardType,
  type SituationUpdate,
} from '../services/situation-updates.js'

function timeAgo(timestamp: number, now = Date.now()): string {
  const minutes = Math.floor((now - timestamp) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${String(minutes)}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${String(hours)}h ago`
  return `${String(Math.floor(hours / 24))}d ago`
}

function locationLabel(update: SituationUpdate): string {
  return `${update.barangayLabel ? `${update.barangayLabel}, ` : ''}${update.municipalityLabel}`
}

function humanize(value: string): string {
  const words = value.split('_').join(' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function plural(count: number, singular: string, pluralLabel: string): string {
  return `${String(count)} ${count === 1 ? singular : pluralLabel}`
}

function feedStatusLabel({
  loading,
  error,
  isOnline,
  lastUpdatedAt,
  now,
}: {
  loading: boolean
  error: unknown
  isOnline: boolean
  lastUpdatedAt: number | null
  now: number
}): string {
  if (loading) return 'Connecting to feed'
  if (error) return 'Feed not updating'
  if (!isOnline) return 'Offline. Showing saved feed view.'
  if (lastUpdatedAt) return `Updated ${timeAgo(lastUpdatedAt, now)}`
  return 'Waiting for live updates'
}

function missingComposerFields({
  municipalityLabel,
  hazardType,
  condition,
  body,
}: {
  municipalityLabel: string
  hazardType: SituationHazardType | ''
  condition: SituationCondition | ''
  body: string
}): string[] {
  const missing: string[] = []
  if (!municipalityLabel) missing.push('municipality')
  if (!hazardType) missing.push('situation type')
  if (!condition) missing.push('condition')
  if (body.trim().length < 3) missing.push('a 3+ character update')
  return missing
}

function sentenceList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')}, and ${items.at(-1) ?? ''}`
}

const HAZARD_OPTIONS: { value: SituationHazardType; label: string }[] = [
  { value: 'typhoon', label: 'Typhoon' },
  { value: 'flood', label: 'Flood' },
  { value: 'storm_surge', label: 'Storm surge' },
  { value: 'landslide', label: 'Landslide' },
  { value: 'earthquake', label: 'Earthquake' },
  { value: 'fire', label: 'Fire' },
  { value: 'medical', label: 'Medical' },
  { value: 'power_outage', label: 'Power outage' },
  { value: 'road_blocked', label: 'Road blocked' },
  { value: 'other', label: 'Other' },
]

const CONDITION_OPTIONS: { value: SituationCondition; label: string }[] = [
  { value: 'safe', label: 'Safe' },
  { value: 'light_rain', label: 'Light rain' },
  { value: 'heavy_rain', label: 'Heavy rain' },
  { value: 'flooding', label: 'Flooding' },
  { value: 'strong_wind', label: 'Strong wind' },
  { value: 'needs_help', label: 'Needs help' },
  { value: 'blocked_road', label: 'Blocked road' },
  { value: 'power_outage', label: 'Power outage' },
  { value: 'other', label: 'Other' },
]

const SITUATION_DRAFT_KEY = 'bantayog_situation_update_draft'

interface SituationDraft {
  municipalityLabel: string
  barangayLabel: string
  hazardType: SituationHazardType | ''
  condition: SituationCondition | ''
  body: string
}

function loadSituationDraft(): SituationDraft | null {
  try {
    const raw = localStorage.getItem(SITUATION_DRAFT_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const data = parsed as Record<string, unknown>
    if (
      typeof data.municipalityLabel !== 'string' ||
      typeof data.barangayLabel !== 'string' ||
      typeof data.hazardType !== 'string' ||
      typeof data.condition !== 'string' ||
      typeof data.body !== 'string'
    ) {
      return null
    }
    const isValidMunicipality =
      data.municipalityLabel === '' ||
      CAMARINES_NORTE_MUNICIPALITIES.some(
        (municipality) => municipality.label === data.municipalityLabel,
      )
    const isValidHazard =
      data.hazardType === '' || HAZARD_OPTIONS.some((option) => option.value === data.hazardType)
    const isValidCondition =
      data.condition === '' || CONDITION_OPTIONS.some((option) => option.value === data.condition)
    if (
      !isValidMunicipality ||
      !isValidHazard ||
      !isValidCondition ||
      data.barangayLabel.length > 80 ||
      data.body.length > 500
    ) {
      return null
    }
    return data as unknown as SituationDraft
  } catch (err: unknown) {
    console.warn('Failed to load situation update draft', err)
    return null
  }
}

function saveSituationDraft(draft: SituationDraft): void {
  try {
    localStorage.setItem(SITUATION_DRAFT_KEY, JSON.stringify(draft))
  } catch (err: unknown) {
    console.warn('Failed to save situation update draft', err)
  }
}

function initialMunicipality(draft: SituationDraft | null, selectedMunicipality: string): string {
  if (!draft?.municipalityLabel) return selectedMunicipality
  return draft.municipalityLabel
}

const MUNICIPALITY_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  ...[...CAMARINES_NORTE_MUNICIPALITIES]
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((m) => ({ value: m.label, label: m.label })),
]

const POST_MUNICIPALITY_OPTIONS = MUNICIPALITY_OPTIONS.filter((option) => option.value)
const PUBLIC_REPORT_FEED_WINDOW_MS = 24 * 60 * 60 * 1000
const MUNICIPALITY_LABEL_TO_ID = Object.fromEntries(
  CAMARINES_NORTE_MUNICIPALITIES.map((municipality) => [municipality.label, municipality.id]),
)

function CommunityPulse({ updates }: { updates: SituationUpdate[] }) {
  const needsHelpCount = updates.filter((update) => update.condition === 'needs_help').length
  const areaCount = new Set(updates.map((update) => update.municipalityLabel)).size

  return (
    <section
      aria-label="Community pulse"
      className="mx-3 mb-2 rounded-xl border border-surface-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
          <ShieldCheck size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <h2 className="m-0 text-sm font-bold text-surface-900">Community Pulse</h2>
            <span className="text-[11px] font-semibold text-success-600">Live sharing</span>
          </div>
          <p className="m-0 mt-1 text-xs leading-relaxed text-surface-500">
            Situation updates from citizens across the selected area.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div>
              <p className="m-0 text-base font-bold text-surface-900">
                {plural(updates.length, 'update', 'updates')}
              </p>
              <p className="m-0 text-[10px] text-surface-500">shared</p>
            </div>
            <div>
              <p className="m-0 text-base font-bold text-danger-600">
                {plural(needsHelpCount, 'needs help', 'needs help')}
              </p>
              <p className="m-0 text-[10px] text-surface-500">needs attention</p>
            </div>
            <div>
              <p className="m-0 text-base font-bold text-brand-600">
                {plural(areaCount, 'area', 'areas')}
              </p>
              <p className="m-0 text-[10px] text-surface-500">active</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function FeedStatus({
  loading,
  error,
  isOnline,
  lastUpdatedAt,
  now,
  onRetry,
}: {
  loading: boolean
  error: unknown
  isOnline: boolean
  lastUpdatedAt: number | null
  now: number
  onRetry: () => void
}) {
  const label = feedStatusLabel({ loading, error, isOnline, lastUpdatedAt, now })
  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-2 flex min-h-11 items-center justify-between gap-3 rounded-lg bg-surface-100 px-3 text-xs font-semibold text-surface-600"
    >
      <span>{label}</span>
      {error ? (
        <button
          type="button"
          onClick={onRetry}
          className="min-h-9 rounded-full border border-surface-200 bg-white px-3 text-xs font-bold text-surface-800"
        >
          Try again
        </button>
      ) : null}
    </div>
  )
}

function SituationComposer({
  firebaseConfigured,
  isOnline,
  selectedMunicipality,
  onPosted,
  onClose,
}: {
  firebaseConfigured: boolean
  isOnline: boolean
  selectedMunicipality: string
  onPosted: (message: string) => void
  onClose: () => void
}) {
  const [savedDraft] = useState(loadSituationDraft)
  const [municipalityLabel, setMunicipalityLabel] = useState(
    initialMunicipality(savedDraft, selectedMunicipality),
  )
  const [barangayLabel, setBarangayLabel] = useState(savedDraft?.barangayLabel ?? '')
  const [hazardType, setHazardType] = useState<SituationHazardType | ''>(
    savedDraft?.hazardType ?? '',
  )
  const [condition, setCondition] = useState<SituationCondition | ''>(savedDraft?.condition ?? '')
  const [body, setBody] = useState(savedDraft?.body ?? '')
  const [submitState, setSubmitState] = useState<'idle' | 'posting' | 'posted' | 'error'>('idle')
  const trimmedBody = body.trim()
  const missingFields = missingComposerFields({ municipalityLabel, hazardType, condition, body })
  const canPost =
    firebaseConfigured &&
    isOnline &&
    municipalityLabel !== '' &&
    hazardType !== '' &&
    condition !== '' &&
    trimmedBody.length >= 3 &&
    submitState !== 'posting'

  useEffect(() => {
    saveSituationDraft({ municipalityLabel, barangayLabel, hazardType, condition, body })
  }, [municipalityLabel, barangayLabel, hazardType, condition, body])

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!canPost) return
    setSubmitState('posting')
    try {
      const trimmedBarangay = barangayLabel.trim()
      await createSituationUpdate({
        municipalityId: MUNICIPALITY_LABEL_TO_ID[municipalityLabel] ?? municipalityLabel,
        municipalityLabel,
        ...(trimmedBarangay ? { barangayLabel: trimmedBarangay } : {}),
        hazardType,
        condition,
        body: trimmedBody,
      })
      setBody('')
      setBarangayLabel('')
      setSubmitState('posted')
      onPosted('Update posted')
    } catch (err: unknown) {
      console.error('Failed to post situation update', err)
      setSubmitState('error')
      onPosted('Could not post update')
    }
  }

  return (
    <form
      onSubmit={(event) => {
        void handleSubmit(event)
      }}
      className="mx-3 mb-2 rounded-xl border border-surface-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-surface-900 text-white flex items-center justify-center shrink-0">
          <MapPin size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-sm font-bold text-surface-900">Share a quick local update</h2>
          <p className="m-0 mt-1 text-xs text-surface-500">
            Help neighbors compare conditions during disasters.
          </p>
          <div className="m-0 mt-2 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-[11px] font-medium text-brand-700">
              <Info size={12} /> Community only — not for emergencies
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-surface-100 px-2 py-1 text-[11px] font-medium text-surface-600">
              <ShieldCheck size={12} /> Public — no personal info
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="text-[11px] font-semibold text-surface-600">
          Municipality
          <select
            aria-label="Municipality"
            value={municipalityLabel}
            onChange={(event) => {
              setMunicipalityLabel(event.target.value)
            }}
            className="mt-1 h-11 w-full rounded-lg border border-surface-200 bg-white px-2 text-sm text-surface-900"
          >
            <option value="">Select municipality</option>
            {POST_MUNICIPALITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11px] font-semibold text-surface-600">
          Barangay
          <input
            aria-label="Barangay (optional)"
            value={barangayLabel}
            onChange={(event) => {
              setBarangayLabel(event.target.value)
            }}
            placeholder="Optional"
            maxLength={80}
            className="mt-1 h-11 w-full rounded-lg border border-surface-200 bg-white px-3 text-sm text-surface-900"
          />
        </label>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="text-[11px] font-semibold text-surface-600">
          Situation type
          <select
            aria-label="Situation type"
            value={hazardType}
            onChange={(event) => {
              setHazardType(event.target.value as SituationHazardType)
            }}
            className="mt-1 h-11 w-full rounded-lg border border-surface-200 bg-white px-2 text-sm text-surface-900"
          >
            <option value="">Select type</option>
            {HAZARD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11px] font-semibold text-surface-600">
          Current condition
          <select
            aria-label="Current condition"
            value={condition}
            onChange={(event) => {
              setCondition(event.target.value as SituationCondition)
            }}
            className="mt-1 h-11 w-full rounded-lg border border-surface-200 bg-white px-2 text-sm text-surface-900"
          >
            <option value="">Select condition</option>
            {CONDITION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-3 block text-[11px] font-semibold text-surface-600">
        Update
        <textarea
          aria-label="Share situation update"
          value={body}
          onChange={(event) => {
            setBody(event.target.value.slice(0, 500))
            if (submitState !== 'posting') setSubmitState('idle')
          }}
          placeholder="Roads clear in Labo, light rain only..."
          rows={3}
          className="mt-1 w-full resize-none rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm leading-relaxed text-surface-900"
        />
      </label>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span className="text-[11px] text-surface-500">{String(trimmedBody.length)}/500</span>
        {!isOnline ? (
          <span className="text-[11px] font-medium text-warning-600">
            Reconnect to post. Saved on this phone until posted.
          </span>
        ) : missingFields.length > 0 ? (
          <span className="text-[11px] font-medium text-surface-500">
            To post, add {sentenceList(missingFields)}.
          </span>
        ) : (
          <span className="text-[11px] font-medium text-success-600">Ready to post publicly.</span>
        )}
        {!firebaseConfigured && (
          <span className="text-[11px] font-medium text-warning-600">
            Live sharing unavailable here.
          </span>
        )}
        <button
          type="button"
          onClick={onClose}
          className="ml-auto min-h-11 rounded-full border-none bg-transparent px-3 text-sm font-semibold text-surface-600"
        >
          Close
        </button>
        <button
          type="submit"
          disabled={!canPost}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border-none bg-brand-600 px-4 text-sm font-bold text-white disabled:bg-surface-200 disabled:text-surface-500"
        >
          <Send size={15} />
          {submitState === 'posting' ? 'Posting' : 'Post update'}
        </button>
      </div>
    </form>
  )
}

function FeedCard({
  update,
  onReport,
  reporting,
  position,
  setSize,
}: {
  update: SituationUpdate
  onReport: () => void
  reporting: boolean
  position: number
  setSize: number
}) {
  const hazardLabel = humanize(update.hazardType)
  const conditionLabel = humanize(update.condition)
  const location = locationLabel(update)
  const headingId = `feed-post-${update.id}`
  const needsHelp = update.condition === 'needs_help'

  return (
    <article
      aria-labelledby={headingId}
      aria-posinset={position}
      aria-setsize={setSize}
      className="bg-white rounded-xl mx-3 my-2 overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-surface-100 motion-fade-in card-hover"
    >
      <div className="flex items-start gap-3 p-4 pb-2">
        <span
          aria-hidden="true"
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-brand-50 text-brand-600"
        >
          <AlertTriangle size={18} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start gap-2">
            <div className="min-w-0">
              <p className="m-0 font-semibold text-surface-900 text-sm leading-snug">
                Citizen update
              </p>
              <p className="mt-0.5 mb-0 text-xs text-surface-500 flex items-center gap-1">
                <span>{timeAgo(update.createdAt)}</span>
                <span aria-hidden="true">·</span>
                <MapPin size={11} className="inline flex-shrink-0" />
                <span className="truncate">{location}</span>
              </p>
            </div>
            <span className="flex-shrink-0 text-xs text-surface-500">Unverified</span>
          </div>
        </div>
      </div>

      <div className="px-4 pb-3">
        <h2 id={headingId} className="m-0 text-base font-bold leading-snug text-surface-900">
          {hazardLabel} update in {location}
        </h2>
        <p className="m-0 mt-2 whitespace-pre-wrap text-sm leading-relaxed text-surface-700">
          {update.body}
        </p>
      </div>

      <div className="border-t border-surface-100 px-4 py-2 flex items-center gap-2">
        <span
          className={
            needsHelp
              ? 'inline-flex items-center gap-1 rounded-full bg-danger-50 px-2 py-0.5 text-xs font-semibold text-danger-700'
              : 'inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700'
          }
        >
          {needsHelp ? <AlertTriangle size={13} /> : <CheckCircle2 size={13} />}
          {conditionLabel}
        </span>
        <span className="rounded-full bg-surface-100 px-2 py-0.5 text-xs font-semibold text-surface-600">
          {hazardLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 border-t border-surface-100">
        <div className="flex min-h-11 items-center justify-center gap-1 text-xs font-semibold text-surface-500">
          <Info size={14} />
          Area context
        </div>
        <button
          type="button"
          onClick={onReport}
          disabled={reporting}
          aria-label={`Report post ${hazardLabel} update in ${location}`}
          className="inline-flex min-h-11 items-center justify-center gap-1 bg-white border-none border-l border-surface-100 text-sm font-semibold text-surface-600 active:bg-surface-50 cursor-pointer disabled:text-surface-400"
        >
          <Flag size={14} />
          {reporting ? 'Reporting' : 'Report post'}
        </button>
      </div>
    </article>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl mx-3 my-2 overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.05)] w-[calc(100%-1.5rem)]">
      <div className="p-4 flex gap-3">
        <div className="w-10 h-10 rounded-full shimmer-gradient flex-shrink-0" />
        <div className="flex-1">
          <div className="h-3.5 w-[55%] rounded shimmer-gradient mb-2" />
          <div className="h-3 w-[40%] rounded shimmer-gradient mb-3" />
          <div className="h-4 w-14 rounded-full shimmer-gradient" />
        </div>
      </div>
    </div>
  )
}

export function FeedTab() {
  const [filters, setFilters] = useState({ municipality: '' })
  const [notice, setNotice] = useState<string | null>(null)
  const [reportingId, setReportingId] = useState<string | null>(null)
  const [isComposerOpen, setIsComposerOpen] = useState(false)
  const [feedClock, setFeedClock] = useState(() => Date.now())
  const firebaseConfigured = hasFirebaseConfig()
  const { navigatorOnline } = useOnlineStatus()
  const { updates, loading, error, lastUpdatedAt, retry } = useSituationUpdates(filters)
  const visibleUpdates = useMemo(
    () => updates.filter((update) => feedClock - update.createdAt <= PUBLIC_REPORT_FEED_WINDOW_MS),
    [feedClock, updates],
  )

  useEffect(() => {
    const interval = setInterval(() => {
      setFeedClock(Date.now())
    }, 60_000)
    return () => {
      clearInterval(interval)
    }
  }, [])

  async function handleReport(updateId: string): Promise<void> {
    if (reportingId) return
    setReportingId(updateId)
    try {
      await reportSituationUpdate(updateId, 'Needs review')
      setNotice('Post reported for review')
    } catch (err: unknown) {
      console.error('Failed to report situation update', err)
      setNotice('Could not report post')
    } finally {
      setReportingId(null)
    }
  }

  return (
    <div className="h-full overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
      <div className="sticky top-0 z-20 bg-surface-50/90 px-4 py-3 flex flex-col border-b border-surface-200">
        <div className="flex items-center justify-between">
          <h1 className="text-[20px] font-bold text-surface-900 m-0">Situation Feed</h1>
        </div>
        <div
          role="group"
          aria-label="Filter by municipality"
          className="flex gap-2 overflow-x-auto pb-1 mt-3 no-scrollbar"
        >
          {MUNICIPALITY_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={filters.municipality === value}
              onClick={() => {
                setFilters({ municipality: value })
              }}
              className={
                filters.municipality === value
                  ? 'bg-surface-900 text-white rounded-full px-3 py-1.5 min-h-11 text-xs font-medium flex-shrink-0 border-none cursor-pointer whitespace-nowrap'
                  : 'bg-surface-100 text-surface-600 rounded-full px-3 py-1.5 min-h-11 text-xs font-medium flex-shrink-0 border-none cursor-pointer whitespace-nowrap'
              }
            >
              {label}
            </button>
          ))}
        </div>
        <FeedStatus
          loading={loading}
          error={error}
          isOnline={navigatorOnline}
          lastUpdatedAt={lastUpdatedAt}
          now={feedClock}
          onRetry={retry}
        />
      </div>

      <div className="py-3 pb-24">
        {!isComposerOpen ? (
          <button
            type="button"
            onClick={() => {
              setIsComposerOpen(true)
            }}
            className="mx-3 mb-3 flex min-h-14 w-[calc(100%-1.5rem)] items-center gap-3 rounded-xl border border-surface-200 bg-white px-4 text-left shadow-[0_1px_2px_rgba(0,0,0,0.05)] active:scale-[0.98] transition-transform"
          >
            <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
              <User size={18} className="text-brand-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-surface-900 m-0">
                What&apos;s happening? Share an update
              </p>
            </div>
            <ChevronRight size={18} className="text-surface-400 shrink-0" />
          </button>
        ) : null}

        {isComposerOpen ? (
          <SituationComposer
            key={filters.municipality || 'all'}
            firebaseConfigured={firebaseConfigured}
            isOnline={navigatorOnline}
            selectedMunicipality={filters.municipality}
            onPosted={setNotice}
            onClose={() => {
              setIsComposerOpen(false)
            }}
          />
        ) : null}

        {notice && (
          <div
            role="status"
            className="mx-3 mb-2 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700"
          >
            {notice}
          </div>
        )}

        {loading ? (
          <div role="status" aria-live="polite">
            <span className="sr-only">Loading situation updates</span>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : error ? (
          <div
            role="alert"
            className="mx-3 mt-2 p-4 rounded-xl bg-red-100 text-red-800 text-center text-sm"
          >
            <p className="m-0 mb-1 font-bold">Could not load situation updates</p>
            <p className="m-0 text-xs">Hindi makuha ang mga update. Subukan ulit.</p>
          </div>
        ) : visibleUpdates.length === 0 ? (
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="flex flex-col items-center justify-center min-h-[38vh] text-surface-500 px-4"
          >
            <span className="text-surface-400 mb-3">
              <Info size={40} />
            </span>
            <p className="m-0 mb-1 font-bold text-surface-900 text-[15px]">No situation updates</p>
            <p className="m-0 text-[13px] text-surface-600 text-center">
              {filters.municipality
                ? `No posts for ${filters.municipality} yet. Share what conditions are like there if it is safe.`
                : 'Be the first to share what conditions are like in your area.'}
              <span className="block text-xs text-surface-500 mt-1 italic">
                Magbahagi ng maikling update kung ligtas gawin.
              </span>
            </p>
          </div>
        ) : (
          <>
            <CommunityPulse updates={visibleUpdates} />
            <div role="feed" aria-label="Community situation feed">
              {visibleUpdates.map((update, index) => (
                <FeedCard
                  key={update.id}
                  update={update}
                  position={index + 1}
                  setSize={visibleUpdates.length}
                  reporting={reportingId === update.id}
                  onReport={() => {
                    void handleReport(update.id)
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
