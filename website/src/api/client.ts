const TOKEN_KEY = 'aim.token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
}

export async function request<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers = new Headers(opts.headers || {})
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let body: BodyInit | null = null
  if (opts.body !== undefined && opts.body !== null) {
    if (typeof opts.body === 'string' || opts.body instanceof FormData) {
      body = opts.body as BodyInit
    } else {
      headers.set('Content-Type', 'application/json')
      body = JSON.stringify(opts.body)
    }
  }

  const res = await fetch(`/api${path}`, {
    ...opts,
    headers,
    body,
  })

  if (res.status === 204) {
    return undefined as T
  }

  const text = await res.text()
  let data: { error?: { code?: string; message?: string } } & Record<string, unknown> = {}
  if (text.trim()) {
    try {
      data = JSON.parse(text)
    } catch {
      // The body is not clean JSON. Most common causes:
      //   - Backend running an old binary (route not registered → "404 page not found")
      //   - Two responses concatenated (handler wrote twice — bug)
      //   - Nginx / proxy injected an HTML error page
      // Surface the raw body so we can diagnose instead of dying with "position 4".
      if (import.meta.env.DEV) {
        console.error(`[api] non-JSON response for ${opts.method ?? 'GET'} /api${path}\nstatus: ${res.status}\nbody:`, text)
      }
      const snippet = text.length > 160 ? text.slice(0, 160) + '…' : text
      throw new ApiError(
        res.status || 500,
        'invalid_response',
        res.ok
          ? `Server returned an unexpected response. Try restarting the backend. (got: ${snippet})`
          : `HTTP ${res.status}: ${snippet}`,
      )
    }
  }

  if (!res.ok) {
    const err = data.error
    throw new ApiError(
      res.status,
      err?.code ?? 'unknown_error',
      err?.message ?? `Request failed with ${res.status}`,
    )
  }
  return data as T
}
