import { actorHeaders, type Role } from '../session'

// Records API base URL. Set VITE_RECORDS_API_URL to override (default matches the API's PORT default).
export const API_URL: string = import.meta.env.VITE_RECORDS_API_URL ?? 'http://localhost:8011'

export interface PublicProfile {
  id: string
  displayName: string
  photoUrl?: string
  bio?: string
}
export interface DocumentMeta {
  type: 'licence' | 'insurance'
  fileName: string
  uploadedAt: string
  status: 'awaiting-review'
}
export interface PendingMeta {
  bio?: string
  hasPhoto: boolean
  submittedAt: string
}
export interface LiveMeta {
  bio?: string
  hasPhoto: boolean
  photoUrl?: string
}
export interface OwnProfile extends LiveMeta {
  id: string
  displayName: string
  pending?: PendingMeta
  documents: DocumentMeta[]
}
export interface ReviewData {
  id: string
  displayName: string
  live: LiveMeta
  pending?: PendingMeta
  documents: DocumentMeta[]
}

async function call<T>(path: string, role: Role | undefined, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...(role ? actorHeaders(role) : {}), ...(init.headers ?? {}) },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message ?? 'Something went wrong. Try again.')
  }
  return (await res.json().catch(() => ({}))) as T
}

export const getPublicProfile = (id: string) => call<PublicProfile>(`/providers/${id}`, undefined)
export const getOwnProfile = () => call<OwnProfile>('/me/profile', 'provider')
export const saveDisplayName = (displayName: string) =>
  call<unknown>('/me/profile/display-name', 'provider', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ displayName }),
  })
export const submitChange = (form: FormData) =>
  call<unknown>('/me/profile/submissions', 'provider', { method: 'POST', body: form })
export const uploadDocument = (form: FormData) =>
  call<unknown>('/me/documents', 'provider', { method: 'POST', body: form })
export const getReview = (id: string) => call<ReviewData>(`/admin/providers/${id}/review`, 'admin')
export const resolveSubmission = (id: string, decision: 'approve' | 'reject') =>
  call<unknown>(`/admin/providers/${id}/submission/${decision}`, 'admin', { method: 'POST' })

/** Opens an admin-only document in a new tab (the route needs the actor headers, so fetch it first). */
export async function openDocument(id: string, type: string): Promise<void> {
  const res = await fetch(`${API_URL}/admin/providers/${id}/documents/${type}`, { headers: actorHeaders('admin') })
  if (!res.ok) throw new Error('This document did not open. Try again.')
  window.open(URL.createObjectURL(await res.blob()), '_blank')
}
