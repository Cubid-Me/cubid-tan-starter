# Cubid TanStack Starter

Canonical full-stack [TanStack Start](https://tanstack.com/start) starter for
the modern Cubid public SDK package family from
[`Cubid-Me/cubid-sdk`](https://github.com/Cubid-Me/cubid-sdk). It is the
TanStack sibling of
[`Cubid-Me/cubid-starter-v3`](https://github.com/Cubid-Me/cubid-starter-v3)
(Next.js) and demonstrates the same flows: identity aggregation, proof of
personhood and sybil-defense signals, Login with Cubid, ClearPass Verify, user
notification preferences, and passkey-first wallet recovery.

## Starting A Project: Template Or Fork

This repository is a GitHub template. Either way of starting keeps you able
to merge later starter improvements; they differ in history.

**Template** (the default). Create the repo with **Use this template** or:

```sh
gh repo create my-app --template Cubid-Me/cubid-tan-starter --private --clone
```

GitHub squashes a template's history into one "Initial commit", so a later
`git merge upstream/main` would be an unrelated-history merge. Right after
creating the repo, while it is still untouched, align it to the starter's
history once. This rewrites the new repo's `main`; do it only before anyone
has pushed work there:

```sh
git remote add upstream https://github.com/Cubid-Me/cubid-tan-starter.git
git fetch upstream && git reset --hard upstream/main && git push --force origin main
```

**Fork**, when you want the full history without a force-push, or the
project lives in another organization. Fork on GitHub, clone, then:

```sh
git remote add upstream https://github.com/Cubid-Me/cubid-tan-starter.git
```

From then on, in both cases, pull starter improvements with an ordinary
merge:

```sh
git fetch upstream && git merge upstream/main
```

The client-side sign-in state lives in `src/hooks/use-siwc-session.ts`,
which product apps reuse directly; the demo panel in
`src/components/cubid/siwc-panel.tsx` is built on it. When a derived project
fixes something every Cubid app would want (auth flow, cookie handling,
tooling), port it back here as a PR.

Do not copy wallet-heavy examples, old `cubid-sdk` usage, deprecated
`@cubid/web2` / `@cubid/web2-react` imports, Cubid-generated wallet creation,
or normal Cubid transaction-signing examples from the v1 or v2 starters.

## Supported Runtime

Node 22 or later (`.nvmrc` says 22; CI runs 22 and 24) and pnpm 10
(`packageManager` in `package.json`, so Corepack picks it up). The build
targets the generic Nitro Node server; host presets are added with
`npx @tanstack/cli add <host>`.

## What This Starter Shows

- `@cubid/core` in a server route for dapp API-key calls.
- `@cubid/auth` on the server for a server-mediated Sign in with Cubid (SIWC)
  flow: OIDC discovery, PKCE, code exchange, ID-token validation, encrypted
  session cookies, and a redacted protocol trace.
- `@cubid/auth-react` for browser-only Login with Cubid / OIDC PKCE.
- `@cubid/browser` and `@cubid/react` for hosted ClearPass Verify launchers.
- `@cubid/comms` for signed-in notification channel and preference metadata.
- `@cubid/wallet-recovery` and `@cubid/wallet-recovery-react` for hosted,
  user-authorized recoverable-wallet recovery launchers.

Cubid dapp API keys, service-role keys, and recovery bundle material must stay
out of browser env vars and client bundles.

## Layout

| Path                                  | Purpose                                                                 |
| ------------------------------------- | ----------------------------------------------------------------------- |
| `src/routes/index.tsx`                | Starter page with all demo panels                                       |
| `src/routes/auth/callback.tsx`        | Browser-only OIDC callback page (`@cubid/auth-react`)                   |
| `src/routes/api/cubid/siwc/*.ts`      | Server routes for the SIWC flow; thin wrappers only                     |
| `src/routes/api/cubid/server-demo.ts` | Server route for dapp API demo calls                                    |
| `src/server/cubid/*.ts`               | Handlers on Web `Request`/`Response`; framework-neutral and unit tested |
| `src/lib/cubid/siwc.ts`               | SIWC cookies, redaction, return-path safety                             |
| `src/lib/cubid/server.ts`             | Server-only `@cubid/core` client factory                                |
| `src/lib/http/*.ts`                   | Cookie and response helpers                                             |
| `src/hooks/use-siwc-session.ts`       | Client-side sign-in state (reusable in product apps)                    |
| `src/components/cubid/*.tsx`          | Demo panels                                                             |

Server routes receive a standard `Request` and return a standard `Response`.
The protocol logic lives in `src/server/cubid/` and `src/lib/cubid/` with no
TanStack imports, so it can be reused from any Web-standard server and tested
without the framework.

## Copy-Paste Local Setup

```sh
cp .env.example .env.local
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). If port 3000 is busy,
change the port in `package.json` (`vite dev --port 3000`) and update
`VITE_CUBID_REDIRECT_URI`, `CUBID_SIWC_REDIRECT_URI`, and the Cubid OIDC client
redirect URIs to match before testing Login with Cubid.

## Environment Variables

Browser-safe values use the `VITE_` prefix and can appear in the client
bundle (read them with `import.meta.env.VITE_*`):

```sh
VITE_CUBID_ISSUER_URL=https://id.cubid.me
VITE_CUBID_OIDC_CLIENT_ID=your-oidc-client-id
VITE_CUBID_REDIRECT_URI=http://localhost:3000/auth/callback
VITE_CUBID_PASSPORT_BASE_URL=https://passport.cubid.me
VITE_CUBID_CLEARPASS_PAGE_ID=your-clearpass-page-id
```

Server-only values are read from `process.env` inside server routes:

```sh
CUBID_API_BASE_URL=https://passport.cubid.me
CUBID_API_KEY=your-dapp-api-key
CUBID_DAPP_ID=your-dapp-id
CUBID_SIWC_ISSUER_URL=https://id.cubid.me
CUBID_SIWC_CLIENT_ID=your-oidc-client-id
CUBID_SIWC_REDIRECT_URI=http://localhost:3000/api/cubid/siwc/callback
CUBID_SIWC_SCOPE="openid profile email"
CUBID_SIWC_COOKIE_SECRET=your-random-cookie-encryption-key
CUBID_SIWC_LOGIN_BASE_URL=https://login.cubid.me
```

Never rename server credentials to `VITE_*`. The starter intentionally fails
the server demo with a safe setup response when `CUBID_API_BASE_URL` or
`CUBID_API_KEY` is missing. Read env per request, inside handlers, not at
module scope; edge runtimes inject env at request time.

### Required For Cubid To Work

| Variable                       | Required for                                                                                    | Where to get it                                                                                                               |
| ------------------------------ | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `VITE_CUBID_ISSUER_URL`        | Login with Cubid / OIDC PKCE discovery.                                                         | Cubid issuer URL, usually `https://id.cubid.me`.                                                                              |
| `VITE_CUBID_OIDC_CLIENT_ID`    | Browser sign-in launch and callback handling.                                                   | Create or copy the OIDC client id in [Cubid Admin](https://admin.cubid.me/).                                                  |
| `VITE_CUBID_REDIRECT_URI`      | OIDC callback validation.                                                                       | Use your local callback URL, for example `http://localhost:3000/auth/callback`, and register the same URL on the OIDC client. |
| `VITE_CUBID_PASSPORT_BASE_URL` | Hosted Cubid browser flows such as ClearPass Verify, comms, and recovery launchers.             | Cubid hosted app/API origin, usually `https://passport.cubid.me`.                                                             |
| `CUBID_SIWC_ISSUER_URL`        | Server-mediated SIWC issuer discovery.                                                          | Cubid issuer URL, usually `https://id.cubid.me`.                                                                              |
| `CUBID_SIWC_CLIENT_ID`         | Server-mediated SIWC start and callback routes.                                                 | Create or copy the OIDC client id in [Cubid Admin](https://admin.cubid.me/).                                                  |
| `CUBID_SIWC_REDIRECT_URI`      | Server-mediated SIWC callback handling.                                                         | Use `http://localhost:3000/api/cubid/siwc/callback` locally and register that exact URL on the OIDC client.                   |
| `CUBID_API_BASE_URL`           | Server API demo calls through `@cubid/core`.                                                    | Cubid API origin, usually `https://passport.cubid.me`.                                                                        |
| `CUBID_API_KEY`                | Server-side dapp API calls such as ensure user, identity, score, stamps, and recovery metadata. | Generate or copy your dapp API key in [Cubid Admin](https://admin.cubid.me/). Keep it server-only.                            |

### Optional Or Flow-Specific

| Variable                       | Used for                                              | Notes                                                                                                                                   |
| ------------------------------ | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `CUBID_DAPP_ID`                | Cubid API endpoints that require an explicit dapp id. | Set it if your Cubid environment or API key is scoped by dapp id. Keep it server-only.                                                  |
| `CUBID_SIWC_SCOPE`             | Server-mediated SIWC scopes.                          | Defaults to `openid profile email`. Add scopes only when the consuming app has a clear need and Cubid Admin allows them for the client. |
| `CUBID_SIWC_COOKIE_SECRET`     | Authenticated encryption of SIWC cookies.             | Required in production. Generate with `openssl rand -hex 32`. Development uses a temporary process key when unset.                      |
| `CUBID_SIWC_LOGIN_BASE_URL`    | Optional public Login deployment diagnostic.          | Defaults to `https://login.cubid.me`. Authorization uses issuer discovery independently.                                                |
| `VITE_CUBID_CLEARPASS_PAGE_ID` | ClearPass Verify launcher.                            | Required only for the ClearPass Verify demo. Browser-safe because it identifies a hosted verification page, not a secret.               |

## Cubid OIDC Client Setup

The starter needs one OIDC client per app and environment. The exact
callbacks for local development on port 3000 are:

| Flow                                     | Redirect URI                                    |
| ---------------------------------------- | ----------------------------------------------- |
| Server-mediated SIWC (`CUBID_SIWC_*`)    | `http://localhost:3000/api/cubid/siwc/callback` |
| Browser-only Login with Cubid (`VITE_*`) | `http://localhost:3000/auth/callback`           |
| Post-logout return                       | `http://localhost:3000`                         |

Register them exactly as the browser will send them: scheme, host, port and
path. `localhost` and `127.0.0.1` are different hosts to the issuer, so
register both if you open the app on both (see the cookie prefix note
below). The client id goes into `CUBID_SIWC_CLIENT_ID` (and
`VITE_CUBID_OIDC_CLIENT_ID` for the browser demo).

**In Cubid Admin.** Create the client at [admin.cubid.me](https://admin.cubid.me/)
and paste the redirect URIs from the table.

**By dynamic registration.** The issuer supports OpenID Connect Dynamic
Client Registration; the endpoint is `registration_endpoint` in
`https://id.cubid.me/.well-known/openid-configuration` (currently
`https://id.cubid.me/register`). This registers a public web client (PKCE,
no client secret) and saves the response, which is gitignored by the
`.env*` rule:

```sh
curl -sS -X POST https://id.cubid.me/register \
  -H 'Content-Type: application/json' \
  -d '{
    "client_name": "My App - Local Development",
    "redirect_uris": ["http://localhost:3000/api/cubid/siwc/callback", "http://localhost:3000/auth/callback"],
    "post_logout_redirect_uris": ["http://localhost:3000"],
    "grant_types": ["authorization_code"],
    "token_endpoint_auth_method": "none",
    "scope": "openid profile email"
  }' -o .env.local.siwc.json -w 'HTTP %{http_code}\n'
```

The response's `client_id` is the value for `.env.local`. It also carries a
`registration_access_token` for editing the client later; keep the file out
of version control and out of chat. New clients start `unverified`, which is
fine for development.

For a hosted deployment, register a separate client with the exact
production origin and callbacks, and register preview callbacks separately
and exactly as the host serves them. Never reuse the production callback URL
for previews.

### One cookie prefix per app

The SIWC cookies are named `<prefix>_session`, `<prefix>_txn`,
`<prefix>_trace` and `<prefix>_return_to`, with `cubid_siwc` as the default
prefix. Browsers scope cookies by host and ignore the port, so two starter
apps running on `localhost:3000` and `localhost:3001` with the same prefix
overwrite each other's session: signing in to one signs you out of the
other. Set `CUBID_SIWC_COOKIE_PREFIX` to a short per-app name
(`myapp`) in every derived project, or open the second app on `127.0.0.1`
and register that callback host too.

The server-mediated flow reads every concrete OIDC endpoint from discovery and
rejects discovery metadata whose issuer does not exactly match the configured
issuer (ignoring only a trailing slash). The optional Cubid-hosted logout link
is shown only after discovery provides `end_session_endpoint`. Callback return
targets are normalized as local paths and resolved only when their origin
exactly matches the request origin; authority-like slash and backslash
variants fall back to `/`. Visible session and trace output redacts token
material, authorization codes, PKCE verifiers, nonce/state values, cookies,
and direct PII while retaining protocol facts and the app-scoped pairwise
subject.

## SIWC Panel

The Sign in with Cubid panel starts at **Not signed in yet** and shows
**Successfully signed in** after the verified callback. Set
`CUBID_SIWC_ISSUER_URL` and `CUBID_SIWC_CLIENT_ID`, then register the exact
callback URI `http://localhost:3000/api/cubid/siwc/callback` in
[Cubid Admin](https://admin.cubid.me/). No dapp API key or ClearPass
configuration is needed for this panel.

Cookies contain encrypted, authenticated data, expire within 30 minutes (10
minutes for PKCE transactions), and contain no access, refresh, or ID tokens.
Changing `CUBID_SIWC_COOKIE_SECRET` invalidates them. This short-lived demo
session is not a replacement for application session management.

## Validation

```sh
pnpm check       # prettier
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

CI (`.github/workflows/ci.yml`) runs the same five steps on Node 22 and 24
for every push to `main` and every pull request.

The tests cover the whole server-mediated flow against a fake issuer
(`src/test/fake-issuer.ts`): real P-256 keys, discovery, JWKS, PKCE
checking at the token endpoint, an ID token signed by the issuer and
verified by `@cubid/auth` with nothing mocked but `fetch`, a token signed by
the wrong key, a rejected code, and the `onAuthenticated` hook (extras
stored, oversized or malformed extras refused, a throwing hook). They also
cover missing configuration, mismatched callback state, mismatched ID-token
nonce, configured/discovered issuer mismatch, safe return paths, forged
cookies, the cookie prefix, cookie size bounds, and recursive trace/session
redaction.

### Hosted passkey validation

Passkeys cannot be exercised by automated tests: the ceremony runs in the
user's authenticator against the hosted issuer. Validate it by hand against
a registered client and record the run in
`agent-context/hosted-validation.md` (date, issuer, client, host, result),
separately from the automated suite. The checklist there covers the
authorize redirect, the passkey prompt, the callback, the session summary
and the redacted trace, logout, and the browser-only demo.

## Deployment

The build uses the generic Nitro adapter and produces a self-contained Node
server:

```sh
pnpm build
pnpm start
```

For a host preset (Vercel, Netlify, Cloudflare), run
`npx @tanstack/cli add <host>` and follow the generated notes. Configure the
production OIDC client id, the exact production callback URIs, and
`CUBID_SIWC_COOKIE_SECRET` in the host's environment before enabling sign-in.

## TanStack Start Notes

TanStack Start moves quickly. Versions are pinned in `package.json`; read the
release notes before upgrading, and fetch current docs with
`npx @tanstack/cli doc start framework/react/guide/<page>` rather than relying
on memory. The route tree (`src/routeTree.gen.ts`) is generated on `dev` and
`build` and is committed.

## Application hooks on sign-in

`siwcCallback(request, { onAuthenticated })` accepts an optional hook that
runs after the ID token and userinfo are verified, receives the unredacted
claims, and may return extras stored under `session.app` (for example an
internal account id). The extras go into the encrypted session cookie and
are returned to the browser by `/api/cubid/siwc/session`, so they must be a
plain object of non-secret values under 1 KiB (`maxSessionAppBytes`): ids
and roles, not profiles or tokens. Keys from the redaction list (`email`,
`name`, ...) are redacted inside them too. A larger or malformed result
fails the sign-in with `siwc_error=app_extras_too_large` or
`invalid_app_extras`, a throwing hook with `callback_failed`, and no session
cookie is set. The whole session cookie is capped at 3500 bytes
(`maxCookieValueBytes`). Wrap the hook in your own callback route:

```ts
export const Route = createFileRoute('/api/cubid/siwc/callback')({
  server: {
    handlers: {
      GET: ({ request }) =>
        siwcCallback(request, {
          onAuthenticated: async ({ subject }) => ({
            accountId: await resolveAccount(subject),
          }),
        }),
    },
  },
})
```
