/**
 * A fake OIDC issuer for tests: a real P-256 key pair, a discovery document,
 * a JWKS, a token endpoint that checks PKCE and returns an ID token signed
 * with the private key, and a userinfo endpoint. Install it with
 * `vi.stubGlobal('fetch', issuer.fetch)` and the SIWC handlers run the full
 * protocol against it, including signature verification, with nothing in
 * `@cubid/auth` mocked.
 */
import {
  createHash,
  createSign,
  generateKeyPairSync,
  randomUUID,
} from 'node:crypto'

export type FakeIssuerOptions = {
  clientId: string
  issuer?: string
  subject?: string
  /** Extra ID token claims (an `email`, for example). */
  claims?: Record<string, unknown>
  /** Userinfo payload; `null` removes the userinfo endpoint. */
  userInfo?: Record<string, unknown> | null
}

export type FakeIssuerRequest = {
  body: string | null
  headers: Record<string, string>
  method: string
  url: string
}

/** The URL of a fetch input, whatever form it takes. */
export function requestUrl(input: string | URL | Request): string {
  if (typeof input === 'string') return input
  return input instanceof URL ? input.href : input.url
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

export function createFakeIssuer(options: FakeIssuerOptions) {
  const issuer = options.issuer ?? 'https://issuer.test'
  const subject = options.subject ?? 'pairwise-subject'
  const { privateKey, publicKey } = generateKeyPairSync('ec', {
    namedCurve: 'P-256',
  })
  const kid = randomUUID()
  const jwk = {
    ...(publicKey.export({ format: 'jwk' }) as Record<string, string>),
    alg: 'ES256',
    kid,
    use: 'sig',
  }
  const discovery = {
    authorization_endpoint: `${issuer}/authorize`,
    code_challenge_methods_supported: ['S256'],
    end_session_endpoint: `${issuer}/logout`,
    issuer,
    jwks_uri: `${issuer}/jwks`,
    response_types_supported: ['code'],
    scopes_supported: ['openid', 'profile', 'email'],
    subject_types_supported: ['pairwise'],
    token_endpoint: `${issuer}/token`,
    ...(options.userInfo === null
      ? {}
      : { userinfo_endpoint: `${issuer}/userinfo` }),
  }
  const userInfo = options.userInfo ?? { email: 'person@example.com', subject }

  /** What the next token exchange must present; set from the authorize URL. */
  const expected = {
    code: 'fake-code',
    codeChallenge: '',
    nonce: '',
  }
  const requests: Array<FakeIssuerRequest> = []
  const accessToken = `fake-access-${randomUUID()}`

  function signIdToken(claims: Record<string, unknown>): string {
    const now = Math.floor(Date.now() / 1000)
    const header = base64url(JSON.stringify({ alg: 'ES256', kid, typ: 'JWT' }))
    const payload = base64url(
      JSON.stringify({
        acr: 'urn:cubid:acr:passkey',
        amr: ['webauthn'],
        aud: options.clientId,
        auth_time: now,
        exp: now + 600,
        iat: now,
        iss: issuer,
        sub: subject,
        ...options.claims,
        ...claims,
      }),
    )
    const signature = createSign('SHA256')
      .update(`${header}.${payload}`)
      .sign({ dsaEncoding: 'ieee-p1363', key: privateKey })
    return `${header}.${payload}.${base64url(signature)}`
  }

  function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      headers: { 'content-type': 'application/json' },
      status,
    })
  }

  async function fetch(
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> {
    const url = requestUrl(input)
    const method = init?.method ?? 'GET'
    const headers = Object.fromEntries(new Headers(init?.headers).entries())
    const body = typeof init?.body === 'string' ? init.body : null
    requests.push({ body, headers, method, url })

    if (url === `${issuer}/.well-known/openid-configuration`) {
      return json(discovery)
    }
    if (url === discovery.jwks_uri) {
      return json({ keys: [jwk] })
    }
    if (url === discovery.token_endpoint) {
      const form = new URLSearchParams(body ?? '')
      const verifier = form.get('code_verifier') ?? ''
      const challenge = base64url(
        createHash('sha256').update(verifier).digest(),
      )
      if (
        form.get('grant_type') !== 'authorization_code' ||
        form.get('code') !== expected.code ||
        form.get('client_id') !== options.clientId ||
        challenge !== expected.codeChallenge
      ) {
        return json(
          {
            error: 'invalid_grant',
            error_description: 'PKCE or code mismatch.',
          },
          400,
        )
      }
      return json({
        access_token: accessToken,
        expires_in: 600,
        id_token: signIdToken({ nonce: expected.nonce }),
        scope: 'openid profile email',
        token_type: 'Bearer',
      })
    }
    if (url === `${issuer}/userinfo`) {
      if (headers.authorization !== `Bearer ${accessToken}`) {
        return json({ error: 'invalid_token' }, 401)
      }
      return json({ sub: subject, ...userInfo })
    }
    return json({ error: 'not_found', url }, 404)
  }

  return {
    accessToken,
    discovery,
    expected,
    fetch,
    issuer,
    jwk,
    requests,
    signIdToken,
    subject,
    /** Reads the PKCE challenge and nonce the start route put in the authorize URL. */
    expectAuthorization(authorizationUrl: string | URL) {
      const url = new URL(authorizationUrl)
      expected.codeChallenge = url.searchParams.get('code_challenge') ?? ''
      expected.nonce = url.searchParams.get('nonce') ?? ''
      return {
        nonce: expected.nonce,
        state: url.searchParams.get('state') ?? '',
      }
    },
  }
}
