# Hosted passkey validation

Manual runs of the sign-in flow against the hosted Cubid issuer with a
registered client. The automated suite (`pnpm test`) proves the protocol
against a fake issuer with signed tokens; it cannot perform a passkey
ceremony. Record every manual run here, newest first. Never paste tokens,
codes, cookies, or a pairwise subject.

## Checklist

1. `pnpm dev`, open the app on the exact host registered on the client.
2. **Sign in with Cubid** redirects to the issuer's authorize endpoint with
   `code_challenge`, `nonce`, `state` and `acr_values=urn:cubid:acr:passkey`.
3. The issuer shows the passkey prompt; complete it with a real
   authenticator.
4. The callback lands on `/api/cubid/siwc/callback` and redirects to the
   `return_to` path with no `siwc_error`.
5. The panel shows **Successfully signed in**; the session summary carries
   the app-scoped subject, `claims.email` and `userInfo.email` read
   `[redacted]`, and `trace` has `discovery`, `authorization`, `callback`,
   `token`, `id_token` (`signatureVerified: true`), `userinfo`, `session`.
6. No token, code, verifier, nonce or state appears anywhere in the page,
   the trace, the URL or the cookies.
7. **Sign out** clears the session; the Cubid-hosted logout link (shown
   when discovery has `end_session_endpoint`) ends the issuer session.
8. With `VITE_CUBID_*` set, the browser-only demo signs in through
   `/auth/callback` and prints a redacted session.
9. Health: `/api/cubid/siwc/health` returns the Login deployment fields.

## Runs

| Date       | Issuer                | Client                                   | Host                    | Result                                                                                      |
| ---------- | --------------------- | ---------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------- |
| 2026-11-05 | `https://id.cubid.me` | verifymymeeting local (public web, PKCE) | `http://localhost:3000` | Steps 1-2 pass: authorize redirect reached the passkey prompt. Steps 3-9 not yet performed. |
