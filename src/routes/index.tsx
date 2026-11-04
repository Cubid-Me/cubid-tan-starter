import {
  BellRing,
  Fingerprint,
  KeyRound,
  Layers3,
  ShieldCheck,
} from 'lucide-react'

import { createFileRoute } from '@tanstack/react-router'

import { BrowserDemo } from '#/components/cubid/browser-demo'
import { ServerMediatedSiwcPanel } from '#/components/cubid/siwc-panel'
import { EnvReferencePanel } from '#/components/cubid/env-reference-panel'
import { ServerDemo } from '#/components/cubid/server-demo'

const capabilities = [
  {
    icon: Fingerprint,
    label: 'Identity aggregation',
    text: 'Resolve app users, read disclosed stamps, and treat humanity score as an app-scoped signal.',
  },
  {
    icon: ShieldCheck,
    label: 'Proof of personhood',
    text: 'Launch Cubid-hosted verification flows without moving private provider logic into your app.',
  },
  {
    icon: KeyRound,
    label: 'Passkey recovery',
    text: 'Model Cubid as a recovery provider for host-created wallets, not as a wallet generator.',
  },
  {
    icon: BellRing,
    label: 'Unified comms',
    text: 'Let signed-in users manage notification channels and category preferences through the Cubid platform.',
  },
]

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <main className="min-h-screen bg-[#f6f7f4] text-[#141914]">
      <section className="border-b border-[#d9ddd2] bg-[#fdfefb]">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-16">
          <div className="flex flex-col justify-center">
            <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-[#cbd3c2] bg-white px-3 py-1 text-sm font-medium text-[#43513c]">
              <Layers3 size={16} aria-hidden="true" />
              Cubid TanStack starter
            </div>
            <h1 className="max-w-4xl text-5xl font-semibold leading-[1.02] tracking-normal text-[#111611] sm:text-6xl">
              Full-stack identity, verification, comms, and recovery in one
              TanStack Start app.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#485244]">
              This starter demonstrates the modern `@cubid/*` package family
              from `Cubid-Me/cubid-sdk`. Server calls use dapp credentials only
              on server routes. Browser flows use OIDC PKCE, hosted
              verification, notification preferences, and recoverable-wallet
              launchers without exposing server secrets.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {capabilities.map((item) => {
                const Icon = item.icon

                return (
                  <div
                    className="rounded-lg border border-[#d9ddd2] bg-white p-4"
                    key={item.label}
                  >
                    <Icon
                      className="mb-4 text-[#1f6f50]"
                      size={22}
                      aria-hidden="true"
                    />
                    <h2 className="text-base font-semibold text-[#141914]">
                      {item.label}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-[#596456]">
                      {item.text}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="rounded-lg border border-[#cad2c1] bg-[#17251f] p-6 text-[#ecf4e8] shadow-sm">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-[#9bbf91]">
              Starter contract
            </p>
            <div className="mt-6 space-y-5">
              <div>
                <h2 className="text-2xl font-semibold">
                  Cubid is identity first.
                </h2>
                <p className="mt-3 text-sm leading-6 text-[#cad9c5]">
                  Sign-in-with-Cubid is a passkey-enabled add-on. ClearPass
                  Verify, stamps, score, and OIDC claims are identity signals
                  for your app.
                </p>
              </div>
              <div className="grid gap-3 text-sm">
                <p className="rounded-md border border-[#385447] bg-[#20362d] p-3">
                  Dapp API keys stay server-side in `src/routes/api/*` and
                  `src/server/*`.
                </p>
                <p className="rounded-md border border-[#385447] bg-[#20362d] p-3">
                  Wallet examples are recovery-only: no Cubid wallet creation,
                  no normal transaction signing.
                </p>
                <p className="rounded-md border border-[#385447] bg-[#20362d] p-3">
                  v1 and v2 starters are deprecated archive references, not
                  implementation sources.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 pt-8 lg:px-8">
        <ServerMediatedSiwcPanel />
      </div>
      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
        <ServerDemo />
        <BrowserDemo />
      </div>

      <div className="mx-auto max-w-7xl px-6 pb-10 lg:px-8">
        <EnvReferencePanel />
      </div>
    </main>
  )
}
