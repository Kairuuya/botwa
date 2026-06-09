import type { Context } from '../../events/message/context.js';

export type CommandConfig = {
  name: string;
  aliases: string[];
  description: string;
  isOwner?: boolean;
  isGroup?: boolean;
  isBot?: boolean;
  isPrivate?: boolean;
  isGroupOwner?: boolean;
  isGroupAdmin?: boolean;
  isBotAdmin?: boolean;
  isPremium?: boolean;
  limit?: number;
  usage?: string;
  example?: string;
  cooldown?: number;
  run: (context: Context) => Promise<void> | void;
};
