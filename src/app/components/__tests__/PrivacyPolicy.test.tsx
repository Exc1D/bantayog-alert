import { render, screen } from '@testing-library/react'
import { PrivacyPolicy } from '../PrivacyPolicy'

describe('PrivacyPolicy', () => {
  it('should render privacy policy title', () => {
    render(<PrivacyPolicy />)
    expect(screen.getByText(/privacy policy/i)).toBeInTheDocument()
  })

  it('should render data collection section', () => {
    render(<PrivacyPolicy />)
    expect(screen.getByText(/what data we collect/i)).toBeInTheDocument()
  })

  it('should render user rights section', () => {
    render(<PrivacyPolicy />)
    expect(screen.getByText(/your rights/i)).toBeInTheDocument()
  })

  it('should render contact information', () => {
    render(<PrivacyPolicy />)
    expect(screen.getByText(/contact us/i)).toBeInTheDocument()
    // Email appears multiple times (Right to Object and Contact Us sections)
    expect(screen.getAllByText(/privacy@bantayogalert.gov.ph/i)).toHaveLength(2)
  })
})
