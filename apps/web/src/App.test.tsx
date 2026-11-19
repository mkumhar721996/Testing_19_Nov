import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from './App'

describe('App', () => {
  it('renders the shell and the Records placeholder', () => {
    render(
      <MemoryRouter initialEntries={['/records']}>
        <App />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'Records' })).toBeInTheDocument()
  })
})
