# 2026-11-07: SIWC flow test, JWT check

The "no compact JWT anywhere" assertion in `src/server/cubid/siwc-flow.test.ts`
matched any `eyJ` substring, which a random encrypted cookie value can
contain, so the test failed about one run in a hundred. It now looks for
three base64url segments whose first decodes to a JSON object. Found in
VerifyMyMeeting, ported here.
