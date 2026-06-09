import { areJidsSameUser, getContentType, proto, type WAMessage } from '@whiskeysockets/baileys';
import type { Config } from '../../shared/config/config.js';
import type { Client } from '../../core/client/client.js';
import type { Logger } from '../../core/logger/pino.js';
import type { MessageSerialize } from '../../shared/types/index.js';

// Tambah wrapper baru cukup di sini — WrapperKey & WRAPPER_SET auto-update

const WRAPPER_EXTRACTORS = {
  viewOnceMessage: (msg: proto.IMessage) => msg.viewOnceMessage?.message,
  viewOnceMessageV2: (msg: proto.IMessage) => msg.viewOnceMessageV2?.message,
  viewOnceMessageV2Extension: (msg: proto.IMessage) => msg.viewOnceMessageV2Extension?.message,
  ephemeralMessage: (msg: proto.IMessage) => msg.ephemeralMessage?.message,
  documentWithCaptionMessage: (msg: proto.IMessage) => msg.documentWithCaptionMessage?.message,
  editedMessage: (msg: proto.IMessage) => msg.editedMessage?.message,
  associatedChildMessage: (msg: proto.IMessage) => msg.associatedChildMessage?.message,
  limitSharingMessage: (msg: proto.IMessage) => msg.limitSharingMessage?.message,
  botTaskMessage: (msg: proto.IMessage) => msg.botTaskMessage?.message,
  groupStatusMessageV2: (msg: proto.IMessage) => msg.groupStatusMessageV2?.message,
  statusMentionMessage: (msg: proto.IMessage) => msg.statusMentionMessage?.message,
  groupStatusMentionMessage: (msg: proto.IMessage) => msg.groupStatusMentionMessage?.message,
  groupMentionedMessage: (msg: proto.IMessage) => msg.groupMentionedMessage?.message,
  deviceSentMessage: (msg: proto.IMessage) => msg.deviceSentMessage?.message,
  commentMessage: (msg: proto.IMessage) => msg.commentMessage?.message,
  eventCoverImage: (msg: proto.IMessage) => msg.eventCoverImage?.message,
  pollCreationOptionImageMessage: (msg: proto.IMessage) =>
    msg.pollCreationOptionImageMessage?.message,
  pollCreationMessageV4: (msg: proto.IMessage) => msg.pollCreationMessageV4?.message,
  statusAddYours: (msg: proto.IMessage) => msg.statusAddYours?.message,
  groupStatusMessage: (msg: proto.IMessage) => msg.groupStatusMessage?.message,
  questionMessage: (msg: proto.IMessage) => msg.questionMessage?.message,
  botForwardedMessage: (msg: proto.IMessage) => msg.botForwardedMessage?.message,
  questionReplyMessage: (msg: proto.IMessage) => msg.questionReplyMessage?.message,
  botInvokeMessage: (msg: proto.IMessage) => msg.botInvokeMessage?.message,
  lottieStickerMessage: (msg: proto.IMessage) => msg.lottieStickerMessage?.message,

  // Non-standard — inner message bukan di .message
  sendPaymentMessage: (msg: proto.IMessage) => msg.sendPaymentMessage?.noteMessage,
} satisfies Partial<
  Record<keyof proto.IMessage, (msg: proto.IMessage) => proto.IMessage | null | undefined>
>;

type WrapperKey = keyof typeof WRAPPER_EXTRACTORS;

const WRAPPER_SET = new Set<string>(Object.keys(WRAPPER_EXTRACTORS));

// Hover UnhandledWrappers untuk tahu wrapper baru dari proto yang belum di regis di WRAPPER_EXTRACTORS
// type WrapperLikeKeys = {
//     [K in keyof Required<proto.IMessage>]: NonNullable<
//         Required<proto.IMessage>[K]
//     > extends { message?: proto.IMessage | null | undefined }
//         ? K
//         : never;
// }[keyof proto.IMessage];
// type UnhandledWrappers = Exclude<WrapperLikeKeys, WrapperKey>;

const TEXT_EXTRACTORS = {
  conversation: (msg: proto.IMessage) => msg.conversation,
  extendedTextMessage: (msg: proto.IMessage) => msg.extendedTextMessage?.text,
  imageMessage: (msg: proto.IMessage) => msg.imageMessage?.caption,
  videoMessage: (msg: proto.IMessage) => msg.videoMessage?.caption,
  documentMessage: (msg: proto.IMessage) => msg.documentMessage?.caption,
  ptvMessage: (msg: proto.IMessage) => msg.ptvMessage?.caption,
  locationMessage: (msg: proto.IMessage) => msg.locationMessage?.comment,
  contactMessage: (msg: proto.IMessage) => msg.contactMessage?.displayName,
  listMessage: (msg: proto.IMessage) => msg.listMessage?.description,
  buttonsMessage: (msg: proto.IMessage) => msg.buttonsMessage?.contentText,
  interactiveMessage: (msg: proto.IMessage) => msg.interactiveMessage?.body?.text,
  pollCreationMessage: (msg: proto.IMessage) => msg.pollCreationMessage?.name,
  reactionMessage: (msg: proto.IMessage) => msg.reactionMessage?.text,
  groupInviteMessage: (msg: proto.IMessage) => msg.groupInviteMessage?.caption,
  eventMessage: (msg: proto.IMessage) => msg.eventMessage?.name,
  templateMessage: (msg: proto.IMessage) =>
    msg.templateMessage?.hydratedTemplate?.hydratedContentText,
  newsletterAdminInviteMessage: (msg: proto.IMessage) =>
    msg.newsletterAdminInviteMessage?.newsletterName,
} satisfies Partial<
  Record<keyof proto.IMessage, (msg: proto.IMessage) => string | null | undefined>
>;

type TextExtractableKey = keyof typeof TEXT_EXTRACTORS;

const CONTEXT_INFO_EXTRACTORS = {
  extendedTextMessage: (msg: proto.IMessage) => msg.extendedTextMessage?.contextInfo,
  imageMessage: (msg: proto.IMessage) => msg.imageMessage?.contextInfo,
  videoMessage: (msg: proto.IMessage) => msg.videoMessage?.contextInfo,
  documentMessage: (msg: proto.IMessage) => msg.documentMessage?.contextInfo,
  audioMessage: (msg: proto.IMessage) => msg.audioMessage?.contextInfo,
  stickerMessage: (msg: proto.IMessage) => msg.stickerMessage?.contextInfo,
  locationMessage: (msg: proto.IMessage) => msg.locationMessage?.contextInfo,
  contactMessage: (msg: proto.IMessage) => msg.contactMessage?.contextInfo,
  listMessage: (msg: proto.IMessage) => msg.listMessage?.contextInfo,
  buttonsMessage: (msg: proto.IMessage) => msg.buttonsMessage?.contextInfo,
  interactiveMessage: (msg: proto.IMessage) => msg.interactiveMessage?.contextInfo,
  templateMessage: (msg: proto.IMessage) => msg.templateMessage?.contextInfo,
  // reactionMessage: (msg: proto.IMessage) => msg.reactionMessage?.contextInfo,
  pollCreationMessage: (msg: proto.IMessage) => msg.pollCreationMessage?.contextInfo,
  ptvMessage: (msg: proto.IMessage) => msg.ptvMessage?.contextInfo,
} satisfies Partial<
  Record<keyof proto.IMessage, (msg: proto.IMessage) => proto.IContextInfo | null | undefined>
>;

type ContextInfoKey = keyof typeof CONTEXT_INFO_EXTRACTORS;

const EXPIRATION_EXTRACTORS = {
  extendedTextMessage: (msg: proto.IMessage) => msg.extendedTextMessage?.contextInfo?.expiration,
  imageMessage: (msg: proto.IMessage) => msg.imageMessage?.contextInfo?.expiration,
  videoMessage: (msg: proto.IMessage) => msg.videoMessage?.contextInfo?.expiration,
  documentMessage: (msg: proto.IMessage) => msg.documentMessage?.contextInfo?.expiration,
  audioMessage: (msg: proto.IMessage) => msg.audioMessage?.contextInfo?.expiration,
  stickerMessage: (msg: proto.IMessage) => msg.stickerMessage?.contextInfo?.expiration,
} satisfies Partial<
  Record<keyof proto.IMessage, (msg: proto.IMessage) => number | null | undefined>
>;

type ExpirationKey = keyof typeof EXPIRATION_EXTRACTORS;

function isWrapperKey(type: keyof proto.IMessage): type is WrapperKey {
  return WRAPPER_SET.has(type);
}

function isViewOnceKey(type: WrapperKey): boolean {
  return (
    type === 'viewOnceMessage' ||
    type === 'viewOnceMessageV2' ||
    type === 'viewOnceMessageV2Extension'
  );
}

function isTextExtractableKey(type: keyof proto.IMessage): type is TextExtractableKey {
  return type in TEXT_EXTRACTORS;
}

function isContextInfoKey(type: keyof proto.IMessage): type is ContextInfoKey {
  return type in CONTEXT_INFO_EXTRACTORS;
}

function isExpirationKey(type: keyof proto.IMessage): type is ExpirationKey {
  return type in EXPIRATION_EXTRACTORS;
}

function extractInnerMessage(
  msg: proto.IMessage,
  type: WrapperKey,
): proto.IMessage | null | undefined {
  return WRAPPER_EXTRACTORS[type](msg);
}

function extractContent<T extends keyof proto.IMessage>(
  msg: proto.IMessage,
  type: T,
): proto.IMessage[T] {
  return msg[type];
}

function extractContextInfo(
  msg: proto.IMessage,
  type: keyof proto.IMessage,
): proto.IContextInfo | null {
  if (!isContextInfoKey(type)) return null;
  return CONTEXT_INFO_EXTRACTORS[type](msg) ?? null;
}

function extractExpiration(msg: proto.IMessage, type: keyof proto.IMessage): number {
  if (!isExpirationKey(type)) return 0;
  return EXPIRATION_EXTRACTORS[type](msg) ?? 0;
}

export class MessageSerializer {
  constructor(
    private readonly client: Client,
    private readonly config: Config,
    private readonly logger?: Logger,
  ) {}

  findText(msg: proto.IMessage, type: keyof proto.IMessage): string | null {
    if (!isTextExtractableKey(type)) return null;
    return TEXT_EXTRACTORS[type](msg) ?? null;
  }

  async serialize(rawMessage: WAMessage): Promise<MessageSerialize | null> {
    if (!rawMessage?.message) {
      this.logger?.info({ rawMessage }, 'Serialize: rawMessage.message is missing');
      return null;
    }

    const resolved = this.resolveMessageSafely(rawMessage.message);
    if (!resolved) {
      this.logger?.info({ message: rawMessage.message }, 'Serialize: resolveMessage returned null');
      return null;
    }

    const { message, type, isViewOnce, isEdited, isRevoke } = resolved;

    const botJid = this.client.decodeJid(this.client.user?.id);
    const botLid = this.client.decodeJid(this.client.user?.lid);

    const isGroup = rawMessage.key.remoteJid?.endsWith('@g.us') || false;
    const isStatus = rawMessage.key.remoteJid === 'status@broadcast' || false;

    const fromMe =
      areJidsSameUser(rawMessage.key?.remoteJid || '', botJid) || rawMessage.key.fromMe || false;

    const from =
      isGroup || rawMessage.key.remoteJid?.includes('status@broadcast')
        ? rawMessage.key.remoteJid || ''
        : rawMessage.key.remoteJidAlt || '';

    const sender = isGroup
      ? fromMe
        ? rawMessage.key.remoteJidAlt || botJid
        : rawMessage.key.participantAlt || ''
      : fromMe
        ? botJid || rawMessage.key.remoteJidAlt || ''
        : rawMessage.key.remoteJidAlt || rawMessage.key.remoteJid || '';

    const lid = isGroup
      ? rawMessage.key.participant || ''
      : fromMe
        ? botLid || ''
        : isStatus
          ? rawMessage.key.participant || ''
          : rawMessage.key.remoteJid || '';

    const contextInfo = extractContextInfo(message, type);
    const expiration = extractExpiration(message, type);
    const mentions = contextInfo?.mentionedJid ?? [];
    const bodyFields = this.getBodyFields(message, type);
    const isOwner = this.config.ownerNumber.includes(sender.split('@')[0]);

    const m: MessageSerialize = {
      key: rawMessage.key,
      id: rawMessage.key.id ?? '',
      isViewOnce: isViewOnce || rawMessage.key.isViewOnce || false,
      isEdited,
      isRevoke,
      isGroup,
      isOwner,
      from,
      fromMe,
      sender,
      lid,
      message,
      type,
      expiration,
      messageTimestamp: Number(rawMessage.messageTimestamp) || Date.now(),
      pushName: rawMessage.pushName ?? '',
      mentions,
      ...bodyFields,
      quoted: undefined,
    };

    m.quoted = this.buildQuoted(contextInfo, m.from, m.sender);

    return m;
  }
  private resolveMessageSafely(rawMessage: proto.IMessage) {
    if (!rawMessage) return null;

    let currentMessage = rawMessage;
    let type = getContentType(currentMessage);
    let isViewOnce = false;
    let isEdited = false;
    let isRevoke = false;

    const MAX_DEPTH = 4;
    let depth = 0;

    while (type && depth < MAX_DEPTH) {
      depth++;

      // Protocol Message
      if (type === 'protocolMessage') {
        const protocol = currentMessage.protocolMessage;
        if (!protocol) break;

        // Edit Message
        if (
          protocol.type === proto.Message.ProtocolMessage.Type.MESSAGE_EDIT &&
          protocol.editedMessage
        ) {
          isEdited = true;
          currentMessage = protocol.editedMessage;
          type = getContentType(currentMessage);
          continue;
        }

        // Revoke Message (Deleted Message)
        if (protocol.type === proto.Message.ProtocolMessage.Type.REVOKE) {
          isRevoke = true;
        }

        break;
      }

      // Wrapper types
      if (!isWrapperKey(type)) {
        // Dev warning: check if this is a wrapper that hasn't been registered
        if (process.env.NODE_ENV !== 'production') {
          const val = currentMessage[type];
          if (val && typeof val === 'object' && !Array.isArray(val) && 'message' in val) {
            const inner = (val as { message?: unknown }).message;
            if (inner && typeof inner === 'object' && getContentType(inner as proto.IMessage)) {
              this.logger?.warn(
                `[resolveMessage] unregistered wrapper: "${type}" — ` +
                  `add to WRAPPER_EXTRACTORS: ${type}: (msg) => msg.${type}?.message`,
              );
            }
          }
        }
        break;
      }

      if (isViewOnceKey(type)) isViewOnce = true;

      const inner = extractInnerMessage(currentMessage, type);
      if (!inner) break;

      currentMessage = inner;
      type = getContentType(currentMessage);
    }

    if (!type) return null;

    return {
      message: currentMessage, // resolved inner, bukan raw
      content: extractContent(currentMessage, type),
      type,
      isViewOnce,
      isEdited,
      isRevoke,
    };
  }
  private getBodyFields(message: proto.IMessage, type: keyof proto.IMessage) {
    const body = this.findText(message, type)?.trim() || '';
    const prefixes = this.config.prefix || ['!', '.', '/'];
    const prefix = prefixes.find((p) => body.startsWith(p)) || '';
    const args = body.slice(prefix?.length).trim().split(/ +/) || [];
    const command = prefix ? args[0] : '';
    const query = args.slice(1).join(' ') || '';

    return { body, args, prefix, command, query };
  }

  private buildQuoted(
    contextInfo: proto.IContextInfo | null,
    parentFrom: string,
    parentSender: string,
  ): MessageSerialize | undefined {
    if (!contextInfo?.quotedMessage) return undefined;

    const quotedResolved = this.resolveMessageSafely(contextInfo.quotedMessage);
    if (!quotedResolved) return undefined;

    const { message: finalQuotedMessage, type: quotedType } = quotedResolved;

    const stanzaId = contextInfo.stanzaId ?? '';
    const participant = contextInfo.participant ?? '';

    const botJid = this.client.decodeJid(this.client.user?.id);
    const botLid = this.client.decodeJid(this.client.user?.lid);
    const isFromMe = areJidsSameUser(participant, participant.endsWith('@lid') ? botLid : botJid);

    const remoteJid = parentFrom || parentSender;
    const isGroup = remoteJid.endsWith('@g.us');
    const senderJid = isFromMe ? this.client.decodeJid(botJid) : this.client.decodeJid(participant);

    const senderLid = isFromMe ? botLid : this.client.decodeJid(participant);

    const bodyFields = this.getBodyFields(finalQuotedMessage, quotedType);
    const subContextInfo = extractContextInfo(finalQuotedMessage, quotedType);
    const mentions = subContextInfo?.mentionedJid ?? [];

    const q: MessageSerialize = {
      key: {
        remoteJid: remoteJid,
        fromMe: isFromMe,
        id: stanzaId,
        participant: senderLid,
        participantAlt: senderJid,
      },
      id: stanzaId,
      from: parentFrom || remoteJid, // biasanya dari chat/room yang sama
      fromMe: isFromMe,
      isGroup: isGroup,
      type: quotedType,
      message: finalQuotedMessage,
      sender: senderJid,
      lid: senderLid,
      expiration: 0,
      messageTimestamp: Date.now(),
      pushName: '', // do i need to handle this? from cache message
      mentions,
      isOwner: this.config.ownerNumber.includes(senderJid.split('@')[0]),
      isViewOnce: false,
      ...bodyFields,
    };

    return q;
  }
}
