import { API_URL, type LiveMeta, type PendingMeta } from '../api/profiles'

export function ProfileCompare({ live, pending }: { live: LiveMeta; pending: PendingMeta }) {
  return (
    <div className="compare">
      <section className="card" aria-label="Live for customers">
        <h3>
          Live for customers <span className="badge badge-success">Approved</span>
        </h3>
        {live.photoUrl && (
          <img className="photo is-small" src={`${API_URL}${live.photoUrl}`} alt="Live photo" />
        )}
        <p>{live.bio ?? 'No bio yet'}</p>
      </section>
      <section className="card" aria-label="Submitted">
        <h3>
          Submitted {new Date(pending.submittedAt).toLocaleDateString()}{' '}
          <span className="badge badge-warning">Awaiting review</span>
        </h3>
        {pending.hasPhoto && <p>New photo submitted</p>}
        <p>{pending.bio ?? 'Bio unchanged'}</p>
      </section>
    </div>
  )
}
