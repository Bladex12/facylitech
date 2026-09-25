const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detalle: res.statusText }))
    throw new ApiError(res.status, body.detalle ?? body.detail ?? res.statusText)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
}

function toQueryString(params: Record<string, string | number | undefined>): string {
  const usable = Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
  if (usable.length === 0) return ''
  return '?' + new URLSearchParams(usable as [string, string][]).toString()
}

export { toQueryString }
