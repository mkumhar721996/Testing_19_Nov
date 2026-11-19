import type { AuthResult, AuthUser, MeResult } from './types'

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? ''

const NETWORK_ERROR = {
  ok: false as const,
  code: 'network_error',
  message: 'We could not reach the server. Check your connection and try again.',
}

async function failure(res: Response) {
  const body = (await res.json().catch(() => ({}))) as { code?: string; message?: string }
  return {
    ok: false as const,
    code: body.code ?? 'unknown_error',
    message: body.message ?? 'Something went wrong. Try again.',
  }
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  try {
    const res = await fetch(`${baseUrl}/auth/sign-in`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) return await failure(res)
    const body = (await res.json()) as { token: string; user: AuthUser }
    return { ok: true, token: body.token, user: body.user }
  } catch {
    return NETWORK_ERROR
  }
}

export async function fetchMe(token: string): Promise<MeResult> {
  try {
    const res = await fetch(`${baseUrl}/me`, { headers: { authorization: `Bearer ${token}` } })
    if (!res.ok) return await failure(res)
    return { ok: true, user: (await res.json()) as AuthUser }
  } catch {
    return NETWORK_ERROR
  }
}
