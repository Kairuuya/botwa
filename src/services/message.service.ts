import type { PrismaClient } from "@prisma/client";
import type { WAMessage } from "@whiskeysockets/baileys";
import type { Logger } from "../core/logger/pino.js";
import type { ICache } from "../shared/types/index.js";

export class MessageService {
    private readonly MESSAGE_TTL = 1 * 24 * 60 * 60 * 1000; // 1 day

    constructor(
        readonly _prisma: PrismaClient,
        private readonly cache: ICache,
        private readonly logger?: Logger,
    ) {}

    public async saveMessage(msg: WAMessage): Promise<void> {
        if (!msg.key.id) return;
        try {
            await this.cache.set(
                `message:${msg.key.id}`,
                msg,
                this.MESSAGE_TTL,
            );
        } catch (err) {
            this.logger?.error(
                { err, msgId: msg.key.id },
                "Failed to save message to cache",
            );
        }
    }

    public async getMessage(keyId: string): Promise<WAMessage | null> {
        try {
            return await this.cache.get<WAMessage>(`message:${keyId}`);
        } catch (err) {
            this.logger?.error(
                { err, keyId },
                "Failed to get message from cache",
            );
            return null;
        }
    }
}
