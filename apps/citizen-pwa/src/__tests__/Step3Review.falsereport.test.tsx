/// <reference types="node" />
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TestWrapper } from './test-utils'
import { Step3Review } from '../components/SubmitReportForm/Step3Review'

beforeEach(() => {
  vi.clearAllMocks()
})

const REPORT_DATA = {
  reportType: 'flood',
  location: { lat: 14.0, lng: 122.0 },
  reporterName: 'Juan Dela Cruz',
  reporterMsisdn: '09171234567',
  patientCount: 0,
  locationMethod: 'gps' as const,
}

describe('Step3Review — inline false-report prevention', () => {
  it('submit is disabled when consent checkbox is unchecked', () => {
    render(
      <TestWrapper>
        <Step3Review onBack={vi.fn()} onSubmit={vi.fn()} reportData={REPORT_DATA} />
      </TestWrapper>,
    )

    const submitBtn = screen.getByRole('button', { name: /submit report/i })
    expect(submitBtn).toBeDisabled()
  })

  it('shows false-report warning inline when consent is checked', async () => {
    render(
      <TestWrapper>
        <Step3Review onBack={vi.fn()} onSubmit={vi.fn()} reportData={REPORT_DATA} />
      </TestWrapper>,
    )

    const consentCheckbox = screen.getByLabelText(
      /I confirm this report is accurate to the best of my knowledge/i,
    )
    await userEvent.click(consentCheckbox)

    expect(screen.getByText(/Are you sure this is a real emergency/i)).toBeInTheDocument()
    expect(
      screen.getByText(/False reports delay help for people who truly need it/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/Ang maling ulat ay nakakaantala/i)).toBeInTheDocument()
  })

  it('hides false-report warning when consent is unchecked', async () => {
    render(
      <TestWrapper>
        <Step3Review onBack={vi.fn()} onSubmit={vi.fn()} reportData={REPORT_DATA} />
      </TestWrapper>,
    )

    const consentCheckbox = screen.getByLabelText(
      /I confirm this report is accurate to the best of my knowledge/i,
    )
    await userEvent.click(consentCheckbox)
    expect(screen.getByText(/Are you sure this is a real emergency/i)).toBeInTheDocument()

    await userEvent.click(consentCheckbox)
    expect(screen.queryByText(/Are you sure this is a real emergency/i)).not.toBeInTheDocument()
  })

  it('calls onSubmit only after both checkboxes are checked and Submit is clicked', async () => {
    const onSubmit = vi.fn()
    render(
      <TestWrapper>
        <Step3Review onBack={vi.fn()} onSubmit={onSubmit} reportData={REPORT_DATA} />
      </TestWrapper>,
    )

    const consentCheckbox = screen.getByLabelText(
      /I confirm this report is accurate to the best of my knowledge/i,
    )
    await userEvent.click(consentCheckbox)

    const confirmCheckbox = screen.getByLabelText(/Yes, this is a real emergency/i)
    await userEvent.click(confirmCheckbox)

    const submitBtn = screen.getByRole('button', { name: /submit report/i })
    expect(submitBtn).not.toBeDisabled()
    await userEvent.click(submitBtn)

    expect(onSubmit).toHaveBeenCalledOnce()
  })

  it('submit stays disabled when only consent is checked without confirmation', async () => {
    const onSubmit = vi.fn()
    render(
      <TestWrapper>
        <Step3Review onBack={vi.fn()} onSubmit={onSubmit} reportData={REPORT_DATA} />
      </TestWrapper>,
    )

    const consentCheckbox = screen.getByLabelText(
      /I confirm this report is accurate to the best of my knowledge/i,
    )
    await userEvent.click(consentCheckbox)

    const submitBtn = screen.getByRole('button', { name: /submit report/i })
    expect(submitBtn).toBeDisabled()

    await userEvent.click(submitBtn)
    expect(onSubmit).not.toHaveBeenCalled()
  })
})

describe('False Report Gate - Double Submit Prevention', () => {
  it('prevents double-submit when user double-clicks Submit rapidly', async () => {
    const handleSubmit = vi.fn()
    render(
      <TestWrapper>
        <Step3Review onBack={vi.fn()} onSubmit={handleSubmit} reportData={REPORT_DATA} />
      </TestWrapper>,
    )

    const consentCheckbox = screen.getByLabelText(
      /I confirm this report is accurate to the best of my knowledge/i,
    )
    await userEvent.click(consentCheckbox)

    const confirmCheckbox = screen.getByLabelText(/Yes, this is a real emergency/i)
    await userEvent.click(confirmCheckbox)

    const submitBtn = screen.getByRole('button', { name: /submit report/i })

    await userEvent.click(submitBtn)
    await userEvent.click(submitBtn)

    expect(handleSubmit).toHaveBeenCalledTimes(1)
  })

  it('keeps submit disabled until both checkboxes are checked', async () => {
    const handleSubmit = vi.fn()
    render(
      <TestWrapper>
        <Step3Review onBack={vi.fn()} onSubmit={handleSubmit} reportData={REPORT_DATA} />
      </TestWrapper>,
    )

    // Only consent
    const consentCheckbox = screen.getByLabelText(
      /I confirm this report is accurate to the best of my knowledge/i,
    )
    await userEvent.click(consentCheckbox)
    expect(screen.getByRole('button', { name: /submit report/i })).toBeDisabled()

    // Check confirmation, then uncheck it
    const confirmCheckbox = screen.getByLabelText(/Yes, this is a real emergency/i)
    await userEvent.click(confirmCheckbox)
    await userEvent.click(confirmCheckbox)
    expect(screen.getByRole('button', { name: /submit report/i })).toBeDisabled()

    // Uncheck consent
    await userEvent.click(consentCheckbox)
    expect(screen.getByRole('button', { name: /submit report/i })).toBeDisabled()
  })
})
