/**
 * Response helpers for server routes.
 *
 * `Response.redirect()` returns immutable headers, which blocks `Set-Cookie`,
 * so redirects are built by hand here.
 */

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers)
  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json; charset=utf-8')
  }
  return new Response(JSON.stringify(data), { ...init, headers })
}

export function noStoreJson(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers)
  headers.set('cache-control', 'no-store')
  return json(data, { ...init, headers })
}

export function redirect(location: URL | string, status = 307): Response {
  return new Response(null, {
    headers: {
      'cache-control': 'no-store',
      location: String(location),
    },
    status,
  })
}
