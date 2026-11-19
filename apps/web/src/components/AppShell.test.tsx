import { readFileSync } from 'node:fs'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { click, renderWithSession } from '../test/renderWithSession'
import AppShell from './AppShell'

describe('AppShell', () => {
  it('renders the four nav links in order with Settings current', () => {
    renderWithSession(<AppShell>content</AppShell>, { token: 't', role: 'admin' }, '/settings/service-types')
    click(screen.getByRole('button', { name: 'Menu' }))
    const nav = screen.getByRole('navigation', { name: 'Main' })
    const links = Array.from(nav.querySelectorAll('a'))
    expect(links.map((a) => a.getAttribute('data-nav-key'))).toEqual(['records', 'reports', 'settings', 'account'])
    expect(links.map((a) => a.textContent)).toEqual(['Records', 'Reports', 'Settings', 'Account'])
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Account' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-controls', 'main-nav')
  })

  it('loads the design tokens in index.css', () => {
    expect(readFileSync('src/index.css', 'utf8')).toContain('../design/tokens.css')
  })
})
