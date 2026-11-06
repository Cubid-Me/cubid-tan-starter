/**
 * Server-mediated Sign in with Cubid (SIWC) helpers.
 *
 * Ported from cubid-starter-v3 (`src/lib/cubid/siwc-demo.ts`). Everything
 * here works on the Web `Request` and `Response` types so the same code runs
 * in TanStack Start server routes, tests, or any other Web-standard server.
 *
 * Cookies carry encrypted, authenticated, compressed JSON with an embedded
 * expiry and a purpose tag, so a transaction cookie cannot be replayed as a
 * session cookie. Tokens are never stored in cookies.
 */
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto'
import { deflateRawSync, inflateRawSync } from 'node:zlib'

import { CubidAuthError } from '@cubid/auth'
import type { CubidIdTokenClaims, CubidUserInfo } from '@cubid/auth'

import { deleteCookie, readCookie, setCookie } from '#/lib/http/cookies'
import { redactValue } from '#/lib/cubid/redact'

export const defaultCookiePrefix = 'cubid_siwc'

/**
 * Cookie prefix, read per call so it follows `process.env` at request time.
 * Set `CUBID_SIWC_COOKIE_PREFIX` per application: browsers ignore the port,
 * so two apps on `localhost` with the same prefix would overwrite each
 * other's session cookies. Lowercase letters, digits and underscores only.
 */
export function siwcCookiePrefix(): string {
  const prefix = process.env.CUBID_SIWC_COOKIE_PREFIX?.trim()
  if (!prefix) return defaultCookiePrefix
  if (!/^[a-z][a-z0-9_]{0,31}$/u.test(prefix)) {
    throw new Error(
      'CUBID_SIWC_COOKIE_PREFIX must be 1-32 lowercase letters, digits or underscores, starting with a letter.',
    )
  }
  return prefix
}

export type SiwcCookieNames = {
  returnTo: string
  session: string
  trace: string
  transaction: string
}

export function siwcCookieNames(): SiwcCookieNames {
  const prefix = siwcCookiePrefix()
  return {
    returnTo: `${prefix}_return_to`,
    session: `${prefix}_session`,
    trace: `${prefix}_trace`,
    transaction: `${prefix}_txn`,
  }
}

/** Cookie names resolved at access time, so `siwcCookies.session` stays valid. */
export const siwcCookies: Readonly<SiwcCookieNames> = {
  get returnTo() {
    return siwcCookieNames().returnTo
  },
  get session() {
    return siwcCookieNames().session
  },
  get trace() {
    return siwcCookieNames().trace
  },
  get transaction() {
    return siwcCookieNames().transaction
  },
}

export const siwcCallbackPath = '/api/cubid/siwc/callback'

const transactionMaxAgeSeconds = 10 * 60
const sessionMaxAgeSeconds = 30 * 60

/**
 * Browsers cap one cookie at 4096 bytes including its name and attributes,
 * and the session, trace and transaction cookies travel together on every
 * request. These bounds keep each SIWC cookie well inside that.
 */
export const maxCookieValueBytes = 3500
/** Bound on the JSON form of `session.app`, the application's extras. */
export const maxSessionAppBytes = 1024
// Development sessions intentionally expire when this server process restarts.
const devGlobal = globalThis as typeof globalThis & {
  cubidSiwcDevelopmentKey?: Buffer
}
const developmentKey = (devGlobal.cubidSiwcDevelopmentKey ??= randomBytes(32))

function cookieKey(): Buffer {
  const secret = process.env.CUBID_SIWC_COOKIE_SECRET
  if (secret && secret.length >= 32)
    return createHash('sha256').update(secret).digest()
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Set CUBID_SIWC_COOKIE_SECRET to at least 32 random characters.',
    )
  }
  return developmentKey
}

export type SiwcTransaction = {
  codeVerifier: string
  issuer: string
  nonce: string
  redirectUri: string
  state: string
}

export type SiwcSession = {
  /** Application-defined extras (for example an internal account id). */
  app?: Record<string, unknown>
  authenticatedAt: string
  claims: CubidIdTokenClaims | null
  clientId: string
  expiresAt: number | null
  issuer: string
  scope: Array<string>
  subject: string | null
  userInfo: CubidUserInfo | null
}

export type SiwcTraceEntry = {
  at: string
  label: string
  request?: Record<string, unknown>
  response?: Record<string, unknown>
  step: string
}

export type SiwcConfig =
  | {
      configured: false
      missing: Array<string>
    }
  | {
      clientId: string
      configured: true
      issuer: string
      redirectUri: string
      scope: Array<string>
    }

export function requestOrigin(request: Request): string {
  return new URL(request.url).origin
}

function isSecureRequest(request: Request): boolean {
  return new URL(request.url).protocol === 'https:'
}

/**
 * Reads SIWC configuration from server env. `VITE_*` values are the
 * browser-safe fallbacks; Start loads `.env` files into `process.env` on the
 * server, so both prefixes resolve here without touching `import.meta.env`.
 */
export function getSiwcConfig(request: Request): SiwcConfig {
  const issuer =
    process.env.CUBID_SIWC_ISSUER_URL ?? process.env.VITE_CUBID_ISSUER_URL
  const clientId =
    process.env.CUBID_SIWC_CLIENT_ID ?? process.env.VITE_CUBID_OIDC_CLIENT_ID
  const redirectUri =
    process.env.CUBID_SIWC_REDIRECT_URI ??
    `${requestOrigin(request)}${siwcCallbackPath}`
  const scope = (process.env.CUBID_SIWC_SCOPE ?? 'openid profile email')
    .split(/\s+/u)
    .filter(Boolean)
  const requiredConfigFields = [
    ['CUBID_SIWC_ISSUER_URL or VITE_CUBID_ISSUER_URL', issuer],
    ['CUBID_SIWC_CLIENT_ID or VITE_CUBID_OIDC_CLIENT_ID', clientId],
    ['CUBID_SIWC_REDIRECT_URI', redirectUri],
  ] satisfies Array<[string, string | undefined]>
  const missing = requiredConfigFields
    .filter(([, value]) => !String(value ?? '').trim())
    .map(([key]) => key)
  if (
    process.env.NODE_ENV === 'production' &&
    (process.env.CUBID_SIWC_COOKIE_SECRET?.length ?? 0) < 32
  ) {
    missing.push('CUBID_SIWC_COOKIE_SECRET (at least 32 random characters)')
  }

  if (missing.length > 0) {
    return { configured: false, missing }
  }

  return {
    clientId: clientId!,
    configured: true,
    issuer: issuer!,
    redirectUri,
    scope,
  }
}

export function setTransactionCookie(
  response: Response,
  request: Request,
  transaction: SiwcTransaction,
) {
  setCookie(
    response,
    siwcCookies.transaction,
    encodeCookiePayload(
      transaction,
      siwcCookies.transaction,
      transactionMaxAgeSeconds,
    ),
    {
      httpOnly: true,
      maxAge: transactionMaxAgeSeconds,
      path: '/',
      sameSite: 'lax',
      secure: isSecureRequest(request),
    },
  )
}

export function setReturnToCookie(
  response: Response,
  request: Request,
  returnTo: string,
) {
  setCookie(response, siwcCookies.returnTo, normalizeReturnTo(returnTo), {
    httpOnly: true,
    maxAge: transactionMaxAgeSeconds,
    path: '/',
    sameSite: 'lax',
    secure: isSecureRequest(request),
  })
}

/**
 * Validates the extras an application hook returns for `session.app`. They
 * end up in the session cookie and in the browser-visible session summary,
 * so they must be a small plain object of non-secret values: an account id,
 * a role, a display preference. Not a profile, not a token.
 */
export function assertSessionApp(
  app: unknown,
): asserts app is Record<string, unknown> | undefined {
  if (typeof app === 'undefined') return
  if (
    app === null ||
    typeof app !== 'object' ||
    Array.isArray(app) ||
    Object.getPrototypeOf(app) !== Object.prototype
  ) {
    throw new CubidAuthError(
      'onAuthenticated must return a plain object (or undefined) for session.app.',
      { category: 'validation', code: 'invalid_app_extras' },
    )
  }
  const size = Buffer.byteLength(JSON.stringify(app), 'utf8')
  if (size > maxSessionAppBytes) {
    throw new CubidAuthError(
      `session.app is ${size} bytes; keep it under ${maxSessionAppBytes} (store ids, not profiles).`,
      { category: 'validation', code: 'app_extras_too_large' },
    )
  }
}

export function setSessionCookie(
  response: Response,
  request: Request,
  session: SiwcSession,
) {
  assertSessionApp(session.app)
  const value = encodeCookiePayload(
    sanitizeSiwcSession(session),
    siwcCookies.session,
    sessionMaxAgeSeconds,
  )
  if (value.length > maxCookieValueBytes) {
    throw new CubidAuthError(
      `The SIWC session cookie is ${value.length} bytes; the limit is ${maxCookieValueBytes}.`,
      { category: 'validation', code: 'session_cookie_too_large' },
    )
  }
  setCookie(response, siwcCookies.session, value, {
    httpOnly: true,
    maxAge: sessionMaxAgeSeconds,
    path: '/',
    sameSite: 'lax',
    secure: isSecureRequest(request),
  })
}

export function sanitizeSiwcSession(session: SiwcSession): SiwcSession {
  return redactSiwcValue(session) as SiwcSession
}

export function setTraceCookie(
  response: Response,
  request: Request,
  trace: Array<SiwcTraceEntry>,
) {
  // Stay below browser cookie limits, even when provider metadata is verbose.
  const bounded = redactSiwcValue(trace.slice(-12)) as Array<SiwcTraceEntry>
  while (
    bounded.length &&
    encodeCookiePayload(bounded, siwcCookies.trace, sessionMaxAgeSeconds)
      .length > maxCookieValueBytes
  )
    bounded.shift()
  setCookie(
    response,
    siwcCookies.trace,
    encodeCookiePayload(bounded, siwcCookies.trace, sessionMaxAgeSeconds),
    {
      httpOnly: true,
      maxAge: sessionMaxAgeSeconds,
      path: '/',
      sameSite: 'lax',
      secure: isSecureRequest(request),
    },
  )
}

export function readTransactionCookie(
  request: Request,
): SiwcTransaction | null {
  return readCookiePayload<SiwcTransaction>(
    readCookie(request, siwcCookies.transaction),
    siwcCookies.transaction,
  )
}

export function readSessionCookie(request: Request): SiwcSession | null {
  return readCookiePayload<SiwcSession>(
    readCookie(request, siwcCookies.session),
    siwcCookies.session,
  )
}

export function readTraceCookie(request: Request): Array<SiwcTraceEntry> {
  return (
    readCookiePayload<Array<SiwcTraceEntry>>(
      readCookie(request, siwcCookies.trace),
      siwcCookies.trace,
    ) ?? []
  )
}

export function readReturnToCookie(request: Request): string {
  return normalizeReturnTo(readCookie(request, siwcCookies.returnTo) ?? '/')
}

export function clearSiwcTransaction(response: Response, request: Request) {
  const secure = isSecureRequest(request)
  deleteCookie(response, siwcCookies.transaction, { secure })
  deleteCookie(response, siwcCookies.returnTo, { secure })
}

export function clearSiwcSession(response: Response, request: Request) {
  deleteCookie(response, siwcCookies.session, {
    secure: isSecureRequest(request),
  })
}

export function appendTrace(
  request: Request,
  response: Response,
  entries: Array<SiwcTraceEntry>,
) {
  setTraceCookie(response, request, [...readTraceCookie(request), ...entries])
}

export function traceEntry(
  step: string,
  label: string,
  details: Omit<SiwcTraceEntry, 'at' | 'label' | 'step'> = {},
): SiwcTraceEntry {
  return {
    at: new Date().toISOString(),
    label,
    step,
    ...(redactSiwcValue(details) as Omit<
      SiwcTraceEntry,
      'at' | 'label' | 'step'
    >),
  }
}

export function buildSessionSummary(
  session: SiwcSession | null,
  trace: Array<SiwcTraceEntry> = [],
) {
  if (
    !session ||
    (session.expiresAt !== null && session.expiresAt <= Date.now())
  ) {
    return {
      authenticated: false,
      status: 'not_signed_in',
      trace,
    }
  }

  return {
    authenticated: true,
    session: {
      app: session.app ?? null,
      authenticatedAt: session.authenticatedAt,
      claims: redactSiwcValue(session.claims),
      clientId: session.clientId,
      expiresAt: session.expiresAt,
      issuer: session.issuer,
      scope: session.scope,
      subject: session.subject,
      userInfo: redactSiwcValue(session.userInfo),
    },
    status: 'signed_in',
    trace,
  }
}

export function buildErrorPayload(error: unknown) {
  if (error instanceof CubidAuthError) {
    return {
      code: error.code,
      message: error.message,
      name: error.name,
      status: error.status,
    }
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
    }
  }

  return {
    message: 'The SIWC request failed.',
    name: 'Error',
  }
}

export function normalizeReturnTo(value: string): string {
  const resolved = resolveLocalReturnTo(value, 'https://starter.invalid')
  return `${resolved.pathname}${resolved.search}${resolved.hash}`
}

export function resolveLocalReturnTo(value: string, baseOrigin: string): URL {
  const origin = new URL(baseOrigin).origin

  if (!hasSafeLocalPathPrefix(value)) {
    return new URL('/', origin)
  }

  try {
    const resolved = new URL(value, origin)

    if (
      resolved.origin !== origin ||
      resolved.username.length > 0 ||
      resolved.password.length > 0
    ) {
      return new URL('/', origin)
    }

    return resolved
  } catch {
    return new URL('/', origin)
  }
}

export function assertSiwcDiscoveryIssuer(
  configuredIssuer: string,
  discoveryIssuer: string,
): void {
  if (normalizeIssuer(configuredIssuer) !== normalizeIssuer(discoveryIssuer)) {
    throw new CubidAuthError(
      'Cubid discovery metadata did not match the configured issuer.',
      {
        category: 'validation',
        code: 'discovery_issuer_mismatch',
      },
    )
  }
}

export function redactSiwcValue(value: unknown): unknown {
  return redactValue(value)
}

function encodeCookiePayload(
  value: unknown,
  purpose: string,
  maxAge: number,
): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', cookieKey(), iv)
  cipher.setAAD(Buffer.from(purpose))
  const encrypted = Buffer.concat([
    cipher.update(
      deflateRawSync(
        Buffer.from(
          JSON.stringify({ value, expires: Date.now() + maxAge * 1000 }),
        ),
      ),
    ),
    cipher.final(),
  ])
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
    'base64url',
  )
}

function readCookiePayload<T>(
  value: string | undefined,
  purpose: string,
): T | null {
  if (!value) {
    return null
  }

  try {
    const bytes = Buffer.from(value, 'base64url')
    const decipher = createDecipheriv(
      'aes-256-gcm',
      cookieKey(),
      bytes.subarray(0, 12),
    )
    decipher.setAAD(Buffer.from(purpose))
    decipher.setAuthTag(bytes.subarray(12, 28))
    const payload = JSON.parse(
      inflateRawSync(
        Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]),
        { maxOutputLength: 64 * 1024 },
      ).toString('utf8'),
    )
    return payload.expires > Date.now() ? (payload.value as T) : null
  } catch {
    return null
  }
}

function normalizeIssuer(value: string): string {
  const url = new URL(value)
  url.hash = ''
  url.search = ''
  url.pathname = url.pathname.replace(/\/+$/u, '') || '/'
  return url.toString().replace(/\/$/u, '')
}

function hasSafeLocalPathPrefix(value: string): boolean {
  const queryIndex = value.indexOf('?')
  const hashIndex = value.indexOf('#')
  const pathEnd = Math.min(
    queryIndex === -1 ? value.length : queryIndex,
    hashIndex === -1 ? value.length : hashIndex,
  )
  let path = value.slice(0, pathEnd)

  for (let depth = 0; depth < 4; depth += 1) {
    if (
      !path.startsWith('/') ||
      path.startsWith('//') ||
      path.includes('\\') ||
      // eslint-disable-next-line no-control-regex
      /[\u0000-\u001f\u007f]/u.test(path)
    ) {
      return false
    }

    try {
      const decoded = decodeURIComponent(path)

      if (decoded === path) {
        return true
      }

      path = decoded
    } catch {
      return false
    }
  }

  return false
}
