/**
 * API client.
 *
 * Paths are relative — vite.config.ts proxies /api and /auth to the backend
 * on port 8000, so nothing here hardcodes a host. In week 6 FastAPI serves
 * this bundle directly and the same relative paths keep working.
 */

const TOKEN_KEY = 'medbridge_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  auth?: boolean
}

export async function api<T>(
  path: string,
  { method = 'GET', body, auth = true }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  if (auth) {
    const token = getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (res.status === 204) return undefined as T

  const payload = await res.json().catch(() => null)

  if (!res.ok) {
    // FastAPI puts the message in `detail`, but validation errors make it an
    // array of objects. Flatten both shapes into one readable string.
    const detail = payload?.detail
    const message = Array.isArray(detail)
      ? detail.map((d: { msg?: string }) => d.msg ?? 'Invalid value').join('. ')
      : typeof detail === 'string'
        ? detail
        : 'Something went wrong. Try again.'
    throw new ApiError(res.status, message)
  }

  return payload as T
}