import { useState, useTransition } from 'react'
import { DatabaseZap, LoaderCircle, Play } from 'lucide-react'

type Operation =
  | 'ensure-user'
  | 'identity'
  | 'score'
  | 'stamps'
  | 'recovery-status'
  | 'start-recovery-release'
type FollowUpOperation = Exclude<Operation, 'ensure-user'>

const followUpOperations = [
  { label: 'Fetch identity', value: 'identity' },
  { label: 'Fetch stamps', value: 'stamps' },
  { label: 'Fetch humanity score', value: 'score' },
  { label: 'Recovery bundle status', value: 'recovery-status' },
  { label: 'Start recovery release', value: 'start-recovery-release' },
] as const satisfies ReadonlyArray<{
  label: string
  value: FollowUpOperation
}>

type DemoState =
  | { status: 'idle' }
  | { result: unknown; status: 'success' }
  | { result: unknown; status: 'error' }

export function ServerDemo() {
  const [operation, setOperation] = useState<FollowUpOperation>('identity')
  const [email, setEmail] = useState('demo@example.com')
  const [userId, setUserId] = useState('')
  const [recoveryBundleId, setRecoveryBundleId] = useState('')
  const [providerKey, setProviderKey] = useState('')
  const [registrationState, setRegistrationState] = useState<DemoState>({
    status: 'idle',
  })
  const [followUpState, setFollowUpState] = useState<DemoState>({
    status: 'idle',
  })
  const [isPending, startTransition] = useTransition()
  const registrationRequestBody = {
    email,
    operation: 'ensure-user',
  }
  const followUpRequestBody = {
    operation,
    providerKey,
    recoveryBundleId,
    userId,
  }

  function registerUser() {
    startTransition(async () => {
      const response = await fetch('/api/cubid/server-demo', {
        body: JSON.stringify(registrationRequestBody),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      })
      const result = (await response.json()) as unknown
      const nextState = {
        result,
        status: response.ok ? 'success' : 'error',
      } satisfies DemoState

      setRegistrationState(nextState)

      if (
        response.ok &&
        typeof result === 'object' &&
        result !== null &&
        'result' in result &&
        typeof result.result === 'object' &&
        result.result !== null &&
        'userId' in result.result &&
        typeof result.result.userId === 'string'
      ) {
        setUserId(result.result.userId)
      }
    })
  }

  function runFollowUpCall() {
    startTransition(async () => {
      const response = await fetch('/api/cubid/server-demo', {
        body: JSON.stringify(followUpRequestBody),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      })
      const result = (await response.json()) as unknown

      setFollowUpState({
        result,
        status: response.ok ? 'success' : 'error',
      })
    })
  }

  const needsRecovery =
    operation === 'recovery-status' || operation === 'start-recovery-release'

  return (
    <section className="min-w-0 rounded-lg border border-[#d9ddd2] bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#dbe9d6] text-[#1f6f50]">
          <DatabaseZap size={20} aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Server API demo</h2>
          <p className="mt-2 text-sm leading-6 text-[#596456]">
            These actions run through a TanStack Start server route using
            `@cubid/core`. Missing server credentials return a safe setup
            response instead of leaking secrets into the browser.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-5">
        <div className="rounded-md border border-[#dce2d6] p-4">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1f6f50] text-sm font-semibold text-white">
              1
            </span>
            <div>
              <h3 className="text-sm font-semibold">
                Register or resolve a user
              </h3>
              <p className="mt-1 text-xs leading-5 text-[#596456]">
                Send an email to <code>ensureUserByEmail</code> and capture the
                returned app-scoped Cubid id.
              </p>
            </div>
          </div>
          <label className="grid gap-2 text-sm font-medium">
            Email
            <input
              className="h-11 rounded-md border border-[#cfd6c7] px-3 text-sm outline-none focus:border-[#1f6f50]"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="person@example.com"
              type="email"
              value={email}
            />
          </label>

          <button
            className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#1f6f50] px-4 text-sm font-semibold text-white transition hover:bg-[#18593f] disabled:cursor-not-allowed disabled:bg-[#a8b6a1]"
            disabled={isPending}
            onClick={registerUser}
            type="button"
          >
            {isPending ? (
              <LoaderCircle
                className="animate-spin"
                size={17}
                aria-hidden="true"
              />
            ) : (
              <Play size={17} aria-hidden="true" />
            )}
            Register user
          </button>
        </div>

        <div className="rounded-md border border-[#dce2d6] p-4">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1f6f50] text-sm font-semibold text-white">
              2
            </span>
            <div>
              <h3 className="text-sm font-semibold">
                Use the Cubid id for follow-up calls
              </h3>
              <p className="mt-1 text-xs leading-5 text-[#596456]">
                The returned id is app-scoped. Use it for identity, stamps,
                score, and recovery metadata calls.
              </p>
            </div>
          </div>

          <label className="grid gap-2 text-sm font-medium">
            Operation
            <select
              className="h-11 rounded-md border border-[#cfd6c7] bg-white px-3 text-sm outline-none focus:border-[#1f6f50]"
              onChange={(event) =>
                setOperation(event.target.value as FollowUpOperation)
              }
              value={operation}
            >
              {followUpOperations.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm font-medium">
            Cubid app-scoped user id
            <input
              className="h-11 rounded-md border border-[#cfd6c7] px-3 text-sm outline-none focus:border-[#1f6f50]"
              onChange={(event) => setUserId(event.target.value)}
              placeholder="usr_..."
              value={userId}
            />
          </label>

          {needsRecovery ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium">
                Recovery bundle id
                <input
                  className="h-11 rounded-md border border-[#cfd6c7] px-3 text-sm outline-none focus:border-[#1f6f50]"
                  onChange={(event) => setRecoveryBundleId(event.target.value)}
                  placeholder="optional exact bundle"
                  value={recoveryBundleId}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Provider key
                <input
                  className="h-11 rounded-md border border-[#cfd6c7] px-3 text-sm outline-none focus:border-[#1f6f50]"
                  onChange={(event) => setProviderKey(event.target.value)}
                  placeholder="optional provider"
                  value={providerKey}
                />
              </label>
            </div>
          ) : null}

          <button
            className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#1f6f50] px-4 text-sm font-semibold text-white transition hover:bg-[#18593f] disabled:cursor-not-allowed disabled:bg-[#a8b6a1]"
            disabled={isPending}
            onClick={runFollowUpCall}
            type="button"
          >
            {isPending ? (
              <LoaderCircle
                className="animate-spin"
                size={17}
                aria-hidden="true"
              />
            ) : (
              <Play size={17} aria-hidden="true" />
            )}
            Run follow-up call
          </button>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-md border border-[#dce2d6]">
        <div className="border-b border-[#dce2d6] bg-[#f8faf6] px-4 py-3">
          <h3 className="text-sm font-semibold">Request</h3>
          <p className="mt-1 text-xs leading-5 text-[#596456]">
            The browser posts this sanitized payload to the local TanStack Start
            server route. That route creates the <code>@cubid/core</code> client
            with server-only env vars, calls Cubid, and returns a redacted
            starter response.
          </p>
        </div>
        <div className="grid gap-0 text-sm sm:grid-cols-3">
          <div className="border-b border-[#edf0e9] p-4 sm:border-b-0 sm:border-r">
            <div className="text-xs font-medium uppercase tracking-[0.12em] text-[#7b8576]">
              Local route
            </div>
            <div className="mt-2 font-mono text-xs text-[#20362d]">
              POST /api/cubid/server-demo
            </div>
          </div>
          <div className="border-b border-[#edf0e9] p-4 sm:border-b-0 sm:border-r">
            <div className="text-xs font-medium uppercase tracking-[0.12em] text-[#7b8576]">
              Server package
            </div>
            <div className="mt-2 font-mono text-xs text-[#20362d]">
              @cubid/core
            </div>
          </div>
          <div className="p-4">
            <div className="text-xs font-medium uppercase tracking-[0.12em] text-[#7b8576]">
              Credentials
            </div>
            <div className="mt-2 text-xs leading-5 text-[#596456]">
              Reads <code>CUBID_API_BASE_URL</code>, <code>CUBID_API_KEY</code>,
              and optional <code>CUBID_DAPP_ID</code> only inside the API route.
            </div>
          </div>
        </div>
        <div className="grid border-t border-[#edf0e9] lg:grid-cols-2">
          <div className="border-b border-[#edf0e9] lg:border-b-0 lg:border-r">
            <div className="border-b border-[#edf0e9] bg-[#fbfcfa] px-4 py-2 text-xs font-semibold text-[#4d594a]">
              Registration request
            </div>
            <pre className="max-h-72 overflow-auto bg-[#fbfcfa] p-4 text-xs leading-5 text-[#263026]">
              {JSON.stringify(
                {
                  body: registrationRequestBody,
                  headers: { 'content-type': 'application/json' },
                  method: 'POST',
                  route: '/api/cubid/server-demo',
                },
                null,
                2,
              )}
            </pre>
          </div>
          <div>
            <div className="border-b border-[#edf0e9] bg-[#fbfcfa] px-4 py-2 text-xs font-semibold text-[#4d594a]">
              Follow-up request
            </div>
            <pre className="max-h-72 overflow-auto bg-[#fbfcfa] p-4 text-xs leading-5 text-[#263026]">
              {JSON.stringify(
                {
                  body: followUpRequestBody,
                  headers: { 'content-type': 'application/json' },
                  method: 'POST',
                  route: '/api/cubid/server-demo',
                },
                null,
                2,
              )}
            </pre>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Registration response</h3>
          <pre
            className={`mt-2 max-h-[420px] overflow-auto rounded-md border p-4 text-xs leading-5 ${
              registrationState.status === 'error'
                ? 'border-[#e0b7ad] bg-[#fff7f5] text-[#713022]'
                : 'border-[#dce2d6] bg-[#f8faf6] text-[#263026]'
            }`}
          >
            {registrationState.status === 'idle'
              ? 'Register a user to get their Cubid id.'
              : JSON.stringify(registrationState.result, null, 2)}
          </pre>
        </div>

        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Follow-up response</h3>
          <pre
            className={`mt-2 max-h-[420px] overflow-auto rounded-md border p-4 text-xs leading-5 ${
              followUpState.status === 'error'
                ? 'border-[#e0b7ad] bg-[#fff7f5] text-[#713022]'
                : 'border-[#dce2d6] bg-[#f8faf6] text-[#263026]'
            }`}
          >
            {followUpState.status === 'idle'
              ? 'Use the returned Cubid id to run a follow-up call.'
              : JSON.stringify(followUpState.result, null, 2)}
          </pre>
        </div>
      </div>
    </section>
  )
}
