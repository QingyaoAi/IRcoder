export * from "./client.js"
export * from "./server.js"

import { createIrcoderClient } from "./client.js"
import { createIrcoderServer } from "./server.js"
import type { ServerOptions } from "./server.js"

export * as data from "./data.js"

export async function createIrcoder(options?: ServerOptions) {
  const server = await createIrcoderServer({
    ...options,
  })

  const client = createIrcoderClient({
    baseUrl: server.url,
  })

  return {
    client,
    server,
  }
}
