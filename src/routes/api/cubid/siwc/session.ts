import { createFileRoute } from '@tanstack/react-router'

import { siwcSession } from '#/server/cubid/siwc-handlers'

export const Route = createFileRoute('/api/cubid/siwc/session')({
  server: {
    handlers: {
      GET: ({ request }) => siwcSession(request),
    },
  },
})
