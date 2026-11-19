import type { AdminServiceType } from '../api/types'

interface Props {
  type: AdminServiceType
  onRename: (type: AdminServiceType) => void
  onRetire: (type: AdminServiceType) => void
}

export default function TypeRow({ type, onRename, onRetire }: Props) {
  if (type.status === 'retired') {
    const count = type.providersStillOffering
    return (
      <li className="type-row is-retired">
        <span className="type-name">
          {type.name} <span className="badge badge-neutral">Retired</span>
          <span className="type-meta">
            Not offered to providers. {count} {count === 1 ? 'provider still lists' : 'providers still list'} it
            with their price.
          </span>
        </span>
      </li>
    )
  }
  return (
    <li className="type-row">
      <span className="type-name">
        {type.name} <span className="badge badge-success">Offered</span>
      </span>
      <div className="type-actions">
        <button
          type="button"
          className="btn btn-secondary"
          aria-label={`Rename ${type.name}`}
          onClick={() => onRename(type)}
        >
          Rename
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          aria-label={`Retire ${type.name}`}
          onClick={() => onRetire(type)}
        >
          Retire
        </button>
      </div>
    </li>
  )
}
