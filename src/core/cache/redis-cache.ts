import { Redis } from "ioredis";
import type { ICache } from "../../shared/types/index.js";
import type { Logger } from "../logger/pino.js";

export class RedisCache implements ICache {
    private redis: Redis;
    private readonly defaultTTL: number;
    private logger?: Logger;

    /**
     * @param redis - Pre-configured ioredis instance from RedisConnectionFactory
     * @param logger - Optional pino logger
     * @param defaultTTLMs - Default TTL in milliseconds (default: 5 minutes)
     */
    constructor(redis: Redis, defaultTTLMs?: number, logger?: Logger) {
        this.defaultTTL = defaultTTLMs ?? 5 * 60 * 1000;
        this.logger = logger;
        this.redis = redis;
    }

    /**
     * Checks if a specific key exists in the cache.
     */
    public async has(key: string): Promise<boolean> {
        try {
            const exists = await this.redis.exists(key);
            return exists === 1;
        } catch (err) {
            this.logger?.error({ err, key }, "Failed to check key existence");
            return false;
        }
    }

    /**
     * Stores a typed value in the cache with an expiration time.
     * Under the hood, this uses SETEX for efficiency.
     * * @param key - The cache key
     * @param value - The data to store
     * @param ttlMs - Time to live in milliseconds (falls back to default)
     */
    public async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
        if (!key) throw new Error("Cache key cannot be empty");

        try {
            const ttl = ttlMs ?? this.defaultTTL;
            const ttlSeconds = Math.ceil(ttl / 1000);
            if (ttlSeconds <= 0) {
                await this.redis.set(key, JSON.stringify(value));
            } else {
                await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
            }
        } catch (err) {
            this.logger?.error({ err, key }, "Failed to set cache value");
            throw err;
        }
    }

    /**
     * Retrieves a typed value from the cache.
     */
    public async get<T>(key: string): Promise<T | null> {
        try {
            const data = await this.redis.get(key);
            if (!data) return null;
            return JSON.parse(data) as T;
        } catch (err) {
            this.logger?.error({ err, key }, "Failed to get cache value");
            return null;
        }
    }

    /**
     * Safely deletes a specific key.
     */
    public async delete(key: string): Promise<boolean> {
        try {
            const deleted = await this.redis.del(key);
            return deleted > 0;
        } catch (err) {
            this.logger?.error({ err, key }, "Failed to delete cache key");
            return false;
        }
    }

    /**
     * Updates the expiration time of a key.
     * * @param key - The cache key
     * @param ttlMs - New time to live in milliseconds
     * @returns True if the timeout was set, false if key does not exist
     */
    public async expire(key: string, ttlMs: number): Promise<boolean> {
        try {
            const ttlSeconds = Math.ceil(ttlMs / 1000);
            const result = await this.redis.expire(key, ttlSeconds);
            return result === 1;
        } catch (err) {
            this.logger?.error({ err, key }, "Failed to set key expiration");
            return false;
        }
    }

    /**
     * Retrieves the remaining time to live (TTL) of a key in milliseconds.
     */
    public async ttl(key: string): Promise<number> {
        try {
            const seconds = await this.redis.ttl(key);
            return seconds > 0 ? seconds * 1000 : seconds;
        } catch (err) {
            this.logger?.error({ err, key }, "Failed to get TTL");
            return -2;
        }
    }

    /**
     * Sets a specific field in a Redis Hash.
     * Ideal for updating partial session data without parsing large JSONs.
     */
    public async hSet<T>(
        key: string,
        field: string,
        value: T,
    ): Promise<number> {
        try {
            return await this.redis.hset(key, field, JSON.stringify(value));
        } catch (err) {
            this.logger?.error({ err, key, field }, "Failed to set hash field");
            throw err;
        }
    }

    /**
     * Retrieves a specific field from a Redis Hash.
     */
    public async hGet<T>(key: string, field: string): Promise<T | null> {
        try {
            const data = await this.redis.hget(key, field);
            if (!data) return null;
            return JSON.parse(data) as T;
        } catch (err) {
            this.logger?.error({ err, key, field }, "Failed to get hash field");
            return null;
        }
    }

    /**
     * Pushes a value to the tail (right) of a list.
     * Best practice for appending new AI chat messages.
     */
    public async rPush<T>(key: string, value: T): Promise<number> {
        try {
            return await this.redis.rpush(key, JSON.stringify(value));
        } catch (err) {
            this.logger?.error({ err, key }, "Failed to push to list");
            throw err;
        }
    }

    /**
     * Retrieves a range of elements from a list.
     */
    public async lRange<T>(
        key: string,
        start: number = 0,
        stop: number = -1,
    ): Promise<T[]> {
        try {
            const data = await this.redis.lrange(key, start, stop);
            return data.map((item) => JSON.parse(item) as T);
        } catch (err) {
            this.logger?.error({ err, key }, "Failed to get list range");
            return [];
        }
    }

    /**
     * Retrieves data from cache, or executes the fetcher if missing.
     */
    public async getOrSet<T>(
        key: string,
        fetcher: () => Promise<T> | T,
        ttlMs?: number,
    ): Promise<T> {
        const cached = await this.get<T>(key);
        if (cached !== null) return cached;

        try {
            const freshData = await fetcher();
            await this.set(key, freshData, ttlMs).catch((setErr) => {
                this.logger?.error(
                    { err: setErr, key },
                    "Background cache set failed in getOrSet",
                );
            });
            return freshData;
        } catch (err) {
            this.logger?.error({ err, key }, "Fetcher failed in getOrSet");
            throw err;
        }
    }

    /**
     * Deletes keys matching a pattern using SCAN and UNLINK.
     * UNLINK performs non-blocking deletion, preventing Redis freezes.
     * * @param pattern - Redis key pattern (e.g., 'session:*')
     * @returns Number of successfully deleted keys
     */
    public async deletePattern(pattern: string): Promise<number> {
        try {
            let cursor = "0";
            let deletedCount = 0;

            do {
                // Fetch in batches of 100 to prevent blocking
                const [nextCursor, keys] = await this.redis.scan(
                    cursor,
                    "MATCH",
                    pattern,
                    "COUNT",
                    100,
                );
                cursor = nextCursor;

                if (keys.length > 0) {
                    // Use UNLINK instead of DEL for async memory freeing
                    deletedCount += await this.redis.unlink(...keys);
                }
            } while (cursor !== "0");

            return deletedCount;
        } catch (err) {
            this.logger?.error(
                { err, pattern },
                "Failed to safely delete by pattern",
            );
            return 0;
        }
    }

    /**
     * Increments a counter safely using pipelining.
     */
    public async increment(
        key: string,
        increment: number = 1,
        ttlMs?: number,
    ): Promise<number> {
        try {
            const pipeline = this.redis.pipeline();
            pipeline.exists(key);
            pipeline.incrby(key, increment);

            const results = await pipeline.exec();
            if (!results) throw new Error("Pipeline execution failed");

            const existsResult = results[0][1] as number;
            const incrbyResult = results[1][1] as number;

            // Apply TTL only if the key was just created
            if (existsResult === 0 && ttlMs != null) {
                const ttlSeconds = Math.ceil(ttlMs / 1000);
                await this.redis.expire(key, ttlSeconds);
            }

            return incrbyResult;
        } catch (err) {
            this.logger?.error({ err, key }, "Failed to increment cache value");
            throw err;
        }
    }

    /**
     * Get all keys matching a pattern
     * @param pattern - Redis key pattern
     * @returns Array of matching keys
     */
    public async getKeys(pattern: string): Promise<string[]> {
        try {
            return await this.redis.keys(pattern);
        } catch (err) {
            this.logger?.error({ err, pattern }, "Error getting cache keys");
            return [];
        }
    }
    /**
     * Retrieves server memory and stats info safely.
     */
    public async info(): Promise<Record<string, unknown>> {
        try {
            const info = await this.redis.info();
            const dbsize = await this.redis.dbsize();
            return { info, dbsize, connected: this.redis.status === "ready" };
        } catch (err) {
            this.logger?.error({ err }, "Failed to get cache info");
            return {};
        }
    }

    public async size(): Promise<number> {
        try {
            const dbSize = await this.redis.dbsize();
            return dbSize;
        } catch (err) {
            this.logger?.error({ err }, "Error getting cache size");
            return 0;
        }
    }
    /**
     * Clears the entire Redis database.
     */
    public async clear(): Promise<void> {
        try {
            await this.redis.flushdb();
            this.logger?.warn("Redis cache completely cleared (FLUSHDB)");
        } catch (err) {
            this.logger?.error({ err }, "Failed to clear cache");
            throw err;
        }
    }

    /**
     * Gracefully shuts down the Redis connection.
     */
    public async destroy(): Promise<void> {
        try {
            await this.redis.quit();
            this.logger?.info("Redis connection gracefully closed");
        } catch (err) {
            this.logger?.error(
                { err },
                "Failed to close Redis connection gracefully",
            );
            this.redis.disconnect();
        }
    }
}
