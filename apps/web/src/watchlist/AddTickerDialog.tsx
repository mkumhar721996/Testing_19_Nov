import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import type { AddTickerResult } from './api'

interface Props {
  onAdd: (symbol: string) => Promise<AddTickerResult>
  onClose: () => void
}

export function AddTickerDialog({ onAdd, onClose }: Props) {
  const [symbol, setSymbol] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null
    inputRef.current?.focus()
    return () => trigger?.focus?.()
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setError(null)
    try {
      const result = await onAdd(symbol)
      if (result.ok) onClose()
      else setError(result.message)
    } catch {
      setError('The ticker could not be added. Check your connection and try again.')
    } finally {
      setPending(false)
    }
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('input, button:not([disabled])')
    if (!focusable?.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-ticker-title"
        onKeyDown={onKeyDown}
      >
        <form onSubmit={submit} noValidate>
          <div className="modal-header" id="add-ticker-title">
            Add ticker
          </div>
          <div className="modal-body">
            <div className="field">
              <label className="field-label" htmlFor="add-ticker-symbol">
                Symbol
              </label>
              <input
                ref={inputRef}
                id="add-ticker-symbol"
                className={error ? 'input is-invalid' : 'input'}
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                autoComplete="off"
                aria-invalid={error ? 'true' : undefined}
                aria-describedby={error ? 'add-ticker-error' : 'add-ticker-hint'}
              />
              <div className="field-hint" id="add-ticker-hint">
                For example AAPL
              </div>
              {error && (
                <div className="field-error" id="add-ticker-error">
                  {error}
                </div>
              )}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={pending}>
              {pending && <span className="spinner" aria-hidden="true" />}
              Add ticker
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
