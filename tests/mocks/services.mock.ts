import { vi } from 'vitest';
import type { Services } from '../../src/shared/types/context.js';

export const createMockServices = () => {
  return {
    user: {
      upsertUser: vi.fn().mockImplementation(async (jid, lid, pushName) => {
        return {
          jid,
          lid: lid || null,
          pushName: pushName || 'Test User',
          role: 'FREE',
          isBanned: false,
          language: 'id',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }),
      getUser: vi.fn(),
      updateUser: vi.fn(),
      getJidByLid: vi.fn(),
      getLidByJid: vi.fn(),
      getUserRole: vi.fn(),
      getPushName: vi.fn(),
      checkIsBanned: vi.fn().mockResolvedValue(false),
    },
    group: {
      getGroup: vi.fn().mockImplementation(async (jid) => {
        return {
          jid,
          isBanned: false,
          isMute: false,
          welcome: null,
          goodbye: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: {
            subject: 'Test Group',
          },
          participants: [],
        };
      }),
      upsertGroup: vi.fn().mockImplementation(async (_client, jid) => {
        return {
          jid,
          isBanned: false,
          isMute: false,
          welcome: null,
          goodbye: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: {
            subject: 'Test Group',
          },
          participants: [],
        };
      }),
      ensureGroup: vi.fn(),
      updateParticipants: vi.fn(),
      updateGroup: vi.fn(),
      getGroupMetadata: vi.fn(),
      isBanned: vi.fn().mockResolvedValue(false),
      isMute: vi.fn().mockResolvedValue(false),
      getWelcomeMessage: vi.fn(),
      getGoodbyeMessage: vi.fn(),
    },
  } as unknown as Services;
};
