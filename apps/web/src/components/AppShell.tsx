import { useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'

const NAV = [
  { key: 'records', label: 'Records', to: '/records' },
  { key: 'reports', label: 'Reports', to: '/reports' },
  { key: 'settings', label: 'Settings', to: '/settings/service-types' },
  { key: 'account', label: 'Account', to: '/account/service-types' },
]

export default function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()

  return (
    <div className="shell">
      <header className="shell-header">
        <Link className="shell-brand" to="/">
          Records
        </Link>
        <button
          className="btn btn-secondary btn-sm shell-toggle"
          type="button"
          aria-controls="main-nav"
          aria-expanded={open}
          aria-label="Menu"
          onClick={() => setOpen((v) => !v)}
        >
          Menu
        </button>
        <nav className="shell-nav" id="main-nav" aria-label="Main" hidden={!open}>
          {NAV.map((item) => (
            <Link
              key={item.key}
              className="shell-link"
              to={item.to}
              data-nav-key={item.key}
              aria-current={pathname.startsWith(`/${item.key}`) ? 'page' : undefined}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="shell-main">{children}</main>
      <footer className="shell-footer">
        <span>Records</span>
        <div className="shell-footer-links">
          <a href="#help">Help</a>
          <a href="#privacy">Privacy</a>
        </div>
      </footer>
    </div>
  )
}
