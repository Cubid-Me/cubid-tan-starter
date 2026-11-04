import { useCallback, useEffect, useState } from 'react'

export type SiwcSessionResponse = {
  authenticated: boolean
  config?: { configured: boolean; missing?: Array<string> }
  session?: {
    authenticatedAt?: string
    expiresAt?: number | null
    issuer?: string
    scope?: Array<string>
    subject?: string | null
  } & Record<string, unknown>
  status: string
  trace?: Array<{
    at?: string
    label?: string
    request?: Record<string, unknown>
    response?: Record<string, unknown>
    step?: string
  }>
}

export type SiwcSignInOptions = { maxAge?: number; prompt?: string }

/**
 * Client-side view of the server-mediated Sign in with Cubid session.
 * Talks only to the local `/api/cubid/siwc/*` server routes; tokens never
 * reach the browser.
 */
export function useSiwcSession() {
  const [session, setSession] = useState<SiwcSessionResponse | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setStatus('loading')
    setError(null)
    try {
      const response = await fetch('/api/cubid/siwc/session', {
        cache: 'no-store',
        headers: { accept: 'application/json' },
      })
      if (!response.ok) throw new Error('Unable to load the sign-in session.')
      setSession((await response.json()) as SiwcSessionResponse)
      setStatus('idle')
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to load the sign-in session.',
      )
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    const callbackError = new URLSearchParams(window.location.search).get(
      'siwc_error',
    )
    void reload().then(() => {
      if (callbackError) {
        setError(`Cubid sign-in failed (${callbackError}). Please try again.`)
        setStatus('error')
        const url = new URL(window.location.href)
        url.searchParams.delete('siwc_error')
        window.history.replaceState(null, '', url)
      }
    })
  }, [reload])

  const signIn = useCallback(async (options: SiwcSignInOptions = {}) => {
    setStatus('loading')
    setError(null)
    const params = new URLSearchParams({
      return_to: `${window.location.pathname}${window.location.search}`,
      format: 'json',
    })
    if (options.prompt) params.set('prompt', options.prompt)
    if (typeof options.maxAge === 'number')
      params.set('max_age', String(options.maxAge))

    try {
      const response = await fetch(`/api/cubid/siwc/start?${params}`, {
        cache: 'no-store',
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(
          payload.missing
            ? `Configure ${payload.missing.join(', ')}`
            : 'Cubid sign-in could not be started.',
        )
      }
      window.location.assign(payload.authorizationUrl)
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Sign-in could not start.',
      )
      setStatus('error')
    }
  }, [])

  const signOut = useCallback(async () => {
    setStatus('loading')
    setError(null)
    try {
      const response = await fetch('/api/cubid/siwc/logout', {
        headers: { accept: 'application/json' },
        method: 'POST',
      })
      if (!response.ok) throw new Error('Unable to sign out.')
      await reload()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to sign out.')
      setStatus('error')
    }
  }, [reload])

  return { error, reload, session, signIn, signOut, status }
}
