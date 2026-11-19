import { vi } from 'vitest'

type Reply = { status?: number; body?: unknown } | (() => { status?: number; body?: unknown })
export type Routes = Record<string, Reply>

// Stubs global fetch; routes are keyed "METHOD /path" (the API base URL is stripped).
export function stubFetch(routes: Routes) {
  const calls: { key: string; body?: unknown }[] = []
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const path = String(url).replace(/^\/api/, '')
    const key = `${init?.method ?? 'GET'} ${path}`
    calls.push({ key, body: init?.body ? JSON.parse(String(init.body)) : undefined })
    const reply = routes[key]
    if (!reply) throw new Error(`no stub for ${key}`)
    const { status = 200, body } = typeof reply === 'function' ? reply() : reply
    return new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  })
  vi.stubGlobal('fetch', fn)
  return { calls, fn }
}
