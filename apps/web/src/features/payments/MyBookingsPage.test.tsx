import { fireEvent, render, screen } from '@testing-library/react'
import { listBookings, type Booking } from '../../api/bookings'
import MyBookingsPage from './MyBookingsPage'

vi.mock('../../api/bookings', () => ({ listBookings: vi.fn() }))
const list = vi.mocked(listBookings)

const base: Booking = {
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
  ...base,
  id: 'b2',
  serviceName: 'Bike repair',
  providerName: 'Tom K.',
  pricing: { kind: 'hourly', rateMinor: 4000, durationMinutes: 150 },
  amountDueMinor: 10000,
}
const declined: Booking = { ...base, id: 'b3', serviceName: 'Garden tidy', status: 'declined' }
const cancelled: Booking = {
  ...base,
  id: 'b4',
  serviceName: 'Window cleaning',
  status: 'cancelled',
  cancelReason: 'payment_timeout',
  cancelledAt: new Date().toISOString(),
}

beforeEach(() => {
  list.mockReset()
})

describe('MyBookingsPage', () => {
  it('shows a skeleton while loading', () => {
    list.mockReturnValue(new Promise(() => {}))
    const { container } = render(<MyBookingsPage onPay={vi.fn()} />)
    expect(container.querySelector('.skeleton')).not.toBeNull()
  })

  it('lists confirmed bookings with the price and a Pay now action', async () => {
    list.mockResolvedValue([base, hourly])
    const onPay = vi.fn()
    render(<MyBookingsPage onPay={onPay} />)
    expect(await screen.findByRole('heading', { name: 'My bookings' })).toBeInTheDocument()
    expect(await screen.findByText('Confirmed by Maya R. · Fixed price $120.00 · Pay within 24 hours')).toBeInTheDocument()
    expect(screen.getByText('Confirmed by Tom K. · $40.00/h · Pay within 24 hours')).toBeInTheDocument()
    expect(screen.getAllByText('Confirmed, payment due')).toHaveLength(2)
    fireEvent.click(screen.getAllByRole('button', { name: 'Pay now' })[1])
    expect(onPay).toHaveBeenCalledWith(hourly)
  })

  it('says no charge was made for declined requests (AC4)', async () => {
    list.mockResolvedValue([declined])
    render(<MyBookingsPage onPay={vi.fn()} />)
    expect(await screen.findByText('Declined')).toBeInTheDocument()
    expect(screen.getByText('Provider declined this request. No charge was made.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pay now' })).not.toBeInTheDocument()
  })

  it('shows auto-cancelled bookings as cancelled with a notice (AC8, AC10)', async () => {
    list.mockResolvedValue([cancelled])
    render(<MyBookingsPage onPay={vi.fn()} />)
    expect(await screen.findByText('Cancelled')).toBeInTheDocument()
    expect(screen.getByText(/Cancelled because payment was not completed within 24 hours/)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Your Window cleaning booking was cancelled because payment was not completed within 24 hours. We emailed you a cancellation notice.',
    )
  })

  it('does not show the notice for an old cancellation', async () => {
    list.mockResolvedValue([{ ...cancelled, cancelledAt: '2020-01-01T00:00:00.000Z' }])
    render(<MyBookingsPage onPay={vi.fn()} />)
    expect(await screen.findByText('Cancelled')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows the empty state', async () => {
    list.mockResolvedValue([])
    render(<MyBookingsPage onPay={vi.fn()} />)
    expect(
      await screen.findByText('No bookings yet. Requests you send appear here, and you pay only once a provider confirms.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Browse services' })).toBeInTheDocument()
  })

  it('shows an error with a reload button when loading fails', async () => {
    list.mockImplementationOnce(() => {
      throw new Error('down')
    })
    list.mockResolvedValue([base])
    render(<MyBookingsPage onPay={vi.fn()} />)
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reload bookings' }))
    expect(await screen.findByText('Deep clean')).toBeInTheDocument()
  })
})
