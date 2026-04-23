import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { normalizeMsisdn } from '@bantayog/shared-validators'
import type { ReportType } from '@bantayog/shared-types'
import { createDraft } from '../../services/submit-report.js'
import type { Draft } from '../../services/draft-store.js'
import { useSubmissionMachine } from '../../hooks/useSubmissionMachine.js'
import { Step1Evidence } from './Step1Evidence.js'
import { Step2WhoWhere } from './Step2WhoWhere.js'
import { Step3Review } from './Step3Review.js'
import { RevealSheet } from '../RevealSheet.js'
import { OfflineBanner } from './OfflineBanner.js'
import { SmsFallbackButton } from './SmsFallbackButton.js'
import { StaleDraftBanner } from './StaleDraftBanner.js'

interface Step1Data {
  reportType: string
  photoFile: File | null
}

interface Step2Data {
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

interface FormData {
  step1: Step1Data | null
  step2: Step2Data | null
}

export function SubmitReportForm() {
  return <WizardContainer />
}

function WizardContainer() {
  const nav = useNavigate()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [formData, setFormData] = useState<FormData>({ step1: null, step2: null })
  const [draft, setDraft] = useState<Draft | null>(null)
  const [isCreatingDraft, setIsCreatingDraft] = useState(false)
  const [draftError, setDraftError] = useState<string | null>(null)

  const handleStep1Next = (data: Step1Data) => {
    setFormData((prev) => ({ ...prev, step1: data }))
    setStep(2)
  }

  const handleStep2Next = (data: Step2Data) => {
    setFormData((prev) => ({ ...prev, step2: data }))
    setStep(3)
  }

  const handleStep2Back = () => {
    setStep(1)
  }

  const handleStep3Back = () => {
    setStep(2)
  }

  const handleStep3Submit = async () => {
    if (isCreatingDraft) return
    if (!formData.step1 || !formData.step2) return

    setIsCreatingDraft(true)
    setDraftError(null)

    try {
      const msisdnHash = await hashPhone(formData.step2.reporterMsisdn)
      const photo = formData.step1.photoFile
        ? new Blob([await formData.step1.photoFile.arrayBuffer()], {
            type: formData.step1.photoFile.type,
          })
        : undefined

      const created = await createDraft({
        reportType: formData.step1.reportType as ReportType,
        barangay: formData.step2.municipalityLabel ?? '',
        description:
          formData.step2.patientCount > 0 ? `Patients: ${String(formData.step2.patientCount)}` : '',
        severity: 'medium',
        location: formData.step2.location,
        reporterName: formData.step2.reporterName,
        reporterMsisdnHash: msisdnHash,
        clientDraftRef: crypto.randomUUID(),
        ...(formData.step2.barangayId ? { barangayId: formData.step2.barangayId } : {}),
        ...(formData.step2.nearestLandmark
          ? { nearestLandmark: formData.step2.nearestLandmark }
          : {}),
        ...(photo ? { photo } : {}),
      })

      setDraft(created)
    } catch (err: unknown) {
      setDraftError(err instanceof Error ? err.message : 'Failed to create draft')
    } finally {
      setIsCreatingDraft(false)
    }
  }

  const handleStep1Back = () => {
    void nav('/')
  }

  if (draft) {
    return (
      <SubmissionPanel
        draft={draft}
        reporterMsisdn={formData.step2?.reporterMsisdn ?? ''}
        onSuccess={(publicRef) => {
          void nav(`/reports/${publicRef}`)
        }}
      />
    )
  }

  if (step === 1) {
    return (
      <Step1Evidence
        onNext={handleStep1Next}
        onBack={handleStep1Back}
        isSubmitting={isCreatingDraft}
      />
    )
  }

  if (step === 2) {
    return (
      <Step2WhoWhere
        onNext={handleStep2Next}
        onBack={handleStep2Back}
        isSubmitting={isCreatingDraft}
      />
    )
  }

  if (!formData.step1 || !formData.step2) {
    return null
  }

  return (
    <>
      <Step3Review
        onBack={handleStep3Back}
        onSubmit={() => void handleStep3Submit()}
        reportData={{
          reportType: formData.step1.reportType,
          location: formData.step2.location,
          reporterName: formData.step2.reporterName,
          reporterMsisdn: formData.step2.reporterMsisdn,
          patientCount: formData.step2.patientCount,
          locationMethod: formData.step2.locationMethod,
          ...(formData.step2.municipalityLabel
            ? { municipalityLabel: formData.step2.municipalityLabel }
            : {}),
          ...(formData.step2.barangayId ? { barangayId: formData.step2.barangayId } : {}),
          ...(formData.step2.nearestLandmark
            ? { nearestLandmark: formData.step2.nearestLandmark }
            : {}),
        }}
        isSubmitting={isCreatingDraft}
      />
      {draftError && <p role="alert">{draftError}</p>}
    </>
  )
}

function SubmissionPanel({
  draft,
  reporterMsisdn,
  onSuccess,
}: {
  draft: Draft
  reporterMsisdn: string
  onSuccess: (publicRef: string) => void
}) {
  const nav = useNavigate()
  const [now] = useState(() => Date.now())
  const machine = useSubmissionMachine({
    draft,
    onSuccess,
    onTerminal: () => {
      console.warn('[SubmissionPanel] Submission failed after max retries')
    },
  })

  if (machine.state === 'server_confirmed') {
    return <RevealSheet state="success" referenceCode={draft.id} />
  }

  if (machine.state === 'queued') {
    return (
      <div aria-label="Submission status">
        <RevealSheet
          state="queued"
          referenceCode={draft.id}
          onClose={() => {
            void nav('/')
          }}
        />
      </div>
    )
  }

  if (machine.state === 'failed_retryable') {
    return (
      <div aria-label="Submission status">
        <RevealSheet
          state="failed_retryable"
          referenceCode={draft.id}
          onClose={() => {
            void nav('/')
          }}
        />
      </div>
    )
  }

  if (machine.state === 'failed_terminal') {
    return (
      <div aria-label="Submission status">
        <OfflineBanner state={machine.state} retryCount={machine.retryCount} />
        <SmsFallbackButton
          draft={draft}
          {...(reporterMsisdn ? { reporterMsisdn } : {})}
          onSent={() => {
            machine.sendSmsFallback()
          }}
        />
      </div>
    )
  }

  return (
    <div aria-label="Submission status">
      <StaleDraftBanner updatedAt={draft.updatedAt} now={now} />
      <OfflineBanner state={machine.state} retryCount={machine.retryCount} />

      {machine.state === 'idle' && (
        <button type="button" onClick={() => void machine.submit()}>
          Submit report
        </button>
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
