/**
 * Server-mediated Sign in with Cubid (SIWC) handlers.
 *
 * Each handler takes a Web `Request` and returns a Web `Response`. The route
 * files under `src/routes/api/cubid/siwc/` only wire these into TanStack
 * Start, which keeps the protocol logic testable and framework-neutral.
 */
import type { CubidIdTokenClaims, CubidUserInfo } from '@cubid/auth'
import {
  assertCubidAuthorizationState,
  buildCubidAuthorizationUrl,
  createCubidAuthNonce,
  createCubidAuthSession,
  createCubidAuthState,
  createCubidPkcePair,
  exchangeCubidAuthorizationCode,
  fetchCubidOidcDiscoveryDocument,
  fetchCubidUserInfo,
  parseCubidAuthorizationCallback,
  validateCubidIdToken,
} from '@cubid/auth'

import {
  appendTrace,
  assertSiwcDiscoveryIssuer,
  buildErrorPayload,
  buildSessionSummary,
  clearSiwcSession,
  clearSiwcTransaction,
  getSiwcConfig,
  readReturnToCookie,
  readSessionCookie,
  readTraceCookie,
  readTransactionCookie,
  requestOrigin,
  resolveLocalReturnTo,
  setReturnToCookie,
  setSessionCookie,
  setTraceCookie,
  setTransactionCookie,
  siwcCallbackPath,
  traceEntry,
} from '#/lib/cubid/siwc'
import type { SiwcSession } from '#/lib/cubid/siwc'
import { json, noStoreJson, redirect } from '#/lib/http/responses'

/**
 * Optional application hooks. `onAuthenticated` runs after the ID token and
 * userinfo are verified and may return extras stored under `session.app`.
 * It receives the unredacted claims, so it can look up or create an
 * application account before anything is persisted in the cookie.
 *
 * The extras are browser-visible through `/api/cubid/siwc/session` and must
 * be a plain object under `maxSessionAppBytes` (1 KiB): ids and roles, never
 * tokens or profiles. A larger or malformed result fails the sign-in with
 * `siwc_error=app_extras_too_large` or `invalid_app_extras`; a hook that
 * throws fails it with `callback_failed`. No session cookie is set in
 * either case.
 */
export type SiwcHooks = {
  onAuthenticated?: (input: {
    claims: CubidIdTokenClaims
    subject: string
    userInfo: CubidUserInfo | null
  }) => Promise<Record<string, unknown> | undefined>
}

/** GET /api/cubid/siwc/start */
export async function siwcStart(request: Request): Promise<Response> {
  const config = getSiwcConfig(request)
  const url = new URL(request.url)

  if (!config.configured) {
    return json(
      {
        error: 'missing_config',
        missing: config.missing,
      },
      { status: 500 },
    )
  }

  try {
    const discovery = await fetchCubidOidcDiscoveryDocument({
      issuer: config.issuer,
    })
    assertSiwcDiscoveryIssuer(config.issuer, discovery.issuer)
    const pkce = await createCubidPkcePair()
    const state = createCubidAuthState()
    const nonce = createCubidAuthNonce()
    const prompt = url.searchParams.get('prompt') ?? undefined
    const maxAge = url.searchParams.has('max_age')
      ? Number(url.searchParams.get('max_age'))
      : undefined
    const authorizationUrl = buildCubidAuthorizationUrl({
      authorizationEndpoint: discovery.authorization_endpoint,
      clientId: config.clientId,
      codeChallenge: pkce.codeChallenge,
      codeChallengeMethod: pkce.codeChallengeMethod,
      maxAge: Number.isFinite(maxAge) ? maxAge : undefined,
      nonce,
      prompt,
      redirectUri: config.redirectUri,
      requirePasskey: true,
      scope: config.scope,
      state,
    })
    const response =
      url.searchParams.get('format') === 'json'
        ? noStoreJson({ authorizationUrl })
        : redirect(authorizationUrl)

    setTransactionCookie(response, request, {
      codeVerifier: pkce.codeVerifier,
      issuer: config.issuer,
      nonce,
      redirectUri: config.redirectUri,
      state,
    })
    setReturnToCookie(
      response,
      request,
      url.searchParams.get('return_to') ?? '/',
    )
    setTraceCookie(response, request, [
      traceEntry('discovery', 'Fetch issuer discovery metadata', {
        request: {
          issuer: config.issuer,
          method: 'GET',
          url: `${config.issuer.replace(/\/$/u, '')}/.well-known/openid-configuration`,
        },
        response: {
          authorizationEndpoint: discovery.authorization_endpoint,
          endSessionEndpoint: discovery.end_session_endpoint ?? null,
          issuer: discovery.issuer,
          tokenEndpoint: discovery.token_endpoint,
          userInfoEndpoint: discovery.userinfo_endpoint ?? null,
        },
      }),
      traceEntry('authorization', 'Redirect to Cubid authorization endpoint', {
        request: {
          method: 'GET',
          url: discovery.authorization_endpoint,
          acrValues: 'urn:cubid:acr:passkey',
          clientId: config.clientId,
          codeChallengeMethod: pkce.codeChallengeMethod,
          codeChallengePresent: true,
          maxAge: Number.isFinite(maxAge) ? maxAge : null,
          noncePresent: true,
          prompt: prompt ?? null,
          redirectUri: config.redirectUri,
          responseType: 'code',
          scope: config.scope,
          statePresent: true,
          parameters: Object.fromEntries(
            new URL(authorizationUrl).searchParams,
          ),
        },
        response: {
          redirectTo: discovery.authorization_endpoint,
          status: 307,
        },
      }),
    ])

    return response
  } catch (error) {
    return json(
      {
        error: 'siwc_start_failed',
        details: buildErrorPayload(error),
      },
      { status: 502 },
    )
  }
}

/** GET /api/cubid/siwc/callback */
export async function siwcCallback(
  request: Request,
  hooks: SiwcHooks = {},
): Promise<Response> {
  const config = getSiwcConfig(request)
  const returnTo = readReturnToCookie(request)

  if (!config.configured) {
    return redirectWithError(request, returnTo, 'missing_config')
  }

  try {
    const transaction = readTransactionCookie(request)

    if (!transaction) {
      return redirectWithError(request, returnTo, 'missing_transaction')
    }

    const callback = parseCubidAuthorizationCallback(new URL(request.url))
    assertCubidAuthorizationState(transaction.state, callback)
    if (callback.kind === 'error') {
      return redirectWithError(request, returnTo, callback.error)
    }
    if (callback.iss && callback.iss !== transaction.issuer) {
      return redirectWithError(request, returnTo, 'callback_issuer_mismatch')
    }

    const discovery = await fetchCubidOidcDiscoveryDocument({
      issuer: transaction.issuer,
    })
    assertSiwcDiscoveryIssuer(transaction.issuer, discovery.issuer)
    const tokenResponse = await exchangeCubidAuthorizationCode({
      clientId: config.clientId,
      code: callback.code,
      codeVerifier: transaction.codeVerifier,
      redirectUri: transaction.redirectUri,
      tokenEndpoint: discovery.token_endpoint,
    })

    if (!tokenResponse.idToken) {
      return redirectWithError(request, returnTo, 'missing_id_token')
    }

    const idTokenClaims = await validateCubidIdToken({
      clientId: config.clientId,
      discoveryDocument: discovery,
      idToken: tokenResponse.idToken,
    })

    if (idTokenClaims.nonce !== transaction.nonce) {
      return redirectWithError(request, returnTo, 'nonce_mismatch')
    }

    const userInfo =
      discovery.userinfo_endpoint && tokenResponse.accessToken
        ? await fetchCubidUserInfo({
            accessToken: tokenResponse.accessToken,
            userInfoEndpoint: discovery.userinfo_endpoint,
          })
        : null
    const authSession = createCubidAuthSession({
      clientId: config.clientId,
      idTokenClaims,
      issuer: discovery.issuer,
      tokenResponse,
      userInfo,
    })
    if (userInfo && userInfo.sub !== idTokenClaims.sub) {
      return redirectWithError(request, returnTo, 'userinfo_subject_mismatch')
    }
    let app: Record<string, unknown> | undefined
    if (hooks.onAuthenticated && typeof idTokenClaims.sub === 'string') {
      app = await hooks.onAuthenticated({
        claims: idTokenClaims,
        subject: idTokenClaims.sub,
        userInfo,
      })
    }
    const response = redirect(
      resolveLocalReturnTo(returnTo, requestOrigin(request)),
    )
    response.headers.set('Referrer-Policy', 'no-referrer')

    const session: SiwcSession = {
      app,
      authenticatedAt: new Date().toISOString(),
      claims: authSession.idTokenClaims,
      clientId: authSession.clientId,
      expiresAt: authSession.expiresAt,
      issuer: authSession.issuer,
      scope: authSession.scope,
      subject: authSession.subject,
      userInfo: authSession.userInfo,
    }
    setSessionCookie(response, request, session)
    appendTrace(request, response, [
      traceEntry('callback', 'Receive Cubid callback', {
        request: {
          method: 'GET',
          url: transaction.redirectUri,
          codePresent: true,
          issuer: callback.iss,
          sessionStatePresent: Boolean(callback.sessionState),
          stateMatched: true,
        },
      }),
      traceEntry('token', 'Exchange authorization code server-side', {
        request: {
          method: 'POST',
          contentType: 'application/x-www-form-urlencoded',
          body: {
            client_id: config.clientId,
            code: '[redacted]',
            code_verifier: '[redacted]',
            grant_type: 'authorization_code',
            redirect_uri: transaction.redirectUri,
          },
          clientId: config.clientId,
          codePresent: true,
          codeVerifierPresent: true,
          grantType: 'authorization_code',
          redirectUri: transaction.redirectUri,
          tokenEndpoint: discovery.token_endpoint,
        },
        response: {
          accessToken: tokenResponse.accessToken ? '[redacted]' : null,
          expiresAt: tokenResponse.expiresAt,
          expiresIn: tokenResponse.expiresIn,
          idToken: tokenResponse.idToken ? '[redacted]' : null,
          refreshToken: tokenResponse.refreshToken ? '[redacted]' : null,
          scope: tokenResponse.scope,
          tokenType: tokenResponse.tokenType,
        },
      }),
      traceEntry('id_token', 'Verify ID token using issuer signing keys', {
        request: { method: 'GET', url: discovery.jwks_uri },
        response: {
          signatureVerified: true,
          issuerVerified: true,
          audienceVerified: true,
          nonceMatched: true,
          claims: idTokenClaims,
        },
      }),
      traceEntry(
        'userinfo',
        userInfo
          ? 'Fetch userinfo with server-side access token'
          : 'Skip userinfo (not available)',
        {
          request: {
            method: 'GET',
            skipped: !userInfo,
            accessToken: tokenResponse.accessToken ? '[redacted]' : null,
            userInfoEndpoint: discovery.userinfo_endpoint ?? null,
          },
          response: {
            enabled: Boolean(discovery.userinfo_endpoint),
            subject: userInfo?.sub ?? null,
            userInfo,
          },
        },
      ),
      traceEntry('session', 'Create starter demo session', {
        response: {
          authenticated: true,
          expiresAt: authSession.expiresAt,
          issuer: authSession.issuer,
          scope: authSession.scope,
          subject: authSession.subject,
        },
      }),
    ])
    clearSiwcTransaction(response, request)

    return response
  } catch (error) {
    const errorPayload = buildErrorPayload(error)
    return redirectWithError(
      request,
      returnTo,
      'code' in errorPayload && typeof errorPayload.code === 'string'
        ? errorPayload.code
        : 'callback_failed',
      errorPayload,
    )
  }
}

/** GET /api/cubid/siwc/session */
export function siwcSession(request: Request): Response {
  return noStoreJson({
    ...buildSessionSummary(
      readSessionCookie(request),
      readTraceCookie(request),
    ),
    config: getSiwcConfig(request),
  })
}

/** POST /api/cubid/siwc/logout */
export function siwcLogout(request: Request): Response {
  const response = noStoreJson({
    cleared: true,
    status: 'starter_demo_session_cleared',
  })
  clearSiwcSession(response, request)
  if (getSiwcConfig(request).configured)
    appendTrace(request, response, [
      traceEntry('logout', 'Clear starter demo session only', {
        request: {
          method: 'POST',
          url: '/api/cubid/siwc/logout',
        },
        response: {
          cleared: true,
          cubidSsoSession: 'preserved',
          status: 'starter_demo_session_cleared',
        },
      }),
    ])
  return response
}

/** GET /api/cubid/siwc/health: optional Cubid Login deployment diagnostic. */
export async function siwcHealth(): Promise<Response> {
  const origin =
    process.env.CUBID_SIWC_LOGIN_BASE_URL ?? 'https://login.cubid.me'
  try {
    const url = new URL('/api/health', origin)
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      redirect: 'error',
    })
    const payload = await response.json()
    // Only expose the public deployment fields useful to a relying-party developer.
    return noStoreJson({
      request: { method: 'GET', url: url.href },
      response: {
        httpStatus: response.status,
        service: payload.service,
        status: payload.status,
        build: payload.build,
        oidc: { publicOrigin: payload.oidc?.publicOrigin },
        passkeys: payload.passkeys,
        expectedPublicOrigin: payload.expectedPublicOrigin,
      },
    })
  } catch {
    return noStoreJson(
      {
        request: { method: 'GET', origin },
        response: {
          error: 'login_health_unavailable',
          message:
            'Could not read Login health within 5 seconds. This diagnostic does not block sign-in.',
        },
      },
      { status: 502 },
    )
  }
}

/**
 * Redirects back to the app with `?siwc_error=<code>` and records the failure
 * in the trace. `details` (the redacted error payload: code, message, name,
 * HTTP status) stays in the trace so the panel can show why sign-in failed;
 * the redirect URL carries only the code.
 */
function redirectWithError(
  request: Request,
  returnTo: string,
  error: string,
  details?: ReturnType<typeof buildErrorPayload>,
): Response {
  const url = resolveLocalReturnTo(returnTo, requestOrigin(request))
  url.searchParams.set('siwc_error', error)
  const response = redirect(url)
  response.headers.set('Referrer-Policy', 'no-referrer')
  if (getSiwcConfig(request).configured)
    appendTrace(request, response, [
      traceEntry('error', 'Authorization callback failed', {
        request: { method: 'GET', url: siwcCallbackPath },
        response: {
          error,
          // `code` and `name` are redaction keys (authorization code, PII),
          // so the error payload's fields are stored under other names.
          details: details
            ? {
                errorCode: 'code' in details ? details.code : null,
                errorName: details.name,
                message: details.message,
                status: 'status' in details ? (details.status ?? null) : null,
              }
            : null,
        },
      }),
    ])
  clearSiwcTransaction(response, request)
  return response
}
