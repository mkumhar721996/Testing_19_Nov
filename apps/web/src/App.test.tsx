import { fireEvent, render, screen } from '@testing-library/react'
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
})
