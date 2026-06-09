type CacheEntry<T> = {
  value: T;
  expiry: number;
  lastAccess: number;
};

import type { ICache } from '../../shared/types/index.js';

/**
 * Memory-based Cache (Map implementation)
 */
export class MemoryCache implements ICache {
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private readonly defaultTTL: number;
  private readonly maxSize: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(defaultTTLMs: number = 5 * 60 * 1000, maxSize: number = 5000) {
    this.defaultTTL = defaultTTLMs;
    this.maxSize = maxSize;

    this.cleanupInterval = setInterval(() => this.clearExpired(), 60 * 1000);
  }

  public async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return false;
    }

    entry.lastAccess = Date.now();
    return true;
  }

  public async delete(key: string): Promise<boolean> {
    return this.cache.delete(key);
  }

  public async size(): Promise<number> {
    return this.cache.size;
  }

  public async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    if (!key) throw new Error('Cache key cannot be empty');

    if (this.cache.size >= this.maxSize) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;

      for (const [k, entry] of this.cache) {
        if (entry.lastAccess < oldestTime) {
          oldestTime = entry.lastAccess;
          oldestKey = k;
        }
      }

      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    const expiry = Date.now() + (ttlMs ?? this.defaultTTL);
    this.cache.set(key, {
      value,
      expiry,
      lastAccess: Date.now(),
    });
  }

  public async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    // Update lastAccess for LRU
    entry.lastAccess = Date.now();
    return entry.value as T;
  }

  /**
   * Retrieves data from cache, or fetches it using the provided fetcher function
   * if the data is missing or has expired. Then stores the fresh data in cache.
   *
   * @param key - The cache key
   * @param fetcher - Async function to fetch fresh data when cache misses
   * @param ttlMs - Optional custom TTL for this entry
   * @returns The cached or freshly fetched data
   */
  public async getOrSet<T>(key: string, fetcher: () => Promise<T> | T, ttlMs?: number): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const freshData = await fetcher();
    await this.set(key, freshData, ttlMs);
    return freshData;
  }

  /**
   * Delete all keys matching a pattern
   * @param pattern - Key pattern (e.g., 'group:*', 'user:*')
   * @returns Number of keys deleted
   */
  public async deletePattern(pattern: string): Promise<number> {
    const regex = new RegExp(`^${pattern.replaceAll('*', '.*')}$`);
    let deleted = 0;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        deleted++;
      }
    }

    return deleted;
  }

  /**
   * Get all keys matching a pattern
   * @param pattern - Key pattern
   * @returns Array of matching keys
   */
  public async getKeys(pattern: string): Promise<string[]> {
    const regex = new RegExp(`^${pattern.replaceAll('*', '.*')}$`);
    const keys: string[] = [];

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keys.push(key);
      }
    }

    return keys;
  }

  /**
   * Increment a counter in cache
   * @param key - The cache key
   * @param increment - Amount to increment (default 1)
   * @param ttlMs - TTL if the key is new
   * @returns New value
   */
  public async increment(key: string, increment: number = 1, ttlMs?: number): Promise<number> {
    const entry = this.cache.get(key);
    let value: number;

    if (entry && Date.now() <= entry.expiry) {
      if (typeof entry.value === 'number') {
        value = entry.value + increment;
      } else {
        value = increment;
      }
    } else {
      // Entry does not exist or has expired
      value = increment;
    }
    await this.set(key, value, ttlMs);
    return value;
  }

  /**
   * Get cache statistics
   */
  public async info(): Promise<Record<string, unknown>> {
    const stats = {
      size: this.cache.size,
      maxSize: this.maxSize,
      defaultTTL: this.defaultTTL,
      utilization: `${((this.cache.size / this.maxSize) * 100).toFixed(2)}%`,
    };

    return stats;
  }

  /**
   * Clear all cache data
   */
  public async clear(): Promise<void> {
    this.cache.clear();
  }

  /**
   * Manual cleanup expired entries
   */
  public clearExpired(): void {
    const now = Date.now();

    for (const [key, entry] of this.cache) {
      if (now > entry.expiry) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Graceful shutdown
   */
  public async destroy(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
  }
}
