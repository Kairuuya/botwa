import type { Boom } from "@hapi/boom";
import type {
    BaileysEventMap,
    Chat,
    ChatUpdate,
    Contact,
    GroupMetadata,
    MessageUpsertType,
    MessageUserReceiptUpdate,
    proto,
    WACallEvent,
    WAMessage,
    WAMessageKey,
    WAMessageUpdate,
} from "@whiskeysockets/baileys";

/**
 * Events that Client exposes via .on() / .emit().
 *
 * Key differences from BaileysEventMap:
 * - Array events are UNWRAPPED — each item emitted individually
 * - `messages.upsert` emits per-message (singular `message`, not `messages[]`)
 * - `messages.delete` emits per-key (singular `key`, not `keys[]`)
 * - Infrastructure events (`connection.update`, `creds.update`) are excluded
 * - Custom lifecycle events are added (`client.*`)
 */
export type ClientEventMap = {
    [K in keyof ClientEventPayloads]: (
        arg: ClientEventPayloads[K],
    ) => Promise<void> | void;
};

export type ClientEventPayloads = {
    // ── Unwrapped array events (Baileys sends T[], Client emits T per-item) ──
    "chats.upsert": Chat;
    "chats.update": ChatUpdate;
    "chats.delete": string;
    "contacts.upsert": Contact;
    "contacts.update": Partial<Contact>;
    "messages.update": WAMessageUpdate;
    "messages.reaction": {
        key: WAMessageKey;
        reaction: proto.IReaction;
    };
    "messages.media-update": {
        key: WAMessageKey;
        media?: { ciphertext: Uint8Array; iv: Uint8Array };
        error?: Boom;
    };
    "message-receipt.update": MessageUserReceiptUpdate;
    "groups.upsert": GroupMetadata;
    "groups.update": Partial<GroupMetadata>;
    call: WACallEvent;

    // ── Restructured events (unwrapped inner arrays) ──
    "messages.upsert": {
        message: WAMessage;
        type: MessageUpsertType;
        requestId?: string;
    };
    "messages.delete": { key: WAMessageKey } | { jid: string; all: true };

    // ── Pass-through events (already single payloads) ──
    "messaging-history.set": BaileysEventMap["messaging-history.set"];
    "messaging-history.status": BaileysEventMap["messaging-history.status"];
    "chats.lock": BaileysEventMap["chats.lock"];
    "presence.update": BaileysEventMap["presence.update"];
    "group-participants.update": BaileysEventMap["group-participants.update"];
    "group.join-request": BaileysEventMap["group.join-request"];
    "group.member-tag.update": BaileysEventMap["group.member-tag.update"];
    "blocklist.set": BaileysEventMap["blocklist.set"];
    "blocklist.update": BaileysEventMap["blocklist.update"];
    "labels.edit": BaileysEventMap["labels.edit"];
    "labels.association": BaileysEventMap["labels.association"];
    "newsletter.reaction": BaileysEventMap["newsletter.reaction"];
    "newsletter.view": BaileysEventMap["newsletter.view"];
    "newsletter-participants.update": BaileysEventMap["newsletter-participants.update"];
    "newsletter-settings.update": BaileysEventMap["newsletter-settings.update"];
    "lid-mapping.update": BaileysEventMap["lid-mapping.update"];
    "settings.update": BaileysEventMap["settings.update"];
    "message-capping.update": BaileysEventMap["message-capping.update"];

    // ── Custom lifecycle events ──
    /** Emitted once when Client successfully connects (or reconnects). */
    "client.ready": {
        name: string;
        number: string;
        waVersion: string;
        isLatest: boolean;
    };
    /** Emitted when Client begins a reconnection attempt. */
    "client.reconnecting": {
        attempt: number;
        reason: string;
        delayMs: number;
    };
    /** Emitted when Client stops reconnecting (fatal or limit reached). */
    "client.stopped": {
        reason: string;
        statusCode: number;
    };
};
