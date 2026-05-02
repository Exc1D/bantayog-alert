import { Suspense, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { normalizeMsisdn } from '@bantayog/shared-validators'
import type { ReportType } from '@bantayog/shared-types'
import { createDraft } from '../../services/submit-report.js'
import type { Draft } from '../../services/draft-store.js'
import { wizardSnapshot } from '../../services/wizard-snapshot.js'
import { useSubmissionMachine } from '../../hooks/useSubmissionMachine.js'
import { Step1Evidence } from './Step1Evidence.js'
import { Step2WhoWhere } from './Step2WhoWhere.js'
import { Step3Review } from './Step3Review.js'
import { RevealSheet } from '../RevealSheet.lazy.js'
import { OfflineBanner } from './OfflineBanner.js'
import { StaleDraftBanner } from './StaleDraftBanner.js'
import { compressImage } from '../../lib/imageCompress.js'

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
  const [hasLoadedSnapshot, setHasLoadedSnapshot] = useState(false)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [formData, setFormData] = useState<FormData>({ step1: null, step2: null })
  const [draft, setDraft] = useState<Draft | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [isCreatingDraft, setIsCreatingDraft] = useState(false)
  const [draftError, setDraftError] = useState<string | null>(null)

  // Resume an in-progress wizard from a prior session (refresh, accidental close).
  // photoFile is intentionally not persisted — File can't be reliably serialized;
  // the user re-attaches if needed by going back to Step 1.
  useEffect(() => {
    let cancelled = false
    void wizardSnapshot
      .load()
      .then((snap) => {
        if (cancelled) return
        if (snap) {
          setStep(snap.step)
          setFormData({
            step1: snap.step1 ? { reportType: snap.step1.reportType, photoFile: null } : null,
            step2: snap.step2 ?? null,
          })
        }
        setHasLoadedSnapshot(true)
      })
      .catch(() => {
        if (!cancelled) setHasLoadedSnapshot(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Persist after load + on every step/formData change. The hasLoadedSnapshot
  // gate prevents the initial empty state from clobbering a fresh resume.
  useEffect(() => {
    if (!hasLoadedSnapshot) return
    void wizardSnapshot.save({
      step,
      step1: formData.step1 ? { reportType: formData.step1.reportType } : null,
      step2: formData.step2,
    })
  }, [hasLoadedSnapshot, step, formData])

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
      const msisdnHash = formData.step2.reporterMsisdn
        ? await hashPhone(formData.step2.reporterMsisdn)
        : undefined
      let photo: Blob | undefined
      if (formData.step1.photoFile) {
        try {
          photo = await compressImage(formData.step1.photoFile)
        } catch (compressErr) {
          console.warn('Image compression failed, using original:', compressErr)
          photo = formData.step1.photoFile
        }
      }

      const { draft: created, secret: draftSecret } = await createDraft({
        reportType: formData.step1.reportType as ReportType,
        // barangayId holds the barangay name when selected; fall back to municipality label
        barangay: formData.step2.barangayId ?? formData.step2.municipalityLabel ?? '',
        description:
          formData.step2.patientCount > 0 ? `Patients: ${String(formData.step2.patientCount)}` : '',
        severity: 'medium',
        location: formData.step2.location,
        reporterName: formData.step2.reporterName,
        ...(msisdnHash ? { reporterMsisdnHash: msisdnHash } : {}),
        clientDraftRef: crypto.randomUUID(),
        ...(formData.step2.municipalityId ? { municipalityId: formData.step2.municipalityId } : {}),
        ...(formData.step2.barangayId ? { barangayId: formData.step2.barangayId } : {}),
        ...(formData.step2.nearestLandmark
          ? { nearestLandmark: formData.step2.nearestLandmark }
          : {}),
        ...(photo ? { photo } : {}),
      })

      setDraft(created)
      setSecret(draftSecret)
      // Prevent stale snapshot from causing a second draft on refresh.
      await wizardSnapshot.clear()
    } catch (err: unknown) {
      setDraftError(err instanceof Error ? err.message : 'Failed to create draft')
    } finally {
      setIsCreatingDraft(false)
    }
  }

  const handleStep1Back = () => {
    // User abandoned the wizard from Step 1 — drop the snapshot so a fresh
    // /report visit starts clean rather than resuming the old draft.
    void wizardSnapshot.clear()
    void nav('/')
  }

  if (!hasLoadedSnapshot) {
    return (
      <div
        role="status"
        aria-label="Loading report wizard"
        className="min-h-[100dvh] bg-surface-100 flex items-center justify-center"
      >
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-surface-300 border-t-brand-600" />
      </div>
    )
  }

  if (draft) {
    return (
      <SubmissionPanel
        draft={draft}
        secret={secret}
        onSuccess={(publicRef) => {
          void wizardSnapshot.clear()
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
        initialReportType={formData.step1?.reportType ?? ''}
      />
    )
  }

  if (step === 2) {
    return (
      <Step2WhoWhere
        onNext={handleStep2Next}
        onBack={handleStep2Back}
        isSubmitting={isCreatingDraft}
        {...(formData.step2 ? { initialValues: formData.step2 } : {})}
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
  secret,
  onSuccess,
}: {
  draft: Draft
  secret: string | null
  onSuccess: (publicRef: string) => void
}) {
  const nav = useNavigate()
  const [now] = useState(() => Date.now())
  const hasAutoSubmittedRef = useRef(false)
  const machine = useSubmissionMachine({
    draft,
    onSuccess,
    onTerminal: () => {
      console.warn('[SubmissionPanel] Submission failed after max retries')
    },
  })

  // Auto-start: wizard captured consent in Step3, no second confirm needed.
  // Ref guard prevents double-invocation under React Strict Mode.
  useEffect(() => {
    if (hasAutoSubmittedRef.current) return
    hasAutoSubmittedRef.current = true
    void machine.submit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (machine.state === 'server_confirmed') {
    return (
      <Suspense fallback={null}>
        <RevealSheet
          state="success"
          referenceCode={draft.publicRef}
          {...(draft.municipalityId ? { municipalityId: draft.municipalityId } : {})}
          {...(secret ? { secretCode: secret } : {})}
        />
      </Suspense>
    )
  }

  if (machine.state === 'queued') {
    return (
      <div aria-label="Submission status">
        <Suspense fallback={null}>
          <RevealSheet
            state="queued"
            referenceCode={draft.publicRef}
            {...(draft.municipalityId ? { municipalityId: draft.municipalityId } : {})}
            onClose={() => {
              void nav('/')
            }}
          />
        </Suspense>
      </div>
    )
  }

  if (machine.state === 'failed_retryable') {
    return (
      <div aria-label="Submission status">
        <Suspense fallback={null}>
          <RevealSheet
            state="failed_retryable"
            referenceCode={draft.publicRef}
            {...(draft.municipalityId ? { municipalityId: draft.municipalityId } : {})}
            onClose={() => {
              void nav('/')
            }}
          />
        </Suspense>
      </div>
    )
  }

  if (machine.state === 'failed_terminal') {
    return (
      <Suspense fallback={null}>
        <RevealSheet
          state="failed_terminal"
          referenceCode={draft.publicRef}
          {...(draft.municipalityId ? { municipalityId: draft.municipalityId } : {})}
          onClose={() => {
            void nav('/')
          }}
        />
      </Suspense>
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
