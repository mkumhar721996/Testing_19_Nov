import { AuthProvider, useAuth } from './auth/AuthContext'
import AppHeader from './components/AppHeader'
import SignInPage from './pages/SignInPage'

function Shell() {
  const { status, user, signOut } = useAuth()
  if (status === 'checking') return null
  if (status === 'signed-in' && user) {
    return (
      <div className="shell">
        <AppHeader user={user} onSignOut={signOut} />
        <main className="shell-main" />
      </div>
    )
  }
  return <SignInPage />
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  )
}
