import { useState, type ReactNode } from 'react'

const NAV = [
  { id: 'records', label: 'Records' },
  { id: 'reports', label: 'Reports' },
  { id: 'settings', label: 'Settings' },
  { id: 'account', label: 'Account' },
] as const

export default function AppShell({ current, children }: { current: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="shell">
      <header className="shell-header">
        <a className="shell-brand" href="#">
          Records
        </a>
        <button
          className="btn btn-secondary btn-sm shell-toggle"
          type="button"
          aria-controls="main-nav"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          Menu
        </button>
        <nav className="shell-nav" id="main-nav" aria-label="Main" hidden={!open}>
          {NAV.map((item) => (
            <a
              key={item.id}
              className="shell-link"
              href="#"
              data-nav-key={item.id}
              aria-current={item.id === current ? 'page' : undefined}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </header>
      <main className="shell-main">{children}</main>
      <footer className="shell-footer">
        <span>Records</span>
        <div className="shell-footer-links">
          <a href="#">Help</a>
          <a href="#">Privacy</a>
        </div>
      </footer>
    </div>
  )
}
