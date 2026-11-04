/**
 * Minimal cookie helpers over the Web `Request` and `Response` types.
 *
 * TanStack Start server routes receive a standard `Request` and return a
 * standard `Response`, so nothing here depends on the framework.
 */

export type CookieOptions = {
  expires?: Date
  httpOnly?: boolean
  maxAge?: number
  path?: string
  sameSite?: 'lax' | 'strict' | 'none'
  secure?: boolean
}

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get('cookie')
  if (!header) return undefined

  for (const part of header.split(';')) {
    const separator = part.indexOf('=')
    if (separator === -1) continue
    if (part.slice(0, separator).trim() !== name) continue
    const value = part.slice(separator + 1).trim()
    try {
      return decodeURIComponent(value)
    } catch {
      return value
    }
  }

  return undefined
}

export function serializeCookie(
  name: string,
  value: string,
  options: CookieOptions = {},
): string {
  const parts = [`${name}=${encodeURIComponent(value)}`]
  if (typeof options.maxAge === 'number')
    parts.push(`Max-Age=${options.maxAge}`)
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`)
  parts.push(`Path=${options.path ?? '/'}`)
  if (options.httpOnly) parts.push('HttpOnly')
  if (options.secure) parts.push('Secure')
  if (options.sameSite) {
    const sameSite = options.sameSite
    parts.push(
      `SameSite=${sameSite.charAt(0).toUpperCase()}${sameSite.slice(1)}`,
    )
  }
  return parts.join('; ')
}

export function setCookie(
  response: Response,
  name: string,
  value: string,
  options: CookieOptions = {},
): void {
  response.headers.append('set-cookie', serializeCookie(name, value, options))
}

export function deleteCookie(
  response: Response,
  name: string,
  options: Pick<CookieOptions, 'path' | 'secure'> = {},
): void {
  response.headers.append(
    'set-cookie',
    serializeCookie(name, '', {
      expires: new Date(0),
      httpOnly: true,
      maxAge: 0,
      path: options.path ?? '/',
      sameSite: 'lax',
      secure: options.secure,
    }),
  )
}

/** Every `Set-Cookie` header on a response, parsed to `{ name, value }`. */
export function responseCookies(
  response: Response,
): Array<{ name: string; value: string }> {
  return response.headers.getSetCookie().map((line) => {
    const [pair] = line.split(';')
    const separator = pair.indexOf('=')
    return {
      name: pair.slice(0, separator),
      value: pair.slice(separator + 1),
    }
  })
}

/** The raw value of one `Set-Cookie` header on a response, if present. */
export function responseCookie(
  response: Response,
  name: string,
): string | undefined {
  return responseCookies(response)
    .filter((cookie) => cookie.name === name)
    .at(-1)?.value
}

/**
 * Builds a `Cookie` request header that replays every cookie a response set,
 * which is how the tests chain start, callback, and session requests.
 */
export function cookieHeaderFromResponse(response: Response): string {
  return responseCookies(response)
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ')
}
