import { useState } from 'react'
import { payBooking, type Booking } from '../../api/bookings'
import { formatMoney } from '../../lib/money'
import PaymentMethodCollector from './PaymentMethodCollector'
import './payments.css'

interface Props {
  booking: Booking
  onBack: () => void
  onPaid: () => void
}

const STILL_CONFIRMED_NOTE =
  'Your booking is still confirmed, but it is cancelled if unpaid 24 hours after confirmation.'

function formatHours(minutes: number): string {
  return `${Number((minutes / 60).toFixed(2))} h`
}

export default function PayBookingPage({ booking, onBack, onPaid }: Props) {
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastToken, setLastToken] = useState<string | null>(null)
  const [collectorKey, setCollectorKey] = useState(0)

  const amount = formatMoney(booking.amountDueMinor, booking.currency)
  const { pricing } = booking

  async function charge(token: string) {
    if (paying) return
    setPaying(true)
    setError(null)
    setLastToken(token)
    try {
      const outcome = await payBooking(booking.id, token)
      if (outcome.kind === 'paid') onPaid()
      else if (outcome.kind === 'deadline_passed') onBack()
      else setError(`${outcome.message} ${STILL_CONFIRMED_NOTE}`)
    } finally {
      setPaying(false)
    }
  }

  const summary =
    pricing.kind === 'fixed' ? (
      <>
        <div className="amount-row">
          <span>Service</span>
          <span>{booking.serviceName}</span>
        </div>
        <div className="amount-row">
          <span>Price shown at booking (fixed)</span>
          <span>{formatMoney(pricing.priceMinor, booking.currency)}</span>
        </div>
        <div className="divider" />
        <div className="amount-row">
          <strong>Amount to charge</strong>
          <strong className="amount-total">{amount}</strong>
        </div>
      </>
    ) : (
      <>
        <div className="amount-row">
          <span>Service</span>
          <span>{booking.serviceName}</span>
        </div>
        <div className="amount-row">
          <span>Hourly rate</span>
          <span>{formatMoney(pricing.rateMinor, booking.currency)}/h</span>
        </div>
        <div className="amount-row">
          <span>Service duration</span>
          <span>{formatHours(pricing.durationMinutes)}</span>
        </div>
        <div className="divider" />
        <div className="amount-row">
          <strong>
            Amount to charge ({formatMoney(pricing.rateMinor, booking.currency)} × {formatHours(pricing.durationMinutes)})
          </strong>
          <strong className="amount-total">{amount}</strong>
        </div>
      </>
    )

  return (
    <div className="stack-lg pay-page">
      <div className="page-head">
        <h1>Pay for {booking.serviceName}</h1>
        <button className="btn btn-ghost" type="button" onClick={onBack}>
          <svg className="icon" aria-hidden="true" viewBox="0 0 24 24">
            <path d="m12 19-7-7 7-7" />
            <path d="M19 12H5" />
          </svg>{' '}
          Back to my bookings
        </button>
      </div>
      <p className="text-muted">
        {booking.providerName} confirmed your booking. Pay now to complete it. Unpaid bookings are cancelled 24 hours
        after confirmation.
      </p>

      {error ? (
        <div className="stack">
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
          <div className="card stack-sm">
            <button className="btn btn-primary" type="button" disabled={paying} onClick={() => lastToken && charge(lastToken)}>
              {paying && <span className="spinner" aria-hidden="true" />}
              Try payment again
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              disabled={paying}
              onClick={() => {
                setError(null)
                setLastToken(null)
                setCollectorKey((k) => k + 1)
              }}
            >
              Use another payment method
            </button>
          </div>
          <div className="card">
            <div className="amount-row">
              <span className="text-muted">
                {booking.serviceName} · {pricing.kind === 'fixed' ? 'Fixed price' : 'Hourly rate'}
              </span>
              <strong>{amount}</strong>
            </div>
          </div>
        </div>
      ) : (
        <div className="stack">
          <div className="card stack-sm">{summary}</div>
          <PaymentMethodCollector key={collectorKey} onToken={charge}>
            <button className="btn btn-primary" type="submit" disabled={paying}>
              {paying && <span className="spinner" aria-hidden="true" />}
              Pay {amount}
            </button>
          </PaymentMethodCollector>
        </div>
      )}
    </div>
  )
}
