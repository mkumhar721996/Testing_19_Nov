import { render, screen, within } from '@testing-library/react'
import { FundraisingConsultantSection } from './FundraisingConsultantSection'

const full = {
  name: 'Priya Raman',
  email: 'priya.raman@wfc.example',
  phone: '+44 20 7946 0112',
}

const row = (label: string) => screen.getByText(label).closest('div') as HTMLElement

describe('FundraisingConsultantSection', () => {
  it('shows a section heading', () => {
    render(<FundraisingConsultantSection consultant={full} />)
    expect(screen.getByRole('heading', { name: 'Fundraising consultant' })).toBeInTheDocument()
  })

  it('shows name, email and phone one below another', () => {
    render(<FundraisingConsultantSection consultant={full} />)
    expect(screen.getByText('Priya Raman')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: full.email })).toHaveAttribute(
      'href',
      'mailto:priya.raman@wfc.example',
    )
    expect(screen.getByRole('link', { name: full.phone })).toHaveAttribute(
      'href',
      'tel:+442079460112',
    )
    expect(screen.getAllByRole('term').map((t) => t.textContent)).toEqual([
      'Name',
      'Email',
      'Phone',
    ])
  })

  it('has no edit control', () => {
    render(<FundraisingConsultantSection consultant={full} />)
    const section = screen.getByRole('region', { name: 'Fundraising consultant' })
    expect(within(section).queryByRole('button')).toBeNull()
    expect(within(section).queryByRole('textbox')).toBeNull()
    expect(within(section).queryByRole('combobox')).toBeNull()
  })

  it.each([null, undefined])('shows muted Unassigned for %s', (consultant) => {
    render(<FundraisingConsultantSection consultant={consultant} />)
    expect(screen.getByText('Unassigned')).toHaveClass('consultant-muted')
    expect(screen.queryByRole('term')).toBeNull()
  })

  it.each(['', null, undefined, '   '])('shows Not on record for email %j', (email) => {
    render(
      <FundraisingConsultantSection
        consultant={{ name: 'Daniel Okafor', email, phone: '+44 113 496 0230' }}
      />,
    )
    expect(within(row('Email')).getByText('Not on record')).toBeInTheDocument()
    expect(within(row('Phone')).queryByText('Not on record')).toBeNull()
  })

  it.each(['', null, undefined, '   '])('shows Not on record for phone %j', (phone) => {
    render(
      <FundraisingConsultantSection
        consultant={{ name: 'Marta Lindqvist', email: 'marta.lindqvist@wfc.example', phone }}
      />,
    )
    expect(within(row('Phone')).getByText('Not on record')).toBeInTheDocument()
    expect(within(row('Email')).queryByText('Not on record')).toBeNull()
  })

  it('shows Not on record twice with neither email nor phone', () => {
    render(<FundraisingConsultantSection consultant={{ name: 'Sam Lee' }} />)
    expect(screen.getAllByText('Not on record')).toHaveLength(2)
  })
})
