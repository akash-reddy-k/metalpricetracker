/**
 * Minimal structural types for the Workers runtime features we use.
 *
 * Pulling in the full @cloudflare/workers-types globally collides with @types/node
 * on Request/Response/fetch. These interfaces are satisfied structurally by the
 * real runtime and by the in-process shim used for local Node development.
 */

export interface HubStorage {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
}

export interface HubState {
  storage: HubStorage;
  blockConcurrencyWhile<T>(fn: () => Promise<T>): Promise<T>;
}

export interface HubStub {
  fetch(input: string): Promise<Response>;
}

export interface HubNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): HubStub;
}

/** Present only on Workers; used to detect which WebSocket connect path to take. */
export function isWorkersRuntime(): boolean {
  return 'WebSocketPair' in globalThis;
}

interface CacheLike {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

interface CacheStorageLike {
  open(name: string): Promise<CacheLike>;
}

/** Returns the edge cache when running on Workers, otherwise null. */
export async function openCache(name: string): Promise<CacheLike | null> {
  const store = (globalThis as { caches?: CacheStorageLike }).caches;
  if (!store?.open) return null;
  try {
    return await store.open(name);
  } catch {
    return null;
  }
}
