import type { MessageSerialize } from './serialize.js';

// ─── Queue Names ─────────────────────────────────────────────────────────────

/**
 * Registry of all queue names in the system.
 * Using `as const` ensures type-safe queue name references.
 * Add new queues here as the system grows.
 */
export const QueueName = {
  MESSAGE: 'queue_message',
  DOWNLOAD: 'queue_download',
  MEDIA_PROCESS: 'queue_media-process',
} as const;

export type QueueNameType = (typeof QueueName)[keyof typeof QueueName];

// ─── Job Data Interfaces ─────────────────────────────────────────────────────

/**
 * Job data for processing incoming WhatsApp messages.
 */
export interface MessageJobData {
  message: MessageSerialize;
}

/**
 * Generic, extensible job data for downloading media from external sources.
 * Add new `sourceType` values as you integrate more platforms.
 */
export interface DownloadJobData {
  /** The URL to download from */
  url: string;
  /** Source platform identifier — extend this union as needed */
  sourceType: string;
  /** Desired output format (e.g., 'mp4', 'mp3', 'jpg') */
  outputFormat?: string;
  /** JID of the user who requested the download */
  requesterJid: string;
  /** Chat JID where the result should be sent */
  chatJid: string;
  /** Arbitrary metadata for source-specific options */
  metadata?: Record<string, unknown>;
}

/**
 * Generic, extensible job data for media processing tasks.
 * Add new `operation` values as you integrate more processors.
 */
export interface MediaProcessJobData {
  /** Path to the input file */
  inputPath: string;
  /** Processing operation identifier — extend this as needed */
  operation: string;
  /** Desired output format */
  outputFormat?: string;
  /** Arbitrary options for the specific operation */
  options?: Record<string, unknown>;
  /** JID of the user who requested the processing */
  requesterJid: string;
  /** Chat JID where the result should be sent */
  chatJid: string;
}

// ─── Type-safe Queue → Data mapping ──────────────────────────────────────────

/**
 * Maps each queue name to its job data type.
 * Used by QueueManager to enforce type safety at compile time.
 */
export interface QueueJobDataMap {
  [QueueName.MESSAGE]: MessageJobData;
  [QueueName.DOWNLOAD]: DownloadJobData;
  [QueueName.MEDIA_PROCESS]: MediaProcessJobData;
}

// ─── Job Result Interfaces ───────────────────────────────────────────────────

export interface DownloadJobResult {
  filePath: string;
  fileSize: number;
  mimeType: string;
}

export interface MediaProcessJobResult {
  outputPath: string;
  fileSize: number;
  duration?: number;
}

/**
 * Maps each queue name to its job result type.
 */
export interface QueueJobResultMap {
  [QueueName.MESSAGE]: undefined;
  [QueueName.DOWNLOAD]: DownloadJobResult;
  [QueueName.MEDIA_PROCESS]: MediaProcessJobResult;
}

// ─── DLQ Types ───────────────────────────────────────────────────────────────

/**
 * Structure of a Dead Letter Queue entry written to `data/dlq.json`.
 */
export interface DLQEntry {
  queueName: string;
  jobId: string;
  jobName: string;
  data: unknown;
  failedReason: string;
  attemptsMade: number;
  failedAt: string; // ISO 8601 timestamp
}

// ─── Queue Stats ─────────────────────────────────────────────────────────────

export interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}
