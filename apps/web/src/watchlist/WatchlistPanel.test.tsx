import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WatchlistPanel } from './WatchlistPanel'

const json = (status: number, body: unknown) =>
  Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) })

const tickers = (...symbols: string[]) => ({
  tickers: symbols.map((symbol) => ({ symbol, createdAt: '2026-01-01T00:00:00Z' })),
})

function mockFetch(handler: (url: string, init?: RequestInit) => Promise<unknown>) {
  const fetchMock = vi.fn(handler)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => vi.unstubAllGlobals())

describe('WatchlistPanel', () => {
  it('shows one row per ticker (AC 2)', async () => {
    mockFetch(() => json(200, tickers('AAPL', 'MSFT', 'NVDA')))
    render(<WatchlistPanel />)
    expect(await screen.findAllByRole('row')).toHaveLength(4)
    for (const s of ['AAPL', 'MSFT', 'NVDA']) expect(screen.getByText(s)).toBeInTheDocument()
  })

  it('shows the empty state with one Add ticker button (AC 3)', async () => {
    mockFetch(() => json(200, tickers()))
    render(<WatchlistPanel />)
    expect(await screen.findByText('No tickers on your watchlist')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Add ticker' })).toHaveLength(1)
  })

  it('adds a ticker to a populated list (AC 1)', async () => {
    const user = userEvent.setup()
    mockFetch((_url, init) =>
      init?.method === 'POST'
        ? json(201, { symbol: 'MSFT', createdAt: '2026-01-02T00:00:00Z' })
        : json(200, tickers('AAPL')),
    )
    render(<WatchlistPanel />)
    await user.click(await screen.findByRole('button', { name: 'Add ticker' }))
    await user.type(screen.getByLabelText('Symbol'), 'MSFT')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add ticker' }))
    expect(await screen.findByRole('cell', { name: 'MSFT' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('adds a ticker from the empty state (AC 4)', async () => {
    const user = userEvent.setup()
    mockFetch((_url, init) =>
      init?.method === 'POST'
        ? json(201, { symbol: 'NVDA', createdAt: '2026-01-02T00:00:00Z' })
        : json(200, tickers()),
    )
    render(<WatchlistPanel />)
    await user.click(await screen.findByRole('button', { name: 'Add ticker' }))
    await user.type(screen.getByLabelText('Symbol'), 'NVDA')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add ticker' }))
    expect(await screen.findByRole('cell', { name: 'NVDA' })).toBeInTheDocument()
    expect(screen.queryByText('No tickers on your watchlist')).not.toBeInTheDocument()
  })

  it('opens no detail view when a row is clicked (AC 5)', async () => {
    const user = userEvent.setup()
    const fetchMock = mockFetch(() => json(200, tickers('AAPL')))
    render(<WatchlistPanel />)
    await user.click(await screen.findByRole('cell', { name: 'AAPL' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(2)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it.each([
    [409, 'duplicate_symbol', 'AAPL is already on your watchlist.'],
    [400, 'invalid_symbol', 'Enter a ticker symbol of 1 to 5 letters, for example AAPL.'],
  ])('shows an inline error and leaves rows unchanged on %i (AC 6, 7, 8)', async (status, code, message) => {
    const user = userEvent.setup()
    const fetchMock = mockFetch((_url, init) =>
      init?.method === 'POST' ? json(status, { error: { code, message } }) : json(200, tickers('AAPL')),
    )
    render(<WatchlistPanel />)
    await user.click(await screen.findByRole('button', { name: 'Add ticker' }))
    await user.type(screen.getByLabelText('Symbol'), 'AAPL')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add ticker' }))
    const dialog = screen.getByRole('dialog')
    expect(await within(dialog).findByText(message)).toBeInTheDocument()
    expect(screen.getByLabelText('Symbol')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getAllByRole('row')).toHaveLength(2)
    expect(fetchMock.mock.calls.filter(([, init]) => !init?.method)).toHaveLength(1)
  })

  it('shows a loading indicator in the panel (AC 9)', () => {
    mockFetch(() => new Promise(() => {}))
    render(<WatchlistPanel />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading watchlist')
  })

  it('shows an error with Try again (AC 10)', async () => {
    mockFetch(() => Promise.reject(new Error('offline')))
    render(<WatchlistPanel />)
    expect(await screen.findByRole('alert')).toHaveTextContent('The watchlist could not be loaded.')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('reloads only the watchlist on Try again (AC 11, 12)', async () => {
    const user = userEvent.setup()
    let calls = 0
    const fetchMock = mockFetch(() => (calls++ === 0 ? Promise.reject(new Error('offline')) : json(200, tickers('AAPL'))))
    render(<WatchlistPanel />)
    await user.click(await screen.findByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('cell', { name: 'AAPL' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls.every(([url]) => String(url).endsWith('/watchlist'))).toBe(true)
  })
})
