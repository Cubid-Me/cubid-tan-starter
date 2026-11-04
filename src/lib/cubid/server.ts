/**
 * Server-only Cubid dapp API client. Import this only from server routes or
 * server functions; the env values it reads must never reach the browser.
 */
import { createCubidApiClient } from '@cubid/core'

export type CubidServerConfig = {
  apiKey: string
  baseUrl: string
  dappId?: string
}

const serverEnv = {
  apiKey: 'CUBID_API_KEY',
  baseUrl: 'CUBID_API_BASE_URL',
  dappId: 'CUBID_DAPP_ID',
} as const

export function getCubidServerConfig():
  | { configured: true; config: CubidServerConfig }
  | { configured: false; missing: Array<string> } {
  const missing = [serverEnv.apiKey, serverEnv.baseUrl].filter(
    (key) => !process.env[key]?.trim(),
  )

  if (missing.length > 0) {
    return { configured: false, missing }
  }

  return {
    configured: true,
    config: {
      apiKey: process.env.CUBID_API_KEY!,
      baseUrl: process.env.CUBID_API_BASE_URL!,
      dappId: process.env.CUBID_DAPP_ID,
    },
  }
}

export function createServerCubidClient() {
  const result = getCubidServerConfig()

  if (!result.configured) {
    return result
  }

  return {
    configured: true as const,
    client: createCubidApiClient(result.config),
  }
}
