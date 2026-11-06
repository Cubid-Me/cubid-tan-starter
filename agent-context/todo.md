# Todo

- [ ] Live-test the SIWC flow against a registered Cubid OIDC client and
      record it in `agent-context/hosted-validation.md` (steps 3-9 open)
- [ ] Deploy a hosted instance (starter.cubid.me sibling) with a host preset
- [ ] Port improvements discovered in derived projects (verifymymeeting, verifymyresearch)
- [ ] Derived apps: merge `upstream/main` to pick up the cookie prefix, the
      `session.app` bounds and the fake-issuer tests; set
      `CUBID_SIWC_COOKIE_PREFIX` per app
- [ ] Browser smoke test (Playwright) against the fake issuer, if the hosted
      instance makes it worth the dependency
