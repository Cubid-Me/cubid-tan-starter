import { createFileRoute } from '@tanstack/react-router'

import { siwcLogout } from '#/server/cubid/siwc-handlers'

export const Route = createFileRoute('/api/cubid/siwc/logout')({
  server: {
    handlers: {
      POST: ({ request }) => siwcLogout(request),
    },
  },
})
