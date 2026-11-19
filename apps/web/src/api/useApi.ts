import { useMemo } from 'react'
import { useSession } from '../auth/session'
import { createApi } from './client'

export function useApi() {
  const { token } = useSession()
  return useMemo(() => createApi(() => token), [token])
}
