import { useEffect, useState } from 'react'
import AppShell from './AppShell'
import AvailabilityPage from './AvailabilityPage'
import type { Booking } from './api/bookings'
import MyBookingsPage from './features/payments/MyBookingsPage'
import PayBookingPage from './features/payments/PayBookingPage'

const isSettings = () => window.location.hash === '#/settings'

export default function App() {
  const [settings, setSettings] = useState(isSettings)
  // The bookings list lives under Records; Pay booking is its detail view (no extra nav item).
  const [paying, setPaying] = useState<Booking | null>(null)

  useEffect(() => {
    const onHash = () => setSettings(isSettings())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (settings) {
    return (
      <AppShell current="settings">
        <AvailabilityPage />
      </AppShell>
    )
  }
  return (
    <AppShell current="records">
      {paying ? (
        <PayBookingPage booking={paying} onBack={() => setPaying(null)} onPaid={() => setPaying(null)} />
      ) : (
        <MyBookingsPage onPay={setPaying} />
      )}
    </AppShell>
  )
}
