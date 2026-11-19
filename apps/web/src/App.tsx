import { Navigate, Route, Routes } from 'react-router-dom'
import { useSession } from './auth/session'
import AppShell from './components/AppShell'
import AdminServiceTypesPage from './pages/AdminServiceTypesPage'
import ProviderServiceTypesPage from './pages/ProviderServiceTypesPage'

// Records and Reports belong to other stories.
function Placeholder({ title }: { title: string }) {
  return (
    <div className="page-head">
      <h1>{title}</h1>
    </div>
  )
}

function Home() {
  const { role } = useSession()
  return <Navigate to={role === 'admin' ? '/settings/service-types' : '/account/service-types'} replace />
}

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/records" element={<Placeholder title="Records" />} />
        <Route path="/reports" element={<Placeholder title="Reports" />} />
        <Route path="/settings/service-types" element={<AdminServiceTypesPage />} />
        <Route path="/account/service-types" element={<ProviderServiceTypesPage />} />
      </Routes>
    </AppShell>
  )
}
