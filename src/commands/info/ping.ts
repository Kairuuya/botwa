import type { CommandConfig } from "../../shared/types/index.js";

export const Ping: CommandConfig = {
  name: "ping",
  aliases: ["ping", "p", "ping!"],
  description: "Check bot response time",
  run: async function run(ctx) {
    const start = performance.now();
    const timestamp = Number(ctx.messageTimestamp);
    const responseTime = Math.abs(Date.now() - timestamp * 1000);
    const end = performance.now();
    const latency = (end - start).toFixed(4);

    await ctx.reply(
      `Pong!\nResponse Time: ${responseTime}ms\nLatency: ${latency}ms`,
    );
  },
};
