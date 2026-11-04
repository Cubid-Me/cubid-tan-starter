import { useMemo, useState, useTransition } from 'react'
import { buildClearPassVerifyUrl } from '@cubid/browser'
import { createCubidCommsClient } from '@cubid/comms'
import {
  CubidAuthProvider,
  CubidSignInButton,
  CubidSignOutButton,
  useCubidAuth,
} from '@cubid/auth-react'
import { ClearPassVerifyButton } from '@cubid/react'
import { CubidRecoveryLaunchButton } from '@cubid/wallet-recovery-react'
import {
  Bell,
  CheckCircle2,
  ExternalLink,
  Fingerprint,
  KeyRound,
  LoaderCircle,
  LogIn,
} from 'lucide-react'

const publicConfig = {
  clearPassPageId: import.meta.env.VITE_CUBID_CLEARPASS_PAGE_ID ?? '',
  clientId: import.meta.env.VITE_CUBID_OIDC_CLIENT_ID ?? '',
  issuer: import.meta.env.VITE_CUBID_ISSUER_URL ?? '',
  passportBaseUrl: import.meta.env.VITE_CUBID_PASSPORT_BASE_URL ?? '',
  redirectUri: import.meta.env.VITE_CUBID_REDIRECT_URI ?? '',
}

function missingPublicConfig() {
  return Object.entries(publicConfig)
    .filter(([, value]) => !value.trim())
    .map(([key]) => key)
}

function summarizeToken(token: string | null | undefined) {
  if (!token) {
    return 'No access token in the current browser session.'
  }

  return `${token.slice(0, 8)}...${token.slice(-6)} (${token.length} chars)`
}

export function BrowserDemo() {
  const missing = missingPublicConfig()

  if (missing.length > 0) {
    return (
      <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 rounded-lg border border-[#d9ddd2] bg-white p-5 shadow-sm">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#dbe9d6] text-[#1f6f50]">
            <Fingerprint size={20} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold">Browser UX demo</h2>
            <p className="mt-2 text-sm leading-6 text-[#596456]">
              Add the browser-safe `VITE_CUBID_*` values from `.env.example` to
              enable Login with Cubid, ClearPass Verify, notification
              preferences, and recovery launchers.
            </p>
          </div>
        </div>
        <div className="mt-5 break-words rounded-md border border-[#e4d4a1] bg-[#fffbea] p-4 text-sm text-[#665313]">
          Missing browser-safe config: {missing.join(', ')}
        </div>
      </section>
    )
  }

  return (
    <CubidAuthProvider
      autoUserInfo
      clientId={publicConfig.clientId}
      issuer={publicConfig.issuer}
      postLogoutRedirectUri={
        typeof window === 'undefined' ? undefined : window.location.origin
      }
      redirectUri={publicConfig.redirectUri}
      scope={['openid', 'profile', 'email']}
    >
      <BrowserDemoPanel />
    </CubidAuthProvider>
  )
}

function BrowserDemoPanel() {
  const auth = useCubidAuth()
  const [recoverySessionId, setRecoverySessionId] = useState('')
  const [commsState, setCommsState] = useState<{
    result: unknown
    status: 'idle' | 'loading' | 'success' | 'error'
  }>({ result: null, status: 'idle' })
  const [isPending, startTransition] = useTransition()
  const subject = auth.session?.subject ?? ''

  const clearPassHeadlessUrl = useMemo(() => {
    if (!subject || !publicConfig.clearPassPageId) {
      return null
    }

    return buildClearPassVerifyUrl({
      pageId: publicConfig.clearPassPageId,
      passportOrigin: publicConfig.passportBaseUrl,
      userId: subject,
    })
  }, [subject])

  function loadCommsProfile() {
    if (!auth.session?.accessToken) {
      setCommsState({
        result: 'Sign in before loading notification preferences.',
        status: 'error',
      })
      return
    }

    setCommsState({ result: null, status: 'loading' })
    startTransition(async () => {
      try {
        const client = createCubidCommsClient({
          accessToken: auth.session!.accessToken,
          baseUrl: publicConfig.passportBaseUrl,
        })
        const [channels, preferences] = await Promise.all([
          client.channels.list(),
          client.preferences.list(),
        ])

        setCommsState({
          result: {
            channels: channels.channels.map((channel) => ({
              channelId: channel.channelId,
              channelType: channel.channelType,
              displayHint: channel.displayHint,
              isDefault: channel.isDefault,
              label: channel.label,
              status: channel.status,
              verificationStatus: channel.verificationStatus,
            })),
            preferences: preferences.preferences.map((preference) => ({
              categoryKey: preference.categoryKey,
              channelId: preference.channelId,
              mutedUntil: preference.mutedUntil,
              priorityFloor: preference.priorityFloor,
              status: preference.status,
            })),
          },
          status: 'success',
        })
      } catch (error) {
        setCommsState({
          result:
            error instanceof Error
              ? { message: error.message, name: error.name }
              : { message: 'Unable to load Cubid comms profile.' },
          status: 'error',
        })
      }
    })
  }

  return (
    <section className="min-w-0 rounded-lg border border-[#d9ddd2] bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#dbe9d6] text-[#1f6f50]">
          <Fingerprint size={20} aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Browser UX demo</h2>
          <p className="mt-2 text-sm leading-6 text-[#596456]">
            These controls use browser-safe packages only: `@cubid/auth-react`,
            `@cubid/browser`, `@cubid/react`, `@cubid/comms`, and
            `@cubid/wallet-recovery-react`.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4">
        <div className="rounded-lg border border-[#dce2d6] bg-[#f8faf6] p-4">
          <div className="flex flex-wrap items-center gap-3">
            {auth.isAuthenticated ? (
              <CubidSignOutButton className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#cfd6c7] bg-white px-4 text-sm font-semibold text-[#1d2a1e] transition hover:bg-[#eef3eb]">
                Sign out
              </CubidSignOutButton>
            ) : (
              <CubidSignInButton className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#1f6f50] px-4 text-sm font-semibold text-white transition hover:bg-[#18593f]">
                <span className="inline-flex items-center gap-2">
                  <LogIn size={16} aria-hidden="true" />
                  Login with Cubid
                </span>
              </CubidSignInButton>
            )}
            <span className="inline-flex items-center gap-2 text-sm text-[#596456]">
              <CheckCircle2
                size={16}
                aria-hidden="true"
                className={
                  auth.isAuthenticated ? 'text-[#1f6f50]' : 'text-[#9ca696]'
                }
              />
              {auth.status}
            </span>
          </div>

          <pre className="mt-4 max-h-64 overflow-auto rounded-md border border-[#dce2d6] bg-white p-3 text-xs leading-5 text-[#263026]">
            {JSON.stringify(
              {
                accessToken: summarizeToken(auth.session?.accessToken),
                claims: auth.session?.idTokenClaims ?? null,
                subject: auth.session?.subject ?? null,
                userInfo: auth.session?.userInfo ?? null,
              },
              null,
              2,
            )}
          </pre>
        </div>

        <div className="cubid-widget-shell rounded-lg border border-[#dce2d6] p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <ExternalLink size={16} aria-hidden="true" />
            ClearPass Verify
          </div>
          <ClearPassVerifyButton
            className="cubid-hosted-widget"
            pageId={publicConfig.clearPassPageId}
            passportOrigin={publicConfig.passportBaseUrl}
            userId={subject}
          />
          {clearPassHeadlessUrl ? (
            <a
              className="mt-3 inline-flex text-sm font-medium text-[#1f6f50] underline-offset-4 hover:underline"
              href={clearPassHeadlessUrl}
              rel="noreferrer"
              target="_blank"
            >
              Open the same URL built by `@cubid/browser`
            </a>
          ) : null}
        </div>

        <div className="rounded-lg border border-[#dce2d6] p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Bell size={16} aria-hidden="true" />
            Notification channels and preferences
          </div>
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#cfd6c7] bg-white px-4 text-sm font-semibold text-[#1d2a1e] transition hover:bg-[#eef3eb] disabled:cursor-not-allowed disabled:text-[#8a9585]"
            disabled={isPending || commsState.status === 'loading'}
            onClick={loadCommsProfile}
            type="button"
          >
            {commsState.status === 'loading' ? (
              <LoaderCircle
                className="animate-spin"
                size={16}
                aria-hidden="true"
              />
            ) : (
              <Bell size={16} aria-hidden="true" />
            )}
            Load preferences
          </button>
          <pre
            className={`mt-3 max-h-56 overflow-auto rounded-md border p-3 text-xs leading-5 ${
              commsState.status === 'error'
                ? 'border-[#e0b7ad] bg-[#fff7f5] text-[#713022]'
                : 'border-[#dce2d6] bg-[#f8faf6] text-[#263026]'
            }`}
          >
            {commsState.status === 'idle'
              ? 'Signed-in comms metadata appears here.'
              : JSON.stringify(commsState.result, null, 2)}
          </pre>
        </div>

        <div className="rounded-lg border border-[#dce2d6] p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <KeyRound size={16} aria-hidden="true" />
            Hosted recoverable-wallet recovery
          </div>
          <label className="grid gap-2 text-sm font-medium">
            Recovery session id from the server helper
            <input
              className="h-11 rounded-md border border-[#cfd6c7] px-3 text-sm outline-none focus:border-[#1f6f50]"
              onChange={(event) => setRecoverySessionId(event.target.value)}
              placeholder="rw_release_..."
              value={recoverySessionId}
            />
          </label>
          <CubidRecoveryLaunchButton
            className="mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#1f6f50] px-4 text-sm font-semibold text-white transition hover:bg-[#18593f] disabled:cursor-not-allowed disabled:bg-[#a8b6a1]"
            disabled={!recoverySessionId.trim()}
            passportOrigin={publicConfig.passportBaseUrl}
            recoverySessionId={recoverySessionId}
          >
            Open recovery flow
          </CubidRecoveryLaunchButton>
        </div>
      </div>
    </section>
  )
}
