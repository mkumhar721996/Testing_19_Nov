import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ApiError,
  addDayOff,
  createHours,
  deleteHours,
  getAvailability,
  getSlots,
  removeDayOff,
  setTimeZone,
  updateHours,
  type Availability,
  type SlotsResponse,
} from './api/availability'

const WEEKDAYS = [
  { n: 1, name: 'Monday', id: 'mon' },
  { n: 2, name: 'Tuesday', id: 'tue' },
  { n: 3, name: 'Wednesday', id: 'wed' },
  { n: 4, name: 'Thursday', id: 'thu' },
  { n: 5, name: 'Friday', id: 'fri' },
  { n: 6, name: 'Saturday', id: 'sat' },
  { n: 7, name: 'Sunday', id: 'sun' },
] as const

// No Service Catalog yet: the preview asks for the provider's default service.
const PREVIEW_SERVICE_ID = 'default'
const TOAST_MS = 4000
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']

interface Draft {
  start: string
  end: string
  isNew: boolean
}

const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone

function longDate(iso: string, withWeekday = true): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday: withWeekday ? 'long' : undefined,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
    .format(new Date(Date.UTC(y, m - 1, d)))
    .replace(',', '')
}

/** Parses "12 March 2027" into "2027-03-12", or null when it is not a real date. */
function parseDayOff(text: string): string | null {
  const m = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(text.trim())
  if (!m) return null
  const month = MONTHS.indexOf(m[2].toLowerCase())
  const day = Number(m[1])
  const year = Number(m[3])
  if (month < 0) return null
  const dt = new Date(Date.UTC(year, month, day))
  if (dt.getUTCMonth() !== month || dt.getUTCDate() !== day) return null
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function draftsFrom(a: Availability): Record<number, Draft> {
  return Object.fromEntries(a.hours.map((h) => [h.weekday, { start: h.start, end: h.end, isNew: false }]))
}

export default function AvailabilityPage() {
  const [data, setData] = useState<Availability | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [drafts, setDrafts] = useState<Record<number, Draft>>({})
  const [hourErrors, setHourErrors] = useState<Record<number, string>>({})
  const [saveFailed, setSaveFailed] = useState(false)
  const [dayOffText, setDayOffText] = useState('')
  const [dayOffError, setDayOffError] = useState<string | null>(null)
  const [previewDate, setPreviewDate] = useState('')
  const [preview, setPreview] = useState<SlotsResponse | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const showToast = useCallback((message: string) => {
    setToast(message)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS)
  }, [])
  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const load = useCallback(async () => {
    try {
      const a = await getAvailability()
      setData(a)
      setDrafts(draftsFrom(a))
    } catch {
      setLoadFailed(true)
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const providerId = data?.providerId
  useEffect(() => {
    if (!providerId || !previewDate) {
      setPreview(null)
      return
    }
    let stale = false
    getSlots(providerId, previewDate, PREVIEW_SERVICE_ID)
      .then((r) => !stale && setPreview(r))
      .catch(() => !stale && setPreview(null))
    return () => {
      stale = true
    }
  }, [providerId, previewDate, data])

  if (loadFailed) {
    return (
      <div>
        <h1>My availability</h1>
        <p className="alert alert-danger" role="alert">
          Availability could not be loaded. Refresh the page to try again.
        </p>
      </div>
    )
  }

  if (!data) {
    return (
      <div>
        <h1>My availability</h1>
        <div className="split">
          <section className="card" aria-busy="true" aria-label="Loading working hours">
            <span className="skeleton" style={{ width: '40%' }} />
            <span className="skeleton skeleton-gap" />
            <span className="skeleton skeleton-gap" />
            <span className="skeleton skeleton-gap" style={{ width: '70%' }} />
          </section>
          <section className="card" aria-busy="true" aria-label="Loading preview">
            <span className="skeleton" style={{ width: '60%' }} />
            <span className="skeleton skeleton-gap" />
            <span className="skeleton skeleton-gap" />
          </section>
        </div>
      </div>
    )
  }

  const zone = data.timeZone ?? browserZone()
  const hasAnyHours = Object.keys(drafts).length > 0
  const isDayOff = previewDate !== '' && data.daysOff.includes(previewDate)

  const setDraft = (weekday: number, patch: Partial<Draft>) =>
    setDrafts((d) => ({ ...d, [weekday]: { ...d[weekday], ...patch } }))

  async function saveHours() {
    setHourErrors({})
    setSaveFailed(false)
    const errors: Record<number, string> = {}
    const saved: number[] = []
    try {
      if (!data!.timeZone) await setTimeZone(zone)
      for (const [key, draft] of Object.entries(drafts)) {
        const weekday = Number(key)
        const h = { weekday, start: draft.start, end: draft.end }
        try {
          await (draft.isNew ? createHours(h) : updateHours(h))
          saved.push(weekday)
        } catch (err) {
          if (err instanceof ApiError && err.body.errors) {
            errors[weekday] = err.body.errors.end ?? err.body.errors.start ?? 'Enter valid times.'
          } else if (err instanceof ApiError && err.status === 409) {
            errors[weekday] = 'This weekday already has one block. Remove it before adding another.'
          } else {
            throw err
          }
        }
      }
    } catch {
      setSaveFailed(true)
      return
    } finally {
      // Blocks that did save are existing blocks now, so a retry updates rather than creates them.
      setDrafts((d) => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, saved.includes(Number(k)) ? { ...v, isNew: false } : v])))
    }
    if (Object.keys(errors).length > 0) {
      setHourErrors(errors)
      setSaveFailed(true)
      return
    }
    await load()
    showToast('Working hours saved')
  }

  async function removeHours(weekday: number, name: string) {
    if (!drafts[weekday].isNew) await deleteHours(weekday)
    setDrafts((d) => {
      const { [weekday]: _removed, ...rest } = d
      return rest
    })
    setData((a) => a && { ...a, hours: a.hours.filter((h) => h.weekday !== weekday) })
    showToast(`${name} hours removed`)
  }

  async function markDayOff() {
    const iso = parseDayOff(dayOffText)
    if (!iso) {
      setDayOffError('Enter a date in the format DD Month YYYY')
      return
    }
    setDayOffError(null)
    await addDayOff(iso)
    setDayOffText('')
    setData((a) => a && { ...a, daysOff: [...new Set([...a.daysOff, iso])].sort() })
    showToast('Day off added')
  }

  async function unmarkDayOff(iso: string) {
    await removeDayOff(iso)
    setData((a) => a && { ...a, daysOff: a.daysOff.filter((d) => d !== iso) })
    showToast(`Day off removed for ${longDate(iso, false)}`)
  }

  return (
    <div>
      <h1>My availability</h1>
      <p className="text-muted">
        Hours are in your local time zone ({zone}). Customers see each time converted to their own zone.
      </p>

      <div className="split">
        <div className="stack-lg">
          <section className="card" aria-labelledby="wh-h">
            <h2 id="wh-h">Weekly working hours</h2>
            {!hasAnyHours ? (
              <div className="empty-state">
                <p>No working hours yet. Add hours for a weekday so customers can book you.</p>
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={() => setDraft(1, { start: '09:00', end: '17:00', isNew: true })}
                >
                  Add working hours
                </button>
              </div>
            ) : (
              <>
                <p className="text-muted text-sm">Repeats every week. Slot length comes from your service duration.</p>
                {saveFailed && (
                  <p className="alert alert-danger" role="alert">
                    Working hours were not saved. Fix the end time and save again.
                  </p>
                )}
                {WEEKDAYS.map(({ n, name, id }) => {
                  const draft = drafts[n]
                  const error = hourErrors[n]
                  return (
                    <div key={n}>
                      <div className="day-row">
                        <span className="day-name">{name}</span>
                        {draft ? (
                          <div className="day-controls">
                            <div className="field">
                              <label className="field-label" htmlFor={`${id}-start`}>
                                Start
                              </label>
                              <input
                                className="input"
                                id={`${id}-start`}
                                type="time"
                                value={draft.start}
                                onChange={(e) => setDraft(n, { start: e.target.value })}
                              />
                            </div>
                            <div className="field">
                              <label className="field-label" htmlFor={`${id}-end`}>
                                End
                              </label>
                              <input
                                className={error ? 'input is-invalid' : 'input'}
                                id={`${id}-end`}
                                type="time"
                                value={draft.end}
                                aria-invalid={error ? true : undefined}
                                aria-describedby={error ? `${id}-end-err` : undefined}
                                onChange={(e) => setDraft(n, { end: e.target.value })}
                              />
                            </div>
                            <button className="btn btn-secondary" type="button" onClick={() => void removeHours(n, name)}>
                              Remove {name} hours
                            </button>
                          </div>
                        ) : (
                          <div className="day-controls">
                            <span className="text-muted day-name">Not working</span>
                            <button
                              className="btn btn-secondary"
                              type="button"
                              onClick={() => setDraft(n, { start: '09:00', end: '17:00', isNew: true })}
                            >
                              Add working hours
                              <span className="visually-hidden"> for {name}</span>
                            </button>
                          </div>
                        )}
                      </div>
                      {error && (
                        <p className="field-error" id={`${id}-end-err`}>
                          {error}
                        </p>
                      )}
                      {draft && (
                        <div className="cluster block-note">
                          <button className="btn btn-secondary" type="button" disabled aria-describedby={`${id}-one`}>
                            Add another block
                          </button>
                          <span className="text-muted text-sm" id={`${id}-one`}>
                            {name} already has one block.
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
                <div className="row-end">
                  <button className="btn btn-primary" type="button" onClick={() => void saveHours()}>
                    Save working hours
                  </button>
                </div>
              </>
            )}
          </section>

          <section className="card" aria-labelledby="do-h">
            <h2 id="do-h">Days off</h2>
            <div className="dayoff-add">
              <div className="field">
                <label className="field-label" htmlFor="do-date">
                  Date
                </label>
                <input
                  className={dayOffError ? 'input is-invalid' : 'input'}
                  id="do-date"
                  type="text"
                  value={dayOffText}
                  aria-invalid={dayOffError ? true : undefined}
                  aria-describedby={dayOffError ? 'do-date-err do-date-hint' : 'do-date-hint'}
                  onChange={(e) => setDayOffText(e.target.value)}
                />
                <span className="field-hint" id="do-date-hint">
                  Format DD Month YYYY
                </span>
                {dayOffError && (
                  <span className="field-error" id="do-date-err">
                    {dayOffError}
                  </span>
                )}
              </div>
              <button className="btn btn-secondary" type="button" onClick={() => void markDayOff()}>
                Mark as day off
              </button>
            </div>
            {data.daysOff.map((iso) => (
              <div className="dayoff-item" key={iso}>
                <span>{longDate(iso)}</span>
                <div>
                  <span className="badge badge-neutral">Blocked</span>
                  <button className="btn btn-ghost" type="button" onClick={() => void unmarkDayOff(iso)}>
                    Remove day off
                  </button>
                </div>
              </div>
            ))}
          </section>
        </div>

        <section className="card" aria-labelledby="pv-h">
          <h2 id="pv-h">Preview: times customers can book</h2>
          <div className="field">
            <label className="field-label" htmlFor="pv-date">
              Date
            </label>
            <input className="input" id="pv-date" type="date" value={previewDate} onChange={(e) => setPreviewDate(e.target.value)} />
          </div>
          {previewDate && preview && preview.slots.length > 0 && (
            <>
              <p className="text-muted text-sm">
                {preview.durationMinutes}-minute slots within your hours ({preview.timeZone}).
              </p>
              <ul className="slots" aria-label={`Offered times on ${longDate(previewDate)}`}>
                {preview.slots.map((s) => (
                  <li key={s.start}>
                    <span className="chip">
                      {s.localStart} – {s.localEnd}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {(!hasAnyHours || (previewDate && preview && preview.slots.length === 0)) && (
            <p className="empty-state">No times offered. You have no working hours on this day.</p>
          )}
          {isDayOff && (
            <p className="alert alert-info">{longDate(previewDate)} is a day off: no times offered.</p>
          )}
        </section>
      </div>

      <div className="toast" role="status" hidden={toast === null}>
        <span>{toast}</span>
      </div>
    </div>
  )
}
