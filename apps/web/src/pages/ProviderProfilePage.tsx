import { useCallback, useEffect, useState } from 'react'
import { API_URL, getPublicProfile, type PublicProfile } from '../api/profiles'

export function ProviderProfilePage({ providerId }: { providerId: string }) {
  const [profile, setProfile] = useState<PublicProfile>()
  const [failed, setFailed] = useState(false)

  const load = useCallback(() => {
    setFailed(false)
    setProfile(undefined)
    getPublicProfile(providerId).then(setProfile, () => setFailed(true))
  }, [providerId])
  useEffect(load, [load])

  return (
    <>
      <div className="page-head">
        <h1>Provider profile</h1>
      </div>
      {failed ? (
        <div className="alert alert-danger" role="alert">
          <strong>This profile did not load.</strong> Check your connection and try again.
          <div className="section-gap">
            <button type="button" className="btn btn-secondary" onClick={load}>
              Try again
            </button>
          </div>
        </div>
      ) : !profile ? (
        <div className="card" role="status" aria-label="Loading provider profile" aria-busy="true">
          <div className="profile">
            <div className="skeleton skeleton-photo" />
            <div className="profile-body">
              <div className="skeleton skeleton-block" />
              <div className="skeleton skeleton-block" />
            </div>
          </div>
        </div>
      ) : (
        <section className="card" aria-labelledby="provider-name">
          <div className="profile">
            {profile.photoUrl && (
              <img
                className="photo"
                src={`${API_URL}${profile.photoUrl}`}
                alt={`${profile.displayName} profile photo`}
              />
            )}
            <div className="profile-body">
              <h2 id="provider-name">{profile.displayName}</h2>
              {profile.bio && <p data-testid="bio">{profile.bio}</p>}
            </div>
          </div>
        </section>
      )}
    </>
  )
}
