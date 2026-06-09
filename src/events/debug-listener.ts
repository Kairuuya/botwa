import type { WASocket } from '@whiskeysockets/baileys';
import type { Logger } from '../core/logger/pino.js';

export class DebugListener {
  constructor(private readonly logger: Logger) {}

  register(ev: WASocket['ev']): void {
    ev.on('messaging-history.set', (history) =>
      this.logger.debug({ history }, 'messaging history set'),
    );
    ev.on('messaging-history.status', (status) =>
      this.logger.debug({ status }, 'messaging history status'),
    );
    ev.on('chats.upsert', (chat) => this.logger.debug({ chat }, 'chat upsert'));
    ev.on('chats.update', (chat) => this.logger.debug({ chat }, 'chat update'));
    ev.on('chats.delete', (ids) => this.logger.debug({ ids }, 'chats delete'));
    ev.on('chats.lock', (lock) => this.logger.debug({ lock }, 'chats lock'));
    ev.on('messages.upsert', (upsert) => this.logger.debug({ upsert }, 'messages upsert'));
    ev.on('messages.update', (msg) => this.logger.debug({ msg }, 'messages update'));
    ev.on('messages.delete', (msg) => this.logger.debug({ msg }, 'messages delete'));
    ev.on('messages.reaction', (r) => this.logger.debug({ r }, 'messages reaction'));
    ev.on('messages.media-update', (u) => this.logger.debug({ u }, 'messages media update'));
    ev.on('message-receipt.update', (r) => this.logger.debug({ r }, 'message receipt update'));
    ev.on('message-capping.update', (c) => this.logger.debug({ c }, 'message capping update'));
    ev.on('groups.upsert', (g) => this.logger.debug({ g }, 'groups upsert'));
    ev.on('groups.update', (g) => this.logger.debug({ g }, 'groups update'));
    ev.on('group-participants.update', (p) =>
      this.logger.debug({ p }, 'group participants update'),
    );
    ev.on('group.join-request', (r) => this.logger.debug({ r }, 'group join request'));
    ev.on('group.member-tag.update', (t) => this.logger.debug({ t }, 'group member tag update'));
    ev.on('presence.update', (d) => this.logger.debug({ d }, 'presence update'));
    ev.on('contacts.upsert', (c) => this.logger.debug({ c }, 'contacts upsert'));
    ev.on('contacts.update', (c) => this.logger.debug({ c }, 'contacts update'));
    ev.on('blocklist.set', (d) => this.logger.debug({ d }, 'blocklist set'));
    ev.on('blocklist.update', (d) => this.logger.debug({ d }, 'blocklist update'));
    ev.on('call', (call) => this.logger.debug({ call }, 'call'));
    ev.on('labels.edit', (l) => this.logger.debug({ l }, 'labels edit'));
    ev.on('labels.association', (d) => this.logger.debug({ d }, 'labels association'));
    ev.on('newsletter.reaction', (d) => this.logger.debug({ d }, 'newsletter reaction'));
    ev.on('newsletter.view', (d) => this.logger.debug({ d }, 'newsletter view'));
    ev.on('newsletter-participants.update', (d) =>
      this.logger.debug({ d }, 'newsletter participants update'),
    );
    ev.on('newsletter-settings.update', (d) =>
      this.logger.debug({ d }, 'newsletter settings update'),
    );
    ev.on('lid-mapping.update', (d) => this.logger.debug({ d }, 'lid mapping update'));
    ev.on('settings.update', (s) => this.logger.debug({ s }, 'settings update'));
  }
}
