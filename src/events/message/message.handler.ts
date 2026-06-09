import { inspect } from "node:util";
import { isJidStatusBroadcast } from "@whiskeysockets/baileys";
import type { Config } from "../../shared/config/config.js";
import type { Client } from "../../core/client/client.js";
import type { Logger } from "../../core/logger/pino.js";
import type { FileLoader } from "../../core/commands/loader.js";
import { t } from "../../shared/locales/index.js";
import type {
    CommandConfig,
    MessageSerialize,
    Services,
} from "../../shared/types/index.js";
import {
    bold,
    findSimilar,
    hiddenMention,
    inlineCode,
    monospace,
    msToTime,
    quote,
} from "../../shared/utils/index.js";
import type { CommandValidator } from "./command-validator.js";
import { Context } from "./context.js";

export class MessageHandler {
    private readonly commandMap: Map<string, CommandConfig>;

    // hardcoded values for findSimilar
    private readonly threshold = 70;
    private readonly limit = 3;

    constructor(
        private readonly config: Config,
        private readonly commands: FileLoader<CommandConfig>,
        private readonly commandValidator: CommandValidator,
        private readonly services: Services,
        private readonly logger: Logger,
    ) {
        this.commandMap = new Map<string, CommandConfig>();
        this.syncCommands();
        this.commands.onChange(() => this.syncCommands());
    }

    /**
     * Map all commands to their respective command objects
     */
    private syncCommands(): void {
        this.commandMap.clear();
        const allCommands = this.commands.getAll();

        for (const cmd of allCommands) {
            if (!cmd.aliases || cmd.aliases.length === 0) continue;
            for (const alias of cmd.aliases) {
                this.commandMap.set(alias.toLowerCase(), cmd);
            }
        }
        this.logger.info(
            {
                totalCommands: allCommands.length,
                totalAliases: this.commandMap.size,
            },
            "Commands synced successfully",
        );
    }

    async handle(client: Client, msg: MessageSerialize): Promise<void> {
        try {
            this.logger.debug(
                {
                    id: msg.id,
                    from: msg.from,
                    sender: msg.sender,
                    shouldCommand: Boolean(msg.prefix && msg.command),
                },
                "Receiving new message",
            );

            // Auto-read status broadcast
            if (
                isJidStatusBroadcast(msg.from) &&
                this.config.settings.autoReadStatus
            ) {
                await client.readMessages([msg.key]);
            }

            if (await this.shouldIgnoreMessage(msg)) return;

            // Auto-read common messages
            if (this.config.settings.autoReadMessage && client.readMessages) {
                await client.readMessages([msg.key]);
            }

            const user = await this.services.user.upsertUser(
                msg.sender,
                msg.lid || "",
                msg.pushName,
            );

            let group = null;
            if (msg.isGroup) {
                group = await this.services.group.getGroup(msg.from);
                if (!group) {
                    group = await this.services.group.upsertGroup(
                        client,
                        msg.from,
                    );
                }
            }

            const context = new Context({
                client,
                msg: msg,
                services: this.services,
                user,
                group,
                logger: this.logger,
            });

            // check if there is a matched command
            const usedCommand =
                this.commandMap.get(msg.command.toLowerCase()) ?? null;

            if (usedCommand) {
                // handle command
                this.logger.debug(
                    { command: msg.command },
                    "Routing to handleCommand",
                );
                await this.handleCommand(context, usedCommand);
            } else if (this.config.settings.suggestSimilarCommands) {
                // if there is a similar command matched, suggest it to user
                this.logger.debug(
                    { command: msg.command },
                    "Routing to suggestSimilarCommands",
                );
                await this.suggestSimilarCommands(context);
            }
        } catch (error) {
            this.logger.error({ err: error }, "Message handler error");
        }
    }

    private async shouldIgnoreMessage(msg: MessageSerialize): Promise<boolean> {
        // Ignore status broadcasts
        if (isJidStatusBroadcast(msg.from)) {
            this.logger.debug(
                {
                    type: msg.type,
                    id: msg.id,
                    from: msg.from,
                },
                "Message ignored: status broadcast",
            );
            return true;
        }

        // Ignore protocolMessage
        if (!msg.type || msg.type === "protocolMessage") {
            this.logger.debug(
                {
                    type: msg.type,
                    message: msg.message,
                },
                "Protocol message received",
            );
            return true;
        }

        // Ignore bot's own messages (except in selfbot or dev/private mode)
        if (
            msg.fromMe &&
            !this.config.settings.selfbot &&
            this.config.settings.publicMode
        ) {
            this.logger.debug("Message ignored: from me/bot");
            return true;
        }

        // Ignore message if not from owner and not from bot (development)
        if (
            !this.config.settings.publicMode &&
            !this.config.ownerNumber.includes(msg.sender.split("@")[0])
        ) {
            this.logger.debug(
                {
                    from: msg.from,
                    sender: msg.sender,
                },
                "Message ignored: Not owner or bot (Private Mode)",
            );
            return true;
        }

        return false;
    }

    private async handleCommand(
        context: Context,
        command: CommandConfig,
    ): Promise<void> {
        // Skip command execution
        if (this.commandValidator.shouldSkipExecution(context)) {
            return;
        }
        // Validate command
        const validation = this.commandValidator.validateCommand(
            context,
            command,
        );
        if (!validation.valid) {
            this.logger.debug(
                {
                    command: context.command,
                    reason: validation.reason,
                },
                "Command validation failed",
            );
            return;
        }
        // Send command help if query is help (ex. .buy help)
        if (context.query === "help") {
            await this.sendCommandHelp(context, command);
            return;
        }
        // Execute command
        if (typeof command.run === "function") {
            const startTime = performance.now();
            try {
                await command.run(context);
                const executionTime = (performance.now() - startTime).toFixed(
                    3,
                );

                this.logger.info(
                    {
                        command: context.command,
                        executionTime,
                    },
                    "Command successfully executed",
                );
            } catch (error) {
                this.logger.error({ err: error }, "Error in command execution");

                const stackTrace =
                    error instanceof Error
                        ? (error.stack?.split("\n").slice(0, 5).join("\n") ??
                          error.message)
                        : inspect(error, { depth: 1 });

                const reportToOwner = `
${bold("REPORT!")}
${bold("Command:")} ${inlineCode(context.command)}
${bold("Input:")} ${inlineCode(context.body.slice(0, 100) || "null")}
${bold("From:")} ${inlineCode(context.from)}
${bold("Sender:")} ${hiddenMention(context.sender, context.sender)}
${bold("Time:")} ${msToTime(Date.now())}

${bold("Stack Trace:")}
${monospace(stackTrace)}
`.trim();

                await Promise.allSettled(
                    this.config.ownerNumber.map((owner) =>
                        context.client.sendText(
                            `${owner}@s.whatsapp.net`,
                            reportToOwner,
                        ),
                    ),
                );

                const fallbackMsg = t(
                    context.user.language,
                    "general",
                    "COMMAND_FAILED",
                );
                await context.reply(fallbackMsg);
                return;
            }
        }
    }

    private async suggestSimilarCommands(context: Context): Promise<void> {
        if (!context.command || typeof context.command !== "string") {
            this.logger.debug(
                { command: context.command },
                "Not a command, skipping suggest",
            );
            return;
        }

        const allCommands = Array.from(this.commandMap.keys());

        if (allCommands.length === 0) return;

        const similar = findSimilar(
            context.command,
            allCommands,
            this.threshold,
            this.limit,
        );
        if (similar.length === 0) return;

        this.logger.debug({ similar }, "Similar commands found");

        // translate text
        const lang = context.user.language;
        const text = t(lang, "general", "COMMAND_SUGGEST", {
            prefix: context.prefix,
            command: context.command,
            suggestions: similar
                .map(
                    (s) => `${quote(inlineCode(`${context.prefix}${s.text}`))}`,
                )
                .join("\n"),
        });

        await context.reply(text);
    }
    private async sendCommandHelp(context: Context, command: CommandConfig) {
        // translate texts
        const lang = context.user.language;
        const text = t(lang, "general", "COMMAND_HELP", {
            name: command.name ?? "-",
            description: command.description ?? "-",
            usage: command.usage ?? "-",
            example: command.example ?? "-",
            aliases: command.aliases.join(", ") ?? "-",
            cooldown: command.cooldown ? `${command.cooldown}s` : "-",
            premium: command.isPremium ? "Yes" : "No",
        });

        await context.reply(text);
    }
}
