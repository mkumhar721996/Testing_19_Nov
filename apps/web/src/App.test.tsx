import { render, screen } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import App from './App'

afterEach(() => vi.unstubAllGlobals())

describe('App', () => {
  it('renders the heading and the watchlist panel', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ tickers: [] }) })),
    )
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Stock market dashboard' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Watchlist' })).toBeInTheDocument()
    expect(await screen.findByText('No tickers on your watchlist')).toBeInTheDocument()
  })
})
