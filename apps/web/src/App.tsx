import AppShell from './AppShell'
import AvailabilityPage from './AvailabilityPage'

export default function App() {
  return (
    <AppShell current="settings">
      <AvailabilityPage />
    </AppShell>
  )
}
