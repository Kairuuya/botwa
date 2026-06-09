import { vi } from 'vitest';
import type { Client } from '../../src/core/client/client.js';

export const createMockClient = () => {
  return {
    readMessages: vi.fn().mockResolvedValue(undefined),
    sendText: vi.fn().mockResolvedValue(undefined),
    sendMessage: vi.fn().mockResolvedValue({}),
    groupMetadata: vi.fn().mockResolvedValue({
      id: 'group_jid',
      subject: 'Mock Group',
      participants: [],
    }),
    decodeJid: vi.fn().mockImplementation((jid) => jid || 'bot_jid'),
  } as unknown as Client;
};
