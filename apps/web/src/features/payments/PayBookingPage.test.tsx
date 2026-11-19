import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Booking } from '../../api/bookings'
import { payBooking } from '../../api/bookings'
import PayBookingPage from './PayBookingPage'

vi.mock('../../api/bookings', () => ({ payBooking: vi.fn() }))
const pay = vi.mocked(payBooking)

const fixed: Booking = {
  id: 'b1',
  serviceName: 'Deep clean',
  providerName: 'Maya R.',
  status: 'confirmed_payment_due',
  pricing: { kind: 'fixed', priceMinor: 12000 },
  amountDueMinor: 12000,
  currency: 'USD',
  payBy: '2026-11-20T09:00:00.000Z',
  cancelReason: null,
  cancelledAt: null,
}
const hourly: Booking = {
  ...fixed,
  id: 'b2',
  serviceName: 'Bike repair',
  providerName: 'Tom K.',
  pricing: { kind: 'hourly', rateMinor: 4000, durationMinutes: 150 },
  amountDueMinor: 10000,
}
const declined = { kind: 'payment_failed', message: 'Your payment was declined.' } as const

beforeEach(() => {
  pay.mockReset()
})

describe('PayBookingPage', () => {
  it('shows the fixed price as the amount to charge (AC2)', () => {
    render(<PayBookingPage booking={fixed} onBack={vi.fn()} onPaid={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Pay for Deep clean' })).toBeInTheDocument()
    expect(screen.getByText('Price shown at booking (fixed)')).toBeInTheDocument()
    expect(screen.getByText('Amount to charge')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pay $120.00' })).toBeInTheDocument()
    expect(screen.getByText(/We do not store them/)).toBeInTheDocument()
  })

  it('shows rate, duration and the server amount for hourly bookings (AC3)', () => {
    render(<PayBookingPage booking={hourly} onBack={vi.fn()} onPaid={vi.fn()} />)
    expect(screen.getByText('Hourly rate')).toBeInTheDocument()
    expect(screen.getByText('$40.00/h')).toBeInTheDocument()
    expect(screen.getByText('2.5 h')).toBeInTheDocument()
    expect(screen.getByText('Amount to charge ($40.00 × 2.5 h)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pay $100.00' })).toBeInTheDocument()
  })

  it('charges once and returns on success (AC1)', async () => {
    pay.mockResolvedValue({ kind: 'paid' })
    const onPaid = vi.fn()
    render(<PayBookingPage booking={fixed} onBack={vi.fn()} onPaid={onPaid} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pay $120.00' }))
    await waitFor(() => expect(onPaid).toHaveBeenCalled())
    expect(pay).toHaveBeenCalledTimes(1)
  })

  it('disables the pay button while a charge is in flight', async () => {
    pay.mockReturnValue(new Promise(() => {}))
    render(<PayBookingPage booking={fixed} onBack={vi.fn()} onPaid={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pay $120.00' }))
    await waitFor(() => expect(screen.getByRole('button', { name: /Pay \$120.00/ })).toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: /Pay \$120.00/ }))
    expect(pay).toHaveBeenCalledTimes(1)
  })

  it('shows a clear error, retry and another method on a declined payment (AC5, AC6, AC7)', async () => {
    pay.mockResolvedValue(declined)
    render(<PayBookingPage booking={fixed} onBack={vi.fn()} onPaid={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pay $120.00' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Your payment was declined')
    expect(screen.getByRole('button', { name: 'Try payment again' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Use another payment method' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Try payment again' }))
    await waitFor(() => expect(pay).toHaveBeenCalledTimes(2))
    expect(pay.mock.calls[1][1]).toBe(pay.mock.calls[0][1])
  })

  it('resets to a fresh card form for another payment method (AC7)', async () => {
    pay.mockResolvedValue(declined)
    render(<PayBookingPage booking={fixed} onBack={vi.fn()} onPaid={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Card number'), { target: { value: '4242' } })
    fireEvent.click(screen.getByRole('button', { name: 'Pay $120.00' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Use another payment method' }))
    expect(screen.getByLabelText('Card number')).toHaveValue('')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('never sends card details, only a token (AC11)', async () => {
    pay.mockResolvedValue({ kind: 'paid' })
    render(<PayBookingPage booking={fixed} onBack={vi.fn()} onPaid={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Card number'), { target: { value: '4242424242424242' } })
    fireEvent.click(screen.getByRole('button', { name: 'Pay $120.00' }))
    await waitFor(() => expect(pay).toHaveBeenCalled())
    expect(pay).toHaveBeenCalledWith('b1', expect.stringMatching(/^tok_/))
    expect(JSON.stringify(pay.mock.calls)).not.toContain('4242')
  })

  it('returns to the list when the payment window has passed', async () => {
    pay.mockResolvedValue({ kind: 'deadline_passed' })
    const onBack = vi.fn()
    render(<PayBookingPage booking={fixed} onBack={onBack} onPaid={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pay $120.00' }))
    await waitFor(() => expect(onBack).toHaveBeenCalled())
  })
})
