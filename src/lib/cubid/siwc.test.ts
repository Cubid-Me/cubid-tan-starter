import { afterEach, describe, expect, it, vi } from 'vitest'

import { responseCookie } from '#/lib/http/cookies'
import {
  assertSiwcDiscoveryIssuer,
  buildSessionSummary,
  maxCookieValueBytes,
  maxSessionAppBytes,
  normalizeReturnTo,
  readSessionCookie,
  readTransactionCookie,
  redactSiwcValue,
  resolveLocalReturnTo,
  sanitizeSiwcSession,
  setSessionCookie,
  siwcCookieNames,
  siwcCookies,
  traceEntry,
} from './siwc'
import type { SiwcSession } from './siwc'

const baseSession: SiwcSession = {
  authenticatedAt: '2026-07-20T00:00:00.000Z',
  claims: null,
  clientId: 'starter',
  expiresAt: 1_900_000_000_000,
  issuer: 'https://id.cubid.me',
  scope: ['openid'],
  subject: 'pairwise-subject',
  userInfo: null,
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('SIWC cookie names', () => {
  it('derives every cookie name from the default prefix', () => {
    expect(siwcCookieNames()).toEqual({
      returnTo: 'cubid_siwc_return_to',
      session: 'cubid_siwc_session',
      trace: 'cubid_siwc_trace',
      transaction: 'cubid_siwc_txn',
    })
  })

  it('reads CUBID_SIWC_COOKIE_PREFIX at access time so apps on one host do not collide', () => {
    vi.stubEnv('CUBID_SIWC_COOKIE_PREFIX', 'vmm')
    expect(siwcCookies.session).toBe('vmm_session')
    expect(siwcCookies.transaction).toBe('vmm_txn')
    const response = new Response(null)
    setSessionCookie(
      response,
      new Request('http://localhost:3000'),
      baseSession,
    )
    expect(responseCookie(response, 'vmm_session')).toBeDefined()
    expect(responseCookie(response, 'cubid_siwc_session')).toBeUndefined()
  })

  it('rejects a prefix that is not a safe cookie-name fragment', () => {
    vi.stubEnv('CUBID_SIWC_COOKIE_PREFIX', 'My App')
    expect(() => siwcCookies.session).toThrowError(/CUBID_SIWC_COOKIE_PREFIX/u)
  })
})

describe('SIWC session extras', () => {
  it('stores small plain-object extras and exposes them in the summary', () => {
    const response = new Response(null)
    setSessionCookie(response, new Request('http://localhost:3000'), {
      ...baseSession,
      app: { accountId: 'acct_1', role: 'member' },
    })
    const value = responseCookie(response, siwcCookies.session)!
    const session = readSessionCookie(
      new Request('http://localhost:3000', {
        headers: { cookie: `${siwcCookies.session}=${value}` },
      }),
    )
    expect(session?.app).toEqual({ accountId: 'acct_1', role: 'member' })
    expect(buildSessionSummary(session).session?.app).toEqual({
      accountId: 'acct_1',
      role: 'member',
    })
  })

  it('redacts sensitive keys inside extras before they reach the cookie', () => {
    const response = new Response(null)
    setSessionCookie(response, new Request('http://localhost:3000'), {
      ...baseSession,
      app: { accountId: 'acct_1', email: 'person@example.com' },
    })
    const value = responseCookie(response, siwcCookies.session)!
    const session = readSessionCookie(
      new Request('http://localhost:3000', {
        headers: { cookie: `${siwcCookies.session}=${value}` },
      }),
    )
    expect(session?.app).toEqual({ accountId: 'acct_1', email: '[redacted]' })
  })

  it.each([
    ['an array', ['acct_1']],
    ['a string', 'acct_1'],
    ['null', null],
    ['a class instance', new Date(0)],
  ])('rejects %s as extras', (_label, app) => {
    expect(() =>
      setSessionCookie(
        new Response(null),
        new Request('http://localhost:3000'),
        {
          ...baseSession,
          app: app as never,
        },
      ),
    ).toThrowError(/plain object/u)
  })

  it('rejects extras over the byte limit and never sets a cookie', () => {
    const response = new Response(null)
    expect(() =>
      setSessionCookie(response, new Request('http://localhost:3000'), {
        ...baseSession,
        app: { profile: 'x'.repeat(maxSessionAppBytes) },
      }),
    ).toThrowError(/app_extras_too_large|keep it under/u)
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('bounds the whole session cookie, not only the extras', () => {
    const response = new Response(null)
    // Incompressible claims push the encrypted cookie past the limit even
    // though the extras alone are small.
    const claims = Object.fromEntries(
      Array.from({ length: 60 }, (_, index) => [
        `claim_${index}`,
        Buffer.from(
          Array.from({ length: 48 }, () => Math.floor(Math.random() * 256)),
        ).toString('base64url'),
      ]),
    )
    expect(() =>
      setSessionCookie(response, new Request('http://localhost:3000'), {
        ...baseSession,
        app: { accountId: 'acct_1' },
        claims: claims,
      }),
    ).toThrowError(new RegExp(String(maxCookieValueBytes), 'u'))
    expect(response.headers.get('set-cookie')).toBeNull()
  })
})

describe('SIWC safety helpers', () => {
  it('authenticates cookie contents and prevents cookie purpose substitution', () => {
    const response = new Response(null)
    setSessionCookie(response, new Request('http://localhost:3000'), {
      authenticatedAt: new Date().toISOString(),
      claims: null,
      clientId: 'starter',
      expiresAt: Date.now() + 60000,
      issuer: 'https://id.cubid.me',
      scope: ['openid'],
      subject: 'pairwise-subject',
      userInfo: null,
    })
    const value = responseCookie(response, 'cubid_siwc_session')!
    const requestWith = (cookie: string) =>
      new Request('http://localhost:3000', { headers: { cookie } })
    expect(
      readSessionCookie(requestWith(`cubid_siwc_session=${value}`))?.subject,
    ).toBe('pairwise-subject')
    const changed = `${value.slice(0, 30)}${value[30] === 'a' ? 'b' : 'a'}${value.slice(31)}`
    expect(
      readSessionCookie(requestWith(`cubid_siwc_session=${changed}`)),
    ).toBeNull()
    expect(
      readSessionCookie(
        requestWith(
          `cubid_siwc_session=${Buffer.from(JSON.stringify({ authenticated: true })).toString('base64url')}`,
        ),
      ),
    ).toBeNull()
    expect(value).not.toContain('pairwise-subject')
    expect(
      readTransactionCookie(requestWith(`cubid_siwc_txn=${value}`)),
    ).toBeNull()
  })

  it('does not report expired token sessions as signed in', () => {
    expect(
      buildSessionSummary({
        authenticatedAt: new Date().toISOString(),
        claims: null,
        clientId: 'starter',
        expiresAt: Date.now() - 1,
        issuer: 'https://id.cubid.me',
        scope: ['openid'],
        subject: 'expired',
        userInfo: null,
      }).authenticated,
    ).toBe(false)
  })

  it('accepts the configured discovery issuer and rejects a mismatch', () => {
    expect(() =>
      assertSiwcDiscoveryIssuer('https://id.cubid.me', 'https://id.cubid.me/'),
    ).not.toThrow()
    expect(() =>
      assertSiwcDiscoveryIssuer(
        'https://id.cubid.me',
        'https://staging-id.cubid.me',
      ),
    ).toThrowError(/did not match/u)
  })

  it('keeps return paths local to the starter', () => {
    expect(normalizeReturnTo('/docs?tab=siwc')).toBe('/docs?tab=siwc')
    expect(normalizeReturnTo('https://attacker.example/path')).toBe('/')
    expect(normalizeReturnTo('//attacker.example/path')).toBe('/')
  })

  it.each([
    '/\\evil.example/proof',
    '/\\\\evil.example/proof',
    '/%5Cevil.example/proof',
    '/%5C%5Cevil.example/proof',
    '/%255Cevil.example/proof',
    '/%2F%2Fevil.example/proof',
  ])('rejects authority-like encoded and decoded return path %s', (value) => {
    expect(normalizeReturnTo(value)).toBe('/')
    expect(resolveLocalReturnTo(value, 'http://localhost:3000').origin).toBe(
      'http://localhost:3000',
    )
  })

  it('preserves a safe local path, query, and fragment', () => {
    const resolved = resolveLocalReturnTo(
      '/docs/siwc?tab=callback&next=%2Faccount#trace',
      'http://localhost:3000',
    )

    expect(resolved.href).toBe(
      'http://localhost:3000/docs/siwc?tab=callback&next=%2Faccount#trace',
    )
  })

  it('redacts secrets and PII recursively without hiding protocol facts', () => {
    const safe = redactSiwcValue({
      accessToken: 'access-secret',
      claims: {
        email: 'person@example.com',
        nonce: 'nonce-secret',
        sub: 'pairwise-subject',
      },
      codePresent: true,
      nested: [{ refresh_token: 'refresh-secret' }],
    })

    expect(safe).toEqual({
      accessToken: '[redacted]',
      claims: {
        email: '[redacted]',
        nonce: '[redacted]',
        sub: 'pairwise-subject',
      },
      codePresent: true,
      nested: [{ refresh_token: '[redacted]' }],
    })
    expect(JSON.stringify(safe)).not.toContain('secret')
    expect(JSON.stringify(safe)).not.toContain('person@example.com')
  })

  it('redacts trace entries and browser session summaries', () => {
    const trace = traceEntry('token', 'Token exchange', {
      request: { code: 'raw-code', codeVerifier: 'raw-verifier' },
      response: { accessToken: 'raw-token', tokenType: 'Bearer' },
    })
    const summary = buildSessionSummary(
      {
        authenticatedAt: '2026-07-20T00:00:00.000Z',
        claims: {
          email: 'person@example.com',
          nonce: 'raw-nonce',
          sub: 'pairwise-subject',
        },
        clientId: 'starter',
        expiresAt: 1_900_000_000_000,
        issuer: 'https://id.cubid.me',
        scope: ['openid', 'email'],
        subject: 'pairwise-subject',
        userInfo: {
          email: 'person@example.com',
          sub: 'pairwise-subject',
        },
      },
      [trace],
    )
    const serialized = JSON.stringify(summary)

    expect(serialized).not.toContain('raw-code')
    expect(serialized).not.toContain('raw-verifier')
    expect(serialized).not.toContain('raw-token')
    expect(serialized).not.toContain('raw-nonce')
    expect(serialized).not.toContain('person@example.com')
    expect(serialized).toContain('pairwise-subject')
  })

  it('redacts PII and nonce before serializing the session cookie', () => {
    const safe = sanitizeSiwcSession({
      authenticatedAt: '2026-07-20T00:00:00.000Z',
      claims: {
        email: 'person@example.com',
        name: 'Private Person',
        nonce: 'private-nonce',
        sub: 'pairwise-subject',
      },
      clientId: 'starter',
      expiresAt: 1_800_000_000,
      issuer: 'https://id.cubid.me',
      scope: ['openid', 'profile', 'email'],
      subject: 'pairwise-subject',
      userInfo: {
        email: 'person@example.com',
        name: 'Private Person',
        sub: 'pairwise-subject',
      },
    })
    const recoverableCookiePayload = Buffer.from(
      Buffer.from(JSON.stringify(safe)).toString('base64url'),
      'base64url',
    ).toString('utf8')

    expect(recoverableCookiePayload).not.toContain('person@example.com')
    expect(recoverableCookiePayload).not.toContain('Private Person')
    expect(recoverableCookiePayload).not.toContain('private-nonce')
    expect(recoverableCookiePayload).toContain('pairwise-subject')
    expect(safe.claims?.email).toBe('[redacted]')
    expect(safe.userInfo?.email).toBe('[redacted]')
  })
})
