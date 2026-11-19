import { useCallback, useEffect, useState } from 'react'
import { addTicker, fetchWatchlist, type AddTickerResult, type WatchlistTicker } from './api'

export type WatchlistStatus = 'loading' | 'error' | 'ready'

export function useWatchlist() {
  const [status, setStatus] = useState<WatchlistStatus>('loading')
  const [tickers, setTickers] = useState<WatchlistTicker[]>([])

  const reload = useCallback(async () => {
    setStatus('loading')
    try {
      setTickers(await fetchWatchlist())
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const add = useCallback(async (symbol: string): Promise<AddTickerResult> => {
    const result = await addTicker(symbol)
    if (result.ok) setTickers((current) => [...current, result.ticker])
    return result
  }, [])

  return { status, tickers, reload, add }
}
