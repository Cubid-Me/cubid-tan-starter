# 2026-11-07: Delivery-review parity

A review of cubid-starter-v3 (Next.js) listed what this starter lacked.
Checked against the repo and applied where confirmed; see the README for
the user-facing side.

## Applied

- **Cookie prefix per app.** `siwcCookies` now resolves its names at access
  time from `CUBID_SIWC_COOKIE_PREFIX` (default `cubid_siwc`, validated).
  Found in the derived apps: two starter apps on `localhost` shared one
  session cookie and signed each other out, because browsers ignore the
  port. The session cookie is `<prefix>_session` (was
  `cubid_siwc_demo_session`), so existing dev sessions end once; sign in
  again.
- **Bounded, tested `onAuthenticated`.** `assertSessionApp` requires a plain
  object under `maxSessionAppBytes` (1 KiB) and `setSessionCookie` refuses a
  cookie over `maxCookieValueBytes` (3500). Errors surface as
  `siwc_error=app_extras_too_large`, `invalid_app_extras`,
  `session_cookie_too_large`; a throwing hook gives `callback_failed`. No
  session cookie in any of those cases. The hook landed on 2026-11-05 with
  no tests; it has seven now.
- **Fake issuer with signed tokens.** `src/test/fake-issuer.ts`: a P-256
  key pair, discovery, JWKS, a token endpoint that checks the PKCE
  challenge and the code, and userinfo. `siwc-flow.test.ts` runs start,
  callback and session with nothing in `@cubid/auth` mocked (only `fetch`),
  asserts `signatureVerified`, that no token or email reaches headers or
  the summary, and that a token signed by another key and an unknown code
  are rejected.
- **Failure details in the trace.** `redirectWithError` records the
  redacted error payload (`errorCode`, `errorName`, `message`, `status`)
  under the `error` step. The keys are not `code` and `name` because those
  are redaction keys.
- **Browser demo output.** Tokens are described, never printed
  (`describeToken`); claims and userinfo pass through the same redaction
  as the server. Redaction moved to `src/lib/cubid/redact.ts`, which has no
  Node imports, so server and browser share one list.
- **Per-section demo configuration.** The browser demo needs only the three
  OIDC values for sign-in; ClearPass, comms and recovery each say which
  `VITE_` value they are waiting for instead of hiding the whole panel.
- **README.** The duplicated history paragraph is gone. Template-versus-fork
  is documented, with the reset-and-force-push kept as the template path
  and marked as safe only on an untouched repo. Dynamic client registration
  with the exact callbacks, the cookie prefix, the runtime, the hook
  limits, and the validation story are documented.
- **Runtime and CI.** `.nvmrc` (22), `engines` and `packageManager` in
  `package.json`; `.github/workflows/ci.yml` runs check, lint, typecheck,
  test and build on Node 22 and 24.
- **Hosted validation record.** `agent-context/hosted-validation.md` holds
  the manual passkey checklist and a table of runs, separate from the
  automated suite. First row: 2026-11-05, authorize redirect reached the
  passkey prompt; the rest open.

## Not applied, and why

- A browser smoke test runner (Playwright) against the fake issuer: the
  protocol is covered without a browser, and the dependency is heavy for a
  template. Listed in the todo for when a hosted instance exists.
- Replacing the reset guidance outright: both derived apps were created
  that way and it works; the README keeps it with its precondition and
  adds forking beside it.

## Derived apps

`verifymymeeting` and `verifymyresearch` carry identical copies of
`siwc.ts` and `siwc-handlers.ts`, so `git merge upstream/main` applies
cleanly. After merging, set `CUBID_SIWC_COOKIE_PREFIX` (`vmm`, `vmr`) and
rename the literal `cubid_siwc_demo_session` in their copies of
`siwc.test.ts`.

## Validation

`pnpm check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (47 tests),
`pnpm build`.
