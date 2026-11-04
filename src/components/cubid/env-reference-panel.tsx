import { ExternalLink, KeyRound, ShieldCheck } from 'lucide-react'

const requiredEnv = [
  {
    name: 'VITE_CUBID_ISSUER_URL',
    scope: 'Browser-safe',
    usedFor: 'Login with Cubid / OIDC PKCE discovery.',
    source: 'Cubid issuer URL, usually https://id.cubid.me.',
  },
  {
    name: 'VITE_CUBID_OIDC_CLIENT_ID',
    scope: 'Browser-safe',
    usedFor: 'Browser sign-in launch and callback handling.',
    source: 'Create or copy the OIDC client id in Cubid Admin.',
  },
  {
    name: 'VITE_CUBID_REDIRECT_URI',
    scope: 'Browser-safe',
    usedFor: 'OIDC callback validation.',
    source: 'Register the same local callback URL on the Cubid OIDC client.',
  },
  {
    name: 'VITE_CUBID_PASSPORT_BASE_URL',
    scope: 'Browser-safe',
    usedFor: 'Hosted Cubid browser flows.',
    source: 'Cubid hosted app/API origin, usually https://passport.cubid.me.',
  },
  {
    name: 'CUBID_SIWC_ISSUER_URL',
    scope: 'Server-only',
    usedFor: 'Server-mediated SIWC discovery and issuer validation.',
    source: 'Use https://id.cubid.me for production.',
  },
  {
    name: 'CUBID_SIWC_CLIENT_ID',
    scope: 'Server-only',
    usedFor: 'Server-mediated authorization and code exchange.',
    source: 'Copy the registered relying-party client id from Cubid Admin.',
  },
  {
    name: 'CUBID_SIWC_REDIRECT_URI',
    scope: 'Server-only',
    usedFor: 'The starter-owned SIWC callback route.',
    source: 'Register the exact local, preview, or production callback URL.',
  },
  {
    name: 'CUBID_API_BASE_URL',
    scope: 'Server-only',
    usedFor: 'Server API demo calls through @cubid/core.',
    source: 'Cubid API origin, usually https://passport.cubid.me.',
  },
  {
    name: 'CUBID_API_KEY',
    scope: 'Server-only',
    usedFor:
      'Dapp API calls for users, identity, score, stamps, and recovery metadata.',
    source: 'Generate or copy your dapp API key in Cubid Admin.',
  },
]

const optionalEnv = [
  {
    name: 'CUBID_SIWC_COOKIE_SECRET',
    scope: 'Server-only',
    usedFor:
      'Authenticated encryption of SIWC demo cookies. Required in production.',
    notes:
      'Generate with openssl rand -hex 32. Development uses a temporary process key when unset.',
  },
  {
    name: 'CUBID_SIWC_LOGIN_BASE_URL',
    scope: 'Server-only',
    usedFor: 'Optional public Login deployment diagnostic.',
    notes:
      'Defaults to https://login.cubid.me. Authorization uses issuer discovery independently.',
  },
  {
    name: 'CUBID_SIWC_SCOPE',
    scope: 'Server-only',
    usedFor: 'Scopes requested by the SIWC panel.',
    notes:
      'Defaults to openid profile email; request only scopes allowed for your client.',
  },
  {
    name: 'CUBID_DAPP_ID',
    scope: 'Server-only',
    usedFor: 'Endpoints that require an explicit dapp id.',
    notes:
      'Set it when your Cubid environment or API key is scoped by dapp id.',
  },
  {
    name: 'VITE_CUBID_CLEARPASS_PAGE_ID',
    scope: 'Browser-safe',
    usedFor: 'ClearPass Verify launcher.',
    notes: 'Required only for the ClearPass Verify demo.',
  },
]

export function EnvReferencePanel() {
  return (
    <section className="min-w-0 rounded-lg border border-[#d9ddd2] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#dbe9d6] text-[#1f6f50]">
              <KeyRound size={20} aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Cubid env reference</h2>
              <p className="mt-2 text-sm leading-6 text-[#596456]">
                These are the settings this starter needs for live Cubid
                identity, hosted verification, comms, and recovery flows. Keep
                server-only values out of `VITE_*`.
              </p>
            </div>
          </div>
        </div>
        <a
          className="inline-flex h-10 w-fit items-center justify-center gap-2 rounded-md bg-[#1f6f50] px-4 text-sm font-semibold text-white transition hover:bg-[#18593f]"
          href="https://admin.cubid.me/"
          rel="noreferrer"
          target="_blank"
        >
          Open Cubid Admin
          <ExternalLink size={16} aria-hidden="true" />
        </a>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
        <div className="overflow-hidden rounded-lg border border-[#dce2d6]">
          <div className="flex items-center gap-2 border-b border-[#dce2d6] bg-[#f8faf6] px-4 py-3">
            <ShieldCheck
              className="text-[#1f6f50]"
              size={17}
              aria-hidden="true"
            />
            <h3 className="text-sm font-semibold">
              Required for Cubid to work
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead className="bg-[#fbfcfa] text-[#4d594a]">
                <tr>
                  <th className="border-b border-[#e4e8df] px-4 py-3 font-semibold">
                    Variable
                  </th>
                  <th className="border-b border-[#e4e8df] px-4 py-3 font-semibold">
                    Scope
                  </th>
                  <th className="border-b border-[#e4e8df] px-4 py-3 font-semibold">
                    Used for
                  </th>
                  <th className="border-b border-[#e4e8df] px-4 py-3 font-semibold">
                    Where to get it
                  </th>
                </tr>
              </thead>
              <tbody>
                {requiredEnv.map((item) => (
                  <tr className="border-b border-[#edf0e9]" key={item.name}>
                    <td className="px-4 py-3 align-top font-mono text-xs text-[#20362d]">
                      {item.name}
                    </td>
                    <td className="px-4 py-3 align-top text-[#596456]">
                      {item.scope}
                    </td>
                    <td className="px-4 py-3 align-top text-[#596456]">
                      {item.usedFor}
                    </td>
                    <td className="px-4 py-3 align-top text-[#596456]">
                      {item.source}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-[#dce2d6]">
          <div className="border-b border-[#dce2d6] bg-[#f8faf6] px-4 py-3">
            <h3 className="text-sm font-semibold">Optional or flow-specific</h3>
          </div>
          <div className="divide-y divide-[#edf0e9]">
            {optionalEnv.map((item) => (
              <div className="grid gap-2 p-4" key={item.name}>
                <div className="font-mono text-xs font-semibold text-[#20362d]">
                  {item.name}
                </div>
                <div className="text-xs font-medium uppercase tracking-[0.12em] text-[#7b8576]">
                  {item.scope}
                </div>
                <p className="text-sm leading-6 text-[#596456]">
                  {item.usedFor} {item.notes}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
