import { Link, createFileRoute } from '@tanstack/react-router'
import { CubidAuthCallback, CubidAuthProvider } from '@cubid/auth-react'

const publicConfig = {
  clientId: import.meta.env.VITE_CUBID_OIDC_CLIENT_ID ?? '',
  issuer: import.meta.env.VITE_CUBID_ISSUER_URL ?? '',
  redirectUri: import.meta.env.VITE_CUBID_REDIRECT_URI ?? '',
}

export const Route = createFileRoute('/auth/callback')({
  component: CubidCallbackPage,
})

function CubidCallbackPage() {
  const isConfigured =
    publicConfig.clientId && publicConfig.issuer && publicConfig.redirectUri

  if (!isConfigured) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f7f4] px-6 text-[#141914]">
        <section className="w-full max-w-lg rounded-lg border border-[#d9ddd2] bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">Cubid callback</h1>
          <p className="mt-3 text-sm leading-6 text-[#596456]">
            Add the browser-safe OIDC values from `.env.example` before using
            the callback route.
          </p>
          <Link
            className="mt-5 inline-flex h-10 items-center rounded-md bg-[#1f6f50] px-4 text-sm font-semibold text-white"
            to="/"
          >
            Back to starter
          </Link>
        </section>
      </main>
    )
  }

  return (
    <CubidAuthProvider
      autoUserInfo
      clientId={publicConfig.clientId}
      issuer={publicConfig.issuer}
      redirectUri={publicConfig.redirectUri}
    >
      <main className="flex min-h-screen items-center justify-center bg-[#f6f7f4] px-6 text-[#141914]">
        <section className="w-full max-w-lg rounded-lg border border-[#d9ddd2] bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">Completing Cubid sign-in</h1>
          <div className="mt-4 rounded-md border border-[#dce2d6] bg-[#f8faf6] p-4 text-sm leading-6">
            <CubidAuthCallback
              loadingFallback="Reading the Cubid callback..."
              successFallback={
                <div>
                  <p>Cubid sign-in is complete.</p>
                  <Link
                    className="mt-3 inline-flex font-semibold text-[#1f6f50] underline-offset-4 hover:underline"
                    to="/"
                  >
                    Return to the starter
                  </Link>
                </div>
              }
            />
          </div>
        </section>
      </main>
    </CubidAuthProvider>
  )
}
