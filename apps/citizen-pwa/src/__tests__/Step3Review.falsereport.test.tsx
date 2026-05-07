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

describe('Step3Review — false-report prevention confirmation', () => {
  it('does NOT call onSubmit directly when Submit is clicked', async () => {
    const onSubmit = vi.fn()
    render(
      <TestWrapper>
        <Step3Review onBack={vi.fn()} onSubmit={onSubmit} reportData={REPORT_DATA} />
      </TestWrapper>,
    )

    // Check the consent checkbox first
    const checkbox = screen.getByRole('checkbox')
    await userEvent.click(checkbox)

    // Click the initial submit button
    const submitBtn = screen.getByRole('button', { name: /submit report/i })
    await userEvent.click(submitBtn)

    // onSubmit should NOT be called yet — confirmation step should be shown
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('shows false-report confirmation panel after clicking Submit', async () => {
    render(
      <TestWrapper>
        <Step3Review onBack={vi.fn()} onSubmit={vi.fn()} reportData={REPORT_DATA} />
      </TestWrapper>,
    )

    const checkbox = screen.getByRole('checkbox')
    await userEvent.click(checkbox)

    const submitBtn = screen.getByRole('button', { name: /submit report/i })
    await userEvent.click(submitBtn)

    expect(screen.getByText(/are you sure this is a real emergency/i)).toBeInTheDocument()
    expect(screen.getByText(/false reports delay help/i)).toBeInTheDocument()
    expect(screen.getByText(/Ang maling ulat/i)).toBeInTheDocument()
  })

  it('calls onSubmit only after clicking "Yes, Submit" in confirmation', async () => {
    const onSubmit = vi.fn()
    render(
      <TestWrapper>
        <Step3Review onBack={vi.fn()} onSubmit={onSubmit} reportData={REPORT_DATA} />
      </TestWrapper>,
    )

    const checkbox = screen.getByRole('checkbox')
    await userEvent.click(checkbox)

    const submitBtn = screen.getByRole('button', { name: /submit report/i })
    await userEvent.click(submitBtn)

    // Now confirm
    const confirmBtn = screen.getByRole('button', { name: /yes, submit/i })
    await userEvent.click(confirmBtn)

    expect(onSubmit).toHaveBeenCalledOnce()
  })

  it('"Cancel, Go Back" hides the confirmation panel without submitting', async () => {
    const onSubmit = vi.fn()
    render(
      <TestWrapper>
        <Step3Review onBack={vi.fn()} onSubmit={onSubmit} reportData={REPORT_DATA} />
      </TestWrapper>,
    )

    const checkbox = screen.getByRole('checkbox')
    await userEvent.click(checkbox)

    const submitBtn = screen.getByRole('button', { name: /submit report/i })
    await userEvent.click(submitBtn)

    const cancelBtn = screen.getByRole('button', { name: /cancel, go back/i })
    await userEvent.click(cancelBtn)

    expect(onSubmit).not.toHaveBeenCalled()
    // Back to normal view
    expect(screen.queryByText(/are you sure this is a real emergency/i)).not.toBeInTheDocument()
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

    const checkbox = screen.getByRole('checkbox')
    await userEvent.click(checkbox)

    const submitBtn = screen.getByRole('button', { name: /submit report/i })

    // Rapid clicks
    await userEvent.click(submitBtn)
    await userEvent.click(submitBtn)

    // Confirmation panel should be shown, but onSubmit should not have been called
    expect(handleSubmit).not.toHaveBeenCalled()
    expect(screen.getByText(/are you sure this is a real emergency/i)).toBeInTheDocument()
  })

  it('prevents double-submit on confirmation button', async () => {
    const handleSubmit = vi.fn()
    render(
      <TestWrapper>
        <Step3Review onBack={vi.fn()} onSubmit={handleSubmit} reportData={REPORT_DATA} />
      </TestWrapper>,
    )

    const checkbox = screen.getByRole('checkbox')
    await userEvent.click(checkbox)

    const submitBtn = screen.getByRole('button', { name: /submit report/i })
    await userEvent.click(submitBtn)

    const confirmBtn = screen.getByRole('button', { name: /yes, submit/i })

    // Rapid clicks on confirm button
    await userEvent.click(confirmBtn)
    await userEvent.click(confirmBtn)

    // Should only call once
    expect(handleSubmit).toHaveBeenCalledTimes(1)
  })

  it('requires explicit confirmation - Enter key does NOT bypass confirmation', async () => {
    const handleSubmit = vi.fn()
    render(
      <TestWrapper>
        <Step3Review onBack={vi.fn()} onSubmit={handleSubmit} reportData={REPORT_DATA} />
      </TestWrapper>,
    )

    const checkbox = screen.getByRole('checkbox')
    await userEvent.click(checkbox)

    const submitBtn = screen.getByRole('button', { name: /submit report/i })
    await userEvent.click(submitBtn)

    // Confirmation panel should be visible
    expect(screen.getByText(/are you sure this is a real emergency/i)).toBeInTheDocument()

    // Press Enter on the submit button again - should not submit
    await userEvent.type(submitBtn, '{Enter}')

    // Confirmation panel should still be visible, no submission
    expect(screen.getByText(/are you sure this is a real emergency/i)).toBeInTheDocument()
    expect(handleSubmit).not.toHaveBeenCalled()
  })
})
