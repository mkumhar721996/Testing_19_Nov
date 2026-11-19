import { render, screen } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import { ProviderProfilePage } from './ProviderProfilePage'

const respond = (body: unknown, ok = true) =>
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok, json: async () => body }))

afterEach(() => vi.unstubAllGlobals())

describe('ProviderProfilePage', () => {
  it('shows name, photo and bio (AC1)', async () => {
    respond({ id: 'p1', displayName: 'Whitfield Plumbing', photoUrl: '/providers/p1/photo', bio: 'Approved bio' })
    render(<ProviderProfilePage providerId="p1" />)
    expect(await screen.findByRole('heading', { name: 'Whitfield Plumbing' })).toBeInTheDocument()
    expect(screen.getByRole('img')).toBeInTheDocument()
    expect(screen.getByText('Approved bio')).toBeInTheDocument()
  })

  it('shows only the name when there is no approved photo or bio (AC9, AC10)', async () => {
    respond({ id: 'p2', displayName: 'Okafor Electrical' })
    render(<ProviderProfilePage providerId="p2" />)
    expect(await screen.findByRole('heading', { name: 'Okafor Electrical' })).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByTestId('bio')).not.toBeInTheDocument()
  })

  it('never mentions documents (AC2)', async () => {
    respond({ id: 'p1', displayName: 'Whitfield Plumbing' })
    render(<ProviderProfilePage providerId="p1" />)
    await screen.findByRole('heading', { name: 'Whitfield Plumbing' })
    expect(screen.queryByText(/licence|insurance|document/i)).not.toBeInTheDocument()
  })

  it('shows an error with a retry button', async () => {
    respond({ message: 'x' }, false)
    render(<ProviderProfilePage providerId="p1" />)
    expect(await screen.findByRole('alert')).toHaveTextContent('This profile did not load.')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})
