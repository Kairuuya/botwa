/**
 * Pads a number with leading zeros to a specified length.
 *
 * @param num - The number to pad.
 * @param length - The target length of the resulting string. Defaults to 2.
 * @returns The zero-padded string.
 */
const padZero = (num: number, length: number = 2): string => num.toString().padStart(length, '0');

/**
 * Converts a duration in milliseconds to a formatted duration string in HH:MM:SS format.
 *
 * @param milliseconds - The duration in milliseconds.
 * @returns The formatted time string (e.g., "01:23:45").
 */
export const msToTime = (milliseconds: number): string => {
  if (typeof milliseconds !== 'number' || milliseconds < 0) return '00:00:00';
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return `${padZero(hours % 24)}:${padZero(minutes % 60)}:${padZero(seconds % 60)}`;
};

/**
 * Converts seconds to a formatted duration string in MM:SS format.
 *
 * @param seconds - The duration in seconds.
 * @returns The formatted duration string (e.g., "05:30").
 */
export const secToDuration = (seconds: number): string => {
  if (typeof seconds !== 'number' || seconds < 0) return '00:00';
  return `${padZero(Math.floor(seconds / 60))}:${padZero(seconds % 60)}`;
};

/**
 * Converts seconds into a human-readable runtime duration string.
 * Splits duration into days, hours, minutes, and seconds.
 *
 * @param seconds - The duration in seconds.
 * @returns A comma-separated human-readable string (e.g., "2 days, 3 hours, 5 minutes, 12 seconds").
 */
export const runtime = (seconds: number): string => {
  if (typeof seconds !== 'number' || seconds < 0) return '0 seconds';
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (d > 0) parts.push(`${d} ${d === 1 ? 'day' : 'days'}`);
  if (h > 0) parts.push(`${h} ${h === 1 ? 'hour' : 'hours'}`);
  if (m > 0) parts.push(`${m} ${m === 1 ? 'minute' : 'minutes'}`);
  if (s > 0 || parts.length === 0) parts.push(`${s} ${s === 1 ? 'second' : 'seconds'}`);
  return parts.join(', ');
};

/**
 * Converts a byte value into a human-readable file size string.
 * Auto-scales to bytes, KB, MB, GB, or TB.
 *
 * @param bytes - The size in bytes.
 * @returns A formatted file size string (e.g., "1.24 MB").
 */
export const fileSize = (bytes: number): string => {
  if (typeof bytes !== 'number' || bytes <= 0) return '0 bytes';
  if (bytes === 1) return '1 byte';
  const sizes = ['bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(2)} ${sizes[i]}`;
};

/**
 * Formats a raw phone number string into a standard readable layout.
 * Assumes the last 10 digits represent local segments.
 *
 * @param number - The raw phone number string.
 * @returns The formatted phone number string.
 */
export const phoneNumber = (number: string): string => {
  if (typeof number !== 'string') return '';
  const cleaned = number.replace(/\D/g, '');
  if (cleaned.length >= 10) {
    return `+${cleaned.slice(0, -10)} ${cleaned.slice(-10, -7)} ${cleaned.slice(-7, -4)} ${cleaned.slice(-4)}`;
  }
  return number;
};

/**
 * Converts a phone number or raw string into the WhatsApp JID format.
 * Example: 0895xxxx / 6289xxxx -> 6289xxxx@s.whatsapp.net
 *
 * @param number - The phone number or string to convert.
 * @returns The formatted WhatsApp JID.
 */
export const toJid = (number: string | number): string => {
  const str = String(number).trim();
  if (str.endsWith('@s.whatsapp.net') || str.endsWith('@g.us') || str.endsWith('@lid')) {
    return str;
  }

  let cleaned = str.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = `62${cleaned.slice(1)}`;
  }

  return cleaned ? `${cleaned}@s.whatsapp.net` : '';
};

/**
 * Truncates a string to a specified maximum length, appending a suffix.
 *
 * @param str - The input string to truncate.
 * @param maxLength - The maximum allowed length of the resulting string.
 * @param suffix - The string to append to the end. Defaults to "...".
 * @returns The truncated string.
 */
export const truncate = (str: string, maxLength: number, suffix: string = '...'): string => {
  if (typeof str !== 'string') return '';
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - suffix.length) + suffix;
};

/**
 * Converts a string to Title Case (capitalizes the first letter of each word).
 *
 * @param str - The input string.
 * @returns The title-cased string.
 */
export const titleCase = (str: string): string => {
  if (typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Formats a number with commas as thousands separators.
 *
 * @param num - The number to format.
 * @returns The formatted number string (e.g., "1,234,567").
 */
export const numberWithCommas = (num: number): string => {
  if (typeof num !== 'number') return '0';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

/**
 * Formats a numeric amount as currency with thousands separators.
 *
 * @param amount - The numeric amount.
 * @param curr - The currency code prefix. Defaults to "USD".
 * @returns The formatted currency string (e.g., "USD 1,234.50").
 */
export const currency = (amount: number, curr: string = 'USD'): string => {
  if (typeof amount !== 'number') return `${curr} 0.00`;
  return `${curr} ${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
};

/**
 * Formats text as bold in WhatsApp syntax.
 *
 * @param text - The text or number to format.
 * @returns The bolded text (e.g., "*text*").
 */
export const bold = (text: string | number): string => `*${text}*`;

/**
 * Formats text as italic in WhatsApp syntax.
 *
 * @param text - The text or number to format.
 * @returns The italicized text (e.g., "_text_").
 */
export const italic = (text: string | number): string => `_${text}_`;

/**
 * Formats text as strikethrough in WhatsApp syntax.
 *
 * @param text - The text or number to format.
 * @returns The strikethrough text (e.g., "~text~").
 */
export const strike = (text: string | number): string => `~${text}~`;

/**
 * Formats text as inline code in WhatsApp syntax.
 *
 * @param text - The text or number to format.
 * @returns The inline code text (e.g., "`text`").
 */
export const inlineCode = (text: string | number): string => `\`${text}\``;

/**
 * Formats text as a monospace block in WhatsApp syntax.
 *
 * @param text - The text or number to format.
 * @returns The monospace text (e.g., "```text```").
 */
export const monospace = (text: string | number): string => `\`\`\`${text}\`\`\``;

/**
 * Formats a multi-line string as a blockquote safely in WhatsApp syntax.
 * Prepends "> " to each line in the text.
 *
 * @param text - The multi-line text to format.
 * @returns The blockquoted text.
 */
export const quote = (text: string): string => {
  return text
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
};

/**
 * Creates a formatted bulleted or numbered list from an array of items.
 *
 * @param items - The array of strings or numbers to list.
 * @param type - The list type: "bullet" or "number". Defaults to "bullet".
 * @returns The formatted list string.
 */
export const list = (items: (string | number)[], type: 'bullet' | 'number' = 'bullet'): string => {
  if (type === 'number') {
    return items.map((item, index) => `${index + 1}. ${item}`).join('\n');
  }
  // Default to bullet
  return items.map((item) => `- ${item}`).join('\n');
};

/**
 * Formats a hidden mention by extracting the phone number from a WhatsApp JID.
 * The standard WhatsApp client renders this mention if the JID is included in the mentions array.
 *
 * @param jid - The WhatsApp JID (e.g., "12345@s.whatsapp.net").
 * @param text - The text context (reserved for future use).
 * @returns The formatted mention string (e.g., "@12345").
 */
export const hiddenMention = (jid: string, _text: string): string => {
  return `@${jid.split('@')[0]}`;
};
