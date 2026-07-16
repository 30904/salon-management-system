export function createTtlCache({ ttlMs = 60_000, maxSize = 500 } = {}) {
  const store = new Map();

  function pruneExpired(now = Date.now()) {
    for (const [key, entry] of store) {
      if (entry.expiresAt <= now) {
        store.delete(key);
      }
    }

    while (store.size > maxSize) {
      const oldestKey = store.keys().next().value;
      store.delete(oldestKey);
    }
  }

  return {
    get(key) {
      const entry = store.get(key);
      if (!entry) {
        return undefined;
      }

      if (entry.expiresAt <= Date.now()) {
        store.delete(key);
        return undefined;
      }

      return entry.value;
    },

    set(key, value, customTtlMs = ttlMs) {
      pruneExpired();
      store.set(key, {
        value,
        expiresAt: Date.now() + customTtlMs,
      });
    },

    delete(key) {
      store.delete(key);
    },

    clear() {
      store.clear();
    },
  };
}
