import { readFileSync } from "node:fs";
import qrcode from "qrcode-terminal";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Boom } from "@hapi/boom";
import type { PrismaClient } from "@prisma/client";
import {
    type AnyMessageContent,
    Browsers,
    type ConnectionState,
    downloadMediaMessage,
    fetchLatestBaileysVersion,
    jidDecode,
    type MessageRelayOptions,
    type MiscMessageGenerationOptions,
    makeCacheableSignalKeyStore,
    makeWASocket,
    type proto,
    toBuffer,
    type UserFacingSocketConfig,
    type WAMessage,
    type WAMessageKey,
    type WASocket,
} from "@whiskeysockets/baileys";
import { parsePhoneNumber } from "awesome-phonenumber";

import EventEmitter from "eventemitter3";
import { pino } from "pino";
import type { Config } from "../../shared/config/config.js";
import type {
    ClientMediaUpload,
    MessageSerialize,
} from "../../shared/types/index.js";
import {
    getFileTypeFromBuffer,
    resolveMedia,
} from "../../shared/utils/index.js";
import { usePrismaAuthState } from "../auth/use-prisma-auth-state.js";
import type { Logger } from "../logger/pino.js";
import { REASON_MAP } from "./constants.js";
import type { ClientEventMap, ClientEventPayloads } from "./events.js";

// Store has been removed and replaced by messageCache

export interface Client extends WASocket {}
export class Client extends EventEmitter<ClientEventMap> {
    private readonly config: Config;
    private readonly socketConfig: Partial<UserFacingSocketConfig>;
    private _socket: WASocket | null;
    private readonly prisma: PrismaClient;
    public logger: Logger;
    private tryConnect = 0;
    private isConnecting = false;

    constructor(
        socketConfig: Partial<UserFacingSocketConfig>,
        options: {
            config: Config;
            prisma: PrismaClient;
            logger: Logger;
        },
    ) {
        super();
        this.config = options.config;
        this.socketConfig = socketConfig;
        this._socket = null;
        this.prisma = options.prisma;
        this.logger = options.logger;

        return new Proxy(this, {
            get(target, prop, receiver) {
                if (prop === "ev" || prop === "ws") return;

                if (prop in target) {
                    const value = Reflect.get(target, prop, receiver);
                    if (typeof value === "function") {
                        return value.bind(target);
                    }
                    return value;
                }

                const socket = target._socket;
                if (socket && prop in socket) {
                    const value = Reflect.get(socket, prop);
                    if (typeof value === "function") {
                        return value.bind(socket);
                    }
                    return value;
                }

                return undefined;
            },
            set(target, prop, value, receiver) {
                if (prop in target) {
                    return Reflect.set(target, prop, value, receiver);
                }
                const socket = target._socket;
                if (socket && prop in socket) {
                    return Reflect.set(socket, prop, value);
                }
                return Reflect.set(target, prop, value, receiver);
            },
        });
    }

    /**
     * Bridges all non-infrastructure Baileys events to the Client's own EventEmitter.
     * Called once per connect/reconnect cycle after socket creation.
     *
     * Each helper method registers a logical group of events, completely type-safe
     * without any 'any' or 'as never' type assertions.
     */
    private bridgeBaileysEvents(): void {
        if (!this._socket) return;
        const ev = this._socket.ev;

        this.registerMessageEvents(ev);
        this.registerChatEvents(ev);
        this.registerGroupEvents(ev);
        this.registerContactEvents(ev);
        this.registerNewsletterEvents(ev);
        this.registerMiscEvents(ev);
    }

    private registerMessageEvents(ev: WASocket["ev"]): void {
        ev.on("messages.upsert", ({ messages, type, requestId }) => {
            for (const message of messages) {
                this.emit("messages.upsert", { message, type, requestId });
            }
        });

        ev.on("messages.delete", (data) => {
            if ("keys" in data) {
                for (const key of data.keys) {
                    this.emit("messages.delete", { key });
                }
            } else {
                this.emit("messages.delete", data);
            }
        });

        ev.on("messages.update", (updates) => {
            for (const update of updates) {
                this.emit("messages.update", update);
            }
        });

        ev.on("messages.reaction", (reactions) => {
            for (const reaction of reactions) {
                this.emit("messages.reaction", reaction);
            }
        });

        ev.on("messages.media-update", (mediaUpdates) => {
            for (const mediaUpdate of mediaUpdates) {
                this.emit("messages.media-update", mediaUpdate);
            }
        });

        ev.on("message-receipt.update", (receipts) => {
            for (const receipt of receipts) {
                this.emit("message-receipt.update", receipt);
            }
        });

        ev.on("message-capping.update", (data) => {
            this.emit("message-capping.update", data);
        });
    }

    private registerChatEvents(ev: WASocket["ev"]): void {
        ev.on("chats.upsert", (chats) => {
            for (const chat of chats) {
                this.emit("chats.upsert", chat);
            }
        });

        ev.on("chats.update", (updates) => {
            for (const update of updates) {
                this.emit("chats.update", update);
            }
        });

        ev.on("chats.delete", (ids) => {
            for (const id of ids) {
                this.emit("chats.delete", id);
            }
        });

        ev.on("chats.lock", (data) => {
            this.emit("chats.lock", data);
        });
    }

    private registerGroupEvents(ev: WASocket["ev"]): void {
        ev.on("groups.upsert", (groups) => {
            for (const group of groups) {
                this.emit("groups.upsert", group);
            }
        });

        ev.on("groups.update", (updates) => {
            for (const update of updates) {
                this.emit("groups.update", update);
            }
        });

        ev.on("group-participants.update", (data) => {
            this.emit("group-participants.update", data);
        });

        ev.on("group.join-request", (data) => {
            this.emit("group.join-request", data);
        });

        ev.on("group.member-tag.update", (data) => {
            this.emit("group.member-tag.update", data);
        });
    }

    private registerContactEvents(ev: WASocket["ev"]): void {
        ev.on("contacts.upsert", (contacts) => {
            for (const contact of contacts) {
                this.emit("contacts.upsert", contact);
            }
        });

        ev.on("contacts.update", (updates) => {
            for (const update of updates) {
                this.emit("contacts.update", update);
            }
        });

        ev.on("presence.update", (data) => {
            this.emit("presence.update", data);
        });
    }

    private registerNewsletterEvents(ev: WASocket["ev"]): void {
        ev.on("newsletter.reaction", (data) => {
            this.emit("newsletter.reaction", data);
        });

        ev.on("newsletter.view", (data) => {
            this.emit("newsletter.view", data);
        });

        ev.on("newsletter-participants.update", (data) => {
            this.emit("newsletter-participants.update", data);
        });

        ev.on("newsletter-settings.update", (data) => {
            this.emit("newsletter-settings.update", data);
        });
    }

    private registerMiscEvents(ev: WASocket["ev"]): void {
        ev.on("messaging-history.set", (data) => {
            this.emit("messaging-history.set", data);
        });

        ev.on("messaging-history.status", (data) => {
            this.emit("messaging-history.status", data);
        });

        ev.on("blocklist.set", (data) => {
            this.emit("blocklist.set", data);
        });

        ev.on("blocklist.update", (data) => {
            this.emit("blocklist.update", data);
        });

        ev.on("labels.edit", (data) => {
            this.emit("labels.edit", data);
        });

        ev.on("labels.association", (data) => {
            this.emit("labels.association", data);
        });

        ev.on("lid-mapping.update", (data) => {
            this.emit("lid-mapping.update", data);
        });

        ev.on("settings.update", (data) => {
            this.emit("settings.update", data);
        });

        ev.on("call", (calls) => {
            for (const call of calls) {
                this.emit("call", call);
            }
        });
    }

    public async clearSession(_keepCreds?: boolean): Promise<void> {
        // This will be overridden in connect()
        this.logger.warn("clearSession called before initialization.");
    }

    public async connect(): Promise<void> {
        if (this.isConnecting) {
            this.logger.debug(
                "Connection attempt already in progress, skipping",
            );
            return;
        }
        this.isConnecting = true;
        if (this._socket) {
            this._socket.ev.removeAllListeners("connection.update");
            this._socket.ev.removeAllListeners("creds.update");
            this._socket.ws?.close();
            this._socket = null;
        }
        const { version, isLatest } = await fetchLatestBaileysVersion();
        const { state, saveCreds, clearSession } = await usePrismaAuthState(
            this.prisma,
            this.config.botNumber,
        );

        this.clearSession = clearSession;
        this._socket = makeWASocket({
            ...this.socketConfig,
            printQRInTerminal: false,
            version,
            logger: pino({ level: "info" }).child({ module: "Baileys" }),
            browser: this.socketConfig.browser || Browsers.windows("Chrome"),
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(
                    state.keys,
                    pino().child({ level: "silent" }),
                ),
            },
        });
        this._socket.ev.on("creds.update", saveCreds);
        this.registerConnectionEvents({
            version,
            isLatest,
            clearSession,
        });
        this._socket.signalRepository;
        this.patchRelayMessage();
        this.bridgeBaileysEvents();
    }

    private registerConnectionEvents(meta: {
        version: (string | number)[];
        isLatest: boolean;
        clearSession: () => Promise<void>;
    }): void {
        this._socket?.ev.on(
            "connection.update",
            async (update: Partial<ConnectionState>) => {
                const { lastDisconnect, connection, qr } = update;

                // Always attempt pairing code when credentials are not yet registered and enabled in config.
                if (
                    !this._socket?.authState?.creds?.registered &&
                    this.config.settings.usePairingCode
                ) {
                    await this.requestPairingCodeSafe();
                }

                if (qr && !this.config.settings.usePairingCode) {
                    this.logger.info("Scan the QR code to connect:");
                    qrcode.generate(qr, { small: true });
                }

                if (connection === "connecting") {
                    this.logger.info("Connecting to WhatsApp...");
                    return;
                }

                if (connection === "open") {
                    await this.onConnected(meta);
                    return;
                }

                if (connection === "close") {
                    await this.onDisconnected(
                        lastDisconnect?.error,
                        meta.clearSession,
                    );
                }
            },
        );
    }

    private async requestPairingCodeSafe(): Promise<void> {
        const phoneNumber = this.config.botNumber.replace(/\D/g, "");
        const pairingCode = this.config.customPairingCode;
        if (!phoneNumber) {
            this.logger.error(
                "Invalid botNumber: cannot request pairing code.",
            );
            return;
        }
        if (!this._socket?.ws?.isOpen) return;

        this.logger.info(`Requesting pairing code for ${phoneNumber}…`);
        try {
            const code = await this._socket.requestPairingCode(
                phoneNumber,
                pairingCode,
            );
            this.logger.info(
                `Pairing code: ${code?.match(/.{1,4}/g)?.join("-") ?? "N/A"}`,
            );
        } catch (err) {
            this.logger.error({ err }, "Failed to request pairing code.");
        }
    }

    private async onConnected(meta: {
        version: (string | number)[];
        isLatest: boolean;
    }): Promise<void> {
        this.tryConnect = 0;

        this.emit("client.ready", {
            name: this.config.botName,
            number: this.config.botNumber,
            waVersion: meta.version.join("."),
            isLatest: meta.isLatest,
        });
    }

    private async onDisconnected(
        error: Error | Boom | undefined,
        clearSession: () => Promise<void>,
    ): Promise<void> {
        const statusCode = new Boom(error).output.statusCode;
        const config = REASON_MAP[statusCode] || {
            label: `Unknown (${statusCode})`,
            action: "retry",
            delay: 3000,
            limit: 2,
        };
        const {
            label,
            action,
            delay: reconnectDelay = 3000,
            limit = 2,
        } = config;

        switch (action) {
            case "stop":
                this.logger.warn(
                    `[${statusCode}] ${label}. Stopping reconnection.`,
                );
                this.isConnecting = false;
                this.emit("client.stopped", { reason: label, statusCode });
                break;

            case "clear":
                this.logger.error(
                    `[${statusCode}] ${label}. Clearing session and stopping.`,
                );
                this.isConnecting = false;
                this.emit("client.stopped", { reason: label, statusCode });
                await clearSession();
                process.exit(1);
                break;

            case "reconnect":
            case "retry": {
                if (action === "retry") {
                    if (this.tryConnect >= limit) {
                        this.logger.error(
                            `[${statusCode}] ${label}. limit retry ${this.tryConnect}/${limit}, Clear session!`,
                        );
                        this.isConnecting = false;
                        await clearSession();
                        return;
                    }
                    this.tryConnect++;
                } else {
                    this.tryConnect = 0;
                }

                this.isConnecting = true;

                const multiplier = action === "retry" ? this.tryConnect : 1;
                const actualDelay = reconnectDelay * multiplier;
                this.logger.info(
                    `[${statusCode}] ${label}. Reconnecting in ${actualDelay}ms...`,
                );
                this.emit("client.reconnecting", {
                    attempt: this.tryConnect,
                    reason: label,
                    delayMs: actualDelay,
                });
                setTimeout(() => {
                    this.isConnecting = false;
                    this.connect().catch((err) =>
                        this.logger.error({ err }, "Reconnect failed!"),
                    );
                }, actualDelay);
                break;
            }
        }
    }
    public async getLIDForPN(pn: string): Promise<string | null> {
        if (!this._socket) throw new Error("Socket not initialized");
        return this._socket.signalRepository.lidMapping.getLIDForPN(pn);
    }
    public async getPNForLID(lid: string): Promise<string | null> {
        if (!this._socket) throw new Error("Socket not initialized");
        return this._socket.signalRepository.lidMapping.getPNForLID(lid);
    }
    /**
     * Wraps `relayMessage` to inject the native-flow `additionalNodes` required
     * for interactive messages to render correctly on modern WA clients.
     */
    private patchRelayMessage(): void {
        if (!this._socket?.relayMessage) {
            throw new Error("relayMessage is not available.");
        }

        const original = this._socket.relayMessage.bind(this._socket);

        this._socket.relayMessage = async (
            jid: string,
            message: proto.IMessage,
            opts: MessageRelayOptions,
        ) => {
            const hasInteractive =
                message.viewOnceMessage?.message?.interactiveMessage != null;

            if (hasInteractive && !opts?.additionalNodes) {
                opts = {
                    ...opts,
                    additionalNodes: [
                        {
                            tag: "biz",
                            attrs: {},
                            content: [
                                {
                                    tag: "interactive",
                                    attrs: { type: "native_flow", v: "1" },
                                    content: [
                                        {
                                            tag: "native_flow",
                                            attrs: { v: "9", name: "mixed" },
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                };
            }

            return original(jid, message, opts);
        };
    }

    public async downloadMediaMessageBuffer(
        m: MessageSerialize,
    ): Promise<Buffer> {
        const stream = await downloadMediaMessage(
            m,
            "stream",
            {},
            { logger: this.logger, reuploadRequest: this.updateMediaMessage },
        );
        return toBuffer(stream);
    }
    public async downloadMediaMessageStream(
        m: MessageSerialize,
    ): Promise<NodeJS.ReadableStream> {
        const stream = await downloadMediaMessage(
            m,
            "stream",
            {},
            { logger: this.logger, reuploadRequest: this.updateMediaMessage },
        );
        return stream;
    }

    public async downloadAndSaveMediaMessage(
        m: MessageSerialize,
        folder: string = tmpdir(),
        attachExtension: boolean = true,
    ): Promise<string> {
        await mkdir(folder, { recursive: true });
        const pathfile = join(
            folder,
            `${m.sender.split("@")[0]}_${Date.now()}`,
        );
        const buffer = await this.downloadMediaMessageBuffer(m);
        const fileType = await getFileTypeFromBuffer(buffer);
        const filePath = attachExtension
            ? `${pathfile}.${fileType?.ext ?? "bin"}`
            : pathfile;
        await writeFile(filePath, buffer);
        return filePath;
    }

    // public sendMediaAsSticker = async (
    //   jid: string,
    //   options: { pack: string; author: string },
    //   buffer: Buffer,
    //   type: StickerType,
    //   quoted?: MessageSerialize,
    // ): Promise<WAMessage> => {
    //   const stickerBuffer = await StickerGenerator.createSticker(buffer, {
    //     type: type ?? "default",
    //     pack: options.pack,
    //     author: options.author,
    //     quality: 80,
    //   });
    //   return this.sendMessage(
    //     jid,
    //     { sticker: stickerBuffer },
    //     { quoted },
    //   ) as Promise<WAMessage>;
    // };

    public decodeJid = (jid: string | undefined): string => {
        if (!jid) return "";
        if (!/:\d+@/i.test(jid)) return jid.trim();
        const decoded = jidDecode(jid);
        return decoded?.user && decoded?.server
            ? `${decoded.user}@${decoded.server}`
            : jid.trim();
    };

    public async sendText(
        jid: string,
        text: string,
        quoted?: MessageSerialize,
        options?: Partial<AnyMessageContent>,
    ): Promise<WAMessage | undefined> {
        return this.sendMessage(jid, { text, ...options }, { quoted });
    }

    public async sendImage(
        jid: string,
        image: ClientMediaUpload,
        caption?: string,
        quoted?: MessageSerialize,
        options?: Partial<AnyMessageContent>,
    ): Promise<WAMessage | undefined> {
        return this.sendMessage(
            jid,
            {
                image: resolveMedia(image),
                caption,
                ...options,
            },
            { quoted },
        );
    }

    public async sendVideo(
        jid: string,
        video: ClientMediaUpload,
        gifPlayback = false,
        caption?: string,
        quoted?: MessageSerialize,
        options?: Partial<AnyMessageContent>,
    ): Promise<WAMessage | undefined> {
        return this.sendMessage(
            jid,
            { video: resolveMedia(video), caption, gifPlayback, ...options },
            { quoted },
        );
    }
    public async sendAudio(
        jid: string,
        audio: ClientMediaUpload,
        ptt: boolean,
        mimetype = "audio/mp4",
        quoted?: MessageSerialize,
        options?: Partial<AnyMessageContent>,
    ): Promise<WAMessage | undefined> {
        return this.sendMessage(
            jid,
            { audio: resolveMedia(audio), ptt, mimetype, ...options },
            { quoted },
        );
    }

    public async sendReaction(
        jid: string,
        emoji: string,
        key: proto.IMessageKey,
    ): Promise<WAMessage | undefined> {
        return this.sendMessage(jid, {
            react: { text: emoji, key },
        });
    }

    public async sendContact(
        jid: string,
        contacts: { jid: string; pushName: string }[],
        quoted?: MessageSerialize,
        options?: Partial<AnyMessageContent>,
    ): Promise<WAMessage | undefined> {
        const listContact = await Promise.all(
            contacts.map(async (c) => {
                const number = c.jid.split("@")[0];
                const name = c.pushName;
                const international = parsePhoneNumber(`+${number}`).number
                    ?.international;
                return {
                    displayName: name ?? number,
                    vcard: [
                        "BEGIN:VCARD",
                        "VERSION:3.0",
                        `N:${name ?? number}`,
                        `FN:${name ?? number}`,
                        `item1.TEL;waid=${number}:${international}`,
                        "item1.X-ABLabel:Mobile",
                        "END:VCARD",
                    ].join("\n"),
                };
            }),
        );

        return this.sendMessage(
            jid,
            {
                contacts: {
                    displayName: `${listContact.length} Kontak`,
                    contacts: listContact,
                },
                ...options,
            },
            { quoted },
        );
    }

    // public sendTemplateButtons = async (
    //   jid: string,
    //   image: ClientMediaUpload | null,
    //   caption: string,
    //   templateButtons: ButtonItem[],
    //   footer?: string,
    //   quoted?: MessageSerialize,
    //   options?: Partial<AnyMessageContent>,
    // ): Promise<WAProto.WebMessageInfo> => {
    //   const content: Record<string, unknown> = {
    //     caption,
    //     templateButtons: templateButtons.filter(
    //       (btn) => Object.keys(btn).length > 0,
    //     ),
    //     footer: footer ?? "",
    //     ...options,
    //   };

    //   if (image) content["image"] = resolveMedia(image);

    //   return this.sendMessage(jid, content as AnyMessageContent, {
    //     quoted,
    //   }) as Promise<WAProto.WebMessageInfo>;
    // };

    // public sendButton = async (
    //   jid: string,
    //   image: ClientMediaUpload | null,
    //   caption: string,
    //   footer: string,
    //   buttons: readonly ButtonItem[],
    //   quoted?: MessageSerialize,
    //   options?: Partial<AnyMessageContent>,
    // ): Promise<WAProto.WebMessageInfo> => {
    //   let imageMessage: proto.Message.IImageMessage | undefined;

    //   if (image) {
    //     const prepared = await this.sendMessage(jid, {
    //       image: resolveMedia(image),
    //     });
    //     imageMessage = prepared?.message?.imageMessage ?? undefined;
    //   }

    //   const templateId = randomDigits(16);

    //   const hydratedButtons: proto.IHydratedTemplateButton[] = buttons.flatMap(
    //     (btn, index): proto.IHydratedTemplateButton[] => {
    //       if ("urlButton" in btn) return [{ index, urlButton: btn.urlButton }];
    //       if ("callButton" in btn) return [{ index, callButton: btn.callButton }];
    //       if ("quickReplyButton" in btn)
    //         return [{ index, quickReplyButton: btn.quickReplyButton }];
    //       return [];
    //     },
    //   );

    //   const templateBase = {
    //     hydratedContentText: caption,
    //     hydratedFooterText: footer,
    //     templateId,
    //     hydratedButtons,
    //     ...(imageMessage ? { imageMessage } : {}),
    //   };

    //   const messageContent = {
    //     viewOnceMessage: {
    //       message: {
    //         templateMessage: {
    //           hydratedFourRowTemplate: templateBase,
    //           hydratedTemplate: templateBase,
    //         },
    //       },
    //     },
    //   };

    //   const msg = generateWAMessageFromContent(jid, messageContent, {
    //     userJid: this.user?.id ?? jid,
    //     quoted: quoted?.message,
    //     ...options,
    //   });

    //   if (!msg?.key) throw new Error("Failed to generate message content.");

    //   await this.relayMessage(jid, msg.message, { messageId: msg.key.id });
    //   return msg as WAProto.WebMessageInfo;
    // };
}
