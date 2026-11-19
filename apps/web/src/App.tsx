import { useState } from 'react'
import type { Booking } from './api/bookings'
import MyBookingsPage from './features/payments/MyBookingsPage'
import PayBookingPage from './features/payments/PayBookingPage'
import './shell.css'

const NAV_ITEMS = [
  { id: 'records', label: 'Records' },
  { id: 'reports', label: 'Reports' },
  { id: 'settings', label: 'Settings' },
  { id: 'account', label: 'Account' },
] as const

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  // The bookings list lives under Records; Pay booking is its detail view (no extra nav item).
  const [paying, setPaying] = useState<Booking | null>(null)

  return (
    <div className="shell" data-nav="records">
      <header className="shell-header">
        <a className="shell-brand" href="#">
          Records
        </a>
        <button
          className="btn btn-secondary btn-sm shell-toggle"
          type="button"
          aria-controls="main-nav"
          aria-expanded={menuOpen}
          aria-label="Menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          Menu
        </button>
        <nav className="shell-nav" id="main-nav" aria-label="Main" hidden={!menuOpen}>
          {NAV_ITEMS.map((item) => (
            <a
              key={item.id}
              className="shell-link"
              href="#"
              data-nav-key={item.id}
              aria-current={item.id === 'records' ? 'page' : undefined}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </header>
      <main className="shell-main">
        {paying ? (
          <PayBookingPage booking={paying} onBack={() => setPaying(null)} onPaid={() => setPaying(null)} />
        ) : (
          <MyBookingsPage onPay={setPaying} />
        )}
      </main>
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
