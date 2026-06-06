import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DeclareAlertModal } from './DeclareAlertModal'
import { DeclareAlertUnsavedChangesDialog } from './declare-alert-dialogs'

const mockDeclareAlert = vi.hoisted(() => vi.fn())

vi.mock('../services/callables', () => ({
  callables: {
    declareAlert: mockDeclareAlert,
  },
}))

describe('DeclareAlertModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reviews scope before declaring and keeps failures visible in the modal', async () => {
    const user = userEvent.setup()
    const onError = vi.fn()
    let rejectDeclare: ((error: Error) => void) | undefined
    mockDeclareAlert.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectDeclare = reject
        }),
    )

    render(<DeclareAlertModal open onClose={vi.fn()} onSuccess={vi.fn()} onError={onError} />)

    await user.selectOptions(screen.getByLabelText('Alert Type (required)'), 'flood_advisory')
    await user.click(screen.getByLabelText('Daet'))
    await user.type(
      screen.getByLabelText('Message (required)'),
      'Floodwaters are rising near low-lying roads.',
    )

    expect(screen.getByText('Selected municipalities: Daet')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Review declaration' }))

    expect(mockDeclareAlert).not.toHaveBeenCalled()
    const confirmDialog = screen.getByRole('alertdialog', { name: 'Declare public alert?' })
    expect(within(confirmDialog).getByText('Flood Advisory / Warning')).toBeInTheDocument()
    expect(within(confirmDialog).getByText('Daet')).toBeInTheDocument()

    await user.click(within(confirmDialog).getByRole('button', { name: 'Declare public alert' }))

    expect(within(confirmDialog).getByRole('button', { name: 'Declaring alert...' })).toBeDisabled()
    rejectDeclare?.(new Error('Callable outage'))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Alert was not declared. Callable outage')
    })
    expect(onError).toHaveBeenCalledWith('Callable outage')
    expect(
      screen.queryByRole('alertdialog', { name: 'Declare public alert?' }),
    ).not.toBeInTheDocument()
  })

  it('keeps the unsaved changes dialog behavior in a small component', async () => {
    const user = userEvent.setup()
    const onKeepEditing = vi.fn()
    const onDiscard = vi.fn()

    render(<DeclareAlertUnsavedChangesDialog onKeepEditing={onKeepEditing} onDiscard={onDiscard} />)

    await user.click(screen.getByRole('button', { name: 'Keep Editing' }))
    expect(onKeepEditing).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('button', { name: 'Discard Changes' }))
    expect(onDiscard).toHaveBeenCalledOnce()
  })
})
