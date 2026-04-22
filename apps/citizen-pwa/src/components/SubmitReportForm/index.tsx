import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { normalizeMsisdn } from '@bantayog/shared-validators'
import type { ReportType, Severity } from '@bantayog/shared-types'
import { createDraft } from '../../services/submit-report.js'
import type { Draft } from '../../services/draft-store.js'
import { useSubmissionMachine } from '../../hooks/useSubmissionMachine.js'
import { OfflineBanner } from './OfflineBanner.js'
import { SmsFallbackButton } from './SmsFallbackButton.js'
import { StaleDraftBanner } from './StaleDraftBanner.js'

export function SubmitReportForm() {
  return <FormCollector />
}

function FormCollector() {
  const nav = useNavigate()
  const [reportType, setReportType] = useState<ReportType>('flood')
  const [severity, setSeverity] = useState<Severity>('medium')
  const [description, setDescription] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [phone, setPhone] = useState('')
  const [smsConsent, setSmsConsent] = useState(false)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)

  async function getLocation(): Promise<void> {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
      })
    })
    setLat(pos.coords.latitude)
    setLng(pos.coords.longitude)
  }

  async function onCaptureLocation(): Promise<void> {
    try {
      await getLocation()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'location failed')
    }
  }

  async function onSubmit(e: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    if (lat === null || lng === null) {
      setError('Please capture your location.')
      return
    }
    if (phone) {
      try {
        normalizeMsisdn(phone)
      } catch {
        setPhoneError('Enter a valid PH mobile number (e.g. 09171234567 or +639171234567)')
        return
      }
    }
    setError(null)

    const created = await createDraft({
      reportType,
      barangay: '',
      description,
      severity,
      location: { lat, lng },
      ...(phone && smsConsent ? { reporterMsisdnHash: await hashPhone(phone) } : {}),
      clientDraftRef: crypto.randomUUID(),
      ...(photo ? { photo: new Blob([await photo.arrayBuffer()], { type: photo.type }) } : {}),
    })

    setDraft(created)
  }

  if (draft) {
    return (
      <SubmissionPanel
        draft={draft}
        phone={phone}
        onSuccess={(publicRef) => {
          void nav('/receipt', { state: { publicRef, secret: 'pending' } })
        }}
      />
    )
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} aria-label="Report submission form">
      <label>
        Type
        <select
          value={reportType}
          onChange={(e) => {
            setReportType(e.target.value as ReportType)
          }}
        >
          <option value="flood">Flood</option>
          <option value="fire">Fire</option>
          <option value="accident">Accident</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label>
        Severity
        <select
          value={severity}
          onChange={(e) => {
            setSeverity(e.target.value as Severity)
          }}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </label>
      <label>
        Description
        <textarea
          value={description}
          onChange={(e) => {
            setDescription(e.target.value)
          }}
          maxLength={5000}
          required
        />
      </label>
      <label>
        Photo (optional)
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            setPhoto(e.target.files?.[0] ?? null)
          }}
        />
      </label>
      <label>
        Mobile number (optional — for SMS alerts)
        <input
          type="tel"
          value={phone}
          placeholder="09171234567 or +639171234567"
          onChange={(e) => {
            setPhone(e.target.value)
            setPhoneError(null)
          }}
        />
      </label>
      {phoneError && <p role="alert">{phoneError}</p>}
      <label>
        <input
          type="checkbox"
          checked={smsConsent}
          onChange={(e) => {
            setSmsConsent(e.target.checked)
          }}
          disabled={!phone}
        />
        Send me SMS updates about this report
      </label>
      <button type="button" onClick={() => void onCaptureLocation()}>
        Capture location
      </button>
      {lat !== null && lng !== null && (
        <p>
          Location: {lat.toFixed(5)}, {lng.toFixed(5)}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <button type="submit">Submit report</button>
    </form>
  )
}

function SubmissionPanel({
  draft,
  phone,
  onSuccess,
}: {
  draft: Draft
  phone: string
  onSuccess: (publicRef: string) => void
}) {
  const [now] = useState(() => Date.now())
  const machine = useSubmissionMachine({
    draft,
    onSuccess,
    onTerminal: () => {
      console.warn('[SubmissionPanel] Submission failed after max retries')
    },
  })

  const showSmsFallback = machine.state === 'queued' || machine.state === 'failed_terminal'

  return (
    <div aria-label="Submission status">
      <StaleDraftBanner updatedAt={draft.updatedAt} now={now} />
      <OfflineBanner state={machine.state} retryCount={machine.retryCount} />

      {machine.state === 'idle' && (
        <button type="button" onClick={() => void machine.submit()}>
          Submit report
        </button>
      )}

      {showSmsFallback && (
        <SmsFallbackButton
          draft={draft}
          {...(phone ? { reporterMsisdn: phone } : {})}
          onSent={() => {
            machine.sendSmsFallback()
          }}
        />
      )}
    </div>
  )
}

async function hashPhone(phone: string): Promise<string> {
  const normalized = normalizeMsisdn(phone)
  const buf = new TextEncoder().encode(normalized)
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
