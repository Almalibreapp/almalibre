interface CacheEntry {
  data: unknown
  expiry: number
}

const store = new Map<string, CacheEntry>()

export function getCache(key: string): unknown | null {
  const entry = store.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiry) {
    store.delete(key)
    return null
  }
  return entry.data
}

export function setCache(key: string, data: unknown, ttlSeconds: number): void {
  store.set(key, { data, expiry: Date.now() + ttlSeconds * 1000 })
}

export function clearCache(pattern?: string): void {
  if (!pattern) {
    store.clear()
    return
  }
  for (const key of store.keys()) {
    if (key.includes(pattern)) store.delete(key)
  }
}
