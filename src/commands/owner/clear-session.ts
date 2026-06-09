import type { CommandConfig } from '../../shared/types/index.js';

export const ClearSession: CommandConfig = {
  name: 'clear-session',
  aliases: ['clearsession', 'csession'],
  description: 'Clear baileys auth session except creds',
  isOwner: true,
  run: async function run(ctx) {
    try {
      const keepCreds = true;
      ctx.logger.info({ jid: ctx.sender, keepCreds }, 'Attempting to clear session');
      await ctx.client.clearSession(keepCreds);

      await ctx.reply('Session cleared successfully.');
      ctx.logger.info({ jid: ctx.sender, keepCreds }, 'Session cleared successfully');
    } catch (err) {
      await ctx.reply('Failed to clear session.');
      ctx.logger.error({ err }, 'Failed to clear session');
    }
  },
};
//