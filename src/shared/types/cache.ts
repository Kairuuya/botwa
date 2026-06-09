export interface ICache {
  /** Check if key exists in cache */
  has(key: string): Promise<boolean>;

  /** Get item from cache */
  get<T>(key: string): Promise<T | null>;

  /** Store item in cache */
  set<T>(key: string, value: T, ttlMs?: number): Promise<void>;

  /** Delete item from cache */
  delete(key: string): Promise<boolean>;

  /** Fetch from cache or execute fetcher to populate if empty */
  getOrSet<T>(key: string, fetcher: () => Promise<T> | T, ttlMs?: number): Promise<T>;

  /** Get total cache items count */
  size(): Promise<number>;

  /** Delete all items matching a wildcard pattern (e.g., 'user:*') */
  deletePattern(pattern: string): Promise<number>;

  /** Get all keys matching a wildcard pattern */
  getKeys(pattern: string): Promise<string[]>;

  /** Increment a counter in cache */
  increment(key: string, increment?: number, ttlMs?: number): Promise<number>;

  /** Get cache statistics */
  info(): Promise<Record<string, unknown>>;

  /** Wipes the entire cache */
  clear(): Promise<void>;

  /** Shuts down client connections or intervals */
  destroy(): Promise<void>;
}
