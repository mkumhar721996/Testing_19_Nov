import { createContext, useContext, type ReactNode } from 'react'

export type Role = 'admin' | 'provider'
export interface Session {
  token: string | null
  role: Role | null
}

// Entra sign-in is a separate item; this context is the seam it will fill.
const SessionContext = createContext<Session>({ token: null, role: null })

export function SessionProvider({ value, children }: { value: Session; children: ReactNode }) {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): Session {
  return useContext(SessionContext)
}
