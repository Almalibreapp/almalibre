interface CacheEntry {
  data: unknown
  expiry: number
}

const store = new Map<string, CacheEntry>()

/** Return cached value if it exists and hasn't expired, otherwise null. */
export function getCache(key: string): unknown | null {
  const entry = store.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiry) {
    store.delete(key)
    return null
  }
  return entry.data
}

/** Store a value with a TTL in seconds. */
export function setCache(key: string, data: unknown, ttlSeconds: number): void {
  store.set(key, { data, expiry: Date.now() + ttlSeconds * 1000 })
}

/** Clear all entries, or only those whose key contains the given pattern. */
export function clearCache(pattern?: string): void {
  if (!pattern) {
    store.clear()
    return
  }
  for (const key of store.keys()) {
    if (key.includes(pattern)) store.delete(key)
  }
}
