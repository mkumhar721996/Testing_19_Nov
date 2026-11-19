import { FundraisingConsultantSection } from './FundraisingConsultantSection'
import type { OrganizationConsultant } from './types'

export interface OrganizationDetail extends OrganizationConsultant {
  name: string
  primaryContact: string
}

export function OrganizationDetailPanel({ organization }: { organization: OrganizationDetail }) {
  return (
    <aside aria-label="Organization details">
      <h2>{organization.name}</h2>
      <dl className="fields">
        <div>
          <dt>Primary contact</dt>
          <dd>{organization.primaryContact}</dd>
        </div>
      </dl>
      <FundraisingConsultantSection consultant={organization.consultant} />
    </aside>
  )
}
