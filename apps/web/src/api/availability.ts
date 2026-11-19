export interface WorkingHours {
  weekday: number
  start: string
  end: string
}

export interface Availability {
  providerId: string
  timeZone: string | null
  hours: WorkingHours[]
  daysOff: string[]
}

export interface Slot {
  start: string
  end: string
  localStart: string
  localEnd: string
}

export interface SlotsResponse {
  date: string
  timeZone: string | null
  durationMinutes: number
  slots: Slot[]
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: { error?: string; errors?: Record<string, string> },
  ) {
    super(`Request failed with status ${status}`)
  }
}

const BASE = '/api'

async function request<T>(path: string, init?: { method: string; body?: unknown }): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: init?.method ?? 'GET',
    headers: init?.body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  })
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})))
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

export const getAvailability = () => request<Availability>('/providers/me/availability')

export const setTimeZone = (timeZone: string) =>
  request<void>('/providers/me/availability/time-zone', { method: 'PUT', body: { timeZone } })

export const createHours = (h: WorkingHours) =>
  request<void>('/providers/me/availability/hours', { method: 'POST', body: h })

export const updateHours = (h: WorkingHours) =>
  request<void>(`/providers/me/availability/hours/${h.weekday}`, {
    method: 'PUT',
    body: { start: h.start, end: h.end },
  })

export const deleteHours = (weekday: number) =>
  request<void>(`/providers/me/availability/hours/${weekday}`, { method: 'DELETE' })

export const addDayOff = (date: string) =>
  request<void>('/providers/me/availability/days-off', { method: 'POST', body: { date } })

export const removeDayOff = (date: string) =>
  request<void>(`/providers/me/availability/days-off/${date}`, { method: 'DELETE' })

export const getSlots = (providerId: string, date: string, serviceId: string) =>
  request<SlotsResponse>(
    `/providers/${encodeURIComponent(providerId)}/availability/slots?date=${date}&serviceId=${encodeURIComponent(serviceId)}`,
  )
