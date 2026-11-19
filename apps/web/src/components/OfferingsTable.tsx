import type { ProviderOffering } from '../api/types'
import { formatPrice } from '../lib/formatPrice'

export default function OfferingsTable({ offerings }: { offerings: ProviderOffering[] }) {
  const retired = offerings.filter((o) => o.typeStatus === 'retired')
  return (
    <div className="section-gap">
      <h2>Your current offerings</h2>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Service type</th>
              <th scope="col">Price</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {offerings.map((o) => (
              <tr key={o.serviceType}>
                <td>{o.serviceType}</td>
                <td>{formatPrice(o.price)}</td>
                <td>
                  {o.typeStatus === 'retired' ? (
                    <span className="badge badge-neutral">Type retired</span>
                  ) : (
                    <span className="badge badge-success">Active</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {retired.length > 0 && (
        <p className="text-sm text-muted">
          {retired.map((o) => o.serviceType).join(', ')} {retired.length === 1 ? 'was' : 'were'} retired by an
          admin. Your offering keeps its type and price, but the type is no longer in the list above.
        </p>
      )}
    </div>
  )
}
