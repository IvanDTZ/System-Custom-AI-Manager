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
  const data = text ? JSON.parse(text) : {}

  if (!res.ok) {
    const err = data?.error
    throw new ApiError(
      res.status,
      err?.code ?? 'unknown_error',
      err?.message ?? `Request failed with ${res.status}`,
    )
  }
  return data as T
}
