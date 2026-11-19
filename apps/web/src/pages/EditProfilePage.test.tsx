import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import { EditProfilePage } from './EditProfilePage'

const profile = (over = {}) => ({
  id: 'p1',
  displayName: 'Whitfield',
  bio: 'Approved bio',
  hasPhoto: false,
  documents: [] as unknown[],
  ...over,
})

function mock(data: unknown, postResult: { ok: boolean; body?: unknown } = { ok: true }) {
  const f = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'POST' || init?.method === 'PUT') {
      return { ok: postResult.ok, json: async () => postResult.body ?? {} }
    }
    return { ok: true, json: async () => data }
  })
  vi.stubGlobal('fetch', f)
  return f
}

afterEach(() => vi.unstubAllGlobals())

describe('EditProfilePage', () => {
  it('uploads a document and confirms (AC4)', async () => {
    const f = mock(profile())
    render(<EditProfilePage />)
    fireEvent.change(await screen.findByLabelText('File'), {
      target: { files: [new File(['x'], 'licence.pdf', { type: 'application/pdf' })] },
    })
    fireEvent.click(screen.getAllByRole('button', { name: 'Upload document' })[0])
    expect(await screen.findByText(/Licence uploaded\./)).toBeInTheDocument()
    expect(f).toHaveBeenCalledWith(expect.stringContaining('/me/documents'), expect.objectContaining({ method: 'POST' }))
  })

  it('shows an inline error for an unsupported file', async () => {
    mock(profile(), { ok: false, body: { message: 'scan.tiff is not a supported file.' } })
    render(<EditProfilePage />)
    fireEvent.change(await screen.findByLabelText('File'), {
      target: { files: [new File(['x'], 'scan.tiff', { type: 'image/tiff' })] },
    })
    fireEvent.click(screen.getAllByRole('button', { name: 'Upload document' })[0])
    expect(await screen.findByText('scan.tiff is not a supported file.')).toBeInTheDocument()
  })

  it('shows live and pending versions side by side (AC5)', async () => {
    mock(profile({ pending: { bio: 'New bio', hasPhoto: false, submittedAt: '2026-11-01T00:00:00Z' } }))
    render(<EditProfilePage />)
    expect(await screen.findByText(/Live for customers/)).toBeInTheDocument()
    expect(screen.getAllByText('Awaiting review').length).toBeGreaterThan(0)
  })

  it('confirms a resubmission replaces the earlier one (AC12)', async () => {
    mock(profile({ pending: { bio: 'first', hasPhoto: false, submittedAt: '2026-11-01T00:00:00Z' } }))
    render(<EditProfilePage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Submit for review' }))
    expect(await screen.findByText(/Your newer bio was submitted/)).toBeInTheDocument()
  })

  it('saves a display name (AC8)', async () => {
    mock(profile())
    render(<EditProfilePage />)
    fireEvent.change(await screen.findByLabelText('Display name'), { target: { value: 'New Name' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save display name' }))
    expect(await screen.findByText(/Display name saved/)).toBeInTheDocument()
  })

  it('lists one document per type (AC11)', async () => {
    mock(profile({ documents: [{ type: 'licence', fileName: 'new.pdf', uploadedAt: '2026-11-01T00:00:00Z' }] }))
    render(<EditProfilePage />)
    expect(await screen.findByText('new.pdf')).toBeInTheDocument()
  })

  it('invites a first upload when there are no documents', async () => {
    mock(profile())
    render(<EditProfilePage />)
    expect(await screen.findByText('No documents uploaded')).toBeInTheDocument()
  })
})
