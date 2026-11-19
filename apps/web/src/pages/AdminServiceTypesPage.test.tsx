import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { stubFetch } from '../test/fakeFetch'
import { click, renderWithSession, type } from '../test/renderWithSession'
import AdminServiceTypesPage from './AdminServiceTypesPage'

const adminSession = { token: 'admin-token', role: 'admin' as const }
const types = [
  { id: '1', name: 'Plumbing', status: 'offered', providersStillOffering: 0 },
  { id: '2', name: 'Gardening', status: 'offered', providersStillOffering: 0 },
  { id: '3', name: 'Pest control', status: 'retired', providersStillOffering: 3 },
]
const render = () => renderWithSession(<AdminServiceTypesPage />, adminSession)

afterEach(() => vi.unstubAllGlobals())

describe('AdminServiceTypesPage', () => {
  it('shows loading skeletons, then the list with a retired row', async () => {
    stubFetch({ 'GET /admin/service-types': { body: types } })
    render()
    expect(screen.getByRole('status', { name: 'Loading service types' })).toBeInTheDocument()
    const list = await screen.findByRole('list', { name: 'Service types' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'Rename Plumbing' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retire Pest control' })).not.toBeInTheDocument()
    expect(screen.getByText('Retired')).toBeInTheDocument()
    expect(screen.getByText(/3 providers still list it with their price/)).toBeInTheDocument()
  })

  it('shows an error and retries', async () => {
    let fail = true
    stubFetch({ 'GET /admin/service-types': () => (fail ? { status: 500 } : { body: types }) })
    render()
    expect(await screen.findByRole('alert')).toHaveTextContent('The service types did not load.')
    fail = false
    click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('list', { name: 'Service types' })).toBeInTheDocument()
  })

  it('shows the empty state', async () => {
    stubFetch({ 'GET /admin/service-types': { body: [] } })
    render()
    expect(await screen.findByRole('heading', { name: 'No service types yet' })).toBeInTheDocument()
  })

  it('adds a service type, shows the toast and refetches', async () => {
    const { calls } = stubFetch({
      'GET /admin/service-types': { body: types },
      'POST /admin/service-types': {
        status: 201,
        body: { id: '9', name: 'Locksmith', status: 'offered', providersStillOffering: 0 },
      },
    })
    render()
    await screen.findByRole('list', { name: 'Service types' })
    click(screen.getByRole('button', { name: 'Add service type' }))
    type(screen.getByLabelText('Service type name'), 'Locksmith')
    click(screen.getByRole('button', { name: 'Save service type' }))
    expect(await screen.findByText('Service type added. Providers can now choose it.')).toBeInTheDocument()
    await waitFor(() => expect(calls.filter((c) => c.key === 'GET /admin/service-types')).toHaveLength(2))
    expect(calls.find((c) => c.key === 'POST /admin/service-types')?.body).toEqual({ name: 'Locksmith' })
  })

  it('shows field errors for a blank name and a duplicate (409)', async () => {
    stubFetch({
      'GET /admin/service-types': { body: types },
      'POST /admin/service-types': { status: 409, body: { error: 'dup' } },
    })
    render()
    await screen.findByRole('list', { name: 'Service types' })
    click(screen.getByRole('button', { name: 'Add service type' }))
    click(screen.getByRole('button', { name: 'Save service type' }))
    expect(screen.getByText('Enter a service type name')).toBeInTheDocument()
    type(screen.getByLabelText('Service type name'), 'plumbing')
    click(screen.getByRole('button', { name: 'Save service type' }))
    expect(await screen.findByText(/A service type with this name already exists/)).toBeInTheDocument()
    expect(screen.getByLabelText('Service type name')).toHaveAttribute('aria-invalid', 'true')
  })

  it('renames a service type', async () => {
    const { calls } = stubFetch({
      'GET /admin/service-types': { body: types },
      'PATCH /admin/service-types/2': { body: { ...types[1], name: 'Garden care' } },
    })
    render()
    await screen.findByRole('list', { name: 'Service types' })
    click(screen.getByRole('button', { name: 'Rename Gardening' }))
    const input = screen.getByLabelText('Name')
    expect(input).toHaveValue('Gardening')
    type(input, 'Garden care')
    click(screen.getByRole('button', { name: 'Save name' }))
    expect(await screen.findByText('Service type renamed.')).toBeInTheDocument()
    expect(calls.find((c) => c.key === 'PATCH /admin/service-types/2')?.body).toEqual({ name: 'Garden care' })
  })

  it('retires after confirmation; Escape and Cancel make no request', async () => {
    const { calls } = stubFetch({
      'GET /admin/service-types': { body: types },
      'POST /admin/service-types/2/retire': { body: { ...types[1], status: 'retired' } },
    })
    render()
    await screen.findByRole('list', { name: 'Service types' })
    const trigger = screen.getByRole('button', { name: 'Retire Gardening' })
    trigger.focus()
    click(trigger)
    expect(screen.getByRole('dialog', { name: 'Retire Gardening?' })).toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    click(trigger)
    click(screen.getByRole('button', { name: 'Cancel' }))
    expect(calls.some((c) => c.key.includes('retire'))).toBe(false)
    click(trigger)
    click(screen.getByRole('button', { name: 'Retire service type' }))
    expect(await screen.findByText('Gardening retired. Providers no longer see it in the list.')).toBeInTheDocument()
    await waitFor(() => expect(calls.filter((c) => c.key === 'GET /admin/service-types')).toHaveLength(2))
  })
})
