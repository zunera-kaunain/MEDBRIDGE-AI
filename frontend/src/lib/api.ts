/**
 * API client.
 *
 * Paths are relative — vite.config.ts proxies /api and /auth to the backend
 * on port 8000, so nothing here hardcodes a host. In week 6 FastAPI serves
 * this bundle directly and the same relative paths keep working.
 */

const TOKEN_KEY = 'medbridge_token'
const RECEPTIONIST_TOKEN_KEY = 'medbridge_receptionist_token'

// Separate storage per role. These were originally one shared key, which
// broke: both the doctor and receptionist auth contexts try to restore
// their session on every page load, regardless of which role is actually
// signed in. With one shared token, whichever context's restore check
// failed (because the token belonged to the OTHER role) would clear it —
// wiping out a perfectly valid session for the role that was actually
// logged in, moments after login. Two keys means each context only ever
// touches its own.

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export function getReceptionistToken(): string | null {
  return localStorage.getItem(RECEPTIONIST_TOKEN_KEY)
}

export function setReceptionistToken(token: string): void {
  localStorage.setItem(RECEPTIONIST_TOKEN_KEY, token)
}

export function clearReceptionistToken(): void {
  localStorage.removeItem(RECEPTIONIST_TOKEN_KEY)
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
  /** Which token to attach when auth is true. Defaults to 'doctor' so
   * every existing call site (written before receptionists existed)
   * keeps working unchanged. */
  role?: 'doctor' | 'receptionist'
}

export async function api<T>(
  path: string,
  { method = 'GET', body, auth = true, role = 'doctor' }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  if (auth) {
    const token = role === 'receptionist' ? getReceptionistToken() : getToken()
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