import { createWriteStream } from 'node:fs';
import { mkdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Stream from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { type GroupParticipant, GroupRole } from '@prisma/client';
import {
  type AnyMessageContent,
  downloadMediaMessage,
  jidDecode,
  type proto,
  type WAMessage,
} from '@whiskeysockets/baileys';
import { parsePhoneNumber } from 'awesome-phonenumber';
import type { Client } from '../../core/client/client.js';
import type { Logger } from '../../core/logger/pino.js';
import type { ClientMediaUpload, ContextOptions, MessageSerialize } from '../../shared/types/index.js';
import { getStreamWithFileTypeFromStream, resolveMedia } from '../../shared/utils/index.js';

export class Context {
  public readonly client: Client;
  public readonly msg: MessageSerialize;
  public readonly logger: Logger;
  public readonly key: MessageSerialize['key'];
  public readonly message: MessageSerialize['message'];
  public readonly id: MessageSerialize['id'];
  public readonly from: MessageSerialize['from'];
  public readonly fromMe: MessageSerialize['fromMe'];
  public readonly sender: MessageSerialize['sender'];
  public readonly lid: MessageSerialize['lid'];
  public readonly pushName: MessageSerialize['pushName'];
  public readonly type: MessageSerialize['type'];
  public readonly expiration: MessageSerialize['expiration'];
  public readonly messageTimestamp: MessageSerialize['messageTimestamp'];
  public readonly mentions: MessageSerialize['mentions'];
  public readonly body: MessageSerialize['body'];
  public readonly args: MessageSerialize['args'];
  public readonly query: MessageSerialize['query'];
  public readonly command: MessageSerialize['command'];
  public readonly prefix: MessageSerialize['prefix'];
  public readonly isGroup: MessageSerialize['isGroup'];
  public readonly isOwner: MessageSerialize['isOwner'];
  public readonly isViewOnce: MessageSerialize['isViewOnce'];
  public readonly isEdited: MessageSerialize['isEdited'];
  public readonly isRevoke: MessageSerialize['isRevoke'];
  public readonly groupMetadata: MessageSerialize['groupMetadata'];
  public readonly quoted: MessageSerialize['quoted'];

  public readonly services: ContextOptions['services'];
  public readonly user: ContextOptions['user'];
  public readonly group: ContextOptions['group'];
  public readonly participantMap: Map<string, GroupParticipant>;
  constructor(opt: ContextOptions) {
    this.key = opt.msg.key;
    this.message = opt.msg.message;
    this.messageTimestamp = opt.msg.messageTimestamp;
    this.id = opt.msg.id;
    this.from = opt.msg.from;
    this.fromMe = opt.msg.fromMe;
    this.sender = opt.msg.sender;
    this.lid = opt.msg.lid;
    this.pushName = opt.msg.pushName;
    this.type = opt.msg.type;
    this.expiration = opt.msg.expiration;
    this.mentions = opt.msg.mentions;
    this.body = opt.msg.body;
    this.args = opt.msg.args;
    this.query = opt.msg.query;
    this.command = opt.msg.command;
    this.prefix = opt.msg.prefix;
    this.isGroup = opt.msg.isGroup;
    this.isOwner = opt.msg.isOwner;
    this.isViewOnce = opt.msg.isViewOnce;
    this.isEdited = opt.msg.isEdited;
    this.isRevoke = opt.msg.isRevoke;
    this.groupMetadata = opt.msg.groupMetadata;
    this.quoted = opt.msg.quoted;
    this.user = opt.user;
    this.group = opt.group;
    this.msg = opt.msg;
    this.client = opt.client;
    this.services = opt.services;
    this.participantMap = new Map(opt.group?.participants.map((p) => [p.userJid, p]));
    this.logger = opt.logger;
  }

  get botJid() {
    return this.client.user?.id ?? '';
  }
  get botLid() {
    return this.client.user?.lid ?? '';
  }
  get userRole() {
    return this.participantMap.get(this.sender)?.role;
  }
  get botRole() {
    return this.participantMap.get(this.botJid)?.role;
  }
  get isUserGroupAdmin() {
    return this.userRole === GroupRole.ADMIN || this.userRole === GroupRole.SUPERADMIN;
  }
  get isUserGroupOwner() {
    return this.userRole === GroupRole.SUPERADMIN;
  }
  get isBotGroupAdmin() {
    return this.botRole === GroupRole.ADMIN || this.botRole === GroupRole.SUPERADMIN;
  }
  public async reply(text: string) {
    return this.client.sendMessage(this.from, { text }, { quoted: this.msg });
  }
  public async downloadMediaMessageBuffer(msg: MessageSerialize = this.msg): Promise<Buffer> {
    const buffer = await downloadMediaMessage(
      msg,
      'buffer',
      {},
      {
        logger: this.logger,
        reuploadRequest: this.client.updateMediaMessage,
      },
    );
    return buffer;
  }
  public async downloadMediaMessageStream(
    msg: MessageSerialize = this.msg,
  ): Promise<Stream.Transform> {
    const stream = await downloadMediaMessage(
      msg,
      'stream',
      {},
      {
        logger: this.logger,
        reuploadRequest: this.client.updateMediaMessage,
      },
    );
    return stream;
  }

  public async downloadAndSaveMediaMessage(
    msg: MessageSerialize = this.msg,
    folder: string = tmpdir(),
    attachExtension: boolean = true,
  ): Promise<string> {
    await mkdir(folder, { recursive: true });

    const basePath = join(folder, `${msg.sender.split('@')[0]}_${Date.now()}`);

    const mediaStream = await this.downloadMediaMessageStream(msg);

    // const [typeStream, fileStream] = Readable.toWeb(mediaStream).tee();

    const streamWithFileType = await getStreamWithFileTypeFromStream(mediaStream);
    if (!streamWithFileType) throw new Error('Failed to get file type');

    const filePath = attachExtension ? `${basePath}.${streamWithFileType?.ext ?? 'bin'}` : basePath;

    const writeStream = createWriteStream(filePath);

    try {
      await pipeline(streamWithFileType.stream, writeStream);
    } catch (err) {
      await unlink(filePath).catch(() => {});
      throw err;
    }

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
  //   return this.client.sendMessage(
  //     jid,
  //     { sticker: stickerBuffer },
  //     { quoted },
  //   ) as Promise<WAMessage>;
  // };

  public decodeJid = (jid: string): string => {
    if (!jid) return '';
    if (!/:\d+@/i.test(jid)) return jid.trim();
    const decoded = jidDecode(jid);
    return decoded?.user && decoded?.server ? `${decoded.user}@${decoded.server}` : jid.trim();
  };

  public async sendText(
    jid: string,
    text: string,
    quoted: MessageSerialize = this.msg,
    options?: Partial<AnyMessageContent>,
  ): Promise<WAMessage | undefined> {
    return this.client.sendMessage(jid, { text, ...options }, { quoted });
  }

  public async sendImage(
    jid: string,
    image: ClientMediaUpload,
    caption?: string,
    quoted: MessageSerialize = this.msg,
    options?: Partial<AnyMessageContent>,
  ): Promise<WAMessage | undefined> {
    return this.client.sendMessage(
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
    caption?: string,
    quoted: MessageSerialize = this.msg,
    gifPlayback: boolean = false,
    options?: Partial<AnyMessageContent>,
  ): Promise<WAMessage | undefined> {
    return this.client.sendMessage(
      jid,
      { video: resolveMedia(video), caption, gifPlayback, ...options },
      { quoted },
    );
  }
  public async sendAudio(
    jid: string,
    audio: ClientMediaUpload,
    mimetype = 'audio/mp4',
    ptt?: boolean,
    quoted: MessageSerialize = this.msg,
    options?: Partial<AnyMessageContent>,
  ): Promise<WAMessage | undefined> {
    return this.client.sendMessage(
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
    return this.client.sendMessage(jid, {
      react: { text: emoji, key },
    });
  }

  public async sendContact(
    jid: string,
    contacts: string[],
    msg: MessageSerialize = this.msg,
    options?: Partial<AnyMessageContent>,
  ): Promise<WAMessage | undefined> {
    const listContact = await Promise.all(
      contacts.map(async (c) => {
        const international = parsePhoneNumber(`+${c}`).number?.international;
        return {
          displayName: msg?.pushName ?? international,
          vcard: [
            'BEGIN:VCARD',
            'VERSION:3.0',
            `N:${msg?.pushName ?? international}`,
            `FN:${msg?.pushName ?? international}`,
            `item1.TEL;waid=${international}:${international}`,
            'item1.X-ABLabel:Mobile',
            'END:VCARD',
          ].join('\n'),
        };
      }),
    );

    return this.client.sendMessage(
      jid,
      {
        contacts: {
          displayName: `${listContact.length} Kontak`,
          contacts: listContact,
        },
        ...options,
      },
      { quoted: msg?.quoted },
    );
  }
}
