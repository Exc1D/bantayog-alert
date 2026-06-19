import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Draft } from '../../services/draft-store.js'
import { useSubmissionMachine } from '../../hooks/useSubmissionMachine.js'
import { Step1Evidence } from './Step1Evidence.js'
import { Step2WhoWhere } from './Step2WhoWhere.js'
import { Step3Review } from './Step3Review.js'
import { RevealSheet } from '../RevealSheet/index.js'
import { OfflineBanner } from './OfflineBanner.js'
import { StaleDraftBanner } from './StaleDraftBanner.js'
import { useReportWizard, type Step1Data } from './useReportWizard.js'

type ReportWizard = ReturnType<typeof useReportWizard>

const EMPTY_STEP1_DATA: Step1Data = {
  reportType: '',
  description: '',
  peopleInjured: false,
  peopleTrapped: false,
  urgencyReason: '',
  photoFile: null,
}

export function SubmitReportForm() {
  return <WizardContainer />
}

function WizardContainer() {
  const nav = useNavigate()
  const wizard = useReportWizard({
    onNavigateHome: () => {
      void nav('/')
    },
  })

  if (!wizard.hasLoadedSnapshot) {
    return <LoadingWizard />
  }

  if (wizard.draft) {
    return (
      <SubmissionPanel
        draft={wizard.draft}
        secret={wizard.secret}
        onSuccess={wizard.handleSubmissionSuccess}
      />
    )
  }

  return <WizardStepPanel wizard={wizard} />
}

function LoadingWizard() {
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

function WizardStepPanel({ wizard }: { wizard: ReportWizard }) {
  if (wizard.step === 1) {
    return <Step1Panel wizard={wizard} />
  }

  if (wizard.step === 2) {
    return <Step2Panel wizard={wizard} />
  }

  return <ReviewStepPanel wizard={wizard} />
}

function Step1Panel({ wizard }: { wizard: ReportWizard }) {
  const step1 = wizard.formData.step1 ?? EMPTY_STEP1_DATA
  return (
    <Step1Evidence
      onNext={wizard.handleStep1Next}
      onBack={wizard.handleStep1Back}
      isSubmitting={wizard.isCreatingDraft}
      initialReportType={step1.reportType}
      initialDescription={step1.description}
      initialPeopleInjured={step1.peopleInjured}
      initialPeopleTrapped={step1.peopleTrapped}
      initialUrgencyReason={step1.urgencyReason ?? ''}
    />
  )
}

function Step2Panel({ wizard }: { wizard: ReportWizard }) {
  return (
    <Step2WhoWhere
      onNext={wizard.handleStep2Next}
      onBack={wizard.handleStep2Back}
      isSubmitting={wizard.isCreatingDraft}
      {...(wizard.formData.step2 ? { initialValues: wizard.formData.step2 } : {})}
    />
  )
}

function ReviewStepPanel({ wizard }: { wizard: ReportWizard }) {
  if (!wizard.reviewReportData) {
    return null
  }

  return (
    <>
      <Step3Review
        onBack={wizard.handleStep3Back}
        onSubmit={() => void wizard.handleStep3Submit()}
        reportData={wizard.reviewReportData}
        isSubmitting={wizard.isCreatingDraft}
      />
      {wizard.draftError && <p role="alert">{wizard.draftError}</p>}
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
