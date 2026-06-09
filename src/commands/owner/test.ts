import { extractMessageContent, getContentType, normalizeMessageContent, type WAMessage } from '@whiskeysockets/baileys';
import type { CommandConfig } from '../../shared/types/index.js';

export const Test: CommandConfig = {
  name: 'test',
  aliases: ['test'],
  description: 'Test function',
  isOwner: true,
  run: async function run(ctx) {
    if (ctx.quoted?.type?.includes('video')) {
      const path = await ctx.downloadAndSaveMediaMessage(ctx.msg.quoted);
      ctx.reply(`done ${path}`);
    }
    const getNormalizedMessage = (rawMessage:WAMessage) => {
      const message = extractMessageContent(normalizeMessageContent(rawMessage.message))
      const type = message ? getContentType(message) : null
      return {message,type}
    }
    ctx.logger.debug(ctx.msg)
    ctx.reply(JSON.stringify(getNormalizedMessage(ctx.msg), null, 2))
  },
};

