import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { httpsCallable } from 'firebase/functions'
import { db, fns, ensureSignedIn } from '../../services/firebase.js'
import { submitReport, type SubmitReportDeps } from '../../services/submit-report.js'
import { normalizeMsisdn } from '@bantayog/shared-validators'
import { useSubmissionMachine } from '../../hooks/useSubmissionMachine'
import { RevealSheet } from '../RevealSheet'
import { Step1Evidence } from './Step1Evidence'
import { Step2WhoWhere } from './Step2WhoWhere'
import { Step3Review } from './Step3Review'

interface FormData {
  reportType: string
  photoFile: File | null
  location: { lat: number; lng: number }
  reporterName: string
  reporterMsisdn: string
  patientCount: number
  locationMethod: 'gps' | 'manual'
  municipalityId?: string
  municipalityLabel?: string
  barangayId?: string
  nearestLandmark?: string
}

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
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`upload failed: ${String(res.status)} ${body}`.trim())
  }
}

export function SubmitReportForm() {
  const navigate = useNavigate()
  const { transition, setError, state: machineState } = useSubmissionMachine()
  const [step, setStep] = useState(1)
  const [publicRef, setPublicRef] = useState('')
  const [formData, setFormData] = useState<FormData>({
    reportType: 'flood',
    photoFile: null,
    location: { lat: 0, lng: 0 },
    reporterName: '',
    reporterMsisdn: '',
    patientCount: 0,
    locationMethod: 'gps',
  })

  const isSubmitting = machineState === 'submitting'
  const showRevealSheet =
    machineState === 'success' || machineState === 'queued' || machineState === 'failed_retryable'

  const handleSubmit = async () => {
    transition('submitting')
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
          const { addDoc, collection } = await import('firebase/firestore')
          const ref = await addDoc(collection(db(), 'report_inbox'), doc)
          return ref.id
        },
        randomUUID: () => crypto.randomUUID(),
        randomPublicRef,
        randomSecret,
        sha256Hex,
        now: () => Date.now(),
      }

      const contact = formData.reporterMsisdn.trim()
        ? {
            phone: normalizeMsisdn(formData.reporterMsisdn),
            smsConsent: true as const,
          }
        : undefined

      const description =
        formData.patientCount > 0
          ? String(formData.patientCount) + ' patient(s) reported'
          : 'No description provided'

      const result = await submitReport(deps, {
        reportType: formData.reportType,
        severity: 'medium',
        description,
        publicLocation: formData.location,
        ...(formData.photoFile ? { photo: formData.photoFile } : {}),
        ...(contact ? { contact } : {}),
        ...(formData.locationMethod === 'manual' && formData.municipalityId
          ? {
              municipalityId: formData.municipalityId,
              barangayId: formData.barangayId,
              nearestLandmark: formData.nearestLandmark,
            }
          : {}),
      })

      setPublicRef(result.publicRef)
      void navigate('/receipt', { state: { publicRef: result.publicRef, secret: result.secret } })
      transition('success')
    } catch (err) {
      setError({
        code: 'SUBMIT_ERROR',
        message: err instanceof Error ? err.message : 'Submission failed',
      })
      transition('failed_retryable')
    }
  }

  if (showRevealSheet) {
    return (
      <RevealSheet
        state={machineState}
        referenceCode={publicRef}
        onClose={() => {
          transition('closed')
          void navigate('/')
        }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-[#f7f9fb]">
      {step === 1 && (
        <Step1Evidence
          onNext={(data) => {
            setFormData((prev) => ({ ...prev, ...data }))
            setStep(2)
          }}
          onBack={() => {
            void navigate('/')
          }}
          isSubmitting={isSubmitting}
        />
      )}
      {step === 2 && (
        <Step2WhoWhere
          onNext={(data) => {
            setFormData((prev) => ({ ...prev, ...data }))
            setStep(3)
          }}
          onBack={() => {
            setStep(1)
          }}
          isSubmitting={isSubmitting}
        />
      )}
      {step === 3 && (
        <Step3Review
          onBack={() => {
            setStep(2)
          }}
          onSubmit={() => {
            void handleSubmit()
          }}
          reportData={formData}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  )
}
