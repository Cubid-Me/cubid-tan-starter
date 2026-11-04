import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as cubidAuth from '@cubid/auth'

import { setTransactionCookie } from '#/lib/cubid/siwc'
import { cookieHeaderFromResponse, responseCookie } from '#/lib/http/cookies'
import {
  siwcCallback as callback,
  siwcLogout as logout,
  siwcSession as session,
  siwcStart as start,
} from './siwc-handlers'

vi.mock('@cubid/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof cubidAuth>()),
}))

function transactionValue(state = 'expected-state', nonce = 'expected-nonce') {
  const response = new Response(null)
  setTransactionCookie(response, new Request('http://localhost:3000'), {
    codeVerifier: 'private-verifier',
    issuer: 'https://id.cubid.me',
    nonce,
    redirectUri: 'http://localhost:3000/api/cubid/siwc/callback',
    state,
  })
  return responseCookie(response, 'cubid_siwc_txn')!
}

const originalEnv = { ...process.env }

beforeEach(() => {
  process.env.CUBID_SIWC_ISSUER_URL = 'https://id.cubid.me'
  process.env.CUBID_SIWC_CLIENT_ID = 'starter-client'
  process.env.CUBID_SIWC_REDIRECT_URI =
    'http://localhost:3000/api/cubid/siwc/callback'
})

afterEach(() => {
  process.env = { ...originalEnv }
  vi.restoreAllMocks()
})

describe('SIWC route guards', () => {
  it('fails safely in production without a cookie key and still permits reset', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    delete process.env.CUBID_SIWC_COOKIE_SECRET
    try {
      const response = await start(
        new Request('http://localhost:3000/api/cubid/siwc/start'),
      )
      expect(response.status).toBe(500)
      expect((await response.json()).missing).toContain(
        'CUBID_SIWC_COOKIE_SECRET (at least 32 random characters)',
      )
      const failed = await callback(
        new Request('http://localhost:3000/api/cubid/siwc/callback'),
      )
      expect(failed.headers.get('location')).toContain(
        'siwc_error=missing_config',
      )
      expect(
        logout(
          new Request('http://localhost:3000/api/cubid/siwc/logout', {
            method: 'POST',
          }),
        ).status,
      ).toBe(200)
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('rejects forged session and transaction cookies', async () => {
    const forged = Buffer.from(
      JSON.stringify({ subject: 'forged', expiresAt: Date.now() + 60000 }),
    ).toString('base64url')
    const result = session(
      new Request('http://localhost:3000/api/cubid/siwc/session', {
        headers: { cookie: `cubid_siwc_demo_session=${forged}` },
      }),
    )
    expect((await result.json()).authenticated).toBe(false)
    const response = await callback(
      new Request(
        'http://localhost:3000/api/cubid/siwc/callback?code=x&state=y',
        { headers: { cookie: `cubid_siwc_txn=${forged}` } },
      ),
    )
    expect(response.headers.get('location')).toContain('missing_transaction')
  })

  it('completes start, callback and session with a redacted protocol trace', async () => {
    vi.spyOn(cubidAuth, 'fetchCubidOidcDiscoveryDocument').mockResolvedValue({
      authorization_endpoint: 'https://id.cubid.me/authorize',
      issuer: 'https://id.cubid.me',
      jwks_uri: 'https://id.cubid.me/jwks',
      token_endpoint: 'https://id.cubid.me/token',
    })
    vi.spyOn(cubidAuth, 'exchangeCubidAuthorizationCode').mockImplementation(
      async () => ({
        accessToken: 'private-access',
        idToken: 'private-id',
        refreshToken: null,
        expiresAt: Date.now() + 600000,
        expiresIn: 600,
        issuedAt: Date.now(),
        raw: {},
        scope: ['openid'],
        tokenType: 'Bearer',
      }),
    )
    const started = await start(
      new Request('http://localhost:3000/api/cubid/siwc/start?format=json'),
    )
    const authorize = new URL((await started.json()).authorizationUrl)
    vi.spyOn(cubidAuth, 'validateCubidIdToken').mockResolvedValue({
      iss: 'https://id.cubid.me',
      aud: 'starter-client',
      sub: 'pairwise-subject',
      nonce: authorize.searchParams.get('nonce')!,
      exp: Math.floor(Date.now() / 1000) + 600,
    })
    const completed = await callback(
      new Request(
        `http://localhost:3000/api/cubid/siwc/callback?code=private-code&state=${authorize.searchParams.get('state')}`,
        { headers: { cookie: cookieHeaderFromResponse(started) } },
      ),
    )
    expect(completed.headers.get('location')).toBe('http://localhost:3000/')
    const result = session(
      new Request('http://localhost:3000/api/cubid/siwc/session', {
        headers: { cookie: cookieHeaderFromResponse(completed) },
      }),
    )
    const payload = await result.json()
    expect(payload.authenticated).toBe(true)
    expect(payload.session.subject).toBe('pairwise-subject')
    expect(
      payload.trace.map((entry: { step: string }) => entry.step),
    ).toContain('authorization')
    expect(
      payload.trace.map((entry: { step: string }) => entry.step),
    ).toContain('token')
    expect(JSON.stringify(payload)).not.toContain('private-')
    expect(responseCookie(completed, 'cubid_siwc_trace')!.length).toBeLessThan(
      3501,
    )
    expect(result.headers.get('cache-control')).toBe('no-store')
  })

  it('fails safely when required start configuration is missing', async () => {
    delete process.env.CUBID_SIWC_CLIENT_ID
    delete process.env.VITE_CUBID_OIDC_CLIENT_ID

    const response = await start(
      new Request('http://localhost:3000/api/cubid/siwc/start'),
    )

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toMatchObject({
      error: 'missing_config',
    })
  })

  it.each([
    '/\\evil.example/proof',
    '/\\\\evil.example/proof',
    '/%5Cevil.example/proof',
    '/%5C%5Cevil.example/proof',
    '/%255Cevil.example/proof',
    '//evil.example/proof',
    '/%2F%2Fevil.example/proof',
  ])(
    'keeps an unsafe callback return cookie same-origin: %s',
    async (returnTo) => {
      delete process.env.CUBID_SIWC_CLIENT_ID
      delete process.env.VITE_CUBID_OIDC_CLIENT_ID
      const request = new Request(
        'http://localhost:3000/api/cubid/siwc/callback?code=x&state=y',
        {
          headers: {
            cookie: `cubid_siwc_return_to=${returnTo}`,
          },
        },
      )

      const response = await callback(request)
      const location = new URL(response.headers.get('location')!)

      expect(location.origin).toBe('http://localhost:3000')
      expect(location.pathname).toBe('/')
      expect(location.searchParams.get('siwc_error')).toBe('missing_config')
    },
  )

  it('preserves a safe callback return path and query', async () => {
    delete process.env.CUBID_SIWC_CLIENT_ID
    delete process.env.VITE_CUBID_OIDC_CLIENT_ID
    const request = new Request(
      'http://localhost:3000/api/cubid/siwc/callback?code=x&state=y',
      {
        headers: {
          cookie: 'cubid_siwc_return_to=/docs/siwc?tab=callback',
        },
      },
    )

    const response = await callback(request)
    const location = new URL(response.headers.get('location')!)

    expect(location.origin).toBe('http://localhost:3000')
    expect(location.pathname).toBe('/docs/siwc')
    expect(location.searchParams.get('tab')).toBe('callback')
    expect(location.searchParams.get('siwc_error')).toBe('missing_config')
  })

  it('rejects a callback with mismatched state before token exchange', async () => {
    const transaction = transactionValue('expected-state', 'private-nonce')
    const request = new Request(
      'http://localhost:3000/api/cubid/siwc/callback?code=private-code&state=wrong-state',
      {
        headers: {
          cookie: `cubid_siwc_txn=${transaction}`,
        },
      },
    )

    const response = await callback(request)
    const location = new URL(response.headers.get('location')!)
    const serializedHeaders = JSON.stringify([...response.headers])

    expect(location.searchParams.get('siwc_error')).toBe('state_mismatch')
    expect(serializedHeaders).not.toContain('private-code')
    expect(serializedHeaders).not.toContain('private-verifier')
    expect(serializedHeaders).not.toContain('private-nonce')
    expect(serializedHeaders).not.toContain('expected-state')
    expect(response.headers.get('set-cookie')).toContain('cubid_siwc_txn=')
    expect(response.headers.get('set-cookie')).toContain(
      'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    )
  })

  it('rejects a callback whose validated ID token nonce does not match', async () => {
    vi.spyOn(cubidAuth, 'fetchCubidOidcDiscoveryDocument').mockResolvedValue({
      authorization_endpoint: 'https://id.cubid.me/authorize',
      issuer: 'https://id.cubid.me',
      jwks_uri: 'https://id.cubid.me/.well-known/jwks.json',
      token_endpoint: 'https://id.cubid.me/token',
    })
    vi.spyOn(cubidAuth, 'exchangeCubidAuthorizationCode').mockResolvedValue({
      accessToken: 'private-access-token',
      expiresAt: 1_800_000_000,
      expiresIn: 600,
      idToken: 'private-id-token',
      issuedAt: 1_799_999_400,
      raw: {},
      refreshToken: null,
      scope: ['openid'],
      tokenType: 'Bearer',
    })
    vi.spyOn(cubidAuth, 'validateCubidIdToken').mockResolvedValue({
      aud: 'starter-client',
      exp: 1_800_000_000,
      iss: 'https://id.cubid.me',
      nonce: 'wrong-nonce',
      sub: 'pairwise-subject',
    })
    const transaction = transactionValue()
    const request = new Request(
      'http://localhost:3000/api/cubid/siwc/callback?code=private-code&state=expected-state',
      {
        headers: {
          cookie: `cubid_siwc_txn=${transaction}`,
        },
      },
    )

    const response = await callback(request)
    const location = new URL(response.headers.get('location')!)
    const serializedHeaders = JSON.stringify([...response.headers])

    expect(location.searchParams.get('siwc_error')).toBe('nonce_mismatch')
    expect(serializedHeaders).not.toContain('private-access-token')
    expect(serializedHeaders).not.toContain('private-id-token')
    expect(serializedHeaders).not.toContain('private-verifier')
    expect(serializedHeaders).not.toContain('expected-nonce')
  })

  it('rejects an OAuth-only callback response without an ID token', async () => {
    vi.spyOn(cubidAuth, 'fetchCubidOidcDiscoveryDocument').mockResolvedValue({
      authorization_endpoint: 'https://id.cubid.me/authorize',
      issuer: 'https://id.cubid.me',
      jwks_uri: 'https://id.cubid.me/.well-known/jwks.json',
      token_endpoint: 'https://id.cubid.me/token',
    })
    vi.spyOn(cubidAuth, 'exchangeCubidAuthorizationCode').mockResolvedValue({
      accessToken: 'private-access-token',
      expiresAt: 1_800_000_000,
      expiresIn: 600,
      idToken: null,
      issuedAt: 1_799_999_400,
      raw: {},
      refreshToken: null,
      scope: ['profile'],
      tokenType: 'Bearer',
    })
    const validateIdToken = vi.spyOn(cubidAuth, 'validateCubidIdToken')
    const transaction = transactionValue()
    const request = new Request(
      'http://localhost:3000/api/cubid/siwc/callback?code=private-code&state=expected-state',
      {
        headers: {
          cookie: `cubid_siwc_txn=${transaction}`,
        },
      },
    )

    const response = await callback(request)
    const location = new URL(response.headers.get('location')!)

    expect(location.searchParams.get('siwc_error')).toBe('missing_id_token')
    expect(validateIdToken).not.toHaveBeenCalled()
  })
})
