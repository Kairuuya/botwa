import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod/v4";

const configSettingsSchema = z.object({
  ownerNotifyOnline: z.boolean(),
  autoReadStatus: z.boolean(),
  selfbot: z.boolean(),
  publicMode: z.boolean().default(true),
  autoReadMessage: z.boolean(),
  suggestSimilarCommands: z.boolean(),
  useLimit: z.boolean(),
  usePairingCode: z.boolean().default(true),
});

const configSchema = z.object({
  botName: z.string().min(1),
  botNumber: z.string().min(1),
  customPairingCode: z.string(),
  ownerNumber: z.array(z.string()).min(1, "At least one owner number required"),
  timezone: z.string().default("Asia/Jakarta"),
  prefix: z.array(z.string()).min(1, "At least one prefix required"),
  settings: configSettingsSchema,
});

export type ConfigSettings = z.infer<typeof configSettingsSchema>;
export type Config = z.infer<typeof configSchema> & {
  save: () => void;
};

const configPath = resolve(process.cwd(), "config.json");
const raw = JSON.parse(readFileSync(configPath, "utf-8"));
const parsed = configSchema.parse(raw);

const config: Config = {
  ...parsed,
  save() {
    const { save: _, ...data } = this;
    writeFileSync(configPath, JSON.stringify(data, null, 2));
  },
};

export default config;
