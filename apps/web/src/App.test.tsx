import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('renders the availability page under Settings', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'My availability' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Settings', hidden: true })).toHaveAttribute('aria-current', 'page')
  })
})
