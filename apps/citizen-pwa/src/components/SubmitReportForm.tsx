import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { addDoc, collection } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, fns, ensureSignedIn } from '../services/firebase.js'
import { submitReport, type SubmitReportDeps } from '../services/submit-report.js'
import type { ReportType, Severity } from '@bantayog/shared-types'

function randomPublicRef(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

function randomSecret(): string {
  return crypto.randomUUID()
}

async function sha256Hex(input: string | Blob): Promise<string> {
  const buf =
    typeof input === 'string'
      ? new TextEncoder().encode(input)
      : new Uint8Array(await input.arrayBuffer())
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function putBlob(url: string, blob: Blob): Promise<void> {
  const res = await fetch(url, {
    method: 'PUT',
    body: blob,
    headers: { 'content-type': blob.type },
  })
  if (!res.ok) throw new Error('upload failed: ' + String(res.status))
}

export function SubmitReportForm() {
  const nav = useNavigate()
  const [reportType, setReportType] = useState<ReportType>('flood')
  const [severity, setSeverity] = useState<Severity>('medium')
  const [description, setDescription] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  async function onSubmit(e: React.SubmitEvent): Promise<void> {
    e.preventDefault()
    if (lat === null || lng === null) {
      setError('Please capture your location.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const deps: SubmitReportDeps = {
        ensureSignedIn,
        requestUploadUrl: async (args) =>
          (await httpsCallable(fns(), 'requestUploadUrl')(args)).data as {
            uploadUrl: string
            uploadId: string
            storagePath: string
            expiresAt: number
          },
        putBlob,
        writeInbox: async (doc) => {
          const ref = await addDoc(collection(db(), 'report_inbox'), doc)
          return ref.id
        },
        randomUUID: () => crypto.randomUUID(),
        randomPublicRef,
        randomSecret,
        sha256Hex,
        now: () => Date.now(),
      }
      const result = await submitReport(deps, {
        reportType,
        severity,
        description,
        publicLocation: { lat, lng },
        ...(photo ? { photo } : {}),
      })
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      nav('/receipt', { state: result })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'submission failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      onSubmit={onSubmit}
      aria-label="Report submission form"
    >
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
      <button type="button" onClick={() => void getLocation()}>
        Capture location
      </button>
      {lat !== null && lng !== null && (
        <p>
          Location: {lat.toFixed(5)}, {lng.toFixed(5)}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={busy}>
        {busy ? 'Submitting\u2026' : 'Submit report'}
      </button>
    </form>
  )
}
