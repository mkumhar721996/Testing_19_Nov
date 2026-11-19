import { fireEvent, render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { SessionProvider, type Session } from '../auth/session'

export function renderWithSession(ui: ReactElement, session: Session, route = '/') {
  return render(
    <SessionProvider value={session}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </SessionProvider>,
  )
}

export const click = (el: HTMLElement) => fireEvent.click(el)
export const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } })
