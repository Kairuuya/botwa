import 'dotenv/config';
import { z } from 'zod/v4';

const emptyToUndefined = (val: unknown) => (val === '' ? undefined : val);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  OPENROUTER_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.preprocess(emptyToUndefined, z.coerce.number().optional().default(6379)),
  REDIS_PASSWORD: z.string().optional().default(''),
  REDIS_DB: z.preprocess(emptyToUndefined, z.coerce.number().optional().default(0)),
  CACHE_DEFAULT_TTL_MS: z.preprocess(emptyToUndefined, z.coerce.number().optional().default(300000)),
  CACHE_MAX_SIZE: z.preprocess(emptyToUndefined, z.coerce.number().optional().default(5000)),
  CACHE_TYPE: z.string().optional().default('auto'),
  QUEUE_WORKERS: z.preprocess(emptyToUndefined, z.coerce.number().optional().default(3)),
  QUEUE_MAX_RETRIES: z.preprocess(emptyToUndefined, z.coerce.number().optional().default(3)),
  QUEUE_DLQ_ENABLED: z.coerce.boolean().optional().default(true),
  QUEUE_DOWNLOAD_CONCURRENCY: z.preprocess(emptyToUndefined, z.coerce.number().optional().default(2)),
  QUEUE_MEDIA_CONCURRENCY: z.preprocess(emptyToUndefined, z.coerce.number().optional().default(1)),
});
export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;

