import { fireEvent, render, screen } from '@testing-library/react'
import SignInPage from './SignInPage'
import { AuthProvider } from '../auth/AuthContext'
import { jsonResponse } from '../testUtils'

function setup(response: Response) {
  vi.stubGlobal('fetch', vi.fn(async () => response))
  render(
    <AuthProvider>
      <SignInPage />
    </AuthProvider>,
  )
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@test' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } })
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
}

afterEach(() => {
  vi.unstubAllGlobals()
  sessionStorage.clear()
})

describe('SignInPage', () => {
  it('shows the role message for an account with no role', async () => {
    setup(
      jsonResponse(403, {
        code: 'no_role',
        message: 'Your account has no role assigned. Contact your administrator.',
      }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your account has no role assigned. Contact your administrator.',
    )
  })

  it('shows a generic error, stays on the page and clears the password', async () => {
    setup(jsonResponse(401, { code: 'invalid_credentials', message: 'Incorrect email or password.' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password.')
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toHaveValue('')
    expect(sessionStorage.length).toBe(0)
  })
})
