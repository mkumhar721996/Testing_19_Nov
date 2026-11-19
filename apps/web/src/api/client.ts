import type { AdminServiceType, ProviderOffering, ServiceType } from './types'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

export function createApi(
  getToken: () => string | null,
  baseUrl: string = import.meta.env.VITE_RECORDS_API_URL ?? '/api',
) {
  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = getToken()
    const headers: Record<string, string> = {}
    if (token) headers.authorization = `Bearer ${token}`
    if (body !== undefined) headers['content-type'] = 'application/json'
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (!res.ok) throw new ApiError(res.status, `${method} ${path} failed with ${res.status}`)
    return (await res.json()) as T
  }
  const get = <T,>(path: string) => request<T>('GET', path)
  const post = <T,>(path: string, body?: unknown) => request<T>('POST', path, body)
  const patch = <T,>(path: string, body?: unknown) => request<T>('PATCH', path, body)

  return {
    adminTypes: () => get<AdminServiceType[]>('/admin/service-types'),
    offeredTypes: () => get<ServiceType[]>('/service-types'),
    addType: (name: string) => post<AdminServiceType>('/admin/service-types', { name }),
    renameType: (id: string, name: string) => patch<AdminServiceType>(`/admin/service-types/${id}`, { name }),
    retireType: (id: string) => post<AdminServiceType>(`/admin/service-types/${id}/retire`),
    requestType: (name: string) => post<{ requested: true }>('/service-type-requests', { name }),
    myOfferings: () => get<ProviderOffering[]>('/provider/offerings'),
  }
}

export type Api = ReturnType<typeof createApi>
