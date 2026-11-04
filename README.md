# Cubid TanStack Starter

Canonical full-stack [TanStack Start](https://tanstack.com/start) starter for
the modern Cubid public SDK package family from
[`Cubid-Me/cubid-sdk`](https://github.com/Cubid-Me/cubid-sdk). It is the
TanStack sibling of
[`Cubid-Me/cubid-starter-v3`](https://github.com/Cubid-Me/cubid-starter-v3)
(Next.js) and demonstrates the same flows: identity aggregation, proof of
personhood and sybil-defense signals, Login with Cubid, ClearPass Verify, user
notification preferences, and passkey-first wallet recovery.

This repository is a GitHub template. Create a project from it with
**Use this template**, or with the GitHub CLI:

```sh
gh repo create my-app --template Cubid-Me/cubid-tan-starter --private --clone
```

To keep pulling starter improvements into a derived project, add this repo as
an `upstream` remote and merge:

```sh
git remote add upstream https://github.com/Cubid-Me/cubid-tan-starter.git
git fetch upstream && git merge upstream/main
```

GitHub squashes a template's history into a single "Initial commit", which
makes later merges unrelated-history merges. Right after creating the repo,
while it is still unchanged, align it to the starter's history once:

```sh
git fetch upstream && git reset --hard upstream/main && git push --force origin main
```

After that, `git merge upstream/main` is an ordinary merge. The client-side
sign-in state lives in `src/hooks/use-siwc-session.ts`, which product apps
reuse directly; the demo panel in `src/components/cubid/siwc-panel.tsx` is
built on it.

GitHub squashes a template's history into a single "Initial commit", which
makes later merges unrelated-history merges. Right after creating the repo,
while it is still unchanged, align it to the starter's history once:

```sh
git fetch upstream && git reset --hard upstream/main && git push --force origin main
```

After that, `git merge upstream/main` is an ordinary merge. The client-side
sign-in state lives in `src/hooks/use-siwc-session.ts`, which product apps
reuse directly; the demo panel in `src/components/cubid/siwc-panel.tsx` is
built on it.

Do not copy wallet-heavy examples, old `cubid-sdk` usage, deprecated
`@cubid/web2` / `@cubid/web2-react` imports, Cubid-generated wallet creation,
or normal Cubid transaction-signing examples from the v1 or v2 starters.

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

## Cubid Console Setup

Create or configure an OIDC client in Cubid with:

- Issuer URL: the Cubid issuer, for example `https://id.cubid.me`.
- Client id: copied into `VITE_CUBID_OIDC_CLIENT_ID` and `CUBID_SIWC_CLIENT_ID`.
- Browser callback redirect URI: `http://localhost:3000/auth/callback` for the
  browser-only demo.
- Server SIWC callback redirect URI:
  `http://localhost:3000/api/cubid/siwc/callback` for the server-mediated
  flow.
- Post-logout redirect URI: `http://localhost:3000` for local dev.

For a hosted deployment, register the exact production origin and callback
URIs, and register preview callbacks separately and exactly as the host serves
them. Never reuse the production callback URL for previews.

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
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

The tests cover missing configuration, mismatched callback state, mismatched
ID-token nonce, configured/discovered issuer mismatch, safe return paths,
forged cookies, and recursive trace/session redaction.

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
