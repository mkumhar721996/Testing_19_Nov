import { render, screen } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import App from './App'

afterEach(() => {
  vi.unstubAllGlobals()
  window.location.hash = ''
})

describe('App', () => {
  it('renders the top bar navigation in order', () => {
    render(<App />)
    const keys = screen
      .getAllByRole('link')
      .map((l) => l.getAttribute('data-nav-key'))
      .filter(Boolean)
    expect(keys).toEqual(['records', 'reports', 'settings', 'account'])
  })

  it('routes #/providers/:id to the provider profile', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'p1', displayName: 'Whitfield' }) }))
    window.location.hash = '#/providers/p1'
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Whitfield' })).toBeInTheDocument()
  })
})
