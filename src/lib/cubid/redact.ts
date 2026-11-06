/**
 * Redaction shared by the server (session and trace cookies, the session
 * summary) and the browser (demo output). No Node imports here, so the
 * browser bundle can use it too.
 *
 * Keys in `sensitiveKeys` are replaced by `[redacted]` wherever they occur,
 * at any depth. Protocol facts (issuer, audience, expiry, the app-scoped
 * pairwise subject) stay visible.
 */
export const redactedValue = '[redacted]'

export const sensitiveKeys: ReadonlySet<string> = new Set([
  'access_token',
  'accessToken',
  'address',
  'birthdate',
  'code',
  'code_verifier',
  'codeVerifier',
  'cookie',
  'cookies',
  'email',
  'family_name',
  'given_name',
  'id_token',
  'idToken',
  'name',
  'nonce',
  'phone_number',
  'picture',
  'preferred_username',
  'refresh_token',
  'refreshToken',
  'state',
])

export function redactValue(value: unknown, key?: string): unknown {
  if (key && sensitiveKeys.has(key)) {
    return value === null || typeof value === 'undefined'
      ? value
      : redactedValue
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item))
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        redactValue(entryValue, entryKey),
      ]),
    )
  }

  return value
}

/** Describes a token without revealing any part of it. */
export function describeToken(token: string | null | undefined): string {
  if (!token) return 'absent'
  return `present (${token.length} chars, not shown)`
}
