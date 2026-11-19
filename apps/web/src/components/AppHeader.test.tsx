import { render, screen } from '@testing-library/react'
import AppHeader from './AppHeader'
import { orgUser } from '../testUtils'

describe('AppHeader', () => {
  it.each(['WFC Admin', 'Fundraising Consultant', 'Org Admin', 'Org Staff'])('shows the role %s', (label) => {
    render(<AppHeader user={{ ...orgUser, roleLabel: label }} onSignOut={vi.fn()} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('shows the organization when there is one', () => {
    render(<AppHeader user={orgUser} onSignOut={vi.fn()} />)
    expect(screen.getByText('Org One')).toBeInTheDocument()
  })

  it('shows no organization data when there is none', () => {
    render(<AppHeader user={{ ...orgUser, organization: null }} onSignOut={vi.fn()} />)
    expect(screen.queryByText('Org One')).not.toBeInTheDocument()
  })

  it('signs out', () => {
    const onSignOut = vi.fn()
    render(<AppHeader user={orgUser} onSignOut={onSignOut} />)
    screen.getByRole('button', { name: 'Sign out' }).click()
    expect(onSignOut).toHaveBeenCalledOnce()
  })
})
