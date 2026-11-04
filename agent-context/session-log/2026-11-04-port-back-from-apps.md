# 2026-11-04: improvements ported back from derived apps

Found while deriving `verifymymeeting` and `verifymyresearch` from this
template:

- Extracted the client-side sign-in state into `src/hooks/use-siwc-session.ts`
  (`session`, `status`, `error`, `signIn`, `signOut`, `reload`). The SIWC demo
  panel now uses the hook; product apps use the hook without the panel.
- README: GitHub template creation squashes history, so derived repos should
  `git reset --hard upstream/main` once before diverging, to keep
  `git merge upstream/main` an ordinary merge.
