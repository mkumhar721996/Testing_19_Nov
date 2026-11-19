export type Pricing =
  | { kind: 'fixed'; priceMinor: number }
  | { kind: 'hourly'; rateMinor: number; durationMinutes: number }

export type BookingStatus = 'requested' | 'confirmed_payment_due' | 'paid' | 'declined' | 'expired' | 'cancelled'

export interface Booking {
  id: string
  serviceName: string
  providerName: string
  status: BookingStatus
  pricing: Pricing
  amountDueMinor: number
  currency: string
  payBy: string | null
  cancelReason: 'payment_timeout' | null
  cancelledAt: string | null
}

export type PayOutcome =
  | { kind: 'paid' }
  | { kind: 'payment_failed'; message: string }
  | { kind: 'deadline_passed' }

const baseUrl = () => import.meta.env.VITE_RECORDS_API_URL ?? ''

export async function listBookings(): Promise<Booking[]> {
  const res = await fetch(`${baseUrl()}/bookings`)
  if (!res.ok) throw new Error(`Could not load bookings (${res.status})`)
  return res.json()
}

const UNAVAILABLE_MESSAGE = 'We could not complete your payment. Try again or use another payment method.'

/** Sends only the opaque payment token; card details never reach the Records API. */
export async function payBooking(id: string, paymentToken: string): Promise<PayOutcome> {
  let res: Response
  try {
    res = await fetch(`${baseUrl()}/bookings/${encodeURIComponent(id)}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentToken }),
    })
  } catch {
    return { kind: 'payment_failed', message: UNAVAILABLE_MESSAGE }
  }
  if (res.ok) return { kind: 'paid' }
  if (res.status === 410) return { kind: 'deadline_passed' }
  if (res.status === 402) {
    const body = await res.json()
    return { kind: 'payment_failed', message: body.error.message }
  }
  return { kind: 'payment_failed', message: UNAVAILABLE_MESSAGE }
}
