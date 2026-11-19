import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import { ReviewProfilePage } from './ReviewProfilePage'

const review = (over = {}) => ({
  id: 'p1',
  displayName: 'Whitfield Plumbing',
  live: { bio: 'Approved bio', hasPhoto: false },
  pending: { bio: 'New bio', hasPhoto: false, submittedAt: '2026-11-01T00:00:00Z' },
  documents: [
    { type: 'licence', fileName: 'licence.pdf', uploadedAt: '2026-11-01T00:00:00Z', status: 'awaiting-review' },
  ],
  ...over,
})

function mock(data: unknown) {
  const fetchMock = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => ({
    ok: true,
    json: async () => (init?.method === 'POST' ? { status: 'ok' } : data),
  }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => vi.unstubAllGlobals())

describe('ReviewProfilePage', () => {
  it('shows the uploaded document marked awaiting review (AC3)', async () => {
    mock(review())
    render(<ReviewProfilePage providerId="p1" />)
    const cell = await screen.findByText('licence.pdf')
    expect(within(cell.closest('tr')!).getByText('Awaiting review')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View Licence file' })).toBeInTheDocument()
  })

  it('approves a pending change (AC6)', async () => {
    const f = mock(review())
    render(<ReviewProfilePage providerId="p1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Approve change' }))
    expect(await screen.findByText(/Change approved\./)).toBeInTheDocument()
    expect(f).toHaveBeenCalledWith(expect.stringContaining('/submission/approve'), expect.anything())
  })

  it('rejects a pending change (AC7)', async () => {
    mock(review())
    render(<ReviewProfilePage providerId="p1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Reject change' }))
    expect(await screen.findByText(/Change rejected\./)).toBeInTheDocument()
  })

  it('shows an empty state with nothing pending', async () => {
    mock(review({ pending: undefined }))
    render(<ReviewProfilePage providerId="p1" />)
    expect(await screen.findByText('Nothing to review')).toBeInTheDocument()
  })
})
