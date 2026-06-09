import { vi } from 'vitest';
import type { Logger } from '../../src/core/logger/pino.js';

export const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  trace: vi.fn(),
  fatal: vi.fn(),
} as unknown as Logger;
