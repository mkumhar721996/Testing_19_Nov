import { useCallback, useState, type FormEvent } from 'react'
import { ApiError } from '../api/client'
import type { AdminServiceType } from '../api/types'
import { useApi } from '../api/useApi'
import ConfirmRetireModal from '../components/ConfirmRetireModal'
import SubNav from '../components/SubNav'
import Toast from '../components/Toast'
import TypeRow from '../components/TypeRow'
import { useLoad } from '../lib/useLoad'

type Mode =
  | { kind: 'idle' }
  | { kind: 'adding' }
  | { kind: 'renaming'; type: AdminServiceType }
  | { kind: 'retiring'; type: AdminServiceType }

const BLANK_ERROR = 'Enter a service type name'
const DUPLICATE_ERROR = 'A service type with this name already exists. Enter a different name'
const SAVE_ERROR = 'The service type was not saved. Check your connection and try again'

export default function AdminServiceTypesPage() {
  const api = useApi()
  const [types, reload] = useLoad(useCallback(() => api.adminTypes(), [api]))
  const [mode, setMode] = useState<Mode>({ kind: 'idle' })
  const [name, setName] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const clearToast = useCallback(() => setToast(null), [])

  function startAdd() {
    setName('')
    setFieldError(null)
    setMode({ kind: 'adding' })
  }
  function startRename(type: AdminServiceType) {
    setName(type.name)
    setFieldError(null)
    setMode({ kind: 'renaming', type })
  }

  async function finish(message: string) {
    setMode({ kind: 'idle' })
    setToast(message)
    reload()
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (mode.kind !== 'adding' && mode.kind !== 'renaming') return
    if (!name.trim()) return setFieldError(BLANK_ERROR)
    setBusy(true)
    try {
      if (mode.kind === 'adding') {
        await api.addType(name)
        await finish('Service type added. Providers can now choose it.')
      } else {
        await api.renameType(mode.type.id, name)
        await finish('Service type renamed.')
      }
    } catch (err) {
      setFieldError(err instanceof ApiError && err.status === 409 ? DUPLICATE_ERROR : SAVE_ERROR)
    } finally {
      setBusy(false)
    }
  }

  async function confirmRetire() {
    if (mode.kind !== 'retiring') return
    setBusy(true)
    try {
      await api.retireType(mode.type.id)
      await finish(`${mode.type.name} retired. Providers no longer see it in the list.`)
    } catch {
      setMode({ kind: 'idle' })
      setToast('The service type was not retired. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const editing = mode.kind === 'adding' || mode.kind === 'renaming'
  const hint =
    mode.kind === 'renaming'
      ? `Providers who offer ${mode.type.name} see the new name on their offering.`
      : 'Providers see this name when they choose a service type.'

  return (
    <div>
      <SubNav title="Admin console" current="Service types" others={['Records', 'Reports']} />

      <div className="page-head">
        <div>
          <h1>Service types</h1>
          <p className="text-muted">Providers choose from this list when they offer a service.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={startAdd}>
          Add service type
        </button>
      </div>

      {editing && (
        <form className="form-panel" onSubmit={submit} noValidate>
          <div className="field">
            <label className="field-label" htmlFor="type-name">
              {mode.kind === 'renaming' ? 'Name' : 'Service type name'}
            </label>
            <input
              className={fieldError ? 'input is-invalid' : 'input'}
              id="type-name"
              placeholder="e.g. Locksmith"
              autoComplete="off"
              value={name}
              aria-invalid={fieldError ? true : undefined}
              aria-describedby="type-name-help"
              onChange={(e) => setName(e.target.value)}
            />
            {fieldError ? (
              <span className="field-error" id="type-name-help">
                {fieldError}
              </span>
            ) : (
              <span className="field-hint" id="type-name-help">
                {hint}
              </span>
            )}
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setMode({ kind: 'idle' })}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {mode.kind === 'renaming' ? 'Save name' : 'Save service type'}
            </button>
          </div>
        </form>
      )}

      {types.status === 'loading' && (
        <div className="type-list" role="status" aria-label="Loading service types" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton skeleton-row" />
          ))}
        </div>
      )}

      {types.status === 'error' && (
        <div className="alert alert-danger" role="alert">
          <strong>The service types did not load.</strong> Check your connection and try again.
          <div className="section-gap">
            <button type="button" className="btn btn-secondary" onClick={reload}>
              Try again
            </button>
          </div>
        </div>
      )}

      {types.status === 'ready' && types.data.length === 0 && (
        <div className="empty-state">
          <h2>No service types yet</h2>
          <p>Add the first service type so providers have something to choose from.</p>
          <button type="button" className="btn btn-primary" onClick={startAdd}>
            Add service type
          </button>
        </div>
      )}

      {types.status === 'ready' && types.data.length > 0 && (
        <ul className="type-list" aria-label="Service types">
          {types.data.map((type) => (
            <TypeRow
              key={type.id}
              type={type}
              onRename={startRename}
              onRetire={(t) => setMode({ kind: 'retiring', type: t })}
            />
          ))}
        </ul>
      )}

      {mode.kind === 'retiring' && (
        <ConfirmRetireModal
          typeName={mode.type.name}
          busy={busy}
          onCancel={() => setMode({ kind: 'idle' })}
          onConfirm={confirmRetire}
        />
      )}

      {toast && <Toast message={toast} onDone={clearToast} />}
    </div>
  )
}
