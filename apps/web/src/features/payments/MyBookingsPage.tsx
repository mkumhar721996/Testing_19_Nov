import { useCallback, useEffect, useState } from 'react'
import { listBookings, type Booking } from '../../api/bookings'
import { formatMoney } from '../../lib/money'
import './payments.css'

interface Props {
  onPay: (booking: Booking) => void
}

const DAY_MS = 24 * 60 * 60 * 1000

type Load = { state: 'loading' } | { state: 'error' } | { state: 'ready'; bookings: Booking[] }

function priceText(booking: Booking): string {
  const { pricing, currency } = booking
  return pricing.kind === 'fixed'
    ? `Fixed price ${formatMoney(pricing.priceMinor, currency)}`
    : `${formatMoney(pricing.rateMinor, currency)}/h`
}

function BookingCard({ booking, onPay }: { booking: Booking; onPay: Props['onPay'] }) {
  let badge: { className: string; label: string }
  let detail: string
  switch (booking.status) {
    case 'confirmed_payment_due':
      badge = { className: 'badge-warning', label: 'Confirmed, payment due' }
      detail = `Confirmed by ${booking.providerName} · ${priceText(booking)} · Pay within 24 hours`
      break
    case 'paid':
      badge = { className: 'badge-success', label: 'Paid' }
      detail = `Paid ${formatMoney(booking.amountDueMinor, booking.currency)}. Your booking is confirmed.`
      break
    case 'declined':
      badge = { className: 'badge-neutral', label: 'Declined' }
      detail = 'Provider declined this request. No charge was made.'
      break
    case 'expired':
      badge = { className: 'badge-neutral', label: 'Expired' }
      detail = 'This request expired before the provider confirmed. No charge was made.'
      break
    case 'cancelled':
      badge = { className: 'badge-danger', label: 'Cancelled' }
      detail = 'Cancelled because payment was not completed within 24 hours. No charge was made.'
      break
    default:
      badge = { className: 'badge-neutral', label: 'Requested' }
      detail = 'Waiting for the provider to respond. You pay only once they confirm.'
  }
  return (
    <li>
      <div className="card stack-sm">
        <div className="card-title-row">
          <strong>{booking.serviceName}</strong>
          <span className={`badge ${badge.className}`}>{badge.label}</span>
        </div>
        <p className="text-muted">{detail}</p>
        {booking.status === 'confirmed_payment_due' && (
          <div>
            <button className="btn btn-primary" type="button" onClick={() => onPay(booking)}>
              Pay now
            </button>
          </div>
        )}
      </div>
    </li>
  )
}

export default function MyBookingsPage({ onPay }: Props) {
  const [load, setLoad] = useState<Load>({ state: 'loading' })

  const reload = useCallback(async () => {
    setLoad({ state: 'loading' })
    try {
      setLoad({ state: 'ready', bookings: await listBookings() })
    } catch {
      setLoad({ state: 'error' })
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  let body
  if (load.state === 'loading') {
    body = (
      <div className="stack" aria-busy="true" aria-label="Loading bookings">
        <span className="skeleton" />
        <span className="skeleton" />
        <span className="skeleton" />
      </div>
    )
  } else if (load.state === 'error') {
    body = (
      <div className="stack">
        <div className="alert alert-danger" role="alert">
          We could not load your bookings. Check your connection and reload.
        </div>
        <div>
          <button className="btn btn-secondary" type="button" onClick={() => void reload()}>
            Reload bookings
          </button>
        </div>
      </div>
    )
  } else if (load.bookings.length === 0) {
    body = (
      <div className="empty-state">
        <p>No bookings yet. Requests you send appear here, and you pay only once a provider confirms.</p>
        <button className="btn btn-primary" type="button">
          Browse services
        </button>
      </div>
    )
  } else {
    const recentlyCancelled = load.bookings.filter(
      (b) =>
        b.status === 'cancelled' &&
        b.cancelReason === 'payment_timeout' &&
        b.cancelledAt !== null &&
        Date.now() - new Date(b.cancelledAt).getTime() < DAY_MS,
    )
    body = (
      <div className="stack">
        {recentlyCancelled.map((b) => (
          <div key={b.id} className="alert alert-warning" role="status">
            Your {b.serviceName} booking was cancelled because payment was not completed within 24 hours. We emailed
            you a cancellation notice.
          </div>
        ))}
        <ul className="booking-list stack" aria-label="Bookings">
          {load.bookings.map((b) => (
            <BookingCard key={b.id} booking={b} onPay={onPay} />
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div className="stack-lg">
      <h1>My bookings</h1>
      {body}
    </div>
  )
}
