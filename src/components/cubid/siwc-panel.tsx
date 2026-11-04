import { useState } from 'react'
import {
  CheckCircle2,
  ExternalLink,
  LoaderCircle,
  LogIn,
  RefreshCcw,
  ShieldCheck,
} from 'lucide-react'

import { useSiwcSession } from '#/hooks/use-siwc-session'

export function ServerMediatedSiwcPanel() {
  const auth = useSiwcSession()
  const { session, status, error } = auth
  const [health, setHealth] = useState<unknown>(null)
  const [checkingHealth, setCheckingHealth] = useState(false)
  const cubidLogoutUrl = session?.trace?.find(
    (entry) => entry.step === 'discovery',
  )?.response?.endSessionEndpoint

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
          onClick={() => void auth.signIn()}
          disabled={status === 'loading'}
          type="button"
        >
          <LogIn size={16} aria-hidden="true" />
          Sign in with Cubid
        </button>
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#cfd6c7] bg-white px-4 text-sm font-semibold text-[#1d2a1e] transition hover:bg-[#eef3eb]"
          onClick={() => void auth.signIn({ maxAge: 0, prompt: 'login' })}
          disabled={status === 'loading'}
          type="button"
        >
          Force login
        </button>
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#cfd6c7] bg-white px-4 text-sm font-semibold text-[#1d2a1e] transition hover:bg-[#eef3eb]"
          onClick={() => void auth.signIn({ prompt: 'consent' })}
          disabled={status === 'loading'}
          type="button"
        >
          Force consent
        </button>
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#cfd6c7] bg-white px-4 text-sm font-semibold text-[#1d2a1e] transition hover:bg-[#eef3eb] disabled:cursor-not-allowed disabled:text-[#8a9585]"
          disabled={status === 'loading'}
          onClick={() => void auth.signOut()}
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
