import { useEffect, useState } from 'react'
import {
  CheckCircle2,
  ExternalLink,
  LoaderCircle,
  LogIn,
  RefreshCcw,
  ShieldCheck,
} from 'lucide-react'

type SiwcDemoSessionResponse = {
  authenticated: boolean
  session?: Record<string, unknown>
  status: string
  config?: { configured: boolean; missing?: string[] }
  trace?: Array<{
    label?: string
    at?: string
    request?: Record<string, unknown>
    response?: Record<string, unknown>
    step?: string
  }>
}

export function ServerMediatedSiwcPanel() {
  const [session, setSession] = useState<SiwcDemoSessionResponse | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [health, setHealth] = useState<unknown>(null)
  const [checkingHealth, setCheckingHealth] = useState(false)
  const cubidLogoutUrl = session?.trace?.find(
    (entry) => entry.step === 'discovery',
  )?.response?.endSessionEndpoint

  useEffect(() => {
    const callbackError = new URLSearchParams(window.location.search).get(
      'siwc_error',
    )
    void loadSession().then(() => {
      if (callbackError) {
        setError(
          'Cubid sign-in failed. Review the callback response below, then try again.',
        )
        setStatus('error')
        const url = new URL(window.location.href)
        url.searchParams.delete('siwc_error')
        window.history.replaceState(null, '', url)
      }
    })
  }, [])

  async function loadSession() {
    setStatus('loading')
    setError(null)

    try {
      const response = await fetch('/api/cubid/siwc/session', {
        cache: 'no-store',
        headers: { accept: 'application/json' },
      })
      if (!response.ok) throw new Error('Unable to load the SIWC demo session.')
      const payload = (await response.json()) as SiwcDemoSessionResponse
      setSession(payload)
      setStatus('idle')
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to load the SIWC demo session.',
      )
      setStatus('error')
    }
  }

  async function startSiwc(options: { maxAge?: number; prompt?: string } = {}) {
    setStatus('loading')
    setError(null)
    const params = new URLSearchParams({
      return_to: `${window.location.pathname}#siwc`,
      format: 'json',
    })

    if (options.prompt) {
      params.set('prompt', options.prompt)
    }

    if (typeof options.maxAge === 'number') {
      params.set('max_age', String(options.maxAge))
    }

    try {
      const response = await fetch(
        `/api/cubid/siwc/start?${params.toString()}`,
        { cache: 'no-store' },
      )
      const payload = await response.json()
      if (!response.ok) {
        setSession((previous) => ({
          ...(previous ?? { authenticated: false, status: 'not_signed_in' }),
          trace: [
            ...(previous?.trace ?? []),
            {
              label: 'Start authorization failed',
              step: 'start',
              at: new Date().toISOString(),
              request: {
                method: 'GET',
                url: `/api/cubid/siwc/start?${params.toString()}`,
              },
              response: {
                httpStatus: response.status,
                error: payload.error,
                missing: payload.missing,
              },
            },
          ],
        }))
        throw new Error(
          payload.missing
            ? `Configure ${payload.missing.join(', ')}`
            : 'Cubid authorization could not be started. Check the issuer and client configuration.',
        )
      }
      window.location.assign(payload.authorizationUrl)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Sign-in could not be started.',
      )
      setStatus('error')
    }
  }

  async function clearStarterSession() {
    setStatus('loading')
    setError(null)

    try {
      const response = await fetch('/api/cubid/siwc/logout', {
        headers: { accept: 'application/json' },
        method: 'POST',
      })
      if (!response.ok) throw new Error('Unable to clear the starter session.')
      await response.json()
      await loadSession()
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to clear the starter demo session.',
      )
      setStatus('error')
    }
  }

  return (
    <section
      id="siwc"
      className="min-w-0 scroll-mt-6 border-y border-[#d9ddd2] bg-white p-5"
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white text-[#1f6f50]">
          <ShieldCheck size={18} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 className="text-xl font-semibold">Sign in with Cubid</h2>
          <p className="mt-2 text-sm leading-6 text-[#596456]">
            Cubid hosts passkeys, consent, device handoff, and recovery. This
            relying-party demo exchanges the authorization code on the server
            and displays the resulting app-scoped identity.
          </p>
        </div>
      </div>

      <p
        role="status"
        className="mt-5 flex items-center gap-2 text-base font-semibold"
      >
        <CheckCircle2
          size={18}
          className={
            session?.authenticated ? 'text-[#1f6f50]' : 'text-[#596456]'
          }
          aria-hidden="true"
        />
        {session?.authenticated
          ? 'Successfully signed in'
          : 'Not signed in yet'}
        {status === 'loading' ? (
          <LoaderCircle
            className="animate-spin"
            size={16}
            aria-label="Loading"
          />
        ) : null}
      </p>
      {session?.config?.configured === false ? (
        <p className="mt-2 break-words text-sm text-[#713022]">
          Required configuration: {session.config.missing?.join(', ')}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#1f6f50] px-4 text-sm font-semibold text-white transition hover:bg-[#18593f]"
          onClick={() => startSiwc()}
          disabled={status === 'loading'}
          type="button"
        >
          <LogIn size={16} aria-hidden="true" />
          Sign in with Cubid
        </button>
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#cfd6c7] bg-white px-4 text-sm font-semibold text-[#1d2a1e] transition hover:bg-[#eef3eb]"
          onClick={() => startSiwc({ maxAge: 0, prompt: 'login' })}
          disabled={status === 'loading'}
          type="button"
        >
          Force login
        </button>
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#cfd6c7] bg-white px-4 text-sm font-semibold text-[#1d2a1e] transition hover:bg-[#eef3eb]"
          onClick={() => startSiwc({ prompt: 'consent' })}
          disabled={status === 'loading'}
          type="button"
        >
          Force consent
        </button>
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#cfd6c7] bg-white px-4 text-sm font-semibold text-[#1d2a1e] transition hover:bg-[#eef3eb] disabled:cursor-not-allowed disabled:text-[#8a9585]"
          disabled={status === 'loading'}
          onClick={clearStarterSession}
          type="button"
        >
          <RefreshCcw size={16} aria-hidden="true" />
          Clear starter session
        </button>
        {typeof cubidLogoutUrl === 'string' ? (
          <a
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#cfd6c7] bg-white px-4 text-sm font-semibold text-[#1d2a1e] transition hover:bg-[#eef3eb]"
            href={cubidLogoutUrl}
          >
            <ExternalLink size={16} aria-hidden="true" />
            Cubid logout
          </a>
        ) : null}
      </div>

      <details className="mt-5 border-t border-[#dce2d6] pt-4">
        <summary className="cursor-pointer text-sm font-semibold">
          Cubid Login deployment
        </summary>
        <button
          type="button"
          disabled={checkingHealth}
          className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-[#1f6f50]"
          onClick={async () => {
            setCheckingHealth(true)
            try {
              const response = await fetch('/api/cubid/siwc/health', {
                cache: 'no-store',
              })
              setHealth(await response.json())
            } catch {
              setHealth({ error: 'Unable to fetch Login health.' })
            } finally {
              setCheckingHealth(false)
            }
          }}
        >
          <RefreshCcw
            size={16}
            className={checkingHealth ? 'animate-spin' : ''}
          />
          Check deployment
        </button>
        {health ? (
          <pre className="mt-3 max-h-64 overflow-auto bg-[#f8faf6] p-3 text-xs">
            {JSON.stringify(health, null, 2)}
          </pre>
        ) : null}
      </details>

      {error ? (
        <div className="mt-3 rounded-md border border-[#e0b7ad] bg-[#fff7f5] p-3 text-sm text-[#713022]">
          {error}
        </div>
      ) : null}

      <div className="mt-5 border-t border-[#dce2d6] pt-4">
        <h3 className="text-base font-semibold">Calls and responses</h3>
        <p className="mt-2 text-sm leading-6 text-[#596456]">
          The starter records its OIDC calls below. Passkey, consent, and
          recovery requests happen on the Cubid origin and are not visible to
          this app. Tokens, codes, state, nonce, and personal details are
          redacted.
        </p>
        <ol className="mt-4 divide-y divide-[#dce2d6]">
          <li className="py-4">
            <h4 className="text-sm font-semibold">Read starter session</h4>
            <div className="mt-3 grid min-w-0 gap-3 md:grid-cols-2">
              <TraceValue
                title="Request"
                value={{ method: 'GET', url: '/api/cubid/siwc/session' }}
              />
              <TraceValue
                title="Response"
                value={{
                  authenticated: session?.authenticated ?? false,
                  status: session?.status ?? 'not_signed_in',
                  session: session?.session ?? null,
                }}
              />
            </div>
          </li>
          {session?.trace?.map((entry, index) => (
            <li key={`${entry.at}-${index}`} className="py-4">
              <h4 className="text-sm font-semibold">
                {entry.label ?? entry.step}
              </h4>
              <div className="mt-3 grid min-w-0 gap-3 md:grid-cols-2">
                <TraceValue
                  title="Request"
                  value={entry.request ?? { type: 'local server operation' }}
                />
                <TraceValue
                  title="Response"
                  value={entry.response ?? { received: true }}
                />
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function TraceValue({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="min-w-0">
      <p className="mb-2 text-xs font-semibold uppercase text-[#596456]">
        {title}
      </p>
      <pre className="max-h-64 max-w-full overflow-auto rounded-md border border-[#dce2d6] bg-[#f8faf6] p-3 text-xs leading-5 text-[#263026]">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  )
}
