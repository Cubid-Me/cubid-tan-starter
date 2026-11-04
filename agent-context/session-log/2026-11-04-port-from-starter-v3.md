# 2026-11-04: port cubid-starter-v3 to TanStack Start

- Scaffolded with `npx @tanstack/cli create` (React, Vite, pnpm, ESLint,
  generic Nitro adapter, no examples). Pinned versions as generated.
- Ported from `Cubid-Me/cubid-starter-v3` at commit `6791ec0`:
  - `src/lib/cubid/siwc-demo.ts` -> `src/lib/cubid/siwc.ts`, rewritten on Web
    `Request`/`Response` with a small cookie helper (`src/lib/http/cookies.ts`).
  - Next route handlers -> plain handlers in `src/server/cubid/` plus thin
    server routes in `src/routes/api/cubid/`.
  - Demo components with `NEXT_PUBLIC_*` -> `VITE_*` and `next/link` -> router
    `Link`. The SIWC panel moved to its own file.
  - Both test files ported; 29 tests pass unchanged in intent.
- Design notes:
  - `Response.redirect()` has immutable headers, so redirects are built by hand
    (`src/lib/http/responses.ts`) to allow `Set-Cookie`.
  - Server env is read only from `process.env`; `VITE_*` values are accepted as
    fallbacks because Start loads `.env` files into `process.env` on the server.
- Validation: `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build` pass.
  Live Cubid sign-in not exercised (no OIDC client registered for this origin).
