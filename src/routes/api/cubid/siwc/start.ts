import { createFileRoute } from '@tanstack/react-router'

import { siwcStart } from '#/server/cubid/siwc-handlers'

export const Route = createFileRoute('/api/cubid/siwc/start')({
  server: {
    handlers: {
      GET: ({ request }) => siwcStart(request),
    },
  },
})
