import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ReportType } from '@bantayog/shared-types'
import { createDraft } from '../../services/submit-report.js'
import type { Draft, LocationConfidence } from '../../services/draft-store.js'
import { deriveReportSeverity } from '../../services/report-severity.js'
import { wizardSnapshot } from '../../services/wizard-snapshot.js'
import { saveReport } from '../../services/localForageReports.js'
import { useSubmissionMachine } from '../../hooks/useSubmissionMachine.js'
import { Step1Evidence } from './Step1Evidence.js'
import { Step2WhoWhere } from './Step2WhoWhere.js'
import { Step3Review } from './Step3Review.js'
import { RevealSheet } from '../RevealSheet/index.js'
import { OfflineBanner } from './OfflineBanner.js'
import { StaleDraftBanner } from './StaleDraftBanner.js'
import { compressImage } from '../../lib/imageCompress.js'

interface Step1Data {
  reportType: string
  description: string
  peopleInjured: boolean
  peopleTrapped: boolean
  urgencyReason?: string
  photoFile: File | null
}

interface Step2Data {
  location: { lat: number; lng: number }
  reporterName: string
  reporterMsisdn: string
  locationMethod: 'gps' | 'manual'
  locationConfidence: LocationConfidence
  municipalityId?: string
  municipalityLabel?: string
  barangayId?: string
  nearestLandmark?: string
}

interface FormData {
  step1: Step1Data | null
  step2: Step2Data | null
}

function readLegacyPatientCount(step2: unknown): number {
  if (step2 === null || typeof step2 !== 'object' || !('patientCount' in step2)) {
    return 0
  }
  const patientCount = step2.patientCount
  return typeof patientCount === 'number' ? patientCount : 0
}

function readLocationConfidence(step2: unknown): LocationConfidence {
  if (step2 === null || typeof step2 !== 'object' || !('locationConfidence' in step2)) {
    return 'manual'
  }
  const confidence = step2.locationConfidence
  if (confidence === 'exact' || confidence === 'approximate' || confidence === 'manual') {
    return confidence
  }
  return 'manual'
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
          const legacyPatientCount = readLegacyPatientCount(snap.step2)
          setStep(snap.step)
          setFormData({
            step1: snap.step1
              ? {
                  reportType: snap.step1.reportType,
                  description:
                    'description' in snap.step1 && typeof snap.step1.description === 'string'
                      ? snap.step1.description
                      : '',
                  peopleInjured:
                    'peopleInjured' in snap.step1 && typeof snap.step1.peopleInjured === 'boolean'
                      ? snap.step1.peopleInjured
                      : legacyPatientCount > 0,
                  peopleTrapped:
                    'peopleTrapped' in snap.step1 && typeof snap.step1.peopleTrapped === 'boolean'
                      ? snap.step1.peopleTrapped
                      : false,
                  ...('urgencyReason' in snap.step1 &&
                  typeof snap.step1.urgencyReason === 'string' &&
                  snap.step1.urgencyReason.trim()
                    ? { urgencyReason: snap.step1.urgencyReason }
                    : {}),
                  photoFile: null,
                }
              : null,
            step2: snap.step2
              ? {
                  location: snap.step2.location,
                  reporterName: snap.step2.reporterName,
                  reporterMsisdn: snap.step2.reporterMsisdn,
                  locationMethod: snap.step2.locationMethod,
                  locationConfidence: readLocationConfidence(snap.step2),
                  ...(snap.step2.municipalityId
                    ? { municipalityId: snap.step2.municipalityId }
                    : {}),
                  ...(snap.step2.municipalityLabel
                    ? { municipalityLabel: snap.step2.municipalityLabel }
                    : {}),
                  ...(snap.step2.barangayId ? { barangayId: snap.step2.barangayId } : {}),
                  ...(snap.step2.nearestLandmark
                    ? { nearestLandmark: snap.step2.nearestLandmark }
                    : {}),
                }
              : null,
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
      step1: formData.step1
        ? {
            reportType: formData.step1.reportType,
            description: formData.step1.description,
            peopleInjured: formData.step1.peopleInjured,
            peopleTrapped: formData.step1.peopleTrapped,
            ...(formData.step1.urgencyReason
              ? { urgencyReason: formData.step1.urgencyReason }
              : {}),
          }
        : null,
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
      const urgencyReason = formData.step1.urgencyReason?.trim()
      const triage = {
        peopleInjured: formData.step1.peopleInjured,
        peopleTrapped: formData.step1.peopleTrapped,
        locationConfidence: formData.step2.locationConfidence,
        ...(urgencyReason ? { urgencyReason } : {}),
      }
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
        description: formData.step1.description.trim(),
        severity: deriveReportSeverity({
          reportType: formData.step1.reportType,
          peopleInjured: formData.step1.peopleInjured,
          peopleTrapped: formData.step1.peopleTrapped,
        }),
        triage,
        location: formData.step2.location,
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
        onSuccess={() => {
          void wizardSnapshot.clear()
          if (draft.location && secret) {
            void saveReport({
              publicRef: draft.publicRef,
              secret,
              reportType: draft.reportType,
              severity: draft.severity,
              lat: draft.location.lat,
              lng: draft.location.lng,
              submittedAt: Date.now(),
              ...(formData.step2?.municipalityLabel
                ? { municipalityLabel: formData.step2.municipalityLabel }
                : {}),
            })
              .then(() => {
                window.dispatchEvent(new Event('bantayog:report-saved'))
              })
              .catch((err: unknown) => {
                console.error('[SubmissionPanel] failed to persist report locally', err)
              })
          }
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
        initialDescription={formData.step1?.description ?? ''}
        initialPeopleInjured={formData.step1?.peopleInjured ?? false}
        initialPeopleTrapped={formData.step1?.peopleTrapped ?? false}
        initialUrgencyReason={formData.step1?.urgencyReason ?? ''}
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
          description: formData.step1.description,
          peopleInjured: formData.step1.peopleInjured,
          peopleTrapped: formData.step1.peopleTrapped,
          locationConfidence: formData.step2.locationConfidence,
          ...(formData.step1.urgencyReason ? { urgencyReason: formData.step1.urgencyReason } : {}),
          location: formData.step2.location,
          reporterName: formData.step2.reporterName,
          reporterMsisdn: formData.step2.reporterMsisdn,
          locationMethod: formData.step2.locationMethod,
          photoAttached: Boolean(formData.step1.photoFile),
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
      <RevealSheet
        state="success"
        referenceCode={draft.publicRef}
        {...(draft.municipalityId ? { municipalityId: draft.municipalityId } : {})}
        {...(secret ? { secretCode: secret } : {})}
        onClose={() => {
          void nav('/')
        }}
      />
    )
  }

  if (machine.state === 'queued') {
    return (
      <div aria-label="Submission status">
        <RevealSheet
          state="queued"
          referenceCode={draft.publicRef}
          {...(draft.municipalityId ? { municipalityId: draft.municipalityId } : {})}
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
          referenceCode={draft.publicRef}
          {...(draft.municipalityId ? { municipalityId: draft.municipalityId } : {})}
          onClose={() => {
            void nav('/')
          }}
        />
      </div>
    )
  }

  if (machine.state === 'failed_terminal') {
    return (
      <RevealSheet
        state="failed_terminal"
        referenceCode={draft.publicRef}
        {...(draft.municipalityId ? { municipalityId: draft.municipalityId } : {})}
        onClose={() => {
          void nav('/')
        }}
      />
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
