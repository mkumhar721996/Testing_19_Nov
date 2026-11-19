import { useEffect, useRef, type KeyboardEvent } from 'react'

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled])'

interface Props {
  typeName: string
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}

export default function ConfirmRetireModal({ typeName, busy, onCancel, onConfirm }: Props) {
  const dialog = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null
    dialog.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus()
    return () => {
      if (trigger?.isConnected) trigger.focus()
    }
  }, [])

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onCancel()
      return
    }
    if (event.key !== 'Tab') return
    const items = Array.from(dialog.current!.querySelectorAll<HTMLElement>(FOCUSABLE))
    const first = items[0]
    const last = items[items.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <>
      <div className="backdrop" />
      <div
        ref={dialog}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="retire-title"
        onKeyDown={onKeyDown}
      >
        <div className="modal-header">
          <h3 id="retire-title">Retire {typeName}?</h3>
        </div>
        <div className="modal-body">
          <p>
            Providers will no longer see it when they choose a service type. Providers who already offer it keep
            it, with their price.
          </p>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm} disabled={busy}>
            Retire service type
          </button>
        </div>
      </div>
    </>
  )
}
