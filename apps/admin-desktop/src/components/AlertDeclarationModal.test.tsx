import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AlertDeclarationModal } from '../components/AlertDeclarationModal'

describe('AlertDeclarationModal', () => {
  const mockOnClose = vi.fn()
  const mockOnDeclare = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('does not render when closed', () => {
    render(
      <AlertDeclarationModal
        open={false}
        currentLevel="normal"
        onClose={mockOnClose}
        onDeclare={mockOnDeclare}
      />,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders when open', () => {
    render(
      <AlertDeclarationModal
        open={true}
        currentLevel="normal"
        onClose={mockOnClose}
        onDeclare={mockOnDeclare}
      />,
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('shows current alert level', () => {
    render(
      <AlertDeclarationModal
        open={true}
        currentLevel="elevated"
        onClose={mockOnClose}
        onDeclare={mockOnDeclare}
      />,
    )
    expect(screen.getByText(/Current Level: Elevated/i)).toBeInTheDocument()
  })

  it('has level selector dropdown', () => {
    render(
      <AlertDeclarationModal
        open={true}
        currentLevel="normal"
        onClose={mockOnClose}
        onDeclare={mockOnDeclare}
      />,
    )
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('has justification text area for critical', async () => {
    const user = userEvent.setup()
    render(
      <AlertDeclarationModal
        open={true}
        currentLevel="normal"
        onClose={mockOnClose}
        onDeclare={mockOnDeclare}
      />,
    )

    await user.selectOptions(screen.getByRole('combobox'), 'critical')
    expect(screen.getByPlaceholderText(/Explain why/i)).toBeInTheDocument()
    expect(screen.getByText(/Justification \(required\)/i)).toBeInTheDocument()
  })

  it('calls onDeclare with correct payload for elevated', async () => {
    const user = userEvent.setup()
    render(
      <AlertDeclarationModal
        open={true}
        currentLevel="normal"
        onClose={mockOnClose}
        onDeclare={mockOnDeclare}
      />,
    )

    await user.selectOptions(screen.getByRole('combobox'), 'elevated')
    await user.click(screen.getByRole('button', { name: /confirm/i }))

    await waitFor(() => {
      expect(mockOnDeclare).toHaveBeenCalledWith({
        level: 'elevated',
        justification: '',
      })
    })
  })

  it('requires confirmation for critical', async () => {
    const user = userEvent.setup()
    render(
      <AlertDeclarationModal
        open={true}
        currentLevel="normal"
        onClose={mockOnClose}
        onDeclare={mockOnDeclare}
      />,
    )

    await user.selectOptions(screen.getByRole('combobox'), 'critical')
    await user.type(screen.getByPlaceholderText(/Explain why/i), 'Typhoon approaching')

    // Should show confirmation field
    expect(screen.getByPlaceholderText(/type DECLARE/i)).toBeInTheDocument()
  })

  it('closes when cancel clicked', async () => {
    const user = userEvent.setup()
    render(
      <AlertDeclarationModal
        open={true}
        currentLevel="normal"
        onClose={mockOnClose}
        onDeclare={mockOnDeclare}
      />,
    )

    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('has proper ARIA attributes', () => {
    render(
      <AlertDeclarationModal
        open={true}
        currentLevel="normal"
        onClose={mockOnClose}
        onDeclare={mockOnDeclare}
      />,
    )

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-labelledby')
  })
})
