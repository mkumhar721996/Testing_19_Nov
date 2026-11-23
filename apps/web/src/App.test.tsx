import { fireEvent, render, screen, within } from '@testing-library/react'
import App from './App'
import { jsonResponse, orgUser } from './testUtils'

afterEach(() => {
  vi.unstubAllGlobals()
  sessionStorage.clear()
})

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@test' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } })
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
}

vi.mock('./api/bookings', () => ({ listBookings: vi.fn(() => new Promise(() => {})) }))

describe('App', () => {
  it('starts on the sign-in page', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.queryByRole('banner')).not.toBeInTheDocument()
  })

  it('shows the role label in the header after signing in', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(200, { token: 't', user: orgUser })))
    render(<App />)
    fillAndSubmit()
    expect(await screen.findByRole('banner')).toHaveTextContent('Org Admin')
    expect(screen.queryByRole('heading', { name: 'Sign in' })).not.toBeInTheDocument()
  })

  it('stays on the sign-in page with no header after a 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(401, { code: 'invalid_credentials', message: 'Incorrect email or password.' })),
    )
    render(<App />)
    fillAndSubmit()
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password.')
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.queryByRole('banner')).not.toBeInTheDocument()
  })

  it('restores a stored session through /me', async () => {
    sessionStorage.setItem('session-token', 't')
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(200, orgUser)))
    render(<App />)
    expect(await screen.findByRole('banner')).toHaveTextContent('Org Admin')
  })

  it('drops a stored session the API rejects', async () => {
    sessionStorage.setItem('session-token', 't')
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(401, { code: 'unauthenticated', message: 'Sign in to continue.' })))
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(sessionStorage.getItem('session-token')).toBeNull()
  })

  describe('when signed in', () => {
  beforeEach(() => {
    sessionStorage.setItem('session-token', 't')
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => (url.endsWith('/me') ? Promise.resolve(jsonResponse(200, orgUser)) : new Promise(() => {}))),
    )
  })
  afterEach(() => {
    window.location.hash = ''
  })

  it('renders the four nav links in order with Records current', async () => {
    const { container } = render(<App />)
    await screen.findByRole('banner')
    const nav = container.querySelector<HTMLElement>('nav#main-nav')!
    const links = within(nav).getAllByRole('link', { hidden: true })
    expect(links.map((l) => l.textContent)).toEqual(['Records', 'Reports', 'Settings', 'Account'])
    expect(links[0]).toHaveAttribute('aria-current', 'page')
    expect(links[1]).not.toHaveAttribute('aria-current')
  })

  it('shows My bookings under Records and footer links', async () => {
    render(<App />)
    await screen.findByRole('banner')
    expect(screen.getByRole('heading', { name: 'My bookings' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Help' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Privacy' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Menu' })).toBeInTheDocument()
  })

  it('renders the availability page under Settings', async () => {
    window.location.hash = '#/settings'
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'My availability' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Settings', hidden: true })).toHaveAttribute('aria-current', 'page')
  })
  })
})
