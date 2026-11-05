# 2026-11-05: SIWC application hooks

Ported from verifymymeeting: `siwcCallback(request, hooks)` with an optional
`onAuthenticated` hook that receives the verified subject, claims, and
userinfo and returns extras stored in `session.app`; `buildSessionSummary`
exposes `session.app`. Lets an app resolve its own account at sign-in
without forking the protocol code.
