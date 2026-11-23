import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import * as api from './api'
import type { AuthUser } from './types'

const TOKEN_KEY = 'session-token'

type Status = 'signed-out' | 'checking' | 'signed-in'

interface AuthContextValue {
  status: Status
  user: AuthUser | null
  error: string | null
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>(() => (sessionStorage.getItem(TOKEN_KEY) ? 'checking' : 'signed-out'))
  const [user, setUser] = useState<AuthUser | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = sessionStorage.getItem(TOKEN_KEY)
    if (!token) return
    let cancelled = false
    api.fetchMe(token).then((result) => {
      if (cancelled) return
      if (result.ok) {
        setUser(result.user)
        setStatus('signed-in')
      } else {
        // Only a rejected token ends the session; a network failure keeps it for a retry on reload.
        if (result.code !== 'network_error') sessionStorage.removeItem(TOKEN_KEY)
        setStatus('signed-out')
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null)
    const result = await api.signIn(email, password)
    if (result.ok) {
      sessionStorage.setItem(TOKEN_KEY, result.token)
      setUser(result.user)
      setStatus('signed-in')
    } else {
      setError(result.message)
    }
  }, [])

  const signOut = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY)
    setUser(null)
    setError(null)
    setStatus('signed-out')
  }, [])

  const value = useMemo(
    () => ({ status, user, error, signIn, signOut }),
    [status, user, error, signIn, signOut],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
