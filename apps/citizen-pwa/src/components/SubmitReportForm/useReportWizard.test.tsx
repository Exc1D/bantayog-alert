import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useReportWizard } from './useReportWizard.js'
import type { WizardSnapshot } from '../../services/wizard-snapshot.js'

const snapshotLoadMock = vi.hoisted(() => vi.fn())
const snapshotSaveMock = vi.hoisted(() => vi.fn())
const snapshotClearMock = vi.hoisted(() => vi.fn())
const createDraftMock = vi.hoisted(() => vi.fn())

vi.mock('../../services/wizard-snapshot', () => ({
  wizardSnapshot: {
    load: snapshotLoadMock,
    save: snapshotSaveMock,
    clear: snapshotClearMock,
  },
}))

vi.mock('../../services/submit-report', () => ({
  createDraft: createDraftMock,
}))

vi.mock('../../lib/imageCompress', () => ({
  compressImage: vi.fn(),
}))

vi.mock('../../services/localForageReports', () => ({
  saveReport: vi.fn().mockResolvedValue(undefined),
}))

const step1 = {
  reportType: 'flood',
  description: 'Water is rising near the bridge',
  peopleInjured: true,
  peopleTrapped: false,
  urgencyReason: 'child trapped nearby',
  photoFile: null,
}

const step2 = {
  location: { lat: 14.1122, lng: 122.9553 },
  reporterName: 'Ana',
  reporterMsisdn: '+639171234567',
  locationMethod: 'manual' as const,
  locationConfidence: 'manual' as const,
  municipalityId: 'daet',
  municipalityLabel: 'Daet',
  barangayId: 'Barangay 1',
  nearestLandmark: 'Town plaza',
}

function makeSnapshot({
  step,
  step1,
  step2: persistedStep2,
}: {
  step: WizardSnapshot['step']
  step1: WizardSnapshot['step1']
  step2: WizardSnapshot['step2']
}): WizardSnapshot {
  return {
    step,
    step1,
    step2: persistedStep2,
    updatedAt: Date.now(),
  }
}

function WizardHarness({ onNavigateHome = vi.fn() }: { onNavigateHome?: () => void }) {
  const wizard = useReportWizard({ onNavigateHome })

  return (
    <div>
      <p data-testid="loaded">{String(wizard.hasLoadedSnapshot)}</p>
      <p data-testid="step">{wizard.step}</p>
      <p data-testid="has-step1">{String(Boolean(wizard.formData.step1))}</p>
      <p data-testid="has-step2">{String(Boolean(wizard.formData.step2))}</p>
      <p data-testid="report-type">{wizard.formData.step1?.reportType ?? ''}</p>
      <p data-testid="step2-name">{wizard.formData.step2?.reporterName ?? ''}</p>
      <p data-testid="step2-phone">{wizard.formData.step2?.reporterMsisdn ?? ''}</p>
      <p data-testid="step2-location">
        {wizard.formData.step2
          ? `${String(wizard.formData.step2.location.lat)},${String(wizard.formData.step2.location.lng)}`
          : ''}
      </p>
      <p data-testid="step2-confidence">{wizard.formData.step2?.locationConfidence ?? ''}</p>
      <p data-testid="municipality">{wizard.formData.step2?.municipalityLabel ?? ''}</p>
      <p data-testid="draft-ref">{wizard.draft?.publicRef ?? ''}</p>
      <button
        type="button"
        onClick={() => {
          wizard.handleStep1Next(step1)
        }}
      >
        step 1 next
      </button>
      <button
        type="button"
        onClick={() => {
          wizard.handleStep2Next(step2)
        }}
      >
        step 2 next
      </button>
      <button type="button" onClick={wizard.handleStep2Back}>
        step 2 back
      </button>
      <button type="button" onClick={wizard.handleStep3Back}>
        step 3 back
      </button>
      <button type="button" onClick={() => void wizard.handleStep3Submit()}>
        submit
      </button>
    </div>
  )
}

type TestUser = ReturnType<typeof userEvent.setup>

async function renderLoadedWizard(): Promise<TestUser> {
  const user = userEvent.setup()
  render(<WizardHarness />)

  await waitFor(() => {
    expect(screen.getByTestId('loaded')).toHaveTextContent('true')
  })

  return user
}

async function advanceToReview(user: TestUser): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'step 1 next' }))
  await user.click(screen.getByRole('button', { name: 'step 2 next' }))
}

describe('useReportWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    snapshotLoadMock.mockResolvedValue(null)
    snapshotSaveMock.mockResolvedValue(undefined)
    snapshotClearMock.mockResolvedValue(undefined)
    createDraftMock.mockResolvedValue({
      draft: {
        id: 'draft-1',
        publicRef: 'BA-123',
        reportType: 'flood',
        severity: 'high',
        location: step2.location,
        updatedAt: Date.now(),
      },
      secret: 'secret-1',
    })
  })

  it('advances and retreats steps while preserving entered data', async () => {
    const user = await renderLoadedWizard()

    await user.click(screen.getByRole('button', { name: 'step 1 next' }))
    expect(screen.getByTestId('step')).toHaveTextContent('2')
    expect(screen.getByTestId('report-type')).toHaveTextContent('flood')

    await user.click(screen.getByRole('button', { name: 'step 2 next' }))
    expect(screen.getByTestId('step')).toHaveTextContent('3')
    expect(screen.getByTestId('municipality')).toHaveTextContent('Daet')

    await user.click(screen.getByRole('button', { name: 'step 3 back' }))
    expect(screen.getByTestId('step')).toHaveTextContent('2')
    await user.click(screen.getByRole('button', { name: 'step 2 back' }))
    expect(screen.getByTestId('step')).toHaveTextContent('1')
    expect(screen.getByTestId('report-type')).toHaveTextContent('flood')
    expect(screen.getByTestId('municipality')).toHaveTextContent('Daet')
  })

  it('does not autosave before the snapshot load finishes', async () => {
    let resolveLoad: ((value: null) => void) | undefined
    snapshotLoadMock.mockReturnValue(
      new Promise<null>((resolve) => {
        resolveLoad = resolve
      }),
    )

    render(<WizardHarness />)

    expect(snapshotSaveMock).not.toHaveBeenCalled()

    act(() => {
      resolveLoad?.(null)
    })

    await waitFor(() => {
      expect(snapshotSaveMock).toHaveBeenCalledWith({ step: 1, step1: null, step2: null })
    })
  })

  it('restores a valid step 3 snapshot with sanitized step2 values', async () => {
    snapshotLoadMock.mockResolvedValue(
      makeSnapshot({
        step: 3,
        step1: {
          reportType: ' flood ',
          description: '  Water is rising near the bridge  ',
          peopleInjured: true,
          peopleTrapped: false,
          urgencyReason: '  child trapped nearby  ',
        },
        step2: {
          location: { lat: 14.1122, lng: 122.9553 },
          reporterName: ' Ana ',
          reporterMsisdn: '+639171234567 ',
          locationMethod: 'gps',
          locationConfidence: 'exact',
          municipalityId: ' daet ',
          municipalityLabel: ' Daet ',
          barangayId: ' Barangay 1 ',
          nearestLandmark: ' Town plaza ',
        },
      }),
    )

    await renderLoadedWizard()

    expect(screen.getByTestId('step')).toHaveTextContent('3')
    expect(screen.getByTestId('has-step1')).toHaveTextContent('true')
    expect(screen.getByTestId('has-step2')).toHaveTextContent('true')
    expect(screen.getByTestId('report-type')).toHaveTextContent('flood')
    expect(screen.getByTestId('step2-name')).toHaveTextContent('Ana')
    expect(screen.getByTestId('step2-phone')).toHaveTextContent('+639171234567')
    expect(screen.getByTestId('step2-location')).toHaveTextContent('14.1122,122.9553')
    expect(screen.getByTestId('step2-confidence')).toHaveTextContent('exact')
    expect(screen.getByTestId('municipality')).toHaveTextContent('Daet')
  })

  it('clamps a step 3 snapshot to step 1 when step1 data is missing', async () => {
    snapshotLoadMock.mockResolvedValue(
      makeSnapshot({
        step: 3,
        step1: null,
        step2,
      }),
    )

    await renderLoadedWizard()

    expect(screen.getByTestId('step')).toHaveTextContent('1')
    expect(screen.getByTestId('has-step1')).toHaveTextContent('false')
    expect(screen.getByTestId('has-step2')).toHaveTextContent('false')
  })

  it('clamps a step 3 snapshot to step 2 when step2 location is invalid', async () => {
    snapshotLoadMock.mockResolvedValue(
      makeSnapshot({
        step: 3,
        step1,
        step2: {
          ...step2,
          location: { lat: 999, lng: 122.9553 },
        },
      }),
    )

    await renderLoadedWizard()

    expect(screen.getByTestId('step')).toHaveTextContent('2')
    expect(screen.getByTestId('has-step1')).toHaveTextContent('true')
    expect(screen.getByTestId('has-step2')).toHaveTextContent('false')
  })

  it('sanitizes malformed step2 primitive values without dropping a valid snapshot', async () => {
    const corruptedStep2 = {
      ...step2,
      locationMethod: 'unknown',
      locationConfidence: 'unknown',
      municipalityId: 123,
      barangayId: 42,
    } as unknown as WizardSnapshot['step2']

    snapshotLoadMock.mockResolvedValue(
      makeSnapshot({
        step: 3,
        step1,
        step2: corruptedStep2,
      }),
    )

    await renderLoadedWizard()

    expect(screen.getByTestId('step')).toHaveTextContent('3')
    expect(screen.getByTestId('has-step1')).toHaveTextContent('true')
    expect(screen.getByTestId('has-step2')).toHaveTextContent('true')
    expect(screen.getByTestId('step2-confidence')).toHaveTextContent('manual')
    expect(screen.getByTestId('municipality')).toHaveTextContent('Daet')
  })

  it('submits the final wizard state as the draft payload', async () => {
    const user = await renderLoadedWizard()

    await advanceToReview(user)
    await user.click(screen.getByRole('button', { name: 'submit' }))

    await waitFor(() => {
      expect(createDraftMock).toHaveBeenCalledWith(
        expect.objectContaining({
          reportType: 'flood',
          barangay: 'Barangay 1',
          description: 'Water is rising near the bridge',
          severity: 'high',
          location: step2.location,
          municipalityId: 'daet',
          barangayId: 'Barangay 1',
          nearestLandmark: 'Town plaza',
          triage: {
            peopleInjured: true,
            peopleTrapped: false,
            locationConfidence: 'manual',
            urgencyReason: 'child trapped nearby',
          },
        }),
      )
    })
    expect(snapshotClearMock).toHaveBeenCalled()
    expect(screen.getByTestId('draft-ref')).toHaveTextContent('BA-123')
  })
})
