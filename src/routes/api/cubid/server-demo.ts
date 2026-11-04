import { createFileRoute } from '@tanstack/react-router'

import { serverDemo } from '#/server/cubid/server-demo-handler'

export const Route = createFileRoute('/api/cubid/server-demo')({
  server: {
    handlers: {
      POST: ({ request }) => serverDemo(request),
    },
  },
})
