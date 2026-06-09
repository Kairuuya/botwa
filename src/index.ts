import {
  Browsers,
  extractMessageContent,
  getContentType,
  normalizeMessageContent,
  type WAMessage,
} from "@whiskeysockets/baileys";
import config from "./shared/config/config.js";
import { env } from "./shared/config/env.js";
import { RedisCache } from "./core/cache/redis-cache.js";
import { Client } from "./core/client/client.js";
import logger from "./core/logger/pino.js";
import { RedisClient } from "./core/database/redis.js";
import { CommandValidator } from "./events/message/command-validator.js";
import { MessageHandler } from "./events/message/message.handler.js";
import { MessageSerializer } from "./events/message/message.serialize.js";
import { DatabaseClient } from "./core/database/prisma.js";
import { FileLoader } from "./core/commands/loader.js";
import { GroupService } from "./services/group.service.js";
import { MessageService } from "./services/message.service.js";
import { UserService } from "./services/user.service.js";
import { type CommandConfig } from "./shared/types/index.js";
import { readFileSync } from "node:fs";
import cfonts from "cfonts";
const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf-8"),
);
async function startBot() {
  // ─── Database ──────────────────────────────────────────────────────────
  const databaseClient = new DatabaseClient(
    logger.child({ module: "Database" }),
  );
  const prisma = databaseClient.getClient();

  // ─── Redis ─────────────────────────────────────────────────────────────
  const redisClient = new RedisClient(logger.child({ module: "Redis" }));

  const cache = new RedisCache(
    redisClient.getClient(),
    env.CACHE_DEFAULT_TTL_MS,
    logger.child({ module: "RedisCache" }),
  );

  // ─── Services ──────────────────────────────────────────────────────────
  const userService = new UserService(prisma, cache, logger);
  const groupService = new GroupService(prisma, cache, logger);
  const messageService = new MessageService(prisma, cache, logger);

  const commands = new FileLoader<CommandConfig>({
    folder: "./src/commands",
    recursive: true,
    watch: true,
  });
  commands.loadAll();
  const client = new Client(
    {
      printQRInTerminal: false,
      browser: ["Mac OS", "Chrome", "Chrome 114.0.5735.198"],
      generateHighQualityLinkPreview: true,
      markOnlineOnConnect: true,
      keepAliveIntervalMs: 20000,
      shouldIgnoreJid: (jid) => {
        console.log(jid);
        if (jid.endsWith("@newsletter") || jid === "120363408674735446@g.us") {
          return true;
        }
        return false;
      },
      cachedGroupMetadata: async (jid) => {
        const cached = await groupService.getGroupMetadata(jid);
        if (!cached) return;
        logger.debug(`[Cache] Group metadata found for ${jid}`);
        return cached;
      },
      getMessage: async (key) => {
        if (!key.id) return;
        const cached = await messageService.getMessage(key.id);
        if (!cached?.message) return;
        logger.debug(`[Cache] Message found for ${key.id}`);
        return cached.message;
      },
    },
    { config, prisma, logger },
  );

  await client.connect();

  client.on("client.ready", async (info) => {
    logger.info({ info }, "Client is ready and connected.");

    const userName = client.user?.name ?? "WhatsApp BOT";
    const userId = client.user?.id?.split(":")[0] ?? "Unknown";

    cfonts.say(userName);
    logger.info("Connected!");
    logger.info(`Name    : ${userName}`);
    logger.info(`Number  : ${userId}`);
    logger.info(`Version : ${pkg.version}`);
    logger.info(`WA Ver  : ${info.waVersion}`);
    logger.info(`Latest  : ${info.isLatest ? "YES" : "NO"}`);

    if (config.settings.ownerNotifyOnline && config.ownerNumber.length > 0) {
      const notice =
        `「 *${userName}* 」\n\n` +
        `• Name    : ${userName}\n` +
        `• Number  : ${userId}\n` +
        `• Version : ${pkg.version}\n` +
        `• WA Ver  : ${info.waVersion}\n` +
        `• Latest  : ${info.isLatest ? "YES" : "NO"}\n`;

      logger.info("Sending online notification to owner…");
      try {
        for (const owner of config.ownerNumber) {
          await client.sendMessage(`${owner}@s.whatsapp.net`, {
            text: notice,
          });
        }
        logger.info("Owner notification sent.");
      } catch (err) {
        logger.error({ err }, "Failed to send owner notification.");
      }
    }
  });
  const messageSerializer = new MessageSerializer(client, config, logger);
  const commandValidator = new CommandValidator();
  const messageHandler = new MessageHandler(
    config,
    commands,
    commandValidator,
    { user: userService, group: groupService },
    logger,
  );

  // ─── Message Ingestion ─────────────────────────────────────────────────
  client.on("messages.upsert", async ({ message }) => {
    logger.debug({ message }, "message incoming");
    await messageService.saveMessage(message);
    const msg = await messageSerializer.serialize(message);
    if (!msg) return;
    logger.debug("msg serialized");
    await messageHandler.handle(client, msg);
  });

  // ─── Graceful Shutdown ─────────────────────────────────────────────────
  let isShuttingDown = false;
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info(
      { signal },
      "Received termination signal, initiating graceful shutdown procedure...",
    );
    try {
      if (client) {
        logger.info("Closing WhatsApp connection...");
      }

      logger.info("Closing all Redis connections...");
      await redisClient.destroy();

      logger.info("Disconnecting Prisma PostgreSQL database...");
      await databaseClient.destroy();

      logger.info("Bot gracefully shut down successfully. Goodbye!");
      process.exit(0);
    } catch (error) {
      logger.error({ err: error }, "Clean shutdown failed!");
      process.exit(1);
    }
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  process.on("uncaughtException", (error) => {
    logger.fatal(
      { err: error },
      "FATAL: Uncaught Exception! Application is crashing.",
    );
    shutdown("uncaughtException");
  });

  process.on("unhandledRejection", (reason, promise) => {
    logger.fatal(
      { reason, promise },
      "FATAL: Unhandled Rejection! Uncaught promise rejection encountered.",
    );
    shutdown("unhandledRejection");
  });
}
startBot();
