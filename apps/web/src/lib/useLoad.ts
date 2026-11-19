import { useCallback, useEffect, useState } from 'react'

export type Load<T> = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: T }

// Runs `fetcher` on mount and whenever `reload` is called.
export function useLoad<T>(fetcher: () => Promise<T>): [Load<T>, () => void] {
  const [state, setState] = useState<Load<T>>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let current = true
    fetcher().then(
      (data) => current && setState({ status: 'ready', data }),
      () => current && setState({ status: 'error' }),
    )
    return () => {
      current = false
    }
  }, [fetcher, attempt])

  const reload = useCallback(() => setAttempt((n) => n + 1), [])
  return [state, reload]
}
