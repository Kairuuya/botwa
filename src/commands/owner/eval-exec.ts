import { exec } from 'node:child_process';
import { inspect } from 'node:util';
import type { CommandConfig } from '../../shared/types/index.js';

export const EvalExec: CommandConfig = {
  name: 'eval-exec',
  aliases: ['evals', 'execs'],
  description: 'Execute code',
  isOwner: true,
  run: async function run(ctx) {
    if (ctx.command === 'evals') {
      try {
        // biome-ignore lint/security/noGlobalEval: <owner only>
        const result = await eval(`(async() => { ${ctx.query}})()`);
        await ctx.reply(inspect(result));
        ctx.logger.info(`Eval: ${ctx.query}`);
      } catch (error) {
        await ctx.reply(inspect(error, true));
        ctx.logger.error(`Eval error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (ctx.command === 'execs') {
      try {
        const result = await new Promise<string>((resolve, reject) => {
          exec(ctx.query, { windowsHide: true }, (err, stdout, stderr) => {
            if (err) return reject(err);
            if (stderr) return reject(stderr);
            resolve(stdout);
          });
        });

        await ctx.reply(inspect(result, true));
        ctx.logger.info(`Exec: ${ctx.query}`);
      } catch (error) {
        await ctx.reply(inspect(error, true));
        ctx.logger.error(`Exec error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  },
};
