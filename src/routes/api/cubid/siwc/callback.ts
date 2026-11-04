import { createFileRoute } from '@tanstack/react-router'

import { siwcCallback } from '#/server/cubid/siwc-handlers'

export const Route = createFileRoute('/api/cubid/siwc/callback')({
  server: {
    handlers: {
      GET: ({ request }) => siwcCallback(request),
    },
  },
})
