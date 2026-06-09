import { createReadStream, existsSync } from 'node:fs';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import type { WAMediaUpload } from '@whiskeysockets/baileys';
import { fileTypeFromBuffer, fileTypeStream } from 'file-type';
import type { ClientMediaUpload } from '../types/index.js';
import { isURL } from './validator.js';
/**
 * Normalise a `ClientMediaUpload` (URL string | Buffer | Readable) into the
 * `WAMediaUpload` shape Baileys expects.
 */
// export const resolveMedia = (input: ClientMediaUpload): WAMediaUpload => {
//     if (typeof input === "string" && isURL(input)) return { url: input };
//     if (Buffer.isBuffer(input)) return input;
//     if (input instanceof Readable) return { stream: input };
//     // Convert Web ReadableStream to Node Readable if necessary
//     if (input instanceof ReadableStream) {
//         return { stream: Readable.fromWeb(input) };
//     }
//     throw new Error(
//         "Invalid media type. Must be a string, Buffer, or ReadableStream",
//     );
// };
export const resolveMedia = (input: ClientMediaUpload): WAMediaUpload => {
  // String: bisa URL atau file path
  if (typeof input === 'string') {
    if (isURL(input)) return { url: input };
    if (existsSync(input)) return { stream: createReadStream(input) };
    throw new Error('Invalid media type: string must be a valid URL or existing file path');
  }

  if (Buffer.isBuffer(input)) return input;

  // Node.js ReadableStream / Readable
  if (input instanceof Readable) return { stream: input };

  // Fallback untuk NodeJS.ReadableStream yang bukan Readable
  if (input !== null && typeof (input as NodeJS.ReadableStream).pipe === 'function') {
    return { stream: input as Readable };
  }

  // Web ReadableStream -> convert ke Node Readable
  if (typeof ReadableStream !== 'undefined' && input instanceof ReadableStream) {
    return {
      stream: Readable.fromWeb(input as NodeReadableStream),
    };
  }

  throw new Error('Invalid media type. Must be a URL, file path, Buffer, or ReadableStream');
};
/**
 * Convert a Readable stream to a Buffer.
 * @param stream - The Readable stream to convert
 * @returns A Promise resolving to a Buffer
 */
export const streamToBuffer = async (stream: Readable): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  stream.destroy();
  return Buffer.concat(chunks);
};
/**
 * Get the file type and mime type from a buffer.
 * @param buffer - The buffer to analyze
 * @returns Object containing ext and mime, or undefined if unknown
 */
export const getFileTypeFromBuffer = async (
  buffer: Buffer,
): Promise<{ ext: string; mime: string } | undefined> => {
  const type = await fileTypeFromBuffer(buffer);
  if (!type) return undefined;
  return {
    ext: type.ext,
    mime: type.mime,
  };
};
/**
 * Get the file type and mime type from a stream.
 * @param stream - The stream to analyze (Node.js Readable or Web ReadableStream)
 * @returns Object containing stream, ext and mime, or undefined if unknown
 */
export const getStreamWithFileTypeFromStream = async (
  stream: Readable | ReadableStream,
): Promise<
  | {
      stream: ReadableStream;
      ext: string;
      mime: string;
    }
  | undefined
> => {
  // Convert Node.js Readable to Web ReadableStream if necessary
  const webStream = stream instanceof Readable ? Readable.toWeb(stream) : stream;
  const streamWithFileType = await fileTypeStream(webStream);
  if (!streamWithFileType?.fileType) return;
  return {
    stream: streamWithFileType,
    ext: streamWithFileType.fileType?.ext,
    mime: streamWithFileType.fileType?.mime,
  };
};

/**
 * Generate a random filename with the given extension.
 * @param ext - The file extension (e.g., "mp4", "jpg")
 * @returns Generate filename (e.g., "123456789.mp4")
 */
export const getRandomFilename = (ext: string): string => {
  return `${Date.now()}_${Math.floor(Math.random() * 10000)}.${ext}`;
};

/**
 * Check if a buffer is an image based on its likely mime type from magic bytes.
 * @param buffer - The buffer to check
 * @returns true if image, otherwise false
 */
export const isImageBuffer = async (buffer: Buffer): Promise<boolean> => {
  const type = await getFileTypeFromBuffer(buffer);
  return !!type?.mime.startsWith('image/');
};

/**
 * Check if a buffer is a video based on its likely mime type from magic bytes.
 * @param buffer - The buffer to check
 * @returns true if video, otherwise false
 */
export const isVideoBuffer = async (buffer: Buffer): Promise<boolean> => {
  const type = await getFileTypeFromBuffer(buffer);
  return !!type?.mime.startsWith('video/');
};
