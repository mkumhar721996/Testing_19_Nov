export interface WatchlistTicker {
  symbol: string
  createdAt: string
}

export type AddTickerResult =
  | { ok: true; ticker: WatchlistTicker }
  | { ok: false; code: 'invalid_symbol' | 'duplicate_symbol'; message: string }

const baseUrl = import.meta.env.VITE_RECORDS_API_URL ?? ''
const url = `${baseUrl}/watchlist`

export async function fetchWatchlist(): Promise<WatchlistTicker[]> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Watchlist request failed with status ${res.status}`)
  const body = (await res.json()) as { tickers: WatchlistTicker[] }
  return body.tickers
}

export async function addTicker(symbol: string): Promise<AddTickerResult> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol }),
  })
  if (res.status === 201) return { ok: true, ticker: (await res.json()) as WatchlistTicker }
  if (res.status === 400 || res.status === 409) {
    const { error } = (await res.json()) as {
      error: { code: 'invalid_symbol' | 'duplicate_symbol'; message: string }
    }
    return { ok: false, code: error.code, message: error.message }
  }
  throw new Error(`Add ticker request failed with status ${res.status}`)
}
