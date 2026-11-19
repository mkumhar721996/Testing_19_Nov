import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import AvailabilityPage from './AvailabilityPage'

interface Calls {
  method: string
  url: string
  body?: unknown
}

function mockApi(initial: object, overrides: Record<string, () => Response> = {}) {
  const calls: Calls[] = []
  const fetchMock = vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
    const method = init?.method ?? 'GET'
    calls.push({ method, url, body: init?.body ? JSON.parse(init.body) : undefined })
    const key = `${method} ${url}`
    if (overrides[key]) return overrides[key]()
    if (method === 'GET' && url === '/api/providers/me/availability') return Response.json(initial)
    if (method === 'GET' && url.includes('/slots')) {
      return Response.json({ date: '2027-03-22', timeZone: 'Europe/London', durationMinutes: 60, slots: [{ start: 'a', end: 'b', localStart: '09:00', localEnd: '10:00' }] })
    }
    return new Response(null, { status: method === 'POST' ? 201 : 204 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return calls
}

const monday = { providerId: 'p1', timeZone: 'Europe/London', hours: [{ weekday: 1, start: '09:00', end: '17:00' }], daysOff: [] }

afterEach(() => vi.unstubAllGlobals())

describe('AvailabilityPage', () => {
  it('shows a skeleton while loading', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    const { container } = render(<AvailabilityPage />)
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
  })

  it('shows the saved Monday hours when reopened (AC1)', async () => {
    mockApi(monday)
    render(<AvailabilityPage />)
    expect(await screen.findByLabelText('Start', { selector: '#mon-start' })).toHaveValue('09:00')
    expect(screen.getByLabelText('End', { selector: '#mon-end' })).toHaveValue('17:00')
    expect(screen.getByText(/Hours are in your local time zone \(Europe\/London\)/)).toBeInTheDocument()
  })

  it('disables a second block for a day that has one (AC13)', async () => {
    mockApi(monday)
    render(<AvailabilityPage />)
    const button = await screen.findByRole('button', { name: 'Add another block' })
    expect(button).toBeDisabled()
    expect(screen.getByText('Monday already has one block.')).toBeInTheDocument()
  })

  it('shows the empty state without hours (AC7)', async () => {
    mockApi({ providerId: 'p1', timeZone: null, hours: [], daysOff: [] })
    render(<AvailabilityPage />)
    expect(await screen.findByText(/No working hours yet\./)).toBeInTheDocument()
    expect(screen.getByText('No times offered. You have no working hours on this day.')).toBeInTheDocument()
  })

  it('shows the end-time error linked to the field (AC9)', async () => {
    const message = 'End time must be after the start time. Enter a time later than 17:00.'
    mockApi(monday, {
      'PUT /api/providers/me/availability/hours/1': () => Response.json({ errors: { end: message } }, { status: 400 }),
    })
    render(<AvailabilityPage />)
    fireEvent.change(await screen.findByLabelText('Start'), { target: { value: '17:00' } })
    fireEvent.change(screen.getByLabelText('End'), { target: { value: '09:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save working hours' }))
    await waitFor(() => expect(screen.getByLabelText('End')).toHaveAttribute('aria-invalid', 'true'))
    const errorId = screen.getByLabelText('End').getAttribute('aria-describedby')!
    expect(document.getElementById(errorId)).toHaveTextContent(message)
    expect(document.getElementById(errorId)).toHaveClass('field-error')
    expect(screen.getByRole('alert')).toHaveTextContent('Working hours were not saved.')
  })

  it('saves hours and shows a toast', async () => {
    const calls = mockApi(monday)
    render(<AvailabilityPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Save working hours' }))
    expect(await screen.findByText('Working hours saved')).toBeInTheDocument()
    expect(calls).toContainEqual({ method: 'PUT', url: '/api/providers/me/availability/hours/1', body: { start: '09:00', end: '17:00' } })
  })

  it('marks a date as a day off (AC3)', async () => {
    const calls = mockApi(monday)
    render(<AvailabilityPage />)
    fireEvent.change(await screen.findByLabelText('Date', { selector: '#do-date' }), { target: { value: '12 March 2027' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mark as day off' }))
    expect(await screen.findByText('Friday 12 March 2027')).toBeInTheDocument()
    expect(screen.getByText('Blocked')).toBeInTheDocument()
    expect(screen.getByText('Day off added')).toBeInTheDocument()
    expect(calls).toContainEqual({ method: 'POST', url: '/api/providers/me/availability/days-off', body: { date: '2027-03-12' } })
  })

  it('rejects an unreadable day-off date', async () => {
    mockApi(monday)
    render(<AvailabilityPage />)
    fireEvent.change(await screen.findByLabelText('Date', { selector: '#do-date' }), { target: { value: 'soon' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mark as day off' }))
    expect(await screen.findByText('Enter a date in the format DD Month YYYY')).toBeInTheDocument()
  })

  it('removes a day off (AC10)', async () => {
    mockApi({ ...monday, daysOff: ['2027-03-12'] })
    render(<AvailabilityPage />)
    expect(await screen.findByText('Friday 12 March 2027')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Remove day off' }))
    await waitFor(() => expect(screen.queryByText('Friday 12 March 2027')).not.toBeInTheDocument())
    expect(screen.getByText('Day off removed for 12 March 2027')).toBeInTheDocument()
  })

  it('previews the offered times from the slots endpoint', async () => {
    mockApi(monday)
    render(<AvailabilityPage />)
    fireEvent.change(await screen.findByLabelText('Date', { selector: '#pv-date' }), { target: { value: '2027-03-22' } })
    expect(await screen.findByText('09:00 – 10:00')).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Offered times on Monday 22 March 2027' })).toBeInTheDocument()
  })
})
