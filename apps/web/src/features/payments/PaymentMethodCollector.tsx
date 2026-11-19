import type { FormEvent, ReactNode } from 'react'

interface Props {
  /** Receives an opaque token for the entered payment method; card details never leave this component. */
  onToken: (token: string) => void
  /** The submit action, rendered below the secure note. */
  children: ReactNode
}

let tokenCounter = 0

/**
 * Stand-in for the payment service's hosted card fields. The inputs are uncontrolled and their values
 * are never read, stored or sent; only a stub token is emitted. Replace with the provider's fields
 * once the payment service is chosen — the page and API do not change.
 */
export default function PaymentMethodCollector({ onToken, children }: Props) {
  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    tokenCounter += 1
    onToken(`tok_stub_${Date.now().toString(36)}_${tokenCounter}`)
  }

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <div className="field">
        <label className="field-label" htmlFor="card-number">
          Card number
        </label>
        <input
          className="input"
          id="card-number"
          inputMode="numeric"
          autoComplete="cc-number"
          placeholder="1234 5678 9012 3456"
        />
      </div>
      <div className="field-pair">
        <div className="field">
          <label className="field-label" htmlFor="card-expiry">
            Expiry
          </label>
          <input className="input" id="card-expiry" autoComplete="cc-exp" placeholder="MM/YY" />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="card-cvc">
            Security code
          </label>
          <input
            className="input"
            id="card-cvc"
            inputMode="numeric"
            autoComplete="cc-csc"
            placeholder="CVC"
          />
        </div>
      </div>
      <p className="secure-note">
        <svg className="icon" aria-hidden="true" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
        <span>Card details are entered in the secure form of our payment service. We do not store them.</span>
      </p>
      {children}
    </form>
  )
}
