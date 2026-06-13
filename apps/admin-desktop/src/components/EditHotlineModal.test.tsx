import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const useAuthMock = vi.fn()
vi.mock('@bantayog/shared-ui', () => ({
  useAuth: () => useAuthMock(),
}))

const updateMunicipalityContactMock = vi.fn()
vi.mock('../services/callables', () => ({
  callables: {
    updateMunicipalityContact: (payload: unknown) => updateMunicipalityContactMock(payload),
  },
}))

const getDocMock = vi.fn()
vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => ({ path: args.slice(1).join('/') }),
  getDoc: (ref: unknown) => getDocMock(ref),
}))

vi.mock('../app/firebase', () => ({ db: {} }))

import { EditHotlineModal } from './EditHotlineModal'

function snapshot(data: Record<string, unknown> | null) {
  return {
    exists: () => data !== null,
    data: () => data,
  }
}

const MUNICIPAL_ADMIN = {
  claims: { role: 'municipal_admin', municipalityId: 'daet', accountStatus: 'active' },
}
const SUPERADMIN = { claims: { role: 'provincial_superadmin', accountStatus: 'active' } }

beforeEach(() => {
  useAuthMock.mockReset()
  updateMunicipalityContactMock.mockReset()
  getDocMock.mockReset()
  getDocMock.mockResolvedValue(
    snapshot({ mdrrmoLabel: 'Daet MDRRMO', mdrrmoHotline: '(054) 721-1216' }),
  )
})

describe('EditHotlineModal', () => {
  it('renders nothing when closed', () => {
    useAuthMock.mockReturnValue(MUNICIPAL_ADMIN)
    const { container } = render(<EditHotlineModal open={false} onClose={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('locks the municipality for a municipal admin and prefills existing contact', async () => {
    useAuthMock.mockReturnValue(MUNICIPAL_ADMIN)
    render(<EditHotlineModal open onClose={vi.fn()} />)

    // No municipality picker for a municipal admin.
    expect(screen.queryByRole('combobox', { name: /municipality/i })).not.toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByLabelText(/office name/i)).toHaveValue('Daet MDRRMO')
    })
    expect(screen.getByLabelText(/hotline number/i)).toHaveValue('(054) 721-1216')
  })

  it('shows a municipality picker for a provincial superadmin', async () => {
    useAuthMock.mockReturnValue(SUPERADMIN)
    render(<EditHotlineModal open onClose={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /municipality/i })).toBeInTheDocument()
    })
  })

  it('notes when no hotline is set yet', async () => {
    useAuthMock.mockReturnValue(MUNICIPAL_ADMIN)
    getDocMock.mockResolvedValue(snapshot({ label: 'Daet' }))
    render(<EditHotlineModal open onClose={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText(/no hotline set/i)).toBeInTheDocument()
    })
  })

  it('disables save while the hotline is invalid', async () => {
    const user = userEvent.setup()
    useAuthMock.mockReturnValue(MUNICIPAL_ADMIN)
    render(<EditHotlineModal open onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByLabelText(/hotline number/i)).toHaveValue('(054) 721-1216')
    })

    const hotline = screen.getByLabelText(/hotline number/i)
    await user.clear(hotline)
    await user.type(hotline, 'call us maybe')

    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled()
  })

  it('submits the trimmed payload and shows success', async () => {
    const user = userEvent.setup()
    useAuthMock.mockReturnValue(MUNICIPAL_ADMIN)
    updateMunicipalityContactMock.mockResolvedValue({
      municipalityId: 'daet',
      mdrrmoLabel: 'Daet DRRMO',
      mdrrmoHotline: '(054) 555-1000',
      updatedAt: 1,
    })
    render(<EditHotlineModal open onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByLabelText(/office name/i)).toHaveValue('Daet MDRRMO')
    })

    const label = screen.getByLabelText(/office name/i)
    const hotline = screen.getByLabelText(/hotline number/i)
    await user.clear(label)
    await user.type(label, '  Daet DRRMO  ')
    await user.clear(hotline)
    await user.type(hotline, '(054) 555-1000')

    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(updateMunicipalityContactMock).toHaveBeenCalledWith({
        municipalityId: 'daet',
        mdrrmoLabel: 'Daet DRRMO',
        mdrrmoHotline: '(054) 555-1000',
      })
    })
    expect(await screen.findByText(/citizens see the change/i)).toBeInTheDocument()
  })

  it('surfaces a failure and re-enables save', async () => {
    const user = userEvent.setup()
    useAuthMock.mockReturnValue(MUNICIPAL_ADMIN)
    updateMunicipalityContactMock.mockRejectedValue(new Error('network down'))
    render(<EditHotlineModal open onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByLabelText(/hotline number/i)).toHaveValue('(054) 721-1216')
    })

    const hotline = screen.getByLabelText(/hotline number/i)
    await user.clear(hotline)
    await user.type(hotline, '(054) 555-2000')
    await user.click(screen.getByRole('button', { name: /save/i }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save/i })).toBeEnabled()
  })

  it('shows a retry path when the prefill read fails', async () => {
    useAuthMock.mockReturnValue(MUNICIPAL_ADMIN)
    getDocMock.mockRejectedValueOnce(new Error('read denied'))
    render(<EditHotlineModal open onClose={vi.fn()} />)

    expect(await screen.findByRole('button', { name: /try again/i })).toBeInTheDocument()
  })
})
