import { Redis, type RedisOptions } from "ioredis";
import { env } from "../../shared/config/env.js";
import type { Logger } from "../logger/pino.js";

function getBaseConfig(): RedisOptions {
  return {
    host: env.REDIS_HOST ?? "localhost",
    port: env.REDIS_PORT ?? 6379,
    password: env.REDIS_PASSWORD || undefined,
    db: env.REDIS_DB ?? 0,
    enableReadyCheck: true,
    retryStrategy: (times: number) => Math.min(times * 100, 3000),
    enableOfflineQueue: true, // Prevents hanging when Redis is down
  };
}

export class RedisClient {
  private client: Redis | null = null;

  constructor(private readonly logger: Logger) {}

  /**
   * Gets the Redis client instance (singleton per class instance)
   */
  public getClient(): Redis {
    if (this.client) {
      return this.client;
    }

    this.client = new Redis(getBaseConfig());

    this.client.on("error", (err: Error) => {
      this.logger.error({ err }, "[Redis] Connection error");
    });

    this.client.on("connect", () => {
      this.logger.info("[Redis] Connected");
    });

    this.client.on("close", () => {
      this.logger.debug("[Redis] Connection closed");
    });

    return this.client;
  }

  /**
   * Gracefully shuts down the Redis connection
   */
  public async destroy(): Promise<void> {
    if (!this.client) return;

    this.logger.info("[Redis] Closing connection");
    try {
      if (this.client.status === "ready") {
        await Promise.race([
          this.client.quit(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Quit timeout")), 2000),
          ),
        ]);
        this.logger.debug("[Redis] Gracefully closed");
      } else {
        this.client.disconnect();
        this.logger.debug(
          `[Redis] Disconnected forcefully (status: ${this.client.status})`,
        );
      }
    } catch (err) {
      this.logger.error(
        { err },
        "[Redis] Error during quit, forcing disconnect",
      );
      this.client.disconnect();
    }

    this.client = null;
  }
}
