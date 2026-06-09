import pino from 'pino';
import { env } from '../../shared/config/env.js';

const isDevelopment = env.NODE_ENV !== 'production';

const logger = pino({
  level: isDevelopment ? 'debug' : 'info',
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: {
    targets: isDevelopment
      ? [
          {
            target: 'pino-pretty',
            level: 'debug',
            options: {
              colorize: true,
              translateTime: 'yyyy-mm-dd HH:MM:ss',
              ignore: 'pid,hostname',
              sync: true,
            },
          },
          {
            target: 'pino/file',
            level: 'info',
            options: {
              destination: `./logs/${new Date().toISOString().split('T')[0]}.log`,
              mkdir: true,
            },
          },
        ]
      : [
          {
            target: 'pino/file',
            level: 'info',
            options: {
              destination: `./logs/${new Date().toISOString().split('T')[0]}.log`,
              mkdir: true,
            },
          },
          {
            target: 'pino/file',
            level: 'info',
            options: {
              destination: 1,
              mkdir: true,
            },
          },
        ],
  },
});
export type Logger = typeof logger;
export default logger;
