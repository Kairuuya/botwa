import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { env } from "../../shared/config/env.js";
import type { Logger } from "../logger/pino.js";

export class DatabaseClient {
  private client: PrismaClient | null = null;

  constructor(private readonly logger: Logger) {}

  /**
   * Gets the Prisma client instance
   */
  public getClient(): PrismaClient {
    if (this.client) {
      return this.client;
    }

    const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
    this.client = new PrismaClient({
      adapter,
      errorFormat: "pretty",
      log: ["info", "error", "warn"],
    });

    return this.client;
  }

  /**
   * Gracefully disconnects the Prisma database
   */
  public async destroy(): Promise<void> {
    if (!this.client) return;

    this.logger.info("[Database] Disconnecting Prisma PostgreSQL database");
    try {
      await this.client.$disconnect();
    } catch (err) {
      this.logger.error({ err }, "[Database] Error during disconnect");
    }

    this.client = null;
  }
}
