import { createFileRoute } from '@tanstack/react-router'

import { siwcHealth } from '#/server/cubid/siwc-handlers'

export const Route = createFileRoute('/api/cubid/siwc/health')({
  server: {
    handlers: {
      GET: () => siwcHealth(),
    },
  },
})
