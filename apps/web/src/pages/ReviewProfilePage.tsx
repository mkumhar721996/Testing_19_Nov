import { useEffect, useState } from 'react'
import { getReview, openDocument, resolveSubmission, type ReviewData } from '../api/profiles'
import { Banner } from '../components/Banner'
import { documentLabel, DocumentsTable } from '../components/DocumentsTable'
import { ProfileCompare } from '../components/ProfileCompare'

const OUTCOME = {
  approve: { tone: 'success', text: 'Change approved. Customers now see the new photo and bio in place of the previous ones.' },
  reject: { tone: 'warning', text: 'Change rejected. Customers keep seeing the previous photo and bio.' },
} as const

type Decision = keyof typeof OUTCOME

export function ReviewProfilePage({ providerId }: { providerId: string }) {
  const [data, setData] = useState<ReviewData>()
  const [outcome, setOutcome] = useState<Decision>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    getReview(providerId).then(setData, (e: Error) => setError(e.message))
  }, [providerId])

  const resolve = (decision: Decision) =>
    resolveSubmission(providerId, decision).then(
      () => {
        setOutcome(decision)
        setData((d) => d && { ...d, pending: undefined })
      },
      (e: Error) => setError(e.message),
    )

  if (error && !data) return <Banner tone="danger">{error}</Banner>
  if (!data) {
    return (
      <div role="status" aria-label="Loading profile changes" aria-busy="true">
        <div className="skeleton skeleton-block" />
        <div className="skeleton skeleton-block" />
        <div className="skeleton skeleton-block" />
      </div>
    )
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{data.displayName}</h1>
          <p className="text-muted">Review profile changes</p>
        </div>
      </div>
      {error && <Banner tone="danger">{error}</Banner>}

      <section aria-labelledby="admin-docs">
        <h2 id="admin-docs">Licence and insurance documents</h2>
        <DocumentsTable
          documents={data.documents}
          showStatus
          action={(d) => (
            <button
              type="button"
              className="btn btn-secondary"
              aria-label={`View ${documentLabel(d.type)} file`}
              onClick={() => openDocument(providerId, d.type).catch((e: Error) => setError(e.message))}
            >
              View
            </button>
          )}
        />
        <p className="text-sm text-muted">Only the newest document of each type is shown.</p>
      </section>

      <div className="section-gap">
        {outcome && <Banner tone={OUTCOME[outcome].tone}>{OUTCOME[outcome].text}</Banner>}
        {data.pending ? (
          <>
            <h2>Photo and bio awaiting review</h2>
            <ProfileCompare live={data.live} pending={data.pending} />
            <div className="form-actions section-gap">
              <button type="button" className="btn btn-secondary" onClick={() => resolve('reject')}>
                Reject change
              </button>
              <button type="button" className="btn btn-primary" onClick={() => resolve('approve')}>
                Approve change
              </button>
            </div>
          </>
        ) : (
          !outcome && (
            <div className="empty-state">
              <h2>Nothing to review</h2>
              <p>New photos and bios from providers appear here for approval.</p>
            </div>
          )
        )}
      </div>
    </>
  )
}
