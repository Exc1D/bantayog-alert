import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const authState = vi.hoisted(() => {
  const claims: { role: string; municipalityId?: string; agencyId?: string } = {
    role: 'municipal_admin',
    municipalityId: 'daet',
  }
  return { claims }
})

vi.mock('@bantayog/shared-ui', () => ({
  useAuth: () => ({
    claims: authState.claims,
  }),
}))

vi.mock('../components/EmergencyDeclarationModal', () => ({
  EmergencyDeclarationModal: () => null,
}))

import { Sidebar } from '../components/Sidebar'

function renderSidebar() {
  return render(
    <MemoryRouter>
      <Sidebar />
    </MemoryRouter>,
  )
}

describe('Sidebar scope', () => {
  beforeEach(() => {
    authState.claims = { role: 'municipal_admin', municipalityId: 'daet' }
  })

  it('shows triage but hides agency queue for municipal admins', () => {
    renderSidebar()
    expect(screen.getByText('Triage Queue')).toBeInTheDocument()
    expect(screen.queryByText('Agency Queue')).not.toBeInTheDocument()
    expect(screen.queryByText('Roster')).not.toBeInTheDocument()
  })

  it('shows agency queue but hides triage for agency admins', () => {
    authState.claims = { role: 'agency_admin', agencyId: 'bfp-daet' }
    renderSidebar()
    expect(screen.getByText('Agency Queue')).toBeInTheDocument()
    expect(screen.queryByText('Triage Queue')).not.toBeInTheDocument()
    expect(screen.getByText('Roster')).toBeInTheDocument()
  })

  it('shows triage but hides agency queue and roster for provincial superadmins', () => {
    authState.claims = { role: 'provincial_superadmin' }
    renderSidebar()
    expect(screen.getByText('Triage Queue')).toBeInTheDocument()
    expect(screen.queryByText('Agency Queue')).not.toBeInTheDocument()
    expect(screen.queryByText('Roster')).not.toBeInTheDocument()
  })
})
