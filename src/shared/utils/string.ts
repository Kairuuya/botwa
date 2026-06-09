/**
 * Generate a random string of alphanumeric characters.
 * @param length - Length of the generated string (default: 8)
 * @returns Random string
 */
export const generateRandomString = (length = 8): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Truncate a string to a specified length and add an ellipsis (...).
 * @param str - The string to truncate
 * @param maxLength - Maximum length (default: 50)
 * @returns Truncated string
 */
export const truncateString = (str: string, maxLength = 50): string => {
  if (str.length <= maxLength) return str;
  return `${str.substring(0, maxLength)}...`;
};

/**
 * Remove all HTML tags from a string.
 * @param str - String containing HTML tags
 * @returns String without HTML tags
 */
export const stripHtml = (str: string): string => {
  return str.replace(/<[^>]*>?/gm, '');
};

/**
 * Capitalize the first letter of a string.
 * @param word - The string to capitalize
 * @returns Capitalized string
 */
export function capitalize(word: string) {
  return word.charAt(0).toUpperCase() + word.slice(1).toLocaleLowerCase();
}

/**
 * Capitalize the first letter of each word in a string.
 * @param name - The string to capitalize
 * @returns Capitalized string
 */
export function capitalizeName(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((word) => capitalize(word))
    .join(' ');
}

export function findSimilar(
  query: string,
  options: string[],
  threshold = 60,
  max = 3,
): {
  text: string;
  similarity: number;
}[] {
  if (!query || typeof query !== 'string') return [];

  return options
    .filter((opt) => opt && typeof opt === 'string')
    .map((opt) => ({
      text: opt,
      similarity: 100 - (levenshtein(query, opt) * 100) / Math.max(query.length, opt.length),
    }))
    .filter((res) => res.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, max);
}

export function levenshtein(a: string, b: string): number {
  if (typeof a !== 'string' || typeof b !== 'string') return 0;

  const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[a.length][b.length];
}
