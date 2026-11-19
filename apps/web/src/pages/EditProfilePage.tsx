import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { getOwnProfile, saveDisplayName, submitChange, uploadDocument, type OwnProfile } from '../api/profiles'
import { Banner } from '../components/Banner'
import { documentLabel, DocumentsTable } from '../components/DocumentsTable'
import { ProfileCompare } from '../components/ProfileCompare'

const MAX_BIO = 300
const TOAST_MS = 4000

export function EditProfilePage() {
  const [profile, setProfile] = useState<OwnProfile>()
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [nameSaved, setNameSaved] = useState(false)
  const [nameError, setNameError] = useState<string>()
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string>()
  const [uploadedType, setUploadedType] = useState<'licence' | 'insurance'>()
  const [docError, setDocError] = useState<string>()
  const [loadError, setLoadError] = useState<string>()

  const load = useCallback(
    () =>
      getOwnProfile().then(
        (p) => {
          setProfile(p)
          setName(p.displayName)
          setBio(p.pending?.bio ?? p.bio ?? '')
        },
        (e: Error) => setLoadError(e.message),
      ),
    [],
  )
  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    if (!nameSaved) return
    const t = setTimeout(() => setNameSaved(false), TOAST_MS)
    return () => clearTimeout(t)
  }, [nameSaved])

  if (loadError) return <Banner tone="danger">{loadError}</Banner>
  if (!profile) {
    return (
      <div role="status" aria-label="Loading your profile" aria-busy="true">
        <div className="skeleton skeleton-block" />
        <div className="skeleton skeleton-block" />
        <div className="skeleton skeleton-block" />
      </div>
    )
  }

  const onName = async (e: FormEvent) => {
    e.preventDefault()
    setNameSaved(false)
    setNameError(undefined)
    await saveDisplayName(name).then(
      () => setNameSaved(true),
      (err: Error) => setNameError(err.message),
    )
  }
  const onSubmission = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitError(undefined)
    const form = new FormData(e.currentTarget)
    form.set('bio', bio)
    if (!(form.get('photo') as File | null)?.name) form.delete('photo')
    await submitChange(form).then(
      () => {
        setSubmitted(true)
        return load()
      },
      (err: Error) => setSubmitError(err.message),
    )
  }
  const onDocument = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setUploadedType(undefined)
    setDocError(undefined)
    const form = new FormData(e.currentTarget)
    const type = form.get('type') as 'licence' | 'insurance'
    await uploadDocument(form).then(
      () => {
        setUploadedType(type)
        return load()
      },
      (err: Error) => setDocError(err.message),
    )
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Edit my profile</h1>
          <p className="text-muted">
            Customers see your display name, photo and short bio. Documents are for admins only.
          </p>
        </div>
      </div>

      <form className="form-panel" onSubmit={onName}>
        <div className="field">
          <label className="field-label" htmlFor="display-name">
            Display name
          </label>
          <input
            className={`input${nameError ? ' is-invalid' : ''}`}
            id="display-name"
            maxLength={80}
            autoComplete="off"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {nameError ? (
            <span className="field-error">{nameError}</span>
          ) : (
            <span className="field-hint">Customers see a new display name straight away.</span>
          )}
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-secondary">
            Save display name
          </button>
        </div>
      </form>
      {nameSaved && (
        <div className="toast" role="status">
          Display name saved. Customers see it now.
        </div>
      )}

      {profile.pending && (
        <>
          <Banner tone="info">
            Your new photo or bio was submitted and is awaiting admin review. Customers still see the live versions.
          </Banner>
          <ProfileCompare live={profile} pending={profile.pending} />
        </>
      )}
      {submitted && (
        <Banner tone="success">
          Your newer bio was submitted. It replaces the earlier submission, so admins review only this one.
        </Banner>
      )}

      <form className="form-panel section-gap" onSubmit={onSubmission}>
        <div className="field">
          <label className="field-label" htmlFor="photo-file">
            New photo
          </label>
          <input className="input" type="file" id="photo-file" name="photo" accept="image/png,image/jpeg" />
          <span className="field-hint">JPG or PNG, up to 5 MB. A new photo waits for admin review.</span>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="bio-text">
            Short bio
          </label>
          <textarea
            className="textarea"
            id="bio-text"
            maxLength={MAX_BIO}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
          <span className="field-hint">
            Up to {MAX_BIO} characters. Submitting again replaces a submission still awaiting review.
          </span>
          {submitError && <span className="field-error">{submitError}</span>}
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary">
            Submit for review
          </button>
        </div>
      </form>

      <section className="section-gap" aria-labelledby="docs-heading">
        <h2 id="docs-heading">Licence and insurance documents</h2>
        <p className="text-muted">Only admins can see these. Customers never do.</p>
        {uploadedType && (
          <Banner tone="success">
            {documentLabel(uploadedType)} uploaded. It replaces any earlier {documentLabel(uploadedType).toLowerCase()},
            so admins see only the newer one.
          </Banner>
        )}
        {profile.documents.length > 0 ? (
          <DocumentsTable documents={profile.documents} />
        ) : (
          <div className="empty-state">
            <h2>No documents uploaded</h2>
            <p>Upload your licence or insurance so admins can check them. Customers never see these files.</p>
          </div>
        )}
        <form className="form-panel section-gap" onSubmit={onDocument}>
          <div className="field">
            <label className="field-label" htmlFor="doc-type">
              Document type
            </label>
            <select className="select" id="doc-type" name="type">
              <option value="licence">Licence</option>
              <option value="insurance">Insurance</option>
            </select>
            <span className="field-hint">A newer document replaces the earlier one of the same type.</span>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="doc-file">
              File
            </label>
            <input
              className={`input${docError ? ' is-invalid' : ''}`}
              type="file"
              id="doc-file"
              name="file"
              accept=".pdf,image/png,image/jpeg"
              aria-invalid={docError ? true : undefined}
              aria-describedby={docError ? 'doc-file-err' : undefined}
            />
            {docError ? (
              <span className="field-error" id="doc-file-err" role="alert">
                {docError}
              </span>
            ) : (
              <span className="field-hint">PDF, JPG or PNG, up to 10 MB.</span>
            )}
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              Upload document
            </button>
          </div>
        </form>
      </section>
    </>
  )
}
