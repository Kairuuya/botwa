import { GroupRole, UserRole } from '@prisma/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { Context } from '../../../src/events/message/context.js';
import type { MessageSerialize } from '../../../src/shared/types/index.js';
import { createMockClient } from '../../mocks/client.mock.js';
import { mockLogger } from '../../mocks/logger.mock.js';
import { createMockServices } from '../../mocks/services.mock.js';

describe('Context', () => {
  let mockClient: any;
  let mockServices: any;
  let mockMsg: MessageSerialize;
  let mockUser: any;
  let mockGroup: any;

  beforeEach(() => {
    mockClient = createMockClient();
    mockClient.user = { id: 'bot_jid@s.whatsapp.net', lid: 'bot_lid@lid' };

    mockServices = createMockServices();

    mockMsg = {
      key: { remoteJid: 'group_jid@g.us', id: 'msg_123', fromMe: false },
      id: 'msg_123',
      from: 'group_jid@g.us',
      fromMe: false,
      sender: 'user_jid@s.whatsapp.net',
      lid: 'user_lid@lid',
      pushName: 'Test User',
      type: 'conversation',
      body: '.ping tests',
      args: ['tests'],
      prefix: '.',
      command: 'ping',
      query: 'tests',
      isGroup: true,
      isOwner: false,
      isViewOnce: false,
      isEdited: false,
      isRevoke: false,
      messageTimestamp: Date.now(),
      message: {},
      mentions: [],
    } as unknown as MessageSerialize;

    mockUser = {
      jid: 'user_jid@s.whatsapp.net',
      lid: 'user_lid@lid',
      pushName: 'Test User',
      role: UserRole.FREE,
      isBanned: false,
      isBlock: false,
      language: 'id',
    };

    mockGroup = {
      jid: 'group_jid@g.us',
      isBanned: false,
      isMute: false,
      metadata: {
        subject: 'Bot Test Group',
      },
      participants: [
        {
          userJid: 'user_jid@s.whatsapp.net',
          role: GroupRole.ADMIN,
        },
        {
          userJid: 'bot_jid@s.whatsapp.net',
          role: GroupRole.MEMBER,
        },
      ],
    };
  });

  it('should initialize properties correctly in the constructor', () => {
    const context = new Context({
      client: mockClient,
      msg: mockMsg,
      services: mockServices,
      user: mockUser,
      group: mockGroup,
      logger: mockLogger,
    });

    expect(context.id).toBe('msg_123');
    expect(context.from).toBe('group_jid@g.us');
    expect(context.sender).toBe('user_jid@s.whatsapp.net');
    expect(context.isGroup).toBe(true);
    expect(context.botJid).toBe('bot_jid@s.whatsapp.net');
  });

  describe('Group Roles & Privileges', () => {
    it('should correctly determine user is admin but bot is not', () => {
      const context = new Context({
        client: mockClient,
        msg: mockMsg,
        services: mockServices,
        user: mockUser,
        group: mockGroup,
        logger: mockLogger,
      });

      expect(context.userRole).toBe(GroupRole.ADMIN);
      expect(context.botRole).toBe(GroupRole.MEMBER);
      expect(context.isUserGroupAdmin).toBe(true);
      expect(context.isBotGroupAdmin).toBe(false);
    });

    it('should correctly determine user is not admin when participant role is MEMBER', () => {
      mockGroup.participants[0].role = GroupRole.MEMBER;

      const context = new Context({
        client: mockClient,
        msg: mockMsg,
        services: mockServices,
        user: mockUser,
        group: mockGroup,
        logger: mockLogger,
      });

      expect(context.isUserGroupAdmin).toBe(false);
    });
  });

  describe('Message Sending Helpers', () => {
    it('should call client.sendMessage when reply is called', async () => {
      const context = new Context({
        client: mockClient,
        msg: mockMsg,
        services: mockServices,
        user: mockUser,
        group: mockGroup,
        logger: mockLogger,
      });

      await context.reply('Hello reply');
      expect(mockClient.sendMessage).toHaveBeenCalledWith(
        'group_jid@g.us',
        { text: 'Hello reply' },
        { quoted: mockMsg },
      );
    });

    it('should call client.sendMessage when sendText is called', async () => {
      const context = new Context({
        client: mockClient,
        msg: mockMsg,
        services: mockServices,
        user: mockUser,
        group: mockGroup,
        logger: mockLogger,
      });

      await context.sendText('some_other_jid', 'Direct Text');
      expect(mockClient.sendMessage).toHaveBeenCalledWith(
        'some_other_jid',
        { text: 'Direct Text' },
        { quoted: mockMsg },
      );
    });

    it('should call client.sendMessage when sendReaction is called', async () => {
      const context = new Context({
        client: mockClient,
        msg: mockMsg,
        services: mockServices,
        user: mockUser,
        group: mockGroup,
        logger: mockLogger,
      });

      const fakeKey = { remoteJid: 'group_jid', id: 'fake' };
      await context.sendReaction('group_jid', '👍', fakeKey);

      expect(mockClient.sendMessage).toHaveBeenCalledWith('group_jid', {
        react: { text: '👍', key: fakeKey },
      });
    });
  });

  describe('JID Decoders', () => {
    it('should decode WhatsApp JID correctly', () => {
      const context = new Context({
        client: mockClient,
        msg: mockMsg,
        services: mockServices,
        user: mockUser,
        group: mockGroup,
        logger: mockLogger,
      });

      expect(context.decodeJid('6281234567890:5@s.whatsapp.net')).toBe(
        '6281234567890@s.whatsapp.net',
      );
      expect(context.decodeJid('plain_jid')).toBe('plain_jid');
    });
  });
});
