import { listBookings, payBooking } from './bookings'

const fetchMock = vi.fn()
beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('payBooking', () => {
  it('posts only the payment token', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 })
    expect(await payBooking('b1', 'tok_stub_1')).toEqual({ kind: 'paid' })
    expect(fetchMock.mock.calls[0][0]).toBe('/bookings/b1/pay')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ paymentToken: 'tok_stub_1' })
  })

  it('maps a decline to the server message and a late payment to deadline_passed', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 402,
      json: async () => ({ error: { message: 'Your payment was declined.' } }),
    })
    expect(await payBooking('b1', 'tok')).toEqual({ kind: 'payment_failed', message: 'Your payment was declined.' })
    fetchMock.mockResolvedValueOnce({ ok: false, status: 410 })
    expect(await payBooking('b1', 'tok')).toEqual({ kind: 'deadline_passed' })
  })

  it('reports an unexpected response as a failed payment', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 })
    expect(await payBooking('b1', 'tok')).toMatchObject({ kind: 'payment_failed' })
  })
})

describe('listBookings', () => {
  it('returns the bookings and throws when the load fails', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => [{ id: 'b1' }] })
    expect(await listBookings()).toEqual([{ id: 'b1' }])
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 })
    await expect(listBookings()).rejects.toThrow()
  })
})
