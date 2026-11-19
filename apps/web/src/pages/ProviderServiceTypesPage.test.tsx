import { screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { stubFetch, type Routes } from '../test/fakeFetch'
import { click, renderWithSession, type } from '../test/renderWithSession'
import ProviderServiceTypesPage from './ProviderServiceTypesPage'

const offered = ['Plumbing', 'Cleaning', 'Electrical'].map((name, i) => ({ id: String(i), name }))
const offerings = [
  { serviceType: 'Plumbing', price: { amount: '55.00', unit: 'per hour' }, typeStatus: 'offered' },
  { serviceType: 'Pest control', price: { amount: '80.00', unit: 'fixed' }, typeStatus: 'retired' },
]
const base: Routes = {
  'GET /service-types': { body: offered },
  'GET /provider/offerings': { body: offerings },
}
const render = () => renderWithSession(<ProviderServiceTypesPage />, { token: 'provider-token', role: 'provider' })

afterEach(() => vi.unstubAllGlobals())

describe('ProviderServiceTypesPage', () => {
  it('AC6: offers only the listed types', async () => {
    stubFetch(base)
    render()
    const group = await screen.findByRole('radiogroup', { name: 'Service type for this offering' })
    expect(within(group).getAllByRole('radio')).toHaveLength(3)
    expect(within(group).queryByLabelText('Pest control')).not.toBeInTheDocument()
  })

  it('AC5: sends a request and confirms it', async () => {
    const { calls } = stubFetch({ ...base, 'POST /service-type-requests': { status: 201, body: { requested: true } } })
    render()
    await screen.findByRole('radiogroup')
    click(screen.getByRole('button', { name: 'Ask an admin to add it' }))
    expect(screen.getByText('Enter the service type you need')).toBeInTheDocument()
    type(screen.getByLabelText('Service type you need'), 'Locksmith')
    click(screen.getByRole('button', { name: 'Ask an admin to add it' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Your request was sent to an admin')
    expect(calls.find((c) => c.key === 'POST /service-type-requests')?.body).toEqual({ name: 'Locksmith' })
    expect(screen.getByRole('button', { name: 'Back to the full list' })).toBeInTheDocument()
  })

  it('AC7: adding a type is refused and the list is unchanged', async () => {
    stubFetch({ ...base, 'POST /admin/service-types': { status: 403, body: { error: 'no' } } })
    render()
    await screen.findByRole('radiogroup')
    const initialCount = screen.getAllByRole('radio').length
    type(screen.getByLabelText('Service type you need'), 'Locksmith')
    click(screen.getByRole('button', { name: 'Add service type' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Only admins can add service types')
    expect(screen.getAllByRole('radio')).toHaveLength(initialCount)
  })

  it('AC8: a retired type keeps its price in the offerings table', async () => {
    stubFetch(base)
    render()
    const table = await screen.findByRole('table')
    expect(within(table).getByRole('row', { name: /Pest control.*£80\.00 fixed.*Type retired/ })).toBeInTheDocument()
    expect(within(table).getByRole('row', { name: /Plumbing.*£55\.00 per hour.*Active/ })).toBeInTheDocument()
  })

  it('shows an error with Try again when the list does not load', async () => {
    stubFetch({ ...base, 'GET /service-types': { status: 500 } })
    render()
    expect(await screen.findByRole('alert')).toHaveTextContent('The service types did not load.')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})
