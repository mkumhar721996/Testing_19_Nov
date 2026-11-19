import { useCallback, useState } from 'react'
import { ApiError } from '../api/client'
import { useApi } from '../api/useApi'
import OfferingsTable from '../components/OfferingsTable'
import SubNav from '../components/SubNav'
import { useLoad } from '../lib/useLoad'

type Notice = 'sent' | 'blocked' | 'failed' | null

const NOTICE_TEXT = {
  blocked: 'Only admins can add service types. Use "Ask an admin to add it" instead.',
  failed: 'Your request was not sent. Check your connection and try again.',
}

export default function ProviderServiceTypesPage() {
  const api = useApi()
  const [types, reloadTypes] = useLoad(useCallback(() => api.offeredTypes(), [api]))
  const [offerings, reloadOfferings] = useLoad(useCallback(() => api.myOfferings(), [api]))
  const [name, setName] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice>(null)

  const failed = types.status === 'error' || offerings.status === 'error'
  const loading = !failed && (types.status === 'loading' || offerings.status === 'loading')

  async function askAdmin() {
    if (!name.trim()) return setFieldError('Enter the service type you need')
    setFieldError(null)
    try {
      await api.requestType(name)
      setName('')
      setNotice('sent')
    } catch {
      setNotice('failed')
    }
  }

  async function addDirectly() {
    try {
      await api.addType(name)
      reloadTypes()
    } catch (err) {
      setNotice(err instanceof ApiError && err.status === 403 ? 'blocked' : 'failed')
    }
  }

  return (
    <div>
      <SubNav title="Provider profile" current="Service types" others={['Offerings', 'Account']} />

      <div className="page-head">
        <div>
          <h1>Choose a service type</h1>
          <p className="text-muted">Pick from the list below for your offering.</p>
        </div>
      </div>

      {notice === 'sent' && (
        <div className="alert alert-success flash" role="status">
          Your request was sent to an admin. We'll let you know when it is added.
        </div>
      )}
      {(notice === 'blocked' || notice === 'failed') && (
        <div className="alert alert-danger flash" role="alert">
          {NOTICE_TEXT[notice]}
        </div>
      )}

      {loading && (
        <div className="type-list" role="status" aria-label="Loading service types" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton skeleton-row" />
          ))}
        </div>
      )}

      {failed && (
        <div className="alert alert-danger" role="alert">
          <strong>The service types did not load.</strong> Check your connection and try again.
          <div className="section-gap">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                reloadTypes()
                reloadOfferings()
              }}
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {types.status === 'ready' && offerings.status === 'ready' && (
        <>
          <div role="radiogroup" aria-label="Service type for this offering">
            <ul className="type-list">
              {types.data.map((type) => (
                <li key={type.id} className="type-row">
                  <label htmlFor={`type-${type.id}`}>{type.name}</label>
                  <input type="radio" id={`type-${type.id}`} name="service-type" />
                </li>
              ))}
            </ul>
          </div>

          {notice === 'sent' && (
            <button type="button" className="btn btn-secondary" onClick={() => setNotice(null)}>
              Back to the full list
            </button>
          )}

          <form
            className="form-panel"
            onSubmit={(e) => {
              e.preventDefault()
              void askAdmin()
            }}
            noValidate
          >
            <p>
              <strong>Can't find the service you offer?</strong>
            </p>
            <div className="field">
              <label className="field-label" htmlFor="request-name">
                Service type you need
              </label>
              <input
                className={fieldError ? 'input is-invalid' : 'input'}
                id="request-name"
                placeholder="e.g. Locksmith"
                autoComplete="off"
                value={name}
                aria-invalid={fieldError ? true : undefined}
                aria-describedby="request-name-help"
                onChange={(e) => setName(e.target.value)}
              />
              {fieldError ? (
                <span className="field-error" id="request-name-help">
                  {fieldError}
                </span>
              ) : (
                <span className="field-hint" id="request-name-help">
                  Only admins can add service types. Send a request and an admin will review it.
                </span>
              )}
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => void addDirectly()}>
                Add service type
              </button>
              <button type="submit" className="btn btn-primary">
                Ask an admin to add it
              </button>
            </div>
          </form>

          <OfferingsTable offerings={offerings.data} />
        </>
      )}
    </div>
  )
}
