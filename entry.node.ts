import { serve } from '@hono/node-server';
import app, { PriceHub } from './server.js';

/**
 * Node has no Durable Objects, so back the binding with a single in-process
 * instance. Production on Workers uses the real DO; the hub code is identical.
 */
function createLocalHubNamespace() {
  const store = new Map<string, unknown>();
  const state = {
    storage: {
      get: async <T>(key: string) => store.get(key) as T | undefined,
      put: async <T>(key: string, value: T) => {
        store.set(key, value);
      },
    },
    blockConcurrencyWhile: async <T>(fn: () => Promise<T>) => fn(),
  };

  const hub = new PriceHub(state);
  const stub = { fetch: (input: string) => hub.fetch(new Request(input)) };

  return {
    idFromName: (name: string) => name,
    get: () => stub,
  };
}

const PRICE_HUB = createLocalHubNamespace();
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

console.log(`Starting Hono backend server on http://localhost:${port}`);
serve({
  fetch: (request: Request) =>
    app.fetch(request, {
      PRICE_HUB,
      ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
    } as unknown as Parameters<typeof app.fetch>[1]),
  port,
});
