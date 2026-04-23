import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ContactFields } from './ContactFields.js'

function renderContactFields(overrides: Partial<Parameters<typeof ContactFields>[0]> = {}) {
  const defaults = {
    reporterName: '',
    onReporterNameChange: vi.fn(),
    nameError: null as string | null,
    onNameErrorClear: vi.fn(),
    reporterMsisdn: '',
    onReporterMsisdnChange: vi.fn(),
    phoneError: null as string | null,
    onPhoneErrorClear: vi.fn(),
    anyoneHurt: false,
    onAnyoneHurtChange: vi.fn(),
    patientCount: 0,
    onPatientCountChange: vi.fn(),
  }

  return render(<ContactFields {...defaults} {...overrides} />)
}

describe('ContactFields', () => {
  it('renders all fields', () => {
    renderContactFields()

    expect(screen.getByPlaceholderText('Maria Dela Cruz')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('+63 912 345 6789')).toBeInTheDocument()
    expect(screen.getByText('Is anyone hurt?')).toBeInTheDocument()
  })

  it('calls onReporterNameChange and onNameErrorClear on name input change', () => {
    const onReporterNameChange = vi.fn()
    const onNameErrorClear = vi.fn()

    renderContactFields({ onReporterNameChange, onNameErrorClear })

    const input = screen.getByPlaceholderText('Maria Dela Cruz')
    fireEvent.change(input, { target: { value: 'Juan' } })

    expect(onReporterNameChange).toHaveBeenCalledExactlyOnceWith('Juan')
    expect(onNameErrorClear).toHaveBeenCalledTimes(1)
  })

  it('calls onReporterMsisdnChange and onPhoneErrorClear on phone input change', () => {
    const onReporterMsisdnChange = vi.fn()
    const onPhoneErrorClear = vi.fn()

    renderContactFields({ onReporterMsisdnChange, onPhoneErrorClear })

    const input = screen.getByPlaceholderText('+63 912 345 6789')
    fireEvent.change(input, { target: { value: '+639123456789' } })

    expect(onReporterMsisdnChange).toHaveBeenCalledExactlyOnceWith('+639123456789')
    expect(onPhoneErrorClear).toHaveBeenCalledTimes(1)
  })

  it('toggles "Yes" for anyone hurt', () => {
    const onAnyoneHurtChange = vi.fn()

    renderContactFields({ onAnyoneHurtChange })

    const yesButton = screen.getByRole('button', { name: 'Yes' })
    fireEvent.click(yesButton)

    expect(onAnyoneHurtChange).toHaveBeenCalledExactlyOnceWith(true)
  })

  it('toggles "No" for anyone hurt', () => {
    const onAnyoneHurtChange = vi.fn()

    renderContactFields({ anyoneHurt: true, onAnyoneHurtChange })

    const noButton = screen.getByRole('button', { name: 'No' })
    fireEvent.click(noButton)

    expect(onAnyoneHurtChange).toHaveBeenCalledExactlyOnceWith(false)
  })

  it('does not show patient counter when anyoneHurt is false', () => {
    renderContactFields({ anyoneHurt: false })

    expect(screen.queryByText('How many patients?')).not.toBeInTheDocument()
  })

  it('increments patient count', () => {
    const onPatientCountChange = vi.fn()

    renderContactFields({ anyoneHurt: true, patientCount: 2, onPatientCountChange })

    const incrementButton = screen.getByRole('button', { name: '+' })
    fireEvent.click(incrementButton)

    expect(onPatientCountChange).toHaveBeenCalledExactlyOnceWith(3)
  })

  it('decrements patient count', () => {
    const onPatientCountChange = vi.fn()

    renderContactFields({ anyoneHurt: true, patientCount: 2, onPatientCountChange })

    const decrementButton = screen.getByRole('button', { name: '−' })
    fireEvent.click(decrementButton)

    expect(onPatientCountChange).toHaveBeenCalledExactlyOnceWith(1)
  })

  it('disables decrement button at patient count 0', () => {
    renderContactFields({ anyoneHurt: true, patientCount: 0 })

    const decrementButton = screen.getByRole('button', { name: '−' })
    expect(decrementButton).toBeDisabled()
  })

  it('shows memory hint when hasMemory is true', () => {
    renderContactFields({ hasMemory: true })

    expect(screen.getByText('Pre-filled from your last report')).toBeInTheDocument()
  })

  it('does not show memory hint when hasMemory is false', () => {
    const { container } = renderContactFields({ hasMemory: false })

    expect(container.querySelector('.memory-hint')).not.toBeInTheDocument()
  })

  it('displays name error when provided', () => {
    renderContactFields({ nameError: 'Name is required' })

    expect(screen.getByTestId('name-error')).toHaveTextContent('Name is required')
  })

  it('displays phone error when provided', () => {
    renderContactFields({ phoneError: 'Invalid phone number' })

    expect(screen.getByTestId('phone-error')).toHaveTextContent('Invalid phone number')
  })

  it('does not display name error when null', () => {
    renderContactFields({ nameError: null })

    expect(screen.queryByTestId('name-error')).not.toBeInTheDocument()
  })

  it('does not display phone error when null', () => {
    renderContactFields({ phoneError: null })

    expect(screen.queryByTestId('phone-error')).not.toBeInTheDocument()
  })
})
