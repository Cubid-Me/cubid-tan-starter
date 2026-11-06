/**
 * The whole server-mediated flow against a fake issuer with real signed
 * tokens: nothing in `@cubid/auth` is mocked, only `fetch`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createFakeIssuer, requestUrl } from '#/test/fake-issuer'
import { maxSessionAppBytes, siwcCookies } from '#/lib/cubid/siwc'
import { cookieHeaderFromResponse, responseCookie } from '#/lib/http/cookies'
import type { SiwcHooks } from './siwc-handlers'
import { siwcCallback, siwcSession, siwcStart } from './siwc-handlers'

const clientId = 'starter-client'
const origin = 'http://localhost:3000'

type Issuer = ReturnType<typeof createFakeIssuer>

beforeEach(() => {
  vi.stubEnv('CUBID_SIWC_ISSUER_URL', 'https://issuer.test')
  vi.stubEnv('CUBID_SIWC_CLIENT_ID', clientId)
  vi.stubEnv('CUBID_SIWC_REDIRECT_URI', `${origin}/api/cubid/siwc/callback`)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

/** Runs start and callback and returns the callback response. */
async function signIn(issuer: Issuer, hooks?: SiwcHooks) {
  vi.stubGlobal('fetch', issuer.fetch)
  const started = await siwcStart(
    new Request(`${origin}/api/cubid/siwc/start?format=json&return_to=/home`),
  )
  expect(started.status).toBe(200)
  const { authorizationUrl } = (await started.json()) as {
    authorizationUrl: string
  }
  const { state } = issuer.expectAuthorization(authorizationUrl)
  const completed = await siwcCallback(
    new Request(
      `${origin}/api/cubid/siwc/callback?code=${issuer.expected.code}&state=${state}&iss=${encodeURIComponent(issuer.issuer)}`,
      { headers: { cookie: cookieHeaderFromResponse(started) } },
    ),
    hooks,
  )
  const summary = await siwcSession(
    new Request(`${origin}/api/cubid/siwc/session`, {
      headers: { cookie: cookieHeaderFromResponse(completed) },
    }),
  ).json()
  return { completed, started, summary }
}

describe('SIWC flow against a fake issuer with signed tokens', () => {
  it('signs in with PKCE, verifies the ID token signature and keeps tokens out of the browser', async () => {
    const issuer = createFakeIssuer({
      claims: { email: 'person@example.com' },
      clientId,
    })
    const { completed, summary } = await signIn(issuer)

    expect(completed.status).toBe(307)
    expect(completed.headers.get('location')).toBe(`${origin}/home`)
    expect(summary.authenticated).toBe(true)
    expect(summary.session.subject).toBe(issuer.subject)
    expect(summary.session.issuer).toBe(issuer.issuer)
    expect(summary.session.claims.email).toBe('[redacted]')
    expect(summary.session.userInfo.email).toBe('[redacted]')

    const steps = summary.trace.map((entry: { step: string }) => entry.step)
    expect(steps).toEqual(
      expect.arrayContaining([
        'discovery',
        'authorization',
        'callback',
        'token',
        'id_token',
        'userinfo',
        'session',
      ]),
    )
    const idTokenStep = summary.trace.find(
      (entry: { step: string }) => entry.step === 'id_token',
    )
    expect(idTokenStep.response.signatureVerified).toBe(true)
    expect(idTokenStep.response.nonceMatched).toBe(true)

    const everythingVisible = JSON.stringify({
      headers: [...completed.headers],
      summary,
    })
    expect(everythingVisible).not.toContain(issuer.accessToken)
    expect(everythingVisible).not.toContain('person@example.com')
    // No compact JWT anywhere: a random cookie value can contain "eyJ" by
    // chance, so look for three base64url segments whose first decodes to
    // a JSON object (a JOSE header).
    const joseLike = everythingVisible.match(
      /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/gu,
    )
    for (const candidate of joseLike ?? []) {
      const header = Buffer.from(candidate.split('.')[0]!, 'base64url')
      expect(header.toString('utf8').startsWith('{')).toBe(false)
    }

    const calls = issuer.requests.map(
      (request) => `${request.method} ${request.url}`,
    )
    expect(calls).toContain(`POST ${issuer.discovery.token_endpoint}`)
    expect(calls).toContain(`GET ${issuer.discovery.jwks_uri}`)
    expect(calls).toContain(`GET ${issuer.issuer}/userinfo`)
    const tokenRequest = issuer.requests.find(
      (request) => request.url === issuer.discovery.token_endpoint,
    )!
    expect(tokenRequest.headers['content-type']).toContain(
      'application/x-www-form-urlencoded',
    )
    expect(new URLSearchParams(tokenRequest.body!).get('redirect_uri')).toBe(
      `${origin}/api/cubid/siwc/callback`,
    )
  })

  it('rejects an ID token signed by a different key', async () => {
    const issuer = createFakeIssuer({ clientId })
    const impostor = createFakeIssuer({ clientId })
    // The impostor's token carries the real issuer's name but not its key.
    const originalSign = issuer.signIdToken
    issuer.signIdToken = (claims) =>
      impostor.signIdToken({ ...claims, iss: issuer.issuer })
    vi.stubGlobal(
      'fetch',
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = requestUrl(input)
        if (url === issuer.discovery.token_endpoint) {
          const response = await issuer.fetch(input, init)
          const payload = (await response.json()) as Record<string, unknown>
          if (typeof payload.id_token === 'string') {
            payload.id_token = issuer.signIdToken({
              nonce: issuer.expected.nonce,
            })
          }
          return new Response(JSON.stringify(payload), {
            headers: { 'content-type': 'application/json' },
            status: response.status,
          })
        }
        return issuer.fetch(input, init)
      },
    )
    const started = await siwcStart(
      new Request(`${origin}/api/cubid/siwc/start?format=json`),
    )
    const { state } = issuer.expectAuthorization(
      ((await started.json()) as { authorizationUrl: string }).authorizationUrl,
    )
    const completed = await siwcCallback(
      new Request(
        `${origin}/api/cubid/siwc/callback?code=fake-code&state=${state}`,
        { headers: { cookie: cookieHeaderFromResponse(started) } },
      ),
    )
    issuer.signIdToken = originalSign

    const location = new URL(completed.headers.get('location')!)
    expect(location.searchParams.get('siwc_error')).toBeTruthy()
    expect(location.searchParams.get('siwc_error')).not.toBe('callback_failed')
    expect(responseCookie(completed, siwcCookies.session)).toBeUndefined()
    const summary = await siwcSession(
      new Request(`${origin}/api/cubid/siwc/session`, {
        headers: { cookie: cookieHeaderFromResponse(completed) },
      }),
    ).json()
    expect(summary.authenticated).toBe(false)
    const errorStep = summary.trace.find(
      (entry: { step: string }) => entry.step === 'error',
    )
    expect(errorStep.response.error).toBe(
      location.searchParams.get('siwc_error'),
    )
    expect(errorStep.response.details.errorName).toBe('CubidAuthError')
  })

  it('rejects a code the issuer does not recognise and keeps the redacted token response in the trace', async () => {
    const issuer = createFakeIssuer({ clientId })
    vi.stubGlobal('fetch', issuer.fetch)
    const started = await siwcStart(
      new Request(`${origin}/api/cubid/siwc/start?format=json`),
    )
    const { state } = issuer.expectAuthorization(
      ((await started.json()) as { authorizationUrl: string }).authorizationUrl,
    )
    const completed = await siwcCallback(
      new Request(
        `${origin}/api/cubid/siwc/callback?code=wrong-code&state=${state}`,
        { headers: { cookie: cookieHeaderFromResponse(started) } },
      ),
    )
    const location = new URL(completed.headers.get('location')!)
    expect(location.searchParams.get('siwc_error')).toBe('invalid_grant')
    const summary = await siwcSession(
      new Request(`${origin}/api/cubid/siwc/session`, {
        headers: { cookie: cookieHeaderFromResponse(completed) },
      }),
    ).json()
    const errorStep = summary.trace.find(
      (entry: { step: string }) => entry.step === 'error',
    )
    expect(errorStep.response.details).toMatchObject({
      errorCode: 'invalid_grant',
      status: 400,
    })
    expect(JSON.stringify(summary)).not.toContain('wrong-code')
  })
})

describe('onAuthenticated hook', () => {
  it('stores the extras the hook returns and shows them to the browser', async () => {
    const issuer = createFakeIssuer({
      claims: { email: 'person@example.com' },
      clientId,
    })
    const onAuthenticated = vi.fn(async (input: { subject: string }) => ({
      accountId: `acct_${input.subject}`,
      role: 'member',
    }))
    const { summary } = await signIn(issuer, { onAuthenticated })

    expect(onAuthenticated).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: issuer.subject,
        claims: expect.objectContaining({ email: 'person@example.com' }),
      }),
    )
    expect(summary.authenticated).toBe(true)
    expect(summary.session.app).toEqual({
      accountId: `acct_${issuer.subject}`,
      role: 'member',
    })
  })

  it('fails the sign-in without a session when the extras are too large', async () => {
    const issuer = createFakeIssuer({ clientId })
    const { completed, summary } = await signIn(issuer, {
      onAuthenticated: async () => ({
        profile: 'x'.repeat(maxSessionAppBytes),
      }),
    })
    const location = new URL(completed.headers.get('location')!)
    expect(location.searchParams.get('siwc_error')).toBe('app_extras_too_large')
    expect(responseCookie(completed, siwcCookies.session)).toBeUndefined()
    expect(summary.authenticated).toBe(false)
  })

  it('fails the sign-in when the hook returns something other than a plain object', async () => {
    const issuer = createFakeIssuer({ clientId })
    const { completed } = await signIn(issuer, {
      onAuthenticated: async () => ['acct_1'] as never,
    })
    const location = new URL(completed.headers.get('location')!)
    expect(location.searchParams.get('siwc_error')).toBe('invalid_app_extras')
    expect(responseCookie(completed, siwcCookies.session)).toBeUndefined()
  })

  it('fails the sign-in when the hook throws, without leaking the error text to the URL', async () => {
    const issuer = createFakeIssuer({ clientId })
    const { completed, summary } = await signIn(issuer, {
      onAuthenticated: async () => {
        throw new Error('database down: password=hunter2')
      },
    })
    const location = new URL(completed.headers.get('location')!)
    expect(location.searchParams.get('siwc_error')).toBe('callback_failed')
    expect(location.href).not.toContain('hunter2')
    expect(responseCookie(completed, siwcCookies.session)).toBeUndefined()
    expect(summary.authenticated).toBe(false)
  })
})
