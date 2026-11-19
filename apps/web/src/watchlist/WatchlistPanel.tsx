import { useState } from 'react'
import { AddTickerDialog } from './AddTickerDialog'
import { useWatchlist } from './useWatchlist'

export function WatchlistPanel() {
  const { status, tickers, reload, add } = useWatchlist()
  const [adding, setAdding] = useState(false)
  const empty = status === 'ready' && tickers.length === 0

  const addButton = (className: string) => (
    <button type="button" className={`btn ${className}`} onClick={() => setAdding(true)}>
      Add ticker
    </button>
  )

  return (
    <section className="card" aria-labelledby="watchlist-title">
      <div className="panel-head">
        <h2 id="watchlist-title">Watchlist</h2>
        {status === 'ready' && !empty && addButton('btn-secondary')}
      </div>

      {status === 'loading' && (
        <div role="status" className="skel-stack">
          <span className="sr-only">Loading watchlist…</span>
          <div className="skeleton" style={{ height: 'var(--control-height-lg)' }} />
          <div className="skeleton" style={{ height: 'var(--control-height-lg)' }} />
          <div className="skeleton" style={{ height: 'var(--control-height-lg)' }} />
        </div>
      )}

      {status === 'error' && (
        <div className="alert alert-danger" role="alert">
          <div className="stack stack-sm">
            <strong>The watchlist could not be loaded.</strong>
            <span>Check your connection and try again.</span>
            <div>
              <button type="button" className="btn btn-secondary" onClick={() => void reload()}>
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {empty && (
        <div className="empty-state">
          <h2>No tickers on your watchlist</h2>
          <p>Add a ticker to follow it here.</p>
          {addButton('btn-primary')}
        </div>
      )}

      {status === 'ready' && !empty && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Symbol</th>
              </tr>
            </thead>
            <tbody>
              {tickers.map((t) => (
                <tr key={t.symbol}>
                  <td>{t.symbol}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adding && <AddTickerDialog onAdd={add} onClose={() => setAdding(false)} />}
    </section>
  )
}
