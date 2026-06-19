import { useEffect, useState } from 'react'
import type { ReportType } from '@bantayog/shared-types'

import { compressImage } from '../../lib/imageCompress.js'
import type { Draft, LocationConfidence } from '../../services/draft-store.js'
import { saveReport } from '../../services/localForageReports.js'
import { deriveReportSeverity } from '../../services/report-severity.js'
import { createDraft, type CreateDraftInput } from '../../services/submit-report.js'
import { wizardSnapshot, type WizardSnapshot } from '../../services/wizard-snapshot.js'

export interface Step1Data {
  reportType: string
  description: string
  peopleInjured: boolean
  peopleTrapped: boolean
  urgencyReason?: string
  photoFile: File | null
}

export interface Step2Data {
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

export interface FormData {
  step1: Step1Data | null
  step2: Step2Data | null
}

export interface ReviewReportData {
  reportType: string
  description: string
  peopleInjured: boolean
  peopleTrapped: boolean
  locationConfidence: LocationConfidence
  urgencyReason?: string
  location: { lat: number; lng: number }
  reporterName: string
  reporterMsisdn: string
  locationMethod: 'gps' | 'manual'
  photoAttached: boolean
  municipalityLabel?: string
  barangayId?: string
  nearestLandmark?: string
}

export type WizardStep = 1 | 2 | 3

type ValidReportType =
  | 'flood'
  | 'fire'
  | 'accident'
  | 'typhoon'
  | 'landslide'
  | 'structural'
  | 'public_disturbance'
  | 'other'

const VALID_REPORT_TYPES = new Set<ValidReportType>([
  'flood',
  'fire',
  'accident',
  'typhoon',
  'landslide',
  'structural',
  'public_disturbance',
  'other',
] as const)

export interface UseReportWizardOptions {
  onNavigateHome: () => void
}

export function useReportWizard({ onNavigateHome }: UseReportWizardOptions) {
  const [hasLoadedSnapshot, setHasLoadedSnapshot] = useState(false)
  const [step, setStep] = useState<WizardStep>(1)
  const [formData, setFormData] = useState<FormData>({ step1: null, step2: null })
  const [draft, setDraft] = useState<Draft | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [isCreatingDraft, setIsCreatingDraft] = useState(false)
  const [draftError, setDraftError] = useState<string | null>(null)

  // Resume an in-progress wizard from a prior session (refresh, accidental close).
  // photoFile is intentionally not persisted; the user re-attaches if needed.
  useEffect(() => {
    let cancelled = false
    void wizardSnapshot
      .load()
      .then((snap) => {
        if (cancelled) return
        if (snap) {
          const hydrated = hydrateWizardSnapshot(snap)
          setStep(hydrated.step)
          setFormData(hydrated.formData)
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

  // Persist after load + on every step/formData change. The gate prevents the
  // initial empty state from clobbering a fresh resume.
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
      const photo = await resolveDraftPhoto(formData.step1.photoFile)
      const input = buildCreateDraftInput(formData.step1, formData.step2, photo)
      const { draft: created, secret: draftSecret } = await createDraft(input)

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
    // User abandoned the wizard from Step 1: drop the snapshot so a fresh
    // /report visit starts clean rather than resuming the old draft.
    void wizardSnapshot.clear()
    onNavigateHome()
  }

  const handleSubmissionSuccess = () => {
    void wizardSnapshot.clear()
    if (draft?.location && secret) {
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
  }

  return {
    hasLoadedSnapshot,
    step,
    formData,
    draft,
    secret,
    isCreatingDraft,
    draftError,
    reviewReportData: buildReviewReportData(formData),
    handleStep1Next,
    handleStep2Next,
    handleStep2Back,
    handleStep3Back,
    handleStep3Submit,
    handleStep1Back,
    handleSubmissionSuccess,
  }
}

function hydrateWizardSnapshot(snapshot: WizardSnapshot): { step: WizardStep; formData: FormData } {
  const legacyPatientCount = readLegacyPatientCount(snapshot.step2)
  const step1 = snapshot.step1
    ? buildStep1DataFromSnapshot(snapshot.step1, legacyPatientCount)
    : null
  const step2 = snapshot.step2 && step1 ? buildStep2DataFromSnapshot(snapshot.step2) : null

  return {
    step: clampRestoredStep(snapshot.step, step1, step2),
    formData: {
      step1,
      step2,
    },
  }
}

function clampRestoredStep(
  snapshotStep: unknown,
  step1: Step1Data | null,
  step2: Step2Data | null,
): WizardStep {
  const restoredStep = snapshotStep === 3 ? 3 : snapshotStep === 2 ? 2 : 1
  const maxRestorableStep = step1 && step2 ? 3 : step1 ? 2 : 1
  return Math.min(restoredStep, maxRestorableStep) as WizardStep
}

function buildStep1DataFromSnapshot(
  step1: NonNullable<WizardSnapshot['step1']>,
  legacyPatientCount: number,
): Step1Data | null {
  const reportType = readNonEmptyString(step1.reportType)
  const description = readNonEmptyString(step1.description)
  const urgencyReason = readNonEmptyString(step1.urgencyReason)

  if (!reportType || !description || !isValidReportType(reportType)) {
    return null
  }

  return {
    reportType,
    description,
    peopleInjured: readSnapshotBoolean(step1.peopleInjured) ?? legacyPatientCount > 0,
    peopleTrapped: readSnapshotBoolean(step1.peopleTrapped) ?? false,
    ...(urgencyReason ? { urgencyReason } : {}),
    photoFile: null,
  }
}

function buildStep2DataFromSnapshot(step2: NonNullable<WizardSnapshot['step2']>): Step2Data | null {
  const location = readSnapshotLocation(step2.location)
  const reporterName = readNonEmptyString(step2.reporterName)
  const reporterMsisdn = readNonEmptyString(step2.reporterMsisdn)
  const municipalityId = readNonEmptyString(step2.municipalityId)
  const municipalityLabel = readNonEmptyString(step2.municipalityLabel)
  const barangayId = readNonEmptyString(step2.barangayId)
  const nearestLandmark = readNonEmptyString(step2.nearestLandmark)

  if (!location || !reporterName || !reporterMsisdn) {
    return null
  }

  return {
    location,
    reporterName,
    reporterMsisdn,
    locationMethod: readLocationMethod(step2.locationMethod),
    locationConfidence: readLocationConfidence(step2.locationConfidence),
    ...(municipalityId ? { municipalityId } : {}),
    ...(municipalityLabel ? { municipalityLabel } : {}),
    ...(barangayId ? { barangayId } : {}),
    ...(nearestLandmark ? { nearestLandmark } : {}),
  }
}

async function resolveDraftPhoto(photoFile: File | null): Promise<Blob | undefined> {
  if (!photoFile) return undefined
  try {
    return await compressImage(photoFile)
  } catch (compressErr) {
    console.warn('Image compression failed, using original:', compressErr)
    return photoFile
  }
}

function buildCreateDraftInput(
  step1: Step1Data,
  step2: Step2Data,
  photo: Blob | undefined,
): CreateDraftInput {
  return {
    reportType: step1.reportType as ReportType,
    // barangayId holds the barangay name when selected; fall back to municipality label.
    barangay: step2.barangayId ?? step2.municipalityLabel ?? '',
    description: step1.description.trim(),
    severity: deriveReportSeverity({
      reportType: step1.reportType,
      peopleInjured: step1.peopleInjured,
      peopleTrapped: step1.peopleTrapped,
    }),
    triage: buildDraftTriage(step1, step2),
    location: step2.location,
    clientDraftRef: crypto.randomUUID(),
    ...(step2.municipalityId ? { municipalityId: step2.municipalityId } : {}),
    ...(step2.barangayId ? { barangayId: step2.barangayId } : {}),
    ...(step2.nearestLandmark ? { nearestLandmark: step2.nearestLandmark } : {}),
    ...(photo ? { photo } : {}),
  }
}

function buildDraftTriage(
  step1: Step1Data,
  step2: Step2Data,
): NonNullable<CreateDraftInput['triage']> {
  const urgencyReason = step1.urgencyReason?.trim()
  return {
    peopleInjured: step1.peopleInjured,
    peopleTrapped: step1.peopleTrapped,
    locationConfidence: step2.locationConfidence,
    ...(urgencyReason ? { urgencyReason } : {}),
  }
}

function readSnapshotString(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() : undefined
}

function readNonEmptyString(value: unknown): string | undefined {
  const text = readSnapshotString(value)
  if (text === undefined || text === '') return undefined
  return text
}

function readSnapshotBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function isValidReportType(value: string): value is ValidReportType {
  return VALID_REPORT_TYPES.has(value as ValidReportType)
}

function readSnapshotLocation(value: unknown): { lat: number; lng: number } | null {
  if (value === null || typeof value !== 'object' || !hasLatAndLng(value)) {
    return null
  }

  const { lat, lng } = value
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return null
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null
  }

  return { lat, lng }
}

function hasLatAndLng(value: object): value is { lat: unknown; lng: unknown } {
  return 'lat' in value && 'lng' in value
}

function readLocationMethod(value: unknown): Step2Data['locationMethod'] {
  return value === 'gps' || value === 'manual' ? value : 'manual'
}

function readLocationConfidence(value: unknown): LocationConfidence {
  if (value === 'exact' || value === 'approximate' || value === 'manual') {
    return value
  }
  return 'manual'
}

function readLegacyPatientCount(step2: unknown): number {
  if (step2 === null || typeof step2 !== 'object' || !('patientCount' in step2)) {
    return 0
  }
  const { patientCount } = step2 as { patientCount?: unknown }
  return typeof patientCount === 'number' ? patientCount : 0
}

function buildReviewReportData(formData: FormData): ReviewReportData | null {
  if (!formData.step1 || !formData.step2) return null
  return {
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
    ...(formData.step2.nearestLandmark ? { nearestLandmark: formData.step2.nearestLandmark } : {}),
  }
}
