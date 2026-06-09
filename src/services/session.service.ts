import type { PrismaClient } from "@prisma/client";
import type { RedisCache } from "../core/cache/redis-cache.js";
import type { SessionData } from "../shared/types/index.js";

/**
 * Highly reusable Generic Session Management Service.
 * Implements Write-Behind caching strategy for any domain model.
 * @template T - Strict type definition for the domain-specific payload.
 */

// biome-ignore lint/suspicious/noExplicitAny: general data
export class SessionService<T extends Record<string, any>> {
    /**
     * @param cache - RedisCache instance.
     * @param prisma - PrismaClient instance.
     * @param keyPrefix - Domain-specific prefix (e.g., 'auth:session:', 'cart:').
     * @param defaultTtlMs - Expiration time in milliseconds.
     */
    constructor(
        private readonly cache: RedisCache,
        private readonly prisma: PrismaClient,
        private readonly keyPrefix: string,
        private readonly defaultTtlMs: number = 60 * 60 * 1000,
    ) {}

    private buildKey(sessionId: string): string {
        return `${this.keyPrefix}${sessionId}`;
    }

    /**
     * Retrieves a session safely with cache-first strategy.
     */
    public async getSession(sessionId: string): Promise<SessionData<T> | null> {
        const key = this.buildKey(sessionId);

        try {
            const cachedSession = await this.cache.get<SessionData<T>>(key);

            if (cachedSession) {
                await this.cache.expire(key, this.defaultTtlMs);
                return cachedSession;
            }

            // Fallback to PostgreSQL (Assumes you have a generic 'session' table)
            const dbSession = await this.prisma.session.findUnique({
                where: { id: sessionId },
            });

            if (dbSession?.payload) {
                const rehydratedData: SessionData<T> = {
                    id: dbSession.id,
                    data: dbSession.payload as unknown as T,
                    createdAt: dbSession.createdAt.getTime(),
                    updatedAt: dbSession.updatedAt.getTime(),
                };

                await this.cache.set(key, rehydratedData, this.defaultTtlMs);
                return rehydratedData;
            }

            return null;
        } catch (error) {
            throw new Error(
                `[SessionService:${this.keyPrefix}] Critical failure retrieving session: ${(error as Error).message}`,
            );
        }
    }

    /**
     * Upserts a session using Write-Behind pattern.
     */
    public async saveSession(
        sessionId: string,
        payload: T,
        ttlMs?: number,
    ): Promise<void> {
        const key = this.buildKey(sessionId);
        const now = Date.now();

        const sessionData: SessionData<T> = {
            id: sessionId,
            data: payload,
            createdAt: now,
            updatedAt: now,
        };

        try {
            await this.cache.set(key, sessionData, ttlMs ?? this.defaultTtlMs);

            // Async DB Sync (Fire and forget)
            this.syncToDatabase(sessionData).catch((dbErr) => {
                console.error(
                    `[SessionService:${this.keyPrefix}] Background DB sync failed`,
                    dbErr,
                );
            });
        } catch (_err) {
            throw new Error(
                `[SessionService:${this.keyPrefix}] Failed to persist session to cache`,
            );
        }
    }

    /**
     * Destroys a session concurrently from cache and database.
     */
    public async destroySession(sessionId: string): Promise<void> {
        const key = this.buildKey(sessionId);

        try {
            await Promise.all([
                this.cache.delete(key),
                // deleteMany silently returns {count: 0} if no record exists,
                // unlike delete() which throws P2025 and pollutes Prisma error logs.
                this.prisma.session.deleteMany({ where: { id: sessionId } }),
            ]);
        } catch (_err) {
            throw new Error(
                `[SessionService:${this.keyPrefix}] Failed to cleanly destroy session`,
            );
        }
    }

    /**
     * Background worker to sync data to persistent DB.
     */
    private async syncToDatabase(sessionData: SessionData<T>): Promise<void> {
        await this.prisma.session.upsert({
            where: { id: sessionData.id },
            update: {
                payload: sessionData.data,
                updatedAt: new Date(sessionData.updatedAt),
            },
            create: {
                id: sessionData.id,
                payload: sessionData.data,
                createdAt: new Date(sessionData.createdAt),
                updatedAt: new Date(sessionData.updatedAt),
            },
        });
    }
    /**
     * Partially updates a session's payload.
     * Highly efficient for updating specific flags without replacing the entire object.
     * @param sessionId - Unique identifier for the session.
     * @param partialData - The subset of data to merge into the existing session.
     */
    public async updatePartial(
        sessionId: string,
        partialData: Partial<T>,
    ): Promise<void> {
        const existingSession = await this.getSession(sessionId);

        if (!existingSession) {
            throw new Error(
                `[SessionService:${this.keyPrefix}] Cannot update. Session ${sessionId} does not exist.`,
            );
        }

        // Merge existing data with the new partial data
        const updatedPayload = { ...existingSession.data, ...partialData };

        // Persist the merged data using the existing save logic
        await this.saveSession(sessionId, updatedPayload as T);
    }

    /**
     * Ultra-fast O(1) check to verify if a session exists.
     * Checks Redis cache first. If missing, runs a lightweight count query on DB.
     * @param sessionId - Unique identifier for the session.
     * @returns Boolean indicating presence of the session.
     */
    public async exists(sessionId: string): Promise<boolean> {
        const key = this.buildKey(sessionId);

        // 1. Fast Cache Check
        const inCache = await this.cache.has(key);
        if (inCache) return true;

        // 2. Fallback DB Check (Optimized count query, doesn't fetch payload)
        const inDb = await this.prisma.session.count({
            where: { id: sessionId },
        });

        return inDb > 0;
    }

    /**
     * Resets the TTL (Time-To-Live) of a session in the cache.
     * Acts as a "Keep-Alive" ping without reading or writing payload data.
     * @param sessionId - Unique identifier for the session.
     */
    public async refreshExpiration(sessionId: string): Promise<void> {
        const key = this.buildKey(sessionId);

        const extended = await this.cache.expire(key, this.defaultTtlMs);

        // If not in cache, we pull from DB to rehydrate and set TTL
        if (!extended) {
            const existsInDb = await this.exists(sessionId);
            if (existsInDb) {
                // Calling getSession will automatically rehydrate the cache with fresh TTL
                await this.getSession(sessionId);
            }
        }
    }
}
