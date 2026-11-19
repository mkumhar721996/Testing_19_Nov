import { render, screen } from '@testing-library/react'
import { OrganizationDetailPanel } from './OrganizationDetailPanel'

const org = {
  name: 'Riverside Trust',
  primaryContact: 'Alex Kim',
  consultant: { name: 'Priya Raman', email: 'priya.raman@wfc.example', phone: '+44 20 7946 0112' },
}

describe('OrganizationDetailPanel', () => {
  it.each(['WFC Admin', 'Fundraising Consultant', 'Org Admin', 'Org Staff'])(
    'shows the consultant section for %s',
    () => {
      render(<OrganizationDetailPanel organization={org} />)
      expect(screen.getByRole('heading', { name: 'Fundraising consultant' })).toBeInTheDocument()
    },
  )

  it('places the consultant section below the existing fields', () => {
    render(<OrganizationDetailPanel organization={org} />)
    const contactLabel = screen.getByText('Primary contact')
    const heading = screen.getByRole('heading', { name: 'Fundraising consultant' })
    expect(contactLabel.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('shows Unassigned when the organization has no consultant', () => {
    render(<OrganizationDetailPanel organization={{ ...org, consultant: null }} />)
    expect(screen.getByText('Unassigned')).toBeInTheDocument()
  })
})
