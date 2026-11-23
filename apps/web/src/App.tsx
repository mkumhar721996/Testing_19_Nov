import { useEffect, useState } from 'react'
import AppShell from './AppShell'
import AvailabilityPage from './AvailabilityPage'
import type { Booking } from './api/bookings'
import { AuthProvider, useAuth } from './auth/AuthContext'
import MyBookingsPage from './features/payments/MyBookingsPage'
import PayBookingPage from './features/payments/PayBookingPage'
import SignInPage from './pages/SignInPage'

const isSettings = () => window.location.hash === '#/settings'

function Shell() {
  const { status, user, signOut } = useAuth()
  const [settings, setSettings] = useState(isSettings)
  // The bookings list lives under Records; Pay booking is its detail view (no extra nav item).
  const [paying, setPaying] = useState<Booking | null>(null)

  useEffect(() => {
    const onHash = () => setSettings(isSettings())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (status === 'checking') return null
  if (status !== 'signed-in' || !user) return <SignInPage />

  if (settings) {
    return (
      <AppShell current="settings" user={user} onSignOut={signOut}>
        <AvailabilityPage />
      </AppShell>
    )
  }
  return (
    <AppShell current="records" user={user} onSignOut={signOut}>
      {paying ? (
        <PayBookingPage booking={paying} onBack={() => setPaying(null)} onPaid={() => setPaying(null)} />
      ) : (
        <MyBookingsPage onPay={setPaying} />
      )}
    </AppShell>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  )
}
