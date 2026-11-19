import type { FundraisingConsultant } from './types'
import './FundraisingConsultantSection.css'

const NOT_ON_RECORD = 'Not on record'

function Value({
  value,
  href,
}: {
  value?: string | null
  href: (v: string) => string
}) {
  const trimmed = value?.trim()
  if (!trimmed) return <span className="consultant-muted">{NOT_ON_RECORD}</span>
  return (
    <a className="consultant-link" href={href(trimmed)}>
      {trimmed}
    </a>
  )
}

export function FundraisingConsultantSection({
  consultant,
}: {
  consultant?: FundraisingConsultant | null
}) {
  return (
    <section className="consultant" aria-labelledby="fc-h">
      <h3 id="fc-h" className="consultant-heading">
        Fundraising consultant
      </h3>
      {consultant ? (
        <dl className="consultant-list">
          <div>
            <dt>Name</dt>
            <dd className="consultant-name">{consultant.name}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>
              <Value value={consultant.email} href={(v) => `mailto:${v}`} />
            </dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd>
              <Value value={consultant.phone} href={(v) => `tel:${v.replace(/\s+/g, '')}`} />
            </dd>
          </div>
        </dl>
      ) : (
        <p className="consultant-muted">Unassigned</p>
      )}
    </section>
  )
}
