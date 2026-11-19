import { render, screen, within } from '@testing-library/react'
import App from './App'

vi.mock('./api/bookings', () => ({ listBookings: vi.fn(() => new Promise(() => {})) }))

describe('App shell', () => {
  it('renders the four nav links in order with Records current', () => {
    const { container } = render(<App />)
    const nav = container.querySelector<HTMLElement>('nav#main-nav')!
    const links = within(nav).getAllByRole('link', { hidden: true })
    expect(links.map((l) => l.textContent)).toEqual(['Records', 'Reports', 'Settings', 'Account'])
    expect(links[0]).toHaveAttribute('aria-current', 'page')
    expect(links[1]).not.toHaveAttribute('aria-current')
  })

  it('shows My bookings under Records and footer links', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'My bookings' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Help' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Privacy' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Menu' })).toBeInTheDocument()
  })
})
